// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster "worldmodes"
// (S23, src/scenes/worldModes.js): the mode host's door transitions (a
// failed entry that left its latches, a build published after the world
// moved, a forced exit the ambience never heard), the summoning
// punishment that stood nowhere outside a building, and three host doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStaticDoors } from '../src/world/staticDoors.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const WM = rd('src/scenes/worldModes.js');
const slice = (src, from, to) => {
  const i = src.indexOf(from);
  assert.ok(i >= 0, `${from} not found`);
  const j = src.indexOf(to, i + from.length);
  assert.ok(j > i, `${to} not found after ${from}`);
  return src.slice(i, j);
};

/** The mode machine over a stub host - the shape S23's verifier drove it
 *  with. worldModes reaches the browser at import (art preloads, the
 *  window seams), so the globals it touches are stood first. */
async function buildModes(overrides = {}) {
  const noop = () => {};
  const deep = () => new Proxy(function () {}, {
    get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()),
    apply: () => deep(),
    construct: () => deep(),
  });
  globalThis.addEventListener ??= noop;
  globalThis.removeEventListener ??= noop;
  globalThis.fetch = async () => { throw new Error('no ARENA2 in this test'); };
  const { createWorldModes } = await import('../src/scenes/worldModes.js');
  globalThis.window = globalThis;
  const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const player = { pos: [0, 0, 0], eye: [0, 1.6, 0], height: 1.8, eyeAt: () => [0, 1.6, 0], feetAt: () => [0, 0, 0], spawn: noop, collider: null };
  return createWorldModes({
    canvas, renderer: deep(), player, cam: { yaw: 0, pitch: 0, pos: [0, 1.6, 0] }, keys: new Set(), latch: { edge: deep() },
    blocks: null,
    pipeline: { getGpuMesh: async () => null, cpuModels: new Map(), getTexture: async () => null, uploadRecord: noop, uploadRecordFrame: noop, arch: null, palette: null, getMachineryParts: noop },
    doorTargets: () => [], baseCollider: () => ({ raycast: () => Infinity, heightAt: () => 0 }),
    ...overrides,
  });
}

/** One building door as the layout mints it (GetStaticDoors over a
 *  model's door array), the entry the host's doorTargets carries, and
 *  the save's IS1 identity for it (interiorIdentity's two fields). */
function tavernDoor() {
  const matrix = new Float32Array(16); matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
  const [door] = getStaticDoors({ doors: [{ type: 0, index: 0, vert0: { x: -0.5, y: 0, z: 0 }, vert2: { x: 0.5, y: 2, z: 0.2 }, normal: { x: 0, y: 0, z: 1 } }] }, 7, 2, matrix);
  const dfBlock = { index: 7, name: 'TVRNAL01.RMB', rmbBlock: { subRecords: [{}, {}, { interior: { block3dObjectRecords: [{ modelIdNum: 42 }] } }] } };
  const entry = { door, dfBlock, recordIndex: 2, climateBase: 0, season: 0, dfLocation: null, group: 'g' };
  const saved = {
    door: { blockIndex: door.blockIndex, recordIndex: door.recordIndex, doorIndex: door.doorIndex, buildingKey: 7 },
    building: { buildingKey: 7, buildingType: BUILDING_TYPES.Tavern, regionIndex: 0, quality: 10, factionId: 0, nameSeed: 1 },
  };
  return { entry, saved };
}

test('AUDIT 68 S23-failed-entry-stale-building: an entry whose build fails commits no building and no latch', async () => {
  // The tavern's interior build rejects at its first model fetch - the
  // ARENA2 fetch failure the finding names. The player stays outside,
  // and the host must not go on naming the tavern: the party-rest vote,
  // the talk layer and openStaticNpc read these outdoors.
  const { entry, saved } = tavernDoor();
  const modes = await buildModes({
    doorTargets: () => [entry],
    pipeline: { getGpuMesh: async () => { throw new Error('fetch failed'); }, cpuModels: new Map(), getTexture: async () => null, uploadRecord: () => {}, uploadRecordFrame: () => {}, arch: null, palette: null, getMachineryParts: () => {} },
  });
  const err = console.error; console.error = () => {};
  let ok;
  try { ok = await modes.restoreInterior(saved, [0, 0, 0]); } finally { console.error = err; }
  assert.equal(ok, false, 'the refused entry answers false');
  assert.equal(modes.mode, 'exterior');
  assert.equal(modes.interiorBuilding, null, 'no building is named by an entry that never happened');
  assert.equal(modes.insideTavern, false);
  assert.equal(modes.insidePartyRestExempt, false, 'the party-rest vote is not switched off in the street');
  // ...by construction: every write of the four sits below the landing test
  const core = slice(WM, 'async function interiorTransition(', 'function tryExit(');
  const landingAt = core.indexOf("if (!landing) { abandonContext(ctx); throw new Error('no interior landing'); }");
  assert.ok(landingAt > 0);
  for (const re of [/\binteriorBuilding = /g, /\b_insideTavern = /g, /\b_insideResidence = /g, /\b_insidePartyRestExempt = /g]) {
    for (const m of core.matchAll(re)) assert.ok(m.index > landingAt, `${re} is written before the entry can fail`);
  }
});

test('AUDIT 68 X3-transition-build-race: the gate runs one build at a time and a moved world stales the pending one', async () => {
  const { createTransitionGate } = await import('../src/scenes/transitionGate.js');
  const gate = createTransitionGate();
  const t1 = await gate.begin();
  assert.equal(gate.valid(t1), true);
  // a second request WAITS for the first to unwind - never overlaps it
  let second = null;
  const p2 = gate.begin().then((t) => { second = t; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(second, null, 'the second build started while the first held the gate');
  gate.abort();
  assert.equal(gate.valid(t1), false, 'a build the world moved under is stale');
  gate.end();
  await p2;
  assert.equal(second, null, 'a request taken before the world moved never holds the gate');
  await gate.settled();
  const t3 = await gate.begin();
  assert.equal(gate.valid(t3), true, 'a request after the move runs');
  gate.end();
});

test('AUDIT 68 X3-transition-build-race: the mode host serializes its door builds and a teleport or load abandons the pending one', async () => {
  // Driven through the host: the first restore's build hangs at its
  // model fetch while a second is asked for; the host moves the world
  // (the teleport's abortTransition); the first fails, and neither the
  // stale second request nor the first ever publishes.
  const { entry, saved } = tavernDoor();
  let fetches = 0;
  let fail = null;
  const modes = await buildModes({
    doorTargets: () => [entry],
    pipeline: { getGpuMesh: () => { fetches++; return new Promise((_, rej) => { fail = rej; }); }, cpuModels: new Map(), getTexture: async () => null, uploadRecord: () => {}, uploadRecordFrame: () => {}, arch: null, palette: null, getMachineryParts: () => {} },
  });
  const err = console.error; console.error = () => {};
  try {
    const first = modes.restoreInterior(saved, [0, 0, 0]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(fetches, 1, 'the first build is in flight');
    const second = modes.restoreInterior(saved, [0, 0, 0]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(fetches, 1, 'the second build waits its turn instead of overlapping the first');
    modes.abortTransition();
    fail(new Error('fetch failed'));
    assert.equal(await first, false);
    assert.equal(await second, false);
    assert.equal(fetches, 1, 'the request made before the world moved is never built');
    await modes.transitionSettled();
    assert.equal(modes.transitioning, false);
    assert.equal(modes.mode, 'exterior');
  } finally { console.error = err; }
});

test('AUDIT 68 X3-transition-build-race: every door build is re-validated before it publishes, and the world movers abort it', () => {
  const interior = slice(WM, 'const ctx = await buildInteriorContext(', 'interiorCtx = ctx;');
  assert.match(interior, /if \(!live\(\)\) \{ abandonContext\(ctx\); return false; \}/, 'the building build checks it is still wanted');
  const dungeon = slice(WM, 'const ctx = await buildDungeonContext(', 'dungeonCtx = ctx;');
  assert.match(dungeon, /if \(!live\(\)\) \{ abandonContext\(ctx\); return false; \}/, 'and so does the dungeon build');
  assert.match(WM, /async function enterInteriorCore\(hit, entries, restore = null\) \{\s*return gatedTransition\(/);
  assert.match(WM, /async function tryEnterDungeon\(hit, entries, \{ preferEnterMarker = false \} = \{\}\) \{\s*return gatedTransition\(/);
  assert.match(slice(WM, 'forceExitToExterior({ cacheScene = true } = {}) {', 'const wasInside'), /transitionGate\.abort\(\);/, 'the forced exit abandons a pending build');
  const w = rd('src/scenes/world.js');
  assert.match(slice(w, 'async function _teleportToPixel(', 'refreshSeason('), /modes\?\.abortTransition\?\.\(\);/, 'every teleport, travel, recall and load landing moves the world');
  const load = slice(w, 'async function worldQuickLoad(', 'const extras = restorePlayer(');
  assert.match(load, /modes\?\.abortTransition\?\.\(\);\s*await modes\?\.transitionSettled\?\.\(\);/, 'the load waits for an abandoned build to unwind before it reads the save');
});

test('AUDIT 68 S23-dungeon-commit-before-await: nothing fallible is awaited between publishing the dungeon and its marker test', () => {
  const tail = slice(WM, '      dungeonCtx = ctx;\n', 'if (!spawn) {');
  assert.doesNotMatch(tail, /\bawait\b/, 'a rejection there leaves the built context published and its seams installed');
  const head = slice(WM, 'async function dungeonTransition(', 'const ctx = await buildDungeonContext(');
  assert.match(head, /const waterArchive = getGroundArchive\(hit\.climateBase, hit\.season\);\s*await getTexture\(waterArchive\);/, 'the water tile is fetched before anything is built');
});

test('AUDIT 68 X3-ba-forceexit-rain: the forced exit raises the exterior transition both real doors raise', () => {
  const force = slice(WM, 'forceExitToExterior({ cacheScene = true } = {}) {', 'get interiorCollider()');
  const tail = force.slice(force.indexOf('AUDIT 63r F30'));
  assert.match(tail, /if \(wasInside\) \{\s*immersiveFootsteps\.onTransitionExterior\(\);\s*betterAmbience\.onTransition\(null\);\s*\}/,
    'a Recall, a quest teleport or a load out of a building left the indoor rain loop playing in the street');
});

test('AUDIT 68 S23-liveQuestFoes-interior-empty: the quest-foe walk answers the building\'s pool too', () => {
  const body = slice(WM, 'liveQuestFoes() {', 'spawnCityGuardsInside(immediate) {');
  assert.match(body, /if \(mode === 'interior'\) return interiorEnemyDatabase\(\)\.filter\(\(f\) => f\.questBehaviour\);/);
  assert.doesNotMatch(body, /if \(mode !== 'dungeon' \|\| !dungeonCtx\) return \[\];/, 'the empty interior arm is gone');
});

test('AUDIT 68 S23-coven-punishment-interior-only: the daedric punishment stands through the host\'s mode-routed stand', () => {
  const body = slice(WM, 'function spawnDaedricPunishment(', 'return stood;');
  assert.doesNotMatch(body, /interiorCtx|interiorFoes/, 'the wave no longer needs a building mounted - a coven\'s popup is never in one');
  assert.match(body, /const stand = host\.standLooseFoe;/);
  assert.match(body, /if \(stand\(type, \{ minDistance, maxDistance \}\)\) stood\+\+;/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const bag = slice(rd(f), 'var modes = createWorldModes({', '\n  });\n');
    assert.match(bag, /standLooseFoe: \(mobileType, opts\) => _standLooseFoe\(mobileType, opts\),/, `${f} hands its stand down`);
  }
});

test('AUDIT 68 S23-custom-merchant-null-trade: every trade window the host opens is null-checked before it is mounted', () => {
  // createTradeWindow answers null for a transformed lycanthrope (DISC10-E
  // L3, it says so itself); the RR3 custom merchant's Buy door wrote
  // `win.hooks` on that null and threw inside the click.
  const unguarded = [];
  for (const m of WM.matchAll(/(\w+) = openTradeWindow\(/g)) {
    const name = m[1];
    const after = WM.slice(m.index, m.index + 300);
    if (!(after.includes(`if (!${name})`) || after.includes(`${name} ?? DOOR_REFUSED`) || after.includes(`return ${name} ?`))) unguarded.push(`${name} at ${WM.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(unguarded, []);
});

test('AUDIT 68 S23-dungeon-npc-behaviours-not-destroyed: the dungeon exit destroys its people\'s quest behaviours, as the interior exit does', () => {
  assert.match(WM, /function teardownDungeonQuestFlats\(\) \{\s*teardownStands\(dungeonQuestFlats, dungeonCtx\?\.people\);/);
  assert.match(WM, /function teardownQuestFlats\(\) \{\s*teardownStands\(questFlats, interiorCtx\?\.people\);/);
  assert.match(slice(WM, 'function teardownStands(', 'function teardownDungeonQuestFlats('), /destroyPeopleBehaviours\(people\);/);
});
