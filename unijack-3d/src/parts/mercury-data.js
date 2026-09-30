// Measured data for the Mercury builder. ALL numbers are TEXTURE PIXELS read off assets/tex/mercury-front.webp
// (front, 'F') or assets/tex/mercury-back.webp (back, 'B'), both 801 x 1568 px at 22.53 px/mm, measured with
// tools/crop.py grids (see qa-out/mercury/*.png). Nothing here is CAD or a vendor dimension.

/** Affine registration of the BACK photo onto the FRONT photo (fitted on the 4 mounting-hole centres and the 4 board corners;
 *  residual <= 3.6 px = 0.16 mm). The back photo is a view from below, so x is mirrored.
 *  [xf, yf] = [xb, yb, 1] * M */
export const REG = [
  [-1.00580813, 0.00364825],
  [0.00958769, 1.0018371],
  [790.697274, -4.53363838],
];

/** Mounting-hole centres in FRONT px (centres of the gold annulus fitted on the photo). Outer ring diameter measures 69 px = 3.06 mm,
 *  the see-through disc about 45 px = 2.0 mm. */
export const HOLES_F = [[135.3, 43.5], [723.6, 45.1], [136.0, 1522.5], [731.4, 1522.5]];
export const HOLE_R_MM = 1.0, RING_OUTER_MM = 1.53;

/** Fingers (gold contacts), counted on the photos. Each group: first finger centre (px y), pitch (px), count.
 *  FRONT: fingers span x 1.5 .. 60.5 px.  BACK: same span after registration. */
export const FINGERS_F = [{ y0: 31.6, pitch: 11.223, n: 72 }, { y0: 884.0, pitch: 11.312, n: 58 }];
export const FINGERS_B = [{ y0: 39.2, pitch: 11.268, n: 72 }, { y0: 896.5, pitch: 11.164, n: 58 }];   // BACK px (x ~ 729..790 there)
export const FINGER_X_F = [1.5, 60.5];   // front px
export const FINGER_W_MM = 0.30, FINGER_H_MM = 0.05;

/** Board outline, FRONT px, clockwise from top-left. Top-surface boundary measured on the photo:
 *  top edge y = -0.09 + 0.00446 x, right edge x = 786 + 0.0058 y, bottom edge y = 1566, fingers edge x = 0.3 + 0.00075 y.
 *  Notches: top  x 404.5..500, floor y 44.5;  bottom x 411..505, ceiling y 1521;  key notch in the fingers edge: floor x 90.8, y 846.5..868.5. */
export const OUT = {
  tl: [0.5, 0.0], tr: [786.0, 3.4], br: [795.1, 1566], bl: [1.5, 1566],
  topNotch: { x0: 404.5, x1: 500, y: 44.5, r: 8 },
  botNotch: { x0: 411, x1: 505, y: 1521, r: 8 },
  keyNotch: { xEnd: 90.8, y0: 846.5, y1: 868.5 },
};

// ------------------------------------------------------------------ FRONT parts (top-face boxes, FRONT px [x0,y0,x1,y1])
export const F = {
  vns: { body: [100, 139, 230, 297], tabTop: [127, 124, 201, 140], tabBot: [120, 299, 207, 324] },
  ecap: { c: [291, 180], r: 75, tab: [311, 275, 349, 305] },
  tssop: { body: [521, 191, 610, 301], n: 8, pitch: 12.86, leadsCy: 249.0 },
  ind472: [372, 325, 466, 418],
  ind222: [671, 307, 776, 400],
  brown: { lid: [397, 520, 561, 620], term: [380, 550, 398, 600] },
  blue: { c: [675, 573], r: 75, tab: [660, 648, 715, 668], blob: [730, 625, 762, 647] },
  bga: [304, 673, 582, 950],
  ham: { body: [652, 701, 730, 777], rightY: [704, 719, 733, 747.5, 762.5], leftY: [719, 733, 748, 762] },
  sotA: { body: [261, 498, 329, 529], leadsTop: [271.5, 319], leadBot: 296 },   // 2 leads on top (-z) side, 1 on bottom (+z)
  sotB: { body: [212.5, 594, 239, 656], leadsRight: [601, 646.5], leadLeft: 624 },  // 2 leads on right (+x) side, 1 on left
};

// ------------------------------------------------------------------ BACK parts (BACK px)
export const B = {
  soic: { body: [411, 219, 527, 303], leadX: [425.7, 455.7, 483.4, 513.4], tipTop: 181, tipBot: 339 },
  sot: { body: [157, 280, 224, 304], leadTop: 192.5, leadsBot: [171, 215], tipTop: 258, tipBot: 328 },
};
