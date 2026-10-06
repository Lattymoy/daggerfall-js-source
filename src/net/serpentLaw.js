// @ts-check
// SERPENT1 (2026-10-04, Mac: "A new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean", then "You make the decisions and online only. I trust your instinct. Be as detailed as
// possible and make this something truly special"): THE SERPENT'S LAW - when Sethrakul rises, which of the Bay's lanes
// it rises on, and the words every client says of it. Design: bible/11-Multiplayer/Sea-Serpent.md.
//
// A FUNCTION OF THE CLOCK, AND NOTHING ELSE - the gate's law (net/gateLaw.js), on the same event clock (WORLD5's
// shared clock, TimeScale 12: a game day every two real hours). A serpent rises every SERPENT_EVERY_DAYS game days at
// the dawn watch, the gate's quiet half of the day, so the two never stand at once: the sighting at 02:00, the rising
// at 05:00, the storm closing its waters at 08:00 and its sounding - gone into the deep - at 10:00. Every client and
// the relay compute the same instants with nothing sent.
//
// WHERE IS THE CLIENT'S (systems/serpentSite.js): the lane is rolled here over the Bay's packet lanes (systems/naval/
// seaLanes.js laneNetwork - the same list on every client, made from the map files every client holds), the spot along
// its way by the rolls below. The relay never reads a map file; the fight lives in the cell room the site stands in
// (net/serpentBrain.js, server/src/index.js), whichever socket of a player's - its own cell's or a halo's - reaches it.
//
// PURE, and the relay's too: this file imports wire.js alone (the clock) and the gate's hash (gateLaw.js, itself the
// relay's) - nothing here reads a map file.
//
// Not a DFU member: Daggerfall has no other players and no sea serpent. Ledger A (SERPENT1).
import { sharedClassicMinutes, wallMsForClassicMinutes } from './wire.js';
import { gateHash, PIXEL_M } from './gateLaw.js';

/** Classic minutes in a game day (gameDate.js MINUTES_PER_DAY - pinned equal; the relay's graph stays flat). */
export const SERPENT_DAY_MINUTES = 1440;
/** The serpent's day, as the game's clock says it: sighted at 02:00, risen at 05:00, its waters closed by the storm at
 *  08:00, sounding at 10:00. On the event clock that is the omen fifteen real minutes before it rises, fifteen minutes
 *  for a ship to reach it, and twenty-five minutes of fight at most. The gate's day is 17:00 to midnight - the serpent's
 *  sounding is seven game hours (35 real minutes) clear of the gate's omen. */
export const SERPENT_OMEN_MINUTE = 2 * 60;
export const SERPENT_RISE_MINUTE = 5 * 60;
export const SERPENT_SEAL_MINUTE = 8 * 60;
export const SERPENT_SOUND_MINUTE = 10 * 60;
/** A serpent every this many game days (four real hours), on the days `day % SERPENT_EVERY_DAYS === SERPENT_DAY_PHASE`.
 *  Four real hours divide the real day six times, so it rises at the same six UTC times each day - every timezone's
 *  evening holds one. */
export const SERPENT_EVERY_DAYS = 2;
export const SERPENT_DAY_PHASE = 1;
/** How long it takes to surface at its rising (the first breach, its body unrolling out of the sea), real ms - the
 *  waters are open from the rising, the fight from here. */
export const SERPENT_SURFACE_MS = 12_000;
/** How long its going takes - the death throes after the kill, or the last dive at its sounding - real ms. */
export const SERPENT_DIVE_MS = 15_000;
/** The one salt every client rolls a serpent's lane and spot with. Changing it moves every serpent in the Bay. */
export const SERPENT_SALT = 0x5e7a;

/** The game day a relay-clock instant stands in (the gate's own - pinned equal: gateLaw.js gameDayAt). */
export const serpentDayAt = (nowMs) => Math.floor(sharedClassicMinutes(nowMs) / SERPENT_DAY_MINUTES);
/** Does game day `day` hold a serpent? */
export const isSerpentDay = (day) => Number.isSafeInteger(day) && day >= 0 && day % SERPENT_EVERY_DAYS === SERPENT_DAY_PHASE;

/**
 * A serpent's instants, RELAY-CLOCK milliseconds, made once a day (the client's clock asks every frame).
 * @param {number} day
 */
export function serpentTimes(day) {
  let t = _timesOf.get(day);
  if (t) return t;
  const base = day * SERPENT_DAY_MINUTES;
  const at = (minute) => Math.round(wallMsForClassicMinutes(base + minute));
  t = Object.freeze({ day, omenAt: at(SERPENT_OMEN_MINUTE), riseAt: at(SERPENT_RISE_MINUTE), sealAt: at(SERPENT_SEAL_MINUTE), soundAt: at(SERPENT_SOUND_MINUTE) });
  if (_timesOf.size >= 8) _timesOf.delete(_timesOf.keys().next().value);
  _timesOf.set(day, t);
  return t;
}
const _timesOf = new Map();

/**
 * The serpent the clock is about at `nowMs`: today's while it has not yet gone (its sounding and its last dive), else
 * the next serpent day's - live from its omen, upcoming before it.
 * @param {number} nowMs relay clock
 */
export function serpentAt(nowMs) {
  let day = serpentDayAt(nowMs);
  if (isSerpentDay(day) && nowMs < serpentTimes(day).soundAt + SERPENT_DIVE_MS) return serpentTimes(day);
  day++;
  while (!isSerpentDay(day)) day++;
  return serpentTimes(day);
}

/** The phases, in the order a serpent lives them. `hunt`: its waters open to every ship; `late`: the storm has closed
 *  them - the ships inside fight on, none joins; `slain` and `sounding` its two endings. */
export const SERPENT_PHASES = Object.freeze(['quiet', 'omen', 'rising', 'hunt', 'late', 'slain', 'sounding', 'gone']);

/**
 * Where a serpent stands in its life at `nowMs`. `fellAt` (the relay's word of the kill) ends it early: a serpent slain
 * goes through its death throes then, whatever the clock says.
 * @param {{omenAt:number, riseAt:number, sealAt:number, soundAt:number}|null} t
 * @param {number} nowMs
 * @param {number|null} [fellAt]
 */
export function serpentPhase(t, nowMs, fellAt = null) {
  if (!t || !Number.isFinite(nowMs)) return 'quiet';
  const slain = Number.isFinite(fellAt) && /** @type {number} */ (fellAt) >= t.riseAt && /** @type {number} */ (fellAt) < t.soundAt;
  const end = slain ? /** @type {number} */ (fellAt) : t.soundAt;
  if (nowMs >= end + SERPENT_DIVE_MS) return 'gone';
  if (nowMs >= end) return slain ? 'slain' : 'sounding';
  if (nowMs >= t.sealAt) return 'late';
  if (nowMs >= t.riseAt + SERPENT_SURFACE_MS) return 'hunt';
  if (nowMs >= t.riseAt) return 'rising';
  if (nowMs >= t.omenAt) return 'omen';
  return 'quiet';
}

/** Does the serpent swim in the world in this phase (drawn, struck, fought)? */
export const serpentSwims = (phase) => phase === 'rising' || phase === 'hunt' || phase === 'late' || phase === 'slain' || phase === 'sounding';
/** Does the map mark its waters in this phase (from the sighting until it is gone)? */
export const serpentMarked = (phase) => phase !== 'quiet' && phase !== 'gone';
/** May a player join the fight now - from the rising until the storm closes the waters? */
export const serpentAdmits = (day, nowMs) => { const t = serpentTimes(day); return isSerpentDay(day) && nowMs >= t.riseAt && nowMs < t.sealAt; };
/** May a fighter already in it be in it now (a reconnect after a blip)? From the rising until it has gone. */
export const serpentHolds = (day, nowMs) => { const t = serpentTimes(day); return isSerpentDay(day) && nowMs >= t.riseAt && nowMs < t.soundAt + SERPENT_DIVE_MS; };

/** What a countdown on the serpent counts to, and says: to its rising from the sighting; to the storm's closing while
 *  its waters are open (AUDIT SERPENT B9: from the rising itself - never "rises in 0s" as it rises); to its sounding
 *  once they are closed. Null otherwise. */
export function serpentCountdown(t, nowMs, phase = serpentPhase(t, nowMs)) {
  if (!t) return null;
  if (phase === 'omen') return { to: 'rise', ms: Math.max(0, t.riseAt - nowMs) };
  if (phase === 'rising' || phase === 'hunt') return { to: 'seal', ms: Math.max(0, t.sealAt - nowMs) };
  if (phase === 'late') return { to: 'sound', ms: Math.max(0, t.soundAt - nowMs) };
  return null;
}
/** "4m 07s", "9s" - the seconds rounded UP, so a countdown never reads 0s while time is left (gateLaw.js's law). AUDIT
 *  SERPENT (words): never "15:00" - a time left read as a clock's hour beside lines that name the hour it rises. */
export function serpentClock(ms) {
  const s = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
/** A countdown's words: "rises in 4m 07s", "storm closes in 8m 41s", "dives in 6m 12s" - null for none. AUDIT SERPENT
 *  (words): it DIVES - "sounds", the sailors' word, read as a noise. */
export const serpentCountdownWords = (cd) => (cd ? `${cd.to === 'rise' ? 'rises' : cd.to === 'seal' ? 'storm closes' : 'dives'} in ${serpentClock(cd.ms)}` : null);

// ═══ THE ROLLS ════════════════════════════════════════════════════════
//
// Which lane, and where along it - each a hash of the day, so every client rolls the same (gateLaw.js gateHash, the
// spawned dungeons' mix). systems/serpentSite.js walks the tries in order until one is open sea.

/** Roll `k` of a serpent's day, a whole number in [0, 2^32). */
export const serpentRoll = (day, k) => gateHash(SERPENT_SALT, day, k);
const unit = (day, k) => serpentRoll(day, k) / 4294967296;
/** How many lanes a day tries before it gives the Bay no serpent (a lane too short, or hugging a coast). */
export const SERPENT_LANE_TRIES = 24;
/** Try `i`'s lane: an index into `n` lanes (the lanes in laneNetwork's order - every client's the same). */
export const serpentLaneOf = (day, i, n) => (n > 0 ? serpentRoll(day, 100 + i) % n : -1);
/** Try `i`'s place along its lane's way, a share of its length: the middle stretch, never a port's mouth. */
export const SERPENT_ALONG = Object.freeze([0.3, 0.7]);
export const serpentAlongOf = (day, i) => SERPENT_ALONG[0] + unit(day, 200 + i) * (SERPENT_ALONG[1] - SERPENT_ALONG[0]);
/** The way it first swims as it rises, radians about y (0 north - the site frame's facing law). */
export const serpentRiseYaw = (day) => unit(day, 7) * 2 * Math.PI;

/** Native units to the metre (40: wire.js PIXEL_UNITS, 32768, over gateLaw.js PIXEL_M, a map pixel's 819.2 m - pinned equal). */
export const SERPENT_NATIVE_PER_M = 40;
/** AUDIT SERPENT S1: A SITE'S NAME - its native point to the whole unit (every honest client finds the same point; the
 *  relay keeps one fight a name, and a client hears the kill of its own site's serpent alone). */
export const serpentSiteKey = (sx, sz) => `${Math.round(sx)},${Math.round(sz)}`;
export const sameSerpentSite = (a, b) => !!a && !!b && Number.isFinite(a.sx) && Number.isFinite(a.sz) && Number.isFinite(b.sx) && Number.isFinite(b.sz)
  && serpentSiteKey(a.sx, a.sz) === serpentSiteKey(b.sx, b.sz);

/** The omen's ring on the map: this many map pixels across its radius (about 2.5 km) - its waters with room to sail
 *  into - and its centre pulled this far at most off the site, so the ring says where to sail and the sea where. */
export const SERPENT_RING_PIXELS = 3;
export const SERPENT_RING_SHIFT_PIXELS = 1.2;
/**
 * The ring, in map pixels (fractional; the map's y runs SOUTH), around the site's native point. The site always lies
 * inside it.
 * @param {number} day @param {number} sx @param {number} sz the site, native units
 */
export function serpentRing(day, sx, sz) {
  const gx = sx / (PIXEL_M * SERPENT_NATIVE_PER_M), gy = 500 - sz / (PIXEL_M * SERPENT_NATIVE_PER_M);
  const a = unit(day, 8) * 2 * Math.PI, r = Math.sqrt(unit(day, 9)) * SERPENT_RING_SHIFT_PIXELS;
  return { cx: gx + Math.cos(a) * r, cy: gy + Math.sin(a) * r, r: SERPENT_RING_PIXELS, gx, gy };
}

// ═══ THE SERPENTS ═════════════════════════════════════════════════════
//
// Which serpent rises - a table, so a later day can bring another without a new mechanism (the gate's GATE_BOSSES law).
// v1 holds one. SETHRAKUL: the Redguards say Satakal, the World-Skin, sheds the world as a snake sheds its skin, and
// that not every skin he leaves behind is dead. Sailors along the Bay call it the Old Coil.
export const SERPENT_BOSSES = Object.freeze([
  Object.freeze({ id: 'sethrakul', name: 'Sethrakul', title: 'the Shed-Skin of Satakal', nick: 'the Old Coil' }),
]);
/** @param {number} day */
export const serpentBossOf = (day) => SERPENT_BOSSES[serpentRoll(day, 5) % SERPENT_BOSSES.length];
/** A boss by its id (a receipt's, a state's), or the first. */
export const serpentBossById = (id) => SERPENT_BOSSES.find((b) => b.id === id) ?? SERPENT_BOSSES[0];

// ═══ THE WORDS ════════════════════════════════════════════════════════
//
// The chat's lines at the serpent's moments, each the event, where and when (WB13b's law: the map's ring and the bar
// say the rest). `near` the port the site lies off ("Sentinel"); `at` a local time ("14:32" - TIME1: a line that names
// a time names this machine's); `left` a countdown ("4:07").
export const sightingLine = ({ near, at, boss }) => `Bells ring in the harbours: a great serpent is sighted off ${near}. ${boss} rises at ${at} your time.`;
export const risingLine = ({ near, boss, left }) => `${boss} rises off ${near}. The storm closes over its waters in ${left}.`;
export const sealLine = ({ near, boss, at }) => `A storm closes over ${boss}'s waters off ${near} - no ship can join the fight now. It dives at ${at} your time.`;
export const soundLine = ({ near, boss }) => `${boss} dives off ${near} and is gone into the deep.`;
/** The Bay hears the kill (the relay's word, fanned by the hub): "Sethrakul is slain off Sentinel by Ama, Bel and Cor."
 *  AUDIT SERPENT (words): the whole Bay hears it - its hoard is said to be the ships' that fought it, never everyone's. */
export function slainLine({ near, boss, top }) {
  const names = (Array.isArray(top) ? top : []).filter((n) => typeof n === 'string' && n);
  const by = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
  return `${boss} is slain${near ? ` off ${near}` : ''}${by ? ` by ${by}` : ''}. Its hoard goes to the ships that fought it.`;
}

/** The brain's law version a client fights by: the relay refuses an `in` below SERPENT_BRAIN_MIN in words that say
 *  reload (the gate's GATE-RELOAD law), so a tab loaded before a deploy is never judged by attacks it cannot draw.
 *  SERPENT3 (2): its Maelstrom forms where it swims (a tab before it drew the whirl's wind-up at the waters' heart) and a
 *  pair's blows land at serpentStrike.js SERPENT_PAIR_SHARE (one before it took them whole). */
export const SERPENT_BRAIN_V = 2;
export const SERPENT_BRAIN_MIN = 2;
