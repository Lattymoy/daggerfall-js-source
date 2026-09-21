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
  showWorldPlaque, destroyWorldPlaque, plaqueAnchor, worldPlaqueOn, worldHoverFrame,
  PLAQUE_GAP, _plaqueSignatureForTests,
} from '../src/ui/worldPlaque.js';
import { CROSSHAIR_ARM, crosshairCentreY } from '../src/ui/hudCrosshair.js';
import { hudScale } from '../src/ui/hud.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

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
  resolveHover(hit('loot:2'), { contents });
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
  const e = resolveHover(hit('corpse:1'), { contents: () => [] });
  assert.equal(e.empty, true);
  assert.equal(e.title, 'Loot', 'a namer that says nothing leaves the itemised default standing');
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
  const of = (items) => frameSignature(resolveHover(hit('loot:1'), { contents: () => items }));
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
    const f = (items) => resolveHover(hit('loot:1'), { contents: () => items });
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
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => many }));
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
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => [{ name: 'Ruby' }] }));
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
    showWorldPlaque(resolveHover(hit('loot:1'), { contents: () => [{ name: 'Ruby' }] }));
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
      contents: () => [{ name: 'Ruby' }] });
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
    const deps = { contents: () => [{ name: 'Ruby' }] };
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
    const deps = { contents: () => [{ name: 'Ruby' }] };
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
  assert.match(ctx, /targets: api\.dungeonActivationTargets,/,
    'the plaque races the same list the press does');
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
  // does not list.
  assert.equal(houseContainerName(41999), INTERACT_TEXT);
  assert.equal(houseContainerName(41999, { hideInteract: true }), null);
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
  assert.equal(corpseName(''), 'Body (dead)', 'something nameless is still a body');
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
