// SHIPS-2 (2026-10-07, Mac, sending Tiny_Ship.fbx: "implement both of these new ship placement models, UV Map/Texture,
// and ensure it matches the love we gave the other new ship model we implemented") - the new large boat (hull 1) held to
// her model: the mod's seven sail plans by the mod's own names, each plan's rig swept clear of itself, her solids and
// her helmsman, her parts fitted to one another, her helm, her swivels firing from their barrels, HULL_BUILDS' Large
// Boat measured off her (her rig boxes her own plan's canvas), her pictures, and the loader's and the builds' fallback to
// the mod's own boat.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  largeBoatPrefab, LARGE_BOAT_PREFAB_ID, LARGE_BOAT_HULL_NODE, MEASURED, HELM, STEP, RUDDER, SWIVELS, LARGE_BOAT_BATTERIES,
  ANCHOR_Z, LANTERNS, tillerEnd, largeBoatClips,
} from '../src/world/largeBoatModel.js';
import { PLANS, VARIANT_COUNT, sailKey, stayLines, LARGE_BOAT_RIG, MAST, FORESTAY_IN } from '../src/world/largeBoatRig.js';
import { largeBoatArt, registerLargeBoatArt, _resetLargeBoatArt, LARGE_BOAT_ARCHIVE, TEX } from '../src/world/largeBoatArt.js';
import { RUDDER_DEG } from '../src/world/galleonModel.js';
import { loadComeSailAwayModels, CSA_MODEL_URLS, CARRACK_MODEL_URL, LARGE_BOAT_MODEL_URL, decodeMeshGeometry } from '../src/systems/comeSailAwayModels.js';
import { animatorOf, colliderBounds } from '../src/systems/comeSailAwayBoat.js';
import { HULL, HULL_BUILDS, MOD_LARGE_BOAT_BUILD, hullBuild, setShipStanding } from '../src/systems/naval/navalShips.js';
import { gangwaySide, gangwayFoot, GANGWAY_SIDE, MOD_LARGE_BOAT_GANGWAY } from '../src/systems/naval/quays.js';
import { rigBoxesOf } from '../src/scenes/navalHost.js';
import { quatRotate, mat4FromQuatPosScale, quatAngleAxis } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';
import { pathHash } from '../src/world/unityAnimator.js';
import { CAPSULE_HEIGHT, CAPSULE_RADIUS } from '../src/player/motor.js';
import { scene, MODELS } from './csaScene.mjs';
import { sweepRig } from './shipSweep.mjs';

const VENDOR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const csa = JSON.parse(readFileSync(new URL('prefabs.json', VENDOR), 'utf8'));
const modMeshes = JSON.parse(readFileSync(new URL('meshes.json', VENDOR), 'utf8'));
const bin = readFileSync(new URL('meshes.bin', VENDOR));
const bakeJson = JSON.parse(readFileSync(new URL('../src/assets/ships/largeBoat.json', import.meta.url), 'utf8'));
const built = largeBoatPrefab(bakeJson, csa);
const comps = [...csa.components, ...built.components];
const compOf = (n, type) => n.components.map((i) => comps[i]).find((c) => c?.type === type) ?? null;
const geometryOf = (key) => built.meshes[key] ?? (modMeshes[key] ? decodeMeshGeometry(modMeshes[key], bin) : null);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const find = (n, name) => { if (n.name === name) return n; for (const c of n.children) { const r = find(c, name); if (r) return r; } return null; };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Come Sail Away's walk's own tests (systems/comeSailAwayBoat.js getBoatTransforms): a boom, a sail. */
const isBoom = (name) => name.includes('Boom');
const isSail = (name) => name.includes('Sail') && !name.includes('Skelly') && !name.includes('Mesh') && !name.includes('Bones') && !name.includes('Handling');
/** A prefab's booms and sails as the walk reads them with plan `v` switched on, in the walk's order. */
function walked(prefab, v) {
  const booms = [], sails = [];
  (function walk(n) {
    for (const c of n.children) {
      if (n.name === 'Variants' ? n.children.indexOf(c) !== v : c.active === false) continue;
      if (isBoom(c.name)) booms.push(c.name);
      if (isSail(c.name)) sails.push(c.name);
      walk(c);
    }
  }(prefab));
  return { booms, sails };
}
/** Every drawn mesh of hers with plan `v` switched on, in her root's frame: `{ name, key, path, m }`. */
function drawn(v) {
  const out = [];
  (function walk(n, pm, path, parent) {
    if (parent?.name === 'Variants' && n.name !== String(v)) return;
    if (n.active === false && parent?.name !== 'Variants') return;
    const m = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
    const key = compOf(n, 'MeshFilter')?.m_Mesh?.mesh;
    if (key && compOf(n, 'MeshRenderer')) out.push({ name: n.name, key, path, m, parentM: pm });
    for (const c of n.children) walk(c, m, `${path}/${c.name}`, n);
  }(built.prefab, I4, '', null));
  return out;
}
const trisOf = (g, m) => { const P = g.positions, I = g.indices, out = []; for (let t = 0; t < I.length; t += 3) out.push([0, 1, 2].map((j) => xf(m, [P[I[t + j] * 3], P[I[t + j] * 3 + 1], P[I[t + j] * 3 + 2]]))); return out; };
/** Where an edge of one triangle set crosses a face of the other (Möller-Trumbore, the edge's own ends excluded). */
function crossings(A, B) {
  const hits = [];
  const hit = (p, q, a, b, c) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-14) return null;
    const s = sub(p, a), u = dot(s, h) / det;
    if (u < 0 || u > 1) return null;
    const qq = cross(s, e1), w = dot(d, qq) / det;
    if (w < 0 || u + w > 1) return null;
    const t = dot(e2, qq) / det;
    return t > 1e-4 && t < 1 - 1e-4 ? [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t] : null;
  };
  for (const [X, Y] of [[A, B], [B, A]]) for (const t of X) for (const [p, q] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) for (const u of Y) { const at = hit(p, q, u[0], u[1], u[2]); if (at) hits.push(at); }
  return hits;
}
/** A node's frame in her root's with plan `v` switched on (null where it is not under it). */
function frameOf(target, v, n = built.prefab, pm = I4, parent = null) {
  if (parent?.name === 'Variants' && n.name !== String(v)) return null;
  const m = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
  if (n === target) return m;
  for (const c of n.children) { const r = frameOf(target, v, c, m, n); if (r) return r; }
  return null;
}
/** A large boat placed by the runtime with plan `v`, and the scene she stands in. */
const placed = (v = 0) => { const s = scene(); const boat = s.place(HULL.LargeBoat, v); return { s, boat }; };

// ── her seven plans ────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 LARGE BOAT HER SEVEN PLANS ARE THE MOD\'S: seven plans under `Variants`, each switched off for the walk to switch on; with each one on Come Sail Away\'s walk reads her booms and her sails by the mod\'s own names in the mod\'s own order - so each plan\'s GetSailPower, its trim\'s arms and its first square sail are the mod\'s - and no part of her rig (a yard, a spar, a brace, a belay) is read for a sail (mutants: a part keyed by its sail\'s mod name, a plan dropped, a sail out of the mod\'s order)', () => {
  const mod = csa.prefabs[String(LARGE_BOAT_PREFAB_ID)];
  const hers = find(built.prefab, 'Variants'), theirs = find(mod, 'Variants');
  assert.equal(hers.children.length, VARIANT_COUNT);
  assert.equal(theirs.children.length, VARIANT_COUNT, 'the mod\'s boat\'s seven');
  assert.deepEqual(hers.children.map((c) => c.name), theirs.children.map((c) => c.name));
  assert.ok(hers.children.every((c) => c.active === false), 'each plan off until the walk switches the boat\'s own on');
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const a = walked(built.prefab, v), b = walked(mod, v);
    assert.deepEqual(a.booms, b.booms, `plan ${v}: the mod's booms`);
    assert.deepEqual(a.sails, b.sails, `plan ${v}: the mod's sails, in its order`);
    assert.deepEqual(PLANS[v].sails.map((s) => s.name), b.sails, `plan ${v}: PLANS names them`);
  }
  // a sail's parts' key holds no 'Sail' (the walk would count each of them a sail)
  for (const [v, plan] of PLANS.entries()) for (const s of plan.sails) assert.ok(!sailKey(v, s.name).includes('Sail'), sailKey(v, s.name));
});

test('SHIPS-2 LARGE BOAT HER PLANS SAIL: placed by the runtime with each plan and her helm taken, her boat\'s Sails and Booms are that plan\'s (the mod\'s boat\'s at the same variant) and her square, gaff, lateen and stay sails sorted by them; raised, each canvas comes down off its spar and hangs set, lowered it is furled again (mutants: a plan\'s sails mis-sorted, the canvas still)', () => {
  const mod = csa.prefabs[String(LARGE_BOAT_PREFAB_ID)];
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const s = scene();
    const boat = s.place(HULL.LargeBoat, v);
    const w = walked(mod, v);
    assert.deepEqual(boat.Sails.map((n) => n.name), w.sails, `plan ${v}: the mod's sails`);
    assert.deepEqual(boat.Booms.map((n) => n.name), w.booms, `plan ${v}: the mod's booms`);
    for (const [list, word] of [[boat.SailsSquare, 'Square'], [boat.SailsGaff, 'Gaff'], [boat.SailsLateen, 'Lateen'], [boat.SailsStay, 'Stay']]) {
      assert.deepEqual(list.map((n) => n.name), w.sails.filter((n) => n.includes(word) && (word === 'Square' || !['Square', 'Lateen', 'Gaff'].filter((x) => x !== word).some((x) => n.includes(x)))), `plan ${v}: ${word}`);
    }
    const pts = () => [...boat.GameObject.walk()].filter((n) => /^B\d+$/.test(n.name)).map((n) => { const m = n.worldMatrix(); return [m[12], m[13], m[14]]; });
    const frames = (n) => { for (let k = 0; k < n; k++) { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; s.frame(); } };
    s.helm(boat);
    frames(8);
    const furled = pts();
    s.rt.RaiseSails();
    frames(16);
    assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === false), `plan ${v}: raised, every sail set`);
    const set = pts();
    const moved = set.filter((p, k) => Math.hypot(...sub(p, furled[k])) > 0.3).length;
    assert.ok(moved > set.length / 2, `plan ${v}: the canvas comes down off its spars (${moved} of ${set.length})`);
    s.rt.LowerSails();
    frames(16);
    assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === true), `plan ${v}: lowered, furled`);
  }
});

test('SHIPS-2 LARGE BOAT HER RIG SWEPT CLEAR: every plan, every canvas at every Wind and stowed, her square yards braced to 45 (30 in plan 2, a large square sail with a gaff - HasLargeSquareSailWithGaff) and her gaffs and lateens swung to 90 - against every other part of her rig, her solids (her rudder and tiller turned to 35 either way) and her helmsman: nothing meets but where it is made fast (mutants: the topsail\'s yard under the topmast stay, the forestay\'s foot at the end, the gaff topsail\'s luff through the cap, plan 5\'s peak halyard)', () => {
  const M = MEASURED.mast, H = HELM.stand, reach = CAPSULE_HEIGHT / 2 - CAPSULE_RADIUS;
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const held = v === 2;
    const r = sweepRig(built, csa.components, {
      variant: v, rigKey: /^largeBoat:(yard:|gaff:|lateen:|stays:)/, records: { rope: TEX.rope, spar: TEX.spar }, geometryOf,
      solid: (key, name, path) => !/^largeBoat:(sail|rope):/.test(key) && !path.includes('/IdleObject/'),
      rudder: { key: 'largeBoat:rudder', turns: [-RUDDER_DEG, 0, RUDDER_DEG] },
      helmsman: { a: [H[0], H[1] - reach, H[2]], b: [H[0], H[1] + reach, H[2]], r: CAPSULE_RADIUS },
      sq: held ? [-30, -15, 0, 15, 30] : [-45, -15, 15, 45], lat: held ? [-30, -15, 0, 15, 30] : [-90, -60, -30, 0, 30, 60, 90], winds: [-1, -0.5, 0, 0.5, 1, 'stowed'],
      madeFast: (at) => (at[1] > LARGE_BOAT_RIG.mast.topY - 0.4 && Math.hypot(at[0] - M.x, at[2] - M.z) < 0.3) || Math.hypot(...sub(at, LARGE_BOAT_RIG.bowspritEnd)) < 0.25,
    });
    assert.equal(r.sails.length, PLANS[v].sails.length, `plan ${v}: every sail swept`);
    assert.ok(r.solids.length > 15, `plan ${v}: her solids`);
    assert.deepEqual(r.clashes, [], `plan ${v}`);
  }
  // the stays' feet: the forestay on the bowsprit's top short of its end, the topmast stay at its end over it
  const S = stayLines();
  near(S.fore.foot[2], LARGE_BOAT_RIG.bowspritEnd[2] - FORESTAY_IN, 1e-9, 'the forestay\'s foot');
  assert.deepEqual(S.top.foot, [...LARGE_BOAT_RIG.bowspritEnd]);
  assert.ok(MAST.radius(LARGE_BOAT_RIG.topmast.topY) < MAST.radius(LARGE_BOAT_RIG.mast.topY), 'the topmast tapers above her masthead');
});

// ── her fits ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 LARGE BOAT HER PARTS FIT: her rudder turned 35 degrees either way about her raked post clears her hull, her stern rail and her step; her tiller rides over her stern rail\'s cap; the mod\'s anchor stowed on her foredeck, its cargo forward of her mast and her bow swivel each stand clear of her hull and her bowsprit; her swivels\' posts and her lanterns\' poles stand on her caps, crossing them only at the cap (mutants: the anchor at the stem, the bow swivel in the bowsprit, the rudder about the vertical)', () => {
  const parts = drawn(0);
  const one = (name) => parts.find((p) => p.name === name);
  const tris = (p, m = p.m) => trisOf(geometryOf(p.key), m);
  const hull = tris(one(LARGE_BOAT_HULL_NODE)), rail = tris(one('SternRail')), step = tris(one('HelmStep')), sprit = tris(one('Bowsprit'));
  const rudder = one('HelmRudder');
  for (const deg of [-RUDDER_DEG, 0, RUDDER_DEG]) {
    const r = tris(rudder, multiply(rudder.parentM, mat4FromQuatPosScale(quatAngleAxis(deg, [0, 1, 0]), [0, 0, 0], [1, 1, 1]), new Float32Array(16)));
    for (const [what, T] of [['her hull', hull], ['her stern rail', rail], ['her step', step]]) assert.deepEqual(crossings(r, T), [], `the rudder at ${deg}: ${what}`);
  }
  const end = tillerEnd();
  assert.ok(end[1] - 0.05 > MEASURED.sternRail.capY + 0.05, 'the tiller over her stern rail\'s cap');
  for (const name of ['SkiffAnchor', 'SkiffCargo']) assert.deepEqual(crossings(tris(one(name)), hull), [], `${name} clear of her hull`);
  near(one('SkiffAnchor').m[14], ANCHOR_Z, 1e-6, 'the anchor where ANCHOR_Z stows it');
  assert.deepEqual(crossings(tris(one('SwivelBow')), sprit), [], 'the bow swivel clear of her bowsprit');
  for (const name of ['SwivelBow', 'SwivelStarboard0', 'SwivelPort2', 'LanternHookStandPoleTall']) {
    const hits = crossings(tris(one(name)), hull);
    assert.ok(hits.every((h) => Math.abs(h[1] - MEASURED.gunwaleY) < 1e-3), `${name}: on her cap, only there`);
  }
  near(one('LanternHookStandPoleTall').m[12], LANTERNS.bow[0], 1e-6, 'the tall pole off her stem');
});

test('SHIPS-2 LARGE BOAT HER HELM: her rudder and tiller ride RudderPost (her sternpost, raked aft) and turn about it RUDDER_DEG sailing or rowing each way, amidships rowing ahead, astern or still, by the mod\'s Rudder Controller\'s own states; the helmsman stands on her step forward of the tiller\'s end, its DriveTrigger over the end, and her stern rail is his guard (mutants: the sides swapped, a state unswapped, the post unraked)', () => {
  const { clips, overrides } = largeBoatClips();
  const ov = overrides['largeboat2/Rudder'];
  assert.equal(ov.base, 'Rudder Controller');
  const turn = (state) => clips[ov.clips.find(([s]) => s === `clips/${state}`)[1]].curves.find((c) => c.path === pathHash('RudderPost/HelmRudder')).components.map((k) => k.constant);
  assert.deepEqual(turn('Rudder Sailing Left'), [0, RUDDER_DEG, 0]);
  assert.deepEqual(turn('Rudder Sailing Right'), [0, -RUDDER_DEG, 0]);
  assert.deepEqual(turn('Rudder Rowing Left'), [0, RUDDER_DEG, 0]);
  for (const s of ['Rudder Rowing Center', 'Rudder Rowing Forward', 'Rudder Rowing Backward']) assert.deepEqual(turn(s), [0, 0, 0], s);
  const post = find(built.prefab, 'RudderPost');
  const up = quatRotate(post.rotation, [0, 1, 0]), rake = sub(MEASURED.postHead, MEASURED.postFoot);
  near(dot(up, rake) / Math.hypot(...rake), 1, 1e-6, 'its +y up her sternpost');
  assert.deepEqual(post.position, [...MEASURED.postFoot]);
  const stand = find(built.prefab, 'DrivePosition').position, trig = find(built.prefab, 'DriveTrigger').position, end = tillerEnd();
  near(stand[1] - CAPSULE_HEIGHT / 2, STEP.topY, 1e-9, 'his feet on her step');
  assert.ok(stand[2] > end[2] && stand[2] - end[2] < 1.0, 'he stands forward of the tiller\'s end, in reach of it');
  near(trig[2], HELM.trigger[2], 1e-9, 'the DriveTrigger');
  assert.ok(Math.abs(trig[2] - end[2]) < 0.35, 'the DriveTrigger over the tiller\'s end');
  assert.ok(MEASURED.sternRail.capY - STEP.topY > 0.9, 'her stern rail a guard rail to him');
  // the tiller swung either way clears him
  const head = [0, end[1], end[2] - RUDDER.tiller];
  for (const deg of [-RUDDER_DEG, RUDDER_DEG]) {
    const a = (deg * Math.PI) / 180, tip = [head[0] + Math.sin(a) * RUDDER.tiller, end[1], head[2] + Math.cos(a) * RUDDER.tiller];
    assert.ok(Math.hypot(tip[0] - stand[0], tip[2] - stand[2]) > CAPSULE_RADIUS, `the tiller at ${deg} clear of him`);
  }
});

// ── her guns ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 LARGE BOAT HER SWIVELS FIRE FROM THEIR BARRELS: three a side on her gunwale\'s cap and one on the cap at her port bow - each muzzle HULL_BUILDS reads at its swivel\'s barrel\'s end, outboard of her side (the bow\'s forward of her stem, clear of her bowsprit), the port side the starboard\'s mirror (mutants: a muzzle at the post, the bow\'s on her stem)', () => {
  const b = HULL_BUILDS[HULL.LargeBoat];
  assert.equal(b.gun, 'swivel');
  assert.deepEqual(b.broadside, LARGE_BOAT_BATTERIES.broadside.map((p) => [...p]));
  assert.deepEqual(b.bow.muzzles, LARGE_BOAT_BATTERIES.bow.map((p) => [...p]));
  const barrelEnd = (name) => { const n = find(built.prefab, name); const d = quatRotate(n.rotation, [0, SWIVELS.y - MEASURED.gunwaleY, SWIVELS.muzzle]); return [n.position[0] + d[0], n.position[1] + d[1], n.position[2] + d[2]]; };
  SWIVELS.z.forEach((z, i) => {
    barrelEnd(`SwivelStarboard${i}`).forEach((v, k) => near(v, b.broadside[i][k], 1e-6, `starboard ${i}`));
    const port = barrelEnd(`SwivelPort${i}`);
    near(port[0], -b.broadside[i][0], 1e-6, `port ${i}: the mirror`);
    assert.ok(b.broadside[i][0] > MEASURED.outerX + 0.3, `swivel ${i}: its muzzle out over her side`);
  });
  barrelEnd('SwivelBow').forEach((v, k) => near(v, b.bow.muzzles[0][k], 1e-6, 'the bow swivel'));
  assert.ok(b.bow.muzzles[0][2] > MEASURED.stemHead[2], 'forward of her stem');
});

// ── HULL_BUILDS' Large Boat ────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 LARGE BOAT HULL_BUILDS\' LARGE BOAT IS HERS: her box her MeshCollider\'s bounds (her planking and her stern rail) - stem, stern, half beam, keel and roof to the centimetre; her deck her deck, her half beam at it inside her ceiling; her rig boxes her plans\' canvas - each box a plan\'s, its boom and its sail what the walk reads there, every set canvas of every plan inside its box (mutants: the mod\'s boat\'s numbers back, a box of no plan, a box short of its canvas)', () => {
  const { boat } = placed(0);
  const b = hullBuild(HULL.LargeBoat);
  assert.equal(boat.MeshObject.name, LARGE_BOAT_HULL_NODE, 'her hull the boat\'s frame');
  const m = boat.MeshObject.worldMatrix();
  const bounds = colliderBounds({ models: MODELS }, boat.MeshObject, boat.MeshCollider);
  const lo = [bounds.min[0] - m[12], bounds.min[1] - m[13], bounds.min[2] - m[14]], hi = [bounds.max[0] - m[12], bounds.max[1] - m[13], bounds.max[2] - m[14]];
  near(b.bowZ, hi[2], 0.006, 'her stem'); near(b.aftZ, lo[2], 0.006, 'her stern');
  near(b.halfWidth, Math.max(hi[0], -lo[0]), 0.006, 'her half beam'); near(b.keel, lo[1], 0.006, 'her keel'); near(b.top, hi[1], 0.006, 'her roof');
  near(b.deck, MEASURED.deckY, 0.01, 'her deck');
  assert.ok(b.beam > 1.4 && b.beam <= MEASURED.innerX, `her half beam at her deck (${b.beam})`);
  let checked = 0;
  // each box a plan's: its boom and its sail the walk's there, and its sail's set canvas inside it (her boom home)
  const mod = csa.prefabs[String(LARGE_BOAT_PREFAB_ID)];
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const boxes = b.rig.filter((x) => x.variant === v);
    const w = walked(mod, v);
    assert.deepEqual([...new Set(boxes.map((x) => x.sail))].sort(), w.sails.map((_, k) => k), `plan ${v}: a box for every sail`);
    for (const box of boxes) if (box.boom != null) assert.ok(box.boom < w.booms.length, `plan ${v}: its boom`);
    const plan = find(built.prefab, 'Variants').children[v];
    for (const sailName of w.sails) {
      const k = w.sails.indexOf(sailName);
      const sail = find(plan, sailName);
      const ov = built.animation.overrides[compOf(sail, 'Animator').m_Controller.controller];
      const bm = frameOf(sail.children.find((c) => /SailBones$/.test(c.name)), v);
      const mine = boxes.filter((x) => x.sail === k);
      for (const [state, clip] of ov.clips) {
        if (/Stowed/.test(state)) continue;
        for (const c of built.animation.clips[clip].curves) {
          const p = xf(bm, c.components.map((q) => q.constant));
          checked++;
          assert.ok(mine.some(([mn, mx]) => p.every((x, n) => x >= mn[n] - 0.06 && x <= mx[n] + 0.06)), `plan ${v} ${sailName} ${state}: ${p.map((x) => x.toFixed(2))} in its box`);
        }
      }
    }
  }
  assert.ok(checked > 2000, `every plan's canvas read (${checked} points)`);
});

test('SHIPS-2 LARGE BOAT RIG BOXES STAND FOR HER OWN PLAN: rigBoxesOf stands a box of her plan only - her own variant\'s - and of a sail of it set: placed with each plan and every sail made, her boxes are that plan\'s, none of another (mutants: every plan\'s boxes stood)', () => {
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const { boat } = placed(v);
    assert.equal(rigBoxesOf(boat).length, 0, `plan ${v}: furled, no canvas to tear`);
    for (const sail of boat.Sails) animatorOf(sail).SetBool('Stowed', false);
    assert.equal(rigBoxesOf(boat).length, HULL_BUILDS[HULL.LargeBoat].rig.filter((x) => x.variant === v).length, `plan ${v}: its own boxes`);
  }
});

// ── her pictures ───────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 LARGE BOAT HER PICTURES: painted at load from numbers alone - the same bytes every time - a picture a TEX record under LARGE_BOAT_ARCHIVE, each 64 x 64; registered with the vendor textures once, each a stand-in built as painted; every face of hers drawn on a picture of hers (mutants: a picture seeded off the clock, registered twice, a picture off 64, a face on no picture)', async () => {
  const hash = (art) => createHash('sha256').update(JSON.stringify(art.map(([r, p]) => [r, p.width, p.height, Buffer.from(p.data).toString('base64')]))).digest('hex');
  const a = largeBoatArt(), b = largeBoatArt();
  assert.equal(hash(a), hash(b), 'the same bytes');
  assert.deepEqual(a.map(([r]) => r), [...new Set(Object.values(TEX))].sort((x, y) => x - y), 'a picture a record, in record order');
  for (const [r, p] of a) assert.deepEqual([p.width, p.height, p.data.length], [64, 64, 64 * 64 * 4], `record ${r}`);
  const records = new Set(a.map(([r]) => r));
  for (const [key, g] of Object.entries(built.meshes)) for (const s of g.slots ?? []) {
    if (s.record == null) continue;
    assert.equal(s.archive, LARGE_BOAT_ARCHIVE, `${key}: her archive`);
    assert.ok(records.has(s.record), `${key}: record ${s.record} painted`);
  }
  _resetLargeBoatArt();
  const added = [];
  const add = (entries) => { added.push(...entries); return entries.length; };
  assert.equal(registerLargeBoatArt(add), Object.keys(TEX).length);
  assert.equal(registerLargeBoatArt(add), 0, 'once');
  assert.ok(added.every((e) => e.archive === LARGE_BOAT_ARCHIVE && e.standIn === true && e.frame === 0 && typeof e.build === 'function'));
  const one = await added.find((e) => e.record === TEX.hullSide0).build();
  assert.ok(Buffer.from(one.data).equals(Buffer.from(a.find(([r]) => r === TEX.hullSide0)[1].data)), 'built as painted');
  _resetLargeBoatArt();
});

// ── the loader and the fallback ────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 THE LOADER: the new carrack over hull 4 and the new large boat over hull 1 when their models answer; when one does not, or will not build, its hull is the mod\'s own and it says so once - the other ships standing as they would, never no ship (mutants: one ship\'s failure failing the rest, the warning dropped)', async () => {
  const fileFetch = (deny = null, swap = null) => async (url) => {
    if (deny && url === deny) return { ok: false, status: 404 };
    if (swap && url === swap.url) return { ok: true, json: async () => swap.json };
    const bytes = readFileSync(new URL(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  assert.ok(CARRACK_MODEL_URL.endsWith('src/assets/ships/carrack.json') && LARGE_BOAT_MODEL_URL.endsWith('src/assets/ships/largeBoat.json'));
  const warns = [];
  const log = { warn: (...w) => warns.push(w) };
  const all = await loadComeSailAwayModels(fileFetch(), CSA_MODEL_URLS, log);
  assert.deepEqual([all.galleon, all.carrack, all.largeBoat], [true, true, true]);
  assert.ok(all.prefab(LARGE_BOAT_PREFAB_ID).children.some((c) => c.name === LARGE_BOAT_HULL_NODE), 'her hull under prefab 112411');
  assert.equal(warns.length, 0);
  const missing = await loadComeSailAwayModels(fileFetch(LARGE_BOAT_MODEL_URL), CSA_MODEL_URLS, log);
  assert.deepEqual([missing.galleon, missing.carrack, missing.largeBoat], [true, true, false], 'her model missing: the mod\'s own boat, the others theirs');
  assert.equal(warns.length, 1);
  assert.match(String(warns[0][0]), /large boat did not load - hull 1 stands as the mod's own/);
  const broken = await loadComeSailAwayModels(fileFetch(null, { url: CARRACK_MODEL_URL, json: { ...bakeJson, parts: [] } }), CSA_MODEL_URLS, log);
  assert.deepEqual([broken.galleon, broken.carrack, broken.largeBoat], [true, false, true], 'the carrack\'s broken: hers alone');
  assert.equal(warns.length, 2);
  assert.match(String(warns[1][0]), /carrack would not build - hull 4 stands as the mod's own/);
  assert.throws(() => largeBoatPrefab({ ...bakeJson, parts: [] }, csa), /the bake has no /);
});

test('SHIPS-2 LARGE BOAT THE MOD\'S OWN BOAT FALLEN BACK: while her model does not stand hull 1 is the mod\'s large boat\'s build and its gangway; standing, hers - her gangway\'s head at her cap\'s outer edge, the plank down to the quay clear of her flaring side (mutants: the fallback\'s build or gangway dropped)', () => {
  try {
    setShipStanding(HULL.LargeBoat, false);
    assert.equal(hullBuild(HULL.LargeBoat), MOD_LARGE_BOAT_BUILD);
    assert.deepEqual(gangwaySide(HULL.LargeBoat), MOD_LARGE_BOAT_GANGWAY);
    setShipStanding(HULL.LargeBoat, true);
    assert.equal(hullBuild(HULL.LargeBoat), HULL_BUILDS[HULL.LargeBoat]);
    assert.deepEqual(gangwaySide(HULL.LargeBoat), GANGWAY_SIDE[HULL.LargeBoat]);
  } finally { setShipStanding(HULL.LargeBoat, true); }
  const [x, y] = GANGWAY_SIDE[HULL.LargeBoat];
  assert.ok(x >= MEASURED.capOuterX && y > MEASURED.gunwaleY, 'on her cap\'s outer edge');
  // the plank from its head down to its foot on a quay off her side: outboard of her flaring side all the way down
  const hull = bakeJson.parts.find((p) => p.role === 'hull'), P = hull.positions, T = hull.triangles;
  const pt = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  /** Her planking's outermost x at height `py` amidships (z 0): her triangles cut there. */
  const sideAt = (py) => {
    let out = 0;
    for (let t = 0; t < T.length; t += 3) {
      const [a, b, c] = [pt(T[t]), pt(T[t + 1]), pt(T[t + 2])], e1 = sub(b, a), e2 = sub(c, a), det = e1[1] * e2[2] - e1[2] * e2[1];
      if (Math.abs(det) < 1e-12) continue;
      const dy = py - a[1], dz = -a[2], u = (dy * e2[2] - dz * e2[1]) / det, w = (e1[1] * dz - e1[2] * dy) / det;
      if (u >= 0 && w >= 0 && u + w <= 1) out = Math.max(out, Math.abs(a[0] + u * e1[0] + w * e2[0]));
    }
    return out;
  };
  const foot = gangwayFoot(x, y, MEASURED.outerX + 0.5, MEASURED.outerX + 12);
  for (let t = 0.02; t <= 1; t += 0.02) {
    const px = x + (foot.x - x) * t, py = y + (foot.y - y) * t;
    if (py < 0) break;
    assert.ok(sideAt(py) < px, `the plank at ${py.toFixed(2)} m outboard of her side (${sideAt(py).toFixed(3)} vs ${px.toFixed(3)})`);
  }
});
