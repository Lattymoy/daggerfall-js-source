// WORLD-HOVER - THE PLAQUE AT THE CROSSHAIR, driven rather than read.
//
// Mac handed over World Tooltips 1.1 (jefetienne) with two conditions:
// an enhanced skin for it rather than the mod's own tooltip panel, and
// a merge with the loot plaque the port already had (PX21c). This file
// holds the first slice of that - the model, the draw, and the one law
// both exist to keep.
//
// BEHAVIOURAL PINS, against a minimal fake document - the shape
// test/enhancedControls.js uses, grown the two things a plaque needs
// (a classList, because `on` and `has-list` ARE the states, and a
// style.setProperty, because the anchor is two custom properties).
// The source-text pins that hold the seams live beside their subjects
// in enhancedInventory.test.js; what is here is the behaviour, because
// a plaque that says the wrong thing passes every source sweep ever
// written.
//
// A PIN MUST FAIL: each assertion below dies under a one-line change
// to the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import {
  resolveHover, frameSignature, hoverLines, keyItemises, ITEMISED_KEYS, HOVER_MAX,
  composeActivationTargets,
} from '../src/systems/worldHover.js';
import {
  showWorldPlaque, destroyWorldPlaque, hideWorldPlaque, plaqueAnchor, worldPlaqueOn, worldHoverFrame,
  worldHoverFaults, PLAQUE_GAP, PLAQUE_WATCHDOG_MS, _plaqueSignatureForTests, _setPlaqueClockForTests,
} from '../src/ui/worldPlaque.js';
import { CROSSHAIR_ARM, crosshairCentreY } from '../src/ui/hudCrosshair.js';
import { hudScale } from '../src/ui/hud.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The word a HOST's own namer answers for a pile. AUDIT-WH M5: the
 *  model has no fallback of its own any more - an itemised key with no
 *  word draws NOTHING, exactly as a named key does - so a fixture that
 *  drives the item ROWS supplies the title its host would. */
const PILE = () => ({ title: 'Loot Pile' });

// ── A DOCUMENT, JUST ENOUGH OF ONE ───────────────────────────────

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag,
    children: [],
    dataset: {},
    attrs: {},
    props: {},
    style: { setProperty(k, v) { n.props[k] = v; } },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    get textContent() { return n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.length = 0; if (v) n.children.push({ textContent: v, children: [] }); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { n.removed = true; const i = _body.indexOf(n); if (i >= 0) _body.splice(i, 1); },
  };
  return n;
}

// AUDIT-WH2 L5-F6/F11: THE FAKE BODY KEEPS ITS CHILDREN.
//
// It used to be `body: { append() {} }` - a no-op - and `root()` looked
// in the `made` array rather than in the document, so every draw
// assertion in this file passed against a DETACHED div. Two mutants
// lived in that gap: deleting `document.body.append(node)` from
// `ensure()` (the plaque draws nothing in a browser, suite stays green)
// and deleting `node?.remove()` from `destroyWorldPlaque()` (every host
// teardown orphans a body child). Both are now killed by
// `bodyChildren()` below.
let _body = [];
const bodyChildren = () => _body;

function withPlaque(fn, { skin = 'enhanced', touch = false } = {}) {
  const made = [];
  _body = [];
  globalThis.document = {
    createElement: (t) => { const e = fakeEl(t); made.push(e); return e; },
    body: { append: (...cs) => { for (const c of cs) _body.push(c); } },
    head: { append() {}, appendChild() {}, querySelector: () => null },
    querySelector: () => null,
    getElementById: () => null,
  };
  const search = `?skin=${skin}${touch ? '&touch=on' : '&touch=off'}`;
  // uiSkin.skinOverride reads globalThis.location; touchDevice.isTouchDevice
  // reads globalThis.window. Both doors, because both gates are real.
  globalThis.location = { search };
  globalThis.window = { location: { search }, matchMedia: () => ({ matches: false }) };
  destroyWorldPlaque();
  try { return fn(() => made.find((e) => e.classList?.contains?.('wplaque')) ?? null); } finally {
    destroyWorldPlaque();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.location;
  }
}

/** Every node under `n` carrying the class. */
function find(n, cls, out = []) {
  if (n?.classList?.contains?.(cls)) out.push(n);
  for (const c of n?.children ?? []) find(c, cls, out);
  return out;
}
const textsOf = (root, cls) => find(root, cls).map((n) => n.textContent);

const hit = (key, distance = 1, reach = 3.2) => ({ key, distance, reach });

// ── THE ONE LAW: IT CANNOT DISAGREE WITH THE DOOR ────────────────

test('WORLD-HOVER: the reach gate is the resolver\'s first act, before anything is named or read', () => {
  // AUDIT 65 MC-2: the pick reaches as far as DFU's ONE ray does
  // (RayDistance, PlayerActivate.cs:76/:314), so a too-far pile still
  // WINS the pick - it just reaches a handler that refuses it out loud.
  // A plaque that trusted the pick alone would name a chest across the
  // room that the activate key cannot open, which is the founding law
  // broken on the first frame.
  let named = 0, read = 0;
  const deps = { name: () => { named += 1; return { title: 'Chest', subs: [] }; },
    contents: () => { read += 1; return [{ name: 'Ruby' }]; } };
  assert.equal(resolveHover(hit('loot:1', 9, 3.2), deps), null, 'out of reach says nothing');
  assert.equal(named + read, 0, 'and nothing was named or read to find that out');
  assert.equal(resolveHover(hit('loot:1', 3.2, 3.2), deps)?.kind, 'items', 'exactly at reach is IN reach');
  assert.equal(resolveHover(hit('loot:1', 3.20001, 3.2), deps), null, 'a hair past it is not');
});

test('WORLD-HOVER: a key the ladder has no word for draws NOTHING, not its own key string', () => {
  // The mod's own behaviour: an empty `ret` leaves the tooltip down
  // (vendor .cs:169-172). It is also what stops a family nobody has ported
  // a namer for from labelling itself `act:2:41` in front of a player.
  assert.equal(resolveHover(hit('act:2:41'), { name: () => null }), null);
  assert.equal(resolveHover(hit('act:2:41'), { name: () => ({ title: '' }) }), null, 'an empty title is no title');
  assert.equal(resolveHover(hit('act:2:41'), {}), null, 'and no namer at all is not a crash');
  assert.equal(resolveHover(null, {}), null, 'nor is nothing under the crosshair');
  assert.equal(resolveHover(hit(null), {}), null, 'nor a hit with no key');
});

test('WORLD-HOVER: only the loot keys itemise - everything else is a name', () => {
  // These are PREFIXES of the keys the hosts' own *Targets() producers
  // mint, never strings written out here. `foeCorpse:`/`guardCorpse:`
  // are the two above-ground bodies, which PX21c could not reach.
  assert.deepEqual([...ITEMISED_KEYS], ['loot:', 'corpse:', 'droppedLoot:', 'foeCorpse:', 'guardCorpse:']);
  for (const k of ['loot:0', 'corpse:3', 'droppedLoot:9', 'foeCorpse:abc', 'guardCorpse:x']) {
    assert.equal(keyItemises(k), true, k);
  }
  for (const k of ['door:2', 'person:1', 'act:1:2', 'exit:0', 'container:4', 'eotbWagon', '17', null, undefined]) {
    assert.equal(keyItemises(k), false, String(k));
  }
  // and the itemised arm reads contents while the named arm never does
  let read = 0;
  const contents = () => { read += 1; return []; };
  resolveHover(hit('door:2'), { name: () => ({ title: 'Door' }), contents });
  assert.equal(read, 0, 'a door is not a container - it is never asked for one');
  resolveHover(hit('loot:2'), { contents, name: PILE });
  assert.equal(read, 1);
});

test('WORLD-HOVER: an itemised frame carries the rows, the tail and the empty flag', () => {
  const many = Array.from({ length: HOVER_MAX + 3 }, (_, i) => ({ name: `x${i}` }));
  const f = resolveHover(hit('loot:1'), { contents: () => many, name: () => ({ title: 'Loot Pile' }) });
  assert.equal(f.kind, 'items');
  assert.equal(f.title, 'Loot Pile', 'the namer\'s title, not a kind label');
  assert.equal(f.rows.length, HOVER_MAX);
  assert.equal(f.rest, 3);
  assert.equal(f.empty, false);
  const e = resolveHover(hit('corpse:1'), { contents: () => [], name: PILE });
  assert.equal(e.empty, true);
  assert.equal(e.title, 'Loot Pile', 'the namer\'s title again - an empty pile is still named by its host');
  // AUDIT-WH M5: ...and a namer that says NOTHING draws nothing, on an
  // itemised key exactly as on a named one. The model used to fall
  // back to the literal 'Loot' here, a word World Tooltips does not
  // contain, and that fallback is how a dropped pile outdoors read
  // "Loot" for a whole slice while the same pile indoors read the
  // mod's "Loot Pile".
  assert.equal(resolveHover(hit('corpse:1'), { contents: () => [{ name: 'Ruby' }], name: () => null }), null,
    'an itemised key with no word draws nothing, like every other key');
  assert.equal(resolveHover(hit('corpse:1'), { contents: () => [{ name: 'Ruby' }] }), null,
    '...and no namer at all is the same answer, not a different word');
  assert.deepEqual(hoverLines([{ name: 'Ruby', stackCount: 4 }]).shown,
    [{ name: 'Ruby', stack: 4, rarity: null }]);
});

// ── THE GUARD SEES WHAT WOULD BE PAINTED ─────────────────────────

test('WORLD-HOVER: the signature changes when the LIST does, under a constant key', () => {
  // PX21c guarded on the key alone. That cannot see a pile whose
  // contents changed while it was being looked at - a quest machine
  // writing into a container, the room's own word arriving online
  // (WORLD4), or the next arc's quick loot. It was safe by accident
  // (taking needed a window, and the window unmounted the driver) and
  // an accident is not a law.
  const of = (items) => frameSignature(resolveHover(hit('loot:1'), { contents: () => items, name: PILE }));
  const a = of([{ name: 'Ruby' }, { name: 'Helm' }]);
  assert.notEqual(a, of([{ name: 'Helm' }]), 'a row taken');
  assert.notEqual(a, of([{ name: 'Ruby', stackCount: 2 }, { name: 'Helm' }]), 'a stack grown');
  assert.notEqual(a, of([{ name: 'Ruby' }, { name: 'Helm' }, { name: 'Ring' }]), 'a row added');
  assert.equal(a, of([{ name: 'Ruby' }, { name: 'Helm' }]), 'and the same list is the same signature');
  // the sub-lines count too: a door that just got locked reads differently
  const door = (subs) => frameSignature(resolveHover(hit('door:2'), { name: () => ({ title: 'Door', subs }) }));
  assert.notEqual(door([]), door(['Lock Level: 12']));
  assert.equal(frameSignature(null), null);
  // AUDIT-WH2 L5-F5: ...AND THE TITLE, under a CONSTANT KEY.
  //
  // Nothing here ever changed a title without changing the key, so
  // dropping `|${f.title}` from the signature survived. That is PX21c's
  // own bug one field over: a `mobileFoe:0` that turns hostile, or a
  // door whose building resolves on a later frame, keeps the old word on
  // screen for as long as the player keeps looking at it.
  const named = (t) => frameSignature(resolveHover(hit('door:2'), { name: () => ({ title: t }) }));
  assert.notEqual(named('Door'), named('The Rusty Sword'), 'a changed WORD under one key repaints');
  // AUDIT-WH2 L5-F4: ...AND THE TAIL. `rest` is not derivable from
  // `rows` - the rows are capped at HOVER_MAX - so two frames with the
  // same six visible rows and different "and N more" tails collided into
  // one signature and the plaque kept the stale count.
  const many = (n) => frameSignature(resolveHover(hit('loot:1'), {
    contents: () => Array.from({ length: n }, (_, i) => (i < HOVER_MAX ? { name: `Item${i}` } : { name: `Spare${i}` })),
    name: PILE,
  }));
  const six = resolveHover(hit('loot:1'), { contents: () => Array.from({ length: HOVER_MAX + 1 }, (_, i) => ({ name: `Item${i}` })), name: PILE });
  const seven = resolveHover(hit('loot:1'), { contents: () => Array.from({ length: HOVER_MAX + 2 }, (_, i) => ({ name: `Item${i}` })), name: PILE });
  assert.deepEqual(six.rows.map((r) => r.name), seven.rows.map((r) => r.name), 'the same six rows are visible');
  assert.notEqual(six.rest, seven.rest, '...and the tails differ');
  assert.notEqual(many(HOVER_MAX + 1), many(HOVER_MAX + 2), 'a changed TAIL under the same visible rows repaints');
});

// ── THE DRAW ─────────────────────────────────────────────────────

test('WORLD-HOVER: the plaque paints the frame, and a null frame TAKES IT DOWN', () => {
  withPlaque((root) => {
    showWorldPlaque(resolveHover(hit('loot:1'), {
      contents: () => [{ name: 'Ruby', stackCount: 3 }, { name: 'Helm' }],
      name: () => ({ title: 'Iron Chest', subs: ['Lock Level: 12'] }),
    }));
    const n = root();
    assert.ok(n, 'a node was made');
    assert.equal(n.classList.contains('on'), true);
    assert.equal(n.classList.contains('has-list'), true, 'the divider only exists where there is something to divide');
    assert.deepEqual(textsOf(n, 'wplaque-title'), ['Iron Chest']);
    assert.deepEqual(textsOf(n, 'wplaque-sub'), ['Lock Level: 12']);
    assert.deepEqual(textsOf(n, 'wplaque-row'), ['Ruby×3', 'Helm']);
    assert.equal(n.attrs['aria-hidden'], 'true', 'the crosshair is not a reading order');

    // A NAMED frame grows no list at all.
    showWorldPlaque(resolveHover(hit('person:4'), { name: () => ({ title: 'Marcus Grey' }) }));
    assert.equal(n.classList.contains('has-list'), false);
    assert.deepEqual(textsOf(n, 'wplaque-title'), ['Marcus Grey']);
    assert.deepEqual(textsOf(n, 'wplaque-row'), []);

    // AND NOTHING TAKES IT DOWN, actively. A persistent DOM overlay
    // stays painted unless it is told otherwise (AUDIT 64 F37) - the
    // notice panel's own law, and the reason ENH-NOTICE1 has a
    // watchdog. The plaque must not rely on a teardown for this.
    showWorldPlaque(null);
    assert.equal(n.classList.contains('on'), false);
    assert.equal(n.classList.contains('has-list'), false);
    assert.equal(n.children.length, 0, 'and it is emptied, not just hidden');
  });
});

test('WORLD-HOVER: one node, rewritten only when what would be painted changes', () => {
  withPlaque((root) => {
    const f = (items) => resolveHover(hit('loot:1'), { contents: () => items, name: PILE });
    showWorldPlaque(f([{ name: 'Ruby' }]));
    const n = root();
    // AUDIT-WH2 L5-F18: `assert.equal(n.children, before)` USED TO SIT
    // HERE and it was a tautology - the fake element's `set textContent`
    // does `n.children.length = 0`, so the array OBJECT survives a full
    // clear-and-refill and the identity holds whether or not the guard
    // ran. The previous audit noticed, added the `__mark` test below
    // that really does catch a deleted guard, and then left this one in
    // place still reading as evidence. Two pins, one law, one of them
    // false: the false one goes.
    const sig = _plaqueSignatureForTests();
    showWorldPlaque(f([{ name: 'Helm' }]));
    assert.notEqual(_plaqueSignatureForTests(), sig, 'a changed list repaints');
    assert.deepEqual(textsOf(n, 'wplaque-row'), ['Helm']);
  });
});

test('WORLD-HOVER: the empty container says so', () => {
  withPlaque((root) => {
    showWorldPlaque(resolveHover(hit('corpse:2'), { contents: () => [], name: () => ({ title: 'Remains' }) }));
    assert.deepEqual(textsOf(root(), 'wplaque-empty'), ['Empty']);
  });
});

test('WORLD-HOVER: a long pile says how many more rather than growing', () => {
  withPlaque((root) => {
    const many = Array.from({ length: HOVER_MAX + 4 }, (_, i) => ({ name: `x${i}` }));
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => many, name: PILE }));
    assert.deepEqual(textsOf(root(), 'wplaque-more'), ['and 4 more']);
    assert.equal(find(root(), 'wplaque-row').length, HOVER_MAX + 1, 'six rows and the tail - a pile is a glance');
  });
});

// ── WHERE IT HANGS ───────────────────────────────────────────────

test('WORLD-HOVER: the anchor is the reticle\'s own, a fixed gap BELOW the cross', () => {
  // PX21c stood the plaque at `bottom: 16%` because it had no way to
  // read the cross's real place, and said so in a comment ("centred low
  // so it never sits on the reticle"). hud.js exports the two terms its
  // own crosshair draw uses, so there is ONE answer to "where is the
  // reticle" and the plaque asks it.
  const canvas = { width: 1600, height: 900, clientWidth: 800 };   // dpr 2
  const a = plaqueAnchor(canvas);
  assert.equal(a.x, 400, 'the middle, in CSS pixels');
  // centre 450 device px, + the arm, / dpr, + the gap. The cross is
  // never covered because the plaque STARTS below its lower tip and
  // grows downward, in any state at any length.
  // The cross is never covered because the plaque STARTS below its
  // lower tip and grows downward, in any state at any length. The terms
  // are hud.js's own, so this pin dies if the plaque ever derives a
  // second copy of them.
  const s = hudScale(canvas.width, canvas.height);
  const centre = crosshairCentreY(canvas.height, 0);
  assert.equal(centre, 450);
  assert.equal(a.top, (centre + CROSSHAIR_ARM * s) / 2 + PLAQUE_GAP);
  // AUDIT-WH2 L5-F19: `a.top` IS `(centre + CROSSHAIR_ARM * s) / 2 +
  // PLAQUE_GAP`, so the old assertion here read `X + PLAQUE_GAP > X` and
  // could only fail if the gap went negative. The claim worth pinning is
  // the one the sentence above makes - the plaque starts below the
  // cross's LOWER TIP - so measure against the tip itself.
  const lowerTip = (centre + CROSSHAIR_ARM * s) / 2;
  assert.equal(a.top - lowerTip, PLAQUE_GAP, 'exactly the gap below the cross\'s lower tip');
  assert.ok(a.top > lowerTip, 'strictly below the cross\'s lower tip');
  assert.equal(plaqueAnchor(null), null);
  assert.equal(plaqueAnchor({ width: 0, height: 0 }), null, 'an unsized canvas has no anchor');
});

test('AUDIT-WH2 L5-F1: the SEAM moves the plaque - a host hands it a canvas and the name follows the reticle', () => {
  // A mutant proved this was unheld against the WHOLE 972-file suite:
  // `showWorldPlaque(frame, plaqueAnchor(canvas))` -> `showWorldPlaque(frame)`
  // survived it. Every anchor pin in this file calls `plaqueAnchor` and
  // `showWorldPlaque` BY HAND; not one ever passed a `canvas` through
  // `worldHoverFrame`, which is the only door four hosts use. In the
  // shipping game the plaque would have sat wherever the first paint put
  // it - through a resize, through a large HUD docking, forever.
  withPlaque((root) => {
    const collider = { raycast: () => Infinity };
    const targets = () => [{ key: 'person:1', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 76.8, reach: 6.4 }];
    const frame = (canvas) => worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, canvas,
      name: () => ({ title: 'Marcus Grey' }), contents: () => null,
    });
    frame({ width: 1600, height: 900, clientWidth: 800 });
    const n = root();
    assert.ok(n, 'the seam painted');
    assert.equal(n.props['--wp-x'], '400.0px', 'the seam asked plaqueAnchor, not nothing');
    const wide = n.props['--wp-top'];
    // ...and it asks EVERY frame, so a resize moves the name with the
    // reticle rather than stranding it at the old centre.
    frame({ width: 800, height: 1200, clientWidth: 400 });
    assert.equal(n.props['--wp-x'], '200.0px', 'a resized canvas moves the plaque');
    assert.notEqual(n.props['--wp-top'], wide, '...in both axes');
    // A host that hands NO canvas still draws - the anchor is optional,
    // the name is not (the CSS defaults hold it at mid-screen).
    frame(null);
    assert.equal(n.classList.contains('on'), true, 'no canvas is not no plaque');
  });
});

test('WORLD-HOVER: the anchor is written as custom properties, and only when it moves', () => {
  withPlaque((root) => {
    const canvas = { width: 1600, height: 900, clientWidth: 800 };
    const f = resolveHover(hit('person:1'), { name: () => ({ title: 'Marcus Grey' }) });
    showWorldPlaque(f, plaqueAnchor(canvas));
    const n = root();
    assert.equal(n.props['--wp-x'], '400.0px');
    assert.match(n.props['--wp-top'], /px$/);
    n.props['--wp-x'] = 'TOUCHED';
    showWorldPlaque(f, plaqueAnchor(canvas));
    assert.equal(n.props['--wp-x'], 'TOUCHED', 'an unmoved reticle does not rewrite the style');
    showWorldPlaque(f, plaqueAnchor({ width: 800, height: 900, clientWidth: 800 }));
    assert.equal(n.props['--wp-x'], '400.0px', 'and a moved one does');
  });
});

// ── THE TWO GATES ────────────────────────────────────────────────

test('AUDIT-WH2 L5-F6/F11: the plaque is ON THE PAGE while it lives, and OFF it when the host unwinds', () => {
  // Two mutants, one gap. `ensure()` without `document.body.append(node)`
  // and `destroyWorldPlaque()` without `node?.remove()` BOTH survived the
  // suite, because nothing here had ever looked in the document - the
  // harness's body was a no-op and `root()` searched the created-element
  // list instead. A plaque that is never attached draws nothing in a
  // browser; one that is never detached is orphaned on every mode change,
  // which is the allocation-owner law this slice is pinned on hardest.
  withPlaque((root) => {
    assert.equal(bodyChildren().length, 0, 'nothing on the page before the first draw');
    showWorldPlaque(resolveHover(hit('person:1'), { name: () => ({ title: 'Marcus Grey' }) }));
    const n = root();
    assert.ok(n, 'a node was built');
    assert.ok(bodyChildren().includes(n), 'and it is ATTACHED - a detached plaque draws nothing in a browser');
    // a hide leaves it attached: it is reused every frame and only the
    // teardown owns its removal.
    showWorldPlaque(null);
    assert.ok(bodyChildren().includes(n), 'a hide blanks it, it does not orphan it');
    destroyWorldPlaque();
    assert.equal(n.removed, true, 'the teardown removed it');
    assert.equal(bodyChildren().includes(n), false, '...and it is off the page, not merely unreferenced');
  });
});

test('AUDIT-WH2 L5-F8: the TITLE is painted above the sub-lines and the rows', () => {
  // `textsOf` collects by class, so document order was never asserted and
  // moving `n.append(title)` below the subs loop survived. Every plaque
  // in the game would read "Lock Level: 12 / To The Rusty Sword".
  withPlaque((root) => {
    showWorldPlaque(resolveHover(hit('door:2'), { name: () => ({ title: 'The Rusty Sword', subs: ['Lock Level: 12'] }) }));
    const classes = root().children.map((c) => c.className ?? '');
    assert.ok(classes.length >= 2, 'a title and a sub-line were painted');
    assert.match(classes[0], /wplaque-title/, 'the title is FIRST in the tree, not merely present');
    assert.ok(classes.findIndex((c) => /wplaque-sub/.test(c)) > 0, '...and the sub-lines come after it');
  });
});

test('AUDIT-WH2 L5-F3: a bad namer is said ONCE, not once a frame', () => {
  // ONCRASH1's idiom is "a latch, not a per-frame console", and the latch
  // was held by prose plus the sight of `_faultSaid = false` in the
  // teardown - never by behaviour. `if (!_faultSaid)` -> `if (true)`
  // survived. A third-party namer that throws would put 60 lines a second
  // into the console of a game that is otherwise running fine.
  const warn = console.warn;
  const said = [];
  console.warn = (m) => said.push(m);
  try {
    withPlaque(() => {
      const exploding = () => { throw new TypeError('boom'); };
      for (let i = 0; i < 5; i++) {
        worldHoverFrame({
          eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
          targets: () => [{ key: 'loot:0', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 76.8, reach: 3.2 }],
          name: exploding, contents: () => [],
        });
      }
      assert.equal(worldHoverFaults(), 5, 'every frame is counted');
      assert.equal(said.length, 1, '...and exactly one is SAID');
      assert.match(said[0], /world-hover/);
    });
    // ...and the latch is re-armed by the teardown, so the next host says it once too.
    said.length = 0;
    withPlaque(() => {
      worldHoverFrame({
        eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
        targets: () => [{ key: 'loot:0', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 76.8, reach: 3.2 }],
        name: () => { throw new TypeError('boom'); }, contents: () => [],
      });
      assert.equal(said.length, 1, 'a new host gets its own one line');
    });
  } finally { console.warn = warn; }
});

test('AUDIT-WH2 L3-F1: the GATE the hosts reach takes the plaque DOWN, it does not merely stop drawing', () => {
  // L5 put the hide on `showWorldPlaque`. `grep -rn showWorldPlaque
  // src/scenes/` returns NOTHING - every host calls `worldHoverFrame` and
  // only `worldHoverFrame`, whose gate was a bare `return null` - so the
  // fix was unreachable in production for its whole life. Both terms of
  // the gate can flip under a painted plaque: the skin is a live setting
  // and `isTouchDevice` reads a media query a tablet-mode flip changes.
  withPlaque((root) => {
    const seam = () => worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity },
      targets: () => [{ key: 'person:1', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 76.8, reach: 6.4 }],
      name: () => ({ title: 'Wardrobe' }), contents: () => null,
    });
    seam();
    const n = root();
    assert.equal(n.classList.contains('on'), true, 'a name is on screen');
    // the flip a tablet makes, under the painted plaque
    globalThis.window.matchMedia = () => ({ matches: true });
    globalThis.location.search = '?skin=enhanced&touch=on';
    globalThis.window.location.search = '?skin=enhanced&touch=on';
    assert.equal(worldPlaqueOn(), false, 'the gate is shut');
    assert.equal(seam(), null, 'and the seam refuses');
    assert.equal(n.classList.contains('on'), false, '...and the stranded name is GONE, not left painted');
  });
});

test('AUDIT-WH2 L3-F2: the plaque has a heartbeat - frames that stop coming take it down', () => {
  // The seam's try/catch contains a throw INSIDE the hover call. It
  // cannot contain one BESIDE it: each host runs hundreds of lines
  // between `worldHoverFrame(...)` and its bare
  // `requestAnimationFrame(frame)`, which is not in a `finally`. A DOM
  // overlay stays painted unless it is told otherwise (AUDIT 64 F37), so
  // the last name floated over a game that had stopped. ENH-NOTICE1 met
  // the same shape and answered it the same way.
  let armed = null;
  const fired = [];
  _setPlaqueClockForTests((fn, ms) => { armed = { fn, ms }; return { id: fired.length }; }, (t) => { if (t) fired.push(t); });
  try {
    withPlaque((root) => {
      showWorldPlaque(resolveHover(hit('person:1'), { name: () => ({ title: 'Marcus Grey' }) }));
      const n = root();
      assert.ok(armed, 'a draw arms the watchdog');
      assert.equal(armed.ms, PLAQUE_WATCHDOG_MS);
      assert.equal(n.classList.contains('on'), true);
      // ...and it is re-armed by every draw, including the ones the
      // signature short-circuits - a plaque standing still on one name is
      // still a live frame.
      armed = null;
      showWorldPlaque(resolveHover(hit('person:1'), { name: () => ({ title: 'Marcus Grey' }) }));
      assert.ok(armed, 'an unchanged frame re-arms it too');
      // now the frames stop, and the timer is what is left
      armed.fn();
      assert.equal(n.classList.contains('on'), false, 'a plaque nobody is drawing comes down by itself');
    });
  } finally { _setPlaqueClockForTests(
    (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null),
    (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); },
  ); }
});

test('WORLD-HOVER: the classic skin never builds a node, and never injects the sheet', () => {
  // AUDIT 39's finding, and it matters MORE now: four hosts calling one
  // seam is four more chances to reach ensure() on a classic page,
  // where injectEnhancedStyle() would put the enhanced sheet's UNSCOPED
  // head rules (`*`, `html, body`, `body`, `button`, `#app`) onto it.
  withPlaque((root) => {
    assert.equal(worldPlaqueOn(), false);
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => [{ name: 'Ruby' }], name: PILE }));
    assert.equal(root(), null, 'no node, so no sheet');
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider: {}, targets: () => [] }), null);
  }, { skin: 'classic' });
});

test('WORLD-HOVER: a touch device gets no plaque at all', () => {
  // There the activation ray is through the FINGER (`_tapPoint` ->
  // `_tapDir` through rayDirFromScreen), not the crosshair - so a
  // centre-anchored plaque would name what a tap would NOT open. A
  // wrong answer delivered confidently is worse than no answer.
  withPlaque((root) => {
    assert.equal(worldPlaqueOn(), false);
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => [{ name: 'Ruby' }], name: PILE }));
    assert.equal(root(), null);
  }, { touch: true });
});

// ── THE SEAM ─────────────────────────────────────────────────────

test('WORLD-HOVER: the seam pulls the target list through a THUNK, and not at all when it cannot answer', () => {
  // The cost of a hover in this port is not the ray (~3us) and not the
  // pick (~21ns a target) - it is BUILDING the target list, 95-97% of
  // it. A thunk lets a host hand over a list it is already holding, or
  // rebuild one only when something moved, without this seam knowing.
  withPlaque(() => {
    let pulled = 0;
    const targets = () => { pulled += 1; return []; };
    const collider = { raycast: () => Infinity };   // collider.raycast answers Infinity on a miss
    worldHoverFrame({ eye: null, dir: [0, 0, 1], collider, targets });
    worldHoverFrame({ eye: [0, 0, 0], dir: null, collider, targets });
    worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider: null, targets });
    worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, cursorActive: true });
    assert.equal(pulled, 0, 'a frame that cannot answer pays nothing');
    worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets });
    assert.equal(pulled, 1);
  });
});

test('WORLD-HOVER: an open window takes the plaque down - by law, not by scheduling', () => {
  // In the dungeon this was an accident: the driver only ran when no
  // overlay was up. `cursorActive` is the crosshair's OWN first
  // statement (hudCrosshair.js) and it is now the plaque's, so a host
  // with no such accident behaves the same.
  withPlaque((root) => {
    const collider = { raycast: () => Infinity };   // collider.raycast answers Infinity on a miss
    const targets = () => [{ key: 'loot:1', aabb: { min: [-1, -1, 0.5], max: [1, 1, 2] }, reach: 3.2 }];
    const f = worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets,
      contents: () => [{ name: 'Ruby' }], name: PILE });
    assert.equal(f?.key, 'loot:1', 'the pick found it');
    assert.equal(root().classList.contains('on'), true);
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, cursorActive: true }), null);
    assert.equal(root().classList.contains('on'), false, 'and the node is actually hidden, not merely skipped');
  });
});

test('WORLD-HOVER: the seam resolves through the SAME pick the take runs', () => {
  // The whole law, end to end: a target in reach is named, the same
  // target out of reach is not, and the difference is the pick's own
  // `reach` - not a second distance this module invented.
  withPlaque(() => {
    const collider = { raycast: () => Infinity };   // collider.raycast answers Infinity on a miss
    const near = () => [{ key: 'loot:1', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, reach: 3.2 }];
    const far = () => [{ key: 'loot:1', aabb: { min: [-1, -1, 40], max: [1, 1, 41] }, reach: 3.2 }];
    const deps = { contents: () => [{ name: 'Ruby' }], name: PILE };
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets: near, ...deps })?.key, 'loot:1');
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider, targets: far, ...deps }), null,
      'the pick WINS it and the reach gate refuses it - DFU says nothing about a pile you cannot open');
  });
});

test('WORLD-HOVER: an occluded target is not named', () => {
  // pickActivatableHit casts ONE ray at the winner, and a wall in
  // front of it is the answer. The plaque inherits that for free,
  // which is the point of asking the same pick.
  withPlaque(() => {
    const targets = () => [{ key: 'loot:1', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, reach: 3.2 }];
    const deps = { contents: () => [{ name: 'Ruby' }], name: PILE };
    const open = { raycast: () => Infinity };
    const walled = { raycast: () => 0.4 };   // a wall well in front of the box, and outside it
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider: open, targets, ...deps })?.key, 'loot:1');
    assert.equal(worldHoverFrame({ eye: [0, 0, 0], dir: [0, 0, 1], collider: walled, targets, ...deps }), null);
  });
});

// ── ONE CONSTRUCTION SEAM ────────────────────────────────────────

test('WORLD-HOVER: the dungeon\'s target list has ONE builder, and the hover reads it', () => {
  // The list was composed inline in TWO places against one context -
  // the modal host's dungeon arm and the standalone dev door's - and
  // the hover would have been a third. AUDIT 17i's failure by name: a
  // family added later is seen by whichever builder its author was
  // looking at, and the other two go on answering an older world.
  const ctx = read('src/scenes/dungeonContext.js');
  assert.match(ctx, /return composeActivationTargets\(\[\.\.\.activationTargets\(actions\.objects\), \.\.\.lootTargets\(\)\], _hostTargets\);/,
    'the context composes what the context owns, through the one pure law');
  // ...and the hover pulls THAT list, not a narrower one of its own.
  // AUDIT-WH H2 moved it inside a `pick` so the LIVE bodies can be
  // raced beside it - as the press races them, in an arm of their own
  // - but it is still that one list and no other.
  assert.match(ctx, /ground: pickActivatableHit\(eye, d, api\.dungeonActivationTargets\(\), collider\),/,
    'the plaque races the same list the press does');
  assert.match(ctx, /foe: pickActivatableHit\(eye, d, liveFoeTargets\(foes, 'mobileFoe'\), collider\),/,
    '...and the live foes beside it, through the one precedence');
  // BOTH ladders read it, and neither composes one.
  for (const [f, src] of [['src/scenes/worldModes.js', read('src/scenes/worldModes.js')],
    ['src/scenes/dungeon.js', read('src/scenes/dungeon.js')]]) {
    assert.match(src, /(dungeonCtx|ctx)\.dungeonActivationTargets\(\)/, `${f} reads the seam`);
  }
  assert.doesNotMatch(read('src/scenes/dungeon.js'), /activationTargets\(ctx\.actions\.objects\)/,
    'the dev door no longer keeps a hand copy');
  // THE DIFFERENCE BETWEEN THE TWO HOSTS IS DECLARED, not accidental.
  // The modal host registers its three families at the mount; the
  // standalone dev door registers none, because it has no world to exit
  // to and no `exit:`/`person:` arm - a target it cannot serve would win
  // the pick and eat the press in silence.
  const wm = read('src/scenes/worldModes.js');
  assert.equal((wm.match(/ctx\.addActivationTargets\(/g) ?? []).length, 3,
    'the exit doors, the quest stands and the static NPCs - three, named');
  assert.doesNotMatch(read('src/scenes/dungeon.js'), /addActivationTargets/,
    'and the dev door stands none of them, on purpose');
});

test('WORLD-HOVER: the seam composes the context\'s own families and the host\'s, in that order', () => {
  // Driven, not read: a registry that silently drops a producer, or
  // appends one twice, passes every source sweep above.
  const own = [{ key: 'loot:0' }];
  const a = [{ key: 'exit:0' }];
  const b = [{ key: 'person:0' }];
  const hosts = [];
  const add = (fn) => { hosts.push(fn); return () => { const i = hosts.indexOf(fn); if (i >= 0) hosts.splice(i, 1); }; };
  assert.deepEqual(composeActivationTargets(own, hosts), own, 'nothing registered is the context alone');
  const off = add(() => a);
  add(() => b);
  add(() => []);
  add(() => null);
  assert.deepEqual(composeActivationTargets(own, hosts).map((t) => t.key), ['loot:0', 'exit:0', 'person:0'],
    'the context first, then each host family in the order it was registered; an empty one adds nothing');
  off();
  assert.deepEqual(composeActivationTargets(own, hosts).map((t) => t.key), ['loot:0', 'person:0'],
    'and a producer that leaves takes its family with it');
});

// ── WORLD TOOLTIPS' NAMING LADDER ────────────────────────────────
//
// The mod's own words, ported 1:1 from `vendor/world-tooltips/Scripts/
// Modded_HUDTooltipWindow.cs`. Every assertion names the line it holds.

test('WORLD TOOLTIPS: the sixteen Daedra by BILLBOARD RECORD, which is not the summoning table\'s order', async () => {
  const wt = await import('../src/systems/worldTooltips.js');
  const ds = await import('../src/systems/daedraSummoning.js');
  // .cs:334-384 - archive 175, records 0..15.
  assert.equal(wt.DAEDRA_BY_RECORD.length, 16);
  assert.equal(wt.npcHoverName('Somebody', { archive: 175, record: 0 }), 'Azura');
  assert.equal(wt.npcHoverName('Somebody', { archive: 175, record: 14 }), 'Sheogorath');
  assert.equal(wt.npcHoverName('Somebody', { archive: 175, record: 15 }), 'Vaermina');
  // ...and anything that is NOT a summoning billboard keeps its own name.
  assert.equal(wt.npcHoverName('Marcus Grey', { archive: 334, record: 0 }), 'Marcus Grey');
  assert.equal(wt.npcHoverName('Marcus Grey', { archive: 175, record: 99 }), 'Marcus Grey', 'a record past the table');
  assert.equal(wt.npcHoverName('', { archive: 334, record: 1 }), null, 'a nameless NPC says nothing');
  // THE TWO TABLES ARE DIFFERENT ORDERINGS OF ONE PANTHEON, on purpose.
  // systems/daedraSummoning.js is by factionId and its index 8 is
  // load-bearing for the summoning itself; this one is by billboard
  // record. Re-sorting either to serve the other breaks the other.
  const summoning = ds.DAEDRA.map((d) => d.name);
  assert.notDeepEqual([...wt.DAEDRA_BY_RECORD], summoning, 'two orderings, not one');
  assert.equal(summoning[8], 'Sheogorath', 'the summoning table\'s load-bearing index');
  assert.equal(wt.DAEDRA_BY_RECORD[8], 'Meridia', 'and the billboard table disagrees with it, correctly');
  // The spelling difference is real and deliberate: this table is the
  // MOD's, verbatim; the other is Daggerfall's own.
  assert.ok(summoning.includes('Vaernima'), 'the port\'s summoning table keeps Daggerfall\'s spelling');
  assert.ok(wt.DAEDRA_BY_RECORD.includes('Vaermina'), 'the mod\'s table keeps the mod\'s');
});

test('WORLD TOOLTIPS: an action object is named by its model, and an unlisted MultiTrigger says NOTHING', async () => {
  const { actionName, INTERACT_TEXT } = await import('../src/systems/worldTooltips.js');
  const { TRIGGER_FLAGS } = await import('../src/world/rdbLayout.js');
  // .cs:420-431 - the three the mod names outright.
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 74037), 'Wheel');
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 61027), 'Lever');
  assert.equal(actionName(TRIGGER_FLAGS.Direct6, 61028), 'Lever');
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 74143), 'The Mantella');
  // .cs:403-405 - only Direct, Direct6 and MultiTrigger are named at
  // all. The rest are chain links and traps the player is not meant to
  // read as interactive.
  for (const t of [TRIGGER_FLAGS.None, TRIGGER_FLAGS.Collision01, TRIGGER_FLAGS.Collision03,
    TRIGGER_FLAGS.Collision09, TRIGGER_FLAGS.Attack, TRIGGER_FLAGS.Door]) {
    assert.equal(actionName(t, 74037), null, `trigger ${t} is not named`);
  }
  // .cs:465-466 - a named-trigger object with no word of its own.
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 12345), INTERACT_TEXT);
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 12345, { hideInteract: true }), null,
    'HideDefaultInteractTooltip - the author\'s own knob, so the main quest\'s puzzles are not given away');
  // .cs:459-461 - THE MULTITRIGGER RULE, and the reason for it:
  // MultiTrigger is the flag on collision plates and trap volumes, so
  // an unlisted one is SILENCED outright rather than defaulted.
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 12345), null, 'a pressure pad is not labelled');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 74037), 'Wheel', 'but a named one still speaks');
  // .cs:432-437 - four the mod lets through WITHOUT a name of their own.
  for (const id of [62323, 72019, 74215, 74225]) {
    assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, id), INTERACT_TEXT, `${id} is allowed through`);
    assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, id, { hideInteract: true }), null);
  }
});

test('WORLD TOOLTIPS: a house container is named by its FULL model id, which `% 100` could not tell apart', async () => {
  const { houseContainerName, INTERACT_TEXT } = await import('../src/systems/worldTooltips.js');
  const { containerTextureRecord } = await import('../src/systems/containers.js');
  // .cs:552-633. The reason WORLD-HOVER's groundwork slice made the
  // container record carry its model id: the derived texture record is
  // LOSSY, and these two both read 3.
  assert.equal(containerTextureRecord(41003), containerTextureRecord(41803), 'the derivation cannot tell them apart');
  assert.equal(houseContainerName(41003), 'Wardrobe');
  assert.equal(houseContainerName(41803), 'Dresser');
  for (const [id, want] of [[41004, 'Wardrobe'], [41800, 'Wardrobe'], [41801, 'Wardrobe'],
    [41007, 'Cabinets'], [41802, 'Cabinets'], [41810, 'Cabinets'],
    [41027, 'Shelf'], [41034, 'Dresser'], [41806, 'Dresser'],
    [41032, 'Cupboard'], [41814, 'Cupboard'],
    [41815, 'Crate'], [41834, 'Crate'], [41811, 'Chest'], [41813, 'Chest']]) {
    assert.equal(houseContainerName(id), want, String(id));
  }
  // .cs:627-628 - the mod's own default for a furniture model its table
  // does not list, AND IT IS UNCONDITIONAL.
  //
  // AUDIT-WH M3: this pin used to assert `houseContainerName(41999,
  // { hideInteract: true }) === null`, and that was the port's own
  // behaviour wearing the mod's clothes. `HideDefaultInteractTooltip`
  // guards exactly ONE `<Interact>` in the whole mod - the ACTION
  // arm's, `if (!HideInteractTooltip && string.IsNullOrEmpty(ret))` at
  // .cs:465-466, pinned two tests above - and the container switch's
  // `default:` has none. A pin that certifies a departure is worse
  // than no pin: it reads as evidence.
  assert.equal(houseContainerName(41999), INTERACT_TEXT);
  assert.equal(houseContainerName.length, 1,
    'the knob is not this function\'s to take - the mod does not offer it one');
  const wt = read('src/systems/worldTooltips.js');
  assert.match(wt, /export function houseContainerName\(modelIdNum\) \{\n\s+return HOUSE_CONTAINER_NAMES\[modelIdNum\] \?\? INTERACT_TEXT;\n\}/,
    'unconditional, as .cs:627-628 is');
  // ...and the ACTION arm still takes it, because that is where the
  // mod put it.
  const { actionName: an, TRIGGER_FLAGS: TF } = await import('../src/systems/worldTooltips.js')
    .then(async (m) => ({ actionName: m.actionName, TRIGGER_FLAGS: (await import('../src/world/rdbLayout.js')).TRIGGER_FLAGS }));
  assert.equal(an(TF.Direct, 12345, { hideInteract: true }), null);
});

test('WORLD TOOLTIPS: a pile of ONE is named by that item; a corpse is named by who it was', async () => {
  const { lootPileName, corpseName, LOOT_PILE_TEXT } = await import('../src/systems/worldTooltips.js');
  // .cs:534-548 - exactly one item names the pile, with its stack count.
  const ruby = { name: 'Ruby', templateIndex: -1 };
  assert.equal(lootPileName([]), LOOT_PILE_TEXT);
  assert.equal(lootPileName(null), LOOT_PILE_TEXT);
  assert.equal(lootPileName([ruby, { name: 'Helm', templateIndex: -1 }]), LOOT_PILE_TEXT, 'two is a pile');
  assert.match(lootPileName([ruby]), /Ruby/);
  assert.match(lootPileName([{ ...ruby, stackCount: 4 }]), /\(4\)$/, 'the stack count, in parentheses');
  assert.doesNotMatch(lootPileName([{ ...ruby, stackCount: 1 }]), /\(1\)$/, 'a stack of one is not a count');
  // .cs:526
  assert.equal(corpseName('Skeletal Warrior'), 'Skeletal Warrior (dead)');
  // AUDIT-WH M9: and NOTHING ELSE. `loot.entityName + " (dead)"` has no
  // fallback, and the port had invented 'Body' for a nameless one - a
  // word World Tooltips does not contain, on a branch neither pool can
  // reach (both name a body through `enemyDisplayName`, which answers
  // for every mobile in the table). An invented word on an unreachable
  // branch is still an invented word, and this pin was asserting it.
  assert.equal(corpseName(''), ' (dead)', 'the mod has no fallback, so neither has this');
  assert.equal(corpseName(undefined), ' (dead)');
});

test('WORLD TOOLTIPS: a door says its lock level only when it is locked', async () => {
  const { actionDoorName } = await import('../src/systems/worldTooltips.js');
  // .cs:641-650 - the mod joins the two with `\r`; the port carries the
  // second as a sub-line, because a DOM line is a node.
  assert.deepEqual(actionDoorName(false, 0), { title: 'Door' });
  assert.deepEqual(actionDoorName(true, 12), { title: 'Door', subs: ['Lock Level: 12'] });
});

test('WORLD TOOLTIPS: a static door names where it goes, its lock, and the shop it says is shut', async () => {
  const { staticDoorName } = await import('../src/systems/worldTooltips.js');
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  // .cs:763-771 - stepping out, or into a dungeon, names the place.
  assert.deepEqual(staticDoorName('buildingExit', { locationName: 'Daggerfall' }), { title: 'To\nDaggerfall' });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Privateer\'s Hold' }), { title: 'To\nPrivateer\'s Hold' });
  // .cs:777-782 - a dungeon exit names its TOWN, or the region when
  // there is no town, because you step out into open country.
  assert.deepEqual(staticDoorName('dungeonExit', { locationName: 'Daggerfall', regionName: 'Daggerfall', inTown: true }),
    { title: 'To\nDaggerfall' });
  assert.deepEqual(staticDoorName('dungeonExit', { locationName: 'Privateer\'s Hold', regionName: 'Tigonus', inTown: false }),
    { title: 'To\nTigonus Region' });
  // .cs:726-733 - Town23 is the city wall, which has no name of its own.
  assert.deepEqual(staticDoorName('building', { buildingType: BUILDING_TYPES.Town23, locationName: 'Daggerfall', unlocked: true }),
    { title: 'To\nDaggerfall City Walls', subs: [] });
  // .cs:735-738 - the lock level, only when locked, off the port's own
  // GetBuildingLockValue (quality / 2).
  const shut = staticDoorName('building', { displayName: 'The Rusty Sword', buildingType: BUILDING_TYPES.GeneralStore, unlocked: false, quality: 20 });
  assert.equal(shut.title, 'To\nThe Rusty Sword');
  assert.equal(shut.subs[0], 'Lock Level: 10');
  assert.match(shut.subs[1], /^Store is closed\. Open from \d+:00 to \d+:00\.$/, 'the sentence, from its ONE home');
  // TWO DEPARTURES OF THE MOD'S OWN FROM PlayerActivate, ported as the
  // mod's rather than folded into the port's pinned activateBuilding:
  // the gate is `<= Palace` where DFU's is `< Temple`...
  const temple = staticDoorName('building', { displayName: 'Temple', buildingType: BUILDING_TYPES.Temple, unlocked: false, quality: 20 });
  assert.equal(temple.subs.length, 2, 'the mod tells you a temple is shut; DFU does not');
  // ...and a Palace substitutes its own word for "Store".
  const palace = staticDoorName('building', { displayName: 'Castle Daggerfall', buildingType: BUILDING_TYPES.Palace, unlocked: false, quality: 20 });
  assert.match(palace.subs[1], /^Palace is closed\./);
  // An unlocked building says only where it goes.
  const open = staticDoorName('building', { displayName: 'The Rusty Sword', buildingType: BUILDING_TYPES.GeneralStore, unlocked: true });
  assert.deepEqual(open.subs, []);
  // ...and a door onto nothing named says nothing at all.
  assert.equal(staticDoorName('building', { displayName: '', unlocked: true }), null);
  assert.equal(staticDoorName('buildingExit', { locationName: '' }), null);
  assert.equal(staticDoorName('nonsense', {}), null);
});

test('AUDIT-WH H5: the location\'s name is read in the PORT\'s spelling, from ONE place', () => {
  // THE BUG THIS PINS. Three hover arms in worldModes wrote `.Name` -
  // the C# property, exactly as the mod's own source spells it
  // (.cs:726, :764, :777) - off a record the PORT mints, which spells
  // it `name`. `undefined ?? ''` is `''`, and the pin two tests above
  // (`staticDoorName('buildingExit', { locationName: '' })` -> null)
  // is precisely why nothing said so: an unnamed key draws nothing BY
  // DESIGN, so three dead arms and three correct silences look the
  // same from outside. A building's door read from inside, a city
  // wall, and a dungeon exit in a town all drew nothing at all.
  const wm = read('src/scenes/worldModes.js');
  // Swept over the CODE, with the prose taken out, so the note that
  // explains the bug is not itself the thing that trips the pin.
  const code = wm.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\.Name\b/,
    'no C#-spelled field read survives in the mode machine');
  // ONE home for the read, so a fourth arm cannot dig it out a fourth
  // way. This is the same law HARD2 applied to the activation race.
  assert.match(wm, /const currentLocationName = \(\) => host\.currentLocation\?\.\(\)\?\.name \?\? '';/,
    'PlayerGPS.CurrentLocation.Name, once');
  // AUDIT-WH2 L5: a COUNT is not a law - three calls anywhere in the file
  // satisfied it and nothing said WHICH three arms. Name them.
  assert.equal((wm.match(/currentLocationName\(\)/g) ?? []).length, 3,
    'the three above-ground arms that take it - the building exit, the city wall and (AUDIT-WH M7) the dungeon entrance');
  assert.match(wm, /staticDoorName\('buildingExit', \{ locationName: currentLocationName\(\) \}\)/, 'the building exit, from inside');
  assert.match(wm, /staticDoorName\('dungeonEntrance', \{ locationName: currentLocationName\(\) \}\)/, 'the dungeon entrance, from outside');
  assert.match(wm, /locationName: currentLocationName\(\),\n\s+buildingType: bd\.buildingType,/, 'and the shopfront the city wall arm reads');
  // ...and the DUNGEON exit names the dungeon it is in, not the
  // location under the player, so it reads its own record - in the
  // same spelling.
  assert.match(wm, /locationName: dungeonLoc\?\.name \?\? '',/,
    'the dungeon exit reads dungeonLoc.name');
  // THE PRODUCERS. Both hosts publish `currentLocation` and both read
  // `.name` off that very record elsewhere, where it has always
  // worked - which is the proof the spelling above is the record's.
  const ex = read('src/scenes/exterior.js');
  assert.match(ex, /currentLocation: \(\) => dfLocation,/, 'the fixed city hands dfLocation');
  assert.match(ex, /currentLocationName: \(\) => dfLocation\.name \?\? locationName,/, '...whose name field is `name`');
  const w = read('src/scenes/world.js');
  assert.match(w, /currentLocation: \(\) => _questLoc\(\),/, 'the streaming world hands _questLoc()');
  assert.match(w, /currentLocationName: \(\) => _questLoc\(\)\?\.name \?\? '',/, '...whose name field is `name`');
});

test('WORLD TOOLTIPS: a quest ITEM stand is named; the Totem is named by hand', async () => {
  const { questResourceName, TOTEM_TEXT } = await import('../src/systems/worldTooltips.js');
  // .cs:491-505 - archive 211 record 54, before the resolver runs.
  assert.equal(questResourceName(null, { archive: 211, record: 54 }), TOTEM_TEXT);
  assert.equal(questResourceName({ name: 'Ruby', templateIndex: -1 }, { archive: 211, record: 54 }), TOTEM_TEXT,
    'the billboard wins over the item');
  assert.match(questResourceName({ name: 'Ruby', templateIndex: -1 }, { archive: 211, record: 0 }), /Ruby/);
  assert.equal(questResourceName(null, { archive: 211, record: 0 }), null, 'no item, no word');
});

test('WORLD TOOLTIPS: the naming ladder is insertion order, first answer with a title wins', async () => {
  const { composeNamer } = await import('../src/systems/worldHover.js');
  // The mod's extension API (vendor .cs:228-257): a Map keyed by reach,
  // walked in insertion order, FIRST NON-EMPTY WINS, run before the
  // mod's own ladder. The port keeps the law and drops the key, because
  // reach is already decided by the pick.
  const n = composeNamer([
    (k) => (k === 'a' ? { title: 'first' } : null),
    (k) => (k === 'a' ? { title: 'second' } : null),
    (k) => (k === 'b' ? { title: 'b' } : null),
    null,
    (k) => (k === 'c' ? { title: '' } : null),   // an empty title is no answer
    (k) => (k === 'c' ? { title: 'c' } : null),
  ]);
  assert.equal(n('a').title, 'first', 'insertion order is priority');
  assert.equal(n('b').title, 'b');
  assert.equal(n('c').title, 'c', 'an empty title does not stop the walk');
  assert.equal(n('d'), null, 'a key nobody knows draws nothing');
  assert.equal(composeNamer(null)('a'), null);
});

// ── THE SEVEN THE FIRST MUTATION RUN FOUND ───────────────────────
//
// Every assertion below was written because a mutant SURVIVED the
// suite as it stood. They are the campaign's findings, not its
// decoration: `tools/mutants/worldhover.json` names each one.

test('WORLD-HOVER: a docked large HUD moves the plaque, because it moves the reticle', () => {
  // ROAD-E E5: HUDCrosshair re-centres into the view a docked bar
  // leaves, because the world pass is drawn there. A plaque that read
  // the scale but not the bar height sat below a cross that had moved
  // up - and nothing caught it, because every fixture drew with no bar.
  const canvas = { width: 1600, height: 900, clientWidth: 800 };
  const plain = plaqueAnchor(canvas);
  // `hudReticle` answers the LIVE bar, so drive the term it reads
  // rather than the module state: the law is that the two agree.
  const s = hudScale(canvas.width, canvas.height);
  const withBar = (h) => (crosshairCentreY(canvas.height, h) + CROSSHAIR_ARM * s) / 2 + PLAQUE_GAP;
  assert.equal(plain.top, withBar(0), 'undocked, the middle is the middle');
  assert.ok(withBar(200) < withBar(0), 'a docked bar raises the reticle...');
  assert.equal(withBar(200), plain.top - 50,
    '...by exactly half its height, in device pixels, over the device ratio - E5\'s own arithmetic through the plaque\'s');
  // and the plaque's own line is the one that carries the term
  assert.match(read('src/ui/worldPlaque.js'),
    /const \{ scale, largeHudHeight \} = hudReticle\(canvas\);/,
    'the plaque reads BOTH terms, not just the scale');
});

test('WORLD-HOVER: the signature guard really stops the repaint', () => {
  // The first pin compared `n.children` by reference, which a repaint
  // preserves - so deleting the guard changed nothing it could see.
  // Mark the tree and check the MARK survives.
  withPlaque((root) => {
    const f = (items) => resolveHover(hit('loot:1'), { contents: () => items, name: PILE });
    showWorldPlaque(f([{ name: 'Ruby' }]));
    const n = root();
    n.children[0].__mark = 'untouched';
    showWorldPlaque(f([{ name: 'Ruby' }]));
    assert.equal(n.children[0]?.__mark, 'untouched', 'an unchanged frame does not rebuild the tree');
    showWorldPlaque(f([{ name: 'Helm' }]));
    assert.notEqual(n.children[0]?.__mark, 'untouched', 'and a changed one does');
  });
});

test('WORLD-HOVER: a title with a line break is DRAWN as two lines', () => {
  // The mod joins a door's label with `\r` - "To\rPrivateer's Hold" -
  // and flattening that to one line passed every pin, because nothing
  // drove a multi-line title through the draw.
  withPlaque((root) => {
    showWorldPlaque({ key: 'exit:0', kind: 'name', title: 'To\nPrivateer\'s Hold', subs: [], rows: [], rest: 0, empty: false });
    const lines = find(root(), 'wplaque-titleline').map((n) => n.textContent);
    assert.deepEqual(lines, ['To', 'Privateer\'s Hold']);
    showWorldPlaque({ key: 'person:1', kind: 'name', title: 'Marcus Grey', subs: [], rows: [], rest: 0, empty: false });
    assert.deepEqual(find(root(), 'wplaque-titleline').map((n) => n.textContent), ['Marcus Grey'],
      'and a single-line title is still one line');
  });
});

test('WORLD TOOLTIPS: a house for sale is never told it is shut', async () => {
  // PlayerActivate.cs:474 and the mod's :738 both exempt it by name,
  // and no fixture had ever used the type - so deleting the exemption
  // changed nothing any pin could see.
  const { staticDoorName } = await import('../src/systems/worldTooltips.js');
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  const forSale = staticDoorName('building', { displayName: 'A House', buildingType: BUILDING_TYPES.HouseForSale, unlocked: false, quality: 20 });
  assert.equal(forSale.subs.length, 1, 'it says it is locked...');
  assert.match(forSale.subs[0], /^Lock Level: /, '...and nothing about opening hours');
});

test('WORLD-HOVER: ONE precedence - the press DERIVES from raceWinner, driven over 200k sets', async () => {
  // AUDIT-WH H1. This pin replaces one that certified the bug.
  //
  // The old version drove six hand-picked cases and asserted, three
  // lines above them, that `raceWinner({corpse@3, ground@2})` names the
  // DOOR - which the press contradicted, because its corpse and pile
  // arms never compared against `doorDistance` at all. Every case in
  // the agreement loop had the corpse or pile NEARER than the door, so
  // the divergence could not show. A suite that picks its own examples
  // is not a differential.
  //
  // `raceActivation` derives its answer from `raceWinner` now, so the
  // two agree BY CONSTRUCTION - which is worth more than any number of
  // cases. This drives it anyway, because "by construction" is a claim
  // and a claim is what a pin is for.
  const { raceWinner, raceActivation, GROUND_KEY } = await import('../src/player/activationRace.js');
  const p = (key, distance) => ({ key, distance, reach: 3.2 });

  assert.equal(raceWinner({}), null, 'nothing under the ray');
  assert.equal(raceWinner(), null);
  assert.equal(raceWinner({ ground: p('door', 2) }).key, 'door', 'the only candidate wins');
  assert.equal(raceWinner({ corpse: p('body', 1), ground: p('door', 2) }).key, 'body', 'nearest wins');
  // ...AND THE CASE THE OLD PIN GOT BACKWARDS. DFU casts one ray and
  // dispatches to the nearest hit; a body at 3 does not out-rank a
  // door at 2, and now neither reader says it does.
  assert.equal(raceWinner({ corpse: p('body', 3), ground: p('door', 2) }).key, 'door');
  assert.equal(raceActivation({ corpse: p('body', 3), doorDistance: 2 }).loot, null,
    'the PRESS lets the nearer door win too - this is the bug the old pin asserted as law');

  // THE TIE ORDER IS THE HOSTS' ARM LADDER: camp, water, wagon, torch,
  // body, pile, ground. Driven at EXACT ties, the only distance at
  // which a precedence is observable at all.
  const all = { camp: p('camp', 2), water: p('water', 2), wagon: p('wagon', 2), torch: p('torch', 2), corpse: p('body', 2), pile: p('pile', 2), ground: p('door', 2) };
  const order = ['camp', 'water', 'wagon', 'torch', 'body', 'pile', 'door'];
  const byKey = { camp: 'camp', water: 'water', wagon: 'wagon', torch: 'torch', body: 'corpse', pile: 'pile', door: 'ground' };
  for (let i = 0; i < order.length; i++) {
    const bag = {};
    for (const k of order.slice(i)) bag[byKey[k]] = all[byKey[k]];
    assert.equal(raceWinner(bag).key, order[i], `at an exact tie, ${order[i]} takes it from ${order.slice(i + 1).join(', ') || 'nothing'}`);
  }

  // ── THE DIFFERENTIAL ──────────────────────────────────────────
  // The hosts' ladder, transcribed from world.js / exterior.js: camp,
  // water, wagon, torch, then the body, then the pile, then the door.
  const pressOpens = (r) => (r.campWins ? 'camp' : r.waterWins ? 'water' : r.wagonWins ? 'wagon'
    : r.torchWins ? 'torch' : r.loot ? r.loot.key : r.drop ? r.drop.key : 'ground');
  let seed = 1;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  // distances chosen to land ON the reach constants and to collide,
  // because ties are where an ordering law is observable.
  const D = [0.5, 1, 1.5, 2, 2, 3, 3.75, 6.4, 12, 40, Infinity];
  const one = (k) => { const d = D[(rnd() * D.length) | 0]; return d === Infinity ? null : { key: k, distance: d, reach: 3.2 }; };
  const bad = [];
  for (let i = 0; i < 20000; i++) {
    const c = { corpse: one('body'), pile: one('pile'), torch: one('torch'), wagon: one('wagon'), camp: one('camp'), water: one('water') };
    const dd = D[(rnd() * D.length) | 0];
    const press = pressOpens(raceActivation({ ...c, doorDistance: dd }));
    const won = raceWinner({ ...c, ground: Number.isFinite(dd) ? { key: GROUND_KEY, distance: dd } : null });
    const plaque = won ? (won.key === GROUND_KEY ? 'ground' : won.key) : 'nothing';
    // "the press falls through to tryEnter with no door there" and
    // "the plaque names nothing" are the same answer.
    if (press !== plaque && !(press === 'ground' && plaque === 'nothing')) {
      bad.push(`press=${press} plaque=${plaque} ${JSON.stringify({ ...c, doorDistance: dd })}`);
    }
  }
  assert.deepEqual(bad.slice(0, 3), [], `the press and the plaque disagree on ${bad.length}/20000 pick sets`);
});


// ── AUDIT-WH: THE SEAM INTO THE HOSTS ────────────────────────────
//
// The audit's own headline: the four pure modules were in good shape
// and every break was at the seam into the hosts - which is exactly
// where there were no pins and no mutants. A 9,644-test suite and a
// 42/42 mutation campaign both certified a build that crashed on the
// commonest interaction in a town, because nothing in `test/` called a
// host namer at all.

test('AUDIT-WH C1: a namer is handed EVERY key the ray can win, including the door\'s bare NUMBER', async () => {
  // THE CRASH. The exterior door target's key is a bare number
  // (worldModes' `key: i`), the host namer ladder runs ABOVE
  // exteriorHoverName's own `typeof key === 'number'` test, and
  // `camps.hoverName` opened with an unguarded `key.startsWith`. It
  // threw inside four frame bodies that have no error boundary between
  // them and requestAnimationFrame, so the game stopped.
  //
  // Driven against the REAL modules, not a transcription: a namer that
  // is asked about a key it does not own must answer null, not throw.
  const { createCamps } = await import('../src/scenes/camps.js');
  const { createDroppedTorches } = await import('../src/scenes/droppedTorches.js');
  const camps = createCamps({});
  const torches = createDroppedTorches({});
  for (const [what, namer] of [['camps', camps.hoverName], ['droppedTorches', torches.hoverName]]) {
    assert.equal(typeof namer, 'function', `${what} registers a namer`);
    for (const key of [0, 7, 999, null, undefined]) {
      assert.doesNotThrow(() => namer(key), `${what}.hoverName(${String(key)}) must not throw`);
      assert.equal(namer(key), null, `${what}.hoverName(${String(key)}) answers null`);
    }
  }
  // ...and it still answers the keys it DOES own.
  assert.deepEqual(camps.hoverName('hearth:0'), { title: 'Fire' });
  // the guard is the one `activate` has carried since HEARTH1
  assert.match(read('src/scenes/camps.js'), /function hoverName\(key\) \{[\s\S]{0,700}if \(typeof key !== 'string'\) return null;/);
});

test('AUDIT-WH L1: the seam CONTAINS its host closures - a bad namer costs a frame, not the game', () => {
  // ONCRASH1's law, applied where it matters more than the wire: `pick`,
  // `targets`, `name` and `contents` are host closures called from
  // inside frame bodies with nothing between a throw and a dead
  // requestAnimationFrame. The slice also advertises an extension API
  // into that path ("the same door a third party would use"), so the
  // containment is not belt-and-braces - it is the door's lock.
  withPlaque((root) => {
    const exploding = () => { throw new TypeError('a third-party namer exploded'); };
    const targets = () => [{ key: 'loot:0', aabb: { min: [-1, -1, 1], max: [1, 1, 2] }, distance: 76.8, reach: 3.2 }];
    const collider = { raycast: () => Infinity };
    // AUDIT-WH2 L5-F2: PAINT A NAME FIRST, then break the namer.
    //
    // Without this the assertion below was a TAUTOLOGY and a mutant
    // proved it: the namer threw on the very first frame, so
    // `showWorldPlaque` was never reached, `ensure()` never ran, `root()`
    // answered null, and `null ?? false === false` passed whether or not
    // the catch arm took the plaque down. Deleting
    // `showWorldPlaque(null)` from the catch survived the WHOLE suite.
    // The law is "it does not freeze on its last answer", so there has
    // to BE a last answer.
    assert.doesNotThrow(() => worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, name: () => ({ title: 'Chest' }), contents: () => [],
    }));
    assert.equal(root()?.classList.contains('on'), true, 'a name is on screen before the namer breaks');
    for (let i = 0; i < 3; i++) {
      assert.doesNotThrow(() => worldHoverFrame({
        eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, name: exploding, contents: () => [],
      }), 'the host frame survives');
    }
    assert.equal(worldHoverFaults(), 3, 'and every contained frame is COUNTED');
    // a readout that cannot answer shows NOTHING - it does not freeze
    // on its last answer, which would be a plaque naming a thing it can
    // no longer resolve. The node EXISTS here (the frame above painted
    // "Chest" into it), so this now reads the class rather than reading
    // `null ?? false`.
    assert.ok(root(), 'the node is still there - this is about what it SHOWS');
    assert.equal(root().classList.contains('on'), false);
    assert.equal(root().textContent, '', 'and it is blank, not holding the word it can no longer resolve');
    // an exploding PICK and an exploding TARGETS are the same class.
    for (const bad of [{ pick: exploding }, { targets: exploding }]) {
      assert.doesNotThrow(() => worldHoverFrame({
        eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, name: () => null, contents: () => [], ...bad,
      }));
    }
    assert.equal(worldHoverFaults(), 5);
  });
});

test('AUDIT-WH H3: an above-ground body LISTS what it holds, from one ladder', async () => {
  const { composeContents, resolveHover } = await import('../src/systems/worldHover.js');
  const { corpseLootTargets, corpseEntryFor, corpseContents } = await import('../src/scenes/corpseMarker.js');

  // THE ROUND TRIP THAT WAS BROKEN. `foeCorpse:` and `guardCorpse:`
  // have itemised since the first slice - the plaque opens a LIST for
  // them - and neither above-ground host answered their contents, so
  // `hoverLines(null)` said `empty` and every body you killed in a
  // street or in the wilderness read "Empty" over a full pack. The
  // plaque said the OPPOSITE of what the press would show you, which
  // is the one law the whole slice exists to keep.
  //
  // Driven over the shape the pools mint: one lens, minting the key
  // and resolving it back, exactly as exteriorFoes and cityGuards use
  // it now.
  // AUDIT-WH2 L5-F15: THE PRODUCER'S LENS, not a simplified copy of it.
  //
  // This used to be a three-key transcription that omitted the encounter
  // pool's WORLD6b-iii(c) term, so dropping that term from the real lens
  // survived - a PUPPET's body became a lootable target again even when
  // its owner's word said it holds nothing. A pin that drives its own
  // shorter version of the producer is testing the pin.
  const lens = {
    isCorpse: (e) => !!e.corpse && !!e.entity && (!e.puppet || (e._pup?.o | 0) > 0),
    idOf: (e) => e.id,
    feetOf: (e) => e.feet,
  };
  assert.match(read('src/scenes/exteriorFoes.js'),
    /isCorpse: \(f\) => !!f\.corpse && !!f\.entity && \(!f\.puppet \|\| \(f\._pup\?\.o \| 0\) > 0\),/,
    'the encounter pool\'s lens is the one driven above, character for character');
  const rat = { id: 7, corpse: true, feet: [0, 0, 2], entity: { items: [{ shortName: 'Long Bow', templateIndex: 130 }] } };
  const bare = { id: 9, corpse: true, feet: [0, 0, 3], entity: { items: [] } };
  const shut = { id: 11, corpse: true, corpseDisabled: true, feet: [0, 0, 4], entity: { items: [{ shortName: 'Gold', templateIndex: 530 }] } };
  // a PUPPET's body: its owner's word is what says whether it holds
  // anything, and an owner who says "empty" takes it out of the ray.
  const puppetFull = { id: 13, corpse: true, feet: [0, 0, 5], puppet: true, _pup: { o: 2 }, entity: { items: [] } };
  const puppetSpent = { id: 15, corpse: true, feet: [0, 0, 6], puppet: true, _pup: { o: 0 }, entity: { items: [] } };
  const pool = [rat, bare, shut, puppetFull, puppetSpent];
  const keys = corpseLootTargets(pool, 'foeCorpse', lens).map((t) => t.key);
  assert.deepEqual(keys, ['foeCorpse:7', 'foeCorpse:9', 'foeCorpse:13'],
    'a disabled body is not a target at all, and neither is a puppet its owner says is empty');
  assert.equal(corpseEntryFor(pool, 'foeCorpse:7', 'foeCorpse', lens), rat, 'the key the producer minted resolves back');
  assert.deepEqual(corpseContents(rat), rat.entity.items, 'and the body answers what it holds');
  // An EMPTY body answers `[]`, not null: "it holds nothing" is an
  // answer, and it draws differently from "I do not stand this key".
  assert.deepEqual(corpseContents(bare), []);
  assert.equal(corpseContents(shut), null, 'a disabled container is not ours to list');
  assert.equal(corpseContents(null), null);

  // THE LADDER. composeNamer's law with a different predicate: FIRST
  // NON-NULL WINS, insertion order is priority, and `[]` stops the walk.
  const asked = [];
  const contents = composeContents([
    (key) => { asked.push('piles'); return key.startsWith('droppedLoot:') ? [{ shortName: 'Apple', templateIndex: 0 }] : null; },
    (key) => { asked.push('foes'); return corpseContents(corpseEntryFor(pool, key, 'foeCorpse', lens)); },
    (key) => { asked.push('guards'); return null; },
  ]);
  assert.deepEqual(contents('foeCorpse:7'), rat.entity.items);
  assert.deepEqual(asked, ['piles', 'foes'], 'the walk STOPS at the first answer');
  asked.length = 0;
  assert.deepEqual(contents('foeCorpse:9'), [], 'an empty body stops it too');
  assert.deepEqual(asked, ['piles', 'foes']);
  assert.equal(contents('corpse:7'), null, 'a key no reader stands answers null, and every reader was asked');
  assert.equal(composeContents(null)('loot:0'), null);

  // ...AND THE FRAME THE PLAQUE ACTUALLY DRAWS. This is the assertion
  // the bug would have failed: a body under the crosshair draws ROWS.
  const hit = { key: 'foeCorpse:7', distance: 2, reach: 3.2 };
  const f = resolveHover(hit, { name: () => ({ title: 'Rat (dead)' }), contents });
  assert.equal(f.kind, 'items');
  assert.equal(f.title, 'Rat (dead)');
  assert.equal(f.empty, false, 'NOT "Empty" - that was the bug, in one word');
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].name, 'Long Bow', 'the row is the ITEM, through the port\'s own resolver');
  // and a body that really is empty still says so.
  assert.equal(resolveHover({ key: 'foeCorpse:9', distance: 2, reach: 3.2 }, { name: () => ({ title: 'Rat (dead)' }), contents }).empty, true);
});

test('INTERIOR-BODIES: a body killed inside a building is stood, named, listed and OPENED - all four hosts now', () => {
  // AUDIT-WH2 L2-F4, and the one finding of that audit that was a
  // missing FAMILY rather than a hover bug. Indoors the game spawns real
  // foes and a real watch; `mintCorpse` is unconditional and the pools
  // ARE `createExteriorFoes`/`createCityGuards`, the same two that stand
  // bodies in the street - the corpse billboard even DRAWS indoors,
  // because `batches()` returns the live sprites and the corpse batches
  // together. The interior's target list simply never asked for them.
  //
  // So the body was decorative: no plaque over it, no loot window, ever,
  // while the other three hosts all open it. The press and the plaque
  // AGREED, both silent, which is exactly why no gate could see it - a
  // family a host does not stand looks identical to a family a host
  // deliberately ignores.
  const wm = read('src/scenes/worldModes.js');

  // STOOD. The pools' own `lootTargets()`, not a second spelling of the
  // box: CORPSE_ACTIVATION_DISTANCE (150 classic units, not 128 -
  // ActivateLootContainer exempts a CorpseMarker and re-tests it at
  // PlayerActivate.cs:938) rides in on them.
  const list = wm.slice(wm.indexOf('function interiorActivationTargets() {'));
  const body = list.slice(0, list.indexOf('return targets;'));
  assert.match(body, /if \(interiorFoes\) targets\.push\(\.\.\.interiorFoes\.lootTargets\(\)\);/, 'the room\'s foes');
  assert.match(body, /if \(interiorGuards\) targets\.push\(\.\.\.interiorGuards\.lootTargets\(\)\);/, 'and the watch called into it');

  // NAMED, by the pool that stands it, above the mod's switch - a
  // corpse's word is the port's own departure (PX21c) and predates the
  // mod, the same reason the dropped pile beside it is ungated.
  const namer = wm.slice(wm.indexOf('const interiorHoverName = composeNamer(['));
  const rungs = namer.slice(0, namer.indexOf('if (!worldTooltipsOn()) return null;'));
  assert.match(rungs, /\(key\) => interiorFoes\?\.hoverName\?\.\(key\) \?\? null,/, 'the foe pool answers for its own bodies');
  assert.match(rungs, /\(key\) => interiorGuards\?\.hoverName\?\.\(key\) \?\? null,/, '...and the watch for its own');

  // LISTED. A host's contents ladder covers exactly the itemised keys
  // THAT host stands - it was one prefix while the interior stood no
  // bodies, and a body reading "Empty" over a full pack is the defect
  // AUDIT-WH H3 extracted this ladder for outdoors.
  assert.match(wm, /contents: composeContents\(\[\n\s*\(key\) => \(typeof key === 'string' && key\.startsWith\('droppedLoot:'\)[^\n]*\n\s*\(key\) => interiorFoes\?\.hoverContents\?\.\(key\) \?\? null,\n\s*\(key\) => interiorGuards\?\.hoverContents\?\.\(key\) \?\? null,\n\s*\]\),/,
    'the interior reads contents as a LADDER, over every itemised key it stands');
  assert.match(wm, /import \{ composeNamer, composeContents \} from '\.\.\/systems\/worldHover\.js';/);

  // OPENED - the same door the street and the dungeon open: the pool's
  // own takeLoot, handed the say and a window-opener, because the body
  // becomes the inventory's REMOTE TARGET (PlayerActivate.cs:957)
  // rather than teleporting into the pack. The pool keeps the
  // empty-body refusal, the arrows pickup and a puppet's ask over the
  // wire; this hands it the door and nothing else.
  assert.match(wm, /if \(key\.startsWith\('foeCorpse:'\) \|\| key\.startsWith\('guardCorpse:'\)\) \{\n\s*const pool = key\.startsWith\('foeCorpse:'\) \? interiorFoes : interiorGuards;\n\s*pool\?\.takeLoot\(key, \(l\) => say\(l\), \(loot\) => mountInterior\(interiorInventory\(\{ loot \}\)\)\);\n\s*return true;\n\s*\}/,
    'the press arm the bodies never had');

  // ...and it sits INSIDE the reach refusal, like every other family in
  // this ladder: the pick reaches as far as the whole ray, so a body
  // across the room still WINS, and the handler is where the refusal is
  // spoken (AUDIT 65 MC-2).
  const ladder = wm.slice(wm.indexOf("if (_pick.distance > _pick.reach) { setMidScreenText(TOO_FAR_AWAY_TEXT); return true; }"));
  assert.ok(ladder.indexOf("key.startsWith('foeCorpse:')") > 0,
    'the corpse arm is below the too-far refusal, so an out-of-reach body says so rather than falling through');

  // THE FOUR HOSTS RULE, closed: every host that stands a body also
  // names it, lists it and opens it.
  const HOSTS = [
    ['src/scenes/world.js', 'exteriorFoes', 'cityGuards'],
    ['src/scenes/exterior.js', 'exteriorFoes', 'cityGuards'],
  ];
  for (const [f, a, b] of HOSTS) {
    const src = read(f);
    for (const pool of [a, b]) {
      assert.match(src, new RegExp(String.raw`${pool}\.lootTargets\(\)`), `${f}: ${pool} bodies are stood`);
      assert.match(src, new RegExp(String.raw`${pool}\.hoverContents\?\.\(key\)`), `${f}: ...and listed`);
    }
  }
  assert.match(read('src/scenes/dungeonContext.js'), /targets\.push\(\{ key: `corpse:\$\{i\}`/, 'the dungeon stands its own');
});

test('AUDIT-WH H3: both pools and both above-ground hosts are wired to that ladder', () => {
  // A family's TARGETS, its WORD and its CONTENTS are one thing in
  // three parts, and all three walk the pool's list under the same
  // identity. The bag used to be written out at each of them; HARD2's
  // law - four copies of a law is four chances to omit a term - is why
  // it is one `corpseLens` per pool now, read three times.
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const src = read(f);
    assert.match(src, /const corpseLens = \{/, `${f}: one identity, not three`);
    // AUDIT-WH2 L5: A COUNT IS NOT A LAW. This was `=== 4`, and four
    // mentions of the word anywhere in the file satisfied that -
    // `const hoverContents = () => null;` plus any fourth mention
    // passed it. The law is WHICH THREE READERS take the lens, so name
    // them: the targets, the namer's entry lookup, and the contents'.
    // A reader that stops passing it now fails here.
    assert.equal((src.match(/corpseLens\b/g) ?? []).length, 4,
      `${f}: declared once, read by the targets, the namer and the contents`);
    assert.match(src, /corpseLootTargets\((?:foes|guards), '(?:foe|guard)Corpse', corpseLens\)/,
      `${f}: the TARGETS walk the pool under the lens`);
    assert.equal((src.match(/corpseEntryFor\((?:foes|guards), key, '(?:foe|guard)Corpse', corpseLens\)/g) ?? []).length, 2,
      `${f}: and so do the namer and the contents - the same walk, twice, under the same identity`);
    assert.match(src, /hoverContents\b/, `${f}: and the contents arm exists`);
    assert.match(src, /hoverName, hoverContents,/, `${f}: ...and is published beside the namer`);
  }
  // A PUPPET's pile is its owner's - the take ASKS for it over the
  // wire and nothing here knows what is in it - so the encounter pool
  // publishes nothing for one, and the plaque falls back to the name.
  assert.match(read('src/scenes/exteriorFoes.js'), /return e && !e\.puppet \? corpseContents\(e\) : null;/);
  // BOTH hosts hand the composed ladder to the frame, and neither
  // keeps the inline ternary that knew about one prefix.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.match(src, /const _hoverContents = composeContents\(\[/, `${f}: one ladder`);
    assert.match(src, /contents: _hoverContents,/, `${f}: handed to the frame`);
    assert.doesNotMatch(src, /contents: \(key\) => \(typeof key === 'string' && key\.startsWith\('droppedLoot:'\)/,
      `${f}: and the one-prefix ternary is gone`);
    // the same three pools, in the ACTIVATION ladder's order, as the
    // namers beside them.
    // AUDIT-WH2 L2-F5: the pile rung carries C1's type guard now - a
    // CONTENTS ladder is handed every key a namer is, the exterior door
    // mints a bare number, and `key.startsWith` on one throws.
    assert.match(src, /\(key\) => \(typeof key === 'string' && key\.startsWith\('droppedLoot:'\) \? \(droppedLoot\.contents\?\.\(key\) \?\? null\) : null\),[^\n]*\n\s*\(key\) => exteriorFoes\.hoverContents\?\.\(key\) \?\? null,\s*\n\s*\(key\) => cityGuards\.hoverContents\?\.\(key\) \?\? null,/,
      `${f}: the piles, the encounter pool, the watch`);
  }
});

test('AUDIT-WH H2: the mod\'s MOBILE BAND - a townsperson and a live foe, named and raced', async () => {
  const { mobilePersonName, mobileEntityName, liveEntityName } = await import('../src/systems/worldTooltips.js');
  const { liveFoeTargets, liveFoeFor, foeAabb, MOBILE_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE } = await import('../src/player/activate.js');
  const { raceWinner } = await import('../src/player/activationRace.js');
  const { resolveHover } = await import('../src/systems/worldHover.js');

  // .cs:299-302 - a walking townsperson is MobilePersonNPC.NameNPC.
  assert.equal(mobilePersonName('Brisienna Magnessen'), 'Brisienna Magnessen');
  assert.equal(mobilePersonName(''), null, 'a nameless one draws nothing, not an empty plaque');
  assert.equal(mobilePersonName(undefined), null);
  // .cs:304-312 - a live entity is Entity.Name, and ONLY when its
  // motor is not hostile. The mod will not label the thing trying to
  // kill you, and an unnamed key draws NOTHING.
  assert.equal(mobileEntityName('Knight', { hostile: false }), 'Knight');
  assert.equal(mobileEntityName('Rat', { hostile: true }), null, 'a hostile one says nothing');
  // `!enemyMotor || !enemyMotor.IsHostile` - no motor at all IS named,
  // which in the port is a stub standing without an `ai`.
  assert.equal(mobileEntityName('Knight'), 'Knight', 'no motor, still named');
  assert.equal(mobileEntityName('', { hostile: false }), null);
  // AUDIT-WH2 L4-F1: ...AND WHICH MEMBER THE WORD COMES FROM. The
  // campaign caught this one with no pin behind it: reverting the four
  // call sites to `enemyDisplayName(f.mobileType)` survived.
  //
  // The mod's LIVE arm is `.cs:310`
  // `((DaggerfallEntityBehaviour)comp).Entity.Name`, which is
  // EnemyEntity.cs:314 `name = career.Name` - set after the if/else, so
  // a monster and a class enemy both take their CAREER's name. The mod's
  // CORPSE arm is a different member entirely: `.cs:526`
  // `loot.entityName`, which GameObjectHelper.cs:701 fills from
  // `GetLocalizedEnemyName(...)`. The port handed the corpse's member to
  // the live arm, so a living city watchman was labelled from the enemy
  // table instead of his career.
  assert.equal(liveEntityName({ entity: { name: 'Knight' } }, 'City Watch'), 'Knight',
    'the CAREER name wins - it is the member the mod reads');
  // RECORDED DEPARTURE: the port's enemy entity only carries a career
  // name for CLASS enemies (`name: isClass ? career.name : undefined`,
  // characters/enemyEntity.js), because nothing else has ever needed a
  // monster's career template. A monster falls through to the enemy
  // name, which is the only word the port holds for it.
  assert.equal(liveEntityName({ entity: { name: undefined } }, 'Rat'), 'Rat',
    'a monster has no career name in this port and takes the enemy name');
  assert.equal(liveEntityName({}, 'Rat'), 'Rat', 'and so does a record with no entity at all');
  assert.equal(liveEntityName(null, null), null, 'no word anywhere is no word');
  assert.match(read('src/characters/enemyEntity.js'), /name: isClass \? career\.name : undefined,/,
    'the departure above is this line - if the port ever loads monster careers, the fallback stops being reachable');
  // ...and all FOUR hosts read it through that one door rather than
  // reaching for the corpse's member again.
  for (const [f, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/cityGuards.js', 'g'],
    ['src/scenes/worldModes.js', 'f'], ['src/scenes/dungeonContext.js', 'f']]) {
    assert.match(read(f), new RegExp(String.raw`mobileEntityName\(liveEntityName\(${v}, enemyDisplayName\(${v}\.mobileType\)\), \{ hostile: !!${v}\.ai\?\.isHostile \}\)`),
      `${f}: the live arm takes Entity.Name, with the enemy name only as the port's fallback`);
  }

  // THE FAMILY. The RAY's distance with the MOD's 6.4 beside it -
  // AUDIT 65 MC-2's law, because the band is a gate inside the handler
  // and not a shorter ray (the press's Info arm has no gate at all,
  // PlayerActivate.cs:816-825).
  const foes = [
    { entity: {}, mobileType: 1, ai: { feet: [0, 0, 3], height: 1.9, isHostile: false } },
    { entity: {}, mobileType: 2, dead: true, ai: { feet: [0, 0, 4] } },   // a body is the CORPSE family's, not this one
    { entity: {}, mobileType: 3, ai: null },                              // no motor, no feet: nothing to strike
    { entity: {}, mobileType: 4, ai: { feet: [0, 0, 6], isHostile: true } },
  ];
  const t = liveFoeTargets(foes, 'mobileFoe');
  assert.deepEqual(t.map((x) => x.key), ['mobileFoe:0', 'mobileFoe:3'],
    'the living, with something to strike - keyed by INDEX, the dungeon pool\'s own law');
  assert.equal(t[0].distance, RAY_DISTANCE);
  assert.equal(t[0].reach, MOBILE_NPC_ACTIVATION_DISTANCE);
  // ONE volume, so the plaque's sweep and the press's `pickFoeAlong`
  // cannot disagree about what the ray struck.
  assert.deepEqual(t[0].aabb, foeAabb(foes[0]));
  assert.deepEqual(t[0].aabb, { min: [-0.45, 0, 2.55], max: [0.45, 1.9, 3.45] });
  assert.equal(foeAabb(foes[2]), null, 'no feet, no box');
  // ...and the key resolves back to the foe the producer minted it for.
  assert.equal(liveFoeFor(foes, 'mobileFoe:3', 'mobileFoe'), foes[3]);
  assert.equal(liveFoeFor(foes, 'mobileFoe:1', 'mobileFoe'), null, 'a body is not a live foe');
  assert.equal(liveFoeFor(foes, 'corpse:0', 'mobileFoe'), null);
  // AUDIT-WH C1: the namer ladder is handed EVERY key the ray can win,
  // and the exterior door's is a bare NUMBER.
  assert.doesNotThrow(() => liveFoeFor(foes, 17, 'mobileFoe'));
  assert.equal(liveFoeFor(foes, 17, 'mobileFoe'), null);
  // An id law of the pool's own - the stable handle its corpse keys use.
  assert.deepEqual(liveFoeTargets(foes, 'mobileGuard', { idOf: (f) => f.mobileType }).map((x) => x.key),
    ['mobileGuard:1', 'mobileGuard:4']);

  // THE PRECEDENCE. Both new competitors sit at the TAIL, in this
  // order, because both of the press's arms take their subject only
  // when it is STRICTLY nearer than its rival - the foe's rival
  // includes the persons, the person's does not.
  const at = (d) => ({ key: 'x', distance: d });
  const door = { key: '__ground__', distance: 5 }, person = { key: 'mobileNpc:0', distance: 5 }, foe = { key: 'mobileFoe:0', distance: 5 };
  assert.equal(raceWinner({ ground: door, person, foe }), door, 'the list beats both on a tie');
  assert.equal(raceWinner({ person, foe }), person, 'a person beats a foe on a tie');
  assert.equal(raceWinner({ ground: at(6), person, foe }), person, '...and nearest still wins');
  assert.equal(raceWinner({ ground: at(6), person: at(6), foe }), foe, 'a foe takes it only strictly nearer');
  assert.equal(raceWinner({ camp: at(4), ground: door, person, foe })?.distance, 4);

  // AND WHAT IT DRAWS. The mod's band is 6.4, carried as the pick's
  // reach, so a foe down a corridor is raced (the plaque must not name
  // the wall behind it) and then says NOTHING - which is the mod's own
  // silence, not a disagreement with the press.
  const namer = (key) => {
    const f = liveFoeFor(foes, key, 'mobileFoe');
    const t2 = f ? mobileEntityName(['', 'Knight', '', '', 'Rat'][f.mobileType], { hostile: !!f.ai?.isHostile }) : null;
    return t2 ? { title: t2 } : null;
  };
  assert.deepEqual(resolveHover({ key: 'mobileFoe:0', distance: 3, reach: MOBILE_NPC_ACTIVATION_DISTANCE }, { name: namer }),
    { key: 'mobileFoe:0', kind: 'name', title: 'Knight', subs: [], rows: [], rest: 0, empty: false });
  assert.equal(resolveHover({ key: 'mobileFoe:0', distance: 20, reach: MOBILE_NPC_ACTIVATION_DISTANCE }, { name: namer }), null,
    'past the band, the plaque says nothing');
  assert.equal(resolveHover({ key: 'mobileFoe:3', distance: 3, reach: MOBILE_NPC_ACTIVATION_DISTANCE }, { name: namer }), null,
    'and a HOSTILE one says nothing at any range');
});

test('AUDIT-WH H2: all four hosts race the mobile band, and none of them stands it in the PRESS\'s list', () => {
  // THE FOUR HOSTS RULE. A living foe is in NO host's activation
  // target list, and must not be: `tryMobileEnemyActivate` sweeps the
  // pool itself and no press arm reads a `mobileFoe:` key, so a target
  // standing in that list would win the pick and eat the click in
  // silence - the exact failure worldHover.js's composition seam is
  // written against. It is raced BESIDE the list, through the one
  // precedence, in every host.
  //
  // Above ground the family is the POOL's (its keys, its ids, its
  // namer beside its producer, as the corpses are); inside, the list
  // is the context's and the family goes straight through the one
  // producer. Either way it is `liveFoeTargets` that mints it.
  const hosts = {
    'src/scenes/world.js': ['exterior (streaming)', /liveTargets\(\), \.\.\.cityGuards\.liveTargets\(\)\]/, /liveHoverName/],
    'src/scenes/exterior.js': ['exterior (fixed city)', /liveTargets\(\), \.\.\.cityGuards\.liveTargets\(\)\]/, /liveHoverName/],
    'src/scenes/exteriorFoes.js': ['the encounter pool', /liveFoeTargets\(foes, 'mobileFoe', \{ idOf \}\)/, /liveFoeFor\(foes, key, 'mobileFoe', \{ idOf \}\)/],
    'src/scenes/cityGuards.js': ['the watch', /liveFoeTargets\(guards, 'mobileGuard', \{ idOf \}\)/, /liveFoeFor\(guards, key, 'mobileGuard', \{ idOf \}\)/],
    'src/scenes/worldModes.js': ['interior', /liveFoeTargets\(interiorFoePool\(\), 'mobileFoe'\)/, /liveFoeFor\(interiorFoePool\(\), key, 'mobileFoe'\)/],
    'src/scenes/dungeonContext.js': ['dungeon (both doors)', /liveFoeTargets\(foes, 'mobileFoe'\)/, /liveFoeFor\(foes, key, 'mobileFoe'\)/],
  };
  for (const [f, [what, stands, names]] of Object.entries(hosts)) {
    const src = read(f);
    assert.match(src, stands, `${what}: the live bodies are stood`);
    assert.match(src, names, `${what}: ...and named`);
    // never appended to the list the press picks from
    assert.doesNotMatch(src, /targets\.push\(\.\.\.liveFoeTargets\(/, `${what}: never in the press's list`);
    assert.doesNotMatch(src, /lootTargets\(\), \.\.\.liveFoeTargets\(/, `${what}: nor composed into it`);
  }
  // ...and the ONE id law per pool, read by the corpse lens and the
  // live producer alike, so a body and the foe it was cannot key
  // differently.
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.match(read(f), /const idOf = \(\w\) =>/, `${f}: one identity, alive or dead`);
    assert.match(read(f), /\n    idOf,\n/, `${f}: ...and the corpse lens takes it`);
  }
  // The two above-ground hosts race the TOWNSFOLK too, off the press's
  // own scan rather than a second one of their own.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.match(src, /const n = nearestPerson\(eye, dir, _livePersons\);/, `${f}: townTalk's own scan`);
    assert.match(src, /key: `mobileNpc:\$\{n\.index\}`, distance: n\.distance, reach: MOBILE_NPC_ACTIVATION_DISTANCE/, `${f}: the ray, the mod's reach`);
    assert.match(src, /person: _hoverPersonPick\(cam\.pos, _hd\),/, `${f}: raced`);
    assert.match(src, /mobilePersonName\(_livePersons\[Number\(key\.split\(':'\)\[1\]\)\]\?\.person\?\.nameNPC\)/, `${f}: and named`);
  }
  // ONE SCAN, TWO READERS: townTalk's press arm takes the same answer.
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /export function nearestPerson\(camPos, fwd, persons\)/);
  assert.match(tt, /const near = nearestPerson\(camPos, fwd, persons\);/,
    'tryActivate reads the one scan, it does not keep its own');
});

test('AUDIT-WH H4/L3/L5: the plaque comes DOWN when a branch returns above the frame, and when the gate flips under it', () => {
  // A DOM overlay stays painted unless it is TOLD otherwise (AUDIT 64
  // F37). The hide used to be spoken only by a frame that reached
  // `worldHoverFrame`, and four host branches return above that call -
  // both dungeon hosts on an overlay and both above-ground hosts on a
  // held frame - so a name stayed on screen over every dungeon window,
  // naming a container's PRE-TAKE contents while the window emptied it.
  withPlaque((root) => {
    showWorldPlaque({ key: 'loot:1', kind: 'name', title: 'Iron Chest', subs: [], rows: [], rest: 0, empty: false });
    assert.equal(root().classList.contains('on'), true, 'painted');
    hideWorldPlaque();
    assert.equal(root().classList.contains('on'), false, 'and taken down by the door, with no frame involved');
    assert.equal(_plaqueSignatureForTests(), null,
      'the signature goes too - a hidden plaque must repaint the same name, not guard it away');
    // ...and the SAME frame paints again after a hide, which is the
    // half a naive `classList.remove` would have broken.
    showWorldPlaque({ key: 'loot:1', kind: 'name', title: 'Iron Chest', subs: [], rows: [], rest: 0, empty: false });
    assert.equal(root().classList.contains('on'), true);
    assert.deepEqual(textsOf(root(), 'wplaque-title'), ['Iron Chest']);
  });
  // AUDIT-WH L5: THE GATE REFUSES TO DRAW, NOT TO HIDE. Both of its
  // terms flip under a live plaque - the skin is a setting, and
  // `isTouchDevice` is a media query a tablet-mode flip changes - and
  // a bare `return` above the hide stranded a painted node naming what
  // a tap will not open.
  withPlaque((root) => {
    showWorldPlaque({ key: 'loot:1', kind: 'name', title: 'Iron Chest', subs: [], rows: [], rest: 0, empty: false });
    assert.equal(root().classList.contains('on'), true);
    // the device becomes a touch device under the painted plaque
    const search = '?skin=enhanced&touch=on';
    globalThis.location = { search };
    globalThis.window = { location: { search }, matchMedia: () => ({ matches: false }) };
    assert.equal(worldPlaqueOn(), false, 'the gate is shut now');
    showWorldPlaque(null);
    assert.equal(root().classList.contains('on'), false, 'and the painted node went down with it');
  });
  // ...and a CLASSIC page still never reaches ensure(). AUDIT 39: the
  // hide must not be a back door into injectEnhancedStyle().
  withPlaque((root) => {
    showWorldPlaque({ key: 'loot:1', kind: 'name', title: 'Iron Chest', subs: [], rows: [], rest: 0, empty: false });
    assert.equal(root(), null, 'classic loads nothing');
    hideWorldPlaque();
    assert.equal(root(), null, 'and hiding a node that was never made makes none');
  }, { skin: 'classic' });
});

test('AUDIT-WH2 L1-F1/F2: the door\'s word is dropped when the ray leaves it, and a miss never poisons the key', () => {
  // The mod's WHOLE bound on a stale door tooltip is `prevHit`: `isSame`
  // (.cs:266-275) short-circuits the entire body while you stare at one
  // collider - so the mod IS stale while you stare, and the port carries
  // that 1:1 - but `prevHit = null` on every other path (.cs:666, .cs:672,
  // .cs:786) makes the next look a full recompute.
  //
  // The port's key was (door index, door generation) and a generation
  // only moves when a pixel streams or the origin recentres. So: read a
  // shop's door at 17:55, turn away, come back at 18:05, and the plaque
  // still said OPEN while the press said "This store is closed" - for as
  // long as the player stayed on that street. The VALUE reads the hour,
  // the holidays, guild membership and the quest links; none of them is
  // in the key.
  const wm = read('src/scenes/worldModes.js');
  // the drop lives in the PICK, because a look at NOTHING never reaches
  // a namer at all and that is the commonest look-away there is.
  assert.match(wm, /const winner = raceWinner\(\{ \.\.\.picks, ground \}\);[\s\S]{0,1600}?\n\s+if \(winner\?\.key !== _doorTextKey\) \{ _doorTextKey = null; _doorText = null; \}\n\s+return winner;/,
    'the exterior pick drops the door text the moment the winner is a different key');
  // ...and the arm stamps the key ONLY on success. It used to stamp on
  // entry with `_doorText = null` beside it, so ONE frame in which the
  // building did not resolve made that door nameless for the whole
  // generation while the press opened it perfectly well. The mod returns
  // `prevDoorText` there (.cs:761) - the same door's last good word.
  assert.doesNotMatch(wm, /_doorTextKey = key; _doorTextGen = gen; _doorText = null;/,
    'the key is never stamped before the value is known');
  const arm = wm.slice(wm.indexOf('const gen = doorGeneration?.() ?? 0;'));
  const head = arm.slice(0, arm.indexOf('_doorTextKey = key; _doorTextGen = gen;'));
  // four: the cache HIT at the top, and the three misses below it -
  // `!bd`, `!locId`, `!db` - each handing back the same door's last good
  // word instead of writing a null under its key.
  assert.equal((head.match(/return _doorText;/g) ?? []).length, 4,
    'the cache hit and all three misses hand back the same door\'s last word rather than caching a null');
  assert.doesNotMatch(head, /return null;/, 'and none of them caches the negative');
  assert.match(arm, /_doorText = staticDoorName\('building', \{[\s\S]{0,400}?\}\);\n\s+_doorTextKey = key; _doorTextGen = gen;\n\s+return _doorText;/,
    'the stamp is the LAST thing the success path does');
});

test('AUDIT-WH2 L2-F3: the mod\'s switch turns the mod\'s MOBILE BAND off, in all four hosts', () => {
  // The band is .cs:297-320 - a live foe, a watchman, a walking
  // townsperson - and both outer hosts had it in the UNGATED array, the
  // one that holds the port's own objects. So a player who turned World
  // Tooltips off still had names floating over every rat and passer-by in
  // the street, while the same rat in a building or a dungeon went quiet.
  // One array cannot carry two gating laws; two arrays can.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.match(src, /const _hoverModNamers = \[/, `${f}: the mod's band has its own array`);
    assert.match(src, /names: _hoverNamers, modNames: _hoverModNamers \}\)/, `${f}: ...and both are handed over`);
    // the three arms of the band are in the GATED array, not the other
    const mod = src.slice(src.indexOf('const _hoverModNamers = ['));
    const own = src.slice(src.indexOf('const _hoverNamers = ['), src.indexOf('const _hoverModNamers = ['));
    for (const arm of ['liveHoverName', 'mobilePersonName']) {
      assert.match(mod.slice(0, mod.indexOf('];')), new RegExp(arm), `${f}: ${arm} is the mod's`);
      assert.doesNotMatch(own, new RegExp(arm), `${f}: ...and is NOT in the ungated array`);
    }
  }
  // and the seam runs it BELOW the switch, at the top of the mod's own
  // ladder - .cs:297-320 sits above the board, the person and the doors.
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /const own = composeNamer\(names\)\(key\);\n\s+if \(own\) return own;\n\s+if \(!worldTooltipsOn\(\)\) return null;[\s\S]{0,1600}?\n\s+const band = composeNamer\(modNames\)\(key\);\n\s+if \(band\) return band;/,
    'the port\'s own first and ungated, the mod\'s band next and gated');
});

test('AUDIT-WH H4/L2/L3/L4/L6: every host branch that returns above the hover says the hide, and the plaque dies with the loop', () => {
  // THE FOUR HOSTS RULE, on the lifecycle rather than the wiring.
  const wm = read('src/scenes/worldModes.js');
  const dj = read('src/scenes/dungeon.js');
  const wo = read('src/scenes/world.js');
  const ex = read('src/scenes/exterior.js');

  // H4: both dungeon hosts return above `drawFoes`, where the hover
  // lives, and `hideHudText` already rode that exact line for this
  // exact reason. The record claimed the scheduling accident had been
  // replaced "by law"; it had not.
  assert.match(wm, /if \(dungeonCtx\.uiOverlayActive\) \{ dungeonCtx\.hideHudText\?\.\(\); hideWorldPlaque\(\);/,
    'the world-hosted dungeon hides it on the overlay branch');
  assert.match(dj, /ctx\.hideHudText\?\.\(\); hideWorldPlaque\(\);/,
    'and so does the standalone ?dungeon door');
  // ...and the dungeon's own call finally carries a cursorActive.
  assert.match(read('src/scenes/dungeonContext.js'), /cursorActive: dungeonPaused\(\),/,
    'the belt: the context states it too, rather than relying on when it is called');

  // L2: the interior's is the CROSSHAIR's answer, not the top of one
  // stack - `!!interiorOverlay` missed a townTalk-slot window and the
  // depth under the top.
  assert.match(wm, /cursorActive: overlayHeld,/);
  assert.doesNotMatch(wm, /cursorActive: !!interiorOverlay,/);

  // L3: a full-screen video owns the canvas and this return is above
  // the hover - the plaque floated over infection dreams.
  for (const [f, src] of [['world.js', wo], ['exterior.js', ex], ['dungeon.js', dj]]) {
    assert.match(src, /if \(frameHeld\(\)\) \{ frameAbort\(\); hideWorldPlaque\(\);/, `${f}: the held frame takes it down, and closes the frame token it opened`);
    // L4: ...and the host's ONE unwind point destroys it. `world.js`
    // imported the door and never called it; `exterior.js` had no
    // teardown at all.
    assert.match(src, /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/,
      `${f}: the plaque dies with the loop that raised it`);
  }

  // L6: EVERY ALLOCATION HAS AN OWNER. The door cache holds the
  // outgoing city's rows, each off a live dfBlock, and it is
  // exterior-only by construction - so leaving the street frees it, at
  // the one write of `mode` rather than at the sites that write it.
  // AUDIT-WH P1/P5 put the two per-frame ray-list memos in the same
  // dropper: a list built for the street is not the building's, and a
  // frame that crosses a threshold must not serve the outgoing one.
  assert.match(wm, /const dropDoorCache = \(\) => \{ _doorCache = null; _extList = null; _extMark = null; _intList = null; _intMark = null; _doorTextKey = null; _doorText = null; \};/);
  // AUDIT-WH2 L1-F5: AND THIS IS THE PIN THAT REPLACED A COUNT.
  //
  // What stood here was `dropDoorCache(); === 4`, "both ways in and
  // both ways out" - and the count was already wrong when it was
  // written. There were FIVE writes of `mode`; the quest-teleport and
  // save-load teardown was the fifth, it had no free beside it, and
  // this pin actively defended the hole: adding the missing call
  // turned the suite red. A count is not a law, it is a snapshot of
  // how many times somebody remembered.
  //
  // The law is that `mode` has ONE writer. These two assertions say so
  // in the only way a source pin can - the free is inside that writer,
  // and no other line in the file assigns `mode` at all - so a sixth
  // mode that spells its own flip fails here instead of leaking a
  // street. A PIN MUST FAIL: delete the `dropDoorCache()` from setMode
  // and the first dies; write `mode = 'whatever'` anywhere and the
  // second does.
  assert.match(wm, /const setMode = \(next\) => \{ dropDoorCache\(\); mode = next; \};/,
    'the free rides the one write of mode');
  const rawModeWrites = (wm.match(/^\s*mode = (?!next;)/gm) ?? []);
  assert.equal(rawModeWrites.length, 0,
    `every mode flip goes through setMode - found ${rawModeWrites.length} raw assignment(s) beside it`);
  assert.equal((wm.match(/^\s*setMode\('(exterior|interior|dungeon)'\);$/gm) ?? []).length, 5,
    'both ways in, both ways out, and the teardown that forgot');
});

test('AUDIT-WH M1: every family in the ray carries a reach, and the widest of them IS the mod\'s 6.4', async () => {
  const A = await import('../src/player/activate.js');
  // worldTooltips.js's own header rests a whole structural argument on
  // this: "the mod never labels anything past 6.4 ... the port's widest
  // reach IS 6.4, and every other family's is smaller, so the reach
  // gate answers the same everywhere without a second clamp to keep in
  // step." Nothing checked it, and it was FALSE - the bulletin board
  // was minted with no `reach` at all, so `pickActivatableHit` fell to
  // `reach ?? distance` and handed the plaque a board at the RAY's
  // 76.8: a notice board named halfway down the street, where the mod's
  // own band for it is MobileNPCActivationDistance (.cs:315-318).
  const REACHES = {
    DEFAULT_ACTIVATION_DISTANCE: A.DEFAULT_ACTIVATION_DISTANCE,
    TREASURE_ACTIVATION_DISTANCE: A.TREASURE_ACTIVATION_DISTANCE,
    DOOR_ACTIVATION_DISTANCE: A.DOOR_ACTIVATION_DISTANCE,
    CORPSE_ACTIVATION_DISTANCE: A.CORPSE_ACTIVATION_DISTANCE,
    MOBILE_NPC_ACTIVATION_DISTANCE: A.MOBILE_NPC_ACTIVATION_DISTANCE,
    STATIC_NPC_ACTIVATION_DISTANCE: A.STATIC_NPC_ACTIVATION_DISTANCE,
    PICKUP_REACH: (await import('../src/scenes/droppedTorches.js')).PICKUP_REACH,
    CAMP_REACH: (await import('../src/systems/survival/camp.js')).CAMP_REACH,
    WAGON_REACH: (await import('../src/player/eotbWagon.js')).WAGON_REACH,
  };
  const CLAMP = A.STATIC_NPC_ACTIVATION_DISTANCE;   // the mod's `rayDistance`, its widest band
  assert.equal(CLAMP, 6.4);
  for (const [k, v] of Object.entries(REACHES)) {
    assert.ok(v > 0 && v <= CLAMP, `${k} = ${v} is past the mod's own ray clamp`);
  }
  // ...and no target in the tree is minted with a bare `distance:
  // RAY_DISTANCE` and no reach, which is the shape that produced the
  // board: `pickActivatableHit` reads `reach ?? distance`, so omitting
  // the reach does not default it - it publishes the RAY as the reach.
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js',
    'src/scenes/corpseMarker.js', 'src/player/activate.js', 'src/scenes/droppedLoot.js']) {
    const bare = [...read(f).matchAll(/key: [^\n]*distance: RAY_DISTANCE(?![^\n]*reach)/g)];
    assert.deepEqual(bare.map((m) => m[0].slice(0, 70)), [], `${f}: a family reaching for the ray with no reach of its own`);
  }
  assert.match(read('src/scenes/worldModes.js'),
    /key: `board:\$\{i\}`, aabb, distance: RAY_DISTANCE, reach: BULLETIN_BOARD_ACTIVATION_DISTANCE/,
    'the board carries its handler\'s own constant (.cs:315-318, and ActivateBulletinBoard :709-713)');
  assert.equal((await import('../src/systems/bulletinBoard.js')).BULLETIN_BOARD_ACTIVATION_DISTANCE, CLAMP,
    '...which IS the mobile band, from its one home');
});

test('AUDIT-WH M2/M3/M4/M9: the mod\'s own asymmetries, ported as the mod has them', async () => {
  const { actionName, questResourceName, corpseName, houseContainerName, INTERACT_TEXT } =
    await import('../src/systems/worldTooltips.js');
  const { TRIGGER_FLAGS } = await import('../src/world/rdbLayout.js');

  // M2. The switch is NOT symmetric (.cs:420-437):
  //   74037 -> "Wheel",         multiTriggerOkay = true
  //   61027/61028 -> "Lever",   multiTriggerOkay = true
  //   74143 -> "The Mantella",  <no flag>
  // so a MULTITRIGGER Mantella falls to .cs:459-461 and is silenced
  // outright, name and all. The port derived the flag as "has a name",
  // which is true of three of the four and promotes the fourth.
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 74143), 'The Mantella', 'Direct still names it');
  assert.equal(actionName(TRIGGER_FLAGS.Direct6, 74143), 'The Mantella');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 74143), null,
    'a MultiTrigger Mantella is silenced - it names itself and does NOT raise the flag');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 74037), 'Wheel', 'the wheel does raise it');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 61027), 'Lever');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 61028), 'Lever');

  // M3. `HideDefaultInteractTooltip` guards ONE `<Interact>`: the
  // action arm's. The container default has no guard.
  assert.equal(houseContainerName(41999), INTERACT_TEXT);
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 12345, { hideInteract: true }), null);

  // M4. `ResolveItemLongName(item, FALSE)` (.cs:509) - the second
  // argument is `differentiatePlantIngredients`, which DFU defaults
  // TRUE (ItemHelper.cs:305-312: the first eighteen of each plant group
  // take "(northern)"/"(southern)"). The mod passes false HERE and
  // nowhere else, and the port took the default - so a quest plant
  // stand read a word the mod does not put on it.
  const plant = { group: 'PlantIngredients1', templateIndex: 3, name: 'Yellow Rose', identified: true };
  assert.doesNotMatch(String(questResourceName(plant)), /northern|southern/,
    'the quest stand takes the resolver with the differentiation OFF');
  const { itemLongName } = await import('../src/systems/itemInfo.js');
  assert.match(itemLongName(plant), /\(northern\)/,
    '...while the resolver\'s own default still differentiates, as DFU\'s does');

  // M9. `loot.entityName + " (dead)"`, with no fallback of the port's own.
  assert.equal(corpseName('Rat'), 'Rat (dead)');
  assert.equal(corpseName(''), ' (dead)');
});

test('AUDIT-WH M6: the two families the press has always acted on, driven', async () => {
  const { wagonHoverName, WAGON_HOVER_TEXT, WAGON_INFO_TEXT } = await import('../src/player/eotbWagon.js');
  const { waterSourceHoverName, WATER_SOURCE_NAME, DRY_SOURCE_TEXT } = await import('../src/systems/survival/items.js');
  // The cart: the noun out of the Info line the press already says, so
  // the plaque and the button cannot call one thing two things.
  assert.deepEqual(wagonHoverName('eotbWagon'), { title: WAGON_HOVER_TEXT });
  assert.match(WAGON_INFO_TEXT, new RegExp(WAGON_HOVER_TEXT.toLowerCase()));
  assert.equal(wagonHoverName('droppedLoot:3'), null, 'and it answers for nothing else');
  assert.equal(wagonHoverName(7), null, 'AUDIT-WH C1: including the exterior door\'s bare NUMBER');
  // The water source: named, and a DRY one says so BEFORE you press -
  // which is the whole point of a readout in the world, and is the
  // press's own sentence rather than a second wording of it.
  assert.deepEqual(waterSourceHoverName(false), { title: WATER_SOURCE_NAME, subs: [] });
  assert.deepEqual(waterSourceHoverName(true), { title: WATER_SOURCE_NAME, subs: [DRY_SOURCE_TEXT] });
});

test('AUDIT-WH2 L5-F10/F12: the row list survives a holed pack, and two rows never run together', () => {
  // F12: `hoverLines` filters holes out because `entity.items` is a
  // sparse-capable array and `itemNameParts` dereferences what it is
  // handed - a hole would throw inside the seam, be contained, and blank
  // the plaque over a body that plainly holds things. No fixture had ever
  // contained one, so dropping `.filter(Boolean)` survived.
  const holed = [{ name: 'Ruby' }, null, undefined, { name: 'Helm' }];
  const { shown, rest, empty } = hoverLines(holed);
  assert.deepEqual(shown.map((r) => r.name), ['Ruby', 'Helm'], 'the holes are gone, the items are not');
  assert.equal(empty, false);
  assert.equal(rest, 0);
  // F10: the row separator is what makes the signature INJECTIVE across a
  // ROW boundary, and the collision it prevents is a real one - it just
  // needs the field that can be EMPTY to sit at the boundary. A row is
  // `name \u0002 stack \u0002 rarity`, and `rarity` is null (so '') for a
  // common item and a tier word otherwise (LR1's `rarityAttr`), so:
  //
  //   ['Iron' rarity '']      + ['magicHelm']   ->  ...\u0002 magicHelm...
  //   ['Iron' rarity 'magic'] + ['Helm']        ->  ...\u0002magic Helm...
  //
  // are the same string once the rows run together, and a collided
  // signature is a plaque that does not repaint. Driven against
  // `frameSignature` itself with the rows built by hand, because that is
  // the unit whose whole contract is "different frames, different
  // strings" - going through `hoverLines` would only test which rarities
  // the loot table happens to mint today.
  const f = (rows) => frameSignature({ key: 'loot:1', kind: 'items', title: 'Loot Pile', subs: [], rows, rest: 0, empty: false });
  const r = (name, rarity = null) => ({ name, stack: 0, rarity });
  assert.notEqual(
    f([r('Iron'), r('magicHelm')]),
    f([r('Iron', 'magic'), r('Helm')]),
    'two rows never run together - the tier of one row cannot be read as the name of the next',
  );
  // ...and the same one field over, INSIDE a row, where the stack count
  // runs straight into the name: a stack of 12 Irons and a stack of 2
  // "Iron1"s are one string without it.
  assert.notEqual(
    f([{ name: 'Iron', stack: 12, rarity: null }]),
    f([{ name: 'Iron1', stack: 2, rarity: null }]),
    'a row\'s own fields are separated too',
  );
});

test('AUDIT-WH M5/M6/M7/M10: every family the press acts on has a word, and the ladder order is the mod\'s', async () => {
  const { LOCATION_TYPES } = await import('../src/formats/mapsFile.js');   // AUDIT-WH2 L5-F13: the dungeon-exit predicate is DRIVEN over the real table
  // M5/M6. A family a host STANDS but cannot NAME is the composition
  // seam's own named failure, one step on: the press acts and the
  // plaque says nothing (or, before this, said an invented word).
  // Outdoors, three families had no namer anywhere in the tree - the
  // player's dropped piles, the water sources and Eye Of The Beholder's
  // cart - while the press has raced all three since SURV3/EOTB-IL.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.match(src, /\? \{ title: lootPileName\(droppedLoot\.contents\?\.\(key\) \?\? null\) \} : null\)/,
      `${f}: a dropped pile is named as the interior and the dungeon name one`);
    assert.match(src, /\? waterSourceHoverName\(/, `${f}: a water source has a word`);
    assert.match(src, /\(key\) => wagonHoverName\(key\),/, `${f}: and so has the cart`);
  }
  // AUDIT-WH2 L5-F16: ...AND THE INTERIOR ARM, which this loop never
  // covered. M5's headline was that a pile OUTDOORS read the invented
  // literal 'Loot' while the same pile INDOORS read the mod's word - and
  // the pin that shipped with the fix held the two outdoor hosts only, so
  // the indoor arm the bug was measured against could be reverted to
  // `{ title: 'Loot' }` freely. All four hosts, one word.
  assert.match(read('src/scenes/worldModes.js'),
    /if \(key\.startsWith\('droppedLoot:'\)\) return \{ title: lootPileName\(interiorDropped\.contents\?\.\(key\) \?\? null\) \};/,
    'the interior names a pile from its contents too');
  assert.match(read('src/scenes/dungeonContext.js'), /return \{ title: lootPileName\(api\.lootContents\(key\)\) \};/,
    'and the dungeon, which is where the word came from');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(f).replace(/^\s*(?:\/\/|\*).*$/gm, ''), /title: 'Loot'/,
      `${f}: the invented word is nowhere in the tree`);
  }
  // ...each beside the module that STANDS it, never written out at the host.
  assert.match(read('src/player/eotbWagon.js'), /export const wagonHoverName = /);
  assert.match(read('src/systems/survival/items.js'), /export const waterSourceHoverName = /);

  // M7. GetStaticDoorText routes on `door.doorType` BEFORE it touches
  // the building (.cs:769-772). The port routed only the building arm,
  // so `staticDoorName('dungeonEntrance')` was written, pinned, and had
  // no caller in the tree: "To Privateer's Hold" never drew once.
  assert.match(read('src/scenes/worldModes.js'),
    /if \(entry\?\.door\?\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\) \{\n\s+return staticDoorName\('dungeonEntrance', \{ locationName: currentLocationName\(\) \}\);/);

  // AUDIT-WH2 L5-F13/F14: ...AND THE PREDICATE BEHIND `inTown`, which
  // nothing drove. `staticDoorName('dungeonExit', ...)` is exercised with
  // `inTown` SUPPLIED BY HAND, so the boolean the running game DERIVES -
  // which location types count as a town - had no test and no mutant
  // anywhere in the tree: narrowing it to TownCity alone, or hard-wiring
  // it true, both survived. TEST THE SHAPE THE PRODUCER MINTS.
  //
  // .cs:777-779 - a dungeon exit names the TOWN for City, Hamlet and
  // Village, and the REGION for everything else (a graveyard, a coven, a
  // dungeon in open country).
  {
    const wm2 = read('src/scenes/worldModes.js');
    const decl = /const DUNGEON_EXIT_TOWN_TYPES = \[LOCATION_TYPES\.TownCity, LOCATION_TYPES\.TownHamlet, LOCATION_TYPES\.TownVillage\];/;
    assert.match(wm2, decl, 'the three town types, as the mod lists them');
    assert.match(wm2, /inTown: DUNGEON_EXIT_TOWN_TYPES\.includes\(dungeonLoc\?\.mapTableData\?\.locationType \?\? -1\),/,
      'and the call site DERIVES it rather than asserting it');
    // drive the predicate itself over every location type the port knows
    const TOWNS = ['TownCity', 'TownHamlet', 'TownVillage'];
    const types = [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage];
    const inTown = (t) => types.includes(t ?? -1);
    for (const k of Object.keys(LOCATION_TYPES)) {
      assert.equal(inTown(LOCATION_TYPES[k]), TOWNS.includes(k), `${k} is ${TOWNS.includes(k) ? '' : 'not '}a town`);
    }
    assert.equal(inTown(undefined), false, 'and an unknown location is not a town - the region names it');
    assert.equal(inTown(-1), false);
  }

  // M10. `EnumerateCustomHoverText` is the FIRST statement of the
  // tooltip body (.cs:285) and every band below it is guarded on
  // `IsNullOrEmpty(ret)`, so a registered namer wins outright. The
  // dungeon ran its own ladder first. Inert today (disjoint keys),
  // which is exactly why it is worth fixing rather than noting.
  const ctx = read('src/scenes/dungeonContext.js');
  const ladder = ctx.slice(ctx.indexOf('const _namer = composeNamer(['), ctx.indexOf('const api = {'));
  const order = [...ladder.matchAll(/droppedTorches\.hoverName|camps\.hoverName|_hostNamers|_dungeonHoverName,/g)].map((m) => m[0]);
  assert.deepEqual(order, ['droppedTorches.hoverName', 'camps.hoverName', '_hostNamers', '_dungeonHoverName,'],
    'the extension namers first, the mod\'s own ladder last - as .cs:285-296 walks them');
  // ...and the two above-ground arms have always had it that way.
  assert.match(read('src/scenes/worldModes.js'), /const own = composeNamer\(names\)\(key\);\n\s+if \(own\) return own;\n\s+if \(!worldTooltipsOn\(\)\) return null;/);
});

test('AUDIT-WH P1/P2/P5: one answer a frame, and the mod\'s own cache on the one arm that is not a lookup', async () => {
  const { frameMark, frameBegin, frameEnd, frameAbort, frameCpu, _resetFrameClock } = await import('../src/systems/frameClock.js');
  // THE FRAME IN FLIGHT, as a token. It is the rAF stamp the host
  // already puts up (PERF1 pins that every host stamps it), it changes
  // exactly once a frame, and - the important half - it is NULL
  // between frames, so a memo keyed on it cannot carry an answer
  // forward and a caller outside a frame recomputes.
  _resetFrameClock();
  assert.equal(frameMark(), null, 'outside a frame, no token');
  frameBegin(1000);
  assert.equal(frameMark(), 1000);
  frameBegin(1016.7);
  assert.equal(frameMark(), 1016.7, 'a new frame is a new token');
  frameEnd(1020);
  assert.equal(frameMark(), null, 'and the token does not outlive the frame');
  _resetFrameClock();

  const wm = read('src/scenes/worldModes.js');
  // P1/P5: both ray lists are memoised on it. The exterior list was
  // built up to FOUR times in one frame on the streaming host - the
  // enemy arm's rival, the press's pick, the plaque's pick and the
  // plaque's namer - each copying the ~300-row door array and
  // re-walking the people and the boards.
  for (const [what, fn] of [['exterior', 'exteriorActivationTargets'], ['interior', 'interiorActivationTargets']]) {
    const body = wm.slice(wm.indexOf(`function ${fn}() {`), wm.indexOf(`function ${fn}() {`) + 900);
    // AUDIT-WH2 L5: the three alternations used to be INDEPENDENT groups,
    // so `_extMark === mark && _intList) return _extList;` matched. Pin the
    // arm's own name in all three places instead.
    const slot = fn.startsWith('exterior') ? 'ext' : 'int';
    assert.match(body, new RegExp(String.raw`!== null && _${slot}Mark === _?mark && _${slot}List\) return _${slot}List;`),
      `${what}: one answer a frame, and all three terms are THIS arm's`);
    assert.match(body, /_?mark = frameMark\(\);/, `${what}: keyed on the frame, not on a generation`);
  }
  // P2: the mod's `prevHit`/`prevText` (.cs:266-275) and its own
  // `prevDoorText` (.cs:762), on the ONE arm of the ladder that casts
  // a ray and box-tests a location's buildings rather than reading a
  // table - and keyed on the two things that say "the same door, in
  // the same world".
  assert.match(wm, /if \(_doorTextKey === key && _doorTextGen === gen\) return _doorText;/);
  assert.match(wm, /const gen = doorGeneration\?\.\(\) \?\? 0;/,
    'a moved origin or a streamed pixel misses the cache');
  // ...and every one of them dies with the mode.
  assert.match(wm, /_doorTextKey = null; _doorText = null; \};/);

  // AUDIT-WH2 L1-F4: AND THE TOKEN IS CLOSED BY AN EARLY RETURN TOO.
  //
  // The paragraph at the top of this test is the promise `frameMark`'s
  // docblock makes, and it was NOT TRUE when it was written. This
  // module's own header says so ten lines above it: "an early return
  // between them is a sample that is simply not taken". Every host has
  // two such returns and neither said `frameEnd` - and one of them, the
  // modal return, is taken on EVERY frame of every interior and dungeon
  // visit under the streaming host. So for a whole indoor session `open`
  // stayed stamped and `frameMark()` answered non-null in every gap.
  //
  // It was never a wrong answer INSIDE a frame (`frameBegin` takes the
  // rAF timestamp, so two frames cannot share a mark). It broke the
  // promise exactly where the promise was the point: `worldPlaqueOn()`'s
  // gate memo answered ENHANCED on a classic page when reached from
  // outside a frame - AUDIT 39's hazard shape - and this file's own
  // `__exit` probe, which the tree documents as calling `tryExit`
  // OUTSIDE the frame loop, was served the previous frame's target list.
  _resetFrameClock();
  frameBegin(2000);
  assert.equal(frameMark(), 2000);
  frameAbort();
  assert.equal(frameMark(), null, 'an early return closes the token');
  // ...and it takes NO sample, which is the whole reason it is not
  // `frameEnd`: a frame that bailed at its second statement did almost no
  // work, and folding it into the window's mean would make the
  // script-time number say the main thread got cheaper every time a
  // modal went up.
  assert.equal(frameCpu(), null, 'and no sample is taken for a frame that never ran');
  frameBegin(3000); frameEnd(3010);
  assert.equal(frameCpu()?.frames, 1, 'a real frame still samples');
  _resetFrameClock();

  // every host says it at BOTH of its early returns, and nowhere else
  // does a frame escape between the stamp and the close.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const src = read(f);
    assert.match(src, /import \{ frameBegin, frameEnd, frameAbort \}/, `${f}: takes the door`);
    assert.equal((src.match(/frameAbort\(\);/g) ?? []).length, 2,
      `${f}: the held frame and the modal return, both`);
    assert.match(src, /if \(frameHeld\(\)\) \{ frameAbort\(\);/, `${f}: the held frame closes it`);
    assert.match(src, /frameAbort\(\);[^\n]*\n\s+requestAnimationFrame\(frame\);\n\s+return;/,
      `${f}: and so does the modal return, before it re-arms`);
  }
});

test('AUDIT-WH2 L5-F9: the gate memo is asked INSIDE a frame, which is the only place it memoises', async () => {
  // AUDIT-WH P3's whole subject, and nothing drove it: no pin ever called
  // `frameBegin()` before `worldPlaqueOn()`, so the memoised path was
  // never taken in the suite at all and `const mark = frameMark();` ->
  // `const mark = null;` survived. The INVALIDATION half was covered only
  // because `frameMark()` is null out of frame - which is to say, by the
  // memo never being used.
  const { frameBegin, frameEnd, _resetFrameClock } = await import('../src/systems/frameClock.js');
  _resetFrameClock();
  try {
    withPlaque(() => {
      frameBegin(5000);
      assert.equal(worldPlaqueOn(), true, 'enhanced, not touch');
      // the skin flips UNDER the frame - the memo must not see it
      globalThis.location.search = '?skin=classic&touch=off';
      globalThis.window.location.search = '?skin=classic&touch=off';
      assert.equal(worldPlaqueOn(), true, 'one answer a frame: the mid-frame flip is not seen');
      frameEnd(5010);
      frameBegin(5020);
      assert.equal(worldPlaqueOn(), false, '...and the NEXT frame sees it');
    });
  } finally { _resetFrameClock(); }
});

test('AUDIT-WH R7/R8/P7/P9: the list has a cap, a readout is the player\'s online, and the two caches say why they are valid', () => {
  // R7: the rows have their own node and had no rule at all, so a
  // six-row pile under the reticle walked off the bottom of a short
  // viewport. The cap is the room BELOW the cross, which the anchor
  // already knows - `--wp-top` IS the plaque's top edge.
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.wplaque-list \{ display: block; max-height: calc\(100vh - var\(--wp-top, 55%\) - 24px\);\s*\n\s*overflow: hidden; \}/);
  // ...and it CLIPS rather than scrolls, because the whole surface is
  // pointer-events: none - a readout is not a control, and the
  // "and N more" tail already tells the truth about the rest.
  assert.match(css, /\.wplaque \{[\s\S]{0,400}pointer-events: none;/);

  // P3: the gate's two terms are computed once a frame, not twice -
  // `isEnhanced()` parses a URLSearchParams and `isTouchDevice()` runs
  // up to three matchMedia queries, and BOTH readers are load-bearing
  // (the seam gates the resolve, the draw gates above `ensure()`), so
  // what changes is how often the terms are asked rather than how
  // often the gate is.
  const hov = read('src/ui/worldPlaque.js');
  assert.match(hov, /if \(mark !== null && _gateMark === mark\) return _gateOn;/);
  // ...and it is dropped by the teardown, so a new host never inherits
  // the last one's answer.
  assert.match(hov.slice(hov.indexOf('export function destroyWorldPlaque')), /_gateMark = null;\n  _gateOn = false;/);

  // R8: OL1 forces every vendored mod's `Enabled` online so the room
  // plays one game. That reasoning is about the WORLD; a crosshair
  // label stands nothing, rolls nothing, writes nothing and is not on
  // the wire - the same category as `chatHidden`, which the lane has
  // always left alone.
  const ol = read('src/systems/onlineLane.js');
  // MODS-ONLINE (2026-09-22) re-aimed this line. It matched the list
  // LITERALLY - `= ['world-tooltips'];` - which froze it at one entry
  // and so asserted "exactly one readout is the player's" when R8's
  // law is "a readout is". Seven more mods answer R8's question the
  // same way now (Mac: "Is it possible to allow all mods to be toggled
  // on and off for online?"), and the whole classification is held by
  // test/modsonline.test.js. What this pin owns is its OWN case: World
  // Tooltips is on that list and the lane does not force it.
  // MODS-ONLINE-2 (2026-09-22) re-aimed the third line. The lane no
  // longer asks "is this vendor exempt?" - it asks whether the KEY is
  // one the room's ground depends on, and nothing else is forced at
  // all. R8's own case is unchanged and stronger: World Tooltips is on
  // the player's list AND the lane forces none of its keys.
  assert.match(ol, /export const ONLINE_PLAYERS_OWN_MODS = \[/);
  assert.match(ol, /'world-tooltips',/);
  assert.match(ol, /const room = ONLINE_ROOM_MOD_KEYS\[vendor\];\s*\n\s*if \(!room \|\| !Object\.hasOwn\(room, key\)\) return undefined;/);

  // P7: ONE BUILDER, THREE READERS, NO SHARED SLOT. `springTargets()`
  // used to refill a module-level array on its way to the targets and
  // `drinkAtSpring` indexed it, so the take was correct only while the
  // press's call happened earlier in the same frame than the plaque's
  // pick and the plaque's namer. Nothing stated that and nothing could
  // have caught it: the list is identical between calls in one frame.
  const wo = read('src/scenes/world.js');
  assert.match(wo, /const springList = \(\) => \{/);
  assert.match(wo, /const springTargets = \(\) => springList\(\)\.map\(/);
  assert.match(wo, /const springAt = \(key\) => springList\(\)\[Number\(key\.split\(':'\)\[1\]\)\] \?\? null;/);
  assert.doesNotMatch(wo, /_springs\[Number\(key\.split/, 'no reader indexes the slot directly any more');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(f), /const drinkAtSpring = \(key\) => \{\s*\n?\s*const s = springAt\(key\);/, `${f}: the take reads the one lookup`);
  }

  // P9: the teleport's cache invalidation was INCIDENTAL. `state.init`
  // re-anchors the floating origin by up to 32,768 units and returns
  // no offset, so the recenter bump cannot see it; it was safe only
  // because the destroy loop above happens to run first and each
  // removal bumps the counter. One bump here makes the law stated.
  const teleport = wo.slice(wo.indexOf('queue.push(...state.init(px, py));'));
  // AUDIT-WH2 L5: the regex used to carry the COMMENT - "// WORLD-HOVER:
  // the origin was re-anchored" - so rewording the prose reddened the
  // suite and the pin's discriminating power was partly English. The law
  // is that the teleport bumps the generation; the sentence beside it is
  // not the law.
  assert.match(teleport.slice(0, 1200), /doorGeneration \+= 1;/,
    'a teleport re-anchors the origin, so the street\'s door rows are not the street\'s any more');
});
