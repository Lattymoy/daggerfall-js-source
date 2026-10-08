// CRAFT4 (2026-10-07, Mac: "How could we enhance the profession element of the game while reducing complexity and
// making crafting more viable"; then "Lets do it") - TEMPERING AND REFORGING: the crafter improves what loot gives, never
// past law 7. A TEMPER (Smithing's weapons and metal armour, Outfitting's leather and cloth) takes a piece of Rare or below
// a quality step better, up to Superior, for half its recipe's main input from the Stores and the craft's XP; a made
// piece's record is re-signed. A REFORGE WITH ESSENCE (Enchanting 50) rolls one line of a Magic or Rare piece again for 2
// or 5 Arcane Essence, the seed the service's. The done-when: a found Steel Longsword tempered twice through the real
// Worker; a made one's record re-signed and the piece what it mints. bible/06-Systems/Professions-Arc.md 41.7.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, ARCANE_ESSENCE } from '../src/net/professionLaw.js';
import { recipeById, craftXp, QUALITY_EFFECTS, ARMOR_CHAIN, ARMOR_PLATE, ARMOR_LEATHER, pieceLines } from '../src/net/recipeLaw.js';
import {
  TEMPER_TOP, TEMPER_KINDS, temperableRecipe, pieceQuality, temperRecipeOf, temperCost, temperXp, temperFrom, temperRefusal, temperStep,
  REFORGE_RANK, REFORGE_ESSENCE, reforgeEssence,
} from '../src/net/temperLaw.js';
import { mintProductRecord, readProductRecord } from '../src/net/productRecord.js';
import { mintPiece, asMinted, temperItem, reforgeItem, essenceReforgeRefusal } from '../src/systems/smithItems.js';
import { weaponOfMaterial, armorOfMaterial } from '../src/combat/enemyEquipment.js';
import { applyRarity, reforgeAffix, reforgeableLines } from '../src/systems/lootRarity.js';
import { seededRng } from '../src/systems/wind.js';
import { unitWeightInKg } from '../src/systems/inventory.js';

const { subtle } = webcrypto;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const STEEL = 'ingot:steel';
let _rid = 0;
const rid = () => `craft4-${String(++_rid).padStart(6, '0')}`;

/** A service, Mac in it with a track at a rank and the Stores given, and Mac's book. */
async function stand({ tracks = {}, stores = {} } = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  for (const [p, rank] of Object.entries(tracks)) raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, mac.character, p, xpForRank(rank));
  const give = (key, qty, origin = 'own') => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, key, origin, qty);
  for (const [k, n] of Object.entries(stores)) give(k, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const held = (key) => Number(raw.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM prof_stores WHERE player = ? AND material = ?').get(mac.id, key).n);
  const xp = (p) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND profession = ?').get(mac.id, p)?.xp ?? 0);
  const ask = (path, body) => s.call(path, { character: mac.character, ...body }, mac.secret);
  return { s, raw, mac, door, book, give, held, xp, ask };
}

/** A piece this account made, its record minted as the anvil mints it (unsigned - the temper signs the new one). */
async function madePiece(t, { provenance = 'a1b2c3d4e5f60718', recipe = 'longsword:steel', quality = 2, seed = 4242, owner = t.mac } = {}) {
  const r = recipeById(recipe);
  const record = await mintProductRecord({ p: provenance, s: owner.id, h: owner.character, r: recipe, q: quality, m: 'Mac', c: seed }, null, { subtle, nowS: 1 });
  t.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES (?, ?, ?, 'Mac', ?, ?, ?, ?, ?, ?, 1)`).run(provenance, owner.id, owner.character, recipe, r.templateIndex, r.material ?? 0, quality, seed, record);
  return mintPiece({ recipe, quality, seed, maker: 'Mac' }, provenance);
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('CRAFT4 DONE WHEN: a found Steel Longsword tempered twice through the real Worker - Standard to Fine to Superior, 2 Steel Ingots each, the craft\'s XP; its condition and weight the step\'s, its card its quality; a Superior has no step left', async () => {
  const t = await stand({ tracks: { smithing: 10 }, stores: { [STEEL]: 4 } });
  const sword = weaponOfMaterial(120, 1);   // DFU's own Steel Longsword, as a dungeon drops it
  const base = { max: sword.maxCondition, kg: unitWeightInKg(sword) };
  sword.currentCondition = Math.round(base.max / 2);   // worn to half - the temper keeps the share
  assert.equal(temperRecipeOf(sword)?.id, 'longsword:steel');
  assert.equal(pieceQuality(sword), 1, 'a found piece is Standard');
  const r1 = await t.book.temper('longsword:steel', 1, null);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.deepEqual([r1.data.quality, r1.data.provenance, r1.data.xp], [2, null, craftXp(2, 10, false)]);
  assert.equal(temperItem(sword, r1.data), true);
  assert.deepEqual([sword.quality, sword.maxCondition, sword.currentCondition, sword.weightInKg], [2, Math.round(base.max * 1.15), Math.round(Math.round(base.max * 1.15) / 2), Math.round(base.kg * 0.95 * 100) / 100]);
  assert.deepEqual(pieceLines(sword), ['Fine'], 'its card says it');
  assert.equal(t.held(STEEL), 2, 'half of 3 ingots, rounded up');
  const r2 = await t.book.temper('longsword:steel', 2, null);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(temperItem(sword, r2.data), true);
  assert.equal(sword.quality, TEMPER_TOP);
  assert.equal(sword.rarity, undefined, 'a found piece\'s Loot Rarity is its own - the step is condition and weight');
  assert.equal(t.held(STEEL), 0);
  assert.equal(t.xp('smithing'), xpForRank(10) + 2 * craftXp(2, 10, false));
  assert.equal(temperRefusal(sword), 'top');
  assert.equal(temperItem(sword, { quality: 4 }), false, 'never past Superior');
  const two = weaponOfMaterial(120, 1), was = JSON.stringify(two);
  assert.equal(temperItem(two, { quality: 3 }), false, 'one step, never two');
  assert.equal(JSON.stringify(two), was, 'nothing changed');
  assert.equal((await t.ask('/v1/prof/temper', { recipe: 'longsword:steel', quality: 3, rid: rid() })).body.error, 'prof-temper-top');
  assert.equal(t.raw.prepare('SELECT COUNT(*) AS n FROM prof_tempers').get().n, 2);
});

test('CRAFT4 a made piece: its products row a step better and its record re-signed at the new quality - the market sees what it is; the piece what that record mints (a Superior\'s Magic roll off its seed), its wear kept as a share', async () => {
  const t = await stand({ tracks: { smithing: 10 }, stores: { [STEEL]: 2 } });
  const piece = await madePiece(t, { quality: 2 });
  assert.equal(asMinted(piece), true);
  piece.currentCondition = Math.round(piece.maxCondition * 0.4);
  const r = await t.book.temper('longsword:steel', 2, piece.provenance);
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = t.raw.prepare('SELECT quality, record FROM products WHERE provenance = ?').get(piece.provenance);
  assert.equal(row.quality, 3);
  assert.equal(r.data.record, row.record, 'answered the record it stands at');
  const c = readProductRecord(row.record);
  assert.deepEqual([c.q, c.c, c.r, c.m, c.signed], [3, 4242, 'longsword:steel', 'Mac', true], 're-signed with the service\'s key');
  assert.equal(temperItem(piece, r.data), true);
  const fresh = mintPiece({ recipe: 'longsword:steel', quality: 3, seed: 4242, maker: 'Mac' }, piece.provenance);
  assert.deepEqual([piece.quality, piece.rarity, piece.affixes, piece.name, piece.maxCondition, piece.weightInKg], [fresh.quality, 'magic', fresh.affixes, fresh.name, fresh.maxCondition, fresh.weightInKg]);
  assert.equal(piece.currentCondition, Math.round(fresh.maxCondition * 0.4));
  assert.equal(asMinted(piece), true, 'still as its record mints - it lists');
  // asked again at the quality it was, a new ask: the piece is not what it was
  assert.equal((await t.ask('/v1/prof/temper', { recipe: 'longsword:steel', quality: 2, provenance: piece.provenance, rid: rid() })).body.error, 'prof-temper-stale');
  // a made piece enchanted since keeps what it carries - the step's condition and weight alone
  const enchanted = mintPiece({ recipe: 'longsword:steel', quality: 1, seed: 7, maker: 'Mac' }, 'f0e1d2c3b4a59687');
  enchanted.customEnchantments = [{ type: 1, param: 2 }];
  const max = enchanted.maxCondition;
  assert.equal(temperItem(enchanted, { quality: 2, record: null }), true);
  assert.deepEqual([enchanted.quality, enchanted.maxCondition, enchanted.customEnchantments.length], [2, Math.round(max * 1.15), 1]);
  const fine = await madePiece(t, { provenance: '3333333333333333', quality: 2, seed: 4242 });
  fine.customEnchantments = [{ type: 1, param: 2 }];
  const rec = await mintProductRecord({ p: fine.provenance, s: t.mac.id, h: t.mac.character, r: 'longsword:steel', q: 3, m: 'Mac', c: 4242 }, null, { subtle, nowS: 1 });
  assert.equal(temperItem(fine, { quality: 3, record: rec }), true);
  assert.deepEqual([fine.quality, fine.rarity, fine.customEnchantments.length], [3, undefined, 1], 'enchanted since, never minted again - no roll over what it carries');
});

test('CRAFT4 the temper\'s refusals: the rank, the Stores (gold\'s units never), a piece no temper takes, a quality with no step, another\'s piece, none, a listed one, a bad id; a request asked twice answered once', async () => {
  const t = await stand({ tracks: { smithing: 9 }, stores: { [STEEL]: 1 } });
  const ask = (body) => t.ask('/v1/prof/temper', { recipe: 'longsword:steel', quality: 1, rid: rid(), ...body });
  assert.equal((await ask({})).body.error, 'prof-rank', 'the Steel\'s rank, 10');
  t.raw.prepare('UPDATE prof_tracks SET xp = ? WHERE player = ?').run(xpForRank(10), t.mac.id);
  assert.equal((await ask({})).body.error, 'stores-short');
  t.give(STEEL, 5, 'gold');
  assert.equal((await ask({})).body.error, 'stores-gold', 'units bought with gold are the market\'s, never a temper\'s');
  for (const recipe of ['ring:silver', 'staff:pine', 'repair-kit:iron', 'nope']) assert.equal((await ask({ recipe })).body.error, 'prof-temper', recipe);
  for (const quality of [3, 4, -1, 1.5, '1']) assert.equal((await ask({ quality })).body.error, 'prof-temper-top', String(quality));
  assert.equal((await ask({ provenance: 'zz' })).body.error, 'bad-piece');
  t.give(STEEL, 9);
  assert.equal((await ask({ provenance: '0123456789abcdef' })).body.error, 'prof-no-piece');
  const other = await t.s.registered('Ilsa');
  await madePiece(t, { provenance: '1111111111111111', quality: 1, owner: other });
  assert.equal((await ask({ provenance: '1111111111111111' })).body.error, 'prof-not-yours');
  await madePiece(t, { provenance: '2222222222222222', quality: 1 });
  assert.equal((await ask({ provenance: '2222222222222222', recipe: 'longsword:iron' })).body.error, 'prof-temper', 'of the recipe asked');
  t.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run('2222222222222222');
  assert.equal((await ask({ provenance: '2222222222222222' })).body.error, 'prof-piece-busy', 'listed');
  assert.equal(t.held(STEEL), 14, 'nothing spent by a refusal');
  const once = { recipe: 'longsword:steel', quality: 1, rid: 'the-one-temper' };
  const a = await t.ask('/v1/prof/temper', once), b = await t.ask('/v1/prof/temper', once);
  assert.deepEqual([a.body.ok, a.body.repeat, b.body.ok, b.body.repeat, b.body.quality], [true, undefined, true, true, 2]);
  assert.equal(t.held(STEEL), 12, 'spent once');
  const asked = await t.ask('/v1/prof/temper', { ...once, quality: 3 });
  assert.deepEqual([asked.body.repeat, asked.body.quality], [true, 2], 'a request asked again is its first answer, whatever it says now');
  for (const k of ['prof-temper', 'prof-temper-top', 'prof-temper-stale', 'prof-reforge']) assert.equal(typeof REFUSALS[k], 'string', k);
});

// ─── THE LAW ─────────────────────────────────────────────────────────

test('CRAFT4 law: the recipe a piece is tempered by - its own where made; a found weapon or plate in its metal, chain the Steel\'s, leather the Cured Leather\'s, a garment the Linen\'s, none for a staff; law 7 refused; half the main input rounded up; the step\'s shares', () => {
  assert.deepEqual([...TEMPER_KINDS], ['weapon', 'plate', 'shield', 'chain', 'leather', 'garment']);
  assert.deepEqual(['longsword:steel', 'ring:silver', 'staff:pine', 'leather-cuirass:cured'].map((id) => temperableRecipe(recipeById(id))), [true, false, false, true]);
  assert.equal(temperRecipeOf(weaponOfMaterial(120, 7))?.id, 'longsword:ebony', 'Ebony\'s, never the Warforged\'s');
  assert.equal(temperRecipeOf({ recipe: 'longsword:warforged' })?.id, 'longsword:warforged', 'a made piece its own');
  assert.equal(temperRecipeOf(armorOfMaterial(102, ARMOR_CHAIN))?.id, 'chain-cuirass:steel');
  assert.equal(temperRecipeOf(armorOfMaterial(102, ARMOR_PLATE + 1))?.id, 'cuirass:steel');
  assert.equal(temperRecipeOf(armorOfMaterial(102, ARMOR_LEATHER))?.id, 'leather-cuirass:cured');
  assert.equal(temperRecipeOf(armorOfMaterial(109, ARMOR_PLATE))?.id, 'buckler:iron');
  assert.deepEqual([temperRecipeOf({ group: 'MensClothing', templateIndex: 163 })?.id, temperRecipeOf({ group: 'WomensClothing', templateIndex: 200 })?.id], ['garment-163:linen', 'garment-200:linen']);
  const staff = recipeById('staff:pine');
  assert.equal(temperRecipeOf(weaponOfMaterial(staff.templateIndex, staff.material)), null, 'a staff is the workbench\'s - no temper');
  assert.deepEqual([temperRecipeOf({ recipe: 'ring:silver' }), temperRecipeOf(null), temperRecipeOf({ group: 'Jewellery', templateIndex: 133 })], [null, null, null]);
  const sword = () => weaponOfMaterial(120, 1);
  assert.deepEqual([
    temperRefusal(sword()), temperRefusal({ ...sword(), sigil: { power: 'x' } }), temperRefusal({ ...sword(), rarity: 'legendary' }),
    temperRefusal({ ...sword(), rarity: 'aetheric' }), temperRefusal({ ...sword(), artifact: true }), temperRefusal({ ...sword(), rarity: 'artifact' }),
    temperRefusal({ ...sword(), quality: 4 }), temperRefusal({ ...sword(), quality: 3 }), temperRefusal({ ...sword(), rarity: 'rare' }), temperRefusal({ group: 'Books' }),
  ], [null, 'sigil', 'rarity', 'rarity', 'rarity', 'rarity', 'masterwork', 'top', null, 'not']);
  assert.deepEqual(['longsword:steel', 'leather-cuirass:cured', 'garment-163:linen', 'garment-141:linen', 'cuirass:steel'].map((id) => temperCost(recipeById(id))),
    [{ key: STEEL, n: 2 }, { key: 'leather:cured', n: 3 }, { key: 'cloth:linen', n: 2 }, { key: 'cloth:linen', n: 1 }, { key: STEEL, n: 3 }]);
  assert.equal(temperXp(recipeById('longsword:steel'), 70), craftXp(2, 70, false), 'a quarter, two tiers below the rank\'s top');
  assert.deepEqual([0, 1, 2, 3, 4, -1, 1.5].map(temperFrom), [true, true, true, false, false, false, false]);
  assert.deepEqual(temperStep(1), { condition: QUALITY_EFFECTS[2].condition, weight: QUALITY_EFFECTS[2].weight });
  assert.deepEqual(temperStep(0), { condition: 1 / 0.75, weight: 1 });
  assert.deepEqual([pieceQuality({}), pieceQuality({ quality: 0 }), pieceQuality({ quality: 3 })], [1, 0, 3]);
  assert.deepEqual([REFORGE_RANK, REFORGE_ESSENCE.magic, REFORGE_ESSENCE.rare], [50, 2, 5]);
  assert.deepEqual(['magic', 'rare', 'legendary', 'aetheric', 'artifact', 'common', undefined].map(reforgeEssence), [2, 5, null, null, null, null, null]);
});

// ─── THE REFORGE WITH ESSENCE ────────────────────────────────────────

test('CRAFT4 the Reforge with Essence through the real Worker: Enchanting 50, 2 Essence a Magic line and 5 a Rare\'s, never gold\'s units, no XP; the seed the service\'s and the piece\'s line rolled off it; a request asked twice the same seed', async () => {
  const t = await stand({ tracks: { enchanting: 49 }, stores: { [ARCANE_ESSENCE.key]: 7 } });
  const ask = (tier, id = rid()) => t.ask('/v1/prof/reforge', { tier, rid: id });
  assert.equal((await ask('magic')).body.error, 'prof-rank');
  t.raw.prepare('UPDATE prof_tracks SET xp = ? WHERE player = ?').run(xpForRank(50), t.mac.id);
  for (const tier of ['legendary', 'aetheric', 'artifact', 'common', null]) assert.equal((await ask(tier)).body.error, 'prof-reforge', String(tier));
  const sword = weaponOfMaterial(120, 1);
  applyRarity(sword, 'magic', seededRng(99));
  sword.isIdentified = true;
  const before = JSON.parse(JSON.stringify(sword));
  const r = await t.book.reforge('magic');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.essence, 2);
  assert.ok(Number.isSafeInteger(r.data.seed) && r.data.seed >= 0 && r.data.seed <= 0xffffffff);
  assert.equal(t.held(ARCANE_ESSENCE.key), 5);
  assert.equal(t.book.held(ARCANE_ESSENCE.key), 5, 'the book\'s Stores moved with the answer');
  const line = reforgeItem(sword, 0, r.data.seed);
  const want = JSON.parse(JSON.stringify(before));
  assert.deepEqual(line, reforgeAffix(want, 0, seededRng(r.data.seed >>> 0)));
  assert.deepEqual([sword.affixes, sword.reforged, sword.name], [want.affixes, 0, want.name]);
  assert.equal(t.xp('enchanting'), xpForRank(50), 'no XP - the Essence\'s was its disenchanting\'s');
  const again = await ask('rare', 'twice-reforge'), twice = await ask('rare', 'twice-reforge');
  assert.deepEqual([again.body.essence, twice.body.repeat, twice.body.seed], [5, true, again.body.seed]);
  assert.deepEqual([(await ask('legendary', 'twice-reforge')).body.repeat, (await ask('legendary', 'twice-reforge')).body.tier], [true, 'rare'], 'its first answer, whatever it asks now');
  assert.equal(t.held(ARCANE_ESSENCE.key), 0, 'spent once');
  assert.equal((await ask('magic')).body.error, 'stores-short');
  t.give(ARCANE_ESSENCE.key, 9, 'gold');
  assert.equal((await ask('magic')).body.error, 'stores-gold');
  assert.equal(t.raw.prepare('SELECT COUNT(*) AS n FROM prof_reforges').get().n, 2);
});

test('CRAFT4 the Reforge with Essence on the piece: the Loot arc\'s own Reforge - a known Magic or Rare piece, not worn, once reforged that line alone; nothing rolled for a refusal', () => {
  const magic = () => { const it = weaponOfMaterial(120, 1); applyRarity(it, 'magic', seededRng(5)); it.isIdentified = true; return it; };
  const it = magic();
  const lines = reforgeableLines(it);
  assert.ok(lines.length >= 1);
  assert.equal(essenceReforgeRefusal(it, lines[0]), null);
  const rare = weaponOfMaterial(120, 1);
  applyRarity(rare, 'rare', seededRng(5));
  assert.equal(essenceReforgeRefusal(rare, 0), 'unknown', 'a Rare\'s enchantment unread - the guild identifies it first');
  assert.equal(essenceReforgeRefusal({ ...magic(), equipSlot: 1 }, 0), 'worn');
  assert.equal(essenceReforgeRefusal(weaponOfMaterial(120, 1), 0), 'not', 'a Common piece has no line');
  const legend = weaponOfMaterial(120, 1);
  applyRarity(legend, 'legendary', seededRng(5));
  legend.isIdentified = true;
  assert.equal(essenceReforgeRefusal(legend, 0), 'not', 'law 7');
  legend.exalted = true;
  assert.ok(reforgeableLines(legend).length > 0, 'the Mages Guild reforges an Exalted\'s own line');
  assert.equal(essenceReforgeRefusal(legend, reforgeableLines(legend)[0]), 'not', 'Essence never - law 7');
  assert.ok(reforgeItem(it, lines[0], 12345));
  if (lines.length > 1) assert.equal(essenceReforgeRefusal(it, lines[1]), 'line', 'once reforged, that line alone');
  const kept = JSON.stringify(it);
  assert.equal(reforgeItem(it, lines[0], 1.5), null, 'a seed that is no integer rolls nothing');
  assert.equal(reforgeItem({ ...it, equipSlot: 2 }, lines[0], 7), null);
  assert.equal(JSON.stringify(it), kept);
});

// ─── THE PAGES AND THE HOST ──────────────────────────────────────────

test('CRAFT4 pages: the anvil\'s and the loom\'s Temper - each piece its step, its input and XP, Temper pressed or the rank said, the input short said; the enchanting station\'s Reforge with Essence its rank line below 50, each line a press from it', async () => {
  const { setProfessionsPages, drawStoresPage, TEMPER_NONE, ESSENCE_REFORGE_RANK_LINE, _temperForTests } = await import('../src/ui/profPages.js');
  const held = new Map([[STEEL, 2], ['leather:cured', 1], [ARCANE_ESSENCE.key, 3]]);
  const ranks = { smithing: 10, outfitting: 5, enchanting: 49 };
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0, gold: 0 }),
    track: (p) => ({ profession: p, xp: xpForRank(ranks[p] ?? 0), rank: ranks[p] ?? 0, specs: { 50: null, 100: null } }), materials: () => [],
    pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const sword = weaponOfMaterial(120, 1), cuirass = armorOfMaterial(102, ARMOR_LEATHER);
  const magic = weaponOfMaterial(120, 1);
  applyRarity(magic, 'magic', seededRng(3));
  magic.isIdentified = true;
  const asked = [];
  const home = () => ({ kind: 'home', fee: 0 });
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: home, loom: home, enchanter: home, smelt: async () => ({ ok: true, text: '' }),
    craft: async () => ({ ok: true, text: '' }), heatBand: () => 1, stitchBand: () => 1, disenchant: async () => ({ ok: true, text: '' }), disenchantable: () => [],
    temperable: (where) => (where === 'loom' ? [{ item: cuirass, name: 'Leather Cuirass', recipe: 'leather-cuirass:cured', quality: 1, provenance: null }]
      : [{ item: sword, name: 'Steel Longsword', recipe: 'longsword:steel', quality: 1, provenance: null }]),
    temper: async (offer) => { asked.push(['temper', offer.recipe]); return { ok: true, text: 'Steel Longsword is Fine now.' }; },
    reforgeable: () => [{ item: magic, name: 'Magic Longsword', tier: 'magic', lines: [{ index: 0, text: 'the line' }] }],
    essenceReforge: async (offer, index) => { asked.push(['reforge', offer.tier, index]); return { ok: true, text: 'Reforged.' }; },
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, { el, divider: (w) => el('h3', null, w), meter: () => el('div') }); };
  try {
    draw();
    const buttons = () => [...root.querySelectorAll('button')];
    assert.match(root.textContent, /Temper at the Anvil/);
    assert.match(root.textContent, new RegExp(`Steel Longsword.*Standard to Fine - 2 ${STEEL}, \\+${craftXp(2, 10, false)} Smithing XP`));
    const temper = buttons().find((b) => b.textContent === 'Temper');
    assert.equal(temper.disabled, false, 'offered');
    assert.match(root.textContent, /Temper at the Loom/);
    assert.ok(buttons().some((b) => b.textContent === 'Outfitting 10' && b.disabled), 'the Cured Leather\'s rank said, not pressed');
    await temper.onclick();
    assert.deepEqual(asked[0], ['temper', 'longsword:steel']);
    assert.match(root.textContent, /Steel Longsword is Fine now\./);
    assert.equal(_temperForTests().busy, null);
    assert.match(root.textContent, /Reforge with Essence/);
    assert.ok(root.textContent.includes(ESSENCE_REFORGE_RANK_LINE), 'below Enchanting 50, its rank said');
    ranks.enchanting = 50;
    draw();
    const rf = buttons().find((b) => b.textContent === 'Reforge: the line');
    assert.equal(rf.disabled, false, '3 Essence held, 2 a Magic line');
    await rf.onclick();
    assert.deepEqual(asked[1], ['reforge', 'magic', 0]);
    held.set(ARCANE_ESSENCE.key, 1);
    held.set(STEEL, 1);
    draw();
    assert.equal(buttons().find((b) => b.textContent === 'Reforge: the line').disabled, true, 'the Essence short');
    assert.equal(buttons().find((b) => b.textContent === 'Temper').disabled, true, 'the ingots short');
    assert.match(root.textContent, new RegExp(`Needs 2 ${STEEL}\\.`));
    assert.ok(TEMPER_NONE.includes('Superior'));
  } finally { setProfessionsPages(null); root?.remove(); }
});

test('CRAFT4 the host wires it (scenes/world.js): the anvil\'s and the loom\'s pieces not worn, no market act on them, the step on the answer and the fee paid; the Reforge with Essence the line rolled on the seed; the service routes both', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /temperable: \(where\) => \(playerEntity\.items \?\? \[\]\)\.filter\(\(it\) => it && !isEquipped\(it\) && !temperRefusal\(it\) && !\(typeof it\.provenance === 'string' && pieceKept\(it\.provenance\)\)\)/);
  assert.match(w, /const took = pack\.includes\(it\) && temperItem\(it, r\.data\);/);
  assert.match(w, /const line = pack\.includes\(it\) && r\.data\?\.tier === it\.rarity \? reforgeItem\(it, index, r\.data\.seed\) : null;/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'\/v1\/prof\/temper': \(\) => temperPiece\(ctx, who\.player, env, body\)/);
  assert.match(idx, /'\/v1\/prof\/reforge': \(\) => reforgeWithEssence\(ctx, who\.player, env, body\)/);
  assert.match(src('server-account/migrations/0089_temper_reforge.sql'), /CREATE TABLE IF NOT EXISTS prof_tempers[\s\S]*CREATE TABLE IF NOT EXISTS prof_reforges/);
});
