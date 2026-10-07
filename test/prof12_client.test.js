// PROF12 (2026-10-02) - ALCHEMY AND THE ENCHANTING LAYER AS THE CLIENT MAKES THEM: The Alchemy Station on the Stores page (an
// Alchemist's, 50 gold a brew; a home's alchemy station) - DFU's twenty by their ranks, a cauldron as the Stores hold it,
// the Apothecaries' goods bought where it is short, what a brew makes and its Potent chance, a Transmuter's transmutations;
// The Enchanting Station (a Mages Guild hall, 50 gold a piece; a home's) - the pack's crafted pieces and their Essence,
// disenchanted pressed twice; the potions as DFU's own (a Potent one named so, stacked apart, drunk at its share); the
// item maker's gold with Enchanting's share off; the Market tab's Apothecaries' counter; and the done-when, driven through
// the real Worker: A HEALING BREWED AT AN ALCHEMIST'S FROM THE STORES' RED BERRIES, MERCURY AND THE APOTHECARIES' TROLL'S
// BLOOD AND ELIXIR VITAE, INTO THE PACK AS DFU'S OWN POTION; A MASTER ALCHEMIST'S POTENT ONE AT +40%; A CRAFTED RING
// DISENCHANTED INTO ARCANE ESSENCE. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md 3.3, 4.5, 9.3, 37.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { realmGoldAct } from '../src/systems/realmSaves.js';   // AUDIT PROF-541 R2-C1
import { xpForRank, ALCHEMY_FEE, ENCHANT_FEE, stockOf, trackOf, professionName } from '../src/net/professionLaw.js';   // CRAFT3: trackOf, professionName
import { potionById, POTENT, enchantGold, potentChance } from '../src/net/alchemyLaw.js';
import { FORT_EFFECT_WORDS, STATION_PROFESSIONS } from '../src/net/fortLaw.js';
import { cookXp } from '../src/net/recipeLaw.js';
import { potionRecipeKey, potionBundle, POTION_RECIPES } from '../src/systems/potions.js';
import { brewItems, brewedText, BREW_KEPT_TEXT } from '../src/systems/alchemyItems.js';
import { POTION_TEMPLATE_INDEX } from '../src/systems/loot.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { addItem, splitStack } from '../src/systems/inventory.js';
import { useItem } from '../src/systems/useItem.js';
import { enchantDecision } from '../src/systems/enchanting.js';
import { ItemMakerWindow } from '../src/ui/itemMakerWindow.js';
import { ITEM_FIELDS, isDeclaredItemField } from '../src/systems/itemFields.js';
import { materialLabel, materialCountLabel, mintMaterialItem } from '../src/systems/profItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import '../src/systems/profTemplates.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, enchantGoldPct, _alchemyForTests, ALCHEMY_AWAY_LINE, ENCHANT_AWAY_LINE,
  ESSENCE_STAYS_LINE,   // AUDIT PROF12 E1
  POTENT_NONE_LINE, ENCHANT_FULL_LINE,   // AUDIT PROF-541 B3, B8
} from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
function pageOf(draw0 = drawStoresPage) {
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); draw0(root, draw, kit); };
  draw();
  return {
    draw, text: () => root.textContent,
    button: (label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) ?? null,
    buttonStarting: (label) => [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith(label)) ?? null,
    recipe: (prefix) => [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-recipe') && b.textContent.startsWith(prefix)) ?? null,
    done() { root?.remove?.(); },
  };
}
const settle = async (state) => { for (let i = 0; i < 400 && (state.crafting || state.busy); i++) await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF12 DONE WHEN: a Healing brewed at an Alchemist\'s from the Stores\' Red Berries and Mercury and the Apothecaries\' Troll\'s Blood and Elixir Vitae (bought at the station), into the pack as DFU\'s own potion - its key, its price, its bottle; a Master Alchemist\'s Potent one at +40%, named so; a crafted ring disenchanted at a Mages Guild hall, pressed twice, into Arcane Essence - through the real Worker', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const track = (prof, xp, spec50 = null, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`).run(mac.id, mac.character, prof, xp, spec50, spec100, NOON);
  raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?)').run(mac.id, 100);
  give('p1:16', 1); give('metal:mercury', 1);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const player = { items: [], gold: 500 };
  const paid = [];
  const mint = (data, kept) => { for (const it of brewItems(data)) addItem(player.items, it, 'back'); paid.push(kept?.fee); };
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: '' }), purse: () => player.gold, marks: () => book.state.marks ?? 100, marksOpen: () => true,
    alchemy: () => ({ kind: 'shop', fee: ALCHEMY_FEE }),
    brew: async (potion, keys) => {
      const r = await book.brew(potion, keys, { fee: ALCHEMY_FEE }, mint);
      return r.ok ? { ok: true, text: `${brewedText(r.data)} (+${r.data.xp} ${professionName('alchemy')} XP).` } : { ok: false, text: r.kept ? BREW_KEPT_TEXT : accountRefusalText(r.error) };   // PIN MOVED (CRAFT3): world.js's word - the brew raises Provisioning, Alchemy's craft
    },
    stock: async (key, qty, counter) => { const r = await book.stock(key, qty); return r.ok ? { ok: true, text: `Bought from the ${counter}.` } : { ok: false, text: accountRefusalText(r.error) }; },
    enchanter: () => ({ kind: 'shop', fee: ENCHANT_FEE }),
    disenchantable: () => player.items.filter((it) => it.provenance).map((it) => ({ provenance: it.provenance, name: itemLongName(it), points: 2160, essence: 21, recipe: it.recipe })),
    disenchant: async (pv) => {
      const r = await book.disenchant(pv);
      if (r.ok) player.items = player.items.filter((it) => it.provenance !== pv);
      return r.ok ? { ok: true, text: `Into ${r.data.essence} Arcane Essence (+${r.data.xp} Enchanting XP).` } : { ok: false, text: accountRefusalText(r.error) };
    },
  });
  const page = pageOf();
  try {
    assert.match(page.text(), /The Alchemy Station/);
    assert.match(page.text(), /The alchemist's station - 50 gold a brew\. Provisioning 0 \(Novice\): a potion a brew; Potent 0% \(\+25% magnitude or duration\), \+5% for each herb you picked unbruised\./);   // PIN MOVED (CRAFT3): the station reads Provisioning, Alchemy's craft's track
    assert.equal(page.recipe('Healing').textContent, 'Healingwants its ingredients');
    assert.equal(page.recipe('Invisibility').textContent, 'Invisibilityrank 70');
    page.recipe('Healing').onclick();
    assert.match(page.text(), /Healing - rank 0Red Berries \(northern\) 1 \/ 1 \(1 stored\)Troll's Blood 0 \/ 1 \(0 stored\)Buy 1 from the Apothecaries - 4 silver/);
    assert.equal(page.button('Brew').disabled, true, 'short of its Troll\'s Blood');
    page.button('Buy 1 from the Apothecaries - 4 silver').onclick();
    await settle(_alchemyForTests());
    page.draw();
    page.button('Buy 1 from the Apothecaries - 6 silver').onclick();
    await settle(_alchemyForTests());
    page.draw();
    assert.deepEqual([book.held('reagent:troll-blood'), book.held('reagent:elixir-vitae')], [1, 1], 'the counter\'s goods in the Stores');
    assert.match(page.text(), /A potion a brew\. Potent 0% \(\+25% magnitude\) - and \+5% for each of its herbs you picked unbruised\. 20 Provisioning XP, and 500 the first time\./);   // PIN MOVED (CRAFT3): the XP is Provisioning's
    page.button('Brew').onclick();
    await settle(_alchemyForTests());
    assert.equal(player.items.length, 1);
    const [bottle] = player.items;
    assert.deepEqual([bottle.group, bottle.templateIndex, bottle.potionRecipeKey, bottle.value, bottle.potent, itemLongName(bottle)],
      ['UselessItems1', POTION_TEMPLATE_INDEX, potionById('healing').key, 50, undefined, 'Potion of Healing'], 'DFU\'s own Healing');
    assert.deepEqual(paid, [ALCHEMY_FEE], 'the fee kept with the brew and paid as its potion was bottled');
    assert.equal(book.track('alchemy').xp, 520);
    page.draw();
    assert.match(page.text(), /You brewed a Potion of Healing \(\+520 Provisioning XP\)\./);   // PIN MOVED (CRAFT3): the world's word names the track it raised
    // A MASTER ALCHEMIST'S: three potions, Potent at +40%
    track('provisioning', xpForRank(100), null, 'master-alchemist');   // PIN MOVED (CRAFT3): the Master Alchemist stands under Provisioning, Alchemy's craft's track
    for (const k of ['p1:16', 'metal:mercury', 'reagent:troll-blood', 'reagent:elixir-vitae']) give(k, 1);
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.recipe('Healing').onclick();
    assert.match(page.text(), /Provisioning 100 \(Master\): 3 potions a brew; Potent 20% \(\+40% magnitude or duration\)/);   // PIN MOVED (CRAFT3): Provisioning's rank
    await steered(0x00, async () => { page.button('Brew').onclick(); await settle(_alchemyForTests()); });
    const potent = player.items.find((it) => it.potent === 40);
    assert.deepEqual([potent?.stackCount ?? 1, potent?.value, itemLongName(potent)], [3, 70, 'Potent Potion of Healing'], 'three, stacked apart from the plain one; worth its share more');
    assert.equal(player.items.length, 2, 'the plain and the Potent: two stacks');
    // A RING DISENCHANTED: pressed twice, the Essence the Stores', the piece gone
    track('smithing', xpForRank(25));   // PIN MOVED (CRAFT3): a Ring's rank read on Smithing, Jewelcrafting's craft's track
    give('metal:gold', 1); give('gem:ruby', 1);
    const made = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'ring:gold:ruby', clean: false, name: 'Mac', rid: 'ring-for-essence-1' }, mac.secret);
    player.items.push({ group: 'Jewellery', templateIndex: 135, provenance: made.body.pieces[0].provenance, recipe: 'ring:gold:ruby', name: 'Gold Ruby Ring', enchantmentPoints: 2160 });
    page.draw();
    assert.match(page.text(), /The Enchanting Station.*The guild's enchanter - 50 gold a piece\. Enchanting 0 \(Novice\)\./);
    assert.match(page.text(), /2,160 points - 21 Arcane Essence, \+315 Enchanting XP/);   // AUDIT PROF12 E2: 5 x the Gold ring's tier 3 x 21
    page.button('Disenchant').onclick();
    assert.ok(page.button('Press again: it is gone'), 'pressed once: armed, nothing asked');
    page.button('Press again: it is gone').onclick();
    for (let i = 0; i < 40 && book.held('essence:arcane') === 0; i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual([book.held('essence:arcane'), book.track('enchanting').xp, player.items.some((it) => it.provenance)], [21, 315, false]);
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── THE PAGES ───────────────────────────────────────────────────────

/** The stub book's professions shut (the switch, a guest): the pages are not shown. */
let _stubBook = null;
const _shutForTests = () => { _stubBook.state.open = false; };
function stubPages({ alchemy = null, enchanter = null, alchemyTrack = { rank: 0, specs: { 50: null, 100: null } }, enchantingTrack = { rank: 0, specs: { 50: null, 100: null } }, held: heldIn = {}, over = {} } = {}) {
  resetProfPages();
  const held = new Map(Object.entries(heldIn));
  // PIN MOVED (CRAFT3): the stub book as profBook's - its tracks keyed by track ('provisioning' Alchemy's), a discipline asked its craft's
  const tracks = new Map([['provisioning', { profession: 'provisioning', xp: xpForRank(alchemyTrack.rank), ...alchemyTrack }], ['enchanting', { profession: 'enchanting', xp: xpForRank(enchantingTrack.rank), ...enchantingTrack }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0, choose: async () => ({ ok: true }),
  };
  const calls = [];
  _stubBook = book;
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), purse: () => 1000,
    alchemy: () => alchemy, brew: async (p, k) => { calls.push(['brew', p, k]); return { ok: true, text: 'brewed' }; },
    smelt: async (id, n) => { calls.push(['smelt', id, n]); return { ok: true, text: 'turned' }; },
    enchanter: () => enchanter, disenchantable: () => [{ provenance: 'aaaaaaaaaaaaaaaa', name: 'Iron Longsword', points: 600, essence: 6, recipe: 'longsword:iron' }],
    disenchant: async (pv) => { calls.push(['disenchant', pv]); return { ok: true, text: 'apart' }; },
    ...over,
  });
  return { calls, held };
}

test('PROF12 pages: The Alchemy Station - away, the word; at a home\'s, no fee; DFU\'s twenty by their price\'s ranks; a cauldron filled from the herb group held more of; Brew asks the potion and its keys; the brews a rank makes (the Apothecaries\' goods alone one - AUDIT PROF-541 R2-S1); a Transmuter\'s transmutations (two of a metal and a Mercury - AUDIT PROF12 E3), none for another', async () => {
  stubPages();
  let page = pageOf();
  assert.ok(page.text().includes(ALCHEMY_AWAY_LINE));
  page.done();
  const { calls } = stubPages({ alchemy: { kind: 'home', fee: 0 }, alchemyTrack: { rank: 50, specs: { 50: 'brewer', 100: null } },
    held: { 'p2:16': 2, 'p1:16': 1, 'reagent:troll-blood': 1, 'reagent:elixir-vitae': 1, 'metal:mercury': 1 } });
  page = pageOf();
  assert.match(page.text(), /Your alchemy station\. Provisioning 50 \(Journeyman\): 3 potions a brew; Potent 0%/);   // PIN MOVED (CRAFT3): the station reads Provisioning, Alchemy's craft's track
  for (const [name, rank] of [['Stamina', 0], ['Resist Fire', 10], ['Cure Disease', 25], ['Levitation', 40], ['Shadow Form', 55], ['Invisibility', 70], ['Purification', 90]]) {
    assert.equal(page.recipe(name).textContent, `${name}${rank <= 50 ? 'wants its ingredients' : `rank ${rank}`}`, 'open at Journeyman to rank 40, shut above it');
  }
  assert.equal(page.recipe('Healing').textContent, 'Healingcan brew now');
  page.recipe('Healing').onclick();
  assert.match(page.text(), /p2:16 1 \/ 1 \(2 stored\)/, 'the southern Red Berries - the more held');
  page.button('Brew').onclick();
  await settle(_alchemyForTests());
  assert.deepEqual(calls, [['brew', 'healing', ['p2:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']]]);
  // AUDIT PROF-541 R2-S1: a Brewer's three - but the Apothecaries' goods alone brew one, and the station says so
  assert.match(page.text(), /3 potions a brew\. Potent 0%/, 'the Healing\'s three');
  assert.match(page.text(), /picked unbruised\. A potion wholly of the Apothecaries' goods brews one\./);
  page.recipe('Levitation').onclick();
  assert.match(page.text(), /A potion a brew\. Potent 0%/, 'Levitation\'s cauldron is the counter\'s alone: one');
  page.recipe('Healing').onclick();
  assert.match(page.text(), /A Transmuter - Alchemy's choice at 100 - turns two of a metal and a Mercury/);
  assert.equal(page.button('Transmute'), null);
  page.done();
  const { calls: calls2 } = stubPages({ alchemy: { kind: 'shop', fee: ALCHEMY_FEE }, alchemyTrack: { rank: 100, specs: { 50: 'distiller', 100: 'transmuter' } }, held: { 'metal:tin': 3, 'metal:mercury': 1 } });
  page = pageOf();
  assert.match(page.text(), /Provisioning 100 \(Master\): 3 potions a brew; Potent 30% \(\+25% magnitude or duration\)/, 'Master\'s 20 and a Distiller\'s 10');   // PIN MOVED (CRAFT3): Provisioning's rank
  assert.match(page.text(), /metal:copper2 metal:tin \(3\) \+ 1 metal:mercury \(1\)/, 'Tin to Copper, its inputs as the Stores hold them');
  assert.match(page.text(), /metal:silver2 metal:copper \(0\) \+ 1 metal:mercury \(1\)/);
  const go = page.button('Transmute');
  assert.equal(go.disabled, false);
  go.onclick();
  await settle(_alchemyForTests());
  assert.deepEqual(calls2.at(-1), ['smelt', 'transmute:tin', 1]);
  page.done();
});

test('PROF12 pages: The Enchanting Station - away, the word; at a Mages Guild hall its fee, the rank\'s share off the item maker said; a piece\'s Essence and XP; Disenchant pressed twice asks it once; the share the item maker reads (none offline)', async () => {
  stubPages();
  let page = pageOf();
  assert.ok(page.text().includes(ENCHANT_AWAY_LINE));
  assert.equal(enchantGoldPct(), 0, 'Novice: no share');
  page.done();
  const { calls } = stubPages({ enchanter: { kind: 'shop', fee: ENCHANT_FEE }, enchantingTrack: { rank: 100, specs: { 50: 'efficient', 100: null } } });
  page = pageOf();
  assert.match(page.text(), /The guild's enchanter - 50 gold a piece\. Enchanting 100 \(Master\): the item maker's gold 25% less\./);
  assert.match(page.text(), /Iron Longsword600 points - 6 Arcane Essence, \+7 Enchanting XP/, 'AUDIT PROF12 E2: the Iron sword\'s tier 1, quartered at a Master\'s 7 - 30 / 4');
  assert.equal(enchantGoldPct(), 25, 'a Master\'s 20 and an Efficient\'s 5');
  // the item maker's window reads the share: its gold label and the gold it asks
  const player = { items: [], gold: 0, goldPieces: 0 };
  const win = new ItemMakerWindow({ packItems: () => [], player, entity: player, icons: null, goldDiscountPct: () => enchantGoldPct() });
  win.selected = { group: 'Jewellery', templateIndex: 135 };
  win.powers = [{ enchantCost: 50, parentEnchantment: 0 }];
  assert.equal(win.labels().goldCost, '375', 'DFU\'s 500, a quarter off');
  assert.equal(new ItemMakerWindow({ packItems: () => [], player, entity: player, icons: null, goldDiscountPct: () => 150 }).goldDiscountPct(), 0, 'a share past the whole none');
  page.button('Disenchant').onclick();
  assert.deepEqual(calls, [], 'once: armed');
  page.button('Press again: it is gone').onclick();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(calls, [['disenchant', 'aaaaaaaaaaaaaaaa']]);
  page.done();
  stubPages({ enchantingTrack: { rank: 100, specs: { 50: 'efficient', 100: null } } });
  _shutForTests();
  assert.equal(enchantGoldPct(), 0, 'the professions not this account\'s: DFU\'s own price');
  setProfessionsPages(null);
  assert.equal(enchantGoldPct(), 0, 'no pages (offline): DFU\'s own price');
  // the item maker's ladder with the share off: the gold asked, the gold charged
  const powers = [{ enchantCost: 50, parentEnchantment: 0 }];
  assert.deepEqual(enchantDecision({ templateIndex: 135, group: 'Jewellery' }, powers, [], { gold: 375, discountPct: 25 }), { kind: 'enchant', text: 'The item has been enchanted.', goldCost: 375, cost: 50, power: 1800 });
  assert.equal(enchantDecision({ templateIndex: 135, group: 'Jewellery' }, powers, [], { gold: 375 }).kind, 'noGold', 'offline: DFU\'s 500');
  assert.equal(enchantGold(501, 10), 451, 'rounded up');
});

test('PROF12 pages: Alchemy and Enchanting practised on the Professions page - their cards chosen at their ranks, Alchemy\'s unlocks by DFU\'s twenty, how each is practised said', () => {
  stubPages({ alchemyTrack: { rank: 100, specs: { 50: null, 100: null } } });
  const src0 = src('src/ui/profPages.js');
  // PIN MOVED (CRAFT3): PRACTISED is the ten tracks - Alchemy practised as Provisioning's, beside Enchanting
  assert.match(src0, /const PRACTISED = Object\.freeze\(\['herbalism', 'mining', 'hunting', 'fishing', 'logging', 'smithing', 'building', 'outfitting', 'provisioning', 'enchanting'\]\);/);
  const page = pageOf(drawProfessionsPage);
  try {
    page.buttonStarting('Provisioning').onclick();   // PIN MOVED (CRAFT3): Alchemy's brewing is the Provisioning track's pane
    page.draw();
    assert.match(page.text(), /Brewer3 potions a brew at Journeyman\./);
    // PIN MOVED (CRAFT3): a merged craft's four cards a rank, each named for its discipline (prof-of)
    const cards = [...document.body.querySelectorAll('.prof-specs')].map((c) => [...c.querySelectorAll('.prof-spec')].map((b) => [b.querySelector('b').textContent, b.querySelector('.prof-of')?.textContent ?? null]));
    assert.deepEqual(cards, [
      [['Brewer', 'Alchemy'], ['Distiller', 'Alchemy'], ['Cook', 'Cooking'], ['Field Cook', 'Cooking']],
      [['Master Alchemist', 'Alchemy'], ['Transmuter', 'Alchemy'], ['Chef', 'Cooking'], ['Provisioner', 'Cooking']],
    ]);
    assert.match(page.text(), /Alchemy: Orc Strength, Stamina, Healing, Water Walkingrank 0/);   // PIN MOVED (CRAFT3): each unlock its discipline's name
    assert.match(page.text(), /Alchemy: Purificationrank 90/);   // PIN MOVED (CRAFT3): as above
    // PIN MOVED (CRAFT3): the Unlocks both disciplines' lines, by the rank each opens at (unlocksOf) - Alchemy's first on a tie
    assert.deepEqual([...document.body.querySelector('.prof-pane').querySelectorAll('.px-stat')].map((r) => r.textContent), [
      'Alchemy: Orc Strength, Stamina, Healing, Water Walkingrank 0', 'Cooking: Hunter\'s Stew, Fisherman\'s Supperrank 0',
      'Alchemy: Resist Fire, Resist Frost, Resist Shock, Restore Powerrank 10', 'Cooking: Orchard Tartrank 10',
      'Alchemy: Slow Falling, Water Breathing, Cure Disease, Heal Truerank 25', 'Alchemy: Resist Poison, Free Action, Levitationrank 40',
      'Alchemy: Chameleon Form, Shadow Form, Cure Poisonrank 55', 'Alchemy: Invisibilityrank 70', 'Cooking: Feast of the Hearthrank 70', 'Alchemy: Purificationrank 90',
    ]);
    assert.match(page.text(), /Brew at an alchemy station/);
    assert.doesNotMatch(page.text(), /not practised in the Bay yet/);
    page.buttonStarting('Enchanting').onclick();
    page.draw();
    assert.match(page.text(), /Level Enchanting by disenchanting crafted pieces into Arcane Essence at an enchanting station/);
    assert.match(page.text(), /From Journeyman, your rank lowers its cost/);
    assert.doesNotMatch(page.text(), /not practised in the Bay yet/);
  } finally { page.done(); setProfessionsPages(null); }
});

// ─── THE POTIONS AND THE GOODS ───────────────────────────────────────

test('PROF12 items: a brew\'s potions are DFU\'s own (createPotion - its key, price and bottle); a Potent one carries its share, is named so, worth its share more, stacks only with its own and splits with it; drunk, its magnitudes raised by its share (the bundle\'s only); the useItem door hands the share on', () => {
  const healing = potionById('healing');
  const [plain] = brewItems({ potion: 'healing', count: 1, potent: 0 });
  const potent = brewItems({ potion: 'healing', count: 2, potent: 25 });
  assert.deepEqual([plain.group, plain.templateIndex, plain.potionRecipeKey, plain.value, 'potent' in plain], ['UselessItems1', POTION_TEMPLATE_INDEX, healing.key, 50, false]);
  assert.deepEqual([potent.length, potent[0].potent, potent[0].value, itemLongName(potent[0])], [2, 25, 63, 'Potent Potion of Healing']);
  assert.deepEqual(brewItems({ potion: 'healing', count: 1, potent: 30 })[0].potent, undefined, 'a share no brew makes is none');
  assert.deepEqual(brewItems({ potion: 'nope', count: 1 }), []);
  const items = [];
  addItem(items, plain, 'back');
  for (const it of potent) addItem(items, it, 'back');
  assert.deepEqual(items.map((it) => [it.potent ?? 0, it.stackCount ?? 1]), [[0, 1], [25, 2]], 'two stacks');
  const one = splitStack(items, items[1], 1);
  assert.equal(one?.potent, 25, 'the split keeps its share');
  // drunk: the bundle's magnitudes raised, nothing else
  const bundle = potionBundle(healing.key);
  const e = bundle.effects[0];
  assert.deepEqual([e.magnitudeBaseLow, e.magnitudeLevelBase], [5, 9]);
  const src0 = src('src/scenes/hostMagic.js');
  assert.match(src0, /drinkPotion\(recipeKey, potent = 0\) \{\n\s*const plain = potionBundle\(recipeKey\);\n\s*if \(!plain\) return null;\n[^\n]*(?:\s*\/\/[^\n]*\n)+\s*const bundle = potent \? \{ \.\.\.plain, effects: plain\.effects\.map\(\(e\) => potentEffect\(e, potent, effectiveLevel\(playerEntity\)\)\) \} : plain;/);
  const drunk = [];
  const bag = [{ ...potent[0], stackCount: 1 }];
  useItem(bag[0], bag, { drinkPotion: (key, share) => { drunk.push([key, share]); return 'Healing'; } });
  assert.deepEqual(drunk, [[healing.key, 25]]);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) assert.match(src(f), /drinkPotion: \(key, potent\) => magic\.drinkPotion\(key, potent\),/, f);
  assert.equal(POTION_RECIPES.length, 20);
  assert.ok(isDeclaredItemField('potent'), 'the share a declared item field');
  assert.deepEqual([ITEM_FIELDS.potent.kind, ITEM_FIELDS.potent.min, ITEM_FIELDS.potent.max], ['int', 25, 40]);
  assert.equal(potionRecipeKey([16, 42, 62, 65]), healing.key);
});

test('PROF12 goods: the Apothecaries\' sixteen withdraw as DFU\'s own ingredients (their groups, their names, counted as mass); Arcane Essence its registered template (680, Ectoplasm\'s picture), withdrawn and named; the Market tab\'s Apothecaries\' counter beside the Weavers\'', () => {
  const ichor = mintMaterialItem('reagent:ichor');
  assert.deepEqual([ichor.group, ichor.templateIndex, materialLabel('reagent:ichor'), materialCountLabel('reagent:ichor', 3)], ['MiscellaneousIngredients1', 64, 'Ichor', 'Ichor']);
  assert.deepEqual([materialLabel('reagent:unicorn-horn'), materialCountLabel('reagent:unicorn-horn', 2), materialCountLabel('reagent:small-tooth', 2)], ['Unicorn Horn', 'Unicorn Horns', 'Small Teeth']);
  const t = templateByIndex(680);
  assert.deepEqual([t?.name, t?.worldTextureArchive, t?.worldTextureRecord, t?.stackable], ['Arcane Essence', 254, 39, true]);
  assert.deepEqual([mintMaterialItem('essence:arcane')?.templateIndex, materialCountLabel('essence:arcane', 4)], [680, 'Arcane Essence']);
  assert.deepEqual(stockOf('reagent:ichor'), { key: 'reagent:ichor', marks: 4, counter: 'apothecaries' });
  const m = src('src/ui/marketTab.js');
  // BOARD-UI (PIN MOVED): the counters folded under the suppliers' line, which the Materials view hangs
  assert.match(m, /if \(\(m\.apothecaries \?\? \[\]\)\.length\) box\.append\(apothecariesNode\(\)\);/);
  assert.match(m, /if \(st\.view === 'materials'\) box\.append\(suppliersNode\(\)\);/);
  assert.match(m, /box\.append\(el\('h4', null, 'The Apothecaries\\' counter'\)\);/);
  assert.match(src('src/scenes/world.js'), /apothecaries: APOTHECARY_STOCK,/);
});

// ─── THE BOOK ────────────────────────────────────────────────────────

test('PROF12 book: a brew is kept as a craft - a lost answer asked again with the same id is the same brew, its potions bottled once on the answer; one at a time beside a craft; a disenchant\'s id the piece\'s until an answer comes', async () => {
  const asked = [];
  let lose = 1;
  const door = {
    account: () => 'acct-1',
    brew: async (c, potion, keys, rid, seat) => {
      asked.push([potion, keys, rid, seat]);
      if (lose-- > 0) return { ok: false, error: 'offline' };
      return { ok: true, data: { potion, keys, count: 2, potent: 25, unbruised: 0, steps: 0, xp: 20, first: false, track: null, stores: [] } };
    },
    disenchant: async (c, pv, rid) => { asked.push(['disenchant', pv, rid]); return asked.filter((a) => a[0] === 'disenchant').length === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { essence: 6, xp: 5, store: { material: 'essence:arcane', own: 6, bought: 0 }, track: null } }; },
  };
  const storage = memStorage();
  const book = createProfBook({ door, storage, character: () => 'c1', now: () => 0, sleep: noWait });
  const minted = [];
  const r = await book.brew('healing', ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'], { fee: 50, seat: 3021 }, (data, kept) => minted.push(...brewItems(data).map((it) => [it.potent, kept.fee])));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(asked[0][2], asked[1][2], 'the same id');
  assert.deepEqual(asked[1].slice(0, 2).concat(asked[1][3]), ['healing', ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'], 3021]);
  assert.deepEqual(minted, [[25, 50], [25, 50]], 'two Potent potions, the fee with them - once');
  assert.equal(book.pendingCrafts, 0);
  const d1 = await book.disenchant('aaaaaaaaaaaaaaaa');
  assert.equal(d1.ok, true, 'the book\'s own retry');
  const ds = asked.filter((a) => a[0] === 'disenchant');
  assert.equal(ds[0][2], ds[1][2], 'the same id');
  assert.equal(book.held('essence:arcane'), 6);
  assert.match(src('src/net/accountClient.js'), /brew: \(character, potion, keys, rid, seat = null\) => post\('\/v1\/prof\/brew', \{ character, potion, keys, rid, \.\.\.\(seat == null \? \{\} : \{ seat \}\) \}\),/);
  assert.match(accountRefusalText('prof-transmuter'), /Only a Transmuter/);
  assert.match(accountRefusalText('prof-no-essence'), /Arcane Essence/);
  assert.match(accountRefusalText('bad-brew'), /no such potion/);
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF12 wiring: the alchemy station an Alchemist\'s (open for trade) or a home\'s; the enchanting station a Mages Guild hall or a home\'s; the world brews there through the book (its fee, the Apothecary\'s town), transmutes at it by the smelt, mints a brew\'s potions, disenchants the pack\'s pieces; the item maker reads Enchanting\'s share; the service\'s routes stand', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorBuilding\.buildingType === BUILDING_TYPES\.Alchemist\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: ALCHEMY_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'alchemy'\)\) return \{ kind: 'home', fee: 0 \};/);
  assert.match(m, /guildGroupOfFaction\(townTalk\?\.factionDict \?\? null, interiorBuilding\.factionId\) === GUILD_GROUPS\.MagesGuild\) return \{ kind: 'shop', fee: ENCHANT_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'enchant'\)\) return \{ kind: 'home', fee: 0 \};/);
  assert.match(m, /goldDiscountPct: \(\) => enchantGoldPct\(\),/);
  assert.match(src('src/ui/itemMakerWindow.js'), /enchantDecision\(this\.selected, this\.powers, this\.sideEffects, \{ gold: this\.gold\(\), discountPct: this\.goldDiscountPct\(\) \}\)/);
  const w = src('src/scenes/world.js');
  assert.match(w, /alchemy: \(\) => modes\?\.alchemyHere\?\.\(\) \?\? null,/);
  assert.match(w, /const myHall = \(profession\) => hallStepsFor\(seatHere\(_musicLoc\?\.mapTableData\?\.mapId\), guildBook\?\.guild\?\.id \?\? null, profession\);\n\s*const alchemyHall = \(\) => myHall\('alchemy'\);/);   // PIN MOVED (AUDIT PROF-541 R2-H1): the guard fortLaw.js hallStepsFor's (prof9_client.test.js drives it)
  assert.match(w, /const \{ seat \} = alchemyHall\(\);\n\s*const r = await profBook\.brew\(potion, keys, \{ fee: f\.fee > 0 \? f\.fee : 0, seat \}, profMintCraft\);/);
  assert.match(w, /alchemySteps: \(\) => alchemyHall\(\)\.steps,/, 'AUDIT PROF-541 B4: the station\'s line says the steps the service adds');
  assert.match(w, /if \(typeof data\?\.potion === 'string'\) \{\n\s*const potions = brewItems\(data\);/);
  assert.match(w, /const f = \(alch \? modes\?\.alchemyHere\?\.\(\) : mason \?/);
  assert.match(w, /r = await profBook\.disenchant\(provenance\);\n\s*if \(r\?\.ok && here\(\) && !r\.elsewhere\) takeOut\(\);/);
  assert.match(w, /if \(at >= 0\) out = \{ piece: playerEntity\.items\.splice\(at, 1\)\[0\], at \};/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'\/v1\/prof\/brew': \(\) => brewAtStation\(ctx, who\.player, env, body\),/);
  assert.match(idx, /'\/v1\/prof\/disenchant': \(\) => disenchantPiece\(\{ \.\.\.ctx, bucket: env\.SAVES \}, who\.player, env, body\),/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/prof\/brew', '\/v1\/prof\/disenchant',/);
  assert.match(src('src/ui/profPages.js'), /drawJewellerBench\(detail, rerender, kit\);   \/\/ PROF10\n\s*drawAlchemyStation\(detail, rerender, kit\);   \/\/ PROF12\n\s*drawEnchantingStation\(detail, rerender, kit\);   \/\/ PROF12/);
  assert.equal(POTENT.pct, 25);
});

// ─── AUDIT PROF12 (2026-10-03): E1, E2, A2, A3 ───────────────────────

test('AUDIT PROF12 E1 client: the Stores page offers no Withdraw for Arcane Essence - its line says it stays, and the service\'s refusal is worded; a reagent beside it in the Essences still withdraws', () => {
  stubPages();
  _stubBook.state.stores.set('essence:arcane', { material: 'essence:arcane', own: 18, bought: 0 });
  _stubBook.state.stores.set('reagent:ichor', { material: 'reagent:ichor', own: 0, bought: 2 });
  const page = pageOf();
  const card = (k) => page.buttonStarting(k);
  try {
    card('essence:arcane').onclick();
    assert.equal(page.button('Withdraw to pack'), null, 'no Withdraw at all');
    assert.ok(page.text().includes(ESSENCE_STAYS_LINE));
    assert.doesNotMatch(page.text(), /Withdrawn, a material is an item in your pack/);
    card('reagent:ichor').onclick();
    assert.ok(page.button('Withdraw to pack'), 'a reagent goes to the pack');
    assert.equal(page.button('Withdraw to pack').disabled, false);
    assert.equal(page.text().includes(ESSENCE_STAYS_LINE), false);
  } finally { page.done(); setProfessionsPages(null); }
  assert.match(accountRefusalText('prof-no-pack-form'), /stays in the Stores/);
});

test('AUDIT PROF12 E2 client: the Enchanting Station says a piece\'s XP by its recipe\'s tier (a Gold ring\'s 3, a Master\'s Iron sword quartered, the counter\'s Linen none), and the streaming world hands each piece its recipe', async () => {
  const pieces = [
    { provenance: 'aaaaaaaaaaaaaaaa', name: 'Gold Ruby Ring', points: 2160, essence: 21, recipe: 'ring:gold:ruby' },
    { provenance: 'bbbbbbbbbbbbbbbb', name: 'Linen Plain Robes', points: 700, essence: 7, recipe: 'garment-163:linen' },
    { provenance: 'cccccccccccccccc', name: 'Iron Longsword', points: 600, essence: 6, recipe: 'longsword:iron' },
  ];
  stubPages({ enchanter: { kind: 'home', fee: 0 }, enchantingTrack: { rank: 0, specs: { 50: null, 100: null } }, over: { disenchantable: () => pieces } });
  let page = pageOf();
  assert.match(page.text(), /Gold Ruby Ring2,160 points - 21 Arcane Essence, \+315 Enchanting XP/);
  assert.match(page.text(), /Linen Plain Robes700 points - 7 Arcane Essence, \+0 Enchanting XP/);
  assert.match(page.text(), /Iron Longsword600 points - 6 Arcane Essence, \+30 Enchanting XP/);
  page.done();
  stubPages({ enchanter: { kind: 'home', fee: 0 }, enchantingTrack: { rank: 100, specs: { 50: null, 100: null } }, over: { disenchantable: () => pieces } });
  page = pageOf();
  assert.match(page.text(), /Gold Ruby Ring2,160 points - 21 Arcane Essence, \+78 Enchanting XP/, 'tier 3 at a Master\'s 7: quartered');
  page.done();
  setProfessionsPages(null);
  assert.match(src('src/scenes/world.js'), /essence: essenceOf\(points, profBook\?\.track\('enchanting'\)\?\.specs\?\.\[50\] === DISENCHANTER\), recipe: it\.recipe \}/);
});

test('AUDIT PROF12 A2 client: a quick slot keeps a Potent potion and a plain one of the same recipe apart - two kinds, and the HUD\'s count each its own', async () => {
  const { quickslotKey, assignQuickslot, resolveConsumable, clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const [plain] = brewItems({ potion: 'resistFire', count: 1, potent: 0 });
  const [potent] = brewItems({ potion: 'resistFire', count: 1, potent: 25 });
  const [master] = brewItems({ potion: 'resistFire', count: 1, potent: 40 });
  assert.notEqual(quickslotKey(plain), quickslotKey(potent));
  assert.notEqual(quickslotKey(potent), quickslotKey(master));
  assert.equal(quickslotKey(potent), quickslotKey(brewItems({ potion: 'resistFire', count: 1, potent: 25 })[0]), 'two Potent of one share: one kind');
  assert.equal(quickslotKey(plain).split('|').length, 9, 'AUDIT PROF-541 Q1: a plain potion keys as on main - a save\'s slot still resolves');
  const pack = [{ ...plain, stackCount: 3 }, { ...potent, stackCount: 2 }];
  const entity = { items: pack };
  assignQuickslot('c1', pack[1]);
  assignQuickslot('c2', pack[0]);
  assert.deepEqual([resolveConsumable(entity, 'c1').count, resolveConsumable(entity, 'c1').item.potent], [2, 25], 'the Potent slot counts the Potent');
  assert.deepEqual([resolveConsumable(entity, 'c2').count, resolveConsumable(entity, 'c2').item.potent], [3, undefined], 'the plain slot the plain');
  clearQuickslots();
});

test('AUDIT PROF12 A3 client (Mac: "Potent lasts longer"): a Potent potion whose magnitude is DFU\'s default says it lasts longer - the brew\'s word and the station\'s line; one with a magnitude its share of magnitude; the station\'s line before a potion is picked both', () => {
  assert.equal(brewedText({ potion: 'resistFire', count: 1, potent: 25 }), 'You brewed a Potent Potion of Resist Fire (lasts 25% longer)');
  assert.equal(brewedText({ potion: 'invisibility', count: 3, potent: 40 }), 'You brewed 3 Potent Potions of Invisibility (lasts 40% longer)');
  assert.equal(brewedText({ potion: 'healing', count: 1, potent: 25 }), 'You brewed a Potent Potion of Healing (+25% magnitude)');
  assert.equal(brewedText({ potion: 'resistFire', count: 1, potent: 0 }), 'You brewed a Potion of Resist Fire');
  stubPages({ alchemy: { kind: 'home', fee: 0 }, alchemyTrack: { rank: 100, specs: { 50: null, 100: 'master-alchemist' } } });
  const page = pageOf();
  try {
    assert.match(page.text(), /Provisioning 100 \(Master\): 3 potions a brew; Potent 20% \(\+40% magnitude or duration\)/);   // PIN MOVED (CRAFT3): Provisioning's rank
    page.recipe('Resist Fire').onclick();
    assert.match(page.text(), /3 potions a brew\. Potent 20% \(lasts 40% longer\)/);
    page.recipe('Healing').onclick();
    assert.match(page.text(), /3 potions a brew\. Potent 20% \(\+40% magnitude\)/);
  } finally { page.done(); setProfessionsPages(null); }
});


// ─── AUDIT PROF12 (2026-10-03) ───────────────────────────────────────

test('AUDIT PROF12 P1: the Apothecary\'s words say each profession\'s step as the law gives it - a piece of jewellery a quality step a tier, a dish half again the XP (twice at tier 2: recipeLaw cookXp), a brew +10% Potent chance a tier (alchemyLaw potentChance) - never a quality step for a dish or a brew', () => {
  assert.equal(FORT_EFFECT_WORDS.apothecary(1), 'members\' jewellery here a quality step better, their dishes half again the XP, their brews +10% Potent chance');
  assert.equal(FORT_EFFECT_WORDS.apothecary(2), 'members\' jewellery here 2 quality steps better, their dishes twice the XP, their brews +20% Potent chance');
  assert.deepEqual([1, 2].map((t) => cookXp(50, { steps: t }) / cookXp(50)), [1.5, 2], 'the XP the words say');
  assert.deepEqual([1, 2].map((t) => potentChance(75, { steps: t }) - potentChance(75)), [POTENT.apothecary, 2 * POTENT.apothecary], 'the Potent chance the words say');
  assert.deepEqual(STATION_PROFESSIONS.apothecary, ['alchemy', 'cooking', 'jewelcrafting']);
});

// ─── AUDIT PROF-541 (2026-10-03): B2, B3, B4, B8 ─────────────────────

test('AUDIT PROF-541 B3/B4 client: the station\'s Potent chance carries the town\'s Apothecary (+10 a step, as the service adds it); a Cure of DFU\'s default magnitude says it is never Potent (no chance, no herb\'s +5) and its potions are never minted Potent - nor named, nor worth more', () => {
  stubPages({ alchemy: { kind: 'home', fee: 0 }, alchemyTrack: { rank: 75, specs: { 50: null, 100: null } }, over: { alchemySteps: () => 2 } });
  const page = pageOf();
  try {
    assert.match(page.text(), /Provisioning 75 \(Expert\): 2 potions a brew; Potent 30% \(\+25% magnitude or duration\) \(the Apothecary's \+20% with it\)/);   // PIN MOVED (CRAFT3): Provisioning's rank
    page.recipe('Healing').onclick();
    assert.match(page.text(), /2 potions a brew\. Potent 30% \(\+25% magnitude\) - and \+5% for each of its herbs/);
    page.recipe('Cure Disease').onclick();
    assert.match(page.text(), new RegExp(`2 potions a brew\\. ${POTENT_NONE_LINE.replace(/[()]/g, '\\$&')}\\. \\d+ Provisioning XP`));   // PIN MOVED (CRAFT3): the XP is Provisioning's
    page.recipe('Purification').onclick();
    assert.match(page.text(), /Potent 30% \(\+25% magnitude\)/, 'Purification\'s magnitude stays Potent');
  } finally { page.done(); setProfessionsPages(null); }
  const [cure] = brewItems({ potion: 'cureDisease', count: 1, potent: 25 });
  const [plain] = brewItems({ potion: 'cureDisease', count: 1, potent: 0 });
  assert.deepEqual([cure.potent, cure.value, itemLongName(cure)], [undefined, plain.value, itemLongName(plain)]);
  assert.equal(brewedText({ potion: 'curePoison', count: 2, potent: 40 }), 'You brewed 2 Potions of Cure Poison');
  assert.equal(brewItems({ potion: 'purification', count: 1, potent: 25 })[0].potent, 25);
});

test('AUDIT PROF-541 B8 client: the Disenchant button is shut, the reason said, when the piece\'s Essence would pass the Stores\' room - every origin counted, as the service counts it', () => {
  stubPages({ enchanter: { kind: 'home', fee: 0 }, held: { 'essence:arcane': 4996 } });
  let page = pageOf();
  try {
    assert.equal(page.button('Disenchant').disabled, true);
    assert.ok(page.text().includes(ENCHANT_FULL_LINE(4)));
  } finally { page.done(); }
  stubPages({ enchanter: { kind: 'home', fee: 0 }, held: { 'essence:arcane': 4994 } });
  page = pageOf();
  try {
    assert.equal(page.button('Disenchant').disabled, false, 'room for its six');
    assert.equal(page.text().includes('room for'), false);
  } finally { page.done(); setProfessionsPages(null); }
});

test('AUDIT PROF-541 B2 client: a realm character\'s disenchant names where its record stands and is asked once (the realm act asks again); an offline one\'s still asks again itself; the record\'s refusal is worded', async () => {
  const asked = [];
  const door = {
    account: () => 'acc',
    disenchant: async (c, pv, rid, realm) => { asked.push([pv, realm]); return { ok: false, error: 'offline' }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'char-1', now: () => NOON * 1000, sleep: noWait });
  const at = { id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), seq: 4 };
  await book.disenchant('aaaaaaaaaaaaaaaa', at);
  assert.deepEqual(asked, [['aaaaaaaaaaaaaaaa', at]], 'once, with the record');
  asked.length = 0;
  await book.disenchant('bbbbbbbbbbbbbbbb');
  assert.ok(asked.length > 1 && asked.every(([, r]) => r === null), 'offline: the book asks again');
  assert.match(accountRefusalText('prof-piece-gone'), /record does not hold that piece/);
  const bodies = [];
  const wire = accountProf({ fetch: async (u, i) => { bodies.push(JSON.parse(i.body)); return new Response('{}', { status: 200 }); }, storage: sessionStorageOf(SESSION_KEY, { secret: 's'.repeat(43), id: 'acc' }) });
  await wire.disenchant('char-1', 'aaaaaaaaaaaaaaaa', 'rid-1', at);
  await wire.disenchant('char-1', 'aaaaaaaaaaaaaaaa', 'rid-2');
  assert.deepEqual(bodies.map((b) => b.realm ?? null), [at, null], 'the record where it stands, on the wire - and none for another character');
  const w = src('src/scenes/world.js');
  assert.match(w, /call: \(at\) => \{ if \(!here\(\)\) return Promise\.resolve\(\{ ok: false, error: 'elsewhere', elsewhere: true \}\); if \(!asked\) \{ asked = true; takeOut\(\); \} return out \? profBook\.disenchant\(provenance, at\) : Promise\.resolve\(\{ ok: false, error: 'prof-piece-gone' \}\); \},/);
  assert.match(w, /if \(r\?\.error === 'prof-no-piece' && r\?\.why === 'disenchanted' && takeOut\(\)\)/);
});

// ─── AUDIT PROF-541 ROUND 2 (2026-10-03) ─────────────────────────────

test('AUDIT PROF-541 R2-C1/N1: a realm disenchant that LANDED (its first answer lost, the record one on) answers no Stores and no track - the world reads the state again; a press that finds the piece disenchanted already reads it again too, and pays the enchanter the fee the lost press owed', async () => {
  // the landed act: the record one on, no data - the book's Stores untouched by it
  let seq = 5, n = 0;
  const door = { account: () => 'acc', disenchant: async () => { n++; if (n === 1) { seq++; return { ok: false, error: 'offline' }; } return { ok: false, error: 'seq', seq }; } };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'r0123456789abcdef0123', now: () => NOON * 1000, sleep: noWait });
  const session = { async transact(call) { const r = await call({ id: 'r0123456789abcdef0123', lease: 'f'.repeat(32), seq: 5 }); return r; } };
  const r = await realmGoldAct({ session, checkpoint: () => {}, wait: noWait, call: (at) => book.disenchant('aaaaaaaaaaaaaaaa', at) });
  assert.deepEqual([r.ok, r.landed, r.data], [true, true, undefined], 'landed, its Essence and XP unsaid');
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(paid\) deductGold\(playerEntity, Math\.min\(f\.fee, totalGoldAmount\(playerEntity\)\)\);\n(?:\s*\/\/[^\n]*\n)*\s*if \(!r\.data\) profBook\.refresh\(\{ force: true \}\)\.catch\(\(\) => \{\}\);/, 'a landed act: the state read again');
  assert.match(w, /if \(r\?\.error === 'prof-no-piece' && r\?\.why === 'disenchanted' && takeOut\(\)\) \{\n\s*const owed = f\.fee > 0 \? Math\.min\(f\.fee, totalGoldAmount\(playerEntity\)\) : 0;\n\s*if \(owed > 0\) deductGold\(playerEntity, owed\);\n\s*profBook\.refresh\(\{ force: true \}\)\.catch\(\(\) => \{\}\);/, 'disenchanted already: the fee paid, the state read again');
  assert.match(w, /and it leaves your pack\$\{owed > 0 \? `; you paid the enchanter \$\{owed\} gold` : ''\}\./);
});

test('AUDIT PROF-541 R2-C2: one latch holds every craft and brew (profBook _craftBusy), so the busy word names no station - not the anvil at the fire, nor the fire at the loom', async () => {
  assert.equal(accountRefusalText('prof-busy'), 'Your hands are busy with another craft.');
  const w = src('src/scenes/world.js');
  assert.doesNotMatch(w, /'The anvil is still ringing|'Your last (?:work|dish|piece) is still on the/);
  assert.match(w, /if \(!r\?\.ok\) return \{ ok: false, text: r\?\.kept \? `\$\{st\.kept\}\$\{chain \? ` \$\{chain\}` : ''\}` : `\$\{accountRefusalText\(r\?\.error\)\}\$\{movedFirstText\(r\)\}\$\{chain \? ` \$\{chain\}` : ''\}` \};/);   // PIN MOVED (AUDIT2 BAG1 K8): and what went into the Stores first; (CRAFT1) and what the chain refined first - kept or refused (AUDIT CRAFT1 F3)
  // the latch is one: a brew under way refuses a dish
  let release;
  const door = { account: () => 'acc', brew: () => new Promise((r) => { release = r; }), craft: async () => ({ ok: true, data: {} }) };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'char-1', now: () => NOON * 1000, sleep: noWait });
  const brewing = book.brew('healing', [], {}, () => {});
  assert.deepEqual(await book.craft('dish:bread', {}, () => {}), { ok: false, error: 'prof-busy' });
  release({ ok: false, error: 'bad-recipe' });
  await brewing;
});

test('AUDIT PROF-541 R2-C3: the station\'s Apothecary steps a whole number or none, as the fire\'s (cookSteps) - a fraction never a share of a step, a word never a step', () => {
  for (const [steps, says] of [[2.7, '+20%'], [-3, null], ['x', null], [1, '+10%']]) {
    stubPages({ alchemy: { kind: 'home', fee: 0 }, alchemyTrack: { rank: 75, specs: { 50: null, 100: null } }, over: { alchemySteps: () => steps } });
    const page = pageOf();
    try {
      if (says) assert.ok(page.text().includes(`(the Apothecary's ${says} with it)`), String(steps));
      else assert.equal(page.text().includes('the Apothecary'), false, String(steps));
    } finally { page.done(); setProfessionsPages(null); }
  }
});
