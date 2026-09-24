// AUDIT 68 (2026-09-24), cluster "enemies": the whole-tree quality sweep
// over the enemy motor, attack and anims (src/characters), the enhanced
// motor and the nav bake (src/ai) and main.js. Each pin names the finding
// it holds and failed on the base commit before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { bakeNavFromCollider } from '../src/ai/navBake.js';
import { EnhancedEnemyAI, makeNavWorld } from '../src/ai/enhancedMotor.js';
import { EnemyAttack, resetMeleeTimer } from '../src/characters/enemyAttack.js';
import { setSeed } from '../src/formats/dfRandom.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** audit62's stacked room: a 16x12 hall with a mezzanine at y=3 over z
 *  4..12, a ramp up to it along the north wall, and a pillar that stands
 *  on the LOWER floor only. */
function stackedRoom() {
  const c = new Collider(() => -1000);
  const quad = (key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), QUAD, Id);
  quad('floor', [0, 0, 0], [16, 0, 0], [16, 0, 12], [0, 0, 12]);
  quad('n', [0, 0, 0], [16, 0, 0], [16, 6, 0], [0, 6, 0]); quad('s', [16, 0, 12], [0, 0, 12], [0, 6, 12], [16, 6, 12]);
  quad('w', [0, 0, 12], [0, 0, 0], [0, 6, 0], [0, 6, 12]); quad('e', [16, 0, 0], [16, 0, 12], [16, 6, 12], [16, 6, 0]);
  quad('mezz', [0, 3, 4], [16, 3, 4], [16, 3, 12], [0, 3, 12]); quad('ramp', [2, 0, 0], [8, 3, 0], [8, 3, 4], [2, 0, 4]); quad('land', [8, 3, 0], [16, 3, 0], [16, 3, 4], [8, 3, 4]);
  const box = (k, x0, x1, z0, z1, y0, y1) => { quad(k + 'a', [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad(k + 'b', [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]); quad(k + 'c', [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]); quad(k + 'd', [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]); };
  box('pillar', 7, 9, 6, 8, 0, 3);
  return c;
}

const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });

test('AUDIT 68 S02-motor-flat-y-locate: the enhanced motor routes a stacked floor on the levels its foe and target stand on', () => {
  // AUDIT 62 F1 made findPath's locate level-aware; the motor, its only
  // production caller, handed it y = 0 at both ends, so under a floor over
  // a floor both endpoints landed on the level nearest 0.
  const c = stackedRoom();
  const bake = bakeNavFromCollider(c, { anchor: [2, 0, 8] });
  const chase = (start, target) => {
    const world = makeNavWorld();
    const ai = new EnhancedEnemyAI(c, [...start], Math.PI / 2, { liveSpeed: 50, rolls: () => 0.5, nav: () => bake.chf, navWorld: world, navSeed: 7 });
    ai.makeHostileToPlayer();
    for (let n = 0; n < 240; n++) { world.pathBudget = world.budgetPerFrame; for (let i = 0; i < 4; i++) ai.update(1 / 60, target, senses(), false); }
    return ai;
  };
  const up = chase([1, 0, 2], [12, 3, 10]);
  assert.ok(up.feet[1] > 2.5, `a foe on the lower floor climbs the ramp to the target on the mezzanine (ends at y ${up.feet[1]})`);
  const down = chase([12, 3, 10], [4, 0, 7]);
  assert.ok(down.feet[1] < 0.5, `a foe on the mezzanine comes down to the target on the lower floor (ends at y ${down.feet[1]})`);
});

test('AUDIT 68 S04-rest-grounded-stale: a flyer paralyzed a SECOND time still falls, and a walker drops when Levitate ends', () => {
  // C11's rest fast path trusted a latch only the grounded branch wrote;
  // the hover and swim branches left it standing, so a foe that had once
  // rested on the floor skipped gravity the next time it came back to the
  // grounded branch while not moving.
  const floor = () => {
    const c = new Collider(() => -100);
    c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), QUAD, Id);
    return c;
  };
  const player = [0, 6, 8];
  const bat = new EnemyAI(floor(), [0, 5, 0], 0, { behaviour: 'Flying' });
  assert.equal(bat._restGrounded, false, 'the latch is declared, not undefined');
  for (let i = 0; i < 180; i++) bat.update(1 / 60, [0, 0, 500], null, true);
  assert.ok(bat.feet[1] < 0.1, `the first paralysis drops it (y ${bat.feet[1]})`);
  for (let i = 0; i < 600 && bat.feet[1] <= 3; i++) bat.update(1 / 60, player, null, false);
  assert.ok(bat.feet[1] > 3, 'it flew back up under its own power');
  for (let i = 0; i < 180; i++) bat.update(1 / 60, player, null, true);
  assert.ok(bat.feet[1] < 0.1, `the second paralysis drops it too (y ${bat.feet[1]})`);
  const walker = new EnemyAI(floor(), [0, 0, 0], 0, {});
  for (let i = 0; i < 60; i++) walker.update(1 / 60, player, null, true);
  assert.equal(walker._restGrounded, true, 'precondition: it rested on the floor');
  walker.levitating = true;
  for (let i = 0; i < 600 && walker.feet[1] <= 2.5; i++) walker.update(1 / 60, player, null, false);
  assert.ok(walker.feet[1] > 2.5, 'Levitate carried it up');
  walker.levitating = false;
  for (let i = 0; i < 180; i++) walker.update(1 / 60, player, null, true);
  assert.ok(walker.feet[1] < 0.1, `Levitate ended and it fell (y ${walker.feet[1]})`);
});

test('AUDIT 68 S04-strike-edge-cut: a melee strike that cuts a bow release is a swing START the hosts see', () => {
  // The hosts inferred a swing's start from machine.state going Idle ->
  // strike across frames; the mid-release cut goes strike -> strike inside
  // one update(), so the second swing had no sound, no wire count and no
  // sprite strike (the mobile played the bow on and loosed its arrow).
  const a = new EnemyAttack({ liveSpeed: 50, rolls: () => 0.001 });
  a.rangedAttack = true;
  setSeed(12345);
  const ai = { _dist: 10, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200, canAct: true };
  let latched = 0, edges = 0;
  const frame = (target) => { a.update(1 / 60, ai, target); if (a.swingSeq !== latched) { edges++; latched = a.swingSeq; } };
  for (let i = 0; i < 600 && a.machine.state === 'Idle'; i++) frame([0, 0, 10]);
  assert.equal(a.firedRanged, true, 'the bow loosed');
  assert.equal(edges, 1, 'one swing, one edge');
  ai._dist = 2;
  for (let i = 0; i < 60 && a.firedRanged; i++) frame([0, 0, 2]);
  assert.equal(a.firedRanged, false, 'the melee decision cut the release');
  assert.notEqual(a.machine.state, 'Idle', 'and started its strike in the same update');
  assert.equal(edges, 2, 'two swings started, two edges');
  // the three hosts read that count, not a state edge
  for (const [file, re] of [
    ['src/scenes/dungeonContext.js', /const _seq = f\.attack\.swingSeq;[^\n]*\n\s*_strikeEdge = _seq !== \(f\._swingSeq \?\? 0\);\s*f\._swingSeq = _seq;/],
    ['src/scenes/exteriorFoes.js', /const seq = f\.attack\.swingSeq;[^\n]*\n\s*const strikeEdge = seq !== f\._swingSeq;\s*f\._swingSeq = seq;/],
    ['src/scenes/cityGuards.js', /const seq = g\.attack\.swingSeq;[^\n]*\n\s*const strikeEdge = seq !== g\._swingSeq;\s*g\._swingSeq = seq;/],
  ]) {
    const s = rd(file);
    assert.match(s, re, `${file} takes its strike edge from EnemyAttack's start count`);
    assert.ok(!/_prevMState/.test(s), `${file} keeps no state-edge latch`);
  }
});

test('AUDIT 68 S04-melee-timer-stale-level: ResetMeleeTimer reads the player level live', () => {
  // EnemyAttack.cs:117 reads PlayerEntity.Level on every reset; the port
  // froze the level at spawn, so a player who levelled up in a dungeon
  // fought its foes on the old timer.
  let lvl = 10;
  const a = new EnemyAttack({ liveSpeed: 200, playerLevel: () => lvl, reflexes: 2, rolls: () => 0.5 });
  a.meleeTimer = 0;
  setSeed(11);
  lvl = 20;
  const ai = { _dist: 1, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200 };
  for (let i = 0; i < 60 && a.meleeTimer === 0; i++) a.update(1 / 16, ai, [0, 0, 2]);
  assert.equal(a.meleeTimer, resetMeleeTimer(20, 2, 0.5), 'the reset used the level of the moment');
  assert.equal(a.playerLevel, 20, 'and EnemyCaster\'s touch reset reads the same live value');
  // every host hands the live read, never the spawn-time number
  const sites = [['src/scenes/dungeonContext.js', 2, /playerLevel: \(\) => D\.playerEntity\.level, reflexes: D\.playerEntity\.reflexes/g],
    ['src/scenes/exteriorFoes.js', 1, /new EnemyAttack\(\{[^\n]*playerLevel: \(\) => playerEntity\.level, reflexes: playerEntity\.reflexes/g],
    ['src/scenes/cityGuards.js', 1, /new EnemyAttack\(\{[^\n]*playerLevel: \(\) => playerEntity\.level, reflexes: playerEntity\.reflexes/g]];
  for (const [file, n, re] of sites) assert.equal((rd(file).match(re) ?? []).length, n, `${file} passes playerLevel as a thunk`);
});

/** The brace-balanced statement starting at `needle` in `src`. */
function statementAt(src, needle) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `no ${needle}`);
  let depth = 0, opened = false;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--;
    if (opened && depth === 0) return src.slice(at, src[i + 1] === ')' ? src.indexOf(';', i) + 1 : i + 1);
  }
  assert.fail(`unbalanced at ${needle}`);
  return '';
}

test('AUDIT 68 S02-contextlost-tap-dead: the lost-context report takes the tap it promises, and reloads once', () => {
  // main.js touches the DOM at import, so its crashOverlay and the
  // context-lost handler run here against a minimal document. PL3 gave
  // #crash pointer-events:none, so the "tap here to reload" fell through
  // to the dead canvas; and each loss stacked another click listener.
  const main = rd('src/main.js');
  const code = statementAt(main, 'function crashOverlay(msg) {') + '\n'
    + statementAt(main, "document.getElementById('c')?.addEventListener('webglcontextlost'");
  const els = new Map();
  let lost = null, reloads = 0;
  const canvas = { addEventListener: (ev, fn) => { if (ev === 'webglcontextlost') lost = fn; } };
  const document = {
    getElementById: (id) => (id === 'c' ? canvas : els.get(id) ?? null),
    createElement: () => ({ style: {}, clicks: [], addEventListener(ev, fn) { if (ev === 'click') this.clicks.push(fn); } }),
    body: { appendChild: (el) => els.set(el.id, el) },
  };
  new Function('document', 'location', code)(document, { reload: () => reloads++ });
  assert.equal(typeof lost, 'function', 'the handler is registered on the canvas');
  lost({ preventDefault() {} });
  lost({ preventDefault() {} });   // a phone can lose it twice
  const el = els.get('crash');
  assert.match(el.textContent, /tap here to reload/);
  // a tap reaches the element only when its computed pointer-events is not none
  const pe = el.style.pointerEvents || /pointer-events:\s*([a-z]+)/.exec(el.style.cssText ?? '')?.[1];
  if (pe !== 'none') { el.onclick?.(); for (const fn of el.clicks) fn(); }
  assert.equal(reloads, 1, 'one tap, one reload');
});

test('AUDIT 68 S02-surfh-linear-scan: a route\'s heights read only the boxes under its points, and answer as the full scan did', async () => {
  // surfH/surfHNear scanned every collider per query: each waypoint of
  // every findPath cost O(colliders) - 66k-400k boxes on a real soup.
  const { findPath, polyHeight } = await import('../src/ai/navmesh.js');
  const chf = bakeNavFromCollider(stackedRoom(), { anchor: [2, 0, 8] }).chf;
  const boxes = chf.colliders;
  // the law, spelled out: the tallest covering top, else the ground
  const tallest = (x, z) => {
    let y = -Infinity;
    for (const c of boxes) if (!c.rayOnly && !(x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1)) y = Math.max(y, c.top);
    return y === -Infinity ? chf.ground.at(x, z) : Math.max(y, chf.ground.at(x, z));
  };
  for (let x = -0.5; x <= 16.5; x += 0.125) for (let z = -0.5; z <= 12.5; z += 0.375) {
    assert.equal(polyHeight(chf, -1, x, z), tallest(x, z), `the height at (${x}, ${z})`);
  }
  let reads = 0;
  chf.colliders = boxes.map((c) => new Proxy(c, { get(t, k) { if (k === 'x0') reads++; return t[k]; } }));
  const route = () => findPath(chf, [1, 0, 2], [12, 3, 10]);
  const warm = route();
  assert.ok(warm && warm.length >= 3, 'a route with corners');
  reads = 0;
  assert.deepEqual(route(), warm);
  assert.ok(reads < chf.colliders.length, `a whole route read ${reads} boxes of ${chf.colliders.length}`);
});

/** A worker double that runs the REAL navWorker module: each posted job
 *  reaches its onmessage, each reply comes back through `onReply` first. */
async function realWorker(onReply = () => {}) {
  await import('../src/ai/navWorker.js');
  const handler = globalThis.onmessage;
  const posted = [];
  class RealWorker {
    constructor() { this.onmessage = null; this.onerror = null; }
    postMessage(m) {
      posted.push(m.t);
      setTimeout(() => {
        globalThis.postMessage = (reply) => { onReply(reply); this.onmessage?.({ data: reply }); };
        try { handler({ data: m }); } finally { delete globalThis.postMessage; }
      }, 0);
    }
    terminate() {}
  }
  return { RealWorker, posted };
}

/** The 3b room at y = -5, as a Collider. */
function roomAtMinus5() {
  const P = [], I = []; const Y = -5;
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  quad([0, Y, 0], [10, Y, 0], [10, Y, 10], [0, Y, 10]);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) quad([a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y + 3, b[1]], [a[0], Y + 3, a[1]]);
  const collider = new Collider(() => -Infinity);
  collider.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);
  return collider;
}

test('AUDIT 68 S02-hydrate-main-thread-revoxelize: the client hydrates over the boxes the worker shipped, on a bake and on a cache hit', async () => {
  // hydrateHere re-voxelised the whole soup on the main thread after
  // every worker bake and on every cache hit (0.25-1.1 s mid-dungeon),
  // rebuilding boxes the worker had just cut. The shipped set is marked
  // here (every top +100) so the hydrated height layer shows whose boxes
  // it reads.
  const { NavClient } = await import('../src/ai/navClient.js');
  let shipped = null;
  const { RealWorker, posted } = await realWorker((reply) => {
    if (!reply.cols) return;
    for (let i = 0; i < reply.cols.noNavTop.length; i++) reply.cols.box[i * 6 + 4] += 100;
    shipped = Array.from({ length: reply.cols.noNavTop.length }, (_, i) => reply.cols.box[i * 6 + 4]);
  });
  const mem = new Map(); const store = { async get(k) { return mem.get(k) ?? null; }, async set(k, v) { mem.set(k, v); } };
  const client = new NavClient({ store, WorkerCtor: RealWorker });
  const collider = roomAtMinus5();
  const a = await client.bake({ collider, anchor: [1, -5, 5], key: 'dungeon:a68' });
  assert.ok(a && !a.cached && a.stats.polys > 0, 'the worker baked it');
  assert.deepEqual(posted, ['bake']);
  assert.ok(shipped && shipped.length > 0, 'the worker shipped its boxes');
  assert.deepEqual(a.chf.colliders.map((c) => c.top), shipped, 'the hydrated height layer is the worker\'s set, not a main-thread re-cut');
  shipped = null;
  const b = await client.bake({ collider, anchor: [1, -5, 5], key: 'dungeon:a68' });
  assert.ok(b.cached, 'a cache hit');
  assert.deepEqual(posted, ['bake', 'cols'], 'the hit asks the worker for its boxes');
  assert.deepEqual(b.chf.colliders.map((c) => c.top), shipped, 'and hydrates over them');
  client.dispose();
});

test('AUDIT 68 S02-bake-pipeline-triplicated: the worker, the fallback and navBake answer one stats shape, ms included', async () => {
  // Three hand-copies of the pipeline had drifted: bakeHere carried no ms
  // or cells (the host logged "undefinedms" on every fallback bake) and
  // the worker no tris.
  const { bakeHere } = await import('../src/ai/navClient.js');
  const { navInputFromCollider } = await import('../src/ai/navBake.js');
  const collider = roomAtMinus5();
  const want = Object.keys(bakeNavFromCollider(collider, { anchor: [1, -5, 5] }).stats).sort();
  assert.deepEqual(want, ['boxes', 'cells', 'cs', 'ms', 'polys', 'tris']);
  const here = bakeHere(navInputFromCollider(collider), [1, -5, 5]).stats;
  assert.deepEqual(Object.keys(here).sort(), want, 'the main-thread fallback');
  assert.equal(typeof here.ms, 'number');
  let fromWorker = null;
  const { RealWorker } = await realWorker((reply) => { if (reply.t === 'baked') fromWorker = reply.stats; });
  const { NavClient } = await import('../src/ai/navClient.js');
  const client = new NavClient({ store: null, WorkerCtor: RealWorker });
  await client.bake({ collider, anchor: [1, -5, 5], key: 'dungeon:a68s' });
  assert.deepEqual(Object.keys(fromWorker ?? {}).sort(), want, 'the worker');
  client.dispose();
});

test('AUDIT 68 S02-coarsen-sizing-pass: the grid is sized from the soup\'s bounds, and the soup is voxelised once', async () => {
  // coarsenAgent reads only the boxes' xz extent, and that extent is the
  // soup's bounds snapped to cells: the fine first pass every bake cut
  // only to measure it (~2 s on a large dungeon) carried nothing more.
  const { soupExtent, trianglesToColliders } = await import('../src/ai/triRaster.js');
  const { coarsenAgent, AGENT } = await import('../src/ai/navmesh.js');
  let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const span of [30, 400]) {
    const P = [], I = [];
    for (let t = 0; t < 300; t++) {
      const cx = (rnd() - 0.5) * span, cz = (rnd() - 0.5) * span;
      for (let k = 0; k < 3; k++) { P.push(cx + (rnd() - 0.5) * 4, (rnd() - 0.5) * 3, cz + (rnd() - 0.5) * 4); I.push(t * 3 + k); }
    }
    P.push(-900, 0, -900, -900, 0, -900, -900, 0, -900); I.push(900, 901, 902);   // a zero-area triangle far off: it cuts no box
    const cols = trianglesToColliders(P, I, { cs: AGENT.cs });
    const ext = (cs) => cs.reduce((e, c) => [Math.min(e[0], c.x0), Math.max(e[1], c.x1), Math.min(e[2], c.z0), Math.max(e[3], c.z1)], [Infinity, -Infinity, Infinity, -Infinity]);
    assert.deepEqual(ext(soupExtent(P, I, AGENT.cs)), ext(cols), `span ${span}: the voxeliser's own extent`);
    assert.deepEqual(coarsenAgent(soupExtent(P, I, AGENT.cs), AGENT), coarsenAgent(cols, AGENT), `span ${span}: the same cell size`);
  }
  const nb = rd('src/ai/navBake.js'), at = nb.indexOf('export function bakeSoup(');
  assert.ok(at > 0, 'the one bake core');
  const core = nb.slice(at, nb.indexOf('\n}\n', at));
  assert.equal((core.match(/trianglesToColliders\(/g) ?? []).length, 1, 'the bake voxelises the soup once');
});
