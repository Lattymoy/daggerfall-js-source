// OW-LEAD (2026-10-17, the player: "iam 100% sure it even slowed down to 1x without enemies in 500m nearby ... So far it
// seems random it almost always [goes] down to 1x and after a while it goes up again"). bible/06-Systems/Travel-View.md OW-LEAD.
//
// THE LAND'S HOLD IS HOW NEAR THE HOLE IS, NOT HOW LONG IT HAS STOOD. TV2's governor halved the clock every
// TV_GOV_SETTLE_S while any pixel of the counted grid was still building - a slower clock builds nothing faster, so a
// crossing's row the pump took a while over took a journey from x100 to x1 (50, 25, 10, 5, 1), and the climb back was a
// step every TV_GOV_CLEAR_S: eighty seconds to x100, then the next crossing's row again. Now the clock is held to the
// rate at which the traveller takes TV_GOV_LEAD_S of real time to reach the nearest owed pixel (travelGovernor.js
// owedMetres, leadCap) - OW6's law for an enemy's reach, with the stream's books for the enemies.
//
// Run on the real producers, as LOAD-OWED's rig runs them (test/systems/travel/ow_loadowed.test.js): the stream, the host's pump,
// its view governor and its count lifted whole out of scenes/world.js, the governor and the clock - a rider at x100 under
// the view, every build taking the pump BUILD_S of real time, one at a time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StreamingWorldState, worldCoordToMapPixel } from '../../../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { createLoadGovernor, unbuiltAround, unbuiltCount, owedMetres, leadCap, TV_GOV_LEAD_S } from '../../../src/systems/travel/travelGovernor.js';
import { threatCap, foePaced, foeRate } from '../../../src/systems/travel/travelThreat.js';
import { foeHostile, foeAlerted } from '../../../src/systems/encounters.js';
import { TRAVEL_VIEW_TEXT, travelWalkRate, TV_MOVE_ACTIONS } from '../../../src/scenes/travelView.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../../../src/systems/timeScale.js';
import { _resetTravelPace } from '../../../src/systems/travel/travelPace.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const OLD_LINE = 'const load = travelGovernor.step(dt, { unbuilt, requested: want });';
const NEW_LINE = /const load = travelGovernor\.step\(dt, \{ unbuilt, requested: want, owed: uc\.owed, [^\n]*?\}\);/;
const ASK = 100;
const DT = 0.05;

/** The host over `W` (world.js's text): a rider driving east at x100 under the view, the stream's grid built about
 *  (500, 250), every later build BUILD_S of real time. */
function rideHost(W, { buildS, mps }) {
  const cut = (name) => {
    const m = new RegExp(`\\n {2}(?:async )?function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`).exec(W);
    assert.ok(m, `world.js holds ${name}`);
    return m[0];
  };
  const line = (head) => { const at = W.indexOf(`\n  ${head}`); assert.ok(at >= 0, `world.js holds ${head}`); return W.slice(at, W.indexOf('\n', at + 1) + 1); };
  _resetTravelPace();
  setTimeScale(ASK);
  const state = new StreamingWorldState(3);
  const built = new Map();
  const queue = [];
  for (const p of state.init(500, 250)) built.set(`${p.px},${p.py}`, p);
  const at = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
  const d = { t: 0, pending: [] };
  const player = { pos: at, speed: mps, isPlayerSwimming: false, feetAt: () => [...player.pos] };
  const scope = {
    travelControlUI: { isShowing: true }, travelOptions: { state: { autopilot: {} } },
    travelView: { active: true, state: 'up' }, tvOwnsJourneys: () => true,
    worldTimeScale: timeScale, setWorldTimeScale: setTimeScale, resetTimeScale, createLoadGovernor, MAX_TIME_SCALE,
    state, built, queue, unbuiltAround, unbuiltCount, StreamingWorldState, worldCoordToMapPixel, modes: null, walkMode: true, playerSpawned: true,
    player, cam: { pos: at },
    // a build takes the pump BUILD_S of real time, then publishes (buildPixelNow's single atomic set)
    buildPixel: (px, py) => new Promise((resolve) => { d.pending.push({ at: d.t + buildS, done: () => { built.set(`${px},${py}`, { px, py }); resolve(); } }); }),
    destroyPixel: (px, py) => { built.delete(`${px},${py}`); },
    _wodArrival: { keys: new Set() }, console: { error: () => {} },
    // nothing near: no band, no raider, no foe, no ship, no stranger
    getPref: () => true, playerEntity: { preventEnemySpawns: false }, _bandChase: new Map(), _tvAttack: null,
    BAND_CONTACT_M: 30, BAND_CHASE_MPS: 5.2, warmAshesOn: () => false, csaOn: () => false, raidQuarry: () => false,
    raiderSight: () => 1000, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => [], tvRaid: { spent: new Set(), chase: new Map() },
    navalRaidersOn: () => false, naval: null, seaRaidPeerChase: () => null, RAIDER_CONTACT_M: 60, RAIDER_CHASE_MPS: 4.2,
    exteriorFoes: { foes: [] }, foeHostile, foeAlerted, foeCampKey: () => null, SIGHT_RADIUS: 102.4,
    _wildStrangers: [], WILD_STRANGER_SLOW_M: 200, threatCap, foePaced, foeRate, _travelDrive: { yaw: 90 }, tvInTown: () => false, TOWN_PACE_MAX: 5,   /* OW-TOWN-WALK: out of town */
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
    function frame(dt) {
      travelViewGovern(dt);
      player.pos[0] += player.speed * worldTimeScale() * dt;
      const r = state.update(player.pos);
      if (r.offset) for (let i = 0; i < 3; i++) player.pos[i] += r.offset[i];
      cam.pos = player.pos;
      if (r.pixelChanged) {
        queue.push(...r.load);
        for (const u of r.unload) { destroyPixel(u.px, u.py); state.release(u.px, u.py); }
      }
      pump();
    }
    return { frame, held: () => [tvHeld, tvHeldWhy], pixel: () => playerTravelPixel() };`.replace(/\b_travelDrive\b/g, 's._travelDrive');
  const h = new Function('s', 'd', body)(scope, d);
  const settle = () => new Promise((r) => setImmediate(r));
  /** `seconds` of real time: the frames, the builds that are due, and what the ride met. */
  const ride = async (seconds) => {
    const seen = { x1: 0, sum: 0, n: 0, inHole: 0, from: h.pixel().x };
    for (const end = d.t + seconds; d.t < end - 1e-9;) {
      d.t += DT;
      for (const b of d.pending.filter((p) => p.at <= d.t)) { d.pending.splice(d.pending.indexOf(b), 1); b.done(); }
      await settle();
      h.frame(DT);
      await settle();
      const p = h.pixel();
      if (!built.has(`${p.x},${p.y}`)) seen.inHole += DT;
      if (timeScale() === 1) seen.x1 += DT;
      seen.sum += timeScale(); seen.n++;
    }
    return { ...seen, mean: seen.sum / seen.n, pixels: h.pixel().x - seen.from };
  };
  return { ...h, d, ride };
}

test('OW-LEAD: the land\'s cap is how near the nearest owed pixel is - at the traveller\'s own pace, TV_GOV_LEAD_S of real time to its edge, on the spinner\'s ladder, never under walking pace; nothing owed (or no pace) holds nothing', () => {
  const at = { x: 500.5 * 32768, z: (499 - 250 + 0.5) * 32768 };   // the middle of pixel (500, 250)
  assert.equal(owedMetres(at, []), Infinity, 'nothing owed');
  assert.equal(owedMetres(at, [[500, 250]]), 0, 'the pixel underfoot');
  assert.equal(owedMetres(at, [[502, 250]]), 1228.8, 'two pixels east: a pixel and a half to its edge');
  assert.equal(owedMetres(at, [[500, 248]]), 1228.8, 'two pixels north (map y counts down the world\'s z)');
  assert.equal(owedMetres(at, [[502, 252], [501, 250]]), 409.6, 'the nearest of them');
  assert.equal(TV_GOV_LEAD_S, 4);
  assert.equal(leadCap(1228.8, 5), 60, 'on foot, a hole two pixels off: 1228.8 / (4 x 5) = 61.4 - x60');
  assert.equal(leadCap(1228.8, 12), 25, 'a rider: 1228.8 / (4 x 12) = 25.6 - x25');
  assert.equal(leadCap(30, 12), 1, 'at its edge: walking pace');
  assert.equal(leadCap(150, 12), 3, 'under five: the ladder\'s ones');
  assert.equal(leadCap(Infinity, 12), Infinity);
  assert.equal(leadCap(100, 0), Infinity, 'standing: nothing to hold');
  const gov = createLoadGovernor({ max: 100 });
  for (let i = 0; i < 400; i++) assert.equal(gov.step(0.05, { unbuilt: 1, requested: 100, owed: [[502, 250]], feet: at, speedMps: 12 }), 25, 'held by distance, never halved by time');
  assert.equal(gov.step(0.05, { unbuilt: 0, requested: 100, owed: [], feet: null, speedMps: 12 }), 100, 'the last build stood: the ask at once, no climb');
  // the host hands one list frame after frame (world.js `uc.owed`): a count empties it first, so a pixel built since never lingers in it
  const out = [[9, 9]];
  assert.equal(unbuiltAround({ x: 10, y: 10 }, 1, (x, y) => !(x === 11 && y === 10), out), 1);
  assert.deepEqual(out, [[11, 10]], 'emptied, then the owed pixel alone');
});

test('OW-LEAD host run: A RIDER AT x100 WITH EVERY BUILD TAKING THE PUMP A SECOND - the old halving took the journey to x1 for most of two minutes; the lead law never lets it walk, keeps it near the ask, and the rider never enters a pixel the stream owes (mutant: the old line)', async (t) => {
  t.after(() => { resetTimeScale(); _resetTravelPace(); });
  assert.match(WORLD, NEW_LINE, 'the host hands the governor the owed pixels, the feet and the pace');
  const now = await rideHost(WORLD, { buildS: 1, mps: 12 }).ride(120);
  const was = await rideHost(WORLD.replace(NEW_LINE, OLD_LINE), { buildS: 1, mps: 12 }).ride(120);
  t.diagnostic(`old: ${was.x1.toFixed(1)} s at x1, mean x${was.mean.toFixed(1)}, ${was.pixels} px; new: ${now.x1.toFixed(1)} s at x1, mean x${now.mean.toFixed(1)}, ${now.pixels} px`);
  assert.ok(was.x1 > 30, `the old law: ${was.x1.toFixed(1)} s of 120 at x1, mean x${was.mean.toFixed(1)} - the report`);
  assert.equal(now.x1, 0, `the lead law: never at walking pace (mean x${now.mean.toFixed(1)}, ${now.pixels} pixels on, the old ${was.pixels})`);
  assert.ok(now.pixels > was.pixels, 'and further in the same two minutes');
  assert.equal(now.inHole, 0, 'never standing in a pixel the stream has not built');
});
