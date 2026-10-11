import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const BG = '#080b10';
// graded studio backdrop (a rendering choice, not the photo's white sweep): like a dark sweep lit from the front it is lightest at the horizon,
// where it meets the satin table, and falls off to near-black overhead. The values are PRE tone mapping: Khronos PBR Neutral subtracts a black
// offset from dark colours (and shifts their hue), so '#44474b' comes out about (38,42,47) and '#282a2c' about (10,13,17) on screen.
export const BACKDROP_TOP = '#282a2c', BACKDROP_BOTTOM = '#44474b';

/**
 * Procedural studio for image-based lighting (rendered once through PMREMGenerator, like RoomEnvironment):
 * a large soft key box above-front-left (slightly warm), a cooler fill panel front-right, a cool rim strip behind,
 * and a graded room (dark floor, dim cool ceiling). Units are arbitrary; everything sits inside the PMREM far plane (100).
 * The direction of the key agrees with gallery-1.jpg, where the headers' shadows fall to the lower right.
 */
export class StudioEnvironment extends THREE.Scene {
  constructor({ key = 5.5, fill = 3.6, rim = 4.5, top = 0.35, bottom = 0.08 } = {}) {
    super();
    this.name = 'StudioEnvironment';
    const emit = (r, g, b, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r * k, g * k, b * k), side: THREE.FrontSide });
    // room: vertex-graded box seen from inside
    const room = new THREE.BoxGeometry(70, 44, 70); room.deleteAttribute('uv');
    const pos = room.getAttribute('position'), col = new Float32Array(pos.count * 3), cT = new THREE.Color(0.70, 0.80, 0.92), cB = new THREE.Color(0.9, 0.95, 1.0);
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.smoothstep((pos.getY(i) + 22) / 44, 0, 1), k = THREE.MathUtils.lerp(bottom, top, t);
      col[i * 3] = THREE.MathUtils.lerp(cB.r, cT.r, t) * k; col[i * 3 + 1] = THREE.MathUtils.lerp(cB.g, cT.g, t) * k; col[i * 3 + 2] = THREE.MathUtils.lerp(cB.b, cT.b, t) * k;
    }
    room.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const roomMesh = new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    roomMesh.position.y = 12; this.add(roomMesh);
    const panel = (w, h, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.lookAt(0, 0, 0); this.add(m); return m; };
    this.key = panel(40, 28, -17, 24, 16, emit(1.0, 0.955, 0.90, key));     // big soft box, above and in front, from the left: slightly warm
    this.fill = panel(34, 24, 26, 6, 18, emit(0.84, 0.91, 1.0, fill));      // cool fill, low and to the right (lights the vertical faces and the pins)
    this.rim = panel(44, 3.5, 6, 11, -30, emit(0.62, 0.84, 1.0, rim));      // thin cool strip behind the subject: edge light on the connectors and the board edge
    this.ceil = panel(44, 44, 0, 33, -6, emit(0.80, 0.87, 0.96, top * 2.0)); this.ceil.rotation.set(Math.PI / 2, 0, 0);
  }
}

/** Graded backdrop: a big dome, one colour at and below the horizon (where the satin table fades into it) grading to a darker one overhead. */
function makeBackdrop(radius, topHex, horizonHex) {
  const g = new THREE.SphereGeometry(radius, 48, 24), pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(topHex), hor = new THREE.Color(horizonHex), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const t = THREE.MathUtils.smoothstep(pos.getY(i) / radius, 0.0, 0.55); c.lerpColors(hor, top, t); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));   // tone mapped like everything else, so the plain and the composer path agree
  m.name = 'backdrop'; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
  return m;
}

const GROUND_SIZE = 1600;
function radialAlpha(N = 256, r0 = 200 / GROUND_SIZE, r1 = 520 / GROUND_SIZE) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5), a = 1 - THREE.MathUtils.smoothstep(r, r0, r1), i = (y * N + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(a * 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export function buildEnvironment(renderer, kind = 'studio') {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = kind === 'room' ? pmrem.fromScene(new RoomEnvironment(), 0.03) : pmrem.fromScene(new StudioEnvironment(), 0.02);
  pmrem.dispose();
  return env;
}

/**
 * Lighting rig shared by the viewer and the QA renderer so QA images show what users see.
 *   env: 'studio' (default) | 'room' (the previous RoomEnvironment rig, kept for comparison)
 *   shadowType: 'pcf' (default: 5-tap Vogel PCF with a radius) | 'vsm'
 * Tone mapping and the colour space are set on the renderer; when the viewer renders through the EffectComposer (lib/post.js) the
 * OutputPass applies the same settings at the end of the chain, so the picture is identical either way.
 */
export function makeStage(renderer, { shadows = true, env = 'studio', shadowType = 'pcf', ground = env === 'studio' ? 'satin' : 'catcher' } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;   // Khronos PBR Neutral: keeps solder-mask hue and saturation (ACES lifts red in saturated teal)
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = shadowType === 'vsm' ? THREE.VSMShadowMap : THREE.PCFShadowMap;   // PCFSoftShadowMap was removed in r18x and logged a warning on every load

  const scene = new THREE.Scene();
  const studio = env === 'studio';
  scene.background = new THREE.Color(studio ? BACKDROP_BOTTOM : BG);
  let backdrop = null;
  if (studio) { backdrop = makeBackdrop(1800, BACKDROP_TOP, BACKDROP_BOTTOM); scene.add(backdrop); }   // radius: inside the QA camera's far plane (3000) from any orbit distance (max 900)
  let envRT = buildEnvironment(renderer, env);
  scene.environment = envRT.texture; scene.environmentIntensity = studio ? 1.25 : 0.85;   // 1.25 restores the solder-mask luminance the photo material was calibrated for (see README)

  // the studio map carries the ambient and the soft specular; the hemisphere only lifts the deepest shadows a little
  scene.add(new THREE.HemisphereLight('#dff1ff', '#0b1118', studio ? 0.25 : 0.8));
  const key = new THREE.DirectionalLight('#fff1dd', studio ? 1.7 : 2.3);       // the shadow-casting part of the key box; warm like the panel
  key.position.set(-90, 170, 70); key.castShadow = shadows;
  key.shadow.mapSize.set(studio ? 4096 : 2048, studio ? 4096 : 2048);
  Object.assign(key.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 500 });
  if (shadowType === 'vsm') { key.shadow.bias = -0.0002; key.shadow.normalBias = 0.2; key.shadow.radius = 6; key.shadow.blurSamples = 12; }
  else { key.shadow.bias = -0.0003; key.shadow.normalBias = 0.3; key.shadow.radius = studio ? 32 : 1; }   // radius in shadow-map texels (5-tap Vogel disk)
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight('#6fd6ff', studio ? 0.55 : 1.2);
  rim.position.set(120, 60, -130); scene.add(rim);

  let groundMesh;
  if (ground === 'satin') {
    // dark satin table: a MeshStandardMaterial that reflects the studio map (the soft key box reads as a broad sheen) and receives the key's shadow.
    // It is a disc that fades out between 200 and 520 mm from the kit: far away, at grazing angles, Fresnel would turn it into a bright mirror
    // of the studio walls and draw a horizon line against the backdrop.
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new THREE.MeshStandardMaterial({
      color: '#0c1014', roughness: 0.55, metalness: 0.0, envMapIntensity: 0.16, alphaMap: radialAlpha(), transparent: true, depthWrite: false,
    }));
  } else {
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({ opacity: 0.3 }));
  }
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.position.y = -1.75; groundMesh.receiveShadow = true; groundMesh.name = 'ground';
  scene.add(groundMesh);

  /** Fit the key's orthographic shadow camera tightly around a world-space box (plus its shadow on the ground), so the 4k map's texels are spent on the kit. */
  const _c = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
  function fitShadow(box, margin = 6) {
    if (!box || box.isEmpty()) return;
    const b = box.clone(); b.min.y = Math.min(b.min.y, groundMesh.position.y); b.expandByScalar(margin);
    b.getCenter(_c); key.target.position.copy(_c); key.target.updateMatrixWorld();
    const dir = key.position.clone().normalize(), dist = b.getSize(_p).length();
    key.position.copy(_c).addScaledVector(dir, dist * 1.5); key.updateMatrixWorld();
    // light view matrix (the light object itself is never rotated; its shadow camera looks from the light at the target)
    _m.lookAt(key.position, _c, new THREE.Vector3(0, 1, 0)).setPosition(key.position).invert();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(_m);
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z);
    }
    const cam = key.shadow.camera;
    cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1; cam.near = Math.max(0.5, -z1 - 2); cam.far = -z0 + 2;
    cam.updateProjectionMatrix();
  }
  /** Rebuild the environment map (after a WebGL context loss; the old target's GL objects died with the context). */
  function rebuildEnvironment() { envRT = buildEnvironment(renderer, env); scene.environment = envRT.texture; stage.env = envRT; return envRT; }

  const stage = { scene, key, rim, ground: groundMesh, backdrop, env: envRT, envKind: env, fitShadow, rebuildEnvironment };
  return stage;
}
