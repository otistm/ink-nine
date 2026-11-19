/* Ink Nine 3D prototype: one hole (Meadowbrook 3, Long Way Round) played in 3D.
   The real game runs underneath: swing, tempo, curve, wind, physics, scoring and cards are the phone game's own.
   This file only swaps how it is seen: a realistic 3D course shown in black and white, and the 2D game's animation
   (squash and stretch, anticipation, follow-through, springy camera, shake) carried into 3D.
   Loaded after desk.js and Three.js, before main.js. */
"use strict";

const P3_COURSE = 0, P3_HOLE = 2;
const C3 = { mode: 'aerial', span: 60, yaw: 0, zoom: 1, ready: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), lastState: '', yawDrag: null };
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
   THE LOOK: as real as we can make it. A real golf-course sky photo lights the scene, the ground uses
   real grass and sand textures, hundreds of thousands of grass blades sway around the ball, trees are
   grown branch by branch with real bark and thousands of leaves, and a final pass shows it in black and
   white (or colour, or 1-bit dither). Ball physics still runs on the game's own ground; the bunkers,
   greens, tee and lake are shaped on top of it for the eye only.
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

/* ---------- real assets (CC0, Poly Haven), loaded once ---------- */
const ASSET = '/desktop/3d/assets/';
const texLoader = new THREE.TextureLoader();
function assetTex(path, srgb) { const t = texLoader.load(ASSET + path); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
const TEX = {
  grass: assetTex('aerial_grass_rock/aerial_grass_rock_diff_1k.jpg', true), grassN: assetTex('aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg'), grassR: assetTex('aerial_grass_rock/aerial_grass_rock_rough_1k.jpg'),
  sand: assetTex('aerial_sand/aerial_sand_diff_1k.jpg', true), sandN: assetTex('aerial_sand/aerial_sand_nor_gl_1k.jpg'),
  bark: assetTex('bark_willow/bark_willow_diff_1k.jpg', true), barkN: assetTex('bark_willow/bark_willow_nor_gl_1k.jpg')
};

/* ---------- the splat map: which surface is where, painted from the game's own shapes ----------
   R = how lush and light the grass is (rough darkest, green lightest, mowing stripes, shade under trees)
   G = sand, B = short-mown grass. Water is its own surface. */
function paintSplat(h, bb, ppy) {
  const w = Math.round((bb.x1 - bb.x0) * ppy), hgt = Math.round((bb.y1 - bb.y0) * ppy), d = holeDir(h);
  const P = (x, y) => [(x - bb.x0) * ppy, (y - bb.y0) * ppy];
  const out = document.createElement('canvas'); out.width = w; out.height = hgt; const g = out.getContext('2d');
  const scratch = document.createElement('canvas'); scratch.width = w; scratch.height = hgt; const sg = scratch.getContext('2d');
  const shapePath = (c, s, grow = 0) => {
    if (s.t === 'e') { const [x, y] = P(s.x, s.y); c.beginPath(); c.ellipse(x, y, (s.rx + grow) * ppy, (s.ry + grow) * ppy, s.rot, 0, TAU); c.fill(); }
    else if (s.t === 'c') { const pts = s.poly || s.pts; c.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.lineWidth = 2 * (s.r + grow) * ppy; c.lineCap = c.lineJoin = 'round'; c.stroke(); }
    else if (s.t === 'r') { const [x0, y0] = P(s.x0 - grow, s.y0 - grow), [x1, y1] = P(s.x1 + grow, s.y1 + grow); c.fillRect(x0, y0, x1 - x0, y1 - y0); }
  };
  const stripes = (c, a, b, width, ang) => { c.fillStyle = a; c.fillRect(0, 0, w, hgt); c.save(); c.translate(w / 2, hgt / 2); c.rotate(ang); c.fillStyle = b;
    const L = Math.hypot(w, hgt), bw = width * ppy; for (let x = -L; x < L; x += bw * 2) c.fillRect(x, -L, bw, L * 2); c.restore(); };
  // a layer: mask of shapes (softened at the edge by a blur), filled with its own paint
  const layer = (shapes, grow, soft, paint) => {
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, w, hgt); sg.filter = soft ? `blur(${soft * ppy}px)` : 'none';
    sg.fillStyle = sg.strokeStyle = '#000'; shapes.forEach(s => shapePath(sg, s, grow)); sg.filter = 'none'; sg.globalCompositeOperation = 'source-in'; paint(sg); g.drawImage(scratch, 0, 0);
  };
  // checkerboard mowing: square cells turned to the line of play, alternating light and dark
  const checks = (c, a, b, cellYd, ang) => { c.fillStyle = a; c.fillRect(0, 0, w, hgt); c.save(); c.translate(w / 2, hgt / 2); c.rotate(ang); c.fillStyle = b;
    const L = Math.hypot(w, hgt), cs = cellYd * ppy; for (let x = -L, i = 0; x < L; x += cs, i++) for (let y = -L, j = 0; y < L; y += cs, j++) if ((i + j) % 2) c.fillRect(x, y, cs + .5, cs + .5); c.restore(); };
  // a ring just inside a group of shapes (the mower's clean-up lap around a green)
  const ring = (shapes, inset, width, col) => {
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, w, hgt); sg.fillStyle = sg.strokeStyle = '#000';
    shapes.forEach(s => shapePath(sg, s, -inset)); sg.globalCompositeOperation = 'destination-out'; shapes.forEach(s => shapePath(sg, s, -inset - width));
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, w, hgt); g.drawImage(scratch, 0, 0);
  };
  g.fillStyle = 'rgb(108,0,0)'; g.fillRect(0, 0, w, hgt);                                      // rough: darkest
  layer(h.fair, 2.2, .5, c => { c.fillStyle = 'rgb(150,0,70)'; c.fillRect(0, 0, w, hgt); });     // first cut
  layer(h.fair, 0, .12, c => stripes(c, 'rgb(226,0,255)', 'rgb(168,0,255)', 8, d));             // fairway: bold, crisp stripes
  const fringe = h.green.map(s => ({ ...s, rx: s.rx + 1.8, ry: s.ry + 1.8 }));
  layer(fringe, 0, .15, c => { c.fillStyle = 'rgb(210,0,255)'; c.fillRect(0, 0, w, hgt); });    // collar
  layer(h.green, 0, .1, c => checks(c, 'rgb(250,0,255)', 'rgb(222,0,255)', 2.6, d + Math.PI / 4)); // green: checkerboard
  ring(h.green, .45, .8, 'rgb(214,0,255)');                                                      // clean-up lap
  layer([TEE_RECT(h)], 0, .1, c => stripes(c, 'rgb(236,0,255)', 'rgb(206,0,255)', 1.4, d + Math.PI / 2));
  layer(h.sand, 0, .15, c => { c.fillStyle = 'rgb(200,255,0)'; c.fillRect(0, 0, w, hgt); });
  // soft shade on the grass under each tree's crown
  g.globalCompositeOperation = 'multiply';
  h.trees.forEach(tr => { const [x, y] = P(tr[0], tr[1]), rr = tr[2] * 1.3 * ppy, gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgb(150,255,255)'); gr.addColorStop(1, 'rgb(255,255,255)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); });
  g.globalCompositeOperation = 'source-over';
  return out;
}

/* ---------- materials that know where they are in the world ---------- */
function worldAware(mat, opts) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, opts.uniforms || {});
    const decl = Object.entries(opts.uniforms || {}).map(([k, u]) => `uniform ${u.type} ${k};`).join('\n');
    sh.vertexShader = 'varying vec3 vWp;\n' + (opts.varyings || '') + '\n' + decl + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (opts.vertex || '') +
      '\n#ifdef USE_INSTANCING\n vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;\n#else\n vWp = (modelMatrix * vec4(transformed, 1.)).xyz;\n#endif');
    sh.fragmentShader = 'varying vec3 vWp;\n' + (opts.varyings || '') + '\n' + decl + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + (opts.afterMap || ''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (opts.afterNormal || ''))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (opts.afterRough || ''));
  };
  return mat;
}
const U = { time: { value: 0, type: 'float' }, wind: { value: new THREE.Vector2(), type: 'vec2' } };   // shared by grass, leaves and water

/* ---------- grass: hundreds of thousands of real blades around the ball, swaying in the wind ---------- */
function bladeGeometry() {
  const segs = 4, pos = [], nrm = [], idx = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs, w = .045 * (1 - t * .9), z = t * t * .3; pos.push(-w, t, z, w, t, z); nrm.push(0, 1, 0, 0, 1, 0); }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx); return g;
}
const GRASS_MAX = 320000;
function grassMesh() {
  const mat = worldAware(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, side: THREE.DoubleSide }), { uniforms: U,
    vertex: 'float hgt = position.y * position.y; vec3 ip = vec3(instanceMatrix[3].x, 0., instanceMatrix[3].z);\n' +
      'float gust = sin(time * 1.7 + ip.x * .23 + ip.z * .19) * .5 + .5;\n' +
      'transformed.x += (sin(time * 3.1 + ip.x * 1.7 + ip.z * 1.3) * .18 + wind.x * (.4 + gust)) * hgt;\n' +
      'transformed.z += (cos(time * 2.7 + ip.z * 1.9) * .14 + wind.y * (.4 + gust)) * hgt;' });
  const im = new THREE.InstancedMesh(bladeGeometry(), mat, GRASS_MAX); im.count = 0; im.frustumCulled = false; im.receiveShadow = true;
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRASS_MAX * 3), 3);
  return im;
}
function growGrass(cx, cy) {
  const T = three, h = H(), im = T.grass, m = im.instanceMatrix.array, col = im.instanceColor.array, rnd = seeded(Math.abs(Math.round(cx * 31 + cy * 17)) % 99991 + 7), R = 42;
  let n = 0;
  for (let k = 0; k < 520000 && n < GRASS_MAX; k++) {
    const x = cx + (rnd() * 2 - 1) * R, y = cy + (rnd() * 2 - 1) * R, dd = Math.hypot(x - cx, y - cy); if (dd > R) continue;
    const s = surfaceAt(h, x, y); let ht;
    if (s === 'rough') ht = .09 + rnd() * .11;
    else if ((s === 'fairway' || s === 'fringe' || s === 'tee') && dd < 14) ht = .028 + rnd() * .018;
    else continue;
    const a = rnd() * TAU, c = Math.cos(a), sn = Math.sin(a), sc = ht, o = n * 16;
    m[o] = c * sc; m[o + 1] = 0; m[o + 2] = -sn * sc; m[o + 3] = 0; m[o + 4] = 0; m[o + 5] = sc; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = sn * sc; m[o + 9] = 0; m[o + 10] = c * sc; m[o + 11] = 0; m[o + 12] = x; m[o + 13] = groundY(h, x, y); m[o + 14] = y; m[o + 15] = 1;
    const dry = rnd(), v = .75 + rnd() * .5;   // greens with a few dry, straw-coloured blades
    col[n * 3] = (dry > .93 ? .42 : .12 + rnd() * .08) * v; col[n * 3 + 1] = (dry > .93 ? .38 : .26 + rnd() * .1) * v; col[n * 3 + 2] = (dry > .93 ? .16 : .05 + rnd() * .04) * v;
    n++;
  }
  im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
}

/* ---------- trees: modelled in Blender (desktop/3d/assets/trees), four species, with soft shading baked in ----------
   Each file holds a "bark" mesh and a "leaves" mesh (cards cut out of leaf_atlas.png). Their vertex colours carry
   the baked shading: inner leaves and the underside of the crown are darker. Crown radius is about 1 unit. */
const TREE_KINDS = ['oak_a', 'oak_b', 'birch', 'pine'];
let TREE_GEO = null;   // filled once the files arrive
function loadTreeFiles() {
  if (TREE_GEO || !THREE.GLTFLoader) return Promise.resolve(TREE_GEO);
  const loader = new THREE.GLTFLoader();
  return Promise.all(TREE_KINDS.map(k => new Promise(res => loader.load(ASSET + 'trees/' + k + '.glb', gl => {
    const parts = {}; gl.scene.traverse(o => { if (o.isMesh) { const n = (o.name + ' ' + (o.geometry.name || '')).toLowerCase(); if (n.includes('bark')) parts.bark = o.geometry; else if (n.includes('leaves')) parts.leaves = o.geometry; } });
    res(parts);
  }, undefined, () => res({}))))).then(list => { TREE_GEO = list; return list; });
}

/* ---------- render target and the final pass: exposure, filmic tone, then colour, grey or 1-bit dither ---------- */
const BAYER = (() => { const m = [[0]]; let M = m;
  for (let n = 1; n < 8; n *= 2) { const N = []; for (let y = 0; y < n * 2; y++) { N.push([]); for (let x = 0; x < n * 2; x++) N[y].push(4 * M[y % n][x % n] + [[0, 2], [3, 1]][(y / n) | 0][(x / n) | 0]); } M = N; }
  const d = new Uint8Array(64 * 3); for (let i = 0; i < 64; i++) { const v = Math.round((M[(i / 8) | 0][i % 8] + .5) / 64 * 255); d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = v; }
  const t = new THREE.DataTexture(d, 8, 8, THREE.RGBFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
// The styles you can flip between with [ and ]. "depth" styles also read how far away each pixel is, to draw outlines.
// 8-bit palettes (hex), and the style's dials: pixel size (page pixels), palette, dither strength
const PALETTES = {
  'Retro 16': ['141b1f', '2b3a2e', '3f6b3a', '5f9e3e', '9fcf5a', 'e7f2a5', 'f4f1de', 'c9b57a', '7a5634', '4b3527', '2f5d8c', '5aa0d6', '627c30', 'ffffff', 'c0473b', 'f0c23b'],
  'Pocket 4': ['0f380f', '306230', '8bac0f', '9bbc0f'],
  'Dusk 8': ['1b1029', '3d2149', '6b2f5b', 'a8435a', 'e0704c', 'f2b35e', 'f7e3a1', '5b7fa6']
};
const BIT = { px: 2, pal: 'Retro 16', d: .7 };
const palUniform = name => { const a = []; for (let i = 0; i < 16; i++) { const hx = PALETTES[name][Math.min(i, PALETTES[name].length - 1)]; a.push(new THREE.Color('#' + hx)); } return a; };
// The look: the 3D scene is shrunk into chunky pixels, each snapped to a small palette with ordered dithering between colours.
const POST_FS = `
uniform sampler2D tColor, bayer; uniform float cell, exposure, bitPx, bitN, bitD; uniform vec3 pal[16]; uniform vec2 res; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 tone(vec2 uv){ return pow(aces(texture2D(tColor, uv).rgb * exposure), vec3(1. / 2.2)); }
void main(){
  float P = bitPx * cell * .5; vec2 cellXY = floor(gl_FragCoord.xy / P);
  vec3 c = tone((cellXY * P + P * .5) / res);
  float t = texture2D(bayer, cellXY / 8.).r - .5;
  c = clamp(c + t * bitD * (bitN > 6. ? .18 : .34), 0., 1.);
  float best = 1e9; vec3 pick = pal[0];
  for (int i = 0; i < 16; i++) { if (float(i) >= bitN) break; vec3 d = (c - pal[i]) * vec3(.3, .59, .11); float dd = dot(d, d) + dot(c - pal[i], c - pal[i]) * .15; if (dd < best) { best = dd; pick = pal[i]; } }
  gl_FragColor = vec4(pick, 1.);
}`;
function makeTargets() {
  const w = Math.round(W * DPR), hh = Math.round(Hh * DPR), opts = { type: THREE.HalfFloatType };
  if (three.rt) three.rt.dispose();
  three.rt = three.renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(w, hh, opts) : new THREE.WebGLRenderTarget(w, hh, opts);
  if (three.rt.samples !== undefined) three.rt.samples = 4;
  const u = three.post.material.uniforms; u.cell.value = 2 * DPR; u.res.value.set(w, hh); u.tColor.value = three.rt.texture;
}

/* ---------- the sky: a real golf course HDR photo lights the scene; the sun is found in it ---------- */
function halfToFloat(h) { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * Math.pow(2, -14) * f / 1024 : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024); }
function loadSky() {
  if (!THREE.RGBELoader) return;
  new THREE.RGBELoader().setDataType(THREE.HalfFloatType).load(ASSET + 'sky/limpopo_golf_course_2k.hdr', t => {
    const T = three; t.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(T.renderer); T.envMap = pm.fromEquirectangular(t).texture; pm.dispose();
    // find the sun: the brightest patch in the sky half of the photo
    const { data, width: w, height: hh } = t.image; let best = 0, bi = 0, hz = [0, 0, 0], hn = 0;
    for (let y = 0; y < hh / 2; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4, l = halfToFloat(data[i]) * .2126 + halfToFloat(data[i + 1]) * .7152 + halfToFloat(data[i + 2]) * .0722; if (l > best) { best = l; bi = y * w + x; } }
    for (let x = 0; x < w; x += 4) { const i = ((hh / 2 - 6 | 0) * w + x) * 4; hz[0] += halfToFloat(data[i]); hz[1] += halfToFloat(data[i + 1]); hz[2] += halfToFloat(data[i + 2]); hn++; }
    const u = (bi % w) / w, v = 1 - Math.floor(bi / w) / hh, th = (u - .5) * TAU, ph = (v - .5) * Math.PI;
    T.sunDir = new THREE.Vector3(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)).normalize();
    { const hz = Math.hypot(T.sunDir.x, T.sunDir.z) || 1, el = .46; T.sunDir.set(T.sunDir.x / hz * Math.cos(el), Math.sin(el), T.sunDir.z / hz * Math.cos(el)); }   // a lower sun: long shadows read best from above
    T.sky = t; T.haze = new THREE.Color(hz[0] / hn, hz[1] / hn, hz[2] / hn);
    applySky();
  });
}
function applySky() {
  const T = three; if (!T || !T.scene || !T.envMap) return;
  T.scene.environment = T.envMap; T.scene.background = T.sky;
  const m = Math.max(T.haze.r, T.haze.g, T.haze.b) || 1; T.scene.fog = new THREE.Fog(T.haze.clone().multiplyScalar(.9 / m), 1400, 6000);   // only the far horizon fades; the course stays clear
}

/* ---------- building the scene. Three.js axes: X = game x, Y = height, Z = game y ---------- */
function build3D(h) {
  if (three && three.hole === h) return;
  if (!three) {
    const renderer = new THREE.WebGLRenderer({ canvas: $('c3'), antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR); renderer.setSize(W, Hh, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: null }, bayer: { value: BAYER }, cell: { value: 2 * DPR }, exposure: { value: .82 }, res: { value: new THREE.Vector2() }, bitPx: { value: BIT.px }, bitD: { value: BIT.d }, bitN: { value: PALETTES[BIT.pal].length }, pal: { value: palUniform(BIT.pal) } } }));
    const postScene = new THREE.Scene(); postScene.add(post);
    three = { renderer, camera: new THREE.PerspectiveCamera(48, W / Hh, .05, 12000), post, postScene, postCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      sunDir: new THREE.Vector3(-.55, .44, .7).normalize(), haze: new THREE.Color(.75, .8, .85) };
    makeTargets(); loadSky();
    const an = renderer.capabilities.getMaxAnisotropy(); Object.values(TEX).forEach(t => { t.anisotropy = an; });
  }
  const T = three, scene = new THREE.Scene(); T.scene = scene; T.hole = h;
  scene.background = new THREE.Color(.82, .86, .9); scene.fog = new THREE.Fog(0xd4dbe2, 1400, 6000);
  const bb = staticBounds(h, 110); T.bb = bb;
  // light: the sun (direction found in the sky photo when it loads) and a soft sky fill until the photo arrives
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.00025; sun.shadow.normalBias = .03; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xdbe8ff, 0x4a5a2a, .35)); T.sun = sun;
  // ground: real grass and sand textures, chosen and tinted by the splat map, with a sharper splat near the ball
  T.splat = new THREE.CanvasTexture(paintSplat(h, bb, Math.min(4, 4096 / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0)))); T.splat.anisotropy = 8;
  T.groundU = Object.assign({}, U, { splat: { value: T.splat, type: 'sampler2D' }, sRect: { value: new THREE.Vector4(bb.x0, bb.y0, bb.x1, bb.y1), type: 'vec4' },
    splatD: { value: null, type: 'sampler2D' }, dRect: { value: new THREE.Vector4(), type: 'vec4' }, useD: { value: 0, type: 'float' }, sandMap: { value: TEX.sand, type: 'sampler2D' } });
  const groundMat = worldAware(new THREE.MeshStandardMaterial({ map: TEX.grass, normalMap: TEX.grassN, roughnessMap: TEX.grassR, normalScale: new THREE.Vector2(.9, .9) }), { uniforms: T.groundU,
    afterMap: `
      vec2 sq = (vWp.xz - sRect.xy) / (sRect.zw - sRect.xy);
      vec4 sp = texture2D(splat, vec2(sq.x, 1. - sq.y));
      if (useD > .5) { vec2 q = (vWp.xz - dRect.xy) / (dRect.zw - dRect.xy);
        if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1.) { float e = min(min(q.x, 1. - q.x), min(q.y, 1. - q.y)); sp = mix(sp, texture2D(splatD, vec2(q.x, 1. - q.y)), smoothstep(0., .1, e)); } }
      vec3 macro = mapTexelToLinear(texture2D(map, vWp.xz * .021)).rgb;
      // rough: the photo texture at full strength, coarse and varied. Short grass: a softened sample of the same
      // texture (its stones and clumps averaged away) for a fine, even turf.
      vec3 roughC = diffuseColor.rgb * mix(vec3(1.), macro * 2.2, .55) * vec3(.46, .74, .27) * 1.9;
      vec3 soft = mapTexelToLinear(texture2D(map, vWp.xz * .9, 3.)).rgb;
      vec3 shortC = mix(soft, diffuseColor.rgb, .18) * mix(vec3(1.), macro * 2.2, .2) * vec3(.42, .82, .28) * 1.75;
      vec3 grass = mix(roughC, shortC, sp.b);
      vec3 sandc = mapTexelToLinear(texture2D(sandMap, vWp.xz * .32)).rgb * vec3(1.15, 1.07, .92);
      diffuseColor.rgb = mix(grass * sp.r * 1.25, sandc, sp.g);
      float sandAmt = sp.g;`,
    afterRough: 'roughnessFactor = mix(roughnessFactor, .97, sandAmt);',
    afterNormal: 'normal = normalize(mix(normal, normalize(vNormal), sp.b * .75));' });   // short turf is smooth
  const STEP = 1, nx = Math.ceil((bb.x1 - bb.x0) / STEP) + 1, ny = Math.ceil((bb.y1 - bb.y0) / STEP) + 1;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = Math.min(bb.x1, bb.x0 + i * STEP), y = Math.min(bb.y1, bb.y0 + j * STEP), k = j * nx + i;
    pos[k * 3] = x; pos[k * 3 + 1] = groundY(h, x, y); pos[k * 3 + 2] = y; uv[k * 2] = x / 2.4; uv[k * 2 + 1] = y / 2.4;
  }
  let q = 0; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = e; }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(new THREE.BufferAttribute(idx, 1)); tg.computeVertexNormals();
  const ground = new THREE.Mesh(tg, groundMat); ground.receiveShadow = true; scene.add(ground);
  // the land beyond the hole: rough out to the haze
  const ring = new THREE.Shape([V2(-9000, 9000), V2(9000, 9000), V2(9000, -9000), V2(-9000, -9000)]);
  ring.holes.push(new THREE.Path([V2(bb.x0 + .5, -bb.y0 - .5), V2(bb.x0 + .5, -bb.y1 + .5), V2(bb.x1 - .5, -bb.y1 + .5), V2(bb.x1 - .5, -bb.y0 - .5)]));
  const fg = new THREE.ShapeGeometry(ring); fg.rotateX(-Math.PI / 2);
  { const p = fg.attributes.position, fuv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { fuv[i * 2] = p.getX(i) / 2.4; fuv[i * 2 + 1] = p.getZ(i) / 2.4; } fg.setAttribute('uv', new THREE.BufferAttribute(fuv, 2)); }
  const far = new THREE.Mesh(fg, groundMat);   // the very same ground material: beyond the hole it reads the splat's edge, which is plain rough
  far.position.y = -.02; far.receiveShadow = true; scene.add(far);
  // the lake: a still, dark surface that mirrors the sky, with small moving ripples
  h.water.forEach(s => {
    let lv = 0, n = 48; for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(s.rot), sn = Math.sin(s.rot), u = Math.cos(a) * s.rx, v = Math.sin(a) * s.ry; lv += zgAt(h, s.x + u * c - v * sn, s.y + u * sn + v * c); }
    const geo = new THREE.CircleGeometry(1, 128); geo.rotateX(-Math.PI / 2);
    const mat = worldAware(new THREE.MeshStandardMaterial({ color: 0x0e1c1c, roughness: .04, metalness: 0, envMapIntensity: 1.4 }), { uniforms: U,
      afterNormal: 'vec2 wp = vWp.xz; vec3 pn = vec3(sin(wp.x * 1.7 + time * 1.3) * .5 + sin(wp.y * 2.3 - time * 1.1) * .5 + sin((wp.x + wp.y) * 5.1 + time * 2.3) * .25, 0., cos(wp.y * 1.9 + time) * .5 + cos(wp.x * 2.9 - time * 1.4) * .4 + cos((wp.x - wp.y) * 6.3 - time * 2.1) * .2);\n normal = normalize(normal + (viewMatrix * vec4(pn * .06, 0.)).xyz);' });
    const m = new THREE.Mesh(geo, mat); m.scale.set(s.rx + .8, 1, s.ry + .8); m.rotation.y = -s.rot; m.position.set(s.x, lv / n - .32, s.y); m.receiveShadow = true; scene.add(m);
  });
  // grass blades (grown around the ball for each shot)
  T.grass = grassMesh(); scene.add(T.grass);
  // trees: the four Blender species, instanced for the hole's trees and a forest line beyond it
  const leafMap = texLoader.load(ASSET + 'trees/leaf_atlas.png'); leafMap.encoding = THREE.sRGBEncoding; leafMap.flipY = false; leafMap.anisotropy = 8;   // glTF texture coordinates
  const barkMat = new THREE.MeshStandardMaterial({ map: TEX.bark, normalMap: TEX.barkN, roughness: .95, color: 0xb8ad9c, vertexColors: true });
  const leafMat = worldAware(new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: .5, side: THREE.DoubleSide, roughness: .75, color: 0xd6e2b4, envMapIntensity: .7, vertexColors: true }), { uniforms: U, varyings: 'varying float vTop;',
    afterMap: 'diffuseColor.rgb *= .75 + .4 * vTop;',   // crowns brighten toward the sunlit top
    vertex: 'vTop = smoothstep(.4, 2.3, position.y); vec3 ip = vec3(instanceMatrix[3].x, 0., instanceMatrix[3].z); float hy = position.y * .35; transformed.x += (sin(time * 1.6 + ip.x * .13 + position.y * 2.) * .03 + wind.x * .06) * hy; transformed.z += (cos(time * 1.3 + ip.z * .11 + position.x * 2.) * .03 + wind.y * .06) * hy;' });
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafMap, alphaTest: .5 });
  // which species where: the hole's own trees are broadleaves (oaks and birches); the forest mixes in pines
  const plants = [];   // [x, y, r, kind index]
  h.trees.forEach((tr, i) => plants.push([tr[0], tr[1], tr[2], [0, 1, 0, 2][i % 4]]));
  { const route = [h.tee, ...h.fair.filter(s => s.t === 'c').flatMap(s => s.pts), h.cup], rnd = seeded(7);
    // keep the forest well back from anything in play, so the corridor of the hole is obvious from above
    let x0_ = 0, y0_ = 0;
    const gap = (list, yd) => list.some(sh => sh.t === 'c' ? (qShape(sh, x0_, y0_) - 1) * sh.r < yd : sh.t === 'e' ? (qShape(sh, x0_, y0_) - 1) * Math.min(sh.rx, sh.ry) < yd : false);
    const clear = (x, y) => { x0_ = x; y0_ = y; return !gap(h.fair, 16) && !gap(h.green, 18) && !gap(h.water, 8) && !gap(h.sand, 8) && Math.hypot(x - h.tee[0], y - h.tee[1]) > 30
      && route.every((p, k) => k === route.length - 1 || segDist(x, y, p, route[k + 1]) > 60) && plants.every(p => Math.hypot(p[0] - x, p[1] - y) > p[2] + 5); };
    for (let k = 0; k < 900 && plants.length < h.trees.length + 170; k++) {
      const a = route[(rnd() * (route.length - 1)) | 0], t = rnd() * 2 - .5, x = a[0] + (rnd() * 2 - 1) * 200, y = a[1] + t * 120;
      if (clear(x, y)) { const kr = rnd(); plants.push([x, y, 6 + rnd() * 6, kr < .3 ? 3 : kr < .58 ? 0 : kr < .85 ? 1 : 2]); } }
  }
  loadTreeFiles().then(geos => {
    if (!geos || three.scene !== scene) return;
    geos.forEach((v, vi) => {
      const mine = plants.filter(p => p[3] === vi); if (!mine.length || !v.bark || !v.leaves) return;
      const o = new THREE.Object3D(), rnd = seeded(vi + 3), tint = new THREE.Color();
      const bm = new THREE.InstancedMesh(v.bark, barkMat, mine.length), lm = new THREE.InstancedMesh(v.leaves, leafMat, mine.length);
      mine.forEach(([x, y, r], k) => { o.position.set(x, groundY(h, x, y) - .1, y); o.rotation.set(0, rnd() * TAU, 0); o.scale.setScalar(r); o.updateMatrix(); bm.setMatrixAt(k, o.matrix); lm.setMatrixAt(k, o.matrix);
        tint.setHSL(.2 + rnd() * .07, .2 + rnd() * .25, .5 + rnd() * .16); lm.setColorAt(k, tint); });   // each tree its own shade of green
      bm.castShadow = bm.receiveShadow = lm.castShadow = lm.receiveShadow = true; lm.customDepthMaterial = leafDepth;
      scene.add(bm, lm);
    });
  });
  // shrubs: a real scanned bush model, scattered at the foot of the trees
  if (THREE.GLTFLoader) new THREE.GLTFLoader().load(ASSET + 'shrub_04/shrub_04_1k.gltf', gl => {
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh || three.scene !== scene) return;
    mesh.geometry.computeBoundingBox(); const bx = mesh.geometry.boundingBox, wdt = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) || 1;
    const spots = [], rnd = seeded(19); plants.forEach(([x, y, r]) => { for (let k = 0; k < 2; k++) { const a = rnd() * TAU, d = r * (.6 + rnd() * .5); spots.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); } });
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, spots.length), o = new THREE.Object3D();
    spots.forEach(([x, y], k) => { const s = (1.4 + rnd() * 1.6) / wdt; o.position.set(x, groundY(h, x, y) - bx.min.y * s, y); o.rotation.set(0, rnd() * TAU, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
    im.castShadow = im.receiveShadow = true; scene.add(im);
  });
  // tee markers, yardage discs, cup and flag
  const red = new THREE.MeshStandardMaterial({ color: 0xb3241c, roughness: .4 }), white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .45 });
  [-4, 4].forEach(dx => { const tx = h.tee[0] + dx, ty = h.tee[1] - 1.5, m = new THREE.Mesh(new THREE.SphereGeometry(.16, 24, 16), red); m.position.set(tx, groundY(h, tx, ty) + .14, ty); m.castShadow = true; scene.add(m); });
  const discCol = { 100: 0xb3241c, 150: 0xf2f2ee, 200: 0x1f4fa8, 250: 0xd8b21c };
  markers(h).forEach(mk => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .06, 28), new THREE.MeshStandardMaterial({ color: discCol[mk.D] || 0xffffff, roughness: .5 })); m.position.set(mk.x, groundY(h, mk.x, mk.y) + .02, mk.y); m.receiveShadow = true; scene.add(m); });
  const [cx, cy] = h.cup, cz = groundY(h, cx, cy);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(.3, 32), new THREE.MeshBasicMaterial({ color: 0x050505 })); cup.rotation.x = -Math.PI / 2; cup.position.set(cx, cz + .012, cy); scene.add(cup);
  const liner = new THREE.Mesh(new THREE.RingGeometry(.3, .34, 32), white); liner.rotation.x = -Math.PI / 2; liner.position.set(cx, cz + .016, cy); scene.add(liner);
  const flag = new THREE.Group(); flag.position.set(cx, cz, cy); const spring = new THREE.Group(); flag.add(spring);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.6, 12), white); pole.position.y = 1.3; pole.castShadow = true; spring.add(pole);
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 160; const fx = fc.getContext('2d');
  fx.fillStyle = '#e8c51e'; fx.fillRect(0, 0, 256, 160); fx.fillStyle = '#1b1b1b'; fx.font = 'italic 900 112px Fraunces, Georgia, serif'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(String(S.hole + 1), 128, 88);
  const ft = new THREE.CanvasTexture(fc); ft.encoding = THREE.sRGBEncoding;
  const clothGeo = new THREE.PlaneGeometry(1.15, .72, 16, 4); clothGeo.translate(.575, 0, 0);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: .8 })); cloth.position.y = 2.24; cloth.castShadow = true; spring.add(cloth);
  scene.add(flag);
  // the ball: nested groups so squash, stretch and spin stay independent; a printed line shows it spinning
  const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bx = bc.getContext('2d'); bx.fillStyle = '#fafafa'; bx.fillRect(0, 0, 256, 128);
  bx.strokeStyle = '#2a2a2a'; bx.lineWidth = 4; bx.beginPath(); bx.moveTo(40, 64); bx.lineTo(92, 64); bx.stroke(); bx.font = '700 22px Figtree, sans-serif'; bx.fillStyle = '#2a2a2a'; bx.fillText('INK 9', 100, 72);
  const bt = new THREE.CanvasTexture(bc); bt.encoding = THREE.sRGBEncoding;
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ map: bt, roughness: .3 })); ballMesh.castShadow = false;
  const ballSquash = new THREE.Group(), ballStretch = new THREE.Group(), ballSpin = new THREE.Group(); ballSquash.add(ballStretch); ballStretch.add(ballSpin); ballSpin.add(ballMesh); scene.add(ballSquash);
  // the ball's shadow: dark and tight on the ground, slipping away along the sunlight and fading as the ball climbs
  const shc = document.createElement('canvas'); shc.width = shc.height = 64; const sx = shc.getContext('2d'), sgr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  sgr.addColorStop(0, 'rgba(0,0,0,.85)'); sgr.addColorStop(.55, 'rgba(0,0,0,.45)'); sgr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sgr; sx.fillRect(0, 0, 64, 64);
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ballShadow.renderOrder = 3; scene.add(ballShadow);
  // a faint white ring around the cup so the hole location reads from altitude
  const cupRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.25, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  cupRing.position.set(cx, cz + .02, cy); cupRing.renderOrder = 3; scene.add(cupRing);
  Object.assign(T, { ballShadow, flag, spring, cloth, clothBase: clothGeo.attributes.position.array.slice(), ballSquash, ballStretch, ballSpin, ballMesh, lastBall: null });
  applySky();
  C3.ready = true;
}
const V2 = (x, y) => new THREE.Vector2(x, y);
/* a sharp splat around the ball (and the green when it's close), plus fresh grass, for every shot */
function sharpenAround(x, y) {
  if (!three || !three.groundU) return; const h = H(), R = 55;
  const dg = Math.hypot(h.cup[0] - x, h.cup[1] - y), cx = dg < R * 1.4 ? (x + h.cup[0]) / 2 : x, cy = dg < R * 1.4 ? (y + h.cup[1]) / 2 : y;
  const bb = { x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R }, u = three.groundU;
  const t = new THREE.CanvasTexture(paintSplat(h, bb, 12)); if (u.splatD.value) u.splatD.value.dispose(); u.splatD.value = t; u.dRect.value.set(bb.x0, bb.y0, bb.x1, bb.y1); u.useD.value = 1;
  growGrass(x + Math.cos(C3.yaw) * 12, y + Math.sin(C3.yaw) * 12);
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
  // the shadow shows height from above: it sits under the ball on the ground and slides away along the sunlight as it rises
  const gy = groundY(h, x, z), up = Math.max(0, y - gy), sd = T.sunDir, k2 = up / Math.max(.2, sd.y);
  T.ballShadow.visible = T.ballSquash.visible; T.ballShadow.position.set(x - sd.x * k2, groundY(h, x - sd.x * k2, z - sd.z * k2) + .03, z - sd.z * k2);
  T.ballShadow.scale.setScalar(Math.max(br * 1.4, .07) * (1 + up * .04) * scale); T.ballShadow.material.opacity = Math.max(.18, .75 - up * .02);
}
function animateWorld(t, dt, h) {
  const T = three, w = S.wind, wl = Math.hypot(w.x, w.y) || 1;
  U.time.value += dt; U.wind.value.set(w.x / wl * w.mph * .025, w.y / wl * w.mph * .025);   // grass, leaves and water move with the wind
  // flag: springs and stretches when the ball drops (S.fp, follow-through), streams with the wind, grows with distance so you can find it
  const fd = T.camera.position.distanceTo(T.flag.position); T.flag.scale.setScalar(Math.max(1, fd / 55));
  T.spring.scale.set(1 / Math.sqrt(1 + S.fp), 1 + S.fp, 1 / Math.sqrt(1 + S.fp));
  T.flag.rotation.y = -Math.atan2(w.y, w.x || 1e-6);
  { const p = T.cloth.geometry.attributes.position, base = T.clothBase, amp = .05 + w.mph * .007;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3], yb = base[i * 3 + 1]; p.setZ(i, Math.sin(t * (4 + w.mph * .3) - x * 6 + yb) * amp * x); p.setY(i, yb - x * x * Math.max(0, .12 - w.mph * .008)); }
    p.needsUpdate = true; T.cloth.geometry.computeVertexNormals(); }
  // shadows follow the camera's area of interest
  const look = C3.look, span = Math.max(50, Math.min(380, T.camera.position.distanceTo(look) * 1.2)), sc = T.sun.shadow.camera;
  T.sun.target.position.copy(look); T.sun.position.copy(look).addScaledVector(T.sunDir, 500);
  if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 1200; sc.updateProjectionMatrix(); }
}

/* ---------- each frame: the scene into a high-range buffer, the final photographic pass, then the game's 2D overlays ---------- */
draw = function (t, dt) {
  if (!three || !three.scene) return;
  const h = H(), b = S.ball, T = three, r = T.renderer;
  updateCamera(t, dt); animateBall(t, dt, h); animateWorld(t, dt, h);
  T.grass.visible = T.camera.position.y - groundY(h, b.x, b.y) < 45;   // blades are invisible fuzz from high up
  r.shadowMap.needsUpdate = true;
  r.setRenderTarget(T.rt); r.render(T.scene, T.camera);
  r.setRenderTarget(null); r.render(T.postScene, T.postCam);
  // overlays
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, Hh); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const real = WS; WS = WS3;
  try {
    const c = CLUBS[S.club], reach = c.putter ? Math.min(distToCup(), 30) : Math.min(reachFor(c, lieNow()), distToCup());
    cam.z = S.state === 'aim' ? pxPerYard(b.x + Math.cos(C3.yaw) * reach * .6, b.y + Math.sin(C3.yaw) * reach * .6) : pxPerYard(b.x, b.y);
    drawParts(dt, true);
    if (T.ballSquash.visible && S.state !== 'card') { const bp = T.ballSquash.position, v = _v.copy(bp).project(T.camera);   // a ring so the ball is never lost
      if (v.z < 1) { const px = (v.x * .5 + .5) * W, py = (-v.y * .5 + .5) * Hh, pulse = 1 + Math.sin(t * 4) * .08;
        ctx.save(); ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(px, py, 11 * pulse, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 11 * pulse, 0, TAU); ctx.stroke(); ctx.restore(); } }
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
  C3.mode = m; try { localStorage.setItem('inknine-view2', m); } catch (_) {}
  $('viewBtn').firstChild.textContent = m === 'aerial' ? 'Behind the ball' : 'Aerial view';
  $('viewBtn').setAttribute('aria-label', m === 'aerial' ? 'Switch to the view from behind the ball' : 'Switch to the aerial view');
  $('hint').firstElementChild.textContent = m === 'aerial'
    ? 'Pick a club, then click and drag back, away from where you want the ball to go. Let go to swing.'
    : 'Turn with the arrow keys, pick a club, then click and drag straight down. Let go to swing.';
  if (!quiet) { sfx('tick'); tone(m === 'aerial' ? 780 : 520, .16, 'sine', .07, m === 'aerial' ? 1040 : 390); }
}
$('viewBtn').addEventListener('click', () => { audioInit(); if (look.on) exitLook(); setView(C3.mode === 'aerial' ? 'behind' : 'aerial'); $('viewBtn').blur(); });
addEventListener('keydown', e => { if ((e.key === 'v' || e.key === 'V') && $('card').hidden && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $('viewBtn').click(); } });
{ let m = 'aerial'; try { m = localStorage.getItem('inknine-view2') || 'aerial'; } catch (_) {} setView(m === 'behind' ? 'behind' : 'aerial', true); }   // aerial unless you chose otherwise
$('lookhint').firstElementChild.textContent = 'The whole hole from above. Press Space to go back.';
// 8-bit dials: pixel size, palette, dither; remembered between visits
function setBit(quiet) {
  if (three) { const u = three.post.material.uniforms; u.bitPx.value = BIT.px; u.bitD.value = BIT.d; u.bitN.value = PALETTES[BIT.pal].length; u.pal.value = palUniform(BIT.pal); }
  $('bitPx').value = BIT.px; $('bitD').value = BIT.d; $('bitPxv').textContent = BIT.px + ' px'; $('bitDv').textContent = Math.round(BIT.d * 100) + '%';
  [...document.querySelectorAll('#bitPals button')].forEach(b => { const on = b.dataset.p === BIT.pal; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  if (!quiet) try { localStorage.setItem('inknine-bit2', JSON.stringify(BIT)); } catch (_) {}
}
$('bitPals').innerHTML = Object.keys(PALETTES).map(n => `<button type="button" data-p="${n}"><i>${PALETTES[n].slice(0, 8).map(h => `<s style="background:#${h}"></s>`).join('')}</i>${n}</button>`).join('');
[...document.querySelectorAll('#bitPals button')].forEach(b => b.addEventListener('click', () => { BIT.pal = b.dataset.p; setBit(); sfx('tick'); b.blur(); }));
$('bitPx').addEventListener('input', e => { BIT.px = parseFloat(e.target.value); setBit(); });
$('bitD').addEventListener('input', e => { BIT.d = parseFloat(e.target.value); setBit(); });
$('bitReset').addEventListener('click', () => { Object.assign(BIT, { px: 2, pal: 'Retro 16', d: .7 }); setBit(); sfx('tick'); });
{ try { Object.assign(BIT, JSON.parse(localStorage.getItem('inknine-bit2') || '{}')); } catch (_) {} if (!PALETTES[BIT.pal]) BIT.pal = 'Retro 16'; setBit(true); }

/* ============================================================
   GOLD: every club costs gold to hit, the putter included. You earn it by playing well and from a stipend at
   the start of each hole, spend it on shots, and spend it between holes on permanent club upgrades. Gold is
   tight on purpose: good holes leave a little over, poor ones run you short. With too little gold you can
   still swing any club on credit, at the cost of a penalty stroke. One purse, on this computer only.
   ============================================================ */
const CLUB_GOLD = { DR: 4, '3W': 3, '5I': 3, '7I': 2, '9I': 2, PW: 1, SW: 2, PT: 1 };
const GOLD_START = 10, UPGRADE_GOLD = [6, 10, 15, 22, 30];
const stipend = () => H().par + 2;                 // a par 5 hands you 7 gold to start
const clubGold = i => (CLUB_GOLD[CLUBS[i].id] || 0) + (modelOf(CLUBS[i]).extra || 0);
if (typeof meta.gold !== 'number' || !meta.goldV2) { meta.gold = GOLD_START; meta.goldV2 = true; saveMeta(); }   // the new, tighter economy starts everyone fresh
C3.holeGold = 0;

function refreshAfford() { S.allowed = null; refreshChips(); updHUD(); }
function showGold(delta) {
  $('goldv').textContent = meta.gold;
  const el = $('purse'); el.classList.remove('bump', 'spend'); void el.offsetWidth; if (delta) el.classList.add(delta > 0 ? 'bump' : 'spend');
}
function earn(n, why) {
  if (!n) return; meta.gold += n; C3.holeGold += n; saveMeta(); showGold(n); refreshAfford();
  const b = S.ball; label(b.x, b.y, `+${n} gold, ${why}`, .45, false, 18); tone(1320, .08, 'triangle', .06); setTimeout(() => tone(1760, .1, 'triangle', .05), 70);
}
// paying for the shot as you swing; short of gold, the shot goes on credit and costs a stroke instead
{ const base = shoot; shoot = function (ang, power, curve, quality) {
  const cost = clubGold(S.club), b = S.ball;
  if (cost <= meta.gold) { meta.gold -= cost; C3.holeGold -= cost; saveMeta(); showGold(-cost); label(b.x, b.y, `−${cost} gold`, 0, false, -10); sfx('tick'); }
  else { S.strokes += 1; label(b.x, b.y, 'On credit: +1 stroke', 0, true, -10); tone(220, .2, 'sawtooth', .05, 160); S.shake = Math.max(S.shake, 3); }
  base(ang, power, curve, quality); refreshAfford();
}; }
// earning: a pure strike, hitting the fairway from the tee, reaching the green in regulation, and the score
{ const base = awardShot; awardShot = function (result) {
  const sh = S.shot, fresh = sh && !sh.done; base(result); if (!fresh || sh.isPutt || result === 'sunk') return;
  const lie = lieNow(), h = H();
  if (sh.quality === 'pure') earn(1, 'pure strike');
  if (sh.lie === 'tee' && h.par > 3 && lie === 'fairway') earn(1, 'fairway hit');
  if (lie === 'green' && sh.lie !== 'green' && S.strokes <= h.par - 2) earn(2, 'green in regulation');
}; }
{ const base = bankHole; bankHole = function (score) {
  const first = !S.banked; base(score); if (!first) return;
  meta.holeOpen = false; saveMeta();   // finished: the next hole pays its starting gold
  const d = score - H().par; earn(score === 1 ? 12 : d <= -2 ? 8 : d === -1 ? 4 : d === 0 ? 1 : 0, scoreName(d, score).toLowerCase());
}; }
// prices on the club chips (red when you can't cover them), and the price of the club in hand under the shot line
{ const base = refreshChips; refreshChips = function () { base();
  CLUBS.forEach((c, i) => { const b = clubsEl.children[i]; if (!b) return; const g = clubGold(i), short = g > meta.gold;
    b.insertAdjacentHTML('beforeend', `<em class="gc${short ? ' short' : ''}" title="${g} gold a shot${short ? ', more than you have' : ''}">${g}</em>`); });
}; }
{ const base = updHUD; updHUD = function () { base();
  if ((S.state === 'aim' || S.state === 'intro') && $('shot')) { const g = clubGold(S.club);
    $('shot').insertAdjacentHTML('beforeend', g > meta.gold ? ` <span class="credit">· ${g} gold: you're short, so it costs a stroke</span>` : ` <span>· ${g} gold</span>`); }
}; }
// a new hole starts with a stipend of par + 2 gold, but only once the last one was finished:
// reloading the page mid-hole restarts the hole without paying out again
{ const base = start3D; start3D = function () {
  base(); C3.holeGold = 0;
  if (!meta.holeOpen) { C3.holeGold = stipend(); meta.gold += C3.holeGold; meta.holeOpen = true; saveMeta(); showGold(C3.holeGold); label(S.ball.x, S.ball.y, `+${C3.holeGold} gold to start`, 1.6, false, 18); }
  else { showGold(0); label(S.ball.x, S.ball.y, 'Hole restarted: no starting gold', 1.6, false, 18); }
  refreshAfford();
}; }
{ const base = toAim; toAim = function () { base(); refreshAfford(); }; }

/* ---------- the pro shop: better club models to buy and carry, plus upgrades for whatever is in each slot ----------
   Each slot in the bag (driver, 3 wood, ...) has a standard club and one or two better models with their own
   character. Buying a model is permanent; you then choose which one to carry. Better models usually cost a gold
   more per shot, so they're a choice, not just a straight upgrade. Upgrades (Tuned, Forged, ...) apply to the slot. */
const MODELS = {
  DR: [{ id: 'std', name: 'Standard driver' },
       { id: 'long', name: 'Long Tom', desc: '7% more carry, but 25% wilder.', buy: 18, extra: 1, carry: 1.07, disp: 1.25 },
       { id: 'finder', name: 'Fairway Finder', desc: 'Nearly twice as straight, 3% shorter.', buy: 16, extra: 1, carry: .97, disp: .55 }],
  '3W': [{ id: 'std', name: 'Standard 3 wood' },
       { id: 'tour', name: 'Tour Spoon', desc: '5% more carry and 20% straighter.', buy: 14, extra: 1, carry: 1.05, disp: .8 }],
  '5I': [{ id: 'std', name: 'Standard 5 iron' },
       { id: 'hybrid', name: 'Rescue Hybrid', desc: 'A touch longer, 25% straighter, lands softer. Same price per shot.', buy: 12, extra: 0, carry: 1.04, disp: .75, loft: 3 }],
  '7I': [{ id: 'std', name: 'Standard 7 iron' },
       { id: 'forged', name: 'Forged 7 iron', desc: '30% straighter with 25% more spin range.', buy: 10, extra: 1, disp: .7, spin: 1.25 }],
  '9I': [{ id: 'std', name: 'Standard 9 iron' },
       { id: 'forged', name: 'Forged 9 iron', desc: '30% straighter with 25% more spin range.', buy: 10, extra: 1, disp: .7, spin: 1.25 }],
  PW: [{ id: 'std', name: 'Standard pitching wedge' },
       { id: 'spin', name: 'Spin Wedge', desc: 'Grabs the green: 40% more spin range and it stops quicker.', buy: 10, extra: 1, spin: 1.4, check: .2 }],
  SW: [{ id: 'std', name: 'Standard sand wedge' },
       { id: 'lob', name: 'Lob Wedge', desc: 'Sky-high and soft over trouble: much more loft, a little shorter. Same price per shot.', buy: 10, extra: 0, loft: 7, spin: 1.3, carry: .92 }],
  PT: [{ id: 'std', name: 'Standard putter' },
       { id: 'mallet', name: 'Mallet Putter', desc: 'A friendlier cup: putts drop from a little further off line.', buy: 12, extra: 1, cap: .25 }]
};
function modelOf(c) { const list = MODELS[c.id] || [{ id: 'std', name: c.name }], want = (meta.equip || {})[c.id]; return list.find(m => m.id === want) || list[0]; }
const ownsModel = (c, id) => id === 'std' || ((meta.models || {})[c.id] || []).includes(id);
// the equipped model shapes the club's numbers everywhere: aim preview, flight, spin dial, the cup
{ const base = CS; CS = function (c) { const r = base(c), m = modelOf(c); if (!m || m.id === 'std') return r;
  return Object.assign({}, r, { carry: r.carry * (m.carry || 1), disp: r.disp * (m.disp || 1), spin: r.spin * (m.spin || 1), capV: (r.capV || 0) + (m.cap || 0) }); }; }
{ const base = strikeParams; strikeParams = function (c, sv, lie, q, LS) { const p = base(c, sv, lie, q, LS), m = modelOf(c);
  if (m && m.loft) p.loft += m.loft; if (m && m.check) p.check = Math.min(.95, p.check + m.check); return p; }; }
// the model in hand shows on the shot line
{ const base = updHUD; updHUD = function () { base(); const m = modelOf(CLUBS[S.club]);
  if (m.id !== 'std' && (S.state === 'aim' || S.state === 'intro') && $('shot')) $('shot').insertAdjacentHTML('afterbegin', `<b class="model">${m.name}</b> · `); }; }

function showProShop(back, flash) {
  const rows = CLUBS.map((c, i) => {
    const lv = lvOf(c), max = lv >= UPGRADE_GOLD.length, up = UPGRADE_GOLD[lv], cur = modelOf(c);
    const models = (MODELS[c.id] || []).map(m => {
      const own = ownsModel(c, m.id), on = cur.id === m.id, price = (CLUB_GOLD[c.id] || 0) + (m.extra || 0);
      return `<div class="pm${on ? ' on' : ''}"><b>${m.name}</b><small>${m.desc || 'The club you started with.'}</small><small class="pp">${price} gold a shot</small>
        ${on ? '<span class="tag">In the bag</span>' : own ? `<button class="pbtn" data-eq="${c.id}:${m.id}">Carry this</button>` : `<button class="pbtn buy" data-buy="${c.id}:${m.id}" ${meta.gold >= m.buy ? '' : 'aria-disabled="true"'}>Buy · ${m.buy} gold</button>`}</div>`;
    }).join('');
    return `<div class="pslot${flash === c.id ? ' flash' : ''}"><div class="ph"><span class="sid">${c.id}</span><span><b>${cur.name}</b><small>${Math.round(CS(c).carry)} yds${c.putter ? ' of roll' : ' carry'} · ${LEVEL_NAMES[lv]} ${pips(lv)}</small></span>
      ${max ? '<span class="smax">Maxed</span>' : `<button class="pbtn up" data-up="${i}" ${meta.gold >= up ? '' : 'aria-disabled="true"'}>Upgrade to ${LEVEL_NAMES[lv + 1]} · ${up} gold</button>`}</div>
      <div class="pms">${models}</div></div>`;
  }).join('');
  $('panel').innerHTML = `<h2>Pro shop</h2><p>Buy better clubs and choose which ones to carry. Better models usually cost a gold more per shot. Upgrades stay with the slot, whichever model is in it.</p>
    <div class="wallet"><small>Gold to spend</small><b id="wv">${meta.gold} gold</b></div>
    <div class="shop pshop">${rows}</div><p class="perk" id="pmsg"></p>
    <button class="btn" id="psBack">Back</button>`;
  $('card').hidden = false; $('card').classList.remove('home'); if (!flash) $('card').scrollTop = 0;
  const redo = id => { const y = $('card').scrollTop; showProShop(back, id); $('card').scrollTop = y; showGold(0); refreshChips(); };
  const deny = (b, msg) => { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); tone(160, .12, 'triangle', .1); $('pmsg').textContent = msg; };
  $('psBack').addEventListener('click', () => { sfx('tick'); back(); });
  [...$('panel').querySelectorAll('[data-buy]')].forEach(b => b.addEventListener('click', () => { audioInit(); const [cid, mid] = b.dataset.buy.split(':'), m = MODELS[cid].find(x => x.id === mid);
    if (meta.gold < m.buy) return deny(b, `You need ${m.buy - meta.gold} more gold for the ${m.name}.`);
    meta.gold -= m.buy; meta.models = meta.models || {}; (meta.models[cid] = meta.models[cid] || []).push(mid); meta.equip = meta.equip || {}; meta.equip[cid] = mid; saveMeta();
    blips(4); setTimeout(() => tone(880, .25, 'triangle', .12), 260); redo(cid); $('pmsg').textContent = `The ${m.name} is in your bag.`; }));
  [...$('panel').querySelectorAll('[data-eq]')].forEach(b => b.addEventListener('click', () => { const [cid, mid] = b.dataset.eq.split(':'); meta.equip = meta.equip || {}; meta.equip[cid] = mid; saveMeta(); sfx('tick'); redo(cid); }));
  [...$('panel').querySelectorAll('[data-up]')].forEach(b => b.addEventListener('click', () => { audioInit(); const c = CLUBS[+b.dataset.up], lv = lvOf(c), cost = UPGRADE_GOLD[lv];
    if (meta.gold < cost) return deny(b, `You need ${cost - meta.gold} more gold for that upgrade.`);
    meta.gold -= cost; meta.lv[c.id] = lv + 1; saveMeta(); blips(4); redo(c.id); $('pmsg').textContent = `${modelOf(c).name} is now ${LEVEL_NAMES[lv + 1]}. ${CLUB_PERK[c.id]}`; }));
}

// the end-of-hole card: score, the gold story of the hole, and the way into the pro shop
showCard = function () {
  const h = H(), s = S.scores[S.hole], L = S.holeLog[S.hole] || { total: 0 };
  $('panel').innerHTML = `<p class="evn">3D prototype, Meadowbrook hole ${S.hole + 1}</p><h2>${scoreName(s - h.par, s)}</h2>
    <p>${h.name} in ${s}, par ${h.par}. ${L.total ? L.total.toLocaleString() + ' points.' : ''}</p>
    <div class="wallet"><small>${C3.holeGold >= 0 ? `+${C3.holeGold}` : `−${-C3.holeGold}`} gold on this hole (starting gold, earnings and shots)</small><b id="wv">${meta.gold} gold</b></div>
    <button class="shopbtn" id="toPro"><span class="bag">${shopBagSVG()}</span><span><b>Pro shop</b><small>Better clubs and upgrades · ${meta.gold} gold to spend</small></span></button>
    <button class="btn" id="again3">Play it again (+${stipend()} gold)</button>
    <p class="ver"><a class="linkbtn" href="/desktop/">Back to the desktop edition</a> · <button class="linkbtn" id="fb3">Send feedback</button></p>`;
  $('card').hidden = false; $('card').classList.remove('home');
  $('toPro').addEventListener('click', () => { audioInit(); sfx('tick'); showProShop(showCard); });
  $('again3').addEventListener('click', () => { sfx('tick'); start3D(); });
  $('fb3').addEventListener('click', () => { sfx('tick'); showFeedback(showCard); });
};
showGold(0);
