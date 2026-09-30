// STUB - replaced by the detailed PeriBoard builder. See CONTRACT.md.
export function build(ctx) {
  const { THREE, prim, mat, frames, tex, BOARD_T } = ctx;
  const g = new THREE.Group(); g.name = 'peri';
  prim.boardSlab(g, { frame: frames.peri, topTex: tex.peri, mats: mat, thickness: BOARD_T });
  prim.meta(g, { label: 'PeriBoard', kind: 'board', status: 'photo-derived', desc: 'Stub: photo-textured slab.' });
  g.userData.anchors = {};
  return g;
}
