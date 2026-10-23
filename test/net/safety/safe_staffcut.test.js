// STAFF-PANEL2-FIX (2026-10-22; design doc "DFO Staff Panel: design", Weak spots: "Cutting off a staff member misses most
// doors" - "the cut also ends the person's game sessions and pushes a relay order that strips their staff glyphs"): THE
// STAFF CUT'S ORDER AT THE RELAY. The service's door (SAFE_LAW_PATH) hands the hub a signed `{o:'staffcut', s, i, e}`
// (net/identityToken.js mintStaffCutOrder, server-account/src/staff.js /v1/staff/cut), and the hub closes each of the
// account's sockets whose token was minted before it - CLOSE_POLICY 'staff-cut' - so the staff glyphs that token carried
// leave with it (server/src/index.js `_staffCut`).
//
// STAFF-PANEL5-CUT-FIX (mob: after a cut the member keeps "no staff glyph, no hidden socket and no staff power anywhere"):
// the hub hands each of those sockets the order first (`law`), so the member's own client carries it to every room it
// holds - by the ban's door (`_banFrame`), where a room closes the account's sockets as the hub does - and the hub keeps the
// cut beside its bans (in storage, BAN_KEEP_S), so a token from before the cut that the client still holds opens it no
// more (`_bannedHello`) - and with it no lease for any other room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { CHAT_WORLD_ROOM, SAFE_LAW_PATH, CLOSE_POLICY } from '../../../src/net/wire.js';
import { mintStaffCutOrder, mintToken, orderValid, ORDER_TTL_S } from '../../../src/net/identityToken.js';

const subtle = globalThis.crypto.subtle;
const CUT = { code: CLOSE_POLICY, reason: 'staff-cut' };

test('STAFF-PANEL2-FIX: A STAFF CUT AT THE SERVICE\'S DOOR closes the account\'s socket whose token it postdates - CLOSE_POLICY \'staff-cut\', the room told its leave - and leaves a stranger and a socket on a newer token alone (mutants: the order refused at the door; the hub\'s kinds; the close; the newer token closed)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const kp = await hub.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const tok = (n, at) => mintToken({ s: 'acct-cutt-0001', n, k: 'linked', g: ['dev'] }, kp.privateKey, { subtle, nowS: at });
  const staffer = hub.connect(); await hub.hello(staffer, 'cutt-0001', null, { tok: await tok('cutt-0001', nowS - 5) });
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0003', null, { kind: 'linked' });
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const post = (order) => worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env);
  const cut = await mintStaffCutOrder({ s: 'acct-cutt-0001' }, kp.privateKey, { subtle, nowS });
  const said = await post(cut);
  assert.equal(said.status, 200);
  assert.deepEqual(await said.json(), { ok: true });
  assert.deepEqual(staffer.closed, CUT);
  assert.equal(bob.closed, null, 'a stranger stays');
  assert.deepEqual(bob.sent.filter((m) => m.t === 'leave').map((l) => l.id), ['cutt-0001'], 'and the room said its leave');
  assert.ok(!staffer.sent.some((m) => m.t === 'banned'), 'no ban said');
  // STAFF-PANEL5-CUT-FIX: the order handed to carry, before the close
  assert.deepEqual(staffer.sent.filter((m) => m.t === 'law'), [{ t: 'law', order: cut }], 'handed to carry to every room it holds');
  assert.equal(bob.sent.some((m) => m.t === 'law'), false, 'to nobody else');
  // a reconnect on a token from before the cut - one the client still holds, of the cut's own second too - is refused, a
  // wake later as well (kept in storage); a socket on a token minted after the cut - the service's word now - is let be
  for (const [id, at] of [['cutt-0011', nowS - 5], ['cutt-0012', nowS]]) {
    const back = hub.connect(); await hub.hello(back, id, null, { tok: await tok(id, at) });
    assert.deepEqual(back.closed, CUT, `${id}'s token from before the cut`);
  }
  hub.wake();
  const woke = hub.connect(); await hub.hello(woke, 'cutt-0013', null, { tok: await tok('cutt-0013', nowS - 1) });
  assert.deepEqual(woke.closed, CUT, 'the cut kept across a wake');
  assert.ok(!woke.sent.some((m) => m.t === 'welcome'), 'refused before its welcome');
  const fresh = hub.connect(); await hub.hello(fresh, 'cutt-0021', null, { tok: await tok('cutt-0021', nowS + 2) });
  assert.equal(fresh.closed, null, 'a token minted after the cut');
  const cut2 = await mintStaffCutOrder({ s: 'acct-cutt-0001' }, kp.privateKey, { subtle, nowS: nowS + 1 });
  assert.equal((await post(cut2)).status, 200);
  assert.equal(fresh.closed, null);
});

test('STAFF-PANEL2-FIX: A STAFF CUT IS THE SERVICE\'S ALONE - forged it is refused at the door and carried in it is nothing; STAFF-PANEL5-CUT-FIX: carried in signed (the member\'s own client, handed the hub\'s `law`), any room closes the account\'s sockets it postdates there, and only those; its claims carry no other kind\'s fields (mutants: the carried frame\'s kinds; orderValid\'s staffcut line)', async () => {
  const world = fakeRooms();
  const hub = world.room(CHAT_WORLD_ROOM);
  const kp = await hub.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const trade = world.room('chat:trade');
  const target = trade.connect(); await trade.hello(target, 'cutt-0002', null, { kind: 'linked', glyphs: ['dev'] });
  const carrier = trade.connect(); await trade.hello(carrier, 'carr-0001', null, { kind: 'linked' });
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const forged = await mintStaffCutOrder({ s: 'acct-cutt-0002' }, stranger.privateKey, { subtle, nowS });
  const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: forged }) }), env);
  assert.equal(res.status, 403);
  await trade.room.webSocketMessage(carrier, JSON.stringify({ t: 'ban', order: forged }));   // (a socket's own order meter holds one a moment)
  assert.equal(target.closed, null, 'a forged cut carried in is nothing');
  const real = await mintStaffCutOrder({ s: 'acct-cutt-0002' }, (await trade.signer()).privateKey, { subtle, nowS: nowS + 1 });   // the harness's rooms each hold a key of their own
  await trade.room.webSocketMessage(target, JSON.stringify({ t: 'ban', order: real }));
  assert.deepEqual(target.closed, CUT, 'the Trade channel\'s socket closed, its Dev glyph with it');
  assert.equal(carrier.closed, null, 'a stranger stays');
  // the shape
  const c = { o: 'staffcut', s: 'acct-cutt-0002', i: nowS, e: nowS + ORDER_TTL_S };
  assert.equal(orderValid(c), true);
  for (const extra of [{ mu: nowS + 60 }, { bn: nowS + 60 }, { lv: 3 }, { gi: 'g0000001', gt: 'TAG', gm: 'M' }]) assert.equal(orderValid({ ...c, ...extra }), false, JSON.stringify(extra));
});
