// PROF3 (2026-09-28, Mac: "Lets keep moving") - SMITHING AS THE CLIENT MAKES IT: the book's craft (kept before it is
// asked, its pieces minted on the answer, once) and the smith's stock; the piece minted as DFU mints it and the quality
// laid on it (the condition, the weight, the Loot Rarity roll off the record's seed, the maker's mark); a tool's life;
// the Repair Kit and its use; the heat; the anvil's section of the Stores page. The done-when: a crafted Mithril
// Longsword is DFU's, with its quality. bible/06-Systems/Professions-Arc.md 24.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank } from '../src/net/professionLaw.js';
import { recipeById, QUALITY_EFFECTS, TOOL_LIFE, HEAT_ACT, heatWindow, REPAIR_KIT_TEMPLATE } from '../src/net/recipeLaw.js';
import { readProductRecord } from '../src/net/productRecord.js';
import { mintPiece, mintPieces, useRepairKit, kitMends, repairKitUse, craftedText, installSmithing } from '../src/systems/smithItems.js';
import { createHeatAct } from '../src/systems/heatAct.js';
import { weaponOfMaterial, armorOfMaterial } from '../src/combat/enemyEquipment.js';
import { unitWeightInKg } from '../src/systems/inventory.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { templateByIndex, inventoryItemImage, itemUseHandler } from '../src/systems/itemTemplates.js';
import { DYE_COLORS } from '../src/characters/dyes.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { lootRarityOn } from '../src/systems/lootRarity.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const PROV = '0123456789abcdef';

test('PROF3 DONE WHEN: a crafted Mithril Longsword is DFU\'s, with its quality - its fittings bought from the smith, made at the anvil through the real Worker, its piece minted from the answer into the pack', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(55));
  for (const [m, n] of [['ingot:mithril', 3], ['metal:copper', 1]]) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
  s.seedMarks(mac, 10);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const bought = await book.stock('leather:cured', 1);
  assert.equal(bought.ok, true, JSON.stringify(bought));
  assert.deepEqual([book.held('leather:cured'), book.state.marks], [1, 6]);
  const pack = [];
  const r = await book.craft('longsword:mithril', { clean: true, name: 'Silverthorn' }, (data) => pack.push(...mintPieces(data)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(pack.length, 1);
  const [sword] = pack;
  const dfu = weaponOfMaterial(120, 5);
  assert.deepEqual([sword.group, sword.templateIndex, sword.material, sword.minDamage, sword.maxDamage], ['Weapons', 120, 5, dfu.minDamage, dfu.maxDamage], 'DFU\'s Mithril Longsword');
  assert.equal(sword.quality, r.data.quality);
  assert.ok(sword.quality >= 1, 'a clean heat at margin 0 is Standard or better');
  assert.equal(sword.maxCondition, Math.round(dfu.maxCondition * QUALITY_EFFECTS[sword.quality].condition), 'its quality on its condition');
  assert.equal(sword.provenance, r.data.pieces[0].provenance);
  assert.equal(readProductRecord(r.data.pieces[0].record).q, sword.quality);
  assert.equal(itemLongName(sword), sword.quality === 4 ? 'Silverthorn\'s Mithril Longsword' : sword.quality === 3 ? itemLongName(sword) : 'Mithril Longsword');
  assert.equal(book.held('ingot:mithril') + book.held('metal:copper') + book.held('leather:cured'), 0, 'the Stores spent, as the answer said');
  assert.equal(book.track('smithing').xp, xpForRank(55) + 600);
  assert.equal(book.pendingCrafts, 0);
});

test('PROF3 book: a craft is kept before it is asked - silence keeps it, the answer mints its pieces once; two tabs settling one kept craft mint it once; a refusal lets it go', async () => {
  const storage = memStorage();
  let online = false, asked = 0;
  const answer = (rid) => ({ ok: true, data: { recipe: 'dagger:iron', quality: 1, count: 1, seed: 7, maker: 'Ann', xp: 20, first: true, pieces: [{ provenance: PROV, record: null }], stores: [], track: null, rid } });
  const door = {
    account: () => 'acct-1', state: async () => ({ ok: true, data: {} }),
    craft: async (c, recipe, clean, name, rid) => { asked++; await noWait(); return online ? answer(rid) : { ok: false, error: 'offline' }; },
  };
  const minted = [];
  const a = createProfBook({ door, storage, character: () => 'char-a', sleep: noWait });
  const r = await a.craft('dagger:iron', { clean: true, name: 'Ann' }, (d) => minted.push(['a', d]));
  assert.deepEqual([r.ok, r.kept, a.pendingCrafts, minted.length], [false, true, 1, 0], 'no word: kept, nothing made');
  const b = createProfBook({ door, storage, character: () => 'char-a', sleep: noWait });
  online = true;
  await Promise.all([a.settle(() => {}, (d) => minted.push(['a', d])), b.settle(() => {}, (d) => minted.push(['b', d]))]);
  assert.equal(minted.length, 1, 'minted once, by the tab that let it go');
  assert.equal(a.pendingCrafts + b.pendingCrafts, 0);
  const again = await a.craft('dagger:iron', {}, () => minted.push('x'));
  assert.equal(again.ok, true);
  assert.equal(minted.length, 2);
  // a refusal lets the craft go
  door.craft = async () => ({ ok: false, error: 'prof-rank' });
  const no = await a.craft('longsword:daedric', {}, () => minted.push('y'));
  assert.deepEqual([no.ok, no.error, a.pendingCrafts, minted.length], [false, 'prof-rank', 0, 2]);
  // one at a time
  let release;
  door.craft = () => new Promise((res) => { release = () => res(answer('z')); });
  const first = a.craft('dagger:iron', {}, () => {});
  assert.deepEqual(await a.craft('dagger:iron', {}, () => {}), { ok: false, error: 'prof-busy' });
  release();
  await first;
  for (const e of ['prof-busy', 'prof-no-pack-form']) assert.doesNotMatch(accountRefusalText(e), /problem|could not be read/, e);
  void asked;
});

test('PROF3 piece: the quality laid on DFU\'s item - Crude\'s condition down, Fine\'s up and lighter, Superior\'s Magic and Masterwork\'s Rare off the record\'s seed (the same piece on every client), the mark its name; a tool\'s life; the fields declared', () => {
  const dfu = weaponOfMaterial(120, 5);
  const w = (q, maker = 'Silverthorn', seed = 99) => mintPiece({ recipe: 'longsword:mithril', quality: q, seed, maker }, PROV);
  assert.equal(w(0).maxCondition, Math.round(dfu.maxCondition * 0.75));
  assert.equal(w(1).maxCondition, dfu.maxCondition);
  assert.equal(w(2).maxCondition, Math.round(dfu.maxCondition * 1.15));
  assert.equal(w(1).weightInKg, undefined, 'Standard is DFU\'s own weight');
  assert.equal(w(2).weightInKg, Math.round(unitWeightInKg(dfu) * 0.95 * 100) / 100);
  assert.equal(w(3).weightInKg, Math.round(unitWeightInKg(dfu) * 0.9 * 100) / 100);
  assert.deepEqual([w(2).rarity, w(3).rarity, w(4).rarity], [undefined, 'magic', 'rare']);
  assert.deepEqual(w(4, 'Silverthorn', 99).affixes, w(4, 'Other', 99).affixes, 'the seed\'s roll, whoever mints it');
  assert.notDeepEqual(w(4, 'Silverthorn', 99).affixes, w(4, 'Silverthorn', 100).affixes);
  assert.equal(itemLongName(w(4)), 'Silverthorn\'s Mithril Longsword', 'the maker\'s mark is its name');
  assert.equal(itemLongName(w(1)), 'Mithril Longsword');
  assert.deepEqual([w(2).quality, w(2).provenance, w(2).maker], [2, PROV, 'Silverthorn']);
  assert.equal(mintPiece({ recipe: 'longsword:mithril', quality: 1, seed: 1 }, 'not-hex'), null);
  const plate = mintPiece({ recipe: 'cuirass:ebony', quality: 1, seed: 1 }, PROV);
  assert.deepEqual([plate.group, plate.templateIndex, plate.material, plate.maxCondition], ['Armor', 102, 0x0200 + 7, armorOfMaterial(102, 0x0207).maxCondition]);
  assert.equal(mintPiece({ recipe: 'chain-cuirass:steel', quality: 1, seed: 1 }, PROV).material, 0x0100);
  for (let q = 0; q <= 4; q++) {
    const axe = mintPiece({ recipe: 'woodaxe:iron', quality: q, seed: 1, maker: 'Ann' }, PROV);
    assert.deepEqual([axe.templateIndex, axe.maxCondition, axe.currentCondition, axe.rarity], [1600, TOOL_LIFE[q], TOOL_LIFE[q], undefined], `a tool's life at ${q}`);
  }
  for (const f of ['quality', 'provenance', 'maker', 'kitMetal']) assert.ok(ITEM_FIELDS[f], `${f} is a declared item field`);
  assert.match(craftedText([w(2)]), /^You made a Fine Mithril Longsword$/);
  assert.match(craftedText([w(4)]), /^You made Silverthorn's Mithril Longsword$/, 'PROF4: a marked name takes no article (it said "an" for a maker whose name began with a vowel)');
  void lootRarityOn;
});

test('PROF3 kit: the Repair Kit - its metal\'s name and dye, no quality; used, it mends the most-worn piece of its metal by a quarter (never past three quarters - KIT-CEILING) and is spent; Steel\'s mends the chain; nothing to mend keeps it', () => {
  installSmithing();
  const kit = mintPiece({ recipe: 'kit:mithril', quality: -1, seed: 1, maker: 'Ann' }, PROV);
  assert.deepEqual([kit.templateIndex, kit.name, kit.kitMetal, kit.quality], [REPAIR_KIT_TEMPLATE, 'Mithril Repair Kit', 5, undefined]);
  assert.equal(templateByIndex(REPAIR_KIT_TEMPLATE).name, 'Repair Kit');
  assert.equal(inventoryItemImage(kit).dye, DYE_COLORS.Mithril, 'dyed by its metal');
  const sword = weaponOfMaterial(120, 5); sword.currentCondition = Math.floor(sword.maxCondition * 0.5);
  const worn = weaponOfMaterial(113, 5); worn.currentCondition = Math.floor(worn.maxCondition * 0.1);
  const iron = weaponOfMaterial(120, 0); iron.currentCondition = 1;
  const items = [sword, worn, iron, kit];
  const done = useRepairKit(kit, items);
  assert.equal(done.item, worn, 'the most-worn of its metal - not the Iron');
  assert.equal(worn.currentCondition, Math.floor(worn.maxCondition * 0.1) + Math.ceil(worn.maxCondition * 0.25));
  assert.equal(items.includes(kit), false, 'spent');
  const kit2 = mintPiece({ recipe: 'kit:mithril', quality: -1, seed: 1 }, PROV);
  worn.currentCondition = Math.floor(worn.maxCondition * 0.75) - Math.floor(worn.maxCondition / 100) - 1;   // AUDIT ECON R2: more than a hundredth under it
  sword.currentCondition = sword.maxCondition;
  const list = [sword, worn, kit2];
  useRepairKit(kit2, list);
  assert.equal(worn.currentCondition, Math.floor(worn.maxCondition * 0.75), 'never past three quarters (KIT-CEILING)');
  const steel = mintPiece({ recipe: 'kit:steel', quality: -1, seed: 1 }, PROV);
  assert.deepEqual([kitMends(1, armorOfMaterial(102, 0x0100)), kitMends(1, armorOfMaterial(102, 0x0201)), kitMends(5, armorOfMaterial(102, 0x0100)), kitMends(5, armorOfMaterial(102, 0x0000))], [true, true, false, false]);
  const none = [steel, iron];
  assert.deepEqual(repairKitUse(steel, none), { kind: 'repairKit', text: 'Nothing of Steel here wants mending.', refused: true });   // AUDIT ECON R3: a refusal
  assert.equal(none.includes(steel), true, 'kept');
  assert.equal(itemUseHandler(REPAIR_KIT_TEMPLATE), repairKitUse, 'on the item-use door');
});

test('PROF3 heat: the glow rises and falls; three strikes on the band are a clean act, a strike off it is not, a strike too soon is none; gentle acts are never clean; let go, nothing', () => {
  const [lo, hi] = heatWindow(1);
  const t = (g) => (HEAT_ACT.periodS / (2 * Math.PI)) * Math.acos(1 - 2 * g);   // the first moment the glow is g
  const inBand = t((lo + hi) / 2);
  const act = createHeatAct({ band: 1 });
  act.tick(inBand);
  assert.equal(act.inBand, true);
  assert.equal(act.strike(), true);
  assert.equal(act.strike(), null, 'a hammer falls no faster than its gap');
  act.tick(HEAT_ACT.periodS);   // a breath later: the same glow
  assert.equal(act.strike(), true);
  act.tick(HEAT_ACT.periodS);
  assert.equal(act.strike(), true);
  assert.deepEqual(act.report(), { strikes: 3, hits: 3, clean: true });
  assert.equal(act.strike(), null, 'three and done');
  const off = createHeatAct({ band: 1 });
  off.tick(0.05);
  assert.equal(off.strike(), false, 'cold');
  off.tick(inBand); off.strike(); off.tick(HEAT_ACT.periodS); off.strike();
  assert.deepEqual(off.report(), { strikes: 3, hits: 2, clean: false });
  const gentle = createHeatAct({ gentle: true });
  gentle.tick(inBand);
  assert.equal(gentle.strike(), false, 'gentle: in the band, a plain strike');
  gentle.tick(HEAT_ACT.periodS); gentle.strike(); gentle.tick(HEAT_ACT.periodS); gentle.strike();
  assert.deepEqual(gentle.report(), { strikes: 3, hits: 0, clean: false });
  const gone = createHeatAct();
  gone.tick(inBand); gone.strike(); gone.cancel();
  gone.tick(HEAT_ACT.periodS);
  assert.equal(gone.strike(), null, 'let go: no more strikes');
  assert.equal(gone.report().clean, false);
  assert.ok(createHeatAct({ band: 1.3 }).state.hi > act.state.hi, 'the attribute band widens it');
});

test('PROF3 anvil page: at a smith\'s forge - the families and metals, a recipe\'s inputs with the smith\'s stock where a fitting is short, the odds; Craft strikes the heat and asks the craft with its report; Quick craft skips it; away from a forge, the word where it is', async () => {
  const { setProfessionsPages, drawStoresPage, STOCK_STAYS_LINE } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('gentleActs', false);
  const held = new Map([['ingot:mithril', 3], ['metal:copper', 1]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: () => ({ profession: 'smithing', xp: xpForRank(55), rank: 55, specs: { 50: null, 100: null } }), materials: () => [],
    pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const crafted = [], bought = [];
  let forge = { kind: 'shop', fee: 50 };
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => forge, smelt: async () => ({ ok: true, text: '' }),
    craft: async (recipe, o) => { crafted.push([recipe, o.clean]); return { ok: true, text: 'made' }; },
    stock: async (m, n) => { bought.push([m, n]); held.set(m, (held.get(m) ?? 0) + n); return { ok: true, text: 'bought' }; },
    heatBand: () => 1,
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  const press = (label) => buttons().find((b) => b.textContent.startsWith(label)).onclick();
  assert.match(text(), /The Anvil/);
  assert.match(text(), /The smith's anvil - 50 gold a craft/);
  press('Mithril');
  const row = buttons().find((b) => b.textContent.startsWith('Mithril Longsword'));
  assert.match(row.textContent, /wants its inputs/, 'no Cured Leather yet');
  row.onclick();
  assert.match(text(), /Cured Leather|leather:cured/);
  assert.match(text(), /margin 0: Crude 20 \| Standard 60 \| Fine 20/);
  assert.equal(buttons().find((b) => b.textContent === 'Craft').disabled, true);
  await press('Buy 1 from the smith - 4 silver');
  assert.deepEqual(bought, [['leather:cured', 1]]);
  assert.equal(buttons().find((b) => b.textContent === 'Craft').disabled, false);
  press('Craft');
  assert.match(text(), /The heat/);
  const strike = buttons().find((b) => b.textContent === 'Strike');
  assert.ok(strike, 'the heat stands');
  // three strikes: the act asks the craft with its report
  for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r, 400)); buttons().find((b) => b.textContent === 'Strike')?.onclick(); }
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(crafted.length, 1);
  assert.equal(crafted[0][0], 'longsword:mithril');
  assert.equal(typeof crafted[0][1], 'boolean');
  await press('Quick craft');
  assert.deepEqual(crafted[1], ['longsword:mithril', false], 'quick: no heat, no step');
  // a home's forge sells no stock
  forge = { kind: 'home', fee: 0 };
  held.delete('leather:cured');
  draw();
  press('Mithril');
  buttons().find((b) => b.textContent.startsWith('Mithril Longsword')).onclick();
  assert.equal(buttons().some((b) => b.textContent.startsWith('Buy ')), false);
  assert.match(text(), /Your anvil/);
  forge = null;
  draw();
  assert.match(text(), /Smithing is done at an anvil, beside a forge/);
  assert.match(STOCK_STAYS_LINE, /stays at the bench/);
  setProfessionsPages(null);
  root.remove();
});

test('PROF3 wiring: the host mints a craft\'s pieces once each by provenance, pays the smith on the answer, asks the heat\'s band off STR and AGI; every host installs the kit\'s use; the Stores refuse to withdraw the stock', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const pieces = mintPieces\(data\)\.filter\(\(it\) => !it\.provenance \|\| !have\.has\(it\.provenance\)\);/);   // PROF4: arrows carry none
  assert.match(w, /settle: \(\) => profBook\.settle\(profMint, profMintCraft\),/);
  assert.match(w, /onSettle: \(\) => \{ profBook\.settle\(profMint, profMintCraft\)\.catch\(\(\) => \{\}\); \},/);
  // PROF4: a Heartwood for a plank; AUDIT 30 C4: the fee rides the kept craft and is paid where its pieces are minted
  // PROF7 moved it: the station's own kept word (craftStation), and a garment's dye beside the Heartwood
  assert.match(w, /const r = await profBook\.craft\(recipe, \{ clean, heartwood, dye, cracked, fee: f\.fee > 0 \? f\.fee : 0, name: [^\n]*\n\s*\/\/ CRAFT1 \(bible[^\n]*\n\s*\/\/ AUDIT CRAFT1 F3: [^\n]*\n\s*const chain = \[refinedText\([^\n]*\n\s*if \(!r\?\.ok\) return \{ ok: false, text: r\?\.kept \? `\$\{st\.kept\}\$\{chain \? ` \$\{chain\}` : ''\}` : `\$\{accountRefusalText\(r\?\.error\)\}\$\{movedFirstText\(r\)\}\$\{chain \? ` \$\{chain\}` : ''\}` \};/);   // PIN MOVED (PROF10): a Lapidary's `cracked` gem; (AUDIT PROF-541 R2-C2) the busy word the book's   // PIN MOVED (AUDIT2 BAG1 K8): and what went into the Stores first; (CRAFT1) and what the chain refined first - kept or refused (AUDIT CRAFT1 F3)
  assert.match(w, /const profMintCraft = \(data, kept = null\) => \{\n\s*if \(kept\?\.fee > 0\) \{ deductGold\(playerEntity, Math\.min\(kept\.fee, totalGoldAmount\(playerEntity\)\)\); saveSoon\.changed\(\); \}/);
  assert.match(w, /heatBand: \(\) => heatBand\(\{ strength: liveStat\(playerEntity, 'strength'\), agility: liveStat\(playerEntity, 'agility'\) \}\),/);
  assert.match(src('src/scenes/shared.js'), /installSmithing\(\);/);
  assert.match(src('src/ui/profPages.js'), /go\.disabled = _stores\.busy \|\| !withdrawable\(pick\.material\);/);
  assert.equal(recipeById('longsword:mithril').templateIndex, 120);
});
