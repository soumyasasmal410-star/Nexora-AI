/* three-effects.js
 * Adds a 3D layer to the portfolio:
 *  1. A mouse- and scroll-reactive 3D object behind the page (Three.js)
 *  2. 3D tilt on the skill and project cards
 * Requires Three.js (r128) loaded before this file.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;

  /* ---------- 1. Background 3D scene ---------- */
  function initScene() {
    if (typeof THREE === "undefined") return;

    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
    document.body.appendChild(canvas);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) {
      canvas.remove(); // WebGL unavailable: the site just stays 2D
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 9;

    var CYAN = 0x38bdf8;
    var VIOLET = 0xa78bfa;

    var rig = new THREE.Group();
    scene.add(rig);

    // Outer wireframe crystal
    var outer = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 1),
      new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.55 })
    );
    rig.add(outer);

    // Inner glowing core
    var core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.MeshBasicMaterial({ color: VIOLET, wireframe: true, transparent: true, opacity: 0.9 })
    );
    rig.add(core);

    // Orbit rings
    var rings = [];
    [3.1, 3.6].forEach(function (radius, i) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.012, 8, 120),
        new THREE.MeshBasicMaterial({ color: i ? VIOLET : CYAN, transparent: true, opacity: 0.6 })
      );
      ring.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4);
      ring.rotation.y = i ? 0.3 : -0.2;
      rig.add(ring);
      rings.push(ring);
    });

    // Particle field
    var COUNT = 450;
    var positions = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      var r = 5 + Math.random() * 9;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 4;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xbcd7ff, size: 0.035, transparent: true, opacity: 0.7 })
    );
    scene.add(particles);

    // State
    var mouse = { x: 0, y: 0 };
    var smooth = { x: 0, y: 0 };
    var scrollT = 0;
    var running = true;

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Desktop: object sits right of the hero text. Mobile: centered and smaller.
      var wide = w > 900;
      rig.userData.baseX = wide ? 3.6 : 0;
      rig.userData.scale = wide ? 1 : 0.65;
      rig.scale.setScalar(rig.userData.scale);
    }
    resize();
    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });

    window.addEventListener(
      "scroll",
      function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        scrollT = max > 0 ? window.scrollY / max : 0;
      },
      { passive: true }
    );

    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(tick);
    });

    var clock = new THREE.Clock();

    function tick() {
      if (!running) return;
      var t = clock.getElapsedTime();

      smooth.x += (mouse.x - smooth.x) * 0.05;
      smooth.y += (mouse.y - smooth.y) * 0.05;

      if (!reduceMotion) {
        outer.rotation.y = t * 0.15;
        outer.rotation.x = t * 0.08;
        core.rotation.y = -t * 0.4;
        core.rotation.x = t * 0.25;
        rings[0].rotation.z = t * 0.2;
        rings[1].rotation.z = -t * 0.15;
        particles.rotation.y = t * 0.012;
        rig.position.y = Math.sin(t * 0.8) * 0.15;
      }

      // Mouse tilt + scroll-linked travel (object drifts left and spins as you scroll)
      rig.rotation.y = smooth.x * 0.5 + scrollT * Math.PI * 2;
      rig.rotation.x = smooth.y * 0.3;
      rig.position.x = rig.userData.baseX * (1 - Math.min(scrollT * 2.5, 1)) - scrollT * 1.5;
      camera.position.x = smooth.x * 0.4;
      camera.position.y = -smooth.y * 0.3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ---------- 2. Card tilt ---------- */
  function initTilt() {
    if (isTouch || reduceMotion) return;

    // Cards are found as the parent of each h3 inside About and Projects.
    // If a card is missed, add its selector here.
    var cards = [];
    document.querySelectorAll("#about h3, #projects h3").forEach(function (h) {
      var card = h.closest(".skill, .project") || h.parentElement;
      if (card && cards.indexOf(card) === -1) cards.push(card);
    });

    cards.forEach(function (card) {
      card.style.transformStyle = "preserve-3d";
      card.style.willChange = "transform";

      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transition = "transform 0.08s ease-out";
        card.style.transform =
          "perspective(800px) rotateX(" + -py * 12 + "deg) rotateY(" + px * 14 +
          "deg) translateZ(10px)";
      });

      card.addEventListener("mouseleave", function () {
        card.style.transition = "transform 0.45s ease";
        card.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateZ(0)";
      });
    });
  }

  function start() {
    initScene();
    initTilt();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();