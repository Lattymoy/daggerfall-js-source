// FIRST-BUDGET (2026-10-25, SaberGGaming's report: "Provisioning is slow"; the owner: "No band aids"), RETUNED (the owner,
// asked: "Match Smithing's pace") - A FIRST-MAKE PAYS ITS TRACK'S SHARE, SET SO EVERY CRAFTING TRACK REACHES MASTER IN
// SMITHING'S CRAFTS (net/recipeLaw.js FIRST_MAKE_SHARE, FIRST_MAKE_FLOOR, firstMakesOf, firstMakeXp, firstCraftXp,
// workFirstXp, brewFirstXp; tools/craftPace.mjs craftPace, firstShares). Every first-make paid a flat 500, every track
// alike, and the tracks' pools differ tenfold; now Smithing's first pays the 500 it did and each other track's the least
// share that brings it to Master in Smithing's 172 crafts - derived by the walk, pinned in the law, held equal here - and
// none under the 500. The share says how much a first pays, CLOTH-GEMS whether. Pinned here: the shares and the floor,
// each track's count, the keys the service keys a first by, the words that say it, the pace it makes and the derivation
// that sets it - through the real Worker. bible/06-Systems/Professions-Arc.md 52.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import {
  FIRST_MAKE_SHARE, FIRST_MAKE_FLOOR, firstMakesOf, firstMakeXp, firstCraftXp, workFirstXp, brewFirstXp, firstCraftKey, firstCraftKin, firstCraftPays,
  RECIPES, recipeById, COOKING_RECIPES, craftXp, cookXp,
} from '../../src/net/recipeLaw.js';
import { MASON_RECIPES, WORK_RECIPES, PROFESSIONS, trackOf, xpForRank } from '../../src/net/professionLaw.js';
import { POTIONS, potionById, brewFirstPays } from '../../src/net/alchemyLaw.js';
import { craftXpLine, dishFirstLine, masonWorksFirstLine } from '../../src/ui/craftXpWords.js';
import { craftPace, firstShares } from '../../tools/craftPace.mjs';

const TRACKS = ['smithing', 'outfitting', 'building', 'provisioning'];
const shares = (track) => {
  const out = {};
  for (const k of firstMakesOf(track)) out[firstMakeXp(track, k)] = (out[firstMakeXp(track, k)] ?? 0) + 1;
  return out;
};

test('FIRST-BUDGET the law (the owner, asked: "Match Smithing\'s pace"): a first-make pays its track\'s share - Smithing 500 (unchanged), Outfitting 511, Building 1,823, Provisioning 3,155 - none under the 500 every track paid; each crafting track\'s every first-make its share, Smithing 221, Outfitting 332 (CLOTH-GEMS\' cloth patterns in it), Building 43, Provisioning 22; Enchanting and the gathering tracks none (mutants: a share moved; Smithing\'s moved; the floor moved; a work counted that pays none; a smelt counted; the pool asked as bought; a brew of the Apothecaries\' goods alone counted)', () => {
  assert.deepEqual({ ...FIRST_MAKE_SHARE }, { smithing: 500, outfitting: 511, building: 1823, provisioning: 3155 });
  assert.ok(Object.isFrozen(FIRST_MAKE_SHARE), 'one home, read, never written');
  assert.equal(FIRST_MAKE_FLOOR, 500, 'the flat first every track paid before - no track pays less');
  for (const t of TRACKS) assert.ok(FIRST_MAKE_SHARE[t] >= FIRST_MAKE_FLOOR, `${t}: no less than the 500 it paid`);
  assert.deepEqual(TRACKS.map((t) => firstMakesOf(t).length), [221, 332, 43, 22]);
  assert.deepEqual(TRACKS.map((t) => shares(t)), [{ 500: 221 }, { 511: 332 }, { 1823: 43 }, { 3155: 22 }], 'every first-make of a track its share');
  assert.deepEqual(Object.keys(FIRST_MAKE_SHARE).sort(), PROFESSIONS.map((p) => p.id).filter((id) => trackOf(id) === id && firstMakesOf(id).length).sort(), 'a share for every track with a first-make, and none other');
  const prov = firstMakesOf('provisioning');
  assert.deepEqual(prov, ['stew@1', 'supper@1', 'tart@2', 'feast@6', ...POTIONS.filter(brewFirstPays).map((p) => p.id)], 'the dishes\' patterns, then DFU\'s twenty less the two of the Apothecaries\' goods alone');
  // a discipline answers its craft's track
  assert.deepEqual([firstMakesOf('cooking'), firstMakesOf('alchemy'), firstMakesOf('jewelcrafting').length, firstMakesOf('masonry').length, firstMakesOf('carpentry').length], [prov, prov, 221, 43, 43]);
  assert.deepEqual([firstMakeXp('alchemy', 'healing'), firstMakeXp('jewelcrafting', firstMakesOf('smithing')[0]), firstMakeXp('masonry', 'cut:stone')], [3155, 500, 1823]);
  for (const t of PROFESSIONS.filter((p) => trackOf(p.id) === p.id && !['smithing', 'outfitting', 'building', 'provisioning'].includes(p.id))) {
    assert.deepEqual(firstMakesOf(t.id), [], `${t.id}: no first-make, no share`);
  }
  assert.deepEqual([firstMakeXp('provisioning', 'nothing@1'), firstMakeXp('smithing', 'stew@1'), firstMakeXp('enchanting', 'stew@1')], [0, 0, 0], 'a key none of the track\'s pays none');
});

test('FIRST-BUDGET the keys the service keys a first by: a recipe its pattern at its tier (its kin one first, one share), a mason\'s work its id, a brew its potion - each only where its first pays (AUDIT 32 S1: the Apothecaries\' goods alone none; CLOTH-GEMS: the Weavers\' cloth alone its share asked as own, none asked as bought); a smelt pays no first (mutants: the kin split; the counter\'s guard dropped; the pool asked as bought; a smelt\'s first; the brew keyed by its name)', () => {
  for (const r of RECIPES) {
    const want = firstCraftPays(r) ? firstMakeXp(r.profession, firstCraftKey(r)) : 0;
    assert.equal(firstCraftXp(r), want, r.id);
    if (firstCraftPays(r)) assert.ok(want > 0, `${r.id}: its pattern in its track's pool`);
    for (const id of firstCraftKin(r)) assert.equal(firstCraftXp(recipeById(id)), want, `${r.id}: its kin ${id} one share`);
    assert.ok(firstCraftXp(r, true) > 0 && firstCraftXp(r, true) === firstMakeXp(r.profession, firstCraftKey(r)), `${r.id}: asked as own, its pattern\'s share (CLOTH-GEMS: every recipe\'s first can pay)`);
  }
  assert.deepEqual(['garment-141:linen', 'rug-237:wool', 'fishingnet:linen'].map((id) => firstCraftXp(recipeById(id))), [0, 0, 0], 'the Weavers\' cloth alone, asked as bought');
  assert.deepEqual(['garment-141:linen', 'rug-237:wool', 'fishingnet:linen'].map((id) => firstCraftXp(recipeById(id), true)), [511, 511, 511], 'and asked as own - the loom\'s cloth: Outfitting\'s share');
  assert.deepEqual([firstCraftXp(null), workFirstXp(null), brewFirstXp(null)], [0, 0, 0]);
  assert.deepEqual(MASON_RECIPES.map((w) => [w.id, workFirstXp(w)]), [['cut:stone', 1823], ['mix:mortar', 1823]], 'the bench\'s two works, Building\'s share each, as the bench\'s line says');
  assert.deepEqual(WORK_RECIPES.filter((w) => !w.act).map((w) => workFirstXp(w)).filter((x) => x !== 0), [], 'a smelt, a burn, a saw, a cure, a weave, a transmutation: no first');
  assert.deepEqual(POTIONS.map((p) => brewFirstXp(p) > 0), POTIONS.map((p) => brewFirstPays(p)), 'a brew\'s first where it pays');
  assert.deepEqual([brewFirstXp(potionById('healing')), brewFirstXp(potionById('purification')), brewFirstXp(potionById('waterBreathing')), brewFirstXp(potionById('levitation'))], [3155, 3155, 0, 0]);
  assert.deepEqual(COOKING_RECIPES.map((r) => firstCraftXp(r)), Array(COOKING_RECIPES.length).fill(3155), 'every dish Provisioning\'s share, either herb\'s way');
  assert.deepEqual([firstCraftXp(recipeById('longsword:daedric')), firstCraftXp(recipeById('ring:gold:ruby')), firstCraftXp(recipeById('staff:pine')), firstCraftXp(recipeById('garment-149:linen'))], [500, 500, 1823, 511]);
});

test('FIRST-BUDGET the words say it: the anvil\'s, the workbench\'s and the loom\'s line, the fire\'s and the mason\'s bench\'s say the first\'s share, its thousands grouped (mutants: the 500 back in a line; the share unformatted)', () => {
  assert.equal(craftXpLine(recipeById('dagger:iron'), 0, 'Smithing'), '20 Smithing experience, and 500 more the first time you make this piece at this grade.');
  assert.equal(craftXpLine(recipeById('staff:pine'), 0, 'Building'), '20 Building experience, and 1,823 more the first time you make this piece at this grade.');
  assert.equal(craftXpLine(recipeById('leather-boots:cured'), 10, 'Outfitting'), '40 Outfitting experience, and 511 more the first time you make this piece at this grade.');
  assert.equal(dishFirstLine(recipeById('stew:north'), 'Provisioning'), 'The first time you cook this dish: 3,155 more Provisioning experience.');
  assert.equal(masonWorksFirstLine(0, 'Building'), 'Your first cut and your first mix each earn 1,823 more Building experience.');
});

test('FIRST-BUDGET the pace it makes (tools/craftPace.mjs), and the shares it derives (the owner, asked: "Match Smithing\'s pace"): crafts to Journeyman and to Master, every act at its best, clean where it can be - the flat 500: Smithing 45 and 172, Outfitting 46 and 176, Building 116 and 525, Provisioning 178 and 599; the law: every track at Master in Smithing\'s 172 - Outfitting at Journeyman in 45, Building in 14, Provisioning in 8 (one share a track matches Master, not both); each share the least that does it, one XP less a 173rd craft; none under the floor (mutants: a share moved; Smithing\'s pace ignored; the floor dropped; the bisection off by one; the walk\'s flat ignored; the cloth bought; the pan unclean)', () => {
  const pace = (p) => Object.fromEntries(Object.entries(p).map(([t, v]) => [t, [v.journeyman, v.master]]));
  assert.deepEqual(pace(craftPace(500)), { smithing: [45, 172], building: [116, 525], outfitting: [46, 176], provisioning: [178, 599] }, 'the flat 500 on CLOTH-GEMS\' recipe set (the report measured Outfitting 116 and 246 before its cloth patterns paid)');
  assert.deepEqual(pace(craftPace()), { smithing: [45, 172], building: [14, 172], outfitting: [45, 172], provisioning: [8, 172] }, 'the law: every track at Master in Smithing\'s 172');
  assert.deepEqual(craftPace(), craftPace({ ...FIRST_MAKE_SHARE }), 'the law\'s firsts are its shares, walked');
  // the derivation: Smithing's pace at the floor's 500 the target, each track's share the least that meets it
  assert.equal(craftPace(FIRST_MAKE_FLOOR, ['smithing']).smithing.master, 172, 'Smithing\'s pace, the target');
  assert.deepEqual(firstShares(), { ...FIRST_MAKE_SHARE }, 'the law\'s shares are the derivation\'s - pinned, and exact');
  for (const t of ['outfitting', 'building', 'provisioning']) {
    assert.equal(craftPace({ [t]: FIRST_MAKE_SHARE[t] - 1 }, [t])[t].master, 173, `${t}: one XP less and Master is a craft later - the least share`);
  }
  // the floor: a target slower than every track at 500 answers 500 for each - no track pays less than it did
  assert.deepEqual(firstShares(600), { smithing: 500, building: 500, outfitting: 500, provisioning: 500 });
});

test('FIRST-BUDGET DONE WHEN, through the real Worker: Provisioning\'s first brew pays 20 and its 3,155 and its first dish 20 and its 3,155, a second of either its own XP alone; Smithing\'s first piece its 500 as ever; Building\'s first cut its 1,823; Outfitting\'s first Linen Boots its 511 (mutants: the service\'s binds the old 500; a brew\'s first unpaid)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const give = (m, n) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(mac.id, mac.character, m, n);
  const setXp = (prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, prof, xp);
  let n = 0;
  const rid = () => `firstbudget-${++n}`;
  const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
  const brew = async () => {
    for (const k of HEALING) give(k, 1);
    return s.call('/v1/prof/brew', { character: mac.character, potion: 'healing', keys: HEALING, rid: rid() }, mac.secret);
  };
  const craft = async (id) => {
    for (const i of recipeById(id).inputs) give(i.key, i.n);
    return s.call('/v1/prof/craft', { character: mac.character, recipe: id, clean: false, name: 'Mac', rid: rid() }, mac.secret);
  };
  const b1 = await brew();
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  assert.deepEqual([b1.body.first, b1.body.xp], [true, 20 + 3155], 'the first Healing: Provisioning\'s share');
  setXp('provisioning', 0);
  const b2 = await brew();
  assert.deepEqual([b2.body.first, b2.body.xp], [false, 20], 'the second: its own XP alone');
  const d1 = await craft('stew:north');
  assert.deepEqual([d1.status, d1.body.first, d1.body.xp], [200, true, cookXp(0) + 3155], JSON.stringify(d1.body));
  setXp('provisioning', 0);
  const d2 = await craft('stew:south');
  assert.deepEqual([d2.body.first, d2.body.xp], [false, cookXp(0)], 'the southern Stew is the same dish: no second first');
  const sword = await craft('dagger:iron');
  assert.deepEqual([sword.status, sword.body.first, sword.body.xp], [200, true, craftXp(1, 0) + 500], 'Smithing\'s 500, as it was');
  const boot = await craft('garment-149:linen');
  assert.deepEqual([boot.status, boot.body.first, boot.body.xp], [200, true, craftXp(1, 0) + 511], JSON.stringify(boot.body));
  give('stone:rough', 2);
  const cut = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cut:stone', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([cut.status, cut.body.first, cut.body.xp, cut.body.track.xp], [200, true, 20 + 1823, 20 + 1823], JSON.stringify(cut.body));
  assert.equal(xpForRank(50), 25_000, 'Journeyman, the record\'s measure');
});
