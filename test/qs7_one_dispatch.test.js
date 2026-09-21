// ---------------------------------------------------------------------------
// QS7 - ONE MODE, ONE DISPATCH (2026-09-17, Mac: "if you go into a tavern
// with a lit torch, pressing 4 does not actually make it go out, it just
// goes thru the 'douse' and 'ignite' motions").
//
// TWO LADDERS ANSWERED ONE KEY. The world and exterior hosts each run a
// keydown ladder, and each MOUNTS worldModes over itself - which runs a
// keydown ladder of its own (U43's one dispatch, `routeKey` over
// `interiorKeyCtx` indoors and `dungeonCtx` underground). Both listen on
// the same window and neither stops the other's propagation, so a key
// BOTH can answer is answered twice.
//
// QS2 put the quickslot arm ABOVE the outer hosts' mode gate on purpose:
// at the time the modal contexts carried no quickslot doors at all, and a
// quickslot that died at a shop door was the bug AUDIT SOC B4/D1 had just
// found for F. QS4 then gave `interiorKeyCtx` and `dungeonCtx` the whole
// set - and nothing went back to the arm that had been standing in for
// them. From that commit a Digit4 in a tavern pressed the mod's
// `toggleLightPress` TWICE.
//
// Twice is not nothing, and it is not two: the mod's toggle is a FLIP.
// The first press douses the torch, the second re-ignites it, both clips
// play, both lines are said, and the player is left holding a lit torch
// they just asked to put out. That is WEAPON-VIS2's double-fire exactly
// ("drawn, then sheathed straight back, net nothing, every time"), at a
// third door, and it is why a COUNT rather than a state is what catches
// this class of bug.
//
// The fix is the same as WEAPON-VIS2's: whoever owns the mode owns the
// key. The outer arm takes the exterior-mode gate its siblings take, and
// the quickslots stay live indoors and underground through the modal
// ladder that already routes them.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createHandheldTorches, readTorchSettings, MESSAGES, CLIPS,
  HANDHELD_TORCHES_VENDOR,
} from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { QUICKSLOT_ACTIONS, POLLED_ACTIONS } from '../src/ui/input.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const T = TEMPLATES;
const V = HANDHELD_TORCHES_VENDOR;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const torch = () => ({ group: 'UselessItems2', templateIndex: T.Torch, currentCondition: 50, maxCondition: 50 });

/** The mod, with a lit torch in a free hand - HT1's rig, cut to the one
 *  door two ladders were both pressing. */
function lit() {
  const store = defaults();
  const said = [], shots = [];
  const t = torch();
  const entity = { items: [t], equip: { slots: {} }, lightSource: t, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store),
    audio: { playOneShot: (c) => shots.push(c), loop: () => ({ stop() {} }), play3d: (c) => shots.push(c) },
    say: (l) => said.push(l), rolls: () => 0.5,
    torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }),
    handedness: () => false, loadSprite: async () => null,
  });
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' },
    sheathed: false, usingRightHand: true, castPlaying: false, spellArmed: false, thirdPerson: false,
    climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] },
    look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons() { ctx.sheathed = true; },
  };
  h.update(0.016, ctx); h.lateUpdate(0.016, ctx);
  return { h, entity, said, shots };
}

test('QS7: ONE press of the off hand puts the torch out - and TWO, which is what a tavern was doing, put it straight back', () => {
  // The law, first: one press is one flip.
  const once = lit();
  assert.equal(once.entity.lightSource?.templateIndex, T.Torch, 'the torch starts lit');
  assert.equal(once.h.toggleLightPress(), true, 'the press acted');
  assert.equal(once.entity.lightSource, null, 'and the torch is OUT');
  assert.deepEqual(once.shots, [CLIPS.douse], 'one douse, and no ignite behind it');
  assert.equal(once.said.filter((l) => l.startsWith(MESSAGES.douse)).length, 1);

  // ...and the bug, driven: the second ladder's press re-lights it, which
  // is Mac's "goes thru the 'douse' and 'ignite' motions" exactly.
  const twice = lit();
  twice.h.toggleLightPress();
  twice.h.toggleLightPress();
  assert.equal(twice.entity.lightSource?.templateIndex, T.Torch, 'THE BUG: net nothing - the torch is lit again');
  assert.deepEqual(twice.shots, [CLIPS.douse, CLIPS.ignite], 'both clips played, which is what the player heard');
  assert.equal(twice.said.some((l) => l.startsWith(MESSAGES.douse)), true);
  assert.equal(twice.said.some((l) => l.startsWith(MESSAGES.ignite)), true);
});

test('QS7: the outer hosts decline a quickslot while a modal mode is mounted - the mode that owns the key answers it', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    const arm = s.split('\n').find((l) => l.includes('QUICKSLOT_ACTIONS.has(act)'));
    assert.ok(arm, `${f} no longer carries the quickslot arm`);
    assert.match(arm, /\(modes\?\.mode \?\? 'exterior'\) === 'exterior'/,
      `${f}: the quickslot arm must not answer over a mounted mode - that is the double-fire`);
    // ...and the arm it sits beside must NOT take the gate: the modal
    // contexts carry no socialInteract, so F has no second answer to
    // collide with and AUDIT SOC B4/D1's finding stands.
    // (only the world host carries it: the social arc is the streaming
    // host's, and `?exterior` is a single-location page.)
    const social = s.split('\n').find((l) => l.includes("act === 'SocialInteract'"));
    if (social) {
      assert.ok(!/\(modes\?\.mode \?\? 'exterior'\) === 'exterior'/.test(social),
        `${f}: F must still answer inside - the fix is the quickslots', not every arm's`);
    }
  }
  assert.match(rd('src/scenes/world.js'), /act === 'SocialInteract'/,
    'the world host still carries the social arm this pin guards');
});

test('QS7: and the modal ladders really do carry the doors the outer arm stood in for', () => {
  const wm = rd('src/scenes/worldModes.js');
  // U43's one dispatch, both arms
  assert.match(wm, /if \(mode === 'interior'\) \{\n\s+if \(routeKey\(e, interiorKeyCtx, null, keys\)\) e\.preventDefault\(\);/,
    'the interior mode routes the whole table over its own ctx');
  assert.match(wm, /if \(routeKey\(e, dungeonCtx, \(p\) => player\.spawn/,
    'and the dungeon mode over the dungeon ctx');
  // every action the outer arm can dispatch has a door on BOTH ctxs -
  // the polled three are the frame's, so the dispatchable pair is what
  // this arm hands over.
  const dispatchable = [...QUICKSLOT_ACTIONS].filter((a) => !POLLED_ACTIONS.has(a));
  assert.deepEqual(dispatchable.sort(), ['QuickOffHand', 'QuickSwap'],
    'the dispatchable quickslots - a third joins here, not silently');
  const dc = rd('src/scenes/dungeonContext.js');
  for (const [name, src] of [['worldModes interiorKeyCtx', wm], ['dungeonContext', dc]]) {
    assert.match(src, /quickOffHand\s*[(:]/, `${name} carries the off-hand door`);
    assert.match(src, /quickSwap\s*[(:]/, `${name} carries the swap door`);
  }
});
