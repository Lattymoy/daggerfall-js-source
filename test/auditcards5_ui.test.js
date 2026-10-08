// AUDIT CARDS-5 (2026-10-08, bible/01-Overview/Audit-Cards-5.md) lane D: THE COLLECTIONS PAGE, driven. The Codex part's
// rows, its whole lines and its counts (the Reforge's own, D12); the switch, the parts shown, the reset and the landing
// (D14); the Cards part's faces painted once a size (D1), its acts kept under the keyboard (D2/D3), an armed Delete
// disarmed by any other press or by leaving (D5), the deck's limits said at the press (D4), the card the binder is short
// of marked (D6), the words after a chip (D7); the menu's wiring (the kit's player, the visit's reset).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as CX from '../src/systems/lootCodex.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { drawCollectionsPage, collectionsPageShown, collectionParts, resetCollectionsPage, setCollectionsPart, disarmCollectionsPage } from '../src/ui/collectionsPage.js';
import { drawCardsPart, resetCardsPart, cardCanvas, _clearCardFacesForTests, copiesAllowed, TILE_H } from '../src/ui/cardBinderPage.js';
import { giveBinder, binderOf, mintIliacCard } from '../src/systems/iliacItems.js';
import { ILIAC_CARDS, STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { ILIAC_DECK_SIZE } from '../src/net/iliacHand.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const legend = (id) => { const rec = LR.legendaryById(id); return Object.assign(LR.applyRarity(createWeapon(rec.templates?.[0] ?? 113, 1), 'legendary', lcg(1), [rec]), { isIdentified: true }); };

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, title: '', value: '', type: '', disabled: false, maxLength: 0,
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k] ?? null; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
const button = (root, label) => all(root, (c) => c.tag === 'button' && c.textContent === label)[0];
function page(player) {
  const box = { root: el('div') };
  const draw = () => { box.root = el('div'); drawCollectionsPage(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), player }); };
  draw();
  return { get root() { return box.root; }, draw };
}

test('AUDIT CARDS-5 D12/D14: the Codex part - every Legendary row, found and not, the Reforge\'s own lines opened whole, the counts, the sets\' counts; the switch, the parts shown, the reset, a landing on a part', () => {
  globalThis.document = undefined;
  _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests();
  CX.noteFind(legend('wyrmbane'), { quiet: true });
  resetCollectionsPage();
  const me = { items: [] };
  assert.equal(collectionsPageShown(me), true, 'Loot rarity: the codex');
  assert.deepEqual(collectionParts(me).map(([id]) => id), ['codex']);
  let p = page(me);
  assert.equal(all(p.root, (c) => c.classList?.contains('coll-parts')).length, 0, 'one part: no switch');
  const rows = CX.codexRows();
  const lines = all(p.root, (c) => c.classList?.contains('codex-line'));
  assert.equal(lines.length, rows.length, 'every Legendary a row');
  const found = lines.find((l) => l.dataset.record === 'wyrmbane');
  assert.ok(found.classList.contains('found'));
  assert.match(found.textContent, /found on day/);
  const unfound = lines.find((l) => !l.classList.contains('found'));
  assert.equal(unfound.children[0].textContent, 'Unfound', 'never its name');
  const n = CX.codexCount();
  assert.ok(all(p.root, (c) => c.tag === 'h4').some((h) => h.textContent === `Legendaries - ${n.legendary} of ${n.legendaries} found`));
  assert.ok(all(p.root, (c) => c.tag === 'h4').some((h) => h.textContent === `Aetheric - ${n.aetheric} of ${n.aetherics} found`));
  assert.ok(all(p.root, (c) => c.classList?.contains('codex-set')).every((s) => /- \d+ of \d+: /.test(s.textContent)), 'each set\'s count');
  // opened whole: the Reforge's lines
  found.onclick();
  const whole = all(p.root, (c) => c.classList?.contains('codex-whole'))[0];
  const r = rows.find((x) => x.id === 'wyrmbane');
  const said = whole.children.map((c) => c.textContent);
  assert.equal(said[0], `Legendary · ${r.group}`);
  assert.ok(said.includes(`First found on day ${CX.foundDay('legendary', 'wyrmbane')}`));
  if (r.lore) assert.ok(said.includes(r.lore));
  all(p.root, (c) => c.dataset?.record === 'wyrmbane')[0].onclick();
  assert.equal(all(p.root, (c) => c.classList?.contains('codex-whole')).length, 0, 'pressed again: closed');
  all(p.root, (c) => c.dataset?.record === unfound.dataset.record)[0].onclick();
  assert.deepEqual(all(p.root, (c) => c.classList?.contains('codex-whole'))[0].children.map((c) => c.textContent).slice(0, 2), [`Legendary · ${unfound.children[1].textContent.split(' · ')[0]}`, 'Not yet found']);
  // a binder: two parts, the switch; a landing on cards; the reset
  giveBinder(me);
  assert.deepEqual(collectionParts(me).map(([id]) => id), ['codex', 'cards']);
  setCollectionsPart('cards');
  p = page(me);
  assert.ok(button(p.root, 'Cards').classList.contains('on'));
  assert.ok(all(p.root, (c) => c.classList?.contains('binder-grid')).length, 'the Cards part drawn');
  button(p.root, 'Codex').onclick();
  assert.ok(button(p.root, 'Codex').classList.contains('on'));
  setCollectionsPart('cards'); resetCollectionsPage();
  assert.ok(button(page(me).root, 'Codex').classList.contains('on'), 'a new visit opens on the first part');
  // Loot rarity off: the cards alone; neither: no page
  setPref('lootRarity', false);
  assert.deepEqual(collectionParts(me).map(([id]) => id), ['cards']);
  assert.equal(collectionsPageShown({ items: [] }), false);
  // the menu's wiring
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /collections: \(d\) => drawCollectionsPage\(d, render, \{ \.\.\.kit, player: playerEntity \}\),/);
  assert.match(menu, /resetHoldingsPages\(\); resetFleetPage\(\); resetCollectionsPage\(\);/);
  assert.match(menu, /else if \(at === 'collections' \|\| at === 'cards' \|\| at === 'codex'\) \{ pauseTab = 'holdings'; holdSec = 'collections'; if \(at !== 'collections'\) setCollectionsPart\(at\); \}/);
  assert.match(menu, /b\.onclick = \(\) => \{ holdSec = id; disarmCollectionsPage\(\); render\(\); \};/);
  assert.match(menu, /disarmFamilyPages\(\); disarmCollectionsPage\(\); pauseTab = id; render\(\);/);
  CX._resetCodexForTests();
});

test('AUDIT CARDS-5 D1-D7 and lane D\'s survivors: the Cards part - faces painted once a size, every act a focus key, an armed Delete disarmed by any other press and by leaving, the deck\'s limits at the press, the binder\'s shortfall marked, the words after a chip, the filter, the counts', () => {
  globalThis.document = undefined;
  _resetForTests();
  resetCardsPart();
  const me = { items: [] };
  giveBinder(me);
  const box = { root: el('div') };
  const draw = () => { box.root = el('div'); drawCardsPart(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), player: me }); };
  draw();
  const r = () => box.root;
  // the counts and the filter
  const held = new Set(STARTER_DECK);
  assert.ok(all(r(), (c) => c.tag === 'h4').some((h) => h.textContent === `Collection - ${held.size} of ${ILIAC_CARDS.length} cards (${STARTER_DECK.length} held)`));
  button(r(), 'Princes').onclick();
  assert.ok(all(r(), (c) => c.classList?.contains('binder-tile')).every((t) => cardById(t.dataset.card).kind === 'prince'));
  assert.ok(button(r(), 'Princes').classList.contains('on'));
  button(r(), 'All').onclick();
  const tile = (id) => all(r(), (c) => c.dataset?.card === id && c.classList.contains('binder-tile'))[0];
  assert.equal(tile(STARTER_DECK[0]).children.find((c) => c.classList?.contains('binder-count')).textContent, `×${STARTER_DECK.filter((x) => x === STARTER_DECK[0]).length}`);
  const unheld = ILIAC_CARDS.find((c) => !held.has(c.id));
  tile(unheld.id).onclick();
  assert.match(all(r(), (c) => c.classList?.contains('binder-said'))[0].textContent, /You hold no/);
  assert.ok(tile(unheld.id).classList.contains('on'), 'the pressed one marked');
  // every act a focus key
  for (const b of all(r(), (c) => c.tag === 'button')) assert.ok(b.getAttribute('data-focus'), `${b.textContent} keeps the keyboard`);
  // two decks; the second's Delete armed is disarmed by another press, by leaving, and never shifts to the next deck
  const binder = binderOf(me.items);
  binder.decks = [...binder.decks, { name: 'Two', cards: STARTER_DECK.slice() }];
  draw();
  const deleteOf = (i) => all(r(), (c) => c.getAttribute?.('data-focus') === `binder-deck-drop-${i}`)[0];
  deleteOf(0).onclick();
  assert.equal(deleteOf(0).textContent, 'Delete it');
  button(r(), 'Units').onclick();
  assert.equal(deleteOf(0).textContent, 'Delete', 'another press disarms');
  deleteOf(0).onclick();
  disarmCollectionsPage(); draw();
  assert.equal(deleteOf(0).textContent, 'Delete', 'leaving disarms');
  deleteOf(0).onclick(); deleteOf(0).onclick();
  assert.deepEqual(binder.decks.map((d) => d.name), ['Two']);
  assert.equal(deleteOf(0).textContent, 'Delete', 'the next deck never armed by the shift');
  button(r(), 'All').onclick();
  // the builder: thirty at most, a card's copies, the binder's shortfall, the words after a chip, cancel
  button(r(), 'New deck').onclick();
  assert.ok(all(r(), (c) => c.getAttribute?.('data-focus') === 'binder-deck-name')[0].maxLength > 0);
  const extra = ILIAC_CARDS.filter((c) => copiesAllowed(c) === 2 && c.kind === 'unit').slice(0, 20);
  for (const c of extra) { me.items.push(mintIliacCard(c.id, 3)); }
  draw();
  const three = extra[0];
  tile(three.id).onclick(); tile(three.id).onclick(); tile(three.id).onclick();
  assert.match(all(r(), (c) => c.classList?.contains('binder-said'))[0].textContent, /at most 2 of one card/);
  for (const c of extra) { tile(c.id).onclick(); tile(c.id).onclick(); }
  assert.match(all(r(), (c) => c.classList?.contains('px-qverdict'))[0].textContent, new RegExp(`Building - ${ILIAC_DECK_SIZE} of ${ILIAC_DECK_SIZE}`));
  tile(extra.at(-1).id).onclick();
  assert.match(all(r(), (c) => c.classList?.contains('binder-said'))[0].textContent, /The deck is full/);
  const chip = all(r(), (c) => c.classList?.contains('binder-chip'))[0];
  chip.onclick();
  assert.match(all(r(), (c) => c.classList?.contains('binder-said'))[0].textContent, /out of the deck \(29 of 30\)/);
  button(r(), 'Cancel').onclick();
  assert.equal(all(r(), (c) => c.classList?.contains('binder-edit')).length, 0, 'cancelled');
  // the shortfall marked: a deck naming more than the binder holds
  const missing = ILIAC_CARDS.find((c) => !held.has(c.id) && !extra.includes(c));
  binder.decks = [{ name: 'Short', cards: [...STARTER_DECK.slice(0, 29), missing.id] }];
  draw();
  all(r(), (c) => c.getAttribute?.('data-focus') === 'binder-deck-edit-0')[0].onclick();
  const short = all(r(), (c) => c.classList?.contains('binder-chip') && c.classList.contains('short'));
  assert.equal(short.length, 1);
  assert.match(short[0].textContent, /\(0 held\)/);
  assert.equal(button(r(), 'Keep deck').disabled, true);
  // a face painted once a size
  _clearCardFacesForTests();
  let made = 0;
  const doc = { createElement: () => { made++; return { getContext: () => null, ownerDocument: doc }; } };
  doc.createElement = () => { made++; const c = { getContext: () => null }; c.ownerDocument = doc; return c; };
  const c1 = cardCanvas(doc, cardById(STARTER_DECK[0]), TILE_H), c2 = cardCanvas(doc, cardById(STARTER_DECK[0]), TILE_H);
  assert.equal(c1, c2);
  assert.equal(made, 1, 'painted once');
  cardCanvas(doc, cardById(STARTER_DECK[0]), 371);
  assert.equal(made, 2, 'another size, another face');
  resetCardsPart();
});

test('AUDIT CARDS-5 D3: a press that takes its own button away hands the keyboard on - New deck to the name, Keep to the deck kept, Cancel back where it came from', () => {
  globalThis.document = undefined;
  _resetForTests();
  resetCardsPart();
  const me = { items: [] };
  giveBinder(me);
  let focused = null;
  const box = { root: null };
  const doc = { querySelector: (sel) => { const k = /^\[data-focus="(.+)"\]$/.exec(sel)?.[1]; return all(box.root, (c) => c.getAttribute?.('data-focus') === k)[0] ?? null; } };
  const el2 = (t, cls, text) => { const n = el(t, cls, text); n.ownerDocument = doc; n.focus = () => { focused = n; }; return n; };
  const draw = () => { box.root = el2('div'); drawCardsPart(box.root, draw, { el: el2, divider: (t) => el2('h4', 'px-divider', t), player: me }); };
  draw();
  const key = () => focused?.getAttribute('data-focus') ?? null;
  const at = (k) => all(box.root, (c) => c.getAttribute?.('data-focus') === k)[0];
  const decks = () => all(box.root, (c) => /^binder-deck-edit-\d+$/.test(c.getAttribute?.('data-focus') ?? '')).length;
  const n0 = decks();
  at('binder-deck-new').onclick();
  assert.equal(key(), 'binder-deck-name', 'New deck: the keyboard on the new deck\'s name');
  at('binder-deck-cancel').onclick();
  assert.equal(key(), 'binder-deck-new', 'Cancel on a new deck: back to New deck');
  at('binder-deck-edit-0').onclick();
  focused = null;
  at('binder-deck-cancel').onclick();
  assert.equal(key(), 'binder-deck-edit-0', 'Cancel on a deck: back to its Edit');
  at('binder-deck-edit-0').onclick();
  focused = null;
  at('binder-deck-keep').onclick();
  assert.equal(key(), 'binder-deck-edit-0', 'Keep: the deck kept');
  assert.equal(decks(), n0);
});

test('AUDIT CARDS-5 lane D\'s survivors (second pass): the Collections page - a landing on a part not shown falls back to one that is; an unfound row says where it is said to be; a found one opened whole says its power; an unfound set piece is never named; the reset closes the row and forgets the Cards part', () => {
  globalThis.document = undefined;
  _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests();
  CX.noteFind(legend('wyrmbane'), { quiet: true });
  resetCollectionsPage();
  const me = { items: [] };
  // no binder: a landing on cards opens the codex
  setCollectionsPart('cards');
  let p = page(me);
  assert.ok(all(p.root, (c) => c.classList?.contains('codex-line')).length > 0, 'the codex drawn');
  assert.equal(all(p.root, (c) => c.textContent === 'No Card Binder carried.').length, 0);
  // an unfound row: its group and its hint
  const rows = CX.codexRows();
  const u = rows.find((r) => !r.found && r.hint);
  const uline = all(p.root, (c) => c.dataset?.record === u.id)[0];
  assert.equal(uline.children[1].textContent, `${u.group} · ${u.hint}`);
  // a found one opened whole: its power
  const w = rows.find((r) => r.id === 'wyrmbane');
  assert.ok(LR.powerLine(w.power));
  all(p.root, (c) => c.dataset?.record === 'wyrmbane')[0].onclick();
  assert.ok(all(p.root, (c) => c.classList?.contains('codex-whole'))[0].children.some((c) => c.textContent === LR.powerLine(w.power)), 'its power said');
  // an unfound set piece: '?'
  const unfoundPieces = all(p.root, (c) => c.classList?.contains('unfound'));
  assert.ok(unfoundPieces.length > 0);
  assert.ok(unfoundPieces.every((s) => s.textContent === '?'), 'never its name or id');
  // the reset: the row closed
  resetCollectionsPage();
  p = page(me);
  assert.equal(all(p.root, (c) => c.classList?.contains('codex-whole')).length, 0, 'the row closed');
  // the reset: the Cards part forgotten too
  giveBinder(me);
  setCollectionsPart('cards');
  p = page(me);
  button(p.root, 'Princes').onclick();
  assert.ok(button(p.root, 'Princes').classList.contains('on'));
  resetCollectionsPage(); setCollectionsPart('cards');
  p = page(me);
  assert.ok(button(p.root, 'All').classList.contains('on'), 'the filter forgotten');
  resetCollectionsPage();
  CX._resetCodexForTests();
});

test('AUDIT CARDS-5 lane D\'s survivors (second pass): the Cards part - the decks\' head and count, twelve at most, a new deck named, its name cut, the reset forgets an open builder and an armed Delete, a card not held or every copy in says so, the chips by cost, a face at the screen\'s pixel ratio', async () => {
  const { BINDER_DECKS_MAX, DECK_NAME_MAX, binderDecks } = await import('../src/systems/iliacItems.js');
  globalThis.document = undefined;
  _resetForTests();
  resetCardsPart();
  const me = { items: [] };
  giveBinder(me);
  const binder = binderOf(me.items);
  const box = { root: el('div') };
  const draw = () => { box.root = el('div'); drawCardsPart(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), player: me }); };
  const r = () => box.root;
  const focus = (k) => all(r(), (c) => c.getAttribute?.('data-focus') === k)[0];
  const said = () => all(r(), (c) => c.classList?.contains('binder-said'))[0]?.textContent;
  const tile = (id) => all(r(), (c) => c.dataset?.card === id && c.classList.contains('binder-tile'))[0];
  draw();
  // the head and a ready deck's count
  const decks = binderDecks(binder);
  assert.ok(decks.length >= 1);
  assert.ok(all(r(), (c) => c.tag === 'h4').some((h) => h.textContent === `Decks - ${decks.length} of ${BINDER_DECKS_MAX}`));
  const ok = all(r(), (c) => c.classList?.contains('binder-deck'))[0].children.find((c) => c.classList?.contains('ok'));
  assert.equal(ok.textContent, `${decks[0].cards.length} cards - ready`);
  // the reset: an armed Delete disarmed, an open builder closed
  focus('binder-deck-drop-0').onclick();
  assert.equal(focus('binder-deck-drop-0').textContent, 'Delete it');
  resetCardsPart(); draw();
  assert.equal(focus('binder-deck-drop-0').textContent, 'Delete', 'the reset disarms');
  focus('binder-deck-new').onclick();
  assert.equal(all(r(), (c) => c.classList?.contains('binder-edit')).length, 1);
  resetCardsPart(); draw();
  assert.equal(all(r(), (c) => c.classList?.contains('binder-edit')).length, 0, 'the reset closes the builder');
  // a new deck: named after its place; a long name cut as typed
  focus('binder-deck-new').onclick();
  assert.equal(focus('binder-deck-name').value, `Deck ${decks.length + 1}`);
  focus('binder-deck-name').value = 'n'.repeat(80);
  focus('binder-deck-name').oninput();
  draw();
  assert.equal(focus('binder-deck-name').value, 'n'.repeat(DECK_NAME_MAX), 'the name cut where it is typed');
  // a card not held; a card's every copy in
  const held = new Set(STARTER_DECK);
  const unheld = ILIAC_CARDS.find((c) => !held.has(c.id) && copiesAllowed(c) === 2);
  tile(unheld.id).onclick();
  assert.equal(said(), `Your binder holds no ${unheld.name}.`);
  me.items.push(mintIliacCard(unheld.id, 1));
  draw();
  tile(unheld.id).onclick();
  assert.match(all(r(), (c) => c.classList?.contains('px-qverdict'))[0].textContent, /Building - 1 of /);
  tile(unheld.id).onclick();
  assert.equal(said(), `Your binder's 1 copy of ${unheld.name} is in this deck.`);
  assert.match(all(r(), (c) => c.classList?.contains('px-qverdict'))[0].textContent, /Building - 1 of /, 'not past the binder\'s one');
  focus('binder-deck-cancel').onclick();
  // the chips: cheapest first, whatever the deck's order
  const byCost = new Map();
  for (const id of STARTER_DECK) { const c = cardById(id); if (!byCost.has(c.cost)) byCost.set(c.cost, id); }
  const costs = [...byCost.keys()].sort((a, b) => b - a);
  assert.ok(costs.length >= 2);
  binder.decks = [{ name: 'Down', cards: costs.map((k) => byCost.get(k)) }];
  draw();
  focus('binder-deck-edit-0').onclick();
  assert.deepEqual(all(r(), (c) => c.classList?.contains('binder-chip')).map((c) => c.dataset.card), [...costs].reverse().map((k) => byCost.get(k)));
  focus('binder-deck-cancel').onclick();
  // twelve decks: no New deck; eleven: one
  binder.decks = Array.from({ length: BINDER_DECKS_MAX - 1 }, (_, i) => ({ name: `D${i}`, cards: [] }));
  draw();
  assert.ok(focus('binder-deck-new'));
  binder.decks = Array.from({ length: BINDER_DECKS_MAX }, (_, i) => ({ name: `D${i}`, cards: [] }));
  draw();
  assert.equal(focus('binder-deck-new'), undefined, 'a full binder: no New deck');
  // a face at the screen's pixel ratio, two at most
  _clearCardFacesForTests();
  const doc = { createElement: () => { const c = { getContext: () => null }; c.ownerDocument = doc; return c; } };
  const was = globalThis.devicePixelRatio;
  try {
    globalThis.devicePixelRatio = 2;
    assert.equal(cardCanvas(doc, cardById(STARTER_DECK[0]), TILE_H).height, 2 * TILE_H);
    _clearCardFacesForTests();
    globalThis.devicePixelRatio = 3;
    assert.equal(cardCanvas(doc, cardById(STARTER_DECK[1]), TILE_H).height, 2 * TILE_H);
  } finally {
    if (was === undefined) delete globalThis.devicePixelRatio; else globalThis.devicePixelRatio = was;
    _clearCardFacesForTests();
  }
  resetCardsPart();
});
