// JUNGLE-TRAILS (2026-10-19, the owner: "Implement procedural dirt pathways that cut through the forest"). The jungle's
// own trails: the middle-value lines of two warped, turned value noises on the world's lattice, painted into a pixel's
// tile corners as dirt before the marching squares run, their tiles kept as a track's are, a jungle tree's foot kept off
// them as VERGE1 keeps it off a road. world/jungle/jungleTrails.js; bible/03-World/Bantha-Jungle.md "The trails".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUNGLE_TRAILS, trailDistance, trailRoom, trailClear, paintJungleTrails, warpStretch } from '../../src/world/jungle/jungleTrails.js';
import { JUNGLE, JUNGLE_PALMS, JUNGLE_COVER, withJungle } from '../../src/world/terrain/jungleNature.js';
import { JUNGLE_MEASURES } from '../../src/world/jungle/jungleModels.js';
import { jungleDepthAt, JUNGLE_EDGE } from '../../src/world/jungle/jungleRegion.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';

const T = 128, D = 129, S = PIXEL_M / T;
const WHOLE = Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3]);
const OUTSIDE = Object.freeze([-3, -3, -3, -3, -3, -3, -3, -3, -3]);
/** the jungle's edge running east-west through the middle row of pixels: the south row out, the north row in */
const EDGE = Object.freeze([1.2, 1.2, 1.2, 0, 0, 0, -1.2, -1.2, -1.2]);
const grass = () => new Uint8Array(D * D).fill(2);
const brute = (px, py, x, y) => trailDistance(px * T + x, -py * T + y) <= JUNGLE_TRAILS.half;
/** a pixel painted whole: its tile data, its paths, how many corners turned to dirt */
const paint = (px, py, { nine = WHOLE, whole = nine === WHOLE, td = grass(), tm = new Uint8Array(T * T), rect = null, paths = null } = {}) => {
  const before = td.slice();
  const out = paintJungleTrails(td, tm, paths, { px, py, nine, whole, rect });
  const dirt = new Uint8Array(D * D);
  for (let i = 0; i < D * D; i++) dirt[i] = before[i] !== td[i] ? 1 : 0;
  return { td, tm, paths: out, dirt, n: dirt.reduce((a, b) => a + b, 0) };
};

/** N x N pixels of the field from (PX0, PY0) south-east, every corner read: its trail corners, and its smallest ring of
 *  trail - a trail no frame cuts, by its corners (8-connected) */
const stretch = (N, PX0, PY0) => {
  const W = N * T + 1, on = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (trailDistance(PX0 * T + x, -(PY0 + N) * T + y) <= JUNGLE_TRAILS.half) on[y * W + x] = 1;
  const seen = new Uint8Array(W * W);
  let least = Infinity;
  for (let s = 0; s < W * W; s++) {
    if (!on[s] || seen[s]) continue;
    let size = 0, open = false;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const k = st.pop(), x = k % W, y = (k - x) / W;
      size++;
      if (x === 0 || y === 0 || x === W - 1 || y === W - 1) open = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * W + xx;
        if (xx >= 0 && yy >= 0 && xx < W && yy < W && on[q] && !seen[q]) { seen[q] = 1; st.push(q); }
      }
    }
    if (!open) least = Math.min(least, size);
  }
  return { N, W, on, least };
};
const AREA = stretch(10, 880, 290);

test('JUNGLE-TRAILS the field: winding lines - unbroken, no ring of trail smaller than about half a cell, about one through a pixel (1.2 km to the km2), and no likelier to run along the world\'s axes than a line at random (mutants: the half width under a corner\'s diagonal; the lattice\'s gap gone; the turn gone)', () => {
  const { N, W, on } = AREA;
  let corners = 0, ends = 0;
  for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!on[y * W + x]) continue;
    corners++;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on[(y + dy) * W + x + dx]) n++;
    if (n < 2) ends++;
  }
  assert.equal(ends, 0, 'every trail corner has a trail corner on either side');
  const share = corners / (W * W);
  assert.ok(share > 0.008 && share < 0.016, `a trail's corners ${(100 * share).toFixed(2)}% of the land`);
  // the rings: none small - here, and where a lattice let reach the middle stood rings of 76 and 150 corners (pixels
  // 702,279 and 610,290: a ring of trail 100 m across)
  for (const { least, at } of [{ ...AREA, at: 'the stretch' }, { ...stretch(3, 701, 278), at: '702,279' }, { ...stretch(3, 609, 289), at: '610,290' }]) {
    assert.ok(least > 300, `${at}: the smallest ring of trail ${least} corners`);
  }
  // most pixels carry one
  let carry = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let any = false;
    for (let y = j * T; y <= j * T + T && !any; y++) for (let x = i * T; x <= i * T + T; x++) if (on[y * W + x]) { any = true; break; }
    if (any) carry++;
  }
  assert.ok(carry >= 0.6 * N * N, `${carry} of ${N * N} pixels carry a trail`);
  // the headings: the line through each trail corner's neighbours (4 tiles), folded onto 0-45 degrees off an axis -
  // a line at random lies within 10 degrees of one 22% of the time; an unturned lattice's lines 35%
  let nearAxis = 0, read = 0;
  for (let y = 4; y < W - 4; y += 3) for (let x = 4; x < W - 4; x += 3) {
    if (!on[y * W + x]) continue;
    let sxx = 0, szz = 0, sxz = 0, n = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (on[(y + dy) * W + x + dx]) { sxx += dx * dx; szz += dy * dy; sxz += dx * dy; n++; }
    if (n < 6) continue;
    let f = (((0.5 * Math.atan2(2 * sxz, sxx - szz) * 180) / Math.PI % 90) + 90) % 90;
    if (f > 45) f = 90 - f;
    read++;
    if (f < 10) nearAxis++;
  }
  assert.ok(read > 1000 && nearAxis / read < 0.2, `${(100 * nearAxis / read).toFixed(1)}% of ${read} headings within 10 degrees of an axis`);
  // the law under the numbers: each warp folds nothing, each turn a rotation
  for (const fam of JUNGLE_TRAILS.families) {
    assert.ok(warpStretch(fam) < 2, `the warp's stretch ${warpStretch(fam)}`);
    assert.ok(Math.abs(fam.turn[0] ** 2 + fam.turn[1] ** 2 - 1) < 1e-12, 'a turn is a rotation');
  }
  assert.ok(JUNGLE_TRAILS.half > Math.SQRT1_2, 'past a corner\'s diagonal half');
});

test('JUNGLE-TRAILS the painter: a trail runs on across every pixel\'s edge, east and north; it reads the field a block at a time and paints exactly the corners every corner read would; dirt never on water nor in a location\'s rect; its tiles - every tile two of whose corners are the trail\'s, half dirt by its art, no painter wrote - into the paths (mutants: the frame mirrored north-south; the culling\'s reach gone; the kept blocks another row\'s; the water painted; the rect painted; a tile by one corner; a tile by three; a road\'s tile marked)', () => {
  // the edges: a row of pixels east to west and a column north to south, each edge's corners the same from both sides
  let across = 0;
  for (let px = 930; px < 946; px++) {
    const a = paint(px, 300).td, b = paint(px + 1, 300).td;
    for (let y = 0; y < D; y++) { assert.equal(a[T + y * D], b[y * D], `${px}|${px + 1} at row ${y}`); across += a[T + y * D] === 1 ? 1 : 0; }
  }
  for (let py = 290; py < 306; py++) {
    const a = paint(940, py).td, north = paint(940, py - 1).td;
    for (let x = 0; x < D; x++) { assert.equal(a[x + T * D], north[x], `${py} under ${py - 1} at column ${x}`); across += a[x + T * D] === 1 ? 1 : 0; }
  }
  assert.ok(across >= 8, `trail corners on the edges read (${across})`);
  // the culling: the same corners as every corner read
  let trail = 0;
  for (const [px, py] of [[940, 300], [941, 300], [955, 318], [839, 302], [737, 289], [737, 290]]) {   // the last two one column: the kept blocks are a pixel's own
    const { dirt } = paint(px, py);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) { const want = brute(px, py, x, y); trail += want ? 1 : 0; assert.equal(dirt[x + y * D] === 1, want, `${px},${py} corner ${x},${y}`); }
  }
  assert.ok(trail > 300, `corners read (${trail})`);
  // water and a location: a pixel whose trail crosses both a lake's rows (its first twenty) and a town's rect
  const rect = { xMin: 40, xMax: 90, yMin: 40, yMax: 90 };
  const inRect = (x, y) => x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
  let wet = 0, town = 0;
  for (let px = 900; px < 930; px++) {
    const td = grass();
    for (let i = 0; i < 20 * D; i++) td[i] = 0;
    const tm = new Uint8Array(T * T);
    for (let t = 0; t < T * T; t += 37) tm[t] = 46;   // a road the painter laid, a tile in 37
    const { td: out, paths, dirt } = paint(px, 300, { td, tm, rect });
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const i = x + y * D, want = brute(px, 300, x, y);
      if (y < 20) { assert.equal(out[i], 0, 'water stays water'); wet += want ? 1 : 0; continue; }
      if (inRect(x, y)) { assert.equal(out[i], 2, 'the town\'s ground its own'); town += want ? 1 : 0; continue; }
      assert.equal(dirt[i] === 1, want);
    }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const t = y * T + x, i = x + y * D, half = dirt[i] + dirt[i + 1] + dirt[i + D] + dirt[i + D + 1] >= 2;
      assert.equal(!!paths?.[t], half && tm[t] === 0, `${px}: tile ${x},${y}`);
    }
  }
  assert.ok(wet > 20 && town > 20, `the trail met the water (${wet}) and the town (${town})`);
  // nothing painted, nothing allocated: the mask handed back as handed
  assert.equal(paint(940, 300, { nine: OUTSIDE }).paths, null, 'outside the jungle: no mask');
  assert.equal(paint(940, 300, { nine: OUTSIDE }).n, 0);
  const handed = new Uint8Array(T * T);
  assert.equal(paint(940, 300, { paths: handed }).paths, handed, 'the mask handed is the one marked');
});

test('JUNGLE-TRAILS the gate: a trail only where the jungle is whole - every dirt corner JUNGLE_EDGE.in deep, the line\'s corners nearer the edge left as they were (mutants: the gate gone; the reach test answering none)', () => {
  let shallow = 0, painted = 0;
  for (let px = 900; px < 940; px++) {
    const { dirt } = paint(px, 300, { nine: EDGE });
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      if (!brute(px, 300, x, y)) { assert.equal(dirt[x + y * D], 0); continue; }
      const deep = jungleDepthAt(px, 300, EDGE, x * S, y * S) >= JUNGLE_EDGE.in;
      assert.equal(dirt[x + y * D] === 1, deep, `${px} corner ${x},${y}`);
      if (deep) painted++; else shallow++;
    }
  }
  assert.ok(painted > 50 && shallow > 50, `the edge's pixels read (${painted} painted, ${shallow} left)`);
});

const flatPixel = () => ({ hm: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill((SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT) * 1.6), tm: new Uint8Array(T * T).fill(2) });

test('JUNGLE-TRAILS the trees: a jungle tree\'s foot clear of a trail\'s dirt, as VERGE1 keeps it off a road - the canopy and the young; a palm and a plant off its tiles; where the jungle is not whole and no trail runs, the trees stand as they stood (mutants: the canopy\'s foot unread; the young trees\'; the gate unread; the block\'s floor without the half width)', () => {
  let canopy = 0, young = 0, kept = 0;
  for (const [px, py] of [[940, 300], [955, 318], [839, 302]]) {
    const { paths } = paint(px, py);
    const g = flatPixel();
    const out = withJungle([], g.hm, g.tm, { mapPixelX: px, mapPixelY: py, locationRect: null, jungle: { nine: WHOLE, pois: [], paths } });
    for (const f of out) {
      const t = Math.floor(f.z / S) * T + Math.floor(f.x / S);
      if (f.jungle != null) {
        const foot = JUNGLE_MEASURES[f.jungle].foot * f.js;
        assert.ok(trailRoom(px, py, f.x, f.z) >= foot, `${px},${py}: a tree (${f.jungle}, ${f.js.toFixed(2)}) ${trailRoom(px, py, f.x, f.z).toFixed(1)} m from a trail, its foot ${foot.toFixed(1)}`);
        if (f.js >= JUNGLE.canopyScale[0]) canopy++; else young++;
        if (trailRoom(px, py, f.x, f.z) < foot + 3) kept++;
      } else if (JUNGLE_PALMS.includes(f.record) || JUNGLE_COVER.includes(f.record)) {
        assert.ok(!paths[t], `${px},${py}: a palm or a plant on a trail's tile`);
      }
    }
  }
  assert.ok(canopy > 3 * 1100 && young > 3 * 800, `the jungle still stands (${canopy} canopy, ${young} young)`);
  assert.ok(kept > 20, `trees beside the trails (${kept} within 3 m of their foot)`);
  // the foot's question, its block's floor first: the same answer as the point's own distance, every reach a tree has
  let clear = 0, near = 0;
  for (const [px, py] of [[940, 300], [955, 318]]) {
    for (let k = 0; k < 6000; k++) {
      const x = ((k * 7919) % 8192) / 10, z = ((k * 104729) % 8192) / 10;
      for (const reach of [0, 2.5, 6, 13.2]) {
        const want = trailRoom(px, py, x, z) >= reach;
        assert.equal(trailClear(px, py, x, z, reach), want, `${px},${py} (${x}, ${z}) reach ${reach}`);
        if (want) clear++; else near++;
      }
    }
  }
  assert.ok(near > 300 && clear > 30000, `points read (${near} near a trail, ${clear} clear)`);
  // the edge: a tree on a tile the jungle does not own whole stands within its foot of a line no trail was painted on
  let edgeTrees = 0;
  for (let px = 900; px < 930; px++) {
    const g = flatPixel();
    const out = withJungle([], g.hm, g.tm, { mapPixelX: px, mapPixelY: 300, locationRect: null, jungle: { nine: EDGE, pois: [], paths: null } });
    for (const f of out) {
      if (f.jungle == null) continue;
      const shallow = jungleDepthAt(px, 300, EDGE, (Math.floor(f.x / S) + 0.5) * S, (Math.floor(f.z / S) + 0.5) * S) < JUNGLE_EDGE.in;
      if (shallow && trailRoom(px, 300, f.x, f.z) < JUNGLE_MEASURES[f.jungle].foot * f.js) edgeTrees++;
    }
  }
  assert.ok(edgeTrees > 5, `trees where no trail runs, near its line (${edgeTrees})`);
});

// the distantland fake woods (test/world/terrain/terrainworker.test.js's): heights over the sea
const fakeWoods = {
  getHeightMapValuesRange1Dim(mx, my, d) {
    const a = new Float32Array(d * d);
    for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1);
    return a;
  },
  getLargeHeightMapValuesRange(mx, my, span) {
    const d = span * 3, a = new Float32Array(d * d);
    for (let x = 0; x < d; x++) for (let y = 0; y < d; y++) a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3);
    return a;
  },
  getHeightMapValue(px, py) { return (px * 7 + py * 3) % 200; },
};

test('JUNGLE-TRAILS the kernel: a jungle pixel\'s trails worn into its tiles before the squares run - its tiles changed only on a trail\'s tiles and their edges, its heights never; no jungle, no mask (mutants: the kernel\'s hook gone)', () => {
  let marked = 0;
  for (const [px, py] of [[940, 300], [955, 318]]) {
    const job = { woods: fakeWoods, px, py, climateType: 228 };
    const off = generatePixelTerrain({ ...job, tilemap: new Uint8Array(T * T) });
    const on = generatePixelTerrain({ ...job, tilemap: new Uint8Array(T * T), jungle: { nine: WHOLE } });
    assert.equal(off.paths, null, 'no network, no jungle: no mask');
    assert.ok(on.paths, 'the jungle\'s trails: a mask');
    let changed = 0;
    for (let t = 0; t < T * T; t++) {
      if (on.tilemap[t] === off.tilemap[t]) continue;
      // a tile the trail's art reaches is its own, or its edge: a corner of dirt shared with one of its own
      changed++;
      const x = t % T, y = (t - x) / T;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < T && y + dy < T && on.paths[(y + dy) * T + x + dx]) near = true;
      assert.ok(near, `tile ${x},${y} changed away from the trail`);
      marked += on.paths[t];
    }
    assert.ok(changed > 0, `${px},${py}: the trail drawn`);
    assert.deepEqual(on.samples, off.samples, 'the heights never moved');
    assert.deepEqual(on.positions, off.positions);
  }
  assert.ok(marked > 100, `trail tiles (${marked})`);
});
