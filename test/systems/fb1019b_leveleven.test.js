// LEVEL-EVEN (2026-10-19, Discord #suggestions "Make Health from Endurance retroactive", through Mac; Mac on which to
// build: "Your opinion" - the floor and the fixed pool, online): "make the endurance effect on health per level
// retroactive, so that people are not penalized dozens or possibly hundreds of hp for not investing in endurance as early
// as possible ... making class health per level apply as an average ... Making levels consistently give 5 attribute
// points". Online the maximum is never below the class's average body at its level and its Endurance now (the
// Firmament's stars in it), on the layer beside Renown's; every online level's pool is 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evenHpFloor, evenHpOf, averageLevelHp, ONLINE_BONUS_POOL } from '../../src/systems/levelEven.js';
import { setRenownLayer, setOnlineLayerExtra, refreshOnlineLayer, offlineVitals, renownHpOf } from '../../src/systems/renownLayer.js';
import { defineLiveMaxHealth, rollMaxHealthLevel1 } from '../../src/systems/chargen.js';
import { applyLevelUp, bonusPoolFor } from '../../src/systems/advancement.js';
import { commitVirtueLevelUp } from '../../src/systems/oblivionLeveling.js';
import { levelingOptions } from '../../src/ui/levelingChoice.js';

const fixed = (v) => () => v;
const counted = (v) => { const g = () => { g.n++; return v; }; g.n = 0; return g; };
/** A player of a 30-a-level class at `level`, its stored maximum `raw`, at full health. */
const hero = ({ level = 10, raw = 200, end = 50, h = 30 } = {}) => defineLiveMaxHealth({
  isPlayer: true, level, career: { hitPointsPerLevel: h }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: end, personality: 50, speed: 50, luck: 50 },
  maxHealth: raw, health: raw,
});
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}

test('LEVEL-EVEN: the floor - RollMaxHealth\'s level 1, then every level at the class\'s average roll with HitPointsModifier at the Endurance given, at least 1 a level, whole (mutants: the average\'s low end, the modifier dropped, the floor of 1, level 1\'s body)', () => {
  assert.equal(averageLevelHp(30, 50), 22.5, '15-30 is 22.5 - the thread\'s own number');
  assert.equal(evenHpFloor(hero(), 50), Math.floor(25 + 30 + 9 * 22.5));   // 257
  assert.equal(evenHpFloor(hero(), 70), Math.floor(25 + 30 + 9 * 24.5), 'END 70: +2 a level, every level');
  assert.equal(evenHpFloor(hero(), 20), Math.floor(25 + 30 + 9 * 19.5), 'END 20: -3');
  assert.equal(evenHpFloor(hero({ h: 4 }), 0), 25 + 4 + 9 * 1, 'a 4-a-level class at END 0: (2+4)/2 - 5 is under 1 - one a level, CalculateHitPointsPerLevelUp\'s floor');
  assert.equal(evenHpFloor(hero({ level: 1 }), 50), rollMaxHealthLevel1({ hitPointsPerLevel: 30 }), 'level 1 is RollMaxHealth');
  assert.equal(evenHpFloor({ level: 5 }, 50), 0, 'no career, no floor');
  assert.equal(evenHpOf(hero({ raw: 300 }), 50), 0, 'rolls above the floor are kept');
  assert.equal(evenHpOf(hero({ raw: 200 }), 50), 57);
});

test('LEVEL-EVEN: online the floor rides the layer - the maximum lifted to it, health by its share; offline, and taken off, the stored maximum; a character above it untouched (mutants: the term left out of the layer, laid offline)', () => {
  const e = hero();
  assert.equal(e.maxHealth, 200, 'offline: the stored maximum');
  setRenownLayer(e, 1);
  assert.equal(e.maxHealth, 257); assert.equal(e.health, 257, 'full stays full');
  assert.equal(e.rawMaxHealth, 200, 'the stored value never takes the floor');
  setRenownLayer(e, null);
  assert.equal(e.maxHealth, 200); assert.equal(e.health, 200);
  const lucky = hero({ raw: 300 });
  setRenownLayer(lucky, 1);
  assert.equal(lucky.maxHealth, 300, 'above the floor: as rolled');
});

test('LEVEL-EVEN: the floor is retroactive - Endurance raised later pays every level back, and the Firmament\'s stars count; a save keeps the stored maximum and the health at its share (mutants: the stars\' Endurance left out)', () => {
  const e = hero();
  setRenownLayer(e, 1);
  e.stats.endurance = 70;
  refreshOnlineLayer(e);
  assert.equal(e.maxHealth, Math.floor(55 + 9 * 24.5), 'END 50 -> 70 lifts all nine levels');
  e.stats.endurance = 50;
  setOnlineLayerExtra(e, { end: 15 });
  assert.equal(e.maxHealth, Math.floor(55 + 9 * 23.5), 'the stars\' +15 Endurance reads 65');
  e.health = Math.round(e.maxHealth / 2);
  const off = offlineVitals(e);
  assert.equal(off.health, 100, 'half of the online body is half of the stored one');
  setOnlineLayerExtra(e, null); setRenownLayer(e, null);
  assert.equal(renownHpOf(e), 0);
});

test('LEVEL-EVEN: online a level-up reads the floor again over its new maximum, Daggerfall\'s way and Oblivion Remastered\'s; and every online level hands out 5 points from no draw, offline 4-6 as BonusPool (mutants: the refresh dropped from either lane, the pool\'s 5, the online gate)', () => {
  online(() => {
    const e = hero({ level: 9, raw: 150 });
    e.readyToLevelUp = true;
    setRenownLayer(e, 1);
    const g = counted(0);
    let spent = 0;
    applyLevelUp(e, (_s, pool) => { spent = pool; }, g);
    assert.equal(spent, ONLINE_BONUS_POOL); assert.equal(ONLINE_BONUS_POOL, 5);
    assert.equal(e.level, 10);
    assert.equal(e.rawMaxHealth, 150 + 15 + 0, 'the level\'s own roll, stored');
    assert.equal(e.maxHealth, Math.floor(55 + 9 * 22.5), 'the floor at the new level at once');
    assert.equal(g.n, 1, 'the HP roll alone - the pool drew nothing');
    const v = hero({ level: 9, raw: 150 });
    v.readyToLevelUp = true;
    setRenownLayer(v, 1);
    commitVirtueLevelUp(v, {}, 0, { attributePoints: 0, maxUpdatableAttribute: 3 }, fixed(0));
    assert.equal(v.level, 10);
    assert.equal(v.maxHealth, Math.floor(55 + 9 * 22.5), 'the virtue lane\'s level reads it too');
  });
  assert.equal(bonusPoolFor({}, fixed(0), { online: false }), 4);
  assert.equal(bonusPoolFor({}, fixed(0.999), { online: false }), 6);
  assert.equal(bonusPoolFor({}, fixed(0.999), { online: true }), 5);
});

test('LEVEL-EVEN: the leveling screen says the five online and the roll offline', () => {
  const on = levelingOptions(null, { online: true })[0].lines.join(' ');
  const off = levelingOptions(null, { online: false })[0].lines.join(' ');
  assert.match(on, /Each level gives 5 attribute points\./);
  assert.match(off, /Each level rolls 4 to 6 attribute points\./);
});

test('LEVEL-EVEN: the Firmament\'s Endurance reaches the floor through its own layer round - a star that lifts Endurance across a tenth lifts every level; asleep it lifts none (mutant: the round hands no Endurance)', async () => {
  const { setFirmamentTree, setFirmamentOnline, _resetFirmamentLiveForTests } = await import('../../src/systems/firmamentLive.js');
  const { firmamentLayer, _resetFirmamentPowersForTests } = await import('../../src/systems/firmamentPowers.js');
  const { _resetSigilForTests } = await import('../../src/systems/sigil/sigil.js');
  _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetSigilForTests();
  const e = hero({ raw: 60, end: 59, h: 8 });
  setRenownLayer(e, 1);
  const before = e.maxHealth;
  assert.equal(before, Math.floor(33 + 9 * 6), 'END 59');
  setFirmamentTree({ start: 'wr.start', keys: [] });   // the Warrior's sign: +1 Endurance
  firmamentLayer(e);
  assert.equal(e.maxHealth, before, 'offline the sky sleeps - no Endurance reaches the floor');
  setFirmamentOnline(true);
  firmamentLayer(e);
  assert.equal(e.maxHealth, Math.floor(33 + 9 * 7), 'END 60 with the sign: +1 a level, every level');
  setRenownLayer(e, null);
  _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _resetSigilForTests();
});

test('LEVEL-EVEN: the level-up screen\'s Endurance says so - online every level gained and to come, offline from now on (mutant: the online words never read)', async () => {
  const { ATTRIBUTE_BLURB } = await import('../../src/ui/levelUp/levelUpView.js');
  assert.equal(ATTRIBUTE_BLURB.endurance, 'Raises the health you gain each level from now on.');
  online(() => assert.equal(ATTRIBUTE_BLURB.endurance, 'Raises the health you gain each level. Online, your health is never below your class\'s average for your level at your current Endurance.'));   // AUDIT SUGGESTIONS-1019 L6-5
});
