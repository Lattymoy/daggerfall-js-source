// LOOT-BANNER + ACQUIRE1 (2026-10-09, Mac: "a popup for when you obtain something of rarity including weapons, armor, the
// new cards, etc - something akin to a destiny loot popup notification"; bible/10-UI/Loot-Banner.md). The laws pinned here:
//   - THE WATCHER (systems/acquireWatch.js): what arrived in the player's keeping - the pack, the wagon, the Materials Bag -
//     read once a frame; a piece marked the first frame it stands there; a card by its count; a new baseline for a new
//     entity, a load, and the creation; only Rare and up announces; the mark is the receiver's (stripped off the wire).
//   - THE LAW (ui/lootBanner.js createBannerQueue): three standing, the best waiting first, a card's count added, a hold
//     and a big one's, a piece no longer held never standing.
//   - THE FACE: Enhanced Plus only, at the right edge under the notices; the big tiers' banner and fanfare; hidden under the
//     HUD's gate with its clock still; the codex's first find said on the banner.
//   - THE WIRING: drawHud's one call on every skin, its hide door, the HUD-MOVE piece, the declared field.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as W from '../src/systems/acquireWatch.js';
import * as B from '../src/ui/lootBanner.js';
import * as CX from '../src/systems/lootCodex.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintAetheric, AETHERIC_RECORDS } from '../src/systems/aetheric.js';
import { mintHourlock } from '../src/systems/gilded.js';
import { mintIliacCard, giveBinderAtChargen } from '../src/systems/iliacItems.js';
import { ILIAC_CARDS } from '../src/net/iliacCards.js';
import { addItem, splitStack } from '../src/systems/inventory.js';
import { validLootItem } from '../src/systems/loot.js';
import { wildRecord } from '../src/systems/wildDeath.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { HUD_PIECES } from '../src/ui/hudLayout.js';
import { registerPresenter } from '../src/systems/notify.js';
import { setOneShotObserver } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const tiered = (tier, seed = 2) => known(LR.applyRarity(createWeapon(113, 1), tier, lcg(seed)));
const legend = (id = 'wyrmbane') => { const rec = LR.legendaryById(id); return known(LR.applyRarity(createWeapon(rec.templates?.[0] ?? 113, 1), 'legendary', lcg(1), [rec])); };
const cardOf = (tier) => ILIAC_CARDS.find((c) => c.tier === tier).id;
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const hero = (over = {}) => ({ isPlayer: true, chargenDone: true, items: [], wagonItems: [], bagItems: [], ...over });
const names = (arr) => arr.map((a) => [a.item.name, a.tier, a.count]);

test('ACQUIRE1 THE WATCHER: the first frame is a baseline; a new Rare piece arrives once and is marked; a Common or Magic one is marked and says nothing; a move between the three lists, a piece already the player\'s and a potion say nothing (mutants: the baseline announcing; the mark never written; a Magic piece announced; the wagon\'s move an arrival)', () => {
  on();
  const watch = W.createAcquireWatch();
  const old = tiered('legendary');
  const me = hero({ items: [old] });
  assert.deepEqual(watch.observe(me), [], 'the first frame: a baseline');
  assert.equal(old.acquired, true, 'and what it read is marked');
  const rare = tiered('rare', 3), magic = tiered('magic', 4), plain = createWeapon(113, 1);
  const potion = { group: 'UselessItems1', templateIndex: 83, name: 'Potion' };
  me.items.push(rare, magic, plain, potion);
  const got = watch.observe(me);
  assert.deepEqual(names(got), [[rare.name, 'rare', 1]], 'the Rare alone');
  assert.deepEqual([rare.acquired, magic.acquired, plain.acquired, potion.acquired], [true, true, true, undefined], 'every piece that could wear a tier is marked; a potion never');
  assert.deepEqual(watch.observe(me), [], 'once');
  me.items.splice(me.items.indexOf(rare), 1); me.wagonItems.push(rare);
  assert.deepEqual(watch.observe(me), [], 'into the wagon: not new');
  me.wagonItems.length = 0; me.bagItems.push(rare);
  assert.deepEqual(watch.observe(me), [], 'into the bag: not new');
  const mine = Object.assign(tiered('artifact'), { acquired: true });
  me.items.push(mine);
  assert.deepEqual(watch.observe(me), [], 'my own piece back out of a chest: not new');
  assert.equal(W.markable(potion), false); assert.equal(W.markable({ group: 'Weapons', templateIndex: 131 }), false, 'an arrow never');
});

test('ACQUIRE1 THE CARDS: a card arrives by its count - a new record, a card merged into a stack held, a stack of the player\'s own back from a chest saying nothing; a split into the wagon says nothing; its tier its catalog\'s, with loot rarity off too (mutants: the merge missed; the split an arrival; my own stack an arrival; a card\'s tier the loot ladder\'s)', () => {
  on();
  const watch = W.createAcquireWatch();
  const rareId = cardOf('rare'), commonId = cardOf('common');
  const me = hero();
  watch.observe(me);
  addItem(me.items, mintIliacCard(rareId, 1));
  addItem(me.items, mintIliacCard(commonId, 3));
  const a = watch.observe(me);
  assert.equal(a.length, 1, 'the Rare card; a Common card says nothing');
  assert.deepEqual([a[0].item.card, a[0].tier, a[0].count], [rareId, 'rare', 1]);
  addItem(me.items, mintIliacCard(rareId, 2));
  assert.equal(me.items.filter((it) => it.card === rareId).length, 1, 'merged into the stack held');
  assert.deepEqual(watch.observe(me).map((x) => [x.item.card, x.count]), [[rareId, 2]], 'its count rose by two');
  const stack = me.items.find((it) => it.card === rareId);
  const half = splitStack(me.items, stack, 1);
  me.items.splice(me.items.indexOf(half), 1);
  addItem(me.wagonItems, half);
  assert.deepEqual(watch.observe(me), [], 'a split into the wagon');
  me.wagonItems.splice(me.wagonItems.indexOf(half), 1);
  addItem(me.items, half);
  assert.equal(me.items.filter((it) => it.card === rareId).length, 1, 'merged back into the pack\'s stack');
  assert.deepEqual(watch.observe(me), [], 'and back out of the wagon: the three lists\' count did not rise');
  me.items.splice(me.items.indexOf(stack), 1);
  assert.deepEqual(watch.observe(me), [], 'into a chest');
  me.items.push(stack);
  assert.deepEqual(watch.observe(me), [], 'and back: my own stack, marked');
  setPref('lootRarity', false);
  addItem(me.items, mintIliacCard(cardOf('legendary'), 1));
  assert.deepEqual(watch.observe(me).map((x) => x.tier), ['legendary'], 'the tier printed on the card, whatever the ladder\'s switch');
  me.items.push(tiered('legendary', 9));
  assert.deepEqual(watch.observe(me), [], 'a piece of the ladder, the ladder off: no tier');
});

test('ACQUIRE1 THE BASELINES: a load\'s new pack, the creation and the frame it ends, and a new entity announce nothing; the mark is the receiver\'s - stripped by the wire\'s clamp and the zone\'s record, so a piece another player hands over arrives (mutants: no baseline at a load; the starter deck announced; the wire keeping the mark)', () => {
  on();
  const watch = W.createAcquireWatch();
  const me = hero({ chargenDone: false });
  watch.observe(me);
  me.items.push(tiered('legendary'));
  assert.deepEqual(watch.observe(me), [], 'the creation');
  giveBinderAtChargen(me);   // the kit's tail and the flag in the same gap between two frames (chargenSession.js)
  me.items.push(mintAetheric(AETHERIC_RECORDS[0]));
  me.chargenDone = true;
  assert.deepEqual(watch.observe(me), [], 'the frame it ends: its starter deck and kit announce nothing');
  assert.deepEqual(watch.observe(me), [], 'nor the next');
  me.items = [...me.items, legend('graveward')];   // a save from before the mark: nothing in it carries one
  assert.deepEqual(watch.observe(me), [], 'a load replaces the pack: a baseline');
  assert.deepEqual(watch.observe(hero({ items: [tiered('rare')] })), [], 'another entity: a baseline');
  assert.equal(ITEM_FIELDS.acquired.kind, 'bool', 'a declared field: it rides the save');
  const mine = Object.assign(tiered('rare', 6), { acquired: true });
  assert.equal(validLootItem(JSON.parse(JSON.stringify(mine))).acquired, undefined, 'the wire\'s clamp strips it');
  assert.equal(wildRecord(mine).acquired, undefined, 'the zone\'s record too');
  const me2 = hero();
  watch.observe(me2);
  me2.items.push(validLootItem(JSON.parse(JSON.stringify(mine))));
  assert.deepEqual(watch.observe(me2).map((x) => x.tier), ['rare'], 'handed over: new to its taker');
});

test('LOOT-BANNER THE LAW: three stand, the newest first; what waits goes in by tier, the best first; a card\'s count adds to its banner standing or waiting; a hold, a big one\'s longer, then the slide; a piece no longer held is dropped at its turn; past the waiting cap the lowest go (mutants: no cap; waiting in arrival order; a second card a second banner; one hold for all; the held check skipped)', () => {
  const q = B.createBannerQueue({ max: 3, hold: 100, bigHold: 300, slide: 10, pendingMax: 5 });
  const e = (key, tier, big = false) => ({ key, tier, big, count: 1, name: key });
  q.push([e('a', 'rare'), e('b', 'legendary'), e('c', 'rare'), e('d', 'gilded', true), e('x', 'rare')]);
  assert.deepEqual(q.pending().map((p) => p.key), ['d', 'b', 'a', 'c', 'x'], 'the best first, a tier in its order');
  let t = q.tick(0, { canEnter: (p) => p.key !== 'b' });
  assert.deepEqual(t.entered.map((p) => p.key), ['d', 'a', 'c'], 'three take a place; one no longer held is dropped');
  assert.deepEqual(q.standing().map((p) => p.key), ['c', 'a', 'd'], 'the newest on top');
  q.tick(50);
  q.push([{ ...e('a', 'rare'), count: 2 }, { ...e('x', 'rare'), count: 4 }]);
  assert.equal(q.standing().find((p) => p.key === 'a').count, 3, 'added to the standing banner');
  assert.equal(q.standing().find((p) => p.key === 'a').bumps, 1);
  assert.equal(q.pending().find((p) => p.key === 'x').count, 5, 'and to the waiting one');
  t = q.tick(50);
  assert.deepEqual(q.standing().filter((p) => p.outMs != null).map((p) => p.key), ['c'], 'c held its 100; a was bumped');
  assert.deepEqual(t.entered.map((p) => p.key), ['x'], 'a banner sliding out holds no place: the next takes it at once');
  t = q.tick(10);
  assert.deepEqual(t.gone.map((p) => p.key), ['c'], 'and the slide ends');
  q.tick(140);
  assert.ok(q.standing().find((p) => p.key === 'a').outMs != null, 'a\'s restarted hold spent');
  assert.ok(q.standing().find((p) => p.key === 'd').outMs == null, 'a big one holds longer');
  const cap = B.createBannerQueue({ pendingMax: 2 });
  cap.push([e('r1', 'rare'), e('l1', 'legendary'), e('g1', 'gilded', true)]);
  assert.deepEqual(cap.pending().map((p) => p.key), ['g1', 'l1'], 'past the cap the lowest go');
});

// ── a document, just enough of one (test/revenant_card.test.js's) ──
function fakeEl(tag, doc) {
  const classes = new Set();
  const n = {
    tag, doc, children: [], dataset: {}, attrs: {}, parent: null, hidden: false, style: { _p: {}, setProperty(k, v) { this._p[k] = v; }, removeProperty(k) { delete this._p[k]; }, getPropertyValue(k) { return this._p[k] ?? ''; } },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, v = !classes.has(c)) => { if (v) classes.add(c); else classes.delete(c); return v; }, contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n._text = v == null ? '' : String(v); },
    get firstChild() { return n.children[0] ?? null; },
    get isConnected() { let x = n; while (x.parent) x = x.parent; return x === doc.body || x === doc.head; },
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    remove() { if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; } },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute: (k) => n.attrs[k] ?? null, hasAttribute: (k) => k in n.attrs,
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (t) => fakeEl(t, doc);
  doc.body = fakeEl('body', doc);
  doc.head = fakeEl('head', doc);
  const all = () => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.getElementById = (id) => all().find((e) => e.id === id) ?? null;
  doc.querySelectorAll = () => [];
  doc.querySelector = () => null;
  return doc;
}
const byClass = (root, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; };
const textIn = (root, cls) => byClass(root, cls)[0]?.textContent ?? null;
function withPage(fn, { skin = 'enhanced' } = {}) {
  const doc = fakeDocument();
  globalThis.document = doc;
  globalThis.location = { search: `?skin=${skin}` };
  const sounds = [];
  B._resetLootBannersForTests();
  B._setLootBannerForTests({ icon: () => ({ src: 'data:x', w: 20, h: 20, smooth: false }), play: (c) => sounds.push(c), schedule: () => 1, cancel: () => {} });
  try { return fn(doc, sounds); } finally {
    B._resetLootBannersForTests();
    B._setLootBannerForTests({ icon: null, play: null });
    delete globalThis.document; delete globalThis.location;
  }
}
const frame = (me, dt = 0.016, hidden = false) => B.drawLootBanners({ entity: me, hidden, dt });

test('LOOT-BANNER THE FACE: on Enhanced Plus a new Exalted Legendary stands at the right edge - its tier, its pips\' mark, its name, what it is, a reader\'s whole line; it holds, slides out and the stack goes with the last; hidden under the HUD\'s gate its clock stops; the classic skin builds nothing and the watcher still marks (mutants: the stack never built; the clock runs hidden; a classic node; the name uncoloured)', () => withPage((doc) => {
  on();
  const me = hero();
  frame(me);
  const sword = Object.assign(legend(), { exalted: true });
  me.items.push(sword);
  frame(me);
  const stack = doc.getElementById(B.LOOT_BANNER_STACK_ID);
  assert.ok(stack && stack.parent === doc.body, 'the stack, on the body');
  assert.equal(stack.className, 'lootbanner-stack');
  assert.ok(doc.getElementById(B.LOOT_BANNER_STYLE_ID), 'its sheet');
  assert.match(B.LOOT_BANNER_CSS, /\.lb-name \{[^}]*color: var\(--rar, /, 'the name in its tier\'s colour');
  assert.match(B.LOOT_BANNER_CSS, /\.lootbanner-stack \[data-rarity="legendary"\] \{ --rar: #e07a2e;/, 'the tiers\' table, scoped to the stack');
  const [b] = byClass(stack, 'lootbanner');
  assert.equal(b.dataset.rarity, 'legendary'); assert.ok('exalted' in b.dataset, 'the Exalted\'s pips');
  assert.ok(b.classList.contains('lb-in'));
  assert.equal(textIn(b, 'lb-kicker'), 'Exalted Legendary');
  assert.ok(textIn(b, 'lb-name').startsWith(sword.name));
  assert.equal(textIn(b, 'lb-sub'), templateByIndex(sword.templateIndex).name, 'what it is - its template\'s name');
  assert.match(textIn(b, 'lb-sr'), /^Acquired: Exalted Legendary /);
  frame(me, 3, true);
  assert.ok(stack.classList.contains('lb-hidden'), 'hidden under a window');
  frame(me, 0.01);
  assert.equal(B._lootBanners().standing[0].out, false, 'and nothing aged while hidden');
  frame(me, B.LOOT_BANNER_HOLD_MS / 1000);
  assert.ok(b.classList.contains('lb-out'), 'its hold spent, it slides out');
  frame(me, B.LOOT_BANNER_SLIDE_MS / 1000);
  assert.equal(doc.getElementById(B.LOOT_BANNER_STACK_ID), null, 'gone with the last');
  withPage((cdoc) => {
    const you = hero();
    frame(you);
    const r = tiered('rare', 7);
    you.items.push(r);
    frame(you);
    assert.equal(cdoc.getElementById(B.LOOT_BANNER_STACK_ID), null, 'the classic skin: nothing built');
    assert.equal(cdoc.getElementById(B.LOOT_BANNER_STYLE_ID), null, 'not even a sheet');
    assert.equal(r.acquired, true, 'and the watcher still read it');
  }, { skin: 'classic' });
}));

test('LOOT-BANNER THE TOP TIERS: an Aetheric, an Artifact and a Gilded piece stand big and play the fanfare once a frame, with the port\'s sounds on; a Rare plays nothing; a card stands as its tier\'s card with its count; a piece gone before its turn never stands (mutants: no big banner; no fanfare; the fanfare past the sounds switch; a card uncounted)', () => withPage((doc, sounds) => {
  on();
  setPref('soundEnhancements', true);
  const me = hero();
  frame(me);
  me.items.push(mintAetheric(AETHERIC_RECORDS[0]), mintHourlock());
  frame(me);
  const big = byClass(doc.body, 'lootbanner');
  assert.deepEqual(big.map((b) => b.dataset.rarity), ['aetheric', 'gilded'], 'the newest on top');
  assert.ok(big.every((b) => b.classList.contains('lb-big')), 'both big');
  assert.deepEqual(sounds, [SOUND.ArenaFanfareLevelUp], 'one fanfare for the frame');
  B._resetLootBannersForTests(); sounds.length = 0;
  frame(me);
  me.items.push(tiered('rare', 8));
  frame(me);
  assert.deepEqual(sounds, [], 'a Rare lands quietly');
  assert.ok(!byClass(doc.body, 'lootbanner')[0].classList.contains('lb-big'));
  B._resetLootBannersForTests();
  setPref('soundEnhancements', false);
  frame(me);
  me.items.push(Object.assign(tiered('rare', 10), { artifact: true }));
  frame(me);
  assert.deepEqual(sounds, [], 'the port\'s sounds off: no fanfare');
  B._resetLootBannersForTests();
  frame(me);
  const id = cardOf('legendary');
  addItem(me.items, mintIliacCard(id, 2));
  frame(me);
  const c = byClass(doc.body, 'lootbanner')[0];
  assert.equal(textIn(c, 'lb-kicker'), 'Legendary Card');
  assert.equal(byClass(c, 'lb-count')[0].textContent, '×2');
  assert.equal(textIn(c, 'lb-sub'), `${ILIAC_CARDS.find((x) => x.id === id).kind.replace(/^./, (s) => s.toUpperCase())} card`);
  B._resetLootBannersForTests();
  frame(me);
  const fleeting = tiered('legendary', 11);
  me.items.push(fleeting);
  frame(me, 0, true);   // read under a window
  me.items.splice(me.items.indexOf(fleeting), 1);   // and gone before the window closes
  frame(me);
  assert.equal(byClass(doc.body, 'lootbanner').length, 0, 'never stands');
}));

test('LOOT-BANNER THE CODEX: a first find is said on the banner on Enhanced Plus - "New to your codex", the codex\'s chime, no line - whether the take told the codex before the frame read it or the banner already stood; the classic skin, and a piece no frame will read, keep the codex\'s line (mutants: the codex silenced with no banner; the line said twice; the chime lost)', () => withPage((doc, sounds) => {
  on(); CX._resetCodexForTests();
  const lines = [];
  const off = registerPresenter({ priority: 99, hudText: (t) => { lines.push(t); return true; } });
  setOneShotObserver((i) => sounds.push(i));
  try {
    const loose = legend('nightwhisper');
    assert.equal(CX.noteFind(loose), true);
    assert.equal(lines.length, 1, 'no frame has read a pack: the codex says its line');
    const me = hero();
    frame(me);
    const w = legend('wyrmbane');
    me.items.push(w);
    lines.length = 0; sounds.length = 0;
    assert.equal(CX.noteFind(w), true, 'the take tells the codex inside the press');
    assert.deepEqual(lines, [], 'no line: the banner says it');
    frame(me);
    const b = byClass(doc.body, 'lootbanner')[0];
    assert.equal(byClass(b, 'lb-codex')[0].hidden, false, 'New to your codex');
    assert.equal(textIn(b, 'lb-codex'), 'New to your codex');
    assert.ok(sounds.includes(SOUND.LevelUp), 'the codex\'s own chime');
    const g = legend('graveward');
    me.items.push(g);
    frame(me, 0, true);   // the banner waits under a window
    lines.length = 0;
    assert.equal(CX.noteFind(g), true);
    assert.deepEqual(lines, [], 'the round\'s sweep finds it waiting: said on it');
    assert.equal(B._lootBanners().pending.length + B._lootBanners().standing.filter((s) => s.codex).length >= 1, true);
  } finally { off(); setOneShotObserver(null); }
  withPage(() => {
    const lines2 = [];
    const off2 = registerPresenter({ priority: 99, hudText: (t) => { lines2.push(t); return true; } });
    try {
      CX._resetCodexForTests();
      const me = hero(); frame(me);
      const w = legend('worms-tooth'); me.items.push(w);
      CX.noteFind(w);
      assert.equal(lines2.length, 1, 'the classic skin: the codex\'s line');
    } finally { off2(); }
  }, { skin: 'classic' });
}));

test('LOOT-BANNER THE WIRING: drawHud reads the player entity it is handed on every skin, under the HUD\'s gate, and its hide door hides the stack; the stack is a HUD-MOVE piece with a preview; the stack steps under the notice stack and never past the window\'s foot; the codex hands its find through the leaf (mutants: the call inside the skin\'s gate; the hide door forgotten; no HUD piece; the layout over the notices)', () => {
  const hud = read('src/ui/hud.js');
  assert.match(hud, /\n  drawLootBanners\(\{ entity: vitals, hidden: cursorActive \|\| !hudRenderEnabled\(\), dt \}\);\n  if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{/, 'beside the revenant\'s cards, before the skin\'s gate');
  assert.match(hud, /drawRevenantCards\(\{ hidden: true \}\);[^\n]*\n  drawLootBanners\(\{ hidden: true \}\);[^\n]*\n\}/, 'the hide door');
  for (const host of ['world.js', 'worldModes.js', 'dungeonContext.js', 'exterior.js']) {
    assert.match(read(`src/scenes/${host}`), /drawHud\(renderer, canvas, hudArt, playerEntity,/, `${host}: hands drawHud the player entity`);
  }
  const piece = HUD_PIECES.find((p) => p.id === 'loot');
  assert.deepEqual([piece?.sel, piece?.ghost, piece?.dummy], ['.lootbanner-stack', 'loot', true]);
  const doc = fakeDocument();
  const pv = B.buildLootBannerPreview(doc);
  assert.equal(pv.className, 'lootbanner-stack'); assert.equal(byClass(pv, 'lootbanner').length, 1);
  assert.deepEqual(B.bannerLayout({ base: 480, notice: { top: 380, bottom: 520 }, lower: 790, heights: [60, 60] }), { top: 530, shown: 2 }, 'under the notices');
  assert.deepEqual(B.bannerLayout({ base: 480, notice: { top: 100, bottom: 300 }, lower: 790, heights: [60, 60] }), { top: 480, shown: 2 }, 'notices far above: its own place');
  assert.deepEqual(B.bannerLayout({ base: 480, notice: { top: 380, bottom: 700 }, lower: 790, heights: [60, 60, 60] }), { top: 710, shown: 1 }, 'a short band shows the newest');
  assert.match(read('src/systems/lootCodex.js'), /if \(!quiet && !presentCodexFind\(item, key\.kind\)\) \{/);
  assert.doesNotMatch(read('src/systems/lootCodex.js'), /from '\.\.\/ui\//, 'the codex imports no face');
});
