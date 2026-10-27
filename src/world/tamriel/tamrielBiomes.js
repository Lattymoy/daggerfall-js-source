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
// the lore is what this table follows (the page's sources, each zone's named there). A province is three to nine ZONES:
//   - its CLIMATE, CLIMATE.PAK's value its ground is laid on (the textures, the nature flats, the countryside's and the
//     lairs' rates, the DFU weather table rolled at the player's pixel);
//   - its JUNGLE: the Bantha jungle's law (world/jungle/, bible/03-World/Bantha-Jungle.md) stands on it - Cyrodiil's ring
//     of rain forest round the Nibenay Valley's grassland (PGE1), its Colovian uplands (the owner's call) and Blackwood;
//   - its CANOPY: the jungle's crowns closed over the sky (VALENWOOD-CANOPY, the owner: "i want valenwood to have no sky
//     like the trees will cover it up") - Valenwood's forest, Grahtwood, Malabal Tor and Greenshade: its graht-oaks stand
//     over the jungle and close the sky with their crowns (GRAHT1 - world/jungle/grahtOaks.js, scenes/grahtHost.js), the
//     light under them the canopy's (world/jungle/jungleCanopy.js); Reaper's March, where the forest gives way to the
//     plains, keeps its sky;
//   - its AIR, where the lore's air is not its ground's climate's (Morrowind's grey volcanic ground under a warm sky): the
//     climate the air law reads there (tamrielGround.js groundAirClimateIndex, systems/weather/airGround.js);
//   - its ASH (ASHFALL1): the share of its sky's hours the ashfall stands over it - the weather map's births there
//     (systems/weather/weatherMap.js ashOfField), the volcano's country alone;
//   - its FAUNA: systems/tamrielFauna.js, by the biome's key.
// WHERE A ZONE IS: its province's land (tamrielLand.js provinceKeyBeyondBay - the player's own trace once it lands, the
// authored rings before it or with `?tamrieltrace=off`), the zone whose SEEDS stand nearest the point moved first by two
// octaves of value noise (BIOME_WANDER), so a border bends through the land and never runs as a straight bisector - and
// (AUDIT TESA II J4) near a province's border the neighbour's seeds and peaks beside its own where the moved point stands
// on the neighbour's land, so a zone's edge bends through the trace's province border too (biomeAtPicture). A seed
// is a city (tamrielGeography.js CITIES, by name) or a region's heart (a picture point), and it is STOOD on the land in use
// (standSeeds): a seed off its province's land there is moved onto the nearest of it within SEED_SNAP, as the places
// themselves are (tamrielPlaces.js snapToProvince) - so a zone holds its cities on the trace and on the rings alike
// (AUDIT TESA-BIOME Z1/Z2). A PEAKS zone takes every point a mountain range lifts past PEAKS_LIFT (tamrielGeography.js
// rangeLiftBy - the height law's own band): one naming its ranges takes theirs (Red Mountain's own, the Velothi's
// wall excepted - Z6), the province's other peaks zone every other range's; where the relief stands, a province's highest
// land past the Bay near its ranges (TAMRIEL-RELIEF, AUDIT TESA II G5/G11). A zone's HEARTS may stand about a named range's
// summit (AUDIT TESA II G6: Vvardenfell's lowlands about Red Mountain, the relief's cone or the authored spine).
// Pure, deterministic, read by the terrain worker (its import graph is world/ and formats/ alone: TAMRIEL2-WORKER), and
// cached a pixel.
// ═══════════════════════════════════════════════════════════════════
import { provinceKeyAt, provinceKeyBeyondBay, tamrielLandVersion } from './tamrielLand.js';
import { bayToPicture, tamrielFit } from './tamrielFrame.js';
import { rangeLiftBy, spineDistance, CITIES, MOUNTAIN_RANGES } from './tamrielGeography.js';
import { reliefStands, reliefAt, peaksLine, namedSummit, NAMED_REACH } from './tamrielRelief.js';   // TAMRIEL-RELIEF: the peaks where the heightmap stands high
import { CLIMATES } from '../../formats/mapsTables.js';

/** A range's lift past this (0..1, tamrielGeography.js rangeLiftBy) is its province's peaks: the Jerall, the Throat of the
 *  World, the Velothi, the Valus, the Druadach, the Wrothgarians, the Dragontail, Eton Nir and Red Mountain at their
 *  spines and flanks (the Reach's karst too); the Colovian Highlands (gain 0.6) and the Tenmar Hills (0.4) never reach
 *  it - they are their zones' own uplands. */
export const PEAKS_LIFT = 0.62;
/** The border's wander, picture units: two octaves of value noise, each a lattice cell and an amplitude. */
export const BIOME_WANDER = Object.freeze([Object.freeze({ cell: 9, amp: 2.4 }), Object.freeze({ cell: 3, amp: 0.7 })]);
/** How far a seed off its province's land is moved onto it, picture units - the farthest a city's own place is snapped on
 *  the freeware trace is about 16 (Archon), so a seed reaches as far. */
export const SEED_SNAP = 18;
/** A city's own ground, picture units: a point this near a stood city seed is that city's zone, before the peaks and the
 *  wander - a city stands in its country's valley, never on the range's crown or across a bent border (Evermore stood on
 *  the Wrothgarians' flank on the freeware trace, Gilane on the coast an inland heart snapped to). A region's heart stood
 *  this near another zone's city gives way to it. */
export const CITY_GROUND = 1.5;
/** AUDIT TESA II G5: where the relief stands, a province's `peaks: true` zone takes its high ground only this near (picture
 *  units) to the authored spine of a range its law calls peaks (gain PEAKS_LIFT and over - not the Colovian Highlands or
 *  the Tenmar Hills) that no zone of its province names - the 8% share alone set "the Velothi Mountains"' snow on Deshaan's
 *  own heart and Eton Nir on Summerset's southern isle. The spines were drawn from memory and stand a few units off the
 *  heightmap's ridges (the Jerall's 2, the Valus' 6, Eton Nir's 8): every main ridge stands within it, the strays past it. */
export const PEAKS_SEEK = 12;
/** The pixel cache: entries before it is dropped whole (the stream asks a few hundred pixels many times). */
export const BIOME_CACHE_MAX = 262144;
/** THE ZONES' LAW'S VERSION - moved whenever the table or its law changes what a pixel reads, so a store of answers made
 *  with them (the roads' regions in IndexedDB, world/tamrielRoads.js inputsPrint) is made again (AUDIT TESA-BIOME Z3). */
export const BIOMES_VERSION = 5;   // TAMRIEL-RELIEF: the peaks on the heightmap where the trace stands; IC-RING: the valley's city and the jungle's ring moved; AUDIT TESA II (G1-G12, Z8, J4): the coast's ease and the inland floor, the peaks near their ranges and of the land past the Bay, Vvardenfell's zones about Red Mountain and the Grazelands, a zone's province read at the wandered point, the landforms' hills past the Bay

const C = CLIMATES;
/** @typedef {readonly [number, number]} Point */
/** @typedef {{ key: string, province: string, name: string, climate: number, seeds: ReadonlyArray<Point>,
 *   places: ReadonlyArray<string>, peaks?: boolean|ReadonlyArray<string>, jungle?: boolean, canopy?: boolean, air?: number,
 *   ash?: number, hearts?: Readonly<{ range: string, at: ReadonlyArray<Point> }>, lore: string }} Biome - `hearts` (AUDIT TESA II G6) the
 *   zone's hearts as offsets (picture units) from a named range's summit: the relief's where it stands (tamrielRelief.js
 *   namedSummit), the authored spine's middle else - a country that lies ABOUT a mountain stands about it on either land */
const CITY_AT = new Map(CITIES.map((c) => [c.name, c.at]));
/** The volcano's range (tamrielGeography.js RANGES' name - a key, never shown): its own zone's peaks, and the hearts
 *  Vvardenfell's lowlands stand about (AUDIT TESA II G6). */
const RED_MOUNTAIN = 'Red Mountain';
/** THE BIOMES. `seeds` a city's name or a picture point (x east, y south - CITIES' frame); `hearts` points about a named
 *  range's summit (above); `peaks` true takes the lift of every range its province's other peaks zone does not name, an
 *  array the lift of those ranges alone; a peaks zone's seeds (if any) make it a country of its own besides. */
/** @type {ReadonlyArray<Readonly<Biome>>} */
export const BIOMES = Object.freeze(/** @type {any[]} */ ([
  // ── SKYRIM: the cold and rugged land of the Nords - the north white the year round, the south pine (TES V's holds) ──
  { key: 'skyrimFrozenCoast', province: 'Skyrim', name: 'the Frozen Coast', climate: C.Mountain,
    seeds: ['Dawnstar', 'Winterhold', [168, 20], [196, 22]],
    lore: 'the Pale\'s and Winterhold\'s shore on the Sea of Ghosts - snowfields, tundra and drift ice' },
  { key: 'skyrimTundra', province: 'Skyrim', name: 'the Tundra Plains', climate: C.MountainWoods,
    seeds: ['Whiterun', 'Windhelm', 'Morthal', [172, 46]],
    lore: 'Whiterun\'s plains, Hjaalmarch\'s marsh about Morthal and Eastmarch\'s hot springs about Windhelm - tundra grass, stone and lichen' },
  { key: 'skyrimPinewood', province: 'Skyrim', name: 'the Pinewoods', climate: C.MountainWoods,
    seeds: ['Falkreath', 'Riften', 'Solitude', [180, 58]],
    lore: 'Haafingar\'s Karth forest under Solitude\'s cliffs, Falkreath\'s pine and the Rift\'s aspens' },
  { key: 'skyrimReach', province: 'Skyrim', name: 'the Reach', climate: C.Mountain,
    seeds: ['Markarth', [127, 36]],
    lore: 'Markarth\'s crags on the High Rock border - karst, gorges, the Reachmen and their hagravens' },
  { key: 'skyrimPeaks', province: 'Skyrim', name: 'the High Peaks', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the Throat of the World, the Druadach, the Jerall\'s north face and the Velothi\'s west - snow the year round' },
  // ── HIGH ROCK past the Bay: Wrothgar's Orc highlands, Bangkorai's march, Rivenspire's moors, Northpoint's green shore ──
  { key: 'highRockWrothgar', province: 'HighRock', name: 'the Wrothgarian Mountains', climate: C.Mountain, peaks: true,
    seeds: [[108, 44], [112, 36]],
    lore: 'Wrothgar, where Gortwog raises Orsinium again in Daggerfall\'s day - snowfields, granite, Orc holds, the dragonlings of its crags' },
  { key: 'highRockBangkorai', province: 'HighRock', name: 'Bangkorai', climate: C.MountainWoods,
    seeds: ['Evermore', [98, 60]],
    lore: 'Evermore\'s march on the passes to Hammerfell - pine and scrub over red canyons' },
  { key: 'highRockRivenspire', province: 'HighRock', name: 'the Rivenspire Moors', climate: C.HauntedWoodlands,
    seeds: ['Shornhelm', 'Farrun', 'Jehanna'],
    lore: 'Shornhelm\'s bleak uplands over the Sea of Ghosts - peat moor and wind-bent trees, a country of old houses and their dead' },
  { key: 'highRockNorthpoint', province: 'HighRock', name: 'the Northpoint Coast', climate: C.Woodlands,
    seeds: ['Northpoint', [50, 40], [56, 46]],
    lore: 'Northpoint\'s shore on the open western ocean - oak and beech over green turf, the Bay\'s own kind of country' },
  // ── HAMMERFELL past the Bay: the Alik'r, Craglorn's red badlands, the Abecean coast ─────────────────────────────────
  { key: 'hammerfellAlikr', province: 'Hammerfell', name: 'the Alik\'r Desert', climate: C.Desert,
    seeds: ['Skaven', [76, 96], [96, 100], [62, 102]],
    lore: 'the Alik\'r - dunes and sandstorms over the Yokudan tombs' },
  { key: 'hammerfellCraglorn', province: 'Hammerfell', name: 'Craglorn', climate: C.Desert2,
    seeds: ['Dragonstar', 'Elinhir', [116, 78]],
    lore: 'Dragonstar\'s and Elinhir\'s red mesas and canyons toward Skyrim and Cyrodiil - Dwemer ruins and Nedic tombs' },
  { key: 'hammerfellCoast', province: 'Hammerfell', name: 'the Abecean Coast', climate: C.Subtropical,
    seeds: ['Taneth', 'Gilane', 'Rihad', 'Hegathe'],
    lore: 'Taneth, Rihad, Gilane and Hegathe on the Abecean Sea - palms and white beaches' },
  { key: 'hammerfellDragontail', province: 'Hammerfell', name: 'the Dragontail Mountains', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the Dragontail\'s spine over the desert, snow on its crowns' },
  // ── SUMMERSET: a warm climate, colourful forests, meadows and craggy mountains ───────────────────────────────────────
  { key: 'summersetVineCoast', province: 'Sumurset', name: 'the Vine Coast', climate: C.Subtropical,
    seeds: ['Alinor', 'Dusk', 'Sunhold', 'Lillandril', 'Shimmerene', 'Cloudrest'],
    lore: 'Alinor\'s coasts: vineyards, golden meadows, the gold and crimson groves' },
  { key: 'summersetAuridon', province: 'Sumurset', name: 'Auridon', climate: C.Woodlands,
    seeds: ['Firsthold', 'Skywatch'],
    lore: 'the sister isle, more forest than vine' },
  { key: 'summersetEtonNir', province: 'Sumurset', name: 'Eton Nir', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'Eton Nir, the isle\'s highest peak - snow on its summit alone' },
  // ── VALENWOOD: a sea of endless green, the Green Pact's untouched forest ────────────────────────────────────────────
  { key: 'valenwoodGrahtwood', province: 'Valenwood', name: 'Grahtwood', climate: C.Rainforest, jungle: true, canopy: true,
    seeds: ['Falinesti', 'Elden Root', [128, 150]],
    lore: 'Falinesti\'s and Elden Root\'s country - the graht-oaks that hold cities, lianas, little light on the floor' },
  { key: 'valenwoodMalabal', province: 'Valenwood', name: 'Malabal Tor', climate: C.Rainforest, jungle: true, canopy: true,
    seeds: ['Silvenar', [108, 132], [120, 128]],
    lore: 'the deep northern canopy about Silvenar: the densest forest, its rivers, its Wood Orcs' },
  { key: 'valenwoodGreenshade', province: 'Valenwood', name: 'Greenshade', climate: C.Swamp, jungle: true, canopy: true,
    seeds: ['Woodhearth', 'Southpoint', 'Haven', [84, 146]],
    lore: 'the western and southern coasts - Woodhearth, Haven and Southpoint among the mangrove swamps' },
  { key: 'valenwoodReapersMarch', province: 'Valenwood', name: 'Reaper\'s March', climate: C.Subtropical,
    seeds: ['Arenthia', [142, 140]],
    lore: 'Arenthia\'s march on the border with Elsweyr, the forest giving way to plains' },
  // ── ELSWEYR: Anequina's badlands and dry plains in the north, Pellitine's jungles and coasts in the south ───────────
  { key: 'elsweyrAnequina', province: 'Elsweyr', name: 'the Anequina Badlands', climate: C.Desert2,
    seeds: ['Riverhold', 'Dune', [150, 140]],
    lore: 'Riverhold\'s and Dune\'s canyons - red clay, mesas and cracked hardpan' },
  { key: 'elsweyrPlains', province: 'Elsweyr', name: 'the Anequina Plains', climate: C.Subtropical,
    seeds: ['Rimmen', 'Orcrest', [180, 142]],
    lore: 'Rimmen\'s and Orcrest\'s steppes - the north\'s dry savanna' },
  { key: 'elsweyrPellitine', province: 'Elsweyr', name: 'the Pellitine Coast', climate: C.Subtropical,
    seeds: ['Torval', 'Senchal', [170, 172]],
    lore: 'Torval\'s and Senchal\'s shore on Topal Bay - white beaches, saltrice and sugar' },
  { key: 'elsweyrTenmar', province: 'Elsweyr', name: 'the Tenmar Forest', climate: C.Rainforest,
    seeds: ['Corinthe', [166, 162], [172, 158]],
    lore: 'the Tenmar between Torval and Senchal - jungle, moon-sugar cane growing wild, senche-tigers' },
  // ── BLACK MARSH: vast swamplands, the Hist in their heart ────────────────────────────────────────────────────────────
  { key: 'blackMarshHist', province: 'BlackMarsh', name: 'the Hist Swamps', climate: C.Swamp,
    seeds: ['Helstrom', 'Blackrose', [246, 136]],
    lore: 'the interior: black peat, standing water, the Hist in their groves' },
  { key: 'blackMarshFens', province: 'BlackMarsh', name: 'the Shadowfen', climate: C.Swamp,
    seeds: ['Stormhold', 'Thorn', [264, 112]],
    lore: 'Stormhold\'s and Thorn\'s north - raised bog and reed beds toward Morrowind' },
  { key: 'blackMarshMurkmire', province: 'BlackMarsh', name: 'Murkmire', climate: C.Rainforest,
    seeds: ['Lilmoth', 'Soulrest', 'Archon', [264, 148]],
    lore: 'the southern and eastern coasts - Lilmoth, Soulrest and Archon in swamp-jungle and mangrove' },
  { key: 'blackMarshGloomire', province: 'BlackMarsh', name: 'Blackwood', climate: C.Swamp, jungle: true,
    seeds: ['Gideon', [222, 140]],
    lore: 'Gideon\'s flooded hillscape - Blackwood across the border from Leyawiin, the jungle under its canopy' },
  // ── MORROWIND: Vvardenfell's ash and its volcano, the mainland's ash coast, warm lowlands and fungal peninsula, the
  //    Velothi wall - grey volcanic ground under a warm sky ──────────────────────────────────────────────────────────
  // AUDIT TESA II G6: Vvardenfell's lowland hearts stand about Red Mountain's own summit (`hearts`) - the relief set the
  // volcano fifteen units south-west of its authored spine, and the hearts drawn about the spine left it ringed by the
  // Bitter Coast's swamp and Stonefalls, the Ashlands ten units off where the Grazelands lie (TES III: the Ashlands north
  // and west of the mountain, the Grazelands north-east, the Bitter Coast south-west)
  // ASHFALL1 (the owner: "with the volcanic isles we could do an ashfall sort of weather with tiny lava flakes"): `ash`, the
  // share of a zone's hours under the ashfall - the Ashlands TES III's own (its region's weather: Ash 30%, beside Clear 10,
  // Cloudy 25, Foggy 10, Overcast 25; Molag Amur's the only other ash), the volcano's own the most (TES III's main quest
  // stands a Blight storm on Red Mountain every hour; the port's 3E 405 is before the Blight's worst, so the ash, at
  // half), Stonefalls the least (ESO's loading screen: "the ashfall from the volcanoes of the Velothi Mountains and
  // from great Ash Mountain itself is Stonefalls' bane and benefit, fertilizing the soil")
  { key: 'morrowindAshlands', province: 'Morrowind', name: 'the Ashlands', climate: C.Mountain, air: C.Desert2, ash: 0.3,
    seeds: ['Ald\'ruhn'], hearts: { range: RED_MOUNTAIN, at: [[0, -9], [-9, -1]] },
    lore: 'Ald\'ruhn\'s grey country about Red Mountain - ash, pumice and basalt under the ash storms' },
  { key: 'morrowindGrazelands', province: 'Morrowind', name: 'the Grazelands', climate: C.Woodlands, air: C.Subtropical,
    seeds: [], hearts: { range: RED_MOUNTAIN, at: [[7, -7]] },
    lore: 'Vvardenfell\'s north-east between Red Mountain and Zafirbel Bay - grass plains and few trees, the Zainab\'s guar herds' },
  { key: 'morrowindRedMountain', province: 'Morrowind', name: 'Red Mountain', climate: C.Mountain, air: C.Desert2, ash: 0.5,
    peaks: [RED_MOUNTAIN], seeds: [],
    lore: 'the volcano at Vvardenfell\'s heart - ash and blighted rock, never snow' },
  { key: 'morrowindAscadian', province: 'Morrowind', name: 'the Ascadian Isles', climate: C.Woodlands, air: C.Subtropical,
    seeds: ['Vivec', [258, 46]],
    lore: 'Vivec\'s farmlands, lakes and woods on the Inner Sea' },
  { key: 'morrowindBitterCoast', province: 'Morrowind', name: 'the Bitter Coast', climate: C.Swamp, air: C.Subtropical,
    seeds: [], hearts: { range: RED_MOUNTAIN, at: [[-7, 7], [-2, 9]] },
    lore: 'Vvardenfell\'s south-west shore - swamp, mangrove and smugglers\' coves' },
  { key: 'morrowindStonefalls', province: 'Morrowind', name: 'Stonefalls', climate: C.Mountain, air: C.Desert2, ash: 0.15,
    seeds: ['Ebonheart', [236, 70]],
    lore: 'Ebonheart\'s and Kragenmoor\'s mainland coast across from Vvardenfell - lava fields and ash' },
  { key: 'morrowindDeshaan', province: 'Morrowind', name: 'Deshaan', climate: C.MountainWoods, air: C.Subtropical,
    seeds: ['Mournhold', 'Tear', [268, 80]],
    lore: 'Mournhold\'s and Tear\'s lowlands - fungal valleys and plantations, warm and wet' },
  { key: 'morrowindTelvanni', province: 'Morrowind', name: 'the Telvanni Peninsula', climate: C.MountainWoods, air: C.Subtropical,
    seeds: ['Necrom', [288, 40]],
    lore: 'the peninsula to Necrom on the Padomaic coast - giant mushrooms, the wizards\' towers' },
  { key: 'morrowindVelothiFoot', province: 'Morrowind', name: 'the Velothi Foothills', climate: C.Mountain, air: C.Subtropical,
    seeds: ['Blacklight', [212, 48]],
    lore: 'Blacklight\'s country under the range: grey and red rock, scree, scrub' },
  { key: 'morrowindVelothi', province: 'Morrowind', name: 'the Velothi Mountains', climate: C.Mountain, peaks: true, seeds: [],
    lore: 'the wall against Skyrim and Cyrodiil - Morrowind\'s snow is here alone' },
  // ── CYRODIIL: PGE1's "most is endless jungle" - "its center, the grassland of the Nibenay Valley, is enclosed by an
  //    equatorial rain forest"; "deciduous forest and mangroves" toward the west coast ─────────────────────────────────
  { key: 'cyrodiilNibenayValley', province: 'Imperial', name: 'the Nibenay Valley', climate: C.Woodlands,
    seeds: ['Imperial City'],
    lore: 'the grassland at the centre, round Lake Rumare and the Imperial City' },
  { key: 'cyrodiilNibenay', province: 'Imperial', name: 'the Nibenay Jungle', climate: C.Rainforest, jungle: true,
    seeds: ['Cheydinhal', 'Bravil', [161, 101], [173, 89], [185, 101], [183, 110], [165, 109]],   // IC-RING: the jungle's ring moved with the city (-7, +3), [183, 110] for the lake's [181, 111]
    lore: 'the equatorial rain forest enclosing the valley - the Great Forest, Cheydinhal\'s and Bravil\'s country' },
  { key: 'cyrodiilBlackwood', province: 'Imperial', name: 'Blackwood', climate: C.Swamp, jungle: true,
    seeds: ['Leyawiin', [192, 130], [204, 126]],
    lore: 'Leyawiin\'s country on Topal Bay - flooded forest and mangrove under the canopy' },
  { key: 'cyrodiilColovia', province: 'Imperial', name: 'the Colovian Jungle', climate: C.Rainforest, jungle: true,
    seeds: ['Chorrol', 'Skingrad', [136, 96], [150, 96]],
    lore: 'Chorrol\'s and Skingrad\'s uplands, the jungle climbing the Colovian Highlands' },
  { key: 'cyrodiilGoldCoast', province: 'Imperial', name: 'the Gold Coast', climate: C.Woodlands,
    seeds: ['Anvil', 'Kvatch', [136, 110]],
    lore: 'Anvil and Kvatch: the deciduous forest and mangroves, becoming sparser towards the ocean' },
  { key: 'cyrodiilJerall', province: 'Imperial', name: 'the Jerall Highlands', climate: C.MountainWoods, peaks: true,
    seeds: ['Bruma', [196, 78], [150, 80]],
    lore: 'Bruma\'s cloud forest under the Jerall and the Valus - the province\'s snow' },
].map((b) => {
  const places = b.seeds.filter((s) => typeof s === 'string');
  for (const n of places) if (!CITY_AT.has(n)) throw new Error(`tamrielBiomes: no city ${n}`);
  const seeds = b.seeds.map((s) => Object.freeze(typeof s === 'string' ? [...CITY_AT.get(s)] : [s[0], s[1]]));
  if (b.hearts && !MOUNTAIN_RANGES.some((m) => m.name === b.hearts.range)) throw new Error(`tamrielBiomes: no range ${b.hearts.range}`);
  const hearts = b.hearts ? Object.freeze({ range: b.hearts.range, at: Object.freeze(b.hearts.at.map((d) => Object.freeze([d[0], d[1]]))) }) : undefined;
  return Object.freeze({ ...b, seeds: Object.freeze(seeds), places: Object.freeze(places), peaks: Array.isArray(b.peaks) ? Object.freeze([...b.peaks]) : b.peaks, ...(hearts ? { hearts } : {}) });
})));

/** Each biome by its key; each province's zones - its seeded zones and its peaks (those naming their ranges first). */
export const BIOME_BY_KEY = new Map(BIOMES.map((b) => [b.key, b]));
/** ASHFALL1: THE VOLCANO'S COUNTRY - each ash share a zone names, with the climate its ground is laid on, once
 *  ([climate, ash]): the weather map's ash laws (systems/weather/weatherMap.js birthLaw) and the ceilings its births
 *  are drawn at - every law a birth can read. */
export const ASH_COUNTRY = Object.freeze([...new Map(BIOMES.filter((b) => b.ash > 0).map((b) => [`${b.climate}:${b.ash}`, Object.freeze([b.climate, b.ash])])).values()]);
for (const [, a] of ASH_COUNTRY) if (!(a < 1)) throw new Error(`tamrielBiomes: an ash share of ${a} - the ash takes a share of the sky's hours`);
const ZONES = new Map();
for (const b of BIOMES) {
  const z = ZONES.get(b.province) ?? { seeded: [], named: [], peaks: null };
  if (Array.isArray(b.peaks)) z.named.push(b);
  else if (b.peaks) z.peaks = b;
  if (b.seeds.length || b.hearts) z.seeded.push(b);   // a peaks zone with seeds is a country too (Wrothgar: its highlands and its range)
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

/** A picture point onto its province's land in use, within SEED_SNAP (the nearest land pixel's centre, in rings outward),
 *  or null - itself where it stands on it already. */
function standOn(province, x, y) {
  if (provinceKeyAt(x, y) === province) return [x, y];
  const cx = Math.floor(x), cy = Math.floor(y);
  let best = null, bd = SEED_SNAP * SEED_SNAP + 1e-9;
  for (let r = 1; r <= SEED_SNAP; r++) {
    if (best && (r - 1) * (r - 1) > bd) break;
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const qx = cx + i + 0.5, qy = cy + j + 0.5;
        const d = (qx - x) * (qx - x) + (qy - y) * (qy - y);
        if (d >= bd || provinceKeyAt(qx, qy) !== province) continue;
        bd = d; best = [qx, qy];
      }
    }
  }
  return best;
}
/** AUDIT TESA II G6: the point a zone's `hearts` stand about - its range's summit on the relief where the relief stands
 *  (tamrielRelief.js namedSummit), else (no relief, or no summit of the province there) its authored spine's middle. */
export function heartsAnchor(province, range) {
  const r = /** @type {{ pts: ReadonlyArray<ReadonlyArray<number>> }} */ (MOUNTAIN_RANGES.find((m) => m.name === range));
  const s = reliefStands() ? namedSummit(province, range, r.pts) : null;
  if (s) return s;
  return [r.pts.reduce((a, q) => a + q[0], 0) / r.pts.length, r.pts.reduce((a, q) => a + q[1], 0) / r.pts.length];
}
let _seedsLand = -1, _stood = new Map();
/** THE SEEDS AS THEY STAND on the land in use (made again when the land moves): a province's [biome, x, y, city] - a seed
 *  off its province's land moved onto it, one with none within SEED_SNAP left out (Z1), a region's heart stood within
 *  CITY_GROUND of another zone's city left out too; a zone's `hearts` about their range's summit (heartsAnchor). */
export function standSeeds() {
  const land = tamrielLandVersion();
  if (land !== _seedsLand) {
    _seedsLand = land;
    _stood = new Map();
    for (const [province, z] of ZONES) {
      const at = [];
      for (const b of z.seeded) {
        b.seeds.forEach(([sx, sy], i) => { const q = standOn(province, sx, sy); if (q) at.push([b, q[0], q[1], i < b.places.length]); });
        if (b.hearts) {
          const [ax, ay] = heartsAnchor(province, b.hearts.range);
          for (const [dx, dy] of b.hearts.at) { const q = standOn(province, ax + dx, ay + dy); if (q) at.push([b, q[0], q[1], false]); }
        }
      }
      const cities = at.filter((s) => s[3]);
      _stood.set(province, at.filter((s) => s[3] || !cities.some((c) => c[0] !== s[0] && Math.hypot(c[1] - s[1], c[2] - s[2]) < CITY_GROUND)));
    }
  }
  return _stood;
}

/** AUDIT TESA II G5: the ranges a province's `peaks: true` zone stands near - its law's peaks ranges (gain PEAKS_LIFT and
 *  over) that no zone of the province names, made once a province. */
const _peakRanges = new Map();
const peakRangesOf = (province, z) => {
  let r = _peakRanges.get(province);
  if (!r) _peakRanges.set(province, r = MOUNTAIN_RANGES.filter((m) => m.gain >= PEAKS_LIFT && !z.named.some((b) => b.peaks.includes(m.name))));
  return r;
};
/** A province's PEAKS ZONE at a picture point, or null: where its ranges lift it past PEAKS_LIFT (those naming their ranges
 *  first); with the relief, its highest land (peaksLine) near its ranges (AUDIT TESA II G5), a named range's at its summit. */
function peaksAt(province, z, px, py) {
  if (reliefStands()) {   // TAMRIEL-RELIEF: the province's highest land (world/tamriel/tamrielRelief.js), a named range's at its summit
    if (!(z.named.length || z.peaks) || reliefAt(px, py) < peaksLine(province)) return null;
    for (const b of z.named) {
      for (const name of b.peaks) {
        const r = MOUNTAIN_RANGES.find((m) => m.name === name), s = r ? namedSummit(province, name, r.pts) : null;
        if (s && Math.hypot(px - s[0], py - s[1]) <= NAMED_REACH) return b;
      }
    }
    return z.peaks && peakRangesOf(province, z).some((m) => spineDistance(m, px, py) <= PEAKS_SEEK) ? z.peaks : null;   // AUDIT TESA II G5: near its ranges
  }
  for (const b of z.named) if (rangeLiftBy(px, py, (n) => b.peaks.includes(n)) >= PEAKS_LIFT) return b;
  return z.peaks && rangeLiftBy(px, py) >= PEAKS_LIFT ? z.peaks : null;   // a named range past the line is its own zone's, above
}
/** THE BIOME AT A PICTURE POINT of a province (its key - the one the point stands on), on the land in use:
 *   - a city's own ground first (CITY_GROUND);
 *   - a peaks zone where its province's ranges lift it past PEAKS_LIFT (those naming their ranges first; with the relief,
 *     its highest land near its ranges - AUDIT TESA II G5: peaksAt) - AUDIT TESA II J4: and where the wandered point falls
 *     on another province's land, that province's peaks there too (a ridge two provinces share wears its snow across);
 *   - else the zone whose stood seed stands nearest the wandered point (wanderPoint) - AUDIT TESA II J4: among its own
 *     province's seeds AND, where the wandered point falls on another province's land, that province's: so near a border
 *     the nearer country's zone takes the point across it, and a zone's edge bends through the trace's province border,
 *     whose staircase of 12.7 km picture pixels had run the jungle's edge straight for up to 88 km. The province (its
 *     name, its region, its people) stays the point's own; a point crosses only within the wander's reach of the border,
 *     and only to a country whose heart is nearer than its own's (Thorn and Torval stand in their own zones on the trace).
 * null for a province the table has no zones of. Pure over the land. */
export function biomeAtPicture(province, px, py) {
  const z = ZONES.get(province);
  if (!z) return null;
  const stood = standSeeds(), seeds = stood.get(province) ?? [];
  const [wx, wy] = wanderPoint(px, py);
  const across = provinceKeyAt(wx, wy);
  const other = across && across !== province ? stood.get(across) ?? [] : [];
  for (const [b, sx, sy, city] of seeds) if (city && (sx - px) * (sx - px) + (sy - py) * (sy - py) < CITY_GROUND * CITY_GROUND) return b;
  const peaks = peaksAt(province, z, px, py) ?? (other.length ? peaksAt(/** @type {string} */ (across), ZONES.get(across), px, py) : null);   // AUDIT TESA II J4: the neighbour's range too, across the border
  if (peaks) return peaks;
  if (!seeds.length && !other.length) return z.peaks ?? z.seeded[0] ?? null;
  let best = (seeds[0] ?? other[0])[0], bd = Infinity;
  for (const list of [seeds, other]) {
    for (const [b, sx, sy] of list) {
      const d = (sx - wx) * (sx - wx) + (sy - wy) * (sy - wy);
      if (d < bd) { bd = d; best = b; }
    }
  }
  return best;
}

/** @type {Map<number, Biome|null>} */
const _cache = new Map();
/** A pixel's key: exact for every pixel within 32768 of the Bay's corner (the wire's world is 8192 - Z10). */
const cacheKey = (x, y) => (x + 32768) * 65536 + (y + 32768);
/** For the pins: the cache's size (the land's, as it stands), and a way to drop it. */
export const biomeCacheSize = () => { biomeStamp(); return _cache.size; };
export const dropBiomeCache = () => _cache.clear();

let _land = -1, _fitObj = null, _fitKey = '', _stamp = 0;
/** THE ZONES' STAMP: a number that moves whenever the land's trace or the fit does (the fit by its numbers, so a fit
 *  installed again the same moves nothing - Z11), and the cache with it - what a reader that keeps zones of its own (the
 *  jungle's field, scenes/jungleHost.js; the air's tiles, systems/weather/airTemperature.js) keys them by. */
export function biomeStamp() {
  const land = tamrielLandVersion(), f = tamrielFit();
  if (land === _land && f === _fitObj) return _stamp;   // the hot path: nothing installed since the last read
  const fitKey = f ? `${f.ox},${f.oy},${f.ppu}` : '';
  _fitObj = f;
  if (land !== _land || fitKey !== _fitKey) { _cache.clear(); _land = land; _fitKey = fitKey; _stamp++; }
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
