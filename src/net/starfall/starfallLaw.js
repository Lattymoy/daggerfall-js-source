// @ts-check
// STAR1 (2026-10-20, the owner: "A lore accurate world encounter defense mission ... something coming from the sky and
// crashing into the ground, where people need to defend the objective in a wave based format with a boss topping off
// the encounter at the end", and "multiple encounters spread throughout the region, not just one"): THE STARFALL'S LAW -
// when the stars fall, where in its pixel each lands, and the ledger a star's cell keeps while its coven comes for it.
// Design: bible/11-Multiplayer/Starfall.md sections 1, 4 and 5.
//
// A FUNCTION OF THE WALL CLOCK, AND NOTHING ELSE. The sky turns once a real hour, its midnight on the hour (net/skyLaw.js
// SKY_SEGMENTS - TimeScale 24, aligned), and a night's three stars fall at fixed instants of that hour. The law reads
// wall time alone, so the relay needs no sky (skyLaw.js is never the relay's - test/systems/time1_sky.test.js holds it
// out); test/net/starfall/star1_law.test.js holds every star of a year of nights inside the sky's dark, read off the sky.
//
// THE LEDGER is the cell's (server/src/index.js `_star*`): what a star's defenders' words have moved - the gathering, each
// wave and its breath, the master, the star's light, who defended - stepped on an ENCOUNTER CLOCK that runs only while
// someone stands at the star (a word from it within STAR_PRESENT_MS), so a star left alone waits where it stood. The
// foes are the owner's machine's (the camp law), so the owner's word moves the waves, the light and the master's fall;
// the law bounds each (section 10).
//
// PURE, and the relay's too: it imports the wire's and the gate's law (both already the relay's) and the festival's
// calendar (net/festivalLaw.js, a leaf but for the holiday tables). An edit here is an
// edit to the relay's law (test/net/relayversion.test.js). Not a DFU member. Ledger A (STARFALL).
import { PIXEL_UNITS, STAR_LEDGERS_MAX, STAR_LEDGERS_BY_MAX, STAR_IDLE_MS, STAR_WAVE_SIZE_OLD_MAX } from '../wire.js';
import { gateHash, PIXEL_M, GATE_SPOT_SPREAD_M } from '../gate/gateLaw.js';
import { festivalOpen } from '../festivalLaw.js';   // the festival's one calendar (a leaf beside the holiday tables)

// ═══ THE WINDOW ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** THE WITCHES' FESTIVAL'S DAYS - the Starfall is the festival's (bible/06-Systems/Witches-Festival.md), so it runs while
 *  the festival is open on its one calendar (net/festivalLaw.js FESTIVALS, a row a year), read off the clock alike by the
 *  relay, every client and the questline's need - a cell reads no hub, and no word has to be staged for the stars to
 *  fall (section 12). */
export const starfallRuns = (/** @type {number} */ nowMs) => festivalOpen(nowMs);

// ═══ THE NIGHT AND ITS STARS ═════════════════════════════════════════════════════════════════════════════════════════
/** A sky day, real ms: TimeScale 24 (net/skyLaw.js SKY_SEGMENTS - the test reads the sky itself). */
export const STAR_HOUR_MS = 3_600_000;
/** Each star's landing, ms from its night's midnight: the sky's 18:00, 21:00 and 00:00 (the sky's day is an hour, so a
 *  sky hour is 150 000 ms). */
export const STAR_FALLS_MS = Object.freeze([-900_000, -450_000, 0]);
/** The stars a night - the falls' own count. */
export const STAR_PER_NIGHT = STAR_FALLS_MS.length;
/** The omen runs this long before a landing: a new star burns over the region. */
export const STAR_OMEN_MS = 90_000;
/** The streak, this long before a landing: the star tears loose and comes down (the omen's last seconds). */
export const STAR_STREAK_MS = 8_000;
/** A star stands this long after it lands; unheld by then, the coven takes it. The night's last is dawn's. */
export const STAR_LIFE_MS = 900_000;
/** A word said in a star's last moment reaches the relay a moment after it (the rite's RITE_GRACE_MS): a ledger's words
 *  are heard this long past its deadline, and it is lost only then (starLostAt). */
export const STAR_GRACE_MS = 2_000;
/** A held or lost star still stands this long after its end - the thread burnt, the stone gold or dark. */
export const STAR_AFTER_MS = 120_000;

/** The night an instant stands in: the one whose midnight is the nearest hour at or after it, while its last star stands
 *  (its midnight plus STAR_LIFE_MS) - so the hour's first quarter is the night before's dawn. */
export const starNightAt = (nowMs) => Math.ceil((nowMs - STAR_LIFE_MS - STAR_FALLS_MS[STAR_PER_NIGHT - 1]) / STAR_HOUR_MS);
/** Whether night `n` and star `k` name a star the law can fall (a whole night, a star of its three). */
export const starOk = (n, k) => Number.isSafeInteger(n) && n > 0 && Number.isInteger(k) && k >= 0 && k < STAR_PER_NIGHT;

/**
 * A star's instants, relay ms: the omen's start, the streak's, the landing, the deadline, and the moment it is gone (its
 * deadline and STAR_AFTER_MS). Pure.
 * @param {number} n the night @param {number} k the star
 */
export function starTimes(n, k) {
  const fallAt = n * STAR_HOUR_MS + STAR_FALLS_MS[k];
  return { omenAt: fallAt - STAR_OMEN_MS, streakAt: fallAt - STAR_STREAK_MS, fallAt, endAt: fallAt + STAR_LIFE_MS, goneAt: fallAt + STAR_LIFE_MS + STAR_AFTER_MS };
}
/** Whether a star of night `n` falls inside the window: its landing is the window's. */
export const starInWindow = (n, k) => starOk(n, k) && starfallRuns(starTimes(n, k).fallAt);
/** Whether a word about star (n, k) is heard at `nowMs`: from its landing to its deadline and the grace - inside the
 *  window. Before it lands there is nothing to defend; after its deadline nothing to move. */
export function starHeard(n, k, nowMs) {
  if (!starInWindow(n, k) || !Number.isFinite(nowMs)) return false;
  const t = starTimes(n, k);
  return nowMs >= t.fallAt && nowMs < t.endAt + STAR_GRACE_MS;
}
/** Whether a word at `nowMs` may MAKE star (n, k)'s ledger: heard, and before its deadline. The grace hears a ledger's
 *  last words in flight; it never makes one (a first word then would make a star already lost). */
export const starMayMake = (n, k, nowMs) => starHeard(n, k, nowMs) && nowMs < starTimes(n, k).endAt;
/** When an unheld star is lost: its deadline and the grace, so a master's fall said as the deadline came, still in
 *  flight, holds it. The relay's alarm is armed here (server/src/index.js `_starDueOf`). */
export const starLostAt = (n, k) => starTimes(n, k).endAt + STAR_GRACE_MS;

// ═══ THE ROLLS ════════════════════════════════════════════════════════════════════════════════════════════════════════
/** The Starfall's salt - its rolls never share the gate's (GATE_SALT) stream. */
export const STAR_SALT = 0x5741;
/** Roll `j` of star (n, k), a whole number in [0, 2^32). */
export const starRoll = (n, k, j) => gateHash(STAR_SALT, n, k, j);
const unit = (n, k, j) => starRoll(n, k, j) / 4294967296;
/** The star's spot inside its pixel, metres from the pixel's south-west corner: [east, north] - the gate's frame and
 *  spread (net/gate/gateLaw.js gateSpotLocal), so the relay can place a star from the pixel a word names. */
export function starSpotLocal(n, k) {
  const a = unit(n, k, 1) * 2 * Math.PI, r = Math.sqrt(unit(n, k, 2)) * GATE_SPOT_SPREAD_M;
  return [PIXEL_M / 2 + Math.cos(a) * r, PIXEL_M / 2 + Math.sin(a) * r];
}
/** A native unit's metres: a map pixel is PIXEL_UNITS (net/wire.js) over PIXEL_M - forty (the rite's RITE_UNITS_PER_M). */
export const STAR_UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
/** The star in the relay's frame - native world units - for the pixel a word names. Pure. */
export function starNativeOf(n, k, px, py) {
  const [e, no] = starSpotLocal(n, k);
  return [px * PIXEL_UNITS + e * STAR_UNITS_PER_M, (499 - py) * PIXEL_UNITS + no * STAR_UNITS_PER_M];
}
/** A word is believed from a pose this near its star, metres (the rite's reach: a fight drifts). */
export const STAR_REACH_M = 60;
/** Whether a native pose stands within STAR_REACH_M of star (n, k) in pixel (px, py). */
export function starNear(n, k, px, py, x, z) {
  const [cx, cz] = starNativeOf(n, k, px, py);
  return Math.hypot(x - cx, z - cz) <= STAR_REACH_M * STAR_UNITS_PER_M;
}
/** Where the streak comes from: the bearing it falls along (radians, from north toward east) and its slant - every
 *  screen sees the same star come down the same way. */
export const starStreakBearing = (n, k) => unit(n, k, 3) * 2 * Math.PI;

// ═══ THE DEFENSE ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The waves before the master. */
export const STAR_WAVES = 4;
/** The first wave comes this long (encounter clock) after the first defender's word. */
export const STAR_GATHER_MS = 10_000;
/** A wave runs at most this long; then the next comes whether the last is dead or not. */
export const STAR_WAVE_MAX_MS = 100_000;
/** A wave cleared is believed no sooner than this, a foe (the fastest its foes could die). */
export const STAR_KILL_MIN_MS = 2_500;
/** AUDIT STAR-TUNE F2: THE FLOOR A WAVE'S CLEARING PASSES - its foes shared among the defenders who could kill them at
 *  once, STAR_KILL_MIN_MS each. STAR-TUNE grew a party's wave and left the floor a foe's alone: eight defenders' 21 foes
 *  were 52.5 s however fast they died, an empty crater waited out after a 25 s fight - "the time between waves is too
 *  long" again, for a party. A lone defender's is as it was (4 to 7 foes, 10 to 17.5 s); a party of eight's 7.5 s. */
export const starClearFloorMs = (wz, nd) => Math.ceil(Math.max(0, wz) / Math.max(1, nd | 0)) * STAR_KILL_MIN_MS;
/** The coven draws breath this long between waves, and before the master. STAR-TUNE (2026-10-20, the owner, of the first
 *  run: "The time between waves is too long"): 5 s, from 12 - the breath was the least of the wait (the next wave stood
 *  25 to 35 m out and walked in after it: starfallClient.js STAR_STAND_R), and both are cut. */
export const STAR_BREATH_MS = 5_000;
/** The master's fall is believed no sooner than this after it stood (encounter clock). */
export const STAR_MASTER_MIN_MS = 45_000;
/** A wave's size: a lone defender's first, and the most - one spawn grant's (net/grantLaw.js GRANT_KINDS.star, a
 *  fallen star's own kind, held equal by the test), so every wave of any size is one grant. */
export const STAR_WAVE_MIN = 4;
export const STAR_WAVE_MAX = 24;
/**
 * A wave's size: four for the first defender and two for each beside it, one more each wave on - four to twenty-four.
 * Alone, 4, 5, 6 and 7; two, 6 to 9; four, 10 to 13; eight, 18 to 21; ten or more, the most by the last wave.
 * STAR-TUNE (the owner, of the first run: "the enemies are too few and die too quickly. Does this not have scaling?";
 * then "we should go beyond the limit"): it was two and the defenders, one more from the third, to nine - the camps'
 * spawn grant's stand (GRANT_KINDS.site) - a lone defender's 3, 3, 4 and 4 and a party of eight's nine. The star
 * stands under a grant kind of its own now, sized to its law, and each foe is shared by those who fight it besides
 * (systems/party/partyScale.js). Pure.
 * @param {number} k the wave, 1..STAR_WAVES @param {number} n the defenders
 */
export const starWaveSize = (k, n) => Math.min(STAR_WAVE_MAX, STAR_WAVE_MIN + 2 * (Math.max(1, n | 0) - 1) + Math.max(0, (k | 0) - 1));
/** STAR-TUNE: the coven's foes - its waves and its circle - stand with this times their health: what the rite on a star
 *  calls is no foe of the road (the rite's Summoner's own law, net/gate/gateRite.js RITE_SUMMONER_HEALTH). The master is
 *  an elite already (systems/eliteFoes.js). The relay bounds a camp's foe by it (net/foeBounds.js FOE_BOUND.star). */
export const STAR_FOE_HEALTH = 2;
/** The master's circle at each of its calls: one and half the defenders, two to five; the Heart-Star's twice. */
export const starCircleSize = (n, heart = false) => Math.max(2, Math.min(5, 1 + Math.ceil(Math.max(0, n | 0) / 2))) * (heart ? 2 : 1);
/** The master calls its circle at these shares of its health. */
export const STAR_CIRCLE_AT = Object.freeze([2 / 3, 1 / 3]);
/** While any of its circle stands, the master takes this share of every blow (section 4). */
export const STAR_CIRCLE_SHARE = 0.25;

/** A star's light, and what each landed blow of its coven drinks. */
export const STAR_LIGHT = 100;
export const STAR_BLOW_LIGHT = 1;
/** A breath gives back this much of it, never past full. */
export const STAR_BREATH_LIGHT = 15;
/** The star is said to be going dark at this light. */
export const STAR_LOW_LIGHT = 25;
/** The owner's blow count is credited no faster than this a second, and this many at once - nine foes, a blow a second
 *  each at the most. Over it is clipped, never refused: the rest is credited as the count runs on. */
export const STAR_BLOWS_HZ = 9;
export const STAR_BLOWS_BURST = 6;

/** The level bands (section 4): band 1 to level 8, band 2 to 15, band 3 above - Daggerfall's monsters have fixed levels
 *  and some want a metal to hurt, so a band never stands a foe its players cannot fight. */
export const STAR_BAND_TOPS = Object.freeze([8, 15]);
/** The band of a list of levels: the median's (the lower middle of an even count). 1 for none. Pure. */
export function starBandOf(levels) {
  const ls = (Array.isArray(levels) ? levels : []).filter((l) => Number.isFinite(l) && l >= 1).sort((a, b) => a - b);
  if (!ls.length) return 1;
  const m = ls[(ls.length - 1) >> 1];
  return m <= STAR_BAND_TOPS[0] ? 1 : m <= STAR_BAND_TOPS[1] ? 2 : 3;
}

// ═══ THE WORD AND THE LEDGER ══════════════════════════════════════════════════════════════════════════════════════════
/** A player at a star says its word this often, and at once on a change. */
export const STAR_WORD_MS = 2_000;
/** A word within this of a moment is a defender standing there then (the raid's RAID_PRESENT_MS). */
export const STAR_PRESENT_MS = 15_000;
/** An owner silent this long is no owner: the next who says it owns the foes is (the rite's RITE_ORPHAN_MS). */
export const STAR_ORPHAN_MS = 10_000;
/** The accounts one ledger records, and the names a held star says. */
export const STAR_ACCOUNTS_MAX = 64;
export const STAR_TOP_MAX = 3;
/** The most deaths one word may say (a wave and its leftovers). */
export const STAR_KILLS_WIRE_MAX = 99;
/** The most blows one word may say - the owner's count over a star's life, at the cap's rate. */
export const STAR_BLOWS_WIRE_MAX = 9999;
/** A level's bound on the wire. */
export const STAR_LEVEL_MAX = 60;

/** The phases (the ledger's `p`, the wire's): waiting for a defender, gathering, a wave, a breath, the master, held, lost. */
export const STAR_PHASES = Object.freeze(['fallen', 'gather', 'wave', 'breath', 'master', 'held', 'lost']);
export const P_FALLEN = 0, P_GATHER = 1, P_WAVE = 2, P_BREATH = 3, P_MASTER = 4, P_HELD = 5, P_LOST = 6;
/** Why a star was lost (the ledger's `why`): its light drunk, or its deadline passed. */
export const STAR_LOST_DARK = 1, STAR_LOST_DAWN = 2;

/**
 * @typedef {{ nm: string, lv: number, s: 0|1, last: number, near: boolean, hb: number }} StarAccount
 *   nm the verified name; lv the level its last word said; s 1 once it struck one of the star's foes; last its last word
 *   (relay ms); near whether that word came from the star; hb the most blows it said while it owned the foes
 * @typedef {{ n: number, k: number, px: number, py: number, first: number,
 *   p: number, ec: number, stepAt: number, gatherAt: number, w: number, wz: number, ws: number, bs: number, ma: number,
 *   kn: number, lt: number, bt: number, btAt: number, own: string, ownAt: number, nearAt: number,
 *   hd: number, lo: number, why: number, b: number, nd: number,
 *   a: Record<string, StarAccount>, rc: Record<string, string>, told: boolean, top: string[], hn: number,
 *   by: string, said: boolean }} StarLedger
 *   ec the encounter clock (ms, runs while someone stands at the star); stepAt the wall ms it was last stepped; nearAt
 *   the wall ms of the last word from the star; gatherAt, ws, bs, ma on the encounter clock; kn the deaths the owner said
 *   of this wave; lt the light; bt/btAt the blow bucket; hd/lo the wall ms it was held or lost; b the band of the wave or
 *   the master standing (fixed as it starts); nd the defenders standing; top/hn who held it, and how many; by the account
 *   whose word made it (an account's live stars are bounded - starPlaceFor); said once its receipts are minted and
 *   kept (the hold said, AUDIT WB A10's order); rc the receipts by account; told once the hub has answered
 */

/** A star's ledger, off the first word from it (`by` the account that said it): nothing moved, the light full. Pure. */
export function newStarLedger(w, nowMs, by = '') {
  return {
    n: w.n, k: w.k, px: w.px, py: w.py, first: nowMs,
    p: P_FALLEN, ec: 0, stepAt: nowMs, gatherAt: 0, w: 0, wz: 0, ws: 0, bs: 0, ma: 0,
    kn: 0, lt: STAR_LIGHT, bt: STAR_BLOWS_BURST, btAt: nowMs, own: '', ownAt: 0, nearAt: -Infinity,
    hd: 0, lo: 0, why: 0, b: 1, nd: 0,
    a: {}, rc: {}, told: false, top: [], hn: 0, by, said: false,
  };
}
/** Whether a stored value is a ledger this law made (a cell's storage read back): its star, its pixel, its phase, its
 *  accounts and receipts. */
export const starLedgerSane = (v) => !!v && typeof v === 'object' && starOk(v.n, v.k) && Number.isInteger(v.px) && Number.isInteger(v.py)
  && Number.isInteger(v.p) && v.p >= P_FALLEN && v.p <= P_LOST && !!v.a && typeof v.a === 'object' && !!v.rc && typeof v.rc === 'object';
/** A ledger's identity in its cell: the star and its pixel (a forged pixel is a ledger of its own - section 10). */
export const starLedgerId = (w) => `${w.n}.${w.k}@${w.px},${w.py}`;
/** Whether a ledger is over: held or lost. */
export const starOver = (led) => led.p === P_HELD || led.p === P_LOST;
/** Whether nothing moves a ledger again: lost, or held with its receipts minted and its hub told. The relay keeps no copy
 *  of one in hand: a cell may keep hundreds (starPlaceFor), and they would push its live stars out. */
export const starSettled = (led) => led.p === P_LOST || (led.p === P_HELD && led.said && led.told);

/** The defenders standing at `nowMs`: the accounts whose last word came from the star within STAR_PRESENT_MS. */
export function starDefenders(led, nowMs) {
  return Object.values(led.a).filter((r) => r.near && nowMs - r.last <= STAR_PRESENT_MS);
}
/** The owner, if one holds: the account that said it owns the foes, heard within STAR_ORPHAN_MS. */
export const starOwner = (led, nowMs) => (led.own && nowMs - led.ownAt <= STAR_ORPHAN_MS ? led.own : '');

/** The encounter clock's step to `nowMs`: it runs only while someone stands at the star - up to STAR_PRESENT_MS past the
 *  last word from it (`nearAt`, that word's reach) - so a star left alone waits where it stood, and a word from off the
 *  star moves it no further than the last defender's. */
function clockTo(led, nowMs) {
  const from = led.stepAt, to = Math.min(nowMs, led.nearAt + STAR_PRESENT_MS);
  led.stepAt = Math.max(led.stepAt, nowMs);
  if (led.p === P_FALLEN || starOver(led)) return;
  if (to > from) led.ec += to - from;
}
/** The band of the defenders standing now - fixed for the wave or the master that starts. */
const bandNow = (led, nowMs) => starBandOf(starDefenders(led, nowMs).map((r) => r.lv));
/** A wave starts: its size and its band by the defenders standing now, fixed for it. */
function waveStarts(led, at, nowMs) {
  led.w++; led.p = P_WAVE; led.ws = at; led.kn = 0;
  led.wz = starWaveSize(led.w, starDefenders(led, nowMs).length || 1);
  led.b = bandNow(led, nowMs);
}
/** A breath starts (after a wave, cleared or out of time): the light steadies. */
function breathStarts(led, at) {
  led.p = P_BREATH; led.bs = at; led.kn = 0;
  led.lt = Math.min(STAR_LIGHT, led.lt + STAR_BREATH_LIGHT);
}
/** Lost - dark or at dawn - stamped once. */
function lose(led, nowMs, why) { if (starOver(led)) return; led.p = P_LOST; led.lo = nowMs; led.why = why; }

/**
 * THE MACHINE: the ledger moved on to `nowMs` - its deadline first (wall time), then every transition its encounter
 * clock has passed, each at its own moment on that clock (a word that comes late moves it as if it had come on time).
 * Answers whether anything moved. Pure but for the ledger it is handed.
 * @param {StarLedger} led @param {number} nowMs
 */
export function stepStar(led, nowMs) {
  if (starOver(led)) return false;
  const before = `${led.p}.${led.w}.${led.lt}`;
  if (nowMs >= starLostAt(led.n, led.k)) { lose(led, nowMs, STAR_LOST_DAWN); return true; }
  clockTo(led, nowMs);
  for (let i = 0; i < 2 * STAR_WAVES + 4; i++) {   // at most every transition of a star in one step
    if (led.p === P_GATHER && led.ec >= led.gatherAt + STAR_GATHER_MS) waveStarts(led, led.gatherAt + STAR_GATHER_MS, nowMs);
    else if (led.p === P_WAVE && led.ec >= led.ws + STAR_WAVE_MAX_MS) breathStarts(led, led.ws + STAR_WAVE_MAX_MS);
    else if (led.p === P_BREATH && led.ec >= led.bs + STAR_BREATH_MS) {
      if (led.w >= STAR_WAVES) { led.p = P_MASTER; led.ma = led.bs + STAR_BREATH_MS; led.kn = 0; led.b = bandNow(led, nowMs); }
      else waveStarts(led, led.bs + STAR_BREATH_MS, nowMs);
    } else break;
  }
  return `${led.p}.${led.w}.${led.lt}` !== before;
}

/**
 * ONE WORD FOLDED IN: the account's record (its name, level, strike, presence), the owner, then - from the owner alone -
 * the deaths of this wave (the word names the wave they belong to, `kw`), the wave cleared, the blows on the star and the
 * master's fall, each by its bound. Answers whether the ledger moved (a word that moves only its speaker's moment moves
 * nothing worth saying). Nothing after the star is over. Pure but for the ledger.
 * @param {StarLedger} led @param {string} acct the verified account @param {string} name its verified name
 * @param {{lv: number, s: number, o: number, kw: number, kn: number, wc: number, hb: number, mf: number}} w the word (net/wire.js validStarIn)
 * @param {boolean} near whether the speaker's pose stands at the star (starNear) @param {number} nowMs
 */
export function foldStarWord(led, acct, name, w, near, nowMs) {
  if (starOver(led)) return false;
  let moved = stepStar(led, nowMs);
  let rec = led.a[acct];
  if (!rec) {
    if (Object.keys(led.a).length >= STAR_ACCOUNTS_MAX) return moved;
    rec = led.a[acct] = { nm: '', lv: 1, s: 0, last: 0, near: false, hb: 0 };
  }
  rec.nm = typeof name === 'string' ? name : '';
  rec.lv = Math.max(1, Math.min(STAR_LEVEL_MAX, w.lv | 0));
  rec.last = nowMs; rec.near = !!near;
  if (!near) return moved;   // heard, never counted: a word from off the star moves nothing (section 5)
  led.nearAt = nowMs;
  if (w.s === 1 && !rec.s) { rec.s = 1; moved = true; }
  // the first defender's word begins the gathering - the encounter clock starts with it
  if (led.p === P_FALLEN) { led.p = P_GATHER; led.gatherAt = led.ec; led.b = bandNow(led, nowMs); moved = true; }
  // THE OWNER: the first who says so, until silent STAR_ORPHAN_MS or until it says it no longer is (a camp race lost -
  // world/worldOfDaggerfall/wodShared.js yieldsTo); its blow count is its own for the star's life, never reset
  if (w.o === 1 && (!starOwner(led, nowMs) || led.own === acct)) {
    if (led.own !== acct) { led.own = acct; moved = true; }
    led.ownAt = nowMs;
  } else if (w.o !== 1 && led.own === acct) { led.own = ''; led.ownAt = 0; moved = true; }
  const nd = starDefenders(led, nowMs).length;
  if (nd !== led.nd) { led.nd = nd; moved = true; }
  if (led.own !== acct) return moved;
  // the owner's: the deaths of this wave, the wave cleared, the blows on the star, the master's fall. The deaths are
  // credited only to the wave the word names: the owner's screen says the last wave's through the breath, and the word
  // that ends the breath starts the next (stepped above) - credited there, the new wave would stand already dead
  if (led.p === P_WAVE && w.kw === led.w && w.kn > led.kn) { led.kn = Math.min(w.kn, led.wz); moved = true; }
  if (led.p === P_WAVE && w.wc === led.w && led.ec - led.ws >= starClearFloorMs(led.wz, led.nd)) { breathStarts(led, led.ec); moved = true; }   // AUDIT STAR-TUNE F2: shared by its defenders
  if (w.hb > rec.hb) {
    led.bt = Math.min(STAR_BLOWS_BURST, led.bt + ((nowMs - led.btAt) / 1000) * STAR_BLOWS_HZ);
    led.btAt = nowMs;
    const credit = Math.max(0, Math.min(w.hb - rec.hb, Math.floor(led.bt)));
    if (credit > 0) { rec.hb += credit; led.bt -= credit; led.lt = Math.max(0, led.lt - credit * STAR_BLOW_LIGHT); moved = true; }
  }
  if (led.lt <= 0) { lose(led, nowMs, STAR_LOST_DARK); return true; }
  if (led.p === P_MASTER && w.mf === 1 && led.ec - led.ma >= STAR_MASTER_MIN_MS) { led.p = P_HELD; led.hd = nowMs; moved = true; }
  return moved;
}

/**
 * The accounts that EARNED a held star: struck one of its foes, and said so from the star within STAR_PRESENT_MS of the
 * hold. `[account, record]` pairs, in the ledger's order. Pure.
 * @param {StarLedger} led @returns {Array<[string, StarAccount]>}
 */
export function starEarned(led) {
  if (led.p !== P_HELD) return [];
  return Object.entries(led.a).filter(([, r]) => r.s === 1 && r.near && led.hd - r.last <= STAR_PRESENT_MS);
}
/** The names a held star says: its earners, by name, STAR_TOP_MAX of them. */
export const starTop = (earned) => earned.map(([, r]) => r.nm).filter((nm) => typeof nm === 'string' && nm).sort().slice(0, STAR_TOP_MAX);

/** The ms left in the ledger's phase on the encounter clock (the gathering, a wave, a breath), or -1 where none runs. */
export function starPhaseLeft(led) {
  if (led.p === P_GATHER) return Math.max(0, led.gatherAt + STAR_GATHER_MS - led.ec);
  if (led.p === P_WAVE) return Math.max(0, led.ws + STAR_WAVE_MAX_MS - led.ec);
  if (led.p === P_BREATH) return Math.max(0, led.bs + STAR_BREATH_MS - led.ec);
  return -1;
}
/** The blows the owner's count has had credited (0 with no owner) - a reloaded owner's count starts from it, so its
 *  foes' blows are never counted twice nor lost behind an old count. */
export const starOwnerBlows = (led) => (led.own ? led.a[led.own]?.hb ?? 0 : 0);
/** The ledger as the cell says it (net/wire.js validStarOut `st`): the star, its phase and wave, the wave's size and the
 *  deaths said of it, the ms left in the phase, the light (whole), the defenders and their band, whether an owner holds
 *  the foes and its credited blows, held or lost and why. Said to the account `acct` that spoke, it carries that
 *  account's own credited blows (`hm`): a reloaded or new device counts on from them, owner or not. AUDIT STAR-TUNE F3:
 *  a wave past an older client's `st` (net/wire.js STAR_WAVE_SIZE_OLD_MAX) says nine in `wz` and itself in `wx`. */
export const starLedgerState = (led, acct) => ({
  k: 'st', n: led.n, s: led.k, px: led.px, py: led.py, p: led.p, w: led.w, wz: Math.min(led.wz, STAR_WAVE_SIZE_OLD_MAX), kn: led.kn, wl: starPhaseLeft(led),
  lt: Math.ceil(led.lt), nd: led.nd, b: led.b, ow: led.own ? 1 : 0, hc: starOwnerBlows(led), hd: led.hd, lo: led.lo, why: led.why,
  ...(typeof acct === 'string' ? { hm: Object.hasOwn(led.a, acct) ? led.a[acct].hb : 0 } : {}),
  ...(led.wz > STAR_WAVE_SIZE_OLD_MAX ? { wx: led.wz } : {}),
});
/** A held star as the cell and the hub say it (net/wire.js validStarOut `hd`): the star, the moment, its earners' first
 *  names and how many earned it. */
export const starHeldWord = (led) => ({ k: 'hd', n: led.n, s: led.k, px: led.px, py: led.py, at: led.hd, top: led.top, c: led.hn });
/** When the last of night `n`'s stars is gone: the hub keeps a night's held stars until then. */
export const starNightGoneAt = (n) => starTimes(n, STAR_PER_NIGHT - 1).goneAt;

// ═══ THE CELL'S PLACES ════════════════════════════════════════════════════════════════════════════════════════════════
/** Whether a ledger holds a place in its cell: not over, and short of its deadline - past it, it only hears its last
 *  words in flight (STAR_GRACE_MS), so the night's third star, falling on the first's deadline, finds its place. */
export const starLive = (led, nowMs) => !starOver(led) && nowMs < starTimes(led.n, led.k).endAt;
/**
 * WHO STANDS WHERE: each account at the ledger its most recent word in the cell landed at, if that word came from the
 * star within STAR_IDLE_MS - one star an account, however many it made or spoke at. Answers the ledgers someone stands
 * at; `but` stands at none of them (the account making a new star stands at that one). Pure.
 * @param {StarLedger[]} leds @param {number} nowMs @param {string} [but]
 */
export function starStoodAt(leds, nowMs, but = '') {
  /** @type {Map<string, { r: StarAccount, led: StarLedger }>} */
  const latest = new Map();
  for (const led of leds) {
    for (const [acct, r] of Object.entries(led.a)) {
      const had = latest.get(acct);
      if (!had || r.last > had.r.last) latest.set(acct, { r, led });
    }
  }
  /** @type {Set<StarLedger>} */
  const at = new Set();
  for (const [acct, { r, led }] of latest) if (acct !== but && r.near && nowMs - r.last <= STAR_IDLE_MS) at.add(led);
  return at;
}
/**
 * A NEW STAR'S PLACE in a cell (section 5), for the ledger `by` would make, among the ledgers the cell keeps (`leds`).
 * A star over costs no place and counts to no account. It is kept to its end and STAR_KEEP_MS (the relay's) so its fight
 * is never run again nor its receipts minted twice, and what is kept is bounded without a cap: a ledger is its tuple,
 * made once, from its star's landing to its deadline - a cell's 256 pixels by a night's three stars, one night at a time
 * (its last forgotten 25 minutes past its midnight, the next night's first falling 45 minutes on), 768 at the most.
 * A live star costs a place: STAR_LEDGERS_MAX a cell, STAR_LEDGERS_BY_MAX of them made by one account. Full, the new
 * star takes the place of the live one stood at least lately (`nearAt`) that NOBODY stands at (starStoodAt). A star
 * someone stands at is never put out, so N accounts hold at most N places against a real star and its defenders - a
 * forged pixel's ledger stands in no other's way. Answers whether there is a place, and the ledger whose place it takes
 * (null for a free one). Pure.
 * @param {StarLedger[]} leds @param {string} by @param {number} nowMs
 * @returns {{ ok: boolean, out: StarLedger | null }}
 */
export function starPlaceFor(leds, by, nowMs) {
  const live = leds.filter((led) => starLive(led, nowMs));
  if (live.filter((led) => led.by === by).length >= STAR_LEDGERS_BY_MAX) return { ok: false, out: null };
  if (live.length < STAR_LEDGERS_MAX) return { ok: true, out: null };
  const at = starStoodAt(leds, nowMs, by);
  const out = live.filter((led) => !at.has(led)).sort((x, y) => x.nearAt - y.nearAt)[0] ?? null;
  return { ok: !!out, out };
}
