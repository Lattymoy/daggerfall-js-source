// MEM-AUDIT (2026-10-23, the owner: "a comprehensive performance audit, looking for memory leaks"): what a place, a map
// pixel, a menu or a session online left standing after its life (bible/07-Rendering/Performance-Priority.md MEM-AUDIT).
// Each pin drives the module that owned the leak; where the owner is a host's or a window's wiring (setMode, the menu's
// account card and foot, the item menu's timer, the classic sky's bound) it reads that one line. Each names its mutants
// (tools/mutants/memaudit.json). AUDIT MEM-AUDIT (01-Overview/audits/Audit-Mem-Audit.md) widened them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';
import { StaticBatchBuilder, keyResolver } from '../../src/render/staticBatch.js';
import { createCoverIndex, coverProxy, coverProxies, CELL_EXACT, COVER_CELL } from '../../src/ai/cover.js';
import { flatBodies, jungleBody } from '../../src/world/propBodies.js';
import { jungleCover } from '../../src/world/jungle/jungleModels.js';
import { trs } from '../../src/world/mat4.js';
import { SnowCoverage } from '../../src/systems/snowfall.js';
import { SnowfallRuntime } from '../../src/systems/snowfallRuntime.js';
import { snowPixelBox } from '../../src/scenes/snowfallHost.js';
import { drawPixelGround } from '../../src/ui/pixelGround.js';
import { createMarketBook, MARKET_CACHE_KEPT, MARKET_CACHE_MS } from '../../src/net/marketBook.js';
import { hostText } from '../hostText.mjs';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { fishKind } from '../../src/scenes/fishHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { WORLD_MAP_TILE_DIM } from '../../src/world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';

const rd = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// ─── THE STATIC BATCH ────────────────────────────────────────────────

function quad() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: 7, textureRecord: 1, startIndex: 0, primitiveCount: 2 }],
  };
}

test('MEM-AUDIT the static batch: the merge spends its inputs - the builder a host\'s build scope keeps holds no model\'s copy once merged, sliced or whole, and the mesh is the same (mutant: the inputs kept)', async () => {
  for (const sliced of [false, true]) {
    const b = new StaticBatchBuilder();
    for (let i = 0; i < 3; i++) b.add(quad(), trs(i * 10, 0, 0, 0, 0, 0), keyResolver(new Map()));
    assert.equal(b.chunks.length, 3);
    const m = sliced ? await b.finishSliced(async () => {}) : b.finish();
    assert.deepEqual([m.vertexCount, m.triangles, m.models], [12, 6, 3], 'the mesh is every model\'s');
    assert.deepEqual(Array.from(m.positions.slice(24, 27)), [20, 0, 0], 'the third model where it stood');
    assert.deepEqual([b.chunks.length, b.groups.size, b.vertexCount, b.triangles, b.models], [0, 0, 0, 0, 0], `${sliced ? 'sliced' : 'whole'}: spent`);
    assert.equal(b.finish(), null, 'a second merge is an empty builder\'s');
  }
});

// ─── THE COVER INDEX ─────────────────────────────────────────────────

test('MEM-AUDIT the cover index: a cell is held at its size while small - the same proxies in the same order as the pushes filed them, on every grid (the cover\'s, the bodies\', the wide); a cell copied one longer below CELL_EXACT and pushed past it; a cell of one proxy at its size; every proxy born with its mark, last of its keys (AUDIT C1/C2, P4) (mutants: a cell pushed from its first, the order turned, a grid pushed, a maker without the mark)', () => {
  const idx = createCoverIndex({ enabled: () => true });
  const set = idx.staged();
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const items = [];
  for (let i = 0; i < 4000; i++) items.push(...coverProxies([rnd() * 300, 0, rnd() * 300], { w: 1 + rnd() * 8, h: 3 + rnd() * 9 }, { tree: rnd() < 0.5 }));
  for (let i = 0; i < 60; i++) items.push(coverProxy([150 + rnd(), 0, 150 + rnd()], { w: 2, h: 2 }));   // one crowded corner: cells past CELL_EXACT
  for (let i = 0; i < 400; i++) items.push(...jungleCover([rnd() * 300, 0, rnd() * 300], 0, 1 + rnd()));   // the wide grid's: crowns past a cell
  for (let i = 0; i < 40; i++) items.push(...jungleCover([40 + rnd() * 4, 0, 40 + rnd() * 4], 0, 1));   // a wide cell past CELL_EXACT
  const bodies = [...flatBodies(null, 504, 3, { w: 3, h: 9 }, items.slice(0, 500).map((p) => p.c), { tree: true }), ...Array.from({ length: 40 }, () => jungleBody([60 + rnd(), 0, 60 + rnd()], 0, 1))];
  assert.ok(items.some((p) => p.r > COVER_CELL), 'wide proxies among them');
  // the pushes' own grids, restated: every cell its proxies in the order they were filed
  const key = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);
  const file = (m, k, it) => { let c = m.get(k); if (!c) m.set(k, c = []); c.push(it); };
  const ref = { grid: new Map(), wide: new Map(), bodies: new Map() };
  const order = [...items, ...bodies].map((it) => [rnd(), it]).sort((a, b) => a[0] - b[0]).map(([, it]) => it);
  for (const it of order) {
    const [x, , z] = it.c;
    if (!it.body && it.r > COVER_CELL) { file(ref.wide, key(Math.floor(x / 32), Math.floor(z / 32)), it); continue; }
    const m = it.body ? ref.bodies : ref.grid;
    for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++) file(m, key(gx, gz), it);
  }
  const tally = { grid: [0, 0], wide: [0, 0], bodies: [0, 0] };
  const all = order;   // seeded: every grid grows across slices
  for (let i = 0; i < all.length; i += 997) {   // filled a slice at a time, as a streamed pixel's is
    const before = Object.fromEntries(Object.keys(tally).map((g) => [g, new Map([...set[g]].map(([k, c]) => [k, [c, c.length]]))]));
    idx.fill(set, all.slice(i, i + 997));
    for (const g of Object.keys(tally)) {
      for (const [k, [was, n]] of before[g]) {
        const now = set[g].get(k);
        if (now.length === n) continue;
        if (n < CELL_EXACT) { assert.notEqual(now, was, `${g}: a small cell grown is a new array, its own size`); tally[g][0]++; } else { assert.equal(now, was, `${g}: a cell past CELL_EXACT is pushed`); tally[g][1]++; }
      }
    }
  }
  for (const g of Object.keys(ref)) {
    assert.deepEqual([...set[g].keys()].sort((a, b) => a - b), [...ref[g].keys()].sort((a, b) => a - b), `${g}: the same cells`);
    for (const [k, c] of ref[g]) assert.deepEqual(set[g].get(k), c, `${g}: each its proxies, in the order filed`);
  }
  for (const g of ['grid', 'wide']) assert.ok(tally[g][0] > 0 && tally[g][1] > 0, `${g}: both arms met (${tally[g]})`);
  assert.ok(tally.bodies[0] > 0, `bodies: copied (${tally.bodies})`);
  // every maker, fresh (`fill` marks what it files), the same keys in the same order - one shape for the ray's loop
  const COVER_KEYS = ['c', 'r', 'h', 'lift', '_mark'], BODY_KEYS = ['c', 'r', 'h', 'lift', 'body', '_mark'];
  for (const p of [coverProxy([0, 0, 0], { w: 2, h: 2 }), ...coverProxies([0, 0, 0], { w: 2, h: 9 }, { tree: true }), ...jungleCover([0, 0, 0], 0, 1)]) assert.deepEqual(Object.keys(p), COVER_KEYS, 'a cover proxy');
  for (const p of [...flatBodies(null, 504, 3, { w: 3, h: 9 }, [[0, 0, 0]], { tree: true }), jungleBody([0, 0, 0], 0, 1)]) assert.deepEqual(Object.keys(p), BODY_KEYS, 'a body');
  // a cell of one proxy at its size: measured on the heap - 100,000 cells of one, each its own - in the measuring child
  // (ALLOC-RACE: test/allocChild.mjs, the one home of its flags)
  const script = `
    import { createCoverIndex, coverProxy } from ${JSON.stringify(new URL('../../src/ai/cover.js', import.meta.url).href)};
    const one = createCoverIndex({ enabled: () => true });
    const lone = Array.from({ length: 100000 }, (_, i) => coverProxy([(i % 1000) * 8 + 2, 0, Math.floor(i / 1000) * 8 + 2], { w: 1.5, h: 2 }));
    globalThis.gc(); globalThis.gc();
    const h0 = process.memoryUsage().heapUsed;
    one.add('one', lone);
    globalThis.gc(); globalThis.gc();
    const perCell = (process.memoryUsage().heapUsed - h0) / 100000;   // read before refs(), which allocates
    console.log(JSON.stringify({ refs: one.refs(), perCell }));
  `;
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const { refs, perCell } = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.equal(refs, 100000, 'a cell each');
  assert.ok(perCell < 180, `a cell of one proxy and its entry: ${perCell.toFixed(0)} B (~118 at its size; pushed from [], ~246)`);
});

// ─── THE SNOW'S BLANKET ──────────────────────────────────────────────

const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2, RING = 3, X0 = 500, Y0 = 250;
/** SNOW-HOLD's world (fb1021b_snowhold.test.js): tiles stand within three pixels of the player's, destroyed as they leave. */
function streamingWorld() {
  const live = new Map(), dead = new WeakSet();
  let at = [X0, Y0], rt = null, now = 0;
  const make = (mx, my) => ({ mapX: mx, mapY: my, size: SIZE, tileMap: new Uint8Array(16384).fill(1 << 2), winterArchive: 303, stamp: 1, roads: null,
    origin: (out) => { out[0] = (mx - X0) * SIZE; out[1] = 0; out[2] = -(my - Y0) * SIZE; return out; },
    height: () => 0, normal: (lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; } });
  const tileOf = (mx, my) => live.get(`${mx},${my}`) ?? null;
  const stream = () => {
    const [cx, cy] = at;
    for (const [k, t] of live) if (Math.max(Math.abs(t.mapX - cx), Math.abs(t.mapY - cy)) > RING) { live.delete(k); dead.add(t); }
    for (let j = -RING; j <= RING; j++) for (let i = -RING; i <= RING; i++) {
      const k = `${cx + i},${cy + j}`;
      if (!live.has(k)) { const t = make(cx + i, cy + j); live.set(k, t); rt?.terrainPromoted(t, now, null); }
    }
  };
  const world = {
    terrainAt: (x, z) => tileOf(X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)),
    terrainsNear: (r) => { const out = []; const [cx, cy] = at; for (let d = 0; d <= Math.min(r, RING); d++) for (let j = -d; j <= d; j++) for (let k = -d; k <= d; k++) if (Math.max(Math.abs(j), Math.abs(k)) === d) { const t = tileOf(cx + k, cy + j); if (t) out.push(t); } return out; },
    terrainsIn: (minX, minZ, maxX, maxZ) => { const b = snowPixelBox(minX, minZ, maxX, maxZ), out = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const t = tileOf(x, y); if (t) out.push(t); } return out; },
    toGlobal: (x, z) => [X0 * SIZE + x, (Y0 - 1) * SIZE + z], settlements: () => [], terrainDistance: 3,
  };
  stream();
  return { world, dead, bind: (r) => { rt = r; }, move: (x, z, t) => { now = t; at = [X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)]; stream(); } };
}

test('MEM-AUDIT the snow\'s blanket: idle (the travel view up, a door), its overlays are pruned still - a journey keeps no tile the world destroyed, a dropped overlay holds neither its tile nor its arrays, and a tile still standing keeps its own (mutants: the prune active alone, the drop keeping the tile, the ring asked a frame, the mid ring kept)', () => {
  const s = streamingWorld();
  const rt = new SnowfallRuntime({ world: s.world, coverage: new SnowCoverage(MASKS), frameBudgetMs: 50 });
  s.bind(rt);
  const st = { now: 0, x: 10, z: 10, sec: 1_000_000 };
  const frame = (player) => rt.frame({ now: st.now, inside: false, enabled: true, player, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [] });
  const standing = () => ({ x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false });
  quiet(() => { for (let i = 0; i < 900; i++) { st.now += 1 / 30; st.sec += 2; frame(standing()); } });   // thirty seconds standing: the blanket laid
  const laid = [...rt.blanket.overlays.values()].filter((o) => o.ready);
  assert.ok(laid.length >= 9, `overlays laid (${laid.length})`);
  // a door: nothing moves, the tier idle - every standing tile keeps its overlay through the prune
  quiet(() => { for (let i = 0; i < 300; i++) { st.now += 1 / 30; frame(null); } });
  assert.equal(rt.blanket.active, false);
  assert.ok(laid.every((o) => rt.blanket.overlays.get(o.t) === o && !o.dead), 'a tile still standing keeps its overlay for the door');
  assert.ok(rt.mid.tiles.length > 0, 'the mid ring laid on its tiles');
  // AUDIT P3: a tile's ground rebuilt - its old overlay goes, holding nothing, its GPU half queued for the sync
  const tile = laid[0].t, old = rt.blanket.overlays.get(tile), fresh = { ...tile, stamp: 2 };
  rt.dirty.blanket.clear();   // the surface's sync took what was laid
  rt.terrainPromoted(fresh, st.now, tile);
  assert.ok(old.dead && old.t === null && old.pos === null && rt.dirty.blanket.has(old), 'the replaced tile\'s overlay dropped whole and queued for its GPU free');
  rt.terrainPromoted(tile, st.now, fresh);   // and back, so the world's own tile stands again
  // the view comes up mid-build: the blanket's overlay of that tile part-made (AUDIT P3), then a mid rebuild begun (M3)
  quiet(() => { for (let i = 0; i < 400 && !(rt.blanket.building?.cursor > 0 && !rt.mid.building); i++) { st.now += 1 / 30; frame(standing()); } });
  assert.ok(rt.blanket.building?.cursor > 0, 'a blanket overlay under way');
  rt.mid.rebuildPending = true;
  quiet(() => { for (let i = 0; i < 20 && !rt.mid.building; i++) { st.now += 1 / 30; frame(standing()); } });
  assert.ok(rt.mid.building && rt.mid.buildTiles.length > 0, 'a mid build under way');
  assert.ok(rt.blanket.building, 'the blanket\'s still in hand');
  rt.dirty.blanket.clear();   // the surface's sync took everything so far: what the journey drops must be queued again
  const standingBefore = [...rt.blanket.overlays.values()];
  // the travel view: the world streams on under a player who is not drawn
  const near = s.world.terrainsNear;
  let asked = 0;
  s.world.terrainsNear = (r) => { asked++; return near(r); };
  quiet(() => { for (let i = 0; i < 1500; i++) { st.now += 1 / 30; st.x += 3000 / 30; s.move(st.x, st.z, st.now); frame(null); } });
  s.world.terrainsNear = near;
  assert.ok(asked <= 12, `the ring asked on the prune's schedule, not a frame (${asked} in 1,500 frames - AUDIT M4)`);
  const B = rt.blanket, M = rt.mid;
  const held = [...B.overlays.keys(), ...B.live, ...(B.building ? [B.building.t] : [])];
  assert.equal(held.filter((t) => s.dead.has(t)).length, 0, 'no destroyed tile held by the blanket');
  const midHeld = [...M.tiles, ...M.buildTiles, ...(M.source?.tiles ?? []), ...M.blankets.keys(), ...[...M.blankets.values()].map((b) => b?.t)];
  assert.equal(midHeld.filter((t) => t && s.dead.has(t)).length, 0, 'nor by the mid ring (AUDIT M3)');
  const dropped = [...rt.dirty.blanket].filter((o) => o.dead);
  const goneOnTheWay = standingBefore.filter((o) => o.dead);
  assert.ok(goneOnTheWay.length > 0 && goneOnTheWay.every((o) => rt.dirty.blanket.has(o)), 'the old ring dropped, each GPU half queued for the sync (AUDIT P3)');
  assert.ok(dropped.every((o) => o.t === null && o.pos === null && o.nrm === null && o.ctx === null && o.statics === null), 'and holding nothing of their tiles');
});

// ─── THE FISHING HOST'S SCHOOLS ──────────────────────────────────────

test('MEM-AUDIT the fishing host: a pixel torn down forgets its schools - its whole entry was held for the session online, every pixel a journey streamed (~26 MB a map pixel travelled); one stood again keeps its own (mutant: the schools never dropped)', () => {
  const prev = setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 231, region: 17, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: true, exteriorWater: 'Swimming' }), entity: () => null });
  try {
    const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION), water = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);
    let eye = null;
    const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: 231, region: 17 }), eye: () => eye, feet: () => eye.pos, hour: () => 12, storm: () => false, climateAt: () => 231, trophy: () => true, day: () => 20724 };
    const k = fishKind({ book: { state: { open: true, hauls: 0, caps: { stores: 5000 } }, taken: () => false, counting: () => false, held: () => 0 }, host });
    const entry = { px: 300, py: 200, samples, tilemap: water };
    const nodes = k.nodesOf({ entry, px: 300, py: 200, day: 20724 });
    eye = { pos: [nodes[0].local[0] - 8, 1.6, nodes[0].local[2]], dir: [1, 0, 0] };
    k.stood(entry, nodes);
    k.frame(0, { feet: eye.pos, translation: () => [0, 0, 0] });   // a translation that answers for any entry: what the kind holds is what it says
    const [cast] = k.looseNodesOf({ entity: { items: [{ templateIndex: 1603, currentCondition: 50 }] }, dungeon: false });
    const said = () => k.plan(cast, { rank: () => 0, keyLabel: () => 'E' }).rest;
    assert.match(said(), /a school rises 8 m east/);
    const again = { ...entry };
    k.dropped(again);
    assert.match(said(), /a school rises/, 'another entry of the pixel let go: its own kept');
    k.dropped(entry);
    assert.equal(said(), 'Fishing 0', 'torn down: forgotten');
  } finally { setForagingHost(prev); }
});

// ─── THE MENUS' SKY ──────────────────────────────────────────────────

/** The sky as PX1 drew it before MEM-AUDIT, restated: the strings split at every pixel, a new image every draw. */
function oldSky(W, H, t) {
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const RAMP = ['#07080d', '#0b0d14', '#10141d', '#161c27', '#1e2632', '#28313f'];
  const hx = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 0xda66e4;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const fogs = [
    { x: W * (0.30 + 0.05 * Math.sin(t / 41)), y: H * (0.72 + 0.03 * Math.cos(t / 53)), r: H * 0.55, k: 1.4 },
    { x: W * (0.78 + 0.06 * Math.cos(t / 47)), y: H * (0.35 + 0.04 * Math.sin(t / 59)), r: H * 0.45, k: 0.9 },
  ];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = y / H;
    for (const f of fogs) { const d = Math.hypot(x - f.x, y - f.y) / f.r; if (d < 1) v += (1 - d) * (1 - d) * 0.22 * f.k; }
    v = Math.max(0, Math.min(1, v));
    const tt = v * (RAMP.length - 1), i0 = Math.floor(tt), th = (BAYER[y & 3][x & 3] + 0.5) / 16;
    const c = hx(RAMP[Math.min(RAMP.length - 1, i0 + (tt - i0 > th ? 1 : 0))]);
    const o = (y * W + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  const n = Math.round((W * H) / 1440);
  for (let i = 0; i < n; i++) {
    const x = (rnd() * W) | 0, y = (rnd() * H * 0.55) | 0, bright = rnd() < 0.25, phase = rnd() * Math.PI * 2;
    let b = bright ? 200 : 120;
    if (bright) b = [140, 170, 200, 230][Math.floor(2 + 1.99 * Math.sin(t / 1.7 + phase))];
    const o = (y * W + x) * 4;
    data[o] = b; data[o + 1] = b; data[o + 2] = b - 10;
  }
  return data;
}

test('MEM-AUDIT the menus\' sky: the same bytes as PX1\'s every draw, its image made once a size and its canvas sized only when the size moves (mutants: the fog\'s skip past its reach, the image a draw)', () => {
  let made = 0, sized = 0, last = null;
  const ctx = { createImageData: (w, h) => { made++; return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }, putImageData(img) { last = img.data; } };
  let w = 300, h = 150;
  const canvas = { get width() { return w; }, set width(v) { sized++; w = v; }, get height() { return h; }, set height(v) { sized++; h = v; }, getContext: () => ctx };
  for (const [vw, vh] of [[1280, 720], [390, 844], [1280, 720], [1280, 900], [1600, 900]]) {   // AUDIT P9: one side at a time too
    for (const t of [0, 0.125, 41.2, 1234.5]) {
      drawPixelGround(canvas, vw, vh, t);
      assert.deepEqual(last, oldSky(w, h, t), `${vw}x${vh} at ${t}: PX1's bytes`);
    }
  }
  assert.equal(made, 5, 'one image a size the canvas took (the third the first size again)');
  assert.equal(sized, 8, 'the canvas sized only on the sides that moved');
  drawPixelGround(canvas, 1600, 900, 0, { keep: false });
  drawPixelGround(canvas, 1600, 900, 0, { keep: false });
  assert.equal(made, 7, 'a one-off draw keeps no image (AUDIT P9)');
  assert.deepEqual(last, oldSky(w, h, 0));
});

// ─── THE MARKET'S READS ──────────────────────────────────────────────

test('MEM-AUDIT the market\'s reads: the cache keeps MARKET_CACHE_KEPT, the oldest written going first - a read in its minute is still answered from it (mutant: the cache uncapped)', async () => {
  const reads = [];
  const door = { account: () => 'acct-1', read: async (b) => { reads.push(b.page); return { ok: true, status: 200, data: { listings: [], page: b.page } }; } };
  const book = createMarketBook({ door, character: () => 'c-1', now: () => 1000, sleep: async () => {} });
  for (let p = 0; p <= MARKET_CACHE_KEPT; p++) await book.read('materials', { region: 17, page: p });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 1);
  await book.read('materials', { region: 17, page: MARKET_CACHE_KEPT });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 1, 'the newest answered from the cache, inside its minute');
  await book.read('materials', { region: 17, page: 0 });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 2, 'the oldest gone - asked again');
  // AUDIT U3: a view asked again is the newest - the one a player comes back to stays past the cap
  const n0 = reads.length;
  await book.read('materials', { region: 17, page: 3 });   // a hit: page 3 the newest now
  assert.equal(reads.length, n0, 'a hit');
  assert.equal(book.cached('materials', { region: 17, page: 4 })?.page, 4, 'cached() answers, and is a use too');
  for (let p = 1000; p < 1000 + MARKET_CACHE_KEPT - 2; p++) await book.read('materials', { region: 17, page: p });
  const n = reads.length;
  await book.read('materials', { region: 17, page: 3 });
  await book.read('materials', { region: 17, page: 4 });
  assert.equal(reads.length, n, 'the views come back to still answered from the cache');
  assert.ok(MARKET_CACHE_MS >= 1000);
});

test('MEM-AUDIT the market\'s cache holds exactly MARKET_CACHE_KEPT (256), the least recent going first - a view read again past its minute is written again as the newest (AUDIT P6) (mutants: the cap off by one, a rewrite left where it stood)', async () => {
  assert.equal(MARKET_CACHE_KEPT, 256);
  let clock = 0;
  const reads = [];
  const door = { account: () => 'acct-1', read: async (b) => { reads.push(b.page); return { ok: true, status: 200, data: { listings: [], page: b.page } }; } };
  const book = createMarketBook({ door, character: () => 'c-1', now: () => clock, sleep: async () => {} });
  const page = (p) => book.read('materials', { region: 17, page: p });
  for (let p = 0; p < MARKET_CACHE_KEPT; p++) await page(p);   // exactly the cap
  clock += MARKET_CACHE_MS + 1;
  await page(0);   // past its minute: read again, written again - the newest
  assert.equal(reads.length, MARKET_CACHE_KEPT + 1);
  await page(5000);   // one past the cap: the least recent (page 1) goes, not page 0
  assert.equal(book.cached('materials', { region: 17, page: 1 }), null, 'page 1 let go');
  for (const p of [0, 2, MARKET_CACHE_KEPT - 1, 5000]) assert.equal(book.cached('materials', { region: 17, page: p })?.page, p, `page ${p} kept`);
  // a read's answer is written as the newest when it lands, past one that landed while it was out
  let release = null;
  const held = { account: () => 'acct-1', read: async (b) => { if (b.page === 0 && release === null) await new Promise((r) => { release = r; }); return { ok: true, status: 200, data: { listings: [], page: b.page } }; } };
  const late = createMarketBook({ door: held, character: () => 'c-1', now: () => clock, sleep: async () => {} });
  const at = (p) => late.read('materials', { region: 17, page: p });
  for (let p = 0; p < MARKET_CACHE_KEPT; p++) { if (p === 0) { release = 'filled'; await at(0); release = null; } else await at(p); }
  clock += MARKET_CACHE_MS + 1;
  const p0 = at(0);   // stale: asked again, its answer held
  await new Promise((r) => setTimeout(r, 0));
  await at(1);   // stale too, answered at once
  release(); await p0;   // page 0's answer lands last - the newest
  for (let p = 6000; p < 6000 + MARKET_CACHE_KEPT - 2; p++) await at(p);   // the rest of the old pages go
  await at(9999);   // and one more: the least recent of 0 and 1
  assert.equal(late.cached('materials', { region: 17, page: 1 }), null, 'page 1, written first, let go');
  assert.equal(late.cached('materials', { region: 17, page: 0 })?.page, 0, 'page 0, written last, kept');
});

// ─── THE HOSTS' AND THE WINDOWS' OWN LINES ───────────────────────────

test('MEM-AUDIT the place left is let go: setMode clears what latched the last room\'s and the last castle\'s context (mutants: a latch kept)', () => {
  const src = hostText('src/scenes/worldModes.js');
  const line = src.slice(src.indexOf('  const setMode = (next) => {'), src.indexOf('};', src.indexOf('  const setMode = (next) => {')));
  assert.match(line, /if \(next !== 'interior'\) \{ _arrowsCtx = null; interiorArrows\.clear\(\); cardLookedCtx = null; cardStandsDue\.clear\(\); gambitStandsDue\.clear\(\); \}/);
  assert.match(line, /if \(next !== 'dungeon'\) \{ _crownTried = null; arenaWall = null; _arenaStage = _arenaStageCtx = null; _pitStage = _pitStageCtx = null; \}/);
});

test('MEM-AUDIT the windows\' listeners and caches: the account card\'s focus listener goes with its card (driven: a card made, then let go), and the menu lets each go - a repaint\'s card, the close, the unmount, with the foot\'s observer; an item menu\'s pair with its menu, its timer its own; the icons\' encodings with their pictures (AUDIT P7) (mutants: each kept)', () => {
  const live = new Set();
  const win = { addEventListener: (t, f) => { if (t === 'focus') live.add(f); }, removeEventListener: (t, f) => { if (t === 'focus') live.delete(f); } };
  const mk = (tag) => {
    const n = { tag, className: '', type: null, value: '', disabled: false, children: [], isConnected: true, append: (...kids) => n.children.push(...kids.filter(Boolean)), setAttribute() {} };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  const card = accountCard({ createElement: mk, defaultView: win }, flow);
  assert.equal(live.size, 1, 'the card listens for the window\'s focus');
  card.off();
  assert.equal(live.size, 0, 'and lets it go when told');
  const menu = rd('ui/enhanced/enhancedMenu.js'), inv = rd('ui/enhanced/enhancedInventory.js');
  assert.match(menu, /acctPaint = card\.paint;\n {2}acctOff\?\.\(\); acctOff = card\.off \?\? null;/, 'the card drawn before is let go');
  assert.match(menu, /acctOff\?\.\(\); acctOff = null;\n {2}acctPaint = null;\n {2}rereadCollectionsAccount\(\);/, 'the close');
  assert.match(menu, /footObs\?\.disconnect\?\.\(\); footObs = null;\n {6}acctPaint = null; acctOff\?\.\(\); acctOff = null;/, 'the unmount');
  assert.match(inv, /const timer = setTimeout\(\(\) => \{ if \(!menuEl\) return; document\.addEventListener\('pointerdown', away, true\);[^\n]*\n {2}menuOff = \(\) => \{ clearTimeout\(timer\); document\.removeEventListener\('pointerdown', away, true\);/, 'the item menu\'s pair laid by its own timer, which its close clears');
  assert.match(rd('ui/item/itemIconUrl.js'), /const _iconUrls = new WeakMap\(\);/);
});

test('MEM-AUDIT the classic sky keeps its two last sky files, and their bytes go with the rest - forgetBytes lets go only of bytes that can be read again (AUDIT M1: a memory-only session\'s are its only copy), and a sky with no file is asked once (AUDIT M2) (mutants: the sky files unbounded, the bytes kept, the only copy forgotten, the missing let go)', async () => {
  const shared = rd('scenes/shared.js');
  assert.match(shared, /const SKY_FILES_KEPT = 2;/);
  assert.match(shared, /if \(sf\) \{ skyFiles\.delete\(skyIndex\); skyFiles\.set\(skyIndex, sf\); \}[^\n]*\n {4}while \(skyFiles\.size > SKY_FILES_KEPT\) \{\n {6}const \[old\] = skyFiles\.keys\(\);\n {6}skyFiles\.delete\(old\);\n {6}forgetBytes\(SkyFile\.indexToFileName\(old\)\);/);
  const { getBytes, forgetBytes, keepOnlyInMemory } = await import('../../src/scenes/dataSource.js');
  const { createSkyController } = await import('../../src/scenes/shared.js');
  const was = globalThis.fetch, warn = console.warn;
  const asked = new Map();
  globalThis.fetch = async (url) => {
    const name = String(url).split('/').pop();
    asked.set(name, (asked.get(name) ?? 0) + 1);
    const ok = name === 'MEMAUDIT.TST';
    return { ok, status: ok ? 200 : 404, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  console.warn = () => {};
  try {
    assert.deepEqual([...await getBytes('MEMAUDIT.TST')], [1, 2, 3]);
    await getBytes('MEMAUDIT.TST');
    assert.equal(asked.get('MEMAUDIT.TST'), 1, 'kept');
    forgetBytes('MEMAUDIT.TST');
    assert.deepEqual([...await getBytes('MEMAUDIT.TST')], [1, 2, 3]);
    assert.equal(asked.get('MEMAUDIT.TST'), 2, 'let go: read again, the same bytes');
    forgetBytes('MEMAUDIT.TST');
    keepOnlyInMemory('MEMAUDIT.ONE', new Uint8Array([7]));
    forgetBytes('MEMAUDIT.ONE');
    assert.deepEqual([...await getBytes('MEMAUDIT.ONE')], [7], 'a memory-only session\'s bytes are its only copy: never forgotten');
    assert.equal(asked.get('MEMAUDIT.ONE') ?? 0, 0, 'and never asked of the network, which has none');
    // the lean diet: no SKY file at all - each sky index asked once, however often the bound turns over
    const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : (k === 'drawingBufferWidth' || k === 'drawingBufferHeight' ? 64 : () => ({})))) });
    const ctl = createSkyController(gl, new URLSearchParams('sky=classic'));
    try { ctl.renderer.setPanorama = () => {}; } catch { /* a getter-only renderer: its panorama is not what this reads */ }
    for (const [idx, hour] of [[16, 9], [20, 10], [22, 11], [16, 12], [20, 13], [22, 14]]) { ctl.use(idx, hour * 60, true, null); await new Promise((r) => setTimeout(r, 5)); }
    assert.deepEqual(['SKY16.DAT', 'SKY20.DAT', 'SKY22.DAT'].map((n) => asked.get(n)), [1, 1, 1], 'each missing sky file asked once');
  } finally { globalThis.fetch = was; console.warn = warn; }
});

test('MEM-AUDIT a still batch in an arena makes no indices of its own - the batch with its own buffers alone writes them (mutant: the indices a batch again)', () => {
  const src = rd('render/renderer.js');
  const fn = src.slice(src.indexOf('  createBillboardBatch(archive, record, size, centers'), src.indexOf('const bounds = boundsOf(centers.flat());'));
  const arena = fn.indexOf('if (!dynamic && count > 0 && this._bbArenas) {'), own = fn.indexOf('} else {', arena);
  assert.ok(arena > 0 && own > arena);
  assert.equal(fn.slice(0, own).includes('new Uint32Array(count * 6)'), false, 'none made before the batch\'s own branch');
  assert.ok(fn.slice(own).includes('const indices = new Uint32Array(count * 6);'), 'made there');
});
