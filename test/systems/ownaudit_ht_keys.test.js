// HANDHELD TORCHES' THREE INERT KEYS, MADE LIVE - Throwing.ShowTrajectory (the wind-up's arc drawn as dots,
// systems/torchArc.js), Throwing.EmissionShadows (a burning foe's light casts a shadow only with it on - the carried
// mask's CARRIED_SHADOWLESS) and Presentation.Tint (the hand takes the room's light only with it on). Mutants:
// tools/mutants/ownaudit_keys.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandheldTorches, readTorchSettings, throwArcPoints } from '../../src/systems/handheldTorches.js';
import { createDroppedTorches, ENEMY_FIRE_KIND, ENEMY_LIGHT_EFFECT_KEY } from '../../src/scenes/droppedTorches.js';
import { worldToScreen, arcDots, drawArc, ARC_LOOK } from '../../src/systems/torchArc.js';
import { withPlayerLights } from '../../src/scenes/magicCandle.js';
import { CARRIED_IN_HAND, CARRIED_SHADOWLESS } from '../../src/render/lightId.js';
import { pickShadowCasters } from '../../src/render/shadowPass.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { DEFAULT_BINDINGS } from '../../src/systems/inputActions.js';
import { TEMPLATES as T } from '../../src/systems/useItem.js';
import { readFileSync } from 'node:fs';

const V = 'handheld-torches';
const DEFAULT_CODE = Object.fromEntries(DEFAULT_BINDINGS.map(([code, action]) => [action, code]));
const defaults = () => ({ ...Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default])), 'Handling.LanternsAtWaist': false });
const torch = () => ({ group: 'UselessItems2', templateIndex: T.Torch, currentCondition: 50, maxCondition: 50 });
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A perspective that looks down -z: w = -z, so a point ahead at z < 0 lands on the screen. */
const LOOK = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0]);

function rig(over = {}) {
  const store = { ...defaults(), ...over };
  const entity = { items: [torch()], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const keys = new Set();
  const h = createHandheldTorches({ settings: () => readTorchSettings(() => store), audio: null, say: () => {}, rolls: () => 0.5, torches: () => null, handedness: () => false, loadSprite: async () => null });
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => ({ raycast: (pos, dir, len) => (pos[1] + dir[1] * len <= 0 ? pos[1] / -dir[1] : Infinity) }),   // a flat floor at y 0
    actionDown: (a) => keys.has(DEFAULT_CODE[a]), sheathWeapons: () => {},
  };
  const frame = (dt = 0.1) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  return { h, store, ctx, keys, frame, entity };
}

test('OWN-AUDIT ShowTrajectory: winding up a throw holds the flight\'s own arc from the free hand to the floor, gone at the release; with the switch off, none', () => {
  const r = rig();
  r.keys.add(DEFAULT_CODE.TorchThrow);
  r.frame();
  r.frame();
  const arc = r.h.arc;
  assert.ok(arc && arc.length > 2, 'an arc while the key is held');
  const want = throwArcPoints({ origin: [0, 0.9, 0], forward: [0, 0, 1], right: [1, 0, 0], freeHand: r.h.freeHand, strength: r.h.throwStrength, bodyStrength: 50, throwAngle: r.h._w.s.throwAngle, throwGravity: r.h._w.s.throwGravity, throwStrength: r.h._w.s.throwStrength, collider: r.ctx.collider() });
  assert.deepEqual(arc, want, 'the flight\'s law at the wind-up\'s strength, from the body\'s centre');
  assert.ok(Math.abs(arc.at(-1)[1]) < 1e-9, 'it lands on the floor');
  r.keys.delete(DEFAULT_CODE.TorchThrow);
  r.frame();
  assert.equal(r.h.arc, null, 'released: gone');
  const off = rig({ 'Throwing.ShowTrajectory': false });
  off.keys.add(DEFAULT_CODE.TorchThrow);
  off.frame();
  assert.equal(off.h.arc, null, 'the switch off: no arc');
});

test('OWN-AUDIT ShowTrajectory: the arc\'s dots through the camera - every few steps, none behind the eye or off the screen, the landing always drawn and larger; drawn as screen quads less the letterbox', () => {
  assert.deepEqual(worldToScreen([0, 0, -1], LOOK, IDENTITY, 200, 100), [100, 50], 'straight ahead: the middle');
  assert.equal(worldToScreen([0, 0, 1], LOOK, IDENTITY, 200, 100), null, 'behind the eye');
  const pts = Array.from({ length: 11 }, (_, i) => [i * 0.01, 0, -1 - i]);
  const dots = arcDots(pts, LOOK, IDENTITY, 1920, 1080);
  assert.deepEqual(dots.map((d) => d[0]), [4, 10].map((i) => worldToScreen(pts[i], LOOK, IDENTITY, 1920, 1080)[0]), 'every few steps (4), the one crowding the landing (8) left out, and the landing (10)');
  assert.equal(dots.at(-1)[2], ARC_LOOK.landPx, 'the landing, larger');
  assert.ok(dots[0][2] < dots.at(-1)[2]);
  assert.deepEqual(arcDots(pts.map((p) => [p[0], p[1], -p[2]]), LOOK, IDENTITY, 1920, 1080), [], 'all behind: none');
  const quads = [];
  const renderer = { gl: { drawingBufferWidth: 1920, drawingBufferHeight: 1080 }, _proj: LOOK, _view: IDENTITY, screenOffset: [10, 0], drawScreenQuad: (tex, dst, src, c) => quads.push({ tex, dst, c }) };
  assert.equal(drawArc(renderer, pts), dots.length);
  assert.equal(quads[0].tex, null, 'a solid quad');
  assert.deepEqual(quads.at(-1).dst.x, dots.at(-1)[0] - ARC_LOOK.landPx / 2 - 10, 'less the screen offset');
  assert.deepEqual(quads[0].c, ARC_LOOK.rgba);
  const r = rig();
  assert.equal(r.h.drawThrowArc(renderer), 0, 'no wind-up: nothing drawn');
  const rig1 = readFileSync(new URL('../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rig1, /if \(handheldOn\(\) && !paralyzed && !sheetWindowUp\(\)\) handheld\.drawThrowArc\(renderer\);/, 'the rig draws it before either lane');
});

test('OWN-AUDIT Tint: the hand takes the room\'s light with the switch on, and is drawn at its own colours with it off', () => {
  for (const [on, want] of [[true, [0.3, 0.3, 0.3]], [false, undefined]]) {
    const r = rig({ 'Presentation.Tint': on });
    const t = r.entity.items[0];
    r.entity.lightSource = t;
    r.frame();
    r.h._w.currentTexture = { tex: { id: 1 } };
    const quads = [];
    const renderer = { drawScreenQuad: (tex, rect, uv, c) => quads.push(c) };
    assert.equal(r.h.draw(renderer, r.ctx.canvas, [0.3, 0.3, 0.3]), true);
    assert.deepEqual(quads[0], want, on ? 'tinted' : 'untinted');
  }
});

test('OWN-AUDIT EmissionShadows: a burning foe\'s light says shadowless with the switch off - the mask marks it 2, which takes no caster slot - and casts with it on', () => {
  for (const [on, mask] of [[false, CARRIED_SHADOWLESS], [true, 0]]) {
    const store = { ...defaults(), 'Throwing.EmissionShadows': on };
    const foe = { entity: { level: 1, health: 30, activeEffects: [{ kind: ENEMY_FIRE_KIND, key: ENEMY_LIGHT_EFFECT_KEY, roundsRemaining: 3 }] }, ai: { feet: [0, 0, 2], yaw: 0 }, dead: false };
    const p = createDroppedTorches({ renderer: null, foes: () => [foe], entity: { lightSource: null }, settings: () => readTorchSettings(() => store), loadTexture: async () => null });
    p.tick(0);
    const lights = p.lights();
    assert.equal(lights.length, 1, 'the foe\'s light');
    assert.equal(lights[0].shadowless, !on);
    const list = withPlayerLights(new Float32Array(0), { x: 0, y: 1, z: 0, range: 10, carried: true }, ...lights);
    assert.deepEqual([...list.carried], [CARRIED_IN_HAND, mask], on ? 'it casts' : 'the hand\'s 1, the foe\'s 2');
    assert.deepEqual(pickShadowCasters(list, [0, 1.7, 0], 4, list.carried), on ? [1] : [], 'a marked light takes no caster slot');
  }
  const air = readFileSync(new URL('../../src/render/airPass.js', import.meta.url), 'utf8');
  assert.match(air, /if \(f\.carried && f\.carried\[i\] === CARRIED_IN_HAND\) continue;/, 'the glare skips the hand\'s light alone - a shadowless foe keeps its glare');
});

test('OWN-AUDIT: the three say what they do', () => {
  const k = MOD_SETTINGS[V].keys;
  assert.deepEqual(['Throwing.ShowTrajectory', 'Throwing.EmissionShadows', 'Presentation.Tint'].map((n) => k[n].description), [
    'While you wind up a throw, dots show where the torch will fly and land.',
    'The light of a burning foe casts shadows.',
    'The hand with the light is shaded by the room, as your weapon is. Off keeps it bright.',
  ]);
});
