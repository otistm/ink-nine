/* Ink Nine 3D prototype: one hole (Meadowbrook 3, Long Way Round) played in 3D.
   The real game runs underneath: swing, tempo, curve, wind, physics, scoring and cards are the phone game's own.
   This file only swaps how it is seen. The hole's 2D ink drawing is baked into a texture and draped over the real
   terrain, trees and the flag are 3D with ink outlines, shade becomes pen hatching, and a chase camera sits behind
   the ball. Loaded after desk.js and Three.js, before main.js. */
"use strict";

const P3_COURSE = 0, P3_HOLE = 2;
const C3 = { yaw: 0, zoom: 1, ready: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), lastState: '', yawDrag: null };
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
{ const base = dragInfo; dragInfo = function () { const d = base(); d.ang = d.l > 4 ? d.ang + C3.yaw + Math.PI / 2 : C3.yaw; return d; }; }
{ const base = toAim; toAim = function () { C3.yaw = pinAngle(); C3.zoom = 1; base(); sharpenAround(S.ball.x, S.ball.y); }; }
{ const base = startHole; startHole = function (i) { const h = HOLES[i]; C3.yaw = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]); C3.zoom = 1; base(i); }; }

/* ---------- the ground texture: the game's own 2D ink drawing of the hole, rendered once at high resolution ---------- */
const WS2D = WS;
// ppy sets the drawing's scale (pixels per yard before sharpening); dpr draws it that many times sharper, like a retina screen,
// so a sharp patch has exactly the same line weights and patterns as the whole-hole drawing, just crisper.
function bakeMap(h, bb, ppy, dpr = 1) {
  const mw = Math.round((bb.x1 - bb.x0) * ppy), mh = Math.round((bb.y1 - bb.y0) * ppy);
  const keep = { W, Hh, DPR, cam: { ...cam }, view: { ...view }, WS };
  WS = WS2D; W = mw; Hh = mh; DPR = dpr; cv.width = Math.round(mw * dpr); cv.height = Math.round(mh * dpr); makePatterns();
  cam.x = (bb.x0 + bb.x1) / 2; cam.y = (bb.y0 + bb.y1) / 2; cam.z = ppy; view.cx = mw / 2; view.cy = mh / 2; shakeOff.x = shakeOff.y = 0;
  try {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [ox, oy] = WS(0, 0); [patRough, patSand, patWater, patStripe, patGreen, patHatch, patShade].forEach(p => setPat(p, ox, oy));
    ctx.fillStyle = patRough; ctx.fillRect(0, 0, mw, mh); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    layer(h.ob, patHatch); drawStakes(h); layer(h.fair, patStripe); layer(h.water, patWater);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.3; ctx.setLineDash([3, 5]); h.green.forEach(g => { ellPath(g, 1.6); ctx.stroke(); }); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; h.green.forEach(g => { ellPath(g, 1.45); ctx.fill(); });
    layer(h.green, patGreen, INK + .3); layer(h.sand, patSand);
    drawSlopes(h);
    // tree shadows, hatched and falling away from the sun (baked: trees never move)
    const sa = setLight(h) + Math.PI;
    ctx.save(); ctx.fillStyle = patShade; ctx.globalAlpha = .7;
    h.trees.forEach(tr => { const [x, y] = WS(tr[0] + Math.cos(sa) * tr[2] * 1.5, tr[1] + Math.sin(sa) * tr[2] * 1.5); ctx.beginPath(); ctx.ellipse(x, y, tr[2] * cam.z * 1.35, tr[2] * cam.z * .85, sa, 0, TAU); ctx.fill(); });
    ctx.restore();
    const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height; out.getContext('2d').drawImage(cv, 0, 0);
    return out;
  } finally {
    W = keep.W; Hh = keep.Hh; DPR = keep.DPR; Object.assign(cam, keep.cam); Object.assign(view, keep.view); WS = keep.WS;
    resize();
  }
}
function roughTile() { // the rough pattern on its own, for the ground beyond the hole
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 160);
  g.strokeStyle = g.fillStyle = '#000'; g.lineCap = 'round'; const r = seeded(11);
  for (let i = 0; i < 22; i++) { const x = 8 + r() * 144, y = 8 + r() * 144, s = 1.6 + r() * 1.7; g.globalAlpha = .26 + r() * .2; g.lineWidth = 1; g.beginPath();
    g.moveTo(x - s, y + s * .6); g.lineTo(x - s * .35, y - s); g.moveTo(x, y + s * .7); g.lineTo(x + s * .1, y - s * 1.25); g.moveTo(x + s, y + s * .6); g.lineTo(x + s * .45, y - s * .9); g.stroke(); }
  g.fillStyle = '#000'; g.globalAlpha = .22; for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(r() * 160, r() * 160, .55, 0, TAU); g.fill(); }
  return c;
}

/* ---------- ink shading: lit = paper, shade = screen-space pen hatching that thickens as it darkens ---------- */
// Sunlight comes from behind the player's left shoulder on each hole, so trees and slopes facing you are lit.
const LIGHT = new THREE.Vector3();
function setLight(h) { const d = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]), a = d + 1.25 * Math.PI; LIGHT.set(Math.cos(a), 1.25, Math.sin(a)).normalize(); return a; }
const INK_FRAG = `
uniform vec3 L; uniform float px;
float hatch(float ndl){
  vec2 f = gl_FragCoord.xy / px;
  float wa = min(clamp((.5 - ndl) * 1.1, 0., 1.), .42), wb = min(clamp((.16 - ndl) * 2.2, 0., 1.), .3);
  float a = fract((f.x + f.y) / 6.) < wa ? 1. : 0., b = fract((f.x - f.y) / 6.) < wb ? 1. : 0.;
  return (1. - a * .82) * (1. - b * .72);
}`;
function inkMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, L: { value: LIGHT }, px: { value: DPR }, useMap: { value: map ? 1 : 0 }, mapD: { value: null }, dRect: { value: new THREE.Vector4() }, useD: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec2 vW; void main(){ vUv = uv; vN = mat3(modelMatrix) * normal; vW = (modelMatrix * vec4(position, 1.)).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D map; uniform sampler2D mapD; uniform float useMap; uniform float useD; uniform vec4 dRect; varying vec2 vUv; varying vec3 vN; varying vec2 vW; ${INK_FRAG}
      void main(){
        vec3 base = useMap > .5 ? texture2D(map, vUv).rgb : vec3(1.);
        if (useD > .5) { vec2 q = (vW - dRect.xy) / (dRect.zw - dRect.xy);
          if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1.) { float e = min(min(q.x, 1. - q.x), min(q.y, 1. - q.y)); base = mix(base, texture2D(mapD, vec2(q.x, 1. - q.y)).rgb, smoothstep(0., .12, e)); } }
        float ndl = max(dot(normalize(vN), L), 0.); gl_FragColor = vec4(base * hatch(ndl), 1.); }`
  });
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
function inked(geo, mat, s) { // a mesh plus a slightly larger black back-face shell: the classic ink outline
  const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(s || 1.06); g.add(m, o); return g;
}
function lumpySphere(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 4), p = geo.attributes.position, r = seeded(seed), a = r() * 9, b = r() * 9, c = r() * 9, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize();
    const k = 1 + .09 * Math.sin(v.x * 5 + a) * Math.sin(v.y * 5 + b) * Math.sin(v.z * 5 + c) + .05 * Math.sin(v.x * 11 + b) * Math.sin(v.z * 9 + a);
    p.setXYZ(i, v.x * k, v.y * k * .82, v.z * k); }
  geo.computeVertexNormals(); return geo;
}

/* ---------- building the scene. Three.js axes: X = game x, Y = height, Z = game y ---------- */
function build3D(h) {
  if (three && three.hole === h) return;
  if (!three) {
    const renderer = new THREE.WebGLRenderer({ canvas: $('c3'), antialias: true });
    renderer.setPixelRatio(DPR); renderer.setSize(W, Hh, false); renderer.setClearColor(0xffffff);
    three = { renderer, camera: new THREE.PerspectiveCamera(52, W / Hh, .05, 30000) };
  }
  const scene = new THREE.Scene(); three.scene = scene; three.hole = h;
  const bb = staticBounds(h, 90), aniso = three.renderer.capabilities.getMaxAnisotropy();
  // ground
  const ppy = Math.min(6, 4096 / Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0));
  const tex = new THREE.CanvasTexture(bakeMap(h, bb, ppy)); tex.anisotropy = aniso;
  const STEP = 1.5, nx = Math.ceil((bb.x1 - bb.x0) / STEP) + 1, ny = Math.ceil((bb.y1 - bb.y0) / STEP) + 1;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = Math.min(bb.x1, bb.x0 + i * STEP), y = Math.min(bb.y1, bb.y0 + j * STEP), k = j * nx + i;
    pos[k * 3] = x; pos[k * 3 + 1] = zgAt(h, x, y); pos[k * 3 + 2] = y;
    uv[k * 2] = (x - bb.x0) / (bb.x1 - bb.x0); uv[k * 2 + 1] = 1 - (y - bb.y0) / (bb.y1 - bb.y0);
  }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tg.setIndex(idx); tg.computeVertexNormals();
  const ground = new THREE.Mesh(tg, inkMaterial(tex)); scene.add(ground);
  // the ground beyond the hole: plain rough, a little lower so hollows on the hole never show it through
  const rt = new THREE.CanvasTexture(roughTile()); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.anisotropy = aniso;
  const FAR = 24000, fg = new THREE.PlaneGeometry(FAR, FAR); fg.rotateX(-Math.PI / 2);
  const fuv = fg.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * FAR / 27, fuv.getY(i) * FAR / 27);
  const far = new THREE.Mesh(fg, inkMaterial(rt)); far.position.set((bb.x0 + bb.x1) / 2, -4, (bb.y0 + bb.y1) / 2); scene.add(far);
  // trees: lumpy crowns on short trunks, matching the ball's collision cylinder (radius r, up to 1.8 r)
  const paper = inkMaterial(null);
  h.trees.forEach((tr, i) => {
    const [x, y, r] = tr, gz = zgAt(h, x, y);
    const crown = inked(lumpySphere(1013 + i * 97), paper, 1.05); crown.scale.setScalar(r); crown.position.set(x, gz + r * 1.4, y); scene.add(crown);
    const trunk = inked(new THREE.CylinderGeometry(.11, .14, 1, 10), paper, 1.25); trunk.scale.set(r, r * 1.1, r); trunk.position.set(x, gz + r * .55, y); scene.add(trunk);
  });
  // tee markers
  [-4, 4].forEach(dx => { const m = inked(new THREE.SphereGeometry(.12, 14, 10), BLACK, 1.1); const tx = h.tee[0] + dx, ty = h.tee[1] - 1.5; m.position.set(tx, zgAt(h, tx, ty) + .1, ty); scene.add(m); });
  // cup and flag (the flag grows with distance so it stays findable, like the 2D one)
  const [cx, cy] = h.cup, cz = zgAt(h, cx, cy);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(.3, 24), BLACK); cup.rotation.x = -Math.PI / 2; cup.position.set(cx, cz + .02, cy); scene.add(cup);
  const flag = new THREE.Group(); flag.position.set(cx, cz, cy);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.6, 8), BLACK); pole.position.y = 1.3; flag.add(pole);
  const fc = document.createElement('canvas'); fc.width = 160; fc.height = 100; const fx = fc.getContext('2d');
  fx.fillStyle = '#fff'; fx.fillRect(0, 0, 160, 100); fx.strokeStyle = '#000'; fx.lineWidth = 8; fx.strokeRect(4, 4, 152, 92);
  fx.fillStyle = '#000'; fx.font = 'italic 900 70px Fraunces, Georgia, serif'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(String(P3_HOLE + 1), 80, 54);
  const clothGeo = new THREE.PlaneGeometry(1.1, .7, 10, 1); clothGeo.translate(.55, 0, 0);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide })); cloth.position.y = 2.25; flag.add(cloth);
  scene.add(flag);
  // ball and its shadow
  const ball = inked(new THREE.SphereGeometry(1, 20, 14), paper, 1.18); scene.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  Object.assign(three, { bb, ppy, ground, flag, cloth, clothBase: clothGeo.attributes.position.array.slice(), ball, shadow });
  C3.ready = true;
}
/* a sharp patch of the drawing around the ball (and the green when it's close), re-drawn for every shot */
function sharpenAround(x, y) {
  if (!three || !three.ground) return; const h = H(), R = 55;
  const dg = Math.hypot(h.cup[0] - x, h.cup[1] - y), cx = dg < R * 1.4 ? (x + h.cup[0]) / 2 : x, cy = dg < R * 1.4 ? (y + h.cup[1]) / 2 : y;
  const bb = { x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R }, u = three.ground.material.uniforms;
  const t = new THREE.CanvasTexture(bakeMap(h, bb, three.ppy, 4)); t.anisotropy = three.renderer.capabilities.getMaxAnisotropy();
  if (u.mapD.value) u.mapD.value.dispose(); u.mapD.value = t; u.dRect.value.set(bb.x0, bb.y0, bb.x1, bb.y1); u.useD.value = 1;
}
{ const base = resize; resize = function () { base(); if (three) { three.renderer.setPixelRatio(DPR); three.renderer.setSize(W, Hh, false); three.camera.aspect = W / Hh; three.camera.updateProjectionMatrix(); } }; }

/* ---------- world to screen for the 2D overlays (aim line, tempo ring, labels): z is height above the ground ---------- */
const _v = new THREE.Vector3();
function WS3(x, y, z = 0) {
  _v.set(x, zgAt(H(), x, y) + z, y).project(three.camera);
  if (_v.z > 1) return [-1e4, -1e4];
  return [(_v.x * .5 + .5) * W, (-_v.y * .5 + .5) * Hh];
}
function pxPerYard(x, y) { const a = WS3(x, y), b = WS3(x, y, 1); return Math.max(.5, Math.hypot(a[0] - b[0], a[1] - b[1])); }

/* ---------- camera ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
function aimCamera(b, h) {
  const putt = CLUBS[S.club].putter, f = V(Math.cos(C3.yaw), 0, Math.sin(C3.yaw)), gz = zgAt(h, b.x, b.y), z = C3.zoom;
  const back = (putt ? 5 : 12) * z, up = (putt ? 2.6 : 4.2) * z, ahead = putt ? Math.min(12, distToCup() + 1.5) : 30;
  return { pos: V(b.x - f.x * back, gz + up, b.y - f.z * back), look: V(b.x + f.x * ahead, gz, b.y + f.z * ahead) };
}
function aerialCamera(h) {
  const bb = three.bb, c = V((bb.x0 + bb.x1) / 2, 0, (bb.y0 + bb.y1) / 2), d = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]);
  return { pos: V(c.x - Math.cos(d) * 300 - Math.sin(d) * 120, 260, c.z - Math.sin(d) * 300 + Math.cos(d) * 120), look: c };
}
function updateCamera(t, dt) {
  const b = S.ball, h = H(), cam3 = three.camera; let tgt, k = 1 - Math.exp(-dt * 4);
  if (S.state === 'aim' && look.on) { tgt = aerialCamera(h); k = 1 - Math.exp(-dt * 3); }
  else if (S.state === 'intro') {
    const I = S.intro, u = easeIO(Math.max(0, Math.min(1, (I.t - 1.2) / 2.6))), g = h.green[0], a = aimCamera(b, h);
    const d = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]), gz = zgAt(h, g.x, g.y);
    const from = { pos: V(g.x - Math.cos(d) * 45, gz + 26, g.y - Math.sin(d) * 45), look: V(g.x, gz, g.y) };
    tgt = { pos: from.pos.clone().lerp(a.pos, u), look: from.look.clone().lerp(a.look, u) }; k = 1;
  }
  else if (S.state === 'flight' || S.state === 'ghost') {
    const sp = Math.hypot(b.vx, b.vy), f = sp > .5 ? V(b.vx / sp, 0, b.vy / sp) : V(Math.cos(C3.yaw), 0, Math.sin(C3.yaw)), hz = Math.max(0, b.z - zgAt(h, b.x, b.y)), gz = zgAt(h, b.x, b.y);
    const back = b.mode === 'air' ? 24 + hz * .4 : 12, up = b.mode === 'air' ? 7 + hz * .55 : 5;
    tgt = { pos: V(b.x - f.x * back, gz + up, b.y - f.z * back), look: V(b.x + f.x * 6, gz + hz * .9, b.y + f.z * 6) };
    k = 1 - Math.exp(-dt * (b.mode === 'air' ? 2.2 : 3));
  }
  else if (S.state === 'aim') tgt = aimCamera(b, h);
  else tgt = { pos: C3.pos.clone(), look: C3.look.clone() };
  if (C3.lastState !== S.state && S.state === 'intro') k = 1;
  C3.pos.lerp(tgt.pos, k); C3.look.lerp(tgt.look, k);
  cam3.position.copy(C3.pos); cam3.lookAt(C3.look);
  C3.lastState = S.state;
}

/* ---------- each frame: 3D scene, then the game's own 2D overlays on the transparent canvas above it ---------- */
draw = function (t, dt) {
  if (!three || !three.scene) return;
  const h = H(), b = S.ball;
  updateCamera(t, dt);
  // ball: kept a few pixels wide at any distance, squashes into the cup when holed
  const gz = zgAt(h, b.x, b.y), dist = three.camera.position.distanceTo(V(b.x, b.z, b.y)), br = Math.max(.06, dist * .0062);
  three.ball.visible = b.mode !== 'gone' && !(b.mode === 'sunk' && S.sinkT > .3);
  three.ball.position.set(b.x, Math.max(b.z, gz) + br * .9, b.y); three.ball.scale.setScalar(br);
  three.shadow.visible = three.ball.visible && b.mode === 'air'; three.shadow.position.set(b.x + .3, gz + .03, b.y + .3); three.shadow.scale.setScalar(br * Math.max(.4, 1 - (b.z - gz) / 40));
  // flag: streams with the wind, grows with distance so you can always find it
  const fd = three.camera.position.distanceTo(three.flag.position); three.flag.scale.setScalar(Math.max(1, fd / 55));
  three.flag.rotation.y = -Math.atan2(S.wind.y, S.wind.x || 1e-6);
  { const p = three.cloth.geometry.attributes.position, base = three.clothBase, amp = .04 + S.wind.mph * .006;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(t * (4 + S.wind.mph * .3) - x * 6) * amp * x); } p.needsUpdate = true; }
  three.renderer.render(three.scene, three.camera);
  // overlays
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, Hh); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const real = WS; WS = WS3;
  try {
    const c = CLUBS[S.club], reach = c.putter ? Math.min(distToCup(), 30) : Math.min(reachFor(c, lieNow()), distToCup());
    cam.z = pxPerYard(b.x + Math.cos(C3.yaw) * reach * .6, b.y + Math.sin(C3.yaw) * reach * .6);
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
$('lookhint').firstElementChild.textContent = 'The whole hole from above. Press Space to go back.';
$('hint').firstElementChild.textContent = 'Turn with the arrow keys, pick a club, then click and drag straight down. Let go to swing.';
