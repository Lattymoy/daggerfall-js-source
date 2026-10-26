// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - MOURNHOLD'S LANDMARKS: the port's own models of the city's
// signatures (world/capitalPlans.js MOURNHOLD says where each stands) - TESA-LORE, on Tribunal's plan: Plaza Brindisi
// Dorom in the south, a garden behind its low ring wall round the great statue of Almalexia in battle with Mehrunes
// Dagon; the High Fane's great dome and its four pavilions in the Temple Courtyard at the north, its pools and braziers;
// the Royal Palace at the middle, its three domes and its four towers; the Great Bazaar's stalls in the east; the ochre
// walls with their domed towers - in metres, drawn as the map reads (+z south), every model's origin Mournhold's anchor
// on its ground. Shapes of the port's own in the spirit of the city's look. No game data.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, taper, ring, ledge, translated, wallRun, gatedRun, hall, darkDoor, entranceDoor, dome, blob, limb, outward, framed, robedFigure } from './capitalShapes.js';
import { MOURNHOLD } from './capitalPlans.js';
import { urbanArt } from './urban/urbanRecords.js';   // URBANIZER U2: the towns' own cut stone
/** URBANIZER U2 (world/urban/urbanArt.js): the Royal Palace's dressed ochre stone. */
const OCHRE_ASHLAR = urbanArt('ochreAshlar');

const OCHRE = art(CAPITAL_ART.ochre), BRONZE = art(CAPITAL_ART.bronze), GOLD = art(CAPITAL_ART.gold), CLOTH = art(CAPITAL_ART.cloth);
const MARBLE = art(CAPITAL_ART.marble), DARK = art(CAPITAL_ART.dark), TIMBER = art(CAPITAL_ART.timber), BLUE = art(CAPITAL_ART.blueSlate);

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
  const P = framed(x, z, face), k = h / 13;
  for (const side of [1, -1]) limb(mb, tex, P(-0.3 * k, side * 0.9 * k, y + 5.6 * k), P(side * 0.6 * k, side * 1.6 * k, y), 1.0 * k, 0.7 * k, { n: 8 });   // his legs
  const hip = P(0, 0, y + 5.6 * k), chest = P(1.1 * k, 0, y + 9.6 * k);
  limb(mb, tex, hip, chest, 1.5 * k, 2.2 * k, { n: 10 });
  blob(mb, tex, ...chest, 2.2 * k, 1.4 * k, 2.2 * k, { n: 10, rings: 5, rough: 0, seed: 0xda6 });   // his shoulders
  const head = P(1.6 * k, 0, y + 11.6 * k);
  blob(mb, tex, ...head, 0.95 * k, 1.05 * k, 0.95 * k, { n: 8, rings: 5, rough: 0, seed: 0xda7 });
  for (const side of [1, -1]) {
    const root = P(1.5 * k, side * 0.6 * k, y + 12.2 * k), bend = P(0.9 * k, side * 1.3 * k, y + 13.4 * k);
    limb(mb, tex, root, bend, 0.32 * k, 0.2 * k, { n: 6 });
    limb(mb, tex, bend, P(-0.2 * k, side * 1.5 * k, y + 13.9 * k), 0.2 * k, 0.03 * k, { n: 6 });   // his horns, swept back
  }
  const axeHand = P(1.6 * k, 2.6 * k, y + 14.2 * k);
  limb(mb, tex, P(1.0 * k, 2.0 * k, y + 10.4 * k), axeHand, 0.55 * k, 0.4 * k, { n: 6 });
  limb(mb, tex, P(0.6 * k, 2.6 * k, y + 12.4 * k), P(3.2 * k, 2.6 * k, y + 16.4 * k), 0.16 * k, 0.16 * k, { n: 6 });   // his axe's haft
  blob(mb, tex, ...P(2.9 * k, 2.6 * k, y + 15.8 * k), 1.1 * k, 0.9 * k, 0.18 * k, { n: 8, rings: 4, rough: 0, seed: 0xda8 });   // its head
  limb(mb, tex, P(1.0 * k, -2.0 * k, y + 10.4 * k), P(3.4 * k, -2.1 * k, y + 9.6 * k), 0.55 * k, 0.4 * k, { n: 6 });
  for (const side of [1, -1]) limb(mb, tex, P(0.9 * k, side * 1.6 * k, y + 8.4 * k), P(3.0 * k, side * 1.2 * k, y + 7.2 * k), 0.45 * k, 0.32 * k, { n: 6 });   // his lower arms
}

/**
 * PLAZA BRINDISI DOROM - TESA-LORE: "a public garden dominated by a great statue at its center" (UESP): the ring of the
 * garden's low wall about its middle, open on its four axes (west to Godsreach, east to the Great Bazaar, north to the
 * palace, south to the city's south gate); the great statue of Almalexia in battle with Mehrunes Dagon on its stepped
 * plinth - she on its east half with Hopesfire raised, he on its west with his axe, the two face to face.
 */
export function buildMournholdPlaza(M = MOURNHOLD) {
  const mb = new MeshBuilder(), P = M.plaza, half = Math.asin((P.gate / 2 + 0.2) / P.r), n = 48;
  for (let i = 0; i < n; i++) {
    let s = (i / n) * Math.PI * 2, e = ((i + 1) / n) * Math.PI * 2, skip = false;
    for (const ga of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI]) {
      if (s >= ga - half && e <= ga + half) skip = true;
      else if (s < ga + half && s > ga - half) s = ga + half;
      else if (e > ga - half && e < ga + half) e = ga - half;
    }
    if (skip || e <= s) continue;
    wallRun(mb, MARBLE, [P.x + Math.cos(s) * P.r, P.z + Math.sin(s) * P.r], [P.x + Math.cos(e) * P.r, P.z + Math.sin(e) * P.r], 1.2, P.ring, 1, 2);
  }
  const S = M.statue, y = S.plinthH;
  hall(mb, MARBLE, P.x, P.z, S.base, S.base, -1, 1.4, 0.25);
  hall(mb, MARBLE, P.x, P.z, S.plinth, S.plinth, 1.4, y, 0.25);
  dagonFigure(mb, BRONZE, P.x - 3, P.z, y, S.dagon, [1, 0]);
  robedFigure(mb, BRONZE, P.x + 3.2, P.z, y, S.almalexia, [-1, 0], 1);
  const k = S.almalexia / 6.5, hand = [P.x + 3.2 - 0.2 * k, y + 7.4 * k, P.z - 1.0 * k];
  limb(mb, GOLD, hand, [P.x + 3.2 - 2.4 * k, y + 9.2 * k, P.z - 1.1 * k], 0.14 * k, 0.03 * k, { n: 4 });   // Hopesfire
  return mb.build();
}

/**
 * THE HIGH FANE in the Temple Courtyard - TESA-LORE: the temple "in the center of a large and decorative courtyard, which
 * lies at the northern end of Mournhold" (UESP): a plinth of ochre, its great drum and dome of bronze with a gilt
 * lantern, four domed pavilions at the plinth's corners, its porch south to the courtyard and the palace, its door dark;
 * the courtyard's two long pools in their marble kerbs and its braziers along the way to the palace.
 */
export function buildHighFane(M = MOURNHOLD) {
  const mb = new MeshBuilder(), F = M.fane, y0 = F.plinthH;
  hall(mb, OCHRE, F.x, F.z, F.plinth, F.plinth, -3, y0, 0.2);
  translated(mb, F.x, 0, F.z, () => {
    taper(mb, OCHRE, 16, F.drumR, y0, F.drumR, y0 + F.drumH, { vRepeat: 6, uRepeat: 3 });
    ledge(mb, GOLD, 16, F.drumR + 0.6, F.drumR, y0 + F.drumH - 1, y0 + F.drumH);
  });
  const crown = y0 + F.drumH;
  dome(mb, BRONZE, F.x, crown, F.z, F.drumR, F.domeH, { n: 16, rings: 7 });
  translated(mb, F.x, crown + F.domeH - 0.3, F.z, () => { taper(mb, GOLD, 8, 2.6, 0, 2.6, 4, { vRepeat: 2 }); taper(mb, GOLD, 8, 2.8, 4, 0.05, 10, { vRepeat: 3 }); });
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const px = F.x + sx * F.pavilion, pz = F.z + sz * F.pavilion;
    translated(mb, px, 0, pz, () => taper(mb, OCHRE, 12, F.pavR, y0, F.pavR, y0 + F.pavH, { vRepeat: 6 }));
    dome(mb, BRONZE, px, y0 + F.pavH, pz, F.pavR, F.pavR, { n: 12, rings: 5 });
  }
  const pz = F.z + F.plinth / 2 + F.porch / 2;
  hall(mb, OCHRE, F.x, pz, F.porch * 0.9, F.porch, -3, y0 + 9, 0.2);
  darkDoor(mb, DARK, F.x, pz + F.porch / 2, 4.5, 7, [0, 1], y0);
  // the courtyard: its pools, each a water's face in a marble kerb, and its braziers - a pillar, a bronze bowl, its flame
  const C = M.court, [z0, z1] = C.poolZ;
  for (const px of C.pools) {
    for (const [cx, cz, w, d] of [[px, z0, C.poolW + 1, 1], [px, z1, C.poolW + 1, 1], [px - C.poolW / 2, (z0 + z1) / 2, 1, z1 - z0 + 1], [px + C.poolW / 2, (z0 + z1) / 2, 1, z1 - z0 + 1]]) hall(mb, MARBLE, cx, cz, w, d, -0.5, 0.7, 0.5);
    mb.quad(BLUE, [px - C.poolW / 2, 0.35, z0], [px + C.poolW / 2, 0.35, z0], [px + C.poolW / 2, 0.35, z1], [px - C.poolW / 2, 0.35, z1], [0, 1, 0]);
  }
  for (const bx of C.braziers) for (const bz of C.brazierZ) {
    translated(mb, bx, 0, bz, () => { taper(mb, MARBLE, 8, 0.8, -0.5, 0.55, C.brazierH, { vRepeat: 2 }); taper(mb, BRONZE, 8, 0.55, C.brazierH, 1.4, C.brazierH + 1, { vRepeat: 1 }); });
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
  const mb = new MeshBuilder(), P = M.palace;
  hall(mb, OCHRE_ASHLAR, P.x, P.z, P.w, P.d, -3, P.h, 0.2);   // URBANIZER U2: the palace in dressed ochre stone, the city's walls its rubble
  translated(mb, P.x, P.h - 1, P.z, () => mb.box(GOLD, [0, 0.5, 0], [P.w + 0.8, 1, P.d + 0.8], 0.5));
  for (const [dx, r] of [[0, P.domeR], [-P.w / 3, P.sideR], [P.w / 3, P.sideR]]) {
    translated(mb, P.x + dx, 0, P.z, () => taper(mb, OCHRE, 16, r, P.h, r, P.h + 3, { vRepeat: 3 }));
    dome(mb, BRONZE, P.x + dx, P.h + 3, P.z, r, r, { n: 16, rings: 6, onion: 0.2 });
  }
  for (const sx of [1, -1]) for (const sz of [1, -1]) domedTower(mb, P.x + sx * (P.w / 2 - P.tower), P.z + sz * (P.d / 2 + P.tower * 0.5), P.tower, P.towerH);
  darkDoor(mb, DARK, P.x, P.z + P.d / 2, 5, 7.5, [0, 1]);
  darkDoor(mb, DARK, P.x, P.z - P.d / 2, 5, 7.5, [0, -1]);
  return { ...mb.build(), doors: [entranceDoor(P.x, P.z + P.d / 2, 5, 7.5, [0, 1])] };   // WW7-4: the palace's halls, by its door to the plaza (world/capitalCastles.js)
}

/** THE GREAT BAZAAR: its stalls in rows, each a cloth awning on four poles sloping to its front - TESA-LORE: in the
 *  east, before its shops. */
export function buildGreatBazaar(M = MOURNHOLD) {
  const mb = new MeshBuilder(), B = M.bazaar;
  for (let c = 0; c < B.cols; c++) for (let r = 0; r < B.rows; r++) {
    const x = B.x - B.w / 2 + ((c + 0.5) * B.w) / B.cols, z = B.z - B.d / 2 + ((r + 0.5) * B.d) / B.rows, hw = B.stall / 2, hd = B.deep / 2;
    for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) mb.box(TIMBER, [x + px, B.poles / 2 + (pz < 0 ? 0.5 : 0), z + pz], [0.25, B.poles + (pz < 0 ? 1 : 0), 0.25], 1);
    const a = [x - hw - 0.3, B.poles + 1, z - hd - 0.3], b = [x + hw + 0.3, B.poles + 1, z - hd - 0.3], cc = [x + hw + 0.3, B.poles, z + hd + 0.3], d = [x - hw - 0.3, B.poles, z + hd + 0.3];
    const n = outward(a, b, cc, [x, 0, z]);
    mb.sheet(CLOTH, a, b, cc, d, n, [[0, 0], [B.stall / 8, 0], [B.stall / 8, -1], [0, -1]]);
  }
  return mb.build();
}

/** THE WALLS: a square of ochre round the city's six by six, a gate in each side's middle, domed round towers at its
 *  corners, by each gate and between. */
export function buildMournholdWall(M = MOURNHOLD) {
  const mb = new MeshBuilder(), W = M.wall, h = W.half;
  const C = [[h, -h], [-h, -h], [-h, h], [h, h]];   // north-east, north-west, south-west, south-east: their merlons outward
  for (let i = 0; i < 4; i++) gatedRun(mb, OCHRE, C[i], C[(i + 1) % 4], W.thick, W.h, h, W.gate, W.gateH);
  for (const [x, z] of mournholdTowers(W)) domedTower(mb, x, z, W.tower, W.towerH);
  return mb.build();
}
/** The wall's towers: its corners, a pair at each gate, and along each side between them. */
export function mournholdTowers(W = MOURNHOLD.wall) {
  const h = W.half, g = W.gate / 2 + W.tower + 0.5, out = [[h, -h], [-h, -h], [-h, h], [h, h]];
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const at = (s) => (ax ? [ax * h, s] : [s, az * h]);
    out.push(at(-g), at(g));
    for (let s = W.every; s < h - W.tower * 2; s += W.every) out.push(at(s + g), at(-s - g));
  }
  return out;
}
