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
  worldHoverFaults, PLAQUE_GAP, _plaqueSignatureForTests,
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
    remove() { n.removed = true; },
  };
  return n;
}

function withPlaque(fn, { skin = 'enhanced', touch = false } = {}) {
  const made = [];
  globalThis.document = {
    createElement: (t) => { const e = fakeEl(t); made.push(e); return e; },
    body: { append() {} },
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
  // (vendor .cs:265). It is also what stops a family nobody has ported
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
    const before = n.children;
    showWorldPlaque(f([{ name: 'Ruby' }]));
    assert.equal(n.children, before, 'the same frame does not touch the tree');
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
  assert.ok(a.top > centre / 2 + CROSSHAIR_ARM * s / 2, 'strictly below the cross\'s lower tip');
  assert.equal(plaqueAnchor(null), null);
  assert.equal(plaqueAnchor({ width: 0, height: 0 }), null, 'an unsized canvas has no anchor');
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
  // .cs:332-390 - archive 175, records 0..15.
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
  // .cs:421-431 - the three the mod names outright.
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 74037), 'Wheel');
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 61027), 'Lever');
  assert.equal(actionName(TRIGGER_FLAGS.Direct6, 61028), 'Lever');
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 74143), 'The Mantella');
  // .cs:402-404 - only Direct, Direct6 and MultiTrigger are named at
  // all. The rest are chain links and traps the player is not meant to
  // read as interactive.
  for (const t of [TRIGGER_FLAGS.None, TRIGGER_FLAGS.Collision01, TRIGGER_FLAGS.Collision03,
    TRIGGER_FLAGS.Collision09, TRIGGER_FLAGS.Attack, TRIGGER_FLAGS.Door]) {
    assert.equal(actionName(t, 74037), null, `trigger ${t} is not named`);
  }
  // .cs:466-467 - a named-trigger object with no word of its own.
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 12345), INTERACT_TEXT);
  assert.equal(actionName(TRIGGER_FLAGS.Direct, 12345, { hideInteract: true }), null,
    'HideDefaultInteractTooltip - the author\'s own knob, so the main quest\'s puzzles are not given away');
  // .cs:458-461 - THE MULTITRIGGER RULE, and the reason for it:
  // MultiTrigger is the flag on collision plates and trap volumes, so
  // an unlisted one is SILENCED outright rather than defaulted.
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 12345), null, 'a pressure pad is not labelled');
  assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, 74037), 'Wheel', 'but a named one still speaks');
  // .cs:432-438 - four the mod lets through WITHOUT a name of their own.
  for (const id of [62323, 72019, 74215, 74225]) {
    assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, id), INTERACT_TEXT, `${id} is allowed through`);
    assert.equal(actionName(TRIGGER_FLAGS.MultiTrigger, id, { hideInteract: true }), null);
  }
});

test('WORLD TOOLTIPS: a house container is named by its FULL model id, which `% 100` could not tell apart', async () => {
  const { houseContainerName, INTERACT_TEXT } = await import('../src/systems/worldTooltips.js');
  const { containerTextureRecord } = await import('../src/systems/containers.js');
  // .cs:558-629. The reason WORLD-HOVER's groundwork slice made the
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
  // .cs:466-467, pinned two tests above - and the container switch's
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
  // .cs:537-548 - exactly one item names the pile, with its stack count.
  const ruby = { name: 'Ruby', templateIndex: -1 };
  assert.equal(lootPileName([]), LOOT_PILE_TEXT);
  assert.equal(lootPileName(null), LOOT_PILE_TEXT);
  assert.equal(lootPileName([ruby, { name: 'Helm', templateIndex: -1 }]), LOOT_PILE_TEXT, 'two is a pile');
  assert.match(lootPileName([ruby]), /Ruby/);
  assert.match(lootPileName([{ ...ruby, stackCount: 4 }]), /\(4\)$/, 'the stack count, in parentheses');
  assert.doesNotMatch(lootPileName([{ ...ruby, stackCount: 1 }]), /\(1\)$/, 'a stack of one is not a count');
  // .cs:525
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
  // .cs:634-643 - the mod joins the two with `\r`; the port carries the
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
  // .cs:775-781 - a dungeon exit names its TOWN, or the region when
  // there is no town, because you step out into open country.
  assert.deepEqual(staticDoorName('dungeonExit', { locationName: 'Daggerfall', regionName: 'Daggerfall', inTown: true }),
    { title: 'To\nDaggerfall' });
  assert.deepEqual(staticDoorName('dungeonExit', { locationName: 'Privateer\'s Hold', regionName: 'Tigonus', inTown: false }),
    { title: 'To\nTigonus Region' });
  // .cs:724-731 - Town23 is the city wall, which has no name of its own.
  assert.deepEqual(staticDoorName('building', { buildingType: BUILDING_TYPES.Town23, locationName: 'Daggerfall', unlocked: true }),
    { title: 'To\nDaggerfall City Walls', subs: [] });
  // .cs:733-736 - the lock level, only when locked, off the port's own
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
  // (.cs:725, :764, :777) - off a record the PORT mints, which spells
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
  assert.equal((wm.match(/currentLocationName\(\)/g) ?? []).length, 3,
    'the three above-ground arms that take it - the building exit, the city wall and (AUDIT-WH M7) the dungeon entrance');
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
  // .cs:493-505 - archive 211 record 54, before the resolver runs.
  assert.equal(questResourceName(null, { archive: 211, record: 54 }), TOTEM_TEXT);
  assert.equal(questResourceName({ name: 'Ruby', templateIndex: -1 }, { archive: 211, record: 54 }), TOTEM_TEXT,
    'the billboard wins over the item');
  assert.match(questResourceName({ name: 'Ruby', templateIndex: -1 }, { archive: 211, record: 0 }), /Ruby/);
  assert.equal(questResourceName(null, { archive: 211, record: 0 }), null, 'no item, no word');
});

test('WORLD TOOLTIPS: the naming ladder is insertion order, first answer with a title wins', async () => {
  const { composeNamer } = await import('../src/systems/worldHover.js');
  // The mod's extension API (vendor .cs:225-257): a Map keyed by reach,
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
    for (let i = 0; i < 3; i++) {
      assert.doesNotThrow(() => worldHoverFrame({
        eye: [0, 0, 0], dir: [0, 0, 1], collider, targets, name: exploding, contents: () => [],
      }), 'the host frame survives');
    }
    assert.equal(worldHoverFaults(), 3, 'and every contained frame is COUNTED');
    // a readout that cannot answer shows NOTHING - it does not freeze
    // on its last answer, which would be a plaque naming a thing it can
    // no longer resolve.
    assert.equal(root()?.classList.contains('on') ?? false, false);
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
  const lens = {
    isCorpse: (e) => !!e.corpse && !!e.entity,
    idOf: (e) => e.id,
    feetOf: (e) => e.feet,
  };
  const rat = { id: 7, corpse: true, feet: [0, 0, 2], entity: { items: [{ shortName: 'Long Bow', templateIndex: 130 }] } };
  const bare = { id: 9, corpse: true, feet: [0, 0, 3], entity: { items: [] } };
  const shut = { id: 11, corpse: true, corpseDisabled: true, feet: [0, 0, 4], entity: { items: [{ shortName: 'Gold', templateIndex: 530 }] } };
  const pool = [rat, bare, shut];
  const keys = corpseLootTargets(pool, 'foeCorpse', lens).map((t) => t.key);
  assert.deepEqual(keys, ['foeCorpse:7', 'foeCorpse:9'], 'a disabled body is not a target at all');
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

test('AUDIT-WH H3: both pools and both above-ground hosts are wired to that ladder', () => {
  // A family's TARGETS, its WORD and its CONTENTS are one thing in
  // three parts, and all three walk the pool's list under the same
  // identity. The bag used to be written out at each of them; HARD2's
  // law - four copies of a law is four chances to omit a term - is why
  // it is one `corpseLens` per pool now, read three times.
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const src = read(f);
    assert.match(src, /const corpseLens = \{/, `${f}: one identity, not three`);
    assert.equal((src.match(/corpseLens\b/g) ?? []).length, 4,
      `${f}: declared once, read by the targets, the namer and the contents`);
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
    assert.match(src, /\(key\) => \(key\.startsWith\('droppedLoot:'\) \? \(droppedLoot\.contents\?\.\(key\) \?\? null\) : null\),\s*\n\s*\(key\) => exteriorFoes\.hoverContents\?\.\(key\) \?\? null,\s*\n\s*\(key\) => cityGuards\.hoverContents\?\.\(key\) \?\? null,/,
      `${f}: the piles, the encounter pool, the watch`);
  }
});

test('AUDIT-WH H2: the mod\'s MOBILE BAND - a townsperson and a live foe, named and raced', async () => {
  const { mobilePersonName, mobileEntityName } = await import('../src/systems/worldTooltips.js');
  const { liveFoeTargets, liveFoeFor, foeAabb, MOBILE_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE } = await import('../src/player/activate.js');
  const { raceWinner } = await import('../src/player/activationRace.js');
  const { resolveHover } = await import('../src/systems/worldHover.js');

  // .cs:299-302 - a walking townsperson is MobilePersonNPC.NameNPC.
  assert.equal(mobilePersonName('Brisienna Magnessen'), 'Brisienna Magnessen');
  assert.equal(mobilePersonName(''), null, 'a nameless one draws nothing, not an empty plaque');
  assert.equal(mobilePersonName(undefined), null);
  // .cs:304-313 - a live entity is Entity.Name, and ONLY when its
  // motor is not hostile. The mod will not label the thing trying to
  // kill you, and an unnamed key draws NOTHING.
  assert.equal(mobileEntityName('Knight', { hostile: false }), 'Knight');
  assert.equal(mobileEntityName('Rat', { hostile: true }), null, 'a hostile one says nothing');
  // `!enemyMotor || !enemyMotor.IsHostile` - no motor at all IS named,
  // which in the port is a stub standing without an `ai`.
  assert.equal(mobileEntityName('Knight'), 'Knight', 'no motor, still named');
  assert.equal(mobileEntityName('', { hostile: false }), null);

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
    assert.match(src, /if \(frameHeld\(\)\) \{ hideWorldPlaque\(\);/, `${f}: the held frame takes it down`);
    // L4: ...and the host's ONE unwind point destroys it. `world.js`
    // imported the door and never called it; `exterior.js` had no
    // teardown at all.
    assert.match(src, /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/,
      `${f}: the plaque dies with the loop that raised it`);
  }

  // L6: EVERY ALLOCATION HAS AN OWNER. The door cache holds the
  // outgoing city's rows, each off a live dfBlock, and it is
  // exterior-only by construction - so leaving the street frees it, at
  // the one write of `mode` rather than at the four sites that write it.
  assert.match(wm, /const dropDoorCache = \(\) => \{ _doorCache = null; \};/);
  // Before the flip in both arms, because the statements after it are
  // each pinned to sit next to their neighbour (the lock release, the
  // context's goLive adoption) and a law wedged between two of those
  // is a law somebody moves.
  assert.match(wm, /dropDoorCache\(\);[^\n]*\n\s+mode = 'interior';/);
  assert.match(wm, /dropDoorCache\(\);[^\n]*\n\s+ctx\.goLive\?\.\(\);[\s\S]{0,400}?\n\s+mode = 'dungeon';/);
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

  // M2. The switch is NOT symmetric (.cs:421-438):
  //   74037 -> "Wheel",         multiTriggerOkay = true
  //   61027/61028 -> "Lever",   multiTriggerOkay = true
  //   74143 -> "The Mantella",  <no flag>
  // so a MULTITRIGGER Mantella falls to .cs:458-461 and is silenced
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

test('AUDIT-WH M5/M6/M7/M10: every family the press acts on has a word, and the ladder order is the mod\'s', () => {
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
  // ...each beside the module that STANDS it, never written out at the host.
  assert.match(read('src/player/eotbWagon.js'), /export const wagonHoverName = /);
  assert.match(read('src/systems/survival/items.js'), /export const waterSourceHoverName = /);

  // M7. GetStaticDoorText routes on `door.doorType` BEFORE it touches
  // the building (.cs:767-771). The port routed only the building arm,
  // so `staticDoorName('dungeonEntrance')` was written, pinned, and had
  // no caller in the tree: "To Privateer's Hold" never drew once.
  assert.match(read('src/scenes/worldModes.js'),
    /if \(entry\?\.door\?\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\) \{\n\s+return staticDoorName\('dungeonEntrance', \{ locationName: currentLocationName\(\) \}\);/);

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
