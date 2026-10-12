# Offline Cycles stills of the UniJack kit

`render.py` turns the exported GLB (`node tools/export-glb.mjs` -> `assets/unijack.glb`) into path-traced stills with Blender's Cycles,
using the `bpy` Python wheel (Blender 4.5 LTS; no Blender install, no GPU). Output goes to `unijack-3d/renders/` (git-ignored) and every
PNG gets a sidecar `.json` with its provenance.

The renders are for the asset library and marketing. They are **illustrative**: the geometry is the same photo-anchored, NOT-CAD model as the
browser viewer (assumed heights, stack height, PCB thickness and plastic/metal colours), the board tops are the real gallery photographs, and
everything about the light is a synthetic studio. See "What is synthetic" below.

## Run

```
python3 -m venv venv-bpy && venv-bpy/bin/pip install bpy==4.5.14 numpy      # once; ~300 MB wheel, needs glibc Linux x86_64 or macOS
node tools/export-glb.mjs                                                   # writes assets/unijack.glb (from unijack-3d/)
venv-bpy/bin/python -I tools/blender/render.py --match-photo                # once per studio: calibrates exposure, writes tools/blender/exposure.json
venv-bpy/bin/python -I tools/blender/render.py --view hero --samples 192 --size 1920x1080 --out renders/hero.png
```

Options: `--view hero|top|low|side|under|custom` (`custom` takes `--az --el --fill`; `under` and any negative elevation render without the
ground plane, since the camera is below it), `--size WxH`, `--samples N` (adaptive, max per pixel),
`--studio dark|white` (dark satin stage, or a white sweep like the gallery photos' background), `--exposure` (stops; default from
`exposure.json`), `--view-transform AgX|Filmic|Standard`, `--look 'AgX - Base Contrast'|'AgX - Punchy'|None`, `--no-denoise`, `--time-limit`
(seconds per frame), `--match-photo` (see Calibration). `--out` defaults to `renders/<view>.png`.

Cameras reproduce the viewer presets exactly: `src/main.js` `VIEWS` (hero az 32 el 34, top 0/89, low 18/11, side 90/7, under 28/-34),
its `dirFromAzEl` convention, the 32 degree vertical fov and the same bounding-box fit (`frameFor`, ported line for line) for the render's
aspect. The glTF importer converts the file to Z-up (Blender x = model x, y = -model z, z = model y); the kit is scaled to metres so light
powers are ordinary watts.

## Timings (4 CPU cores, no GPU, OpenImageDenoise on, adaptive sampling)

Measured wall times of `bpy.ops.render.render` (`seconds` in each sidecar); the whole process adds about 5 s for import, material setup
and the sidecar. The container's speed varied by more than 3x between sessions (the same 640 x 360 / 48-sample hero frame took 11 s in one
session and 38 s in the next, and the 1080p low frame 153 s once and 362 s the time before), so take the ranges, not single numbers.

| frame | view | samples | render time |
|---|---|---|---|
| 640 x 360 | hero | 48 | 11 - 38 s |
| 1280 x 720 | hero | 128 | 109 s |
| 1920 x 1080 | hero (dark) | 192 | 407 - 529 s (6.8 - 8.8 min); `renders/hero.json` |
| 1920 x 1080 | low | 128 | 153 - 362 s; `renders/low.json` |
| 1920 x 1080 | top | 128 | 419 s (7.0 min); `renders/top.json` |
| 1920 x 1080 | side | 128 | 406 s (6.8 min); `renders/side.json` |
| 1920 x 1080 | under (no ground, underfill light) | 128 | 103 s (1.7 min, mostly empty frame); `renders/under.json` |
| 1920 x 1080 | hero (white studio) | 128 | 292 s (4.9 min); `renders/hero-white.json` |
| 960 x 540 x 4 iterations | `--match-photo` | 32 | about 2 min per studio (dark: 4 x 31 s; white: 4 x 20 s) |
| 3840 x 2160 | hero | 192 | **estimate, not rendered**: 4 x the 1080p time, 27 - 35 min on this machine |

Scene build (import + BVH + light tree) is under 2 s; time is almost all path tracing and scales with pixel count. Memory peak about 460 MB.
Run long frames detached (`nohup ... &`) and poll for the sidecar; a 1080p batch of five views is 20 - 40 minutes here.

## Calibration (`--match-photo`)

Exposure is matched to the photograph, not guessed: two plain solder-mask patches on the base board (texture px 230-270 x 300-325 and
198-235 x 302-330 of `assets/tex/base-top.webp`, inside and left-below the silkscreen rectangle left of the SO-DIMM socket) are projected
through the hero camera and their mean colour is read back from a 960x540 test render; the same physical patches were measured in
`source-photos/gallery-1.jpg` (3000x1688 px boxes 800,790-940,835 and 690,855-780,915: mean sRGB 12/151/189 and 4/132/170, measured with
PIL). The view exposure is iterated until the Rec.709 luminance of the rendered patches equals the photo's (within 0.02 stops); the result
and the full history are written to `exposure.json` per studio / view transform / look, and every render's sidecar repeats the measurement
for that frame.

What this does and does not achieve: luminance matches (render 0.230 vs photo 0.227 at the last calibration). Hue does not fully: the
rendered mask reads lighter and less saturated than the photo (about sRGB 45/136/168 against 12/151/189 for patch A). The red lift is
specular sheen from the studio lights and world reflected in the glossy mask plus AgX's desaturation of saturated teal; the texture itself
is a deep 3/92/123 there. Reducing the mask gloss (roughness 0.5, specular 0.3, coat 0.08) and moving the rim light out of the hero camera's
mirror direction helped; a true match would need the photo's own light (a large neutral source with a white sweep), which `--studio white`
approximates at the cost of more sheen. Treat colour in these renders as approximate, exactly as the viewer's README already says. The white studio (`hero-white.png`, exposure
-0.868 after its own calibration) gets closer in hue (patch A sRGB 61/134/164) because its brighter, more even world fills the mask's
sheen with white instead of dark grey; the dark studio is the one that reads lighter and greyer.

## What the 1080p frames look like against `gallery-1.jpg` (checked region by region)

* **Highlights**: no clipping. 0 pixels at or above sRGB 254 in `hero.png` and `low.png` (the photograph itself is 48 % pure white, its
  cut-out background). Metal tops (RJ45, USB-A shields) peak around 224.
* **Solder mask / pads**: luminance matches by construction; hue is lighter and less saturated than the photo (see Calibration). Pads,
  LEDs and the silkscreen are the photo's own pixels, relit.
* **Mercury module**: the photo's Mercury is a deeper royal blue than the base board; the render keeps that relation but lifts both. The
  TriCore package, the electrolytic and the blue inductor read correctly; the SO-DIMM socket's gold contacts are visible along the edge.
* **PeriBoard pin headers**: from above (`top.png`) the 2 x 5 headers J1-J16 match the photo's layout and designators pixel for pixel
  (they are the photo). From the hero angle the gold pins stand well above their black bases; the pin length above the housing is an
  assumed height of the model (`src/parts`), not a render choice, and the viewer shows the same.
* **Board edges**: the pale rim along the boards in the `low` and `side` frames is the GLB's `fr4Edge` material (an assumed pale FR4
  colour, roughness 0.72, sRGB about 210 at its brightest in these renders). It reads brighter than the photo's edge because the key light
  grazes it; it is an assumed colour, not a measured one.
* **Shadows and ground**: soft contact shadows under the base board and the PeriBoard overhang; the dark studio ground is sRGB 60-80,
  never black, and the backdrop fades from about 8 at the top of frame to a soft horizon band of about 40-50.

## What is synthetic (disclose this wherever a render is shown)

* **Lighting**: three area lights (warm key above-front-left, cool fill right, cool rim behind-right-high), a vertical-gradient world and a
  ground plane (dark satin with slight reflection, or a white sweep). None of it is the photographs' lighting; the photographs already
  contain their own lighting and highlights, which the renders relight (the viewer does the same). The ground is 400 kit-diagonals wide and
  fades to the world's floor colour (and to matte) with distance, and the world gradient only starts at the horizon, so low cameras see a
  soft backdrop instead of a plane edge. The `under` view (and any negative elevation) has no ground plane at all and gets a fourth,
  upward-facing area light plus a uniform world (the zenith colour everywhere), because the three studio lights only reach the undersides
  by bounce and the first attempt came out as a black silhouette. The undersides of the base board and PeriBoard are unphotographed and
  carry the model's plain assumed `maskBottom` colour, so `under.png` shows a featureless dark-teal slab with the connector bodies along
  the edges: that is all the model knows.
* **Material gloss**: the GLB carries flat PBR values. For Cycles the photo-textured faces get a glossy mask look (roughness 0.5, specular 0.3,
  a thin clear coat), materials with three.js "metalness" of 0.5 or more become true conductors, glossier plastics get a faint coat.
  These are looks, not measured material properties.
* **Everything in the viewer's honesty table**: heights, stack height, PCB thickness, plastic/metal colours, detail geometry, undersides.
* **Camera and post**: 32 degree vertical fov perspective matching the viewer, AgX view transform, exposure calibrated as above, Open Image
  Denoise (RGB + albedo + normal passes). No depth of field, no bloom, no vignette. Nothing is painted in; no markings, text or logos
  beyond what the photographs contain.

## Sidecar `.json`

Written next to every PNG: `model.glb_sha256` and `model.model_commit` (git HEAD of the repository the GLB was rendered from), size, samples,
denoiser, view transform, exposure, every light / world / ground parameter, the camera position, target and fov, the colour measurements,
the `synthetic` sentence above, the `disclosure` paragraph read from `index.html`'s "About this model" and the project's `status_note`.
Keep the sidecar with the image when it goes into the asset library. `model_commit` is the HEAD of the checkout the GLB came from; it
does not pin `render.py` itself, so the sidecar also lists every light, world, ground and material parameter that was used.

The six library frames are `hero`, `low`, `top`, `side`, `under` (dark studio) and `hero-white`. Anything in `renders/` named `test-*`,
`*-640-test`, `*-640-check` or `_match-*` is a calibration or smoke-test frame, several of them from earlier light rigs; do not use them.
