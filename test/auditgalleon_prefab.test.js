// AUDIT GALLEON (2026-10-02, Mac: "Audit this. It must be perfect") - HER PREFAB AND ITS ART: what stands in her tree,
// where it stands, what it is drawn in and how it is lit, held to the final bake (eac64ad59). Each pin failed on the code
// as it stood (64e27ef97, the final bake merged under it).
//   P1  her helmsman pinned by his capsule's centre (DrivePosition half a capsule over her roof), his view to the bow clear
//   P2  her manropes under her shut hatch covers      P3  her anchors outside her planking
//   P4  her board triggers outside her planking       P5  her stern lanterns' poles on her rail's cap
//   P6  her shutters fitted to her side               P7  her stair wells' casings in her inner planking
//   P8  her rudder hung on her sternpost              P9  her hatch covers opened onto her deck
//   P10 her shutters solid, and not deck              P12 her bed stood as the mod stands its own
//   STOVE her stove's cowl under her deckhead         CROWSNEST no sky through her crow's nest from below
//   R8/R11 her ports' throats in their own planks     R12 her texels as her art says them
//   R14 no T-junctions in her hull and castle         B1  each polygon lit by its own normal
//   NITS her measurements pinned, her comments true
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as GM from '../src/world/galleonModel.js';
import * as GA from '../src/world/galleonArt.js';
import { newell, norm } from '../src/world/galleonMesh.js';
import * as RG from '../src/world/galleonRig.js';
import { MODELS, scene, ctxFor } from './csaScene.mjs';
import { HULL, hullBuild } from '../src/systems/naval/navalShips.js';
import { instantiatePrefab } from '../src/world/prefabNode.js';
import { colliderPoses, boxColliderTriangles, raycastColliders, invertAffine } from '../src/world/prefabColliders.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT, EYE_HEIGHT } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { mat4FromQuatPosScale } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat, Boat } from '../src/systems/comeSailAwayBoat.js';
import { buildDeck, DECK_FLAT } from '../src/systems/naval/navalDeck.js';

const { MEASURED: M, HELM } = GM;
const { TEX } = GA;
const BAKE = JSON.parse(readFileSync(new URL('../src/assets/galleon/galleon.json', import.meta.url), 'utf8'));
const part = (role) => BAKE.parts.find((p) => p.role === role);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Her prefab tree, fresh (the prefab's root is her frame: her hull's node stands at its origin, unturned). */
const herTree = () => instantiatePrefab(MODELS.prefab(GM.GALLEON_PREFAB_ID), MODELS.components);
const nodeNamed = (root, name) => [...root.walk()].find((n) => n.name === name) ?? null;
const meshOf = (node) => { const mf = node.components.find((c) => c.type === 'MeshFilter'); return mf ? MODELS.geometry(mf.m_Mesh.mesh) : null; };
const pointsIn = (g, m) => { const out = []; for (let i = 0; i < g.positions.length; i += 3) out.push(xf(m, [g.positions[i], g.positions[i + 1], g.positions[i + 2]])); return out; };
const trianglesIn = (g, m, sm = null) => {
  const out = [], I = g.indices, from = sm ? sm.startIndex : 0, to = sm ? sm.startIndex + sm.primitiveCount * 3 : I.length;
  for (let t = from; t < to; t += 3) out.push([0, 1, 2].map((k) => xf(m, [g.positions[I[t + k] * 3], g.positions[I[t + k] * 3 + 1], g.positions[I[t + k] * 3 + 2]])));
  return out;
};
/** Möller-Trumbore: the distance along a ray to a triangle, or null. */
function rayTri(o, d, [a, b, c]) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const t0 = sub(o, a), u = dot(t0, p) / det;
  if (u < 0 || u > 1) return null;
  const q = cross(t0, e1), v = dot(d, q) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) / det;
  return t > 1e-9 ? t : null;
}
const hitsOf = (tris, o, d) => tris.map((tr) => rayTri(o, d, tr)).filter((t) => t != null).sort((a, b) => a - b);
/** Inside a closed mesh: odd crossings along most of three rays. */
const insideOf = (tris, p) => [[0.577, 0.577, 0.577], [-0.6, 0.48, 0.64], [0.3, -0.9, 0.316]].reduce((n, d) => n + (hitsOf(tris, p, d).length % 2), 0) >= 2;
/** Her hull's own triangles, as baked, each with its y/z bounds. */
const HULL_TRIS = (() => {
  const h = part('hull'), P = h.positions, T = h.triangles, out = [];
  for (let t = 0; t < T.length; t += 3) {
    const v = [0, 1, 2].map((k) => [P[T[t + k] * 3], P[T[t + k] * 3 + 1], P[T[t + k] * 3 + 2]]);
    out.push({ v, y0: Math.min(...v.map((q) => q[1])), y1: Math.max(...v.map((q) => q[1])), z0: Math.min(...v.map((q) => q[2])), z1: Math.max(...v.map((q) => q[2])) });
  }
  return out;
})();
/** The x of the outermost (`outer`) or innermost of `tris` over (y, z) on side `s`, as |x| - or null where none is (the
 *  bake keeps zero-area triangles on collinear corners: they meet no point). */
function xOver(tris, y, z, s, outer = true) {
  return surfaceOver(tris, y, z, s, outer)?.x ?? null;
}
/** xOver's surface: { x, n } - the x (as |x|) and the unit normal (turned out of her, s n.x > 0) of the triangle met. */
function surfaceOver(tris, y, z, s, outer = true) {
  let best = null;
  for (const t of tris) {
    const [a, b, c] = t.v ?? t;
    if (t.v && (y < t.y0 - 1e-9 || y > t.y1 + 1e-9 || z < t.z0 - 1e-9 || z > t.z1 + 1e-9)) continue;
    const d = (b[1] - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (b[2] - a[2]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((y - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (z - a[2])) / d, w = ((b[1] - a[1]) * (z - a[2]) - (y - a[1]) * (b[2] - a[2])) / d;
    if (u < -1e-9 || w < -1e-9 || u + w > 1 + 1e-9) continue;
    const x = s * (a[0] + u * (b[0] - a[0]) + w * (c[0] - a[0]));
    if (x < 0) continue;
    if (best === null || (outer ? x > best.x : x < best.x)) {
      const n = cross(sub(b, a), sub(c, a)), l = Math.hypot(...n) * Math.sign(s * n[0] || 1);
      best = { x, n: n.map((v) => v / l) };
    }
  }
  return best;
}
/** Her side's half-breadth at (y, z) on side `s`: her outer planking under the point. */
const halfBreadth = (y, z, s = 1) => xOver(HULL_TRIS, y, z, s, true);
/** The mod's own galleon (hull 2 without the new one). */
let _old = null;
const OLD = () => {
  if (_old) return _old;
  const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
  const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  _old = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
  return _old;
};

// ── P1: her helm ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The 28 sight lines from an eye to the bow's targets (helmView's fan), counted blocked by `occluders` within 3 m. */
function blockedLines(eye, targets, occluders) {
  let n = 0;
  for (const t of targets) {
    const d = sub(t, eye), L = Math.hypot(...d), u = d.map((v) => v / L);
    if (occluders.some((tris) => hitsOf(tris, eye, u).some((h) => h < 3))) n++;
  }
  return n;
}
const fan = (deckY, z) => [-2, -1, -0.5, 0, 0.5, 1, 2].flatMap((x) => [0.798, 1.798, 2.798, 3.798].map((dy) => [x, deckY + dy, z]));

test('AUDIT GALLEON P1: her DrivePosition stands half a capsule over her roof - Come Sail Away pins the helmsman\'s capsule CENTRE to it, as every hull of the mod\'s stands its own over its deck - and from that eye none of the 28 sight lines to her bow is blocked by her wheel at any turn of it or by her binnacle, as none of the mod\'s galleon\'s is from its own; let go, he stands on her roof (his feet stood 0.9 m under her roof, through it into her great cabin, his eye under the wheel\'s hub, all 28 lines blocked)', () => {
  near(HELM.stand[1], M.castleRoofY + CAPSULE_HEIGHT / 2, 1e-9, 'DrivePosition: the capsule\'s centre over her roof');
  // the mod's own hulls: DrivePosition over the deck under it, a body's centre over a deck each (0.7 to 1.4 m)
  const old = OLD();
  for (const id of [112410, 112411, 112412, 112413, 112414]) {
    const root = instantiatePrefab(old.prefab(id), old.components);
    const drive = nodeNamed(root, 'DrivePosition').worldMatrix(), p = [drive[12], drive[13], drive[14]];
    let deck = -Infinity;
    for (const n of root.walk()) for (const c of n.components) if (c.type === 'MeshCollider' && c.m_Mesh?.mesh) {
      const g = old.geometry(c.m_Mesh.mesh);
      for (const h of hitsOf(trianglesIn(g, n.worldMatrix()), [p[0], p[1] + 0.3, p[2]], [0, -1, 0])) deck = Math.max(deck, p[1] + 0.3 - h);
    }
    assert.ok(p[1] - deck > 0.6 && p[1] - deck < 1.5, `the mod's hull ${id}: DrivePosition ${(p[1] - deck).toFixed(3)} over its deck`);
  }
  // her eye, and the 28 lines to her bow: her wheel turned through every Sailing clip's angle and every angle between
  // (its spokes repeat each 45 degrees: a sweep of that in 3.75-degree steps), and her binnacle
  const root = herTree();
  const eye = [HELM.stand[0], HELM.stand[1] - CAPSULE_HEIGHT / 2 + EYE_HEIGHT, HELM.stand[2]];
  const targets = fan(M.mainDeckY, 21);
  const wheel = nodeNamed(root, 'HelmWheel'), ped = nodeNamed(root, 'HelmPedestal');
  const pedTris = trianglesIn(meshOf(ped), ped.worldMatrix());
  const turns = [0, 0.2, 0.4, 0.6, 0.8, 1, -0.2, -0.4, -0.6, -0.8, -1].map((t) => -t * GM.WHEEL_TURNS * 360);
  for (let a = 3.75; a < 45; a += 3.75) turns.push(a);
  for (const deg of turns) {
    const m = mat4FromQuatPosScale(quatEuler(0, 0, deg), HELM.hub, [1, 1, 1]);
    assert.equal(blockedLines(eye, targets, [trianglesIn(meshOf(wheel), m), pedTris]), 0, `her wheel turned ${deg} degrees and her binnacle block none of the 28`);
  }
  // the mod's galleon from its own stand: the same fan - as far abaft its stem as hers is of hers, over its main deck -
  // against its wheel and its wheel-well
  const oroot = instantiatePrefab(old.prefab(112412), old.components);
  const od = nodeNamed(oroot, 'DrivePosition').worldMatrix();
  const oeye = [od[12], od[13] - CAPSULE_HEIGHT / 2 + EYE_HEIGHT, od[14]];
  const oh = old.geometry('Galleon'), ohm = nodeNamed(oroot, 'Galleon').worldMatrix();
  const obow = Math.max(...pointsIn(oh, ohm).map((p) => p[2])), herStem = Math.max(...pointsIn(MODELS.geometry('galleon:hull'), nodeNamed(root, GM.GALLEON_HULL_NODE).worldMatrix()).map((p) => p[2]));
  const odeck = 40 - hitsOf(trianglesIn(oh, ohm), [1, 40, 10], [0, -1, 0])[0];
  near(odeck, 6.767, 1e-3, 'the mod\'s galleon\'s main deck');
  const oocc = ['GalleonWheel', 'GalleonWhelWell'].map((n) => trianglesIn(old.geometry(n), nodeNamed(oroot, n).worldMatrix()));
  assert.equal(blockedLines(oeye, fan(odeck, obow - (herStem - 21)), oocc), 0, 'the mod\'s galleon: none of its 28 blocked by its wheel');
  // the wheel's swept circle (its handles' tips) clears her roof
  assert.ok(HELM.hub[1] - (HELM.wheelR + 0.26) >= M.castleRoofY + 0.05, 'the wheel\'s lowest handle clear of her roof');
  // let go at the helm (the motor that stood frozen under the pin): his feet on her roof and staying there
  const col = new Collider(() => -50);
  let k = 0;
  for (const { collider: c, world: w } of colliderPoses(root)) {
    if (c.m_IsTrigger) continue;
    const tri = c.type === 'BoxCollider' ? boxColliderTriangles(c) : MODELS.geometry(c.m_Mesh.mesh);
    if (tri) col.addMesh(`b${k++}`, Array.from(tri.positions), Array.from(tri.indices), Float32Array.from(w));
  }
  const motor = new PlayerMotor(col);
  const feet = HELM.stand[1] - CAPSULE_HEIGHT / 2;
  near(feet, M.castleRoofY, 1e-9, 'his pinned feet on her roof');
  motor.spawn(HELM.stand[0], feet, HELM.stand[2]);
  motor.pinFeet(HELM.stand[0], feet, HELM.stand[2]);
  for (let f = 0; f < 180; f++) motor.update(FIXED_DT, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0);
  near(motor.pos[1], M.castleRoofY, 0.01, 'let go, he stands on her roof');
});

// ── P2: her manropes ───────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P2: each companion\'s two manropes run from the stair\'s foot up to her deck\'s underside and no higher - no rope vertex inside or over a shut hatch cover (as she spawns), none in the companion\'s collider over the cover\'s foot - their heads made fast to the hatchway\'s side (four rope stubs stood up to 0.69 m through the shut covers, in the colliders too)', () => {
  const root = herTree();
  for (const [key, hatch] of [['galleon:companionAft', 'HatchAft'], ['galleon:companionFore', 'HatchFore']]) {
    const g = MODELS.geometry(key);
    const sm = g.subMeshes[g.slots.findIndex((s) => s.record === TEX.rope)];
    const rope = new Set();
    for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) rope.add(g.indices[i]);
    const pts = [...rope].map((v) => [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]);
    const cover = nodeNamed(root, hatch), cp = pointsIn(meshOf(cover), cover.worldMatrix());
    const lo = [0, 1, 2].map((d) => Math.min(...cp.map((p) => p[d]))), hi = [0, 1, 2].map((d) => Math.max(...cp.map((p) => p[d])));
    const foot = lo[1], top = Math.max(...pts.map((p) => p[1]));
    assert.ok(top <= foot - 0.015, `${key}: the ropes' top ${top.toFixed(3)} under the cover's foot ${foot.toFixed(3)}`);
    assert.ok(!pts.some((p) => p.every((v, d) => v >= lo[d] && v <= hi[d])), `${key}: no rope vertex inside the shut cover`);
    assert.ok(Math.min(...pts.map((p) => p[1])) < M.gunDeckY + 1.2, `${key}: the ropes still reach down the stair to its foot`);
    // their heads fast to the hatchway's side, under the cover
    assert.ok(pts.some((p) => Math.abs(Math.abs(p[0]) - M.hatchFore.halfX) < 1e-6), `${key}: made fast at the hatchway's side`);
    // the collider: over the cover's foot, nothing but the stringers' heads (sunk in her deck at the hatchway's edge)
    const c = MODELS.geometry(`${key}:collider`);
    const heads = [-1, 1].map((s) => [s * 0.77, M.mainDeckY - 0.1]);
    for (let i = 0; i < c.positions.length; i += 3) {
      const p = [c.positions[i], c.positions[i + 1], c.positions[i + 2]];
      if (p[1] <= foot) continue;
      assert.ok(heads.some(([x, y]) => Math.hypot(p[0] - x, p[1] - y) < 0.1), `${key}: a collider vertex over the cover's foot at ${p.map((v) => v.toFixed(3))}, no stringer's head`);
    }
    near(foot, M.hatchCoverUnderY, 1e-3, `${hatch}: its foot where MEASURED reads it`);
  }
});

// ── P3: her anchors ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P3: both anchors - weighed (ActiveObject\'s, shown as she sails) and let go (IdleObject\'s cable) - stand with every vertex outside her outer planking, measured against the bake\'s own hull triangles: 2 cm clear or more, each turned so the anchor\'s arms (the model\'s z) run along her bow\'s side in plan, and the cable\'s head lies at her side, out of her hawse (205 of the weighed anchor\'s 312 vertices stood inboard of her outer planking, 62 of them in her open interior, and 83 of the cable\'s 106, 7 of them; the mod\'s galleon has none in its open interior)', () => {
  const root = herTree();
  for (const [name, parent] of [['GalleonAnchor', 'ActiveObject'], ['GalleonAnchorDeployed', 'IdleObject']]) {
    const n = nodeNamed(root, name);
    assert.equal(n.parent.name, parent, `${name} under ${parent}`);
    let inside = 0, least = Infinity, measured = 0;
    for (const p of pointsIn(MODELS.geometry(name), n.worldMatrix())) {
      assert.ok(p[0] > 0, `${name}: on her starboard bow`);
      const side = halfBreadth(p[1], p[2], 1);
      if (side == null) continue;
      measured++;
      const gap = p[0] - side;
      if (gap < 0) inside++;
      least = Math.min(least, gap);
    }
    assert.ok(measured > 50, `${name}: measured against her side (${measured})`);
    assert.equal(inside, 0, `${name}: vertices inside her outer planking`);
    assert.ok(least >= 0.019, `${name}: its nearest vertex ${(least * 100).toFixed(1)} cm off her side`);
    // turned to her bow: the node's z in plan along her side's run there (her half-breadth half a metre either way)
    const m = n.worldMatrix(), run = [halfBreadth(m[13], m[14] + 0.5, 1) - halfBreadth(m[13], m[14] - 0.5, 1), 1];
    const turn = Math.abs(Math.atan2(m[8], m[10]) - Math.atan2(run[0], run[1])) * 180 / Math.PI;
    assert.ok(turn < 1, `${name}: its arms ${turn.toFixed(1)} degrees off her bow's run in plan`);
  }
  // the cable's head at her side, as out of her hawse: its top's corners within 5 cm of her planking
  const cable = nodeNamed(root, 'GalleonAnchorDeployed'), cp = pointsIn(MODELS.geometry('GalleonAnchorDeployed'), cable.worldMatrix());
  const top = Math.max(...cp.map((p) => p[1]));
  for (const p of cp.filter((q) => q[1] > top - 0.05)) assert.ok(p[0] - halfBreadth(p[1], p[2], 1) <= 0.05, `the cable's head ${((p[0] - halfBreadth(p[1], p[2], 1)) * 100).toFixed(1)} cm off her side`);
});

// ── P4: her board triggers ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P4: her two board triggers stand outside her planking - each box\'s inner face outboard of her side over all its height and length - and from her gun deck, her shutters shut, Come Sail Away\'s activation ray (raycastColliders, triggers taken) never meets one (they reached 0.4-2 cm into her gun deck and filled gunport 2\'s throat, and a look at her side from the gun deck boarded her at 1.5-1.6 m)', () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const H = boat.MeshObject.worldMatrix(), Hi = invertAffine(H);
  const under = (n) => { for (let k = n; k; k = k.parent) if (k.name === 'BoardTrigger') return true; return false; };
  const boards = boat.BoardTriggers.filter(under);
  assert.equal(boards.length, 2, 'two board triggers');
  for (const t of boards) {
    const box = t.getComponent('BoxCollider'), ce = box.m_Center, sz = box.m_Size, m = multiply(Hi, t.worldMatrix(), new Float32Array(16));
    const corners = [];
    for (let i = 0; i < 8; i++) corners.push(xf(m, [ce.x + (i & 1 ? 0.5 : -0.5) * sz.x, ce.y + (i & 2 ? 0.5 : -0.5) * sz.y, ce.z + (i & 4 ? 0.5 : -0.5) * sz.z]));
    const sgn = Math.sign(corners[0][0]);
    const inner = Math.min(...corners.map((p) => sgn * p[0]));
    const [y0, y1] = [Math.min(...corners.map((p) => p[1])), Math.max(...corners.map((p) => p[1]))], [z0, z1] = [Math.min(...corners.map((p) => p[2])), Math.max(...corners.map((p) => p[2]))];
    let widest = 0;
    for (let y = y0; y <= y1; y += 0.1) for (let z = z0; z <= z1; z += 0.1) widest = Math.max(widest, halfBreadth(y, z, sgn) ?? 0);
    assert.ok(inner >= widest, `the ${sgn > 0 ? 'starboard' : 'port'} trigger's inner face ${inner.toFixed(3)} outboard of her side (${widest.toFixed(3)} at most there)`);
  }
  // her gun deck's eyes - standing and crouched - looking out at her sides, her shutters shut
  const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : null);
  let rays = 0;
  for (const sgn of [1, -1]) for (let x = 3.0; x <= 4.76; x += 0.44) for (let z = -2.0; z <= 3.6; z += 0.4) for (const eyeY of [M.gunDeckY + 1.7, M.gunDeckY + 0.8]) {
    for (let yawD = -60; yawD <= 60; yawD += 15) for (let pitchD = -24; pitchD <= 24; pitchD += 12) {
      const a = (yawD * Math.PI) / 180, b = (pitchD * Math.PI) / 180, d = [sgn * Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)];
      const o = xf(H, [sgn * x, eyeY, z]), dw = sub(xf(H, d), xf(H, [0, 0, 0]));
      const hit = raycastColliders(boat.GameObject, o, dw, 3.2, { triggers: true, geometry });
      rays++;
      assert.ok(!hit || !under(hit.node), `from her gun deck (${(sgn * x).toFixed(2)}, ${eyeY.toFixed(2)}, ${z.toFixed(1)}) a look at yaw ${yawD} pitch ${pitchD} met a board trigger at ${hit?.distance.toFixed(2)}`);
    }
  }
  assert.ok(rays > 10000, `the looks (${rays})`);
});

// ── P5: her stern lanterns ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P5: her two stern lanterns\' poles stand on her rail\'s cap - no pole vertex inside the rail, each foot on the cap - their lanterns hung over it (45 and 37 of their 51 vertices stood inside the rail, their lanterns 1.2 cm off its inner face)', () => {
  const root = herTree();
  const rail = nodeNamed(root, 'CastleRail'), railTris = trianglesIn(meshOf(rail), rail.worldMatrix());
  const cap = Math.max(...pointsIn(meshOf(rail), rail.worldMatrix()).map((p) => p[1]));
  const poles = [...root.walk()].filter((n) => n.name === 'LanternHookStandPoleShort');
  assert.equal(poles.length, 2);
  for (const pole of poles) {
    const pts = pointsIn(MODELS.geometry('LanternHookStandOld'), pole.worldMatrix());
    const inside = pts.filter((p) => insideOf(railTris, p)).length;
    assert.equal(inside, 0, `the pole at x ${pole.position[0]}: vertices inside her rail`);
    const foot = Math.min(...pts.map((p) => p[1]));
    assert.ok(foot >= cap && foot <= cap + 0.01, `its foot on the cap (${foot.toFixed(4)} over ${cap.toFixed(4)})`);
    // its foot over the cap's own width there (the rail's top face under each of its lowest corners)
    for (const p of pts.filter((q) => q[1] < foot + 0.02)) assert.ok(hitsOf(railTris, [p[0], p[1] + 0.01, p[2]], [0, -1, 0]).some((h) => h < 0.05), `the pole's foot over the cap at ${p.map((v) => v.toFixed(3))}`);
    const flat = pole.children.find((c) => c.name.startsWith('BillboardHelper')).worldMatrix();
    assert.ok(flat[13] - cap > 0.8, `its lantern hung ${(flat[13] - cap).toFixed(3)} m over the cap`);
  }
  near(cap, M.railCapY, 1e-3, 'MEASURED.railCapY is her rail\'s cap');
});

// ── P6: her shutters' fit ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P6: each gunport shutter shut lies on her side - its inner face 2 cm or less off her planking along all its edges (and her planking no more than 2.5 cm into it, where a crease of the bake\'s runs under port 4\'s fore corner), on each side\'s own surface, hinged on her side at the lintel, bent where her side bends (its knuckle, over the sill, and under port 4\'s sill where she falls in toward the bow) - covering its port, each side\'s the other\'s mirror; LID_FIT the bake\'s own measure (tools/galleonLidFit.mjs re-measures it) (the plumb slab stood 2.1 cm off her side at the knuckle, 8-9 at the hinge, 10-11 at the sill and 12 at its foot at ports 0-3, 47 at port 4\'s lower fore corner)', async () => {
  const root = herTree();
  let worstGap = 0, worstBite = 0;
  for (const [sideName, s] of [['Starboard', 1], ['Port', -1]]) M.portZ.forEach((z, i) => {
    const node = nodeNamed(root, `Gunport${sideName}${i}`), g = meshOf(node);
    // its board's inner face: the faces of its picture looking in at her side - within 73 degrees of her planking's own
    // normal under each of their corners (its edges look along her side: at port 4's foot, where she falls in and its
    // board with her, its foot's edge looks inboard but not at her), or over the port's opening, where no planking is,
    // inboard
    const tris = trianglesIn(g, node.worldMatrix(), g.subMeshes[g.slots.findIndex((sl) => sl.record === TEX.lid)]).filter((tr) => {
      const n = norm(cross(sub(tr[1], tr[0]), sub(tr[2], tr[0]))), sides = tr.map((p) => surfaceOver(HULL_TRIS, p[1], p[2], s)).filter(Boolean);
      return sides.length ? sides.every((side) => dot(n, side.n) < -0.3) : s * n[0] < -0.3;
    });
    const lp = tris.flat();
    // its edges (5 mm in from them), over its port
    const top = Math.max(...lp.map((p) => p[1])) - 0.005, foot = Math.min(...lp.map((p) => p[1])) + 0.005, hw = Math.max(...lp.map((p) => Math.abs(p[2] - z))) - 0.005;
    assert.ok(top > M.portTopY && foot < M.portSillY && hw > M.portHalfW, `${node.name}: over its port (its inner face ${foot.toFixed(3)}-${top.toFixed(3)} high, ${hw.toFixed(3)} either side)`);
    // its inner face along its edges against her planking under it, on its own side
    const edge = [];
    for (let y = foot; y <= top + 1e-9; y += 0.01) edge.push([y, -hw], [y, hw]);
    for (let dz = -hw; dz <= hw + 1e-9; dz += 0.01) edge.push([top, dz], [foot, dz]);
    for (const [y, dz] of edge) {
      if (Math.abs(dz) < M.portHalfW && y > M.portSillY && y < M.portTopY) continue;
      const side = halfBreadth(y, z + dz, s), lid = xOver(tris, y, z + dz, s, false);
      if (side == null) continue;
      assert.ok(lid != null, `${node.name}: its face over (${y.toFixed(3)}, ${dz.toFixed(3)})`);
      worstGap = Math.max(worstGap, lid - side); worstBite = Math.max(worstBite, side - lid);
      assert.ok(lid - side <= 0.02, `${node.name}: ${((lid - side) * 100).toFixed(1)} cm off her side at (${y.toFixed(3)}, ${dz.toFixed(3)})`);
      assert.ok(side - lid <= 0.025, `${node.name}: ${((side - lid) * 100).toFixed(1)} cm into her side at (${y.toFixed(3)}, ${dz.toFixed(3)})`);
    }
    // the hinge on her side at the lintel: her outermost along the board's top
    const L = GM.LID;
    near(s * node.worldMatrix()[12], Math.max(...L.cols.map((dz) => halfBreadth(L.rows[0], z + dz, s))), 0.0015, `${node.name}: its hinge on her side at the lintel`);
  });
  assert.ok(worstGap > 0 && worstGap <= 0.02 && worstBite <= 0.025, `her shutters' worst gap ${(worstGap * 100).toFixed(1)} cm, worst bite ${(worstBite * 100).toFixed(1)}`);
  // LID_FIT: the bake's own measure, as the tool re-measures it
  const { measureLidFit } = await import('../tools/galleonLidFit.mjs');
  const { fit } = measureLidFit(BAKE);
  assert.equal(GM.LID_FIT.length, M.portZ.length, 'a fit a port');
  GM.LID_FIT.forEach((rows, i) => rows.forEach((row, r) => row.forEach((x, k) => near(x, fit[i][r][k], 1e-3, `LID_FIT port ${i} row ${r} column ${k} (node tools/galleonLidFit.mjs)`))));
  // each pair one shape mirrored: the board's every face (its picture's triangles), and every corner of it and its eyes
  const X4 = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const at = (p) => p.map((v) => (Math.abs(v) < 5e-6 ? 0 : v).toFixed(5)).join(',');
  for (let i = 0; i < M.portZ.length; i++) {
    const sb = MODELS.geometry(`galleon:gunportLid${i}`), pt = MODELS.geometry(`galleon:gunportLidPort${i}`);
    const board = (g, m) => trianglesIn(g, m, g.subMeshes[g.slots.findIndex((sl) => sl.record === TEX.lid)]).map((t) => t.map(at).sort().join(' ')).sort();
    assert.deepEqual(board(pt, IDENTITY), board(sb, X4), `port ${i}: the port side's board the starboard's mirrored`);
    const corners = (g, m) => [...new Set(pointsIn(g, m).map(at))].sort();
    assert.deepEqual(corners(pt, IDENTITY), corners(sb, X4), `port ${i}: the port side's shutter and eyes the starboard's mirrored`);
  }
});

// ── P7: her stair wells ────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P7: her stair wells\' casings wear her inner planking on every face, by face: each well\'s two walls (the castle\'s faces 9/10, 12/13) and the casings\' sides in her great cabin (26/27, 29/30) - none her outer livery (each well had one wall in the castle\'s exterior livery, and the cabin\'s outboard casing sides too)', () => {
  const c = part('castle'), P = c.positions;
  for (const k of [9, 10, 12, 13, 26, 27, 29, 30]) {
    const ring = c.polygons[k].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const n = norm(newell(ring)), cen = [0, 1, 2].map((d) => ring.reduce((a, p) => a + p[d], 0) / ring.length);
    assert.ok(Math.abs(n[0]) > 0.99 && Math.abs(cen[0]) > 3.2 && Math.abs(cen[0]) < 4.9 && cen[1] > 9 && cen[2] < -10.2, `castle face ${k} is a well's wall or a casing's side (n ${n.map((v) => v.toFixed(2))}, centre ${cen.map((v) => v.toFixed(2))})`);
    const skin = GM.faceSkin('castle', n, cen);
    assert.ok(!('band' in skin), `castle face ${k}: no livery`);
    assert.equal(skin.rec, TEX.hullInner, `castle face ${k}: her inner planking`);
  }
});

// ── P8: her rudder ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P8: her rudder hangs on her sternpost and turns there - its blade cut abaft the post and closed at its front - and turned RUDDER_DEG either way every blade vertex stands 1 cm or more abaft her stern (pivoted at its own open front 0.62 m inside her, at 35 degrees it swung 0.355 m through her stern planking, its hollow front opening)', () => {
  // the sternpost: her hull's aftmost corners on her centreline from her keel to her knuckle - plumb
  const h = part('hull'), centre = [];
  let widest = 0, knuckle = 0;   // her knuckle: the height of her widest corners
  for (let i = 0; i < h.positions.length; i += 3) if (Math.abs(h.positions[i]) > widest) { widest = Math.abs(h.positions[i]); knuckle = h.positions[i + 1]; }
  for (let i = 0; i < h.positions.length; i += 3) if (Math.abs(h.positions[i]) < 1e-4 && h.positions[i + 1] > -3.5 && h.positions[i + 1] <= knuckle + 1e-3) centre.push([h.positions[i + 1], h.positions[i + 2]]);
  const aftmost = Math.min(...centre.map(([, z]) => z)), post = centre.filter(([, z]) => z < aftmost + 1e-4);
  assert.ok(post.length >= 2 && Math.max(...post.map(([y]) => y)) - Math.min(...post.map(([y]) => y)) > 5, 'her sternpost plumb from her keel to her knuckle');
  near(M.rudderPivotZ, aftmost, 1e-3, 'the pivot on her sternpost');
  const root = herTree(), node = nodeNamed(root, 'HelmRudder');
  [0, 0, M.rudderPivotZ].forEach((v, d) => near(node.position[d], v, 1e-5, 'HelmRudder on the post'));
  const g = MODELS.geometry('galleon:rudder');
  // closed: every edge of the blade (its corners welded) shared by two triangles, its faces out
  const k = (i) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]].map((v) => v.toFixed(5)).join(',');
  const edges = new Map();
  let vol = 0;
  for (let t = 0; t < g.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => [g.positions[g.indices[t + j] * 3], g.positions[g.indices[t + j] * 3 + 1], g.positions[g.indices[t + j] * 3 + 2]]);
    vol += dot(a, cross(b, c)) / 6;
    for (let e = 0; e < 3; e++) { const key = [k(g.indices[t + e]), k(g.indices[t + (e + 1) % 3])].sort().join('|'); edges.set(key, (edges.get(key) ?? 0) + 1); }
  }
  assert.deepEqual([...edges.values()].filter((n) => n !== 2), [], 'the blade closed: every edge two faces\'');
  assert.ok(vol > 0, 'its faces out');
  // turned: every vertex 1 cm or more abaft her stern's outer surface (a ray from astern at its x and y)
  for (const deg of [-GM.RUDDER_DEG, 0, GM.RUDDER_DEG]) {
    const m = mat4FromQuatPosScale(quatEuler(0, deg, 0), node.position, [1, 1, 1]);
    for (const p of pointsIn(g, m)) {
      const hit = hitsOf(HULL_TRIS.map((t) => t.v), [p[0], p[1], -40], [0, 0, 1])[0];
      if (hit == null) continue;
      assert.ok(p[2] <= -40 + hit - 0.01, `at ${deg} deg a blade vertex ${p.map((v) => v.toFixed(3))} under 1 cm abaft her stern (its surface at ${(-40 + hit).toFixed(3)})`);
    }
  }
});

// ── P9: her hatch covers opened ────────────────────────────────────────────────────────────────────────────────────

/** A running rope's end on bone `bn` - every place it takes: a sail's bone (a clew) at each of its sail's poses (the
 *  clips' positions, in its boom's frame or, the jib's, hers), any other bone at its own place. */
function ropeEnds(bn) {
  if (!/SailBones$/.test(bn.parent.name)) { const m = bn.worldMatrix(); return [[m[12], m[13], m[14]]]; }
  const key = bn.parent.name.replace(/SailBones$/, ''), k = Number(bn.name.slice(1)), m = bn.parent.parent.worldMatrix();
  const s = RG.SAILS.find((x) => x.key === key);
  const poses = key === 'Jib' ? [...['stowed', 'port', 'center', 'starboard'].map((p) => RG.jibPose(p)), RG.jibPose('port', 0.5), RG.jibPose('starboard', 0.5)]
    : s.kind === 'gaff' ? ['stowed', 'port', 'center', 'starboard'].map((p) => RG.gaffSailPose(s, RG.RIG.mainR, p))
      : ['stowed', 'aback', 'center', 'full'].map((p) => RG.squareSailPose(s, RG.yardOffset(s), s.mast === 'fore' ? RG.RIG.foreR : RG.RIG.mainR, p));
  return poses.map((g) => xf(m, g[k]));
}
const boxGap = (lo, hi, p) => Math.hypot(...[0, 1, 2].map((d) => Math.max(lo[d] - p[d], 0, p[d] - hi[d])));

test('AUDIT GALLEON P9: a hatch cover opens over onto her deck beside its hatchway - swinging up out of its rebate and over to starboard all the way (never back through the hatchway, never deeper in her deck than it lies shut), lying on her deck, its foot clear of the hatchway\'s edge and nothing else of hers under or in it - and lies clear of the main gaff\'s boom and canvas at every trim the helm allows, of every running rope at every trim of its yard or boom and every pose of its sail, and of every belay (an open cover stood up 2.5 m in the boom\'s sweep: trimmed 15-30 degrees to starboard the boom and the gaff\'s canvas passed through the aft one)', () => {
  assert.ok(GM.HATCH_OPEN_DEG > -180 && GM.HATCH_OPEN_DEG <= -170, `HATCH_OPEN_DEG ${GM.HATCH_OPEN_DEG}: over, short of the half turn`);
  const root = herTree();
  const all = [...root.walk()];
  // her gaff boom, its spars and the gaff canvas's every pose (Come Sail Away's manual trim: 90 each way)
  const boom = nodeNamed(root, 'MainGaffBoom'), spars = nodeNamed(root, 'MainGaffSpars');
  const gaff = RG.SAILS.find((x) => x.kind === 'gaff');
  const poses = ['stowed', 'port', 'center', 'starboard'].map((p) => RG.gaffSailPose(gaff, RG.RIG.mainR, p));
  const others = [];
  for (const n of all) {
    if (/^Hatch(Aft|Fore)$/.test(n.name) || ['MainDeck', GM.GALLEON_HULL_NODE, 'MainGaffSpars'].includes(n.name)) continue;
    const g = meshOf(n);
    if (g && !g.blendIndices) others.push({ name: n.name, pts: pointsIn(g, n.worldMatrix()) });
  }
  // her running rope: each a two-bone line (galleonRig.js running), its bones by their paths
  const paths = new Map();
  const walk = (n, path) => { paths.set(path, n); for (const c of n.children) walk(c, `${path}/${c.name}`); };
  walk(root, root.name);
  const ropes = all.flatMap((n) => n.components.filter((c) => c.type === 'SkinnedMeshRenderer' && /^galleon:rope:/.test(c.m_Mesh.mesh)).map((c) => ({ key: c.m_Mesh.mesh, bones: c.m_Bones.map((b) => paths.get(b.node)) })));
  assert.equal(ropes.length, 11, 'her braces, sheets and mainsheet');
  const booms = all.filter((n) => /(Square|Gaff)Boom$/.test(n.name));
  assert.equal(booms.length, 4);
  for (const [name, hole] of [['HatchAft', M.hatchAft], ['HatchFore', M.hatchFore]]) {
    const cover = nodeNamed(root, name), g = meshOf(cover);
    // the blend: the clips' nlerp from shut to open - up out of its rebate (shut, Mac's cover lies 11 cm down in her
    // deck round its hatchway) and over to starboard, every step of it further than the last
    const q0 = [0, 0, 0, 1], q1 = quatEuler(0, 0, GM.HATCH_OPEN_DEG);
    let lastX = -Infinity;
    for (let t = 0; t <= 1 + 1e-9; t += 0.05) {
      const s = q0[3] * q1[3] + q0[2] * q1[2] >= 0 ? 1 : -1, q = q0.map((v, k) => v * (1 - t) + s * q1[k] * t), l = Math.hypot(...q);
      cover.localRotation = q.map((v) => v / l);
      const pts = pointsIn(g, cover.worldMatrix()), mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      assert.ok(Math.min(...pts.map((p) => p[1])) >= M.hatchCoverUnderY - 1e-3, `${name} at ${t.toFixed(2)} of its swing: no deeper in her deck than shut`);
      assert.ok(mx > lastX, `${name} at ${t.toFixed(2)} of its swing: further over to starboard`);
      lastX = mx;
    }
    const pts = pointsIn(g, cover.worldMatrix());
    const lo = [0, 1, 2].map((d) => Math.min(...pts.map((p) => p[d]))), hi = [0, 1, 2].map((d) => Math.max(...pts.map((p) => p[d])));
    assert.ok(lo[1] >= M.mainDeckY && lo[1] <= M.mainDeckY + 0.01, `${name} open: on her deck (its lowest at ${lo[1].toFixed(4)})`);
    assert.ok(hi[1] <= M.mainDeckY + 0.6, `${name} open: lying flat (its top at ${hi[1].toFixed(3)})`);
    assert.ok(lo[0] >= hole.halfX + 0.1, `${name} open: its foot ${lo[0].toFixed(3)} clear of the hatchway's edge ${hole.halfX}`);
    for (const o of others) assert.ok(!o.pts.some((p) => p.every((v, d) => v > lo[d] + 1e-3 && v < hi[d] - 1e-3)), `${name} open: ${o.name} stands inside it`);
    for (let trim = -90; trim <= 90; trim += 5) {
      boom.localRotation = quatEuler(0, trim, 0);
      const bm = boom.worldMatrix();
      const swept = [...pointsIn(meshOf(spars), spars.worldMatrix()), ...poses.flatMap((ps) => ps.map((p) => xf(bm, p)))];
      assert.ok(Math.min(...swept.map((p) => boxGap(lo, hi, p))) > 1, `${name} open: the gaff's boom or canvas within a metre of it at a trim of ${trim}`);
    }
    boom.localRotation = [0, 0, 0, 1];
    // every running rope, its yard or boom trimmed as far as the helm turns it (the square 45 either way, the gaff 90)
    for (const b of booms) {
      const lim = /Gaff/.test(b.name) ? 90 : 45;
      const mine = ropes.filter((r) => r.bones.some((bn) => { for (let k = bn; k; k = k.parent) if (k === b) return true; return false; }));
      for (let trim = -lim; trim <= lim; trim += 5) {
        b.localRotation = quatEuler(0, trim, 0);
        for (const r of mine) {
          const [A, C] = r.bones.map(ropeEnds);
          for (const a of A) for (const c of C) for (let k = 0; k <= 200; k++) {
            const p = a.map((v, d) => v + ((c[d] - v) * k) / 200);
            assert.ok(boxGap(lo, hi, p) > 0.15, `${name} open: ${r.key} within 15 cm of it at a trim of ${trim}`);
          }
        }
      }
      b.localRotation = [0, 0, 0, 1];
    }
    for (const [k, p] of Object.entries(RG.BELAYS)) for (const s of [1, -1]) assert.ok(boxGap(lo, hi, [s * p[0], p[1], p[2]]) > 1, `${name} open: within a metre of the ${k} belay`);
  }
});

// ── P10: her shutters solid ────────────────────────────────────────────────────────────────────────────────────────

/** A crouched body on her gun deck between a gun (run in) and a port, crawling out through it (the port's own motor and
 *  collider over her colliders at rest): how far out it gets. */
function crawl(i, sgn, open) {
  const root = herTree();
  if (open) nodeNamed(root, `Gunport${sgn > 0 ? 'Starboard' : 'Port'}${i}`).localRotation = quatEuler(0, 0, sgn * GM.LID_OPEN_DEG);
  const col = new Collider(() => -50);
  let k = 0;
  for (const { collider: c, world: w } of colliderPoses(root)) {
    if (c.m_IsTrigger) continue;
    const tri = c.type === 'BoxCollider' ? boxColliderTriangles(c) : MODELS.geometry(c.m_Mesh.mesh);
    if (tri) col.addMesh(`b${k++}`, Array.from(tri.positions), Array.from(tri.indices), Float32Array.from(w));
  }
  const motor = new PlayerMotor(col);
  motor.spawn(sgn * 4.3, M.gunDeckY + 0.01, M.portZ[i]);
  const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
  motor.update(FIXED_DT, { ...still, crouch: true }, (sgn * Math.PI) / 2);
  let out = -Infinity;
  for (let f = 0; f < 360; f++) { motor.update(FIXED_DT, { ...still, forward: 1 }, (sgn * Math.PI) / 2); out = Math.max(out, sgn * motor.pos[0]); }
  return { out, crouched: motor.crouching };
}
/** Her deck as the pool bakes it (comeSailAwayPool.js deckOf's own steps), leaving out the colliders of nodes `skip`. */
function bakedDeck(skip = null) {
  const probe = new Boat(HULL.SmallShip, 0);
  spawnBoat(probe, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }));
  const meshes = [], frame = invertAffine(probe.MeshObject.worldMatrix());
  for (const { node, collider: c, world } of colliderPoses(probe.GameObject)) {
    if (c.m_IsTrigger || c.m_Enabled === false || (skip && skip.test(node.name))) continue;
    const m = multiply(frame, world, new Float32Array(16));
    const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : null;
    if (!g) continue;
    const out = new Float64Array(g.positions.length);
    for (let i = 0; i < g.positions.length; i += 3) { const p = xf(m, [g.positions[i], g.positions[i + 1], g.positions[i + 2]]); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
    meshes.push({ positions: out, indices: g.indices });
  }
  const b = hullBuild(HULL.SmallShip);
  const d = buildDeck(meshes, { minX: -b.halfWidth - 1, maxX: b.halfWidth + 1, minZ: b.aftZ - 1, maxZ: b.bowZ + 1 });
  const plain = (v) => (ArrayBuffer.isView(v) ? Array.from(v) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'function').map(([kk, x]) => [kk, plain(x)])) : v);
  return JSON.stringify(plain({ y: d.y, more: d.more, floors: d.floors, flights: d.flights, count: d.count }));
}

test('AUDIT GALLEON P10: each gunport shutter is solid and turns with its node - a crouched body (0.9 m, 0.35 round) cannot crawl out through a shut port, and can through an open one - and her deck\'s bake is cell for cell what it is without them (no face of their colliders within 30 degrees of level, DECK_FLAT: a box\'s top, a ledge at 3.0 m outside her side, was taken for a floor) (shut ports, the sill 0.478 over the gun deck under a step of 0.5, let a crouched body out into the sea)', () => {
  const root = herTree();
  for (const [sideName] of [['Starboard'], ['Port']]) M.portZ.forEach((z, i) => {
    const n = nodeNamed(root, `Gunport${sideName}${i}`);
    const c = n.components.find((x) => x.type === 'MeshCollider' || x.type === 'BoxCollider');
    assert.ok(c && c.m_Enabled !== false && !c.m_IsTrigger, `${n.name}: solid`);
    assert.ok(n.components.some((x) => x.type === 'Animator'), `${n.name}: on the node its clip turns`);
    // and no face of it a floor to her deck's bake (DECK_FLAT), wherever her deck's cells fall: shut, it stands up her side
    if (c.type === 'MeshCollider') for (const [a, b, cc] of trianglesIn(MODELS.geometry(c.m_Mesh.mesh), n.worldMatrix())) {
      const nn = cross(sub(b, a), sub(cc, a));
      assert.ok(Math.abs(nn[1]) < DECK_FLAT * Math.hypot(...nn), `${n.name}: a face of its collider ${(Math.acos(Math.abs(nn[1]) / Math.hypot(...nn)) * 180 / Math.PI).toFixed(1)} degrees off level, a floor`);
    }
  });
  for (const [i, sgn] of [[2, 1], [4, -1]]) {
    const shut = crawl(i, sgn, false), open = crawl(i, sgn, true);
    assert.ok(shut.crouched && open.crouched, 'crouched');
    assert.ok(shut.out < M.hullOuterX - 0.3, `port ${i} ${sgn > 0 ? 'starboard' : 'port'} shut: held in her (${shut.out.toFixed(3)})`);
    assert.ok(open.out > M.hullOuterX + 1, `port ${i} ${sgn > 0 ? 'starboard' : 'port'} open: out through it (${open.out.toFixed(3)})`);
  }
  assert.equal(bakedDeck(), bakedDeck(/^Gunport(Starboard|Port)\d$/), 'her deck\'s bake with her shutters\' colliders is the bake without them');
});

// ── P12, the stove ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON P12: her bed stands BED_OVER_DECK over her deck, as the mod stands its galleon\'s over its own (0.262 m - its trireme\'s 0.261) (it stood at her deck: the bed model sank that far into the cabin\'s floor)', () => {
  // the mod's galleon's and its trireme's: each BedObject over the deck under it (the hull's own mesh)
  const old = OLD();
  const over = (id, hullNode) => {
    const oroot = instantiatePrefab(old.prefab(id), old.components), bed = nodeNamed(oroot, 'BedObject').worldMatrix();
    const hull = nodeNamed(oroot, hullNode), mf = hull.components.find((c) => c.type === 'MeshFilter');
    const ys = hitsOf(trianglesIn(old.geometry(mf.m_Mesh.mesh), hull.worldMatrix()), [bed[12], bed[13] + 0.3, bed[14]], [0, -1, 0]).map((h) => bed[13] + 0.3 - h);
    return bed[13] - Math.max(...ys.filter((y) => y <= bed[13]));
  };
  const mod = over(112412, 'Galleon');
  near(over(112413, 'Trireme'), mod, 1e-3, 'the mod\'s trireme\'s bed as its galleon\'s');
  const root = herTree();
  near(nodeNamed(root, 'BedObject').worldMatrix()[13] - M.mainDeckY, mod, 1e-3, 'her bed over her deck as the mod\'s over its');
  near(GM.BED_OVER_DECK, mod, 1e-3, 'BED_OVER_DECK the mod\'s');
});

test('AUDIT GALLEON STOVE: her stove\'s cowl stands STOVE.headGap under her deckhead, as the mod\'s galleon stands its own under its deck (0.136 m), carried up from the stove\'s stack by an iron flue seated in its foot (its top stood at 4.019, 1.92 m under her deckhead)', () => {
  // the mod's galleon's: its cowl's top under its deck's underside (the first face looking down over the cowl's top -
  // that deck's underside stops short of its side at the cowl's outboard lip, where a line up meets its top)
  const old = OLD(), oroot = instantiatePrefab(old.prefab(112412), old.components);
  const opts = pointsIn(old.geometry('StovePipe'), nodeNamed(oroot, 'StovePipe').worldMatrix());
  const otop = Math.max(...opts.map((p) => p[1]));
  const otris = trianglesIn(old.geometry('Galleon'), nodeNamed(oroot, 'Galleon').worldMatrix());
  let head = Infinity;
  for (const p of opts.filter((q) => q[1] > otop - 0.05)) for (const tr of otris) {
    const t = rayTri([p[0], otop, p[2]], [0, 1, 0], tr);
    if (t != null && cross(sub(tr[1], tr[0]), sub(tr[2], tr[0]))[1] < 0) head = Math.min(head, otop + t);
  }
  const mod = head - otop;
  // hers: its top under her deckhead (her main deck's underside over her gun deck) as the mod's
  const root = herTree();
  const cowl = nodeNamed(root, 'StovePipe'), pipe = MODELS.geometry('StovePipe');
  const top = Math.max(...pointsIn(pipe, cowl.worldMatrix()).map((p) => p[1]));
  near(M.mainDeckUnderY - top, mod, 1e-3, 'the cowl\'s top under her deckhead as the mod\'s under its');
  near(GM.STOVE.headGap, mod, 1e-3, 'STOVE.headGap the mod\'s');
  near(pipe.aabb.center[1] + pipe.aabb.extent[1], GM.STOVE.cowlTop, 1e-3, 'STOVE.cowlTop: the cowl mesh\'s top over its node');
  // the flue: from the stack's top (where the cowl stood) up into the cowl's foot
  const flue = nodeNamed(root, 'StoveFlue'), fp = pointsIn(meshOf(flue), flue.worldMatrix());
  const stove = nodeNamed(root, 'Stove').worldMatrix();
  near(Math.min(...fp.map((p) => p[1])), stove[13] + nodeNamed(oroot, 'StovePipe').localPosition[1], 0.01, 'the flue from the stack\'s top (where the mod\'s stove stands its cowl)');
  const cowlFoot = cowl.worldMatrix()[13];
  assert.ok(Math.max(...fp.map((p) => p[1])) > cowlFoot && Math.max(...fp.map((p) => p[1])) < cowlFoot + 0.06, 'seated in the cowl\'s foot');
});

// ── the crow's nest ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON CROWSNEST: looked at from below - from her deck, her rig and the masthead\'s foot - every line up through the crow\'s nest\'s bottom ring meets a face drawn toward it, never a back (culled) or the sky: the masthead capped, the nest\'s floor given its underside and its bowl closed under it round the mast (a ring of sky about 0.10 m showed round the masthead, through the floor\'s back)', () => {
  const root = herTree();
  const tris = [];
  for (const name of ['MainMast', 'CrowsNest']) { const n = nodeNamed(root, name); tris.push(...trianglesIn(meshOf(n), n.worldMatrix())); }
  const nest = part('crowsNest'), np = [];
  for (let i = 0; i < nest.positions.length; i += 3) np.push([nest.positions[i], nest.positions[i + 1], nest.positions[i + 2]]);
  const low = Math.min(...np.map((p) => p[1]));
  const ring = np.filter((p) => p[1] < low + 1e-4);
  const mast = part('mainMast'), mp = []; for (let i = 0; i < mast.positions.length; i += 3) mp.push([mast.positions[i], mast.positions[i + 1], mast.positions[i + 2]]);
  const mtop = Math.max(...mp.map((p) => p[1])), heads = mp.filter((p) => p[1] > mtop - 1e-4);
  const ax = [heads.reduce((a, p) => a + p[0], 0) / heads.length, heads.reduce((a, p) => a + p[2], 0) / heads.length];
  ring.sort((p, q) => Math.atan2(p[2] - ax[1], p[0] - ax[0]) - Math.atan2(q[2] - ax[1], q[0] - ax[0]));
  const inRing = (x, z) => ring.every((p, i) => { const q = ring[(i + 1) % ring.length]; return (q[0] - p[0]) * (z - p[2]) - (q[2] - p[2]) * (x - p[0]) > 0; });
  let looks = 0;
  for (const eye of [[3, 7, 2], [-3, 7, -3], [0.5, 12, 4], [2, 15, -2], [-1, 16.5, 1], [0.8, 17.5, 0.4], [-0.6, 17.2, -0.9]]) {
    for (let a = 0; a < 360; a += 10) for (const r of [0.45, 0.52, 0.58, 0.62]) {
      const t = [ax[0] + r * Math.cos((a * Math.PI) / 180), low + 0.01, ax[1] + r * Math.sin((a * Math.PI) / 180)];
      if (!inRing(t[0], t[2])) continue;
      const d = sub(t, eye), L = Math.hypot(...d), u = d.map((v) => v / L);
      let best = null;
      for (const tr of tris) {
        const h = rayTri(eye, u, tr);
        if (h == null) continue;
        const front = dot(cross(sub(tr[1], tr[0]), sub(tr[2], tr[0])), u) < 0;
        if (!best || h < best.h - 1e-7 || (Math.abs(h - best.h) <= 1e-7 && front && !best.front)) best = { h, front };
      }
      looks++;
      assert.ok(best && best.front, `from ${eye} up through the ring at ${t.map((v) => v.toFixed(2))}: ${best ? 'a culled back' : 'the sky'}`);
    }
  }
  assert.ok(looks > 300, `the looks up (${looks})`);
  // the masthead closed: every edge round its top ring two faces' (it stood open, a hollow prism's end)
  const mm = meshOf(nodeNamed(root, 'MainMast')), key = (p) => p.map((v) => v.toFixed(4)).join(','), edges = new Map();
  for (const tr of trianglesIn(mm, IDENTITY)) for (let e = 0; e < 3; e++) {
    const a = tr[e], b = tr[(e + 1) % 3];
    if (a[1] < mtop - 1e-4 || b[1] < mtop - 1e-4) continue;
    const k = [key(a), key(b)].sort().join('|');
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  assert.ok(edges.size >= 5, `the masthead's ring (${edges.size} edges)`);
  assert.deepEqual([...edges].filter(([, n]) => n !== 2), [], 'the masthead\'s ring: an edge with one face, open to the sky');
});

// ── R8/R11: the throats ────────────────────────────────────────────────────────────────────────────────────────────

/** A picture's wrap edge against its own: the mean colour step across each column (L-R) or row (T-B) boundary, the
 *  last the wrap's. */
function edgeSteps(p, horiz) {
  const px = (x, y) => { const i = (y * p.width + x) * 4; return [p.data[i], p.data[i + 1], p.data[i + 2]]; };
  const N = horiz ? p.width : p.height, Mx = horiz ? p.height : p.width, out = [];
  for (let k = 0; k < N; k++) {
    let s = 0;
    for (let m = 0; m < Mx; m++) { const a = horiz ? px(k, m) : px(m, k), b = horiz ? px((k + 1) % p.width, m) : px(m, (k + 1) % p.height); s += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }
    out.push(s / Mx);
  }
  return out;
}

test('AUDIT GALLEON R8/R11: her gunports\' throats - sill, lintel and cheeks - wear their own tiling planks (record 16, TEX.dark) at 3.1 cm a texel, a picture that tiles both ways with no edge at its wrap stronger than its own; nothing wears the shutters\' whole-face picture but the shutters (the throats wore it tiled every metre - 17.5% iron straps, 5.9% black border - and record 16, worn by nothing, never tiled)', () => {
  const h = part('hull'), P = h.positions;
  let throats = 0;
  h.polygons.forEach((poly) => {
    const ring = poly.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const n = norm(newell(ring)), c = [0, 1, 2].map((d) => ring.reduce((a, p) => a + p[d], 0) / ring.length);
    if (!(c[1] > 1.4 && c[1] < 3.1 && Math.abs(c[0]) > 4.9 && Math.abs(c[0]) < 6.1 && Math.abs(n[0]) < 0.3)) return;
    throats++;
    assert.equal(GM.faceSkin('hull', n, c).rec, TEX.dark, `a throat face at ${c.map((v) => v.toFixed(2))}`);
  });
  assert.equal(throats, 40, 'ten ports\' throats, four faces each');
  for (const key of Object.keys(MODELS.meshes).filter((k) => MODELS.meshes[k].galleon && !k.endsWith(':collider'))) {
    const recs = (MODELS.geometry(key).slots ?? []).map((s) => s.record);
    if (recs.includes(TEX.lid)) assert.match(key, /^galleon:gunportLid(Port)?\d$/, `${key} wears the shutters' picture`);
  }
  assert.ok(MODELS.geometry('galleon:hull').slots.some((s) => s.record === TEX.dark), 'her hull draws the throats\' planks');
  const tile = GA.GALLEON_TILE.dark;
  // its planks' seams fall evenly all round, across its wrap too (a row's mean under halfway from the darkest to the
  // median a seam): one plank's height between every two, the picture's 64 rows a whole number of planks
  {
    const art0 = new Map(GA.galleonArt()).get(TEX.dark), m = [];
    for (let y = 0; y < art0.height; y++) { let sum = 0; for (let x = 0; x < art0.width; x++) { const i = (y * art0.width + x) * 4; sum += 0.3 * art0.data[i] + 0.59 * art0.data[i + 1] + 0.11 * art0.data[i + 2]; } m.push(sum / art0.width); }
    const sorted = [...m].sort((a, b) => a - b), cut = (sorted[0] + sorted[art0.height >> 1]) / 2;
    const seams = m.flatMap((v, y) => (v < cut ? [y] : [])), gaps = seams.map((y, i) => (seams[(i + 1) % seams.length] - y + art0.height) % art0.height);
    assert.ok(seams.length >= 4 && gaps.every((g) => g === gaps[0]), `its planks' seams at rows ${seams.join(',')}`);
  }
  assert.ok(tile[0] / 64 > 0.025 && tile[0] / 64 < 0.035 && tile[1] === tile[0], `a texel of ${((tile[0] / 64) * 100).toFixed(2)} cm`);
  const art = new Map(GA.galleonArt()), dark = art.get(TEX.dark);
  assert.deepEqual([dark.width, dark.height], [64, 64]);
  for (const horiz of [true, false]) {
    const steps = edgeSteps(dark, horiz), wrap = steps[steps.length - 1], inner = steps.slice(0, -1);
    assert.ok(wrap <= Math.max(...inner), `${horiz ? 'left-right' : 'top-bottom'}: the wrap's step ${wrap.toFixed(1)} no stronger than its own strongest ${Math.max(...inner).toFixed(1)}`);
  }
});

// ── R12: her texels ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON R12: her art\'s comment says her texels as she wears them - each figure the median, over its area, of the texel along u and v of every triangle she draws in that picture (her planking 3.1 cm square, her bottom 3.1 by 3.5, her side 4.4 by 4.5, her castle 4.1 by 5.2, her stern 4.3-4.4 by 5.2, her spars 3.1-3.3 along and 0.8-3.3 round, gilt and gratings 1.6, rope 0.2-0.4 round and 0.8 along, canvas 8-19 by 5-25, a shutter 1.4 by 2.4, a door 2.4 by 4.0) - and no longer says "3 to 5 cm", "square-pixelled", tiles stretched to keep the texel, or the canvas, the shutters and the door among the tiling pictures', () => {
  const src = readFileSync(new URL('../src/world/galleonArt.js', import.meta.url), 'utf8');
  for (const lie of [/a texel is 3 to 5 cm/, /Square-pixelled/i, /their tiles stretched to keep the texel/, /so a texel is the size it was\.\s*\*\//, /canvas, rope, gilt, the hatches' gratings, the\s*\/\/\s*gunport lids' red, a planked door/]) assert.doesNotMatch(src, lie);
  // each triangle's texel along u and v (cm: the metres a unit of u or v spans, over 64), with its area
  const S = [];
  for (const key of Object.keys(MODELS.meshes).filter((k) => MODELS.meshes[k].galleon && !k.endsWith(':collider'))) {
    const g = MODELS.geometry(key);
    g.subMeshes.forEach((sm, k) => {
      // a sail's and a running rope's picture is its renderer's (galleonRig.js: canvas, rope), not a slot of the mesh
      const rec = g.slots?.[k]?.record ?? (/^galleon:sail:/.test(key) ? TEX.canvas : /^galleon:rope:/.test(key) ? TEX.rope : null);
      if (rec == null) return;
      for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
        const ix = [0, 1, 2].map((j) => g.indices[t + j]);
        const Pp = ix.map((i) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]]), U = ix.map((i) => [g.uvs[i * 2], g.uvs[i * 2 + 1]]);
        const e1 = sub(Pp[1], Pp[0]), e2 = sub(Pp[2], Pp[0]);
        const du1 = U[1][0] - U[0][0], dv1 = U[1][1] - U[0][1], du2 = U[2][0] - U[0][0], dv2 = U[2][1] - U[0][1], det = du1 * dv2 - du2 * dv1;
        if (Math.abs(det) < 1e-12) continue;
        const u = Math.hypot(...e1.map((v, d) => (v * dv2 - e2[d] * dv1) / det)) / 0.64, v = Math.hypot(...e1.map((x, d) => (-x * du2 + e2[d] * du1) / det)) / 0.64;
        S.push({ rec, key, u, v, w: Math.hypot(...cross(e1, e2)) / 2 });
      }
    });
  }
  const median = (f, d) => { const l = S.filter(f).sort((a, b) => a[d] - b[d]), tot = l.reduce((a, x) => a + x.w, 0); let acc = 0; for (const x of l) { acc += x.w; if (acc >= tot / 2) return x[d]; } return NaN; };
  const recs = (...r) => (x) => r.includes(x.rec), mesh = (rec, key) => (x) => x.rec === rec && x.key === `galleon:${key}`;
  /** A figure the comment gives: what it was measured over, along u or v, and the figure to its last place. */
  const says = (what, f, d, fig, place = 0.05) => { const m = median(f, d); assert.ok(Math.abs(m - fig) <= place + 1e-9, `${what} ${d}: ${m.toFixed(3)} cm where the comment says ${fig}`); };
  /** A range the comment gives: each mesh's median, the least and the most its ends. */
  const spans = (what, rec, d, lo, hi, place = 0.05) => {
    const ms = [...new Set(S.filter(recs(rec)).map((x) => x.key))].map((k) => median((x) => x.rec === rec && x.key === k, d));
    assert.ok(Math.abs(Math.min(...ms) - lo) <= place && Math.abs(Math.max(...ms) - hi) <= place, `${what} ${d}: ${Math.min(...ms).toFixed(3)}-${Math.max(...ms).toFixed(3)} cm where the comment says ${lo}-${hi}`);
  };
  for (const d of ['u', 'v']) says('her planking', recs(TEX.deck, TEX.hullInner, TEX.beams, TEX.underDeck, TEX.dark, TEX.trim), d, 3.1);
  says('her bottom', mesh(TEX.hullBottom, 'hull'), 'u', 3.1); says('her bottom', mesh(TEX.hullBottom, 'hull'), 'v', 3.5);
  says('her side', recs(TEX.hullSide0, TEX.hullSide1, TEX.hullSide2), 'u', 4.4); says('her side', recs(TEX.hullSide0, TEX.hullSide1, TEX.hullSide2), 'v', 4.5);
  says('her side\'s lowest slice', recs(TEX.hullSide3), 'u', 5.1); says('her side\'s lowest slice', recs(TEX.hullSide3), 'v', 4.6);
  says('her castle', recs(TEX.castle0, TEX.castle1), 'u', 4.1); says('her castle', recs(TEX.castle0, TEX.castle1), 'v', 5.2);
  says('her stern\'s upper slice', recs(TEX.sternWindows0), 'u', 4.4); says('her stern\'s lower slice', recs(TEX.sternWindows1), 'u', 4.3); says('her stern', recs(TEX.sternWindows0, TEX.sternWindows1), 'v', 5.2);
  spans('her spars along', TEX.spar, 'v', 3.1, 3.3); spans('her spars round', TEX.spar, 'u', 0.8, 3.3);
  says('a yard round', mesh(TEX.spar, 'yard:ForeCourse'), 'u', 1.6); says('the gaff round', mesh(TEX.spar, 'gaff'), 'u', 1.2);
  for (const d of ['u', 'v']) { says('her gilt', recs(TEX.gilt), d, 1.6); says('her gratings', recs(TEX.grate), d, 1.6); }
  says('a gun\'s barrel along', mesh(TEX.iron, 'gun'), 'v', 1.6); says('a gun\'s barrel round', mesh(TEX.iron, 'gun'), 'u', 1.3);
  spans('her rope round', TEX.rope, 'u', 0.2, 0.4); says('her rope along', recs(TEX.rope), 'v', 0.8);
  spans('her canvas across', TEX.canvas, 'u', 8, 19, 0.5); spans('her canvas up', TEX.canvas, 'v', 5, 25, 0.5);
  says('the fore course', mesh(TEX.canvas, 'sail:ForeCourse'), 'u', 18.6); says('the fore course', mesh(TEX.canvas, 'sail:ForeCourse'), 'v', 6.8);
  says('the jib', mesh(TEX.canvas, 'sail:Jib'), 'u', 8.0); says('the jib', mesh(TEX.canvas, 'sail:Jib'), 'v', 25.3);
  says('a shutter', recs(TEX.lid), 'u', 1.4); says('a shutter', recs(TEX.lid), 'v', 2.4);
  says('a door', recs(TEX.door), 'u', 2.4); says('a door', recs(TEX.door), 'v', 4.0);
  // and the comment says those figures
  const header = src.slice(src.indexOf('AUDIT GN-R12'), src.indexOf('THE LIVERY IS'));
  for (const fig of ['3.1 cm a texel square', 'her bottom 3.1 by 3.5', 'her side 4.4 cm along her by 4.5 up', 'lowest slice 5.1 by 4.6', 'her castle 4.1 by 5.2', 'her stern 4.3-4.4 by 5.2', '3.1-3.3 cm', '0.8-3.3 round', 'a yard 1.6 cm, the gaff 1.2', '(1.6 cm)', '(1.3 round it)', '0.2-0.4 cm round', '0.8 along', '8-19 cm across and 5-25 up', '18.6 by 6.8', '8.0 by 25.3', 'a shutter\'s face 1.4 by 2.4', 'a door\'s 2.4 by 4.0']) {
    assert.ok(header.replace(/\s*\/\/\s*/g, ' ').includes(fig), `the comment says "${fig}"`);
  }
});

// ── R14: T-junctions ───────────────────────────────────────────────────────────────────────────────────────────────

/** A mesh's T-junctions: a corner of it lying inside one of its edges (2e-5 m). */
function tJunctions(g) {
  const P = g.positions, I = g.indices, V = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const verts = new Map();
  for (let i = 0; i < g.vertexCount; i++) { const v = V(i); verts.set(v.map((x) => x.toFixed(5)).join(','), v); }
  const vs = [...verts.values()], edges = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = V(I[t + k]), b = V(I[t + (k + 1) % 3]), ka = a.map((x) => x.toFixed(5)).join(','), kb = b.map((x) => x.toFixed(5)).join(',');
    edges.set(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`, [a, b]);
  }
  const found = [];
  for (const [, [a, b]] of edges) {
    const d = sub(b, a), L2 = dot(d, d);
    if (L2 < 1e-12) continue;
    for (const v of vs) {
      if (v.some((x, k) => x < Math.min(a[k], b[k]) - 1e-4 || x > Math.max(a[k], b[k]) + 1e-4)) continue;
      const t = dot(sub(v, a), d) / L2;
      if (t <= 1e-6 || t >= 1 - 1e-6) continue;
      if (Math.hypot(...sub([a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], v)) < 2e-5) found.push(v);
    }
  }
  return found;
}

test('AUDIT GALLEON R14: her hull and her castle as drawn have no T-junction - every face of a part that wears a livery is cut at the livery\'s slice heights, banded or not, and the bake\'s own corners on another face\'s edge are split in (20 stood on her hull at 1.600 on every gunport\'s outer cheek edges, 8 on her castle at 9.000 by the wells; the bake\'s own besides, 12 on her hull at her ports\' sill and lintel corners and 1 in her castle)', () => {
  for (const key of ['galleon:hull', 'galleon:castle', 'galleon:castleRail', 'galleon:castleParapet']) {
    const found = tJunctions(MODELS.geometry(key));
    assert.deepEqual(found.map((v) => v.map((x) => x.toFixed(3)).join(',')), [], `${key}: T-junctions`);
  }
  // and the cuts are where the slices are: every triangle a livery's slice wears lies within that slice's heights (the
  // outer two take what lies past the band's ends), so a band runs round her as one
  let worn = 0;
  for (const [key, band] of [['galleon:hull', GA.BANDS.hullSide], ['galleon:castle', GA.BANDS.castle], ['galleon:castle', GA.BANDS.sternWindows], ['galleon:castleRail', GA.BANDS.castle], ['galleon:castleParapet', GA.BANDS.castle]]) {
    const g = MODELS.geometry(key), S = band.recs.length, h = (band.y1 - band.y0) / S;
    band.recs.forEach((rec, k) => {
      const at = g.slots.findIndex((sl) => sl.record === rec);
      if (at < 0) return;
      const top = k === 0 ? Infinity : band.y1 - k * h, foot = k === S - 1 ? -Infinity : band.y1 - (k + 1) * h;
      for (const tr of trianglesIn(g, IDENTITY, g.subMeshes[at])) {
        worn++;
        assert.ok(tr.every((p) => p[1] <= top + 1e-4 && p[1] >= foot - 1e-4), `${key}: a triangle of slice ${rec} from ${Math.min(...tr.map((p) => p[1])).toFixed(3)} to ${Math.max(...tr.map((p) => p[1])).toFixed(3)}, past its heights ${foot.toFixed(3)}..${top.toFixed(3)}`);
      }
    });
  }
  assert.ok(worn > 400, `her liveries' triangles (${worn})`);
});

// ── B1: lit as Blender draws her ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON B1: every baked part is lit polygon by polygon - each triangle\'s three normals its polygon\'s own (Newell) normal, so a non-planar n-gon shades flat as Blender draws it (each triangle lit by its own normal shaded Mac\'s n-gons - her hull\'s up to 0.40 m out of their planes - as creases)', () => {
  let checked = 0, bent = 0;
  for (const p of BAKE.parts) {
    const P = p.positions;
    const normals = p.polygons.map((poly) => norm(newell(poly.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]))));
    const g = GM.bakedPartGeometry(p);
    for (let t = 0; t < g.indices.length; t += 3) {
      const n = [0, 1, 2].map((k) => [g.normals[g.indices[t + k] * 3], g.normals[g.indices[t + k] * 3 + 1], g.normals[g.indices[t + k] * 3 + 2]]);
      const best = Math.min(...normals.map((m) => Math.hypot(...sub(m, n[0]))));
      assert.ok(best < 1e-5, `${p.object} (${p.role}): a triangle lit off every polygon's normal (${best.toExponential(2)})`);
      assert.ok(n.every((m) => Math.hypot(...sub(m, n[0])) < 1e-6), `${p.object}: one normal a triangle`);
      const a = [0, 1, 2].map((k) => [g.positions[g.indices[t + k] * 3], g.positions[g.indices[t + k] * 3 + 1], g.positions[g.indices[t + k] * 3 + 2]]);
      const own = norm(cross(sub(a[1], a[0]), sub(a[2], a[0])));
      if (Math.hypot(...sub(own, n[0])) > 0.05) bent++;
      checked++;
    }
  }
  assert.ok(checked > 1000 && bent > 20, `her triangles (${checked}), those of her bent polygons lit flat with them (${bent})`);
});

// ── the nits ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON NITS: her measurements the module comment calls pinned are pinned to the final bake (to 1 mm, the beams\' tolerance) - her gun deck, her castle\'s front and aft, her gangway, both doorways, her sternpost, and AUDIT GN\'s own (her side\'s knuckle, her rail\'s cap, a hatch cover\'s foot) - and three comments that were false say what is true: the collider welding (closes nothing), the castle\'s dead "stairwells\' cut" rule (gone), the ramp\'s 4 cm (2.3)', () => {
  const pts = (role) => { const p = part(role), o = []; for (let i = 0; i < p.positions.length; i += 3) o.push([p.positions[i], p.positions[i + 1], p.positions[i + 2]]); return o; };
  const ext = (role, d, f = Math.max) => f(...pts(role).map((q) => q[d]));
  near(M.gunDeckY, ext('gunDeck', 1), 1e-3, 'gunDeckY: the gun deck\'s top');
  near(M.castleFrontZ, ext('castle', 2), 1e-3, 'castleFrontZ: the castle\'s fore face');
  near(M.castleAftZ, ext('castle', 2, Math.min), 1e-3, 'castleAftZ: the castle\'s aftmost');
  // the castle's front wall and its doorway: the faces at the doorway's jambs (|x| under 0.85, square to x)
  const c = part('castle'), cP = c.positions;
  const faces = c.polygons.map((poly) => { const ring = poly.map((i) => [cP[i * 3], cP[i * 3 + 1], cP[i * 3 + 2]]); return { ring, n: norm(newell(ring)) }; });
  const jambs = faces.filter((f) => Math.abs(f.n[0]) > 0.99 && f.ring.every((q) => Math.abs(q[0]) < 0.85));
  const jy = jambs.flatMap((f) => f.ring.map((q) => q[1])), jz = jambs.flatMap((f) => f.ring.map((q) => q[2]));
  near(M.castleDoor.halfX, Math.max(...jambs.flatMap((f) => f.ring.map((q) => Math.abs(q[0])))), 1e-3, 'castleDoor.halfX');
  near(M.castleDoor.y1, Math.max(...jy), 1e-3, 'castleDoor.y1: the doorway\'s head');
  near(M.castleDoor.y0, Math.min(...jambs.filter((f) => Math.max(...f.ring.map((q) => q[1])) > M.castleDoor.y1 - 1e-3).flatMap((f) => f.ring.map((q) => q[1]))), 1e-3, 'castleDoor.y0: the foot of the jambs that reach its head');
  near(M.castleFrontInnerZ, Math.min(...jz), 1e-3, 'castleFrontInnerZ: the front wall\'s inner face');
  near(M.castleDoor.z, (Math.min(...jz) + Math.max(...jz)) / 2, 1e-3, 'castleDoor.z: the front wall\'s middle');
  const b = pts('bulkhead'), bj = b.filter((q) => Math.abs(q[0]) < 1);
  near(M.bulkheadDoor.halfX, Math.max(...bj.map((q) => Math.abs(q[0]))), 1e-3, 'bulkheadDoor.halfX');
  near(M.bulkheadDoor.y1, Math.max(...bj.map((q) => q[1])), 1e-3, 'bulkheadDoor.y1: its doorway\'s head');
  near(M.bulkheadDoor.y0, M.gunDeckY, 1e-9, 'bulkheadDoor.y0: on the gun deck');
  near(M.bulkheadDoor.z, (Math.min(...b.map((q) => q[2])) + Math.max(...b.map((q) => q[2]))) / 2, 1e-3, 'bulkheadDoor.z: the bulkhead\'s middle');
  const h = pts('hull'), sill = h.filter((q) => Math.abs(q[1] - M.gangway.sillY) < 0.01 && Math.abs(q[0]) > 5);
  near(M.gangway.sillY, Math.max(...sill.map((q) => q[1])), 1e-3, 'gangway.sillY');
  near(M.gangway.z0, Math.min(...sill.map((q) => q[2])), 1e-3, 'gangway.z0');
  near(M.gangway.z1, Math.max(...sill.map((q) => q[2])), 1e-3, 'gangway.z1');
  near(M.rudderPivotZ, Math.min(...h.filter((q) => Math.abs(q[0]) < 1e-4 && q[1] > -3.5 && q[1] < M.knuckleY + 1e-3).map((q) => q[2])), 1e-3, 'rudderPivotZ: her sternpost, keel to knuckle');
  near(M.knuckleY, Math.max(...h.filter((q) => Math.abs(q[0]) > 5.85).map((q) => q[1])), 1e-3, 'knuckleY: her widest corners');
  near(M.railCapY, ext('castleRail', 1), 1e-3, 'railCapY');
  near(M.hatchCoverUnderY, ext('hatchFore', 1, Math.min), 1e-3, 'hatchCoverUnderY');
  const mesh = readFileSync(new URL('../src/world/galleonMesh.js', import.meta.url), 'utf8'), model = readFileSync(new URL('../src/world/galleonModel.js', import.meta.url), 'utf8');
  assert.doesNotMatch(mesh, /so the collider's mesh is a closed one/);
  assert.doesNotMatch(model, /return tiled\(TEX\.trim\);\s*\/\/ the stairwells' cut/);
  assert.doesNotMatch(model, /the ramp rose 4 cm through the top tread/);
});
