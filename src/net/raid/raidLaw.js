// @ts-check
// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server" - the relay tracks each raid's kill
// count, kept even if everyone leaves, the cleanse and the participants, and signs the rewards): A TOWN'S RAID, AS THE
// RELAY KEEPS IT. Design: bible/03-World/Raiding-Parties.md, "The relay holds the raid (RAID3)".
//
// THE LEDGER lives in the raided town's CELL (net/wire.js worldRoom - the room every player standing in the town is
// in), one a raid, in the cell object's storage for the raid's window and RAID_KEEP_MS past it: so a raid's count
// outlives everyone leaving it, and the next player to walk in fights on from it. It is fed by the players' WORDS -
// each, every few seconds while they stand in the town during its raid: the raid they stand in (its key, its start,
// its target, its party and its town's map pixel, as the day's own roll made them - RAID1), the deaths of THEIR OWN
// raiders so far, and whether they have struck a raider (the renown stamp). The first word keeps what the raid is
// (WOD7's law: the first claim keeps); every word after it adds only its deaths and its speaker.
//
// WHAT THE RELAY CAN CHECK, it checks: a word is heard only inside its raid's day and window (the shared clock -
// WORLD5), in the cell its town stands in, from a socket whose own pose stands on the town's pixel; a raid's count
// grows no faster than raiders can stand (RAID_KILL_MS: the mod stands one every one to ten seconds), and a share
// said past that is CLIPPED, not refused - the rest is credited as the raid runs on; each account's share is the most
// it has said (RAID2's law - a share is never taken back, and a speaker who says it again adds nothing). WHAT IT
// CANNOT: a kill and a blow are the players' own machines' word (co-op's law - the relay has no world to see them
// in), and it has no copy of the day's schedule (no game data), so it holds a raid it was told of in its window, its
// cell and its pose, and no other. The account service bounds the record (RAID4).
//
// THE CLEANSE is the ledger's: the count at the target, stamped ONCE, with a receipt (net/raid/raidReceipt.js) to each
// account that EARNED one - it struck a raider (said) and stood in the town at the cleanse (a word within
// RAID_PRESENT_MS), the mod's own law (it paid a player on the town's pixel at the cleanse; RAID1 fix 5: one who
// fought). One receipt an account a raid.
//
// PURE - no clock, no storage, no socket: the relay (server/src/index.js) hands in the minute and the millisecond, and
// the pins drive it as the relay would. Imports nothing, so the worker's graph stays flat (guildLaw.js's law).
//
// Not a DFU member. Ledger A (RAID1's row).

/** A raid's key - RaidEnemyName's bracket [IL_13cc]: `region:location:day` (systems/raidingParties.js raidKey).
 *  AUDIT RAID R5: CANONICAL - no leading zero (`3:07:0600` was forty spellings of one raid, at the relay and at the
 *  account service's primary key alike). */
export const RAID_KEY_RE = /^(?:0|[1-9]\d?):(?:0|[1-9]\d{0,3}):(?:0|[1-9]\d{0,6})$/;
/** A game day, classic minutes. */
export const RAID_DAY_MINUTES = 1440;
/** A raid's window, classic minutes (systems/raidingParties.js RAID_DURATION_MINUTES - pinned equal). */
export const RAID_WINDOW_MINUTES = 120;
/** The latest a raid starts in its day, classic minutes (RAID_START_SPAN - 1: `Random.Range(0, 1321)` - pinned). */
export const RAID_START_LAST = 1320;
/** A raid's target: `Random.Range(15, 26)` (RAID_KILLS_MIN, RAID_KILLS_MAX_EXCLUSIVE - 1 - pinned equal). */
export const RAID_TARGET_MIN = 15;
export const RAID_TARGET_MAX = 25;
/** The parties: 0 knights, 1 bandits, 2 orcs (the mod's `type`). */
export const RAID_TYPES = 3;
/** The slack either side of a raid's window, classic minutes - ten real seconds of two clocks' skew (WORLD5). */
export const RAID_SLACK_MINUTES = 2;
/** The most deaths one word may say (raidShared.js RAID_KILLS_WIRE_MAX - pinned equal). */
export const RAID_WORD_KILLS_MAX = 999;
/** THE CAP: a raid's count grows no faster than raiders can stand - one a RAID_KILL_MS (the mod's Random.Range(1, 11)
 *  seconds between raiders, at its shortest), and RAID_KILLS_BURST more from the moment of its first word. An honest
 *  raid never meets it; a word that says more is credited as the raid runs on. */
export const RAID_KILL_MS = 1000;
export const RAID_KILLS_BURST = 3;
/** The accounts one ledger records - a town's raid is twenty-five raiders; past this a newcomer's word counts nothing. */
export const RAID_ACCOUNTS_MAX = 64;
/** "Stood in the town at the cleanse": a word within this of it (a word goes every RAID_WORD_MS). */
export const RAID_PRESENT_MS = 15000;
/** How often a player standing in a raided town says its word, ms (and at once when its deaths or its strike change). */
export const RAID_WORD_MS = 5000;
/** How long a ledger outlives its raid's window, ms - its receipts handed again to an account that comes back. */
export const RAID_KEEP_MS = 10 * 60 * 1000;
/** A word that moves nothing but its speaker's moment is written at most this often - an eviction loses that much of
 *  who stood where, never a death or a strike (those are written at once). */
export const RAID_SAVE_MS = 5000;
/** The ledgers one cell keeps - a cell is sixteen pixels square, and the Bay has two dozen raids a game day. AUDIT RAID
 *  R3: eight, since a raid is now its whole tuple (below) and a place is never taken from a raid being fought. */
export const RAID_LEDGERS_MAX = 8;
/** AUDIT RAID R3: a ledger folded a word within this is being fought - its place is never taken for a new one. */
export const RAID_LEDGER_BUSY_MS = 60 * 1000;
/** AUDIT RAID R3: the ledgers one speaker may have made that still live in a cell - an honest player stands in one raid
 *  at a time (two for a raid's end and the next's start). */
export const RAID_LEDGERS_BY_MAX = 2;
/** The names a cleanse says. */
export const RAID_TOP_MAX = 3;

/**
 * AUDIT RAID R1: A RAID IS ITS WHOLE TUPLE. The first word used to keep what a raid IS - its start, target, party and
 * town - for its key, and any socket in the cell could say it first: the honest defenders' words folded into a raid
 * with the wrong target (never cleansed) or the wrong pixel (never counted). A raid is now its key AND this signature,
 * which every honest machine computes alike off the day's roll (RAID1): a word naming another tuple is another raid,
 * whose ledger (if its speaker stands on its pixel) and cleanse are its own - and a client hears a relay's word only of
 * the tuple it holds. The signature rides `st`, `cl` and `cls`.
 * @param {{st: number, tg: number, ty: number, px: number, py: number}} w
 */
export const raidSig = (w) => `${w.st}.${w.tg}.${w.ty}.${w.px}.${w.py}`;
export const RAID_SIG_RE = /^\d{1,11}\.\d{1,2}\.\d\.\d{1,3}\.\d{1,3}$/;   // the start reaches eleven digits at the key's last day
/** A ledger's identity in its cell: the raid's key and its signature. */
export const raidLedgerId = (w) => `${w.key}|${raidSig(w)}`;

/** A raid key's day, or null. */
export function raidDayOfKey(key) {
  if (typeof key !== 'string' || !RAID_KEY_RE.test(key)) return null;
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

/**
 * Is a word inside its raid's time - the start in its key's day, and the shared clock (`g`, classic minutes) inside
 * the window it names, give or take the slack?
 * @param {{key: string, st: number}} w @param {number} g
 */
export function raidWordFits(w, g) {
  const day = raidDayOfKey(w?.key);
  if (day === null || !Number.isSafeInteger(w.st) || !Number.isFinite(g)) return false;
  const first = day * RAID_DAY_MINUTES;
  if (w.st < first || w.st > first + RAID_START_LAST) return false;
  return g >= w.st - RAID_SLACK_MINUTES && g < w.st + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES;
}
/** AUDIT RAID R6: is a word a raid the day COULD roll - its start inside its key's own day? A word that is not is no
 *  honest machine's (junk, struck); one that is and is merely out of its time is dropped (a clock at the window's edge). */
export function raidWordSane(w) {
  const day = raidDayOfKey(w?.key);
  if (day === null || !Number.isSafeInteger(w.st)) return false;
  const first = day * RAID_DAY_MINUTES;
  return w.st >= first && w.st <= first + RAID_START_LAST;
}

/** The minute past which a ledger's raid can hear no word (the relay adds RAID_KEEP_MS in its own clock). */
export const raidLedgerEndMinute = (led) => led.st + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES;

/**
 * @typedef {{nm: string, n: number, s: 0|1, last: number}} RaidAccount
 * @typedef {{key: string, st: number, tg: number, ty: number, px: number, py: number, first: number, n: number,
 *   a: Record<string, RaidAccount>, cl: null|{at: number, top: string[], n: number}, rc: Record<string, string>, told: boolean,
 *   by?: string}} RaidLedger
 */

/**
 * A raid's ledger, off its first word: the raid as that word names it (its tuple - AUDIT RAID R1), nothing counted,
 * and who made it (`by` - AUDIT RAID R3: a speaker's places in a cell are bounded).
 * @param {{key: string, st: number, tg: number, ty: number, px: number, py: number}} w @param {number} nowMs @param {string} [by]
 * @returns {RaidLedger}
 */
export function newRaidLedger(w, nowMs, by = '') {
  return { key: w.key, st: w.st, tg: w.tg, ty: w.ty, px: w.px, py: w.py, first: nowMs, n: 0, a: {}, cl: null, rc: {}, told: false, by };
}
/** AUDIT RAID R3: the ledger's last moment of fighting - its newest word folded, or its making. */
export const raidLedgerLast = (led) => Object.values(led.a ?? {}).reduce((t, r) => Math.max(t, Number.isFinite(r?.last) ? r.last : 0), Number.isFinite(led.first) ? led.first : 0);
/**
 * AUDIT RAID R3: WHICH LEDGER GIVES ITS PLACE to a new raid in a full cell, or null for none - a new word took the
 * stalest live one, a raid being fought and a cleansed one (whose receipts and hub word it still owes) among them.
 * Never a cleansed ledger, never one fought within RAID_LEDGER_BUSY_MS; one that has counted no death first, then the
 * stalest. Pure: `ledgers` as the cell holds them.
 * @param {RaidLedger[]} ledgers @param {number} nowMs
 */
export function raidEvictPick(ledgers, nowMs) {
  const free = ledgers.filter((led) => led && !led.cl && nowMs - raidLedgerLast(led) >= RAID_LEDGER_BUSY_MS);
  if (!free.length) return null;
  const empty = free.filter((led) => !(led.n > 0));   // nothing counted (its maker stands on it - a ledger is made by a word from its town)
  const pool = empty.length ? empty : free;
  return pool.reduce((a, b) => (raidLedgerLast(b) < raidLedgerLast(a) ? b : a));
}

/** The most a raid's count may be at `nowMs` (THE CAP above). */
export const raidCap = (led, nowMs) => RAID_KILLS_BURST + Math.floor(Math.max(0, nowMs - led.first) / RAID_KILL_MS);

/**
 * One word folded in: the account's record (its name, its strike, its last word) and its deaths - the most it has
 * said, credited as far as the cap and the target let them. Answers what the raid's count took from it now, and
 * whether the account is on the ledger at all (a full ledger records no newcomer). Nothing after the cleanse.
 * @param {RaidLedger} led @param {string} acct @param {string} name @param {{n: number, s?: number}} w @param {number} nowMs
 */
export function foldRaidWord(led, acct, name, w, nowMs) {
  if (led.cl) return { credited: 0, known: !!led.a[acct] };
  let rec = led.a[acct];
  if (!rec) {
    if (Object.keys(led.a).length >= RAID_ACCOUNTS_MAX) return { credited: 0, known: false };
    rec = led.a[acct] = { nm: '', n: 0, s: 0, last: 0 };
  }
  rec.nm = typeof name === 'string' ? name : '';
  rec.last = nowMs;
  if (w.s === 1) rec.s = 1;
  let credited = 0;
  if (w.n > rec.n) {
    credited = Math.max(0, Math.min(w.n - rec.n, raidCap(led, nowMs) - led.n, led.tg - led.n));
    rec.n += credited;
    led.n += credited;
  }
  return { credited, known: true };
}

/** Is the raid's count at its target? */
export const raidCleansed = (led) => led.n >= led.tg;

/**
 * The accounts that EARNED the cleanse at `atMs`: struck a raider, and said so from the town's pixel within
 * RAID_PRESENT_MS of it. `[account, record]` pairs, in the ledger's order.
 * @param {RaidLedger} led @param {number} atMs @returns {Array<[string, RaidAccount]>}
 */
export function raidEarned(led, atMs) {
  return Object.entries(led.a).filter(([, r]) => r.s === 1 && atMs - r.last <= RAID_PRESENT_MS);
}

/** The names a cleanse says: the earners who counted most deaths first, then by name, RAID_TOP_MAX of them. */
export function raidTop(earned) {
  return earned.slice()
    .sort(([, a], [, b]) => b.n - a.n || (a.nm < b.nm ? -1 : a.nm > b.nm ? 1 : 0))
    .map(([, r]) => r.nm).filter((nm) => typeof nm === 'string' && nm).slice(0, RAID_TOP_MAX);
}

/** The ledger as a word says it: the count, the target, the start, the cleanse's moment (0: none yet), and (AUDIT RAID
 *  R1) its signature - the client hears it only of the raid it holds. */
export const raidLedgerState = (led) => ({ k: 'st', key: led.key, n: led.n, tg: led.tg, st: led.st, c: led.cl ? led.cl.at : 0, g: raidSig(led) });

// ═══ RAID-ROLL (2026-09-28, Mac: "Fix it" - AUDIT RAID's "not changed": the relay held no copy of the day's schedule,
// so a modified client could name a raid the day never rolled, stand on its own pixel and be paid for it, and a
// many-socket griefer could fill a cell's places with raids it kept "fought"). THE DAY'S ROLL IS THE RELAY'S TOO. ═══
//
// A raid is five draws of the day's own generator - its region, its town, its start, its party, its target - and the
// last three are the GENERATOR'S ALONE: no game data decides them. So the relay reads every word against the day's
// slots with nothing but the day (raidDaySlots): a start, party and target the day never drew is no raid. The region
// and town are the towns table's (MAPS.BSA's rows and the travel map's picker - the player's own game files, which the
// relay never holds); a client hands the relay the table (raidTownsCanon), and the relay keeps it only when its
// SHA-256 is the one its operator pinned (RAID_TOWNS_SHA256, from tools/raidTowns.mjs over the operator's own
// files) - then every word is read against the day's whole roll (raidDayIds): its key, its start, target, party and
// pixel, or nothing.

/** The raids' salt and the world's day seed - systems/worldTick.js DAY_SALT.raids and SHARED_DAY_SEED, pinned equal. */
export const RAID_DAY_SALT = 5;
const RAID_DAY_SEED = 0x44415953;   // 'DAYS'
/**
 * THE DAY'S GENERATOR FOR ITS RAIDS - worldTick.js dayRng(day * 1440, DAY_SALT.raids): mulberry32 (systems/wind/wind.js
 * seededRng) off the day, the world's day seed and the raids' salt. ONE copy for the relay and the client alike
 * (systems/raidingParties.js raidsForDay rolls off this one since RAID-ROLL); pinned equal to worldTick's.
 * @param {number} day @returns {() => number}
 */
export function raidDayRandom(day) {
  let a = ((day * 7919) ^ RAID_DAY_SEED ^ Math.imul(RAID_DAY_SALT, 0x9E3779B1)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** UnityEngine.Random.Range(int, int) as the roll draws it (systems/raidingParties.js's own, moved here). */
const rangeInt = (min, maxExclusive, random) => (maxExclusive <= min ? min : min + Math.floor(random() * (maxExclusive - min)));
/** Mac, 2026-09-27 ("4"): a region is raided about once every four real hours; a game day is two (DFU's TimeScale 12)
 *  - systems/raidingParties.js RAID_REGION_REAL_HOURS and GAME_DAY_REAL_HOURS, pinned equal. */
const RAID_REGION_HOURS = 4, RAID_GAME_DAY_HOURS = 2;
/** The day's count: half a raid for each region the roll can pick (systems/raidingParties.js's, the one copy). */
export const raidsPerDay = (regionCount) => Math.round((Math.max(0, regionCount | 0) * RAID_GAME_DAY_HOURS) / RAID_REGION_HOURS);
/** The most regions a towns table names - MAPS.BSA holds 62, and a picker pixel names 128 + its region. */
export const RAID_REGIONS_MAX = 64;
/** The most raids any day rolls, whatever a client's table - the slots the relay reads a word against. */
export const RAID_SLOTS_MAX = raidsPerDay(RAID_REGIONS_MAX);

/**
 * SelectRaids' roll [IL_0cda-IL_0dc5] - the ONE copy (systems/raidingParties.js rollRaids speaks it): `count` raids,
 * each a region evenly among those with a town left, a town evenly in it and struck off (a region with none left is
 * struck off too), a start, a party and a kill target - in the IL's draw order (region, town, start, party, target).
 * @template {{index: number, px: number, py: number}} T
 * @param {number} day @param {ReadonlyArray<{region: number, towns: ReadonlyArray<T>}>|null} regions
 * @param {number} count @param {() => number} random
 * @returns {Array<{region: number, town: T, st: number, ty: number, tg: number}>}
 */
export function rollRaidTowns(day, regions, count, random) {
  const lists = (regions ?? []).map((g) => ({ region: g.region, towns: [...g.towns] }));
  const out = [];
  for (let l = 0; l < count && lists.length > 0; l++) {
    const i = rangeInt(0, lists.length, random);
    const g = lists[i];
    const j = rangeInt(0, g.towns.length, random);
    const town = g.towns[j];
    g.towns.splice(j, 1);
    if (g.towns.length === 0) lists.splice(i, 1);
    const st = day * RAID_DAY_MINUTES + rangeInt(0, RAID_START_LAST + 1, random);
    const ty = rangeInt(0, RAID_TYPES, random);
    const tg = rangeInt(RAID_TARGET_MIN, RAID_TARGET_MAX + 1, random);
    out.push({ region: g.region, town, st, ty, tg });
  }
  return out;
}

/**
 * RAID-ROLL: THE DAY'S SLOTS, as the relay reads them with no game data - each raid's start, target and party (the
 * draws after its region's and town's, which are always one each while a town is left), `st.tg.ty`, for as many
 * raids as any table rolls.
 * @param {number} day @returns {Set<string>}
 */
export function raidDaySlots(day) {
  const random = raidDayRandom(day), out = new Set();
  for (let l = 0; l < RAID_SLOTS_MAX; l++) {
    random(); random();   // its region and its town - the towns table's
    const st = day * RAID_DAY_MINUTES + rangeInt(0, RAID_START_LAST + 1, random);
    const ty = rangeInt(0, RAID_TYPES, random);
    const tg = rangeInt(RAID_TARGET_MIN, RAID_TARGET_MAX + 1, random);
    out.add(`${st}.${tg}.${ty}`);
  }
  return out;
}
/** RAID-ROLL: is a word's start, target and party one the day drew? @param {{st: number, tg: number, ty: number}} w @param {Set<string>} slots */
export const raidOnSlot = (w, slots) => slots.has(`${w.st}.${w.tg}.${w.ty}`);

/** RAID-ROLL: the towns table's ONE spelling - its regions ascending, each its towns in its table's order,
 *  `[[region, [[index, px, py], ...]], ...]` (systems/raidingParties.js raidRegions, less the names). What is hashed,
 *  handed and kept. @param {ReadonlyArray<{region: number, towns: ReadonlyArray<{index: number, px: number, py: number}>}>|null} regions */
export const raidTownsCanon = (regions) => JSON.stringify((regions ?? []).map((g) => [g.region, g.towns.map((t) => [t.index, t.px, t.py])]));
/** RAID-ROLL: the most a table may weigh - the Bay's towns are a few thousand rows of three small numbers. */
export const RAID_TOWNS_BYTES_MAX = 256 * 1024;
/** RAID-ROLL: a table goes to the relay in pieces this long, at most RAID_TOWNS_CHUNKS_MAX of them. */
export const RAID_TOWNS_CHUNK = 12 * 1024;
export const RAID_TOWNS_CHUNKS_MAX = Math.ceil(RAID_TOWNS_BYTES_MAX / RAID_TOWNS_CHUNK);
/** RAID-ROLL: a table's hash, as the operator pins it and the relay asks for it. */
export const RAID_TOWNS_SHA_RE = /^[0-9a-f]{64}$/;
/**
 * RAID-ROLL: a table in its one spelling, read - its regions ascending and on the map, each with a town, each town a
 * row index and a world-map pixel - or null.
 * @param {unknown} s @returns {ReadonlyArray<{region: number, towns: ReadonlyArray<{index: number, px: number, py: number}>}>|null}
 */
export function readRaidTowns(s) {
  if (typeof s !== 'string' || s.length > RAID_TOWNS_BYTES_MAX) return null;
  let v;
  try { v = JSON.parse(s); } catch { return null; }
  if (!Array.isArray(v) || v.length > RAID_REGIONS_MAX) return null;
  const out = [];
  let last = -1;
  for (const g of v) {
    if (!Array.isArray(g) || g.length !== 2 || !Number.isInteger(g[0]) || g[0] <= last || g[0] >= RAID_REGIONS_MAX || !Array.isArray(g[1]) || !g[1].length) return null;
    const towns = [];
    for (const t of g[1]) {
      if (!Array.isArray(t) || t.length !== 3 || !t.every(Number.isInteger) || t[0] < 0 || t[0] > 0xffff || t[1] < 0 || t[1] >= 1000 || t[2] < 0 || t[2] >= 500) return null;
      towns.push(Object.freeze({ index: t[0], px: t[1], py: t[2] }));
    }
    last = g[0];
    out.push(Object.freeze({ region: g[0], towns: Object.freeze(towns) }));
  }
  return Object.freeze(out);
}
/**
 * RAID-ROLL: a table's SHA-256, lowercase hex - the relay's and the client's alike (crypto.subtle is the Worker's, the
 * page's and Node's). Null without a digest to take.
 * @param {string} s @param {SubtleCrypto|undefined} [subtle] @returns {Promise<string|null>}
 */
export async function raidTownsHash(s, subtle = globalThis.crypto?.subtle) {
  if (!subtle || typeof s !== 'string') return null;
  const d = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/**
 * RAID-ROLL: THE DAY'S WHOLE ROLL off a kept table - each raid's identity in its cell (raidLedgerId: its key and its
 * signature). A word whose identity is not here is a raid the day never rolled.
 * @param {number} day @param {ReadonlyArray<{region: number, towns: ReadonlyArray<{index: number, px: number, py: number}>}>} regions
 * @returns {Set<string>}
 */
export function raidDayIds(day, regions) {
  const out = new Set();
  for (const r of rollRaidTowns(day, regions, raidsPerDay(regions.length), raidDayRandom(day))) {
    out.add(raidLedgerId({ key: `${r.region}:${r.town.index}:${day}`, st: r.st, tg: r.tg, ty: r.ty, px: r.town.px, py: r.town.py }));
  }
  return out;
}
