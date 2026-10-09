// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-YARD (2026-09-30) — PIECES OUTSIDE A HOME, ON ITS OWN LOT.
//
// Asked: "allowing for prop placement on the outside within the limits of
// their house". An online home's owner decorates its YARD as they decorate
// its rooms: the same decorator (scenes/decorTool.js - the catalogue, the
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
// THE TOWN'S YARDS are read with the town (one answer for every home in it -
// server-account/src/decor.js yardsOf), believed a minute as the homes are
// (systems/onlineHomes.js), and each yard stood in its pixel as a room's
// pieces stand in its room (scenes/decorRoom.js, one pool a yard): its own
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
// standing in a town block (RMBLayout.AddLight, world/cityLights.js): the
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

import { createDecorRoom } from './decorRoom.js';
import { createDecorTool } from './decorTool.js';
import { decorYardPieceOf, DECOR_YARD_CAP, decorYardHighOk, DECOR_YARD_HIGH_WHY } from '../net/decorLaw.js';   // YARD-HEIGHT: how high a piece stands, and its words
import { homeLookRecords } from '../world/homeLook.js';   // HOME-LOOK (AUDIT): the styles a roof's or a door's family holds
import { onPathTile } from '../player/exteriorSurface.js';   // FB1001 ROAD-LOT: PlayerMotor.OnPathTile - Daggerfall's own road tiles
import { RMB_TILE_SIDE } from '../world/locationEntrance.js';   // FB1001 ROAD-LOT: RMBLayout.RMBTileSide, a ground tile's side
import { TERRAIN_TILE_DIM } from '../world/terrainSurface.js';
import { homeOutsideKept, homeYardWhere } from '../systems/onlineHomes.js';   // GUILD-YARD: a hall's keepers keep its outside
import { createYardNature, isNaturePiece, yardNatureFlat, yardTreeSet } from './yardNature.js';   // DECOR-OUTDOOR: a yard's trees and plants, in its town's season; DECOR-LPT: as Low Poly Trees' own
import { remapSubMeshes } from '../world/texRemap.js';   // DECOR-OUTDOOR: a yard's models in its town's climate
import { applyClimate } from '../world/climateSwaps.js';
import { isNatureArchive, BLOCK_FLATS_OFFSET_Y } from '../world/rmbFlats.js';   // AUDIT YARD-LIGHT: and how far the town's flats stand below their lights
import { LIGHTS_ARCHIVE, CITY_LIGHT_RANGE, CITY_LIGHT_INTENSITY, CITY_LIGHT_COLOR } from '../world/cityLights.js';   // YARD-LIGHT: the town's lantern
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { transformedAabb } from '../render/frustum.js';   // FB1009 HOME-FOOT: a model's ground where its placement stands it

/** YARD-LIGHT: the light a yard's lamp gives - the town's lantern's (DaggerfallLight [City]: range 18, intensity 1,
 *  white). The world host lights it as it lights theirs: the town lanterns' colour (CITY_LIGHT_COLOR_F32) and their
 *  flicker, at the lamp's own reach (yardLampRows). */
export const YARD_LAMP = Object.freeze({ range: CITY_LIGHT_RANGE, intensity: CITY_LIGHT_INTENSITY, color: CITY_LIGHT_COLOR });
/** AUDIT YARD-LIGHT (L1): HOW MANY OF A YARD'S LAMPS LIGHT - the most TEXTURE.210 flats any Daggerfall town block stands
 *  (eight, in GRVEAL01, GRVEAS01, GRVEAM01, CUSTAA02 and CUSTAA04 of the 920 RMB blocks; most stand three to five).
 *  A yard holds sixty pieces: sixty lamps round one lot summed nine times the brightest ground in any Daggerfall block,
 *  put the street's lanterns out of the classic set's sixteen, and looped a lane fragment over all forty-eight lights.
 *  The first eight a yard stands light (decorRoom.js pushLights - the order they were placed); the rest stand unlit,
 *  as every yard lamp stood before YARD-LIGHT. */
export const YARD_LAMPS_MAX = 8;
/** AUDIT YARD-LIGHT (L5): how far above its picture's top the town hangs a lantern's light - RMBLayout sinks a block's
 *  flats by blockFlatsOffsetY and never their lights (0.15 m), so a yard's lamp hangs as far above its own. */
export const YARD_LAMP_RAISE = -BLOCK_FLATS_OFFSET_Y * GLOBAL_SCALE;
/**
 * YARD-LIGHT: THE LIGHT A YARD'S PIECE GIVES (decorRoom.js `lampOf`) - a TEXTURE.210 flat's is the town's lantern, hung
 * where the town hangs its own over a picture of its size (collectCityLights: the record's height plus the picture's -
 * the drawn top and YARD_LAMP_RAISE above it); anything else gives none, and neither does a flat whose picture has not
 * stood yet (`size` null). AUDIT YARD-LIGHT (L6): a piece scaled is the lamp scaled - its picture, its light's height
 * above its foot and its reach alike, so it lights its ground as the town's lamp lights its own (the reach kept, a 4 m
 * lamp post scaled four times stood its light sixteen metres up and lit next to nothing under it). The light carries
 * its flicker slot (yardLampSlot - once, here, never a frame).
 */
export function yardLampOf(piece, size) {
  if (piece?.flat?.[0] !== LIGHTS_ARCHIVE || !(size?.h > 0)) return null;
  const k = piece.scale > 0 ? piece.scale : 1;
  return { light: { ...YARD_LAMP, range: YARD_LAMP.range * k, slot: yardLampSlot(piece.id) }, lift: size.h + YARD_LAMP_RAISE * k };
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
 * town lanterns' `color`. Answers `out`.
 */
export function yardLampRows(lamps, rows, animRanges, color, out) {
  for (let i = 0; i < lamps.length; i++) {
    const l = lamps[i];
    const e = rows[i] ?? (rows[i] = { x: 0, y: 0, z: 0, range: 0, color: null });
    e.x = l.x; e.y = l.y; e.z = l.z;
    e.range = animRanges[l.slot % animRanges.length] * (l.range / CITY_LIGHT_RANGE);
    e.color = color;
    out.push(e);
  }
  return out;
}

/** AUDIT: how far from the eye a yard's pieces are drawn, metres (its flats stand in the billboard pass's own cull). */
export const YARD_DRAW_M = 300;
/** How far past the house's footprint its lot runs, metres. */
export const YARD_MARGIN = 6;
/** How far outside its lot the owner may still stand and open the yard's decorator. */
export const YARD_NEAR = 2;
/** AUDIT GUILD-YARD C1: what standing only near a lot (not on it) weighs against a lot the feet are on - past any distance. */
const YARD_NEAR_ONLY = 1e6;
/** How high the lot's marked edge stands. */
export const YARD_MARK_HIGH = 1;
/** A town's yards, believed this long; an unanswered ask waits this long before the next. */
export const YARD_TOWN_TTL_MS = 60_000;
export const YARD_RETRY_MS = 10_000;
/**
 * YARD-SHED (2026-10-06, the account service down - "D1 DB is overloaded. Requests queued for too long."): A TOWN'S
 * YARDS ARE ASKED ONLY WITHIN REACH, AND A FAILED ASK BACKS OFF. Every built pixel's town was asked every minute - the
 * whole streaming grid's, where a yard is drawn only within YARD_DRAW_M of the eye - and a failed ask again every
 * YARD_RETRY_MS, so a database too slow to answer was asked six times as often: 3.0 million asks a day, 577 of the 930
 * requests the service saw in 45 s of the outage. Now a town is asked while one of its homes stands within YARD_ASK_M of
 * the player's feet (its yards drawn before they are in sight), and each failure in a row doubles the wait, to
 * YARD_RETRY_MAX_MS.
 */
export const YARD_ASK_M = YARD_DRAW_M + 200;
export const YARD_RETRY_MAX_MS = 300_000;
/** The wait before a town's next ask after `n` failures in a row (ms). */
export const yardRetryMs = (n) => Math.min(YARD_RETRY_MAX_MS, YARD_RETRY_MS * 2 ** Math.max(0, n - 1));
/** How often the yards are brought in line with the town, seconds. */
export const YARD_SYNC_S = 0.5;
/** What the decorator says of a piece off the lot, in the house, or on another building's ground. */
export const YARD_OFF_LOT = 'Outside your lot - keep it within the marked edge.';
export const YARD_IN_HOUSE = 'That is inside your house - place it in the yard around it.';
export const YARD_ON_OTHER = "That is another building's ground.";
export const YARD_FULL = `Your yard already holds ${DECOR_YARD_CAP} pieces.`;   // the bar's words (ui/decorPanel.js decorWhyNot, `yard`)
/** AUDIT GUILD-YARD: the same two in a guild hall's yard - the hall's, never "your house" (decorWhyNot's `hall`). */
export const YARD_IN_HALL = "That is inside the hall - place it in the hall's yard around it.";
export const YARD_HALL_FULL = `The hall's yard already holds ${DECOR_YARD_CAP} pieces.`;
/** FB1001 ROAD-LOT: what the decorator says of a piece on the town's road or a path. */
export const YARD_ON_ROAD = 'That is the road - keep the street and its paths clear.';
/** YARD-HEIGHT: what the decorator says of a piece standing higher than a yard's may (net/decorLaw.js DECOR_YARD_HIGH) -
 *  AUDIT Y3: the service's own refusal's sentence. */
export const YARD_TOO_HIGH = DECOR_YARD_HIGH_WHY;
/** How far into a wall's (or a road's) ground a piece may reach and still stand clear of it - touching is not in it. */
export const YARD_EDGE_PAD = 0.05;
/** FB1009 HOME-FOOT: the side of the cells a model's ground is measured in, metres (half Daggerfall's 0.8 m wall step). */
export const YARD_FOOT_CELL = 0.4;

/**
 * FB1009 HOME-FOOT (the Discord, "Property Problem": "I can't place in front of my door but I can place in front of
 * another's home"): THE GROUND A MODEL STANDS ON, seen from above - every face of it that covers ground (a roof, an
 * eave, a stair's tread, a wall's top), in `cell`-metre cells, answered as rects [x0, z0, x1, z1] in the model's own
 * frame (each row's runs, a run the row above shares one rect). A wall covers no ground: its face seen from above is a
 * line. The box round the model was its ground, and Hammerfell's houses are L-shaped or stand an outside stair before
 * their door - the door opens onto open ground inside the box (ARCH3D 600, 709 and their kin: 44% of the desert's
 * houses), so the step before the owner's own door was "inside your house" while a neighbour whose door is in its box's
 * side stood free. A face is sampled strictly inside itself, so a roof's edge on a cell's side never marks the next.
 */
export function modelFootRects(positions, indices, cell = YARD_FOOT_CELL) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    x0 = Math.min(x0, positions[i]); x1 = Math.max(x1, positions[i]);
    z0 = Math.min(z0, positions[i + 2]); z1 = Math.max(z1, positions[i + 2]);
  }
  if (!(x1 > x0) || !(z1 > z0)) return [];
  const W = Math.ceil((x1 - x0) / cell), H = Math.ceil((z1 - z0) / cell);
  const hit = new Uint8Array(W * H);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], az = positions[a + 2], bx = positions[b], bz = positions[b + 2], cx = positions[c], cz = positions[c + 2];
    if (Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) < 2e-3) continue;   // a wall: no ground under it
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(bx - ax, bz - az), Math.hypot(cx - ax, cz - az), Math.hypot(cx - bx, cz - bz)) / (cell / 2)));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const u = (i + 1 / 3) / n, v = (j + 1 / 3) / n, w = 1 - u - v;   // inside the face, never on its edge
        const x = ax * w + bx * u + cx * v, z = az * w + bz * u + cz * v;
        hit[Math.min(H - 1, Math.floor((z - z0) / cell)) * W + Math.min(W - 1, Math.floor((x - x0) / cell))] = 1;
      }
    }
  }
  const out = [];
  let open = new Map();
  for (let r = 0; r < H; r++) {
    const next = new Map();
    for (let q = 0; q < W;) {
      if (!hit[r * W + q]) { q++; continue; }
      let e = q;
      while (e < W && hit[r * W + e]) e++;
      const k = q * 65536 + e;
      const rect = open.get(k) ?? [x0 + q * cell, z0 + r * cell, Math.min(x1, x0 + e * cell), 0];
      if (!open.has(k)) out.push(rect);
      rect[3] = Math.min(z1, z0 + (r + 1) * cell);   // the run carried up a row
      next.set(k, rect);
      q = e;
    }
    open = next;
  }
  return out;
}
/** FB1009 HOME-FOOT: a model's ground (modelFootRects) where its placement `m` (column-major) stands it - each rect's box
 *  in m's frame, exact for a quarter turn (every Daggerfall building's), the box round it for any other. */
export function footRectsAt(rects, m) {
  return (rects ?? []).map(([rx0, rz0, rx1, rz1]) => {
    const b = transformedAabb([rx0, 0, rz0, rx1, 0, rz1], m);
    return [b[0], b[2], b[3], b[5]];
  });
}

/**
 * A LOT from a building's frame: `origin` its own place and `box` the box round its models ([minX, minY, minZ, maxX,
 * maxY, maxZ]), both in one frame - answered relative to the origin: `house` that box's footprint [x0, z0, x1, z1] and
 * `lot` the box grown by `margin` [x0, z0, x1, z1], and `y` the ground's height (the box's foot). FB1009 HOME-FOOT:
 * `walls` the ground the house stands on - `rects` (its models' faces seen from above, world.js, in the box's frame)
 * relative to the origin, or its box where none are known.
 */
export function yardLot(origin, box, margin = YARD_MARGIN, rects = null) {
  if (!Array.isArray(origin) || !Array.isArray(box) || box.length < 6) return null;
  const house = [box[0] - origin[0], box[2] - origin[2], box[3] - origin[0], box[5] - origin[2]];
  if (!(house[2] > house[0]) || !(house[3] > house[1])) return null;
  const walls = Array.isArray(rects) && rects.length ? rects.map((r) => [r[0] - origin[0], r[1] - origin[2], r[2] - origin[0], r[3] - origin[2]]) : [house];
  return { house, walls, lot: [house[0] - margin, house[1] - margin, house[2] + margin, house[3] + margin], y: box[1] - origin[1] };
}
const inRect = (x, z, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
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
/**
 * WHY A PIECE CANNOT STAND at `pos` (from the frame's origin), or null: off the lot, inside the house's footprint (a
 * piece on its roof too - FB1009 HOME-FOOT: the lot's `walls`, the ground its faces cover), or on another building's
 * (`others`, their ground's rects in the same frame [x0, z0, x1, z1]); a piece's middle on one of a building's rects is on
 * it, so the seam the pad leaves between two of them lets nothing through.
 * AUDIT: `foot` - the ground it covers, offsets [dx, dz] from `pos` (decorTool.js footprintOf) - is asked too: all of
 * it on the lot, none of it in the house or on another building's ground (its middle alone let a long piece straddle a
 * wall). FB1001 YARD-CORNER: "none of it" is the ground it covers, not its corners (yardFootMeets). FB1001 ROAD-LOT:
 * nor on the town's road or a path (`roads`, the road's tiles in the same frame - yardRoadsOf). YARD-HEIGHT: nor
 * higher over the ground than DECOR_YARD_HIGH (the frame's origin stands on the town's ground - scenes/world.js).
 */
export function yardWhyNot(pos, lot, others = [], foot = [], roads = []) {
  if (!lot || !Array.isArray(pos)) return YARD_OFF_LOT;
  const [x, , z] = pos;
  const corners = (foot ?? []).map(([dx, dz]) => [x + dx, z + dz]);
  const points = [[x, z], ...corners];
  if (!points.every(([px, pz]) => inRect(px, pz, lot.lot))) return YARD_OFF_LOT;
  const ground = corners.length ? corners : [[x, z]];
  const meets = (r) => inRect(x, z, r) || yardFootMeets(ground, r, YARD_EDGE_PAD);   // FB1009 HOME-FOOT: its middle, or its ground
  if ((lot.walls ?? [lot.house]).some(meets)) return YARD_IN_HOUSE;
  if ((others ?? []).some(meets)) return YARD_ON_OTHER;
  if ((roads ?? []).some((r) => yardFootMeets(ground, r, YARD_EDGE_PAD))) return YARD_ON_ROAD;
  if (!decorYardHighOk({ pos })) return YARD_TOO_HIGH;   // YARD-HEIGHT: never a tower - the service's own law
  return null;
}
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
  const [lx0, lz0, lx1, lz1] = lot.lot;
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
 * one segment. With no road it is the lot's four sides, south first.
 */
export function yardLotEdges(lot, roads = []) {
  if (!lot) return [];
  const [X0, Z0, X1, Z1] = lot.lot;
  const holes = (roads ?? []).filter((r) => r[0] < X1 && r[2] > X0 && r[1] < Z1 && r[3] > Z0);
  const cuts = (lo, hi, i, j) => [...new Set([lo, hi, ...holes.flatMap((r) => [r[i], r[j]]).filter((v) => v > lo && v < hi)])].sort((a, b) => a - b);
  const xs = cuts(X0, X1, 0, 2), zs = cuts(Z0, Z1, 1, 3);
  const open = (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= zs.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    return !holes.some((r) => cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]);
  };
  const segs = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const w = open(i - 1, j), e = open(i, j);
      if (w !== e) segs.push(e ? [xs[i], zs[j + 1], xs[i], zs[j]] : [xs[i], zs[j], xs[i], zs[j + 1]]);
    }
  }
  for (let j = 0; j < zs.length; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const s = open(i, j - 1), n = open(i, j);
      if (s !== n) segs.push(n ? [xs[i], zs[j], xs[i + 1], zs[j]] : [xs[i + 1], zs[j], xs[i], zs[j]]);
    }
  }
  // end to end: from the lowest start (south, then west), each next the one that starts where the last ends; a run in
  // one direction is one segment
  const out = [];
  const left = new Set(segs);
  const dir = (s) => [Math.sign(s[2] - s[0]), Math.sign(s[3] - s[1])].join();
  while (left.size) {
    const first = [...left].reduce((a, b) => (b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
    let run = [...first];
    left.delete(first);
    for (;;) {
      const next = [...left].find((q) => q[0] === run[2] && q[1] === run[3] && dir(q) === dir(run))
        ?? [...left].find((q) => q[0] === run[2] && q[1] === run[3]);
      if (!next) break;
      left.delete(next);
      if (dir(next) === dir(run)) { run[2] = next[2]; run[3] = next[3]; continue; }
      out.push(run);
      run = [...next];
    }
    out.push(run);
  }
  return out;   // a loop starts at its lowest corner, so its last run and its first never lie on one line
}
/** Whether a world point stands on the lot (or within `near` of it) - `origin` the frame's, in the world. */
export const yardHolds = (lot, origin, p, near = 0) => !!lot && Array.isArray(p) && inRect(p[0] - origin[0], p[2] - origin[2], lot.lot, near);
/**
 * THE LOT'S MARKED EDGE: its four sides as upright bands (the decal pass's quads - combat/bloodDecals.js writeDecalQuad's
 * shape), standing on the ground, in the world (`origin` the frame's). FB1001 ROAD-LOT: with the road taken out of it
 * (`roads` - yardRoadsOf), the edge runs along the road's side: the band is where a piece may stand up to.
 */
export function yardLotQuads(lot, origin, high = YARD_MARK_HIGH, roads = []) {
  if (!lot) return [];
  const y = origin[1] + lot.y + high / 2;
  const side = ([ax, az, bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az);
    return { pos: [origin[0] + (ax + bx) / 2, y, origin[2] + (az + bz) / 2], size: high, stretch: len / high, right: [(bx - ax) / len, 0, (bz - az) / len], up: [0, 1, 0] };
  };
  return yardLotEdges(lot, roads).map(side);
}

/**
 * THE TOWN'S YARDS, AND THE OWNER'S DECORATOR OUTSIDE. `deps` (the world host's - scenes/world.js):
 *   api          - net/accountClient.js accountDecor: yards(mapId), place (with `yard`), move, remove
 *   homes        - systems/onlineHomes.js: homeAt(mapId, key) - whose a home is, and whether it is the character's own
 *   built()      - the world's built pixels (each `{ px, py, homeTown, homeFrames }` - homeFrames: key -> { at, box,
 *                  rects }, pixel-local; FB1009 HOME-FOOT: `rects` the ground its models' faces cover, footRectsAt's)
 *   translation(px, py) - a pixel's place in the scene now
 *   feet()       - where the player stands (scene); outside() - whether the player walks the street (no building,
 *                  no dungeon, no saddle)
 *   collider()   - the world's collider (addMesh, removeBucket, surfaceHit)
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
  /** @type {Map<number, {at: number, byKey: Map<number, any[]>}>} */
  const towns = new Map();
  const asking = new Map();
  /** @type {Map<number, {at: number, n: number}>} YARD-SHED: each town's last failure and the failures in a row */
  const failed = new Map();
  /** @type {Map<string, {pool: any, px: number, py: number, mapId: number, bk: number, t: number[], sig: string, lot: any, frame: any, entry: any, trees: Map<string, any>, treeSet: any}>} */
  const yards = new Map();
  let syncIn = 0;
  /** @type {any} the owner's own yard the decorator stands in, or null */
  let cur = null;
  // FB1001 YARD-STALE: the owner's own writes - each one's turn, and the yard it left, by town and building - so a town's
  // answer READ BEFORE a write and landing after it never stands the yard as it was (the piece placed gone, the piece
  // moved back, the piece removed standing again, for the minute until the next read)
  let wrote = 0;
  /** @type {Map<number, Map<number, {n: number, list: any[]}>>} */
  const writes = new Map();

  function ensure(mapId) {
    if (deps.heard?.() === false) return;   // WD3 (AUDIT WD3 R6): a yard is laid out on its town's layout - none asked before it is heard
    const had = towns.get(mapId);
    if (had && now() - had.at < YARD_TOWN_TTL_MS) return;
    const f = failed.get(mapId);
    if (asking.has(mapId) || (f && now() - f.at < yardRetryMs(f.n))) return;   // YARD-SHED: each failure in a row doubles the wait
    const asked = wrote;
    const p = Promise.resolve().then(() => deps.api?.yards?.(mapId)).then((r) => {
      const list = r?.ok ? r.data?.yards : null;
      if (!Array.isArray(list)) { failed.set(mapId, { at: now(), n: (failed.get(mapId)?.n ?? 0) + 1 }); return; }
      const byKey = new Map();
      for (const y of list) {
        if (!Number.isSafeInteger(y?.buildingKey) || !Array.isArray(y.pieces)) continue;
        byKey.set(y.buildingKey, y.pieces.map(decorYardPieceOf).filter(Boolean));
      }
      for (const [bk, w] of writes.get(mapId) ?? []) if (w.n > asked) byKey.set(bk, w.list);   // YARD-STALE: written since it was asked
      towns.set(mapId, { at: now(), byKey });
      failed.delete(mapId);
    }, () => { failed.set(mapId, { at: now(), n: (failed.get(mapId)?.n ?? 0) + 1 }); }).finally(() => { asking.delete(mapId); });
    asking.set(mapId, p);
  }

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
    return remapSubMeshes(gpu?.subMeshes, p.texRemap, (a, r) => applyClimate(a, r, p.townClimate, p.season), { getTexture: deps.getTexture, uploadRecord: deps.uploadRecord });
  }

  /** The world point a yard's frame stands at, now. */
  const originOf = (y) => {
    const t = deps.translation(y.px, y.py);
    const f = y.frame;
    return [t[0] + f.at[0], t[1] + f.at[1], t[2] + f.at[2]];
  };
  function makeYard(key, p, bk, frame) {
    const y = { key, px: p.px, py: p.py, mapId: p.homeTown, bk, frame, t: [...deps.translation(p.px, p.py)], sig: '', lot: yardLot(frame.at, frame.box, YARD_MARGIN, frame.rects), pool: null, entry: p, trees: new Map(), treeSet: null };
    y.pool = createDecorRoom({
      meshes: deps.meshes, renderer: deps.renderer, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, uploadRecordFrame: deps.uploadRecordFrame,
      collider: () => deps.collider?.() ?? null, origin: () => originOf(y),
      // YARD-LIGHT: a lamp lights as the town's (yardLampOf) - the room's machinery mounts it when its picture stands, moves
      // it with a recentre (restand) and takes it down with the piece; `lamps` reads them in the order the pieces stand
      lampOf: yardLampOf,
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
    return y;
  }

  /** THE YARDS BROUGHT IN LINE with the town: each home's pieces stood in its pixel (again where the town's answer
   *  changed, or the world recentred), a pixel gone taken down with its yards. */
  /** YARD-SHED: whether one of a town pixel's homes stands within YARD_ASK_M of the player's feet - a host that says no
   *  feet asks as before. */
  function withinReach(p, feet) {
    if (!feet) return true;
    const t = deps.translation(p.px, p.py);
    for (const [, frame] of p.homeFrames) {
      if (!frame?.at) return true;   // a frame without its place: asked, as before
      if (Math.hypot(t[0] + frame.at[0] - feet[0], t[2] + frame.at[2] - feet[2]) <= YARD_ASK_M) return true;
    }
    return false;
  }
  function sync() {
    const live = new Set();
    const feet = deps.feet?.() ?? null;
    for (const [pk, p] of deps.built?.() ?? []) {
      if (!p?.homeTown || !p.homeFrames) continue;
      if (withinReach(p, feet)) ensure(p.homeTown);
      const town = towns.get(p.homeTown);
      for (const [bk, frame] of p.homeFrames) {
        const home = deps.homes?.homeAt?.(p.homeTown, bk) ?? null;
        const pieces = town?.byKey.get(bk) ?? null;
        if (!home || (!pieces?.length && !homeOutsideKept(home))) continue;   // a yard stands for a home with pieces, or for its owner (GUILD-YARD: a hall's keeper)
        const key = `${pk}:${bk}`;
        live.add(key);
        const y = yards.get(key) ?? makeYard(key, p, bk, frame);
        const t = deps.translation(p.px, p.py);
        const moved = t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2];
        const sig = pieces ? JSON.stringify(pieces) : '';
        // DECOR-OUTDOOR: its pixel BUILT AGAIN (a season's turn, an install, a painted home leaving the merge) - every piece
        // stood again in the new pixel's climate table, animator and season, as the town's own flats are
        const rebuilt = y.entry !== p;
        // AUDIT 05b A4: the owner writing this yard holds it - the pieces standing are the truth until the decorator
        // is put away, and the town's answer waits (its `sig` unread); moved or built again meanwhile, it stands again as it
        // stands. The rebuild stood the town's answer under the open decorator - a hall's other keeper's write the panel
        // was holding back, a piece being moved gone from under it.
        const holding = cur?.yard === y && busyWriting();
        if (moved || rebuilt || (sig !== y.sig && !holding)) {
          y.t = [...t];
          y.entry = p;
          if (!holding) y.sig = sig;
          y.pool.set(holding ? y.pool.list() : pieces ?? y.pool.list());
        }
      }
    }
    for (const [key, y] of yards) if (!live.has(key)) { y.pool.destroyAll(); yards.delete(key); }
  }
  const busyWriting = () => !!tool.flying() || !!tool.panelOpen();
  /** A yard's pixel's climate swaps (its texRemap), or none. */
  const remapOf = (y) => deps.built?.()?.get?.(`${y.px},${y.py}`)?.texRemap ?? null;

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
    const others = [];
    const p = deps.built?.()?.get?.(`${y.px},${y.py}`);
    for (const [bk, f] of p?.homeFrames ?? []) {
      if (bk === y.bk) continue;
      // FB1009 HOME-FOOT: a neighbour's ground is what its faces cover too (its box, where none are known)
      const ground = f.rects?.length ? f.rects : [[f.box[0], f.box[2], f.box[3], f.box[5]]];
      for (const r of ground) others.push([r[0] - y.frame.at[0], r[1] - y.frame.at[2], r[2] - y.frame.at[0], r[3] - y.frame.at[2]]);
    }
    return { yard: y, others, roads: yardRoadsOf(p, y.frame.at, y.lot), hall: !!home.hall };   // FB1001 ROAD-LOT: the road under the lot; GUILD-YARD: a hall's
  }

  // THE DECORATOR OUTSIDE: the room's own tool over the yard the owner stands on - its pool the yard's, its writes the
  // yard's (`yard` on the service), a piece refused off the lot, the lot's edge marked while a piece is placed
  const pool = {
    put: (p) => { cur?.yard.pool.put(p); keep(); },
    remove: (id) => { cur?.yard.pool.remove(id); keep(); },
    list: () => cur?.yard.pool.list() ?? [],
    size: () => cur?.yard.pool.size() ?? 0,
    holdsAny: () => false, ownOf: () => null, keepOwn() {}, takeOwn: () => null, ownIds: () => [],
  };
  /** A write the owner made stands in the town's answer too, so the next read of it does not stand the old yard. */
  function keep() {
    const y = cur?.yard;
    if (!y) return;
    const town = towns.get(y.mapId);
    const list = y.pool.list();
    if (town) town.byKey.set(y.bk, list);
    y.sig = JSON.stringify(list);
    if (!writes.has(y.mapId)) writes.set(y.mapId, new Map());
    writes.get(y.mapId).set(y.bk, { n: ++wrote, list });   // FB1001 YARD-STALE
  }
  const homeDecor = deps.api ? {
    place: (a) => deps.api.place({ ...a, yard: true }),
    move: (a) => deps.api.move(a),
    remove: (a) => deps.api.remove(a),
    hidden: async () => ({ ok: false, error: 'bad-decor' }),
  } : null;
  const collider = {
    raycastHit: (o, d, m, f = null) => deps.collider?.()?.surfaceHit?.(o, d, m, f) ?? deps.collider?.()?.raycastHit?.(o, d, m, f) ?? null,
  };
  /** AUDIT GUILD-YARD: a hall's yard says the hall's words, never "your house". */
  const hallWords = (why) => (cur?.hall && why === YARD_IN_HOUSE ? YARD_IN_HALL : why);
  const tool = createDecorTool({
    doc: deps.doc ?? null, win: deps.win ?? null, canvas: deps.canvas ?? null, touch: !!deps.touch, renderer: deps.renderer, pool, names: new Map(),
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
    placeOk: (piece, foot) => (cur ? hallWords(yardWhyNot(piece.pos, cur.yard.lot, cur.others, foot, cur.roads)) : YARD_OFF_LOT),   // FB1001 ROAD-LOT: off the road
    lot: () => (cur ? yardLotQuads(cur.yard.lot, originOf(cur.yard), YARD_MARK_HIGH, cur.roads) : []),   // FB1001 ROAD-LOT: the edge along the road's side
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
    syncIn -= dt > 0 ? dt : 0;
    // AUDIT: the world recentred - every yard stood again this frame, never half a second in the old place; DECOR-OUTDOOR:
    // nor half a second out of its rebuilt pixel's climate and season
    if (syncIn > 0) for (const y of yards.values()) { const t = deps.translation(y.px, y.py); if (t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2] || entryOf(y) !== y.entry) { syncIn = 0; break; } }
    if (syncIn <= 0) { syncIn = YARD_SYNC_S; sync(); }
    if (!tool.flying() && !tool.panelOpen()) cur = ownYardHere();   // the yard is held while the decorator is up
    else if (cur && yards.get(cur.yard.key) !== cur.yard) {
      // AUDIT: its pixel was built again under the open decorator (a painted home leaving the merge, a season) - the
      // decorator follows the yard stood again in its place, never writing into the one taken down
      const again = yards.get(cur.yard.key) ?? null;
      if (again) cur = { ...cur, yard: again }; else { tool.close(); cur = null; }
    }
    tool.frame({ dt, cam, overlayUp, interior: !!cur });
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
      for (const y of yards.values()) {
        const o = originOf(y);
        if (eye && y !== cur?.yard && Math.hypot(o[0] - eye[0], o[2] - eye[2]) > YARD_DRAW_M) continue;
        n += y.pool.draw(r, remapOf(y));
      }
      tool.draw(r, cur ? remapOf(cur.yard) : null);
      return n;
    },
    /** The yards' flats and the flat being placed, for the world's billboard pass. */
    batches: () => [...[...yards.values()].flatMap((y) => y.pool.batches()), ...tool.batches()],
    /** DECOR-LPT: the yards' 3D trees, for the world's near set (scenes/world.js lowPolyTreesFrame). */
    treeSets,
    /** YARD-LIGHT: the yards' lamps, for the world's lanterns. */
    lamps,
    /** The lot's edge while a piece is placed, on the world's decal pass. */
    drawDecals: (r = deps.renderer) => tool.drawMounts(r),
    drawPreview: () => tool.drawPreview(cur ? remapOf(cur.yard) : null),   // AUDIT 05b A5: in the yard's climate, as it will stand
    cameraOverride: (c) => tool.cameraOverride(c),
    flying: () => tool.flying(),
    panelOpen: () => tool.panelOpen(),
    /** The yards standing (the pins' window). */
    yards: () => [...yards.values()],
    here: () => cur,
    tool: () => tool,
    destroy() { for (const y of yards.values()) y.pool.destroyAll(); yards.clear(); tool.destroy(); },
  };
}
