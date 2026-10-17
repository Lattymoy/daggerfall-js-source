// VOICE-REVOKE (bible/11-Multiplayer/Voice-Arc.md section 4): A SEAT ON THE SFU IS HELD, NOT KEPT. LiveKit reads a
// credential at the join alone, so the voice service sweeps: every seat in every SFU room it names, judged against the
// relay's word now - a member gone from the party or the room removed, a muted account's microphone shut, a seat this
// service never gave removed, a relay that did not answer leaving every seat be. Driven over a fake LiveKit RoomService
// (its Twirp doors, the bearer each call carries read back) and, end to end, through the service's own `sweep` and the
// relay's doors as the service asks them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceRoomName } from '../../src/net/voice/voiceWire.js';
import { seatMeta, readSeatMeta, seatVerdict, sweepVoice, VOICE_SWEEP_ROOMS_MAX, VOICE_SWEEP_MS } from '../../server-voice/src/revoker.js';
import { readJwtClaims } from '../../server-voice/src/livekitToken.js';
import voiceWorker, { sweep, _resetForTests } from '../../server-voice/src/index.js';
import { VOICE_ROOM_MAX } from '../../src/net/voice/voiceWire.js';

const { subtle } = globalThis.crypto;
const NOW_S = 1_760_000_000;
const ENV = { LIVEKIT_ADMIN_URL: 'https://sfu.test/', LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'devsecret_devsecret_devsecret_devsecret' };
const vx = (key, ly = 0) => voiceRoomName('proximity', key, ly, subtle);
const seat = (identity, s, { publish = true } = {}) => ({ identity, metadata: seatMeta(s), permission: { can_subscribe: true, can_publish: publish, can_publish_data: false } });

/** LiveKit's RoomService, as far as the sweep calls it: `rooms` its rooms and their seats, `calls` every call with the
 *  grant its bearer carried; `fail` a method (and room) that answers 500. */
function fakeSfu(rooms, { fail = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    assert.equal(u.origin + u.pathname.replace(/[^/]+$/, ''), 'https://sfu.test/twirp/livekit.RoomService/');
    const method = u.pathname.split('/').pop();
    const body = JSON.parse(init.body);
    const bearer = readJwtClaims(String(init.headers.authorization).replace(/^Bearer /, ''));
    calls.push([method, body, bearer?.video]);
    const ok = (v) => ({ ok: true, json: async () => v });
    if (fail && fail.method === method && (!fail.room || fail.room === body.room)) return { ok: false, status: 500, json: async () => ({}) };
    if (method === 'ListRooms') return ok({ rooms: Object.keys(rooms).map((name) => ({ name, num_participants: rooms[name].length })) });
    if (method === 'ListParticipants') return ok({ participants: rooms[body.room] ?? [] });
    if (method === 'RemoveParticipant') { rooms[body.room] = rooms[body.room].filter((p) => p.identity !== body.identity); return ok({}); }
    if (method === 'UpdateParticipant') { for (const p of rooms[body.room]) if (p.identity === body.identity) p.permission = body.permission; return ok({}); }
    throw new Error(`no such method ${method}`);
  };
  return { calls, fetchImpl, rooms };
}

test('VOICE-REVOKE the seat: what a credential is for, carried in it and read back - anything this service did not mint reads as no seat at all', () => {
  assert.equal(VOICE_SWEEP_MS, 20_000);
  for (const s of [{ c: 'x', k: 'world:12,34', l: 0 }, { c: 'x', k: 'dungeon:m187853213.i0123456789abcdef.89abcdef', l: 7 }, { c: 'p', k: 'q1abc2def3', l: 0 }]) assert.deepEqual(readSeatMeta(seatMeta(s)), s);
  for (const bad of [undefined, '', 'nope', '[]', 'null', '{"c":"g","k":"q1abc2def3","l":0}', '{"c":"p","k":"cell:1","l":0}', '{"c":"p","k":"q1abc2def3","l":1}',
    '{"c":"x","k":"../etc","l":0}', '{"c":"x","k":"world:1,2","l":8}', '{"c":"x","k":"world:1,2","l":-1}', '{"c":"x","k":"world:1,2","l":"0"}', '{"c":"x","k":"world:1,2"}']) {
    assert.equal(readSeatMeta(bad), null, String(bad));
  }
});

test('VOICE-REVOKE the verdict: a seat is kept while the relay says it may, removed when it says it may not, its microphone shut while muted - and a seat that is not ours, or sits in a room not its own, removed', async () => {
  const room = await vx('world:12,34'), layer = await vx('world:12,34', 2);
  const nowS = NOW_S;
  const judge = (r, p, { here = true, standing = { party: null, mu: 0 } } = {}) => seatVerdict(r, p, { nowS, subtle, presenceOf: async () => here, standingOf: async () => standing });
  const near = seat('peer_aaaa', { c: 'x', k: 'world:12,34', l: 0 });
  assert.equal(await judge(room, near), 'keep');
  assert.equal(await judge(`${room}_s3`, near), 'keep', 'a shard of its room is its room');
  assert.equal(await judge(room, near, { here: false }), 'remove', 'gone from the room: the seat goes');
  assert.equal(await judge(room, near, { here: null }), 'keep', 'the relay silent: next sweep');
  assert.equal(await judge(room, near, { here: true, standing: { party: null, mu: nowS + 60 } }), 'mute', 'a mute laid on since the credential');
  assert.equal(await judge(room, near, { here: true, standing: { party: null, mu: nowS } }), 'keep', 'a mute that ended');
  assert.equal(await judge(room, seat('peer_aaaa', { c: 'x', k: 'world:12,34', l: 0 }, { publish: false }), { standing: { party: null, mu: nowS + 60 } }), 'keep', 'already shut: nothing to do');
  assert.equal(await judge(room, near, { standing: null }), 'keep', 'the hub silent: no mute known');
  assert.equal(await judge(room, near, { standing: { party: null, mu: 0, bn: nowS + 60 } }), 'remove', 'VOICE-BAN: banned, whatever the room says');
  assert.equal(await judge(room, near, { standing: { party: null, mu: 0, bn: nowS } }), 'keep', 'a ban that ended');
  // a seat in a room its credential does not name: another layer, another key, a lookalike of an instance
  assert.equal(await judge(layer, near), 'remove');
  assert.equal(await judge(await vx('world:12,35'), near), 'remove');
  assert.equal(await judge(room, { ...near, metadata: undefined }), 'remove', 'no seat of ours');
  assert.equal(await judge(room, { ...near, metadata: 'forged' }), 'remove');
  assert.equal(await judge('lobby', near), 'remove', 'a room this service never names');
  assert.equal(await judge(room, { ...near, identity: '' }), 'remove');
  // a party seat: the hub's word on the party, and its mute
  const proom = await voiceRoomName('party', 'q1abc2def3');
  const mate = seat('peer_bbbb', { c: 'p', k: 'q1abc2def3', l: 0 });
  assert.equal(await judge(proom, mate, { standing: { party: 'q1abc2def3', mu: 0 } }), 'keep');
  assert.equal(await judge(proom, mate, { standing: { party: null, mu: 0 } }), 'remove', 'kicked, or left');
  assert.equal(await judge(proom, mate, { standing: { party: 'q9other999', mu: 0 } }), 'remove', 'in another party now');
  assert.equal(await judge(proom, mate, { standing: null }), 'keep', 'the hub silent: next sweep');
  assert.equal(await judge(proom, mate, { standing: { party: 'q1abc2def3', mu: nowS + 60 } }), 'mute');
  assert.equal(await judge(proom, mate, { standing: { party: 'q1abc2def3', mu: 0, bn: nowS + 60 } }), 'remove', 'VOICE-BAN: banned, though still in the party');
  assert.equal(await judge(proom, mate, { here: false, standing: { party: 'q1abc2def3', mu: 0 } }), 'keep', 'a party seat is not asked where it stands');
});

test('VOICE-REVOKE the sweep: ListRooms on a list-only bearer, each room of ours read and judged on a bearer for that room alone, the seat removed or its microphone shut; another\'s rooms and a failing room cost nothing', async () => {
  const room = await vx('world:12,34'), proom = await voiceRoomName('party', 'q1abc2def3');
  const sfu = fakeSfu({
    [room]: [seat('peer_stay', { c: 'x', k: 'world:12,34', l: 0 }), seat('peer_gone', { c: 'x', k: 'world:12,34', l: 0 }), seat('peer_hush', { c: 'x', k: 'world:12,34', l: 0 }), { identity: 'peer_odd' }, { identity: '', metadata: 'x' }],
    [proom]: [seat('peer_kick', { c: 'p', k: 'q1abc2def3', l: 0 }), seat('peer_mate', { c: 'p', k: 'q1abc2def3', l: 0 })],
    lobby: [seat('peer_else', { c: 'x', k: 'world:12,34', l: 0 })],
  });
  const presenceOf = async (acct) => acct !== 'peer_gone';
  const standingOf = async (acct) => ({ party: acct === 'peer_kick' ? null : 'q1abc2def3', mu: acct === 'peer_hush' ? NOW_S + 600 : 0 });
  const out = await sweepVoice({ env: ENV, fetchImpl: sfu.fetchImpl, subtle, nowS: NOW_S, presenceOf, standingOf });
  // the rooms in name order (vp_ before vx_), each room's seats in the SFU's
  assert.deepEqual(out, { rooms: 2, removed: [`${proom}/peer_kick`, `${room}/peer_gone`, `${room}/peer_odd`], muted: [`${room}/peer_hush`], next: 2 });
  assert.deepEqual(sfu.rooms[room].map((p) => p.identity), ['peer_stay', 'peer_hush', '']);
  assert.deepEqual(sfu.rooms[room][1].permission, { can_subscribe: true, can_publish: false, can_publish_data: false }, 'muted: may listen, not publish');
  assert.deepEqual(sfu.rooms[proom].map((p) => p.identity), ['peer_mate']);
  assert.equal(sfu.rooms.lobby.length, 1, 'a room this service never named is never read');
  // every bearer: the list grant alone for ListRooms, the room's own admin grant for the rest
  assert.deepEqual(sfu.calls[0], ['ListRooms', {}, { roomList: true }]);
  for (const [method, body, video] of sfu.calls.slice(1)) assert.deepEqual(video, { room: body.room, roomAdmin: true, roomCreate: true }, method);
  assert.ok(!sfu.calls.some(([, b]) => b.identity === ''), 'a seat with no identity is never named to a Remove');
  // a room whose read fails: skipped, the rest still swept
  const warn = console.warn; console.warn = () => {};
  try {
    const two = fakeSfu({ [room]: [seat('peer_gone', { c: 'x', k: 'world:12,34', l: 0 })], [proom]: [seat('peer_kick', { c: 'p', k: 'q1abc2def3', l: 0 })] }, { fail: { method: 'ListParticipants', room: [room, proom].sort()[0] } });
    const r = await sweepVoice({ env: ENV, fetchImpl: two.fetchImpl, subtle, nowS: NOW_S, presenceOf, standingOf });
    assert.equal(r.removed.length, 1, 'the other room still swept');
    // the SFU's list down: the sweep throws (the cron logs it), nothing judged
    await assert.rejects(sweepVoice({ env: ENV, fetchImpl: fakeSfu({}, { fail: { method: 'ListRooms' } }).fetchImpl, subtle, nowS: NOW_S, presenceOf, standingOf }), /ListRooms 500/);
  } finally { console.warn = warn; }
  // no admin door, no key: skipped, no call
  for (const env of [{ ...ENV, LIVEKIT_ADMIN_URL: '' }, { ...ENV, LIVEKIT_API_SECRET: '' }]) {
    const none = fakeSfu({ [room]: [seat('peer_gone', { c: 'x', k: 'world:12,34', l: 0 })] });
    assert.deepEqual(await sweepVoice({ env, fetchImpl: none.fetchImpl, subtle, nowS: NOW_S, presenceOf, standingOf }), { skipped: true, rooms: 0, removed: [], muted: [], next: 0 });
    assert.deepEqual(none.calls, []);
  }
});

test('VOICE-REVOKE the budget: VOICE_SWEEP_ROOMS_MAX rooms a sweep, inside a Worker invocation\'s 1,000 subrequests at full rooms - the next sweep starts where this one stopped, so every room is reached', async () => {
  assert.ok(1 + VOICE_SWEEP_ROOMS_MAX + 3 * VOICE_SWEEP_ROOMS_MAX * VOICE_ROOM_MAX <= 1000);
  const n = VOICE_SWEEP_ROOMS_MAX + 5;
  const keys = Array.from({ length: n }, (_, i) => `world:${i},0`);
  const rooms = {};
  for (const k of keys) rooms[await vx(k)] = [seat('peer_gone', { c: 'x', k, l: 0 })];
  const sfu = fakeSfu(rooms);
  const judge = { presenceOf: async () => false, standingOf: async () => ({ party: null, mu: 0 }) };
  const first = await sweepVoice({ env: ENV, fetchImpl: sfu.fetchImpl, subtle, nowS: NOW_S, ...judge });
  assert.equal(first.rooms, VOICE_SWEEP_ROOMS_MAX); assert.equal(first.next, VOICE_SWEEP_ROOMS_MAX);
  const second = await sweepVoice({ env: ENV, fetchImpl: sfu.fetchImpl, subtle, nowS: NOW_S, start: first.next, ...judge });
  assert.equal(second.rooms, VOICE_SWEEP_ROOMS_MAX, 'wrapped round');
  assert.ok(Object.values(sfu.rooms).every((seats) => seats.length === 0), 'every room reached in two sweeps');
});

test('VOICE-REVOKE end to end: the service\'s sweep asks the relay\'s doors behind the secret, removes the member the hub no longer seats and shuts the microphone the hub muted, keeps every seat while the relay is silent; the Worker\'s cron runs it', async () => {
  _resetForTests();
  const room = await vx('world:12,34'), proom = await voiceRoomName('party', 'q1abc2def3');
  const rooms = { [room]: [seat('peer_near', { c: 'x', k: 'world:12,34', l: 0 }), seat('peer_left', { c: 'x', k: 'world:12,34', l: 0 })], [proom]: [seat('peer_kick', { c: 'p', k: 'q1abc2def3', l: 0 }), seat('peer_hush', { c: 'p', k: 'q1abc2def3', l: 0 }), seat('peer_exile', { c: 'p', k: 'q1abc2def3', l: 0 })] };
  const sfu = fakeSfu(rooms);
  const asked = [];
  let up = true;
  const relay = async (url, init) => {
    const body = JSON.parse(init.body);
    asked.push([new URL(url).pathname, init.headers['x-voice-relay-secret'], body]);
    if (!up) return { ok: false, status: 503, json: async () => ({ error: 'unavailable' }) };
    if (url.endsWith('/presence')) return { ok: true, json: async () => ({ here: body.acct === 'peer_near' }) };
    return { ok: true, json: async () => ({ party: body.acct === 'peer_kick' ? null : 'q1abc2def3', mu: body.acct === 'peer_hush' ? NOW_S + 600 : 0, bn: body.acct === 'peer_exile' ? NOW_S + 3600 : 0 }) };
  };
  const fetchImpl = (url, init) => (String(url).startsWith('https://sfu.test/') ? sfu.fetchImpl(url, init) : relay(url, init));
  const env = { ...ENV, RELAY_URL: 'https://relay.test', VOICE_RELAY_SECRET: 's3cret' };
  // the relay silent: nothing taken
  up = false;
  const quiet = await sweep(env, { now: () => NOW_S * 1000, fetch: fetchImpl, subtle });
  assert.deepEqual([quiet.removed, quiet.muted], [[], []], 'an outage drops no call');
  assert.ok(asked.length > 0 && asked.every(([, secret]) => secret === 's3cret'));
  up = true;
  const out = await sweep(env, { now: () => NOW_S * 1000 + 10_000, fetch: fetchImpl, subtle });
  assert.deepEqual(out.removed.sort(), [`${proom}/peer_exile`, `${proom}/peer_kick`, `${room}/peer_left`].sort(), 'VOICE-BAN: the banned member too, still in the party');
  assert.deepEqual(out.muted, [`${proom}/peer_hush`]);
  assert.deepEqual(asked.filter(([p, , b]) => p === '/internal/voice/presence' && b.acct === 'peer_near').at(-1)[2], { acct: 'peer_near', room: 'world:12,34', ly: 0 }, 'the room and layer its seat names');
  // the Worker: a cron event runs the same sweep under waitUntil
  assert.equal(typeof voiceWorker.scheduled, 'function');
  const waited = [];
  voiceWorker.scheduled({}, { ...ENV, LIVEKIT_ADMIN_URL: '' }, { waitUntil: (p) => waited.push(p) });
  assert.equal(waited.length, 1); assert.deepEqual(await waited[0], { skipped: true, rooms: 0, removed: [], muted: [], next: 0 });
});
