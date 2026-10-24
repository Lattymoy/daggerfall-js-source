// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - THE BIOMES PAST THE BAY: each province's land as its own
// lore's country, in zones.
//
// The owner: "Each region recieves its own biome. Cyrodil receives the unique jungle biome we developed. Every biome must
// be lore accurate and have lore accurate fauna attached. As detailed as possible."
//
// TAMRIEL2 laid every province past the Bay on ONE of Daggerfall's climates (world/tamriel/tamrielGeography.js PROVINCES
// `climate`): the whole of Skyrim Mountain, the whole of Elsweyr Desert2, Cyrodiil Woodlands. The lore splits them, and
// the lore is what this table follows - the Pocket Guide to the Empire's first edition (2E 864) for the era Daggerfall
// stands in, the later games where it is silent (the page's sources). A province is two to five ZONES, each a biome:
//   - its CLIMATE, CLIMATE.PAK's value its ground is laid on (the textures, the nature flats, the weather's table, the
//     air's degrees - systems/weather/airTemperature.js reads it as the Bay's climates are read);
//   - its JUNGLE: the Bantha jungle's law (world/jungle/, bible/03-World/Bantha-Jungle.md) stands on it - Cyrodiil's
//     Nibenay, its Colovian highlands and Blackwood, PGE1's "most is endless jungle";
//   - its AIR, where the lore's air is not its ground's climate's (Morrowind is "mild, though often hot, and mostly free
//     from snow and ice" on grey volcanic rock): the climate whose air leans in over it (scenes/tamrielBiomeHost.js);
//   - its FAUNA: systems/tamrielFauna.js, by the biome's key.
// WHERE A ZONE IS: its province's land (tamrielLand.js provinceKeyBeyondBay - the trace's, else the authored rings), the
// zone whose SEEDS (picture units, the lore's places - its cities, its regions' hearts) stand nearest, the point moved
// first by two octaves of value noise (BIOME_WANDER) so a border between two zones bends through the land and never runs
// as a straight bisector. A province's PEAKS zone takes every point a mountain range lifts past PEAKS_LIFT
// (tamrielGeography.js rangeLift - the height law's own band, so the snowline's ground is the peaks' biome).
// Pure, deterministic, read by the terrain worker (its import graph is world/ and formats/ alone: TAMRIEL2-WORKER), and
// cached a pixel.
// ═══════════════════════════════════════════════════════════════════
import { provinceKeyBeyondBay, tamrielLandVersion } from './tamrielLand.js';
import { bayToPicture, tamrielFit } from './tamrielFrame.js';
import { rangeLift } from './tamrielGeography.js';
import { CLIMATES } from '../../formats/mapsTables.js';

/** A range's lift past this (0..1, tamrielGeography.js rangeLift) is its province's peaks: the Jerall, the Throat of the
 *  World, the Velothi and the Wrothgarians at their spines and flanks; the Colovian Highlands (gain 0.6) and the Tenmar
 *  Hills (0.4) never reach it - they are their zones' own uplands. */
export const PEAKS_LIFT = 0.62;
/** The border's wander, picture units (15.36 km each): two octaves of value noise, each a lattice cell and an amplitude. */
export const BIOME_WANDER = Object.freeze([Object.freeze({ cell: 9, amp: 2.4 }), Object.freeze({ cell: 3, amp: 0.7 })]);
/** The pixel cache: entries before it is dropped whole (the stream asks a few hundred pixels many times). */
export const BIOME_CACHE_MAX = 262144;

const C = CLIMATES;
/** @typedef {{ key: string, province: string, name: string, climate: number, seeds: ReadonlyArray<readonly [number, number]>,
 *   peaks?: boolean, jungle?: boolean, air?: number, lore: string }} Biome */
/** THE BIOMES. `seeds` picture units (x east, y south - tamrielGeography.js CITIES' frame); a `peaks` zone takes the
 *  ranges' lifted ground, and its seeds (if any) a country of its own besides. */
/** @type {ReadonlyArray<Readonly<Biome>>} */
export const BIOMES = Object.freeze(/** @type {Biome[]} */ ([
  // ── SKYRIM: Mountain ground, snow - the north is white the year round, the south pine (PGE1: "the cold and rugged land
  //    of the Nords"; Skyrim's own regions) ─────────────────────────────────────────────────────────────────────────
  { key: 'skyrimFrozenCoast', province: 'Skyrim', name: 'the Frozen Coast', climate: C.Mountain,
    seeds: [[134, 25], [156, 22], [178, 22], [196, 23]],
    lore: 'Haafingar\'s shore, the Pale and Winterhold: barren tundra between the mountains and the Sea of Ghosts' },
  { key: 'skyrimTundra', province: 'Skyrim', name: 'the Tundra Plains', climate: C.MountainWoods,
    seeds: [[160, 44], [142, 36], [182, 38]],
    lore: 'Whiterun\'s plains, Hjaalmarch\'s marsh and Eastmarch\'s hot springs - tundra grass, stone and lichen' },
  { key: 'skyrimPinewood', province: 'Skyrim', name: 'the Southern Pinewoods', climate: C.MountainWoods,
    seeds: [[156, 64], [190, 60], [174, 58]],
    lore: 'Falkreath and the Rift: "the wet climate produces thick, verdant pine forests", the Rift\'s aspens' },
  { key: 'skyrimReach', province: 'Skyrim', name: 'the Reach', climate: C.Mountain,
    seeds: [[124, 46], [127, 36]],
    lore: 'Markarth\'s crags on the High Rock border - karst, gorges, the Forsworn and their hagravens' },
  { key: 'skyrimPeaks', province: 'Skyrim', name: 'the High Peaks', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the Throat of the World, the Jerall\'s north face, the Velothi\'s west - snow the year round' },
  // ── HIGH ROCK past the Bay: Wrothgar's Orc highlands, Rivenspire's haunted moors, Glenumbra's green coast ──────────
  { key: 'highRockWrothgar', province: 'HighRock', name: 'the Wrothgarian Highlands', climate: C.Mountain, peaks: true,
    seeds: [[108, 44], [112, 36], [110, 50]],
    lore: 'Wrothgar, where Gortwog raises Orsinium again in Daggerfall\'s day - snow fields, granite, Orc holds' },
  { key: 'highRockRivenspire', province: 'HighRock', name: 'the Rivenspire Moors', climate: C.HauntedWoodlands,
    seeds: [[96, 40], [84, 28], [104, 30]],
    lore: 'Shornhelm\'s bleak uplands over the Sea of Ghosts - peat moor and wind-bent trees, a country of old houses and their dead' },
  { key: 'highRockGlenumbra', province: 'HighRock', name: 'Glenumbra', climate: C.Woodlands,
    seeds: [[60, 30], [50, 40], [56, 46]],
    lore: 'the western peninsula: oak and beech over green turf, the Druids\' Systres seaward' },
  // ── HAMMERFELL past the Bay: the Alik'r, Craglorn's red badlands, the Abecean coast ─────────────────────────────────
  { key: 'hammerfellAlikr', province: 'Hammerfell', name: 'the Alik\'r Desert', climate: C.Desert,
    seeds: [[76, 96], [96, 100], [62, 102]],
    lore: '"a vast sea of sand and dunes", Yokudan tombs under it, sandstorms over it' },
  { key: 'hammerfellCraglorn', province: 'Hammerfell', name: 'Craglorn', climate: C.Desert2,
    seeds: [[112, 70], [124, 86], [116, 78]],
    lore: 'red-rust mesas and canyons toward Skyrim and Cyrodiil, Dwemer ruins and the vents of the Dragontail\'s fire' },
  { key: 'hammerfellCoast', province: 'Hammerfell', name: 'the Abecean Coast', climate: C.Subtropical,
    seeds: [[80, 113], [90, 116], [66, 110], [50, 100]],
    lore: 'Taneth, Rihad, Gilane and Hegathe: "coasts are especially vibrant with plantlife" - palms, white beaches' },
  { key: 'hammerfellDragontail', province: 'Hammerfell', name: 'the Dragontail Heights', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the Dragontail\'s spine, snow on its peaks over the desert' },
  // ── SUMMERSET: "a warm climate, colorful forests, idyllic meadows, and craggy mountains" ───────────────────────────
  { key: 'summersetVineCoast', province: 'Sumurset', name: 'the Vine Coast', climate: C.Subtropical,
    seeds: [[38, 154], [52, 162], [50, 166], [36, 134], [46, 128]],
    lore: 'Alinor\'s "temperate south-west coast... rows of vineyards", golden meadows and the gold and crimson groves' },
  { key: 'summersetAuridon', province: 'Sumurset', name: 'Auridon', climate: C.Subtropical,
    seeds: [[68, 120], [70, 128]],
    lore: 'the sister isle, more forest than vine' },
  { key: 'summersetEtonNir', province: 'Sumurset', name: 'Eton Nir', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the isle\'s highest peak, Cloudrest on its crown - snow on the summit alone' },
  // ── VALENWOOD: "a sea of endless green... Tamriel's garden", the Green Pact's untouched forest ──────────────────────
  { key: 'valenwoodGrahtwood', province: 'Valenwood', name: 'the Graht-Oak Forest', climate: C.Rainforest,
    seeds: [[118, 150], [132, 160], [140, 146]],
    lore: 'Falinesti\'s and Elden Root\'s country - the graht-oaks that hold cities, lianas, little light on the floor' },
  { key: 'valenwoodMalabal', province: 'Valenwood', name: 'Malabal Tor', climate: C.Rainforest,
    seeds: [[108, 132], [120, 128]],
    lore: 'the deep northern canopy: the densest forest, its rivers, its Wood Orcs' },
  { key: 'valenwoodCoast', province: 'Valenwood', name: 'the Mangrove Coast', climate: C.Swamp,
    seeds: [[90, 160], [124, 176], [112, 176], [84, 146]],
    lore: '"coasts... dominated by mangrove swamps": Woodhearth, Haven, Southpoint' },
  { key: 'valenwoodReapersMarch', province: 'Valenwood', name: 'Reaper\'s March', climate: C.Subtropical,
    seeds: [[136, 132], [142, 138]],
    lore: 'the north-east border with Elsweyr, jungle giving way to plains' },
  // ── ELSWEYR: Anequina's "harsh badlands and arid plains", Pelletine's "dense jungles... tropical grasslands" ────────
  { key: 'elsweyrAnequina', province: 'Elsweyr', name: 'the Anequina Badlands', climate: C.Desert2,
    seeds: [[158, 134], [184, 134], [170, 140], [154, 150]],
    lore: 'Riverhold\'s canyons, Rimmen\'s steppes and Orcrest - red clay, mesas, cracked hardpan' },
  { key: 'elsweyrPelletine', province: 'Elsweyr', name: 'the Pelletine Savanna', climate: C.Subtropical,
    seeds: [[156, 168], [178, 168], [168, 156]],
    lore: 'Torval and Senchal: moon-sugar cane, saltrice, "pristine white beaches"' },
  { key: 'elsweyrTenmar', province: 'Elsweyr', name: 'the Tenmar Forest', climate: C.Rainforest,
    seeds: [[146, 164], [148, 172]],
    lore: 'the jungle against Valenwood, where the moon-sugar cane grows wild' },
  // ── BLACK MARSH: "vast swamplands", the Hist in their heart ────────────────────────────────────────────────────────
  { key: 'blackMarshHist', province: 'BlackMarsh', name: 'the Hist Swamps', climate: C.Swamp,
    seeds: [[254, 128], [244, 150], [246, 136]],
    lore: 'the interior: black peat, standing water, the spore-trees "that grow only in the swamp interior"' },
  { key: 'blackMarshFens', province: 'BlackMarsh', name: 'the Shadowfen', climate: C.Swamp,
    seeds: [[232, 114], [280, 108], [214, 134], [264, 112]],
    lore: 'Stormhold, Thorn and Gideon - raised bog and reed beds toward Morrowind and Cyrodiil' },
  { key: 'blackMarshMurkmire', province: 'BlackMarsh', name: 'Murkmire', climate: C.Rainforest,
    seeds: [[254, 158], [232, 170], [278, 124], [264, 148]],
    lore: 'the southern coasts, Lilmoth and Soulrest: swamp-jungle and mangrove on Topal Bay' },
  // ── MORROWIND: Vvardenfell's ash, the mainland's warm lowlands, the Velothi wall ───────────────────────────────────
  { key: 'morrowindAshlands', province: 'Morrowind', name: 'the Ashlands', climate: C.Mountain, air: C.Desert2,
    seeds: [[246, 40], [253, 40], [242, 34], [258, 32], [236, 70]],
    lore: 'Red Mountain\'s grey country - ash, pumice, basalt; "mild, though often hot, and mostly free from snow and ice"' },
  { key: 'morrowindBitterCoast', province: 'Morrowind', name: 'the Bitter Coast', climate: C.Swamp, air: C.Subtropical,
    seeds: [[252, 49], [248, 62], [242, 45], [258, 48]],
    lore: 'Vvardenfell\'s green rim - the Bitter Coast\'s swamps, the Ascadian Isles\' paddies, Vivec and Ebonheart' },
  { key: 'morrowindDeshaan', province: 'Morrowind', name: 'Deshaan', climate: C.MountainWoods, air: C.Subtropical,
    seeds: [[250, 92], [280, 100], [296, 60], [268, 80]],
    lore: 'the mainland\'s lowlands: Mournhold, Tear, Necrom - fungal valleys and plantations, warm and wet' },
  { key: 'morrowindVelothi', province: 'Morrowind', name: 'the Velothi Mountains', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the wall against Skyrim and Cyrodiil - Morrowind\'s snow is here alone' },
  { key: 'morrowindVelothiFoot', province: 'Morrowind', name: 'the Velothi Foothills', climate: C.Mountain, air: C.Subtropical,
    seeds: [[216, 30], [212, 48]],
    lore: 'Blacklight\'s country under the range: grey and red rock, scree, scrub' },
  // ── CYRODIIL: PGE1's "most is endless jungle" - the Nibenay "enclosed by an equatorial rain forest", "deciduous forest
  //    and mangroves" toward the west coast, "becoming sparser towards the ocean" ─────────────────────────────────────
  { key: 'cyrodiilNibenay', province: 'Imperial', name: 'the Nibenay Jungle', climate: C.Rainforest, jungle: true,
    seeds: [[178, 96], [200, 90], [194, 118], [186, 104], [188, 86]],
    lore: 'the heartland round Lake Rumare and the Niben - the rain forest the Pocket Guide says encloses the valley' },
  { key: 'cyrodiilBlackwood', province: 'Imperial', name: 'Blackwood', climate: C.Swamp, jungle: true,
    seeds: [[200, 136], [192, 130], [204, 126]],
    lore: 'Leyawiin\'s country on Topal Bay - flooded forest and mangrove under the canopy' },
  { key: 'cyrodiilColovia', province: 'Imperial', name: 'the Colovian Jungle', climate: C.Rainforest, jungle: true,
    seeds: [[158, 88], [156, 102], [164, 94], [150, 96]],
    lore: 'Chorrol and Skingrad\'s uplands, the jungle climbing the Colovian Highlands' },
  { key: 'cyrodiilGoldCoast', province: 'Imperial', name: 'the Gold Coast', climate: C.Subtropical,
    seeds: [[138, 112], [148, 108], [140, 104]],
    lore: 'Anvil and Kvatch: "deciduous forest and mangroves, becoming sparser towards the ocean"' },
  { key: 'cyrodiilJerall', province: 'Imperial', name: 'the Jerall Highlands', climate: C.MountainWoods, peaks: true,
    seeds: [[170, 78], [196, 78], [150, 80]],
    lore: 'Bruma\'s cloud forest under the Jerall and the Valus - the province\'s snow' },
].map((b) => Object.freeze({ ...b, seeds: Object.freeze(b.seeds.map((s) => Object.freeze(s))) }))));

/** Each biome by its key, and each province's zones: its seeded zones and its peaks. */
export const BIOME_BY_KEY = new Map(BIOMES.map((b) => [b.key, b]));
const ZONES = new Map();
for (const b of BIOMES) {
  const z = ZONES.get(b.province) ?? { seeded: [], peaks: null };
  if (b.peaks) z.peaks = b;
  if (b.seeds.length) z.seeded.push(b);   // a peaks zone with seeds is a country too (Wrothgar: its highlands and its range)
  ZONES.set(b.province, z);
}

/** A small stable lattice hash, 0..1. */
function hash(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Value noise, 0..1, bilinear between lattice values, smoothstepped. */
function valueNoise(x, y, cell, salt) {
  const qx = x / cell, qy = y / cell, i = Math.floor(qx), j = Math.floor(qy);
  const sx = qx - i, sy = qy - j, u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
  const a = hash(i, j, salt), b = hash(i + 1, j, salt), c = hash(i, j + 1, salt), d = hash(i + 1, j + 1, salt);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
/** A picture point moved by the wander (two octaves, each its own salt per axis). */
export function wanderPoint(px, py) {
  let dx = 0, dy = 0;
  BIOME_WANDER.forEach((o, k) => {
    dx += (valueNoise(px, py, o.cell, 0xb10e + k) - 0.5) * 2 * o.amp;
    dy += (valueNoise(px, py, o.cell, 0x5eed + k) - 0.5) * 2 * o.amp;
  });
  return [px + dx, py + dy];
}

/** THE BIOME AT A PICTURE POINT of a province (its key): its peaks where a range lifts it past PEAKS_LIFT, else the zone
 *  whose seed stands nearest the wandered point; null for a province the table has no zones of. Pure. */
export function biomeAtPicture(province, px, py) {
  const z = ZONES.get(province);
  if (!z) return null;
  if (z.peaks && rangeLift(px, py) >= PEAKS_LIFT) return z.peaks;
  if (!z.seeded.length) return z.peaks;
  const [wx, wy] = wanderPoint(px, py);
  let best = z.seeded[0], bd = Infinity;
  for (const b of z.seeded) {
    for (const [sx, sy] of b.seeds) {
      const d = (sx - wx) * (sx - wx) + (sy - wy) * (sy - wy);
      if (d < bd) { bd = d; best = b; }
    }
  }
  return best;
}

/** @type {Map<number, Biome|null>} */
const _cache = new Map();
const cacheKey = (x, y) => (x + 8192) * 32768 + (y + 8192);
/** For the pins: the cache's size, and a way to drop it (a new trace moves the provinces). */
export const biomeCacheSize = () => _cache.size;
export const dropBiomeCache = () => _cache.clear();

let _land = -1, _fit = null, _stamp = 0;
/** THE ZONES' STAMP: a number that moves whenever the land's trace or the fit does (and the cache with it) - what a
 *  reader that keeps zones of its own (the jungle's field, scenes/jungleHost.js) keys them by. */
export function biomeStamp() {
  const land = tamrielLandVersion(), fit = tamrielFit();
  if (land !== _land || fit !== _fit) { _cache.clear(); _land = land; _fit = fit; _stamp++; }
  return _stamp;
}
/** THE BIOME AT A BAY-COORDINATE PIXEL past the Bay (integers), cached - null on the Bay (Daggerfall's own climates answer
 *  there) and at sea. The cache is the land's and the fit's it was read on: either moving (the trace landing, a fit) drops
 *  it, so no pixel keeps a zone of a province it no longer stands in. */
export function tamrielBiomeAt(x, y) {
  biomeStamp();
  const k = cacheKey(x, y);
  const hit = _cache.get(k);
  if (hit !== undefined) return hit;
  const province = provinceKeyBeyondBay(x, y);
  let b = null;
  if (province) {
    const [px, py] = bayToPicture(x + 0.5, y + 0.5);
    b = biomeAtPicture(province, px, py);
  }
  if (_cache.size >= BIOME_CACHE_MAX) _cache.clear();
  _cache.set(k, b);
  return b;
}
