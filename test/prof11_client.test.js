// PROF11 (2026-10-01) - MASONRY AS THE CLIENT MAKES IT: the Mason's Bench on the Stores page (a General Store's, its fee a
// cut, a mix or a carving, or a home's station) - the cut and the mix with their counts and ranks, the Quarryman's two,
// THE CHISEL (the stone's lines, the marked one moving by the glint's rule, a press on a line or the arrows and Space,
// every strike true a clean act), Quick, Gentle acts, one act a page, Escape setting it down; the Sculptor's stone decor
// with its own chisel of seven; Masonry practised on the Professions page (the Builder's and the Fortifier's cards waiting
// on the fortifications); Mortar and the four stone pieces as items and as DECOR's own things; the book carrying the
// chisel's report; and the done-when, driven through the real Worker: ROUGH STONE CUT WITH A CLEAN CHISEL AT A GENERAL
// STORE'S BENCH, MORTAR MIXED, AND A SCULPTOR'S STONE COLUMN CARVED, MINTED AMONG THE HOME'S THINGS, SET DOWN IN A HOME AS
// ITS ONE MODEL AND READ BY A VISITOR WITH ITS MAKER'S MARK. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md
// 3.3, 4.5, 4.8, 9.3, 9.4.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, PROF_XP_MAX, MASON_FEE, trackOf } from '../src/net/professionLaw.js';
import { recipeById, MASTERWORK, CHISEL_ACT } from '../src/net/recipeLaw.js';
import { decorPieceOf } from '../src/net/decorLaw.js';
import { mintPiece, mintPieces, craftedText, isCraftedFurniture, MASON_KEPT_TEXT } from '../src/systems/smithItems.js';
import { mintMaterialItem, materialLabel, materialCountLabel } from '../src/systems/profItems.js';
import { templateByIndex, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { decorFurnishingEntry, furnishingKinds, furnishingLooks, isFurnishing } from '../src/systems/decorFurnish.js';
import { decorItemName } from '../src/systems/decorItems.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, setDownProfAct, profActUnderWay, _masonForTests, _loomForTests,
  PROF_STATIONS, stationColdLine, MASON_COLD_LINE, CHISEL_DOWN_LINE, masonVerb,
} from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const PROV = '0123456789abcdef';
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
function pageOf() {
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  return {
    draw, text: () => root.textContent, buttons: () => [...root.querySelectorAll('button')],
    button: (label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) ?? null,
    lines: () => [...root.querySelectorAll('.prof-chisel-line')],
    qty: (i) => [...root.querySelectorAll('.prof-qty')][i],
    done() { root?.remove?.(); },
  };
}
/** `n` strikes of the bench's chisel, each a frame on and a press on the line `pick` names (the marked one by default). */
function strikes(page, n, pick = (a) => a.mark) {
  for (let i = 0; i < n; i++) {
    const a = _masonForTests().act;
    assert.ok(a, `the chisel under way at strike ${i}`);
    a.tick(0.5);
    page.lines()[pick(a, i)].onclick();
  }
}
/** A work or a carving the chisel asked, answered - the bench's flags let go. */
async function settled() {
  for (let i = 0; i < 400 && (_masonForTests().busy || _masonForTests().crafting); i++) await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 4; i++) await tick();
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF11 DONE WHEN: Rough Stone cut with a clean chisel at a General Store\'s mason\'s bench (two a Cut Stone, Masonry XP half again and the first time\'s 500); Mortar mixed ten at a time at rank 10; a Sculptor\'s Stone Column carved with a clean chisel, minted among the home\'s things, listed by DECOR as its one model, set down in a home and read by a visitor with its maker\'s mark - through the real Worker', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  setPref('gentleActs', false);
  resetProfPages();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const track = (xp, spec50 = null, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'building', ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`).run(mac.id, mac.character, xp, spec50, spec100, NOON);   // PIN MOVED (CRAFT3): Masonry's rank and choices are the Building track's row
  give('stone:rough', 20);
  give('metal:sulphur', 1);
  give('metal:lead', 1);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const player = { items: [], furnishings: [], gold: 1000 };
  const said = [];
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: '' }), purse: () => player.gold,
    mason: () => ({ kind: 'shop', fee: MASON_FEE }), chiselBand: () => 1,
    smelt: async (recipe, count, opts) => {
      const r = await book.smelt(recipe, count, opts);
      if (r.ok) player.gold -= MASON_FEE;
      said.push(r.ok ? `+${r.data.xp} ${r.data.track.profession}` : accountRefusalText(r.error));
      return { ok: r.ok, text: said.at(-1) };
    },
    craft: async (recipe, opts) => {
      const r = await book.craft(recipe, { ...opts, name: 'Silverthorn', fee: MASON_FEE }, (data, kept) => {
        player.gold -= kept?.fee ?? 0;   // the fee rides the kept craft and is paid by its mint (AUDIT 30 C4's law)
        for (const it of mintPieces(data)) (isCraftedFurniture(it) ? player.furnishings : player.items).push(it);
      });
      return { ok: r.ok, text: r.ok ? craftedText(mintPieces(r.data)) : accountRefusalText(r.error) };
    },
  });
  const page = pageOf();
  try {
    assert.match(page.text(), /The Mason's Bench/);
    assert.match(page.text(), /The mason's bench - 50 gold a cut, a mix or a carving\. Building 0 \(Novice\)\./);   // PIN MOVED (CRAFT3): the bench says its craft's track
    // THE CUT: five cuts, the chisel struck true four times
    const cutQty = page.qty(0);
    cutQty.value = '5';
    cutQty.oninput();
    page.button('Cut').onclick();
    assert.equal(page.lines().length, CHISEL_ACT.lines, 'the stone\'s five lines');
    assert.match(page.text(), /The chisel \(Cut Stone, 5 times\) - strike the marked line, 4 strikes/);
    strikes(page, 4);
    await settled();
    assert.equal(book.held('stone:cut'), 5);
    assert.equal(book.held('stone:rough'), 10);
    assert.equal(book.track('masonry').xp, 5 * 20 * 1.5 + 500, 'a clean chisel half again, and the first cut\'s 500');
    assert.deepEqual([said.at(-1), player.gold], ['+650 building', 950]);   // PIN MOVED (CRAFT3): the service answers the Building track
    // THE MIX: rank 10 opens it (the cut alone brought 650 of 1,000)
    assert.match(page.text(), /rank 10/, 'Mortar shut below rank 10');
    track(xpForRank(10));
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.buttons().filter((b) => b.textContent === 'Quick')[1].onclick();
    await settled();
    assert.equal(book.held('stone:mortar'), 10, 'ten at a time');
    assert.deepEqual([book.held('metal:sulphur'), book.held('metal:lead'), book.held('stone:rough')], [0, 0, 5]);
    assert.equal(said.at(-1), `+${1 * 20 * 2 + 500} building`, 'a quick mix: no chisel, no half again - rank 10\'s tier, and its first 500');   // PIN MOVED (CRAFT3): the service answers the Building track
    // THE SCULPTOR'S COLUMN: a Master who chose the Sculptor, the dice steered to a Masterwork (the mark)
    track(PROF_XP_MAX, 'quarryman', 'sculptor');
    give('stone:cut', 12);
    assert.equal((await book.refresh({ force: true })).ok, true);
    page.draw();
    page.buttons().find((b) => b.textContent.startsWith('Stone Column')).onclick();
    assert.match(page.text(), /Stone Column - a Sculptor's/);
    assert.match(page.text(), /margin 90: Fine 40 \| Superior 52 \| Masterwork 8\. A clean chisel is a step better\./);
    page.button('Craft').onclick();
    assert.match(page.text(), /The chisel \(Stone Column\) - strike the marked line, 7 strikes/);
    const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(0xff), arr) : realRandom(arr));
    try {
      strikes(page, 7);
      await settled();
    } finally { globalThis.crypto.getRandomValues = realRandom; }
    assert.deepEqual([player.items.length, player.furnishings.length], [0, 1], 'among the home\'s things, never the pack');
    const [column] = player.furnishings;
    assert.deepEqual([column.group, column.templateIndex, column.recipe, column.quality, column.maker], ['Furniture', 696, 'column:stone', MASTERWORK, 'Silverthorn']);
    assert.equal(itemLongName(column), 'Silverthorn\'s Stone Column');
    assert.equal(column.value, Math.round(150 * 1.3), 'its worth its quality\'s');
    assert.deepEqual([book.held('stone:cut'), book.held('stone:mortar')], [0, 7], 'twelve Cut Stone and three Mortar');
    assert.equal(player.gold, 850, 'two works and the carving paid the mason');
    assert.match(page.text(), /You made Silverthorn's Stone Column - it waits among your things for a room to stand in/);
  } finally { page.done(); setProfessionsPages(null); }
  // DECOR lists it among "Your things" - its one model, no look to choose
  const column = player.furnishings[0];
  const entry = decorFurnishingEntry(column, 0);
  assert.deepEqual([entry.model, entry.flat, entry.looks, entry.item.t, entry.item.g, entry.item.pv, entry.item.mk, entry.icon.archive], [62315, null, null, 696, 8, column.provenance, 'Silverthorn', 254]);
  const piece = decorPieceOf({ id: 'col1', model: entry.model, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item: { ...entry.item, mk: 'Anyone At All' } });
  assert.ok(piece, 'a free piece of one\'s own');
  const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
  const house = await s.seatHome(mac, { ...HOME, region: 17, price: 42000 });
  assert.equal(house.status, 200);
  const placed = await s.call('/v1/homes/decor/place', { ...HOME, character: house.character, piece }, mac.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const seen = (await s.call('/v1/homes/decor', HOME, ann.secret)).body.pieces.find((p) => p.id === 'col1');
  assert.deepEqual([seen.model, seen.item.t, seen.item.pv, seen.item.mk], [62315, 696, column.provenance, 'Silverthorn'], 'the mark the service\'s own, off its products row');
  assert.equal(decorItemName(seen.item), 'Silverthorn\'s Stone Column', 'a visitor reads the maker\'s mark');
});

// ─── THE PAGE ────────────────────────────────────────────────────────

/** The Stores page over a stub book - the mason's bench where `bench` says, Masonry (the Building track) at `rank` under `specs`. */
function stubPages({ bench = { kind: 'shop', fee: 50 }, rank = 0, specs = { 50: null, 100: null }, held: heldIn = {}, purse = 1000, over = {} } = {}) {
  resetProfPages();
  setPref('gentleActs', false);
  const held = new Map(Object.entries({ 'stone:rough': 9, 'metal:sulphur': 2, 'metal:lead': 2, ...heldIn }));
  const tracks = new Map([['building', { profession: 'building', xp: xpForRank(rank), rank, specs }], ['outfitting', { profession: 'outfitting', xp: 0, rank: 0, specs: { 50: null, 100: null } }]]);   // PIN MOVED (CRAFT3): Masonry's is the Building track
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,   // PIN MOVED (CRAFT3): as the real book's - a discipline asked is its craft's track
    choose: async () => ({ ok: true }),
  };
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), mason: () => bench, purse: () => purse, chiselBand: () => 1,
    smelt: async (r, n, o) => { calls.push(['smelt', r, n, o?.clean ?? null]); return { ok: true, text: 'worked' }; },
    craft: async (r, o) => { calls.push(['craft', r, o.clean]); return { ok: true, text: 'carved' }; },
    ...over,
  });
  return { book, calls, held, tracks };
}

test('PROF11 pages: the Mason\'s Bench at a General Store - the cut and the mix (their inputs, their counts, Mortar\'s rank), the chisel struck on the marked line asks the work clean, one off not, Quick plain; a Quarryman\'s cut two; Gentle acts plain; the purse short; a home\'s bench; away, the word', async () => {
  const { calls } = stubPages();
  const page = pageOf();
  try {
    assert.deepEqual([...PROF_STATIONS], ['forge', 'workbench', 'loom', 'mason', 'jeweller']);   // PIN MOVED (PROF10): the jeweller's bench
    assert.equal(stationColdLine('mason'), MASON_COLD_LINE);
    assert.match(MASON_COLD_LINE, /Masonry is done online, from your Stores page/);
    assert.match(page.text(), /The mason's bench - 50 gold a cut, a mix or a carving\. Building 0 \(Novice\)\./);   // PIN MOVED (CRAFT3): the bench says its craft's track
    assert.match(page.text(), /stone:cut2 stone:rough \(9\)/, 'the cut and its stone held');
    assert.match(page.text(), /stone:mortar x101 metal:sulphur \(2\) \+ 1 metal:lead \(2\) \+ 5 stone:rough \(9\) - rank 10/, 'ten a mix, shut below rank 10');
    assert.deepEqual([masonVerb('cut:stone'), masonVerb('mix:mortar')], ['Cut', 'Mix']);
    assert.equal(page.button('Mix').disabled, true, 'Mortar shut at rank 0');
    // the chisel: four on the mark, clean
    page.qty(0).value = '3'; page.qty(0).oninput();
    page.button('Cut').onclick();
    assert.equal(profActUnderWay(), true);
    assert.equal(page.button('Cut').disabled, true, 'the buttons held while the chisel is struck');
    assert.equal(page.buttons().find((b) => b.textContent === 'Quick').disabled, true);
    assert.equal(page.buttons().find((b) => b.textContent.startsWith('Stone Column')).disabled, true);
    strikes(page, 4);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['smelt', 'cut:stone', 3, true]);
    assert.equal(profActUnderWay(), false);
    // one strike off the mark: not clean
    page.draw();
    page.button('Cut').onclick();
    strikes(page, 4, (a, i) => (i === 2 ? (a.mark + 1) % CHISEL_ACT.lines : a.mark));
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['smelt', 'cut:stone', 3, false]);
    // Quick: no chisel, plain
    page.draw();
    await page.buttons().find((b) => b.textContent === 'Quick').onclick();
    await tick();
    assert.deepEqual(calls.at(-1), ['smelt', 'cut:stone', 3, false]);
    assert.equal(_masonForTests().act, null);
    // Gentle acts: the Cut button works plainly, no chisel - asked at once
    setPref('gentleActs', true);
    page.draw();
    const before = calls.length;
    page.button('Cut').onclick();
    await tick();
    assert.equal(_masonForTests().act, null);
    assert.equal(calls.length, before + 1, 'a plain cut asked at once');
    assert.deepEqual(calls.at(-1), ['smelt', 'cut:stone', 3, false]);
    // Gentle acts switched on under the chisel (the page not drawn since): its end asks the work plain
    setPref('gentleActs', false);
    page.draw();
    page.button('Cut').onclick();
    assert.ok(_masonForTests().act);
    setPref('gentleActs', true);
    strikes(page, 4);
    await tick(); await tick();
    assert.equal(calls.length, before + 2);
    assert.deepEqual(calls.at(-1), ['smelt', 'cut:stone', 3, false], 'every strike true, and still plain');
    setPref('gentleActs', false);
  } finally { page.done(); }
  // a Quarryman's cut: two a cut; the mix open at rank 10
  stubPages({ rank: 50, specs: { 50: 'quarryman', 100: null } });
  const q = pageOf();
  try {
    assert.match(q.text(), /stone:cut x22 stone:rough/);
    assert.equal(q.button('Mix').disabled, false);
    assert.doesNotMatch(q.text(), /- rank 10/);
  } finally { q.done(); }
  // the purse short of the mason's fee: offered nothing
  stubPages({ purse: 10 });
  const poor = pageOf();
  try {
    assert.match(poor.text(), /The mason asks 50 gold a cut, a mix or a carving; you carry 10\./);
    assert.equal(poor.button('Cut').disabled, true);
  } finally { poor.done(); }
  // a home's bench: no fee
  stubPages({ bench: { kind: 'home', fee: 0 } });
  const home = pageOf();
  try { assert.match(home.text(), /Your mason's bench\. Building 0/); } finally { home.done(); }   // PIN MOVED (CRAFT3): the bench says its craft's track
  // away from a bench: the word
  stubPages({ bench: null });
  const away = pageOf();
  try {
    assert.match(away.text(), /Masonry is done at a mason's bench: a General Store's \(50 gold a cut, a mix or a carving\), or your own home's\./);
    assert.equal(away.button('Cut'), null);
  } finally { away.done(); }
  // no Rough Stone: where it comes from
  stubPages({ held: { 'stone:rough': 0 } });
  const none = pageOf();
  try { assert.match(none.text(), /Rough Stone is quarried from the boulders of the rock fields with a Pick-Axe \(Mining\)\./); } finally { none.done(); }
  setProfessionsPages(null);
});

test('PROF11 pages: the chisel\'s keys - the arrows move it a line, a digit sets it and strikes, Space strikes where it is set (a held key\'s repeat nothing); Escape sets it down (nothing spent, said); the stone shut under it lets it go; one act a page - the loom\'s stitch holds the bench', async () => {
  const { calls } = stubPages();
  const page = pageOf();
  try {
    page.button('Cut').onclick();
    let a = _masonForTests().act;
    assert.equal(a.state.at, 2, 'the chisel set on the middle line');
    key({ code: 'ArrowDown' });
    assert.equal(a.state.at, 3);
    key({ code: 'ArrowUp' }); key({ code: 'ArrowLeft' });
    assert.equal(a.state.at, 1);
    key({ code: 'ArrowRight' });
    assert.equal(a.state.at, 2);
    a.tick(0.5);
    a.aim(a.mark === 0 ? 1 : 0);   // the chisel off the mark: the digit must set it
    key({ code: `Digit${a.mark + 1}`, repeat: true });
    assert.equal(a.state.strikes.length, 0, 'a held digit\'s repeat strikes nothing');
    const marked = a.mark;
    key({ code: `Digit${a.mark + 1}` });
    assert.deepEqual([a.state.strikes, a.state.at], [[true], marked], 'a digit sets the chisel on its line and strikes');
    a.tick(0.5);
    a.aim(a.mark);
    key({ code: 'Space', repeat: true });
    assert.equal(a.state.strikes.length, 1, 'a held key\'s repeat strikes nothing');
    key({ code: 'Space' });
    assert.deepEqual(a.state.strikes, [true, true]);
    a.tick(0.5);
    a.aim(a.mark);
    key({ code: 'Enter' });
    assert.deepEqual(a.state.strikes, [true, true, true]);
    a.tick(0.5);
    key({ code: 'Digit9' });
    key({ code: 'Digit6' });
    assert.equal(a.state.strikes.length, 3, 'no sixth line, nor a ninth');
    // Escape: set down, nothing spent
    assert.equal(setDownProfAct(), true);
    assert.deepEqual([_masonForTests().act, _masonForTests().word, profActUnderWay()], [null, CHISEL_DOWN_LINE, false]);
    assert.equal(calls.length, 0, 'nothing asked');
    key({ code: 'Space' });
    assert.equal(calls.length, 0, 'its keys gone with it');
    // Set the chisel down by its own button
    page.draw();
    page.button('Cut').onclick();
    page.button('Set the chisel down').onclick();
    assert.equal(_masonForTests().act, null);
    assert.match(page.text(), /You set the chisel down; nothing is spent\./);
    // the page shut under it: let go on its next frame
    page.button('Cut').onclick();
    a = _masonForTests().act;
    page.done();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(_masonForTests().act, null, 'the stone gone from the page: the chisel let go');
  } finally { page.done(); setProfessionsPages(null); }
  // one act a page: a loom's stitch under way holds the bench (AUDIT 32 P2)
  const stub = stubPages({ held: { 'cloth:linen': 9 }, over: { loom: () => ({ kind: 'home', fee: 0 }), stitchBand: () => 1, clothing: () => 'MensClothing' } });
  stub.tracks.set('outfitting', { profession: 'outfitting', xp: 0, rank: 0, specs: { 50: null, 100: null } });
  const both = pageOf();
  try {
    both.buttons().find((b) => b.textContent === 'Tools').onclick();
    both.buttons().find((b) => b.textContent.startsWith('Fishing-Net')).onclick();
    both.button('Craft').onclick();
    assert.ok(_loomForTests().act, 'the stitch under way');
    both.draw();
    assert.match(both.text(), /Your hands are at the loom - finish there first\./);
    assert.equal(both.button('Cut').disabled, true);
    setDownProfAct();
    // and the other way: the chisel under way holds the loom
    both.draw();
    both.button('Cut').onclick();
    assert.ok(_masonForTests().act);
    both.draw();
    assert.match(both.text(), /Your hands are at the mason's bench - finish there first\./);
    setDownProfAct();
  } finally { both.done(); setProfessionsPages(null); }
});

test('PROF11 pages: the Sculptor\'s stone decor - shut to all but a Sculptor ("a Sculptor\'s"), said where it comes from; a Sculptor\'s Craft strikes seven with the chisel and asks the carving clean, Quick craft plain; its stone short holds Craft; the Professions page: Masonry practised, the Quarryman and the Sculptor chosen, the Builder and the Fortifier waiting on the fortifications, its unlocks by rank', async () => {
  stubPages({ rank: 100, specs: { 50: 'quarryman', 100: 'fortifier' }, held: { 'stone:cut': 20, 'stone:mortar': 5 } });
  const shut = pageOf();
  try {
    assert.match(shut.text(), /Stone decor - a column, a bench, a font, a statue plinth - is carved by a Sculptor \(Masonry's choice at 100\)\./);
    const col = shut.buttons().find((b) => b.textContent.startsWith('Stone Column'));
    assert.match(col.textContent, /a Sculptor's/);
    col.onclick();
    assert.equal(shut.button('Craft').disabled, true, 'a Fortifier carves nothing');
    assert.doesNotMatch(shut.text(), /margin/);
  } finally { shut.done(); }
  const { calls } = stubPages({ rank: 100, specs: { 50: 'quarryman', 100: 'sculptor' }, held: { 'stone:cut': 20, 'stone:mortar': 5 } });
  const open = pageOf();
  try {
    assert.match(open.text(), /Stone decor, carved for a room of your own:/);
    assert.deepEqual(open.buttons().filter((b) => b.className.includes('prof-recipe')).map((b) => b.textContent), [
      'Stone Columncan make now', 'Stone Benchcan make now', 'Stone Fontcan make now', 'Statue Plinthcan make now',
    ]);
    open.buttons().find((b) => b.textContent.startsWith('Stone Font')).onclick();
    assert.match(open.text(), /Stone Font - a Sculptor'sstone:cut 10 \/ 10 \(20 stored\)stone:mortar 3 \/ 3 \(5 stored\)/);
    assert.match(open.text(), /Stone decor goes among your things, to set down in a room of your own \(Decorate\)\./);
    open.button('Craft').onclick();
    assert.equal(_masonForTests().act.state.need, 7, 'a carving\'s seven');
    strikes(open, 7);
    await tick(); await tick();
    assert.deepEqual(calls.at(-1), ['craft', 'font:stone', true]);
    open.draw();
    await open.button('Quick craft').onclick();
    assert.deepEqual(calls.at(-1), ['craft', 'font:stone', false]);
  } finally { open.done(); }
  stubPages({ rank: 100, specs: { 50: null, 100: 'sculptor' }, held: { 'stone:cut': 2, 'stone:mortar': 5 } });
  const short = pageOf();
  try {
    short.buttons().find((b) => b.textContent.startsWith('Stone Column')).onclick();
    assert.match(short.text(), /Stone Columnwants its inputs/);
    assert.equal(short.button('Craft').disabled, true);
  } finally { short.done(); }
  // the Professions page
  stubPages({ rank: 50, specs: { 50: null, 100: null } });
  let root = el('div'); document.body.append(root);
  drawProfessionsPage(root, () => {}, kit);
  [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Building')).onclick();   // PIN MOVED (CRAFT3): Masonry is practised as the Building track's
  root.remove(); root = el('div'); document.body.append(root);
  drawProfessionsPage(root, () => {}, kit);
  const text = root.textContent;
  try {
    assert.doesNotMatch(text, /not practised/);
    const cards = [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-spec'));
    const card = (name) => cards.find((b) => b.textContent.startsWith(name));
    // PIN MOVED (CRAFT3): Building's four a rank, Carpentry's two and Masonry's, each card naming its discipline
    assert.deepEqual(cards.map((c) => [c.querySelector('b')?.textContent, c.querySelector('.prof-of')?.textContent ?? null, c.disabled]), [
      ['Bowyer', 'Carpentry', false], ['Joiner', 'Carpentry', false], ['Quarryman', 'Masonry', false], ['Builder', 'Masonry', false],
      ['Siegewright', 'Carpentry', true], ['Master Joiner', 'Carpentry', true], ['Fortifier', 'Masonry', true], ['Sculptor', 'Masonry', true],
    ], 'at 50: any of the four - PIN MOVED (SEAT2b): the Builder is chosen now');
    assert.doesNotMatch(card('Builder').textContent, /Comes with the fortifications/);
    assert.doesNotMatch(card('Fortifier').textContent, /Comes with the fortifications/);
    // PIN MOVED (CRAFT3): Masonry's unlocks among Carpentry's on the Building track, each named its discipline's, by tier
    const unlocks = [...root.querySelectorAll('.px-stat')].map((r) => r.textContent);
    assert.deepEqual(unlocks.filter((u) => u.startsWith('Masonry: ')), ['Masonry: Cut Stone, from Rough Stonerank 0', 'Masonry: Mortar, from Sulphur, Lead and Rough Stonerank 10']);
    assert.equal(unlocks.every((u) => /^(Carpentry|Masonry): /.test(u)), true, unlocks.join(' | '));
    const ranks = unlocks.map((u) => Number(/rank (\d+)$/.exec(u)?.[1]));
    assert.deepEqual(ranks, [...ranks].sort((x, y) => x - y), 'by tier');
  } finally { root.remove(); setProfessionsPages(null); }
});

// ─── THE ITEMS ───────────────────────────────────────────────────────

test('PROF11 items: Mortar withdraws as 675 - "Mortar", Lodestone\'s lump undyed, a stack; the Sculptor\'s four are registered (696-699) in DFU\'s Furniture group - a carving minted among the home\'s things, its worth its quality\'s, its mark a Masterwork\'s; DECOR stands it as its one model, its list picture the stone\'s; the words', () => {
  const mortar = mintMaterialItem('stone:mortar');
  assert.deepEqual([mortar.templateIndex, mortar.name, mortar.stackCount ?? 1], [675, 'Mortar', 1]);
  assert.equal(materialLabel('stone:mortar'), 'Mortar');
  assert.equal(materialCountLabel('stone:mortar', 10), 'Mortar');
  assert.deepEqual(inventoryItemImage(mortar), inventoryItemImage(mintMaterialItem('stone:cut')), 'the stone\'s lump, drawn as Cut Stone is');
  assert.deepEqual([inventoryItemImage(mortar).archive, inventoryItemImage(mortar).record], [254, 66]);
  assert.deepEqual([templateByIndex(673).name, templateByIndex(674).name, templateByIndex(675).name], ['Rough Stone', 'Cut Stone', 'Mortar']);
  assert.deepEqual([696, 697, 698, 699].map((t) => templateByIndex(t)?.name), ['Stone Column', 'Stone Bench', 'Stone Font', 'Statue Plinth']);
  const plain = mintPiece({ recipe: 'bench:stone', quality: 1, seed: 3, maker: 'Silverthorn' }, PROV);
  assert.deepEqual([plain.group, plain.templateIndex, plain.value, plain.quality, plain.recipe, plain.provenance, plain.maker, plain.marked], ['Furniture', 697, 90, 1, 'bench:stone', PROV, 'Silverthorn', undefined]);
  assert.equal(isCraftedFurniture(plain), true);
  assert.equal(isFurnishing(plain), true, 'delivered, never carried');
  assert.equal(itemLongName(plain), 'Stone Bench', 'a Standard carving carries no mark');
  assert.equal(mintPiece({ recipe: 'bench:stone', quality: 0, seed: 3 }, PROV).value, Math.round(90 * 0.75));
  const fine = mintPiece({ recipe: 'plinth:stone', quality: MASTERWORK, seed: 3, maker: 'Silverthorn' }, PROV);
  assert.deepEqual([fine.value, itemLongName(fine)], [Math.round(60 * 1.3), 'Silverthorn\'s Statue Plinth']);
  assert.equal(mintPiece({ recipe: 'plinth:stone', quality: 2, seed: 3, maker: 'Silverthorn', marked: true }, PROV).marked, true, 'the record\'s mark kept');
  assert.equal(craftedText([plain]), 'You made a Standard Stone Bench - it waits among your things for a room to stand in');
  // DECOR: its one model, no look to choose; DFU's own furniture still chooses its look
  assert.equal(furnishingKinds(plain), null);
  assert.deepEqual(furnishingLooks(plain, [{ key: 'm41100', model: 41100, kind: 'furniture' }]), []);
  const entry = decorFurnishingEntry(plain, 4);
  assert.deepEqual([entry.key, entry.model, entry.flat, entry.looks, entry.name, entry.icon], ['furnish:4', 62322, null, null, 'Stone Bench', { archive: 254, record: 66, dye: null }]);
  const table = mintPiece({ recipe: 'table-small:oak', quality: 1, seed: 3 }, PROV);
  const tableEntry = decorFurnishingEntry(table, 0);
  assert.deepEqual([tableEntry.model, tableEntry.looks, tableEntry.icon], [null, ['furniture'], null], 'a table still chooses its look');
  assert.deepEqual([696, 697, 698, 699].map((t) => decorFurnishingEntry({ group: 'Furniture', templateIndex: t, stackCount: 1 }, 0)?.model), [62315, 62322, 41220, 74091]);
  assert.equal(isFurnishing({ group: 'UselessItems2', templateIndex: 696 }), false, 'only in DFU\'s Furniture group');
  assert.equal(recipeById('column:stone').kind, 'furniture');
  assert.match(MASON_KEPT_TEXT, /The last chip fell, but no word came back/);
});

// ─── THE BOOK AND THE DOOR ───────────────────────────────────────────

test('PROF11 book: a mason\'s work carries the chisel\'s report to the door - `clean` only when true; a lost answer asked again is the same work, its report with it; the door sends `clean` only for a clean report', async () => {
  const asked = [];
  const door = {
    account: () => 'acct-1',
    smelt: async (c, r, n, rid, clean) => { asked.push([r, n, rid, clean]); return asked.length === 1 ? { ok: false, error: 'offline' } : { ok: true, data: { recipe: r, count: n, own: n, bought: 0, xp: 30, first: false, clean, track: null, stores: [] } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => 0, sleep: noWait });
  const lost = await book.smelt('cut:stone', 2, { clean: true });
  assert.equal(lost.ok, true, JSON.stringify(lost));
  assert.deepEqual(asked.map(([r, n, , clean]) => [r, n, clean]), [['cut:stone', 2, true], ['cut:stone', 2, true]], 'asked again by the book\'s own retry');
  assert.equal(asked[0][2], asked[1][2], 'the same id');
  await book.smelt('cut:stone', 2);
  assert.deepEqual(asked.at(-1).slice(0, 2).concat(asked.at(-1)[3]), ['cut:stone', 2, false]);
  // the door: `clean` sent only when true - a work without it posts the body every client before it posted
  assert.match(src('src/net/accountClient.js'), /smelt: \(character, recipe, count, rid, clean = false\) => post\('\/v1\/prof\/smelt', \{ character, recipe, count, rid, \.\.\.\(clean === true \? \{ clean: true \} : \{\}\) \}\),/);
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF11 wiring: the mason\'s bench a General Store\'s (open for trade) or a home\'s station; the world asks a carving and a work at it, the chisel\'s band off STR and END, its report through the book, the XP said as the work\'s profession; the service\'s route reads the report and the refusal\'s status; the pages draw the bench beside the loom', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorBuilding\.buildingType === BUILDING_TYPES\.GeneralStore\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: MASON_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'mason'\)\) return \{ kind: 'home', fee: 0 \};/);
  assert.match(m, /if \(hallMemberHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'mason'\)\) return \{ kind: 'home', fee: 0 \};/);
  const w = src('src/scenes/world.js');
  assert.match(w, /: profession === 'masonry'[^\n]*\n\s*\? \{ here: \(\) => modes\?\.masonHere\?\.\(\) \?\? null, a: 'a mason\\'s bench', who: 'mason', noun: 'mason\\'s bench', kept: MASON_KEPT_TEXT, xp: professionName\('masonry'\) \}/);   // PIN MOVED (AUDIT PROF-541 R2-C2): no station's own busy word; PIN MOVED (CRAFT3): the XP said as the track's name ("Building")
  assert.match(w, /mason: \(\) => modes\?\.masonHere\?\.\(\) \?\? null,/);
  assert.match(w, /chiselBand: \(\) => chiselBand\(\{ strength: liveStat\(playerEntity, 'strength'\), endurance: liveStat\(playerEntity, 'endurance'\) \}\),/);
  assert.match(w, /smelt: async \(recipe, count, \{ clean = false \} = \{\}\) => \{/);
  assert.match(w, /const r = await profBook\.smelt\(recipe, count, \{ clean \}\);/);
  assert.match(w, /const xpWord = professionName\(smeltRecipe\(r\.data\.recipe\)\?\.xp \?\? 'smithing'\);/);
  assert.match(w, /: id\.startsWith\('cut:'\) \? 'Cut' : id\.startsWith\('mix:'\) \? 'Mixed' : alch \? 'Transmuted into' : 'Smelted';/);   // PIN MOVED (PROF12): the Transmuter's word between
  const b = src('src/net/profBook.js');
  assert.match(b, /const r = await ask\(\(\) => door\.smelt\(c, recipe, count, m\.id, clean === true\)\);/);
  const svc = src('server-account/src/professions.js');
  assert.match(svc, /export async function smeltAtForge\(ctx, player, env, \{ character, recipe: id, count, clean = false, rid \} = \{\}\)/);
  assert.match(svc, /if \(!workOpen\(r, rank\)\) return \{ error: 'prof-rank' \};/);
  assert.match(svc, /if \(r\.spec && specs\[100\] !== r\.spec\) return \{ error: 'prof-sculptor' \};/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'prof-sculptor': 403,/);
  assert.match(idx, /POST \/v1\/prof\/smelt \{ character, recipe, count, clean\?, rid \}/);
  assert.doesNotMatch(accountRefusalText('prof-sculptor'), /problem|could not be read/);
  const p = src('src/ui/profPages.js');
  assert.match(p, /drawLoom\(detail, rerender, kit\);   \/\/ PROF7\n\s*drawMasonBench\(detail, rerender, kit\);   \/\/ PROF11/);
  assert.match(src('src/ui/enhancedPlusStyle.js'), /\.prof-chisel-line\.marked \{[^}]*double/, 'the marked line a shape as well as a colour (5.1)');
  assert.match(src('src/scenes/decorTool.js'), /if \(PROF_STATIONS\.includes\(want\) && !forgeOffered\(\)\) \{ deps\.say\?\.\(stationColdLine\(want\)\); return false; \}/, 'the mason\'s bench sold where the bench works, as the forge');
});
