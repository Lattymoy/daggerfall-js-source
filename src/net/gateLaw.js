// @ts-check
// WB1 (2026-09-25, Mac: "at any point in the world, on the timer, a large area would be shown on the map, also in
// chat ... A gate model would be spawned with a timer that leads to a completely different area, a gate of oblivion"):
// THE GATE'S LAW - when it comes, where, and which room it opens onto. Design: bible/11-Multiplayer/World-Bosses.md.
//
// A FUNCTION OF THE CLOCK, AND NOTHING ELSE. The online world's clock is wall time (WORLD5: wire.js
// sharedClassicMinutes, TimeScale 12, a game day every two real hours), so a gate a game day at dusk is a set of
// instants every client and the relay compute alike - the omen, the map's ring and the gate itself cost no frame.
// The game day is the gate's number; its arena is the room `gate:<day>`.
//
// PURE, and the relay's too (WB3 imports it to hold a boss room to its day's window): this file imports wire.js
// alone, and wire.js is already the relay's. Nothing here reads a map file - the site is the CLIENT's to find, over
// the world's own data (systems/gateSite.js), with the rolls below; the relay never needs to know where a gate is.
//
// Not a DFU member: Daggerfall has no other players and no world events. Ledger A (WB).
import { sharedClassicMinutes, wallMsForClassicMinutes } from './wire.js';

/** Classic minutes in a game day (gameDate.js MINUTES_PER_DAY - pinned equal; not imported, the relay's graph stays flat). */
export const GATE_DAY_MINUTES = 1440;
/** The gate's day, as the game's clock says it (minutes past midnight). The omen at 17:00, the gate risen at 19:00,
 *  open 20:00-22:00, and the wrath at midnight - the next day's 00:00. */
export const GATE_OMEN_MINUTE = 17 * 60;
export const GATE_RISE_MINUTE = 19 * 60;
export const GATE_OPEN_MINUTE = 20 * 60;
export const GATE_SEAL_MINUTE = 22 * 60;
export const GATE_WRATH_MINUTE = 24 * 60;
/** One gate every this many game days (a game day is two real hours online). Mac's dial. */
export const GATE_EVERY_DAYS = 1;
/** How long the gate takes to climb out of the ground, and to sink back into it, real ms. */
export const GATE_RISE_MS = 20_000;
export const GATE_COLLAPSE_MS = 10_000;
/** The one salt every client rolls a gate's site with. Changing it moves every gate in the world. */
export const GATE_SALT = 0x6a7e;

/** The game day a relay-clock instant stands in. */
export const gameDayAt = (nowMs) => Math.floor(sharedClassicMinutes(nowMs) / GATE_DAY_MINUTES);
/** Does game day `day` hold a gate? */
export const isGateDay = (day) => Number.isSafeInteger(day) && day >= 0 && day % GATE_EVERY_DAYS === 0;

/**
 * A gate's instants, RELAY-CLOCK milliseconds (the client reads its own through the welcome's offset - WORLD5).
 * Whole milliseconds: a classic minute is 5000 real ms, and the division that says so is not exact in doubles.
 * @param {number} day
 */
export function gateTimes(day) {
  const base = day * GATE_DAY_MINUTES;
  const at = (minute) => Math.round(wallMsForClassicMinutes(base + minute));
  return Object.freeze({ day, omenAt: at(GATE_OMEN_MINUTE), riseAt: at(GATE_RISE_MINUTE), openAt: at(GATE_OPEN_MINUTE), sealAt: at(GATE_SEAL_MINUTE), wrathAt: at(GATE_WRATH_MINUTE) });
}

/**
 * The gate the clock is about at `nowMs`: yesterday's while it is still sinking (its wrath is today's midnight),
 * else the next gate day's from today on - live from its omen, upcoming before it.
 * @param {number} nowMs relay clock
 */
export function gateAt(nowMs) {
  let day = gameDayAt(nowMs);
  if (isGateDay(day - 1) && nowMs < gateTimes(day - 1).wrathAt + GATE_COLLAPSE_MS) return gateTimes(day - 1);
  while (!isGateDay(day)) day++;
  return gateTimes(day);
}

/** The phases, in the order a gate lives them. */
export const GATE_PHASES = Object.freeze(['quiet', 'omen', 'rising', 'sealed', 'open', 'closed', 'collapsing', 'gone']);

/**
 * Where a gate stands in its life at `nowMs`. `fellAt` (the relay's word of the kill, WB3) ends it early: a gate whose
 * boss fell collapses then, whatever the clock says.
 * @param {{omenAt:number, riseAt:number, openAt:number, sealAt:number, wrathAt:number}|null} t
 * @param {number} nowMs
 * @param {number|null} [fellAt]
 */
export function gatePhase(t, nowMs, fellAt = null) {
  if (!t || !Number.isFinite(nowMs)) return 'quiet';
  const end = Number.isFinite(fellAt) && /** @type {number} */ (fellAt) >= t.openAt ? Math.min(/** @type {number} */ (fellAt), t.wrathAt) : t.wrathAt;
  if (nowMs >= end + GATE_COLLAPSE_MS) return 'gone';
  if (nowMs >= end) return 'collapsing';
  if (nowMs >= t.sealAt) return 'closed';
  if (nowMs >= t.openAt) return 'open';
  if (nowMs >= t.riseAt + GATE_RISE_MS) return 'sealed';
  if (nowMs >= t.riseAt) return 'rising';
  if (nowMs >= t.omenAt) return 'omen';
  return 'quiet';
}

/** Does the gate stand in the world in this phase (drawn, found, looked at)? */
export const gateStands = (phase) => phase === 'rising' || phase === 'sealed' || phase === 'open' || phase === 'closed' || phase === 'collapsing';
/** Does the map ring show in this phase (the omen until the gate is gone)? */
export const gateMarked = (phase) => phase !== 'quiet' && phase !== 'gone';

/** What a countdown on the gate counts toward, and says: to the opening while it is sealed or rising, to the seal
 *  while it is open; nothing otherwise. */
export function gateCountdown(t, nowMs, phase = gatePhase(t, nowMs)) {
  if (!t) return null;
  if (phase === 'omen' || phase === 'rising' || phase === 'sealed') return { to: 'open', ms: Math.max(0, t.openAt - nowMs) };
  if (phase === 'open') return { to: 'seal', ms: Math.max(0, t.sealAt - nowMs) };
  return null;
}

/** "4:07", "0:09" - minutes and seconds, the seconds rounded UP so a countdown never reads 0:00 while time is left. */
export function countdownText(ms) {
  const s = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ═══ THE ROOM ═════════════════════════════════════════════════════════
//
// A gate's arena is ONE room, keyed by its day: `gate:<day>`. No zero-padding and nothing after it - the wire admits
// exactly the keys the clock mints (AUDIT WORLD6a B4's law), and each day's arena is a fresh object.
const GATE_ROOM = /^gate:(?:0|[1-9]\d{0,8})$/;
/** @param {number} day */
export const gateRoomKey = (day) => `gate:${day}`;
export const isGateRoom = (key) => GATE_ROOM.test(String(key ?? ''));
/** The day a gate room is for, or null. */
export const gateDayOfRoom = (key) => (isGateRoom(key) ? Number(String(key).slice(5)) : null);
/** WB3: may a player enter this day's arena for the first time now? From the opening to the seal. */
export const gateAdmits = (day, nowMs) => { const t = gateTimes(day); return isGateDay(day) && nowMs >= t.openAt && nowMs < t.sealAt; };
/** WB3: may a player who has already entered be in the room now (a reconnect after a blip)? Until the wrath's end. */
export const gateHolds = (day, nowMs) => { const t = gateTimes(day); return isGateDay(day) && nowMs >= t.openAt && nowMs < t.wrathAt + GATE_COLLAPSE_MS; };

// ═══ THE ROLLS ════════════════════════════════════════════════════════
//
// Which region, which pixel, where in it, and which boss - each a hash of the day, so every client rolls the same
// and none needs a word from the relay (spawned dungeons' law, world/spawnedDungeons.js).

/** The mix spawned dungeons roll with (world/spawnedDungeons.js hash32 - pinned equal, not imported: that module
 *  reads the map files, and this one is the relay's). */
export function gateHash(...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h ^= n >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}
/** Roll `k` of a gate's day, a whole number in [0, 2^32). */
export const gateRoll = (day, k) => gateHash(GATE_SALT, day, k);
const unit = (day, k) => gateRoll(day, k) / 4294967296;

/** A gate's place in the sequence of gates: its day over GATE_EVERY_DAYS (a gate day divides evenly). */
export const gateIndex = (day) => Math.floor(day / GATE_EVERY_DAYS);

/** The shuffle of `n` provinces for one round of the bag - Fisher-Yates on the round's own rolls. */
function bagRound(round, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = gateHash(GATE_SALT, round, 11, i) % (i + 1);
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/**
 * The gate's region: one of `regions` (the regions with enough ground for a gate, ascending) - drawn from a SHUFFLE
 * BAG: every province takes one gate, in an order the round's rolls shuffle, before any takes a second. So no
 * province holds two gates running (the round's seam is checked: a round never opens on the province the last one
 * closed on), and every province's turn comes round, where a bare roll would leave some dry for days. A round is
 * `regions.length` gates, each two real hours: a few days of real time to visit the whole Bay.
 * @param {number} day
 * @param {number[]} regions
 */
export function pickGateRegion(day, regions) {
  const n = regions?.length ?? 0;
  if (!n) return null;
  const g = gateIndex(day);
  if (n <= 2) return regions[((g % n) + n) % n];   // one province is that one; two alternate
  const round = Math.floor(g / n), at = g - round * n;
  const bag = bagRound(round, n);
  // the seam: a round's first draw is never the last round's last (for n >= 3 the swap below touches draws 0 and 1
  // alone, so the last round's LAST draw is its bag's own, unswapped)
  if (bag[0] === bagRound(round - 1, n)[n - 1]) { const tmp = bag[0]; bag[0] = bag[1]; bag[1] = tmp; }
  return regions[bag[at]];
}
/** The gate's pixel id (y * 1000 + x): one of its region's suitable `pixels`, by the day's roll. */
export const pickGatePixel = (day, pixels) => (pixels?.length ? pixels[gateRoll(day, 2) % pixels.length] : null);

/** A map pixel's side, metres (terrainSampler.js TERRAIN_SIZE - pinned equal). */
export const PIXEL_M = 819.2;
/** How far from its pixel's centre a gate may stand, metres. */
export const GATE_SPOT_SPREAD_M = 200;
/** The gate's spot inside its pixel, metres from the pixel's south-west corner: [east, north] - the frame spawned
 *  dungeons' `spawnedLocationCentreLocal` answers in. The centre, moved up to GATE_SPOT_SPREAD_M, evenly over the disc. */
export function gateSpotLocal(day) {
  const a = unit(day, 3) * 2 * Math.PI, r = Math.sqrt(unit(day, 4)) * GATE_SPOT_SPREAD_M;
  return [PIXEL_M / 2 + Math.cos(a) * r, PIXEL_M / 2 + Math.sin(a) * r];
}

/** WB2: the way the gate faces, radians about y - the day's roll, so every client stands it turned alike. */
export const gateYaw = (day) => unit(day, 8) * 2 * Math.PI;

/** The omen's ring on the map: this many map pixels across its radius (~1.6 km)... */
export const OMEN_RING_PIXELS = 2;
/** ...its centre pulled up to this far off the gate, so the ring says where to go and the land says where exactly. */
export const OMEN_RING_SHIFT_PIXELS = 1.2;
/**
 * The ring, in map pixels (fractional; the map's y runs SOUTH). The gate always stands inside it.
 * @param {number} day @param {number} px @param {number} py the gate's pixel
 * @param {number[]} [spot] the gate's spot in its pixel (gateSpotLocal), [east, north] metres
 */
export function omenRing(day, px, py, spot = gateSpotLocal(day)) {
  const gx = px + spot[0] / PIXEL_M, gy = py + 1 - spot[1] / PIXEL_M;
  const a = unit(day, 6) * 2 * Math.PI, r = Math.sqrt(unit(day, 7)) * OMEN_RING_SHIFT_PIXELS;
  return { cx: gx + Math.cos(a) * r, cy: gy + Math.sin(a) * r, r: OMEN_RING_PIXELS, gx, gy };
}

// ═══ THE BOSSES ═══════════════════════════════════════════════════════
//
// Which boss holds a day's gate - a table, so a later day can bring another without a new mechanism. v1 holds one.
// What the relay's brain needs of a boss (its size, its pace, its attacks) is WB3's; what the client draws, WB4's.
export const GATE_BOSSES = Object.freeze([
  Object.freeze({ id: 'ruhn', name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' }),
]);
/** @param {number} day */
export const gateBossOf = (day) => GATE_BOSSES[gateRoll(day, 5) % GATE_BOSSES.length];

// ═══ THE WORDS ════════════════════════════════════════════════════════
//
// The lines the chat says at the gate's moments - each client says its own, off the clock (bible World-Bosses.md
// section 2). `place` is where ("Copperham, Wrothgarian Mountains"), `near` the town alone; `at` is a real time
// on this machine's clock ("14:32"); `left` a countdown ("4:07").
const clock = (minute) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const omenLine = ({ place, at }) => `The sky burns over the wilds near ${place}. An Oblivion Gate opens there at ${clock(GATE_OPEN_MINUTE)} (${at} your time) - it is marked on your map.`;
export const riseLine = ({ near, left }) => `An Oblivion Gate has risen near ${near}. It opens in ${left}.`;
export const openLine = ({ near, at }) => `The Oblivion Gate near ${near} stands open until ${clock(GATE_SEAL_MINUTE)} (${at} your time).`;
export const sealLine = ({ near }) => `The Oblivion Gate near ${near} has sealed.`;
export const wrathLine = ({ near, boss }) => `The Oblivion Gate near ${near} collapses. ${boss} returns to the Deadlands.`;
