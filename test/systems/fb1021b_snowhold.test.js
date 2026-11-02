// FIELD BUGS 2026-10-21b SNOW-HOLD (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md, BLACK-SCREEN): "Crashing every minute -
// No message just black", "traveling overworld especially". The Snowfall mod's blanket queue drained only while the local
// tier was not recentring - a player on the move keeps it recentring - and was never pruned, so every map pixel the
// world built and destroyed behind a travelling player stood in it, its whole entry held by the host's SnowTerrain
// closures (1.8 MB of JS heap a pixel, measured in the running game); and the host chained each rebuilt tile to the one
// before it. Driven over a world that streams about the player as the real one does: tiles stand within three pixels of
// the player's and are destroyed as they leave, each new one promoted as the host promotes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SnowCoverage } from '../../src/systems/snowfall.js';
import { SnowfallRuntime, BLANKET } from '../../src/systems/snowfallRuntime.js';
import { createSnowfallHost, snowPixelBox } from '../../src/scenes/snowfallHost.js';

const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2, RING = 3, X0 = 500, Y0 = 250;
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

/** A world streaming RING pixels about the player's pixel: `dead` the tiles it destroyed. */
function streamingWorld() {
  const live = new Map(), dead = new WeakSet();
  let at = [X0, Y0], rt = null, now = 0;
  const make = (mx, my) => {
    const pixel = { mx, my };   // the host's pixel entry, held by the tile's closures as the host's are
    return { mapX: mx, mapY: my, size: SIZE, tileMap: new Uint8Array(16384).fill(1 << 2), winterArchive: 303, stamp: 1, roads: null,
      origin: (out) => { out[0] = (mx - X0) * SIZE; out[1] = 0; out[2] = -(my - Y0) * SIZE; return out; },
      height: () => 0, normal: (lx, lz, out) => { void pixel; out[0] = 0; out[1] = 1; out[2] = 0; return out; } };
  };
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
/** The tiles the blanket holds - its queue, the set beside it, its overlays and the one it builds. */
const heldBy = (rt) => { const B = rt.blanket; return new Set([...B.queue, ...B.queued, ...B.overlays.keys(), ...(B.building ? [B.building.t] : [])]); };

test('SNOW-HOLD a player travelling keeps the local tier recentring - the blanket holds no destroyed pixel, and its queue no more than the rings it draws', () => {
  const s = streamingWorld();
  const rt = new SnowfallRuntime({ world: s.world, coverage: new SnowCoverage(MASKS), frameBudgetMs: 2 });
  s.bind(rt);
  const st = { now: 0, x: 10, z: 10, sec: 1_000_000 };
  let destroyed = 0, recentring = 0;
  quiet(() => {
    for (let i = 0; i < 4000; i++) {   // 40 m/s for 133 s: five and a half kilometres, six pixels crossed
      st.now += 1 / 30; st.sec += 2; st.x += 40 / 30;
      s.move(st.x, st.z, st.now);
      rt.frame({ now: st.now, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [] });
      if (rt.local.recentering) recentring++;
    }
  });
  for (const t of heldBy(rt)) if (s.dead.has(t)) destroyed++;
  assert.equal(rt.blanket.active, true);
  assert.ok(recentring > 3000, `the tier recentring nearly throughout (${recentring} of 4000 frames) - the queue never drains`);
  assert.equal(destroyed, 0, 'no destroyed pixel held');
  assert.ok(rt.blanket.queue.length <= (2 * RING + 1) ** 2, `the queue the rings' at most (${rt.blanket.queue.length})`);
  assert.equal(BLANKET.pruneSeconds, 5);
});

test('SNOW-HOLD a blanket going inactive (a door, the Overworld\'s travel view) lets its queue go - standing again queues every visible tile anew', () => {
  const s = streamingWorld();
  const rt = new SnowfallRuntime({ world: s.world, coverage: new SnowCoverage(MASKS), frameBudgetMs: 2 });
  s.bind(rt);
  const st = { now: 0, x: 10, z: 10, sec: 1_000_000 };
  const frame = (o = {}) => rt.frame({ now: st.now, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [], ...o });
  quiet(() => { for (let i = 0; i < 30; i++) { st.now += 1 / 30; st.x += 40 / 30; s.move(st.x, st.z, st.now); frame(); } });
  assert.ok(rt.blanket.queue.length > 0, 'tiles waiting');
  quiet(() => { st.now += 1 / 30; frame({ inside: true, player: null }); });
  assert.equal(rt.blanket.active, false);
  assert.deepEqual([rt.blanket.queue.length, rt.blanket.queued.size], [0, 0], 'let go');
  quiet(() => { st.now += 1 / 30; frame(); });
  assert.ok(rt.blanket.queue.length > 0, 'out again: the visible tiles queued anew');
});

test('SNOW-HOLD a host tile rebuilt says it replaced one - and holds none (each held the tile before it: every rebuild of a pixel in one chain)', async () => {
  const pixels = new Map(), stamps = new Map();
  const pixel = (x, y) => { const k = `${x},${y}`; if (!pixels.has(k)) pixels.set(k, { x, y }); return pixels.get(k); };
  const tileMap = new Uint8Array(16384).fill(1 << 2);
  const ground = {
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => pixel(X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)), pixelOn: (x, y) => pixel(x, y),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) out.push(pixel(X0 + k, Y0 + j)); return out; },
    translation: (p, out) => { out[0] = (p.x - X0) * SIZE; out[1] = 0; out[2] = -(p.y - Y0) * SIZE; return out; },
    height: () => 0, normal: (p, lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; },
    tileMap: () => tileMap, climate: () => 231, mapPixel: (p) => ({ x: p.x, y: p.y }), stamp: (p) => stamps.get(`${p.x},${p.y}`) ?? 0,
    toGlobal: (x, z) => [X0 * SIZE + x, (Y0 - 1) * SIZE + z], settlements: () => [],
  };
  const host = createSnowfallHost({ enhanced: true, ground, loadMasks: async () => MASKS });
  const st = { now: 1, sec: 3_000_000 };
  const frame = () => host.frame({ now: (st.now += 1 / 60), inside: false, player: { x: 20, y: 0, z: 20, grounded: true, swimming: false, levitating: false }, weather: 'sunny', seconds: (st.sec += 1), winter: true, climate: 231 });
  quiet(frame);
  await new Promise((r) => setTimeout(r, 10));
  quiet(frame);
  const tileHere = () => host.runtime.world.terrainAt(20, 20);
  const first = tileHere();
  assert.ok(first, 'a tile stands');
  assert.equal(first.replaced, false);
  for (let stamp = 1; stamp <= 3; stamp++) { stamps.set(`${X0},${Y0}`, stamp); quiet(frame); }
  const last = tileHere();
  assert.notEqual(last, first, 'rebuilt');
  assert.equal(last.replaced, true, 'it says it replaced one, and holds none');
});
