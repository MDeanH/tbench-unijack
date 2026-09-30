import * as THREE from 'three';
import { makeFrame } from './frame.js';
import { makeMaterials } from './materials.js';
import * as prim from './primitives.js';

export const BOARD_T = 1.6;   // mm, ASSUMED (standard PCB thickness; not measured)

/** Everything a part builder needs. Builders are pure functions of this context. */
export async function makeContext(baseUrl = new URL('../../', import.meta.url)) {
  const scale = await (await fetch(new URL('data/scale.json', baseUrl))).json();
  const loader = new THREE.TextureLoader();
  const load = (n) => new Promise((res, rej) => loader.load(new URL('assets/tex/' + n, baseUrl).href, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; res(t);
  }, undefined, rej));
  const [base, peri, mercuryFront, mercuryBack] = await Promise.all([
    load('base-top.webp'), load('peri-top.webp'), load('mercury-front.webp'), load('mercury-back.webp')]);
  const tp = scale.tex_px, sp = scale.tex_px_per_mm;
  return {
    THREE, prim, scale, dims: scale.dims_mm, BOARD_T,
    tex: { base, peri, mercuryFront, mercuryBack },
    mat: makeMaterials(),
    // one frame per source texture: pixel <-> mm for that texture
    frames: {
      base: makeFrame(tp.base, sp.base),
      peri: makeFrame(tp.peri, sp.peri),
      mercuryFront: makeFrame(tp.mercury, sp.mercury),
      mercuryBack: makeFrame(tp.mercury, sp.mercury),
    },
  };
}
