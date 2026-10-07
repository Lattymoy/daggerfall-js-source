// FAR-CLIP1 (2026-09-28, a player's report through Mac, with a screenshot: "There's this weird issue with paneling in
// the ocean and geometry just being hard squares") - ILIAC PUDDLE NO MORE'S CLIP IS A PROGRAM. The mod clips the carved
// sea out of a coastal terrain per texel, in the terrain's own shader: DeepWaterTerrainCapRenderer.ApplyWaterTexelClip
// swaps each terrain it clips to the clip variant of its shader (DeepWaters/TilemapTextureArrayClipWater) and marks the
// clipped texels in the tilemap it hands it. DW-C clipped by leaving a clipped tile's quad out of the pixel's index set,
// which is that discard only while a tile is a quad (stride 1): EV4's far ground draws at stride 4, kept every quad not
// clipped whole, and no terrain program ever tested the clip's byte - so the far coasts drew the carved sea's tiles as
// tile layer 63 (GL clamps it to the ground archive's last record, a road's grass edge) on the quad's chord: tan and
// grey squares with right-angle notches, climbing the shore and lying as panels under the far sea.
// Pinned, each against the tree before the fix: the program the renderer binds for a pixel the cap patched - the clip
// variant of either lane's terrain program - discards the byte, after the gradient its sample takes, and samples every
// other byte as the plain program does, while the plain programs discard nothing (their early depth test,
// GROUND-LAST's); every uniform the plain program takes reaches the variant at the variant's OWN locations, on both
// lanes and through a lane's install, and the variant is compiled only when first asked for (or warmed); on a coast
// built by the port's own terrain pipeline, every clipped tile the stride-4 index set still covers - a part-clipped
// quad's, a standing skirt segment's - is the variant's to discard, and none at stride 1; and the world draws a pixel
// whose TileMap the cap patched with the variant, after the rest, and builds it as the mod mounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions, GlslDiscard } from './glsl.mjs';
// the modules FAR-CLIP1 adds exports to are read as namespaces: a named import of an export a tree lacks fails every
// test in the file at link time, for that one reason and not the law each test holds
import * as RENDER from '../src/render/renderer.js';
import * as SURFACE from '../src/world/terrainSurface.js';
import { EL_LANE, EL_TERRAIN_FS } from '../src/render/enhancedLighting.js';
import { CLIP_SENTINEL, patchTilemapForClip, clippedTerrainIndices } from '../src/world/deepWaterCap.js';
import { generateSamples, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { generateTileData, assignTiles } from '../src/world/terrainTiles.js';

const { Renderer } = RENDER;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const UP = new Float32Array([0, 1, 0]);
const TILE = 6.4, EDGE = 128 * TILE;
/** The clip variant's builder - render/renderer.js's own export beside TERRAIN_FS. */
const terrainClipFs = (fs) => {
  assert.equal(typeof RENDER.terrainClipFs, 'function', 'render/renderer.js exports terrainClipFs');
  return RENDER.terrainClipFs(fs);
};

/** A fake GL that keeps what a driver keeps: each shader's stage and source, each program's shaders, the program in use
 *  - and a uniform location is its PROGRAM's own ({ p, name }, null where no shader of the program declares the name),
 *  as WebGL's are. Every compile, upload and draw is logged with the program in use. */
function driverGl() {
  const log = [];
  const enums = new Map();
  let cur = null, ids = 0;
  const declares = (p, name) => (p?.shaders ?? []).some((s) => new RegExp(`^\\s*uniform\\b[^;]*\\b${name}\\b`, 'm').test(s.src ?? ''));
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'drawingBufferWidth') return 320;
      if (k === 'drawingBufferHeight') return 200;
      if (k.toUpperCase() === k) { if (!enums.has(k)) enums.set(k, 0x9000 + enums.size); return enums.get(k); }
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'getExtension': return () => null;
        case 'createShader': return (type) => ({ id: ++ids, type });
        case 'shaderSource': return (sh, src) => { sh.src = src; };
        case 'compileShader': return (sh) => { log.push({ k, sh }); };
        case 'attachShader': return (p, sh) => { (p.shaders ??= []).push(sh); };
        case 'useProgram': return (p) => { cur = p; };
        case 'getUniformLocation': return (p, name) => (declares(p, name) ? { p, name } : null);
        case 'drawElements': return () => { log.push({ k, prog: cur }); };
        default:
          if (k.startsWith('create')) return () => ({ id: ++ids });
          if (k.startsWith('uniform')) return (loc, ...args) => { if (loc) log.push({ k, prog: cur, loc, args: args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a)) }); };
          return () => {};
      }
    },
  });
  const fsOf = (p) => p?.shaders?.find((s) => s.type === gl.FRAGMENT_SHADER)?.src ?? null;
  const compiled = () => log.filter((e) => e.k === 'compileShader').length;
  /** the clip variants compiled so far - a terrain program's decode with the cap's byte discarded */
  const clips = () => log.filter((e) => e.k === 'compileShader' && /texelFetch\(uTilemap, cell, 0\)\.r;/.test(e.sh.src) && /if \(data == \d+u\) discard;/.test(e.sh.src)).length;
  return { gl, log, fsOf, compiled, clips, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** One terrain draw: the program it bound, that program's fragment shader, and every upload the draw made. */
function drawTerrain(r, rig, clip) {
  const from = rig.log.length;
  r.drawTerrain({ vao: {}, indexCount: 6 }, I, { id: 'tiles' }, { id: 'tilemap' }, TILE, clip);
  const out = rig.log.slice(from);
  const draw = out.find((e) => e.k === 'drawElements');
  return { prog: draw.prog, fs: rig.fsOf(draw.prog), uploads: out.filter((e) => e.k.startsWith('uniform')) };
}
/** A draw's uploads by uniform: the name to the last value it took. */
const valuesOf = (d) => new Map(d.uploads.map((e) => [e.loc.name, e.args]));

/** A terrain fragment program's main(), runnable fragment by fragment: the tile byte under the fragment is `bytes`'s (a
 *  number, or a function of the cell), the tile array's sample is caught (the layer, the coordinate and the gradient
 *  it asked for), a discard is a discard; `derivatives` is whether dFdx and dFdy were taken before the fragment ended. */
function terrainFragment(fs) {
  class Sampled extends Error {}
  let byteAt = () => 0, sample = null, dx = false, dy = false;
  const f = glslFunctions(fs, {
    vLocalXZ: [TILE / 2, TILE / 2], vWorldPos: [0, 30, 0], vNormal: [0, 1, 0], uTileSize: TILE,
    texelFetch: (_s, c) => [byteAt(c[0], c[1]), 0, 0, 0],
    dFdx: (x) => { dx = true; return x.map(() => 0.01); },
    dFdy: (x) => { dy = true; return x.map(() => 0.02); },
    textureGrad: (_s, p, gx, gy) => { sample = { layer: p[2], uv: p.slice(0, 2), gx, gy }; throw new Sampled(); },
  });
  return (bytes, xz) => {
    byteAt = typeof bytes === 'function' ? bytes : () => bytes;
    f.globals.vLocalXZ = xz;
    sample = null; dx = false; dy = false;
    try { f.main(); } catch (e) {
      if (e instanceof GlslDiscard) return { discarded: true, derivatives: dx && dy };
      if (e instanceof Sampled) return { discarded: false, ...sample, derivatives: dx && dy };
      throw e;
    }
    throw new Error('the terrain program ran to its end without sampling the tile array');
  };
}

test('FAR-CLIP1: the program the renderer binds for a pixel the cap patched - either lane\'s - discards the cap\'s byte, after the gradient its sample takes, and samples every other byte exactly as the plain program does; the plain programs discard nothing - their early depth test (mutants: the discard dropped; the byte compared wrong; the discard before the derivatives; the draw ignores the ask; the clip built from the plain source; the plain program given the discard; the one-gradient-line check dropped; the byte moved into the conversion\'s range)', () => {
  const rig = driverGl();
  const r = new Renderer(rig.canvas);
  r.beginFrame(I, I, UP);
  const lanes = [];
  for (const lane of [null, EL_LANE]) {
    r.setLightingLane(lane);
    lanes.push({ name: lane ? 'enhanced lighting' : 'classic', plain: drawTerrain(r, rig, false).fs, clip: drawTerrain(r, rig, true).fs });
  }
  assert.equal(lanes[1].plain, EL_TERRAIN_FS, 'the lane draws its own terrain program');
  const at = [TILE * 3.25, TILE * 7.5];
  for (const { name, plain, clip } of lanes) {
    assert.doesNotMatch(plain.replace(/\/\/[^\n]*/g, ''), /\bdiscard\b/, `${name}: the plain terrain program has no discard - GROUND-LAST's early depth test`);
    const P = terrainFragment(plain), C = terrainFragment(clip);
    const cut = C(CLIP_SENTINEL, at);
    assert.equal(cut.discarded, true, `${name}: a fragment on a clipped tile is discarded (the draw sampled ${cut.layer === undefined ? 'nothing' : `tile layer ${cut.layer}`})`);
    assert.equal(cut.derivatives, true, `${name}: ...after dFdx and dFdy - the gradient is taken in uniform control flow, as WATER1's (GRAIN AUDIT 1)`);
    for (let b = 0; b < 256; b++) {
      if (b === CLIP_SENTINEL) continue;
      const want = P(b, at), got = C(b, at);
      assert.equal(got.discarded, false, `${name}: byte ${b} is a tile, not the clip`);
      assert.deepEqual(got, want, `${name}: byte ${b} samples as the plain program samples it`);
    }
    assert.deepEqual([C(4, at).layer, C(223, at).layer], [1, 55], `${name}: a tile's record is its layer (grass; the last record)`);
    assert.equal(clip.split('\n').length, plain.split('\n').length + 1, `${name}: the variant is the plain program and one line`);
  }
  assert.equal(SURFACE.CLIP_SENTINEL, 255, 'the mod\'s (255, 0, 255, 0) mark as the port\'s R8UI byte, at the TileMap format\'s own module');
  assert.ok(!Array.from({ length: 256 }, (_, t) => SURFACE.convertTile(t)).includes(SURFACE.CLIP_SENTINEL), '...a byte the conversion writes for no raw tile at all');
  assert.equal(CLIP_SENTINEL, SURFACE.CLIP_SENTINEL, 'the cap writes the byte the program discards: one home, world/deepWaterCap.js re-exports it');
  for (const { name, plain, clip } of lanes) assert.equal(clip, terrainClipFs(plain), `${name}: the renderer's clip program is terrainClipFs of the lane's own terrain program`);
  assert.throws(() => terrainClipFs('void main() {}'), /gradient/, 'a program with no gradient line has nowhere the clip may go');
  assert.throws(() => terrainClipFs(`${lanes[0].plain}\nvec2 gy = ROT[t] * dFdy(unwrapped);\n`), /gradient/, 'nor one with two');
});

test('FAR-CLIP1: drawTerrain binds the installed set\'s clip program when asked and its plain one otherwise - compiled the first time it is asked for (or warmed), every uniform the plain program takes reaching the clip program at the clip program\'s own locations, on both lanes and through a lane\'s install (mutants: the draw ignores the ask; the variant never installed; the plain program given the clip; the swap never builds; the lane table the plain program\'s; an install keeping a clip it has not built; built eagerly; the warm a no-op; built again at every ask)', () => {
  const rig = driverGl();
  const r = new Renderer(rig.canvas);
  const TERRAIN_FS = rig.fsOf(r.terrainProgram);
  const boot = rig.compiled();
  r.beginFrame(I, I, UP);
  const plain = drawTerrain(r, rig, false);
  assert.equal(plain.fs, TERRAIN_FS, 'the plain draw binds the classic set\'s terrain program');
  assert.equal(rig.clips(), 0, 'a page that never draws the carved sea compiles no clip program');
  const clip = drawTerrain(r, rig, true);
  assert.equal(terrainFragment(clip.fs)(CLIP_SENTINEL, [TILE, TILE]).discarded, true, 'the draw that asks binds a program that discards the cap\'s byte');
  assert.notEqual(clip.prog, plain.prog);
  assert.deepEqual([rig.compiled() - boot, rig.clips()], [2, 1], 'built at the first draw that asks for it: one program, a VS and an FS');
  // a program's uniforms are its own: the whole block again, at the clip program's own locations, the same values
  assert.deepEqual([...valuesOf(clip).keys()].sort(), [...valuesOf(plain).keys()].sort(), 'every uniform the plain program took reaches the clip program - the frame\'s block, the model, the tile size, the deck');
  for (const [n, v] of valuesOf(plain)) assert.deepEqual(valuesOf(clip).get(n), v, `${n}: the same value`);
  for (const d of [plain, clip]) for (const e of d.uploads) assert.equal(e.loc.p, d.prog, `${e.loc.name}: an upload goes to the bound program's own location`);
  assert.equal(drawTerrain(r, rig, false).prog, plain.prog, 'a plain draw after it binds the plain program again');
  assert.equal(drawTerrain(r, rig, true).prog, clip.prog, '...and the clip program is kept');
  assert.equal(rig.compiled() - boot, 2, '...not built again');
  r.beginFrame(I, I, UP);
  const again = drawTerrain(r, rig, true);
  assert.equal(again.prog, clip.prog);
  assert.deepEqual([...valuesOf(again).keys()].sort(), [...valuesOf(plain).keys()].sort(), 'a new frame\'s block reaches the clip program');
  // a lane's install puts in the lane set's plain program - its clip program is not built yet, and an install builds none
  const beforeLane = rig.compiled();
  r.setLightingLane(EL_LANE);
  assert.equal(rig.fsOf(r.terrainProgram), EL_TERRAIN_FS, 'the lane installed with its plain terrain program');
  assert.equal(rig.clips(), 1, 'the install compiled no clip program');
  const lanePlain = drawTerrain(r, rig, false);
  assert.equal(lanePlain.fs, EL_TERRAIN_FS);
  const laneClip = drawTerrain(r, rig, true);
  assert.equal(terrainFragment(laneClip.fs)(CLIP_SENTINEL, [TILE, TILE]).discarded, true, 'the lane\'s clip program discards the byte');
  assert.equal(rig.compiled() - beforeLane, 24 + 2, 'the lane\'s twenty-four (EL1; AUDIT BAY A12: the shadow pass\'s cutting program among them; CACHE-COPY: and the copy that puts the shadow cache into the live layers), and its clip program once asked');
  assert.deepEqual([...valuesOf(laneClip).keys()].sort(), [...valuesOf(lanePlain).keys()].sort(), 'the lane\'s uniforms reach its clip program too');
  assert.ok(valuesOf(laneClip).has('uELExposure') && valuesOf(laneClip).has('uSunShadow'), 'the exposure and the shadow maps among them');
  for (const d of [lanePlain, laneClip]) for (const e of d.uploads) assert.equal(e.loc.p, d.prog, `lane ${e.loc.name}: the bound program's own location`);
  // back to the classic set with a clip installed: the classic set's own clip program, then its plain one
  r.setLightingLane(null);
  assert.equal(drawTerrain(r, rig, true).prog, clip.prog, 'the classic set keeps its clip program across the swap');
  assert.equal(drawTerrain(r, rig, false).prog, plain.prog);
  assert.equal(clip.fs, terrainClipFs(TERRAIN_FS));
  assert.equal(laneClip.fs, terrainClipFs(EL_TERRAIN_FS));
  // the warm: the streaming host builds the installed set's clip program as the mod mounts - once
  const rig2 = driverGl();
  const r2 = new Renderer(rig2.canvas);
  const boot2 = rig2.compiled();
  r2.prepareTerrainClip();
  assert.deepEqual([rig2.compiled() - boot2, rig2.clips()], [2, 1], 'prepareTerrainClip builds the clip program');
  r2.prepareTerrainClip();
  r2.beginFrame(I, I, UP);
  const warmed = drawTerrain(r2, rig2, true);
  assert.equal(rig2.compiled() - boot2, 2, '...once: a second warm and the first clip draw build nothing more');
  assert.equal(warmed.fs, terrainClipFs(rig2.fsOf(drawTerrain(r2, rig2, false).prog)));
});

// ─── the coast: the port's own terrain pipeline over a WOODS whose sea lies west of map x 500 ───
/** A WOODS stand-in: the sea (height 0) west of map x 500, the land rising a byte a pixel east of it, a little relief
 *  in the large (noise) map on land. */
function coastWoods() {
  const at = (x) => { const d = Math.min(999, Math.max(0, x)) - 500; return d < 0 ? 0 : Math.min(255, 3 + d); };
  return {
    getHeightMapValuesRange1Dim(px, py, dim) {
      const d = new Uint8Array(dim * dim);
      for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = at(px + x);
      return d;
    },
    getLargeHeightMapValuesRange(px, py, dim) {
      const side = dim * 3, d = new Uint8Array(side * side);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) d[y * side + x] = at(px + Math.floor(x / 3)) > 0 ? 2 + ((x * 7 + y * 13) % 5) : 0;
      return d;
    },
  };
}

/** What a stride's index set still covers of the TileMap: the tiles of every quad it keeps, and the edge tiles under
 *  every skirt segment it keeps - each with the fragment that samples it ([x, z] in the pixel's own frame). */
function covered(idx, stride) {
  const g = (HEIGHTMAP_DIMENSION - 1) / stride + 1, grid = g * g, out = [];
  for (let t = 0; t < idx.length;) {
    if (idx[t + 1] < grid) {   // a quad: i0, i2, i3, i0, i3, i1
      const qx = idx[t] % g, qz = Math.floor(idx[t] / g);
      for (let tz = qz * stride; tz < (qz + 1) * stride; tz++) for (let tx = qx * stride; tx < (qx + 1) * stride; tx++) out.push({ tx, tz, xz: [(tx + 0.5) * TILE, (tz + 0.5) * TILE], skirt: false });
      t += 6;
    } else {   // a skirt segment: t0, b0, b1, ... - b0 = g * g + edge * g + i (south, north, west, east)
      const e = Math.floor((idx[t + 1] - grid) / g), i = (idx[t + 1] - grid) % g;
      for (let k = i * stride; k < (i + 1) * stride; k++) {
        const along = (k + 0.5) * TILE;
        out.push({ ...[
          { tx: k, tz: 0, xz: [along, 0] }, { tx: k, tz: 127, xz: [along, EDGE] },
          { tx: 0, tz: k, xz: [0, along] }, { tx: 127, tz: k, xz: [EDGE, along] },
        ][e], skirt: true });
      }
      t += 12;
    }
  }
  return out;
}

test('FAR-CLIP1: on a coast the port\'s own terrain pipeline builds, every clipped tile the far ground\'s stride-4 index set still covers - a part-clipped quad\'s, a standing skirt segment\'s - is discarded by the program the renderer binds for a pixel the cap patched, on both lanes, and every other tile beside them is drawn with its own record; at stride 1 the index set covers none (mutants: the discard dropped; the byte compared wrong; the draw ignores the ask; the clip built from the plain source)', () => {
  const px = 500, py = 200;
  const samples = generateSamples(coastWoods(), px, py);
  const tilemap = new Uint8Array(128 * 128);
  assignTiles(generateTileData(samples, px, py), tilemap, true);
  const patched = patchTilemapForClip(SURFACE.convertTilemap(tilemap), { samples, tilemap });
  assert.ok(patched, 'the coast is patched');
  const isClip = (c) => patched[c.tz * 128 + c.tx] === CLIP_SENTINEL;
  const clipped = patched.filter((b) => b === CLIP_SENTINEL).length;
  assert.ok(clipped > 5000 && clipped < 16384 - 1000, `the carved sea is clipped and the land is not (${clipped} tiles)`);
  const near = covered(clippedTerrainIndices(patched, 1), 1);
  assert.equal(near.length, 16384 - clipped, 'stride 1: the quads the cull leaves are the tiles it did not clip');
  assert.equal(near.filter(isClip).length, 0, 'stride 1: the index set is the clip exactly');
  const far = covered(clippedTerrainIndices(patched, 4), 4);
  const kept = far.filter(isClip);
  const inQuads = kept.filter((c) => !c.skirt), underSkirts = kept.filter((c) => c.skirt);
  assert.ok(inQuads.length > 100, `stride 4: part-clipped quads stand with clipped tiles in them (${inQuads.length})`);
  assert.ok(underSkirts.length > 0, `stride 4: and skirt segments stand under clipped edge tiles (${underSkirts.length})`);
  const part = new Set(inQuads.map((c) => `${c.tx >> 2},${c.tz >> 2}`));
  const beside = far.filter((c) => !c.skirt && !isClip(c) && part.has(`${c.tx >> 2},${c.tz >> 2}`));
  assert.ok(beside.length > 0, 'the part-clipped quads carry ground too');
  const rig = driverGl();
  const r = new Renderer(rig.canvas);
  r.beginFrame(I, I, UP);
  const byteAt = (x, y) => patched[y * 128 + x];
  for (const lane of [null, EL_LANE]) {
    r.setLightingLane(lane);
    const run = terrainFragment(drawTerrain(r, rig, true).fs);
    const drawn = kept.filter((c) => !run(byteAt, c.xz).discarded);
    assert.deepEqual(drawn.map((c) => `${c.skirt ? 'skirt' : 'quad'} ${c.tx},${c.tz}`), [], `${lane ? 'lane' : 'classic'}: no clipped tile the far ground still covers is drawn`);
    for (const c of beside) {
      const s = run(byteAt, c.xz);
      assert.equal(s.discarded, false, `${lane ? 'lane' : 'classic'}: tile ${c.tx},${c.tz} beside the clip is ground`);
      assert.equal(s.layer, byteAt(c.tx, c.tz) >> 2, '...drawn with its own record');
    }
  }
});

test('FAR-CLIP1: the world draws a pixel whose TileMap the cap patched with the clip program and every other with the plain one, the patched pixels after the rest, and builds the clip program as the mod mounts; the byte has one home; the other three hosts draw no carved sea (mutants: every pixel plain; the cull\'s pixels only; every pixel clipped; unsorted; clipped first; no warm)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /renderer\.drawTerrain\(p\.dwTerrain \?\? p\.terrain, pixelMatrix,[^\n]*\n\s+renderer\.tileArrays\.get\(p\.groundArchive\), p\.tilemapTex, 6\.4, !!p\._dwBytes, ecoDraw\(p\)\);/,   // ECOTONE1: PIN MOVED - the border pixel's neighbours ride after the clip
    'the ground of a pixel the cap patched (dwSetTilemap\'s `_dwBytes`: its TileMap on the texture) draws with the clip program, as the mod swaps the material of each terrain it clips');
  assert.match(w, /renderer\.setCloudShadow\(sky\?\.cloudShadow \?\? null\);\n\s+if \(deepWaters\) groundQueue\.sort\(dwClipLast\);[^\n]*\n\s+for \(const p of groundQueue\) \{/, 'the queue is ordered before the drain');
  const cmp = w.match(/function dwClipLast\(a, b\) \{ (return [^}]+) \}/);
  assert.ok(cmp, 'the order is one comparator');
  const dwClipLast = new Function('a', 'b', cmp[1]);
  const q = [{ n: 'near patched', _dwBytes: new Uint8Array(1) }, { n: 'near' }, { n: 'mid patched', _dwBytes: new Uint8Array(1) }, { n: 'mid', _dwBytes: null }, { n: 'far' }];
  assert.deepEqual(q.sort(dwClipLast).map((p) => p.n), ['near', 'mid', 'far', 'near patched', 'mid patched'], 'the patched pixels after the rest, near first within each: one swap of program a frame');
  assert.match(w, /latchModLoaded\(DEEP_WATERS_VENDOR, !!dwRender\);[^\n]*\n\s+if \(dwRender\) renderer\.prepareTerrainClip\(\);/, 'the mod\'s mount builds the clip program, beside its own');
  const cap = rd('src/world/deepWaterCap.js');
  assert.match(cap, /^import \{ CLIP_SENTINEL \} from '\.\/terrainSurface\.js';/m, 'the cap takes the byte from the TileMap format\'s module');
  assert.doesNotMatch(cap, /CLIP_SENTINEL = /, '...and never writes it down itself');
  assert.match(rd('src/render/renderer.js'), /^import \{ CLIP_SENTINEL \} from '\.\.\/world\/terrainSurface\.js';/m, 'the renderer\'s clip variant reads it there too');
  // THE FOUR HOSTS: the fixed city runs no Deep Waters host and draws its ground plain; the interiors and the dungeon draw no terrain
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /renderer\.drawTerrain\(groundSurface, identityMatrix,\n\s+renderer\.tileArrays\.get\(groundArchive\), tilemapTex, 6\.4\);/);
  assert.doesNotMatch(e, /deepWaterCap|createDeepWatersHost/, 'exterior.js: no cap');
  for (const h of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(rd(h), /drawTerrain\(/, `${h}: no ground`);
});
