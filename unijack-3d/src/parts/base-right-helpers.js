// Helpers for the base-right builder. All inputs are TEXTURE PIXELS of base-top.webp (converted with ctx.frames.base),
// all heights are millimetres above the board top surface (y = 0).
//
//   pxBoxPart    one extruded photo-topped box from a pixel bbox
//   mergedBoxes  many photo-topped boxes of different heights merged into ONE mesh (one draw call)
//   leadBoxes / leadRow  gull-wing lead rows (shoulder + riser + foot per lead) as photo-topped merged boxes:
//                the lead TOPS show the real photo (so the top-down view equals the photo), the sides are metal
//   flatPads     thin flat pads / terminations (merged, photo-topped)
//   pinSet       vertical pins / contacts (instanced, solid colour)
//   ballGrid     instanced solder balls
//   uniqueNames  give every generic sub-node (body, pins, leads, ...) a name that is unique on the board (GLB node names, parts list)

/** A single extruded box from a pixel bbox (wrapper around prim.boxPart). */
export function pxBoxPart(ctx, parent, b, h, { y0 = 0, top, side, radius = 0, name } = {}) {
  const f = ctx.frames.base, bx = f.box(b);
  return ctx.prim.boxPart(parent, { frame: f, size: [bx.w, h, bx.d], pos: [bx.cx, y0, bx.cz], top, side, radius, name });
}

/**
 * Many boxes of different heights merged into one mesh. Materials: [side, top]. Top faces get the planar photo UV
 * (same mapping as prim.boxPart), side faces carry the same UVs (the side material has no map, so they are ignored).
 * list = [{ b:[x0,y0,x1,y1] (px), h (mm), y0? (mm, default 0) }]
 */
export function mergedBoxes(ctx, parent, list, { top, side, name = 'merged' }) {
  const { THREE, frames } = ctx, f = frames.base;
  const P = [], N = [], U = [], Is = [], It = [];
  let v = 0;
  const quad = (pts, n, idx) => {
    const b0 = v;
    for (const p of pts) { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); U.push((p[0] + f.W / 2) / f.W, 1 - (p[2] + f.D / 2) / f.D); v++; }
    idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  };
  for (const it of list) {
    const b = f.box(it.b), x0 = b.cx - b.w / 2, x1 = b.cx + b.w / 2, z0 = b.cz - b.d / 2, z1 = b.cz + b.d / 2;
    const y0 = it.y0 || 0, y1 = y0 + it.h;
    quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], It);
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], Is);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], Is);
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], Is);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], Is);
    if (y0 > 0.02) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], Is);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex([...Is, ...It]);
  g.addGroup(0, Is.length, 0);
  g.addGroup(Is.length, It.length, 1);
  const m = new THREE.Mesh(g, [side, top]);
  m.name = name; m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Lead boxes for one row of gull-wing style leads.
 *  axis 'x': leads run along x (spaced along y px);  axis 'y': leads run along y (spaced along x px).
 *  face = pixel coordinate of the body face the leads leave, tip = pixel coordinate of the lead tip,
 *  pos  = across-axis pixel centres, w = lead width in pixels, hTop = height of the shoulder top (mm).
 */
export function leadBoxes({ axis, face, tip, pos, w = 3.5, t = 0.14, hTop = 0.5 }) {
  const out = [];
  const dir = Math.sign(tip - face), len = Math.abs(tip - face);
  const k = (fr) => face + dir * len * fr;
  for (const p of pos) {
    const seg = (a0, a1, yA, yB) => {
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      out.push({ b: axis === 'x' ? [lo, p - w / 2, hi, p + w / 2] : [p - w / 2, lo, p + w / 2, hi], h: yB - yA, y0: yA });
    };
    seg(k(-0.08), k(0.42), hTop - t, hTop);        // shoulder, tucked into the body
    seg(k(0.30), k(0.42), 0, hTop - t - 0.005);   // riser (top kept below the shoulder underside: no coplanar faces)
    seg(k(0.36), k(1.0), 0, t);                   // foot on the pad
  }
  return out;
}

/** Convenience: lead rows merged into one mesh. mats = { top, side }. `rows` is an array of leadBoxes specs. */
export function leadRows(ctx, parent, mats, rows, name = 'leads') {
  return mergedBoxes(ctx, parent, rows.flatMap(leadBoxes), { ...mats, name });
}

/** Thin flat boxes (pads, terminations). list = [{ b:[x0,y0,x1,y1], h? }] */
export function flatPads(ctx, parent, mats, list, name = 'pads') {
  return mergedBoxes(ctx, parent, list.map((it) => ({ b: it.b, h: it.h ?? 0.1, y0: it.y0 || 0 })), { ...mats, name });
}

/** Vertical thin pins / contacts as instanced boxes. list = [{ x, z (px), y0, y1 (mm), w, d (px) }]. */
export function pinSet(ctx, parent, mat, list, name = 'pins') {
  const f = ctx.frames.base;
  const items = list.map((p) => ({ p: [f.x(p.x), (p.y0 + p.y1) / 2, f.z(p.z)], s: [f.len(p.w), p.y1 - p.y0, f.len(p.d)] }));
  return ctx.prim.instanced(parent, ctx.prim.UNIT_BOX, mat, items, name);
}

/** Instanced solder balls. list = [{ x, z (px) }], d = ball diameter (mm), yc = ball centre height (mm). */
export function ballGrid(ctx, parent, mat, list, { d = 0.4, yc = 0.14, name = 'balls' } = {}) {
  const { THREE } = ctx, f = ctx.frames.base;
  const geo = new THREE.SphereGeometry(0.5, 10, 6);
  const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((p, i) => { o.position.set(f.x(p.x), yc, f.z(p.z)); o.scale.set(d, d, d); o.rotation.set(0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.instanceMatrix.needsUpdate = true; im.castShadow = im.receiveShadow = true; im.name = name;
  parent.add(im);
  return im;
}

/**
 * Make every named sub-node of every part in `group` unique: "<board>/<part>/<child>" (a counter is added if the same child name
 * is used twice inside one part). <part> is the printed designator if there is one, else the part's group name or label.
 * The part groups themselves and nested parts that carry their own label keep their names. Call once at the end of a builder.
 */
export function uniqueNames(group, board = 'base') {
  const used = new Set();
  for (const part of group.children) {
    const pn = part.userData?.ref || part.name || part.userData?.label || 'part';
    part.traverse((d) => {
      if (d === part || !d.name || d.userData?.label) return;
      const stem = `${board}/${pn}/${d.name}`;
      let n = stem, k = 1;
      while (used.has(n)) n = `${stem}#${++k}`;
      used.add(n); d.name = n;
    });
  }
  return group;
}
