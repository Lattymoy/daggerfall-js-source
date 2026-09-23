// LOOT-STACK (2026-09-23, the community arc - Janome on Discord: "a toggle key to switch between the inventories of
// enemies stacked on top of each other"): THE PILE OF BODIES, DRIVEN. The stack along the real pick
// (player/activate.js) over real ray geometry - its members, its reach, the world occluding one, a list with no body
// untouched; the choice by key and its forgetting; the chosen body standing at the nearest's distance, so the race
// against a pile of drops cannot steal the click; the turn, its wrap and its refusal when the pile did not win; the
// plaque's mark and the turn's line through the one seam four hosts call, on both skins; the producers' mark; the
// action, its key by elimination and its row; and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pickActivatableHit, RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { bodyStack, chooseBody, armBodyTurn, bodyTurnArmed, dropBodyTurns, turnBodyStack, bodyTurnText, bodyStackMark, resetBodyStack, _bodyStackStateForTests } from '../src/player/lootStack.js';
import { raceActivation } from '../src/player/activationRace.js';
import { corpseLootTargets } from '../src/scenes/corpseMarker.js';
import { worldHoverFrame, destroyWorldPlaque, NEXT_BODY_ACTION } from '../src/ui/worldPlaque.js';
import { midScreenText } from '../src/ui/midScreenText.js';
import { setBindings } from '../src/ui/input.js';
import { ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS, createBindings, resetDefaults, setBinding, getBinding } from '../src/systems/inputActions.js';
import { PORT_GROUPS, LOOT_GROUP_TITLE } from '../src/ui/enhancedControls.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { domCodeForKeyCode } from '../src/systems/keyCodes.js';

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
  assert.deepEqual(bodyStackMark('foeCorpse:a'), { index: 0, count: 2 }, 'the walk behind the front body sees the world the front one was picked through');
  pickActivatableHit(EYE, DIR, targets, open);
  assert.deepEqual(bodyStackMark('foeCorpse:a'), { index: 0, count: 3 });
  // the nearest out of reach: the handler refuses it ("You are too far away"), and the bodies behind are further still
  assert.deepEqual(bodyStack({ key: 'foeCorpse:far', distance: 10, reach: CORPSE_ACTIVATION_DISTANCE }, [far, body('foeCorpse:far2', 10.2)], nearest([])).map((h) => h.key), ['foeCorpse:far']);
  assert.deepEqual(bodyStack(null, targets, nearest(targets)), []);
});

test('LOOT-STACK the pick: a list with no body is untouched and says nothing about bodies; a lone body is the pick as ever; the pile marks where each body stands, and a choice by KEY survives the two trading places (mutants: a list with no body clearing the choice; the choice held as a position)', () => {
  fresh();
  const a = body('corpse:0', 1), b = body('corpse:1', 1.2);
  // a door-and-pile list: no body in it, so nothing about the pile is decided here
  const drops = [pile('droppedLoot:1', 0.5)];
  pickActivatableHit(EYE, DIR, [a, b], open);
  armBodyTurn();
  assert.deepEqual(turnBodyStack({ key: 'corpse:0' }), { index: 1, count: 2 });
  assert.equal(pickActivatableHit(EYE, DIR, drops, open).key, 'droppedLoot:1');
  assert.equal(_bodyStackStateForTests().chosen, 'corpse:1', 'a pick over a list with no body leaves the pile\'s choice alone - a host casts several picks a frame');
  assert.equal(pickActivatableHit(EYE, DIR, [a, b], open).key, 'corpse:1', 'the turned-to body answers');
  // the two sway past each other: the choice is the BODY, not "the second one"
  const swapped = [body('corpse:0', 1.2), body('corpse:1', 1)];
  assert.equal(pickActivatableHit(EYE, DIR, swapped, open).key, 'corpse:1', 'still the body the player chose, now in front');
  assert.deepEqual(bodyStackMark('corpse:1'), { index: 0, count: 2 });
  assert.equal(bodyStackMark('droppedLoot:1'), null);
  // a lone body: the pick as it always was, and no mark
  fresh();
  assert.equal(pickActivatableHit(EYE, DIR, [a], open).key, 'corpse:0');
  assert.equal(bodyStackMark('corpse:0'), null, 'a body alone is no pile');
});

test('LOOT-STACK the chosen body stands where the NEAREST stood: the race against a pile of drops lying between two bodies still gives the click to the pile of bodies, and the enemy arm and the reach gate read the front body\'s distance (mutant: the chosen body handed on at its own distance, so the drop between steals the click the player turned for)', () => {
  fresh();
  const a = body('foeCorpse:a', 1), b = body('foeCorpse:b', 1.2);
  pickActivatableHit(EYE, DIR, [a, b], open);
  armBodyTurn();
  turnBodyStack({ key: 'foeCorpse:a' });
  const chosen = pickActivatableHit(EYE, DIR, [a, b], open);
  assert.deepEqual(chosen, { key: 'foeCorpse:b', distance: 1, reach: CORPSE_ACTIVATION_DISTANCE });
  const drop = pickActivatableHit(EYE, DIR, [pile('droppedLoot:7', 1.1)], open);
  assert.equal(drop.distance, 1.1, 'the drop lies between the two bodies');
  const won = raceActivation({ corpse: chosen, pile: drop });
  assert.equal(won.loot?.key, 'foeCorpse:b', 'the pile of bodies is one thing under the ray, at its front - and the body answering is the one the player turned to');
  assert.equal(won.drop, null);
});

test('LOOT-STACK the choice forgotten: a pick over the bodies whose winner is none of them (the player looked away), and a chosen body gone from the pile (emptied and disabled), both hand the nearest back (mutants: a stale choice kept after looking away; a vanished body chosen)', () => {
  fresh();
  const a = body('foeCorpse:a', 1), b = body('foeCorpse:b', 1.2), c = body('foeCorpse:c', 1.4);
  pickActivatableHit(EYE, DIR, [a, b, c], open);
  armBodyTurn(); armBodyTurn();
  assert.deepEqual(turnBodyStack({ key: 'foeCorpse:a' }), { index: 2, count: 3 }, 'two turns in one frame are two steps');
  assert.equal(pickActivatableHit(EYE, DIR, [a, b, c], open).key, 'foeCorpse:c');
  // the chosen body is emptied and disabled: it is no target now
  assert.equal(pickActivatableHit(EYE, DIR, [a, b], open).key, 'foeCorpse:a', 'the pile shrank past the choice - the nearest answers');
  assert.equal(_bodyStackStateForTests().chosen, null);
  // turned again, then the player looks away: the same list, and the ray meets no body
  pickActivatableHit(EYE, DIR, [a, b], open);
  armBodyTurn();
  turnBodyStack({ key: 'foeCorpse:a' });
  assert.equal(pickActivatableHit([5, 0, 0], DIR, [a, b], open), null, 'looking at nothing');
  assert.equal(_bodyStackStateForTests().chosen, null, 'looking away forgets the choice');
  assert.equal(pickActivatableHit(EYE, DIR, [a, b], open).key, 'foeCorpse:a', 'and looking back starts at the front');
});

test('LOOT-STACK the turn: one step on the stack the reticle\'s winner stands in, wrapping at the back; a turn when a door or a foe won the race turns nothing and is spent; a window over the world drops an armed turn; it speaks DFU\'s mid-screen words (mutants: the turn applied to a pile that lost the race; no wrap; an armed turn kept past the frame)', () => {
  fresh();
  const a = body('corpse:0', 1), b = body('corpse:1', 1.2), c = body('corpse:2', 1.4);
  pickActivatableHit(EYE, DIR, [a, b, c], open);
  assert.equal(turnBodyStack({ key: 'corpse:0' }), null, 'nothing armed, nothing turned');
  assert.equal(armBodyTurn(), true);
  assert.equal(bodyTurnArmed(), true);
  assert.deepEqual(turnBodyStack({ key: 'corpse:0' }), { index: 1, count: 3 });
  assert.equal(bodyTurnArmed(), false, 'spent by the frame that turned it');
  armBodyTurn(); turnBodyStack({ key: 'corpse:1' });
  armBodyTurn();
  assert.deepEqual(turnBodyStack({ key: 'corpse:2' }), { index: 0, count: 3 }, 'the back of the pile turns to its front');
  // the reticle's winner is a door in front of the pile: the press would open the door, so nothing turns
  armBodyTurn();
  assert.equal(turnBodyStack({ key: 'door:3' }), null);
  assert.equal(bodyTurnArmed(), false, 'and the turn is spent on it, never kept for later');
  armBodyTurn();
  dropBodyTurns();
  assert.equal(bodyTurnArmed(), false);
  assert.equal(bodyTurnText({ index: 1, count: 3 }), 'Body 2 of 3.');
});

// ─── THE PLAQUE AND THE LINE: the one seam four hosts call ─────────────────────────────────────────────────────────

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
  midScreenText.text = '';
  try { return fn(store); } finally {
    destroyWorldPlaque();
    delete globalThis.document; delete globalThis.window; delete globalThis.location;
  }
}
const PILE3 = () => [body('foeCorpse:a', 1), body('foeCorpse:b', 1.2), body('foeCorpse:c', 1.4)];
const NAMES = { 'foeCorpse:a': 'Dead Orc', 'foeCorpse:b': 'Dead Rat', 'foeCorpse:c': 'Dead Imp' };
const hover = (extra = {}) => worldHoverFrame({ eye: EYE, dir: DIR, collider: open, targets: PILE3, name: (k) => (NAMES[k] ? { title: NAMES[k] } : null), contents: () => [], ...extra });

test('LOOT-STACK the plaque: a body in a pile says where it stands in it and the key that turns it, off the LIVE bindings (a rebind renames it, an unbound action names no key); a turn is spent by the seam, speaks "Body 2 of 3." and the plaque names the body the next press opens; a window up drops it (mutants: the mark gone; the key named from a literal; the seam turning without the pick again; the turn kept under a window)', () => {
  withSkin('enhanced', (store) => {
    const f1 = hover();
    assert.equal(f1.key, 'foeCorpse:a');
    assert.equal(f1.title, 'Dead Orc');
    assert.deepEqual(f1.subs, ['1 of 3 · ] for the next'], 'the pile, and the key that turns it - the classic short name, as the diamond names its keys');
    armBodyTurn();
    const f2 = hover();
    assert.equal(f2.key, 'foeCorpse:b', 'the plaque names the body the next press will open');
    assert.deepEqual(f2.subs, ['2 of 3 · ] for the next']);
    assert.equal(midScreenText.text, 'Body 2 of 3.', 'the turn speaks in DFU\'s mid-screen voice');
    assert.equal(hover().key, 'foeCorpse:b', 'and the choice holds from frame to frame');
    // rebound to N: the plaque says N
    setBinding(store, 'KeyN', NEXT_BODY_ACTION);
    assert.equal(getBinding(store, NEXT_BODY_ACTION), 'KeyN');
    assert.deepEqual(hover().subs, ['2 of 3 · N for the next']);
    // bound to nothing: the mark stands, with no key to press named
    setBinding(store, 'KeyN', 'NoteBook');
    assert.equal(getBinding(store, NEXT_BODY_ACTION) ?? null, null);
    assert.deepEqual(hover().subs, ['2 of 3']);
    // a window over the world: the turn armed before it is dropped, not landed after it
    armBodyTurn();
    assert.equal(hover({ cursorActive: true }), null);
    assert.equal(bodyTurnArmed(), false);
    assert.equal(hover().key, 'foeCorpse:b', 'nothing turned');
  });
});

test('LOOT-STACK the classic skin turns a pile too: no plaque is drawn, the seam still spends the turn on the reticle\'s own pick and says the line - DFU\'s mid-screen line is the plaque a classic player has; with no turn armed it does nothing at all, as before (mutants: the turn gated behind the plaque\'s skin gate; the classic frame picking every frame)', () => {
  withSkin('classic', () => {
    let picks = 0;
    const counted = () => { picks += 1; return PILE3(); };
    assert.equal(hover({ targets: counted }), null, 'nothing drawn');
    assert.equal(picks, 0, 'and no turn armed: the classic frame casts no ray, as it never did');
    armBodyTurn();
    assert.equal(hover({ targets: counted }), null);
    assert.ok(picks >= 1, 'a turn armed: the seam casts the reticle\'s ray');
    assert.equal(midScreenText.text, 'Body 2 of 3.');
    assert.equal(pickActivatableHit(EYE, DIR, PILE3(), open).key, 'foeCorpse:b', 'and the next press opens the second body');
  });
});

test('LOOT-STACK the teardown frees it: destroyWorldPlaque - every host\'s door out - forgets the choice, the stack and an armed turn (mutant: the reset left out, so a choice made in a dungeon points the street\'s press at a body that is not there)', () => {
  fresh();
  const a = body('corpse:0', 1), b = body('corpse:1', 1.2);
  pickActivatableHit(EYE, DIR, [a, b], open);
  armBodyTurn(); turnBodyStack({ key: 'corpse:0' }); armBodyTurn();
  assert.equal(_bodyStackStateForTests().chosen, 'corpse:1');
  destroyWorldPlaque();
  assert.deepEqual(_bodyStackStateForTests(), { chosen: null, seen: null, turns: 0 });
});

// ─── THE PRODUCERS, THE ACTION, THE HOSTS ──────────────────────────────────────────────────────────────────────────

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

test('LOOT-STACK the action: NextBody appended past every row a saved file resolves by position, a port row the classic windows yield, defaulted to ] - free of DFU\'s table, the port\'s own keys and every vendored mod\'s shipped and offered keys - and drawn in the enhanced pane under Loot (mutants: the default on a spent key; the row missing from the pane)', () => {
  assert.equal(ACTIONS.at(-1), NEXT_BODY_ACTION);
  assert.ok(PORT_ACTIONS.includes(NEXT_BODY_ACTION));
  const row = DEFAULT_BINDINGS.find(([, a]) => a === NEXT_BODY_ACTION);
  assert.deepEqual(row, ['BracketRight', 'NextBody']);
  assert.equal(DEFAULT_BINDINGS.filter(([c]) => c === 'BracketRight').length, 1, 'nothing else defaults to ]');
  const modKeys = new Set();
  for (const mod of Object.values(MOD_SETTINGS)) {
    for (const def of Object.values(mod.keys)) {
      if (def.text && !def.axis && typeof def.default === 'string' && def.default) modKeys.add(domCodeForKeyCode(def.default));
      if (def.keyChoice) for (const o of def.options) { const c = domCodeForKeyCode(o); if (c) modKeys.add(c); }
    }
  }
  assert.ok(modKeys.size >= 5 && !modKeys.has('BracketRight'), 'no vendored mod ships ] or offers it');
  assert.ok(!['Tab', 'Escape'].includes(row[0]), 'nor is it the port\'s dial or its door out');
  assert.equal(LOOT_GROUP_TITLE, 'Loot');
  const loot = PORT_GROUPS.find((g) => g.title === LOOT_GROUP_TITLE);
  assert.deepEqual(loot.rows.map((r) => r.action), ['QuickLootAll', 'QuickLootOpen', 'NextBody']);
});

test('LOOT-STACK the hosts by source: each of the three key ladders ARMS a turn beside the pile\'s other two keys under the same gate, and fires nothing - no one-frame activate, so a foe, a townsperson or a door in front of the pile is never activated by it; the ray\'s raw pick is private to activate.js, so no reader can ask the ray without the pile\'s word (mutants: the turn firing the activate latch; a host reading a raw pick)', () => {
  for (const [file, gate] of [
    ['src/scenes/world.js', "if (!townTalk.overlayActive && socialMenuCanOpen() && act === 'NextBody' && armBodyTurn()) { e.preventDefault(); return; }"],
    ['src/scenes/exterior.js', "if (!townTalk.overlayActive && act === 'NextBody' && armBodyTurn()) { e.preventDefault(); return; }"],
    ['src/scenes/dungeon.js', "if (!ctx.uiOverlayActive && actionOf(e, keys) === 'NextBody' && armBodyTurn()) { e.preventDefault(); return; }"],
  ]) {
    const s = rd(file);
    // the WHOLE statement, matched exactly: a turn that also set the one-frame activate latch (`_tapArmed`) - an
    // activation the pile's key must never fire - is a different statement, and this goes red
    const at = s.indexOf(gate);
    assert.ok(at > 0, `${file} arms the turn, and fires nothing`);
    const qa = s.lastIndexOf('quickLootArm(', at);
    assert.ok(qa > 0 && at - qa < 1500, `${file}: just after quick loot's two keys, under the same gate`);
  }
  const act = rd('src/player/activate.js');
  assert.match(act, /export function pickActivatableHit\(eye, dir, targets, collider\) \{\n {2}return chooseBody\(nearestActivatableHit\(eye, dir, targets, collider\), targets, \(rest\) => nearestActivatableHit\(eye, dir, rest, collider\)\);\n\}/);
  assert.match(act, /\nfunction nearestActivatableHit\(/);
  assert.doesNotMatch(act, /export function nearestActivatableHit/);
  const wp = rd('src/ui/worldPlaque.js');
  assert.match(wp, /resetQuickLoot\(\);[\s\S]{0,200}resetBodyStack\(\);/, 'the teardown frees it beside quick loot\'s state');
});

test('LOOT-STACK chooseBody is the pick\'s last word and nothing more: a null winner over a list with bodies forgets; over a list without, it is left alone (mutant: the early return for a list with no bodies removed)', () => {
  fresh();
  const a = body('corpse:0', 1), b = body('corpse:1', 1.2);
  pickActivatableHit(EYE, DIR, [a, b], open);
  armBodyTurn(); turnBodyStack({ key: 'corpse:0' });
  assert.equal(chooseBody(null, [pile('droppedLoot:1', 3)], () => null), null);
  assert.equal(_bodyStackStateForTests().chosen, 'corpse:1', 'a list with no body is no question about bodies');
  assert.equal(chooseBody(null, [a, b], () => null), null);
  assert.equal(_bodyStackStateForTests().chosen, null, 'a list with bodies whose ray met none of them');
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
