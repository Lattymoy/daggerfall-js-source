// GATE-MIX (2026-10-20): a flash in the court casts no shadow - its lights wear `carried` (the mask a spell's impact light
// wears), world/gate/gateArena.js withCourtLights carries it into the frame's mask, and the shadow pick passes it by.
// Design: bible/11-Multiplayer/World-Bosses.md section 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS } from '../../src/net/gate/gateBrain.js';
import { createGateCourt } from '../../src/scenes/gate/gateCourt.js';
import { GATE_STATE_EMPTY } from '../../src/net/gate/gateLink.js';
import { courtToDungeon, withCourtLights } from '../../src/world/gate/gateArena.js';
import { pickShadowCasters } from '../../src/render/shadowPass.js';
import { destroyGateBossBar } from '../../src/ui/gate/gateBossBar.js';

const lamp = (x, carried) => ({ x, y: 2, z: 0, range: 8, color: [1, 0.5, 0.2], ...(carried === undefined ? {} : { carried }) });

test('GATE-MIX withCourtLights: a court light that says `carried` is masked, the rest are not, and the player\'s own mask stands where it stood (mutants: the mask unread; every court light masked)', () => {
  const lit = { data: Object.assign(new Float32Array([0, 1, 0, 6, 9, 1, 9, 6]), { carried: new Uint8Array([1, 0]) }), colors: new Float32Array(6) };
  const out = withCourtLights(lit, [lamp(3, true), lamp(4), lamp(5, false)]);
  assert.deepEqual([...out.data.carried], [1, 0, 1, 0, 0], 'the torch, a brazier of the player\'s list, the flash, two lamps');
  assert.equal(out.carried, out.data.carried);
});

test('GATE-MIX the shadow pick passes a flash by: nearest the eye, it takes no caster slot - the lamp behind it does (mutants: the court\'s mask lost on the way)', () => {
  const lit = { data: new Float32Array(0), colors: new Float32Array(0) };
  const out = withCourtLights(lit, [lamp(1, true), lamp(6)]);
  assert.deepEqual(pickShadowCasters(out.data, [0, 2, 0], 1, out.data.carried), [1], 'the lamp at 6 m, not the flash at 1 m');
  assert.deepEqual(pickShadowCasters(out.data, [0, 2, 0], 1, null), [0], 'unmasked, the flash would have taken it');
});

test('GATE-MIX the court\'s own flashes wear the mask - a landing\'s light where the Hellfire fell - and his glow, which follows him and stays, does not (mutants: the burst\'s light unmasked)', () => {
  destroyGateBossBar();
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), audio: { play3d() {}, play3dId() {} },
    feet: () => courtToDungeon(1, 0, 1), player: () => ({ health: 500, maxHealth: 500 }), save: () => 0, strike: () => {}, rng: () => 0.5, send: () => true,
  });
  const atk = { i: 1, a: ATTACKS.hellfire.id, at: 10_000, x: 0, z: 0, yw: 0, tg: [[3, 3], [-12, 4]] };
  link.st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, atk };
  for (const t of [9000, 10_005, 10_100]) { clock.t = t; c.frame(); }
  const L = c.lights();
  const flashes = L.filter((l) => l.carried), kept = L.filter((l) => !l.carried);
  assert.equal(flashes.length, 2, 'a landing light under each mark, each masked');
  assert.equal(kept.length, 1, 'his glow');
});
