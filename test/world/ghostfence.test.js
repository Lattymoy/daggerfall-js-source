// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): the Tribunal's fence round Red Mountain - its ring of
// pylons at the summit cone's foot and Ghostgate in the south (world/tamriel/ghostfence.js), the countryside kept off
// inside it, no lair on its line and no road across it but at Ghostgate (the rolls, the roads' build), its models and
// pictures (ghostfenceModel.js), stood and solid in a pixel's build (scenes/ghostfenceBuild.js), and its glow on the
// ground each far layer draws (render/ghostfenceGlow.js). With ARENA2, on the freeware's trace: the countryside gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';
import {
  GHOSTFENCE_DIALS, GHOSTFENCE_PYLONS, GHOSTGATE_HALF, ghostfenceFrame, ghostfenceRadius, insideGhostfence, onGhostfence,
  ghostfenceRoadBlocks, ghostfencePylonsIn, ghostfencePanel, sampleToPixel,
} from '../../src/world/tamriel/ghostfence.js';
import { redMountainFrame, dirOf, coneProfile, RED_MOUNTAIN_DIALS } from '../../src/world/tamriel/redMountain.js';
import { pylonModel, pylonSolid, ghostgateModel, ghostgateSolid, ghostfencePictures, GHOSTFENCE_ARCHIVE, GF_RECORD, PYLON, CURTAIN, GHOSTGATE } from '../../src/world/tamriel/ghostfenceModel.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { TERRAIN_SIZE, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { MAP_HEIGHT } from '../../src/formats/woodsFile.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const G = GHOSTFENCE_DIALS;
const SAMPLE_M = TERRAIN_SIZE / 128;
const A = process.env.ARENA2_PATH ?? '';
const HAVE = !!A && existsSync(join(A, 'MAPS.BSA'));

test('GHOSTFENCE the ring: about Red Mountain\'s centre at its radius, wandering within its share and closing on itself, a pylon every 48 m, each one\'s tangent its own, Ghostgate the one due south; the line it crosses closed and 4-connected (no 8-step crosses it), each pylon in its own pixel, the gate\'s pixels the only open ones (mutants: the radius, the wander\'s noise, the spacing, the gate\'s turn, the band\'s corners, the open set)', () => {
  const rm = redMountainFrame(), f = ghostfenceFrame();
  assert.ok(rm && f, 'a fence on the authored shape');
  assert.equal(f.n, GHOSTFENCE_PYLONS);
  assert.equal(f.n, Math.round((2 * Math.PI * G.radius) / G.spacing));
  assert.deepEqual([f.cx, f.cy], [rm.cx, rm.cy]);
  let lo = Infinity, hi = -Infinity, gapLo = Infinity, gapHi = -Infinity, rLo = Infinity, rHi = -Infinity;
  for (let i = 0; i < f.n; i++) {
    const dx = (f.pts[2 * i] - f.cx) * SAMPLE_M, dy = (f.pts[2 * i + 1] - f.cy) * SAMPLE_M, r = Math.hypot(dx, dy);
    const [ux, uy] = dirOf(i / f.n);
    assert.ok(Math.abs(dx / r - ux) < 1e-9 && Math.abs(dy / r - uy) < 1e-9, `pylon ${i} on its turn`);
    assert.ok(Math.abs(r - ghostfenceRadius(ux, uy)) < 1e-6);
    lo = Math.min(lo, r); hi = Math.max(hi, r);
    const j = (i + 1) % f.n, gap = Math.hypot(f.pts[2 * j] - f.pts[2 * i], f.pts[2 * j + 1] - f.pts[2 * i + 1]) * SAMPLE_M;
    gapLo = Math.min(gapLo, gap); gapHi = Math.max(gapHi, gap);
    const tx = f.tan[2 * i], ty = f.tan[2 * i + 1];
    assert.ok(Math.abs(Math.hypot(tx, ty) - 1) < 1e-9 && Math.abs(tx * dx + ty * dy) / r < 0.2, `pylon ${i}'s tangent round the ring`);
    assert.ok(tx * -dy + ty * dx > 0, 'counter-clockwise');
    rLo = Math.min(rLo, ghostfenceRadius(ux, uy)); rHi = Math.max(rHi, ghostfenceRadius(ux, uy));
  }
  assert.ok(lo >= G.radius * (1 - G.wander.amp) - 1e-6 && hi <= G.radius * (1 + G.wander.amp) + 1e-6, `within its wander (${lo.toFixed(0)}-${hi.toFixed(0)} m)`);
  assert.ok(hi - lo > 400, `and it wanders (${(hi - lo).toFixed(0)} m)`);
  let sum = 0;
  for (let i = 0; i < f.n; i++) sum += Math.hypot(f.pts[2 * i] - f.cx, f.pts[2 * i + 1] - f.cy) * SAMPLE_M;
  assert.ok(Math.abs(sum / f.n - 14000) < 100, `about its radius (${(sum / f.n).toFixed(0)} m on the mean)`);
  assert.ok(gapLo > 42 && gapHi < 54, `a pylon every ${gapLo.toFixed(1)}-${gapHi.toFixed(1)} m`);
  // Ghostgate due south of the centre, at the summit cone's foot (the flank's grade about 3 degrees there)
  const gx = (f.pts[2 * f.gate] - f.cx) * SAMPLE_M, gy = (f.pts[2 * f.gate + 1] - f.cy) * SAMPLE_M;
  assert.ok(gy < -G.radius * 0.9 && Math.abs(gx) < G.spacing, `Ghostgate south (${gx.toFixed(0)}, ${gy.toFixed(0)})`);
  assert.equal(f.gate, Math.round(0.75 * f.n));
  assert.ok(G.radius > RED_MOUNTAIN_DIALS.rim + RED_MOUNTAIN_DIALS.tiers[0].reach && coneProfile(G.radius - RED_MOUNTAIN_DIALS.rim) > 1000, 'past the summit cone, on the flank');
  // the band: every pylon's pixel in it, each pylon in one pixel, closed against an 8-step walk from outside
  const seen = new Set();
  for (const [k, list] of f.byPixel) {
    assert.ok(f.band.has(k));
    for (const i of list) { assert.ok(!seen.has(i)); seen.add(i); assert.equal(sampleToPixel(f.pts[2 * i], f.pts[2 * i + 1]).join(','), k); }
  }
  assert.equal(seen.size, f.n, 'every pylon in a pixel');
  for (const k of f.band) { const [x, y] = k.split(',').map(Number); assert.ok(x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1); }
  for (let i = 0; i < f.n; i++) {
    const j = (i + 1) % f.n;
    for (let t = 0; t <= 64; t++) {
      const k = sampleToPixel(f.pts[2 * i] + (f.pts[2 * j] - f.pts[2 * i]) * (t / 64), f.pts[2 * i + 1] + (f.pts[2 * j + 1] - f.pts[2 * i + 1]) * (t / 64)).join(',');
      assert.ok(f.band.has(k), `the line from pylon ${i} passes (${k}), the band's`);
    }
  }
  const walk = new Set(), q = [[f.x0 - 1, f.y0 - 1]];
  while (q.length) {
    const [x, y] = q.pop(), k = `${x},${y}`;
    if (walk.has(k) || x < f.x0 - 1 || x > f.x1 + 1 || y < f.y0 - 1 || y > f.y1 + 1 || f.band.has(k)) continue;
    walk.add(k);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) q.push([x + dx, y + dy]);
  }
  const [cpx, cpy] = sampleToPixel(f.cx, f.cy);
  assert.equal(walk.has(`${cpx},${cpy}`), false, 'no 8-step walk from outside reaches the centre');
  const [gpx, gpy] = f.gatePixel.split(',').map(Number), about = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (f.band.has(`${gpx + dx},${gpy + dy}`)) about.push(`${gpx + dx},${gpy + dy}`);
  assert.deepEqual([...f.open].sort(), about.sort(), 'the gate\'s pixels the open ones: the band about its own');
  assert.ok(f.open.has(f.gatePixel));
  assert.equal(f.gatePixel, sampleToPixel(f.pts[2 * f.gate], f.pts[2 * f.gate + 1]).join(','));
  // a run's ends: two feet, or a foot and the gate's tower face
  const [a, b] = ghostfencePanel(f, 5);
  assert.deepEqual([a, b], [[f.pts[10], f.pts[11]], [f.pts[12], f.pts[13]]]);
  const [, toGate] = ghostfencePanel(f, f.gate - 1), [fromGate] = ghostfencePanel(f, f.gate);
  const off = (p) => Math.hypot(p[0] - f.pts[2 * f.gate], p[1] - f.pts[2 * f.gate + 1]) * SAMPLE_M;
  assert.ok(Math.abs(off(toGate) - GHOSTGATE_HALF) < 1e-6 && Math.abs(off(fromGate) - GHOSTGATE_HALF) < 1e-6, 'the gate\'s runs end at its towers');
  assert.ok((toGate[0] - f.pts[2 * f.gate]) * f.tan[2 * f.gate] + (toGate[1] - f.pts[2 * f.gate + 1]) * f.tan[2 * f.gate + 1] < 0, 'the run before it on the near side');
  // it moves with the volcano's frame
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try { const g = ghostfenceFrame(); assert.notEqual(g, f); assert.deepEqual([g.cx, g.cy], [redMountainFrame().cx, redMountainFrame().cy]); }
  finally { setTamrielFit(null); }
  assert.deepEqual([ghostfenceFrame().cx, ghostfenceFrame().cy], [f.cx, f.cy], 'and back');
});

test('GHOSTFENCE the places and the roads: the countryside keeps off inside the fence and a pixel past it (countryPick, every reader\'s), no lair on its line (lairStandsAt, lairMayStandAt), the roads\' build routes round its line but at Ghostgate; GROUND_ROLL_VERSION moved with them (mutants: the countryside\'s keep, the lairs\' line, the roads\' blocks)', async () => {
  const f = ghostfenceFrame();
  const [cpx, cpy] = sampleToPixel(f.cx, f.cy);
  assert.equal(insideGhostfence(cpx, cpy), true, 'the centre');
  const centreOf = (px, py) => [(px + 0.5) * 128, (MAP_HEIGHT + 0.5 - py) * 128];
  let ins = 0, outs = 0;
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) {
    const px = cpx + dx, py = cpy + dy, [gx, gy] = centreOf(px, py), ex = gx - f.cx, ey = gy - f.cy, ds = Math.hypot(ex, ey), d = ds * SAMPLE_M;
    const edge = ghostfenceRadius(ex / ds, ey / ds) + G.keep;
    if (Math.abs(d - edge) < 2) continue;
    assert.equal(insideGhostfence(px, py), d < edge, `(${px}, ${py}) at ${d.toFixed(0)} m, the edge ${edge.toFixed(0)} m`);
    if (d < edge) ins++; else outs++;
    if (f.band.has(`${px},${py}`)) assert.equal(insideGhostfence(px, py), true, 'the line inside the keep');
    assert.equal(onGhostfence(px, py), f.band.has(`${px},${py}`));
  }
  assert.ok(ins > 800 && outs > 1000);
  assert.equal(insideGhostfence(cpx + 400, cpy), false);
  const C = await import('../../src/world/tamrielCountry.js');
  const Dg = await import('../../src/world/tamrielDungeons.js');
  const T = (await import('../../src/formats/mapsFile.js')).LOCATION_TYPES;
  // a roll that stands a farm on every pixel of climate 230
  const rates = new Map([[230, [[T.HomeFarms, 1]]]]), templates = new Map([[T.HomeFarms, [{ id: 'farm' }]]]);
  assert.equal(C.countryPick(rates, templates, 230, cpx, cpy), null, 'none at the centre');
  assert.equal(C.countryPick(rates, templates, 230, cpx + 25, cpy)?.type, T.HomeFarms, 'past it, the roll as it was');
  const [lx, ly] = [...f.band][7].split(',').map(Number);
  assert.equal(C.countryMayStandAt({ rates, templates, climateAt: () => 230, heightAt: () => 40 }, lx, ly), false, 'none on the line');
  // a lair whose site falls on the line stands nowhere, by either test
  let site = null;
  for (const k of f.band) {
    const [x, y] = k.split(',').map(Number), c = Dg.lairCellOf(x, y), s = c >= 0 ? Dg.lairSite(c) : null;
    if (s && s.px === x && s.py === y) { site = { c, ...s }; break; }
  }
  assert.ok(site, 'a lair\'s site on the line');
  {
    const lrates = new Map([[230, [[Dg.LAIR_TYPES[0], 1]]]]), ltemplates = new Map([[Dg.LAIR_TYPES[0], [{ dungeon: { blocks: [] } }]]]);
    const roll = { rates: lrates, templates: ltemplates, climateAt: () => 230, heightAt: () => 40, ground: () => true };
    assert.equal(Dg.lairStandsAt(roll, site.px, site.py), null, `no lair at (${site.px}, ${site.py}), on the line`);
    assert.equal(Dg.lairMayStandAt(roll, site.px, site.py), false);
  }
  assert.match(read('src/world/tamrielDungeons.js'), /site\.px === px && site\.py === py && !onGhostfence\(px, py\) \? lairPick/);
  assert.match(read('src/world/tamrielDungeons.js'), /site\.px === px && site\.py === py && !onGhostfence\(px, py\) && lairPick/);
  // the roads: the band less Ghostgate's pixels blocked in every region's build
  const blocks = ghostfenceRoadBlocks();
  assert.equal(blocks.length, f.band.size - f.open.size);
  assert.ok(blocks.every((b) => f.band.has(`${b.x},${b.y}`) && !f.open.has(`${b.x},${b.y}`)));
  assert.match(read('src/world/tamrielRoads.js'), /for \(const o of \[\.\.\.obstacles, \.\.\.held, \.\.\.ghostfenceRoadBlocks\(\)\]\) \{/);
  const R = await import('../../src/world/tamrielRoads.js');
  assert.equal(R.GROUND_ROLL_VERSION, 6, 'every client\'s roads laid again with the fence');
});

test('GHOSTFENCE the roads\' build: two towns either side of the fence are joined round it - their road never on its line but at Ghostgate\'s pixels (the real builder over a flat grid)', async () => {
  const R = await import('../../src/world/tamrielRoads.js');
  const T = (await import('../../src/formats/mapsFile.js')).LOCATION_TYPES;
  const { beyondKey } = await import('../../src/world/arenaRoads.js');
  const f = ghostfenceFrame(), [cpx, cpy] = sampleToPixel(f.cx, f.cy);
  const lattice = R.regionLattice({ x0: cpx - 500, y0: cpy - 250, w: 1000, h: 500 });
  const [i, j] = R.regionAt(lattice, cpx, cpy), region = R.regionOf(lattice, i, j);
  const west = { x: cpx - 26, y: cpy, type: T.TownCity }, east = { x: cpx + 26, y: cpy, type: T.TownCity };
  const out = R.buildTamrielRegion({ region, places: [], nodes: [west, east], obstacles: [], gates: [], heightAt: () => 40 });
  const onRoad = [...out.roads.keys()];
  assert.ok(onRoad.length > 52, `a road laid (${onRoad.length} pixels)`);
  for (const k of f.band) {
    if (f.open.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    assert.equal(out.roads.has(beyondKey(x, y)), false, `no road on the fence at (${x}, ${y})`);
  }
  assert.equal(out.roads.has(beyondKey(cpx, cpy)), false, 'none over the mountain');
});

test('GHOSTFENCE the models: the pylon (plinth, banded shaft, collar, four horns, the orb they hold) and Ghostgate (two towers, their tops and orbs, the lintel over the passage) wound out of their solids, on GHOSTFENCE_ARCHIVE\'s stone and orb; their solids the plinth and shaft, the towers and the lintel, the passage open; the pictures painted, opaque (mutants: a face\'s winding, the ball\'s, the passage)', () => {
  const outward = (m) => {
    const P = m.positions, N = m.normals, I = m.indices;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
      const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]), v = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
      const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const n = [0, 1, 2].map((k) => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
      if (x[0] * n[0] + x[1] * n[1] + x[2] * n[2] < -1e-9) return false;
    }
    return true;
  };
  const yRange = (m) => { let lo = Infinity, hi = -Infinity; for (let i = 1; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]); } return [lo, hi]; };
  const p = pylonModel(), g = ghostgateModel();
  for (const [name, m] of [['pylon', p], ['gate', g], ['pylon solid', pylonSolid()], ['gate solid', ghostgateSolid()]]) {
    assert.ok(outward(m), `${name}: every face out of its solid`);
    assert.equal(m.indices.length % 3, 0);
    assert.ok(m.subMeshes.every((s) => s.textureArchive === GHOSTFENCE_ARCHIVE));
    assert.equal(m.subMeshes.reduce((s, sm) => s + sm.primitiveCount * 3, 0), m.indices.length);
  }
  assert.deepEqual(p.subMeshes.map((s) => s.textureRecord), [GF_RECORD.stone, GF_RECORD.orb]);
  assert.deepEqual(yRange(p).map((v) => Math.round(v * 10) / 10), [-PYLON.sink, PYLON.horns.tip[1]], 'sunk under its foot, its horns its top');
  assert.ok(Math.abs(yRange(g)[1] - (GHOSTGATE.height + GHOSTGATE.cornice + GHOSTGATE.top[2] + GHOSTGATE.orb.over + GHOSTGATE.orb.r)) < 1e-4, 'the towers\' orbs its top');
  // the orb about its height, of its radius
  const orbStart = p.subMeshes[1].startIndex, orbIdx = p.indices.slice(orbStart);
  for (const v of orbIdx) { const d = Math.hypot(p.positions[v * 3], p.positions[v * 3 + 1] - PYLON.orb.at, p.positions[v * 3 + 2]); assert.ok(Math.abs(d - PYLON.orb.r) < 1e-4); }
  // the gate's passage open under the lintel: no solid face crosses its middle below the lintel
  const S = ghostgateSolid(), P = S.positions;
  for (let t = 0; t < S.indices.length; t += 3) {
    const vs = [0, 1, 2].map((k) => S.indices[t + k]), xs = vs.map((v) => P[v * 3]), ys = vs.map((v) => P[v * 3 + 1]);
    if (Math.max(...ys) < GHOSTGATE.lintel[0] - 1e-6) assert.ok(Math.min(...xs) >= GHOSTGATE.passage - 1e-6 || Math.max(...xs) <= -GHOSTGATE.passage + 1e-6, 'nothing solid in the passage');
  }
  assert.equal(GHOSTGATE.half, GHOSTGATE_HALF);
  assert.ok(yRange(pylonSolid())[1] >= PYLON.collar.to, 'solid to its collar');
  for (const m of [pylonSolid(), pylonModel()]) {
    const P = m.positions, N = m.normals, I = m.indices, end = m === pylonModel() ? m.subMeshes[0].primitiveCount * 3 : I.length;
    let sides = 0;
    for (let t = 0; t < end; t += 3) {
      const c = [0, 2].map((k) => (P[I[t] * 3 + k] + P[I[t + 1] * 3 + k] + P[I[t + 2] * 3 + k]) / 3), n = N[I[t] * 3 + 1];
      const top = Math.max(P[I[t] * 3 + 1], P[I[t + 1] * 3 + 1], P[I[t + 2] * 3 + 1]);
      if (Math.abs(n) > 0.5 || top > PYLON.collar.to + PYLON.collar.rim + 1e-6) continue;   // its tops and its horns aside
      assert.ok(N[I[t] * 3] * c[0] + N[I[t] * 3 + 2] * c[1] > 0, 'a side faces out from the pylon\'s axis');
      sides++;
    }
    assert.ok(sides > 8);
  }
  const pics = ghostfencePictures();
  for (const pic of [pics.stone, pics.orb]) {
    assert.equal(pic.data.length, pic.width * pic.height * 4);
    for (let i = 3; i < pic.data.length; i += 4) assert.equal(pic.data[i], 255);
  }
  assert.deepEqual(ghostfencePictures().stone.data, pics.stone.data, 'the same on every client');
  const lum = (pic) => { let s = 0; for (let i = 0; i < pic.data.length; i += 4) s += pic.data[i] + pic.data[i + 1] + pic.data[i + 2]; return s / (pic.data.length / 4) / 3; };
  assert.ok(lum(pics.stone) < 70 && lum(pics.orb) > 150, 'dark basalt, a pale light');
  assert.ok(CURTAIN.from < 0 && CURTAIN.to < PYLON.collar.to);
});

test('GHOSTFENCE the build: a pixel the fence crosses stands each pylon on the ground at its centre, a footing down to the lowest under its plinth where it stands over it, Ghostgate on the lowest under its own, in the batch on their own pictures and solid through the gate with the pixel\'s floating frame; each piece of the curtain\'s solid whose middle is in it from under its lowest ground to the collars over its highest, one solid a run; its feet and curtain points noted for the glow; a pixel off the fence stands nothing (AUDIT RED-MOUNTAIN N1/N4 - PIN MOVED: a run was one flat quad on its two feet, and a pylon seated on its lowest ground) (mutants: the seat, the footing, the solid, the pieces, the feet)', async () => {
  const { standGhostfence, footMatrix, CURTAIN_SOLID_TOP, groundAlong } = await import('../../src/scenes/ghostfenceBuild.js');
  const { fenceFeet } = await import('../../src/render/ghostfenceGlow.js');
  const { ghostfenceRunCuts, ghostfenceCurtainPoint, CURTAIN_STEPS } = await import('../../src/world/tamriel/ghostfence.js');
  const { pylonFooting } = await import('../../src/world/tamriel/ghostfenceModel.js');
  const { surfaceHeightAt } = await import('../../src/world/terrain/terrainSurface.js');
  const f = ghostfenceFrame();
  const W = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, hDim = 129;
  const plane = (ex, nz) => { const a = new Float32Array(hDim * hDim); for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) a[x * hDim + z] = 0.4 + (ex * x * SAMPLE_M + nz * z * SAMPLE_M) / W; return a; };
  const run = (px, py, samples) => {
    const uploads = [], statics = [], boxes = [], solids = [];
    const translation = { tag: 'frame' };
    const n = standGhostfence({ px, py, pkey: `${px},${py}`, key: `k${px},${py}`, samples,
      renderer: { uploadTexture: (a, r) => uploads.push(['t', a, r]), uploadEmissionTexture: (a, r, c, o) => uploads.push(['e', a, r, o.white]) },
      addStatic: (cpu, m, own) => statics.push({ cpu, m, own }), unionBox: (b) => boxes.push(b), late: { add: (k, pos, idx, m, o) => solids.push({ k, pos, idx, m, o }) }, translation });
    return { n, uploads, statics, boxes, solids, translation };
  };
  const [k0] = [...f.byPixel.keys()].filter((k) => k !== f.gatePixel), [px, py] = k0.split(',').map(Number);
  const here = ghostfencePylonsIn(px, py), runs = f.runsBy.get(k0), gentle = plane(0.02, 0.03), r = run(px, py, gentle);
  assert.equal(r.n, here.length);
  assert.deepEqual(r.uploads, [['t', GHOSTFENCE_ARCHIVE, GF_RECORD.stone], ['t', GHOSTFENCE_ARCHIVE, GF_RECORD.orb], ['e', GHOSTFENCE_ARCHIVE, GF_RECORD.orb, true]]);
  assert.equal(r.statics.length, here.length, 'on gentle ground no footing');
  assert.ok(r.statics.every((s) => s.own && s.cpu === pylonModel()), 'own pictures, no climate\'s');
  assert.equal(r.boxes.length, here.length);
  const curtains = r.solids.slice(here.length);
  assert.ok(r.solids.every((s) => s.k === `k${px},${py}` && s.o.translation === r.translation), 'the build\'s key, the pixel\'s floating frame');
  here.forEach((_, j) => assert.equal(r.solids[j].pos, pylonSolid().positions, 'a pylon\'s solid its plinth and shaft'));
  const ox = px * 128, oy = (MAP_HEIGHT - py) * 128, ground = (x, z) => 0.4 * W + 0.02 * x + 0.03 * z;
  here.forEach((i, j) => {
    const x = (f.pts[2 * i] - ox) * SAMPLE_M, z = (f.pts[2 * i + 1] - oy) * SAMPLE_M, m = r.statics[j].m;
    assert.ok(x >= 0 && x <= TERRAIN_SIZE && z >= 0 && z <= TERRAIN_SIZE, 'its foot in the pixel');
    assert.ok(Math.abs(m[13] - ground(x, z)) < 1e-3, `pylon ${i} on the ground at its centre`);
    assert.deepEqual(Array.from(m), Array.from(footMatrix(m[12], m[13], m[14], f.tan[2 * i], f.tan[2 * i + 1])));
    assert.ok(Math.abs(m[12] - x) < 1e-3 && Math.abs(m[14] - z) < 1e-3);
  });
  const m = r.statics[0].m, det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  assert.ok(Math.abs(det - 1) < 1e-6, 'the turn is a rotation, not a mirror (the merge would turn every face over)');
  // the curtain: one solid a run with a piece here; each piece 6.4 m at most, in this pixel, under its lowest and over its highest
  const { ghostfenceRunCuts: cutsOf } = await import('../../src/world/tamriel/ghostfence.js');
  const withPiece = runs.filter((i) => { const c = cutsOf(f, i); for (let k = 0; k + 3 < c.length; k += 2) if (sampleToPixel((c[k] + c[k + 2]) / 2, (c[k + 1] + c[k + 3]) / 2).join() === k0) return true; return false; });
  assert.ok(withPiece.length >= here.length && withPiece.length <= runs.length);
  assert.equal(curtains.length, withPiece.length, 'a solid a run with a piece here (a run may touch the pixel by a curtain point alone)');
  for (const c of curtains) {
    assert.equal(c.idx.length, (c.pos.length / 12) * 6);
    for (let q = 0; q < c.pos.length / 12; q++) {
      const P = (k) => [c.pos[12 * q + 3 * k], c.pos[12 * q + 3 * k + 1], c.pos[12 * q + 3 * k + 2]];
      const [a, b, bt, at] = [P(0), P(1), P(2), P(3)];
      assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) <= SAMPLE_M + 1e-6, 'a piece a sample at most');
      for (const e of [a, b]) assert.ok(e[0] >= -1e-3 && e[0] <= TERRAIN_SIZE + 1e-3 && e[2] >= -1e-3 && e[2] <= TERRAIN_SIZE + 1e-3, `in the pixel: ${e}`);   // float32's rounding at 819 m
      const lo = Math.min(ground(a[0], a[2]), ground(b[0], b[2])), hi = Math.max(ground(a[0], a[2]), ground(b[0], b[2]));
      assert.ok(Math.abs(a[1] - (lo + CURTAIN.from)) < 1e-2 && Math.abs(b[1] - a[1]) < 1e-6, 'under its lowest ground');
      assert.ok(Math.abs(at[1] - (hi + CURTAIN_SOLID_TOP)) < 1e-2 && Math.abs(bt[1] - at[1]) < 1e-6, 'to the collars over its highest');
    }
  }
  // every piece of every run built by one pixel alone: the pieces' middles, each in one band pixel's runs
  let pieces = 0;
  for (let i = 0; i < f.n; i++) {
    const cuts = ghostfenceRunCuts(f, i);
    for (let c = 0; c + 3 < cuts.length; c += 2) {
      const [mx, my] = sampleToPixel((cuts[c] + cuts[c + 2]) / 2, (cuts[c + 1] + cuts[c + 3]) / 2);
      assert.ok(f.runsBy.get(`${mx},${my}`)?.includes(i), `run ${i}'s piece ${c / 2} with its pixel`);
      pieces++;
    }
    const [a0, a1] = [cuts[0], cuts[1]], [b0, b1] = [cuts[cuts.length - 2], cuts[cuts.length - 1]], [[pa0, pa1], [pb0, pb1]] = ghostfencePanel(f, i);
    assert.deepEqual([a0, a1, b0, b1], [pa0, pa1, pb0, pb1], 'end to end');
  }
  assert.ok(pieces >= f.n * 8, `${pieces} pieces`);
  // the feet and the curtain points noted, on the pixel's ground, for this frame
  const feet = fenceFeet().map.get(k0);
  assert.equal(feet.frame, f);
  assert.deepEqual(feet.idx, here);
  assert.deepEqual(Array.from(feet.seats), r.statics.map((s) => Math.fround(s.m[13])));
  const allIn = []; for (let p = 0; p < f.n * (CURTAIN_STEPS + 1); p++) if (sampleToPixel(...ghostfenceCurtainPoint(f, Math.floor(p / (CURTAIN_STEPS + 1)), p % (CURTAIN_STEPS + 1))).join() === k0) allIn.push(p);
  assert.deepEqual([...feet.points].sort((a, b) => a - b), allIn, 'every curtain point in the pixel noted (a run touching it by a point alone too)');
  feet.points.forEach((p, j) => {
    const [gx, gy] = ghostfenceCurtainPoint(f, Math.floor(p / (CURTAIN_STEPS + 1)), p % (CURTAIN_STEPS + 1));
    assert.equal(sampleToPixel(gx, gy).join(), k0);
    assert.ok(Math.abs(feet.heights[j] - ground((gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M)) < 1e-2);
  });
  // steep ground: a footing down to the lowest under the plinth, solid too
  const steep = run(px, py, plane(0.6, 0.4));
  assert.equal(steep.statics.length, 2 * here.length, 'a pylon and its footing');
  const foot = steep.statics[1].cpu, ys = foot.positions.filter((_, k) => k % 3 === 1);
  const [x1, z1] = [(f.pts[2 * here[0]] - ox) * SAMPLE_M, (f.pts[2 * here[0] + 1] - oy) * SAMPLE_M];
  const low = (await import('../../src/world/terrain/terrainSurface.js')).lowestGroundUnder(plane(0.6, 0.4), [x1 - 3.4, 0, z1 - 3.4, x1 + 3.4, 0, z1 + 3.4]);
  assert.ok(Math.min(...ys) <= low - steep.statics[0].m[13] - PYLON.sink + 0.5, 'down to under the lowest');
  assert.equal(steep.solids.length, 2 * here.length + withPiece.length, 'its solid as well');
  assert.equal(typeof pylonFooting(2).solid.positions.length, 'number');
  // the ground along a piece: exact on the drawn triangles (a ridge between two samples read at the sample)
  const ridge = new Float32Array(gentle); ridge[10 * hDim + 10] += 50 / W;
  const [, top] = groundAlong(ridge, 9.5 * SAMPLE_M, 10 * SAMPLE_M, 10.5 * SAMPLE_M, 10 * SAMPLE_M);
  assert.ok(Math.abs(top - surfaceHeightAt(ridge, 10 * SAMPLE_M, 10 * SAMPLE_M)) < 1e-6, 'the ridge\'s top inside the piece');
  // Ghostgate's pixel stands the gate in its pylon's place
  const [gx, gy] = f.gatePixel.split(',').map(Number), gr = run(gx, gy, gentle), gi = ghostfencePylonsIn(gx, gy).indexOf(f.gate);
  assert.ok(gi >= 0);
  assert.equal(gr.statics[gi].cpu, ghostgateModel());
  assert.equal(gr.solids[gi].pos, ghostgateSolid().positions);
  // off the fence: nothing, not even its pictures
  const off = run(px + 200, py, gentle);
  assert.deepEqual([off.n, off.uploads.length, off.statics.length, off.solids.length], [0, 0, 0, 0]);
  // wired into the pixel build past the Bay, before the bucket settles
  const pb = read('src/scenes/pixelBuild.js');
  const at = pb.indexOf('if (!onTheBay(px, py)) standGhostfence({ px, py, pkey, key, samples, renderer, addStatic, unionBox, late, translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });');
  assert.ok(at > 0 && at < pb.indexOf('collider.settle(key);'));
});

test('GHOSTFENCE the glow: its feet on the ground each layer draws - a built pixel\'s own, the middle ring\'s kernel (eased as it eases), the far ring\'s centres; its curtain a quad a step of each run on its curtain points\' ground and a halo an orb (Ghostgate\'s two), read on each ring\'s own triangles, a note for another frame never read (AUDIT RED-MOUNTAIN N1/N5/N6 - PIN MOVED); the shaders\' foot, ease and hiding run on their own sources; drawn by the far ring after the fire, its door (mutants: a layer\'s order, the ease, the halo\'s least size, the hiding margin)', async () => {
  const { fenceGround, glowMeshes, noteFenceFeet, fenceFeet, FENCE_CURTAIN_VS, FENCE_CURTAIN_FS, FENCE_HALO_VS, FENCE_HALO_FS, GLOW, fenceGlowDisabled } = await import('../../src/render/ghostfenceGlow.js');
  const { glslFunctions } = await import('../glsl.mjs');
  const f = ghostfenceFrame(), [cpx, cpy] = sampleToPixel(f.cx, f.cy);
  // a far ring of 48 pixels round the centre at 1000 + 2 x its column, a middle ring of 14 round it at 500 everywhere
  const ringR = 48, side = 2 * ringR + 1, ground = new Float32Array(side * side);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) ground[j * side + i] = 1000 + 2 * i;
  const ring = { baseX: cpx, baseY: cpy, radius: ringR, side, positions: new Float32Array(side * side * 3), ground };
  const midR = 14, sub = 8, mside = (2 * midR + 1) * sub + 1, mid = { heights: new Float32Array(mside * mside), baseX: cpx, baseY: cpy - 10, radius: midR, sub };
  for (let gz = 0; gz < mside; gz++) for (let gx = 0; gx < mside; gx++) mid.heights[gz * mside + gx] = 500 + gz;   // a row's height its row: north higher
  const [k0] = [...f.byPixel.keys()], feetIdx = f.byPixel.get(k0);
  const { CURTAIN_STEPS, ghostfenceCurtainPoint } = await import('../../src/world/tamriel/ghostfence.js');
  const per = CURTAIN_STEPS + 1, pointsIn = [];
  for (let p = 0; p < f.n * per; p++) if (sampleToPixel(...ghostfenceCurtainPoint(f, Math.floor(p / per), p % per)).join() === k0) pointsIn.push(p);
  noteFenceFeet(k0, { frame: f, idx: feetIdx, seats: Float32Array.from(feetIdx.map((_, j) => 7000 + j)), points: pointsIn, heights: Float32Array.from(pointsIn.map((_, j) => 6000 + j)) });
  const built = new Set([k0]);
  const all = fenceGround(f, { feet: fenceFeet(), built, mid, ring }), g = all.pylons;
  for (let i = 0; i < f.n; i++) {
    const bx = f.pts[2 * i] / 128, by = MAP_HEIGHT + 1 - f.pts[2 * i + 1] / 128;
    assert.ok(Math.abs(g.coarse[i] - (1000 + 2 * (bx - 0.5 - cpx + ringR))) < 1e-2, 'the far ring between its centres');
    const k = `${Math.floor(bx)},${Math.floor(by)}`;
    if (k === k0) assert.deepEqual([g.fine[i], g.kind[i]], [7000 + feetIdx.indexOf(i), 0], 'a built pixel\'s own foot');
    else if (Math.abs(bx - (cpx + 0.5)) < midR - 0.5 && Math.abs(by - (cpy - 10 + 0.5)) < midR - 0.5) {
      const gz = ((cpy - 10 + 1 - by) * TERRAIN_SIZE) / (TERRAIN_SIZE / sub) + midR * sub;
      assert.ok(Math.abs(g.fine[i] - (500 + gz)) < 1e-2 && g.kind[i] === 1, `the middle ring's at its row (${g.fine[i].toFixed(2)}, ${(500 + gz).toFixed(2)}), eased`);
    }
    else if (Math.abs(bx - (cpx + 0.5)) > midR + 1.5 || Math.abs(by - (cpy - 10 + 0.5)) > midR + 1.5) assert.deepEqual([g.fine[i], g.kind[i]], [g.coarse[i], 0], 'past it, the far ring\'s');
  }
  pointsIn.forEach((p, j) => assert.deepEqual([all.points.fine[p], all.points.kind[p]], [6000 + j, 0], 'a built pixel\'s own curtain point'));
  assert.equal(all.points.fine.length, f.n * per);
  const unbuilt = fenceGround(f, { feet: fenceFeet(), built: new Set(), mid: null, ring });
  assert.ok(feetIdx.every((i) => unbuilt.pylons.fine[i] === unbuilt.pylons.coarse[i]), 'a foot noted but not built is the far ring\'s');
  // AUDIT RED-MOUNTAIN N6: a note made for another frame (another fit, another trace) is never read
  noteFenceFeet(k0, { frame: {}, idx: feetIdx, seats: Float32Array.from(feetIdx.map(() => 9999)), points: pointsIn, heights: Float32Array.from(pointsIn.map(() => 9999)) });
  const stale = fenceGround(f, { feet: fenceFeet(), built, mid: null, ring });
  assert.ok(feetIdx.every((i) => stale.pylons.fine[i] === stale.pylons.coarse[i]), 'another frame\'s note: the far ring\'s');
  // AUDIT RED-MOUNTAIN N5: read on the triangles each ring draws (the diagonal from a cell's first corner to its last), and
  // a foot on no ring dropped (kind 2) - not stood at 0
  const { cellHeight } = await import('../../src/render/ghostfenceGlow.js');
  assert.equal(cellHeight(0, 0, 0, 100, 0.5, 0.5), 50); assert.equal(cellHeight(0, 0, 0, 100, 0.75, 0.25), 25); assert.equal(cellHeight(0, 0, 0, 100, 0.25, 0.75), 25);
  assert.equal(cellHeight(0, 100, 0, 0, 0.75, 0.25), 50, 'the corner off the diagonal: its own triangle');
  const peak = new Float32Array(side * side); peak[(ringR + 1) * side + ringR + 1] = 800;
  const tri = fenceGround(f, { ring: { ...ring, ground: peak } });
  for (let i = 0; i < f.n; i++) {
    const fi = f.pts[2 * i] / 128 - 0.5 - cpx + ringR, fj = MAP_HEIGHT + 1 - f.pts[2 * i + 1] / 128 - 0.5 - cpy + ringR, ii = Math.floor(fi), jj = Math.floor(fj);
    const h = (a, b) => peak[b * side + a];
    assert.ok(Math.abs(tri.pylons.coarse[i] - cellHeight(h(ii, jj), h(ii + 1, jj), h(ii, jj + 1), h(ii + 1, jj + 1), fi - ii, fj - jj)) < 1e-3);
  }
  const small = fenceGround(f, { ring: { baseX: cpx, baseY: cpy, radius: 1, side: 3, positions: new Float32Array(27), ground: new Float32Array(9) } });
  assert.ok(small.pylons.kind.every((k) => k === 2) && small.points.kind.every((k) => k === 2), 'past every ring: dropped');
  for (const vsrc of [FENCE_CURTAIN_VS, FENCE_HALO_VS]) assert.match(vsrc, /if \(aFoot\.z > 1\.5\) \{ gl_Position = vec4\(0\.0, 0\.0, 2\.0, 1\.0\); return; \}/);
  // the meshes
  const m = glowMeshes(f);
  assert.equal(m.curtainOf.length, f.n * CURTAIN_STEPS * 6, 'the curtain a quad a step of each run (AUDIT RED-MOUNTAIN N1)');
  assert.equal(m.haloOf.length, (f.n + 1) * 6, 'a halo a pylon, two for Ghostgate');
  assert.deepEqual([m.px, m.py], [cpx, cpy]);
  // the shaders: the foot eased as the middle ring eases; the halo never under its least size; the far draw hidden by the cone
  const vs = glslFunctions(FENCE_CURTAIN_VS, { uMorph: [1000, 3000, 1], uMorphFrom: [0, 0, 0], uOrigin: [0, 0, 0], uVP: Array(16).fill(0), aCorner: [0, 0, 0, 0], aFoot: [0, 0, 0] });
  assert.equal(Number(vs.footOf([500, 900, 1], [500, 200])), 500, 'eased: inside the band, the kernel\'s');
  assert.equal(Number(vs.footOf([500, 900, 1], [200, 3500])), 900, 'past it, the far ring\'s');
  assert.ok(Math.abs(Number(vs.footOf([500, 900, 1], [2000, 0])) - 700) < 1e-6, 'half way, half');
  assert.equal(Number(vs.footOf([500, 900, 0], [200, 3500])), 500, 'a built foot never eased');
  vs.globals.uMorph = [1000, 3000, 0];
  assert.equal(Number(vs.footOf([500, 900, 1], [200, 3500])), 500, 'no middle ring: no ease');
  const { fireProfile, FIRE, fireUniforms } = await import('../../src/render/redMountainFire.js');
  const prof = fireProfile();
  const fs = glslFunctions(FENCE_CURTAIN_FS, { ...fireUniforms(), uCone: [0, 0, 0, 1], uTime: 0, uLight: 0, vWorld: [0, 0, 0], vSide: [0, 0] });
  fs.globals.uEye = [40000, 2500, 0];
  const near = [G.radius, coneProfile(G.radius - RED_MOUNTAIN_DIALS.rim) + 20, 0];
  assert.equal(fs.hidden(near, GLOW.margin), false, 'the fence\'s near side, seen');
  assert.equal(fs.hidden([-near[0], near[1], 0], GLOW.margin), true, 'its far side behind the cone');
  // its own ground under the profile as far as the land falls from the plateau at the fence (160 m: the crowned
  // profile's worst at 15 km on the freeware), still seen - and hidden by a margin short of it (AUDIT RED-MOUNTAIN R4: the
  // point was built from the margin it tested)
  const low = [near[0], Number(fs.coneAt([near[0], near[2]])) - 160, 0];
  assert.equal(fs.hidden(low, GLOW.margin), false);
  assert.equal(fs.hidden(low, 100), true, 'control: a margin short of the land\'s fall');
  assert.ok(GLOW.margin > FIRE.margin.lava);
  glslFunctions(FENCE_HALO_VS, {}); glslFunctions(FENCE_HALO_FS, {});   // both read as GLSL
  assert.match(FENCE_HALO_VS, /float r = max\(3\.20000, distance\(c, uEye\) \* uPx \* 2\.50000\);/);
  // the far ring's wiring: after the fire, the cone (none past the far plane without it), the layers, the middle ring's
  // ground kept as it lands, its door (AUDIT RED-MOUNTAIN F5/F9 - PIN MOVED: the cone apart from the fire, compiledPass)
  const fr = read('src/render/farRing.js');
  assert.ok(fr.indexOf('fence?.draw(pass);') > fr.indexOf('fire?.draw(pass);'), 'after the fire');
  assert.match(fr, /cone: cone \? coneIn\(cone\.at, origin, this\.baseX, this\.baseY\) : null,/);
  assert.match(fr, /ground: \{ feet: fenceFeet\(\), built: this\._builtNow, mid: mid\?\.built \? this\._midGround : null, ring: this\._ringY \},/);
  assert.match(fr, /this\._midGround = \{ heights: answer\.heights, baseX, baseY, radius: MID_RADIUS, sub: MID_SUB \};/);
  assert.match(fr, /morph: \{ from: focus && focus\[3\] > 0\.5 \? focus : eye, start: MID_MORPH_START, end: MID_MORPH_END \} \};/);
  assert.match(fr, /compiledPass\(gl, GLOW_PROGRAMS, \(\) => new GhostfenceGlow\(gl\),/);
  assert.match(fr, /if \(whole\) \{ this\._fence\?\.dispose\(\); this\._fence = null; this\._fenceDoor = null; \}/);
  assert.equal(fenceGlowDisabled('?fenceglow=off'), true);
  assert.equal(fenceGlowDisabled('?fenceglow=on'), false);
  assert.equal(fenceGlowDisabled(''), false);
});

test('GHOSTFENCE by source: the law pure and one float in every engine (no Math.cos, Math.sin, Math.exp, Math.atan2, Math.pow, Math.hypot or **), and its readers its own - the countryside\'s roll, the lairs\', the roads\' build', () => {
  const src = read('src/world/tamriel/ghostfence.js');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const banned = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression' && n.object?.name === 'Math' && ['cos', 'sin', 'exp', 'atan2', 'pow', 'hypot', 'tan', 'log'].includes(n.property?.name)) banned.push(n.property.name);
    if (n.type === 'BinaryExpression' && n.operator === '**') banned.push('**');
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
  })(ast);
  assert.deepEqual(banned, []);
  assert.match(read('src/world/tamrielCountry.js'), /if \(!steps \|\| insideGhostfence\(px, py\)\) return null;/);
});

test('GHOSTFENCE with ARENA2: on the freeware\'s trace the fence closes round Red Mountain on Morrowind\'s land in its zone, no countryside stands within it, no lair on its line, no Arena place within it', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { ww5World } = await import('./worldWide/ww5World.mjs');
  const { tamrielHeightByte } = await import('../../src/world/tamriel/tamrielGround.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const w = await ww5World();
  const f = ghostfenceFrame(), [cpx, cpy] = sampleToPixel(f.cx, f.cy);
  for (const k of f.band) {
    const [x, y] = k.split(',').map(Number);
    assert.ok(tamrielHeightByte(x, y) > 0, `the line on land at (${x}, ${y})`);
    assert.equal(tamrielBiomeAt(x, y)?.key, 'morrowindRedMountain', `in Red Mountain's zone at (${x}, ${y})`);   // AUDIT RED-MOUNTAIN G4: its zone alone, as the record says
  }
  const near = w.places.near(cpx, cpy, 30);
  const inside = near.filter((p) => insideGhostfence(p.px, p.py) && p.source !== 'tesa-lairs');
  assert.deepEqual(inside.map((p) => `${p.source}:${p.px},${p.py}`), [], 'none but lairs within it');
  assert.deepEqual(near.filter((p) => onGhostfence(p.px, p.py)).map((p) => `${p.source}:${p.px},${p.py}`), [], 'nothing on its line');
  assert.ok(near.some((p) => p.source === 'tesa-lairs' && insideGhostfence(p.px, p.py)), 'the mountain\'s own lairs within it');
  assert.ok(near.some((p) => p.source === 'tesa-country' && !insideGhostfence(p.px, p.py)), 'the countryside outside it as it was');
});
