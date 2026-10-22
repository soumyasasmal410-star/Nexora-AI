/* Nexora AI cursor glow + trail. Decorative only; native cursor stays visible. */
(() => {
  if (window.__nexoraCursorFX) return;
  window.__nexoraCursorFX = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches ||
      matchMedia('(pointer: coarse)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'nexora-cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('div');
  ring.className = 'nexora-cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ring);

  let x = innerWidth / 2, y = innerHeight / 2;
  let rx = x, ry = y, visible = false, frame = 0;
  const trails = [];
  const colors = ['#00f5d4', '#8c70ff', '#b6fff3'];

  function move(e) {
    x = e.clientX; y = e.clientY; visible = true;
    dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    dot.classList.add('is-visible');
    ring.classList.add('is-visible');
    if (trails.length < 22 && Math.random() > .45) {
      const p = document.createElement('span');
      p.className = 'nexora-cursor-trail';
      p.style.setProperty('--trail-color', colors[Math.floor(Math.random()*colors.length)]);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p); trails.push(p);
      requestAnimationFrame(() => p.classList.add('nexora-trail-fade'));
      setTimeout(() => { p.remove(); const i=trails.indexOf(p); if(i>=0)trails.splice(i,1); }, 520);
    }
  }
  function animate() {
    frame = requestAnimationFrame(animate);
    if (document.hidden || !visible) return;
    rx += (x-rx)*.16; ry += (y-ry)*.16;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
  }
  addEventListener('pointermove', move, {passive:true});
  addEventListener('pointerleave', () => { visible=false; dot.classList.remove('is-visible'); ring.classList.remove('is-visible'); });
  addEventListener('pointerdown', () => ring.classList.add('is-pressed'));
  addEventListener('pointerup', () => ring.classList.remove('is-pressed'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !frame) animate(); });
  animate();
})();