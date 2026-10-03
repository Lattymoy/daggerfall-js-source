// PROF9 (2026-10-02) - COOKING AS THE CLIENT MAKES IT: The Fire on the Stores page (any lit fire - a campfire, a hearth, a
// brazier - no fee): the seven dishes with their inputs and ranks, THE PAN (each pan heating raw to burnt along its bar,
// taken off in its window - C&C's Skillet half again - every pan done a clean act), Quick cook, Gentle acts, one act a page,
// Escape setting it aside; Cooking practised on the Professions page; the dishes as items (C&C's own food rows under
// their names, eaten by C&C's own law, spoiled by it - a Provisioner's never), what eating one does (DFU's Fortify for its
// minutes, the Tart's stamina, renewed not stacked; a feast shared with the party through ALLY-CAST's frame); a Field
// Cook's kit; and the done-when, driven through the real Worker: A HUNTER'S STEW COOKED WITH A CLEAN PAN AT A FIRE FROM
// THE STORES' RAW MEAT, MUSHROOM AND ROOT BULB, INTO THE PACK, EATEN - ENDURANCE +5 FOR TWO HOURS - AND A CHEF'S FEAST
// SHARED WITH THE PARTY AT THE TABLE. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md 3.3, 4.8, 9.3, 9.4, 35.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, PROF_XP_MAX, COOK_FIRE } from '../src/net/professionLaw.js';
import { recipeById, DISH_LEVEL, PAN_ACT, panWindow, dishOf, HAND_CHEF, dishSpell } from '../src/net/recipeLaw.js';
import { validCastData } from '../src/net/wire.js';
import { allyCastFrame, allyCastSpell } from '../src/systems/allyCast.js';
import { applySpell, removeBundleNamed } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { liveBundles, canEndBundle, endBundle } from '../src/systems/mysticism.js';
import { mintPiece, mintPieces, craftedText, asMinted, COOK_KEPT_TEXT } from '../src/systems/smithItems.js';
import { mintDish, dishUse, feedEffect, dishStaminaFactor, setFeastShare, installCooking, feastSharedLine, DISH_STAMINA_KIND, isDish, isPartyDishSpell, takeFeastGift, renewDish, isFeastRecord, dishStandsLine, shareFeastWith } from '../src/systems/cookItems.js';
import { hallStepsFor } from '../src/net/fortLaw.js';
import { DISH_TEMPLATE_ROWS, DISH_FOODS } from '../src/systems/profTemplates.js';
import { materialLabel, withdrawIntoPack } from '../src/systems/profItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { useItem } from '../src/systems/useItem.js';
import { isFood, foodOf, FOOD, TEMPLATE, rotFoodDay } from '../src/systems/survival/food.js';
import { SURVIVAL_TEMPLATES } from '../src/systems/survival/items.js';
import { survivalOf } from '../src/systems/survival/needs.js';
import { placeCampItem, CAMP_KIND } from '../src/systems/survival/camp.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { fatigueLossMultiplierFor } from '../src/scenes/shared.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { SPECIAL_ABILITY } from '../src/systems/rest.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, setDownProfAct, profActUnderWay, _cookForTests, _masonForTests,
  PAN_DOWN_LINE, FIRE_AWAY_LINE,
} from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const PROV = '0123456789abcdef';
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const docKeys = new Set();
const realAdd = document.addEventListener, realRemove = document.removeEventListener;
document.addEventListener = (t, f, c) => { if (t === 'keydown') docKeys.add(f); return realAdd.call(document, t, f, c); };
document.removeEventListener = (t, f, c) => { if (t === 'keydown') docKeys.delete(f); return realRemove?.call(document, t, f, c); };
const key = (ev) => {
  let stopped = false;
  const e = { code: 'Space', target: document.body, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { stopped = true; }, ...ev };
  for (const f of [...docKeys]) { if (stopped) break; f(e); }
  return e;
};
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

/** The Stores page drawn into the document, and its buttons. */
function pageOf(draw0 = drawStoresPage) {
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); draw0(root, draw, kit); };
  draw();
  return {
    draw, text: () => root.textContent, buttons: () => [...root.querySelectorAll('button')], root: () => root,
    button: (label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) ?? null,
    dish: (prefix) => [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-recipe') && b.textContent.startsWith(prefix)) ?? null,
    done() { root?.remove?.(); },
  };
}
/** The pan on the fire brought into its window (or `to` of the bar) and taken off with the page's own button. */
function takePan(page, to = null) {
  const a = _cookForTests().act;
  assert.ok(a, 'the pan on the fire');
  const want = to ?? (a.state.lo + a.state.hi) / 2;
  a.tick(Math.max(0.001, (want - a.state.heat) / a.state.rate));
  page.button('Take it off').onclick();
}
/** A dish the pan asked, answered. */
async function settled() {
  for (let i = 0; i < 400 && _cookForTests().crafting; i++) await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 4; i++) await tick();
}
const hungry = (entity, now) => { survivalOf(entity, now).lastAte = now - 600; };

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF9 DONE WHEN: a Hunter\'s Stew cooked with a clean pan at a fire from the Stores\' Raw Meat, Mushroom and Root Bulb (Cooking XP half again and the first time\'s 500), into the pack as C&C\'s food under its own name, eaten - the hunger met, Endurance +5 for two hours as the player\'s own buff; a Chef\'s Feast of the Hearth shared with the party at the table through ALLY-CAST\'s frame, a day and a half each - through the real Worker', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  setPref('gentleActs', false);
  setPref('survival', 'casual');
  resetProfPages();
  installCooking();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const track = (xp, spec50 = null, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'cooking', ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`).run(mac.id, mac.character, xp, spec50, spec100, NOON);
  give('food:meat', 2); give('food:mushroom', 1); give('p1:13', 1);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const player = { items: [], stats: { ...STATS }, activeEffects: [], level: 10 };
  let fire = COOK_FIRE;
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: '' }), fire: () => fire, panBand: () => 1, skillet: () => false,
    craft: async (recipe, opts) => {
      const r = await book.craft(recipe, { ...opts, name: 'Silverthorn' }, (data) => { for (const it of mintPieces(data)) player.items.push(it); });
      return { ok: r.ok, text: r.ok ? `${craftedText(mintPieces(r.data))} (+${r.data.xp} Cooking XP).` : accountRefusalText(r.error) };
    },
  });
  const page = pageOf();
  try {
    assert.match(page.text(), /The Fire/);
    assert.match(page.text(), /A fire to cook at\. Cooking 0 \(Novice\)\. A Skillet in your pack would widen the pan's window\./);
    page.dish('Hunter\'s Stew (northern Root Bulb)').onclick();
    assert.match(page.text(), /Raw Meat 2 \/ 2 \(2 stored\)/);
    assert.match(page.text(), /Endurance \+5 for 2 hours\./);
    assert.match(page.text(), /One serving, into your pack\. 3 pans; every pan taken off done is a clean pan, half again its 20 Cooking XP\./);
    page.button('Cook').onclick();
    assert.equal(profActUnderWay(), true);
    assert.match(page.text(), /The pan \(Hunter's Stew\) - take each pan off while it is done, in the window \(Space\): 3 pans/);
    for (let i = 0; i < 3; i++) takePan(page);
    await settled();
    assert.equal(profActUnderWay(), false);
    assert.equal(player.items.length, 1);
    const [stew] = player.items;
    assert.deepEqual([stew.templateIndex, stew.group, stew.name, stew.recipe, stew.maker, stew.quality, stew.noRot, stew.chef], [685, 'UselessItems2', 'Hunter\'s Stew', 'stew:north', 'Silverthorn', undefined, undefined, undefined]);
    assert.match(stew.provenance, /^[0-9a-f]{16}$/);
    assert.deepEqual([isFood(stew), isDish(stew), foodOf(stew).satiety], [true, true, FOOD[TEMPLATE.Meat].satiety]);
    assert.equal(book.track('cooking').xp, 30 + 500, 'a clean pan half again, and the first stew\'s 500');
    assert.deepEqual([book.held('food:meat'), book.held('food:mushroom'), book.held('p1:13')], [0, 0, 0]);
    assert.match(page.text(), /You cooked a Hunter's Stew \(\+530 Cooking XP\)\./);
    // EATEN: C&C's own law - the hunger met - and Endurance +5 for two hours, the player's own buff
    const now = 100_000;
    hungry(player, now);
    const ate = useItem(stew, player.items, { entity: player, nowMinute: now });
    assert.equal(ate.kind, 'ate');
    assert.match(ate.text, /^You eat the Hunter's Stew\. You feel invigorated by the meal\.$/);
    assert.deepEqual([player.items.length, survivalOf(player, now).lastAte > now - 600], [0, true], 'eaten: off the pack, the hunger met');
    assert.deepEqual([liveStat(player, 'endurance'), liveStat(player, 'agility')], [55, 50]);
    const [bundle] = liveBundles(player);
    assert.deepEqual([bundle.name, bundle.selfCast, bundle.entries.length, bundle.entries[0].roundsRemaining], ['Hunter\'s Stew', true, 1, 119], 'a buff of the player\'s own, two hours (DFU\'s initial round taken)');
    // A CHEF'S FEAST: a Master who chose the Chef cooks it quick; eaten, it reaches the party at the table
    track(PROF_XP_MAX, null, 'chef');
    for (const [m, n] of [['food:meat', 4], ['food:fish', 4], ['food:apple', 2], ['food:orange', 2], ['food:mushroom', 2], ['food:egg', 2]]) give(m, n);
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.dish('Feast of the Hearth').onclick();
    assert.match(page.text(), /Strength, Endurance and Willpower \+5 for a day and a half, for the whole party at your table\./);
    page.button('Quick cook').onclick();
    await settled();
    const feast = player.items.find((it) => it.templateIndex === 688);
    assert.deepEqual([feast?.chef, feast?.noRot, feast?.recipe], [true, undefined, 'feast:hearth']);
    const mate = { stats: { ...STATS }, activeEffects: [] };
    const sent = [];
    setFeastShare((spell) => {
      const frame = validCastData(allyCastFrame(spell, DISH_LEVEL, 'mate-0001'));
      sent.push(frame);
      applySpell(allyCastSpell(frame.spell), frame.level, mate, {}, () => 0.5, null, { allyCast: true });   // the mate's own client (world.js online.onCast)
      return ['Ann'];
    });
    hungry(player, now + 1000);
    const fed = useItem(feast, player.items, { entity: player, nowMinute: now + 1000 });
    assert.match(fed.text, /You eat the Feast of the Hearth\. You feel invigorated by the meal\. The feast is shared with Ann\.$/);
    assert.equal(sent.length, 1);
    assert.deepEqual(['strength', 'endurance', 'willpower'].map((k) => [liveStat(player, k), liveStat(mate, k)]), [[55, 55], [60, 55], [55, 55]], 'the stew\'s Endurance beside the feast\'s - two dishes, two bundles');
    const days = (e) => e.activeEffects.filter((a) => a.bundleName === 'Feast of the Hearth').map((a) => a.roundsRemaining);
    assert.deepEqual([days(player), days(mate)], [[2159, 2159, 2159], [2159, 2159, 2159]], 'a Chef\'s feast, a day and a half at the table and at the eater\'s');
    assert.equal(mate.activeEffects.every((a) => a.bundleAlly === true), true, 'a mate\'s gift');
    assert.ok(player.activeEffects.filter((a) => a.bundleName === 'Feast of the Hearth').every((a) => a.bundleSelfCast === true), 'every entry the eater\'s own buff');
  } finally { page.done(); setProfessionsPages(null); setFeastShare(null); fire = null; }
});

// ─── THE PAGE ────────────────────────────────────────────────────────

/** The Stores page over a stub book - the fire where `fire` says, Cooking at `rank` under `specs`. */
function stubPages({ fire = COOK_FIRE, rank = 0, specs = { 50: null, 100: null }, held: heldIn = {}, skillet = false, over = {} } = {}) {
  resetProfPages();
  setPref('gentleActs', false);
  const held = new Map(Object.entries({ 'food:meat': 9, 'food:mushroom': 9, 'p1:13': 9, 'p2:13': 0, ...heldIn }));
  const tracks = new Map([['cooking', { profession: 'cooking', xp: xpForRank(rank), rank, specs }], ['masonry', { profession: 'masonry', xp: 0, rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
    choose: async () => ({ ok: true }),
  };
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), fire: () => fire, panBand: () => 1, skillet: () => skillet,
    craft: async (r, o) => { calls.push(['craft', r, o.clean]); return { ok: true, text: 'cooked' }; },
    ...over,
  });
  return { book, calls, held, tracks };
}

test('PROF9 pages: The Fire - away from one, the word (no dish offered); at one, the seven dishes with their ranks (the Tart\'s 10, the Feast\'s 70) and their inputs; the pan taken off done three times asks the dish clean, one raw not, one burnt by the fire not; Quick cook plain; Gentle acts plain; a Skillet\'s window half again; a Cook\'s two servings and a Provisioner\'s keeping said', async () => {
  let { calls } = stubPages({ fire: null });
  let page = pageOf();
  try {
    assert.match(page.text(), /The Fire/);
    assert.ok(page.text().includes(FIRE_AWAY_LINE));
    assert.equal(page.dish('Hunter\'s Stew'), null, 'no dish offered away from a fire');
    page.done();
    ({ calls } = stubPages());
    page = pageOf();
    assert.deepEqual(page.buttons().filter((b) => b.className.includes('prof-recipe')).map((b) => b.textContent), [
      'Hunter\'s Stew (northern Root Bulb)can cook now', 'Hunter\'s Stew (southern Root Bulb)wants its inputs',
      'Fisherman\'s Supper (northern Green Leaves)wants its inputs', 'Fisherman\'s Supper (southern Green Leaves)wants its inputs',
      'Orchard Tart (northern Yellow Berries)rank 10', 'Orchard Tart (southern Yellow Berries)rank 10', 'Feast of the Hearthrank 70',
    ]);
    page.dish('Hunter\'s Stew (northern').onclick();
    page.button('Cook').onclick();
    assert.equal(page.dish('Hunter\'s Stew (southern').disabled, true, 'nothing else picked while the pan is on');
    assert.deepEqual([page.button('Quick cook').disabled, page.button('Cook').disabled], [true, true], 'the dish held while its pan is on');
    const [lo, hi] = panWindow(0, 1, false);
    assert.deepEqual([_cookForTests().act.state.lo, _cookForTests().act.state.hi], [lo, hi]);
    for (let i = 0; i < 3; i++) takePan(page);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'stew:north', true]);
    // one pan raw
    page.draw();
    page.button('Cook').onclick();
    takePan(page); takePan(page, 0.3); takePan(page);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'stew:north', false], 'a raw pan: not clean');
    // one pan burnt on the fire - the loop's own frame ends the act
    page.draw();
    page.button('Cook').onclick();
    takePan(page); takePan(page);
    const a = _cookForTests().act;
    a.tick(2 / a.state.rate);
    assert.deepEqual([a.state.done, a.report().burnt, a.report().clean], [true, 1, false]);
    for (let i = 0; i < 6 && _cookForTests().act; i++) await new Promise((r) => setTimeout(r, 20));
    await tick();
    assert.deepEqual([_cookForTests().act, calls.at(-1)], [null, ['craft', 'stew:north', false]], 'the fire\'s own frame ends the act and asks the dish, not clean');
    // Quick cook: no pan, plain
    ({ calls } = stubPages());
    page.draw();
    page.dish('Hunter\'s Stew (northern').onclick();
    page.button('Quick cook').onclick();
    await tick();
    assert.deepEqual([_cookForTests().act, calls.at(-1)], [null, ['craft', 'stew:north', false]]);
    // Gentle acts: Cook is plain, no pan
    setPref('gentleActs', true);
    page.draw();
    page.dish('Orchard Tart (northern').onclick();
    page.dish('Hunter\'s Stew (southern').onclick();
    assert.equal(page.button('Cook').disabled, true, 'the southern Root Bulb not held');
    page.dish('Hunter\'s Stew (northern').onclick();
    page.button('Cook').onclick();
    await tick();
    assert.deepEqual([_cookForTests().act, calls.length, calls.at(-1)], [null, 2, ['craft', 'stew:north', false]]);
    setPref('gentleActs', false);
    page.done();
    // a Skillet: the window half again; a Cook's two; a Provisioner's keeping
    const st = stubPages({ skillet: true, rank: 100, specs: { 50: 'cook', 100: 'provisioner' } });
    page = pageOf();
    assert.match(page.text(), /Cooking 100 \(Master\)\. Your Skillet widens the pan's window\./);
    page.dish('Hunter\'s Stew (northern').onclick();
    assert.match(page.text(), /Endurance \+5 for 2 hours\. Yours never spoil\./);
    assert.match(page.text(), /Two servings \(a Cook's\), into your pack\. 3 pans; every pan taken off done is a clean pan, half again its 140 Cooking XP\./);
    page.button('Cook').onclick();
    assert.deepEqual([_cookForTests().act.state.lo, _cookForTests().act.state.hi], panWindow(100, 1, true));
    assert.ok(_cookForTests().act.state.hi - _cookForTests().act.state.lo > PAN_ACT.w * 1.5 * 1.5 - 1e-9);
    setDownProfAct();
    assert.equal(st.calls.length, 0);
    page.draw();
    assert.ok(page.text().includes(PAN_DOWN_LINE), 'Escape sets the pan aside, nothing spent, said');
  } finally { page.done(); setProfessionsPages(null); }
  assert.equal(calls.length, 2, 'the quick dish and the gentle one');
});

test('PROF9 pages: the pan\'s keys - Space takes it off (a held key\'s repeat nothing); the page shut under it lets it go, nothing spent; one act a page - the mason\'s chisel holds the fire, and the fire the chisel', async () => {
  const { calls } = stubPages({ held: { 'stone:rough': 9 }, over: { mason: () => ({ kind: 'home', fee: 0 }), smelt: async () => ({ ok: true, text: 'cut' }), chiselBand: () => 1 } });
  const page = pageOf();
  try {
    page.dish('Hunter\'s Stew (northern').onclick();
    page.button('Cook').onclick();
    for (let i = 0; i < 3; i++) {
      const a = _cookForTests().act;
      a.tick(((a.state.lo + a.state.hi) / 2 - a.state.heat) / a.state.rate);
      key({ repeat: true });
      assert.equal(a.state.takes.length, i, 'a repeat takes nothing');
      key({});
    }
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'stew:north', true], 'Space took each pan off done');
    // one act a page
    page.draw();
    page.button('Cook').onclick();
    page.draw();
    assert.match(page.text(), /Your hands are at the fire - finish there first\./);
    assert.equal(_masonForTests().act, null);
    _cookForTests().act.cancel();
    setDownProfAct();
    page.draw();
    page.buttons().find((b) => b.textContent === 'Cut').onclick();
    page.draw();
    assert.equal(page.button('Cook').disabled, true, 'the chisel holds the fire');
    assert.match(page.text(), /Your hands are at the mason's bench - finish there first\./);
    setDownProfAct();
    // the page shut under the pan: let go, nothing asked
    page.draw();
    page.button('Cook').onclick();
    const n = calls.length;
    page.done();
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual([_cookForTests().act, calls.length], [null, n]);
  } finally { page.done(); setProfessionsPages(null); }
});

test('PROF9 pages: Cooking practised on the Professions page - its four cards chosen at their ranks, its unlocks by rank (the Stew and the Supper at 0, the Tart at 10, the Feast at 70)', () => {
  stubPages({ rank: 55, specs: { 50: 'field-cook', 100: null } });
  const page = pageOf(drawProfessionsPage);
  try {
    page.buttons().find((b) => b.textContent.startsWith('Cooking')).onclick();
    page.draw();
    assert.doesNotMatch(page.text(), /not practised in the Bay yet/);
    const cards = page.buttons().filter((b) => b.className.includes('prof-spec'));
    assert.deepEqual(cards.map((c) => [c.textContent.slice(0, c.textContent.indexOf(' ') > 0 && c.textContent.startsWith('Field') ? 10 : c.textContent.startsWith('Provisioner') ? 11 : 4), c.disabled]),
      [['Cook', false], ['Field Cook', true], ['Chef', true], ['Provisioner', true]], 'the Cook offered (a change), the Field Cook chosen, the two at 100 shut below it');
    assert.match(page.text(), /Hunter's Stew, Fisherman's Supperrank 0/);
    assert.match(page.text(), /Orchard Tartrank 10/);
    assert.match(page.text(), /Feast of the Hearthrank 70/);
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── THE ITEMS ───────────────────────────────────────────────────────

test('PROF9 items: the four dishes registered (685-688) on C&C\'s own rows - the Stew and the Feast the Meat\'s picture, the Supper the Cooked Fish\'s, the Tart the Bread\'s; never stacked, never shelved; food by C&C\'s law under their names; a dish minted from its answer, a Chef\'s feast and a Provisioner\'s dish carrying their hands; what a craft says', () => {
  assert.deepEqual({ ...DISH_FOODS }, { stew: TEMPLATE.Meat, supper: TEMPLATE.CookedFish, tart: TEMPLATE.Bread, feast: TEMPLATE.Meat });
  const cc = (t) => SURVIVAL_TEMPLATES.find((r) => r.index === t);
  assert.deepEqual(DISH_TEMPLATE_ROWS.map((r) => [r.index, r.name, r.worldTextureArchive, r.worldTextureRecord, r.baseWeight, r.basePrice, r.hitPoints, r.stackable, r.rarity]), [
    [685, 'Hunter\'s Stew', cc(537).worldTextureArchive, cc(537).worldTextureRecord, 2, 45, 90, false, 10],
    [686, 'Fisherman\'s Supper', cc(536).worldTextureArchive, cc(536).worldTextureRecord, 1.5, 18, 80, false, 10],
    [687, 'Orchard Tart', cc(534).worldTextureArchive, cc(534).worldTextureRecord, 1.5, 15, 95, false, 10],
    [688, 'Feast of the Hearth', cc(537).worldTextureArchive, cc(537).worldTextureRecord, 8, 180, 90, false, 10],
  ]);
  for (const t of [685, 686, 687, 688]) assert.equal(templateByIndex(t)?.name, DISH_TEMPLATE_ROWS.find((r) => r.index === t).name);
  const tart = mintPiece({ recipe: 'tart:south', quality: -1, seed: 1, maker: 'Ann', hand: 2 }, PROV);
  assert.deepEqual([tart.templateIndex, tart.name, tart.noRot, tart.chef, tart.maker, tart.recipe, tart.provenance, tart.stackCount], [687, 'Orchard Tart', true, undefined, 'Ann', 'tart:south', PROV, 1]);
  assert.deepEqual([foodOf(tart).name, foodOf(tart).satiety, foodOf(tart).keeps, foodOf(tart).raw], ['Orchard Tart', FOOD[TEMPLATE.Bread].satiety, FOOD[TEMPLATE.Bread].keeps, false]);
  const feast = mintDish({ recipe: 'feast:hearth', maker: null, hand: HAND_CHEF }, PROV);
  assert.deepEqual([feast.chef, feast.noRot, feast.maker], [true, undefined, undefined]);
  assert.equal(mintDish({ recipe: 'stew:north', hand: HAND_CHEF }, PROV).chef, undefined, 'a Chef\'s hand is a feast\'s');
  assert.deepEqual([mintDish({ recipe: 'longsword:iron' }, PROV), mintDish({ recipe: 'stew:north' }, 'nope')], [null, null]);
  assert.deepEqual([craftedText([tart]), craftedText([tart, tart]), craftedText([feast])], ['You cooked an Orchard Tart', 'You cooked 2 servings of Orchard Tart', 'You cooked a Feast of the Hearth']);
  assert.equal(itemLongName(tart), 'Orchard Tart');
  assert.deepEqual([ITEM_FIELDS.noRot.kind, ITEM_FIELDS.chef.kind], ['bool', 'bool'], 'they ride the save');
  assert.equal(COOK_KEPT_TEXT, 'The last pan came off the fire, but no word came back - the dish is kept, and made when the word comes.');
});

test('PROF9 items: a dish spoils by C&C\'s own day - a Provisioner\'s never, nor the foods a Provisioner takes from the Stores; a spoiled dish is no longer as minted (it lists nowhere); a Butcher\'s meat still half as fast', () => {
  const plain = mintDish({ recipe: 'stew:north' }, PROV);
  const kept = mintDish({ recipe: 'stew:north', hand: 2 }, '1123456789abcdef');
  const always = () => 0.999;
  assert.equal(asMinted(plain), true);
  assert.equal(rotFoodDay([[plain, kept]], 50, always), 1, 'the plain stew spoiled a stage, the Provisioner\'s did not');
  assert.deepEqual([plain.foodStage, kept.foodStage ?? 0], [1, 0]);
  assert.equal(asMinted(plain), false, 'spoiled since it was cooked: not as minted');
  assert.equal(asMinted(kept), true);
  const pack = { items: [] };
  assert.equal(withdrawIntoPack(pack, 'food:apple', 2, true, { noRot: true }), 2);
  assert.equal(withdrawIntoPack(pack, 'p1:13', 1, true, { noRot: true }), 1);
  assert.deepEqual(pack.items.map((i) => i.noRot), [true, true, undefined], 'a food takes it; an herb does not');
  assert.equal(rotFoodDay([pack.items], 50, always), 0, 'a Provisioner\'s provisions never spoil');
});

test('PROF9 items: what eating does - a dish eaten again renews its effect, never stacks; the Tart lengthens a stamina a fifth (the drain divided by 1.2, over the career\'s own) for four hours; with C&C off a dish is simply eaten; with it on, a full stomach refuses it whole (no effect); a feast with no party eaten alone', () => {
  setPref('survival', 'casual');
  installCooking();
  const now = 50_000;
  const p = { items: [], stats: { ...STATS }, activeEffects: [] };
  const supper = () => { const d = mintDish({ recipe: 'supper:north' }, PROV); p.items.push(d); return d; };
  survivalOf(p, now).lastAte = now;
  const full = useItem(supper(), p.items, { entity: p, nowMinute: now });
  assert.deepEqual([full.kind, p.items.length, liveStat(p, 'agility')], ['notEaten', 1, 50], 'a full stomach: refused, nothing laid on');
  p.items.length = 0;
  hungry(p, now);
  useItem(supper(), p.items, { entity: p, nowMinute: now });
  hungry(p, now);
  useItem(supper(), p.items, { entity: p, nowMinute: now });
  assert.deepEqual([liveStat(p, 'agility'), liveBundles(p).length], [55, 1], 'renewed, never stacked');
  // the Tart
  feedEffect(p, dishOf('tart'));
  assert.equal(p.activeEffects.filter((a) => a.kind === DISH_STAMINA_KIND).length, 1);
  assert.equal(p.activeEffects.find((a) => a.kind === DISH_STAMINA_KIND).roundsRemaining, 239);
  assert.equal(dishStaminaFactor(p), 1 / 1.2);
  assert.equal(fatigueLossMultiplierFor(p), 1 / 1.2);
  const athlete = { ...p, career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY.Athleticism } };
  assert.equal(fatigueLossMultiplierFor({ career: athlete.career }), 0.9);
  assert.ok(Math.abs(fatigueLossMultiplierFor(athlete) - 0.9 / 1.2) < 1e-12, 'over the career\'s own');
  for (const a of p.activeEffects) a.roundsRemaining = 0;
  assert.equal(dishStaminaFactor(p), 1, 'run out');
  // C&C off: simply eaten
  setPref('survival', false);
  const q = { items: [], stats: { ...STATS }, activeEffects: [] };
  const stew = mintDish({ recipe: 'stew:south' }, PROV);
  q.items.push(stew);
  const out = dishUse(stew, q.items, { entity: q, nowMinute: now });
  assert.deepEqual([out.kind, out.text, q.items.length, liveStat(q, 'endurance'), q.survival], ['ate', 'You eat the Hunter\'s Stew.', 0, 55, undefined]);
  // a feast with no share door: eaten alone
  setFeastShare(null);
  const f = mintDish({ recipe: 'feast:hearth' }, PROV);
  q.items.push(f);
  assert.equal(dishUse(f, q.items, { entity: q, nowMinute: now }).text, 'You eat the Feast of the Hearth.');
  assert.equal(feastSharedLine(['Ann', 'Bob', 'Ann']), 'The feast is shared with Ann and Bob.');
  assert.equal(feastSharedLine([]), null);
  assert.equal(dishUse({ templateIndex: 685 }, [], { entity: q }), null, 'no recipe, no dish');
  assert.deepEqual([isDish({ templateIndex: 685 }), isDish({ templateIndex: 685, recipe: 'longsword:iron' }), isDish({ templateIndex: 685, recipe: 'stew:north' })], [false, false, true]);
  setPref('survival', 'casual');
});

test('PROF9 items: a Field Cook lights a Campfire Kit\'s fire without its charge (3.3) - REST2 (the Rest-Arc merge of main): no placing spends a charge for anyone now, so `keep` is accepted and changes nothing; the Campfire leaves the pack with its fuel while it stands, and a tent pitches free', () => {
  const kitItem = createSurvivalItem(TEMPLATE.Campfire);
  const list = [kitItem];
  const uses = kitItem.currentCondition;
  const at = { feet: [0, 0, 0], yaw: 0, probe: () => 1, place: {} };
  const kept = placeCampItem(kitItem, list, { ...at, keep: true });
  assert.deepEqual([kept.ok, kept.camp.kind, kept.camp.wear, list.length], [true, CAMP_KIND.Fire, uses, 0], 'a Field Cook\'s: every night of fuel rides the fire');
  const plain = createSurvivalItem(TEMPLATE.Campfire);
  const pl = [plain];
  const spent = placeCampItem(plain, pl, { ...at });
  assert.deepEqual([spent.ok, spent.camp.wear, pl.length], [true, uses, 0], 'and anyone\'s, the same');
  const tent = createSurvivalItem(TEMPLATE.CampingEquipment);
  const tl = [tent];
  const tu = tent.currentCondition;
  const pitched = placeCampItem(tent, tl, { ...at, keep: true });
  assert.equal(pitched.camp.wear, tu, 'a tent pitches free - a night in it spends its use');
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF9 wiring: the fire is any lit one (the street\'s camps and braziers, a building\'s hearth, a dungeon\'s fire) at no fee; the world crafts a dish there by Cooking\'s station, the pan\'s band off INT and PER, the Skillet off the pack; a Provisioner\'s provisions withdrawn never to spoil; a Field Cook\'s kit in the street and underground; a feast shared through ALLY-CAST\'s frame to the party; every host eats a dish and the Tart lengthens a stamina; C&C\'s own cooking stays C&C\'s, teaching nothing', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /: profession === 'cooking'   \/\/ PROF9: the fire - any lit one, a campfire, a hearth, a brazier; no fee\n\s+\? \{ here: \(\) => cookFireHere\(\), a: 'a fire', who: 'cook', noun: 'fire', kept: COOK_KEPT_TEXT, xp: 'Cooking'/);
  assert.match(w, /const cookFireHere = \(\) => \(_mode\(\) === 'exterior'\n\s+\? \(camps\.fireNear\(walkMode && playerSpawned \? player\.pos : cam\.pos\) \? COOK_FIRE : null\)\n\s+: modes\?\.cookFireHere\?\.\(\) \?\? null\);/);
  assert.match(w, /fire: \(\) => cookFireHere\(\),\n\s+panBand: \(\) => panBand\(\{ intelligence: liveStat\(playerEntity, 'intelligence'\), personality: liveStat\(playerEntity, 'personality'\) \}\),\n\s+skillet: \(\) => hasSkillet\(playerEntity\?\.items\),/);
  assert.match(w, /noRot: profBook\?\.track\('cooking'\)\?\.specs\?\.\[100\] === 'provisioner' \}\);/);
  assert.match(w, /fieldCook: \(\) => fieldCookNow\(\),   \/\/ PROF9: a Field Cook's kit keeps its charge\n/);
  assert.match(w, /const fieldCookNow = \(\) => profBook\?\.state\?\.open === true && profBook\.track\('cooking'\)\?\.specs\?\.\[50\] === 'field-cook';/);
  assert.match(w, /fieldCook: \(\) => fieldCookNow\(\),   \/\/ PROF9: a Field Cook's kit keeps its charge underground too/);
  assert.match(w, /setFeastShare\(\(spell\) => \{\n\s+if \(!online \|\| online\.status !== 'open' \|\| !social\?\.party\) return \[\];\n(?:\s+\/\/[^\n]*\n)*\s+return shareFeastWith\(peersNear\(\), \{ isMate: \(id\) => social\.isPartyPeer\(id\), send: \(id\) => online\.sendCast\?\.\(allyCastFrame\(spell, DISH_LEVEL, id\)\),/);   // PIN MOVED (AUDIT PROF-541 K5, R2-H1): the mates in sight, by cookItems.js shareFeastWith
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /cookFireHere\(\) \{\n\s+if \(mode === 'interior'\) return interiorCamps\.fireNear\(player\.pos\) \? COOK_FIRE : null;\n\s+if \(mode === 'dungeon'\) return dungeonCtx\?\.cookFire\?\.\(\) === true \? COOK_FIRE : null;\n\s+return null;/);
  assert.match(m, /fieldCook: \(\) => host\.fieldCook\?\.\(\) === true,/);
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /cookFire: \(\) => !!\(_fpFeet && camps\.fireNear\(_fpFeet\)\),/);
  assert.match(d, /fieldCook: \(\) => opts\.fieldCook\?\.\(\) === true,/);
  const c = src('src/scenes/camps.js');
  assert.match(c, /keep: fieldCook\?\.\(\) === true,/);
  // C&C's own cooking: the camp's and the brazier's own list, the mod's law, no profession in it
  assert.match(c, /const r = cookFood\(raw\[i\], items, \{ skillet: hasSkillet\(items\) \}\);/);
  assert.doesNotMatch(c, /profBook|recipeLaw|professionLaw/);
  const sh = src('src/scenes/shared.js');
  assert.match(sh, /\n {2}installCooking\(\);   \/\/ PROF9/);
  assert.match(sh, /const tart = dishStaminaFactor\(entity\);/);
  const p = src('src/ui/profPages.js');
  assert.match(p, /drawCookFire\(detail, rerender, kit\);   \/\/ PROF9/);
  assert.match(src('src/ui/enhancedPlusStyle.js'), /\.prof-heatbar\.prof-panbar \{ background: linear-gradient/);
  const svc = src('server-account/src/professions.js');
  assert.match(svc, /const xp = r\.kind === 'dish' \? cookXp\(rank, \{ clean: clean === true, steps: halls \}\) : craftXp\(r\.tier, rank, false\);/);   // PIN MOVED (PROF12): the Apothecary's steps
  assert.match(svc, /const hand = dishHand\(r, specs\[100\]\) \?\? jewelHand\(r, specs\[50\]\);/);   // PIN MOVED (PROF10): or a jeweller's hand
  assert.match(src('server-account/migrations/0069_cooking.sql'), /ALTER TABLE products ADD COLUMN hand INTEGER CHECK \(hand IS NULL OR hand IN \(1, 2\)\);/);
  assert.equal(recipeById('feast:hearth').profession, 'cooking');
});

// ─── AUDIT PROF9 (2026-10-03) ────────────────────────────────────────

test('AUDIT PROF9 K1: a Butcher-Provisioner\'s meat carries both marks and never spoils - never spoiling asked before half the pace; a Butcher\'s alone still half as fast', () => {
  const always = () => 0.999;
  const both = { items: [] };
  withdrawIntoPack(both, 'food:meat', 1, true, { slowRot: true, noRot: true });
  const meat = both.items[0];
  assert.deepEqual([meat.slowRot, meat.noRot], [true, true]);
  let spoiled = 0;
  for (let d = 0; d < 40; d++) spoiled += rotFoodDay([both.items], d, always);
  assert.deepEqual([spoiled, meat.foodStage ?? 0], [0, 0], 'forty days, never a stage');
  const butcher = { items: [] };
  withdrawIntoPack(butcher, 'food:meat', 1, true, { slowRot: true });
  assert.deepEqual([rotFoodDay([butcher.items], 0, always), rotFoodDay([butcher.items], 1, always), rotFoodDay([butcher.items], 2, always)], [1, 0, 1], 'rolled every other day');
});

test('AUDIT PROF9 K2: a feast a party mate shares RENEWS mine as one eaten does - my bundles of its name taken off before the gift lands (scenes/world.js online.onCast, a mate\'s alone: cookItems.js takeFeastGift), so its rounds never add up; a dish\'s name is a feast\'s only for the party\'s dish', () => {
  assert.deepEqual([isPartyDishSpell('Feast of the Hearth'), isPartyDishSpell(dishOf('stew').name), isPartyDishSpell(dishOf('tart').name), isPartyDishSpell('Heal'), isPartyDishSpell(null)], [true, false, false, false, false]);
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  feedEffect(me, dishOf('feast'));
  assert.deepEqual([liveStat(me, 'strength'), liveBundles(me).length], [55, 1], 'my own feast');
  // the mate's share, as onCast lays it on
  const frame = validCastData(allyCastFrame(dishSpell(dishOf('feast'), HAND_CHEF), DISH_LEVEL, 'peer-0001'));
  const gift = allyCastSpell(frame.spell);
  assert.equal(takeFeastGift(me, gift, frame.level, true), true, 'a mate\'s longer feast lands');
  applySpell(gift, frame.level, me, {}, () => 0.5, null, { allyCast: true });
  assert.deepEqual([liveStat(me, 'strength'), liveStat(me, 'willpower'), liveBundles(me).length], [55, 55, 1], 'renewed, never stacked');
  assert.deepEqual([...new Set(me.activeEffects.map((a) => a.roundsRemaining))], [2159], 'the Chef\'s day and a half, not added to mine');
  // and a plain one eaten over the gift: the Chef's longer one stands (AUDIT PROF-541 K4)
  feedEffect(me, dishOf('feast'));
  assert.deepEqual([liveStat(me, 'strength'), liveBundles(me).length, [...new Set(me.activeEffects.map((a) => a.roundsRemaining))]], [55, 1, [2159]]);
  // any other spell passes untouched
  assert.equal(takeFeastGift(me, { name: 'Heal', effects: [] }, 30, false), true);
  // the arm: in online.onCast before the gift is laid on - never in the frame's own arms
  const w = src('src/scenes/world.js');
  assert.match(w, /online\.onCast = \(id, d\) => \{\n(?:[^\n]*\n){1,20}?      const spell = allyCastSpell\(d\?\.spell, \{ stranger: !mate \}\);\n      if \(!spell\) return;\n      if \(!takeFeastGift\(playerEntity, spell, d\.level, mate\)\) return;[^\n]*\n(?:[^\n]*\n){1,8}?      magic\.applySpellToPlayer\(spell, d\.level, null, \{ allyCast: true, strangerCast: !mate \}\);/);   // PIN MOVED (AUDIT PROF-541 K3/K4): cookItems.js takeFeastGift
  assert.equal(w.match(/takeFeastGift\(/g).length, 1, 'called once, there');
  const frameAt = w.indexOf('const onlineFrame = (now, dt) => {');
  assert.ok(frameAt > 0 && !w.slice(frameAt, w.indexOf('\n  };', frameAt)).includes('takeFeastGift'), 'not in onlineFrame');
});

// ─── AUDIT PROF-541 (2026-10-03) ─────────────────────────────────────

test('AUDIT PROF-541 K3: a feast is a party mate\'s gift alone - a stranger\'s "Feast of the Hearth" (the stranger\'s list lets Fortify Attribute through) is dropped before it lands, never stacked onto the standing feast (2,879 rounds)', () => {
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  const frame = validCastData(allyCastFrame(dishSpell(dishOf('feast'), null), DISH_LEVEL, 'peer-0002'));
  const mate = allyCastSpell(frame.spell);
  assert.equal(takeFeastGift(me, mate, frame.level, true), true);
  applySpell(mate, frame.level, me, {}, () => 0.5, null, { allyCast: true });
  const stranger = allyCastSpell(frame.spell, { stranger: true });
  assert.ok(stranger, 'the stranger\'s list would carry it');
  assert.equal(takeFeastGift(me, stranger, frame.level, false), false, 'a stranger\'s feast dropped');
  assert.deepEqual([liveStat(me, 'strength'), liveBundles(me).length, [...new Set(me.activeEffects.map((a) => a.roundsRemaining))]], [55, 1, [1439]], 'the party\'s day, as it was');
  // what it did before: laid on beside the ally's feast, its rounds added
  const was = { items: [], stats: { ...STATS }, activeEffects: [] };
  applySpell(mate, frame.level, was, {}, () => 0.5, null, { allyCast: true });
  applySpell(stranger, frame.level, was, {}, () => 0.5, null, { allyCast: true });
  assert.ok(was.activeEffects.some((a) => a.roundsRemaining > 2000), 'like-kind stacking (effects.js) - why it is dropped');
});

test('AUDIT PROF-541 K4: a dish renewed is never shortened - a standing bundle with as many rounds left keeps them, the incoming skipped (a Chef\'s feast is not cut by a plain one eaten or shared); a shorter one standing is renewed', () => {
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  feedEffect(me, dishOf('feast'), HAND_CHEF);
  const rounds = () => [...new Set(me.activeEffects.map((a) => a.roundsRemaining))];
  assert.deepEqual(rounds(), [2159]);
  assert.deepEqual(feedEffect(me, dishOf('feast')), [], 'a plain feast eaten: nothing laid on');
  assert.deepEqual([rounds(), liveBundles(me).length], [[2159], 1], 'the Chef\'s stands');
  const frame = validCastData(allyCastFrame(dishSpell(dishOf('feast'), null), DISH_LEVEL, 'peer-0003'));
  assert.equal(takeFeastGift(me, allyCastSpell(frame.spell), frame.level, true), false, 'a mate\'s plain feast skipped');
  assert.deepEqual(rounds(), [2159]);
  // run down below a plain feast's day: renewed by one
  for (const a of me.activeEffects) a.roundsRemaining = 1000;
  assert.equal(takeFeastGift(me, allyCastSpell(frame.spell), frame.level, true), true);
  assert.deepEqual(me.activeEffects, [], 'the standing feast taken off for the renewal');
  feedEffect(me, dishOf('stew'));
  for (const a of me.activeEffects) a.roundsRemaining = 120;
  assert.equal(renewDish(me, dishOf('stew').name, 120), false, 'as many left as the incoming: kept');
  assert.equal(renewDish(me, dishOf('stew').name, 121), true, 'fewer: renewed');
  assert.deepEqual(me.activeEffects, []);
});

test('AUDIT PROF-541 K5: a feast is shared with the party mates in sight at the table (peersNear - the stranger\'s gift\'s own law), never every party peer in the room and its halo cells; only those whose send went named', () => {
  // AUDIT PROF-541 R2-H1: the share's law (cookItems.js shareFeastWith), driven: the mates among the peers in sight, each
  // sent to, named where the send went ('a party member' where no name is known); a stranger in sight sent nothing
  const sent = [];
  const names = { 'peer-a': 'Ann', 'peer-c': null };
  const out = shareFeastWith([{ id: 'peer-a' }, { id: 'peer-b' }, { id: 'peer-c' }, { id: 'peer-d' }], {
    isMate: (id) => id !== 'peer-b', send: (id) => { sent.push(id); return id !== 'peer-d'; }, nameOf: (id) => names[id],
  });
  assert.deepEqual(sent, ['peer-a', 'peer-c', 'peer-d'], 'the mates alone, a stranger never');
  assert.deepEqual(out, ['Ann', 'a party member'], 'only those whose send went named');
  assert.deepEqual(shareFeastWith(null, { isMate: () => true, send: () => true, nameOf: () => 'x' }), [], 'no one in sight');
  // the host's wiring (world.js's boot closure - no test stands its online and party up, the repo's exception): the
  // peers it hands in are those in sight (peersNear), the send ALLY-CAST's frame at the dish's level
  const w = src('src/scenes/world.js');
  assert.match(w, /return shareFeastWith\(peersNear\(\), \{ isMate: \(id\) => social\.isPartyPeer\(id\), send: \(id\) => online\.sendCast\?\.\(allyCastFrame\(spell, DISH_LEVEL, id\)\), nameOf: \(id\) => peerName\(id\) \}\);/);
});

test('AUDIT PROF-541 K6: the Orchard Tart\'s stamina is the player\'s to end, as every other dish (BUFF-END: mysticism.js ENDABLE_KINDS)', () => {
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  feedEffect(me, dishOf('tart'));
  const [tart] = liveBundles(me);
  assert.equal(tart.entries[0].kind, DISH_STAMINA_KIND);
  assert.equal(canEndBundle(tart), true);
  assert.equal(endBundle(me, tart.bundleId), dishOf('tart').name);
  assert.deepEqual([me.activeEffects.length, dishStaminaFactor(me)], [0, 1], 'ended');
});

test('AUDIT PROF-541 K7: the fire\'s XP line says what the service pays - the town Apothecary\'s steps in it (recipeLaw cookXp\'s `steps`, the host\'s cookSteps), a plain line where there are none', () => {
  stubPages({ rank: 100, over: { cookSteps: () => 2 } });
  let page = pageOf();
  try {
    page.dish('Hunter\'s Stew (northern').onclick();
    assert.match(page.text(), /every pan taken off done is a clean pan, 350 Cooking XP to a plain dish's 280 - the town's Apothecary's 2 steps in both\./);
    page.done();
    stubPages({ rank: 100, over: { cookSteps: () => 1 } });
    page = pageOf();
    page.dish('Hunter\'s Stew (northern').onclick();
    assert.match(page.text(), /a clean pan, 280 Cooking XP to a plain dish's 210 - the town's Apothecary's step in both\./);
    page.done();
    stubPages({ rank: 100, over: { cookSteps: () => 0 } });
    page = pageOf();
    page.dish('Hunter\'s Stew (northern').onclick();
    assert.match(page.text(), /a clean pan, half again its 140 Cooking XP\./);
  } finally { page.done(); setProfessionsPages(null); }
  assert.match(src('src/scenes/world.js'), /cookSteps: \(\) => myHall\('cooking'\)\.steps,/);   // PIN MOVED (AUDIT PROF-541 R2-H1): the guard's law fortLaw.js hallStepsFor's, driven below
});

test('AUDIT PROF-541 K8: a Brew pressed while another craft holds the one-craft latch (profBook.js prof-busy) says the hands are busy, not that a brew is in the cauldron', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /r\?\.error === 'prof-busy' \? 'Your hands are busy with another craft\.' : accountRefusalText\(r\?\.error\)/);
  assert.doesNotMatch(w, /Your last brew is still in the cauldron/);
});

// ─── AUDIT PROF-541 ROUND 2 (2026-10-03) ─────────────────────────────

/** A spell named as the feast, its own effect: Fortify Strength 1 for 255 rounds a level (7,650 at the frame's 30). */
const LOOK_ALIKE = Object.freeze({ name: 'Feast of the Hearth', element: 4, rangeType: 1, icon: 3, effects: [{ type: 9, subType: 0, durationBase: 0, durationMod: 255, durationPerLevel: 1,
  chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] });
const feastRounds = (e) => liveBundles(e).filter((b) => b.name === 'Feast of the Hearth').map((b) => [...new Set(b.entries.map((a) => a.roundsRemaining))]);

test('AUDIT PROF-541 R2-K9: a feast\'s gift is a feast by its record (dishSpell - a plain one\'s or a Chef\'s), never its name - a mate\'s own "Feast of the Hearth" (Fortify Strength 1 for 7,650 rounds) is dropped, never laid over the real one to shut out every feast eaten after it (mutants: the gift by its name; the record by its name; no Chef\'s record; a look-alike gift\'s entries standing for the feast)', () => {
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  feedEffect(me, dishOf('feast'));
  const frame = validCastData({ to: 'peer-0004', level: 30, spell: LOOK_ALIKE });
  assert.ok(frame, 'the cast frame carries it');
  const gift = allyCastSpell(frame.spell);
  assert.equal(isPartyDishSpell(gift.name), true, 'its name the feast\'s');
  assert.equal(isFeastRecord(gift), false);
  assert.equal(takeFeastGift(me, gift, frame.level, true), false, 'a mate\'s look-alike dropped');
  assert.deepEqual([liveStat(me, 'strength'), feastRounds(me)], [55, [[1439]]], 'the real feast stands, as it was');
  // the real records, through the frame: a plain feast's and a Chef's
  for (const hand of [null, HAND_CHEF]) {
    const f = validCastData(allyCastFrame(dishSpell(dishOf('feast'), hand), DISH_LEVEL, 'peer-0004'));
    assert.equal(isFeastRecord(allyCastSpell(f.spell)), true, `hand ${hand}`);
  }
  // a magnitude off, a stat swapped, an effect short, or another name: no feast
  const real = dishSpell(dishOf('feast'));
  assert.equal(isFeastRecord({ ...real, effects: real.effects.map((e, i) => (i ? e : { ...e, magnitudeBaseHigh: 6 })) }), false);
  assert.equal(isFeastRecord({ ...real, effects: real.effects.map((e, i) => (i ? e : { ...e, subType: 7 })) }), false);
  assert.equal(isFeastRecord({ ...real, effects: real.effects.slice(1) }), false);
  assert.equal(isFeastRecord({ ...real, name: dishOf('stew').name }), false);
  // one laid on already (before this round's fix): its entries never stand for the feast - a Chef's feast eaten lands,
  // replacing the feast's own alone
  applySpell(gift, frame.level, me, {}, () => 0.5, null, { allyCast: true });
  assert.equal(feedEffect(me, dishOf('feast'), HAND_CHEF).length, 3, 'the Chef\'s feast eaten lands');
  assert.deepEqual(feastRounds(me).sort((a, b) => a[0] - b[0]), [[2159], [7649]]);
});

test('AUDIT PROF-541 R2-K9: a spell of my own spellbook named as a dish never stands for it - the feast eaten lands beside it, renews its own bundle and never mine; a look-alike of another kind neither (mutants: every bundle of the name the dish\'s; any kind)', () => {
  const me = { items: [], stats: { ...STATS }, activeEffects: [] };
  applySpell({ ...LOOK_ALIKE, rangeType: 0 }, 30, me, {}, () => 0.5, null, {});
  assert.deepEqual(feastRounds(me), [[7649]], 'my own spell, its 7,650 rounds (DFU\'s initial round run)');
  assert.equal(feedEffect(me, dishOf('feast')).length, 3, 'the feast eaten lands');
  assert.deepEqual([liveStat(me, 'strength'), feastRounds(me).sort((a, b) => a[0] - b[0])], [56, [[1439], [7649]]], 'beside my spell, untouched');
  // run down: renewed - the feast's own bundle replaced, my spell kept
  for (const a of me.activeEffects) if (a.settingsKey == null) a.roundsRemaining = 10;
  assert.equal(feedEffect(me, dishOf('feast')).length, 3);
  assert.deepEqual([liveBundles(me).length, feastRounds(me).sort((a, b) => a[0] - b[0])], [2, [[1439], [7649]]]);
  // a mate's real feast renews the feast's own too
  for (const a of me.activeEffects) if (a.settingsKey == null) a.roundsRemaining = 10;
  const frame = validCastData(allyCastFrame(dishSpell(dishOf('feast'), null), DISH_LEVEL, 'peer-0005'));
  assert.equal(takeFeastGift(me, allyCastSpell(frame.spell), frame.level, true), true);
  assert.deepEqual(feastRounds(me), [[7649]], 'the eaten feast taken off for the gift; my spell stands');
  // a look-alike of another kind (no settings): never the dish's
  const odd = { items: [], stats: { ...STATS }, activeEffects: [{ kind: 'shield', bundleId: 999_999, bundleName: 'Feast of the Hearth', roundsRemaining: 99_999 }] };
  assert.equal(feedEffect(odd, dishOf('feast')).length, 3);
  assert.equal(odd.activeEffects.filter((a) => a.kind === 'shield').length, 1);
});

test('AUDIT PROF-541 R2-K10: a dish eaten while a longer one of it stands says so ("The feast you already enjoy lasts longer.") - it is eaten and nothing is laid on; a feast still goes to the mates (mutants: nothing said; said always; the words)', () => {
  setPref('survival', false);
  try {
    const me = { items: [], stats: { ...STATS }, activeEffects: [] };
    const shared = [];
    setFeastShare((spell) => { shared.push(spell.name); return ['Ann']; });
    const chef = mintDish({ recipe: 'feast:hearth', hand: HAND_CHEF }, PROV);
    const plain = mintDish({ recipe: 'feast:hearth' }, PROV);
    me.items.push(chef, plain);
    assert.equal(dishUse(chef, me.items, { entity: me }).text, 'You eat the Feast of the Hearth. The feast is shared with Ann.');
    assert.equal(dishUse(plain, me.items, { entity: me }).text, 'You eat the Feast of the Hearth. The feast you already enjoy lasts longer. The feast is shared with Ann.');
    assert.deepEqual([me.items.length, shared.length, feastRounds(me)], [0, 2, [[2159]]], 'both eaten, both shared, the Chef\'s stands');
    // a dish other than a feast: its own name
    const stew = mintDish({ recipe: 'stew:north' }, PROV);
    me.items.push(stew);
    feedEffect(me, dishOf('stew'));
    for (const a of me.activeEffects) if (a.bundleName === dishOf('stew').name) a.roundsRemaining = 9_999;
    assert.equal(dishUse(stew, me.items, { entity: me }).text, 'You eat the Hunter\'s Stew. The Hunter\'s Stew you already enjoy lasts longer.');
    assert.equal(dishStandsLine(dishOf('tart')), `The ${dishOf('tart').name} you already enjoy lasts longer.`);
    // eaten with no one to lay it on: nothing more said
    const loose = mintDish({ recipe: 'stew:south' }, PROV);
    assert.equal(dishUse(loose, [loose], {}).text, 'You eat the Hunter\'s Stew.');
  } finally { setFeastShare(null); setPref('survival', 'casual'); }
});

test('AUDIT PROF-541 R2-H1: a station\'s steps where my guild holds the town, by one law for every profession (fortLaw.js hallStepsFor - the craft\'s seat, the alchemy station\'s line, the fire\'s): the works\' steps in it and the seat named, none for another guild\'s town, an unheld one, no guild of mine or no works (mutants: any guild; the seat named with no step; one profession for all)', () => {
  const seat = { key: 3021, holder: { guild: { id: 'g1' } }, forts: { apothecary: 2, forge: 1, workshop: 3, walls: 3 } };
  assert.deepEqual(['cooking', 'alchemy', 'jewelcrafting', 'smithing', 'carpentry', 'nonsense'].map((p) => hallStepsFor(seat, 'g1', p)),
    [{ steps: 2, seat: 3021 }, { steps: 2, seat: 3021 }, { steps: 2, seat: 3021 }, { steps: 1, seat: 3021 }, { steps: 3, seat: 3021 }, { steps: 0, seat: null }]);
  const none = { steps: 0, seat: null };
  assert.deepEqual(hallStepsFor(seat, 'g2', 'cooking'), none, 'another guild\'s town');
  assert.deepEqual(hallStepsFor({ ...seat, holder: null }, 'g1', 'cooking'), none, 'unheld');
  assert.deepEqual(hallStepsFor({ ...seat, holder: { guild: { id: null } } }, null, 'cooking'), none, 'no guild of mine');
  assert.deepEqual(hallStepsFor({ ...seat, forts: { walls: 3 } }, 'g1', 'cooking'), none, 'no works stepping it: no seat named');
  assert.deepEqual(hallStepsFor(null, 'g1', 'cooking'), none, 'no seat here');
  // the host's wiring (world.js's boot closure - no test stands its seat and guild books up, the repo's exception): every
  // station's guard is it, written once
  const w = src('src/scenes/world.js');
  assert.match(w, /const myHall = \(profession\) => hallStepsFor\(seatHere\(_musicLoc\?\.mapTableData\?\.mapId\), guildBook\?\.guild\?\.id \?\? null, profession\);\n\s+const alchemyHall = \(\) => myHall\('alchemy'\);/);
  assert.match(w, /const \{ seat \} = myHall\(recipeById\(recipe\)\?\.profession\);/);
  assert.match(w, /cookSteps: \(\) => myHall\('cooking'\)\.steps,/);
  assert.equal(w.match(/holder\?\.guild\?\.id === \(guildBook/g), null, 'no guard of its own left in world.js');
});
