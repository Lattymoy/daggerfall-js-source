// DRAGON-SOUL (FIELD BUGS 2026-10-11, bible/01-Overview/bugs/Field-Bugs-2026-10-11.md; Paofrenetico: "Soul Trap Dragonling is
// not giving -5000 ep value"; the owner: "Fuck matching DFU."). DFU priced the Dragonling every encounter spawns (34) at
// nothing - the soulless general spawn - and only the quest B0B70Y16's (40) at -5000, and named both "Dragonling". A
// player trapped the one the world gives them and the maker offered it for 0. Now it binds as the quest's does. Driven
// on the real road: the service's empty soul trap, filled by the soul trap's own kill-time roll with a general-spawn
// Dragonling, enumerated from the pack, and offered by the item maker's picker at -5000.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySoulTrap } from '../../src/systems/shopStock.js';
import { attemptSoulTrap, enumerateFilledTraps } from '../../src/systems/mysticism.js';
import { primaryPick, enchantmentCost } from '../../src/systems/enchantmentCatalogue.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';

test('DRAGON-SOUL a general-spawn Dragonling trapped on the real road binds at -5000, as the quest\'s does', () => {
  assert.equal(MOBILE_TYPES.Dragonling, 34, 'the one every encounter spawns');
  assert.equal(MOBILE_TYPES.Dragonling_Alternate, 40, 'the quest\'s');
  const pack = [createEmptySoulTrap()];
  const foe = { activeEffects: [{ kind: 'soulTrap', chance: 100, ended: false }] };
  const r = attemptSoulTrap(foe, MOBILE_TYPES.Dragonling, pack, 0);
  assert.equal(r.alert, 'trapSuccess');
  assert.equal(pack[0].trappedSoulType, 34);
  const souls = enumerateFilledTraps(pack);
  assert.deepEqual([...souls], [34]);
  const pick = primaryPick('SoulBound', { souls });
  assert.equal(pick.kind, 'choose');
  assert.deepEqual(pick.options.map((o) => [o.param, o.label, o.settings.enchantCost]), [[34, 'Dragonling', -5000]], 'offered at the quest Dragonling\'s worth');
  assert.equal(enchantmentCost('SoulBound', 34), enchantmentCost('SoulBound', 40), 'one name, one worth');
});

test('DRAGON-SOUL the binding alone moved: the soul\'s gold (SoulPts) and the shops\' draws stay DFU\'s', () => {
  assert.equal(ENEMY_BASICS[34].soulPts ?? 0, 0, 'no shop price grows off a monster every encounter spawns');
  assert.equal(ENEMY_BASICS[40].soulPts, 500000);
  // every other cell of the table is DFU's own: the soulless still bind at nothing
  for (const id of [0, 3, 4, 5, 6, 11, 15, 17, 20, 39]) assert.equal(enchantmentCost('SoulBound', id), 0, `${id} soulless`);
});
