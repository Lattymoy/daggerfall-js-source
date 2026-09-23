// AUDIT ATTACH (2026-09-23, found by INSPECT1's measurement of the attachment its card meter would ride): A SOCKET'S
// METERS LEAVE ITS ATTACHMENT. The runtime caps a hibernatable socket's attachment at 2 KiB and refuses a write past it
// WHOLE (the Room's _setAttach answers false), and every per-socket meter rode it: twenty arms' buckets and strike
// counts, the junk count, and three funnels onto the socket as a destination - `cin` alone eight sender ids of up to
// forty characters that the destination never chose. Nothing measured a PLACE socket's (AUDIT SOC measured the hub's).
//   A1: measured over the real Room - the widest world-room key, an id and an account at ID_RE's bound, the name at
//       NAME_MAX, a pose at its bounds, every arm spent once, the funnel full - it passed 2 KiB with two arms still
//       to write, on buckets whose tokens happened to be whole (a real bucket's float is wider).
//   A2: and a refused write FAILED OPEN. The meters wrote their spend back through _setAttach and never read its
//       answer, so a meter whose write was refused never advanced: its gate passed every frame on the bucket it last
//       stored, and its strikes never counted. A socket could grow its own attachment to the brink and flood whichever
//       arm wrote last - unmetered, never struck.
// The fix is where the meters live, not how many bytes they take: every per-socket meter is the Room INSTANCE's (a
// WeakMap by socket, server/src/index.js _meterOf/_spend) - rate state, like the room budgets and _cool that have
// always lived there, forgotten by a wake after a quiet spell in which every bucket refilled anyway. The attachment
// keeps what a wake must recompute, and its widest is measured here with its field list closed both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAST_DEST_SENDERS_MAX, DROP_STRIKES_MAX, CHAT_STRIKES_MAX, POSE_HZ_MAX, WHO_HZ_MAX, TRADE_HZ_MAX, CAST_BURST_MAX,
  ACT_HZ_MAX, FOES_HZ_MAX, CHAT_HZ_MAX, ROLL_HZ_MAX, QUEST_HUB_MIN_MS, questShareGate, poseGate, whoGate, socialGate,
  partyGate, tradeGate, castGate, actGate, foesGate, chatGate, rollGate, redGate, muteGate, tokenGate, byteGate,
  HIT_ROOM_HZ_MAX, TRADE_ROOM_HZ_MAX, CAST_HZ_MAX, TRADE_ROOM_BYTES_PER_S, cardGate, CARD_HZ_MAX, PARK_HZ_MAX, parkGate,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { withClock, WIDE_POSE, HEAL_SPELL, PLACE_ATTACH_FIELDS, PLACE_METER_FIELDS, widestPlace } from './placeWidest.mjs';


test('AUDIT ATTACH A1: the WIDEST attachment a place socket carries - the widest room key, an id and an account at ID_RE\'s bound, the name at NAME_MAX, the longest title, every glyph, a mute, a pose at its bounds - with every arm it can send spent once and its funnel full, is what a wake must recompute and nothing else, its field list closed both ways, measured at half the runtime\'s 2 KiB (mutants: a meter written back onto the attachment; the pose write dropped)', () => withClock(async (tick) => {
  const { me } = await widestPlace(tick);
  assert.equal(me.closed, null, 'never "hello too large", never a close for a refused write');
  const fields = Object.keys(me.att);
  assert.deepEqual(PLACE_ATTACH_FIELDS.filter((k) => !fields.includes(k)), [], 'every field a wake needs is written');
  assert.deepEqual(fields.filter((k) => !PLACE_ATTACH_FIELDS.includes(k)), [], 'a field on a place attachment this test never measured - measure it here, or keep it among the meters');
  const meters = Object.keys(me.meters);
  assert.deepEqual(PLACE_METER_FIELDS.filter((k) => !meters.includes(k)), [], 'every arm ran: each meter was spent');
  assert.equal(me.meters.cin.length, CAST_DEST_SENDERS_MAX, 'the funnel full, of forty-character ids');
  assert.ok(me.meters.cin.every((c) => c.id.length === 40));
  const bytes = JSON.stringify(me.att).length;
  assert.ok(bytes <= 1024, `the widest place attachment is ${bytes} bytes - half the runtime's 2048 at most, so the next field is measured with room to spare`);
  assert.ok(bytes > 500, `and it is the wide one: ${bytes} bytes`);
}));

// Each arm's flood, at one instant: `passes` frames through the bucket, then a strike a frame (`key`), closed past `max`.
const ARMS = [
  { arm: 'pose', frame: () => ({ t: 'pose', p: WIDE_POSE }), passes: POSE_HZ_MAX, key: 'drops', max: DROP_STRIKES_MAX, why: 'too many poses' },
  { arm: 'who', frame: (o) => ({ t: 'who', id: o }), passes: WHO_HZ_MAX, key: 'wdrops', max: DROP_STRIKES_MAX, why: 'too many asks' },
  { arm: 'trade', frame: (o) => ({ t: 'trade', data: { to: o, k: 'ask', s: 'abcdef' } }), passes: TRADE_HZ_MAX, key: 'tdrops', max: DROP_STRIKES_MAX, why: 'too many trade frames' },
  { arm: 'cast', frame: (o) => ({ t: 'cast', data: { to: o, level: 5, spell: HEAL_SPELL } }), passes: CAST_BURST_MAX, key: 'castDrops', max: DROP_STRIKES_MAX, why: 'too many cast frames' },
  { arm: 'act', frame: () => ({ t: 'act', data: { d: 1 } }), passes: ACT_HZ_MAX, key: 'adrops', max: DROP_STRIKES_MAX, why: 'too many acts' },
  { arm: 'foes', frame: () => ({ t: 'foes', data: { n: 1, f: [] } }), passes: FOES_HZ_MAX, key: 'fdrops', max: DROP_STRIKES_MAX, why: 'too many foes' },
  { arm: 'social', frame: () => ({ t: 'social', k: 'party.leave' }), passes: 0, key: 'junk', max: DROP_STRIKES_MAX, why: 'too many frames' },   // junk outside the hub: every one it takes is struck, and junk is never forgiven
  { arm: 'chat', frame: () => ({ t: 'chat', text: 'hello' }), passes: CHAT_HZ_MAX, key: 'cdrops', max: CHAT_STRIKES_MAX, why: 'too many lines' },
  { arm: 'roll', frame: () => ({ t: 'roll', n: 1, m: 20, k: 0 }), passes: ROLL_HZ_MAX, key: 'rollDrops', max: CHAT_STRIKES_MAX, why: 'too many rolls' },
  { arm: 'card', frame: (o) => ({ t: 'card', data: { to: o, ask: true } }), passes: CARD_HZ_MAX, key: 'cardDrops', max: DROP_STRIKES_MAX, why: 'too many card frames' },   // INSPECT1
  // HCC-PARK (main's, merged): its strikes its OWN - main's meter counted them on `pdrops`, the party pose meter's, so
  // either meter's pass forgave the other's flood
  { arm: 'park', frame: () => ({ t: 'park', data: { c: 'char-0001', a: [1, 1] } }), passes: PARK_HZ_MAX, key: 'parkDrops', max: DROP_STRIKES_MAX, why: 'too many park frames' },
];

test('AUDIT ATTACH A2: a meter no longer rides a write the runtime can refuse - with EVERY attachment write after the hello refused, each arm\'s flood still passes its bucket and no more, and is struck out on exactly the frame past its strikes, with its own words (mutants: the meters kept nowhere, so every gate passes; the strikes never forgiven; a strike bound off by one)', () => withClock(async (tick) => {
  for (const { arm, frame, passes, key, max, why } of ARMS) {
    const r = fakeRoom('dungeon:m187');
    const ws = r.connect(); await r.hello(ws, 'aaaa-0001', { x: 1, y: 0, z: 1, yaw: 0 });
    const other = r.connect(); await r.hello(other, 'bbbb-0002', { x: 2, y: 0, z: 1, yaw: 0 });
    tick(5000);   // every bucket full
    ws.serializeAttachment = () => { throw new Error('attachment too large'); };   // the runtime refuses every write from here
    if (key !== 'junk') {
      // three strikes, then a frame the refilled bucket takes: a pass forgives them
      for (let k = 0; k < passes + 3; k++) await r.raw(ws, JSON.stringify(frame('bbbb-0002')));
      assert.equal(ws.meters[key], 3, `${arm}: three strikes counted`);
      tick(5000);
      await r.raw(ws, JSON.stringify(frame('bbbb-0002')));
      assert.equal(ws.meters[key], 0, `${arm}: a pass forgives them`);
      tick(5000);
    }
    // the social act is junk outside the hub, so its flood is spent a token at a time: the junk count is what strikes it
    const spaced = arm === 'social';
    const sent = spaced ? max : passes + max;
    for (let k = 0; k < sent; k++) { if (spaced) tick(1000); await r.raw(ws, JSON.stringify(frame('bbbb-0002'))); }
    assert.equal(ws.closed, null, `${arm}: ${sent} frames - the strikes at the bound, not past it`);
    if (spaced) tick(1000);
    await r.raw(ws, JSON.stringify(frame('bbbb-0002')));
    assert.equal(ws.closed?.reason, why, `${arm}: the next frame is struck out, in its own words, though no write ever landed`);
  }
}));

test('AUDIT ATTACH: a wake forgets the meters and nothing else - the host is still the host, the pose still stands, the marks hold - and a meter a wake forgets had refilled in the quiet that let the object sleep: every bucket whole in two seconds of it (the cast meter, a whole blast deep, the slowest), the quest floor in five (mutants: a meter on the attachment, which a wake would keep)', () => withClock(async (tick) => {
  const r = fakeRoom('dungeon:m187');
  const h = r.connect(); await r.hello(h, 'host-0001', { x: 1, y: 0, z: 1, yaw: 0 });
  const j = r.connect(); await r.hello(j, 'join-0002', { x: 2, y: 0, z: 1, yaw: 0 });
  tick(1000);
  await r.raw(h, JSON.stringify({ t: 'act', data: { d: 1 } }));
  await r.raw(j, JSON.stringify({ t: 'hit', data: { i: 0, dmg: 1, kind: 'melee' } }));
  await r.raw(h, JSON.stringify({ t: 'world', data: { a: 1 }, final: true }));
  assert.ok(h.meters.abucket && h.meters.hbucket && j.meters.bucket, 'spent');
  const before = JSON.stringify([h.att, j.att]);
  r.wake();
  assert.deepEqual(h.meters, {}, 'a wake forgets the meters');
  assert.deepEqual(j.meters, {});
  assert.equal(JSON.stringify([h.att, j.att]), before, 'and nothing on the attachment');
  j.sent.length = 0;
  await r.raw(h, JSON.stringify({ t: 'act', data: { d: 2 } }));
  assert.equal(j.sent.filter((m) => m.t === 'act').length, 1, 'the woken room works: its meters are made again as they are spent');
  assert.equal(h.att.finalUsed, true, 'the host\'s farewell is still spent');
  // the quiet: every bucket a wake forgets is whole again two seconds after it was emptied
  for (const [name, gate, cap] of [['pose', poseGate, POSE_HZ_MAX], ['who', whoGate, WHO_HZ_MAX], ['social', socialGate, 2], ['party', partyGate, 2], ['trade', tradeGate, TRADE_HZ_MAX], ['cast', castGate, CAST_BURST_MAX], ['act', actGate, ACT_HZ_MAX], ['foes', foesGate, FOES_HZ_MAX], ['chat', chatGate, CHAT_HZ_MAX], ['roll', rollGate, ROLL_HZ_MAX], ['red', redGate, 1], ['mute', muteGate, 1], ['card', cardGate, CARD_HZ_MAX], ['park', parkGate, PARK_HZ_MAX], ['hit funnel', (b, t) => tokenGate(b, t, HIT_ROOM_HZ_MAX), HIT_ROOM_HZ_MAX], ['trade funnel', (b, t) => tokenGate(b, t, TRADE_ROOM_HZ_MAX), TRADE_ROOM_HZ_MAX], ['cast funnel', (b, t) => tokenGate(b, t, CAST_HZ_MAX), CAST_HZ_MAX]]) {
    let b = null;
    for (let k = 0; k < cap; k++) b = gate(b, 0).bucket;
    assert.equal(gate(b, 0).pass, false, `${name}: emptied`);
    const whole = gate(b, 2000);
    assert.ok(whole.pass && whole.bucket.tokens >= cap - 1, `${name}: whole again in two seconds`);
  }
  const bytes = byteGate(byteGate(null, 0, TRADE_ROOM_BYTES_PER_S, TRADE_ROOM_BYTES_PER_S).bucket, 1000, TRADE_ROOM_BYTES_PER_S, TRADE_ROOM_BYTES_PER_S);
  assert.equal(bytes.pass, true, 'the trade bytes: whole in a second');
  assert.equal(questShareGate(0, QUEST_HUB_MIN_MS).pass, true, 'the quest floor: five seconds');
  assert.equal(QUEST_HUB_MIN_MS, 5000);
}));
