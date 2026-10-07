// SHIPS-2 (2026-10-07): Mac's Tiny_Ship.fbx - the one scene that holds both new ships (his New Ship 2 and his Tiny Ship,
// tools/bakeCarrack.mjs says why it is the one committed) - baked into src/assets/ships/carrack.json and largeBoat.json
// by tools/shipBake.mjs, the galleon's bake made every ship's: each file re-made to the byte, the scene split between
// the two ships with nothing read twice and nothing unread, and a scene that has moved under a spec refused.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeCarrack, CARRACK_SPEC, SOURCE_FBX, OUT as CARRACK_OUT } from '../tools/bakeCarrack.mjs';
import { bakeLargeBoat, LARGE_BOAT_SPEC, OUT as LARGE_BOAT_OUT } from '../tools/bakeLargeBoat.mjs';
import { bakeScene, bakeJson, sceneObjects, toBoat } from '../tools/shipBake.mjs';
import { readFbx } from '../tools/fbxRead.mjs';

const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
const tree = readFbx(bytes);
const SHIPS = [['carrack', bakeCarrack, CARRACK_SPEC, CARRACK_OUT], ['large boat', bakeLargeBoat, LARGE_BOAT_SPEC, LARGE_BOAT_OUT]];

test('SHIPS-2 THE BAKES: Mac\'s one scene baked to each ship\'s frame is each file committed, byte for byte - the source\'s path, hash and frame carried, every role of each ship once, each hull square on its own centreline (mutants: a role dropped, the frame unread, the centreline unread)', () => {
  for (const [ship, bake, spec, out] of SHIPS) {
    const baked = bake(bytes, tree);
    assert.equal(bakeJson(baked), readFileSync(new URL(`../${out}`, import.meta.url), 'utf8'), `${ship}: re-made to the byte`);
    assert.equal(baked.source, SOURCE_FBX);
    assert.equal(baked.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(baked.frame, { ...spec.frame });
    const roles = baked.parts.map((p) => p.role);
    for (const r of new Set(Object.values(spec.roles).map((x) => x.role))) assert.ok(roles.includes(r), `${ship}: ${r}`);
    // her centreline taken off: the scene's (midship, centreline, waterline) is her origin
    assert.deepEqual(toBoat([spec.frame.midship, spec.frame.centreline, spec.frame.waterline], spec.frame), [0, 0, 0]);
    const hull = baked.parts.find((p) => p.role === 'hull').positions;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < hull.length; i += 3) { lo = Math.min(lo, hull[i]); hi = Math.max(hi, hull[i]); }
    assert.ok(Math.abs(lo + hi) < 2e-4, `${ship}: her half beam to port and to starboard (${lo}, ${hi})`);
  }
});

test('SHIPS-2 ONE SCENE, TWO SHIPS: every object of Mac\'s scene is read by one ship and skipped by the other, or skipped by both - none read twice, none unread; and a scene moved under a spec is refused - an object standing out of the box it was read in, an object no spec names (mutants: a skip unchecked, the box unchecked)', () => {
  const objects = sceneObjects(tree).map((o) => o.name);
  const reads = (spec, n) => !!spec.roles[n], skips = (spec, n) => !!spec.skip[n];
  for (const n of objects) {
    const by = SHIPS.filter(([, , spec]) => reads(spec, n)).map(([ship]) => ship);
    assert.ok(by.length <= 1, `${n} read by ${by.join(' and ')}`);
    for (const [ship, , spec] of SHIPS) assert.ok(reads(spec, n) || skips(spec, n), `${n}: the ${ship} reads it or skips it`);
  }
  // a role's box moved 5 cm: refused, the scene to be read again
  const [name, r] = Object.entries(LARGE_BOAT_SPEC.roles)[0];
  const moved = { ...LARGE_BOAT_SPEC, roles: { ...LARGE_BOAT_SPEC.roles, [name]: { ...r, box: [r.box[0].map((v) => v + 0.05), r.box[1].map((v) => v + 0.05)] } } };
  assert.throws(() => bakeScene(bytes, moved, tree), /was read standing in the box/);
  // an object no spec names
  const { [name]: _gone, ...fewer } = LARGE_BOAT_SPEC.roles;
  assert.throws(() => bakeScene(bytes, { ...LARGE_BOAT_SPEC, roles: fewer }, tree), /plays no role aboard/);
});
