// FIELD BUGS 2026-10-21c row 6 (FB1021B): THE GRASS FIELD WHILE THE PLAYER MOVES - measured.
//
// A player's CPU profile showed grass streaming among the main thread's costs. PERF-EXT22 measured the field's
// steady walk (`perFrame`, GRASS_SLICE) and left its catch-up mode - `catchUp ? perCell : GRASS_SLICE`, two whole
// cells a frame whenever more than GRASS_CATCH_UP cells wait - unmeasured on the move. This drives the REAL
// createGrassField and LabGrassRenderer (on a GL that answers and counts, as test/world/terrain/grassshift.test.js
// does) under the REAL StreamingWorldState's floating origin, over Daggerfall's own ground: WOODS.WLD's pixels built
// by the world's own generatePixelTerrain, the temperate archive's grass records (grassRecordsOf, TEXTURE.302) and
// world.js's keep()/ground()/slope() shape (frameGrass: the near ring's pieces, the record, the water corners, the
// drawn surface, the sea). Each path runs at DFU's own speeds (PlayerSpeedChanger through player/motor.js and
// systems/transport.js: walk, run, the ride, the gallop, the cart) at 60, 30 and 20 frames a second, and the field's
// births (a boot, a teleport or a fast travel's arrival, the jungle floor's re-made meadow) are run standing and on
// the move. Per frame it counts the candidates placed (keep() asks), the cells written, the frames in catch-up and
// the time update() took; per cell, whether it was ever in the eye's view before it was let go, and whether it was
// placed again.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/grassMoveProbe.mjs            # every path, every rate
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/grassMoveProbe.mjs --quick    # 60 fps only
//   ARENA2_PATH=... node tools/grassMoveProbe.mjs --all-paths                        # the diagonal and the circle too
//   ARENA2_PATH=... node tools/grassMoveProbe.mjs --frame-ms=2                      # the field's frameMs for the run
//   ARENA2_PATH=... GRASS_MODULE=src/render/labGrass.base.js node tools/grassMoveProbe.mjs   # another placer, the same paths
//   ARENA2_PATH=... node tools/grassMoveProbe.mjs --compare=src/render/labGrass.base.js     # both, each run paired
//
// The base placer is a copy made for the run and removed after it - never committed (the source sweeps, L10N4's and
// audit18's render list, read every file in src/): `git show 9a46fc23a:src/render/labGrass.js > src/render/labGrass.base.js`
// is the field before FB1021B.
//
// Milliseconds are this machine's (the container's 4-core Xeon), and they are the process's CPU time over each update
// (process.cpuUsage), which a shared machine's other load does not lengthen as it does the wall clock's (printed
// beside it); the candidate and cell counts are exact and deterministic. The upload (bufferSubData) is a recorded
// call here, so a cell's GPU copy is not in the time. The record and its decision:
// bible/07-Rendering/Performance-Exterior.md, THE GRASS ON THE MOVE (FB1021B).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { surfaceHeightAt, surfaceNormalAt, TERRAIN_TILE_DIM } from '../src/world/terrain/terrainSurface.js';
import { TERRAIN_SIZE, SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../src/world/terrain/terrainSampler.js';
import { StreamingWorldState, mapPixelToWorldCoords } from '../src/world/streamingWorld.js';
import { waterCorners, WATER_DRAW_MASK_TABLE } from '../src/world/water/waterCorners.js';
import { CLASSIC_TO_UNITY_RATIO, DF_WALK_BASE } from '../src/player/motor.js';
import { DF_RIDE_BASE, DF_CART_BASE } from '../src/systems/transport.js';
import { isMain } from './lib/isMain.mjs';

// GRASS_MODULE names another copy of labGrass.js to measure, saved beside it so its own imports resolve - the record's
// before is this probe over the base commit's labGrass.js saved as src/render/labGrass.base.js (never committed)
const G = await import(process.env.GRASS_MODULE ? new URL(`../${process.env.GRASS_MODULE}`, import.meta.url).href : '../src/render/labGrass.js');

/** DFU's speeds (PlayerSpeedChanger: GetWalkSpeed's drag, GetRunSpeed's 1.35 + Running/200, GetBaseSpeed's ride arms),
 *  at chargen's SPD 50 / Running 30 and at a strong character's SPD 100 / Running 100. Metres a second. */
export function dfuSpeeds() {
  const walk = (spd) => (spd + DF_WALK_BASE - 0.5 * (100 - Math.max(30, spd))) / CLASSIC_TO_UNITY_RATIO;
  const run = (spd, skill) => ((spd + DF_WALK_BASE) / CLASSIC_TO_UNITY_RATIO) * (1.35 + skill / 200);
  const ride = (spd, base) => (spd + base) / CLASSIC_TO_UNITY_RATIO;
  return {
    walk: walk(50), run: run(50, 30), 'run (SPD 100, Running 100)': run(100, 100),
    'horse walk (HORSE-WALK)': ride(50, DF_WALK_BASE), 'horse (DFU ride)': ride(50, DF_RIDE_BASE),
    gallop: ride(50, DF_RIDE_BASE) * (1.35 + 30 / 200), 'gallop (SPD 100, Running 100)': ride(100, DF_RIDE_BASE) * (1.35 + 100 / 200),
    cart: ride(50, DF_CART_BASE),
  };
}

/** A WebGL2 that answers what LabGrassRenderer's constructor asks and counts the rest (grassshift.test.js's). */
export function countingGl() {
  const counts = {};
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'isEnabled') return () => false;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => { counts[k] = (counts[k] || 0) + 1; };
    },
  });
  return { gl, counts };
}

const CLIMATE_WOODLANDS = 231;   // CLIMATE.PAK's Woodlands: the temperate ground, TEXTURE.302

/** Daggerfall's own ground: the pixels the world would build, keyed `px,py`, built on first ask. */
export function realGround(arena2) {
  const woods = new WoodsFile();
  if (!woods.load(new Uint8Array(readFileSync(join(arena2, 'WOODS.WLD'))))) throw new Error('WOODS.WLD did not load');
  const climate = new PakFile();
  climate.load(new Uint8Array(readFileSync(join(arena2, 'CLIMATE.PAK'))));
  const pal = new DFPalette();
  pal.load(readFileSync(join(arena2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const tex = new TextureFile();
  if (!tex.load(new Uint8Array(readFileSync(join(arena2, 'TEXTURE.302'))), 'TEXTURE.302', pal)) throw new Error('TEXTURE.302 did not load');
  const layers = [];
  for (let r = 0; r < tex.recordCount; r++) layers.push(tex.getColor32(tex.getDFBitmap(r, 0), 0));
  const grass = G.grassRecordsOf(layers);
  const means = layers.map(G.tileMeanColour);
  const built = new Map();
  const pixel = (px, py) => {
    const key = `${px},${py}`;
    let p = built.get(key);
    if (!p) {
      const out = generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM), climateType: climate.getValue(px + 1, py) });
      p = { px, py, samples: out.samples, tilemapBytes: out.tilemapBytes, groundNormals: out.normals, _stride: 1 };
      built.set(key, p);
    }
    return p;
  };
  const climateAt = (px, py) => climate.getValue(px + 1, py);
  return { pixel, grass, means, climateAt, woods };
}

/** world.js frameGrass's keep/ground/slope over the near ring (chebyshev 2 of the current pixel - strideFor's
 *  stride-1 ring), each frame's pieceAt index built lazily on the first ask as the host's is. */
export function frameClosures(world, state, counter) {
  const sea = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE + 0.5;
  let at = null;
  const pieceAt = (x, z) => (at ??= G.pieceIndex(ringOf(state).map(([px, py]) => {
    const p = world.pixel(px, py);
    return { p, t: state.pixelTranslation(p.px, p.py, [0, 0, 0]) };
  }), TERRAIN_SIZE))(x, z);
  const keep = (x, z) => {
    counter.keeps++;
    const hit = pieceAt(x, z);
    if (!hit) return null;
    const { p, t } = hit;
    const lx = x - t[0], lz = z - t[2];
    const tx = Math.floor(lx / 6.4), tz = Math.floor(lz / 6.4);
    const byte = p.tilemapBytes[tz * TERRAIN_TILE_DIM + tx];
    const rec = byte >> 2;
    if (rec === 0 || !world.grass.has(rec)) return null;
    if (waterCorners(byte, WATER_DRAW_MASK_TABLE)) return null;
    const h = surfaceHeightAt(p.samples, lx, lz, 1);
    if (h <= sea) return null;
    return h + t[1];
  };
  const ground = (x, z) => {
    const hit = pieceAt(x, z);
    if (!hit) return null;
    const { p, t } = hit;
    const tx = Math.floor((x - t[0]) / 6.4), tz = Math.floor((z - t[2]) / 6.4);
    return world.means[p.tilemapBytes[tz * TERRAIN_TILE_DIM + tx] >> 2] ?? null;
  };
  const scratch = [0, 0, 0];
  const slope = (x, z) => {
    const hit = pieceAt(x, z);
    if (!hit) return null;
    return surfaceNormalAt(hit.p.groundNormals, x - hit.t[0], z - hit.t[2], scratch);
  };
  return { keep, ground, slope };
}
const ringOf = (state) => {
  const out = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) out.push([state.current.x + dx, state.current.y + dy]);
  return out;
};

/** A woodlands start well inside a 9 x 9 block of woodlands, the first the scan finds from (px0, py0). */
export function woodlandsStart(world, px0 = 200, py0 = 200) {
  for (let r = 0; r < 120; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const px = px0 + dx, py = py0 + dy;
    let ok = true;
    for (let j = -4; j <= 4 && ok; j++) for (let i = -4; i <= 4 && ok; i++) if (world.climateAt(px + i, py + j) !== CLIMATE_WOODLANDS) ok = false;
    if (ok) return { px, py };
  }
  throw new Error('no woodlands block');
}

const HALF_FOV = (Math.atan(Math.tan((65 / 2) * Math.PI / 180) * 16 / 9));   // DFU's 65 degrees vertical, at 16:9

/**
 * One run: `path(t)` the eye's heading (radians, 0 = east, +z) and speed at time t, `fps` the frame rate, `seconds`
 * long. `birth` says when the field is made: 'settled' (made and filled before the clock starts - a walk on a
 * standing field) or 'now' (made on the first frame: a boot, a teleport's or a fast travel's arrival, the jungle
 * floor's re-made meadow). `M` is the placer measured (this tree's labGrass.js, or another's). The field's clock is the
 * frame's: real time inside a frame, and each frame beginning `1 / fps` after the last, as the game's do - so a field
 * that takes a share of its frame is handed the frame the run says, not the probe's back-to-back loop. Answers the
 * run's per-frame and per-cell tallies.
 */
export function runPath(world, start, { path, fps, seconds, birth = 'settled', fieldOpts = {}, M = G }) {
  const state = new StreamingWorldState();
  state.init(start.px, start.py);
  const corner = mapPixelToWorldCoords(start.px, start.py);
  const [sx, sz] = state.localFromWorld(corner.x + 32768 * 0.75, corner.z + 32768 * 0.5);   // three quarters across the start pixel, halfway up (native units): a walk east crosses into the next pixel
  const pos = [sx, 0, sz];
  const counter = { keeps: 0 };
  const { gl } = countingGl();
  const R = new M.LabGrassRenderer(gl);
  let writes = 0;
  const writeSlot = R.writeSlot.bind(R);
  R.writeSlot = (slot, placed) => { writes++; writeSlot(slot, placed); };
  let field = null, simBase = 0, realBase = performance.now();
  const clock = () => simBase + (performance.now() - realBase);
  const frameStart = (n) => { simBase = n * dt * 1000; realBase = performance.now(); };
  const make = () => M.createGrassField(R, { ...frameClosures(world, state, counter), clock, ...fieldOpts });
  const dt = 1 / fps, frames = Math.round(seconds * fps);
  for (const [px, py] of ringOf(state)) world.pixel(px, py);
  if (birth === 'settled') {
    field = make();
    for (let f = 0; f < 4000; f++) { frameStart(f - 4000); const c = frameClosures(world, state, counter); if (field.update(pos[0], pos[2], c.keep, c.ground, c.slope) === 0) break; }
  }
  const per = [];   // { ms, keeps, writes, catchUp, missing }
  const cells = new Map();   // key -> { seen, born } - born: written during the run (a settled field's cells were not)
  const everPlaced = new Map();   // key -> how many times written
  if (field) for (const k of field.live.keys()) { cells.set(k, { seen: true, born: false }); everPlaced.set(k, 1); }
  let shifts = 0, droppedPending = 0, droppedCandidates = 0, unseenFreed = 0, freed = 0, replaced = 0, settledAt = -1;
  // the cells that came into range and left it never placed, and the nearest any of them came
  const inRange = new Map();   // key -> { minD, placed }
  let skipped = 0, skippedNearest = Infinity;
  let travelled = 0;
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    const { heading, speed } = path(t);
    pos[0] += Math.cos(heading) * speed * dt; pos[2] += Math.sin(heading) * speed * dt;
    travelled += speed * dt;
    const r = state.update(pos);
    if (r.offset) {
      pos[0] += r.offset[0]; pos[1] += r.offset[1]; pos[2] += r.offset[2];
      if (field) {
        const p = field.pending;
        field.shiftOrigin(r.offset);
        if (p && !field.pending) { droppedPending++; droppedCandidates += p.st.i; }
        shifts++;
      }
    }
    if (r.pixelChanged && field) {
      // restrideTerrain and the publish invalidate the pixels that join the near ring (chebyshev 2 - 819 m and more off)
      for (const [px, py] of ringOf(state)) {
        if (Math.max(Math.abs(px - state.current.x), Math.abs(py - state.current.y)) !== 2) continue;
        const tr = state.pixelTranslation(px, py);
        const p = field.pending;
        field.invalidate(tr[0], tr[2], tr[0] + TERRAIN_SIZE, tr[2] + TERRAIN_SIZE);
        if (p && !field.pending) { droppedPending++; droppedCandidates += p.st.i; }
      }
    }
    for (const [px, py] of ringOf(state)) world.pixel(px, py);   // the stream built them on its own frames (the breather's slices), never inside the grass's update
    if (!field) field = make();
    const before = new Set(field.live.keys());
    const pend = field.pending;
    const c = frameClosures(world, state, counter);
    counter.keeps = 0; writes = 0;
    frameStart(f);
    const c0 = process.cpuUsage(), t0 = performance.now();
    const missing = field.update(pos[0], pos[2], c.keep, c.ground, c.slope);
    const ms = performance.now() - t0, c1 = process.cpuUsage(c0), cpu = (c1.user + c1.system) / 1000;
    if (pend && field.pending !== pend && !field.live.has(pend.key)) { droppedPending++; droppedCandidates += pend.st.i; }
    // the holes: cells whose nearest point is inside 0.9 of the range (where the fade leaves a blade an eighth of
    // itself and more) standing unplaced - a field that keeps up shows none
    let holes = 0;
    {
      const gx = state.compensation[0], gz = state.compensation[2], cl = M.GRASS_CELL, R = M.LAB_GRASS.range * 0.9, RF = M.LAB_GRASS.range;
      const ecx = Math.floor((pos[0] - gx) / cl), ecz = Math.floor((pos[2] - gz) / cl), kk = Math.ceil(RF / cl) + 1;
      const now = new Set();
      for (let cz = ecz - kk; cz <= ecz + kk; cz++) for (let cx = ecx - kk; cx <= ecx + kk; cx++) {
        const dx = Math.max(cx * cl + gx - pos[0], 0, pos[0] - ((cx + 1) * cl + gx)), dz = Math.max(cz * cl + gz - pos[2], 0, pos[2] - ((cz + 1) * cl + gz));
        const d2 = dx * dx + dz * dz, key = M.cellKey(cx, cz), isLive = field.live.has(key);
        if (d2 <= R * R && !isLive) holes++;
        if (d2 > RF * RF) continue;
        now.add(key);
        const e = inRange.get(key) ?? { minD: Infinity, placed: false };
        e.minD = Math.min(e.minD, Math.sqrt(d2)); e.placed ||= isLive;
        inRange.set(key, e);
      }
      for (const [key, e] of inRange) if (!now.has(key)) {
        if (!e.placed) { skipped++; skippedNearest = Math.min(skippedNearest, e.minD); }
        inRange.delete(key);
      }
    }
    per.push({ ms, cpu, keeps: counter.keeps, writes, catchUp: counter.keeps > M.GRASS_SLICE, missing, holes });   // past one slice: PERF-EXT22's catch-up (or an inner cell), FB1021B's deadline
    if (settledAt < 0 && missing === 0 && birth === 'now') settledAt = f;
    // the cells: written, freed, seen
    for (const k of before) if (!field.live.has(k)) {
      const cell = cells.get(k);
      freed++;
      if (cell && cell.born && !cell.seen) unseenFreed++;
      cells.delete(k);
    }
    for (const [k, h] of field.live) {
      let cell = cells.get(k);
      if (!cell) {
        cell = { seen: false, born: true };
        cells.set(k, cell);
        const n = (everPlaced.get(k) ?? 0) + 1;
        everPlaced.set(k, n);
        if (n > 1) replaced++;
      }
      if (!cell.seen) {
        // in the eye's view: within the range and inside the horizontal half-angle (and the cell's own angular half)
        const x0 = h.cx * G.GRASS_CELL + fieldOriginX(field, state), z0 = h.cz * G.GRASS_CELL + fieldOriginZ(field, state);
        const cx = x0 + G.GRASS_CELL / 2 - pos[0], cz = z0 + G.GRASS_CELL / 2 - pos[2];
        const d = Math.hypot(cx, cz);
        if (d < G.GRASS_CELL) cell.seen = true;
        else if (d - G.GRASS_CELL * 0.71 < G.LAB_GRASS.range) {
          let a = Math.atan2(cz, cx) - heading;
          a = Math.atan2(Math.sin(a), Math.cos(a));
          if (Math.abs(a) < HALF_FOV + Math.atan((G.GRASS_CELL * 0.71) / d)) cell.seen = true;
        }
      }
    }
  }
  return { per, shifts, droppedPending, droppedCandidates, unseenFreed, freed, replaced, settledAt, travelled, perCell: field.perCell, live: field.live.size, skipped, skippedNearest };
}
// the field's origin, as the probe needs it for a cell's square: the field keeps it private, and its grid moves with
// every shift the state makes - so it is the state's compensation (the field starts at the scene's 0 with the state's)
const fieldOriginX = (_field, state) => state.compensation[0];
const fieldOriginZ = (_field, state) => state.compensation[2];

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export function summarize(run) {
  const ms = run.per.map((x) => x.cpu), wall = run.per.map((x) => x.ms), keeps = run.per.map((x) => x.keeps);
  const cu = run.per.filter((x) => x.catchUp);
  let worst = 0;
  for (let i = 1; i < run.per.length; i++) if (run.per[i].cpu > run.per[worst].cpu) worst = i;
  return {
    frames: run.per.length, catchUpFrames: cu.length,
    holeFrames: run.per.filter((x) => x.holes > 0).length, maxHoles: Math.max(...run.per.map((x) => x.holes)),
    mean: ms.reduce((a, b) => a + b, 0) / ms.length, p50: q(ms, 0.5), p90: q(ms, 0.9), p99: q(ms, 0.99), max: Math.max(...ms),
    wallP99: q(wall, 0.99), wallMax: Math.max(...wall),
    worstKeeps: run.per[worst].keeps, worstWrites: run.per[worst].writes, maxKeeps: Math.max(...keeps),
    over2: ms.filter((x) => x > 2).length, over4: ms.filter((x) => x > 4).length,
    cellsWritten: run.per.reduce((a, x) => a + x.writes, 0), keepsTotal: keeps.reduce((a, b) => a + b, 0),
    shifts: run.shifts, droppedPending: run.droppedPending, droppedCandidates: run.droppedCandidates,
    freed: run.freed, unseenFreed: run.unseenFreed, replaced: run.replaced, settledAt: run.settledAt, travelled: run.travelled,
    skipped: run.skipped, skippedNearest: run.skippedNearest,
  };
}

export const PATHS = {
  'straight east': () => ({ heading: 0 }),
  'diagonal NE': () => ({ heading: Math.PI / 4 }),
  'circle r=150 m': (speed) => (t) => ({ heading: (speed * t) / 150 + Math.PI / 2 }),
  'wander (a turn every 6 s)': () => (t) => ({ heading: [0, 1.1, 0.3, -0.8, 2.4, 1.6, -2.2, 0.5, 3.0, -1.4][Math.floor(t / 6) % 10] }),
};
export const pathFn = (name, speed) => {
  const p = PATHS[name];
  const inner = name.startsWith('circle') || name.startsWith('wander') ? p(speed) : (() => p());
  return (t) => ({ ...inner(t), speed });
};

export function fmt(name, s) {
  const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  return `${name.padEnd(46)} ${String(s.frames).padStart(5)} fr | cu ${String(s.catchUpFrames).padStart(4)} | cpu ms p50 ${f(s.p50)} p90 ${f(s.p90)} p99 ${f(s.p99)} max ${f(s.max)} mean ${f(s.mean, 3)} (wall p99 ${f(s.wallP99)} max ${f(s.wallMax)}) | >2ms ${s.over2} >4ms ${s.over4} | keeps max ${s.maxKeeps} (worst frame ${s.worstKeeps}, ${s.worstWrites} cells) | holes ${s.holeFrames} fr (max ${s.maxHoles}) | never placed ${s.skipped}${s.skipped ? ` (nearest ${s.skippedNearest.toFixed(0)} m)` : ''} | cells ${s.cellsWritten} freed ${s.freed} unseen ${s.unseenFreed} again ${s.replaced} | shifts ${s.shifts} pending dropped ${s.droppedPending} (${s.droppedCandidates} cand)${s.settledAt >= 0 ? ` | settled f${s.settledAt}` : ''}`;
}

if (isMain(import.meta.url)) {
  const arena2 = process.env.ARENA2_PATH;
  // --compare=<a copy of labGrass.js beside it>: every run twice, that placer's and this tree's, one after the other
  // (the order alternating), so the machine's load falls on both alike
  const cmpArg = process.argv.find((a) => a.startsWith('--compare='));
  const mods = cmpArg ? [['before', await import(new URL(`../${cmpArg.slice(10)}`, import.meta.url).href)], ['after ', G]] : [['', G]];
  let flip = false;
  const each = (name, opts) => {
    const order = flip ? [...mods].reverse() : mods;
    flip = !flip;
    const out = new Map(order.map(([label, M]) => [label, summarize(runPath(world, start, { ...opts, fieldOpts, M }))]));
    for (const [label] of mods) console.log(fmt(`${label ? `${label} ` : ''}${name}`, out.get(label)));
  };
  if (!arena2 || !existsSync(join(arena2, 'WOODS.WLD'))) { console.error('ARENA2_PATH must name the game\'s ARENA2 (sh tools/fetch-data.sh)'); process.exit(1); }
  const quick = process.argv.includes('--quick'), all = process.argv.includes('--all-paths');
  const msArg = process.argv.find((a) => a.startsWith('--frame-ms='));
  const fieldOpts = msArg ? { frameMs: Number(msArg.slice(11)) } : {};
  const world = realGround(arena2);
  const start = woodlandsStart(world);
  console.log(`start pixel ${start.px},${start.py} (woodlands); grass records ${[...world.grass].sort((a, b) => a - b).join(',')}`);
  const speeds = dfuSpeeds();
  console.log('DFU speeds m/s:', Object.entries(speeds).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('; '));
  // warm the JIT and the pixels
  for (const [, M] of mods) runPath(world, start, { path: pathFn('straight east', speeds.run), fps: 60, seconds: 10, fieldOpts, M });
  const rates = quick ? [60] : [60, 30, 20];
  console.log('\n# MOVING ON A STANDING FIELD');
  for (const fps of rates) {
    for (const [sname, v] of Object.entries(speeds)) {
      for (const pname of Object.keys(PATHS)) {
        if (!all && pname !== 'straight east' && pname !== 'wander (a turn every 6 s)') continue;
        each(`${fps}fps ${sname} ${v.toFixed(1)} m/s ${pname}`, { path: pathFn(pname, v), fps, seconds: 60 });
      }
    }
  }
  console.log('\n# THE FIELD BORN (boot, teleport, fast travel arrival, the jungle floor\'s re-made meadow)');
  for (const fps of rates) {
    for (const [sname, v] of [['standing', 0], ['walk', speeds.walk], ['run', speeds.run], ['gallop', speeds.gallop], ['gallop (SPD 100, Running 100)', speeds['gallop (SPD 100, Running 100)']]]) {
      each(`${fps}fps born ${sname} ${v.toFixed(1)} m/s`, { path: pathFn('straight east', v), fps, seconds: 30, birth: 'now' });
    }
  }
}
