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
