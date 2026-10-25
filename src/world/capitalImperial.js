// @ts-check
// TESA11 (bible/03-World/Arena-Provinces.md TESA11) - THE IMPERIAL CITY'S LANDMARKS: the port's own models of the city's
// canon (world/imperialCity.js IMPERIAL says where each stands) - the White-Gold Tower, 680 m to its spire, on Green
// Emperor Way among the emperors' tombs inside the palace wall; the city wall round the six districts, a tower every ten
// degrees, its four gates and (TESA-LORE) its six watch towers where the district walls meet it; the walls between the
// districts; the Arena District's Colosseum; the Temple of the One; the dragon of Talos Plaza; the Arboretum's Nine Divines
// (TESA-LORE); the Imperial Prison and its Bastion; the Arcane University and its Arch-Mage's tower; the Waterfront's quay,
// piers and light; Talos Bridge. In metres, drawn as the map reads (+z south), every model's origin the
// city's middle on its ground (world/capitalModels.js turns them northward). Shapes of the port's own on the canon - no
// game data, no other game's mesh.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, taper, ring, ledge, cap, wallRun, merlons, gatedRun, roundTower, squareTower, hall, pyramid, gableRoof, dome, blob, limb, darkDoor, entranceDoor, translated, corner, framed, robedFigure } from './capitalShapes.js';
import { IMPERIAL, IMPERIAL_SECTORS, polar, prisonAt, universityTowerAt, universityHallAt, colosseumGate, watchTowersAt, divinesAt, divinePlinths, bridgeLine, prisonGates, universityGates } from './imperialCity.js';

const MARBLE = art(CAPITAL_ART.marble), GOLD = art(CAPITAL_ART.gold), STONE = art(CAPITAL_ART.wallStone), BRIDGE = art(CAPITAL_ART.bridgeStone);
const DARK = art(CAPITAL_ART.dark), SLATE = art(CAPITAL_ART.blueSlate), ROOF = art(CAPITAL_ART.roof), TIMBER = art(CAPITAL_ART.timber);
const SAND = art(CAPITAL_ART.sandstone), OCHRE = art(CAPITAL_ART.ochre), BRONZE = art(CAPITAL_ART.bronze);
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
/** A face's unit normal from three of its corners, turned to face `hint`'s way. */
const faceNormal = (a, b, c, hint) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  return n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0 ? n.map((q) => -q) : n;
};

// ---------------------------------------------------------------- the White-Gold Tower and Green Emperor Way

/**
 * THE WHITE-GOLD TOWER: an octagonal plinth 172 m across, a tapering shaft banded in gold every `band` metres, eight
 * buttress fins at its corners from the plinth's edge to `finTop`, a gallery, the crown above it and a gilt spire to
 * 680 m; the palace's door at its foot on the east, toward the Market and the Arena.
 */
export function buildImperialTower(T = IMPERIAL.tower) {
  const mb = new MeshBuilder(), n = 8, phase = Math.PI / 8;
  const rAt = (y) => T.shaftR0 + (T.shaftR1 - T.shaftR0) * ((y - T.plinthH) / (T.shaftTop - T.plinthH));
  taper(mb, MARBLE, n, T.plinthR, -3, T.plinthR, T.plinthH, { phase, vRepeat: 8, uRepeat: 6 });
  ring(mb, MARBLE, n, T.shaftR0, T.plinthR, T.plinthH, phase);
  taper(mb, MARBLE, n, T.shaftR0, T.plinthH, T.shaftR1, T.shaftTop, { phase, vRepeat: 16, uRepeat: 4 });
  for (let y = T.band; y <= T.shaftTop - 10; y += T.band) ledge(mb, GOLD, n, rAt(y) + 0.8, rAt(y), y - 2, y, phase);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase, ux = Math.cos(a), uz = Math.sin(a), nx = -uz, nz = ux, t = T.finThick / 2;
    const inB = [ux * (rAt(T.plinthH) - 1), T.plinthH, uz * (rAt(T.plinthH) - 1)], outB = [ux * T.finR, T.plinthH, uz * T.finR];
    const inT = [ux * (rAt(T.finTop) - 1), T.finTop, uz * (rAt(T.finTop) - 1)], outT = [ux * (rAt(T.finTop) + 2.5), T.finTop, uz * (rAt(T.finTop) + 2.5)];
    const off = (p, s) => [p[0] + nx * t * s, p[1], p[2] + nz * t * s];
    for (const s of [1, -1]) mb.quad(MARBLE, off(inB, s), off(outB, s), off(outT, s), off(inT, s), [nx * s, 0, nz * s], [[0, 0], [4, 0], [4, -24], [0, -24]]);
    const e = [outT[0] - outB[0], outT[1] - outB[1], outT[2] - outB[2]];
    let outN = unit([nz * e[1], -(nz * e[0] - nx * e[2]), -nx * e[1]]);
    if (outN[0] * ux + outN[2] * uz < 0) outN = outN.map((v) => -v);
    mb.quad(MARBLE, off(outB, 1), off(outB, -1), off(outT, -1), off(outT, 1), outN, [[0, 0], [0.6, 0], [0.6, -24], [0, -24]]);
    mb.quad(GOLD, off(outT, 1), off(outT, -1), off(inT, -1), off(inT, 1), [0, 1, 0]);
  }
  ledge(mb, MARBLE, n, T.galleryR, T.shaftR1, T.shaftTop, T.galleryTop, phase);
  ledge(mb, GOLD, n, T.galleryR + 0.8, T.galleryR, T.galleryTop - 2, T.galleryTop + 0.4, phase);
  taper(mb, MARBLE, n, T.crownR0, T.galleryTop, T.crownR1, T.crownTop, { phase, vRepeat: 12 });
  ledge(mb, GOLD, n, T.crownR1 + 1.2, T.crownR1, T.crownTop - 3, T.crownTop, phase);
  taper(mb, GOLD, n, T.crownR1, T.crownTop, 0.05, T.spireTop, { phase, vRepeat: 16 });
  // the palace's door, facing east: a dark recess's face proud of the plinth by a hair, a gilt lintel over it
  const dx = T.plinthR * Math.cos(Math.PI / 8) + 0.05, w = T.door;
  mb.quad(DARK, [dx, 0, -w], [dx, 0, w], [dx, w * 2.4, w], [dx, w * 2.4, -w], [1, 0, 0]);
  mb.quad(GOLD, [dx + 0.02, w * 2.4, -w - 1], [dx + 0.02, w * 2.4, w + 1], [dx + 0.02, w * 2.4 + 1.6, w + 1], [dx + 0.02, w * 2.4 + 1.6, -w - 1], [1, 0, 0]);
  return { ...mb.build(), doors: [entranceDoor(dx - 0.05, 0, w * 2, w * 2.4, [1, 0])] };   // WW7-4: the palace's halls (world/capitalCastles.js)
}

/** A gate's half-width in degrees on a ring of radius r. */
const gateDeg = (gate, r) => (gate / 2 / r) * (180 / Math.PI);
/** A ring wall's chords from bearing b0 to b1 (decreasing, so the merlons face out), cut back where a gate stands. */
function ringRuns(r, step, gates, halfDeg) {
  const runs = [];
  for (let b = 0; b < 360 - 1e-9; b += step) {
    let s = b, e = b + step;
    let skip = false;
    for (const g0 of gates) for (const g of [g0, g0 + 360, g0 - 360]) {
      if (s >= g - halfDeg && e <= g + halfDeg) skip = true;
      else if (s < g + halfDeg && s > g - halfDeg) s = g + halfDeg;
      else if (e > g - halfDeg && e < g + halfDeg) e = g - halfDeg;
      else if (s < g - halfDeg && e > g + halfDeg) { runs.push([polar(g - halfDeg, r), polar(s, r)]); s = g + halfDeg; }
    }
    if (!skip && e > s) runs.push([polar(e, r), polar(s, r)]);
  }
  return runs;
}

/**
 * THE PALACE WALL round Green Emperor Way: a ring of `sides` runs at its radius, merlons out, a gate to each district (its
 * sector's middle) with a turret either side.
 */
export function buildPalaceWall(W = IMPERIAL.palaceWall) {
  const mb = new MeshBuilder(), gates = IMPERIAL_SECTORS.map(([, b]) => b + 30), half = gateDeg(W.gate + 0.5, W.r);
  for (const [p, q] of ringRuns(W.r, 360 / W.sides, gates, half)) { wallRun(mb, STONE, p, q, W.thick, W.h); merlons(mb, STONE, p, q, W.thick, W.h); }
  for (const g of gates) for (const side of [1, -1]) { const [x, z] = polar(g + side * (half + gateDeg(W.towerR * 2 + 1, W.r)), W.r); roundTower(mb, x, z, W.towerR, W.towerH, { sides: 12 }); }
  return mb.build();
}

/** THE EMPERORS' TOMBS on Green Emperor Way's lawns: a ring of marble mausolea, each its stepped pyramid and its gilt cap,
 *  its door toward the tower. */
export function buildEmperorsTombs(T = IMPERIAL.tombs) {
  const mb = new MeshBuilder();
  for (let i = 0; i < T.n; i++) {
    const b = 22.5 + i * (360 / T.n), [x, z] = polar(b, T.r);
    hall(mb, MARBLE, x, z, T.w + 2, T.w + 2, -1, 0.6, 0.25);
    hall(mb, MARBLE, x, z, T.w, T.w, 0.6, T.h, 0.25);
    pyramid(mb, MARBLE, x, z, T.w + 1, T.w + 1, T.h, T.w * 0.55);
    mb.box(GOLD, [x, T.h + T.w * 0.55 + 0.6, z], [1.2, 1.2, 1.2], 0.5);
    // the door, on the face toward the tower
    const [ux, uz] = unit([-x, -z]), axis = Math.abs(ux) > Math.abs(uz) ? [Math.sign(ux), 0] : [0, Math.sign(uz)];
    darkDoor(mb, DARK, x + axis[0] * (T.w / 2), z + axis[1] * (T.w / 2), 2.6, 5, axis);
  }
  return mb.build();
}

// ---------------------------------------------------------------- the walls

/**
 * TESA-LORE: A WATCH TOWER of the city wall at (x, z) - a great drum of stone (`watchR`, to `watchH`) over the wall's walk, a
 * corbelled parapet of merlons round its top, a turret on it under a slate cone.
 */
export function watchTower(mb, x, z, W = IMPERIAL.cityWall) {
  const r = W.watchR, h = W.watchH;
  translated(mb, x, 0, z, () => {
    taper(mb, STONE, 20, r + 1.5, -3, r, 6, { vRepeat: 6, uRepeat: 4 });   // its batter
    taper(mb, STONE, 20, r, 6, r, h, { vRepeat: 6, uRepeat: 4 });
    ledge(mb, STONE, 20, r + 1.4, r - 0.5, h, h + 2);
    for (let i = 0; i < 20; i++) { const [mx, , mz] = corner(20, i + 0.5, r + 0.8, 0); mb.box(STONE, [mx, h + 2.9, mz], [1.6, 1.8, 1.6], 0.4); }
    taper(mb, STONE, 16, r * 0.55, h + 2, r * 0.55, h + 12, { vRepeat: 6, uRepeat: 2 });
    taper(mb, SLATE, 16, r * 0.55 + 1, h + 12, 0.05, h + 12 + r * 0.9, { vRepeat: 4, uRepeat: 2 });
  });
}

/**
 * THE CITY WALL round the six districts: its chords between towers every `towerEvery` degrees, merlons out; a gate at
 * each of its bearings - to the Prison, the University, the Waterfront and Talos Bridge - between two towers, a lintel over
 * it; TESA-LORE: a watch tower where each district wall meets it, in the ten-degree tower's stead (the North, North-East,
 * South-East, South, South-West and North-West Watch Towers).
 */
export function buildCityWall(W = IMPERIAL.cityWall) {
  const mb = new MeshBuilder(), half = gateDeg(W.gate, W.r), watch = new Set(IMPERIAL_SECTORS.map(([, b]) => b));
  for (const [p, q] of ringRuns(W.r, W.towerEvery, W.gates, half)) { wallRun(mb, STONE, p, q, W.thick, W.h); merlons(mb, STONE, p, q, W.thick, W.h); }
  for (let b = 0; b < 360; b += W.towerEvery) if (!watch.has(b) && W.gates.every((g) => Math.abs(((b - g + 540) % 360) - 180) > half + gateDeg(W.towerR * 2 + 4, W.r))) { const [x, z] = polar(b, W.r); roundTower(mb, x, z, W.towerR, W.towerH); }
  for (const [x, z] of watchTowersAt()) watchTower(mb, x, z, W);
  for (const g of W.gates) {
    const a = polar(g + half, W.r), c = polar(g - half, W.r);
    translated(mb, 0, W.gateH, 0, () => wallRun(mb, STONE, a, c, W.thick, W.h - W.gateH, 0));
    for (const side of [1, -1]) { const [x, z] = polar(g + side * (half + gateDeg(W.towerR + 1, W.r)), W.r); roundTower(mb, x, z, W.towerR, W.towerH + 6); }
  }
  return mb.build();
}

/** THE WALLS BETWEEN THE DISTRICTS: at each sector's edge from the palace wall to the city wall, a gate at the middle. */
export function buildDistrictWalls(I = IMPERIAL) {
  const mb = new MeshBuilder(), D = I.districtWall;
  for (const [, b] of IMPERIAL_SECTORS) {
    const p = polar(b, I.palaceWall.r + I.palaceWall.thick / 2 + 0.5), q = polar(b, I.cityWall.r - I.cityWall.thick / 2 - 0.5);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    gatedRun(mb, STONE, p, q, D.thick, D.h, len / 2, D.gate, D.gateH);
  }
  return mb.build();
}

// ---------------------------------------------------------------- the districts' landmarks

/**
 * THE COLOSSEUM of the Arena District: an elliptical drum of three tiers of arches, its stands sloping down inside to the
 * sand of its floor behind the floor's wall; a way in on each axis through the stands.
 */
export function buildColosseum(C = IMPERIAL.colosseum) {
  const mb = new MeshBuilder(), [cx, cz] = polar(C.b, C.r), n = 64, tierH = C.h / C.tiers;
  const P = (a, sx, sz, y) => [cx + Math.cos(a) * C.rx * sx, y, cz + Math.sin(a) * C.rz * sz];
  const F = (a, y) => [cx + Math.cos(a) * C.floor[0], y, cz + Math.sin(a) * C.floor[1]];
  const inner = 0.82, gateAt = (a) => { const m = P(a, 0.9, 0.9, 0); return colosseumGate(m[0] - cx, m[2] - cz, C); };
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2, gate = gateAt(am);
    const nOut = unit([Math.cos(am) / C.rx, 0, Math.sin(am) / C.rz]);
    for (let t = 0; t < C.tiers; t++) {
      const y0 = t * tierH, y1 = y0 + tierH;
      if (t === 0 && gate) { mb.quad(SAND, P(a0, 1, 1, y0 + tierH * 0.8), P(a1, 1, 1, y0 + tierH * 0.8), P(a1, 1, 1, y1), P(a0, 1, 1, y1), nOut); continue; }
      mb.quad(SAND, P(a0, 1, 1, t === 0 ? -3 : y0), P(a1, 1, 1, t === 0 ? -3 : y0), P(a1, 1, 1, y1), P(a0, 1, 1, y1), nOut, [[0, 0], [1, 0], [1, -tierH / 6], [0, -tierH / 6]]);
      // the tier's arch, a dark face a hair proud
      const m0 = (a0 * 0.78 + a1 * 0.22), m1 = (a0 * 0.22 + a1 * 0.78), e = 1.004;
      mb.quad(DARK, P(m0, e, e, y0 + 0.6), P(m1, e, e, y0 + 0.6), P(m1, e, e, y0 + tierH * 0.72), P(m0, e, e, y0 + tierH * 0.72), nOut);
    }
    mb.quad(SAND, P(a0, 1, 1, C.h), P(a1, 1, 1, C.h), P(a1, inner, inner, C.h), P(a0, inner, inner, C.h), [0, 1, 0]);
    if (gate) continue;
    // the stands: from the top's inner edge down to the floor's wall, facing up and in
    const top0 = P(a0, inner, inner, C.h), top1 = P(a1, inner, inner, C.h), low0 = F(a0, 4), low1 = F(a1, 4);
    const run = Math.hypot(top0[0] - low0[0], top0[2] - low0[2]);
    mb.quad(SAND, low0, low1, top1, top0, faceNormal(low0, low1, top1, [-Math.cos(am), 1, -Math.sin(am)]), [[0, 0], [1, 0], [1, -run / 4], [0, -run / 4]]);
    // the floor's wall, facing in
    mb.quad(STONE, F(a0, 0), F(a1, 0), F(a1, 4), F(a0, 4), unit([-Math.cos(am) / C.floor[0], 0, -Math.sin(am) / C.floor[1]]));
  }
  // the sand
  for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; mb.tri(OCHRE, [cx, 0.05, cz], F(a0, 0.05), F(a1, 0.05), [0, 1, 0]); }
  return mb.build();
}

/**
 * THE TEMPLE OF THE ONE in the Temple District: its nave north to south, a gabled roof of slate, the drum and the gilt dome
 * at its crossing, its two towers and their spires either side of its doors on the north front.
 */
export function buildTempleOfTheOne(T = IMPERIAL.temple) {
  const mb = new MeshBuilder(), [x, z] = polar(T.b, T.r);
  hall(mb, MARBLE, x, z, T.w + 4, T.l + 4, -1, 1, 0.25);
  hall(mb, MARBLE, x, z, T.w, T.l, 1, T.h, 0.25);
  gableRoof(mb, SLATE, MARBLE, x, z, T.l, T.w, T.h, T.w * 0.36, { alongX: false });
  translated(mb, x, 0, z, () => {
    taper(mb, MARBLE, 16, T.domeR, T.h, T.domeR, T.h + 12, { vRepeat: 6 });
    ledge(mb, GOLD, 16, T.domeR + 0.6, T.domeR, T.h + 11, T.h + 12.6);
  });
  dome(mb, GOLD, x, T.h + 12.6, z, T.domeR, T.domeR * 0.9, { n: 16, rings: 6 });
  mb.box(GOLD, [x, T.h + 12.6 + T.domeR * 0.9 + 2, z], [1.4, 4, 1.4], 0.5);
  const front = z - T.l / 2;
  for (const side of [1, -1]) {
    const tx = x + side * (T.w / 2 - T.towerS / 2), tz = front + T.towerS / 2;
    squareTower(mb, tx, tz, T.towerS, T.towerH, { roofH: 0, wall: MARBLE });
    pyramid(mb, SLATE, tx, tz, T.towerS + 0.6, T.towerS + 0.6, T.towerH + 1.4, T.towerS * 1.8);
  }
  for (const dx of [-9, 0, 9]) darkDoor(mb, DARK, x + dx, front, dx ? 4 : 6, dx ? 8 : 12, [0, -1]);
  return mb.build();
}

/**
 * TALOS PLAZA'S DRAGON: a bronze dragon on a stepped marble plinth at the plaza's middle, its head toward the tower - its
 * body, its neck and head raised, its tail curled down the plinth, its four legs and its two wings spread.
 */
export function buildTalosStatue(S = IMPERIAL.statue) {
  const mb = new MeshBuilder(), [x, z] = polar(S.b, S.r), p = S.plinth;
  hall(mb, MARBLE, x, z, p + 6, p + 6, -1, 1.2, 0.25);
  hall(mb, MARBLE, x, z, p + 2, p + 2, 1.2, 2.4, 0.25);
  hall(mb, MARBLE, x, z, p, p, 2.4, 8, 0.25);
  const y = 8, f = 1;   // the dragon faces east (+x), toward the tower
  blob(mb, BRONZE, x, y + 4.5, z, 5.2, 2.6, 2.6, { n: 12, rings: 7, rough: 0.05, seed: 0x7a1 });
  limb(mb, BRONZE, [x + 4 * f, y + 5.5, z], [x + 7 * f, y + 11, z], 1.7, 1.1, { n: 10 });
  blob(mb, BRONZE, x + 8.4 * f, y + 12, z, 2.2, 1.3, 1.2, { n: 10, rings: 5, rough: 0.06, seed: 0x7a2 });
  for (const side of [1, -1]) limb(mb, BRONZE, [x + 9 * f, y + 13, z + side * 0.6], [x + 7.4 * f, y + 15.5, z + side * 1.2], 0.35, 0.05, { n: 6 });   // its horns
  limb(mb, BRONZE, [x - 4.5 * f, y + 4, z], [x - 8 * f, y + 1.5, z + 3], 1.4, 0.8, { n: 8 });
  limb(mb, BRONZE, [x - 8 * f, y + 1.5, z + 3], [x - 6.5 * f, y - 4, z + 5.5], 0.8, 0.25, { n: 8 });   // the tail down the plinth's face
  for (const [lx, lz] of [[3, 2], [3, -2], [-3, 2], [-3, -2]]) limb(mb, BRONZE, [x + lx * f, y + 3.5, z + lz * 0.8], [x + lx * f * 1.1, y, z + lz * 1.2], 0.9, 0.6, { n: 8 });
  for (const side of [1, -1]) {   // the wings: two fans of three panes each, up and out from its shoulders
    const root = [x + 1.5 * f, y + 6.5, z + side * 1.8];
    const tips = [[x + 3 * f, y + 15, z + side * 9], [x - 2 * f, y + 13, z + side * 11], [x - 6 * f, y + 9, z + side * 9.5], [x - 4 * f, y + 6.5, z + side * 4]];
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i], b = tips[i + 1], u = a.map((v, k) => v - root[k]), v = b.map((w, k) => w - root[k]);
      const nrm = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
      mb.tri(BRONZE, root, a, b, nrm); mb.tri(BRONZE, root, a, b, nrm.map((q) => -q));
    }
  }
  return mb.build();
}

/**
 * TESA-LORE: THE ARBORETUM'S NINE DIVINES - the city's park, the statues of the Nine (UESP's Arboretum: "statues of the Nine
 * Divines including a statue of Talos in the center"): eight robed figures of marble on their plinths in a ring, each
 * facing the middle, where Talos stands armoured on a stepped plinth, his gilt sword raised, facing the White-Gold Tower;
 * a low kerb round the court.
 */
export function buildNineDivines(I = IMPERIAL) {
  const mb = new MeshBuilder(), D = I.divines, [cx, cz] = divinesAt(I);
  divinePlinths(I).forEach(([x, z], i) => {
    hall(mb, MARBLE, x, z, D.plinth + 1, D.plinth + 1, -1, 0.5, 0.25);
    hall(mb, MARBLE, x, z, D.plinth, D.plinth, 0.5, D.plinthH, 0.25);
    const face = unit([cx - x, 0, cz - z]);
    robedFigure(mb, MARBLE, x, z, D.plinthH, D.figure, [face[0], face[2]], i % 4);
  });
  // Talos at the middle, facing the tower: his stepped plinth, his legs, his armoured body, his head, his shield and sword
  const tp = D.talosPlinth, ty = D.talosPlinthH, k = D.talos / 11, face = unit([-cx, -cz]), P = framed(cx, cz, face);
  hall(mb, MARBLE, cx, cz, tp + 3, tp + 3, -1, ty * 0.35, 0.25);
  hall(mb, MARBLE, cx, cz, tp, tp, ty * 0.35, ty, 0.25);
  for (const side of [1, -1]) limb(mb, MARBLE, P(0, side * 0.75 * k, ty), P(0.2 * k, side * 0.7 * k, ty + 5 * k), 0.55 * k, 0.65 * k, { n: 8 });
  translated(mb, cx, ty + 5 * k, cz, () => { taper(mb, MARBLE, 10, 1.3 * k, 0, 1.6 * k, 3.4 * k, { vRepeat: 2 }); taper(mb, MARBLE, 10, 1.6 * k, 3.4 * k, 0.5 * k, 4 * k, { vRepeat: 1 }); });
  for (const side of [1, -1]) blob(mb, MARBLE, ...P(0, side * 1.7 * k, ty + 8.2 * k), 0.8 * k, 0.6 * k, 0.8 * k, { n: 8, rings: 4, rough: 0, seed: 0xd9 });   // his pauldrons
  blob(mb, MARBLE, cx, ty + 9.7 * k, cz, 0.7 * k, 0.85 * k, 0.7 * k, { n: 8, rings: 5, rough: 0, seed: 0xda });
  const swordHand = P(0.5 * k, 1.9 * k, ty + 11.2 * k);
  limb(mb, MARBLE, P(0, 1.75 * k, ty + 8.2 * k), swordHand, 0.42 * k, 0.32 * k, { n: 6 });
  limb(mb, GOLD, swordHand, P(0.9 * k, 2.2 * k, ty + 16.5 * k), 0.22 * k, 0.04 * k, { n: 4 });   // the blade, up
  limb(mb, GOLD, P(0.5 * k, 1.3 * k, ty + 11.2 * k), P(0.5 * k, 2.5 * k, ty + 11.2 * k), 0.12 * k, 0.12 * k, { n: 4 });   // its guard
  limb(mb, MARBLE, P(0, -1.75 * k, ty + 8.2 * k), P(1.1 * k, -1.4 * k, ty + 6.4 * k), 0.42 * k, 0.32 * k, { n: 6 });
  const sc = P(1.4 * k, -1.3 * k, ty + 6.4 * k);
  translated(mb, sc[0], sc[1] - 1.6 * k, sc[2], () => taper(mb, BRONZE, 10, 1.25 * k, 0, 1.25 * k, 3.2 * k, { vRepeat: 1 }));   // his shield
  // the court's kerb, open toward the palace gate
  const n = 48, gap = 12 / D.court;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2, toTower = Math.atan2(-cz, -cx);
    if (Math.abs(((am - toTower + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < gap) continue;
    wallRun(mb, MARBLE, [cx + Math.cos(a1) * D.court, cz + Math.sin(a1) * D.court], [cx + Math.cos(a0) * D.court, cz + Math.sin(a0) * D.court], 0.8, 0.45, 0.5, 2);
  }
  return mb.build();
}

// ---------------------------------------------------------------- outside the walls

/** A square compound's curtain wall about (x, z), `half` from its middle, `h` high, merlons out, a tower at each corner and
 *  gates (each [its side - 0 north, 1 east, 2 south, 3 west - and the distance along it from the run's start: the north's
 *  its east end, the east's its south end, the south's its west end, the west's its north end]). */
function compound(mb, x, z, half, h, towerFn, gates, gateW = 10, gateH = 8) {
  const C = [[x - half, z - half], [x + half, z - half], [x + half, z + half], [x - half, z + half]];
  for (let i = 0; i < 4; i++) {
    const p = C[(i + 1) % 4], q = C[i], len = 2 * half;   // against the corners' turn: merlons out
    const g = gates.find(([side]) => side === i);
    if (g) gatedRun(mb, STONE, p, q, 4, h, g[1], gateW, gateH);
    else { wallRun(mb, STONE, p, q, 4, h); merlons(mb, STONE, p, q, 4, h); }
  }
  for (const [cx, cz] of C) towerFn(cx, cz);
}

/**
 * THE IMPERIAL PRISON, the Prison District's - the Legion's: its curtain wall with a square tower at each corner and its
 * gate toward the city; the Bastion, a great round tower, in its yard; the Legion's hall beside it.
 */
export function buildImperialPrison(P = IMPERIAL.prison) {
  const mb = new MeshBuilder(), [x, z] = prisonAt();
  compound(mb, x, z, P.half, P.h, (cx, cz) => squareTower(mb, cx, cz, P.tower, P.h + 10), prisonGates(P), 12, 10);   // AUDIT TESA II C3: the law's gates, its causeway's end
  roundTower(mb, x, z, P.bastionR, P.bastionH, { sides: 20, roofH: P.bastionR * 1.2 });
  const hx = x - P.half * 0.45, hz = z - P.half * 0.35;
  hall(mb, STONE, hx, hz, 44, 16, -1, 10, 0.25);
  gableRoof(mb, ROOF, STONE, hx, hz, 44, 16, 10, 6);
  darkDoor(mb, DARK, hx, hz + 8, 3, 5, [0, 1]);
  return mb.build();
}

/**
 * THE ARCANE UNIVERSITY, the Mages Guild's: its curtain wall with a round tower at each corner, its gates north and west
 * toward the city; the Arch-Mage's tower in its north-east, 120 m to its slate spire; its domed hall in the south-west.
 */
export function buildArcaneUniversity(U = IMPERIAL.university) {
  const mb = new MeshBuilder(), [x, z] = polar(U.b, U.r);
  compound(mb, x, z, U.half, U.h, (cx, cz) => roundTower(mb, cx, cz, U.tower, U.h + 8, { roof: SLATE }), universityGates(U));   // AUDIT TESA II C3: the law's gates, its causeways' ends
  const [tx, tz] = universityTowerAt();
  translated(mb, tx, 0, tz, () => {
    taper(mb, MARBLE, 16, U.spireR, -3, U.spireR * 0.75, U.spireH, { vRepeat: 10, uRepeat: 2 });
    ledge(mb, GOLD, 16, U.spireR * 0.75 + 1.2, U.spireR * 0.75, U.spireH - 2, U.spireH + 1, 0);
    taper(mb, SLATE, 16, U.spireR * 0.75 + 1, U.spireH + 1, 0.05, U.spireH + 34, { vRepeat: 6 });
  });
  darkDoor(mb, DARK, tx - U.spireR - 0.1, tz, 3, 6, [-1, 0]);
  const [hx, hz] = universityHallAt();
  hall(mb, MARBLE, hx, hz, U.hall, U.hall, -1, 14, 0.25);
  translated(mb, hx, 0, hz, () => cap(mb, MARBLE, 16, U.hall / 2 - 4, 14.01));
  dome(mb, SLATE, hx, 14, hz, U.hall / 2 - 4, U.hall * 0.4, { n: 16, rings: 6 });
  darkDoor(mb, DARK, hx, hz - U.hall / 2, 5, 8, [0, -1]);
  return mb.build();
}

/** THE WATERFRONT on the lake's south shore: its quay along the shore, its piers out over the water on their posts, and
 *  the light at the end of the third. */
export function buildWaterfront(W = IMPERIAL.waterfront) {
  const mb = new MeshBuilder(), step = 2;
  for (let b = W.b0; b < W.b1 - 1e-9; b += step) {
    const p = polar(Math.min(W.b1, b + step), W.r1), q = polar(b, W.r1);
    wallRun(mb, STONE, p, q, 3, W.deck, 4, 3);
  }
  W.piers.forEach((b, i) => {
    const [ux, uz] = polar(b, 1), from = W.r1 - 1, len = W.pierTo - from, c = polar(b, from + len / 2);
    const tx = -uz, tz = ux;
    // the deck: a box along its bearing (its corners round its axis), on posts every 6 m
    const P = (s, t, y) => [c[0] + ux * s + tx * t, y, c[1] + uz * s + tz * t];
    const hw = W.pierW / 2, hl = len / 2;
    mb.quad(TIMBER, P(-hl, -hw, W.deck), P(hl, -hw, W.deck), P(hl, hw, W.deck), P(-hl, hw, W.deck), [0, 1, 0], [[0, 0], [len / 3, 0], [len / 3, -W.pierW / 3], [0, -W.pierW / 3]]);
    for (const side of [1, -1]) mb.quad(TIMBER, P(-hl, side * hw, W.deck - 0.5), P(hl, side * hw, W.deck - 0.5), P(hl, side * hw, W.deck), P(-hl, side * hw, W.deck), [tx * side, 0, tz * side]);
    mb.quad(TIMBER, P(hl, -hw, W.deck - 0.5), P(hl, hw, W.deck - 0.5), P(hl, hw, W.deck), P(hl, -hw, W.deck), [ux, 0, uz]);
    for (let s = -hl + 2; s < hl; s += 6) for (const side of [1, -1]) { const [px, , pz] = P(s, side * (hw - 0.4), 0); mb.box(TIMBER, [px, (W.deck - 4) / 2, pz], [0.6, W.deck + 4, 0.6], 0.5); }
    if (i === 2) { const [lx, , lz] = P(hl - W.lightR - 1, 0, 0); roundTower(mb, lx, lz, W.lightR, W.lightH, { sides: 12, y: W.deck }); }
  });
  return mb.build();
}

/** TALOS BRIDGE: from the west gate over the isle and the lake to its far shore (TS5: the round lake's) - its deck rising to its height off the
 *  isle's shore, its parapets, its piers in the water; AUDIT TESA II C1: down again to the far shore at the rim's inner edge
 *  (bridgeLine), where the land's blend runs down to the road from the west - it stood to the city's west edge, its deck
 *  42 m over the road's end. */
export function buildTalosBridge(I = IMPERIAL) {
  const mb = new MeshBuilder(), B = I.bridge, hw = B.w / 2, x0 = -(I.cityWall.r + I.cityWall.thick / 2), x1 = bridgeLine(I)[1][0], xr = -I.isle, xl = x1 + B.landing;
  const yAt = (x) => (x >= xr ? 0.3 + (B.deck - 0.3) * ((x0 - x) / (x0 - xr)) : x <= xl ? 0.3 + (B.deck - 0.3) * ((x - x1) / (xl - x1)) : B.deck);
  const xs = [x0, xr, ...Array.from({ length: 11 }, (_, i) => xr + ((xl - xr) * (i + 1)) / 11), x1];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], ya = yAt(a), yb = yAt(b), run = a - b;
    const slope = unit([-(yb - ya) / (b - a), 1, 0]);
    mb.quad(BRIDGE, [a, ya, -hw], [b, yb, -hw], [b, yb, hw], [a, ya, hw], slope, [[0, 0], [run / 6, 0], [run / 6, -B.w / 6], [0, -B.w / 6]]);
    for (const side of [1, -1]) {
      mb.quad(BRIDGE, [a, ya - 2.5, side * hw], [b, yb - 2.5, side * hw], [b, yb + B.parapet, side * hw], [a, ya + B.parapet, side * hw], [0, 0, side]);
      mb.quad(BRIDGE, [a, ya, side * (hw - 0.6)], [b, yb, side * (hw - 0.6)], [b, yb + B.parapet, side * (hw - 0.6)], [a, ya + B.parapet, side * (hw - 0.6)], [0, 0, -side]);
      mb.quad(BRIDGE, [a, ya + B.parapet, side * (hw - 0.6)], [b, yb + B.parapet, side * (hw - 0.6)], [b, yb + B.parapet, side * hw], [a, ya + B.parapet, side * hw], [0, 1, 0]);
    }
  }
  for (let x = xr - B.pier / 2; x > xl + 4; x -= B.pier) mb.box(BRIDGE, [x, (B.deck - 6) / 2, 0], [3.2, B.deck + 6, B.w + 1.6], 0.3);
  return mb.build();
}
