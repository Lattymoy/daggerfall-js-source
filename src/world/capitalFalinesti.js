// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - FALINESTI'S LANDMARK: the Great Graht-Oak, the city's own tree
// (world/capitalPlans.js FALINESTI) - its trunk of bark from its roots to its limbs, the buttress roots spreading over
// the grounds at its foot, the great limbs reaching out over the city, the crown of leaves above every street, and the
// timber platforms round its trunk - in metres, drawn as the map reads (+z south), its origin the tree's axis on its
// ground. TESA-LORE: the city in its boughs - the walkway winding up the trunk from the ground to the highest platform,
// hide houses on every platform and at every limb's fork. Shapes of the port's own in the spirit of the walking city.
// No game data.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, ledge, blob, limb, rockColumn, jitter, taper, cap, translated, outward, hall, gableRoof, darkDoor, entranceDoor } from './capitalShapes.js';
import { FALINESTI } from './capitalPlans.js';

const BARK = art(CAPITAL_ART.bark), LEAVES = art(CAPITAL_ART.leaves), TIMBER = art(CAPITAL_ART.timber), HIDE = art(CAPITAL_ART.hide), DARK = art(CAPITAL_ART.dark);

/** The trunk's radius at height y: between its levels, straight. */
export function trunkRadius(y, F = FALINESTI) {
  const L = F.trunk;
  if (y <= L[0][0]) return L[0][1];
  for (let i = 0; i + 1 < L.length; i++) if (y <= L[i + 1][0]) return L[i][1] + ((L[i + 1][1] - L[i][1]) * (y - L[i][0])) / (L[i + 1][0] - L[i][0]);
  return L[L.length - 1][1];
}

/** TESA-LORE: the walkway's turn between two of its levels - from the ground to the first platform, then one platform to
 *  the next: a turn a level, starting where the last ended. Answers [angle, y] at t in [0, 1] of the whole climb. */
export function spiralAt(t, F = FALINESTI) {
  const levels = [0, ...F.platforms], n = levels.length - 1, u = Math.min(n, Math.max(0, t * n)), i = Math.min(n - 1, Math.floor(u)), f = u - i;
  return [(i + f) * Math.PI * 2, levels[i] + (levels[i + 1] - levels[i]) * f];
}
/** TESA-LORE: the walkway's inner edge at height y - clear of the trunk's roughest bark. */
export const spiralInner = (y, F = FALINESTI) => trunkRadius(y, F) + F.spiral.gap;

/** TESA-LORE: A HIDE HOUSE at (x, y, z): a cone of hide on its poles, `r` across its foot, `h` to its peak, the poles'
 *  ends out of its top. */
export function hideHut(mb, x, y, z, r, h) {
  translated(mb, x, y, z, () => {
    taper(mb, HIDE, 8, r, 0, 0.12, h, { vRepeat: 2 });
    taper(mb, TIMBER, 4, 0.18, h - 0.2, 0.02, h + 0.9, { vRepeat: 1 });
  });
}

/**
 * THE GREAT GRAHT-OAK: its trunk through its levels; its buttress roots, each bending down from the trunk's foot to the
 * ground; its limbs out and up from the trunk's top half, each ending in a cluster of leaves; the crown's clusters over
 * the city, the greatest over the trunk; the platforms round the trunk, each a ring of planks with its rail.
 */
export function buildGrahtOak(F = FALINESTI) {
  const mb = new MeshBuilder();
  rockColumn(mb, BARK, LEAVES, 0, 0, 16, F.trunk.map(([y, r]) => [y, r]), { rough: 2.5, seed: 0xfa1 });
  for (let i = 0; i < F.roots; i++) {
    const a = rootAngle(i, F), c = Math.cos(a), s = Math.sin(a);   // AUDIT TESA II C4: on the arc the walkway's first rise has cleared
    const top = [c * trunkRadius(6) * 0.7, 9, s * trunkRadius(6) * 0.7], bend = [c * (F.rootOut * 0.6), 2.5, s * (F.rootOut * 0.6)], end = [c * F.rootOut, -1.5, s * F.rootOut];
    limb(mb, BARK, top, bend, 7, 4.5, { n: 8 });
    limb(mb, BARK, bend, end, 4.5, 1.2, { n: 7 });
  }
  const tips = [];
  for (let i = 0; i < F.limbs; i++) {
    const a = (i / F.limbs) * Math.PI * 2 + 0.35, c = Math.cos(a), s = Math.sin(a), k = jitter(0xfa3, i);
    const y0 = F.limbFrom[0] + (F.limbFrom[1] - F.limbFrom[0]) * k, out = F.limbOut[0] + (F.limbOut[1] - F.limbOut[0]) * jitter(0xfa4, i);
    const y1 = F.limbTop[0] + (F.limbTop[1] - F.limbTop[0]) * jitter(0xfa5, i), r0 = trunkRadius(y0) * 0.45;
    const from = [c * trunkRadius(y0) * 0.6, y0, s * trunkRadius(y0) * 0.6], mid = [c * out * 0.55, (y0 + y1) / 2 + 6, s * out * 0.55], tip = [c * out, y1, s * out];
    limb(mb, BARK, from, mid, r0, r0 * 0.6, { n: 8 });
    limb(mb, BARK, mid, tip, r0 * 0.6, r0 * 0.25, { n: 7 });
    tips.push(tip);
  }
  // the crown: a cluster at every limb's end, more between them round the crown's circle, the greatest over the trunk
  tips.forEach(([x, y, z], i) => blob(mb, LEAVES, x, y + 6, z, 46, 22, 46, { seed: 0xfb0 + i }));
  const ring = F.crown.blobs - tips.length - 1;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2, r = F.crown.r * (0.45 + 0.5 * jitter(0xfb1, i)), y = F.crown.y + (jitter(0xfb2, i) - 0.5) * 24;
    blob(mb, LEAVES, Math.cos(a) * r, y, Math.sin(a) * r, 40, 20, 40, { seed: 0xfc0 + i });
  }
  blob(mb, LEAVES, 0, F.crown.y + 16, 0, 70, 30, 70, { seed: 0xfd0, n: 12 });
  for (const y of F.platforms) {
    const r = trunkRadius(y) + 1.5;
    ledge(mb, TIMBER, PLATFORM_SIDES, r + F.platformW, r - 2, y - 0.7, y, 0, platformOpen(F));   // AUDIT TESA II C4: open over the walkway's last rise to it
    ledge(mb, TIMBER, PLATFORM_SIDES, r + F.platformW, r + F.platformW - 0.3, y, y + 1.1);
    // TESA-LORE: its hide houses round it, between the walkway's landing and the rail - AUDIT TESA II C4: round from the
    // landing, the last short of the open arc
    for (let i = 0; i < F.huts; i++) { const a = hutAngle(i, F), d = r + F.hutAt; hideHut(mb, Math.cos(a) * d, y, Math.sin(a) * d, F.hutR, F.hutH); }
  }
  // TESA-LORE: the walkway winding up the trunk - its deck, its outer face and its rail, a turn from the ground to each platform
  const S = F.spiral, N = S.steps * F.platforms.length;
  for (let i = 0; i < N; i++) {
    const [a0, y0] = spiralAt(i / N), [a1, y1] = spiralAt((i + 1) / N), ri0 = spiralInner(y0), ri1 = spiralInner(y1);
    const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const d = [P(a0, ri0, y0), P(a1, ri1, y1), P(a1, ri1 + S.w, y1), P(a0, ri0 + S.w, y0)];
    mb.quad(TIMBER, d[0], d[1], d[2], d[3], outward(d[0], d[1], d[2], [0, -1e4, 0]), [[0, 0], [1, 0], [1, -0.5], [0, -0.5]]);
    mb.quad(TIMBER, d[0], d[3], d[2], d[1], outward(d[0], d[3], d[2], [0, 1e4, 0]), [[0, 0], [0.5, 0], [0.5, -1], [0, -1]]);
    const o0 = P(a0, ri0 + S.w, y0), o1 = P(a1, ri1 + S.w, y1), out = outward(o0, o1, [o1[0], y1 + S.rail, o1[2]], [0, (y0 + y1) / 2, 0]);
    mb.quad(TIMBER, [o0[0], y0 - 0.4, o0[2]], [o1[0], y1 - 0.4, o1[2]], [o1[0], y1 + S.rail, o1[2]], [o0[0], y0 + S.rail, o0[2]], out);
  }
  // TESA-LORE: a deck at every limb's fork, its two hide houses on it
  for (const [x, y, z] of limbForks(F)) {
    translated(mb, x, y, z, () => { cap(mb, TIMBER, 12, F.forkDeck, 0); cap(mb, TIMBER, 12, F.forkDeck, -0.6, -1); ledge(mb, TIMBER, 12, F.forkDeck, F.forkDeck - 0.3, -0.6, 0); });
    const a = Math.atan2(z, x) + Math.PI / 2;
    for (const s of [1, -1]) hideHut(mb, x + Math.cos(a) * s * F.forkDeck * 0.55, y, z + Math.sin(a) * s * F.forkDeck * 0.55, F.hutR * 0.85, F.hutH * 0.85);
  }
  // WW7-4: THE TREE'S HALLS - a timber porch into the trunk's foot on the north, between two roots and under the
  // walkway's first turn, its door the castle's (world/capitalCastles.js)
  const G = F.porch, gz = -(trunkRadius(0) + G.d / 2 - G.into);
  hall(mb, TIMBER, 0, gz, G.w, G.d, -1, G.h);
  gableRoof(mb, HIDE, TIMBER, 0, gz, G.w, G.d, G.h, G.roof, { alongX: false });   // hide over it, as the houses' (its timber the decks')
  darkDoor(mb, DARK, 0, gz - G.d / 2, G.door[0], G.door[1], [0, -1]);
  return { ...mb.build(), doors: [entranceDoor(0, gz - G.d / 2, G.door[0], G.door[1], [0, -1])] };
}
/** AUDIT TESA II C4: a platform's sides, and the ones left open - every side whose middle lies within `platformGap` before
 *  the landing (the walkway reaches each platform at a whole turn, its angle 0). */
export const PLATFORM_SIDES = 24;
export const platformOpen = (F = FALINESTI) => (/** @type {number} */ i) => ((i + 0.5) / PLATFORM_SIDES) * Math.PI * 2 > Math.PI * 2 - F.platformGap;
/** AUDIT TESA II C4: a hut's angle on its platform - round from the landing, the last short of the open arc. */
export const hutAngle = (i, F = FALINESTI) => F.hutFrom + (i / F.huts) * Math.PI * 2;
/** AUDIT TESA II C4: a buttress root's angle - spread over `rootArc`, a little jittered. */
export const rootAngle = (i, F = FALINESTI) => F.rootArc[0] + ((i + 0.5) / F.roots) * (F.rootArc[1] - F.rootArc[0]) + (jitter(0xfa2, i) - 0.5) * 0.1;
/** TESA-LORE: each limb's fork - its middle joint, where it bends up toward its tip - the deck's top a little under it. */
export function limbForks(F = FALINESTI) {
  return Array.from({ length: F.limbs }, (_, i) => {
    const a = (i / F.limbs) * Math.PI * 2 + 0.35, k = jitter(0xfa3, i), y0 = F.limbFrom[0] + (F.limbFrom[1] - F.limbFrom[0]) * k;
    const out = F.limbOut[0] + (F.limbOut[1] - F.limbOut[0]) * jitter(0xfa4, i), y1 = F.limbTop[0] + (F.limbTop[1] - F.limbTop[0]) * jitter(0xfa5, i);
    return [Math.cos(a) * out * 0.55, (y0 + y1) / 2 + 6 - trunkRadius(y0) * 0.45, Math.sin(a) * out * 0.55];
  });
}
