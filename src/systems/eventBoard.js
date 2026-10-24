// @ts-check
// EVENTS1 (2026-10-23, the owner, over the Discord threads "Make announcements for Fallen Stars and Town Raids" and
// "Things are starting to get worse": "On the topic of event notifications. Instead of stuffing these in the chat menu,
// there must be a less obstructive and more detailed way to handle them"): THE EVENT BOARD'S LAW.
// Design: bible/10-UI/Event-Board.md; its audit, bible/01-Overview/audits/Audit-Event-Board.md.
//
// WHAT WAS WRONG. Every shared event spoke in sentences on the chat's every tab (net/chat.js pushAll), between the
// players' own lines, and said each thing once: a reader who missed the line had the Timers window under the pause
// menu and nothing else. And two of them spoke too late to act on. A fallen star's omen and its landing were said to its
// own region alone, 90 seconds before it fell, while its hold was said to everyone - so a player anywhere else heard of
// a star only once it was taken. A town raid was said to its region as it began, and stood on the map only while it
// ran: ten real minutes, against a fast travel of five.
//
// WHAT THIS IS. The same schedule the Timers window reads (systems/eventTimers.js eventTimerRows, off the host's one
// source), cut to what a player can still reach: each shared event under way, or starting within EVENT_SOON_MS, with
// where it is, how far and which way from where the player stands, and the time left. A small board on the HUD
// (ui/eventBoard.js) draws it; its NEWS - a CARD, in this module's words - opens at its head when an event first comes
// onto it and when it begins (an ANNOUNCEMENT: the board's own, never the chat's), and the events' own lines - the gate's
// omen, the star's hold, a raid's cleansing - ride that news as its notes (systems/eventNotices.js, the one door)
// instead of the chat.
//
// AUDIT EVENTS1 (bible/01-Overview/audits/Audit-Event-Board.md): a line comes with its event's id where its kind has
// more than one event at a time (a star, a raid), and is shown with that event or alone - never with another's (A1); a
// row carries the moment it came onto the board by its own law (`since`), so what stood before the board first read the
// world is no news however late the source filled in (A5); an event no one can join is left out (A6); the gate's, the
// serpent's and the Abyss Dungeon's rows are said in the player's language (W3), and a raid's party too (W2).
//
// PURE: no globals, no clock of its own; the host hands the source (`now`, the relay's), the door hands the notes. Not a
// DFU member - DFU has no shared events. Ledger A (EVENTS1).
import { eventTimerRows } from './eventTimers.js';
import { PIXEL_M, gateTimes } from '../net/gate/gateLaw.js';
import { serpentTimes, serpentBossOf } from '../net/serpent/serpentLaw.js';
import { starTimes } from '../net/starfall/starfallLaw.js';
import { STAR_WARN_MS } from './starfall/starfallClient.js';
import { t } from './textManager.js';

/** The kinds the board carries: the world's shared events. The resets, the seat week and a company's Elite Breach stay
 *  the Timers window's alone - they are schedules, not places to go. */
export const EVENT_BOARD_KINDS = Object.freeze(['gate', 'serpent', 'super', 'star', 'raid']);
/** AUDIT EVENTS1 A1: the kinds with one event at a time - a line of theirs needs no id to find its event. A star and a
 *  raid have several at once, so their lines name theirs (eventNotice's `id`). */
export const EVENT_SINGLE_KINDS = Object.freeze(['gate', 'serpent', 'super', 'festival']);
/** An event coming is on the board from this long before it starts - a fast travel's five minutes and the walk after it. */
export const EVENT_SOON_MS = 15 * 60_000;
/** The board's rows at most on a desk's screen; the rest are counted ("2 more in Timers"). A tall screen stands four
 *  (ui/eventBoard.js eventRowsFor), and the plate stands fewer where its room is less (ui/eventBoard.js eventFitRows). */
export const EVENT_BOARD_ROWS = 3;
/** The raids among them at most - the nearest. The day rolls about twenty-two across the Bay. */
export const EVENT_BOARD_RAIDS = 2;
/** A raid is announced (its card) where the player stands in its region - the mod's own rule (systems/raidingParties.js
 *  fix 8, and AUDIT CAPTAIN'S SEA G7's: none past the Veil - the host hands that region, scenes/world.js) - or this near
 *  it. The board lists the nearest raids wherever the player is. */
export const EVENT_RAID_REACH_M = 25_000;
/** A card stands this long once it is shown (its clock stops while the HUD is hidden). */
export const EVENT_TOAST_MS = 9000;
/** AUDIT EVENTS1 A7: a line that joins a card already standing is given at least this long of its own. */
export const EVENT_NOTE_MIN_MS = 5000;
/** The cards shown at once (the board's one news); the rest wait their turn. */
export const EVENT_TOASTS_SHOWN = 1;
/** The cards kept waiting at most - past it a waiting card goes, one with no line of its event's first (C4). */
export const EVENT_TOASTS_KEPT = 6;
/** A card's notes at most. */
export const EVENT_TOAST_NOTES = 3;
/** A note said again within this long is the same note (a line said on two doors). */
export const EVENT_NOTE_SAME_MS = 60_000;
/** AUDIT EVENTS1 A5: a row whose event came onto the board this long before the board first read the world is still
 *  news (the read is 500 ms apart, the relay's word a moment behind its clock). */
export const EVENT_SEED_GRACE_MS = 5000;

/** A card's heading per kind - what the event is, before what it says. */
export const EVENT_KIND_TEXT = Object.freeze({
  gate: () => t('events.kind.gate', 'Dagon\'s Breach'),
  serpent: () => t('events.kind.serpent', 'Sea Serpent'),
  super: () => t('events.kind.super', 'Abyss Dungeon'),
  star: () => t('events.kind.star', 'Starfall'),
  raid: () => t('events.kind.raid', 'Town Raid'),
  festival: () => t('events.kind.festival', 'Witches\' Festival'),
});
/** AUDIT EVENTS1 W2: a raiding party in the player's language (systems/raidingParties.js raidTypeName's words). */
export const EVENT_PARTY_TEXT = Object.freeze({
  orcs: () => t('events.party.orcs', 'Orcs'),
  bandits: () => t('events.party.bandits', 'Bandits'),
  knights: () => t('events.party.knights', 'Knights'),
});
/** The board's and the cards' own words. */
export const EVENT_BOARD_TEXT = Object.freeze({
  title: () => t('events.board.title', 'World Events'),
  more: (n) => t('events.board.more', '{n, plural, one {1 more in Timers} other {# more in Timers}}', { n }),
  /** A live row's clock and a coming row's. */
  left: (time) => t('events.board.left', '{time} left', { time }),
  starts: (time) => t('events.board.starts', 'in {time}', { time }),
  /** The cards' second line: an event come onto the board, and one begun. */
  soon: () => t('events.toast.soon', 'Starting soon'),
  begun: () => t('events.toast.begun', 'Under way'),
  /** Where the player stands on the event's own map pixel. AUDIT EVENTS1 W3: the number the player's language's own. */
  here: () => t('events.way.here', 'Nearby'),
  way: (km, dir) => t('events.way.km', '{km, number} km {dir}', { km, dir }),
  /** AUDIT EVENTS1 W3: where the gate, the serpent and the Abyss Dungeon stand, and what each row says. */
  near: (place) => t('events.where.near', 'Near {place}', { place }),
  off: (place) => t('events.where.off', 'Off {place}', { place }),
  gateOpens: () => t('events.gate.opens', 'Dagon\'s Breach opens'),
  gateOpen: () => t('events.gate.open', 'Dagon\'s Breach is open'),
  gateSoon: () => t('events.gate.soon', 'Its omen burns in the sky'),
  gateLive: () => t('events.gate.live', 'It seals when this runs out'),
  serpentRises: (boss) => t('events.serpent.rises', '{boss} rises', { boss }),
  serpentHunts: (boss) => t('events.serpent.hunts', '{boss} hunts', { boss }),
  serpentSoon: () => t('events.serpent.soon', 'The harbor bells are ringing'),
  serpentLive: () => t('events.serpent.live', 'It dives when this runs out'),
  superStands: (name) => t('events.super.stands', '{name} stands', { name }),
  superLive: () => t('events.super.live', 'It fades away unbeaten when this runs out'),
  /** A raid's rows. */
  raid: (town) => t('events.raid.title', 'Raid on {town}', { town }),
  raidComing: (party) => t('events.raid.coming', '{party} gather to attack', { party }),
  raidLive: (party) => t('events.raid.live', '{party} attacking', { party }),
  raidCount: (n, of) => t('events.raid.count', 'Raiders down: {n} of {of}', { n, of }),
  /** A news said where the board has no room for it (ui/eventBoard.js): its heading and its row, one line. */
  alone: (kind, title, clock) => t('events.news.alone', '{kind}: {title}, {clock}', { kind, title, clock }),
});
/** The eight ways, clockwise from north. */
const DIRS = Object.freeze([
  () => t('events.dir.n', 'N'), () => t('events.dir.ne', 'NE'), () => t('events.dir.e', 'E'), () => t('events.dir.se', 'SE'),
  () => t('events.dir.s', 'S'), () => t('events.dir.sw', 'SW'), () => t('events.dir.w', 'W'), () => t('events.dir.nw', 'NW'),
]);

/** Live first, then coming; each soonest first (the Timers window's order). */
const byTime = (a, b) => (a.live === b.live ? a.at - b.at : a.live ? -1 : 1);
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isPixel = (p) => !!p && Number.isFinite(p.px) && Number.isFinite(p.py);
/** The number an id ends on (`gate:812` -> 812), NaN where it has none. */
const idNumber = (id) => Number(String(id).split(':')[1]);

/**
 * THE WAY TO AN EVENT from the player's map pixel (`from`: `{ x, y }`, the travel map's - x east, y south) to the
 * event's (`to`: `{ px, py }`): `{ m, dir, text }` - the metres between the pixels' hearts (a pixel is PIXEL_M), the
 * compass word ('NE'), and the board's words ("12 km NE", "Nearby" on the same pixel). Tenths under 10 km and whole
 * kilometres past it, by the rounded value (AUDIT EVENTS1 A10: 9,966 m is "10 km", never "10.0 km"). Null where either
 * is unknown.
 * @param {{ x: number, y: number } | null | undefined} from
 * @param {{ px: number, py: number } | null | undefined} to
 */
export function eventWay(from, to) {
  if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.y) || !isPixel(to)) return null;
  const dx = (/** @type {any} */ (to).px - from.x) * PIXEL_M, dy = (/** @type {any} */ (to).py - from.y) * PIXEL_M;
  const m = Math.hypot(dx, dy);
  if (m < 1) return { m: 0, dir: '', text: EVENT_BOARD_TEXT.here() };
  const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;   // 0 north, clockwise (y runs south)
  const dir = DIRS[Math.round(deg / 45) % 8]();
  const tenths = Math.round(m / 100) / 10;
  const km = tenths < 10 ? tenths : Math.round(m / 1000);
  return { m, dir, text: EVENT_BOARD_TEXT.way(km, dir) };
}

/** A raid as the board reads one (systems/raidingParties.js raidTimerList): its row, with its way and whether it is
 *  the player's to be told of. Its id is its raid's key (raidingParties.js raidKey), the id its lines come with. */
function raidRow(r, now, src, soonMs) {
  const way = eventWay(src?.pixel, r);
  const type = String(r.type ?? '');
  const party = EVENT_PARTY_TEXT[type]?.() ?? (capital(type) || null);
  const live = r.startMs <= now;
  const count = live && Number.isFinite(r.n) && Number.isFinite(r.tg) && r.tg > 0 ? EVENT_BOARD_TEXT.raidCount(Math.min(r.n, r.tg), r.tg) : null;
  return {
    id: r.key ? `raid:${r.key}` : `raid:${r.name}:${r.startMs}`, kind: 'raid', title: EVENT_BOARD_TEXT.raid(r.name), where: r.region || null,
    detail: count ?? (party ? (live ? EVENT_BOARD_TEXT.raidLive(party) : EVENT_BOARD_TEXT.raidComing(party)) : null),
    live, at: live ? r.endMs : r.startMs, way, since: live ? r.startMs : r.startMs - soonMs,
    announce: (!!src?.region && r.region === src.region) || (!!way && way.m <= EVENT_RAID_REACH_M),
  };
}

/**
 * A timer row as the board says it: its place (the source's site, where the row has named one - a row that names no
 * place, the next gate, a star before its warning, is no place to go yet), its words in the player's language (the
 * Timers window keeps its own English), and the moment it came onto the board by its own law (`since`: the gate's omen
 * or its opening, the serpent's bells or its rising, a star's warning or its fall, the Hollow's find).
 */
function timerRow(r, src) {
  const row = { id: r.id, kind: r.kind, title: r.title, where: r.where, detail: r.detail, live: r.live, at: r.at, way: null, since: NaN, announce: true };
  if (r.kind === 'gate') {
    const T = gateTimes(idNumber(r.id)), site = src?.gate?.site;
    Object.assign(row, { title: r.live ? EVENT_BOARD_TEXT.gateOpen() : EVENT_BOARD_TEXT.gateOpens(), detail: r.live ? EVENT_BOARD_TEXT.gateLive() : EVENT_BOARD_TEXT.gateSoon(), since: r.live ? T.openAt : T.omenAt });
    if (r.where && src?.gate?.place) { row.where = EVENT_BOARD_TEXT.near(src.gate.place); row.way = isPixel(site) ? eventWay(src?.pixel, site) : null; }
  } else if (r.kind === 'serpent') {
    const day = idNumber(r.id), T = serpentTimes(day), boss = serpentBossOf(day).name, site = src?.serpent?.site;
    Object.assign(row, { title: r.live ? EVENT_BOARD_TEXT.serpentHunts(boss) : EVENT_BOARD_TEXT.serpentRises(boss), detail: r.live ? EVENT_BOARD_TEXT.serpentLive() : EVENT_BOARD_TEXT.serpentSoon(), since: r.live ? T.riseAt : T.omenAt });
    if (r.where && src?.serpent?.place) { row.where = EVENT_BOARD_TEXT.off(src.serpent.place); row.way = isPixel(site) ? eventWay(src?.pixel, site) : null; }
  } else if (r.kind === 'super') {
    const site = src?.sd?.site, place = src?.sd?.place ?? site?.cityName ?? null, rec = src?.sd?.rec;
    Object.assign(row, { title: EVENT_BOARD_TEXT.superStands(src?.sd?.name || EVENT_KIND_TEXT.super()), detail: EVENT_BOARD_TEXT.superLive(), since: Number.isFinite(rec?.foundAt) ? rec.foundAt : NaN });
    if (r.where && place) { row.where = EVENT_BOARD_TEXT.near(place); row.way = isPixel(site) ? eventWay(src?.pixel, site) : null; }
  } else if (r.kind === 'star') {
    const [n, k] = String(r.id).slice(5).split('.').map(Number), T = starTimes(n, k);
    row.since = r.live ? T.fallAt : T.fallAt - STAR_WARN_MS;
    row.way = r.where && isPixel(r) ? eventWay(src?.pixel, /** @type {any} */ (r)) : null;
  }
  return row;
}

/**
 * THE BOARD: what a player can still reach - each shared event under way (counting to its end) or coming within
 * `soonMs` (counting to its start) once its place is said, live first and each soonest first, the nearest `raids` of the
 * day's raids among them, cut to `max` rows (`more` how many more stand; `all` every row, uncut, for
 * eventAnnouncements). An event no one can join any more (the Timers window's `shut`: the gate sealed, a Hollow
 * collapsing) is left out. Each row: `id`, `kind`, `title`, `where`, `detail`, `live`, `at` (the Timers window's, in the
 * player's language), `way` (eventWay, or null), `since` (the moment it came onto the board by its own law, NaN where
 * unknown) and `announce` (whether its coming and its start get a card: every shared event, and a raid only in the
 * player's region or within EVENT_RAID_REACH_M). `src` is the Timers window's source (scenes/world.js timersSource) -
 * with the player's map pixel (`pixel`) and the gate's, the serpent's and the Hollow's sites - or null (offline: no
 * board). Pure.
 * @param {any} src
 * @param {{ soonMs?: number, max?: number, raids?: number }} [o]
 */
export function eventBoardModel(src, { soonMs = EVENT_SOON_MS, max = EVENT_BOARD_ROWS, raids = EVENT_BOARD_RAIDS } = {}) {
  const now = Number(src?.now);
  if (!Number.isFinite(now)) return { rows: [], more: 0, all: [], now: NaN };
  // a coming event is on the board once it says where - the gate's omen, the serpent's bells, a star's warning - so the
  // card that announces it names the place (a row with none yet, the Abyss Dungeon's "not before", is no place to go)
  const near = (r) => r.live || (!!r.where && r.at - now <= soonMs);
  const rows = [];
  for (const r of eventTimerRows({ ...src, raids: null })) {
    if (r.kind === 'raid' || !EVENT_BOARD_KINDS.includes(r.kind) || r.shut || !near(r)) continue;
    rows.push(timerRow(r, src));
  }
  const raidRows = (Array.isArray(src?.raids) ? src.raids : [])
    .filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && !r.done && r.endMs > now && r.startMs - now <= soonMs)
    .map((r) => raidRow(r, now, src, soonMs))
    // the nearest where the player's place is known, else the soonest
    .sort((a, b) => (a.way && b.way ? a.way.m - b.way.m : a.at - b.at));
  rows.push(...raidRows.slice(0, Math.max(0, raids)));
  const all = [...rows.filter((r) => r.kind !== 'raid'), ...raidRows].sort(byTime);
  rows.sort(byTime);
  const cut = Math.max(0, max);
  return { rows: rows.slice(0, cut), more: all.length - Math.min(cut, rows.length), all, now };
}

/**
 * THE ANNOUNCEMENTS a board's change makes: each row that came onto it (`soon` - or `begun` where it came on already
 * under way) and each row that turned live (`begun`), for the rows that announce. `seen` is the caller's own map of
 * row id -> live, kept across reads. `watchFrom` is when the board first read the world (relay ms), null before:
 * AUDIT EVENTS1 A5 - a row first seen is news only if its event came onto the board (`since`) no earlier than
 * EVENT_SEED_GRACE_MS before that, so a page that opens on events already standing is shown the board, never a burst of
 * news for what began before it came, however late each part of the source fills in (the stars' scan, the hub's
 * hello, the omen's settle). A row with no known `since` is never news when first seen - only when it turns live. A
 * row gone is let go. Returns the cards' asks: `{ id, kind, phase: 'soon'|'begun' }`.
 * @param {ReadonlyArray<any>} rows
 * @param {Map<string, boolean>} seen
 * @param {number|null} watchFrom
 */
export function eventAnnouncements(rows, seen, watchFrom) {
  const out = [];
  const here = new Set();
  const watching = watchFrom != null && Number.isFinite(watchFrom);
  for (const r of rows ?? []) {
    here.add(r.id);
    const was = seen.get(r.id);
    seen.set(r.id, !!r.live);
    if (!watching || !r.announce) continue;
    if (was === undefined) {
      if (Number.isFinite(r.since) && r.since >= /** @type {number} */ (watchFrom) - EVENT_SEED_GRACE_MS) out.push({ id: r.id, kind: r.kind, phase: r.live ? 'begun' : 'soon' });
    } else if (!was && r.live) out.push({ id: r.id, kind: r.kind, phase: 'begun' });
  }
  // a row gone is let go - so the caller hands EVERY row it read (the model's `all`): one cut by the board's `max` and
  // back on later is the same event, never news
  for (const id of [...seen.keys()]) if (!here.has(id)) seen.delete(id);
  return out;
}

/**
 * THE CARDS: the announcements and the notes, in the order they came, `shown` at a time (the board's one news), each for
 * `lifeMs` of shown time. AUDIT EVENTS1 A1/A7: a card is ONE EVENT's - a note (an event's own line) joins the card of its
 * event (its `id`; a kind with one event at a time, EVENT_SINGLE_KINDS, by its kind), else makes a card of its own; an
 * announcement joins its event's card, or a card of a single kind that is only that kind's lines (the gate's omen line
 * said a moment before its announcement - the same event), and takes its row; never a star's or a raid's line. A line that joins a card already shown is given EVENT_NOTE_MIN_MS of its own. The same note again within
 * EVENT_NOTE_SAME_MS is dropped. Past `kept`, a waiting card goes - one that is only an announcement first, so an
 * event's own line is the last thing lost. `step(dtMs)` ages the cards shown (the caller stops calling it while the HUD
 * is hidden); `cards()` the shown ones, oldest first. Pure: the caller's clock (`nowMs` on each note, for the sameness)
 * and its frame (`step`).
 * @param {{ lifeMs?: number, shown?: number, kept?: number, notes?: number }} [o]
 */
export function createEventToasts({ lifeMs = EVENT_TOAST_MS, shown = EVENT_TOASTS_SHOWN, kept = EVENT_TOASTS_KEPT, notes = EVENT_TOAST_NOTES } = {}) {
  /** @type {Array<{ key: number, kind: string, id: string|null, phase: string|null, notes: string[], age: number }>} */
  let list = [];
  let nextKey = 1;
  /** note text -> when it was last taken */
  const said = new Map();
  const single = (kind) => EVENT_SINGLE_KINDS.includes(kind);
  const isShown = (c) => list.indexOf(c) < shown;
  const make = (kind, id, phase, note) => {
    const c = { key: nextKey++, kind, id, phase, notes: note ? [note] : [], age: 0 };
    list.push(c);
    // past the kept, a WAITING card goes (a shown one finishes its time): the oldest bare announcement, else the oldest
    while (list.length > Math.max(shown, kept)) {
      const waiting = list.slice(shown);
      const bare = waiting.find((x) => !x.notes.length);
      list.splice(list.indexOf(bare ?? waiting[0]), 1);
    }
    return c;
  };
  return {
    /** An announcement (`announce`) or an event's line (`note`). */
    announce({ id, kind, phase }) {
      const c = list.find((x) => x.id === id) ?? (single(kind) ? list.find((x) => x.kind === kind && x.id === null) : null);
      if (c) { c.id = id; c.phase = phase; return c; }
      return make(kind, id, phase, null);
    },
    note(kind, text, nowMs = 0, id = null) {
      const s = String(text ?? '').trim();
      if (!s) return null;
      const last = said.get(s);
      if (Number.isFinite(last) && nowMs - /** @type {number} */ (last) < EVENT_NOTE_SAME_MS) return null;
      said.set(s, nowMs);
      for (const [k, at] of said) if (nowMs - at >= EVENT_NOTE_SAME_MS) said.delete(k);
      const mine = (x) => x.notes.length < notes && (id ? x.id === id : single(kind) && x.kind === kind);
      const c = list.find(mine);
      if (c) {
        if (!c.notes.includes(s)) c.notes.push(s);
        if (isShown(c)) c.age = Math.min(c.age, Math.max(0, lifeMs - EVENT_NOTE_MIN_MS));
        return c;
      }
      return make(kind, id, null, s);
    },
    step(dtMs) {
      const d = Math.max(0, Number(dtMs) || 0);
      for (let i = 0; i < Math.min(shown, list.length); i++) list[i].age += d;
      list = list.filter((c) => c.age < lifeMs);
    },
    /** The shown card taken whole (said elsewhere - ui/eventBoard.js, where the board has no room for it). */
    take(key) { list = list.filter((c) => c.key !== key); },
    cards: () => list.slice(0, shown),
    waiting: () => Math.max(0, list.length - shown),
    clear() { list = []; said.clear(); },
  };
}
