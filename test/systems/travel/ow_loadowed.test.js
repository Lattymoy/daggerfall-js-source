// LOAD-OWED (the bug-reports channel, 2026-10-14, 7 upvotes, confirmed by a second player: "When traveling using
// Overworld, the speed randomly drops and gets locked at 1x after traveling for a while. There are no enemies or threats
// nearby to trigger this slowdown. To get back to 100x speed, I have to cancel the travel and restart it manually" - on
// foot, on horseback and with the cart). bible/06-Systems/Travel-View.md LOAD-OWED.
//
// THE LATCH. Under the Overworld, TV2's governor holds the clock while the grid round the traveller has pixels it has not
// built - the land loading (scenes/world.js travelViewGovern). A pixel whose build THROWS is let go by the stream (the
// pump's catch: destroyPixel, state.release) and asked for again only when the traveller next crosses a map pixel
// (StreamingWorldState.update's load list) - but the count asked only whether the world streams there, so the pixel
// read "loading" to the end: the hold halved the clock to x1 and kept it there, at a walking pace that took minutes to
// reach that crossing, and a build that failed again held it again. A restart's fresh x100 crossed a pixel before the
// ceiling fell back, which is why cancelling and starting again was the players' way out.
//
// Run here on the real producers: the stream (world/streamingWorld.js), the host's pump, its view governor and its count
// (lifted whole out of scenes/world.js), the governor (systems/travel/travelGovernor.js) and the clock (systems/timeScale.js) -
// a journey on foot under the view at x100, one pixel of the counted grid in flight, its build thrown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StreamingWorldState, worldCoordToMapPixel } from '../../../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { createLoadGovernor, unbuiltAround, unbuiltCount, TV_GOV_CLEAR_S } from '../../../src/systems/travel/travelGovernor.js';
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

const ASK = 100;   // RATE-LAW / PACE-DIALS: a road's journey at the dial's top, as the players had it
const WALK_MPS = 5;   // on foot (the report's first mode); a horse and a cart cross the same pixels sooner, held the same way
const DT = 0.05;
const P = { px: 502, py: 250 };   // two pixels ahead along the way - inside the counted grid (every ring but the edge)
const PK = `${P.px},${P.py}`;

/**
 * The host, as much of it as the hold reads: a journey under the view (the panel up, an autopilot driving), the stream
 * at (500, 250) with every pixel of its grid built but P, which the pump is building; P's first build is held in flight
 * until `failAt` real seconds and then THROWS, and every retry throws at once (a pixel that cannot be built).
 */
function journeyHost() {
  _resetTravelPace();
  setTimeScale(ASK);   // the journey's ask, put on the clock as Travel Options' applyRate puts it
  const state = new StreamingWorldState(3);
  const built = new Map();
  const queue = [];
  for (const p of state.init(500, 250)) if (`${p.px},${p.py}` !== PK) built.set(`${p.px},${p.py}`, p);
  queue.push({ ...P });   // owed: the stream holds it (`loaded`) and has not built it
  const at = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];   // the middle of the stream's own pixel
  assert.deepEqual(worldCoordToMapPixel(state.worldCoords(at).x, state.worldCoords(at).z), { x: 500, y: 250 });
  const d = { t: 0, pBuilds: 0, failP: null, said: [] };
  const player = { pos: at, speed: WALK_MPS, isPlayerSwimming: false, feetAt: () => [...player.pos] };
  const scope = {
    // the journey and the view
    travelControlUI: { isShowing: true }, travelOptions: { state: { autopilot: {} } },
    travelView: { active: true, state: 'up' }, tvOwnsJourneys: () => true,
    worldTimeScale: timeScale, setWorldTimeScale: setTimeScale, resetTimeScale, createLoadGovernor, MAX_TIME_SCALE,
    // the stream and the count
    state, built, queue, unbuiltAround, unbuiltCount, StreamingWorldState, worldCoordToMapPixel, modes: null, walkMode: true, playerSpawned: true,
    player, cam: { pos: at },
    // the pump's own doors: a build publishes into `built` (buildPixelNow's single atomic set), P's throws
    buildPixel: (px, py) => {
      const k = `${px},${py}`;
      if (built.has(k)) return Promise.resolve(built.get(k));
      if (k === PK) {
        d.pBuilds += 1;
        if (d.pBuilds === 1) return new Promise((resolve, reject) => { d.failP = () => reject(new Error(`pixel ${k}: the build threw`)); });
        return Promise.reject(new Error(`pixel ${k}: the build threw again`));
      }
      built.set(k, { px, py });
      return Promise.resolve(built.get(k));
    },
    destroyPixel: (px, py) => { built.delete(`${px},${py}`); },
    _wodArrival: { keys: new Set() }, console: { error: () => {} },
    // nothing near: no band, no raider, no foe, no ship, no stranger (the report: "no enemies or threats nearby")
    getPref: () => true, playerEntity: { preventEnemySpawns: false }, _bandChase: new Map(), _tvAttack: null,
    BAND_CONTACT_M: 30, BAND_CHASE_MPS: 5.2, warmAshesOn: () => false, csaOn: () => false, raidQuarry: () => false,
    raiderSight: () => 1000, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => [], tvRaid: { spent: new Set(), chase: new Map() },
    navalRaidersOn: () => false, naval: null, seaRaidPeerChase: () => null, RAIDER_CONTACT_M: 60, RAIDER_CHASE_MPS: 4.2,
    exteriorFoes: { foes: [] }, foeHostile, foeAlerted, foeCampKey: () => null, SIGHT_RADIUS: 102.4,
    _wildStrangers: [], WILD_STRANGER_SLOW_M: 200, threatCap, foePaced, foeRate, tvInTown: () => false, TOWN_PACE_MAX: 5,   /* OW-TOWN-WALK: out of town */ _travelDrive: { yaw: 90 },   // the drive east, along +x
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
    /** One frame in the host's order: the clock governed, the traveller driven at it (the motor's step is the clock's),
     *  the stream told where the feet are (the floating origin's move put on them; a crossing's load list queued and
     *  what left the grid let go, as the frame's pixel change does), the pump given its turn. */
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
  /** Real seconds of frames, each frame's promises let settle (the pump's build, its catch). */
  const run = async (seconds, each = null) => {
    for (const end = d.t + seconds; d.t < end - 1e-9;) { d.t += DT; h.frame(DT); await settle(); each?.(); }
  };
  return { ...h, d, state, built, queue, run };
}

test('LOAD-OWED: A PIXEL THE STREAM IS BUILDING HOLDS THE OVERWORLD\'S CLOCK, AND THE HOLD ENDS WHEN ITS BUILD DOES - a build that throws is let go by the stream (the pump\'s catch) and held the journey at x1 until the next pixel crossed, at the walking pace the hold itself set, and again at each crossing it failed again; now the clock climbs back to the ask with nothing near and nothing loading (mutants: the count back to the world\'s streaming alone, a failed pixel kept on the stream\'s books, nothing ever owed)', async (t) => {
  t.after(() => { resetTimeScale(); _resetTravelPace(); });
  const h = journeyHost();
  h.d.t = 0;
  // P in flight: the land IS loading - the clock is held, and the panel says it is the land. PIN MOVED (OW-LEAD,
  // test/systems/travel/ow_lead.test.js): held by how near P is - the traveller eased toward it, never into it (it was halved to
  // x1 by the time P had stood unbuilt eight seconds, wherever P lay)
  await h.run(9);
  assert.ok(timeScale() < ASK, `held while the stream builds a pixel of the grid: x${timeScale()}`);
  assert.equal(h.held()[1], 'load', 'and said so: "Held to xN of x100 while the land loads"');
  assert.ok(h.pixel().x < P.px, 'and never walked into the pixel the stream owes');
  assert.deepEqual(h.d.said, [], 'no enemy said - there is none');
  assert.equal(h.state.loaded.has(PK), true, 'owed: on the stream\'s books');
  // ... and its build throws
  h.d.failP();
  await h.run(DT);
  assert.equal(h.built.has(PK), false, 'P stands unbuilt');
  assert.equal(h.state.loaded.has(PK), false, 'and the stream let it go - nothing is building it');
  const from = h.pixel();
  // nothing is loading now: the hold lets go and the clock climbs back a step every TV_GOV_CLEAR_S clean (it held the
  // journey at x1 until the traveller had walked to the next pixel - 40 s on foot from here - and then again)
  let low = 0;
  await h.run(TV_GOV_CLEAR_S + 1);
  assert.ok(timeScale() > 1, `the climb has begun: x${timeScale()} (x1 means the hold outlived the build that caused it)`);
  await h.run(100, () => { if (timeScale() === 1) low += DT; });
  assert.equal(timeScale(), ASK, `back to the ask - x${timeScale()}`);
  assert.deepEqual(h.held(), [null, null], 'nothing held');
  assert.ok(low < 1, `never walking pace again with nothing owed (${low.toFixed(2)} s at x1)`);
  assert.ok(h.pixel().x - from.x >= 5, `and the journey went on - ${h.pixel().x - from.x} pixels on`);
  assert.ok(h.d.pBuilds >= 2, 'P was asked for again as the traveller crossed into it, and failed again - and held nothing');
});

test('LOAD-OWED: THE COUNT IS THE STREAM\'S OWN BOOKS - built, or not owed by the stream (its `loaded` grid: built or building), the line the host counts with; a pixel queued or in flight is owed, one let go is not, and where the world streams nothing nothing is ever loaded (ETHER-OW\'s law, kept)', () => {
  // PIN MOVED (OW-LEAD, test/systems/travel/ow_lead.test.js): the count's line hands the owed pixels on too (`uc.owed`)
  const m = /\n {6}uc\.n = unbuiltAround\(px, radius, (\(x, y\) => [^\n]*?)(?:, uc\.owed)?\);\n/.exec(W);
  assert.ok(m, 'the governor\'s count');
  const state = new StreamingWorldState(1);
  const built = new Set();
  const isBuilt = new Function('StreamingWorldState', 'built', 'state', `return ${m[1]};`)(StreamingWorldState, built, state);
  state.init(500, 250);
  assert.equal(unbuiltAround({ x: 500, y: 250 }, 1, isBuilt), 9, 'a fresh grid: all nine owed');
  for (const k of state.loaded.keys()) built.add(k);
  assert.equal(unbuiltAround({ x: 500, y: 250 }, 1, isBuilt), 0, 'built: nothing owed');
  built.delete('501,250');
  assert.equal(unbuiltAround({ x: 500, y: 250 }, 1, isBuilt), 1, 'torn down for a rebuild (the season\'s re-skin, a late pack): owed until it stands');
  state.release(501, 250);
  assert.equal(unbuiltAround({ x: 500, y: 250 }, 1, isBuilt), 0, 'let go by the stream (a build that threw): owed by nobody');
  state.init(3000, 1500);
  assert.equal(state.loaded.size, 0);
  assert.equal(unbuiltAround({ x: 3000, y: 1500 }, 1, isBuilt), 0, 'where the world streams nothing, nothing is owed');
});
