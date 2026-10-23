// @ts-check
// OW6L (2026-09-29, the product owner: "Everything needs that persistence between players in the overworld."): THE
// OVERWORLD'S LEDGER, AS A CELL KEEPS IT - one a cell room (net/wire.js worldRoom: sixteen map pixels square), in the
// cell object's storage, so every player in the cell agrees: the ones standing in it now, and the ones who walk in later.
//
// WHAT IT HOLDS - the two things the Overworld could not share before:
//   - THE SPENT. A roaming band (systems/travel/travelBands.js, `b<cx>.<cy>.<life>`) and a Warm Ashes raider
//     (systems/seaRaiders.js, `r<cx>.<cy>.<life>`) are born of the land and the shared clock - every player computes the
//     same ones with no word said - but one a player fought or escaped was told only peer to peer (a foes frame's `bd`),
//     to the players within three map pixels at that moment and to nobody after. The ledger keeps each spent id through
//     its own life and the next (the client's own bandPrune: a band two lives gone is nobody's), OW_CELL_SPENT_MAX of
//     them, the oldest out first.
//   - THE SPAWNED DUNGEONS' CLOCKS (world/spawnedDungeons.js TTL1: a spawn is gone two game days after it was cleared,
//     seven after it was first entered - SPAWN-REBIRTH: it was first SEEN, its pixel streamed in). The roll that stands
//     one on a pixel is a pure hash every client shares; its two clocks were each client's own, so two players disagreed
//     whether one was gone. The ledger keeps a row a pixel - `[px, py, seen, cleared?]`, shared classic minutes, `seen`
//     the first entry - and MIN-MERGES: the earliest first entry and the earliest clear anyone has said. So a spawn's
//     clocks only ever run out sooner, never wind back, and every machine that folds the same rows, in any order, holds
//     the same row. OW_CELL_ROWS_MAX of them (the oldest first entry out first), each let go when its spawn stands again
//     (owRowUntil: OW_REBIRTH_MIN after it died). SPAWN-REBIRTH: they were kept sixty real days, so a spawn that went
//     stayed gone for everyone in the cell that long, and a region walked once stood empty for two months.
//
// WHAT THE RELAY CAN CHECK, it checks: an id's shape, and its life - this one or the last, on the relay's own clock; a
// row's pixel on the map and its SPAWN ROLL (a pixel the roll leaves empty holds no dungeon, and the roll is pure), its
// clear no earlier than its first entry, its life not yet over (SPAWN-REBIRTH: owRowUntil); and every pixel - an id's cell origin, a row's
// own - inside the receiving cell's square widened by OW_CELL_MARGIN_PX (a band met at the seam, a dungeon a pixel over
// the edge). WHAT IT CANNOT: whether a band was fought, and when a pixel was first seen - those are the players'
// machines' word (co-op's law: the relay has no world to see them in); and with no map files it cannot say a pixel is
// sea or road. It holds what it was told inside its window, its cell and its roll, and nothing else.
//
// PURE - no storage, no socket, no clock of its own: the relay (server/src/index.js) and the session (net/online.js)
// hand the moment in. It imports the wire (the cell's arithmetic, the shared clock's law, the frame's shapes),
// net/gate/gateLaw.js (the relay's copy of the spawn hash) and net/raid/raidLaw.js (two clocks' skew) - all three the relay's
// already, so the worker's graph grows by this file alone. The band's, the raider's and the spawn's own numbers are
// PINNED EQUAL here, never imported (gateLaw.js's law for this very hash): their modules reach the map files, and every
// byte this file reaches is the relay's deploy - test/net/ow6_ledger.test.js holds each copy to its home.
//
// Not a DFU member: Daggerfall has no other players, and no Overworld.
import { WORLD_CELL, sharedClassicMinutes, cellOfRoom, OW_BAND_ID_RE, OW_RAIDER_ID_RE, OW_WORD_IDS_MAX, OW_WORD_ROWS_MAX, OW_CELL_SPENT_MAX, OW_CELL_ROWS_MAX, owWireRow, OW_CELL_GRAVES_MAX, OW_GRAVE_ACCT_MAX, OW_GRAVE_ACCT_ROWS_MAX, owGraveIn, owGraveOut, NAME_MAX } from './wire.js';
import { gateHash, GATE_DAY_MINUTES } from './gate/gateLaw.js';   // the spawned dungeons' hash (world/spawnedDungeons.js hash32) - the relay's one copy; a game day's minutes
import { RAID_SLACK_MINUTES } from './raid/raidLaw.js';   // ten real seconds of two clocks' skew (WORLD5)

export { OW_WORD_IDS_MAX, OW_WORD_ROWS_MAX, OW_CELL_SPENT_MAX, OW_CELL_ROWS_MAX, OW_CELL_GRAVES_MAX };

/** A band's life, real ms on the shared clock (systems/travel/travelBands.js BAND_LIFE_MS - pinned equal). */
export const OW_BAND_LIFE_MS = 12 * 60 * 1000;
/** A band's cell, map pixels square (travelBands.js BAND_CELL_PX - pinned equal). */
export const OW_BAND_CELL_PX = 2;
/** A raider's life, real ms on the shared clock (systems/seaRaiders.js RAIDER_LIFE_MS - pinned equal). */
export const OW_RAIDER_LIFE_MS = 20 * 60 * 1000;
/** A raider's cell, map pixels square (seaRaiders.js RAIDER_CELL_PX - pinned equal). */
export const OW_RAIDER_CELL_PX = 6;
/** The one salt every client rolls spawned dungeons with (world/spawnedDungeons.js WORLD_SALT - pinned equal). */
export const OW_WORLD_SALT = 1;
/** A pixel's chance of a spawned dungeon of either kind (spawnedDungeons.js ANY_SPAWN_CHANCE: SPAWN_CHANCE + ELITE_CHANCE,
 *  the same sum - pinned equal, and the roll pinned pixel for pixel over the whole map). SPAWN-THIN: the keep, the
 *  world's own share, on the world's own second lane. */
export const OW_SPAWN_CHANCE = 0.30 + 0.10;
export const OW_SPAWN_KEEP = 0.75;
/** How far past its cell's square an id's or a row's pixel may lie, map pixels - a band met at the seam (its cell is
 *  two pixels, its walk a pixel more), a raider's cell origin (six pixels, and a chase), a dungeon over the edge. */
export const OW_CELL_MARGIN_PX = 8;
/** SPAWN-REBIRTH: a spawn's two clocks and the wait before the same dungeon stands again, classic minutes
 *  (world/spawnedDungeons.js GENERAL_TTL_MINUTES, CLEARED_TTL_MINUTES and REBIRTH_TTL_MINUTES - pinned equal). The wait is
 *  twenty-four real hours of the shared clock (the wire's ONLINE_MINUTES_PER_MS). */
export const OW_GENERAL_TTL_MIN = 7 * GATE_DAY_MINUTES;
export const OW_CLEARED_TTL_MIN = 2 * GATE_DAY_MINUTES;
export const OW_REBIRTH_MIN = 12 * GATE_DAY_MINUTES;
/** SPAWN-REBIRTH: WHEN A ROW STOPS MATTERING, classic minutes - its spawn's death (the earlier of its two clocks) plus
 *  OW_REBIRTH_MIN, when the same dungeon stands again on fresh clocks (spawnedDungeons.js spawnReborn). A row is kept
 *  until then and not a minute past it. @param {number[]} r a wire row */
export const owRowUntil = (r) => Math.min(r[2] + OW_GENERAL_TTL_MIN, Number.isFinite(r[3]) ? r[3] + OW_CLEARED_TTL_MIN : Infinity) + OW_REBIRTH_MIN;
/** A row's clock may run this far ahead of the relay's (classic minutes) - two machines' skew, taken as the relay's now. */
export const OW_ROW_SLACK_MIN = RAID_SLACK_MINUTES;
/** GRAVE-PARTY: how long a searched grave is kept, classic minutes - a search's five game hours (systems/searchables.js
 *  SEARCH_COOLDOWN_MINUTES - pinned equal; that module reaches the item makers, never the relay's graph). */
export const OW_GRAVE_KEEP_MIN = 5 * 60;

// ═══ THE IDS ═════════════════════════════════════════════════════════════════════════════════════

/** An id's kind: 'band', 'raider', or null for anything that is neither. @param {unknown} id @returns {'band'|'raider'|null} */
export function owIdKind(id) {
  if (typeof id !== 'string') return null;
  return OW_BAND_ID_RE.test(id) ? 'band' : OW_RAIDER_ID_RE.test(id) ? 'raider' : null;
}
/** A kind's life, ms. @param {'band'|'raider'|null} kind */
export const owLifeMs = (kind) => (kind === 'band' ? OW_BAND_LIFE_MS : kind === 'raider' ? OW_RAIDER_LIFE_MS : NaN);
/** An id's life - its trailing number - or null. @param {unknown} id @returns {number|null} */
export function owIdLife(id) {
  if (!owIdKind(id)) return null;
  const s = /** @type {string} */ (id);
  return Number(s.slice(s.lastIndexOf('.') + 1));
}
/**
 * Is an id's life the current one for its kind at `nowMs` - the SHARED clock in wall ms (the relay's own Date.now(), a
 * client's Date.now() plus the welcome's offset) - or the one just over? An id of any other life is nobody's here.
 * @param {unknown} id @param {number} nowMs
 */
export function owIdLive(id, nowMs) {
  const kind = owIdKind(id);
  if (!kind || !Number.isFinite(nowMs)) return false;
  const life = owIdLife(id), cur = Math.floor(nowMs / owLifeMs(kind));
  return life === cur || life === cur - 1;
}
/** When a spent id stops mattering, ms: the end of the life AFTER its own (the client's bandPrune keeps it that long). */
export const owIdUntil = (id) => { const kind = owIdKind(id); return kind ? (owIdLife(id) + 2) * owLifeMs(kind) : NaN; };
/**
 * THE MAP PIXEL OF AN ID'S CELL ORIGIN, `{x, y}` (the map's own rows, y counting south), or null. The two kinds count
 * their cells differently, and this is where that is said once:
 *   - a BAND's cells run in the bands' own rows (travelBands.js bandPixelOf: bandY = 499 - mapY - they are counted on
 *     native z, which runs north), BAND_CELL_PX square: cell (cx, cy) starts at band pixel (2cx, 2cy), the map pixel
 *     (2cx, 499 - 2cy) - the cell's southern row, the map's y running the other way;
 *   - a RAIDER's cells run in the map's own rows (seaRaiders.js raiderOf draws its pixel as `cy * RAIDER_CELL_PX + k`
 *     and stands it by MapsFile's own mapPixelToWorldCoord), RAIDER_CELL_PX square: cell (cx, cy) starts at (6cx, 6cy).
 * @param {unknown} id @returns {{x: number, y: number}|null}
 */
export function owIdPixel(id) {
  const kind = owIdKind(id);
  if (!kind) return null;
  const s = /** @type {string} */ (id);
  const [cx, cy] = s.slice(1, s.lastIndexOf('.')).split('.').map(Number);
  return kind === 'band' ? { x: cx * OW_BAND_CELL_PX, y: 499 - cy * OW_BAND_CELL_PX } : { x: cx * OW_RAIDER_CELL_PX, y: cy * OW_RAIDER_CELL_PX };
}

// ═══ THE CELL ════════════════════════════════════════════════════════════════════════════════════

/** A cell room's pixel square widened by OW_CELL_MARGIN_PX on every side - `[x0, x1) x [y0, y1)`, map pixels - or null
 *  for a key that is no cell (net/wire.js cellOfRoom, WORLD_CELL: the cell law's one home). @param {unknown} roomKey */
export function owCellSquare(roomKey) {
  const c = cellOfRoom(roomKey);
  if (!c) return null;
  return { x0: c[0] * WORLD_CELL - OW_CELL_MARGIN_PX, y0: c[1] * WORLD_CELL - OW_CELL_MARGIN_PX, x1: (c[0] + 1) * WORLD_CELL + OW_CELL_MARGIN_PX, y1: (c[1] + 1) * WORLD_CELL + OW_CELL_MARGIN_PX };
}
const inSquare = (s, x, y) => !!s && Number.isFinite(x) && Number.isFinite(y) && x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1;
/** Is an id's cell origin inside a cell room's widened square? A word naming one outside it is junk in that room. */
export const owIdInCell = (id, roomKey) => { const p = owIdPixel(id); return !!p && inSquare(owCellSquare(roomKey), p.x, p.y); };
/** Is a row's pixel inside a cell room's widened square? */
export const owRowInCell = (row, roomKey) => Array.isArray(row) && inSquare(owCellSquare(roomKey), row[0], row[1]);

// ═══ THE ROWS ════════════════════════════════════════════════════════════════════════════════════

/** Does a map pixel hold a spawned dungeon - spawnedDungeons.js spawnsDungeon(WORLD_SALT, px, py), on the relay's copy
 *  of its hash, and SPAWN-THIN's keep on the same second lane? @param {number} px @param {number} py */
export const owSpawnsDungeon = (px, py) => {
  if (!(gateHash(OW_WORLD_SALT, px, py, 1) / 4294967296 < OW_SPAWN_CHANCE)) return false;
  return gateHash(OW_WORLD_SALT, px, py, 3) / 4294967296 < OW_SPAWN_KEEP;
};
/** A row's key in a ledger: its pixel, as the spawn ledger keys it ("px,py"). */
export const owRowKey = (px, py) => `${px},${py}`;
/**
 * Could an honest machine say this row? Its shape (net/wire.js owWireRow), a pixel whose roll holds a spawn, and a clear
 * no earlier than its first entry. One that could not is junk, and struck - never merely dropped.
 * @param {unknown} r
 */
export function owRowSane(r) {
  const w = owWireRow(r);
  return !!w && owSpawnsDungeon(w[0], w[1]) && (w.length < 4 || w[3] >= w[2]);
}
/**
 * A row as the ledger may take it at the shared clock `nowMin` (classic minutes): sane, of a spawn that has not stood
 * again by nowMin (SPAWN-REBIRTH: owRowUntil past nowMin - it was a first sight inside sixty real days), its first entry
 * no later than nowMin and its clear inside [seen, nowMin] - a clock up to OW_ROW_SLACK_MIN ahead is taken at nowMin
 * (never later: the merge keeps the earliest, and the relay's now is the latest any clock can mean) - or null (out of
 * its time: dropped, never struck - a stale save, a life that is over, a clock at the edge).
 * @param {unknown} r @param {number} nowMin @returns {number[]|null}
 */
export function owRowFits(r, nowMin) {
  if (!owRowSane(r) || !Number.isFinite(nowMin)) return null;
  const w = owWireRow(r);
  const [px, py, seen, cleared = null] = w;
  if (owRowUntil(w) <= nowMin || seen > nowMin + OW_ROW_SLACK_MIN) return null;
  if (cleared !== null && cleared > nowMin + OW_ROW_SLACK_MIN) return null;
  const s = Math.min(seen, nowMin);
  return cleared === null ? [px, py, s] : [px, py, s, Math.min(cleared, nowMin)];
}

// ═══ THE LEDGER ══════════════════════════════════════════════════════════════════════════════════

/**
 * A cell's ledger: `sp` the spent ids in the order they were taken, each with the moment (ms) it stops mattering;
 * `dg` the rows by their key, each the wire's own row; `gr` (GRAVE-PARTY) the graves searched, by grave and searcher,
 * each the wire's own `[px, py, n, minute, acct, name]`.
 * @typedef {{ sp: Array<[string, number]>, dg: Record<string, number[]>, gr: Record<string, Array<number|string>> }} OwLedger
 */

/** An empty ledger. @returns {OwLedger} */
export const newOwLedger = () => ({ sp: [], dg: {}, gr: {} });
/** Does a ledger hold nothing? @param {OwLedger} led */
export const owLedgerEmpty = (led) => !led || (!led.sp.length && !Object.keys(led.dg).length && !Object.keys(led.gr ?? {}).length);
/** The oldest first entries out, down to OW_CELL_ROWS_MAX; answers whether any went. @param {OwLedger} led */
function capRows(led) {
  const keys = Object.keys(led.dg);
  if (keys.length <= OW_CELL_ROWS_MAX) return false;
  keys.sort((a, b) => led.dg[a][2] - led.dg[b][2]);
  for (const k of keys.slice(0, keys.length - OW_CELL_ROWS_MAX)) delete led.dg[k];
  return true;
}
/**
 * A stored ledger read back - a FRESH object holding its well-formed entries alone (each id once, each row sane, the
 * bounds kept), or an empty one. The relay reads its storage through it, and writes a copy through it (the runtime keeps
 * what was put, never the instance's live object).
 * @param {unknown} v @returns {OwLedger}
 */
export function owLedgerOf(v) {
  const led = newOwLedger();
  if (!v || typeof v !== 'object') return led;
  const src = /** @type {{sp?: unknown, dg?: unknown}} */ (v);
  const ids = new Set();
  for (const e of Array.isArray(src.sp) ? src.sp : []) {
    if (!Array.isArray(e) || !owIdKind(e[0]) || !Number.isFinite(e[1]) || ids.has(e[0])) continue;
    ids.add(e[0]);
    led.sp.push([e[0], e[1]]);
  }
  led.sp = led.sp.slice(-OW_CELL_SPENT_MAX);
  for (const r of src.dg && typeof src.dg === 'object' ? Object.values(src.dg) : []) {
    const w = owWireRow(r);
    if (w && owRowSane(w)) led.dg[owRowKey(w[0], w[1])] = w;
  }
  capRows(led);
  const gsrc = /** @type {{gr?: unknown}} */ (v).gr;   // GRAVE-PARTY
  for (const r of gsrc && typeof gsrc === 'object' ? Object.values(gsrc) : []) { const g = owGraveOut(r); if (g) led.gr[owGraveKey(g)] = g; }
  capGraves(led);
  return led;
}

// ═══ THE GRAVES (GRAVE-PARTY) ════════════════════════════════════════════════════════════════════
//
// (FIELD BUGS 2026-10-16b, "graveyard loot on headstones are able to be looted by others"; Mac's SEARCH1-PARTY: "When one
// player in the party interacted with it no one else can again for 5 hours".) A headstone's search was its searcher's
// game's alone - the act channel is a world room's, and a street cell is not one - so a partymate searched the same stone
// again and found again. The cell keeps who searched which stone now: one row a stone and a SEARCHER, its minute the
// relay's own (the shared clock, never the word's), its account the token's subject and its name the token's character's
// (AUDIT GRAVE-PARTY G5: the lock is the account's, and another character of it is told whose search it was) - kept
// OW_GRAVE_KEEP_MIN and not a minute past it. The relay knows no party: every game in the cell hears every row, and each
// locks the stones its own party searched (systems/searchables.js searchKinOf) - a stranger's row locks nothing of theirs.

/** A grave row's key in a ledger: its stone and its searcher. @param {Array<number|string>} g */
export const owGraveKey = (g) => `${g[0]},${g[1]}|${g[2]}|${g[4]}`;
/** Is a grave row still inside its search's hours at `nowMin`? @param {Array<number|string>} g @param {number} nowMin */
export const owGraveLive = (g, nowMin) => Number.isFinite(nowMin) && nowMin - /** @type {number} */ (g[3]) < OW_GRAVE_KEEP_MIN;
/**
 * THE BOUNDS (AUDIT GRAVE-PARTY G3): each searcher's own oldest out past OW_GRAVE_ACCT_ROWS_MAX; then, past
 * OW_CELL_GRAVES_MAX, the oldest of whichever searcher holds the MOST - so no searcher's rows push out another's while
 * it holds more of the cell than they do (the oldest in the cell went, and one account's fresh stone numbers evicted
 * every honest row). Answers whether any went. @param {OwLedger} led
 */
function capGraves(led) {
  const age = (k) => /** @type {number} */ (led.gr[k][3]);
  const by = new Map();
  for (const [k, g] of Object.entries(led.gr)) { const l = by.get(g[4]); if (l) l.push(k); else by.set(g[4], [k]); }
  let total = 0, dropped = false;
  for (const keys of by.values()) {
    keys.sort((a, b) => age(a) - age(b));   // stable: one minute's rows in the order they were taken
    while (keys.length > OW_GRAVE_ACCT_ROWS_MAX) { delete led.gr[/** @type {string} */ (keys.shift())]; dropped = true; }
    total += keys.length;
  }
  for (; total > OW_CELL_GRAVES_MAX; total--) {
    let most = null;
    for (const keys of by.values()) if (!most || keys.length > most.length || (keys.length === most.length && age(keys[0]) < age(most[0]))) most = keys;
    delete led.gr[/** @type {string} */ (/** @type {string[]} */ (most).shift())];
    dropped = true;
  }
  return dropped;
}
/**
 * THE GRAVES, FOLDED IN: each stone the word names, searched by `acct` (its character `name`, the token's - '' where none)
 * at the relay's `nowMin` - a stone this searcher's row already holds inside its hours changes nothing (a search is the
 * earliest of its hours); the rows past their hours let go first, then the bounds (capGraves: the searcher's own oldest
 * past OW_GRAVE_ACCT_ROWS_MAX, the heaviest searcher's past OW_CELL_GRAVES_MAX). Answers the rows taken - what the cell
 * fans, and all the relay writes for: a word that took nothing writes nothing. No account (a hello the relay could not
 * name), nothing.
 * @param {OwLedger} led @param {unknown} rows @param {unknown} acct @param {number} nowMin @param {unknown} [name] @returns {Array<Array<number|string>>}
 */
export function owFoldGraves(led, rows, acct, nowMin, name = '') {
  const taken = [];
  if (!led || !Array.isArray(rows) || typeof acct !== 'string' || !acct || acct.length > OW_GRAVE_ACCT_MAX || !Number.isFinite(nowMin) || nowMin < 0) return taken;
  const who = typeof name === 'string' && name.length <= NAME_MAX ? name : '';
  for (const [k, g] of Object.entries(led.gr)) if (!owGraveLive(g, nowMin)) delete led.gr[k];
  for (const r of rows.slice(0, OW_WORD_ROWS_MAX)) {
    const w = owGraveIn(r);
    if (!w) continue;
    const g = [...w, nowMin, acct, who], k = owGraveKey(g);
    if (led.gr[k]) continue;
    led.gr[k] = g;
    taken.push(g.slice());
  }
  capGraves(led);
  return taken.filter((g) => led.gr[owGraveKey(g)]);
}

/**
 * THE SPENT, FOLDED IN: each id of a live life the ledger does not hold is taken (its end the life after its own), the
 * spent past their end let go first and the oldest past OW_CELL_SPENT_MAX after. Answers the ids newly taken - what the
 * cell fans. An id already held, or of another life, changes nothing.
 * @param {OwLedger} led @param {unknown} ids @param {number} nowMs @returns {string[]}
 */
export function owFoldSpent(led, ids, nowMs) {
  const added = [];
  if (!led || !Array.isArray(ids) || !Number.isFinite(nowMs)) return added;
  led.sp = led.sp.filter((e) => e[1] > nowMs);
  const held = new Set(led.sp.map((e) => e[0]));
  for (const id of ids.slice(0, OW_WORD_IDS_MAX)) {
    if (!owIdLive(id, nowMs) || held.has(id)) continue;
    held.add(id);
    led.sp.push([id, owIdUntil(id)]);
    added.push(id);
  }
  if (led.sp.length > OW_CELL_SPENT_MAX) led.sp.splice(0, led.sp.length - OW_CELL_SPENT_MAX);
  return added;
}

/**
 * THE ROWS, FOLDED IN - MIN-MERGE: each row that fits its time (owRowFits) keeps the earliest first entry and the
 * earliest clear the ledger has ever heard for its pixel; a row it has never held is taken whole. Rows whose spawn has
 * stood again are let go first (SPAWN-REBIRTH: so every row that fits is of the life the ledger holds, or of a pixel it
 * holds none for - one that fits stood no earlier than the held one's end, which is past), and the oldest first entries
 * past OW_CELL_ROWS_MAX after. Answers the rows that CHANGED, as they stand now (each pixel once) - what the cell fans; a
 * row that told the ledger nothing new is not among them.
 * @param {OwLedger} led @param {unknown} rows @param {number} nowMin @returns {number[][]}
 */
export function owFoldRows(led, rows, nowMin) {
  const changed = new Map();
  if (!led || !Array.isArray(rows) || !Number.isFinite(nowMin)) return [];
  for (const [k, r] of Object.entries(led.dg)) if (owRowUntil(r) <= nowMin) delete led.dg[k];
  for (const r of rows.slice(0, OW_WORD_ROWS_MAX)) {
    const w = owRowFits(r, nowMin);
    if (!w) continue;
    const k = owRowKey(w[0], w[1]);
    const had = led.dg[k];
    const wc = w.length > 3 ? w[3] : null, hc = had && had.length > 3 ? had[3] : null;
    const seen = had ? Math.min(had[2], w[2]) : w[2];
    const cleared = hc === null ? wc : wc === null ? hc : Math.min(hc, wc);
    if (had && seen === had[2] && cleared === hc) continue;   // nothing new: never raised, never re-said
    const row = cleared === null ? [w[0], w[1], seen] : [w[0], w[1], seen, cleared];
    led.dg[k] = row;
    changed.set(k, row);
  }
  capRows(led);
  return [...changed].filter(([k]) => led.dg[k]).map(([, row]) => row.slice());
}

/**
 * THE SPEAKER'S ANSWER: the ledger's own rows for the pixels a word named where the WORD WAS BEHIND them - a later first
 * sight, or a clear it lacked or had later - less those the fold just moved (the fan says those, to the speaker too).
 * So a machine that forgot a spawn and met it again is told the clocks the cell already holds (RAID3's law: a word
 * that moves nothing is answered to its speaker alone).
 * @param {OwLedger} led @param {unknown} rows @param {number[][]} [changed] @returns {number[][]}
 */
export function owRowsBehind(led, rows, changed = []) {
  const moved = new Set(changed.map((r) => owRowKey(r[0], r[1])));
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows.slice(0, OW_WORD_ROWS_MAX) : []) {
    const w = owWireRow(r);
    if (!w) continue;
    const k = owRowKey(w[0], w[1]);
    const held = led?.dg?.[k];
    if (!held || moved.has(k) || out.has(k)) continue;
    const wc = w.length > 3 ? w[3] : null, hc = held.length > 3 ? held[3] : null;
    if (held[2] < w[2] || (hc !== null && (wc === null || hc < wc))) out.set(k, held.slice());
  }
  return [...out.values()];
}

/**
 * The ledger PRUNED at the shared clock `nowMs`: the spent past their end, the rows whose spawn has stood again, and the
 * bounds.
 * Answers whether anything went (the relay writes it back).
 * @param {OwLedger} led @param {number} nowMs
 */
export function owPrune(led, nowMs) {
  if (!led || !Number.isFinite(nowMs)) return false;
  const nowMin = sharedClassicMinutes(nowMs);
  const sp = led.sp.filter((e) => e[1] > nowMs).slice(-OW_CELL_SPENT_MAX);
  let dropped = sp.length !== led.sp.length;
  led.sp = sp;
  for (const [k, r] of Object.entries(led.dg)) if (owRowUntil(r) <= nowMin) { delete led.dg[k]; dropped = true; }
  led.gr ??= {};
  for (const [k, g] of Object.entries(led.gr)) if (!owGraveLive(g, nowMin)) { delete led.gr[k]; dropped = true; }   // GRAVE-PARTY: a search past its hours
  const capped = capGraves(led);
  return capRows(led) || capped || dropped;
}

/**
 * THE WELCOME'S `ow`: `{ sp: [ids], dg: [[px, py, seen, cleared?], ...] }` - the spent still mattering and the rows
 * still kept at `nowMs`, inside the cell's bounds - and `gr` (GRAVE-PARTY), the graves searched inside their hours, when
 * there are any. Pure: the ledger is not touched.
 * @param {OwLedger} led @param {number} nowMs @returns {{sp: string[], dg: number[][], gr?: Array<Array<number|string>>}}
 */
export function toWelcome(led, nowMs) {
  const nowMin = sharedClassicMinutes(nowMs);
  const sp = (led?.sp ?? []).filter((e) => e[1] > nowMs).slice(-OW_CELL_SPENT_MAX).map((e) => e[0]);
  const dg = Object.values(led?.dg ?? {}).filter((r) => owRowUntil(r) > nowMin).slice(0, OW_CELL_ROWS_MAX).map((r) => r.slice());
  const gr = Object.values(led?.gr ?? {}).filter((g) => owGraveLive(g, nowMin)).slice(0, OW_CELL_GRAVES_MAX).map((g) => g.slice());
  return gr.length ? { sp, dg, gr } : { sp, dg };
}
