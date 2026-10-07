// CRAFT5 (2026-10-07, Mac: "How could we enhance the profession element of the game while reducing complexity and
// making crafting more viable"; then "Lets do it") - THE CONSUMABLES, LEANED INTO: a Superior or Masterwork Repair Kit
// mends up to nine tenths of a piece's condition (KIT_CEILING's three quarters for the rest) - a kit's craft rolls a
// quality now, its reach; a dish's buff and a Potent potion stand together (MEASURED: they already did - pinned); arrows a
// Building product (CRAFT3 made them so - pinned). bible/06-Systems/Professions-Arc.md 41.8.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, trackOf } from '../src/net/professionLaw.js';
import {
  recipeById, RECIPES, KIT_CEILING, KIT_CEILING_HIGH, KIT_HIGH_QUALITY, kitReach, rollsQuality, takesQuality, pieceLines, dishOf, MASTERWORK,
} from '../src/net/recipeLaw.js';
import { productRecordValid, readProductRecord } from '../src/net/productRecord.js';
import { mintPiece, mintPieces, useRepairKit, repairKitUse, kitCeiling, craftedText, mintFieldRepairKit, KIT_CEILING_TEXT, KIT_CEILING_HIGH_TEXT, kitCeilingText } from '../src/systems/smithItems.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { feedEffect } from '../src/systems/cookItems.js';
import { applySpell } from '../src/systems/effects.js';
import { potionBundle, potionRecipeKey, POTION_RECIPES } from '../src/systems/potions.js';
import { potentEffect, POTENT } from '../src/net/alchemyLaw.js';
import { liveStat } from '../src/systems/statMods.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const PROV = '0123456789abcdef';
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
/** A Steel Longsword worn to `share` of its condition. */
const worn = (share) => { const s = weaponOfMaterial(120, 1); s.currentCondition = Math.round(s.maxCondition * share); return s; };

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('CRAFT5 DONE WHEN: a Superior Steel Repair Kit mends a Steel Longsword at 70% to 90%, a Standard kit to 75% - the kit\'s quality its reach; a Masterwork\'s nine tenths too, a field kit and one made before kits took a quality three quarters', () => {
  const kit = (quality) => mintPiece({ recipe: 'kit:steel', quality, seed: 1 }, PROV);
  const reach = (k, share = 0.7) => { const s = worn(share); const pack = [k, s]; useRepairKit(k, pack); return s.currentCondition / s.maxCondition; };
  const s0 = worn(0.7);
  assert.equal(reach(kit(3)), Math.floor(s0.maxCondition * 0.9) / s0.maxCondition, 'Superior: nine tenths');
  assert.equal(reach(kit(4)), Math.floor(s0.maxCondition * 0.9) / s0.maxCondition, 'Masterwork: nine tenths');
  assert.equal(reach(kit(2)), Math.floor(s0.maxCondition * 0.75) / s0.maxCondition, 'Fine: three quarters');
  assert.equal(reach(kit(1)), Math.floor(s0.maxCondition * 0.75) / s0.maxCondition);
  assert.equal(reach(kit(-1)), Math.floor(s0.maxCondition * 0.75) / s0.maxCondition, 'a kit made before: none, three quarters');
  assert.equal(reach(mintFieldRepairKit()), Math.floor(s0.maxCondition * 0.75) / s0.maxCondition, 'a field kit: three quarters');
  // a piece between three quarters and nine tenths: a Superior kit's to mend, past any other's
  assert.equal(reach(kit(3), 0.8), Math.floor(s0.maxCondition * 0.9) / s0.maxCondition, 'a Superior kit takes a piece at 80% - no other would');
  const k80 = kit(4), p80 = worn(0.8);
  assert.match(repairKitUse(k80, [k80, p80], { chooseTarget: true }).text, /is mended: 80% to 90%\./, 'the one piece mended at once - nothing held back to choose against');
  assert.equal(reach(kit(3), 0.2), (Math.round(s0.maxCondition * 0.2) + Math.ceil(s0.maxCondition * 0.25)) / s0.maxCondition, 'the work a quarter still - the reach its ceiling alone');
  // the kit's quality its own: its card and its craft's word
  assert.deepEqual(pieceLines(kit(3)), ['Superior', 'Mends a quarter of a Steel piece\'s condition, up to 90%, once']);
  assert.deepEqual(pieceLines(kit(-1)), ['Mends a quarter of a Steel piece\'s condition, up to 75%, once']);
  assert.equal(craftedText([kit(3)]), 'You made a Superior Steel Repair Kit');
  assert.deepEqual([kit(-1).quality, kit(0).quality, kit(4).quality], [undefined, 0, 4]);
  // a piece a Superior kit holds back says the kit's own reach
  const high = worn(0.89), k3 = kit(3);
  assert.deepEqual(repairKitUse(k3, [k3, high]), { kind: 'repairKit', text: KIT_CEILING_HIGH_TEXT, refused: true });
  const mid = worn(0.75), k1 = kit(1);
  assert.deepEqual(repairKitUse(k1, [k1, mid]), { kind: 'repairKit', text: KIT_CEILING_TEXT, refused: true });
});

test('CRAFT5 law: a kit\'s craft rolls a quality, its reach - never a takesQuality piece (no commission\'s least quality, no auction); the record a kit\'s quality, or none for one made before; the reach Superior up', () => {
  assert.deepEqual([KIT_CEILING, KIT_CEILING_HIGH, KIT_HIGH_QUALITY], [0.75, 0.9, 3]);
  const kitR = recipeById('kit:steel');
  assert.deepEqual([rollsQuality(kitR), takesQuality(kitR), rollsQuality(recipeById('arrows:north')), rollsQuality(recipeById('longsword:steel')), rollsQuality(recipeById('ramkit:oak'))], [true, false, false, true, false]);
  assert.deepEqual([null, {}, { quality: -1 }, { quality: 0 }, { quality: 2 }, { quality: 3 }, { quality: 4 }, { quality: 1.5 }].map(kitReach), [0.75, 0.75, 0.75, 0.75, 0.75, 0.9, 0.9, 0.75]);
  assert.deepEqual([kitCeilingText(null), kitCeilingText({ quality: 3 })], [KIT_CEILING_TEXT, KIT_CEILING_HIGH_TEXT]);
  const s = worn(0.5);
  assert.deepEqual([kitCeiling(s), kitCeiling(s, { quality: 4 })], [Math.floor(s.maxCondition * 0.75), Math.floor(s.maxCondition * 0.9)]);
  const what = { p: PROV, s: 'acct-aaaaaaaaaa', h: 'char-aldric', r: 'kit:iron', m: null, c: 7, i: 1 };
  assert.deepEqual([-1, 0, 3, 4, 5, 1.5].map((q) => productRecordValid({ ...what, q })), [true, true, true, true, false, false], 'a kit its quality - or none, one made before');
  assert.deepEqual([-1, 0].map((q) => productRecordValid({ ...what, r: 'arrows:north', q })), [true, false], 'arrows none, as ever');
  assert.deepEqual([-1, 2].map((q) => productRecordValid({ ...what, r: 'longsword:steel', q })), [false, true]);
  // arrows a Building product (CRAFT3): the workbench's, Carpentry's work and Building's track
  const arrows = RECIPES.filter((r) => r.kind === 'arrows');
  assert.ok(arrows.length >= 3);
  assert.deepEqual([...new Set(arrows.map((r) => trackOf(r.profession)))], ['building']);
});

test('CRAFT5 through the real Worker: a Repair Kit\'s craft is answered a quality and its record signed at it - the kit the book mints carries it', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, mac.character, 'smithing', xpForRank(100));
  for (const [m, n] of [['ingot:iron', 9], ['leather:cured', 9]]) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const r = await book.craft('kit:iron', { clean: false, name: 'Mac' }, (data) => mintPieces(data));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(Number.isInteger(r.data.quality) && r.data.quality >= 0 && r.data.quality <= MASTERWORK, `a quality: ${r.data.quality}`);
  const row = raw.prepare('SELECT quality, record FROM products WHERE owner = ?').get(mac.id);
  assert.equal(row.quality, r.data.quality);
  assert.equal(readProductRecord(row.record).q, r.data.quality, 'signed at it');
  const [kit] = mintPieces(r.data);
  assert.deepEqual([kit.quality, kitReach(kit)], [r.data.quality, r.data.quality >= 3 ? 0.9 : 0.75]);
});

// ─── MEASURED: THE DISH AND THE POTENT POTION ───────────────────────

test('CRAFT5 MEASURED: a dish\'s buff and a Potent potion stand together - the Feast\'s Fortify Strength and a Potent Orc Strength each its own entry, neither the other\'s incumbent, either order; a dish renewed takes off its own alone', () => {
  const orc = POTION_RECIPES.find((p) => p.name === 'orcStrength');
  const bundle = potionBundle(potionRecipeKey(orc.ingredients));
  assert.ok(bundle, 'Orc Strength');
  const potent = { ...bundle, effects: bundle.effects.map((e) => potentEffect(e, POTENT.pct, 1)) };
  const drink = (who) => applySpell(potent, 1, who, {}, () => 0.5, null, { bypassSavingThrows: true, bypassChance: true });
  const strengthOf = (who) => who.activeEffects.filter((a) => a.kind === 'fortifyAttribute' && a.stat === 'strength' && !a.ended && a.roundsRemaining > 0);
  // the Feast first, then the potion
  const a = { items: [], stats: { ...STATS, strength: 20 }, activeEffects: [] };
  feedEffect(a, dishOf('feast'));
  const fed = liveStat(a, 'strength');
  assert.equal(fed, 25);
  drink(a);
  assert.equal(strengthOf(a).length, 2, 'two entries - the dish\'s and the potion\'s');
  const both = liveStat(a, 'strength');
  assert.ok(both > fed, `the potion's magnitude on top: ${both}`);
  // the potion first, then the Feast - and the Feast eaten again renews its own bundle alone
  const b = { items: [], stats: { ...STATS, strength: 20 }, activeEffects: [] };
  drink(b);
  const drunk = liveStat(b, 'strength');
  feedEffect(b, dishOf('feast'));
  assert.equal(liveStat(b, 'strength'), drunk + 5);
  for (const e of b.activeEffects) if (e.bundleName === dishOf('feast').name) e.roundsRemaining = 5;
  feedEffect(b, dishOf('feast'));
  assert.deepEqual([strengthOf(b).length, liveStat(b, 'strength')], [2, drunk + 5], 'renewed, the potion standing');
  assert.equal(liveStat(a, 'strength'), both);
  // why: the dish's entries carry no spell settings, so a potion's like-kind search (effects.js applySpell) never finds them
  assert.match(src('src/systems/effects.js'), /const inc = findInc\(\(a\) => a\.kind === 'fortifyAttribute' && a\.stat === stat && a\.settingsKey === sKey\);/);
  assert.equal(a.activeEffects.find((e) => e.bundleName === dishOf('feast').name).settingsKey, undefined);
});

// ─── THE PAGE ────────────────────────────────────────────────────────

test('CRAFT5 the anvil\'s kit box: its quality odds, and the reach a Superior or Masterwork kit gives', () => {
  const p = src('src/ui/profPages.js');
  assert.match(p, /if \(rollsQuality\(r\) && recipeOpen\(r, rank\)\) \{   \/\/ CRAFT5: a Repair Kit's quality too/);
  assert.match(p, /if \(r\.kind === 'kit'\) box\.append\(el\('p', 'px-note', KIT_REACH_LINE\)\);/);
  assert.match(p, /up to three quarters of it, or nine tenths from a Superior or Masterwork kit\./);
  assert.match(src('server-account/src/professions.js'), /const quality = rollsQuality\(r\)   \/\/ CRAFT5: a Repair Kit's too - its quality its reach\n/);
});
