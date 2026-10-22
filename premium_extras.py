"""Extra pages and features for Nexora AI, alongside premium.py."""
from datetime import date, datetime, timedelta

from flask import Blueprint, abort, jsonify, render_template_string, request
from flask_login import current_user, login_required

from premium import FREE_DAILY_LIMIT, FREE_PLAYGROUND_RUNS, PREMIUM_DAYS, PREMIUM_PRICE_INR, is_premium

extras_bp = Blueprint("extras", __name__)
db = None
Post = PageView = None


def init_extras(app, _db):
    """Register extra models; app.py creates tables on the first request."""
    global db, Post, PageView
    db = _db

    class PostModel(db.Model):
        __tablename__ = "community_post"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
        body = db.Column(db.String(1000), nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    class PageViewModel(db.Model):
        __tablename__ = "page_view"
        id = db.Column(db.Integer, primary_key=True)
        path = db.Column(db.String(200), index=True, nullable=False)
        day = db.Column(db.Date, default=date.today, index=True, nullable=False)

    Post, PageView = PostModel, PageViewModel


BASE_CSS = """<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#080b16;color:#e8ecff;font-family:Inter,Arial,sans-serif;padding:28px;max-width:900px;margin:auto}
h1,h2{color:#00f5d4;text-shadow:0 0 10px #00f5d455} a{color:#7c5cff}
.card{border:1px solid #7c5cff88;border-radius:14px;padding:18px;margin:14px 0;box-shadow:0 0 18px #7c5cff33}
button,.btn{background:#7c5cff;color:#fff;border:0;padding:11px 20px;border-radius:10px;cursor:pointer;box-shadow:0 0 14px #7c5cff99;font-size:16px;text-decoration:none;display:inline-block}
input,textarea{width:100%;box-sizing:border-box;background:#0d0d1a;color:#e8ecff;border:1px solid #7c5cff77;border-radius:8px;padding:9px;margin:5px 0}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #00f5d4}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}</style>"""

COOKIE_BANNER = """<div id="ck" style="position:fixed;bottom:0;left:0;right:0;background:#0d0d1a;border-top:1px solid #7c5cff;padding:12px;text-align:center;color:#e8ecff;z-index:99">We use essential cookies for login and payments. <a href="/privacy">Privacy</a> <button id="ckok" style="padding:6px 14px">OK</button></div>
<script>try{if(localStorage.ck){document.getElementById('ck').remove()}else{document.getElementById('ckok').onclick=function(){localStorage.ck=1;document.getElementById('ck').remove()}}}catch(e){}</script>"""

HDR = "{'Content-Type':'application/json','X-CSRF-Token':'{{ csrf_token }}'}"


def _page(body, **ctx):
    return render_template_string(BASE_CSS + body + COOKIE_BANNER, **ctx)


def _upgrade_page():
    return _page('<h1>Premium feature</h1><p>This is for Premium members.</p><a class="btn" href="/pricing">See Premium</a>'), 402


@extras_bp.before_app_request
def _log_view():
    if db is None or request.method != "GET":
        return
    if request.path.startswith(("/static", "/premium", "/razorpay", "/health", "/api")):
        return
    try:
        db.session.add(PageView(path=request.path[:200]))
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app = __import__("flask").current_app
        current_app.logger.exception("Page-view analytics failed; continuing request")


@extras_bp.get("/pricing")
def pricing():
    return _page("""<h1>Nexora AI Premium</h1>
<div class="card"><h2>Free</h2><ul><li>AI Mentor: {{ free_ai }} questions/day</li><li>Playground: {{ free_runs }} runs/day</li><li>Resume preview (watermarked)</li><li>Tutorial previews</li></ul></div>
<div class="card"><h2>Premium - Rs {{ price }} / {{ days }} days</h2><ul><li>Unlimited AI Mentor and Playground</li><li>Resume PDF download + saving</li><li>Full tutorials, 3D tours, theme CSS export</li><li>Community + analytics</li></ul>
<button id="pay">Upgrade now</button> <span id="msg" role="status"></span></div>
<p>By paying you agree to our <a href="/terms">Terms</a> and <a href="/refund">Refund policy</a>.</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
const H = """ + HDR + """;
document.getElementById('pay').onclick = async () => {
 try {
  const r = await fetch('/premium/create-order', {method:'POST', headers:H});
  if (r.status === 401 || r.redirected) { document.getElementById('msg').textContent='Please log in first.'; return; }
  const o = await r.json();
  if (!r.ok) { document.getElementById('msg').textContent=o.error || 'Checkout unavailable.'; return; }
  new Razorpay({key:o.key, amount:o.amount, currency:o.currency, order_id:o.order_id, name:o.name, description:o.description,
    handler: async (res) => {
      const v = await fetch('/premium/verify', {method:'POST', headers:H, body:JSON.stringify(res)});
      const j = await v.json().catch(() => ({}));
      document.getElementById('msg').textContent = v.ok ? 'Premium unlocked!' : (j.error || 'Verification failed - contact support.');
    }}).open();
 } catch(e) { document.getElementById('msg').textContent='Checkout unavailable. Please try again.'; }
};
</script>""", free_ai=FREE_DAILY_LIMIT, free_runs=FREE_PLAYGROUND_RUNS, price=PREMIUM_PRICE_INR, days=PREMIUM_DAYS)


@extras_bp.get("/resume/new")
@login_required
def resume_new():
    return _page("""<h1>Neon Resume Studio</h1><div class="card">
<input id="name" placeholder="Full name"><input id="email" placeholder="Email"><input id="phone" placeholder="Phone">
<textarea id="summary" placeholder="Short summary"></textarea><input id="title" placeholder="Job title"><input id="company" placeholder="Company">
<textarea id="details" placeholder="What you did"></textarea><input id="degree" placeholder="Degree"><input id="school" placeholder="School / College">
<input id="skills" placeholder="Skills, comma separated">
<button id="pv">Preview</button> <button id="dl">Download PDF (Premium)</button> <span id="msg" role="status"></span></div>
<iframe id="frame" title="Resume preview" style="width:100%;height:520px;border:1px solid #7c5cff;border-radius:10px;background:#fff"></iframe>
<script>
const H = """ + HDR + """;
const g = i => document.getElementById(i).value;
const data = () => ({name:g('name'),email:g('email'),phone:g('phone'),summary:g('summary'),
experience:[{title:g('title'),company:g('company'),details:g('details')}],
education:[{degree:g('degree'),school:g('school')}],skills:g('skills').split(',').map(s=>s.trim()).filter(Boolean)});
const post = u => fetch(u,{method:'POST',headers:H,body:JSON.stringify(data())});
document.getElementById('pv').onclick=async()=>{const r=await post('/resume/preview');document.getElementById('frame').srcdoc=await r.text();};
document.getElementById('dl').onclick=async()=>{
 const r=await post('/resume/download');
 if(r.status===402){document.getElementById('msg').innerHTML='Premium feature - <a href="/pricing">upgrade</a>';return;}
 const b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='resume'+(b.type.includes('pdf')?'.pdf':'.html');a.click();URL.revokeObjectURL(a.href);
};
</script>""")


@extras_bp.get("/theme")
@login_required
def theme_page():
    return _page("""<h1>Neon Theme Generator</h1><div class="card"><input id="c" value="#00f5d4" aria-label="Hex color"><button id="go">Generate</button><pre id="out" style="white-space:pre-wrap"></pre></div>
<script>
const H = """ + HDR + """;
document.getElementById('go').onclick=async()=>{
 const r=await fetch('/theme/generate',{method:'POST',headers:H,body:JSON.stringify({color:document.getElementById('c').value})});
 document.getElementById('out').textContent=JSON.stringify(await r.json(),null,2);
};
</script>""")


@extras_bp.post("/theme/generate")
@login_required
def theme_generate():
    base = str((request.get_json(silent=True) or {}).get("color", "#00f5d4")).lstrip("#")
    if len(base) != 6 or any(ch not in "0123456789abcdefABCDEF" for ch in base):
        return jsonify(error="Use a hex colour like #00f5d4"), 400
    r, g, b = (int(base[i:i+2], 16) for i in (0, 2, 4))
    palette = {"neon": f"#{base}", "accent": f"#{b:02x}{r:02x}{g:02x}", "bg": "#080b16", "text": "#e8ecff"}
    result = {"palette": palette}
    if is_premium(current_user):
        result["css"] = (f":root{{--neon:{palette['neon']};--accent:{palette['accent']};--bg:{palette['bg']};--text:{palette['text']}}}\n"
                         "h1{color:var(--neon);text-shadow:0 0 10px var(--neon)}\nbutton{background:var(--accent);box-shadow:0 0 14px var(--accent)}")
    else:
        result["note"] = "Upgrade to Premium to export the full CSS."
    return jsonify(result)


TOURS = {"intro": {"title": "Intro tour", "premium": False, "items": 3},
         "gallery": {"title": "Full project gallery", "premium": True, "items": 8}}


@extras_bp.get("/tours/<slug>")
@login_required
def tour(slug):
    tour_data = TOURS.get(slug) or abort(404)
    if tour_data["premium"] and not is_premium(current_user):
        return _upgrade_page()
    return _page("""<h1>{{ t.title }}</h1><div id="v" style="height:440px;border:1px solid #7c5cff;border-radius:12px"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const el=document.getElementById('v'),N={{ t['items'] }};
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(60,el.clientWidth/440,.1,100);cam.position.z=9;
const rd=new THREE.WebGLRenderer({antialias:true});rd.setSize(el.clientWidth,440);el.appendChild(rd.domElement);
const grp=new THREE.Group();sc.add(grp);
for(let i=0;i<N;i++){const m=new THREE.Mesh(new THREE.TorusKnotGeometry(.6,.2,80,12),new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(i/N,1,.55),wireframe:true}));
const a=i/N*Math.PI*2;m.position.set(Math.cos(a)*4,Math.sin(a)*2,0);grp.add(m);}
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
(function loop(){if(!still)grp.rotation.y+=.005;rd.render(sc,cam);requestAnimationFrame(loop);})();
</script>""", t=tour_data)


@extras_bp.get("/community")
@login_required
def community():
    if not is_premium(current_user):
        return _upgrade_page()
    posts = Post.query.order_by(Post.id.desc()).limit(50).all()
    return _page("""<h1>Developer Community</h1><div class="card"><textarea id="b" maxlength="1000" aria-label="Your post"></textarea><button id="post">Post</button></div>
{% for p in posts %}<div class="card">{{ p.body }}<br><small>{{ p.created_at.strftime('%d %b %Y') }}</small></div>{% endfor %}
<script>
const H = """ + HDR + """;
document.getElementById('post').onclick=async()=>{
 const r=await fetch('/community/post',{method:'POST',headers:H,body:JSON.stringify({body:document.getElementById('b').value})});
 if(r.ok)location.reload();else document.getElementById('b').setAttribute('placeholder','Could not post. Check Premium access.');
};
</script>""", posts=posts)


@extras_bp.post("/community/post")
@login_required
def community_post():
    if not is_premium(current_user):
        return jsonify(error="premium_required"), 402
    body = str((request.get_json(silent=True) or {}).get("body", "")).strip()[:1000]
    if body:
        db.session.add(Post(user_id=current_user.id, body=body))
        db.session.commit()
    return jsonify(ok=True)


@extras_bp.get("/analytics")
@login_required
def analytics():
    if not is_premium(current_user):
        return _upgrade_page()
    since = date.today() - timedelta(days=7)
    rows = (db.session.query(PageView.path, db.func.count(PageView.id))
            .filter(PageView.day >= since).group_by(PageView.path)
            .order_by(db.func.count(PageView.id).desc()).limit(20).all())
    return _page("<h1>Page views - last 7 days</h1>{% for p, c in rows %}<div class=\"card\">{{ p }} - <b>{{ c }}</b></div>{% else %}<p>No data yet.</p>{% endfor %}", rows=rows)


_LEGAL = {
    "terms": ("Terms of Service", f"By using Nexora AI you agree to use it lawfully. Premium is a prepaid access plan of {PREMIUM_DAYS} days for Rs {PREMIUM_PRICE_INR}. We may update features and these terms; continued use means acceptance. Contact: [your email]."),
    "privacy": ("Privacy Policy", "We store your name, email, hashed password, usage counts and content you save (resumes, community posts). Payments are handled by Razorpay; we never see your card details. Page-view analytics store only the page path and date, not your IP. To request deletion, contact [your email]."),
    "refund": ("Refund Policy", "[Write your rule here, e.g. refunds within 48 hours if premium features were not used.] Approved refunds go back to the original payment method through Razorpay."),
}


def _legal(page):
    title, body = _LEGAL[page]
    return _page("<h1>{{ t }}</h1><div class=\"card\">{{ b }}</div>", t=title, b=body)


@extras_bp.get("/terms")
def terms():
    return _legal("terms")


@extras_bp.get("/privacy")
def privacy():
    return _legal("privacy")


@extras_bp.get("/refund")
def refund():
    return _legal("refund")
