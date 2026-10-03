// PICKUP-FEED - WHAT A PRESS PUT IN THE PACK, AS CARDS AT THE CENTRE OF THE SCREEN, DRIVEN.
//
// (2026-10-01, Mac: "a better center screen notification for pickups".) A quick-loot take said a line - "You take the
// Longsword.", "You take 3 items." - and named nothing in a take-all. On the enhanced skin each thing that moved is a
// card under the crosshair (ui/pickupFeed.js); on the classic skin Daggerfall's line is said exactly as before; a
// refusal is said on both. This file drives the queue's law, the layout's arithmetic, the take's seam (`took`), the DOM
// face over a document just big enough to hold it, its watchdog, its teardown, and the four hosts' wiring. Every law
// below has its mutant in tools/mutants/pickupfeed.json.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createPickupQueue, pickupEntry, pickupCardText, pickupCountText, pickupFeedLayout, showPickups, destroyPickupFeed,
  clearPickupFeed, _setPickupFeedForTests, _pickupFeedLines, PICKUP_FEED_MAX, PICKUP_FEED_HOLD_MS, PICKUP_FEED_FADE_MS,
  PICKUP_FEED_ID, PICKUP_FEED_STYLE_ID, PICKUP_FEED_CSS, PICKUP_KEEP_ABOVE, PICKUP_KEEP_BELOW, PICKUP_WATCHDOG_MS,
  PICKUP_ICON_BOX,
} from '../src/ui/pickupFeed.js';
import { quickLootTake, tookItemText, foldQuickLoot, resetQuickLoot, quickLootArm, QUICK_LOOT_REFUSED } from '../src/systems/quickLoot.js';
import { hoverLines } from '../src/systems/worldHover.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { CANNOT_CARRY_TEXT } from '../src/systems/itemTransfer.js';
import { itemNameParts } from '../src/systems/itemInfo.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { destroyWorldPlaque, hideWorldPlaque } from '../src/ui/worldPlaque.js';
import { _frameForTests, DRAW_FRAMES_UNDRAWN } from '../src/ui/drawWatchdog.js';
import { PIXEL_STACK } from '../src/ui/pixelifyFive.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// ── FIXTURES ─────────────────────────────────────────────────────

const gold = (n) => ({ name: 'Gold', group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: n });
const item = (name, extra = {}) => ({ name, group: 'Weapons', templateIndex: 121, ...extra });
const player = (strength = 50) => ({ items: [], goldPieces: 0, stats: { strength } });
const hooks = (items) => ({ items: () => items });
const frameOf = (key, items) => {
  const { shown, rest, empty } = hoverLines(items);
  return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
};
function withQuickLoot(fn) {
  setPref('quickLoot', true);
  resetQuickLoot();
  try { return fn(); } finally { resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
}
/** One entry the way the face mints it - the key, the count, the word. */
const entry = (key, count = 1, extra = {}) => ({ key, name: key, rarity: null, gold: false, count, ...extra });

// ── A DOCUMENT, JUST ENOUGH OF ONE ───────────────────────────────

function fakeEl(tag, doc) {
  const classes = new Set();
  const props = {};
  const n = {
    tag, doc, children: [], dataset: {}, attrs: {}, parent: null,
    style: { setProperty(k, v) { props[k] = String(v); }, getPropertyValue: (k) => props[k] ?? '' },
    props,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on = !classes.has(c)) => { if (on) classes.add(c); else classes.delete(c); return on; },
      contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n._text = v == null ? '' : String(v); },
    get firstElementChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent?.children && c.parent !== n && c.remove(); if (c.parent === n) n.children.splice(n.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) {
      if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1);
      c.parent = n;
      const i = ref ? n.children.indexOf(ref) : -1;
      if (i < 0) n.children.push(c); else n.children.splice(i, 0, c);
      return c;
    },
    replaceChildren(...cs) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n.append(...cs); },
    remove() { if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; } n.removed = true; },
    setAttribute(k, v) { n.attrs[k] = v; },
    getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0 }),
  };
  return n;
}
/** A document with a body and a head that keep their children, an id lookup over what was appended, and a selector
 *  answer the test may set (`doc.rects[selector] = { top, bottom, height }`). */
function fakeDocument() {
  const made = [];
  const doc = { made, rects: {} };
  doc.createElement = (t) => { const e = fakeEl(t, doc); made.push(e); return e; };
  doc.body = fakeEl('body', doc);
  doc.head = fakeEl('head', doc);
  const all = () => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.getElementById = (id) => all().find((e) => e.id === id) ?? null;
  doc.querySelector = (sel) => {
    const r = doc.rects[sel];
    if (!r) return null;
    const e = fakeEl('div', doc);
    e.textContent = r.text ?? 'x';
    e.getBoundingClientRect = () => ({ top: r.top, bottom: r.bottom, height: r.bottom - r.top, width: 100, left: 0, right: 100 });
    return e;
  };
  return doc;
}

/** The enhanced skin (or the classic) over a fake page, the feed's clock and frames in the test's hands. */
function withPage(fn, { skin = 'enhanced' } = {}) {
  const doc = fakeDocument();
  const frames = [];
  let now = 0;
  globalThis.document = doc;
  globalThis.location = { search: `?skin=${skin}` };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;
  destroyPickupFeed();
  _setPickupFeedForTests({ now: () => now, raf: (f) => { frames.push(f); return frames.length; }, icon: () => null });
  const ctl = {
    doc,
    set now(v) { now = v; }, get now() { return now; },
    /** Run the frames that are queued (the ticker queues the next one as it runs). */
    frame() { const fs = frames.splice(0); for (const f of fs) f(); },
    queued: () => frames.length,
    feed: () => doc.getElementById(PICKUP_FEED_ID),
    cards: () => ctl.feed()?.children ?? [],
  };
  try { return fn(ctl); } finally {
    destroyPickupFeed();
    _setPickupFeedForTests({ now: null, raf: (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : null),
      schedule: (f, ms) => (typeof setTimeout === 'function' ? setTimeout(f, ms) : null),
      cancel: (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); }, icon: null });
    delete globalThis.document; delete globalThis.location; delete globalThis.innerWidth; delete globalThis.innerHeight;
  }
}
/** Every node under `n` carrying the class. */
function find(n, cls, out = []) {
  if (n?.classList?.contains?.(cls)) out.push(n);
  for (const c of n?.children ?? []) find(c, cls, out);
  return out;
}
const cardText = (c) => c.textContent;

// ── THE QUEUE'S LAW ──────────────────────────────────────────────

test('PICKUP-FEED: the same thing taken again while its card stands BUMPS the count - one card, its clock restarted, moved to the front (mutants: a second card; the count not added; the clock not restarted)', () => {
  const q = createPickupQueue();
  q.push([entry('Longsword')], 0);
  q.push([entry('Arrow', 24)], 100);
  assert.deepEqual(q.standing(200).map((l) => [l.key, l.count]), [['Arrow', 24], ['Longsword', 1]], 'the newest nearest the centre');
  q.push([entry('Longsword')], 2000);
  const lines = q.standing(2000);
  assert.equal(lines.length, 2, 'a bump, not a third card');
  assert.deepEqual(lines.map((l) => [l.key, l.count]), [['Longsword', 2], ['Arrow', 24]], 'counted, and the newest again');
  assert.equal(lines[0].bumps, 1);
  // the bump restarted its clock: at 2000 + the hold it is fading, not at 0 + the hold (the arrows are long gone by then)
  assert.equal(q.standing(PICKUP_FEED_HOLD_MS + 1000).find((l) => l.key === 'Longsword').fading, false, 'the bump restarted its clock');
  q.tick(PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS + 100);
  assert.deepEqual(q.standing(PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS + 100).map((l) => l.key), ['Longsword'], 'the arrows went on their own clock');
});

test('PICKUP-FEED: a card holds, then fades, then is gone - and a pickup after it has gone is a NEW card (mutants: no fade; never gone; a bump of a card already expired)', () => {
  const q = createPickupQueue();
  q.push([entry('Ruby')], 0);
  assert.equal(q.standing(PICKUP_FEED_HOLD_MS - 1)[0].fading, false, 'full strength through the hold');
  assert.equal(q.standing(PICKUP_FEED_HOLD_MS)[0].fading, true, 'fading once the hold is spent');
  assert.equal(PICKUP_FEED_HOLD_MS, 2500, 'about two and a half seconds (Mac\'s ask)');
  assert.equal(q.tick(PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS - 1), false, 'still there through the fade');
  assert.equal(q.size, 1);
  assert.equal(q.tick(PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS), true, 'and gone at its end');
  assert.equal(q.size, 0);
  // the same thing again, later: a fresh card from one
  q.push([entry('Ruby')], 5000);
  q.push([entry('Ruby')], 5000 + PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS);
  const l = q.standing(5000 + PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS);
  assert.deepEqual(l.map((x) => x.count), [1], 'a card that has gone is not bumped back');
  // ...and a FADING card is bumped back to full strength
  q.push([entry('Ruby')], 5000 + 2 * (PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS) - 100);
  const back = q.standing(5000 + 2 * (PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS) - 100)[0];
  assert.deepEqual([back.count, back.fading], [2, false], 'a fading card is bumped, and stands again');
});

test('PICKUP-FEED: four cards at most - the oldest goes past four; a press\'s pickups go in as a block, in the order taken, the first nearest the centre; two of one thing in a press are one card (mutants: no cap; the block reversed; a press\'s twins as two cards)', () => {
  const q = createPickupQueue();
  assert.equal(PICKUP_FEED_MAX, 4);
  q.push([entry('A')], 0);
  q.push([entry('B')], 10);
  q.push([entry('C'), entry('D'), entry('C', 2)], 20);
  assert.deepEqual(q.standing(30).map((l) => [l.key, l.count]), [['C', 3], ['D', 1], ['B', 1], ['A', 1]], 'the press in its order, ahead of the older cards; its two Cs one card');
  q.push([entry('E')], 40);
  assert.deepEqual(q.standing(50).map((l) => l.key), ['E', 'C', 'D', 'B'], 'past four, the oldest goes');
  assert.equal(q.push([], 60), false, 'nothing taken is nothing pushed');
  assert.equal(q.push([null, entry('F', 0)], 60), false, 'and nothing countable is nothing');
});

// ── ONE PICKUP, AS A CARD'S DATA ─────────────────────────────────

test('PICKUP-FEED: a card says what the plaque\'s row and the take\'s line say - the name part, its tier, "x3" past one, gold as "+N Gold"; the icon is the pack\'s own address (mutants: the count shown for one; gold counted as an item; the name not the row\'s)', () => {
  setPref(LOOT_RARITY_KEY, true);
  try {
    const sword = item('Longsword', { templateIndex: 115 });
    const e = pickupEntry(sword, 1);
    assert.equal(e.name, itemNameParts(sword).name, 'the row\'s own word');
    assert.equal(tookItemText(sword), `You take the ${e.name}.`, 'the word the classic line says');
    assert.equal(pickupCardText(e), `+${e.name}`);
    assert.equal(pickupCountText(e), '', 'one is not counted');
    assert.equal(pickupCountText(pickupEntry(sword, 3)), '×3', 'three is');
    assert.deepEqual(e.image, inventoryItemImage(sword), 'the icon address is the pack\'s (inventoryItemImage)');
    const g = pickupEntry(gold(120), 120);
    assert.deepEqual([g.key, g.gold, pickupCardText(g), pickupCountText(g)], ['gold', true, '+120 Gold', ''], 'gold is "+N Gold"');
    const rare = pickupEntry(item('Stormcaller', { rarity: 'rare', identified: true }), 1);
    assert.equal(rare.rarity, 'rare', 'the tier the plaque\'s row wears');
    assert.notEqual(rare.key, pickupEntry(item('Stormcaller'), 1).key, 'a tier is part of what makes two pickups one');
    assert.equal(pickupEntry(null, 1), null);
    assert.equal(pickupEntry(sword, 0), null, 'nothing moved is no card');
  } finally { setPref(LOOT_RARITY_KEY, PREF_DEFAULTS[LOOT_RARITY_KEY]); }
});

// ── WHERE IT STANDS ──────────────────────────────────────────────

test('PICKUP-FEED: the feed stands on the mid-screen line when the band allows; a tall stack rises toward what stands above rather than into the HUD; a short band shows the newest cards; one always shows (mutants: the line ignored; the stack run into the HUD; above the plaque)', () => {
  const card = { cardH: 30, cardGap: 3 };
  assert.deepEqual(pickupFeedLayout({ base: 584, upper: 450, lower: 690, count: 2, ...card }), { top: 584, shown: 2 }, 'room under the line: on it');
  assert.deepEqual(pickupFeedLayout({ base: 584, upper: 600, lower: 760, count: 2, ...card }), { top: 600, shown: 2 }, 'a plaque reaching past the line: under the plaque');
  const tall = pickupFeedLayout({ base: 584, upper: 450, lower: 690, count: 4, ...card });
  assert.equal(tall.shown, 4);
  assert.equal(tall.top, 690 - (4 * 30 + 3 * 3), 'four cards rise to end on the band\'s foot');
  const short = pickupFeedLayout({ base: 584, upper: 620, lower: 690, count: 4, ...card });
  assert.equal(short.top, 620, 'never above what stands under the crosshair');
  assert.equal(short.shown, 2, 'and only as many cards as the band holds');
  assert.equal(pickupFeedLayout({ base: 584, upper: 700, lower: 690, count: 4, ...card }).shown, 1, 'one always shows');
  assert.deepEqual(pickupFeedLayout({ base: 584, upper: 450, count: 4, ...card }), { top: 584, shown: 4 }, 'no foot: the line');
});

test('PICKUP-FEED: the keep-outs name the surfaces they mean - the plaque, its stats, the act\'s panel above; the HUD\'s bottom block and the prompt below (a renamed class fails here, not on a screen)', () => {
  assert.deepEqual([...PICKUP_KEEP_ABOVE], ['.wplaque.on', '.wplaque.on .wplaque-stats', '.prof-meter:not([hidden])']);
  assert.deepEqual([...PICKUP_KEEP_BELOW], ['.hud .hud-bottom', '.prof-prompt']);
  const plaque = rd('src/ui/worldPlaque.js');
  assert.match(plaque, /node\.className = 'wplaque';/);
  assert.match(plaque, /n\.classList\.add\('on'\);/);
  assert.match(plaque, /panel\.className = 'wplaque-stats';/);
  const prof = rd('src/ui/profHud.js');
  assert.match(prof, /mk\('prof-meter'\)/);
  assert.match(prof, /mk\('prof-prompt'\)/);
  assert.match(prof, /meter\.hidden = true;/);
  assert.match(rd('src/ui/enhancedHud.js'), /hud-bottom/);
});

// ── THE TAKE'S SEAM ──────────────────────────────────────────────

test('PICKUP-FEED: a take whose face SHOWED it says no line - the face is handed what moved and whose pack it went to; a face that did not show it (the classic skin) leaves the line said exactly as before (mutants: the line said over the cards; the face never asked; the classic line lost)', () => withQuickLoot(() => {
  const p = player();
  let items = [item('Longsword')];
  foldQuickLoot(frameOf('pile:1', items));
  const said = [];
  const got = [];
  const moved = quickLootTake('pile:1', hooks(items), p, (l) => said.push(l), { took: (m, who) => { got.push([m, who]); return true; } });
  assert.equal(moved.name, 'Longsword');
  assert.deepEqual(said, [], 'the card is the take\'s words');
  assert.equal(got.length, 1);
  assert.deepEqual(got[0][0].map((m) => [m.item.name, m.count]), [['Longsword', 1]]);
  assert.equal(got[0][1], p, 'the pack it went to (the icon\'s wearer)');
  // the classic skin's face answers false: the line, word for word
  items = [item('Longsword')];
  foldQuickLoot(frameOf('pile:2', items));
  quickLootTake('pile:2', hooks(items), p, (l) => said.push(l), { took: () => false });
  assert.deepEqual(said, ['You take the Longsword.']);
  // no face at all: the line
  items = [item('Shield')];
  foldQuickLoot(frameOf('pile:3', items));
  quickLootTake('pile:3', hooks(items), p, (l) => said.push(l));
  assert.deepEqual(said, ['You take the Longsword.', 'You take the Shield.']);
}));

test('PICKUP-FEED: a face that THROWS loses the press nothing - the item moves and the line is said (mutant: the throw escapes into the host\'s frame)', () => withQuickLoot(() => {
  const p = player();
  const items = [item('Ruby')];
  foldQuickLoot(frameOf('pile:1', items));
  const said = [];
  const warn = console.warn;
  console.warn = () => {};
  try {
    const moved = quickLootTake('pile:1', hooks(items), p, (l) => said.push(l), { took: () => { throw new Error('no document'); } });
    assert.equal(moved?.name, 'Ruby');
  } finally { console.warn = warn; }
  assert.deepEqual(said, ['You take the Ruby.']);
  assert.equal(p.items.length, 1);
}));

test('PICKUP-FEED: a take-all hands the face every row in the order it moved, gold at the plan\'s amount; shown, the count line goes and the REFUSAL is still said alone; refused whole, the face is never asked (mutants: the refusal swallowed with the count; gold counted at what stayed; the face shown a refusal)', () => withQuickLoot(() => {
  // strength 2: 3 kg - one Katana (2.5 kg) fits, the second does not; the gold weighs next to nothing
  const p = player(2);
  const items = [gold(9), item('Katana'), item('Katana')];
  foldQuickLoot(frameOf('pile:1', items));
  assert.equal(quickLootArm('QuickLootAll'), true);
  const said = [];
  let handed = null;
  assert.ok(quickLootTake('pile:1', hooks(items), p, (l) => said.push(l), { took: (m) => { handed = m; return true; } }));
  assert.deepEqual(handed.map((m) => [m.item.name, m.count]), [['Gold', 9], ['Katana', 1]], 'what moved, in order');
  assert.deepEqual(said, [CANNOT_CARRY_TEXT], 'the cards say the count; the line says why the rest stayed');
  // nothing stayed: nothing said at all (an empty say would blank the line)
  const q = player();
  const lot = [item('Axe'), item('Mace')];
  foldQuickLoot(frameOf('pile:2', lot));
  quickLootArm('QuickLootAll');
  const quiet = [];
  quickLootTake('pile:2', hooks(lot), q, (l) => quiet.push(l), { took: () => true });
  assert.deepEqual(quiet, [], 'a clean take-all says nothing over its cards');
  // refused whole: no face, the refusal, the press handled
  foldQuickLoot(frameOf('pile:1', items));
  quickLootArm('QuickLootAll');
  let asked = false;
  const r = quickLootTake('pile:1', hooks(items), p, (l) => said.push(l), { took: () => { asked = true; return true; } });
  assert.equal(r, QUICK_LOOT_REFUSED);
  assert.equal(asked, false, 'a refusal is never a card');
  assert.deepEqual(said, [CANNOT_CARRY_TEXT, CANNOT_CARRY_TEXT]);
  // the split: gold that half fits is counted at what MOVED, not at what stayed on the pile
  const s = player(20);   // 30 kg: 12,000 pieces of 14,000
  const purse = [gold(14000)];
  foldQuickLoot(frameOf('pile:3', purse));
  let split = null;
  quickLootTake('pile:3', hooks(purse), s, () => {}, { took: (m) => { split = m; return true; } });
  assert.equal(s.goldPieces, 12000);
  assert.deepEqual(split.map((m) => m.count), [12000], 'the card says what went into the purse');
  assert.equal(purse[0].stackCount, 2000, '(the pile kept the rest)');
}));

// ── THE FACE ─────────────────────────────────────────────────────

test('PICKUP-FEED: the CLASSIC skin keeps Daggerfall\'s line - showPickups answers false, builds no node and injects no sheet; through the real take the line is said word for word (mutants: the skin gate dropped; the classic page dressed)', () => withPage((pg) => withQuickLoot(() => {
  assert.equal(showPickups([{ item: item('Ruby'), count: 1 }]), false);
  assert.equal(pg.doc.made.length, 0, 'not one element made on a classic page');
  assert.equal(pg.doc.getElementById(PICKUP_FEED_STYLE_ID), null);
  const items = [item('Longsword')];
  foldQuickLoot(frameOf('pile:1', items));
  const said = [];
  quickLootTake('pile:1', hooks(items), player(), (l) => said.push(l), { took: showPickups });
  assert.deepEqual(said, ['You take the Longsword.']);
  assert.equal(pg.doc.made.length, 0);
}), { skin: 'classic' }));

test('PICKUP-FEED: off a document the face answers false and the line is said (a node test, a worker)', () => withQuickLoot(() => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(showPickups([{ item: item('Ruby'), count: 1 }]), false);
  const items = [item('Ruby')];
  foldQuickLoot(frameOf('pile:1', items));
  const said = [];
  quickLootTake('pile:1', hooks(items), player(), (l) => said.push(l), { took: showPickups });
  assert.deepEqual(said, ['You take the Ruby.']);
}));

test('PICKUP-FEED: the ENHANCED skin shows the cards - one node on the body, one sheet, a card per pickup in its tier, "+N Gold" with no second "+", and the take says nothing (mutants: the node never appended; the sheet injected twice; the tier not worn)', () => withPage((pg) => withQuickLoot(() => {
  setPref(LOOT_RARITY_KEY, true);
  try {
    const items = [item('Stormcaller', { rarity: 'rare', identified: true }), gold(35)];
    foldQuickLoot(frameOf('pile:1', items));
    quickLootArm('QuickLootAll');
    const said = [];
    assert.ok(quickLootTake('pile:1', hooks(items), player(), (l) => said.push(l), { took: showPickups }));
    assert.deepEqual(said, [], 'the cards are the words');
    const feed = pg.feed();
    assert.ok(feed, 'the node');
    assert.equal(feed.parent, pg.doc.body, 'on the body');
    assert.equal(feed.className, 'pickfeed');
    assert.equal(feed.attrs['aria-hidden'], 'true');
    const style = pg.doc.getElementById(PICKUP_FEED_STYLE_ID);
    assert.ok(style && style.parent === pg.doc.head, 'its own sheet, in the head');
    const cards = pg.cards();
    assert.deepEqual(cards.map(cardText), ['+Stormcaller', '+35 Gold'], 'the pile\'s order, the first nearest the centre');
    assert.equal(cards[0].dataset.rarity, 'rare', 'the tier the name is coloured by');
    assert.equal(cards[1].classList.contains('is-gold'), true);
    assert.equal(find(cards[1], 'pickfeed-plus').length, 0, 'gold\'s words carry their own "+"');
    assert.equal(find(cards[0], 'pickfeed-plus').length, 1);
    // a second take of the same purse: bumped, the count rewritten, the pop restarted
    const more = [gold(5)];
    foldQuickLoot(frameOf('pile:2', more));
    quickLootTake('pile:2', hooks(more), player(), () => {}, { took: showPickups });
    assert.deepEqual(pg.cards().map(cardText), ['+40 Gold', '+Stormcaller'], 'bumped, and nearest the centre');
    assert.ok(find(pg.cards()[0], 'pickfeed-name')[0].classList.contains('bump-a'), 'the count says it was bumped');
    showPickups([{ item: gold(1), count: 1 }]);
    const nm = find(pg.cards()[0], 'pickfeed-name')[0];
    assert.deepEqual([nm.classList.contains('bump-b'), nm.classList.contains('bump-a')], [true, false], 'a second bump restarts the pop');
    showPickups([{ item: item('Stormcaller', { rarity: 'rare', identified: true }), count: 2 }]);
    assert.equal(find(pg.cards()[0], 'pickfeed-count')[0].textContent, '×3', 'an item\'s count');
    // one sheet, however many cards
    showPickups([{ item: item('Ruby'), count: 1 }]);
    assert.equal(pg.doc.head.children.filter((c) => c.id === PICKUP_FEED_STYLE_ID).length, 1);
  } finally { setPref(LOOT_RARITY_KEY, PREF_DEFAULTS[LOOT_RARITY_KEY]); }
})));

test('PICKUP-FEED: the face keeps its own clock - a card fades after its hold and its node goes at its end; the ticker stops when the feed is empty (mutants: the fade never drawn; an expired card left standing; a ticker that runs forever)', () => withPage((pg) => {
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.equal(pg.cards().length, 1);
  pg.now = PICKUP_FEED_HOLD_MS - 10; pg.frame();
  assert.equal(pg.cards()[0].classList.contains('fading'), false);
  pg.now = PICKUP_FEED_HOLD_MS + 10; pg.frame();
  assert.equal(pg.cards()[0].classList.contains('fading'), true, 'fading, past its hold');
  assert.equal(pg.queued(), 1, 'a standing card keeps the ticker asking');
  pg.now = PICKUP_FEED_HOLD_MS + PICKUP_FEED_FADE_MS + 10; pg.frame();
  assert.equal(pg.cards().length, 0, 'and gone');
  assert.equal(pg.queued(), 0, 'an empty feed asks for no more frames');
  assert.deepEqual(_pickupFeedLines(), []);
}));

test('PICKUP-FEED: a card\'s picture comes through the icon door once, at its box - and lands later into the frame already standing; a thing with no picture has no frame (mutants: no icon drawn; asked every frame)', () => withPage((pg) => {
  let asks = 0;
  let wake = null;
  const pic = { src: 'data:image/png;base64,AA', w: PICKUP_ICON_BOX, h: PICKUP_ICON_BOX, smooth: false };
  _setPickupFeedForTests({ icon: (line, onReady) => { asks += 1; if (onReady) wake = onReady; return asks > 1 ? pic : null; } });
  const sword = item('Longsword', { templateIndex: 115 });
  showPickups([{ item: sword, count: 1 }]);
  const box = find(pg.cards()[0], 'pickfeed-icon')[0];
  assert.ok(box, 'the frame stands while the picture is made');
  assert.equal(box.children.length, 0);
  for (let i = 0; i < 5; i++) { pg.now += 16; pg.frame(); }
  assert.equal(asks, 1, 'asked once, not once a frame');
  wake();
  assert.equal(box.children.length, 1, 'the picture lands into its frame');
  assert.equal(box.children[0].tag, 'img');
  assert.equal(box.children[0].src, pic.src);
  // no address at all (a template with no art): no frame
  _setPickupFeedForTests({ icon: () => null });
  showPickups([{ item: { name: 'Thing', group: 'Weapons', templateIndex: 99999 }, count: 1 }]);
  assert.equal(find(pg.cards()[0], 'pickfeed-icon').length, 0);
  assert.equal(pg.cards()[0].classList.contains('no-icon'), true);
}));

test('PICKUP-FEED: the band is measured - the feed stands under a plaque that reaches past the line, and above the HUD\'s bottom block, with the oldest cards waiting unseen when the band is short (mutants: the keep-outs unread; every card shown into the HUD)', () => withPage((pg) => {
  pg.doc.rects['.wplaque.on'] = { top: 434, bottom: 640 };
  pg.doc.rects['.hud .hud-bottom'] = { top: 720, bottom: 780 };   // the band's foot at 712: 64px under the plaque's 648 - two 30px cards and a 3px gap
  const feed = () => pg.feed();
  showPickups([{ item: item('A'), count: 1 }, { item: item('B'), count: 1 }, { item: item('C'), count: 1 }]);
  // a card 30px tall: the fake measures it so
  for (const c of pg.cards()) c.getBoundingClientRect = () => ({ top: 0, bottom: 30, height: 30, width: 100, left: 0, right: 100 });
  pg.now += 16; pg.frame();
  assert.equal(feed().props['--pf-top'], '648.0px', 'under the plaque, by the gap');
  assert.deepEqual(pg.cards().map((c) => c.classList.contains('pf-over')), [false, false, true], 'the band holds two: the oldest waits');
  delete pg.doc.rects['.wplaque.on'];
  pg.now += 16; pg.frame();
  assert.deepEqual(pg.cards().map((c) => c.classList.contains('pf-over')), [false, false, false], 'room again: all three');
  assert.equal(feed().props['--pf-top'], '584.0px', 'on the mid-screen line (the classic label\'s 146 at scale 4)');
}));

test('PICKUP-FEED: a refusal said on the mid-screen line stands ABOVE the cards, never under them (mutant: the line unread)', () => withPage((pg) => {
  const mid = pg.doc.createElement('div');
  mid.id = 'enhanced-midtext';
  mid.textContent = CANNOT_CARRY_TEXT;
  mid.getBoundingClientRect = () => ({ top: 584, bottom: 602, height: 18, width: 300, left: 0, right: 300 });
  pg.doc.body.append(mid);
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.equal(pg.feed().props['--pf-top'], '610.0px', 'under the line, by the gap');
  mid.style.display = 'none';
  pg.now += 16; pg.frame();
  assert.equal(pg.feed().props['--pf-top'], '584.0px', 'the line gone, the cards on it');
}));

test('PICKUP-FEED: a face whose ticker stops drawing is taken down by its watchdog (ui/drawWatchdog.js, the plaque\'s law) - a card can never be stranded over the game (mutants: no watchdog; a release that clears nothing)', () => withPage((pg) => {
  let armed = null;
  _setPickupFeedForTests({ schedule: (fn, ms) => { armed = { fn, ms }; return 1; }, cancel: () => {} });
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.ok(armed, 'a draw arms the watchdog');
  assert.equal(armed.ms, PICKUP_WATCHDOG_MS);
  // the ticker draws: re-armed
  armed = null;
  pg.now += 16; pg.frame();
  assert.ok(armed, 'every frame re-arms it');
  // now the frames stop coming (the ticker is gone), and the timer is what is left
  const left = armed;
  _frameForTests(DRAW_FRAMES_UNDRAWN);
  left.fn();
  assert.equal(pg.cards().length, 0, 'the cards come down by themselves');
  assert.equal(_pickupFeedLines().length, 0, 'and the law forgets them');
  clearPickupFeed();
}));

test('PICKUP-FEED: freed with the host that raised it - the plaque\'s teardown, which every host calls, takes the node and the cards (mutants: the teardown never reaches the feed; the node left on the body)', () => withPage((pg) => {
  showPickups([{ item: item('Ruby'), count: 1 }]);
  const feed = pg.feed();
  assert.ok(feed);
  destroyWorldPlaque();
  assert.equal(feed.removed, true, 'the node is gone');
  assert.equal(pg.doc.getElementById(PICKUP_FEED_ID), null);
  assert.deepEqual(_pickupFeedLines(), []);
  // and the next pickup builds afresh - a new node, the sheet it already laid kept (never a second copy)
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.ok(pg.doc.getElementById(PICKUP_FEED_ID));
  assert.equal(pg.doc.head.children.filter((c) => c.id === PICKUP_FEED_STYLE_ID).length, 1, 'one sheet across a teardown');
}));

test('PICKUP-FEED: the plaque\'s hide door - an overlay over the world, a held frame - takes the cards down with it; the node stays for the next take (mutant: the hide leaves the cards painted over a window)', () => withPage((pg) => {
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.equal(pg.cards().length, 1);
  hideWorldPlaque();
  assert.equal(pg.cards().length, 0, 'the cards are down');
  assert.deepEqual(_pickupFeedLines(), []);
  assert.ok(pg.feed(), 'the node stays');
}));

test('PICKUP-FEED: a frame asked for before a teardown is not the new ticker\'s - one chain of frames, never two (mutant: the stale frame runs and asks again, doubling the draws for as long as a card stands)', () => withPage((pg) => {
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.equal(pg.queued(), 1);
  destroyPickupFeed();
  showPickups([{ item: item('Ruby'), count: 1 }]);
  assert.equal(pg.queued(), 2, 'the stale frame is still queued beside the new one');
  pg.now += 16; pg.frame();
  assert.equal(pg.queued(), 1, 'only the new ticker asked again');
}));

test('PICKUP-FEED: the sheet is the skin\'s - the pixel face, the plaque\'s veil and stone, the tiers\' colours scoped to the feed, the HUD\'s scale, under every window, and no slide, pop or fade under reduced motion', () => {
  const css = PICKUP_FEED_CSS;
  assert.ok(css.includes(PIXEL_STACK), 'the pixel face');
  assert.match(css, /\.pickfeed-card \{[^}]*background-color: rgba\(10,12,17,0\.9\)/, 'the plaque\'s veil');
  assert.match(css, /\.pickfeed \[data-rarity="rare"\] \{ --rar: #e4c34f;/, 'the tier table, scoped');
  assert.match(css, /\.pickfeed-card\[data-rarity\] \.pickfeed-name \{ color: var\(--rar\); \}/, 'the name in its tier');
  assert.match(css, /scale\(var\(--hud-scale, 1\)\)/, 'the HUD\'s scale');
  assert.match(css, /\.pickfeed \{[^}]*z-index: 4;/, 'the HUD\'s own layer - every window stands over it');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.pickfeed-card, \.pickfeed-count, \.pickfeed-name, \.pickfeed-plus, \.haul-fill \{ animation: none !important; transition: none !important; \} \}/);   // HAUL-CARDS (PIN MOVED): a haul card's "+N" pop and its bar's slide too
  assert.match(css, /\.pickfeed-card\.pf-over \{ display: none; \}/);
});

// ── THE FOUR HOSTS ───────────────────────────────────────────────

test('PICKUP-FEED: FOUR HOSTS - every quick-loot take in every host hands the take the cards (`took: showPickups`), imported from the feed: world 2, exterior 2, worldModes 2, dungeonContext 1 (mutant: a host passing none, so its takes say the line on the enhanced skin)', () => {
  const files = { 'src/scenes/world.js': 2, 'src/scenes/exterior.js': 2, 'src/scenes/worldModes.js': 2, 'src/scenes/dungeonContext.js': 1 };
  for (const [f, n] of Object.entries(files)) {
    const src = rd(f);
    assert.match(src, /import \{ showPickups(, showHaul)? \} from '\.\.\/ui\/pickupFeed\.js';/, `${f}: the feed's door`);   // HAUL-CARDS (PIN MOVED): the world host takes the haul's door beside it
    const calls = src.match(/quickLootTake\([^\n]*/g) ?? [];
    assert.equal(calls.length, n, `${f}: the calls`);
    for (const c of calls) assert.match(c, /\{ getQuest: [^\n]*, took: showPickups \}\)/, `${f}: ${c.slice(0, 60)}... hands the take the cards`);
  }
});
