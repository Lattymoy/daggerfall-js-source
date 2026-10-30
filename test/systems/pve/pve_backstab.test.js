// FIXED-PVE BACKSTAB (bible/05-Combat/Fixed-PvE.md section 12): the triple only as an opener on a template foe, half
// again once it fights, a leader never losing more than LEADER_BACKSTAB_CAP of its health to one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { templateBackstab, BACKSTAB_FIGHT, LEADER_BACKSTAB_CAP } from '../../../src/systems/pve/pveBackstab.js';
import { calculateAttackDamage, registerFormulaOverride } from '../../../src/combat/formulas.js';
import { standTemplate, templateFoe } from '../../../src/systems/pve/pveGrant.js';

const grunt = { pveTemplate: 'orc-grunt', pveCategory: 'normal', maxHealth: 600 };
const warlord = { pveTemplate: 'orc-warlord', pveCategory: 'strong', maxHealth: 1000 };

test('BACKSTAB: an opener triples, a fight\'s blow from behind is half again, a failed one is untouched', () => {
  assert.equal(templateBackstab(grunt, 100, 300, true), 300);
  assert.equal(templateBackstab(grunt, 100, 300, false), 100 * BACKSTAB_FIGHT);
  assert.equal(templateBackstab(grunt, 100, 100, false), 100, 'no backstab');
  assert.equal(templateBackstab(grunt, 0, 0, true), 0);
  assert.equal(templateBackstab({ maxHealth: 50 }, 100, 300, false), 300, 'no template: the triple');
  assert.equal(templateBackstab(null, 100, 300, false), 300);
});

test('BACKSTAB: a leader loses at most its cap to one - never less than the plain blow', () => {
  assert.equal(templateBackstab(warlord, 200, 600, true), Math.floor(1000 * LEADER_BACKSTAB_CAP));
  assert.equal(templateBackstab(warlord, 100, 300, true), 300, 'under the cap');
  assert.equal(templateBackstab({ ...warlord, maxHealth: 100 }, 80, 240, true), 80, 'the cap never takes the blow itself away');
  assert.equal(templateBackstab({ ...grunt, maxHealth: 100 }, 200, 600, true), 600, 'a plain foe has no cap');
});

test('BACKSTAB: the stand marks the category, and the formula hands the blow through', () => {
  const e = standTemplate({ level: 1 }, templateFoe('orc-warlord'));
  assert.equal(e.pveCategory, 'strong');
  registerFormulaOverride('calculateAttackDamage', () => 300);   // the core pinned: the tail alone
  try {
    assert.equal(calculateAttackDamage({ isPlayer: true }, { ...grunt, health: 600 }, { rolls: () => 0 }), 300, 'the override stands as the core');
  } finally { registerFormulaOverride('calculateAttackDamage', null); }
  const src = readFileSync(new URL('../../../src/combat/formulas.js', import.meta.url), 'utf8');
  assert.equal((src.match(/damage = templateBackstab\(target, before, damage, !!unaware\);/g) ?? []).length, 2, 'both backstab sites');
});
