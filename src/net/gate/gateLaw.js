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
// and (WB8b) the marks' leaf, net/gate/gateMods.js, and (GATE-COURTS) the courts' leaf, net/gate/gateCourts.js, which
// import nothing - wire.js is already the relay's. Nothing here reads a map file - the site is the CLIENT's to find, over
// the world's own data (systems/gate/gateSite.js), with the rolls below; the relay never needs to know where a gate is.
//
// Not a DFU member: Daggerfall has no other players and no world events. Ledger A (WB).
import { sharedClassicMinutes, wallMsForClassicMinutes } from '../wire.js';
import { GATE_COURTS_MAX } from './gateCourts.js';   // GATE-COURTS: a night's courts' rooms - gateCourts.js imports nothing
import { GATE_ASPECTS, GATE_TRIALS, readGateMods, GATE_DIRE, gateDireLine, CAPTIVE_NAMES, validGatePortents, portentOf } from './gateMods.js';   // WB8b: the Warden's marks, drawn by the day; WB14b: and the night's portents

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
  let t = _gateTimesOf.get(day);   // AUDIT WB C7: a day's instants made once - the client's clock asks for them every frame
  if (t) return t;
  const base = day * GATE_DAY_MINUTES;
  const at = (minute) => Math.round(wallMsForClassicMinutes(base + minute));
  t = Object.freeze({ day, omenAt: at(GATE_OMEN_MINUTE), riseAt: at(GATE_RISE_MINUTE), openAt: at(GATE_OPEN_MINUTE), sealAt: at(GATE_SEAL_MINUTE), wrathAt: at(GATE_WRATH_MINUTE) });
  if (_gateTimesOf.size >= 8) _gateTimesOf.delete(_gateTimesOf.keys().next().value);
  _gateTimesOf.set(day, t);
  return t;
}
/** The days' instants already made (frozen, so one answer serves every asker). */
const _gateTimesOf = new Map();

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
 *  while it is open, and to the collapse once it has sealed for the night; nothing otherwise. GATE-COLLAPSE (2026-09-28,
 *  the field: "gate under the rock didnt go away stayed there" - "Never left"; Mac: "Count down to collapse"): the sealed
 *  hours said nothing - no countdown on the plaque, the banner or the map - so a gate still standing after "has sealed"
 *  read as one that would never go. It goes at the wrath (a kill inside ends it sooner, and then it is collapsing). */
export function gateCountdown(t, nowMs, phase = gatePhase(t, nowMs)) {
  if (!t) return null;
  if (phase === 'omen' || phase === 'rising' || phase === 'sealed') return { to: 'open', ms: Math.max(0, t.openAt - nowMs) };
  if (phase === 'open') return { to: 'seal', ms: Math.max(0, t.sealAt - nowMs) };
  if (phase === 'closed') return { to: 'collapse', ms: Math.max(0, t.wrathAt - nowMs) };
  return null;
}

/** A countdown's words, the one home for the banner, the plaque and the map: "opens in 4:07", "seals in 8:41",
 *  "collapses in 6:12" - null for none. */
export const countdownWords = (cd) => (cd ? `${cd.to === 'open' ? 'opens' : cd.to === 'seal' ? 'seals' : 'collapses'} in ${countdownText(cd.ms)}` : null);

/** "4:07", "0:09" - minutes and seconds, the seconds rounded UP so a countdown never reads 0:00 while time is left. */
export function countdownText(ms) {
  const s = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ═══ THE ROOM ═════════════════════════════════════════════════════════
//
// A gate's arena is keyed by its day: `gate:<day>`. No zero-padding - the wire admits exactly the keys the clock mints
// (AUDIT WORLD6a B4's law), and each day's arena is a fresh object. GATE-COURTS (net/gate/gateCourts.js): a night's
// courts past its first are `gate:<day>.<k>`, k 1 to GATE_COURTS_MAX - 1, each a fight of its own.
const GATE_ROOM = new RegExp(`^gate:(?:0|[1-9]\\d{0,8})(?:\\.(?:${Array.from({ length: GATE_COURTS_MAX - 1 }, (_, i) => i + 1).join('|')}))?$`);
/** A night's court's room: the first `gate:<day>`, the k-th after it `gate:<day>.<k>`. @param {number} day @param {number} [court] */
export const gateRoomKey = (day, court = 0) => (court > 0 ? `gate:${day}.${court}` : `gate:${day}`);
export const isGateRoom = (key) => GATE_ROOM.test(String(key ?? ''));
/** The day a gate room is for, or null. */
export const gateDayOfRoom = (key) => (isGateRoom(key) ? Number(String(key).slice(5).split('.')[0]) : null);
/** GATE-COURTS: the court a gate room is, 0 the first, or null. */
export const gateCourtOfRoom = (key) => (isGateRoom(key) ? Number(String(key).split('.')[1] ?? 0) : null);
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

/** WB8b: the streams the marks' cycle is shuffled on (gateHash(GATE_SALT, round, key, i) - the provinces' bag is 11). */
const ASPECT_BAG = 12, TRIAL_BAG = 13, ROUND_BAG = 14, GATE_BAG = 15;
/** One round of a bag of `n`: Fisher-Yates on the round's own rolls in stream `key` (bagRound's law). */
function shuffledRound(round, key, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = gateHash(GATE_SALT, round, key, i) % (i + 1);
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
/** Do two gates' marks share nothing - neither the aspect nor a trial? */
const marksApart = (x, y) => x.a !== y.a && !x.t.some((k) => y.t.includes(k));

/**
 * WB8b (2026-09-28, Mac: "give him unique and different modifers on every 2 hour spawn"): THE CYCLE OF MARKS - every
 * aspect with every pair of trials, ONCE EACH, in an order where no two gates running share an aspect or a trial, each
 * round of four gates (gates 4k to 4k+3) brings all four aspects and two trials a gate, and a pair of trials rests a
 * long while before it comes back, under another aspect each time. (AUDIT PRE-MERGE 0929 W1-4: this said "every four
 * gates" - any four running do NOT, and no cycle of every set once could.)
 * Built so: the trials (relabelled by the salt's shuffle) sit at the round-robin's SEATS and fall into its perfect
 * matchings - every pair in exactly one; a ROUND is one matching under one turn of the aspects (pair j wears aspect
 * j + s), so its four gates share nothing; the matchings, in the salt's order, run under the first turn, then the same
 * ones under the next, and so on. Each round's gates stand in its own shuffled order, its first and last chosen, depth
 * first, so the seam between two rounds shares nothing either - the cycle's last gate and its first included, for it
 * comes round again. The same cycle on every client and the relay; made once.
 * WB11a (2026-10-01, Mac: "4. Trial rotation" - the ninth trial, Legion-Lord): NINE TRIALS. An odd count cannot be
 * paired whole, so the circle method sits one out: a BYE takes the last seat, and the trial a matching pairs with it
 * RESTS that round - nine matchings of four real pairs, 4 x 36 = 144 gates (twelve real days); each round brings every
 * aspect and eight of the nine trials, the ninth a different one each round; a pair rests 33 gates at least. (Eight
 * trials, WB8b's, were seven matchings and 4 x 28 = 112, every trial each round, a pair resting 25.) It needs the
 * tables' shape - a pair of trials for every aspect in a round, one trial over at most, two a gate (pinned).
 * @returns {ReadonlyArray<ReadonlyArray<string>>}
 */
function marksCycle() {
  if (_marksCycle) return _marksCycle;
  const nA = GATE_ASPECTS.length, nT = GATE_TRIALS.length;
  // WB11a: the seats - the trials, and the bye beside an odd count of them (the last seat; its pair is no gate)
  const nS = nT + (nT % 2);
  if (Math.floor(nT / 2) !== nA) throw new Error('gateLaw: the marks need two trials an aspect, or one over');
  const pi = shuffledRound(0, TRIAL_BAG, nT), sig = shuffledRound(0, ASPECT_BAG, nA), fo = shuffledRound(0, ROUND_BAG, nS - 1);
  const matchings = fo.map((i) => {
    const pairs = [[i, nS - 1]];
    for (let j = 1; j < nS / 2; j++) pairs.push([(i + j) % (nS - 1), (i - j + nS - 1) % (nS - 1)]);
    return pairs.filter((q) => q[0] < nT && q[1] < nT).map(([x, y]) => [pi[x], pi[y]].sort((u, v) => u - v));   // WB11a: the trial paired with the bye rests
  });
  const rounds = [];
  for (let s = 0; s < nA; s++) for (const m of matchings) rounds.push(m.map((t, j) => ({ a: sig[(j + s) % nA], t })));
  const seq = [];
  const place = (p, last) => {
    if (p === rounds.length) return marksApart(last, seq[0][0]);   // the wrap: the cycle comes round
    const R = shuffledRound(p, GATE_BAG, rounds[p].length).map((k) => rounds[p][k]);   // the round's gates in its own order
    for (let f = 0; f < R.length; f++) {
      if (last && !marksApart(last, R[f])) continue;
      for (let l = R.length - 1; l >= 0; l--) {
        if (l === f) continue;
        seq[p] = [R[f], ...R.filter((_, k) => k !== f && k !== l), R[l]];
        if (place(p + 1, R[l])) return true;
      }
    }
    return false;
  };
  if (!place(0, null)) throw new Error('gateLaw: the marks have no cycle');   // the tables' shape and the salt pinned: never
  _marksCycle = Object.freeze(seq.flat().map((g) => Object.freeze([GATE_ASPECTS[g.a].id, ...g.t.map((k) => GATE_TRIALS[k].id)])));
  return _marksCycle;
}
/** @type {ReadonlyArray<ReadonlyArray<string>>|null} */
let _marksCycle = null;
/** How many gates the cycle of marks runs before a set comes again. */
export const gateMarksCycleLength = () => marksCycle().length;

/**
 * WB8b: THE WARDEN'S MARKS for a gate's day - `[aspect, trial, trial]` (net/gate/gateMods.js ids), what the relay's brain
 * fights under (net/gate/gateBrain.js fightProfile) and every screen names before the gate opens: its place in the cycle
 * (marksCycle - no set of marks comes again until the cycle does, 144 gates since WB11a, and no two gates running share
 * one), from the day alone.
 * @param {number} day
 * @returns {ReadonlyArray<string>}
 */
export function gateModsOf(day) {
  const c = marksCycle(), g = gateIndex(day);
  return c[((g % c.length) + c.length) % c.length];
}

// ═══ WB14b: THE PORTENTS' BAG ═════════════════════════════════════════
//
// (2026-10-19, bible/11-Multiplayer/Breach-Portents.md section 1.) A night's portents are drawn by its place among the
// gates that can carry one - every gate but a Legion-Lord night (his host is tied to his courts and phases: the Vanguard
// would put two hosts in one fight, the Sundering two of him for his Sappers to walk at). Every other one of those
// carries one, so no two gates running ever share a portent and none is lost to the trial that excludes it; WHICH one is
// a shuffle bag - the provinces' law (pickGateRegion): each round of six brings the Vanguard twice, the Sundering twice,
// the Captive once and the Dire Breach once, in an order the round's own rolls shuffle.

/** WB14b: the stream the portents' bag is shuffled on (the provinces' is 11, the marks' 12-15). */
export const PORTENT_BAG_KEY = 16;
/** WB14b: one round of the bag - `dire` the Vanguard and the Sundering together (net/gate/gateMods.js GATE_DIRE). */
export const PORTENT_BAG = Object.freeze(['vanguard', 'vanguard', 'sunder', 'sunder', 'captive', 'dire']);
/** WB14b: may a gate's marks carry a portent - any but a Legion-Lord night's. */
export const marksCarryPortent = (md) => !(Array.isArray(md) && md.includes('legion'));
/** WB14b: how many gates of one cycle of marks before each of its places can carry a portent (the last entry the cycle's
 *  whole count). Made once. @type {number[]|null} */
let _carriers = null;
function carriersBefore() {
  if (_carriers) return _carriers;
  const c = marksCycle(), pre = [0];
  for (let i = 0; i < c.length; i++) pre.push(pre[i] + (marksCarryPortent(c[i]) ? 1 : 0));
  return (_carriers = pre);
}
/**
 * WB14b: A NIGHT'S PORTENTS - null for none, else its ids (net/gate/gateMods.js GATE_PORTENTS: one, or the Dire Breach's
 * two), from the day alone: the relay draws a fight's with it (net/gate/gateBrain.js newFight), every screen and the herald
 * say it before the gate opens.
 * @param {number} day
 * @returns {ReadonlyArray<string>|null}
 */
export function gatePortentsOf(day) {
  if (!isGateDay(day)) return null;
  const c = marksCycle(), L = c.length, g = gateIndex(day), pos = ((g % L) + L) % L, q = Math.floor(g / L);
  if (!marksCarryPortent(c[pos])) return null;
  const pre = carriersBefore(), n = q * pre[L] + pre[pos];
  if (((n % 2) + 2) % 2 === 1) return null;   // every other carrier
  const k = n / 2, round = Math.floor(k / PORTENT_BAG.length), at = k - round * PORTENT_BAG.length;
  const id = PORTENT_BAG[shuffledRound(round, PORTENT_BAG_KEY, PORTENT_BAG.length)[at]];
  return id === 'dire' ? GATE_DIRE : _portentOne(id);
}
const _onePortent = new Map();
const _portentOne = (id) => { let a = _onePortent.get(id); if (!a) { a = Object.freeze([id]); _onePortent.set(id, a); } return a; };

/** WB14e: THE TITHE-IMP - one night in TITHE_ONE_IN, unannounced (bible/11-Multiplayer/Breach-Portents.md section 9). */
export const TITHE_ONE_IN = 5;
/** WB14e: it rises this long after his wake at the soonest, and up to TITHE_SPREAD_MS later, by the day's roll. */
export const TITHE_AFTER_MS = 50_000;
export const TITHE_SPREAD_MS = 100_000;
/** WB14e: when a night's Tithe-Imp rises, ms after his wake - null on a night with none. */
export const gateTitheOf = (day) => (isGateDay(day) && gateRoll(day, 21) % TITHE_ONE_IN === 0 ? TITHE_AFTER_MS + (gateRoll(day, 22) % (TITHE_SPREAD_MS / 1000)) * 1000 : null);
/** WB14f: the night's captive knight - by his place in net/gate/gateMods.js CAPTIVE_NAMES (CAPTIVE_DAMES says a Dame's), and
 *  by name. */
export const captiveIndexOf = (day) => gateRoll(day, 23) % CAPTIVE_NAMES.length;
export const captiveNameOf = (day) => CAPTIVE_NAMES[captiveIndexOf(day)]();
/** WB14b: the portents said - "His vanguard holds the approach." (the Dire Breach's line before its two); '' for none. */
export const portentsLine = (pt) => {
  const ok = validGatePortents(pt);
  if (!ok) return '';
  const lines = ok.map((id) => portentOf(id).line);
  return (ok.length > 1 ? [gateDireLine(), ...lines] : lines).join(' ');
};

// ═══ THE WORDS ════════════════════════════════════════════════════════
//
// The lines the chat says at the gate's moments that name no time - each client says its own, off the clock (bible
// World-Bosses.md section 2). `near` is the town ("Copperham"); `left` a countdown ("4:07"). TIME1: the three that
// named a time (the omen, the opening, the seal) are systems/gate/gateOmen.js's, in local time alone; WB12's relay deploy
// (world151) retired them here.
// WB13b (2026-10-01, Mac: "clean up text to be less explanatory and less AI"): each line the event, where and when -
// the map's ring, the banner and the countdowns say the rest
export const riseLine = ({ near, left }) => `Dagon's Breach rises near ${near}. It opens in ${left}.`;
export const wrathLine = ({ near, boss }) => `The Covenant tears Dagon's Breach near ${near} shut. ${boss} is cast back into the Deadlands.`;
/** WB8c: the Warden's marks said beside the omen (and to a player who comes in later, beside the line they hear first).
 *  WB13b: by name - "Valkynaz Ruhn comes the Rime-Wrought tonight, Colossal and Echoing." - the marks' card and the bar
 *  say what each does; Discord says the same sentence. */
export const marksLine = ({ boss, md }) => {
  const { aspect, trials } = readGateMods(md);
  const names = trials.map((t) => t.name);
  const said = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
  return `${boss} comes ${aspect.epithet} tonight${said ? `, ${said}` : ''}.`;
};
