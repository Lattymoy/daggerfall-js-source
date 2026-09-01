import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INFO_TEXT, armorShouldShowMaterial, itemInfoTextId,
  CONDITION_WORDS, CONDITION_THRESHOLDS, conditionPercentage, conditionWord,
  weightString, weaponDamageString, armourModString, materialName, expandItemInfo, itemInfoRows,
  setBookAuthor, getBookAuthor,
} from '../src/systems/itemInfo.js';
import { potionRecipeKey, POTION_RECIPES } from '../src/systems/potions.js';   // IM1
import { TEMPLATES } from '../src/systems/useItem.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { TextRsc } from '../src/formats/textRsc.js';
import { createRandomBook } from '../src/systems/books.js';   // A2

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ── GetItemInfo's record switch (:748-817) ────────────────────────

test('U25: the thirteen info records are DFU\'s literals', () => {
  assert.deepEqual({ ...INFO_TEXT }, {
    painting: 250, armor: 1000, weapon: 1001, misc: 1003, soulTrap: 1004,
    letterOfCredit: 1007, potion: 1008, book: 1009, arrow: 1011,
    weaponNoMaterial: 1012, armorNoMaterial: 1014, oghmaInfinium: 1015, houseDeed: 1073,
  });
});

test('U25: armor and weapons each pick between a WITH- and WITHOUT-material record', () => {
  // classic behaviour (setting 0, DFU's shipped default): a helm or a
  // shield never shows its material, everything else does
  const cuirass = { group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Iron };
  const helm = { group: 'Armor', templateIndex: TEMPLATES.Helm, material: ARMOR_MATERIAL.Iron };
  const shield = { group: 'Armor', templateIndex: 109, material: ARMOR_MATERIAL.Iron };
  assert.equal(armorShouldShowMaterial(cuirass), true);
  assert.equal(armorShouldShowMaterial(helm), false);
  assert.equal(armorShouldShowMaterial(shield), false);
  // AUDIT 28 W3: the other three values (ItemHelper.cs:833-840),
  // through the parameter and through the live setting.
  const leatherHelm = { ...helm, material: ARMOR_MATERIAL.Leather };
  const chainHelm = { ...helm, material: ARMOR_MATERIAL.Chain };
  assert.deepEqual([leatherHelm, chainHelm, helm].map((h) => armorShouldShowMaterial(h, 1)), [false, false, true], '1: all but leather and chain');
  assert.deepEqual([leatherHelm, chainHelm, helm].map((h) => armorShouldShowMaterial(h, 2)), [false, true, true], '2: all but leather');
  assert.deepEqual([leatherHelm, chainHelm, helm].map((h) => armorShouldShowMaterial(h, 3)), [true, true, true], '3: all');
  assert.equal(armorShouldShowMaterial({ ...helm, artifact: true }, 3), false, 'an artifact never, even at 3');
  assert.equal(armorShouldShowMaterial(leatherHelm, 1), false); assert.equal(armorShouldShowMaterial(cuirass, 0), true);
  setValue('GUI', 'HelmAndShieldMaterialDisplay', 2);
  assert.equal(armorShouldShowMaterial(chainHelm), true, 'read live');
  setValue('GUI', 'HelmAndShieldMaterialDisplay', 9);
  assert.equal(armorShouldShowMaterial(leatherHelm), true, 'GetInt clamps 9 to 3');
  resetToDefaults();
  assert.equal(itemInfoTextId(cuirass), INFO_TEXT.armor);
  assert.equal(itemInfoTextId(helm), INFO_TEXT.armorNoMaterial);
  // an ARTIFACT never shows a material, whatever it is
  assert.equal(armorShouldShowMaterial({ ...cuirass, artifact: true }), false);
  assert.equal(LIVE['GUI/HelmAndShieldMaterialDisplay'], 'src/systems/itemInfo.js');
  // weapons: an arrow has its own record, an artifact drops the material
  assert.equal(itemInfoTextId({ group: 'Weapons', templateIndex: 118 }), INFO_TEXT.weapon);
  assert.equal(itemInfoTextId({ group: 'Weapons', templateIndex: TEMPLATES.Arrow }), INFO_TEXT.arrow);
  assert.equal(itemInfoTextId({ group: 'Weapons', templateIndex: 118, artifact: true }), INFO_TEXT.weaponNoMaterial);
});

test('U25: the MiscItems specials, and the default arm\'s potion check', () => {
  const misc = (t) => itemInfoTextId({ group: 'MiscItems', templateIndex: t });
  assert.equal(misc(TEMPLATES.House_Deed), INFO_TEXT.houseDeed);
  assert.equal(misc(TEMPLATES.Soul_trap), INFO_TEXT.soulTrap);
  assert.equal(misc(TEMPLATES.Letter_of_credit), INFO_TEXT.letterOfCredit);
  assert.equal(misc(TEMPLATES.Spellbook), INFO_TEXT.misc, 'the spellbook has no record of its own');
  // the FINAL default arm catches a potion before falling back
  assert.equal(itemInfoTextId({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle }), INFO_TEXT.potion);
  assert.equal(itemInfoTextId({ group: 'UselessItems1', templateIndex: 82 }), INFO_TEXT.misc);
  assert.equal(itemInfoTextId({ group: 'Gems', templateIndex: 0 }), INFO_TEXT.misc);
  assert.equal(itemInfoTextId({ group: 'Books', templateIndex: 277 }), INFO_TEXT.book);
  assert.equal(itemInfoTextId({ group: 'Paintings', templateIndex: 284 }), INFO_TEXT.painting);
});

// ── the macros (DaggerfallUnityItemMCP :117-165) ──────────────────

test('U25: Condition walks the thresholds, and the bands are DFU\'s', () => {
  assert.deepEqual(CONDITION_THRESHOLDS, [1, 5, 15, 40, 60, 75, 91, 101]);
  assert.deepEqual(CONDITION_WORDS, ['Broken', 'Useless', 'Battered', 'Worn',
    'Used', 'Slightly Used', 'Almost New', 'New']);
  const at = (pct) => conditionWord({ currentCondition: pct, maxCondition: 100 });
  // `while (percentage > threshold[i]) i++` - the band is the first
  // threshold the percentage does NOT exceed
  assert.equal(at(0), 'Broken');
  assert.equal(at(1), 'Broken');
  assert.equal(at(2), 'Useless');
  assert.equal(at(5), 'Useless');
  assert.equal(at(6), 'Battered');
  assert.equal(at(40), 'Worn');
  assert.equal(at(41), 'Used');
  assert.equal(at(91), 'Almost New');
  assert.equal(at(92), 'New');
  assert.equal(at(100), 'New');
  // ConditionPercentage truncates, and an item with no maximum is 100%
  assert.equal(conditionPercentage({ currentCondition: 2, maxCondition: 3 }), 66);
  assert.equal(conditionPercentage({ currentCondition: 5 }), 100);
  // and an item ABOVE its maximum falls out of the ladder entirely
  assert.equal(conditionWord({ currentCondition: 150, maxCondition: 100 }), '150');
});

test('U25: Weight prints the STACK, whole or to two places', () => {
  // AUDIT 23 (items-8): %kg reads the material-adjusted weightInKg off
  // the TEMPLATE (the old `item.weight` field had no writer anywhere).
  // Torch (247) baseWeight 0.5.
  assert.equal(weightString({ templateIndex: 247, stackCount: 4 }), '2');
  assert.equal(weightString({ templateIndex: 247, stackCount: 3 }), '1.50');
  assert.equal(weightString({ templateIndex: 247, stackCount: 1 }), '0.50');
  // ...and the material law reaches the panel: an Iron and a Daedric
  // dagger BOTH print 0.5 kg (Round-half-even banks 2.5 -> 2), while
  // a Dwarven war axe is heavier than an Iron one.
  assert.equal(weightString({ group: 'Weapons', templateIndex: 113, material: 0, stackCount: 1 }),
    weightString({ group: 'Weapons', templateIndex: 113, material: 9, stackCount: 1 }));
});

test('U25: WeaponDamage and ArmourMod are the two computed macros', () => {
  // "min - max", both shifted by the material modifier
  const iron = weaponDamageString({ group: 'Weapons', templateIndex: 118, material: WEAPON_MATERIALS.Iron });
  const daedric = weaponDamageString({ group: 'Weapons', templateIndex: 118, material: WEAPON_MATERIALS.Daedric });
  assert.match(iron, /^\d+ - \d+$/);
  assert.notEqual(iron, daedric, 'the material modifier moves both ends');
  // ArmourMod uses C#'s "+0;-0;0" format string - a PLUS sign on a
  // positive value, a bare 0 on zero. Every real material is positive
  // (leather 3 .. daedric 21), so the plus is what actually draws; the
  // zero arm is reachable only through ARMOR_MATERIAL.None.
  assert.equal(armourModString({ material: ARMOR_MATERIAL.Leather }), '+3');
  assert.equal(armourModString({ material: ARMOR_MATERIAL.Chain }), '+6');
  assert.equal(armourModString({ material: ARMOR_MATERIAL.Daedric }), '+21');
  assert.equal(armourModString({ material: ARMOR_MATERIAL.None }), '0');
});

test('U25: the material NAME reads two differently-keyed enums', () => {
  // armor's is bit-packed (0x0200 | tier), the weapon's a plain 0..9
  assert.equal(materialName({ group: 'Armor', material: ARMOR_MATERIAL.Leather }), 'Leather');
  assert.equal(materialName({ group: 'Armor', material: ARMOR_MATERIAL.Chain }), 'Chain');
  assert.equal(materialName({ group: 'Armor', material: ARMOR_MATERIAL.Chain2 }), 'Chain');
  assert.equal(materialName({ group: 'Armor', material: ARMOR_MATERIAL.Elven }), 'Elven');
  assert.equal(materialName({ group: 'Weapons', material: WEAPON_MATERIALS.Elven }), 'Elven');
  assert.equal(materialName({ group: 'Weapons', material: WEAPON_MATERIALS.Daedric }), 'Daedric');
});

test('U25: the panel fills every macro its records use - none survives to the screen', () => {
  const ARENA2 = process.env.ARENA2_PATH;
  if (!ARENA2 || !existsSync(join(ARENA2, 'TEXT.RSC'))) return;   // corpus-gated
  const rsc = new TextRsc().load(new Uint8Array(readFileSync(join(ARENA2, 'TEXT.RSC'))));
  const rows = (id) => rsc.linesById(id);
  const items = [
    { group: 'Weapons', templateIndex: 118, name: 'Broadsword', material: 1, currentCondition: 30, maxCondition: 60 },
    { group: 'Weapons', templateIndex: TEMPLATES.Arrow, name: 'Arrow', stackCount: 20 },
    { group: 'Armor', templateIndex: 102, name: 'Cuirass', material: ARMOR_MATERIAL.Iron, currentCondition: 10, maxCondition: 40 },
    { group: 'Armor', templateIndex: TEMPLATES.Helm, name: 'Helm', material: ARMOR_MATERIAL.Iron, currentCondition: 40, maxCondition: 40 },
    { group: 'MiscItems', templateIndex: TEMPLATES.Soul_trap, name: 'Soul trap' },
    { group: 'MiscItems', templateIndex: TEMPLATES.Letter_of_credit, name: 'Letter of credit' },
    { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, name: 'Potion' },
    { group: 'Books', templateIndex: 277, name: 'Book' },
    { group: 'Gems', templateIndex: 0, name: 'Ruby' },
  ];
  for (const it of items) {
    const out = itemInfoRows(it, rows);
    assert.ok(out.length > 0, `${it.name} produced no rows`);
    for (const r of out) {
      assert.equal(/%[a-z]{2,3}/.test(r.text), false, `unexpanded macro in ${it.name}: "${r.text}"`);
    }
  }
  // the sword's record really does name its material and its damage
  const sword = itemInfoRows(items[0], rows).map((r) => r.text).join(' | ');
  assert.match(sword, /Steel Broadsword/);
  assert.match(sword, /points of damage/);
  assert.match(sword, /Worn|Used|Battered/);
  // the arrow's record has NO condition line at all - that is why it
  // has a record of its own
  const arrow = itemInfoRows(items[1], rows).map((r) => r.text).join(' | ');
  assert.equal(/Condition/.test(arrow), false);
});

test('U25 -> IM1: no macro prints raw, and the fallbacks stand only where no source exists', () => {
  // Template 274 is neither book nor potion: %po and %bt fall to the
  // item's own name, %ba to DFU's unknownAuthor text - 'unknown author', lowercase,
  // Internal_Strings.csv verbatim ('Anonymous' was the port's
  // invention and IM1 retired it; BS1 caught the casing), %hs to Nothing.
  const out = expandItemInfo('%hs %po %bt by %ba', { name: 'Thing', templateIndex: 274 });
  assert.equal(/%/.test(out), false, out);
  assert.equal(out, 'Nothing Thing Thing by unknown author');
});

test('IM1: an identified book\'s name IS its title - ResolveItemName\'s "Books are handled differently" arm', () => {
  const book = { group: 'Books', templateIndex: 277, name: 'Book', message: 0 };
  // GetBookTitle(message, shortName) through the vendored legacy
  // mapping; %bt maps to ItemName in MacroHelper's table (:62), so
  // one arm feeds both macros.
  assert.equal(expandItemInfo('%it', book), 'The First Scroll of Baan Dar');
  assert.equal(expandItemInfo('%bt', book), 'The First Scroll of Baan Dar');
  // an id outside the mapping keeps the shortName (GetBookTitle's
  // defaultBookTitle), and an UNIDENTIFIED book stays the bare
  // template - the early return above the Books arm wins.
  assert.equal(expandItemInfo('%bt', { group: 'Books', templateIndex: 277, name: 'Book', message: 99999 }), 'Book');
  // UNIDENTIFIED (an enchanted book not yet identified): the early
  // return wins over the Books arm - the bare template name, by VALUE,
  // never the title.
  const unread = { group: 'Books', templateIndex: 277, name: 'Named Tome', message: 0, enchantments: [{ type: 1 }] };
  assert.notEqual(expandItemInfo('%bt', unread), 'The First Scroll of Baan Dar');
  assert.equal(expandItemInfo('%bt', unread), expandItemInfo('%it', { templateIndex: 277, enchantments: [{ type: 1 }] }));
});

test('IM1: %po answers the recipe by the item\'s own key - Potion() verbatim, both arms', () => {
  const key = potionRecipeKey(POTION_RECIPES[0].ingredients);
  const potion = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, potionRecipeKey: key };
  const recipe = { group: 'MiscItems', templateIndex: TEMPLATES.Potion_recipe, potionRecipeKey: key };
  // a POTION answers the potionOf template whole; a RECIPE the bare
  // name (its record reads "Potion recipe for %po").
  assert.equal(expandItemInfo('%po', potion), `Potion of ${POTION_RECIPES[0].displayName}`);
  assert.equal(expandItemInfo('%po', recipe), POTION_RECIPES[0].displayName);
  // a key the broker does not know reads Unknown Powers (:232)
  assert.equal(expandItemInfo('%po', { ...potion, potionRecipeKey: 'no-such' }), 'Potion of Unknown Powers');
});

test('IM1: the %ba cache - the reader\'s load feeds it, an empty author line keeps the fallback', () => {
  const book = { group: 'Books', templateIndex: 277, name: 'Book', message: 424242 };
  assert.equal(expandItemInfo('%ba', book), 'unknown author');
  setBookAuthor(424242, 'Marobar Sul');
  assert.equal(getBookAuthor(424242), 'Marobar Sul');
  assert.equal(expandItemInfo('%ba', book), 'Marobar Sul');
  // DFU's `bookFile.Author != null` gate: an empty line stores nothing
  setBookAuthor(424243, '');
  assert.equal(getBookAuthor(424243), null);
  // the reader is the ONE writer (bookReader.js feeds the cache on load)
  const reader = readFileSync(join(SRC, 'ui', 'bookReader.js'), 'utf8');
  assert.match(reader, /setBookAuthor\(item\?\.message, bookFile\.author\);/);
});

test('IM1: a dungeon-loot book carries its id - CreateRandomBook\'s message roll, BEFORE the variant', () => {
  // PIN MOVED at A2 (ROAD TO 1:1): the inline mint in loot.js became a
  // call to books.createRandomBook, the one member all four sites now
  // share, so the source pin on loot.js's expression can no longer see
  // the draw order. The claim is the same and it is now BEHAVIOURAL -
  // the id is drawn first and the variant second (ItemBuilder.cs:261-262).
  const loot = readFileSync(join(SRC, 'systems', 'loot.js'), 'utf8');
  assert.match(loot, /halving\(matrix\.BK, \(\) => createRandomBook\(rolls\)\)/,
    'the loot mint IS CreateRandomBook');
  // A stream that answers 0 then 0.99 must take the FIRST book id and
  // the LAST variant; swap the order and both answers swap with it.
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  const first = createRandomBook(seq(0, 0.99));
  const last = createRandomBook(seq(0.99, 0));
  assert.notEqual(first.message, last.message, 'the id reads the FIRST draw');
  assert.equal(first.variant, 1, 'and the variant the second (template 277 has two)');
  assert.equal(last.variant, 0);
});

test('AUDIT 22 F2: a multi-variant record reads ANY of its variants, with alignment', () => {
  const ARENA2 = process.env.ARENA2_PATH;
  if (!ARENA2 || !existsSync(join(ARENA2, 'TEXT.RSC'))) return;   // corpus-gated
  const rsc = new TextRsc().load(new Uint8Array(readFileSync(join(ARENA2, 'TEXT.RSC'))));
  // The rank refusal the guild popup shows has EIGHT, and the port
  // drew variant 0 forever because linesById could not reach the rest.
  assert.equal(rsc.variantCount(3100), 8);
  const seen = new Set();
  for (let v = 0; v < 8; v++) {
    const rows = rsc.linesById(3100, v);
    assert.ok(rows.length > 0, `variant ${v} is empty`);
    assert.equal(/%|�/.test(rows.map((r) => r.text).join('')), false);
    seen.add(rows.map((r) => r.text).join(' '));
  }
  assert.equal(seen.size, 8, 'all eight are distinct - the reader is not returning the same one');
  // ...and it still carries the per-row alignment linesById established
  assert.equal(typeof rsc.linesById(3100, 3)[0].center, 'boolean');
  // A SINGLE-variant record is unchanged by the new path
  assert.equal(rsc.variantCount(350), 1);
  assert.deepEqual(rsc.variantLinesById(350, () => 0.5), rsc.linesById(350));
  // the pick is bounded even at the top of the range
  assert.deepEqual(rsc.variantLinesById(3100, () => 0.999999), rsc.linesById(3100, 7));
  assert.deepEqual(rsc.variantLinesById(3100, () => 0), rsc.linesById(3100, 0));
});

test('AUDIT 22 F11 retired at Q2b-ii: createArtifact is the producer of the three artifact flags', async () => {
  // The pin that guarded these as producerless went red the day the
  // quest Item mint's artifact arm landed - as designed. The flags now
  // pin THE SHAPE THE PRODUCER MINTS: identity flags derive from the
  // artifact index (ArtifactsSubTypes - Oghma_Infinium 5, Azuras_Star
  // 9, ItemEnums.cs:246,250), the base item expands from the MAGIC.DEF
  // template, armor material moves to the plate band.
  const { createArtifact } = await import('../src/systems/loot.js');
  const T = (i, over = {}) => ({ index: i, name: `A${i}`, type: 1, group: 14, groupIndex: 0, enchantments: [], uses: 100, value: 0, material: 0, ...over });
  const templates = Array.from({ length: 12 }, (_, i) => T(i));
  templates[5] = T(5, { group: 7, groupIndex: 0 });    // Oghma Infinium is a book
  templates[9] = T(9, { group: 14, groupIndex: 2 });   // Azura's Star, a gem
  templates[3] = T(3, { group: 2, groupIndex: 4, material: 3 });   // an armor artifact

  const oghma = createArtifact(templates, 5);
  assert.equal(oghma.oghmaInfinium, true);
  assert.equal(oghma.azurasStar, undefined);
  assert.equal(oghma.artifact, true);
  const star = createArtifact(templates, 9);
  assert.equal(star.azurasStar, true);
  assert.equal(star.oghmaInfinium, undefined);
  const plain = createArtifact(templates, 0);
  assert.equal(plain.azurasStar, undefined);
  assert.equal(plain.oghmaInfinium, undefined);
  assert.equal(plain.artifact, true);
  // the armor artifact's material lands in the plate band
  const armor = createArtifact(templates, 3);
  assert.equal(armor.material, 0x200 + 3);
  assert.equal(armor.artifactIndexBitfield, (3 << 1) | 1);
  // empty enchantment slots (type -1) filter out, real ones ride raw
  const enchanted = createArtifact(
    templates.map((t, i) => (i === 0 ? { ...t, enchantments: [{ type: -1, param: 0 }, { type: 3, param: 7 }] } : t)), 0);
  assert.deepEqual(enchanted.enchantments, [{ type: 3, param: 7 }]);
  // ...and the itemInfo branches those flags feed are LIVE now
  assert.equal(armorShouldShowMaterial(armor), false, 'an artifact never shows material');
});
