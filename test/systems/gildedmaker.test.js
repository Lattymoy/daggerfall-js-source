// GILDED-MAKER (2026-10-29, #feature-feedback, "Gilded weapons lacking power": "Now that we can freely enchant rare items,
// feels like gilded items are missing something, I guess buffing them or making them enchantable would close this gap";
// bible/06-Systems/Gilded.md section 11). A Gilded piece is the item maker's, as a Rare is: its record's lines stay as
// minted, the maker lays DFU rows beside them from the piece's own points and the player's gold, and only the maker's
// own rows are lawful on it - on the wire (gilded.js validGildedMarks) and by the item law (law 15, makerFindings). The
// maker never renames it: its name is its record's. Every fixture from its real producer: mintGilded for every record
// and era, the item maker's window and write (ItemMakerWindow, applyEnchantments), the law and the wire as they run.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { GILDED_RECORDS, GILDED_ERAS, HOURLOCK, mintGilded, mintHourlock, validGildedMarks } from '../../src/systems/gilded.js';
import {
  keptEnchantments, gildedKeeps, rareKeeps, itemMakerRefuses, makerKeepsName, gildedKeepsNameText, enchantDecision, applyEnchantments,
  itemEnchantmentPower, openPickerDecision, AETHERIC_TAKES_NO_ENCHANTMENT, MAX_ENCHANTMENTS,
} from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { ItemMakerWindow, itemMakerFilter, TAB_PAGES } from '../../src/ui/item/itemMakerWindow.js';
import { PORT_SPECS } from '../../src/ui/enhanced/enhancedPorts.js';
import { itemFindings, ITEM_LAW_VERSION } from '../../src/systems/item/itemLaw.js';
import { JUDGE_VERSION } from '../../server-account/src/judge.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { mintAetheric, REGALIA } from '../../src/systems/aetheric.js';
import { rarityLines, applyRarity, validAffix, AFFIX_RANGES, RARE_FLAVOURS } from '../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { salvageRefusal, reforgeRefusal } from '../../src/systems/reforge.js';
import { heirloomEligible } from '../../src/systems/legacy/heirloom.js';
import { temperRefusal } from '../../src/net/temperLaw.js';
import { pcaaoFades } from '../../src/combat/pcaao.js';
import { counterValueOf } from '../../src/systems/tradeModes.js';
import { repairRefusal } from '../../src/systems/repairService.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const copy = (v) => JSON.parse(JSON.stringify(v));
const wire = (it) => validLootItem(copy(it));
const listedOn = (item) => TAB_PAGES.filter((tab) => itemMakerFilter(item, tab));
const ALL = [...GILDED_RECORDS, ...GILDED_ERAS];
const FEATHER = enchantmentSettings('FeatherWeight', -1);   // 100 of the maker's points
const POTENT = enchantmentSettings('PotentVs', 1);   // 900 - past the Hourlock's 525 alone
const LOW_DAMAGE = enchantmentSettings('LowDamageVs', 0);   // a weapon's drawback: buys 800
const REGENS = enchantmentSettings('RegensHealth', 0);   // 4,000 - past every Gilded piece's points
/** A Gilded piece the item maker enchanted, as its window writes it. */
const made = (r, rows = [FEATHER]) => applyEnchantments(mintGilded(r), rows);

test('GILDED-MAKER THE DOOR: every Gilded record and era, as mintGilded mints it, is on the item maker\'s Weapons & armor tab with no row of its own, its own points to spend; an Aetheric piece is still refused in its own words; the ladder off, DFU\'s maker (mutants: the refusal back; the door shut; the ladder ignored)', () => {
  on();
  assert.deepEqual(ALL.map((r) => itemEnchantmentPower(mintGilded(r))), [525, 2100, 1050, 600, 375, 600, 500], 'its make\'s points, as any plain piece of its make');
  for (const r of ALL) {
    const it = mintGilded(r);
    assert.deepEqual([listedOn(it), keptEnchantments(it), itemMakerRefuses(it), gildedKeeps(it)], [['WeaponsAndArmor'], [], false, true], r.id);
    const d = enchantDecision(it, [FEATHER], [], { gold: 10 ** 9 });
    assert.deepEqual([d.kind, d.cost, d.goldCost], ['enchant', 100, 1000], r.id);
  }
  // AETHERIC-MAKER stands, and speaks its own line - the one piece the maker refuses beyond DFU's own
  const axe = mintAetheric(REGALIA.find((x) => x.group === 'Weapons'));
  assert.deepEqual(enchantDecision(axe, [FEATHER], [], { gold: 10 ** 9 }), { kind: 'refused', text: AETHERIC_TAKES_NO_ENCHANTMENT });
  assert.equal(AETHERIC_TAKES_NO_ENCHANTMENT, 'An Aetheric piece takes no enchantment.');
  assert.deepEqual(listedOn(axe), []);
  // enchanted, still the maker's - its rows the maker's own
  const h = made(HOURLOCK);
  assert.deepEqual([listedOn(h), gildedKeeps(h), keptEnchantments(h).map((e) => [e.type, e.enchantCost, e.kept])], [['WeaponsAndArmor'], true, [['FeatherWeight', 100, true]]]);
  // a row no maker laid on it is no door's - off the list, never kept free as a Rare's flavour is, even a Rare
  // weapon's own flavour (rareKeeps is a Rare's door, by its tier)
  const found = { ...mintHourlock(), enchantments: [{ type: T.FeatherWeight, param: -1 }] };
  const flavoured = { ...mintHourlock(), enchantments: [{ type: RARE_FLAVOURS.Weapons[0].type, param: RARE_FLAVOURS.Weapons[0].param }] };
  for (const it of [found, flavoured]) assert.deepEqual([listedOn(it), keptEnchantments(it), gildedKeeps(it), rareKeeps(it)], [[], null, false, false]);
  // AUDIT MAKER-RARE A2's law: the ladder off, the maker is DFU's - a plain weapon in, an enchanted one out
  setPref('lootRarity', false);
  assert.deepEqual([listedOn(mintHourlock()), listedOn(h), keptEnchantments(h), gildedKeeps(h)], [['WeaponsAndArmor'], [], null, false]);
  setPref('lootRarity', true);
});

test('GILDED-MAKER THROUGH THE WINDOW: the Hourlock enchanted as a player does - its lines and its name its record\'s, the rows the maker\'s at their cost, the gold paid, lawful in the save and on the wire; back again its first rows kept at the head and costed, a drawback buying its points; the rename refused in words, on both skins (mutants: the name written; the box opened; the Enhanced button live; the name kept for every piece)', () => {
  on();
  const h = mintHourlock();
  const player = { goldPieces: 100_000, items: [h] };
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  assert.deepEqual(w.items(), [h]);
  w._selectItem(h);
  assert.deepEqual([w.itemName, w.labels().enchantmentCost, w.labels().goldCost], ['The Hourlock', '0/525', '0']);
  // the rename: refused in words, the classic window's box never opened; the Enhanced skin's button dead
  w._openRename();
  assert.equal(w.renameBox, null);
  assert.deepEqual(w.box.rows.map((r) => r.text), [gildedKeepsNameText()]);
  assert.equal(gildedKeepsNameText(), 'A Gilded piece keeps its own name.');
  const renameButton = (win) => PORT_SPECS.itemMaker.view(win).blocks[1].cols[1][0].blocks.find((b) => b.type === 'field').button;
  assert.equal(renameButton(w).disabled, true, 'the Enhanced skin: no Rename for a Gilded piece');
  w.box = null;
  w.itemName = 'Bob\'s Bow';   // a name typed before the piece was chosen still never lands on it
  w.powers = [FEATHER];
  assert.deepEqual([w.labels().enchantmentCost, w.labels().goldCost], ['100/525', '1000']);
  w._enchant();
  assert.equal(player.goldPieces, 99_000, 'the gold paid');
  assert.equal(h.name, HOURLOCK.name, 'its record\'s name');
  assert.deepEqual(h.affixes, HOURLOCK.affixes, 'its record\'s lines, untouched');
  assert.deepEqual(h.enchantments.map((e) => [e.type, e.param, e.enchantCost]), [[T.FeatherWeight, -1, 100]], 'the maker\'s row, its type the classic number');
  assert.equal(h.value, mintHourlock().value, 'no price laid on by the maker - DFU\'s maker writes none');
  assert.deepEqual([itemFindings(h), itemFindings(copy(h))], [[], []], 'the item law: lawful');
  assert.ok(validGildedMarks(copy(h)) && wire(h), 'the wire takes it');
  // back again: the first row at the head, kept and COSTED (a Rare's ladder rows ride free; a Gilded piece has none)
  w._selectItem(h);
  assert.deepEqual(w._lists().powers.map((e) => [e.type, e.kept === true]), [['FeatherWeight', true]]);
  assert.equal(w.labels().enchantmentCost, '100/525');
  w.powers = [POTENT];
  w.sideEffects = [LOW_DAMAGE];
  assert.equal(w.labels().enchantmentCost, '200/525', 'a drawback buys its points, as on any piece');
  w._enchant();
  assert.deepEqual(h.enchantments.map((e) => [e.type, e.param]), [[T.FeatherWeight, -1], [T.PotentVs, 1], [T.LowDamageVs, 0]], 'the first row kept ahead of the new');
  assert.equal(player.goldPieces, 90_000);
  assert.deepEqual([h.name, h.affixes], [HOURLOCK.name, HOURLOCK.affixes]);
  assert.deepEqual([itemFindings(h), listedOn(h)], [[], ['WeaponsAndArmor']]);
  // the guard's ten rows, as on any piece
  const ten = Array.from({ length: MAX_ENCHANTMENTS }, () => FEATHER);
  assert.equal(openPickerDecision(true, { item: h, powers: ten, sideEffects: [] }).kind, 'refuse');
  // a Rare is renamed as DFU renames any made piece: the box opens, and the Enhanced button is live
  const rare = Object.assign(applyRarity(createWeapon(120, 4), 'rare', () => 0.3), { isIdentified: true });
  const pack = { goldPieces: 100_000, items: [rare] };
  const w2 = new ItemMakerWindow({ player: pack, packItems: () => pack.items });
  w2._selectItem(rare);
  w2._openRename();
  assert.ok(w2.renameBox, 'the rename box, for a Rare');
  assert.deepEqual([makerKeepsName(rare), makerKeepsName(h), renameButton(w2).disabled], [false, true, false]);
});

test('GILDED-MAKER THE LAW: item law 15 - the maker\'s rows on every Gilded record and era lawful, held to the maker\'s law and the piece\'s points; a row no maker laid, a made row of no maker, a cost lied, the points passed, a kind twice, a door\'s mark or a line moved beside them - each refused by the law and the wire; the account service\'s judge, headless, agrees (mutants: the law refusing them; the wire taking any row; the wire refusing the maker\'s; a custom row let in; the law unmoved)', () => {
  on();
  assert.equal(ITEM_LAW_VERSION, 16);   // PIN MOVED (GILDED-MAKER): law 16 - the item maker's rows on a Gilded piece lawful (15 on its branch, renumbered past DRAGON5's 15 at the merge)
  assert.equal(JUDGE_VERSION, ITEM_LAW_VERSION, 'the account service\'s judge is this law');
  const lawful = ALL.map((r) => made(r, [FEATHER, LOW_DAMAGE]));
  for (const it of lawful) {
    assert.deepEqual(itemFindings(it), [], `${it.gilded} (${it.templateIndex})`);
    assert.ok(wire(it), `${it.gilded}: the wire`);
  }
  const forge = (f) => { const it = copy(made(HOURLOCK)); f(it); return it; };
  const cases = [
    ['a row no maker laid', forge((it) => { it.enchantments = [{ type: T.FeatherWeight, param: -1 }]; }), 'gilded'],
    ['a found row beside the maker\'s', forge((it) => { it.enchantments.push({ type: T.FeatherWeight, param: -1 }); }), 'gilded'],
    ['a made row of no maker (customEnchantments)', forge((it) => { it.customEnchantments = [{ type: 10, param: 1 }]; }), 'gilded'],
    ['a cost lied', forge((it) => { it.enchantments = [{ ...it.enchantments[0], type: T.RegensHealth, param: 0, enchantCost: 0 }]; }), 'enchantments'],
    ['past its points', copy(applyEnchantments(mintHourlock(), [REGENS])), 'enchantments'],
    ['one of a kind twice', copy(applyEnchantments(mintHourlock(), [FEATHER, FEATHER])), 'enchantments'],
    ['a socket beside the rows', forge((it) => { it.sockets = ['empty']; }), 'gilded'],
    ['a line moved beside the rows', forge((it) => { it.affixes[0].value = 39; }), 'gilded'],
  ];
  for (const [what, it, code] of cases) {
    assert.ok(itemFindings(it).includes(code), `${what}: ${itemFindings(it)}`);
    assert.equal(wire(it), null, `${what}: the wire`);
  }
  assert.equal(validGildedMarks(cases[0][1]), null, 'the wire\'s own check: a row no maker laid');
  // the account service's judge, as it loads the law - a process that imports no game home but the judge's own
  const judge = new URL('../../server-account/src/judge.js', import.meta.url).href;
  const law = new URL('../../src/systems/item/itemLaw.js', import.meta.url).href;
  const headless = `await import(${JSON.stringify(judge)}); const { itemFindings } = await import(${JSON.stringify(law)});`
    + ` const items = JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(items.map((it) => itemFindings(it))));`;
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', headless, JSON.stringify([...lawful, cases[0][1]])], { encoding: 'utf8' }));
  assert.deepEqual(out.slice(0, -1), lawful.map(() => []), 'every enchanted Gilded piece lawful to the service');
  assert.ok(out.at(-1).includes('gilded'), 'and a row no maker laid a forgery there too');
});

test('GILDED-MAKER EVERY OTHER DOOR: an enchanted Gilded piece is still never salvaged, reforged, tempered or made an heirloom; it breaks and stays (never fades, as no laddered piece does); a counter pays what it paid; a smith repairs it as DFU repairs an enchanted piece; its card says its rows after its lines, then its power and lore; no line past the Legendary top (mutants: none - the doors\' own laws, held here for the enchanted piece)', () => {
  on();
  for (const r of ALL) {
    const plain = mintGilded(r), it = made(r);
    assert.equal(salvageRefusal(it), 'gilded', `${r.id}: never salvaged`);
    assert.ok(reforgeRefusal(it, 0, { items: [] }), 'never reforged');
    assert.equal(heirloomEligible({ ...it, equipSlot: 1 }), false, 'never an heirloom');
    assert.equal(temperRefusal(it), temperRefusal(plain), 'the temper as for the piece unenchanted');
    assert.deepEqual([pcaaoFades(it), pcaaoFades(applyEnchantments(createWeapon(120, 4), [FEATHER]))], [false, true], 'it breaks and stays; a plain made piece fades under the mod');
    assert.equal(counterValueOf(it), counterValueOf(plain), 'a counter pays what it paid');
    assert.deepEqual([repairRefusal({ ...it, currentCondition: 1 }), repairRefusal({ ...it, currentCondition: 1 }, { allowMagicRepairs: true })], ['magic', null], 'DFU\'s AllowMagicRepairs, as for an enchanted Rare');
    for (const a of it.affixes) assert.ok(validAffix(a) && a.value <= AFFIX_RANGES[a.id].legendary[1], `${r.id}: ${a.id} at the Legendary top at most`);
  }
  const lines = rarityLines(made(HOURLOCK));
  assert.equal(lines[0], 'Gilded');
  const row = lines.indexOf('Feather Weight');
  assert.ok(row === 1 + HOURLOCK.affixes.length, `the maker's row after the record's lines: ${lines.join(' | ')}`);
  assert.ok(lines[row + 1].startsWith('The Hour Tolls'), 'then its power, then its lore');
});
