import * as THREE from 'three';
import { makeContext } from './lib/context.js';
import * as baseMod from './parts/base.js';
import * as periMod from './parts/peri.js';
import * as mercuryMod from './parts/mercury.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (t) => t * t * (3 - 2 * t);

// ILLUSTRATIVE motion constants. The real insertion angle and slide distance are NOT known
// (take them from Jens's insertion video). SO-DIMM style: enter at an angle, then press down.
const INSERT_ANGLE = THREE.MathUtils.degToRad(28);
const SLIDE = 22;            // mm along the tilted axis at the fully separated pose
// Exploded view: separate along the mating axis (straight up) so it is obvious what mates with what.
const EXPLODE_MERCURY_Y = 46, EXPLODE_PERI_Y = 30, EXPLODE_PERI_X = 0;

/**
 * Builds the whole kit from the three part modules and returns a small control API.
 * Frame: board-local axes everywhere (+x right in photo, +z down in photo, +y up); the base board sits at the origin.
 */
export async function createUniJack({ baseUrl } = {}) {
  const ctx = await makeContext(baseUrl);
  const [base, peri, mercury] = await Promise.all([baseMod, periMod, mercuryMod].map(async (m) => m.build(ctx)));   // builders may be async

  const root = new THREE.Group(); root.name = 'UniJack-kit';
  const merPivot = new THREE.Group(); merPivot.name = 'mercury-pivot';   // origin = module FINGERS edge, top surface
  const periRig = new THREE.Group(); periRig.name = 'peri-rig';
  root.add(base, merPivot, periRig);
  merPivot.add(mercury); mercury.position.set(ctx.dims.mercury[0] / 2, 0, 0);
  periRig.add(peri);

  const A = base.userData.anchors || {};
  const sock = { x: -37, z: -2.5, seatY: 3.5, ...(A.socket || {}) };
  const mount = { x: 58.5, z: 0, y: 9.6, ...(A.periMount || {}) };   // y = height of the PeriBoard TOP surface above the base top surface
  const merT = mercury.userData.anchors?.thickness ?? 1.2;
  const latches = (base.userData.latches || []).map((l) => {
    l.obj.userData._q0 = l.obj.quaternion.clone();
    return { ...l, axis: new THREE.Vector3(...l.axis).normalize() };
  });

  // dashed guide lines from each board's seated position to where it is now (visible while exploded / not seated)
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 2 * 3), 3));
  const guideMat = new THREE.LineDashedMaterial({ color: 0x74e2f4, dashSize: 1.8, gapSize: 1.4, transparent: true, opacity: 0, depthWrite: false });
  const guides = new THREE.LineSegments(guideGeo, guideMat);
  guides.name = 'explode-guides'; guides.frustumCulled = false; guides.visible = false; guides.renderOrder = 5;
  root.add(guides);
  const [mW, mL] = ctx.dims.mercury, [pW, pD] = ctx.dims.peri;
  const tmp = new THREE.Vector3();
  function updateGuides(e) {
    const a = guideGeo.attributes.position; let n = 0;
    const put = (v) => { a.setXYZ(n++, v.x, v.y, v.z); };
    root.updateMatrixWorld(true);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {           // Mercury underside corners
      put(tmp.set(sock.x + mW / 2 + sx * mW / 2, sock.seatY, sock.z + sz * mL / 2));
      put(mercury.localToWorld(tmp.set(sx * mW / 2, -merT, sz * mL / 2)));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {           // PeriBoard underside corners
      put(tmp.set(mount.x + sx * pW / 2, mount.y - ctx.BOARD_T, mount.z + sz * pD / 2));
      put(peri.localToWorld(tmp.set(sx * pW / 2, -ctx.BOARD_T, sz * pD / 2)));
    }
    a.needsUpdate = true; guideGeo.computeBoundingSphere(); guides.computeLineDistances();
    guides.visible = e > 0.02 || state.insertion < 0.98; guideMat.opacity = 0.8 * Math.max(e, state.insertion < 0.98 ? 0.6 : 0);
  }

  const state = { insertion: 1, explode: 0 };
  const q = new THREE.Quaternion();
  function apply() {
    const ins = state.insertion, e = ease(state.explode);
    const a = clamp01(ins / 0.62), b = clamp01((ins - 0.62) / 0.38);
    const theta = INSERT_ANGLE * (1 - ease(b));
    const s = SLIDE * (1 - ease(a));
    const x0 = sock.x, y0 = sock.seatY + merT;
    merPivot.position.set(x0 + s * Math.cos(INSERT_ANGLE), y0 + s * Math.sin(INSERT_ANGLE) * (1 - ease(b)) + e * EXPLODE_MERCURY_Y, sock.z);
    if (b > 0) merPivot.position.set(x0, y0 + e * EXPLODE_MERCURY_Y, sock.z);   // rotate-down phase pivots in place
    merPivot.rotation.set(0, 0, theta);
    periRig.position.set(mount.x + e * EXPLODE_PERI_X, mount.y + e * EXPLODE_PERI_Y, mount.z);
    const closed = ease(clamp01((ins - 0.82) / 0.18)) * (1 - e);   // latches click shut at the very end, and spring open when the module is lifted out
    for (const l of latches) {
      q.setFromAxisAngle(l.axis, l.openAngle * (1 - closed));
      l.obj.quaternion.copy(l.obj.userData._q0).multiply(q);
    }
    updateGuides(e);
  }
  apply();

  const parts = [];
  root.traverse((o) => { if (o.userData?.label && o.userData.kind !== 'board') parts.push(o); });

  return {
    root, base, peri, mercury, merPivot, periRig, ctx, parts,
    state,
    setInsertion(t) { state.insertion = clamp01(t); apply(); },
    setExplode(t) { state.explode = clamp01(t); apply(); },
    setVisible({ base: b = true, peri: p = true, mercury: m = true } = {}) { base.visible = b; periRig.visible = p; merPivot.visible = m; },
    /** climb from a picked mesh to the nearest object that carries a label */
    infoFor(obj) { while (obj) { if (obj.userData?.label && obj.userData.kind !== 'board') return obj; obj = obj.parent; } return null; },
  };
}
