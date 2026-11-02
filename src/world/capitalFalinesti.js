// @ts-check
// TESA10c (bible/03-World/Arena-Provinces.md TESA10c) - FALINESTI'S LANDMARK: the Great Graht-Oak, the city's own tree
// (world/capitalPlans.js FALINESTI) - its trunk of bark from its roots to its limbs, the buttress roots spreading over
// the grounds at its foot, the great limbs reaching out over the city, the crown of leaves above every street, and the
// timber platforms round its trunk - in metres, drawn as the map reads (+z south), its origin the tree's axis on its
// ground. TESA-LORE: the city in its boughs - the walkway winding up the trunk from the ground to the highest platform,
// hide houses on every platform and at every limb's fork. Shapes of the port's own in the spirit of the walking city.
// No game data.
// CAPITAL-TREES (bible/03-World/Arena-Provinces.md CAPITAL-TREES; KPbICA, forwarded by the owner: "The main trees in
// Falinesti and Mournhold should get some love. They are too draftish for now"): THE OAK FINISHED, on the capitals'
// trees' kit (world/capitalTrees.js - the forests' own graht-oaks' shapes, world/jungle/grahtOakMesh.js) - its trunk
// fluted and twisting, its leader on into the crown; a dozen buttresses of living wood all round its foot, each under the
// walkway climbing over it; living boughs carrying every platform, their leaves the crown's lower storeys; nine great
// limbs, each carrying its fork's deck and forking twice on to its leaves; the crown in masses with flat undersides,
// leaf sprays standing out of them and lianas hung from the limbs; the walkway's deck run into the bark, its stringer, its
// rail both sides, its posts and the knees of living wood under it; the platforms' rails both sides on their posts; the
// hide houses on their lashing, their poles out of their tops, their doors to the trunk.
import { MeshBuilder } from './detStandIns.js';
import {
  CAPITAL_ART,
  art,
  ring,
  cap,
  taper,
  jitter,
  translated,
  outward,
  hall,
  gableRoof,
  darkDoor,
  entranceDoor,
} from './capitalShapes.js';
import { FALINESTI } from './capitalPlans.js';
import { column, tube, buttress, mass, cards, liana, treeRng, within, bezier } from './capitalTrees.js';
import { SPRAY_TEXELS, LIANA_U0 } from './capitalTreeArt.js';

const BARK = art(CAPITAL_ART.grahtBark),
  LEAVES = art(CAPITAL_ART.grahtLeaves),
  SPRAY = art(CAPITAL_ART.grahtSpray);
const TIMBER = art(CAPITAL_ART.timber),
  HIDE = art(CAPITAL_ART.hide),
  DARK = art(CAPITAL_ART.dark);

/** The trunk's radius at height y: between its levels, straight. */
export function trunkRadius(y, F = FALINESTI) {
  const L = F.trunk;
  if (y <= L[0][0]) return L[0][1];
  for (let i = 0; i + 1 < L.length; i++)
    if (y <= L[i + 1][0]) return L[i][1] + ((L[i + 1][1] - L[i][1]) * (y - L[i][0])) / (L[i + 1][0] - L[i][0]);
  return L[L.length - 1][1];
}

/** TESA-LORE: the walkway's turn between two of its levels - from the ground to the first platform, then one platform to
 *  the next: a turn a level, starting where the last ended. Answers [angle, y] at t in [0, 1] of the whole climb. */
export function spiralAt(t, F = FALINESTI) {
  const levels = [0, ...F.platforms],
    n = levels.length - 1,
    u = Math.min(n, Math.max(0, t * n)),
    i = Math.min(n - 1, Math.floor(u)),
    f = u - i;
  return [(i + f) * Math.PI * 2, levels[i] + (levels[i + 1] - levels[i]) * f];
}
/** TESA-LORE: the walkway's inner edge at height y - clear of the trunk's roughest bark. */
export const spiralInner = (y, F = FALINESTI) => trunkRadius(y, F) + F.spiral.gap;
/** CAPITAL-TREES: the walkway's height over the angle `a` (radians, its own turn's law: 0 the landing) on its turn from
 *  `level` (the ground or a platform) to the next - the first turn's, or any. */
export const walkwayOver = (a, level = 0, F = FALINESTI) => {
  const L = [0, ...F.platforms],
    k = L.indexOf(level);
  return L[k] + (L[k + 1] - L[k]) * ((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI));
};

/** CAPITAL-TREES: A BAND - a ring of timber between radii rIn and rOut from y0 to y1, its outer and inner faces, its top
 *  and its foot (a rail seen from either side), `skip(i)` the sides left open. */
function band(mb, tex, n, rOut, rIn, y0, y1, skip = null) {
  taper(mb, tex, n, rOut, y0, rOut, y1, { vRepeat: Math.max(0.5, y1 - y0), skip });
  for (let i = 0; i < n; i++) {
    // its inner face, toward the axis
    if (skip?.(i)) continue;
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2,
      am = (a0 + a1) / 2;
    const P = (a, y) => [Math.cos(a) * rIn, y, Math.sin(a) * rIn];
    mb.quad(tex, P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1), [-Math.cos(am), 0, -Math.sin(am)]);
  }
  ring(mb, tex, n, rIn, rOut, y1, 0, skip);
  ring(mb, tex, n, rIn, rOut, y0, 0, skip);
}

/** TESA-LORE: A HIDE HOUSE at (x, y, z): a cone of hide on its poles, `r` across its foot, `h` to its peak, the poles'
 *  ends out of its top. CAPITAL-TREES: lashed at its foot with a band of timber, its four poles crossing out of its top,
 *  its door a dark flap on its face toward `face` (radians - the trunk's way). */
export function hideHut(mb, x, y, z, r, h, face = 0) {
  translated(mb, x, y, z, () => {
    taper(mb, HIDE, 10, r, 0, 0.14, h, { vRepeat: 2 });
    taper(mb, TIMBER, 10, r + 0.06, 0, r + 0.06, 0.32, { vRepeat: 0.32 }); // its lashing
    ring(mb, TIMBER, 10, r - 0.2, r + 0.06, 0.32);
    for (let k = 0; k < 4; k++) {
      // the poles, crossing at its peak and out of it
      const a = (k / 4) * Math.PI * 2 + 0.4;
      tube(
        mb,
        TIMBER,
        [
          [-Math.cos(a) * 0.5, h - 1.4, -Math.sin(a) * 0.5],
          [-Math.cos(a) * 0.2, h - 0.6, -Math.sin(a) * 0.2],
          [Math.cos(a) * 0.2, h + 0.4, Math.sin(a) * 0.2],
          [Math.cos(a) * 0.55, h + 1.1, Math.sin(a) * 0.55],
        ],
        0.11,
        0.06,
        { sides: 3, segs: 2 },
      );
    }
    // the door: a flap of the cone's own face, darkened, a hair proud of it
    const at = (a, yy, e) => {
      const rr = r + ((0.14 - r) * yy) / h + e;
      return [Math.cos(a) * rr, yy, Math.sin(a) * rr];
    };
    const w = 0.24,
      dh = Math.min(1.9, h * 0.42);
    const k = (r - 0.14) / h,
      nl = Math.hypot(1, k);
    mb.quad(
      DARK,
      at(face - w, 0.34, 0.05),
      at(face + w, 0.34, 0.05),
      at(face + w * 0.7, dh, 0.05),
      at(face - w * 0.7, dh, 0.05),
      [Math.cos(face) / nl, k / nl, Math.sin(face) / nl],
    );
  });
}

/**
 * THE GREAT GRAHT-OAK: its trunk through its levels; its buttress roots, each bending down from the trunk's foot to the
 * ground; its limbs out and up from the trunk's top half, each ending in a cluster of leaves; the crown's clusters over
 * the city, the greatest over the trunk; the platforms round the trunk, each a ring of planks with its rail.
 * CAPITAL-TREES: each part on the kit (world/capitalTrees.js) - grahtTrunk, grahtRoots, platformBoughs and crownLimbs
 * below say where each stands; the walkway and the platforms keep AUDIT TESA II C4's clearances.
 */
export function buildGrahtOak(F = FALINESTI) {
  const mb = new MeshBuilder();
  grahtTrunk(mb, F);
  for (const R of grahtRoots(F)) {
    const { foot } = buttress(mb, BARK, {
      angle: R.angle,
      inner: R.inner,
      reach: R.reach,
      top: R.top,
      sink: 2,
      thick: F.rootThick,
      snake: R.snake,
    });
    // the surface root on past its foot, half sunk, winding off the buttress's line
    const a0 = R.angle,
      a1 = R.angle + R.turn,
      f0 = [foot[0], 0.2, foot[1]];
    tube(
      mb,
      BARK,
      [
        f0,
        [f0[0] + Math.cos(a0) * R.run * 0.4, 0.5, f0[2] + Math.sin(a0) * R.run * 0.4],
        [f0[0] + Math.cos(a1) * R.run * 0.75, 0.3, f0[2] + Math.sin(a1) * R.run * 0.75],
        [f0[0] + Math.cos(a1) * R.run, -0.8, f0[2] + Math.sin(a1) * R.run],
      ],
      1.4,
      0.45,
      { sides: 6, segs: 4, tip: 1 },
    );
  }
  const r = treeRng(0x9a3f);
  // THE BOUGHS that carry the platforms, each forking twice near its end
  for (const B of platformBoughs(F)) {
    tube(mb, BARK, B.path, 3.6, 1.1, { sides: 8, segs: 6, tip: 1.5 });
    for (const f of B.forks) tube(mb, BARK, f, 1.4, 0.4, { sides: 6, segs: 4, tip: 0.8 });
    const hang = bezier(B.path, 0.86);
    liana(mb, SPRAY, [hang[0], hang[1] - 1.2, hang[2]], within(r, [7, 12]), 1.7, r() * Math.PI, LIANA_UV);
  }
  // THE LIMBS: each from the trunk to its fork's deck, on past it to its tip, forking twice
  for (const L of crownLimbs(F)) {
    tube(mb, BARK, L.inPath, L.r0, L.rFork, { sides: 10, segs: 6 });
    tube(mb, BARK, L.outPath, L.rFork, 1.0, { sides: 9, segs: 7, tip: 2 });
    for (const f of L.forks) tube(mb, BARK, f.path, f.r0, 0.6, { sides: 7, segs: 5, tip: 1.5 });
    for (let i = 0; i < 2; i++) {
      // its lianas, hung from its outer half over the city
      const p = bezier(L.outPath, within(r, [0.3, 0.85]));
      liana(mb, SPRAY, [p[0], p[1] - L.rFork * 0.4, p[2]], within(r, [14, 30]), 1.7, r() * Math.PI, LIANA_UV);
    }
  }
  // THE CROWN: its masses of leaves and their sprays, storey by storey (grahtCrown) - no spray where the city lives
  const clear = oakClear(F),
    keep = (c) => [...c, mid4(c), mid2(c[0], c[1]), mid2(c[1], c[2]), mid2(c[2], c[3]), mid2(c[3], c[0])].every(clear);
  for (const M of grahtCrown(F)) {
    const m = mass(mb, LEAVES, M.c, M.r, { squash: M.squash, under: 0.55, push: 0.18, detail: M.detail, seed: M.seed });
    cards(mb, SPRAY, m, { n: M.cards, size: M.size, u: [0, LIANA_U0], aspect: LIANA_U0, keep });
  }
  // THE PLATFORMS: a deck of planks round the trunk on its boughs, open over the walkway's last rise to it; its fascia;
  // its rail on posts, both faces; its hide houses
  for (const y of F.platforms) {
    const rr = trunkRadius(y) + 1.5;
    taper(mb, TIMBER, PLATFORM_SIDES, rr + F.platformW, y - 0.7, rr + F.platformW, y, { vRepeat: 0.7 }); // its fascia
    ring(mb, TIMBER, PLATFORM_SIDES, rr - 2, rr + F.platformW, y, 0, platformOpen(F)); // AUDIT TESA II C4: open over the walkway's last rise to it
    ring(mb, TIMBER, PLATFORM_SIDES, rr - 2, rr + F.platformW, y - 0.7, 0, platformOpen(F));
    band(mb, TIMBER, PLATFORM_SIDES, rr + F.platformW, rr + F.platformW - 0.3, y, y + 1.1);
    for (let i = 0; i < PLATFORM_SIDES; i++) {
      const a = (i / PLATFORM_SIDES) * Math.PI * 2,
        d = rr + F.platformW - 0.15;
      mb.box(TIMBER, [Math.cos(a) * d, y + 0.7, Math.sin(a) * d], [0.42, 1.4, 0.42], 0.5);
    } // its posts
    // TESA-LORE: its hide houses round it, between the walkway's landing and the rail - AUDIT TESA II C4: round from the
    // landing, the last short of the open arc
    for (let i = 0; i < F.huts; i++) {
      const a = hutAngle(i, F),
        d = rr + F.hutAt;
      hideHut(mb, Math.cos(a) * d, y, Math.sin(a) * d, F.hutR, F.hutH, a + Math.PI);
    }
  }
  // TESA-LORE: the walkway winding up the trunk - its deck, its outer face and its rail, a turn from the ground to each
  // platform. CAPITAL-TREES: its deck run into the bark (no gap at its inner edge), its underside, its stringer, its rail
  // seen from both sides on posts every `post` steps, and a knee of living wood under its outer edge every `knee` steps
  // where the turn is high enough over its own landing for one
  const S = F.spiral,
    N = S.steps * F.platforms.length,
    P = (a, rad, y) => [Math.cos(a) * rad, y, Math.sin(a) * rad];
  for (let i = 0; i < N; i++) {
    const [a0, y0] = spiralAt(i / N),
      [a1, y1] = spiralAt((i + 1) / N),
      ri0 = spiralInner(y0),
      ri1 = spiralInner(y1);
    const b0 = trunkRadius(y0) * 0.97,
      b1 = trunkRadius(y1) * 0.97,
      o0 = ri0 + S.w,
      o1 = ri1 + S.w;
    mb.quad(
      TIMBER,
      P(a0, b0, y0),
      P(a1, b1, y1),
      P(a1, o1, y1),
      P(a0, o0, y0),
      outward(P(a0, b0, y0), P(a1, b1, y1), P(a1, o1, y1), [0, -1e4, 0]),
      [
        [0, 0],
        [1, 0],
        [1, -0.5],
        [0, -0.5],
      ],
    );
    mb.quad(
      TIMBER,
      P(a0, b0, y0 - 0.35),
      P(a0, o0, y0 - 0.35),
      P(a1, o1, y1 - 0.35),
      P(a1, b1, y1 - 0.35),
      outward(P(a0, b0, y0 - 0.35), P(a0, o0, y0 - 0.35), P(a1, o1, y1 - 0.35), [0, 1e4, 0]),
    ); // its underside
    mb.sheet(
      TIMBER,
      P(a0, o0, y0 - 0.5),
      P(a1, o1, y1 - 0.5),
      P(a1, o1, y1 + S.rail),
      P(a0, o0, y0 + S.rail),
      outward(P(a0, o0, y0), P(a1, o1, y1), P(a1, o1, y1 + S.rail), [0, (y0 + y1) / 2, 0]),
    ); // its rail, both faces
    if (i % S.post === 0)
      mb.box(
        TIMBER,
        [Math.cos(a0) * o0, y0 + (S.rail - 0.6) / 2 + 0.1, Math.sin(a0) * o0],
        [0.36, S.rail + 0.8, 0.36],
        0.5,
      );
    const over = y0 - [0, ...F.platforms][Math.floor((i / N) * F.platforms.length)];
    if (i % S.knee === S.knee / 2 && over > S.kneeOver) {
      const am = (a0 + a1) / 2,
        ym = (y0 + y1) / 2;
      tube(
        mb,
        BARK,
        [
          P(am, trunkRadius(ym - 7) * 0.9, ym - 7),
          P(am, trunkRadius(ym) + 1.2, ym - 4.5),
          P(am, (ri0 + o0) / 2, ym - 1.6),
          P(am, o0 - 0.4, ym - 0.5),
        ],
        0.75,
        0.32,
        { sides: 5, segs: 3 },
      );
    }
  }
  // TESA-LORE: a deck at every limb's fork, its two hide houses on it - CAPITAL-TREES: on the limb, its rail on its rim
  for (const [x, y, z] of limbForks(F)) {
    translated(mb, x, y, z, () => {
      cap(mb, TIMBER, 12, F.forkDeck, 0);
      cap(mb, TIMBER, 12, F.forkDeck, -0.6, -1);
      taper(mb, TIMBER, 12, F.forkDeck, -0.6, F.forkDeck, 0, { vRepeat: 0.6 });
      band(mb, TIMBER, 12, F.forkDeck, F.forkDeck - 0.25, 0, 0.9);
    });
    const a = Math.atan2(z, x) + Math.PI / 2;
    for (const s of [1, -1])
      hideHut(
        mb,
        x + Math.cos(a) * s * F.forkDeck * 0.55,
        y,
        z + Math.sin(a) * s * F.forkDeck * 0.55,
        F.hutR * 0.85,
        F.hutH * 0.85,
        a + (s > 0 ? Math.PI : 0),
      );
  }
  // WW7-4: THE TREE'S HALLS - a timber porch into the trunk's foot on the north, between two roots and under the
  // walkway's first turn, its door the castle's (world/capitalCastles.js)
  const G = F.porch,
    gz = -(trunkRadius(0) + G.d / 2 - G.into);
  hall(mb, TIMBER, 0, gz, G.w, G.d, -1, G.h);
  gableRoof(mb, HIDE, TIMBER, 0, gz, G.w, G.d, G.h, G.roof, { alongX: false }); // hide over it, as the houses' (its timber the decks')
  darkDoor(mb, DARK, 0, gz - G.d / 2, G.door[0], G.door[1], [0, -1]);
  return { ...mb.build(), doors: [entranceDoor(0, gz - G.d / 2, G.door[0], G.door[1], [0, -1])] };
}
/** CAPITAL-TREES: a liana's texture coordinates on the spray's picture - its last quarter, repeated down every so many
 *  metres that its texels stand square (the picture's 128 rows over the strip's 32 columns' 1.7 m). */
const LIANA_UV = Object.freeze({
  u: Object.freeze([LIANA_U0, 1]),
  per: (1.7 * SPRAY_TEXELS.graht.h) / (SPRAY_TEXELS.graht.w * (1 - LIANA_U0)),
});

/**
 * CAPITAL-TREES: THE TRUNK - a fluted column through the trunk's levels (trunkRadius's own, so the walkway's law reads the
 * column it climbs), a ring every few metres, its furrows every third corner and its ridges between, twisting as it
 * rises; on through the leader into the crown's cap, closed to a point there.
 */
function grahtTrunk(mb, F) {
  const B = F.bark,
    levels = [];
  for (const y of [-3, 0, 3, 7, 12, 18, 25, 32, 40, 48, 56, 64, 72, 81, 90, 99, 108, 117, 126, 135, 144, 153, 162, 170])
    levels.push([y, trunkRadius(y, F)]);
  levels.push(...B.leader);
  const flute = (i, y) =>
    (i % 3 === 0 ? 1 - B.furrow : 1 + B.ridge * (i % 3 === 1 ? 1 : 0.6)) * (1 + 0.012 * Math.sin(y * 0.21 + i * 0.7));
  column(mb, BARK, levels, { sides: B.sides, flute, twist: B.twist, crown: 8 });
}

/** AUDIT TESA II C4 / CAPITAL-TREES: the buttresses' angles - spread over `rootArc`, a little jittered, and none on the
 *  porch: the two nearest it stood `rootPorch` either side of north. */
export function rootAngle(i, F = FALINESTI) {
  const a = F.rootArc[0] + ((i + 0.5) / F.roots) * (F.rootArc[1] - F.rootArc[0]) + (jitter(0xfa2, i) - 0.5) * 0.1,
    north = 1.5 * Math.PI;
  return Math.abs(a - north) < F.rootPorch ? north + Math.sign(a - north || 1) * F.rootPorch : a;
}
/**
 * CAPITAL-TREES: THE BUTTRESSES - each at its angle (rootAngle), from inside the trunk out to its reach: its top on the
 * trunk the lower of `rootTop` and the walkway's first turn over it less `rootUnder` (so the walkway climbs over every
 * one, never through it - its first rise from the ground over the smallest), reaching farther the taller it stands; the
 * surface root on past its foot. None where the walkway is too low over the ground for one (a top under 2 m).
 */
export function grahtRoots(F = FALINESTI) {
  const out = [];
  for (let i = 0; i < F.roots; i++) {
    const angle = rootAngle(i, F),
      top = Math.min(F.rootTop, walkwayOver(angle, 0, F) - F.rootUnder);
    if (top < 2) continue;
    const k = Math.min(1, top / F.rootTop);
    out.push({
      angle,
      top,
      inner: trunkRadius(top * 0.5, F) * 0.8,
      reach: F.rootOut - (1 - k) * 18,
      snake: (jitter(0xfa6, i) - 0.5) * 6,
      turn: (jitter(0xfa7, i) - 0.5) * 0.9,
      run: 8 + jitter(0xfa8, i) * 7,
    });
  }
  return out;
}
/**
 * CAPITAL-TREES: THE BOUGHS CARRYING EACH PLATFORM - `boughs` of them on `boughArc` of its turn (the walkway climbing to
 * the platform is more than 2 m under their wood there), each from inside the trunk `boughDrop` under the deck, under the
 * deck to past its rail (its wood under the deck's underside all the way), then up and out to its leaves `boughOut` past
 * the trunk and `boughRise` over the deck; and one bough OVER the deck at `boughOver` (the walkway's last rise under the
 * platform there, its next turn far over it), from the trunk `boughLift` over the deck - over the houses' poles and a
 * body's head - out past the rail to its leaves, so the crown's lower storeys stand all round the trunk. Each {its
 * angle, its platform, its Bezier, its two forks' Beziers, its index, `over`}.
 */
export function platformBoughs(F = FALINESTI) {
  const out = [];
  F.platforms.forEach((y, p) => {
    const tr = trunkRadius(y, F);
    for (let j = 0; j <= F.boughs; j++) {
      const k = p * (F.boughs + 1) + j,
        over = j === F.boughs,
        [lo, hi] = F.boughArc;
      const angle = over
        ? F.boughOver + (jitter(0xfb1, k) - 0.5) * 0.3
        : Math.min(hi, Math.max(lo, lo + ((j + 0.5) / F.boughs) * (hi - lo) + (jitter(0xfb1, k) - 0.5) * 0.4));
      const c = Math.cos(angle),
        s = Math.sin(angle),
        reach = tr + F.boughOut[0] + (F.boughOut[1] - F.boughOut[0]) * jitter(0xfb2, k);
      const rise = F.boughRise[0] + (F.boughRise[1] - F.boughRise[0]) * jitter(0xfb3, k),
        Q = (d, h) => [c * d, h, s * d];
      const path = over
        ? [
            Q(tr * 0.5, y + F.boughLift - 3),
            Q(tr + 6, y + F.boughLift + 0.5),
            Q(tr + 22, y + F.boughLift + 1.5),
            Q(reach, y + F.boughLift + rise * 0.8),
          ]
        : [Q(tr * 0.5, y - F.boughDrop), Q(tr + 6, y - 4.6), Q(tr + 24, y - 3.8), Q(reach, y + rise)];
      const forks = [1, -1].map((side, i) => {
        // its two forks off its outer run, up and to either side
        const from = bezier(path, 0.72),
          fa = angle + side * (0.32 + 0.23 * jitter(0xfb4, k, i)),
          len = 12 + 5 * jitter(0xfb5, k, i);
        const P = (u, h) => [from[0] + Math.cos(fa) * len * u, from[1] + len * h, from[2] + Math.sin(fa) * len * u];
        return [from, P(0.4, 0.08), P(0.75, 0.3), P(1, 0.42)];
      });
      out.push({ k, angle, level: y, path, forks, over });
    }
  });
  return out;
}
/** The fork decks' measures every crown mass keeps clear of: a deck's own radius and this much more about it, and from
 *  this far under its top to its houses' poles' tops and this much over them. */
const DECK_CLEAR = Object.freeze({ side: 1.5, under: 1, over: 2 });
/**
 * CAPITAL-TREES: THE CROWN, storey by storey - every mass of leaves as {c, r, squash, cards, size, seed, detail}: each
 * bough's (a clump at its end, one at each fork's end - the crown's lower storeys, about the platforms, outside their
 * rails); each great limb's (a clump of three at its tip, one over its outer run, two at each fork's end); the masses
 * between the limbs over their decks; and the cap over the leader, the greatest, its highest. Every mass is lifted clear
 * of the fork decks' houses (DECK_CLEAR) where it would stand among them - its underside's own curve over the deck.
 */
export function grahtCrown(F = FALINESTI) {
  const out = [],
    r = treeRng(0x9a60);
  const add = (c, rad, squash, cards, size, detail = 1) =>
    out.push({ c, r: rad, squash, cards, size, seed: 0x6a70 + out.length * 7, detail });
  for (const B of platformBoughs(F)) {
    // along its outer run and at its end, and at each fork's end
    for (const t of [0.78, 1]) {
      const p = bezier(B.path, t);
      add(
        [p[0], p[1] + within(r, [2, 3.5]), p[2]],
        within(r, [10, 13]) * (t < 1 ? 0.85 : 1),
        0.62,
        t < 1 ? 5 : 7,
        [7.5, 10.5],
      );
    }
    for (const f of B.forks) {
      const [ex, ey, ez] = f[3],
        m = bezier(f, 0.55);
      add([ex, ey + 1.5, ez], within(r, [8.5, 11]), 0.62, 6, [7, 10]);
      add([m[0], m[1] + 3, m[2]], within(r, [6.5, 8.5]), 0.62, 4, [6.5, 9]);
    }
  }
  for (const L of crownLimbs(F)) {
    const [tx, ty, tz] = L.outPath[3],
      c = Math.cos(L.angle),
      s = Math.sin(L.angle),
      side = r() < 0.5 ? 1 : -1;
    add([tx, ty + 3, tz], within(r, [25, 31]), 0.62, 9, [9, 13.5]);
    add(
      [tx + c * 8 - s * side * 15, ty + within(r, [6, 10]), tz + s * 8 + c * side * 15],
      within(r, [19, 24]),
      0.62,
      7,
      [9, 12.5],
    );
    add(
      [tx + c * 4 + s * side * 13, ty + within(r, [10, 15]), tz + s * 4 - c * side * 13],
      within(r, [18, 22]),
      0.62,
      7,
      [9, 12.5],
    );
    const mid = bezier(L.outPath, 0.72);
    add([mid[0], mid[1] + 12, mid[2]], within(r, [19, 23]), 0.62, 7, [9, 12.5]);
    for (const f of L.forks) {
      const [ex, ey, ez] = f.path[3],
        a = r() * Math.PI * 2,
        d = within(r, [6, 11]);
      add([ex, ey + 3, ez], within(r, [18, 23]), 0.62, 7, [9, 12.5]);
      add([ex + Math.cos(a) * d, ey + within(r, [5, 9]), ez + Math.sin(a) * d], within(r, [15, 19]), 0.62, 6, [9, 12]);
    }
  }
  for (let i = 0; i < F.limbs; i++) {
    // between the limbs, over their decks
    const a = limbAngle(i, F) + Math.PI / F.limbs,
      d = within(r, [62, 88]);
    add([Math.cos(a) * d, within(r, [192, 200]), Math.sin(a) * d], within(r, [26, 31]), 0.6, 8, [9.5, 13]);
  }
  const top = F.bark.leader[F.bark.leader.length - 1][0];
  for (let i = 0; i < F.crown.cap; i++) {
    // the cap over the leader
    const a = (i / F.crown.cap) * Math.PI * 2 + 0.5,
      d = within(r, [14, 30]);
    add(
      [Math.cos(a) * d, top - 18 + within(r, [0, 10]), Math.sin(a) * d],
      within(r, [42, 50]),
      0.58,
      12,
      [10, 13.5],
      2,
    );
  }
  const decks = limbForks(F),
    hutTop = F.hutH * 0.85 + 1;
  for (const M of out) {
    for (const [x, y, z] of decks) {
      const R = M.r * 1.18,
        h = Math.hypot(M.c[0] - x, M.c[2] - z),
        dd = Math.max(0, h - F.forkDeck - DECK_CLEAR.side);
      if (dd >= R) continue;
      const k = Math.sqrt(1 - (dd / R) ** 2),
        under = M.r * M.squash * 0.55 * 1.18 * k,
        over = M.r * M.squash * 1.18 * k;
      if (M.c[1] + over < y - DECK_CLEAR.under) continue; // wholly under the deck
      const need = y + hutTop + DECK_CLEAR.over + under;
      if (M.c[1] < need) M.c[1] = need;
    }
  }
  return out;
}
/**
 * CAPITAL-TREES: THE GREAT LIMBS - each from inside the trunk at its height (`limbFrom`), climbing out to its fork, where
 * it runs level under its deck (limbForks), then on and up to its tip (`limbOut` out, `limbTop` up), forking twice on its
 * outer run: [`inPath`, `outPath`] its two Beziers, its radii at the trunk and the fork, its `forks`.
 */
export function crownLimbs(F = FALINESTI) {
  return Array.from({ length: F.limbs }, (_, i) => {
    const a = limbAngle(i, F),
      c = Math.cos(a),
      s = Math.sin(a),
      k = jitter(0xfa3, i);
    const y0 = F.limbFrom[0] + (F.limbFrom[1] - F.limbFrom[0]) * k,
      out = F.limbOut[0] + (F.limbOut[1] - F.limbOut[0]) * jitter(0xfa4, i);
    const y1 = F.limbTop[0] + (F.limbTop[1] - F.limbTop[0]) * jitter(0xfa5, i),
      r0 = trunkRadius(y0, F) * 0.42,
      rFork = r0 * 0.62,
      fy = forkHeight(y0, y1);
    const Q = (d, h) => [c * d, h, s * d];
    const inPath = [
      Q(trunkRadius(y0, F) * 0.4, y0 - 2),
      Q(out * 0.27, y0 + 12),
      Q(out * 0.45, fy - 2.6),
      Q(out * 0.55, fy),
    ]; // up under its deck from below
    const outPath = [Q(out * 0.55, fy), Q(out * 0.68, fy - 0.4), Q(out * 0.86, fy + (y1 - fy) * 0.55), Q(out, y1)];
    const rng = treeRng(0x9a50 + i);
    const forks = [0.42, 0.78].map((t) => {
      const q0 = bezier(outPath, t),
        side = rng() < 0.5 ? -1 : 1,
        fa = a + side * within(rng, [0.55, 0.95]),
        len = out * within(rng, [0.3, 0.42]),
        rise = within(rng, [0.25, 0.5]);
      const fc = Math.cos(fa),
        fs = Math.sin(fa);
      return {
        path: [
          q0,
          [q0[0] + fc * len * 0.4, q0[1] + len * rise * 0.25, q0[2] + fs * len * 0.4],
          [q0[0] + fc * len * 0.75, q0[1] + len * rise * 0.7, q0[2] + fs * len * 0.75],
          [q0[0] + fc * len, q0[1] + len * rise, q0[2] + fs * len],
        ],
        r0: rFork * (1 - t * 0.55) * 0.75,
      };
    });
    return { k: i, angle: a, inPath, outPath, r0, rFork, forks };
  });
}
/** A limb's angle round the trunk. */
const limbAngle = (i, F) => (i / F.limbs) * Math.PI * 2 + 0.35;
/** A limb's middle's height at its fork (the deck on it) - between its foot and its tip, a little over. */
const forkHeight = (y0, y1) => (y0 + y1) / 2 + 6;
const mid2 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const mid4 = (c) => mid2(mid2(c[0], c[1]), mid2(c[2], c[3]));
/**
 * CAPITAL-TREES: WHERE THE CITY LIVES, kept clear of the crown's leaves - over a fork's deck and among its houses (its
 * radius and DECK_CLEAR about it, from under its top to over its houses' poles), over a platform's deck and among its
 * houses (to its rail and DECK_CLEAR past it), and about the walkway below the highest platform (the trunk to past its
 * rail). Answers whether a point is clear of all of it.
 */
export function oakClear(F = FALINESTI) {
  const decks = limbForks(F),
    up = F.hutH + 1.2 + DECK_CLEAR.over,
    S = F.spiral,
    top = F.platforms[F.platforms.length - 1];
  return (/** @type {number[]} */ p) => {
    const d = Math.hypot(p[0], p[2]);
    for (const [x, y, z] of decks)
      if (Math.hypot(p[0] - x, p[2] - z) < F.forkDeck + DECK_CLEAR.side && p[1] > y - DECK_CLEAR.under && p[1] < y + up)
        return false;
    for (const y of F.platforms)
      if (d < trunkRadius(y, F) + 1.5 + F.platformW + DECK_CLEAR.side && p[1] > y - DECK_CLEAR.under && p[1] < y + up)
        return false;
    return !(p[1] < top + up && d < trunkRadius(p[1], F) + S.gap + S.w + DECK_CLEAR.side);
  };
}
/** AUDIT TESA II C4: a platform's sides, and the ones left open - every side whose middle lies within `platformGap` before
 *  the landing (the walkway reaches each platform at a whole turn, its angle 0). */
export const PLATFORM_SIDES = 24;
export const platformOpen =
  (F = FALINESTI) =>
  (/** @type {number} */ i) =>
    ((i + 0.5) / PLATFORM_SIDES) * Math.PI * 2 > Math.PI * 2 - F.platformGap;
/** AUDIT TESA II C4: a hut's angle on its platform - round from the landing, the last short of the open arc. */
export const hutAngle = (i, F = FALINESTI) => F.hutFrom + (i / F.huts) * Math.PI * 2;
/** TESA-LORE: each limb's fork - its middle joint, where it bends up toward its tip - the deck's top a little under it.
 *  CAPITAL-TREES: the deck's top ON its limb, which runs level under it there (crownLimbs). */
export function limbForks(F = FALINESTI) {
  return Array.from({ length: F.limbs }, (_, i) => {
    const a = limbAngle(i, F),
      k = jitter(0xfa3, i),
      y0 = F.limbFrom[0] + (F.limbFrom[1] - F.limbFrom[0]) * k;
    const out = F.limbOut[0] + (F.limbOut[1] - F.limbOut[0]) * jitter(0xfa4, i),
      y1 = F.limbTop[0] + (F.limbTop[1] - F.limbTop[0]) * jitter(0xfa5, i);
    return [
      Math.cos(a) * out * 0.55,
      forkHeight(y0, y1) + trunkRadius(y0, F) * 0.42 * 0.62 + 0.15,
      Math.sin(a) * out * 0.55,
    ];
  });
}
