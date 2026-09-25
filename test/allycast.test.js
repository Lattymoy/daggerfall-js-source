// ALLY-CAST (2026-09-23, Mac: "Can we implement the use of spells on players? For example healing and other buffs?
// ... some sort of ally targeting system" - "Do it"): A SPELL CAST ON A PARTY MATE. The law on a table
// (systems/allyCast.js), the wire's projection and parse (validCastData, the `cast` frame), the relay's cast arm
// over the fake room (routed to the one socket `to` names, junk at my own id, nothing outside a place room), the
// magic host's release arm driven as itself (a CasterOnly Heal read off a friend leaves as a touch on them; a
// damage spell never does; a refused door falls through to the ordinary arm), and the world.js seams by source.
// AUDIT ALLY-CAST (2026-09-23, Mac: "Lets audit this"): three lenses over it, the findings paid and pinned here by
// execution - the caster's (a CasterOnly ARMS when a mate is in reach, line of sight, the foe's own touch reach, a
// free ready never redirected, a pick that throws), the wire's and the relay's (a relay too old to route the frame,
// the funnel per sender, the honest bounds, no self-cast on the wire) and the receiver's (the gift lands as a
// self-cast, an ally's bundle never merges with mine and comes off at will, the icon rides, the line said first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALLY_CAST_TYPES, ALLY_TOUCH_REACH, ALLY_RANGE_REACH, allyEffect, allyCastable, allyCastSpell, allyReachFor, allyCastFrame,
  allyCastCasterLine, allyCastTargetLine, allyCastPlaqueLine,
} from '../src/systems/allyCast.js';
import { SOCIAL_REACH } from '../src/player/socialPick.js';
import { PERSON_RADIUS } from '../src/systems/allyCast.js';
import { TOUCH_RANGE, TOUCH_SPHERE_CAST_RADIUS } from '../src/systems/spellcast.js';
import {
  validCastData, parseClient, CAST_FRAME_MAX, CAST_LEVEL_MAX, CAST_SETTING_MAX, CAST_ICON_MAX, CAST_HZ_MAX, CAST_BURST_MAX, CAST_IN_HZ_MAX, CAST_DEST_SENDERS_MAX, RELAY_VERSION, castGate, castInGate,
  relaySupportsCast, PARTY_MAX,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { PRESS_BUTTON_TO_FIRE_SPELL, dispelBundle } from '../src/systems/mysticism.js';
import { calculateCastCost } from '../src/systems/spellcost.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);          // Heal Health
const DAMAGE = fx(4, 0);         // Damage Health
const FORTIFY = fx(9, 0, 10);    // Fortify Strength
const spellOf = (rangeType, effects, name = 'Balyna\'s Balm') => ({ name, index: 90, element: 4, rangeType, effects });

// ─── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST: a spell is castable on an ally when every real effect is a beneficial family - a Heal + Damage is not a gift, and an empty spell is nothing', () => {
  assert.equal(allyCastable(spellOf(0, [HEAL, EMPTY, EMPTY])), true);
  assert.equal(allyCastable(spellOf(1, [HEAL, FORTIFY, EMPTY])), true);
  assert.equal(allyCastable(spellOf(1, [HEAL, DAMAGE, EMPTY])), false, 'one harmful effect and the whole spell goes the ordinary way');
  assert.equal(allyCastable(spellOf(0, [DAMAGE])), false);
  assert.equal(allyCastable(spellOf(0, [EMPTY, EMPTY, EMPTY])), false);
  assert.equal(allyCastable(null), false);
  for (const t of [0, 1, 2, 4, 5, 6, 7, 11, 12, 16, 17, 19, 29, 33, 34, 40, 43]) assert.equal(ALLY_CAST_TYPES.has(t), false, `type ${t} is never a gift`);
  for (const t of [3, 8, 9, 10, 13, 14, 15, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 35, 39, 44]) assert.equal(ALLY_CAST_TYPES.has(t), true, `type ${t} is`);
  assert.equal(allyEffect(fx(11, 8)), false, 'Transfer Health drains the target to heal the caster: not a gift');
  assert.equal(allyEffect(EMPTY), false);
});

test('ALLY-CAST: the receiver keeps the beneficial subset alone - a crafted Damage Health beside a Heal lands nothing harmful, and nothing beneficial means nothing at all', () => {
  const kept = allyCastSpell({ name: 'Trick', element: 0, rangeType: 1, effects: [DAMAGE, HEAL, fx(0, 255)] });
  assert.deepEqual(kept.effects, [HEAL], 'the Heal alone; the Damage and the Paralyze are dropped');
  assert.equal(kept.name, 'Trick'); assert.equal(kept.rangeType, 0, 'AUDIT ALLY-CAST C1: the gift lands as a SELF-CAST whatever was sent - no saving throw against a friend\'s Heal');
  assert.equal(kept.custom, true); assert.equal(kept.icon, 0, 'no icon sent: the first');
  assert.equal(allyCastSpell({ name: 'Trick', element: 0, rangeType: 2, icon: 12, effects: [HEAL] }).icon, 12, 'C4: the icon rides, so the HUD\'s row can show it');
  assert.equal(allyCastSpell({ name: 'Trick', element: 0, rangeType: 2, icon: 69, effects: [HEAL] }).icon, 0, '...bounded by the sheet');
  assert.equal(allyCastSpell({ name: 'X', element: 0, rangeType: 1, effects: [DAMAGE] }), null);
  assert.equal(allyCastSpell({ effects: [] }), null);
  assert.equal(allyCastSpell(null), null);
});

test('ALLY-CAST: the reach by range type, the frame the caster sends, and the three lines', () => {
  assert.equal(allyReachFor(0), ALLY_TOUCH_REACH); assert.equal(allyReachFor(1), ALLY_TOUCH_REACH);
  assert.equal(allyReachFor(2), ALLY_RANGE_REACH);
  assert.equal(allyReachFor(3), null, 'an area around the caster is never redirected'); assert.equal(allyReachFor(4), null); assert.equal(allyReachFor(9), null);
  assert.equal(ALLY_TOUCH_REACH, TOUCH_RANGE + TOUCH_SPHERE_CAST_RADIUS + PERSON_RADIUS, 'AUDIT ALLY-CAST A4: THE FOE\'S OWN TOUCH REACH plus the person\'s radius - a touch on a friend reaches what a touch on a foe does');
  assert.ok(ALLY_TOUCH_REACH < SOCIAL_REACH, '...not the F key\'s 6.4 m, which made a touch a shout');
  assert.ok(ALLY_RANGE_REACH > ALLY_TOUCH_REACH);
  const f = allyCastFrame(spellOf(0, [HEAL, EMPTY, EMPTY]), 7, 'peer-0002');
  assert.deepEqual(f, { to: 'peer-0002', level: 7, spell: { name: 'Balyna\'s Balm', element: 4, rangeType: 1, icon: 0, effects: [HEAL] } }, 'a CasterOnly leaves as a TOUCH, the empty slots stay home');
  assert.equal(allyCastFrame({ ...spellOf(0, [HEAL]), icon: 33 }, 7, 'p').spell.icon, 33, 'the icon rides out');
  assert.equal(allyCastFrame({ ...spellOf(3, [HEAL]) }, 7, 'p').spell.rangeType, 1, 'a type the wire refuses is never sent as itself');
  assert.equal(allyCastFrame(spellOf(2, [HEAL]), 0.5, 'p').level, 1, 'a level floors at one');
  assert.equal(allyCastFrame(spellOf(2, [HEAL]), 12, 'p').spell.rangeType, 2, 'a ranged cast keeps its type');
  assert.equal(allyCastCasterLine('Heal', 'Bran'), 'You cast Heal on Bran.');
  assert.equal(allyCastTargetLine('Cyl', 'Shield'), 'Cyl casts Shield on you.');
  assert.equal(allyCastPlaqueLine('Heal', 'Bran'), 'Cast Heal on Bran');
  assert.equal(allyCastCasterLine('', 'Bran'), 'You cast a spell on Bran.');
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

const GOOD = { to: 'peer-0002', level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [HEAL] } };
const GOOD_OUT = { ...GOOD, spell: { ...GOOD.spell, icon: 0 } };

test('ALLY-CAST wire (world97): validCastData projects a bounded spell record and refuses the whole frame otherwise; parseClient carries the `cast` frame after a hello and inside the cap', () => {
  assert.equal(RELAY_VERSION, 'world111');   // AUDIT WB's relay half (world111); WB3's gate frame and boss room (world110); DUEL1's duel frame and the card's account stamp (world107); DISC23-B's look (world106); AUDIT 68's relay law (world105); TITLE-N's dm frame and badge vocabulary moved it again (world104); the contributor's death pose, Resurrect call and fallen body moved it (world103); the community arc's frames (CHAT-CHAN, DICE1, EMOTE1, INSPECT1, JOURNAL1) and AUDIT ATTACH's meters moved it (world102); DISC12's pose hand and beast bits (world101); DISC7's hs (world100); SPELLFX1's pose fields moved it once more (world98), HCC-PARK + RIDE again (world99); the cast frame is world97's
  const d = validCastData(GOOD);
  assert.deepEqual(d, GOOD_OUT, 'a whole frame, every component an integer in bounds, the icon defaulted');
  assert.equal(validCastData({ ...GOOD, to: 'x' }), null, 'an id is an id');
  assert.equal(validCastData({ ...GOOD, level: 0 }), null); assert.equal(validCastData({ ...GOOD, level: CAST_LEVEL_MAX + 1 }), null); assert.equal(validCastData({ ...GOOD, level: 2.5 }), null);
  assert.equal(CAST_LEVEL_MAX, 30, 'AUDIT ALLY-CAST B3: the classic level cap - a crafted level 1e9 scaled a Fortify past every bound');
  assert.equal(CAST_SETTING_MAX, 255, '...and a component is the classic byte');
  assert.equal(validCastData({ ...GOOD, level: 30 }).level, 30);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, element: 5 } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 7 } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 0 } }), null, 'AUDIT ALLY-CAST B4: a self-cast never rides the wire - the sender chose the saving throw away');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 3 } }), null); assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 4 } }), null, 'an area is never a gift');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, rangeType: 2 } }).spell.rangeType, 2);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, icon: CAST_ICON_MAX } }).spell.icon, CAST_ICON_MAX, 'the icon rides, bounded by the sheet');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, icon: CAST_ICON_MAX + 1 } }), null); assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, icon: -1 } }), null); assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, icon: 1.5 } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [] } }), null, 'no effect is no spell');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [HEAL, HEAL, HEAL, HEAL] } }), null, 'four effects: the classic record has three slots');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [fx(99)] } }), null, 'an effect type past the registry');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [EMPTY] } }), null, 'an empty slot never rides the wire');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ ...HEAL, magnitudeBaseHigh: CAST_SETTING_MAX + 1 }] } }), null, 'a component past the bound');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ ...HEAL, durationBase: -1 }] } }), null);
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, effects: [{ type: 10, subType: 8 }] } }).spell.effects[0].magnitudeBaseLow, 0, 'a missing component reads zero');
  assert.equal(validCastData({ ...GOOD, spell: { ...GOOD.spell, name: '  Heal\u0000 me  ' + 'x'.repeat(80) } }).spell.name.length <= 32, true, 'a label, bounded');
  assert.equal(validCastData(null), null); assert.equal(validCastData([]), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: GOOD }), { hasHello: true }), { t: 'cast', data: GOOD_OUT });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: GOOD }), { hasHello: false }), { error: 'cast before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: { ...GOOD, level: 0 } }), { hasHello: true }), { error: 'bad cast' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'cast', data: { ...GOOD, spell: { ...GOOD.spell, name: 'x'.repeat(CAST_FRAME_MAX) } } }), { hasHello: true }), { error: 'frame too large' });
  // the gates: a sender's own casts and the frames coming in, both token buckets under their rates
  let g = { pass: true, bucket: null };
  // FRIENDLY-SPELLS: the sender's bucket is a whole blast deep (one frame per party mate it reaches), refilled at CAST_HZ_MAX
  assert.equal(CAST_BURST_MAX, PARTY_MAX - 1, 'one blast reaches every mate of a full party');
  for (let i = 0; i < CAST_BURST_MAX; i++) { g = castGate(g.bucket, 1000); assert.equal(g.pass, true); }
  assert.equal(castGate(g.bucket, 1000).pass, false, 'the frame past a whole blast in the same instant waits');
  assert.equal(castGate(g.bucket, 1000 + 1000 / CAST_HZ_MAX).pass, true, '...and the refill is CAST_HZ_MAX a second');
  assert.equal(castInGate(null, 1000).pass, true);
  assert.ok(CAST_IN_HZ_MAX >= CAST_HZ_MAX * 2, 'the frames coming in admit a few casters at once');
  assert.ok(CAST_DEST_SENDERS_MAX >= PARTY_MAX - 1, 'AUDIT ALLY-CAST B2: every party mate keeps a funnel of their own onto me');
  // B1: the relay that routes the frame - an older one CLOSES the socket on a frame it does not know
  assert.equal(relaySupportsCast('world96'), false, 'world96 knew the frame in a shape this client no longer sends');
  assert.equal(relaySupportsCast('world97'), true); assert.equal(relaySupportsCast(RELAY_VERSION), true);
  assert.equal(relaySupportsCast('world95'), false); assert.equal(relaySupportsCast(null), false); assert.equal(relaySupportsCast('junk'), false);
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST relay: the cast arm routes a frame to the one socket `to` names, stamped with the sender; a frame at my own id is junk and one in the hub room goes nowhere', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'peer-0001'); await r.hello(b, 'peer-0002'); await r.hello(c, 'peer-0003');
  const sentTo = (ws) => ws.sent.filter((m) => m.t === 'cast');
  await r.raw(a, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.deepEqual(sentTo(b), [{ t: 'cast', id: 'peer-0001', data: GOOD_OUT }], 'b, and b alone, with a\'s id on it');
  assert.equal(sentTo(c).length, 0); assert.equal(sentTo(a).length, 0);
  const junkBefore = a.meters.junk ?? 0;
  await r.raw(a, JSON.stringify({ t: 'cast', data: { ...GOOD, to: 'peer-0001' } }));
  assert.equal(sentTo(a).length, 0, 'a cast at myself delivers nothing');
  assert.equal(a.meters.junk ?? 0, junkBefore + 1, 'AUDIT ALLY-CAST B5: and is counted as JUNK (the strike the pin used to read was the pose meter\'s)');
  await r.raw(a, JSON.stringify({ t: 'cast', data: { ...GOOD, to: 'peer-9999' } }));
  assert.equal(sentTo(b).length, 1, 'a peer that is gone: nothing sent, nothing struck');
  assert.equal(a.meters.junk, junkBefore + 1);
  // the sender's own meter: a whole blast (CAST_BURST_MAX) at once, the rest dropped on the sender's strikes - and b
  // still takes only CAST_HZ_MAX of them, its per-sender funnel
  for (let i = 0; i < CAST_BURST_MAX + 2; i++) await r.raw(c, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(b).filter((m) => m.id === 'peer-0003').length, CAST_HZ_MAX, 'c\'s frames onto b, through b\'s funnel');
  assert.ok((c.meters.castDrops ?? 0) >= 2, '...its drops on c, never on b');
  assert.equal(c.meters.cdrops, undefined, 'CHAT-CHAN: a cast\'s strikes are its own - never the chat gate\'s field');
  // outside a place room the arm is closed
  const hub = fakeRoom('chat:world');
  const h1 = hub.connect(), h2 = hub.connect();
  await hub.hello(h1, 'peer-0001'); await hub.hello(h2, 'peer-0002');
  await hub.raw(h1, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(h2).length, 0, 'the hub is no place to stand and cast');
});

test('AUDIT ALLY-CAST B2 relay: the funnel onto a destination is PER SENDER - three strangers flooding me leave my party mate\'s Heal a fresh bucket; the slots are bounded, and among the destination\'s meters, never on its 2 KiB attachment', async () => {
  const r = fakeRoom('world:3,12');
  const me = r.connect(); await r.hello(me, 'peer-0002');
  const sentTo = (ws) => ws.sent.filter((m) => m.t === 'cast');
  const strangers = [];
  for (let i = 0; i < 3; i++) { const ws = r.connect(); await r.hello(ws, `peer-01${i}0`); strangers.push(ws); }
  for (const ws of strangers) for (let k = 0; k < CAST_HZ_MAX; k++) await r.raw(ws, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(me).length, 3 * CAST_HZ_MAX, 'each stranger under their own meter, each through their own funnel');
  const mate = r.connect(); await r.hello(mate, 'peer-0001');
  await r.raw(mate, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(me).at(-1)?.id, 'peer-0001', 'the mate\'s frame arrives: one bucket for everyone let the strangers starve it');
  for (let k = 0; k < CAST_HZ_MAX + 3; k++) await r.raw(mate, JSON.stringify({ t: 'cast', data: GOOD }));
  assert.equal(sentTo(me).filter((m) => m.id === 'peer-0001').length, CAST_HZ_MAX, '...and the mate\'s own funnel holds them to CAST_HZ_MAX a second');
  // the slots: CAST_DEST_SENDERS_MAX senders at most among the destination's meters; the stalest goes to a newcomer
  // (a room of its own: a room admits HELLO_HZ_MAX hellos a second, and this one takes nine of them)
  const r2 = fakeRoom('world:4,12');
  const me2 = r2.connect(); await r2.hello(me2, 'peer-0002');
  for (let i = 0; i < CAST_DEST_SENDERS_MAX + 1; i++) { const ws = r2.connect(); await r2.hello(ws, `peer-02${String(i).padStart(2, '0')}`); await r2.raw(ws, JSON.stringify({ t: 'cast', data: GOOD })); }
  assert.equal(me2.sent.filter((m) => m.t === 'cast').length, CAST_DEST_SENDERS_MAX + 1, 'every one of them arrived: a slot is a bucket, not a seat');
  assert.equal(me2.meters.cin.length, CAST_DEST_SENDERS_MAX, 'bounded');
  assert.equal(me2.att.cin, undefined, 'AUDIT ATTACH: the slots are the destination\'s meters - on its attachment they were eight ids of forty characters the destination never chose');
  assert.ok(me2.meters.cin.some((c) => c.id === `peer-02${String(CAST_DEST_SENDERS_MAX).padStart(2, '0')}`), 'the newest sender holds a slot');
  assert.ok(!me2.meters.cin.some((c) => c.id === 'peer-0200'), '...the stalest gave it up');
});

// ─── THE LINK ───────────────────────────────────────────────────────────────────────────────────────────────────

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
function linkRig(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const casts = []; s.onCast = (id, d) => casts.push({ id, d });
  quiet(() => s.join('dungeon:m187', { x: 1, y: 0, z: 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
  return { s, ws, casts, tick: (ms) => { t += ms; } };
}
const MINE = { to: 'aaaa-0001', level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [HEAL] } };

test('AUDIT ALLY-CAST B1 link: a relay before world97 gets no cast frame at all (it would close the socket on one); a world97 welcome opens the door, and the door refuses a frame at myself, at a peer no socket reports, and past a whole blast (CAST_BURST_MAX)', () => {
  const old = linkRig('world96');
  assert.equal(old.s.castOk, false, 'the welcome said world96');
  assert.equal(old.s.sendCast(GOOD), false, 'refused at home');
  assert.equal(old.ws.sent.filter((x) => x.startsWith('{"t":"cast"')).length, 0, 'nothing on the wire');
  const { s, ws } = linkRig('world97');
  assert.equal(s.castOk, true);
  assert.equal(s.reachesPeer('peer-0002'), true, 'the welcome named Bran');
  assert.equal(s.sendCast(GOOD), true);
  assert.deepEqual(JSON.parse(ws.sent.filter((x) => x.startsWith('{"t":"cast"')).at(-1)), { t: 'cast', data: GOOD_OUT }, 'the wire\'s own projection, the icon defaulted');
  assert.equal(s.sendCast({ ...GOOD, to: 'aaaa-0001' }), false, 'never at myself');
  assert.equal(s.sendCast({ ...GOOD, to: 'peer-0009' }), false, 'nobody reports peer-0009');
  assert.equal(s.sendCast({ ...GOOD, spell: { ...GOOD.spell, rangeType: 0 } }), false, 'a self-cast never leaves');
  for (let i = 1; i < CAST_BURST_MAX; i++) assert.equal(s.sendCast(GOOD), true);
  assert.equal(s.sendCast(GOOD), false, 'the gate: a whole blast at once (FRIENDLY-SPELLS), no more');
  assert.equal(s.stats.casts, CAST_BURST_MAX);
});

test('AUDIT ALLY-CAST B5 link: a cast frame in is delivered when it is a peer\'s, projected and addressed to ME - my own id back, one at someone else and one that fails the wire land nothing; CAST_IN_HZ_MAX a second per sender', () => {
  const { s, ws, casts } = linkRig();
  ws.receive({ t: 'cast', id: 'peer-0002', data: MINE });
  assert.deepEqual(casts, [{ id: 'peer-0002', d: { ...MINE, spell: { ...MINE.spell, icon: 0 } } }], 'delivered, projected');
  ws.receive({ t: 'cast', id: 'aaaa-0001', data: MINE });
  ws.receive({ t: 'cast', id: 'peer-0002', data: { ...MINE, to: 'peer-0003' } });
  ws.receive({ t: 'cast', id: 'peer-0002', data: { ...MINE, level: 99 } });
  ws.receive({ t: 'cast', data: MINE });
  assert.equal(casts.length, 1, 'my own back, another\'s, an out-of-bounds level, an unstamped frame: nothing');
  for (let i = 0; i < CAST_IN_HZ_MAX + 4; i++) quiet(() => ws.receive({ t: 'cast', id: 'peer-0002', data: MINE }));
  assert.equal(casts.length, CAST_IN_HZ_MAX - 2, 'the inbound gate per sender: CAST_IN_HZ_MAX of Bran\'s frames in the second, and the two that failed the wire spent his tokens too (the gate runs before the projection, as the trade arm\'s does)');
  assert.equal(s.stats.sent, 1, 'the hello alone went out: nothing here answered');
});

// ─── THE MAGIC HOST, DRIVEN ─────────────────────────────────────────────────────────────────────────────────────

const mkPlayer = (over = {}) => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [], ...over,
});
function magicRig(player, { ally = null, door = () => true, wall = () => Infinity, rolls = () => 0.99 } = {}) {
  const world = { said: [], frames: [], picks: [], rays: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: (eye, dir, d) => { world.rays.push({ eye, dir, d }); return wall(d); } },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
    say: (l) => world.said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls,
    startCastAnim: null,
    allyTarget: (eye, dir, reach) => { world.picks.push({ eye, dir, reach }); return typeof ally === 'function' ? ally() : ally; },
    castAtAlly: (id, frame) => { const ok = door(); if (ok) world.frames.push({ id, frame }); return ok; },
  });
  // every host feeds the engine its live aim once a frame (firePending) - the release frame and the ready read it
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, world };
}
const BRAN = { id: 'peer-0002', name: 'Bran', distance: 3 };
const CLICK = () => [[0, 0.9, 0], [0, 0, 1]];

test('ALLY-CAST host: a CasterOnly Heal readied with a party mate under the crosshair ARMS (AUDIT ALLY-CAST A1) and the click sends it as a touch on them - the magicka spent, the caster told, and NOT healed themselves', () => {
  const player = mkPlayer();
  const sp = spellOf(0, [HEAL, EMPTY, EMPTY]);
  const cost = calculateCastCost(sp, player).sp;
  const { magic, world } = magicRig(player, { ally: BRAN });
  magic.readySpell(sp);
  assert.equal(magic.readied(), sp, 'A1: ARMED, not fired - the instant arm gave no sign of where the cast would land');
  assert.equal(world.said.at(-1), PRESS_BUTTON_TO_FIRE_SPELL, 'DFU\'s own line for an armed spell; the plaque says "Cast ... on Bran"');
  assert.equal(world.frames.length, 0); assert.equal(player.health, 20); assert.equal(player.magicka, 500, 'nothing spent yet: SetReadySpell stores the cost, CastReadySpell spends it');
  assert.equal(world.picks[0].reach, ALLY_TOUCH_REACH, 'looked for within touch reach');
  assert.deepEqual(world.picks[0].eye, [0, 0.9, 0], 'off the LIVE aim the host fed');
  assert.equal(magic.castInput(...CLICK()), true);
  assert.equal(world.frames.length, 1, 'one frame left');
  assert.deepEqual(world.frames[0], { id: 'peer-0002', frame: { to: 'peer-0002', level: 4, spell: { name: sp.name, element: 4, rangeType: 1, icon: 0, effects: [HEAL] } } });
  assert.equal(player.health, 20, 'the caster is not healed: the spell went to Bran');
  assert.equal(player.magicka, 500 - cost, 'and paid for it once');
  assert.ok(world.said.includes('You cast Balyna\'s Balm on Bran.'));
  assert.equal(magic.readied(), null, 'the ready is spent');
  assert.equal(magic.missileCount(), 0);
});

test('AUDIT ALLY-CAST A1/A2/A6/A7 host: a CasterOnly armed for a mate who then steps away heals ME on the click; a mate behind a wall is nobody (the collider\'s line of sight); a pick that throws is nobody; a FREE ready (a trap\'s) is never redirected', () => {
  // armed for Bran, Bran gone by the click: the CasterOnly arm as ever
  let there = BRAN;
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { ally: () => there });
  magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(magic.readied()?.name, 'Balyna\'s Balm', 'armed');
  there = null;
  assert.equal(magic.castInput(...CLICK()), true);
  assert.equal(world.frames.length, 0); assert.equal(player.health, 40, 'healed myself: the spell still does what it always did');
  assert.equal(magic.readied(), null);
  // A2: the wall - the pick says 3 m, the collider says a wall at 1.5 m
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { ally: BRAN, wall: () => 1.5 });
  r2.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(r2.magic.readied(), null, 'no mate in reach: the instant arm fired');
  assert.equal(r2.world.frames.length, 0); assert.equal(p2.health, 40, 'healed myself');
  assert.equal(r2.world.rays.at(-1).d, 3, 'the ray was cast to Bran\'s distance, along the unit aim');
  assert.deepEqual(r2.world.rays.at(-1).dir, [0, 0, 1]);
  const p3 = mkPlayer();
  const r3 = magicRig(p3, { ally: BRAN, wall: (d) => d + 0.5 });
  r3.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(r3.magic.readied()?.name, 'Balyna\'s Balm', 'a wall BEYOND Bran is no wall');
  // A6: a host pick that throws is a host seam, not the cast's law
  const p4 = mkPlayer();
  const r4 = magicRig(p4, { ally: () => { throw new Error('no peers yet'); } });
  r4.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(p4.health, 40, 'healed myself, nothing thrown');
  // A7: a free ready is the trap's spell on the player who sprang it
  const p5 = mkPlayer();
  const r5 = magicRig(p5, { ally: BRAN });
  r5.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]), { free: true });
  assert.equal(r5.world.picks.length, 0, 'never asked for a mate');
  assert.equal(r5.world.frames.length, 0); assert.equal(p5.health, 40); assert.equal(p5.magicka, 500, 'free');
  // ...and no aim fed at all (an engine no host frame has reached) never redirects
  const p6 = mkPlayer();
  const m6 = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: p6,
    playerSinks: { hurt() {}, heal(n) { p6.health += n; }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,
    allyTarget: () => BRAN, castAtAlly: () => { throw new Error('must not be asked'); },
  });
  m6.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(p6.health, 40, 'no aim, no mate');
});

test('ALLY-CAST host: with nobody under the crosshair the CasterOnly Heal heals the caster at the ready as it always did; a door that refuses falls through the same way', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { ally: null });
  magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  assert.equal(world.frames.length, 0); assert.equal(player.health, 40, 'healed 20'); assert.equal(magic.readied(), null, 'the instant arm');
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { ally: BRAN, door: () => false });
  r2.magic.readySpell(spellOf(0, [HEAL, EMPTY, EMPTY]));
  r2.magic.castInput(...CLICK());
  assert.equal(r2.world.frames.length, 0, 'the link refused (a socket gone, the gate, a relay too old)');
  assert.equal(p2.health, 40, '...so the spell did what it always did');
});

test('ALLY-CAST host: a ByTouch buff goes to the mate in touch reach and a ranged one to the mate in range reach; a damage spell and an area spell never look for one', () => {
  const player = mkPlayer();
  const { magic, world } = magicRig(player, { ally: BRAN });
  magic.readySpell(spellOf(1, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'CastReadySpell\'s touch gate admits the mate as it admits a foe');
  assert.equal(world.frames.length, 1); assert.equal(world.frames[0].frame.spell.rangeType, 1); assert.equal(world.picks.at(-1).reach, ALLY_TOUCH_REACH);
  magic.readySpell(spellOf(2, [HEAL, EMPTY, EMPTY], 'Far Balm'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.frames.length, 2); assert.equal(world.frames[1].frame.spell.rangeType, 2, 'a ranged cast keeps its type'); assert.equal(world.picks.at(-1).reach, ALLY_RANGE_REACH);
  assert.equal(magic.missileCount(), 0, 'no missile flew: the cast went straight to Bran');
  const picks = world.picks.length;
  magic.readySpell(spellOf(2, [DAMAGE, EMPTY, EMPTY], 'Fireball'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.picks.length, picks, 'a damage spell never asks for an ally');
  assert.equal(magic.missileCount(), 1, '...and flies as before');
  magic.readySpell(spellOf(3, [HEAL, EMPTY, EMPTY], 'Aura'));
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(world.picks.length, picks, 'an area around the caster is never redirected');
  assert.equal(world.frames.length, 2);
  // A2 at the touch gate: a mate behind a wall and no foe - the gate refuses, nothing spent
  const p2 = mkPlayer();
  const r2 = magicRig(p2, { ally: BRAN, wall: () => 1 });
  r2.magic.readySpell(spellOf(1, [FORTIFY, EMPTY, EMPTY], 'Strength'));
  assert.equal(r2.magic.castInput(...CLICK()), false, 'nobody in touch reach');
  assert.equal(r2.world.frames.length, 0); assert.equal(p2.magicka, 500, 'CastReadySpell aborts BEFORE spending');
});

// ─── THE RECEIVER'S DOOR, DRIVEN ────────────────────────────────────────────────────────────────────────────────

test('AUDIT ALLY-CAST C1/C2/C4 receiver: the gift lands as a self-cast (a Heal heals in full - no save), tagged a mate\'s: it never merges with my own bundle of the same kind, and dispels as my own without a roll', () => {
  const player = mkPlayer({ stats: { intelligence: 50, willpower: 100, endurance: 50 } });
  const { magic } = magicRig(player, { rolls: () => 0.3 });   // Dice100 rolls 31: under a willpower-100 save (60), a full save on an external bundle
  const heal = allyCastSpell(validCastData(MINE).spell);
  assert.equal(heal.rangeType, 0);
  const r = magic.applySpellToPlayer(heal, 5, null, { allyCast: true });
  assert.equal(r.healed, 20, 'the gift lands whole'); assert.ok(!r.saved);
  assert.equal(player.health, 40);
  const asTouch = magic.applySpellToPlayer({ ...heal, rangeType: 1 }, 5, null, {});
  assert.equal(asTouch.healed, 0, '...carried as the touch it was sent as, the same roll is a full save (the magnitude scaled to nothing) and the friend\'s Heal is ZERO - the first cut');
  // C2: my own Fortify, then a mate's - two bundles, mine untouched
  const FORT = { ...FORTIFY, durationBase: 10 };
  const mine = spellOf(0, [FORT, EMPTY, EMPTY], 'Strength');
  magic.applySpellToPlayer(mine, 4, null, {});
  const gift = allyCastSpell({ name: 'Strength', element: 4, rangeType: 1, effects: [{ ...FORT, magnitudeBaseLow: 1, magnitudeBaseHigh: 1 }] });
  magic.applySpellToPlayer(gift, 1, null, { allyCast: true });
  const forts = () => player.activeEffects.filter((a) => a.kind === 'fortifyAttribute' && a.stat === 'strength');
  assert.equal(forts().length, 2, 'beside mine, never over it (F12\'s incumbent merge capped my 10 at the mate\'s 1)');
  assert.deepEqual(forts().map((a) => [!!a.bundleAlly, a.magnitude]), [[false, 10], [true, 1]], 'mine at 10, the mate\'s at 1, each its own');
  const [own, theirs] = forts();
  assert.notEqual(own.bundleId, theirs.bundleId);
  const rounds = theirs.roundsRemaining;
  // a second gift of the same kind merges with the FIRST gift (F12's law among gifts), never with mine
  magic.applySpellToPlayer(gift, 1, null, { allyCast: true });
  assert.equal(forts().length, 2, 'the mate\'s recast merged into the mate\'s bundle');
  assert.ok(forts()[1].roundsRemaining > rounds, '...adding its rounds there'); assert.equal(forts()[0].magnitude, 10, 'mine untouched');
  // C4: dispelled as my own - no roll (the dungeon's and the surface's dispel picker read `ally`)
  const res = dispelBundle(player, theirs.bundleId, { selfCast: true, roll01: 0.99, chance: 0 });
  assert.equal(res.removed, 1); assert.equal(res.alert, 'dispelMagicSuccess');
  assert.deepEqual(forts().map((a) => a.magnitude), [10], 'mine stands');
});

// ─── THE HOST'S SEAMS, BY SOURCE ────────────────────────────────────────────────────────────────────────────────

test('ALLY-CAST by source: world.js picks the party mate with the F key\'s own ray and reach (the distance riding for the collider), hands the pick and the door to both cast engines, applies a received cast only from a party member and only its beneficial subset as a self-cast tagged a mate\'s, and the plaque asks the LIVE engine; the link and the relay carry the frame', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const allyTargetPick = \(eye, dir, reach\) => \{\s*\n\s*if \(!social\?\.party \|\| !online\) return null;\s*\n\s*const hit = pickPeerInFront\(eye \?\? cam\.pos, dir \?\? socialFwd\(\), peersNear\(\), reach, rayPersonDistance\);\s*\n\s*if \(!hit \|\| !social\.isPartyPeer\(hit\.peer\.id\) \|\| !online\.reachesPeer\?\.\(hit\.peer\.id\)\) return null;\s*\n\s*return \{ id: hit\.peer\.id, name: peerName\(hit\.peer\.id\) \?\? 'a party member', distance: hit\.distance \};/, 'the F key\'s pick, a party member, reachable, the distance for the line of sight');
  assert.match(w, /const castAtAllyDoor = \(id, frame\) => !!online\?\.sendCast\?\.\(frame\);/);
  assert.match(w, /\n    allyTarget: \(eye, dir, reach\) => allyTargetPick\(eye, dir, reach\),[^\n]*\n    castAtAlly: \(id, frame\) => castAtAllyDoor\(id, frame\),\n(?:    (?:fallenTarget|raiseFallen): [^\n]*\n)*    surfacePlayer,/, 'the surface engine\'s deps (lazily: the pick is declared after this engine is built; RESURRECT1\'s fallen pick and door beside them)');
  assert.match(w, /peerHoverName: \(key\) => peerHoverName\(key\),\s*\n\s*allyTarget: allyTargetPick,[^\n]*\n\s*castAtAlly: castAtAllyDoor,/, 'AUDIT ALLY-CAST A3: the host object the dungeon context is built from');
  assert.match(w, /online\.onCast = \(id, d\) => \{\s*\n\s*if \(!social\?\.isPartyPeer\(id\)\) return;\s*\n\s*if \(playerEntity\.health <= 0 \|\| modes\?\.deathUp\?\.\(\)\) return;\s*\n\s*const spell = allyCastSpell\(d\?\.spell\);\s*\n\s*if \(!spell\) return;\s*\n\s*const who = peerName\(id\) \?\? 'A party member';\s*\n\s*townTalk\.say\(allyCastTargetLine\(who, spell\.name\)\);\s*\n\s*const before = playerEntity\.health;\s*\n\s*magic\.applySpellToPlayer\(spell, d\.level, null, \{ allyCast: true \}\);\s*\n\s*const healed = Math\.max\(0, Math\.trunc\(playerEntity\.health - before\)\);\s*\n\s*if \(healed > 0\) townTalk\.say\(`You are healed \$\{healed\} points\.`\);/, 'the receiver decides: the party alone, the living alone, the beneficial subset alone, the caster named FIRST (C5), tagged a mate\'s (C2), the heal as the health that moved');
  assert.match(w, /const underground = modes\?\.mode === 'dungeon';\s*\n\s*const sp = \(underground \? modes\?\.dungeonCtx\?\.readiedSpell\?\.\(\) : magic\?\.readied\?\.\(\)\) \?\? null;\s*\n\s*const reach = sp && social\?\.isPartyPeer\(id\) && allyCastable\(sp\) \? allyReachFor\(sp\.rangeType\) : null;\s*\n\s*const pick = reach !== null \? \(underground \? modes\?\.dungeonCtx\?\.allyInReach\?\.\(cam\.pos, socialFwd\(\), reach\) : magic\?\.allyInReach\?\.\(cam\.pos, socialFwd\(\), reach\)\) \?\? null : null;\s*\n\s*const cast = pick\?\.id === id \? allyCastPlaqueLine\(sp\.name, name\) : null;\s*\n\s*return \{ title: marks \? `\$\{name\} \$\{marks\}` : name, subs: \[cast, peerRelationText\(acts\)\]\.filter\(Boolean\), actions: acts \? socialPlaqueRows\(id, acts\) : \[\], actionsUnlit: true \};/, 'A3/A5: the plaque\'s line off the LIVE engine\'s ready and its own allyInReach');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /allyTarget: \(eye, dir, reach\) => host\.allyTarget\?\.\(eye, dir, reach\) \?\? null,[^\n]*\n\s*castAtAlly: \(id, frame\) => !!host\.castAtAlly\?\.\(id, frame\),/, 'worldModes forwards the host object\'s pair into the dungeon context\'s opts');
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /startCastAnim: \(sp, onRelease\) => weaponRig\.castSpellAnim\(sp\?\.rangeType, sp\?\.element, onRelease\),\s*\n(?:\s*\/\/[^\n]*\n)*\s*allyTarget: \(eye, dir, reach\) => opts\.allyTarget\?\.\(eye, dir, reach\) \?\? null,\s*\n\s*castAtAlly: \(id, frame\) => !!opts\.castAtAlly\?\.\(id, frame\),/, 'the dungeon\'s own createPlayerMagic takes the pair');
  assert.match(dc, /readiedSpell: \(\) => magic\.readied\(\),[^\n]*\n\s*allyInReach: \(eye, dir, reach\) => magic\.allyInReach\(eye, dir, reach\),/, '...and answers the plaque through its api');
  assert.match(dc, /selfCast: b\.bundleType === 'Spell' && \(b\.selfCast !== false \|\| b\.ally === true\),/, 'C4: the dungeon\'s dispel picker');
  assert.match(wm, /selfCast: b\.bundleType === 'Spell' && \(b\.selfCast !== false \|\| b\.ally === true\),/, 'C4: the surface\'s');
  assert.match(rd('src/systems/mysticism.js'), /ally: !!a\.bundleAlly,/);
  const fxs = rd('src/systems/effects.js');
  assert.match(fxs, /const allyCast = ctx\.allyCast === true;\s*\n(?:\s*\/\/[^\n]*\n)*\s*const duelCast = ctx\.duelCast === true;\s*\n\s*const findInc = \(pred\) => \(heldItem \? undefined : target\.activeEffects\?\.find\(\(a\) => !a\.heldItem && !!a\.bundleAlly === allyCast && !!a\.bundleDuel === duelCast && pred\(a\)\)\);/, 'C2: the incumbent law reads the tag (DUEL1: and the duel\'s, the same way)');
  assert.match(fxs, /list\[i\]\.bundleAlly = allyCast;/);
  const o = rd('src/net/online.js');
  assert.match(o, /sendCast\(data\) \{\s*\n\s*const d = validCastData\(data\);\s*\n\s*if \(!d \|\| d\.to === this\.id \|\| !this\.castOk\) return false;/, 'the link projects its own frame first, and never sends one at a relay that would close the socket');
  assert.match(o, /if \(primary\) this\.castOk = relaySupportsCast\(relayV\);/);
  // AUDIT 68 S14-inbound-directed-gate-dup: the cast arm goes through the directed frames' one door, which projects and addresses
  assert.match(o, /this\._directedIn\(m, now, 'cast', this\._inCastBuckets, castInGate, CAST_IN_HZ_MAX, validCastData, \(id, d\) => this\.onCast\?\.\(id, d\)\);/, 'the cast arm through the directed door');
  assert.match(o, /const d = valid\(m\.data\);\s*\n\s*if \(d && d\.to === this\.id\) this\._deliver\(kind, \(\) => deliver\(m\.id, d\)\);/, '...and delivers only what is addressed to me');
  const h = rd('src/scenes/hostMagic.js');
  assert.match(h, /const ally = !readiedFree && allyReach !== null && allyCastable\(sp\) \? allyInReach\(eye, dir, allyReach\) : null;\s*\n\s*if \(ally && castAtAlly\?\.\(ally\.id, allyCastFrame\(sp, playerEntity\.level, ally\.id\)\)\) \{/, 'the release frame asks before the four range arms, never for a free ready');
  assert.match(h, /if \(!pickTouch\(eye, dir, sp\) && !\(!readiedFree && allyCastable\(sp\) && allyInReach\(eye, dir, ALLY_TOUCH_REACH\)\)\) return false;/, 'the touch gate');
  assert.match(h, /if \(!free && allyCastable\(sp\) && allyInReach\(lastAim\?\.eye \?\? null, lastAim\?\.dir \?\? null, ALLY_TOUCH_REACH\)\) \{ say\(PRESS_BUTTON_TO_FIRE_SPELL\); return true; \}\s*\n(?:\s*if \(!free && hasResurrect\(sp\)\)[^\n]*\n)?\s*return castInput\(null, null\) !== false;/, 'A1: the CasterOnly ready arms when a mate is in reach (RESURRECT1\'s own arm beside it; AUDIT CONTRIB H3: each arm answers, as SetReadySpell does)');
  assert.match(h, /function allyInReach\(eye, dir, reach\) \{\s*\n\s*if \(!eye \|\| !dir \|\| !allyTarget\) return null;\s*\n\s*let ally = null;\s*\n\s*try \{ ally = allyTarget\(eye, dir, reach\) \?\? null; \} catch \{ return null; \}\s*\n\s*if \(!ally\) return null;\s*\n\s*const d = ally\.distance;\s*\n\s*if \(Number\.isFinite\(d\) && d > 0\) \{\s*\n\s*const l = Math\.hypot\(dir\[0\], dir\[1\], dir\[2\]\) \|\| 1;\s*\n\s*const hit = collider\.raycast\(eye, \[dir\[0\] \/ l, dir\[1\] \/ l, dir\[2\] \/ l\], d\);\s*\n\s*if \(Number\.isFinite\(hit\) && hit < d - 1e-3\) return null;/, 'A2/A6: the line of sight and the guard');
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(m\.t === 'cast'\) \{[\s\S]{0,900}?a = this\._meterCast\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(isChatRoom\(a\.key\) \|\| isSocialRoom\(a\.key\)\) return;/, 'its own meter, a place room alone');
  // INSPECT1: the funnel is ONE helper now (`_senderFunnel`), the cast arm's and the card arm's - pinned where it lives
  // (among the destination's meters, AUDIT ATTACH), and the cast arm pinned to go through it
  assert.match(relay, /_senderFunnel\(tws, senderId, now, field = 'cin', hz = CAST_HZ_MAX\) \{[^\n]*\n\s*const meters = this\._meterOf\(tws\);\s*\n\s*const slots = meters\[field\] \?\?= \[\];\s*\n\s*let slot = slots\.find\(\(c\) => c\.id === senderId\) \?\? null;\s*\n\s*if \(!slot\) \{\s*\n\s*if \(slots\.length >= CAST_DEST_SENDERS_MAX\) \{ slots\.sort\(\(x, y\) => \(x\.b\?\.at \?\? 0\) - \(y\.b\?\.at \?\? 0\)\); slots\.shift\(\); \}\s*\n\s*slot = \{ id: senderId, b: null \}; slots\.push\(slot\);\s*\n\s*\}\s*\n\s*const funnel = tokenGate\(slot\.b, now, hz\);/, 'B2: the funnel per sender, the stalest slot to a newcomer (DUEL1: at the rate the arm names - the cast\'s by default)');
  assert.match(relay, /if \(!this\._senderFunnel\(tws, a\.id, now\)\) return;\s*\n\s*this\._send\(tws, JSON\.stringify\(\{ t: 'cast', id: a\.id, data: m\.data \}\)\);/, '...the cast arm through it');
});
