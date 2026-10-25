// KETCH-FIX (2026-10-25, the owner: "The invisable panels cam fuck up players and that loot gets stuck inside the chest at
// the end"; bible/11-Multiplayer/Sky-Ketch.md section 18): THE SHIP'S INVISIBLE PANELS AND THE CHEST'S STUCK SHARE, each on
// the real ship's collider (scenes/ketch/ketchDeckHost.js) and, where a body goes, the real PlayerMotor. Every invisible
// floor and wall a body found began at the engine house: drawn only, with no deck laid between it and the bridge, a running
// jump over the bridge's fore rail went through its aft wall and fell through the ship, stood on the gun deck's ceiling
// (its top never drawn), or climbed the quarter wall's back onto the waist's lid. tools/mutants/ketch_panels.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { createKetchDeck, ketchOnLid } from '../../src/scenes/ketch/ketchDeckHost.js';
import { buildKetchShip, ketchHullOutline, hullRunSolid, ketchAftDeck, KT_HOUSE, KT_LID_Y } from '../../src/world/ketch/ketchModel.js';
import { KT_STAGE } from '../../src/net/ketch/ketchLaw.js';
import { deckToDungeon, dungeonToDeck, KT_VAULT, KT_CABIN, KT_STERN_LIFT, KT_LIFT, KT_BRIDGE, KT_HATCH, KT_HOLD_HATCH, KT_ANCHOR_LIFT } from '../../src/net/ketch/ketchDeck.js';
import { ketchChestMouth, KT_SPOILS_KEEP, KT_CHEST_MOUTH, createKetchShares } from '../../src/scenes/ketch/ketchShares.js';
import { spewLaunches, spewPiece, flySpew, keepLaunch } from '../../src/world/gate/gateSpew.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { ketchSpoilsList } from '../../src/systems/ketch/ketchSpoils.js';

function ship(sg) {
  const col = new Collider(() => -Infinity), deck = createKetchDeck({ renderer: { createMesh: (m) => ({ m }) } });
  deck.stand({ dynamicDraws: [], collider: col });
  const m = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 });
  let t = 1000;
  const V = { sg, cl: null, ws: null };
  const frame = (input, yaw) => { deck.pose(V, t, t * 1000, m); m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, yaw, 0); t += 1 / 60; };
  const feet = () => dungeonToDeck(m.pos[0], m.pos[1], m.pos[2]);
  const spawn = (x, y, z) => { const p = deckToDungeon(x, y, z); m.spawn(p[0], p[1] + 0.05, p[2]); for (let k = 0; k < 40; k++) frame({}, 0); };
  /** run toward [x, z] for `secs`, jumping every half second: the lowest the feet came, and where they end */
  const run = (to, secs) => {
    let low = Infinity;
    for (let k = 0; k < secs * 60; k++) { const f = feet(); low = Math.min(low, f[1]); frame({ forward: 1, run: true, jump: k % 30 === 0 }, Math.atan2(to[0] - f[0], to[1] - f[2])); }
    return { low, end: feet() };
  };
  const ray = (x, y, z, d, len) => col.raycast(deckToDungeon(x, y, z), d, len);
  return { col, spawn, run, ray };
}

test('KETCH-FIX THE ENGINE HOUSE AND THE AFT DECK ARE SOLID: a running jump over the bridge\'s fore rail lands on her deck and stops at the house\'s aft wall - never through it and down through the ship (the real motor fell to -43 m and on); the strips beside the house hold a body (mutants: the house drawn only; the aft deck unlaid; the strips drawn only)', () => {
  for (const x of [0, 8.3, -8.3]) {
    const S = ship(KT_STAGE.bridge);
    S.spawn(x, 0.1, 186);
    const { low, end } = S.run([x, 150], 10);
    assert.ok(low > -0.5, `x ${x}: never under her deck (the feet came to ${low.toFixed(2)})`);
    assert.ok(end[2] >= KT_HOUSE.z1 - 0.1, `x ${x}: stopped at the house's aft wall (ended at z ${end[2].toFixed(2)})`);
  }
  for (const x of [12, -12]) {
    const S = ship(KT_STAGE.bridge);
    S.spawn(x, 0.1, 186);
    const { low, end } = S.run([x, 120], 10);
    assert.ok(low > -0.5 && end[1] > -0.5, `x ${x}: the strip holds a body (lowest ${low.toFixed(2)})`);
  }
  // the aft deck's rim is the disc's own: every rim point on the circle, and the hub in sight of all of it (the fan never
  // crosses the disc)
  const pts = ketchAftDeck();
  for (const p of pts.slice(2, -1)) assert.ok(Math.abs(Math.hypot(p[0] - KT_BRIDGE.x, p[1] - KT_BRIDGE.z) - KT_BRIDGE.r) < 1e-9);
  assert.deepEqual(pts[0], [0, KT_HOUSE.z1]);
});

test('KETCH-FIX HER SIDES ARE SOLID BELOW HER DECK: a ray from outside her hull at the gun deck\'s and the hold\'s heights meets it - the void between the gun deck\'s walls and the hull is shut - but never the bow\'s run the anchor-lift\'s cage rises past (mutants: the sides drawn only; the bow\'s run solid)', () => {
  const S = ship(KT_STAGE.watch);
  for (const [x, z] of [[14, 115], [-14, 80], [14, 150]]) for (const y of [-3, -9]) {
    const d = S.ray(x, y, z, [x > 0 ? -1 : 1, 0, 0], 4);
    assert.ok(d < 2.5, `(${x}, ${y}, ${z}) meets her side (${d})`);
  }
  const outline = ketchHullOutline();
  const open = [];
  for (let i = 0; i < outline.length; i++) if (!hullRunSolid(outline[i], outline[(i + 1) % outline.length])) open.push([outline[i], outline[(i + 1) % outline.length]]);
  assert.deepEqual(open, [[[-4, 0], [4, 0]]], 'the bow\'s run alone, past the anchor-lift');
  assert.ok(Math.abs(KT_ANCHOR_LIFT.z) < 4, 'the lift rises inside the bow');
});

test('KETCH-FIX THE STAIRS SHOW THEIR UNDERSIDE: under each stair a drawn face looks down at the slope the motor walks - it was solid from both faces and drawn from above alone, an invisible ceiling under the stair (mutants: the soffit undrawn)', () => {
  const { model } = buildKetchShip(), P = model.positions, I = model.indices;
  const O = deckToDungeon(0, 0, 0);
  for (const H of [KT_HATCH, KT_HOLD_HATCH]) {
    const zm = (H.z0 + H.z1) / 2, ym = (H.y0 - 0.3 + H.y1) / 2;
    let below = 0;
    for (let i = 0; i < I.length; i += 3) {
      const v = [0, 1, 2].map((q) => [P[I[i + q] * 3] - O[0], P[I[i + q] * 3 + 1] - O[1], P[I[i + q] * 3 + 2] - O[2]]);
      const e1 = v[1].map((c, j) => c - v[0][j]), e2 = v[2].map((c, j) => c - v[0][j]);
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      if (!(ny < 0)) continue;
      const zs = v.map((p) => p[2]), ys = v.map((p) => p[1]), xs = v.map((p) => p[0]);
      if (Math.min(...xs) <= 0 && Math.max(...xs) >= 0 && Math.min(...zs) <= zm && Math.max(...zs) >= zm && Math.min(...ys) <= ym + 0.2 && Math.max(...ys) >= ym - 0.2) below++;
    }
    assert.ok(below >= 1, `a face under the stair at z ${zm} looks down (${below})`);
  }
});

test('KETCH-FIX THE WAIST\'S LID IS THE SKY\'S: a body standing on it is cast back as the nets cast it - over the Anchor Deck and the waist, at the lid\'s height - never in the mast-lift\'s shaft (its cage rides through that height), nor on her decks or the main top (mutants: the lid stood on; the shaft cast back)', () => {
  assert.equal(ketchOnLid(0, KT_LID_Y, 30), true, 'over the waist');
  assert.equal(ketchOnLid(0, KT_LID_Y + 0.05, 6), true, 'over the Anchor Deck');
  assert.equal(ketchOnLid(-12, KT_LID_Y, 50), true, 'its edge');
  assert.equal(ketchOnLid(KT_LIFT.x, KT_LID_Y, KT_LIFT.z), false, 'the shaft');
  assert.equal(ketchOnLid(0, 0, 30), false, 'the waist\'s deck');
  assert.equal(ketchOnLid(0, KT_LID_Y, 80), false, 'past the quarter wall');
  assert.equal(ketchOnLid(KT_LIFT.x, 16, KT_LIFT.z), false, 'the main top');
});

test('KETCH-FIX THE SHARE LEAVES THE CHEST\'S MOUTH AND LIES ON THE CABIN\'S FLOOR: every piece of every share, thrown toward a player standing anywhere in the cabin, comes to rest on its floor - never inside the chest (from its middle, 0.6 m up inside its own solid box, every piece of 80 did), never out of the door, never in the stern lift\'s ring (mutants: thrown from the chest\'s middle; the cabin\'s keep dropped)', () => {
  const S = ship(KT_STAGE.vault);
  const fly = (f, d, l) => { const h = S.col.raycastHit(f, d, l); return Number.isFinite(h?.dist) ? h : null; };
  const at = ketchChestMouth();
  const m = dungeonToDeck(at[0], at[1], at[2]);
  assert.ok(m[1] > 1.0 && m[2] < KT_VAULT.z - 0.5, 'the mouth stands out of the chest\'s box (its front at z - 0.5, its lid at 1.0)');
  assert.equal(KT_CHEST_MOUTH.out, 1.0);
  let n = 0;
  for (const seed of [1, 7, 77, 1234, 99999, 31337]) for (const stand of [[3, 226], [0, 228], [5, 233], [-2, 231], [-5, 226], [4, 235]]) {
    const f = deckToDungeon(stand[0], 0, stand[1]), list = ketchSpoilsList(seed, 30);
    const L = spewLaunches(seededRng(((seed >>> 0) ^ 0x5a5a) >>> 0), list.length, Math.atan2(f[0] - at[0], f[2] - at[2])).map((l) => keepLaunch(at, l, KT_SPOILS_KEEP));
    for (const l of L) {
      const p = spewPiece(at, l);
      for (let k = 0; k < 600 && !p.rest; k++) flySpew(p, 1 / 60, fly);
      const d = dungeonToDeck(p.pos[0], p.pos[1], p.pos[2]);
      n++;
      const where = `seed ${seed}, standing at ${stand}: ${d.map((v) => v.toFixed(2))}`;
      assert.ok(Math.abs(d[1]) < 0.1, `on the floor - ${where}`);
      assert.ok(!(Math.abs(d[0] - KT_VAULT.x) < 0.8 && Math.abs(d[2] - KT_VAULT.z) < 0.5), `not in the chest - ${where}`);
      assert.ok(d[0] > KT_CABIN.x0 && d[0] < KT_CABIN.x1 && d[2] > KT_CABIN.z0 + 0.3 && d[2] < KT_CABIN.z1, `in the cabin - ${where}`);
      assert.ok(Math.hypot(d[0] - KT_STERN_LIFT.x, d[2] - KT_STERN_LIFT.z) > KT_STERN_LIFT.r + 0.2, `out of the stern lift - ${where}`);
    }
  }
  assert.ok(n >= 140, `the pieces flown (${n})`);
  // and the chest hands the pool that keep (scenes/ketch/ketchShares.js chest)
  let asked = null;
  const shares = createKetchShares({ store: null, pool: { spew: (o) => { asked = o; return true; }, grant: () => Promise.resolve(true) }, level: () => 30, me: () => 'acct', aboard: () => true });
  shares.paid({ d: 3, o: '0123456789abcdef', s: 'acct', c: 77, l: 30, x: 'dealt' });
  assert.equal(shares.chest(at, 0), true);
  assert.equal(asked.keep, KT_SPOILS_KEEP, 'kept to the cabin\'s floor');
  assert.deepEqual(asked.at, at);
});
