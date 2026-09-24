// INSPECT1 (2026-09-23, the community arc - kurkku: "a profile page that you can bring up when you're near them"; Mac:
// "a new enhanced UI element for the player inspect interaction. Showing their glyph, name, title, stats and worn
// gear"): THE PROFILE, DRIVEN. The card frame on the wire (an ask and an answer, every bound); the relay over the real
// Room (routed to the one socket `to` names, stamped, a place room's alone, the cast arm's per-sender funnel shared;
// its meter measured with every other arm's in test/auditattach.test.js); the session (asked only of a relay that routes it, gated both
// ways, delivered only when addressed to me); the card composed by the sheet's own producers and the answering law;
// the view (the relay's badge, their card's sheet, the look they wear now); the window over a fake document; the
// F-menu's Inspect row; the one glyph drawing; the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  parseClient, validCard, validCardData, relaySupportsCard, CARD_RELAY_MIN, CARD_HZ_MAX, CARD_IN_HZ_MAX, CARD_FRAME_MAX,
  CARD_LEVEL_MAX, CARD_STAT_MAX, CARD_VITAL_MAX, CARD_ATTRS, CARD_VITALS, RELAY_VERSION, CAST_HZ_MAX, DROP_STRIKES_MAX,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { composeCard, createCardAnswerGate, CARD_WAIT_MS, CARD_ANSWER_MS, CARD_ANSWER_ASKERS_MAX } from '../src/net/profileCard.js';
import { composeLook } from '../src/net/remotePlayers.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { MAX_STAT_VALUE } from '../src/systems/statMods.js';
import { profileView, profileNote, gearRows, GEAR_ROWS, ATTR_SHORT, VITAL_LABELS, PROFILE_CSS, createProfileWindow } from '../src/ui/profileWindow.js';
import { socialMenuRows, socialPlaqueRows, plaqueRowFor } from '../src/ui/socialMenu.js';
import { glyphSvgNode, glyphBadges, GLYPH_STROKE } from '../src/ui/playerBadge.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { HEAL_SPELL } from './placeWidest.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

const LOOK = { race: 'DarkElf', gender: 'male', faceIndex: 2, class: 'Nightblade', items: [
  { templateIndex: 102, group: 'Armor', equipSlot: EQUIP_SLOTS.ChestArmor, material: 0x0202 },
  { templateIndex: 115, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand, material: 6 },
  { templateIndex: 104, group: 'Armor', equipSlot: EQUIP_SLOTS.Head, material: 0x0100 },
] };
const CARD = { level: 12, attrs: [55, 60, 45, 70, 50, 40, 65, 50], vitals: [118, 105, 96], look: LOOK };

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('INSPECT1 wire: a card frame is an ASK or an ANSWER, never both; the card whole or nothing - the level, eight attributes and three vitals each an integer inside its bound, the look through the room\'s own law; world102 the first relay that routes it (world99 before the first merge, world101 before the sixth: main\'s world99, world100 and world101 route no card) (mutants: an ask carrying a card admitted; a bound off by one; a short card admitted; the look unprojected)', () => {
  assert.deepEqual(validCardData({ to: 'peer-0002', ask: true }), { to: 'peer-0002', ask: true });
  assert.deepEqual(validCardData({ to: 'peer-0002', card: CARD }), { to: 'peer-0002', card: { ...CARD, look: { ...LOOK } } });
  for (const bad of [
    { to: 'peer-0002' }, { to: 'peer-0002', ask: true, card: CARD }, { to: 'peer-0002', ask: false }, { to: 'peer-0002', ask: 1 },
    { to: 'x', ask: true }, { ask: true }, { to: 'peer-0002', card: null }, null, [], 'ask',
  ]) assert.equal(validCardData(bad), null, JSON.stringify(bad));
  assert.equal(CARD_ATTRS, STAT_KEYS_ORDER.length, 'the card\'s attributes are the sheet\'s, in its order');
  assert.equal(CARD_STAT_MAX, MAX_STAT_VALUE, 'an attribute\'s ceiling is the live clamp the sheet draws under - the relay imports no game module, so this pin holds the two equal');
  assert.equal(CARD_VITALS, 3);
  const off = (patch) => validCard({ ...CARD, ...patch });
  assert.ok(off({ level: 1 }) && off({ level: CARD_LEVEL_MAX }), 'the bounds themselves');
  for (const level of [0, CARD_LEVEL_MAX + 1, 1.5, '12', null]) assert.equal(off({ level }), null, `level ${level}`);
  assert.equal(off({ attrs: CARD.attrs.slice(0, 7) }), null, 'seven attributes are half a sheet');
  assert.equal(off({ attrs: [...CARD.attrs, 50] }), null);
  assert.equal(off({ attrs: [CARD_STAT_MAX + 1, ...CARD.attrs.slice(1)] }), null);
  assert.equal(off({ attrs: [-1, ...CARD.attrs.slice(1)] }), null);
  assert.ok(off({ attrs: [CARD_STAT_MAX, ...CARD.attrs.slice(1)] }));
  assert.equal(off({ vitals: [1, 2] }), null);
  assert.equal(off({ vitals: [CARD_VITAL_MAX + 1, 1, 1] }), null);
  assert.equal(off({ look: null }), null, 'no look, no card');
  const junk = off({ look: { ...LOOK, items: [...LOOK.items, { templateIndex: 1, group: 'Books', equipSlot: 3 }], secret: 'x' } });
  assert.equal(junk.look.items.length, 3, 'the look projected by validLook - a group the doll does not draw is dropped');
  assert.equal(junk.look.secret, undefined);
  // the parser
  assert.deepEqual(parseClient(JSON.stringify({ t: 'card', data: { to: 'peer-0002', ask: true } }), { hasHello: true }), { t: 'card', data: { to: 'peer-0002', ask: true } });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'card', data: { to: 'peer-0002', ask: true } })), { error: 'card before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'card', data: { to: 'peer-0002' } }), { hasHello: true }), { error: 'bad card' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'card', data: { to: 'peer-0002', card: CARD, pad: 'x'.repeat(CARD_FRAME_MAX) } }), { hasHello: true }), { error: 'frame too large' });
  assert.equal(RELAY_VERSION, 'world107');   // DUEL1's duel frame and this card's account stamp (world107); DISC23-B's look (world106); AUDIT 68's relay law (world105); TITLE-N's dm frame (world104); the contributor's dd/rz moved it past the arc's world102; the card frame stays gated at 102
  assert.equal(CARD_RELAY_MIN, 102);
  assert.equal(relaySupportsCard('world102'), true);
  assert.equal(relaySupportsCard('world101'), false);
  assert.equal(relaySupportsCard(null), false);
  // a full card of 27 worn items of the widest fields fits the frame
  const wide = { templateIndex: 65535, group: 'WomensClothing', material: 4095, dye: 4095, variant: 4095 };
  const full = { ...CARD, level: CARD_LEVEL_MAX, attrs: Array(8).fill(CARD_STAT_MAX), vitals: [CARD_VITAL_MAX, CARD_VITAL_MAX, CARD_VITAL_MAX], look: { ...LOOK, items: Array.from({ length: 27 }, (_, i) => ({ ...wide, equipSlot: i })) } };
  const frame = JSON.stringify({ t: 'card', data: { to: 'x'.repeat(40), card: validCard(full) } });
  assert.ok(frame.length < CARD_FRAME_MAX, `the widest card fits: ${frame.length} of ${CARD_FRAME_MAX}`);
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms = 1000) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const cards = (ws) => ws.sent.filter((m) => m.t === 'card');

test('INSPECT1 relay: an ask reaches the one player it names, stamped with the asker\'s id, and the answer rides back the same way; nobody else hears either; a hub or a channel is nowhere to stand; a frame at myself is junk; a peer gone is nothing (mutants: the frame fanned to the room; the stamp missing; a channel carrying it)', () => withRoom('world:3,12', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  const c = r.connect(); await r.hello(c, 'peer-0003');
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'card', data: { to: 'peer-0002', ask: true } }));
  assert.deepEqual(cards(b), [{ t: 'card', id: 'peer-0001', sub: 'acct-peer-0001', data: { to: 'peer-0002', ask: true } }]);   // DUEL1: and the asker's verified account beside its id
  assert.equal(cards(a).length + cards(c).length, 0, 'the asker and a bystander hear nothing');
  await r.raw(b, JSON.stringify({ t: 'card', data: { to: 'peer-0001', card: CARD } }));
  assert.deepEqual(cards(a), [{ t: 'card', id: 'peer-0002', sub: 'acct-peer-0002', data: { to: 'peer-0001', card: validCard(CARD) } }]);
  assert.equal(cards(c).length, 0);
  // a frame at myself: junk, counted (AUDIT WORLD2 A4's instrument - a stream of them is struck out)
  assert.equal(a.meters.junk ?? 0, 0);
  await r.raw(a, JSON.stringify({ t: 'card', data: { to: 'peer-0001', ask: true } }));
  assert.equal(a.meters.junk, 1, 'a card at my own id is junk');
  assert.equal(cards(a).length + cards(b).length + cards(c).length, 2, '...and goes nowhere');
  // a peer that is gone: nothing, and not junk
  await r.raw(b, JSON.stringify({ t: 'card', data: { to: 'peer-0099', ask: true } }));
  assert.equal(b.meters.junk ?? 0, 0, 'a leave races a frame - not junk');
  assert.equal(a.closed ?? b.closed ?? c.closed, null);
}).then(() => withRoom('chat:world', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'card', data: { to: 'peer-0002', ask: true } }));
  assert.equal(cards(b).length, 0, 'a channel is nowhere to stand beside someone');
})));

test('INSPECT1 relay: a card rides the CAST arm\'s own per-sender funnel onto its destination - one sender, one destination, one bucket whatever the directed frame: a card waits on the casts its sender spent onto that destination, another sender\'s slot is its own - and its sender\'s own meter holds it to CARD_HZ_MAX a second across every destination and strikes a flood out in its own words (mutants: the card funnel its own; the funnel skipped; the meter unstruck; the meter dropping nothing)', () => withRoom('world:3,12', async ({ r, tick }) => {
  const me = r.connect(); await r.hello(me, 'peer-0001');
  const s = r.connect(); await r.hello(s, 'peer-0002');
  const o = r.connect(); await r.hello(o, 'peer-0003');
  tick(5000);
  const cast = JSON.stringify({ t: 'cast', data: { to: 'peer-0001', level: 5, spell: HEAL_SPELL } });
  const ask = JSON.stringify({ t: 'card', data: { to: 'peer-0001', ask: true } });
  me.sent.length = 0;
  for (let k = 0; k < CAST_HZ_MAX; k++) await r.raw(s, cast);
  assert.equal(me.sent.filter((m) => m.t === 'cast').length, CAST_HZ_MAX, 'the sender\'s bucket onto me, spent on casts');
  await r.raw(s, ask);
  assert.equal(cards(me).length, 0, 'the card waits on the bucket its sender\'s casts spent - one sender, one destination, one bucket');
  await r.raw(o, ask);
  assert.equal(cards(me).length, 1, 'another sender\'s slot is its own');
  assert.deepEqual(me.meters.cin.map((c) => c.id).sort(), ['peer-0002', 'peer-0003'], 'ONE list of sender slots among the destination\'s meters - the card\'s and the cast\'s');
  // a flood from one sender: its own meter passes CARD_HZ_MAX a second, then strikes a frame, and closes past the bound
  tick(5000);
  me.sent.length = 0;
  for (let k = 0; k < CARD_HZ_MAX + DROP_STRIKES_MAX; k++) await r.raw(s, ask);
  assert.equal(s.closed, null, 'the strikes at the bound, not past it');
  assert.equal(s.meters.cardDrops, DROP_STRIKES_MAX);
  assert.equal(cards(me).length, Math.min(CARD_HZ_MAX, CAST_HZ_MAX), 'a second\'s worth reached me');
  await r.raw(s, ask);
  assert.equal(s.closed?.reason, 'too many card frames', 'one past it, closed in its own words');
  // and the meter is the SENDER's, whatever the destination: each destination's funnel bounds what it takes from one
  // sender, the meter what one sender puts out - CARD_HZ_MAX a second across every destination together
  const s2 = r.connect(); await r.hello(s2, 'peer-0004');
  tick(5000);
  me.sent.length = 0; o.sent.length = 0;
  for (let k = 0; k < 2 * CARD_HZ_MAX; k++) await r.raw(s2, JSON.stringify({ t: 'card', data: { to: k % 2 ? 'peer-0003' : 'peer-0001', ask: true } }));
  assert.equal(cards(me).length + cards(o).length, CARD_HZ_MAX, 'CARD_HZ_MAX a second from one sender, spread over two destinations');
}));

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────

function linkRig(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onCard = (id, d) => got.push({ id, d });
  quiet(() => s.join('dungeon:m187', { x: 1, y: 0, z: 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'card');
  return { s, ws, got, out, tick: (ms) => { t += ms; } };
}

test('INSPECT1 session: a card frame goes only to a relay that routes it (an older one would close the socket), through the wire\'s projection, to a peer some socket reports, CARD_HZ_MAX a second; one in is delivered only when a peer\'s, addressed to ME and whole, CARD_IN_HZ_MAX a second per sender (mutants: the version door dropped; the gate dropped; a frame at someone else delivered)', () => {
  const old = linkRig('world100');
  assert.equal(old.s.cardOk, false);
  assert.equal(old.s.sendCard({ to: 'peer-0002', ask: true }), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const { s, got, out, ws, tick } = linkRig();
  assert.equal(s.cardOk, true);
  assert.equal(s.sendCard({ to: 'peer-0002', ask: true }), true);
  assert.deepEqual(out().at(-1), { t: 'card', data: { to: 'peer-0002', ask: true } });
  assert.equal(s.sendCard({ to: 'aaaa-0001', ask: true }), false, 'never at myself');
  assert.equal(s.sendCard({ to: 'peer-0009', ask: true }), false, 'nobody reports peer-0009');
  assert.equal(s.sendCard({ to: 'peer-0002', ask: true, card: CARD }), false, 'a frame the wire refuses never leaves');
  for (let i = 1; i < CARD_HZ_MAX; i++) assert.equal(s.sendCard({ to: 'peer-0002', card: CARD }), true);
  assert.equal(s.sendCard({ to: 'peer-0002', ask: true }), false, 'CARD_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendCard({ to: 'peer-0002', ask: true }), true);
  // in
  ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'aaaa-0001', card: CARD } });
  ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'aaaa-0001', ask: true } });
  ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'peer-0003', ask: true } });
  ws.receive({ t: 'card', id: 'aaaa-0001', data: { to: 'aaaa-0001', ask: true } });
  ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'aaaa-0001', card: { ...CARD, level: 0 } } });
  ws.receive({ t: 'card', data: { to: 'aaaa-0001', ask: true } });
  assert.deepEqual(got.map((x) => [x.id, x.d.ask ? 'ask' : 'card']), [['peer-0002', 'card'], ['peer-0002', 'ask']], 'someone else\'s, my own back, a card no sheet draws, an unstamped frame: nothing');
  assert.deepEqual(got[0].d.card, validCard(CARD));
  for (let i = 0; i < CARD_IN_HZ_MAX + 4; i++) quiet(() => ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'aaaa-0001', ask: true } }));
  assert.equal(got.length, CARD_IN_HZ_MAX - 2, 'the inbound gate per sender, a second - the two of theirs that were no card for me spent their tokens too (my own echo and an unstamped frame were no sender\'s)');
  ws.receive({ t: 'card', id: 'peer-0003', data: { to: 'aaaa-0001', ask: true } });
  assert.equal(got.at(-1).id, 'peer-0003', 'another sender has a bucket of its own');
  tick(1000);
  ws.receive({ t: 'card', id: 'peer-0002', data: { to: 'aaaa-0001', ask: true } });
  assert.equal(got.at(-1).id, 'peer-0002', 'and the flooder is heard again when the second is out');
});

// ─── THE CARD AND THE ANSWER ────────────────────────────────────────────────────────────────────────────────────

test('INSPECT1 the card is what their own sheet shows - the sheet\'s own producers over the same entity - and the look they wear NOW; clamped into the wire\'s bounds and through its projection (mutants: base stats for live ones; fatigue in points; the look left off)', () => {
  const entity = {
    level: 12, race: 'DarkElf', gender: 'male', faceIndex: 2, career: { name: 'Nightblade' },
    stats: { strength: 55, intelligence: 60, willpower: 45, agility: 70, endurance: 50, personality: 40, speed: 65, luck: 50 },
    activeEffects: [{ kind: 'disease', statMods: { strength: -5 } }],
    maxHealth: 118, maxMagicka: 96, items: [], equip: null,
  };
  const card = composeCard(entity);
  const sheet = sheetModel(entity);
  assert.equal(card.level, sheet.level);
  assert.deepEqual(card.attrs, sheet.attributes.map((a) => a.value), 'the sheet\'s live attributes, in its order');
  assert.equal(card.attrs[0], 50, 'live: the disease\'s -5 shows, as it shows on their sheet');
  assert.deepEqual(card.vitals, [sheet.health.max, sheet.fatigue.max, sheet.magicka.max], 'the sheet\'s maxima - fatigue at its /64 figure');
  assert.deepEqual(card.look, composeLook(entity), 'the look they wear now');
  // an attribute past the live clamp: the card says what the sheet says. Were the port ever to lift the clamp (DFU's
  // ChangeStatMaxMod, recorded unported in statMods.js), the sheet would draw 140 and this would fail - and the wire's
  // CARD_STAT_MAX must follow it, or the card would understate every fortified player.
  const fortified = { ...entity, stats: { ...entity.stats, strength: 90 }, activeEffects: [{ kind: 'fortifyAttribute', stat: 'strength', magnitude: 50 }] };
  assert.deepEqual(composeCard(fortified).attrs, sheetModel(fortified).attributes.map((a) => a.value), 'the sheet\'s live clamp, the card\'s');
  assert.equal(composeCard(fortified).attrs[0], MAX_STAT_VALUE);
  const wild = composeCard({ ...entity, level: 0, stats: { ...entity.stats, luck: 5000 }, maxHealth: -3, maxMagicka: 1e9 });
  assert.equal(wild.level, 1);
  assert.equal(wild.attrs[7], MAX_STAT_VALUE);
  assert.equal(wild.vitals[0], 0);
  assert.equal(wild.vitals[2], CARD_VITAL_MAX);
  assert.ok(validCard(wild), 'whatever the entity says, the card is one the wire carries');
  assert.ok(validCard(composeCard(null)), 'and an entity with nothing on it is a level-1 card of zeros');
});

test('INSPECT1 the answering law: one asker is answered once in CARD_ANSWER_MS, however often they ask; askers are remembered to a bound, the stalest forgotten first (mutants: every ask answered; the memory unbounded; the stalest kept)', () => {
  const g = createCardAnswerGate();
  assert.equal(g.pass('peer-0002', 1000), true);
  assert.equal(g.pass('peer-0002', 1000 + CARD_ANSWER_MS - 1), false, 'asked again too soon');
  assert.equal(g.pass('peer-0003', 1500), true, 'another asker is their own');
  assert.equal(g.pass('peer-0002', 1000 + CARD_ANSWER_MS), true, 'and again when the interval is out');
  assert.equal(g.pass('', 5000), false);
  assert.equal(g.pass('peer-0004', NaN), false);
  const small = createCardAnswerGate({ intervalMs: 10_000, max: 3 });
  for (const [id, t] of [['a1', 1], ['a2', 2], ['a3', 3]]) small.pass(id, t);
  assert.equal(small.size(), 3);
  assert.equal(small.pass('a4', 4), true);
  assert.equal(small.size(), 3, 'bounded');
  assert.equal(small.pass('a1', 5), true, 'the stalest was forgotten, so they are answered afresh');
  assert.equal(small.pass('a3', 6), false, 'the newer ones are still remembered');
  assert.equal(CARD_ANSWER_ASKERS_MAX, 64);
  assert.ok(CARD_WAIT_MS >= 2000);
});

// ─── THE VIEW ───────────────────────────────────────────────────────────────────────────────────────────────────

test('INSPECT1 the view: the title and the glyphs are the RELAY\'s (the peer record\'s badge), never the card\'s; the level, attributes and vitals are the card\'s; the gear is named as the pack names it, head to foot, off the card\'s look when it came and the room\'s until then; each state has its line (mutants: the room\'s look preferred to the card\'s; the gear out of order; the attributes shown without a card)', () => {
  const peer = { id: 'peer-0002', name: 'Bran', title: 'founder', glyphs: ['mod', 'sprout'] };
  const v = profileView({ name: 'Bran', peer, look: LOOK, card: { ...CARD, title: 'developer' }, state: 'answered' });
  assert.equal(v.name, 'Bran');
  assert.equal(v.title.key, 'founder', 'the relay\'s badge - the card carries none, and one on it is ignored');
  assert.deepEqual(v.glyphs.map((g) => g.key), glyphBadges(peer).map((g) => g.key), 'the badge law\'s own order');
  assert.equal(v.line, 'Level 12 Dark Elf Nightblade');
  assert.deepEqual(v.attrs.map((a) => `${a.short} ${a.value}`), ATTR_SHORT.map((s, i) => `${s} ${CARD.attrs[i]}`));
  assert.deepEqual(v.vitals.map((x) => x.label), [...VITAL_LABELS]);
  assert.deepEqual(v.gear.map((g) => g.slot), ['Head', 'Chest', 'Right hand'], 'head to foot, then the hands');
  assert.deepEqual(v.gear.map((g) => g.name), [LOOK.items[2], LOOK.items[0], LOOK.items[1]].map((it) => itemLongName(it)), 'named as the pack names them');
  assert.equal(v.note, null);
  // the card's look wins: they changed their armour after their last hello
  const now = { ...LOOK, items: [{ templateIndex: 102, group: 'Armor', equipSlot: EQUIP_SLOTS.ChestArmor, material: 0x0206 }] };
  const fresh = profileView({ name: 'Bran', peer, look: LOOK, card: { ...CARD, look: now }, state: 'answered' });
  assert.deepEqual(fresh.gear.map((g) => g.name), [itemLongName(now.items[0])]);
  // without a card: the room's half, and a line
  const asking = profileView({ name: 'Bran', peer, look: LOOK, state: 'asking' });
  assert.equal(asking.line, 'Dark Elf Nightblade');
  assert.deepEqual(asking.attrs, []);
  assert.equal(asking.gear.length, 3, 'the gear is the room\'s already');
  assert.equal(asking.note, 'Asking Bran for their card...');
  assert.equal(profileView({ name: 'Bran', look: LOOK, state: 'silent' }).note, 'Bran did not answer - this is what they wear.');
  assert.equal(profileView({ name: 'Bran', look: LOOK, state: 'unsupported' }).note, 'The server cannot carry a card yet - this is what Bran wears.');
  assert.equal(profileView({ look: LOOK, state: 'nonsense' }).note, profileNote('silent', 'Someone'), 'an unknown state reads as no answer');
  assert.equal(profileView({}).name, 'Someone');
  assert.deepEqual(gearRows({ items: [{ templateIndex: 115, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand }, { templateIndex: 116, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand }] }).length, 1, 'a slot is one place');
  assert.equal(new Set(GEAR_ROWS.map(([s]) => s)).size, GEAR_ROWS.length, 'every slot once');
  assert.ok(GEAR_ROWS.every(([s]) => Number.isInteger(s) && s >= 0 && s < 27));
});

// ─── THE WINDOW ─────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc, ns = null) {
  const n = {
    tag, ns, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '',
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    fire(t, ev = {}) { for (const fn of n.listeners[t] ?? []) fn({ stopPropagation() {}, preventDefault() {}, ...ev }); },
    focus() { doc.focused = n; }, remove() { n.removed = true; },
  };
  return n;
}
function fakeDoc() {
  const doc = { styles: [] };
  doc.createElement = (t) => fakeNode(t, doc);
  doc.createElementNS = (ns, t) => fakeNode(t, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
function fakeWin() {
  const ls = [];
  return { addEventListener(t, fn, cap) { ls.push({ t, fn, cap }); }, removeEventListener(t, fn) { const i = ls.findIndex((l) => l.fn === fn); if (i >= 0) ls.splice(i, 1); },
    key(code, target = null) { const ev = { type: 'keydown', code, target, stopped: false, preventDefault() {}, stopImmediatePropagation() { ev.stopped = true; } }; for (const l of ls.filter((x) => x.t === 'keydown')) l.fn(ev); return ev; }, count: () => ls.length };
}
// a class is the element's className, or an SVG node's `class` attribute (an SVG element's className is no string)
const all = (n, cls, out = []) => { if (`${n.className} ${n.attrs?.class ?? ''}`.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');

test('INSPECT1 the window: it stands the badge, the name, the line, the sheet and the gear; the answer redraws only the card that asked; Close and Escape take it down and hand the pointer back once; a surface above it keeps its Escape; a window over the HUD takes it away (mutants: an answer drawn on another\'s card; Escape eaten under a surface above; the pointer freed twice)', () => {
  const doc = fakeDoc(), win = fakeWin();
  let opened = 0, closed = 0, over = false;
  const w = createProfileWindow({ doc, win, onOpen: () => opened++, onClose: () => closed++, above: () => over });
  assert.ok(doc.getElementById('dagger-profile-style'), 'its sheet, injected once');
  const peer = { title: 'developer', glyphs: ['dev'] };
  assert.equal(w.show('peer-0002', profileView({ name: 'Bran', peer, look: LOOK, state: 'asking' })), true);
  assert.equal(opened, 1);
  const card = w.root.children[0];
  assert.equal(text(all(card, 'dfprofile-title')[0]), 'Developer');
  assert.equal(all(card, 'dfprofile-title')[0].style.color, '#e2453a', 'the title in its own colour');
  assert.equal(text(all(card, 'dfprofile-nametext')[0]), 'Bran');
  assert.equal(all(card, 'dfprofile-glyph').length, 1, 'the glyph through the one drawing');
  assert.equal(text(all(card, 'dfprofile-line')[0]), 'Dark Elf Nightblade');
  assert.equal(all(card, 'dfprofile-stat').length, 0, 'no sheet before the card');
  assert.equal(all(card, 'dfprofile-row').length, 3, 'the room\'s gear at once');
  assert.equal(text(all(card, 'dfprofile-note')[0]), 'Asking Bran for their card...');
  // an answer for someone else draws nothing; theirs draws the sheet
  assert.equal(w.update('peer-0003', profileView({ name: 'Cid', look: LOOK, card: CARD, state: 'answered' })), false);
  assert.equal(text(all(w.root.children[0], 'dfprofile-nametext')[0]), 'Bran');
  assert.equal(w.update('peer-0002', profileView({ name: 'Bran', peer, look: LOOK, card: CARD, state: 'answered' })), true);
  assert.equal(all(card, 'dfprofile-stat').length, 8);
  assert.equal(all(card, 'dfprofile-vital').length, 3);
  assert.equal(all(card, 'dfprofile-note').length, 0, 'answered: no line');
  assert.equal(text(all(card, 'dfprofile-line')[0]), 'Level 12 Dark Elf Nightblade');
  // a second peer's card over the first frees nothing twice
  w.show('peer-0003', profileView({ name: 'Cid', look: LOOK, state: 'asking' }));
  assert.equal(opened, 1);
  assert.equal(w.peerId(), 'peer-0003');
  // Escape: a surface above keeps it; otherwise it closes, stopped
  over = true;
  const kept = win.key('Escape');
  assert.equal(w.isOpen(), true); assert.equal(kept.stopped, false);
  over = false;
  const shut = win.key('Escape');
  assert.equal(w.isOpen(), false); assert.equal(shut.stopped, true, 'the key is spent - no pause door under it');
  assert.equal(closed, 1);
  // Close
  w.show('peer-0002', profileView({ name: 'Bran', look: LOOK, state: 'asking' }));
  all(w.root.children[0], 'dfprofile-close')[0].fire('click');
  assert.equal(w.isOpen(), false); assert.equal(closed, 2);
  // covered
  w.show('peer-0002', profileView({ name: 'Bran', look: LOOK, state: 'asking' }));
  w.render({ covered: true });
  assert.equal(w.isOpen(), false); assert.equal(closed, 3);
  // a gate that says no stands nothing and frees nothing
  const gated = createProfileWindow({ doc, win, canOpen: () => false, onOpen: () => opened++ });
  assert.equal(gated.show('peer-0002', profileView({ look: LOOK })), false);
  const before = win.count();
  w.destroy(); gated.destroy();
  assert.equal(win.count(), before - 2, 'each took its one listener with it');
  // the sheet: a close a thumb can press, a narrow box stacks the columns
  assert.match(PROFILE_CSS, /\.dfprofile-close \{[^}]*min-height: 44px;/);
  assert.match(PROFILE_CSS, /\.dfprofile-card \{[^}]*box-sizing: border-box;[^}]*max-height: calc\(100vh - 28px\);/, 'the max height bounds the WHOLE card, padding and border with it - content-box left a 1px gutter (tools/profileProbe.mjs)');
  assert.match(PROFILE_CSS, /@container \(max-width: 400px\) \{ \.dfprofile-body \{ grid-template-columns: minmax\(0, 1fr\); \} \.dfprofile-name \{ font-size: 16px; \} \}/, 'a narrow box stacks the columns and takes the name a size down');
});

test('INSPECT1 the F-menu\'s Inspect row: first, when the host offers it, acting `profile.inspect` on that peer; a host that says nothing gets the menu it always had; the World Tooltips plaque lists it as its first verb and presses it through the same act (the merge with main\'s ACT-MENU: one source of rows for both surfaces); and the one glyph drawing every DOM face uses (mutants: the row missing; the row always present; a stroke glyph filled)', () => {
  const rows = socialMenuRows({ peerId: 'peer-0002', canFriend: true, canInvite: true, canInspect: true });
  assert.deepEqual(rows.map((r) => r.key), ['inspect', 'friend', 'invite', 'cancel']);
  assert.deepEqual(rows[0], { key: 'inspect', label: 'Inspect', enabled: true, why: null, act: { k: 'profile.inspect', peer: 'peer-0002' } });
  assert.deepEqual(socialMenuRows({ peerId: 'peer-0002' }).map((r) => r.key), ['friend', 'invite', 'cancel'], 'unoffered, unchanged');
  assert.deepEqual(socialPlaqueRows('peer-0002', { canFriend: true, canInvite: true, canInspect: true })[0], { id: 'inspect', label: 'Inspect' }, 'the plaque\'s first verb');
  assert.deepEqual(plaqueRowFor('inspect', 'peer-0002', { canInspect: true }), { act: { k: 'profile.inspect', peer: 'peer-0002' }, refusal: null }, 'and its press, the card\'s own act');
  const doc = fakeDoc();
  const [sprout] = glyphBadges({ glyphs: ['sprout'] });
  const svg = glyphSvgNode(doc, sprout, 'x-glyph', 1.6);
  assert.equal(svg.attrs.class, 'x-glyph');
  assert.equal(svg.attrs.viewBox, '0 0 16 16');
  assert.equal(svg.children[0].attrs.d, sprout.path);
  assert.equal(svg.children[0].attrs['stroke-width'], GLYPH_STROKE.sprout ? '1.6' : undefined, 'the face says how thick');
  assert.equal(svg.children[0].attrs.fill, GLYPH_STROKE.sprout ? 'none' : 'currentColor');
  assert.equal(glyphSvgNode({}, sprout, 'x'), null, 'no SVG door, no glyph - and no throw');
  for (const f of ['src/ui/chatPanel.js', 'src/ui/nameLayer.js', 'src/ui/profileWindow.js']) {
    const s = rd(f);
    assert.match(s, /glyphSvgNode\(doc, g, /, `${f} draws through the one drawing`);
    assert.doesNotMatch(s, /createElementNS\?\.\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/, `${f} has no svg door of its own`);
  }
});

// ─── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────

test('INSPECT1 host by source: the Inspect row is offered on every body the F key finds; its act opens the profile at once from the room\'s half and asks for the card only of a relay that routes it, retried by the frame and timed at CARD_WAIT_MS; an ask is answered through the gate with my own card, an answer drawn only on the card that asked; F again closes the profile; the other surfaces yield their Escape to it (mutants: an ask sent to an old relay; the answer drawn for anyone; the wait never said)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const peerActsFor = \(peerId\) => \(\{ \.\.\.social\.actionsFor\(peerId\), \.\.\.tradeActionsFor\(peerId\), canInspect: true, canReadPage: !!pageOffers\.get\(peerId\), \.\.\.duelActionsFor\(peerId\) \}\);/, 'one bag: the hub\'s acts, the trade\'s, and the look (JOURNAL1: and a page they hold out to me)');
  assert.match(w, /peerId: hit\.peer\.id, actions: peerActsFor\(hit\.peer\.id\) \}\) === true;/, 'the F-card reads it');
  assert.match(w, /const acts = social \? peerActsFor\(id\) : null;/, 'the plaque\'s rows read it (ACT-MENU)');
  assert.match(w, /const row = plaqueRowFor\(sel\.id, id, peerActsFor\(id\)\);/, 'and the plaque\'s press');
  assert.match(w, /if \(act\.k === 'profile\.inspect'\) \{ inspectPeer\(act\.peer\); return; \}/);
  const inspect = w.slice(w.indexOf('const inspectPeer = (peerId) => {'), w.indexOf('const socialInteract = () => {'));
  assert.match(inspect, /const can = !!online\?\.cardOk;\s*\n\s*_profileAsk = can \? \{ peerId, at: performance\.now\(\), sent: false \} : null;\s*\n\s*if \(_profileAsk\) _profileAsk\.sent = online\.sendCard\(\{ to: peerId, ask: true \}\) === true;/);
  assert.match(inspect, /state: can \? 'asking' : 'unsupported'/);
  assert.match(inspect, /if \(!_profileAsk\.sent\) _profileAsk\.sent = online\?\.sendCard\(\{ to: _profileAsk\.peerId, ask: true \}\) === true;\s*\n\s*if \(performance\.now\(\) - _profileAsk\.at < CARD_WAIT_MS\) return;/);
  assert.match(inspect, /state: 'silent'/);
  const onCard = w.slice(w.indexOf('online.onCard = (id, d, sub = null) => {'), w.indexOf('online.onAct = '));   // DUEL1: the answerer's account stamp rides in
  assert.match(onCard, /if \(!cardAnswers\.pass\(id, performance\.now\(\)\)\) return;\s*\n\s*const card = composeCard\(playerEntity\);\s*\n\s*if \(card\) online\.sendCard\(\{ to: id, card \}\);/);
  assert.match(onCard, /if \(!d\?\.card \|\| _profileAsk\?\.peerId !== id\) return;/);
  assert.match(onCard, /profileWin\?\.update\(id, withDuel\(id, profileView\(\{ name: peerName\(id\), peer: p, look: p\?\.look \?\? null, card: d\.card, state: 'answered' \}\)\)\);/);   // DUEL1: with the duel's word on it (the Challenge button, their record)
  assert.match(w, /if \(profileWin\?\.isOpen\(\)\) \{ profileWin\.hide\(\); return true; \}/, 'F again closes the profile');
  // JOURNAL1: and each yields it to a page read from the F-menu too (the page window stands where the profile does)
  assert.match(w, /above: \(\) => !!\(socialPanel\?\.isOpen\?\.\(\) \|\| socialMenu\?\.isOpen\?\.\(\) \|\| profileWin\?\.isOpen\?\.\(\) \|\| pageWin\?\.isOpen\?\.\(\)\),/, 'the chat yields its Escape');
  assert.match(w, /above: \(\) => !!\(socialMenu\?\.isOpen\?\.\(\) \|\| profileWin\?\.isOpen\?\.\(\) \|\| pageWin\?\.isOpen\?\.\(\)\),/, 'the friends panel yields its Escape');
  assert.match(w, /onOpen: \(\) => surfaceOpen\('profile'\),\s*\n\s*onClose: \(\) => \{ surfaceClose\('profile'\); _profileAsk = null; _profileSub = null; _profileView = null; \},/, 'a pointer surface, and a card closed is no longer waited on (DUEL1: nor its stamp and its view kept)');
  assert.match(w, /profileWin\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);/, 'drawn under the F-menu\'s own covering word');
  assert.match(w, /tradeFrame\(\);[^\n]*\n(?:\s*duelFrame\(\);[^\n]*\n)?\s*profileFrame\(\);/, 'its ask retried and its wait timed in the online frame, beside the trade\'s own (DUEL1: and the duel\'s) - before the dead return');
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(m\.t === 'card'\) \{[\s\S]{0,1200}?a = this\._meterCard\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(isChatRoom\(a\.key\) \|\| isSocialRoom\(a\.key\)\) return;/);
  assert.match(relay, /if \(!this\._senderFunnel\(tws, a\.id, now\)\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*this\._send\(tws, JSON\.stringify\(\{ t: 'card', id: a\.id, \.\.\.\(typeof a\.sub === 'string' && a\.sub \? \{ sub: a\.sub \} : \{\}\), data: m\.data \}\)\);/, 'the cast arm\'s funnel, shared (DUEL1: and the answerer\'s verified account beside its id)');
});
