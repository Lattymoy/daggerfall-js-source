// WAGONS1 (2026-10-09): Mac's wagons.blend (the newest of the four saves he sent - tools/bakeWagons.mjs says why it is
// the one committed) baked into src/assets/wagons/{cart,openWagon,caravan}.json by tools/bakeWagons.mjs: each file
// re-made to the byte, every object of the scene read by one wagon or skipped as what it is, each wagon's frame its own
// rear wheels' (on the ground at y 0, turning about z 0), and a scene that has moved under a spec refused.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeWagons, WAGONS, SKIP, SOURCE_FBX, SCALE, toWagon } from '../tools/bakeWagons.mjs';
import { bakeJson, sceneObjects } from '../tools/shipBake.mjs';
import { readFbx } from '../tools/fbxRead.mjs';

const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
const tree = readFbx(bytes);
const baked = bakeWagons(bytes, tree);
const pointsOf = (p) => { const out = []; for (let i = 0; i < p.positions.length; i += 3) out.push(p.positions.slice(i, i + 3)); return out; };

test('WAGONS1 THE BAKE: each wagon re-made to the byte from the committed scene - its source, hash and frame carried, every role once (mutants: a role dropped, the frame unread, a wagon not written)', () => {
  for (const spec of WAGONS) {
    const b = baked[spec.key];
    assert.equal(bakeJson(b), readFileSync(new URL(`../${spec.out}`, import.meta.url), 'utf8'), `${spec.key}: re-made to the byte`);
    assert.equal(b.source, SOURCE_FBX);
    assert.equal(b.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(b.frame, { ...spec.frame });
    assert.equal(b.frame.scale, SCALE);
    assert.deepEqual(b.parts.map((p) => p.role).sort(), Object.values(spec.roles).map((r) => r.role).sort(), `${spec.key}: every role, once`);
  }
  assert.deepEqual(WAGONS.map((w) => w.key), ['cart', 'openWagon', 'caravan']);
});

test('WAGONS1 THE FRAME: each wagon stands on the ground under its rear wheels - their lowest corner at y 0 (none of its parts lower), their turning centres at z 0, the pull toward +z (the cart\'s shafts, the four-wheelers\' benches ahead), and the map a mirror (mutants: the forward unread, the ground off, the rear off)', () => {
  for (const spec of WAGONS) {
    const b = baked[spec.key];
    let low = Infinity, wheelLow = Infinity;
    for (const p of b.parts) for (const q of pointsOf(p)) { low = Math.min(low, q[1]); if (p.role.startsWith('wheelRear')) wheelLow = Math.min(wheelLow, q[1]); }
    assert.ok(Math.abs(wheelLow) < 1e-4, `${spec.key}: its rear wheels on the ground (${wheelLow})`);
    assert.ok(low > -0.02, `${spec.key}: nothing under the ground but the cart's shaft tips, resting on it as drawn (${low})`);
    for (const w of b.parts.filter((p) => p.role.startsWith('wheelRear'))) assert.equal(w.origin[2], 0, `${spec.key} ${w.role}: turns about z 0`);
    const ahead = b.parts.find((p) => p.role === (spec.key === 'cart' ? 'shaftLeft' : 'bench'));
    assert.ok(Math.min(...pointsOf(ahead).map((q) => q[2])) > 1.5, `${spec.key}: ${ahead.role} ahead, toward +z`);
    // right and left: the right rear wheel at +x
    const right = b.parts.find((p) => p.role === 'wheelRearRight'), left = b.parts.find((p) => p.role === 'wheelRearLeft');
    assert.ok(right.origin[0] > 1 && left.origin[0] < -1, `${spec.key}: the right wheel on the right`);
  }
  // the map is a mirror both ways round (Mac's right-handed scene into the left-handed world)
  const det = (f) => { const o = toWagon([0, 0, 0], f), x = toWagon([1, 0, 0], f), y = toWagon([0, 1, 0], f), z = toWagon([0, 0, 1], f); const a = [0, 1, 2].map((k) => x[k] - o[k]), b = [0, 1, 2].map((k) => y[k] - o[k]), c = [0, 1, 2].map((k) => z[k] - o[k]); return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); };
  for (const spec of WAGONS) assert.ok(det(spec.frame) < 0, `${spec.key}: a mirror`);
  assert.throws(() => toWagon([0, 0, 0], { ...WAGONS[0].frame, forward: '+X' }), /pulled toward -Y or \+Y/);
});

test('WAGONS1 ONE SCENE, THREE WAGONS: every object read by exactly one wagon or skipped as what it is; and a scene moved under a spec refused - a part out of its box, an object no spec names, a skipped station standing in a wagon\'s band, a frame off its wheels (mutants: a skip unchecked, the box unchecked, the frame unchecked)', () => {
  const names = sceneObjects(tree).map((o) => o.name);
  for (const n of names) {
    const by = WAGONS.filter((w) => w.roles[n]).map((w) => w.key);
    assert.ok(by.length <= 1, `${n} read by ${by.join(' and ')}`);
    assert.ok(by.length === 1 || SKIP[n], `${n}: read or skipped`);
  }
  assert.equal(names.length, 42);
  const [cart, ...rest] = WAGONS;
  const bake = (c, skip = SKIP) => bakeWagons(bytes, tree, SOURCE_FBX, [c, ...rest], skip);
  const [name, r] = Object.entries(cart.roles)[0];
  assert.throws(() => bake({ ...cart, roles: { ...cart.roles, [name]: { ...r, box: [r.box[0].map((v) => v + 0.05), r.box[1].map((v) => v + 0.05)] } } }), /was read standing in the box/);
  const { [name]: _gone, ...fewer } = cart.roles;
  assert.throws(() => bake({ ...cart, roles: fewer }), /plays no part on any wagon/);
  assert.throws(() => bake({ ...cart, frame: { ...cart.frame, ground: cart.frame.ground + 0.01 } }), /stands on scene Z/);
  assert.throws(() => bake({ ...cart, frame: { ...cart.frame, rear: cart.frame.rear + 0.01 } }), /turns about scene Y/);
  const { 'Cube.012': _tiny, ...fewerSkips } = SKIP;
  assert.throws(() => bake(cart, fewerSkips), /plays no part on any wagon/);
  assert.throws(() => bake(cart, { ...SKIP, 'Cylinder.019': { band: true } }), /both skipped and read/);
  assert.throws(() => bake({ ...cart, band: [0, 80] }), /stands in the cart's/);
});
