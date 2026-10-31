// @ts-check
// TESA10c (2026-10-13, bible/03-World/Arena-Provinces.md TESA10c) - THE OTHER CAPITALS' PLANS: Mournhold, Alinor,
// Falinesti, Torval and Helstrom - each its plan (as a map reads: its first row the north), its districts, its anchor,
// its own blocks' laws of the metres from the anchor (x east, z south) and its landmarks' measures
// (world/tamrielCapitals.js lays them; world/capitalMournhold.js and its kin build the landmarks). Pure.

import { hash32, BLOCK_M } from './blockHash.js'; // RUMARE-WATER: the leaf - the Deep Waters worker reads CAPITAL_RIM_TILES (world/tamrielWatersBake.js)

/** AUDIT TESA II C1: THE CAPITALS' RIM - Daggerfall's own blend round a location (world/terrain/terrainTiles.js
 *  blendLocationTerrain, DFU's BlendLocationTerrain) needs ground the location leaves to the land: Daggerfall's three 8 x 8
 *  cities lay none on their outer tiles (their wall blocks' records 63) and blend over eleven tiles (70.4 m) to every
 *  neighbour with no seam. A capital's plan laid ground to its pixel's edge - its lake, its sea, its gardens - so it met
 *  its neighbours in a gap of 27 to 51 m. Its outer CAPITAL_RIM_TILES tiles (the span's outer sides alone: the Imperial
 *  City's inner seams stay level) lay none, closed to the walkers, treeless; every landmark stands inside them on a side
 *  of land (world/tamrielCapitals.js capitalRim). */
export const CAPITAL_RIM_TILES = 11;
export const CAPITAL_RIM_M = CAPITAL_RIM_TILES * (BLOCK_M / 16);

const plan = (rows) => Object.freeze(rows.map((r) => Object.freeze(r.split(' '))));
/** AUDIT TESA II C2: A SHORE CAPITAL'S SEA SLICE - the eight rows of the pixel off its harbour, all water but its own block
 *  `S0` (the slice's carrier: its start markers on the quay, world/tamrielCapitals.js capitalPortBlocks). Daggerfall's
 *  ground is a patch from a pixel's north-west neighbour's height to its own (world/terrain/terrainSampler.js kernelTerms),
 *  so a harbour to the south of a pixel of land lies over land and the sea starts in the next pixel: the capital stands
 *  over both, at the sea's floor, and its harbour meets the sea at that pixel's far edge. */
const seaRows = () => ['L L L S0 L L L L', ...Array(7).fill('L L L L L L L L')];
const cells = (o) =>
  Object.freeze(
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v.map((c) => Object.freeze(c)))])),
  );
/** The district of a capital's `districts` a plan's cell (cx, r) is in, or null (world/tamrielCapitals.js capitalDistrict's
 *  law, its one home). */
export const districtAt = (d, cx, r) =>
  Object.keys(d ?? {}).find((k) => d[k].some(([a, b]) => a === cx && b === r)) ?? null;
/** A capital's own blocks: each code's name (`TESA<tag><code>.RMB`) under one tile law and one closed law (TESA-LORE: and
 *  one tree law, where it plants any). */
const ownBlocks = (tag, codes, tile, closed, tree = null) =>
  Object.freeze(
    Object.fromEntries(
      codes.map((code) => [
        code,
        Object.freeze({ name: `TESA${tag}${code}.RMB`, tile, closed, ...(tree ? { tree } : {}) }),
      ]),
    ),
  );
const inBox = (dx, dz, x, z, w, d) => Math.abs(dx - x) < w / 2 && Math.abs(dz - z) < d / 2;

// ---------------------------------------------------------------- Mournhold

/** MOURNHOLD'S MEASURES, metres from its anchor (the grid's middle, the Royal Palace's) - TESA-LORE: Tribunal's city
 *  (UESP): the Temple Courtyard "at the northern end of Mournhold", the High Fane at its centre; the Royal Palace that
 *  "forms the center of the city"; Plaza Brindisi Dorom "the southernmost quadrant ... a public garden dominated by a
 *  great statue at its center" - Almalexia in battle with Mehrunes Dagon - its gates west to Godsreach, east to the Great
 *  Bazaar and north to the palace; the Great Bazaar's stalls before its shops in the east; the walls of ochre stone round
 *  the city's six by six. (TESA10c stood the plaza at the middle, the palace north, the Fane east, the bazaar south-west.) */
export const MOURNHOLD = Object.freeze({
  plaza: Object.freeze({ x: 0, z: 2 * BLOCK_M, r: 70, ring: 1.1, band: 1.2, gate: 8, path: 4, paved: 20 }),
  statue: Object.freeze({ base: 17, plinth: 12, plinthH: 5, almalexia: 10, dagon: 13 }),
  fane: Object.freeze({
    x: 0,
    z: -2 * BLOCK_M,
    plinth: 72,
    plinthH: 5,
    drumR: 25,
    drumH: 22,
    domeH: 24,
    pavilion: 25,
    pavR: 8,
    pavH: 15,
    porch: 14,
  }),
  court: Object.freeze({
    pools: Object.freeze([-55, 55]),
    poolZ: Object.freeze([-152, -112]),
    poolW: 16,
    braziers: Object.freeze([-22, 22]),
    brazierZ: Object.freeze([-150, -118]),
    brazierH: 6,
  }),
  palace: Object.freeze({ x: 0, z: 0, w: 84, d: 56, h: 18, domeR: 12, sideR: 8, tower: 4.5, towerH: 34 }),
  bazaar: Object.freeze({
    x: 1.5 * BLOCK_M,
    z: BLOCK_M,
    w: 76,
    d: 186,
    cols: 2,
    rows: 7,
    stall: 12,
    deep: 8,
    poles: 3.2,
  }),
  wall: Object.freeze({ half: 330, thick: 5, h: 13, gate: 10, gateH: 9, tower: 6.5, towerH: 18, every: 110 }),
  // CAPITAL-TREES: THE CITY'S OWN TREES in their planters (world/capitalMournhold.js buildMournholdGardens) - the plaza's
  // rings about its statue (`rings`: [radius, how many, the first's bearing in degrees off the axes]) and its allees by
  // its four ways out past its ring wall (`allee`: [radius, metres off the way]), its corners (`corners`, on the
  // diagonals); the Temple Courtyard's rows either side of its pools (`court`: [x off the pool's middle, the rows' z]).
  // Each tree its `variants`' own, turned and sized by its hash (`scale`); a planter `planter` across, its tree `height`
  // (its fork and limbs by it - its top sprays stand some 3 m over it).
  gardens: Object.freeze({
    rings: Object.freeze([Object.freeze([32, 8, 22.5]), Object.freeze([54, 12, 15])]),
    allee: Object.freeze([86, 9]),
    corners: 118,
    court: Object.freeze({ off: Object.freeze([-14, 14]), z: Object.freeze([-146, -132, -118]) }),
    variants: 4,
    scale: Object.freeze([0.9, 1.12]),
    planter: 2.3,
    height: Object.freeze([9, 11]),
  }),
});
/** The plaza's own ground: a garden's grass, paved round the statue, along its two axes and at its ring wall's foot. */
function mournholdTile(dx, dz) {
  const P = MOURNHOLD.plaza,
    x = dx - P.x,
    z = dz - P.z;
  if (Math.abs(x) >= BLOCK_M || Math.abs(z) >= BLOCK_M) return 3; // AUDIT TESA II C15: the plaza's own four blocks, BLOCK_M's
  const r = Math.hypot(x, z);
  return r < P.paved || Math.abs(x) < P.path || Math.abs(z) < P.path || Math.abs(r - P.r) < 3 ? 3 : 2;
}
/** The plans' hash's salt. */
const SALT = 0x3a6e;
/**
 * CAPITAL-TREES: MOURNHOLD'S TREES, each {x, z, yaw, scale, variant} in the anchor's metres (x east, z south) - the city's
 * own, in their planters (`gardens`), where TESA-LORE had planted the Bay's scenery trees (records 12, 15, 16 and 18 of
 * the climate's nature archive - a fir and an oak of the Iliac Bay's woods, one tile in five of the plaza's grass): the
 * plaza's rings about its statue and its allees and corners past its ring wall, and the Temple Courtyard's rows either
 * side of its pools (UESP's Tribunal: "an enclosed area with paths, water, and trees"). Pure.
 */
export function mournholdTreeSites(M = MOURNHOLD) {
  const G = M.gardens,
    P = M.plaza,
    out = [];
  const put = (x, z) => {
    const h = hash32(SALT, Math.round(x * 4), Math.round(z * 4), 11);
    out.push({
      x,
      z,
      yaw: ((h & 1023) / 1024) * Math.PI * 2,
      scale: G.scale[0] + (G.scale[1] - G.scale[0]) * (((h >>> 10) & 1023) / 1023),
      variant: (h >>> 20) % G.variants,
    });
  };
  for (const [r, n, first] of G.rings)
    for (let i = 0; i < n; i++) {
      const a = ((first + (i * 360) / n) * Math.PI) / 180;
      put(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r);
    }
  const [ar, off] = G.allee;
  for (const [ax, az] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    for (const side of [1, -1]) put(P.x + ax * ar + az * side * off, P.z + az * ar + ax * side * off);
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ])
    put(P.x + (sx * G.corners) / Math.SQRT2, P.z + (sz * G.corners) / Math.SQRT2);
  const C = M.court,
    half = C.poolW / 2;
  for (const px of C.pools)
    for (const o of G.court.off) for (const z of G.court.z) put(px + Math.sign(o) * (half + Math.abs(o) - 2), z);
  return out;
}
function mournholdClosed(dx, dz) {
  const M = MOURNHOLD,
    P = M.plaza,
    x = dx - P.x,
    z = dz - P.z,
    r = Math.hypot(x, z);
  if (inBox(dx, dz, P.x, P.z, M.statue.plinth + 1, M.statue.plinth + 1)) return true;
  if (Math.abs(r - P.r) < P.band && Math.min(Math.abs(x), Math.abs(z)) > P.gate / 2) return true;
  if (inBox(dx, dz, M.fane.x, M.fane.z, M.fane.plinth, M.fane.plinth)) return true;
  if (
    M.court.pools.some((px) =>
      inBox(dx, dz, px, (M.court.poolZ[0] + M.court.poolZ[1]) / 2, M.court.poolW, M.court.poolZ[1] - M.court.poolZ[0]),
    )
  )
    return true;
  return inBox(dx, dz, M.palace.x, M.palace.z, M.palace.w, M.palace.d);
}
export const MOURNHOLD_BLOCKS = ownBlocks(
  'MH',
  ['F0', 'F1', 'F2', 'F3', 'R0', 'R1', 'R2', 'R3', 'B0', 'P0', 'P1', 'B1', 'P2', 'P3'],
  mournholdTile,
  mournholdClosed,
); // CAPITAL-TREES: no tree law - the city's own trees stand on its gardens' model (mournholdTreeSites)
export const MOURNHOLD_PLAN = plan([
  'G G G G G G G G',
  'G RESI TEMP F0 F1 RESI RESI G',
  'G RESI RESI F2 F3 LIBR RESI G',
  'G TVRN RESI R0 R1 GENR ARMR G',
  'G MAGE RESI R2 R3 B0 ALCH G',
  'G RESI LIBR P0 P1 B1 GEMS G',
  'G BOOK FIGH P2 P3 BANK PAWN G',
  'G G G G G G G G',
]);
/** TESA-LORE: Tribunal's districts - the Temple Courtyard across the north round the High Fane, the Royal Palace at the
 *  middle, Godsreach west (its manors, its tavern, the Craftsmen's Hall and the Museum of Artifacts), the Great Bazaar
 *  east, Plaza Brindisi Dorom south. */
export const MOURNHOLD_DISTRICTS = cells({
  'Temple Courtyard': [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
  ],
  'Royal Palace': [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ],
  'Godsreach': [
    [1, 1],
    [1, 2],
    [2, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [2, 4],
    [1, 5],
    [2, 5],
    [1, 6],
    [2, 6],
  ],
  'Great Bazaar': [
    [5, 3],
    [6, 3],
    [5, 4],
    [6, 4],
    [5, 5],
    [6, 5],
    [5, 6],
    [6, 6],
  ],
  'Plaza Brindisi Dorom': [
    [3, 5],
    [4, 5],
    [3, 6],
    [4, 6],
  ],
});

// ---------------------------------------------------------------- Alinor

/** ALINOR'S MEASURES, metres from its anchor (its Royal Palace's middle): the palace on its height, the river through the
 *  city's south, the quay's water edge and its piers, the white walls on its three landward sides. TESA-LORE (UESP's
 *  Alinor): "built on mountain slopes" and "reaching higher and higher will eventually lead to the Alinor Royal Palace,
 *  where the whole city can be surveyed" - the palace on three terraces of white stone (`terraces`: each [its side, its
 *  top]), a grand stair up their south face; "a great river runs through Alinor's southern portion and empties into the
 *  Sea of Pearls" - the river across the city (`river`, its banks' z) under two bridges (`bridges`), out under the walls
 *  east to the sea; the Crystal Tower is no part of Alinor (Summerset's north: "a large structure found on the northern
 *  tip of Summerset") and stands in it no longer. */
export const ALINOR = Object.freeze({
  // AUDIT TESA II C2: the sea slice south (ALINOR_PLAN's last eight rows); C10: the north gate on its lane; C15: BLOCK_M's
  palace: Object.freeze({
    keep: 36,
    keepH: 30,
    wing: Object.freeze([30, 20, 18]),
    spireR: 4,
    spireH: 50,
    spireRoof: 16,
    towerR: 8,
    towerH: 70,
    crown: 30,
    terraces: Object.freeze([Object.freeze([190, 5]), Object.freeze([150, 10]), Object.freeze([110, 15])]),
    stairW: 14,
    stairFoot: 97,
  }),
  river: Object.freeze({ z0: 3 * BLOCK_M, z1: 4 * BLOCK_M }),
  bridges: Object.freeze([-1.5 * BLOCK_M, 85.6]),
  bridgeW: 10,
  bridgeRise: 6,
  parapet: 1.1, // AUDIT TESA II C10: the east one onto the Merchants' Ward's street north (it landed 3.6 m from a pawnshop's front)
  quay: Object.freeze({ edge: 470, piers: Object.freeze([-260, -150, 150, 260]), pierTo: 548, pierW: 6, deck: 1.2 }),
  wall: Object.freeze({
    west: -329.2,
    east: 329.2,
    north: -124.4,
    south: 466,
    thick: 4,
    h: 12,
    gate: 10,
    gateH: 9,
    tower: 4.5,
    towerH: 20,
    roof: 10,
    every: 120,
    northGate: 158,
  }),
});
const alinorTile = (dx, dz) => (dz >= ALINOR.quay.edge ? 0 : 3);
/** The palace's height closed whole (its terraces' solid), the palace on it. */
function alinorClosed(dx, dz) {
  const [side] = ALINOR.palace.terraces[0];
  return inBox(dx, dz, 0, 0, side, side);
}
export const ALINOR_BLOCKS = ownBlocks(
  'AL',
  ['P0', 'P1', 'P2', 'P3', 'Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'S0'],
  alinorTile,
  alinorClosed,
);
export const ALINOR_PLAN = plan([
  'G G G G G G G G',
  'G RESI MAGE P0 P1 LIBR RESI G',
  'G RESI GENR P2 P3 GEMS RESI G',
  'G ALCH TVRN RESI RESI TEMP BANK G',
  'G RESI ARMR BOOK FIGH PAWN THIE G',
  'L L L L L L L L',
  'G Q0 Q1 Q2 Q3 Q4 Q5 L',
  'L L L L L L L L',
  ...seaRows(),
]);
export const ALINOR_DISTRICTS = cells({
  'Royal Palace': [
    [3, 1],
    [4, 1],
    [3, 2],
    [4, 2],
  ],
  "Mages' Terrace": [
    [1, 1],
    [2, 1],
    [5, 1],
    [6, 1],
  ],
  'Court of the Kinlords': [
    [1, 2],
    [2, 2],
    [5, 2],
    [6, 2],
    [3, 3],
    [4, 3],
  ],
  'Temple Ward': [
    [1, 3],
    [2, 3],
    [5, 3],
    [6, 3],
  ],
  "Merchants' Ward": [
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
    [5, 4],
    [6, 4],
  ],
  'Alinor Harbour': [
    [1, 6],
    [2, 6],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
    [3, 8],
  ],
});
/** The harbour's sea slice's name - its own block's district's (AUDIT TESA II C2). */
export const ALINOR_HARBOUR = districtAt(ALINOR_DISTRICTS, 3, 8);

// ---------------------------------------------------------------- Falinesti

/** FALINESTI'S MEASURES, metres from its anchor (the Great Graht-Oak's axis): the trunk's levels, its roots, its
 *  limbs, the crown of leaves over the whole city, the platforms round the trunk. TESA-LORE (UESP's Falinesti and its
 *  graht-oaks): "the city sits in the boughs" - "in their mighty boughs, Bosmer live alongside the ape-like Imga ...
 *  coaxing the living wood into pathways winding around hide structures nestled in hollows": a fourth platform, the
 *  walkway winding up the trunk from the ground to the highest (`spiral`), hide houses on every platform (`huts`) and at
 *  every limb's fork on a deck of its own (`forkDeck`). */
// AUDIT TESA II C4: THE WALKWAY CLEAR ALL THE WAY UP - it climbed into the deck of every platform it reached (no way
// through: a body's headroom to 0.17 m over its last 9 to 14 m), through the buttress roots at its foot and under two
// limbs: each platform's deck open over its last `platformGap` (radians) before the landing, the huts round from it
// (`hutFrom`), the roots under the walkway's first rise (CAPITAL-TREES: each held `rootUnder` under it, all round on
// `rootArc`), the limbs from above the highest platform (`limbFrom`) - a body's 2 m over the whole climb
// (test/world/audittesa2c_capitals.test.js).
// CAPITAL-TREES (KPbICA, forwarded by the owner: "The main trees in Falinesti and Mournhold should get some love. They are
// too draftish for now"): THE OAK A FINISHED LANDMARK (world/capitalFalinesti.js) - its bark fluted (`bark`: `sides`
// corners a ring, every third a furrow `furrow` in, the rest ridges up to `ridge` out, shares of its radius, the whole
// turning `twist` radians a metre; its `leader` on over the trunk's last level into the crown, [y, r]); its buttresses
// all round its foot (`roots` on `rootArc` but clear of the porch by `rootPorch` radians), each up to `rootTop` on the
// trunk and always `rootUnder` metres under the walkway climbing over it, `rootThick` across at the trunk and at its edge
// out to `rootOut`; `boughs` living limbs carrying every platform (`boughArc` of its turn - the walkway climbing to it more
// than 2 m under their wood there), each leaving the trunk `boughDrop` under the deck and reaching `boughOut` past the
// trunk, rising `boughRise` over the deck to its leaves, and one more over the deck at `boughOver` (radians), leaving the
// trunk `boughLift` over it - the crown's lower storeys; the crown's `cap` masses over the leader. AUDIT TESA II C4's walkway, platforms, huts and limbs stand as they stood.
export const FALINESTI = Object.freeze({
  trunk: Object.freeze([
    [-3, 34],
    [20, 28],
    [60, 22],
    [100, 18],
    [140, 15],
    [170, 12],
  ]),
  bark: Object.freeze({
    sides: 33,
    furrow: 0.07,
    ridge: 0.028,
    twist: 0.0022,
    leader: Object.freeze([Object.freeze([182, 10]), Object.freeze([194, 8]), Object.freeze([206, 6])]),
  }),
  roots: 12,
  rootOut: 64,
  rootArc: Object.freeze([0.45, 6.1]),
  rootTop: 26,
  rootUnder: 0.8,
  rootThick: Object.freeze([5, 1.2]),
  rootPorch: 0.34,
  limbs: 9,
  limbFrom: Object.freeze([137, 160]),
  limbOut: Object.freeze([95, 140]),
  limbTop: Object.freeze([152, 186]),
  boughs: 3,
  boughArc: Object.freeze([0.45, 3.7]),
  boughDrop: 10,
  boughOut: Object.freeze([36, 46]),
  boughRise: Object.freeze([6, 12]),
  boughOver: 4.85,
  boughLift: 7.5,
  crown: Object.freeze({ y: 178, r: 160, cap: 5 }),
  platforms: Object.freeze([30, 62, 94, 126]),
  platformW: 12,
  platformGap: Math.PI / 4,
  spiral: Object.freeze({ gap: 2.5, w: 4, rail: 1.1, steps: 48, post: 4, knee: 6, kneeOver: 9 }), // CAPITAL-TREES: a rail post every `post` steps, a knee under it every `knee` where the turn stands `kneeOver` over its landing
  huts: 6,
  hutR: 3,
  hutH: 5,
  hutAt: 8.2,
  hutFrom: Math.PI / 24,
  forkDeck: 7.5,
  foot: 40,
  soil: 70,
  porch: Object.freeze({ w: 8, d: 10, h: 9, roof: 3, into: 4, door: Object.freeze([4, 6.5]) }), // WW7-4: the tree's halls' porch (its depth into the trunk's foot)
});
const falinestiTile = (dx, dz) => (Math.hypot(dx, dz) < FALINESTI.soil ? 1 : 2);
const falinestiClosed = (dx, dz) => Math.hypot(dx, dz) < FALINESTI.foot;
export const FALINESTI_BLOCKS = ownBlocks('FA', ['T0', 'T1', 'T2', 'T3'], falinestiTile, falinestiClosed);
export const FALINESTI_PLAN = plan([
  'G G G G G G G G',
  'G RESI RESI MAGE LIBR RESI RESI G',
  'G RESI TVRN GENR ALCH TEMP RESI G',
  'G ARMR RESI T0 T1 GEMS RESI G',
  'G BOOK RESI T2 T3 TVRN BANK G',
  'G RESI FIGH GENR PAWN RESI THIE G',
  'G RESI RESI CUST RESI RESI RESI G',
  'G G G G G G G G',
]);
export const FALINESTI_DISTRICTS = cells({
  'The Roots of the Graht-Oak': [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ],
  'Northbough': [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
  ],
  'Eastbough': [
    [5, 2],
    [6, 2],
    [5, 3],
    [6, 3],
    [5, 4],
    [6, 4],
  ],
  'Westbough': [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [2, 4],
  ],
  'Southbough': [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 5],
    [6, 5],
    [1, 6],
    [2, 6],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
  ],
});

// ---------------------------------------------------------------- Torval

/** TORVAL'S MEASURES, metres from its anchor (between the Mane's Palace and the Temple of the Two Moons): the palace
 *  north, the temple's terraces south with Masser's dome and Secunda's, the quay on Topal Bay, the sandstone walls.
 *  TESA-LORE (UESP's Torval): "the Mane's palaces stand among gardens of sugarcane laid out in symmetry, where the Mane
 *  meditates on a palanquin", the estates kept from outsiders, moon sugar being sacred - the palace's own four blocks a
 *  walled estate (`estate`: its wall, its gate south to the temple) of sugarcane in beds mirrored about the palace's axis
 *  (`estateBeds`), the Mane's palanquin on its dais on that axis north of the palace (`palanquin`). */
export const TORVAL = Object.freeze({
  // AUDIT TESA II C2: the sea slice south (TORVAL_PLAN's last eight rows); C10: the north gate on its lane; C15: BLOCK_M's
  palace: Object.freeze({
    x: 0,
    z: -BLOCK_M,
    w: 64,
    d: 52,
    h: 18,
    domeR: 18,
    drumH: 6,
    domeH: 22,
    minaretR: 3.5,
    minaretH: 42,
  }),
  temple: Object.freeze({
    x: 0,
    z: BLOCK_M,
    tiers: Object.freeze([70, 54, 40]),
    tierH: 4,
    masser: Object.freeze([-9, 11, 13]),
    secunda: Object.freeze([12, 7, 9]),
    drumH: 5,
  }),
  estate: Object.freeze({ half: 98, h: 4, thick: 1.2, gate: 12, gateH: 6, path: 4, bedH: 2.8, bedD: 6, pitch: 15 }),
  palanquin: Object.freeze({ dz: -66, dais: 10, daisH: 1.2 }),
  quay: Object.freeze({ edge: 368, piers: Object.freeze([-260, -120, 120, 260]), pierTo: 440, pierW: 6, deck: 1.2 }),
  wall: Object.freeze({
    west: -329.2,
    east: 329.2,
    north: -226.8,
    south: 364,
    thick: 5,
    h: 12,
    gate: 10,
    gateH: 8,
    tower: 9,
    towerH: 17,
    every: 115,
    northGate: 160,
  }),
});
/** TESA-LORE: the estate's cane beds, each [its middle x, its middle z, its length along x, its depth along z] - beside the
 *  palace east and west in rows the estate's length, and north of it either side of the palanquin's way; every one with
 *  its mirror across the palace's axis. */
export function estateBeds(T = TORVAL) {
  const E = T.estate,
    P = T.palace,
    out = [],
    x0 = P.w / 2 + P.minaretR * 2 + 4,
    x1 = E.half - 6,
    n0 = T.palanquin.dais / 2 + E.path,
    n1 = x0 - E.path;
  for (let z = P.z - E.half + 10; z <= P.z + E.half - 10; z += E.pitch)
    for (const s of [1, -1]) out.push([(s * (x0 + x1)) / 2, z, x1 - x0, E.bedD]);
  for (let z = P.z - E.half + 10; z + E.bedD / 2 < P.z - P.d / 2 - P.minaretR * 2 - 2; z += E.pitch)
    for (const s of [1, -1]) out.push([(s * (n0 + n1)) / 2, z, n1 - n0, E.bedD]);
  return out;
}
/** The estate's ground: grass inside its wall, its paths stone - the way from its gate up the palace's axis, and round the
 *  beds. */
function torvalTile(dx, dz) {
  if (dz >= TORVAL.quay.edge) return 0;
  const E = TORVAL.estate,
    P = TORVAL.palace;
  if (Math.abs(dx - P.x) >= E.half - 1 || Math.abs(dz - P.z) >= E.half - 1) return 3;
  return Math.abs(dx - P.x) < E.path ? 3 : 2;
}
function torvalClosed(dx, dz) {
  const P = TORVAL.palace,
    T = TORVAL.temple,
    Q = TORVAL.palanquin;
  if (inBox(dx, dz, P.x, P.z, P.w + 2 * P.minaretR, P.d + 2 * P.minaretR)) return true;
  if (inBox(dx, dz, P.x, P.z + Q.dz, Q.dais, Q.dais)) return true;
  if (estateBeds().some(([x, z, w, d]) => inBox(dx, dz, x, z, w, d))) return true;
  return inBox(dx, dz, T.x, T.z, T.tiers[0], T.tiers[0]);
}
export const TORVAL_BLOCKS = ownBlocks(
  'TO',
  ['P0', 'P1', 'P2', 'P3', 'M0', 'M1', 'M2', 'M3', 'Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'S0'],
  torvalTile,
  torvalClosed,
);
export const TORVAL_PLAN = plan([
  'G G G G G G G G',
  'G RESI RESI P0 P1 RESI RESI G',
  'G MAGE TVRN P2 P3 GEMS LIBR G',
  'G ALCH GENR M0 M1 TEMP RESI G',
  'G RESI ARMR M2 M3 BANK RESI G',
  'G RESI FIGH PAWN TVRN THIE RESI G',
  'L Q0 Q1 Q2 Q3 Q4 Q5 L',
  'L L L L L L L L',
  ...seaRows(),
]);
export const TORVAL_DISTRICTS = cells({
  "The Mane's Palace": [
    [3, 1],
    [4, 1],
    [3, 2],
    [4, 2],
  ],
  'Temple of the Two Moons': [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
    [5, 3],
  ],
  'Sugar Market': [
    [1, 2],
    [2, 2],
    [5, 2],
    [6, 2],
    [1, 3],
    [2, 3],
    [6, 3],
    [5, 4],
  ],
  'Moonlit Quarter': [
    [1, 1],
    [2, 1],
    [5, 1],
    [6, 1],
    [1, 4],
    [2, 4],
    [6, 4],
  ],
  'Lower Torval': [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 5],
    [6, 5],
  ],
  'Torval Docks': [
    [1, 6],
    [2, 6],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
    [3, 8],
  ],
});
/** The docks' sea slice's name - its own block's district's (AUDIT TESA II C2). */
export const TORVAL_DOCKS = districtAt(TORVAL_DISTRICTS, 3, 8);

// ---------------------------------------------------------------- Helstrom

/** HELSTROM'S MEASURES, metres from its anchor (the Great Xanmeer's axis): the stepped pyramid and its shrine, the Hist
 *  on its isle in the canal, the boardwalks over the canal, the palisade round the city with its watchtowers. TESA-LORE
 *  (UESP's Helstrom): "found in the impenetrable center of Black Marsh"; "the marsh of Helstrom is very dense and heavily
 *  consumed by Heart-Mud, which is reportedly very dark in color" - the city's own ground the heart-mud but the paving at
 *  the Xanmeer's foot (`paved`); the Hist the heart of an Argonian city, grown greater (it stood 44 m) and ringed on its
 *  isle by standing stones (`stones`). */
export const HELSTROM = Object.freeze({
  xanmeer: Object.freeze({
    tiers: Object.freeze([84, 68, 52, 36, 20]),
    tierH: 6,
    shrine: 14,
    shrineH: 8,
    stair: 8,
    paved: 58,
  }),
  hist: Object.freeze({
    x: -0.5 * BLOCK_M,
    z: 1.5 * BLOCK_M,
    isle: 40,
    r: 9,
    h: 64,
    crown: 30,
    stones: 8,
    stoneR: 27,
    stoneW: 2.4,
    stoneH: 6,
  }),
  canal: Object.freeze({ z0: BLOCK_M, z1: 2 * BLOCK_M }), // AUDIT TESA II C15: the plan's own row, BLOCK_M's
  walks: Object.freeze([-1.5 * BLOCK_M, 1.5 * BLOCK_M]),
  walkW: 6,
  walkDeck: 0.8,
  palisade: Object.freeze({
    west: -327.2,
    east: 327.2,
    north: -224.8,
    south: 429.6,
    h: 6,
    gate: 10,
    tooth: 0.8,
    tower: 6,
    towerH: 12,
  }),
});
function helstromTile(dx, dz) {
  const H = HELSTROM.hist,
    X = HELSTROM.xanmeer;
  if (dz > HELSTROM.canal.z0 && dz < HELSTROM.canal.z1) return Math.hypot(dx - H.x, dz - H.z) < H.isle ? 2 : 0;
  return Math.abs(dx) < X.paved && Math.abs(dz) < X.paved ? 3 : 1; // TESA-LORE: the heart-mud, paved at the Xanmeer's foot
}
/** TESA-LORE: the Hist's standing stones on its isle, each [x, z]. */
export const histStones = (H = HELSTROM.hist) =>
  Array.from({ length: H.stones }, (_, i) => {
    const a = ((i + 0.5) / H.stones) * Math.PI * 2;
    return [H.x + Math.cos(a) * H.stoneR, H.z + Math.sin(a) * H.stoneR];
  });
function helstromClosed(dx, dz) {
  const X = HELSTROM.xanmeer,
    H = HELSTROM.hist;
  if (Math.abs(dx) < X.tiers[0] / 2 && Math.abs(dz) < X.tiers[0] / 2) return true;
  if (histStones().some(([x, z]) => inBox(dx, dz, x, z, H.stoneW + 1, H.stoneW + 1))) return true;
  return Math.hypot(dx - H.x, dz - H.z) < H.r + 2;
}
export const HELSTROM_BLOCKS = ownBlocks('HE', ['X0', 'X1', 'X2', 'X3', 'H0'], helstromTile, helstromClosed);
// AUDIT TESA II C6: the hummocks before its two gates (the north and south rows' middle two cells), where the gates opened
// onto the marsh's water and the roads ended in it
export const HELSTROM_PLAN = plan([
  'L L G G G G L L',
  'L RESI RESI RESI MAGE RESI RESI L',
  'G TVRN GENR X0 X1 ALCH RESI G',
  'L RESI ARMR X2 X3 TEMP RESI L',
  'L L L H0 L L L L',
  'G GEMS FIGH PAWN BANK TVRN RESI G',
  'L RESI BOOK RESI THIE RESI RESI L',
  'L L G G G G L L',
]);
export const HELSTROM_DISTRICTS = cells({
  'The Great Xanmeer': [
    [3, 2],
    [4, 2],
    [3, 3],
    [4, 3],
  ],
  'The Hist': [[3, 4]],
  'Northmarsh': [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [1, 2],
    [2, 2],
    [5, 2],
    [6, 2],
    [1, 3],
    [2, 3],
    [5, 3],
    [6, 3],
  ],
  'Southmarsh': [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 5],
    [6, 5],
    [1, 6],
    [2, 6],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
  ],
});

// ---------------------------------------------------------------- the gates

/** ROAD-FOLLOW (2026-10-27, the owner: "Also, city gates do not line up with the roads"; Town-Shapes.md ROAD-FOLLOW): each
 *  plan's gates by the side of its span a road comes in by - the middle of its opening in the wall, the anchor's metres
 *  (x east, z south), off the same measures the walls are cut at (world/capitalMournhold.js, capitalAlinor.js,
 *  capitalTorval.js, capitalHelstrom.js): the roads' gate pixel stands off its slice and the capital lays the road on to it
 *  (world/capitalApproaches.js). Mournhold's in each side's middle; Alinor's and Torval's north gate on its lane, east and
 *  west in their sides' middles; Helstrom's on the anchor's line. */
const at = (x, z) => Object.freeze([x, z]);
export const MOURNHOLD_GATES = Object.freeze({
  N: at(0, -MOURNHOLD.wall.half),
  E: at(MOURNHOLD.wall.half, 0),
  S: at(0, MOURNHOLD.wall.half),
  W: at(-MOURNHOLD.wall.half, 0),
});
const landwardGates = (W) =>
  Object.freeze({
    N: at(W.northGate, W.north),
    E: at(W.east, (W.south + W.north) / 2),
    W: at(W.west, (W.south + W.north) / 2),
  });
export const ALINOR_GATES = landwardGates(ALINOR.wall);
export const TORVAL_GATES = landwardGates(TORVAL.wall);
export const HELSTROM_GATES = Object.freeze({ N: at(0, HELSTROM.palisade.north), S: at(0, HELSTROM.palisade.south) });
