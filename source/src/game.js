// =====================================================================
//  LAST WISH — main game code (Three.js)
//  Tweak numbers in settings.js. This file is the "engine".
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { SETTINGS } from './settings.js';
import { MATERIAL_COLORS, PATTERNS } from './materials.js';

const $ = (id) => document.getElementById(id);
// the big-screen file sets window.LASTWISH_EDITION = 'bigscreen' before the game starts
if (window.LASTWISH_EDITION) SETTINGS.edition = window.LASTWISH_EDITION;
const BIG = SETTINGS.edition === 'bigscreen';
if (BIG) {
  SETTINGS.controls.touch = 'on'; SETTINGS.display.uiScale = 'auto';
  SETTINGS.nights.forEach((n) => (n.instructions = n.instructions.replace('Press E to open', 'Tap the Door button to open')));
}
document.body.classList.add(BIG ? 'big' : 'laptop');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------
//  RENDERER / SCENE / CAMERA
// ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Big screens (like a 7680x2160 video wall) have too many pixels to draw every frame,
// so the game caps the pixel count and lowers it further if the frame rate drops.
const DISPLAY = SETTINGS.display;
let renderScale = 1;
function applySize() {
  const cap = Math.sqrt(DISPLAY.maxPixels / (innerWidth * innerHeight));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2, cap) * renderScale);
  renderer.setSize(innerWidth, innerHeight);
}
applySize();
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(0x05060f, 6, 16);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 60);
// set a camera's shape for the part of the screen it draws into
function fitCam(cam, a) {
  const maxH = THREE.MathUtils.degToRad(DISPLAY.maxHorizontalFov);
  const fov = THREE.MathUtils.radToDeg(Math.min(THREE.MathUtils.degToRad(62), 2 * Math.atan(Math.tan(maxH / 2) / a)));
  if (cam.aspect !== a || cam.fov !== fov) { cam.aspect = a; cam.fov = fov; cam.updateProjectionMatrix(); }
}
// On very wide screens keep the side-to-side view angle sensible (no fish-eye stretching)
function fitCamera() {
  const a = innerWidth / innerHeight;
  const maxH = THREE.MathUtils.degToRad(DISPLAY.maxHorizontalFov);
  const vNormal = THREE.MathUtils.degToRad(62);
  const vForMaxH = 2 * Math.atan(Math.tan(maxH / 2) / a);
  camera.fov = THREE.MathUtils.radToDeg(Math.min(vNormal, vForMaxH));
  camera.aspect = a; camera.updateProjectionMatrix();
  // menus and on-screen info grow with tall screens (a 2160-pixel-high wall gets ~2x)
  const ui = DISPLAY.uiScale === 'auto' ? Math.max(1, Math.min(3, innerHeight / 1000)) : DISPLAY.uiScale;
  document.documentElement.style.setProperty('--ui', ui);
}
fitCamera();
addEventListener('resize', () => { fitCamera(); applySize(); });

// ---------------------------------------------------------------------
//  WORLD LAYOUT (measured from the Blender apartment, in metres)
//  The monkey and cockroaches may only walk inside these rectangles.
// ---------------------------------------------------------------------
const ZONES = [
  { x0: -18.35, x1: 4.70, z0: 0.32, z1: 1.18 },  // long corridor
  { x0: -8.40,  x1: -5.25, z0: -3.05, z1: 2.92 }, // lounge + dining/kitchen hub
  { x0: -5.70,  x1: -4.85, z0: 1.00, z1: 2.45 },  // in front of the kitchen door
];
const OBSTACLES = [
  { x0: -8.58, x1: -7.69, z0: -2.26, z1: -0.57 }, // sofa
  { x0: -7.45, x1: -6.76, z0: -1.98, z1: -0.81 }, // coffee table
  { x0: -7.49, x1: -7.04, z0: 0.68,  z1: 1.13 },  // dining chairs
  { x0: -6.58, x1: -6.13, z0: 0.68,  z1: 1.13 },
  { x0: -7.95, x1: -7.50, z0: 1.24,  z1: 1.68 },
  { x0: -7.05, x1: -5.23, z0: -3.09, z1: -2.41 }, // drying rack
];
// places cockroaches come out of / run to hide (doors, under furniture)
const HIDE_SPOTS = [
  [-16.78, 0.34], [-15.46, 0.34], [-11.78, 0.34], [-10.46, 0.34], [-4.39, 0.34], [-0.71, 0.34], [3.11, 0.34], // room doors
  [-17.06, 1.16], [-15.92, 1.16], [2.27, 1.16], [3.57, 1.16],      // toilet & washroom doors
  [-4.95, 2.04],                                                   // kitchen door
  [-7.55, -1.40], [-6.85, 1.50], [-7.70, 2.85], [-6.10, -2.30], [-5.4, -0.4], // sofa, dining table, fridge, rack, lounge corner
].map(([x, z]) => new THREE.Vector2(x, z));
const START = new THREE.Vector3(1.79, 0, 0.62); // outside the girl's door
const JUNCTION = new THREE.Vector2(-5.75, 0.75); // where corridor meets the hub

// ---------- ROOMS (nights 3 and 4: press X to open a door) ----------
const V2 = (x, z) => new THREE.Vector2(x, z);
//  letter, floor x from, floor x to, door x from, door x to, hinge x
const BEDROOMS = [
  ['A', -18.67, -16.07, -17.28, -16.28, -16.295], ['B', -16.17, -13.57, -15.96, -14.96, -15.945],
  ['C', -13.67, -11.07, -12.28, -11.28, -11.295], ['D', -11.17, -8.57, -10.96, -9.96, -10.945],
  ['E', -5.10, -2.50, -4.89, -3.89, -4.875],      ['F', -2.60, 0.00, -1.21, -0.21, -0.225],
  ['H', 2.40, 5.00, 2.61, 3.61, 2.625],
];
const ROOMS = BEDROOMS.map(([L, f0, f1, d0, d1, h]) => ({
  id: 'room' + L, name: 'Room ' + L,
  inner: { x0: f0 + 0.13, x1: f1 - 0.13, z0: -3.27, z1: -0.03 },
  doorway: { x0: d0 + 0.1, x1: d1 - 0.1, z0: -0.6, z1: 0.85 },
  outer: V2((d0 + d1) / 2, 0.62), innerPt: V2((d0 + d1) / 2, -0.45), side: 'corridor', center: V2((f0 + f1) / 2, -1.7),
  parts: [`${L}_W_P1_Door`, `${L}_W_P1_Door_Corridor`, `${L}_W_P1_Handle`, `${L}_W_P1_Handle_Corridor`, `${L}_W_P1_Hinges`, `${L}_W_P1_Hinges_Corridor`],
  hinge: V2(h, 0.05), doorPos: V2((d0 + d1) / 2, 0.05),
}));
//  name, inside x from, inside x to, door x from, door x to, hinge x
[['Toilet1', -18.50, -16.60, -17.53, -16.64, -16.64], ['Washroom1', -16.36, -15.47, -16.33, -15.52, -15.52],
 ['Washroom2', 1.79, 2.70, 1.86, 2.68, 2.68], ['Toilet2', 2.93, 4.83, 3.13, 4.02, 4.02]].forEach(([N, i0, i1, d0, d1, h]) => ROOMS.push({
  id: N, name: N.replace(/\d/, ' ').trim(),
  inner: { x0: i0, x1: i1, z0: 1.56, z1: 3.68 },
  doorway: { x0: d0 + 0.08, x1: d1 - 0.08, z0: 0.6, z1: 2.1 },
  outer: V2((d0 + d1) / 2, 0.85), innerPt: V2((d0 + d1) / 2, 1.95), side: 'corridor', center: V2((i0 + i1) / 2, 2.6),
  parts: [`Door_${N}_Corridor_Panel`, `Door_${N}_Corridor_Knob`, `Door_${N}_Inside_Panel`, `Door_${N}_Inside_Knob`],
  hinge: V2(h, 1.415), doorPos: V2((d0 + d1) / 2, 1.415),
}));
ROOMS.push({
  id: 'Kitchen', name: 'Kitchen', inner: { x0: -4.57, x1: -1.96, z0: 1.53, z1: 3.67 },
  doorway: { x0: -5.25, x1: -4.15, z0: 1.72, z1: 2.37 },
  outer: V2(-5.05, 2.05), innerPt: V2(-4.25, 2.05), side: 'hub', center: V2(-3.25, 2.6),
  parts: ['Door_Kitchen_Inside_Panel', 'Door_Kitchen_Inside_Knob', 'Door_Kitchen_Outside_Panel', 'Door_Kitchen_Outside_Knob'],
  hinge: V2(-4.69, 1.64), doorPos: V2(-4.69, 2.05),
});
ROOMS.forEach((R) => { R.open = false; R.openAmt = 0; });
const ROOM_BY_ID = Object.fromEntries(ROOMS.map((R) => [R.id, R]));
const GIRL_DOOR = V2(1.79, 0.05); // her room stays locked: she is sleeping

const inRect = (r, x, z, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
// is this point inside the playable space? (m > 0 shrinks, m < 0 grows)
function inAllowed(x, z, m = 0) {
  if (ZONES.some((r) => inRect(r, x, z, m))) return true;
  for (const R of ROOMS) {
    if (inRect(R.inner, x, z, m)) return true;
    if (R.openAmt > 0.8 && inRect(R.doorway, x, z, m)) return true;
  }
  return false;
}
// climb = how high the mover can step up. Furniture lower than that can be walked onto;
// walls are always solid. Cockroaches climb everything except walls (climb = CLIMB_ALL).
const STEP = 0.15, CLIMB_ALL = 50, MONKEY_HEAD = 0.65;
function walkable(x, z, rad = 0, climb = STEP) {
  if (!inAllowed(x, z, rad)) return false;
  return !OBSTACLES.some((r) => (r.top ?? 99) > climb && inRect(r, x, z, -rad));
}
// height of the highest furniture top under a point that is not above maxY (0 = floor)
function groundAt(x, z, rad = 0.06, maxY = CLIMB_ALL) {
  let g = 0;
  for (const r of OBSTACLES) if (!r.wall && r.top <= maxY && r.top > g && inRect(r, x, z, -rad)) g = r.top;
  return g;
}
function region(x, z) {
  if (inRect(ZONES[0], x, z)) return 'corridor';
  for (const R of ROOMS) if (inRect(R.inner, x, z)) return R.id;
  if (ZONES.some((r) => inRect(r, x, z))) return 'hub';
  for (const R of ROOMS) if (inRect(R.doorway, x, z)) return R.id;
  return 'hub';
}
// can something walk in a straight line from p to q?
function clearPath(px, pz, qx, qz, rad = 0.12) {
  const d = Math.hypot(qx - px, qz - pz), n = Math.ceil(d / 0.12);
  for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(px + (qx - px) * t, pz + (qz - pz) * t, rad, CLIMB_ALL)) return false; }
  return true;
}
// where should something at (px,pz) walk next to reach (tx,tz)? (through doors and the corridor/hub junction)
function goalFor(px, pz, tx, tz) {
  const A = region(px, pz), B = region(tx, tz);
  if (A === B) return [tx, tz];
  const RA = ROOM_BY_ID[A], RB = ROOM_BY_ID[B];
  if (RA) return clearPath(px, pz, RA.outer.x, RA.outer.y) ? [RA.outer.x, RA.outer.y] : [RA.innerPt.x, RA.innerPt.y];
  let dest = [tx, tz], destSide = B;
  if (RB) {
    if (clearPath(px, pz, RB.innerPt.x, RB.innerPt.y)) return [RB.innerPt.x, RB.innerPt.y];
    dest = [RB.outer.x, RB.outer.y]; destSide = RB.side;
  }
  if (A === destSide || clearPath(px, pz, dest[0], dest[1])) return dest;
  return [JUNCTION.x, JUNCTION.y];
}
// if something hasn't moved for a while, pick a nearby free spot to walk around furniture
function steerGoal(e, tx, tz, dt) {
  e.stuckT = e.stuckT || 0;
  if (e.detour) {
    e.detourT -= dt;
    if (e.detourT <= 0 || Math.hypot(e.detour[0] - e.pos.x, e.detour[1] - e.pos.z) < 0.15) e.detour = null;
    else return e.detour;
  }
  const lp = e.lastPos || (e.lastPos = [e.pos.x, e.pos.z]);
  e.stuckT += dt;
  if (e.stuckT > 0.5) {
    const moved = Math.hypot(e.pos.x - lp[0], e.pos.z - lp[1]);
    e.stuckT = 0; e.lastPos = [e.pos.x, e.pos.z];
    if (moved < 0.12 && Math.hypot(tx - e.pos.x, tz - e.pos.z) > 0.5) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9;
        const x = e.pos.x + Math.cos(a) * r, z = e.pos.z + Math.sin(a) * r;
        if (clearPath(e.pos.x, e.pos.z, x, z, e.rad)) { e.detour = [x, z]; e.detourT = 1.2; return e.detour; }
      }
    }
  }
  return goalFor(e.pos.x, e.pos.z, tx, tz);
}
// nudge a point to the nearest place where something can stand
function snap(x, z, rad) {
  for (let r = 0; r <= 0.8; r += 0.04)
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (walkable(px, pz, rad)) return [px, pz];
    }
  return [JUNCTION.x, JUNCTION.y];
}
HIDE_SPOTS.forEach((h) => { const [x, z] = snap(h.x, h.y, 0.22); h.set(x, z); });
// move with sliding along walls
function tryMove(pos, dx, dz, rad, climb = STEP) {
  if (walkable(pos.x + dx, pos.z + dz, rad, climb)) { pos.x += dx; pos.z += dz; return true; }
  if (walkable(pos.x + dx, pos.z, rad, climb)) { pos.x += dx; return true; }
  if (walkable(pos.x, pos.z + dz, rad, climb)) { pos.z += dz; return true; }
  return false;
}

// ---------------------------------------------------------------------
//  LIGHTS
// ---------------------------------------------------------------------
const moonLight = new THREE.HemisphereLight(0xdfe6ff, 0x6b5640, 1.0);
scene.add(moonLight);
const roomLights = [];
[[3.5, 0.75], [-1.5, 0.75], [-11, 0.75], [-16.5, 0.75], [-6.8, -1.6], [-6.8, 1.9]].forEach(([x, z]) => {
  const l = new THREE.PointLight(0xffc98a, 7, 9, 1.6);
  l.position.set(x, 2.7, z); scene.add(l); roomLights.push(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  bulb.position.copy(l.position); scene.add(bulb); l.userData.bulb = bulb;
});
const monkeyGlow = new THREE.PointLight(0xbfd4ff, 0, 2.6, 2); // the Moon's gift, visible in the dark
scene.add(monkeyGlow);
let lightLevel = 1; // 1 = lights on, 0 = blackout
function applyLight(level) {
  lightLevel = level;
  roomLights.forEach((l) => {
    l.intensity = 7 * level;
    l.userData.bulb.material.color.setScalar(0.15 + 0.85 * level).multiply(new THREE.Color(0xffe2b0));
  });
  moonLight.intensity = 0.08 + 0.9 * level;
  toonMats.forEach((m) => (m.emissiveIntensity = 0.02 + 0.33 * level));
  monkeyGlow.intensity = (1 - level) * 1.6;
  scene.fog.far = 6 + 10 * level;
  scene.fog.near = 1 + 5 * level;
}

// ---------------------------------------------------------------------
//  LOADING MODELS
// ---------------------------------------------------------------------
// Models are stored in models/*.js (packed from the Blender .glb exports).
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
let loadedCount = 0;
const MODEL_FILES = ['apartment', 'monkey', 'cockroach', 'mega_cockroach', 'girl'];
function setProgress(p) {
  $('loadbar').style.width = (p * 100).toFixed(0) + '%';
  $('loadtxt').textContent = (p * 100).toFixed(0) + '%';
}
function loadScript(url) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = url;
    s.onload = res; s.onerror = () => rej(new Error('missing ' + url));
    document.head.appendChild(s);
  });
}
async function load(name) {
  await loadScript(`models/${name}.js`);
  const b64 = window.TOYNIGHT_MODELS[name];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  delete window.TOYNIGHT_MODELS[name];
  const gltf = await new Promise((res, rej) => loader.parse(bytes.buffer, '', res, rej));
  setProgress(++loadedCount / MODEL_FILES.length);
  return gltf;
}

// Size of a model in its modelled (rest) shape: uses the mesh points directly,
// so skinned characters are measured the same way as the static ones.
function restBox(obj) {
  // "precise" measures every vertex through the skeleton, exactly as it is drawn
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj, true);
}
// Make a model the right size, standing on the floor, centred.
// measure a character in the pose it is usually seen in (its walk), not its rest pose:
// the cockroaches' skeletons stand upright at rest but crawl when they walk
function measure(m, clip) {
  if (!clip) return restBox(m);
  const mixer = new THREE.AnimationMixer(m); const a = mixer.clipAction(inPlace(clip)); a.play();
  const box = new THREE.Box3();
  for (let i = 0; i < 6; i++) { mixer.setTime(clip.duration * i / 6); box.union(restBox(m)); }
  a.stop(); mixer.update(0); mixer.uncacheRoot(m);
  return box;
}
function normalise(gltfScene, targetH, turnDeg, poseClip) {
  const m = gltfScene;
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  const box = measure(m, poseClip);
  const size = box.getSize(new THREE.Vector3());
  const s = targetH / size.y;
  m.scale.setScalar(s);
  box.copy(measure(m, poseClip));
  if (!isFinite(s) || size.y <= 0) console.warn('model size problem', size);
  const c = box.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -box.min.y, -c.z);
  const turn = new THREE.Group(); turn.rotation.y = THREE.MathUtils.degToRad(turnDeg || 0); turn.add(m);
  const root = new THREE.Group(); root.add(turn);
  root.userData.size = box.getSize(new THREE.Vector3());
  root.userData.scale = s;
  root.traverse((o) => { if (o.isMesh) o.material = characterMaterial(o.material); });
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  return root;
}
// The Blender export stores the character texture as "emissive" with a black base colour.
// Rebuild it as a normal textured material (plus a little glow so it reads well at night).
function characterMaterial(m) {
  const tex = m.map || m.emissiveMap;
  if (!tex) return m;
  tex.colorSpace = THREE.SRGBColorSpace;
  const n = new THREE.MeshStandardMaterial({
    map: tex, color: 0xffffff, roughness: 0.85, metalness: 0,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: CHAR_GLOW, side: THREE.DoubleSide,
  });
  n.name = m.name; return n;
}
const CHAR_GLOW = 0.45;
function cloneWithMaterials(src) {
  const c = SkeletonUtils.clone(src);
  c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); } });
  c.userData.size = src.userData.size; c.userData.scale = src.userData.scale;
  return c;
}

// soft round shadow under characters
const shadowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
function addShadow(obj, r) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.position.y = 0.012; s.renderOrder = 1;
  obj.add(s); return s;
}

// ---------------------------------------------------------------------
//  APARTMENT MATERIALS: rebuild the Blender toon look (colours + outlines)
// ---------------------------------------------------------------------
const toonRamp = (() => {
  const d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]); // 3 shading steps
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toonMats = [];
const matCache = {};
function patternShader(kind) {
  return (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = abs(vWNrm); vec2 uv = n.y > 0.5 ? vWPos.xz : (n.x > n.z ? vWPos.zy : vWPos.xy);
          float f = 1.0;
          ${kind === 'planks'
            ? `float row = floor(uv.y / 0.16); vec2 q = vec2(uv.x / 0.9 + row * 0.37, uv.y / 0.16);
               vec2 g = abs(fract(q) - 0.5); f = (g.y > 0.46 || g.x > 0.497) ? 0.72 : (0.94 + 0.06 * fract(sin(row * 12.9898 + floor(q.x) * 78.233) * 43758.5));`
            : `vec2 g = abs(fract(uv / 0.25) - 0.5); f = (g.x > 0.47 || g.y > 0.47) ? 0.78 : 1.0;`}
          diffuseColor.rgb *= f;
        }`);
  };
}
function apartmentMaterial(old) {
  const name = (old.name || '').replace(/\.\d+$/, '');
  if (matCache[name]) return matCache[name];
  const c = MATERIAL_COLORS[name];
  let m;
  if (!c) { m = old; }
  else if (name === 'T_Outline' || name === 'T_Ink') {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...c), side: THREE.FrontSide });
  } else if (name === 'T_KitchenGlass') {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...c), transparent: true, opacity: 0.3, depthWrite: false });
  } else if (name === 'T_MirrorLamp') {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...c) });
  } else {
    const col = new THREE.Color().setRGB(...c);
    m = new THREE.MeshToonMaterial({ color: col, gradientMap: toonRamp, emissive: col.clone(), emissiveIntensity: 0.35 });
    if (PATTERNS[name]) { m.onBeforeCompile = patternShader(PATTERNS[name]); m.customProgramCacheKey = () => 'pat_' + PATTERNS[name]; }
    toonMats.push(m);
  }
  m.name = name; matCache[name] = m; return m;
}

// ---------------------------------------------------------------------
//  SKELETAL ANIMATION (clips come from the Blender actions)
// ---------------------------------------------------------------------
// Make a clip play "in place": the walk/kick clips move the hips forward,
// but in the game the code moves the character, so we keep only the up/down part.
function inPlace(clip) {
  const c = clip.clone();
  c.tracks.forEach((t) => {
    if (!/Hips\.position$/.test(t.name)) return;
    const v = t.values; const x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  });
  return c;
}
// One animator per character
class Animator {
  constructor(obj, clips, map, scale) {
    this.mixer = new THREE.AnimationMixer(obj);
    this.map = map; this.actions = {}; this.scale = scale; this.oneShot = null;
    for (const key in map) {
      const src = clips.find((c) => c.name === map[key].clip);
      if (!src) { console.warn('missing animation', map[key].clip); continue; }
      const act = this.mixer.clipAction(inPlace(src));
      act.timeScale = map[key].speed;
      if (key === 'walk') { act.play(); act.setEffectiveWeight(0); }
      else { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = false; }
      this.actions[key] = act;
    }
    this.walkW = 0;
    this.mixer.addEventListener('finished', (e) => { if (e.action === this.oneShot) this.oneShot = null; });
  }
  // walking 0..1 and the ground speed in m/s (to match foot speed)
  setWalk(amount, groundSpeed) {
    const w = this.actions.walk; if (!w) return;
    if (this.alwaysWalk) { // cockroaches: never go back to the upright rest pose
      const busy = this.oneShot ? 0.15 : 1; w.setEffectiveWeight(busy);
      w.timeScale = amount > 0.05 && groundSpeed && w.userData_stride ? clamp(groundSpeed / w.userData_stride, 0.6, 3.2) : 0.05;
      return;
    }
    this.walkW += (amount - this.walkW) * 0.25;
    const busy = this.oneShot ? 0.15 : 1;
    w.setEffectiveWeight(this.walkW * busy);
    if (groundSpeed && w.userData_stride) w.timeScale = clamp(groundSpeed / w.userData_stride, 0.6, 3.2);
  }
  play(key) {
    const a = this.actions[key]; if (!a) return 0;
    if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(0.08);
    a.reset(); a.setEffectiveWeight(1); a.fadeIn(0.05); a.play();
    this.oneShot = a;
    return a.getClip().duration / a.timeScale;
  }
  // keep playing one clip again and again (victory dance)
  loopPlay(key) {
    const a = this.actions[key]; if (!a) return;
    this.stopLoop();
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(1); a.fadeIn(0.2); a.play();
    this.looping = a; this.oneShot = a;
  }
  // stand completely still (market): no dance, no walk, no attack
  rest() {
    this.stopLoop();
    if (this.oneShot) { this.oneShot.stop(); this.oneShot = null; }
    this.walkW = 0; if (this.actions.walk) this.actions.walk.setEffectiveWeight(0);
    this.mixer.update(0);
  }
  stopLoop() {
    if (!this.looping) return;
    this.looping.stop(); this.looping.setLoop(THREE.LoopOnce, 1);
    if (this.oneShot === this.looping) this.oneShot = null; this.looping = null;
  }
  update(dt) { this.mixer.update(dt); }
}
// how far the walk clip travels per second at this character's size (for foot-speed matching)
function strideOf(clips, name, scale) {
  const c = clips.find((k) => k.name === name); if (!c) return 0;
  const t = c.tracks.find((k) => /Hips\.position$/.test(k.name)); if (!t) return 0;
  const v = t.values, n = v.length;
  const d = Math.hypot(v[n - 3] - v[0], v[n - 1] - v[2]);
  return d * scale / c.duration;
}

// ---------- sharing animations between characters ----------
// Only the monkey file carries the Blender animations. All characters have the same
// 52-bone skeleton, so a clip is moved onto another character by keeping the bone
// movement *relative to its own rest pose* (exactly what Blender does with an action).
function restPose(root) {
  const r = {};
  root.traverse((b) => { if (b.isBone) r[b.name] = { q: b.quaternion.clone(), p: b.position.clone() }; });
  return r;
}
function retargetClip(clip, srcRest, tgtRest) {
  const tracks = [];
  const q = new THREE.Quaternion();
  const hipK = (srcRest.Hips && tgtRest.Hips && Math.abs(srcRest.Hips.p.y) > 1e-4) ? tgtRest.Hips.p.y / srcRest.Hips.p.y : 1;
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.'); const bone = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    const S = srcRest[bone], Tg = tgtRest[bone]; if (!S || !Tg) continue;
    if (prop === 'quaternion') {
      const inv = S.q.clone().invert(); const v = t.values.slice();
      for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).premultiply(inv).premultiply(Tg.q); q.toArray(v, i); }
      tracks.push(new THREE.QuaternionKeyframeTrack(t.name, t.times.slice(), v));
    } else if (prop === 'position' && bone === 'Hips') {
      const v = t.values.slice();
      for (let i = 0; i < v.length; i += 3) {
        v[i] = Tg.p.x + (v[i] - S.p.x) * hipK; v[i + 1] = Tg.p.y + (v[i + 1] - S.p.y) * hipK; v[i + 2] = Tg.p.z + (v[i + 2] - S.p.z) * hipK;
      }
      tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times.slice(), v));
    } // other bones keep their rest length; scale tracks are not needed
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
// all clip names any character uses (so only those are converted)
function neededClips() {
  const n = new Set();
  for (const who of Object.values(SETTINGS.animations)) for (const k in who) n.add(who[k].clip);
  return n;
}

// ---------------------------------------------------------------------
//  DOORS & ROOM FURNITURE
// ---------------------------------------------------------------------
function buildRooms(root) {
  root.updateMatrixWorld(true);
  // every piece of furniture standing on the floor becomes a solid block with its real height;
  // walls become solid too (except where they have a door opening)
  OBSTACLES.length = 0;
  const box = new THREE.Box3();
  const skip = /Floor|Rug|Carpet|Ceil|Door|Frame|Tile|Window|Curtain|Blind|Switch|Socket|Vent|Beam|Light|Lamp|Mirror|Skirt|Glass|Towel|Hook|Knob|Handle|Hinge|Shell|Plinth/i;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const nm = o.name + ' ' + (o.parent ? o.parent.name : '');
    if (skip.test(nm)) return;
    box.setFromObject(o);
    const dx = box.max.x - box.min.x, dz = box.max.z - box.min.z, h = box.max.y - box.min.y;
    if (box.min.y > MONKEY_HEAD || h < 0.03) return;          // higher than the monkey: it can walk under
    const r = { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, top: box.max.y };
    if (/Wall/i.test(nm)) {
      if (box.min.y > 0.15 || Math.min(dx, dz) > 0.35) return;                   // not a thin wall piece
      if (ROOMS.some((R) => R.doorway.x0 < r.x1 && R.doorway.x1 > r.x0 && R.doorway.z0 < r.z1 && R.doorway.z1 > r.z0)) return; // has a door in it
      r.wall = true; r.top = 99;
    } else if (dx > 3 || dz > 3) return;                    // something huge, not furniture
    OBSTACLES.push(r);
  });
  // re-check standing spots now that furniture is solid
  HIDE_SPOTS.forEach((h) => { const [x, z] = snap(h.x, h.y, 0.22); h.set(x, z); });
  { const [x, z] = snap(START.x, START.z, 0.16); START.x = x; START.z = z; }
  // doors swing on their hinges
  for (const R of ROOMS) {
    const pivot = new THREE.Group(); pivot.position.set(R.hinge.x, 0, R.hinge.y); scene.add(pivot); pivot.updateMatrixWorld(true);
    let found = 0;
    R.parts.forEach((n) => { const o = root.getObjectByName(n); if (!o) return; pivot.attach(o); o.matrixAutoUpdate = true; found++; });
    if (!found) console.warn('door parts not found for', R.id);
    const far = V2(R.doorPos.x * 2 - R.hinge.x, R.doorPos.y * 2 - R.hinge.y); // free end of the door
    const endAt = (a) => {
      const dx = far.x - R.hinge.x, dz = far.y - R.hinge.y;
      const x = dx * Math.cos(a) + dz * Math.sin(a), z = -dx * Math.sin(a) + dz * Math.cos(a);
      return Math.hypot(R.hinge.x + x - R.center.x, R.hinge.y + z - R.center.y);
    };
    R.swing = endAt(1.5) < endAt(-1.5) ? 1.5 : -1.5; // open into the room
    R.pivot = pivot;
    // make sure path points are standing spots
    [R.innerPt, R.outer].forEach((pt) => { const [x, z] = snapLoose(pt.x, pt.y); pt.set(x, z); });
  }
}
function snapLoose(x, z) { // like snap() but treats doorways as open
  ROOMS.forEach((R) => (R._o = R.openAmt, R.openAmt = 1));
  const r = snap(x, z, 0.16);
  ROOMS.forEach((R) => (R.openAmt = R._o));
  return r;
}
function setDoor(R, open) { R.open = open; SFX.door(); }
function resetDoors() { ROOMS.forEach((R) => { R.open = false; R.openAmt = 0; if (R.pivot) R.pivot.rotation.y = 0; }); }
function updateDoors(dt) {
  for (const R of ROOMS) {
    const t = R.open ? 1 : 0;
    if (R.openAmt !== t) {
      R.openAmt += Math.sign(t - R.openAmt) * dt * 2.5; R.openAmt = clamp(R.openAmt, 0, 1);
      if (R.pivot) R.pivot.rotation.y = R.swing * (1 - Math.pow(1 - R.openAmt, 2));
    }
  }
}
function nearestDoor() {
  let best = null, bd = 1.05;
  for (const R of ROOMS) { const d = Math.hypot(M.pos.x - R.doorPos.x, M.pos.z - R.doorPos.y); if (d < bd) { bd = d; best = R; } }
  return best;
}
function nearGirlDoor() { return Math.hypot(M.pos.x - GIRL_DOOR.x, M.pos.z - GIRL_DOOR.y) < 0.9; }
function useDoor() {
  if (nearGirlDoor() && !nearestDoor()) { banner('Shh… the girl is sleeping in there', 1500); return; }
  const R = nearestDoor(); if (!R) return;
  if (!night().roomsOpen) { banner('The doors are locked tonight', 1300); return; }
  if (R.open) { // don't close the door on someone standing in it
    const blocked = inRect(R.doorway, M.pos.x, M.pos.z) && !inAllowedNoDoor(M.pos.x, M.pos.z) ||
      G.enemies.some((e) => !e.dead && !e.hidden && inRect(R.doorway, e.pos.x, e.pos.z) && !inAllowedNoDoor(e.pos.x, e.pos.z));
    if (blocked) { banner('Something is in the way!', 900); return; }
  }
  setDoor(R, !R.open);
}
function inAllowedNoDoor(x, z) { return ZONES.some((r) => inRect(r, x, z, 0.1)) || ROOMS.some((R) => inRect(R.inner, x, z, 0.1)); }
function updatePrompt() {
  const el = $('prompt'); let txt = '';
  if (G.state === 'play' && !G.paused) {
    const R = nearestDoor();
    if (R && night().roomsOpen) txt = `Tap <b>Door</b> to ${R.open ? 'close' : 'open'} it · ${R.name}`;
    else if (nearGirlDoor()) txt = 'Shh… the girl is sleeping';
  }
  el.innerHTML = txt; el.style.display = txt ? 'block' : 'none';
}

let T = {}; // templates
async function loadAll() {
  const got = await Promise.all(MODEL_FILES.map(load));
  const F = Object.fromEntries(MODEL_FILES.map((f, i) => [f, got[i]]));
  const apt = F.apartment;
  apt.scene.traverse((o) => {
    if (o.isMesh) {
      o.matrixAutoUpdate = false; o.updateMatrix();
      o.material = Array.isArray(o.material) ? o.material.map(apartmentMaterial) : apartmentMaterial(o.material);
    }
  });
  scene.add(apt.scene);
  buildRooms(apt.scene);
  collectCameraBlockers(apt.scene);
  // animation library (from the monkey file), converted for each character's skeleton
  const need = neededClips();
  const lib = F.monkey.animations.filter((c) => need.has(c.name));
  const srcRest = restPose(F.monkey.scene);
  const clipsFor = (gl) => { const r = restPose(gl.scene); return lib.map((c) => retargetClip(c, srcRest, r)); };
  const turn = SETTINGS.modelTurn;
  T.clips = { roach: clipsFor(F.cockroach), mega: clipsFor(F.mega_cockroach), girl: clipsFor(F.girl) };
  const walkOf = (clips, who) => clips.find((c) => c.name === SETTINGS.animations[who].walk.clip);
  T.roach = normalise(F.cockroach.scene, SETTINGS.cockroach.height, turn.cockroach, walkOf(T.clips.roach, 'cockroach'));
  T.mega = normalise(F.mega_cockroach.scene, SETTINGS.mega.height, turn.mega, walkOf(T.clips.mega, 'mega'));
  T.girl = normalise(F.girl.scene, 1.62, turn.girl);
  // costumes: always the same classic monkey, only the clothes (its texture) change
  T.costumes = {};
  const classic = normalise(F.monkey.scene, SETTINGS.monkey.height, turn.monkey);
  T.costumes.default = { root: classic, clips: lib };
  await loadScript('models/outfits.js').catch(() => console.warn('outfits.js missing'));
  const OUT = window.LASTWISH_OUTFITS || {};
  const texLoader = new THREE.TextureLoader();
  for (const c of SETTINGS.costumes) {
    if (c.id === 'default' || !OUT[c.id]) continue;
    const tex = await texLoader.loadAsync(OUT[c.id]);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const root = cloneWithMaterials(classic);
    root.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map = tex; o.material.emissiveMap = tex; o.material.needsUpdate = true; } });
    T.costumes[c.id] = { root, clips: lib };
  }
  delete window.LASTWISH_OUTFITS;
  T.clips.monkey = lib;
}

// ---------------------------------------------------------------------
//  SOUND (made with code — no audio files needed)
// ---------------------------------------------------------------------
let actx = null;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }
function noise(dur, freq, vol = 0.3, type = 'lowpass') {
  if (!actx) return;
  const n = actx.sampleRate * dur, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = actx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(actx.destination); src.start();
}
function tone(f0, f1, dur, vol = 0.2, type = 'square') {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, actx.currentTime); o.frequency.exponentialRampToValueAtTime(f1, actx.currentTime + dur);
  g.gain.setValueAtTime(vol, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}
const SFX = {
  swing: () => noise(0.12, 2500, 0.15, 'bandpass'),
  hit: () => { noise(0.1, 600, 0.4); tone(180, 70, 0.12, 0.15); },
  squish: () => { noise(0.25, 900, 0.35); tone(400, 60, 0.2, 0.12, 'sawtooth'); },
  bite: () => { tone(900, 300, 0.08, 0.12, 'square'); },
  ultra: () => { noise(0.9, 300, 0.6); tone(120, 30, 0.9, 0.3, 'sine'); },
  jump: () => tone(300, 600, 0.12, 0.08, 'sine'),
  dark: () => tone(220, 55, 0.6, 0.15, 'sawtooth'),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.25, 0.12, 'triangle'), i * 140)); },
  scuttle: () => noise(0.05, 4000, 0.03, 'highpass'),
  door: () => { noise(0.35, 300, 0.25); tone(140, 90, 0.3, 0.06, 'triangle'); },
};

// ---------------------------------------------------------------------
//  INPUT
// ---------------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  onKey(e.code);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------------------------------------------------------------------
//  GAME STATE
// ---------------------------------------------------------------------
const G = {
  state: 'loading', night: 0, time: 0, hp: 100, ultras: 10,
  kills: 0, megaKills: 0, enemies: [], spawnT: 0, megaSpawnT: 0,
  cool: {}, blackT: 0, dark: false, paused: false, effects: [], floats: [],
  scuttleT: 0, mode: 'story', invuln: 0,
};
let monkey, girl;
const M = { knock: new THREE.Vector2(), pos: new THREE.Vector3(), yaw: Math.PI, pitch: 0, ground: 0, air: 0, vy: 0, y: 0, anim: 0, animType: '', walkT: 0 };

// ---------- the monkey and its costumes ----------
const COSTUME_OBJ = {};
function costumeObj(id) {
  if (!COSTUME_OBJ[id]) {
    const c = T.costumes[id]; const root = c.root;
    addShadow(root, 0.22); root.visible = false; scene.add(root);
    const an = new Animator(root, c.clips, SETTINGS.animations.monkey, root.userData.scale);
    if (an.actions.walk) an.actions.walk.userData_stride = strideOf(c.clips, SETTINGS.animations.monkey.walk.clip, root.userData.scale);
    COSTUME_OBJ[id] = { root, animator: an };
  }
  return COSTUME_OBJ[id];
}
function setCostume(id) {
  if (!T.costumes[id]) id = 'default';
  if (monkey) monkey.visible = false;
  const c = costumeObj(id);
  monkey = c.root; monkey.visible = true; M.animator = c.animator; M.costume = id;
}
function makeMonkey() { setCostume(SAVE.equipped); }

// ---------- enemies ----------
function spawnEnemy(kind, hidden, at) {
  const cfg = kind === 'mega' ? SETTINGS.mega : SETTINGS.cockroach;
  const obj = cloneWithMaterials(kind === 'mega' ? T.mega : T.roach);
  const sz = obj.userData.size;
  addShadow(obj, Math.max(sz.x, sz.z) * 0.6);
  const amap = SETTINGS.animations[kind === 'mega' ? 'mega' : 'cockroach'];
  const clips = kind === 'mega' ? T.clips.mega : T.clips.roach;
  const animator = new Animator(obj, clips, amap, obj.userData.scale); animator.alwaysWalk = true;
  if (animator.actions.walk) {
    animator.actions.walk.userData_stride = strideOf(clips, amap.walk.clip, obj.userData.scale);
    animator.actions.walk.time = Math.random() * animator.actions.walk.getClip().duration;
  }
  // choose where it appears: a hide spot not too close and not too far from the monkey
  let spots = HIDE_SPOTS.filter((p) => { const d = p.distanceTo(new THREE.Vector2(M.pos.x, M.pos.z)); return d > 2.8 && d < 10; });
  if (!spots.length) spots = HIDE_SPOTS;
  const sp = at || spots[Math.floor(Math.random() * spots.length)];
  const e = {
    kind, obj, hp: cfg.hp, cfg, pos: new THREE.Vector3(sp.x, 0, sp.y), fleeTime: 0,
    rad: kind === 'mega' ? 0.2 : 0.1, biteT: rand(0, 1), stun: 0, push: new THREE.Vector2(),
    hidden: !!hidden, fleeTo: null, dead: 0, flash: 0, wob: rand(0, 6), yaw: 0, animator,
    speed: cfg.speed * rand(0.85, 1.15),
  };
  obj.position.copy(e.pos); obj.visible = !e.hidden;
  scene.add(obj); G.enemies.push(e);
  return e;
}
function removeEnemy(e) { scene.remove(e.obj); G.enemies.splice(G.enemies.indexOf(e), 1); }

function nearestHide(p) {
  let best = HIDE_SPOTS[0], bd = 1e9;
  for (const h of HIDE_SPOTS) { const d = (h.x - p.x) ** 2 + (h.y - p.z) ** 2; if (d < bd) { bd = d; best = h; } }
  return best;
}

function damageEnemy(e, dmg, fromAngle) {
  if (e.dead || e.hidden) return;
  if (e.lurk) wakeGroup(e.lurk);
  e.hp -= dmg; e.flash = 0.15;
  floatText(e.pos, dmg >= 999 ? 'SPLAT!' : dmg > 0 ? '-' + dmg : 'POW!', dmg > 0 ? '#ffd66b' : '#9fd0ff');
  if (e.player) { SFX.hit(); updateDuelHud(); if (e.hp <= 0) duelEnd('monkey'); return; }
  if (e.hp <= 0) {
    e.dead = 0.001; SFX.squish(); splat(e.pos, e.kind === 'mega' ? 0.45 : 0.22, e.y || 0);
    if (e.kind === 'mega') G.megaKills++; else G.kills++;
    updateHud(); checkWin();
  } else SFX.hit();
}

// ---------------------------------------------------------------------
//  EFFECTS
// ---------------------------------------------------------------------
const splatTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(70,40,10,0.85)';
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(32 + rand(-14, 14), 32 + rand(-14, 14), rand(5, 13), 0, 7); g.fill(); }
  return new THREE.CanvasTexture(cv);
})();
function splat(p, r, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, 6); m.position.set(p.x, y + 0.014, p.z);
  scene.add(m); G.effects.push({ m, t: 0, life: 6, type: 'splat' });
}
function swingArc(range, color = 0xffffff) {
  const g = new THREE.RingGeometry(range * 0.5, range, 20, 1, -0.9, 1.8);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(M.pos.x, M.y + 0.2, M.pos.z);
  m.rotation.z = M.yaw - Math.PI / 2; // ring points along the monkey's facing
  scene.add(m); G.effects.push({ m, t: 0, life: 0.18, type: 'fade' });
}
function shockwave(r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(M.pos.x, 0.05, M.pos.z); m.userData.r = r;
  scene.add(m); G.effects.push({ m, t: 0, life: 0.6, type: 'wave' });
  $('flash').style.transition = 'none'; $('flash').style.opacity = 0.6;
  requestAnimationFrame(() => { $('flash').style.transition = 'opacity .5s'; $('flash').style.opacity = 0; });
}
function floatText(p, txt, color) {
  if (G.mode === 'duel') return; // split screen: the life bars show the damage
  const d = document.createElement('div'); d.className = 'float'; d.textContent = txt; d.style.color = color;
  document.body.appendChild(d); G.floats.push({ d, p: new THREE.Vector3(p.x, 0.45, p.z), t: 0 });
}
function updateEffects(dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const f = G.effects[i]; f.t += dt; const k = f.t / f.life;
    if (f.type === 'fade') f.m.material.opacity = 0.55 * (1 - k);
    if (f.type === 'wave') { const s = 0.2 + k * f.m.userData.r; f.m.scale.setScalar(s); f.m.material.opacity = 0.9 * (1 - k); }
    if (f.type === 'splat' && k > 0.7) f.m.material.opacity = (1 - k) / 0.3;
    if (k >= 1) { scene.remove(f.m); f.m.geometry.dispose(); G.effects.splice(i, 1); }
  }
  const v = new THREE.Vector3();
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i]; f.t += dt; f.p.y += dt * 0.5;
    v.copy(f.p).project(camera);
    f.d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; f.d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    f.d.style.opacity = 1 - f.t / 0.8; f.d.style.display = v.z < 1 ? 'block' : 'none';
    if (f.t > 0.8) { f.d.remove(); G.floats.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------
//  ATTACKS
// ---------------------------------------------------------------------
function forward() { return new THREE.Vector2(Math.sin(M.yaw), Math.cos(M.yaw)); }
function targetsInFront(range, max = 1) {
  const f = forward();
  return G.enemies
    .filter((e) => !e.dead && !e.hidden && Math.abs((e.y || 0) - M.y) < 0.4)
    .map((e) => { const d = new THREE.Vector2(e.pos.x - M.pos.x, e.pos.z - M.pos.z); const dist = d.length() - e.rad; return { e, dist, dot: dist > 0.05 ? d.normalize().dot(f) : 1 }; })
    .filter((o) => o.dist < range && o.dot > 0.35)
    .sort((a, b) => a.dist - b.dist).slice(0, max).map((o) => o.e);
}
function ready(name) {
  const cd = SETTINGS.attacks[name].cooldown || 0;
  if ((G.cool[name] || 0) > G.time) return false;
  G.cool[name] = G.time + cd; return true;
}
// Controls (like most 3rd-person games):
//   W A S D = move (A/D step sideways)   Mouse = look / turn   Shift = run   Space = jump
//   Left click (or J) = hit   Right click (or K) = kick   Q = punch (push away)
//   F = leg punch   R = ULTRA   E = open/close door   Esc / P = pause
//   Arrow keys also work: ↑↓ move, ←→ turn (handy without a mouse)
const ATTACK_KEYS = { KeyJ: 'hit', KeyK: 'kick', KeyQ: 'punch', KeyF: 'legPunch', KeyR: 'ultra' };
// 2 players (laptop): monkey on the left of the keyboard, mega cockroach on the arrows
const DUEL_KEYS = { KeyF: 'hit', KeyG: 'kick', KeyQ: 'punch', KeyE: 'legPunch', KeyR: 'ultra' };
const DUEL_P2_KEYS = { Enter: 'bite', NumpadEnter: 'bite', ShiftRight: 'charge' };
function onKey(code) {
  if (code === 'KeyP' || code === 'Escape') { if (G.state === 'play') togglePause(); return; }
  if (G.mode === 'duel' && G.state === 'play' && !G.paused) {
    if (code === 'Space' && M.air < 0.01) { M.vy = SETTINGS.monkey.jumpPower; SFX.jump(); }
    if (DUEL_KEYS[code]) attack(DUEL_KEYS[code]);
    if (DUEL_P2_KEYS[code]) duelAttack(DUEL_P2_KEYS[code]);
    return;
  }
  if (code === 'Enter') {
    if (G.state === 'fact') beginNight();
    else if (G.state === 'story') storySkip();
    return;
  }
  if (G.state !== 'play' || G.paused) return;
  if (code === 'Space' && M.air < 0.01) { M.vy = SETTINGS.monkey.jumpPower; SFX.jump(); }
  if (code === 'KeyE') useDoor();
  if (ATTACK_KEYS[code]) attack(ATTACK_KEYS[code]);
}
function attack(kind) {
  if (G.state !== 'play' || G.paused) return;
  const A0 = SETTINGS.attacks;
  // in the duel the monkey's hits are stronger (the mega cockroach player has a lot of life)
  const A = G.mode !== 'duel' ? A0 : Object.fromEntries(Object.entries(A0).map(([k, v]) => [k, { ...v, damage: SETTINGS.duel.monkeyDamage[k] ?? v.damage }]));
  if (kind === 'hit') {
    if (!ready('hit')) return; anim('hit'); swingArc(A.hit.range); SFX.swing();
    targetsInFront(A.hit.range, 1).forEach((t) => damageEnemy(t, A.hit.damage));
  } else if (kind === 'kick') {
    if (!ready('kick')) return; anim('kick'); swingArc(A.kick.range, 0xffe7a0); SFX.swing();
    targetsInFront(A.kick.range, A.kick.maxTargets).forEach((t) => damageEnemy(t, A.kick.damage));
  } else if (kind === 'punch') { // pushes a cockroach far away
    if (!ready('punch')) return; anim('punch'); swingArc(A.punch.range, 0x9fd0ff); SFX.swing();
    const t = targetsInFront(A.punch.range, 1)[0];
    if (t) { const f = forward(); t.push.set(f.x, f.y).multiplyScalar(A.punch.pushDistance * 4); t.stun = 1.2; damageEnemy(t, A.punch.damage); SFX.hit(); }
  } else if (kind === 'legPunch') {
    if (!ready('legPunch')) return; anim('legPunch'); swingArc(A.legPunch.range, 0xff9a6b); SFX.swing();
    targetsInFront(A.legPunch.range, 1).forEach((t) => damageEnemy(t, A.legPunch.damage));
  } else if (kind === 'ultra') {
    if (G.ultras <= 0) { banner('No Ultra left!', 900); return; }
    G.ultras--; anim('ultra'); SFX.ultra(); shockwave(A.ultra.radius);
    const ultraDmg = G.mode === 'duel' ? SETTINGS.duel.monkeyDamage.ultra : 999;
    G.enemies.filter((e) => !e.dead && !e.hidden && e.pos.distanceTo(M.pos) < A.ultra.radius).forEach((e) => damageEnemy(e, ultraDmg));
    if (G.mode === 'duel') updateDuelHud(); else updateHud();
  }
}
// ---- mouse: look around + attack ----
const canvas = renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
function lockMouse() { if (TOUCH.on || G.mode === 'duel') return; try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
canvas.style.touchAction = 'none';
const touchOnly = () => SETTINGS.controls.touch === 'on';
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && !touchOnly()) {
    if (G.state !== 'play' || G.paused || G.mode === 'duel') return;
    if (!locked()) lockMouse();
    if (e.button === 0) attack('hit');
    if (e.button === 2) attack('kick');
    return;
  }
  touchDown(e);
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || touchOnly()) touchMove(e); });
canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' || touchOnly()) touchUp(e); });
canvas.addEventListener('pointercancel', (e) => { if (e.pointerType !== 'mouse' || touchOnly()) touchUp(e); });

// ---------- ON-SCREEN BUTTONS (big screen edition) ----------
// Big touch screens often cancel a long press (Windows turns it into a right-click),
// so every movement button works with a single tap:
//   ▲ / ▼  = start walking forward / back (tap again or STOP to stop)
//   ◀ / ▶  = start stepping sideways        ⟲ / ⟳ = turn 45° per tap
//   ■ STOP = stop moving                     RUN   = run on / off
// 1 player: all buttons in one group on one side. 2 players: one group on each side.
// ---- big-screen movement pad: only 4 arrows ----
// ▲ / ▼ : hold to walk forward / back; a quick tap keeps walking, tap again to stop
// ◀ / ▶ : hold to keep turning; a quick tap turns 45°
const TAP_MS = 300;
const PADS = [0, 1].map(() => ({ f: 0, s: 0, turn: 0, turnHold: 0, run: false, keep: null, down: {} }));
function padRefresh(p) {
  const P = PADS[p];
  document.querySelectorAll(`.tpad[data-p="${p}"] [data-pad]`).forEach((b) => {
    const a = b.dataset.pad;
    const on = (a === 'fwd' && P.f === 1) || (a === 'back' && P.f === -1) || (a === 'left' && P.turnHold === 1) || (a === 'right' && P.turnHold === -1);
    b.classList.toggle('active', on);
  });
}
function padPress(p, a) {
  const P = PADS[p]; P.down[a] = performance.now();
  if (a === 'fwd' || a === 'back') P.f = a === 'fwd' ? 1 : -1;
  else P.turnHold = a === 'left' ? 1 : -1;
  padRefresh(p);
}
function padRelease(p, a) {
  const P = PADS[p]; if (P.down[a] === undefined) return;
  const quick = performance.now() - P.down[a] < TAP_MS; delete P.down[a];
  if (a === 'fwd' || a === 'back') {
    const dir = a === 'fwd' ? 1 : -1;
    if (quick && P.keep !== a) { P.keep = a; P.f = dir; }      // tap: keep walking
    else { P.keep = null; P.f = 0; }                           // tap again, or let go after holding: stop
  } else {
    P.turnHold = 0;
    if (quick) P.turn += (a === 'left' ? 1 : -1) * Math.PI / 4; // tap: quick 45° turn
  }
  padRefresh(p);
}
function padReset(P) { P.f = 0; P.s = 0; P.turn = 0; P.turnHold = 0; P.keep = null; P.down = {}; PADS.forEach((_, i) => padRefresh(i)); }
const PAD_HTML = (p, who) => `
  <div class="tpad" data-p="${p}">
    ${who ? `<div class="who">${who}</div>` : ''}
    <span></span><button data-pad="fwd">▲</button><span></span>
    <button data-pad="left">◀</button><span></span><button data-pad="right">▶</button>
    <span></span><button data-pad="back">▼</button><span></span>
  </div>`;
const ACT_HTML = (p, acts) => `<div class="tacts" data-p="${p}">${acts.map(([a, label, cls]) => `<button data-act="${a}" class="${cls || ''}">${label}</button>`).join('')}</div>`;
const ACTS_1P = [['hit', 'Hit', 'big'], ['kick', 'Kick', 'big'], ['punch', 'Punch'], ['legPunch', 'Leg<br>punch'], ['ultra', 'ULTRA', 'ultra'], ['jump', 'Jump'], ['door', 'Door']];
const ACTS_P1 = [['hit', 'Hit', 'big'], ['kick', 'Kick', 'big'], ['ultra', 'ULTRA', 'ultra'], ['jump', 'Jump']];
const ACTS_P2 = [['bite', 'Bite', 'big'], ['charge', 'Charge', 'ultra']];
function buildTouchUI(layout) {
  const root = $('touchui');
  if (!BIG || SETTINGS.controls.touch === 'off') { root.innerHTML = ''; return; }
  let html = '<button id="tpause">❚❚</button>';
  if (layout === '1p') {
    const side = SETTINGS.controls.side === 'left' ? 'left' : 'right';
    html += `<div class="tcluster ${side}">${PAD_HTML(0)}${ACT_HTML(0, ACTS_1P)}</div>`;
  } else {
    html += `<div class="tcluster left">${PAD_HTML(0, '🐒 Monkey')}${ACT_HTML(0, ACTS_P1)}</div>`;
    html += `<div class="tcluster right">${ACT_HTML(1, ACTS_P2)}${PAD_HTML(1, '🪳 Mega cockroach')}</div>`;
  }
  root.innerHTML = html;
  const tap = (el, fn) => {
    let lastT = 0;
    const go = (e) => {
      e.preventDefault(); e.stopPropagation();
      const now = performance.now(); if (now - lastT < 250) return; lastT = now; // one tap = one action
      audio(); fn();
      el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 120);
    };
    el.addEventListener('pointerdown', go);
    el.addEventListener('click', go);            // fallback for screens that only send clicks
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  root.querySelectorAll('.tpad').forEach((pad) => {
    const p = +pad.dataset.p;
    pad.querySelectorAll('[data-pad]').forEach((b) => {
      const a = b.dataset.pad; let sawDown = false;
      const ok = () => G.state === 'play' && !G.paused;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); sawDown = true;
        try { b.setPointerCapture(e.pointerId); } catch (err) {}
        audio(); if (ok()) padPress(p, a);
      });
      const up = (e) => { e.preventDefault(); padRelease(p, a); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      // screens that only send clicks: treat a click as a quick tap
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (sawDown) { sawDown = false; return; }          // already handled by pointerdown/up
        if (ok()) { padPress(p, a); padRelease(p, a); }    // click-only screen: a quick tap
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  });
  root.querySelectorAll('.tacts').forEach((box) => {
    const p = +box.dataset.p;
    box.querySelectorAll('[data-act]').forEach((b) => tap(b, () => {
      if (G.state !== 'play' || G.paused) return;
      const act = b.dataset.act;
      if (p === 1) duelAttack(act);
      else if (act === 'jump') { if (M.air < 0.01) { M.vy = SETTINGS.monkey.jumpPower; SFX.jump(); } }
      else if (act === 'door') useDoor();
      else attack(act);
    }));
  });
  tap($('tpause'), () => { if (G.state === 'play') togglePause(); });
  PADS.forEach((_, i) => padRefresh(i));
}

// ---------- TOUCH CONTROLS (touchscreens, interactive walls) ----------
// Left part of the screen = joystick to walk. Anywhere else = drag to look around.
// Buttons on the right = attacks, jump, door. They appear as soon as the screen is touched.
const TOUCH = { on: false, move: { x: 0, y: 0 }, joyId: null, joyStart: null, lookId: null, lookLast: null };
function enableTouch() {
  if (TOUCH.on || SETTINGS.controls.touch === 'off') return;
  TOUCH.on = true; document.body.classList.add('touch');
}
if (SETTINGS.controls.touch === 'on') enableTouch();
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') enableTouch(); }, true);
const joyR = () => innerHeight * 0.09;
function touchDown(e) {
  enableTouch();
  if (BIG) return; // big screen: movement only with the 4 arrow buttons
  if (G.state !== 'play' || G.paused || G.mode === 'duel') return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (e.clientX < innerWidth * (SETTINGS.controls.joystickArea || 0) && TOUCH.joyId === null) {
    TOUCH.joyId = e.pointerId; TOUCH.joyStart = [e.clientX, e.clientY];
    const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.style.width = j.style.height = joyR() * 2 + 'px'; j.classList.add('on');
    moveKnob(0, 0);
  } else if (TOUCH.lookId === null) {
    TOUCH.lookId = e.pointerId; TOUCH.lookLast = [e.clientX, e.clientY];
  }
}
function moveKnob(x, y) { const k = $('knob'); k.style.transform = `translate(calc(-50% + ${x * joyR()}px), calc(-50% + ${y * joyR()}px))`; }
function touchMove(e) {
  if (e.pointerId === TOUCH.joyId) {
    let dx = (e.clientX - TOUCH.joyStart[0]) / joyR(), dy = (e.clientY - TOUCH.joyStart[1]) / joyR();
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    TOUCH.move.x = dx; TOUCH.move.y = dy; moveKnob(dx, dy);
  } else if (e.pointerId === TOUCH.lookId && G.state === 'play' && !G.paused) {
    const sp = SETTINGS.controls.touchLookSpeed;
    const dx = e.clientX - TOUCH.lookLast[0], dy = e.clientY - TOUCH.lookLast[1];
    TOUCH.lookLast = [e.clientX, e.clientY];
    M.yaw -= dx / innerHeight * 3.2 * sp;
    M.pitch = clamp(M.pitch + dy / innerHeight * 2.0 * sp, -0.35, 0.6);
  }
}
function touchUp(e) {
  if (e.pointerId === TOUCH.joyId) { TOUCH.joyId = null; TOUCH.move.x = TOUCH.move.y = 0; $('joy').classList.remove('on'); }
  if (e.pointerId === TOUCH.lookId) TOUCH.lookId = null;
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let lastMouseX = null;
addEventListener('mousemove', (e) => {
  if (G.state !== 'play' || G.paused) { lastMouseX = null; return; }
  const sens = SETTINGS.controls.mouseSensitivity * 0.0025;
  if (locked() && G.mode !== 'duel') {
    M.yaw -= e.movementX * sens;
    M.pitch = clamp(M.pitch + e.movementY * sens * (SETTINGS.controls.invertY ? -1 : 1), -0.35, 0.6);
  }
});
document.addEventListener('pointerlockchange', () => {
  // like most PC games: leaving mouse-look (Esc) pauses the game
  if (!locked() && G.state === 'play' && !G.paused && !TOUCH.on && G.mode !== 'duel') togglePause();
});
function anim(type) {
  M.anim = 0.001; M.animType = type;
  M.animDur = M.animator.play(type) || 0.4;
}

// ---------------------------------------------------------------------
//  HUD helpers
// ---------------------------------------------------------------------
function night() { return SETTINGS.nights[G.night]; }
function updateHud() {
  const n = night();
  $('hpTxt').textContent = Math.max(0, Math.ceil(G.hp));
  $('hpBar').style.width = clamp(G.hp / SETTINGS.monkey.hp * 100, 0, 100) + '%';
  $('killTxt').textContent = `${Math.min(G.kills, n.goal.cockroach)} / ${n.goal.cockroach}`;
  $('megaTxt').textContent = n.goal.mega ? `MEGA ${Math.min(G.megaKills, n.goal.mega)} / ${n.goal.mega}` : '';
  $('ultraTxt').textContent = G.ultras;
  refreshCurrency();
}
let bannerTimer;
function banner(txt, ms = 1500) {
  const b = $('banner'); b.textContent = txt; b.style.opacity = 1;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (b.style.opacity = 0), ms);
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function hideScreens() { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on')); }
function overlay(title, text, buttons, showControls = false, opts = {}) {
  $('overlay').classList.toggle('clear', !!opts.clear); // 'clear' = see the 3D scene behind (victory dance)
  $('ovTitle').textContent = title; $('ovText').innerHTML = text;
  $('controlsList').style.display = showControls ? 'grid' : 'none';
  const box = $('ovBtns'); box.innerHTML = ''; box.classList.remove('grid2');
  buttons.forEach(([label, fn, ghost]) => { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = label; b.onclick = fn; box.appendChild(b); });
  show('overlay');
}

// ---------------------------------------------------------------------
//  STORY (videos with text fallback)
// ---------------------------------------------------------------------
const INTRO_SLIDES = [
  ['🧸', 'A little girl loved her monkey toy so much…'],
  ['✈️', '…that even when she grew up and went to study at a university abroad, she took it with her.'],
  ['🪳', 'But the new climate was hard. Worst of all — the cockroaches. She was terribly afraid of them.'],
  ['🐒', 'The monkey was so upset to see her struggling. If only it could help…'],
  ['🌕', 'One night the Moon felt sorry for them, and gave the toy a chance — with strict rules.'],
  ['📜', 'Only 4 nights. And nobody may ever see that the toy is alive. Break a rule, and the toy loses its soul forever.'],
  ['💛', 'The monkey understood everything… and accepted.'],
];
const ENDING_SLIDES = [
  ['🌅', 'After the third night, the girl suddenly walked out of her room…'],
  ['😮', '…and saw her tired monkey — alive.'],
  ['🤗', 'Surprised, she ran to it, hugged it, and whispered: "Thank you."'],
  ['💧', 'The monkey cried in its owner\'s hands… and became a toy again.'],
  ['🌙', 'Its soul never returned. But she was never afraid again.'],
];
const BAD_ENDING_SLIDES = [
  ['🌅', 'The next morning, the girl woke up and looked for her monkey…'],
  ['🔍', 'She searched under the bed, in the corridor, in every room…'],
  ['💔', 'But she could not find it anywhere. The cockroaches had destroyed it completely.'],
];
const SLIDES = { intro: INTRO_SLIDES, ending: ENDING_SLIDES, badEnding: BAD_ENDING_SLIDES };
let storyToken = 0;
let storyDone = null, slideTimer = null, slideIdx = 0, slides = [];
// Story style: 'video' = the generated videos, 'slides' = the old text-and-emoji version
let storyStyle = SETTINGS.storyStyle || 'video';
try { storyStyle = localStorage.getItem('lastwish_story') || storyStyle; } catch (e) {}
function setStoryStyle(st) { storyStyle = st; try { localStorage.setItem('lastwish_story', st); } catch (e) {} updateStoryBtn(); }
function updateStoryBtn() { const b = $('btnStyle'); if (b) b.textContent = storyStyle === 'video' ? 'Story: 🎬 Videos' : 'Story: 📜 Text slides'; }
function playStory(kind, done, style = storyStyle) {
  G.state = 'story'; storyDone = done; show('story');
  const v = $('video'); const sl = $('slide');
  v.style.display = 'none'; sl.style.display = 'none';
  if (style === 'slides') { startSlides(SLIDES[kind]); return; }
  const id = ++storyToken; // ignore events left over from an earlier video
  v.onended = () => { if (id === storyToken) storySkip(); };
  v.onerror = () => { if (id === storyToken && v.getAttribute('src')) startSlides(SLIDES[kind]); };
  v.muted = false; v.volume = SETTINGS.videoVolume ?? 0.8;
  v.src = SETTINGS.videos[kind];
  // the big screen's videos are already 32:9 (full screen), so no blurred copy behind them:
  // decoding one 7680x2160 video is enough work for the computer
  const bg = $('vbg'); bg.pause(); bg.removeAttribute('src'); bg.style.display = 'none';
  v.preload = 'auto';
  v.onplaying = null; v.ontimeupdate = null;
  v.oncanplay = () => {
    if (id !== storyToken) return;
    v.oncanplay = null; v.style.display = 'block';
    // browsers may block sound until the player clicked: then play muted rather than not at all
    v.play().catch(() => { v.muted = true; v.play().catch(() => startSlides(SLIDES[kind])); });
  };
}
function startSlides(list) {
  const v = $('video'); v.style.display = 'none'; v.removeAttribute('src');
  const bg = $('vbg'); bg.pause(); bg.style.display = 'none';
  slides = list; slideIdx = 0; $('slide').style.display = 'block'; nextSlide();
}
function nextSlide() {
  clearTimeout(slideTimer);
  if (slideIdx >= slides.length) return storySkip();
  const sl = $('slide'); const [em, txt] = slides[slideIdx++];
  sl.classList.remove('show');
  setTimeout(() => { sl.innerHTML = `<span class="em">${em}</span>${txt}`; sl.classList.add('show'); }, 250);
  slideTimer = setTimeout(nextSlide, 4200);
}
$('story').addEventListener('click', (e) => { if (e.target.id !== 'skip' && slides.length && $('slide').style.display === 'block') nextSlide(); });
function storySkip() {
  clearTimeout(slideTimer); slides = []; storyToken++;
  const v = $('video'); v.pause(); v.onerror = null; v.oncanplay = null; v.onended = null; v.onplaying = null; v.ontimeupdate = null; v.removeAttribute('src'); v.load();
  const bg = $('vbg'); bg.pause(); bg.removeAttribute('src'); bg.load(); bg.style.display = 'none';
  const d = storyDone; storyDone = null; if (d) d();
}
$('skip').onclick = storySkip;

// ---------------------------------------------------------------------
//  SAVE: progress, stars, Moon lives, costumes (kept in this browser)
// ---------------------------------------------------------------------
const SAVE_KEY = 'lastwish_save_v2';
const SAVE = Object.assign(
  { unlocked: 0, stars: {}, quizPassed: {}, spent: 0, lives: 0, owned: ['default'], equipped: 'default', chanceUsed: false, introSeen: false, finished: false },
  (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} refreshCurrency(); }
const starsEarned = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
const starBalance = () => Math.max(0, starsEarned() - SAVE.spent);
function refreshCurrency() {
  document.querySelectorAll('.starsTxt').forEach((el) => (el.textContent = starBalance()));
  document.querySelectorAll('.livesTxt').forEach((el) => (el.textContent = SAVE.lives));
}
// after End 2 the adventure starts again from Night 1 (stars and costumes are kept)
function resetStory() { SAVE.unlocked = 0; SAVE.lives = 0; SAVE.chanceUsed = false; SAVE.quizPassed = {}; SAVE.finished = false; saveGame(); }
const STAGES = SETTINGS.stages;
let curStage = 0;
function stageName(i) { const st = STAGES[i]; return st.type === 'night' ? SETTINGS.nights[st.night].title : (st.title || 'Moon Quiz'); }
function starsFor(seconds) { const S = SETTINGS.stars; return seconds < S.threeUnder ? 3 : seconds < S.twoUnder ? 2 : 1; }
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const starRow = (n, size = '') => [0, 1, 2].map((i) => `<i class="st ${i < n ? 'on' : ''} ${size}">★</i>`).join('');

// ---------------------------------------------------------------------
//  NIGHT FLOW
// ---------------------------------------------------------------------
function showFact(i) {
  G.mode = 'story'; G.night = i; G.state = 'fact';
  const n = night(); const S = SETTINGS.stars;
  $('fact').style.backgroundImage = `url(${n.image})`;
  $('factNight').textContent = n.title;
  $('factText').textContent = n.fact;
  $('factGoal').innerHTML = `<span class="chip">🎯 Kill ${n.goal.cockroach} cockroaches</span>` +
    (n.goal.mega ? `<span class="chip">👹 + ${n.goal.mega} mega cockroaches</span>` : '') +
    `<span class="chip">⏱ ${n.minutes} minutes</span>` +
    `<span class="chip">★★★ under ${mmss(S.threeUnder)} · ★★ under ${mmss(S.twoUnder)}</span>` +
    `<span class="chip">♥ Moon lives: <b class="livesTxt">${SAVE.lives}</b></span>`;
  show('fact'); setMenuCam('title');
}
function clearEnemies() { [...G.enemies].forEach(removeEnemy); G.effects.forEach((f) => scene.remove(f.m)); G.effects = []; D2.e = null; }
function beginNight() {
  releaseButtons();
  const n = night();
  clearEnemies(); stopDances();
  if (girl) girl.visible = false;
  G.mode = 'story'; G.state = 'play'; G.paused = false; G.time = 0; G.timeLeft = n.minutes * 60; G.invuln = 0;
  G.hp = SETTINGS.monkey.hp; G.ultras = SETTINGS.monkey.ultrasPerNight; G.kills = 0; G.megaKills = 0;
  G.spawnT = 0; G.megaSpawnT = 4; G.blackT = n.blackout ? n.blackout.every : 0; G.dark = false; G.cool = {};
  M.pos.copy(START); M.yaw = -Math.PI / 2; M.pitch = 0; M.y = 0; M.vy = 0; M.knock.set(0, 0); // face west, down the corridor
  lockMouse();
  monkey.visible = true; applyLight(1);
  hideScreens(); $('hud').classList.add('on'); $('duelHud').classList.remove('on');
  $('nightTxt').textContent = n.title.toUpperCase();
  $('instr').innerHTML = `<b>${n.title}:</b> ${n.instructions}`; $('instr').style.opacity = 1;
  setTimeout(() => { if (G.state === 'play') $('instr').style.opacity = 0; }, 11000);
  resetDoors(); G.groupId = 0;
  // a few cockroaches at the start
  if (n.ambush) { for (let i = 0; i < 4; i++) spawnGroup(n.ambush, 5); }
  else for (let i = 0; i < 4; i++) spawnEnemy('roach', n.cockroachesHide);
  buildTouchUI('1p');
  updateHud(); setMenuCam(null);
}
function leavePlay() { // common clean-up when a night or duel stops
  try { document.exitPointerLock(); } catch (e) {}
  $('hud').classList.remove('on'); $('duelHud').classList.remove('on'); $('prompt').style.display = 'none';
  releaseButtons();
}
function checkWin() {
  const n = night();
  if (G.state !== 'play' || G.mode !== 'story') return;
  if (G.kills >= n.goal.cockroach && G.megaKills >= n.goal.mega) nightComplete();
}
function nightComplete() {
  G.state = 'victory'; SFX.win(); leavePlay();
  const t = G.time, stars = starsFor(t), key = 'n' + G.night;
  const prev = SAVE.stars[key] || 0, gained = Math.max(0, stars - prev);
  SAVE.stars[key] = Math.max(prev, stars);
  if (STAGES[curStage] && STAGES[curStage].type === 'night' && STAGES[curStage].night === G.night && curStage >= SAVE.unlocked) SAVE.unlocked = curStage + 1;
  saveGame();
  setMenuCam('victory'); M.animator.loopPlay('dance');
  overlay(`${night().title} survived!`,
    `<div class="bigstars">${starRow(stars, 'big')}</div>` +
    `Time: <b>${mmss(t)}</b> · ${gained ? `<b>+${gained} ★</b> for the market!` : (prev >= stars ? 'Your best is ' + prev + ' ★ — be faster for more stars.' : '')}` +
    `<br><span class="small">The sun is rising. The monkey freezes back into a toy before anyone wakes up…</span>`,
    [['Continue ▸', () => { stopDances(); showMap(); }], ['Play again', () => { stopDances(); showFact(G.night); }, true]],
    false, { clear: true });
}
// the monkey's life points reached 0
function monkeyDown() {
  if (G.state !== 'play') return;
  if (G.mode === 'duel') return duelEnd('mega');
  G.state = 'down'; leavePlay(); tone(300, 60, 1.2, 0.2, 'sawtooth');
  if (SAVE.lives > 0) {
    overlay('The monkey fell!', `You have <b>♥ ${SAVE.lives}</b> Moon ${SAVE.lives > 1 ? 'lives' : 'life'}. Use one to get up and keep fighting?`,
      [['♥ Use a life', useLife], ['Give up', () => nightLost('The cockroaches were too many tonight.'), true]]);
  } else nightLost('The cockroaches bit the monkey too many times.');
}
function useLife() {
  SAVE.lives--; saveGame();
  G.hp = SETTINGS.lives.reviveHp; G.invuln = 2.5;
  // push nearby cockroaches away
  G.enemies.forEach((e) => {
    const dx = e.pos.x - M.pos.x, dz = e.pos.z - M.pos.z, d = Math.hypot(dx, dz);
    if (d < 1.6 && d > 0.01) { e.push.set(dx / d * 6, dz / d * 6); e.stun = 1.0; }
  });
  shockwave(1.6);
  G.state = 'play'; hideScreens(); $('hud').classList.add('on'); updateHud(); lockMouse();
  banner('The Moon helps you up! ♥', 1600);
}
function nightLost(reason) {
  G.state = 'lost'; leavePlay(); clearEnemies();
  if (!SAVE.chanceUsed) {
    SAVE.chanceUsed = true; saveGame();
    overlay('The monkey was defeated…', reason + '<br><br>' +
      '🌕 The Moon decided to give you <b>a second chance</b> to help the girl and the monkey — ' +
      'but you need to show that you are ready to continue fighting the cockroaches.<br><br>' +
      `Answer <b>${SETTINGS.quiz.questions}</b> questions about cockroaches. Get at least <b>${SETTINGS.quiz.passScore}</b> right.`,
      [['I am ready ▸', () => startQuiz('chance')]]);
  } else {
    overlay('The monkey was defeated…', reason + '<br><br>There are no more chances.', [['Continue ▸', () => badEnding()]]);
  }
}
function timeUp() {
  if (G.state !== 'play') return;
  if (G.mode === 'duel') return duelEnd(duelLeader());
  G.state = 'lost'; leavePlay(); clearEnemies();
  overlay('The sun is rising…', 'The night ended before the job was done. The monkey has to freeze — try this night again!',
    [['Try again ▸', () => showFact(G.night)], ['Map', () => showMap(), true]]);
}
function badEnding() {
  playStory('badEnding', () => {
    resetStory();
    overlay('The End', 'The monkey could not finish its mission.<br><br>Your <b>★ stars</b> and <b>costumes</b> are kept — the adventure starts again from Night 1.',
      [['Back to the map', () => showMap()]]);
  });
}
function finishAdventure() {
  playStory('ending', () => {
    SAVE.finished = true; saveGame();
    overlay('The End', 'Thank you for playing <b>Last Wish</b>.<br>You can replay any night for more ★ stars.', [['Back to the map', () => showMap()]]);
  });
}

// ---------------------------------------------------------------------
//  QUIZZES: Moon quizzes on the map (give lives) + the second-chance quiz
// ---------------------------------------------------------------------
const QUESTIONS = [
  ['When did cockroaches first appear on Earth?', ['Over 300 million years ago', 'About 30 million years ago', 'About 3 million years ago', 'About 3,000 years ago'], 'They are older than the dinosaurs!'],
  ['How long can a cockroach live without its head?', ['One to two weeks', 'One hour', 'One day', 'One year'], 'It breathes through spiracles in its body, so it doesn\'t need its head to breathe.'],
  ['Why does a headless cockroach finally die?', ['It dies of thirst — it cannot drink water', 'It cannot see', 'It forgets how to walk', 'It gets too cold'], 'Without a mouth it cannot drink.'],
  ['How does a cockroach breathe?', ['Through small openings in its body segments (spiracles)', 'Only through its mouth', 'Through gills', 'Through its antennae'], 'These openings are called spiracles.'],
  ['How fast can a cockroach run?', ['Up to 5 km/h (3 mph)', 'Up to 50 km/h', 'Only 0.05 km/h', 'Up to 100 km/h'], 'That\'s very fast for such a small body!'],
  ['How do cockroaches squeeze through tiny gaps?', ['They flatten their exoskeletons', 'They take off their legs', 'They shrink their heads', 'They dig a tunnel'], 'They can fit through gaps a fraction of their body height.'],
  ['How long can a cockroach hold its breath underwater?', ['Up to 40 minutes', 'Up to 40 seconds', 'Up to 4 days', 'They can\'t hold their breath'], 'Up to 40 minutes!'],
  ['How long can a cockroach survive without food?', ['About a month', 'About one day', 'About one hour', 'About ten years'], 'They are omnivores with great endurance.'],
  ['How often does a cockroach need water?', ['About every week', 'Every few minutes', 'Once a year', 'Never'], 'Water is much more important to them than food.'],
  ['What do cockroaches eat?', ['Almost anything — they are omnivores', 'Only fruit', 'Only meat', 'Only paper'], 'Omnivores eat both plants and animals.'],
  ['Where do most cockroach species live?', ['In forests, caves and tropical areas', 'Only in houses', 'Only in deserts', 'On polar ice'], 'Only a few species live in our homes.'],
  ['What important job do wild cockroaches do in nature?', ['They are decomposers that recycle rotting matter', 'They pollinate flowers like bees', 'They make honey', 'They hunt birds'], 'They recycle rotting plant and animal matter.'],
  ['When are cockroaches most active?', ['At night — they are nocturnal', 'At noon', 'Only in winter', 'Only when it rains'], 'They come out a few hours after the lights go out.'],
  ['About how many cockroach species are there in the world?', ['About 4,600', 'About 46', 'About 460,000', 'Only 4'], 'But only a few are household pests.'],
];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let Q = null;
function quizStageIntro(i) {
  curStage = i; G.state = 'quizIntro';
  const L = SETTINGS.lives, passed = SAVE.quizPassed[i];
  overlay('🌕 ' + stageName(i),
    `The Moon wants to know if you are ready to keep fighting the cockroaches.<br><br>` +
    `Answer <b>${SETTINGS.quiz.questions}</b> questions. Get at least <b>${SETTINGS.quiz.passScore}</b> right and the Moon gives you ` +
    `<b>♥ ${L.perQuiz}</b> extra life (perfect score: <b>♥ ${L.perQuiz + L.perfectBonus}</b>).` +
    (passed ? '<br><br><span class="small">You already passed this quiz — you can play it again for fun.</span>' : ''),
    [['Start ▸', () => startQuiz('stage')], ['Map', () => showMap(), true]]);
}
function startQuiz(kind) {
  const N = Math.min(SETTINGS.quiz.questions, QUESTIONS.length);
  Q = { kind, list: shuffle([...QUESTIONS]).slice(0, N), i: 0, score: 0, results: [] };
  G.state = 'quiz'; show('quiz'); showQuestion();
}
function showQuestion() {
  const [text, answers, why] = Q.list[Q.i];
  const N = Q.list.length;
  $('qNum').textContent = `Question ${Q.i + 1} of ${N}`;
  $('qText').textContent = text; $('qWhy').textContent = ''; $('qNext').innerHTML = '';
  $('qDots').innerHTML = Q.list.map((_, k) => `<i class="${k < Q.i ? (Q.results[k] ? 'ok' : 'no') : k === Q.i ? 'now' : ''}"></i>`).join('');
  const box = $('qOpts'); box.innerHTML = '';
  shuffle(answers.map((a, k) => [a, k === 0])).forEach(([a, right]) => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = a; b.dataset.right = right ? '1' : '';
    b.onclick = () => answer(b, right, why); box.appendChild(b);
  });
}
function answer(btn, right, why) {
  if (Q.answered === Q.i) return; Q.answered = Q.i;
  document.querySelectorAll('#qOpts .opt').forEach((b) => { if (b.dataset.right) b.classList.add('right'); });
  if (!right) btn.classList.add('wrong');
  Q.results.push(right); if (right) { Q.score++; tone(660, 990, 0.2, 0.1, 'triangle'); } else tone(220, 110, 0.3, 0.1, 'sawtooth');
  $('qWhy').textContent = (right ? '✅ Correct! ' : '❌ Not quite. ') + why;
  const last = Q.i === Q.list.length - 1;
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = last ? 'See result ▸' : 'Next ▸';
  b.onclick = () => { if (last) finishQuiz(); else { Q.i++; showQuestion(); } };
  $('qNext').appendChild(b);
}
function finishQuiz() {
  const N = Q.list.length, ok = Q.score >= SETTINGS.quiz.passScore, perfect = Q.score === N;
  if (Q.kind === 'chance') {
    if (ok) {
      SFX.win();
      overlay('The Moon believes in you!', `You answered <b>${Q.score} of ${N}</b> correctly.<br>The monkey gets up again — ${night().title} starts over.`,
        [['Fight again ▸', () => showFact(G.night)]]);
    } else {
      overlay('Not ready yet…', `You answered <b>${Q.score} of ${N}</b> correctly — you needed ${SETTINGS.quiz.passScore}.`,
        [['Continue ▸', () => badEnding()]]);
    }
    return;
  }
  // a Moon quiz on the map
  if (!ok) {
    overlay('Not yet…', `You answered <b>${Q.score} of ${N}</b> correctly — you need ${SETTINGS.quiz.passScore} to pass.`,
      [['Try again ▸', () => startQuiz('stage')], ['Map', () => showMap(), true]]);
    return;
  }
  SFX.win();
  let msg = `You answered <b>${Q.score} of ${N}</b> correctly!`;
  if (!SAVE.quizPassed[curStage]) {
    const L = SETTINGS.lives, gift = L.perQuiz + (perfect ? L.perfectBonus : 0);
    SAVE.lives += gift; SAVE.quizPassed[curStage] = true;
    msg += `<br><br>🌕 The Moon gives you <b>♥ ${gift}</b> extra ${gift > 1 ? 'lives' : 'life'}. If the monkey falls during a night, it can get up again.`;
  }
  if (curStage >= SAVE.unlocked) SAVE.unlocked = curStage + 1;
  saveGame();
  const last = curStage === STAGES.length - 1;
  overlay('Quiz passed!', msg, [[last ? 'See the ending ▸' : 'Continue ▸', () => (last ? finishAdventure() : showMap())]]);
}

// ---------------------------------------------------------------------
//  MAIN MENU, PROGRESS MAP
// ---------------------------------------------------------------------
function releaseButtons() { for (const k in keys) keys[k] = false; PADS.forEach((p) => padReset(p)); }
function togglePause() {
  G.paused = !G.paused; releaseButtons();
  if (G.paused) {
    const back = G.mode === 'duel' ? ['Main menu', () => toTitle(), true] : ['Map', () => { leavePlay(); clearEnemies(); showMap(); }, true];
    overlay('Paused', '', [['Resume', () => togglePause()], back], G.mode !== 'duel');
    try { document.exitPointerLock(); } catch (e) {}
  } else { hideScreens(); lockMouse(); }
}
function toTitle() {
  leavePlay(); clearEnemies(); stopDances(); G.mode = 'story'; G.paused = false;
  G.state = 'title'; show('title'); setMenuCam('title'); applyLight(1); refreshCurrency();
}
function play1p() {
  audio();
  // big screen: every new player sees the intro (Skip is always there); laptop: only the first time
  if (BIG || !SAVE.introSeen) playStory('intro', () => { SAVE.introSeen = true; saveGame(); showMap(); });
  else showMap();
}
const MAP_POINTS = [[11, 80], [30, 68], [50, 77], [71, 66], [82, 40], [59, 30], [35, 24], [13, 32]];
function showMap() {
  leavePlay(); clearEnemies(); stopDances(); G.mode = 'story'; G.paused = false;
  G.state = 'map'; setMenuCam('map'); renderMap(); show('map'); refreshCurrency();
}
function renderMap() {
  const area = $('mapNodes'); area.innerHTML = '';
  const nodes = STAGES.length + 1; // + the ending
  const pts = MAP_POINTS.slice(0, nodes);
  // the glowing path
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` C ${x0 + (x1 - x0) * 0.5} ${y0}, ${x0 + (x1 - x0) * 0.5} ${y1}, ${x1} ${y1}`;
  }
  $('mapPath').innerHTML = `<path d="${d}" class="glow"/><path d="${d}" class="line"/>`;
  const current = Math.min(SAVE.unlocked, STAGES.length);
  for (let i = 0; i < nodes; i++) {
    const [x, y] = pts[i]; const el = document.createElement('button');
    const isEnd = i === STAGES.length; const st = STAGES[i];
    const locked = isEnd ? !SAVE.finished && SAVE.unlocked < STAGES.length : i > SAVE.unlocked;
    el.className = 'node' + (locked ? ' locked' : '') + (i === current && !isEnd ? ' current' : '') + (isEnd ? ' end' : '') + (st && st.type === 'quiz' ? ' quiz' : '');
    el.style.left = x + '%'; el.style.top = y + '%';
    let inner = '';
    if (isEnd) inner = `<span class="gift">💛</span><b class="num">♥</b><span class="lbl">The End</span>`;
    else if (st.type === 'night') {
      const got = SAVE.stars['n' + st.night] || 0;
      inner = `<span class="gift">🎁</span><b class="num">${st.night + 1}</b><span class="lbl">${stageName(i)}</span><span class="stars">${starRow(got)}</span>`;
    } else {
      inner = `<span class="gift">🌕</span><b class="num">?</b><span class="lbl">${stageName(i)}</span><span class="stars">${SAVE.quizPassed[i] ? '<i class="st on">♥</i> passed' : '<i class="st">♥</i> lives'}</span>`;
    }
    if (locked) inner += '<span class="lock">🔒</span>';
    el.innerHTML = inner;
    el.onclick = () => {
      audio();
      if (locked) { banner('Finish the earlier nights first', 1100); return; }
      if (isEnd) { finishAdventure(); return; }
      curStage = i;
      if (st.type === 'night') showFact(st.night); else quizStageIntro(i);
    };
    area.appendChild(el);
  }
  // the monkey stands on the current level
  const av = $('mapAvatar'); const [ax, ay] = pts[current];
  av.style.left = ax + '%'; av.style.top = ay + '%';
  if (THUMBS[SAVE.equipped]) av.src = THUMBS[SAVE.equipped];
}
function confirmNewStory() {
  overlay('Start the story again?', 'Your progress on the map and your ♥ lives go back to the start.<br>Your ★ stars and costumes are kept.',
    [['Yes, start again', () => { resetStory(); SAVE.introSeen = false; saveGame(); showMap(); }], ['Cancel', () => showMap(), true]]);
}

// ---------------------------------------------------------------------
//  MARKET: costumes for stars
// ---------------------------------------------------------------------
let marketSel = 'default';
function showMarket(from) {
  leavePlay(); clearEnemies(); G.state = 'market'; G.marketFrom = from || G.marketFrom || 'title';
  marketSel = SAVE.equipped; previewCostume(marketSel);
  setMenuCam('market'); renderMarket(); show('market'); refreshCurrency();
}
function previewCostume(id) { stopDances(); setCostume(id); M.animator.rest(); } // the monkey stands still in the market
function renderMarket() {
  const grid = $('mkGrid'); grid.innerHTML = '';
  for (const c of SETTINGS.costumes) {
    if (!T.costumes[c.id]) continue;
    const owned = SAVE.owned.includes(c.id), eq = SAVE.equipped === c.id;
    const card = document.createElement('button');
    card.className = 'card' + (marketSel === c.id ? ' sel' : '') + (eq ? ' eq' : '');
    card.innerHTML = `<img src="${THUMBS[c.id] || ''}" alt=""><b>${c.name}</b><span>${eq ? '✔ Wearing' : owned ? 'Owned' : `★ ${c.price}`}</span>`;
    card.onclick = () => { audio(); marketSel = c.id; previewCostume(c.id); renderMarket(); };
    grid.appendChild(card);
  }
  const c = SETTINGS.costumes.find((k) => k.id === marketSel);
  const owned = SAVE.owned.includes(c.id), eq = SAVE.equipped === c.id;
  $('mkName').textContent = c.name;
  const btn = $('mkBuy');
  if (eq) { btn.textContent = '✔ Wearing'; btn.disabled = true; }
  else if (owned) { btn.textContent = 'Wear it'; btn.disabled = false; }
  else { btn.textContent = `Buy for ★ ${c.price}`; btn.disabled = false; btn.classList.toggle('poor', starBalance() < c.price); }
  btn.onclick = () => {
    if (eq) return;
    if (!owned) {
      if (starBalance() < c.price) { banner(`You need ${c.price - starBalance()} more ★ — finish nights faster!`, 1800); return; }
      SAVE.spent += c.price; SAVE.owned.push(c.id); SFX.win();
    }
    SAVE.equipped = c.id; saveGame(); renderMarket();
  };
}
function leaveMarket() {
  stopDances(); setCostume(SAVE.equipped);
  if (G.marketFrom === 'map') showMap(); else toTitle();
}
// pictures of each costume for the market and the map (drawn once with the 3D engine)
const THUMBS = {};
function makeThumbs() {
  const size = 256;
  const rt = new THREE.WebGLRenderTarget(size, size); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const ts = new THREE.Scene();
  ts.add(new THREE.HemisphereLight(0xffffff, 0x886655, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, 2, 3); ts.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  const px = new Uint8Array(size * size * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
  for (const c of SETTINGS.costumes) {
    const t = T.costumes[c.id]; if (!t) continue;
    const o = SkeletonUtils.clone(t.root); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.visible = true;
    o.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh && m.material && m.material.map === shadowTex) m.visible = false; });
    ts.add(o);
    const h = SETTINGS.monkey.height;
    cam.position.set(0.0, h * 0.55, h * 2.3); cam.lookAt(0, h * 0.48, 0);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(ts, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.clearRect(0, 0, size, size); ctx.putImageData(img, 0, 0);
    THUMBS[c.id] = cv.toDataURL('image/png');
    ts.remove(o);
  }
  renderer.setRenderTarget(null); renderer.setClearColor(0x05060f, 1);
}

// ---------------------------------------------------------------------
//  2 PLAYERS: MONKEY vs MEGA COCKROACH (split screen)
// ---------------------------------------------------------------------
const D2 = { e: null, yaw: 0, pitch: 0.1, moving: false, cool: {}, charge: 0, hitDone: false, camPos: new THREE.Vector3(), camLook: new THREE.Vector3() };
const camera2 = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
function duelSetup() {
  audio(); G.state = 'duelSetup';
  const keysHelp = BIG
    ? `<b>Left side = 🐒 Monkey</b> · <b>Right side = 🪳 Mega cockroach</b><br>Each player has their own walk pad and attack buttons on their side of the screen.`
    : `<div class="twocol"><div><b>🐒 Monkey (left player)</b><br>W / S walk · A / D turn · Left Shift run<br>F hit · G kick · Q punch · E leg punch<br>R ULTRA (${SETTINGS.duel.ultras}) · Space jump</div>` +
      `<div><b>🪳 Mega cockroach (right player)</b><br>↑ / ↓ walk · ← / → turn<br>Enter bite · Right Shift charge</div></div>`;
  overlay('2 Players: Monkey vs Mega cockroach',
    `Two players, one screen. The screen is split in two: each player sees their own character.<br>` +
    `Bring the other player's life to 0 — or have more life left when the ${SETTINGS.duel.minutes}-minute timer runs out.<br><br>${keysHelp}`,
    [['Fight! ▸', () => startDuel()], ['Back', () => toTitle(), true]]);
}
function startDuel() {
  const D = SETTINGS.duel;
  leavePlay(); clearEnemies(); stopDances(); releaseButtons();
  if (girl) girl.visible = false;
  G.mode = 'duel'; G.state = 'play'; G.paused = false; G.time = 0; G.timeLeft = D.minutes * 60; G.invuln = 0;
  G.hp = D.monkeyHp; G.ultras = D.ultras; G.cool = {}; G.dark = false; applyLight(1); resetDoors();
  const [mx, mz] = snap(-5.75, -1.6, 0.16); M.pos.set(mx, 0, mz); M.y = 0; M.vy = 0; M.pitch = 0; M.knock.set(0, 0);
  const [ex, ez] = snap(-7.4, 2.35, 0.22);
  const e = spawnEnemy('mega', false, V2(ex, ez));
  e.player = true; e.hp = D.megaHp; e.maxHp = D.megaHp; e.speed = D.megaSpeed; D2.e = e; D2.cool = {}; D2.charge = 0;
  M.yaw = Math.atan2(ex - mx, ez - mz); D2.yaw = Math.atan2(mx - ex, mz - ez); e.yaw = D2.yaw;
  monkey.visible = true;
  hideScreens(); $('hud').classList.remove('on'); $('duelHud').classList.add('on');
  buildTouchUI('duel'); setMenuCam(null); updateDuelHud();
  banner('FIGHT!', 1200);
}
function duelLeader() {
  const m = G.hp / SETTINGS.duel.monkeyHp, c = D2.e ? D2.e.hp / D2.e.maxHp : 0;
  return m >= c ? 'monkey' : 'mega';
}
function duelEnd(winner) {
  if (G.state !== 'play' || G.mode !== 'duel') return;
  G.state = 'duelEnd'; leavePlay(); SFX.win();
  if (winner === 'monkey') M.animator.loopPlay('dance');
  else if (D2.e) { D2.e.dead = 0; D2.e.animator.loopPlay('dance'); }
  overlay(winner === 'monkey' ? '🐒 MONKEY WINS!' : '🪳 MEGA COCKROACH WINS!',
    `Monkey ♥ ${Math.max(0, Math.ceil(G.hp))} · Mega cockroach ♥ ${Math.max(0, Math.ceil(D2.e ? D2.e.hp : 0))}`,
    [['Rematch ▸', () => startDuel()], ['Main menu', () => toTitle(), true]], false, { clear: true });
}
function duelReady(name, cd) { if ((D2.cool[name] || 0) > G.time) return false; D2.cool[name] = G.time + cd; return true; }
function duelAttack(kind) {
  const e = D2.e, D = SETTINGS.duel; if (!e || G.state !== 'play' || G.paused) return;
  if (kind === 'bite') {
    if (!duelReady('bite', D.bite.cooldown)) return;
    e.animator.play('bite'); SFX.bite();
    const fx = Math.sin(D2.yaw), fz = Math.cos(D2.yaw), dx = M.pos.x - e.pos.x, dz = M.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d < D.bite.range + 0.15 && (dx * fx + dz * fz) / (d || 1) > 0.3 && Math.abs((e.y || 0) - M.y) < 0.35) hurtMonkey(D.bite.damage);
  } else if (kind === 'charge') {
    if (!duelReady('charge', D.charge.cooldown)) { banner('Charge is not ready yet', 700); return; }
    e.animator.play('charge'); D2.charge = 0.45; D2.hitDone = false; noise(0.4, 500, 0.3);
  }
}
function hurtMonkey(dmg) {
  if (G.invuln > 0) return;
  G.hp -= dmg; SFX.bite();
  if (G.mode !== 'duel') floatText(M.pos, '-' + dmg, '#ff6b5c');
  $('hurt').style.transition = 'none'; $('hurt').style.opacity = 0.9;
  requestAnimationFrame(() => { $('hurt').style.transition = 'opacity .5s'; $('hurt').style.opacity = 0; });
  if (G.mode === 'duel') updateDuelHud(); else updateHud();
  if (G.hp <= 0) monkeyDown();
}
function updateDuel(dt) {
  const e = D2.e; if (!e) return;
  const D = SETTINGS.duel, P = PADS[1];
  // player 2 controls: arrow keys (laptop) or the right-hand pad (big screen)
  let turn = 0, fw = 0;
  if (keys.ArrowLeft) turn += 1; if (keys.ArrowRight) turn -= 1;
  if (keys.ArrowUp) fw += 1; if (keys.ArrowDown) fw -= 0.7;
  fw += P.f;
  if (P.turn) { const st = Math.sign(P.turn) * Math.min(Math.abs(P.turn), 3.4 * dt); D2.yaw += st; P.turn -= st; }
  D2.yaw += (turn + P.turnHold) * 2.6 * dt;
  const fx = Math.sin(D2.yaw), fz = Math.cos(D2.yaw);
  let speed = e.speed * clamp(fw, -0.7, 1);
  if (D2.charge > 0) { // charging dash
    D2.charge -= dt; speed = D.charge.distance / 0.45;
    const d = Math.hypot(M.pos.x - e.pos.x, M.pos.z - e.pos.z);
    if (!D2.hitDone && d < e.rad + 0.3) {
      D2.hitDone = true; hurtMonkey(D.charge.damage);
      M.knock.set(fx * 5, fz * 5); banner('CHARGE!', 700);
    }
  }
  if (e.stun > 0) { e.stun -= dt; tryMove(e.pos, e.push.x * dt, e.push.y * dt, e.rad, CLIMB_ALL); e.push.multiplyScalar(Math.pow(0.02, dt)); speed = 0; }
  // the sideways step buttons of the pad move it sideways
  const sx = P.s * 0.8;
  const mvx = fx * speed + Math.cos(D2.yaw) * -sx * e.speed, mvz = fz * speed + -Math.sin(D2.yaw) * -sx * e.speed;
  D2.moving = Math.abs(speed) > 0.05 || Math.abs(sx) > 0.05;
  if (D2.moving) tryMove(e.pos, mvx * dt, mvz * dt, e.rad, CLIMB_ALL);
  e.yaw = D2.yaw;
  updateDuelHud();
}
function updateDuelHud() {
  const D = SETTINGS.duel, e = D2.e;
  $('d1Hp').style.width = clamp(G.hp / D.monkeyHp * 100, 0, 100) + '%'; $('d1Txt').textContent = Math.max(0, Math.ceil(G.hp));
  $('d1Ultra').textContent = G.ultras;
  if (e) { $('d2Hp').style.width = clamp(e.hp / e.maxHp * 100, 0, 100) + '%'; $('d2Txt').textContent = Math.max(0, Math.ceil(e.hp)); }
  const t = Math.max(0, G.timeLeft); $('dTimer').textContent = mmss(t);
  const cd = Math.max(0, (D2.cool.charge || 0) - G.time); $('d2Charge').textContent = cd > 0 ? cd.toFixed(1) + 's' : 'ready';
}
function stopDances() {
  Object.values(COSTUME_OBJ).forEach((c) => c.animator.stopLoop());
  if (D2.e) D2.e.animator.stopLoop();
}

// ---------------------------------------------------------------------
//  STORY GALLERY, FULL SCREEN, MENU BUTTONS
// ---------------------------------------------------------------------
function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  try { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
function gallery() {
  G.state = 'title';
  const back = () => { G.state = 'title'; gallery(); };
  overlay('Story gallery', 'Watch each part both ways to compare them.', [
    ['🎬 Intro', () => { audio(); playStory('intro', back, 'video'); }], ['📜 Intro', () => playStory('intro', back, 'slides'), true],
    ['🎬 End 1', () => playStory('ending', back, 'video')], ['📜 End 1', () => playStory('ending', back, 'slides'), true],
    ['🎬 End 2', () => playStory('badEnding', back, 'video')], ['📜 End 2', () => playStory('badEnding', back, 'slides'), true],
    ['◂ Back', () => toTitle(), true],
  ]);
  $('ovBtns').classList.add('grid2');
}
$('btnFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else goFullscreen(); };
$('btnStart').onclick = () => { if (BIG) goFullscreen(); play1p(); };
$('btnDuel').onclick = () => { if (BIG) goFullscreen(); duelSetup(); };
$('btnMarket').onclick = () => showMarket('title');
$('btnStyle').onclick = () => setStoryStyle(storyStyle === 'video' ? 'slides' : 'video');
updateStoryBtn();
$('btnGallery').onclick = () => gallery();
$('btnControls').onclick = () => overlay('Controls', '', [['Back', () => toTitle()]], true);
$('btnNight').onclick = () => beginNight();
$('mapHome').onclick = () => toTitle();
$('mapMarket').onclick = () => showMarket('map');
$('mapReset').onclick = () => confirmNewStory();
$('mkBack').onclick = () => leaveMarket();

// ---------------------------------------------------------------------
//  MENU CAMERAS (title orbit in the lounge, map in the girl's room, market, victory)
// ---------------------------------------------------------------------
let titleCam = true, menuMode = 'title';
function setMenuCam(mode) {
  menuMode = mode; titleCam = !!mode;
  menuLamp.intensity = mode === 'map' ? 2.2 : 0;
  if (mode) applyLight(mode === 'map' ? 0.38 : 1);
  moonDisc.visible = mode === 'map';
  if (girl) girl.visible = mode === 'title';
  if (!monkey) return;
  monkey.visible = mode !== 'map';
  if (mode === 'title') { M.pos.set(-6.4, 0, -0.2); M.yaw = 0.4; M.y = 0; M.ground = 0; if (girl) { girl.position.set(-5.55, 0, -2.05); girl.rotation.y = -0.35; } }
  if (mode === 'market') { M.pos.set(-6.0, 0, -0.35); M.yaw = 0; M.y = 0; M.ground = 0; }
  if (mode === 'victory') { M.y = M.ground || 0; }
}
// the moon outside the girl's window (seen behind the map)
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
moonDisc.position.set(1.7, 1.55, -9); moonDisc.visible = false; scene.add(moonDisc);
const menuLamp = new THREE.PointLight(0xffc98a, 0, 6, 1.4); menuLamp.position.set(1.25, 2.3, -1.6); scene.add(menuLamp);

// ---------------------------------------------------------------------
//  UPDATE LOOP
// ---------------------------------------------------------------------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateMonkey(dt) {
  const S = SETTINGS.monkey, P = PADS[0], duel = G.mode === 'duel';
  if (dt > 0) {
    if (G.invuln > 0) G.invuln -= dt;
    // knocked back by a charge
    if (M.knock.lengthSq() > 0.01) { tryMove(M.pos, M.knock.x * dt, M.knock.y * dt, 0.14, M.y + STEP); M.knock.multiplyScalar(Math.pow(0.02, dt)); }
  }
  let fw = 0, sd = 0;
  if (duel) { // 2 players: W/S walk, A/D turn (the arrows belong to player 2)
    if (keys.KeyA) M.yaw += S.turnSpeed * dt;
    if (keys.KeyD) M.yaw -= S.turnSpeed * dt;
    if (keys.KeyW) fw += 1;
    if (keys.KeyS) fw -= 0.75;
  } else {
    if (keys.ArrowLeft) M.yaw += S.turnSpeed * dt;
    if (keys.ArrowRight) M.yaw -= S.turnSpeed * dt;
    if (keys.KeyW || keys.ArrowUp) fw += 1;
    if (keys.KeyS || keys.ArrowDown) fw -= 0.75;
    if (keys.KeyD) sd += 0.85;
    if (keys.KeyA) sd -= 0.85;
    if (TOUCH.joyId !== null) { fw += -TOUCH.move.y; sd += TOUCH.move.x * 0.85; }
  }
  const f = forward(), rgt = new THREE.Vector2(-f.y, f.x); // monkey's right
  fw += P.f; sd += P.s * 0.85;
  M.yaw += P.turnHold * S.turnSpeed * 0.8 * dt;
  if (P.turn) { const st = Math.sign(P.turn) * Math.min(Math.abs(P.turn), S.turnSpeed * 1.4 * dt); M.yaw += st; P.turn -= st; }
  const joyRun = TOUCH.joyId !== null && Math.hypot(TOUCH.move.x, TOUCH.move.y) > 0.92 && -TOUCH.move.y > 0.5;
  const run = ((keys.ShiftLeft || (!duel && keys.ShiftRight) || P.run) && fw > 0) || joyRun ? SETTINGS.controls.runMultiplier : 1;
  let mx = f.x * fw + rgt.x * sd, mz = f.y * fw + rgt.y * sd;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const mv = Math.min(1, ml) * run;
  if (mv) { tryMove(M.pos, mx * S.speed * run * dt, mz * S.speed * run * dt, 0.14, M.y + STEP); M.walkT += dt * 11 * mv; }
  // jump / gravity: the floor is whatever furniture top is under the monkey
  M.ground = groundAt(M.pos.x, M.pos.z, 0.05, M.y + STEP);
  M.vy -= 9.8 * dt; M.y += M.vy * dt;
  if (M.y <= M.ground) { M.y = M.ground; M.vy = Math.max(0, M.vy); }
  M.air = M.y - M.ground;
  // ---- skeletal animation ----
  const walking = mv && M.air < 0.01;
  M.animator.setWalk(walking ? 1 : 0, Math.abs(mv) * S.speed);
  M.animator.update(dt);
  // small extra "body language" on top of the Blender clips
  let lunge = 0, spin = 0, hop = 0;
  if (M.anim) {
    M.anim += dt; const k = Math.min(1, M.anim / (M.animDur || 0.5));
    const s = Math.sin(k * Math.PI);
    if (M.animType === 'punch') lunge = 0.1 * s;
    if (M.animType === 'legPunch') hop = 0.06 * s;
    if (M.animType === 'ultra') { spin = k * Math.PI * 2; hop = 0.1 * s; }
    if (k >= 1) M.anim = 0;
  }
  monkey.position.set(M.pos.x + f.x * lunge, M.y + hop, M.pos.z + f.y * lunge);
  if (G.state === 'play') monkey.visible = !(G.invuln > 0 && Math.floor(G.invuln * 10) % 2); // blink after getting up
  monkey.rotation.set(0, M.yaw + spin, 0);
  monkey.children[1].position.y = M.ground - M.y - hop + 0.012; // keep shadow on what it stands on
  monkeyGlow.position.set(M.pos.x, 0.9, M.pos.z);
}
// ---------------------------------------------------------------------
//  CAMERA THAT NEVER LOSES THE MONKEY
//  A ray goes from the monkey's head to where the camera wants to be.
//  If a wall, door or piece of furniture is in between, the camera moves
//  in front of it (and rises a little so the monkey stays in view).
// ---------------------------------------------------------------------
const camBlockers = [];
const camRay = new THREE.Raycaster();
function collectCameraBlockers(root) {
  const skip = /Floor|Rug|Carpet|Ceil|Light|Lamp|Glass|Outline/i;
  const add = (o) => {
    if (!o.isMesh) return;
    const nm = o.name + ' ' + (o.parent ? o.parent.name : '');
    if (skip.test(nm) || (o.material && o.material.name === 'T_Outline')) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const ws = o.getWorldScale(new THREE.Vector3());
    if (o.geometry.boundingSphere.radius * Math.max(ws.x, ws.y, ws.z) < 0.12) return; // tiny things don't block
    camBlockers.push(o);
  };
  root.traverse(add);
  ROOMS.forEach((R) => R.pivot && R.pivot.traverse(add)); // doors (they swing, so they're checked live)
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
// distance from `from` along `dir` (unit) to the first blocker, or `far` if nothing is in the way
function camHit(from, dir, far) {
  let best = far;
  camRay.far = far; camRay.near = 0;
  camRay.set(from, dir);
  const a = camRay.intersectObjects(camBlockers, false); if (a.length) best = Math.min(best, a[0].distance);
  // also cast backwards: catches one-sided walls that face away from the monkey
  _v1.copy(from).addScaledVector(dir, far); _v2.copy(dir).negate();
  camRay.set(_v1, _v2);
  const b = camRay.intersectObjects(camBlockers, false); if (b.length) best = Math.min(best, far - b[b.length - 1].distance);
  return best;
}
// follow a character from behind; st = { pos, yaw, pitch, y, ground }
function followCam(cam, st, cp, cl, dt) {
  const f = new THREE.Vector2(Math.sin(st.yaw), Math.cos(st.yaw));
  const pitch = st.pitch || 0, y = st.y || 0, ground = st.ground || 0;
  const dist = 1.45 - pitch * 0.5, h = 0.95 + pitch * 0.9;
  const lift = ground + (y - ground) * 0.5;
  const head = new THREE.Vector3(st.pos.x, lift + y * 0.5 + 0.45, st.pos.z);
  const want = new THREE.Vector3(st.pos.x - f.x * dist, h + lift, st.pos.z - f.y * dist);
  const dir = want.clone().sub(head); const full = dir.length(); dir.normalize();
  const free = camHit(head, dir, full);
  const keep = Math.max(0.22, free - 0.12);
  const target = head.clone().addScaledVector(dir, keep);
  // squeezed close to a wall? go up a bit and look down at the character instead
  const squeeze = clamp(1 - keep / full, 0, 1);
  target.y += squeeze * 0.55;
  cp.lerp(target, 1 - Math.pow(0.0005, dt));
  // smoothing must never drag the camera through a wall: check the final spot too
  const d2 = cp.clone().sub(head); const len2 = d2.length();
  if (len2 > 0.01) {
    d2.normalize();
    const free2 = camHit(head, d2, len2);
    if (free2 < len2) cp.copy(head).addScaledVector(d2, Math.max(0.18, free2 - 0.1));
  }
  cl.set(st.pos.x + f.x * 0.6 * (1 - squeeze), 0.38 - pitch * 0.15 + lift + (y - lift) * 0.6, st.pos.z + f.y * 0.6 * (1 - squeeze));
  cam.position.copy(cp); cam.lookAt(cl);
}
function updateCamera(dt) {
  const t = performance.now();
  if (titleCam) {
    if (menuMode === 'map') { // inside the girl's room, looking at the moon in the window
      camPos.set(1.25 + Math.sin(t * 0.00012) * 0.08, 1.25, -0.35);
      camLook.set(1.55, 1.35, -3.4);
    } else if (menuMode === 'market') { // close-up of the monkey trying on clothes
      camPos.set(M.pos.x + 0.35, 0.52, M.pos.z + 1.25);
      camLook.set(M.pos.x + 0.42, 0.32, M.pos.z); // monkey on the left, costume list on the right
    } else if (menuMode === 'victory') { // slowly circle the dancing monkey
      const a = M.yaw + Math.sin(t * 0.0004) * 0.6;
      const head = new THREE.Vector3(M.pos.x, M.y + 0.4, M.pos.z);
      const dir = new THREE.Vector3(Math.sin(a), 0.35, Math.cos(a)).normalize();
      const d = Math.max(0.35, camHit(head, dir, 1.3) - 0.1);
      camPos.copy(head).addScaledVector(dir, d); camLook.set(M.pos.x, M.y + 0.3, M.pos.z);
    } else {
      const k = t * 0.00008;
      camPos.set(-6.8 + Math.sin(k) * 1.3, 1.25, 0.4 + Math.cos(k) * 1.8);
      camLook.set(-6.2, 0.45, -0.05);
    }
    camera.position.copy(camPos); camera.lookAt(camLook);
    return;
  }
  followCam(camera, M, camPos, camLook, dt);
  if (G.mode === 'duel' && D2.e) {
    const e = D2.e;
    followCam(camera2, { pos: e.pos, yaw: D2.yaw, pitch: 0.12, y: e.y || 0, ground: e.y || 0 }, D2.camPos, D2.camLook, dt);
  }
}

function updateEnemies(dt) {
  const n = night();
  const mp = new THREE.Vector2(M.pos.x, M.pos.z);
  for (const e of [...G.enemies]) {
    const o = e.obj;
    if (e.dead) { // squash animation then remove
      e.dead += dt; o.scale.set(1 + e.dead * 2, Math.max(0.05, 1 - e.dead * 5), 1 + e.dead * 2);
      if (e.dead > 0.3) removeEnemy(e); continue;
    }
    if (e.hidden) {
      o.visible = false;
      if (!n.cockroachesHide || e.kind === 'mega' || G.dark) { e.hidden = false; o.visible = true; o.scale.setScalar(0.01); }
      continue;
    }
    if (o.scale.x < 1) o.scale.setScalar(Math.min(1, o.scale.x + dt * 4));
    e.wob += dt * (8 + e.speed * 6);
    let dir = new THREE.Vector2(); let speed = e.speed;
    if (e.player) { // the mega cockroach in the duel: moved by player 2 (updateDuel)
      e.moving = D2.moving;
    } else if (e.lurk) { // waiting in a room for the monkey to come close
      e.moving = false;
      const d = Math.hypot(M.pos.x - e.pos.x, M.pos.z - e.pos.z);
      const sameRoom = region(e.pos.x, e.pos.z) === region(M.pos.x, M.pos.z);
      if (d < n.ambush.triggerDistance && (sameRoom || d < 1.4)) wakeGroup(e.lurk);
      if (d < 4) e.yaw = Math.atan2(M.pos.x - e.pos.x, M.pos.z - e.pos.z); // watching you…
    } else if (e.stun > 0) {
      e.stun -= dt;
      tryMove(e.pos, e.push.x * dt, e.push.y * dt, e.rad, CLIMB_ALL); e.push.multiplyScalar(Math.pow(0.02, dt));
    } else {
      // should it run and hide? (only in the light, only smart cockroaches)
      const flee = n.cockroachesHide && e.kind !== 'mega' && !G.dark;
      let target;
      if (flee) {
        if (!e.fleeTo) { e.fleeTo = nearestHide(e.pos); e.fleeTime = 0; }
        target = e.fleeTo; speed *= 1.5; e.fleeTime += dt;
        if (Math.hypot(target.x - e.pos.x, target.y - e.pos.z) < 0.18 || e.fleeTime > 6) { e.hidden = true; e.fleeTo = null; e.pos.set(target.x, 0, target.y); continue; }
      } else {
        e.fleeTo = null; target = mp;
      }
      // find the way (through doors / the corridor-hub junction)
      const [gx, gz] = steerGoal(e, target.x, target.y, dt);
      dir.set(gx - e.pos.x, gz - e.pos.z);
      const dist = dir.length(); dir.normalize();
      // a little wiggle so they look alive
      dir.rotateAround(new THREE.Vector2(), Math.sin(e.wob * 0.35) * 0.35);
      // don't stack on top of each other
      for (const o2 of G.enemies) {
        if (o2 === e || o2.dead || o2.hidden) continue;
        const dx = e.pos.x - o2.pos.x, dz = e.pos.z - o2.pos.z, d = Math.hypot(dx, dz), min = e.rad + o2.rad + 0.04;
        if (d < min && d > 0.001) { dir.x += dx / d * 0.8; dir.y += dz / d * 0.8; }
      }
      const toMonkey = Math.hypot(M.pos.x - e.pos.x, M.pos.z - e.pos.z);
      if (!flee && toMonkey < e.rad + 0.17) speed = 0; // close enough to bite
      e.moving = speed > 0;
      if (speed > 0) { dir.normalize(); if (!tryMove(e.pos, dir.x * speed * dt, dir.y * speed * dt, e.rad, CLIMB_ALL)) e.wob += 2; }
      if (speed > 0 && dir.lengthSq() > 0) e.yaw = Math.atan2(dir.x, dir.y);
      // bite
      e.biteT -= dt;
      if (!flee && toMonkey < e.rad + 0.24 && M.air < 0.12 && Math.abs((e.y || 0) - M.y) < 0.2 && e.biteT <= 0 && G.invuln <= 0) {
        e.biteT = e.cfg.biteEvery; e.animator.play('bite');
        hurtMonkey(e.cfg.biteDamage); if (G.state !== 'play') return;
      }
    }
    // draw + animate
    e.animator.setWalk(e.stun > 0 ? 0 : (e.moving ? 1 : 0), e.moving ? e.speed : 0);
    e.animator.update(dt);
    const gy = groundAt(e.pos.x, e.pos.z, 0.02);
    e.y = (e.y ?? gy) + (gy - (e.y ?? gy)) * Math.min(1, dt * 10); // climb smoothly
    o.position.set(e.pos.x, e.y, e.pos.z);
    let dy = e.yaw - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 12);
    if (e.flash > 0) e.flash -= dt;
    const fl = e.flash > 0 ? 1 : 0;
    if (e.lastFl !== fl) { e.lastFl = fl; o.traverse((m) => { if (m.isMesh && m.material.emissive) m.material.emissiveIntensity = CHAR_GLOW + fl * 1.5; }); }
  }
}

// ---------- night 3: groups waiting in rooms ----------
function wakeGroup(id) {
  let n = 0;
  G.enemies.forEach((e) => { if (e.lurk === id) { e.lurk = 0; n++; } });
  if (n) { banner(n > 3 ? 'AMBUSH!' : 'They found you!', 900); SFX.dark(); }
}
function randomRoomSpot(R, rad) {
  for (let i = 0; i < 40; i++) {
    const x = rand(R.inner.x0, R.inner.x1), z = rand(R.inner.z0, R.inner.z1);
    if (walkable(x, z, rad)) return V2(x, z);
  }
  return null;
}
function spawnGroup(cfg, maxCount) {
  const here = region(M.pos.x, M.pos.z);
  const rooms = ROOMS.filter((R) => R.id !== here && Math.hypot(R.center.x - M.pos.x, R.center.y - M.pos.z) > 3.5);
  if (!rooms.length) return 0;
  const R = rooms[Math.floor(Math.random() * rooms.length)];
  const spot = randomRoomSpot(R, 0.3); if (!spot) return 0;
  const id = ++G.groupId;
  const count = Math.min(maxCount, cfg.groupMin + Math.floor(Math.random() * (cfg.groupMax - cfg.groupMin + 1)));
  for (let i = 0; i < count; i++) {
    let p = V2(spot.x + rand(-0.3, 0.3), spot.y + rand(-0.3, 0.3));
    if (!walkable(p.x, p.y, 0.1)) p = spot.clone();
    const e = spawnEnemy('roach', false, p); e.lurk = id; e.yaw = rand(0, 6);
  }
  return count;
}

function updateSpawns(dt) {
  const n = night();
  if (n.ambush) {
    G.spawnT -= dt;
    const alive = G.enemies.filter((e) => !e.dead && e.kind === 'roach').length;
    const groups = new Set(G.enemies.filter((e) => !e.dead && e.lurk).map((e) => e.lurk)).size;
    const room = Math.min(n.maxAliveCockroaches, n.goal.cockroach - G.kills + 4) - alive;
    if (G.spawnT <= 0 && groups < n.ambush.maxWaitingGroups && room >= n.ambush.groupMin) {
      G.spawnT = n.spawnEvery * rand(0.7, 1.3); spawnGroup(n.ambush, room);
    }
    return;
  }
  const roaches = G.enemies.filter((e) => e.kind === 'roach' && !e.dead).length;
  const megas = G.enemies.filter((e) => e.kind === 'mega' && !e.dead).length;
  G.spawnT -= dt;
  const roachesNeeded = n.goal.cockroach - G.kills;
  if (G.spawnT <= 0 && roaches < n.maxAliveCockroaches && roaches < roachesNeeded + 4) {
    G.spawnT = n.spawnEvery * rand(0.7, 1.3); spawnEnemy('roach', n.cockroachesHide);
  }
  if (n.maxAliveMegas) {
    G.megaSpawnT -= dt;
    if (G.megaSpawnT <= 0 && megas < n.maxAliveMegas && megas < n.goal.mega - G.megaKills) {
      G.megaSpawnT = n.megaSpawnEvery * rand(0.7, 1.3);
      spawnEnemy('mega', false); banner('A MEGA cockroach appears!', 1300);
    }
  }
}

function updateBlackout(dt) {
  const n = night(); if (!n.blackout) return;
  G.blackT -= dt;
  const B = n.blackout;
  if (!G.dark) {
    // flicker warning in the last second before darkness
    if (G.blackT < 1) applyLight(Math.random() < 0.35 ? 0.25 : 1); else applyLight(1);
    if (G.blackT <= 0) { G.dark = true; G.blackT = B.duration; SFX.dark(); applyLight(0); $('lightTxt').textContent = '🌑 LIGHTS OUT'; }
  } else {
    applyLight(0);
    if (G.blackT <= 0) { G.dark = false; G.blackT = B.every; applyLight(1); $('lightTxt').textContent = n.cockroachesHide ? 'they are hiding…' : ''; }
  }
}

function updateTimer(dt) {
  G.timeLeft -= dt;
  const t = Math.max(0, G.timeLeft);
  if (G.mode === 'duel') { if (G.timeLeft <= 0) timeUp(); return; }
  $('timer').textContent = mmss(t);
  $('timer').classList.toggle('low', t < 30);
  // how many stars the night is heading for
  const S = SETTINGS.stars, now = starsFor(G.time);
  const next = now === 3 ? `before ${mmss(S.threeUnder)}` : now === 2 ? `before ${mmss(S.twoUnder)}` : '';
  $('starNow').innerHTML = starRow(now) + (next ? ` <span class="small">${next}</span>` : '');
  if (G.timeLeft <= 0) timeUp();
}

let last = performance.now();
const perf = { t: 0, n: 0 };
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = (now - last) / 1000; const dt = Math.min(0.05, rawDt); last = now;
  // keep it smooth: lower the drawing resolution if frames are slow, raise it again when there is room
  perf.t += rawDt; perf.n++;
  if (perf.t > 2) {
    const fps = perf.n / perf.t; perf.t = 0; perf.n = 0;
    if (fps < 40 && renderScale > DISPLAY.minRenderScale) { renderScale = Math.max(DISPLAY.minRenderScale, renderScale * 0.85); applySize(); }
    else if (fps > 57 && renderScale < 1) { renderScale = Math.min(1, renderScale * 1.1); applySize(); }
  }
  if (G.state === 'play' && !G.paused) {
    G.time += dt;
    if (G.mode === 'duel') {
      updateMonkey(dt); updateDuel(dt); updateDoors(dt); updateEnemies(dt); updateTimer(dt);
    } else {
      updateMonkey(dt); updateDoors(dt); updateSpawns(dt); updateEnemies(dt); updateBlackout(dt); updateTimer(dt);
      // the sound of little feet
      G.scuttleT -= dt;
      if (G.scuttleT <= 0) { G.scuttleT = rand(0.05, 0.25); if (G.enemies.some((e) => !e.dead && (!e.hidden || night().title === 'Night 1'))) SFX.scuttle(); }
    }
  } else if (monkey) {
    updateMonkey(0); M.animator.update(dt); // menus: keep animations (dances) moving
    if (G.state === 'duelEnd' && D2.e) D2.e.animator.update(dt);
  }
  updatePrompt();
  $('touchui').classList.toggle('on', G.state === 'play' && !G.paused);
  updateEffects(dt);
  updateCamera(dt);
  const split = G.mode === 'duel' && (G.state === 'play' || G.state === 'duelEnd' || (G.state === 'overlay' && D2.e));
  const w = innerWidth, h = innerHeight;
  if (split && D2.e) { // two players: left half = monkey, right half = mega cockroach
    renderer.setScissorTest(true);
    fitCam(camera, (w / 2) / h); renderer.setViewport(0, 0, w / 2, h); renderer.setScissor(0, 0, w / 2, h); renderer.render(scene, camera);
    fitCam(camera2, (w / 2) / h); renderer.setViewport(w / 2, 0, w / 2, h); renderer.setScissor(w / 2, 0, w / 2, h); renderer.render(scene, camera2);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
  } else {
    fitCam(camera, w / h); renderer.render(scene, camera);
  }
}

// ---------------------------------------------------------------------
//  START
// ---------------------------------------------------------------------
(async () => {
  try {
    await loadAll();
  } catch (err) {
    $('loadtxt').innerHTML = 'Could not load the 3D models.<br>If you opened index.html directly, start the game with <b>Play Game.bat</b> instead.<br><small>' + err + '</small>';
    console.error(err); return;
  }
  makeMonkey();
  girl = cloneWithMaterials(T.girl); addShadow(girl, 0.3); scene.add(girl);
  const ga = new Animator(girl, T.clips.girl, SETTINGS.animations.girl, girl.userData.scale); girl.userData.animator = ga;
  try { makeThumbs(); } catch (e) { console.warn('thumbnails', e); }
  applyLight(1); setMenuCam('title'); refreshCurrency();
  G.state = 'title'; show('title');
  requestAnimationFrame(loop);
})();

// handy for testing in the browser console
window.__game = { G, M, SAVE, SETTINGS, scene, camera, spawnEnemy, showFact, beginNight, showMap, showMarket, startDuel, duelSetup, nightComplete, monkeyDown, setCostume, T, D2, PADS, attack, duelAttack, toTitle, quizStageIntro, startQuiz, finishQuiz, keys };
