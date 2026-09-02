// L-slice (AUDIT 23 entity-9 / items-9 / combat-16): three small
// laws - one Level++ per acknowledgment, the pickup encumbrance
// gate in GP-unit arithmetic, and the material-ineffective HUD line.
// (entity-7 was REFUTED - the rest catch-up already runs per game
// minute under the 2880 cap; see the Port-Ledger.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canHoldAmount, weightInGPUnits, effectiveUnitWeightInKg, itemWeight, totalWeight, goldStack } from '../src/systems/inventory.js';
import { maxEncumbrance, calculateAttackDamage, MATERIAL_INEFFECTIVE_TEXT } from '../src/combat/formulas.js';
import { checkForLevelUp } from '../src/systems/advancement.js';
import { NativeInventoryWindow, CANNOT_CARRY_TEXT } from '../src/ui/nativeInventory.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('littlelaws items-9: ComputeCanHoldAmount - GP units, integer division, the weightless pass', () => {
  // a GOLD-PIECE unit is 0.0025 kg -> exactly 1 GP unit
  assert.equal(weightInGPUnits(0.0025), 1);
  assert.equal(weightInGPUnits(75), 30000);
  // STR 50 -> capacity 75 kg; carrying 74.9975 leaves ONE gold piece
  assert.equal(maxEncumbrance(50), 75);
  assert.equal(canHoldAmount(100000, 0.0025, 75, 74.9975), 1);
  // at capacity: zero fit; over: negative (the caller's <=0 refusal)
  assert.equal(canHoldAmount(100000, 0.0025, 75, 75), 0);
  assert.ok(canHoldAmount(10, 0.0025, 75, 80) <= 0, 'an over-capacity load refuses');
  // integer division: 0.8 kg of room takes ONE 0.5 kg dagger, not 1.6
  assert.equal(canHoldAmount(5, 0.5, 75, 74.2), 1);
  // a weightless unit never binds - the whole stack fits
  assert.equal(canHoldAmount(5, 0, 75, 9999), 5);
  // the horse template is hasNoEncumbrance: EFFECTIVE weight 0 (the
  // gate + the sum), while the raw template weight stays for display
  assert.equal(effectiveUnitWeightInKg({ templateIndex: 94 }), 0);
  assert.equal(itemWeight({ templateIndex: 94, stackCount: 1 }), 0);
  // and the sum multiplies the EFFECTIVE weight by the stack
  assert.equal(totalWeight([goldStack(400)]), 1, '400 gold = 1 kg');
});

test('littlelaws items-9: the window gate - refuse at zero fit, split-take a partial stack', () => {
  // STR 20 -> capacity 30 kg; the bag holds 29.75 kg of gold
  const entity = { stats: { strength: 20 }, items: [] };
  const bag = entity.items;
  bag.push(goldStack(11900));   // 29.75 kg
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };   // 0.5 kg
  const loot = [dagger, goldStack(300)];   // 0.75 kg of coins
  const w = new NativeInventoryWindow({ items: () => bag, entity, icons: ICONS, loot: { items: () => loot } });
  w.mode = 'remove';
  // the dagger (200 GP units) cannot fit the 100 GP units of room
  w._pickRemote(0);
  assert.equal(loot.length, 2, 'the refused item stays in the pile');
  assert.equal(bag.length, 1, 'and nothing landed in the bag');
  assert.equal(w.topBox?.rows?.[0]?.text, CANNOT_CARRY_TEXT, 'CanCarryAmount says so (key cannotCarryAnymore)');
  w._dismissBox();
  // the 300-coin stack partially fits: TAKE exactly the 100 that do
  // (TransferItem's split popup defaults to maxAmount - the Enter path)
  w._pickRemote(1);
  assert.equal(loot[1].stackCount, 200, 'the pile keeps what did not fit');
  assert.equal(bag[0].stackCount, 12000, 'the bag merged the 100 that did');
  assert.equal(totalWeight(bag), 30, 'the load is AT capacity now');
  // ...and the next coin refuses
  w._pickRemote(1);
  assert.equal(loot[1].stackCount, 200);
  assert.equal(w.topBox?.rows?.[0]?.text, CANNOT_CARRY_TEXT);
  // no entity on the hooks (bare loot-window tests): the gate stands open
  const open = new NativeInventoryWindow({ items: () => [], icons: ICONS, loot: { items: () => [{ group: 'Weapons', templateIndex: 113 }] } });
  open.mode = 'remove';
  open._pickRemote(0);
  assert.equal(open.topBox, null);
});

test('littlelaws combat-16: a too-low weapon material says so for the PLAYER, silently for foes', () => {
  const said = [];
  const weapon = { group: 'Weapons', templateIndex: 113, material: 1 };   // steel
  const n = calculateAttackDamage({ isPlayer: true }, { minMetalToHit: 2 }, { weapon, say: (l) => said.push(l) });
  assert.equal(n, 0, 'the material gate returns 0 damage');
  assert.deepEqual(said, [MATERIAL_INEFFECTIVE_TEXT], 'the HUD line fires once (FormulaHelper.cs:576-583)');
  // and the line is the ROW, not our paraphrase (Internal_Strings.csv:56)
  assert.deepEqual(said, ['The material of the weapon you are using is ineffective.']);
  // an enemy swinging the same weapon fails SILENTLY (attacker == player gate)
  const said2 = [];
  assert.equal(calculateAttackDamage({ isPlayer: false }, { minMetalToHit: 2 }, { weapon, say: (l) => said2.push(l) }), 0);
  assert.deepEqual(said2, []);
  // a material that meets the bar passes the gate (into the real roll)
  const said3 = [];
  const hit = calculateAttackDamage({ isPlayer: true, stats: {}, skills: [] }, { minMetalToHit: 1, stats: {}, skills: [] },
    { weapon, say: (l) => said3.push(l), rolls: () => 0, dfRand: () => 0 });
  assert.deepEqual(said3, [], 'no refusal line when the metal bites');
  assert.equal(typeof hit, 'number');
});

test('littlelaws entity-9: CheckForLevelUp - raise while behind, one step pending, quiet at par', () => {
  // level 2 with sums that calculate to 3: raise, offering LEVEL 3
  const e = { level: 2, startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 117 };
  assert.equal(checkForLevelUp(e), true);
  assert.equal(e.readyToLevelUp, true);
  assert.equal(e.pendingLevel, 3, 'one step - the banner never jumps ahead');
  // at par: false and UNTOUCHED
  const par = { level: 3, startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 117 };
  assert.equal(checkForLevelUp(par), false);
  assert.ok(!par.readyToLevelUp);
});
