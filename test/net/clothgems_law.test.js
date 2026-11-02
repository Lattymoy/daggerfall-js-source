// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - THE LAW.
// Linen and Wool were the Weavers' counter's alone (Professions-Arc 4.5: "never gathered"), and AUDIT 32 S1 withheld the
// first-make 500 from every recipe made wholly of them - 152 of Outfitting's 332 first-craft keys could never pay, 19 of
// 171 at tiers 1-2. The owner's decision: CRAFT THEM. The loom weaves Linen from Root Tendrils and spins Wool from furs
// (net/professionLaw.js WEAVE_RECIPES, SPIN_RECIPES), and S1 judges the units' origin (net/recipeLaw.js firstCraftPays's
// `own`), so the character's own cloth pays and the counter's never does. bible/06-Systems/Professions-Arc.md 50.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEAVE_RECIPES, SPIN_RECIPES, WOOL_FURS, LINEN_FIBRE, LINEN_IN, SPIN_IN, WORK_RECIPES, HIDES, hideOfFoe, LINEN, WOOL,
  PLANT_GROUP_TEMPLATES, COUNTER_ONLY, WEAVERS_STOCK, stockOf, smeltOrigin,
} from '../../src/net/professionLaw.js';
import {
  RECIPES, OUTFITTING_RECIPES, PELTS, recipeById, firstCraftKey, firstCraftKin, firstCraftPays, counterMade,
} from '../../src/net/recipeLaw.js';
import { HERB_TABLES, herbTier, herbInSeason } from '../../src/net/nodeLaw.js';
import { producersOf } from '../../src/net/chainLaw.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { SEASONS } from '../../src/systems/gameDate.js';

test('CLOTH-GEMS law: WOOL IS SPUN FROM FURS Hunting already gives - the Rat, Wolf and Tiger Pelts, the Boar and Bear Hides (the skins\' pelts less the Bat Leather, a wing\'s skin), two a bolt at the loom, no XP; cheapest first, the Ram Kit\'s Bear Hide last of its tier; the Tiger a press of the player\'s own (mutants: a fur dropped or added, the ratio, the station, an XP)', () => {
  assert.deepEqual(WOOL_FURS, ['hide:rat', 'hide:wolf', 'hide:boar', 'hide:bear', 'hide:tiger']);
  assert.deepEqual([...WOOL_FURS].sort(), PELTS.filter((p) => p !== 'hide:bat').sort(), 'the pelts the skins are cut from, but the Bat Leather');
  for (const k of WOOL_FURS) {
    const h = HIDES.find((x) => x.key === k);
    assert.ok(h && h.foes.length > 0 && h.foes.every((f) => hideOfFoe(f) === h), `${k}: skinned from a foe's body (Hunting)`);
  }
  assert.equal(SPIN_IN, 2);
  assert.deepEqual(SPIN_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(), r.station, r.per, r.more, r.xp]), [
    ['spin:rat', WOOL.key, '2 hide:rat', 'loom', 1, null, null], ['spin:wolf', WOOL.key, '2 hide:wolf', 'loom', 1, null, null],
    ['spin:boar', WOOL.key, '2 hide:boar', 'loom', 1, null, null], ['spin:bear', WOOL.key, '2 hide:bear', 'loom', 1, null, null],
    ['spin:tiger', WOOL.key, '2 hide:tiger', 'loom', 1, null, null],
  ]);
  assert.ok(SPIN_RECIPES.every((r) => WORK_RECIPES.includes(r)), 'a work of the loom, the service\'s /v1/prof/smelt');
  assert.deepEqual(producersOf(WOOL.key).map((r) => r.id), ['spin:rat', 'spin:wolf', 'spin:boar', 'spin:bear'], 'a chain spins the cheapest fur first and never trades a Tiger Pelt down');
  // a bolt is own where its furs were - the smelt's origin law
  assert.deepEqual(smeltOrigin(SPIN_RECIPES[0], 3, [0]), { own: 3, bought: 0 });
  assert.deepEqual(smeltOrigin(SPIN_RECIPES[0], 3, [1]), { own: 2, bought: 1 });
});

test('CLOTH-GEMS law: LINEN IS WOVEN FROM ROOT TENDRILS - DFU\'s plant 12, of both plant groups so a recipe a land, a common herb of the mountain woods, the haunted woods and the swamp that the winter keeps, two a bolt at the loom, no XP (mutants: the herb, a land dropped, the ratio)', () => {
  assert.equal(LINEN_FIBRE, 12);
  assert.ok(PLANT_GROUP_TEMPLATES.p1.includes(12) && PLANT_GROUP_TEMPLATES.p2.includes(12), 'the northern and the southern');
  assert.equal(herbTier(12), 1, 'a common herb\'s tier');
  assert.ok([SEASONS.Spring, SEASONS.Summer, SEASONS.Fall, SEASONS.Winter].every((s) => herbInSeason(12, s)), 'the Roots grow in winter');
  const grows = Object.entries(HERB_TABLES).filter(([, rows]) => rows.some((row) => row.includes(12))).map(([c]) => Number(c)).sort((a, b) => a - b);
  assert.deepEqual(grows, [CLIMATES.MountainWoods, CLIMATES.HauntedWoodlands, CLIMATES.Swamp].sort((a, b) => a - b));
  assert.equal(LINEN_IN, 2);
  const linen = WEAVE_RECIPES.filter((r) => r.out === LINEN.key);
  assert.deepEqual(linen.map((r) => [r.id, r.inputs.map((i) => `${i.n} ${i.key}`).join(), r.station, r.xp]), [
    ['weave:linen-north', '2 p1:12', 'loom', null], ['weave:linen-south', '2 p2:12', 'loom', null],
  ]);
  assert.deepEqual(producersOf(LINEN.key).map((r) => r.id), ['weave:linen-north', 'weave:linen-south'], 'a chain weaves it from either land\'s');
});

test('CLOTH-GEMS law: AUDIT 32 S1 JUDGES THE UNITS - the recipes it judges are the 152 made wholly of the Weavers\' Linen and Wool; each pays its first where its units are the character\'s own and never where they are not; every other recipe pays whatever its units; the counter still sells both, bought (mutants: own ignored, own always, the judged set widened or narrowed)', () => {
  const judged = RECIPES.filter(counterMade);
  assert.equal(judged.length, 152);
  assert.ok(judged.every((r) => r.profession === 'outfitting' && r.inputs.every((i) => [LINEN.key, WOOL.key].includes(i.key))));
  for (const r of judged) {
    assert.equal(firstCraftPays(r, true), true, `${r.id}: own cloth pays`);
    assert.equal(firstCraftPays(r, false), false, `${r.id}: bought cloth never`);
    assert.equal(firstCraftPays(r), false, `${r.id}: unasked, none`);
  }
  for (const r of RECIPES.filter((x) => !counterMade(x))) assert.equal(firstCraftPays(r, false), true, `${r.id}: never judged`);
  assert.equal(firstCraftPays(recipeById('garment-149:linen'), false), true, 'a boot: a bolt and a Cured Leather');
  assert.equal(firstCraftPays(null, true), false);
  assert.equal(counterMade({ inputs: [] }), false, 'a recipe of nothing is no counter\'s');
  // the counter keeps selling both, into the Stores as bought
  assert.deepEqual(WEAVERS_STOCK.map((s) => [s.key, s.marks]), [[LINEN.key, 2], [WOOL.key, 3]]);
  assert.ok(stockOf(LINEN.key) && stockOf(WOOL.key));
  assert.ok(COUNTER_ONLY.includes(LINEN.key) && COUNTER_ONLY.includes(WOOL.key));
});

test('CLOTH-GEMS law: EVERY OUTFITTING FIRST-CRAFT KEY AT TIERS 1-2 IS REACHABLE - 171 keys, each a recipe whose every input a gatherer makes own (a hide or a herb, or a loom\'s work of them) and whose first pays with them; before, 19 of the 171 paid; the 332 keys stay pattern@tier (mutants: a cloth with no work, a key that cannot pay)', () => {
  const gathered = (k) => k.startsWith('hide:') || /^p[12]:\d+$/.test(k);
  const made = (k) => gathered(k) || producersOf(k).some((w) => w.inputs.every((i) => gathered(i.key)));
  const keys = [...new Set(OUTFITTING_RECIPES.map(firstCraftKey))];
  assert.equal(keys.length, 332);
  assert.ok(keys.every((k) => /^[a-z0-9-]+@[1-7]$/.test(k)), 'pattern@tier');
  const low = keys.filter((k) => Number(k.split('@')[1]) <= 2);
  assert.equal(low.length, 171);
  const kinOf = (k) => OUTFITTING_RECIPES.filter((r) => firstCraftKey(r) === k);
  assert.equal(low.filter((k) => kinOf(k).some((r) => firstCraftPays(r, false))).length, 19, 'the counter\'s cloth: 19 of 171');
  const reach = low.filter((k) => kinOf(k).some((r) => firstCraftPays(r, true) && r.inputs.every((i) => made(i.key))));
  assert.equal(reach.length, 171, 'every one, of the character\'s own goods');
  assert.equal(keys.filter((k) => !kinOf(k).some((r) => firstCraftPays(r, true))).length, 0, 'no key of the 332 can never pay');
  assert.deepEqual(firstCraftKin(recipeById('garment-141:linen')), ['garment-141:linen'], 'a cloth is its own tier, its own key');
});
