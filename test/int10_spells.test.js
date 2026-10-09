// INT10 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): SPELLS BETWEEN PLAYERS CAPPED BY THE REFEREE, AS THE ARENA'S ARE. DUEL1 and WILD1 handed a player's
// spell to its target's own machine (the whole spell, at the caster's claimed level) - a crafted client's Damage Health
// was whatever it said, and a target that never applied one never took it. Since INT8 and INT9 every place one player's
// spell meets another's is a referee's: the caster's own machine counts the harm on a stand-in of its own sheet
// (combat/siegeCombat.js siegeSpellNumbers) and sends a number, and the relay clips it to one cast's most and bounds the
// rate - the duel's, the open zone's, a siege's and the arena's alike - and no target's machine applies a peer's harm at
// all. And a Royal Tourney's bout, blows alone, takes no cast (the relay refereed a crafted client's as a siege's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SIEGE_CASTS, SIEGE_HIT, SIEGE_UNITS_PER_M, ROYAL_RING, royalRoomKey, newFighter, refereeCast } from '../src/net/siegeRef.js';
import { newDuelRef, duelNote, duelOpen, duelBlow } from '../src/net/duelRef.js';
import { newWildRef, wildZone, wildBlow, WILD_REF } from '../src/net/wildRef.js';
import { ARENA_SPELLS_IN, ARENA_SPELL_WINDOW_MS, ARENA_SPELL_MAX } from '../src/net/arenaLaw.js';
import { mintSiegeOrder } from '../src/net/identityToken.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;

test('INT10 ONE CAP: a cast between players is clipped to one cast\'s most and bounded to so many a window - the siege\'s referee, the duel\'s and the open zone\'s on its one law, the arena\'s pinned equal (mutants: the clip unread; the rate unread; a heal let into a duel or the zone)', () => {
  assert.deepEqual([ARENA_SPELLS_IN, ARENA_SPELL_WINDOW_MS, ARENA_SPELL_MAX], [SIEGE_CASTS.max, SIEGE_CASTS.windowMs, SIEGE_CASTS.damageMax], 'the arena\'s cap, the referee\'s');
  const near = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
  // the siege's referee
  const a = newFighter(10, 0), b = newFighter(10, 0);
  const casts = [1, 2, 3, 4].map((k) => refereeCast(a, b, { from: near(-1), at: near(1), d: 9999 }, k * 100));
  assert.deepEqual(casts.map((c) => [c.ok, c.dealt]), [[true, SIEGE_CASTS.damageMax], [true, SIEGE_CASTS.damageMax], [true, SIEGE_CASTS.damageMax], [false, 0]], 'a crafted 9999 is one cast\'s most, and the fourth in the window is nothing');
  // the duel's
  const st = newDuelRef();
  duelNote(st, 'ask', 'acct-a', 'acct-b', 'duel123456', 10_000);
  duelNote(st, 'yes', 'acct-b', 'acct-a', 'duel123456', 10_100);
  const { bout } = duelOpen(st, { s: 'duel123456', a: { sub: 'acct-a', id: 'peer-a', lv: 10, pose: near(-1) }, b: { sub: 'acct-b', id: 'peer-b', lv: 10, pose: near(1) }, c: [1000 * M, 0, 1000 * M] }, 10_200);
  assert.ok(bout, 'a bout');
  const t = bout.startMs + 10;
  const d = [0, 1, 2, 3].map((k) => duelBlow(st, 'acct-a', 'peer-b', { d: 9999, r: SIEGE_HIT.Spell }, t + k * 100));
  assert.deepEqual(d.map((x) => x.dealt), [SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, 0]);
  // the open zone's
  const z = newWildRef();
  wildZone(z, 'acct-a', { id: 'peer-a', lv: 10 }, true, near(-1), 0);
  wildZone(z, 'acct-b', { id: 'peer-b', lv: 10 }, true, near(1), 0);
  // both in the zone a mend's length first (AUDIT INT9: a fighter mends only once it has stood there as long), so every
  // blow below is a mend's moment - the striker unstruck, and its own casts' window never cleared by it
  const t0 = WILD_REF.mendMs + 1000;
  const w = [0, 1, 2, 3].map((k) => wildBlow(z, 'acct-a', 'acct-b', { d: 9999, r: SIEGE_HIT.Spell, rid: `00000000000${k}` }, t0 + k * 100));
  assert.deepEqual(w.map((x) => x.dealt), [SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, SIEGE_CASTS.damageMax, 0]);
  // a heal is no blow between two who fight: the duel's and the zone's referees take none
  assert.match(rd('src/net/duelRef.js'), /\? refereeCast\(me\.f, them\.f, \{ from: me\.pose, at: them\.pose, d \}, now\)/);
  assert.match(rd('src/net/wildRef.js'), /\? refereeCast\(a\.f, t\.f, \{ from: a\.pose, at: t\.pose, d \}, now\)/);
});

test('INT10 EVERY PATH A REFEREE\'S: the caster sends a number counted on its own sheet - a duel\'s, the open zone\'s (a dungeon of it too), a siege\'s - and no target\'s machine applies a peer\'s harm: a peer\'s cast at me is a gift\'s families alone (mutants: a spell sent whole for its target to apply; the receiver\'s gift filter gone)', () => {
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes("const n = duelMgr.blow('spell', { p: campToWire(player.feetAt()), d: siegeCastClamp(harm, false) });"), 'the duel\'s');
  assert.ok(w.includes("const n = wildFight.blow(peerId, 'spell', { p: campToWire(player.feetAt()), d: siegeCastClamp(harm, false) });"), 'the zone\'s');
  assert.ok(w.includes('return harm > 0 && siegeSession.cast(peerId, siegeCastClamp(harm, false));'), 'a siege\'s');
  assert.ok(rd('src/scenes/dungeonContext.js').includes("castAtDuel: opts.arenaRival ? (_id, sp) => spellOnRival(sp) : (opts.wildSpellOut ? (id, sp) => opts.wildSpellOut(id, sp) : null),"), 'the zone\'s dungeons, the zone\'s own send');
  assert.equal(/duelSpellFromWire|spell: duelSpellOf|level: Math\.max\(1, Math\.min\(30/.test(w), false, 'no spell goes out whole for a target to apply');
  assert.ok(w.includes('const spell = allyCastSpell(d?.spell, { stranger: !mate });'), 'a peer\'s cast at me: its beneficial families alone');
});

test('INT10 THE ROYAL TOURNEY\'S BOUT IS BLOWS ALONE: no cast between its two lands - a crafted client\'s damaging spell as its heal - while a blow is judged as ever (mutants: the damaging cast refereed)', async () => {
  const SB = 1_800_000_000, SE = SB + 7 * 86400, SK = 5023, SW = 20;
  const at = (x, z = 0) => ({ x: x * M, y: 0, z: z * M, yaw: 0, pitch: 0 });
  const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };
  const realNow = Date.now; let clock = SB * 1000 + 3600_000; Date.now = () => clock;
  try {
    const r = fakeRoom(royalRoomKey(SK, SW), { now: () => clock });
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
    const enter = async (id) => {
      clock += 100;
      const sp = await mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd: 'duel', st: 'crown', sn: 'royal', sb: SB, se: SE, sf: [[100 * M, 50 * M]] }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
      const ws = r.connect(); await r.hello(ws, id, at(100, 50), { lv: 10, look: LOOK, sp }); return ws;
    };
    const until = async (ms) => { while (r.alarm.at != null && r.alarm.at <= ms) { clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire(); } clock = Math.max(clock, ms); };
    const wa = await enter('peer-0001'), wb = await enter('peer-0002');
    for (const ws of [wa, wb]) await say(ws, { k: 'in' });
    await say(wa, { k: 'ask', to: wb.att.id });
    await say(wb, { k: 'yes', to: wa.att.id });
    await until(clock + ROYAL_RING.countdownMs + 1000);
    const pb = r.room._siege.fighters[wb.att.sub].pose;
    await r.pose(wa, { ...pb, x: pb.x - 1.5 * M });
    await until(clock + 1000);
    const hp = () => wb.sent.filter((m) => m.t === 'siege' && m.k === 'hp' && m.id === wb.att.id && m.h < m.m).length;   // a blow that landed (the bout's start says both whole)
    await say(wa, { k: 'cast', to: wb.att.id, d: 60 });
    assert.equal(hp(), 0, 'a damaging cast lands nothing');
    await say(wa, { k: 'cast', to: wb.att.id, d: 20, h: 1 });
    assert.equal(hp(), 0, 'nor a heal');
    await until(clock + 1000);
    await say(wa, { k: 'blow', to: wb.att.id, w: 123, m: 9, d: 50, r: 0 });
    assert.equal(hp(), 1, 'a blow is judged as ever');
  } finally { Date.now = realNow; }
});
