# Derived surface-finish maps (photo-derived, by colour segmentation)

Written by `tools/derive-maps.py` from `assets/tex/*.webp`; same pixel grid as the photo textures. Status: **photo-derived**: the finishes are
inferred from each pixel's colour, not measured. A white pixel gets the matte silkscreen finish whether it is silkscreen or white plastic; a grey
pixel gets the metal finish whether it is a pad, a shield or a grey part. Nothing is added that the photo does not show.

| file | channels | meaning |
|---|---|---|
| `<tex>-rm.webp` | G = roughness, B = metalness (R unused = 1) | three.js `roughnessMap` + `metalnessMap`; glTF metallicRoughness layout |
| `<tex>-nrm.webp` | tangent-space normal (OpenGL +Y) | mild relief: silkscreen proud, pads and gold below the mask. Not generated for mercury-back (viewed from below, mirrored u). |
| `<tex>-albedo.webp` | sRGB colour | only written with `--delight`; not used by the viewer (see "Delight pass" below) |

## Classes and finishes

| class | rule (PIL HSV 0..255, smoothstep edges) | roughness | metalness | relief |
|---|---|---|---|---|
| mask | S [70, 110] and hue [112, 175] | 0.45 | 0.0 | +0.0 |
| silk | S below [45, 100] and V [178, 205] | 0.78 | 0.0 | +1.0 |
| tin | S below [45, 100], V above [75, 105] and below [178, 205] | 0.32 | 0.9 | -1.0 |
| dark | S below [45, 100] and V below [75, 105] | 0.62 | 0.0 | +0.0 |
| gold | S [55, 95], hue [4, 50], V [50, 90] | 0.3 | 0.9 | -0.6 (Mercury only; base-top and peri-top use roughness 0.4, metalness 0.5, relief -0.3: tan connector plastic is colour-identical to gold plating there, so a hedged half-metal finish) |
| other | remaining weight (ambiguous / coloured pixels) | 0.52 | 0.0 | +0.0 |

## Delight pass (measured, rejected by default)

The photos carry the photographer's lighting, so `--delight` divides the albedo by a wide masked Gaussian blur of the solder-mask luminance. Measured on these
textures the large-scale luminance of the plain mask (per-tile 20th percentile, 48 px tiles, smoothed) varies by a factor of 3 to 7 across each board, but the pattern
follows the copper: mask over pours and dense traces is lighter than mask over bare laminate (e.g. the pour on the lower left of the Mercury back). That is real
contrast, not lighting, and flattening it removed it while leaving the actual lighting (which is nearly even in these studio flat lays) alone. The viewer therefore
loads the ORIGINAL textures; the albedo files are opt-in for experiments and are not shipped.

Measured with the default blur (sigma = min(W, H) / 7) and clamp (0.86 .. 1.16): raw correction ratio ranges base-top 0.50 .. 1.34 (33 percent of mask pixels
outside the clamp), peri-top 0.62 .. 1.73 (60 percent), mercury-front 0.52 .. 2.46 (56 percent), mercury-back 0.51 .. 1.93 (52 percent). A correction that
is clamped on a third to a half of the pixels is not a lighting correction.

Maps are anti-aliased with a 0.6 px Gaussian; the relief is smoothed with 1.0 px before the gradient. Delight blur sigma = min(W, H) / 7, ratio clamped to (0.86, 1.16).

## This run

| texture | mask | silk | tin | dark | gold | other | mean roughness | mean metalness | max normal tilt | delight ratio range (raw) | clamped px |
|---|---|---|---|---|---|---|---|---|---|---|---|
| base-top | 0.604 | 0.081 | 0.157 | 0.112 | 0.030 | 0.015 | 0.478 | 0.144 | 32.6 | - | - |
| peri-top | 0.522 | 0.239 | 0.106 | 0.073 | 0.040 | 0.019 | 0.525 | 0.111 | 32.7 | - | - |
| mercury-front | 0.561 | 0.085 | 0.142 | 0.118 | 0.087 | 0.006 | 0.468 | 0.199 | 32.9 | - | - |
| mercury-back | 0.679 | 0.116 | 0.097 | 0.018 | 0.082 | 0.008 | 0.47 | 0.146 | - | - | - |

```json
{
 "base-top": {
  "class_fraction": {
   "mask": 0.6037,
   "silk": 0.0814,
   "tin": 0.157,
   "dark": 0.1122,
   "gold": 0.0303,
   "other": 0.0154
  },
  "roughness_mean": 0.478,
  "metalness_mean": 0.144,
  "normal_max_tilt_deg": 32.6
 },
 "peri-top": {
  "class_fraction": {
   "mask": 0.5225,
   "silk": 0.2389,
   "tin": 0.1058,
   "dark": 0.0734,
   "gold": 0.0403,
   "other": 0.0191
  },
  "roughness_mean": 0.525,
  "metalness_mean": 0.111,
  "normal_max_tilt_deg": 32.7
 },
 "mercury-front": {
  "class_fraction": {
   "mask": 0.5615,
   "silk": 0.0853,
   "tin": 0.1423,
   "dark": 0.1181,
   "gold": 0.087,
   "other": 0.0059
  },
  "roughness_mean": 0.468,
  "metalness_mean": 0.199,
  "normal_max_tilt_deg": 32.9
 },
 "mercury-back": {
  "class_fraction": {
   "mask": 0.6793,
   "silk": 0.1162,
   "tin": 0.0974,
   "dark": 0.0176,
   "gold": 0.0818,
   "other": 0.0077
  },
  "roughness_mean": 0.47,
  "metalness_mean": 0.146
 }
}
```
