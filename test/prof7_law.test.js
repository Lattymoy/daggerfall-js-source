// PROF7 (2026-09-29, Mac: "Do it") - HUNTING'S AND OUTFITTING'S LAW (src/net/professionLaw.js, nodeLaw.js, recipeLaw.js,
// productRecord.js, marketLaw.js, decorLaw.js; systems/traceAct.js, stitchAct.js, foragingLaw.js, survival/food.js): the
// ten hides, their foes, parts, butchery and cures; the leathers and the cloth; Hunting's day and a body's key, yield
// and finds; the trace; the loom's cures and weave; Outfitting's recipes, their steps and a garment's dye signed; the
// stitch; the knife's checks in Foraging's voice; the Butcher's slow rot; the market's and the home's share.
// bible/06-Systems/Professions-Arc.md 4.4, 4.5, 5.2, 6, 9.3, 9.4, 29; FORAGE0 14.2-14.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HIDES, hideOfFoe, BEAR_HIDE, PARTS, CURED_LEATHER, HARDENED_LEATHER, LINEN, WOOL, SILK, STANDARD_SILK, CLOTHS, HIDE_TEMPLATES,
  HIGH_HIDES_PER_DAY, HIGH_HIDE_TIER, PART_CHANCE, BUTCHERY, HIDE_YIELD, ACT_YIELD_MAX, TRACKER_M, SKINNING_KNIFE,
  KNIFE_CHECKS, KNIFE_REFUSALS, TRACE_ACT, tracePoints, traceTolerance, knifeBand, CURE_RECIPES, WEAVE_RECIPES, WORK_RECIPES,
  smeltRecipe, workPer, workSpecRank, LOOM_FEE, FOOD_KEYS, materialOf, minedMaterial, withdrawable, NO_PACK_FORM, specOk,
  SPECIALISATIONS, MINED_KEYS, actBand, gemTierOfPrice, professionOfFamily,
} from '../src/net/professionLaw.js';
import { bodyKey, parseNodeKey, BODY_ID_RE, hideYield, bodyFinds, herbTier } from '../src/net/nodeLaw.js';
import {
  OUTFITTING_RECIPES, RECIPES, SMITH_RECIPES, CARPENTRY_RECIPES, recipeById, recipeOpen, qualitySteps, takesQuality, GARMENTS,
  GARMENT_BOLTS, LEATHER_PIECES, GARMENT_DYES, dyeOk, garmentGroup, STITCH_ACT, stitchBand, beatAt, onBeat, ARMOR_LEATHER,
  RUGS, TAPESTRIES, PELTS, FISHING_NET_TEMPLATE, craftXp, FIRST_CRAFT_XP,
} from '../src/net/recipeLaw.js';
import { mintProductRecord, readProductRecord, productRecordValid } from '../src/net/productRecord.js';
import { UNYIELDED, CRAFTED_FAMILIES, marketCatalogue, pieceListable } from '../src/net/marketLaw.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES } from '../src/net/decorLaw.js';
import { CLOTHING_DYES } from '../src/characters/dyes.js';
import { createTraceAct, traceLine, toLine } from '../src/systems/traceAct.js';
import { createStitchAct } from '../src/systems/stitchAct.js';
import { checksRefusal, brokeMessage } from '../src/systems/foragingLaw.js';
import { rotFoodDay, TEMPLATE as CC } from '../src/systems/survival/food.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

// ─── THE HIDES (4.4) ─────────────────────────────────────────────────

test('PROF7 law: the ten hides (4.4, 655-664 in its order) - each its foes by DFU\'s MobileTypes, its tier, its DFU part, its butchery (C&C\'s own animals and its Slaughterfish; none for the Harpy, the Dreugh and the Dragonling) and its cure (tiers 1-3 Cured, 4-6 Hardened; Spider Silk woven and Harpy Feathers fletched, never cured)', () => {
  assert.deepEqual(HIDES.map((h) => [h.key, h.templateIndex, h.name, h.tier, h.part, h.meat, h.cures]), [
    ['hide:rat', 655, 'Rat Pelt', 1, null, 'food:meat', 'leather:cured'],
    ['hide:bat', 656, 'Bat Leather', 2, null, 'food:meat', 'leather:cured'],
    ['hide:bear', 657, 'Bear Hide', 2, 'part:tooth', 'food:meat', 'leather:cured'],
    ['hide:tiger', 658, 'Tiger Pelt', 3, 'part:tooth', 'food:meat', 'leather:cured'],
    ['hide:spider', 659, 'Spider Silk', 3, 'part:venom', 'food:meat', null],
    ['hide:scorpion', 660, 'Scorpion Chitin', 4, 'part:stinger', 'food:meat', 'leather:hardened'],
    ['hide:slaughterfish', 661, 'Slaughterfish Scales', 4, null, 'food:fish', 'leather:hardened'],
    ['hide:harpy', 662, 'Harpy Feathers', 5, null, null, null],
    ['hide:dreugh', 663, 'Dreugh Shell', 5, null, null, 'leather:hardened'],
    ['hide:dragonling', 664, 'Dragonling Scale', 6, 'part:dragonscale', null, 'leather:hardened'],
  ]);
  // the foes by DFU's own names (characters/mobileTypes.js, generated from DaggerfallUnityEnums.cs)
  const M = MOBILE_TYPES;
  assert.deepEqual([M.Rat, M.GiantBat, M.GrizzlyBear, M.SabertoothTiger, M.Spider, M.GiantScorpion, M.Slaughterfish, M.Harpy, M.Dreugh, M.Dragonling, M.Dragonling_Alternate].map((t) => hideOfFoe(t)?.key),
    ['hide:rat', 'hide:bat', 'hide:bear', 'hide:tiger', 'hide:spider', 'hide:scorpion', 'hide:slaughterfish', 'hide:harpy', 'hide:dreugh', 'hide:dragonling', 'hide:dragonling']);
  for (const t of [M.Orc, M.Imp, M.Werewolf, 128, 146, -1, 0.5, '4', null, undefined]) assert.equal(hideOfFoe(t), null, String(t));
  assert.equal(BEAR_HIDE.key, 'hide:bear', 'the Ram Kit\'s Bear Hide is Hunting\'s own now');
  // the parts at their price's tier, as a gem is - DFU's own ingredient in its own group
  assert.deepEqual(PARTS.map((p) => [p.key, p.tier, p.group, p.templateIndex]), [
    ['part:tooth', gemTierOfPrice(8), 'MiscellaneousIngredients1', 56], ['part:venom', gemTierOfPrice(22), 'CreatureIngredients1', 41],
    ['part:stinger', gemTierOfPrice(25), 'CreatureIngredients2', 47], ['part:dragonscale', gemTierOfPrice(375), 'CreatureIngredients2', 46],
  ]);
  assert.deepEqual(PARTS.map((p) => p.tier), [2, 3, 3, 6]);
});

test('PROF7 law: the leathers (665 Cured tier 2, 666 Hardened tier 5) and the cloth (668-671: Linen 1, Wool 2, Silk 4, Standard-bearer\'s 5) registered and withdrawn - nothing is left without a pack form; the Stores and the market know every one, less what nothing yields yet', () => {
  assert.deepEqual([CURED_LEATHER, HARDENED_LEATHER].map((m) => [m.key, m.templateIndex, m.tier, m.name]), [['leather:cured', 665, 2, 'Cured Leather'], ['leather:hardened', 666, 5, 'Hardened Leather']]);
  assert.deepEqual(CLOTHS.map((m) => [m.key, m.templateIndex, m.tier]), [['cloth:linen', 668, 1], ['cloth:wool', 669, 2], ['cloth:silk', 670, 4], ['cloth:standard', 671, 5]]);
  assert.deepEqual([LINEN, WOOL, SILK, STANDARD_SILK], CLOTHS);
  assert.deepEqual(HIDE_TEMPLATES.map((m) => m.templateIndex), [655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 668, 669, 670, 671]);
  assert.deepEqual([...NO_PACK_FORM], ['work:ram', 'essence:arcane']);   // AUDIT PROF12 E1 (PIN MOVED): Arcane Essence the Stores'; SEAT2b part two (PIN MOVED): a siege work's road is the writ's - every hide, leather and cloth withdraws
  for (const m of [...HIDE_TEMPLATES, ...PARTS]) {
    assert.equal(minedMaterial(m.key)?.templateIndex, m.templateIndex, m.key);
    assert.equal(withdrawable(m.key), true, m.key);
    assert.equal(materialOf(m.key, herbTier).family, 'hides', m.key);
    assert.ok(MINED_KEYS.includes(m.key), m.key);
  }
  assert.equal(professionOfFamily('hides'), null, 'no Court writ asks a hide - bounded, not witnessed (PROF0 11)');
  assert.deepEqual([...UNYIELDED], ['ingot:daedric']);   // PIN MOVED (AUDIT-SEATS): the sieges' Spoils yield the silk
  const cat = new Set(marketCatalogue().map((c) => c.key));
  assert.deepEqual([cat.has('hide:bear'), cat.has('leather:hardened'), cat.has('part:dragonscale'), cat.has('food:meat'), cat.has('cloth:standard')], [true, true, true, true, true]);
  assert.deepEqual(FOOD_KEYS.slice(-2), ['food:meat', 'food:fish']);
  assert.deepEqual(materialOf('food:meat', herbTier), { key: 'food:meat', family: 'food', tier: 1, value: 1 });
});

// ─── HUNTING'S DAY AND A BODY (PROF0 6) ──────────────────────────────

test('PROF7 law: Hunting is bounded, not witnessed - 3 hides of tiers 5-6 an account a day (CAP-OFF: the 30 of any tier gone); a body\'s key its day and twelve hex digits in their one spelling; a hide one, a clean pelt x1.5 (the fraction the dice\'s); the part one body in four, lost with a torn pelt; the butchery one, a Butcher\'s two', () => {
  assert.deepEqual([HIGH_HIDES_PER_DAY, HIGH_HIDE_TIER, PART_CHANCE, HIDE_YIELD, ACT_YIELD_MAX, TRACKER_M], [3, 5, 0.25, 1, 1.5, 100]);
  assert.deepEqual({ ...BUTCHERY }, { meat: 1, butcher: 2 });
  const key = bodyKey({ day: 20833, id: '0123456789ab' });
  assert.equal(key, 'body:20833:0123456789ab');
  assert.deepEqual(parseNodeKey(key), { kind: 'body', day: 20833, id: '0123456789ab' });
  for (const k of ['body:20833:0123456789AB', 'body:20833:0123456789a', 'body:20833:0123456789abc', 'body:020833:0123456789ab', 'body:20833:0123456789ag', 'body::0123456789ab', 'Body:20833:0123456789ab']) {
    assert.equal(parseNodeKey(k), null, k);
  }
  assert.ok(BODY_ID_RE.test('ffffffffffff'));
  assert.deepEqual([hideYield({}, 0), hideYield({ clean: false }, 0.99), hideYield({ clean: true }, 0.49), hideYield({ clean: true }, 0.5), hideYield({ clean: true }, 0.99)], [1, 1, 2, 1, 1]);
  const bear = hideOfFoe(MOBILE_TYPES.GrizzlyBear);
  const d = (v) => () => v;
  assert.deepEqual(bodyFinds({ hide: bear }, d(0.24)), { part: 'part:tooth', meat: 'food:meat', meatQty: 1 });
  assert.deepEqual(bodyFinds({ hide: bear }, d(0.25)), { part: null, meat: 'food:meat', meatQty: 1 });
  assert.deepEqual(bodyFinds({ hide: bear, torn: true }, d(0)), { part: null, meat: 'food:meat', meatQty: 1 });
  assert.deepEqual(bodyFinds({ hide: bear, butcher: true }, d(0.9)), { part: null, meat: 'food:meat', meatQty: 2 });
  assert.deepEqual(bodyFinds({ hide: hideOfFoe(MOBILE_TYPES.Slaughterfish), butcher: true }, d(0)), { part: null, meat: 'food:fish', meatQty: 2 });
  assert.deepEqual(bodyFinds({ hide: hideOfFoe(MOBILE_TYPES.Harpy), butcher: true }, d(0)), { part: null, meat: null, meatQty: 0 });
  // the knife: 603, 0.5 kg, 50 uses, 100 gold, rarity 10, DFU's Dagger's picture
  assert.deepEqual({ ...SKINNING_KNIFE, icon: [...SKINNING_KNIFE.icon] }, { templateIndex: 603, name: 'Skinning Knife', weight: 0.5, hitPoints: 50, price: 100, rarity: 10, icon: [207, 5] });
});

test('PROF7 law: the knife\'s checks in Foraging\'s voice - never inside nor daylight (a body lies where it fell; foes die at night), then the settlement, the sea, the enemies and the load, in that order; a tool not Foraging\'s breaks by its own name', () => {
  assert.deepEqual([...KNIFE_CHECKS], ['town', 'sea', 'enemies', 'encumbered']);
  assert.deepEqual({ ...KNIFE_REFUSALS }, {
    town: 'You cannot skin in a settlement!', sea: 'You cannot skin out here!', enemies: 'You cannot skin with enemies nearby!', encumbered: 'You cannot skin when fully encumbered!',
  });
  const w = (o = {}) => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 231, region: 17, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, ...o });
  const says = (o) => checksRefusal(KNIFE_CHECKS, KNIFE_REFUSALS, w(o));
  assert.equal(says({}), null);
  assert.equal(says({ inside: true, insideDungeon: true }), null, 'a dungeon\'s body');
  assert.equal(says({ hour: 2 }), null, 'the night');
  assert.equal(says({ inLocationRect: true, locationType: 0 }), KNIFE_REFUSALS.town);
  assert.equal(says({ climate: 223 }), KNIFE_REFUSALS.sea);
  assert.equal(says({ enemiesNear: true, carriedWeight: 500 }), KNIFE_REFUSALS.enemies, 'the order: enemies before the load');
  assert.equal(says({ carriedWeight: 100 }), KNIFE_REFUSALS.encumbered);
  assert.equal(brokeMessage(603, 'Skinning Knife'), 'Your Skinning Knife broke.');
  assert.equal(brokeMessage(1601, 'A Renamed Pick'), 'Your Pick-Axe broke.', 'Foraging\'s own by its own row');
  assert.equal(brokeMessage(603), 'Your tool broke.');
});

// ─── THE TRACE (5.2) ─────────────────────────────────────────────────

test('PROF7 law: the trace - 4 + tier points (5 to 9) across the carcass; the tolerance 3 degrees at Novice, half again at Master, x the knife\'s band ((INT + AGI) / 2); the machine: E held on the first point starts it, drawn to the last it scores 1 less the mean deviation over the tolerance - clean at 0.8 in 0.6-6 s, torn under 0.4; let go, a slip and a start again; a jump scored along its chord; Gentle acts a plain hold', () => {
  assert.deepEqual({ ...TRACE_ACT }, { minPoints: 5, maxPoints: 9, spanYawDeg: 14, spanPitchDeg: 3, startDeg: 2.5, tolDeg: 3, masterWiden: 0.5, stepDeg: 0.25, minS: 0.6, maxS: 6, clean: 0.8, torn: 0.4, gentleS: 1.2 });
  assert.deepEqual([0, 1, 2, 5, 6, 7].map(tracePoints), [5, 5, 6, 9, 9, 9]);
  assert.deepEqual([traceTolerance(0), traceTolerance(100), traceTolerance(50, 2)], [3, 4.5, 3 * 2 * 1.25]);
  assert.deepEqual([knifeBand({ intelligence: 30, agility: 90 }), actBand(60)], [actBand(60), 1.15], 'the pair\'s mean, never INT alone (band 0\'s 0.85)');
  const line = traceLine(5, () => 0.5);
  assert.deepEqual(line.map((p) => p[0]), [-7, -3.5, 0, 3.5, 7]);
  assert.equal(toLine(0, 0, line), 0);
  /** A trace drawn along `path` (yaw, pitch pairs) at `dt` a frame, E held throughout. */
  const draw = (act, path, dt) => { for (const [yaw, pitch] of path) act.tick(dt, { held: true, aim: { yaw, pitch } }); return act.report(); };
  const along = (n, off = 0) => Array.from({ length: n + 1 }, (_, i) => [-7 + (14 * i) / n, off]);
  // a steady hand along the line: clean
  const good = draw(createTraceAct({ tier: 1, rng: () => 0.5 }), along(40), 0.05);
  assert.deepEqual([good.clean, good.torn, good.score, good.slips], [true, false, 1, 0]);
  // too quick: a flick is never clean, however true
  assert.equal(draw(createTraceAct({ tier: 1, rng: () => 0.5 }), along(4), 0.05).clean, false);
  // a hand 2.4 degrees off the line the whole way reaches each point (within 2.5) and scores about a fifth: torn
  // (AUDIT 32 L1: measured every quarter degree of the trace's progress - the climb off the line's start counts once)
  const off = draw(createTraceAct({ tier: 1, rng: () => 0.5 }), [[-7, 0], ...along(40, 2.4).slice(1)], 0.05);
  assert.deepEqual([off.clean, off.torn, off.score], [false, true, 0.22]);
  // one 2.6 off never reaches the next point: no end, no report
  assert.equal(draw(createTraceAct({ tier: 1, rng: () => 0.5 }), [[-7, 0], ...along(40, 2.6).slice(1)], 0.05), null);
  const wobbly = createTraceAct({ tier: 1, rng: () => 0.5 });
  draw(wobbly, along(40).map(([y], i) => [y, i % 2 ? 2.4 : -2.4]), 0.05);
  const w = wobbly.report();
  assert.ok(w && !w.clean && w.score < TRACE_ACT.clean, JSON.stringify(w));
  // never started off the first point; let go mid-way a slip
  const far = createTraceAct({ tier: 1, rng: () => 0.5 });
  far.tick(0.05, { held: true, aim: { yaw: 0, pitch: 0 } });
  assert.equal(far.state.tracing, false);
  const slip = createTraceAct({ tier: 1, rng: () => 0.5 });
  slip.tick(0.05, { held: true, aim: { yaw: -7, pitch: 0 } });
  slip.tick(0.05, { held: true, aim: { yaw: -5, pitch: 0 } });
  slip.tick(0.05, { held: false, aim: { yaw: -4, pitch: 0 } });
  assert.deepEqual([slip.state.tracing, slip.state.slips, slip.report()], [false, 1, null]);
  // a jump from the first point to the last in one frame is scored along its chord - no free leap
  const leap = createTraceAct({ tier: 1, rng: () => 0.9 });
  leap.tick(0.5, { held: true, aim: { yaw: -7, pitch: leap.state.points[0][1] } });
  leap.tick(0.5, { held: true, aim: { yaw: 7, pitch: leap.state.points[4][1] } });
  assert.ok(leap.state.devs.length > 50, 'the chord sampled every quarter degree');
  // Gentle acts: E held its 1.2 s completes it plainly; Esc ends it with no report
  const gentle = createTraceAct({ tier: 3, gentle: true });
  for (let i = 0; i < 13; i++) gentle.tick(0.1, { held: true });
  assert.deepEqual(gentle.report(), { score: 0, clean: false, torn: false, seconds: 0, slips: 0 });
  const esc = createTraceAct({ tier: 3 });
  esc.cancel();
  assert.deepEqual([esc.state.cancelled, esc.report()], [true, null]);
});

// ─── THE LOOM'S WORK (4.4, 4.5) ──────────────────────────────────────

test('PROF7 law: the loom cures two hides to a leather (a Tanner\'s two a unit - a choice made at 50) and weaves three Spider Silk to a Silk Bolt; no XP - a hide\'s was its skinning\'s; the tailor\'s fee 50', () => {
  assert.deepEqual(CURE_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(), r.station, r.per, r.more?.spec, r.more?.per, workSpecRank(r), r.xp]), [
    ['cure:rat', 'leather:cured', '2 hide:rat', 'loom', 1, 'tanner', 2, 50, null], ['cure:bat', 'leather:cured', '2 hide:bat', 'loom', 1, 'tanner', 2, 50, null],
    ['cure:bear', 'leather:cured', '2 hide:bear', 'loom', 1, 'tanner', 2, 50, null], ['cure:tiger', 'leather:cured', '2 hide:tiger', 'loom', 1, 'tanner', 2, 50, null],
    ['cure:scorpion', 'leather:hardened', '2 hide:scorpion', 'loom', 1, 'tanner', 2, 50, null], ['cure:slaughterfish', 'leather:hardened', '2 hide:slaughterfish', 'loom', 1, 'tanner', 2, 50, null],
    ['cure:dreugh', 'leather:hardened', '2 hide:dreugh', 'loom', 1, 'tanner', 2, 50, null], ['cure:dragonling', 'leather:hardened', '2 hide:dragonling', 'loom', 1, 'tanner', 2, 50, null],
  ]);
  assert.deepEqual(WEAVE_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(), r.station, r.per, r.more, r.xp]), [['weave:silk', 'cloth:silk', '3 hide:spider', 'loom', 1, null, null]]);
  assert.deepEqual([workPer(smeltRecipe('cure:bear'), { hunting: 'tanner' }), workPer(smeltRecipe('cure:bear'), { hunting: 'tracker' }), workPer(smeltRecipe('cure:bear'))], [2, 1, 1]);
  assert.deepEqual([workSpecRank(smeltRecipe('saw:oak')), workSpecRank(smeltRecipe('ingot:iron')), workSpecRank(smeltRecipe('weave:silk'))], [100, 100, 100], 'the rest read at 100');
  assert.ok(WORK_RECIPES.includes(smeltRecipe('cure:dreugh')));
  assert.equal(smeltRecipe('cure:spider'), null, 'Spider Silk is woven');
  assert.equal(smeltRecipe('cure:harpy'), null, 'Harpy Feathers fletch');
  assert.equal(LOOM_FEE, 50);
});

// ─── OUTFITTING (9.3) ────────────────────────────────────────────────

test('PROF7 law: Outfitting\'s recipes (9.3) - the leather armour in Cured and Hardened Leather (Cuirass 6, Greaves 4, the rest 2) at DFU\'s Leather; DFU\'s 76 garments in each cloth by their size (a bolt, two, three; boots a bolt and a Cured Leather), the men\'s and the women\'s; the rugs 3 Wool, tapestries 4 Wool, skins 2 and 1 of a pelt; the Fishing-Net 2 Linen; the Skinning Knife at the anvil and the Harpy-feathered arrows at the workbench', () => {
  assert.deepEqual(LEATHER_PIECES.map(([id, , t, n]) => [id, t, n]), [['cuirass', 102, 6], ['greaves', 104, 4], ['helm', 107, 2], ['lpauldron', 105, 2], ['rpauldron', 106, 2], ['gauntlets', 103, 2], ['boots', 108, 2]]);
  const ins = (id) => recipeById(id).inputs.map((i) => `${i.n} ${i.key}`).join(' + ');
  assert.deepEqual(['leather-cuirass:cured', 'leather-greaves:hardened', 'leather-boots:cured'].map((id) => { const r = recipeById(id); return [r.name, r.templateIndex, r.material, r.tier, r.rank, r.family, ins(id)]; }), [
    ['Leather Cuirass', 102, ARMOR_LEATHER, 2, 10, 'leather', '6 leather:cured'], ['Hardened Leather Greaves', 104, 0, 5, 55, 'leather', '4 leather:hardened'],
    ['Leather Boots', 108, 0, 2, 10, 'leather', '2 leather:cured'],
  ]);
  assert.equal(GARMENTS.length, 41 + 35, 'the men\'s 141-181 and the women\'s 182-216');
  assert.deepEqual(GARMENTS.map((g) => g[0]), Array.from({ length: 76 }, (_, i) => 141 + i));
  assert.deepEqual({ ...GARMENT_BOLTS }, { s: 1, m: 2, l: 3, b: 1 });
  assert.deepEqual([garmentGroup(141), garmentGroup(181), garmentGroup(182), garmentGroup(216)], ['MensClothing', 'MensClothing', 'WomensClothing', 'WomensClothing']);
  assert.deepEqual(['garment-141:linen', 'garment-146:wool', 'garment-163:silk', 'garment-148:linen', 'garment-195:standard'].map((id) => { const r = recipeById(id); return [r.name, r.group, r.cloth, r.tier, r.rank, ins(id)]; }), [
    ['Linen Straps', 'MensClothing', 'cloth:linen', 1, 0, '1 cloth:linen'], ['Wool Eodoric', 'MensClothing', 'cloth:wool', 2, 10, '2 cloth:wool'],
    ['Silk Plain Robes', 'MensClothing', 'cloth:silk', 4, 40, '3 cloth:silk'], ['Linen Tall Boots', 'MensClothing', 'cloth:linen', 1, 0, '1 cloth:linen + 1 leather:cured'],
    ["Standard-bearer's Silk Evening Gown", 'WomensClothing', 'cloth:standard', 5, 55, '3 cloth:standard'],
  ]);
  // 9.3 names the most; PROF0 29 decided the rest - the Loincloth small, the Wrap and the Peasant Blouse middle, the Toga large
  const size = Object.fromEntries(GARMENTS.map(([t, , s]) => [t, s]));
  assert.deepEqual([size[162], size[199], size[174], size[211], size[184], size[160]], ['s', 's', 'm', 'm', 'm', 'l']);
  // AUDIT 32 L3: every garment takes a dye - DFU's "unchangeable" shirts are its variant's word, and its shelf dyes them
  assert.deepEqual(OUTFITTING_RECIPES.filter((r) => r.kind === 'garment' && r.dyes !== true).map((r) => r.id), []);
  assert.deepEqual([178, 179, 214, 215].map((t) => GARMENTS.find((g) => g[0] === t)[1]), ['Short Shirt, unchangeable', 'Long Shirt, unchangeable', 'Short Shirt, unchangeable', 'Long Shirt, unchangeable']);
  assert.deepEqual([...RUGS.map(([t]) => ins(`rug-${t}:wool`)), ...TAPESTRIES.map(([t]) => ins(`tapestry-${t}:wool`))], ['3 cloth:wool', '3 cloth:wool', '3 cloth:wool', '3 cloth:wool', '4 cloth:wool', '4 cloth:wool', '4 cloth:wool']);
  assert.deepEqual([...PELTS], ['hide:rat', 'hide:bat', 'hide:bear', 'hide:tiger']);
  assert.deepEqual(['skins-244:bear', 'skins-245:tiger'].map((id) => [recipeById(id).name, recipeById(id).tier, ins(id), recipeById(id).kind]), [['Large Skins (Bear Hide)', 2, '2 hide:bear', 'furniture'], ['Small Skins (Tiger Pelt)', 3, '1 hide:tiger', 'furniture']]);
  const net = recipeById('fishingnet:linen');
  assert.deepEqual([net.templateIndex, FISHING_NET_TEMPLATE, net.rank, ins('fishingnet:linen'), net.kind, net.profession], [1603, 1603, 0, '2 cloth:linen', 'tool', 'outfitting']);
  assert.equal(OUTFITTING_RECIPES.length, 14 + 76 * 4 + 4 + 3 + 8 + 1);
  assert.ok(OUTFITTING_RECIPES.every((r) => r.profession === 'outfitting' && r.metal === null));
  assert.equal(RECIPES.length, SMITH_RECIPES.length + CARPENTRY_RECIPES.length + OUTFITTING_RECIPES.length + 4 + 7 + 120);   // PIN MOVED (PROF11): the Sculptor's four stone pieces; PIN MOVED (PROF9): the fire's seven dishes; PIN MOVED (PROF10): the jeweller's 120 pieces
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'every id its own');
  const knife = recipeById('knife:iron');
  assert.deepEqual([knife.templateIndex, knife.rank, knife.profession, ins('knife:iron')], [603, 0, 'smithing', '1 ingot:iron + 1 plank:pine']);
  assert.deepEqual([ins('arrows:harpy'), recipeById('arrows:harpy').stack, takesQuality(recipeById('arrows:harpy'))], ['1 plank:pine + 1 ingot:iron + 1 hide:harpy', 20, false]);
  assert.equal(recipeOpen(recipeById('garment-141:silk'), 39), false);
  assert.equal(recipeOpen(recipeById('garment-141:silk'), 40), true);
  assert.equal(craftXp(4, 40, true), 80 + FIRST_CRAFT_XP);
});

test('PROF7 law: the steps (9.2) - a Tailor\'s clothing, a Leatherworker\'s leather armour, and Hardened Leather\'s step as a Warforged ingot\'s; a garment\'s dye one of DFU\'s ten, asked of a garment that takes one, signed into its record as `u`', () => {
  const r = (id) => recipeById(id);
  assert.deepEqual([qualitySteps(r('garment-141:linen'), { spec50: 'tailor' }), qualitySteps(r('garment-141:linen'), { spec50: 'leatherworker' }), qualitySteps(r('leather-helm:cured'), { spec50: 'leatherworker' }), qualitySteps(r('leather-helm:cured'), { spec50: 'tailor' })], [1, 0, 1, 0]);
  assert.deepEqual([qualitySteps(r('leather-helm:hardened')), qualitySteps(r('leather-helm:hardened'), { clean: true, spec50: 'leatherworker' }), qualitySteps(r('rug-237:wool'), { spec50: 'tailor' })], [1, 3, 0]);
  assert.deepEqual([...GARMENT_DYES], [...CLOTHING_DYES]);
  assert.deepEqual([...GARMENT_DYES], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([dyeOk(r('garment-141:linen'), 3), dyeOk(r('garment-141:linen'), null), dyeOk(r('garment-141:linen'), undefined), dyeOk(r('longsword:iron'), null)], [true, true, true, true]);
  for (const [id, dye] of [['garment-141:linen', 10], ['garment-141:linen', -1], ['garment-141:linen', 2.5], ['garment-141:linen', '2'], ['leather-helm:cured', 1], ['rug-237:wool', 1], ['longsword:iron', 0]]) {
    assert.equal(dyeOk(r(id), dye), false, `${id} ${dye}`);
  }
  assert.equal(dyeOk(null, 1), false);
  const claims = { p: 'f'.repeat(16), s: 'S'.repeat(40), h: 'H'.repeat(40), r: 'garment-141:linen', q: 1, m: null, c: 7, i: 1 };
  assert.deepEqual([productRecordValid({ ...claims, u: 4 }), productRecordValid(claims), productRecordValid({ ...claims, u: null }), productRecordValid({ ...claims, u: 10 }), productRecordValid({ ...claims, r: 'rug-237:wool', u: 4 }), productRecordValid({ ...claims, r: 'longsword:iron', u: 4 })],
    [true, true, false, false, false, false]);
});

test('PROF7 law: a garment\'s record carries its dye, and an undyed piece none (the mint, and its read)', async () => {
  const at = { subtle: globalThis.crypto.subtle, nowS: 1_800_000_000 };
  const base = { p: 'f'.repeat(16), s: 'S'.repeat(40), h: 'H'.repeat(40), q: 1, m: null, c: 7 };
  assert.equal(readProductRecord(await mintProductRecord({ ...base, r: 'garment-141:linen', u: 8 }, null, at)).u, 8);
  assert.equal(readProductRecord(await mintProductRecord({ ...base, r: 'garment-141:linen' }, null, at)).u, undefined);
  await assert.rejects(() => mintProductRecord({ ...base, r: 'leather-helm:cured', u: 8 }, null, at), /could not verify/);
});

// ─── THE STITCH (9.4) ────────────────────────────────────────────────

test('PROF7 law: the stitch - the needle\'s beat every 0.75 s, a band 0.2 of it wide x the band ((AGI + SPD) / 2); eight stitches, each 0.25 s at least after the last, all on the beat a clean act; one off, or fewer than eight, not; Gentle acts never clean', () => {
  assert.deepEqual({ ...STITCH_ACT }, { stitches: 8, beatS: 0.75, bandW: 0.2, gapS: 0.25 });
  assert.equal(stitchBand({ agility: 50, speed: 70 }), actBand(60));
  assert.deepEqual([beatAt(0), beatAt(0.375), beatAt(0.75), beatAt(0.8)].map((x) => Math.round(x * 1000) / 1000), [0, 0.5, 0, 0.067]);
  assert.deepEqual([onBeat(0, 0.2), onBeat(0.1, 0.2), onBeat(0.11, 0.2), onBeat(0.9, 0.2), onBeat(0.89, 0.2), onBeat(0.5, 0.2)], [true, true, false, true, false, false]);
  const sew = (act, times) => { for (const t of times) { act.tick(t - act.state.t); act.stitch(); } return act.report(); };
  const beats = Array.from({ length: 8 }, (_, i) => 0.75 * (i + 1));
  assert.deepEqual(sew(createStitchAct(), beats), { stitches: 8, hits: 8, clean: true });
  assert.deepEqual(sew(createStitchAct(), [...beats.slice(0, 7), 0.75 * 8 + 0.3]), { stitches: 8, hits: 7, clean: false });
  const soon = createStitchAct();
  soon.tick(0.75); soon.stitch();
  soon.tick(0.1);
  assert.equal(soon.stitch(), null, 'too soon after the last');
  const short = createStitchAct();
  sew(short, beats.slice(0, 5));
  short.cancel();
  assert.deepEqual([short.report().clean, short.stitch()], [false, null]);
  assert.equal(sew(createStitchAct({ gentle: true }), beats).clean, false);
  assert.equal(createStitchAct({ band: 2 }).state.w, 0.4);
});

// ─── THE SPECIALISATIONS, THE MARKET, THE HOME, THE LARDER ───────────

test('PROF7 law: Trophy Hunter, Couturier and Saddler are named and never chosen - DFU gives them nothing to stand as (For Mac); the loom\'s pieces list on the market; a home\'s loom a sixth station at a workbench\'s licence; a Butcher\'s meat spoils half as fast', () => {
  const later = (p, r, id) => SPECIALISATIONS[p][r].find((s) => s.id === id)?.later ?? null;
  assert.deepEqual([later('hunting', 100, 'trophy-hunter'), later('outfitting', 100, 'couturier'), later('outfitting', 100, 'saddler')], ['trophy', 'two-colour', 'wagon']);
  assert.deepEqual([specOk('hunting', 100, 'trophy-hunter'), specOk('hunting', 100, 'butcher'), specOk('hunting', 50, 'tanner'), specOk('outfitting', 50, 'tailor'), specOk('outfitting', 100, 'couturier')], [false, true, true, true, false]);
  assert.deepEqual(CRAFTED_FAMILIES.slice(-6, -3).map(([f]) => f), ['leather', 'clothing', 'furnishings']);   // PIN MOVED (PROF11): the mason's stonework lists after the loom's three; PIN MOVED (PROF9): and the fire's dishes after it; PIN MOVED (PROF10): and the jeweller's pieces after them
  assert.deepEqual(['leather-helm:cured', 'garment-141:linen', 'rug-237:wool', 'skins-244:bear', 'fishingnet:linen', 'knife:iron', 'arrows:harpy'].map(pieceListable), [true, true, true, true, true, true, false]);
  assert.deepEqual([DECOR_STATIONS.at(-4), DECOR_STATION_FEES.loom, DECOR_STATION_NAMES.loom], ['loom', 50_000, 'Loom']);   // PIN MOVED (PROF11): the mason's bench a seventh after it; PIN MOVED (PROF10): the jeweller's bench an eighth; PIN MOVED (HOME-VENDOR): the hired trader a ninth
  // a day's rot: a plain Raw Meat rolls every day; a Butcher's every other, aged half its days
  const rolls = () => 0.99;   // the highest roll: whatever may spoil, spoils
  const plain = { templateIndex: CC.RawMeat }, slow = { templateIndex: CC.RawMeat, slowRot: true };
  const stages = [];
  for (let day = 0; day < 4; day++) { rotFoodDay([[plain, slow]], day, rolls); stages.push([plain.foodStage ?? 0, slow.foodStage ?? 0]); }
  assert.deepEqual(stages, [[1, 1], [2, 1], [3, 2], [4, 2]]);
});
