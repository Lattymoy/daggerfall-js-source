// G4: the guild store arm - ItemBuilder's legacy value sum, the two
// guild shelves, and the four service destinations that had been
// FLAGGED nulls since G3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ENCHANTMENT_TYPES, legacyEnchantmentValue, spellEnchantPtCost, VALUE_COUNTS_BELOW,
} from '../src/systems/enchantments.js';
import { enchantmentCost, PARAM_NONE } from '../src/systems/enchantmentCatalogue.js';
import {
  stockGuildMagicItems, stockGuildPotions, stockSoulGems, dailyStockRolls, stockDayIndex,
} from '../src/systems/shopStock.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { buyHolidayHalvesPrice } from '../src/systems/tradeModes.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS } from '../src/systems/skills.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { readMagicDef } from '../src/formats/magicDef.js';
import { readSpellsStd } from '../src/formats/spellsStd.js';
import { createRandomPotion } from '../src/systems/loot.js';
import { classicCastingCost } from '../src/systems/spellcost.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';

const T = ENCHANTMENT_TYPES;
const arena2 = process.env.ARENA2_PATH;
const readArena2 = (name) => new Uint8Array(readFileSync(join(arena2, name)));

test('G4: the value sum counts POWERS ONLY, and the bound is the enum order', () => {
  // ItemDeteriorates is 16, and 16-25 are exactly the drawbacks - so
  // `type < ItemDeteriorates` is "count the powers" written as an
  // enum comparison rather than as a list.
  assert.equal(VALUE_COUNTS_BELOW, 16);
  assert.equal(T.ItemDeteriorates, 16);
  assert.equal(T.SpecialArtifactEffect, 26);

  const powers = [{ type: T.PotentVs, param: 1 }, { type: T.StrengthensArmor, param: 0 }];
  assert.equal(legacyEnchantmentValue(powers), 900 + 700);
  assert.equal(enchantmentCost('PotentVs', 1), 900);
  assert.equal(enchantmentCost('StrengthensArmor', PARAM_NONE), 700);

  // every drawback adds NOTHING, however dear it is at the item maker
  for (const type of [T.ItemDeteriorates, T.UserTakesDamage, T.LowDamageVs,
    T.HealthLeech, T.BadReactionsFrom, T.ExtraWeight, T.WeakensArmor, T.BadRepWith]) {
    assert.ok(type >= VALUE_COUNTS_BELOW, `${type} sits above the bound`);
    assert.equal(legacyEnchantmentValue([...powers, { type, param: 0 }]), 1600, `type ${type} is free`);
  }
  // ...and so does an empty slot, which DFU tests for separately
  assert.equal(T.None, -1);
  assert.equal(legacyEnchantmentValue([{ type: T.None, param: 0 }]), 0);
  assert.equal(legacyEnchantmentValue([]), 0);
  assert.equal(legacyEnchantmentValue(null), 0);
  // the two unported drawback types are above the bound too, so they
  // cost nothing here without needing a catalogue row at all
  assert.ok(T.VisionProblems > VALUE_COUNTS_BELOW);
  assert.ok(T.WalkingProblems > VALUE_COUNTS_BELOW);
  assert.equal(legacyEnchantmentValue([{ type: T.VisionProblems, param: 0 }]), 0);
});

test('G4: SoulBound is the one drawback UNDER the bound, and it scores POSITIVE', () => {
  // The item maker charges -8000 for a Daedra Lord. The shop pays
  // +800000 for it, off the enemy table's SoulPts - DFU's own comment
  // beside the line reads "Not sure about this. Should be negative?
  // Needs to be tested." Both are verbatim and they disagree.
  assert.ok(T.SoulBound < VALUE_COUNTS_BELOW, 'it counts');
  assert.equal(enchantmentCost('SoulBound', 31), -8000, 'the item maker charges');
  assert.equal(ENEMY_BASICS[31].soulPts, 800000);
  assert.equal(legacyEnchantmentValue([{ type: T.SoulBound, param: 31 }]), 800000, 'the shop pays');
  assert.ok(legacyEnchantmentValue([{ type: T.SoulBound, param: 31 }]) > 0,
    'a bound soul makes a BOUGHT item dearer and a MADE one cheaper');
  // the hook overrides the table
  assert.equal(legacyEnchantmentValue([{ type: T.SoulBound, param: 31 }], { soulPointsOf: () => 7 }), 7);
  // a soulless creature scores nothing rather than throwing
  assert.equal(legacyEnchantmentValue([{ type: T.SoulBound, param: 0 }]), ENEMY_BASICS[0].soulPts ?? 0);
});

test('G4: the five NO-PARAM types ignore their stored param - and EnhancesSkill is why that matters', () => {
  // Four of the five mint at ClassicParam -1, so "ignore the param"
  // and "read the single cost" are the same thing...
  for (const [type, name, cost] of [
    [T.RepairsObjects, 'RepairsObjects', 900], [T.AbsorbsSpells, 'AbsorbsSpells', 1500],
    [T.FeatherWeight, 'FeatherWeight', 100], [T.StrengthensArmor, 'StrengthensArmor', 700]]) {
    assert.equal(enchantmentCost(name, PARAM_NONE), cost);
    assert.equal(legacyEnchantmentValue([{ type, param: PARAM_NONE }]), cost, name);
    // ...including when the stored param is junk, which is DFU's
    // whole point: the array is indexed by TYPE, never by param
    assert.equal(legacyEnchantmentValue([{ type, param: 99 }]), cost, `${name} at a junk param`);
  }
  // THE FIFTH IS NOT: EnhancesSkill's one flat cost spans all
  // thirty-five skills and its stored param is a REAL skill id, so
  // reading it at -1 answers null and the item prices at ZERO.
  assert.equal(enchantmentCost('EnhancesSkill', PARAM_NONE), null, 'there is no -1 here');
  assert.equal(enchantmentCost('EnhancesSkill', SKILLS.Daedric), 900);
  assert.equal(legacyEnchantmentValue([{ type: T.EnhancesSkill, param: SKILLS.Daedric }]), 900);
  assert.equal(legacyEnchantmentValue([{ type: T.EnhancesSkill, param: 7 }]), 900,
    'the param that free-priced %it of Venom Spitting');
  // a parameterized power reads at its OWN param, not a flat one
  assert.notEqual(enchantmentCost('PotentVs', 0), enchantmentCost('PotentVs', 3));
  assert.equal(legacyEnchantmentValue([{ type: T.PotentVs, param: 3 }]), 1200);
  // an out-of-range param on a real table scores 0 rather than NaN
  assert.equal(legacyEnchantmentValue([{ type: T.PotentVs, param: 99 }]), 0);
});

test('G4: the three CastWhen* are priced by the SPELL, and differently than the item maker prices them', () => {
  const spell = { rangeType: 0, effects: [{ type: 1, subType: 0 }] };
  const expected = 10 * classicCastingCost(spell);
  assert.equal(spellEnchantPtCost(spell), expected);
  assert.ok(expected > 0);
  for (const type of [T.CastWhenUsed, T.CastWhenHeld, T.CastWhenStrikes]) {
    assert.equal(legacyEnchantmentValue([{ type, param: 4 }], { spellOfIndex: () => spell }), expected);
  }
  // THE SAME ENCHANTMENT, TWO PRICES: the item maker charges the flat
  // classicSpellCosts table M4 gathered, and this charges ten times
  // the record's own casting cost. Resist Fire (spell 12) is 1560 at
  // the maker; here it is whatever the record works out to.
  assert.equal(enchantmentCost('CastWhenUsed', 12), 1560);
  // A spell the reader cannot find scores ZERO - DFU's loop simply
  // never matches, so it returns its initial 0 rather than throwing.
  assert.equal(spellEnchantPtCost(null), 0);
  assert.equal(legacyEnchantmentValue([{ type: T.CastWhenUsed, param: 4 }], { spellOfIndex: () => null }), 0);
  assert.equal(legacyEnchantmentValue([{ type: T.CastWhenUsed, param: 4 }]), 0, 'and with no reader at all');
});

test('G4: the shelves are DAILY, INCLUSIVE, and the magic arm walks the stream first', () => {
  const day = { quality: 8, gameMinutes: 100000 };
  const opts = { magicItemTemplates: FAKE_TEMPLATES, playerLevel: 5 };

  // numOfItems = trunc(quality/2) + 1 = 5, and BOTH loops are
  // `i <= numOfItems`, so each carries SIX.
  const magicOnly = stockGuildMagicItems(day, opts);
  assert.equal(magicOnly.length, 7, 'six items and a spellbook');
  assert.equal(magicOnly.at(-1).templateIndex, SPELLBOOK_TEMPLATE_INDEX, 'the spellbook closes the run');
  assert.ok(magicOnly.slice(0, 6).every((i) => i.isIdentified), 'a shop magic item arrives IDENTIFIED');
  const gemsOnly = stockSoulGems(day);
  assert.equal(gemsOnly.length, 6);

  // a guild that sells BOTH shows one shelf with both runs on it
  const both = stockGuildMagicItems({ ...day, sellsSoulGems: true }, opts);
  assert.equal(both.length, 13, 'six items, a spellbook, six gems');
  // found by SHAPE, not by position, so the pin still means something
  // if the two runs are ever reordered
  const isGem = (i) => i.group === 'MiscItems' && 'trappedSoulType' in i;
  const shelfGems = both.filter(isGem);
  assert.equal(shelfGems.length, 6);
  assert.deepEqual(both.slice(7), shelfGems, 'and the gems come LAST, after the spellbook');

  // ...AND THEY ARE NOT THE SAME GEMS. One seed, one stream, and the
  // magic run walked it first, so the Buy Magic Items shelf and the
  // Buy Soulgems shelf disagree on the same day at the same guild.
  const soulsOf = (l) => l.map((g) => g.trappedSoulType ?? 'empty').join(',');
  assert.notEqual(soulsOf(shelfGems), soulsOf(gemsOnly));

  // the SAME day replays exactly, which is the whole point of seeding
  assert.equal(soulsOf(stockSoulGems(day)), soulsOf(gemsOnly));
  assert.deepEqual(stockGuildMagicItems(day, opts).map((i) => i.name), magicOnly.map((i) => i.name));
  // and the NEXT day does not
  const tomorrow = { quality: 8, gameMinutes: 100000 + 1440 };
  assert.notEqual(stockDayIndex(tomorrow.gameMinutes), stockDayIndex(day.gameMinutes));
  assert.notEqual(soulsOf(stockSoulGems(tomorrow)), soulsOf(gemsOnly));

  // quality drives the size, and quality 0 still stocks TWO
  assert.equal(stockGuildMagicItems({ quality: 0, gameMinutes: 0 }, opts).length, 3);
  assert.equal(stockSoulGems({ quality: 0, gameMinutes: 0 }).length, 2);
  // no templates loaded -> no magic items, but the spellbook still
  // goes out, which is the arm that survives an absent MAGIC.DEF
  const bare = stockGuildMagicItems(day, { magicItemTemplates: null });
  assert.deepEqual(bare.map((i) => i.templateIndex), [SPELLBOOK_TEMPLATE_INDEX]);
});

test('G4: the potion shelf is quality + 1, and it burns a draw DFU throws away', () => {
  const day = { quality: 6, gameMinutes: 100000 };
  const shelf = stockGuildPotions(day);
  assert.equal(shelf.length, 7, '`n = quality; while (n-- >= 0)` is quality + 1');
  assert.equal(stockGuildPotions({ quality: 0, gameMinutes: 0 }).length, 1);
  assert.ok(shelf.every((p) => p.potionRecipeKey !== undefined), 'every one is a bottle with a key');
  assert.equal(stockGuildPotions(day).map((p) => p.potionRecipeKey).join(),
    shelf.map((p) => p.potionRecipeKey).join(), 'the same day replays');

  // THE DISCARDED DRAW: DFU passes Range(1, 5) as CreateRandomPotion's
  // stackSize and CreateRandomPotion never reads it. The value is
  // dropped; the DRAW is not, and it shifts everything after it.
  //
  // Pinned against what the MODULE actually mints, not against two
  // hand-rolled streams - comparing streams to each other proves they
  // differ and says nothing about the shelf, which is a pin that
  // passes for the wrong reason. Both candidate shelves are built
  // here through createRandomPotion over the same seed, and the
  // module has to match the one that burns the draw.
  const keys = (list) => list.map((p) => p.potionRecipeKey).join();
  const shelfFrom = (burn) => {
    const r = dailyStockRolls(stockDayIndex(day.gameMinutes));
    return Array.from({ length: 7 }, () => { if (burn) r(); return createRandomPotion(r); });
  };
  assert.equal(keys(shelf), keys(shelfFrom(true)), 'the draw is burned');
  assert.notEqual(keys(shelf), keys(shelfFrom(false)), 'and skipping it mints a different shelf');
  // and a potion is NOT a stack, whatever Range(1,5) looked like it
  // was asking for
  assert.ok(shelf.every((p) => (p.stackCount ?? 1) === 1));
});

test('G4: the four destinations, and the guild id that makes Tales and Tallow reachable', () => {
  assert.equal(serviceDestination('Identify'), 'guildServiceIdentify');
  assert.equal(serviceDestination('BuyPotions'), 'guildServiceBuyPotions');
  assert.equal(serviceDestination('BuyMagicItems'), 'guildServiceBuyMagicItems');
  assert.equal(serviceDestination('SellMagicItems'), 'guildServiceSellMagicItems');

  // The clause that had never had a caller: buying AT the Mages Guild
  // during Tales and Tallow halves the price. It needs a NON-NULL
  // faction id, and every trade window in the port passed null.
  const item = { group: 'Jewellery', value: 100 };
  const mages = GUILDS.MagesGuild.factionId;
  assert.equal(buyHolidayHalvesPrice(item, { holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: mages }), true);
  assert.equal(buyHolidayHalvesPrice(item, { holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: null }), false,
    'which a null id can never satisfy');
  // ...and the id has to be the MAGES GUILD's - another guild's store
  // does not halve, even inside a guild
  assert.equal(buyHolidayHalvesPrice(item, {
    holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: GUILDS.FightersGuild.factionId,
  }), false);
  // the mirror: Merchants Festival halves OUTSIDE a guild only, so
  // supplying the id turns that one OFF - the same field, both ways
  assert.equal(buyHolidayHalvesPrice(item, { holidayId: HOLIDAYS.Merchants_Festival, guildFactionId: null }), true);
  assert.equal(buyHolidayHalvesPrice(item, { holidayId: HOLIDAYS.Merchants_Festival, guildFactionId: mages }), false);
});

test('G4: over the REAL MAGIC.DEF - every regular item prices, and the SoulBound arm is INERT',
  { skip: !arena2 && 'ARENA2_PATH unset' }, () => {
    const templates = readMagicDef(readArena2('MAGIC.DEF'));
    const byIndex = new Map();
    for (const sp of readSpellsStd(readArena2('SPELLS.STD'))) {
      if (!byIndex.has(sp.index)) byIndex.set(sp.index, sp);   // first wins, per AUDIT 18
    }
    const spellOfIndex = (i) => byIndex.get(i) ?? null;
    const regular = templates.filter((t) => t.type === 0);
    assert.equal(templates.length, 59);
    assert.equal(regular.length, 36);

    const priced = regular.map((t) => ({
      name: t.name, stored: t.value,
      value: legacyEnchantmentValue(t.enchantments, { spellOfIndex }),
    }));
    // NOT ONE prices at zero. This is the pin that caught the
    // EnhancesSkill lookup: %it of Venom Spitting carries a single
    // EnhancesSkill slot at param 7, and reading it at -1 free-priced
    // the item on the real shipping file.
    assert.deepEqual(priced.filter((p) => p.value <= 0), []);
    assert.equal(Math.min(...priced.map((p) => p.value)), 50);
    assert.equal(Math.max(...priced.map((p) => p.value)), 4230, "%it of Oblivion");

    // THE STORED VALUE IS IGNORED. MAGIC.DEF carries a `value` field
    // per record and ItemBuilder overwrites it with this sum - so the
    // field is read by the parser and used by nobody, and on the real
    // file the two disagree on all but a handful.
    const agree = priced.filter((p) => p.value === p.stored).length;
    assert.ok(agree < 4, `${agree} of 36 agree, so the field is decorative`);

    // and the SoulBound arm never fires on shipping data: no regular
    // magic item carries a bound soul, so the +SoulPts quirk above is
    // reachable only through a hand-built item. Recorded, not chased.
    const soulSlots = regular.flatMap((t) => t.enchantments).filter((e) => e.type === T.SoulBound);
    assert.deepEqual(soulSlots, [], 'inert on classic data');
    // the CastWhen* arm, by contrast, is most of the file
    const castSlots = regular.flatMap((t) => t.enchantments)
      .filter((e) => e.type >= T.CastWhenUsed && e.type <= T.CastWhenStrikes);
    assert.equal(castSlots.length, 33);
  });

/** Two fake MAGIC.DEF rows - enough for the shelf walk to mint from
 *  without ARENA2, since the shelf's law is the loop and the seed
 *  rather than what the templates say. */
const FAKE_TEMPLATES = Object.freeze([
  { index: 0, name: 'Test Ring', type: 0, group: 1, groupIndex: 0, uses: 10, value: 100, material: 0,
    enchantments: [{ type: T.StrengthensArmor, param: -1 }, ...Array.from({ length: 9 }, () => ({ type: -1, param: 0 }))] },
  { index: 1, name: 'Test Blade', type: 0, group: 2, groupIndex: 0, uses: 20, value: 200, material: 0,
    enchantments: [{ type: T.PotentVs, param: 0 }, ...Array.from({ length: 9 }, () => ({ type: -1, param: 0 }))] },
]);
