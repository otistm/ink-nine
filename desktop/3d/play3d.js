/* Ink Nine 3D prototype: one hole (Meadowbrook 3, Long Way Round) played in 3D.
   The real game runs underneath: swing, tempo, curve, wind, physics, scoring and cards are the phone game's own.
   This file only swaps how it is seen: a real 3D course in greyscale toon shading with thin black outlines, and the
   2D game's animation (squash and stretch, anticipation, follow-through, springy camera, shake) carried into 3D.
   Loaded after desk.js and Three.js, before main.js. */
"use strict";

const P3_COURSE = 0, P3_HOLE = 2;
const C3 = { dither: false, mode: 'behind', span: 60, yaw: 0, zoom: 1, ready: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), lastState: '', yawDrag: null };
let three = null;

/* ---------- start straight on the hole; no saving, no online, no invitational ---------- */
saveRun = function () {}; clearRun = function () {}; loadRun = function () { return null; };
inMap = function () { return false; };            // the desktop corner map isn't drawn here
if (!meta.name) { meta.name = 'You'; saveMeta(); }
function start3D() {
  endTutorial();
  EV = EVENTS[0]; HOLES = COURSES[P3_COURSE].holes; COURSE_PAR = HOLES.reduce((a, h) => a + h.par, 0);
  Object.assign(S, { rec: [], friends: [], ghosts: [], earned: 0, hole: P3_HOLE, scores: [], holeLog: [], points: 0, holePts: 0, streak: 0, upg: {},
    bag: [0, 1, 2, 3, 4, 5, 6, 7], club: 0, firstShot: true, twist: STRAIGHT, allowed: null, banked: false, prevPos: null, field: [] });
  S.disp = 0; $('pv').textContent = '0'; $('hint').style.opacity = 1; computeMod(); updPts(); refreshChips();
  $('card').hidden = true;
  build3D(HOLES[P3_HOLE]);
  startHole(P3_HOLE);
  sharpenAround(S.ball.x, S.ball.y);
}
showHome = function () { start3D(); };
showCard = function () {
  const h = H(), s = S.scores[S.hole], L = S.holeLog[S.hole] || { total: 0 };
  $('panel').innerHTML = `<p class="evn">3D prototype, Meadowbrook hole ${S.hole + 1}</p><h2>${scoreName(s - h.par, s)}</h2>
    <p>${h.name} in ${s}, par ${h.par}. ${L.total ? L.total.toLocaleString() + ' points.' : ''}</p>
    <button class="btn" id="again3">Play it again</button>
    <p class="ver"><a class="linkbtn" href="/desktop/">Back to the desktop edition</a> · <button class="linkbtn" id="fb3">Send feedback</button></p>`;
  $('card').hidden = false; $('card').classList.remove('home');
  $('again3').addEventListener('click', () => { sfx('tick'); start3D(); });
  $('fb3').addEventListener('click', () => { sfx('tick'); showFeedback(showCard); });
};
{ const base = feedbackContext; feedbackContext = function () { return { ...base(), edition: 'desktop-3d' }; }; }

/* ---------- aiming: the camera's heading is the aim; the swing drag is read relative to the camera ---------- */
const pinAngle = () => { const b = S.ball, h = H(); return Math.atan2(h.cup[1] - b.y, h.cup[0] - b.x); };
{ const base = aimAngle; aimAngle = function () { return C3.ready && S.state !== 'intro' ? C3.yaw : base(); }; }
{ const base = dragInfo; dragInfo = function () { const d = base(); if (d.l > 4) { const w = screenDirToWorld(d.ang); d.ang = w != null ? w : d.ang + C3.yaw + Math.PI / 2; } else d.ang = C3.yaw; return d; }; }
// The swing is read on screen (pull back, the ball goes the other way). To turn that into a direction on the course,
// take a point a little way from the ball on screen in the shot's direction and find where it sits on the ground.
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _ndc = new THREE.Vector2(), _hit = new THREE.Vector3();
function screenDirToWorld(sa) {
  if (!three) return null; const b = S.ball, gz = zgAt(H(), b.x, b.y), p0 = WS3(b.x, b.y); if (p0[0] < -1e3) return null;
  const sx = p0[0] + Math.cos(sa) * 60, sy = p0[1] + Math.sin(sa) * 60;
  _plane.constant = -gz; _ndc.set(sx / W * 2 - 1, -(sy / Hh) * 2 + 1); _ray.setFromCamera(_ndc, three.camera);
  if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
  return Math.atan2(_hit.z - b.y, _hit.x - b.x);
}
{ const base = toAim; toAim = function () { C3.yaw = pinAngle(); C3.zoom = 1; base(); sharpenAround(S.ball.x, S.ball.y); }; }
{ const base = startHole; startHole = function (i) { const h = HOLES[i]; C3.yaw = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]); C3.zoom = 1; base(i); }; }

/* ============================================================
   THE LOOK: a real 3D course in greyscale toon shading.
   Colour is removed, light falls into a few hard bands, things cast real shadows, and a thin black
   outline is traced around every shape. Ball physics still runs on the game's own ground; the
   bunkers, greens, tee and lake are shaped on top of it for the eye only.
   ============================================================ */

/* ---------- shaping the ground for the eye: dug bunkers with a lip, raised greens and tee, a sunken lake ---------- */
const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function qShape(s, x, y) { // 1 on the shape's edge, under 1 inside, over 1 outside
  if (s.t === 'e') { const c = Math.cos(-s.rot), sn = Math.sin(-s.rot), dx = x - s.x, dy = y - s.y, u = dx * c - dy * sn, v = dx * sn + dy * c; return Math.sqrt(u * u / (s.rx * s.rx) + v * v / (s.ry * s.ry)); }
  if (s.t === 'c') { const P = s.poly || s.pts; let m = 1e9; for (let i = 0; i < P.length - 1; i++) m = Math.min(m, segDist(x, y, P[i], P[i + 1])); return m / s.r; }
  if (s.t === 'r') { const hw = (s.x1 - s.x0) / 2, hh = (s.y1 - s.y0) / 2; return Math.max(Math.abs(x - s.x0 - hw) / hw, Math.abs(y - s.y0 - hh) / hh); }
  return 9;
}
const TEE_RECT = h => ({ t: 'r', x0: h.tee[0] - 5, y0: h.tee[1] - 3, x1: h.tee[0] + 5, y1: h.tee[1] + 3 });
function shapeOffset(h, x, y) {
  let o = 0, g = 0, w = 0;
  for (const s of h.sand) { const q = qShape(s, x, y); if (q < 1.4) o += -.85 * sstep(1, .6, q) + .16 * Math.exp(-Math.pow((q - 1.07) / .07, 2)); }
  for (const s of h.green) g = Math.max(g, sstep(1.2, .97, qShape(s, x, y)));
  for (const s of h.water) w = Math.max(w, sstep(1, .8, qShape(s, x, y)));
  return o + .35 * g - 1.5 * w + .45 * sstep(1.14, 1, qShape(TEE_RECT(h), x, y));
}
const groundY = (h, x, y) => zgAt(h, x, y) + shapeOffset(h, x, y);

/* ---------- greyscale surfaces, painted once into a texture ---------- */
// ppy: pixels per yard. lw: ink line width in yards (thin up close, a little heavier for the whole-hole texture).
function paintGround(h, bb, ppy, lw) {
  const w = Math.round((bb.x1 - bb.x0) * ppy), hgt = Math.round((bb.y1 - bb.y0) * ppy), A = (bb.x1 - bb.x0) * (bb.y1 - bb.y0);
  const P = (x, y) => [(x - bb.x0) * ppy, (y - bb.y0) * ppy], d = holeDir(h), rnd = seeded(77);
  // one scratch canvas, cleared and reused for every layer and outline (full-size canvases are heavy)
  const scratch = document.createElement('canvas'); scratch.width = w; scratch.height = hgt; const sg = scratch.getContext('2d');
  const cnv = (fn) => { sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.clearRect(0, 0, w, hgt); fn(sg); return scratch; };
  const shapePath = (g, s, grow = 0) => {
    if (s.t === 'e') { const [x, y] = P(s.x, s.y); g.beginPath(); g.ellipse(x, y, (s.rx + grow) * ppy, (s.ry + grow) * ppy, s.rot, 0, TAU); g.fill(); }
    else if (s.t === 'c') { const pts = s.poly || s.pts; g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineWidth = 2 * (s.r + grow) * ppy; g.lineCap = g.lineJoin = 'round'; g.stroke(); }
    else if (s.t === 'r') { const [x0, y0] = P(s.x0 - grow, s.y0 - grow), [x1, y1] = P(s.x1 + grow, s.y1 + grow); g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  };
  // a layer = a mask of shapes, filled with its own painting
  const layer = (main, shapes, grow, paint) => {
    const c = cnv(g => { g.fillStyle = g.strokeStyle = '#000'; shapes.forEach(s => shapePath(g, s, grow)); g.globalCompositeOperation = 'source-in'; paint(g); });
    main.drawImage(c, 0, 0);
  };
  const stripes = (g, base, alt, width, ang) => { g.fillStyle = base; g.fillRect(0, 0, w, hgt); g.save(); g.translate(w / 2, hgt / 2); g.rotate(ang); g.fillStyle = alt;
    const L = Math.hypot(w, hgt), bw = width * ppy; for (let x = -L; x < L; x += bw * 2) g.fillRect(x, -L, bw, L * 2); g.restore(); };
  // ink: the outline of a group of shapes, traced just outside their edge (their union, so overlaps don't double up)
  const outline = (main, shapes, dash) => {
    if (!lw) return;   // dithered mode draws no lines at all
    const c = cnv(g => { g.fillStyle = g.strokeStyle = '#141414'; shapes.forEach(s => shapePath(g, s, lw)); g.globalCompositeOperation = 'destination-out'; shapes.forEach(s => shapePath(g, s, 0));
      if (dash) { g.globalCompositeOperation = 'destination-out'; g.save(); g.translate(w / 2, hgt / 2); g.rotate(.7); const L = Math.hypot(w, hgt), st = dash * ppy; for (let x = -L; x < L; x += st * 2) g.fillRect(x, -L, st, L * 2); g.restore(); } });
    main.drawImage(c, 0, 0);
  };
  // grain as a small repeating tile (16 yards across), so painting stays quick at any size
  const speckle = (g, perYd2, cols, size, base) => { const T = Math.max(8, Math.round(16 * ppy)), tc = document.createElement('canvas'); tc.width = tc.height = T; const tg = tc.getContext('2d');
    if (base) { tg.fillStyle = base; tg.fillRect(0, 0, T, T); } for (let i = 0; i < 256 * perYd2; i++) { tg.fillStyle = cols[(rnd() * cols.length) | 0]; tg.beginPath(); tg.arc(rnd() * T, rnd() * T, size * (.3 + rnd() * .4), 0, TAU); tg.fill(); }
    g.fillStyle = g.createPattern(tc, 'repeat'); g.fillRect(0, 0, w, hgt); };
  const out = document.createElement('canvas'); out.width = w; out.height = hgt; const g = out.getContext('2d');
  {
    g.fillStyle = '#b9b9b9'; g.fillRect(0, 0, w, hgt);
    speckle(g, 1.1, ['#adadad', '#c6c6c6', '#a6a6a6', '#cdcdcd'], .5 * ppy, '#b9b9b9');       // rough
    layer(g, h.fair, 1.6, g2 => { g2.fillStyle = '#c9c9c9'; g2.fillRect(0, 0, w, hgt); });        // first cut
    layer(g, h.fair, 0, g2 => { stripes(g2, '#dcdcdc', '#d0d0d0', 7, d); }); outline(g, h.fair);                 // mown fairway
    layer(g, h.water, 0, g2 => { g2.fillStyle = '#7d7d7d'; g2.fillRect(0, 0, w, hgt); }); outline(g, h.water);    // lake bed
    const fringe = h.green.map(s => ({ ...s, rx: s.rx + 1.6, ry: s.ry + 1.6 }));
    layer(g, fringe, 0, g2 => { g2.fillStyle = '#d3d3d3'; g2.fillRect(0, 0, w, hgt); }); outline(g, fringe, .7);   // fringe, dashed edge
    layer(g, h.green, 0, g2 => { stripes(g2, '#efefef', '#e6e6e6', 1.6, d + Math.PI / 4); }); outline(g, h.green); // green
    layer(g, h.sand, 0, g2 => { speckle(g2, 2.5, ['#dcdcdc', '#e6e6e6'], .35 * ppy, '#f1f1f1'); }); outline(g, h.sand);
    layer(g, [TEE_RECT(h)], 0, g2 => { stripes(g2, '#e6e6e6', '#dedede', 1.2, d + Math.PI / 2); }); outline(g, [TEE_RECT(h)]);
  }
  return out;
}
function noiseTile() { // fine grain laid over the ground near the camera, so it never looks smeared
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = seeded(5);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 150 + (r() * 105) | 0; g.fillStyle = `rgb(${v},${v},${v})`; const x = r() * 256, y = r() * 256; g.fillRect(x, y, 1.4, 3 + r() * 4); }
  return c;
}

/* ---------- toon materials: hard light bands, real shadows ---------- */
const TOON_RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([55, 55, 55, 55, 55, 55, 150, 150, 150, 255, 255, 255]), 4, 1, THREE.RGBFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: TOON_RAMP }, extra || {}));
// lets a toon material know where it is in the world (for ground grain and moving water)
function worldAware(mat, fragAfterMap, uniforms) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vWp;\n' + Object.keys(uniforms).map(k => `uniform ${uniforms[k].type} ${k};`).join('\n') + '\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + fragAfterMap);
  };
  return mat;
}

/* ---------- 8x8 Bayer threshold map for the dithering ---------- */
const BAYER = (() => { const m = [[0]]; let M = m;
  for (let n = 1; n < 8; n *= 2) { const N = []; for (let y = 0; y < n * 2; y++) { N.push([]); for (let x = 0; x < n * 2; x++) N[y].push(4 * M[y % n][x % n] + [[0, 2], [3, 1]][(y / n) | 0][(x / n) | 0]); } M = N; }
  const d = new Uint8Array(64 * 3); for (let i = 0; i < 64; i++) { const v = Math.round((M[(i / 8) | 0][i % 8] + .5) / 64 * 255); d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = v; }
  const t = new THREE.DataTexture(d, 8, 8, THREE.RGBFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.needsUpdate = true; return t; })();

/* ---------- outline pass: depth and normal edges, traced thin and black, fading into the haze ---------- */
const EDGE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const EDGE_FS = `
uniform sampler2D tColor, tNormal, tDepth, bayer; uniform vec2 res; uniform float cn, cf, fogNear, fogFar, dither, cell; varying vec2 vUv;
float vz(vec2 uv){ float d = texture2D(tDepth, uv).x; return cn * cf / (cf - d * (cf - cn)); }
vec3 nrm(vec2 uv){ return texture2D(tNormal, uv).xyz * 2. - 1.; }
void main(){
  vec2 p = 1. / res; float c = vz(vUv);
  float l = vz(vUv - vec2(p.x, 0.)), r = vz(vUv + vec2(p.x, 0.)), u = vz(vUv + vec2(0., p.y)), d = vz(vUv - vec2(0., p.y));
  float lap = abs(l + r + u + d - 4. * c) / c;
  float ed = smoothstep(.02, .06, lap);
  vec3 n = nrm(vUv); float nd = max(max(1. - dot(n, nrm(vUv - vec2(p.x, 0.))), 1. - dot(n, nrm(vUv + vec2(p.x, 0.)))), max(1. - dot(n, nrm(vUv + vec2(0., p.y))), 1. - dot(n, nrm(vUv - vec2(0., p.y)))));
  float en = smoothstep(.18, .4, nd);
  float e = max(ed, en) * (1. - smoothstep(fogNear, fogFar, c)) * (1. - dither);   // dithered mode: no outlines
  vec3 col = texture2D(tColor, vUv).rgb * (1. - e * .92);
  if (dither > .5) {   // 1-bit: every pixel pure black or white, greys become an ordered (Bayer) dot pattern
    float l = dot(col, vec3(.299, .587, .114));
    l = clamp((l - .5) * 1.3 + .57, 0., 1.);
    float t = texture2D(bayer, gl_FragCoord.xy / (8. * cell)).r;
    col = vec3(step(t, l));
  }
  gl_FragColor = vec4(col, 1.);
}`;
function makeTargets() {
  const w = Math.round(W * DPR), hh = Math.round(Hh * DPR), mk = () => { const t = new THREE.WebGLRenderTarget(w, hh); t.depthTexture = new THREE.DepthTexture(w, hh); t.depthTexture.type = THREE.UnsignedIntType; return t; };
  if (three.rtC) { three.rtC.dispose(); three.rtN.dispose(); }
  three.rtC = mk(); three.rtN = mk();
  const u = three.edge.material.uniforms; u.cell.value = 2 * DPR; u.tColor.value = three.rtC.texture; u.tDepth.value = three.rtC.depthTexture; u.tNormal.value = three.rtN.texture; u.res.value.set(w, hh);
}

/* ---------- pieces of the course ---------- */
function tuftGeometry() { // three blades of grass leaning out from a point
  const pos = [];
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + .3, c = Math.cos(a), s = Math.sin(a), lean = .08;
    pos.push(-.04 * s, 0, .04 * c, .04 * s, 0, -.04 * c, c * lean, .34 - k * .04, s * lean); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function lumpy(seed, detail) {
  const geo = new THREE.IcosahedronGeometry(1, detail || 3), p = geo.attributes.position, r = seeded(seed), a = r() * 9, b = r() * 9, c = r() * 9, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize();
    const k = 1 + .1 * Math.sin(v.x * 6 + a) * Math.sin(v.y * 6 + b) * Math.sin(v.z * 6 + c) + .05 * Math.sin(v.x * 13 + b) * Math.sin(v.z * 11 + a);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
  geo.computeVertexNormals(); return geo;
}
function makeTree(tr, i, h, mats) {
  const [x, y, r] = tr, gz = groundY(h, x, y), rnd = seeded(500 + i * 31), g = new THREE.Group(); g.position.set(x, gz, y);
  const sway = new THREE.Group(); g.add(sway);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * .07, r * .12, r * 1.15, 8), mats.bark); trunk.position.y = r * .57; sway.add(trunk);
  for (let k = 0; k < 3; k++) { const a = rnd() * TAU, br = new THREE.Mesh(new THREE.CylinderGeometry(r * .025, r * .045, r * .55, 6), mats.bark);
    br.position.set(Math.cos(a) * r * .14, r * (.85 + rnd() * .2), Math.sin(a) * r * .14); br.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); sway.add(br); }
  const crown = new THREE.Group(); crown.position.y = r * 1.45; sway.add(crown);
  const blobs = [[0, 0, 0, .72], [.42, -.12, .1, .5], [-.38, -.1, -.22, .52], [.05, .32, -.05, .5], [-.12, -.18, .42, .46], [.22, .05, -.42, .44]];
  blobs.forEach(([bx, by, bz, s], k) => { const m = new THREE.Mesh(lumpy(i * 13 + k, 3), mats.leaf); m.position.set(bx * r, by * r, bz * r); m.scale.set(s * r, s * r * .9, s * r); m.rotation.set(rnd() * 3, rnd() * 3, 0); crown.add(m); });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { sway, h: r * 1.6, phase: i * 1.7 };
  return g;
}

/* ---------- building the scene. Three.js axes: X = game x, Y = height, Z = game y ---------- */
function build3D(h) {
  if (three && three.hole === h) return;
  if (!three) {
    const renderer = new THREE.WebGLRenderer({ canvas: $('c3'), antialias: false });
    renderer.setPixelRatio(DPR); renderer.setSize(W, Hh, false); renderer.setClearColor(0xffffff);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: EDGE_VS, fragmentShader: EDGE_FS, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2() }, cn: { value: .3 }, cf: { value: 5000 }, fogNear: { value: 300 }, fogFar: { value: 1500 },
        bayer: { value: BAYER }, dither: { value: C3.dither ? 1 : 0 }, cell: { value: 2 * DPR } } }));
    const edgeScene = new THREE.Scene(); edgeScene.add(edge);
    three = { renderer, camera: new THREE.PerspectiveCamera(50, W / Hh, .3, 5000), edge, edgeScene, edgeCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), normalMat: new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }) };
    makeTargets();
  }
  const scene = new THREE.Scene(); three.scene = scene; three.hole = h;
  scene.background = new THREE.Color(0xffffff); scene.fog = new THREE.Fog(0xffffff, 300, 1500);
  const bb = staticBounds(h, 110), aniso = three.renderer.capabilities.getMaxAnisotropy(); three.bb = bb;
  // light: a strong low-ish sun behind the player's left shoulder, a little sky fill so shade isn't black
  const d = holeDir(h), sa = d + 1.25 * Math.PI, sun = new THREE.DirectionalLight(0xffffff, .78);
  three.sunDir = new THREE.Vector3(Math.cos(sa), 1.15, Math.sin(sa)).normalize();
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
  scene.add(sun, sun.target, new THREE.AmbientLight(0xffffff, .32)); three.sun = sun;
  // ground
  const tex = new THREE.CanvasTexture(paintGround(h, bb, Math.min(4, 4096 / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0)), C3.dither ? 0 : .34)); tex.anisotropy = aniso; three.groundTex = tex;
  const grain = new THREE.CanvasTexture(noiseTile()); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.anisotropy = aniso;
  three.patchU = { grain: { value: grain, type: 'sampler2D' }, mapD: { value: null, type: 'sampler2D' }, dRect: { value: new THREE.Vector4(), type: 'vec4' }, useD: { value: 0, type: 'float' } };
  const groundMat = worldAware(toon(0xffffff, { map: tex }), `
    if (useD > .5) { vec2 q = (vWp.xz - dRect.xy) / (dRect.zw - dRect.xy);
      if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1.) { float e = min(min(q.x, 1. - q.x), min(q.y, 1. - q.y)); diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(mapD, vec2(q.x, 1. - q.y)).rgb, smoothstep(0., .1, e)); } }
    diffuseColor.rgb *= mix(1., texture2D(grain, vWp.xz * .45).r, .38) * mix(1., texture2D(grain, vWp.xz * .07).r, .2);`, three.patchU);
  const STEP = 1, nx = Math.ceil((bb.x1 - bb.x0) / STEP) + 1, ny = Math.ceil((bb.y1 - bb.y0) / STEP) + 1;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = Math.min(bb.x1, bb.x0 + i * STEP), y = Math.min(bb.y1, bb.y0 + j * STEP), k = j * nx + i;
    pos[k * 3] = x; pos[k * 3 + 1] = groundY(h, x, y); pos[k * 3 + 2] = y; uv[k * 2] = (x - bb.x0) / (bb.x1 - bb.x0); uv[k * 2 + 1] = 1 - (y - bb.y0) / (bb.y1 - bb.y0);
  }
  let q = 0; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = e; }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(new THREE.BufferAttribute(idx, 1)); tg.computeVertexNormals();
  const ground = new THREE.Mesh(tg, groundMat); ground.receiveShadow = true; scene.add(ground);
  // the land beyond the hole: a ring of plain rough out to the haze
  const ring = new THREE.Shape([V2(-9000, 9000), V2(9000, 9000), V2(9000, -9000), V2(-9000, -9000)]);
  ring.holes.push(new THREE.Path([V2(bb.x0 + .5, -bb.y0 - .5), V2(bb.x0 + .5, -bb.y1 + .5), V2(bb.x1 - .5, -bb.y1 + .5), V2(bb.x1 - .5, -bb.y0 - .5)]));
  const fg = new THREE.ShapeGeometry(ring); fg.rotateX(-Math.PI / 2);
  const far = new THREE.Mesh(fg, worldAware(toon(0xb9b9b9), 'diffuseColor.rgb *= mix(1., texture2D(grain, vWp.xz * .45).r, .38);', { grain: { value: grain, type: 'sampler2D' } }));
  far.position.y = -.02; far.receiveShadow = true; scene.add(far);
  // the lake: a darker surface whose light ripples drift, like the 2D water pattern
  three.waterU = [];
  h.water.forEach(s => {
    let lv = 0, n = 48; for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(s.rot), sn = Math.sin(s.rot), u = Math.cos(a) * s.rx, v = Math.sin(a) * s.ry; lv += zgAt(h, s.x + u * c - v * sn, s.y + u * sn + v * c); }
    lv = lv / n - .32;
    const geo = new THREE.CircleGeometry(1, 96); geo.rotateX(-Math.PI / 2);
    const wu = { time: { value: 0, type: 'float' } }; three.waterU.push(wu);
    const mat = worldAware(toon(0x8f8f8f), 'float wv = sin(vWp.z * 1.4 + sin(vWp.x * .32 + time * .6) * 1.6 + time * 1.3); diffuseColor.rgb *= 1. + .42 * step(.93, wv) + .12 * step(.6, wv);', wu);
    const m = new THREE.Mesh(geo, mat); m.scale.set(s.rx + .8, 1, s.ry + .8); m.rotation.y = -s.rot; m.position.set(s.x, lv, s.y); m.receiveShadow = true; scene.add(m);
  });
  // trees
  const mats = { leaf: toon(0xcfcfcf), bark: toon(0x8a8a8a) };
  three.trees = h.trees.map((tr, i) => { const t = makeTree(tr, i, h, mats); scene.add(t); return t; });
  // grass tufts in the rough, thick along the line of play and thinner further out
  { const route = [h.tee, ...h.fair.filter(s => s.t === 'c').flatMap(s => s.pts), h.cup], tufts = [], rnd = seeded(99), Ltot = [];
    let L = 0; for (let i = 0; i < route.length - 1; i++) { L += Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]); Ltot.push(L); }
    for (let n = 0; n < 60000 && tufts.length < 42000; n++) {
      let t = rnd() * L, i = Ltot.findIndex(v => v >= t); const a = route[i], b = route[i + 1], s0 = i ? Ltot[i - 1] : 0, u = (t - s0) / ((Ltot[i] - s0) || 1);
      const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, off = (rnd() + rnd() + rnd() - 1.5) * 70;
      const x = a[0] + dx * u - dy / dl * off, y = a[1] + dy * u + dx / dl * off;
      if (x < bb.x0 || x > bb.x1 || y < bb.y0 || y > bb.y1 || surfaceAt(h, x, y) !== 'rough') continue;
      if (h.trees.some(tr => Math.hypot(tr[0] - x, tr[1] - y) < tr[2] * .15)) continue;
      tufts.push([x, y]);
    }
    // tufts are texture, not shapes: they stay out of the outline pass (no depth written, hidden for the normal pass)
    const im = new THREE.InstancedMesh(tuftGeometry(), toon(0xb4b4b4, { side: THREE.DoubleSide, depthWrite: false }), tufts.length), o = new THREE.Object3D();
    tufts.forEach(([x, y], k) => { o.position.set(x, groundY(h, x, y), y); o.rotation.set(0, rnd() * TAU, 0); const sc = .7 + rnd() * .9; o.scale.set(sc, sc * (.8 + rnd() * .6), sc); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
    im.receiveShadow = true; im.renderOrder = 2; scene.add(im); three.tufts = im; }
  // tee markers, yardage discs, cup and flag
  const ink = toon(0x2a2a2a), white = toon(0xf4f4f4);
  [-4, 4].forEach(dx => { const tx = h.tee[0] + dx, ty = h.tee[1] - 1.5, m = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 10), ink); m.position.set(tx, groundY(h, tx, ty) + .14, ty); m.castShadow = true; scene.add(m); });
  markers(h).forEach(mk => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .08, 20), mk.D === 100 ? ink : mk.D === 150 ? toon(0x777777) : white); m.position.set(mk.x, groundY(h, mk.x, mk.y) + .03, mk.y); m.receiveShadow = true; scene.add(m); });
  const [cx, cy] = h.cup, cz = groundY(h, cx, cy);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(.3, 28), new THREE.MeshBasicMaterial({ color: 0x111111 })); cup.rotation.x = -Math.PI / 2; cup.position.set(cx, cz + .015, cy); scene.add(cup);
  const liner = new THREE.Mesh(new THREE.RingGeometry(.3, .36, 28), white); liner.rotation.x = -Math.PI / 2; liner.position.set(cx, cz + .02, cy); scene.add(liner);
  const flag = new THREE.Group(); flag.position.set(cx, cz, cy);
  const spring = new THREE.Group(); flag.add(spring);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.6, 8), ink); pole.position.y = 1.3; pole.castShadow = true; spring.add(pole);
  const fc = document.createElement('canvas'); fc.width = 192; fc.height = 120; const fx = fc.getContext('2d');
  fx.fillStyle = '#f4f4f4'; fx.fillRect(0, 0, 192, 120); fx.fillStyle = '#111'; fx.font = 'italic 900 84px Fraunces, Georgia, serif'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(String(S.hole + 1), 96, 66);
  const clothGeo = new THREE.PlaneGeometry(1.15, .72, 12, 2); clothGeo.translate(.575, 0, 0);
  const cloth = new THREE.Mesh(clothGeo, toon(0xffffff, { map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide })); cloth.position.y = 2.24; cloth.castShadow = true; spring.add(cloth);
  scene.add(flag);
  // the ball: a seam line so you can see it roll, nested groups so squash, stretch and spin stay independent
  const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64; const bx = bc.getContext('2d'); bx.fillStyle = '#fff'; bx.fillRect(0, 0, 128, 64);
  bx.strokeStyle = '#222'; bx.lineWidth = 3; bx.beginPath(); for (let i = 0; i <= 128; i++) { const y = 32 + Math.sin(i / 128 * TAU * 2) * 10; i ? bx.lineTo(i, y) : bx.moveTo(i, y); } bx.stroke();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), toon(0xffffff, { map: new THREE.CanvasTexture(bc) })); ballMesh.castShadow = true;
  const ballSquash = new THREE.Group(), ballStretch = new THREE.Group(), ballSpin = new THREE.Group(); ballSquash.add(ballStretch); ballStretch.add(ballSpin); ballSpin.add(ballMesh); scene.add(ballSquash);
  Object.assign(three, { flag, spring, cloth, clothBase: clothGeo.attributes.position.array.slice(), ballSquash, ballStretch, ballSpin, ballMesh, lastBall: null });
  C3.ready = true;
}
const V2 = (x, y) => new THREE.Vector2(x, y);
/* a sharp patch of the ground around the ball (and the green when it's close), repainted for every shot */
function sharpenAround(x, y) {
  if (!three || !three.patchU) return; const h = H(), R = 55;
  const dg = Math.hypot(h.cup[0] - x, h.cup[1] - y), cx = dg < R * 1.4 ? (x + h.cup[0]) / 2 : x, cy = dg < R * 1.4 ? (y + h.cup[1]) / 2 : y;
  const bb = { x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R }, u = three.patchU;
  const t = new THREE.CanvasTexture(paintGround(h, bb, 18, C3.dither ? 0 : .09)); t.anisotropy = three.renderer.capabilities.getMaxAnisotropy();
  if (u.mapD.value) u.mapD.value.dispose(); u.mapD.value = t; u.dRect.value.set(bb.x0, bb.y0, bb.x1, bb.y1); u.useD.value = 1;
}
{ const base = resize; resize = function () { base(); if (three) { three.renderer.setPixelRatio(DPR); three.renderer.setSize(W, Hh, false); three.camera.aspect = W / Hh; three.camera.updateProjectionMatrix(); makeTargets(); } }; }

/* ---------- world to screen for the 2D overlays (aim line, tempo ring, labels): z is height above the ground ---------- */
const _v = new THREE.Vector3();
function WS3(x, y, z = 0) {
  _v.set(x, groundY(H(), x, y) + z, y).project(three.camera);
  if (_v.z > 1) return [-1e4, -1e4];
  return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * Hh];
}
function pxPerYard(x, y) { const a = WS3(x, y), b = WS3(x, y, 1); return Math.max(.5, Math.hypot(a[0] - b[0], a[1] - b[1])); }

/* ---------- camera ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const holeDir = h => Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]);
function aimCamera(b, h) {
  const putt = CLUBS[S.club].putter, f = V(Math.cos(C3.yaw), 0, Math.sin(C3.yaw)), gz = groundY(h, b.x, b.y), z = C3.zoom;
  const back = (putt ? 5 : 12) * z, up = (putt ? 2.6 : 4.2) * z, ahead = putt ? Math.min(12, distToCup() + 1.5) : 30;
  return { pos: V(b.x - f.x * back, gz + up, b.y - f.z * back), look: V(b.x + f.x * ahead, gz, b.y + f.z * ahead) };
}
// Aerial: looking down at the course from high up, always turned so the hole runs up the screen.
function overhead(h, cx, cy, span) { const d = holeDir(h), gz = groundY(h, cx, cy);
  return { pos: V(cx - Math.cos(d) * span * .5, gz + span * 1.05, cy - Math.sin(d) * span * .5), look: V(cx, gz, cy) }; }
function aerialAim(b, h) {
  const c = CLUBS[S.club], r = c.putter ? Math.max(5, distToCup() * 1.15) : Math.min(reachFor(c, lieNow()), distToCup() * 1.1);
  const span = Math.max(c.putter ? 10 : 22, r * 1.3) * C3.zoom; C3.span = span;
  return overhead(h, b.x + Math.cos(C3.yaw) * r * .45, b.y + Math.sin(C3.yaw) * r * .45, span);
}
function aerialCamera(h) {
  const bb = three.bb, c = V((bb.x0 + bb.x1) / 2, 0, (bb.y0 + bb.y1) / 2), d = holeDir(h);
  return { pos: V(c.x - Math.cos(d) * 300 - Math.sin(d) * 120, 260, c.z - Math.sin(d) * 300 + Math.cos(d) * 120), look: c };
}
// Follow-through: the camera rides a slightly springy rig, like the 2D camera, so moves overshoot a touch and settle.
const camVel = { p: new THREE.Vector3(), l: new THREE.Vector3() };
function springTo(cur, vel, tgt, dt, k, c) { vel.x += (k * (tgt.x - cur.x) - c * vel.x) * dt; vel.y += (k * (tgt.y - cur.y) - c * vel.y) * dt; vel.z += (k * (tgt.z - cur.z) - c * vel.z) * dt; cur.addScaledVector(vel, dt); }
function updateCamera(t, dt) {
  const b = S.ball, h = H(), cam3 = three.camera; let tgt, snap = false, k = 24, c = 8.2;
  if (S.state === 'aim' && look.on) { tgt = aerialCamera(h); k = 10; c = 6.5; }
  else if (S.state === 'intro') {   // slow in, slow out from the green back to the ball
    const I = S.intro, u = easeIO(Math.max(0, Math.min(1, (I.t - 1.2) / 2.6))), g = h.green[0], a = C3.mode === 'aerial' ? aerialAim(b, h) : aimCamera(b, h), gz = groundY(h, g.x, g.y), d = holeDir(h);
    const from = { pos: V(g.x - Math.cos(d) * 45, gz + 26, g.y - Math.sin(d) * 45), look: V(g.x, gz, g.y) };
    tgt = { pos: from.pos.clone().lerp(a.pos, u), look: from.look.clone().lerp(a.look, u) }; snap = true;
  }
  else if (S.slow < .8 && (S.state === 'flight' || S.state === 'sunk')) {   // the ball is tracking into the cup: drop in low and close
    const dx = h.cup[0] - b.x, dy = h.cup[1] - b.y, dl = Math.hypot(dx, dy) || 1, gz = groundY(h, h.cup[0], h.cup[1]);
    tgt = { pos: V(b.x - dx / dl * 3.2, gz + 1.1, b.y - dy / dl * 3.2), look: V((b.x + h.cup[0]) / 2, gz, (b.y + h.cup[1]) / 2) }; k = 14; c = 7;
  }
  else if ((S.state === 'flight' || S.state === 'ghost') && C3.mode === 'aerial') { tgt = overhead(h, b.x, b.y, Math.max(C3.span, 24)); k = 9; c = 6; }
  else if (S.state === 'flight' || S.state === 'ghost') {
    const sp = Math.hypot(b.vx, b.vy), f = sp > .5 ? V(b.vx / sp, 0, b.vy / sp) : V(Math.cos(C3.yaw), 0, Math.sin(C3.yaw)), gz = groundY(h, b.x, b.y), hz = Math.max(0, b.z - zgAt(h, b.x, b.y));
    const back = b.mode === 'air' ? 24 + hz * .4 : 12, up = b.mode === 'air' ? 7 + hz * .55 : 5;
    tgt = { pos: V(b.x - f.x * back, gz + up, b.y - f.z * back), look: V(b.x + f.x * 6, gz + hz * .9, b.y + f.z * 6) }; k = b.mode === 'air' ? 7 : 11; c = 5.6;
  }
  else if (S.state === 'aim') tgt = C3.mode === 'aerial' ? aerialAim(b, h) : aimCamera(b, h);
  else tgt = { pos: C3.pos.clone(), look: C3.look.clone() };
  if (snap || (C3.lastState !== S.state && S.state === 'intro')) { C3.pos.copy(tgt.pos); C3.look.copy(tgt.look); camVel.p.set(0, 0, 0); camVel.l.set(0, 0, 0); }
  else { const st = Math.min(dt, 1 / 30); springTo(C3.pos, camVel.p, tgt.pos, st, k, c); springTo(C3.look, camVel.l, tgt.look, st, k, c); }
  cam3.position.copy(C3.pos); cam3.lookAt(C3.look);
  // impact shake (smaller with reduced motion), scaled to how far away we're looking
  const sk = S.shake * (RM ? .15 : 1) * C3.pos.distanceTo(C3.look) * .0011;
  if (sk > .0005) { cam3.position.x += (Math.random() - .5) * sk; cam3.position.y += (Math.random() - .5) * sk; cam3.position.z += (Math.random() - .5) * sk; }
  C3.lastState = S.state;
}

/* ---------- the animation principles, per frame ---------- */
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _axis = new THREE.Vector3();
function animateBall(t, dt, h) {
  const b = S.ball, T = three, dist = three.camera.position.distanceTo(T.ballSquash.position), br = Math.max(.06, dist * .0062);
  const hz = Math.max(0, b.z - zgAt(h, b.x, b.y)), lift = shapeOffset(h, b.x, b.y) * Math.max(0, 1 - hz / 3);
  let x = b.x, y = b.z + lift, z = b.y, scale = 1;
  // holed: slide to the centre and drop out of sight with a little squash
  if (b.mode === 'sunk') { const u = Math.min(1, S.sinkT / .16); x = b.sx + (h.cup[0] - b.sx) * u; z = b.sy + (h.cup[1] - b.sy) * u; y = groundY(h, x, z) - Math.max(0, S.sinkT - .1) * 3; scale = Math.max(0, 1 - Math.max(0, S.sinkT - .12) / .22); }
  T.ballSquash.visible = b.mode !== 'gone' && scale > 0;
  // stretch along the direction of travel in the air and on the roll; squash against the pull while you swing (anticipation)
  let k = 0, stretch = true; _dir.set(0, 1, 0);
  if (b.mode === 'air') { _dir.set(b.vx, b.vz, b.vy); const sp = _dir.length(); if (sp > .01) _dir.divideScalar(sp); k = Math.min(.45, sp / 90); }
  else if (b.mode === 'roll') { _dir.set(b.vx, 0, b.vy); const sp = _dir.length(); if (sp > .01) _dir.divideScalar(sp); k = Math.min(.25, sp / 40); }
  else if (drag && S.state === 'aim') { const d = dragInfo(); _dir.set(Math.cos(d.ang), 0, Math.sin(d.ang)); k = d.power * .32; stretch = false;
    if (d.power > .85) { const j = (d.power - .85) * 7 * br; x += (Math.random() - .5) * j; z += (Math.random() - .5) * j; } }   // trembling at full power
  _q.setFromUnitVectors(_up, _dir); T.ballStretch.quaternion.copy(_q);
  if (stretch) T.ballStretch.scale.set(1 / Math.sqrt(1 + k), 1 + k, 1 / Math.sqrt(1 + k)); else T.ballStretch.scale.set(1 + k * .45, 1 - k * .55, 1 + k * .45);
  // the springy squash from impacts and landings (the same S.sq the 2D ball uses), kept upright
  T.ballSquash.scale.set(br * (1 + S.sq) * scale, br * (1 - S.sq * .8) * scale, br * (1 + S.sq) * scale);
  T.ballSquash.position.set(x, y + br * .95 * (1 - S.sq * .8) * scale, z);
  // spin: roll the seam with the distance travelled (secondary action)
  if (T.lastBall) { const mx = x - T.lastBall.x, mz = z - T.lastBall.z, md = Math.hypot(mx, mz);
    if (md > 1e-4 && md < 30) { _axis.set(mz, 0, -mx).normalize(); T.ballSpin.quaternion.premultiply(_q.setFromAxisAngle(_axis, md / Math.max(br, .05) * (b.mode === 'air' ? .25 : 1))); } }
  T.lastBall = { x, z };
}
function animateWorld(t, dt, h) {
  const T = three, w = S.wind, wl = Math.hypot(w.x, w.y) || 1, wx = w.x / wl, wz = w.y / wl;
  // trees sway with the wind, each on its own beat
  T.trees.forEach(tr => { const u = tr.userData, a = Math.sin(t * 1.3 + u.phase) * (.25 + w.mph * .03) / u.h + w.mph * .0015;
    u.sway.rotation.z = -wx * a; u.sway.rotation.x = wz * a; });
  // flag: springs and stretches when the ball drops (S.fp, follow-through), streams with the wind, grows with distance so you can find it
  const fd = T.camera.position.distanceTo(T.flag.position); T.flag.scale.setScalar(Math.max(1, fd / 55));
  T.spring.scale.set(1 / Math.sqrt(1 + S.fp), 1 + S.fp, 1 / Math.sqrt(1 + S.fp));
  T.flag.rotation.y = -Math.atan2(w.y, w.x || 1e-6);
  { const p = T.cloth.geometry.attributes.position, base = T.clothBase, amp = .05 + w.mph * .007;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3], yb = base[i * 3 + 1]; p.setZ(i, Math.sin(t * (4 + w.mph * .3) - x * 6 + yb) * amp * x); p.setY(i, yb - x * x * Math.max(0, .12 - w.mph * .008)); }
    p.needsUpdate = true; T.cloth.geometry.computeVertexNormals(); }
  T.waterU.forEach(u => { u.time.value += dt; });   // the lake's ripples drift
  // shadows follow the camera's area of interest
  const look = C3.look, span = Math.max(60, Math.min(420, T.camera.position.distanceTo(look) * 1.3)), s = T.sun.shadow.camera;
  T.sun.target.position.copy(look); T.sun.position.copy(look).addScaledVector(T.sunDir, 400);
  if (s.right !== span) { s.left = -span; s.right = span; s.top = span; s.bottom = -span; s.near = 1; s.far = 900; s.updateProjectionMatrix(); }
}

/* ---------- each frame: colour pass, normal pass, outline composite, then the game's 2D overlays ---------- */
draw = function (t, dt) {
  if (!three || !three.scene) return;
  const h = H(), b = S.ball, T = three, r = T.renderer;
  updateCamera(t, dt); animateBall(t, dt, h); animateWorld(t, dt, h);
  r.shadowMap.needsUpdate = true;
  r.setRenderTarget(T.rtC); r.render(T.scene, T.camera);
  T.tufts.visible = false; T.scene.overrideMaterial = T.normalMat; const bg = T.scene.background, fog = T.scene.fog; T.scene.background = new THREE.Color(.5, .5, 1); T.scene.fog = null;
  r.setRenderTarget(T.rtN); r.render(T.scene, T.camera);
  T.scene.overrideMaterial = null; T.scene.background = bg; T.scene.fog = fog; T.tufts.visible = true;
  r.setRenderTarget(null); r.render(T.edgeScene, T.edgeCam);
  // overlays
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, Hh); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const real = WS; WS = WS3;
  try {
    const c = CLUBS[S.club], reach = c.putter ? Math.min(distToCup(), 30) : Math.min(reachFor(c, lieNow()), distToCup());
    cam.z = S.state === 'aim' ? pxPerYard(b.x + Math.cos(C3.yaw) * reach * .6, b.y + Math.sin(C3.yaw) * reach * .6) : pxPerYard(b.x, b.y);
    drawParts(dt, true);
    if (S.state === 'aim' && !look.on) drawAim(t);
    drawTrail();
    drawParts(dt, false);
  } finally { WS = real; }
};

/* ---------- controls: arrows or right-drag turn, scroll zooms; these take over from the desktop page's map and pan ---------- */
addEventListener('wheel', e => { if (e.target !== cv) return; e.preventDefault(); e.stopPropagation();
  C3.zoom = Math.max(.45, Math.min(3, C3.zoom * Math.exp(e.deltaY * .0012))); }, { capture: true, passive: false });
addEventListener('pointerdown', e => { if (e.target !== cv || (e.button !== 2 && e.button !== 1)) return; e.stopPropagation(); e.preventDefault();
  if (S.state === 'aim' && !drag) C3.yawDrag = { x: e.clientX, id: e.pointerId }; }, true);
addEventListener('pointermove', e => { if (C3.yawDrag && e.pointerId === C3.yawDrag.id) { C3.yaw += (e.clientX - C3.yawDrag.x) * .005; C3.yawDrag.x = e.clientX; } }, true);
addEventListener('pointerup', e => { if (C3.yawDrag && e.pointerId === C3.yawDrag.id) { C3.yawDrag = null; e.stopPropagation(); } }, true);
addEventListener('keydown', e => {
  if (!$('card').hidden || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key;
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'A' || k === 'd' || k === 'D') {
    e.preventDefault(); e.stopPropagation(); if (S.state !== 'aim' || drag) return;
    C3.yaw += (k === 'ArrowLeft' || k === 'a' || k === 'A' ? -1 : 1) * (e.shiftKey ? .004 : .025); updHUD(); }
}, true);
function setView(m, quiet) {
  C3.mode = m; try { localStorage.setItem('inknine-view', m); } catch (_) {}
  $('viewBtn').firstChild.textContent = m === 'aerial' ? 'Behind the ball' : 'Aerial view';
  $('viewBtn').setAttribute('aria-label', m === 'aerial' ? 'Switch to the view from behind the ball' : 'Switch to the aerial view');
  $('hint').firstElementChild.textContent = m === 'aerial'
    ? 'Pick a club, then click and drag back, away from where you want the ball to go. Let go to swing.'
    : 'Turn with the arrow keys, pick a club, then click and drag straight down. Let go to swing.';
  if (!quiet) { sfx('tick'); tone(m === 'aerial' ? 780 : 520, .16, 'sine', .07, m === 'aerial' ? 1040 : 390); }
}
$('viewBtn').addEventListener('click', () => { audioInit(); if (look.on) exitLook(); setView(C3.mode === 'aerial' ? 'behind' : 'aerial'); $('viewBtn').blur(); });
addEventListener('keydown', e => { if ((e.key === 'v' || e.key === 'V') && $('card').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $('viewBtn').click(); } });
{ let m = 'behind'; try { m = localStorage.getItem('inknine-view') || 'behind'; } catch (_) {} setView(m === 'aerial' ? 'aerial' : 'behind', true); }
$('lookhint').firstElementChild.textContent = 'The whole hole from above. Press Space to go back.';
// dithering on or off: B or the button; remembered between visits
function setDither(on, quiet) {
  C3.dither = on; try { localStorage.setItem('inknine-dither', on ? '1' : '0'); } catch (_) {}
  if (three) { three.edge.material.uniforms.dither.value = on ? 1 : 0;
    if (three.groundTex && !quiet) {   // repaint the ground with or without its ink lines
      const h = H(), bb = three.bb; three.groundTex.image = paintGround(h, bb, Math.min(4, 4096 / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0)), on ? 0 : .34); three.groundTex.needsUpdate = true;
      sharpenAround(S.ball.x, S.ball.y); } }
  const b = $('ditherBtn'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  if (!quiet) { sfx('tick'); tone(on ? 900 : 600, .12, 'square', .04, on ? 450 : 1200); }
}
$('ditherBtn').addEventListener('click', () => { audioInit(); setDither(!C3.dither); $('ditherBtn').blur(); });
addEventListener('keydown', e => { if ((e.key === 'b' || e.key === 'B') && $('card').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $('ditherBtn').click(); } });
{ let on = false; try { on = localStorage.getItem('inknine-dither') === '1'; } catch (_) {} setDither(on, true); }
