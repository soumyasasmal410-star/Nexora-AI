/* Nexora AI 3D authentication effects. Decorative only; respects reduced-motion preferences. */
(()=> {
  if (window.__nexora3d) return;
  window.__nexora3d = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const auth = ['auth-login','auth-signup'].some(c => document.body.classList.contains(c)) ||
    ['/login','/signup'].includes(path) || window.NEXORA_FX === 'auth';
  if (!auth || reduced) return;

  const panel = document.querySelector('.auth-visual');
  const mobile = matchMedia('(max-width: 850px)').matches;
  let host = panel;
  if (!host) {
    host = document.querySelector('.auth-card');
    if (!host) return;
    host.classList.add('auth-3d-mobile-host');
  }
  host.classList.add('auth-3d-host');

  const start = () => {
    if (!window.THREE) return;
    try {
      const T = window.THREE;
      const canvas = document.createElement('canvas');
      canvas.className = 'auth-3d-canvas';
      canvas.setAttribute('aria-hidden','true');
      host.prepend(canvas);
      const renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:!mobile, powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
      renderer.setClearColor(0x000000,0);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(48,1,.1,100);
      camera.position.z = 8;
      const group = new T.Group();
      scene.add(group);

      const knot = new T.Mesh(
        new T.TorusKnotGeometry(1.25,.32,120,16,2,3),
        new T.MeshStandardMaterial({color:0x80ffe6,emissive:0x123d3a,metalness:.62,roughness:.24,wireframe:true})
      );
      group.add(knot);
      const orb = new T.Mesh(
        new T.IcosahedronGeometry(.72,2),
        new T.MeshStandardMaterial({color:0x9578ff,emissive:0x21134f,metalness:.7,roughness:.22,wireframe:true})
      );
      orb.position.set(1.9,-1.1,-.7);
      group.add(orb);
      const ring = new T.Mesh(
        new T.TorusGeometry(1.8,.018,8,120),
        new T.MeshBasicMaterial({color:0x9b86ff,transparent:true,opacity:.8})
      );
      ring.rotation.set(.8,.4,.2);
      group.add(ring);
      const light = new T.PointLight(0x70ffe4,2.4,20);
      light.position.set(2,3,5); scene.add(light);
      scene.add(new T.AmbientLight(0x9aa8ff,1.25));

      const count = mobile ? 90 : 240;
      const positions = new Float32Array(count*3);
      for(let i=0;i<count;i++){
        positions[i*3]=(Math.random()-.5)*9;
        positions[i*3+1]=(Math.random()-.5)*7;
        positions[i*3+2]=(Math.random()-.5)*5;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position',new T.BufferAttribute(positions,3));
      const stars = new T.Points(geo,new T.PointsMaterial({color:0xb4fff0,size:mobile?.025:.035,transparent:true,opacity:.7}));
      scene.add(stars);

      let pointer={x:0,y:0}, target={x:0,y:0}, frame=0;
      const onMove=e=>{
        const rect=host.getBoundingClientRect();
        target.x=((e.clientX-rect.left)/Math.max(rect.width,1)-.5)*.6;
        target.y=((e.clientY-rect.top)/Math.max(rect.height,1)-.5)*.45;
      };
      if(!mobile) host.addEventListener('mousemove',onMove,{passive:true});
      const resize=()=>{
        const rect=host.getBoundingClientRect();
        const w=Math.max(1,rect.width), h=Math.max(1,rect.height);
        renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      const animate=()=>{
        frame=requestAnimationFrame(animate);
        if(document.hidden)return;
        pointer.x+=(target.x-pointer.x)*.025; pointer.y+=(target.y-pointer.y)*.025;
        const t=performance.now()*.00035;
        group.rotation.y=t+pointer.x; group.rotation.x=Math.sin(t*.8)*.18+pointer.y;
        orb.rotation.x=-t*1.4; orb.rotation.y=t*1.1;
        ring.rotation.z=t*.35;
        stars.rotation.y=-t*.12;
        renderer.render(scene,camera);
      };
      animate();
      document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else animate();});
    } catch(e) {
      /* WebGL can be unavailable on older devices; the CSS layout remains usable. */
    }
  };
  if(window.THREE) start();
  else {
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async=true; script.onload=start; script.onerror=()=>{};
    document.head.appendChild(script);
  }
})();