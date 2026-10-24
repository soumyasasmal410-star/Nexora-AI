/* Nexora AI - moving 3D background: drifting neural network + floating wire shapes + scroll depth + cursor links.
   One line before </body> (any page):
     <script src="{{ url_for('static', filename='nexora-bg.js') }}" defer></script>
   Tune the numbers in CONFIG. Own canvas maths, no libraries. */
(() => {
  if (window.__nbg) return; window.__nbg = 1;
  const CONFIG = {
    particles: 70,        // network nodes (phones use about half)
    shapes: 9,            // floating wireframe objects
    link: 230,            // how close nodes connect (3D distance)
    speed: 1,             // 0.5 = calmer, 2 = faster
    grid: false,          // set true for a moving perspective grid floor
    seeThrough: true,     // make full-width opaque sections slightly see-through so the background shows
    teal: '0,245,212', violet: '124,92,255'
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;
  const dpr = 1;                                    // 1x keeps it smooth on every device
  const html = document.documentElement, body = document.body;

  /* ---- canvas behind everything ---- */
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  body.insertBefore(cv, body.firstChild);
  const ctx = cv.getContext('2d'); if (!ctx) return;

  /* ---- make sure the page lets the canvas show through ---- */
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  try {
    const hb = parse(getComputedStyle(html).backgroundColor), bb = parse(getComputedStyle(body).backgroundColor);
    if (hb && hb.a > 0 && bb && bb.a > 0) body.style.backgroundColor = 'transparent';      // html keeps the colour, body no longer hides the canvas
    if (CONFIG.seeThrough) {
      const kids = [...body.children, ...[...body.querySelectorAll(':scope > main > *')]];
      kids.forEach(el => {
        if (!/^(SECTION|MAIN|ARTICLE|DIV)$/.test(el.tagName) || el === cv) return;
        const cs = getComputedStyle(el), c = parse(cs.backgroundColor);
        if (c && c.a === 1 && cs.backgroundImage === 'none' && el.getBoundingClientRect().width >= innerWidth * .9)
          el.style.backgroundColor = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',.6)';
      });
    }
  } catch (e) { /* ignore */ }

  /* ---- shapes ---- */
  const PHI = (1 + Math.sqrt(5)) / 2;
  const SH = [
    {v: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
     e: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]},
    (() => { const v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(p => p.map(n => n * 1.3)), e = [];
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (v[i].some((n, k) => n + v[j][k] !== 0)) e.push([i, j]); return {v, e}; })(),
    (() => { const v = []; [-1, 1].forEach(a => [-PHI, PHI].forEach(b => v.push([0, a, b], [a, b, 0], [b, 0, a])));
      const e = []; v.forEach((p, i) => v.forEach((q, j) => { if (j > i && Math.abs((p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2 - 4) < .05) e.push([i, j]); }));
      return {v: v.map(p => p.map(n => n * .8)), e}; })(),
    {v: [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]], e: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]},
  ];

  /* ---- world ---- */
  const R = (a, b) => a + Math.random() * (b - a);
  const BX = 1100, BY = 700, BZ = 1000, F = 620;
  const N = small ? Math.round(CONFIG.particles * .5) : CONFIG.particles;
  const nodes = Array.from({length: N}, (_, i) => ({x: R(-BX, BX), y: R(-BY, BY), z: R(0, BZ), vx: R(-.25, .25), vy: R(-.2, .2), vz: R(-.15, .15), c: i % 3 ? CONFIG.teal : CONFIG.violet}));
  const shapes = Array.from({length: small ? Math.ceil(CONFIG.shapes / 2) : CONFIG.shapes}, (_, i) => ({
    s: SH[i % SH.length], x: R(-BX, BX), y: R(-BY, BY), z: R(150, BZ - 100), size: R(45, 120),
    ax: R(0, 6), ay: R(0, 6), rx: R(.002, .006), ry: R(.003, .008), vy: -R(.1, .35), c: i % 2 ? CONFIG.teal : CONFIG.violet}));

  let W = 0, H = 0;
  const fit = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
  fit(); addEventListener('resize', fit);
  const mouse = {x: 0, y: 0, px: -999, py: -999}, ease = {x: 0, y: 0}; let sc = scrollY, scEase = scrollY;
  addEventListener('pointermove', e => { mouse.x = e.clientX / W * 2 - 1; mouse.y = e.clientY / H * 2 - 1; mouse.px = e.clientX; mouse.py = e.clientY; }, {passive: true});
  document.addEventListener('mouseleave', () => { mouse.px = mouse.py = -999; });
  addEventListener('scroll', () => { sc = scrollY; }, {passive: true});

  /* projection: nearer things shift more with the mouse and scroll = real depth parallax */
  function proj(x, y, z, camX, camY, scr) {
    const depth = 1 - z / BZ;                                   // 1 near .. 0 far
    const k = F / (F + z), px = x - camX * (30 + depth * 90), py = y - camY * (20 + depth * 60) - scr * (.05 + depth * .35);
    return [W / 2 + px * k, H / 2 + py * k, k, depth];
  }

  function frame(dt) {
    ease.x += (mouse.x - ease.x) * .05; ease.y += (mouse.y - ease.y) * .05; scEase += (sc - scEase) * .08;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const sp = CONFIG.speed * dt * .06;
    if (CONFIG.grid) drawGrid(performance.now());
    const P = nodes.map(n => {
      if (!still) { n.x += n.vx * sp; n.y += n.vy * sp; n.z += n.vz * sp;
        if (n.x > BX) n.x = -BX; if (n.x < -BX) n.x = BX; if (n.y > BY) n.y = -BY; if (n.y < -BY) n.y = BY; if (n.z > BZ) n.z = 0; if (n.z < 0) n.z = BZ; }
      return proj(n.x, n.y, n.z, ease.x, ease.y, scEase);
    });
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {                              // network links (3D distance)
      const a = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d = dx * dx + dy * dy + dz * dz;
        if (d < CONFIG.link * CONFIG.link) {
          const al = (1 - Math.sqrt(d) / CONFIG.link) * .38 * Math.min(P[i][3], P[j][3]) + .02;
          ctx.strokeStyle = 'rgba(' + a.c + ',' + al.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
        }
      }
      const dm = Math.hypot(P[i][0] - mouse.px, P[i][1] - mouse.py);           // cursor links
      if (dm < 170) { ctx.strokeStyle = 'rgba(' + CONFIG.teal + ',' + ((1 - dm / 170) * .6).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(mouse.px, mouse.py); ctx.stroke(); }
    }
    nodes.forEach((n, i) => {
      const p = P[i], r = 1.2 + p[3] * 2.4; ctx.fillStyle = 'rgba(' + n.c + ',' + (.25 + p[3] * .6).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.283); ctx.fill();
    });
    shapes.forEach(s => {                                       // floating wire objects, drifting up
      if (!still) { s.ax += s.rx * dt * .06; s.ay += s.ry * dt * .06; s.y += s.vy * sp; if (s.y < -BY - 150) { s.y = BY + 150; s.x = R(-BX, BX); } }
      const c = proj(s.x, s.y, s.z, ease.x, ease.y, scEase), sx = Math.sin(s.ax), cx = Math.cos(s.ax), sy = Math.sin(s.ay), cy = Math.cos(s.ay);
      const V = s.s.v.map(([x, y, z]) => { let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y * cx - Z * sx; Z = y * sx + Z * cx; return [c[0] + X * s.size * c[2], c[1] + Y * s.size * c[2], Z]; });
      ctx.lineWidth = 1.2;
      s.s.e.forEach(([i, j]) => { const front = (V[i][2] + V[j][2]) > 0; ctx.strokeStyle = 'rgba(' + s.c + ',' + ((front ? .42 : .16) * (.35 + c[3] * .65)).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(V[i][0], V[i][1]); ctx.lineTo(V[j][0], V[j][1]); ctx.stroke(); });
    });
  }

  function drawGrid(t) {                                        // optional: moving perspective floor
    const hy = H * .62, off = (t * .00035 * CONFIG.speed) % 1;
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const f = ((i + off) / 14), y = hy + (H - hy) * f * f;
      ctx.strokeStyle = 'rgba(' + CONFIG.violet + ',' + (.05 + f * .16).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -10; i <= 10; i++) { ctx.strokeStyle = 'rgba(' + CONFIG.teal + ',.09)'; ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hy); ctx.lineTo(W / 2 + i * W * .16, H); ctx.stroke(); }
  }

  let last = performance.now(), run = true;
  function loop(now) {
    if (!run) return; const dt = Math.min(now - last, 50); last = now; frame(dt);
    if (!still) requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { run = !document.hidden; if (run && !still) { last = performance.now(); requestAnimationFrame(loop); } });
  addEventListener('resize', () => { if (still) frame(0); });
  requestAnimationFrame(loop);
})();