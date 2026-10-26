// DAEDRIC-SMELT (2026-10-25; bible/06-Systems/Professions-Arc.md section 53) - THE DAEDRIC INGOT, MADE. The report
// (SaberGGaming): no Daedric ingot could be had - the transmutation stops at Platinum (as intended), and the forge's
// table ended at Orichalcum ("Daedric waits on its heart and its stone") while 27 anvil recipes spent the ingot. The
// owner: "No band aids", and "the heart may come FROM LOOT OR THE GATE". PROF0 4.1's recipe, built: an Ebony Ingot, a
// Daedra's Heart (DFU's, CreatureIngredients1 53) and a Sigil Stone - the Deadlands Ember since WB12a - smelted only.
// The heart is the loot's word, so it enters the Stores loose alone (bagLaw.js looseOrder - walled from the market) and
// is a CATALYST: its origin never reaches the ingot. The ember is the account service's count, spent from the account's
// purse as the Sigil Broker spends it, and from the pack on the client (the insignia's own order). The law, the client's
// half and the Forge's words here; the service's half in daedricsmelt_service.test.js.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SMELT_RECIPES, WORK_RECIPES, DAEDRA_HEART, DAEDRIC_EMBERS, EMBER_MADE, workEmbers, smeltRecipe, smeltOrigin, minedMaterial,
  withdrawable, gemTierOfPrice, MINED_KEYS, LOOSE_ONLY_KEYS, looseOnly,
} from '../../src/net/professionLaw.js';
import { material } from '../../src/net/nodeLaw.js';
import { UNYIELDED, marketCatalogue, pieceListable } from '../../src/net/marketLaw.js';
import { looseOrder, DEPOSIT_ORDERS } from '../../src/net/bagLaw.js';
import { CHAIN_WORKS, chainWorkOk, chainPlan } from '../../src/net/chainLaw.js';
import { WRIT_KITS } from '../../src/net/craftWritLaw.js';
import { commissionable } from '../../src/net/writLaw.js';
import { RECIPES, recipeOpen, workFirstXp, FIRST_MAKE_SHARE } from '../../src/net/recipeLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { emberHands, stoneCount } from '../../src/systems/sigil/sigilBroker.js';
import { sigilStone } from '../../src/systems/gate/gateSpoils.js';
import { RITE_HEART } from '../../src/systems/riteChest.js';
import { CREATURE_INGREDIENT_THEME } from '../../src/systems/loot/lootThemes.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { materialKeyOfItem } from '../../src/systems/materialsBag.js';
import { mintMaterialItem } from '../../src/systems/professions/profItems.js';
import { setItemFields, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { smeltable, DAEDRIC_LINE } from '../../src/ui/professions/profPages.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const HEART = DAEDRA_HEART.key;
const DAEDRIC = smeltRecipe('ingot:daedric');

test('DAEDRIC-SMELT law: the forge\'s last smelt - an Ebony Ingot and a Daedra\'s Heart, the heart a catalyst, and one Deadlands Ember a unit; a Quartermaster\'s two ingots, as every ingot\'s; Smithing\'s 10 XP a tier (mutants: the embers dropped; the catalyst unmarked; the smelt gone)', () => {
  assert.deepEqual(DAEDRIC, {
    id: 'ingot:daedric', out: 'ingot:daedric', inputs: [{ key: 'ingot:ebony', n: 1 }, { key: HEART, n: 1, catalyst: true }], station: 'forge', per: 1,
    more: { profession: 'smithing', spec: 'quartermaster', per: 2 }, xp: 'smithing', embers: 1,
  });
  assert.equal(SMELT_RECIPES.at(-1), DAEDRIC, 'the forge\'s table, its last row');
  assert.equal(DAEDRIC_EMBERS, 1, 'PROF0 4.1: a Sigil Stone a unit');
  // FIRST-BUDGET: a smelt pays no first-make - Smithing's share (FIRST_MAKE_SHARE) is the crafts', the Daedric smelt's
  // first time pays its tier's XP alone, as every ingot's
  assert.deepEqual([workFirstXp(DAEDRIC), workFirstXp(smeltRecipe('ingot:ebony')), FIRST_MAKE_SHARE.smithing > 0], [0, 0, true]);
  // every other work spends none and carries neither field
  for (const r of WORK_RECIPES) if (r !== DAEDRIC) assert.ok(!('embers' in r) && r.inputs.every((i) => !('catalyst' in i)), r.id);
  assert.deepEqual([workEmbers(DAEDRIC, 1), workEmbers(DAEDRIC, 7), workEmbers(DAEDRIC, 0), workEmbers(DAEDRIC, 1.5), workEmbers(smeltRecipe('ingot:ebony'), 5), workEmbers(null, 3)], [1, 7, 0, 0, 0, 0]);
  assert.deepEqual(EMBER_MADE, ['ingot:daedric']);
  assert.deepEqual(material('ingot:daedric'), { key: 'ingot:daedric', family: 'metals', tier: 7, value: 40, templateIndex: 629 });
});

test('DAEDRIC-SMELT law: the heart is DFU\'s own - CreatureIngredients1 53, 500 gold, tier 6 by its price as a body\'s part is - a Stores material the pack mints as DFU\'s heart, so a looted one (a daedra\'s, the faithful\'s chest\'s) is the same unit; registered the loose door\'s, after CLOTH-GEMS\' graded gems (mutants: the row unregistered; its template not DFU\'s)', () => {
  assert.deepEqual(DAEDRA_HEART, { key: 'part:daedra-heart', family: 'hides', tier: 6, group: 'CreatureIngredients1', templateIndex: 53 });
  const row = templateByIndex(53);
  assert.deepEqual([row.name, row.basePrice, gemTierOfPrice(row.basePrice)], ['Daedra\'s Heart', 500, 6]);
  assert.equal(minedMaterial(HEART), DAEDRA_HEART);
  assert.equal(LOOSE_ONLY_KEYS.at(-1), HEART, 'the loose door\'s last: no graded gem before it moved');   // PIN MOVED (CLOTH-GEMS at the merge): the loose door\'s, never MINED_KEYS - the market\'s catalogue
  assert.equal(MINED_KEYS.includes(HEART), false);
  assert.equal(withdrawable(HEART), true, 'a loose heart goes back to the pack as it came');
  const minted = mintMaterialItem(HEART);
  assert.deepEqual([minted.group, minted.templateIndex], ['CreatureIngredients1', 53]);
  assert.equal(materialKeyOfItem(minted), HEART);
  // the loot's heart: a daedra's (lootThemes - an Imp, a Seducer, a Daedra Lord) and the Breach's faithful's chest
  for (const t of [MOBILE_TYPES.Imp, MOBILE_TYPES.DaedraSeducer, MOBILE_TYPES.DaedraLord]) assert.deepEqual(CREATURE_INGREDIENT_THEME[t].C1, [53]);
  assert.deepEqual({ ...RITE_HEART }, { templateIndex: 53, group: 'CreatureIngredients1' });
  assert.equal(materialKeyOfItem(setItemFields({ group: RITE_HEART.group, templateIndex: RITE_HEART.templateIndex })), HEART, 'the Gate\'s heart is the forge\'s');
});

test('DAEDRIC-SMELT law: the heart through the LOOSE door and never the market - only a station\'s put-in moves units the service never counted; the heart is the loose door\'s as a graded gem is (LOOSE_ONLY_KEYS), out of the catalogue, while the Daedric ingot is the catalogue\'s and its 27 anvil works are made, listed and commissioned (mutants: UNYIELDED the ingot\'s again; the heart off the loose door\'s list; looseOrder for every order)', () => {
  assert.deepEqual(Object.keys(DEPOSIT_ORDERS).map((o) => [o, looseOrder(o)]), [['all', false], ['spend', false], ['work', true]]);
  assert.deepEqual([[...UNYIELDED], looseOnly(HEART)], [[], true], 'nothing waits on a yield; the heart is the loose door\'s');   // PIN MOVED (CLOTH-GEMS at the merge): UNYIELDED's no more
  const cat = new Set(marketCatalogue().map((m) => m.key));
  assert.deepEqual([cat.has(HEART), cat.has('ingot:daedric')], [false, true]);
  const daedric = RECIPES.filter((r) => r.inputs.some((i) => i.key === 'ingot:daedric'));
  assert.equal(daedric.length, 27, 'the 27 anvil works that spend it');
  const made = new Set(WORK_RECIPES.map((r) => r.out));
  for (const r of daedric) {
    assert.ok(r.inputs.every((i) => made.has(i.key) || material(i.key)), `${r.id}: every input has a home`);
    assert.ok(made.has('ingot:daedric'), `${r.id}: its ingot is smelted`);
    assert.deepEqual([r.rank, recipeOpen(r, 90), recipeOpen(r, 89)], [90, true, false], `${r.id}: a Master's, at 90`);
    assert.equal(pieceListable(r.id), true, r.id);
    assert.equal(commissionable(r.id), true, `${r.id}: a buyer may commission it now`);
  }
});

test('DAEDRIC-SMELT law: a catalyst gives the product no origin - the ingot is own, bought or loose as its Ebony Ingot was, whatever the heart\'s; no chain plans the smelt and no crafting writ asks its kit (mutants: the catalyst counted; the chain planning it; the writ asking it)', () => {
  assert.deepEqual(smeltOrigin(DAEDRIC, 3, [1, 3]), { own: 2, bought: 1 }, 'the hearts\' three bought units make no ingot bought');
  assert.deepEqual(smeltOrigin(DAEDRIC, 2, [0, 2]), { own: 2, bought: 0 });
  assert.deepEqual(smeltOrigin(DAEDRIC, 2, [2, 0]), { own: 0, bought: 2 }, 'the Ebony Ingot\'s origin is the ingot\'s');
  assert.equal(chainWorkOk(DAEDRIC), false);
  assert.ok(!CHAIN_WORKS.includes(DAEDRIC));
  // a Daedric Dagger from raw, everything but the ingot held: the chain plans no Daedric smelt - the press is the player's
  const held = (k) => ({ 'ingot:ebony': 5, [HEART]: 5, 'metal:tin': 5 }[k] ?? 0);
  const plan = chainPlan(RECIPES.find((r) => r.id === 'dagger:daedric').inputs, held, { track: () => ({ rank: 100, specs: {} }), room: () => 5000 });
  assert.equal(plan.ok, false, 'the ingot is no chain\'s to make');
  assert.ok(!(plan.works ?? []).some((w) => w.id === 'ingot:daedric'));
  assert.ok(!WRIT_KITS.some((r) => r.id === 'kit:daedric'), 'a writ pays its inputs\' worth; the ember is no Stores good');
  assert.ok(WRIT_KITS.some((r) => r.id === 'kit:ebony'));
});

test('DAEDRIC-SMELT the pack\'s half (sigilBroker.js emberHands): the unlocked embers held, a take all or none and its undo once, the checkpoint asked on every move (mutants: a locked ember spent; a short take half-taken; the undo twice)', () => {
  const stack = Object.assign(sigilStone(), { stackCount: 3 });
  const locked = Object.assign(sigilStone(), { locked: true });
  const player = { items: [stack, locked] };
  let saved = 0;
  const hands = emberHands(player, () => { saved++; });
  assert.equal(hands.held(), 3, 'the locked ember is never spent (LOCK1)');
  const short = hands.take(4);
  assert.deepEqual([short.taken, stoneCount(player.items), saved], [0, 4, 0], 'all or none: nothing moved, nothing saved');
  const t = hands.take(2);
  assert.deepEqual([t.taken, hands.held(), saved], [2, 1, 1]);
  t.back();
  t.back();
  assert.deepEqual([hands.held(), saved], [3, 2], 'given back once, however many doors ask');
  assert.equal(emberHands({}).held(), 0, 'no pack: none held');
  assert.equal(emberHands({}).take(1).taken, 0);
});

/** A book over a stand-in door whose Stores hold Ebony Ingots and loose hearts enough for five smelts (`heartInPack`: the
 *  heart in the pack, not the Stores - a station's put-in would move it), its pack's embers `embers` - `answers` the
 *  smelt's answers in turn; `moved` every unit the hands took out of the bag and the pack. */
async function forge({ embers = 1, answers = [], heartInPack = false } = {}) {
  const asked = [], moved = [];
  const day = Math.floor(Date.now() / 86_400_000);
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'smithing', xp: 0, rank: 0, specs: { 50: null, 100: null } }], today: {}, taken: [],
      stores: [{ material: 'ingot:ebony', own: 5, bought: 0 }, ...(heartInPack ? [] : [{ material: HEART, own: 0, bought: 0, loose: 5 }])], caps: { stores: 5000, withdraw: 200, highHides: 3 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    smelt: async (c, recipe, count, rid) => { asked.push({ recipe, count, rid, pack: pack.held() }); return answers.shift() ?? { ok: false, error: 'offline' }; },
    deposit: async () => ({ ok: false, error: 'offline' }),
  };
  const player = { items: embers ? [Object.assign(sigilStone(), { stackCount: embers })] : [] };
  const pack = emberHands(player);
  const inPack = (k) => (heartInPack && k === HEART ? 1 : 0);
  const carry = { held: inPack, heldAll: inPack, room: () => 99, mint: () => ({ bag: 0, pack: 0, left: 0 }), take: (k, n) => { moved.push([k, n]); return { taken: n, back: () => {} }; }, give: () => ({ bag: 0, pack: 0, over: 0 }), embers: pack };
  const book = createProfBook({ door, storage: null, character: () => 'c1', sleep: () => Promise.resolve(), carry });
  await book.refresh();
  return { book, asked, pack, moved };
}
const made = (extra = {}) => ({ ok: true, data: { recipe: 'ingot:daedric', count: 1, own: 1, bought: 0, xp: 70, embers: 1, purse: 0, track: null, stores: [], ...extra } });

test('DAEDRIC-SMELT the book\'s smelt (net/profBook.js): a pack short of embers asks nothing; the embers are out of the pack BEFORE the service is asked and stay out on its smelt - a repeat\'s too - and come back on its refusal or an answer that never came (mutants: the pack never asked; taken after the answer; kept on a refusal; kept on a lost answer)', async () => {
  const none = await forge({ embers: 0, heartInPack: true });
  assert.deepEqual(await none.book.smelt('ingot:daedric', 1), { ok: false, error: 'embers', need: 1, have: 0 });
  assert.deepEqual([none.asked.length, none.moved], [0, []], 'the service never asked, and the pack\'s heart left where it was');
  assert.equal(accountRefusalText('embers'), 'Each Daedric Ingot takes a Deadlands Ember from your pack, and your pack holds too few.');
  const two = await forge({ embers: 1 });
  assert.deepEqual((await two.book.smelt('ingot:daedric', 2)).error, 'embers', 'two units, two embers');
  // made: taken first, kept
  const ok = await forge({ embers: 2, answers: [made()] });
  const r = await ok.book.smelt('ingot:daedric', 1);
  assert.equal(r.ok, true);
  assert.deepEqual([ok.asked[0].pack, ok.pack.held()], [1, 1], 'out of the pack while the service was asked, and kept');
  // refused by the service (its purse short): back
  const purse = await forge({ embers: 1, answers: [{ ok: false, error: 'prof-embers', status: 409 }] });
  assert.equal((await purse.book.smelt('ingot:daedric', 1)).error, 'prof-embers');
  assert.deepEqual([purse.asked[0].pack, purse.pack.held()], [0, 1], 'given back: the service holds no smelt');
  assert.match(accountRefusalText('prof-embers'), /^Each Daedric Ingot takes a Deadlands Ember, won closing Dagon's Breaches/);
  // never answered: back - and the same press asked again, answered `repeat`, takes them then
  const lost = await forge({ embers: 1, answers: [{ ok: false, error: 'offline' }, { ok: false, error: 'offline' }, { ok: false, error: 'offline' }, made({ repeat: true })] });
  assert.equal((await lost.book.smelt('ingot:daedric', 1)).ok, false);
  assert.equal(lost.pack.held(), 1, 'given back while unheard');
  assert.equal((await lost.book.smelt('ingot:daedric', 1)).ok, true);
  assert.equal(lost.asked.at(-1).rid, lost.asked[0].rid, 'the same smelt');
  assert.equal(lost.pack.held(), 0, 'taken on the answer that says it was made');
  // a work that spends none never touches the pack
  const iron = await forge({ embers: 1, answers: [{ ok: true, data: { recipe: 'ingot:ebony', count: 1, own: 1, bought: 0, xp: 60, track: null, stores: [] } }] });
  iron.book.state.stores.set('ore:ebony', { material: 'ore:ebony', own: 4, bought: 0 });
  assert.equal((await iron.book.smelt('ingot:ebony', 1)).ok, true);
  assert.equal(iron.pack.held(), 1);
  assert.equal(iron.book.embers(), 1, 'the book reads the pack');
  assert.equal(createProfBook({ door: {}, carry: null }).embers(), null, 'no pack: unknown');
});

test('DAEDRIC-SMELT the Forge (ui/professions/profPages.js): a smelt\'s most is bounded by the pack\'s embers where the book knows them; the Daedric line says what it takes and where a heart and an ember are won, while it cannot be made; the world host hands the book its hands once the checkpoint stands (mutants: the embers unbounded; the line unsaid; the hands never handed)', () => {
  const all = () => 1000;
  assert.deepEqual([smeltable(DAEDRIC, all, 4), smeltable(DAEDRIC, all, 0), smeltable(DAEDRIC, all, null), smeltable(DAEDRIC, (k) => (k === HEART ? 2 : 1000), 9)], [4, 0, 100, 2]);
  assert.equal(DAEDRIC_LINE, 'A Daedric Ingot takes an Ebony Ingot, a Daedra\'s Heart and a Deadlands Ember. Hearts are carried by the daedra you slay and won at Dagon\'s Breaches; embers are won closing the Breaches, slaying Sea Serpents and taking Elite Breach Redoubts, and each one is spent from what your account has won.');
  const pages = src('src/ui/professions/profPages.js');
  assert.match(pages, /  if \(daedricWaits\(book\)\) detail\.append\(el\('p', 'px-note', daedricWord\(\)\)\);/);
  assert.match(pages, /const daedricWaits = \(book\) => !!DAEDRIC_SMELT && smeltable\(DAEDRIC_SMELT, \(k\) => workOf\(book, k\), book\.embers\?\.\(\) \?\? null\) < 1;/);
  assert.match(pages, /    const most = smeltable\(r, held, embers\);/);
  const w = src('src/scenes/world.js');
  assert.match(w, /  const saveSoon = createSaveSoon\(\);\n(?:  \/\/[^\n]*\n)*  carryHands\.embers = emberHands\(playerEntity, saveSoon\.changed\);/);
});
