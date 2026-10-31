// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-YARD (2026-09-30) — PIECES OUTSIDE A HOME, ON ITS OWN LOT.
//
// Asked: "allowing for prop placement on the outside within the limits of
// their house". An online home's owner decorates its YARD as they decorate
// its rooms: the same decorator (scenes/decor/decorTool.js - the catalogue, the
// free camera, the price by size), opened standing on the lot, its pieces
// kept on the account service beside the room's (a yard's own flag and cap -
// net/decorLaw.js decorYardPieceOf) and stood for everyone walking the town.
//
// THE FRAME a yard is laid out in is its building's own place in its town
// (world/rmbLayout.js `recordAt` - the subrecord's origin, the same on every
// client), in the world's axes as a room's pieces are: a piece's `pos` is
// from there. THE LOT is the box round the building's own models and
// YARD_MARGIN round it, never inside the house, never on another building's
// ground - FB1009 HOME-FOOT: a building's ground is what its models' faces
// cover seen from above (modelFootRects - its roofs, eaves and steps, never a
// wall), not its box, so the open corner of an L or the forecourt a
// Hammerfell house's door opens onto is its yard - and (FB1001 ROAD-LOT) never on the town's
// road or a path - the pixel's own road tiles: the client measures it (the
// service has no town to measure in) and the decorator refuses a piece off
// it, its edges marked while a piece is placed (along the road's side where
// the road cuts in). The service's own bound is the lot's widest
// (DECOR_YARD_POS_MAX).
//
// THE TOWN'S YARDS are read a block at a time (YARD-CELL - scenes/yardCellSync.js,
// server-account/src/yardCells.js): the blocks within reach, nearest first, and
// after the first answer only the blocks that moved; each yard stood in its pixel as a room's
// pieces stand in its room (scenes/decor/decorRoom.js, one pool a yard): its own
// collider buckets on the world's collider, drawn in the world's passes, and
// stood again where it stands when the world recentres (the pool places in
// scene space - FB1001 YARD-RECENTRE: in place, by the host's recentre, before
// that frame's draw). A yard of a pixel streamed out is taken down with it.
// FB1001 YARD-STALE: the owner's own writes stand over a town's answer that
// was read before them.
//
// HOME-LOOK rides the same decorator: "Exterior", the painter of the house's
// outside, is a tab of the yard's panel (ui/decorPanel.js), its look tried on
// the house as it is chosen and written when it is painted.
//
// YARD-LIGHT (2026-10-07, Discord through Mac - a lamp post and a torch in
// a yard at night, dark: "i wish lights worked outside.."): A YARD'S LAMP IS
// THE TOWN'S. A yard's piece carries no light of its own (net/decorLaw.js -
// "an outdoor lamp is the town's"), and nothing lit it as the town either, so
// a lamp post placed outside stood dark beside the street's lit ones. Now a
// TEXTURE.210 flat standing in a yard lights as Daggerfall lights every one
// standing in a town block (RMBLayout.AddLight, world/city/cityLights.js): the
// DaggerfallLight [City] at the flat's top, in the town lanterns' hours,
// colour and flicker, ranked with the street's own (yardLampOf, `lamps`;
// scenes/world.js). Nothing is stored and nothing is switched: a lamp placed
// before this lights as it stands. AUDIT YARD-LIGHT: a yard lights its first
// YARD_LAMPS_MAX lamps (the densest Daggerfall block stands eight), hung the
// town's own height above the picture, its reach scaled with the piece - and
// no distance cuts one: the night's one selection ranks it with the street.
//
// Online alone - a yard is an online home's. Not a DFU member. Ledger A.
// ═══════════════════════════════════════════════════════════════════

import { createDecorRoom, decorBoxSeen, decorLightLift, DECOR_DRAW, DECOR_SKIP } from './decor/decorRoom.js';   // YARD-RANGE: a piece too small to see; LAMP-FLAME: a lamp's light at its flame
import { decorKey } from '../systems/decor/decorCatalogue.js';
import { decorPlaque } from '../systems/decor/decorLook.js';
import { pickActivatableHit } from '../player/activate.js';
import { plaqueActionFor } from '../systems/quickLoot.js';
import { YARD_RANGE_TIERS, YARD_RANGE_DEFAULT, yardRangeOf, YARD_DRAW_M } from '../net/yardRange.js';   // YARD-RANGE: how far a stranger's yard is drawn
import { createDecorTool, DECOR_LOT_MARKS } from './decor/decorTool.js';
import { DECOR_YARD_CAP, decorYardHighOk, DECOR_YARD_HIGH_WHY, DECOR_YARD_POS_MAX } from '../net/decorLaw.js';   // YARD-HEIGHT: how high a piece stands, and its words; YARD-JOINED: how far from its house
import { homeLookRecords } from '../world/homeLook.js';   // HOME-LOOK (AUDIT): the styles a roof's or a door's family holds
import { onPathTile } from '../player/exteriorSurface.js';   // FB1001 ROAD-LOT: PlayerMotor.OnPathTile - Daggerfall's own road tiles
import { RMB_TILE_SIDE } from '../world/locationEntrance.js';   // FB1001 ROAD-LOT: RMBLayout.RMBTileSide, a ground tile's side
import { createYardCellSync, YARD_ASK_M, YARD_KEEP_MARGIN_M } from './yardCellSync.js';   // YARD-CELL: the yards asked and held a block at a time
import { onYardWords, yardPushState } from '../net/yardPush.js';   // YARD-CELL YC2: the hub's word that a cell moved
import { yardCellOf } from '../net/yardCellLaw.js';
import { createYardBlockMerge } from './yardBlockMerge.js';   // YARD-BLOCK: strangers' yards merged a block at a time
import { TERRAIN_TILE_DIM } from '../world/terrain/terrainSurface.js';
import { homeOutsideKept, homeYardWhere, homeCandidate } from '../systems/online/onlineHomes.js';   // GUILD-YARD: a hall's keepers keep its outside
import { homeDecorShownHere } from '../systems/online/homeMute.js';   // HOME-VOTE: a shunned home's yard stands for its insiders alone; HOME-MUTE: none of one I hid
import { createYardNature, isNaturePiece, yardNatureFlat, yardTreeSet } from './yardNature.js';   // DECOR-OUTDOOR: a yard's trees and plants, in its town's season; DECOR-LPT: as Low Poly Trees' own
import { remapSubMeshes } from '../world/texRemap.js';   // DECOR-OUTDOOR: a yard's models in its town's climate
import { applyClimate } from '../world/climateSwaps.js';
import { isNatureArchive } from '../world/rmbFlats.js';
import { LIGHTS_ARCHIVE, CITY_LIGHT_RANGE, CITY_LIGHT_INTENSITY, CITY_LIGHT_COLOR, streetLightRange } from '../world/city/cityLights.js';   // YARD-LIGHT: the town's lantern; LIGHT-REACH: its start on the lane
import { interiorLightProperties } from '../world/interior/interiorLights.js';   // a candle's own light, the same one it gives indoors
import { interiorLightColor } from '../render/enhancedLighting.js';   // CANDLE-DIM: and its colour as a room uploads it
import { fabricBackyardOf } from '../world/imperialBackyards.js';   // IC-BACKYARD: an Imperial City house's yard, the court behind it
import { t } from '../systems/textManager.js';
import { transformedAabb } from '../render/frustum.js';   // FB1009 HOME-FOOT: a model's ground where its placement stands it
import { DECOR_WALL_CLIP } from '../systems/decor/decorPlacer.js';   // WALL-TOUCH: how far a piece set on a wall sits into it
import { adoptLight } from '../render/lightId.js';   // LIGHT-ID: a row named by its lamp
import { createBankAccounts, BANK_REGION_COUNT, goldRegion } from '../systems/banking.js';   // the yard's wallet (homeYardWallet)
import { totalGoldAmount, payUndoable, addGold } from '../systems/court.js';

/** YARD-LIGHT: the light a yard's lamp gives - the town's lantern's (DaggerfallLight [City]: range 18, intensity 1,
 *  white). The world host lights it as it lights theirs: the town lanterns' colour (CITY_LIGHT_COLOR_F32) and their
 *  flicker, at the lamp's own reach (yardLampRows). */
/** HOME-YARD: what a yard's decorator spends - the player's purse and the region's bank account (EMPIRE-ACCOUNT: online,
 *  the Empire's). Moved out of world.js's bootWorld whole (INSTANCES' HOST-SPLIT, 2026-10-15): it reads only `entity`. */
export const homeYardWallet = (entity, region) => {
  entity.bankAccounts ??= createBankAccounts(BANK_REGION_COUNT);
  const a = entity.bankAccounts[goldRegion(entity.bankAccounts, region)] ?? null;   // EMPIRE-ACCOUNT: the Empire's account
  return {
    gold: totalGoldAmount(entity) + (a?.accountGold ?? 0),
    pay: (n) => payUndoable(entity, n, a),   // MARKET-AUDIT: answering the undo of exactly what it took
    credit: (n) => { addGold(entity, n); },
  };
};
export const YARD_LAMP = Object.freeze({ range: CITY_LIGHT_RANGE, intensity: CITY_LIGHT_INTENSITY, color: CITY_LIGHT_COLOR });
/** TEXTURE.210 records that are candles (interiorLights.js). A yard lights these as that candle, not as a street lantern. */
export const YARD_CANDLE_RECORDS = new Set([2, 3, 4, 5, 9, 11, 21]);
/** AUDIT YARD-LIGHT (L1): HOW MANY OF A YARD'S LAMPS LIGHT - the most TEXTURE.210 flats any Daggerfall town block stands
 *  (eight, in GRVEAL01, GRVEAS01, GRVEAM01, CUSTAA02 and CUSTAA04 of the 920 RMB blocks; most stand three to five).
 *  A yard holds sixty pieces: sixty lamps round one lot summed nine times the brightest ground in any Daggerfall block,
 *  put the street's lanterns out of the classic set's sixteen, and looped a lane fragment over all forty-eight lights.
 *  The first eight a yard stands light (decorRoom.js pushLights - the order they were placed); the rest stand unlit,
 *  as every yard lamp stood before YARD-LIGHT. */
export const YARD_LAMPS_MAX = 8;
/**
 * YARD-LIGHT: THE LIGHT A YARD'S PIECE GIVES (decorRoom.js `lampOf`) - a TEXTURE.210 flat's is the town's lantern, a
 * candle (YARD_CANDLE_RECORDS) the candle it is indoors (`candle`: its own colour and intensity, yardLampRows). LAMP-FLAME:
 * hung at its flame, as a room hangs a placed lamp (decorRoom.js decorLightLift) - the town's rule, the picture's top,
 * put a chain lantern's light in the eave it hung from. Anything else gives none, nor a flat whose picture has not stood
 * (`size` null). AUDIT YARD-LIGHT (L6): a piece scaled is the lamp scaled - its picture, its light's height and its reach
 * alike. The light carries its flicker slot (yardLampSlot - once, here, never a frame).
 */
export function yardLampOf(piece, size) {
  if (piece?.flat?.[0] !== LIGHTS_ARCHIVE || !(size?.h > 0)) return null;
  const k = piece.scale > 0 ? piece.scale : 1;
  const slot = yardLampSlot(piece.id);
  const lift = decorLightLift(piece, size);
  if (YARD_CANDLE_RECORDS.has(piece.flat[1])) {
    const c = interiorLightProperties(piece.flat[1]);
    return { light: { range: c.range * k, intensity: c.intensity, color: c.color, slot, candle: true }, lift };
  }
  return { light: { ...YARD_LAMP, range: YARD_LAMP.range * k, slot }, lift };
}
/** YARD-LIGHT: the town's flicker slot a yard's lamp takes (CityLightAnimator), named by its piece - FNV-1a of the id -
 *  so it keeps its own flicker whatever else stands (LA-LIGHTS1's law for the street's lanterns). */
export function yardLampSlot(id) {
  const s = String(id ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/**
 * AUDIT YARD-LIGHT (L3, L4): THE YARDS' LAMPS AS THE NIGHT'S SCENE LIGHTS - pushed onto `out` (the world host's `csaLit`)
 * as rows refilled in place from `rows` (PERF-LIGHTS' law: a night frame makes nothing for its lanterns): each lamp's
 * place, the town's flicker at its slot (`animRanges`, read after the animator's tick) at the lamp's own reach, and the
 * town lanterns' `color`. CANDLE-DIM: a candle burns at its own colour and intensity, as indoors on the same lane (`on`) -
 * the street lantern's colour made it four times the room's candle. Answers `out`.
 */
export function yardLampRows(lamps, rows, animRanges, color, out, on = false) {
  // AUDIT LIGHT-REACH S1: a candle flickers by its share of the animator's own start (`streetLightRange`, the lane's 27):
  // by the prefab's 18 the lane made a yard's candle reach 7.5, half again its room's 5. A lantern reaches as the town's.
  const start = streetLightRange(on);
  for (let i = 0; i < lamps.length; i++) {
    const l = lamps[i];
    const e = rows[i] ?? (rows[i] = { x: 0, y: 0, z: 0, range: 0, color: null });
    e.x = l.x; e.y = l.y; e.z = l.z;
    adoptLight(e, l);   // LIGHT-ID: the row is this lamp's this frame - the rows refill in the yards' order
    e.range = animRanges[l.slot % animRanges.length] * l.range / (l.candle ? start : CITY_LIGHT_RANGE);
    e.color = l.candle ? candleTone(l, on) : color;
    out.push(e);
  }
  return out;
}
/** CANDLE-DIM: a yard candle's colour x intensity as a room uploads its own (enhancedLighting.js interiorLightColor) - made
 *  once a lamp and lane, kept on the lamp. */
function candleTone(l, on) {
  if (l.tone && l.toneOn === on) return l.tone;
  l.toneOn = on;
  l.tone = new Float32Array(interiorLightColor(on, l.color, l.intensity));
  return l.tone;
}

/** AUDIT: how far from the eye a yard's pieces are drawn, metres - YARD-RANGE: its flats too (net/yardRange.js, its home). */
export { YARD_DRAW_M };
export { YARD_RANGE_TIERS, YARD_RANGE_DEFAULT, yardRangeOf };   // YARD-RANGE: the Other players card's law (net/yardRange.js)
/**
 * YARD-RANGE: THE SMALLEST A YARD'S PIECE IS DRAWN - half its size over its distance from the eye (decorRoom.js
 * decorPieceSeen): a piece a metre across stands to 150 m, a chair's half-metre to 75 m, a cup's ten centimetres to 15
 * m - about five pixels tall on a 1080-line screen at the default field of view, its draw and its shadow record skipped
 * past it. The yard the owner stands in is never cut (they are placing in it).
 */
export const YARD_MIN_ANGLE = 1 / 300;
/** How far past the house's footprint its lot runs, metres. */
export const YARD_MARGIN = 6;
/** How far outside its lot the owner may still stand and open the yard's decorator. */
export const YARD_NEAR = 2;
/** AUDIT GUILD-YARD C1: what standing only near a lot (not on it) weighs against a lot the feet are on - past any distance. */
const YARD_NEAR_ONLY = 1e6;
/** How high the lot's marked edge stands. */
export const YARD_MARK_HIGH = 1;
// YARD-SHED's reach and back-off, the poll's interval and the owner's write hold live with the cells they time
// (scenes/yardCellSync.js); named here too, where the yards' tests and the bible have always read them.
export { YARD_TOWN_TTL_MS, YARD_RETRY_MS, YARD_RETRY_MAX_MS, yardRetryMs, YARD_WRITE_HOLD_MS, YARD_ASK_M } from './yardCellSync.js';
/** How often the yards are brought in line with the town, seconds. */
export const YARD_SYNC_S = 0.5;
/** YARD-MERGE: how many kept yards' models are merged in one frame (decorRoom.js DECOR_MERGE_SETTLE_MS). YARD-BLOCK:
 *  strangers' yards merge a block at a time on their own budget (yardBlockMerge.js YARD_BLOCK_MERGE_BUDGET_MS). */
export const YARD_MERGES_A_FRAME = 1;
/**
 * HOW LONG ONE FRAME SPENDS STANDING STRANGERS' YARDS, milliseconds. YARD-TOWN (2026-10-25) measured a town's answer
 * stood in one sync at a frame of 108 to 208 ms. YARD-CELL stands them NEAREST FIRST while the frame's standing time is
 * under this budget - always one a frame - and the next frame goes on until all stand. The owner's own yard, and the one
 * the decorator stands in, never wait. 3 ms was the best measured (bible/11-Multiplayer/Yard-Cells.md section 10, check 1).
 */
export const YARD_STAND_BUDGET_MS = 3;
/** What the decorator says of a piece off the lot, in the house, or on another building's ground. */
export const YARD_OFF_LOT = 'Outside your lot. Keep it within the marked edge.';
export const YARD_IN_HOUSE = 'That is inside your house. Place it in the yard around it.';
export const YARD_ON_OTHER = "That is another building's ground.";
export const YARD_FULL = `Your yard already holds ${DECOR_YARD_CAP} pieces.`;   // the bar's words (ui/decorPanel.js decorWhyNot, `yard`)
/** AUDIT GUILD-YARD: the same two in a guild hall's yard - the hall's, never "your house" (decorWhyNot's `hall`). */
export const YARD_IN_HALL = "That is inside the hall. Place it in the hall's yard around it.";
export const YARD_HALL_FULL = `The hall's yard already holds ${DECOR_YARD_CAP} pieces.`;
/** FB1001 ROAD-LOT: what the decorator says of a piece on the town's road or a path. */
export const YARD_ON_ROAD = 'That is the road. Keep the street and its paths clear.';
/** YARD-HEIGHT: what the decorator says of a piece standing higher than a yard's may (net/decorLaw.js DECOR_YARD_HIGH) -
 *  AUDIT Y3: the service's own refusal's sentence. */
export const YARD_TOO_HIGH = DECOR_YARD_HIGH_WHY;
/** YARD-WALLS: how high a piece standing free of its house may stand, metres - Mac's 4 m against towers (YARD-HEIGHT). On
 *  or against its house a piece stands to the house's top, within DECOR_YARD_HIGH (yardByHouse). */
export const YARD_FREE_HIGH = 4;
export const yardTooHighFree = () => t('decor.yard.tooHighFree', 'Too high. Above {m} m, a decoration must stand on or against the building, no higher than its roof.', { m: YARD_FREE_HIGH });
/** How far into a wall's (or a road's) ground a piece may reach and still stand clear of it - touching is not in it. */
export const YARD_EDGE_PAD = 0.05;
/** FB1009 HOME-FOOT: the side of the cells a model's ground is measured in, metres (half Daggerfall's 0.8 m wall step). */
export const YARD_FOOT_CELL = 0.4;
/** A face this high, and higher, is a roof. Ground under the part of it that hangs past the walls is still the yard. */
export const YARD_ROOF_Y = 2;
/** YARD-DECK: how far below a deck a piece's foot may stand and still be on it, metres. */
export const YARD_DECK_SLACK = 0.05;
/** YARD-DECK (AUDIT FB1030 Y3): a deck is cut where walls stand this far over it - a storey's, whatever their foot; a
 *  parapet is lower. */
export const YARD_STOREY_RISE = 1;
/** YARD-DECK (AUDIT FB1030 Y6): the least a deck's level roof covers, m² - a stair's tread or landing is none. */
export const YARD_DECK_MIN = 4;

/** EAVE-FOOT: the plane an upright face stands in, seen from above as its line - its way (either end first) and its offset.
 *  @param {number[]} w [ax, az, bx, bz] */
function lineOf(w) {
  const [ax, az, bx, bz] = w;
  let dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  dx /= len; dz /= len;
  if (dx < -1e-6 || (Math.abs(dx) <= 1e-6 && dz < 0)) { dx = -dx; dz = -dz; }
  return `${Math.round(dx * 1000)},${Math.round(dz * 1000)},${Math.round((ax * dz - az * dx) * 100)}`;
}
/**
 * FB1009 HOME-FOOT (the Discord, "Property Problem": "I can't place in front of my door but I can place in front of
 * another's home"): THE GROUND A MODEL STANDS ON, seen from above - every face of it that covers ground (a roof, a
 * stair's tread, a wall's top), in `cell`-metre cells, answered as rects [x0, z0, x1, z1] in the model's own
 * frame (each row's runs, a run the row above shares one rect). A wall covers no ground: its face seen from above is a
 * line. The box round the model was its ground, and Hammerfell's houses are L-shaped or stand an outside stair before
 * their door - the door opens onto open ground inside the box (ARCH3D 600, 709 and their kin: 44% of the desert's
 * houses), so the step before the owner's own door was "inside your house" while a neighbour whose door is in its box's
 * side stood free. A face is sampled strictly inside itself, so a roof's edge on a cell's side never marks the next.
 * A roof past the walls is an eave, its ground the yard. A roof with no walls under it, and anything lower than the
 * roof (a step, a porch), covers its ground. EAVE-FOOT (FIELD BUGS 2026-10-29f): only the ground floor's walls count,
 * and a plane is one crossing - an upper storey's wall in the ground wall's plane made the eave the house.
 */
export function modelFootRects(positions, indices, cell = YARD_FOOT_CELL) {
  return modelFootParts(positions, indices, cell).rects;
}
/** Runs of cells on a W x H grid merged into rects [x0, z0, x1, z1] - each row's runs, a run the row above shares one
 *  rect. `keyOf(i)` is a cell's key, or null off it: a run holds one key, and a key that is a number rides its rect. */
function cellRects(W, H, x0, z0, x1, z1, cell, keyOf) {
  const out = [];
  let open = new Map();
  for (let r = 0; r < H; r++) {
    const next = new Map();
    for (let q = 0; q < W;) {
      const key = keyOf(r * W + q);
      if (key == null) { q++; continue; }
      let e = q;
      while (e < W && keyOf(r * W + e) === key) e++;
      const k = `${q},${e},${key}`;
      const rect = open.get(k) ?? [x0 + q * cell, z0 + r * cell, Math.min(x1, x0 + e * cell), 0];
      if (!open.has(k)) { out.push(rect); if (typeof key === 'number') rect[4] = key; }
      rect[3] = Math.min(z1, z0 + (r + 1) * cell);   // the run carried up a row
      next.set(k, rect);
      q = e;
    }
    open = next;
  }
  return out;
}
/** EAVE-FOOT: whether (x, z) stands inside upright faces `walls` - a ray's crossings, one a plane. */
function insideWalls(walls, x, z) {
  const crossed = new Set();   // EAVE-FOOT: a crossing once, however many faces stand in its plane
  for (const [ax, az, bx, bz, line] of walls) {
    if ((az > z) === (bz > z)) continue;
    if (ax + ((z - az) / (bz - az)) * (bx - ax) > x) crossed.add(line);   // AUDIT FB1029f B7: by its plane - two walls meeting at a V's point are two
  }
  return crossed.size % 2 === 1;
}
const footParts = new WeakMap();
/** YARD-DECK: the plan lines where upright faces `ups` (9 numbers each, a triangle) cross the height `h`, each with its
 *  plane (EAVE-FOOT's lineOf). */
function crossingLines(ups, h) {
  const out = [];
  for (const t of ups) {
    const ps = [];
    for (const [i, j] of [[0, 3], [3, 6], [6, 0]]) {
      const ya = t[i + 1], yb = t[j + 1];
      if ((ya > h) === (yb > h)) continue;
      const u = (h - ya) / (yb - ya);
      ps.push(t[i] + u * (t[j] - t[i]), t[i + 2] + u * (t[j + 2] - t[i + 2]));
    }
    if (ps.length === 4 && Math.hypot(ps[2] - ps[0], ps[3] - ps[1]) > 1e-3) out.push([ps[0], ps[1], ps[2], ps[3], lineOf(ps)]);
  }
  return out;
}
/**
 * modelFootRects' ground in parts, for WALL-TOUCH and YARD-DECK (FIELD BUGS 2026-10-30b): `rects` all of it; `loose` the
 * cells a face covers outside the ground floor's `walls` (a step, a post with none), judged by the cell; the rest judged
 * by those walls' own lines, so a piece set against one touches the house and no more. `decks` are cells with a level
 * roof facing up (its lowest, [x0, z0, x1, z1, y]); `storeys` the walls standing YARD_STOREY_RISE over each deck's
 * height, [y, lines]; `solid` the rest. yardByHouse's: `cover` that ground inside the walls and every level roof, past
 * them too (a porch's); `sides` each upright face's line and height [ax, az, bx, bz, y0, y1]. Measured once a model.
 */
export function modelFootParts(positions, indices, cell = YARD_FOOT_CELL) {
  const kept = cell === YARD_FOOT_CELL ? footParts.get(positions) : null;
  if (kept) return kept;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    x0 = Math.min(x0, positions[i]); x1 = Math.max(x1, positions[i]);
    z0 = Math.min(z0, positions[i + 2]); z1 = Math.max(z1, positions[i + 2]);
  }
  if (!(x1 > x0) || !(z1 > z0)) return { rects: [], loose: [], solid: [], decks: [], walls: [], storeys: [], cover: [], sides: [] };
  const W = Math.ceil((x1 - x0) / cell), H = Math.ceil((z1 - z0) / cell), N = W * H;
  const hit = new Uint8Array(N), roof = new Uint8Array(N), out = new Uint8Array(N), crossed = new Uint8Array(N), side = new Uint8Array(N);
  const deck = new Float64Array(N).fill(NaN);
  const walls = [], ups = [], seen = new Set(), sides = [], seenSide = new Set();
  const at = (x, z) => Math.min(H - 1, Math.max(0, Math.floor((z - z0) / cell))) * W + Math.min(W - 1, Math.max(0, Math.floor((x - x0) / cell)));
  const upOf = (t) => {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    return (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]);   // the face's normal's y, unscaled
  };
  for (let t = 0; t < indices.length; t += 3) {
    if (Math.abs(upOf(t)) >= 2e-3) continue;
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2], bx = positions[b], by = positions[b + 1], bz = positions[b + 2], cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const edges = [[ax, az, bx, bz], [bx, bz, cx, cz], [cx, cz, ax, az]];
    let best = edges[0], len = -1;
    for (const e of edges) {
      const d = Math.hypot(e[2] - e[0], e[3] - e[1]);
      if (d > len) { best = e; len = d; }
    }
    if (len < 1e-3) continue;
    ups.push([ax, ay, az, bx, by, bz, cx, cy, cz]);   // YARD-DECK: a storey's, perhaps
    const q = (v) => Math.round(v * 1000);
    const ka = `${q(best[0])},${q(best[1])}`, kb = `${q(best[2])},${q(best[3])}`;
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy), span = `${key}|${q(y0)}|${q(y1)}`;
    if (!seenSide.has(span)) { seenSide.add(span); sides.push([...best, y0, y1]); }   // AUDIT FB1031 Y1: a gable's over a door too
    if (y0 >= YARD_ROOF_Y || seen.has(key)) continue;
    seen.add(key);
    walls.push([...best, lineOf(best)]);   // EAVE-FOOT: the ground floor's
    const n = Math.ceil(len / (cell / 4));
    for (let i = 0; i <= n; i++) {   // WALL-TOUCH: the cells it crosses, and their neighbours - their points judged one by one
      const x = best[0] + ((best[2] - best[0]) * i) / n, z = best[1] + ((best[3] - best[1]) * i) / n;
      for (const dx of [-cell, 0, cell]) for (const dz of [-cell, 0, cell]) crossed[at(x + dx, z + dz)] = 1;
    }
  }
  const inside = (k, x, z) => {
    if (crossed[k]) return insideWalls(walls, x, z);
    if (!side[k]) side[k] = insideWalls(walls, x0 + ((k % W) + 0.5) * cell, z0 + (((k / W) | 0) + 0.5) * cell) ? 1 : 2;
    return side[k] === 1;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const up = upOf(t);
    if (Math.abs(up) < 2e-3) continue;   // a wall: no ground under it
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2], bx = positions[b], by = positions[b + 1], bz = positions[b + 2], cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const high = ay >= YARD_ROOF_Y && by >= YARD_ROOF_Y && cy >= YARD_ROOF_Y;
    const level = high && up > 0 && Math.max(ay, by, cy) - Math.min(ay, by, cy) < 0.01;   // YARD-DECK: level, facing up
    const y = Math.round(ay * 100) / 100;
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(bx - ax, bz - az), Math.hypot(cx - ax, cz - az), Math.hypot(cx - bx, cz - bz)) / (cell / 2)));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const u = (i + 1 / 3) / n, v = (j + 1 / 3) / n, w = 1 - u - v;   // inside the face, never on its edge
        const x = ax * w + bx * u + cx * v, z = az * w + bz * u + cz * v, k = at(x, z);
        if (!high) { hit[k] = 1; if (!out[k] && !(walls.length && inside(k, x, z))) out[k] = 1; continue; }
        roof[k] = 1;
        if (level && !(deck[k] <= y)) deck[k] = y;   // AUDIT FB1030 Y3: its lowest - a loggia's floor under its ceiling
      }
    }
  }
  for (let i = 0; i < N; i++) {
    if (!roof[i] || hit[i]) continue;
    if (!walls.length) { hit[i] = out[i] = 1; continue; }
    if (inside(i, x0 + ((i % W) + 0.5) * cell, z0 + (((i / W) | 0) + 0.5) * cell)) hit[i] = 1;
  }
  const flatTop = Uint8Array.from(deck, (y) => (Number.isNaN(y) ? 0 : 1));   // AUDIT FB1031 Y1: past the walls too
  for (let i = 0; i < N; i++) if (!hit[i] || out[i]) deck[i] = NaN;
  const seenDeck = new Uint8Array(N);
  for (let i = 0; i < N; i++) {   // AUDIT FB1030 Y6: a deck too small to stand a yard's piece on is no deck
    if (seenDeck[i] || Number.isNaN(deck[i])) continue;
    const part = [i];
    seenDeck[i] = 1;
    for (let k = 0; k < part.length; k++) {
      const c = part[k], q = c % W;
      for (const d of [q > 0 ? c - 1 : -1, q < W - 1 ? c + 1 : -1, c - W, c + W]) {
        if (d >= 0 && d < N && !seenDeck[d] && deck[d] === deck[i]) { seenDeck[d] = 1; part.push(d); }
      }
    }
    if (part.length * cell * cell < YARD_DECK_MIN) for (const c of part) deck[c] = NaN;
  }
  const heights = [...new Set(Array.from(deck).filter((y) => !Number.isNaN(y)))];
  const parts = {
    rects: cellRects(W, H, x0, z0, x1, z1, cell, (i) => (hit[i] ? true : null)),
    loose: cellRects(W, H, x0, z0, x1, z1, cell, (i) => (hit[i] && out[i] ? true : null)),
    solid: cellRects(W, H, x0, z0, x1, z1, cell, (i) => (hit[i] && !out[i] && Number.isNaN(deck[i]) ? true : null)),
    decks: cellRects(W, H, x0, z0, x1, z1, cell, (i) => (Number.isNaN(deck[i]) ? null : deck[i])),
    walls,
    storeys: heights.map((y) => [y, crossingLines(ups, y + YARD_STOREY_RISE)]),
    cover: cellRects(W, H, x0, z0, x1, z1, cell, (i) => ((hit[i] && !out[i]) || flatTop[i] ? true : null)),
    sides,
  };
  if (cell === YARD_FOOT_CELL) footParts.set(positions, parts);
  return parts;
}
/** FB1009 HOME-FOOT: a model's ground (modelFootRects) where its placement `m` (column-major) stands it - each rect's box
 *  in m's frame, exact for a quarter turn (every Daggerfall building's), the box round it for any other. */
export function footRectsAt(rects, m) {
  return (rects ?? []).map(([rx0, rz0, rx1, rz1, y]) => {
    const b = transformedAabb([rx0, y ?? 0, rz0, rx1, y ?? 0, rz1], m);
    return y == null ? [b[0], b[2], b[3], b[5]] : [b[0], b[2], b[3], b[5], b[1]];   // YARD-DECK: a deck keeps its height
  });
}
/** WALL-TOUCH: plan lines [ax, az, bx, bz, plane] where `m` stands them. */
const footLinesAt = (lines, m) => lines.map(([ax, az, bx, bz, l]) => [m[0] * ax + m[8] * az + m[12], m[2] * ax + m[10] * az + m[14], m[0] * bx + m[8] * bz + m[12], m[2] * bx + m[10] * bz + m[14], l]);
/** WALL-TOUCH, YARD-DECK: one model's ground in parts (modelFootParts) where its placement `m` stands it - a home frame's
 *  `grounds` (scenes/pixelBuild.js). */
export function footGroundAt(parts, m) {
  return {
    loose: footRectsAt(parts.loose, m), solid: footRectsAt(parts.solid, m), decks: footRectsAt(parts.decks, m),
    walls: footLinesAt(parts.walls, m), storeys: parts.storeys.map(([y, ls]) => [m[5] * y + m[13], footLinesAt(ls, m)]),
    cover: footRectsAt(parts.cover, m),
    sides: parts.sides.map(([ax, az, bx, bz, y0, y1]) => [...footLinesAt([[ax, az, bx, bz]], m)[0].slice(0, 4), m[5] * y0 + m[13], m[5] * y1 + m[13]]),
  };
}

/**
 * A LOT from a building's frame: `origin` its own place and `box` the box round its models ([minX, minY, minZ, maxX,
 * maxY, maxZ]), both in one frame - answered relative to the origin: `house` that box's footprint [x0, z0, x1, z1] and
 * `lot` the box grown by `margin` [x0, z0, x1, z1], `y` the ground's height (the box's foot) and `top` its top. FB1009
 * HOME-FOOT: `walls` the ground the house stands on - `rects` (its models' faces seen from above, world.js, in the box's
 * frame) relative to the origin, or its box where none are known.
 */
export function yardLot(origin, box, margin = YARD_MARGIN, rects = null, frame = null) {
  if (!Array.isArray(origin) || !Array.isArray(box) || box.length < 6) return null;
  const house = [box[0] - origin[0], box[2] - origin[2], box[3] - origin[0], box[5] - origin[2]];
  if (!(house[2] > house[0]) || !(house[3] > house[1])) return null;
  const from = (r) => [r[0] - origin[0], r[1] - origin[2], r[2] - origin[0], r[3] - origin[2]];
  const known = Array.isArray(rects) && rects.length > 0;
  const walls = known ? rects.map(from) : [house];
  // WALL-TOUCH, YARD-DECK: each model's ground in parts (footGroundAt) - none known, meeting the house is in it
  const lines = (ls) => ls.map((l) => [l[0] - origin[0], l[1] - origin[2], l[2] - origin[0], l[3] - origin[2], l[4]]);
  const grounds = known && frame?.grounds?.length ? frame.grounds.map((g) => ({
    loose: g.loose.map(from), solid: g.solid.map(from), decks: g.decks.map((r) => [...from(r), r[4] - origin[1]]),
    walls: lines(g.walls), storeys: g.storeys.map(([y, ls]) => [y - origin[1], lines(ls)]), cover: g.cover.map(from),
    sides: g.sides.map((l) => [l[0] - origin[0], l[1] - origin[2], l[2] - origin[0], l[3] - origin[2], l[4] - origin[1], l[5] - origin[1]]),
  })) : null;
  return { house, walls, ...(grounds ? { grounds, loose: [] } : {}), lot: [house[0] - margin, house[1] - margin, house[2] + margin, house[3] + margin], y: box[1] - origin[1], top: box[4] - origin[1] };
}
/** AUDIT TAMRIEL-WIDE A1: A HOME'S LOT off its frame (pixelBuild.js homeFrames) - never grown round a terraced house: an
 *  Imperial City house's one model is its door, so a lot grown round it held its own rooms, the neighbours' and the street.
 *  IC-BACKYARD: its lot is the court behind it (world/imperialBackyards.js, by its frame's `block` and `record`) - turned
 *  with it, `alone` (the fabric parts it from the neighbours', no midline), opened at its door (`access`, the door's box).
 *  AUDIT TAMRIEL-WIDE II W1: with no court of its own, the door's box, where nothing places - its owner, at the door, still
 *  takes back what was set down before. @param {any} frame */
export function lotOfFrame(frame) {
  if (!frame?.terraced) return yardLot(frame.at, frame.box, YARD_MARGIN, frame.rects, frame);
  const door = yardLot(frame.at, frame.box, 0), yard = door ? fabricBackyardOf(frame.block, frame.record) : null;
  return yard ? { ...door, lot: [...yard.lot], turn: yard.turn, alone: true, access: door.lot } : door;
}
const inRect = (x, z, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
/** IC-BACKYARD: a point of a lot's frame on the lot's own axes, and back - turned with its house (`turn`, radians). */
export const lotAxes = (lot, x, z) => { const a = lot?.turn ?? 0, c = Math.cos(a), s = Math.sin(a); return a ? [x * c + z * s, z * c - x * s] : [x, z]; };
const lotFrame = (lot, u, v) => { const a = lot?.turn ?? 0, c = Math.cos(a), s = Math.sin(a); return a ? [u * c - v * s, u * s + v * c] : [u, v]; };
/** Whether a point of the frame stands on the lot (within `pad` of it). */
const onLot = (lot, x, z, pad = 0) => { const [u, v] = lotAxes(lot, x, z); return inRect(u, v, lot.lot, pad); };
/** IC-BACKYARD: the box round a lot on its frame's axes. */
export function lotBox(lot) {
  if (!lot.turn) return lot.lot;
  const [x0, z0, x1, z1] = lot.lot, ps = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([u, v]) => lotFrame(lot, u, v));
  return [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
}
/**
 * YARD-JOINED (FIELD BUGS 2026-10-29f, the housing thread's item 17: "Owning two houses next to each other should allow
 * you to build beyond the plot border"): A LOT BESIDE ITS OWNER'S OTHER HOUSES - `mates`, each `{ walls }` in this lot's
 * frame. No midline is drawn between one owner's houses, so the whole lot is the yard's up to its edge, and theirs are
 * houses (never stood in). AUDIT FB1029f B4: a piece stands on its own lot alone - one stood on the other house's lot
 * stayed there, its yard's, after that house was sold. A turned or a lone lot joins none.
 */
export function yardJoinLots(lot, mates = []) {
  if (!lot || lot.turn || lot.alone || !mates?.length) return lot;
  const theirs = mates.flatMap((m) => m.walls);
  return { ...lot, walls: [...(lot.walls ?? [lot.house]), ...theirs], ...(lot.grounds ? { loose: [...(lot.loose ?? []), ...theirs] } : {}) };
}
/** HOME-LINE (FIELD BUGS 2026-10-11b): how far (x, z) stands from the nearest of these footprints [x0, z0, x1, z1] - 0 on
 *  one, Infinity for none. */
export const yardGapTo = (rs, x, z) => (rs ?? []).reduce((m, r) => Math.min(m, Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]))), Infinity);
/**
 * FB1001 YARD-CORNER: WHETHER THE GROUND A PIECE COVERS MEETS A RECT. `poly` is that ground - its turned box's corners in
 * order (decorTool.js footprintOf), or its one point - and `r` a footprint [x0, z0, x1, z1] taken in by `pad` (touching
 * is not meeting). Asked across the separating axes of the two: the rect's own two, and each of the piece's edges. Its
 * corners alone (the audit's test) let a piece turned across a wall's corner stand with the corner inside it - none of
 * its corners in the house, the house's corner in it.
 */
export function yardFootMeets(poly, r, pad = 0) {
  const x0 = r[0] + pad, z0 = r[1] + pad, x1 = r[2] - pad, z1 = r[3] - pad;
  if (!(x1 >= x0) || !(z1 >= z0) || !poly.length) return false;
  if (poly.every((p) => p[0] < x0) || poly.every((p) => p[0] > x1) || poly.every((p) => p[1] < z0) || poly.every((p) => p[1] > z1)) return false;
  const box = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const edges = poly.length > 2 ? poly.length : poly.length - 1;
  for (let i = 0; i < edges; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const nx = a[1] - b[1], nz = b[0] - a[0];   // the edge's normal
    const along = (p) => p[0] * nx + p[1] * nz;
    const ps = poly.map(along), bs = box.map(along);
    if (Math.max(...ps) < Math.min(...bs) || Math.min(...ps) > Math.max(...bs)) return false;
  }
  return true;
}
/** WALL-TOUCH: how far (x, z) stands from the nearest of plan lines `ls`. */
function gapToLines(ls, x, z) {
  let d = Infinity;
  for (const [ax, az, bx, bz] of ls) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    d = Math.min(d, Math.hypot(x - ax - u * dx, z - az - u * dz));
  }
  return d;
}
const CELL_REACH = YARD_FOOT_CELL * Math.SQRT2;
/** WALL-TOUCH: whether (x, z) stands inside walls `ls` past the clip a piece set on one sits into it. `cellSure`: the
 *  point is on a cell measured inside them, so one farther than a cell's diagonal from every wall is inside. `near`:
 *  those of them within that of the piece, which alone can be nearer. */
function pastWalls(ls, x, z, cellSure, near = ls) {
  const d = gapToLines(near, x, z);
  if (d <= DECOR_WALL_CLIP + 1e-3) return false;
  return (cellSure && d > CELL_REACH) || insideWalls(ls, x, z);
}
/** AUDIT FB1030 Y4: lines `ls` within CELL_REACH of box [x0, z0, x1, z1]. */
const linesNear = (ls, b) => ls.filter((l) => Math.min(l[0], l[2]) <= b[2] + CELL_REACH && Math.max(l[0], l[2]) >= b[0] - CELL_REACH && Math.min(l[1], l[3]) <= b[3] + CELL_REACH && Math.max(l[1], l[3]) >= b[1] - CELL_REACH);
/** WALL-TOUCH: points of the ground a piece covers within `box` - its middle, its corners, and a grid inside it (along
 *  it, for two points) no coarser than 5 cm, nor finer than 2,000 points. */
function groundSamples(ground, x, z, box) {
  const inBox = (p) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
  const pts = [[x, z], ...ground].filter(inBox);
  if (ground.length < 2) return pts;
  const xs = ground.map((p) => p[0]), zs = ground.map((p) => p[1]);
  const bx0 = Math.max(box[0], Math.min(...xs)), bz0 = Math.max(box[1], Math.min(...zs)), bx1 = Math.min(box[2], Math.max(...xs)), bz1 = Math.min(box[3], Math.max(...zs));
  if (!(bx1 >= bx0) || !(bz1 >= bz0)) return pts;
  const step = Math.max(0.05, Math.sqrt(((bx1 - bx0) * (bz1 - bz0)) / 2000), Math.max(bx1 - bx0, bz1 - bz0) / 2000);
  if (ground.length === 2) {
    const [a, b] = ground, n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let i = 1; i < n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
    return pts.filter(inBox);
  }
  const side = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const inside = (p) => {
    let pos = false, neg = false;
    for (let i = 0; i < ground.length; i++) { const c = side(ground[i], ground[(i + 1) % ground.length], p); if (c > 1e-9) pos = true; else if (c < -1e-9) neg = true; }
    return !(pos && neg);
  };
  for (let gx = bx0 + step / 2; gx < bx1; gx += step) for (let gz = bz0 + step / 2; gz < bz1; gz += step) if (inside([gx, gz])) pts.push([gx, gz]);
  return pts;
}
/** WALL-TOUCH, YARD-DECK: whether (x, z) is in one model's ground `g` (its rects near the piece, `rs`) for a piece whose
 *  foot stands at `bottom` - past its ground floor's walls, and under its lowest level roof, or past the walls of the
 *  storey on the deck the foot stands on (that deck's under it; else the highest under the foot, and only a cell from
 *  them is judged by them). */
function inGround(g, rs, x, z, bottom, near) {
  let solid = false, deck = Infinity;
  for (const r of rs) if (inRect(x, z, r)) { if (r.length > 4) deck = Math.min(deck, r[4]); else solid = true; }
  if ((!solid && deck === Infinity) || !pastWalls(g.walls, x, z, true, near.walls)) return false;
  const foot = bottom + YARD_DECK_SLACK;
  if (deck !== Infinity && deck > foot) return true;
  let k = -1;
  g.storeys.forEach((s, i) => { if (deck !== Infinity ? Math.abs(s[0] - deck) < 0.01 : s[0] <= foot && !(k >= 0 && g.storeys[k][0] > s[0])) k = i; });
  if (deck === Infinity) return k < 0 || pastWalls(g.storeys[k][1], x, z, true, near.storeys[k]);   // a cell under no level roof: its storey's wall touched, no more
  return k >= 0 && pastWalls(g.storeys[k][1], x, z, false, near.storeys[k]);
}
let lastIn = { lot: null, key: '', out: false };
/**
 * WALL-TOUCH, YARD-DECK (FIELD BUGS 2026-10-30b): whether a piece at `pos`, covering `ground`, its foot at `bottom`, is IN
 * its house. A lot with its models' parts (`grounds`) is asked by their walls' own lines: a lantern set on the outside
 * wall touches the house and is the yard's, a piece on a deck stands on it. One without (its box, an Imperial City
 * door's) is the house wherever the piece meets it. Asked only once the piece meets the house at all.
 */
function yardInHouse(lot, pos, ground, bottom) {
  if (!lot.grounds) return true;
  const meets = (r) => inRect(pos[0], pos[2], r) || yardFootMeets(ground, r, YARD_EDGE_PAD);
  if (lot.loose.some(meets) || lot.grounds.some((g) => g.loose.some(meets))) return true;
  const key = `${pos[0]},${pos[2]},${bottom}|${ground.join(';')}`;   // AUDIT FB1030 Y4: the ghost asks each frame
  if (lastIn.lot === lot && lastIn.key === key) return lastIn.out;
  const xs = [pos[0], ...ground.map((p) => p[0])], zs = [pos[2], ...ground.map((p) => p[1])];
  const box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  const near = lot.grounds.map((g) => ({ g, rs: [...g.solid, ...g.decks].filter((r) => r[0] <= box[2] && r[2] >= box[0] && r[1] <= box[3] && r[3] >= box[1]) })).filter((n) => n.rs.length);
  let out = false;
  for (const { g, rs } of near) {
    const b = [Math.max(box[0], Math.min(...rs.map((r) => r[0]))), Math.max(box[1], Math.min(...rs.map((r) => r[1]))), Math.min(box[2], Math.max(...rs.map((r) => r[2]))), Math.min(box[3], Math.max(...rs.map((r) => r[3])))];
    const near = { walls: linesNear(g.walls, b), storeys: g.storeys.map(([, ls]) => linesNear(ls, b)) };
    if (groundSamples(ground, pos[0], pos[2], b).some(([x, z]) => inGround(g, rs, x, z, bottom, near))) { out = true; break; }
  }
  lastIn = { lot, key, out };
  return out;
}
/**
 * DECK-ROAD (FIELD BUGS 2026-10-30c, "it's clearly not on the road, it's still on the balcony of the house"): the road
 * squares `rs` a piece stands on. 175 of the 1,114 residences with a deck stand part of it over the town's road tiles. A
 * piece whose foot stands on its house's deck stands on those its ground meets past the house's own (`walls`); on the
 * ground, on every one.
 */
function yardRoadsUnder(lot, pos, ground, bottom, rs) {
  const meets = (r) => inRect(pos[0], pos[2], r) || yardFootMeets(ground, r);
  if (!rs?.length || !(lot.grounds ?? []).some((g) => g.decks.some((d) => d[4] <= bottom + YARD_DECK_SLACK && meets(d)))) return rs;
  const house = lot.walls ?? [lot.house];
  return rs.filter((r) => {
    const b = [r[0] + YARD_EDGE_PAD, r[1] + YARD_EDGE_PAD, r[2] - YARD_EDGE_PAD, r[3] - YARD_EDGE_PAD];
    const under = house.filter((w) => w[0] <= b[2] && w[2] >= b[0] && w[1] <= b[3] && w[3] >= b[1]);
    return groundSamples(ground, pos[0], pos[2], b).some(([x, z]) => !under.some((w) => inRect(x, z, w)));
  });
}
/**
 * WHY A PIECE CANNOT STAND at `pos` (from the frame's origin), or null: off the lot, inside the house's footprint (a
 * piece on its roof too - FB1009 HOME-FOOT: the lot's `walls`, the ground its faces cover), or on another building's
 * (`others`, their ground's rects in the same frame [x0, z0, x1, z1]); a piece's middle on one of a building's rects is on
 * it, so the seam the pad leaves between two of them lets nothing through.
 * AUDIT: `foot` - the ground it covers, offsets [dx, dz] from `pos` (decorTool.js footprintOf) - is asked too: all of
 * it on the lot, none of it in the house or on another building's ground (its middle alone let a long piece straddle a
 * wall). FB1001 YARD-CORNER: "none of it" is the ground it covers, not its corners (yardFootMeets). FB1001 ROAD-LOT:
 * nor on the town's road or a path (`roads`, the road's tiles in the same frame - yardRoadsOf). YARD-HEIGHT: nor
 * higher than DECOR_YARD_HIGH over the frame's origin (the town's ground), YARD-WALLS: nor YARD_FREE_HIGH off its house.
 * HOME-LINE (FIELD BUGS 2026-10-11b, ShikiX3: "I can't place in front of my door but I can place in front of another's
 * home"; afjiz: "my property line goes a little far into the property beside me"; Mac: "Split at the midline"): nor any
 * of it nearer another building's ground than the house's own - the lot is the house grown YARD_MARGIN, and two houses'
 * lots overlap where they stand closer than twice that, so the ground between them is split down its middle (a tie the
 * house's). The marked edge is still the lot's rectangle.
 * YARD-LINE (FIELD BUGS 2026-10-12b, "I am unable to build in about 50% of my yard. It says that it belongs to another
 * property no matter what I do"): the midline is drawn to `lines` alone - the ground of the buildings that hold a lot of
 * their own (yardLineHolder) - never to a shop's, a temple's or a tavern's, which hold no yard to split with; `others`
 * (every building's ground) is still never stood on. Unpassed, `lines` is `others`, as HOME-LINE had it.
 */
export function yardWhyNot(pos, lot, others = [], foot = [], roads = [], lines = others) {
  if (!lot || !Array.isArray(pos)) return YARD_OFF_LOT;
  const [x, , z] = pos;
  const corners = (foot ?? []).map(([dx, dz]) => [x + dx, z + dz]);
  const points = [[x, z], ...corners];
  if (!points.every(([px, pz]) => onLot(lot, px, pz))) return YARD_OFF_LOT;
  if (Math.abs(x) > DECOR_YARD_POS_MAX || Math.abs(z) > DECOR_YARD_POS_MAX) return YARD_OFF_LOT;   // the service's bound (net/decorLaw.js decorYardPlaceOf)
  const ground = corners.length ? corners : [[x, z]];
  const meets = (r) => inRect(x, z, r) || yardFootMeets(ground, r, YARD_EDGE_PAD);   // FB1009 HOME-FOOT: its middle, or its ground
  if ((lot.walls ?? [lot.house]).some(meets) && yardInHouse(lot, pos, ground, pos[1] + (/** @type {any} */ (foot)?.bottom ?? 0))) return YARD_IN_HOUSE;   // WALL-TOUCH, YARD-DECK; AUDIT FB1030 Y5: its foot
  if ((others ?? []).some(meets)) return YARD_ON_OTHER;
  const own = lot.walls ?? [lot.house];
  if (!lot.alone && points.some(([px, pz]) => yardGapTo(lines, px, pz) < yardGapTo(own, px, pz))) return YARD_ON_OTHER;   // HOME-LINE; YARD-LINE: a lot's holder's; IC-BACKYARD: an `alone` lot's line is the fabric's
  roads = yardRoadsUnder(lot, pos, ground, pos[1] + (/** @type {any} */ (foot)?.bottom ?? 0), roads);   // DECK-ROAD: a deck over the road is the house's
  if ((roads ?? []).some((r) => yardFootMeets(ground, r, YARD_EDGE_PAD))) return YARD_ON_ROAD;
  if (pos[1] > YARD_FREE_HIGH && !yardByHouse(lot, x, z, ground, pos[1] + (/** @type {any} */ (foot)?.bottom ?? 0))) return yardTooHighFree();   // YARD-WALLS
  if (!decorYardHighOk({ pos })) return YARD_TOO_HIGH;   // YARD-HEIGHT: never a tower - the service's own law
  return null;
}
/** YARD-WALLS: whether a piece stands by its house - its middle or its ground (`ground`) on the house (its models'
 *  `cover`; its walls, else its box, where none are known) or touching it, or touching an upright face of it as high as
 *  its foot (`bottom`), and that foot no higher than the house's top. A lot that knows no top (hand-built) has none.
 *  AUDIT FB1031 Y1: never its box - the open ground in it (an L's notch, a courtyard) took a free piece to 8 m in 4,309
 *  of 6,016 houses; nor an owner's other house (yardJoinLots joins no grounds), whose top is not this lot's. */
function yardByHouse(lot, x, z, ground, bottom) {
  if (!(bottom <= (lot.top ?? -Infinity) + YARD_DECK_SLACK)) return false;
  const own = lot.grounds ? lot.grounds.flatMap((g) => g.cover) : lot.walls ?? [lot.house];
  if (own.some((r) => inRect(x, z, r, YARD_EDGE_PAD) || yardFootMeets(ground, r, -YARD_EDGE_PAD))) return true;
  const pts = [[x, z], ...ground];
  return (lot.grounds ?? []).some((g) => g.sides.some((l) => bottom >= l[4] - YARD_DECK_SLACK && bottom <= l[5] + YARD_DECK_SLACK && pts.some(([px, pz]) => gapToLines([l], px, pz) <= YARD_EDGE_PAD + 1e-3)));
}
/**
 * YARD-LINE (FIELD BUGS 2026-10-12b): WHETHER A NEIGHBOURING BUILDING HOLDS A LOT the ground between it and a yard is split
 * with - a building that could be a home (onlineHomes.js homeCandidate: Daggerfall's houses, a guild's hideout never), or
 * one a home's record stands for (a guild hall's yard). `frame` is the town pixel's (scenes/world.js: its `type` and
 * `faction`, the building's own record), `home` the town's home at its key, or null.
 */
export const yardLineHolder = (frame, bk, home = null) => !!home || homeCandidate({ buildingType: frame?.type, buildingKey: bk, factionId: frame?.faction ?? 0 });
/**
 * FB1001 ROAD-LOT: THE ROAD UNDER A LOT - every ground tile of the built pixel `p` the lot reaches that is road or path,
 * as its square [x0, z0, x1, z1] in the frame of `at` (the building's own place, pixel-local). Road is what Daggerfall
 * says is road - PlayerMotor.OnPathTile's records (46, 47, 55: the town's streets, and the ring the road painter lays
 * round a town) - or what the road painter says it wrote (`p.paths` - a track across grass writes the records a field's
 * own edge does, GRASS-PATH1). The pixel's tilemap is the one its terrain draws and the player's feet read (world.js
 * playerGroundSample): tile (tx, tz) is pixel-local [tx, tz] x RMB_TILE_SIDE. None where the pixel holds no tiles.
 */
export function yardRoadsOf(p, at, lot) {
  const bytes = p?.tilemapBytes ?? null;
  if (!bytes || !lot || !Array.isArray(at)) return [];
  const S = RMB_TILE_SIDE, N = TERRAIN_TILE_DIM;
  const [lx0, lz0, lx1, lz1] = lotBox(lot);
  const tx0 = Math.max(0, Math.floor((at[0] + lx0) / S)), tx1 = Math.min(N - 1, Math.floor((at[0] + lx1) / S));
  const tz0 = Math.max(0, Math.floor((at[2] + lz0) / S)), tz1 = Math.min(N - 1, Math.floor((at[2] + lz1) / S));
  const out = [];
  for (let tz = tz0; tz <= tz1; tz++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const i = tz * N + tx;
      if (!onPathTile(bytes[i] >> 2) && !p.paths?.[i]) continue;
      out.push([tx * S - at[0], tz * S - at[2], (tx + 1) * S - at[0], (tz + 1) * S - at[2]]);
    }
  }
  return out;
}
/**
 * FB1001 ROAD-LOT: THE LOT'S EDGE, WHERE A PIECE MAY STAND - the lot's rect with the road taken out of it (`roads`,
 * yardRoadsOf's squares), as its boundary: segments [ax, az, bx, bz] in the lot's frame, each run so the lot lies on its
 * left (the bands' faces turned in, as the four sides always were), joined end to end into loops and a straight run
 * one segment. With no road it is the lot's four sides, south first. IC-BACKYARD: a turned lot's four sides, turned back
 * to its frame - its court holds no road (and a road's squares stand on the frame's axes, not the lot's).
 */
export function yardLotEdges(lot, roads = []) {
  if (!lot) return [];
  const [X0, Z0, X1, Z1] = lot.lot;
  const holes = lot.turn ? [] : (roads ?? []).filter((r) => r[0] < X1 && r[2] > X0 && r[1] < Z1 && r[3] > Z0);
  const cuts = (lo, hi, i, j) => [...new Set([lo, hi, ...holes.flatMap((r) => [r[i], r[j]]).filter((v) => v > lo && v < hi)])].sort((a, b) => a - b);
  const xs = cuts(X0, X1, 0, 2), zs = cuts(Z0, Z1, 1, 3);
  const out = cellLoops(xs, zs, (cx, cz) => !holes.some((r) => cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3])).flat();
  return lot.turn ? out.map(([ax, az, bx, bz]) => [...lotFrame(lot, ax, az), ...lotFrame(lot, bx, bz)]) : out;
}
/** The boundary of the cells between cuts `xs` and `zs` whose middle `open` holds, as loops of runs [ax, az, bx, bz] -
 *  each with the open ground on its left, from its lowest start (south, then west), a run in one direction one segment. */
function cellLoops(xs, zs, open) {
  const W = xs.length - 1, H = zs.length - 1;
  const cell = new Uint8Array(Math.max(0, W * H));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) cell[j * W + i] = open((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) ? 1 : 0;
  const at = (i, j) => i >= 0 && j >= 0 && i < W && j < H && cell[j * W + i] === 1;
  const segs = [];
  for (let i = 0; i <= W; i++) {
    for (let j = 0; j < H; j++) {
      const w = at(i - 1, j), e = at(i, j);
      if (w !== e) segs.push(e ? [xs[i], zs[j + 1], xs[i], zs[j]] : [xs[i], zs[j], xs[i], zs[j + 1]]);
    }
  }
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i < W; i++) {
      const s = at(i, j - 1), n = at(i, j);
      if (s !== n) segs.push(n ? [xs[i], zs[j], xs[i + 1], zs[j]] : [xs[i + 1], zs[j], xs[i], zs[j]]);
    }
  }
  const from = new Map();
  for (const q of segs) { const k = `${q[0]},${q[1]}`; (from.get(k) ?? from.set(k, []).get(k)).push(q); }
  const take = (k, d) => {
    const list = from.get(k);
    if (!list?.length) return null;
    const i = Math.max(0, d ? list.findIndex((q) => dir(q) === d) : 0);
    return list.splice(i, 1)[0];
  };
  const dir = (q) => `${Math.sign(q[2] - q[0])},${Math.sign(q[3] - q[1])}`;
  const loops = [];
  for (;;) {
    let first = null;
    for (const list of from.values()) for (const q of list) if (!first || q[1] < first[1] || (q[1] === first[1] && q[0] < first[0])) first = q;
    if (!first) break;
    take(`${first[0]},${first[1]}`, dir(first));
    const runs = [];
    let run = [...first];
    for (;;) {
      const next = take(`${run[2]},${run[3]}`, dir(run));
      if (!next) break;
      if (dir(next) === dir(run)) { run[2] = next[2]; run[3] = next[3]; continue; }
      runs.push(run);
      run = [...next];
    }
    runs.push(run);
    loops.push(runs);
  }
  return loops;
}
/** YARD-BORDER: a loop's corners kept within `tol` of it (Douglas-Peucker, closed) - a staircase read as its slope. */
function simplifyLoop(runs, tol) {
  const pts = runs.map((r) => [r[0], r[1]]);
  if (pts.length < 4) return runs;
  const keep = new Uint8Array(pts.length);
  const far = (a, b) => {
    const [ax, az] = pts[a], [bx, bz] = pts[b % pts.length];
    let best = -1, d = tol;
    for (let i = a + 1; i < b; i++) {
      const [px, pz] = pts[i], L = Math.hypot(bx - ax, bz - az) || 1;
      const e = Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / L;
      if (e > d) { d = e; best = i; }
    }
    return best;
  };
  const split = (a, b) => { const i = far(a, b); if (i < 0) return; keep[i] = 1; split(a, i); split(i, b); };
  let mid = 1;
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[mid][0] - pts[0][0], pts[mid][1] - pts[0][1])) mid = i;
  keep[0] = 1; keep[mid] = 1;
  split(0, mid); split(mid, pts.length);
  const kept = pts.filter((_, i) => keep[i]);
  return kept.map((p, i) => [p[0], p[1], ...kept[(i + 1) % kept.length]]);
}
/** YARD-BORDER: how finely the midline is traced, and how far a drawn corner may stand from it, metres. */
export const YARD_BORDER_CELL = 0.5;
export const YARD_BORDER_TOL = 0.4;
/** YARD-BORDER: the most cuts a trace takes on one axis past the half-metre cells (AUDIT FB1029f B1). */
const YARD_BORDER_CUTS_MAX = 160;
/** The squared distance from (x, z) to the nearest of `rs`, at most `cap` - a trace asks it of every cell. */
function gap2(rs, x, z, cap = Infinity) {
  let m = cap;
  for (const r of rs) {
    const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]), d = dx * dx + dz * dz;
    if (d < m) { m = d; if (m === 0) break; }
  }
  return m;
}
/**
 * YARD-BORDER (FIELD BUGS 2026-10-29f, the housing thread's item 16: "If two plots overlap, which they do literally all
 * the time, the borders you see are just wrong"): THE EDGE OF WHERE A PIECE MAY STAND - the lot, with the road and the
 * neighbours' side of HOME-LINE's midline (`lines`) taken out, as yardWhyNot asks of a piece's middle. Traced in
 * YARD_BORDER_CELL cells, cut exactly where two walls face each other (AUDIT FB1029f B1: facing pairs alone, and no more
 * than YARD_BORDER_CUTS_MAX - every pair cut a Hammerfell house's trace to seconds); every line that can win a point of
 * the lot is read (B5). A turned or a lone lot has no midline: its edge is yardLotEdges'.
 */
export function yardStandEdges(lot, roads = [], lines = []) {
  if (!lot) return [];
  if (lot.turn || lot.alone) return yardLotEdges(lot, roads);
  const [X0, Z0, X1, Z1] = lot.lot;
  const own = lot.walls ?? [lot.house];
  const corners = [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]];   // B5: one wall's farthest point of the lot is a corner
  const far = Math.sqrt(Math.min(...own.map((r) => Math.max(...corners.map(([x, z]) => gap2([r], x, z))))));
  const reach = (r, m) => r[0] < X1 + m && r[2] > X0 - m && r[1] < Z1 + m && r[3] > Z0 - m;
  const near = (lines ?? []).filter((r) => reach(r, far));
  if (!near.length) return yardLotEdges(lot, roads);
  const holes = (roads ?? []).filter((r) => reach(r, 0));
  const snap = (v) => Math.round(v * 100) / 100;   // B10: a cut a hundredth from another is the same cut
  const cuts = (lo, hi, i, j) => {
    const fixed = [lo, hi, ...[lot.lot, ...holes].flatMap((r) => [r[i], r[j]])];
    for (let k = 1; lo + k * YARD_BORDER_CELL < hi; k++) fixed.push(lo + k * YARD_BORDER_CELL);
    const facing = [];
    const a = 1 - i;   // the other axis: two walls face where they overlap across it
    for (const o of own) {
      for (const r of near) {
        if (!(r[a] < o[a + 2] && o[a] < r[a + 2])) continue;
        if (r[i] >= o[j]) facing.push((o[j] + r[i]) / 2); else if (r[j] <= o[i]) facing.push((r[j] + o[i]) / 2);
      }
    }
    const mid = [...new Set(facing.map(snap))];
    const all = mid.length <= YARD_BORDER_CUTS_MAX ? [...fixed, ...mid] : fixed;
    return [...new Set(all.map(snap))].filter((v) => v >= lo && v <= hi).sort((p, q) => p - q);
  };
  const xs = cuts(X0, X1, 0, 2), zs = cuts(Z0, Z1, 1, 3);
  const open = (x, z) => {
    if (holes.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3])) return false;
    const mine = gap2(own, x, z);
    return !(gap2(near, x, z, mine) < mine);   // the nearer house's, a tie this one's
  };
  const loops = cellLoops(xs, zs, open);
  // B6: never more bands than the decal batch holds - a coarser read of the slopes where a street is crowded
  let tol = YARD_BORDER_TOL, segs = loops.flatMap((runs) => simplifyLoop(runs, tol));
  while (segs.length > DECOR_LOT_MARKS && tol < 4) { tol *= 2; segs = loops.flatMap((runs) => simplifyLoop(runs, tol)); }
  return segs;
}
/** Whether a world point stands on the lot (or within `near` of it) - `origin` the frame's, in the world. IC-BACKYARD: or
 *  at its door, for a lot that stands away from it (`access`). */
export const yardHolds = (lot, origin, p, near = 0) => !!lot && Array.isArray(p)
  && (onLot(lot, p[0] - origin[0], p[2] - origin[2], near) || (!!lot.access && inRect(p[0] - origin[0], p[2] - origin[2], lot.access, near)));
/**
 * THE LOT'S MARKED EDGE: its four sides as upright bands (the decal pass's quads - combat/blood/bloodDecals.js writeDecalQuad's
 * shape), standing on the ground, in the world (`origin` the frame's). FB1001 ROAD-LOT: with the road taken out of it
 * (`roads` - yardRoadsOf), the edge runs along the road's side: the band is where a piece may stand up to. YARD-BORDER:
 * and along the midline with a neighbour's house (`lines` - yardStandEdges).
 */
export function yardLotQuads(lot, origin, high = YARD_MARK_HIGH, roads = [], lines = []) {
  if (!lot) return [];
  const y = origin[1] + lot.y + high / 2;
  const side = ([ax, az, bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az);
    return { pos: [origin[0] + (ax + bx) / 2, y, origin[2] + (az + bz) / 2], size: high, stretch: len / high, right: [(bx - ax) / len, 0, (bz - az) / len], up: [0, 1, 0] };
  };
  return yardStandEdges(lot, roads, lines).map(side);   // YARD-BORDER: where a piece may stand
}

/**
 * THE TOWN'S YARDS, AND THE OWNER'S DECORATOR OUTSIDE. `deps` (the world host's - scenes/world.js):
 *   api          - net/accountClient.js accountDecor: yardCells(mapId, cells), place (with `yard`), move, remove
 *   polling(), standClock() - YARD-CELL: whether the cells in reach may be polled now; the stand budget's clock (ms)
 *   homes        - systems/online/onlineHomes.js: homeAt(mapId, key) - whose a home is, and whether it is the character's own
 *   built()      - the world's built pixels (each `{ px, py, homeTown, homeFrames }` - homeFrames: key -> { at, box,
 *                  rects }, pixel-local; FB1009 HOME-FOOT: `rects` the ground its models' faces cover, footRectsAt's)
 *   translation(px, py) - a pixel's place in the scene now
 *   feet()       - where the player stands (scene); outside() - whether the player walks the street (no building,
 *                  no dungeon, no saddle)
 *   collider()   - the world's collider (addMesh, removeBucket, surfaceHit)
 *   cull(box)    - PERF-YARD: the host's view test of a piece's box in the scene (decorRoom.js DECOR_DRAW / DECOR_SHADOW /
 *                  DECOR_SKIP), or none - every piece within YARD_DRAW_M drawn
 *   meshes, renderer, getTexture, uploadRecord, uploadRecordFrame, iconUrl - the pipeline's, as a room's pool takes them
 *   character(), realm(), wallet(region) - who writes, their record's act, the purse and the home's region's account
 *   doc, win, canvas, touch, actionOf(e), locked(), cursorOff(), stick(), say(line), refusal(word), openSlot(o), now()
 *   look         - HOME-LOOK: `{ preview(mapId, key, look|undefined), season() }` - the painter's preview on the house
 *   seasonal()   - DECOR-OUTDOOR: Seasons of the Iliac Bay's helper while it stands, else null (scenes/yardNature.js)
 *   trees        - DECOR-LPT: the world's Low Poly Trees, `{ door, sway(proto, share) }` (scenes/yardNature.js), or null -
 *                  a yard's tree stands as the mod's own; the world reads the yards' near sets back (`treeSets`)
 * DECOR-OUTDOOR: a built pixel also carries its `texRemap`, `season`, `townClimate`, `flatAnims` and `forest` ({ base, archive }:
 * its climate's nature set and the season's archive of it) - a yard's pieces stand in its town's climate and season.
 */
export function createHomeYards(deps) {
  const now = () => deps.now?.() ?? Date.now();
  /** YARD-RANGE: how far a stranger's yard is drawn, now (the player's choice, read every frame - it lands at once). */
  const range = () => yardRangeOf(deps.range?.());
  /** YARD-RANGE: how far yard `y` is drawn - the one the owner stands in always, their own to YARD_DRAW_M. */
  const reachOf = (y) => (y === cur?.yard ? Infinity : y.kept ? YARD_DRAW_M : range());
  function nearEye(y, eye) {
    const reach = reachOf(y);
    if (!eye || reach === Infinity) return true;
    const o = originOf(y);
    return Math.hypot(o[0] - eye[0], o[2] - eye[2]) <= reach;
  }
  let _eye = null;
  /** YARD-RANGE: the host's view test after the size's (a piece too small to see is skipped before the planes are asked). */
  const seenCull = (box) => (_eye && !decorBoxSeen(box, _eye, YARD_MIN_ANGLE) ? DECOR_SKIP : deps.cull ? deps.cull(box) : DECOR_DRAW);
  const _batches = [];
  // YARD-CELL: the town's yards, a block at a time - polled only while they can be seen: the player on foot in the street
  // (`outside` - never indoors, in a dungeon or on the travel map), no window over it, the tab shown. A cell coming into
  // reach is asked whatever this says.
  let overlayUpNow = false;
  const pollingNow = () => {
    if (deps.polling) return deps.polling();
    const outside = deps.outside ? !!deps.outside() : true;
    return outside && !overlayUpNow && !deps.doc?.hidden;
  };
  const cells = createYardCellSync({ api: deps.api, now, polling: pollingNow, push: deps.push ?? yardPushState });
  const offYardWords = (deps.onYardWords ?? onYardWords)((words) => cells.hear(words));   // YC2: a pushed cell asked; the ear let go with the yards (destroy)
  /** What a frame's standing time is read on - the host's clock for its tests, else the page's. */
  const standClock = () => deps.standClock?.() ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  /** @type {Map<string, {pool: any, px: number, py: number, mapId: number, bk: number, t: number[], sig: string, src: any[] | null, srcSig: string, kept: boolean, door: any, lot: any, frame: any, entry: any, skin: number, trees: Map<string, any>, treeSet: any}>} */
  const yards = new Map();
  const yardFigs = [];   // MWNPC18 (AUDIT MWNPC16-18 D4): figures()'s one list
  let mergesLeft = 0;   // YARD-MERGE: this frame's merges still to make (draw refills it)
  const merge = { take: () => (mergesLeft > 0 ? (mergesLeft--, true) : false), now };
  const blocks = createYardBlockMerge({ renderer: deps.renderer, now, clock: () => standClock() });
  let syncIn = 0;
  /** @type {any} the owner's own yard the decorator stands in, or null */
  let cur = null;
  let panelWas = false;

  /** DECOR-OUTDOOR: the built pixel a yard stands in, now (a season's turn builds it again). */
  const entryOf = (y) => deps.built?.()?.get?.(`${y.px},${y.py}`) ?? null;
  const nature = createYardNature({ renderer: deps.renderer, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, seasonal: () => deps.seasonal?.() ?? null, trees: deps.trees ?? null });
  /** DECOR-LPT: A YARD'S TREE JOINS ITS NEAR SET while its piece stands (`got` - yardNature.js stand's answer, `live()`
   *  whether the piece still stands as it was asked), and leaves it with the piece: the room lets go of what a stand holds
   *  (`release`), the tree with it. A stand the piece outlived plants nothing - an older answer landing after a newer one
   *  would stand in its place - and a release takes only the tree it planted. */
  function plantTree(y, id, got, live) {
    if (!got?.tree || !live()) return got;
    const { tree, release } = got;
    y.trees.set(id, tree);
    y.treeSet = null;
    return { ...got, release: () => { if (y.trees.get(id) === tree) { y.trees.delete(id); y.treeSet = null; } release?.(); } };
  }
  /** DECOR-OUTDOOR: A YARD'S MODEL IN ITS TOWN'S CLIMATE - its swaps written into the pixel's own table (the one the yard
   *  draws with, `remapOf`), by the town's climate and season, as the town's own models' are (scenes/world.js
   *  buildPixelNow's remapSubMeshes): the table held only the swaps of the models the town itself stood, so a fence the
   *  town never stood drew in another climate's wood. */
  function climateOf(y, gpu) {
    const p = entryOf(y);
    if (!p?.texRemap || p.townClimate == null) return null;
    return remapSubMeshes(gpu?.subMeshes, p.texRemap, (a, r) => applyClimate(a, r, p.townClimate, p.season), { getTexture: deps.getTexture, uploadRecord: deps.uploadRecord }, p.townClimate);   // AUDIT PRECIP HOST-7: in the table's recipe - a re-skin asks it again
  }

  /** The world point a yard's frame stands at, now. */
  const originOf = (y) => {
    const t = deps.translation(y.px, y.py);
    const f = y.frame;
    return [t[0] + f.at[0], t[1] + f.at[1], t[2] + f.at[2]];
  };
  /** A yard made for home `bk` of pixel `p`. YARD-BLOCK: a stranger's (not `kept`) merges with its block's other yards; a
   *  kept one merges alone, as its owner writes into it. */
  function makeYard(key, p, bk, frame, kept) {
    const door = kept ? null : blocks.door(`${p.px},${p.py}:${yardCellOf(bk)}`, p.px, p.py, () => deps.translation(p.px, p.py));
    // AUDIT IC-BACKYARD P1: its lot worked when first read - an Imperial City house's is a survey of its court, and a
    // stranger's yard never reads its lot (ownYardHere asks a kept one's alone)
    let lot;
    const y = { key, px: p.px, py: p.py, mapId: p.homeTown, bk, frame, t: [...deps.translation(p.px, p.py)], sig: '', src: null, srcSig: '', kept, door, get lot() { if (lot === undefined) lot = lotOfFrame(frame); return lot; }, pool: null, entry: p, skin: p._skinGen ?? 0, trees: new Map(), treeSet: null };
    y.pool = createDecorRoom({
      meshes: deps.meshes, renderer: deps.renderer, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, uploadRecordFrame: deps.uploadRecordFrame,
      collider: () => deps.collider?.() ?? null, origin: () => originOf(y),
      // DECOR-CLEAR / ROCK-CLEAR: no body of its own - a piece landing round a passer-by is held back from the body the
      // world collider's gate guards (world.js settles it every frame), solid once they are clear of it
      // YARD-LIGHT: a lamp lights as the town's (yardLampOf) - the room's machinery mounts it when its picture stands, moves
      // it with a recentre (restand) and takes it down with the piece; `lamps` reads them in the order the pieces stand
      lampOf: yardLampOf,
      merge: door ?? merge,   // YARD-MERGE: a yard's models one mesh once it settles, a frame's budget at a time (YARD-BLOCK: a stranger's, its block's)
      flatAnims: () => entryOf(y)?.flatAnims ?? null,   // DECOR-OUTDOOR: a street's animal or flame moves as its town's own (the pixel's animator, ticked with it)
      prepareModel: (gpu) => climateOf(y, gpu),   // DECOR-OUTDOOR: its town's climate
      // DECOR-OUTDOOR: a tree or a plant in its town's season - the climate's own, drawn as its pixel draws its nature;
      // DECOR-LPT: a tree Low Poly Trees stands, into the yard's near set while it stands
      standFlat: (piece, at, live) => {
        if (!isNaturePiece(piece)) return null;
        const pe = entryOf(y);
        return nature.stand(piece, at, { season: pe?.season ?? 0, natureArchive: pe?.forest?.archive ?? null, live }).then((got) => plantTree(y, piece.id, got, live));
      },
    });
    yards.set(key, y);
    if (door) blocks.join(door, y);
    return y;
  }
  /** A yard taken down: its pieces, and its place in its block. */
  function takeDown(key, y) {
    y.pool.destroyAll();
    if (y.door) blocks.leave(y.door, y);
    yards.delete(key);
  }

  /** How far a home stands from the player's feet, metres on the ground - 0 where the host says no feet, or the frame
   *  has no place (YARD-SHED: such a home is asked, and stood, as before - first). */
  function homeDistance(t, frame, feet) {
    if (!feet || !frame?.at) return 0;
    return Math.hypot(t[0] + frame.at[0] - feet[0], t[2] + frame.at[2] - feet[2]);
  }
  /** A yard stood again in its pixel now: `holding` keeps the pieces standing (the owner's decorator is up). */
  function stand(y, p, t, pieces, sig, holding) {
    y.t = [...t];
    y.entry = p;
    y.skin = p._skinGen ?? 0;
    if (!holding) y.sig = sig;
    y.pool.set(holding ? y.pool.list() : pieces ?? y.pool.list());
  }
  /** THE YARDS BROUGHT IN LINE with the town: the cells within reach asked (YARD-CELL), each home's pieces stood in its
   *  pixel (again where its cell's answer changed, or the world recentred) nearest first on the frame's budget, and a
   *  pixel gone taken down with its yards. Answers whether a yard still waits to be stood. */
  function sync() {
    const live = new Set();
    const feet = deps.feet?.() ?? null;
    const heard = deps.heard?.() !== false;   // WD3 (AUDIT WD3 R6): a yard is laid out on its town's layout - none asked before it is heard
    /** @type {Map<string, import('./yardCellSync.js').CellWish>} each cell wanted, at its nearest listed home */
    const wishes = new Map();
    /** @type {Array<{ y: any, p: any, t: number[], pieces: any[] | null, sig: string, holding: boolean, distance: number }>} */
    const waiting = [];
    let behind = false;
    for (const [pk, p] of deps.built?.() ?? []) {
      if (!p?.homeTown || !p.homeFrames) continue;
      const t = deps.translation(p.px, p.py);
      for (const [bk, frame] of p.homeFrames) {
        const home = deps.homes?.homeAt?.(p.homeTown, bk) ?? null;
        const distance = homeDistance(t, frame, feet);
        if (home && heard && distance <= YARD_ASK_M + YARD_KEEP_MARGIN_M) {
          const cell = yardCellOf(bk);
          const wishKey = `${p.homeTown}:${cell}`;
          const had = wishes.get(wishKey);
          if (!had || distance < had.distance) wishes.set(wishKey, { mapId: p.homeTown, cell, distance });
        }
        // HOME-VOTE: a home the town voted below zero stands no yard but for its insiders (net/homeVoteLaw.js) - its
        // pieces taken down where they stood, and stood again the moment its votes climb
        const pieces = homeDecorShownHere(home, p.homeTown) ? cells.piecesOf(p.homeTown, bk) : null;
        if (!home || (!pieces?.length && !homeOutsideKept(home))) continue;   // a yard stands for a home with pieces, or for its owner (GUILD-YARD: a hall's keeper)
        if (!homeOutsideKept(home) && range() === 0) continue;   // YARD-RANGE: none of a stranger's - taken down where it stood
        const key = `${pk}:${bk}`;
        live.add(key);
        const kept = homeOutsideKept(home);
        let y = yards.get(key);
        // YARD-BLOCK: a yard that became its owner's (or stopped being) is made again, to merge the other way
        if (y && y.kept !== kept) {
          takeDown(key, y);
          y = undefined;
        }
        y ??= makeYard(key, p, bk, frame, kept);
        const moved = t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2];
        // YARD-RANGE: the town's answer written out again only when it is another answer - every half second, for every
        // home of every built town, it was two thousand pieces stringified to learn nothing had changed (the town's lists
        // are replaced, never written into: ensure and keep)
        if (pieces && pieces !== y.src) { y.src = pieces; y.srcSig = JSON.stringify(pieces); }
        const sig = pieces ? y.srcSig : '';
        // DECOR-OUTDOOR: its pixel BUILT AGAIN (a season's turn, an install, a painted home leaving the merge) - every piece
        // stood again in the new pixel's climate table, animator and season, as the town's own flats are; AUDIT PRECIP
        // HOST-7: or RE-SKINNED where it stands (the snow's turn - scenes/pixelBuild.js reskinPixelNow), its season new
        const rebuilt = y.entry !== p || y.skin !== (p._skinGen ?? 0);
        // AUDIT 05b A4: the owner writing this yard holds it - the pieces standing are the truth until the decorator
        // is put away, and the town's answer waits (its `sig` unread); moved or built again meanwhile, it stands again as it
        // stands. The rebuild stood the town's answer under the open decorator - a hall's other keeper's write the panel
        // was holding back, a piece being moved gone from under it.
        const holding = cur?.yard === y && busyWriting();
        if (moved || rebuilt || (sig !== y.sig && !holding)) {
          if (y.kept || cur?.yard === y) stand(y, p, t, pieces, sig, holding);
          else waiting.push({ y, p, t, pieces, sig, holding, distance });   // a stranger's: in the frame's nearest-first turn below
        }
      }
    }
    cells.update([...wishes.values()]);
    for (const [key, y] of yards) if (!live.has(key)) takeDown(key, y);
    // a stranger's yard past this frame's budget waits, as it was, for the next frame's sync
    waiting.sort((a, b) => a.distance - b.distance);
    const started = standClock();
    let stood = 0;
    for (const w of waiting) {
      if (stood > 0 && standClock() - started >= YARD_STAND_BUDGET_MS) {
        behind = true;
        break;
      }
      stand(w.y, w.p, w.t, w.pieces, w.sig, w.holding);
      stood++;
    }
    return behind;
  }
  const busyWriting = () => !!tool.flying() || !!tool.panelOpen();
  /** A pixel's climate swaps (its texRemap), or none. */
  const remapAt = (px, py) => deps.built?.()?.get?.(`${px},${py}`)?.texRemap ?? null;
  /** A yard's pixel's climate swaps. */
  const remapOf = (y) => remapAt(y.px, y.py);
  /** YARD-BLOCK: how far a block is from the eye - its nearest yard's distance (no eye: 0). */
  function blockDistance(block, eye) {
    if (!eye) return 0;
    let nearest = Infinity;
    for (const y of block.yards) {
      const o = originOf(y);
      nearest = Math.min(nearest, Math.hypot(o[0] - eye[0], o[2] - eye[2]));
    }
    return nearest;
  }

  /** THE OWNER'S YARD the player stands on (or near), in this frame - or null. AUDIT GUILD-YARD C1: of the kept yards
   *  under the feet (a home's owner who keeps a hall beside it stands on two lots between them), the one whose lot holds
   *  them (not only within YARD_NEAR of it), then whose house stands nearest them - never the first the town stood. */
  function ownYardHere() {
    const feet = deps.feet?.();
    if (!feet || !deps.outside?.() || deps.heard?.() === false) return null;   // AUDIT WD3 R6: nor furnished
    let best = null, bestRank = Infinity;
    for (const y of yards.values()) {
      const home = deps.homes?.homeAt?.(y.mapId, y.bk) ?? null;
      if (!homeOutsideKept(home)) continue;   // GUILD-YARD: its owner's, or a keeper's of the guild whose hall it is
      const o = originOf(y);
      if (!yardHolds(y.lot, o, feet, YARD_NEAR)) continue;
      const x = feet[0] - o[0], z = feet[2] - o[2], h = y.lot.house;
      const away = Math.hypot(Math.max(h[0] - x, 0, x - h[2]), Math.max(h[1] - z, 0, z - h[3]));
      const rank = (yardHolds(y.lot, o, feet) ? 0 : YARD_NEAR_ONLY) + away;
      if (rank < bestRank) { best = { y, home }; bestRank = rank; }
    }
    if (!best) return null;
    const { y, home } = best;
    const others = [], lines = [];
    const p = deps.built?.()?.get?.(`${y.px},${y.py}`);
    const mates = yardMates(y, home);
    for (const [bk, f] of p?.homeFrames ?? []) {
      if (bk === y.bk) continue;
      const mate = mates.has(bk);   // YARD-JOINED: the owner's own house beside it splits no ground with it
      // FB1009 HOME-FOOT: a neighbour's ground is what its faces cover too (its box, where none are known)
      const ground = f.rects?.length ? f.rects : [[f.box[0], f.box[2], f.box[3], f.box[5]]];
      const holds = yardLineHolder(f, bk, deps.homes?.homeAt?.(y.mapId, bk) ?? null);   // YARD-LINE: the midline is a lot's holder's alone
      for (const r of ground) {
        const g = [r[0] - y.frame.at[0], r[1] - y.frame.at[2], r[2] - y.frame.at[0], r[3] - y.frame.at[2]];
        others.push(g);
        if (holds && !mate) lines.push(g);
      }
    }
    const lot = yardJoinLots(y.lot, [...mates.values()]);   // YARD-JOINED
    return { yard: y, lot, others, lines, roads: yardRoadsOf(p, y.frame.at, lot), hall: !!home.hall };   // FB1001 ROAD-LOT: the road under the lot; GUILD-YARD: a hall's
  }
  /** YARD-JOINED: the owner's other homes whose lots meet yard `y`'s (overlap or touch) - building key -> `{ walls }` in
   *  y's frame. A home's alone: never a guild's hall, and never a turned or a lone lot. */
  function yardMates(y, home) {
    const out = new Map();
    if (!home || home.own !== true || home.hall || y.lot.turn || y.lot.alone) return out;
    const o = originOf(y);
    for (const y2 of yards.values()) {
      if (y2 === y || y2.mapId !== y.mapId || y2.lot.turn || y2.lot.alone) continue;
      const h2 = deps.homes?.homeAt?.(y2.mapId, y2.bk) ?? null;
      if (h2?.own !== true || h2.hall) continue;
      const o2 = originOf(y2), dx = o2[0] - o[0], dz = o2[2] - o[2];
      const shift = (r) => [r[0] + dx, r[1] + dz, r[2] + dx, r[3] + dz];
      const lot = shift(y2.lot.lot);
      if (!inRect((lot[0] + lot[2]) / 2, (lot[1] + lot[3]) / 2, [y.lot.lot[0] - (lot[2] - lot[0]) / 2, y.lot.lot[1] - (lot[3] - lot[1]) / 2, y.lot.lot[2] + (lot[2] - lot[0]) / 2, y.lot.lot[3] + (lot[3] - lot[1]) / 2], YARD_EDGE_PAD)) continue;
      out.set(y2.bk, { walls: (y2.lot.walls ?? [y2.lot.house]).map(shift) });
    }
    return out;
  }
  /** YARD-BORDER: the marked edge, traced again only when the yard asked or the world under it moved - AUDIT FB1029f B2:
   *  the yard is held while the decorator is up, so it is its own key (a signature over every line of a town's pixel
   *  cost milliseconds a frame). */
  let edgeMemo = { of: null, o: '', quads: [] };
  function lotQuadsHere() {
    if (!cur) return [];
    const o = originOf(cur.yard);
    const at = o.join(',');
    if (edgeMemo.of !== cur || edgeMemo.o !== at) edgeMemo = { of: cur, o: at, quads: yardLotQuads(cur.lot, o, YARD_MARK_HIGH, cur.roads, cur.lines) };
    return edgeMemo.quads;
  }

  // THE DECORATOR OUTSIDE: the room's own tool over the yard the owner stands on - its pool the yard's, its writes the
  // yard's (`yard` on the service), a piece refused off the lot, the lot's edge marked while a piece is placed
  const pool = {
    put: (p) => { cur?.yard.pool.put(p); keep(); },
    remove: (id) => { cur?.yard.pool.remove(id); keep(); },
    list: () => cur?.yard.pool.list() ?? [],
    pieceOf: (id) => cur?.yard.pool.pieceOf(id) ?? null,
    size: () => cur?.yard.pool.size() ?? 0,
    holdsAny: () => false, ownOf: () => null, keepOwn() {}, takeOwn: () => null, ownIds: () => [],
  };
  /** A write the owner made stands in the town's answer too, so the next read of it does not stand the old yard. */
  function keep() {
    const y = cur?.yard;
    if (!y) return;
    const list = y.pool.list();
    cells.hold(y.mapId, y.bk, list);   // FB1001 YARD-STALE: and over the answers that follow it
    y.sig = JSON.stringify(list);
  }
  /** YC2: a yard write's answer - the version it moved its cell to, so the owner's own word is dropped when it comes. */
  const wrote = (a, answer) => {
    if (answer?.ok && Number.isSafeInteger(answer.data?.yardVer)) cells.wrote(a?.mapId, a?.buildingKey, answer.data.yardVer);
    return answer;
  };
  const homeDecor = deps.api ? {
    place: async (a) => wrote(a, await deps.api.place({ ...a, yard: true })),
    move: async (a) => wrote(a, await deps.api.move(a)),
    remove: async (a) => wrote(a, await deps.api.remove(a)),
    hidden: async () => ({ ok: false, error: 'bad-decor' }),
    // HOME-YARD: the street's Confirm is the room's draft, over the yard's pieces and the same revision
    ...(typeof deps.api.list === 'function' && typeof deps.api.batch === 'function' ? {
      list: (mapId, buildingKey) => deps.api.list(mapId, buildingKey, false, true),
      batch: async (a) => wrote(a, await deps.api.batch({ ...a, yard: true })),
    } : {}),
  } : null;
  const collider = {
    raycastHit: (o, d, m, f = null) => deps.collider?.()?.surfaceHit?.(o, d, m, f) ?? deps.collider?.()?.raycastHit?.(o, d, m, f) ?? null,
  };
  const names = new Map();
  /** AUDIT GUILD-YARD: a hall's yard says the hall's words, never "your house". */
  const hallWords = (why) => (cur?.hall && why === YARD_IN_HOUSE ? YARD_IN_HALL : why);
  const tool = createDecorTool({
    doc: deps.doc ?? null, win: deps.win ?? null, canvas: deps.canvas ?? null, touch: !!deps.touch, renderer: deps.renderer, pool, names,
    // GUILD-YARD: a hall's yard is `hall` - a piece's half goes to the guild's treasury, never the purse (decorTool.js)
    // DECOR-OUTDOOR: `natureBase` - its climate's nature set, the one its catalogue offers trees and plants of
    room: () => (cur ? { kind: 'home', yard: true, ...(cur.hall ? { hall: true } : {}), where: homeYardWhere(cur), mapId: cur.yard.mapId, buildingKey: cur.yard.bk, natureBase: entryOf(cur.yard)?.forest?.base ?? null } : null),
    // DECOR-OUTDOOR: and the picture a nature piece is - in the ghost and the lists - in the yard's season
    flatAs: (flat) => (cur && isNatureArchive(flat?.[0]) ? yardNatureFlat(flat, entryOf(cur.yard)?.season ?? 0) : flat),
    // DECOR-LPT: the ghost of a tree or a plant is the picture it will stand as - the one door its piece asks
    flatPicture: (flat) => (cur && isNatureArchive(flat?.[0]) ? nature.picture(flat, entryOf(cur.yard)?.season ?? 0, entryOf(cur.yard)?.forest?.archive ?? null) : null),
    // AUDIT 05b A5: and a model it draws (the ghost, the preview) in the yard's town's climate first, as its pieces stand
    prepareModel: (gpu) => (cur ? climateOf(cur.yard, gpu) : null),
    scanDeps: () => deps.scanDeps(),
    base: () => null,
    getGpuMesh: (id) => deps.meshes.getGpuMesh(id), cpuModels: deps.meshes.cpuModels, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, iconUrl: deps.iconUrl,
    ...(deps.meshes.hold ? { thumbHold: () => deps.meshes.hold('decor-thumbs', 'yard') } : {}),   // AUDIT MENU-ORDER R4: the tiles' models, the panel's while it stands
    collider: () => collider, origin: () => (cur ? originOf(cur.yard) : [0, 0, 0]), eye: () => deps.eye?.() ?? [0, 0, 0],
    stick: () => deps.stick?.() ?? null, actionOf: (e) => deps.actionOf?.(e) ?? null,
    locked: () => !!deps.locked?.(), cursorOff: () => deps.cursorOff?.(),
    wallet: () => deps.wallet(cur ? deps.regionOf?.(cur.yard) ?? 0 : 0), homeDecor, character: () => deps.character?.() ?? null,
    realm: () => deps.realm?.() ?? null,
    pack: () => [], identity: () => null, furnishings: () => [], packHas: () => false, packTake: () => null, packGive() {},
    visit: () => (cur ? `${cur.yard.mapId}:${cur.yard.bk}` : null),
    openSlot: (o) => deps.openSlot?.(o), closeSlot: () => {},
    say: (l) => deps.say?.(l), refusal: (w) => deps.refusal?.(w) ?? null, now,
    // HOME-YARD: the lot - a piece off it refused, its edge marked
    placeOk: (piece, foot) => (cur ? hallWords(yardWhyNot(piece.pos, cur.lot, cur.others, foot, cur.roads, cur.lines)) : YARD_OFF_LOT),   // FB1001 ROAD-LOT: off the road; YARD-JOINED: on the owner's lots
    lot: lotQuadsHere,   // FB1001 ROAD-LOT: the edge along the road's side; YARD-BORDER: and along the midline
    yardCap: DECOR_YARD_CAP,
    // HOME-LOOK: the house's outside, painted from the yard's panel
    look: () => (cur && deps.look ? lookDoor(cur.yard) : null),
  });

  /** HOME-LOOK (AUDIT): how many styles a roof's or a door's family holds in a climate (in the season's archive) - asked
   *  once each, null until it answers (or when it cannot: the painter offers its styles all the same). */
  const lookCounts = new Map();
  function lookRecordsOf(part, climate) {
    const season = deps.look?.season?.() ?? 0;
    const k = `${part}:${climate}:${season}`;
    if (!lookCounts.has(k)) {
      lookCounts.set(k, null);
      homeLookRecords(part, climate, season, deps.getTexture).then((n) => lookCounts.set(k, n > 0 ? n : null), () => lookCounts.delete(k));
    }
    return lookCounts.get(k) ?? null;
  }
  /** HOME-LOOK: THE PAINTER'S DOOR for the owner's house - its look as the town knows it, a look tried on it (the owner's
   *  own screen), and a look written. */
  function lookDoor(y) {
    const home = deps.homes?.homeAt?.(y.mapId, y.bk) ?? null;
    return {
      current: home?.look ?? null,
      season: deps.look.season?.() ?? 0,
      records: (part, climate) => lookRecordsOf(part, climate),
      preview: (look) => deps.look.preview(y.mapId, y.bk, look),
      commit: async (look) => {
        const r = await deps.homes.setLook(y.mapId, y.bk, look);
        deps.look.preview(y.mapId, y.bk, undefined);
        return r;
      },
    };
  }

  /**
   * THE HOST'S FRAME outdoors: the yards brought in line every YARD_SYNC_S, the owner's yard found under their feet, and
   * the decorator's own frame over it.
   * @param {{ dt: number, cam: any, overlayUp: boolean }} f
   */
  function frame({ dt, cam, overlayUp }) {
    overlayUpNow = !!overlayUp;
    syncIn -= dt > 0 ? dt : 0;
    // AUDIT: the world recentred - every yard stood again this frame, never half a second in the old place; DECOR-OUTDOOR:
    // nor half a second out of its rebuilt pixel's climate and season (AUDIT PRECIP HOST-7: nor its re-skinned one's)
    if (syncIn > 0) for (const y of yards.values()) { const t = deps.translation(y.px, y.py), e = entryOf(y); if (t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2] || e !== y.entry || (e?._skinGen ?? 0) !== y.skin) { syncIn = 0; break; } }
    if (syncIn <= 0) syncIn = sync() ? 0 : YARD_SYNC_S;   // YARD-TOWN: a town not yet stood syncs again next frame
    if (!tool.flying() && !tool.panelOpen()) cur = ownYardHere();   // the yard is held while the decorator is up
    else if (cur && yards.get(cur.yard.key) !== cur.yard) {
      // AUDIT: its pixel was built again under the open decorator (a painted home leaving the merge, a season) - the
      // decorator follows the yard stood again in its place, never writing into the one taken down
      const again = yards.get(cur.yard.key) ?? null;
      if (again) cur = { ...cur, yard: again }; else { tool.close(); cur = null; }
    }
    tool.frame({ dt, cam, overlayUp, interior: !!cur });
    // AUDIT IC-BACKYARD P2: a lot away from its door - an Imperial City house's court, out of sight from the street - said
    // where it is as the decorator opens
    const open = tool.panelOpen();
    if (open && !panelWas && cur?.yard.lot?.access) deps.say?.(t('decor.yard.behind', 'Your yard is the court behind your house. Fly up over the roof to reach it.'));
    panelWas = open;
  }

  /**
   * FB1001 YARD-RECENTRE: EVERY YARD STOOD AGAIN WHERE ITS PIXEL STANDS NOW - the host's recentre calls it, beside the
   * other things holding a world position (scenes/world.js). The host's frame runs `frame` above the motor and the
   * recentre below it, and the draw after both: the crossing's frame drew every yard (and kept it solid) a whole pixel
   * off, and the next frame's sync put each piece again - drawn only once its model's answer ran, a frame after. Moved
   * in place now (decorRoom.js restand), before that frame's draw; the town's answer is sync's to read.
   */
  function rebase() {
    for (const y of yards.values()) {
      const t = deps.translation(y.px, y.py);
      if (t[0] === y.t[0] && t[1] === y.t[1] && t[2] === y.t[2]) continue;
      y.t = [...t];
      y.pool.restand();   // in place, at once - put again, a model stands only after this frame is drawn
    }
    blocks.rebase();   // YARD-BLOCK: the blocks' merges with them
  }

  const _treeSets = [];
  /** DECOR-LPT: THE YARDS' NEAR SETS this frame - each yard standing a tree, its set (yardNature.js yardTreeSet) where the
   *  yard stands now (a recentre moves it with its pieces); made again only when its trees changed, so the world's near
   *  set is gathered again only then. */
  function treeSets() {
    _treeSets.length = 0;
    for (const y of yards.values()) {
      if (!y.trees.size) continue;
      y.treeSet ??= { ox: 0, oy: 0, oz: 0, ...yardTreeSet([...y.trees.values()]) };
      const o = originOf(y);
      y.treeSet.ox = o[0]; y.treeSet.oy = o[1]; y.treeSet.oz = o[2];
      _treeSets.push(y.treeSet);
    }
    return _treeSets;
  }

  const _lamps = [];
  /** YARD-LIGHT: THE YARDS' LAMPS where they stand now (scene space), for the world's lanterns in their hours
   *  (scenes/world.js, yardLampRows). AUDIT YARD-LIGHT: each yard's first YARD_LAMPS_MAX lamps in the order its pieces
   *  stand (L1), and every yard standing - no distance cuts a lamp (L2: a cut at YARD_DRAW_M of the yard's origin put its
   *  lamps out at once, unfaded, beside the street's lit ones; the night's one selection ranks them with the street's,
   *  and its cap fades them as it fades theirs). The list is refilled and answered; each lamp is the light its yard
   *  keeps (decorRoom.js mountLight's - x, y, z, its reach and its slot). */
  function lamps() {
    _lamps.length = 0;
    for (const y of yards.values()) y.pool.pushLights(_lamps, YARD_LAMPS_MAX);
    return _lamps;
  }

  return {
    frame,
    rebase,
    /** The yards' models and the piece being placed, in the world's mesh pass. */
    /** AUDIT: with their pixel's climate swaps, as the town's own copies of the same models are drawn - and only the
     *  yards within YARD_DRAW_M of the eye (a town of full yards is thousands of pieces). */
    draw(r = deps.renderer) {
      let n = 0;
      const eye = deps.eye?.() ?? null;
      const cull = deps.cull ?? null;   // PERF-YARD: the host's view test, a piece's box at a time (decorRoom.js draw)
      mergesLeft = YARD_MERGES_A_FRAME;   // YARD-MERGE: the frame's budget
      // YARD-BLOCK: the blocks merged over the yards in range now, then drawn - a stranger's yard's own pool draws only
      // what its block's merge does not hold
      blocks.step((y) => nearEye(y, eye), (block) => blockDistance(block, eye));
      _eye = eye;
      n += blocks.draw(r, _eye || cull ? seenCull : null, remapAt);
      for (const y of yards.values()) {
        if (!nearEye(y, eye)) continue;   // YARD-RANGE: the player's distance for a stranger's, YARD_DRAW_M for one's own
        _eye = y === cur?.yard ? null : eye;   // YARD-RANGE: never the yard being placed in
        n += y.pool.draw(r, remapOf(y), _eye || cull ? seenCull : null);
      }
      _eye = null;
      tool.draw(r, cur ? remapOf(cur.yard) : null);
      return n;
    },
    /** The yards' flats and the flat being placed, for the world's billboard pass. */
    /** YARD-RANGE: as the models are - within the yard's reach (they had none: every standing yard's every flat, the
     *  whole streamed grid's), each big enough to see; refilled in place every frame. */
    batches() {
      _batches.length = 0;
      const eye = deps.eye?.() ?? null;
      blocks.batches(_batches, eye, YARD_MIN_ANGLE);   // YARD-BLOCK: the blocks' merged flats
      for (const y of yards.values()) if (nearEye(y, eye)) y.pool.batchesSeen(_batches, y === cur?.yard ? null : eye, YARD_MIN_ANGLE);
      for (const b of tool.batches()) _batches.push(b);
      return _batches;
    },
    /** MWNPC18: the yards' figures (one of Daggerfall's people set down outside), for the street's people lane - into one
     *  list kept (AUDIT MWNPC16-18 D4: a frame's new arrays, two a yard). YARD-RANGE: only a yard within its reach, as
     *  its flats are (batches) - a body never stands where its picture would not be drawn. */
    figures: () => {
      yardFigs.length = 0;
      const eye = deps.eye?.() ?? null;
      for (const y of yards.values()) if (nearEye(y, eye)) for (const e of y.pool.figures()) yardFigs.push(e);
      return yardFigs;
    },
    /** DECOR-LPT: the yards' 3D trees, for the world's near set (scenes/world.js lowPolyTreesFrame). */
    treeSets,
    /** YARD-LIGHT: the yards' lamps, for the world's lanterns. */
    lamps,
    /** The lot's edge while a piece is placed, on the world's decal pass - YARD-WALLS: and the pictures hung on the walls
     *  of the yards within reach, as a room's mounts are (decorRoom.js drawMounts). */
    drawDecals(r = deps.renderer) {
      const eye = deps.eye?.() ?? null;
      for (const y of yards.values()) if (nearEye(y, eye)) y.pool.drawMounts(r);
      return tool.drawMounts(r);
    },
    drawPreview: () => tool.drawPreview(cur ? remapOf(cur.yard) : null),   // AUDIT 05b A5: in the yard's climate, as it will stand
    cameraOverride: (c) => tool.cameraOverride(c),
    flying: () => tool.flying(),
    panelOpen: () => tool.panelOpen(),
    /** The yard being decorated, while a piece is not in hand: the hover ray's boxes, keyed `decor:<id>`. */
    targets() {
      if (!tool.flying() || tool.ghost()) return [];
      return cur?.yard.pool.targets() ?? [];
    },
    /** The plaque's rows on a yard piece: Move, Duplicate, Remove. */
    hoverName(key) {
      if (!tool.flying() || tool.ghost() || typeof key !== 'string' || !key.startsWith('decor:')) return null;
      const piece = cur?.yard.pool.pieceOf(key.slice('decor:'.length)) ?? null;
      if (!piece) return null;
      const named = piece.model != null || piece.flat ? names.get(decorKey(piece)) : null;
      return decorPlaque(null, { piece, mayEdit: true, name: piece.name || named || null });
    },
    /** The lit row on the piece under the crosshair. True when a yard piece took the ray, so the door behind it does not. */
    press(eye, dir) {
      if (!tool.flying() || tool.ghost()) return false;
      const hit = pickActivatableHit(eye, dir, cur?.yard.pool.targets() ?? [], deps.collider?.() ?? null);
      if (typeof hit?.key !== 'string' || !hit.key.startsWith('decor:')) return false;
      const verb = plaqueActionFor(hit.key);
      if (verb) tool.act(verb, hit.key.slice('decor:'.length));
      return true;
    },
    /** The yards standing (the pins' window). */
    yards: () => [...yards.values()],
    here: () => cur,
    tool: () => tool,
    destroy() { for (const y of yards.values()) y.pool.destroyAll(); yards.clear(); blocks.destroy(); tool.destroy(); offYardWords(); },
  };
}
