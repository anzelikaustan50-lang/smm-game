/* Настоящая 3D-сцена на первом экране: золотые серьги с гранёными камнями.
   Всё построено кодом (three.js), без внешних моделей. */
(function () {
  var cv = document.getElementById('gl');
  var wrap = cv && cv.parentElement;
  function fail() { if (wrap) wrap.classList.add('no-gl'); }
  if (!cv || !window.THREE) return fail();
  var T = THREE, renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return fail(); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.6 : 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 17);

  /* ---- студийное окружение для бликов ---- */
  var env = new T.Scene();
  env.background = new T.Color(0x02080b);
  function panel(w, h, color, k, x, y, z) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  }
  panel(12, 4, 0xffffff, 3.2, 0, 9, 6);
  panel(4, 12, 0xffe6bb, 2.4, -10, 1, 3);
  panel(4, 12, 0x8fe9f2, 2.2, 10, -1, 4);
  panel(14, 2, 0xffffff, 1.6, 0, -8, 5);
  panel(9, 9, 0xffcf8a, 1.4, 0, 3, -10);
  panel(1.5, 1.5, 0xffffff, 7, 4, 4, 9);
  panel(10, 7, 0xffc46a, 4.5, 0, 0, 12);
  panel(6, 6, 0xffdf9e, 5, -6, 5, 8);
  panel(6, 4, 0xffcf80, 4, 6, -4, 8);
  var pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.015).texture;

  scene.add(new T.AmbientLight(0xffffff, 0.15));
  var key = new T.DirectionalLight(0xfff1d6, 1.1); key.position.set(4, 6, 8); scene.add(key);
  var rim = new T.PointLight(0x58e0ee, 25, 40); rim.position.set(-8, -2, 4); scene.add(rim);

  /* ---- материалы ---- */
  var gold = new T.MeshStandardMaterial({ color: 0xffd98a, metalness: 1, roughness: 0.16, envMapIntensity: 1.9 });
  var goldSoft = new T.MeshStandardMaterial({ color: 0xf0c673, metalness: 1, roughness: 0.3, envMapIntensity: 1.6 });
  function gemMat(c) {
    return new T.MeshPhysicalMaterial({ color: c, metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0,
      envMapIntensity: 1.5, flatShading: true, reflectivity: 1, ior: 2.3 });
  }

  /* ---- геометрия ---- */
  var gemGeo = new T.LatheGeometry([
    new T.Vector2(0, -0.92), new T.Vector2(1, 0), new T.Vector2(1.02, 0.1),
    new T.Vector2(0.64, 0.5), new T.Vector2(0.62, 0.52), new T.Vector2(0, 0.52)
  ], 16);
  var postGeo = new T.CylinderGeometry(0.07, 0.07, 2.4, 14);

  function gem(c, s) { var g = new T.Mesh(gemGeo, gemMat(c)); g.rotation.x = Math.PI / 2; g.scale.setScalar(s); return g; }
  function post(len, z) {
    var p = new T.Mesh(postGeo, goldSoft); p.rotation.x = Math.PI / 2; p.scale.y = len / 2.4; p.position.z = z; return p;
  }
  function lock(z) {  // замок безопасности: купол с рифлёным фланцем
    var g = new T.Group();
    var dome = new T.Mesh(new T.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.rotation.x = -Math.PI / 2; g.add(dome);
    var fl = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.07, 10), gold); fl.rotation.x = Math.PI / 2; g.add(fl);
    g.position.z = z; return g;
  }
  function stud(c, s) {  // камень в оправе с лапками
    var g = new T.Group();
    g.add(gem(c, s));
    var ring = new T.Mesh(new T.TorusGeometry(1.03 * s, 0.07 * s, 12, 40), gold); g.add(ring);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4;
      var pr = new T.Mesh(new T.SphereGeometry(0.1 * s, 12, 10), gold);
      pr.position.set(Math.cos(a) * 0.98 * s, Math.sin(a) * 0.98 * s, 0.1 * s); g.add(pr);
    }
    g.add(post(1.6 * s, -1.0 * s)); g.add(lock(-1.7 * s));
    return g;
  }
  function ball(s) {
    var g = new T.Group();
    g.add(new T.Mesh(new T.SphereGeometry(s, 40, 28), gold));
    g.add(post(1.5 * s, -0.9 * s)); g.add(lock(-1.5 * s));
    return g;
  }
  function flower(c, mid, s) {
    var g = new T.Group();
    var base = new T.Mesh(new T.CylinderGeometry(1.0 * s, 1.0 * s, 0.14 * s, 5), gold); base.rotation.x = Math.PI / 2; base.rotation.z = Math.PI / 10; g.add(base);
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5;
      var gm = gem(c, 0.3 * s); gm.position.set(Math.cos(a) * 0.62 * s, Math.sin(a) * 0.62 * s, 0.1 * s); g.add(gm);
    }
    var m = gem(mid, 0.34 * s); m.position.z = 0.12 * s; g.add(m);
    g.add(post(1.2 * s, -0.7 * s));
    return g;
  }

  /* ---- композиция ---- */
  var root = new T.Group(); scene.add(root);
  var items = [];
  function add(obj, x, y, z, rx, ry, rz, fl) {
    obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz);
    root.add(obj); items.push({ o: obj, y0: y, ph: Math.random() * 6, sp: 0.6 + Math.random() * 0.6, amp: fl || 0.18, spin: 0 });
    return obj;
  }
  // главная пара: прозрачные камни
  var hero1 = add(stud(0xcfdde6, 1.45), -1.9, 0.3, 0.6, 0.55, 0.6, 0, 0.1);
  var hero2 = add(stud(0xcfdde6, 1.45), 2.2, -0.6, 0.2, 0.5, -0.5, 0, 0.12);
  // камни Birthstone вокруг
  add(stud(0xc4123f, 0.9), -4.6, 2.4, -0.5, 0.7, 0.7, 0, 0.3);
  add(stud(0x0e2fb8, 0.7), 4.4, 2.6, -1.2, 0.3, -0.7, 0, 0.3);
  add(stud(0x0a8f4f, 0.62), -4.3, -2.6, 0.2, 0.2, 0.9, 0, 0.3);
  add(stud(0xe08a00, 0.66), 4.0, -3.0, -0.2, -0.3, -0.8, 0, 0.3);
  add(ball(0.55), 0.2, 3.5, -1.6, 0.4, 0.6, 0, 0.25);
  add(ball(0.42), -0.8, -3.6, 0.8, 0.2, -0.5, 0, 0.25);
  add(flower(0xff8fb8, 0xfff4cc, 0.75), 2.6, 3.9, -2.4, 0.5, -0.3, 0.2, 0.2);
  add(stud(0x6a3fc8, 0.5), -2.8, 3.6, -2.0, 0.3, 0.8, 0, 0.25);

  /* ---- искры ---- */
  var sp = document.createElement('canvas'); sp.width = sp.height = 64;
  var sc = sp.getContext('2d'), gr = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,214,140,.55)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
  sc.fillStyle = gr; sc.fillRect(0, 0, 64, 64);
  var N = small ? 40 : 90, pos = new Float32Array(N * 3), vel = [];
  for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 16; pos[i * 3 + 1] = (Math.random() - .5) * 12; pos[i * 3 + 2] = (Math.random() - .5) * 8 - 1; vel.push(0.004 + Math.random() * 0.01); }
  var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  var pts = new T.Points(pg, new T.PointsMaterial({ size: 0.38, map: new T.CanvasTexture(sp), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 }));
  scene.add(pts);

  /* ---- управление ---- */
  var ry = 0, rx = 0, vy = 0, tx = 0, ty = 0, drag = false, lx = 0, ly = 0, hover = false, visible = true, W = 0, H = 0;
  cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('grab'); });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    tx = ((e.clientY - r.top) / r.height - .5) * -0.35; ty = ((e.clientX - r.left) / r.width - .5) * 0.6; hover = true;
    if (drag) { vy = (e.clientX - lx) * 0.008; ry += vy; rx += (e.clientY - ly) * 0.004; rx = Math.max(-0.6, Math.min(0.6, rx)); lx = e.clientX; ly = e.clientY; }
  });
  function up() { drag = false; cv.classList.remove('grab'); }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', function () { hover = false; });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(cv);

  function size() {
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    camera.position.z = W / H < 0.9 ? 28 : 22;
    camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  var t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    var t = (now - t0) / 1000;
    if (!drag) { vy *= 0.94; ry += vy; if (!reduce) ry += 0.0022; }
    root.rotation.y += (ry - root.rotation.y) * 0.1 + (hover ? ty * 0.02 : 0);
    root.rotation.x += ((hover ? tx : 0) + rx - root.rotation.x) * 0.06;
    var sy = Math.min(scrollY, 900) / 900; root.position.y = sy * 1.2;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.o.position.y = it.y0 + Math.sin(t * it.sp + it.ph) * it.amp * 3.2;
      it.o.rotation.z += 0.0015 * (i % 2 ? 1 : -1);
    }
    hero1.rotation.y = 0.6 + Math.sin(t * 0.5) * 0.4; hero2.rotation.y = -0.5 + Math.cos(t * 0.45) * 0.4;
    var p = pg.attributes.position;
    for (var k = 0; k < N; k++) { p.array[k * 3 + 1] += vel[k]; if (p.array[k * 3 + 1] > 6.5) p.array[k * 3 + 1] = -6.5; }
    p.needsUpdate = true;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  wrap.classList.add('gl-ok');
})();
