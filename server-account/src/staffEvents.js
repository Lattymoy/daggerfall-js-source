// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use"; net/staffEvent/staffEventLaw.js,
// bible/11-Multiplayer/Staff-Events.md) - THE PANEL'S EVENT DOORS. Admins only.
//
// /v1/staff/event { op } - 'start' stages one (`ev`: the place, the monsters, how many, the meter's kills, the mini boss
// and its size, whether its fall ends the event, and how many minutes it runs - 0 until it is ended); 'end' ends one and
// 'boss' calls its mini boss now (`id`); EVENT-CLEAR (mob 2026-10-25: "let me clear other events as well form history")
// 'clear' takes an event that is over off the list (`id`), or every one (`all`) - a live one never. /v1/staff/events reads them back, newest first, a page at a time (`before`), each
// with the hub's live word on it - its kills (the meter), its boss, and the players fighting.
//
// STORED FIRST, as a staff message is (staffMessage.js): the row is written and audited in one batch, and only then is a
// signed order of its own kind (identityToken.js 'sevent') posted to the relay's door (sanctions.js pushLaw). The hub keeps
// the book of the events live (server/src/staffEvents.js) and answers with it - each event with its meter - so every
// door here answers the book as the hub holds it. An event the book no longer names ended there (its boss fell, its clock
// ran out, its last monster died): the read marks its row ended with the last meter the service heard.
//
// The meter is staff's: no door the game reads names it.
import { displayName } from './accounts.js';
import { pushLaw } from './sanctions.js';
import { signingKey } from './signing.js';
import { mintStaffEventOrder } from '../../src/net/identityToken.js';
import { validStaffEvent, staffEventFault, validStaffBoard, STAFF_EVENT_ID_RE, STAFF_EVENT_LONGEST_MS, STAFF_EVENTS_MAX } from '../../src/net/staffEvent/staffEventLaw.js';

export const EVENT_ROUTES = Object.freeze(['/v1/staff/event', '/v1/staff/events']);
/** Rows one read answers. */
export const STAFF_EVENTS_PAGE = 30;
/** How long a row is kept (the staff audit log's month) - past it the hourly job deletes it (cron.js staff-events). */
export const STAFF_EVENT_KEEP_S = 30 * 24 * 60 * 60;
/** The longest an event runs by its own clock, in minutes (the law's day). */
export const STAFF_EVENT_MINUTES_MAX = STAFF_EVENT_LONGEST_MS / 60000;

/** The refusals' words, and their status (staff.js STAFF_STATUS). */
export const EVENT_STATUS = Object.freeze({ 'event-bad': 400, 'event-full': 409, 'event-gone': 404, 'event-relay': 503, 'event-live': 409 });

/** An event's id: ten of [a-z0-9], from the service's randomness. @param {(b: Uint8Array) => void} rand */
export function mintEventId(rand) {
  const b = new Uint8Array(10);
  rand(b);
  const id = [...b].map((x) => '0123456789abcdefghijklmnopqrstuvwxyz'[x % 36]).join('');
  if (!STAFF_EVENT_ID_RE.test(id)) throw new Error('mintEventId produced an id outside the law\'s shape');
  return id;
}

/**
 * The event as an Admin staged it, checked by the law: the panel's fields, and the service's own - its id, its start,
 * its end by `mins`, and who staged it. null for one the law refuses.
 * @param {any} ev @param {string} id @param {number} nowS @param {string} by
 */
export function stagedEvent(ev, id, nowS, by) {
  if (!ev || typeof ev !== 'object') return null;
  const mins = ev.mins ?? 0;
  if (!Number.isSafeInteger(mins) || mins < 0 || mins > STAFF_EVENT_MINUTES_MAX) return null;
  const at = nowS * 1000;
  return validStaffEvent({ id, rg: ev.rg, loc: ev.loc, px: ev.px, py: ev.py, nm: ev.nm, ct: ev.ct ? 1 : 0, mt: ev.mt, n: ev.n, m: ev.m, b: ev.b, bs: ev.bs, bh: ev.bh, hp: ev.hp ?? 0, at, ue: mins ? at + mins * 60000 : 0, eb: ev.eb ? 1 : 0, fb: 0, by });
}

/** EVENT-FAULT: the field a staging is refused for (the law's name, or 'runs' for its minutes). @param {any} ev @param {string} id @param {number} nowS @param {string} by */
export function stagedFault(ev, id, nowS, by) {
  if (!ev || typeof ev !== 'object') return 'event';
  const mins = ev.mins ?? 0;
  if (!Number.isSafeInteger(mins) || mins < 0 || mins > STAFF_EVENT_MINUTES_MAX) return 'runs';
  const at = nowS * 1000;
  return staffEventFault({ id, rg: ev.rg, loc: ev.loc, px: ev.px, py: ev.py, nm: ev.nm, ct: ev.ct ? 1 : 0, mt: ev.mt, n: ev.n, m: ev.m, b: ev.b, bs: ev.bs, bh: ev.bh, hp: ev.hp ?? 0, at, ue: mins ? at + mins * 60000 : 0, eb: ev.eb ? 1 : 0, fb: 0, by });
}

/** A row's kept board. @param {unknown} s */
const topOf = (s) => { try { return (typeof s === 'string' && validStaffBoard(JSON.parse(s))) || []; } catch { return []; } };

/** A row as the panel reads it, with the hub's live word on it when its book names it. @param {any} r @param {any} live */
const shown = (r, live) => {
  const ev = JSON.parse(r.ev);
  const on = live?.live ?? null;
  return {
    id: r.id, at: r.at, staff: { id: r.staff_id, name: r.staff_name }, ev: { ...ev, fb: live?.fb ?? ev.fb },
    state: r.state, endedAt: r.ended_at ?? null, endedBy: r.ended_by ?? null,
    kills: on ? on.n : r.kills, boss: on ? (on.bk ? 'fallen' : on.bu ? 'up' : on.bd ? 'due' : 'none') : (r.boss ?? 'none'),
    fighters: on ? on.f : 0, live: !!live,
    top: on?.top ?? topOf(r.top),   // THE REWARD: the board at the boss's fall ([name, kills, killer] rows), the hub's or as kept
  };
};

/** The hub's book, by id. @param {any} l */
const bookOf = (l) => new Map((Array.isArray(l) ? l.slice(0, STAFF_EVENTS_MAX) : []).filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e]));

/**
 * THE PANEL'S EVENT DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffEvents(ctx, env, path, body, who, audit) {
  const { db, nowS, subtle, rand } = ctx;
  const me = who.player;
  if (who.role !== 'admin') return { error: 'staff-admin' };

  /** An order to the hub, and its answer: `{ took, l, why }`. @param {{ op: string, ev?: any, ei?: string }} o */
  const ask = async (o) => {
    const key = await signingKey(env, subtle);
    const order = key ? await mintStaffEventOrder({ s: me.id, ...o }, key, { subtle, nowS }) : null;
    /** @type {any} */
    let said = null;
    const took = await pushLaw(env, (u, i) => globalThis.fetch(u, i), order, (s) => { said = s; }, (s) => { said = s; });   // a refusal's body too: the hub's why
    return { took, l: said?.l ?? null, why: said?.why ?? null, bd: Array.isArray(said?.bd) ? said.bd : [] };
  };
  /** The rows the book no longer names, ended there; the ones it names, their meter kept. @param {Map<string, any>} book */
  const settle = async (book, boards = []) => {
    const open = (await db.prepare("SELECT id, kills, boss FROM staff_events WHERE state = 'live'").all())?.results ?? [];
    const writes = [];
    const mine = new Set(open.map((/** @type {any} */ r) => r.id));
    for (const [id, top] of boards) {   // THE REWARD: a fallen boss's board, kept at its row's end (the hub keeps only the newest)
      const b = mine.has(id) ? validStaffBoard(top) : null;
      if (b) writes.push(db.prepare('UPDATE staff_events SET top = ?2 WHERE id = ?1 AND top IS NULL').bind(id, JSON.stringify(b)));
    }
    for (const r of open) {
      const e = book.get(r.id);
      if (!e) writes.push(db.prepare("UPDATE staff_events SET state = 'ended', ended_at = ?2, ended_by = COALESCE(ended_by, 'game') WHERE id = ?1 AND state = 'live'").bind(r.id, nowS));
      else if (e.live) {
        const boss = e.live.bk ? 'fallen' : e.live.bu ? 'up' : e.live.bd ? 'due' : 'none';
        if (e.live.n !== r.kills || boss !== r.boss) writes.push(db.prepare('UPDATE staff_events SET kills = ?2, boss = ?3 WHERE id = ?1').bind(r.id, e.live.n, boss));
      }
    }
    if (writes.length) await db.batch(writes);
  };

  if (path === '/v1/staff/events') {
    const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : null;
    // the hub's book first, only for the first page - a page further down is history (infinite scroll)
    const said = before ? null : await ask({ op: 'look' });
    const book = bookOf(said?.l);
    if (said?.took) await settle(book, said.bd);
    const rows = (await db.prepare('SELECT rowid AS n, * FROM staff_events WHERE (?1 IS NULL OR rowid < ?1) ORDER BY rowid DESC LIMIT ?2')
      .bind(before, STAFF_EVENTS_PAGE + 1).all())?.results ?? [];
    const page = rows.slice(0, STAFF_EVENTS_PAGE);
    await audit('events-read', null, null, { onceIn: 10 * 60 }).run();
    return { events: page.map((r) => shown(r, book.get(r.id))), next: rows.length > STAFF_EVENTS_PAGE ? page.at(-1).n : null, relay: before ? null : !!said?.took, max: STAFF_EVENTS_MAX };
  }
  if (path !== '/v1/staff/event') return { error: 'not-found' };

  if (body.op === 'start') {
    const id = mintEventId(rand);
    const ev = stagedEvent(body.ev, id, nowS, displayName(me));
    if (!ev) return { error: `event-bad-${stagedFault(body.ev, id, nowS, displayName(me)) ?? 'event'}` };   // EVENT-FAULT: the field it is refused for, in its word (a 400, STAFF_STATUS's default)
    const detail = { id, place: ev.nm, rg: ev.rg, loc: ev.loc, kinds: ev.mt, n: ev.n, m: ev.m, boss: ev.b, size: ev.bs, health: ev.bh, hp: ev.hp };
    await db.batch([
      db.prepare("INSERT INTO staff_events (id, at, staff_id, staff_name, ev, state, kills, boss) VALUES (?1, ?2, ?3, ?4, ?5, 'starting', 0, 'none')")
        .bind(id, nowS, me.id, displayName(me), JSON.stringify(ev)),
      audit('event-start', null, detail),
    ]);
    const said = await ask({ op: 'start', ev });
    const state = said.took ? 'live' : 'failed';
    await db.prepare('UPDATE staff_events SET state = ?2, ended_at = ?3, ended_by = ?4 WHERE id = ?1').bind(id, state, said.took ? null : nowS, said.took ? null : (said.why ?? 'relay')).run();
    if (!said.took) {
      await audit('event-start', null, { ...detail, error: said.why ?? 'relay' }, { outcome: 'failed' }).run();
      return { error: said.why === 'full' ? 'event-full' : said.why === 'event' ? 'event-bad' : 'event-relay' };
    }
    const book = bookOf(said.l);
    const row = await db.prepare('SELECT rowid AS n, * FROM staff_events WHERE id = ?').bind(id).first();
    return { ok: true, event: shown(row, book.get(id)) };
  }

  if (body.op === 'clear') {   // EVENT-CLEAR: the history alone - the hub is not asked, a live or starting row is never taken
    const all = body.all === 1;
    if (!all && (typeof body.id !== 'string' || !STAFF_EVENT_ID_RE.test(body.id))) return { error: 'body' };
    const gone = all
      ? await db.prepare("DELETE FROM staff_events WHERE state IN ('ended', 'failed')").run()
      : await db.prepare("DELETE FROM staff_events WHERE id = ?1 AND state IN ('ended', 'failed')").bind(body.id).run();
    const n = gone?.meta?.changes ?? 0;
    if (!all && !n) return { error: 'event-live' };
    await audit('event-clear', null, all ? { all: 1, n } : { id: body.id }).run();
    return { ok: true, cleared: n };
  }

  if (body.op === 'end' || body.op === 'boss') {
    if (typeof body.id !== 'string' || !STAFF_EVENT_ID_RE.test(body.id)) return { error: 'body' };
    const row = await db.prepare('SELECT rowid AS n, * FROM staff_events WHERE id = ?').bind(body.id).first();
    if (!row || row.state !== 'live') return { error: 'event-gone' };
    const act = body.op === 'end' ? 'event-end' : 'event-boss';
    const said = await ask({ op: body.op, ei: body.id });
    if (!said.took) {
      await audit(act, null, { id: body.id, error: said.why ?? 'relay' }, { outcome: 'failed' }).run();
      if (said.why === 'gone') { await settle(bookOf(said.l)); return { error: 'event-gone' }; }
      return { error: 'event-relay' };
    }
    const book = bookOf(said.l);
    const writes = [audit(act, null, { id: body.id, place: JSON.parse(row.ev).nm })];
    if (body.op === 'end') writes.push(db.prepare("UPDATE staff_events SET state = 'ended', ended_at = ?2, ended_by = 'staff' WHERE id = ?1").bind(body.id, nowS));
    await db.batch(writes);
    await settle(book);
    const now = await db.prepare('SELECT rowid AS n, * FROM staff_events WHERE id = ?').bind(body.id).first();
    return { ok: true, event: shown(now, book.get(body.id)) };
  }
  return { error: 'body' };
}
