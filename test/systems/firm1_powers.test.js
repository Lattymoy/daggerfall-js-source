// FIRM1 (2026-10-13) - WHAT THE FIRMAMENT DOES (src/systems/firmamentPowers.js over src/systems/firmamentLive.js): the
// tree in force online alone; its attributes and skills folded where DFU's formulas read a ring's; a blow's, a spell's,
// a price's and a pace's percent; what lands on me; the health and magicka on Renown's layer - and the combat channels
// asleep in a refereed fight and while mentoring, the life channels read wherever the tree is in force; the gathering
// acts' windows widened. Pinned through the real producers. bible/06-Systems/Firmament.md.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { setFirmamentTree, setFirmamentOnline, firmamentInForce, firmActMult, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { firmamentAwake, firmamentDamage, firmamentLayer, firmamentCastCost, firmamentFold, withoutFirmament, _resetFirmamentPowersForTests } from '../../src/systems/firmamentPowers.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { pathTo, treeStats, blowPct, pctOf } from '../../src/net/firmament/firmamentLaw.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { SKILLS, skillValue, permanentSkillValue } from '../../src/systems/skills.js';
import { liveStat } from '../../src/systems/statMods.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { computeEntityMods, weaponBlowMods, entityWeightMult, EMPTY_MODS } from '../../src/systems/entityMods.js';
import { spellPowerMult } from '../../src/systems/spell/spellPower.js';
import { castRate } from '../../src/systems/castSpeed.js';
import { setSigilDueling, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { setRenownLayer, renownHpOf } from '../../src/systems/renownLayer.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { HERB_ACT, tugWindow } from '../../src/net/professionLaw.js';

const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({ name: 'Wanderer', hp: 8, stats: STATS,
  skills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.HandToHand, SKILLS.Destruction, SKILLS.Mercantile, SKILLS.Swimming, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Climbing] });
function hero() {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.level = 10; p.activeEffects = []; p.health = p.maxHealth = 120;
  return p;
}
/** A tree walked from `start` to each of `targets` in turn, by the law's own shortest path. */
function walk(start, ...targets) {
  const tree = { start, keys: [] };
  for (const t of targets) tree.keys.push(...pathTo(tree, t));
  return tree;
}
/** A notable's key, by its name. */
const named = (name) => [...FIRM_NODES.values()].find((n) => n.name === name)?.key ?? assert.fail(`no star ${name}`);
const FOE = Object.freeze({ isPlayer: false, affinity: 'Human', health: 100, maxHealth: 100 });

beforeEach(() => { _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetSigilForTests(); });

test('FIRM1 powers: OFFLINE THERE IS NO SKY - a tree handed in folds nothing until the page plays online; with no sign, nothing at all', () => {
  const p = hero();
  const base = liveStat(p, 'strength');
  setFirmamentTree(walk('wr.start', 'wr.s1'));   // +1 Strength (the sign), +3% of the hero's own (the spoke; FIRM2: one for one)
  computeEntityMods(p);
  assert.equal(firmamentInForce(), false);
  assert.equal(liveStat(p, 'strength'), base);
  setFirmamentOnline(true);
  computeEntityMods(p);
  assert.equal(liveStat(p, 'strength'), base + 1 + pctOf(base, 3));
  setFirmamentTree(null);
  computeEntityMods(p);
  assert.equal(liveStat(p, 'strength'), base);
});

test('FIRM1 powers: the fold - attributes and skills where DFU\'s formulas read a ring\'s (a combat skill and a life skill), the carry', () => {
  const p = hero();
  const sb = skillValue(p, SKILLS.LongBlade), sm = skillValue(p, SKILLS.Mercantile), w = entityWeightMult(p);
  setFirmamentOnline(true);
  const t = walk('st.start', 'st.r2', named('Silver Tongue'));   // the Steed's Long Blade road, and the Shadow's counter
  setFirmamentTree(t);
  computeEntityMods(p);
  const c = treeStats(t);
  // the road's Long Blade is a share of the character's own (a small star's percent); the notable's Mercantile raw, and the
  // small stars' Mercantile share on top
  assert.ok(c['skillPct.LongBlade'] > 0 && !c['skill.LongBlade'] && c['skill.Mercantile'] > 0 && c.carry > 0, JSON.stringify(c));
  assert.equal(skillValue(p, SKILLS.LongBlade), sb + Math.floor((permanentSkillValue(p, SKILLS.LongBlade) * c['skillPct.LongBlade']) / 100));
  assert.equal(skillValue(p, SKILLS.Mercantile), sm + c['skill.Mercantile'] + Math.floor((permanentSkillValue(p, SKILLS.Mercantile) * c['skillPct.Mercantile']) / 100));
  assert.ok(Math.abs(entityWeightMult(p) - (w + c.carry / 100)) < 1e-9);
});

test('FIRM1 powers: RAW ON THE KEY STARS, PERCENT ON THE SMALL - a small star\'s attribute is a share of the character\'s own, so Ascend\'s points are never matched point for point', () => {
  for (const n of FIRM_NODES.values()) {
    if (n.kind !== 'small' && n.kind !== 'road') continue;
    for (const k of Object.keys(n.stats)) assert.ok(!/^(strength|intelligence|willpower|agility|endurance|personality|speed|luck|hp|mp|armor|skill\..*)$/.test(k), `${n.key} ${k}`);
  }
  const p = hero();
  setFirmamentOnline(true);
  const base = liveStat(p, 'strength');
  setFirmamentTree(walk('wr.start', 'wr.s1'));   // the sign's raw +1, the spoke's share
  computeEntityMods(p);
  const c = treeStats(walk('wr.start', 'wr.s1'));
  assert.ok(c['pct.strength'] > 0);
  assert.equal(liveStat(p, 'strength'), base + (c.strength ?? 0) + Math.floor((p.stats.strength * c['pct.strength']) / 100));
  p.stats.strength += 40;   // Ascend's points: the share grows by a share of them, never by them
  const before = liveStat(p, 'strength');
  computeEntityMods(p);
  assert.ok(liveStat(p, 'strength') - before < 40 * c['pct.strength'] / 100 + 1);
});

test('FIRM-MAX: A STAR LANDS ON A MAXED STAT - its gain lifts the attribute\'s live ceiling by itself, so +2% Speed on a 100 reads past 100; a Fortify still stops at the lifted ceiling, and with the sky off the ceiling is DFU\'s again (mutants: the fold writes no statMax; liveStat leaves it out of the ceiling)', () => {
  const p = hero();
  p.stats.speed = 100;
  setFirmamentOnline(true);
  const t = walk('st.start', 'st.s1');   // The Steed's +2 Speed, the Path of the Sign's +2% (FIRM2: one for one)
  const c = treeStats(t);
  assert.deepEqual([c.speed, c['pct.speed']], [2, 2]);
  setFirmamentTree(t);
  computeEntityMods(p);
  assert.equal(liveStat(p, 'speed'), 104, '100 + 2 + 2% of 100');
  p.activeEffects.push({ kind: 'fortifyAttribute', stat: 'speed', magnitude: 20, roundsRemaining: 5 });
  assert.equal(liveStat(p, 'speed'), 104, 'a Fortify fills the lift, never past it');
  p.stats.speed = 95;
  computeEntityMods(p);
  assert.equal(liveStat(p, 'speed'), 103, 'the ceiling is 100 + the gain, whatever the stat under it (95 x 2% floors to 1: 100 + 2 + 1)');
  p.activeEffects.length = 0;
  p.stats.speed = 100;
  setFirmamentOnline(false);
  computeEntityMods(p);
  p.activeEffects.push({ kind: 'fortifyAttribute', stat: 'speed', magnitude: 20, roundsRemaining: 5 });
  assert.equal(liveStat(p, 'speed'), 100, 'offline: no sky, DFU\'s MaxStatValue');
});

test('FIRM1 powers: A REFEREED FIGHT AND A MENTOR - the combat channels sleep, the life channels stay', () => {
  const p = hero();
  setFirmamentOnline(true);
  setFirmamentTree(walk('st.start', 'st.r2', named('Silver Tongue')));
  computeEntityMods(p);
  const blade = skillValue(p, SKILLS.LongBlade), trade = skillValue(p, SKILLS.Mercantile);
  setSigilDueling(true);
  computeEntityMods(p);
  assert.equal(firmamentAwake(p), false);
  assert.ok(skillValue(p, SKILLS.LongBlade) < blade, 'no Long Blade in a duel');
  assert.equal(skillValue(p, SKILLS.Mercantile), trade, 'the counter is no fight');
  setSigilDueling(false);
  p._mentor = { level: 5 };
  assert.equal(firmamentAwake(p), false);
  assert.deepEqual(firmamentFold(p), EMPTY_MODS, 'a mentor carries no sky at all');
  delete p._mentor;
  computeEntityMods(p);
  assert.equal(skillValue(p, SKILLS.LongBlade), blade);
});

test('FIRM1 powers: THE WROTHGARIAN ZONE - the sky fights its beasts; a strike at a player is rolled with the sky off, and put back after', () => {
  const p = hero();
  const base = liveStat(p, 'strength');
  setFirmamentOnline(true);
  setFirmamentTree(walk('wr.start', 'wr.s1'));   // +1 and 3% of the hero's Strength
  computeEntityMods(p);
  assert.equal(firmamentAwake(p), true, 'no refereed fight: the zone\'s beasts meet the sky');
  assert.equal(liveStat(p, 'strength'), base + 1 + pctOf(base, 3));
  const kept = p._mods;
  assert.equal(withoutFirmament(p, () => liveStat(p, 'strength')), base, 'the sheet a player is struck from');
  assert.equal(p._mods, kept, 'put back as it was');
  assert.equal(liveStat(p, 'strength'), base + 1 + pctOf(base, 3));
  assert.throws(() => withoutFirmament(p, () => { throw new Error('x'); }));
  assert.equal(liveStat(p, 'strength'), base + 1 + pctOf(base, 3), 'put back whatever the roll did');
});

test('FIRM1 powers: A BLOW - my fists at a foe the law\'s percent more (the fraction carried); never at a player, never asleep', () => {
  const p = hero();
  setFirmamentOnline(true);
  const t = walk('st.start', named('Pankration'), named('Iron Knuckles'));   // the Steed's Hand-to-Hand wheel
  setFirmamentTree(t);
  const pct = blowPct(treeStats(t), { skill: 'HandToHand', group: 'humanoid' });
  assert.ok(pct > 0);
  const hits = Array.from({ length: 10 }, () => weaponBlowMods(null, 10, p, FOE, { unaware: false }));
  assert.equal(hits.reduce((a, b) => a + b, 0), 100 + Math.floor(pct), 'ten blows of 10 carry the percent whole');
  assert.equal(weaponBlowMods(null, 10, p, { ...FOE, isPlayer: true }, {}), 10, 'a player struck: nothing');
  setSigilDueling(true);
  assert.equal(weaponBlowMods(null, 10, p, FOE, {}), 10, 'a duel: nothing');
});

test('FIRM1 powers: A SPELL - its damage, its pace and its price; a keystone\'s price below none (Martyr\'s Vow)', () => {
  const p = hero();
  setFirmamentOnline(true);
  const before = { power: spellPowerMult(p, FOE, { online: false }), rate: castRate(p) };
  const t = walk('mg.start', named('Searing Will'), named('Words Unspoken'));
  setFirmamentTree(t);
  const c = treeStats(t);
  assert.ok(Math.abs(spellPowerMult(p, FOE, { online: false }) - before.power * (1 + c.spellPower / 100)) < 1e-9);
  assert.ok(Math.abs(castRate(p) - Math.min(2, before.rate + c.castSpeed / 100)) < 1e-9);
  assert.equal(spellPowerMult(p, { ...FOE, isPlayer: true }, { online: false }), 1, 'never at a player');
  const destr = { effects: [{ type: 4, subType: 0 }] };
  assert.equal(firmamentCastCost(p, 100, destr), 100 * (100 - (c.castCost ?? 0)) / 100);
  setFirmamentTree(walk('rt.start', 'rt.k'));   // Martyr's Vow: spells 4% weaker (its price halved)
  assert.ok(spellPowerMult(p, FOE, { online: false }) < before.power);
});

test('FIRM1 powers: WHAT LANDS ON ME - a spell\'s damage by its channel, and the online layer\'s health beside Renown\'s', () => {
  const p = hero();
  setFirmamentOnline(true);
  setFirmamentTree(walk('wr.start', named("Giant's Heart"), named("Troll's Blood")));   // health
  setRenownLayer(p, 5);
  const renownOnly = renownHpOf(p);
  firmamentLayer(p);
  assert.ok(renownHpOf(p) > renownOnly, 'the sky\'s health rides the layer');
  setRenownLayer(p, null);
  assert.equal(renownHpOf(p), 0, 'offline, the whole layer goes - nothing of it in a save');
  // a spell's damage (no blow pending) by `spellTaken`; none asleep
  setFirmamentTree(walk('rt.start', named('Spell Turning')));   // 4% less
  assert.equal(firmamentDamage(p, 100), 96);
  setSigilDueling(true);
  assert.equal(firmamentDamage(p, 100), 100);
});

test('FIRM1 powers: THE GATHERING ACTS - the herb\'s window and the tug\'s, the Firmament\'s act channels wider (1 with no tree)', () => {
  assert.equal(firmActMult('herbalism'), 1);
  const plain = createHerbAct({ kind: 'steady' }).state.window;
  assert.equal(plain, HERB_ACT.steadyDeg);
  setFirmamentOnline(true);
  setFirmamentTree(walk('rt.start', named('Gentle Hands'), 'rt.la'));   // and the herb's threshold
  const m = firmActMult('herbalism');
  assert.ok(m > 1);
  assert.ok(Math.abs(createHerbAct({ kind: 'steady' }).state.window - plain * m) < 1e-9);
  setFirmamentTree(walk('st.start', named('Patient Line')));
  assert.ok(Math.abs(createFishAct({}).state.tugS - tugWindow(false) * firmActMult('fishing')) < 1e-9);
  assert.ok(firmActMult('fishing') > 1);
});
