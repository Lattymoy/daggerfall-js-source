// PVP-GUARDS (bible/11-Multiplayer/PvP-Rework.md): the watch hunts a red villain in a settlement's streets of the open
// zone - two guards at first, one more each 30 s, six at most - each the villain's mirror at its level, and each takes 5%
// of every hit. A villain has no peace in the streets: my word on the zone stays 1 there, and a red body there is fair.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VILLAIN_HUNT, HUNT_ATTACK_SKILLS, HUNT_WEAPON_SKILLS, HUNT_DEFENCE_SKILLS, HUNT_BLOCK_STATS, huntDue, villainMirror, mirrorOnto,
  hunterTaken, villainHunted, peaceFor } from '../../../src/systems/wild/villainHunt.js';
import { createPvpGuardsHost, PVP_GUARDS_TEXT, PVP_GUARDS_POLL_MS } from '../../../src/scenes/pvpGuardsHost.js';
import { createCityGuards } from '../../../src/scenes/cityGuards.js';
import { SKILLS, skillValue } from '../../../src/systems/skills.js';
import { isVillain, VILLAIN } from '../../../src/systems/wild/villainLaw.js';
import { settledAt } from '../../../src/systems/wild/zoneSafe.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const lineOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n', i) + 1); };
const blockOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n  };\n', i) + 5); };

/** A villain as the producer mints a player: the 35 skills, the eight attributes. */
const villain = (over = {}) => {
  const skills = new Array(35).fill(20);
  Object.assign(skills, { [SKILLS.LongBlade]: 60, [SKILLS.Destruction]: 85, [SKILLS.CriticalStrike]: 44, [SKILLS.Dodging]: 30, [SKILLS.Restoration]: 70, [SKILLS.Alteration]: 50 });
  return { level: 37, skills, skillUses: new Array(35).fill(0), items: [], activeEffects: [], health: 100, maxHealth: 100, crimeCommitted: 0, reflexes: 2,
    stats: { strength: 80, intelligence: 60, willpower: 40, agility: 90, endurance: 70, personality: 50, speed: 85, luck: 30 }, ...over };
};

test('PVP-GUARDS THE NUMBERS: two at first, one more each 30 s, six at most, 5% of a hit kept (mutants: each number moved)', () => {
  assert.deepEqual({ ...VILLAIN_HUNT }, { first: 2, stepMs: 30_000, max: 6, taken: 0.05 });
  assert.deepEqual([...HUNT_ATTACK_SKILLS].sort((a, b) => a - b), [22, 28, 29, 30, 31, 32, 33]);
  assert.deepEqual([...HUNT_WEAPON_SKILLS].sort((a, b) => a - b), [28, 29, 30, 31, 32, 33]);
  assert.deepEqual([...HUNT_DEFENCE_SKILLS], [SKILLS.Dodging, SKILLS.Restoration, SKILLS.Alteration]);
  assert.deepEqual([...HUNT_BLOCK_STATS], ['agility', 'speed', 'strength', 'endurance', 'willpower', 'luck']);
});

test('PVP-GUARDS THE ARRIVALS (villainHunt.js huntDue): two at the start, none before 30 s, one at each step, six standing at most, and an arrival the cap refuses is spent (mutants: the first two one; the step a minute; the cap seven; a refused arrival owed)', () => {
  assert.deepEqual(huntDue(0, 0, 0, 0), { send: 2, sent: 2 });
  assert.deepEqual(huntDue(0, 29_999, 2, 2), { send: 0, sent: 2 });
  assert.deepEqual(huntDue(0, 30_000, 2, 2), { send: 1, sent: 3 });
  assert.deepEqual(huntDue(0, 120_000, 3, 3), { send: 3, sent: 6 }, 'a poll late by three steps sends the three');
  assert.deepEqual(huntDue(0, 150_000, 6, 6), { send: 0, sent: 7 }, 'six stand: the seventh is spent');
  assert.deepEqual(huntDue(0, 150_500, 7, 5), { send: 0, sent: 7 }, 'one slain: none till the next step');
  assert.deepEqual(huntDue(0, 180_000, 7, 5), { send: 1, sent: 8 });
  assert.deepEqual(huntDue(0, 10 * 60_000, 8, 0), { send: 6, sent: 22 }, 'never more than six at once');
});

test('PVP-GUARDS THE MIRROR (villainHunt.js villainMirror): its level; every weapon skill the villain\'s best attack skill (Destruction counts); its Critical Strike; Dodging the best of its defences; the block\'s six attributes; what its formulas read (mutants: Destruction left out; Dodging the villain\'s alone; the level the guard\'s; a raw skill for the formula\'s)', () => {
  const v = villain();
  const m = villainMirror(v);
  assert.equal(m.level, 37);
  for (const id of HUNT_WEAPON_SKILLS) assert.equal(m.skillOverrides[id], 85, `skill ${id}: the best attack skill, Destruction's 85`);
  assert.equal(m.skillOverrides[SKILLS.CriticalStrike], 44);
  assert.equal(m.skillOverrides[SKILLS.Dodging], 70, 'Restoration 70 beats Dodging 30: a guard casts nothing, so its defence is its dodge');
  assert.equal(m.skillOverrides[SKILLS.Destruction], undefined, 'a guard casts no spell');
  assert.deepEqual(m.stats, { agility: 90, speed: 85, strength: 80, endurance: 70, willpower: 40, luck: 30 });
  const fortified = villain({ _mods: { skills: { [SKILLS.Axe]: 80 } } });
  assert.equal(villainMirror(fortified).skillOverrides[SKILLS.LongBlade], skillValue(fortified, SKILLS.Axe), 'the live value, a Fortify in it');
  const blade = villain();
  blade.skills[SKILLS.Destruction] = 10; blade.skills[SKILLS.HandToHand] = 95;
  assert.equal(villainMirror(blade).skillOverrides[SKILLS.ShortBlade], 95, 'Hand-to-Hand counts too');
});

test('PVP-GUARDS ON THE GUARD (villainHunt.js mirrorOnto, hunterTaken): the skills put on, each attribute only where it beats the guard\'s own; the hunter keeps 5% of a hit and at least 1; anyone else the whole (mutants: an attribute lowered; the share 50%; no floor; every foe resisting)', () => {
  const e = mirrorOnto({ stats: { agility: 95, speed: 40, strength: 50, endurance: 50, willpower: 50, luck: 50, personality: 50 }, skillOverrides: { [SKILLS.Mysticism]: 80 } }, villainMirror(villain()));
  assert.equal(e.stats.agility, 95, 'the guard\'s own 95 kept');
  assert.equal(e.stats.speed, 85);
  assert.equal(e.stats.willpower, 50, 'the villain\'s 40 is no help');
  assert.equal(e.stats.personality, 50);
  assert.equal(e.skillOverrides[SKILLS.Mysticism], 80, 'an override it had stays');
  assert.equal(e.skillOverrides[SKILLS.Axe], 85);
  assert.equal(e.villainHunter, true);
  assert.equal(hunterTaken(e, 100), 5);
  assert.equal(hunterTaken(e, 250), 13);
  assert.equal(hunterTaken(e, 9), 1, 'a blow that lands takes at least 1');
  assert.equal(hunterTaken(e, 0), 0);
  assert.equal(hunterTaken({ stats: {} }, 100), 100, 'the town\'s own watch takes the whole');
});

test('PVP-GUARDS WHO IS HUNTED (villainHunt.js villainHunted, peaceFor): red, in the zone, outdoors, in the streets and alive - all five; the streets are peace for anyone but a villain (mutants: a term dropped; the peace kept for a villain)', () => {
  const all = { meterRed: true, zone: true, outdoors: true, settled: true, alive: true };
  assert.equal(villainHunted(all), true);
  for (const k of Object.keys(all)) assert.equal(villainHunted({ ...all, [k]: false }), false, k);
  assert.equal(peaceFor(true, false), true);
  assert.equal(peaceFor(true, true), false);
  assert.equal(peaceFor(false, false), false);
  assert.ok(isVillain(VILLAIN.red) && !isVillain(VILLAIN.red - 1));
});

/** A watch of the host's shape: huntGuard mints a record into `guards`; removeGuard walks one away. */
const fakeWatch = () => {
  const w = { guards: [], minted: [], removed: [], mirrors: [] };
  w.huntGuard = async (feet, fwd, mirror) => { const g = { dead: false, ai: { detected: true, makeHostileToPlayer: () => {} } }; w.guards.push(g); w.minted.push({ feet, fwd }); w.mirrors.push(mirror); return g; };
  w.removeGuard = (g) => { g.dead = true; w.removed.push(g); };
  return w;
};
const settle = () => new Promise((r) => setImmediate(r));

test('PVP-GUARDS THE HOST (scenes/pvpGuardsHost.js): a villain in the streets is hunted - the line said, two sent at once on the watch\'s ring with its mirror, one more at 30 s, six at most; out of the streets they walk away and the hunt ends; no villain, the zone left, a building or a fall send none (mutants: the meter unread; the zone unread; the settled word unread; the stand-down skipped; the poll never set)', async () => {
  const lines = [], watch = fakeWatch(), me = villain();
  const s = { meter: 6000, zone: true, mode: 'exterior', settled: true, t: 1_000 };
  let polled = 0;
  const rules = { flag: { villainy: () => s.meter }, tick: () => {}, limited: () => false };
  const host = createPvpGuardsHost(rules, () => [watch, [1, 2, 3], 0, s.mode, s.settled], me, (l) => lines.push(l),
    { zone: () => s.zone, now: () => s.t, every: (fn, ms) => { polled = ms; } });
  assert.equal(polled, PVP_GUARDS_POLL_MS);
  assert.equal(host.flag, rules.flag, 'the rules host handed on whole');
  host.tick(); await settle();
  assert.deepEqual(lines, [PVP_GUARDS_TEXT.come]);
  assert.equal(host.hunters().length, 2);
  assert.deepEqual(watch.minted[0], { feet: [1, 2, 3], fwd: [0, 0, 1] });
  assert.equal(watch.mirrors[0].level, 37, 'each the villain\'s mirror');
  s.t += 29_000; host.tick(); await settle();
  assert.equal(host.hunters().length, 2);
  s.t += 1_000; host.tick(); await settle();
  assert.equal(host.hunters().length, 3);
  s.t += 10 * 60_000; host.tick(); await settle();
  assert.equal(host.hunters().length, 6, 'six at most');
  s.settled = false; host.tick(); await settle();
  assert.equal(host.hunting(), false);
  assert.equal(watch.removed.length, 6, 'they walk away at the streets\' edge');
  assert.deepEqual(lines.slice(1), [PVP_GUARDS_TEXT.gone]);
  for (const [k, v] of [['meter', 4999], ['zone', false], ['mode', 'interior']]) {
    const was = s[k]; s.settled = true; s[k] = v;
    host.tick(); await settle();
    assert.equal(host.hunting(), false, `${k} ${v}: no hunt`);
    s[k] = was;
  }
  me.health = 0; host.tick(); await settle();
  assert.equal(host.hunting(), false, 'a fallen villain is hunted no more');
  assert.equal(watch.minted.length, 6);
});

// the watch1 rig (fb0929_raidguards.test.js's): a synthetic CLASS18.CFG, a flat open world
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const rig = (playerEntity, over = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rand: () => 0.5, say: () => {}, ...over,
});

test('PVP-GUARDS THE WATCH\'S HUNTER (scenes/cityGuards.js huntGuard): on the ring at the villain\'s own level, its mirror on, never the zone\'s tenfold; it takes 5% of every hit at the one damage door; it stands through the crime\'s despawn, and walks away when removed (mutants: the level rolled +3..6; the tenfold kept; the share unread at the door; the despawn takes it)', async () => {
  const me = villain();
  const watch = createCityGuards(rig(me, { guardScale: () => 10 }));
  const g = await watch.huntGuard([0, 0, 0], [0, 0, 1], villainMirror(me));
  assert.ok(g, 'a hunter on the ring');
  assert.equal(g.hunter, true);
  assert.equal(g.entity.level, 37, 'the villain\'s own level, no Range(3, 7)');
  assert.ok(!g.entity.zoneWatch && !(g.entity.damageScale > 1), 'the mirror, not the zone\'s tenfold');
  assert.equal(skillValue(g.entity, SKILLS.LongBlade), 85);
  assert.equal(skillValue(g.entity, SKILLS.Dodging), 70);
  assert.ok(Math.hypot(g.ai.feet[0], g.ai.feet[2]) >= 12.8 - 1e-6, 'on the watch\'s ring');
  const plain = await watch.spawnCityGuard([5, 0, 5], 0);
  assert.equal(plain.hunter, false);
  const hp = g.entity.health, hp2 = plain.entity.health;
  watch.hurtGuard(g, 100, [0, 0, 0], null, { fromPlayer: false });
  watch.hurtGuard(plain, 10, [0, 0, 0], null, { fromPlayer: false });
  assert.equal(hp - g.entity.health, 5, 'a hunter keeps 5 of 100');
  assert.equal(hp2 - plain.entity.health, 10, 'the town\'s own watch takes the whole');
  watch.update(0.016, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(plain.dead, true, 'no crime: the crime\'s watch walks away (EnemyEntity.cs:184-191)');
  assert.equal(g.dead, false, 'the hunter stands - its host stands it down');
  watch.removeGuard(g);
  assert.ok(g.dead && !g.corpse, 'removed: walked away, no body');
});

test('PVP-GUARDS NO PEACE FOR A VILLAIN (scenes/world.js wildCan, wildFair, the zone\'s frame, run as they stand): red in the streets, my word on the zone stays 1 and no safe word is said; a red body in the streets is fair; anyone else keeps the streets\' peace (mutants: wildCan\'s exception unread; wildFair\'s red unread; the frame\'s exception unread)', () => {
  const index = new Map([['207,213', {}]]);
  const streets = [10, 0, 10], open = [9999, 0, 9999];
  const inTown = (p) => p === streets;
  const scope = {
    online: { wildOk: true, status: 'open', guildTagOf: () => null }, wildHere: () => true, wildOutdoors: () => scope.modes.mode === 'exterior',
    settledAt: (p) => inTown(p), campToWire: (p) => p, player: { feetAt: () => scope.me }, locationIndex: index, modes: { mode: 'exterior', deathUp: () => false },
    playerEntity: { health: 50 }, me: streets, peers: new Map([['red', streets], ['plain', streets], ['out', open]]), red: false,
    wildKin: () => false, social: { isPartyPeer: () => false }, _wildTruce: { holds: () => false }, duelMgr: { live: false }, myGuildTag: () => null,
    wildAtWire: (p) => !!p, duelWorldOf: (id) => scope.peers.get(id) ?? null, peaceFor, isVillain,
    pvpFlag: { fair: () => true, villainy: () => (scope.red ? VILLAIN.red : 100), skullOf: (id) => (id === 'red' ? 'red' : 'white') },
  };
  const body = `${lineOf('  const wildCan = () =>')}${blockOf('  const wildFair = (peerId) => {')}`;
  const { wildCan, wildFair } = new Function('S', `with (S) { ${body}\n return { wildCan, wildFair }; }`)(scope);
  assert.equal(wildCan(), false, 'in the streets, no villain: my word is 0');
  scope.red = true;
  assert.equal(wildCan(), true, 'a villain in the streets: my word stays 1');
  scope.red = false; scope.me = open;
  assert.equal(wildFair('red'), true, 'a red body in the streets is fair');
  assert.equal(wildFair('plain'), false, 'anyone else keeps the peace');
  assert.equal(wildFair('out'), true);
  const said = [];
  const fr = { ...scope, here: true, wildSay: (l) => said.push(l), zoneSafeFrame: (here, settled) => said.push(settled) };
  const runFrame = () => new Function('S', `with (S) { ${lineOf('      zoneSafeFrame(here, ')} }`)(fr);
  scope.me = streets;
  runFrame(); scope.red = true; runFrame();
  assert.deepEqual(said, [true, false], 'the streets are a safe zone, but not for a villain');
  assert.equal(typeof settledAt, 'function');
});

test('PVP-GUARDS THE WIRING (scenes/world.js): the hunt is the flag\'s own line - the rules host handed in, the street\'s watch, my feet, the view, the mode and the streets\' word read at each poll (mutants: the host unwired; the watch another pool)', () => {
  assert.match(W, /const pvpFlag = createPvpGuardsHost\(createPvpRulesHost\(createPvpFlagHost\(/);
  assert.match(lineOf('  const pvpFlag = createPvpGuardsHost('), /\(\) => \[cityGuards, walkMode && playerSpawned \? player\.pos : cam\.pos, cam\.yaw, modes\?\.mode \?\? 'exterior', settledAt\(campToWire\(player\.feetAt\(\)\), locationIndex\)\], playerEntity, setMidScreenText\)\.flag;/);
});
