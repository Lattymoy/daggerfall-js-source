// PROF9 (2026-10-02) - COOKING'S LAW: the four dishes of 9.3 as recipes (their inputs from the Stores, their ranks, the
// two-group herbs twice), their effects (DFU's Fortify Attribute at the dish's level - the shape ALLY-CAST's frame
// carries, so the feast reaches the table as it lands on its eater - and the Tart's stamina), the cook's hand at 100 (a
// Chef's feast, a Provisioner's dish) signed into the record, the servings (a Cook's two), the XP (the rank's tier, a
// clean pan half again), the pan (its numbers and its machine), the fire (no fee), and the market's Dishes.
// bible/06-Systems/Professions-Arc.md 3.3, 9.3, 9.4, 35.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DISHES, DISH_TEMPLATES, COOKING_RECIPES, RECIPES, recipeById, dishOf, dishHand, dishMinutes, dishSpell, dishEffectText, DISH_LEVEL,
  HAND_CHEF, HAND_PROVISIONER, COOK, CHEF, PROVISIONER, CHEF_FEAST, takesQuality, craftCount, cookXp, firstCraftPays, firstCraftKey, recipeOpen,
  PAN_ACT, panBand, panCount, panWindow, FIRST_CRAFT_XP, pieceLines,
} from '../src/net/recipeLaw.js';
import { SPECIALISATIONS, specOk, specDiscipline, TIER_RANKS, COOK_FIRE, PROF_RANK_MAX, FOOD_KEYS, PLANT_GROUP_TEMPLATES, topTierOf, ACT_BANDS } from '../src/net/professionLaw.js';
import { STAT_KEYS_ORDER } from '../src/systems/statMods.js';
import { CAST_LEVEL_MAX, validCastData } from '../src/net/wire.js';
import { allyCastFrame, allyCastSpell } from '../src/systems/allyCast.js';
import { applySpell } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { mintProductRecord, readProductRecord, productRecordValid } from '../src/net/productRecord.js';
import { CRAFTED_FAMILIES, pieceListable, auctionable } from '../src/net/marketLaw.js';
import { commissionable, commissionTakesQuality, commissionQualityOk } from '../src/net/writLaw.js';
import { createPanAct } from '../src/systems/panAct.js';
import { material } from '../src/net/nodeLaw.js';

// ─── THE DISHES (9.3) ────────────────────────────────────────────────

test('PROF9 law: the four dishes of 9.3 (4.8\'s 685-688) - their inputs as 9.3 writes them, every one a Stores material; the Stew and the Supper at rank 0, the Tart at 10, the Feast at 70; a dish of a two-group herb twice (the northern herb\'s, the southern\'s), the feast once; Cooking\'s, a dish, the Dishes family; after every other recipe', () => {
  assert.deepEqual(DISHES.map((d) => [d.id, d.name, d.templateIndex, d.tier, d.herb]), [
    ['stew', 'Hunter\'s Stew', 685, 1, 13], ['supper', 'Fisherman\'s Supper', 686, 1, 9], ['tart', 'Orchard Tart', 687, 2, 17], ['feast', 'Feast of the Hearth', 688, 6, null],
  ]);
  assert.deepEqual([...DISH_TEMPLATES], [685, 686, 687, 688]);
  assert.deepEqual(COOKING_RECIPES.map((r) => [r.id, r.name, r.kind, r.family, r.profession, r.templateIndex, r.material, r.tier, r.rank, r.inputs.map((i) => `${i.n} ${i.key}`).join()]), [
    ['stew:north', 'Hunter\'s Stew (northern Root Bulb)', 'dish', 'dishes', 'cooking', 685, 0, 1, 0, '2 food:meat,1 food:mushroom,1 p1:13'],
    ['stew:south', 'Hunter\'s Stew (southern Root Bulb)', 'dish', 'dishes', 'cooking', 685, 0, 1, 0, '2 food:meat,1 food:mushroom,1 p2:13'],
    ['supper:north', 'Fisherman\'s Supper (northern Green Leaves)', 'dish', 'dishes', 'cooking', 686, 0, 1, 0, '2 food:fish,1 food:egg,1 p1:9'],
    ['supper:south', 'Fisherman\'s Supper (southern Green Leaves)', 'dish', 'dishes', 'cooking', 686, 0, 1, 0, '2 food:fish,1 food:egg,1 p2:9'],
    ['tart:north', 'Orchard Tart (northern Yellow Berries)', 'dish', 'dishes', 'cooking', 687, 0, 2, 10, '2 food:apple,1 food:egg,1 p1:17'],
    ['tart:south', 'Orchard Tart (southern Yellow Berries)', 'dish', 'dishes', 'cooking', 687, 0, 2, 10, '2 food:apple,1 food:egg,1 p2:17'],
    ['feast:hearth', 'Feast of the Hearth', 'dish', 'dishes', 'cooking', 688, 0, 6, 70, '4 food:meat,4 food:fish,2 food:apple,2 food:orange,2 food:mushroom,2 food:egg'],
  ]);
  assert.equal(TIER_RANKS[5], 70, '9.3: the feast at rank 70');
  // every input is a Stores material the law knows: C&C's foods and DFU's plants of both groups
  for (const r of COOKING_RECIPES) for (const i of r.inputs) assert.ok(FOOD_KEYS.includes(i.key) || material(i.key)?.family === 'herbs', i.key);
  for (const t of [13, 9, 17]) assert.ok(PLANT_GROUP_TEMPLATES.p1.includes(t) && PLANT_GROUP_TEMPLATES.p2.includes(t), `template ${t} grows north and south`);
  assert.deepEqual(RECIPES.slice(-7 - 120, -120), [...COOKING_RECIPES]);   // PIN MOVED (PROF10): the jeweller's 120 pieces come after the dishes
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'every id its own');
  assert.equal(recipeById('tart:south'), COOKING_RECIPES[5]);
  assert.deepEqual([dishOf('stew')?.id, dishOf('stew:south')?.id, dishOf(688)?.id, dishOf('stewed:x'), dishOf(684), dishOf(null)], ['stew', 'stew', 'feast', null, null, null]);
  assert.deepEqual([recipeOpen(recipeById('tart:north'), 9), recipeOpen(recipeById('tart:north'), 10), recipeOpen(recipeById('feast:hearth'), 69), recipeOpen(recipeById('feast:hearth'), 70)], [false, true, false, true]);
  assert.ok(COOKING_RECIPES.every((r) => firstCraftPays(r)), 'gathered goods: the first time\'s 500 pays');
  // AUDIT PROF-541 R2-S7: a dish's first craft its dish's, whichever herb's way - north and south one key
  // PIN MOVED (CRAFT2): a first craft is its pattern at its tier's - a dish's two herbs' ways one dish still; the three
  // fletchings one quiver now; a jewel its piece and its base's tier (`ring:gold` is `ring@3`)
  assert.deepEqual(COOKING_RECIPES.map((r) => firstCraftKey(r)), ['stew@1', 'stew@1', 'supper@1', 'supper@1', 'tart@2', 'tart@2', 'feast@6']);
  assert.deepEqual([firstCraftKey(recipeById('arrows:north')), firstCraftKey(recipeById('ring:gold:ruby'))], ['arrows@1', 'ring@3'], 'the arrows one pattern; a jewel its piece and base');
});

test('PROF9 law: a dish takes no quality and lists among the Dishes (a commission names one at no quality; no auction - no Masterwork); a Cook\'s dish two servings (3.3), never a kit\'s or a Quartermaster\'s dish', () => {
  for (const r of COOKING_RECIPES) {
    assert.equal(takesQuality(r), false, r.id);
    assert.deepEqual([pieceListable(r.id), commissionable(r.id), commissionTakesQuality(r.id), commissionQualityOk(r.id, null), commissionQualityOk(r.id, 1), auctionable(r.id, 4)], [true, true, false, true, false, false], r.id);
  }
  assert.deepEqual(CRAFTED_FAMILIES.at(-2), ['dishes', 'Dishes']);   // PIN MOVED (PROF10): the jeweller's pieces list after them
  const stew = recipeById('stew:north'), kit = recipeById('kit:iron');
  assert.deepEqual([craftCount(stew, null, null), craftCount(stew, null, COOK), craftCount(stew, 'quartermaster', null), craftCount(kit, null, COOK), craftCount(kit, 'quartermaster', null)], [1, 2, 1, 1, 2]);
  assert.equal(COOK, 'cook');
});

test('PROF9 law: Cooking\'s four (3.3) - the Cook and the Field Cook at 50, the Chef and the Provisioner at 100, every one chosen now; the cook\'s hand: a Provisioner\'s on any dish (never spoils), a Chef\'s on a feast alone (half again), none on anything else', () => {
  // PIN MOVED (CRAFT3): SPECIALISATIONS is keyed by track - Cooking's four stand under Provisioning beside Alchemy's,
  // four a rank, one chosen; each still Cooking's own (specDiscipline), and a cooking ask reads its craft's (trackOf)
  assert.equal(SPECIALISATIONS.cooking, undefined, 'no track of Cooking\'s own');
  assert.deepEqual(SPECIALISATIONS.provisioning[50].map((s) => [s.id, s.name, s.later ?? null]), [['brewer', 'Brewer', null], ['distiller', 'Distiller', null], ['cook', 'Cook', null], ['field-cook', 'Field Cook', null]]);
  assert.deepEqual(SPECIALISATIONS.provisioning[100].map((s) => [s.id, s.name, s.later ?? null]), [['master-alchemist', 'Master Alchemist', null], ['transmuter', 'Transmuter', null], ['chef', 'Chef', null], ['provisioner', 'Provisioner', null]]);
  for (const [r, id] of [[50, 'cook'], [50, 'field-cook'], [100, 'chef'], [100, 'provisioner']]) {
    assert.ok(specOk('cooking', r, id) && specOk('provisioning', r, id), id);
    assert.equal(specDiscipline(id), 'cooking', id);
  }
  assert.deepEqual([CHEF, PROVISIONER, HAND_CHEF, HAND_PROVISIONER, CHEF_FEAST], ['chef', 'provisioner', 1, 2, 1.5]);
  const feast = recipeById('feast:hearth'), stew = recipeById('stew:north'), sword = recipeById('longsword:iron');
  assert.deepEqual([dishHand(feast, 'chef'), dishHand(stew, 'chef'), dishHand(stew, 'provisioner'), dishHand(feast, 'provisioner'), dishHand(stew, null), dishHand(sword, 'provisioner'), dishHand(null, 'chef')],
    [1, null, 2, 2, null, null, null]);
  assert.deepEqual([dishMinutes(dishOf('feast'), HAND_CHEF), dishMinutes(dishOf('feast'), null), dishMinutes(dishOf('stew'), HAND_CHEF), dishMinutes(dishOf('tart'))], [2160, 1440, 120, 240]);
});

// ─── THE EFFECTS (9.3) ───────────────────────────────────────────────

test('PROF9 law: what each dish does (9.3) - the Stew Endurance +5 for 2 hours, the Supper Agility +5 for 2 hours, the Tart a stamina a fifth longer for 4 hours, the Feast Strength, Endurance and Willpower +5 for a game day (a Chef\'s a day and a half), the whole party\'s; said on its card with its keeping and its cook', () => {
  assert.deepEqual(DISHES.map((d) => ({ ...d.effect, stats: d.effect.stats ? { ...d.effect.stats } : undefined })), [
    { stats: { endurance: 5 }, minutes: 120 }, { stats: { agility: 5 }, minutes: 120 }, { stamina: 20, minutes: 240, stats: undefined },
    { stats: { strength: 5, endurance: 5, willpower: 5 }, minutes: 1440, party: true },
  ]);
  assert.deepEqual(DISHES.map((d) => dishEffectText(d)), [
    'Endurance +5 for 2 hours', 'Agility +5 for 2 hours', 'Stamina lasts a fifth longer for 4 hours',
    'Strength, Endurance and Willpower +5 for a day, for the whole party at your table',
  ]);
  assert.equal(dishEffectText(dishOf('feast'), HAND_CHEF), 'Strength, Endurance and Willpower +5 for a day and a half, for the whole party at your table');
  assert.deepEqual(pieceLines({ provenance: '0123456789abcdef', recipe: 'feast:hearth', chef: true, noRot: true, maker: 'Ann', templateIndex: 688 }),
    ['Strength, Endurance and Willpower +5 for a day and a half, for the whole party at your table', 'Never spoils', 'Cooked by Ann']);
  assert.deepEqual(pieceLines({ provenance: '0123456789abcdef', recipe: 'stew:south', templateIndex: 685 }), ['Endurance +5 for 2 hours']);
  assert.deepEqual(pieceLines({ recipe: 'stew:south', templateIndex: 685 }), [], 'no provenance, no crafted lines');
});

test('PROF9 law: a dish\'s effect is DFU\'s own Fortify Attribute (type 9, the attribute\'s subType in DFU\'s order), exactly its magnitude, its minutes at DISH_LEVEL (the cast frame\'s most) - through ALLY-CAST\'s frame and a mate\'s applySpell it lands +5 for exactly its minutes; the Tart has no spell (its stamina is the port\'s own)', () => {
  assert.equal(DISH_LEVEL, CAST_LEVEL_MAX, 'the cast frame\'s own most');
  const feast = dishSpell(dishOf('feast'));
  assert.deepEqual([feast.name, feast.element, feast.rangeType, feast.effects.length], ['Feast of the Hearth', 4, 0, 3]);
  assert.deepEqual(feast.effects.map((e) => [e.type, STAT_KEYS_ORDER[e.subType], e.durationBase + e.durationMod * Math.floor(DISH_LEVEL / e.durationPerLevel), e.magnitudeBaseLow, e.magnitudeBaseHigh, e.magnitudeLevelBase, e.magnitudeLevelHigh]),
    [[9, 'strength', 1440, 5, 5, 0, 0], [9, 'endurance', 1440, 5, 5, 0, 0], [9, 'willpower', 1440, 5, 5, 0, 0]]);
  assert.deepEqual(dishSpell(dishOf('stew')).effects.map((e) => [STAT_KEYS_ORDER[e.subType], e.durationMod * DISH_LEVEL]), [['endurance', 120]]);
  assert.deepEqual(dishSpell(dishOf('supper')).effects.map((e) => [STAT_KEYS_ORDER[e.subType], e.durationMod * DISH_LEVEL]), [['agility', 120]]);
  assert.equal(dishSpell(dishOf('tart')), null);
  // the frame a party mate is sent, and what their client lays on (scenes/world.js online.onCast's own door)
  const chef = dishSpell(dishOf('feast'), HAND_CHEF);
  const frame = validCastData(allyCastFrame(chef, DISH_LEVEL, 'peer-0001'));
  assert.ok(frame, 'the frame passes the wire\'s law: every component a byte');
  const gift = allyCastSpell(frame.spell);
  assert.equal(gift.effects.length, 3, 'every Fortify a mate may give');
  const mate = { stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [] };
  applySpell(gift, frame.level, mate, {}, () => 0.5, null, { allyCast: true });
  assert.deepEqual(['strength', 'endurance', 'willpower', 'agility'].map((k) => liveStat(mate, k)), [55, 55, 55, 50]);
  assert.deepEqual(mate.activeEffects.map((a) => [a.kind, a.roundsRemaining, a.bundleName, a.bundleAlly]), [
    ['fortifyAttribute', 2159, 'Feast of the Hearth', true], ['fortifyAttribute', 2159, 'Feast of the Hearth', true], ['fortifyAttribute', 2159, 'Feast of the Hearth', true],
  ], 'a Chef\'s feast, a day and a half (DFU\'s initial round taken)');
});

// ─── THE XP (3.2) ────────────────────────────────────────────────────

test('PROF9 law: Cooking\'s XP follows the rank - 20 x the rank\'s own tier a cook (never a quarter), half again for a clean pan (a dish takes no quality); the first time\'s 500 the service\'s to lay on', () => {
  assert.deepEqual([0, 10, 25, 40, 55, 70, 90, 100].map((r) => cookXp(r)), [20, 40, 60, 80, 100, 120, 140, 140]);
  assert.deepEqual([0, 55, 100].map((r) => cookXp(r, { clean: true })), [30, 150, 210]);
  for (const r of [0, 33, 77, 100]) assert.equal(cookXp(r), 20 * topTierOf(r));
  assert.equal(FIRST_CRAFT_XP, 500);
});

// ─── THE PAN (9.4) ───────────────────────────────────────────────────

test('PROF9 law: the pan\'s numbers - three pans a dish, five a feast; the heat raw to burnt in 3 s x a pace of 0.85-1.2; the window from 0.6, 0.12 wide x the band, half again by Master, half again with C&C\'s Skillet, never past 0.95; the band (INT + PER) / 2 on Foraging\'s four', () => {
  assert.deepEqual({ ...PAN_ACT }, { pans: 3, feastPans: 5, burnS: 3.0, lo: 0.6, w: 0.12, masterWiden: 0.5, skillet: 1.5, paceLo: 0.85, paceHi: 1.2, gapS: 0.3 });
  assert.deepEqual([panCount(recipeById('stew:north')), panCount(recipeById('tart:south')), panCount(recipeById('feast:hearth'))], [3, 3, 5]);
  const w = (rank, band, skillet) => panWindow(rank, band, skillet).map((x) => Math.round(x * 1000) / 1000);
  assert.deepEqual(w(0, 1, false), [0.6, 0.72]);
  assert.deepEqual(w(100, 1, false), [0.6, 0.78]);
  assert.deepEqual(w(0, 1, true), [0.6, 0.78]);
  assert.deepEqual(w(50, 1.15, false), [0.6, 0.773]);
  assert.deepEqual(w(100, 1.3, true), [0.6, 0.95], 'never done at burnt');
  assert.deepEqual([10, 45, 70, 90].map((v) => panBand({ intelligence: v, personality: v })), ACT_BANDS.slice());
  assert.equal(panBand({ intelligence: 80, personality: 39 }), ACT_BANDS[1], '(80 + 39) / 2 = 59');
  assert.equal(PROF_RANK_MAX, 100);
});

test('PROF9 law: THE PAN\'S MACHINE - a pan taken off in its window is done, before it raw; left to burn the fire takes it and the next goes on; every pan done is clean, one raw or burnt not; the gap between takes; the press\'s own moment judged; Gentle acts never done, never clean; cancelled short never clean', () => {
  const half = () => 0.5;   // a pace of 1.025 - the heat 0.341667 a second
  const rate = (0.85 + 0.35 * 0.5) / 3;
  const a = createPanAct({ pans: 3, done: [0.6, 0.72], rng: half });
  assert.equal(a.state.need, 3);
  a.tick(0.5);
  assert.equal(a.inWindow, false);
  assert.equal(a.take(), false, 'raw: taken off at a sixth');
  assert.equal(a.take(), null, 'the next pan within the gap');
  a.tick(0.3);
  a.tick(0.6 / rate + 0.05 - 0.3);
  assert.equal(a.inWindow, true);
  assert.equal(a.take(), true, 'done');
  a.tick(0.58 / rate);
  assert.equal(a.inWindow, false, 'the frame: just short of done');
  assert.equal(a.take(0.1), true, 'the press\'s own moment: a tenth past the frame is in the window (AUDIT 32 P1)');
  assert.deepEqual(a.report(), { pans: 3, hits: 2, burnt: 0, clean: false });
  assert.equal(a.state.done, true);
  assert.equal(a.take(), null, 'over');
  // clean: every pan done
  const b = createPanAct({ pans: 3, done: [0.6, 0.72], rng: half });
  for (let i = 0; i < 3; i++) { b.tick(0.64 / rate); assert.equal(b.take(), true, `pan ${i}`); }
  assert.deepEqual(b.report(), { pans: 3, hits: 3, burnt: 0, clean: true });
  // burnt: the fire takes the pan and the next goes on
  const c = createPanAct({ pans: 2, done: [0.6, 0.72], rng: half });
  c.tick(1 / rate + 0.01);
  assert.deepEqual([c.state.takes, c.state.burnt, c.state.heat, c.state.done], [[false], 1, 0, false]);
  c.tick(0.64 / rate);
  assert.equal(c.take(), true);
  assert.deepEqual(c.report(), { pans: 2, hits: 1, burnt: 1, clean: false });
  // the pace is the fire's, a pan each: a slow pan and a fast one
  const paces = [0, 1];
  const d = createPanAct({ pans: 2, done: [0.6, 0.72], rng: () => paces.shift() ?? 0 });
  assert.equal(Math.round(d.state.rate * 3 * 100) / 100, 0.85);
  d.tick(0.64 / (0.85 / 3));
  assert.equal(d.take(), true);
  assert.equal(Math.round(d.state.rate * 3 * 100) / 100, 1.2);
  // Gentle acts: never done, never clean
  const g = createPanAct({ pans: 3, done: [0.6, 0.72], gentle: true, rng: half });
  for (let i = 0; i < 3; i++) { g.tick(0.64 / rate); assert.equal(g.inWindow, false); assert.equal(g.take(), false); }
  assert.deepEqual(g.report(), { pans: 3, hits: 0, burnt: 0, clean: false });
  // the press's own moment is bounded - a tenth of a second past the frame at most (AUDIT 32 P1's PRESS_LEAD_MAX_S)
  const lead = createPanAct({ pans: 1, done: [0.6, 0.72], rng: half });
  lead.tick(0.5 / rate);
  assert.equal(lead.take(0.4), false, 'a lead of 0.4 s counts a tenth: still raw');
  // cancelled short
  const h = createPanAct({ pans: 3, done: [0.6, 0.72], rng: half });
  h.tick(0.64 / rate);
  h.take();
  h.cancel();
  assert.deepEqual([h.take(), h.report().clean], [null, false]);
});

// ─── THE RECORD, THE FIRE ────────────────────────────────────────────

test('PROF9 law: a dish\'s record carries its cook\'s hand (`f`) - a Provisioner\'s on any dish, a Chef\'s on a feast alone, nothing else on any other piece; a dish\'s quality is none (-1); the fire asks no fee', async () => {
  const base = { p: '0123456789abcdef', s: 'acct_0000000001', h: 'char-0001', q: -1, m: 'Ann', c: 7, i: 5 };
  assert.ok(productRecordValid({ ...base, r: 'stew:north' }));
  assert.ok(productRecordValid({ ...base, r: 'stew:north', f: 2 }));
  assert.ok(productRecordValid({ ...base, r: 'feast:hearth', f: 1 }));
  assert.ok(productRecordValid({ ...base, r: 'feast:hearth', f: 2 }));
  assert.equal(productRecordValid({ ...base, r: 'stew:north', f: 1 }), false, 'a Chef\'s hand is a feast\'s');
  assert.equal(productRecordValid({ ...base, r: 'stew:north', f: 3 }), false);
  assert.equal(productRecordValid({ ...base, r: 'stew:north', f: null }), false);
  assert.equal(productRecordValid({ ...base, r: 'stew:north', q: 1 }), false, 'a dish takes no quality');
  assert.equal(productRecordValid({ ...base, r: 'longsword:iron', q: 1, f: 2 }), false, 'no hand on a sword');
  const rec = await mintProductRecord({ ...base, r: 'feast:hearth', f: 1 }, null, { subtle: globalThis.crypto.subtle, nowS: 9 });
  assert.equal(readProductRecord(rec).f, 1);
  const plain = await mintProductRecord({ ...base, r: 'stew:south' }, null, { subtle: globalThis.crypto.subtle, nowS: 9 });
  assert.equal(readProductRecord(plain).f, undefined, 'no hand, no claim');
  assert.deepEqual({ ...COOK_FIRE }, { kind: 'fire', fee: 0 });
  assert.ok(Object.isFrozen(COOK_FIRE));
});
