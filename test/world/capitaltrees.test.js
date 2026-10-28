// CAPITAL-TREES (2026-10-27; KPbICA on the game's Discord, forwarded by the owner: "The main trees in Falinesti and
// Mournhold should get some love. They are too draftish for now"; bible/03-World/Arena-Provinces.md CAPITAL-TREES) - THE
// CAPITALS' MAIN TREES FINISHED, pinned: Falinesti's Great Graht-Oak on the capitals' trees' kit (world/capitalTrees.js -
// its fluted trunk and leader, its buttresses under the walkway, the boughs carrying its platforms, its limbs carrying their
// decks, its crown in storeys, its sprays and lianas) with the city in its boughs kept walkable; Mournhold's own trees in
// their planters (world/capitalMournhold.js buildMournholdGardens) where the Bay's scenery trees stood; their pictures in
// Daggerfall's band (world/capitalTreeArt.js), the sprays cut by their alpha at the density the game draws its trees'
// flats, cut wherever they are uploaded (systems/textureReplacement.js vendorCutout) and passed by a body (world/signSolid.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FALINESTI, MOURNHOLD, MOURNHOLD_BLOCKS, mournholdTreeSites } from '../../src/world/capitalPlans.js';
import { buildGrahtOak, trunkRadius, spiralAt, spiralInner, walkwayOver, grahtRoots, rootAngle, platformBoughs, crownLimbs, grahtCrown, limbForks, oakClear, hutAngle, PLATFORM_SIDES } from '../../src/world/capitalFalinesti.js';
import { buildMournholdGardens, buildMournholdPlaza } from '../../src/world/capitalMournhold.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART, CAPITAL_CUT_RECORDS, isCapitalCut, flatTriangles } from '../../src/world/capitalShapes.js';
import { capitalArt, vanillaTexels, northward, installCapitals, _resetCapitals, capitalFootprint } from '../../src/world/capitalModels.js';
import { SPRAY_TEXELS, LIANA_U0 } from '../../src/world/capitalTreeArt.js';
import { CAPITALS, CAPITAL_MODELS } from '../../src/world/tamrielCapitals.js';
import { customModelFor } from '../../src/world/customModels.js';
import { sightMarksOf } from '../../src/world/signSolid.js';
import { addVendorTextures, vendorCutout } from '../../src/systems/textureReplacement.js';
import { bezier } from '../../src/world/capitalTrees.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARENA2 = process.env.ARENA2_PATH ?? null, HAVE = !!(ARENA2 && existsSync(join(ARENA2, 'TEXTURE.504')));

/** A model's triangles of one picture, each its three corners. */
const trisOf = (m, record) => {
  const out = [];
  for (const sm of m.subMeshes) if (sm.textureRecord === record) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) out.push([0, 1, 2].map((k) => [0, 1, 2].map((a) => m.positions[m.indices[i + k] * 3 + a])));
  return out;
};
const faces = (m, record) => m.subMeshes.filter((s) => s.textureRecord === record).reduce((n, s) => n + s.primitiveCount, 0);
/** Does the segment p-q cross any face of the model (Moller-Trumbore)? `pick(t)` a face's index filter. */
const crosses = (m, p, q, pick = null) => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    if (pick && !pick(t)) continue;
    const V = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [V(0), V(1), V(2)], e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const sv = p.map((v, i) => v - a[i]), u = (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const s = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (s >= 0 && s <= 1) return t;
  }
  return -1;
};
const facing = (m, t) => [0, 1, 2].map((a) => m.normals[m.indices[t] * 3 + a]);
const OAK = buildGrahtOak(), GARDENS = buildMournholdGardens();

// ── THE PICTURES ────────────────────────────────────────────────

test('CAPITAL-TREES the trees\' pictures: the barks, the leaves and the planters\' bed vanilla\'s 64 x 64 and opaque (their band and their tiling the TESA-LORE pin\'s, with every capital picture); the sprays a tree\'s flats - the graht-oak\'s 128 x 128 with its liana in its last quarter, Mournhold\'s 64 x 64 - every texel opaque or clear, their leaves in the band, their outline never cut by their picture\'s edge, the liana tiling down (mutants: a soft alpha; the oak\'s spray at 64)', () => {
  const art = capitalArt();
  for (const k of ['grahtBark', 'grahtLeaves', 'mhBark', 'mhLeaves', 'planterBed']) {
    const img = art.get(CAPITAL_ART[k]);
    assert.deepEqual([img.width, img.height], [64, 64], k);
    for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255, k);
    assert.equal(isCapitalCut(CAPITAL_ART[k]), false, k);
  }
  assert.deepEqual([...CAPITAL_CUT_RECORDS].sort(), [CAPITAL_ART.grahtSpray, CAPITAL_ART.mhSpray].sort());
  for (const [k, size] of [['grahtSpray', SPRAY_TEXELS.graht], ['mhSpray', SPRAY_TEXELS.mournhold]]) {
    const img = art.get(CAPITAL_ART[k]), { w, h } = size, x1 = k === 'grahtSpray' ? Math.round(w * LIANA_U0) : w;
    assert.deepEqual([img.width, img.height], [w, h], k);
    let opaque = 0, green = 0;
    const colours = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, a = img.data[o + 3];
      assert.ok(a === 0 || a === 255, `${k}: a texel half-cut (${a})`);
      if (!a) continue;
      opaque++; colours.add((img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2]);
      if (img.data[o + 1] > img.data[o] && img.data[o + 1] > img.data[o + 2]) green++;
      if (x < x1) assert.ok(x >= 2 && x < x1 - 2 && y >= 2, `${k}: its spray's outline cut by the picture's edge at ${x},${y}`);
    }
    const share = opaque / (w * h);
    assert.ok(share > 0.3 && share < 0.6, `${k}: ${(share * 100).toFixed(0)}% of it leaves`);
    assert.ok(colours.size >= 16 && colours.size <= 84, `${k}: ${colours.size} colours`);
    assert.ok(green > opaque * 0.7, `${k}: its leaves green`);
    let foot = 0;
    for (let x = 0; x < x1; x++) if (img.data[((h - 1) * w + x) * 4 + 3] || img.data[((h - 2) * w + x) * 4 + 3]) foot++;
    assert.ok(foot > 0, `${k}: the spray's foot on its bottom row (a card's base, v 0)`);
    if (k === 'grahtSpray') {   // the liana's columns tile down: the stem in its first row and its last
      const stem = (y) => { let n = 0; for (let x = x1; x < w; x++) n += img.data[(y * w + x) * 4 + 3] ? 1 : 0; return n; };
      assert.ok(stem(0) > 0 && stem(h - 1) > 0, 'the liana tiles down');
    }
  }
});

test('CAPITAL-TREES the sprays at the density Daggerfall draws its trees\' flats: every card and liana of both trees between 8 and 20 texels a metre (the freeware\'s great flats\' - test below), square; laid on their own coordinates - the graht-oak\'s sprays on its picture\'s first three quarters, its lianas on its last - every other face at vanilla\'s 40 (mutants: the flats laid by the box; a card over the liana)', () => {
  for (const [m, rec, size] of [[OAK, CAPITAL_ART.grahtSpray, SPRAY_TEXELS.graht], [GARDENS, CAPITAL_ART.mhSpray, SPRAY_TEXELS.mournhold]]) {
    const v = vanillaTexels(northward(m)), flats = flatTriangles(v);
    assert.ok(flats, 'the model has its flats');
    let cards = 0, lianas = 0;
    for (const sm of v.subMeshes) {
      if (sm.textureRecord !== rec) continue;
      for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
        assert.equal(flats[t / 3], 1);
        const ix = [0, 1, 2].map((k) => v.indices[t + k]), P = ix.map((i) => [0, 1, 2].map((a) => v.positions[i * 3 + a])), U = ix.map((i) => [v.uvs[i * 2] * size.w, v.uvs[i * 2 + 1] * size.h]);
        for (let k = 0; k < 3; k++) assert.deepEqual([v.uvs[ix[k] * 2], v.uvs[ix[k] * 2 + 1]], [m.uvs[ix[k] * 2], m.uvs[ix[k] * 2 + 1]], 'its own coordinates');
        const e1 = P[1].map((x, k) => x - P[0][k]), e2 = P[2].map((x, k) => x - P[0][k]);
        const wa = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
        const ta = Math.abs((U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1])) / 2, dens = Math.sqrt(ta / wa);
        assert.ok(dens >= 8 && dens <= 20, `${dens.toFixed(1)} texels a metre on a flat`);
        const us = ix.map((i) => v.uvs[i * 2]);
        if (rec === CAPITAL_ART.grahtSpray && Math.min(...us) >= LIANA_U0 - 1e-6) lianas++;
        else { cards++; assert.ok(Math.max(...us) <= (rec === CAPITAL_ART.grahtSpray ? LIANA_U0 : 1) + 1e-6, 'a card on its spray alone'); }
      }
    }
    assert.ok(cards > 100, `${cards} card faces`);
    if (rec === CAPITAL_ART.grahtSpray) assert.ok(lianas >= 8 * (FALINESTI.limbs * 2 + FALINESTI.platforms.length * (FALINESTI.boughs + 1)), `${lianas} liana faces`);
  }
});

test('CAPITAL-TREES the freeware\'s nature flats - the density the sprays keep: a flat drawn at its scaled size (world/rmbFlats.js scaledBillboardSize - DFU\'s GetScaledBillboardSize, BlocksFile.ScaleDivisor, MeshReader.GlobalScale); of TEXTURE.500-511\'s flats 6 m tall and more, 75 of 76 at 8 to 20 texels a metre, 45 of them at 10', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { TextureFile } = await import('../../src/formats/textureFile.js');
  const { scaledBillboardSize } = await import('../../src/world/rmbFlats.js');
  const dens = [];
  for (let a = 500; a <= 511; a++) {
    const name = `TEXTURE.${a}`, t = new TextureFile();
    if (!existsSync(join(ARENA2, name)) || !t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name)) continue;
    for (let r = 0; r < 40; r++) {
      const size = t.getSize(r), { h } = scaledBillboardSize(size, t.getScale(r));
      if (size.height && h >= 6) dens.push(size.height / h);
    }
  }
  assert.equal(dens.length, 76, 'the nature archives\' great flats');
  assert.equal(dens.filter((d) => d >= 7.95 && d <= 20.05).length, 75, dens.map((d) => d.toFixed(2)).join());
  assert.equal(dens.filter((d) => Math.abs(d - 10) < 0.05).length, 45);
});

test('CAPITAL-TREES the sprays cut by their alpha wherever they are uploaded: the capitals register them { cutout: true } and nothing else so (mutant: the registration\'s cutout false), the texture door answers it (vendorCutout), the upload door asks it of every picture it puts up (mutants: the entry drops it; the door never asks)', () => {
  _resetCapitals();
  let entries = [];
  installCapitals({ addTextures: (e) => { entries = e; return e.length; } });
  for (const e of entries) assert.equal(e.cutout, CAPITAL_CUT_RECORDS.includes(e.record), `record ${e.record}`);
  addVendorTextures(entries.filter((e) => e.cutout || e.record === CAPITAL_ART.grahtBark));
  assert.equal(vendorCutout(CAPITAL_ARCHIVE, CAPITAL_ART.grahtSpray), true);
  assert.equal(vendorCutout(CAPITAL_ARCHIVE, CAPITAL_ART.mhSpray), true);
  assert.equal(vendorCutout(CAPITAL_ARCHIVE, CAPITAL_ART.grahtBark), false);
  const pipe = readFileSync(join(ROOT, 'src/scenes/dataPipeline.js'), 'utf8');
  const door = pipe.slice(pipe.indexOf('const uploadRecord = (archive, record'), pipe.indexOf('renderer.uploadTexture(archive, record, color32, variant'));
  assert.match(door, /cutout \|\|= vendorCutout\(archive, record\);/, 'the upload door asks the picture');
  _resetCapitals();
});

// ── FALINESTI'S GREAT GRAHT-OAK ─────────────────────────────────

test('CAPITAL-TREES the Great Graht-Oak finished: six pictures (six draws - its bark, leaves and sprays, the city\'s timber, hide and doors), 30,000 to 46,000 faces; its trunk fluted through trunkRadius\'s levels, every third corner a furrow, its leader on into the cap (mutant: no flutes); its crown over the city and highest over the trunk; none of the draft\'s pictures left on it', () => {
  const m = OAK, F = FALINESTI;
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord).sort((a, b) => a - b), [CAPITAL_ART.dark, CAPITAL_ART.timber, CAPITAL_ART.hide, CAPITAL_ART.grahtBark, CAPITAL_ART.grahtLeaves, CAPITAL_ART.grahtSpray].sort((a, b) => a - b));
  const n = m.indices.length / 3;
  assert.ok(n >= 30000 && n <= 46000, `${n} faces`);
  assert.ok(faces(m, CAPITAL_ART.grahtLeaves) > 12000 && faces(m, CAPITAL_ART.grahtSpray) > 3000 && faces(m, CAPITAL_ART.grahtBark) > 8000);
  // the trunk's ring at 48 m: its 33 corners at the trunk's radius, furrows every third
  const ring = [];
  for (const [a, b, c] of trisOf(m, CAPITAL_ART.grahtBark)) for (const p of [a, b, c]) if (Math.abs(p[1] - 48) < 1e-6 && Math.hypot(p[0], p[2]) < trunkRadius(48) * 1.1) ring.push(Math.hypot(p[0], p[2]) / trunkRadius(48));
  const k = [...new Set(ring.map((v) => v.toFixed(5)))].map(Number);
  assert.ok(k.length >= F.bark.sides * 0.9, `${k.length} corners on the ring`);
  assert.ok(Math.min(...k) < 1 - F.bark.furrow * 0.8 && Math.max(...k) > 1 + F.bark.ridge * 0.4 && Math.max(...k) < 1.045, `its flutes ${Math.min(...k).toFixed(3)} to ${Math.max(...k).toFixed(3)}`);
  let hi = -Infinity, top = null, far = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    if (m.positions[i + 1] > hi) { hi = m.positions[i + 1]; top = [m.positions[i], m.positions[i + 2]]; }
    far = Math.max(far, Math.hypot(m.positions[i], m.positions[i + 2]));
  }
  assert.ok(hi > F.crown.y + 30 && hi < F.crown.y + 60, `its crown to ${hi.toFixed(1)}`);
  assert.ok(Math.hypot(...top) < 70, 'highest over the trunk');
  assert.ok(far > F.crown.r * 0.9 && far < F.crown.r * 1.3, `over the city to ${far.toFixed(0)} m`);
  for (const old of [CAPITAL_ART.bark, CAPITAL_ART.leaves]) assert.equal(faces(m, old), 0, 'the draft\'s pictures gone');
});

test('CAPITAL-TREES its buttresses all round its foot under the walkway: a dozen on rootArc, none on the porch (mutant: rootPorch 0), each up the trunk no higher than the walkway climbing over it less rootUnder (mutant: rootTop whatever the walkway) and reaching farther the taller; the walkway\'s first rise over the lowest', () => {
  const F = FALINESTI, roots = grahtRoots(), north = 1.5 * Math.PI;
  assert.ok(roots.length >= F.roots - 2 && roots.length <= F.roots, `${roots.length} buttresses`);
  // clear of the porch: a buttress's foot at the trunk off the porch's axis by its half-width, the buttress's own half
  // thickness and its snake (3 m) - read off the porch's and the buttress's measures, never rootPorch's
  const clearOfPorch = Math.atan((F.porch.w / 2 + F.rootThick[0] / 2 + 3) / trunkRadius(0));
  for (let i = 0; i < F.roots; i++) assert.ok(Math.abs(rootAngle(i) - north) >= Math.max(F.rootPorch - 1e-9, clearOfPorch), `root ${i} ${Math.abs(rootAngle(i) - north).toFixed(3)} rad off the porch's axis`);
  for (const R of roots) {
    assert.ok(R.angle >= F.rootArc[0] - 0.06 && R.angle <= F.rootArc[1] + 0.06);
    assert.ok(R.top <= walkwayOver(R.angle) - F.rootUnder + 1e-9 && R.top <= F.rootTop, `a buttress at ${R.angle.toFixed(2)} up to ${R.top.toFixed(1)} under the walkway at ${walkwayOver(R.angle).toFixed(1)}`);
    assert.ok(R.reach <= F.rootOut && R.reach > trunkRadius(0) + 10);
  }
  const tall = roots.reduce((a, b) => (b.top > a.top ? b : a)), short = roots.reduce((a, b) => (b.top < a.top ? b : a));
  assert.ok(tall.reach > short.reach, 'the taller reaching farther');
  // the porch's door clear of every buttress: a body walks to it from the north
  const G = F.porch, gz = -(trunkRadius(0) + G.d / 2 - G.into), dz = gz - G.d / 2;
  assert.equal(crosses(OAK, [0, 1, dz - 30], [0, 1, dz - 0.2], (t) => OAK.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.grahtBark && t >= s.startIndex && t < s.startIndex + s.primitiveCount * 3)), -1, 'the way to the porch open');
});

test('CAPITAL-TREES the boughs carrying the platforms: three under each deck on boughArc, their wood under the deck\'s underside out past its rail (mutant: a bough up through the deck), the walkway climbing to the platform more than 2 m under them; one over each deck, its wood a body\'s 2 m over the deck all across it (mutant: boughLift 3)', () => {
  const F = FALINESTI, boughs = platformBoughs();
  assert.equal(boughs.length, F.platforms.length * (F.boughs + 1));
  for (const B of boughs) {
    const y = B.level, rOut = trunkRadius(y) + 1.5 + F.platformW + 0.3;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, p = bezier(B.path, t), d = Math.hypot(p[0], p[2]), rad = 3.6 + (1.1 - 3.6) * t;
      if (d < trunkRadius(p[1]) * 0.98 || d > rOut) continue;
      if (B.over) assert.ok(p[1] - rad >= y + 2, `the bough over the deck at ${y}: its wood ${(p[1] - rad - y).toFixed(2)} m over it`);
      else assert.ok(p[1] + rad <= y - 0.7 + 0.05, `a bough under the deck at ${y}: its wood ${(p[1] + rad - y).toFixed(2)} m against the deck`);
      if (!B.over) {   // the walkway climbing to this platform under the bough
        const w = walkwayOver(B.angle, [0, ...F.platforms][F.platforms.indexOf(y)]);
        if (d >= spiralInner(w) - 0.5 && d <= spiralInner(w) + F.spiral.w + 0.5) assert.ok(p[1] - rad >= w + 2, `the walkway at ${w.toFixed(1)} under a bough at ${(p[1] - rad).toFixed(1)}`);
      }
    }
    if (!B.over) assert.ok(B.angle >= F.boughArc[0] && B.angle <= F.boughArc[1]);
  }
});

test('CAPITAL-TREES the city kept clear of the leaves: no mass and no spray over a fork\'s deck or among its houses, over a platform or among its houses, or about the walkway (oakClear; mutant: the crown\'s masses never lifted off the decks) - and the decks, the platforms\' rails and the walkway as the city walks them: the walkway\'s deck run into the bark (no gap to fall through - mutant: its inner edge at its lane\'s), its rail and the platforms\' rails faced both ways (mutants), the houses\' doors to the trunk (mutant)', () => {
  const F = FALINESTI, m = OAK, clear = oakClear();
  let leaves = 0;
  for (const rec of [CAPITAL_ART.grahtLeaves, CAPITAL_ART.grahtSpray]) for (const tri of trisOf(m, rec)) for (const p of tri) { leaves++; assert.ok(clear(p), `a leaf at ${p.map((v) => v.toFixed(1))}`); }
  assert.ok(leaves > 40000);
  for (const M of grahtCrown()) for (const [x, y, z] of limbForks()) {
    const h = Math.hypot(M.c[0] - x, M.c[2] - z);
    if (h < F.forkDeck) assert.ok(M.c[1] - M.r * M.squash > y || M.c[1] + M.r * M.squash < y - 1, 'a mass on a deck');
  }
  // the walkway's floor from the bark to its rail, and the rail seen from the walkway
  const N = 200;
  for (let i = 0; i < N; i++) {
    const [a, y] = spiralAt((i + 0.5) / N), inner = trunkRadius(y) * 0.985, lane = spiralInner(y) + F.spiral.w / 2;
    const up = (t) => facing(m, t)[1] > 0.5;
    assert.notEqual(crosses(m, [Math.cos(a) * inner, y + 0.5, Math.sin(a) * inner], [Math.cos(a) * inner, y - 0.5, Math.sin(a) * inner], up), -1, `the walkway's floor against the bark at ${y.toFixed(1)}`);
    const o = spiralInner(y) + F.spiral.w, hit = crosses(m, [Math.cos(a) * lane, y + 0.6, Math.sin(a) * lane], [Math.cos(a) * (o + 0.6), y + 0.6, Math.sin(a) * (o + 0.6)], (t) => { const n = facing(m, t); return n[0] * Math.cos(a) + n[2] * Math.sin(a) < -0.5; });
    assert.notEqual(hit, -1, `the walkway's rail faces the walker at ${y.toFixed(1)}`);
  }
  for (const y of F.platforms) {
    for (let s = 0; s < PLATFORM_SIDES; s++) {
      const a = ((s + 0.5) / PLATFORM_SIDES) * Math.PI * 2, rr = trunkRadius(y) + 1.5 + F.platformW;
      const hit = crosses(m, [Math.cos(a) * (rr - 2), y + 0.6, Math.sin(a) * (rr - 2)], [Math.cos(a) * (rr + 0.5), y + 0.6, Math.sin(a) * (rr + 0.5)], (t) => { const n = facing(m, t); return n[0] * Math.cos(a) + n[2] * Math.sin(a) < -0.5; });
      assert.notEqual(hit, -1, `the platform at ${y}: its rail faces its deck at side ${s}`);
    }
    for (let i = 0; i < F.huts; i++) {   // the house's door on its face toward the trunk
      const a = hutAngle(i), d = trunkRadius(y) + 1.5 + F.hutAt, c = [Math.cos(a) * d, y, Math.sin(a) * d];
      const door = trisOf(m, CAPITAL_ART.dark).filter((t) => t.every((p) => Math.hypot(p[0] - c[0], p[2] - c[2]) < F.hutR + 0.3 && p[1] >= y && p[1] < y + F.hutH));
      assert.ok(door.length >= 2, `house ${i} at ${y} has its door`);
      const mid = door[0].reduce((s, p) => [s[0] + p[0] / 3, 0, s[2] + p[2] / 3], [0, 0, 0]);
      assert.ok(Math.hypot(mid[0], mid[2]) < d - F.hutR * 0.5, `house ${i} at ${y}: its door to the trunk`);
    }
  }
});

test('CAPITAL-TREES the great limbs carry their decks: each limb runs under its fork\'s deck, its wood never over the deck\'s top within the deck (the deck on it), and forks twice on its outer run; the crown\'s storeys - the boughs\' masses about the platforms, the limbs\' over the city, the cap the greatest over the leader', () => {
  const F = FALINESTI, limbs = crownLimbs(), decks = limbForks();
  assert.equal(limbs.length, F.limbs);
  limbs.forEach((L, i) => {
    const [x, y, z] = decks[i];
    for (const [path, r0, r1] of [[L.inPath, L.r0, L.rFork], [L.outPath, L.rFork, 1]]) for (let k = 0; k <= 100; k++) {
      const p = bezier(path, k / 100), rad = r0 + (r1 - r0) * (k / 100);   // the tube's own radius law (world/capitalTrees.js tube)
      if (Math.hypot(p[0] - x, p[2] - z) < F.forkDeck) assert.ok(p[1] + rad <= y - 0.02, `limb ${i} through its deck by ${(p[1] + rad - y).toFixed(2)}`);
    }
    assert.ok(Math.abs(bezier(L.inPath, 1)[1] + L.rFork + 0.15 - y) < 1e-6, 'the deck on its limb');
    assert.equal(L.forks.length, 2);
  });
  const crown = grahtCrown(), boughMasses = crown.filter((M) => M.c[1] < F.limbFrom[0]), cap = crown.filter((M) => M.r >= 40);
  assert.ok(boughMasses.length >= F.platforms.length * (F.boughs + 1) * 3, `${boughMasses.length} masses about the platforms`);
  assert.equal(cap.length, F.crown.cap);
  for (const M of cap) assert.ok(Math.hypot(M.c[0], M.c[2]) < 40 && M.c[1] > F.limbTop[1], 'the cap over the leader');
  const crownTop = Math.max(...crown.map((M) => M.c[1] + M.r * M.squash));
  assert.ok(crownTop > F.crown.y + 30 && crownTop < F.crown.y + 60, `the leaves' top at ${crownTop.toFixed(1)}, the crown's height (TESA10c's)`);
  assert.ok(crown.length > 150, `${crown.length} masses`);
});

test('CAPITAL-TREES a tree\'s flats pass a body: the collider\'s marks for the oak and the gardens are their sprays\' faces (world/signSolid.js sightMarksOf - a ray stops at them, a body does not), every other face a body\'s (mutant: sightMarksOf never asks); a model with no flats none', () => {
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  for (const id of [CAPITAL_MODELS.grahtOak, CAPITAL_MODELS.mournholdGardens]) {
    const m = customModelFor(id), marks = sightMarksOf(id, m);
    assert.ok(marks, `model ${id} has its flats marked`);
    let n = 0;
    for (const sm of m.subMeshes) for (let t = sm.startIndex / 3; t < sm.startIndex / 3 + sm.primitiveCount; t++) { assert.equal(marks[t], isCapitalCut(sm.textureRecord) ? 1 : 0); n++; }
    assert.equal(n, marks.length);
  }
  assert.equal(sightMarksOf(CAPITAL_MODELS.mournholdPalace, customModelFor(CAPITAL_MODELS.mournholdPalace)), null);
  _resetCapitals();
});

// ── MOURNHOLD'S GARDENS ─────────────────────────────────────────

test('CAPITAL-TREES Mournhold\'s own trees: the plaza\'s rings about its statue, its allees and corners past its ring wall, the Temple Courtyard\'s rows by its pools (UESP\'s Tribunal: "paths, water, and trees") - 44, each on open ground of its own blocks, off every way and gate (mutant: the allees on the ways), out of the statue\'s court and off the ring wall, the pools, the braziers and the start markers; the own blocks plant no scenery tree (mutant: the Bay\'s trees back)', () => {
  const M = MOURNHOLD, P = M.plaza, G = M.gardens, sites = mournholdTreeSites();
  assert.equal(sites.length, 44);
  const mh = CAPITALS.find((c) => c.key === 'mournhold'), own = MOURNHOLD_BLOCKS.P0;
  for (const s of sites) {
    const reach = G.planter * s.scale + 0.2, inPlaza = Math.abs(s.x - P.x) < 102.4 && Math.abs(s.z - P.z) < 102.4, r = Math.hypot(s.x - P.x, s.z - P.z);
    assert.ok(s.scale >= G.scale[0] && s.scale <= G.scale[1] && s.variant >= 0 && s.variant < G.variants);
    assert.equal(own.closed(s.x, s.z), false, `a tree at ${s.x.toFixed(0)},${s.z.toFixed(0)} on open ground`);
    if (inPlaza) {
      assert.ok(Math.abs(s.x - P.x) > P.path + reach && Math.abs(s.z - P.z) > P.path + reach, `a tree at ${s.x.toFixed(0)},${s.z.toFixed(0)} off the plaza's ways`);
      assert.ok(r > P.paved + reach && Math.abs(r - P.r) > P.band + 3 + reach, 'out of the statue\'s court and off the ring wall');
    } else {
      assert.ok(s.z > M.court.poolZ[0] - 10 && s.z < M.court.poolZ[1] + 10, 'by the pools');
      for (const px of M.court.pools) assert.ok(Math.abs(s.x - px) > M.court.poolW / 2 + 1 + reach, 'off the pool');
      for (const bx of M.court.braziers) assert.ok(Math.abs(s.x - bx) > 6, 'off the braziers');
    }
    for (const [mx, mz] of mh.markers) assert.ok(Math.hypot(s.x - mx, s.z - mz) > 4, 'off a start marker');
  }
  for (const code of Object.keys(MOURNHOLD_BLOCKS)) assert.equal(MOURNHOLD_BLOCKS[code].tree, undefined);
  assert.ok(mh.models.includes(CAPITAL_MODELS.mournholdGardens), 'the gardens Mournhold\'s');
});

test('CAPITAL-TREES Mournhold\'s sprays crossed: each card a quad drawn both faces, and the cards in twos - a spray\'s two about one length, square to each other (world/capitalTrees.js cards, `crossed`) - so from its side a spray shows the other card\'s face, never a lone card\'s edge as a bright line across a crown (mutants: the sprays uncrossed; the second card on the first\'s plane)', () => {
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const tris = trisOf(GARDENS, CAPITAL_ART.mhSpray), cards = [];
  assert.equal(tris.length % 8, 0, 'four triangles a card, two cards a spray');
  for (let i = 0; i < tris.length; i += 4) {   // a sheet: its quad, then its quad turned about
    const pts = [];
    for (const t of tris.slice(i, i + 4)) for (const p of t) if (!pts.some((q) => Math.hypot(...sub(p, q)) < 1e-4)) pts.push(p);
    assert.equal(pts.length, 4, 'a card a quad');
    const [a, b, c] = tris[i], e1 = sub(b, a), e2 = sub(c, a), x = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...x), n = x.map((v) => v / l);
    for (const p of pts) assert.ok(Math.abs(dot(n, sub(p, a))) < 1e-3, 'a card flat');
    cards.push({ n, mid: [0, 1, 2].map((k) => pts.reduce((sum, p) => sum + p[k], 0) / 4) });
  }
  assert.ok(cards.length > mournholdTreeSites().length * 60, `${cards.length} cards`);
  for (let i = 0; i < cards.length; i += 2) {
    const [A, B] = [cards[i], cards[i + 1]];
    assert.ok(Math.hypot(...sub(A.mid, B.mid)) < 1e-3, 'a spray\'s two cards about one length');
    assert.ok(Math.abs(dot(A.n, B.n)) < 1e-3, 'square to each other');
  }
});

test('CAPITAL-TREES each of Mournhold\'s trees: an octagonal planter of the city\'s ochre stone under a marble coping, its bed of the sedges and the rye; a pale trunk to its fork, its limbs and twigs, its crown of leaves under its sprays - 11 to 15 m to its sprays\' tops, under the great statue\'s top (mutant: trees over the statue); 700 to 1,100 faces a tree, its four variants four; its trunk and planter closed to the walkers, the way between the trees open', () => {
  const m = GARDENS, sites = mournholdTreeSites(), n = m.indices.length / 3;
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord).sort((a, b) => a - b), [CAPITAL_ART.marble, CAPITAL_ART.ochre, CAPITAL_ART.mhBark, CAPITAL_ART.mhLeaves, CAPITAL_ART.mhSpray, CAPITAL_ART.planterBed].sort((a, b) => a - b));
  assert.ok(n >= sites.length * 700 && n <= sites.length * 1100, `${n} faces, ${(n / sites.length).toFixed(0)} a tree`);
  const plaza = buildMournholdPlaza();
  let statueTop = 0;
  for (let i = 1; i < plaza.positions.length; i += 3) statueTop = Math.max(statueTop, plaza.positions[i]);
  for (const s of sites) {
    let top = 0;
    for (const rec of [CAPITAL_ART.mhLeaves, CAPITAL_ART.mhSpray]) for (const t of trisOf(m, rec)) for (const p of t) if (Math.hypot(p[0] - s.x, p[2] - s.z) < 9) top = Math.max(top, p[1]);
    assert.ok(top > 10.5 && top < 16 && top < statueTop - 3, `a tree ${top.toFixed(1)} m tall (the statue ${statueTop.toFixed(1)})`);
    assert.notEqual(crosses(m, [s.x, 0.95, s.z], [s.x, 0.2, s.z], (t) => m.subMeshes.some((sm) => sm.textureRecord === CAPITAL_ART.planterBed && t >= sm.startIndex && t < sm.startIndex + sm.primitiveCount * 3)), -1, 'its bed');
  }
  for (const t of trisOf(m, CAPITAL_ART.mhSpray)) for (const p of t) assert.ok(p[1] >= 2.6, `a spray hung to ${p[1].toFixed(2)} m - under a rider (2.6 m, player/motor.js RIDE_HEIGHT)`);
  const shapes = new Set(sites.map((s) => s.variant));
  assert.equal(shapes.size, MOURNHOLD.gardens.variants, 'every variant stands');
  const fp = capitalFootprint({ models: [CAPITAL_MODELS.mournholdGardens] }, () => vanillaTexels(northward(m)));
  for (const s of sites) {
    assert.equal(fp(s.x, s.z), true, 'its trunk closed');
    // its planter's wall closed all round (the automap's 1.6 m cells - a probe on the wall's line may sit in a cell the line
    // only clips, so the wall is read as a ring of probes, nearly every one closed)
    const wall = MOURNHOLD.gardens.planter * s.scale * Math.cos(Math.PI / 8);
    let shut = 0;
    for (let k = 0; k < 16; k++) shut += fp(s.x + Math.cos((k * Math.PI) / 8) * wall, s.z + Math.sin((k * Math.PI) / 8) * wall) ? 1 : 0;
    assert.ok(shut >= 13, `its planter closed (${shut} of 16)`);
    assert.equal(fp(s.x + 6.5, s.z + 6.5), false, 'the way past it open');
  }
});
