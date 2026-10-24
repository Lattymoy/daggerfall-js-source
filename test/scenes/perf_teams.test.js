// PERF-TEAMS (2026-10-10, the owner: 40 fps by a populated town, 165 forty pixels out): ANOTHER PLAYER'S TEAM IS CULLED.
// HCC-PARK keeps up to PARK_CELL_MAX parked teams a cell for PARK_TTL_MS, owner online or not, and the pool stepped and
// drew every one of them every frame across the whole sixteen-pixel cell - behind the eye and past the far plane alike.
// BY EXECUTION: past PEER_TEAM_DRAW_M a team keeps its word and its ease and draws nothing (with a hysteresis); my own
// parked wagon a league off is the same; the travel view's grown world is never cut by the eye's distance; the host's
// view verdict (world.js yardCull) drops a wagon off screen or casts it into the shadow maps alone; the window's view
// out takes no team past the reach. `06-Systems/Horse-Cart-And-Cargo.md`.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createHorseCartPool, peerTeamFar, peerTeamBox, PEER_TEAM_DRAW_M, PEER_TEAM_DRAW_SLACK_M, PEER_TEAM_BOX_HALF_M, PEER_TEAM_BOX_UP_M, PEER_TEAM_BOX_DOWN_M,
} from '../../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../../src/systems/horse/horseCartWire.js';
import { DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP } from '../../src/scenes/decor/decorRoom.js';

const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };

function fakeRenderer() {
  const r = { draws: [], casts: [] };
  r.uploadTexture = () => {}; r.evictTexture = () => {};
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, m: [...m], remap, o });
  r.recordShadowMesh = (gpu, m) => r.casts.push({ gpu, m: [...m] });
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
  r.destroyBillboardBatch = () => {};
  return r;
}
const runtimeOf = (deployed) => ({
  view: () => ({ state: { HorseName: '', HorseMode: 0, Mode: 2, WorldX: 0, WorldZ: 0 }, moving: null, deployed, horse: null, teamFollowing: false, horseFollowing: false, persistence: true }),
  lateUpdate() {}, actionRows: () => [],
});
const parkedAt = (x, z) => [HCC_WIRE_KIND.Deployed, x, 1, z, 0, 0, 0, 1, 0, 0];
/** Where each draw stood, by the matrix's translation (x, z) - a wagon's parts all stand within a few metres of it. */
const drawnNear = (draws, x, z, reach = 20) => draws.some((d) => Math.hypot(d.m[12] - x, d.m[14] - z) < reach);

async function poolWith({ mine = [0, 1, 0] } = {}) {
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'openWagon', bakedWagon: async (k) => bakeOf(k), peerAnchor: () => null });
  pool.attach(runtimeOf(mine ? { isGrounded: true, position: mine, rotation: [0, 0, 0, 1], cargoTier: 0 } : null));
  pool.partsOf('openWagon'); await flush();
  pool.applyOwner('near', { w: parkedAt(30, 30), wk: 1 }, (q) => q, 0);
  pool.applyOwner('far', { w: parkedAt(2000, 0), wk: 1 }, (q) => q, 0);
  return { r, pool };
}

test('PERF-TEAMS the law: past PEER_TEAM_DRAW_M a team is far; one drawn stays drawn PEER_TEAM_DRAW_SLACK_M further (the hysteresis); the height never counts; no eye or no point cuts nothing; the view box stands round the wagon (mutants: the reach, the slack, the axis)', () => {
  assert.equal(PEER_TEAM_DRAW_M, 400);
  assert.equal(PEER_TEAM_DRAW_SLACK_M, 25);
  const eye = [0, 0, 0];
  assert.equal(peerTeamFar([399, 0, 0], eye), false);
  assert.equal(peerTeamFar([0, 0, 420], eye), false, 'a drawn team keeps its place into the slack');
  assert.equal(peerTeamFar([0, 0, 426], eye), true);
  assert.equal(peerTeamFar([0, 0, 410], eye, true), true, 'a far one comes back only inside the reach itself');
  assert.equal(peerTeamFar([0, 0, 399], eye, true), false);
  assert.equal(peerTeamFar([300, 5000, 300], eye), false, 'the horizontal distance: a hill under it is no distance');
  assert.equal(peerTeamFar([310, 0, 310], eye), true, 'both axes count (438 m)');
  assert.equal(peerTeamFar(null, eye), false);
  assert.equal(peerTeamFar([5000, 0, 0], null), false);
  assert.deepEqual(peerTeamBox([10, 2, -4]),
    [10 - PEER_TEAM_BOX_HALF_M, 2 - PEER_TEAM_BOX_DOWN_M, -4 - PEER_TEAM_BOX_HALF_M, 10 + PEER_TEAM_BOX_HALF_M, 2 + PEER_TEAM_BOX_UP_M, -4 + PEER_TEAM_BOX_HALF_M]);
});

test('PERF-TEAMS the pool: a peer\'s team past the reach is marked far, draws nothing and stands no billboards; the near one draws; its word still eases, so it comes back where it stands; a far team walked into reach draws again', async () => {
  const { r, pool } = await poolWith();
  pool.frame(1 / 60, [0, 0, 0]);
  assert.equal(pool.peers.get('far').far, true);
  assert.equal(pool.peers.get('near').far, false);
  r.draws.length = 0;
  assert.equal(pool.draw(r), 2, 'mine and the near one');
  assert.ok(drawnNear(r.draws, 30, 30) && drawnNear(r.draws, 0, 0), 'both drawn');
  assert.equal(drawnNear(r.draws, 2000, 0, 50), false, 'nothing of the far one');
  assert.equal(pool.teamOf('far').length, 0, 'no horses stood for it');
  // its word moves while it is far: the ease follows, so it is not a leap when it comes back
  pool.applyOwner('far', { w: parkedAt(1800, 0), wk: 1 }, (q) => q, 1);
  for (let i = 0; i < 120; i++) pool.frame(1 / 60, [0, 0, 0]);
  assert.ok(Math.abs(pool.peers.get('far').shownWagon[0] - 1800) < 1, 'eased toward the word past the reach');
  // the eye walks to it: drawn again
  pool.frame(1 / 60, [1800, 0, 100]);
  assert.equal(pool.peers.get('far').far, false);
  r.draws.length = 0;
  pool.draw(r);
  assert.ok(drawnNear(r.draws, 1800, 0), 'the team drawn again where it stands');
});

test('PERF-TEAMS my own parked wagon a league off is not drawn; the travel view\'s grown world is never cut by the eye\'s distance; the window\'s view out takes no team past the reach', async () => {
  const { r, pool } = await poolWith();
  pool.frame(1 / 60, [3000, 0, 3000]);
  r.draws.length = 0;
  assert.equal(pool.draw(r), 0, 'mine and both peers past the reach');
  assert.equal(r.draws.length, 0);
  // the travel view: last pass drew grown, so the reach is not measured from its eye
  pool.draw(r, null, { selfGrow: 8, grow: () => 8 });
  pool.frame(1 / 60, [3000, 0, 3000]);
  assert.equal(pool.peers.get('far').far, false);
  assert.equal(pool.peers.get('near').far, false);
  // back on the ground, the window looks out on the street near me alone
  pool.draw(r);
  pool.frame(1 / 60, [0, 0, 0]);
  r.draws.length = 0;
  assert.equal(pool.drawOutside(r, null), 2, 'mine and the near one, not the far one');
});

test('PERF-TEAMS the host\'s view verdict: a wagon off screen is drawn nothing; one off screen in a shadow\'s reach is cast into the maps alone (what casts no shadow - a caravan\'s room - casts nothing); one in view is drawn; the box asked is the wagon\'s', async () => {
  const { r, pool } = await poolWith();
  pool.frame(1 / 60, [0, 0, 0]);
  const asked = [];
  const verdictBy = (v) => (box) => { asked.push([...box]); const cx = (box[0] + box[3]) / 2; return cx > 15 ? v : DECOR_DRAW; };
  r.draws.length = 0; r.casts.length = 0;
  assert.equal(pool.draw(r, null, {}, verdictBy(DECOR_SKIP)), 1, 'mine alone - the near one is off screen');
  assert.equal(drawnNear(r.draws, 30, 30), false);
  assert.equal(r.casts.length, 0);
  assert.ok(asked.some((b) => b[0] === 30 - PEER_TEAM_BOX_HALF_M && b[3] === 30 + PEER_TEAM_BOX_HALF_M), 'the near wagon\'s own box asked');
  assert.equal(asked.some((b) => b[0] > 1000), false, 'the far one is never asked - it was cut by the reach');
  r.draws.length = 0; r.casts.length = 0;
  assert.equal(pool.draw(r, null, {}, verdictBy(DECOR_SHADOW)), 1, 'a caster is no draw');
  assert.equal(drawnNear(r.draws, 30, 30), false, 'nothing of it on screen');
  assert.ok(r.casts.length > 0 && r.casts.every((c) => Math.hypot(c.m[12] - 30, c.m[14] - 30) < 20), 'its parts cast into the maps');
  // a caravan's room is drawn with no shadow - cast alone, it casts nothing
  const cr = fakeRenderer();
  const cpool = createHorseCartPool({ renderer: cr, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'caravan', bakedWagon: async (k) => bakeOf(k), peerAnchor: () => null });
  cpool.attach(runtimeOf({ isGrounded: true, position: [0, 1, 0], rotation: [0, 0, 0, 1], cargoTier: 0 }));
  cpool.partsOf('caravan'); await flush();
  cpool.frame(1 / 60, [0, 0, 0]);
  cr.draws.length = 0;
  cpool.draw(cr);
  const drawnRoom = cr.draws.filter((d) => d.o?.noShadow).length;
  assert.ok(drawnRoom >= 1, 'the room drawn in view');
  cr.draws.length = 0; cr.casts.length = 0;
  cpool.draw(cr, null, {}, () => DECOR_SHADOW);
  assert.equal(cr.draws.length, 0);
  assert.ok(cr.casts.length > 0, 'the body casts');
  assert.equal(cr.casts.some((c) => c.gpu?.model?.subMeshes?.length === 5), false, 'the room casts nothing');
  // no verdict at all: drawn, as before
  r.draws.length = 0;
  assert.equal(pool.draw(r), 2);
});

test('PERF-TEAMS the world host hands the pool its view test - the yards\' own (yardCull, EV3 and SHADOW-REACH\'s law)', () => {
  assert.match(src('scenes/world.js'), /hcc\.draw\(renderer, null, tvf \? \{ selfGrow: tvf\.grow, grow: peerGrow \} : undefined, yardCull\);/);
  assert.match(src('scenes/world.js'), /function yardCull\(box\) \{/);
});
