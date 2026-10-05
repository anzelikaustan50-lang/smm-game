/* Первый экран: огранённые камни с игрой света (дисперсия), золото, свечение (bloom).
   Всё считается в браузере через three.js, внешних моделей нет. */
(function () {
  var cv = document.getElementById('gl');
  var wrap = cv && cv.parentElement;
  function fail() { if (wrap) wrap.classList.add('no-gl'); }
  if (!cv || !window.THREE) return fail();
  var T = THREE, renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return fail(); }
  if (!renderer.capabilities.isWebGL2) return fail();
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = innerWidth < 760;
  var DPR = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputEncoding = T.LinearEncoding;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 26);

  /* ---------- студийный свет: HDR-окружение из мягких боксов ---------- */
  var env = new T.Scene();
  var dome = new T.Mesh(new T.SphereGeometry(40, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 p;void main(){float h=normalize(p).y*.5+.5;vec3 c=mix(vec3(.004,.012,.016),vec3(.02,.06,.07),h);gl_FragColor=vec4(c,1.);}'
  }));
  env.add(dome);
  function box(w, h, color, k, x, y, z) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  }
  // мягкие крупные источники
  box(22, 8, 0xfff2dd, 3.2, 0, 24, 10);
  box(6, 24, 0xffe2b0, 2.4, -24, 2, 6);
  box(6, 24, 0x9fefff, 2.0, 24, -2, 8);
  box(12, 12, 0xffc872, 2.6, 0, 4, 26);
  // множество мелких бликов: из них складывается игра света в гранях
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var cols = [0xffffff, 0xffffff, 0xfff0d0, 0xbfeaff, 0xffd9a0, 0xffc2e0];
  for (var q = 0; q < 70; q++) {
    var th = rnd() * Math.PI * 2, ph2 = Math.acos(2 * rnd() - 1), rr = 24;
    box(1.2 + rnd() * 3.2, 1.2 + rnd() * 3.2, cols[(rnd() * cols.length) | 0], 4 + rnd() * 10,
      rr * Math.sin(ph2) * Math.cos(th), rr * Math.cos(ph2), rr * Math.sin(ph2) * Math.sin(th));
  }
  var cubeRT = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter });
  var cubeCam = new T.CubeCamera(0.1, 100, cubeRT);
  cubeCam.update(renderer, env);
  var pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;

  /* ---------- материалы ---------- */
  var gold = new T.MeshStandardMaterial({ color: 0xf5c46a, metalness: 1, roughness: 0.2, envMapIntensity: 1.1 });
  var goldDeep = new T.MeshStandardMaterial({ color: 0xe2a94c, metalness: 1, roughness: 0.32, envMapIntensity: 1.0 });

  function gemMat(tint, strength) {
    return new T.ShaderMaterial({
      side: T.DoubleSide,
      uniforms: { envMap: { value: cubeRT.texture }, tint: { value: new T.Color(tint) }, k: { value: strength || 1 } },
      vertexShader: 'varying vec3 vW;varying vec3 vL;void main(){vL=position;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: [
        'uniform samplerCube envMap;uniform vec3 tint;uniform float k;varying vec3 vW;varying vec3 vL;',
        'vec3 env(vec3 d){return textureCube(envMap,vec3(-d.x,d.y,d.z)).rgb;}',
        'void main(){',
        ' vec3 I=normalize(vW-cameraPosition);',
        ' vec3 N=normalize(cross(dFdx(vW),dFdy(vW)));if(dot(N,I)>0.)N=-N;',
        ' vec3 R=reflect(I,N);',
        ' vec3 tr=refract(I,N,1./2.40),tg=refract(I,N,1./2.43),tb=refract(I,N,1./2.47);',
        ' vec3 b=normalize(vL)*.55;',
        ' vec3 c1=vec3(env(normalize(tr+b)).r,env(normalize(tg+b)).g,env(normalize(tb+b)).b);',
        ' vec3 r2=reflect(tg,-N);',
        ' vec3 c2=vec3(env(normalize(r2+b*1.4)).r,env(normalize(r2+b*1.4)).g,env(normalize(r2+b*1.4)).b);',
        ' vec3 c=mix(c1,c2,.5);',
        ' c=pow(max(c,0.),vec3(1.35))*1.7*k;',
        ' float f=pow(1.-abs(dot(N,-I)),3.);',
        ' c=mix(c,env(R)*1.25,.18+.5*f);',
        ' c*=mix(vec3(1.),tint*1.5,.85);',
        ' c+=tint*.02;',
        ' gl_FragColor=vec4(c,1.);}'
      ].join('\n')
    });
  }

  /* ---------- огранка «бриллиант» (8 секторов, настоящие грани) ---------- */
  function brilliant() {
    var N = 8, P = [], i, a;
    function pt(r, y, ang) { return [Math.cos(ang) * r, y, Math.sin(ang) * r]; }
    var top = [0, 0.52, 0], cul = [0, -1.0, 0], T_ = [], U = [], G = [], L = [];
    for (i = 0; i < N; i++) {
      a = i * 2 * Math.PI / N; var h = Math.PI / N;
      T_.push(pt(0.56, 0.52, a));
      U.push(pt(0.86, 0.36, a + h));
      G.push(pt(1.0, 0.1, a));
      L.push(pt(0.52, -0.5, a + h));
    }
    function tri(a, b, c) { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
    for (i = 0; i < N; i++) {
      var j = (i + 1) % N;
      tri(top, T_[j], T_[i]);
      tri(T_[i], T_[j], U[i]);
      tri(T_[j], G[j], U[i]);
      tri(T_[j], U[j], G[j]);
      tri(U[i], G[j], G[i]);
      tri(G[i], G[j], L[i]);
      tri(G[j], L[j == 0 ? 0 : j] , L[i]);
      tri(L[i], L[j], cul);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    return g;
  }
  var gemGeo = brilliant();
  var postGeo = new T.CylinderGeometry(0.06, 0.06, 2.4, 14);
  var prongGeo = new T.CylinderGeometry(0.06, 0.1, 0.55, 8);
  var ballGeo = new T.SphereGeometry(1, 40, 28);

  function gem(tint, s, k) { var m = new T.Mesh(gemGeo, gemMat(tint, k)); m.rotation.x = Math.PI / 2; m.scale.setScalar(s); return m; }
  function post(len, z) { var p = new T.Mesh(postGeo, goldDeep); p.rotation.x = Math.PI / 2; p.scale.y = len / 2.4; p.position.z = z; return p; }
  function lock(z) {
    var g = new T.Group();
    var dome = new T.Mesh(new T.SphereGeometry(0.36, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.rotation.x = -Math.PI / 2; g.add(dome);
    var fl = new T.Mesh(new T.CylinderGeometry(0.52, 0.52, 0.07, 12), gold); fl.rotation.x = Math.PI / 2; g.add(fl);
    g.position.z = z; return g;
  }
  function stud(tint, s, k) {
    var g = new T.Group();
    g.add(gem(tint, s, k));
    var ring = new T.Mesh(new T.TorusGeometry(1.0 * s, 0.075 * s, 12, 48), gold); ring.position.z = -0.05 * s; g.add(ring);
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + Math.PI / 6, pr = new T.Mesh(prongGeo, gold);
      pr.scale.setScalar(s);
      pr.position.set(Math.cos(a) * 1.0 * s, Math.sin(a) * 1.0 * s, 0.1 * s);
      pr.rotation.x = Math.PI / 2; g.add(pr);
    }
    g.add(post(1.7 * s, -1.0 * s)); g.add(lock(-1.8 * s));
    return g;
  }
  function ball(s) {
    var g = new T.Group(), m = new T.Mesh(ballGeo, gold); m.scale.setScalar(s); g.add(m);
    g.add(post(1.5 * s, -0.9 * s)); g.add(lock(-1.5 * s)); return g;
  }

  /* ---------- композиция ---------- */
  var root = new T.Group(); scene.add(root);
  var items = [];
  function add(o, x, y, z, rx, ry, rz, amp, spin) {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); root.add(o);
    items.push({ o: o, y0: y, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.5, amp: amp, spin: spin || 0 });
    return o;
  }
  var heroA = add(stud(0xf3f8ff, 1.9, 0.62), -0.4, 0.5, 1.0, 0.6, 0.5, 0, 0.12);
  var heroB = add(stud(0xf3f8ff, 1.5, 0.62), 3.4, -1.9, -0.4, 0.55, -0.6, 0, 0.14);
  add(stud(0xff2a5a, 0.95, 1.3), -3.9, 3.0, 0.4, 0.8, 0.7, 0, 0.35, 0.004);
  add(stud(0x2d5bff, 0.85, 1.4), 5.4, 3.6, -1.6, 0.8, -0.7, 0, 0.35, -0.004);
  add(stud(0x14d27d, 0.75, 1.3), -4.3, -3.1, 0.2, 0.7, 0.9, 0, 0.35, 0.005);
  add(stud(0xffb21a, 0.8, 1.3), 6.0, -3.7, -0.4, 0.8, -0.8, 0, 0.35, -0.005);
  add(ball(0.62), 1.4, 4.4, -2.2, 0.4, 0.6, 0, 0.3);
  add(ball(0.46), -1.6, -4.2, 0.9, 0.2, -0.5, 0, 0.3);
  add(stud(0xb98aff, 0.6, 1.3), 2.0, -4.6, 1.4, 0.8, 0.5, 0, 0.3, 0.006);
  add(stud(0xffffff, 0.55, 1.2), -2.4, 4.6, -1.2, 0.7, -0.4, 0, 0.3, -0.006);

  /* ---------- золотая пыль ---------- */
  var sp = document.createElement('canvas'); sp.width = sp.height = 64;
  var sc = sp.getContext('2d'), gr = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,244,214,1)'); gr.addColorStop(0.2, 'rgba(255,214,140,.6)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
  sc.fillStyle = gr; sc.fillRect(0, 0, 64, 64);
  var N = small ? 50 : 110, pos = new Float32Array(N * 3), vel = [];
  for (var i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 26; pos[i * 3 + 1] = (Math.random() - .5) * 14; pos[i * 3 + 2] = (Math.random() - .5) * 10 - 2; vel.push(0.004 + Math.random() * 0.012); }
  var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  var dust = new T.Points(pg, new T.PointsMaterial({ size: 0.34, map: new T.CanvasTexture(sp), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.85, color: 0xffd9a0 }));
  scene.add(dust);

  /* ---------- свечение и итоговый кадр ---------- */
  var rtOpts = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true };
  var rtScene = new T.WebGLRenderTarget(4, 4, rtOpts);
  var rtA = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
  var rtB = rtA.clone();
  var quadGeo = new T.PlaneGeometry(2, 2), quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var vs = 'varying vec2 u;void main(){u=uv;gl_Position=vec4(position.xy,0.,1.);}';
  function pass(frag, uni) { var m = new T.ShaderMaterial({ vertexShader: vs, fragmentShader: frag, uniforms: uni, depthTest: false, depthWrite: false }); var q = new T.Mesh(quadGeo, m); q.frustumCulled = false; var s = new T.Scene(); s.add(q); return { s: s, m: m }; }
  var bright = pass('uniform sampler2D t;varying vec2 u;void main(){vec3 c=texture2D(t,u).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(1.5,3.4,l),1.);}', { t: { value: null } });
  var blur = pass('uniform sampler2D t;uniform vec2 d;varying vec2 u;void main(){vec3 c=texture2D(t,u).rgb*.227;c+=(texture2D(t,u+d*1.38).rgb+texture2D(t,u-d*1.38).rgb)*.316;c+=(texture2D(t,u+d*3.23).rgb+texture2D(t,u-d*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}', { t: { value: null }, d: { value: new T.Vector2() } });
  var comp = pass([
    'uniform sampler2D t;uniform sampler2D bl;uniform vec2 res;varying vec2 u;',
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
    'void main(){vec3 c=texture2D(t,u).rgb+texture2D(bl,u).rgb*0.6;',
    ' c=aces(c*.9);',
    ' vec2 q=u-.5;float v=1.-dot(q,q)*.9;c*=v;',
    ' float g=fract(sin(dot(u*res,vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)/255.;',
    ' gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}'
  ].join('\n'), { t: { value: null }, bl: { value: null }, res: { value: new T.Vector2() } });

  /* ---------- управление ---------- */
  var ry = 0, rx = 0, vy = 0, tx = 0, ty = 0, drag = false, lx = 0, ly = 0, hover = false, visible = true, W = 1, H = 1, offX = 0;
  cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('grab'); });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    tx = ((e.clientY - r.top) / r.height - .5) * -0.3; ty = ((e.clientX - r.left) / r.width - .5) * 0.5; hover = true;
    if (drag) { vy = (e.clientX - lx) * 0.008; ry += vy; rx += (e.clientY - ly) * 0.004; rx = Math.max(-0.5, Math.min(0.5, rx)); lx = e.clientX; ly = e.clientY; }
  });
  function up() { drag = false; cv.classList.remove('grab'); }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', function () { hover = false; });
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(cv);

  function size() {
    var r = cv.getBoundingClientRect(); W = Math.max(2, Math.floor(r.width)); H = Math.max(2, Math.floor(r.height));
    var w = Math.floor(W * DPR), h = Math.floor(H * DPR);
    renderer.setSize(W, H, false);
    rtScene.setSize(w, h); rtA.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); rtB.setSize(rtA.width, rtA.height);
    camera.aspect = W / H;
    var wide = W / H > 1.15;
    camera.position.z = wide ? 26 : 30;
    offX = wide ? 4.4 : 0;
    root.position.x = offX; root.position.y = wide ? 0 : 0.6;
    root.scale.setScalar(wide ? 1 : 0.8);
    camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  function renderFrame() {
    renderer.setRenderTarget(rtScene); renderer.setClearColor(0x03090c, 1); renderer.clear(); renderer.render(scene, camera);
    bright.m.uniforms.t.value = rtScene.texture; renderer.setRenderTarget(rtA); renderer.render(bright.s, quadCam);
    for (var k = 0; k < 2; k++) {
      blur.m.uniforms.t.value = rtA.texture; blur.m.uniforms.d.value.set(1 / rtA.width * (1 + k), 0); renderer.setRenderTarget(rtB); renderer.render(blur.s, quadCam);
      blur.m.uniforms.t.value = rtB.texture; blur.m.uniforms.d.value.set(0, 1 / rtA.height * (1 + k)); renderer.setRenderTarget(rtA); renderer.render(blur.s, quadCam);
    }
    comp.m.uniforms.t.value = rtScene.texture; comp.m.uniforms.bl.value = rtA.texture; comp.m.uniforms.res.value.set(W, H);
    renderer.setRenderTarget(null); renderer.render(comp.s, quadCam);
  }

  var t0 = performance.now(), first = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    var t = (now - t0) / 1000;
    if (!drag) { vy *= 0.94; ry += vy; if (!reduce) ry += 0.0018; }
    root.rotation.y += (ry * 0.4 - root.rotation.y) * 0.08 + (hover ? ty * 0.02 : 0);
    root.rotation.x += ((hover ? tx : 0) + rx - root.rotation.x) * 0.06;
    var sy = Math.min(scrollY, 900) / 900; root.position.y = (W / H > 1.15 ? 0 : 0.6) + sy * 1.4;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.o.position.y = it.y0 + Math.sin(t * it.sp + it.ph) * it.amp * 3;
      it.o.rotation.z += it.spin;
    }
    heroA.rotation.y = 0.45 + Math.sin(t * 0.5) * 0.55; heroB.rotation.y = -0.5 + Math.cos(t * 0.42) * 0.55;
    heroA.rotation.x = 0.6 + Math.sin(t * 0.6) * 0.15; heroB.rotation.x = 0.55 + Math.cos(t * 0.5) * 0.15;
    var p = pg.attributes.position;
    for (var k = 0; k < N; k++) { p.array[k * 3 + 1] += vel[k]; if (p.array[k * 3 + 1] > 7) p.array[k * 3 + 1] = -7; }
    p.needsUpdate = true;
    renderFrame();
    if (first) { first = false; wrap.classList.add('gl-ok'); }
  }
  requestAnimationFrame(frame);
})();
