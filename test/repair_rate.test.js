// REPAIR-RATE and KIT-CEILING (2026-10-01, the economy arc - bible/06-Systems/Economy-Arc.md, set from its confirmed
// intent: repairs "exist to limit outings and force planning. Their function is not to remove money from the economy";
// field repair stays partial). A repair costs a third of Daggerfall's price (REPAIR-EASE had two thirds); no kit - a
// field kit or a smith's - mends a piece past three quarters of its condition, and a kit that has nothing below them
// to mend says a smith can do the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateItemRepairCost, dfuItemRepairCost, REPAIR_COST_SCALE } from '../src/systems/repairService.js';
import { _resetModSettings, setModSetting } from '../src/systems/modSettings.js';
import {
  mintFieldRepairKit, mintPiece, useRepairKit, repairKitUse, repairKitTargets, kitCeiling, KIT_CEILING_TEXT, installSmithing,
} from '../src/systems/smithItems.js';
import { KIT_CEILING, pieceLines } from '../src/net/recipeLaw.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { reducedRepairCost } from '../src/systems/guildServices.js';
import { GUILDS } from '../src/systems/guilds.js';
import { useItem } from '../src/systems/useItem.js';
import { conditionPercentage } from '../src/systems/itemTemplates.js';
import { setHotbarSlot, hotbarEntryForItem, hotbarPress, useQuickslot } from '../src/systems/quickslots.js';
import { readFileSync } from 'node:fs';

installSmithing();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
const pct = (item) => Math.round(item.currentCondition / item.maxCondition * 100);

test('REPAIR-RATE: a repair is a third of Daggerfall\'s price - a broken Daedric longsword 9,216 at a quality-10 smith, a fifth of its asking price; DFU\'s flat tenth a third too (mutants: the scale back at two thirds)', () => {
  assert.equal(REPAIR_COST_SCALE, 1 / 3);
  _resetModSettings();
  // Roleplay & Realism: Items' damage-scaled price (on as shipped): 0.6 of the value for a broken piece, through CalculateCost
  assert.equal(dfuItemRepairCost(23040, 10, 0, 6400, { instantRepairs: false }), 27648);
  assert.equal(calculateItemRepairCost(23040, 10, 0, 6400), 9216);
  assert.equal(calculateItemRepairCost(23040, 10, 3200, 6400), 4608, 'half the damage, half the price');
  // the mod off: DFU's own flat tenth, a third of it
  setModSetting('roleplay-realism-items', 'conditionBasedPrices', false);
  try {
    assert.equal(calculateItemRepairCost(23040, 10, 6000, 6400), Math.round(dfuItemRepairCost(23040, 10, 6000, 6400, { instantRepairs: false }) / 3));
  } finally { _resetModSettings(); }
  assert.equal(calculateItemRepairCost(1, 1, 99, 100), 1, 'Daggerfall\'s least, 2: a third of it rounds to 1');
  assert.equal(calculateItemRepairCost(300, 10, 1000, 1000), 0, 'nothing at full condition');
  // AUDIT ECON R4: the guild's discount comes BEFORE the third, and the floor holds under it
  const fg = (rank) => (p) => reducedRepairCost(GUILDS.FightersGuild, { rank }, p);
  assert.equal(dfuItemRepairCost(1, 1, 99, 100, { instantRepairs: false, reducedRepairCost: fg(5) }), 1, 'a rank-5 member\'s Daggerfall price: 1');
  assert.equal(calculateItemRepairCost(1, 1, 99, 100, { reducedRepairCost: fg(5) }), 1, '...a third of which rounds to nothing - and a repair costs a gold piece at least');
  const discounted = dfuItemRepairCost(1000, 10, 0, 6400, { instantRepairs: false, reducedRepairCost: fg(3) });
  assert.equal(discounted, 839);
  assert.equal(calculateItemRepairCost(1000, 10, 0, 6400, { reducedRepairCost: fg(3) }), 280, 'a third of the discounted 839 - never the discount of a third (279)');
});

test('KIT-CEILING: no kit mends a piece past three quarters - 60% to 75%, 70% to 75%, 50% to 65%; a piece at three quarters or more is no kit\'s, and the refusal says a smith can do the rest (mutants: the ceiling at whole; the targets unfiltered; the cap dropped; the refusal dropped)', () => {
  assert.equal(KIT_CEILING, 0.75);
  const sword = () => weaponOfMaterial(120, 4);
  for (const [from, to] of [[60, 75], [70, 75], [50, 65]]) {
    const kit = mintFieldRepairKit();
    const piece = at(sword(), from);
    useRepairKit(kit, [kit, piece]);
    assert.equal(pct(piece), to, `a field kit: ${from}% to ${to}%`);
    assert.ok(piece.currentCondition <= kitCeiling(piece));
  }
  // a smith's kit: a quarter, and the same ceiling
  const smith = mintPiece({ recipe: 'kit:dwarven', quality: -1, seed: 1 }, '0000000000000001');
  const worn = at(sword(), 60);
  useRepairKit(smith, [smith, worn]);
  assert.equal(worn.currentCondition, kitCeiling(worn), 'a smith\'s quarter stops at three quarters too');
  // at three quarters or more: no kit's
  const kit = mintFieldRepairKit();
  const keen = at(sword(), 80), edge = at(sword(), 75);
  assert.deepEqual(repairKitTargets(kit, [kit, keen, edge]), []);
  const items = [kit, keen, edge];
  assert.deepEqual(repairKitUse(kit, items), { kind: 'repairKit', text: KIT_CEILING_TEXT, refused: true });
  assert.equal(KIT_CEILING_TEXT, 'A kit mends nothing past three quarters. A smith can do the rest.');
  assert.ok(items.includes(kit), 'and the kit is kept');
  // whole pieces: the old refusal stands
  const whole = mintFieldRepairKit();
  assert.deepEqual(repairKitUse(whole, [whole, at(sword(), 100)]), { kind: 'repairKit', text: 'Nothing here wants mending.', refused: true });
  // AUDIT ECON R4/R5: the ceiling is ROUNDED DOWN - an Iron Dagger's 50 stopped at 37 (74%), never 38 (76%, the sharp
  // band), and at 37 it is refused in words that do not say 75%. WEAPON-POOL (2026-10-06): every weapon's pool is a
  // multiple of four now, at any material and quality (AUDIT WEAPON-POOL P9: 400 per step of the ladder, and the smith's
  // 0.75, 1.15 and 1.3 of that), so three quarters of one is whole; a smith's Fine Buckler (512 x
  // 1.15 = 588.8, so 589) is a piece whose three quarters is not - it stops at 441 (74.9%), never 442
  const buckler = mintPiece({ recipe: 'buckler:iron', quality: 2, seed: 1 }, '0000000000000001');
  assert.equal(buckler.maxCondition, 589);
  assert.equal(kitCeiling(buckler), 441);
  buckler.currentCondition = 354;   // 60%
  const dk = mintFieldRepairKit();
  assert.equal(repairKitUse(dk, [dk, buckler]).text, 'The Buckler is mended: 60% to 74%.', 'a field kit\'s 89 would take it to 443');
  assert.equal(buckler.currentCondition, 441);
  const dk2 = mintFieldRepairKit();
  assert.equal(repairKitUse(dk2, [dk2, buckler]).text, KIT_CEILING_TEXT);
});

test('KIT-CEILING: one piece to mend while the ceiling holds another back still asks - one row, and Keep (AUDIT ECON R1: a worn cuirass at 80% and a flail carried to sell at 20%, and the kit went on the flail unasked); one piece alone is mended, unasked (mutants: the lone row never asked; always asked)', () => {
  const cuirass = at(weaponOfMaterial(120, 9), 80); cuirass.equipSlot = 0;
  const flail = at(weaponOfMaterial(125, 0), 20);
  const kit = mintFieldRepairKit();
  const items = [kit, cuirass, flail];
  const ask = useItem(kit, items, { chooseTarget: true });
  assert.equal(ask.kind, 'chooseTarget');
  assert.deepEqual(ask.targets, [flail], 'the flail alone is the kit\'s');
  assert.ok(items.includes(kit), 'asked, not spent');
  const alone = mintFieldRepairKit();
  const lone = [alone, at(weaponOfMaterial(125, 0), 20)];
  assert.equal(useItem(alone, lone, { chooseTarget: true }).kind, 'repairKit', 'nothing held back: the one piece is mended');
  assert.equal(lone.includes(alone), false);
});

test('KIT-CEILING: a kit gives a piece more than a hundredth of its condition or passes it by - a sword a kit took to the ceiling and a blow knocked a point under it is not the first a kit reaches for (AUDIT ECON R2: "mended: 75% to 75%", a whole kit, a flail at 20% beside it); the rows read the card\'s percentage (mutants: the hundredth dropped; a rounded label)', () => {
  const sword = weaponOfMaterial(120, 9); sword.equipSlot = 0;
  sword.currentCondition = kitCeiling(sword) - 1;
  const flail = at(weaponOfMaterial(125, 0), 20);
  const kit = mintFieldRepairKit();
  assert.deepEqual(repairKitTargets(kit, [kit, sword, flail]), [flail], 'the sword a point under: nothing to give');
  sword.currentCondition = kitCeiling(sword) - Math.floor(sword.maxCondition / 100) - 1;
  assert.deepEqual(repairKitTargets(kit, [kit, sword, flail]), [sword, flail], 'more than a hundredth under: the worn sword first again');
  const items = [kit, sword, flail];
  sword.currentCondition = kitCeiling(sword) - 1;
  assert.equal(useItem(kit, items, {}).text, 'The Iron Flail is mended: 20% to 35%.', 'the quick keys take the flail');
  // the chooser's row and the card read one percentage - DFU's, truncated
  const card = weaponOfMaterial(120, 9); card.equipSlot = 0;
  card.currentCondition = Math.round(card.maxCondition * 0.735);   // 9408 of 12800: 73.5% - the card's 73, a rounding's 74
  const k2 = mintFieldRepairKit();
  const ask = useItem(k2, [k2, card, at(weaponOfMaterial(125, 0), 20)], { chooseTarget: true });
  assert.equal(ask.targets[0], card);
  assert.deepEqual([conditionPercentage(card), ask.labels[0]], [73, 'Daedric Longsword 73% (worn)']);
  // and the mend's own words: 4160 of 12800 is 32.5%, a field kit's 1920 more 47.5% - the card's 32 and 47 (WEAPON-POOL:
  // a Daedric Longsword's pool was 6400, and the same shares were 2080 and 960)
  const k3 = mintFieldRepairKit();
  const half = weaponOfMaterial(120, 9); half.currentCondition = 4160;
  assert.equal(useItem(k3, [k3, half], {}).text, 'The Daedric Longsword is mended: 32% to 47%.');
});

test('KIT-CEILING: a kit used from a wagon reads the player\'s own pack for its refusal - all at three quarters or more: the ceiling\'s words, never "nothing wants mending" (AUDIT ECON R4; mutants: the list the kit lives in read)', () => {
  const kit = mintFieldRepairKit();
  const wagon = [kit];
  const pack = [at(weaponOfMaterial(120, 4), 80)];
  assert.deepEqual(useItem(kit, wagon, { localItems: pack }), { kind: 'repairKit', text: KIT_CEILING_TEXT, refused: true });
  assert.ok(wagon.includes(kit), 'the kit stays in the wagon');
});

test('KIT-CEILING: on the hotbar a kept kit is a refusal - said once, and never the gold strike of a use (AUDIT ECON R3; mutants: the refusal unflagged; the slot silent)', () => {
  const sword = at(weaponOfMaterial(120, 9), 80); sword.equipSlot = 0;
  const kit = mintFieldRepairKit();
  const entity = { items: [kit, sword], spells: [] };
  setHotbarSlot(0, hotbarEntryForItem(kit));
  const said = [];
  const say = (t) => said.push(t);
  const res = hotbarPress(0, { entity, say, doors: { quickUse: () => useQuickslot('c1', { entity, items: entity.items, say }) } });
  assert.equal(res.kind, 'refused');
  assert.deepEqual(said, [KIT_CEILING_TEXT]);
  assert.ok(entity.items.includes(kit), 'kept');
  setHotbarSlot(0, null);
});

test('KIT-CEILING: what a kit says it does - the tooltip lines and the smithing page name the ceiling (mutants: a line without it)', () => {
  assert.deepEqual(pieceLines(mintFieldRepairKit()), ['Mends 15% of a weapon\'s or armour\'s condition, up to 75%, once']);
  assert.deepEqual(pieceLines({ kitMetal: 4, provenance: '0123456789abcdef' }), ['Mends a quarter of a Dwarven piece\'s condition, up to 75%, once']);
  assert.match(rd('src/ui/profPages.js'), /A Repair Kit mends a quarter of a piece\\'s condition, up to three quarters, once/);
});
