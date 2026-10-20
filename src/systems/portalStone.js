// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PORTAL1 (2026-10-04, the owner: "So with the removal of fast travel, I want to implement a new item available at all
// shops, this should cost weykar shards (from dismantling gear with rarity). These should always be readily available.
// When using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a one use item that
// stays open for a short time, allowing multiple players to traverse"): THE PORTAL STONE.
//
//   - THE STONE (systems/gate/gateSpoils.js, template 572 beside the Welkynd Shard's 571): bound, stacking with its own kind.
//   - THE COUNTER: every shop's keeper (shopStock.js isShop - the nine kinds) sells one for PORTAL_STONE_SHARDS Welkynd
//     Shards, from a row on the keeper's own popup (ui/merchant/merchantServiceWindow.js, ui/merchant/merchantRepairWindow.js, and the
//     Enhanced Plus panel) - never from a shelf: a shelf is the gold trade's, and nothing here is gold. ALWAYS IN STOCK:
//     nothing is kept, so every sale mints a fresh stone.
//   - THE USE: the pack's Use (or a hotbar press) hands the stone to the host's `openPortal` door - the open world's
//     alone (scenes/world.js; a building, a dungeon and the standalone street say why not). The travel map opens in
//     teleport mode; a place picked there spends ONE stone and tears a portal open in front of the player
//     (portalPlace), for PORTAL_OPEN_MS (scenes/portalGates.js). A map closed without a pick spends nothing.
//   - THE PORTAL: anyone who WALKS INTO it - the opener, and online every player near it - arrives at the place the way
//     the Mages Guild's teleport arrives (world.js teleportTo: free, at once). Only a step from outside to inside is an
//     entry (portalStepIn), and the step is forgotten across any gap (scenes/portalGates.js): a portal that opens on
//     top of someone, or stands outside the door they come out of, takes nobody.
//   - THE HOLDS (portalHold): one ladder the door, the pick and the step all ask - a move under way, a duel, a siege's
//     wards, an enemy near, a journey - so a portal is never a way out of what the travel map refuses to leave.
//   - ONLINE: the opener's foes frame carries it (`pg`, portalWire) on every full frame while it stands and its opener
//     stands near it - the camps' and the duel ring's road, so the relay reads none of it and needs no new version. A
//     peer believes it only near its opener's own feet, keeps its own copy to the time first said (never longer), one
//     an opener, and names its destination off its own map; a pixel with no location refuses the record.
//
// Not a DFU member - Ledger A.
// ═══════════════════════════════════════════════════════════════════
import { PORTAL_STONE, PORTAL_STONE_TEMPLATE, PORTAL_STONE_SHARDS, portalStones, isPortalStone, isWelkyndShard } from './gate/gateSpoils.js';
import { shardsHeld, spendShards, shardsText } from './reforge.js';
import { addItem } from './inventory.js';
import { registerItemUseHandler } from './item/itemTemplates.js';
import { POSE_BOUND, POSE_Y_BOUND } from '../net/wire.js';
import { MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';

export { PORTAL_STONE, PORTAL_STONE_TEMPLATE, PORTAL_STONE_SHARDS, isPortalStone };

/** How long a portal stands, from the tear to the seal (ms). */
export const PORTAL_OPEN_MS = 30000;
/** How far in front of its opener a portal opens (metres) - out of reach, so the opener walks in like anyone. */
export const PORTAL_AHEAD = 2;
/** A wall nearer than PORTAL_AHEAD brings it in, this far short of the wall - never nearer than PORTAL_MIN_AHEAD (still
 *  out of reach); with no room for that, no portal (metres). */
export const PORTAL_WALL_GAP = 0.6;
export const PORTAL_MIN_AHEAD = 1.2;
/** The ground under it is looked for from a metre over the opener's feet, this far down (metres). */
export const PORTAL_GROUND_PROBE = 3;
/** Inside a portal: this near its centre across the ground, and this near its foot in height (metres). */
export const PORTAL_REACH = 0.9;
export const PORTAL_REACH_Y = 2;
/** ONLINE (metres, the scene's): the opener says its portal while standing this near it; a peer believes a portal only
 *  this near its opener's own feet (a little more, for the pose's ease); and stands a peer's portal on its own ground
 *  when that ground is found this near the opener's height. */
export const PORTAL_SAY_REACH = 32;
export const PORTAL_PEER_REACH = 40;
export const PORTAL_REGROUND = 4;
/** THE STEP IS FORGOTTEN across a gap: frames this far apart (ms - a building, a dungeon: the host's frame returns
 *  before the portals there) or feet that jumped this far between two frames (metres - a door, a teleport, a respawn). */
export const PORTAL_STEP_GAP_MS = 250;
export const PORTAL_STEP_JUMP = 1.5;
/** The portal's id on the wire: a short token. */
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/;

export const PORTAL_TEXT = Object.freeze({
  row: `Portal Stone (${PORTAL_STONE_SHARDS} shards)`,
  ask: (held) => `Buy a ${PORTAL_STONE.name} for ${shardsText(PORTAL_STONE_SHARDS)}? You carry ${held}.`,
  bought: `You buy a ${PORTAL_STONE.name}.`,
  /** `held` the shards the purse may spend, `kept` the rest (locked, or worn as a crystal). */
  shards: (held, kept = 0) => `A ${PORTAL_STONE.name} costs ${shardsText(PORTAL_STONE_SHARDS)}. You carry ${held}${kept > 0 ? ` you may spend (${kept} more are locked or worn)` : ''}.`,
  notHere: 'A portal can only be opened under the open sky.',
  noStreet: 'A portal cannot be opened on this street.',
  water: 'You cannot open a portal in the water.',
  aboard: 'You cannot open a portal aboard a boat.',
  standing: 'Your portal is still open.',
  noMap: 'You cannot see the map to choose a destination.',
  room: 'There is no room here for a portal.',
  ground: 'There is no ground here for a portal to stand on.',
  gone: `The ${PORTAL_STONE.name} is no longer where you kept it.`,
  opened: (name) => `A portal to ${name} tears open. Step through before it closes.`,
  /** PORTAL-GIFT (gateSpoils.js givePortalGift): said once the world stands. */
  gift: (n) => `You have been given ${n} ${PORTAL_STONE.name}s. Use one to open a portal to anywhere on the map.`,
});

/** THE HOLDS, in the ladder's order: what keeps a portal shut - for its opener at the door and at the pick, and for
 *  whoever steps in. `busy` (dead, or a move already under way) is said at the door and the pick and passed over in
 *  silence at the step (a teleport's own frames). */
export const PORTAL_HOLD_TEXT = Object.freeze({
  busy: 'You cannot use a portal right now.',
  duel: 'You cannot leave a duel through a portal.',
  siege: 'The wards of this battle hold every portal shut.',
  enemies: 'You cannot use a portal with enemies nearby.',
  journey: 'You cannot use a portal while you travel.',
});
/** The first hold that stands, or null. */
export function portalHold({ dead = false, busy = false, duel = false, siege = false, enemies = false, journey = false } = {}) {
  if (dead || busy) return 'busy';
  if (duel) return 'duel';
  if (siege) return 'siege';
  if (enemies) return 'enemies';
  if (journey) return 'journey';
  return null;
}

/** The stone's card lines (systems/item/itemInfo.js builds the name and the weight around them). */
export const portalStoneLines = () => [
  'Opens a portal to any place on the map.',
  `It stays open for ${Math.round(PORTAL_OPEN_MS / 1000)} seconds, and anyone can step through.`,
];

// ---- the counter ---------------------------------------------------
/** The shards in a pack the purse may NOT spend - locked, or worn (reforge.js shardsHeld's other half). */
export const shardsKept = (items) => (Array.isArray(items) ? items : []).reduce((n, it) => n + (isWelkyndShard(it) ? (it.stackCount ?? 1) : 0), 0) - shardsHeld(items);
/** Why a stone may not be bought, or null: 'shards' (fewer than the price the purse may spend). NO CARRY GATE: the
 *  trade LIGHTENS the pack - the stone weighs less than the shards it costs (the rows' weights, pinned) - and AUDIT
 *  PORTAL1 I3 found the pack's gate refusing an over-burdened player the very sale that made the load lighter. */
export function portalStoneRefusal(items) {
  return shardsHeld(items) < PORTAL_STONE_SHARDS ? 'shards' : null;
}
/** THE SALE: the shards out of the pack (`items`, the list itself), a fresh stone in (onto the pack's unlocked stack) -
 *  all of it or none of it. Answers `{ ok: true, item }` or `{ ok: false, reason }` (portalStoneRefusal's). */
export function buyPortalStone(items) {
  if (!Array.isArray(items)) return { ok: false, reason: 'shards' };
  const why = portalStoneRefusal(items);
  if (why) return { ok: false, reason: why };
  spendShards(items, PORTAL_STONE_SHARDS);
  const item = portalStones(1);
  addItem(items, item);
  return { ok: true, item };
}

// ---- the use -------------------------------------------------------
/** One stone off its stack, or the record off the list. Answers whether one was there to spend. */
export function spendPortalStone(item, list) {
  if (!isPortalStone(item) || !Array.isArray(list) || !list.includes(item)) return false;
  if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
  else list.splice(list.indexOf(item), 1);
  return true;
}
/** The pack's Use: the stone handed to the host's door (useItem.js's registered arm; the readers route 'openPortal'). */
registerItemUseHandler(PORTAL_STONE_TEMPLATE, (item) => ({ kind: 'openPortal', item }));

// ---- the portal ----------------------------------------------------
/**
 * WHERE A PORTAL OPENS: along the opener's facing (the camera's forward, [sin yaw, cos yaw] - world.js playerForward),
 * PORTAL_AHEAD out, or short of a wall `wall(origin, dir, max)` finds nearer from a metre over the feet; on the ground
 * `ground(origin, dir, max)` finds under that spot from a metre over the feet. Answers `{ at }`, or `{ refused }` -
 * 'room' (the wall leaves less than PORTAL_MIN_AHEAD), 'ground' (none within the probe) - so no stone is spent on a
 * portal inside a wall, behind a fence or over a drop.
 * @param {number[]} feet @param {number} yaw
 * @param {{ ground?: ((o: number[], d: number[], m: number) => number | null | undefined) | null, wall?: ((o: number[], d: number[], m: number) => number | null | undefined) | null }} [probes]
 */
export function portalPlace(feet, yaw, { ground = null, wall = null } = {}) {
  const dir = [Math.sin(yaw), 0, Math.cos(yaw)];
  const top = feet[1] + 1;
  let ahead = PORTAL_AHEAD;
  const hit = wall ? wall([feet[0], top, feet[2]], dir, PORTAL_AHEAD + PORTAL_WALL_GAP) : null;
  if (Number.isFinite(hit)) ahead = Math.min(ahead, /** @type {number} */ (hit) - PORTAL_WALL_GAP);
  if (ahead < PORTAL_MIN_AHEAD) return { refused: 'room' };
  const x = feet[0] + dir[0] * ahead, z = feet[2] + dir[2] * ahead;
  const d = ground ? ground([x, top, z], [0, -1, 0], PORTAL_GROUND_PROBE) : null;
  if (!Number.isFinite(d) || /** @type {number} */ (d) > PORTAL_GROUND_PROBE) return { refused: 'ground' };
  return { at: [x, top - /** @type {number} */ (d), z] };
}
/** Whether feet stand inside a portal at `at` (both in one frame). */
export function insidePortal(feet, at) {
  if (!feet || !at) return false;
  return Math.hypot(feet[0] - at[0], feet[2] - at[2]) <= PORTAL_REACH && Math.abs(feet[1] - at[1]) <= PORTAL_REACH_Y;
}
/** THE STEP IN: an entry is a step from outside to inside - `was` the last frame's answer (null: never asked, or
 *  forgotten across a gap). Answers `{ inside, entered }`. */
export function portalStepIn(was, feet, at) {
  const inside = insidePortal(feet, at);
  return { inside, entered: inside && was === false };
}

// ---- the wire ------------------------------------------------------
const q2 = (v) => Math.round(v * 100) / 100;
/** A portal as its opener says it (`gate.native`, the world frame's [x, y, z] - the camps' frame on the wire): i its id,
 *  p where it stands, d the destination's map pixel [x, y], r the ms it has left. The destination's NAME is never said -
 *  each receiver reads it off its own map. */
export const portalWire = (gate, nowMs = 0) => {
  const p = gate.native;
  return { i: gate.id, p: [q2(p[0]), q2(p[1]), q2(p[2])], d: [gate.dest.pixel.x, gate.dest.pixel.y], r: Math.max(0, Math.round(gate.until - nowMs)) };
};
/** The record projected, or null: a field outside its law refuses the record WHOLE (wire.js's rule). */
export function validPortalRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.i !== 'string' || !ID_RE.test(r.i)) return null;
  if (!Array.isArray(r.p) || r.p.length !== 3 || !r.p.every(Number.isFinite)) return null;
  if (Math.abs(r.p[0]) > POSE_BOUND || Math.abs(r.p[2]) > POSE_BOUND || Math.abs(r.p[1]) > POSE_Y_BOUND) return null;
  if (!Array.isArray(r.d) || r.d.length !== 2 || !r.d.every(Number.isInteger)) return null;
  if (r.d[0] < 0 || r.d[0] >= MAX_MAP_PIXEL_X || r.d[1] < 0 || r.d[1] >= MAX_MAP_PIXEL_Y) return null;
  if (!Number.isFinite(r.r) || r.r <= 0 || r.r > PORTAL_OPEN_MS) return null;
  return { i: r.i, p: [r.p[0], r.p[1], r.p[2]], d: [r.d[0], r.d[1]], r: r.r };
}
