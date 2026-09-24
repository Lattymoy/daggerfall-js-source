// DUEL1 (2026-09-24, Mac: "When inspecting a player, they should be able to send an invite to duel"): THE DUEL ON THE
// WIRE, DRIVEN. The frame's law (net/wire.js validDuelData - every kind, every bound, the cast frame's spell law shared
// and the cast frame itself unchanged by the sharing); the relay over the real Room (routed to the one socket `to`
// names, stamped with the sender's id AND verified account, a place room's alone, its own meter and its own per-sender
// funnel); the card frame carrying the answerer's account the same way; the session (sent only to a relay that routes
// it, gated both ways, delivered only when addressed to me, with the stamp).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClient, validDuelData, validCastData, relaySupportsDuel, RELAY_VERSION, DUEL_RELAY_MIN, DUEL_KINDS, DUEL_WHY,
  DUEL_FRAME_MAX, DUEL_DATA_MAX, DUEL_HZ_MAX, DUEL_IN_HZ_MAX, DUEL_LEVEL_MAX, DUEL_STAT_MAX, DUEL_SKILL_MAX, DUEL_RACE_MAX,
  DUEL_TEMPLATE_MAX, DUEL_MATERIAL_MAX, DUEL_DMG_MAX, DUEL_SEQ_MAX, DUEL_SWINGS, DUEL_RANGE_TYPES, CAST_LEVEL_MAX,
  CAST_HZ_MAX, DROP_STRIKES_MAX, POSE_BOUND, CARD_ATTRS,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { HEAL_SPELL } from './placeWidest.mjs';

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const ATT = { lv: 10, r: 2, st: [60, 40, 40, 55, 50, 40, 50, 50], sk: [45, 30, 20, 10], cf: [3, 0x00FF00FF, 0x12], h: [80, 90] };
const P = [100000, 10.5, 200000];
const FIRE = { name: 'Fire Bolt', element: 0, rangeType: 2, icon: 3, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 10 }] };
const S = 'abc123def0';

test('DUEL1 wire: every kind carries exactly its own fields - ask/yes/no the id alone, start the ring\'s centre, cancel an optional reason and end a required one, strike the striker\'s sheet and weapon (never a damage), spell the cast frame\'s spell law at any range that reaches another body, result the answer; anything outside refuses the whole frame (mutants: a damage on a strike admitted; an end with no reason; a bound off by one; a spell\'s CasterOnly admitted)', () => {
  const ok = (d) => { const v = validDuelData({ to: 'peer-0002', s: S, ...d }); assert.ok(v, JSON.stringify(d)); return v; };
  const no = (d) => assert.equal(validDuelData({ to: 'peer-0002', s: S, ...d }), null, JSON.stringify(d));
  assert.deepEqual(DUEL_KINDS, ['ask', 'yes', 'no', 'start', 'cancel', 'strike', 'spell', 'result', 'end']);
  for (const k of ['ask', 'yes', 'no']) assert.deepEqual(ok({ k, extra: 1 }), { to: 'peer-0002', k, s: S }, 'the id alone - an extra field is dropped');
  assert.deepEqual(ok({ k: 'start', c: P }), { to: 'peer-0002', k: 'start', s: S, c: P });
  for (const c of [[1, 2], [-1, 0, 0], [POSE_BOUND + 1, 0, 0], [0, 2e5, 0], [0, NaN, 0], null]) no({ k: 'start', c });
  assert.deepEqual(ok({ k: 'cancel' }), { to: 'peer-0002', k: 'cancel', s: S });
  for (const why of DUEL_WHY) { ok({ k: 'cancel', why }); ok({ k: 'end', why }); }
  no({ k: 'end' });
  no({ k: 'cancel', why: 'bored' });
  const strike = ok({ k: 'strike', n: 1, by: 'melee', p: P, a: ATT, w: { t: 116, m: 3, c: 88 }, sw: 'StrikeDown', at: 900, dmg: 9999 });
  assert.equal(strike.dmg, undefined, 'a strike carries no damage - the defender resolves it');
  assert.deepEqual(strike.a, ATT);
  ok({ k: 'strike', n: 1, by: 'arrow', p: P, a: ATT });
  for (const bad of [
    { n: 0 }, { n: DUEL_SEQ_MAX + 1 }, { by: 'kick' }, { p: [1, 2] }, { a: { ...ATT, lv: 0 } }, { a: { ...ATT, lv: DUEL_LEVEL_MAX + 1 } },
    { a: { ...ATT, r: DUEL_RACE_MAX + 1 } }, { a: { ...ATT, st: ATT.st.slice(1) } }, { a: { ...ATT, st: [DUEL_STAT_MAX + 1, ...ATT.st.slice(1)] } },
    { a: { ...ATT, sk: [DUEL_SKILL_MAX + 1, 0, 0, 0] } }, { a: { ...ATT, sk: [1, 2, 3] } }, { a: { ...ATT, cf: [256, 0, 0] } },
    { a: { ...ATT, cf: [0, 2 ** 32, 0] } }, { a: { ...ATT, h: [1] } }, { a: { ...ATT, h: [5, 0] } },
    { w: { t: DUEL_TEMPLATE_MAX + 1, m: 0, c: 50 } }, { w: { t: 1, m: DUEL_MATERIAL_MAX + 1, c: 50 } }, { w: { t: 1, m: 0, c: 101 } },
    { sw: 'Hug' }, { at: -1 },
  ]) no({ k: 'strike', n: 1, by: 'melee', p: P, a: ATT, ...bad });
  assert.equal(CARD_ATTRS, ATT.st.length, 'the sheet\'s eight attributes, the card\'s own count');
  assert.equal(DUEL_LEVEL_MAX, CAST_LEVEL_MAX, 'the honest ceiling the cast frame already holds');
  assert.deepEqual(ok({ k: 'strike', n: 1, by: 'melee', p: P, a: { ...ATT, h: [120, 90] } }).a.h, [90, 90], 'health above its maximum reads as the maximum');
  for (const sw of DUEL_SWINGS) ok({ k: 'strike', n: 1, by: 'melee', p: P, a: ATT, sw });
  const sp = ok({ k: 'spell', n: 2, p: P, level: 12, spell: FIRE });
  assert.equal(sp.spell.rangeType, 2);
  for (const rangeType of DUEL_RANGE_TYPES) ok({ k: 'spell', n: 2, p: P, level: 12, spell: { ...FIRE, rangeType } });
  no({ k: 'spell', n: 2, p: P, level: 12, spell: { ...FIRE, rangeType: 0 } });
  no({ k: 'spell', n: 2, p: P, level: 0, spell: FIRE });
  no({ k: 'spell', n: 2, p: P, level: 12, spell: { ...FIRE, effects: [] } });
  assert.deepEqual(ok({ k: 'result', n: 3, hit: 1, dmg: 12, h: [60, 90] }), { to: 'peer-0002', k: 'result', s: S, n: 3, hit: 1, dmg: 12, h: [60, 90] });
  for (const bad of [{ hit: 2 }, { dmg: -1 }, { dmg: DUEL_DMG_MAX + 1 }, { h: [1, 2, 3] }]) no({ k: 'result', n: 3, hit: 1, dmg: 12, h: [60, 90], ...bad });
  assert.equal(validDuelData({ to: 'peer-0002', s: 'x', k: 'ask' }), null, 'the id is the trade\'s alphabet and length');
  assert.equal(validDuelData({ to: 'p', s: S, k: 'ask' }), null);
  assert.equal(validDuelData({ to: 'peer-0002', s: S, k: 'hug' }), null);
  // the widest honest frame fits the relay's door
  const wide = { name: 'x'.repeat(40), element: 4, rangeType: 4, icon: 68, effects: [0, 1, 2].map(() => ({ type: 44, subType: 255, durationBase: 255, durationMod: 255, durationPerLevel: 255, chanceBase: 255, chanceMod: 255, chancePerLevel: 255, magnitudeBaseLow: 255, magnitudeBaseHigh: 255, magnitudeLevelBase: 255, magnitudeLevelHigh: 255, magnitudePerLevel: 255 })) };
  const frame = JSON.stringify({ t: 'duel', data: validDuelData({ to: 'x'.repeat(40), s: 'Z'.repeat(16), k: 'spell', n: DUEL_SEQ_MAX, p: [POSE_BOUND, -99999.999, POSE_BOUND], level: DUEL_LEVEL_MAX, spell: wide }) });
  assert.ok(frame.length < DUEL_FRAME_MAX && JSON.parse(frame).data, `the widest spell frame fits: ${frame.length} of ${DUEL_FRAME_MAX}`);
  assert.ok(DUEL_DATA_MAX < DUEL_FRAME_MAX);
});

test('DUEL1 the cast frame\'s spell law is SHARED, not copied - and the cast frame is exactly what it was: a touch or a ranged single target alone (mutants: the duel\'s ranges leaking into the cast frame; the projection forked)', () => {
  assert.ok(validCastData({ to: 'peer-0002', level: 5, spell: HEAL_SPELL }));
  for (const rangeType of [0, 3, 4]) assert.equal(validCastData({ to: 'peer-0002', level: 5, spell: { ...HEAL_SPELL, rangeType } }), null, `a cast frame at range ${rangeType}`);
  const a = validCastData({ to: 'peer-0002', level: 5, spell: { ...FIRE } }).spell;
  const b = validDuelData({ to: 'peer-0002', s: S, k: 'spell', n: 1, p: P, level: 5, spell: { ...FIRE } }).spell;
  assert.deepEqual(a, b, 'one projection');
});

test('DUEL1 the parser and the version: `duel` is its own arm (after the hello, under its own door); world107 is the first relay that routes it (mutants: the frame parsed before the hello; an old relay trusted)', () => {
  const d = { to: 'peer-0002', s: S, k: 'ask' };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'duel', data: d }), { hasHello: true }), { t: 'duel', data: d });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'duel', data: d })), { error: 'duel before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'duel', data: { ...d, k: 'x' } }), { hasHello: true }), { error: 'bad duel' });
  assert.equal(RELAY_VERSION, 'world108');   // ADV1's level moved it on (world108); DUEL1 was world105 on its branch; main's world105 (AUDIT 68) and world106 (DISC23-B) landed first
  assert.equal(DUEL_RELAY_MIN, 107);
  assert.equal(relaySupportsDuel('world107'), true);
  assert.equal(relaySupportsDuel('world106'), false, 'main\'s world106 closes the socket on a duel frame');
  assert.equal(relaySupportsDuel(null), false);
  assert.equal(DUEL_IN_HZ_MAX, DUEL_HZ_MAX * 2);
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms = 1000) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const duels = (ws) => ws.sent.filter((m) => m.t === 'duel');

test('DUEL1 relay: a duel frame reaches the one player it names, stamped with the sender\'s id AND the account its token verified - never the frame\'s word; nobody else hears it; a channel is nowhere to duel; a frame at myself is junk; a peer gone is nothing; and a card answer carries the answerer\'s account the same way (mutants: the frame fanned; the account missing; the account read off the frame)', () => withRoom('world:3,12', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  const c = r.connect(); await r.hello(c, 'peer-0003');
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'duel', data: { to: 'peer-0002', s: S, k: 'ask', sub: 'acct-forged' } }));
  assert.deepEqual(duels(b), [{ t: 'duel', id: 'peer-0001', sub: 'acct-peer-0001', data: { to: 'peer-0002', s: S, k: 'ask' } }]);
  assert.equal(duels(a).length + duels(c).length, 0);
  await r.raw(a, JSON.stringify({ t: 'duel', data: { to: 'peer-0001', s: S, k: 'ask' } }));
  assert.equal(a.meters.junk, 1, 'a duel at my own id is junk');
  await r.raw(b, JSON.stringify({ t: 'duel', data: { to: 'peer-0099', s: S, k: 'ask' } }));
  assert.equal(b.meters.junk ?? 0, 0, 'a leave races a frame - not junk');
  // the card: the answerer's account beside its id
  b.sent.length = 0;
  const card = { level: 5, attrs: [50, 50, 50, 50, 50, 50, 50, 50], vitals: [50, 50, 50], look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] } };
  await r.raw(a, JSON.stringify({ t: 'card', data: { to: 'peer-0002', card } }));
  assert.equal(b.sent.find((m) => m.t === 'card')?.sub, 'acct-peer-0001');
}).then(() => withRoom('chat:world', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'duel', data: { to: 'peer-0002', s: S, k: 'ask' } }));
  assert.equal(duels(b).length, 0, 'a channel is nowhere to duel');
})));

test('DUEL1 relay: the duel\'s meter is its own (DUEL_HZ_MAX a second, struck out in its own words) and so is its funnel onto a destination, per sender at the duel\'s rate - a duellist\'s blows never wait on the casts or cards their sender spent there (mutants: the cast funnel shared; the meter unstruck)', () => withRoom('world:3,12', async ({ r, tick }) => {
  const me = r.connect(); await r.hello(me, 'peer-0001');
  const s = r.connect(); await r.hello(s, 'peer-0002');
  tick(5000);
  me.sent.length = 0;
  const cast = JSON.stringify({ t: 'cast', data: { to: 'peer-0001', level: 5, spell: HEAL_SPELL } });
  for (let k = 0; k < CAST_HZ_MAX; k++) await r.raw(s, cast);
  const blow = (n) => JSON.stringify({ t: 'duel', data: { to: 'peer-0001', s: S, k: 'strike', n, by: 'melee', p: P, a: ATT } });
  for (let n = 1; n <= DUEL_HZ_MAX; n++) await r.raw(s, blow(n));
  assert.equal(duels(me).length, DUEL_HZ_MAX, 'the cast funnel spent, the duel\'s own full');
  assert.ok(Array.isArray(me.meters.duin) && me.meters.duin.length === 1, 'the duel\'s slots are their own list');
  tick(5000);
  me.sent.length = 0;
  for (let k = 0; k < DUEL_HZ_MAX + DROP_STRIKES_MAX; k++) await r.raw(s, blow(100 + k));
  assert.equal(s.closed, null);
  assert.equal(s.meters.duelDrops, DROP_STRIKES_MAX);
  assert.equal(duels(me).length, DUEL_HZ_MAX);
  await r.raw(s, blow(999));
  assert.equal(s.closed?.reason, 'too many duel frames');
}));

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────

function linkRig(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onDuel = (id, d, sub) => got.push({ id, d, sub });
  const cards = []; s.onCard = (id, d, sub) => cards.push({ id, sub });
  quiet(() => s.join('world:3,12', { x: 1, y: 0, z: 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'duel');
  return { s, ws, got, cards, out, tick: (ms) => { t += ms; } };
}

test('DUEL1 session: a duel frame goes only to a relay that routes it, through the wire\'s projection, to a peer some socket reports, DUEL_HZ_MAX a second; one in is delivered only when a peer\'s and addressed to me, with the relay\'s account stamp, DUEL_IN_HZ_MAX a second per sender; a card answer hands its stamp on too (mutants: the version door dropped; the stamp lost; a frame at someone else delivered)', () => {
  const old = linkRig('world104');
  assert.equal(old.s.duelOk, false);
  assert.equal(old.s.sendDuel({ to: 'peer-0002', s: S, k: 'ask' }), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const { s, ws, got, cards, out, tick } = linkRig();
  assert.equal(s.duelOk, true);
  assert.equal(s.sendDuel({ to: 'peer-0002', s: S, k: 'ask' }), true);
  assert.deepEqual(out().at(-1), { t: 'duel', data: { to: 'peer-0002', s: S, k: 'ask' } });
  assert.equal(s.sendDuel({ to: 'aaaa-0001', s: S, k: 'ask' }), false, 'never at myself');
  assert.equal(s.sendDuel({ to: 'peer-0009', s: S, k: 'ask' }), false, 'nobody reports peer-0009');
  assert.equal(s.sendDuel({ to: 'peer-0002', s: S, k: 'strike', n: 1, by: 'melee', p: P, a: ATT, dmg: 5 }), true, 'the projection drops the damage');
  assert.equal(out().at(-1).data.dmg, undefined);
  for (let i = 2; i < DUEL_HZ_MAX; i++) assert.equal(s.sendDuel({ to: 'peer-0002', s: S, k: 'yes' }), true);
  assert.equal(s.sendDuel({ to: 'peer-0002', s: S, k: 'yes' }), false, 'DUEL_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendDuel({ to: 'peer-0002', s: S, k: 'yes' }), true);
  ws.receive({ t: 'duel', id: 'peer-0002', sub: 'acct-bran', data: { to: 'aaaa-0001', s: S, k: 'ask' } });
  ws.receive({ t: 'duel', id: 'peer-0002', sub: 'acct-bran', data: { to: 'peer-0003', s: S, k: 'ask' } });
  ws.receive({ t: 'duel', id: 'aaaa-0001', data: { to: 'aaaa-0001', s: S, k: 'ask' } });
  ws.receive({ t: 'duel', id: 'peer-0002', data: { to: 'aaaa-0001', s: S, k: 'hug' } });
  assert.deepEqual(got.map((x) => [x.id, x.d.k, x.sub]), [['peer-0002', 'ask', 'acct-bran']]);
  ws.receive({ t: 'duel', id: 'peer-0002', data: { to: 'aaaa-0001', s: S, k: 'no' } });
  assert.equal(got.at(-1).sub, null, 'no stamp: null, never a guess');
  for (let i = 0; i < DUEL_IN_HZ_MAX + 4; i++) quiet(() => ws.receive({ t: 'duel', id: 'peer-0002', data: { to: 'aaaa-0001', s: S, k: 'no' } }));
  assert.ok(got.length <= DUEL_IN_HZ_MAX, 'the inbound gate per sender');
  ws.receive({ t: 'card', id: 'peer-0002', sub: 'acct-bran', data: { to: 'aaaa-0001', ask: true } });
  assert.deepEqual(cards.at(-1), { id: 'peer-0002', sub: 'acct-bran' }, 'the card answer\'s stamp goes on to the host');
});
