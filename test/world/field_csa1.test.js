// FIELD-CSA1 (2026-09-28, Discord, Julian: "in my case w the large deed specifically - first attempt just didn't spawn
// in the boat and the deed disappeared. i could hear ocean bout sounds as if i was on a boat in the background. lost the
// boat forever. second attempt, spawned in a large boat deed. it spawned in after a delay but i got killed by an ocean
// mob before i could climb onto it. also lost that boat forever after respawning"). The runtime's halves - the seabed
// hit floated, the sea plane held to the ray's reach, every boat riding every recentre, OnWorldReanchored - are pinned
// in csa_placing.test.js. This pins the host's: StreamingWorldState.init's own record of the move it made
// (`initOffset`), and world.js's csaReanchor - mounted from its source - called by _teleportToPixel after the init, so
// the respawn's teleport carries a placed boat by the frame's own move and it keeps its natives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StreamingWorldState } from '../../src/world/streamingWorld.js';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('FIELD-CSA1: StreamingWorldState.init records the move it made of every scene point - a point carried by it keeps its natives across any init, the vertical untouched', () => {
  const state = new StreamingWorldState(3);
  assert.deepEqual(state.initOffset, [0, 0, 0], 'none before the first');
  state.init(100, 200);
  // the player swam two pixels east of where the world was last inited, and once crossed a mountain
  state.update([819.2 * 1.5, 30, 400]);
  state.update([819.2 * 1.5, 30, 400]);
  assert.deepEqual(state.current, { x: 102, y: 200 });
  state.compensation[1] = -501;
  for (const [px, py] of [[62, 180], [62, 180], [400, 10], [102, 200]]) {
    const boat = [300.5, 34 - 501, 612.25];
    const natives = state.worldCoords(boat);
    state.init(px, py);
    for (let k = 0; k < 3; k++) boat[k] += state.initOffset[k];
    const now = state.worldCoords(boat);
    assert.ok(Math.abs(now.x - natives.x) < 1e-6 && Math.abs(now.z - natives.z) < 1e-6, `to ${px},${py}: the boat keeps its natives (${now.x}, ${now.z} vs ${natives.x}, ${natives.z})`);
    assert.equal(state.initOffset[1], 0, 'the vertical compensation survives init: nothing to carry up or down');
    assert.equal(state.compensation[1], -501);
  }
});

test('FIELD-CSA1: world.js carries every placed boat by that move - _teleportToPixel calls csaReanchor after the init (mounted: the runtime told, or the pool with the mod off; the peers and the colliders with it)', () => {
  const tp = WORLD.indexOf('  async function _teleportToPixel(');
  const init = WORLD.indexOf('    queue.push(...state.init(px, py));', tp);
  const call = WORLD.indexOf('    csaReanchor(state.initOffset);', tp);
  const first = WORLD.indexOf('awaitedBuild(first.px', tp);
  assert.ok(tp >= 0 && init > tp && call > init && first > call, 'after the init, before the first await');
  const start = WORLD.indexOf('  function csaReanchor(offset) {');
  assert.ok(start > 0, 'the helper');
  const src = WORLD.slice(start, WORLD.indexOf('\n  }\n', start) + 4);
  const run = (runtime) => {
    const said = { runtime: [], pool: [], peers: [], synced: 0 };
    const csaReanchor = new Function('csaRuntime', 'csaCall', 'csa', 'csaPeers', 'csaSyncColliders', `${src}\nreturn csaReanchor;`)(
      runtime ? { OnWorldReanchored: (o) => said.runtime.push(o) } : null, (fn) => fn(),
      { offsetAll: (o) => said.pool.push(o) }, { rebase: (o) => said.peers.push(o) }, () => { said.synced++; });
    csaReanchor([12, 0, -34]);
    return said;
  };
  assert.deepEqual(run(true), { runtime: [[12, 0, -34]], pool: [], peers: [[12, 0, -34]], synced: 1 });
  assert.deepEqual(run(false), { runtime: [], pool: [[12, 0, -34]], peers: [[12, 0, -34]], synced: 1 }, 'the mod off: the pool\'s own boats');
});
