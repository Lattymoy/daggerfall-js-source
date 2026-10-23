// PWR5 (2026-10-23, bible/05-Combat/Power-Arc.md section 8): THE GROUP AND THE VETERAN. Mac, asked: "Templates in
// refereed lanes" (the duel, the arena and the siege on a fixed template - the class and the weapon family; attributes,
// skills and metal normalized; flat health - and the open zone keeping its gear, "a target takes only so much from
// several players at once, and Renown adds no health"); "Pay by contribution" (the sigil follows a fighter's share of the
// fight, not the crowd's size).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PVP_VITALITY, newFighter, siegeVitality, CROWD_HARM, SIEGE_UNITS_PER_M, SIEGE_HARM } from '../../../src/net/siege/siegeRef.js';
import { pvpVitality, ARENA_PRIVATE_VITALITY } from '../../../src/net/arena/arenaLaw.js';
import { newWildRef, wildZone, wildBlow } from '../../../src/net/wild/wildRef.js';
import { PVP_TEMPLATE, templateSheet, templateWeapon, templateBlow } from '../../../src/combat/pvpTemplate.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { playerArrowHitFoe } from '../../../src/combat/arrowFlight.js';
import { readFileSync } from 'node:fs';
import { WEAPON_MATERIALS } from '../../../src/characters/weapons.js';
import { contributionParty, noteMyBlow, myShare, partyToughness, _resetPartyScaleForTests } from '../../../src/systems/party/partyScale.js';

const M = SIEGE_UNITS_PER_M;
const at = (x, z = 0) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M + z * M });
const FIST = { w: -1, m: 0 };
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const stats = (v) => ({ strength: v, intelligence: v, willpower: v, agility: v, endurance: v, personality: v, speed: v, luck: v });
const skillsAll = (v) => Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v]));
const sheet = (level, v, sk) => ({ isPlayer: true, level, raceId: 2, stats: stats(v), skills: skillsAll(sk), career: { attackModifierFlags: 0, weaponArmorShieldsBitfield: 0x00070000, abilityFlagsAndSpellPointsBitfield: 0 }, health: 80, maxHealth: 80, items: [], activeEffects: [] });
const SWORD = 118;   // a Long Blade's template (characters/weapons.js weaponSkillUsed)

test('PWR5 RENOWN BUYS NO PVP HEALTH: every player fighter stands at one flat vitality - the arena\'s equal bout\'s 360 - whatever its Renown, in the duel, the siege, the open zone and a rated bout; a town\'s NPC keeps its own (mutants: the vitality by Renown again; the arena\'s rated bout by level)', () => {
  assert.equal(PVP_VITALITY, 360);
  assert.equal(PVP_VITALITY, ARENA_PRIVATE_VITALITY, 'pinned equal');
  for (const lv of [1, 20, 50]) assert.deepEqual([newFighter(lv, 0).hp, newFighter(lv, 0).max], [360, 360], `Renown ${lv}`);
  assert.deepEqual([1, 30, 60].map(pvpVitality), [360, 360, 360]);
  assert.equal(siegeVitality(10), 320, 'an NPC of Renown 10: its own');
});

test('PWR5 THE MANY ON ONE IS A TWO ON ONE: in the open zone a fighter takes harm from at most two strikers inside BAL8\'s window - a third lands nothing until one of them has let it be a whole window (mutants: the third lands; the window never empties; the count past two)', () => {
  assert.deepEqual(CROWD_HARM, { strikers: 2, windowMs: SIEGE_HARM.windowMs });
  const st = newWildRef();
  const now = 10_000;
  wildZone(st, 'acct-t', { id: 'peer-t', lv: 10 }, true, at(0), now);
  for (const [k, x] of [['acct-a', -1], ['acct-b', 1], ['acct-c', 0.5]]) wildZone(st, k, { id: `peer-${k}`, lv: 10 }, true, at(x, 0.5), now);
  const blow = (by, t) => wildBlow(st, by, 'acct-t', { d: 5, held: FIST }, t);
  assert.equal(blow('acct-a', now + 100).dealt, 5);
  assert.equal(blow('acct-b', now + 200).dealt, 5, 'two on one: both land');
  const third = blow('acct-c', now + 300);
  assert.deepEqual([third.ok, third.dealt, third.why], [true, 0, 'crowd'], 'a third: nothing');
  assert.equal(blow('acct-a', now + 400).dealt, 5, 'the two keep striking');
  // a whole window after b's last blow, b is gone from the crowd: c may strike (a struck on, so a stays)
  assert.equal(blow('acct-a', now + 200 + CROWD_HARM.windowMs - 50).dealt, 5);
  assert.equal(blow('acct-c', now + 200 + CROWD_HARM.windowMs + 1).dealt, 5, 'b let it be a window: c lands');
  assert.equal(blow('acct-b', now + 200 + CROWD_HARM.windowMs + 2).why, 'crowd', 'and now b is the third');
});

test('PWR5 THE TEMPLATE: a refereed blow is counted on the template - the class\'s bitfields, the race and the weapon\'s family the striker\'s own; the level, every attribute and skill, the metal and the condition the template\'s (mutants: an attribute kept; a skill kept; the metal kept; the family normalized)', () => {
  assert.deepEqual(PVP_TEMPLATE, { level: 30, attribute: 75, skill: 100, material: WEAPON_MATERIALS.Steel, condition: 100 });
  const a = { lv: 47, r: 3, st: [100, 90, 80, 70, 60, 50, 40, 30], sk: [140, 100, 120, 80], cf: [5, 7, 9], h: [200, 400], cm: 6 };
  const t = templateSheet(a);
  assert.deepEqual([t.lv, t.r, t.cf, t.h], [30, 3, [5, 7, 9], [200, 400]]);
  assert.deepEqual(t.st, new Array(8).fill(75));
  assert.deepEqual(t.sk, [100, 100, 100, 100]);
  assert.equal(t.cm, 0, 'the claws\' metal Steel\'s');
  assert.deepEqual(templateWeapon({ t: 123, m: 9, c: 40 }), { t: 123, m: WEAPON_MATERIALS.Steel, c: 100 }, 'a Daedric Dai-Katana half worn: a whole Steel one');
  assert.equal(templateWeapon(null), null, 'a bare hand stays bare');
});

test('PWR5 PAY BY CONTRIBUTION: the fight as it pays one fighter is the fight\'s size weighed by that fighter\'s share - a fair partner the whole size, a carry no more, one who struck nothing a fight of one; my share my own blows over the foe\'s whole health as the fight weighed it (mutants: the crowd\'s size paid; the share unweighed by the party; the size past the fight)', () => {
  assert.deepEqual([[1, 1], [4, 0.25], [4, 1], [4, 0.1], [4, 0], [8, 0.125], [8, 0.06]].map(([n, s]) => contributionParty(n, s)), [1, 4, 4, 2, 1, 8, 4]);
  _resetPartyScaleForTests();
  const foe = { entity: { maxHealth: 100 } };
  noteMyBlow(foe, 30); noteMyBlow(foe, 20); noteMyBlow(foe, -5);
  assert.equal(myShare(foe, 1), 0.5, 'alone: half of it');
  assert.equal(myShare(foe, 4), 50 / (100 * partyToughness(4)), 'four strong: over its weighed health');
  noteMyBlow(foe, 1000);
  assert.equal(myShare(foe, 1), 1, 'never past whole');
  assert.equal(myShare({ entity: { maxHealth: 100 } }, 4), 0, 'a foe I never struck');
  _resetPartyScaleForTests();
});

test('PWR5 THE ARENA\'S BOUT ON THE TEMPLATE: my swing and my shaft at my opponent on a relay\'s sand are rolled whole on the template - a level-1 novice with an Iron sword and a level-60 master with a Daedric one roll the same numbers on the same dice; the shaft\'s door takes the lane\'s number in place of the formula\'s; the spell at the template\'s level, no caster\'s powers (mutants: the swing on my own sheet; the shaft on the formula; the spell at my level)', () => {
  const novice = sheet(1, 30, 5), master = sheet(60, 100, 100);
  const iron = createWeapon(SWORD, 0, () => 0.5), daedric = createWeapon(SWORD, 9, () => 0.5);
  const roll = (who, w, seed) => Array.from({ length: 40 }, ((r) => () => templateBlow(who, w, 'melee', r))(lcg(seed)));
  const a = roll(novice, iron, 7), b = roll(master, daedric, 7);
  assert.deepEqual(a, b, 'the same dice, the same blows');
  assert.ok(a.some((d) => d > 0), 'and they land');
  // the shaft's door: the lane's number, never the formula's
  const dealt = [];
  const rival = { rival: 'p1', dead: false, entity: { health: 100, maxHealth: 100, items: [] }, ai: { feet: [0, 0, 0], height: 1.8, radius: 0.4 } };
  const got = playerArrowHitFoe({ pos: [0, 1, 0], weapon: null }, rival, { playerEntity: master, blow: () => 17, dealDamage: (t, d) => dealt.push(d) });
  assert.deepEqual([got, dealt], [17, [17]]);
  // the doors, by source
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /function swingOnRival\(rb, lookDir\) \{\n\s*const damage = templateBlow\(playerEntity, playerWeapon\.strikingWeapon \?\? null, 'melee'\);/, 'the swing\'s number the template\'s');
  assert.match(dc, /if \(foe\.rival != null\) \{ hitEnemy = true; swingOnRival\(foe, lookDir\); continue; \}/);
  assert.match(dc, /playerArrowHitFoe\(m, rv, \{[^\n]*blow: \(\) => templateBlow\(playerEntity, m\.weapon \?\? null, 'arrow'\), dealDamage: \(t, d\) => landOnRival\(rv, d, 'arrow'\) \}\);/, 'the shaft\'s');
  assert.match(rd('src/scenes/gate/standInSpell.js'), /function spellOnRival\(sp\) \{[\s\S]{0,200}?countOnStandIn\(harm, rb\.entity, PVP_TEMPLATE\.level, null, rolls\);/, 'the spell\'s');
});
