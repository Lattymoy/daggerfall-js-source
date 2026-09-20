// FIELD-GUN-MW2: THE BAKE CHAIN, PINNED.
//
// tools/fbxMesh.mjs (pinned in fbxmesh.test.js) turns Mac's export into
// numbers. These three turn those numbers into something the Morrowind
// lane can read, and each one has a failure that looks like art rather
// than like a bug:
//
//   meshUnwrap   the export has NO usable unwrap - Blender's factory
//                cylinder UVs, the atlas covered 8.49 times over - so
//                every part of the gun samples the same pixels. A
//                texture over that looks painted, just painted wrong.
//   meshTexture  a palette typed in screen values comes out chalky; a
//                band measured from the wrong end of the axis paints
//                the gun back to front. Both happened here.
//   nifWrite     a 4.0.0.2 stream has no record sizes, so a writer that
//                is four bytes out produces a file the reader cannot
//                resynchronise. That one at least fails loudly.
//
// The strongest check available is used wherever it exists: what the
// writer writes is parsed back by THE PORT'S OWN parseNif and flattened
// by THE PORT'S OWN flattenNif, and the batch must equal what went in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif, MW_NIF_VERSION } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeDds } from '../src/formats/mwDdsFile.js';
import { writeNif, meshToNif, boundingSphere } from '../tools/nifWrite.mjs';
import { unwrap, unwrapQuality, islandsOf, bestAngle } from '../tools/meshUnwrap.mjs';
import { bandAt, muzzleFraction, vertexAO, writeDds, mipChain, halve, dilate, BANDS } from '../tools/meshTexture.mjs';

/** A unit cube, welded by position and split by face - the shape every
 *  question below can be answered about by hand. Six quads, fanned. */
function cube() {
  const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const quads = [
    [[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]],
    [[0, 1, 5, 4], [0, -1, 0]], [[3, 7, 6, 2], [0, 1, 0]],
    [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]],
  ];
  const positions = []; const normals = []; const uvs = []; const indices = [];
  for (const [ring, n] of quads) {
    const base = positions.length / 3;
    for (const v of ring) { positions.push(...c[v]); normals.push(...n); uvs.push(0, 0); }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    name: 'Cube', positions, normals, uvs, indices,
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

const maxDiff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };

// ── nifWrite ─────────────────────────────────────────────────────────

test('FIELD-GUN-MW2: what the writer writes, the PORT\'S OWN reader reads back', () => {
  const mesh = unwrap(cube(), { size: 64 });
  const nif = parseNif(meshToNif(mesh, { texture: 'x.dds', node: 'Gun' }));
  assert.equal(nif.version, MW_NIF_VERSION);
  // parseNif refuses trailing bytes and a 4.0.0.2 stream has no record
  // sizes, so getting here at all means the writer is byte-exact.
  assert.deepEqual(nif.records.map((r) => r.type), [
    'NiNode', 'NiTriShape', 'NiTriShapeData', 'NiMaterialProperty',
    'NiTexturingProperty', 'NiStencilProperty', 'NiSourceTexture',
  ]);
  assert.deepEqual(nif.roots, [0]);
  // MW-D6: a NAMELESS shape binds ONCE for the part; a named one binds
  // per side and is filtered. A weapon hangs on one bone.
  assert.equal(nif.records[1].name, '');

  const b = flattenNif(nif)[0];
  assert.equal(maxDiff(b.positions, mesh.positions) < 1e-5, true, 'positions survive to float32');
  assert.equal(maxDiff(b.normals, mesh.normals) < 1e-5, true, 'normals survive');
  assert.deepEqual([...b.indices], mesh.indices);
  assert.equal(b.material.textureFile, 'x.dds');
  assert.equal(b.skinned, false);
});

test('FIELD-GUN-MW2: V GOES DOWN, because a NIF and a DDS both run from the top', () => {
  // FBX puts v = 0 at the BOTTOM of the image and a NIF's uv set runs
  // downward from the top, so the write is 1 - v. Get it wrong and the
  // model is textured upside down - which looks like a painting mistake
  // and is not one. Asked with a v that is NOT 0.5, because 1 - 0.5 is
  // 0.5 and a flip is invisible there.
  const mesh = { ...cube(), uvs: cube().uvs.map((_, i) => (i % 2 ? 0.25 : 0.75)) };
  const flipped = flattenNif(parseNif(meshToNif(mesh, { texture: 'x.dds' })))[0];
  assert.ok(Math.abs(flipped.uvs[0] - 0.75) < 1e-6, 'u is untouched');
  assert.ok(Math.abs(flipped.uvs[1] - 0.75) < 1e-6, 'v became 1 - 0.25');
  const kept = flattenNif(parseNif(meshToNif(mesh, { texture: 'x.dds', keepV: true })))[0];
  assert.ok(Math.abs(kept.uvs[1] - 0.25) < 1e-6, '--keep-v leaves it, for a mesh that already holds it that way');
});

test('FIELD-GUN-MW2: the stencil record is what makes an open shell drawable', () => {
  const mesh = unwrap(cube(), { size: 64 });
  const b = flattenNif(parseNif(meshToNif(mesh, { texture: 'x.dds' })))[0];
  // Rule 65: DrawMode 3 (Both) is the ONLY two-sided value - "Default"
  // is a synonym for counter-clockwise WITH culling, not for two-sided.
  assert.equal(b.material.twoSided, true);
  assert.equal(b.material.clockwise, false);
  // ...and the property really is where it comes from: strip it and the
  // same geometry culls.
  const bare = writeNif([
    { type: 'NiNode', name: 'R', children: [1] },
    { type: 'NiTriShape', name: '', data: 2, properties: [] },
    { type: 'NiTriShapeData', positions: mesh.positions, normals: mesh.normals, uvs: mesh.uvs, indices: mesh.indices },
  ], [0]);
  assert.equal(flattenNif(parseNif(bare))[0].material.twoSided, false);
});

test('FIELD-GUN-MW2: a mesh with NO normals says so, rather than writing none under a flag that claims some', () => {
  // A campaign survivor wrote `hasNormals = true` unconditionally and
  // then wrote whatever array it had, which for a mesh without them is
  // nothing at all. Every pin here passed, because every pin here had
  // normals. It is not a harmless branch: a 4.0.0.2 stream has no
  // record sizes, so the reader goes on to take the next 3n floats
  // from the middle of the vertex data and the whole file desynchronises.
  const flat = { ...cube(), normals: null };
  const nif = parseNif(meshToNif(flat, { texture: 'x.dds' }));
  const b = flattenNif(nif)[0];
  assert.equal(b.normals, null, 'the batch has no normals, because the mesh had none');
  assert.equal(maxDiff(b.positions, flat.positions) < 1e-5, true, 'and the positions are still the positions');
  assert.deepEqual([...b.indices], flat.indices, 'and the triangles are still the triangles');
  assert.equal(b.material.textureFile, 'x.dds', 'and everything after the geometry still reads');
});

test('FIELD-GUN-MW2: the writer refuses what the format cannot hold, and states its own bounds', () => {
  const big = { name: 'X', positions: new Array(70000 * 3).fill(0), normals: null, uvs: null, indices: [0, 1, 2] };
  assert.throws(() => meshToNif(big), /will not fit NiTriShapeData's uint16/);
  assert.throws(() => meshToNif({ name: 'X', positions: [], indices: [] }), /no positions/);
  assert.throws(() => meshToNif({ name: 'X', positions: [0, 0, 0], indices: [] }), /no triangles/);
  assert.throws(() => writeNif([{ type: 'NiParticleSystem' }]), /no NIF writer for record type/);
  // The sphere the exporter is expected to have computed. A file that
  // lies about its own bounds is a file that lies, even where nothing
  // downstream reads them.
  const s = boundingSphere([-1, 0, 0, 1, 0, 0, 0, 2, 0, 0, -2, 0]);
  assert.deepEqual(s.center, [0, 0, 0]);
  assert.ok(Math.abs(s.radius - 2) < 1e-9);
  assert.deepEqual(boundingSphere([]).center, [0, 0, 0]);
});

// ── meshUnwrap ───────────────────────────────────────────────────────

test('FIELD-GUN-MW2: an overlapping unwrap is CONDEMNED by measurement, not by eye', () => {
  // This is the finding that turned the slice: Mac's export carried
  // Blender's factory cylinder UVs, and the number that says so is the
  // summed triangle UV area - 1.0 fills the atlas exactly once.
  const stacked = { ...cube(), uvs: cube().uvs.map((_, i) => (i % 2 ? [0, 0, 1, 1][Math.floor(i / 2) % 4] : [0, 1, 1, 0][Math.floor(i / 2) % 4])) };
  const q = unwrapQuality(stacked);
  assert.equal(q.overlapping, true, 'six faces on one square is an overlap');
  assert.match(q.verdict, /islands overlap/);
  assert.equal(unwrapQuality({ ...cube(), uvs: null }).hasUvs, false);
  // ...and the same measurement passes a real one, so the test is about
  // the LAYOUT and not about being pessimistic.
  assert.equal(unwrap(cube(), { size: 64 }).unwrap.quality.overlapping, false);
});

test('FIELD-GUN-MW2: islands break at a hard angle, walked over WELDED positions', () => {
  // A cube is six faces at ninety degrees. Under the default threshold
  // they are six islands; open the threshold past ninety and the whole
  // cube is one.
  assert.equal(islandsOf(cube(), 66).islands.length, 6);
  assert.equal(islandsOf(cube(), 120).islands.length, 1,
    'the adjacency is over WELDED positions - by vertex index every face is its own island and this would still say 6');
  assert.equal(islandsOf(cube(), 0).islands.length, 6);
});

test('FIELD-GUN-MW2: one scale for every island, and nothing overlaps after it', () => {
  const out = unwrap(cube(), { size: 128, margin: 4 });
  assert.equal(out.unwrap.islands, 6);
  const q = out.unwrap.quality;
  assert.equal(q.overlapping, false);
  for (let i = 0; i < out.uvs.length; i++) assert.ok(out.uvs[i] >= 0 && out.uvs[i] <= 1, 'inside the atlas');
  // ONE GLOBAL SCALE is the property that makes a texture look like it
  // belongs to the model: a texel is the same size in world units
  // everywhere. Six identical faces must therefore get six identical
  // island areas - a per-island scale would give them all the same
  // SHAPE and different sizes, and pass every other check here.
  const { islands } = islandsOf(out, 66);
  const areas = islands.map((faces) => {
    let x0 = 1; let x1 = 0; let y0 = 1; let y1 = 0;
    for (const f of faces) {
      for (let e = 0; e < 3; e++) {
        const v = out.indices[f * 3 + e];
        x0 = Math.min(x0, out.uvs[v * 2]); x1 = Math.max(x1, out.uvs[v * 2]);
        y0 = Math.min(y0, out.uvs[v * 2 + 1]); y1 = Math.max(y1, out.uvs[v * 2 + 1]);
      }
    }
    return (x1 - x0) * (y1 - y0);
  });
  assert.ok(Math.max(...areas) - Math.min(...areas) < 1e-3, `six equal faces, six equal islands: ${areas.map((a) => a.toFixed(4)).join(' ')}`);
  assert.ok(areas.reduce((a, b) => a + b, 0) > 0.4, 'the atlas is actually used');

  // AND THE SCALE IS SEARCHED FOR, not capped at its starting bound.
  // The islands are in THE MESH'S OWN units, so whether the answer is
  // above or below 1 is a property of how big the model happens to be
  // - the first cut here bisected in [0, 1] and returned exactly 1 for
  // the Thunderlock, whose longest axis is 1 by construction, leaving
  // sixty per cent of its atlas empty. A SMALL mesh is the case that
  // catches it: a fifth of a unit across, the scale has to climb well
  // past the old bound or the islands are specks.
  const small = cube();
  small.positions = small.positions.map((v) => v * 0.1);
  small.bounds = { min: [-0.1, -0.1, -0.1], max: [0.1, 0.1, 0.1] };
  const tiny = unwrap(small, { size: 128, margin: 4 });
  assert.ok(tiny.unwrap.scale > 1.4, `the scale search is capped at its bound: ${tiny.unwrap.scale}`);
  // ...and the ATLAS it produces is the same one, because the scale is
  // exactly what absorbs the model's size.
  assert.ok(Math.abs(tiny.unwrap.scale * 0.2 - out.unwrap.scale * 2) < 1e-3,
    'a mesh ten times smaller packs to the same islands at ten times the scale');

  // No triangle is lost, and a vertex on two islands became two.
  assert.equal(out.indices.length, cube().indices.length);
  assert.equal(out.positions.length / 3, 24, 'the cube was authored split; nothing merged and nothing vanished');
});

test('FIELD-GUN-MW2: a vertex on two islands becomes TWO vertices', () => {
  // A vertex buffer has room for one UV per vertex, and a vertex on an
  // island boundary has two. The cube cannot ask this - it is authored
  // split, so no index is ever shared across a fold - which is exactly
  // how a campaign mutant keyed the rebuild on the vertex alone and
  // passed everything.
  //
  // A ROOF: a quad in the z = 0 plane and a quad in the y = 1 plane,
  // meeting along the edge v2-v3, which both of them use.
  const roof = {
    name: 'roof',
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0],
    uvs: [0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1],
    indices: [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4],
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  };
  assert.equal(islandsOf(roof, 66).islands.length, 2, 'two plates at ninety degrees');
  const out = unwrap(roof, { size: 64 });
  assert.equal(out.unwrap.islands, 2);
  assert.equal(out.positions.length / 3, 8,
    'six authored vertices, and the two on the fold are used by both islands - so eight out');
  assert.equal(out.indices.length, roof.indices.length, 'no triangle lost');
  assert.equal(out.unwrap.quality.overlapping, false,
    'and the two islands do not land on each other, which is what a shared vertex would force');
  // The duplicates are duplicates: same position, different UV.
  const at = (i) => [out.positions[i * 3], out.positions[i * 3 + 1], out.positions[i * 3 + 2]].join(',');
  const byPos = new Map();
  for (let v = 0; v < out.positions.length / 3; v++) {
    const k = at(v);
    byPos.set(k, [...(byPos.get(k) ?? []), v]);
  }
  const shared = [...byPos.values()].filter((l) => l.length > 1);
  assert.equal(shared.length, 2, 'exactly the two fold vertices doubled');
  for (const [a, b] of shared) {
    assert.notDeepEqual([out.uvs[a * 2], out.uvs[a * 2 + 1]], [out.uvs[b * 2], out.uvs[b * 2 + 1]],
      'a copy that carries the same UV is not a split, it is waste');
  }
});

test('FIELD-GUN-MW2: the minimum-area rectangle is what packs', () => {
  // A 4x1 rectangle turned 45 degrees has a bounding box of about 3.5
  // square; found and straightened it is 4.
  const pts = [];
  const a = Math.PI / 4;
  for (const [x, y] of [[0, 0], [4, 0], [4, 1], [0, 1]]) pts.push([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  const fit = bestAngle(pts);
  assert.ok(Math.abs(fit.area - 4) < 0.05, `the rectangle was found: area ${fit.area.toFixed(3)}`);
  assert.ok(Math.abs(Math.max(fit.w, fit.h) - 4) < 0.05 && Math.abs(Math.min(fit.w, fit.h) - 1) < 0.05);
});

// ── meshTexture ──────────────────────────────────────────────────────

test('FIELD-GUN-MW2: the bands run BACK FROM THE MUZZLE, which is the axis maximum', () => {
  // The bug this pin exists for: `along` was measured from the axis
  // MINIMUM, which after the MW1 bake is the butt - so the sooted
  // muzzle band painted the grip and the matte grip band painted the
  // barrel. Both ends are dark, so it looked plausible and only the two
  // middle bands were visibly wrong.
  const bounds = { min: [0, -0.5, 0], max: [0, 0.5, 0] };
  assert.equal(muzzleFraction(0.5, bounds), 0, 'the muzzle is +Y, which is FORWARD after the bake');
  assert.equal(muzzleFraction(-0.5, bounds), 1);
  assert.equal(muzzleFraction(0, bounds), 0.5);
  assert.equal(bandAt(muzzleFraction(0.5, bounds)).name, 'muzzle');
  assert.equal(bandAt(muzzleFraction(-0.5, bounds)).name, 'grip');
  // The barrel is the BRIGHTEST band and the grip the darkest - the
  // separation the whole unwrap exists to make possible.
  const lum = (t) => bandAt(t).colour.reduce((a, b) => a + b, 0);
  assert.ok(lum(0.2) > lum(0.6), 'barrel brighter than receiver');
  assert.ok(lum(0.6) > lum(0.95), 'receiver brighter than grip');
  assert.ok(lum(0.2) > lum(0.01), 'barrel brighter than the sooted muzzle');
  // LINEAR, not screen values: linear 0.30 encodes to sRGB 0.59, and a
  // palette typed as though these were sRGB comes out chalky.
  for (const band of BANDS) for (const c of band.colour) assert.ok(c < 0.4, 'a linear palette, not an sRGB one');
});

test('FIELD-GUN-MW2: occlusion is CAST, so a face against a wall is darker than one facing away', () => {
  // A cube with a large plate a hair in front of ONE of its faces. The
  // plate is deliberately much bigger than the face: every vertex of a
  // cube is a corner, and against an equal-sized occluder a corner
  // still sees three quarters of its hemisphere past the edges - which
  // is a real number and a terrible pin, because it makes "occluded"
  // and "open" differ by less than the noise a retune would cause.
  const c = cube();
  const base = c.positions.length / 3;
  const plate = [];
  for (const [y, z] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) plate.push(1.05, y, z);
  const mesh = {
    name: 'walled',
    positions: [...c.positions, ...plate],
    normals: [...c.normals, ...[0, 1, 2, 3].flatMap(() => [-1, 0, 0])],
    uvs: [...c.uvs, 0, 0, 0, 0, 0, 0, 0, 0],
    indices: [...c.indices, base, base + 1, base + 2, base, base + 2, base + 3],
    bounds: { min: [-1, -3, -3], max: [1.05, 3, 3] },
  };
  const ao = vertexAO(mesh, { rays: 48, range: 0.5 });
  const against = []; const away = [];
  for (let v = 0; v < base; v++) {
    const nx = mesh.normals[v * 3];
    if (nx > 0.5) against.push(ao[v]);
    else if (nx < -0.5) away.push(ao[v]);
  }
  const mean = (l) => l.reduce((s2, v) => s2 + v, 0) / l.length;
  assert.equal(against.length, 4);
  assert.equal(away.length, 4);
  assert.ok(mean(against) < 0.25, `a face five hundredths off a wall is nearly shut: ${mean(against).toFixed(3)}`);
  assert.ok(mean(away) > 0.95, `the opposite face sees the sky: ${mean(away).toFixed(3)}`);
  // A CONSTANT would pass "darker than", so the RANGE is asked too:
  // an occluder beyond `range` is the far side of the object, not a
  // crevice, and must not count.
  const far = vertexAO(mesh, { rays: 48, range: 0.01 });
  const farAgainst = [];
  for (let v = 0; v < base; v++) if (mesh.normals[v * 3] > 0.5) farAgainst.push(far[v]);
  assert.ok(mean(farAgainst) > 0.95,
    `with the range inside the gap nothing occludes: ${mean(farAgainst).toFixed(3)}`);
});

test('FIELD-GUN-MW2: the DDS the port ships is one the port can read', () => {
  const top = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) };
  for (let i = 0; i < 16; i++) { top.data[i * 4] = 200; top.data[i * 4 + 1] = 120; top.data[i * 4 + 2] = 40; top.data[i * 4 + 3] = 255; }
  const levels = mipChain(top);
  assert.deepEqual(levels.map((l) => l.width), [4, 2, 1], 'down to 1x1');
  const img = decodeDds(new Uint8Array(writeDds(levels)));
  assert.equal(img.width, 4);
  assert.equal(img.mips.length, 3);
  // The byte order is the one the masks describe (B, G, R, A), and
  // getting it backwards makes bronze come out blue.
  assert.deepEqual([...img.mips[0].rgba.slice(0, 4)], [200, 120, 40, 255]);
  assert.deepEqual([...img.mips[2].rgba.slice(0, 4)], [200, 120, 40, 255], 'a flat image halves to itself');
  assert.equal(halve({ width: 1, height: 1, data: top.data.slice(0, 4) }).width, 1, '1x1 cannot halve below itself');
});

test('FIELD-GUN-MW2: the atlas is DILATED, or every seam draws a dark rim', () => {
  // Bilinear filtering and every mip level sample ACROSS an island's
  // edge, so an atlas whose background is left empty draws a dark line
  // around each seam on the model - worse the further away you stand,
  // because each mip mixes in more of the background.
  const size = 8;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const covered = new Uint8Array(size * size);
  const at = 3 * size + 3;
  covered[at] = 1;
  rgba[at * 4] = 240; rgba[at * 4 + 1] = 160; rgba[at * 4 + 2] = 80; rgba[at * 4 + 3] = 255;
  dilate(rgba, covered, size, 1);
  const n = (2 * size + 3) * 4;
  assert.equal(rgba[n], 240, 'the neighbour took the covered texel\'s colour');
  assert.equal(rgba[n + 3], 255, 'and is opaque, so a mip cannot average in a transparent black');
  assert.equal(rgba[(0 * size + 0) * 4 + 3], 0, 'one pass reaches one ring, not the whole atlas');
});
