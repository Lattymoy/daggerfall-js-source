// STREAM-OWED (the player, 2026-10-18: "Theres this bug with overworld travel where you always slowly degrade to x1
// speed and have to exit the overworld and go back into to reset. And you can also see the unloaded overworld chunk").
// bible/06-Systems/Travel-View.md STREAM-OWED.
//
// THE SINK. Under the Overworld, TV2's governor holds the clock to what the stream raises (scenes/world.js
// travelViewGovern), and the stream's pump builds one pixel at a time. Two faults in the pair sank a long ride to
// walking pace with nothing near, and the view's own reset (raised again: a fresh x100) was the players' way out:
// - THE PUMP SPENT ITS QUEUE FIRST IN, FIRST OUT, and built whole every entry the stream had already let go - a pixel
//   a crossing listed and the next one dropped behind a turn - before tearing it down again (the pump's own
//   `!state.loaded.has` arm). On a winding road one build in twenty was for land behind the traveller, and the near
//   pixels the governor waits on queued behind them and behind the far ring a crossing lists first.
// - THE GOVERNOR CUT ON WHILE THE STREAM GAINED. A hole the faster rate left takes its builds to fill whatever the
//   rate is cut to; the governor halved again at every settle while any of it stood, so one town on the road took
//   x40 to x1 though the stream was catching up at x20.
//
// Run here on the real producers: the stream (world/streamingWorld.js), the host's pump, its view governor and its count
// (lifted whole out of scenes/world.js, as ow_loadowed.test.js lifts them), the governor and the clock - a rider on a
// winding road under the view, Enhanced's land view, a town in ten pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StreamingWorldState, worldCoordToMapPixel, nearestFirstFrom } from '../../../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { LAND_VIEW_DEFAULT } from '../../../src/world/landView.js';
import { createLoadGovernor, unbuiltAround, TV_GOV_HOLD_S, TV_GOV_SETTLE_S } from '../../../src/systems/travel/travelGovernor.js';
import { threatCap, foePaced, foeRate } from '../../../src/systems/travel/travelThreat.js';
import { foeHostile, foeAlerted } from '../../../src/systems/encounters.js';
import { TRAVEL_VIEW_TEXT, travelWalkRate, TV_MOVE_ACTIONS } from '../../../src/scenes/travelView.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../../../src/systems/timeScale.js';
import { _resetTravelPace } from '../../../src/systems/travel/travelPace.js';

const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** A function of world.js lifted whole: its head at the host's own indent, to the brace that closes it there. */
const cut = (name) => {
  const m = new RegExp(`\\n {2}(?:async )?function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`).exec(W);
  assert.ok(m, `world.js holds ${name}`);
  return m[0];
};
/** One declaration line of world.js, as the host writes it. */
const line = (head) => { const at = W.indexOf(`\n  ${head}`); assert.ok(at >= 0, `world.js holds ${head}`); return W.slice(at, W.indexOf('\n', at + 1) + 1); };

const ASK = 100;   // RATE-LAW / PACE-DIALS: a road's journey at the dial's top
const RIDE_MPS = 10.8;   // a ridden horse at speed 50 (world/horseModel.js, motor.js rideSpeed) - the report's way of going
const DT = 1 / 60;
const WILD_S = 0.15, TOWN_S = 2, TOWN_SHARE = 0.1;   // a build's real seconds: the wild's, and a town's (one pixel in ten)
const TRIP_S = 600;
const ROADS = [1, 2, 3, 4];   // four rides, each its own towns (the draw's seed) - one ride's towns are luck, four are the law

/**
 * The host, as much of the Overworld's journey as the stream and its hold read: the panel up and an autopilot driving
 * under the view, the stream at Enhanced's land view with its first grid built, and each later build taking its real
 * seconds (a seeded draw: a town or the wild) before it publishes, as buildPixelNow's single atomic set does.
 */
function journeyHost(road) {
  _resetTravelPace();
  setTimeScale(ASK);
  const state = new StreamingWorldState(LAND_VIEW_DEFAULT);
  const built = new Map();
  const queue = [];
  for (const p of state.init(500, 250)) built.set(`${p.px},${p.py}`, p);
  const at = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
  let seed = road;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const d = { t: 0, builds: 0, letGo: 0, farther: 0, said: [], due: [] };
  const player = { pos: at, speed: RIDE_MPS, isPlayerSwimming: false, feetAt: () => [...player.pos] };
  const scope = {
    travelControlUI: { isShowing: true }, travelOptions: { state: { autopilot: {} } },
    travelView: { active: true, state: 'up' }, tvOwnsJourneys: () => true,
    worldTimeScale: timeScale, setWorldTimeScale: setTimeScale, resetTimeScale, createLoadGovernor, MAX_TIME_SCALE,
    state, built, queue, unbuiltAround, StreamingWorldState, worldCoordToMapPixel, modes: null, walkMode: true, playerSpawned: true,
    player, cam: { pos: at },
    buildPixel: (px, py) => {
      const k = `${px},${py}`;
      if (built.has(k)) return Promise.resolve(built.get(k));
      d.builds += 1;
      if (!state.loaded.has(k)) d.letGo += 1;   // a build of land the stream no longer wants
      const near = nearestFirstFrom(state.current);
      if (queue.some((q) => state.loaded.has(`${q.px},${q.py}`) && !built.has(`${q.px},${q.py}`) && near(q, { px, py }) < 0)) d.farther += 1;
      const secs = rand() < TOWN_SHARE ? TOWN_S : WILD_S;
      return new Promise((resolve) => d.due.push({ at: d.t + secs, done: () => { built.set(k, { px, py }); resolve(built.get(k)); } }));
    },
    destroyPixel: (px, py) => { built.delete(`${px},${py}`); },
    _wodArrival: { keys: new Set() }, console: { error: () => {} },
    // nothing near: no band, no raider, no foe, no ship, no stranger
    getPref: () => true, playerEntity: { preventEnemySpawns: false }, _bandChase: new Map(), _tvAttack: null,
    BAND_CONTACT_M: 30, BAND_CHASE_MPS: 5.2, warmAshesOn: () => false, csaOn: () => false, raidQuarry: () => false,
    raiderSight: () => 1000, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => [], tvRaid: { spent: new Set(), chase: new Map() },
    navalRaidersOn: () => false, naval: null, seaRaidPeerChase: () => null, RAIDER_CONTACT_M: 60, RAIDER_CHASE_MPS: 4.2,
    exteriorFoes: { foes: [] }, foeHostile, foeAlerted, foeCampKey: () => null, SIGHT_RADIUS: 102.4,
    _wildStrangers: [], WILD_STRANGER_SLOW_M: 200, threatCap, foePaced, foeRate, _travelDrive: { yaw: 90 },
    tvSay: (t) => d.said.push(t), TRAVEL_VIEW_TEXT, performance: { now: () => d.t * 1000 },
    travelWalkRate, TV_MOVE_ACTIONS, held: () => false, keys: new Set(), csaBoatUnderMe: () => null, gamePaused: () => false,
    travellerOnRoad: () => true, csaHoldsTimeScale: () => false,
  };
  const names = Object.keys(scope).filter((n) => n !== '_travelDrive');
  const body = `
    let { ${names.join(', ')} } = s;
    let travelAsked = ${ASK};
    let building = false, _streamSince = null, _strangerRateNow = 0;
    ${line('const _tvGround = ')}${line('let tvGroundGen = ')}${cut('tvGroundGenNow')}${cut('playerTravelPixel')}${cut('pump')}
    ${line('let _slowWas = ')}${line('const JOURNEY_SLOW_SAY_MS = ')}${line('const travelGovernor = ')}
    ${line('let tvHeld = ')}${line('let tvHeldWhy = ')}${line('let tvWalking = ')}${line('let _tvWalkYaw = ')}${line('const _tvUnbuilt = ')}
    ${cut('journeyThreats')}${cut('journeyThreatCap')}${cut('journeySlowSaid')}${cut('travelViewGovern')}
    /** One frame in the host's order: the clock governed, the rider driven at it along the road's heading, the stream
     *  told where the feet are (a crossing's load list queued and what left the grid let go), the retries, the pump. */
    function frame(dt, yaw) {
      travelViewGovern(dt);
      const step = player.speed * worldTimeScale() * dt;
      player.pos[0] += Math.cos(yaw) * step; player.pos[2] += Math.sin(yaw) * step;
      const r = state.update(player.pos);
      if (r.offset) for (let i = 0; i < 3; i++) player.pos[i] += r.offset[i];
      cam.pos = player.pos;
      if (r.pixelChanged) {
        queue.push(...r.load);
        for (const u of r.unload) { destroyPixel(u.px, u.py); state.release(u.px, u.py); }
      }
      if (state.failed.size) queue.push(...state.retryDue(performance.now()));
      pump();
    }
    return { frame, held: () => [tvHeld, tvHeldWhy] };`.replace(/\b_travelDrive\b/g, 's._travelDrive');
  const h = new Function('s', 'd', body)(scope, d);
  /** Real seconds of the ride: the builds due publish, the frame runs, its promises settle. */
  const run = async (seconds, each) => {
    for (const end = d.t + seconds; d.t < end - 1e-9;) {
      d.t += DT;
      for (let i = d.due.length - 1; i >= 0; i--) if (d.due[i].at <= d.t) d.due.splice(i, 1)[0].done();
      h.frame(DT, Math.sin(d.t / 20) * 1.2);   // the road winds: east, swinging forty degrees and more either way
      for (let k = 0; k < 3; k++) await null;
      each();
    }
  };
  return { ...h, d, state, built, queue, run };
}

test('STREAM-OWED, the stream\'s law: THE PUMP\'S NEXT BUILD IS THE NEAREST PIXEL STILL OWED - ring by ring, then by distance, the earlier of two as near; an entry let go (out of the grid, a build that threw) or standing is dropped off the queue on the way, and nothing owed is null (mutants: first in first out, the later of two, a let-go entry kept, a standing one kept)', () => {
  const state = new StreamingWorldState(2);
  const listed = state.init(500, 250);
  const built = new Map();
  for (const p of listed) built.set(`${p.px},${p.py}`, p);
  built.delete('502,252'); built.delete('501,250'); built.delete('499,250'); built.delete('500,248');
  // the queue as a journey leaves it: the far corner first (listed at a crossing), the near ones after, then a pixel
  // the stream let go behind a turn, one standing, and the two near ones again
  state.release(498, 248);
  const queue = [{ px: 502, py: 252 }, { px: 500, py: 248 }, { px: 498, py: 248 }, { px: 501, py: 251 }, { px: 501, py: 250 }, { px: 499, py: 250 }, { px: 501, py: 250 }];
  assert.deepEqual(state.takeOwed(queue, built), { px: 501, py: 250 }, 'ring 1 before ring 2 however late it was queued - and the earlier of two as near (501 before 499)');
  assert.deepEqual(queue, [{ px: 502, py: 252 }, { px: 500, py: 248 }, { px: 499, py: 250 }, { px: 501, py: 250 }],
    'the let-go pixel (498,248: the stream holds it no more) and the standing one (501,251) dropped, the rest kept in their order');
  built.set('501,250', { px: 501, py: 250 });
  assert.deepEqual(state.takeOwed(queue, built), { px: 499, py: 250 }, 'then the other of ring 1');
  assert.deepEqual(queue, [{ px: 502, py: 252 }, { px: 500, py: 248 }], 'the twice-queued pixel, now standing, gone with it');
  built.set('499,250', { px: 499, py: 250 });
  assert.deepEqual(state.takeOwed(queue, built), { px: 500, py: 248 }, 'ring 2: straight out (4 m^2 of pixels) before the corner (8)');
  assert.deepEqual(state.takeOwed(queue, built), { px: 502, py: 252 });
  assert.equal(state.takeOwed(queue, built), null, 'nothing owed');
  assert.deepEqual(queue, []);
  queue.push({ px: 502, py: 252 });
  state.release(502, 252);
  assert.equal(state.takeOwed(queue, built), null, 'a queue of let-go entries owes nothing - and is emptied');
  assert.deepEqual(queue, []);
});

test('STREAM-OWED, the governor\'s law: A SETTLED CUT IS CUT AGAIN ONLY IF THE HOLE HAS NOT SHRUNK SINCE - a stream gaining on it holds the rate just cut to, one standing still (a pixel in flight, LOAD-OWED\'s) halves it to walking pace at the old cadence (mutants: cut on while the stream gains, never cut again after the first)', () => {
  const step = (g, seconds, unbuilt) => { let r = null; for (let t = 0; t < seconds - 1e-9; t += 0.05) r = g.step(0.05, { unbuilt, requested: ASK }); return r; };
  const g = createLoadGovernor({ max: MAX_TIME_SCALE });
  assert.equal(step(g, TV_GOV_HOLD_S + 0.05, 12), 50, 'a hole: the first cut, at TV_GOV_HOLD_S');
  assert.equal(step(g, TV_GOV_SETTLE_S, 9), 50, 'fewer owed at the settle: the stream gains at x50 - held there');
  assert.equal(step(g, TV_GOV_SETTLE_S, 5), 50, 'and gains again - held');
  assert.equal(step(g, TV_GOV_SETTLE_S, 5), 25, 'no fewer than at the last look: x50 does not load cleanly - cut');
  assert.equal(step(g, TV_GOV_SETTLE_S, 7), 10, 'more: cut again');
  const one = createLoadGovernor({ max: MAX_TIME_SCALE });
  const at = [];
  for (let t = 0, was = ASK; t < 10; t += 0.05) { const r = one.step(0.05, { unbuilt: 1, requested: ASK }); if (r !== was) { at.push([Math.round((t + 0.05) * 100) / 100, r]); was = r; } }
  assert.deepEqual(at, [[0.25, 50], [2.25, 25], [4.25, 10], [6.25, 5], [8.25, 1]], 'one pixel in flight the whole while: the cadence AUDIT DEEP2 B-2 set, to walking pace');
});

test('STREAM-OWED, the host: A RIDE ON A WINDING ROAD UNDER THE OVERWORLD NO LONGER SINKS TO WALKING PACE - the host\'s own pump never builds land the stream has let go, takes the nearest owed pixel every time, and the governor holds the rate the stream gains at; four ten-minute rides at Enhanced\'s land view, a town in ten pixels, nothing near (they spent 206 s of their forty minutes at x1 and built 314 pixels already left behind; the pump fixed alone, 88 s; the governor alone, 59 s)', async (t) => {
  t.after(() => { resetTimeScale(); _resetTravelPace(); });
  let walking = 0, ridden = 0, builds = 0;
  for (const road of ROADS) {
    const h = journeyHost(road);
    await h.run(TRIP_S, () => { if (timeScale() === 1) walking += DT; ridden += RIDE_MPS * timeScale() * DT; });
    builds += h.d.builds;
    assert.equal(h.d.letGo, 0, `ride ${road}: no build of a pixel the stream had let go`);
    assert.equal(h.d.farther, 0, `ride ${road}: no build while a nearer pixel was owed`);
    assert.deepEqual(h.d.said, [], 'no enemy said - there is none');
    assert.notEqual(h.held()[1], 'foes');
  }
  const trips = TRIP_S * ROADS.length, avg = ridden / (RIDE_MPS * trips);
  assert.ok(builds > 2400, `the stream built the roads (${builds} pixels)`);
  assert.ok(walking < 50, `at walking pace ${walking.toFixed(1)} s of ${trips} (it was 206)`);
  assert.ok(avg > 13, `the rides' average x${avg.toFixed(1)} (it was x12.6: the stream's own pace is the cap, and the governor's job is to ride at it)`);
});
