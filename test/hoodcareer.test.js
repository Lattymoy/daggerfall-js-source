// HOOD-CAREER (2026-10-07, Mac: "Wearing a hood should protect you from the disadvantage of being damaged by
// sunlight"): THE PORT'S DEPARTURE from PassiveSpecialsEffect.DamageFromSunlight (:107-121), DaggerfallUI's career box
// at the travel map's door (:614-621) and DaggerfallTravelPopUp's arrival clamp (:350-357). VAMP-HOOD and HOOD-SUN let a
// raised hood keep the sun off the vampire's curse; the custom class's own Damage from Sunlight still burned 12 every
// 4th round and barred the day's travel under the same hood. Every rule the career's CFG bit keys asks
// passiveSpecials.js careerSunAverse now - the bit, UNLESS the wearer's hood is up, which is survival/temperature.js
// cloakState: the one hood law. The fixtures are the producers': the career parseCareerData's (chargen's pick), the
// cloak ItemBuilder.CreateRandomClothing's (loot.js), the robes Create Item's, worn through EquipItem, and the hood
// raised by the paper doll's own click (useItem.js nextVariant) or the pack's Raise hood (toggleHood).
import './modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  careerSunDamage, careerSunAverse, passiveSpecialsMagicRound, setPassiveSpecialsHost, SUN_DAMAGE_AMOUNT,
} from '../src/systems/passiveSpecials.js';
import { parseCareerData } from '../src/systems/specialAdvantages.js';
import {
  careerFastTravelBlock, racialFastTravelBlock, SUNLIGHT_TRAVEL_TEXT, VAMPIRE_HOOD_TEXT,
} from '../src/systems/vampirism.js';
import { createRandomClothing, ITEM_GROUPS } from '../src/systems/loot.js';
import { createTempItem, CREATE_ITEM_ROWS } from '../src/systems/createItem.js';
import { equipItem } from '../src/systems/equip.js';
import { nextVariant, toggleHood } from '../src/systems/useItem.js';
import { arrivalClampMinutes } from '../src/systems/travel.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DAY = 400;   // a classic day number, far from the start
const at = (hour, minute = 0) => DAY * MINUTES_PER_DAY + hour * 60 + minute;   // every whole hour is a 4th round
/** A custom class carrying "Damage / From Sunlight", as chargen's CreateCharSpecialAdvantageWindow pick mints it. */
const sunClass = ({ gender = 'male' } = {}) => {
  const career = { abilityFlagsAndSpellPointsBitfield: 0 };
  parseCareerData(career, [{ primary: 'damage', secondary: 'fromSunlight' }]);
  return {
    isPlayer: true, name: 'Ilsabet', race: 'Breton', gender, level: 10, career,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    activeEffects: [], spells: [], items: [], skills: {}, health: 100, maxHealth: 100,
  };
};
/** ItemBuilder.CreateRandomClothing's casual cloak, variant 0 - drawn hood DOWN (test/fb0929_vampirehood.test.js's). */
function casualCloak(gender = 'male') {
  const list = ITEM_GROUPS[gender === 'female' ? 'WomensClothing' : 'MensClothing'];
  const draws = [(list.indexOf(gender === 'female' ? 191 : 154) + 0.5) / list.length, 0, 0];
  return createRandomClothing(gender, () => draws.shift());
}
const ROBES_ROW = CREATE_ITEM_ROWS.findIndex((r) => r.kind === 'robes');
/** One magic round in the street (the host answers outside), the hurt it dealt. */
const burn = (p, minutes) => {
  let hurt = 0;
  passiveSpecialsMagicRound(p, { nowMinutes: minutes, sinks: { hurt: (n) => { hurt += n; }, heal: () => {} } });
  return hurt;
};

afterEach(() => setPassiveSpecialsHost(null));

test('HOOD-CAREER: the burn - bare-headed in the street at noon Damage from Sunlight is DFU\'s 12 every 4th round; the doll\'s click raises the hood and the sun burns nothing; lowered it burns again; by night and indoors never (mutants: the burn asks no hood; the hood read backwards)', () => {
  const p = sunClass();
  assert.equal(careerSunDamage(p.career), true, 'the producer\'s bit');
  setPassiveSpecialsHost({ now: () => at(12), isInside: () => false });
  assert.equal(burn(p, at(12)), SUN_DAMAGE_AMOUNT, 'no cloak: DFU\'s burn');
  const cloak = casualCloak();
  equipItem(p, cloak);
  assert.equal(p.equip.slots[cloak.equipSlot], cloak, 'worn');
  assert.equal(careerSunAverse(p), true, 'hood down: the sun reaches the bit');
  assert.equal(burn(p, at(12)), SUN_DAMAGE_AMOUNT, 'hood down: the same burn');
  nextVariant(cloak);   // the doll's click: variant 1, drawn hood up
  assert.equal(careerSunAverse(p), false, 'hood up: it does not');
  assert.equal(burn(p, at(12)), 0, 'hood up at noon: no burn');
  assert.equal(burn(p, at(13)), 0, 'and the next hour');
  toggleHood(cloak);   // the Enhanced pack's Lower hood (HOOD-SAID)
  assert.equal(careerSunAverse(p), true, 'lowered');
  assert.equal(burn(p, at(12)), SUN_DAMAGE_AMOUNT, 'the hood lowered: the burn again');
  assert.equal(burn(p, at(23)), 0, 'by night nothing, hood or none');
  setPassiveSpecialsHost({ isInside: () => true });
  assert.equal(burn(p, at(12)), 0, 'and under a roof nothing, as DFU has it');
});

test('HOOD-CAREER: plain robes with the hood up are a hood too, on either body - a hood in the pack is none, and a class without the bit is never sun-averse', () => {
  for (const gender of ['male', 'female']) {
    const p = sunClass({ gender });
    const robes = createTempItem(ROBES_ROW, { gender, rolls: () => 0 });
    equipItem(p, robes);
    assert.equal(burn(p, at(9)), SUN_DAMAGE_AMOUNT, `${gender}: robes hood down - burned`);
    nextVariant(robes);   // the robes' second drawing, the hood up
    assert.equal(burn(p, at(9)), 0, `${gender}: robes hood up - not`);
    assert.equal(careerFastTravelBlock(p, at(9)), null, `${gender}: and the door opens`);
  }
  const p = sunClass();
  const carried = casualCloak();
  nextVariant(carried);   // hood up, and never put on
  p.items.push(carried);
  assert.equal(careerSunAverse(p), true, 'a hood in the pack keeps no sun off');
  assert.equal(burn(p, at(12)), SUN_DAMAGE_AMOUNT);
  const plain = sunClass();
  plain.career = { abilityFlagsAndSpellPointsBitfield: 0 };
  assert.equal(careerSunAverse(plain), false, 'no bit, no sun to keep off');
});

test('HOOD-CAREER: the travel rules - the map door\'s career box and the arrival clamp ask the same hood; the box keeps DFU\'s line and says the way out after it (mutants: the door asks the bit; the clamp asks the bit; the refusal says no more)', () => {
  const p = sunClass();
  const cloak = casualCloak();
  equipItem(p, cloak);
  assert.deepEqual(careerFastTravelBlock(p, at(12)), { text: SUNLIGHT_TRAVEL_TEXT, hint: VAMPIRE_HOOD_TEXT },
    'hood down at noon: DFU\'s box (DaggerfallUI.cs:619), and the hood\'s line after it');
  assert.equal(careerFastTravelBlock(p, at(22)), null, 'the night was always open');
  assert.equal(racialFastTravelBlock(p, at(12)), null, 'the racial rung never reads the career');
  assert.equal(arrivalClampMinutes(at(12), { sunAverse: careerSunAverse(p) }), 6 * 60, 'bare-headed: pushed to DuskHour');
  nextVariant(cloak);
  assert.equal(careerFastTravelBlock(p, at(12)), null, 'hooded at noon: the door opens');
  assert.equal(arrivalClampMinutes(at(12), { sunAverse: careerSunAverse(p) }), 0, 'and a noon arrival lands at noon');
});

test('HOOD-CAREER: ONE hood law, and every career rung asks it - passiveSpecials reads survival/temperature.js cloakState, world.js asks careerSunAverse / careerFastTravelBlock and never the bare bit; THE FOUR HOSTS', () => {
  const ps = read('src/systems/passiveSpecials.js');
  assert.match(ps, /^import \{ cloakState \} from '\.\/survival\/temperature\.js';/m, 'the felt temperature\'s hood, imported');
  assert.match(ps, /export function careerSunAverse\(entity\) \{\n\s*if \(!careerSunDamage\(entity\?\.career\)\) return false;\n\s*return !cloakState\(entity\.equip\?\.slots \?\? null\)\.hood;\n\}/);
  assert.match(ps, /&& careerSunAverse\(entity\)\n\s*&& playerInSunlight\(clockMinutes\)\) \{\n\s*sinks\?\.hurt\?\.\(SUN_DAMAGE_AMOUNT\);/, 'the burn asks the hood');
  const world = read('src/scenes/world.js');
  assert.doesNotMatch(world, /careerSunDamage/, 'no rung reads the bare bit');
  assert.equal((world.match(/careerFastTravelBlock\(playerEntity, nowMin\)/g) ?? []).length, 3,
    'the map door, the party\'s refusal and the driver\'s map online');
  assert.match(world, /sunAverse: racialSunAverse\(playerEntity\) \|\| careerSunAverse\(playerEntity\),/, 'the arrival clamp');
  // the burn rides worldTick's round in every host; the travel door and the clamp are world.js's alone: exterior.js
  // mounts no map, and the interior and dungeon hosts are inside, where the door refuses before any sun rung
  for (const host of ['exterior', 'worldModes', 'dungeonContext']) {
    assert.doesNotMatch(read(`src/scenes/${host}.js`), /careerFastTravelBlock|careerSunAverse|careerSunDamage|arrivalClampMinutes/,
      `${host}.js has no travel door - flagged, nothing to wire`);
  }
});
