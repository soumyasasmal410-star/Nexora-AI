/* Nexora AI - premium 3D layer: (1) tilting 3D hero window, (3) 3D Toolkit cards, (4) 3D code-structure viewer.
   Add ONE line before </body> in index.html:
     <script src="{{ url_for('static', filename='nexora3d.js') }}" defer></script>
   It finds things by their visible text (not CSS class names) and quietly does nothing if it can't find them. */
(() => {
  if (window.__n3d) return; window.__n3d = {};
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const TEAL = '0,245,212', VIOLET = '124,92,255';
  const safe = fn => { try { fn(); } catch (e) { /* never break the page */ } };

  /* ---------- find elements by their text ---------- */
  function smallest(rx) {
    const out = [];
    document.querySelectorAll('body *').forEach(el => {
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) return;
      const t = (el.textContent || '').trim();
      if (!t || !rx.test(t)) return;
      if ([...el.children].some(c => rx.test((c.textContent || '').trim()))) return;   // a child matches: go deeper
      out.push(el);
    });
    return out;
  }
  const looksLikeBox = el => { const cs = getComputedStyle(el);
    return parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || /rgba?\(\s*\d+,\s*\d+,\s*\d+(,\s*(0?\.\d*[1-9]|1))?\s*\)/.test(cs.backgroundColor) && cs.backgroundColor !== 'rgba(0, 0, 0, 0)'; };

  /* ---------- shared: spotlight glare + tilt on a box ---------- */
  function makeTilt(el, max) {
    if (!hover || still) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    if (cs.animationName !== 'none') return;                  // don't fight an existing CSS animation
    const base = cs.transform === 'none' ? '' : cs.transform;
    const glare = document.createElement('div');
    glare.setAttribute('aria-hidden', 'true');
    glare.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .25s;z-index:2;' +
      'background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%),rgba(' + TEAL + ',.16),transparent 62%)';
    el.appendChild(glare);
    const prevShadow = el.style.boxShadow, prevTrans = el.style.transition;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transition = 'transform .12s ease-out, box-shadow .25s';
      el.style.transform = base + ' perspective(1000px) rotateX(' + ((.5 - y) * max).toFixed(2) + 'deg) rotateY(' + ((x - .5) * max).toFixed(2) + 'deg) translateZ(0)';
      el.style.boxShadow = '0 0 0 1px rgba(' + TEAL + ',.35),0 22px 55px rgba(' + VIOLET + ',.28)';
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      glare.style.opacity = 1;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = base; el.style.boxShadow = prevShadow; glare.style.opacity = 0;
      setTimeout(() => { el.style.transition = prevTrans; }, 250);
    });
  }

  /* ---------- (1) hero: tilting glass code window + floating chips ---------- */
  safe(() => {
    const leaf = smallest(/main\.py/)[0]; if (!leaf) return;
    let card = leaf;
    while (card.parentElement && card.parentElement !== document.body) {
      const r = card.getBoundingClientRect();
      if (r.width >= 240 && r.height >= 110 && looksLikeBox(card)) break;
      card = card.parentElement;
    }
    if (card.getBoundingClientRect().width > 760) return;      // went too far up: skip rather than break the hero
    makeTilt(card, 9);
    const chips = smallest(/Ready to learn|AI-powered|Learn by doing/).map(el => {
      let c = el; while (c.parentElement && c.parentElement !== card.parentElement && !looksLikeBox(c)) c = c.parentElement; return c; });
    const uniq = [...new Set(chips)].filter(c => c !== card && !c.contains(card));
    if (still || !hover || !uniq.length) return;
    const m = {x: 0, y: 0}, e = {x: 0, y: 0};
    addEventListener('pointermove', ev => { m.x = ev.clientX / innerWidth * 2 - 1; m.y = ev.clientY / innerHeight * 2 - 1; }, {passive: true});
    let vis = true; new IntersectionObserver(en => { vis = en[0].isIntersecting; }).observe(card);
    (function loop(t) {
      requestAnimationFrame(loop); if (!vis || document.hidden) return;
      e.x += (m.x - e.x) * .06; e.y += (m.y - e.y) * .06;
      uniq.forEach((c, i) => { const d = 10 + i * 6;                           // each chip sits at its own "depth"
        c.style.translate = (-e.x * d).toFixed(1) + 'px ' + (-e.y * d + Math.sin(t / 900 + i * 2) * 5).toFixed(1) + 'px'; });
    })(0);
  });

  /* ---------- (3) toolkit cards: tilt + spinning 3D wire object ---------- */
  const PHI = (1 + Math.sqrt(5)) / 2;
  const cube = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const SHAPES = [
    {v: cube, e: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]},
    {v: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(p => p.map(n => n * 1.3)), e: (() => { const o = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], r = [];
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (o[i].some((n, k) => n + o[j][k] !== 0)) r.push([i, j]); return r; })()},
    {v: [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]], e: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]},
    (() => { const v = []; [-1, 1].forEach(a => [-PHI, PHI].forEach(b => { v.push([0, a, b], [a, b, 0], [b, 0, a]); }));
      const e = []; v.forEach((p, i) => v.forEach((q, j) => { if (j > i && Math.abs((p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2 - 4) < .05) e.push([i, j]); }));
      return {v: v.map(p => p.map(n => n * .8)), e}; })(),
  ];
  const objs = [];
  safe(() => {
    const titles = smallest(/^(AI Code Mentor|Resume Studio|Code Playground|Study\s*&\s*Create)$/);
    if (titles.length < 2) return;
    titles.forEach((h, idx) => {
      let card = h; const others = titles.filter(t => t !== h);
      while (card.parentElement && !others.some(o => card.parentElement.contains(o))) card = card.parentElement;
      if (card === document.body || card.getBoundingClientRect().width > 700) return;
      makeTilt(card, 8);
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:absolute;top:14px;right:14px;width:56px;height:56px;pointer-events:none;z-index:3;filter:drop-shadow(0 0 8px rgba(' + TEAL + ',.5))';
      card.appendChild(cv);
      const o = {cv, ctx: cv.getContext('2d'), s: SHAPES[idx % SHAPES.length], a: idx * 1.3, vis: true};
      new IntersectionObserver(en => { o.vis = en[0].isIntersecting; }).observe(card);
      objs.push(o); drawObj(o, 0);
    });
    if (objs.length && !still) (function loop() { requestAnimationFrame(loop); if (document.hidden) return; objs.forEach(o => o.vis && drawObj(o, 1)); })();
  });
  function drawObj(o, step) {
    const c = o.ctx, S = 112, R = 34; o.a += step * .012; c.clearRect(0, 0, S, S);
    const ay = o.a, ax = o.a * .6 + .5, sy = Math.sin(ay), cy = Math.cos(ay), sx = Math.sin(ax), cx = Math.cos(ax);
    const P = o.s.v.map(([x, y, z]) => { let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y * cx - Z * sx; Z = y * sx + Z * cx; return [S / 2 + X * R * .62, S / 2 + Y * R * .62, Z]; });
    c.lineWidth = 1.6; c.lineJoin = 'round';
    o.s.e.forEach(([i, j]) => { const z = (P[i][2] + P[j][2]) / 2; c.strokeStyle = 'rgba(' + (z > 0 ? TEAL + ',.95' : VIOLET + ',.55') + ')';
      c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[j][0], P[j][1]); c.stroke(); });
  }

  /* ---------- (4) 3D code-structure viewer ---------- */
  const COLORS = {module: '#8892c9', def: '#00f5d4', class: '#00f5d4', loop: '#4fc3ff', if: '#7c5cff', try: '#ffb454', with: '#ffb454',
    import: '#ffb454', return: '#a6e22e', assign: '#e8ecff', call: '#ff4fd8', flow: '#ff6b8b'};
  const LEGEND = [['def / class', '#00f5d4'], ['loop', '#4fc3ff'], ['if', '#7c5cff'], ['call', '#ff4fd8'], ['assign', '#e8ecff'], ['import', '#ffb454'], ['return', '#a6e22e']];

  /* cone-tree layout: depth goes down, children share their parent's angle slice */
  function layout(nodes) {
    const kids = {}; nodes.forEach(n => { (kids[n.p] = kids[n.p] || []).push(n); });
    const size = n => (n.w = 1 + (kids[n.id] || []).reduce((s, k) => s + size(k), 0));
    const root = (kids[-1] || [])[0]; if (!root) return;
    size(root);
    (function place(n, a0, a1, d) {
      const a = (a0 + a1) / 2, r = d * 62; n.x = Math.cos(a) * r; n.z = Math.sin(a) * r; n.y = d * 58; n.d = d;
      let cur = a0; (kids[n.id] || []).forEach(k => { const span = (a1 - a0) * k.w / (n.w - 1); place(k, cur, cur + span, d + 1); cur += span; });
    })(root, 0, Math.PI * 2, 0);
    const ys = nodes.map(n => n.y), mid = (Math.min(...ys) + Math.max(...ys)) / 2; nodes.forEach(n => { n.y -= mid; });
  }
  window.__n3d.layout = layout;

  let modal = null, lastBtn = null;
  function openViewer(code, trigger) {
    lastBtn = trigger; closeViewer();
    modal = document.createElement('div'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', '3D code structure');
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(4,6,14,.94);display:flex;flex-direction:column;font-family:ui-monospace,Consolas,monospace;color:#e8ecff';
    modal.innerHTML = '<div style="display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(' + VIOLET + ',.4)">' +
      '<b style="color:rgb(' + TEAL + ')">3D code structure</b><span id="n3d-info" style="color:#9aa3c7;font-size:12px;flex:1"></span>' +
      '<button id="n3d-zi" aria-label="Zoom in" style="' + BTN + '">+</button><button id="n3d-zo" aria-label="Zoom out" style="' + BTN + '">&minus;</button>' +
      '<button id="n3d-x" aria-label="Close" style="' + BTN + '">Close</button></div>' +
      '<div style="position:relative;flex:1;min-height:0"><canvas id="n3d-cv" style="width:100%;height:100%;display:block;touch-action:none;cursor:grab"></canvas>' +
      '<div id="n3d-tip" style="position:absolute;display:none;pointer-events:none;background:#0d1124;border:1px solid rgba(' + TEAL + ',.6);padding:5px 9px;border-radius:8px;font-size:12px"></div>' +
      '<div id="n3d-msg" style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#c9d1ff">Loading...</div>' +
      '<div id="n3d-leg" style="position:absolute;left:14px;bottom:12px;display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#9aa3c7;max-width:90%"></div></div>';
    document.body.appendChild(modal);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const close = () => { closeViewer(); document.body.style.overflow = prevOverflow; if (lastBtn) lastBtn.focus(); };
    modal._close = close;
    modal.querySelector('#n3d-x').onclick = close; modal.querySelector('#n3d-x').focus();
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    const msg = modal.querySelector('#n3d-msg');
    fetch('/api/ast', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code})})
      .then(r => r.json().then(j => ({ok: r.ok && j.ok, j})))
      .then(({ok, j}) => {
        if (!modal) return;
        if (!ok) { msg.textContent = j.error || 'Could not draw this code.'; return; }
        msg.style.display = 'none'; startScene(j.nodes, j.truncated);
      }).catch(() => { if (modal) msg.textContent = 'Could not reach the server. Check your connection and try again.'; });
  }
  const BTN = 'background:transparent;color:#e8ecff;border:1px solid rgba(' + VIOLET + ',.7);border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit';
  function closeViewer() { if (modal) { modal._stop && modal._stop(); modal.remove(); modal = null; } }

  function startScene(nodes, truncated) {
    layout(nodes);
    const cv = modal.querySelector('#n3d-cv'), ctx = cv.getContext('2d'), tip = modal.querySelector('#n3d-tip');
    modal.querySelector('#n3d-info').textContent = nodes.length + ' parts' + (truncated ? ' (showing the first ' + nodes.length + ')' : '') + ' - drag to rotate, scroll or +/- to zoom';
    modal.querySelector('#n3d-leg').innerHTML = LEGEND.map(([n, c]) => '<span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c + ';margin-right:5px"></i>' + n + '</span>').join('');
    let W = 0, H = 0, yaw = .6, pitch = .35, zoom = 1, auto = !still, drag = null, hoverN = null, raf = 0, dpr = Math.min(devicePixelRatio || 1, 2);
    const fit = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(cv);
    const extent = Math.max(...nodes.map(n => Math.hypot(n.x, n.z, n.y))) || 1;
    let proj = [];
    function frame() {
      raf = requestAnimationFrame(frame); if (auto && !drag) yaw += .004;
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) * .42 / extent * zoom, F = 700, sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
      proj = nodes.map(n => { let X = n.x * cy + n.z * sy, Z = -n.x * sy + n.z * cy, Y = n.y * cp - Z * sp; Z = n.y * sp + Z * cp;
        const k = F / (F + Z * scale * .6); return {n, x: W / 2 + X * scale * k, y: H / 2 + Y * scale * k, z: Z, k}; });
      const byId = {}; proj.forEach(p => { byId[p.n.id] = p; });
      ctx.lineWidth = 1;
      proj.forEach(p => { const q = byId[p.n.p]; if (!q) return; ctx.strokeStyle = 'rgba(' + VIOLET + ',' + Math.max(.18, Math.min(.7, .55 - p.z / extent * .3)).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke(); });
      [...proj].sort((a, b) => b.z - a.z).forEach(p => {                           // far to near
        const r = (p.n.t === 'module' ? 7 : 5) * Math.max(.6, p.k) * (p === hoverN ? 1.5 : 1), col = COLORS[p.n.t] || '#8892c9';
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = p === hoverN ? 18 : 8; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        if (nodes.length <= 40 || p === hoverN) { ctx.fillStyle = 'rgba(232,236,255,' + (p === hoverN ? 1 : .8) + ')'; ctx.font = '11px ui-monospace,Consolas,monospace'; ctx.fillText(p.n.l, p.x + r + 4, p.y + 4); }
      });
    }
    frame(); modal._stop = () => { cancelAnimationFrame(raf); ro.disconnect(); };
    cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY}; auto = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) { yaw += (e.clientX - drag.x) * .01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - drag.y) * .01)); drag = {x: e.clientX, y: e.clientY}; return; }
      hoverN = null; let best = 14;
      proj.forEach(p => { const d = Math.hypot(p.x - mx, p.y - my); if (d < best) { best = d; hoverN = p; } });
      if (hoverN) { tip.style.display = 'block'; tip.style.left = Math.min(mx + 14, W - 180) + 'px'; tip.style.top = (my + 14) + 'px'; tip.textContent = hoverN.n.l + (hoverN.n.line ? '  - line ' + hoverN.n.line : ''); }
      else tip.style.display = 'none';
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(.4, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : .9))); }, {passive: false});
    modal.querySelector('#n3d-zi').onclick = () => { zoom = Math.min(3, zoom * 1.2); };
    modal.querySelector('#n3d-zo').onclick = () => { zoom = Math.max(.4, zoom / 1.2); };
  }

  safe(() => {
    const analyze = smallest(/^Analy[sz]e code/i)[0]; if (!analyze) return;
    const btn = analyze.closest('button') || analyze;
    const scope = btn.closest('form') || btn.closest('section') || document;
    const areas = [...scope.querySelectorAll('textarea')].sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height);
    const b3 = document.createElement('button'); b3.type = 'button'; b3.className = btn.className; b3.textContent = 'View 3D structure';
    b3.style.cssText = 'margin-left:8px;background:transparent;color:rgb(' + TEAL + ');border:1px solid rgba(' + TEAL + ',.65);box-shadow:0 0 14px rgba(' + TEAL + ',.25)';
    b3.addEventListener('click', () => {
      const ta = areas[0] || document.querySelector('textarea');
      const code = ta ? ta.value : '';
      if (!code.trim()) { openViewer('', b3); return; }
      openViewer(code, b3);
    });
    btn.insertAdjacentElement('afterend', b3);
  });
})();