// FIELD BUGS 2026-10-16c (MAKER-KEPT) - Flylighter, "Grandfathered Items triggering trade lock": "Enchanted a few pieces
// of Ruhn's set back before the change that disallowed enchanting them. Now, I'm getting a trade lock notice on account
// of my gear!", then "I've been wrongly trade-locked for a week". AETHERIC-MAKER (2026-10-03) closed the item maker to an
// Aetheric piece and promised "A piece enchanted before keeps its rows" (Field-Bugs-2026-10-03b); INT1's item law (law 5)
// held every Aetheric piece to no rows at all, so the realm's judge read those pieces as forged and held their owners'
// trade. Law 6: a piece of a record the maker took then (Ruhn's Regalia, the raiding parties' three sets) keeps the
// maker's rows, held to the maker's own law; everything else the law caught, it still catches. The pieces are the real
// producers': aetheric.js mintAetheric, and enchanting.js applyEnchantments - the item maker's write, as it ran before the
// refusal (the refusal itself is enchanting.js itemMakerRefuses, pinned by fb1003b_aethericmaker).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemFindings, lawfulItem, ITEM_LAW_VERSION } from '../../../src/systems/item/itemLaw.js';
import { mintAetheric, REGALIA, RAID_SET_PIECES, SERPENT_SET_PIECES, NUMIDIUM_SET_PIECES } from '../../../src/systems/aetheric.js';
import { applyEnchantments, itemMakerRefuses } from '../../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../../src/systems/enchantmentCatalogue.js';

const copy = (v) => JSON.parse(JSON.stringify(v));
/** A piece of record `r` as the item maker left it before AETHERIC-MAKER: a row any piece takes and a drawback that pays
 *  for it (a raiding party's pauldrons and greaves have the power of 50 and 62 - the maker's budget, which a kept piece is
 *  still held to). */
const enchanted = (r, rows = [enchantmentSettings('FeatherWeight', -1), enchantmentSettings('BadReactionsFrom', 1)]) => {
  const item = mintAetheric(r);
  applyEnchantments(item, rows);
  return item;
};
/** The records of the maker's era, by id - frozen as they stood at AETHERIC-MAKER (d10bd32b81): Ruhn's nine, then the
 *  Broken Oath, the Thief-Taker's Garb and Orcsbane Harness, nine each. A record added later is none of them. */
const MAKER_ERA = [
  'ruhn-horned-crown', 'ruhn-right-pauldron', 'ruhn-left-pauldron', 'ruhn-warden-plate', 'ruhn-brand-gauntlets', 'ruhn-greaves', 'ruhn-cinder-boots', 'ruhn-gate-shield', 'ruhn-gatecleaver',
  'oath-helm', 'oath-right-pauldron', 'oath-left-pauldron', 'oath-cuirass', 'oath-gauntlets', 'oath-greaves', 'oath-boots', 'oath-kite-shield', 'oath-longsword',
  'thieftaker-helm', 'thieftaker-right-pauldron', 'thieftaker-left-pauldron', 'thieftaker-cuirass', 'thieftaker-gauntlets', 'thieftaker-greaves', 'thieftaker-boots', 'thieftaker-buckler', 'thieftaker-saber',
  'orcsbane-helm', 'orcsbane-right-pauldron', 'orcsbane-left-pauldron', 'orcsbane-cuirass', 'orcsbane-gauntlets', 'orcsbane-greaves', 'orcsbane-boots', 'orcsbane-round-shield', 'orcsbane-mace',
];

test('MAKER-KEPT: the report, answered - every piece of the maker\'s era, enchanted as the maker did then, carries no finding in the save or on the market; law 6 (mutants: the kept rows refused; the maker\'s law refusing the era)', () => {
  assert.equal(ITEM_LAW_VERSION, 12);   // PIN MOVED (GUNS-UNFOUND): law 12 - the Hourlock lawful as a gilded Dwarven Long Bow and as the Thunderlock minted before, the Sunken Sovereign as the Ebony Saber again and as the Pistolet minted between; PIN MOVED (SEA-SET): law 11 - the Eltheric Tidemail's nine records lawful (law 10 on its branch, renumbered past PISTOLET's at the merge); PIN MOVED (PISTOLET, AUDIT PISTOLET): law 10 - the Pistolet known, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; PIN MOVED (SOUL-LAW, FIELD BUGS 2026-10-20h): law 9 - a soul of Daggerfall Enemy Expansion's fifty lawful in a Soul Gem or Azura's Star; PIN MOVED (WITCH1): law 8 - the Soul Cake and the Hearth Offering; PIN MOVED (KEY-LAW): law 7 - the Weir Key known to the service's law; the era's pieces lawful from law 6 on
  assert.deepEqual([...REGALIA, ...RAID_SET_PIECES].map((r) => r.id), MAKER_ERA, 'the era\'s records, as they stood');
  for (const r of [...REGALIA, ...RAID_SET_PIECES]) {
    assert.deepEqual(itemFindings(mintAetheric(r)), [], `${r.id}: fresh`);
    const item = enchanted(r);
    assert.ok(item.enchantments.length && item.enchantments.every((e) => e.enchantCost !== undefined), `${r.id}: the maker's rows`);
    assert.deepEqual(itemFindings(item), [], `${r.id}: enchanted before the refusal - kept`);
    assert.deepEqual(itemFindings(copy(item)), [], `${r.id}: as it rides the wire`);
    assert.equal(lawfulItem(item), true, `${r.id}: the market takes it`);
  }
  // the refusal stands: the maker lays no new row on one
  assert.equal(itemMakerRefuses(mintAetheric(REGALIA[0])), true);
});

test('MAKER-KEPT: what the law caught it still catches - a row no maker laid, the maker\'s law broken, a cost lied, a later set\'s piece enchanted, a roll\'s mark (mutants: the era read off every record; the maker\'s law skipped on a kept piece; a found row kept)', () => {
  const cleaver = REGALIA.find((r) => r.id === 'ruhn-gatecleaver');
  assert.deepEqual(itemFindings(enchanted(cleaver, [enchantmentSettings('PotentVs', 1)])), [], 'the Gatecleaver as the report\'s: a weapon\'s row, kept');
  const own = enchanted(cleaver);
  own.enchantments = [{ type: own.enchantments[0].type, param: own.enchantments[0].param }];
  assert.deepEqual(itemFindings(own), ['aetheric', 'enchantments'], 'a row no maker laid (no enchantCost)');
  const mixed = enchanted(cleaver);
  mixed.enchantments.push({ type: mixed.enchantments[0].type, param: 2 });
  assert.ok(itemFindings(mixed).includes('aetheric'), 'a found row beside the maker\'s');
  const twice = enchanted(cleaver, [enchantmentSettings('PotentVs', 1), enchantmentSettings('PotentVs', 1)]);
  assert.deepEqual(itemFindings(twice), ['enchantments'], 'one of a kind where the kind allows one - the maker\'s law, held on a kept piece');
  const over = enchanted(cleaver, Array.from({ length: 10 }, (_, i) => enchantmentSettings('RegensHealth', i % 3)));
  assert.ok(itemFindings(over).includes('enchantments'), 'past the piece\'s power, or past a kind\'s one');
  const plate = REGALIA.find((r) => r.group === 'Armor');
  const shield = enchanted(plate, [enchantmentSettings('PotentVs', 1)]);
  assert.deepEqual(itemFindings(shield), ['enchantments'], 'a weapon\'s effect on armour');
  for (const r of [SERPENT_SET_PIECES[0], NUMIDIUM_SET_PIECES[0]]) {
    const late = enchanted(r);
    assert.deepEqual(itemFindings(late), ['aetheric', 'enchantments'], `${r.id}: a set from after the refusal - no maker ever laid a row on it`);
  }
  const marked = enchanted(cleaver);
  marked.exalted = true;
  assert.deepEqual(itemFindings(marked), ['aetheric'], 'a roll\'s mark on a record');
  const forged = enchanted(cleaver);
  forged.sigil = { ...forged.sigil, set: 'oath' };
  assert.ok(itemFindings(forged).includes('aetheric'), 'its record\'s set moved');
  const thin = enchanted(plate, [enchantmentSettings('FeatherWeight', -1)]);
  const pauldron = enchanted(RAID_SET_PIECES.find((r) => r.id === 'oath-right-pauldron'), [enchantmentSettings('FeatherWeight', -1)]);
  assert.deepEqual([itemFindings(thin), itemFindings(pauldron)], [[], ['enchantments']], 'the maker\'s budget: 100 on Ruhn\'s plate fits, on a raider\'s pauldron (50) it does not');
});

test('MAKER-KEPT: migration 0123 reads the era\'s templates - exactly the templates its records stand on (mutant: a template dropped)', () => {
  const sql = readFileSync(new URL('../../../server-account/migrations/0123_maker_kept.sql', import.meta.url), 'utf8');
  const lists = [...sql.matchAll(/'\$\.t'\) IN \(([\d, ]+)\)/g)].map((m) => m[1].split(',').map(Number));
  const want = [...new Set([...REGALIA, ...RAID_SET_PIECES].map((r) => r.templateIndex))].sort((a, b) => a - b);
  assert.deepEqual(lists, [want, want], 'the lift\'s two statements, the same templates');
});
