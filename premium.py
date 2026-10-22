"""Premium features for Nexora AI: Razorpay, Resume Studio, browser Python Playground and tutorials."""
import hashlib
import hmac
import json
import os
from datetime import date, datetime, timedelta
from functools import wraps

import razorpay
from flask import Blueprint, Response, abort, current_app, jsonify, render_template_string, request
from flask_login import current_user, login_required

premium_bp = Blueprint("premium", __name__)

FREE_DAILY_LIMIT = 10
FREE_PLAYGROUND_RUNS = 10
PREMIUM_PRICE_INR = 199
PREMIUM_DAYS = 30

db = None
Plan = Usage = Payment = Resume = FeatureUse = Lesson = None


def _client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RuntimeError("Razorpay is not configured.")
    return razorpay.Client(auth=(key_id, key_secret))


def init_premium(app, _db, User):
    """Register premium models. app.py's first-request hook creates the tables."""
    global db, Plan, Usage, Payment, Resume, FeatureUse, Lesson
    db = _db

    class PremiumPlan(db.Model):
        __tablename__ = "premium_plan"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
        expires_at = db.Column(db.DateTime)

    class UsageModel(db.Model):
        __tablename__ = "mentor_daily_usage"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True, nullable=False)
        day = db.Column(db.Date, default=date.today, index=True, nullable=False)
        count = db.Column(db.Integer, default=0, nullable=False)
        __table_args__ = (db.UniqueConstraint("user_id", "day", name="uq_mentor_usage_user_day"),)

    class PaymentModel(db.Model):
        __tablename__ = "premium_payment"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
        order_id = db.Column(db.String(100), unique=True, nullable=False)
        payment_id = db.Column(db.String(100), unique=True)
        status = db.Column(db.String(20), default="created", nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)

    class ResumeModel(db.Model):
        __tablename__ = "resume_model"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.id"), index=True, nullable=False)
        data = db.Column(db.Text, nullable=False)

    class FeatureUseModel(db.Model):
        __tablename__ = "feature_use_model"
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, index=True, nullable=False)
        feature = db.Column(db.String(30), index=True, nullable=False)
        day = db.Column(db.Date, default=date.today, nullable=False)
        count = db.Column(db.Integer, default=0, nullable=False)
        __table_args__ = (db.UniqueConstraint("user_id", "feature", "day", name="uq_feature_use_user_feature_day"),)

    class LessonModel(db.Model):
        __tablename__ = "lesson_model"
        id = db.Column(db.Integer, primary_key=True)
        slug = db.Column(db.String(80), unique=True, nullable=False)
        title = db.Column(db.String(200), nullable=False)
        body_md = db.Column(db.Text, nullable=False)
        is_premium = db.Column(db.Boolean, default=True, nullable=False)

    Plan, Usage, Payment = PremiumPlan, UsageModel, PaymentModel
    Resume, FeatureUse, Lesson = ResumeModel, FeatureUseModel, LessonModel


def is_premium(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    plan = Plan.query.filter_by(user_id=user.id).first()
    return bool(plan and plan.expires_at and plan.expires_at > datetime.utcnow())


def premium_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if not is_premium(current_user):
            return jsonify(error="premium_required",
                           message="This is a Premium feature. Upgrade to unlock."), 402
        return fn(*args, **kwargs)
    return wrapper


def check_and_count_usage(user):
    """Reserve one of the user's 10 free AI Mentor requests for today."""
    if is_premium(user):
        return True, ""
    try:
        today = date.today()
        row = Usage.query.filter_by(user_id=user.id, day=today).with_for_update().first()
        if row is None:
            row = Usage(user_id=user.id, day=today, count=0)
            db.session.add(row)
            db.session.flush()
        if row.count >= FREE_DAILY_LIMIT:
            db.session.rollback()
            return False, f"Free limit ({FREE_DAILY_LIMIT}/day) reached. Upgrade for unlimited."
        row.count += 1
        db.session.commit()
        return True, ""
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not record AI Mentor usage")
        return False, "Usage tracking is temporarily unavailable. Please try again shortly."


def _count(feature, limit):
    if is_premium(current_user):
        return True
    try:
        today = date.today()
        row = FeatureUse.query.filter_by(
            user_id=current_user.id, feature=feature, day=today
        ).with_for_update().first()
        if row is None:
            row = FeatureUse(user_id=current_user.id, feature=feature, day=today, count=0)
            db.session.add(row)
            db.session.flush()
        if row.count >= limit:
            db.session.rollback()
            return False
        row.count += 1
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not record feature usage")
        return False


def _activate(user_id):
    plan = Plan.query.filter_by(user_id=user_id).first()
    now = datetime.utcnow()
    start = max(now, plan.expires_at) if plan and plan.expires_at else now
    if plan is None:
        plan = Plan(user_id=user_id, expires_at=start + timedelta(days=PREMIUM_DAYS))
        db.session.add(plan)
    else:
        plan.expires_at = start + timedelta(days=PREMIUM_DAYS)


@premium_bp.get("/premium/status")
@login_required
def status():
    row = Usage.query.filter_by(user_id=current_user.id, day=date.today()).first()
    return jsonify(premium=is_premium(current_user), used_today=row.count if row else 0,
                   daily_limit=FREE_DAILY_LIMIT, price_inr=PREMIUM_PRICE_INR,
                   premium_days=PREMIUM_DAYS)


@premium_bp.post("/premium/create-order")
@login_required
def create_order():
    try:
        order = _client().order.create({
            "amount": PREMIUM_PRICE_INR * 100,
            "currency": "INR",
            "receipt": f"nexora-u{current_user.id}-{int(datetime.utcnow().timestamp())}",
            "notes": {"user_id": str(current_user.id), "plan": "premium-30d"},
        })
    except Exception:
        current_app.logger.exception("Razorpay order creation failed")
        return jsonify(error="Checkout is temporarily unavailable. Check payment configuration and try again."), 503

    try:
        db.session.add(Payment(user_id=current_user.id, order_id=order["id"], status="created"))
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not store Razorpay order")
        return jsonify(error="Could not start checkout. Please try again."), 500
    return jsonify(order_id=order["id"], amount=order["amount"], currency="INR",
                   key=os.environ["RAZORPAY_KEY_ID"], name="Nexora AI",
                   description="Premium · 30 days")


@premium_bp.post("/premium/verify")
@login_required
def verify():
    data = request.get_json(silent=True) or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")
    if not all(isinstance(value, str) and value for value in (order_id, payment_id, signature)):
        return jsonify(ok=False, error="Missing payment verification details."), 400

    payment = Payment.query.filter_by(order_id=order_id, user_id=current_user.id).first()
    if not payment:
        return jsonify(ok=False, error="Payment order was not found for this account."), 404
    if payment.status == "paid" and payment.payment_id == payment_id:
        return jsonify(ok=True, premium=True)

    try:
        client = _client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        details = client.payment.fetch(payment_id)
        if details.get("order_id") != order_id or details.get("status") != "captured":
            return jsonify(ok=False, error="Payment is not captured yet. Please wait and try again."), 409
    except razorpay.errors.SignatureVerificationError:
        return jsonify(ok=False, error="Payment signature verification failed."), 400
    except Exception:
        current_app.logger.exception("Razorpay payment verification failed")
        return jsonify(ok=False, error="Could not verify payment right now. Please try again."), 503

    try:
        payment.status = "paid"
        payment.payment_id = payment_id
        _activate(current_user.id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not activate Premium after payment")
        return jsonify(ok=False, error="Payment was verified but activation failed. Contact support with your payment ID."), 500
    return jsonify(ok=True, premium=True)


@premium_bp.post("/razorpay/webhook")
def webhook():
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.get_data()
    if not secret:
        return jsonify(error="Webhook is not configured."), 503
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        abort(400)

    event = request.get_json(silent=True) or {}
    if event.get("event") == "payment.captured":
        entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        order_id, payment_id = entity.get("order_id"), entity.get("id")
        if order_id and payment_id:
            payment = Payment.query.filter_by(order_id=order_id).first()
            if payment and payment.status != "paid":
                try:
                    details = _client().payment.fetch(payment_id)
                    if details.get("order_id") == order_id and details.get("status") == "captured":
                        payment.status, payment.payment_id = "paid", payment_id
                        _activate(payment.user_id)
                        db.session.commit()
                except Exception:
                    db.session.rollback()
                    current_app.logger.exception("Razorpay webhook processing failed")
                    return jsonify(error="Webhook processing failed; it may be retried."), 500
    return "", 200


RESUME_HTML = """<!doctype html><meta charset="utf-8"><style>
body{background:#080b16;color:#e8ecff;font-family:Inter,Arial,sans-serif;padding:36px;position:relative}
h1{color:#00f5d4;text-shadow:0 0 8px #00f5d455;margin:0}
h2{color:#7c5cff;border-bottom:1px solid #7c5cff55}
.wm{position:fixed;top:40%;left:10%;font-size:64px;opacity:.12;transform:rotate(-25deg);color:#fff}
</style>{% if watermark %}<div class="wm">NEXORA AI - FREE PREVIEW</div>{% endif %}
<h1>{{ d.name }}</h1><p>{{ d.email }} {{ d.phone }}</p>
<h2>Summary</h2><p>{{ d.summary }}</p>
<h2>Experience</h2>{% for e in d.experience %}<p><b>{{ e.title }}</b> - {{ e.company }}<br>{{ e.details }}</p>{% endfor %}
<h2>Education</h2>{% for e in d.education %}<p>{{ e.degree }} - {{ e.school }}</p>{% endfor %}
<h2>Skills</h2><p>{{ d.skills|join(', ') }}</p>"""


def _clean(data):
    """Accept only expected resume fields and cap input sizes."""
    data = data if isinstance(data, dict) else {}
    def entries(key, fields, limit):
        raw = data.get(key, [])
        if not isinstance(raw, list):
            return []
        result = []
        for item in raw[:limit]:
            if isinstance(item, dict):
                result.append({field: str(item.get(field, ""))[:300] for field in fields})
        return result
    skills = data.get("skills", [])
    if not isinstance(skills, list):
        skills = []
    return {
        "name": str(data.get("name", ""))[:80],
        "email": str(data.get("email", ""))[:80],
        "phone": str(data.get("phone", ""))[:30],
        "summary": str(data.get("summary", ""))[:600],
        "experience": entries("experience", ("title", "company", "details"), 8),
        "education": entries("education", ("degree", "school"), 5),
        "skills": [str(item)[:30] for item in skills[:25]],
    }


@premium_bp.post("/resume/preview")
@login_required
def resume_preview():
    data = _clean(request.get_json(silent=True) or {})
    html = render_template_string(RESUME_HTML, d=data, watermark=not is_premium(current_user))
    return Response(html, mimetype="text/html")


@premium_bp.post("/resume/save")
@premium_required
def resume_save():
    db.session.add(Resume(user_id=current_user.id, data=json.dumps(_clean(request.get_json(silent=True) or {}))))
    db.session.commit()
    return jsonify(ok=True)


@premium_bp.post("/resume/download")
@premium_required
def resume_download():
    data = _clean(request.get_json(silent=True) or {})
    html = render_template_string(RESUME_HTML, d=data, watermark=False)
    try:
        from weasyprint import HTML
        pdf = HTML(string=html).write_pdf()
        return Response(pdf, mimetype="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=resume.pdf"})
    except Exception:
        current_app.logger.exception("PDF renderer unavailable; returning printable HTML")
        return Response(html, mimetype="text/html")


PLAYGROUND_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>Nexora Python Playground</title>
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"></script>
<style>body{background:#080b16;color:#e8ecff;font-family:monospace;padding:24px}
textarea{box-sizing:border-box;width:100%;height:220px;background:#0d0d1a;color:#00f5d4;border:1px solid #7c5cff;border-radius:8px;padding:10px}
button{background:#7c5cff;color:#fff;border:0;padding:10px 18px;border-radius:8px;cursor:pointer}
pre{white-space:pre-wrap;background:#0d0d1a;padding:12px;border-radius:8px;min-height:60px}</style></head><body>
<h2>Python Playground</h2><textarea id="code">print("Hello Nexora")</textarea><br><br>
<button id="runButton">Run</button> <span id="info"></span><pre id="out">Loading Python...</pre>
<script>
const codeEl=document.getElementById('code'), out=document.getElementById('out');
const runButton=document.getElementById('runButton');
let py=null;
loadPyodide().then(p=>{py=p;out.textContent='Ready.'}).catch(e=>{out.textContent='Could not load Python: '+e});
runButton.onclick=async()=>{
 if(!py){out.textContent='Python is still loading.';return;}
 const response=await fetch('/playground/track',{method:'POST',headers:{'Content-Type':'application/json'}});
 const result=await response.json().catch(()=>({message:'Request failed.'}));
 if(!response.ok){out.textContent=result.message||'Daily limit reached.';return;}
 try{
  await py.runPythonAsync("import sys,io; sys.stdout=io.StringIO()");
  await py.runPythonAsync(codeEl.value);
  out.textContent=py.runPython("sys.stdout.getvalue()")||'(no output)';
 }catch(e){out.textContent=String(e);}
};
</script></body></html>"""


@premium_bp.get("/playground")
@login_required
def playground():
    return render_template_string(PLAYGROUND_HTML)


@premium_bp.post("/playground/track")
@login_required
def playground_track():
    if not _count("playground", FREE_PLAYGROUND_RUNS):
        return jsonify(error="limit", message=f"Free limit ({FREE_PLAYGROUND_RUNS} runs/day) reached. Upgrade for unlimited runs."), 402
    return jsonify(ok=True)


@premium_bp.post("/playground/save")
@premium_required
def playground_save():
    # Saved-snippet persistence can be added as a separate feature.
    return jsonify(ok=True)


@premium_bp.get("/learn/<slug>")
@login_required
def lesson(slug):
    import markdown
    lesson_row = Lesson.query.filter_by(slug=slug).first_or_404()
    body = lesson_row.body_md
    if lesson_row.is_premium and not is_premium(current_user):
        body = body[:400] + "\n\n---\n**Unlock the full lesson with Premium.**"
    return render_template_string(
        "<body style='background:#080b16;color:#e8ecff;font-family:Inter,sans-serif;padding:30px'>"
        "<h1>{{ title }}</h1>{{ body|safe }}</body>",
        title=lesson_row.title, body=markdown.markdown(body),
    )
