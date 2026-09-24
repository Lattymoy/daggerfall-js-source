// LOOT-STACK (2026-09-23, the community arc - Janome on Discord: "a toggle key to switch between the inventories of
// enemies stacked on top of each other"; Mac, on the key it first shipped with: "that solution is better than a
// keybind"): THE PILE OF BODIES, DRIVEN. The stack along the real pick (player/activate.js) over real ray geometry -
// its members, its reach, the world occluding one; the pick answering the nearest and noting the pile; the pile as
// the loot window's tabs (lootPile), each tab back through the host's own corpse door; the pools' word on a body;
// both windows drawing and working the tabs; the plaque's count; the producers' mark; and the key, gone.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pickActivatableHit, RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { bodyStack, noteBodyStack, bodyPile, lootPile, bodyStackMark, resetBodyStack, _bodyStackStateForTests } from '../src/player/lootStack.js';
import { raceActivation } from '../src/player/activationRace.js';
import { corpseLootTargets, pileBody } from '../src/scenes/corpseMarker.js';
import { worldHoverFrame, destroyWorldPlaque, bodyStackText } from '../src/ui/worldPlaque.js';
import { setBindings } from '../src/ui/input.js';
import { ACTIONS, DEFAULT_BINDINGS, createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { PORT_ROWS } from '../src/ui/enhancedControls.js';
import { mountEnhancedInventory, remoteModel } from '../src/ui/enhancedInventory.js';
import { NativeInventoryWindow, pileLabel } from '../src/ui/nativeInventory.js';
import { REMOTE_TARGET_ICON_RECT } from '../src/ui/targetIconPanel.js';
import { withDom } from './invdrag.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ─── THE GEOMETRY: an eye at the origin looking down +z; a body is the corpse's own 1 x 0.6 x 1 box ─────────────

const EYE = [0, 0, 0], DIR = [0, 0, 1];
/** A body whose box the ray enters at `z` (the corpse mint's box, laid across the ray). */
const body = (key, z) => ({ key, aabb: { min: [-0.5, -0.3, z], max: [0.5, 0.3, z + 1] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true });
/** A pile of the player's own drops - a container, and no body. */
const pile = (key, z) => ({ key, aabb: { min: [-0.3, -0.3, z], max: [0.3, 0.3, z + 0.6] }, distance: RAY_DISTANCE, reach: 3.2 });
const open = { raycast: () => Infinity };
/** A wall across the ray at `at`: what the world's collider answers for any ray long enough to reach it. */
const wallAt = (at) => ({ raycast: (_e, _d, max) => (max >= at ? at : Infinity) });
const nearest = (targets, collider = open) => (rest) => pickActivatableHit(EYE, DIR, rest.map((t) => ({ ...t, body: false })), collider);
const fresh = () => { resetBodyStack(); };
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

// ─── THE STACK ──────────────────────────────────────────────────────────────────────────────────────────────────

test('LOOT-STACK the stack: the nearest body and every body behind it on the same ray inside its own reach, nearest first; a body past reach, or behind a wall, is no member; the nearest out of reach is a stack of one (mutants: the reach gate dropped; the members out of order; the stack walking a list the world occludes)', () => {
  fresh();
  const a = body('foeCorpse:a', 1), b = body('foeCorpse:b', 1.2), c = body('guardCorpse:c', 1.6), far = body('foeCorpse:far', 10);
  const targets = [far, c, a, b];   // pool order is not distance order
  const first = pickActivatableHit(EYE, DIR, targets, open);
  assert.equal(first.key, 'foeCorpse:a', 'the pick is the nearest body, as DFU\'s one ray has it');
  const stack = bodyStack({ key: 'foeCorpse:a', distance: 1, reach: CORPSE_ACTIVATION_DISTANCE }, targets, nearest(targets));
  assert.deepEqual(stack.map((h) => h.key), ['foeCorpse:a', 'foeCorpse:b', 'guardCorpse:c'], 'both pools, nearest first; the body ten metres off cannot be opened from here');
  assert.deepEqual(stack.map((h) => h.distance), [1, 1.2, 1.6]);
  // a wall between the second body and the third: the third is behind the world, and no member
  const walled = bodyStack({ key: 'foeCorpse:a', distance: 1, reach: CORPSE_ACTIVATION_DISTANCE }, targets, nearest(targets, wallAt(1.3)));
  assert.deepEqual(walled.map((h) => h.key), ['foeCorpse:a', 'foeCorpse:b']);
  // ...and through the real pick, whose walk is handed the same collider as its front
  pickActivatableHit(EYE, DIR, targets, wallAt(1.3));
  assert.deepEqual(bodyStackMark('foeCorpse:a'), { count: 2 }, 'the walk behind the front body sees the world the front one was picked through');
  pickActivatableHit(EYE, DIR, targets, open);
  assert.deepEqual(bodyStackMark('foeCorpse:a'), { count: 3 });
  // the nearest out of reach: the handler refuses it ("You are too far away"), and the bodies behind are further still
  assert.deepEqual(bodyStack({ key: 'foeCorpse:far', distance: 10, reach: CORPSE_ACTIVATION_DISTANCE }, [far, body('foeCorpse:far2', 10.2)], nearest([])).map((h) => h.key), ['foeCorpse:far']);
  assert.deepEqual(bodyStack(null, targets, nearest(targets)), []);
});

// ─── THE PLAQUE: the one seam four hosts call ─────────────────────────────────────────────────────────────────────

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], dataset: {}, attrs: {}, props: {},
    style: { setProperty(k, v) { n.props[k] = v; } },
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    get textContent() { return n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.length = 0; if (v) n.children.push({ textContent: v, children: [] }); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() {},
  };
  return n;
}
function withSkin(skin, fn) {
  globalThis.document = { createElement: (t) => fakeEl(t), body: { append() {} }, head: { append() {}, appendChild() {}, querySelector: () => null }, querySelector: () => null, getElementById: () => null };
  const search = `?skin=${skin}&touch=off`;
  globalThis.location = { search };
  globalThis.window = { location: { search }, matchMedia: () => ({ matches: false }) };
  const store = createBindings(); resetDefaults(store); setBindings(store);
  destroyWorldPlaque();
  try { return fn(store); } finally {
    destroyWorldPlaque();
    delete globalThis.document; delete globalThis.window; delete globalThis.location;
  }
}
const PILE3 = () => [body('foeCorpse:a', 1), body('foeCorpse:b', 1.2), body('foeCorpse:c', 1.4)];
const NAMES = { 'foeCorpse:a': 'Dead Orc', 'foeCorpse:b': 'Dead Rat', 'foeCorpse:c': 'Dead Imp' };
const hover = (extra = {}) => worldHoverFrame({ eye: EYE, dir: DIR, collider: open, targets: PILE3, name: (k) => (NAMES[k] ? { title: NAMES[k] } : null), contents: () => [], ...extra });

test('LOOT-STACK the pick answers the NEAREST and notes its pile: every reader of the ray means the front body, as DFU\'s one ray does; a list with no body leaves the note alone (a host casts several picks a frame); a lone body, or a ray that met no body, clears it (mutants: the pick answering a body behind the front; a list with no body clearing the note; a stale note kept after looking away)', () => {
  fresh();
  const a = body('corpse:0', 1), b = body('corpse:1', 1.2), c = body('corpse:2', 1.4);
  assert.deepEqual(pickActivatableHit(EYE, DIR, [c, b, a], open), { key: 'corpse:0', distance: 1, reach: CORPSE_ACTIVATION_DISTANCE }, 'the front body, at its own distance');
  assert.deepEqual(_bodyStackStateForTests().seen, ['corpse:0', 'corpse:1', 'corpse:2']);
  assert.equal(pickActivatableHit(EYE, DIR, [pile('droppedLoot:1', 0.5)], open).key, 'droppedLoot:1');
  assert.deepEqual(_bodyStackStateForTests().seen, ['corpse:0', 'corpse:1', 'corpse:2'], 'a pick over a list with no body is no question about bodies');
  assert.equal(pickActivatableHit([5, 0, 0], DIR, [a, b, c], open), null, 'looking at nothing');
  assert.equal(_bodyStackStateForTests().seen, null, 'looking away clears the note');
  pickActivatableHit(EYE, DIR, [a, b], open);
  assert.equal(pickActivatableHit(EYE, DIR, [a], open).key, 'corpse:0');
  assert.equal(_bodyStackStateForTests().seen, null, 'a body alone is no pile');
  // noteBodyStack is the pick's last word and changes it never
  pickActivatableHit(EYE, DIR, [a, b], open);
  const hit = { key: 'corpse:0', distance: 1, reach: 2 };
  assert.equal(noteBodyStack(hit, [a, b], () => null), hit, 'the very winner, handed back');
  assert.equal(noteBodyStack(null, [pile('droppedLoot:1', 3)], () => null), null);
  assert.equal(_bodyStackStateForTests().seen, null, 'a lone front (the walk found nothing behind) clears it');
});

test('LOOT-STACK the front body\'s race is the race it always was: a pile of drops lying between two bodies loses to the front body, and a drop in FRONT of the pile wins (mutant: none needed - the pick is the nearest; this pins that the pile changed no race)', () => {
  fresh();
  const a = body('foeCorpse:a', 1), b = body('foeCorpse:b', 1.2);
  const front = pickActivatableHit(EYE, DIR, [a, b], open);
  assert.equal(raceActivation({ corpse: front, pile: pickActivatableHit(EYE, DIR, [pile('droppedLoot:7', 1.1)], open) }).loot?.key, 'foeCorpse:a');
  assert.equal(raceActivation({ corpse: front, pile: pickActivatableHit(EYE, DIR, [pile('droppedLoot:7', 0.5)], open) }).drop?.key, 'droppedLoot:7');
});

test('LOOT-STACK bodyPile: the pile the press\'s body stands at the FRONT of, nearest first - and a body alone, or one the note does not stand at the front of, is a pile of one (mutants: the front check dropped, so a press on the second body reads the first\'s pile; the note handed out by reference)', () => {
  fresh();
  pickActivatableHit(EYE, DIR, [body('corpse:0', 1), body('corpse:1', 1.2), body('corpse:2', 1.4)], open);
  const p = bodyPile('corpse:0');
  assert.deepEqual(p, ['corpse:0', 'corpse:1', 'corpse:2']);
  p.push('x');
  assert.deepEqual(bodyPile('corpse:0'), ['corpse:0', 'corpse:1', 'corpse:2'], 'a copy');
  assert.deepEqual(bodyPile('corpse:1'), ['corpse:1'], 'not the front: its own pile of one');
  assert.deepEqual(bodyPile('corpse:9'), ['corpse:9']);
});

test('LOOT-STACK lootPile - the tabs: one per body the pool can open, in the pile\'s order, the open body always among them; fewer than two is no tab row; a tab opens its body through the host\'s door with the pile in hand, and the open body\'s own tab, or a body not in the row, opens nothing (mutants: the open body dropped when it reads empty; a single body drawn a tab row; the pile not carried; a tab onto the open body re-opening it)', () => {
  const words = { 'corpse:0': { name: 'Orc', count: 3 }, 'corpse:1': null, 'corpse:2': { name: 'Rat', count: 1 } };
  const opened = [];
  const keys = ['corpse:0', 'corpse:1', 'corpse:2'];
  const p = lootPile('corpse:0', { keys, describe: (k) => words[k] ?? null, open: (k, ks) => opened.push([k, ks]) });
  assert.deepEqual(p.bodies, [{ key: 'corpse:0', name: 'Orc', count: 3 }, { key: 'corpse:2', name: 'Rat', count: 1 }], 'the empty body is no tab');
  assert.equal(p.current, 'corpse:0');
  p.open('corpse:2');
  assert.deepEqual(opened, [['corpse:2', keys]], 'the host\'s door, handed the whole pile again so the row does not move');
  p.open('corpse:0'); p.open('corpse:1'); p.open('corpse:7');
  assert.equal(opened.length, 1, 'the open body, an untabbed body and a stranger open nothing');
  // the open body stands even when its word is null now (emptied under the player's hand)
  const q = lootPile('corpse:1', { keys, describe: (k) => words[k] ?? null, open: () => {} });
  assert.deepEqual(q.bodies.map((b) => b.key), ['corpse:0', 'corpse:1', 'corpse:2']);
  assert.equal(lootPile('corpse:0', { keys: ['corpse:0', 'corpse:1'], describe: (k) => words[k] ?? null, open: () => {} }), null, 'one body left to show: no row');
  // with no pile handed, the note is read - a press
  fresh();
  pickActivatableHit(EYE, DIR, [body('corpse:0', 1), body('corpse:2', 1.2)], open);
  assert.deepEqual(lootPile('corpse:0', { describe: (k) => words[k] ?? null, open: () => {} }).bodies.map((b) => b.key), ['corpse:0', 'corpse:2']);
});

test('LOOT-STACK pileBody - the pools\' word on a body: its name and what it holds; a disabled body, an empty one and a PUPPET\'s (its owner\'s to empty, no window here) are no tab (mutants: each of the three refusals dropped; the count off the wrong list)', () => {
  const orc = 7;   // ENEMY_NAMES[7]
  assert.deepEqual(pileBody({ mobileType: orc, entity: { items: [{}, {}] } }), { name: 'Orc', count: 2 });
  assert.equal(pileBody({ mobileType: orc, corpseDisabled: true, entity: { items: [{}] } }), null);
  assert.equal(pileBody({ mobileType: orc, entity: { items: [] } }), null);
  assert.equal(pileBody({ mobileType: orc, puppet: 'peer1', entity: { items: [{}] } }), null);
  assert.equal(pileBody(null), null);
});

test('LOOT-STACK the plaque counts the pile - "3 bodies" under the front body\'s name - and a body alone carries no mark (mutants: the mark gone; the mark on a lone body)', () => {
  withSkin('enhanced', () => {
    const f = hover();
    assert.equal(f.key, 'foeCorpse:a', 'the front body, as the press opens it');
    assert.equal(f.title, 'Dead Orc');
    assert.deepEqual(f.subs, [bodyStackText(3)]);
    assert.equal(bodyStackText(3), '3 bodies');
    assert.deepEqual(hover({ targets: () => [body('foeCorpse:a', 1)] }).subs, []);
  });
});

test('LOOT-STACK the teardown frees the note: destroyWorldPlaque - every host\'s door out - forgets the pile (mutant: the reset left out, so a pile noted in a dungeon hands the street\'s press a pile that is not there)', () => {
  fresh();
  pickActivatableHit(EYE, DIR, [body('corpse:0', 1), body('corpse:1', 1.2)], open);
  assert.ok(_bodyStackStateForTests().seen);
  destroyWorldPlaque();
  assert.deepEqual(_bodyStackStateForTests(), { seen: null });
  const wp = rd('src/ui/worldPlaque.js');
  assert.match(wp, /resetQuickLoot\(\);[\s\S]{0,200}resetBodyStack\(\);/, 'beside quick loot\'s state');
});

// ─── THE WINDOWS ───────────────────────────────────────────────────────────────────────────────────────────────────

const PILE = (opened) => ({
  bodies: [{ key: 'foeCorpse:1', name: 'Orc', count: 2 }, { key: 'foeCorpse:2', name: 'Rat', count: 1 }, { key: 'guardCorpse:3', name: 'Guard', count: 4 }],
  current: 'foeCorpse:1',
  open: (k) => opened.push(k),
});

test('LOOT-STACK the enhanced window: the pile is the BODY\'s frame\'s only - never the wagon\'s or a reward tray\'s; a tab per body with the open one lit and what each other holds; a tab click closes this window FIRST and then hands its body to the door (mutants: the pile on every frame; the lit tab clickable; the tab row dropped; the open before the close)', () => {
  const opened = [];
  const pile = PILE(opened);
  assert.equal(remoteModel({ loot: { items: () => [], pile } }).pile, pile);
  assert.equal(remoteModel({ loot: { items: () => [], pile } }, { usingWagon: true }).pile, null, 'the wagon');
  assert.equal(remoteModel({ loot: { items: () => [], pile } }, { chooseOne: true }).pile, null, 'a reward tray');
  assert.equal(remoteModel({}).pile, null);
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [], goldPieces: 0 };
    const order = [];
    let view = null;
    view = mountEnhancedInventory(host, {
      entity: e, items: () => e.items,
      loot: { items: () => [{ name: 'Ruby', templateIndex: 0, stackCount: 1 }], pile: { ...pile, open: (k) => { order.push(`open ${k}`); pile.open(k); } } },
      onExit: () => { order.push('exit'); view.unmount(); },
    });
    const tabs = host.querySelectorAll('.piletab');
    assert.equal(tabs.length, 3);
    assert.deepEqual(tabs.map((t) => t.querySelector('.piletabname').textContent), ['Orc', 'Rat', 'Guard']);
    assert.ok(tabs[0].classList.contains('on'));
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    assert.equal(tabs[0].onclick, null, 'the lit tab is the window already open');
    assert.equal(tabs[0].querySelector('.piletabn'), null);
    assert.equal(tabs[2].querySelector('.piletabn').textContent, '4');
    assert.equal(tabs[1].title, 'Rat: 1 item');
    assert.equal(host.querySelector('.piletabs').getAttribute('role'), 'tablist');
    tabs[2].onclick();
    assert.deepEqual(order, ['exit', 'open guardCorpse:3'], 'close, then hand over');
    assert.deepEqual(opened, ['guardCorpse:3']);
  });
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [], goldPieces: 0 };
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => [] }, onExit: () => view.unmount() });
    assert.equal(host.querySelector('.piletabs'), null, 'a body alone: no row');
  });
});

test('LOOT-STACK the classic window: the body\'s picture turns the pile - LEFT to the next body, RIGHT to the one before, wrapping - closing this window with the exit\'s own close and handing the body to the door; the label under the picture says where the open body stands; MIDDLE, the wagon, and a body alone keep the drop-icon panel\'s own law (mutants: no wrap; RIGHT stepping forward; the open before the close; the turn over the wagon)', () => {
  const [rx, ry] = REMOTE_TARGET_ICON_RECT;
  const at = [rx + 5, ry + 5];
  const mk = (opened, extra = {}) => new NativeInventoryWindow({
    items: () => [], entity: { items: [], activeEffects: [] }, icons: ICONS,
    loot: { items: () => [], playerOwned: false, textureArchive: 380, textureRecord: 1, pile: PILE(opened) }, ...extra,
  });
  let opened = [];
  let w = mk(opened);
  assert.equal(w._remoteTargetIcon().label, '1 of 3');
  w.click(...at);
  assert.equal(w.done, true, 'this window closed');
  assert.deepEqual(opened, ['foeCorpse:2'], 'the next body');
  opened = []; w = mk(opened);
  w.click(...at, true);
  assert.deepEqual(opened, ['guardCorpse:3'], 'RIGHT: the one before, wrapping to the back');
  opened = []; w = mk(opened);
  w.click(...at, false, true);
  assert.deepEqual(opened, [], 'MIDDLE is the archive step, which a body refuses');
  assert.equal(w.done, false);
  w.usingWagon = true;
  w.click(...at);
  assert.deepEqual(opened, [], 'the wagon has no pile');
  assert.equal(pileLabel(null), '');
  assert.equal(pileLabel({ bodies: [{ key: 'a' }, { key: 'b' }], current: 'b' }), '2 of 2');
  const alone = new NativeInventoryWindow({ items: () => [], entity: { items: [], activeEffects: [] }, icons: ICONS, loot: { items: () => [], playerOwned: false, textureArchive: 380, textureRecord: 1 } });
  assert.equal(alone._remoteTargetIcon().label, '');
  alone.click(...at);
  assert.equal(alone.done, false, 'a body alone: the click the panel always refused');
  const src = rd('src/ui/nativeInventory.js');
  assert.ok(src.includes('    this._close();\n    pile.open(next.key);'), 'by source: the window closed, then the body handed over');
});

// ─── THE HOSTS, AND THE KEY THAT IS GONE ───────────────────────────────────────────────────────────────────────────

test('LOOT-STACK the hosts by source: all four corpse doors hand the window the pile - the pool\'s own takeLoot still first (its refusals, the arrows, a puppet\'s ask), quick loot on a PRESS only, a tab back through the same door with the pile in hand; a pile may mix the two pools, so each key answers to its own (mutants: quick loot taking on a tab; the pile dropped from a host; one pool asked for both)', () => {
  const door = /const openBodyLoot = \(lootKey, pileKeys = null\) => \{\n\s*bodyPool\(lootKey\)\??\.takeLoot\(lootKey, [^\n]*\n(?:[^\n]*\n)?\s*if \(!pileKeys && quickLootTake\(lootKey, loot, [^\n]*\n\s*const pile = lootPile\(lootKey, \{ keys: pileKeys, describe: \(k\) => bodyPool\(k\)\??\.pileBody\(k\)(?: \?\? null)?, open: openBodyLoot \}\);\n/;
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const s = rd(f);
    assert.match(s, door, `${f}: the door`);
    assert.match(s, /openBodyLoot\((?:lootKey|key)\);/, `${f}: the press goes through it`);
    assert.match(s, /\{ loot: pile \? \{ \.\.\.loot, pile \} : loot \}/, `${f}: the window is handed the pile`);
    assert.match(s, /const bodyPool = \((?:k|lootKey)\) => \((?:k|lootKey)\.startsWith\('foeCorpse:'\) \? (?:exteriorFoes|interiorFoes) : (?:cityGuards|interiorGuards)\);/, `${f}: each key to its own pool`);
  }
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /takeLoot\(key, mode = 'grab', pileKeys = null\) \{/);
  assert.match(dc, /if \(!pileKeys && quickLootTake\(key, /);
  assert.match(dc, /const pile = kind === 'corpse' \? lootPile\(key, \{\n\s*keys: pileKeys,\n\s*describe: \(k\) => \{ const b = foes\[Number\(k\.split\(':'\)\[1\]\)\]; return b\?\.dead \? pileBody\(b\) : null; \},\n\s*open: \(k, keys\) => \{ this\.takeLoot\(k, 'grab', keys\); \},\n\s*\}\) : null;\n\s*if \(pile\) lootHooks = \{ \.\.\.\(lootHooks \?\? \{\}\), pile \};/);
  // a tab closes its window and opens the next in one click, before the frame's drain empties the slot
  assert.match(dc, /if \(activeOverlay && !activeOverlay\.done\) return source\.length;/);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) assert.match(rd(f), /pileBody: \(key\) => pileBody\(corpseEntryFor\((?:foes|guards), key, '(?:foe|guard)Corpse', corpseLens\)\),/, `${f}: the pool's word on a body`);
});

test('LOOT-STACK the key is gone: no NextBody action, no default on ], no controls row, and no host arms a turn - the pile lives in the window (mutant: a host still arming one)', () => {
  assert.ok(!ACTIONS.includes('NextBody'));
  assert.ok(!DEFAULT_BINDINGS.some(([c, a]) => c === 'BracketRight' || a === 'NextBody'));
  assert.ok(!PORT_ROWS.some((r) => r.action === 'NextBody'));
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/ui/worldPlaque.js']) {
    assert.doesNotMatch(rd(f), /NextBody|armBodyTurn|turnBodyStack/, f);
  }
  const act = rd('src/player/activate.js');
  assert.match(act, /export function pickActivatableHit\(eye, dir, targets, collider\) \{\n {2}return noteBodyStack\(nearestActivatableHit\(eye, dir, targets, collider\), targets, \(rest\) => nearestActivatableHit\(eye, dir, rest, collider\)\);\n\}/);
  assert.doesNotMatch(act, /export function nearestActivatableHit/, 'the raw pick stays private, so no reader asks the ray without the note');
});

// ─── THE PRODUCERS, AND THE PLAQUE'S DRESS ──────────────────────────────────────────────────────────────────────────

test('LOOT-STACK the producers say which targets are bodies: the two surface pools\' corpses and the dungeon\'s own; a pile, a door or a live foe never is - and the pick reads the word, never a key\'s prefix (mutants: the mark dropped from a producer; the stack sniffing key prefixes)', () => {
  const t = corpseLootTargets([{ corpse: true }], 'foeCorpse', { isCorpse: () => true, feetOf: () => [0, 0, 0] });
  assert.equal(t[0].body, true);
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /targets\.push\(\{ key: `corpse:\$\{i\}`, [^\n]*reach: CORPSE_ACTIVATION_DISTANCE, body: true \}\);/, 'the dungeon\'s corpse mint');
  assert.match(dc, /targets\.push\(\{ key: `loot:\$\{i\}`, [^\n]*reach: TREASURE_ACTIVATION_DISTANCE \}\);/, 'the dungeon\'s treasure piles carry no such word');
  const ls = rd('src/player/lootStack.js');
  assert.doesNotMatch(ls.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /startsWith|Corpse:|corpse:/, 'the law names no key vocabulary');
  // a body-shaped target WITHOUT the word is no member: the pile of two reads as one body and nothing behind it
  fresh();
  const unmarked = [{ ...body('corpse:0', 1), body: false }, { ...body('corpse:1', 1.2), body: false }];
  assert.equal(pickActivatableHit(EYE, DIR, unmarked, open).key, 'corpse:0');
  assert.equal(bodyStackMark('corpse:0'), null);
});

test('LOOT-STACK the plaque\'s dress, which tools/lootStackProbe.mjs measures in Chromium: the divider is the LIST\'s top edge, under the whole label (a sub-line - a pile\'s mark, a chest\'s lock level - is the label\'s, never the list\'s first row); the lit band\'s margin is the plaque\'s own padding at every width and its padding matches it, so the lit name stands where every name stands; the list clips DOWNWARD only (mutants: the divider back at the title\'s foot; the band\'s margin a literal; the band\'s left padding 12; the narrow sheet\'s padding a literal; the clip across again)', () => {
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\n\.wplaque-list \{ padding-top: 8px; margin-top: 8px; border-top: 2px solid rgba\(125,116,96,0\.3\); \}/, 'the divider on the list');
  assert.doesNotMatch(css, /\.wplaque-title \{[^}]*border-bottom/, 'and nowhere at the title\'s foot');
  assert.match(css, /\n\.wplaque \{[\s\S]{0,300}?--wp-pad-x: 14px; padding: 10px var\(--wp-pad-x\);/, 'the plaque\'s padding is one number');   // (its rule holds a ${} placeholder, so no [^}] walk)
  assert.match(css, /@media \(max-width: 720px\) \{ \.wplaque \{ max-width: 88vw; --wp-pad-x: 12px; padding: 8px var\(--wp-pad-x\); \}/, '...and the narrow sheet sets that number, not the padding beside it');
  assert.match(css, /\.wplaque-row\.sel \{[^}]*margin: 0 calc\(-1 \* var\(--wp-pad-x\)\); padding: 0 var\(--wp-pad-x\); \}/, 'the band reaches the plaque\'s inner edges and moves no name');
  assert.match(css, /\.wplaque-list \{ display: block; max-height: [^}]*overflow: hidden; overflow-x: visible; overflow-y: clip; \}/, 'the cap clips down, not across');
});
