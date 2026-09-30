# unijack-3d part-builder contract

An illustrative, photo-anchored 3D model of the UniJack kit (base board, Mercury module, PeriBoard), built for the
browser with three.js. It is NOT CAD. Every dimension is derived from the TBench gallery photos. Nothing here is
a measured or vendor-supplied mechanical specification.

## Honesty rules (non-negotiable)

1. Board tops show the real photo, so silkscreen and copper are real. Never add text, logos, markings or
   designators that are not legible in a photo. Never invent a part number.
2. A designator (`J303`, `J400`, ...) may be attached only if it is printed on the board and legible in a photo.
3. Heights, stack heights, plastic/metal colours, latch kinematics and PCB thickness are NOT visible in a top-down
   photo. Model them with typical values and mark them `status: 'assumed'` (see metadata below). Photo #1
   (`source-photos/gallery-1.jpg`, a 3/4 view) shows side faces: use it to judge relative heights.
4. Undersides of the base board and PeriBoard are not photographed: leave them plain. The Mercury back IS photographed.
5. Function is inferred from shape only. Write "appears to be ..." unless a marking in the photo says otherwise.
   Chip markings legible in the photos are fine to quote (they are photo-verified) but never claim what a chip does
   inside UniJack.

## Coordinate frame and units

Millimetres. Board-local axes: `+x` = right in the photo, `+z` = DOWN in the photo, `+y` = up out of the board.
Origin = centre of the board's top surface. Top surface is `y = 0`; the PCB body is `y in [-thickness, 0]`;
components are extruded upward from `y = 0`. A top-down orthographic view from +y with `up = -z` reproduces the photo.

Texture pixel to mm: `frame.x(px)`, `frame.z(py)`, `frame.len(p)`, `frame.box([x0,y0,x1,y1]) -> {cx,cz,w,d}`.

| texture (assets/tex) | size px | px per mm | frame in ctx |
|---|---|---|---|
| base-top.webp | 1452 x 698 | 8.72 | `ctx.frames.base` (166.5 x 80.0 mm) |
| peri-top.webp | 803 x 1548 | 20.0 | `ctx.frames.peri` (40.1 x 77.4 mm) |
| mercury-front.webp / mercury-back.webp | 801 x 1568 | 22.5 | `ctx.frames.mercuryFront` / `mercuryBack` (35.5 x 69.6 mm; fingers edge on the LEFT of the front texture) |

Scale anchors: Mercury length = 69.6 mm (SO-DIMM length, derived); cross-checked with the Lattice iCE40HX8K body
(14 x 14 mm datasheet) which measures 15.1 x 13.3 mm in the photo (within 2% on average).

## How parts are made

`ctx = { THREE, prim, mat, frames, tex, dims, scale, BOARD_T }` (see `src/lib/context.js`).

* Extruded parts whose TOP should look like the photographed part: `prim.boxPart` / `prim.cylPart` with
  `top: mat.photoTop(ctx.tex.base)` (planar UV from the photo) and a solid `side` material from `ctx.mat`.
  The same texture is shared by all parts of a board; create `photoTop` once per builder and reuse it.
* Repeated small things (IC leads, header pins, contacts): `prim.instanced` / `prim.gullLeads` (one draw call).
* PCB body: `prim.boardSlab` (rectangle) or `prim.shapeBoard` (outline with notches and round holes, separate front/back photo).
* Materials: `ctx.mat.*` (extend locally if needed; do not edit `src/lib/*`).
* Group each physical part (housing + leads + pins) in a `THREE.Group`, add to the parent, and describe it with `prim.meta`.

## Metadata (every physical part)

```js
prim.meta(groupOrMesh, {
  ref: 'J303',            // ONLY if printed + legible in a photo, else omit
  label: 'RJ45 jack',     // short human name
  kind: 'connector',      // board|connector|ic|passive|cap|pin|latch|led|module|other
  status: 'photo-derived',// photo-derived | photo-verified | assumed
  desc: 'Appears to be an Ethernet RJ45 jack; height assumed.',
});
```
Put `meta` on the GROUP, not on its sub-meshes. The viewer picks the nearest ancestor that has `label`.

## Budgets

Triangles: base-left <= 150k, base-right <= 150k, PeriBoard <= 120k, Mercury <= 120k.
Meshes (draw calls): base halves <= 150 each, PeriBoard <= 100, Mercury <= 100. Use instancing for repeats.
No per-part textures beyond the shared board photos. No external downloads.

## Ownership

Each builder edits ONLY its own file(s) (plus any new helper file named after its key, e.g. `src/parts/base-left-helpers.js`,
and data/tools it creates under a name starting with its key). Never edit `src/lib/*`, `src/model.js`, `src/qa.js`,
`tools/*`, or another builder's file. If you need a helper that does not exist, write it inside your own file.

## QA (do this; it is how you know you are right)

All commands run from `unijack-3d/`. The QA renderer is headless (software WebGL); one render takes a few seconds.
Use YOUR key for the output dir so parallel builders do not overwrite each other.

```
node tools/qa-render.mjs --only=base --view=top --mode=footprint --hide=base-right --dir=qa-out/KEY --out=qa-out/KEY/fp.png
PY=/tmp/claude-0/-home-user-tbench-unijack/97ae59a7-ac1e-5857-b6c6-1c886e24d733/scratchpad/venv-img/bin/python
$PY tools/overlay.py --tex base-top --render qa-out/KEY/fp.png --out qa-out/KEY/overlay.png [--crop x0,y0,x1,y1 --zoom 2]
$PY tools/crop.py --tex base-top --box 0,0,600,350 --zoom 3 --grid 50 --out qa-out/KEY/crop.png
node tools/qa-render.mjs --only=base --view=oblique --az=35 --el=35 --out=qa-out/KEY/obl.png
```
`--only` = all|base|peri|mercury; `--view` = top|bottom|oblique|custom; `--mode` = photo|footprint|clay;
`--hide=name1,name2` hides objects by name (e.g. `base-left`, `base-right`); `--ins`/`--exp` set insertion/explode state.
The overlay draws the outline of every part footprint in magenta on the photo: outlines must hug the real parts.
Read the PNGs with your image viewer (Read tool) and iterate. Also check oblique and low-angle renders for floating parts,
z-fighting, parts clipping into the board or each other, and implausible proportions. Console errors are printed by the tool.

Acceptance: footprints of all large parts within about 0.5 mm of the photo outline; all parts have metadata; budgets met;
no console errors; oblique and low views look like the real hardware in `source-photos/gallery-1.jpg`.
