// HORSE-LIT (bible/01-Overview/bugs/Field-Bugs-2026-10-16.md; Mac, 2026-10-16: "Horses in first person should be affected by
// lighting"). TransportManager.OnGUI draws the ridingTexture white; the port's first-person horse takes the weapon's
// tint now - MAC-I's `flatLightAt` at the camera, under the same switch - on the sprite and on RR2's neck band alike.
// Driven through the real mount rig (player/mountRig.js) over a recording renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { setPitchFloorProvider } from '../../src/player/lookFilter.js';
import { createMountRig } from '../../src/player/mountRig.js';

/** A rig on a recording renderer whose room light is `light` (null: a renderer with no flatLightAt). */
function rigIn(light, { mode = TRANSPORT_MODES.Horse, enhanced = null } = {}) {
  const drawn = [], asked = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, color) => drawn.push({ rect: { ...rect }, uv: uv ?? null, color }) };
  if (light) renderer.flatLightAt = (...args) => { asked.push(args); return light; };
  const player = { grounded: true, transportMode: mode, standing: false, isRunning: false, movingLessThanHalfSpeed: false, pos: [0, 0, 0], setTransportMode() {} };
  const rig = createMountRig({
    renderer, canvas: { width: 640, height: 400 }, fetchBytes: async () => new Uint8Array(), palette: null,
    audio: { playOneShot() {}, setLoop() {} }, player, playerEntity: { items: [] }, showOverlay: () => {},
    lookPitch: () => 0, lookYaw: () => 0, groundHeightAt: (x, z) => (z > 0.5 ? 1 : 0),   // uphill ahead: RR2 lifts the sprite
    enhancedRiding: () => enhanced,
  });
  rig._setArt({ width: 100, height: 50, frames: [{}, {}, {}, {}] });
  return { rig, drawn, asked };
}

test('HORSE-LIT: the mount wears the room\'s light, as the weapon does', () => {
  try {
    const dark = [0.3, 0.25, 0.4];
    for (const mode of [TRANSPORT_MODES.Horse, TRANSPORT_MODES.Cart]) {
      const { rig, drawn, asked } = rigIn(dark, { mode });
      rig.frame(1 / 60);
      assert.equal(drawn.length, 1, 'the sprite drawn');
      assert.deepEqual(drawn[0].color, dark, `the ${mode === TRANSPORT_MODES.Cart ? 'cart' : 'horse'} takes the room's light`);
      assert.equal(drawn[0].rect.y, 400 - 50 * 2, 'at DFU\'s rect, unmoved');
      assert.equal(drawn[0].uv, null, 'the whole frame');
      assert.deepEqual(asked, [[]], 'once a frame, at the camera - where the weapon\'s tint is read');
    }
    // RR2's neck band is the same picture: it wears the same light, or a white strip shows under a dark neck
    const { rig, drawn } = rigIn(dark, { enhanced: { terrainFollowing: true, softenFollow: 0 } });
    for (let i = 0; i < 16; i++) rig.frame(1 / 60);
    const last = drawn.slice(-2);
    assert.ok(last[1]?.uv, 'the band drawn under the lifted sprite');
    assert.deepEqual(last[0].color, dark);
    assert.deepEqual(last[1].color, dark, 'the band the sprite\'s own light');
  } finally {
    setPitchFloorProvider(null);
  }
});

test('HORSE-LIT: the switch is the weapon\'s, and no light is white', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    // a renderer with no clock's answer (the test room, a probe) draws DFU's white
    const bare = rigIn(null);
    bare.rig.frame(1 / 60);
    assert.equal(bare.drawn.length, 1);
    assert.equal(bare.drawn[0].color, undefined, 'no tint: drawScreenQuad\'s own white');
    // First-person lighting off (`?fplight=off`, the Features row's kill door): the mount is white with the weapon
    Object.defineProperty(globalThis, 'location', { value: { search: '?fplight=off' }, configurable: true, writable: true });
    const off = rigIn([0.3, 0.25, 0.4], { enhanced: { terrainFollowing: true, softenFollow: 0 } });
    for (let i = 0; i < 16; i++) off.rig.frame(1 / 60);
    assert.ok(off.drawn.length >= 2);
    assert.ok(off.drawn.every((d) => d.color === undefined), 'switched off: every quad white');
    assert.equal(off.asked.length, 0, 'and the light not asked');
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
    setPitchFloorProvider(null);
  }
});
