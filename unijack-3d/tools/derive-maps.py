#!/usr/bin/env python3
"""Derive per-texture surface-finish maps from the photo textures by COLOUR SEGMENTATION.

  PY tools/derive-maps.py [--tex base-top,peri-top,mercury-front,mercury-back] [--delight] [--normal-strength 1.0]

For each texture in assets/tex the pixels are soft-classified into five finishes by hue / saturation / value
(PIL HSV, all channels 0..255):

  mask   solder mask (teal / blue): saturated, hue 112..175      -> glossy dielectric, roughness 0.45, metalness 0
  silk   white silkscreen and white plastic: low S, V >= ~190    -> matte, roughness 0.78, metalness 0
  tin    exposed tin / silver pads, shields, cans: low S, mid V  -> metal, roughness 0.32, metalness 0.9
  dark   black IC bodies / black plastic: low S, V <= ~85        -> matte, roughness 0.62, metalness 0
  gold   gold / tan contacts and fingers: hue 4..50, S >= ~70    -> metal, roughness 0.30, metalness 0.9 on Mercury; on the base and
                                                                    PeriBoard tan connector plastic is colour-identical, so a hedged 0.40 / 0.5
  other  anything ambiguous (anti-aliased edges, coloured parts) -> roughness 0.52, metalness 0

Outputs on the SAME pixel grid, under assets/tex/derived/:
  <tex>-rm.webp      R = 255 (unused), G = roughness, B = metalness   (three.js roughnessMap / metalnessMap, glTF metallicRoughness)
  <tex>-nrm.webp     tangent-space normal map: silkscreen sits slightly proud, pads slightly below the mask (not for mercury-back,
                     whose photo is viewed from below with mirrored u; a normal map would light its relief the wrong way)
  <tex>-albedo.webp  ONLY with --delight (off by default, NOT loaded by the viewer): the photo with the large-scale luminance of the
                     solder-mask pixels flattened (divided by a wide masked Gaussian blur of their linear luminance, clamped). Measured and
                     rejected: the flat-lay photos are evenly lit, and their large-scale luminance variation is REAL (solder mask over
                     copper pours and dense traces is lighter than over bare laminate), so flattening it destroys real contrast.
  README.md          the thresholds, class fractions and (with --delight) the delight statistics of this run

Honesty: every map is PHOTO-DERIVED by colour segmentation of the photo. A pixel that is white gets a matte silkscreen finish whether it is
silkscreen or a white plastic housing; a grey pixel gets a metal finish whether it is a pad or a grey plastic part. Nothing is added
that the photo does not show, but the finishes are inferred from colour, not measured.
Needs: pillow, numpy, scipy.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, median_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, 'assets', 'tex'); OUT = os.path.join(TEX, 'derived')
ALL = ['base-top', 'peri-top', 'mercury-front', 'mercury-back']
NO_NORMAL = {'mercury-back'}

# finish values per class: (roughness, metalness, relief height)
FINISH = {
    'mask': (0.45, 0.00, 0.0),
    'silk': (0.78, 0.00, +1.0),
    'tin': (0.32, 0.90, -1.0),
    'dark': (0.62, 0.00, 0.0),
    'gold': (0.30, 0.90, -0.6),
    'other': (0.52, 0.00, 0.0),
}
# gold/tan is ambiguous by colour on the base and PeriBoard textures (tan connector housings are the same colour as gold plating), so
# there it gets a hedged half-metal finish; on Mercury the class is the edge fingers and plated rings, which really are gold.
GOLD_BY_TEX = {'base-top': (0.40, 0.50, -0.3), 'peri-top': (0.40, 0.50, -0.3)}
# thresholds (PIL HSV 0..255); each is a smoothstep edge pair [low, high]
T = {
    'mask_sat': [70, 110], 'mask_hue': [112, 175],
    'gold_sat': [55, 95], 'gold_hue': [4, 50], 'gold_val': [50, 90],
    'lowsat': [45, 100],                     # "colourless" pixels: 1 - smoothstep(S)
    'silk_val': [178, 205],
    'tin_val': [75, 105],                    # tin lives between dark and silk in V
    'dark_val': [75, 105],
}
SIGMA_CLEAN = 0.6          # px, anti-alias the final maps
SIGMA_HEIGHT = 1.0         # px, smooth the relief before taking gradients
DELIGHT_SIGMA_FRAC = 1 / 7  # of min(W, H): width of the "photographer's lighting" blur
DELIGHT_CLAMP = (0.86, 1.16)


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / max(hi - lo, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def hueband(h, lo, hi, soft=6):
    return smoothstep(h, lo - soft, lo + soft) * (1 - smoothstep(h, hi - soft, hi + soft))


def srgb_to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055) * 255.0


def classify(rgb8):
    im = Image.fromarray(rgb8, 'RGB')
    hsv = np.asarray(im.convert('HSV')).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    lowsat = 1 - smoothstep(S, *T['lowsat'])
    w = {
        'mask': smoothstep(S, *T['mask_sat']) * hueband(H, *T['mask_hue']),
        'gold': smoothstep(S, *T['gold_sat']) * hueband(H, *T['gold_hue']) * smoothstep(V, *T['gold_val']),
        'silk': lowsat * smoothstep(V, *T['silk_val']),
        'tin': lowsat * smoothstep(V, *T['tin_val']) * (1 - smoothstep(V, *T['silk_val'])),
        'dark': lowsat * (1 - smoothstep(V, *T['dark_val'])),
    }
    tot = sum(w.values())
    w['other'] = np.clip(1 - tot, 0, 1)
    tot = tot + w['other']
    for k in w: w[k] = w[k] / np.maximum(tot, 1e-6)
    return w


def derive(name, delight=True, nstrength=1.0):
    src = os.path.join(TEX, name + '.webp')
    rgb8 = np.asarray(Image.open(src).convert('RGB'))
    Hh, Ww = rgb8.shape[:2]
    FINISH_T = dict(FINISH); FINISH_T['gold'] = GOLD_BY_TEX.get(name, FINISH['gold'])
    w = classify(rgb8)
    hard = np.argmax(np.stack([w[k] for k in FINISH]), axis=0)
    hard = median_filter(hard, size=3)                       # kill one-pixel speckle for the fractions / height
    keys = list(FINISH)
    frac = {k: float((hard == i).mean()) for i, k in enumerate(keys)}

    rough = sum(w[k] * FINISH_T[k][0] for k in keys)
    metal = sum(w[k] * FINISH_T[k][1] for k in keys)
    rough = gaussian_filter(rough, SIGMA_CLEAN); metal = gaussian_filter(metal, SIGMA_CLEAN)
    rm = np.stack([np.full_like(rough, 1.0), rough, metal], axis=-1)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((np.clip(rm, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, name + '-rm.webp'), quality=92, method=6)

    rep = {'class_fraction': {k: round(v, 4) for k, v in frac.items()}, 'roughness_mean': round(float(rough.mean()), 3), 'metalness_mean': round(float(metal.mean()), 3)}

    if name not in NO_NORMAL:
        # relief in "pixels of height": silk proud, pads below the mask. Normal = (-dh/du, +dh/dv, 1); v runs UP the image.
        height = sum(w[k] * FINISH_T[k][2] for k in keys)
        height = gaussian_filter(height, SIGMA_HEIGHT)
        dy, dx = np.gradient(height)                          # dy = d/d(row) = d/d(-v)
        k = 0.9 * nstrength                                   # slope per pixel of class change (mild)
        nx, ny, nz = -k * dx, +k * dy, np.ones_like(dx)
        n = np.stack([nx, ny, nz], axis=-1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
        Image.fromarray((np.clip(n * 0.5 + 0.5, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, name + '-nrm.webp'), quality=95, method=6)
        rep['normal_max_tilt_deg'] = round(float(np.degrees(np.arccos(n[..., 2].min()))), 1)

    if delight:
        lin = srgb_to_lin(rgb8.astype(np.float32))
        L = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        m = (hard == keys.index('mask')).astype(np.float32)
        sig = min(Hh, Ww) * DELIGHT_SIGMA_FRAC
        num = gaussian_filter(L * m, sig); den = gaussian_filter(m, sig)
        local = num / np.maximum(den, 1e-4)                  # large-scale luminance of the mask surface, holes filled by the blur
        valid = den > 0.05
        ref = float((L * m).sum() / max(m.sum(), 1))        # mean mask luminance: preserved
        ratio = np.where(valid, ref / np.maximum(local, 1e-4), 1.0)
        ratio_raw = ratio.copy()
        ratio = np.clip(ratio, *DELIGHT_CLAMP)
        out = lin * ratio[..., None]
        Image.fromarray(lin_to_srgb(out).astype(np.uint8), 'RGB').save(os.path.join(OUT, name + '-albedo.webp'), quality=90, method=6)
        rep['delight'] = {
            'blur_sigma_px': round(sig, 1), 'mask_lum_mean_linear': round(ref, 4),
            'large_scale_lum_range_before': [round(float(local[valid].min()), 4), round(float(local[valid].max()), 4)],
            'ratio_raw_range': [round(float(ratio_raw[valid].min()), 3), round(float(ratio_raw[valid].max()), 3)],
            'ratio_clamped_to': list(DELIGHT_CLAMP), 'pixels_clamped_frac': round(float((ratio_raw[valid] < DELIGHT_CLAMP[0]).mean() + (ratio_raw[valid] > DELIGHT_CLAMP[1]).mean()), 4),
            'mask_lum_mean_after': round(float(((out @ np.array([0.2126, 0.7152, 0.0722])) * m).sum() / max(m.sum(), 1)), 4),
        }
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tex', default=','.join(ALL)); ap.add_argument('--delight', action='store_true'); ap.add_argument('--normal-strength', type=float, default=1.0); ap.add_argument('--mask-roughness', type=float, default=None, help='override the solder-mask roughness (calibration sweeps)')
    a = ap.parse_args()
    if a.mask_roughness is not None: FINISH['mask'] = (a.mask_roughness, 0.0, 0.0)
    reports = {}
    for n in a.tex.split(','):
        reports[n] = derive(n, delight=a.delight, nstrength=a.normal_strength)
        print(n, json.dumps(reports[n]))
    lines = ['# Derived surface-finish maps (photo-derived, by colour segmentation)', '',
             'Written by `tools/derive-maps.py` from `assets/tex/*.webp`; same pixel grid as the photo textures. Status: **photo-derived**: the finishes are',
             'inferred from each pixel\'s colour, not measured. A white pixel gets the matte silkscreen finish whether it is silkscreen or white plastic; a grey',
             'pixel gets the metal finish whether it is a pad, a shield or a grey part. Nothing is added that the photo does not show.', '',
             '| file | channels | meaning |', '|---|---|---|',
             '| `<tex>-rm.webp` | G = roughness, B = metalness (R unused = 1) | three.js `roughnessMap` + `metalnessMap`; glTF metallicRoughness layout |',
             '| `<tex>-nrm.webp` | tangent-space normal (OpenGL +Y) | mild relief: silkscreen proud, pads and gold below the mask. Not generated for mercury-back (viewed from below, mirrored u). |',
             '| `<tex>-albedo.webp` | sRGB colour | only written with `--delight`; not used by the viewer (see "Delight pass" below) |', '',
             '## Classes and finishes', '', '| class | rule (PIL HSV 0..255, smoothstep edges) | roughness | metalness | relief |', '|---|---|---|---|---|']
    rules = {'mask': f"S {T['mask_sat']} and hue {T['mask_hue']}", 'silk': f"S below {T['lowsat']} and V {T['silk_val']}", 'tin': f"S below {T['lowsat']}, V above {T['tin_val']} and below {T['silk_val']}",
             'dark': f"S below {T['lowsat']} and V below {T['dark_val']}", 'gold': f"S {T['gold_sat']}, hue {T['gold_hue']}, V {T['gold_val']}", 'other': 'remaining weight (ambiguous / coloured pixels)'}
    for k, (r, m, h) in FINISH.items():
        note = ''
        if k == 'gold':
            gr, gm, gh = GOLD_BY_TEX['base-top']
            note = f' (Mercury only; base-top and peri-top use roughness {gr}, metalness {gm}, relief {gh:+.1f}: tan connector plastic is colour-identical to gold plating there, so a hedged half-metal finish)'
        lines.append(f'| {k} | {rules[k]} | {r} | {m} | {h:+.1f}{note} |')
    lines += ['', '## Delight pass (measured, rejected by default)', '',
              'The photos carry the photographer\'s lighting, so `--delight` divides the albedo by a wide masked Gaussian blur of the solder-mask luminance. Measured on these',
              'textures the large-scale luminance of the plain mask (per-tile 20th percentile, 48 px tiles, smoothed) varies by a factor of 3 to 7 across each board, but the pattern',
              'follows the copper: mask over pours and dense traces is lighter than mask over bare laminate (e.g. the pour on the lower left of the Mercury back). That is real',
              'contrast, not lighting, and flattening it removed it while leaving the actual lighting (which is nearly even in these studio flat lays) alone. The viewer therefore',
              'loads the ORIGINAL textures; the albedo files are opt-in for experiments and are not shipped.', '',
              'Measured with the default blur (sigma = min(W, H) / 7) and clamp (0.86 .. 1.16): raw correction ratio ranges base-top 0.50 .. 1.34 (33 percent of mask pixels',
              'outside the clamp), peri-top 0.62 .. 1.73 (60 percent), mercury-front 0.52 .. 2.46 (56 percent), mercury-back 0.51 .. 1.93 (52 percent). A correction that',
              'is clamped on a third to a half of the pixels is not a lighting correction.', '',
              f'Maps are anti-aliased with a {SIGMA_CLEAN} px Gaussian; the relief is smoothed with {SIGMA_HEIGHT} px before the gradient. Delight blur sigma = min(W, H) / {round(1 / DELIGHT_SIGMA_FRAC)}, ratio clamped to {DELIGHT_CLAMP}.', '',
              '## This run', '', '| texture | mask | silk | tin | dark | gold | other | mean roughness | mean metalness | max normal tilt | delight ratio range (raw) | clamped px |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for n, r in reports.items():
        f = r['class_fraction']; d = r.get('delight', {})
        lines.append(f"| {n} | {f['mask']:.3f} | {f['silk']:.3f} | {f['tin']:.3f} | {f['dark']:.3f} | {f['gold']:.3f} | {f['other']:.3f} | {r['roughness_mean']} | {r['metalness_mean']} | {r.get('normal_max_tilt_deg', '-')} | {d.get('ratio_raw_range', '-')} | {d.get('pixels_clamped_frac', '-')} |")
    lines += ['', '```json', json.dumps(reports, indent=1), '```', '']
    with open(os.path.join(OUT, 'README.md'), 'w') as f: f.write('\n'.join(lines))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
