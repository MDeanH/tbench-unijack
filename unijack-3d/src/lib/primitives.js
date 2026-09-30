import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { planarUV } from './frame.js';

/**
 * Attach metadata to an object. The viewer, the part inspector and the GLB export read this.
 *   ref    designator exactly as printed on the board and legible in a photo (e.g. "J303"), else omit
 *   label  short human name, e.g. "RJ45 jack"
 *   kind   'board' | 'connector' | 'ic' | 'passive' | 'cap' | 'pin' | 'latch' | 'led' | 'module' | 'other'
 *   status 'photo-derived'   footprint measured from a photo, height/shape assumed
 *          'photo-verified'  something legible in a photo (marking, designator)
 *          'assumed'         not visible in any photo (underside, heights, stack height)
 *   desc   one honest sentence; say "appears to be" where function is inferred from shape
 */
export function meta(obj, ud) {
  Object.assign(obj.userData, ud);
  if (ud.ref) obj.name = ud.ref; else if (ud.id) obj.name = ud.id; else if (ud.label && !obj.name) obj.name = ud.label;
  return obj;
}

/**
 * Extruded box component sitting on y = y0 (default: the board top, y = 0).
 * size = [w (x), h (height, y), d (z)] in mm; pos = [cx, y0, cz] (board-local).
 * `top` may be a photo material (then the top face is planar-projected from the photo).
 * Material order follows BoxGeometry: +x, -x, +y(top), -y, +z, -z.
 */
export function boxPart(parent, { frame, size: [w, h, d], pos: [cx, y0 = 0, cz], rotY = 0, radius = 0, top, side, bottom, name, ud }) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)) : new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, [side, side, top || side, bottom || side, side, side]);
  m.position.set(cx, y0, cz); m.rotation.y = rotY;
  // parts hanging from the BACK of a board: pass a photo `bottom` material (back photo) and they get mirrored-x bottom UVs
  if (((top && top.map) || (bottom && bottom.map)) && frame) planarUV(geo, frame, [cx, y0, cz], rotY, { mirrorBottom: !!(bottom && bottom.map) });
  if (name) m.name = name;
  if (ud) Object.assign(m.userData, ud);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Upright cylinder (capacitor can, screw head, standoff). Material order: side, top cap, bottom cap. */
export function cylPart(parent, { frame, r, h, pos: [cx, y0 = 0, cz], top, side, bottom, segments = 32, name, ud }) {
  const geo = new THREE.CylinderGeometry(r, r, h, segments);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, [side, top || side, bottom || side]);
  m.position.set(cx, y0, cz);
  if (((top && top.map) || (bottom && bottom.map)) && frame) planarUV(geo, frame, [cx, y0, cz], 0, { mirrorBottom: !!(bottom && bottom.map) });
  if (name) m.name = name;
  if (ud) Object.assign(m.userData, ud);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Many identical-geometry things (IC leads, header pins, SMD pads) as one draw call.
 * items: [{ p:[x,y,z], s:[sx,sy,sz], ry?:radians }] - `geometry` is a unit-size geometry that is scaled per item.
 */
export function instanced(parent, geometry, material, items, name) {
  const im = new THREE.InstancedMesh(geometry, material, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(...it.p); o.scale.set(...it.s); o.rotation.set(0, it.ry || 0, 0); o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true; im.receiveShadow = true;
  if (name) im.name = name;
  parent.add(im);
  return im;
}
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * Gull-wing leads around a rectangular IC body (TSSOP, SOIC, QFP...). Two instances per lead (shoulder + foot).
 * sides: 'x' -> leads leave the body along +/-x, spaced along z;  'z' -> leave along +/-z, spaced along x.
 */
export function gullLeads(parent, mat, { cx, cz, bodyW, bodyD, sides = 'x', n, pitch, leadLen = 0.9, leadW = 0.22, leadT = 0.15, yMid = 0.45, name = 'leads' }) {
  const items = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * pitch;
      if (sides === 'x') {
        const xb = cx + side * (bodyW / 2 + leadLen / 2 - 0.05);
        items.push({ p: [xb, yMid, cz + off], s: [leadLen * 0.55, leadT, leadW] });
        items.push({ p: [cx + side * (bodyW / 2 + leadLen * 0.8), leadT / 2, cz + off], s: [leadLen * 0.45, leadT, leadW] });
      } else {
        const zb = cz + side * (bodyD / 2 + leadLen / 2 - 0.05);
        items.push({ p: [cx + off, yMid, zb], s: [leadW, leadT, leadLen * 0.55] });
        items.push({ p: [cx + off, leadT / 2, cz + side * (bodyD / 2 + leadLen * 0.8)], s: [leadW, leadT, leadLen * 0.45] });
      }
    }
  }
  return instanced(parent, UNIT_BOX, mat, items, name);
}

/** The PCB itself: a slab whose top face shows the photo (top surface at y = 0, body below). */
export function boardSlab(parent, { frame, topTex, bottomTex = null, mats, thickness = 1.6, radius = 0.8, name = 'pcb', box = null }) {
  // `box` = [x0,y0,x1,y1] texture pixels of the real board inside the texture (crops carry a little white margin).
  // The slab covers only that area; the texture and every pixel coordinate stay unchanged.
  const b = box ? frame.box(box) : { cx: 0, cz: 0, w: frame.W, d: frame.D };
  const top = mats.photoTop(topTex);
  const bottom = bottomTex ? mats.photoTop(bottomTex) : mats.maskBottom;
  const geo = new RoundedBoxGeometry(b.w, thickness, b.d, 3, radius);
  geo.translate(0, -thickness / 2, 0);
  planarUV(geo, frame, [b.cx, 0, b.cz], 0, { mirrorBottom: !!bottomTex });
  const m = new THREE.Mesh(geo, [mats.fr4Edge, mats.fr4Edge, top, bottom, mats.fr4Edge, mats.fr4Edge]);
  m.position.set(b.cx, 0, b.cz);
  m.name = name; m.receiveShadow = true; m.castShadow = true;
  m.userData = { kind: 'board', label: 'PCB', status: 'photo-derived', desc: 'Outline and size derived from photos; 1.6 mm thickness is assumed.' };
  parent.add(m);
  return m;
}

/** Rounded-rectangle outline as [x,z] points (mm, board-local, centred on the origin). Builders can splice notches into it. */
export function roundedRectOutline(W, D, r = 0.8, seg = 6) {
  const pts = [], hw = W / 2, hd = D / 2;
  const corner = (cx, cz, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  corner(hw - r, hd - r, 0); corner(-hw + r, hd - r, Math.PI / 2); corner(-hw + r, -hd + r, Math.PI); corner(hw - r, -hd + r, 1.5 * Math.PI);
  return pts;
}

/**
 * PCB from an arbitrary outline (notches, cut-outs) with round holes. Top surface at y = 0, body below.
 * outline: [[x,z],...] mm board-local, any winding;  holes: [{x, z, r}] mm.
 * Material slots: top photo, bottom (photo of the back if bottomTex, else plain), edge. The bottom photo is mirrored
 * in x (a back-side photo is viewed from below). Top/bottom get planar-projected UVs from `frame`.
 */
export function shapeBoard(parent, { frame, outline, holes = [], topTex, bottomTex = null, mats, thickness = 1.6, name = 'pcb', curveSegments = 12 }) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) { const p = new THREE.Path(); p.absarc(h.x, -h.z, h.r, 0, Math.PI * 2, true); shape.holes.push(p); }
  let geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -thickness, 0);
  geo.computeVertexNormals();
  // regroup triangles: 0 = top caps, 1 = bottom caps, 2 = edges (ExtrudeGeometry puts both caps in one group)
  const pos = geo.attributes.position, nor = geo.attributes.normal, nTri = pos.count / 3, buckets = [[], [], []];
  for (let t = 0; t < nTri; t++) { const ny = nor.getY(t * 3); buckets[ny > 0.9 ? 0 : ny < -0.9 ? 1 : 2].push(t); }
  const P = new Float32Array(pos.count * 3), N = new Float32Array(pos.count * 3);
  let w = 0; const groups = [];
  buckets.forEach((b, mi) => {
    const start = w;
    for (const t of b) for (let v = 0; v < 3; v++) { const i = t * 3 + v; P.set([pos.getX(i), pos.getY(i), pos.getZ(i)], w * 3); N.set([nor.getX(i), nor.getY(i), nor.getZ(i)], w * 3); w++; }
    if (w > start) groups.push({ start, count: w - start, mi });
  });
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  groups.forEach((g) => geo.addGroup(g.start, g.count, g.mi));
  planarUV(geo, frame, [0, 0, 0], 0, { mirrorBottom: !!bottomTex });
  const top = mats.photoTop(topTex);
  const bottom = bottomTex ? mats.photoTop(bottomTex) : mats.maskBottom;
  const m = new THREE.Mesh(geo, [top, bottom, mats.fr4Edge]);
  m.name = name; m.castShadow = m.receiveShadow = true;
  m.userData = { kind: 'board', label: 'PCB', status: 'photo-derived', desc: 'Outline and size derived from photos; thickness is assumed.' };
  parent.add(m);
  return m;
}
