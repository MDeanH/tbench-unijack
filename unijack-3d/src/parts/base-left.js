// base-left builder. Owner: base-left. Adds the parts of the base board LEFT of texture x ~ 570 px
// (power jack, regulator, diode, screw terminal, USB + RJ45, LED row, SO-DIMM-style socket J400 with two latches,
// three TSSOP-48 level shifters) to `group` (base-board local frame, mm) and returns { anchors, latches }.
//
// Method: every footprint is read in TEXTURE PIXELS from assets/tex/base-top.webp (crop.py grids) and converted with
// frames.base, so the top faces (planar-UV photo) line up with the photo. All HEIGHTS, plastic/metal colours and latch
// kinematics are not visible in a top-down photo: they are typical values and flagged 'assumed' / described as such.

export async function build(ctx, group) {
  const { THREE, prim, mat, frames, tex } = ctx;
  const F = frames.base;
  const photo = mat.photoTop(tex.base, { roughness: 0.6, env: 0.45 });
  const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

  // ---- local materials (colours picked to read like the photos; not measured) ----
  const M = {
    housing: std('#5a5f65', 0.55),
    housingDark: std('#15171a', 0.7),
    latch: std('#666d75', 0.42, 0.65),
    jack: std('#17191c', 0.72),
    jackLining: std('#7d848b', 0.35, 0.85),
    shell: std('#858c92', 0.36, 0.85),
    shellDark: std('#50565c', 0.5, 0.75),
    cream: std('#d3ccb6', 0.5),
    rj45Carrier: std('#1d1f22', 0.6),
    lampGreen: std('#5fd06a', 0.4, 0, { emissive: '#1d6a2a', emissiveIntensity: 0.5 }),
    chipBody: std('#3a3733', 0.6),
    ceramic: std('#9c8a6c', 0.6),
    ledBody: std('#e6dcc1', 0.45),
    darkContact: std('#3d4146', 0.45, 0.8),
    tin: mat.tin, steel: mat.steel, darkSteel: mat.darkSteel, gold: mat.gold,
    icBlack: mat.icBlack, green: mat.terminalGreen,
  };

  const X = F.x, Z = F.z, L = F.len;
  const mm = (p) => p / F.s;
  const meta = prim.meta;
  const newGroup = (name, md) => { const g = new THREE.Group(); g.name = name; group.add(g); meta(g, md); return g; };

  /** box from a texture-pixel bbox [x0,y0,x1,y1]; h and y0 in mm */
  const B = (parent, b, h, { y0 = 0, top = null, side, radius = 0, rotY = 0 } = {}) => {
    const o = F.box(b);
    return prim.boxPart(parent, { frame: F, size: [o.w, h, o.d], pos: [o.cx, y0, o.cz], rotY, radius, top, side });
  };
  /** small chip (passive) with tin end caps. axis = direction of the long side */
  const chip = (parent, b, h, axis = 'x', body = M.chipBody, capFrac = 0.24) => {
    B(parent, b, h, { top: photo, side: body });
    const [x0, y0, x1, y1] = b;
    if (axis === 'x') { const c = (x1 - x0) * capFrac; B(parent, [x0, y0, x0 + c, y1], h * 1.04, { side: M.tin }); B(parent, [x1 - c, y0, x1, y1], h * 1.04, { side: M.tin }); }
    else { const c = (y1 - y0) * capFrac; B(parent, [x0, y0, x1, y0 + c], h * 1.04, { side: M.tin }); B(parent, [x0, y1 - c, x1, y1], h * 1.04, { side: M.tin }); }
  };
  /** strip between (za,ya) and (zb,yb) (z = board z in mm, y = height) centred on x, for sloped lead shoulders */
  const slopedStrip = (parent, cx, w, t, za, ya, zb, yb, material) => {
    const dz = zb - za, dy = yb - ya, len = Math.hypot(dz, dy);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, len), material);
    m.position.set(cx, (ya + yb) / 2, (za + zb) / 2); m.rotation.x = -Math.atan2(dy, dz);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  /** flat tinned pad / plate lying on the board */
  const plate = (parent, b, t = 0.12, material = M.tin, y0 = 0) => B(parent, b, t, { y0, top: photo, side: material });
  /**
   * Board-level decal that re-uses a CLEAN region of the board photo: the flat-lay texture has the two CLOSED latch arms
   * baked into it, so when a latch rotates open the baked arm would stay behind as a ghost. The decal (y = 0.04) hides
   * that ghost by sampling a nearby plain-trace region (dst and src are texture-pixel boxes).
   */
  const patchMat = photo.clone(); patchMat.polygonOffset = true; patchMat.polygonOffsetFactor = -2; patchMat.polygonOffsetUnits = -2;
  const cleanPatch = (parent, dst, src) => {
    const o = F.box(dst);
    const geo = new THREE.PlaneGeometry(o.w, o.d); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const fx = (p.getX(i) + o.w / 2) / o.w, fz = (p.getZ(i) + o.d / 2) / o.d;
      uv[2 * i] = (src[0] + fx * (src[2] - src[0])) / F.wpx;
      uv[2 * i + 1] = 1 - (src[1] + fz * (src[3] - src[1])) / F.hpx;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, patchMat); m.position.set(o.cx, 0.04, o.cz); m.receiveShadow = true; parent.add(m); return m;
  };

  // =====================================================================================================
  // J100  DC barrel-style power jack (designator printed + legible). Opening faces the board edge (-x).
  // =====================================================================================================
  {
    const g = newGroup('J100-group', { ref: 'J100', label: 'Power jack (barrel style)', kind: 'connector', status: 'photo-derived',
      desc: 'Appears to be a DC barrel-style power jack with its opening towards the board edge. Footprint from the photo; 10.5 mm height, black plastic and steel tabs are assumed typical values.' });
    const H = 10.5;
    const plateEnd = 53;                                   // px: front plate x 18..53 (hole plate), main block 53..137
    const o = F.box([18, 20, plateEnd, 132]);
    const zc = Z(70), yc = 5.2, r = 3.0;                   // barrel bore centre (z from the photo body span, height assumed)
    // front plate with round bore (extruded in x)
    const shape = new THREE.Shape();
    const zmin = o.cz - o.d / 2, zmax = o.cz + o.d / 2;
    shape.moveTo(-zmax, 0); shape.lineTo(-zmin, 0); shape.lineTo(-zmin, H - 0.02); shape.lineTo(-zmax, H - 0.02); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(-zc, yc, r, 0, Math.PI * 2, true); shape.holes.push(hole);
    const pg = new THREE.ExtrudeGeometry(shape, { depth: o.w, bevelEnabled: false, curveSegments: 28 });
    pg.rotateY(Math.PI / 2); pg.translate(o.cx - o.w / 2, 0, 0);
    const pm = new THREE.Mesh(pg, [M.jack, M.jack]); pm.castShadow = pm.receiveShadow = true; g.add(pm);
    B(g, [18, 20, plateEnd, 132], 0.04, { y0: H - 0.03, top: photo, side: M.jack });      // photo cap on the plate top
    // bore lining + centre pin
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, o.w, 36, 1, true), new THREE.MeshStandardMaterial({ color: '#7d848b', roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
    tube.rotation.z = Math.PI / 2; tube.position.set(o.cx, yc, zc); g.add(tube);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, mm(24), 20), M.steel);
    pin.rotation.z = Math.PI / 2; pin.position.set(X(plateEnd) - mm(12), yc, zc); g.add(pin);
    // main block (top shows the photo) and rear boss
    B(g, [plateEnd, 20, 137, 132], H, { top: photo, side: M.jack, radius: 0.35 });
    B(g, [137, 36, 158, 131], 7.4, { top: photo, side: M.jack, radius: 0.3 });
    // steel centre-pin lug at the rear boss (photo: tarnished metal strip with a round eye)
    B(g, [147, 52, 160, 98], 7.4, { top: photo, side: M.steel });
    // rear solder tab + flat pad, bottom bracket (riser + foot)
    plate(g, [160, 88, 193, 116], 0.35, M.steel);
    plate(g, [60, 138, 120, 165], 0.35, M.steel);
    const fz = Z(140), bz = Z(122);
    slopedStrip(g, X(90), mm(44), 0.35, fz, 0.35, bz, 3.0, M.steel);
  }

  // Rectangular bare metal pad beside J100 (flat, tinned look)
  {
    const g = newGroup('metal-pad-J100', { label: 'Exposed metal pad', kind: 'other', status: 'photo-derived',
      desc: 'Appears to be a large exposed tinned pad next to the power jack. Footprint from the photo; its 0.15 mm relief is assumed.' });
    plate(g, [228, 17, 281, 73], 0.15, M.tin);
  }

  // =====================================================================================================
  // Small SMD parts right of J100, DPAK-style regulator, extra pair of pads, SMA-style diode, 0805 near J101
  // =====================================================================================================
  {
    const g = newGroup('smd-row-above-dpak', { label: 'Three small SMD chips', kind: 'passive', status: 'photo-derived',
      desc: 'Four small chip-size components above the DPAK package (the middle position holds two). Footprints from the photo; 0.6 mm height assumed.' });
    chip(g, [228, 94, 239, 111], 0.6, 'y', M.ceramic);
    chip(g, [247, 92, 261, 101], 0.6, 'x', M.chipBody);
    chip(g, [247, 102, 261, 113], 0.6, 'x', M.chipBody);
    chip(g, [270, 93, 281, 110], 0.6, 'y', M.ceramic);
  }
  {
    const g = newGroup('dpak', { label: 'DPAK-style power package', kind: 'ic', status: 'photo-verified',
      desc: 'Appears to be a DPAK (TO-252 style) SMD package with a metal tab and three leads; the marking legible in the photo reads 4284V50 / GAA230. What it does on UniJack is not claimed. 2.3 mm height assumed.' });
    B(g, [225, 137, 284, 187], 2.3, { y0: 0.25, top: photo, side: M.icBlack, radius: 0.12 });
    B(g, [228, 128, 280, 137], 0.5, { y0: 1.05, top: photo, side: M.tin });               // exposed tab
    // two outer leads: sloped shoulder out of the body + foot on the pads
    for (const [x0, x1] of [[228, 238], [270, 280]]) {
      const cx = X((x0 + x1) / 2), w = mm(x1 - x0);
      slopedStrip(g, cx, w, 0.28, Z(188), 1.0, Z(197), 0.22, M.tin);
      B(g, [x0, 197, x1, 222], 0.26, { top: photo, side: M.tin });
    }
    B(g, [249, 187, 257, 193], 0.3, { y0: 0.3, top: photo, side: M.tin });               // short middle stub
  }
  {
    const g = newGroup('pad-pair-right-of-dpak', { label: 'Two small solder pads', kind: 'other', status: 'photo-derived',
      desc: 'Two small tinned pads next to the DPAK package. Footprints from the photo; relief assumed.' });
    plate(g, [293, 160, 305, 170], 0.15); plate(g, [293, 172, 305, 182], 0.15);
  }
  {
    const g = newGroup('sma-diode', { label: 'SMA-style SMD diode', kind: 'passive', status: 'photo-derived',
      desc: 'Appears to be an SMA-sized two-terminal SMD component (black body, tinned ends). Footprint from the photo; 2.2 mm height assumed.' });
    B(g, [118, 176, 159, 199], 2.2, { y0: 0.3, top: photo, side: M.icBlack });
    B(g, [112, 181, 122, 201], 1.0, { top: photo, side: M.tin });
    B(g, [158, 180, 174, 200], 1.0, { top: photo, side: M.tin });
  }
  {
    const g = newGroup('chip-0805-J101', { label: 'Small SMD chip near J101', kind: 'passive', status: 'photo-derived', desc: 'Small chip-size SMD component. Footprint from the photo; 0.7 mm height assumed.' });
    chip(g, [124, 257, 141, 273], 0.7, 'x', M.ceramic);
  }
  {
    const g = newGroup('pads-hollow-square', { label: 'Two SMD solder pads', kind: 'other', status: 'photo-derived',
      desc: 'Two bare tinned SMD pads inside the hollow-square silkscreen outline. Footprints from the photo; relief assumed.' });
    plate(g, [165, 280, 204, 297], 0.12); plate(g, [245, 280, 286, 297], 0.12);
  }

  // =====================================================================================================
  // J101  two-position green screw terminal (two screw heads)
  // =====================================================================================================
  {
    const g = newGroup('J101-terminal', { ref: 'J101', label: 'Two-position screw terminal', kind: 'connector', status: 'photo-derived',
      desc: 'Appears to be a two-position green screw terminal block (two screws, about 2.5 mm pitch in the photo scale). Footprint from the photo; 8.2 mm height and the wire-entry side (towards the board edge, from the 3/4 photo) are assumed.' });
    const H = 8.2;
    B(g, [27, 197, 76, 272], H, { top: photo, side: M.green, radius: 0.25 });
    B(g, [76, 197, 92, 272], 6.2, { top: photo, side: M.green, radius: 0.25 });                 // lower rear step (photo shows a sloped rear face)
    const screws = [[52.9, 211.1, 0.12], [52.9, 231.8, -0.05]];
    for (const [sx, sy, rot] of screws) {
      prim.cylPart(g, { frame: F, r: mm(9.6), h: 0.5, pos: [X(sx), H - 0.25, Z(sy)], top: photo, side: M.steel, segments: 28 });
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, mm(17)), M.housingDark);
      slot.position.set(X(sx), H + 0.27, Z(sy)); slot.rotation.y = rot; g.add(slot);
      // wire entry on the -x face (dark square opening)
      const ent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 2.1), M.housingDark);
      ent.position.set(X(27) - 0.02, 3.3, Z(sy)); g.add(ent);
    }
  }

  // =====================================================================================================
  // J400  SO-DIMM-style socket, two latches, contact tails
  // =====================================================================================================
  const SEAT_Y = 2.8, MOD_T = 1.2;                           // module underside above the board top; module thickness (assumed)
  const HOUSING_H = 5.2;                                     // typical standard-height SO-DIMM socket (assumed)
  const SLOT_LO = SEAT_Y - 0.15, SLOT_HI = SEAT_Y + MOD_T + 0.15;
  const FACE = 392, BACK = 371;                              // px: housing +x face (slot mouth) and slot back wall
  const YTOP = 22, YBOT = 647;
  const socketZ = -2.2;                                      // module centre z seated (hook pins' midpoint; assumed symmetric)
  const socketX = X(FACE) - 0.2;                             // fingers edge: just at the slot mouth (gold fingers visible in gallery-2)

  {
    const g = newGroup('J400-socket', { ref: 'J400', label: 'SO-DIMM-style module socket', kind: 'connector', status: 'photo-derived',
      desc: 'Long grey socket for the Mercury module (TE logo and a moulded part number are legible on the housing in the photo). Footprint, contact-row pitch and count are read from the photo; housing height (5.2 mm), slot height and the module seating height are assumed typical values.' });
    const seg = (y0, y1, xl) => {
      B(g, [xl, y0, BACK, y1], HOUSING_H, { top: photo, side: M.housing });
      B(g, [BACK, y0, FACE, y1], SLOT_LO, { top: null, side: M.housing });                     // lower plate
      B(g, [BACK, y0, FACE, y1], HOUSING_H - SLOT_HI, { y0: SLOT_HI, top: photo, side: M.housing });   // top lip over the slot
    };
    seg(YTOP, 52, 328); seg(52, 613, 341); seg(613, YBOT, 328);
    B(g, [BACK - 2, 52, BACK + 1, 613], SLOT_HI - SLOT_LO, { y0: SLOT_LO, side: M.housingDark });     // dark slot back wall
    B(g, [328, 52, 341, 80], 2.0, { top: photo, side: M.housingDark });                               // dark side post (top-left)
    B(g, [329, 369, 340, 385], 1.1, { top: photo, side: M.housingDark });                              // keying block (left)

    // contact tails: photo shows a left row and two staggered rows on the mouth side (pitch ~4.03-4.2 px, >=129 per row)
    const tails = { left: [], rowA: [], rowB: [] }, slotA = [], slotB = [];
    const rowY = (n, y0, y1) => Array.from({ length: n }, (_, k) => y0 + (k * (y1 - y0)) / (n - 1));
    for (const y of [...rowY(73, 77.5, 367), ...rowY(56, 387.5, 611)]) {
      tails.left.push({ p: [X(335), 0.06, Z(y)], s: [mm(12), 0.12, 0.27] });
      tails.left.push({ p: [X(340.2), 0.3, Z(y)], s: [0.2, 0.55, 0.27] });
    }
    for (const y of rowY(131, 58, 607)) { tails.rowA.push({ p: [X(402), 0.06, Z(y)], s: [mm(18), 0.12, 0.27] }); slotA.push({ p: [X(381), SLOT_LO + 0.06, Z(y)], s: [mm(18), 0.1, 0.26] }); }
    for (const y of rowY(128, 83, 613)) { tails.rowB.push({ p: [X(415.5), 0.06, Z(y)], s: [mm(10.5), 0.12, 0.27] }); slotB.push({ p: [X(381), SLOT_HI - 0.07, Z(y)], s: [mm(18), 0.1, 0.26] }); }
    prim.instanced(g, prim.UNIT_BOX, M.tin, tails.left, 'J400-tails-left');
    prim.instanced(g, prim.UNIT_BOX, M.darkContact, tails.rowA, 'J400-tails-mouth-A');
    prim.instanced(g, prim.UNIT_BOX, M.tin, tails.rowB, 'J400-tails-mouth-B');
    prim.instanced(g, prim.UNIT_BOX, M.gold, slotA, 'J400-slot-contacts-lower');
    prim.instanced(g, prim.UNIT_BOX, M.gold, slotB, 'J400-slot-contacts-upper');
  }

  // latch clips: built in board-local coordinates (so the photo UVs are right), then re-origined at the pivot
  const latches = [];
  const makeLatch = (name, desc, pivotPx, build, axis, openAngle) => {
    const obj = new THREE.Group(); obj.name = name;
    build(obj);
    const px = X(pivotPx[0]), pz = Z(pivotPx[1]);
    obj.children.forEach((c) => { c.position.x -= px; c.position.z -= pz; });
    obj.position.set(px, 0, pz);
    group.add(obj);
    meta(obj, { label: name.includes('top') ? 'J400 latch clip (top end)' : 'J400 latch clip (bottom end)', kind: 'latch', status: 'assumed', desc });
    obj.userData.openAngle = openAngle;
    latches.push({ obj, axis, openAngle });
    return obj;
  };
  const ARM_Y0 = SLOT_HI + 0.25, ARM_T = 0.55;              // arm plate sits above the seated module top (assumed)
  const HOOK_Y0 = SLOT_HI, HOOK_H = 1.2;
  const OPEN = THREE.MathUtils.degToRad(5);
  const hookPin = (parent, cxPx, zPx0, zPx1) => {
    const len = mm(zPx1 - zPx0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, len, 20), M.steel);
    m.rotation.x = Math.PI / 2; m.position.set(X(cxPx), ARM_Y0 + 0.55, Z((zPx0 + zPx1) / 2));
    m.castShadow = true; parent.add(m);
  };
  const latchDesc = 'Spring clip at one end of the socket. From the photos it appears to hold the module down with a hook pin engaging a notch at the module end. Pivot location, the 5 degree opening angle and the plating colour are assumed (kinematics are not visible in the photos).';
  makeLatch('J400-latch-top', latchDesc, [FACE, 35], (o) => {
    B(o, [FACE, 24, 562, 46], ARM_T, { y0: ARM_Y0, top: photo, side: M.latch });
    B(o, [FACE, 46, 421, 52], ARM_T, { y0: ARM_Y0, top: photo, side: M.latch });
    B(o, [470, 49, 502, 55], 0.45, { y0: ARM_Y0, top: photo, side: M.steel });
    B(o, [FACE, 22.4, 562, 24.2], 1.65, { y0: ARM_Y0 + ARM_T - 1.65, side: M.latch });          // outer web: gives the clip its L profile
    B(o, [548, 26, 566, 46], HOOK_H, { y0: HOOK_Y0, top: photo, side: M.latch });
    hookPin(o, 569, 28, 47);
  }, [0, 1, 0], OPEN);
  makeLatch('J400-latch-bottom', latchDesc, [FACE, 625], (o) => {
    B(o, [FACE, 617, 562, 633], ARM_T, { y0: ARM_Y0, top: photo, side: M.latch });
    B(o, [FACE, 633, 433, 647], ARM_T, { y0: ARM_Y0, top: photo, side: M.latch });
    B(o, [435, 633, 505, 646], 0.45, { y0: ARM_Y0, top: photo, side: M.steel });
    B(o, [517, 633, 535, 643], 0.45, { y0: ARM_Y0, top: photo, side: M.steel });
    B(o, [FACE, 646, 535, 647.8], 1.65, { y0: ARM_Y0 + ARM_T - 1.65, side: M.latch });          // outer web
    B(o, [548, 609, 566, 629], HOOK_H, { y0: HOOK_Y0, top: photo, side: M.latch });
    hookPin(o, 569, 615, 628);
  }, [0, -1, 0], OPEN);
  {
    const g = newGroup('J400-solder-tab', { label: 'Latch solder tab', kind: 'other', status: 'photo-derived',
      desc: 'Small tinned SMD tab below the bottom latch clip. Footprint from the photo; relief assumed.' });
    plate(g, [433, 648, 465, 665], 0.25, M.steel);
  }
  {
    const g = newGroup('J400-latch-ghost-cover', { label: 'Board texture patch (not a part)', kind: 'board', status: 'assumed',
      desc: 'Flat decal that re-uses a plain region of the board photo so the closed latch arms baked into the photo do not remain as ghosts when the model opens the latches. Not a physical part.' });
    cleanPatch(g, [424, 28, 566, 58], [424, 62, 566, 82]);
    cleanPatch(g, [424, 608, 566, 647], [424, 470, 566, 505]);
  }

  // =====================================================================================================
  // TSSOP-48 level shifters x3 (marking LVC16T245 legible in the photo)
  // =====================================================================================================
  {
    const bodies = [[467, 84, 521, 186], [467, 191, 521, 294], [467, 303, 521, 404]];
    bodies.forEach((b, i) => {
      const g = newGroup(`TSSOP48-${i + 1}`, { label: `TSSOP-48 IC ${i + 1} of 3`, kind: 'ic', status: 'photo-verified',
        desc: 'TSSOP-48 package (24 gull-wing leads per side counted in the photo). The marking legible in the photo includes LVC16T245; what the chip does on UniJack is not claimed. Body height 1.1 mm is assumed. It sits under the Mercury module when the kit is assembled.' });
      const o = F.box(b);
      B(g, b, 1.05, { y0: 0.12, top: photo, side: M.icBlack, radius: 0.12 });
      prim.gullLeads(g, M.tin, { cx: o.cx, cz: o.cz, bodyW: o.w, bodyD: o.d, sides: 'x', n: 24, pitch: mm(4.03), leadLen: 1.5, leadW: 0.26, leadT: 0.14, yMid: 0.5, name: `TSSOP48-${i + 1}-leads` });
    });
  }

  // =====================================================================================================
  // J304 USB-A (single, horizontal) - hollow steel shell, cream tongue, gold contacts
  // =====================================================================================================
  {
    const g = newGroup('J304-usb', { ref: 'J304', label: 'USB-A receptacle', kind: 'connector', status: 'photo-derived',
      desc: 'Appears to be a single horizontal USB-A receptacle (one opening, steel shell). Footprint from the photo; 6.3 mm height, the open front towards the board edge and the cream tongue are assumed from the 3/4 photo.' });
    const b = [5, 343, 171, 452], H = 6.3, T = 0.35;
    B(g, b, T, { y0: H - T, top: photo, side: M.shell });                                      // top plate (photo: springs, windows)
    B(g, [5, 343, 171, 343 + 4], H - T - 0.2, { y0: 0.2, side: M.shell });                     // side walls
    B(g, [5, 452 - 4, 171, 452], H - T - 0.2, { y0: 0.2, side: M.shell });
    B(g, [167, 343, 171, 452], H - T - 0.2, { y0: 0.2, side: M.shell });                       // rear wall
    B(g, [5, 343, 171, 452], 0.3, { y0: 0.2, side: M.rj45Carrier });                            // bottom plate
    // tongue (cream plastic) with four gold contacts
    B(g, [14, 350, 120, 445], 1.6, { y0: 1.6, side: M.cream });
    const o = F.box([14, 350, 120, 445]);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(o.w * 0.82, 0.08, 0.6), M.gold);
      m.position.set(o.cx + o.w * 0.04, 3.24, o.cz + (k - 1.5) * 2.3); g.add(m);
    }
  }

  // =====================================================================================================
  // J303 RJ45 (hollow steel shell, open front, dark contact carrier, 8 gold contacts, two lamps, rear tails)
  // =====================================================================================================
  {
    const g = newGroup('J303-rj45', { ref: 'J303', label: 'RJ45 jack', kind: 'connector', status: 'photo-derived',
      desc: 'Appears to be a shielded RJ45 jack: steel shell, open front towards the board edge, eight gold contacts and two green lamps visible in the 3/4 photo, and rear SMD tails. Footprint from the photo; 13 mm height is assumed.' });
    const b = [13, 518, 165, 680], H = 13.0, T = 0.4;
    B(g, b, T, { y0: H - T, top: photo, side: M.shell });                                      // top plate
    B(g, [13, 518, 165, 522], H - T - 0.2, { y0: 0.2, side: M.shell });
    B(g, [13, 676, 165, 680], H - T - 0.2, { y0: 0.2, side: M.shell });
    B(g, [161, 518, 165, 680], H - T - 0.2, { y0: 0.2, side: M.shell });
    B(g, [13, 518, 165, 680], 0.3, { y0: 0.2, side: M.rj45Carrier });
    // front frame (keeps the opening ~13.7 mm wide x 8 mm tall)
    const oz0 = 540, oz1 = 658, oy0 = 2.4, oy1 = 10.4;
    B(g, [13, 518, 22, oz0], H - 0.6, { y0: 0.2, side: M.shell });
    B(g, [13, oz1, 22, 680], H - 0.6, { y0: 0.2, side: M.shell });
    B(g, [13, oz0, 22, oz1], oy0 - 0.2, { y0: 0.2, side: M.shell });
    B(g, [13, oz0, 22, oz1], H - T - oy1, { y0: oy1, side: M.shell });
    // dark plastic liners inside the cavity (walls + ceiling) so the opening reads as a plastic-lined port
    B(g, [22, 522, 108, 526], H - T - 0.5, { y0: 0.5, side: M.rj45Carrier });
    B(g, [22, 672, 108, 676], H - T - 0.5, { y0: 0.5, side: M.rj45Carrier });
    B(g, [22, 522, 108, 676], 0.3, { y0: H - T - 0.3, side: M.rj45Carrier });
    // dark plastic contact carrier at the back of the cavity + 8 gold contacts
    B(g, [108, oz0, 161, oz1], 8.4, { y0: 0.5, side: M.rj45Carrier });
    const oc = F.box([22, oz0, 108, oz1]);
    const items = [];
    for (let k = 0; k < 8; k++) items.push({ p: [oc.cx + oc.w * 0.08, 7.6, oc.cz + (k - 3.5) * 1.19], s: [oc.w * 0.84, 0.12, 0.3] });
    prim.instanced(g, prim.UNIT_BOX, M.gold, items, 'J303-contacts');
    // two lamps at the front corners
    for (const zc of [529, 669]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, mm(10)), M.lampGreen);
      m.position.set(X(13) - 0.03, 11.6, Z(zc)); g.add(m);
    }
    // rear SMD tails (12 leads read from the photo)
    const ys = [554, 565.6, 584.4, 592.9, 601.3, 609.8, 618.2, 626.7, 635, 642, 659, 669.3];
    const tl = [];
    for (const y of ys) { tl.push({ p: [X(179), 0.08, Z(y)], s: [mm(27), 0.16, mm(6)] }); tl.push({ p: [X(164), 0.6, Z(y)], s: [mm(3), 1.2, mm(6)] }); }
    prim.instanced(g, prim.UNIT_BOX, M.tin, tl, 'J303-tails');
    plate(g, [47, 678, 95, 693], 0.25, M.steel);                                                // shield tab on the board (photo: tarnished tab)
  }
  {
    const g = newGroup('rj45-neighbour-ICs', { label: 'Two small 8-lead ICs near J303', kind: 'ic', status: 'photo-derived',
      desc: 'Two very small 8-lead SMD packages beside the RJ45 rear tails (four tiny leads per side). Footprints from the photo; 0.9 mm height assumed; markings are not legible.' });
    for (const b of [[207, 587, 218, 603], [207, 621, 218, 637]]) {
      const o = F.box(b);
      B(g, b, 0.9, { y0: 0.1, top: photo, side: M.icBlack });
      prim.gullLeads(g, M.tin, { cx: o.cx, cz: o.cz, bodyW: o.w, bodyD: o.d, sides: 'x', n: 4, pitch: mm(4.8), leadLen: 0.3, leadW: 0.24, leadT: 0.1, yMid: 0.35, name: 'small-IC-leads' });
    }
  }

  // =====================================================================================================
  // LED row (8 tiny SMD LEDs) - instanced bodies + pads
  // =====================================================================================================
  {
    const g = newGroup('LED-row', { label: 'Row of eight SMD LEDs', kind: 'led', status: 'photo-derived',
      desc: 'Eight tiny chip LEDs along the bottom edge (cream bodies, tinned pads). Positions read from the photo; 0.75 mm height assumed.' });
    const xs = [216, 259.5, 303, 346.6, 390.8, 435, 479, 522.5], cy = 681;
    const bodies = xs.map((x) => ({ p: [X(x), 0.4, Z(cy)], s: [mm(14), 0.8, mm(9)] }));
    const pads = [];
    for (const x of xs) for (const s of [-1, 1]) pads.push({ p: [X(x), 0.14, Z(cy + s * 6.5)], s: [mm(19), 0.28, mm(3.2)] });
    prim.instanced(g, prim.UNIT_BOX, M.ledBody, bodies, 'LED-bodies');
    prim.instanced(g, prim.UNIT_BOX, M.tin, pads, 'LED-pads');
  }

  // small 0805 cap at the top edge next to the latch (x 508..520, y 12..25)
  {
    const g = newGroup('chip-top-edge', { label: 'Small SMD capacitor-size chip', kind: 'passive', status: 'photo-derived', desc: 'Chip-size SMD component above the top latch arm. Footprint from the photo; 0.8 mm height assumed.' });
    chip(g, [507, 12, 521, 25], 0.8, 'x', M.ceramic);
  }

  return {
    anchors: { socket: { x: socketX, z: socketZ, seatY: SEAT_Y } },
    latches,
  };
}
