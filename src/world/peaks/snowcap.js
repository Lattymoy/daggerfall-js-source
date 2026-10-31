// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PEAKS1 (2026-10-26, the owner: "The world of daggerfall mountains need to be completely redesigned from the ground up
// with more integration into the terrian, snow capped, and properly place throughout tamriel"; bible/03-World/Peaks.md) -
// THE SNOW THAT NEVER MELTS: the perennial snowline, a height in metres above the sea at every place, set by the land's
// climate and, past the Bay, by its zone (world/tamriel/tamrielBiomes.js): low in Skyrim, the Jerall and the
// Wrothgarians, higher in Cyrodiil's and Morrowind's uplands, none in the deserts, the jungles, the marshes and on Red
// Mountain's ash. Over it the summits are white and the ledges hold it; a steep face sheds it to bare rock.
//
// IT RIDES ON THE SNOWPACK, IT DOES NOT REPLACE IT (systems/weather/snowpack.js, PRECIP3): near the player the ground's
// snow is the weather's - what fell and has not melted - and the cap is a FLOOR under it: each lattice point's snowline
// is the lower of the pack's and the cap's (`mergeCapLine`; scenes/snowCoverHost.js), so the trees, the grass, the feet
// and the buildings over the line wear the snow the ground does, by the one law they already read. The cap carries the
// season as the pack does not need to (`seasonalLine`: lower toward the coldest day) for the far views, which have no
// pack (render/farRing.js, midRing.js, farField.js: a range white on the horizon).
//
// SEAMLESS: a corner's line is the mean of the four pixels about it (`capLineAt`) and a place between corners reads their
// bilinear, so a zone's border is a slope of the line over a pixel, never a step. A zone with no snow stands its line at
// CAP_NONE - over any ground the world stands - so a border with one is a line rising out of reach, not a wall.
// ═══════════════════════════════════════════════════════════════════
import { CLIMATES } from '../../formats/mapsTables.js';
import { tamrielBiomeAt } from '../tamriel/tamrielBiomes.js';
import { bayEdgeDistance, SEAM_PX } from '../tamriel/tamrielGround.js';
import { landLayer } from '../land/landLayer.js'; // AUDIT FOUNDATION II L4: a row's climate past the Bay
import { redMountainLiftAt } from '../tamriel/redMountain.js'; // RED-MOUNTAIN: its fire raises the line with the cone
import { STREAMING_TERRAIN_SCALE } from '../terrain/terrainSampler.js';
import { CAP_FACE } from '../../render/snowCapGlsl.js'; // the face's dials: their home is the shader's leaf (boot2)

const C = CLIMATES;
/** A line no ground reaches (metres above the sea): the land's ceiling (world/landforms.js LANDFORM_CEILING) is under
 *  4.7 km. A zone with no snow stands its line here. */
export const CAP_NONE = 9000;

/**
 * THE DIALS (LANDFORM_DIALS' rule: one place). Metres above the sea.
 *  - `zones`: past the Bay, each zone's perennial line (tamrielBiomes.js BIOMES' keys; a zone not named takes its
 *    climate's, `climates`). Skyrim's north coast and its peaks lowest; the Jerall, the Velothi and Wrothgar under the
 *    ranges' shoulders; Cyrodiil's and Morrowind's uplands over all but their summits; Red Mountain none (its ash is
 *    warm), the deserts, Valenwood, Elsweyr, Black Marsh and the Summerset coast none.
 *  - `climates`: a climate's line (CLIMATE.PAK's values) - the Bay's own ground, and a zone the table does not name.
 *  - `bay`: the Bay's lines rise southward - the Wrothgarians on its north are snowier than the Dragontails on its south:
 *    `rise` metres more from row `north` to row `south`, a smoothstep between.
 *  - `winter`: how far the line comes down on the coldest day (none on midsummer; the far views' season - near the player
 *    the pack's winter is the weather's own).
 *  - `band`: the cover's rise about the line - nothing `below` it, whole `above` it.
 *  - `face`: a steep face sheds the cap to bare rock - its normal's y from `held` (snow holds) down to `bare` (rock),
 *    from `from` metres under the line (none) to `full` under it (all); the summits' cliffs are rock, the ledges white.
 *  - `rgb`: the far views' snow, a sunlit white a shade blue (0-255).
 */
export const SNOWCAP = Object.freeze({
  zones: Object.freeze({
    skyrimFrozenCoast: 900,
    skyrimTundra: 1300,
    skyrimPinewood: 1700,
    skyrimReach: 1650,
    skyrimPeaks: 1250,
    highRockWrothgar: 1300,
    highRockBangkorai: 1850,
    highRockRivenspire: 1500,
    highRockNorthpoint: 1600,
    hammerfellAlikr: CAP_NONE,
    hammerfellCraglorn: 3200,
    hammerfellCoast: CAP_NONE,
    hammerfellDragontail: 2250,
    summersetVineCoast: CAP_NONE,
    summersetAuridon: CAP_NONE,
    summersetEtonNir: 1850,
    valenwoodGrahtwood: CAP_NONE,
    valenwoodMalabal: CAP_NONE,
    valenwoodGreenshade: CAP_NONE,
    valenwoodReapersMarch: CAP_NONE,
    elsweyrAnequina: CAP_NONE,
    elsweyrPlains: CAP_NONE,
    elsweyrPellitine: CAP_NONE,
    elsweyrTenmar: CAP_NONE,
    blackMarshHist: CAP_NONE,
    blackMarshFens: CAP_NONE,
    blackMarshMurkmire: CAP_NONE,
    blackMarshGloomire: CAP_NONE,
    morrowindAshlands: 2500,
    morrowindGrazelands: 2200,
    morrowindRedMountain: CAP_NONE,
    morrowindAscadian: 2200,
    morrowindBitterCoast: CAP_NONE,
    morrowindStonefalls: 2400,
    morrowindDeshaan: 2100,
    morrowindTelvanni: 1750,
    morrowindVelothiFoot: 1700,
    morrowindVelothi: 1500,
    cyrodiilNibenayValley: 2300,
    cyrodiilNibenay: 2500,
    cyrodiilBlackwood: CAP_NONE,
    cyrodiilColovia: 1900,
    cyrodiilGoldCoast: 2400,
    cyrodiilJerall: 1500,
  }),
  climates: Object.freeze({
    [C.Mountain]: 1350,
    [C.MountainWoods]: 1600,
    [C.Woodlands]: 2100,
    [C.HauntedWoodlands]: 2100,
    [C.Desert]: CAP_NONE,
    [C.Desert2]: CAP_NONE,
    [C.Rainforest]: CAP_NONE,
    [C.Subtropical]: CAP_NONE,
    [C.Swamp]: CAP_NONE,
    [C.Ocean]: CAP_NONE,
  }),
  bay: Object.freeze({ north: 100, south: 420, rise: 500 }),
  winter: 450,
  band: Object.freeze({ below: 140, above: 180 }),
  face: CAP_FACE,
  rgb: Object.freeze([236, 240, 247]),
});

/** The coldest day of the sky's year (systems/weather/airTemperature.js COLDEST_DAY - the season the far views wear). */
const COLDEST_DAY = 20;

const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const smoothstep = (a, b, v) => smooth01((v - a) / (b - a));

/**
 * THE LINE AT ONE MAP PIXEL (metres above the sea, CAP_NONE none): past the Bay's seam its zone's (tamrielBiomes.js
 * tamrielBiomeAt - a zone the table does not name, or none, its climate's), on the Bay and its seam its climate's,
 * risen southward (`bay`). `climateAt(px, py)` the host's CLIMATE.PAK value (the stream's own: the continent's past the
 * map). Pure in its arguments and the land's zones.
 * @param {number} px @param {number} py @param {(px: number, py: number) => number} climateAt
 */
export function capLineOfPixel(px, py, climateAt) {
  if (bayEdgeDistance(px, py) > SEAM_PX) {
    const row = landLayer().climateAt(px, py),
      z = row === undefined ? tamrielBiomeAt(px, py) : null; // AUDIT FOUNDATION II L4: a row's climate its line
    const v = z ? SNOWCAP.zones[/** @type {keyof typeof SNOWCAP.zones} */ (z.key)] : undefined;
    const line =
      v !== undefined
        ? v
        : (SNOWCAP.climates[z ? z.climate : (row ?? climateAt(px, py))] ?? SNOWCAP.climates[C.Woodlands]);
    // RED-MOUNTAIN: the volcano's fire - its ash never holds snow, so the line rides up its cone (the land's own line
    // over the land under it), and the Ashlands on its foot stay as bare as the plateau they were
    return line >= CAP_NONE ? line : line + redMountainLiftAt(px, py) * STREAMING_TERRAIN_SCALE;
  }
  const base = SNOWCAP.climates[climateAt(px, py)] ?? SNOWCAP.climates[C.Woodlands];
  if (base >= CAP_NONE) return CAP_NONE;
  const { north, south, rise } = SNOWCAP.bay;
  return base + rise * smoothstep(north, south, py);
}

/** THE LINE AT A MAP PIXEL CORNER - the north-west corner of pixel (cx, cy): the mean of the four pixels about it, so a
 *  border is a slope over a pixel and both pixels on an edge read one number. Pure. */
export function capLineAt(cx, cy, climateAt) {
  return (
    (capLineOfPixel(cx - 1, cy - 1, climateAt) +
      capLineOfPixel(cx, cy - 1, climateAt) +
      capLineOfPixel(cx - 1, cy, climateAt) +
      capLineOfPixel(cx, cy, climateAt)) /
    4
  );
}

/** How deep in winter the sky's `day` (0..359) stands: 1 on the coldest day, 0 at midsummer, a cosine between. Pure. */
export function winterness(day) {
  return 0.5 + 0.5 * Math.cos((2 * Math.PI * (day - COLDEST_DAY)) / 360);
}
/** A line on the sky's `day`: lower by SNOWCAP.winter toward the coldest day - never a line out of reach brought down
 *  (CAP_NONE and every line within a winter of it stay). Pure. */
export function seasonalLine(line, day) {
  return line >= CAP_NONE - SNOWCAP.winter ? line : line - SNOWCAP.winter * winterness(day);
}

/** The cap's cover at `h` metres above the sea under line `line`: 0 `below` under it, 1 `above` over it, smooth. Pure. */
export function capCover(h, line) {
  return smoothstep(line - SNOWCAP.band.below, line + SNOWCAP.band.above, h);
}
/** THE BARE FACE: the share of a steep face at `h` (its normal's y `ny`) the cap sheds to rock - none on a ledge (`held`
 *  and up), all of it at `bare` and under, and only near and over the line (none `from` under it, whole `full` under). */
export function faceRock(h, ny, line) {
  const f = SNOWCAP.face;
  return (1 - smoothstep(f.bare, f.held, ny)) * smoothstep(line - f.from, line - f.full, h);
}
/** The far views' snow on a vertex: its cap, less the face's rock. Pure. */
export function capShare(h, ny, line) {
  return capCover(h, line) * (1 - faceRock(h, ny, line));
}

/** THE CAP AS A SNOWLINE - the [h10, h50, h90] a place's cover crosses at (snowpack.js snowlineOf's form), so the pack's
 *  reader (coverAtHeight, and the shader's snowAtHeight) reads the cap's band through the line: 10 % a little over its
 *  foot, half at the line's middle, 90 % a little under its top. Pure. */
export function capSnowline(line, out = [0, 0, 0]) {
  const { below, above } = SNOWCAP.band,
    mid = line + (above - below) / 2,
    half = (above + below) / 2;
  out[0] = mid - 0.6 * half;
  out[1] = mid;
  out[2] = mid + 0.6 * half;
  return out;
}
/** THE PACK OVER THE CAP: a lattice point's snowline the lower of the pack's and the cap's at each crossing (`pack`
 *  written in place and answered) - the cap a floor under the weather's snow, never over it; monotone as both are. */
export function mergeCapLine(pack, line) {
  if (!(line < CAP_NONE)) return pack;
  const c = capSnowline(line, _cap);
  for (let k = 0; k < 3; k++) if (c[k] < pack[k]) pack[k] = c[k];
  return pack;
}
const _cap = [0, 0, 0];

/** RED-MOUNTAIN: THE ASH THE PACK NEVER LIES ON (AUDIT RED-MOUNTAIN L1: the cone lay white in winter - its fire cancels
 *  only its own height, and the plateau under it freezes) - the share of the four pixels about map corner (cx, cy) in Red
 *  Mountain's zone (tamrielBiomes.js morrowindRedMountain), whose heat keeps the ground bare under any fall. Pure. */
export function ashShareAt(cx, cy) {
  let n = 0;
  for (const [x, y] of [
    [cx - 1, cy - 1],
    [cx, cy - 1],
    [cx - 1, cy],
    [cx, cy],
  ])
    if (bayEdgeDistance(x, y) > SEAM_PX && tamrielBiomeAt(x, y)?.key === 'morrowindRedMountain') n++;
  return n / 4;
}
/** A snowline [h10, h50, h90] lifted toward `bare` (a line no ground reaches) by `share`, in place. */
export function bareLine(line, share, bare) {
  if (share > 0) for (let k = 0; k < 3; k++) line[k] += share * (bare - line[k]);
  return line;
}

/** A far view's colour under its snow: `rgb` (0-255, written in place at `o`) toward SNOWCAP.rgb by `share`. */
export function whiten(colors, o, share) {
  if (!(share > 0)) return;
  for (let k = 0; k < 3; k++) colors[o + k] = Math.round(colors[o + k] + (SNOWCAP.rgb[k] - colors[o + k]) * share);
}
