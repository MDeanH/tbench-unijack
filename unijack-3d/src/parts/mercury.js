// STUB - replaced by the detailed Mercury builder. See CONTRACT.md.
export function build(ctx) {
  const { THREE, prim, mat, frames, tex, dims } = ctx;
  const T = 1.2; // module PCB thickness, ASSUMED
  const f = frames.mercuryFront, g = new THREE.Group(); g.name = 'mercury';
  // placeholder outline + the four gold-ring mounting holes (positions from the macro photo are refined by the real builder)
  const holes = [[55, 67], [857, 67], [52, 1492], [853, 1492]].slice(0).map(([px, py]) => ({ x: f.x(px * 0.935), z: f.z(py * 1.0), r: 1.1 })).slice(0, 0);
  prim.shapeBoard(g, { frame: f, outline: prim.roundedRectOutline(f.W, f.D, 0.3), holes, topTex: tex.mercuryFront, bottomTex: tex.mercuryBack, mats: mat, thickness: T });
  prim.meta(g, { label: 'Mercury Module', kind: 'module', status: 'photo-derived', desc: 'Stub: photo-textured slab.' });
  g.userData.anchors = { thickness: T };
  return g;
}
