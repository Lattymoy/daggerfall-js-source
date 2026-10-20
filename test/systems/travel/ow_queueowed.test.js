// QUEUE-OWED (bible/06-Systems/Travel-View.md QUEUE-OWED; a player's report, 2026-10-18: "the world isnt loading at times
// in the overworld and when it doesnt load his overworld speed goes down to 1x").
//
// THE QUEUE BUILT WHAT THE STREAM HAD LET GO. A crossing queues the grid's new edge (StreamingWorldState.update's load
// list) and lets go what left the grid (the frame's unload: destroyPixel, state.release) - but a pixel let go while it
// still WAITED in the host's build queue stayed there, and the pump built it whole and threw it away after (its "not on
// the books" teardown, meant for a pixel let go while its build was in flight). DFU's UpdateTerrains collects first and
// builds only the terrains still active (StreamingWorld.cs:654-657). Under the Overworld at x100 the stream falls behind
// on a road that turns, and each pixel built for nobody was a build the grid round the traveller waited for: holes in the
// view, and TV2's governor holding the clock at x1 while the land loaded (scenes/world.js travelViewGovern).
//
// Run here on the real producers: the stream (world/streamingWorld.js), the host's pump, its view governor and its count
// (lifted whole out of scenes/world.js, as test/systems/travel/ow_loadowed.test.js lifts them), the governor
// (systems/travel/travelGovernor.js) and the clock (systems/timeScale.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StreamingWorldState, worldCoordToMapPixel } from '../../../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { createLoadGovernor, unbuiltAround, unbuiltCount } from '../../../src/systems/travel/travelGovernor.js';
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
const settle = () => new Promise((r) => setImmediate(r));

test('QUEUE-OWED, the stream\'s law: owes() drops the queued pixels at the head that the stream let go while they waited, answers whether one it still holds stands next, and leaves the rest in order', () => {
  const key = (p) => `${p.px},${p.py}`;
  const s = new StreamingWorldState(1);
  const queue = s.init(500, 250);
  assert.equal(queue.length, 9);
  s.update([TERRAIN_SIZE + 1, 0, TERRAIN_SIZE / 2]);   // one pixel east: the west column leaves the grid
  for (const y of [249, 250, 251]) s.release(499, y);
  const order = queue.filter((p) => p.px !== 499).map(key);
  const got = [];
  while (s.owes(queue)) got.push(key(queue.shift()));
  assert.deepEqual(got, order, 'every pixel still on the books, in the queue\'s own order, none of the three let go');
  assert.equal(queue.length, 0, 'the queue spent');
  assert.equal(s.owes([]), false, 'an empty queue owes nothing');
  const lone = [{ px: 499, py: 250 }];
  assert.equal(s.owes(lone), false, 'nor one holding only what was let go');
  assert.deepEqual(lone, [], 'and that is dropped');
  const tail = [{ px: 499, py: 250 }, { px: 499, py: 249 }, { px: 501, py: 250 }, { px: 499, py: 251 }, { px: 500, py: 250 }];
  assert.equal(s.owes(tail), true);
  assert.deepEqual(tail, [{ px: 501, py: 250 }, { px: 499, py: 251 }, { px: 500, py: 250 }], 'every let-go pixel at the head dropped, the owed one next, and what follows waits its turn');
});

test('QUEUE-OWED, the host\'s pump: crossings that leave queued pixels behind - while a build is in flight, and in the frame the next build starts - none of them is built, every pixel of the new grid is, and a pixel let go while its build was in flight is still torn down when it lands (the host\'s own pump, lifted)', async () => {
  const state = new StreamingWorldState(1);
  const built = new Map(), queue = [], begun = [];
  let release = null;
  queue.push(...state.init(500, 250));
  const buildPixel = (px, py) => {
    const k = `${px},${py}`;
    if (built.has(k)) return Promise.resolve(built.get(k));
    begun.push(k);
    if (k === '500,250') return new Promise((r) => { release = () => { built.set(k, { px, py }); r(built.get(k)); }; });   // the first build, in flight across the crossings
    built.set(k, { px, py });
    return Promise.resolve(built.get(k));
  };
  const destroyPixel = (px, py) => { built.delete(`${px},${py}`); };
  const s = { state, built, queue, buildPixel, destroyPixel, _wodArrival: { keys: new Set() }, console: { error() {} }, performance: { now: () => 0 } };
  const pump = new Function('s', `let { state, built, queue, buildPixel, destroyPixel, _wodArrival, console, performance } = s;
    let building = false, _streamSince = null;
    ${cut('pump')}
    return pump;`)(s);
  pump();
  await settle();
  assert.deepEqual(begun, ['500,250'], 'the player\'s pixel first, still building');
  // a crossing east in the frame's own order: the load list queued, what left the grid let go
  const at = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
  const cross = () => {
    at[0] += TERRAIN_SIZE;
    const r = state.update(at);
    for (let j = 0; j < 3; j++) at[j] += r.offset?.[j] ?? 0;
    queue.push(...r.load);
    for (const u of r.unload) { destroyPixel(u.px, u.py); state.release(u.px, u.py); }
  };
  cross(); cross();   // two while it builds
  assert.equal(state.current.x, 502);
  release();
  await settle();   // it lands: the pump's end, between frames
  assert.equal(queue[0] && state.loaded.has(`${queue[0].px},${queue[0].py}`), true, 'the queue\'s head is owed as the build ends');
  cross();   // and the next frame crosses again before the pump's turn - the head it left is let go
  assert.equal(state.current.x, 503);
  for (let i = 0; i < 40; i++) { pump(); await settle(); }
  const left = begun.filter((k) => !state.loaded.has(k));
  assert.deepEqual(left, ['500,250'], `no build begun for a pixel the stream had let go - only the one in flight as it left (${left.join(' ')})`);
  assert.equal(built.has('500,250'), false, 'and that one torn down as it landed (AUDIT 24\'s law, kept)');
  assert.deepEqual([...built.keys()].sort(), [...state.loaded.keys()].sort(), 'the new grid stands whole, and nothing else');
  assert.equal(queue.length, 0, 'the queue spent');
});

const ASK = 100;   // a journey at the dial's top
const DT = 1 / 30;

/**
 * A journey under the view (the panel up, an autopilot driving, nothing near), on the host's own pump, governor and count,
 * the traveller riding `mps` metres a second at the clock's rate along a road that turns a right angle every `turnS` real
 * seconds; every build takes `buildS` real seconds (one at a time - the pump's own law).
 */
async function journey({ mps, buildS, turnS, seconds }) {
  _resetTravelPace();
  setTimeScale(ASK);
  const state = new StreamingWorldState(3);
  const built = new Map(), queue = [];
  for (const p of state.init(500, 250)) built.set(`${p.px},${p.py}`, p);
  const at = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
  const d = { t: 0, builds: 0, letGo: 0, atX1: 0 };
  const player = { pos: at, speed: mps, isPlayerSwimming: false, feetAt: () => [...player.pos] };
  let cur = null;
  const scope = {
    travelControlUI: { isShowing: true }, travelOptions: { state: { autopilot: {} } },
    travelView: { active: true, state: 'up' }, tvOwnsJourneys: () => true,
    worldTimeScale: timeScale, setWorldTimeScale: setTimeScale, resetTimeScale, createLoadGovernor, MAX_TIME_SCALE,
    state, built, queue, unbuiltAround, unbuiltCount, StreamingWorldState, worldCoordToMapPixel, modes: null, walkMode: true, playerSpawned: true,
    player, cam: { pos: at },
    buildPixel: (px, py) => {
      const k = `${px},${py}`;
      if (built.has(k)) return Promise.resolve(built.get(k));
      d.builds++;
      if (!state.loaded.has(k)) d.letGo++;   // begun for a pixel the stream no longer holds
      return new Promise((resolve) => { cur = { k, px, py, end: d.t + buildS, resolve }; });
    },
    destroyPixel: (px, py) => { built.delete(`${px},${py}`); },
    _wodArrival: { keys: new Set() }, console: { error: () => {} },
    getPref: () => true, playerEntity: { preventEnemySpawns: false }, _bandChase: new Map(), _tvAttack: null,
    BAND_CONTACT_M: 30, BAND_CHASE_MPS: 5.2, warmAshesOn: () => false, csaOn: () => false, raidQuarry: () => false,
    raiderSight: () => 1000, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => [], tvRaid: { spent: new Set(), chase: new Map() },
    navalRaidersOn: () => false, naval: null, seaRaidPeerChase: () => null, RAIDER_CONTACT_M: 60, RAIDER_CHASE_MPS: 4.2,
    exteriorFoes: { foes: [] }, foeHostile, foeAlerted, foeCampKey: () => null, SIGHT_RADIUS: 102.4,
    _wildStrangers: [], WILD_STRANGER_SLOW_M: 200, threatCap, foePaced, foeRate, tvInTown: () => false, TOWN_PACE_MAX: 5,   /* OW-TOWN-WALK: out of town */ _travelDrive: { yaw: 45 },
    tvSay: () => {}, TRAVEL_VIEW_TEXT, performance: { now: () => d.t * 1000 },
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
    /** One frame in the host's order: the clock governed, the traveller driven at it, the stream told where the feet are
     *  (a crossing's load list queued and what left the grid let go, as the frame's pixel change does), the pump's turn. */
    function frame(dt, hx, hz) {
      travelViewGovern(dt);
      player.pos[0] += hx * player.speed * worldTimeScale() * dt;
      player.pos[2] += hz * player.speed * worldTimeScale() * dt;
      const r = state.update(player.pos);
      if (r.offset) for (let i = 0; i < 3; i++) player.pos[i] += r.offset[i];
      cam.pos = player.pos;
      if (r.pixelChanged) {
        queue.push(...r.load);
        for (const u of r.unload) { destroyPixel(u.px, u.py); state.release(u.px, u.py); }
      }
      pump();
    }
    return { frame };`.replace(/\b_travelDrive\b/g, 's._travelDrive');
  const h = new Function('s', 'd', body)(scope, d);
  let [hx, hz] = [Math.SQRT1_2, Math.SQRT1_2], turned = 0;
  while (d.t < seconds) {
    d.t += DT;
    if (d.t - turned >= turnS) { turned = d.t; [hx, hz] = [-hz, hx]; }
    if (cur && d.t >= cur.end) {
      const c = cur;
      cur = null;
      built.set(c.k, { px: c.px, py: c.py });
      c.resolve(built.get(c.k));
      await settle();
    }
    h.frame(DT, hx, hz);
    await settle();
    if (timeScale() === 1) d.atX1 += DT;
  }
  resetTimeScale();
  _resetTravelPace();
  return d;
}

test('QUEUE-OWED, the journey: on horseback at x100 under the Overworld, a road that turns and a machine that builds a pixel a second - no build is begun for a pixel the stream let go (78 of 292 were), and the clock spends under half the time at x1 it did while the land loaded (56 s of 300, 126 s before, measured on this rig; mutants: the pump back to the queue\'s head, the books unread, the whole queue dropped, one let-go pixel dropped a turn)', async (t) => {
  t.after(() => { resetTimeScale(); _resetTravelPace(); });
  const d = await journey({ mps: 12, buildS: 1, turnS: 20, seconds: 300 });
  assert.equal(d.letGo, 0, `no build begun for a pixel the stream had let go (${d.letGo} of ${d.builds})`);
  assert.ok(d.builds > 250, `the stream kept building (${d.builds})`);
  assert.ok(d.atX1 < 80, `x1 for ${d.atX1.toFixed(1)} s of 300 (126 s while the queue built what was let go)`);
});
