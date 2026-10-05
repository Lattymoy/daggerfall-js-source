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
  assert.equal(RELAY_VERSION, 'world170');   // FEUD moved it on last (world170: the foe record's wind-ups, staggers and blow classes and a revenant's adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main's world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party's Overworld walk - world123 on its branch, renumbered past THE MERGE's); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main's TV3); before it TV3 (world122: a region's traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main's AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello's claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main's SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main's world114-117: the own lane and the pose's concealment bits); SHADOW-FANG's badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main's Oblivion Gate WBX took world116 first); the Oblivion Gate's WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main's Enhanced Plus patch (world114) and GUILD1c (world115)); GUILD1c's guild frames and guild line moved it on (world115 - world113 on its branch; main's AUDIT WB and the Enhanced Plus patch took world113 and world114 first); the Enhanced Plus patch's PEERLIGHT1/2 and PEERFX1 pose fields moved it on (world114); AUDIT WB's relay half and WB3's gate frame and boss room moved it on (world113 - world111 and world110 on their branch); PARTY-TRAVEL's party pose fields moved it on (world112 - world110 on its branch); RENOWN1's level and renown frame moved it on (world111 - world108 on its branch; main's HT-WAIST-NET, PROFILE2 and SKIN2, and EVENT1 took world108 to world110 first); HT-WAIST-NET's hl moved it on (world108); DUEL1 was world105 on its branch; main's world105 (AUDIT 68) and world106 (DISC23-B) landed first
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
