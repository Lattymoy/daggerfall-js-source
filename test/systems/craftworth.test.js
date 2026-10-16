// CRAFT-WORTH (2026-10-11, the exploit audit the owner asked for: "insane gold farms"; Economy-Arc principle 5, "What an
// NPC pays for a crafted piece is capped, or smithing prints gold", and its Phase 2, "Cap what an NPC pays for a crafted
// piece"). A crafted piece's quality rolls a tier onto it (smithItems.js mintPiece: a Superior's Magic, a Masterwork's
// Rare) whose lines applyRarity priced into its value - and every counter paid that value, at a shop whose gold never
// runs out: a Masterwork staff of three pine planks sold for ~1,280 gold where the plain staff fetches 6 (~79k gold an
// hour of chopping, sawing and crafting; ~320k at the service's own throttle), and a patron's cap paid ~1,200 of the
// service's own gold for a Masterwork Iron Dagger a found one of which is worth 3. The roll is the piece's POWER, never
// a counter's price: every selling arm and the patron's worth read the piece as the plain one its recipe makes.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintPiece, temperItem } from '../../src/systems/smithItems.js';
import { tradeCost, getTradePrice, counterValueOf } from '../../src/systems/tradeModes.js';
import { craftedRarityWorth, applyRarity, rareEnchantWorth } from '../../src/systems/loot/lootRarity.js';
import { itemValueOf } from '../../src/systems/item/itemTemplates.js';
import { itemWorth, itemFindings } from '../../src/systems/item/itemLaw.js';
import { patronWorth } from '../../src/net/patronLaw.js';

const PROV = '0123456789abcdef';
const SKILLS = { mercantile: 50, personality: 50 };
const sale = (it, mode = 'Sell') => getTradePrice(mode, tradeCost(mode, [it], { quality: 20, priceAdjustment: 1000 }).cost, 20, SKILLS);
const mint = (recipe, quality, seed) => mintPiece({ recipe, quality, seed }, PROV);

test('CRAFT-WORTH a counter pays a Superior or Masterwork piece what it pays the plain piece its recipe makes - Sell and SellMagic both - while the piece keeps its value, its tier and its lines (mutants: the roll left in the Sell arm; in SellMagic; the share never taken)', () => {
  for (const recipe of ['staff:pine', 'dagger:iron', 'ring:silver', 'garment-141:linen', 'cuirass:iron']) {
    const plain = sale(mint(recipe, 1, 1));
    for (const quality of [3, 4]) {
      for (let seed = 1; seed <= 40; seed++) {
        const it = mint(recipe, quality, seed * 7919);
        assert.ok(it.rarity === 'magic' || it.rarity === 'rare', `${recipe} q${quality}: its quality rolled a tier`);
        assert.ok(itemValueOf(it) > counterValueOf(it), `${recipe} q${quality}: its value keeps the roll`);
        assert.equal(sale(it), plain, `${recipe} q${quality} seed ${seed}: sold at the plain piece's price`);
        assert.equal(sale(it, 'SellMagic'), sale(mint(recipe, 1, 1), 'SellMagic'), `${recipe} q${quality}: fenced at it too`);
      }
    }
  }
});

test('CRAFT-WORTH the share is the roll\'s alone: a found Rare (no provenance) still sells on its whole value, a crafted piece its quality rolled nothing onto is untouched, and the share is exactly what applyRarity added (mutants: the provenance test dropped; a share taken off a Fine piece)', () => {
  const found = mint('dagger:iron', 1, 3);
  delete found.provenance;
  applyRarity(found, 'rare', () => 0.5);
  assert.equal(craftedRarityWorth(found), 0, 'a found Rare is no craft');
  assert.equal(counterValueOf(found), itemValueOf(found), 'and sells on its own value, as it always has');
  const fine = mint('dagger:iron', 2, 3);
  assert.equal(craftedRarityWorth(fine), 0, 'a Fine piece rolled nothing');
  assert.equal(counterValueOf(fine), itemValueOf(fine));
  const mw = mint('dagger:iron', 4, 3);
  const bare = mint('dagger:iron', 1, 3);
  assert.equal(counterValueOf(mw), itemValueOf(bare), 'a Masterwork\'s counter worth is the plain dagger\'s value');
});

test('CRAFT-WORTH a patron pays a crafted piece no more than the piece it was made as - its marks AND what its quality rolled taken off (mutants: the rolled lines left on the patron\'s plain piece)', () => {
  for (const recipe of ['dagger:iron', 'staff:pine', 'ring:silver']) {
    const plain = patronWorth(mint(recipe, 1, 1), itemWorth);
    for (let seed = 1; seed <= 20; seed++) {
      const it = mint(recipe, 4, seed * 104729);
      assert.ok(itemWorth(it) > plain * 10, `${recipe}: the judge still reads the Masterwork's lines (${itemWorth(it)})`);
      assert.equal(patronWorth(it, itemWorth), plain, `${recipe} seed ${seed}: a patron's worth is the plain piece's`);
    }
  }
});

test('CRAFT-WORTH the keyed shelf (the counter with no trade art) prices a sale through the window\'s own walk and sells no conjured piece (mutants: the keyed sale off the walk; a conjured piece listed; one sold)', () => {
  const wm = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const fn = (name) => { const at = wm.indexOf(`function ${name}(`); return wm.slice(at, wm.indexOf('\n  }\n', at)); };
  assert.match(fn('sellPrice'), /const lot = tradeCost\('Sell', \[it\], \{ quality: b\.quality, priceAdjustment: shopAdjustment\(b, 'Sell'\) \}\);\n\s*return getTradePrice\('Sell', lot\.cost, b\.quality, /);
  assert.match(fn('showSellList'), /&& !isSummoned\(it\)\);/);
  assert.match(fn('doSell'), /\n\s*if \(isSummoned\(it\)\) return 0;/);
});

test('AUDIT CRAFT-WORTH a FOUND piece tempered keeps its patron worth (a temper writes `quality`, a craft mark, onto it - only a crafted piece loses its roll), a crafted piece with no value of its own is priced at its base untouched, and a malformed line list is no throw (mutants: the strip on any marked piece; the roll off the base; the list unguarded)', () => {
  const found = mint('dagger:iron', 1, 3);
  for (const k of ['provenance', 'quality', 'recipe']) delete found[k];
  applyRarity(found, 'rare', () => 0.5);
  const before = patronWorth(found, itemWorth);
  assert.ok(before > 1000, `a found Rare's patron worth (${before})`);
  assert.equal(temperItem(found, { quality: 2 }), true, 'tempered to Fine, by the real producer');
  assert.equal(found.quality, 2);
  assert.deepEqual(itemFindings(found), [], 'a lawful piece');
  assert.equal(patronWorth(found, itemWorth), before, 'its lines are its own - the patron still reads them');
  const mw = mint('staff:pine', 4, 7919);
  const bare = mint('staff:pine', 1, 7919);
  assert.equal(counterValueOf({ ...mw, value: NaN }), itemValueOf({ ...bare, value: NaN }), 'no value: the base, nothing taken off it');
  assert.equal(counterValueOf({ ...mw, value: undefined }), itemValueOf({ ...bare, value: undefined }));
  assert.equal(counterValueOf({ ...mw, value: 5 }), 1, 'a value under its roll (a record written low) sells for a gold, never a debt');
  assert.equal(craftedRarityWorth({ ...mw, affixes: {} }), rareEnchantWorth(mw), 'a malformed list is worth nothing, never a throw');
  assert.ok(Number.isFinite(sale({ ...mw, affixes: {} })), 'and the Sell walk still totals');
});
