/* cursor-effects.js
 * Animated mouse pointer: a sharp dot, a trailing ring that grows over
 * links/buttons, a click ripple, and a short glowing trail.
 * Desktop only. Touch devices and reduced-motion users keep the normal cursor.
 */
(function () {
  "use strict";

  if (window.matchMedia("(hover: none)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var CYAN = "56,189,248";
  var VIOLET = "167,139,250";

  // Styles are injected so only one file is needed.
  var style = document.createElement("style");
  style.textContent =
    "html.has-custom-cursor, html.has-custom-cursor a, html.has-custom-cursor button," +
    "html.has-custom-cursor [role='button'], html.has-custom-cursor label { cursor: none; }" +
    "html.has-custom-cursor input, html.has-custom-cursor textarea { cursor: text; }" +
    ".cc-dot, .cc-ring, .cc-ripple { position: fixed; top: 0; left: 0; pointer-events: none; z-index: 99999; border-radius: 50%; }" +
    ".cc-dot { width: 8px; height: 8px; margin: -4px 0 0 -4px; background: rgb(" + CYAN + ");" +
    "  box-shadow: 0 0 12px rgba(" + CYAN + ", .9); transition: opacity .2s, width .2s, height .2s, margin .2s; }" +
    ".cc-ring { width: 38px; height: 38px; margin: -19px 0 0 -19px; border: 1.5px solid rgba(" + VIOLET + ", .85);" +
    "  transition: width .25s ease, height .25s ease, margin .25s ease, background .25s ease, border-color .25s ease, opacity .2s; }" +
    ".cc-ring.is-hover { width: 64px; height: 64px; margin: -32px 0 0 -32px; background: rgba(" + VIOLET + ", .14); border-color: rgba(" + CYAN + ", .95); }" +
    ".cc-ring.is-down { width: 26px; height: 26px; margin: -13px 0 0 -13px; }" +
    ".cc-dot.is-hover { width: 4px; height: 4px; margin: -2px 0 0 -2px; }" +
    ".cc-ripple { width: 20px; height: 20px; margin: -10px 0 0 -10px; border: 2px solid rgba(" + CYAN + ", .9);" +
    "  animation: cc-ripple .6s ease-out forwards; }" +
    "@keyframes cc-ripple { to { transform: translate(var(--x), var(--y)) scale(4.5); opacity: 0; } }" +
    ".cc-hidden { opacity: 0 !important; }";
  document.head.appendChild(style);

  var dot = document.createElement("div");
  var ring = document.createElement("div");
  dot.className = "cc-dot cc-hidden";
  ring.className = "cc-ring cc-hidden";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring);
  document.body.appendChild(dot);
  document.documentElement.classList.add("has-custom-cursor");

  // Glowing trail: a few fading dots that follow with a delay
  var TRAIL = 10;
  var trail = [];
  for (var i = 0; i < TRAIL; i++) {
    var p = document.createElement("div");
    p.className = "cc-dot cc-hidden";
    p.style.transition = "none";
    p.style.opacity = "0";
    p.setAttribute("aria-hidden", "true");
    var s = Math.max(2, 7 - i * 0.5);
    p.style.width = p.style.height = s + "px";
    p.style.margin = -s / 2 + "px 0 0 " + -s / 2 + "px";
    p.style.background = "rgb(" + (i % 2 ? VIOLET : CYAN) + ")";
    p.style.boxShadow = "none";
    document.body.appendChild(p);
    trail.push({ el: p, x: 0, y: 0 });
  }

  var mx = -100, my = -100;   // real mouse
  var rx = -100, ry = -100;   // ring (eased)
  var shown = false;

  window.addEventListener("mousemove", function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (!shown) {
      shown = true;
      rx = mx; ry = my;
      dot.classList.remove("cc-hidden");
      ring.classList.remove("cc-hidden");
    }
    dot.style.transform = "translate(" + mx + "px," + my + "px)";
  });

  document.addEventListener("mouseleave", function () {
    dot.classList.add("cc-hidden");
    ring.classList.add("cc-hidden");
    shown = false;
  });

  // Grow the ring over anything clickable
  var HOVER = "a, button, [role='button'], input, textarea, label, .skill, .project";
  document.addEventListener("mouseover", function (e) {
    var on = !!(e.target.closest && e.target.closest(HOVER));
    ring.classList.toggle("is-hover", on);
    dot.classList.toggle("is-hover", on);
  });

  document.addEventListener("mousedown", function (e) {
    ring.classList.add("is-down");
    var r = document.createElement("div");
    r.className = "cc-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    r.style.setProperty("--x", "0px");
    r.style.setProperty("--y", "0px");
    document.body.appendChild(r);
    setTimeout(function () { r.remove(); }, 650);
  });
  document.addEventListener("mouseup", function () {
    ring.classList.remove("is-down");
  });

  function tick() {
    // Ring eases toward the pointer
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = "translate(" + rx + "px," + ry + "px)";

    // Each trail dot eases toward the one before it
    var tx = mx, ty = my;
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      t.x += (tx - t.x) * 0.35;
      t.y += (ty - t.y) * 0.35;
      t.el.style.transform = "translate(" + t.x + "px," + t.y + "px)";
      t.el.style.opacity = shown ? String((1 - i / trail.length) * 0.5) : "0";
      tx = t.x;
      ty = t.y;
    }
    requestAnimationFrame(tick);
  }
  tick();
})();