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
| Detail geometry: connector contacts, IC leads, latch hooks, solder balls, pin tips | synthetic, built to look right; counts come from the photos where legible. The PeriBoard headers J1-J16 and the base headers J305-J307 are modelled with **vertical** pins: the flat-lay photos (gallery-2/3, the textures) show the pin tips end-on as two columns of small gold squares inside each body and nothing lying on the board beside them; in the 3/4 photo (gallery-1) the pins appear to lie to the right about one body-width long, but so does every vertical edge at that side of the frame (the base's J305-J307 pins and the board edge lean the same way), and the J16 pin tips reach past the board edge, which a pin lying on the board could not. Pin heights stay assumed (see `qa-out/geometry/crops`). J305-J307: gallery-1 shows the pins standing well clear of a low shroud, so the shroud is modelled low (about 2.6 mm) with pins to about 5.4 mm, both assumed. |
| Micro-geometry: rounded edges, solder fillets, chamfered pin tips, capacitor rim | **assumed**. The photos show softly rounded housing, shell and IC-body edges, bright concave reflowed solder at every gull-wing foot and header tail, square header pins with pointed tips, and a bevelled rim on the electrolytic can, but none of these can be measured in them. The model adds a uniform 0.2 mm edge bevel (0.3 mm on housings taller than 4 mm, a half-round on thin shell tops) to every free-standing box part taller than 2 mm, a toe and heel fillet of typical size (at most 0.3 mm long, at most 1.1 x the lead width) at every gull-wing lead, header tail and contact foot, a 15 percent tip taper on the header pins and a 0.4 mm chamfer on the can. Every toe fillet sits inside the photo-traced lead or pad extent (the foot is shortened by the fillet length), so no lead reaches further than it does in the photo. Edges where one moulded piece is built from several boxes are left sharp so the surface stays continuous; stamped steel parts (latch clips, tabs, pads) are left sharp. Board edges are plain FR4 as in gallery-1 (no plated edge is visible, none is modelled). |
| PeriBoard stack height above the base | **assumed** (not published; the photos do not pin it down) |
| PCB thickness (1.6 mm base and PeriBoard, about 1.2 mm Mercury) | **assumed** |
| Insertion angle (28 degrees), slide distance, latch travel, explode distances | **assumed** and illustrative (take them from Jens's insertion video) |
| Texture patch under the socket latches | **synthetic**. The flat-lay photo has the closed latch arms baked in; while the latches are open a small patch cloned from a plain region of the board covers those pixels. It is hidden whenever the latches are closed. |
| Surface finish (glossy solder mask, matte silkscreen, metallic pads, shields and gold, matte IC bodies) | **photo-derived by colour segmentation**, not measured. `tools/derive-maps.py` classifies every texture pixel by hue / saturation / value (PIL HSV 0..255: mask = S above 70..110 and hue 112..175; silkscreen = S below 45..100 and V above 178..205; tin = low S with V between; dark = low S and V below 75..105; gold = hue 4..50 and S above 55..95) and writes roughness / metalness maps (mask 0.45 dielectric, silk 0.78, tin 0.32 metallic, dark 0.62, gold 0.30 metallic on Mercury and a hedged 0.40 / half-metal on the base and PeriBoard, where tan connector plastic is colour-identical to gold plating) plus a mild normal map (silkscreen proud, pads below the mask). Class fractions and thresholds per texture: `assets/tex/derived/README.md`. Limits: a white pixel is treated as silkscreen whether it is silkscreen or white plastic, a grey pixel as metal whether it is a pad or a grey part, and laser markings on IC tops get the silkscreen relief. Metal pixels use the photo's own colour times 1.5 as their specular colour (**assumed**: the photographed grey of a pad is its reflection of the photographer's softbox, not its reflectance; the viewer's gain is a diffuse calibration and is not applied to metals; the GLB carries the plain photo colour). A "delight" pass that flattens the photos' large-scale luminance was measured and rejected: in these evenly lit flat lays that variation is the copper under the mask, not the lighting. |
| Lighting and colour | The viewer relights the photographs; the photo material's gain was calibrated so a top-down render matches the photo's mean luminance (ratio 0.97; re-checked at 0.97 with the surface-finish maps, `tools/colorcal.py`). Hue and highlights are approximate. The solder mask reflects the environment at a quarter strength (`PHOTO_ENV`), because the room environment has a lamp at the zenith that a glossy mask mirrors in the top view and the photos' lights were off-axis; metals reflect it fully. (In three r186 `material.envMapIntensity` is overwritten by `scene.environmentIntensity`, so this is done per pixel in the shader.) |
| Studio, ground and post-processing | **Synthetic rendering choices, not the photo's set-up.** The light is a procedural studio map (`src/lib/stage.js`: a large warm key box above-front-left, a cool fill, a cool rim strip, a graded room) rendered through PMREMGenerator, plus one warm shadow-casting directional key (4096 px map fitted to the kit, 5-tap PCF, soft) and a weak cool rim. The key's direction follows gallery-1.jpg (header shadows fall to the lower right); its softness and colour temperature are judged by eye against that photo, not measured. The dark satin table and the graded dark backdrop are inventions: the gallery photos were shot on a white sweep. The table reflects only the studio map, not the board. Post-processing (`src/lib/post.js`): GTAO ambient occlusion (3.5 mm radius, contact darkening under connectors and the module), SMAA, and in the Hero preset a subtle depth of field while nothing moves; tone mapping and sRGB happen in the OutputPass. AO and DOF switch off after about 20 slow frames (over 30 ms) and with `?quality=low`; `?quality=high` keeps them. With the studio map the mean solder-mask colour of the Hero render stays within about 4 percent of the previous rig (`tools/qa-render.mjs`, mask boxes documented in qa-out notes). |
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
src/lib/                                  frame + planar UV, materials, primitives, stage lighting (studio map, shadow fit, ground), post-processing chain
assets/tex/*.webp                         rectified, mm-scaled photo textures (derived from the gallery photos)
assets/tex/derived/*.webp, README.md      roughness/metalness (-rm) and normal (-nrm) maps segmented from the textures by colour, with the thresholds and class fractions
data/scale.json                           scale anchors and board sizes
tools/extract.py                          photos -> textures + scale.json   (needs source-photos/, pillow numpy scipy)
tools/derive-maps.py                      textures -> assets/tex/derived (surface-finish maps by colour segmentation; needs pillow numpy scipy)
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
#   oblique photo renders go through the same post chain as the viewer (GTAO + SMAA + OutputPass); --post=0 for a plain render,
#   --dof=1 for the Hero depth of field, --env=room for the previous RoomEnvironment rig, --shadow=vsm to compare shadow filters
node tools/viewer-shots.mjs                   # drive the UI, save screenshots, report errors
node tools/export-glb.mjs                     # write assets/unijack.glb (carries the derived roughness/metalness and normal maps)
python3 tools/derive-maps.py                  # regenerate assets/tex/derived after the textures change (python with pillow, numpy, scipy)
python3 tools/colorcal.py qa-out/x/top.png    # photo-vs-render luminance check of a `--only=base --view=top --mode=photo` render
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
* Real-time lighting cannot reproduce the full macro depth of field or the cinematic look of an offline render (the Hero preset's depth of field is a screen-space approximation). This is a viewer, not the
  promotional film; the film should be rendered offline from real CAD or from this GLB. `tools/blender/render.py` makes path-traced stills from the GLB with the viewer's camera presets (about 7 to 9 minutes per 1080p hero frame on 4 CPU cores, 3 to 6 minutes for the other views).
* Tall parts at the photo edge (RJ45, USB-A, barrel jack, terminal, mini- and micro-USB) show some of their own side faces in their top-face pixels (the flat lay is a perspective photo); their PCB-level footprints are displaced by a fraction of a millimetre.
* The satin table is a disc that fades out 200 to 520 mm from the kit; at camera elevations under about 10 degrees (Side preset) its grazing-angle sheen is lighter than the backdrop behind it, so a soft horizon line shows. Post-processing (AO, SMAA, DOF) roughly doubles the frame cost; the adaptive quality drops AO and DOF on slow machines, and `?quality=low` turns the whole chain off.
* Not yet tested on a real GPU, in Safari or on iOS.
