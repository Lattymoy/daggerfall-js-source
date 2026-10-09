// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - THE NODES' LAW: which nodes a map
// pixel holds on a UTC day, what an herb patch grows, what the season
// does to it, what a harvest yields, what the witnessed world says a
// pixel is, and what a region's Court writs may ask. The record is
// bible/06-Systems/Professions-Arc.md (PROF0) 4.3, 6, 11 and 22.
//
// THE NODES ARE THE CLOCK'S (PROF0 law 4). A pixel's nodes on a day are
// a hash of the pixel and the UTC day - the gate's own mix (gateLaw.js
// gateHash), under the nodes' own salt - so every client stands the same
// patch in the same place and the service knows a node id is real
// without a word from anyone. What a harvest YIELDS is rolled by the
// service alone (server-account/src/professions.js); this file says only
// how the roll is shaped.
//
// THE WITNESSED WORLD (SEAT0 3.2). The service holds no ARENA2, so it
// knows a pixel's climate and region only from the clients that derived
// them: a harvest carries them, an account a week registered reports a
// pixel once, three agreeing make it confirmed. `witnessedFact` is that
// law; an unconfirmed pixel is worth the least its kind allows - its
// patches never rise past tier 2, and no march's bounty is paid on it.
//
// Pure: no clock of its own, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { gateHash } from './gateLaw.js';   // the one mix every clock-law in the world rolls with
import { skyClassicMinutes } from './skyLaw.js';   // TIME1: a UTC day's season and month are the SKY's (bible/06-Systems/Online-Time-Arc.md section 4)
import { CLIMATES, REGION_NAMES, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';
import { SEASONS, seasonValue, dateFromClassicMinutes } from '../systems/gameDate.js';
import { basketBlock, BASKET_BLOCKS } from '../systems/foragingCore.js';   // the Basket's blocks and foods - the IL's, one home
import {
  herbKey, materialOf, foodKey, WRIT_UNITS, WRIT_TIER_WEIGHTS, writPay, writRenown, minedMaterial, CUT_RATIO,
  DEEP_DELVER_MULT, GEM_CHANCE, PROSPECTOR_GEM, HEARTWOOD_CHANCE, FORESTER_MULT, RESIN_CHANCE, RESIN, HEARTWOOD,
  HIDE_YIELD, ACT_YIELD_MAX, PART_CHANCE, BUTCHERY,
  PEARL, SLAUGHTERFISH_SCALES, SCHOOL_FISH, FISH_CHANCE,   // PROF8
} from './professionLaw.js';
import { kingdomOf, FREE_LANDS, MARCH_REGIONS, isMarch } from './kingdomLaw.js';   // SEAT0 4.3's map, one home (PROF2)

/** The one salt every client stands a day's nodes with. Changing it moves every node in the world. */
export const NODE_SALT = 0x5e3d;
/** The salt a region's Court writs are drawn with. */
export const WRIT_SALT = 0x3c17;
/** A node's kind, as its id and its hash write it. A dungeon's vein is its own kind: its id names a dungeon, not a
 *  pixel (PROF2). */
export const NODE_KINDS = Object.freeze({ tree: 1, herb: 2, vein: 3, boulder: 4, dvein: 5 });

// ─── HOW MANY (PROF0 6) ──────────────────────────────────────────────

const counts = (tree, herb, vein, boulder) => Object.freeze({ tree, herb, vein, boulder });
/** A wilderness pixel's nodes a day, by climate. The sea has none (Fishing's alone). BOULDERS (FIELD BUGS 2026-10-01, the
 *  service's acct47): the boulders 3 / 4 / 5 where they were 1 / 2 / 3 - a field's pieces hold one on each side now.
 *  MORE-NODES (2026-10-02, Mac: "increase all profession nodes", "Double"; acct48): the trees, the herb patches and the
 *  veins twice what they were - the walk between nodes halves (CAP-OFF: and with no day's cap, the nodes and the walk
 *  between them are the day's whole bound). */
export const NODE_COUNTS = Object.freeze({
  [CLIMATES.Woodlands]: counts(12, 8, 4, 3),
  [CLIMATES.MountainWoods]: counts(10, 6, 6, 4),
  [CLIMATES.Mountain]: counts(4, 4, 12, 5),
  [CLIMATES.HauntedWoodlands]: counts(8, 8, 4, 3),
  [CLIMATES.Swamp]: counts(6, 10, 2, 0),
  [CLIMATES.Rainforest]: counts(12, 10, 2, 0),
  [CLIMATES.Subtropical]: counts(8, 8, 4, 3),
  [CLIMATES.Desert]: counts(0, 6, 10, 5),
  [CLIMATES.Desert2]: counts(0, 6, 10, 5),
});
/** How many nodes of `kind` a pixel of `climate` holds a day. */
export const nodeCount = (climate, kind) => NODE_COUNTS[climate]?.[kind] ?? 0;
/** A node's tier weights, tier 1 first (40 / 25 / 15 / 10 / 6 / 4 %). */
export const NODE_TIER_WEIGHTS = Object.freeze([40, 25, 15, 10, 6, 4]);

// ─── THE HERBS (PROF0 4.3) ───────────────────────────────────────────

const row = (...t) => Object.freeze(t);
/** Each climate's herbs - DFU's plant templates - as [common, uncommon, rare]: tiers 1, 2 and 3. */
export const HERB_TABLES = Object.freeze({
  [CLIMATES.Woodlands]: Object.freeze([row(9, 18, 10, 11), row(16, 17, 19, 20, 23), row(25, 26)]),
  [CLIMATES.MountainWoods]: Object.freeze([row(14, 18, 15), row(12), row(22)]),
  [CLIMATES.Mountain]: Object.freeze([row(14, 8), row(13), row(26)]),
  [CLIMATES.HauntedWoodlands]: Object.freeze([row(8, 12), row(21, 24), row(27)]),
  [CLIMATES.Swamp]: Object.freeze([row(12, 13, 9), row(28), row(24)]),
  [CLIMATES.Rainforest]: Object.freeze([row(28, 15), row(27, 31, 10), row(22)]),
  [CLIMATES.Subtropical]: Object.freeze([row(29, 30, 11), row(31, 28), row(25)]),
  [CLIMATES.Desert]: Object.freeze([row(32, 8), row(30, 29), row(25)]),
  [CLIMATES.Desert2]: Object.freeze([row(32, 8), row(30, 29), row(25)]),
});
/** The herbs' three tiers. */
export const HERB_TIERS = 3;
/**
 * An herb's own tier - its commonest place's (PROF0 22): the Stores' tier and Marks value of the plant, which a writ
 * and a market read. A patch's tier is its climate's (a rare find there), and that is what its rank and XP read.
 */
export function herbTier(templateIndex) {
  let best = null;
  for (const table of Object.values(HERB_TABLES)) {
    for (let t = 0; t < table.length; t++) if (table[t].includes(templateIndex) && (best === null || t + 1 < best)) best = t + 1;
  }
  return best;
}
/** A material's standing (professionLaw materialOf, with the herbs' own tiers). */
export const material = (key) => materialOf(key, herbTier);

// ─── THE SEASONS (PROF0 4.3, 22) ─────────────────────────────────────

/** The flowers, roses, poppies and berries - what winter bares. Green Leaves and Clover the line names on neither side:
 *  they grow all year. */
export const HERB_FLOWERS = Object.freeze([10, 11]);
export const HERB_ROSES = Object.freeze([19, 20, 21, 22]);
export const HERB_POPPIES = Object.freeze([23, 24, 25, 26]);
export const HERB_BERRIES = Object.freeze([15, 16, 17]);
export const WINTER_BARE = Object.freeze([...HERB_FLOWERS, ...HERB_ROSES, ...HERB_POPPIES, ...HERB_BERRIES]);
/** Spring's +50%: every flowering herb (the winter line less its berries). Autumn's: the berries. */
export const SPRING_BLOOM = Object.freeze([...HERB_FLOWERS, ...HERB_ROSES, ...HERB_POPPIES]);
export const AUTUMN_FRUIT = HERB_BERRIES;
export const SEASON_MULT = 1.5;
/** A Seasonal Eye's off-season herb (PROF0 3.3): half the yield. */
export const OFF_SEASON_MULT = 0.5;
export const herbInSeason = (templateIndex, season) => season !== SEASONS.Winter || !WINTER_BARE.includes(templateIndex);
export const herbSeasonMult = (templateIndex, season) =>
  ((season === SEASONS.Spring && SPRING_BLOOM.includes(templateIndex)) || (season === SEASONS.Fall && AUTUMN_FRUIT.includes(templateIndex)) ? SEASON_MULT : 1);

/** The UTC day an instant (ms) falls in. */
export const utcDayOfMs = (ms) => Math.floor(ms / 86_400_000);
/** A UTC day's first instant on the shared clock, as DFU's date - a day's patches, the Basket's block and a writ's
 *  table read the season and month of it, so nothing under a player changes before the day does. TIME1: the SKY's date
 *  at that instant, so a herb blooms in the spring the player sees - it holds the whole UTC day, and can trail the
 *  sky's season by up to a day (the event clock's, before the sky's first switch: one law, both ends). */
export const dayDate = (day) => dateFromClassicMinutes(Math.floor(skyClassicMinutes(day * 86_400_000)));
export const daySeason = (day) => seasonValue(dayDate(day));
export const dayMonth = (day) => dayDate(day).month;

// ─── A NODE'S ID ─────────────────────────────────────────────────────

/** Whether (x, y) is a map pixel. */
export const pixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < MAX_MAP_PIXEL_X && y < MAX_MAP_PIXEL_Y;
/** Whether `r` is a region index. */
export const regionOk = (r) => Number.isSafeInteger(r) && r >= 0 && r < REGION_NAMES.length;
/** A node's id: `herb:412:188:20724:2` - its kind, its pixel, its UTC day and its slot. A dungeon's vein names its
 *  dungeon instead: `dvein:<id>:<day>:<slot>`. */
export const nodeKey = ({ kind, x, y, day, slot }) => `${kind}:${x}:${y}:${day}:${slot}`;
export const dveinKey = ({ dungeon, day, slot }) => `dvein:${dungeon}:${day}:${slot}`;
/** PROF7: a body's id - `body:<day>:<id>`, the UTC day of the kill and twelve hex digits the killer's client drew at it
 *  (scenes/huntHost.js). Hunting is bounded, not witnessed (PROF0 6): the id is the client's word and the hour's writes
 *  and the day's rare hides its bound (CAP-OFF) - so it names no pixel, no dungeon and no foe, and the service reads
 *  none of it but the day. */
export const bodyKey = ({ day, id }) => `body:${day}:${id}`;
export const BODY_ID_RE = /^[0-9a-f]{12}$/;
const NODE_KEY_RE = /^(tree|herb|vein|boulder):(\d{1,3}):(\d{1,3}):(\d{1,6}):(\d{1,2})$/;
const DVEIN_KEY_RE = /^dvein:(\d{1,7}):(\d{1,6}):(\d{1,2})$/;
const BODY_KEY_RE = /^body:(\d{1,6}):([0-9a-f]{12})$/;
/** PROF8: a haul's id - `haul:<x>:<y>:<day>:<id>`, the map pixel the net was cast from, its UTC day and twelve hex
 *  digits the angler's client drew at the cast (scenes/fishHost.js). Fishing is bounded, not witnessed (PROF0 6): the
 *  pixel is the client's word, read for its ground (the sea's finds are a confirmed pixel's) and its day - the hour's
 *  writes the bound (CAP-OFF: the day's forty hauls are gone). */
export const haulKey = ({ x, y, day, id }) => `haul:${x}:${y}:${day}:${id}`;
const HAUL_KEY_RE = /^haul:(\d{1,3}):(\d{1,3}):(\d{1,6}):([0-9a-f]{12})$/;
/** A dungeon's identity, DFU's own: `MapTableData.MapId & 0xfffff` (formats/mapsFile.js). */
export const DUNGEON_ID_MAX = 0xfffff;
export const dungeonOk = (id) => Number.isSafeInteger(id) && id >= 0 && id <= DUNGEON_ID_MAX;
/** A node id read back, or null for one out of shape. AUDIT 29 A1: only in its one spelling - `vein:010:20:...` is the
 *  same node as `vein:10:20:...` by its numbers, and the service keys the day's harvests by the string, so a node read
 *  in a second spelling was a node taken twice. */
export function parseNodeKey(s) {
  if (typeof s !== 'string') return null;
  const b = BODY_KEY_RE.exec(s);
  if (b) return bodyKey({ day: Number(b[1]), id: b[2] }) === s ? { kind: 'body', day: Number(b[1]), id: b[2] } : null;
  const h = HAUL_KEY_RE.exec(s);
  if (h) {
    const [x, y, day] = [Number(h[1]), Number(h[2]), Number(h[3])];
    return pixelOk(x, y) && haulKey({ x, y, day, id: h[4] }) === s ? { kind: 'haul', x, y, day, id: h[4] } : null;
  }
  const d = DVEIN_KEY_RE.exec(s);
  if (d) {
    const [dungeon, day, slot] = [Number(d[1]), Number(d[2]), Number(d[3])];
    return dungeonOk(dungeon) && dveinKey({ dungeon, day, slot }) === s ? { kind: 'dvein', dungeon, day, slot } : null;
  }
  const m = NODE_KEY_RE.exec(s);
  if (!m) return null;
  const [x, y, day, slot] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  return pixelOk(x, y) && nodeKey({ kind: m[1], x, y, day, slot }) === s ? { kind: m[1], x, y, day, slot } : null;
}
/** Roll `k` of a node: a whole number in [0, 2^32). */
export const nodeRoll = (kind, x, y, day, slot, k) => gateHash(NODE_SALT, x, y, day, NODE_KINDS[kind] ?? 0, slot, k);
const unit = (kind, x, y, day, slot, k) => nodeRoll(kind, x, y, day, slot, k) / 4294967296;

/** A tier drawn by `u` in [0, 1) over the first `tiers` of NODE_TIER_WEIGHTS, renormalised (herbs: 40 : 25 : 15). */
export function drawTier(u, tiers) {
  const w = NODE_TIER_WEIGHTS.slice(0, tiers);
  const total = w.reduce((a, b) => a + b, 0);
  let at = u * total;
  for (let t = 0; t < w.length; t++) { if (at < w[t]) return t + 1; at -= w[t]; }
  return w.length;
}

/**
 * ONE HERB PATCH of a pixel's day: where it stands in the pixel (`u`, `v` in [0.04, 0.96]), its tier, its herb, and
 * whether the herb is out of season (a Seasonal Eye's alone). The tier is held to 2 on a pixel not confirmed. The herb
 * is drawn from the tier's list; a bare first draw draws again among what grows at that tier, stepping down a tier
 * until something does - but a Seasonal Eye keeps the first draw, off-season. Null where the climate grows no herbs.
 * @param {{ x: number, y: number, day: number, slot: number, climate: number, confirmed?: boolean, seasonalEye?: boolean }} p
 */
export function herbPatch({ x, y, day, slot, climate, confirmed = false, seasonalEye = false }) {
  const table = HERB_TABLES[climate];
  if (!table) return null;
  const season = daySeason(day);
  const u = 0.04 + 0.92 * unit('herb', x, y, day, slot, 1);
  const v = 0.04 + 0.92 * unit('herb', x, y, day, slot, 2);
  // AUDIT 29 A8: held to tier 2 by the weights (40 : 25), as a vein is - a clamp gave tier 3's draws to tier 2
  const tier = drawTier(unit('herb', x, y, day, slot, 3), confirmed ? HERB_TIERS : 2);
  const list = table[tier - 1];
  const first = list[Math.floor(unit('herb', x, y, day, slot, 4) * list.length)];
  if (herbInSeason(first, season)) return { slot, u, v, tier, herb: first, offSeason: false };
  if (seasonalEye) return { slot, u, v, tier, herb: first, offSeason: true };
  for (let t = tier; t >= 1; t--) {
    const grow = table[t - 1].filter((h) => herbInSeason(h, season));
    if (grow.length) return { slot, u, v, tier: t, herb: grow[Math.floor(unit('herb', x, y, day, slot, 5) * grow.length)], offSeason: false };
  }
  return null;
}
/** Every herb patch of a pixel's day, slot 0 first. */
export function herbPatches({ x, y, day, climate, confirmed = false, seasonalEye = false }) {
  const n = nodeCount(climate, 'herb');
  const out = [];
  for (let slot = 0; slot < n; slot++) {
    const p = herbPatch({ x, y, day, slot, climate, confirmed, seasonalEye });
    if (p) out.push(p);
  }
  return out;
}

// ─── THE VEINS (PROF0 4.1, 4.6, 4.7, 6, 23) ──────────────────────────

/** Each climate's vein metals (PROF0 4.1) - DFU's MetalIngredients and the new ores, as material keys. A table's tier
 *  is each metal's own (professionLaw METALS, ORES). "Deep veins" are the dungeon's (DUNGEON_VEINS). */
export const VEIN_TABLES = Object.freeze({
  [CLIMATES.Woodlands]: row('metal:iron', 'metal:copper', 'metal:tin', 'metal:lodestone'),
  [CLIMATES.MountainWoods]: row('metal:iron', 'metal:copper', 'metal:silver', 'metal:lead'),
  [CLIMATES.Mountain]: row('metal:iron', 'metal:silver', 'metal:gold', 'metal:platinum', 'ore:mithril'),
  [CLIMATES.HauntedWoodlands]: row('metal:iron', 'metal:lead', 'metal:mercury'),
  [CLIMATES.Swamp]: row('metal:iron', 'metal:mercury', 'metal:sulphur'),
  [CLIMATES.Rainforest]: row('metal:iron', 'metal:copper', 'metal:gold'),
  [CLIMATES.Subtropical]: row('metal:iron', 'metal:copper', 'metal:tin', 'metal:sulphur'),
  [CLIMATES.Desert]: row('metal:iron', 'metal:lead', 'metal:sulphur', 'metal:gold', 'ore:ebony'),
  [CLIMATES.Desert2]: row('metal:iron', 'metal:lead', 'metal:sulphur', 'metal:gold', 'ore:ebony'),
});
/** The deep veins' table - a dungeon's, tiers 3-6 (PROF0 6, 23): Silver, Gold, Dwarven Scrap, Platinum, Adamantium;
 *  and Moonstone in a Woodlands or HauntedWoodlands dungeon (4.1's deep veins). */
export const DUNGEON_VEINS = row('metal:silver', 'metal:gold', 'ore:dwarven', 'metal:platinum', 'ore:adamantium');
export const DEEP_MOONSTONE_CLIMATES = Object.freeze([CLIMATES.Woodlands, CLIMATES.HauntedWoodlands]);
export const dungeonVeinTable = (climate) => (DEEP_MOONSTONE_CLIMATES.includes(climate) ? [...DUNGEON_VEINS, 'ore:moonstone'] : [...DUNGEON_VEINS]);
/** UNWITNESSED-ORE (FIELD BUGS 2026-10-09e, the Discord's "Mining veins": "I mined about 200-300 veins of iron, but
 *  there were not a single vein of silver, gold, platinum or mithril in the mountains"): THE TIER A VEIN ON GROUND NO
 *  THREE WITNESSES HAVE VOUCHED FOR IS HELD TO - a dungeon's, 3, where it was a herb's 2. Held to 2, the Mountain's table
 *  (Iron, then Silver at 3) stood Iron and nothing else on every pixel nobody else had worked, and the Mountain Woods'
 *  never stood its Silver; a lone miner's word confirms nothing, so the far mountains never came to the rest. At 3 a
 *  claimed Mountain anywhere is worth Silver at most - what a dungeon's deep vein already gives on anyone's word - and
 *  Gold, Platinum, Mithril and a region's signature still wait on the witnesses. The herbs and the trees keep 2. */
export const UNCONFIRMED_VEIN_TIER = 3;
/** A dungeon's veins a day: 1 to 4. */
export const DUNGEON_VEINS_MAX = 4;
/** A region's signature ore (PROF0 4.7): the crowns' - Daggerfall's Moonstone on a pixel's first TWO veins, Wayrest's
 *  Mithril, Sentinel's Ebony - and the Free Lands': Orsinium's and the Wrothgarian Mountains' Orichalcum, Balfiera's
 *  Adamantium. `slots` how many of a pixel's veins it takes. */
export function regionSignature(region) {
  const k = kingdomOf(region);
  if (k === 'daggerfall') return { ore: 'ore:moonstone', slots: 2 };
  if (k === 'wayrest') return { ore: 'ore:mithril', slots: 1 };
  if (k === 'sentinel') return { ore: 'ore:ebony', slots: 1 };
  if (region === FREE_LANDS.orsinium || region === FREE_LANDS.wrothgarian) return { ore: 'ore:orichalcum', slots: 1 };
  if (region === FREE_LANDS.balfiera) return { ore: 'ore:adamantium', slots: 1 };
  return null;
}
const tierOfKey = (key) => minedMaterial(key)?.tier ?? 0;
/**
 * A tier drawn by `u` over the tiers `table` holds, by NODE_TIER_WEIGHTS renormalised - at most `cap` - then a metal of
 * it evenly by `v`. So a Woodlands vein is Iron, Copper or Tin 40 : 25 against Lodestone.
 * @param {readonly string[]} table
 */
export function drawFromTable(table, u, v, cap = 7) {
  const tiers = [...new Set(table.map(tierOfKey))].filter((t) => t >= 1 && t <= cap).sort((a, b) => a - b);
  if (!tiers.length) return null;
  const w = tiers.map((t) => NODE_TIER_WEIGHTS[t - 1] ?? NODE_TIER_WEIGHTS[NODE_TIER_WEIGHTS.length - 1]);
  let at = u * w.reduce((a, b) => a + b, 0);
  let tier = tiers[tiers.length - 1];
  for (let i = 0; i < tiers.length; i++) { if (at < w[i]) { tier = tiers[i]; break; } at -= w[i]; }
  const of = table.filter((k) => tierOfKey(k) === tier);
  return { tier, material: of[Math.min(of.length - 1, Math.floor(v * of.length))] };
}
/** How many veins a pixel's day holds: its climate's, and on a confirmed pixel of a signature region the signature's
 *  own beside them (AUDIT 29 A6). */
export function veinSlots({ climate, region = null, confirmed = false }) {
  if (!VEIN_TABLES[climate]) return 0;
  const sig = confirmed && region !== null ? regionSignature(region) : null;
  return nodeCount(climate, 'vein') + (sig?.slots ?? 0);
}
/**
 * ONE VEIN of a pixel's day: its law point (`u`, `v`), its tier and metal. A pixel not confirmed is held to
 * UNCONFIRMED_VEIN_TIER (3 - UNWITNESSED-ORE; it was 2) and takes no signature. A confirmed one of a signature region holds its signature ore BESIDE the climate's veins, in the
 * slots after them (Daggerfall's two) - AUDIT 29 A6: in their place, a Swamp's one vein was Wayrest's Mithril and a
 * novice there had no ore on any witnessed ground ("the crowns sit on the richest veins", 4.7, not the only ones). Null
 * where the climate holds no veins, or past the day's slots.
 * @param {{ x: number, y: number, day: number, slot: number, climate: number, region?: number|null, confirmed?: boolean }} p
 */
export function vein({ x, y, day, slot, climate, region = null, confirmed = false }) {
  const table = VEIN_TABLES[climate];
  if (!table || !Number.isSafeInteger(slot) || slot < 0 || slot >= veinSlots({ climate, region, confirmed })) return null;
  const u = 0.04 + 0.92 * unit('vein', x, y, day, slot, 1);
  const v = 0.04 + 0.92 * unit('vein', x, y, day, slot, 2);
  if (slot >= nodeCount(climate, 'vein')) {
    const sig = /** @type {{ ore: string, slots: number }} */ (regionSignature(/** @type {number} */ (region)));
    return { slot, u, v, tier: tierOfKey(sig.ore), material: sig.ore, signature: true };
  }
  const d = drawFromTable(table, unit('vein', x, y, day, slot, 3), unit('vein', x, y, day, slot, 4), confirmed ? 7 : UNCONFIRMED_VEIN_TIER);
  return d ? { slot, u, v, tier: d.tier, material: d.material, signature: false } : null;
}
/** Every vein of a pixel's day, slot 0 first - the climate's, then a signature's. */
export function veins(p) {
  const out = [];
  for (let slot = 0; slot < veinSlots(p); slot++) { const n = vein({ ...p, slot }); if (n) out.push(n); }
  return out;
}
/** ONE BOULDER of a pixel's day (PROF0 4.5, 23): its law point, tier 1 (Rough Stone's). Null past the climate's count. */
export function boulder({ x, y, day, slot, climate }) {
  if (slot >= nodeCount(climate, 'boulder')) return null;
  return { slot, u: 0.04 + 0.92 * unit('boulder', x, y, day, slot, 1), v: 0.04 + 0.92 * unit('boulder', x, y, day, slot, 2), tier: 1, material: 'stone:rough' };
}
export function boulders(p) {
  const out = [];
  for (let slot = 0; slot < nodeCount(p.climate, 'boulder'); slot++) { const n = boulder({ ...p, slot }); if (n) out.push(n); }
  return out;
}
/** How many veins a dungeon holds on a day: 1 + hash % 4. */
export const dungeonVeinCount = (dungeon, day) => 1 + (nodeRoll('dvein', dungeon, 0, day, 0, 0) % DUNGEON_VEINS_MAX);
/**
 * ONE DUNGEON VEIN of a day: its tier (3-6 by the weights; 3 in a dungeon not confirmed), its metal, and where it
 * stands - `marker` in [0, 1) picks one of the dungeon's foe markers, `bearing` in [0, 2 pi) the ray's heading from it.
 * @param {{ dungeon: number, day: number, slot: number, climate: number, confirmed?: boolean }} p
 */
export function dungeonVein({ dungeon, day, slot, climate, confirmed = false }) {
  if (!dungeonOk(dungeon) || slot >= dungeonVeinCount(dungeon, day)) return null;
  const table = dungeonVeinTable(climate);
  const d = drawFromTable(table, unit('dvein', dungeon, 0, day, slot, 3), unit('dvein', dungeon, 0, day, slot, 4), confirmed ? 7 : UNCONFIRMED_VEIN_TIER);
  if (!d) return null;
  return { slot, tier: d.tier, material: d.material, marker: unit('dvein', dungeon, 0, day, slot, 1), bearing: 2 * Math.PI * unit('dvein', dungeon, 0, day, slot, 2) };
}
export function dungeonVeins(p) {
  const out = [];
  for (let slot = 0; slot < dungeonVeinCount(p.dungeon, p.day); slot++) { const n = dungeonVein({ ...p, slot }); if (n) out.push(n); }
  return out;
}

// ─── THE TREES (PROF0 4.2, 6, 25) ────────────────────────────────────

/** Each climate's woods, as log keys (PROF0 4.2): a tree's tier is each log's own (professionLaw LOGS). FOUND: 4.2
 *  names only Ghostwood for the HauntedWoodlands - DECIDED (PROF0 25): its other trees are Woodlands' Oak and Cherry.
 *  The Desert stands none (section 6's count). */
export const WOOD_TABLES = Object.freeze({
  [CLIMATES.Woodlands]: row('log:oak', 'log:cherry'),
  [CLIMATES.MountainWoods]: row('log:pine', 'log:oak'),
  [CLIMATES.Mountain]: row('log:pine'),
  [CLIMATES.HauntedWoodlands]: row('log:oak', 'log:cherry'),
  [CLIMATES.Swamp]: row('log:oak'),
  [CLIMATES.Rainforest]: row('log:teak', 'log:mahogany'),
  [CLIMATES.Subtropical]: row('log:cherry', 'log:teak'),
});
/** The rare woods (4.2): one tree in twenty of their climate's, on a confirmed pixel only. */
export const RARE_WOODS = Object.freeze({ [CLIMATES.Rainforest]: 'log:ironwood', [CLIMATES.HauntedWoodlands]: 'log:ghostwood' });
export const RARE_WOOD_CHANCE = 1 / 20;
/** PINE-SHARE (2026-09-30, Mac: "2 in 5 trees Pine"): the one tier-1 wood (4.2), and its share of a forest whose own
 *  woods hold no tier 1 - section 6's tier-1 weight, 2 trees in 5. Woodlands, Haunted Woodlands and Swamp stood only
 *  Oak (Logging 10) and Rainforest and Subtropical nothing unconfirmed, so a Novice logger there could never chop. */
export const PINE_WOOD = 'log:pine';
export const PINE_SHARE = NODE_TIER_WEIGHTS[0] / 100;
/** Whether a climate's own woods hold no tier-1 wood (so PINE_SHARE of its trees stand as Pine). */
const needsPine = (table) => !!table && !table.some((k) => tierOfKey(k) === 1);
/**
 * ONE TREE of a pixel's day: its law point (`u`, `v`), its tier and wood. A rare wood's one in twenty is its own roll,
 * first, on a confirmed pixel; then, in a forest whose own woods hold no tier 1, PINE_SHARE of its trees are Pine, on
 * any ground (PINE-SHARE); else the tier is drawn over the tiers the climate's woods hold by the weights, held to
 * tier 2 on a pixel not confirmed - so an unconfirmed Rainforest or Subtropical pixel, whose woods are all past tier 2,
 * stands only its Pine (PROF0 25: no Teak on anyone's word). Null past the day's count, or where no tree grows.
 * @param {{ x: number, y: number, day: number, slot: number, climate: number, confirmed?: boolean }} p
 */
export function tree({ x, y, day, slot, climate, confirmed = false }) {
  const table = WOOD_TABLES[climate];
  if (!table || !Number.isSafeInteger(slot) || slot < 0 || slot >= nodeCount(climate, 'tree')) return null;
  const u = 0.04 + 0.92 * unit('tree', x, y, day, slot, 1);
  const v = 0.04 + 0.92 * unit('tree', x, y, day, slot, 2);
  const rare = RARE_WOODS[climate];
  if (confirmed && rare && unit('tree', x, y, day, slot, 5) < RARE_WOOD_CHANCE) return { slot, u, v, tier: tierOfKey(rare), material: rare, rare: true };
  if (needsPine(table) && unit('tree', x, y, day, slot, 6) < PINE_SHARE) return { slot, u, v, tier: 1, material: PINE_WOOD, rare: false };   // PINE-SHARE
  const d = drawFromTable(table, unit('tree', x, y, day, slot, 3), unit('tree', x, y, day, slot, 4), confirmed ? 7 : 2);
  return d ? { slot, u, v, tier: d.tier, material: d.material, rare: false } : null;
}
/** Every tree of a pixel's day, slot 0 first. */
export function trees(p) {
  const out = [];
  for (let slot = 0; slot < nodeCount(p.climate, 'tree'); slot++) { const n = tree({ ...p, slot }); if (n) out.push(n); }
  return out;
}
/** A tree's base roll (the service's dice): 2 to 4 logs. */
export const TREE_YIELD = Object.freeze([2, 4]);
/** A TREE'S YIELD, in PROF0 6's order: the base roll; a march's +25%; the fraction a chance. The act moves no logs. */
export function treeYield({ roll, march = false, tideMult = 1 }, chance) {
  let y = roll;
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  return Math.max(1, wholeYield(y, chance));
}
/**
 * A TREE'S FINDS (PROF0 4.2, 25): Resin one tree in four, on any ground; Heartwood a chance each Clean Cut (a Forester's
 * twice it), one at most, on ground the witnesses confirmed. `dice()` the service's, a unit a call - the Resin's first.
 * @returns {{ resin: string|null, heartwood: string|null }}
 */
export function treeFinds({ cuts, confirmed, forester = false }, dice) {
  const resin = dice() < RESIN_CHANCE ? RESIN.key : null;
  let heartwood = null;
  if (confirmed) {
    const chance = HEARTWOOD_CHANCE * (forester ? FORESTER_MULT : 1);
    for (let i = 0; i < cuts; i++) if (dice() < chance) { heartwood = HEARTWOOD.key; break; }
  }
  return { resin, heartwood };
}

/** The gem a climate's veins give (PROF0 4.6): Amber (Woodlands), Jade (Rainforest), Turquoise (the deserts),
 *  Malachite (Swamp), Ruby, Sapphire or Emerald (Mountain); none elsewhere. A dungeon's vein gives a Diamond. */
export const VEIN_GEMS = Object.freeze({
  [CLIMATES.Woodlands]: row('gem:amber'), [CLIMATES.Rainforest]: row('gem:jade'),
  [CLIMATES.Desert]: row('gem:turquoise'), [CLIMATES.Desert2]: row('gem:turquoise'),
  [CLIMATES.Swamp]: row('gem:malachite'), [CLIMATES.Mountain]: row('gem:ruby', 'gem:sapphire', 'gem:emerald'),
});
export const DUNGEON_GEM = 'gem:diamond';
/** The gem a node gives, `u` choosing among its climate's, or null. */
export function gemOf({ kind, climate }, u) {
  if (kind === 'dvein') return DUNGEON_GEM;
  if (kind !== 'vein') return null;   // a boulder is stone
  const list = VEIN_GEMS[climate];
  return list ? list[Math.min(list.length - 1, Math.floor(u * list.length))] : null;
}
/**
 * A STRIKE'S GEM (PROF0 4.6, 23): each strike on the glint a chance - GEM_CHANCE, x PROSPECTOR_GEM for a Prospector -
 * on ground the witnesses confirmed; one gem at most, beside the ore. `dice()` the service's, a unit a call.
 * @param {{ kind: string, climate: number, glints: number, confirmed: boolean, prospector?: boolean }} p
 * @param {() => number} dice
 */
export function veinGem({ kind, climate, glints, confirmed, prospector = false }, dice) {
  if (!confirmed) return null;
  const chance = GEM_CHANCE * (prospector ? PROSPECTOR_GEM : 1);
  for (let i = 0; i < glints; i++) if (dice() < chance) return gemOf({ kind, climate }, dice());
  return null;
}

// ─── THE YIELDS (PROF0 6) ────────────────────────────────────────────

/** An herb's base roll (the service's dice): 1 to 3. */
export const HERB_YIELD = Object.freeze([1, 3]);
/** The Basket's food by the patch's block (FORAGE0 14.6): one in a desert, 1-2 in B and D, 1-3 in C and E. */
export const FOOD_YIELD = Object.freeze({ A: Object.freeze([1, 1]), B: Object.freeze([1, 2]), C: Object.freeze([1, 3]), D: Object.freeze([1, 2]), E: Object.freeze([1, 3]) });
/** The Marches - Betony, Anticlere, Lainlyn (PROF0 4.7): every node +25%, on a confirmed pixel. The regions are
 *  kingdomLaw's (SEAT0 4.3), one home. */
export { MARCH_REGIONS, isMarch };
export const MARCH_MULT = 1.25;
/** A fraction of a unit left at the end is that chance of one more, on the service's dice (`chance` in [0, 1)). */
export function wholeYield(y, chance) {
  const whole = Math.floor(y + 1e-9);
  return whole + (chance < y - whole - 1e-9 ? 1 : 0);
}
/** PROF7 - A BODY'S HIDE (PROF0 6, 29): one, a clean pelt's x1.5 (the act's bound), the fraction a chance - no march
 *  and no Tide: a body names no ground. */
export const hideYield = ({ clean = false }, chance) => Math.max(1, wholeYield(HIDE_YIELD * (clean ? ACT_YIELD_MAX : 1), chance));
/**
 * PROF7 - A BODY'S FINDS beside its hide (PROF0 4.4, 29): its DFU part one body in four - lost with a torn pelt - and its
 * butchery, a Raw Meat (a Butcher's two) or a Slaughterfish's Raw Fish, where the foe gives any. `dice()` the service's.
 * @param {{ hide: { part: string|null, meat: string|null }, torn?: boolean, butcher?: boolean }} o
 * @returns {{ part: string|null, meat: string|null, meatQty: number }}
 */
export function bodyFinds({ hide, torn = false, butcher = false }, dice) {
  const part = hide.part && !torn && dice() < PART_CHANCE ? hide.part : null;
  return { part, meat: hide.meat, meatQty: hide.meat ? (butcher ? BUTCHERY.butcher : BUTCHERY.meat) : 0 };
}
/**
 * PROF8 - A HAUL'S FISH, in PROF0 6's order: the base roll (1-2), the act's step (a full net x1.5, the act's bound), a
 * march's +25% on confirmed ground, a school's fish (a Netter's two), a Slaughterfish's weight (a fish more); the fraction
 * a chance. At least one.
 */
export function haulYield({ roll, clean = false, march = false, school = false, netter = false, slaughterfish = false, tideMult = 1 }, chance) {
  let y = roll * (clean ? ACT_YIELD_MAX : 1);
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  if (school) y += netter ? SCHOOL_FISH.netter : SCHOOL_FISH.plain;
  if (slaughterfish) y += 1;
  return Math.max(1, wholeYield(y, chance));
}
/** PROF8: the sea, as Foraging's net reads it (systems/foragingLaw.js netHasWater): the Ocean's climate, or the sea
 *  coast's region. */
export const SEA_REGION = 31;
export const haulAtSea = (climate, region) => climate === CLIMATES.Ocean || region === SEA_REGION;
/**
 * PROF8 - A HAUL'S FINDS (5.2): at sea on ground the witnesses confirmed, a Pearl (a Pearl Diver's x3, a Deep-Sea's x2)
 * and a Slaughterfish - its scales; a trophy anywhere. `dice()` the service's.
 * @returns {{ pearl: string|null, scales: string|null, trophy: boolean }}
 */
export function haulFinds({ sea = false, confirmed = false, pearlDiver = false, deepSea = false }, dice) {
  const open = sea && confirmed;
  const pearl = open && dice() < FISH_CHANCE.pearl * (pearlDiver ? FISH_CHANCE.pearlDiver : 1) * (deepSea ? FISH_CHANCE.deepSea : 1);
  const slaughterfish = open && dice() < FISH_CHANCE.slaughterfish * (deepSea ? FISH_CHANCE.deepSea : 1);
  const trophy = dice() < FISH_CHANCE.trophy;
  return { pearl: pearl ? PEARL.key : null, scales: slaughterfish ? SLAUGHTERFISH_SCALES : null, trophy };
}
/** PROF8 - THE DAY'S SCHOOLS (PROF0 6): two a pixel a day, each rising where the first water its spots find is - each
 *  school SCHOOL_SPOTS candidate places (u, v in [0, 1) of the pixel), the clock's, the same for every client; a pixel
 *  with no water under any stands none. A cast that lands within SCHOOL_R of one is a school's haul - the client's word,
 *  bounded by the day's forty. */
export const SCHOOLS_PER_PIXEL = 2;
export const SCHOOL_SPOTS = 24;
export const SCHOOL_R = 10;
const SCHOOL_KIND = 6;
export function schoolSpots(x, y, day, k) {
  const out = [];
  for (let j = 0; j < SCHOOL_SPOTS; j++) {
    out.push({ u: gateHash(NODE_SALT, x, y, day, SCHOOL_KIND, k, 2 * j) / 4294967296, v: gateHash(NODE_SALT, x, y, day, SCHOOL_KIND, k, 2 * j + 1) / 4294967296 });
  }
  return out;
}
/**
 * AN HERB'S YIELD, in PROF0 6's order: the base roll (+1 a common herb for a Gardener); the season (spring's blooms,
 * autumn's berries x1.5; a Seasonal Eye's off-season herb x0.5); the act's step - a bruised herb one less, at least one;
 * a march's +25%; the fraction a chance.
 */
export function herbYield({ roll, common = false, gardener = false, seasonMult = 1, offSeason = false, bruised = false, march = false, tideMult = 1 }, chance) {
  let y = roll + (common && gardener ? 1 : 0);
  y *= seasonMult;
  if (offSeason) y *= OFF_SEASON_MULT;
  if (bruised) y = Math.max(1, y - 1);
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  return Math.max(1, wholeYield(y, chance));
}
/** THE BASKET'S YIELD: the block's roll, the search's step (x1.5 all three, x1.25 two), a march's +25%, the fraction. */
export function foodYield({ roll, step = 1, march = false, tideMult = 1 }, chance) {
  let y = roll * step;
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  return Math.max(1, wholeYield(y, chance));
}
/** A vein's base roll (the service's dice): 2 to 3 ore. A boulder's: 3 to 5 Rough Stone. */
export const VEIN_YIELD = Object.freeze([2, 3]);
export const BOULDER_YIELD = Object.freeze([3, 5]);
/**
 * A VEIN'S YIELD, in PROF0 6's order: the base roll; a Deep Delver's dungeon vein x1.5; a march's +25% (a surface vein
 * on a confirmed pixel - the caller's `march`); the fraction a chance. The act moves no ore (its step waits for
 * PROF3's quality - PROF0 23).
 */
export function veinYield({ roll, deep = false, deepDelver = false, march = false, tideMult = 1 }, chance) {
  let y = roll;
  if (deep && deepDelver) y *= DEEP_DELVER_MULT;
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  return Math.max(1, wholeYield(y, chance));
}
/**
 * A BOULDER'S YIELD: `{ material, qty }` - the base roll and a march's +25% of Rough Stone; a clean finish (or a
 * Stonebreaker, always) cuts it at the rock, two to one, into Cut Stone (at least one). One chance, the service's, for
 * whichever fraction is left last.
 */
export function boulderYield({ roll, march = false, cut = false, tideMult = 1 }, chance) {
  let y = roll;
  if (march) y *= MARCH_MULT;
  y *= tideMult;   // SEASON1 part two: the land's Tide on confirmed ground (tideLaw.js tideYield)
  if (cut) return { material: 'stone:cut', qty: Math.max(1, wholeYield(y / CUT_RATIO, chance)) };
  return { material: 'stone:rough', qty: Math.max(1, wholeYield(y, chance)) };
}

/** The Basket's find at a patch on day `day`: its block (the climate, the day's month) and the food drawn from the
 *  block's list by `u` in [0, 1) - a material key. */
export function basketFood(climate, day, u) {
  const block = basketBlock(climate, dayMonth(day));
  const b = BASKET_BLOCKS[block];
  const code = b.foods[Math.min(b.foods.length - 1, Math.floor(u * b.foods.length))];
  return { block, material: foodKey(code, b.fruit) };
}

// ─── THE WITNESSED PIXEL (SEAT0 3.2) ─────────────────────────────────

/** Who may witness, and how many make a fact: an account a week registered; three agree; two dispute. */
export const WITNESS = Object.freeze({ ageS: 7 * 86_400, confirm: 3, dispute: 2 });
/** A pixel's key and a report on it, as `world_witness` keeps them. */
export const pixelKey = (x, y) => `${x},${y}`;
export const pixelReport = (climate, region) => `${climate},${region}`;
export function parseReport(s) {
  const m = typeof s === 'string' ? /^(\d{3}),(\d{1,2})$/.exec(s) : null;
  return m ? { climate: Number(m[1]), region: Number(m[2]) } : null;
}
/**
 * WHAT THE WITNESSES SAY a pixel is: `rows` its reports (`{ account, report, at }`, one an account). The first answer
 * three accounts give is CONFIRMED, and stands; another answer two accounts give after it makes the pixel DISPUTED,
 * the confirmed answer still standing (SEAT0 3.2's one dispute rule). Unconfirmed, the answer most give (the earliest
 * on a tie) is what the pixel is taken to be, at the least its kind allows. `none` with no report. PROF5: `parse`
 * reads another kind's report - a hub's pixel (marketLaw.js parseHubReport) - by the same law.
 * @param {Array<{ account: string, report: string, at: number }>} rows
 * @param {(report: string) => object|null} [parse]
 * @returns {{ state: 'none'|'unconfirmed'|'confirmed'|'disputed', climate?: number|null, region?: number|null, x?: number, y?: number }}
 */
export function witnessedFact(rows, parse = parseReport) {
  const sorted = [...(rows ?? [])].filter((r) => parse(r?.report)).sort((a, b) => (a.at - b.at) || (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));
  if (!sorted.length) return { state: 'none', climate: null, region: null };
  const byReport = new Map();
  /** AUDIT 29 A9: the other answers given AFTER the confirmation - a dissent before it is no dispute of it */
  const after = new Map();
  let confirmed = null, disputed = false;
  for (const r of sorted) {
    if (!confirmed) {
      const seen = byReport.get(r.report) ?? new Set();
      seen.add(r.account);
      byReport.set(r.report, seen);
      if (seen.size >= WITNESS.confirm) confirmed = r.report;
    } else if (r.report !== confirmed) {
      const seen = after.get(r.report) ?? new Set();
      seen.add(r.account);
      after.set(r.report, seen);
      if (seen.size >= WITNESS.dispute) disputed = true;
    }
  }
  if (confirmed) return { state: disputed ? 'disputed' : 'confirmed', ...parse(confirmed) };
  let best = null, bestN = 0;
  for (const [report, seen] of byReport) if (seen.size > bestN) { best = report; bestN = seen.size; }
  return { state: 'unconfirmed', ...parse(best) };
}
/** A confirmed answer stands for a disputed pixel too. */
export const factConfirmed = (fact) => fact?.state === 'confirmed' || fact?.state === 'disputed';

// ─── A REGION'S COURT WRITS (PROF0 11, 22) ───────────────────────────

/**
 * WHAT A REGION'S COURT MAY ASK on a day: every herb its witnessed ground grows in the day's season - a confirmed
 * pixel's whole table, an unconfirmed one's tiers 1-2 - as the region's own group's material; its veins' metals as
 * the veins stand them (an unconfirmed pixel's to UNCONFIRMED_VEIN_TIER), the region's signature ore on a confirmed pixel, Rough Stone where boulders stand (PROF2); its trees' logs
 * by the same rule and its rare wood on a confirmed pixel (PROF4); each with the
 * material's own tier and value, ordered by key (a stable input for the draw).
 * @param {number} region
 * @param {Array<{ climate: number, confirmed: boolean }>} pixels the region's witnessed pixels
 * @param {number} season
 */
export function regionWritTable(region, pixels, season) {
  const keys = new Set();
  const sig = regionSignature(region);
  for (const p of pixels ?? []) {
    const table = HERB_TABLES[p?.climate];
    if (!table) continue;
    const upTo = p.confirmed ? HERB_TIERS : 2;
    for (let t = 0; t < upTo; t++) {
      for (const h of table[t]) if (herbInSeason(h, season)) { const k = herbKey(h, region); if (k) keys.add(k); }
    }
    // PROF2: the ground's metal and stone - its veins' (a confirmed pixel's every tier, an unconfirmed one's to
    // UNCONFIRMED_VEIN_TIER - UNWITNESSED-ORE: the Court asks what the vein stands), its region's signature on a
    // confirmed pixel, and Rough Stone where the climate has boulders. Never an ingot, Cut Stone or a gem: those are
    // smelted, cut or found, not the ground's.
    for (const k of VEIN_TABLES[p.climate] ?? []) if (tierOfKey(k) <= (p.confirmed ? 7 : UNCONFIRMED_VEIN_TIER)) keys.add(k);
    if (sig && p.confirmed) keys.add(sig.ore);
    if (nodeCount(p.climate, 'boulder') > 0) keys.add('stone:rough');
    // PROF4: the ground's woods - its trees' logs by the same rule, its rare wood on a confirmed pixel. Never a plank,
    // Charcoal, Resin or Heartwood: sawn, burnt or found, not the ground's
    if (nodeCount(p.climate, 'tree') > 0) {
      for (const k of WOOD_TABLES[p.climate] ?? []) if (tierOfKey(k) <= (p.confirmed ? 7 : 2)) keys.add(k);
      if (p.confirmed && RARE_WOODS[p.climate]) keys.add(RARE_WOODS[p.climate]);
      if (needsPine(WOOD_TABLES[p.climate])) keys.add(PINE_WOOD);   // PINE-SHARE: the Pine its forest stands
    }
  }
  return [...keys].sort().map((key) => { const m = material(key); return { material: key, tier: m.tier, value: m.value }; });
}
const writUnit = (day, region, slot, k) => gateHash(WRIT_SALT, day, region, slot, k) / 4294967296;
/**
 * A REGION'S COURT WRITS for a day: `count` of them over `table` (regionWritTable). The day's first asks the highest tier
 * the table holds of 5-6, else its highest (PROF0 11: "one a day of tier 5-6"; herbs reach tier 3, metals 6); the rest draw a tier
 * of 1-4 the table holds by the nodes' weights, then a material of it evenly; units in tens from the tier's range. The
 * pay and the Renown follow. None over an empty table.
 * @param {number} day @param {number} region @param {number} count
 * @param {Array<{ material: string, tier: number, value: number }>} table
 */
/** CHAP2a: `draw(slot, k)` the writ's own dice - the Court's by default; a chapter's hall writs (npcChapterLaw.js
 *  hallWrits) draw the same law from their own salt and faction. */
export function courtWrits(day, region, count, table, draw = (/** @type {number} */ slot, /** @type {number} */ k) => writUnit(day, region, slot, k)) {
  if (!table?.length) return [];
  const tiers = [...new Set(table.map((m) => m.tier))].sort((a, b) => a - b);
  const high = tiers.filter((t) => t >= 5);
  const low = tiers.filter((t) => t <= 4);
  const out = [];
  for (let slot = 0; slot < count; slot++) {
    let tier;
    if (slot === 0 || !low.length) tier = high.length ? high[high.length - 1] : tiers[tiers.length - 1];   // AUDIT 29 A10: the highest, as said
    else {
      const w = low.map((t) => WRIT_TIER_WEIGHTS[t - 1]);
      let at = draw(slot, 1) * w.reduce((a, b) => a + b, 0);
      tier = low[low.length - 1];
      for (let i = 0; i < low.length; i++) { if (at < w[i]) { tier = low[i]; break; } at -= w[i]; }
    }
    const of = table.filter((m) => m.tier === tier);
    const m = of[Math.floor(draw(slot, 2) * of.length)];
    const [lo, hi] = WRIT_UNITS[tier];
    const steps = (hi - lo) / 10 + 1;
    const units = lo + 10 * Math.floor(draw(slot, 3) * steps);
    out.push({ slot, material: m.material, tier, units, pay: writPay(units, m.value), renown: writRenown(tier, units) });
  }
  return out;
}
