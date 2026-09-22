// QUICK-LOOT - TAKING FROM THE PLAQUE, DRIVEN.
//
// Arc B of the world-hover arcs. Arc A put a plaque under the crosshair
// that names what you are looking at and lists what a pile or a body
// holds; this file drives the half that makes that list a way to TAKE.
//
// WHY IT IS ITS OWN FILE. The first pass pinned Arc B's hosts by source
// text - "the rung is on this line, in this order" - and pinned nothing
// about what the feature DOES. A 24-mutant campaign killed two of its
// own mutants and let twenty-two live, which is the honest measure of
// what a source sweep proves: that a line is PRESENT, never that it
// works. Every test below drives the real module and dies under a
// one-line change to the law it names - the mutant that names it is in
// `tools/mutants/quickloot.json`.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nextSelection, selectedRow, hoverItemAt, hoverItems, hoverLines, HOVER_MAX,
} from '../src/systems/worldHover.js';
import { takeOneInto, GOLD_TEMPLATE } from '../src/systems/inventory.js';
import {
  quickLootOn, tookItemText, containerEmptied, quickLootWheel, foldQuickLoot,
  quickLootRow, quickLootSelection, resetQuickLoot, quickLootTake, quickLootArm,
} from '../src/systems/quickLoot.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';

// ── FIXTURES ─────────────────────────────────────────────────────

const gold = (n) => ({ name: 'Gold', group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: n });
const item = (name, extra = {}) => ({ name, group: 'Weapons', templateIndex: 121, ...extra });
const player = () => ({ items: [], goldPieces: 0 });

/** A frame as `resolveHover` mints one - the shape the fold is asked
 *  about. TEST THE SHAPE THE PRODUCER MINTS: the rows are `hoverLines`'
 *  own, so a fixture cannot drift from what the plaque draws. */
const frameOf = (key, items) => {
  const { shown, rest, empty } = hoverLines(items);
  return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
};

/** The feature with its switch on and its state clean, restored after. */
function withQuickLoot(fn, on = true) {
  setPref('quickLoot', on);
  resetQuickLoot();
  try { return fn(); } finally { resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
}

/** The container door a host hands over - `items()` live, as the
 *  inventory window is given it. */
const hooks = (items) => ({ items: () => items });

// ── THE FOLD, AS A PURE LAW ──────────────────────────────────────

test('QUICK-LOOT: the highlight starts at the top and STOPS at both ends', () => {
  const f = frameOf('pile:1', [item('Ruby'), item('Longsword'), item('Shield')]);
  // no selection yet: the first fold lands on row 0 whatever the nudge
  assert.deepEqual(nextSelection(null, f, 0), { key: 'pile:1', row: 0 });
  assert.deepEqual(nextSelection(null, f, 5), { key: 'pile:1', row: 0 },
    'a nudge with nothing to move from still starts at the top');
  // down the list, one notch at a time
  let sel = nextSelection(null, f);
  sel = nextSelection(sel, f, 1); assert.equal(sel.row, 1);
  sel = nextSelection(sel, f, 1); assert.equal(sel.row, 2);
  // ...and the bottom HOLDS. It neither runs past the last row nor
  // wraps to the top: a highlight off the end points the take at
  // nothing, and a wrap makes a flick of a trackpad unpredictable.
  sel = nextSelection(sel, f, 1);
  assert.deepEqual(sel, { key: 'pile:1', row: 2 }, 'the last row is the floor of the list');
  sel = nextSelection(sel, f, 40);
  assert.equal(sel.row, 2, 'and a trackpad flick cannot throw it off the end');
  // the same at the top
  sel = nextSelection(sel, f, -40);
  assert.deepEqual(sel, { key: 'pile:1', row: 0 }, 'nor off the top');
});

test('QUICK-LOOT: a different container starts over, and a listless frame has no highlight', () => {
  const a = frameOf('pile:1', [item('Ruby'), item('Longsword'), item('Shield')]);
  const b = frameOf('pile:2', [item('Dagger'), item('Buckler')]);
  const at2 = nextSelection(nextSelection(null, a), a, 2);
  assert.equal(at2.row, 2);
  // THE KEY IS PART OF THE SELECTION. Carrying row 2 onto the next
  // container would light a row the player never chose - and on a
  // shorter list, one that is not there.
  assert.deepEqual(nextSelection(at2, b, 0), { key: 'pile:2', row: 0 },
    'a new container is looked at from the top');
  // a door, a wall, a foe - anything with no list - clears it
  const door = { key: 'door:7', kind: 'name', title: 'Door', subs: [], rows: [], rest: 0, empty: false };
  assert.equal(nextSelection(at2, door, 0), null, 'nothing to highlight, so nothing is');
  assert.equal(nextSelection(at2, null, 0), null, 'and the same for no frame at all');
});

test('QUICK-LOOT: the lit row is the FRAME\'s, and only while the frame still has it', () => {
  const f = frameOf('pile:1', [item('Ruby'), item('Longsword')]);
  const sel = nextSelection(nextSelection(null, f), f, 1);
  assert.equal(selectedRow(sel, f), 1);
  // a selection about another container lights nothing here - the draw
  // asks this per frame, so a stale answer lights a row of the wrong list
  assert.equal(selectedRow(sel, frameOf('pile:2', [item('Dagger'), item('Buckler')])), -1);
  // ...and a list that SHRANK under the highlight (another player took
  // the row, the pile emptied) lights nothing rather than a row that
  // is no longer drawn
  assert.equal(selectedRow(sel, frameOf('pile:1', [item('Ruby')])), -1);
  assert.equal(selectedRow(null, f), -1);
});

test('QUICK-LOOT: the row -> item walk is the DRAW\'s own, holes and tail included', () => {
  // The rows the plaque draws are `hoverItems`', which drops the holes
  // a pack can carry; a walk over the raw list would hand row 1 the
  // wrong item the moment a container held a null.
  const items = [item('Ruby'), null, item('Longsword')];
  assert.deepEqual(hoverItems(items).map((i) => i.name), ['Ruby', 'Longsword']);
  assert.equal(hoverItemAt(items, 0).name, 'Ruby');
  assert.equal(hoverItemAt(items, 1).name, 'Longsword', 'the hole is not a row, so it is not an item either');
  assert.equal(hoverItemAt(items, 2), null);
  // ...and the TAIL takes nothing. Row HOVER_MAX is the "and N more"
  // line, which names nothing, so it must not hand over item N.
  const many = Array.from({ length: HOVER_MAX + 3 }, (_, i) => item(`Thing ${i}`));
  assert.equal(hoverLines(many).shown.length, HOVER_MAX);
  assert.equal(hoverItemAt(many, HOVER_MAX - 1).name, `Thing ${HOVER_MAX - 1}`);
  assert.equal(hoverItemAt(many, HOVER_MAX), null, 'the "and N more" row takes nothing');
  assert.equal(hoverItemAt(items, -1), null);
  assert.equal(hoverItemAt(items, 1.5), null);
});

// ── THE MOVE, AND THE GOLD DOOR IN IT ────────────────────────────

test('QUICK-LOOT: takeOneInto is DoTransferItem\'s first statement - gold to the counter, never the list', () => {
  const p = player();
  p.goldPieces = 3;
  const list = [gold(7), item('Longsword')];
  assert.equal(takeOneInto(p, list, list[0]).stackCount, 7, 'it answers the item it moved');
  assert.equal(p.goldPieces, 10, 'a purse is SPENT');
  assert.deepEqual(p.items, [], '...and never listed');
  assert.equal(list.length, 1, 'and it LEAVES the container - a take that copies is a duplication bug');
  takeOneInto(p, list, list[0]);
  assert.deepEqual(p.items.map((i) => i.name), ['Longsword']);
  assert.deepEqual(list, [], 'the container is empty now');
});

test('QUICK-LOOT: the door refuses what the container does not hold', () => {
  const p = player();
  const list = [item('Ruby')];
  assert.equal(takeOneInto(p, list, item('Ruby')), null,
    'a look-alike is not the same object - a take must name the row it saw');
  assert.deepEqual(p.items, [], 'and nothing is minted out of nowhere');
  assert.equal(list.length, 1);
  assert.equal(takeOneInto(null, list, list[0]), null);
  assert.equal(takeOneInto(p, null, list[0]), null);
  assert.equal(takeOneInto(p, list, null), null);
});

// ── THE WHEEL ────────────────────────────────────────────────────

test('QUICK-LOOT: the wheel is the plaque\'s only while it is listing something', () => withQuickLoot(() => {
  const f = frameOf('pile:1', [item('Ruby'), item('Longsword'), item('Shield')]);
  // nothing folded yet, so there is no highlight and the click is not ours
  assert.equal(quickLootWheel(120), false, 'the camera keeps the wheel until there is a list');
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 0);
  // DOWN THE PAGE IS DOWN THE LIST. The camera door above reads the
  // other way round, which is exactly why the sign is worth a pin.
  assert.equal(quickLootWheel(120), true, 'it takes the click');
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 1, 'a notch down the page moves DOWN the list');
  quickLootWheel(-120);
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 0, 'and up is up');
  assert.equal(quickLootWheel(0), false, 'a zero delta is not a notch');
  // look away, and the wheel goes back to the camera on the next frame
  foldQuickLoot(null);
  assert.equal(quickLootSelection(), null);
  assert.equal(quickLootWheel(120), false);
}));

test('QUICK-LOOT: a trackpad\'s dozen events are ONE fold, and the nudge is spent either way', () => withQuickLoot(() => {
  const f = frameOf('pile:1', Array.from({ length: 6 }, (_, i) => item(`Thing ${i}`)));
  foldQuickLoot(f);
  for (let i = 0; i < 3; i += 1) quickLootWheel(120);
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 3, 'three clicks between two frames move three rows, not nine');
  // ...and the nudge is SPENT by that fold. A click that survived its
  // frame would arrive later at whatever the crosshair had moved to.
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 3, 'a frame with no click does not move the highlight');
  quickLootWheel(120);
  foldQuickLoot(null);                       // spent looking at a door
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 0, 'and a click spent on nothing does not arrive at the next pile');
}));

test('QUICK-LOOT: the switch off is Daggerfall exactly - no highlight, no wheel, no take', () => withQuickLoot(() => {
  const f = frameOf('pile:1', [item('Ruby'), item('Longsword')]);
  assert.equal(quickLootOn(), false);
  foldQuickLoot(f);
  assert.equal(quickLootSelection(), null, 'the switch off leaves no highlight to light');
  assert.equal(quickLootRow(f), -1);
  assert.equal(quickLootWheel(120), false, 'so the wheel is the camera\'s, as it always was');
  assert.equal(quickLootArm('QuickLootAll'), false, 'and neither key does anything');
}, false));

test('QUICK-LOOT: the switch thrown OFF mid-look is obeyed by the very next PRESS, not the next frame', () => withQuickLoot(() => {
  const p = player();
  const items = [item('Ruby'), item('Longsword')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 0);
  setPref('quickLoot', false);
  // THE PRESS COMES FIRST. A keydown lands between two frames, so the
  // fold that would clear the highlight has not run yet - and the take
  // must read the switch ITSELF rather than trust that it has. Without
  // that, throwing the switch and hitting activate takes a row from a
  // player who just asked for the window back.
  assert.equal(quickLootTake('pile:1', hooks(items), p), null, 'the take asks the switch, not the highlight');
  assert.deepEqual(p.items, []);
  assert.equal(items.length, 2);
  // ...and then the frame clears the highlight too
  foldQuickLoot(f);
  assert.equal(quickLootSelection(), null, 'a press of the switch takes the highlight down with it');
  assert.equal(quickLootRow(f), -1);
}));

// ── THE TAKE ─────────────────────────────────────────────────────

test('QUICK-LOOT: the activate key takes the LIT row, and says the row\'s own word', () => withQuickLoot(() => {
  const p = player();
  const items = [gold(9), item('Longsword'), item('Shield')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  quickLootWheel(120);
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 1, 'the sword is lit');
  const said = [];
  const moved = quickLootTake('pile:1', hooks(items), p, (l) => said.push(l));
  assert.equal(moved.name, 'Longsword', 'the item taken is the item lit');
  assert.deepEqual(p.items.map((i) => i.name), ['Longsword']);
  assert.deepEqual(items.map((i) => i.name), ['Gold', 'Shield'], 'and it LEFT the pile');
  assert.deepEqual(said, [tookItemText(moved)]);
  assert.equal(said[0], 'You take the Longsword.');
}));

test('QUICK-LOOT: gold taken from the plaque goes to the counter, like every other take', () => withQuickLoot(() => {
  const p = player();
  p.goldPieces = 5;
  const items = [gold(9), item('Longsword')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  quickLootTake('pile:1', hooks(items), p);
  assert.equal(p.goldPieces, 14);
  assert.deepEqual(p.items, [], 'a purse is never an item in the pack');
}));

test('QUICK-LOOT: a take asked about a container the crosshair has LEFT moves nothing', () => withQuickLoot(() => {
  const p = player();
  const mine = [item('Ruby')];
  const other = [item('Dagger'), item('Buckler')];
  foldQuickLoot(frameOf('pile:1', mine));
  assert.equal(quickLootTake('pile:2', hooks(other), p), null,
    'the highlight is about pile:1, so pile:2 gets row 0 of nothing');
  assert.deepEqual(p.items, []);
  assert.equal(other.length, 2);
}));

test('QUICK-LOOT: with the switch off, or nothing lit, the take DECLINES - and null is "open the window"', () => {
  withQuickLoot(() => {
    const p = player();
    const items = [item('Ruby')];
    foldQuickLoot(frameOf('pile:1', items));
    assert.equal(quickLootTake('pile:1', hooks(items), p), null, 'the switch is off, so the window opens');
    assert.deepEqual(p.items, []);
  }, false);
  withQuickLoot(() => {
    const p = player();
    const items = [item('Ruby')];
    // never folded: the crosshair is on the body but no frame resolved
    assert.equal(quickLootTake('pile:1', hooks(items), p), null);
    assert.deepEqual(p.items, []);
    // ...and a container with no list at all is declined rather than thrown at
    foldQuickLoot(frameOf('pile:1', items));
    assert.equal(quickLootTake('pile:1', { items: () => null }, p), null);
    assert.equal(quickLootTake('pile:1', null, p), null);
    assert.equal(quickLootTake('pile:1', hooks(items), null), null);
  });
});

// ── THE TWO KEYS ─────────────────────────────────────────────────

test('QUICK-LOOT: QuickLootAll takes the lot through the same one-item door', () => withQuickLoot(() => {
  const p = player();
  p.goldPieces = 1;
  const items = [gold(9), item('Longsword'), item('Shield')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  assert.equal(quickLootArm('QuickLootAll'), true, 'the key arms, because something is lit');
  const said = [];
  assert.ok(quickLootTake('pile:1', hooks(items), p, (l) => said.push(l)));
  assert.deepEqual(items, [], 'EVERY row moved - a live walk over a spliced list takes every second one');
  assert.deepEqual(p.items.map((i) => i.name), ['Longsword', 'Shield']);
  assert.equal(p.goldPieces, 10, 'and the gold rule is the same one, because it is the same door');
  assert.deepEqual(said, ['You take 3 items.']);
}));

test('QUICK-LOOT: QuickLootOpen asks for the window, and takes nothing on the way', () => withQuickLoot(() => {
  const p = player();
  const items = [item('Ruby'), item('Longsword')];
  foldQuickLoot(frameOf('pile:1', items));
  assert.equal(quickLootArm('QuickLootOpen'), true);
  assert.equal(quickLootTake('pile:1', hooks(items), p), null, 'null is the caller\'s cue to open the window');
  assert.deepEqual(p.items, [], 'and the row the player was looking at is still there');
  assert.equal(items.length, 2);
}));

test('QUICK-LOOT: an armed key is SPENT by the press it rode, whatever that press found', () => withQuickLoot(() => {
  const p = player();
  const items = [item('Ruby'), item('Longsword')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  quickLootArm('QuickLootOpen');
  quickLootTake('pile:1', hooks(items), p);            // the window press
  // the NEXT press is an ordinary one: it takes the lit row rather
  // than asking for the window a second time
  const moved = quickLootTake('pile:1', hooks(items), p);
  assert.equal(moved?.name, 'Ruby', 'the arming did not outlive its press');
  // ...and the same for the bulk key
  const rest = [item('Dagger'), item('Buckler')];
  foldQuickLoot(frameOf('pile:2', rest));
  quickLootArm('QuickLootAll');
  quickLootTake('pile:2', hooks(rest), p);
  assert.deepEqual(rest, []);
  const more = [item('Mace'), item('Helm')];
  foldQuickLoot(frameOf('pile:3', more));
  quickLootTake('pile:3', hooks(more), p);
  assert.deepEqual(more.map((i) => i.name), ['Helm'], 'the next press took ONE row, not the lot');
}));

test('QUICK-LOOT: neither key does anything while the crosshair is on a door', () => withQuickLoot(() => {
  const door = { key: 'door:7', kind: 'name', title: 'Door', subs: [], rows: [], rest: 0, empty: false };
  foldQuickLoot(door);
  assert.equal(quickLootArm('QuickLootAll'), false, 'so the host\'s ladder falls through to whatever else wants the key');
  assert.equal(quickLootArm('QuickLootOpen'), false);
  assert.equal(quickLootArm('Activate'), false, 'and it answers for its own two actions only');
}));

// ── TEARDOWN, AND THE EMPTINESS QUESTION ─────────────────────────

test('QUICK-LOOT: the reset frees the selection, the pending nudge AND the armed key', () => withQuickLoot(() => {
  const items = [item('Ruby'), item('Longsword')];
  const f = frameOf('pile:1', items);
  foldQuickLoot(f);
  quickLootWheel(120);
  quickLootArm('QuickLootAll');
  resetQuickLoot();
  assert.equal(quickLootSelection(), null);
  assert.equal(quickLootWheel(120), false, 'no selection, so the wheel is not ours');
  // the nudge went with it: the next fold starts at the top
  foldQuickLoot(f);
  assert.equal(quickLootRow(f), 0, 'a nudge spent in a dungeon does not move the highlight in the street');
  // ...and so did the arming: this press takes ONE row, not the lot
  const p = player();
  quickLootTake('pile:1', hooks(items), p);
  assert.equal(items.length, 1, 'the armed "take everything" did not survive the teardown');
}));

test('QUICK-LOOT: containerEmptied answers the question without acting on it', () => {
  assert.equal(containerEmptied([]), true);
  assert.equal(containerEmptied(null), true);
  assert.equal(containerEmptied([null, undefined]), true, 'a list of holes holds nothing');
  assert.equal(containerEmptied([item('Ruby')]), false);
});

test('QUICK-LOOT: a take that empties a body does NOT disable it', () => withQuickLoot(() => {
  // DFU disables a corpse on the activation that FINDS it empty, not on
  // the take that empties it (PlayerActivate.cs:942-947) - which is what
  // leaves the player "The body has no treasure." to hear. So emptying
  // one by quick loot must leave it standing for that next press.
  const p = player();
  const body = { corpse: true, entity: { items: [item('Ruby')] } };
  foldQuickLoot(frameOf('foeCorpse:1', body.entity.items));
  quickLootTake('foeCorpse:1', hooks(body.entity.items), p);
  assert.deepEqual(body.entity.items, []);
  assert.equal(containerEmptied(body.entity.items), true);
  assert.equal(body.corpseDisabled, undefined, 'the take does not disable - the next activation does');
}));
