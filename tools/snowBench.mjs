// PERF-SNOW bench (2026-10-10, Dudey: "snowfall and snow in general is pretty demanding"): THE SNOW'S CPU, A WALK.
// systems/snowfallRuntime.js over test/render/snowfall1_runtime.test.js's synthetic world (planes of 128 x 128 tiles a map
// pixel), with Basic Roads on every pixel (a network of roads and tracks, predicted as the classifier predicts them), the
// player walking east at a run for FRAMES frames at 60 fps. Prints the frames' snow time (mean, p95, worst), the
// allocations (the scavenges and mark-compacts a --trace-gc run counts are the caller's), and a hash of everything the
// GL layer would upload (every tier's mesh, masks and contexts) - two trees with the same hash drew the same snow.
//   node tools/snowBench.mjs [frames=1800] [budgetMs=2]      (budget 'inf': the mod's sample budgets alone)
import { readFileSync } from 'node:fs';
import { SnowCoverage, predictRoadTile, BasicRoadsTerrain, roadCorners } from '../src/systems/snowfall.js';
import { SnowfallRuntime } from '../src/systems/snowfallRuntime.js';
import { snowPixelBox } from '../src/scenes/snowfallHost.js';

const FRAMES = Number(process.argv[2] || 1800);
const BUDGET = process.argv[3] === 'inf' ? Infinity : Number(process.argv[3] ?? 2);
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2;
let seed = 7;
const R = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
function world() {
  const tiles = new Map();
  const tileOf = (mx, my) => {
    const k = `${mx},${my}`;
    if (!tiles.has(k)) {
      const net = { roads: 0x88 | (R(2) ? 0x22 : 0), paths: 0x22 | (R(2) ? 0x08 : 0), roadCorners: roadCorners(R(256), R(256)), pathCorners: 0 };
      const rect = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
      const tileMap = new Uint8Array(16384), authored = new Array(16384).fill(false);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        let t = predictRoadTile(x, y, net.roads, net.roadCorners, 1, true, rect);
        if (t < 0) t = predictRoadTile(x, y, net.paths, net.pathCorners, 1, false, rect);
        if (t < 0) t = (x * 7 + y * 3) % 11 === 0 ? 0 : (1 + ((x + y) % 4)) << 2;
        tileMap[y * 128 + x] = t;
      }
      let roads = null;
      tiles.set(k, { mapX: mx, mapY: my, size: SIZE, tileMap, winterArchive: 303, stamp: 1,
        get roads() { return (roads ??= new BasicRoadsTerrain(mx, my, tileMap, authored, net, rect)); },
        origin: (out) => { out[0] = (mx - 500) * SIZE; out[1] = 0; out[2] = -(my - 250) * SIZE; return out; },
        height: (lx, lz) => 0.05 * lx + 0.02 * lz + Math.sin(lx * 0.05) * 0.5,
        normal: (lx, lz, out) => { const dx = 0.05 + Math.cos(lx * 0.05) * 0.025; const l = Math.hypot(dx, 1, 0.02); out[0] = -dx / l; out[1] = 1 / l; out[2] = -0.02 / l; return out; } });
    }
    return tiles.get(k);
  };
  return {
    terrainAt: (x, z) => tileOf(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    terrainsNear: (ring) => { const out = []; for (let r = 0; r <= ring; r++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (Math.max(Math.abs(j), Math.abs(k)) === r) out.push(tileOf(500 + k, 250 + j)); return out; },
    terrainsIn: (minX, minZ, maxX, maxZ) => { const b = snowPixelBox(minX, minZ, maxX, maxZ), out = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) out.push(tileOf(x, y)); return out; },
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z],
    settlements: () => [{ minX: 500 * SIZE + 300, minZ: 249 * SIZE + 300, maxX: 500 * SIZE + 500, maxZ: 249 * SIZE + 500 }],
    terrainDistance: 2,
  };
}
// SPANS=1: each of the runtime's own steps timed a frame, so a slow frame says which step it was
const spans = process.env.SPANS ? new Map() : null;
let frameSpans = null;
if (spans) {
  const P = SnowfallRuntime.prototype;
  for (const name of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, name);
    if (name === 'constructor' || typeof d.value !== 'function' || name === 'frame' || name === '_spent') continue;
    const o = d.value;
    P[name] = function (...a) { const t = performance.now(); try { return o.apply(this, a); } finally { if (frameSpans) frameSpans[name] = (frameSpans[name] ?? 0) + performance.now() - t; } };
  }
}
const allSpans = [];
const rt = new SnowfallRuntime({ world: world(), coverage: new SnowCoverage(MASKS), frameBudgetMs: BUDGET });
const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
const times = [];
const npcs = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: 0, z: 0, active: true, grounded: true, radius: 0.4, citizen: i % 2 === 0 }));
for (let i = 0; i < FRAMES; i++) {
  st.now += 1 / 60; st.sec += 2; st.x += 0.09; st.z += 0.02 * Math.sin(i / 90);
  for (const [k, n] of npcs.entries()) { const a = i / 120 + k; n.x = 500 * SIZE + st.x + Math.cos(a) * (10 + k * 4); n.z = 249 * SIZE + st.z + Math.sin(a) * (10 + k * 4); }
  frameSpans = spans ? {} : null;
  const t0 = performance.now();
  rt.frame({ now: st.now, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false },
    winter: true, desert: false, snowing: i % 600 < 300, gameSeconds: st.sec, npcs, corpses: [] });
  times.push(performance.now() - t0);
  allSpans.push(frameSpans);
}
const s = [...times].sort((a, b) => a - b);
const mean = times.reduce((a, b) => a + b, 0) / times.length;
let h = 2166136261;
const eat = (arr) => { if (!arr) return; const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < u.length; i += 1) h = Math.imul(h ^ u[i], 16777619) >>> 0; };
const L = rt.local, M = rt.mid;
for (const a of [L.pos, L.nrm, L.dynamic, L.statics, L.context, M.pos, M.nrm, M.ctxA, M.ctxB, M.ctxC, M.heights, M.bnrm, M.history, M.statics, M.context, rt.far.pixels]) eat(a);
for (const o of rt.blanket.overlays.values()) { eat(o.pos); eat(o.nrm); eat(o.ctx); eat(o.statics); }
console.log(`snow ${FRAMES} frames, budget ${BUDGET}: mean ${mean.toFixed(3)} ms, p95 ${s[Math.floor(s.length * 0.95)].toFixed(2)}, worst ${s[s.length - 1].toFixed(1)}, total ${(mean * FRAMES / 1000).toFixed(2)} s; mid builds ${M.completed ?? '?'}, blanket ${rt.blanket.completed}, stamps ${rt.stampsWritten}; hash ${h.toString(16)}`);
if (process.env.WORST) {
  const from = Number(process.env.FROM || 0);
  const idx = times.map((t, i) => [t, i]).filter(([, i]) => i >= from).sort((a, b) => b[0] - a[0]).slice(0, Number(process.env.WORST));
  console.log('worst frames:', idx.map(([t, i]) => `#${i} ${t.toFixed(1)}ms`).join(', '));
  if (spans) for (const [t, i] of idx) console.log(`  #${i} ${t.toFixed(1)}: ${Object.entries(allSpans[i]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
}
