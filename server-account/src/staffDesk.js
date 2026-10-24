// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL3-DESK (2026-10-22, mob picked these at 04:13Z, Moderators' share at 06:28Z; design doc "DFO Staff Panel:
// design") - THE PANEL'S DESK: what a staff member keeps beside the reports.
//
//   - STAFF NOTES: a short shared history on one player, newest first ("warned in person 21 Oct"), every staff member
//     reading and adding, Moderators too (staff_notes).
//   - THE WATCHLIST: each member's own list, and the watch's events - read from what the service already records:
//     logins (the realm seat), big trades and sales, new findings and reports. A Moderator's are logins and new chat
//     reports only, because trades, sales and the other flags are Admin-only data (design doc, Watchlist). Read only from
//     the open panel, never from a login, a trade or a checkpoint (design doc, Server load).
//   - YOUR SETTINGS: one bounded JSON document a member, its keys the design doc's Your settings list (staff_settings).
//   - AND THE ADMINS' DOORS: the server's notice on every board (board.js postNotice), the AI check's scorecard against
//     what staff decided, and the reported board notes (Remove and Restore, board.js moderateNote) and market listings.
//
// NOTHING NEW IS JUDGED: a notice, a note's removal or restoration is the game's own act (board.js), made as this member
// and written in the audit log beside it. Pulling a listing is another door's (the market's).
//
// EVERY LIST PAGES (mob, 19:25Z: "put inf scroll in anything that pull lists"): `from` or `before`, answered `next`.
import { displayName } from './accounts.js';
import { findAccount } from './sanctions.js';
import { postNotice, moderateNote } from './board.js';
import { REALM_PLAYING_S } from './realm.js';
import { FLAG_SEVERITY } from './modAi.js';
import { maskText } from '../../src/net/nameFilter.js';

/** A staff note's longest words. */
export const STAFF_NOTE_MAX = 500;
/** The notes kept a player - the newest; the insert trims past it (the table's retention, 0150). */
export const STAFF_NOTES_KEEP = 200;
/** Notes one page answers. */
export const STAFF_NOTES_PAGE = 25;
/** Players one staff member may watch. */
export const STAFF_WATCH_MAX = 50;
/** How far back the watch's events reach - a day; a `since` older is read as a day ago. */
export const WATCH_WINDOW_S = 24 * 60 * 60;
/** Events one page answers, and the most one source gives a read (the list is ranked whole, then paged, as the cases are). */
export const WATCH_PAGE = 50;
export const WATCH_SOURCE_MAX = 200;
/** A trade or sale this big is an event (gold, or Marks at the market) - starting numbers to tune, not measured ones. */
export const WATCH_BIG_GOLD = 25_000;
export const WATCH_BIG_MARKS = 25_000;
/** A settings document's largest JSON - inside the service's body bound (service.js MAX_BODY_BYTES, 4 KiB) with room for
 *  the body's own wrapper. shortcut: the whole document rides one ordinary body; past it, give the save its own bound. */
export const STAFF_SETTINGS_BYTES = 4000;
/** The scorecard's longest reach, in days, and its default. */
export const AI_SCORE_DAYS_MAX = 90;
export const AI_SCORE_DAYS = 30;
/** Reported notes and listings one page answers. */
export const REPORTED_PAGE = 25;
/** A read of a player's data is written once in this, a member and a view (staff.js STAFF_READ_ROW_S's rule). */
const READ_ROW_S = 10 * 60;

export const DESK_ROUTES = Object.freeze(['/v1/staff/notes', '/v1/staff/notes/add',
  '/v1/staff/watch', '/v1/staff/watch/add', '/v1/staff/watch/remove', '/v1/staff/watch/events',
  '/v1/staff/settings', '/v1/staff/settings/save',
  '/v1/staff/notice', '/v1/staff/ai-score', '/v1/staff/board/reported', '/v1/staff/board/moderate', '/v1/staff/market/reported']);
/** The doors a Moderator may not open (design doc: everything but reports, notes and their own watchlist is Admin's). */
const ADMIN_ONLY = Object.freeze(['/v1/staff/notice', '/v1/staff/ai-score', '/v1/staff/board/reported', '/v1/staff/board/moderate', '/v1/staff/market/reported']);

// ═══ YOUR SETTINGS: the design doc's list, each key's shape. The panel owns what sits inside a list's columns and filters;
// the service bounds the whole and refuses a key the list does not name. The watchlist is its own table, and Hide me is the
// hidden spectator's (the token's mark), so neither is a key here. ═══
const LOOKS = Object.freeze(['ember', 'iliac', '8bit']);
const ORDERS = Object.freeze(['urgent', 'usual']);
const TOPS = Object.freeze([3, 5, 10]);
const isObj = (/** @type {unknown} */ v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** @type {Readonly<Record<string, (v: any) => boolean>>} */
export const SETTINGS_KEYS = Object.freeze({
  // Home: which watches show, their order, and Top 3, 5 or 10 each
  home: (v) => isObj(v) && Object.keys(v).every((k) => k === 'watches') && (v.watches === undefined || (Array.isArray(v.watches) && v.watches.length <= 40
    && v.watches.every((/** @type {any} */ w) => isObj(w) && typeof w.id === 'string' && w.id.length <= 40 && (w.top === undefined || TOPS.includes(w.top)) && (w.show === undefined || typeof w.show === 'boolean')))),
  // Lists: columns, their order, sort and saved filters with a name - by list
  lists: isObj,
  // Order: Most urgent first or the usual order, for the menu, a player's tabs and every list
  order: (v) => isObj(v) && Object.entries(v).every(([k, x]) => ['menu', 'tabs', 'lists'].includes(k) && ORDERS.includes(x)),
  // Look: Ember Watch (the default), Iliac Ledger or 8-bit HUD
  look: (v) => LOOKS.includes(v),
  // Window: size, position, docked or floating, the screen it opens on
  window: isObj,
  // Alerts: which kinds pop up or play a sound, and quiet hours
  alerts: isObj,
  // Follow and nameplates: what a nameplate shows, and how far
  nameplates: isObj,
});

/** A settings document as it is kept, or `{ error }`: an object, every key the list's and its shape, within the bound. */
export function settingsOf(/** @type {unknown} */ doc) {
  if (!isObj(doc)) return { error: 'settings-bad' };
  for (const [k, v] of Object.entries(/** @type {object} */ (doc))) {
    if (!Object.hasOwn(SETTINGS_KEYS, k) || !SETTINGS_KEYS[k](v)) return { error: 'settings-bad' };
  }
  const json = JSON.stringify(doc);
  return new TextEncoder().encode(json).byteLength > STAFF_SETTINGS_BYTES ? { error: 'settings-bad' } : { json };
}

/** A staff note's words: a string, its control characters spaces, trimmed, 1 to STAFF_NOTE_MAX long. */
export const noteText = (/** @type {unknown} */ t) => {
  if (typeof t !== 'string') return null;
  const s = t.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s && s.length <= STAFF_NOTE_MAX ? s : null;
};

/**
 * THE WATCH'S EVENTS for this member: who of their list is playing now (`online` - a login is the realm seat taken, and
 * the service keeps no row a sign-in, so it says who holds a seat now and the panel tells the change), and what happened
 * in (since, until] - chat reports on them, and for an Admin the cases the reviewer opened, the judge's findings, and
 * trades and sales past WATCH_BIG_*. Newest first, each source WATCH_SOURCE_MAX at most. One trip, `row` (a read's audit
 * row) last in it (STAFF-PANEL-SPEED).
 * @param {any} db @param {{ player: any, role: string }} who @param {{ since: number, until: number, nowS: number }} span @param {any} [row]
 */
export async function watchEvents(db, who, { since, until, nowS }, row = null) {
  const me = who.player.id;
  const admin = who.role === 'admin';
  const W = '(SELECT target FROM staff_watch WHERE staff = ?1)';
  const reads = [
    db.prepare('SELECT target FROM staff_watch WHERE staff = ?1').bind(me),
    db.prepare(`SELECT r.player AS sub, p.handle, p.guest_name, MAX(r.lease_at) AS at FROM realm_characters r JOIN players p ON p.id = r.player
      WHERE r.player IN ${W} AND r.lease IS NOT NULL AND r.dead_at IS NULL AND r.lease_at > ?2 GROUP BY r.player`).bind(me, nowS - REALM_PLAYING_S),
    db.prepare(`SELECT r.rowid AS k, r.at, r.reason, c.id AS case_id, c.target AS sub, p.handle, p.guest_name FROM mod_cases c JOIN mod_reports r ON r.case_id = c.id
      JOIN players p ON p.id = c.target WHERE c.target IN ${W} AND r.at > ?2 AND r.at <= ?3 ORDER BY r.at DESC LIMIT ?4`).bind(me, since, until, WATCH_SOURCE_MAX),
  ];
  if (admin) {
    reads.push(
      db.prepare(`SELECT c.id AS k, c.opened_at AS at, c.target AS sub, p.handle, p.guest_name FROM mod_cases c JOIN players p ON p.id = c.target
        WHERE c.target IN ${W} AND c.source = 'review' AND c.opened_at > ?2 AND c.opened_at <= ?3 ORDER BY c.opened_at DESC LIMIT ?4`).bind(me, since, until, WATCH_SOURCE_MAX),
      db.prepare(`SELECT f.id AS k, f.at, f.kind, f.char_id, f.player AS sub, p.handle, p.guest_name FROM realm_findings f JOIN players p ON p.id = f.player
        WHERE f.player IN ${W} AND f.at > ?2 AND f.at <= ?3 ORDER BY f.at DESC LIMIT ?4`).bind(me, since, until, WATCH_SOURCE_MAX),
      // the day's trades by their start (realm_trades_created) - no index by player, and none needed over one day
      db.prepare(`SELECT t.sid AS k, t.created_at AS at, t.a_player, t.b_player, a.handle AS a_handle, a.guest_name AS a_guest, b.handle AS b_handle, b.guest_name AS b_guest,
          COALESCE(json_extract(t.result, '$.a.gold'), 0) + COALESCE(json_extract(t.result, '$.b.gold'), 0) AS gold,
          COALESCE(json_array_length(t.result, '$.a.items'), 0) + COALESCE(json_array_length(t.result, '$.b.items'), 0) AS items
        FROM realm_trades t LEFT JOIN players a ON a.id = t.a_player LEFT JOIN players b ON b.id = t.b_player
        WHERE t.created_at > ?2 AND t.created_at <= ?3 AND t.state = 'done' AND (t.a_player IN ${W} OR t.b_player IN ${W})
          AND COALESCE(json_extract(t.result, '$.a.gold'), 0) + COALESCE(json_extract(t.result, '$.b.gold'), 0) >= ?5
        ORDER BY t.created_at DESC LIMIT ?4`).bind(me, since, until, WATCH_SOURCE_MAX, WATCH_BIG_GOLD),
      // a sale, by each side's own index (seller, at) and (buyer, ...) - never an OR across them, which reads the table
      db.prepare(`SELECT * FROM (
          SELECT 'seller' AS side, s.seller AS sub, s.buyer AS other, s.buyer || ':' || s.rid AS k, s.at, s.total, s.currency, s.units, s.kind, s.material FROM market_sales s
            WHERE s.seller IN ${W} AND s.at > ?2 AND s.at <= ?3 AND s.total >= CASE s.currency WHEN 'gold' THEN ?5 ELSE ?6 END
          UNION ALL
          SELECT 'buyer', s.buyer, s.seller, s.buyer || ':' || s.rid, s.at, s.total, s.currency, s.units, s.kind, s.material FROM market_sales s
            WHERE s.buyer IN ${W} AND s.at > ?2 AND s.at <= ?3 AND s.total >= CASE s.currency WHEN 'gold' THEN ?5 ELSE ?6 END
        ) x LEFT JOIN (SELECT id, handle, guest_name FROM players) p ON p.id = x.sub LEFT JOIN (SELECT id AS oid, handle AS o_handle, guest_name AS o_guest FROM players) o ON o.oid = x.other
        ORDER BY x.at DESC LIMIT ?4`).bind(me, since, until, WATCH_SOURCE_MAX, WATCH_BIG_GOLD, WATCH_BIG_MARKS),
    );
  }
  const got = (await db.batch(row ? [...reads, row] : reads)).slice(0, reads.length).map((/** @type {any} */ r) => r?.results ?? []);
  const [list, on, reports, cases = [], flags = [], trades = [], sales = []] = got;
  const watched = new Set(list.map((/** @type {any} */ w) => w.target));
  const name = (/** @type {any} */ r) => displayName(r);
  /** @type {any[]} */
  const events = [
    ...reports.map((/** @type {any} */ r) => ({ id: `report:${r.k}`, kind: 'report', at: r.at, sub: r.sub, name: name(r), reason: r.reason, case: r.case_id })),
    ...cases.map((/** @type {any} */ c) => ({ id: `case:${c.k}`, kind: 'case', at: c.at, sub: c.sub, name: name(c), case: c.k })),
    ...flags.map((/** @type {any} */ f) => ({ id: `flag:${f.k}`, kind: 'flag', at: f.at, sub: f.sub, name: name(f), flag: f.kind, character: f.char_id })),
    // a trade between two watched players is an event for each
    ...trades.flatMap((/** @type {any} */ t) => [['a', 'b'], ['b', 'a']].filter(([s]) => watched.has(t[`${s}_player`])).map(([s, o]) => ({
      id: `trade:${t.k}:${s}`, kind: 'trade', at: t.at, sub: t[`${s}_player`], name: displayName({ handle: t[`${s}_handle`], guest_name: t[`${s}_guest`] }),
      with: t[`${o}_player`], withName: displayName({ handle: t[`${o}_handle`], guest_name: t[`${o}_guest`] }), gold: Number(t.gold), items: Number(t.items),
    }))),
    ...sales.map((/** @type {any} */ s) => ({
      id: `sale:${s.k}:${s.side}`, kind: 'sale', at: s.at, sub: s.sub, name: name(s), side: s.side, with: s.other, withName: displayName({ handle: s.o_handle, guest_name: s.o_guest }),
      total: s.total, currency: s.currency, units: s.units, what: s.material ?? s.kind,
    })),
  ];
  events.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { online: on.map((/** @type {any} */ o) => ({ sub: o.sub, name: name(o), at: o.at })), events };
}

/**
 * HOME'S ROLL-UP of the watchlist (COMMON contract, the status builder's registry): the watched players with something in
 * the last day, most urgent first - high a new finding or a case the reviewer opened, medium a chat report or a big trade
 * or sale, low only playing now - with the words that say why.
 */
export const HOME_WATCH = Object.freeze({
  id: 'watchlist',
  label: 'Watchlist',
  role: 'moderator',
  /** @param {any} ctx @param {any} _env @param {{ player: any, role: string }} who @param {number} n */
  async top(ctx, _env, who, n) {
    const { db, nowS } = ctx;
    const { online, events } = await watchEvents(db, who, { since: nowS - WATCH_WINDOW_S, until: nowS, nowS });
    /** @type {Map<string, { sub: string, name: string, rank: number, at: number, counts: Record<string, number> }>} */
    const by = new Map();
    const of = (/** @type {string} */ sub, /** @type {string} */ nm) => {
      let e = by.get(sub);
      if (!e) by.set(sub, e = { sub, name: nm, rank: 0, at: 0, counts: {} });
      return e;
    };
    const RANK = /** @type {Record<string, number>} */ ({ flag: 2, case: 2, report: 1, trade: 1, sale: 1 });
    for (const ev of events) {
      const e = of(ev.sub, ev.name);
      e.rank = Math.max(e.rank, RANK[ev.kind] ?? 0);
      e.at = Math.max(e.at, ev.at);
      e.counts[ev.kind] = (e.counts[ev.kind] ?? 0) + 1;
    }
    for (const o of online) { const e = of(o.sub, o.name); e.at = Math.max(e.at, o.at); e.counts.online = 1; }
    const WORDS = /** @type {Record<string, [string, string]>} */ ({ online: ['online now', 'online now'], flag: ['finding', 'findings'], case: ['AI check case', 'AI check cases'],
      report: ['report', 'reports'], trade: ['big trade', 'big trades'], sale: ['big sale', 'big sales'] });
    const all = [...by.values()].sort((a, b) => b.rank - a.rank || b.at - a.at);
    const LEVEL = ['low', 'medium', 'high'];
    return {
      items: all.slice(0, n).map((e) => ({
        level: LEVEL[e.rank], sub: e.sub, name: e.name,
        why: Object.entries(e.counts).map(([k, c]) => (k === 'online' ? WORDS.online[0] : `${c} ${WORDS[k][c === 1 ? 0 : 1]}`)).join(' · '),
      })),
      high: all.filter((e) => e.rank === 2).length,
      total: all.length,
    };
  },
});

/**
 * THE DESK'S DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffDesk(ctx, env, path, body, who, audit) {
  const { db, nowS, rand } = ctx;
  const me = who.player;
  if (ADMIN_ONLY.includes(path) && who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();   // staff.js `denied`'s row
    return { error: 'staff-admin' };
  }

  // ═══ STAFF NOTES - every staff member (mob, 06:28Z) ═══
  if (path === '/v1/staff/notes' || path === '/v1/staff/notes/add') {
    const row = await findAccount(db, { target: body.target, name: body.name });
    if ('error' in row) return row;
    if (path === '/v1/staff/notes/add') {
      const text = noteText(body.text);
      if (!text) {
        // a refused act is written down failed (STAFF-PANEL3-DESK FIX, flaw review) - still never the words
        await audit('note-add', row.id, { name: displayName(row), error: 'note-text' }, { outcome: 'failed' }).run();
        return { error: 'note-text' };
      }
      const [, , made] = await db.batch([
        db.prepare('INSERT INTO staff_notes (target, author, author_name, text, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(row.id, me.id, displayName(me), text, nowS),
        // the table's retention: the newest STAFF_NOTES_KEEP a player
        db.prepare('DELETE FROM staff_notes WHERE target = ?1 AND id NOT IN (SELECT id FROM staff_notes WHERE target = ?1 ORDER BY id DESC LIMIT ?2)').bind(row.id, STAFF_NOTES_KEEP),
        db.prepare('SELECT id FROM staff_notes WHERE target = ?1 ORDER BY id DESC LIMIT 1').bind(row.id),
        audit('note-add', row.id, { name: displayName(row) }),   // never the note's words: the log keeps acts, not text
      ]);
      const id = made.results?.[0]?.id ?? null;
      return { ok: true, note: { id, at: nowS, by: me.id, byName: displayName(me), text } };
    }
    const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : null;
    // STAFF-PANEL-SPEED (mob: "slow when moving in menus"): the page and its audit row in one batch, one trip
    const [found] = await db.batch([db.prepare('SELECT id, author, author_name, text, at FROM staff_notes WHERE target = ?1 AND (?2 IS NULL OR id < ?2) ORDER BY id DESC LIMIT ?3')
      .bind(row.id, before, STAFF_NOTES_PAGE + 1), audit('notes-read', row.id, { name: displayName(row) }, { onceIn: READ_ROW_S })]);
    const r = found?.results ?? [];
    const page = r.slice(0, STAFF_NOTES_PAGE);
    return {
      target: row.id, name: displayName(row),
      notes: page.map((n) => ({ id: n.id, at: n.at, by: n.author, byName: n.author_name, text: n.text })),
      next: r.length > STAFF_NOTES_PAGE ? page[page.length - 1].id : null,
    };
  }

  // ═══ THE WATCHLIST - each member's own (mob, 06:28Z) ═══
  if (path === '/v1/staff/watch') {
    const [found] = await db.batch([db.prepare(`SELECT w.target, w.at, p.handle, p.guest_name FROM staff_watch w JOIN players p ON p.id = w.target WHERE w.staff = ?1
      ORDER BY w.at DESC, w.target LIMIT ?2`).bind(me.id, STAFF_WATCH_MAX), audit('watch-read', null, null, { onceIn: READ_ROW_S })]);   // STAFF-PANEL-SPEED: one trip
    const r = found?.results ?? [];
    return { watch: r.map((w) => ({ sub: w.target, name: displayName(w), at: w.at })), max: STAFF_WATCH_MAX, next: null };   // one page: the list is bounded
  }
  if (path === '/v1/staff/watch/add' || path === '/v1/staff/watch/remove') {
    const row = await findAccount(db, { target: body.target, name: body.name });
    if ('error' in row) return row;
    const add = path === '/v1/staff/watch/add';
    const act = add ? 'watch-add' : 'watch-remove';
    // bounded inside the statement that writes, so two adds racing for the last place land one
    const r = add
      ? await db.prepare(`INSERT INTO staff_watch (staff, target, at) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM staff_watch WHERE staff = ?1) < ?4
          ON CONFLICT (staff, target) DO NOTHING`).bind(me.id, row.id, nowS, STAFF_WATCH_MAX).run()
      : await db.prepare('DELETE FROM staff_watch WHERE staff = ?1 AND target = ?2').bind(me.id, row.id).run();
    if (!r.meta.changes) {
      const there = add && await db.prepare('SELECT 1 AS y FROM staff_watch WHERE staff = ?1 AND target = ?2').bind(me.id, row.id).first();
      if (there) return { ok: true, sub: row.id, name: displayName(row), repeat: true };
      const error = add ? 'watch-full' : 'not-watched';
      await audit(act, row.id, { name: displayName(row), error }, { outcome: 'failed' }).run();
      return { error };
    }
    await audit(act, row.id, { name: displayName(row) }).run();
    return { ok: true, sub: row.id, name: displayName(row) };
  }
  if (path === '/v1/staff/watch/events') {
    // (since, until]: `until` pins a read's pages to one set - the first page answers it as `cursor`, the next pages send it
    // back, and the next poll sends it as `since`
    const until = Number.isSafeInteger(body.until) && body.until > 0 ? Math.min(body.until, nowS) : nowS;
    const since = Math.max(Number.isSafeInteger(body.since) ? body.since : 0, nowS - WATCH_WINDOW_S);
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    const { online, events } = await watchEvents(db, who, { since, until, nowS }, audit('watch-events', null, null, { onceIn: READ_ROW_S }));
    return { online, events: events.slice(from, from + WATCH_PAGE), next: from + WATCH_PAGE < events.length ? from + WATCH_PAGE : null, total: events.length, cursor: until, since };
  }

  // ═══ YOUR SETTINGS - the member's own (mob, 03:24Z: "comes back exactly the same every time they log in") ═══
  if (path === '/v1/staff/settings') {
    const r = await db.prepare('SELECT doc, at FROM staff_settings WHERE player = ?1').bind(me.id).first();
    let settings = {};
    try { settings = r ? JSON.parse(r.doc) : {}; } catch { settings = {}; }
    return { settings, at: r?.at ?? null };
  }
  if (path === '/v1/staff/settings/save') {
    const s = settingsOf(body.settings);
    if ('error' in s) {
      // written down failed, once in ten minutes as a save is (STAFF-PANEL3-DESK FIX, flaw review)
      await audit('settings-save', null, { error: s.error }, { outcome: 'failed', onceIn: READ_ROW_S }).run();
      return s;
    }
    await db.batch([
      db.prepare('INSERT INTO staff_settings (player, doc, at) VALUES (?1, ?2, ?3) ON CONFLICT (player) DO UPDATE SET doc = excluded.doc, at = excluded.at').bind(me.id, s.json, nowS),
      audit('settings-save', null, null, { onceIn: READ_ROW_S }),   // a drag a second is one row in ten minutes
    ]);
    return { ok: true, at: nowS };
  }

  // ═══ THE ADMINS' DOORS ═══
  if (path === '/v1/staff/notice') {
    // the server's notice on every board for 1 to NOTICE_DAYS_MAX days (board.js postNotice, a developer's - every Admin
    // is one); `rid` the panel's request id, so a notice asked again is the one it made
    const r = await postNotice({ db, rand, nowS }, me, env, { subject: body.subject, body: body.body, days: body.days, rid: body.rid });
    const detail = { days: body.days, subject: typeof body.subject === 'string' ? body.subject.slice(0, 80) : null };
    if ('error' in r) {
      await audit('notice', null, { ...detail, error: r.error }, { outcome: 'failed' }).run();
      return r;
    }
    if (!r.repeat) await audit('notice', null, { ...detail, id: r.id }).run();
    return r;
  }

  if (path === '/v1/staff/ai-score') {
    // HOW OFTEN THE AI CHECK AGREED WITH STAFF (design doc, Reports and notifications): the cases staff decided in the last
    // `days` that the reviewer had read in `mode` ('shadow' today, MOD_AI) - the clock's expiries are nobody's decision. The
    // reviewer "said act" at FLAG_SEVERITY or more; staff acted (`actioned`) or dismissed. By the reviewer's category, 'none'
    // where it found nothing.
    const days = body.days === undefined ? AI_SCORE_DAYS : body.days;
    if (!Number.isSafeInteger(days) || days < 1 || days > AI_SCORE_DAYS_MAX) return { error: 'bad-days' };
    const mode = body.mode === 'on' ? 'on' : 'shadow';
    const [found] = await db.batch([db.prepare(`SELECT COALESCE(ai_category, 'none') AS category, status, (ai_category IS NOT NULL AND ai_severity >= ?3) AS said, COUNT(*) AS n
      FROM mod_cases WHERE resolved_at > ?1 AND status IN ('actioned', 'dismissed') AND resolved_by IS NOT 'the clock' AND ai_state = 'done' AND ai_mode = ?2
      GROUP BY 1, 2, 3`).bind(nowS - days * 86400, mode, FLAG_SEVERITY), audit('ai-score-read', null, { days, mode }, { onceIn: READ_ROW_S })]);   // STAFF-PANEL-SPEED: one trip
    const r = found?.results ?? [];
    const blank = () => ({ cases: 0, saidActed: 0, saidDismissed: 0, clearActed: 0, clearDismissed: 0, agreed: 0, rate: /** @type {number|null} */ (null) });
    /** @type {Map<string, ReturnType<typeof blank>>} */
    const by = new Map();
    const total = blank();
    for (const x of r) {
      const n = Number(x.n);
      const key = `${x.said ? 'said' : 'clear'}${x.status === 'actioned' ? 'Acted' : 'Dismissed'}`;
      const cat = by.get(x.category) ?? blank();
      by.set(x.category, cat);
      for (const c of [cat, total]) {
        c.cases += n;
        /** @type {any} */ (c)[key] += n;
        if (key === 'saidActed' || key === 'clearDismissed') c.agreed += n;
      }
    }
    for (const c of [...by.values(), total]) c.rate = c.cases ? Math.round((c.agreed / c.cases) * 1000) / 1000 : null;
    return { days, mode, severity: FLAG_SEVERITY, categories: [...by.entries()].map(([category, c]) => ({ category, ...c })).sort((a, b) => b.cases - a.cases), total };
  }

  if (path === '/v1/staff/board/reported' || path === '/v1/staff/market/reported') {
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    const board = path === '/v1/staff/board/reported';
    // a note hidden by its reports first, then the most reporters, then the newest report
    // STAFF-PANEL-SPEED: the page and its audit row in one batch, one trip
    const [found] = await db.batch([board
      ? db.prepare(`SELECT n.id, n.map_id, n.author, n.author_name, n.subject, n.body, n.at, n.expires_at, n.hidden, COUNT(r.reporter) AS reports, MAX(r.at) AS last
          FROM board_reports r JOIN board_notes n ON n.id = r.note_id WHERE n.expires_at > ?1 GROUP BY n.id
          ORDER BY (n.hidden = 1) DESC, reports DESC, last DESC, n.id LIMIT ?2 OFFSET ?3`).bind(nowS, REPORTED_PAGE + 1, from)
      : db.prepare(`SELECT * FROM (
          SELECT 'listing' AS type, l.id, l.seller, l.kind, l.material, l.item, l.units, l.price, l.currency, l.at, COUNT(r.reporter) AS reports, MAX(r.at) AS last
            FROM market_reports r JOIN market_listings l ON l.id = r.listing WHERE l.state = 'open' GROUP BY l.id
          UNION ALL
          SELECT 'auction', a.id, a.seller, 'piece', NULL, NULL, 1, COALESCE(a.high, a.opening), NULL, a.at, COUNT(r.reporter), MAX(r.at)
            FROM market_auction_reports r JOIN market_auctions a ON a.id = r.auction WHERE a.state = 'open' GROUP BY a.id
        ) x LEFT JOIN (SELECT id AS pid, handle, guest_name FROM players) p ON p.pid = x.seller
        ORDER BY x.reports DESC, x.last DESC, x.id LIMIT ?1 OFFSET ?2`).bind(REPORTED_PAGE + 1, from), audit('reported-read', null, { kind: board ? 'board' : 'market' }, { onceIn: READ_ROW_S })]);
    const r = found?.results ?? [];
    const page = r.slice(0, REPORTED_PAGE);
    const next = r.length > REPORTED_PAGE ? from + REPORTED_PAGE : null;
    if (board) {
      // TEXT-F1: starred as every reader of the board reads it, a moderator in the game included
      return { notes: page.map((n) => ({ id: n.id, map: n.map_id, author: n.author, authorName: n.author_name, subject: maskText(n.subject), body: maskText(n.body),
        at: n.at, expiresAt: n.expires_at, hidden: n.hidden === 1, restored: n.hidden === 2, reports: n.reports, lastReport: n.last })), next };
    }
    return {
      listings: page.map((l) => {
        let item = null;
        try { item = l.item ? JSON.parse(l.item) : null; } catch { item = null; }
        return { type: l.type, id: l.id, seller: l.seller, sellerName: displayName(l), kind: l.kind, material: l.material, item, units: l.units, price: l.price,
          currency: l.currency, at: l.at, reports: l.reports, lastReport: l.last };
      }),
      next,
    };
  }

  if (path === '/v1/staff/board/moderate') {
    // Remove (the note goes, its reports with it) or Restore (reports no longer hide it) - board.js moderateNote, the
    // game's moderators' own act
    const act = body.act === 'remove' || body.act === 'restore' ? body.act : null;
    const detail = { id: typeof body.id === 'string' ? body.id.slice(0, 40) : null };
    if (!act) {
      // a refused act is written down failed (STAFF-PANEL3-DESK FIX, flaw review)
      await audit('board-moderate', null, { ...detail, error: 'bad-act' }, { outcome: 'failed' }).run();
      return { error: 'bad-act' };
    }
    const note = typeof body.id === 'string' ? await db.prepare('SELECT author FROM board_notes WHERE id = ?1').bind(body.id).first() : null;
    const r = await moderateNote({ db }, me, env, body.id, act);
    const target = note?.author ?? null;
    if ('error' in r) {
      await audit(`board-${act}`, target, { ...detail, error: r.error }, { outcome: 'failed' }).run();
      return r;
    }
    await audit(`board-${act}`, target, detail).run();
    return r;
  }
  return { error: 'not-found' };
}
