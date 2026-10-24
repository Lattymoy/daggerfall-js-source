// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PRECIP1 (2026-10-19, the owner: "I also want to begin giving each biome their own precipitation. It shouldnt snow
// everywhere or rain everywhere when the season is winter, etc. It should truly be dynamic just like how we have a dynamic
// cloud and weather system. If its snowing in one area and raining in the next, the transition should be seamless both in
// ground texture and everything else. This needs to be accurate and as detailed as possible") - THE AIR: a temperature
// (degrees Celsius) at every place, height and minute, pure in the three - the same on every client, offline and online,
// as the weather map is (weatherMap.js). bible/07-Rendering/Biome-Precipitation.md is the record.
//
// DFU has no temperature. Its weather table rolls Snow for a climate in Winter and never otherwise; its ground swaps
// to the winter archive for every climate but a Desert base on the calendar; the port's WEATHER2a funnelled rain over
// that ground into snow. So a winter's rain in the Rainforest fell as snow, a summer storm on a 1,900 m peak fell as
// rain, and the line between the two was a map pixel's straight edge. Here the PHASE of what falls (snowShareOf) and
// the snow the ground keeps (snowpack.js) are read off one physical quantity:
//
//   T = the climate's season (CLIMATE_AIR, a cosine through the year, coldest late Morning Star)
//     + its day (warmest mid-afternoon, coldest before dawn - damped under cloud)
//     + the synoptic spell (a drifting value noise in space and time: a cold snap, a thaw, never rolled)
//     - LAPSE_C_PER_M x the height above the sea (DFU's terrain heights: kernel units x 1.25 m, the sea at 34 m)
//     - a falling system's own chill (the air under rain or snow is cooler; a snow front brings its cold with it)
//
// THE CLIMATE BLENDS. A climate's numbers stand at its map pixel's CENTRE and are read bilinearly between centres - so
// the air warms across a Mountain-to-Desert border over the pixel either side of it, never at the edge. A BIOME OVERLAY
// (the jungle of Bantha - world/jungle/jungleRegion.js's field) leans the numbers toward its own by its share, so the
// jungle's rain stops at its wandering edge in a band of sleet, and the snow begins.
import { CLIMATES, MAX_MAP_PIXEL_Y } from '../../formats/mapsFile.js';
import { TERRAIN_SIZE, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION } from '../../world/terrain/terrainSampler.js';
import { ETHER_BOX, ETHER_MARGIN } from '../../world/ethericSea.js';
import { seededFirst } from '../wind/wind.js';

/** The sea's surface in world metres (the kernel's ocean elevation, at the streamed scale) - heights are above it. */
export const SEA_LEVEL_M = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
/** The air cools this much a metre up (the standard atmosphere's 6.5 degrees a kilometre). */
export const LAPSE_C_PER_M = 0.0065;
/** The year's day the climate is coldest (0 the 1st of Morning Star; the year is 360 days). The warmest stands 180 on. */
export const COLDEST_DAY = 20;
/** The hour the day is warmest; the coldest is twelve hours round. */
export const WARMEST_HOUR = 15;

/**
 * EACH CLIMATE'S AIR AT THE SEA (degrees C): its year's `mean`, the half-range of its seasons `amp`, the half-range of its
 * day `day`, and how hard its weather swings `spell` (the synoptic anomaly's amplitude). Ocean is the Bay's mild maritime
 * air; Desert and Desert2 the Alik'r and the Dak'fron, hot, dry and wide-ranging by day; Mountain and MountainWoods the
 * continental air of High Rock's ranges and the Dragontail (their height above the sea does the rest - LAPSE_C_PER_M);
 * Rainforest the steady tropics; Swamp and Subtropical the Bay's warm south. Chosen so a winter at the ground the player
 * stands on (measured on the freeware's data, the record's table) falls as DFU's table says it should - the woodlands and
 * the ranges white, the desert, the jungle and the subtropics never - and so the cases between (a coast in a cold snap, a
 * valley in a thaw, a summer peak at night) fall as the air there decides. AUDIT PRECIP AIR-3/7: the means were fitted
 * at the byte's height, 110 m to 900 m under that ground, against rows that were not the climates' medians; re-fitted at
 * the drawn ground (the landforms' kernel, the world's default) on the measured rows, the sea's hand on the coasts
 * (MARITIME) in - the mean is the air reduced to the sea, so a range that stands high reads warm here and cold where it
 * stands. HauntedWoodlands, too small a climate to fit, keeps its degree under the woodlands.
 */
export const CLIMATE_AIR = Object.freeze({
  [CLIMATES.Ocean]: Object.freeze({ mean: 11, amp: 6, day: 2, spell: 3.5, row: 263 }),
  [CLIMATES.Desert]: Object.freeze({ mean: 22, amp: 9, day: 8, spell: 3.5, row: 443 }),
  [CLIMATES.Desert2]: Object.freeze({ mean: 21, amp: 10, day: 9, spell: 3.5, row: 476 }),
  [CLIMATES.Mountain]: Object.freeze({ mean: 13.8, amp: 11, day: 5, spell: 5, row: 194 }),
  [CLIMATES.Rainforest]: Object.freeze({ mean: 26, amp: 2, day: 4, spell: 1.5, row: 328 }),
  [CLIMATES.Swamp]: Object.freeze({ mean: 16, amp: 7, day: 3, spell: 3, row: 325 }),
  [CLIMATES.Subtropical]: Object.freeze({ mean: 20, amp: 6, day: 5, spell: 2.5, row: 387 }),
  [CLIMATES.MountainWoods]: Object.freeze({ mean: 11.2, amp: 11, day: 5, spell: 5, row: 134 }),
  [CLIMATES.Woodlands]: Object.freeze({ mean: 11.4, amp: 11, day: 4.5, spell: 5, row: 111 }),
  [CLIMATES.HauntedWoodlands]: Object.freeze({ mean: 10.4, amp: 11, day: 4.5, spell: 5, row: 18 }),
});
/** THE LATITUDE: the air warms this much a map row south (the map's rows run south - 819.2 m each; about one degree a
 *  hundred kilometres). Each climate's numbers above stand at its own median row (`row`, CLIMATE.PAK's - AUDIT PRECIP
 *  AIR-7: the medians the file holds, pinned against it), so the term moves a climate's far ends and never its middle:
 *  the Wrothgarian's winter and the Dragontail's - both "Mountain", 300 rows apart - are not one winter. The Bay's
 *  measure: a point's row is held to the Bay's (airParamsAt), and the Eltheric Ocean has none (latitudeShare). */
export const LATITUDE_C_PER_ROW = 0.008;
/** A climate the table does not know (a world-data mod's) reads the woodlands' air. */
const DEFAULT_AIR = CLIMATE_AIR[CLIMATES.Woodlands];

/** THE SYNOPTIC SPELL: two octaves of value noise over space and time, drifting east-north-east as the Bay's air does -
 *  a cold snap a few hundred kilometres across lasting days, a shorter shiver inside it. Weighted to sum to one. */
export const SPELL = Object.freeze({
  octaves: Object.freeze([
    Object.freeze({ cell: 240000, minutes: 5760, weight: 0.7 }),
    Object.freeze({ cell: 60000, minutes: 1440, weight: 0.3 }),
  ]),
  drift: Object.freeze([18, 6]),   // metres a game minute the air mass moves (east, north)
  salt: 0x41495254,   // 'AIRT'
});

/** UNDER THE SYSTEMS: the day's swing damped to this share under full cloud (dayAir's `cloud` - the cover overhead), and
 *  the air cooled this much by what falls through it at full intensity; a SNOW system brings this much more cold with it
 *  at its own (the air mass that bore it). */
export const FALL = Object.freeze({ dayUnderCloud: 0.4, chill: 1.5, snowCold: 1.5 });

/** THE PHASE: snow below SNOW_ALL_C, rain above RAIN_ALL_C, and between them both at once - sleet, wet snow - its snow
 *  share falling smoothly (the band real snow lines show, where the wet-bulb sits near freezing). */
export const SNOW_ALL_C = 0;
export const RAIN_ALL_C = 2.5;

const smooth = (t) => t * t * (3 - 2 * t);
/** The snow share of what falls in air at `celsius`: 1 all snow, 0 all rain, between them both. Pure. */
export function snowShareOf(celsius) {
  if (!Number.isFinite(celsius)) return 0;   // AUDIT PRECIP AIR-14: a bad input is no air at all, never the coldest
  if (!(celsius > SNOW_ALL_C)) return 1;
  if (celsius >= RAIN_ALL_C) return 0;
  return 1 - smooth((celsius - SNOW_ALL_C) / (RAIN_ALL_C - SNOW_ALL_C));
}

/** The climate's air at the sea through the year: its mean less the season's swing, coldest on COLDEST_DAY. `day` the
 *  year's day as a real (0..360, the minute's fraction in it). Pure. */
export const seasonAir = (p, day) => p.mean - p.amp * Math.cos(2 * Math.PI * (day - COLDEST_DAY) / 360);
/** The day's swing at `hour` (a real, 0..24): warmest at WARMEST_HOUR. `cloud` 0..1 damps it (FALL.dayUnderCloud). */
export const dayAir = (p, hour, cloud = 0) => p.day * Math.cos(2 * Math.PI * (hour - WARMEST_HOUR) / 24) * (1 - (1 - FALL.dayUnderCloud) * Math.min(1, Math.max(0, cloud)));

const hash3 = (i, j, k, salt) => seededFirst((Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x9e3779b1) ^ salt) >>> 0);
/** Value noise in [0, 1] over (x, z, t) - trilinear between lattice values, smoothstepped. No closure and no array: the
 *  snowpack (snowpack.js) reads it for every place of its lattice at every step of a year. */
function noise3(x, z, t, cell, minutes, salt) {
  const qx = x / cell, qz = z / cell, qt = t / minutes;
  const i = Math.floor(qx), j = Math.floor(qz), k = Math.floor(qt);
  const u = smooth(qx - i), v = smooth(qz - j), w = smooth(qt - k);
  const a0 = hash3(i, j, k, salt), b0 = hash3(i + 1, j, k, salt), c0 = hash3(i, j + 1, k, salt), d0 = hash3(i + 1, j + 1, k, salt);
  const a1 = hash3(i, j, k + 1, salt), b1 = hash3(i + 1, j, k + 1, salt), c1 = hash3(i, j + 1, k + 1, salt), d1 = hash3(i + 1, j + 1, k + 1, salt);
  const e0 = a0 + (b0 - a0) * u, f0 = c0 + (d0 - c0) * u, e1 = a1 + (b1 - a1) * u, f1 = c1 + (d1 - c1) * u;
  const z0 = e0 + (f0 - e0) * v, z1 = e1 + (f1 - e1) * v;
  return z0 + (z1 - z0) * w;
}
/** THE SPELL in the air mass's own frame (the drift taken out): at its point (x, z) and event minute `t`, in [-1, 1]. Pure. */
export function spellOf(x, z, t) {
  const oct = SPELL.octaves;
  let n = 0;
  for (let k = 0; k < oct.length; k++) n += oct[k].weight * noise3(x, z, t, oct[k].cell, oct[k].minutes, SPELL.salt + k);
  return Math.max(-1, Math.min(1, (n - 0.5) * 4));   // the sum's spread widened to the climate's swing (value noise sits near its middle: sd 0.55)
}
/** THE SPELL at field (x, z) and event minute `t`, in [-1, 1] (times a climate's `spell` it is degrees): the air mass's
 *  own field, carried on its drift. Pure. */
export const spellAt = (x, z, t) => spellOf(x - SPELL.drift[0] * t, z - SPELL.drift[1] * t, t);

// ---- where the air is read: the climates, the ground's height, the sea, the biomes ---------------

let _ground = null;   // { climateAt(px, py), groundAt(x, z), topAt?(px, py) } - airGround.js lawAirGround
/** THE HOST'S MAP (systems/weather/airGround.js lawAirGround): `climateAt(px, py)` a pixel's climate on THE LAW'S MAP -
 *  CLIMATE.PAK as the file has it (never the coastal dilation, a texture repair), the continent past the Bay and the
 *  Eltheric Ocean, whatever the client's own rows (AUDIT PRECIP AIR-1: online every client reads one air) - and
 *  `groundAt(x, z)` the ground's mean height at field (x, z), metres above the sea (world/landforms.js meanGroundField:
 *  the kernel's own, AIR-3); `topAt(px, py)` (the snowpack's) the highest a pixel's ground stands. Set once by a host as
 *  the world loads; null forgets it (a place then reads the woodlands' air at the sea). */
export function setAirGround(g) {
  _ground = g && typeof g.climateAt === 'function' ? g : null;
  _pixelAir.clear(); _tiles.clear();
}
export const airGround = () => _ground;

const _biomes = new Map();
/** A BIOME OVERLAY: `fn(x, z)` answers how much of field (x, z) is the biome's air (0..1, over the biome's own width for
 *  its air - AIR-12: the jungle's is kilometres, never its haze's few hundred metres) - the air there leans to `air` (a
 *  CLIMATE_AIR row) by that share. One per name; null clears it. The jungle registers its field (scenes/jungleHost.js). */
export function setAirBiome(name, fn, air) {
  if (typeof fn === 'function' && air) _biomes.set(name, { fn, air });
  else _biomes.delete(name);
}

const OCEAN = CLIMATES.Ocean, OCEAN_AIR = CLIMATE_AIR[OCEAN];
const airOf = (c) => CLIMATE_AIR[c] ?? DEFAULT_AIR;
const smoothClamp = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** A pixel's climate on the law's map; a pixel nothing answers for (a host's map with no ground past the Bay) is sea. */
const climateOf = (px, py) => {
  const c = _ground ? _ground.climateAt(px, py) : null;
  return c == null || c < 0 ? OCEAN : c;
};

/**
 * THE SEA'S HAND ON THE AIR (AUDIT PRECIP AIR-10). The Ocean's row is the open Bay's maritime air; land beside the sea
 * is partly maritime (a narrower year, a milder winter) and the sea beside land partly the land's. A pixel's numbers are
 * its climate's - a sea pixel's the nearest land's within `reach` - blended toward the Ocean's by its MARITIME SHARE:
 * `coast` at the shoreline, falling to none `inland` pixels in from it and rising to all `offshore` pixels out. So the air
 * is continuous across every coast (an island's woods are milder than the mainland's, the sea off a cold coast colder
 * than the open Bay) and the snow line never follows a line drawn in the sea.
 */
export const MARITIME = Object.freeze({ coast: 0.5, inland: 12, offshore: 12, reach: 12 });
const TILE = 32;
const _tiles = new Map();
/** The maritime shares and the nearest land's climates of a TILE x TILE block of pixels: a two-pass distance transform
 *  (8-neighbour, 1 and sqrt 2 a step) over the block and `reach` round it, carrying each land pixel's climate - a pure
 *  function of the block's place, kept (bounded). */
function maritimeTile(tx, ty) {
  const key = (tx + 4096) * 8192 + (ty + 4096);
  let tile = _tiles.get(key);
  if (tile) return tile;
  const R = MARITIME.reach, W = TILE + 2 * R, x0 = tx * TILE - R, y0 = ty * TILE - R, n = W * W, FAR = 1e9, D = Math.SQRT2;
  const toSea = new Float32Array(n), toLand = new Float32Array(n), near = new Int16Array(n), seaPx = new Uint8Array(n);
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i, c = climateOf(x0 + i, y0 + j), sea = c === OCEAN;
      seaPx[k] = sea ? 1 : 0; toSea[k] = sea ? 0 : FAR; toLand[k] = sea ? FAR : 0; near[k] = sea ? -1 : c;
    }
  }
  const relax = (k, q, cost) => {
    if (toSea[q] + cost < toSea[k]) toSea[k] = toSea[q] + cost;
    if (toLand[q] + cost < toLand[k]) { toLand[k] = toLand[q] + cost; near[k] = near[q]; }
  };
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (i > 0) relax(k, k - 1, 1);
      if (j > 0) { relax(k, k - W, 1); if (i > 0) relax(k, k - W - 1, D); if (i < W - 1) relax(k, k - W + 1, D); }
    }
  }
  for (let j = W - 1; j >= 0; j--) {
    for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      if (i < W - 1) relax(k, k + 1, 1);
      if (j < W - 1) { relax(k, k + W, 1); if (i < W - 1) relax(k, k + W + 1, D); if (i > 0) relax(k, k + W - 1, D); }
    }
  }
  const share = new Float32Array(TILE * TILE), land = new Int16Array(TILE * TILE);
  const { coast, inland, offshore } = MARITIME;
  for (let j = 0; j < TILE; j++) {
    for (let i = 0; i < TILE; i++) {
      const k = (j + R) * W + (i + R), o = j * TILE + i;
      if (seaPx[k]) {
        const d = toLand[k];
        share[o] = d >= FAR ? 1 : coast + (1 - coast) * smoothClamp((d - 0.5) / offshore);
        land[o] = d >= FAR ? OCEAN : near[k];
      } else {
        share[o] = coast * (1 - smoothClamp((toSea[k] - 0.5) / inland));
        land[o] = near[k];
      }
    }
  }
  if (_tiles.size >= 512) _tiles.delete(_tiles.keys().next().value);
  _tiles.set(key, tile = { share, land });
  return tile;
}
/** A pixel's maritime share and the climate whose air it carries (its own on land, the nearest land's at sea - the
 *  Ocean's past `reach`) - for the record's probes and the pins. */
export function maritimeAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE), tile = maritimeTile(tx, ty), o = (py - ty * TILE) * TILE + (px - tx * TILE);
  return { share: tile.share[o], land: tile.land[o] };
}
const _pixelAir = new Map();
/** A PIXEL'S AIR: its climate's row (a sea pixel's nearest land's) blended toward the Ocean's by its maritime share -
 *  `{ mean, amp, day, spell, row }`, kept (bounded). Pure in the pixel and the law's map. */
export function pixelAir(px, py) {
  const key = (px + 16384) * 32768 + (py + 16384);
  let a = _pixelAir.get(key);
  if (a) return a;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE), tile = maritimeTile(tx, ty), o = (py - ty * TILE) * TILE + (px - tx * TILE);
  const own = airOf(tile.land[o]), m = tile.share[o];
  const mix = (k) => own[k] + (OCEAN_AIR[k] - own[k]) * m;
  a = Object.freeze({ mean: mix('mean'), amp: mix('amp'), day: mix('day'), spell: mix('spell'), row: mix('row') });
  if (_pixelAir.size >= 65536) { let drop = 16384; for (const k of _pixelAir.keys()) { _pixelAir.delete(k); if (--drop <= 0) break; } }
  _pixelAir.set(key, a);
  return a;
}

/** THE LATITUDE'S SHARE at continuous pixel (fx, fy): whole on the Bay and the continent round it, none in the Eltheric
 *  Ocean's box (its own frame "far north of anything" - its isles' air is their climates' own, AIR-1), eased between
 *  across the law's margin about the box, so a ship crossing into it sails through no step of air. */
function latitudeShare(fx, fy) {
  const m = ETHER_MARGIN, b = ETHER_BOX;
  const depth = Math.min(fx - (b.x0 - m), (b.x1 + m) - fx, fy - (b.y0 - m), (b.y1 + m) - fy);
  return depth <= 0 ? 1 : 1 - smoothClamp(depth / m);
}

const MAX_PY = MAX_MAP_PIXEL_Y - 1;
/** Field metres -> continuous pixel coordinates whose integers are pixel CENTRES (x east, y the map's rows, south). */
const pixelCoords = (x, z) => [x / TERRAIN_SIZE - 0.5, (MAX_MAP_PIXEL_Y - 1) - z / TERRAIN_SIZE + 0.5];

/**
 * THE AIR'S NUMBERS AND THE GROUND'S HEIGHT AT FIELD (x, z): each pixel's air (pixelAir - its climate's row and the sea's
 * hand on it) read at its centre and blended bilinearly between the four centres about the point, wherever the point is
 * (the law's map answers every pixel - AIR-1); the latitude from the blended middle row, the point's row held to the
 * Bay's (the term is the Bay's measure, and the continent's provinces are their own climates past it) and none in the
 * Eltheric Ocean; the ground's mean height at the point itself (AIR-3); then leaned toward every biome overlay by its
 * share. Answers `{ mean, amp, day, spell, ground, row }` - `ground` metres above the sea, `row` the blended middle
 * row. `out` reused when handed.
 */
export function airParamsAt(x, z, out = { mean: 0, amp: 0, day: 0, spell: 0, ground: 0, row: 0 }) {
  const [fx, fy] = pixelCoords(x, z);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  out.mean = 0; out.amp = 0; out.day = 0; out.spell = 0; out.row = 0;
  for (let k = 0; k < 4; k++) {
    const w = ((k & 1) ? u : 1 - u) * ((k >> 1) ? v : 1 - v);
    if (w === 0) continue;
    const p = pixelAir(x0 + (k & 1), y0 + (k >> 1));
    out.mean += w * p.mean; out.amp += w * p.amp; out.day += w * p.day; out.spell += w * p.spell; out.row += w * p.row;
  }
  out.mean += latitudeShare(fx, fy) * LATITUDE_C_PER_ROW * (Math.max(0, Math.min(MAX_PY, fy)) - out.row);
  const g = _ground?.groundAt ? _ground.groundAt(x, z) : 0;
  out.ground = Number.isFinite(g) && g > 0 ? g : 0;
  for (const { fn, air } of _biomes.values()) {
    const s = Math.max(0, Math.min(1, fn(x, z) || 0));
    if (s <= 0) continue;
    out.mean += (air.mean - out.mean) * s; out.amp += (air.amp - out.amp) * s;
    out.day += (air.day - out.day) * s; out.spell += (air.spell - out.spell) * s;
  }
  return out;
}
/** A world height (scene y less the stream's vertical compensation - the terrain's own metres) as metres above the sea. */
export const altitudeOfWorldY = (y) => y - SEA_LEVEL_M;

/** The year's day (0..360, a real) and the hour (0..24, a real) of the SKY's minute `skyMinutes` (skyCalendar.js -
 *  the season and the hour the sky shows; offline the classic clock itself). Pure. */
export function dayAndHourOf(skyMinutes) {
  const m = ((skyMinutes % 518400) + 518400) % 518400;   // 360 days a year
  return [m / 1440, (m % 1440) / 60];
}
/** OW-HITCH: dayAndHourOf's day alone, with no pair made - the snowpack asks it of every point at every step of a year
 *  (snowpack.js stepAir, stepAirFloor). The same number. Pure. */
export function dayOfSky(skyMinutes) {
  const m = ((skyMinutes % 518400) + 518400) % 518400;
  return m / 1440;
}

const _p = { mean: 0, amp: 0, day: 0, spell: 0, ground: 0, row: 0 };
/** The air's fall terms from a place's `fall` - `{ intensity, snow, cover }` (systems/weather/weatherMap.js wornAmong's
 *  `air`): the fall's intensity there (the strongest wet band's), its snow systems' own (a number; `true` the whole fall's,
 *  as a word-only reader has it) and the cloud cover overhead (0..1; a reader with no map: a falling sky is a covered
 *  one). One air per place (AUDIT PRECIP AIR-8): every band falling there reads the same. */
export function airFall(fall) {
  return airFallInto(fall, { wet: 0, snow: 0, cover: 0, chill: 0 });
}
/** OW-HITCH: airFall into `out` (the snowpack's one scratch, read at once). The same terms. */
export function airFallInto(fall, out) {
  const wet = fall ? Math.max(0, Math.min(1, fall.intensity || 0)) : 0;
  const snow = fall?.snow === true ? wet : Math.max(0, Math.min(1, Number(fall?.snow) || 0));
  const cover = fall?.cover == null ? (wet > 0 ? 1 : 0) : Math.max(0, Math.min(1, Number(fall.cover) || 0));
  out.wet = wet; out.snow = snow; out.cover = cover; out.chill = wet * FALL.chill + snow * FALL.snowCold;
  return out;
}
/**
 * THE AIR AT FIELD (x, z), `altitude` metres above the sea (null: the ground's mean height there), at event minute `t`
 * whose sky minute is `skyMinutes` (the season and the hour - TIME1's sky clock; offline the same minute). `fall`
 * (optional, airFall) what falls there and the cloud over it - the cloud damps the day's swing (AIR-9: by the COVER,
 * so the air walks under a deck's edge, never steps at a core's), the fall and a snow system's air mass chill it.
 * Degrees C. Pure in its arguments and the map (setAirGround, the biomes).
 */
export function airTemperature(x, z, altitude, t, skyMinutes = t, fall = null) {
  const p = airParamsAt(x, z, _p);
  const [day, hour] = dayAndHourOf(skyMinutes);
  const h = altitude == null || !Number.isFinite(altitude) ? p.ground : altitude;
  const f = airFall(fall);
  return seasonAir(p, day) + dayAir(p, hour, f.cover) + p.spell * spellAt(x, z, t) - LAPSE_C_PER_M * Math.max(0, h) - f.chill;
}
