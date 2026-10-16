// FULL-GUARD (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "One shot bug" -
// YeetMaster64: "I get one hit killed several times a day"; Mac: "No kill from full health"). BAL2 gave every striker the
// player's crit, BAL4 put the elites (x3) and the Enhanced AI's telegraphed slams (x1.75) in the offline game by default,
// and nothing capped the stack: a level-12 elite's slam killed a 110-health player from full in about one landed slam in
// ten. Now a foe's one blow never takes a player at full health to dead - the damage door leaves them at 1, and no death
// save is spent on it. A blow is what the set powers' law says one is (the attack formula's struck tail's mark,
// sigilSetPowers.js pendingPlayerBlow): a fall, a spell or a poison's round from full kills as it did, and the next blow
// at 1 kills as it always has. Pinned on the real attack formula's tail, the real damage door and Malacath's real
// Unbroken (test/systems/set3_powers.test.js's fixtures).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setStruck, setSetPowersVoice, _setSetPowersClockForTests, _resetSetPowersForTests } from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { calculateAttackDamage } from '../../../src/combat/formulas.js';
import { hurtPlayer, setDeathPresenter } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { makeEnemyEntity } from '../../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';

const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const wearSet = (e, set, n) => {
  for (const t of BODY.slice(0, n)) {
    const it = mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 });
    it.rarity = 'rare'; it.sigil = { set, party: 1, xp: 0 };
    e.items.push(it); equipItem(e, it);
  }
  return e;
};
let T = 0;
_setSetPowersClockForTests(() => T);
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); setPlayerDoor(null); T = 0;
  const v = { said: [], deaths: 0 };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: () => {} });
  setDeathPresenter(() => { v.deaths++; });
  return v;
}
const rat = () => makeEnemyEntity(0, ENEMY_BASICS[0], { ...stats(), attackModifierFlags: 0 }, 5, () => 0.5);
/** A rat's bite as the game deals one: the real attack formula (its tail marks the blow), then the host's door with the
 *  number its pool made of it - here a killing one, as an elite's slam stacked past a player's health. */
function bite(e, lands) {
  const r = rat();
  let dmg = 0;
  for (let i = 0; i < 20 && !(dmg > 0); i++) dmg = calculateAttackDamage(r, e, { rolls: () => 0.01 });
  assert.ok(dmg > 0, 'the bite lands');
  return hurtPlayer(e, lands);
}

test('FULL-GUARD: a foe\'s killing blow on a player at full health leaves them at 1 - no death; the next blow at 1 kills', () => {
  const v = fresh();
  const e = player();
  assert.equal(bite(e, 500), false, 'not a death');
  assert.equal(e.health, 1, 'left at 1');
  assert.equal(v.deaths, 0);
  assert.equal(bite(e, 500), true, 'at 1, the next blow kills as it always has');
  assert.equal(e.health, 0);
  assert.equal(v.deaths, 1);
});

test('FULL-GUARD: only from full, and only a foe\'s blow - one short of full dies; a fall, a spell or a poison\'s round from full (no blow\'s mark) kills as it did', () => {
  fresh();
  const hurt = player();
  hurt.health = 99;
  assert.equal(bite(hurt, 500), true, 'a point short of full: a death');
  const fell = player();
  assert.equal(hurtPlayer(fell, 500), true, 'a fall from full: no foe struck it, a death');
  const marked = player();
  setStruck({ name: 'rat' }, marked, 40);
  T += 1;   // past the mark's window: a later spell is not that blow
  assert.equal(hurtPlayer(marked, 500), true, 'a mark nobody took is no blow');
  const blown = player();
  assert.equal(bite(blown, 60), false);
  assert.equal(blown.health, 40, 'a blow that does not kill is untouched');
});

test('FULL-GUARD: the guard answers before any death save - Malacath\'s Unbroken is not spent on a blow from full, and is there for the next', () => {
  const v = fresh(); setSigilOnline(true); setSigilRenown(1);
  const e = wearSet(player(), 'malacath', 6);
  T = 1000;
  assert.equal(bite(e, 500), false);
  assert.equal(e.health, 1);
  assert.ok(!v.said.some((l) => /^Unbroken!/.test(l)), `Unbroken not spent (${v.said})`);
  T = 1001;
  assert.equal(bite(e, 500), false, 'at 1, the set\'s own save takes the next');
  assert.equal(e.health, 1);
  assert.ok(v.said.some((l) => /^Unbroken!/.test(l)), 'said');
});
