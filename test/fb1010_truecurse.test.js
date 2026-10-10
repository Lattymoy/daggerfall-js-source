// FIELD BUGS 2026-10-10 (bible/01-Overview/Field-Bugs-2026-10-10.md), TRUE-CURSE - the Discord's "True cursed item
// experience": "a super powerful sword that drains a ton of your hp ... cannot have their curse lifted". A DAMNED piece:
// one cursed Legendary weapon in DAMNED_IN, its curse line at the very top of its band, its drawback DFU's Health Leech:
// Whenever Used (8 health a strike, 16 a use), and no temple lifts it. Taking it off ends the bite, as any curse's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { liftRefusal, liftCurse, cursedKnown } from '../src/systems/lootCurse.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { PAYLOAD, doItemEnchantmentPayloads, LEECH_WEAPON_AMOUNT } from '../src/systems/enchantments.js';
import { itemFindings } from '../src/systems/itemLaw.js';
import { validLootItem } from '../src/systems/loot.js';
import { LIFT_REFUSALS, reforgeLabel } from '../src/ui/reforgeWindow.js';
import { seedTestLoot } from '../src/systems/testRoom.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';

const T = ENCHANTMENT_TYPES;
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setCurseForTests(null); LR._setExaltedForTests(null); };
const WEAPON = LR.LEGENDARIES.find((r) => r.group === 'Weapons');
const ARMOUR = LR.LEGENDARIES.find((r) => r.group === 'Armor');
const known = (it) => Object.assign(it, { isIdentified: true });
/** A Legendary of the record, CHOSEN through the door (applyRarity's one-record pool, as the Test Room mints them). */
const legendaryWeapon = () => LR.applyRarity(createWeapon(120, 1), 'legendary', () => 0, [WEAPON]);
const legendaryArmour = () => LR.applyRarity(mintCondition({ group: 'Armor', templateIndex: ARMOUR.templates?.[0] ?? 102, material: 0x0201, name: 'Cuirass', flags: 0 }), 'legendary', () => 0, [ARMOUR]);
/** Every draw `v` - the curse's own draws and its last, the damning. */
const all = (v) => () => v;
const lineBand = (it) => LR.AFFIX_RANGES[it.affixes.at(-1).id].legendary;

test('TRUE-CURSE: a Legendary weapon\'s curse is damned when its last draw falls in the top quarter - the line at the top of its band, the drawback Health Leech: Whenever Used', () => {
  on();
  assert.equal(LR.DAMNED_IN, 4);
  const damned = legendaryWeapon();
  assert.equal(LR.cursePiece(damned, all(0.75)), true);
  assert.deepEqual(damned.cursed, { type: T.HealthLeech, param: 0 });
  assert.equal(LR.isDamned(damned), true);
  assert.equal(damned.affixes.at(-1).value, lineBand(damned)[1], 'the very top of its band');
  assert.ok(damned.enchantments.some((e) => e.type === T.HealthLeech && e.param === 0), 'the bite is carried, as any curse\'s');
  const cursed = legendaryWeapon();
  LR.cursePiece(cursed, all(0.74));
  assert.equal(LR.isDamned(cursed), false, 'below the top quarter: a curse as LOOT16\'s');
  assert.ok(LR.CURSE_DRAWBACKS.some((r) => r.type === cursed.cursed.type), 'from the live table');
  for (const make of [() => legendaryArmour(), () => LR.applyRarity(mintCondition({ group: 'Weapons', templateIndex: 116, material: 0, name: 'Shortsword', flags: 0 }), 'rare', all(0.75))]) {
    const it = make();
    LR.cursePiece(it, all(0.99));
    assert.equal(LR.isDamned(it), false, `${it.rarity} ${it.group}: never damned - a Legendary weapon alone`);
  }
  const forced = legendaryWeapon();
  LR.cursePiece(forced, all(0), { damned: true });
  assert.equal(LR.isDamned(forced), true, 'the caller may decide it (the Test Room)');
  const spared = legendaryWeapon();
  LR.cursePiece(spared, all(0.99), { damned: false });
  assert.equal(LR.isDamned(spared), false);
});

test('TRUE-CURSE: one cursed Legendary weapon in four, over the pass\'s own draws', () => {
  on();
  LR._setCurseForTests(1);
  let damned = 0, n = 0, a = 7;
  const mulberry = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 4000; i++) {
    const it = legendaryWeapon();
    if (!LR.cursePass([it], mulberry).length) continue;
    n++;
    if (LR.isDamned(it)) damned++;
  }
  LR._setCurseForTests(null);
  assert.ok(n > 3900, 'every pass cursed');
  assert.ok(Math.abs(damned / n - 1 / LR.DAMNED_IN) < 0.03, `a quarter damned (${damned} of ${n})`);
});

test('TRUE-CURSE: the law stands behind a damned Legendary weapon, and behind no other piece carrying its row', () => {
  on();
  const damned = legendaryWeapon();
  LR.cursePiece(damned, all(0.9));
  assert.equal(LR.validCurse(damned), true);
  assert.ok(validLootItem(damned), 'a door\'s piece');
  assert.deepEqual(itemFindings(damned), [], 'the item law (online, and the account service) finds nothing');
  const onArmour = legendaryArmour();
  LR.cursePiece(onArmour, all(0.5));
  Object.assign(onArmour, { cursed: { type: T.HealthLeech, param: 0 }, enchantments: [...onArmour.enchantments.filter((e) => e !== onArmour.cursed), { type: T.HealthLeech, param: 0 }] });
  assert.equal(LR.validCurse(onArmour), false, 'a damned row on armour is no curse the pass makes');
  const bare = { ...damned, enchantments: damned.enchantments.filter((e) => !(e.type === T.HealthLeech && e.param === 0)) };
  assert.equal(LR.validCurse(bare), false, 'a damned mark with no bite carried');
});

test('TRUE-CURSE: it bites every blow - the wielder pays 8 health a strike - and no temple lifts it; known, it is "Damned Legendary"', () => {
  on();
  const damned = legendaryWeapon();
  LR.cursePiece(damned, all(0.9));
  let bitten = 0;
  doItemEnchantmentPayloads(PAYLOAD.Strikes, damned, { entity: { isPlayer: true }, target: { mobileType: 0 }, damage: 20, ctx: { hurtSelf: (n) => { bitten += n; } } });
  assert.equal(bitten, LEECH_WEAPON_AMOUNT);
  assert.equal(LEECH_WEAPON_AMOUNT, 8, 'HealthLeech.cs:30');
  const payer = { isPlayer: true, items: [damned], goldPieces: 1_000_000 };
  assert.equal(liftRefusal(damned, payer), 'unknown', 'unknown, it is said to be nothing');
  assert.equal(LR.tierLabel(damned), 'Legendary');
  known(damned);
  assert.equal(LR.tierLabel(damned), 'Damned Legendary');
  assert.deepEqual(cursedKnown(payer.items), [damned], 'the temple sees it...');
  assert.equal(liftRefusal(damned, payer), 'damned', '...and will not lift it');
  assert.deepEqual(liftCurse(damned, payer), { ok: false, reason: 'damned' });
  assert.equal(LR.isDamned(damned), true, 'the curse stands');
  assert.equal(payer.goldPieces, 1_000_000, 'and nothing is taken');
  assert.equal(LIFT_REFUSALS.damned, 'Damned - no temple can lift this curse');
  assert.equal(reforgeLabel('damned', { shards: 0, gold: 0 }, { shards: 0, gold: 0 }, 'Lift'), 'Damned');
  const plain = known(legendaryWeapon());
  LR.cursePiece(plain, all(0.5));
  assert.equal(LR.tierLabel(plain), 'Cursed Legendary', 'a curse as LOOT16\'s keeps its word');
  assert.equal(liftRefusal(plain, payer), null, 'and the temple lifts it');
});

test('TRUE-CURSE: the Test Room lays a damned Legendary weapon, known, after every draw it made - its cursed Legendary stays LOOT16\'s', () => {
  on();
  const entity = { items: [], equipTable: {} };
  seedTestLoot(entity, all(0.9));
  const damned = entity.items.filter((it) => LR.isDamned(it));
  assert.equal(damned.length, 1);
  assert.equal(damned[0].group, 'Weapons');
  assert.equal(LR.tierLabel(damned[0]), 'Damned Legendary', 'known');
  assert.equal(entity.items.at(-1), damned[0], 'last');
  assert.ok(entity.items.some((it) => LR.isCursed(it) && it.rarity === 'legendary' && !LR.isDamned(it)), 'the cursed Legendary beside it');
});
