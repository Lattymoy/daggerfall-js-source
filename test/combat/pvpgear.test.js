// PVP-GEAR (2026-10-30, "all imprint"): a player's gear powers on a blow between players, each side capped. Held here:
// the striking piece's lines and every blow power that fits a player, never past PVP_GEAR.attack, a slayer line adding
// nothing; Serpent's Kiss flat; every guard power as the guard's share, never past PVP_GEAR.guard; the wiring.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../../src/systems/uiPrefs.js';
import { armorOfMaterial, weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { equipItem } from '../../src/systems/equip.js';
import { createHandWraps } from '../../src/systems/handWraps.js';
import { duelAttackerOf, resolveDuelStrike, duelStandIn } from '../../src/combat/duelCombat.js';
import {
  PVP_GEAR, pvpGearBlowPct, pvpGearBlowFlat, pvpGearLanded, pvpGearStruck, pvpGearKept, pvpGuardWithGear, setPvpFoeSight,
  _resetPvpGearForTests,
} from '../../src/combat/pvpGearPowers.js';

setPref('lootRarity', true);

const fighter = (...items) => {
  const e = { isPlayer: true, items: [], skills: Array(35).fill(100), stats: {}, health: 100, maxHealth: 100 };
  for (const it of items) { e.items.push(it); assert.deepEqual(equipItem(e, it), [], it.name); }
  return e;
};
const rare = (it, fields) => Object.assign(it, { rarity: 'rare', isIdentified: true, affixes: [], ...fields });
const dmg = (value, gem) => ({ id: 'damage', value, ...(gem ? { gem: 'diamond' } : {}) });

test('the striking piece\'s damage lines and gems, held at the attack top; a slayer line adds nothing', () => {
  const blade = rare(weaponOfMaterial(122, 2), { affixes: [dmg(25)] });
  const e = fighter(blade);
  assert.equal(pvpGearBlowPct(e, blade, 0), 25);
  blade.affixes.push(dmg(12, true), dmg(12, true));
  assert.equal(pvpGearBlowPct(e, blade, 0), PVP_GEAR.attack);   // 25 + 24, held at 40
  const plain = rare(weaponOfMaterial(122, 2), { affixes: [{ id: 'slayer', param: 'humanoid', value: 20 }, { id: 'slayer', param: 'undead', value: 20 }] });
  assert.equal(pvpGearBlowPct(fighter(plain), plain, 0), 0);
});

test('bare fists strike with the worn Hand Wraps; Many Endings as its mean; another weapon\'s lines are not the fists\'', () => {
  const wraps = rare(createHandWraps(), { affixes: [dmg(20)], imprint: 'warp-edge' });
  const e = fighter(wraps);
  assert.equal(pvpGearBlowPct(e, null, 0), 30);   // 20 + 10
  const other = rare(weaponOfMaterial(122, 2), {});
  assert.equal(pvpGearBlowPct(e, other, 0), 0, 'a weapon\'s power rides only its own blows');
});

test('Way of the Sword stacks on blows at players and lapses', () => {
  _resetPvpGearForTests();
  const blade = rare(weaponOfMaterial(122, 2), { imprint: 'anseis-edge' });
  const e = fighter(blade);
  assert.equal(pvpGearBlowPct(e, blade, 0), 0);
  for (let i = 0; i < 3; i++) pvpGearLanded(e, 1);
  assert.equal(pvpGearBlowPct(e, blade, 1), 18);
  for (let i = 0; i < 4; i++) pvpGearLanded(e, 2);
  assert.equal(pvpGearBlowPct(e, blade, 2), 30, 'five at most');
  assert.equal(pvpGearBlowPct(e, blade, 9), 0, 'gone six seconds on');
  _resetPvpGearForTests();
});

test('Open Hand on a bare fist; Orc Rage when low; Sweet Mother\'s Kiss and Serpent\'s Kiss read the foe\'s bar', () => {
  _resetPvpGearForTests();
  const gloves = rare(armorOfMaterial(106, 2), { imprint: 'gauntlets-of-the-rose' });
  const e = fighter(gloves);
  assert.equal(pvpGearBlowPct(e, null, 0), PVP_GEAR.attack, 'Open Hand +50, held at 40');
  assert.equal(pvpGearBlowPct(e, createHandWraps(), 0), PVP_GEAR.attack, 'wraps are fists');
  assert.equal(pvpGearBlowPct(e, rare(weaponOfMaterial(122, 2), {}), 0), 0, 'never a blade');
  const cleaver = rare(weaponOfMaterial(122, 2), { imprint: 'gortwogs-cleaver' });
  const raging = fighter(cleaver);
  assert.equal(pvpGearBlowPct(raging, cleaver, 0), 0);
  raging.health = 30;
  assert.equal(pvpGearBlowPct(raging, cleaver, 0), 30);
  setPvpFoeSight((id) => ({ h: id === 'low' ? 20 : 90, fighting: true }));
  const kiss = rare(weaponOfMaterial(122, 2), { imprint: 'night-mothers-embrace' });
  pvpGearLanded(fighter(kiss), 0, 'low'); pvpGearLanded(fighter(kiss), 0, 'high');
  assert.equal(pvpGearBlowPct(fighter(kiss), kiss, 1, 'low'), PVP_GEAR.attack);
  assert.equal(pvpGearBlowPct(fighter(kiss), kiss, 1, 'high'), 0);
  const fang = rare(weaponOfMaterial(122, 2), { imprint: 'tsaesci-fang' });
  assert.equal(pvpGearBlowFlat(fighter(fang), fang, 'high'), 8);
  assert.equal(pvpGearBlowFlat(fighter(fang), fang, 'low'), 16);
  assert.equal(pvpGearBlowFlat(fighter(fang), rare(weaponOfMaterial(122, 2), {}), 'low'), 0, 'the fang\'s own blows');
  setPvpFoeSight(null);
  _resetPvpGearForTests();
});

test('First Blood and Silent Death on a foe not struck in the lock\'s minute', () => {
  _resetPvpGearForTests();
  setPvpFoeSight(() => ({ h: 100, fighting: false }));
  const vambrace = rare(armorOfMaterial(104, 2), { imprint: 'duelists-vambrace' });
  const e = fighter(vambrace);
  assert.equal(pvpGearBlowPct(e, null, 0, 'a'), PVP_GEAR.attack);
  pvpGearLanded(e, 0, 'a');
  assert.equal(pvpGearBlowPct(e, null, 30, 'a'), 0, 'struck lately');
  assert.equal(pvpGearBlowPct(e, null, 30, 'b'), PVP_GEAR.attack, 'another foe');
  assert.equal(pvpGearBlowPct(e, null, 61, 'a'), PVP_GEAR.attack, 'a minute on');
  assert.equal(pvpGearBlowPct(e, null, 0, null), 0, 'no foe known, none');
  setPvpFoeSight(null);
  _resetPvpGearForTests();
});

test('Bedrock stacks and Hex holds on my hits taken; Bulwark always; all held at the guard top', () => {
  _resetPvpGearForTests();
  const ring = rare(armorOfMaterial(108, 2), { imprint: 'mountains-root' });
  const e = fighter(ring);
  assert.equal(pvpGearKept(e, 0), 100);
  pvpGearStruck(e, 0); pvpGearStruck(e, 1);
  assert.equal(pvpGearKept(e, 1), 92);
  for (let i = 0; i < 6; i++) pvpGearStruck(e, 2);
  assert.equal(pvpGearKept(e, 2), 80, 'five at most');
  assert.equal(pvpGearKept(e, 9), 100, 'gone six seconds on');
  const shield = rare(armorOfMaterial(109, 2), { imprint: 'wall-of-daggerfall' });
  assert.equal(pvpGearKept(fighter(shield), 0), 95);
  _resetPvpGearForTests();
});

test('the blow climbs by the sheet\'s gp after PVP-SCALE', () => {
  const stats = Object.fromEntries(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'].map((k) => [k, 80]));
  const striker = { isPlayer: true, level: 5, stats, skills: {}, items: [], health: 50, maxHealth: 60 };
  const strike = (gp) => resolveDuelStrike({ by: 'melee', a: { ...duelAttackerOf(striker), gp }, w: { t: 130, m: 0, c: 100 } }, duelStandIn(), { rolls: () => 0.01 }).dmg;
  const bare = strike(0);
  assert.ok(bare > 0);
  assert.equal(strike(40), bare + Math.floor((bare * 40) / 100));
});

test('Dawnward as its mean, the Raven left to PVP-EVADE, Last Stand under its line, held at the guard top', () => {
  const helm = rare(armorOfMaterial(107, 2), { imprint: 'aegis-of-dawn' });
  assert.equal(pvpGearKept(fighter(helm)), 83);   // 5 in 6
  const pauldron = rare(armorOfMaterial(105, 2), { imprint: 'ravens-wings' });
  assert.equal(pvpGearKept(fighter(helm, pauldron)), 83);   // the Raven is the relay's miss, not a share
  const boots = rare(armorOfMaterial(108, 2), { imprint: 'the-warden' });
  const low = fighter(boots);
  assert.equal(pvpGearKept(low), 100);
  low.health = 20;
  assert.equal(pvpGearKept(low), 75);
  const all = fighter(helm, pauldron, boots);
  all.health = 20;
  assert.equal(pvpGearKept(all), 100 - PVP_GEAR.guard);   // 53%, held at the top
  assert.equal(pvpGearKept(fighter()), 100);
});

test('each armour share loses the powers\' share', () => {
  const e = fighter(rare(armorOfMaterial(107, 2), { imprint: 'aegis-of-dawn' }));
  assert.deepEqual(pvpGuardWithGear([40, 50, 60], e), [33, 42, 50]);
  assert.deepEqual(pvpGuardWithGear([40, 50, 60], fighter()), [40, 50, 60]);
});

test('the wiring: the sheet carries gp, gf and its foe, a landed blow stacks, my hits taken counted, the foe\'s bar read, the mirror\'s guard', () => {
  const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
  const duel = src('combat/duelCombat.js');
  assert.match(duel, /gp: pvpGearBlowPct\(entity, weapon\?\.werecreatureClaws \? wraps : \(weapon \?\? wraps\), undefined, foe\)/, 'WERE-WRAPS: the claws strike in the wraps');
  assert.match(duel, /gf: pvpGearBlowFlat\(entity, weapon\?\.werecreatureClaws \? wraps : \(weapon \?\? wraps\), foe\)/);
  assert.match(duel, /pvpGearLanded\(target\.struckBy, undefined, d\.a\?\.fo \?\? null\)/);
  const world = src('scenes/world.js');
  assert.equal(world.match(/duelAttackerOf\(playerEntity, weapon, weaponRig\?\.playerWeapon\?\.wraps, to\)/g)?.length, 3, 'a blow at a player names its foe');
  assert.equal(world.match(/duelAttackerOf\(playerEntity, weapon, weaponRig\?\.playerWeapon\?\.wraps\)/g)?.length, 1, 'a siege work is no foe');
  const flag = src('scenes/pvpFlagHost.js');
  assert.match(flag, /if \(g\.to === me\(\) && g\.d > 0\) pvpGearStruck\(player\);/);
  assert.match(flag, /setPvpFoeSight\(\(id\) => \(\{ h: bars\.get\(id\)\?\.h \?\? null, fighting: foeOf\(id\) \}\)\);/);
  assert.match(src('net/siege/refereeHealthMirror.js'), /guard: \(\) => pvpGuardWithGear\(pvpArmorKept\(player\), player\)/);
});
