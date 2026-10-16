// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ETHER-SEA (2026-10-11, the owner: "A brand new open sea map that allows you to traverse to the etheric sea. Sail far
// enough and you are prompted to travel into the open sea. The etheric sea is a infinite procedural oceanscape with
// procedural islands with towns, dungeons, exotic resources, deadly legendary ships, and whatever more you can add to
// give meaning to the etheric sea."; bible/03-World/Eltheric-Ocean.md) - THE ELTHERIC OCEAN'S LAW: where it lies, the isles
// that stand in it, how deep a captain has gone into it, and the ground the terrain kernel grows there.
//
// WHERE IT LIES. A box of the Bay's own pixel grid (ETHER_BOX - 819.2 m a pixel, as every pixel) far north of anything
// else the world holds: Tamriel's frame at any fit the probe allows ends more than a thousand pixels south of it, so
// nothing of the Bay or the continent is ever in sight of it, and it is reached only by THE CROSSING (crossing waters
// out on the open Abecean - `crossingWaters` - and the port's crossing, systems/naval/etherCrossing.js). Its east side is THE
// VEIL (VEIL_PX wide), the way home; from the Veil the sea runs west for more than a thousand leagues and north and
// south for eight hundred, isle after isle, and no captain has found its end. DEPTH is leagues west of the Veil, and its
// BANDS - the Shallows, the Reaches, the Deep Aether, the Abyss - are the sea's law: each deadlier and richer than the
// last (the naval director's, scenes/naval/navalHost.js; the isles' kinds and heights, here).
//
// THE ISLES. The box is a lattice of ISLE_CELL_PX cells; a cell holds an isle on its band's `chance` of its own hash
// (`isleOfCell`), of a KIND drawn by the band's weights - a PORT (a town at its quay: the harbourmaster, the exchange
// and the shipwright of the Eltheric Ocean), a RUIN (a dungeon), a WILD isle (one of the Eltheric goods, gathered off its
// strand), a ROCK - its size and peak the kind's (the deeper, the higher), its centre jittered inside the cell so its
// shore never leaves it (one cell answers any pixel). Its climate, its name and a wild isle's good are its own. No isle
// stands in the Veil or in the box's outer cells. VEILHAVEN, the port the crossing makes landfall at, stands in its
// own cell by the Veil whatever the hash says.
//
// THE GROUND. WOODS.WLD's byte (`etherHeightByte`) - 0 at sea, the isle's peak falling to its shore by its radius, a
// lattice hash of +-HEIGHT_NOISE on its land; the large map's 5 x 5 of detail (`etherLargeMap`) - small bytes on land,
// none at sea (an open sea's bytes past 3 lift out of the water: the kernel's own); CLIMATE.PAK's climate
// (`etherClimateAt`) - the isle's out to CLIMATE_REACH_PX past its rim (the kernel's window carries an isle's land a
// pixel east and south of its bytes), the Ocean's else. The law answers its sea ETHER_MARGIN pixels round the box too,
// so nothing that reads the ground from inside the box - the kernel's windows, the cliffs' fade, the far ring's whole
// reach - ever reaches the rest of the world's ground (AUDIT CAPTAIN'S SEA G1: the far ring drew the Bay's clamped row 0
// past a margin of four). Past the margin the law answers nothing: the sea is the box's, and past it nothing streams.
// Pure and deterministic, and worker-safe (TAMRIEL2-WORKER: it imports formats/ alone): every client and the terrain
// worker grow the same isles.
// ═══════════════════════════════════════════════════════════════════
import { CLIMATES, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';

/** The Eltheric Ocean's box on the Bay's own pixel grid: x from x0 up to x1, y from y0 up to y1. Inside the wire's world
 *  (net/wire.js WORLD_PIXEL_BOUND and POSE_BOUND: a pose's z, (499 - y) pixels, within 8192 of them - so y over -7693)
 *  and in positive world units on both axes (world/streamingWorld.js worldCoordToMapPixel truncates). */
export const ETHER_BOX = Object.freeze({ x0: 64, x1: 8128, y0: -7680, y1: -2688 });
/** ELTHERIC (2026-10-12, the owner: "Apparently the ocean is suppose to be eltheric not etheric"): THE SEA'S WORD, one
 *  home for every word a player reads of it - the lore's Eltheric Ocean, the name the world already gave the waters west
 *  of the Bay (world/tamriel/tamrielGeography.js SEAS, the intro map's; pinned the same, test/world/eltheric.test.js). It was the
 *  "Etheric Sea", in fourteen literals across eight modules. */
export const ETHER_WORD = 'Eltheric';
/** What the world calls it - the loading screen, the Overworld's line, the chart; at a sentence's head, ETHER_SEA_TITLE. */
export const ETHER_SEA_NAME = `the ${ETHER_WORD} Ocean`;
export const ETHER_SEA_TITLE = `The ${ETHER_WORD} Ocean`;
/** The law answers its open sea this many pixels round the box: the far ring's reach from a ship in the box
 *  (render/farRing.js RING_RADIUS and its rebuild's drift - 60 pixels) and every kernel window (two past a pixel, the
 *  cliffs' fade six) inside it. AUDIT CAPTAIN'S SEA G1: four drew the Bay's clamped row 0 on the Veil's horizon. */
export const ETHER_MARGIN = 64;
/** A map pixel's side (metres) - MapsFile's 32768 world units at 40 a metre (world/tamriel/tamrielFrame.js KM_PER_PIXEL): net/gate/gateLaw.js
 *  PIXEL_M's, held here rather than imported so the terrain worker reads no net law (test/world/ethersea.test.js pins them equal). */
const PIXEL_M = 819.2;
/** A league: three miles, the sea's own measure (metres) - the captain's log's too (captainLedger.js reads it here). */
export const LEAGUE_M = 4828;
/** A league in map pixels. */
export const LEAGUE_PX = LEAGUE_M / PIXEL_M;
/** THE VEIL: the box's eastmost pixels, the way home - the crossing offered there. */
export const VEIL_PX = 16;
export const VEIL_X = ETHER_BOX.x1 - VEIL_PX;
/** Is the pixel (any number: the scene's own is fine) in the Eltheric Ocean's box? */
export const inEther = (x, y) => x >= ETHER_BOX.x0 && x < ETHER_BOX.x1 && y >= ETHER_BOX.y0 && y < ETHER_BOX.y1;
/** ...in the box or its margin - where the law answers the ground. */
export const inEtherLaw = (x, y) => x >= ETHER_BOX.x0 - ETHER_MARGIN && x < ETHER_BOX.x1 + ETHER_MARGIN && y >= ETHER_BOX.y0 - ETHER_MARGIN && y < ETHER_BOX.y1 + ETHER_MARGIN;
/** ETHER-OW (2026-10-13): THE GROUND THE WORLD'S SEEDED THINGS STAND ON - the Bay's map, or the Eltheric Ocean's box: the
 *  professions' nodes (net/nodeLaw.js pixelOk - ETHER-NODES) and the Overworld's roaming bands and raiders
 *  (scenes/world.js bandOk, tvRaidOpen, tvRaidSea). Past both, the world streams nothing these are born of. */
export const onBayOrEther = (x, y) => (x >= 0 && y >= 0 && x < MAX_MAP_PIXEL_X && y < MAX_MAP_PIXEL_Y) || inEther(x, y);
/** ...in the Veil. */
export const inVeil = (x, y) => inEther(x, y) && x >= VEIL_X;
/** The box as the stream's frames hold one (world/streamingWorld.js StreamingWorldState.frames): `{ x0, y0, w, h }`. */
export const etherFrame = () => ({ x0: ETHER_BOX.x0, y0: ETHER_BOX.y0, w: ETHER_BOX.x1 - ETHER_BOX.x0, h: ETHER_BOX.y1 - ETHER_BOX.y0 });

/**
 * THE BANDS, by depth (leagues west of the Veil): `from` where each begins; `chance` a cell's share of an isle, `kinds`
 * the isles' weights, `lift` their peaks' share over the kind's; the sea's law for its ships - `level` the classes drawn
 * this many levels over the captain's, `tier` every hold this many rarity tiers richer, `pirate` the corsairs' weight
 * over the traders'. The naval director and the host read them (navalHost.js).
 */
export const BANDS = Object.freeze([
  Object.freeze({ id: 'shallows', name: 'the Shallows', from: 0, chance: 0.5, kinds: Object.freeze({ port: 30, wild: 30, ruin: 14, rock: 26 }), lift: 0, level: 1, tier: 1, pirate: 1 }),
  Object.freeze({ id: 'reaches', name: 'the Reaches', from: 12, chance: 0.48, kinds: Object.freeze({ port: 18, wild: 32, ruin: 25, rock: 25 }), lift: 0.2, level: 3, tier: 2, pirate: 1.6 }),
  Object.freeze({ id: 'deep', name: 'the Deep Aether', from: 45, chance: 0.42, kinds: Object.freeze({ port: 11, wild: 32, ruin: 33, rock: 24 }), lift: 0.45, level: 6, tier: 3, pirate: 2.4 }),
  Object.freeze({ id: 'abyss', name: 'the Abyss', from: 140, chance: 0.36, kinds: Object.freeze({ port: 6, wild: 32, ruin: 40, rock: 22 }), lift: 0.7, level: 9, tier: 4, pirate: 3.4 }),
]);
/** Depth at a pixel: leagues west of the Veil (0 in it and east of it). */
export const etherDepthAt = (x) => Math.max(0, VEIL_X - x) / LEAGUE_PX;
/** The band at a depth (leagues). */
export function etherBandOf(leagues) {
  let b = BANDS[0];
  for (const x of BANDS) if (leagues >= x.from) b = x;
  return b;
}
/** The band at a pixel. */
export const etherBandAt = (x) => etherBandOf(etherDepthAt(x));

// ── the hash ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The sea's salt: one for every client (changing it moves every isle in the sea). */
export const ETHER_SALT = 0xe7e4;
/** A 32-bit hash of a few integers (FNV-1a, finished). */
export function etherHash(...ns) {
  let h = 0x811c9dc5 ^ ETHER_SALT;
  for (const n of ns) {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}
/** A stream off a seed, [0, 1) (mulberry32's step). */
export function etherRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the isles ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The isles' lattice: a cell's side (pixels). */
export const ISLE_CELL_PX = 10;
/** The kinds: each one's radius (pixels) and peak (WOODS bytes, 8 m each) ranges, how its land falls from the peak to
 *  the shore (`fall`, the exponent), and its climates. AUDIT CAPTAIN'S SEA H1/P2: A PORT IS A TOWN ON A SMALL ISLE - its
 *  land the four bytes round its town's pixel's middle (`landCentre`), so the town stands whole on dry ground and its
 *  shore lies ETHER_PORT_SHORE_M about it, where its harbour is sounded (ETHER_HARBOUR_REACH); an isle of two
 *  kilometres put the water past any harbour's reach, and no quay stood at any port of the sea. */
export const ISLE_KINDS = Object.freeze({
  port: Object.freeze({ r: Object.freeze([0.9, 1.1]), peak: Object.freeze([10, 15]), fall: 1, climates: Object.freeze([CLIMATES.Subtropical, CLIMATES.Woodlands, CLIMATES.Rainforest]) }),
  ruin: Object.freeze({ r: Object.freeze([1.4, 2.4]), peak: Object.freeze([15, 34]), fall: 1.5, climates: Object.freeze([CLIMATES.Mountain, CLIMATES.HauntedWoodlands, CLIMATES.Swamp, CLIMATES.Desert]) }),
  wild: Object.freeze({ r: Object.freeze([1.0, 2.8]), peak: Object.freeze([10, 40]), fall: 1.5, climates: Object.freeze([CLIMATES.Rainforest, CLIMATES.Subtropical, CLIMATES.Swamp, CLIMATES.Desert2, CLIMATES.MountainWoods]) }),
  rock: Object.freeze({ r: Object.freeze([0.6, 1.1]), peak: Object.freeze([8, 18]), fall: 1.5, climates: Object.freeze([CLIMATES.Mountain, CLIMATES.Desert]) }),
});
export const KIND_IDS = Object.freeze(Object.keys(ISLE_KINDS));
/** The Eltheric goods a wild isle may bear (systems/naval/tradeGoods.js GOODS' `ether` rows - pinned equal). */
export const ETHER_GOODS = Object.freeze(['etheramber', 'starglass', 'voidsilk']);
/** The lattice hash's reach on an isle's land (bytes either way). */
export const HEIGHT_NOISE = 2;
/** An isle's climate reaches this many pixels past its rim. */
export const CLIMATE_REACH_PX = 1.5;
/** The cells nearest the box's edges stand no isle (the kernel's windows, and the sea's edge kept open). */
export const EDGE_CELLS = 1;
/** AUDIT CAPTAIN'S SEA H1/P2: a port isle's shore stands about this far from its town's middle (m: its pixel's half and
 *  the kernel's fall past it), and its harbour is sounded this far past the town's footprint (shipLife.js findHarbour's
 *  `reach` - the Bay's ports' HARBOUR_REACH is 420 m from a coastal town). Measured through the kernel over every kind of
 *  town a port stands (test/systems/naval/auditcaptsea.test.js). */
export const ETHER_PORT_SHORE_M = 900;
export const ETHER_HARBOUR_REACH = 900;
/** Where an isle's land is centred, in its own pixels' bytes: a port's on its town's pixel's middle (the kernel lays a
 *  pixel's byte at its south-east corner - the four bytes north-west of it frame the pixel), any other's on its centre. */
export const landCentre = (kind, px, py) => (kind === 'port' ? [px - 0.5, py - 0.5] : [px, py]);

/** A cell's column and row (the lattice's, from the box's corner). */
export const etherCellOf = (x, y) => [Math.floor((x - ETHER_BOX.x0) / ISLE_CELL_PX), Math.floor((y - ETHER_BOX.y0) / ISLE_CELL_PX)];
export const CELLS_W = Math.floor((ETHER_BOX.x1 - ETHER_BOX.x0) / ISLE_CELL_PX);
export const CELLS_H = Math.floor((ETHER_BOX.y1 - ETHER_BOX.y0) / ISLE_CELL_PX);
/** VEILHAVEN, the landfall: its cell (a few cells west of the Veil, on the box's middle row) and its own isle. */
export const VEILHAVEN_CELL = Object.freeze([Math.floor((VEIL_X - ETHER_BOX.x0) / ISLE_CELL_PX) - 4, Math.floor(CELLS_H / 2)]);
export const VEILHAVEN_NAME = 'Veilhaven';
/** Where Veilhaven's centre pixel stands in its cell (from its corner): (8068, -5185), where the crossing has always made
 *  its landfall beside it - never moved by the size its isle is. */
export const VEILHAVEN_AT = Object.freeze([4, 5]);

const lerp = (a, b, t) => a + (b - a) * t;
/** A cell's key: `"cx,cy"` - the isle's own key (the save's, the chart's). */
const cellKey = (cx, cy) => `${cx},${cy}`;
/** The cells no isle stands in: the box's edge cells, and every cell east of Veilhaven's - the Veil's still water, the
 *  landfall's way clear. */
const openCell = (cx, cy) => cx < EDGE_CELLS || cy < EDGE_CELLS || cy >= CELLS_H - EDGE_CELLS || cx > VEILHAVEN_CELL[0];

/** @typedef {{ key: string, cx: number, cy: number, px: number, py: number, lx: number, ly: number, kind: string, r: number, peak: number, fall: number, climate: number, seed: number, band: string, good: string|null, name: string, haven: boolean }} Isle */

/** @type {Map<string, Isle|null>} */
const _isles = new Map();
/** For the pins: the isles remembered, and a way to drop them. */
export const isleCacheSize = () => _isles.size;
export const dropIsleCache = () => _isles.clear();
/** The isles' cache: cells remembered before it is dropped whole. */
export const ISLE_CACHE_MAX = 65536;

/** A weighted pick from `{ key: weight }` with a draw in [0, 1). */
function pick(weights, u) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let x = Math.max(0, Math.min(0.999999, u)) * total;
  for (const k of keys) { if ((x -= weights[k]) < 0) return k; }
  return keys[keys.length - 1];
}

/**
 * THE ISLE OF A CELL, or null: `{ key, cx, cy, px, py (its centre pixel - its place's), lx, ly (its land's centre,
 * landCentre's), kind, r, peak, climate, seed, band, good, name, haven }` - on the band's `chance` of the cell's hash, of
 * a kind drawn by the band's weights, its radius and peak in the kind's ranges (its peak lifted by the band's `lift`),
 * its centre where its land (and the kernel's pixel past it) stays inside the cell. Veilhaven's cell is always
 * Veilhaven. Cached a cell.
 */
export function isleOfCell(cx, cy) {
  const key = cellKey(cx, cy);
  const hit = _isles.get(key);
  if (hit !== undefined) return hit;
  const isle = makeIsle(cx, cy, key);
  if (_isles.size >= ISLE_CACHE_MAX) _isles.clear();
  _isles.set(key, isle);
  return isle;
}

function makeIsle(cx, cy, key) {
  if (cx < 0 || cy < 0 || cx >= CELLS_W || cy >= CELLS_H) return null;
  const haven = cx === VEILHAVEN_CELL[0] && cy === VEILHAVEN_CELL[1];
  if (!haven && openCell(cx, cy)) return null;
  const seed = etherHash(cx, cy, 1);
  const r = etherRng(seed);
  const x0 = ETHER_BOX.x0 + cx * ISLE_CELL_PX, y0 = ETHER_BOX.y0 + cy * ISLE_CELL_PX;
  const band = etherBandAt(x0 + ISLE_CELL_PX / 2);
  if (!haven && !(r() < band.chance)) return null;
  const kind = haven ? 'port' : pick(band.kinds, r());
  const k = ISLE_KINDS[kind];
  const radius = haven ? 1 : lerp(k.r[0], k.r[1], r());   // AUDIT CAPTAIN'S SEA H1: Veilhaven a port's, the haven's town on its four bytes
  const peak = haven ? 12 : Math.round(lerp(k.peak[0], k.peak[1], r()) * (kind === 'port' ? 1 : 1 + band.lift));   // a port's town stays a short climb from the water
  const margin = Math.ceil(radius) + 1;   // its land, and the kernel's pixel past it, inside the cell
  const span = Math.max(1, ISLE_CELL_PX - 2 * margin);
  const [px, py] = haven ? [x0 + VEILHAVEN_AT[0], y0 + VEILHAVEN_AT[1]] : [x0 + margin + Math.floor(r() * span), y0 + margin + Math.floor(r() * span)];
  const climate = haven ? CLIMATES.Subtropical : k.climates[Math.floor(r() * k.climates.length) % k.climates.length];
  const good = kind === 'wild' ? ETHER_GOODS[Math.floor(r() * ETHER_GOODS.length) % ETHER_GOODS.length] : null;
  const [lx, ly] = landCentre(kind, px, py);
  const isle = { key, cx, cy, px, py, lx, ly, kind, r: radius, peak, fall: k.fall, climate, seed, band: band.id, good, name: '', haven };
  isle.name = haven ? VEILHAVEN_NAME : isleName(isle);
  return Object.freeze(isle);
}

/** The isle whose cell holds a pixel, or null (outside the box, or an empty cell). */
export function isleAt(x, y) {
  if (!inEther(x, y)) return null;
  const [cx, cy] = etherCellOf(x, y);
  return isleOfCell(cx, cy);
}

/** The isles whose centres lie within `reach` pixels (Chebyshev) of a pixel - nearest first. */
export function islesNear(x, y, reach) {
  const out = [];
  const [c0, r0] = etherCellOf(x - reach, y - reach), [c1, r1] = etherCellOf(x + reach, y + reach);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const isle = isleOfCell(cx, cy);
    if (isle && Math.max(Math.abs(isle.px - x), Math.abs(isle.py - y)) <= reach) out.push(isle);
  }
  return out.sort((a, b) => Math.hypot(a.px - x, a.py - y) - Math.hypot(b.px - x, b.py - y));
}

/** The isle by its key (`"cx,cy"`), or null. */
export function isleByKey(key) {
  const m = /^(-?\d+),(-?\d+)$/.exec(String(key ?? ''));
  return m ? isleOfCell(Number(m[1]), Number(m[2])) : null;
}

/** Veilhaven itself. */
export const veilhaven = () => /** @type {Isle} */ (isleOfCell(VEILHAVEN_CELL[0], VEILHAVEN_CELL[1]));

// ── the names ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The isles' names: a head, a middle on half of them, a tail - some sixteen thousand roots, and the forms each kind is
 *  called by (AUDIT CAPTAIN'S SEA G11: of fifty places charted, two share a name about one time in twenty - measured over
 *  every place of the sea). Ours - no table of the game's. */
export const NAME_HEADS = Object.freeze(['Ael', 'Vael', 'Syr', 'Oru', 'Mir', 'Thal', 'Ves', 'Ish', 'Cael', 'Nym', 'Ery', 'Lun', 'Zeph', 'Ora', 'Sar', 'Ith', 'Quel', 'Xan', 'Eth', 'Ul', 'Kor', 'Bel', 'Dra', 'Hal', 'Ost', 'Rhy', 'Tor', 'Vey', 'Wen', 'Aur', 'Cyr', 'Fen', 'Gal', 'Ione', 'Jor', 'Mael', 'Nor', 'Pell', 'Sel', 'Tey']);
export const NAME_MIDS = Object.freeze(['a', 'e', 'i', 'o', 'u', 'ae', 'ar', 'el', 'in', 'or', 'ul', 'ys']);
export const NAME_TAILS = Object.freeze(['dra', 'mere', 'sol', 'veth', 'oria', 'anth', 'is', 'el', 'yne', 'ara', 'ond', 'ith', 'ael', 'orn', 'esse', 'ivar', 'oth', 'una', 'ys', 'ent', 'alis', 'ume', 'ior', 'ast', 'en', 'wyn', 'mor', 'thas', 'rel', 'gard']);
const NAME_WORDS = Object.freeze({
  adj: Object.freeze(['Weeping', 'Glass', 'Silent', 'Drowned', 'Burning', 'Pale', 'Hollow', 'Singing', 'Starlit', 'Broken', 'Twin', 'Black', 'Amber', 'Moonless', 'Shivering', 'Lantern']),
  rock: Object.freeze(['Stack', 'Teeth', 'Rocks', 'Spire', 'Fang', 'Skerry', 'Crag', 'Needles', 'Anvil', 'Crown']),
  ruin: Object.freeze(['Grave', 'Barrow', 'Hollow', 'Tomb', 'Sepulchre', 'Vault']),
});
const FORMS = Object.freeze({
  port: Object.freeze([(n) => `Port ${n}`, (n) => `${n}haven`, (n) => `${n} Landing`, (n) => `${n}'s Anchorage`, (n) => `${n}mouth`]),
  wild: Object.freeze([(n) => n, (n) => `${n} Isle`, (n) => `the Isle of ${n}`, (n, w) => `the ${w.adj} Isle`]),
  ruin: Object.freeze([(n) => `the Isle of ${n}`, (n, w) => `${n}'s ${w.ruin}`, (n) => `Old ${n}`, (n, w) => `the ${w.ruin} of ${n}`]),   // a place's name: its root always (the automap's key)
  rock: Object.freeze([(n, w) => `the ${w.adj} ${w.rock}`, (n, w) => `${n} ${w.rock}`]),
});
const draw = (list, r) => list[Math.floor(r() * list.length) % list.length];
/** An isle's name off its seed, by its kind's forms. */
export function isleName(isle) {
  const r = etherRng(etherHash(isle.seed, 7));
  const root = draw(NAME_HEADS, r) + (r() < 0.5 ? draw(NAME_MIDS, r) : '') + draw(NAME_TAILS, r);
  const w = { adj: draw(NAME_WORDS.adj, r), rock: draw(NAME_WORDS.rock, r), ruin: draw(NAME_WORDS.ruin, r) };
  return draw(FORMS[isle.kind] ?? FORMS.wild, r)(root, w);
}
/** The words an isle's kind is called by on the chart and in the log. */
export const KIND_WORDS = Object.freeze({ port: 'a port', ruin: 'a ruin', wild: 'a wild isle', rock: 'a bare rock' });
/** The sixteen points, north first. */
const POINTS = Object.freeze(['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west']);
/** The point of the compass a map-pixel offset lies toward, in words - "west-north-west" (map y runs south): the chart's
 *  ways and the harbourmasters' rumours alike. AUDIT CAPTAIN'S SEA G12: none for no offset (null) - atan2 made (0, 0)
 *  "south" and (0, -0) "north". */
export function compassPoint(dx, dy) {
  if (!dx && !dy) return null;
  const a = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return POINTS[Math.round(a / 22.5) % 16];
}

// ── the ground ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A small stable lattice hash, 0..1. */
const lattice = (x, y, salt) => etherHash(x, y, salt) / 4294967296;

/** An isle's byte at a pixel: its peak falling to its shore by the radius from its land's centre ((1 - t^2) to its
 *  kind's `fall`), the lattice's noise on its land, 0 past its rim. */
export function isleByte(isle, x, y) {
  const t = Math.hypot(x - isle.lx, y - isle.ly) / isle.r;
  if (t >= 1) return 0;
  const h = isle.peak * Math.pow(1 - t * t, isle.fall) + (lattice(x, y, 0x51) - 0.5) * 2 * HEIGHT_NOISE;
  return Math.max(0, Math.min(255, Math.round(h)));
}

/** THE HEIGHT at a pixel of the law's ground (WOODS bytes): its cell's isle's, 0 at sea. */
export function etherHeightByte(x, y) {
  const isle = isleAt(x, y);
  return isle ? isleByte(isle, x, y) : 0;
}

/** The large map's 5 x 5 of detail at a pixel - data[x][y] as WoodsFile.getLargeMapData shapes it: small bytes (0..9)
 *  where the isle's land is, 0..1 at sea. */
export function etherLargeMap(x, y) {
  const land = etherHeightByte(x, y) > 0;
  const top = land ? 10 : 2;
  const data = [];
  for (let ix = 0; ix < 5; ix++) {
    const col = new Uint8Array(5);
    for (let iy = 0; iy < 5; iy++) col[iy] = Math.floor(lattice(x * 5 + ix, y * 5 + iy, 0x2545) * top);
    data.push(col);
  }
  return data;
}

/** THE CLIMATE at a pixel: its cell's isle's out to CLIMATE_REACH_PX past its rim, the Ocean's else. */
export function etherClimateAt(x, y) {
  const isle = isleAt(x, y);
  if (!isle) return CLIMATES.Ocean;
  return Math.hypot(x - isle.lx, y - isle.ly) <= isle.r + CLIMATE_REACH_PX ? isle.climate : CLIMATES.Ocean;
}

/**
 * THE COMPOSITION: a WoodsFile with the Eltheric Ocean in it - a prototype child of the reader it is handed (the Bay's,
 * or the Bay's with the continent round it - world/tamriel/tamrielGround.js groundWoods), so the range reads WoodsFile builds
 * on these two answer the sea too and nothing else about the reader changes. Inside the law's box the sea's own; else
 * the reader's.
 * @param {any} woods
 */
export function etherWoods(woods) {
  const ground = Object.create(woods);
  ground.getHeightMapValue = function (x, y) { return inEtherLaw(x, y) ? etherHeightByte(x, y) : woods.getHeightMapValue(x, y); };
  ground.getLargeMapData = function (x, y) { return inEtherLaw(x, y) ? etherLargeMap(x, y) : woods.getLargeMapData(x, y); };
  ground.isEtherGround = true;
  ground.etherLaw = inEtherLaw;   // AUDIT CAPTAIN'S SEA G5: where the composition answers the ground itself (the Overworld's water law asks)
  ground.under = woods;
  return ground;
}

/** The climate read with the Eltheric Ocean in it: the sea's own in the law's box, the read it is handed else. */
export function etherClimateIndex(climateIndex) {
  return (x, y) => (inEtherLaw(x, y) ? etherClimateAt(x, y) : climateIndex(x, y));
}
/** The politic read with the Eltheric Ocean in it: the region it answers for (`region`, world/etherPlaces.js ETHER_REGION -
 *  POLITIC.PAK's own law, a region's politic its index and 128) in the law's box, the read it is handed else. Past the
 *  map POLITIC.PAK answers -1, which MapsFile.getRegionIndexAt clamps to the Alik'r Desert's 0. */
export function etherPoliticIndex(politicIndex, region) {
  return (x, y) => (inEtherLaw(x, y) ? 128 + region : politicIndex(x, y));
}

// ── the light ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** ETHER-LIGHT: the light past the Veil, cold and violet - the ambient's tint and the sun's (each channel's factor), the
 *  sky over it the world's own (the land, the sea and every hull under it lit so, never the dome: no skyline seam). */
export const ETHER_LIGHT_TINT = Object.freeze([0.88, 0.9, 1.14]);
export const ETHER_KEY_TINT = Object.freeze([0.95, 0.93, 1.07]);
/** `rgb` (a light's colour) leaned to `tint` by `w` - the light handed in, the same array, at none (sdOmen.js
 *  sdBrassLight's law: nothing made while nothing leans); a new Float32Array else. Pure. */
export function etherLight(rgb, w, tint = ETHER_LIGHT_TINT) {
  if (!(w > 0) && rgb instanceof Float32Array) return rgb;
  const k = Math.max(0, Math.min(1, w || 0));
  return new Float32Array([0, 1, 2].map((i) => rgb[i] * (1 + (tint[i] - 1) * k)));
}

// ── the crossing's waters ────────────────────────────────────────────────────────────────────────────────────────────
/** THE CROSSING OUT is offered on the open Abecean: west of CROSS_X, CROSS_LAND_PX pixels and more from any land.
 *  AUDIT CAPTAIN'S SEA X4: west of the Bay's mouth - the line from Daggerfall's coast to Myrkwasa's crosses its waters'
 *  row at about 243, and at 300 the Daggerfall-Sentinel lane was asked out thirty kilometres from Daggerfall. */
export const CROSS_X = 230;
export const CROSS_LAND_PX = 20;
/** Is a pixel of the Bay's world crossing waters (`landPx` its distance to the nearest land, pixels - the host's)? */
export const crossingWaters = (x, y, landPx) => !inEtherLaw(x, y) && x < CROSS_X && typeof landPx === 'number' && landPx >= CROSS_LAND_PX;   // Infinity: no land in reach at all
/** Where a crossing home comes out when the captain's way out is not kept: the open Abecean off the Bay's mouth. */
export const HOME_WATERS = Object.freeze({ px: 180, py: 300 });
/** Where a crossing out makes landfall: the open water this many pixels east of Veilhaven, her bow to its quay. */
export const LANDFALL_OFF_PX = 4;
export const landfall = () => { const h = veilhaven(); return { px: h.px + LANDFALL_OFF_PX, py: h.py }; };
