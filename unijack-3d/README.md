# unijack-3d

A rotatable, explodable, photo-anchored 3D model of the UniJack kit (base board, Mercury module, PeriBoard) that runs in the
browser with three.js. **It is illustrative, not CAD.**

## Run it

From this folder (macOS or Linux):

```
python3 -m http.server 4173
```

Open <http://127.0.0.1:4173/>. No build step and no network: three.js r186 is vendored under `vendor/` and the viewer uses system fonts.
It is ES modules with an import map, so it has to be served over http (double-clicking `index.html` will not work).

## What you can do

* Drag to rotate, scroll or pinch to zoom, right-drag or two-finger drag to pan. Keyboard: arrow keys rotate, `+` / `-` zoom.
* **Auto-rotate** on/off, and **Exploded view** (the boards separate straight up along their mating axis, dashed guides trace each
  board back to its seat, the socket latches spring open, name tags appear). Both work together. A slider scrubs the explosion.
* **Mercury insertion**: scrub or play an SO-DIMM-style insertion (enters at an angle, then presses down; the latches click shut).
* Camera views (Hero, Top, Low, Side, Underside), per-board visibility, board designator labels, and a searchable **Parts** list that
  flies the camera to a part. Click any part for an info card with an honesty tag (photo-verified, photo-derived, assumed).

## How it is built (and what is and is not real)

The board tops are the **real gallery photographs**, so silkscreen, copper and text are real. On top of the photo, every identifiable
part is extruded from its measured footprint with typical heights and real-shaped detail (leads, pins, latch clips, contacts). The photo
is projected straight down onto every part's top face, so each part looks like its photographed self from above and has real depth
from any other angle.

| item | status |
|---|---|
| Board sizes: base about 160 x 87 mm, PeriBoard about 45 x 87 mm, Mercury about 35.5 x 69.6 mm | photo-derived, each within a few percent. **Each board is scaled from standard-pitch features on that board**, because the flat-lay photo is a composite of separately scaled cut-outs: the base from the lead pitch of a 0.5 mm quad-flat IC (its photo is stretched about 11 percent in x: 8.82 px/mm along x, 7.94 along z), the PeriBoard from the 0.635 mm pitch of its connectors (17.57 px/mm, square), Mercury from its 0.5 mm contact pitch (measures 0.498) and its 69.6 mm length (round mounting pads measure round). Independent check: after rectification the three mating connector pairs between the base and the PeriBoard agree in length to about 1.5 percent and in position to 0.4 mm, and the two boards come out the same depth. Mercury's 35.5 mm width is taller than the 30 mm JEDEC SO-DIMM; no Mercury drawing was checked. Tools: `tools/pitch-check.py`. |
| Part footprints and positions | photo-derived (overlay-checked against the photos, see `tools/overlay.py`; most within about 0.5 mm) |
| Designators (J100, J400, ...) and chip markings | photo-verified: the printed text is legible in a photo. The part's shape is photo-derived and its height assumed. |
| Part heights, plastic and metal colours | **assumed**. Matched-camera comparisons with the 3/4 photo suggest some tall parts (RJ45, barrel jack, terminal) are lower than typical values; treat all heights as plus or minus 30 percent. |
| Detail geometry: connector contacts, IC leads, latch hooks, solder balls, pin tips | synthetic, built to look right; counts come from the photos where legible |
| PeriBoard stack height above the base | **assumed** (not published; the photos do not pin it down) |
| PCB thickness (1.6 mm base and PeriBoard, about 1.2 mm Mercury) | **assumed** |
| Insertion angle (28 degrees), slide distance, latch travel, explode distances | **assumed** and illustrative (take them from Jens's insertion video) |
| Texture patch under the socket latches | **synthetic**. The flat-lay photo has the closed latch arms baked in; while the latches are open a small patch cloned from a plain region of the board covers those pixels. It is hidden whenever the latches are closed. |
| Lighting and colour | The viewer relights the photographs; the photo material's gain was calibrated so a top-down render matches the photo's mean luminance (ratio 0.97). Hue and highlights are approximate. |
| Undersides of the base board and PeriBoard | **not photographed**, shown plain. Mercury's back is photographed and shown. |
| Offline Cycles stills (`renders/`, made by `tools/blender/render.py` from the exported GLB) | **synthetic studio**: the three area lights, gradient world, ground plane, camera, depth and the gloss/coat added to the mask and plastics are render choices, not the photographs' lighting. Exposure is matched so a plain solder-mask patch has the mean luminance of the same patch in `gallery-1.jpg` (hue still differs: the rendered mask reads lighter and less saturated, the measured numbers are in each render's sidecar `.json`). Every render has a sidecar with the model commit, GLB checksum, all settings and the disclosure sentence. Same geometry, same assumed heights and colours as the viewer. |
| Function of any part | inferred from shape only ("appears to be ...") |

Nothing in this model is a vendor-supplied mechanical specification. When Jens supplies a STEP file or the KiCad/Altium project, replace
the part builders with geometry converted from that data and keep the same metadata.

## Layout

```
index.html, src/main.js, src/viewer.css   the viewer
src/model.js                              assembles the kit; insertion, latches, explode, guides
src/parts/base.js (+ base-left.js, base-right.js), peri.js, mercury.js   the part builders
src/lib/                                  frame + planar UV, materials, primitives, stage lighting
assets/tex/*.webp                         rectified, mm-scaled photo textures (derived from the gallery photos)
data/scale.json                           scale anchors and board sizes
tools/extract.py                          photos -> textures + scale.json   (needs source-photos/, pillow numpy scipy)
tools/qa-render.mjs, overlay.py, crop.py  headless QA renders, footprint-vs-photo overlay, zoom-with-grid
tools/viewer-shots.mjs                    end-to-end viewer test (clicks the UI, screenshots, console errors)
tools/export-glb.mjs                      exports assets/unijack.glb (named nodes, metadata in glTF extras)
tools/blender/render.py                   offline photoreal stills with Blender Cycles from the GLB (see tools/blender/README.md)
renders/                                  Cycles stills + provenance sidecars (not committed)
CONTRACT.md                               rules for part builders
```

## Tools (need Node 20+)

```
npm install                                   # playwright-core, three (dev)
node tools/qa-render.mjs --only=all --suite   # standard QA views into qa-out/
node tools/viewer-shots.mjs                   # drive the UI, save screenshots, report errors
node tools/export-glb.mjs                     # write assets/unijack.glb
<venv-bpy>/bin/python -I tools/blender/render.py --view hero --samples 192 --size 1920x1080   # Cycles still (needs the bpy wheel, see tools/blender/README.md)
```

The QA tools render with software WebGL (SwiftShader) so they run without a GPU, in a container or CI.
Note: on macOS, point Playwright at an installed Chromium/Chrome (`executablePath`) or run `npx playwright install chromium` once.

## Photos and rights

`assets/tex/*.webp` are derived from the TBench / Crowd Supply gallery photographs (`source-photos/`, not committed). Confirm TBench's
permission to publish them, and replace them with Jens's original RAW files for the final version (higher resolution, cleaner shadows).
The viewer is marked `noindex` while it is a work in progress.

## Known limits

* Tiny passives (0402 and smaller) are texture-only; larger parts have real geometry.
* Real-time lighting cannot reproduce macro depth of field or the cinematic look of an offline render. This is a viewer, not the
  promotional film; the film should be rendered offline from real CAD or from this GLB. `tools/blender/render.py` makes path-traced stills
  from the GLB with the viewer's camera presets (about 7 to 9 minutes per 1080p hero frame on 4 CPU cores, 3 to 6 minutes for the other views).
* Tall parts at the photo edge (RJ45, USB-A, barrel jack, terminal, mini- and micro-USB) show some of their own side faces in their top-face pixels (the flat lay is a perspective photo); their PCB-level footprints are displaced by a fraction of a millimetre.
* Not yet tested on a real GPU, in Safari or on iOS.
