// PeriBoard builder (key: peri). See CONTRACT.md.
//
// What is on the board, as seen in the photos (gallery-1 3/4 view, gallery-2/3 top-down):
//   * three cream two-row board-to-board receptacles: J201 (top edge), J301 (left), J101 (bottom edge);
//   * sixteen identical small surface-mount pin headers J1..J16 (J1-J15 in a 3 x 5 grid, J16 alone top right),
//     each 2 columns x 5 rows = 10 gold pins standing up out of a short black body, with gull-wing feet on pads.
// Everything is placed from pixel coordinates read off assets/tex/peri-top.webp (20 px per mm), so the footprints
// can be checked against the photo with tools/overlay.py. Heights are NOT visible top-down: they are typical values
// judged from the 3/4 photo and are marked 'assumed'.
//
// Geometry strategy (keeps the mesh count low): each physical part is one Group; its cream housing / black body is ONE
// merged mesh built from boxes (tops of housing pieces are projected from the photo so the top looks like the photo),
// contacts and leads are instanced, the 16 headers share three geometries.

import { planarUV } from '../lib/frame.js';

// ---------------------------------------------------------------- assumed heights (mm), all status 'assumed'
const H_HOUSING = 3.5;      // receptacle outer wall height above the PCB top
const H_ISLAND = 3.2;       // central island is a little lower than the walls
const H_FLOOR = 0.8;        // slot floor
const H_EAR = 1.6;          // end ears (hold-down brackets)
const H_TAB = 0.7;          // solder tabs
const HDR_BODY = 3.0;       // pin-header plastic body (dark part is roughly 40-45% of the pin height in the 3/4 photo)
const HDR_PIN_TOP = 7.5;    // pin tip height above the PCB (judged 6-9 mm from the 3/4 photo)

export function build(ctx) {
  const { THREE, prim, mat, frames, tex, BOARD_T } = ctx;
  const F = frames.peri;
  const g = new THREE.Group(); g.name = 'peri';
  prim.boardSlab(g, { frame: F, topTex: tex.peri, mats: mat, thickness: BOARD_T });

  // ---------------------------------------------------------------- materials
  const photo = mat.photoTop(tex.peri, { roughness: 0.5, env: 0.45 });      // one shared photo material
  const cream = new THREE.MeshStandardMaterial({ color: '#e4dfd0', roughness: 0.42, metalness: 0 });
  const darkBody = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.5, metalness: 0 });
  const pinGold = new THREE.MeshStandardMaterial({ color: '#e2bf68', roughness: 0.28, metalness: 0.9 });
  const footTin = mat.tin;

  // ---------------------------------------------------------------- merged-box geometry helper
  // A box is { c:[A,B,C,D] (mm corners: A=(x0,z0) B=(x1,z0) C=(x1,z1) D=(x0,z1)), y0, y1, taper, photo }.
  const quadTo = (arr, a, b, c, d) => {
    for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
      arr.pos.push(...p, ...q, ...r);
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let i = 0; i < 3; i++) arr.nor.push(nx, ny, nz);
    }
  };
  const inset = (cs, t) => {
    const n = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l * t, dz / l * t]; };
    const [A, B, C, D] = cs;
    const add = (P, u, v) => [P[0] + u[0] + v[0], P[1] + u[1] + v[1]];
    return [add(A, n(A, B), n(A, D)), add(B, n(B, A), n(B, C)), add(C, n(C, D), n(C, B)), add(D, n(D, C), n(D, A))];
  };
  function mergeBoxes(boxes, { uvFrame = null } = {}) {
    const side = { pos: [], nor: [] }, top = { pos: [], nor: [] };
    for (const bx of boxes) {
      const bot = bx.c, tp = bx.taper > 0 ? inset(bot, bx.taper) : bot, y0 = bx.y0 ?? 0, y1 = bx.y1;
      const b = (i) => [bot[i][0], y0, bot[i][1]], u = (i) => [tp[i][0], y1, tp[i][1]];
      quadTo(side, b(2), b(1), u(1), u(2));            // +x side
      quadTo(side, b(0), b(3), u(3), u(0));            // -x side
      quadTo(bx.photo ? top : side, u(3), u(2), u(1), u(0));   // +y top
      quadTo(side, b(3), b(2), u(2), u(3));            // +z side
      quadTo(side, b(1), b(0), u(0), u(1));            // -z side
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...side.pos, ...top.pos], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([...side.nor, ...top.nor], 3));
    geo.addGroup(0, side.pos.length / 3, 0);
    if (top.pos.length) geo.addGroup(side.pos.length / 3, top.pos.length / 3, 1);
    if (uvFrame) planarUV(geo, uvFrame);
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  }
  const meshOf = (geo, mats, name) => {
    const m = new THREE.Mesh(geo, mats); m.name = name; m.castShadow = m.receiveShadow = true; return m;
  };
  const rectMM = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];

  // ---------------------------------------------------------------- receptacle (J201 / J301 / J101)
  // Coordinates are texture pixels. `a` is the small in-plane tilt of the connector in the texture (rad), applied about
  // `pivot`; rectangles in `frame` coordinates are rotated with it, rectangles in `meas` are read at their actual
  // (already tilted) place in the photo and are un-rotated first so they land back where they were read.
  function receptacle(spec) {
    const { ref, orient, pivot, a, frameRects, measRects, leads, contacts, tabs } = spec;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rot = (x, y) => { const dx = x - pivot[0], dy = y - pivot[1]; return [pivot[0] + dx * ca - dy * sa, pivot[1] + dx * sa + dy * ca]; };
    const unrot = (x, y) => { const dx = x - pivot[0], dy = y - pivot[1]; return [pivot[0] + dx * ca + dy * sa, pivot[1] - dx * sa + dy * ca]; };
    const mm = ([x, y]) => [F.x(x), F.z(y)];
    // px rectangle (unrotated frame) -> rotated mm corners
    const corners = (x0, y0, x1, y1) => [rot(x0, y0), rot(x1, y0), rot(x1, y1), rot(x0, y1)].map(mm);
    const measCorners = (x0, y0, x1, y1) => {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, [ux, uy] = unrot(cx, cy), w = x1 - x0, h = y1 - y0;
      return corners(ux - w / 2, uy - h / 2, ux + w / 2, uy + h / 2);
    };
    const grp = new THREE.Group();

    const housing = [], tabBoxes = [];
    for (const r of frameRects) housing.push({ c: corners(...r.r), y0: r.y0 ?? 0, y1: r.y1, photo: r.photo ?? true });
    for (const r of measRects) housing.push({ c: measCorners(...r.r), y0: r.y0 ?? 0, y1: r.y1, photo: r.photo ?? true });
    for (const r of tabs) tabBoxes.push({ c: measCorners(...r), y0: 0, y1: H_TAB, photo: true });
    const hm = meshOf(mergeBoxes(housing, { uvFrame: F }), [cream, photo], 'housing'); grp.add(hm);
    const tm = meshOf(mergeBoxes(tabBoxes, { uvFrame: F }), [mat.darkSteel, photo], 'solder-tabs'); grp.add(tm);

    // instanced leads (flat foot on the PCB + a thin riser up the wall) and gold contacts in the slots
    const map = (u, v) => (orient === 'h' ? [u, v] : [v, u]);            // (along, across) -> texture px
    const leadItems = [], contactItems = [];
    const T = 0.12, LW = 0.26, RISER = 0.9, ry = -a;
    for (const row of leads.rows) {
      const dir = Math.sign(row.tip - row.base) || 1, lenMM = Math.abs(row.tip - row.base) / F.s;
      for (let i = 0; i < leads.n; i++) {
        const u = leads.u0 + i * leads.pitch;
        const [cx, cy] = mm(rot(...map(u, (row.base + row.tip) / 2)));
        leadItems.push({ p: [cx, T / 2, cy], s: orient === 'h' ? [LW, T, lenMM] : [lenMM, T, LW], ry });
        const [rx, rz] = mm(rot(...map(u, row.base + dir * 0.06 * F.s)));
        leadItems.push({ p: [rx, RISER / 2, rz], s: orient === 'h' ? [LW, RISER, 0.1] : [0.1, RISER, LW], ry });
      }
    }
    for (const row of contacts.rows) {
      for (let i = 0; i < contacts.n; i++) {
        const u = contacts.u0 + i * contacts.pitch;
        const [cx, cy] = mm(rot(...map(u, row.v)));
        contactItems.push({ p: [cx, H_FLOOR + contacts.h / 2, cy], s: orient === 'h' ? [0.2, contacts.h, 0.13] : [0.13, contacts.h, 0.2], ry });
      }
    }
    const lm = prim.instanced(grp, prim.UNIT_BOX, footTin, leadItems, 'leads');
    const cm = prim.instanced(grp, prim.UNIT_BOX, pinGold, contactItems, 'contacts');
    void lm; void cm;
    prim.meta(grp, {
      ref, kind: 'connector', status: 'photo-derived',
      label: `Board-to-board receptacle ${ref}`,
      desc: `Appears to be a two-row board-to-board receptacle (about ${leads.n} leads per row counted, ~0.5 mm lead pitch measured in the photo). Footprint from the photo; wall height ${H_HOUSING} mm, slot depth and contact shapes assumed. Designator ${ref} is printed on the board.`,
    });
    return grp;
  }

  const SLOTC = { n: 55, h: 2.2 };

  // J201 - along the top edge (texture x 55..757, y 55..195)
  g.add(receptacle({
    ref: 'J201', orient: 'h', pivot: [100, 116], a: -0.029,
    frameRects: [
      { r: [98, 70, 722, 165], y1: H_FLOOR },                     // slot floor
      { r: [98, 70, 722, 88], y1: H_HOUSING },                    // far wall
      { r: [98, 150, 722, 165], y1: H_HOUSING },                  // near wall
      { r: [98, 70, 130, 165], y1: H_HOUSING },                   // left end block
      { r: [706, 70, 722, 165], y1: H_HOUSING },                  // right end block
      { r: [130, 101, 706, 132], y1: H_ISLAND },                  // central island
      { r: [55, 81, 98, 112], y1: H_EAR },                        // left ears
      { r: [55, 161, 98, 195], y1: H_EAR },
      { r: [74, 112, 98, 161], y1: H_EAR },
    ],
    measRects: [
      { r: [722, 55, 757, 141], y1: H_HOUSING * 0.9 },            // right end cap
      { r: [722, 141, 750, 170], y1: H_EAR },
    ],
    tabs: [[42, 121, 64, 155], [741, 94, 760, 130]],
    leads: { n: 56, u0: 130, pitch: 9.91, rows: [{ base: 170, tip: 196 }, { base: 75, tip: 62 }] },
    contacts: { ...SLOTC, u0: 135, pitch: 9.91, rows: [{ v: 98 }, { v: 135 }] },
  }));

  // J101 - along the bottom edge (texture x 50..787, y 1392..1528)
  g.add(receptacle({
    ref: 'J101', orient: 'h', pivot: [100, 1466], a: -0.014,
    frameRects: [
      { r: [100, 1420, 742, 1513], y1: H_FLOOR },
      { r: [100, 1420, 742, 1433], y1: H_HOUSING },
      { r: [100, 1496, 742, 1513], y1: H_HOUSING },
      { r: [100, 1420, 142, 1513], y1: H_HOUSING },
      { r: [724, 1420, 742, 1513], y1: H_HOUSING },
      { r: [142, 1446, 724, 1484], y1: H_ISLAND },
      { r: [66, 1400, 100, 1420], y1: H_EAR },
      { r: [66, 1500, 100, 1520], y1: H_EAR },
      { r: [84, 1420, 100, 1500], y1: H_EAR },
    ],
    measRects: [
      { r: [742, 1400, 768, 1518], y1: H_HOUSING * 0.9 },
    ],
    tabs: [[50, 1442, 80, 1480], [756, 1442, 786, 1480]],
    leads: { n: 56, u0: 141, pitch: 10.0, rows: [{ base: 1418, tip: 1392 }, { base: 1512, tip: 1528 }] },
    contacts: { ...SLOTC, u0: 146, pitch: 10.0, rows: [{ v: 1440 }, { v: 1489 }] },
  }));

  // J301 - vertical on the left (texture x 83..214, y 295..1022); `frame` coordinates are (x, y) px as well
  g.add(receptacle({
    ref: 'J301', orient: 'v', pivot: [152, 650], a: -0.02,
    frameRects: [
      { r: [111, 335, 204, 985], y1: H_FLOOR },
      { r: [111, 335, 127, 985], y1: H_HOUSING },
      { r: [194, 335, 204, 985], y1: H_HOUSING },
      { r: [111, 335, 204, 358], y1: H_HOUSING },
      { r: [111, 940, 204, 985], y1: H_HOUSING },
      { r: [136, 358, 175, 940], y1: H_ISLAND },
    ],
    measRects: [
      { r: [85, 308, 125, 340], y1: H_EAR },
      { r: [158, 307, 200, 335], y1: H_HOUSING * 0.9 },
      { r: [95, 975, 125, 1005], y1: H_EAR },
      { r: [158, 975, 205, 1000], y1: H_HOUSING * 0.9 },
    ],
    tabs: [[125, 295, 160, 326], [128, 993, 170, 1022]],
    leads: { n: 55, u0: 386, pitch: 10.11, rows: [{ base: 107, tip: 82 }, { base: 196, tip: 214 }] },
    contacts: { ...SLOTC, u0: 391, pitch: 10.11, rows: [{ v: 131 }, { v: 179 }] },
  }));

  // ---------------------------------------------------------------- pin headers J1..J16
  // Shared geometry, built once around (0,0): 2 columns x 5 rows, measured pitch 1.1 mm (22 px in the texture).
  const PITCH = 1.1, PX = 0.55, FOOT_X = 2.1;
  const rowsZ = [-2, -1, 0, 1, 2].map((i) => i * PITCH);
  const bodyBoxes = [
    { c: rectMM(0, 0, 2.9, 5.6), y0: 0, y1: HDR_BODY - 0.2 },
    { c: rectMM(0, 0, 2.9, 5.6), y0: HDR_BODY - 0.2, y1: HDR_BODY, taper: 0.16 },
  ];
  const pinBoxes = [], footBoxes = [];
  for (const cx of [-PX, PX]) for (const z of rowsZ) {
    pinBoxes.push({ c: rectMM(cx, z, 0.4, 0.4), y0: 0.6, y1: HDR_PIN_TOP - 0.5 });
    pinBoxes.push({ c: rectMM(cx, z, 0.4, 0.4), y0: HDR_PIN_TOP - 0.5, y1: HDR_PIN_TOP, taper: 0.13 });
  }
  for (const s of [-1, 1]) for (const z of rowsZ) {
    // gull-wing lead: stub out of the body side, short vertical leg, foot lying on the pad
    footBoxes.push({ c: rectMM(s * 1.55, z, 0.8, 0.3), y0: 0.7, y1: 0.88 });
    footBoxes.push({ c: rectMM(s * 1.78, z, 0.16, 0.3), y0: 0.0, y1: 0.88 });
    footBoxes.push({ c: rectMM(s * FOOT_X, z, 1.1, 0.5), y0: 0.0, y1: 0.14 });
  }
  const bodyGeo = mergeBoxes(bodyBoxes), pinGeo = mergeBoxes(pinBoxes), footGeo = mergeBoxes(footBoxes);

  // header centres (texture px), template-matched on the solder pads; the ncc offset (+4,+2) centres on the pad pair
  const HDR = {
    J1: [358, 1225], J2: [534, 1225], J3: [709, 1224],
    J4: [357, 1047], J5: [532, 1045], J6: [708, 1043],
    J7: [355, 867], J8: [530, 864], J9: [706, 861],
    J10: [353, 690], J11: [529, 685], J12: [703, 681],
    J13: [351, 512], J14: [526, 508], J15: [700, 502],
    J16: [697, 328],
  };
  for (const [ref, [px, py]] of Object.entries(HDR)) {
    const x = F.x(px + 4), z = F.z(py + 2);
    const hg = new THREE.Group(); hg.position.set(x, 0, z);
    hg.add(meshOf(bodyGeo, darkBody, 'body'), meshOf(pinGeo, pinGold, 'pins'), meshOf(footGeo, footTin, 'feet'));
    prim.meta(hg, {
      ref, kind: 'pin', status: 'photo-derived', label: `Pin header ${ref}`,
      desc: 'Appears to be a 2 x 5 surface-mount pin header: 10 pins counted in the photos, pitch about 1.1 mm measured. Footprint from the photo; body height 3.0 mm and pin height about 7.5 mm are assumed (judged from the 3/4 photo). Designator ' + ref + ' is printed on the board.',
    });
    g.add(hg);
  }

  prim.meta(g, { label: 'PeriBoard', kind: 'board', status: 'photo-derived', desc: 'Board outline and size derived from photos (40.1 x 77.4 mm); 1.6 mm thickness assumed; the underside is not photographed and is shown plain.' });
  g.userData.anchors = {};
  return g;
}
