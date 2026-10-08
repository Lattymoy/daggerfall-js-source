// SENSE1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "a way to detect interactables").
//
// THE LOOK ROUND. Asking for Info mode underground lights, for a few seconds, what is within reach and in plain sight
// that the hover plaque would name - the press's own list through the plaque's own ladder (systems/dungeonSense.js,
// read by scenes/dungeonContext.js at the ask). The secrets tier adds the walls and doors only a chain moves. And the
// plaque itself stops calling those walls "Door": a special door is no DaggerfallActionDoor, and the mod asks the
// action band first (systems/worldTooltips.js actionObjectName).
// bible/03-World/Delve-Arc.md, SENSE1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SENSE_M, SENSE_HOLD_S, SENSE_FADE_S, SENSE_MAX, SENSE_PREF, SENSE_CSS, SENSE_RGB, SENSE_CARD_MIN, SENSE_CARD_W_MAX,
  SENSE_CARD_H_MAX, SENSE_FORM, senseTier, senseKind, boxDistance, senseCard, inPlainSight, senseFinds, isSecretMover,
  senseSecrets, createSensePulse, senseRound, senseMarks, senseFlat, playerTriggers,
} from '../src/systems/dungeonSense.js';
import { PICK_PARDON_M } from '../src/player/activate.js';
import { actionObjectName, actionName } from '../src/systems/worldTooltips.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { nodeGlows, createNodeGlowState, createNodeGlowPass, NODE_GLOW_MAX, NODE_GLOW_FORM, NODE_GLOW_FS } from '../src/render/nodeGlow.js';
import { nodeMarkRgb, NODE_MARK_CSS } from '../src/ui/nodeMarks.js';
import { askInteractionMode, interactionModeAsks, getInteractionMode } from '../src/player/interactionMode.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const box = (min, max) => ({ min, max });
/** A collider with nothing in it: every line is clear. */
const OPEN = { raycastHit: () => ({ dist: Infinity, key: null }) };
/** A collider with one wall: the plane x = `x`, hit by any ray that crosses it, in bucket `key`. */
const wallAt = (x, key = 'dungeon') => ({
  raycastHit(o, d, max, filter) {
    if (filter?.skip?.includes(key)) return { dist: Infinity, key: null };
    if (Math.abs(d[0]) < 1e-9) return { dist: Infinity, key: null };
    const t = (x - o[0]) / d[0];
    return t > 0 && t <= max ? { dist: t, key } : { dist: Infinity, key: null };
  },
});

test('SENSE1: the constants - eight metres, six seconds with a second and a half of fade, the glow\'s budget', () => {
  assert.equal(SENSE_M, 8);
  assert.equal(SENSE_HOLD_S, 6);
  assert.equal(SENSE_FADE_S, 1.5);
  assert.equal(SENSE_MAX, NODE_GLOW_MAX, 'one pulse lights no more than the glow pass draws');
  assert.equal(SENSE_PREF, 'dungeonSense');
  assert.deepEqual([SENSE_CARD_MIN, SENSE_CARD_W_MAX, SENSE_CARD_H_MAX], [0.5, 2.4, 2.8]);
  assert.deepEqual(Object.keys(SENSE_CSS), ['use', 'door', 'find', 'secret']);
  // each colour its own, and none a profession's
  const all = [...Object.values(SENSE_CSS), ...Object.values(NODE_MARK_CSS)];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(SENSE_RGB.door, [0x9c / 255, 0xc8 / 255, 1]);
});

test('SENSE1: a stored tier - off and secrets are themselves, anything else is On', () => {
  assert.equal(senseTier('off'), 'off');
  assert.equal(senseTier('secrets'), 'secrets');
  assert.equal(senseTier('on'), 'on');
  assert.equal(senseTier(undefined), 'on');
  assert.equal(senseTier(true), 'on');
});

test('SENSE1: a target\'s kind, by its key and the plaque\'s word', () => {
  for (const k of ['loot:0', 'corpse:3', 'search:2', 'droppedLoot:1:4', 'srch:0']) assert.equal(senseKind(k, 'x'), 'find', k);
  assert.equal(senseKind('exit:0', 'Exit'), 'door');
  assert.equal(senseKind('act:1:44', 'Door'), 'door');
  assert.equal(senseKind('door:2', 'Door'), 'door');
  assert.equal(senseKind('act:1:44', 'Lever'), 'use');
  assert.equal(senseKind('door:2', '<Interact>'), 'use', 'a Direct-flagged door says Interact, and is worked');
  assert.equal(senseKind('hearth:0', 'Fire'), 'use');
  assert.equal(senseKind('person:0', 'Someone'), 'use');
});

test('SENSE1: a box\'s distance and its card', () => {
  const b = box([0, 0, 0], [2, 1, 2]);
  assert.equal(boxDistance(b, [1, 0.5, 1]), 0, 'inside');
  assert.equal(boxDistance(b, [5, 0.5, 1]), 3);
  assert.equal(boxDistance(b, [5, 5, 6]), Math.hypot(3, 4, 4));
  assert.deepEqual(senseCard(box([0, 2, 0], [1, 3, 0.2])), { at: [0.5, 2, 0.1], w: 1, h: 1 });
  assert.deepEqual(senseCard(box([0, 0, 0], [0.1, 0.1, 0.1])), { at: [0.05, 0, 0.05], w: SENSE_CARD_MIN, h: SENSE_CARD_MIN }, 'never a speck');
  assert.deepEqual(senseCard(box([0, 0, 0], [12, 9, 3])), { at: [6, 0, 1.5], w: SENSE_CARD_W_MAX, h: SENSE_CARD_H_MAX }, 'never a wall of light');
  assert.equal(senseCard(box([0, 0, 0], [0.6, 1, 1.8])).w, 1.8, 'the wider of the two level sides');
});

test('SENSE1: in plain sight - a clear line, the thing\'s own bucket passed, its own face pardoned unless it has none', () => {
  const eye = [0, 1, 0];
  const b = box([4, 0, -0.5], [5, 2, 0.5]);
  assert.equal(inPlainSight(OPEN, eye, b), true);
  assert.equal(inPlainSight(wallAt(2), eye, b), false, 'a wall between');
  assert.equal(inPlainSight(wallAt(2, 'act:0:1'), eye, b, { skip: 'act:0:1' }), true, 'its own bucket is passed');
  assert.equal(inPlainSight(wallAt(4.2), eye, b), true, 'a face inside the box is the thing\'s own (a shelf in the shared bucket)');
  assert.equal(inPlainSight(wallAt(4.2), eye, b, { noSurface: true }), false, 'a flat has no face: what its box stands against hides it');
  assert.equal(inPlainSight(wallAt(2), [4.5, 1, 0], b), true, 'the eye in the box sees it');
  // the top's line is the second chance: a low wall hides the middle and not the top (AUDIT DELVE C2: the middle ray
  // climbs 1/4.61 = 0.217 and the top's 0.398, so the wall is the one between them - at 0.15 it hid neither)
  const low = { raycastHit: (o, d, max) => (d[1] < 0.3 ? { dist: 2, key: 'dungeon' } : { dist: Infinity, key: null }) };
  assert.equal(inPlainSight(low, [0, 0, 0], box([4, 0, -0.5], [5, 2, 0.5])), true);
  const lowAll = { raycastHit: () => ({ dist: 2, key: 'dungeon' }) };
  assert.equal(inPlainSight(lowAll, [0, 0, 0], box([4, 0, -0.5], [5, 2, 0.5])), false);
  // AUDIT DELVE C5/C8: the pardon is the pick's own (activate.js PICK_PARDON_M) - a face a hair outside the box is its
  // own, a wall a hand outside is a wall
  assert.equal(PICK_PARDON_M, 0.15);
  assert.equal(inPlainSight(wallAt(4 - 0.1), eye, b), true, 'within the pardon');
  assert.equal(inPlainSight(wallAt(4 - 0.3), eye, b), false, 'past it');
});

test('AUDIT DELVE B8/C3: a flat has no face of its own - the producer\'s word, an acting flat, or one of the context\'s billboards by its key', () => {
  assert.equal(senseFlat({ key: 'x', noSurface: true }), true);
  for (const k of ['loot:0', 'corpse:3', 'droppedLoot:1:2']) assert.equal(senseFlat({ key: k }), true, k);
  for (const k of ['search:0', 'act:0:1', 'door:2', 'exit:0', 'hearth:0']) assert.equal(senseFlat({ key: k }), false, k);
  const collider = { addMesh() {}, removeBucket() {} };
  const a = new ActionSystem(collider);
  const mf = a.addMoveFlat(0, 7, { actionFlag: 1, index: 0, magnitude: 1, axisRaw: 0, nextObject: -1, triggerFlag: TRIGGER_FLAGS.None }, [0, 0, 0]);
  assert.equal(senseFlat(null, mf), true, 'the action system\'s own acting flat');
  assert.equal(senseFlat({ key: 'act:0:1' }, { kind: 'action' }), false);
});

test('SENSE1: what one pulse finds - in reach, named, seen, once each, nearest first, within the budget', () => {
  const eye = [0, 1, 0];
  const t = (key, x, extra = {}) => ({ key, aabb: box([x, 0, -0.5], [x + 1, 2, 0.5]), ...extra });
  const names = { 'act:0:1': 'Lever', 'loot:0': 'Gold', 'door:0': 'Door', 'act:0:2': null, 'search:0': 'Chest', 'exit:0': 'Exit' };
  const targets = [t('loot:0', 5), t('act:0:1', 2), t('door:0', 9), t('act:0:2', 1), t('search:0', 7.5), t('act:0:1', 2), t('exit:0', 3)];
  const hidden = new Set(['exit:0']);
  const finds = senseFinds(targets, eye, { nameOf: (k) => names[k] ?? null, sees: (x) => !hidden.has(x.key) });
  assert.deepEqual(finds.map((f) => [f.key, f.kind, f.d]), [['act:0:1', 'use', 2], ['loot:0', 'find', 5], ['search:0', 'find', 7.5]]);
  assert.deepEqual(finds[0].at, [2.5, 0, 0]);
  // the door at 9 is past the reach; at 8 exactly it is in
  assert.equal(senseFinds([t('door:0', 8)], eye, { nameOf: () => 'Door' }).length, 1);
  assert.equal(senseFinds([t('door:0', 8.01)], eye, { nameOf: () => 'Door' }).length, 0);
  // AUDIT DELVE C5: and the secrets' reach is the same edge
  const sec = (x) => ({ key: 's', kind: 'action', triggerFlag: TRIGGER_FLAGS.None, state: 'start', x });
  const sbox = (o) => box([o.x, 0, -0.5], [o.x + 1, 2, 0.5]);
  assert.equal(senseSecrets([sec(8)], new Set(['s']), eye, { boxOf: sbox }).length, 1, 'a secret at 8 m');
  assert.equal(senseSecrets([sec(8.01)], new Set(['s']), eye, { boxOf: sbox }).length, 0, 'not at 8.01');
  const manyS = Array.from({ length: 30 }, (_, i) => ({ ...sec(i * 0.2), key: `s${i}` }));
  assert.equal(senseSecrets(manyS, new Set(manyS.map((o) => o.key)), eye, { boxOf: sbox }).length, SENSE_MAX, 'the secrets\' budget');
  // the budget
  const many = Array.from({ length: 30 }, (_, i) => t(`loot:${i}`, (30 - i) * 0.2));
  const capped = senseFinds(many, eye, { nameOf: () => 'Gold' });
  assert.equal(capped.length, SENSE_MAX);
  assert.equal(capped[0].key, 'loot:29', 'the nearest kept');
  // nothing to read, nothing found
  assert.deepEqual(senseFinds(null, eye, { nameOf: () => 'x' }), []);
  assert.deepEqual(senseFinds(targets, null, { nameOf: () => 'x' }), []);
});

test('SENSE1: a secret - a mover only a chain reaches, with no trigger of its own, at rest where it began', () => {
  const chain = new Set(['act:0:9', 'act:0:8', 'act:0:7', 'act:0:6']);
  const o = (key, extra) => ({ key, kind: 'action', triggerFlag: TRIGGER_FLAGS.None, state: 'start', ...extra });
  assert.equal(isSecretMover(o('act:0:9'), chain), true);
  assert.equal(isSecretMover(o('act:0:8', { kind: 'door', special: true }), chain), true, 'a special door - the wall that swings');
  assert.equal(isSecretMover(o('act:0:7', { kind: 'moveFlat' }), chain), true);
  assert.equal(isSecretMover(o('act:0:9', { kind: 'door' }), chain), false, 'an action door is a door, not a secret');
  assert.equal(isSecretMover(o('act:0:9', { kind: 'relay' }), chain), false);
  assert.equal(isSecretMover(o('act:0:9', { triggerFlag: TRIGGER_FLAGS.Direct }), chain), false, 'a lever is no secret');
  assert.equal(isSecretMover(o('act:0:9', { state: 'end' }), chain), false, 'a wall already slid open');
  assert.equal(isSecretMover(o('act:0:5'), chain), false, 'nothing reaches it');
  // AUDIT DELVE A5: read off TRIGGER_GATE - a Door flag is the player's only on an action door, which sends it itself
  assert.equal(isSecretMover(o('act:0:9', { triggerFlag: TRIGGER_FLAGS.Door }), chain), true, 'a mover with the Door flag: nothing of the player\'s reaches it');
  assert.equal(isSecretMover(o('act:0:8', { kind: 'door', special: true, triggerFlag: TRIGGER_FLAGS.Door }), chain), true);
  for (const f of [TRIGGER_FLAGS.Collision01, TRIGGER_FLAGS.Collision03, TRIGGER_FLAGS.Attack, TRIGGER_FLAGS.MultiTrigger, TRIGGER_FLAGS.Collision09, TRIGGER_FLAGS.Direct6]) {
    assert.equal(isSecretMover(o('act:0:9', { triggerFlag: f }), chain), false, `flag ${f}: the player reaches it`);
  }
  assert.equal(playerTriggers({ kind: 'door', triggerFlag: TRIGGER_FLAGS.Door }), true, 'an action door is pressed');
  assert.equal(playerTriggers({ kind: 'door', special: true, triggerFlag: TRIGGER_FLAGS.Door }), false);
  const objs = [o('act:0:9'), o('act:0:8', { kind: 'door', special: true }), o('act:0:6')];
  const boxes = { 'act:0:9': box([3, 0, 0], [4, 2, 1]), 'act:0:8': box([1, 0, 0], [2, 2, 1]), 'act:0:6': box([30, 0, 0], [31, 2, 1]) };
  const found = senseSecrets(objs, chain, [0, 1, 0.5], { boxOf: (x) => boxes[x.key] });
  assert.deepEqual(found.map((f) => [f.key, f.kind]), [['act:0:8', 'secret'], ['act:0:9', 'secret']]);
  assert.deepEqual(senseSecrets(objs, chain, [0, 1, 0.5], { boxOf: (x) => boxes[x.key], sees: (x) => x.key !== 'act:0:8' }).map((f) => f.key), ['act:0:9']);
});

test('SENSE1: the pulse - lit for the hold, fading over its last second and a half, out after; pooled', () => {
  const p = createSensePulse();
  assert.equal(p.lit(0), false);
  assert.deepEqual(p.marks(0), []);
  const finds = [{ key: 'act:0:1', kind: 'use', d: 2, at: [1, 0, 0], w: 1, h: 1 }, { key: 'loot:0', kind: 'find', d: 3, at: [2, 0, 0], w: 1, h: 1 }];
  assert.equal(p.pulse(10, finds), 2);
  assert.equal(p.lit(10), true);
  const m = p.marks(10);
  assert.deepEqual(m.map((x) => [x.key, x.rgb, x.gain, x.form]), [['sense:act:0:1', SENSE_RGB.use, 1, SENSE_FORM.use], ['sense:loot:0', SENSE_RGB.find, 1, SENSE_FORM.find]]);
  assert.equal(p.marks(10 + SENSE_HOLD_S - SENSE_FADE_S)[0].gain, 1, 'full until the fade begins');
  assert.ok(Math.abs(p.marks(10 + SENSE_HOLD_S - SENSE_FADE_S / 2)[0].gain - 0.5) < 1e-9, 'half way through the fade');
  const again = p.marks(11);
  assert.equal(again, m, 'one list, refilled');
  assert.equal(again[0], m[0], 'one record a find, reused');
  assert.equal(p.lit(10 + SENSE_HOLD_S), false);
  assert.deepEqual(p.marks(10 + SENSE_HOLD_S), [], 'out after the hold');
  assert.equal(p.lit(9), false, 'nothing before the pulse');
  p.pulse(20, finds); p.clear();
  assert.equal(p.lit(20), false);
  assert.equal(p.pulse(30, []), 0);
  assert.equal(p.lit(30), false, 'a pulse that found nothing lights nothing');
});

test('AUDIT DELVE C5/B9/D5: one round - finds and secrets merged, a key once, nearest first, within the budget; the frame\'s marks put the echo\'s found first, a key once', () => {
  const f = (key, d, kind = 'use') => ({ key, kind, d, at: [d, 0, 0], w: 1, h: 1 });
  const r = senseRound([f('a', 3), f('b', 1)], [f('s', 2, 'secret'), f('a', 0.5, 'secret')]);
  assert.deepEqual(r.map((x) => [x.key, x.d]), [['a', 0.5], ['b', 1], ['s', 2]], 'the nearest of a key kept, once');
  const ordinary = Array.from({ length: 16 }, (_, i) => f(`o${i}`, 1 + i * 0.1));
  const capped = senseRound(ordinary, [f('s', 0.5, 'secret')]);
  assert.equal(capped.length, SENSE_MAX);
  assert.equal(capped[0].key, 's', 'a near secret is not crowded out by sixteen ordinary finds');
  assert.equal(senseRound(null, null).length, 0);
  const out = [];
  const sense = Array.from({ length: 16 }, (_, i) => ({ key: `sense:o${i}` }));
  senseMarks([{ key: 'sense:wall' }, { key: 'sense:o3' }], sense, out);
  assert.equal(out.length, SENSE_MAX);
  assert.deepEqual(out.slice(0, 2).map((x) => x.key), ['sense:wall', 'sense:o3'], 'the echo\'s found first');
  assert.equal(out.filter((x) => x.key === 'sense:o3').length, 1, 'one card a key: never kindled twice a frame');
  assert.equal(senseMarks(null, null, out).length, 0);
});

test('AUDIT DELVE D6: each kind its own form - the halo, the shimmer, the motes - not only its colour; a node\'s is whole', () => {
  const forms = Object.values(SENSE_FORM).map((x) => x.join(','));
  assert.equal(new Set(forms).size, 4, 'four forms');
  assert.deepEqual(Object.keys(SENSE_FORM), Object.keys(SENSE_CSS));
  assert.deepEqual(NODE_GLOW_FORM, [1, 1, 1]);
  assert.equal(SENSE_FORM.door[1] + SENSE_FORM.door[2], 0, 'a way through: a steady halo alone');
  assert.ok(SENSE_FORM.find[2] > SENSE_FORM.find[0], 'a find: glints');
  assert.ok(SENSE_FORM.secret[1] > SENSE_FORM.secret[0], 'a secret: the shimmer, no body of light');
  const st = createNodeGlowState(), out = [];
  const two = [{ key: 'n', profession: 'mining', at: [0, 0, 1], w: 1, h: 1 }, { key: 'sense:x', at: [0, 0, 2], w: 1, h: 1, rgb: SENSE_RGB.door, form: SENSE_FORM.door }];
  for (const t of [0, 0.25, 0.5, 0.75]) nodeGlows(two, [0, 0, 0], t, st, out);   // kindled
  assert.equal(out[0].form, NODE_GLOW_FORM);
  assert.equal(out[1].form, SENSE_FORM.door);
  assert.match(NODE_GLOW_FS, /float light = uForm\.x \* [\d.]+ \* halo \+ uForm\.y \* [\d.]+ \* band \+ uForm\.z \* [\d.]+ \* motes;/);
});

test('SENSE1: the glow takes a mark\'s own colour and gain; a node is lit as it always was', () => {
  const st = createNodeGlowState(), out = [];
  const marks = [{ key: 'n', profession: 'mining', at: [0, 0, 1], w: 1, h: 1 }, { key: 'sense:x', at: [0, 0, 2], w: 1, h: 1, rgb: SENSE_RGB.secret, gain: 0.5 }];
  for (const t of [0, 0.25, 0.5, 0.75]) nodeGlows(marks, [0, 0, 0], t, st, out);   // kindled (0.6 s, a quarter second a frame at most)
  assert.equal(out.length, 2);
  assert.equal(out[0].rgb, nodeMarkRgb('mining'));
  assert.equal(out[0].alpha, 1);
  assert.equal(out[1].rgb, SENSE_RGB.secret);
  assert.equal(out[1].alpha, 0.5);
  nodeGlows([{ key: 'sense:x', at: [0, 0, 2], w: 1, h: 1, gain: 0 }], [0, 0, 0], 1, st, out);
  assert.equal(out.length, 0, 'a gain of nothing lights nothing');
});

test('SENSE1: the pass is freed at its end, and an idle build that comes after builds nothing', () => {
  let idleFn = null, built = 0, freed = 0;
  const renderer = { gl: {}, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: new Float32Array(3), markForeignPass() {} };
  const pass = createNodeGlowPass(renderer, { now: () => 0, idle: (fn) => { idleFn = fn; }, build: () => { built++; return { draw() {}, drawn: 0, dispose() { freed++; } }; }, reduced: () => false });
  pass.draw([{ key: 'a', at: [0, 0, 1], w: 1, h: 1, rgb: SENSE_RGB.use }]);
  assert.ok(idleFn, 'the compile waits for idle');
  pass.dispose();
  idleFn();
  assert.equal(built, 0, 'the end came first: nothing built');
  const pass2 = createNodeGlowPass(renderer, { now: () => 0, idle: (fn) => fn(), build: () => { built++; return { draw() {}, drawn: 0, dispose() { freed++; } }; }, reduced: () => false });
  pass2.draw([{ key: 'a', at: [0, 0, 1], w: 1, h: 1, rgb: SENSE_RGB.use }]);
  assert.equal(built, 1);
  pass2.dispose();
  assert.equal(freed, 1);
  pass2.draw([{ key: 'a', at: [0, 0, 1], w: 1, h: 1, rgb: SENSE_RGB.use }]);
  assert.equal(built, 1, 'never built again');
});

test('SENSE1: the plaque\'s word for an action object - the action band first, and a special door is no DaggerfallActionDoor', () => {
  const lever = { kind: 'action', triggerFlag: TRIGGER_FLAGS.Direct, modelIdNum: 61027 };
  assert.deepEqual(actionObjectName(lever), { title: 'Lever' });
  assert.deepEqual(actionObjectName({ kind: 'door', triggerFlag: TRIGGER_FLAGS.None, currentLockValue: 0 }), { title: 'Door' });
  assert.deepEqual(actionObjectName({ kind: 'door', triggerFlag: TRIGGER_FLAGS.Door, currentLockValue: 7 }), { title: 'Door', subs: ['Lock Level: 7'] });
  // THE SECRET WALL: a special door with no trigger of its own says nothing - it said "Door"
  assert.equal(actionObjectName({ kind: 'door', special: true, triggerFlag: TRIGGER_FLAGS.None, currentLockValue: 0 }), null);
  // ...and a Direct-flagged one is the action band's (Interact), as any Direct object is
  assert.deepEqual(actionObjectName({ kind: 'door', special: true, triggerFlag: TRIGGER_FLAGS.Direct, currentLockValue: 0 }), { title: '<Interact>' });
  // an action door whose own record is Direct: the action band runs first (.cs:397) and the door band is guarded on an empty ret
  assert.deepEqual(actionObjectName({ kind: 'door', triggerFlag: TRIGGER_FLAGS.Direct, currentLockValue: 0 }), { title: '<Interact>' });
  assert.deepEqual(actionObjectName({ kind: 'door', triggerFlag: TRIGGER_FLAGS.Direct, currentLockValue: 0 }, { hideInteract: true }), { title: 'Door' }, 'hidden, the door band answers');
  // the MultiTrigger rule falls through to the door band on a door, and to silence elsewhere
  assert.deepEqual(actionObjectName({ kind: 'door', triggerFlag: TRIGGER_FLAGS.MultiTrigger, modelIdNum: 1, currentLockValue: 0 }), { title: 'Door' });
  assert.equal(actionObjectName({ kind: 'action', triggerFlag: TRIGGER_FLAGS.MultiTrigger, modelIdNum: 1 }), null);
  assert.equal(actionObjectName({ kind: 'action', triggerFlag: TRIGGER_FLAGS.None, modelIdNum: 61027 }), null);
  assert.equal(actionObjectName(null), null);
  // it is actionName's own band, not a second copy
  assert.equal(actionObjectName({ kind: 'relay', triggerFlag: TRIGGER_FLAGS.Direct6, modelIdNum: 74143 }).title, actionName(TRIGGER_FLAGS.Direct6, 74143));
});

test('SENSE1: both hosts name an action object through the one function', () => {
  // the interior's namer answers the word; the dungeon's takes it and may add ECHO1's examine under it
  assert.match(src('src/scenes/worldModes.js'), /return actionObjectName\(o, \{ hideInteract: hide \}\);/);
  assert.match(src('src/scenes/dungeonContext.js'), /const named = actionObjectName\(o, \{ hideInteract: hide \}\);/);
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.doesNotMatch(src(f), /if \(o\.kind === 'door'\) return actionDoorName|actionDoorName\(\(o\.currentLockValue/, `${f} keeps no door band of its own`);
  }
});

test('SENSE1: the chain graph\'s targets - every object another\'s chain reaches, never itself', () => {
  const collider = { addMesh() {}, removeBucket() {} };
  const a = new ActionSystem(collider);
  const cpu = { positions: new Float32Array(9), indices: new Uint16Array([0, 1, 2]) };
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  a.addAction(0, 1, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: 2, triggerFlag: TRIGGER_FLAGS.Direct });
  a.addAction(0, 2, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: -1, triggerFlag: TRIGGER_FLAGS.None });
  a.addAction(0, 3, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: 3, triggerFlag: TRIGGER_FLAGS.None });
  a.addAction(1, 1, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: 9, triggerFlag: TRIGGER_FLAGS.Direct });
  assert.deepEqual([...a.chainTargets()], ['act:0:2'], 'the second block\'s link reaches nothing; a self link is no chain');
  assert.equal(isSecretMover(a.objects.get('act:0:2'), a.chainTargets()), true, 'the wall the lever moves');
  assert.equal(isSecretMover(a.objects.get('act:0:1'), a.chainTargets()), false);
  // AUDIT DELVE C7: the special door as the action system mints it (addSpecialDoor - its moveState, its record's flags)
  const b = new ActionSystem(collider);
  b.addAction(0, 1, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: 2, triggerFlag: TRIGGER_FLAGS.Direct });
  const wall = b.addSpecialDoor(0, 2, cpu, I, { index: 0, duration: 20, rotation: { x: 0, y: 90, z: 0 }, translation: { x: 0, y: 0, z: 0 }, nextObject: -1, triggerFlag: TRIGGER_FLAGS.None });
  assert.equal(wall.special, true);
  assert.equal(wall.moveState, 'start', 'the producer\'s own field');
  assert.equal(isSecretMover(wall, b.chainTargets()), true, 'the wall that swings, as minted');
  assert.equal(actionObjectName(wall), null, 'and the plaque says nothing of it');
  wall.state = 'end';
  assert.equal(isSecretMover(wall, b.chainTargets()), false, 'swung open: no longer a secret');
});

test('SENSE1: the asks are counted where the press is read, changed or not', () => {
  const before = interactionModeAsks('info');
  assert.equal(askInteractionMode('info'), true);
  assert.equal(askInteractionMode('info'), true);
  assert.equal(interactionModeAsks('info'), before + 2);
  assert.equal(askInteractionMode('nonsense'), false);
  assert.equal(interactionModeAsks('nonsense'), 0);
  assert.equal(getInteractionMode(), 'grab', 'an ask changes no mode');
  // townTalk counts BEFORE its same-mode no-op; the standalone dungeon host counts under its own overlay gate
  const tt = src('src/scenes/townTalk.js');
  assert.match(tt, /function setMode\(m, ask = true\) \{\n    if \(ask\) askInteractionMode\(m\);[^\n]*\n    if \(m === getInteractionMode\(\)\) return;/);
  // AUDIT DELVE B6: the press, not the key's repeat (a held F3 asked thirty times a second, each a look round)
  assert.match(tt, /setMode\(m, !e\.repeat\);/);
  assert.match(src('src/scenes/dungeon.js'), /if \(!ctx\.uiOverlayActive && !e\.repeat\) askInteractionMode\(im\);/);
});

test('SENSE1: the context looks round at an ask and draws after the last opaque flat; the glow ends with it', () => {
  const s = src('src/scenes/dungeonContext.js');
  assert.match(s, /opts\.lateWorldDraw\?\.\(\);\n    senseFrame\(eye\);/);
  assert.match(s, /if \(asks !== _infoAsks\) \{ _infoAsks = asks; senseLookRound\(eye, t\); \}/);
  assert.match(s, /if \(!isEnhanced\(\) \|\| tier === 'off' \|\| !eye\) return 0;/);
  assert.match(s, /senseFinds\(api\.dungeonActivationTargets\(\), eye, \{ nameOf, sees \}\)/, 'the press\'s own list');
  assert.match(s, /actionObjectName\(actions\.objects\.get\(key\) \?\? null, \{ hideInteract: hide \}\)/, 'the author\'s hide kept');
  assert.match(s, /const secrets = tier === 'secrets' \? senseSecrets\(actions\.objects\.values\(\), actions\.chainTargets\(\), eye, \{ boxOf: objectAabb, sees: \(o, box\) => inPlainSight\(collider, eye, box, \{ skip: o\.key, noSurface: senseFlat\(null, o\) \}\) \}\) : \[\];/);
  assert.match(s, /return sensePulse\.pulse\(t, senseRound\(finds, secrets\)\);/, 'C5: the one round');
  assert.match(s, /noSurface: senseFlat\(tg, actions\.objects\.get\(tg\.key\)\) \}\);/, 'B8: the flats');
  // B5: a namer that throws costs the look round, never the frame
  const lr = s.slice(s.indexOf('function senseLookRound(eye, t) {'), s.indexOf('function senseFrame(eye) {'));
  assert.match(lr, /try \{[\s\S]*\} catch \(e\) \{\n\s+if \(!_senseWarned\) \{ _senseWarned = true; console\.warn\('\[sense\] the look round failed'/);
  assert.match(s, /senseMarks\(b \? echoPulse\.marks\(t\) : null, a \? sensePulse\.marks\(t\) : null, _senseMarks\);/, 'B9/D5: the echo first, a key once');
  assert.match(s, /senseGlow\.dispose\(\); sensePulse\.clear\(\);/);
});

test('AUDIT DELVE B5: a namer that throws - the look round answers nothing and the frame goes on', async () => {
  // the host's guard, by its shape: everything the round reads is inside the try
  const s = src('src/scenes/dungeonContext.js');
  const lr = s.slice(s.indexOf('function senseLookRound(eye, t) {'), s.indexOf('function senseFrame(eye) {'));
  const tryAt = lr.indexOf('try {');
  for (const read of ['hideInteractTooltip()', '_namer(key, null)', 'api.dungeonActivationTargets()', 'actions.chainTargets()']) assert.ok(lr.indexOf(read) > tryAt, `${read} inside the guard`);
});

test('SENSE1: the Features row - Enhanced, three tiers, On by default and the player\'s own online', () => {
  const f = FEATURES.find((x) => x.id === 'dungeon-sense');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.equal(f.control.store, 'prefs');
  assert.equal(f.control.key, SENSE_PREF);
  assert.deepEqual(f.control.tiers.map(([v]) => v), ['off', 'on', 'secrets']);
  assert.equal(f.control.initial, 'on');
  assert.equal(f.control.online, 'player');
  assert.equal(FEATURE_PREF_DEFAULTS.dungeonSense, 'on');
});
