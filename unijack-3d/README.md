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

The board tops are the **real gallery photographs**, so silkscreen, copper and text are real and nothing is invented. On top of the
photo, every identifiable part is extruded from its measured footprint with typical heights and real-shaped detail (leads, pins, latch
clips, contacts). The photo is projected straight down onto every part's top face, so each part looks like its photographed self
from above and has real depth from any other angle.

| item | status |
|---|---|
| Board outlines and sizes: base about 161 x 80 mm, PeriBoard about 40 x 77 mm, Mercury about 35.5 x 69.6 mm | photo-derived. The scale is anchored on Mercury's 69.6 mm SO-DIMM length and cross-checked three ways: the gold contact pitch measures 0.498 mm against the standard 0.5 mm; the same module's contact strip spans the same proportion of pixels (ratio 0.385, four separate measures agree) in the flat-lay and macro photos; and the round mounting pads measure round (width/height 0.98 to 1.05), so the photos have square pixels. Mercury's 35.5 mm width is taller than the 30 mm JEDEC SO-DIMM; no Mercury drawing was checked. The 14 mm Lattice package is not used as an anchor (it measures roughly 15 x 13 mm by eye). |
| Part footprints and positions | photo-derived (overlay-checked against the photos, see `tools/overlay.py`) |
| Designators (J100, J400, ...) and chip markings | photo-verified: only text legible in a photo is used |
| Part heights, plastic/metal colours | **assumed** (typical values) |
| PeriBoard stack height above the base | **assumed** (not published) |
| PCB thickness (1.6 mm base and PeriBoard, about 1.2 mm Mercury) | **assumed** |
| Insertion angle (28 degrees) and slide distance | **assumed** (take them from Jens's insertion video) |
| Undersides of the base board and PeriBoard | **not photographed**, shown plain. Mercury's back is photographed and shown. |
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
CONTRACT.md                               rules for part builders
```

## Tools (need Node 20+)

```
npm install                                   # playwright-core, three (dev)
node tools/qa-render.mjs --only=all --suite   # standard QA views into qa-out/
node tools/viewer-shots.mjs                   # drive the UI, save screenshots, report errors
node tools/export-glb.mjs                     # write assets/unijack.glb
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
  promotional film; the film should be rendered offline from real CAD or from this GLB.
* Not yet tested on a real GPU, in Safari or on iOS.
