// AUDIT KETCH L4-1 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SHIP WALKED BY THE REAL MOTOR - the
// bridge's outer rail stands open where the gangway meets the ring and across the cabin's door, so a body walks from the
// bosun's line's landing onto the bridge, and from the bridge into the open cabin; the rail stands everywhere else (the
// ring walked outward is stopped at it). The real ship and every part on a real Collider (scenes/ketch/ketchDeckHost.js),
// the real PlayerMotor. tools/mutants/ketch_model.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { createKetchDeck } from '../../src/scenes/ketch/ketchDeckHost.js';
import { KT_STAGE } from '../../src/net/ketch/ketchLaw.js';
import { KT_LINE_LAND, KT_BRIDGE, KT_RAIL_GAPS, railRuns, deckToDungeon, dungeonToDeck, deckZoneAt } from '../../src/net/ketch/ketchDeck.js';

function ship(sg) {
  const col = new Collider(() => -Infinity), deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } });
  deck.stand({ dynamicDraws: [], collider: col });
  const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 });
  let t = 0;
  const V = { sg, cl: null, ws: null };
  const frame = (input, yaw) => { deck.pose(V, t, t * 1000, m); m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, yaw, 0); t += 1 / 60; };
  const feet = () => dungeonToDeck(m.pos[0], m.pos[1], m.pos[2]);
  const spawn = (x, y, z) => { const p = deckToDungeon(x, y, z); m.spawn(p[0], p[1] + 0.05, p[2]); for (let k = 0; k < 40; k++) frame({}, 0); };
  /** walk (no jump) toward [x, z] for at most `secs`: answers the feet where it ends */
  const walk = (to, secs) => {
    for (let k = 0; k < secs * 60; k++) { const f = feet(); if (Math.hypot(to[0] - f[0], to[1] - f[2]) < 0.25) break; frame({ forward: 1, run: true }, Math.atan2(to[0] - f[0], to[1] - f[2])); }
    return feet();
  };
  return { spawn, walk };
}

test('KETCH THE BRIDGE\'S RAIL OPEN WHERE IT MUST BE: from the line\'s landing on the gangway onto the bridge, and from the bridge through the cabin\'s door, walked - no jump; the ring\'s rail stands elsewhere (AUDIT KETCH L4-1; mutants: the rail closed round)', () => {
  assert.equal(KT_RAIL_GAPS.length, 2);
  assert.deepEqual(railRuns(Math.PI / 4, Math.PI / 2), [[Math.PI / 4, Math.PI / 2]], 'a section with no gap: one run');
  const S = ship(KT_STAGE.bridge);
  S.spawn(KT_LINE_LAND.x, 0.1, KT_LINE_LAND.z);
  const on = S.walk([KT_BRIDGE.x + 6, KT_BRIDGE.z - 6], 20);
  assert.equal(deckZoneAt(...on), 'bridge', `walked onto the bridge (ended at ${on.map((v) => v.toFixed(2))})`);
  assert.ok(Math.hypot(on[0] - (KT_BRIDGE.x + 6), on[2] - (KT_BRIDGE.z - 6)) < 0.5);
  const C = ship(KT_STAGE.vault);
  C.spawn(0.5, 0.1, 221);
  const inside = C.walk([0.5, 230], 15);
  assert.equal(deckZoneAt(...inside), 'cabin', `walked into the cabin (ended at ${inside.map((v) => v.toFixed(2))})`);
  // elsewhere the rail stands: walked outward from the core across section 1, stopped inside the ring
  const R = ship(KT_STAGE.bridge);
  const a = (3 * Math.PI) / 8;
  R.spawn(KT_BRIDGE.x + Math.sin(a) * 18, 0.1, KT_BRIDGE.z + Math.cos(a) * 18);
  const out = R.walk([KT_BRIDGE.x + Math.sin(a) * 30, KT_BRIDGE.z + Math.cos(a) * 30], 6);
  assert.ok(Math.hypot(out[0] - KT_BRIDGE.x, out[2] - KT_BRIDGE.z) < KT_BRIDGE.r, 'stopped at the rail');
});

test('KETCH NO WALL CLIMBED OVER INTO A BARRED ROOM: DFU\'s classic climb at Climbing 100 (`?parkour=off`) and the enhanced one go up the gallery\'s wall and the cabin\'s front and never over - the ceilings above them solid; the quarter wall neither (AUDIT KETCH L4-3; mutants: the gallery\'s ceiling drawn only)', () => {
  const climbAt = (sg, x, y, z, yaw, over, withParkour) => {
    const col = new Collider(() => -Infinity), deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } });
    deck.stand({ dynamicDraws: [], collider: col });
    const cl = { inputs: () => ({ climbing: 100, luck: 50, khajiit: false, enhanced: false }), tally: () => {}, say: () => {} };
    const pk = { enabled: () => withParkour, leap: () => false, inputs: () => ({ climbing: 100, jumping: 0, khajiit: false, enhanced: false, fatigue: 1, load: 0 }), tally: () => {}, say: () => {}, hold: null };
    const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 }, { climbing: cl, parkour: pk });
    let t = 1000;
    const V = { sg, cl: null, ws: null };
    const frame = (inp) => { deck.pose(V, t, t * 1000, m); m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...inp }, (yaw * Math.PI) / 180, 0); t += 1 / 60; };
    const p = deckToDungeon(x, y, z); m.spawn(p[0], p[1] + 0.05, p[2]);
    for (let k = 0; k < 30; k++) frame({});
    let high = -99;
    for (let k = 0; k < 60 * 30; k++) {
      const top = high > y + 4.5;
      frame({ forward: 1, jump: top && k % 20 === 0, up: top && k % 20 === 0 });
      const f = dungeonToDeck(m.pos[0], m.pos[1], m.pos[2]); high = Math.max(high, f[1]);
      if (over(f)) return f;
    }
    return null;
  };
  for (const pk of [false, true]) {
    assert.equal(climbAt(KT_STAGE.gallery, 4.8, -6, 80, 90, (f) => f[0] > 6.5, pk), null, `the gallery's port wall (parkour ${pk})`);
    assert.equal(climbAt(KT_STAGE.bridge, 4.4, 0, 222.0, 0, (f) => f[2] > 224.6, pk), null, `the cabin's front (parkour ${pk})`);
    assert.equal(climbAt(KT_STAGE.engine, 6, 0, 61.2, 0, (f) => f[2] > 62.8, pk), null, `the quarter wall (parkour ${pk})`);
  }
});

test('KETCH THE MAST-LIFT\'S SHAFT IS NETTED AT THE TOP: with the cage below, a running jump at its collar or its gate - up to the fastest build\'s - never drops a body down the shaft (AUDIT KETCH L4-4; mutants: the collar a plain rail)', async () => {
  const { EG_FAST_JUMP_X } = await import('../../src/net/eliteGates/egSpanLaw.js');
  const base = 1_800_000_000 - (1_800_000_000 % 32);   // the cage at the hold's floor
  for (const [side, from, dir, edgeOf] of [['north collar', [9, 52.9], [0, 1], (f) => 54.85 - f[2]], ['west gate', [3.8, 58], [1, 0], (f) => 5.85 - f[0]], ['east collar', [14.6, 57.2], [-1, 0], (f) => f[0] - 12.15]]) {
    for (const mult of [1.1, 1.35, EG_FAST_JUMP_X]) {
      for (const at of [0.6, 1.2]) {
        const col = new Collider(() => -Infinity), deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } });
        deck.stand({ dynamicDraws: [], collider: col });
        const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 }, { jumpBoost: () => mult });
        m.spawn(...deckToDungeon(from[0], 16.05, from[1]));
        let t = base + 2, pressed = false, low = 99;
        const yaw = Math.atan2(dir[0], dir[1]);
        for (let k = 0; k < 60 * 5; k++) {
          deck.pose({ sg: KT_STAGE.sailwalk, cl: null, ws: null }, t, t * 1000, m);
          const go = !pressed && m.grounded && edgeOf(dungeonToDeck(...m.pos)) <= at;
          if (go) pressed = true;
          m.update(1 / 60, { forward: 1, run: true, jump: go, up: go, strafe: 0, down: false }, yaw, 0); t += 1 / 60;
          low = Math.min(low, dungeonToDeck(...m.pos)[1]);
        }
        assert.ok(low > 10, `${side}, x${mult}, jumped ${at} m short: held at the top (lowest ${low.toFixed(2)})`);
      }
    }
  }
});

test('KETCH THE GUNS ARE SOLID AND OUT OF THE LANES: a body walking into a gun\'s carriage stops at it, and each outer hammer lane runs the gallery\'s length unblocked (AUDIT KETCH L4-11; mutants: a carriage walked through)', async () => {
  const { KT_GUN_ZS, KT_GUN_DEPTH, KT_GALLERY, KT_HAMMER } = await import('../../src/net/ketch/ketchDeck.js');
  assert.ok(KT_GALLERY.x1 - KT_GUN_DEPTH >= Math.max(...KT_HAMMER.lanes) + 0.4 + 0.3, 'clear of the outer lane by a body\'s breadth');
  for (const lane of [-4, 4]) {
    const S = ship(KT_STAGE.gallery);
    S.spawn(lane, -6, KT_GALLERY.z0 + 2);
    const end = S.walk([lane, 104], 30);
    assert.ok(end[2] > 103.5, `the lane at ${lane} walked its length (ended at ${end.map((v) => v.toFixed(2))})`);
  }
  const G = ship(KT_STAGE.gallery), z = KT_GUN_ZS[2];
  G.spawn(3.5, -6, z);
  const at = G.walk([KT_GALLERY.x1 - 0.2, z], 4);
  assert.ok(at[0] < KT_GALLERY.x1 - KT_GUN_DEPTH, `stopped at the carriage (at ${at[0].toFixed(2)})`);
});
