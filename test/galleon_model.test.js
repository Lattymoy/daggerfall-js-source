// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame gallon model. The doors/hatches should open
// and close and we will need to give this a proper texture, along with a wheel at the helm, the sails and ropes, amd
// ensuring cannon fire shoots from the cannon holes properly") - the new galleon held to her model: the bake to the
// bytes, her parts facing out, her guns firing from her ports, her shutters, hatches and doors, her helm, her rig, her
// pictures, the loader's fallback, and HULL_BUILDS' Small Ship measured off her.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeGalleon, galleonJson, toBoat, SOURCE_FBX, OUT, FRAME, ROLES } from '../tools/bakeGalleon.mjs';
import {
  galleonPrefab, GALLEON_PREFAB_ID, GALLEON_HULL_NODE, MEASURED, HELM, GUN, GALLEON_BATTERIES, HATCH_OPEN_DEG, LID_OPEN_DEG,
  WHEEL_TURNS, RUDDER_DEG, faceSkin, companionGeometry, DRIVE_TRIGGER_AT,
} from '../src/world/galleonModel.js';
import { SAILS } from '../src/world/galleonRig.js';
import {
  galleonArt, galleonGlow, registerGalleonArt, _resetGalleonArt, GALLEON_ARCHIVE, TEX, BANDS, GALLEON_TEX_SIZE,
  hullSideLivery, castleLivery, sternWindowsLivery,
} from '../src/world/galleonArt.js';
import { newell, norm } from '../src/world/galleonMesh.js';
import { createGalleonGunDeck, recoilAt, HOLD_S, RUN_IN_X, RUN_OUT_X, RECOIL, KICK_S, HAUL_S } from '../src/systems/naval/galleonGunDeck.js';
import { loadComeSailAwayModels, CSA_MODEL_URLS, GALLEON_MODEL_URL } from '../src/systems/comeSailAwayModels.js';
import { animatorOf, colliderBounds } from '../src/systems/comeSailAwayBoat.js';
import { HULL, hullBuild } from '../src/systems/naval/navalShips.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { scene, MODELS } from './csaScene.mjs';
import { sea } from './navalSea.mjs';

const bakeJson = JSON.parse(readFileSync(new URL(`../${OUT}`, import.meta.url), 'utf8'));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
/** Whether two rotations are one (q and -q alike). */
const sameTurn = (q, r, eps = 1e-4) => Math.abs(Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]) - 1) < eps;
/** A Small Ship placed by the runtime, and the scene she stands in. */
const placed = () => { const s = scene(); const boat = s.place(HULL.SmallShip, 0); return { s, boat }; };
const nodeNamed = (boat, name) => [...boat.GameObject.walk()].find((n) => n.name === name) ?? null;
/** Möller-Trumbore: the distance along a ray to a triangle, or null. */
function rayTri(o, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const t0 = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) / det;
  if (u < 0 || u > 1) return null;
  const q = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  return t > 0 ? t : null;
}
/** The nearest of a mesh's triangles a ray meets within `max` (her frame), or null. */
function rayMesh(g, o, d, max) {
  let best = null;
  const P = g.positions, I = g.indices;
  for (let t = 0; t < I.length; t += 3) {
    const v = (i) => [P[I[t + i] * 3], P[I[t + i] * 3 + 1], P[I[t + i] * 3 + 2]];
    const h = rayTri(o, d, v(0), v(1), v(2));
    if (h != null && h <= max && (best == null || h < best)) best = h;
  }
  return best;
}

// ── the bake ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE BAKE: Mac\'s export baked to the boat\'s frame is the file committed, byte for byte - every role at the place it was read at, the rudder\'s five faces split off the hull, her six deck beams (GALLEON-2), the scene\'s other stations and her parts\' twins in their places skipped, the source\'s hash and frame carried, her centreline taken off (mutants: a role misplaced, the rudder kept on the hull, the frame unread, the centreline unread, a twin baked)', () => {
  const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
  const baked = bakeGalleon(bytes);
  assert.equal(galleonJson(baked), readFileSync(new URL(`../${OUT}`, import.meta.url), 'utf8'), 'tools/bakeGalleon.mjs re-makes galleon.json to the byte');
  assert.equal(baked.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(baked.frame, { ...FRAME });
  const roles = baked.parts.map((p) => p.role);
  assert.deepEqual([...roles].sort(), [...Object.values(ROLES).map((r) => r.role), 'rudder'].sort(), 'every role once, and her rudder');
  assert.equal(baked.parts.find((p) => p.role === 'rudder').polygons.length, 5, 'the rudder\'s five faces');
  assert.equal(roles.filter((r) => r === 'deckBeam').length, 6, 'GALLEON-2: her six deck beams, each once (their twins skipped)');
  // the frame: Blender's scene (Z up, the stem to -Y) into the boat's (Y up, +Z the bow, +X starboard), 0.7 of it, the
  // waterline, the midship and (GALLEON-2) her centreline taken off
  assert.deepEqual(toBoat([FRAME.midship, FRAME.centreline, FRAME.waterline]), [0, 0, 0]);
  toBoat([FRAME.midship + 10, FRAME.centreline - 1, FRAME.waterline + 2]).forEach((v, k) => near(v, [0.7, 1.4, 7][k], 1e-9, `axis ${k}`));
  // her hull square on her keel line: her beam either side of it alike, to the bake's tenth of a millimetre
  const hull = baked.parts.find((p) => p.role === 'hull').positions;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < hull.length; i += 3) { lo = Math.min(lo, hull[i]); hi = Math.max(hi, hull[i]); }
  near(lo, -hi, 1e-4, 'her half beam to port and to starboard');
});

test('GALLEON HER PARTS FACE OUT: every baked part, the hull\'s planking to the crow\'s nest, winds its faces outward (the front face Unity draws) - a positive volume each, her closed hatch covers and her shutter shut fast; GALLEON-2: her deck beams, open-topped and open-ended (their heads in the deck), each face from the beam\'s middle (mutants: the winding flipped)', () => {
  for (const p of bakeJson.parts) {
    const P = p.positions, T = p.triangles;
    if (p.role === 'deckBeam') {
      // an open timber has no volume to sign: each face looks away from its middle instead
      const mid = [0, 1, 2].map((k) => { let a = Infinity, b = -Infinity; for (let i = k; i < P.length; i += 3) { a = Math.min(a, P[i]); b = Math.max(b, P[i]); } return (a + b) / 2; });
      assert.equal(p.polygons.length, 3, `${p.object}: two sides and a foot`);
      for (let t = 0; t < T.length; t += 3) {
        const v = (j) => [P[T[t + j] * 3], P[T[t + j] * 3 + 1], P[T[t + j] * 3 + 2]];
        const [a, b, c] = [v(0), v(1), v(2)];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        // the bake's winding, as every closed part's (whose volume it signs positive): e1 x e2 out of its front
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const out = [(a[0] + b[0] + c[0]) / 3 - mid[0], (a[1] + b[1] + c[1]) / 3 - mid[1], (a[2] + b[2] + c[2]) / 3 - mid[2]];
        assert.ok(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] > 0, `${p.object}: a face looks out of the beam`);
      }
      continue;
    }
    let vol = 0;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    }
    assert.ok(vol > 0, `${p.role}: faces out (${vol.toFixed(3)})`);
  }
});

test('GALLEON-2 HER DECK BEAMS (Mac\'s second export): six beams under her main deck as MEASURED reads them off the bake - each 0.775 m fore and aft, inside her ceiling, its foot 5.22 m over the sea and its head in the deck; none through a hatchway or a mast; drawn as one node in her oak, solid; her gun deck\'s three lanterns hung from three of them; each companion clear under them, a man\'s height over every tread (mutants: a beam misread, a lantern off its beam, the beams unsolid)', () => {
  const span = (p, k) => { let a = Infinity, b = -Infinity; for (let i = k; i < p.positions.length; i += 3) { a = Math.min(a, p.positions[i]); b = Math.max(b, p.positions[i]); } return [a, b]; };
  const beams = bakeJson.parts.filter((p) => p.role === 'deckBeam').map((p) => ({ x: span(p, 0), y: span(p, 1), z: span(p, 2) })).sort((a, b) => a.z[0] - b.z[0]);
  const B = MEASURED.beams;
  assert.equal(beams.length, 6);
  beams.forEach((b, i) => {
    near((b.z[0] + b.z[1]) / 2, B.z[i], 1e-3, `beam ${i}'s middle`);
    near((b.z[1] - b.z[0]) / 2, B.halfZ, 1e-3, `beam ${i}'s half`);
    near(b.y[0], B.underY, 1e-3, `beam ${i}'s foot`);
    near(b.x[1], B.halfX, 1e-3, `beam ${i}'s end`);
    assert.ok(b.x[1] < MEASURED.hullInnerX && b.y[1] > MEASURED.mainDeckUnderY, `beam ${i}: inside her ceiling, its head in her deck`);
    for (const h of [MEASURED.hatchAft, MEASURED.hatchFore]) assert.ok(b.z[1] < h.z0 || b.z[0] > h.z1, `beam ${i}: clear of a hatchway`);
    for (const role of ['mainMast', 'foreMast']) {
      const m = span(bakeJson.parts.find((p) => p.role === role), 2);
      assert.ok(b.z[1] < m[0] || b.z[0] > m[1], `beam ${i}: clear of her ${role}`);
    }
  });
  // drawn and solid, one node
  const tree = MODELS.prefab(GALLEON_PREFAB_ID);
  const find = (n, name) => (n.name === name ? n : n.children.reduce((f, c) => f ?? find(c, name), null));
  const node = find(tree, 'DeckBeams');
  const comps = node.components.map((i) => MODELS.components[i]);
  const filter = comps.find((c) => c.type === 'MeshFilter'), collider = comps.find((c) => c.type === 'MeshCollider');
  assert.ok(collider?.m_Enabled && !collider.m_IsTrigger, 'solid');
  const g = MODELS.geometry(filter.m_Mesh.mesh);
  assert.deepEqual(g.slots.map((x) => x.record), [TEX.trim], 'her oak');
  assert.equal(g.indices.length / 3, 36, 'six beams of two sides and a foot');
  assert.equal(faceSkin('mainDeck', [0, -1, 0], [0, MEASURED.mainDeckUnderY, 0]).rec, TEX.underDeck, 'the deck over them its planks alone - the beams are Mac\'s now');
  assert.equal(faceSkin('castle', [0, -1, 0], [0, MEASURED.castleCeilingY, -15]).rec, TEX.beams, 'the great cabin\'s ceiling, with none of his over it, keeps its painted beams');
  // the lanterns over her gun deck hang from beams
  const lanterns = [];
  const walk = (n) => { if (/^LanternHanging/.test(n.name) && n.position[1] < MEASURED.mainDeckY) lanterns.push(n); n.children.forEach(walk); };
  walk(tree);
  assert.equal(lanterns.length, 3, 'three lanterns over her guns');
  for (const l of lanterns) {
    assert.ok(B.z.some((z) => Math.abs(z - l.position[2]) < 1e-9), `a lantern at ${l.position[2]} under a beam`);
    near(l.position[1], B.underY - 0.01, 1e-9, 'hung from its foot');
  }
  // the companions: a man (1.8 m) on any tread under a beam stands clear of it
  for (const hatch of [MEASURED.hatchAft, MEASURED.hatchFore]) {
    const c = companionGeometry(hatch.z1, -1);
    for (const b of beams) for (let z = b.z[0]; z <= b.z[1]; z += 0.05) {
      if (z < c.bottomZ || z > hatch.z1) continue;
      const tread = MEASURED.mainDeckY - (Math.floor((hatch.z1 - z) / c.run) + 1) * c.rise;
      assert.ok(tread + 1.8 < B.underY, `the companion under a beam at ${z.toFixed(2)}: a tread at ${tread.toFixed(2)}`);
    }
  }
});

// ── the guns ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE GUNS FIRE FROM HER PORTS: five guns a side, each muzzle at its port\'s middle a hair outside her planking - its line in from the muzzle meets none of her hull through the port and her planking a port\'s width aside; each gun run out reaches it, run in stands clear of the shutter; her chasers over her bow rail and her barrels over her stern, all as HULL_BUILDS reads them (mutants: a muzzle off its port, inside her planking, the battery not hers)', () => {
  const b = hullBuild(HULL.SmallShip);
  assert.deepEqual(b.broadside.map((m) => [...m]), GALLEON_BATTERIES.broadside.map((m) => [...m]), 'HULL_BUILDS\' Small Ship broadside is her ports\'');
  assert.deepEqual(b.bow.muzzles.map((m) => [...m]), GALLEON_BATTERIES.bow.map((m) => [...m]));
  assert.deepEqual(b.stern.muzzles.map((m) => [...m]), GALLEON_BATTERIES.stern.map((m) => [...m]));
  assert.equal(b.broadside.length, 5);
  const hull = MODELS.geometry('galleon:hull:collider');
  b.broadside.forEach((m, i) => {
    near(m[2], MEASURED.portZ[i], 1e-9, `gun ${i} at its port`);
    assert.ok(m[1] > MEASURED.portSillY + 0.3 && m[1] < MEASURED.portTopY - 0.3, `gun ${i}: between the sill and the lintel (${m[1]})`);
    assert.ok(m[0] > MEASURED.hullOuterX && m[0] < MEASURED.hullOuterX + 0.2, `gun ${i}: a hair outside her planking (${m[0]})`);
    // the ball's way out: from inside her (the gun deck, a metre in) to the muzzle, through the port - and the same
    // line a port's width aside meets her planking
    for (const [s, z] of [[1, m[2]], [-1, m[2]]]) {
      const from = [s * (MEASURED.hullInnerX - 1), m[1], z], dir = [s, 0, 0];
      assert.equal(rayMesh(hull, from, dir, Math.abs(m[0] - from[0]) + 0.01), null, `gun ${i} ${s > 0 ? 'starboard' : 'port'}: out through the port`);
      const aside = [from[0], m[1], z + MEASURED.portHalfW + 0.25];
      assert.ok(rayMesh(hull, aside, dir, 3) != null, `gun ${i}: her planking beside the port`);
    }
    near(GUN.runOutX + GUN.muzzleX, m[0], 0.05, `gun ${i} run out: its muzzle at the ball's`);
    assert.ok(GUN.runInX + GUN.muzzleX < MEASURED.hullOuterX - 0.05, `gun ${i} run in: clear of the shutter`);
  });
  for (const m of b.bow.muzzles) assert.ok(m[2] < b.bowZ && m[1] > MEASURED.railY, 'a chaser over her bow rail');
  for (const m of b.stern.muzzles) assert.ok(m[2] < b.aftZ && m[1] < MEASURED.castleRoofY, 'the barrels astern under her castle');
});

test('GALLEON THE GUN DECK AT WORK: a battery laid opens its side\'s shutters and runs its guns out over a second and more, the other side shut and run in; a gun fired kicks RECOIL m inboard in KICK_S and is hauled out over HAUL_S; HOLD_S past the last word the side runs in and shuts - read off the nodes alone, a hull without them left be (mutants: the other side laid, no recoil, the hold dropped, a gun never run in)', () => {
  const { s, boat } = placed();
  const deck = createGalleonGunDeck();
  const run = (from, secs) => { let t = from; for (; t < from + secs - 1e-9; t += 0.05) { deck.step([boat], t); for (const n of boat.GameObject.walk()) for (const c of n.getComponents('Animator')) c.animator?.update(0.05); } return t; };
  let r = deck.read(boat, 0);
  assert.deepEqual([r.starboard.guns.length, r.port.guns.length, r.starboard.open.length, r.port.open.length], [5, 5, 5, 5], 'five guns and five shutters a side');
  assert.ok(r.starboard.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-9), 'run in to load');
  deck.lay(boat, 'starboard', 0);
  let t = run(0, 0.5);
  r = deck.read(boat, t);
  assert.ok(r.starboard.laid && !r.port.laid);
  assert.ok(r.starboard.open.every(Boolean) && !r.port.open.some(Boolean), 'her starboard shutters up, her port ones shut');
  assert.ok(r.starboard.guns.every((x) => x > RUN_IN_X + 0.2 && x < RUN_OUT_X), `running out (${r.starboard.guns.map((x) => x.toFixed(2))})`);
  t = run(t, 1.5);
  assert.ok(deck.read(boat, t).starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-9), 'run out');
  // the shutters as her model has them: up past level, on the top hinge
  const lid = nodeNamed(boat, 'GunportStarboard2');
  assert.ok(sameTurn(lid.localRotation, quatEuler(0, 0, LID_OPEN_DEG)), 'the shutter stands open at LID_OPEN_DEG');
  // the middle gun fires: kicked in, hauled out
  deck.fired(boat, 'starboard', 2, t);
  const shot = t;
  t = run(t, KICK_S + 0.05);
  near(deck.read(boat, t).starboard.guns[2], RUN_OUT_X - RECOIL, 0.05, 'kicked back RECOIL');
  assert.ok(deck.read(boat, t).starboard.guns[1] === RUN_OUT_X, 'its neighbours stand');
  t = run(t, HAUL_S);
  near(deck.read(boat, t).starboard.guns[2], RUN_OUT_X, 1e-6, 'hauled out again');
  near(recoilAt(0), 0, 1e-12, 'nothing before the kick'); near(recoilAt(KICK_S), RECOIL, 1e-12, 'the kick'); near(recoilAt(KICK_S + HAUL_S), 0, 1e-12, 'out');
  // HOLD_S past the shot: run in and shut
  t = run(t, shot + HOLD_S + 2 - t);
  r = deck.read(boat, t);
  assert.ok(!r.starboard.laid && r.starboard.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-9) && !r.starboard.open.some(Boolean), 'run in to load, shut');
  // a hull of another build: none of her nodes, nothing asked (PIN MOVED, SHIPS-2: the Carrack is Mac's New Ship 2 and
  // carries a gun deck of her own - test/ships2_carrack.test.js - so the Large Boat, her swivels on her caps, is the hull
  // without one)
  const other = s.place(HULL.LargeBoat, 0);
  deck.lay(other, 'starboard', t);
  deck.step([other], t + 1);
  assert.equal(deck.read(other), null, 'a Large Boat carries no galleon\'s gun deck');
});

test('GALLEON THE HOST STANDS HER GUN DECK: at her armed helm a look to starboard lays her starboard battery - its shutters up, its guns run out, her port side shut - and the release fires it out of those ports, each gun kicking back as its own ball leaves (the shot field\'s muzzle, its index the port\'s) (mutants: the lay unwired, the fired unwired)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  h.run(2);
  let r = h.host.gunDeckOf(h.boat);
  assert.ok(r.starboard.laid && !r.port.laid, 'her starboard battery laid');
  assert.ok(r.starboard.open.every(Boolean) && !r.port.open.some(Boolean), 'its shutters up, her port ones shut');
  assert.ok(r.starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-6), `run out (${r.starboard.guns.map((x) => x.toFixed(2))})`);
  h.host.attackInput(false);
  const kicked = new Set();
  for (let i = 0; i < 30; i++) {
    h.run(0.05);
    r = h.host.gunDeckOf(h.boat);
    r.starboard.guns.forEach((x, k) => { if (x < RUN_OUT_X - RECOIL / 2) kicked.add(k); });
  }
  assert.deepEqual([...kicked].sort(), [0, 1, 2, 3, 4], 'each gun kicked back as its ball left');
  assert.ok(r.port.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-6), 'her port guns stood in');
});

// ── her hatches, doors and helm ─────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER HATCHES AND DOORS OPEN AND CLOSE: each hatch cover and each door carries a DoorTrigger the walk sizes to its collider and files under BoardTriggers; Come Sail Away\'s TriggerDoor turns its Opened over - the covers lift on their starboard edge to HATCH_OPEN_DEG, the doors swing aft - and back (mutants: no trigger, the trigger unsized, the clip unread)', () => {
  const { s, boat } = placed();
  const doors = new Map(boat.BoardTriggers.filter((t) => /^(Hatch|CastleDoor|BulkheadDoor)/.test(t.parent?.name)).map((t) => [t.parent.name, t]));
  assert.deepEqual([...doors.keys()].sort(), ['BulkheadDoor', 'CastleDoor', 'HatchAft', 'HatchFore']);
  for (const [name, trigger] of doors) {
    const box = trigger.getComponent('BoxCollider');
    const b = colliderBounds({ models: MODELS }, trigger.parent, trigger.parent.getComponent('MeshCollider'));
    assert.ok(Math.abs(box.m_Size.x - (b.size[0] + 0.01)) < 1e-4 && box.m_IsTrigger !== false, `${name}: the trigger is its collider's box`);
  }
  const step = (secs) => { for (let t = 0; t < secs; t += 0.25) s.frame(); };
  const hatch = doors.get('HatchFore').parent, door = doors.get('CastleDoor').parent;
  const shut = [...hatch.localRotation], doorShut = [...door.localRotation];
  s.rt.turnDoor(doors.get('HatchFore'));
  s.rt.turnDoor(doors.get('CastleDoor'));
  step(3);
  assert.equal(animatorOf(hatch).GetBool('Opened'), true);
  assert.ok(sameTurn(hatch.localRotation, quatEuler(0, 0, HATCH_OPEN_DEG)), `the cover up past upright (${hatch.localRotation.map((v) => v.toFixed(3))})`);
  assert.ok(!sameTurn(door.localRotation, doorShut, 1e-2), 'the door swung');
  s.rt.turnDoor(doors.get('HatchFore'));
  s.rt.turnDoor(doors.get('CastleDoor'));
  step(3);
  assert.ok(sameTurn(hatch.localRotation, shut) && sameTurn(door.localRotation, doorShut), 'both shut again');
});

test('GALLEON HER HELM: a wheel on the castle\'s roof before the helmsman\'s place, turned WHEEL_TURNS hard over and the rudder RUDDER_DEG on its post, both by the mod\'s Rudder Wheel Controller\'s TurnAngle through her own clips - her helm taken, sail made, the helm put hard over each way; the DriveTrigger at the wheel and the DrivePosition behind it on her roof (mutants: the wheel still, the rudder still, the sides swapped)', () => {
  const { s, boat } = placed();
  const wheel = nodeNamed(boat, 'HelmWheel'), rudder = nodeNamed(boat, 'HelmRudder');
  assert.ok(wheel && rudder && wheel.parent === boat.RudderObject && rudder.parent === boat.RudderObject, 'both under her RudderObject');
  // PIN MOVED (AUDIT GALLEON-2 PF7, 2026-10-03): the helm's trigger over the wheel and its binnacle - its metre's cube
  // 0.25 m forward of the hub, the hub inside it (at the hub, the binnacle's collider stood out of its fore face and took
  // the activation ray from forward of the wheel)
  assert.deepEqual([...boat.DriveTrigger.parent.localPosition], [...DRIVE_TRIGGER_AT], 'the helm\'s trigger at the wheel');
  assert.ok(DRIVE_TRIGGER_AT[0] === HELM.hub[0] && DRIVE_TRIGGER_AT[1] === HELM.hub[1] && Math.abs(DRIVE_TRIGGER_AT[2] - HELM.hub[2]) <= 0.3, 'the hub inside its cube');
  assert.deepEqual([...boat.DrivePosition.localPosition], [...HELM.stand]);
  // PIN MOVED (AUDIT GALLEON P1, 2026-10-02): DrivePosition is where Come Sail Away pins the helmsman's capsule CENTRE
  // (world.js csaSetPlayerPosition: his feet half a height under it), so it stands half a capsule over her roof - on
  // the roof itself it put his feet 0.9 m under it, through it into her great cabin, and his eye under the wheel's hub
  near(HELM.stand[1], MEASURED.castleRoofY + CAPSULE_HEIGHT / 2, 1e-9, 'the helmsman on her roof: his capsule\'s centre half its height over it');
  assert.ok(HELM.stand[2] < HELM.hub[2], 'behind the wheel');
  const wind = () => { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; };   // astern
  s.helm(boat);
  wind();
  s.rt.RaiseSails();
  for (const [key, sign] of [['MoveRight', 1], ['MoveLeft', -1]]) {
    s.held.clear();
    s.held.add(key);
    for (let i = 0; i < 40; i++) { wind(); s.frame(); }
    assert.equal(animatorOf(boat.RudderObject).stateName, 'Sailing');
    assert.ok(sameTurn(wheel.localRotation, quatEuler(0, 0, -sign * WHEEL_TURNS * 360)), `the wheel hard ${sign > 0 ? 'right' : 'left'} (${wheel.localRotation.map((v) => v.toFixed(3))})`);
    assert.ok(sameTurn(rudder.localRotation, quatEuler(0, -sign * RUDDER_DEG, 0)), `the rudder over ${-sign * RUDDER_DEG}`);
  }
});

// ── her rig ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER RIG: five sails by Come Sail Away\'s names - three square (two of them small), a large gaff and a large staysail - on four booms the walk finds; raised, each comes down off its yard and the canvas hangs set, lowered it is furled again; every set sail over her roof, untrimmed, stands in HULL_BUILDS\' rig boxes, each reaching out of her hull\'s box (mutants: a kind misnamed, the canvas still, a box short of her canvas)', () => {
  // her booms home (the auto trim off): the canvas as the rig boxes measure it, square to her
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false } });
  const boat = s.place(HULL.SmallShip, 0);
  assert.deepEqual(boat.Sails.map((n) => n.name), ['ForeCourseSquareSail', 'ForeTopsailSquareSmallSail', 'MainTopsailSquareSmallSail', 'MainGaffLargeSail', 'JibStayLargeSail']);
  assert.equal(boat.Sails.length, SAILS.length);
  assert.deepEqual([boat.SailsSquare.length, boat.SailsGaff.length, boat.SailsStay.length, boat.SailsLateen.length, boat.SailsSmall.length, boat.SailsLarge.length, boat.Booms.length], [3, 1, 1, 0, 2, 2, 4]);
  const skins = [...boat.GameObject.walk()].map((n) => n.getComponent('SkinnedMeshRenderer')).filter(Boolean);
  assert.ok(skins.filter((r) => r.m_Bones.length > 20).length >= SAILS.length, 'each sail skinned, a bone a vertex');
  const pts = () => [...boat.GameObject.walk()].filter((n) => /^B\d+$/.test(n.name)).map((n) => { const m = n.worldMatrix(); return [m[12], m[13], m[14]]; });
  const wind = () => { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; };   // astern: no square sail kept furled
  const frames = (n) => { for (let i = 0; i < n; i++) { wind(); s.frame(); } };
  s.helm(boat);
  frames(8);
  const furled = pts();
  s.rt.RaiseSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === false), 'raised: every sail unstowed');
  const set = pts();
  const moved = set.filter((p, i) => Math.hypot(p[0] - furled[i][0], p[1] - furled[i][1], p[2] - furled[i][2]) > 0.5).length;
  assert.ok(moved > set.length / 2, `the canvas comes down off its yards (${moved} of ${set.length})`);
  // the rig boxes: each out of her hull's box, and every point of her set canvas over her roof within them. PIN MOVED
  // (AUDIT GALLEON R5/G9): her boxes hang down to her canvas - the course's foot, the gaff sail's and the jib's lie under
  // her roof, and her boxes with them - so each reaches out of her hull's box (over her roof, past her stem or her side)
  // where every box stood over her roof; the chain shot's band starts at her roof (navalAI.js rigBand), and
  // test/auditgalleon_rig.test.js holds every point of her set canvas in them at every trim
  const b = hullBuild(HULL.SmallShip);
  for (const [mn, mx] of b.rig) assert.ok(mx[1] > b.top || mx[2] > b.bowZ || mn[2] < b.aftZ || mx[0] > b.halfWidth || mn[0] < -b.halfWidth, 'a rig box out of her hull\'s box');
  // PIN MOVED (AUDIT GALLEON R5/G9): her canvas read in her mesh object's own frame, her heel taken off - she heels 1.4
  // degrees standing before the wind, and her boxes fit her canvas now (a main topsail's clew stood 0.32 m out of its
  // box at its height on the translation alone, where the old boxes had a metre to spare)
  const mw = boat.MeshObject.worldMatrix();
  const local = (p) => { const d = [p[0] - mw[12], p[1] - mw[13], p[2] - mw[14]]; return [0, 1, 2].map((k) => d[0] * mw[k * 4] + d[1] * mw[k * 4 + 1] + d[2] * mw[k * 4 + 2]); };
  const out = set.map(local).filter((p) => p[1] > b.top + 0.3 && !b.rig.some(([mn, mx]) => p.every((v, k) => v >= mn[k] - 0.3 && v <= mx[k] + 0.3)));
  assert.deepEqual(out.map((p) => p.map((v) => +v.toFixed(2))), [], 'her set canvas inside her rig boxes');
  s.rt.LowerSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === true), 'lowered: furled');
});

// ── her pictures ────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER PICTURES: painted at load from numbers alone - the same bytes every time - a record a TEX entry under GALLEON_ARCHIVE, each 64 x 64 (GALLEON-2, Mac: "textures should be 64x64"); registered with the vendor textures once (twenty-three stand-ins), her stern windows\' two slices alone glowing by night (mutants: a picture seeded off the clock, registered twice, the glow everywhere, a picture off 64)', async () => {
  const hash = (art) => createHash('sha256').update(JSON.stringify(art.map(([r, p]) => [r, p.width, p.height, Buffer.from(p.data).toString('base64')]))).digest('hex');
  const a = galleonArt(), b = galleonArt();
  assert.equal(hash(a), hash(b), 'the same bytes');
  assert.deepEqual(a.map(([r]) => r), Object.values(TEX), 'a picture a record, in record order');
  assert.equal(GALLEON_TEX_SIZE, 64);
  for (const [r, p] of a) {
    assert.deepEqual([p.width, p.height], [64, 64], `record ${r}: 64 x 64`);
    assert.equal(p.data.length, p.width * p.height * 4);
  }
  for (const r of BANDS.sternWindows.recs) assert.ok(galleonGlow(r)?.data.some((v, i) => i % 4 === 0 && v > 0), `her stern windows glow (record ${r})`);
  for (const r of [TEX.hullSide0, TEX.castle0, TEX.castle1, TEX.deck]) assert.equal(galleonGlow(r), null, 'nothing else');
  _resetGalleonArt();
  const added = [];
  const add = (entries) => { added.push(...entries); return entries.length; };
  assert.equal(registerGalleonArt(add), Object.keys(TEX).length);
  assert.equal(registerGalleonArt(add), 0, 'once');
  assert.ok(added.every((e) => e.archive === GALLEON_ARCHIVE && e.standIn === true && e.frame === 0 && typeof e.build === 'function'), 'stand-ins under her own archive');
  const built = await added.find((e) => e.record === TEX.castle0).build();
  assert.ok(Buffer.from(built.data).equals(Buffer.from(a.find(([r]) => r === TEX.castle0)[1].data)), 'built as painted');
  _resetGalleonArt();
});

test('GALLEON-2 HER LIVERY IN SLICES (Mac: "textures should be 64x64"): her side\'s, her castle\'s and her stern\'s liveries each cut into 64-texel slices by height, the slices her livery again stacked top down; every face of hers that wears one lies inside its band, and is drawn as pieces cut at its slices - each on the slice whose heights hold it, its v that height up the slice; every picture she draws one of hers (mutants: the cut unmade, a slice\'s v off its height, the slices out of order)', () => {
  const art = new Map(galleonArt());
  for (const [name, livery] of [['hullSide', hullSideLivery()], ['castle', castleLivery()], ['sternWindows', sternWindowsLivery()]]) {
    assert.equal(livery.height, 64 * BANDS[name].recs.length, `${name}: 64 rows a slice`);
    const stacked = Buffer.concat(BANDS[name].recs.map((r) => Buffer.from(art.get(r).data)));
    assert.ok(stacked.equals(Buffer.from(livery.data)), `${name}: its slices are its livery, top down`);
  }
  // her faces inside their bands - none needs the outer slices' clamp
  let worn = 0;
  for (const p of bakeJson.parts) {
    const P = p.positions;
    p.polygons.forEach((poly) => {
      const ring = poly.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      const c = [0, 1, 2].map((k) => ring.reduce((a, q) => a + q[k], 0) / ring.length);
      const skin = faceSkin(p.role, norm(newell(ring)), c);
      if (!skin.band) return;
      worn++;
      const ys = ring.map((q) => q[1]);
      assert.ok(Math.min(...ys) >= skin.band.y0 - 1e-6 && Math.max(...ys) <= skin.band.y1 + 1e-6, `${p.role}: a face of ${Math.min(...ys)}..${Math.max(...ys)} inside its band ${skin.band.y0}..${skin.band.y1}`);
    });
  }
  assert.ok(worn > 20, `her liveries are worn (${worn} faces)`);
  // the pieces as drawn
  const recs = new Set(Object.values(TEX));
  let sliced = 0;
  for (const key of Object.keys(MODELS.meshes).filter((k) => MODELS.meshes[k].galleon)) {
    const g = MODELS.geometry(key);
    // (a collider draws nothing; a skinned sail's or rope's pictures ride its renderer, galleonRig.js)
    if (!key.endsWith(':collider') && !g.blendIndices) assert.ok(g.slots?.length && g.slots.length === g.subMeshes.length, `${key}: a picture for each of its submeshes`);
    (g?.slots ?? []).forEach((slot, k) => {
      assert.ok(slot.archive === GALLEON_ARCHIVE && recs.has(slot.record), `${key}: picture ${slot.record} is hers`);
      const sm = g.subMeshes[k];
      for (const band of Object.values(BANDS)) {
        const s = band.recs.indexOf(slot.record);
        if (s < 0) continue;
        sliced++;
        const h = (band.y1 - band.y0) / band.recs.length, top = band.y1 - s * h, bottom = top - h;
        for (let v = sm.startIndex; v < sm.startIndex + sm.primitiveCount * 3; v++) {
          const y = g.positions[v * 3 + 1];
          assert.ok(y >= bottom - 1e-4 && y <= top + 1e-4, `${key}: slice ${s}'s piece at ${y} inside ${bottom}..${top}`);
          near(g.uvs[v * 2 + 1], (y - bottom) / h, 1e-4, `${key}: slice ${s}'s v at ${y}`);
        }
      }
    });
  }
  assert.ok(sliced >= 8, `her liveries' slices drawn (${sliced})`);
});

// ── the loader ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE LOADER: the new galleon over hull 2 when her model answers; when it does not, or will not build, hull 2 is the mod\'s own galleon and it says so once - never no ship; the mod\'s files never among hers (mutants: the fallback dropped, the warning every time, her URL among the mod\'s)', async () => {
  const fileFetch = (deny = null, swap = null) => async (url) => {
    if (deny && url === deny) return { ok: false, status: 404 };
    if (swap && url === swap.url) return { ok: true, json: async () => swap.json };
    const bytes = readFileSync(new URL(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  assert.ok(Object.values(CSA_MODEL_URLS).every((u) => u.includes('vendor/come-sail-away/Models/')) && GALLEON_MODEL_URL.endsWith('src/assets/galleon/galleon.json'));
  const warns = [];
  const log = { warn: (...a) => warns.push(a) };
  const hers = await loadComeSailAwayModels(fileFetch(), CSA_MODEL_URLS, log);
  assert.equal(hers.galleon, true);
  assert.ok(hers.prefab(GALLEON_PREFAB_ID).children.some((c) => c.name === GALLEON_HULL_NODE), 'her hull under prefab 112412');
  assert.equal(warns.length, 0);
  const missing = await loadComeSailAwayModels(fileFetch(GALLEON_MODEL_URL), CSA_MODEL_URLS, log);
  assert.equal(missing.galleon, false, 'her model missing: the mod\'s own galleon');
  assert.equal(warns.length, 1);
  const broken = await loadComeSailAwayModels(fileFetch(null, { url: GALLEON_MODEL_URL, json: { ...bakeJson, parts: [] } }), CSA_MODEL_URLS, log);
  assert.equal(broken.galleon, false, 'her model broken: the mod\'s own galleon');
  assert.equal(warns.length, 2);
  assert.match(String(warns[1][0]), /would not build/);
  // the prefab builder alone, as the loader calls it
  assert.throws(() => galleonPrefab({ ...bakeJson, parts: [] }, JSON.parse(readFileSync(new URL('../vendor/come-sail-away/Models/prefabs.json', import.meta.url), 'utf8'))), /the bake has no /);
});

// ── HULL_BUILDS' Small Ship ─────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HULL_BUILDS\' SMALL SHIP IS HERS: her box her MeshCollider\'s bounds (her hull\'s planking and her castle\'s) - stem, stern, half beam, keel and roof to the centimetre; her deck her main deck, her half beam at it inside her planking (mutants: the mod\'s galleon\'s numbers back)', () => {
  const { boat } = placed();
  const b = hullBuild(HULL.SmallShip);
  assert.equal(boat.MeshObject.name, GALLEON_HULL_NODE, 'her hull the boat\'s frame');
  const m = boat.MeshObject.worldMatrix();
  const bounds = colliderBounds({ models: MODELS }, boat.MeshObject, boat.MeshCollider);
  const lo = [bounds.min[0] - m[12], bounds.min[1] - m[13], bounds.min[2] - m[14]], hi = [bounds.max[0] - m[12], bounds.max[1] - m[13], bounds.max[2] - m[14]];
  near(b.bowZ, hi[2], 0.006, 'her stem'); near(b.aftZ, lo[2], 0.006, 'her stern');
  near(b.halfWidth, Math.max(hi[0], -lo[0]), 0.006, 'her half beam'); near(b.keel, lo[1], 0.006, 'her keel'); near(b.top, hi[1], 0.006, 'her roof');
  near(b.deck, MEASURED.mainDeckY, 0.01, 'her deck');
  assert.ok(b.beam > 5.3 && b.beam < MEASURED.hullOuterX, `her half beam at her deck (${b.beam})`);
});
