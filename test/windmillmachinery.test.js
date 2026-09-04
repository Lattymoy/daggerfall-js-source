import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MACHINERY, PLANK_GEAR, ROLLER, MACHINERY_CHILDREN, MACHINERY_MODEL_ID } from '../src/world/windmillMesh.js';
import { WINDMILL_INTERIOR } from '../src/world/windmillInterior.js';
import { mountMachineryChild, advanceMachinery, ROTOR_SIGN, CALM_ROTOR_DEG_PER_SEC } from '../src/world/windmills.js';
import { identity, trs, transformPoint, quatToMat4 } from '../src/world/mat4.js';
import { parseCollada } from '../scripts/bakeWindmill.mjs';

// WM4b - THE MACHINERY: model 41601, the centrepiece of the room Kamer's
// mill adds, and the two moving parts his prefab hangs off it.
//
// The room placed 41601 since WM2g and the port dropped it as an id no
// ARCH3D carries. These pins hold: the bake against the vendored DAEs
// and the prefab's material lists (machinery.json), the two children
// standing where the prefab stands them and turning about the axis and
// at the rate his scripts turn them, and the wiring - the pipeline
// answering 41601 before ARCH3D is asked, and both interior hosts
// turning and drawing the parts.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(root, 'vendor/windmills-kamer');
const machinery = JSON.parse(readFileSync(join(VENDOR, 'machinery.json'), 'utf8'));
const near = (a, b, eps) => Math.abs(a - b) <= eps;

test('WM4b: the baked machinery is what the vendored files say, re-derived', () => {
  const body = parseCollada(readFileSync(join(VENDOR, machinery.body.file), 'utf8'), machinery.body.materials, { nodeMatrix: 'assert' });
  assert.deepEqual([...MACHINERY.positions], body.positions.map((v) => Math.fround(+v.toFixed(6))));
  assert.deepEqual([...MACHINERY.indices], body.indices);
  assert.deepEqual(MACHINERY.subMeshes.map((s) => ({ ...s })), body.subMeshes);
  const baked = { PLANK_GEAR, ROLLER };
  for (const c of machinery.children) {
    const m = parseCollada(readFileSync(join(VENDOR, c.file), 'utf8'), c.materials, { nodeMatrix: 'ignore' });
    const b = baked[c.name.toUpperCase()];
    assert.ok(b, `no baked mesh for ${c.name}`);
    assert.deepEqual([...b.positions], m.positions.map((v) => Math.fround(+v.toFixed(6))));
    assert.deepEqual([...b.indices], m.indices);
    assert.deepEqual(b.subMeshes.map((s) => ({ ...s })), m.subMeshes);
  }
});

test('WM4b: the material maps are the prefab\'s, in the DAE\'s triangle order, and complete', () => {
  // Read out of Models/Finished/41601.prefab by guid -> .mat name. The
  // body's eight groups; the roller's three (the README had called it
  // untextured off the DAE alone). A drawn material with no map entry
  // throws, and so does a map entry no triangles use.
  assert.deepEqual(MACHINERY.subMeshes.map((s) => [s.textureArchive, s.textureRecord]),
    [[366, 0], [91, 2], [91, 3], [166, 4], [67, 1], [332, 0], [124, 2], [91, 3]]);
  assert.deepEqual(ROLLER.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), [[67, 1], [91, 2], [91, 3]]);
  assert.deepEqual(PLANK_GEAR.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), [[67, 1]]);
  const roller = readFileSync(join(VENDOR, 'Roller.dae'), 'utf8');
  assert.throws(() => parseCollada(roller, { 'Material_001-material': [67, 1] }, { nodeMatrix: 'ignore' }),
    /no texture for material Material_002-material/);
  assert.throws(() => parseCollada(roller, { ...machinery.children[1].materials, 'Nothing-material': [1, 1] }, { nodeMatrix: 'ignore' }),
    /names Nothing-material, which no triangles use/);
  // Plank_Gear declares nine materials and draws one; the map names the
  // one, and the reader must not demand the other eight.
  const gear = readFileSync(join(VENDOR, 'Plank_Gear.dae'), 'utf8');
  assert.equal([...gear.matchAll(/<material id=/g)].length, 9);
  assert.equal([...gear.matchAll(/<triangles /g)].length, 1);
  assert.doesNotThrow(() => parseCollada(gear, machinery.children[0].materials, { nodeMatrix: 'ignore' }));
});

test('WM4b: a bare-mesh part ignores its node matrix; the body still asserts its own', () => {
  // Plank_Gear's node matrix is nothing like the Z_UP one; the prefab
  // never applied it (m_Mesh straight into the DAE), so neither do we.
  const gear = readFileSync(join(VENDOR, 'Plank_Gear.dae'), 'utf8');
  assert.throws(() => parseCollada(gear, machinery.children[0].materials), /node matrix differs/);
  assert.doesNotThrow(() => parseCollada(gear, machinery.children[0].materials, { nodeMatrix: 'ignore' }));
  assert.throws(() => parseCollada(gear, machinery.children[0].materials, { nodeMatrix: 'whatever' }), /nodeMatrix must be/);
  // The body is a bare mesh too, and its matrix happens to be the
  // identity-composing one, so the assertion stays as a re-export guard.
  assert.doesNotThrow(() => parseCollada(readFileSync(join(VENDOR, '41601.dae'), 'utf8'), machinery.body.materials));
});

test('WM4b: the children are the prefab\'s two, verbatim - transform, axis, rate, script, collider', () => {
  assert.equal(MACHINERY_MODEL_ID, 41601);
  assert.deepEqual(MACHINERY_CHILDREN.map((c) => c.name), ['Plank_Gear', 'Roller']);
  const [gear, roller] = MACHINERY_CHILDREN;
  assert.deepEqual([...gear.position], [11.02, 4.49, -2.28]);
  assert.deepEqual([...gear.rotation], [0.5, 0.5, -0.5, 0.5]);
  assert.equal(gear.axis, 'z'); assert.equal(gear.degPerSec, -13); assert.equal(gear.collider, false);
  assert.deepEqual([...roller.position], [9.64, -7.14, -2.21]);
  assert.deepEqual([...roller.rotation], [-0.7071068, 0, 0, 0.7071068]);
  assert.equal(roller.axis, 'x'); assert.equal(roller.degPerSec, 13); assert.equal(roller.collider, true);
  // The table is the vendored record, not a copy that could drift.
  assert.deepEqual(MACHINERY_CHILDREN.map((c) => [c.name, [...c.position], [...c.rotation], c.axis, c.degPerSec, c.collider]),
    machinery.children.map((c) => [c.name, c.position, c.rotation, c.axis, c.degPerSec, c.collider]));
  // His scripts, read: Spin_Up.cs is `Rotate(0f, 0f, -13 * dt, Self)`,
  // SpinTime_Roller.cs is `Rotate(13 * dt, 0f, 0f, Self)`. The sail
  // carries Spin_Up too, so the gear's rate IS the sail's calm rate
  // under the sail's sign.
  assert.equal(gear.degPerSec, ROTOR_SIGN * CALM_ROTOR_DEG_PER_SEC);
});

test('WM4b: a child is carried to its place, stood as the prefab stands it, then spun about its OWN axis', () => {
  // parent * T(p) * R(q) * R_axis(a): the spin happens LAST, in the
  // part's own frame, which is Space.Self.
  const [gear, roller] = MACHINERY_CHILDREN;
  // The gear's quaternion stands its long axis (its own Z, 22.5 long)
  // upright: a point up its own Z lands straight above its position.
  const tip = transformPoint(mountMachineryChild(identity(), gear, 0), 0, 0, -11.27);
  assert.ok(near(tip[0], 11.02, 1e-4) && near(tip[1], 4.49 + 11.27, 1e-3) && near(tip[2], -2.28, 1e-4),
    `gear tip [${tip}]`);
  // Spinning about its own Z leaves that tip where it is - the axis is
  // the part's, not the world's. Spinning about world Z would move it.
  const tipSpun = transformPoint(mountMachineryChild(identity(), gear, 90), 0, 0, -11.27);
  assert.ok(tip.every((v, i) => near(v, tipSpun[i], 1e-4)), 'the gear tip moved under its own spin');
  const tipWorld = transformPoint(trs(0, 0, 0, 0, 0, 90), tip[0], tip[1], tip[2]);
  assert.ok(!near(tipWorld[0], tip[0], 1e-3), 'world-Z spin is indistinguishable here; the pin proves nothing');
  // A point off the gear's axis DOES go round, and by the angle asked.
  const a = transformPoint(mountMachineryChild(identity(), gear, 0), 1, 0, 0);
  const b = transformPoint(mountMachineryChild(identity(), gear, 180), 1, 0, 0);
  assert.ok(near(a[0] + b[0], 2 * 11.02, 1e-4) && near(a[2] + b[2], 2 * -2.28, 1e-4), 'a half turn is not a reflection through the axis');
  // The roller: -90 about X, then its own X. A point on its own X axis
  // stays put under any spin, and sits on the line through its position.
  const rx = transformPoint(mountMachineryChild(identity(), roller, 137), 3, 0, 0);
  assert.ok(near(rx[0], 9.64 + 3, 1e-4) && near(rx[1], -7.14, 1e-4) && near(rx[2], -2.21, 1e-4), `roller axis point [${rx}]`);
  // No scale, and the matrices are the prefab's numbers, not a re-derivation.
  const stand = quatToMat4(roller.rotation);
  const stood = mountMachineryChild(identity(), roller, 0);
  for (let i = 0; i < 12; i++) assert.ok(near(stood[i], stand[i], 1e-6), `roller stand differs at ${i}`);
});

test('WM4b: the machinery keeps HIS constant, integrated, signed per part', () => {
  const [gear, roller] = MACHINERY_CHILDREN;
  const g = { angle: 0 }, r = { angle: 0 };
  advanceMachinery(g, 1, gear); advanceMachinery(r, 1, roller);
  assert.ok(near(g.angle, 347, 1e-9), `gear after 1s: ${g.angle}`);   // -13, wrapped
  assert.ok(near(r.angle, 13, 1e-9), `roller after 1s: ${r.angle}`);
  // Integrated: two half-steps land where one whole step does.
  const h = { angle: 0 };
  advanceMachinery(h, 0.5, roller); advanceMachinery(h, 0.5, roller);
  assert.ok(near(h.angle, r.angle, 1e-9));
  // And always in [0, 360).
  for (let i = 0; i < 1000; i++) advanceMachinery(g, 0.37, gear);
  assert.ok(g.angle >= 0 && g.angle < 360);
});

test('WM4b: the machinery fits its room, and the parts sit inside the machinery', () => {
  // A sanity that costs nothing: the children's rest bounds lie within
  // the body's, and the body stands in the room WM2g vendored.
  const inside = (p, b, eps = 0.5) => p.every((v, i) => v >= b.min[i] - eps && v <= b.max[i] + eps);
  for (const c of MACHINERY_CHILDREN) {
    const mesh = { PLANK_GEAR, ROLLER }[c.mesh];
    const m = mountMachineryChild(identity(), c, 0);
    for (const corner of [mesh.bounds.min, mesh.bounds.max]) {
      const p = transformPoint(m, corner[0], corner[1], corner[2]);
      assert.ok(inside(p, MACHINERY.bounds, 2), `${c.name} corner [${p.map((v) => v.toFixed(2))}] is outside the machinery`);
    }
  }
  const placed = WINDMILL_INTERIOR.block3dObjectRecords.filter((o) => o.modelIdNum === MACHINERY_MODEL_ID);
  assert.equal(placed.length, 1, 'the room places the machinery once');
});

test('WM4b: the wiring - the pipeline answers 41601 before ARCH3D, and both interior hosts turn the parts', () => {
  const src = (p) => readFileSync(join(root, p), 'utf8');
  const pipeline = src('src/scenes/dataPipeline.js');
  // The replacement arm sits ABOVE the ARCH3D lookup in getGpuMesh, as
  // DFU asks MeshReplacement before it reads the classic record.
  const fn = pipeline.slice(pipeline.indexOf('async function getGpuMesh('));
  const replaceAt = fn.indexOf('MACHINERY_MODEL_ID');
  const archAt = fn.indexOf('arch.getRecordIndex(modelIdNum)');
  assert.ok(replaceAt > 0 && replaceAt < archAt, 'the replacement must be tried before ARCH3D');
  assert.match(fn, /cpuModels\.set\(modelIdNum, \{ positions: MACHINERY\.positions/, 'the collider needs a CPU copy');
  assert.match(pipeline, /async function getMachineryParts\(\)/);
  assert.match(pipeline, /getMachineryParts, gpuMeshes/, 'the parts are not returned to the hosts');
  // The context builds the rotors and exports them; the roller's rest
  // pose reaches the collider, the gear's does not.
  const ctx = src('src/scenes/interiorContext.js');
  assert.match(ctx, /p\.modelIdNum === MACHINERY_MODEL_ID && getMachineryParts/);
  assert.match(ctx, /if \(part\.child\.collider\) \{[\s\S]*?collider\.addMesh\('interior', part\.cpu\.positions/);
  assert.match(ctx, /rotors\.push\(\{ gpu: part\.gpu, child: part\.child, parent: matrix, state: \{ angle: 0 \} \}\)/);
  assert.match(ctx, /\n    rotors,/, 'rotors are not returned');
  // Both hosts that mount an interior context advance and draw them,
  // through the module's law and not a local copy of it.
  for (const host of ['src/scenes/interior.js', 'src/scenes/worldModes.js']) {
    const h = src(host);
    assert.match(h, /import \{ advanceMachinery, mountMachineryChild(, [^}]*)? \} from '\.\.\/world\/windmills\.js'/, `${host}: no law import`);
    assert.match(h, /advanceMachinery\(r\.state, dt, r\.child\);\s*\n\s*renderer\.drawMesh\(r\.gpu, mountMachineryChild\(r\.parent, r\.child, r\.state\.angle\)/, `${host}: does not turn and draw`);
    // interior.js spreads the whole pipeline into the deps; worldModes
    // names each dep and so must name this one.
    assert.ok(/getMachineryParts/.test(h) || /\{ \.\.\.pipeline, renderer \}/.test(h), `${host}: does not hand the parts door to the context`);
  }
});
