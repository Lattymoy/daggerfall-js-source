// STAFF-PULL (2026-10-28, as the owner asked): an Admin or the Shadow Fang brings a player to where they
// stand - the wire's `pull` and `landed`, the hub's routing (server/src/staffTeleport.js routeStaffPull), the client's
// landing, the /tpa command and the page's host (scenes/staffPullHost.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validStaffDestination, validStaffTeleportIn, validStaffTeleportOut, createStaffTeleportClient, staffPullSupported, staffPullAllowed, STAFF_PULL_TIMEOUT_MS } from '../../src/net/staffTeleport.js';
import { parseClient, SOCIAL_ROOM, RELAY_VERSION } from '../../src/net/wire.js';
import { parseStaffCommand } from '../../src/net/staffCommands.js';
import { createStaffPull } from '../../src/scenes/staffPullHost.js';
import { staffHookDoor } from '../../src/net/staffHook.js';
import { OnlineSession } from '../../src/net/online.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';

const here = validStaffDestination({ kind: 'exterior', pixel: { x: 207, y: 213 }, pos: [123456.5, -14.25, 654321.75], yaw: 0.8, pitch: -0.3 });

async function hub(fn) {
  const r = fakeRoom(SOCIAL_ROOM), realNow = Date.now; let now = 1e12; Date.now = () => now;
  const tick = (ms = 1000) => { now += ms; };
  const join = async (id, name, glyphs = [], extra = {}) => { const ws = r.connect(); await r.hello(ws, id, null, { name, glyphs, acct: `acct-${id}`, asecret: `secret-${id}`, ...extra }); tick(); return ws; };
  const send = (ws, m) => r.raw(ws, JSON.stringify({ t: 'stp', ...m }));
  try { await fn({ r, tick, join, send }); } finally { Date.now = realNow; }
}
const heard = (ws, k) => ws.sent.filter((m) => m.t === 'stp' && m.k === k);

test('STAFF-PULL wire: a pull names one player and a valid place; a landed answers a ticket (mutants: two names kept, a bad place passed)', () => {
  assert.deepEqual(validStaffTeleportIn({ k: 'pull', nonce: 'n1', name: ' Bran ', dest: here }), { k: 'pull', nonce: 'n1', name: 'Bran', dest: here });
  assert.deepEqual(validStaffTeleportIn({ k: 'pull', nonce: 'n1', acct: 'acct-bran', dest: here }), { k: 'pull', nonce: 'n1', acct: 'acct-bran', dest: here });
  assert.deepEqual(validStaffTeleportIn({ k: 'pull', nonce: 'n1', id: 'peer-bran', dest: here }), { k: 'pull', nonce: 'n1', id: 'peer-bran', dest: here });
  assert.equal(validStaffTeleportIn({ k: 'pull', nonce: 'n1', id: 'peer-bran', name: 'Bran', dest: here }), null);
  assert.equal(validStaffTeleportIn({ k: 'pull', nonce: 'n1', name: 'Bran', dest: { ...here, pos: [NaN, 0, 0] } }), null);
  assert.equal(validStaffTeleportIn({ k: 'pull', nonce: 'n1', name: 'Bran' }), null);
  assert.deepEqual(validStaffTeleportIn({ k: 'landed', ticket: 't1' }), { k: 'landed', ticket: 't1' });
  assert.deepEqual(validStaffTeleportIn({ k: 'landed', ticket: 't1', no: 'battle' }), { k: 'landed', ticket: 't1', no: 'battle' });
  assert.equal(validStaffTeleportIn({ k: 'landed', ticket: 't1', no: 'made up' }), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'stp', k: 'pull', nonce: 'n1', name: 'Bran', dest: here }), { hasHello: true }), { t: 'stp', k: 'pull', nonce: 'n1', name: 'Bran', dest: here });
  assert.deepEqual(validStaffTeleportOut({ k: 'pull', ticket: 't1', dest: here }), { k: 'pull', ticket: 't1', dest: here });
  assert.equal(validStaffTeleportOut({ k: 'pull', ticket: 't1', dest: null }), null);
  assert.deepEqual(validStaffTeleportOut({ k: 'result', nonce: 'n1', id: 'peer-bran', name: 'Bran', pulled: 1 }), { k: 'result', nonce: 'n1', id: 'peer-bran', name: 'Bran', pulled: 1 });
});

test('STAFF-PULL who may: an Admin and the Shadow Fang, never a Dungeon Master or a player', () => {
  assert.equal(staffPullAllowed(['dev']), true);
  assert.equal(staffPullAllowed(['shadowfang']), true);
  assert.equal(staffPullAllowed(['dm']), false);
  assert.equal(staffPullAllowed([]), false);
});

for (const glyph of ['dev', 'shadowfang']) test(`STAFF-PULL relay: ${glyph} brings a player - only that player is sent the place, and only its landed answers`, () => hub(async ({ join, send }) => {
  const staff = await join('peer-staff', 'Warden', [glyph]), bran = await join('peer-bran', 'Bran'), other = await join('peer-other', 'Other');
  await send(staff, { k: 'pull', nonce: 'p1', name: 'Bran', dest: here });
  const pull = heard(bran, 'pull').at(-1);
  assert.ok(pull); assert.deepEqual(pull.dest, here);
  assert.equal(heard(other, 'pull').length, 0);
  await send(other, { k: 'landed', ticket: pull.ticket });
  assert.equal(heard(staff, 'result').length, 0, 'a stranger cannot answer the ticket');
  await send(bran, { k: 'answer', ticket: pull.ticket, dest: here });
  assert.equal(heard(staff, 'result').length, 0, 'a capture answer is no landing');
  await send(bran, { k: 'landed', ticket: pull.ticket });
  const result = heard(staff, 'result').at(-1);
  assert.equal(result.pulled, 1); assert.equal(result.id, 'peer-bran'); assert.equal(result.acct, 'acct-peer-bran');
  await send(bran, { k: 'landed', ticket: pull.ticket });
  assert.equal(heard(staff, 'result').length, 1, 'a replayed landing says nothing');
}));

test('STAFF-PULL relay: a Dungeon Master and a player are denied; nobody is sent a place', () => hub(async ({ join, send, tick }) => {
  const dm = await join('peer-dm', 'Keeper', ['dm']), normal = await join('peer-normal', 'Normal'), bran = await join('peer-bran', 'Bran');
  await send(dm, { k: 'pull', nonce: 'p1', name: 'Bran', dest: here }); tick();
  await send(normal, { k: 'pull', nonce: 'p2', name: 'Bran', dest: here, glyphs: ['dev'] });
  assert.equal(heard(dm, 'result').at(-1).error, 'denied');
  assert.equal(heard(normal, 'result').at(-1).error, 'denied');
  assert.equal(heard(bran, 'pull').length, 0);
}));

test('STAFF-PULL relay: by account, offline, ambiguous, a frozen player refused, and a landing error passed on', () => hub(async ({ join, send, tick }) => {
  const staff = await join('peer-staff', 'Warden', ['dev']), bran = await join('peer-bran', 'Bran'), brandon = await join('peer-brandon', 'Brandon');
  await join('peer-cold', 'Cold', [], { fz: Math.floor(Date.now() / 1000) + 3600, fv: 1 });
  await send(staff, { k: 'pull', nonce: 'p1', acct: 'acct-peer-brandon', dest: here }); tick();
  assert.equal(heard(brandon, 'pull').length, 1); assert.equal(heard(bran, 'pull').length, 0);
  await send(brandon, { k: 'landed', ticket: heard(brandon, 'pull').at(-1).ticket, no: 'battle' });
  assert.equal(heard(staff, 'result').at(-1).error, 'battle');
  assert.equal(brandon.closed, null, 'a refusal is no fault: the socket stays');
  await send(staff, { k: 'pull', nonce: 'p2', name: 'Bra', dest: here }); tick();
  assert.equal(heard(staff, 'result').at(-1).error, 'ambiguous');
  await send(staff, { k: 'pull', nonce: 'p3', name: 'Nobody', dest: here }); tick();
  assert.equal(heard(staff, 'result').at(-1).error, 'offline');
  await send(staff, { k: 'pull', nonce: 'p4', name: 'Cold', dest: here }); tick();
  assert.equal(heard(staff, 'result').at(-1).error, 'frozen');
  await send(staff, { k: 'pull', nonce: 'p5', name: 'Warden', dest: here });
  assert.equal(heard(staff, 'result').at(-1).error, 'offline', 'staff never pull themselves');
}));

test('STAFF-PULL relay: a landing after the ticket lapsed moves nothing it says', () => hub(async ({ join, send, tick }) => {
  const staff = await join('peer-staff', 'Warden', ['dev']), bran = await join('peer-bran', 'Bran');
  await send(staff, { k: 'pull', nonce: 'p1', name: 'Bran', dest: here });
  const ticket = heard(bran, 'pull').at(-1).ticket;
  tick(STAFF_PULL_TIMEOUT_MS + 1000);
  await send(staff, { k: 'ask', nonce: 'a1', name: 'Bran' });
  await send(bran, { k: 'landed', ticket });
  assert.equal(heard(staff, 'result').filter((m) => m.pulled).length, 0);
}));

test('STAFF-PULL client: a pull waits its own time; the hub\'s pull lands me and answers once; no host or a second pull is refused', async () => {
  const sent = [], timers = new Map(); let next = 0;
  let land = null;
  const c = createStaffTeleportClient({ send: (m) => { sent.push(m); return true; }, capture: () => ({ dest: here }), pulled: (d) => new Promise((resolve) => { land = () => resolve({}); assert.deepEqual(d, here); }), setTimer: (f, ms) => { timers.set(++next, { f, ms }); return next; }, clearTimer: (id) => timers.delete(id) });
  const p = c.pull({ name: 'Bran' }, here);
  assert.deepEqual(sent.at(-1), { k: 'pull', name: 'Bran', dest: here, nonce: sent.at(-1).nonce });
  assert.equal([...timers.values()][0].ms, STAFF_PULL_TIMEOUT_MS);
  c.receive({ k: 'result', nonce: sent.at(-1).nonce, id: 'peer-bran', name: 'Bran', pulled: 1 });
  assert.equal((await p).pulled, 1);
  c.receive({ k: 'pull', ticket: 'ticket-1', dest: here });
  c.receive({ k: 'pull', ticket: 'ticket-2', dest: here });
  assert.deepEqual(sent.at(-1), { k: 'landed', ticket: 'ticket-2', no: 'busy' });
  land(); await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent.at(-1), { k: 'landed', ticket: 'ticket-1' });
  const bare = createStaffTeleportClient({ send: (m) => { sent.push(m); return true; }, capture: () => ({ dest: here }) });
  bare.receive({ k: 'pull', ticket: 'ticket-3', dest: here }); await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent.at(-1), { k: 'landed', ticket: 'ticket-3', no: 'unavailable' });
});

test('STAFF-PULL session: a relay before world281 is never sent a pull', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Warden', id: 'peer-staff', secret: 'secret-staff', WebSocketImpl: FakeWS, presence: false });
  s.join(SOCIAL_ROOM); const ws = sockets[0]; ws.open();
  const welcome = (v) => ws.receive({ t: 'welcome', id: 'peer-staff', peers: [], n: 1, v });
  const pull = { k: 'pull', nonce: 'n1', name: 'Bran', dest: here };
  welcome('world280');
  assert.equal(staffPullSupported('world280'), false);
  assert.equal(s.sendStaffTeleport(pull), false);
  assert.equal(s.sendStaffTeleport({ k: 'ask', nonce: 'n2', name: 'Bran' }), true, 'the ask still goes');
  assert.equal(ws.sent.map(JSON.parse).some((m) => m.t === 'stp' && m.k === 'pull'), false);
  welcome(RELAY_VERSION);
  assert.equal(s.sendStaffTeleport(pull), true);
  s.leave();
});

test('STAFF-PULL /tpa: a name, with or without @; none is its usage line', () => {
  assert.deepEqual(parseStaffCommand('/tpa Bran'), { cmd: 'tpa', player: 'Bran' });
  assert.deepEqual(parseStaffCommand('/TPA @Bran the Tall'), { cmd: 'tpa', player: 'Bran the Tall' });
  assert.deepEqual(parseStaffCommand('/tpa'), { error: 'Usage: /tpa <player>.' });
});

test('STAFF-PULL host: staff send their own place; a player lands through the /tp loader, held and told, or answers why not', async () => {
  const log = [];
  const deps = (over = {}) => ({ client: () => ({ pull: async (target, dest) => { log.push(['pull', target, dest]); return { name: 'Bran' }; } }), here: () => ({ dest: here }),
    prepare: async (d) => log.push(['prepare', d]), place: (d) => log.push(['place', d]), why: () => null, alive: () => true, hold: (on) => log.push(['hold', on]), fade: { smashHUDToBlack() {}, fadeHUDFromBlack() {} }, glyphs: () => ['dev'], say: (line) => log.push(['say', line]), ...over });
  const line = await createStaffPull(deps()).pull({ name: 'Bran' });
  assert.match(line, /Bran was brought to you/);
  assert.deepEqual(log.shift(), ['pull', { name: 'Bran' }, here]);
  await assert.rejects(createStaffPull(deps({ here: () => ({ error: 'busy' }) })).pull({ name: 'Bran' }), /cannot be sent/);
  assert.deepEqual(await createStaffPull(deps()).land(here), {});
  assert.deepEqual(log.map((e) => e[0]), ['hold', 'prepare', 'place', 'say', 'hold']);
  log.length = 0;
  assert.deepEqual(await createStaffPull(deps({ why: () => 'battle' })).land(here), { error: 'battle' });
  assert.equal(log.length, 0, 'a player in a battle is not moved');
  assert.deepEqual(await createStaffPull(deps({ prepare: async () => { throw new Error('blocked'); } })).land(here), { error: 'unavailable' });
  assert.deepEqual(log.map((e) => e[0]), ['hold', 'hold'], 'a failed landing lets go and places nothing');
  log.length = 0;
  assert.deepEqual(await createStaffPull(deps({ alive: () => false })).land(here), { error: 'unavailable' });
  assert.equal(log.some((e) => e[0] === 'place'), false, 'a death during the load places nothing');
});

test('STAFF-PULL hook: the panel\'s pull of an account answers with the line or the error', async () => {
  const listeners = [], posted = [];
  const win = { location: { origin: 'https://daggerfalljs.dev' }, addEventListener: (k, f) => listeners.push(f), postMessage: (m) => posted.push(m) };
  const asked = [];
  staffHookDoor(win, () => null, { pull: async (sub) => { asked.push(sub); if (sub === 'acct-gone') throw new Error('That player is not online.'); return 'Bran was brought to you.'; } });
  const say = (data) => listeners.forEach((f) => f({ source: win, origin: win.location.origin, data }));
  say({ dfoStaff: 'pull', sub: 'acct-bran' });
  say({ dfoStaff: 'pull', sub: 'bad sub!' });
  say({ dfoStaff: 'pull', sub: 'acct-gone' });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(asked, ['acct-bran', 'acct-gone']);
  assert.deepEqual(posted, [{ dfoStaff: 'pulled', sub: 'acct-bran', ok: true, line: 'Bran was brought to you.' }, { dfoStaff: 'pulled', sub: 'acct-gone', ok: false, line: 'That player is not online.' }]);
});

test('STAFF-PULL /tpa host: a Dungeon Master is told no and nothing is sent; staff are told the line', async () => {
  const sent = [], told = [];
  const make = (glyphs) => createStaffPull({ client: () => ({ pull: async (target) => { sent.push(target); return { name: 'Bran' }; } }), glyphs: () => glyphs, here: () => ({ dest: here }),
    prepare: async () => {}, place: () => {}, why: () => null, alive: () => true, hold: () => {}, fade: {}, say: () => {} });
  make(['dm']).command('Bran', (l) => told.push(l));
  assert.equal(sent.length, 0); assert.match(told.at(-1), /Only an admin/);
  make(['shadowfang']).command('Bran', (l) => told.push(l)); await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, [{ name: 'Bran' }]); assert.match(told.at(-1), /Bran was brought to you/);
});
