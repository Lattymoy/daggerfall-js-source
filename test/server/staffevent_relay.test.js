// STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use"; bible/11-Multiplayer/Staff-Events.md) -
// THE RELAY'S HALF (server/src/staffEvents.js) on stand-in rooms - the hub's book (start, a replay, a full book, boss,
// end, look, a lapse, the hello), the place's cell keeping the meter (a word heard only in its own cell, credited only
// from a pose on the pixel, the boss called at the meter and by hand, the hub told, an event done ended) - and THE ACCOUNT
// SERVICE'S DOORS (server-account/src/staffEvents.js) through the real Worker, its orders taken by that same hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  takeStaffEventOrder, takeStaffEventLaw, sayStaffBook, staffEventWord, staffBookInternal, staffTellInternal, staffCallInternal,
  SEV_INTERNAL_BOOK, SEV_INTERNAL_TELL, SEV_INTERNAL_CALL, STAFF_EVENTS_KEY, STAFF_LEDGER_PREFIX,
} from '../../server/src/staffEvents.js';
import { SOCIAL_ROOM, worldRoom, PIXEL_UNITS, SAFE_LAW_PATH } from '../../src/net/wire.js';
import { mintStaffEventOrder } from '../../src/net/identityToken.js';
import { STAFF_EVENT_KILLS_BURST } from '../../src/net/staffEvent/staffEventLaw.js';
import { readStaffReceipt } from '../../src/net/staffEvent/staffEventReceipt.js';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { EVENT_ROUTES, STAFF_EVENT_KEEP_S, mintEventId, stagedEvent } from '../../server-account/src/staffEvents.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { HOUR_JOBS } from '../../server-account/src/cron.js';

const { subtle } = globalThis.crypto;
const EV = Object.freeze({ id: 'ab12cd34ef', rg: 17, loc: 0, px: 207, py: 213, nm: 'Daggerfall', ct: 1, mt: [7, 12], n: 30, m: 12, b: 24, bs: 200, bh: 10, hp: 0, at: Date.now(), ue: 0, eb: 1, fb: 0, by: 'SirMcMobdon' });
/** A wire pose standing on map pixel (px, py) (wire.js mapPixelOfWire's inverse, the pixel's middle). */
const poseOn = (px, py) => ({ x: px * PIXEL_UNITS + PIXEL_UNITS / 2, z: (499 - py) * PIXEL_UNITS + PIXEL_UNITS / 2 });

/** Stand-in Durable Objects: each a room with storage and sockets, reached through env.ROOMS by name, its internal routes
 *  the three index.js routes to this module. */
function relay() {
  const rooms = new Map();
  const ROOMS = { idFromName: (n) => n, get: (n) => rooms.get(n) ?? room(n) };
  function room(key) {
    const store = new Map();
    const socks = new Map();
    const r = {
      key, env: { ROOMS }, said: [], junked: 0,
      state: { storage: { get: async (k) => structuredClone(store.get(k)), put: async (k, v) => { store.set(k, structuredClone(v)); }, delete: async (k) => store.delete(k) } },
      store, _all: () => socks.entries(), _send: (ws, s) => { ws.got.push(JSON.parse(s)); return true; }, _junk: () => { r.junked++; },
      join(id, extra = {}) { const ws = { got: [] }; socks.set(ws, { id, key, ...extra }); return { ws, a: socks.get(ws) }; },
      async fetch(req) {
        const p = new URL(req.url).pathname;
        return p === SEV_INTERNAL_BOOK ? staffBookInternal(r) : p === SEV_INTERNAL_TELL ? staffTellInternal(r, req) : p === SEV_INTERNAL_CALL ? staffCallInternal(r, req) : new Response('no', { status: 404 });
      },
    };
    rooms.set(key, r);
    return r;
  }
  return { hub: room(SOCIAL_ROOM), room: (k) => rooms.get(k) ?? room(k) };
}

test('STAFF-EVENT: THE HUB\'S BOOK - start (a replay ok, a fifth refused), boss one more, end, look; said to everyone, and to each hello', async () => {
  const { hub } = relay();
  const p1 = hub.join('p1');
  const c = (op, more = {}) => takeStaffEventOrder(hub, { o: 'sevent', s: 'acct', op, ...more }, Date.now());
  let r = await c('start', { ev: EV });
  assert.equal(r.ok, true);
  assert.deepEqual(r.l.map((e) => [e.id, e.live]), [[EV.id, null]]);
  assert.deepEqual(hub.store.get(STAFF_EVENTS_KEY).l.map((e) => e.id), [EV.id], 'stored');
  assert.deepEqual(p1.ws.got.at(-1), { t: 'sev', k: 'ev', l: [EV] }, 'said to everyone online');
  assert.equal((await c('start', { ev: EV })).ok, true, 'a replay is ok');
  assert.equal(hub._sevBook.length, 1, 'and adds nothing');
  for (const id of ['bb000001', 'bb000002', 'bb000003']) await c('start', { ev: { ...EV, id } });
  r = await c('start', { ev: { ...EV, id: 'bb000004' } });
  assert.deepEqual([r.ok, r.why, r.l.length], [false, 'full', 4]);
  assert.deepEqual(await c('start', { ev: { ...EV, id: 'x' } }), { ok: false, why: 'event' });
  r = await c('boss', { ei: EV.id });
  assert.equal(r.l.find((e) => e.id === EV.id).fb, 1);
  assert.deepEqual((await c('boss', { ei: 'cc000000' })).why, 'gone');
  r = await c('end', { ei: 'bb000001' });
  assert.deepEqual(r.l.map((e) => e.id), [EV.id, 'bb000002', 'bb000003']);
  assert.deepEqual(p1.ws.got.find((m) => m.k === 'end'), { t: 'sev', k: 'end', id: 'bb000001', why: 'staff' });
  assert.equal((await c('look')).l.length, 3);
  // a hello hears the book; an event past its end lapses at the next touch
  hub._sevBook[1] = { ...hub._sevBook[1], ue: hub._sevBook[1].at + 1 };
  const p2 = hub.join('p2');
  await sayStaffBook(hub, p2.ws, Date.now() + 10);
  assert.deepEqual(p2.ws.got.at(-1).l.map((e) => e.id), [EV.id, 'bb000003']);
  assert.ok(p1.ws.got.some((m) => m.k === 'end' && m.id === 'bb000002' && m.why === 'time'));
  assert.equal((await takeStaffEventOrder(hub, { o: 'sevent', op: 'nuke' }, Date.now())).ok, false);
});

test('STAFF-EVENT: THE PLACE\'S CELL - a word heard in its own cell from a pose on the pixel, the meter calls the boss, its fall ends the event at the hub', async () => {
  const R = relay();
  const { hub } = R;
  await takeStaffEventOrder(hub, { o: 'sevent', op: 'start', ev: EV }, Date.now());
  const watcher = hub.join('w');
  const cell = R.room(worldRoom(EV.px, EV.py));
  const ann = cell.join('ann', { sub: 'acctA', name: 'Ann', pose: poseOn(EV.px, EV.py) });
  const far = cell.join('far', { sub: 'acctF', name: 'Far', pose: poseOn(EV.px + 1, EV.py) });
  const w = (n, more = {}) => ({ k: 'w', id: EV.id, px: EV.px, py: EV.py, n, s: 1, bu: 0, bk: 0, fb: 0, h: n, ...more });
  // the wrong cell: junk
  const other = R.room(worldRoom(EV.px + 64, EV.py));
  const o = other.join('o', { sub: 'acctO', pose: poseOn(EV.px, EV.py) });
  await staffEventWord(other, o.ws, o.a, w(5), Date.now());
  assert.equal(other.junked, 1);
  // a pose off the pixel: answered, never credited
  await staffEventWord(cell, far.ws, far.a, w(5), Date.now());
  assert.equal(cell._sevLed.get(EV.id).n, 0);
  assert.deepEqual(far.ws.got.at(-1), { t: 'sev', k: 'st', id: EV.id, n: 0, bd: 0, bu: 0, bk: 0, fc: 0 });
  // credited to the cap, kept, said to the place, told to the hub
  await staffEventWord(cell, ann.ws, ann.a, w(STAFF_EVENT_KILLS_BURST), Date.now());
  assert.equal(cell.store.get(STAFF_LEDGER_PREFIX + EV.id).n, STAFF_EVENT_KILLS_BURST);
  assert.equal(far.ws.got.at(-1).n, STAFF_EVENT_KILLS_BURST, 'said to everyone in the place');
  assert.equal(hub._sevLive.get(EV.id).n, STAFF_EVENT_KILLS_BURST, 'the hub heard the meter');
  assert.equal(hub._sevLive.get(EV.id).f, 1);
  // past the meter (12): the boss due at once
  await staffEventWord(cell, ann.ws, ann.a, w(12), Date.now() + 1000);
  assert.deepEqual([cell._sevLed.get(EV.id).n, cell._sevLed.get(EV.id).bd, hub._sevLive.get(EV.id).bd], [12, 1, 1]);
  // a hand call while it is due: one more call reaches the cell
  await takeStaffEventOrder(hub, { o: 'sevent', op: 'boss', ei: EV.id }, Date.now());
  assert.equal(cell._sevLed.get(EV.id).fc, 1, 'the hub told the cell, which took the call');
  // it stands and falls by its stander's word: the event ends at the hub (eb)
  await staffEventWord(cell, ann.ws, ann.a, w(12, { bu: 1, fb: 1 }), Date.now() + 2000);
  assert.equal(hub._sevLive.get(EV.id).bu, 1);
  await staffEventWord(cell, ann.ws, ann.a, w(12, { bu: 1, bk: 1, fb: 1 }), Date.now() + 3000);
  assert.equal(hub._sevBook.length, 0, 'its fall ended it');
  // THE REWARD: the board said to the place, my receipt to me alone (unsigned: this stand-in relay has no key), the
  // board kept at the hub past the end for staff's look
  const top = [['Ann', 12, 1]];
  assert.deepEqual(ann.ws.got.find((m) => m.k === 'bd'), { t: 'sev', k: 'bd', id: EV.id, top });
  assert.deepEqual(far.ws.got.find((m) => m.k === 'bd')?.top, top, 'said to everyone in the place');
  const rc = ann.ws.got.filter((m) => m.k === 'rc');
  assert.equal(rc.length, 1);
  assert.deepEqual((({ v, s, r, signed }) => ({ v, s, r, signed }))(readStaffReceipt(rc[0].r)), { v: EV.id, s: 'acctA', r: 1, signed: false });
  assert.equal(far.ws.got.some((m) => m.k === 'rc'), false, 'no receipt to one who never stood on the pixel');
  assert.deepEqual(hub._sevBoards.get(EV.id), top);
  assert.deepEqual((await takeStaffEventOrder(hub, { o: 'sevent', op: 'look' }, Date.now())).bd, [[EV.id, top]]);
  assert.deepEqual(hub.store.get(STAFF_EVENTS_KEY).b, [[EV.id, top]], 'kept in storage');
  assert.ok(watcher.ws.got.some((m) => m.k === 'end' && m.id === EV.id && m.why === 'boss'));
  assert.equal(cell.store.has(STAFF_LEDGER_PREFIX + EV.id), false, 'the cell told, its ledger gone');
  // a layer's word is the place's ledger's alone; an event the book does not hold is no word
  const ly = cell.join('ly', { sub: 'acctL', ly: 1, pose: poseOn(EV.px, EV.py) });
  await staffEventWord(cell, ly.ws, ly.a, w(3), Date.now());
  assert.deepEqual(ly.ws.got, []);
});

test('STAFF-EVENT THE REWARD: paid once at the first fall, signed with the relay\'s key; an event that runs on hands my receipt again to my word', async () => {
  const R = relay();
  const ev = { ...EV, eb: 0, m: 3 };
  await takeStaffEventOrder(R.hub, { o: 'sevent', op: 'start', ev }, Date.now());
  const cell = R.room(worldRoom(ev.px, ev.py));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  cell._receiptKeyOf = async () => kp.privateKey;
  const ann = cell.join('ann', { sub: 'acctA', name: 'Ann', pose: poseOn(ev.px, ev.py) });
  const w = (n, more = {}) => ({ k: 'w', id: ev.id, px: ev.px, py: ev.py, n, s: 1, bu: 0, bk: 0, fb: 0, h: n, ...more });
  const t0 = Date.now();
  await staffEventWord(cell, ann.ws, ann.a, w(3), t0);
  await staffEventWord(cell, ann.ws, ann.a, w(3, { bu: 1 }), t0 + 1000);
  await staffEventWord(cell, ann.ws, ann.a, w(3, { bu: 1, bk: 1 }), t0 + 2000);
  const got = () => ann.ws.got.filter((m) => m.k === 'rc').map((m) => m.r);
  assert.equal(got().length, 1);
  assert.equal(readStaffReceipt(got()[0]).signed, true, 'signed with the relay\'s key');
  assert.equal(R.hub._sevBook.length, 1, 'it runs on (eb 0)');
  await staffEventWord(cell, ann.ws, ann.a, w(3, { bu: 1, bk: 1 }), t0 + 3000);
  assert.deepEqual(got(), [got()[0], got()[0]], 'the same receipt again, never a second');
  assert.equal(ann.ws.got.filter((m) => m.k === 'bd').length, 1, 'the board said once');
});

test('STAFF-EVENT: the hub\'s door verifies the order with its own key - a forged or other-kind order is refused', async () => {
  const { hub } = relay();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const bad = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  hub._loadKey = async () => {};
  hub._verifyKey = kp.publicKey;
  const nowS = Math.floor(Date.now() / 1000);
  const good = await mintStaffEventOrder({ s: 'acct', op: 'start', ev: EV }, kp.privateKey, { subtle, nowS });
  assert.equal((await takeStaffEventLaw(hub, good, Date.now())).ok, true);
  const forged = await mintStaffEventOrder({ s: 'acct', op: 'end', ei: EV.id }, bad.privateKey, { subtle, nowS });
  assert.deepEqual(await takeStaffEventLaw(hub, forged, Date.now()), { ok: false });
  assert.equal(hub._sevBook.length, 1);
  assert.deepEqual(await takeStaffEventLaw(hub, 7, Date.now()), { ok: false });
});

// ═══ THE ACCOUNT SERVICE ═══
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const enc = new TextEncoder();
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  return { pub, proof: async (what, handle) => { const ts = Math.max(Math.floor(Date.now() / 1000), last + 1); last = ts; return { pub, ts, sig: b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts))))) }; } };
}
/** The Worker with mob (an Admin) and Asynian (a Moderator) signed in; the relay's door the stand-in hub above, with the
 *  service's own public key - so every order the doors push is verified and taken by the relay's real law. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({ DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY });
  const R = relay();
  R.hub._loadKey = async () => {};
  R.hub._verifyKey = s.identityPublic;
  const door = { up: true, pushed: 0 };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) !== RELAY) return real(url, init);
    door.pushed++;
    if (!door.up) throw new Error('down');
    const said = await takeStaffEventLaw(R.hub, JSON.parse(init.body).order, Date.now());
    return Response.json(said.ok ? said : { ...said, error: 'not taken' }, { status: said.ok ? 200 : 409 });
  };
  const call = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await call('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await call('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const k = await extensionKey();
  const asy = (await call('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await k.proof('enroll', 'Asynian')) })).body;
  return { ...s, R, door, call, mob, asy, raw: s.env.DB._raw, restore: () => { globalThis.fetch = real; } };
}
const STAGE = { rg: 17, loc: 0, px: 207, py: 213, nm: 'Daggerfall', ct: 1, mt: [7, 12], n: 30, m: 12, b: 24, bs: 250, bh: 25, eb: 1, mins: 60 };

test('STAFF-EVENT: THE ACCOUNT DOORS - Admins alone; a start stored, audited and taken by the hub; the meter read back; boss and end; an event the hub ended shown ended', async () => {
  const s = await stand();
  try {
    for (const r of EVENT_ROUTES) assert.ok(STAFF_ROUTES.has(r), `${r} is a staff door`);
    assert.ok(HOUR_JOBS.some(([n]) => n === 'staff-events'), 'kept a month');
    assert.equal(STAFF_EVENT_KEEP_S, 30 * 86400);
    // a Moderator is refused, and it is written down
    assert.deepEqual(await s.call('/v1/staff/events', {}, s.asy.session), { status: 403, body: { error: 'staff-admin' } });
    assert.equal((await s.call('/v1/staff/event', { op: 'start', ev: STAGE }, s.asy.session)).status, 403);
    // start
    let r = await s.call('/v1/staff/event', { op: 'start', ev: STAGE }, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ev = r.body.event;
    assert.equal(ev.state, 'live');
    assert.equal(ev.live, true);
    assert.deepEqual([ev.ev.mt, ev.ev.n, ev.ev.m, ev.ev.b, ev.ev.bs, ev.ev.bh, ev.ev.by], [[7, 12], 30, 12, 24, 250, 25, 'SirMcMobdon']);
    assert.equal(ev.ev.ue - ev.ev.at, 60 * 60_000, 'runs an hour');
    assert.deepEqual(s.R.hub._sevBook.map((e) => e.id), [ev.id], 'the relay\'s own law took it');
    const audit = s.raw.prepare("SELECT * FROM staff_audit WHERE act = 'event-start'").all();
    assert.equal(audit.length, 1);
    assert.equal(JSON.parse(audit[0].detail).health, 25);
    // bad stagings refused before the relay is asked
    const before = s.door.pushed;
    // EVENT-FAULT (mob 2026-10-25: "service refused"): each refusal names its field
    for (const [bad, field] of [[{ ...STAGE, n: 0 }, 'total'], [{ ...STAGE, m: 31 }, 'meter'], [{ ...STAGE, mt: [146] }, 'monsters'], [{ ...STAGE, bh: 101 }, 'health'], [{ ...STAGE, hp: 1_000_001 }, 'health'],
      [{ ...STAGE, mins: 1441 }, 'runs'], [{ ...STAGE, mins: -1 }, 'runs'], [{ ...STAGE, b: 39 }, 'boss'], [{ ...STAGE, bs: 99 }, 'size'], [{ ...STAGE, px: 1000 }, 'pixel'], [{ ...STAGE, loc: 10000 }, 'place'], [{ ...STAGE, rg: 256 }, 'region']]) {
      const r2 = await s.call('/v1/staff/event', { op: 'start', ev: bad }, s.mob.session);
      assert.deepEqual([r2.status, r2.body], [400, { error: `event-bad-${field}` }], JSON.stringify(bad));
    }
    assert.equal(s.door.pushed, before);
    // Spawn mini boss now: one more call at the hub, which tells the place's cell (its ledger calls the boss)
    r = await s.call('/v1/staff/event', { op: 'boss', id: ev.id }, s.mob.session);
    assert.equal(r.body.event.ev.fb, 1);
    assert.equal(r.body.event.boss, 'due');
    // the meter, as the hub last heard it from the cell
    s.R.hub._sevLive.set(ev.id, { id: ev.id, n: 9, bd: 1, bu: 1, bk: 0, fc: 1, bossN: 0, f: 3 });
    r = await s.call('/v1/staff/events', {}, s.mob.session);
    assert.deepEqual([r.body.relay, r.body.events.length, r.body.events[0].kills, r.body.events[0].boss, r.body.events[0].fighters], [true, 1, 9, 'up', 3]);
    assert.equal(s.raw.prepare('SELECT kills FROM staff_events').get().kills, 9, 'the meter kept on the row');
    // the relay down: the read shows the last meter heard, and says so
    s.door.up = false;
    r = await s.call('/v1/staff/events', {}, s.mob.session);
    assert.deepEqual([r.body.relay, r.body.events[0].kills, r.body.events[0].live], [false, 9, false]);
    assert.deepEqual((await s.call('/v1/staff/event', { op: 'end', id: ev.id }, s.mob.session)).body, { error: 'event-relay' });
    s.door.up = true;
    // end
    r = await s.call('/v1/staff/event', { op: 'end', id: ev.id }, s.mob.session);
    assert.deepEqual([r.body.event.state, r.body.event.endedBy], ['ended', 'staff']);
    assert.deepEqual(s.R.hub._sevBook, []);
    assert.deepEqual((await s.call('/v1/staff/event', { op: 'boss', id: ev.id }, s.mob.session)).body, { error: 'event-gone' });
    // one the hub ended on its own (its boss fell): the next read marks it ended in the game
    const two = (await s.call('/v1/staff/event', { op: 'start', ev: { ...STAGE, loc: -1, nm: 'Road' } }, s.mob.session)).body.event;
    s.R.hub._sevBook = [];
    s.R.hub._sevBoards.set(two.id, [['Ann', 12, 1]]);   // THE REWARD: its board, kept at the hub past its end
    r = await s.call('/v1/staff/events', {}, s.mob.session);
    assert.deepEqual(r.body.events.map((e) => [e.id, e.state, e.endedBy]), [[two.id, 'ended', 'game'], [ev.id, 'ended', 'staff']]);
    assert.deepEqual(r.body.events.map((e) => e.top), [[['Ann', 12, 1]], []], 'the board on its row');
    assert.equal(s.raw.prepare('SELECT top FROM staff_events WHERE id = ?').get(two.id).top, '[["Ann",12,1]]', 'kept on the row');
    // a full book: the hub's refusal in words, the row failed
    for (const id of ['ff000001', 'ff000002', 'ff000003', 'ff000004']) await takeStaffEventOrder(s.R.hub, { op: 'start', ev: { ...EV, id } }, Date.now());
    r = await s.call('/v1/staff/event', { op: 'start', ev: STAGE }, s.mob.session);
    assert.deepEqual([r.status, r.body.error], [409, 'event-full']);
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_events WHERE state = 'failed'").get().n, 1);
    // EVENT-CLEAR (mob 2026-10-25: "let me clear other events as well form history"): one over taken off, a live one never, then every one over
    const pushed = s.door.pushed;
    const live = s.raw.prepare("SELECT id FROM staff_events WHERE state = 'live'").all();
    s.raw.prepare("INSERT INTO staff_events (id, at, staff_id, staff_name, ev, state) VALUES ('ee000009', 1, 'x', 'x', '{}', 'live')").run();
    assert.deepEqual((await s.call('/v1/staff/event', { op: 'clear', id: 'ee000009' }, s.mob.session)).body, { error: 'event-live' });
    assert.equal((await s.call('/v1/staff/event', { op: 'clear', id: two.id }, s.asy.session)).status, 403, 'Admins alone');
    assert.deepEqual((await s.call('/v1/staff/event', { op: 'clear', id: two.id }, s.mob.session)).body, { ok: true, cleared: 1 });
    assert.deepEqual((await s.call('/v1/staff/event', { op: 'clear', all: 1 }, s.mob.session)).body, { ok: true, cleared: 2 }, 'the one ended by staff and the failed one');
    assert.deepEqual(s.raw.prepare('SELECT id FROM staff_events ORDER BY id').all().map((x) => x.id), [...live.map((x) => x.id), 'ee000009'].sort(), 'the live rows kept');
    assert.equal(s.door.pushed, pushed, 'the hub never asked');
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE act = 'event-clear'").get().n, 2);
  } finally { s.restore(); }
});

test('STAFF-EVENT: an event\'s id is the law\'s shape, and a staging is the law\'s event or nothing', () => {
  let i = 0;
  const id = mintEventId((b) => { for (let k = 0; k < b.length; k++) b[k] = i++ * 37; });
  assert.match(id, /^[a-z0-9]{10}$/);
  const e = stagedEvent(STAGE, id, 1_700_000_000, 'Admin');
  assert.deepEqual([e.id, e.at, e.ue, e.by, e.fb], [id, 1_700_000_000_000, 1_700_000_000_000 + 3_600_000, 'Admin', 0]);
  assert.equal(stagedEvent({ ...STAGE, mins: 0 }, id, 1_700_000_000, 'A').ue, 0, 'until it is ended');
  assert.equal(stagedEvent(null, id, 1, 'A'), null);
  assert.equal(stagedEvent({ ...STAGE, mins: 1.5 }, id, 1, 'A'), null);
});
