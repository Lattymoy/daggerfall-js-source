// SHIPS-2 (2026-10-07, Mac, sending New_Ship_2.fbx and New_Ship_2_Shutter.fbx: "implement both of these new ship
// placement models, UV Map/Texture, and ensure it matches the love we gave the other new ship model we implemented") -
// the new carrack (hull 4) held to her model as the galleon is to hers (test/galleon_model.test.js): her guns firing from
// her ports on their own carriages, her shutters fitted to her side, her doors, her helm, her five sails by Come Sail
// Away's names and her rig swept clear of itself and her solids, her rudder, ladders and anchor fitted, HULL_BUILDS'
// Carrack measured off her, her pictures, and the mod's own Carrack fallen back to.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  carrackPrefab, carrackClips, CARRACK_PREFAB_ID, CARRACK_HULL_NODE, MEASURED, HELM, DRIVE_TRIGGER_AT, GUN, LID, LID_SILL_ROW,
  CARRACK_BATTERIES, ANCHOR, sideAt, lidFitOf, ropeLadderGeometry,
} from '../src/world/carrackModel.js';
import { SAILS, CARRACK_RIG } from '../src/world/carrackRig.js';
import { carrackArt, carrackGlow, registerCarrackArt, _resetCarrackArt, CARRACK_ARCHIVE, TEX, BANDS } from '../src/world/carrackArt.js';
import { RUDDER_DEG } from '../src/world/galleonModel.js';
import { createGalleonGunDeck } from '../src/systems/naval/galleonGunDeck.js';
import { DECK_STEP } from '../src/systems/naval/navalDeck.js';
import { animatorOf, colliderBounds } from '../src/systems/comeSailAwayBoat.js';
import { HULL, HULL_BUILDS, MOD_CARRACK_BUILD, hullBuild, setShipStanding } from '../src/systems/naval/navalShips.js';
import { gangwaySide, GANGWAY_SIDE, MOD_CARRACK_GANGWAY } from '../src/systems/naval/quays.js';
import * as LIFE from '../src/systems/naval/shipLife.js';
import { mat4FromQuatPosScale, quatAngleAxis } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';
import { pathHash } from '../src/world/unityAnimator.js';
import { decodeMeshGeometry } from '../src/systems/comeSailAwayModels.js';
import { scene, MODELS } from './csaScene.mjs';
import { sweepRig } from './shipSweep.mjs';

const VENDOR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const csa = JSON.parse(readFileSync(new URL('prefabs.json', VENDOR), 'utf8'));
const modMeshes = JSON.parse(readFileSync(new URL('meshes.json', VENDOR), 'utf8'));
const bin = readFileSync(new URL('meshes.bin', VENDOR));
const bakeJson = JSON.parse(readFileSync(new URL('../src/assets/ships/carrack.json', import.meta.url), 'utf8'));
const hullPart = bakeJson.parts.find((p) => p.role === 'hull');
const built = carrackPrefab(bakeJson, csa);
const comps = [...csa.components, ...built.components];
const compOf = (n, type) => n.components.map((i) => comps[i]).find((c) => c?.type === type) ?? null;
const geometryOf = (key) => built.meshes[key] ?? (modMeshes[key] ? decodeMeshGeometry(modMeshes[key], bin) : null);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const find = (n, name) => { if (n.name === name) return n; for (const c of n.children) { const r = find(c, name); if (r) return r; } return null; };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const trisOf = (g, m = I4) => { const P = g.positions, I = g.indices, out = []; for (let t = 0; t < I.length; t += 3) out.push([0, 1, 2].map((j) => xf(m, [P[I[t + j] * 3], P[I[t + j] * 3 + 1], P[I[t + j] * 3 + 2]]))); return out; };
/** Möller-Trumbore: the distance along a ray (or a segment's fraction) to a triangle, or null. */
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const t0 = sub(o, a), u = dot(t0, p) / det;
  if (u < 0 || u > 1) return null;
  const q = cross(t0, e1), v = dot(d, q) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) / det;
  return t >= 0 ? t : null;
}
/** Where an edge of one triangle set crosses a face of the other (the edge's own ends excluded). */
function crossings(A, B) {
  const hits = [];
  for (const [X, Y] of [[A, B], [B, A]]) for (const t of X) for (const [p, q] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) for (const u of Y) {
    const k = rayTri(p, sub(q, p), u[0], u[1], u[2]);
    if (k != null && k > 1e-4 && k < 1 - 1e-4) hits.push(p.map((v, n) => v + (q[n] - v) * k));
  }
  return hits;
}
/** Every drawn mesh of hers as she stands (switched-off things too where `all`), in her root's frame. */
function drawn(all = false) {
  const out = [];
  (function walk(n, pm, path) {
    if (n.active === false && !all) return;
    const m = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
    const key = compOf(n, 'MeshFilter')?.m_Mesh?.mesh;
    if (key && compOf(n, 'MeshRenderer')) out.push({ name: n.name, key, path, m, parentM: pm });
    for (const c of n.children) walk(c, m, `${path}/${c.name}`);
  }(built.prefab, I4, ''));
  return out;
}
const hullTris = trisOf(built.meshes['carrack:hull']);
/** A node of hers by name and its frame in her root's (its parent's world matrix and its own). */
function placedNode(name, n = built.prefab, pm = I4) {
  const m = multiply(pm, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
  if (n.name === name) return { node: n, m, parentM: pm };
  for (const c of n.children) { const r = placedNode(name, c, m); if (r) return r; }
  return null;
}
/** A Carrack placed by the runtime, and the scene she stands in. */
const placed = (opts = {}) => { const s = scene(opts); const boat = s.place(HULL.Carrack, 0); return { s, boat }; };

// ── her guns ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HER GUNS FIRE FROM HER PORTS: five guns a side on platforms a step over her gun deck, each muzzle in its port 9 cm outside her planking - its line in from the muzzle meets none of her hull through the port, and her planking a port\'s width aside; her chasers on her bow\'s deck and her barrels over her stern; all as HULL_BUILDS reads them (mutants: a muzzle off its port, inside her planking, the battery not hers)', () => {
  const b = HULL_BUILDS[HULL.Carrack];
  const same = (got, want, what) => { assert.equal(got.length, want.length, what); got.forEach((p, i) => p.forEach((v, k) => near(v, want[i][k], 0.001, `${what} ${i}`))); };
  same(b.broadside, CARRACK_BATTERIES.broadside, 'her broadside');
  same(b.bow.muzzles, CARRACK_BATTERIES.bow, 'her chasers');
  same(b.stern.muzzles, CARRACK_BATTERIES.stern, 'her barrels');
  const inboard = (o) => { let best = null; for (const [a, c, d] of hullTris) { const h = rayTri(o, [-1, 0, 0], a, c, d); if (h != null && (best == null || h < best)) best = h; } return best; };
  MEASURED.portZ.forEach((z, i) => {
    const m = b.broadside[i];
    assert.ok(m[1] > MEASURED.portSillY + 0.35 && m[1] < MEASURED.portTopY - 0.35, `port ${i}: the muzzle between the port's sill and its head`);
    assert.ok(GUN.platformY - MEASURED.gunDeckY < DECK_STEP, 'her platforms a step: her gun deck round them her floor');
    near(m[2], z, 1e-9, `port ${i}: at its middle`);
    const clear = inboard(m);
    assert.ok(clear == null || clear > m[0] - GUN.runInX, `port ${i}: in through the port (${clear})`);
    const aside = inboard([m[0], m[1], z - 2 * MEASURED.portHalfW]);   // abaft it (forward of port 4 her bow narrows in)
    assert.ok(aside != null && aside < 0.2, `port ${i}: her planking a port's width aside (${aside})`);
  });
});

test('SHIPS-2 CARRACK THE GUN DECK RUNS HER GUNS ON THEIR OWN CARRIAGES: each gun of hers carries its GunCarriage (her platforms\' stations, her ports set wider than the galleon\'s); laid, a side\'s shutters open and its guns run out to GUN.runOutX, the other side shut and run in at GUN.runInX; at rest all run in (mutants: the carriage unread, the galleon\'s stations)', () => {
  const { boat } = placed();
  const deck = createGalleonGunDeck();
  const guns = (side) => [...boat.GameObject.walk()].filter((n) => new RegExp(`^Gun${side}\\d$`).test(n.name));
  assert.equal(guns('Starboard').length, 5);
  assert.ok(guns('Port').every((g) => g.getComponent('GunCarriage')?.runOutX === GUN.runOutX), 'each gun its carriage');
  deck.lay(boat, 'starboard', 0);
  for (let t = 0.1; t <= 2; t += 0.1) deck.step([boat], t);
  const r = deck.read(boat, 2);
  r.starboard.guns.forEach((x, i) => near(x, GUN.runOutX, 1e-6, `starboard ${i} run out`));
  r.port.guns.forEach((x, i) => near(x, GUN.runInX, 1e-6, `port ${i} run in`));
  assert.ok(r.starboard.open.every(Boolean) && !r.port.open.some(Boolean), 'the starboard shutters up, the port\'s down');
  for (let t = 2.1; t <= 8; t += 0.1) deck.step([boat], t);
  deck.read(boat, 8).starboard.guns.forEach((x, i) => near(x, GUN.runInX, 1e-6, `starboard ${i} run in again`));
});

// ── her shutters, doors and helm ───────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HER SHUTTERS FIT HER SIDE: each shut shutter\'s inner face (LID\'s 13 rows by 17 stations, each side fitted to its own side) lies on her planking - nowhere more than 3 cm off it, nowhere more than 2.5 cm into it - over her knuckle and the chine under her ports; solid down to the sill (mutants: one side\'s fit both sides\', the knuckle\'s row dropped, the sill\'s row misread)', () => {
  assert.equal(LID.rows.length, 13);
  assert.equal(LID.cols.length, 17);
  assert.equal(LID.rows[LID_SILL_ROW], MEASURED.portSillY);
  let gap = 0, bite = 0;
  for (const s of [1, -1]) {
    const fit = lidFitOf(hullPart, s);
    MEASURED.portZ.forEach((zc, i) => {
      const F = fit[i], R = LID.rows, K = LID.cols;
      for (let r = 0; r + 1 < R.length; r++) for (let k = 0; k + 1 < K.length; k++) for (let a = 0; a <= 4; a++) for (let c = 0; c <= 4; c++) {
        const u = a / 4, v = c / 4, y = R[r] + (R[r + 1] - R[r]) * v, z = zc + K[k] + (K[k + 1] - K[k]) * u;
        const x = (1 - u) * (1 - v) * F[r][k] + u * (1 - v) * F[r][k + 1] + (1 - u) * v * F[r + 1][k] + u * v * F[r + 1][k + 1] + LID.gap;
        const side = sideAt(hullPart, y, z, s);
        if (side == null) continue;   // over the port's opening
        gap = Math.max(gap, x - side);
        bite = Math.min(bite, x - side);
      }
    });
  }
  assert.ok(gap < 0.03, `the widest gap ${gap.toFixed(4)} m`);
  assert.ok(bite > -0.025, `the deepest bite ${bite.toFixed(4)} m`);
});

test('SHIPS-2 CARRACK HER DOORS AND SHUTTERS OPEN AND CLOSE: her middle house\'s doorway a pair of leaves - each with its DoorTrigger, the port leaf on the mod\'s Door Controller and the starboard on its own mirrored clips, swinging the other way; every shutter on its side\'s clips, up on its hinge (mutants: one leaf, the leaves swinging alike, a shutter unclipped)', () => {
  const port = find(built.prefab, 'HouseDoorPort'), star = find(built.prefab, 'HouseDoorStarboard');
  for (const leaf of [port, star]) assert.ok(leaf.children.some((c) => c.name === 'DoorTrigger'), `${leaf.name}: its trigger`);
  assert.equal(compOf(port, 'Animator').m_Controller.controller, 'Door Controller');
  assert.equal(compOf(star, 'Animator').m_Controller.controller, 'carrack2/DoorStarboard');
  const { clips, overrides } = carrackClips();
  const opened = (ov) => clips[overrides[ov].clips.find(([s]) => /Opened/.test(s))[1]].curves.find((c) => c.path === pathHash('')).components.map((k) => k.constant);
  assert.ok(opened('carrack2/DoorStarboard')[1] < 0, 'the starboard leaf swings the mirrored way (the mod\'s Door Opened turns +90)');
  assert.ok(opened('carrack2/Gunport')[2] > 0 && opened('carrack2/GunportPort')[2] < 0, 'each side\'s shutters up their own way');
  for (const [side, ov] of [['Starboard', 'carrack2/Gunport'], ['Port', 'carrack2/GunportPort']]) MEASURED.portZ.forEach((_, i) => {
    assert.equal(compOf(find(built.prefab, `Gunport${side}${i}`), 'Animator').m_Controller.controller, ov, `${side} ${i}`);
  });
  const { boat } = placed();
  assert.ok(boat.BoardTriggers?.length >= 2 || boat.DoorTriggers?.length >= 2 || [...boat.GameObject.walk()].filter((n) => n.name === 'DoorTrigger').length >= 2, 'the walk finds her door triggers');
});

test('SHIPS-2 CARRACK HER HELM: a wheel on its pedestal before the helmsman\'s place on her quarterdeck, turned and her rudder RUDDER_DEG on its post through her own clips over the mod\'s Rudder Wheel Controller; the DriveTrigger over the wheel and its binnacle, the DrivePosition behind it on her deck (mutants: the rudder still, the sides swapped)', () => {
  const { clips } = carrackClips();
  const turn = (name, path) => clips[name].curves.find((c) => c.path === pathHash(path)).components.map((k) => k.constant);
  const left = Object.keys(clips).filter((k) => /^carrack2\/Rudder Sailing Left/.test(k)), right = Object.keys(clips).filter((k) => /^carrack2\/Rudder Sailing Right/.test(k));
  assert.ok(left.length >= 1 && right.length >= 1);
  const hard = (names) => names.map((n) => turn(n, 'HelmRudder')[1]).reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  near(Math.abs(hard(left)), RUDDER_DEG, 1e-6, 'hard over to port');
  assert.ok(Math.sign(hard(left)) === -Math.sign(hard(right)), 'the sides the other way');
  assert.deepEqual(find(built.prefab, 'DriveTrigger').position, [...DRIVE_TRIGGER_AT]);
  const stand = find(built.prefab, 'DrivePosition').position;
  assert.deepEqual(stand, [...HELM.stand]);
  assert.ok(stand[2] < HELM.hub[2], 'the helmsman abaft his wheel');
});

// ── her rig ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HER RIG: five sails by Come Sail Away\'s names - a small square spritsail, two large square courses, a main topsail and a lateen mizzen - on five booms the walk finds; raised, each comes down off its spar and hangs set, lowered it is furled again (mutants: a kind misnamed, the canvas still)', () => {
  const s = scene();
  const boat = s.place(HULL.Carrack, 0);
  assert.deepEqual(boat.Sails.map((n) => n.name), ['SpritsailSquareSmallSail', 'ForeCourseSquareLargeSail', 'MainCourseSquareLargeSail', 'MainTopsailSquareSail', 'MizzenLateenSail']);
  assert.equal(boat.Sails.length, SAILS.length);
  assert.deepEqual([boat.SailsSquare.length, boat.SailsGaff.length, boat.SailsStay.length, boat.SailsLateen.length, boat.SailsSmall.length, boat.SailsLarge.length, boat.Booms.length], [4, 0, 0, 1, 1, 2, 5]);
  const pts = () => [...boat.GameObject.walk()].filter((n) => /^B\d+$/.test(n.name)).map((n) => { const m = n.worldMatrix(); return [m[12], m[13], m[14]]; });
  const frames = (n) => { for (let k = 0; k < n; k++) { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; s.frame(); } };
  s.helm(boat);
  frames(8);
  const furled = pts();
  s.rt.RaiseSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === false), 'raised: every sail set');
  const set = pts();
  assert.ok(set.filter((p, k) => Math.hypot(...sub(p, furled[k])) > 0.5).length > set.length / 2, 'the canvas comes down off its spars');
  s.rt.LowerSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === true), 'lowered: furled');
});

test('SHIPS-2 CARRACK HER RIG SWEPT CLEAR: every canvas at every Wind and stowed, her yards braced to the auto-trim\'s 45 and her lateen swung to 90 either way, against every other part of her rig - her yards, lifts and footropes, her shrouds and ratlines, her stays, her braces and sheets - and her hull, houses, rails, masts, bowsprit, chasers and helm: nothing meets but where it is made fast (mutants: the main topsail\'s yard raised, a shroud\'s foot forward, the lateen\'s halyard to the mast\'s axis)', () => {
  const r = sweepRig(built, csa.components, {
    rigKey: /^carrack:(yard:|lateen$|rigging:)/, records: { rope: TEX.rope, spar: TEX.spar }, geometryOf,
    solid: (key) => /^carrack:(hull|houseAft|houseMid|houseFore|sternRail|mainDeck|foreMast|mainMast|mizzenMast|bowsprit|forePartner|mainPartner|mizzenPartner|chaser|helmPedestal|wheel)$/.test(key),
    sq: [-45, -30, -15, 0, 15, 30, 45], lat: [-90, -60, -30, 0, 30, 60, 90], winds: [-1, -0.5, 0, 0.5, 1, 'stowed'],
    madeFast: (at) => at[1] > Math.min(...Object.values(CARRACK_RIG.masts).map((m) => m.top)) - 1.3 && Math.abs(at[0]) < 0.9,
  });
  assert.equal(r.sails.length, SAILS.length);
  assert.ok(r.running >= 8 && r.solids.length >= 12, 'her running rope and her solids');
  assert.deepEqual(r.clashes, []);
});

// ── her fits ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HER PARTS FIT: her rudder turned 35 degrees either way about her sternpost clears her hull; her rope ladders hang plumb outside her side from her entry port down her knuckle; her anchor weighed at her bow and let go clear of her planking; each gun run out through its port clear of her (mutants: the ladder against her side, the rudder\'s post off hers, the anchor in her bow)', () => {
  const parts = drawn(true);
  const one = (name) => parts.find((p) => p.name === name);
  const rudder = one('HelmRudder');
  for (const deg of [-RUDDER_DEG, 0, RUDDER_DEG]) {
    const m = multiply(rudder.m, mat4FromQuatPosScale(quatAngleAxis(deg, [0, 1, 0]), [0, 0, 0], [1, 1, 1]), new Float32Array(16));
    assert.deepEqual(crossings(trisOf(geometryOf(rudder.key), m), hullTris), [], `the rudder at ${deg}`);
  }
  for (const s of [1, -1]) {
    const L = ropeLadderGeometry(s);
    for (let i = 0; i < L.positions.length; i += 3) {
      const p = [L.positions[i], L.positions[i + 1], L.positions[i + 2]];
      if (p[1] > MEASURED.gangway.sillY - 0.1) continue;   // made fast at her entry port's sill
      const side = sideAt(hullPart, p[1], p[2], s);
      // its foot rests on her knuckle, plumb under the port: nowhere more than a centimetre into her
      if (side != null) assert.ok(s * p[0] - side > -0.01, `the ${s > 0 ? 'starboard' : 'port'} ladder at ${p[1].toFixed(2)} m outside her side (${(s * p[0] - side).toFixed(4)})`);
    }
  }
  for (const name of ['CarrackAnchor', 'CarrackAnchorDeployed']) assert.deepEqual(crossings(trisOf(geometryOf(one(name).key), one(name).m), hullTris), [], name);
  assert.deepEqual([...one('CarrackAnchor').m.slice(12, 15)].map((v) => +v.toFixed(4)), [...ANCHOR.weighed]);
  for (const side of ['Starboard', 'Port']) MEASURED.portZ.forEach((z, i) => {
    const g = one(`Gun${side}${i}`), s = side === 'Starboard' ? 1 : -1;
    const m = multiply(g.parentM, mat4FromQuatPosScale(find(built.prefab, `Gun${side}${i}`).rotation, [s * GUN.runOutX, GUN.platformY, z], [1, 1, 1]), new Float32Array(16));
    assert.deepEqual(crossings(trisOf(geometryOf(g.key), m), hullTris), [], `${side} ${i} run out`);
  });
});

// ── HULL_BUILDS' Carrack ───────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HULL_BUILDS\' CARRACK IS HERS: her box her MeshCollider\'s bounds (her hull, her houses, her quarter rail) - stem, stern, half beam, keel and roof to the centimetre; her deck her main deck; her rig boxes on her booms, each holding its sail\'s set canvas (mutants: the mod\'s Carrack\'s numbers back, a box short of its canvas)', () => {
  const { boat } = placed();
  const b = hullBuild(HULL.Carrack);
  assert.equal(boat.MeshObject.name, CARRACK_HULL_NODE);
  const m = boat.MeshObject.worldMatrix();
  const bounds = colliderBounds({ models: MODELS }, boat.MeshObject, boat.MeshCollider);
  const lo = [bounds.min[0] - m[12], bounds.min[1] - m[13], bounds.min[2] - m[14]], hi = [bounds.max[0] - m[12], bounds.max[1] - m[13], bounds.max[2] - m[14]];
  near(b.bowZ, hi[2], 0.006, 'her stem'); near(b.aftZ, lo[2], 0.006, 'her stern');
  near(b.halfWidth, Math.max(hi[0], -lo[0]), 0.006, 'her half beam'); near(b.keel, lo[1], 0.006, 'her keel'); near(b.top, hi[1], 0.006, 'her roof');
  near(b.deck, MEASURED.mainDeckY, 0.01, 'her deck');
  assert.ok(b.beam > 5.5 && b.beam < MEASURED.hullOuterX, `her half beam at her deck (${b.beam})`);
  let checked = 0;
  for (const [k, sail] of boat.Sails.entries()) {
    const ov = built.animation.overrides[compOf(find(built.prefab, sail.name), 'Animator').m_Controller.controller];
    const bones = placedNode(sail.children.find((c) => /SailBones$/.test(c.name)).name), bm = bones.m;
    const mine = b.rig.filter((x) => x.sail === k);
    assert.ok(mine.length, `${sail.name}: its boxes`);
    for (const [state, clip] of ov.clips) {
      if (/Stowed/.test(state)) continue;
      for (const c of built.animation.clips[clip].curves) {
        const p = xf(bm, c.components.map((q) => q.constant));
        checked++;
        assert.ok(mine.some(([mn, mx]) => p.every((x, n) => x >= mn[n] - 0.3 && x <= mx[n] + 0.3)), `${sail.name} ${state}: ${p.map((x) => x.toFixed(2))} in its box`);
      }
    }
  }
  assert.ok(checked > 500, `her canvas read (${checked} points)`);
});

// ── her pictures ───────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK HER PICTURES: painted at load from numbers alone - the same bytes every time - a picture a TEX record under CARRACK_ARCHIVE, each 64 x 64; registered with the vendor textures once; her stern windows\' slices alone glowing by night; every face of hers drawn on a picture of hers (mutants: a picture seeded off the clock, registered twice, the glow everywhere, a face on no picture)', async () => {
  const hash = (art) => createHash('sha256').update(JSON.stringify(art.map(([r, p]) => [r, p.width, p.height, Buffer.from(p.data).toString('base64')]))).digest('hex');
  const a = carrackArt(), b = carrackArt();
  assert.equal(hash(a), hash(b), 'the same bytes');
  assert.deepEqual([...new Set(a.map(([r]) => r))].sort((x, y) => x - y), [...new Set(Object.values(TEX))].sort((x, y) => x - y), 'a picture a record');
  for (const [r, p] of a) assert.deepEqual([p.width, p.height, p.data.length], [64, 64, 64 * 64 * 4], `record ${r}`);
  const lit = (r) => !!carrackGlow(r)?.data.some((v, i) => i % 4 === 0 && v > 0);
  assert.ok(BANDS.transom.recs.some(lit), 'her stern windows glow');
  for (const r of new Set(Object.values(TEX))) if (!BANDS.transom.recs.includes(r)) assert.equal(carrackGlow(r), null, `nothing else (record ${r})`);
  const records = new Set(a.map(([r]) => r));
  for (const [key, g] of Object.entries(built.meshes)) for (const s of g.slots ?? []) {
    if (s.record == null) continue;
    assert.equal(s.archive, CARRACK_ARCHIVE, `${key}: her archive`);
    assert.ok(records.has(s.record), `${key}: record ${s.record} painted`);
  }
  _resetCarrackArt();
  const added = [];
  const add = (entries) => { added.push(...entries); return entries.length; };
  assert.equal(registerCarrackArt(add), Object.keys(TEX).length);
  assert.equal(registerCarrackArt(add), 0, 'once');
  assert.ok(added.every((e) => e.archive === CARRACK_ARCHIVE && e.standIn === true && typeof e.build === 'function'));
  _resetCarrackArt();
});

// ── the mod's own Carrack fallen back to; her harbours ─────────────────────────────────────────────────────────────

test('SHIPS-2 CARRACK THE MOD\'S OWN CARRACK FALLEN BACK, AND HER HARBOURS: while her model does not stand hull 4 is the mod\'s Carrack\'s build, its gangway and its draft; standing, hers - her draft her keel\'s, still under the galleon\'s, so the deepest berther and every berth, footprint and quay sized off the mod\'s Carrack stand as they were (mutants: the fallback dropped, the berth template her own)', () => {
  try {
    setShipStanding(HULL.Carrack, false);
    assert.equal(hullBuild(HULL.Carrack), MOD_CARRACK_BUILD);
    assert.deepEqual(gangwaySide(HULL.Carrack), MOD_CARRACK_GANGWAY);
    near(LIFE.draftOf(HULL.Carrack), 3.2, 1e-9, 'the mod\'s Carrack\'s draft');
    setShipStanding(HULL.Carrack, true);
    assert.equal(hullBuild(HULL.Carrack), HULL_BUILDS[HULL.Carrack]);
    assert.deepEqual(gangwaySide(HULL.Carrack), GANGWAY_SIDE[HULL.Carrack]);
    near(LIFE.draftOf(HULL.Carrack), LIFE.DRAFT_SPARE - HULL_BUILDS[HULL.Carrack].keel, 1e-9, 'her draft her keel\'s');
    assert.ok(LIFE.draftOf(HULL.Carrack) < LIFE.draftOf(HULL.SmallShip), 'under the galleon\'s');
    assert.equal(LIFE.deepestBerther(), HULL.SmallShip);
    assert.equal(LIFE.BERTH_TEMPLATE, MOD_CARRACK_BUILD, 'berths sized off the mod\'s Carrack, as they were');
  } finally { setShipStanding(HULL.Carrack, true); }
});
