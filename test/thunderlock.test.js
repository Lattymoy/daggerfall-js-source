// THE DWARVEN THUNDERLOCK - the port's own weapon, and the first item
// in this port that Daggerfall does not have.
//
// What is pinned here is not "a gun exists". It is the two claims that
// make a departure survivable in a 1:1 port: THE CLASSIC TABLES ARE
// UNTOUCHED, and the new weapon reaches the game through doors that
// already existed. Every arm below is one of those doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, THUNDERLOCK_ARCHIVE, ammoTemplateFor,
} from '../src/characters/thunderlockIds.js';
import {
  createThunderlock, createPellets, isThunderlock, isPellet, pelletCount, spendPellet,
  THUNDERLOCK_DAMAGE, THUNDERLOCK_SKILL, THUNDERLOCK_TEMPLATES, ART,
} from '../src/systems/thunderlock.js';
import { weaponSkillUsed, weaponMinDamage, weaponMaxDamage } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { templateByIndex, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { weaponTypeForItem, WEAPON_TYPES, getWeaponAnims } from '../src/combat/fpsWeapon.js';
import { THUNDERLOCK_NUM_FRAMES, MELEE_NUM_FRAMES, BOW_NUM_FRAMES } from '../src/characters/weaponStates.js';
import { isBowWeapon, attackSkillOf, WEAPON_SKILL_BY_TEMPLATE } from '../src/scenes/hostCombat.js';
import { spendAmmoFor, ammoCountFor } from '../src/systems/inventory.js';
import { playerArchiveFor } from '../src/characters/paperdollArt.js';

const GUN = { templateIndex: THUNDERLOCK_TEMPLATE, group: 'Weapons' };
const BOW = { templateIndex: 130, group: 'Weapons' };

test('the classic tables are untouched: the new rows live past the end of DFU’s', () => {
  // itemTemplates.json is DFU's ItemTemplates.txt committed verbatim.
  // The departure is a REGISTRATION, not a row added to that file.
  assert.equal(ITEM_TEMPLATES.length, 288, 'DFU’s 288, unchanged');
  assert.ok(THUNDERLOCK_TEMPLATE > 541 && PELLET_TEMPLATE > 541,
    'past DFU’s 288 AND past Climates & Calories’ 530-541, so neither collides');
  const raw = readFileSync('src/characters/itemTemplates.json', 'utf8');
  assert.ok(!raw.includes('Thunderlock') && !raw.includes('Pellet'), 'and nothing was written into the verbatim file');
  for (const t of THUNDERLOCK_TEMPLATES) {
    const row = templateByIndex(t.index);
    assert.ok(row?.custom, `${t.name} registered as a custom template`);
    assert.equal(row.name, t.name);
  }
  assert.equal(templateByIndex(THUNDERLOCK_TEMPLATE).name, 'Dwarven Thunderlock');
  assert.equal(templateByIndex(PELLET_TEMPLATE).name, 'Dwemer Pellet');
});

test('it is scored on ARCHERY, through the law every host already asks', () => {
  assert.equal(weaponSkillUsed(THUNDERLOCK_TEMPLATE), SKILLS.Archery);
  assert.equal(THUNDERLOCK_SKILL, SKILLS.Archery);
  // the door the hosts actually use: "is this a ranged weapon" is
  // "is it scored on Archery", so naming the skill IS the wiring
  assert.equal(attackSkillOf(GUN), SKILLS.Archery);
  assert.equal(isBowWeapon(GUN), true, 'the hosts’ ranged gate takes it without being told about it');
  assert.equal(isBowWeapon(BOW), true, 'and the bow is untouched');
  assert.equal(isBowWeapon({ templateIndex: 120 }), false, 'a longsword is still not ranged');
  // ONE TABLE. hostCombat.js carried a second copy of the weapon->skill
  // map and answered null here, which is what sent the gun down the
  // melee arc in every host until it was collapsed onto weapons.js.
  assert.equal(WEAPON_SKILL_BY_TEMPLATE[130], SKILLS.Archery);
  assert.equal(WEAPON_SKILL_BY_TEMPLATE[113], SKILLS.ShortBlade);
  const host = readFileSync('src/scenes/hostCombat.js', 'utf8');
  assert.match(host, /from '\.\.\/characters\/weapons\.js'/, 'and it reads the one home rather than restating it');
});

test('its damage span is its own, and the DFU spans are exactly what they were', () => {
  assert.deepEqual([weaponMinDamage(THUNDERLOCK_TEMPLATE), weaponMaxDamage(THUNDERLOCK_TEMPLATE)],
    [THUNDERLOCK_DAMAGE.min, THUNDERLOCK_DAMAGE.max]);
  assert.ok(THUNDERLOCK_DAMAGE.max > 21, 'harder per shot than anything classic - a Dai-Katana is 21');
  // the verbatim tables, spot-checked either side of the new arm
  assert.deepEqual([weaponMinDamage(130), weaponMaxDamage(130)], [4, 18], 'Long Bow');
  assert.deepEqual([weaponMinDamage(123), weaponMaxDamage(123)], [3, 21], 'Dai-Katana');
  assert.deepEqual([weaponMinDamage(113), weaponMaxDamage(113)], [1, 6], 'Dagger');
  assert.equal(weaponMinDamage(999), 0, 'and an unknown template is still nothing');
});

test('it is RANGED but not a BOW - the machine keeps the trigger, the skill keeps Archery', () => {
  const type = weaponTypeForItem(GUN);
  assert.equal(type, WEAPON_TYPES.Thunderlock);
  assert.notEqual(type, WEAPON_TYPES.Bow, 'a bow draws and holds; this has a trigger');
  assert.equal(weaponTypeForItem(BOW), WEAPON_TYPES.Bow, 'the verbatim switch is untouched');
  assert.equal(weaponTypeForItem({ templateIndex: 120 }), WEAPON_TYPES.LongBlade);
  // six frames on every strike direction: a gun does not care which
  // way you dragged
  const anims = getWeaponAnims(type);
  assert.equal(anims.length, 7);
  assert.deepEqual(anims.map((a) => a.NumFrames), [1, 6, 6, 6, 6, 6, 6]);
  assert.deepEqual(anims.map((a) => a.Record), [0, 1, 1, 1, 1, 1, 1], 'record 0 idle, record 1 the fire cycle');
  assert.equal(THUNDERLOCK_NUM_FRAMES.StrikeDown, 6);
  // and the two classic tables are what they were
  assert.equal(MELEE_NUM_FRAMES.StrikeDown, 5);
  assert.equal(BOW_NUM_FRAMES.StrikeDown, 7);
});

test('the shot spends a Dwemer Pellet, and a bow still spends an Arrow', () => {
  const bag = [createPellets(3), { templateIndex: 131, group: 'Weapons', name: 'Arrow', stackCount: 2 }];
  assert.equal(ammoTemplateFor(GUN), PELLET_TEMPLATE);
  assert.equal(ammoTemplateFor(BOW), null, 'the bow’s own answer stays with the bow');
  assert.equal(ammoCountFor(bag, GUN), 3);
  assert.equal(ammoCountFor(bag, BOW), 2, 'and a weapon with no link falls to the Arrow it always spent');
  assert.equal(spendAmmoFor(bag, GUN), true);
  assert.equal(ammoCountFor(bag, GUN), 2, 'the gun took a pellet');
  assert.equal(ammoCountFor(bag, BOW), 2, 'and not an arrow');
  // the weapon's own spender, same law
  const pellets = [createPellets(1)];
  assert.equal(pelletCount(pellets), 1);
  assert.equal(spendPellet(pellets), true);
  assert.equal(pelletCount(pellets), 0);
  assert.equal(spendPellet(pellets), false, 'and it refuses rather than firing a blank');
});

test('the mint: a weapon, an ammunition, and the paperdoll archive that is its own', () => {
  const gun = createThunderlock();
  assert.equal(gun.name, 'Dwarven Thunderlock');
  assert.equal(gun.group, 'Weapons', 'so equip, the doll and the damage laws all treat it as one');
  assert.ok(gun.maxCondition > 0 && gun.value > 0);
  assert.ok(isThunderlock(gun) && !isPellet(gun));
  const ammo = createPellets(20);
  assert.equal(ammo.name, 'Dwemer Pellet');
  assert.equal(ammo.stackCount, 20);
  assert.ok(isPellet(ammo) && !isThunderlock(ammo));
  // A CUSTOM WEAPON HAS NO FEMALE ARCHIVE TO BE OFF BY ONE FROM: the
  // classic pair is 233/234, this one registers a single archive, and
  // subtracting would ask for a texture nobody registered.
  const template = templateByIndex(THUNDERLOCK_TEMPLATE);
  assert.equal(playerArchiveFor(gun, template, { gender: 'male' }), ART.weaponArchive);
  assert.equal(playerArchiveFor(gun, template, { gender: 'female' }), THUNDERLOCK_ARCHIVE);
  // the classic rule is still the classic rule
  const sword = { templateIndex: 120, group: 'Weapons' };
  const swordT = templateByIndex(120);
  assert.equal(playerArchiveFor(sword, swordT, { gender: 'male' }), 234);
  assert.equal(playerArchiveFor(sword, swordT, { gender: 'female' }), 233);
});
