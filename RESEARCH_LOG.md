# Research log

## 2026-09-30: per-board scale and dimensions of the UniJack kit, measured from the gallery photos

- Start: 2026-09-30 21:38 UTC (first sign that the flat-lay photo is stretched in x). The wrong assumption it replaced had stood since 19:53 UTC.
- End: 2026-09-30 21:50 UTC (corrected scale committed as a967dd2).
- Duration: about 12 minutes from first detection to the committed correction; the earlier error stood for about 1 h 45 min.

Sources. The four TBench gallery photos (vendor-supplied, gallery-1 to gallery-4). Standard lead and contact pitches used as scale anchors: 0.5 mm quad-flat IC lead pitch, 0.635 mm connector pitch, 0.5 mm edge-contact pitch. No web sources were consulted and the pitch values were not checked against datasheets in this session; they are the usual values for those package and connector families.

Method. `tools/pitch-check.py` measures the pixel spacing of those standard-pitch features on each board, per axis, and writes `data/scale.json`. The flat-lay photo is a composite of separately scaled cut-outs, so each board has its own scale.

Conclusion.
- Base: 8.82 px/mm along x and 7.94 along z, so its photo is stretched about 11 percent in x. Size about 159.5 x 86.5 mm.
- PeriBoard: 17.57 px/mm on both axes. Size about 45.2 x 86.5 mm.
- Mercury: 22.53 px/mm (0.498 mm contact pitch measured). Size 35.5 x 69.6 mm.
- My earlier claim that the photos have square pixels, and the sizes 161 x 80 mm and 40 x 77 mm that came from it, were wrong. I had tested it only on Mercury's rings. The README, CONTRACT.md and the PR body were corrected.
- Independent check: the PeriBoard's three mating connectors fit the base's connectors with residuals of at most 0.4 mm after the per-board scales were applied. That tests the base's x/z ratio and the PeriBoard scale together without using the pitch anchors. Nominal package body sizes were not usable as anchors (the visible top faces are smaller than the package outlines); lead pitch is.
- Confidence: each board size is good to a few percent. There is no caliper data, no CAD and no third-party measurement. Heights, PCB thickness and the undersides are not measurable from the photos and are assumed.

Open questions.
- Does TBench have STEP or KiCad data for the boards? It would replace every photo-derived number here.
- Is the flat-lay photo really a composite of cut-outs, as the different per-board scales suggest? The scales are consistent with that, but it is an inference.
- Real part heights and the stack height of the PeriBoard on the base.

## 2026-10-11 to 2026-10-12: what moves the UniJack render toward the photograph (realism round)

- Start: 2026-10-11 21:45 UTC (prototype workflow launched). End: 2026-10-12 05:18 UTC (integration finished, docs committed). About 7.5 h wall clock, interrupted by two container restarts; about 3.5 million agent tokens over three workflows (five scouts with adversarial reviewers, then six fixers, two final reviews and a fix round).

Sources. The four TBench gallery photographs (vendor-supplied). three.js r186 and its example add-ons (GTAOPass, SMAAPass, OutputPass, BokehPass, PMREMGenerator), vendored from the installed package; Blender 4.5 as the `bpy` wheel (Cycles, OpenImageDenoise). Everything below was measured in this container (headless Chromium with software WebGL for the viewer, 4 CPU cores for Cycles); nothing was looked up on the web and nothing was tested on a real GPU, Safari or iOS. The Khronos glTF validator was not available, so the GLB was only exported and parsed.

Method. Each realism dimension (photo-derived surface finish, studio lighting and post-processing, micro-geometry, offline path tracing, asset library) was prototyped in its own git worktree and then re-rendered and attacked by a reviewer who had to refute it. The accepted branches were merged and the reviewers' fix lists applied by fixers with file ownership; a final reviewer re-rendered the integrated viewer twice (before and after a fix round).

Conclusion.
- The viewer's largest single gain was not materials or geometry but exposure: the flat-lay photo the textures come from is 2.0 to 2.6 times darker than the 3/4 photograph at the same solder-mask spots (about one stop), so the old top-view calibration against the flat-lay texture had been holding the whole render dark. The acceptance check is now the 3/4 photograph: two plain mask patches in the Hero view at 1.008 and 0.927 of the photo's luminance (band 0.90 to 1.10; white-sweep backdrop 0.982 and 0.903), against 0.303 and 0.276 for the merged prototypes and 0.516 and 0.470 for the September rig. `tools/colorcal.py --hero` is the automated check; the old top-view figure is informational.
- Photo-derived finish maps (colour segmentation into mask, silkscreen, tin, dark body, gold and an enclosed-marking class; lossless WebP with provenance sidecars) give the pads their glints and keep IC markings matte. Known mis-classifications are documented: the grey J400 socket housing reads as metal; the USB-A shell top, photographed dark, reads matte black although the 3/4 photo shows steel.
- Micro-geometry (edge bevels, solder fillets kept inside the photographed footprints, chamfered pin tips) costs little: the kit is 753 draw calls, 138,391 triangles and 285 meshes with the post chain off (budget 800 and 150k). GTAO plus SMAA plus the output pass add 444 to 445 calls per frame; depth of field runs only in the Hero preset while nothing moves; both drop after 20 frames over 30 ms, and `?quality=low` or `high` forces either.
- The PeriBoard headers J1 to J16 stay vertical: the flat-lay texture shows the pin tips end-on as two columns of gold squares inside each body. The 3/4 photo's "lying pins" are the perspective of vertical pins.
- Path-traced stills from the same GLB (Cycles, 1920 by 1080, 2 to 10 minutes per frame on four cores; 2160p estimated at 27 to 35 minutes, not rendered) are visibly closer to a photograph than the real-time viewer: soft area-light shadows, correct reflections on shells and pads. The dark studio is nearer the photo's mask hue (patch A 43/136/168 against the photo's 12/151/189) than the white sweep (61/135/164); both are lighter and less saturated than the photo, and the exposure match is mean-only.
- Verdicts: every prototype was accepted with fixes; the final re-check rated the integrated viewer "closer to the photograph: yes" with three minor documentation gaps, closed in dfa8c45.

Open questions.
- Why the Cycles mask is still lighter and less saturated than the photo at matched luminance (texture exposure, the photo's own lighting baked into the albedo, or the view transform).
- Steel shells photographed dark render matte; a builder-side material override or a photograph of the shells would settle it.
- Behaviour on a real GPU at device pixel ratio 2 (GTAO at full resolution), Safari and iOS.
- `tools/export-glb.mjs` is not byte-deterministic (embedded image order varies), which breaks GLB-hash pinning of the Cycles exposure.
- TBench's permission for the gallery-derived textures and stills; STEP or KiCad data would replace all assumed geometry.
