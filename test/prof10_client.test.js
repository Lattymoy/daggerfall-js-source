// PROF10 (2026-10-02) - JEWELCRAFTING AS THE CLIENT MAKES IT: The Jeweller's Bench on the Stores page (a Pawn Shop's or a
// Gem Store's, 50 gold a piece; a home's jeweller's bench): DFU's eight pieces by piece and base, a gem a recipe, their
// inputs and ranks, the points each piece will carry, the odds; THE FACET (the stone turning toward the light, stopped in
// its window - every facet caught a clean act); Quick craft, Gentle acts, one act a page, Escape setting the stone down; a
// Wand's Heartwood and a Lapidary's Siege-cracked Gem; Jewelcrafting practised on the Professions page; the pieces as items
// (DFU's own jewellery, its quality, its name of its metal and gem, its enchantment points read by DFU's item maker); and
// the done-when, driven through the real Worker: A GOLD RUBY RING CUT WITH A CLEAN FACET AT A GEM STORE'S BENCH FROM THE
// STORES' GOLD AND RUBY, INTO THE PACK AS DFU'S OWN RING CARRYING GOLD'S AND THE GEM'S POINTS TO THE ITEM MAKER; A
// GEMCUTTER'S RING AT +30%, LISTED AND MINTED AGAIN FROM THE MARKET WITH ITS HAND; A LAPIDARY'S SIEGE-CRACKED GEM SET AS A
// DIAMOND. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md 3.3, 9.3, 9.4, 36.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, JEWEL_FEE, trackOf } from '../src/net/professionLaw.js';
import { recipeById, MASTERWORK, facetWindow, FACET_ACT, QUALITY_EFFECTS } from '../src/net/recipeLaw.js';
import { mintPiece, mintPieces, craftedText, asMinted, JEWEL_KEPT_TEXT, pieceOfRecipe, jewelItem } from '../src/systems/smithItems.js';
import { materialLabel } from '../src/systems/profItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { itemEnchantmentPower, craftedJewelPoints, applyEnchantments, craftedJewelRecipe, keptEnchantments, enchantDecision } from '../src/systems/enchanting.js';
import { enchantmentSettings } from '../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES } from '../src/systems/enchantments.js';
import { ItemMakerWindow, itemMakerFilter, ITEM_RECTS } from '../src/ui/itemMakerWindow.js';
import { validLootItem } from '../src/systems/loot.js';
import { rarityEligible, RARE_FLAVOURS } from '../src/systems/lootRarity.js';
import { PORT_SPECS } from '../src/ui/enhancedPorts.js';   // AUDIT PROF-541 J3: the Enhanced+ skin's item maker
import { enchantmentRowCost } from '../src/systems/enchanting.js';   // AUDIT PROF-541 J4
import { MAX_ENCHANTMENTS } from '../src/systems/enchanting.js';   // AUDIT PROF-541 R2-C5
import { pieceLines } from '../src/net/recipeLaw.js';   // AUDIT PROF-541 R2-C4
import { scrollerToolTipText } from '../src/ui/itemScroller.js';
import { itemPowerLines } from '../src/ui/enhancedInventory.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, setDownProfAct, profActUnderWay, _jewelForTests, _cookForTests,
  PROF_STATIONS, stationColdLine, JEWEL_COLD_LINE, FACET_DOWN_LINE, jewelRecipes, jewelPointsLine,
} from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const PROV = '0123456789abcdef';
const DF = 17;
const HUBS = { [DF]: [207, 212], 23: [590, 166] };
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw all `b` while `fn` runs. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}
// the act loops' capture listeners on the document, heard as a browser dispatches them (a stopImmediatePropagation ends it)
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
    recipe: (prefix) => [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-recipe') && b.textContent.startsWith(prefix)) ?? null,
    family: (word) => [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-family') && b.textContent === word) ?? null,
    box: (words) => [...root.querySelectorAll('label')].find((l) => l.textContent.includes(words))?.querySelector('input') ?? null,
    done() { root?.remove?.(); },
  };
}
/** The stone turned `off` degrees past the light (0: on it) and the turn stopped with the page's own button. */
function facet(page, off = 0) {
  const a = _jewelForTests().act;
  assert.ok(a, 'the facet under way');
  a.tick(Math.max(0.001, (a.state.light + off - a.bearing) / FACET_ACT.degPerS));
  page.button('Stop the turn').onclick();
}
/** A piece the facet asked, answered. */
async function settled() {
  for (let i = 0; i < 400 && _jewelForTests().crafting; i++) await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 4; i++) await tick();
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF10 DONE WHEN: a Gold Ruby Ring cut with a clean facet at a Gem Store\'s bench from the Stores\' Gold and Ruby (Jewelcrafting XP and the first time\'s 500), into the pack as DFU\'s own Ring carrying Gold\'s and the gem\'s points (2,160) to the item maker; a Gemcutter\'s ring at +30%, listed and minted again from the market with its hand; a Lapidary\'s Siege-cracked Gem set as a Diamond - through the real Worker', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  setPref('gentleActs', false);
  resetProfPages();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  // PIN MOVED (CRAFT3): a jewel raises and reads the Smithing track - the row seeded is 'smithing'
  const track = (xp, spec50 = null, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'smithing', ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`).run(mac.id, mac.character, xp, spec50, spec100, NOON);
  track(xpForRank(25));
  give('metal:gold', 1); give('gem:ruby', 1);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const player = { items: [], gold: 500 };
  const paid = [];
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: '' }), jeweller: () => ({ kind: 'shop', fee: JEWEL_FEE }), facetBand: () => 1, purse: () => player.gold,
    craft: async (recipe, opts) => {
      const r = await steered(0x80, () => book.craft(recipe, { ...opts, name: 'Silverthorn', fee: JEWEL_FEE }, (data, kept) => { for (const it of mintPieces(data)) player.items.push(it); paid.push(kept?.fee); }));
      return { ok: r.ok, text: r.ok ? `${craftedText(mintPieces(r.data))} (+${r.data.xp} Smithing XP).` : accountRefusalText(r.error) };   // PIN MOVED (CRAFT3): the world's words, professionName('jewelcrafting')
    },
  });
  const page = pageOf();
  try {
    assert.match(page.text(), /The Jeweller's Bench/);
    assert.match(page.text(), /The jeweller's bench - 50 gold a piece\. Smithing 25 \(Apprentice\)\./);   // PIN MOVED (CRAFT3): the bench says the craft's track
    page.family('Gold').onclick();
    page.recipe('Gold Ruby Ring').onclick();
    assert.match(page.text(), /Gold Ruby Ring - rank 25Gold 1 \/ 1 \(1 stored\)Ruby 1 \/ 1 \(1 stored\)/);
    assert.match(page.text(), /2,160 enchantment points \(\+20%\)\. The item maker spends them, beside a Masterwork's own enchantment\./);
    assert.match(page.text(), /Your rank 25, margin 0: Crude 20 \| Standard 60 \| Fine 20\. A clean facet is a step better; 60 Smithing XP\./);   // PIN MOVED (CRAFT3): a jewel's XP is Smithing's
    page.button('Craft').onclick();
    assert.equal(profActUnderWay(), true);
    assert.match(page.text(), /The facet \(Gold Ruby Ring\) - stop the turn where the stone catches the light \(Space\): 5 facets/);
    for (let i = 0; i < 5; i++) facet(page);
    await settled();
    assert.equal(profActUnderWay(), false);
    assert.equal(player.items.length, 1);
    const [ring] = player.items;
    assert.deepEqual([ring.group, ring.templateIndex, ring.name, ring.recipe, ring.maker, ring.quality, ring.enchantmentPoints], ['Jewellery', 135, 'Gold Ruby Ring', 'ring:gold:ruby', 'Silverthorn', 2, 2160], 'margin 0\'s middle (Standard) and a clean facet: Fine');
    assert.match(ring.provenance, /^[0-9a-f]{16}$/);
    assert.equal(itemEnchantmentPower(ring), 2160, 'the item maker reads the piece\'s own points');
    assert.equal(itemEnchantmentPower({ group: 'Jewellery', templateIndex: 135 }), 1800, 'a looted Ring its template\'s');
    assert.deepEqual([book.track('jewelcrafting').profession, book.track('jewelcrafting').xp, book.track('smithing').xp], ['smithing', xpForRank(25) + 60 + 500, xpForRank(25) + 60 + 500]);   // PIN MOVED (CRAFT3): the Ring credits the Smithing track, asked by either name
    assert.deepEqual([book.held('metal:gold'), book.held('gem:ruby'), paid], [0, 0, [JEWEL_FEE]], 'the fee kept with the craft and paid as it was minted');
    assert.match(page.text(), /You made a Fine Gold Ruby Ring \(\+560 Smithing XP\)\./);   // PIN MOVED (CRAFT3): the world's words
    // A GEMCUTTER'S: the gem +20%, the ring +30% - listed, and minted again from the market with its hand
    track(xpForRank(50), 'gemcutter');
    give('metal:gold', 1); give('gem:ruby', 1);
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.recipe('Gold Ruby Ring').onclick();
    assert.match(page.text(), /2,340 enchantment points \(\+30%\) - a Gemcutter's gem\./);
    page.button('Quick craft').onclick();
    await settled();
    const cut = player.items[1];
    assert.deepEqual([cut.enchantmentPoints, itemEnchantmentPower(cut)], [2340, 2340]);
    raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(mac.id, 100);
    const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: cut.provenance, wear: 1000, price: 25, hubs: HUBS, rid: 'jewel-list-01' }, mac.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    const crafted = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', family: 'jewellery', hubs: HUBS }, mac.secret);
    const piece = crafted.body.rows.find((x) => x.piece?.provenance === cut.provenance)?.piece;
    assert.equal(piece?.hand, 2);
    const again = mintPiece(piece, piece.provenance);
    assert.deepEqual([again.name, again.enchantmentPoints, again.quality, asMinted(again)], [cut.name, 2340, cut.quality, true], 'the market\'s piece is the jeweller\'s, its hand carried');
    // A LAPIDARY'S: a Siege-cracked Gem set as a Diamond
    track(xpForRank(100), 'gemcutter', 'lapidary');
    give('metal:platinum', 1); give('gem:siege', 1);
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.family('Platinum').onclick();
    assert.equal(page.recipe('Platinum Diamond Ring').textContent, 'Platinum Diamond Ringcan make now', 'a cracked gem in hand makes it');
    page.recipe('Platinum Diamond Ring').onclick();
    assert.match(page.text(), /Diamond 0 \/ 1 \(0 stored\)/);
    assert.equal(page.button('Quick craft').disabled, true, 'no Diamond, no cracked gem chosen');
    const box = page.box('Set a Siege-cracked Gem as the Diamond (1 stored)');
    box.checked = true; box.onchange();
    assert.match(page.text(), /Siege-cracked Gem 1 \/ 1 \(1 stored\)/);
    page.button('Quick craft').onclick();
    await settled();
    const lap = player.items[2];
    assert.deepEqual([lap?.recipe, lap?.quality, lap?.enchantmentPoints, book.held('gem:siege')], ['ring:platinum:diamond', 3, Math.floor(1800 * 1.4), 0], 'a Diamond Ring - margin 45\'s middle, Superior; its points Platinum\'s and the gem a Gemcutter\'s (the choice at 50 stands): +40%');
    assert.ok(lap.name.includes('Platinum Diamond Ring'), lap.name);
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── THE PAGE ────────────────────────────────────────────────────────

/** The Stores page over a stub book - the bench where `bench` says, Smithing (Jewelcrafting's track) at `rank` under `specs`. */
function stubPages({ bench = { kind: 'shop', fee: JEWEL_FEE }, rank = 0, specs = { 50: null, 100: null }, held: heldIn = {}, purse = 1000, over = {} } = {}) {
  resetProfPages();
  setPref('gentleActs', false);
  const held = new Map(Object.entries({ 'metal:silver': 9, 'gem:ruby': 9, ...heldIn }));
  // PIN MOVED (CRAFT3): the book's tracks are the crafts' - a discipline asked is its craft's (profBook.js track maps through trackOf)
  const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(rank), rank, specs }], ['provisioning', { profession: 'provisioning', xp: 0, rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,   // PIN MOVED (CRAFT3): as the book's
    choose: async () => ({ ok: true }),
  };
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), jeweller: () => bench, facetBand: () => 1, purse: () => purse,
    craft: async (r, o) => { calls.push(['craft', r, o.clean, o.heartwood === true, o.cracked === true]); return { ok: true, text: 'cut' }; },
    ...over,
  });
  return { book, calls, held, tracks };
}

test('PROF10 pages: The Jeweller\'s Bench - away, the word; at a Pawn Shop or a Gem Store its fee; the eight pieces and a piece\'s bases; the recipes with their ranks; every facet caught asks the piece clean, one lost not, one let go round not; Quick craft plain; Gentle acts plain; the purse short; a home\'s bench', async () => {
  let { calls } = stubPages({ bench: null });
  let page = pageOf();
  try {
    assert.deepEqual([...PROF_STATIONS], ['forge', 'workbench', 'loom', 'mason', 'jeweller']);
    assert.equal(stationColdLine('jeweller'), JEWEL_COLD_LINE);
    assert.match(JEWEL_COLD_LINE, /Jewelcrafting is done online, from your Stores page/);
    assert.match(page.text(), /The Jeweller's BenchJewelcrafting is done at a jeweller's bench: a Pawn Shop's or a Gem Store's \(50 gold a piece\), or your own home's\./);
    assert.equal(page.recipe('Silver Ring'), null, 'no piece offered away from a bench');
    page.done();
    ({ calls } = stubPages());
    page = pageOf();
    const benchFamilies = () => { const f = page.buttons().filter((b) => b.className.includes('prof-family')); return f.slice(f.findIndex((b) => b.textContent === 'Ring')); };
    assert.deepEqual(benchFamilies().map((b) => b.textContent), ['Ring', 'Mark', 'Bracelet', 'Bracer', 'Amulet', 'Torc', 'Cloth Amulet', 'Wand', 'Silver', 'Gold', 'Platinum']);
    assert.deepEqual(page.buttons().filter((b) => b.className.includes('prof-recipe')).map((b) => b.textContent).slice(0, 4),
      ['Silver Ringcan make now', 'Silver Ruby Ringcan make now', 'Silver Emerald Ringwants its inputs', 'Silver Sapphire Ringwants its inputs']);
    assert.equal(page.buttons().filter((b) => b.className.includes('prof-recipe')).length, 10, 'the plain Ring and a gem each');
    assert.deepEqual(jewelRecipes('ring', 'gold').map((r) => r.id).slice(0, 2), ['ring:gold', 'ring:gold:ruby']);
    page.family('Gold').onclick();
    assert.equal(page.recipe('Gold Ring').textContent, 'Gold Ringrank 25');
    page.family('Wand').onclick();
    assert.deepEqual(benchFamilies().slice(8).map((b) => b.textContent), ['Ironwood', 'Ghostwood']);
    assert.equal(page.recipe('Ironwood Ruby Wand').textContent, 'Ironwood Ruby Wandrank 70');
    page.family('Cloth Amulet').onclick();
    assert.equal(benchFamilies().length, 8, 'the Cloth Amulet\'s Linen, no row of its own');
    assert.equal(page.recipe('Ruby Cloth Amulet').textContent, 'Ruby Cloth Amuletwants its inputs');
    page.family('Ring').onclick();
    page.recipe('Silver Ruby Ring').onclick();
    assert.match(page.text(), /Silver Ruby Ring - rank 0metal:silver 1 \/ 1 \(9 stored\)gem:ruby 1 \/ 1 \(9 stored\)/);
    assert.match(page.text(), /1,980 enchantment points \(\+10%\)\. The item maker spends them, beside a Masterwork's own enchantment\./);
    // the facet: five caught, clean
    page.button('Craft').onclick();
    assert.deepEqual([page.recipe('Silver Ring').disabled, page.family('Gold').disabled, page.button('Quick craft')], [true, true, null], 'nothing else picked while the stone turns');
    assert.deepEqual([_jewelForTests().act.state.need, _jewelForTests().act.state.half], [5, facetWindow(0) / 2]);
    for (let i = 0; i < 5; i++) facet(page);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'ring:silver:ruby', true, false, false]);
    // one lost: not clean
    page.draw();
    page.button('Craft').onclick();
    facet(page); facet(page, 30); facet(page); facet(page); facet(page);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'ring:silver:ruby', false, false, false], 'a facet stopped in the dark: not clean');
    // one let go round twice - the loop's own frame ends the act
    page.draw();
    page.recipe('Silver Ring').onclick();
    page.button('Craft').onclick();
    assert.equal(_jewelForTests().act.state.need, 3, 'a plain piece\'s three');
    facet(page); facet(page);
    const a = _jewelForTests().act;
    a.tick((720 - a.state.turned) / FACET_ACT.degPerS + 0.01);
    assert.deepEqual([a.state.done, a.report().passed, a.report().clean], [true, 1, false]);
    for (let i = 0; i < 6 && _jewelForTests().act; i++) await new Promise((r) => setTimeout(r, 20));
    await tick();
    assert.deepEqual([_jewelForTests().act, calls.at(-1)], [null, ['craft', 'ring:silver', false, false, false]], 'the bench\'s own frame ends the act and asks the piece, not clean');
    // Quick craft: no facet, plain
    page.draw();
    page.button('Quick craft').onclick();
    await tick();
    assert.deepEqual([_jewelForTests().act, calls.at(-1)], [null, ['craft', 'ring:silver', false, false, false]]);
    // Gentle acts: Craft is plain, no facet
    setPref('gentleActs', true);
    page.draw();
    page.button('Craft').onclick();
    await tick();
    assert.deepEqual([_jewelForTests().act, calls.length], [null, 5]);
    setPref('gentleActs', false);
    page.done();
    // the purse short; a home's bench
    stubPages({ purse: 20 });
    page = pageOf();
    page.recipe('Silver Ring').onclick();
    assert.match(page.text(), /The jeweller asks 50 gold a piece; you carry 20\./);
    assert.equal(page.button('Craft').disabled, true);
    page.done();
    stubPages({ bench: { kind: 'home', fee: 0 }, purse: 0 });
    page = pageOf();
    assert.match(page.text(), /Your jeweller's bench\. Smithing 0 \(Novice\)\./);   // PIN MOVED (CRAFT3): the bench says the craft's track
    page.recipe('Silver Ring').onclick();
    assert.equal(page.button('Craft').disabled, false, 'a home\'s asks no fee');
  } finally { page.done(); setProfessionsPages(null); setPref('gentleActs', false); }
});

test('PROF10 pages: a Wand\'s Heartwood for a plank and a Lapidary\'s Siege-cracked Gem for its gem - offered where held, each carried to the craft as the facet began; the cracked gem a Lapidary\'s alone; the odds a Master Jeweller\'s', async () => {
  let { calls } = stubPages({ rank: 100, specs: { 50: null, 100: 'lapidary' }, held: { 'plank:ironwood': 1, 'wood:heartwood': 1, 'gem:siege': 2, 'gem:ruby': 0 } });
  let page = pageOf();
  try {
    page.family('Wand').onclick();
    page.recipe('Ironwood Ruby Wand').onclick();
    assert.match(page.text(), /plank:ironwood 1 \/ 2 \(1 stored\)gem:ruby 0 \/ 1 \(0 stored\)/);
    assert.equal(page.button('Craft').disabled, true);
    const wood = page.box('Use a Heartwood for a plank');
    wood.checked = true; wood.onchange();
    const crack = page.box('Set a Siege-cracked Gem as the Ruby (2 stored)');
    crack.checked = true; crack.onchange();
    assert.match(page.text(), /plank:ironwood 1 \/ 1 \(1 stored\)gem:siege 1 \/ 1 \(2 stored\)wood:heartwood 1 \/ 1 \(1 stored\)/);
    assert.match(page.text(), /Your rank 100, margin 30: Standard 20 \| Fine 50 \| Superior 28 \| Masterwork 2\./, 'a Lapidary\'s odds: no Masterwork points');
    page.button('Craft').onclick();
    assert.deepEqual([page.box('Use a Heartwood for a plank').disabled, page.box('Set a Siege-cracked Gem').disabled], [true, true], 'held as the facet began');
    assert.equal(_jewelForTests().act.state.half, facetWindow(100) / 2, 'a Master\'s window, 15 degrees');
    for (let i = 0; i < 5; i++) facet(page);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'wand:ironwood:ruby', true, true, true]);
    page.done();
    // a Master Jeweller: no cracked gem offered, the odds his
    ({ calls } = stubPages({ rank: 100, specs: { 50: null, 100: 'master-jeweller' }, held: { 'gem:siege': 2 } }));
    page = pageOf();
    page.family('Ring').onclick();
    page.recipe('Silver Emerald Ring').onclick();
    assert.equal(page.box('Set a Siege-cracked Gem'), null);
    assert.equal(page.recipe('Silver Emerald Ring').textContent, 'Silver Emerald Ringwants its inputs');
    page.recipe('Silver Ruby Ring').onclick();
    assert.match(page.text(), /Your rank 100, margin 100: Fine 35 \| Superior 52 \| Masterwork 13\./);
    page.button('Quick craft').onclick();
    await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'ring:silver:ruby', false, false, false]);
  } finally { page.done(); setProfessionsPages(null); }
});

test('PROF10 pages: the facet\'s keys - Space stops the turn (a held key\'s repeat nothing); Escape sets the stone down (nothing spent, said); the page shut under it lets it go; one act a page - the fire\'s pan holds the bench, and the bench the pan', async () => {
  const { calls } = stubPages({ held: { 'food:meat': 9, 'food:mushroom': 9, 'p1:13': 9 }, over: { fire: () => ({ kind: 'fire', fee: 0 }), panBand: () => 1, skillet: () => false } });
  const page = pageOf();
  try {
    page.family('Ring').onclick();
    page.recipe('Silver Ring').onclick();
    page.button('Craft').onclick();
    for (let i = 0; i < 3; i++) {
      const a = _jewelForTests().act;
      a.tick((a.state.light - a.bearing) / FACET_ACT.degPerS);
      key({ repeat: true });
      assert.equal(a.state.cuts.length, i, 'a repeat stops nothing');
      key({});
    }
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'ring:silver', true, false, false], 'Space stopped each turn in the light');
    // Escape
    page.draw();
    page.button('Craft').onclick();
    assert.equal(setDownProfAct(), true);
    page.draw();
    assert.ok(page.text().includes(FACET_DOWN_LINE), 'Escape sets the stone down, nothing spent, said');
    assert.equal(calls.length, 1);
    // one act a page
    page.recipe('Hunter\'s Stew').onclick();   // PIN MOVED (CRAFT2): the fire lists each dish once
    page.button('Craft').onclick();
    page.draw();
    assert.equal(page.button('Cook').disabled, true, 'the facet holds the fire');
    assert.match(page.text(), /Your hands are at the jeweller's bench - finish there first\./);
    setDownProfAct();
    page.draw();
    page.button('Cook').onclick();
    page.draw();
    assert.equal(page.button('Craft').disabled, true, 'the pan holds the bench');
    assert.match(page.text(), /Your hands are at the fire - finish there first\./);
    assert.ok(_cookForTests().act);
    setDownProfAct();
    // the page shut under the facet: let go, nothing asked
    page.draw();
    page.button('Craft').onclick();
    const n = calls.length;
    page.done();
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual([_jewelForTests().act, calls.length], [null, n]);
  } finally { page.done(); setProfessionsPages(null); }
});

test('PROF10 pages: Jewelcrafting practised on the Professions page - its four cards chosen at their ranks, its unlocks by the jeweller\'s ladder (Silver and the Cloth Amulet at 0, Gold at 25, Platinum at 55, the Wand at 70)', () => {
  stubPages({ rank: 55, specs: { 50: 'goldsmith', 100: null } });
  const page = pageOf(drawProfessionsPage);
  try {
    // PIN MOVED (CRAFT3): Jewelcrafting is practised on the Smithing track - the five crafts listed, no Jewelcrafting row
    const rows = page.buttons().filter((b) => b.className.includes('prof-row')).map((b) => b.querySelector('.prof-name').textContent);
    assert.deepEqual(rows, ['Mining', 'Logging', 'Herbalism', 'Hunting', 'Fishing', 'Smithing', 'Building', 'Outfitting', 'Provisioning', 'Enchanting']);
    page.buttons().find((b) => b.textContent.startsWith('Smithing')).onclick();
    page.draw();
    assert.doesNotMatch(page.text(), /not practised in the Bay yet/);
    const cards = page.buttons().filter((b) => b.className.includes('prof-spec'));
    // PIN MOVED (CRAFT3): the track's four a rank, each named its discipline's - Jewelcrafting's four among the smith's
    assert.deepEqual(cards.map((c) => [c.querySelector('b').textContent, c.querySelector('.prof-of')?.textContent, c.disabled]),
      [['Weaponsmith', 'Smithing', false], ['Armoursmith', 'Smithing', false], ['Gemcutter', 'Jewelcrafting', false], ['Goldsmith', 'Jewelcrafting', true],
        ['Masterwright', 'Smithing', true], ['Quartermaster', 'Smithing', true], ['Master Jeweller', 'Jewelcrafting', true], ['Lapidary', 'Jewelcrafting', true]],
      'the Gemcutter offered (a change, as the smith\'s two), the Goldsmith chosen, the four at 100 shut below it');
    // PIN MOVED (CRAFT3): the jeweller's ladder among the smith's, each line its discipline's, by the rank it opens at
    const unlocks = [...page.root().querySelectorAll('.px-stat')].map((r) => [r.querySelector('.k').textContent, r.querySelector('.v').textContent, r.className.includes('prof-locked')]);
    assert.deepEqual(unlocks.filter(([k]) => k.startsWith('Jewelcrafting: ')), [
      ['Jewelcrafting: Silver pieces; the Cloth Amulet', 'rank 0', false], ['Jewelcrafting: Gold pieces', 'rank 25', false],
      ['Jewelcrafting: Platinum pieces', 'rank 55', false], ['Jewelcrafting: The Wand, in Ironwood or Ghostwood', 'rank 70', true],
    ]);
    assert.deepEqual(unlocks.map(([k, v]) => `${k.split(':')[0]} ${v}`), ['Smithing rank 0', 'Jewelcrafting rank 0', 'Smithing rank 10', 'Smithing rank 25', 'Jewelcrafting rank 25', 'Smithing rank 40',
      'Smithing rank 55', 'Jewelcrafting rank 55', 'Smithing rank 70', 'Jewelcrafting rank 70', 'Smithing rank 90'], 'the two ladders in one, by tier, the smith\'s first where they share one');
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── THE ITEMS ───────────────────────────────────────────────────────

test('PROF10 items: a piece is DFU\'s own jewellery - its template and group, its quality on its condition and weight, a Superior\'s Magic roll and a Masterwork\'s Rare one keeping its metal\'s and gem\'s name, a Masterwork\'s mark before it; its points the item maker reads (a loot piece\'s and a sword\'s untouched); its worth the template\'s by its share and its gem\'s; what a craft says', () => {
  const ring = templateByIndex(135);
  const plain = mintPiece({ recipe: 'ring:silver', quality: 1, seed: 3, maker: 'Silverthorn' }, PROV);
  assert.deepEqual([plain.group, plain.templateIndex, plain.material, plain.name, plain.quality, plain.recipe, plain.maker, plain.enchantmentPoints, plain.value, plain.maxCondition, plain.rarity],
    ['Jewellery', 135, 0, 'Silver Ring', 1, 'ring:silver', 'Silverthorn', 1800, ring.basePrice, ring.hitPoints, undefined]);
  assert.equal(itemLongName(plain), 'Silver Ring');
  assert.equal(craftedText([plain]), 'You made a Standard Silver Ring');
  const gold = mintPiece({ recipe: 'ring:gold:ruby', quality: 0, seed: 3 }, PROV);
  assert.deepEqual([gold.enchantmentPoints, gold.value, gold.maxCondition], [2160, Math.round(ring.basePrice * 1.2) + templateByIndex(0).basePrice, Math.round(ring.hitPoints * QUALITY_EFFECTS[0].condition)], 'Gold\'s and the gem\'s +20%; a Ruby\'s 250 carried; Crude\'s condition');
  const superior = mintPiece({ recipe: 'amulet:gold:pearl', quality: 3, seed: 7 }, PROV);
  assert.equal(rarityEligible(jewelItem(recipeById('amulet:gold:pearl'))), true, 'DFU\'s jewellery takes Loot Rarity\'s roll');
  assert.equal(superior.rarity, 'magic');
  assert.ok(superior.name.includes('Gold Pearl Amulet') && superior.name !== 'Gold Pearl Amulet', `a Magic roll's words about the piece's own name: ${superior.name}`);
  assert.equal(asMinted(superior), true);
  const mw = mintPiece({ recipe: 'torc:platinum', quality: MASTERWORK, seed: 7, maker: 'Silverthorn' }, PROV);
  assert.deepEqual([mw.rarity, mw.name, itemLongName(mw), mw.enchantmentPoints], ['rare', 'Platinum Torc', 'Silverthorn\'s Platinum Torc', Math.floor(templateByIndex(138).enchantmentPoints * 1.2)]);
  assert.equal(craftedText([mw]), 'You made Silverthorn\'s Platinum Torc');
  assert.equal(asMinted(mw), true);
  // the hand the record carries
  assert.deepEqual([mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1, hand: 1 }, PROV).enchantmentPoints, mintPiece({ recipe: 'mark:gold:jade', quality: 1, seed: 1, hand: 2 }, PROV).enchantmentPoints],
    [1980, Math.floor(templateByIndex(137).enchantmentPoints * 1.3)], 'a Goldsmith\'s Silver Gold\'s; a Gemcutter\'s gem +20%');
  // the item maker: the piece's own points; a looted piece and a crafted sword their template's
  assert.deepEqual([craftedJewelPoints(gold), craftedJewelPoints({ ...gold, provenance: 'nope' }), craftedJewelPoints({ ...gold, group: 'Weapons' }), craftedJewelPoints({ ...gold, enchantmentPoints: -1 })], [2160, null, null, null]);
  const ls = templateByIndex(120).enchantmentPoints;
  assert.equal(itemEnchantmentPower(mintPiece({ recipe: 'longsword:iron', quality: 1, seed: 1 }, PROV)), ls + Math.floor(ls * -0.25), 'a crafted sword: its template\'s and its metal\'s');
  // enchanted at the item maker since: no longer as minted, it lists nowhere
  const enchanted = mintPiece({ recipe: 'ring:gold:ruby', quality: 1, seed: 3 }, PROV);
  applyEnchantments(enchanted, [{ type: 1, param: 0 }]);
  assert.equal(asMinted(enchanted), false);
  assert.deepEqual([pieceOfRecipe(gold, 'ring:gold:ruby'), pieceOfRecipe(gold, 'ring:gold:emerald')], [true, false], 'a commission\'s piece is its recipe\'s');
  const wand = mintPiece({ recipe: 'wand:ghostwood:diamond', quality: 2, seed: 3 }, PROV);
  assert.deepEqual([wand.templateIndex, wand.name, wand.enchantmentPoints], [140, 'Ghostwood Diamond Wand', 1320]);
  assert.match(JEWEL_KEPT_TEXT, /The last facet caught the light, but no word came back/);
  assert.equal(jewelPointsLine(recipeById('ring:silver')), '1,800 enchantment points');
});

// ─── THE BOOK AND THE DOOR ───────────────────────────────────────────

test('PROF10 book: a piece carries a Lapidary\'s cracked gem to the door - `cracked` only when true; a lost answer asked again is the same piece, its gem with it; the door sends `cracked` only when true', async () => {
  const asked = [];
  const door = {
    account: () => 'acct-1',
    craft: async (c, r, clean, name, rid, heartwood, dye, seat, cracked) => {
      asked.push([r, rid, cracked]);
      return asked.length === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { recipe: r, quality: 2, count: 1, seed: 1, xp: 20, first: false, hand: null, pieces: [{ provenance: PROV, record: null }], track: null, stores: [] } };
    },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => 0, sleep: noWait });
  const minted = [];
  const r = await book.craft('ring:gold:diamond', { clean: true, cracked: true }, (data) => minted.push(...mintPieces(data)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(asked.map(([rec, , c]) => [rec, c]), [['ring:gold:diamond', true], ['ring:gold:diamond', true]], 'asked again by the book\'s own retry, the gem with it');
  assert.equal(asked[0][1], asked[1][1], 'the same id');
  assert.equal(minted[0]?.name, 'Gold Diamond Ring');
  await book.craft('ring:gold:diamond', { clean: true }, () => {});
  assert.equal(asked.at(-1)[2], false);
  assert.match(src('src/net/accountClient.js'), /craft: \(character, recipe, clean, name, rid, heartwood = false, dye = null, seat = null, cracked = false\) => post\('\/v1\/prof\/craft', \{ character, recipe, clean, name, rid, heartwood, \.\.\.\(dye == null \? \{\} : \{ dye \}\), \.\.\.\(seat == null \? \{\} : \{ seat \}\), \.\.\.\(cracked === true \? \{ cracked: true \} : \{\}\) \}\),/);
  assert.doesNotMatch(accountRefusalText('prof-lapidary'), /problem|could not be read/);
  assert.match(accountRefusalText('prof-lapidary'), /Only a Lapidary/);
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF10 wiring: the jeweller\'s bench a Pawn Shop\'s or a Gem Store\'s (open for trade) or a home\'s station; the world crafts a piece there by Jewelcrafting\'s station, the facet\'s band off WIL and LUC, a Lapidary\'s gem through the book; the service\'s route reads it, refuses it to all but a Lapidary and answers a piece\'s hand; the pages draw the bench beside the fire; the bench sold where it works', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(t === BUILDING_TYPES\.PawnShop \|\| t === BUILDING_TYPES\.GemStore\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: JEWEL_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'jeweller'\)\) return \{ kind: 'home', fee: 0 \};/);
  assert.match(m, /if \(hallMemberHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'jeweller'\)\) return \{ kind: 'home', fee: 0 \};/);
  const w = src('src/scenes/world.js');
  assert.match(w, /: profession === 'jewelcrafting'[^\n]*\n\s*\? \{ here: \(\) => modes\?\.jewellerHere\?\.\(\) \?\? null, a: 'a jeweller\\'s bench', who: 'jeweller', noun: 'jeweller\\'s bench', kept: JEWEL_KEPT_TEXT, xp: professionName\('jewelcrafting'\) \}/);   // PIN MOVED (AUDIT PROF-541 R2-C2): no station's own busy word; PIN MOVED (CRAFT3): the XP word the craft's track's
  assert.match(w, /jeweller: \(\) => modes\?\.jewellerHere\?\.\(\) \?\? null,/);
  assert.match(w, /facetBand: \(\) => facetBand\(\{ willpower: liveStat\(playerEntity, 'willpower'\), luck: liveStat\(playerEntity, 'luck'\) \}\),/);
  assert.match(w, /craft: async \(recipe, \{ clean, heartwood = false, dye = null, cracked = false \}\) => \{/);
  assert.match(w, /const r = await profBook\.craft\(recipe, \{ clean, heartwood, dye, cracked, fee: /);
  const b = src('src/net/profBook.js');
  assert.match(b, /\.\.\.\(cracked === true \? \{ cracked: true \} : \{\}\) \};/);
  assert.match(b, /Number\.isSafeInteger\(w\.seat\) \? w\.seat : null, w\.cracked === true\)\), key\);/);   // PIN MOVED (PROF12): a brew kept as a craft is asks its own door first
  const svc = src('server-account/src/professions.js');
  assert.match(svc, /export async function craftAtAnvil\(ctx, player, env, \{ character, recipe: id, clean, name, heartwood = false, dye = null, rid, seat = null, cracked = false \} = \{\}\)/);
  assert.match(svc, /if \(crack && !\(takesCracked\(r\) && specs\[100\] === LAPIDARY\)\) return \{ error: 'prof-lapidary' \};/);
  assert.match(svc, /const hand = dishHand\(r, specs\[100\]\) \?\? jewelHand\(r, specs\[50\]\);/);
  assert.match(svc, /qualityOdds\(rank - r\.rank, \{ masterwright: masterworkSpec\(specs\[100\], r\) \}\)/);   // PIN MOVED (CRAFT3): the Master Jeweller's points asked of the recipe (a jewel's alone)
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'prof-lapidary': 403,/);
  assert.match(idx, /POST \/v1\/prof\/craft \{ character, recipe, clean, name\?, heartwood\?, dye\?, cracked\?, rid \}/);
  const p = src('src/ui/profPages.js');
  assert.match(p, /drawCookFire\(detail, rerender, kit\);   \/\/ PROF9\n\s*drawJewellerBench\(detail, rerender, kit\);   \/\/ PROF10/);
  assert.match(src('src/ui/enhancedPlusStyle.js'), /\.prof-heatbar\.prof-facetbar \{/);
  assert.match(src('src/scenes/decorTool.js'), /if \(PROF_STATIONS\.includes\(want\) && !forgeOffered\(\)\) \{ deps\.say\?\.\(stationColdLine\(want\)\); return false; \}/, 'the jeweller\'s bench sold where the bench works, as the forge');
  assert.match(src('src/systems/enchanting.js'), /const basePower = craftedJewelPoints\(item\) \?\? templateByIndex\(item\.templateIndex\)\?\.enchantmentPoints \?\? 0;/);
});

// ─── AUDIT PROF10 (2026-10-03): THE ITEM MAKER'S BUDGET ──────────────

test('AUDIT PROF10 J1: a crafted piece\'s own points only where its record is a jeweller\'s of its very template, and never past what that recipe mints in its own hand (AUDIT PROF-541 J6: the hand kept on the piece) - a ring forged over the wire with two billion carries a plain Silver Ring\'s 1,800 (a Goldsmith\'s 1,980); an honest Goldsmith\'s and Gemcutter\'s their own; one under its most its own', () => {
  const forged = { ...mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1 }, PROV), enchantmentPoints: 2_000_000_000 };
  const wire = validLootItem(JSON.parse(JSON.stringify(forged)));
  assert.equal(wire.enchantmentPoints, 2_000_000_000, 'the wire carries the field as it came');
  assert.deepEqual([wire.hand, craftedJewelPoints(wire), itemEnchantmentPower(wire)], [undefined, 1800, 1800], 'a Silver Ring of no hand: its template\'s, Silver\'s +0%');
  const smithWire = validLootItem(JSON.parse(JSON.stringify({ ...mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1, hand: 1 }, PROV), enchantmentPoints: 2_000_000_000 })));
  assert.deepEqual([smithWire.hand, craftedJewelPoints(smithWire)], [1, 1980], 'a Goldsmith\'s: Gold\'s +10%, its hand carried');
  assert.equal(validLootItem(JSON.parse(JSON.stringify({ ...forged, hand: 7 }))), null, 'a hand out of its bounds: the record refused (itemFields.js)');
  assert.deepEqual([mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1, hand: 2 }, PROV).hand, mintPiece({ recipe: 'ring:gold', quality: 1, seed: 1, hand: 1 }, PROV).hand], [undefined, undefined], 'a hand its recipe does not take is never kept');
  assert.deepEqual([craftedJewelRecipe(wire)?.id, craftedJewelRecipe({ ...wire, recipe: undefined }), craftedJewelRecipe({ ...wire, recipe: 'longsword:iron' }), craftedJewelRecipe({ ...wire, recipe: 'mark:gold:jade' }), craftedJewelRecipe({ ...wire, recipe: 'ring:nope' })],
    ['ring:silver', null, null, null, null], 'a jeweller\'s record of its own template, or none');
  assert.equal(itemEnchantmentPower({ ...wire, recipe: undefined }), 1800, 'no record: its template\'s, as any ring');
  assert.equal(itemEnchantmentPower({ ...wire, recipe: 'mark:platinum:diamond' }), 1800, 'another template\'s record: its template\'s');
  const goldsmith = mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1, hand: 1 }, PROV);
  const gemcutter = mintPiece({ recipe: 'mark:gold:jade', quality: 1, seed: 1, hand: 2 }, PROV);
  assert.deepEqual([craftedJewelPoints(goldsmith), craftedJewelPoints(gemcutter)], [1980, Math.floor(templateByIndex(137).enchantmentPoints * 1.3)], 'each hand\'s own most');
  assert.equal(craftedJewelPoints({ ...gemcutter, enchantmentPoints: 1_000_000 }), Math.floor(templateByIndex(137).enchantmentPoints * 1.3), 'a forged Mark: a Gemcutter\'s at most');
  assert.equal(craftedJewelPoints({ ...goldsmith, enchantmentPoints: 1000 }), 1000, 'under its most: its own');
  assert.equal(craftedJewelPoints({ ...goldsmith, enchantmentPoints: 0 }), 0);
});

test('AUDIT PROF10 J2 (DECIDED, Mac: "Item maker can add to it"): DFU\'s item maker takes a crafted piece with its Masterwork\'s Rare roll - its row kept, costed against the points, shown at the list\'s head in the forced colour, never removed, counted in the guard; enchanted, the new rows land after it; every other enchanted item refused as DFU refuses it', () => {
  const mw = mintPiece({ recipe: 'mark:platinum:diamond', quality: MASTERWORK, seed: 1, maker: 'X' }, PROV);
  assert.deepEqual(mw.enchantments, [{ type: ENCHANTMENT_TYPES.CastWhenHeld, param: 45 }], 'a Rare roll: Shadow Form when held');
  assert.equal(itemEnchantmentPower(mw), 1040);
  assert.deepEqual(keptEnchantments(mw).map((e) => [e.type, e.param, e.enchantCost, e.parentEnchantment, e.kept]), [['CastWhenHeld', 45, 150, 0, true]]);
  assert.deepEqual([keptEnchantments(mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1 }, PROV)), keptEnchantments({ ...jewelItem(recipeById('ring:silver')), enchantments: [{ type: 1, param: 45 }] }), keptEnchantments({ ...mw, enchantments: [{ type: 1, param: 9999 }] }), keptEnchantments({ ...mw, provenance: undefined })],
    [[], null, null, null], 'none; a looted ring\'s; an uncostable row; no provenance');
  assert.deepEqual([itemMakerFilter(mw, 'ClothingAndMisc'), itemMakerFilter({ ...jewelItem(recipeById('ring:silver')), enchantments: [{ type: 1, param: 45 }] }, 'ClothingAndMisc'), itemMakerFilter({ ...mw, recipe: 'ring:silver' }, 'ClothingAndMisc'), itemMakerFilter({ ...mw, enchantments: [{ type: 1, param: 9999 }] }, 'ClothingAndMisc')],
    [true, false, false, false], 'the crafted piece taken; every other enchanted item refused');
  // the decision: the kept row's 150 against the 1,040, its gold none
  const talent = enchantmentSettings('ImprovesTalents', 0);
  const ok = enchantDecision(mw, [talent], [], { gold: 10 ** 9 });
  assert.deepEqual([ok.kind, ok.cost, ok.power, ok.goldCost], ['enchant', 650, 1040, 5000]);
  assert.deepEqual([enchantDecision(mw, [enchantmentSettings('CastWhenHeld', 39)], [], { gold: 10 ** 9 }).kind, enchantDecision(mw, [enchantmentSettings('CastWhenHeld', 39)], [], { gold: 10 ** 9 }).cost], ['overLimit', 1380]);
  assert.equal(enchantDecision(mw, [], [], { gold: 10 ** 9 }).kind, 'noEnchantments', 'nothing new prepared');
  // a bound soul's forced row the piece keeps is forced still: no points (GetTotalEnchantmentCost's walk)
  const souled = { ...mw, enchantments: [...mw.enchantments, { type: ENCHANTMENT_TYPES.PotentVs, param: 1, parentEnchantment: 'SoulBound:20' }] };
  assert.deepEqual(keptEnchantments(souled).map((e) => [e.type, e.parentEnchantment]), [['CastWhenHeld', 0], ['PotentVs', 'SoulBound:20']]);
  assert.equal(enchantDecision(souled, [talent], [], { gold: 10 ** 9 }).cost, 650);
  // the window
  const player = { goldPieces: 100_000, items: [mw] };
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'ClothingAndMisc';
  assert.deepEqual(w.items(), [mw]);
  w._selectItem(mw);
  assert.deepEqual([w.labels().enchantmentCost, w.labels().goldCost, w.powers.length], ['150/1040', '0', 0]);
  assert.deepEqual(w._lists().powers.map((e) => [e.type, e.kept]), [['CastWhenHeld', true]]);
  w.powers = [talent];
  assert.deepEqual([w.labels().enchantmentCost, w.labels().goldCost], ['650/1040', '5000']);
  // the kept row is not the player's to take off; their own is
  const [px, py] = ITEM_RECTS.powersList;
  w.click(px + 2, py + 4);
  assert.deepEqual(w.powers, [talent], 'the kept row stays');
  w.click(px + 2, py + 21);
  assert.deepEqual(w.powers, [], 'the player\'s own row removed');
  const twin = enchantmentSettings('CastWhenHeld', 45);
  w.powers = [twin];
  w.click(px + 2, py + 4);
  assert.deepEqual(w.powers, [twin], 'a click on the kept row takes off nothing - not even the player\'s own row of its key');
  w.click(px + 2, py + 21);
  assert.deepEqual(w.powers, []);
  // the guard counts the kept row: nine of the player's and the piece's one are ten
  w.powers = Array.from({ length: 9 }, (_, i) => enchantmentSettings('EnhancesSkill', i));
  w._openPicker(true);
  assert.deepEqual(w.box?.rows?.[0]?.text, 'You cannot enchant this item with any more powers.');
  w.box = null;
  w.powers = [talent];
  w._enchant();
  assert.deepEqual(mw.enchantments.map((e) => [e.type, e.param]), [[ENCHANTMENT_TYPES.CastWhenHeld, 45], [ENCHANTMENT_TYPES.ImprovesTalents, 0]], 'the Rare roll kept, the new row after it');
  assert.equal(player.goldPieces, 95_000);
  assert.equal(asMinted(mw), false, 'enchanted since: no longer as minted');
  // back again: both rows kept, costed
  assert.equal(itemMakerFilter(mw, 'ClothingAndMisc'), true);
  w._selectItem(mw);
  assert.equal(w.labels().enchantmentCost, '650/1040');
  // a plain piece enchanted at the maker as DFU does: its rows its own
  const plain = mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1 }, PROV);
  applyEnchantments(plain, [talent]);
  assert.deepEqual(plain.enchantments.map((e) => [e.type, e.param]), [[ENCHANTMENT_TYPES.ImprovesTalents, 0]]);
  assert.match(src('src/ui/itemMakerWindow.js'), /if \(!keptEnchantments\(item\) \|\| item\.group === 'UselessItems2'\) return false;/);
});

// ─── AUDIT PROF-541 (2026-10-03) ─────────────────────────────────────

test('AUDIT PROF-541 J3: the Enhanced+ item maker draws the lists as the classic window does - a crafted piece\'s kept rows at their head, muted, with no act (never removed, as a forced row is), the player\'s own after them removable; the probe seam clicks the rows as drawn', () => {
  const mw = mintPiece({ recipe: 'mark:platinum:diamond', quality: MASTERWORK, seed: 1, maker: 'X' }, PROV);
  const player = { goldPieces: 100_000, items: [mw] };
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'ClothingAndMisc';
  w._selectItem(mw);
  const talent = enchantmentSettings('ImprovesTalents', 0);
  w.powers = [talent];
  const rowsOf = (v) => {
    const found = [];
    const walk = (b) => { if (!b || typeof b !== 'object') return; if (b.type === 'rows') found.push(b); for (const k of ['blocks', 'cols']) for (const x of (b[k] ?? []).flat()) walk(x); };
    walk({ blocks: v.blocks });
    return Object.fromEntries(found.map((b) => [b.key, b.items]));
  };
  const rows = rowsOf(PORT_SPECS.itemMaker.view(w));
  assert.deepEqual(rows.pow.map((r) => [r.label, r.muted, r.act === null]), [['Cast When Held', true, true], ['Improves Talents', false, false]], 'the kept row first, muted, no act; the player\'s own after it');
  assert.equal(rows.pow[0].hint, 'The piece\'s own');
  assert.deepEqual(rows.side, []);
  rows.pow[1].act();
  assert.deepEqual([w.powers, keptEnchantments(mw).length], [[], 1], 'the player\'s own row removed; the piece\'s stays');
  assert.match(src('src/scenes/worldModes.js'), /const row = itemMakerRowLayout\(w\._lists\(\)\[which === 'powers' \? 'powers' : 'sideEffects'\]\)/);
});

test('AUDIT PROF-541 J4: a Masterwork jewel\'s Rare roll is one its points hold - a first draw over them drawn again among those that fit (every draw that fit stands as its seed made it); a Cloth Amulet\'s 660 never carries Tongues\' 1,590; still the seed\'s', () => {
  const costs = RARE_FLAVOURS.Jewellery.map((f) => enchantmentRowCost(f));
  assert.ok(costs.some((c) => c > 1040) && costs.every((c) => Number.isSafeInteger(c)), 'the group holds flavours past a small piece\'s points');
  let rolled = 0;
  const seen = new Set();
  for (const recipe of ['clothamulet:linen:ruby', 'clothamulet:linen:jade', 'mark:silver:ruby', 'bracer:silver']) {
    for (let seed = 0; seed < 120; seed++) {
      const it = mintPiece({ recipe, quality: MASTERWORK, seed }, PROV);
      assert.equal(it.rarity, 'rare');
      const cost = enchantmentRowCost(it.enchantments[0]);
      assert.ok(cost <= it.enchantmentPoints && cost <= itemEnchantmentPower(it), `${recipe} seed ${seed}: ${cost} within ${it.enchantmentPoints}`);
      assert.equal(asMinted(it), true);
      assert.deepEqual(mintPiece({ recipe, quality: MASTERWORK, seed }, PROV).enchantments, it.enchantments, 'the seed\'s, again');
      if (recipe === 'clothamulet:linen:ruby') seen.add(`${it.enchantments[0].type}:${it.enchantments[0].param}`);
      rolled++;
    }
  }
  assert.equal(rolled, 480);
  assert.equal(seen.size, costs.filter((c) => c <= 660).length, 'every flavour a Cloth Amulet holds still drawn');
  // a piece every flavour fits: the seed's draw untouched (the J2 pin's Shadow Form stands)
  assert.deepEqual(mintPiece({ recipe: 'mark:platinum:diamond', quality: MASTERWORK, seed: 1 }, PROV).enchantments, [{ type: ENCHANTMENT_TYPES.CastWhenHeld, param: 45 }]);
});

test('AUDIT PROF-541 J5: a Wand rolls no Magic or Rare (no slot: lootRarity.js rarityEligible), so its bench promises no Masterwork\'s enchantment - every other piece\'s does', () => {
  const wand = mintPiece({ recipe: 'wand:ironwood:ruby', quality: MASTERWORK, seed: 1 }, PROV);
  assert.deepEqual([wand.rarity, wand.enchantments ?? []], [undefined, []]);
  stubPages({ rank: 100, held: { 'plank:ironwood': 2 } });
  const page = pageOf();
  try {
    page.family('Wand').onclick();
    page.recipe('Ironwood Ruby Wand').onclick();
    assert.match(page.text(), /enchantment points \(\+\d+%\)\. The item maker spends them\./);
    assert.doesNotMatch(page.text(), /Masterwork's own enchantment/);
    page.family('Ring').onclick();
    page.recipe('Silver Ruby Ring').onclick();
    assert.match(page.text(), /The item maker spends them, beside a Masterwork's own enchantment\./);
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── AUDIT PROF-541 ROUND 2 (2026-10-03) ─────────────────────────────

test('AUDIT PROF-541 R2-C4: a crafted piece\'s points said as the item maker reads them (craftedJewelPoints) - a ring forged with two billion says a plain Silver Ring\'s 1,800 on the tooltip and the card; the law\'s line its own where none is handed in', () => {
  const forged = { ...mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1 }, PROV), enchantmentPoints: 2_000_000_000 };
  assert.ok(scrollerToolTipText(forged).includes('1,800 enchantment points'), 'the classic tooltip');
  assert.equal(scrollerToolTipText(forged).includes('2,000,000,000'), false);
  assert.ok(itemPowerLines(forged).includes('1,800 enchantment points'), 'the Enhanced+ card');
  assert.ok(pieceLines(forged).includes('2,000,000,000 enchantment points'), 'the law alone: the item\'s own');
  assert.ok(pieceLines(forged, 1800).includes('1,800 enchantment points'));
  const honest = mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1, hand: 1 }, PROV);
  assert.ok(scrollerToolTipText(honest).includes('1,980 enchantment points'), 'a Goldsmith\'s its own');
});

test('AUDIT PROF-541 R2-C5: the item maker\'s cap counts a crafted piece\'s kept rows - DFU\'s eleven rows the most the item stores, kept and new together; a plain piece eleven of its own', () => {
  const rows = Array.from({ length: 14 }, (_, i) => enchantmentSettings('EnhancesSkill', i));
  const mw = mintPiece({ recipe: 'mark:platinum:diamond', quality: MASTERWORK, seed: 1, maker: 'X' }, PROV);
  applyEnchantments(mw, rows);
  assert.equal(mw.enchantments.length, MAX_ENCHANTMENTS + 1, 'eleven in all');
  assert.deepEqual([mw.enchantments[0].type, mw.enchantments[0].param], [ENCHANTMENT_TYPES.CastWhenHeld, 45], 'the Rare roll kept at the head');
  const plain = mintPiece({ recipe: 'ring:silver', quality: 1, seed: 1 }, PROV);
  applyEnchantments(plain, rows);
  assert.equal(plain.enchantments.length, MAX_ENCHANTMENTS + 1, 'DFU\'s own eleventh row');
});

test('AUDIT PROF-541 R2-C6: the jeweller\'s bench\'s odds say the town Apothecary\'s quality steps the service adds (professions.js seatStepsFor) - a whole number or none; the world hands them by Jewelcrafting\'s station', () => {
  for (const [steps, says] of [[2, ' (+2 steps from the town\'s Apothecary)'], [1.6, ' (+1 step from the town\'s Apothecary)'], [0, ''], [-2, '']]) {
    stubPages({ rank: 25, held: { 'metal:gold': 9 }, over: { jewelSteps: () => steps } });
    const page = pageOf();
    try {
      page.family('Gold').onclick();
      page.recipe('Gold Ring').onclick();
      assert.ok(page.text().includes(`Your rank 25, margin 0: Crude 20 | Standard 60 | Fine 20${says}. A clean facet is a step better`), String(steps));
    } finally { page.done(); setProfessionsPages(null); }
  }
  assert.match(src('src/scenes/world.js'), /jewelSteps: \(\) => myHall\('jewelcrafting'\)\.steps,/);
});
