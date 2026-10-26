// @ts-check
// TESA11 (bible/03-World/Arena-Provinces.md TESA11) - THE IMPERIAL CITY'S LANDMARKS: the port's own models of the city's
// canon (world/imperialCity.js IMPERIAL says where each stands) - the White-Gold Tower in the Palace District among the
// emperors' tombs inside the palace wall; the city wall round the six districts, a tower every `towerEvery` degrees, its
// gates and (TESA-LORE) its six watch towers where the district walls meet it; the walls between the districts, their
// gates on the ring roads; the Temple of the One; the dragon of Talos Plaza; the Arboretum's Nine Divines (TESA-LORE); the
// Imperial Prison and its Bastion; the Arcane University and its Arch-Mage's tower; the Waterfront's quay, piers and
// light; Talos Bridge. IC-GRAND: the Arena District's Colosseum of the port's own retired - Daggerfall's arena, Kamer's
// colosseum's block (world/arena/arenaCity.js), stands in its stead. In metres, drawn as the map reads (+z south), every
// model's origin the city's middle on its ground (world/capitalModels.js turns them northward). Shapes of the port's own
// on the canon - no game data, no other game's mesh.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, taper, ring, ledge, cap, wallRun, merlons, gatedRun, roundTower, squareTower, hall, pyramid, gableRoof, dome, blob, limb, darkDoor, entranceDoor, translated, corner, framed, robedFigure, outward } from './capitalShapes.js';
import { IMPERIAL, IMPERIAL_SECTORS, polar, prisonAt, universityTowerAt, universityHallAt, watchTowersAt, divinesAt, divinePlinths, bridgeLine, prisonGates, universityGates, tombAt, palaceCorners, palaceGates, imperialGeo, STATUE_PLINTH } from './imperialCity.js';

const MARBLE = art(CAPITAL_ART.marble), GOLD = art(CAPITAL_ART.gold), STONE = art(CAPITAL_ART.wallStone), BRIDGE = art(CAPITAL_ART.bridgeStone);
const DARK = art(CAPITAL_ART.dark), SLATE = art(CAPITAL_ART.blueSlate), ROOF = art(CAPITAL_ART.roof), TIMBER = art(CAPITAL_ART.timber);
const BRONZE = art(CAPITAL_ART.bronze), WATER = art(CAPITAL_ART.water);
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// ---------------------------------------------------------------- the White-Gold Tower and Green Emperor Way

/**
 * THE WHITE-GOLD TOWER: an octagonal plinth (its foundation, `plinthR` out), a tapering shaft banded in gold every `band`
 * metres, eight buttress fins at its corners from the plinth's edge to `finTop`, a gallery, the crown above it and a gilt
 * spire to `spireTop`; the palace's door at its foot on the east, toward the Market and the Arena. IC-GRAND (the team's
 * spec): slim - a foundation 180 m across, a shaft 70 m across at its foot, 760 m to the spire's tip.
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
 * sector's middle) with a turret either side. IC-GRAND (the coordinator's review: "walls/gates of the palace wall
 * dressed"): each gate a gatehouse - a marble arch over it from `gateH` to above the wall's walk, a gilt frieze along its
 * top and the Empire's dragon's gilt crest over its middle, both faces.
 */
export function buildPalaceWall(W = IMPERIAL.palaceWall, only = ANY) {
  const mb = new MeshBuilder(), gates = IMPERIAL_SECTORS.map(([, b]) => b + 30), half = gateDeg(W.gate + 0.5, W.r);
  for (const [p, q] of ringRuns(W.r, 360 / W.sides, gates, half)) if (only(p, q)) { wallRun(mb, STONE, p, q, W.thick, W.h); merlons(mb, STONE, p, q, W.thick, W.h); }
  for (const g of gates) for (const side of [1, -1]) { const [x, z] = polar(g + side * (half + gateDeg(W.towerR * 2 + 1, W.r)), W.r); if (only([x, z], [x, z])) roundTower(mb, x, z, W.towerR, W.towerH, { sides: 12 }); }
  for (const g of gates) {
    const a = polar(g + half, W.r), c = polar(g - half, W.r);
    if (!only(a, c)) continue;
    const [ux, uz] = polar(g, 1), P = framed(...polar(g, W.r), [ux, uz]), t = W.thick / 2 + 0.6, wd = W.gate / 2 + 0.25, top = W.h + 3;
    obox(mb, MARBLE, P, -t, t, -wd, wd, W.gateH, top);   // the arch's mass over the gate
    obox(mb, GOLD, P, -t - 0.2, t + 0.2, -wd - 0.2, wd + 0.2, top, top + 0.8);   // its gilt frieze
    for (const f of [1, -1]) {   // the crest, a gilt pediment over each face's middle
      const a0 = P(f * (t + 0.25), -4, top + 0.8), a1 = P(f * (t + 0.25), 4, top + 0.8), ap = P(f * (t + 0.25), 0, top + 4.2);
      mb.tri(GOLD, a0, a1, ap, [ux * f, 0, uz * f]);
    }
  }
  return mb.build();
}
/** IC-GRAND: every run a wall builder lays, when it is asked for the whole (a part's builder asks only the runs near its
 *  square - world/capitalModels.js imperialPartBuild). */
/** @type {(p: number[], q: number[]) => boolean} */
export const ANY = () => true;
/** IC-GRAND: a test of a run (two points, map frame) within `margin` of a rectangle [x0, z0, x1, z1] - a part's own. */
export const nearRect = ([x0, z0, x1, z1], margin) => (p, q) => Math.max(p[0], q[0]) > x0 - margin && Math.min(p[0], q[0]) < x1 + margin && Math.max(p[1], q[1]) > z0 - margin && Math.min(p[1], q[1]) < z1 + margin;

/** IC-GRAND: A BOX IN A FRAME OF ITS OWN - `P` a framed() frame, [f0, f1] forward, [s0, s1] across, [y0, y1] up: its four
 *  sides and its top. */
function obox(mb, tex, P, f0, f1, s0, s1, y0, y1) {
  const mid = P((f0 + f1) / 2, (s0 + s1) / 2, (y0 + y1) / 2), q = [[f0, s0], [f1, s0], [f1, s1], [f0, s1]];
  for (let e = 0; e < 4; e++) {
    const [fa, sa] = q[e], [fb, sb] = q[(e + 1) & 3], a = P(fa, sa, y0), b = P(fb, sb, y0), c = P(fb, sb, y1);
    mb.quad(tex, a, b, c, P(fa, sa, y1), outward(a, b, c, mid));
  }
  mb.quad(tex, P(f0, s0, y1), P(f1, s0, y1), P(f1, s1, y1), P(f0, s1, y1), [0, 1, 0]);
}
/** IC-GRAND: a hipped roof in a frame (obox's) - its eaves the rectangle at y0, its ridge `h` above along the longer way. */
function hipRoof(mb, tex, P, f0, f1, s0, s1, y0, h) {
  const fm = (f0 + f1) / 2, sm = (s0 + s1) / 2, alongS = s1 - s0 >= f1 - f0, k = Math.min(f1 - f0, s1 - s0) / 2, mid = P(fm, sm, y0);
  const r0 = alongS ? P(fm, s0 + k, y0 + h) : P(f0 + k, sm, y0 + h), r1 = alongS ? P(fm, s1 - k, y0 + h) : P(f1 - k, sm, y0 + h);
  const A = P(f0, s0, y0), B = P(f1, s0, y0), C = P(f1, s1, y0), D = P(f0, s1, y0);
  const faces = alongS ? [[B, C, r1, r0], [D, A, r0, r1], [A, B, r0], [C, D, r1]] : [[A, B, r1, r0], [C, D, r0, r1], [B, C, r1], [D, A, r0]];
  for (const f of faces) {
    const n = outward(f[0], f[1], f[2], mid);
    if (f.length === 4) mb.quad(tex, f[0], f[1], f[2], f[3], n); else mb.tri(tex, f[0], f[1], f[2], n);
  }
}
/** IC-GRAND: a pyramid in a frame (obox's), its eaves the rectangle at y0, its apex `h` above. */
function opyramid(mb, tex, P, f0, f1, s0, s1, y0, h) {
  const q = [[f0, s0], [f1, s0], [f1, s1], [f0, s1]], top = P((f0 + f1) / 2, (s0 + s1) / 2, y0 + h), mid = P((f0 + f1) / 2, (s0 + s1) / 2, y0);
  for (let e = 0; e < 4; e++) { const a = P(q[e][0], q[e][1], y0), b = P(q[(e + 1) & 3][0], q[(e + 1) & 3][1], y0); mb.tri(tex, a, b, top, outward(a, b, top, mid)); }
}

/** THE EMPERORS' TOMBS: a ring of marble mausolea, each its stepped pyramid and its gilt cap. IC-GRAND (the coordinator's
 *  review: "the emperors' tombs as real monuments along the way"): on Green Emperor Way's inner verge, each turned to face
 *  it - its podium and its steps, its cella, a portico of `columns` under its entablature before its door, its stepped
 *  pyramid over all and its gilt cap. */
export function buildEmperorsTombs(T = IMPERIAL.tombs) {
  const mb = new MeshBuilder(), w = T.w / 2, pd = T.podium, deep = 6;
  for (let i = 0; i < T.n; i++) {
    const [x, z] = tombAt(i), P = framed(x, z, unit([x, z]));
    obox(mb, MARBLE, P, -w - pd, w + pd, -w - pd, w + pd, -1, 0.6);   // the podium
    obox(mb, MARBLE, P, -w - pd / 2, w + pd / 2, -w - pd / 2, w + pd / 2, 0.6, 1.2);   // its step
    obox(mb, MARBLE, P, -w, w - deep, -w, w, 1.2, T.h);   // the cella
    obox(mb, MARBLE, P, w - deep, w, -w, w, T.h - 2.2, T.h);   // the portico's entablature
    for (let k = 0; k < T.columns; k++) {   // its columns
      const sc = -w + 1.6 + (k * (2 * w - 3.2)) / (T.columns - 1), [cx, , cz] = P(w - 1.4, sc, 0);
      translated(mb, cx, 0, cz, () => taper(mb, MARBLE, 8, 0.85, 1.2, 0.7, T.h - 2.2, { vRepeat: 4 }));
    }
    obox(mb, GOLD, P, w - 0.3, w + 0.05, -w, w, T.h - 1.6, T.h - 0.8);   // a gilt band on the entablature
    for (const [y0, k] of [[T.h, 0], [T.h + 2.4, 2.5]]) obox(mb, MARBLE, P, -w - 0.5 + k, w + 0.5 - k, -w - 0.5 + k, w + 0.5 - k, y0, y0 + 2.4);   // the pyramid's steps
    opyramid(mb, MARBLE, P, -w + 4.5, w - 4.5, -w + 4.5, w - 4.5, T.h + 4.8, T.w * 0.42);
    const [gx, , gz] = P(0, 0, 0);
    mb.box(GOLD, [gx, T.h + 4.8 + T.w * 0.42 + 0.6, gz], [1.6, 1.6, 1.6], 0.5);
    const [dx, , dz] = P(w - deep, 0, 0), face = unit([x, z]);
    darkDoor(mb, DARK, dx, dz, 3.4, 6.5, face, 1.2);   // its door under the portico
  }
  return mb.build();
}

/**
 * IC-GRAND (the coordinator's review of the renders: "the palace at the tower's foot"): THE IMPERIAL PALACE - a ring of
 * marble wings round the tower's plaza (`sides` of them, `r0` to `r1`), two storeys of windows on each face, hipped roofs
 * of slate; a gate through each wing a palace gate faces (`gate` wide, `gateH` high), a gilt pediment over it on both
 * faces; a domed pavilion at each corner - its octagonal drum to `pavilionH`, a gilt band and a gilt dome.
 */
export function buildImperialPalace(I = IMPERIAL) {
  const P0 = I.palace, mb = new MeshBuilder(), n = P0.sides, step = 360 / n, gates = new Set(palaceGates().map((g) => ((g % 360) + 360) % 360));
  const fw = (P0.r1 - P0.r0) / 2, len = P0.r1 * Math.tan(Math.PI / n), rm = (P0.r0 + P0.r1) / 2;
  for (let k = 0; k < n; k++) {
    const b = k * step, face = polar(b, 1), P = framed(...polar(b, rm), face), gate = gates.has(b), gw = P0.gate / 2;
    for (const [s0, s1] of gate ? [[-len, -gw], [gw, len]] : [[-len, len]]) obox(mb, MARBLE, P, -fw, fw, s0, s1, -2, P0.h);
    if (gate) {
      obox(mb, MARBLE, P, -fw, fw, -gw, gw, P0.gateH, P0.h);   // the gate's lintel
      for (const f of [1, -1]) {
        const a0 = P(f * (fw + 0.3), -gw - 6, P0.h), a1 = P(f * (fw + 0.3), gw + 6, P0.h), ap = P(f * (fw + 0.3), 0, P0.h + 9);
        mb.tri(GOLD, a0, a1, ap, [face[0] * f, 0, face[1] * f]);
      }
    }
    obox(mb, GOLD, P, -fw - 0.4, fw + 0.4, -len, len, P0.h - 0.8, P0.h);   // the cornice, gilt
    hipRoof(mb, SLATE, P, -fw - 0.6, fw + 0.6, -len, len, P0.h, 7);
    // the windows: two storeys, a window every six metres on both faces, none over the gate
    for (const f of [1, -1]) for (let sc = -len + 8; sc <= len - 8; sc += 6) {
      if (gate && Math.abs(sc) < gw + 4) continue;
      for (const y of [5, 13]) {
        const nrm = [face[0] * f, 0, face[1] * f], fo = f * (fw + 0.05);
        mb.quad(DARK, P(fo, sc - 1.2, y), P(fo, sc + 1.2, y), P(fo, sc + 1.2, y + 4.4), P(fo, sc - 1.2, y + 4.4), nrm);
      }
    }
  }
  for (const [x, z] of palaceCorners(I)) {
    translated(mb, x, 0, z, () => {
      taper(mb, MARBLE, 8, P0.pavilionR, -2, P0.pavilionR, P0.pavilionH, { vRepeat: 6 });
      ledge(mb, GOLD, 8, P0.pavilionR + 0.6, P0.pavilionR - 1.5, P0.pavilionH, P0.pavilionH + 1.2);
    });
    dome(mb, GOLD, x, P0.pavilionH + 1.2, z, P0.domeR, P0.domeR * 0.9, { n: 12, rings: 4 });
    mb.box(GOLD, [x, P0.pavilionH + 1.2 + P0.domeR * 0.9 + 1.5, z], [0.9, 3, 0.9], 0.5);
  }
  return mb.build();
}

/** IC-GRAND: an emperor's statue at (x, z) facing `face` - its marble plinth, its cornice and its figure of bronze in its
 *  robes, crowned in gold (`pose` its arms': robedFigure's, at a few sides fewer - two hundred and forty of them). */
function emperorStatue(mb, x, z, face, pose) {
  const P = framed(x, z, face), h = STATUE_PLINTH / 2, y = 2.4, k = 1.05;
  obox(mb, MARBLE, P, -h, h, -h, h, -0.5, y);
  obox(mb, MARBLE, P, -h - 0.2, h + 0.2, -h - 0.2, h + 0.2, y, y + 0.3);
  translated(mb, x, y + 0.3, z, () => {
    taper(mb, BRONZE, 6, 1.0 * k, 0, 0.55 * k, 3.4 * k, { vRepeat: 3 });   // the robe
    taper(mb, BRONZE, 6, 0.55 * k, 3.4 * k, 0.72 * k, 4.3 * k, { vRepeat: 2 });   // the chest to the shoulders
    taper(mb, BRONZE, 6, 0.36 * k, 4.3 * k, 0.4 * k, 5.2 * k, { vRepeat: 2 });   // the head
    taper(mb, GOLD, 6, 0.44 * k, 5.2 * k, 0.48 * k, 5.6 * k, { vRepeat: 1 });   // the crown
  });
  const yb = y + 0.3, sh = (side) => P(0, side * 0.7 * k, yb + 4.1 * k);
  const hand = pose === 1 ? (side) => (side > 0 ? P(0.2 * k, 0.9 * k, yb + 6.4 * k) : P(0.25 * k, -0.8 * k, yb + 2.8 * k))
    : pose === 2 ? (side) => P(0.6 * k, side * 1.4 * k, yb + 5.8 * k)
      : (side) => P(0.7 * k, side * 0.32 * k, yb + 3.1 * k);
  for (const side of [1, -1]) limb(mb, BRONZE, sh(side), hand(side), 0.24 * k, 0.17 * k, { n: 4 });
}
/** IC-GRAND: a fountain at (x, z) - its marble basin `r` round (its kerb, its water), a pedestal and two bowls, a gilt
 *  finial. */
function fountain(mb, x, z, r) {
  const n = 12, kerb = 0.9, rim = 0.8;
  translated(mb, x, 0, z, () => {
    taper(mb, MARBLE, n, r, -0.5, r, kerb, { vRepeat: 2 });
    ring(mb, MARBLE, n, r - rim, r, kerb);
    taper(mb, MARBLE, 6, 1.1, 0, 0.8, 2.4, { vRepeat: 2 });   // the pedestal
    taper(mb, MARBLE, 8, 0.8, 2.2, 3.2, 2.9, { vRepeat: 1 });   // the great bowl
    ring(mb, WATER, 8, 0.01, 3.2, 2.9);
    taper(mb, MARBLE, 6, 0.45, 2.9, 0.35, 4.6, { vRepeat: 2 });
    taper(mb, MARBLE, 6, 0.35, 4.5, 1.4, 5.0, { vRepeat: 1 });   // the small bowl
    taper(mb, GOLD, 6, 0.3, 5.0, 0.01, 6.4, { vRepeat: 1 });
  });
  for (let i = 0; i < n; i++) {   // the basin's inner face, toward its middle, and its water
    const [ax, , az] = corner(n, i, r - rim, 0), [bx, , bz] = corner(n, i + 1, r - rim, 0), am = ((i + 0.5) / n) * Math.PI * 2;
    mb.quad(MARBLE, [x + ax, 0.4, z + az], [x + bx, 0.4, z + bz], [x + bx, kerb, z + bz], [x + ax, kerb, z + az], [-Math.cos(am), 0, -Math.sin(am)]);
    mb.tri(WATER, [x, 0.4, z], [x + ax, 0.4, z + az], [x + bx, 0.4, z + bz], [0, 1, 0]);
  }
}
/**
 * IC-GRAND (the coordinator's review: "Green Emperor Way's gardens and paths ... trees and statuary"): THE PALACE
 * GARDENS' MONUMENTS - a fountain where each garden path crosses each ring walk, and the emperors' statues along every path
 * facing it (the paths, the walks and the rows of trees are the ground's - world/imperialCity.js imperialTile and
 * imperialTree). A part asks only the ones near its square (world/capitalModels.js imperialPartBuild).
 */
export function buildPalaceGardens(I = IMPERIAL, only = ANY) {
  const mb = new MeshBuilder(), g = imperialGeo(I);
  for (const [x, z] of g.fountains) if (only([x, z], [x, z])) fountain(mb, x, z, I.gardens.fountainR);
  g.statues.forEach(([x, z, fx, fz], i) => { if (only([x, z], [x, z])) emperorStatue(mb, x, z, [fx, fz], i % 3); });
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
export function buildCityWall(W = IMPERIAL.cityWall, only = ANY) {
  const mb = new MeshBuilder(), half = gateDeg(W.gate, W.r), watch = new Set(IMPERIAL_SECTORS.map(([, b]) => b));
  for (const [p, q] of ringRuns(W.r, W.towerEvery, W.gates, half)) if (only(p, q)) { wallRun(mb, STONE, p, q, W.thick, W.h); merlons(mb, STONE, p, q, W.thick, W.h); }
  for (let b = 0; b < 360; b += W.towerEvery) if (!watch.has(b) && W.gates.every((g) => Math.abs(((b - g + 540) % 360) - 180) > half + gateDeg(W.towerR * 2 + 4, W.r))) { const [x, z] = polar(b, W.r); if (only([x, z], [x, z])) roundTower(mb, x, z, W.towerR, W.towerH); }
  for (const [x, z] of watchTowersAt()) if (only([x, z], [x, z])) watchTower(mb, x, z, W);
  for (const g of W.gates) {
    const a = polar(g + half, W.r), c = polar(g - half, W.r);
    if (only(a, c)) translated(mb, 0, W.gateH, 0, () => wallRun(mb, STONE, a, c, W.thick, W.h - W.gateH, 0));
    for (const side of [1, -1]) { const [x, z] = polar(g + side * (half + gateDeg(W.towerR + 1, W.r)), W.r); if (only([x, z], [x, z])) roundTower(mb, x, z, W.towerR, W.towerH + 6); }
  }
  return mb.build();
}

/** THE WALLS BETWEEN THE DISTRICTS: at each sector's edge from the palace wall to the city wall, a gate at each share of
 *  its length `gates` names (IC-GRAND: the three ring roads cross it there), a lintel over each. */
export function buildDistrictWalls(I = IMPERIAL, only = ANY) {
  const mb = new MeshBuilder(), D = I.districtWall;
  // a run in pieces of RUN_PIECE metres, so a part asks only the pieces near its square
  const run = (a, c) => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(len / RUN_PIECE));
    for (let k = 0; k < n; k++) {
      const p = [a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n], q = [a[0] + ((c[0] - a[0]) * (k + 1)) / n, a[1] + ((c[1] - a[1]) * (k + 1)) / n];
      if (only(p, q)) { wallRun(mb, STONE, p, q, D.thick, D.h); merlons(mb, STONE, p, q, D.thick, D.h); }
    }
  };
  for (const [, b] of IMPERIAL_SECTORS) {
    const r0 = I.palaceWall.r + I.palaceWall.thick / 2 + 0.5, r1 = I.cityWall.r - I.cityWall.thick / 2 - 0.5;
    // the gates by their metres out from the city's middle (the shares of the palace-to-city wall's length, as the law's)
    const at = D.gates.map((t) => I.palaceWall.r + (I.cityWall.r - I.palaceWall.r) * t);
    let from = r0;
    for (const g of at) {
      run(polar(b, from), polar(b, g - D.gate / 2));
      const ga = polar(b, g - D.gate / 2), gb = polar(b, g + D.gate / 2);
      if (only(ga, gb)) translated(mb, 0, D.gateH, 0, () => wallRun(mb, STONE, ga, gb, D.thick, D.h - D.gateH, 0));
      from = g + D.gate / 2;
    }
    run(polar(b, from), polar(b, r1));
  }
  return mb.build();
}
/** IC-GRAND: a district wall's run is laid in pieces this long. */
const RUN_PIECE = 102.4;

// ---------------------------------------------------------------- the districts' landmarks

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
export function buildWaterfront(W = IMPERIAL.waterfront, only = ANY) {
  const mb = new MeshBuilder(), step = 0.5;
  for (let b = W.b0; b < W.b1 - 1e-9; b += step) {
    const p = polar(Math.min(W.b1, b + step), W.r1), q = polar(b, W.r1);
    if (only(p, q)) wallRun(mb, STONE, p, q, 3, W.deck, 4, 3);
  }
  W.piers.forEach((b, i) => {
    if (!only(polar(b, W.r1 - 1), polar(b, W.pierTo))) return;
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
