// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - MOURNHOLD'S LANDMARKS: the port's own models of the city's
// signatures (world/capitalPlans.js MOURNHOLD says where each stands) - TESA-LORE, on Tribunal's plan: Plaza Brindisi
// Dorom in the south, a garden behind its low ring wall round the great statue of Almalexia in battle with Mehrunes
// Dagon; the High Fane's great dome and its four pavilions in the Temple Courtyard at the north, its pools and braziers;
// the Royal Palace at the middle, its three domes and its four towers; the Great Bazaar's stalls in the east; the ochre
// walls with their domed towers - in metres, drawn as the map reads (+z south), every model's origin Mournhold's anchor
// on its ground. Shapes of the port's own in the spirit of the city's look. No game data.
import { MeshBuilder } from './detStandIns.js';
import {
  CAPITAL_ART,
  art,
  taper,
  ring,
  ledge,
  cap,
  translated,
  wallRun,
  gatedRun,
  hall,
  darkDoor,
  entranceDoor,
  dome,
  blob,
  limb,
  outward,
  framed,
  robedFigure,
} from './capitalShapes.js';
import { MOURNHOLD, mournholdTreeSites } from './capitalPlans.js';
import { column, tube, mass, cards, treeRng, within } from './capitalTrees.js'; // CAPITAL-TREES: the capitals' trees' kit
import { urbanArt } from './urban/urbanRecords.js'; // URBANIZER U2: the towns' own cut stone
/** URBANIZER U2 (world/urban/urbanArt.js): the Royal Palace's dressed ochre stone. */
const OCHRE_ASHLAR = urbanArt('ochreAshlar');

const OCHRE = art(CAPITAL_ART.ochre),
  BRONZE = art(CAPITAL_ART.bronze),
  GOLD = art(CAPITAL_ART.gold),
  CLOTH = art(CAPITAL_ART.cloth);
const MARBLE = art(CAPITAL_ART.marble),
  DARK = art(CAPITAL_ART.dark),
  TIMBER = art(CAPITAL_ART.timber),
  BLUE = art(CAPITAL_ART.blueSlate);
const MH_BARK = art(CAPITAL_ART.mhBark),
  MH_LEAVES = art(CAPITAL_ART.mhLeaves),
  MH_SPRAY = art(CAPITAL_ART.mhSpray),
  BED = art(CAPITAL_ART.planterBed);

/** A round tower of ochre under a bronze dome (Mournhold's wall's, the palace's). */
export function domedTower(mb, x, z, r, h, { y = 0, wall = OCHRE, roof = BRONZE } = {}) {
  translated(mb, x, y, z, () => {
    taper(mb, wall, 12, r, -3, r, h, { vRepeat: 6, uRepeat: 2 });
    ledge(mb, wall, 12, r + 0.5, r - 0.2, h, h + 1.2);
  });
  dome(mb, roof, x, y + h + 1.2, z, r + 0.2, r * 0.9, { n: 12, rings: 5, onion: 0.25 });
  translated(mb, x, y + h + 1.2 + r * 0.9 - 0.2, z, () => taper(mb, GOLD, 6, 0.35, 0, 0.02, 2.2, { vRepeat: 1 }));
}

/**
 * TESA-LORE: MEHRUNES DAGON, `h` tall from `y` at (x, z) facing `face`: his legs astride, his body leaning into the
 * fight, his horned head, his four arms - the upper right raising his axe, the rest reaching for his foe.
 */
export function dagonFigure(mb, tex, x, z, y, h, face) {
  const P = framed(x, z, face),
    k = h / 13;
  for (const side of [1, -1])
    limb(mb, tex, P(-0.3 * k, side * 0.9 * k, y + 5.6 * k), P(side * 0.6 * k, side * 1.6 * k, y), 1.0 * k, 0.7 * k, {
      n: 8,
    }); // his legs
  const hip = P(0, 0, y + 5.6 * k),
    chest = P(1.1 * k, 0, y + 9.6 * k);
  limb(mb, tex, hip, chest, 1.5 * k, 2.2 * k, { n: 10 });
  blob(mb, tex, ...chest, 2.2 * k, 1.4 * k, 2.2 * k, { n: 10, rings: 5, rough: 0, seed: 0xda6 }); // his shoulders
  const head = P(1.6 * k, 0, y + 11.6 * k);
  blob(mb, tex, ...head, 0.95 * k, 1.05 * k, 0.95 * k, { n: 8, rings: 5, rough: 0, seed: 0xda7 });
  for (const side of [1, -1]) {
    const root = P(1.5 * k, side * 0.6 * k, y + 12.2 * k),
      bend = P(0.9 * k, side * 1.3 * k, y + 13.4 * k);
    limb(mb, tex, root, bend, 0.32 * k, 0.2 * k, { n: 6 });
    limb(mb, tex, bend, P(-0.2 * k, side * 1.5 * k, y + 13.9 * k), 0.2 * k, 0.03 * k, { n: 6 }); // his horns, swept back
  }
  const axeHand = P(1.6 * k, 2.6 * k, y + 14.2 * k);
  limb(mb, tex, P(1.0 * k, 2.0 * k, y + 10.4 * k), axeHand, 0.55 * k, 0.4 * k, { n: 6 });
  limb(mb, tex, P(0.6 * k, 2.6 * k, y + 12.4 * k), P(3.2 * k, 2.6 * k, y + 16.4 * k), 0.16 * k, 0.16 * k, { n: 6 }); // his axe's haft
  blob(mb, tex, ...P(2.9 * k, 2.6 * k, y + 15.8 * k), 1.1 * k, 0.9 * k, 0.18 * k, {
    n: 8,
    rings: 4,
    rough: 0,
    seed: 0xda8,
  }); // its head
  limb(mb, tex, P(1.0 * k, -2.0 * k, y + 10.4 * k), P(3.4 * k, -2.1 * k, y + 9.6 * k), 0.55 * k, 0.4 * k, { n: 6 });
  for (const side of [1, -1])
    limb(
      mb,
      tex,
      P(0.9 * k, side * 1.6 * k, y + 8.4 * k),
      P(3.0 * k, side * 1.2 * k, y + 7.2 * k),
      0.45 * k,
      0.32 * k,
      { n: 6 },
    ); // his lower arms
}

/**
 * PLAZA BRINDISI DOROM - TESA-LORE: "a public garden dominated by a great statue at its center" (UESP): the ring of the
 * garden's low wall about its middle, open on its four axes (west to Godsreach, east to the Great Bazaar, north to the
 * palace, south to the city's south gate); the great statue of Almalexia in battle with Mehrunes Dagon on its stepped
 * plinth - she on its east half with Hopesfire raised, he on its west with his axe, the two face to face.
 */
export function buildMournholdPlaza(M = MOURNHOLD) {
  const mb = new MeshBuilder(),
    P = M.plaza,
    half = Math.asin((P.gate / 2 + 0.2) / P.r),
    n = 48;
  for (let i = 0; i < n; i++) {
    let s = (i / n) * Math.PI * 2,
      e = ((i + 1) / n) * Math.PI * 2,
      skip = false;
    for (const ga of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI]) {
      if (s >= ga - half && e <= ga + half) skip = true;
      else if (s < ga + half && s > ga - half) s = ga + half;
      else if (e > ga - half && e < ga + half) e = ga - half;
    }
    if (skip || e <= s) continue;
    wallRun(
      mb,
      MARBLE,
      [P.x + Math.cos(s) * P.r, P.z + Math.sin(s) * P.r],
      [P.x + Math.cos(e) * P.r, P.z + Math.sin(e) * P.r],
      1.2,
      P.ring,
      1,
      2,
    );
  }
  const S = M.statue,
    y = S.plinthH;
  hall(mb, MARBLE, P.x, P.z, S.base, S.base, -1, 1.4, 0.25);
  hall(mb, MARBLE, P.x, P.z, S.plinth, S.plinth, 1.4, y, 0.25);
  dagonFigure(mb, BRONZE, P.x - 3, P.z, y, S.dagon, [1, 0]);
  robedFigure(mb, BRONZE, P.x + 3.2, P.z, y, S.almalexia, [-1, 0], 1);
  const k = S.almalexia / 6.5,
    hand = [P.x + 3.2 - 0.2 * k, y + 7.4 * k, P.z - 1.0 * k];
  limb(mb, GOLD, hand, [P.x + 3.2 - 2.4 * k, y + 9.2 * k, P.z - 1.1 * k], 0.14 * k, 0.03 * k, { n: 4 }); // Hopesfire
  return mb.build();
}

/**
 * THE HIGH FANE in the Temple Courtyard - TESA-LORE: the temple "in the center of a large and decorative courtyard, which
 * lies at the northern end of Mournhold" (UESP): a plinth of ochre, its great drum and dome of bronze with a gilt
 * lantern, four domed pavilions at the plinth's corners, its porch south to the courtyard and the palace, its door dark;
 * the courtyard's two long pools in their marble kerbs and its braziers along the way to the palace.
 */
export function buildHighFane(M = MOURNHOLD) {
  const mb = new MeshBuilder(),
    F = M.fane,
    y0 = F.plinthH;
  hall(mb, OCHRE, F.x, F.z, F.plinth, F.plinth, -3, y0, 0.2);
  translated(mb, F.x, 0, F.z, () => {
    taper(mb, OCHRE, 16, F.drumR, y0, F.drumR, y0 + F.drumH, { vRepeat: 6, uRepeat: 3 });
    ledge(mb, GOLD, 16, F.drumR + 0.6, F.drumR, y0 + F.drumH - 1, y0 + F.drumH);
  });
  const crown = y0 + F.drumH;
  dome(mb, BRONZE, F.x, crown, F.z, F.drumR, F.domeH, { n: 16, rings: 7 });
  translated(mb, F.x, crown + F.domeH - 0.3, F.z, () => {
    taper(mb, GOLD, 8, 2.6, 0, 2.6, 4, { vRepeat: 2 });
    taper(mb, GOLD, 8, 2.8, 4, 0.05, 10, { vRepeat: 3 });
  });
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      const px = F.x + sx * F.pavilion,
        pz = F.z + sz * F.pavilion;
      translated(mb, px, 0, pz, () => taper(mb, OCHRE, 12, F.pavR, y0, F.pavR, y0 + F.pavH, { vRepeat: 6 }));
      dome(mb, BRONZE, px, y0 + F.pavH, pz, F.pavR, F.pavR, { n: 12, rings: 5 });
    }
  const pz = F.z + F.plinth / 2 + F.porch / 2;
  hall(mb, OCHRE, F.x, pz, F.porch * 0.9, F.porch, -3, y0 + 9, 0.2);
  darkDoor(mb, DARK, F.x, pz + F.porch / 2, 4.5, 7, [0, 1], y0);
  // the courtyard: its pools, each a water's face in a marble kerb, and its braziers - a pillar, a bronze bowl, its flame
  const C = M.court,
    [z0, z1] = C.poolZ;
  for (const px of C.pools) {
    for (const [cx, cz, w, d] of [
      [px, z0, C.poolW + 1, 1],
      [px, z1, C.poolW + 1, 1],
      [px - C.poolW / 2, (z0 + z1) / 2, 1, z1 - z0 + 1],
      [px + C.poolW / 2, (z0 + z1) / 2, 1, z1 - z0 + 1],
    ])
      hall(mb, MARBLE, cx, cz, w, d, -0.5, 0.7, 0.5);
    mb.quad(
      BLUE,
      [px - C.poolW / 2, 0.35, z0],
      [px + C.poolW / 2, 0.35, z0],
      [px + C.poolW / 2, 0.35, z1],
      [px - C.poolW / 2, 0.35, z1],
      [0, 1, 0],
    );
  }
  for (const bx of C.braziers)
    for (const bz of C.brazierZ) {
      translated(mb, bx, 0, bz, () => {
        taper(mb, MARBLE, 8, 0.8, -0.5, 0.55, C.brazierH, { vRepeat: 2 });
        taper(mb, BRONZE, 8, 0.55, C.brazierH, 1.4, C.brazierH + 1, { vRepeat: 1 });
      });
      blob(mb, GOLD, bx, C.brazierH + 1.4, bz, 0.9, 1.1, 0.9, { n: 6, rings: 4, rough: 0.2, seed: 0xf1 + bx + bz });
    }
  return mb.build();
}

/**
 * THE ROYAL PALACE at the middle of the city (TESA-LORE: "the Royal Palace forms the center of the city"): its long block
 * of ochre, flat-roofed with a gilt cornice; three bronze domes along its roof, the middle the largest; a slender domed
 * tower at each corner; its doors south to the plaza and north to the Temple Courtyard.
 */
export function buildMournholdPalace(M = MOURNHOLD) {
  const mb = new MeshBuilder(),
    P = M.palace;
  hall(mb, OCHRE_ASHLAR, P.x, P.z, P.w, P.d, -3, P.h, 0.2); // URBANIZER U2: the palace in dressed ochre stone, the city's walls its rubble
  translated(mb, P.x, P.h - 1, P.z, () => mb.box(GOLD, [0, 0.5, 0], [P.w + 0.8, 1, P.d + 0.8], 0.5));
  for (const [dx, r] of [
    [0, P.domeR],
    [-P.w / 3, P.sideR],
    [P.w / 3, P.sideR],
  ]) {
    translated(mb, P.x + dx, 0, P.z, () => taper(mb, OCHRE, 16, r, P.h, r, P.h + 3, { vRepeat: 3 }));
    dome(mb, BRONZE, P.x + dx, P.h + 3, P.z, r, r, { n: 16, rings: 6, onion: 0.2 });
  }
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      domedTower(mb, P.x + sx * (P.w / 2 - P.tower), P.z + sz * (P.d / 2 + P.tower * 0.5), P.tower, P.towerH);
  darkDoor(mb, DARK, P.x, P.z + P.d / 2, 5, 7.5, [0, 1]);
  darkDoor(mb, DARK, P.x, P.z - P.d / 2, 5, 7.5, [0, -1]);
  return { ...mb.build(), doors: [entranceDoor(P.x, P.z + P.d / 2, 5, 7.5, [0, 1])] }; // WW7-4: the palace's halls, by its door to the plaza (world/capitalCastles.js)
}

/** THE GREAT BAZAAR: its stalls in rows, each a cloth awning on four poles sloping to its front - TESA-LORE: in the
 *  east, before its shops. */
export function buildGreatBazaar(M = MOURNHOLD) {
  const mb = new MeshBuilder(),
    B = M.bazaar;
  for (let c = 0; c < B.cols; c++)
    for (let r = 0; r < B.rows; r++) {
      const x = B.x - B.w / 2 + ((c + 0.5) * B.w) / B.cols,
        z = B.z - B.d / 2 + ((r + 0.5) * B.d) / B.rows,
        hw = B.stall / 2,
        hd = B.deep / 2;
      for (const [px, pz] of [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
      ])
        mb.box(TIMBER, [x + px, B.poles / 2 + (pz < 0 ? 0.5 : 0), z + pz], [0.25, B.poles + (pz < 0 ? 1 : 0), 0.25], 1);
      const a = [x - hw - 0.3, B.poles + 1, z - hd - 0.3],
        b = [x + hw + 0.3, B.poles + 1, z - hd - 0.3],
        cc = [x + hw + 0.3, B.poles, z + hd + 0.3],
        d = [x - hw - 0.3, B.poles, z + hd + 0.3];
      const n = outward(a, b, cc, [x, 0, z]);
      mb.sheet(CLOTH, a, b, cc, d, n, [
        [0, 0],
        [B.stall / 8, 0],
        [B.stall / 8, -1],
        [0, -1],
      ]);
    }
  return mb.build();
}

/** THE WALLS: a square of ochre round the city's six by six, a gate in each side's middle, domed round towers at its
 *  corners, by each gate and between. */
export function buildMournholdWall(M = MOURNHOLD) {
  const mb = new MeshBuilder(),
    W = M.wall,
    h = W.half;
  const C = [
    [h, -h],
    [-h, -h],
    [-h, h],
    [h, h],
  ]; // north-east, north-west, south-west, south-east: their merlons outward
  for (let i = 0; i < 4; i++) gatedRun(mb, OCHRE, C[i], C[(i + 1) % 4], W.thick, W.h, h, W.gate, W.gateH);
  for (const [x, z] of mournholdTowers(W)) domedTower(mb, x, z, W.tower, W.towerH);
  return mb.build();
}
/** The wall's towers: its corners, a pair at each gate, and along each side between them. */
export function mournholdTowers(W = MOURNHOLD.wall) {
  const h = W.half,
    g = W.gate / 2 + W.tower + 0.5,
    out = [
      [h, -h],
      [-h, -h],
      [-h, h],
      [h, h],
    ];
  for (const [ax, az] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const at = (s) => (ax ? [ax * h, s] : [s, az * h]);
    out.push(at(-g), at(g));
    for (let s = W.every; s < h - W.tower * 2; s += W.every) out.push(at(s + g), at(-s - g));
  }
  return out;
}

/**
 * CAPITAL-TREES (bible/03-World/Arena-Provinces.md CAPITAL-TREES; KPbICA, forwarded by the owner: "The main trees in
 * Falinesti and Mournhold should get some love. They are too draftish for now"): MOURNHOLD'S GARDENS - the city's own
 * trees in their planters, where its plaza had stood the Bay's scenery trees (a fir and an oak of the Iliac Bay's woods):
 * Tribunal's Mournhold grows its plants in planters (UESP's Tribunal ingredients - Noble Sedge, Golden Sedge, Timsa-Come-By,
 * Meadow Rye and Nirthfly "found growing in various planters in Mournhold", Plaza Brindisi Dorom's among them), and its
 * Temple Courtyard is "an enclosed area with paths, water, and trees" (UESP). Each tree (mournholdGardenTree) a broadleaf of
 * Deshaan's warm, wet lowlands - a smooth pale trunk, its limbs spreading from a fork at a man's height and a half into a
 * rounded crown under its leaf sprays - in an octagonal planter of the city's ochre stone under a marble coping, its bed
 * the sedges' and the rye's. The trees stand mournholdTreeSites' (world/capitalPlans.js); the statue over them all.
 */
export function buildMournholdGardens(M = MOURNHOLD) {
  const mb = new MeshBuilder();
  for (const site of mournholdTreeSites(M)) mournholdGardenTree(mb, site, M.gardens);
  return mb.build();
}

/**
 * CAPITAL-TREES: ONE OF MOURNHOLD'S TREES at `site` ({x, z, yaw, scale, variant}): its planter, its trunk to its fork,
 * its three or four limbs each with a twig off it, and its crown - a mass at every limb's end and one over the fork, each
 * with its sprays. Every draw its variant's own seed, so the city's four trees are four, turned and sized by the site.
 */
export function mournholdGardenTree(mb, { x, z, yaw, scale, variant }, G = MOURNHOLD.gardens) {
  const r = treeRng(0x3b10 + variant * 977),
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  const W = (/** @type {number[]} */ p) => [
    x + (c * p[0] - s * p[2]) * scale,
    p[1] * scale,
    z + (s * p[0] + c * p[2]) * scale,
  ];
  // the planter: an octagon of ochre stone, its coping of marble, its bed of sedges and rye
  const pr = G.planter * scale,
    ph = 0.75;
  translated(mb, x, 0, z, () => {
    taper(mb, OCHRE, 8, pr, -0.5, pr, ph, { phase: Math.PI / 8, vRepeat: 1.25 });
    taper(mb, MARBLE, 8, pr + 0.15, ph, pr + 0.15, ph + 0.18, { phase: Math.PI / 8, vRepeat: 0.18 }); // its coping, over the wall
    ring(mb, MARBLE, 8, pr - 0.42, pr + 0.15, ph + 0.18, Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      // its inner face, over the bed
      const a0 = Math.PI / 8 + (i / 8) * Math.PI * 2,
        a1 = Math.PI / 8 + ((i + 1) / 8) * Math.PI * 2,
        am = (a0 + a1) / 2,
        ri = pr - 0.42;
      mb.quad(
        OCHRE,
        [Math.cos(a0) * ri, ph - 0.16, Math.sin(a0) * ri],
        [Math.cos(a1) * ri, ph - 0.16, Math.sin(a1) * ri],
        [Math.cos(a1) * ri, ph + 0.18, Math.sin(a1) * ri],
        [Math.cos(a0) * ri, ph + 0.18, Math.sin(a0) * ri],
        [-Math.cos(am), 0, -Math.sin(am)],
      );
    }
    cap(mb, BED, 8, pr - 0.42, ph - 0.16, 1, Math.PI / 8);
  });
  // the trunk: smooth, a little flared at its foot, leaning, to its fork (its levels and its lean in the tree's own metres)
  const height = within(r, G.height),
    fork = height * within(r, [0.32, 0.4]),
    lean = [within(r, [-0.35, 0.35]), within(r, [-0.35, 0.35])];
  const axisAt = (/** @type {number} */ y) => {
    const k = (y / fork) ** 2;
    return [lean[0] * k, y, lean[1] * k];
  };
  const trunk = [
    [0.4, 0.5],
    [1.1, 0.4],
    [fork * 0.6, 0.35],
    [fork, 0.31],
  ];
  column(
    mb,
    MH_BARK,
    trunk.map(([y, rad]) => [y * scale, rad * scale]),
    {
      sides: 7,
      flute: (i) => 1 + 0.04 * Math.sin(i * 2.3 + variant),
      axis: (y) => {
        const w = W(axisAt(y / scale));
        return [w[0], w[2]];
      },
    },
  );
  // the limbs from the fork, spreading and climbing, each with a twig off it; the crown's masses at their ends
  const [fx, , fz] = axisAt(fork),
    n = 3,
    a0 = r() * Math.PI * 2,
    crownR = height * 0.27;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + within(r, [-0.25, 0.25]),
      el = within(r, [0.62, 0.95]),
      len = within(r, [0.36, 0.46]) * height;
    const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
    const at = (/** @type {number} */ t, /** @type {number} */ sag = 0) => [
      fx + d[0] * len * t,
      fork + d[1] * len * t - sag,
      fz + d[2] * len * t,
    ];
    tube(
      mb,
      MH_BARK,
      [W([fx, fork - 0.3, fz]), W(at(0.35, len * 0.05)), W(at(0.7, len * 0.02)), W(at(1))],
      0.23 * scale,
      0.08 * scale,
      { sides: 5, segs: 3, tip: 0.2 },
    );
    const t0 = at(within(r, [0.5, 0.62])),
      ta = a + (r() < 0.5 ? 0.75 : -0.75),
      tl = len * 0.42;
    const T = (/** @type {number} */ u, /** @type {number} */ h) => [
      t0[0] + Math.cos(ta) * tl * u,
      t0[1] + tl * h,
      t0[2] + Math.sin(ta) * tl * u,
    ];
    tube(mb, MH_BARK, [W(t0), W(T(0.4, 0.15)), W(T(0.75, 0.4)), W(T(1, 0.55))], 0.1 * scale, 0.04 * scale, {
      sides: 4,
      segs: 2,
      tip: 0.1,
    });
    const end = at(1),
      twig = T(1, 0.55);
    leaves(mb, W([end[0], end[1] + 0.6, end[2]]), crownR * within(r, [0.82, 1]) * scale, variant * 8 + i, 1, 7);
    leaves(
      mb,
      W([twig[0], twig[1] + 0.4, twig[2]]),
      crownR * within(r, [0.58, 0.72]) * scale,
      variant * 8 + i + 4,
      0,
      4,
    );
  }
  leaves(mb, W([fx, height - crownR * 0.7, fz]), crownR * within(r, [0.95, 1.1]) * scale, variant * 8 + 7, 1, 9); // its crown's top over the fork
}
/** CAPITAL-TREES: a mass of a Mournhold tree's leaves at c (radius `rad`, its icosphere subdivided `detail` times - a
 *  twig's small mass the icosahedron), near round, and its `n` sprays, each two cards crossed (from the side a spray's
 *  face, never a card's edge across the crown) - its seed `k` - none hung lower than SPRAY_FLOOR over the ground (a
 *  walker's head and a rider's under them). */
function leaves(mb, c, rad, k, detail, n) {
  const m = mass(mb, MH_LEAVES, c, rad, { squash: 0.86, under: 0.72, push: 0.16, detail, seed: 0x5a50 + k * 131 });
  cards(mb, MH_SPRAY, m, {
    n,
    size: [3.4, 4.4],
    elev: [-0.95, 1.05],
    crossed: true,
    keep: (corners) => corners.every((p) => p[1] >= SPRAY_FLOOR),
  });
}
/** CAPITAL-TREES: the lowest a Mournhold tree's spray hangs, metres over the ground - over a rider (2.6 m, player/motor.js
 *  RIDE_HEIGHT) and every walker's head, so the gardens' paths stay open under its crowns. */
export const SPRAY_FLOOR = 2.8;
