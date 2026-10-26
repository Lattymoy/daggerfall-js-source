// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use" - net/staffEvent/staffEventLaw.js,
// bible/11-Multiplayer/Staff-Events.md) - A STAFF EVENT, THE RELAY'S HALF. The account service's half is
// server-account/src/staffEvents.js; index.js holds the few hooks that call in here.
//
// THE HUB KEEPS THE BOOK: the events live (STAFF_EVENTS_MAX), in storage of its own (STAFF_EVENTS_KEY), each staged by a
// signed `sevent` order (identityToken.js mintStaffEventOrder) the account service pushed through the Worker's law door:
// `op` start (the event whole), end, boss (Spawn mini boss now - one more boss), or look (the book read back, nothing
// changed). The book is said to every player online as it changes and to each at its hello (`{t:'sev', k:'ev', l}`), as
// EVENT1's live event is; an end as `{t:'sev', k:'end', id, why}`. The door's answer is the book with each event's LIVE
// state - the meter staff read - as the place's cell last told it.
//
// THE PLACE'S CELL KEEPS THE METER (a raid's ledger's law, RAID3): each player standing in the place says, every few
// seconds, the deaths of the monsters THEY stand (`{t:'sev', k:'w'}`); the cell credits each account the most it has
// said, under a cap on how fast a count may grow, calls the mini boss when the count reaches the event's meter (or staff
// call it by hand), hears it stand and fall from the one who stands it, says the boss's state to the place (never the
// count to a screen - the game reads it only to stop standing monsters at the event's total) and tells the hub - at once
// when the boss moved, else every STAFF_EVENT_TELL_MS. An event done by its ledger (its boss fell and it ends there, or
// its last monster fell) is ended by the hub on that tell.
//
// WHAT IT CAN CHECK, it checks (the raid's law): a word is heard only in the cell the event's pixel stands in, from a
// socket whose own pose stands on that pixel, for an event the hub's book holds. WHAT IT CANNOT: a kill is the player's
// own machine's word (co-op's law - the relay has no world to see it in). A forged word can bring a boss early; it can
// never stage, end or move an event, which only a signed order does.
//
// THE REWARD (section 9 of the page; mob: "something like dagons leaderboard", "but not his ghear"): at the first boss's
// fall the cell pays once - each earner's receipt minted with the relay's key (net/staffEvent/staffEventReceipt.js `e1`,
// a seed and its rank) and kept WITH the ledger before a word is said (the raid's cleanse's law), the BOARD said to the
// place (`{t:'sev', k:'bd', id, top}`) and carried to the hub on the tell (staff read it), and each earner's receipt to
// its account's newest socket here (`k:'rc'`) - and again to any of its sockets that speaks after (a reconnect).
//
// OFFLINE ONLY until mob tries it live.
// ═══════════════════════════════════════════════════════════════════

import {
  validStaffEvent, validStaffEventTell, newStaffLedger, foldStaffWord, staffBossCall, staffEventDone, staffEventLapsed,
  staffLedgerState, staffEventTell, staffEventEarned, staffEventBoard, validStaffBoard, STAFF_EVENTS_MAX, STAFF_EVENT_TELL_MS, STAFF_EVENT_ID_RE,
} from '../../src/net/staffEvent/staffEventLaw.js';
import { mintStaffReceipt } from '../../src/net/staffEvent/staffEventReceipt.js';
import { SOCIAL_ROOM, worldRoom, mapPixelOfWire } from '../../src/net/wire.js';
import { junkOutsideCover, cellCall } from './cellNodes.js';   // COST-2 (b): a word in a cell this socket covers, or junk; part two: the event's cell reached through the tree
import { verifyOrder } from '../../src/net/identityToken.js';

/** The hub's book in storage: `{ l: StaffEvent[], b: [id, board][] }` - THE REWARD: `b` the boards of the last events whose boss fell. */
export const STAFF_EVENTS_KEY = 'sevents';
/** A cell's ledger of one event in storage. */
export const STAFF_LEDGER_PREFIX = 'sevl:';
/** A cell asking the hub for the book; a cell telling the hub an event's meter; the hub telling a cell a call or an end. */
export const SEV_INTERNAL_BOOK = '/internal/sev/book';
export const SEV_INTERNAL_TELL = '/internal/sev/tell';
export const SEV_INTERNAL_CALL = '/internal/sev/call';
/** How long a cell trusts the book it last asked for, ms (an event it has not heard of is asked again sooner). */
export const SEV_BOOK_FRESH_MS = 30_000;
export const SEV_BOOK_MISS_MS = 5_000;
/** THE REWARD: how many fallen bosses' boards the hub keeps for staff's look (the newest). */
export const SEV_BOARDS_KEPT = 2 * STAFF_EVENTS_MAX;
/** How long a hub or cell waits on the other, ms. */
const CALL_MS = 3_000;
/** The door's ops. */
export const STAFF_EVENT_OPS = Object.freeze(['start', 'end', 'boss', 'look']);

const json = (/** @type {any} */ o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

// ─────────────────────────────── THE HUB ───────────────────────────────

/** The book, read once a wake. @param {any} room @returns {Promise<import('../../src/net/staffEvent/staffEventLaw.js').StaffEvent[]>} */
async function bookOf(room) {
  if (!room._sevBook) {
    let v = null;
    try { v = await room.state.storage.get(STAFF_EVENTS_KEY); } catch (e) { console.warn('[sev] read', /** @type {any} */ (e)?.message ?? e); }
    if (!room._sevBook) room._sevBook = (Array.isArray(v?.l) ? v.l : []).map(validStaffEvent).filter(Boolean).slice(0, STAFF_EVENTS_MAX);
    room._sevBoards ??= new Map((Array.isArray(v?.b) ? v.b : []).filter((/** @type {any} */ x) => Array.isArray(x) && STAFF_EVENT_ID_RE.test(x[0]) && validStaffBoard(x[1])).slice(-SEV_BOARDS_KEPT));
  }
  room._sevLive ??= new Map();
  room._sevBoards ??= new Map();
  return room._sevBook;
}
/** @param {any} room */
async function saveBook(room) {
  try { await room.state.storage.put(STAFF_EVENTS_KEY, { l: room._sevBook, b: [...(room._sevBoards ?? [])] }); } catch (e) { console.warn('[sev] write', /** @type {any} */ (e)?.message ?? e); }
}
/** The book as the game hears it. @param {any[]} l */
const bookFrame = (l) => JSON.stringify({ t: 'sev', k: 'ev', l });
/** Said to everyone online (the hub's fan IS everyone online - EVENT1's law; on the bus, every shard's too). @param {any} room @param {string} s */
function fanAll(room, s) { for (const [ws, b] of [...room._all()]) if (b.id) room._send(ws, s); }

/** The hub telling the event's cell (best effort: the cell asks the book again on its next word anyway) - COST-2 part two:
 *  the object of the node that holds the cell now (cellNodes.js cellCall). @param {any} room @param {any} e @param {object} body */
export async function tellCell(room, e, body) {
  try { const res = await cellCall(room.env, worldRoom(e.px, e.py), 0, SEV_INTERNAL_CALL, body, CALL_MS); return !!res?.ok; }
  catch (err) { console.warn('[sev] cell', /** @type {any} */ (err)?.message ?? err); return false; }
}

/** AN EVENT ENDS: out of the book, said to everyone, its cell told. @param {any} room @param {string} id @param {string} why */
async function endEvent(room, id, why) {
  const book = await bookOf(room);
  const e = book.find((x) => x.id === id);
  if (!e) return false;
  room._sevBook = book.filter((x) => x.id !== id);
  room._sevLive.delete(id);
  await saveBook(room);
  fanAll(room, JSON.stringify({ t: 'sev', k: 'end', id, why }));
  fanAll(room, bookFrame(room._sevBook));
  await tellCell(room, e, { id, op: 'end' });
  return true;
}
/** The events past the end they were set to, ended. @param {any} room @param {number} now */
async function lapse(room, now) {
  for (const e of [...(await bookOf(room))]) if (staffEventLapsed(e, now)) await endEvent(room, e.id, 'time');
}
/** The book with each event's live state, as staff read it. @param {any} room */
const lookOf = (room) => room._sevBook.map((/** @type {any} */ e) => ({ ...e, live: room._sevLive.get(e.id) ?? null }));

/**
 * A SIGNED STAFF EVENT ORDER TAKEN at the hub (index.js `_lawInternal`, past the Worker's verify; the hub verifies it
 * again with its own key in `_takeOrder`'s way, here by the caller). Answers `{ ok, l?, why? }` - `l` the book as staff read
 * it. A start whose id the book holds already is a replay (ok); a full book refuses a new one.
 * @param {any} room the hub @param {any} c the verified claims `{ o:'sevent', op, ev?, ei? }` @param {number} now
 */
export async function takeStaffEventOrder(room, c, now) {
  if (!STAFF_EVENT_OPS.includes(c?.op)) return { ok: false };
  await bookOf(room);
  await lapse(room, now);
  if (c.op === 'start') {
    const e = validStaffEvent(c.ev);
    if (!e) return { ok: false, why: 'event' };
    if (!room._sevBook.some((/** @type {any} */ x) => x.id === e.id)) {
      if (room._sevBook.length >= STAFF_EVENTS_MAX) return { ok: false, why: 'full', l: lookOf(room) };
      room._sevBook = [...room._sevBook, e];
      await saveBook(room);
      fanAll(room, bookFrame(room._sevBook));
    }
    return { ok: true, l: lookOf(room) };
  }
  if (c.op === 'end') {
    if (typeof c.ei !== 'string' || !STAFF_EVENT_ID_RE.test(c.ei)) return { ok: false };
    await endEvent(room, c.ei, 'staff');
    return { ok: true, l: lookOf(room) };
  }
  if (c.op === 'boss') {
    const e = room._sevBook.find((/** @type {any} */ x) => x.id === c.ei);
    if (!e) return { ok: false, why: 'gone', l: lookOf(room) };
    e.fb = Math.min(99, (e.fb ?? 0) + 1);
    await saveBook(room);
    fanAll(room, bookFrame(room._sevBook));
    await tellCell(room, e, { id: e.id, op: 'boss', fb: e.fb });
    return { ok: true, l: lookOf(room) };
  }
  return { ok: true, l: lookOf(room), bd: [...room._sevBoards] };   // look - THE REWARD: and the boards kept, by event
}

/**
 * THE HUB'S DOOR for a staff event's order (index.js `_lawInternal`): verified with the hub's own key, as a staff
 * message's is (staffMessage.js), then taken. Answers the door's body.
 * @param {any} room @param {unknown} order @param {number} now
 */
export async function takeStaffEventLaw(room, order, now) {
  if (typeof order !== 'string' || !order || order.length > 1024) return { ok: false };
  await room._loadKey();
  if (!room._verifyKey) return { ok: false };
  const r = await verifyOrder(order, room._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'sevent' });
  if (!r.ok) return { ok: false };
  return takeStaffEventOrder(room, r.claims, now);
}

/** The book said to one joiner (a hello at the hub - its own socket's, or a shard's joiner on the bus). @param {any} room @param {any} ws @param {number} now */
export async function sayStaffBook(room, ws, now) {
  await lapse(room, now);
  const book = await bookOf(room);
  if (book.length) room._send(ws, bookFrame(book));
}
/** A cell asking for the book. @param {any} room */
export async function staffBookInternal(room) {
  await lapse(room, Date.now());
  return json({ l: await bookOf(room) });
}
/** A cell telling an event's meter: kept for staff's look; an event its ledger says is done is ended. @param {any} room @param {Request} request */
export async function staffTellInternal(room, request) {
  let body = null;
  try { body = await request.json(); } catch { /* refused below */ }
  const t = validStaffEventTell(body?.t);
  const book = await bookOf(room);
  const e = t ? book.find((x) => x.id === t.id) : null;
  if (!t || !e) return json({ ok: false });
  room._sevLive.set(t.id, { ...t, at: Date.now() });
  if (t.top && !room._sevBoards.has(t.id)) {   // THE REWARD: the board kept past the event's end, for staff's look (the panel's row)
    room._sevBoards.set(t.id, t.top);
    while (room._sevBoards.size > SEV_BOARDS_KEPT) room._sevBoards.delete(room._sevBoards.keys().next().value);
    await saveBook(room);
  }
  if (['boss', 'done'].includes(body?.done)) await endEvent(room, t.id, body.done);
  return json({ ok: true });
}

// ─────────────────────────────── THE PLACE'S CELL ───────────────────────────────

/** The book as this cell last asked the hub - an event by id, or null. @param {any} room @param {string} id @param {number} now */
async function eventOf(room, id, now) {
  const c = room._sevCopy;
  const fresh = c && now - c.at < SEV_BOOK_FRESH_MS;
  const e = c?.l.find((/** @type {any} */ x) => x.id === id) ?? null;
  if (fresh && (e || now - c.at < SEV_BOOK_MISS_MS)) return e;
  const rooms = room.env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return e;
  try {
    const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SEV_INTERNAL_BOOK}`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(CALL_MS) }));
    const got = res?.ok ? await res.json() : null;
    const l = (Array.isArray(got?.l) ? got.l : []).map(validStaffEvent).filter(Boolean);
    room._sevCopy = { at: now, l };
    return l.find((/** @type {any} */ x) => x.id === id) ?? null;
  } catch (err) { console.warn('[sev] book', /** @type {any} */ (err)?.message ?? err); return e; }
}
/** An event's ledger in this cell (the instance's copy, else storage's). @param {any} room @param {any} e @param {number} now */
async function ledgerOf(room, e, now) {
  room._sevLed ??= new Map();
  let led = room._sevLed.get(e.id);
  if (!led) {
    let v = null;
    try { v = await room.state.storage.get(STAFF_LEDGER_PREFIX + e.id); } catch { /* none */ }
    led = v && typeof v === 'object' && v.id === e.id ? v : newStaffLedger(e, now);
    room._sevLed.set(e.id, led);
  }
  return led;
}
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** THE REWARD, paid once at the first boss's fall: the earners' receipts and the board kept on the ledger (said after,
 *  by `keep`). @param {any} room @param {any} led @param {number} now */
async function payReward(room, led, now) {
  led.rw = 1;
  led.rc = {};
  const key = await room._receiptKeyOf?.() ?? null;
  const nowS = Math.floor(now / 1000);
  for (const { acct, rank } of staffEventEarned(led)) {
    try { led.rc[acct] = await mintStaffReceipt({ v: led.id, s: acct, c: rand32(), r: rank }, key, { subtle: crypto.subtle, nowS }); }
    catch (err) { console.warn('[sev] receipt refused', /** @type {any} */ (err)?.message ?? err); }
  }
  led.top = staffEventBoard(led);
}
/** Each earner's receipt to its account's newest socket here (one tab an account, the raid's AUDIT WBX S4). @param {any} room @param {any} led */
function handReceipts(room, led) {
  const newest = new Map();
  for (const [ws, b] of [...room._all()]) {
    if (!b.id || typeof b.sub !== 'string' || !led.rc?.[b.sub]) continue;
    const had = newest.get(b.sub);
    if (!had || (b.since ?? 0) >= (had.b.since ?? 0)) newest.set(b.sub, { ws, b });
  }
  for (const [sub, { ws }] of newest) room._send(ws, JSON.stringify({ t: 'sev', k: 'rc', id: led.id, r: led.rc[sub] }));
}
/** The ledger kept, said to the place, and told to the hub (at once when its boss moved or it is done). THE REWARD: at
 *  the first boss's fall, paid before a word of it is said. @param {any} room @param {any} led @param {any} e @param {number} now @param {boolean} urgent */
async function keep(room, led, e, now, urgent) {
  const paying = led.bk === 1 && !led.rw;
  if (paying) await payReward(room, led, now);
  try { await room.state.storage.put(STAFF_LEDGER_PREFIX + led.id, led); } catch (err) { console.warn('[sev] ledger', /** @type {any} */ (err)?.message ?? err); }
  const s = JSON.stringify({ t: 'sev', ...staffLedgerState(led) });
  for (const [ws, b] of [...room._all()]) if (b.id) room._send(ws, s);
  if (paying) {
    const bd = JSON.stringify({ t: 'sev', k: 'bd', id: led.id, top: led.top ?? [] });
    for (const [ws, b] of [...room._all()]) if (b.id) room._send(ws, bd);
    handReceipts(room, led);
  }
  const done = staffEventDone(led, e);
  if (done) led.ended = 1;
  room._sevToldAt ??= new Map();
  if (!urgent && !done && now - (room._sevToldAt.get(led.id) ?? 0) < STAFF_EVENT_TELL_MS) return;
  room._sevToldAt.set(led.id, now);
  const rooms = room.env?.ROOMS;
  if (!rooms?.idFromName || !rooms?.get) return;
  try { await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${SEV_INTERNAL_TELL}`, { method: 'POST', body: JSON.stringify({ t: staffEventTell(led, now), ...(done ? { done } : {}) }), signal: AbortSignal.timeout(CALL_MS) })); }
  catch (err) { console.warn('[sev] tell', /** @type {any} */ (err)?.message ?? err); }
}

/**
 * A PLAYER'S WORD on the staff event whose place it stands in (index.js `_message`, `t: 'sev'`): heard in the place's own
 * cell alone (anywhere else junk), never in a layer, for an event the hub's book holds at this pixel, credited only from a
 * socket whose pose stands on the pixel, to the VERIFIED account (a guest's socket by its id). A count or a boss that
 * moved is kept, said to the place and told to the hub; else the speaker is answered with the ledger.
 * @param {any} room @param {any} ws @param {any} a its attachment @param {any} m validStaffEventIn's shape @param {number} now
 */
export async function staffEventWord(room, ws, a, m, now) {
  if (junkOutsideCover(room, ws, a, worldRoom(m.px, m.py))) return;
  if (a.ly) return;   // the place's ledger alone (a raid's law: a layer is another object for the same cell)
  const e = await eventOf(room, m.id, now);
  if (!e || e.px !== m.px || e.py !== m.py) return;
  const led = await ledgerOf(room, e, now);
  const [px, py] = a.pose ? mapPixelOfWire(a.pose.x, a.pose.z) : [-1, -1];
  const acct = typeof a.sub === 'string' && a.sub ? a.sub : `id:${a.id}`;
  const called = staffBossCall(led, e);
  const r = px === m.px && py === m.py ? foldStaffWord(led, e, acct, a.name ?? '', m, now) : { credited: 0, known: false, boss: false };
  if (called || r.credited > 0 || r.boss) { await keep(room, led, e, now, called || r.boss); return; }
  room._send(ws, JSON.stringify({ t: 'sev', ...staffLedgerState(led) }));
  if (led.rc?.[acct]) room._send(ws, JSON.stringify({ t: 'sev', k: 'rc', id: led.id, r: led.rc[acct] }));   // THE REWARD: mine again (a reconnect)
}

/** The hub telling this cell: staff called one more boss (`op` boss, `fb` the call), or the event ended. @param {any} room @param {Request} request */
export async function staffCallInternal(room, request) {
  let body = null;
  try { body = await request.json(); } catch { /* refused below */ }
  if (typeof body?.id !== 'string' || !STAFF_EVENT_ID_RE.test(body.id)) return json({ ok: false }, 400);
  const now = Date.now();
  if (body.op === 'end') {
    const led = room._sevLed?.get(body.id);
    if (led) led.ended = 1;
    room._sevCopy = null;
    try { await room.state.storage.delete(STAFF_LEDGER_PREFIX + body.id); } catch { /* gone */ }
    room._sevLed?.delete(body.id);
    return json({ ok: true });
  }
  if (body.op === 'boss') {
    room._sevCopy = null;   // the book's `fb` moved: asked again
    const e = await eventOf(room, body.id, now);
    if (!e) return json({ ok: false });
    const led = await ledgerOf(room, e, now);
    if (staffBossCall(led, e)) await keep(room, led, e, now, true);
    return json({ ok: true });
  }
  return json({ ok: false }, 400);
}
