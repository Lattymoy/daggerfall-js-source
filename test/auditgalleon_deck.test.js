// AUDIT GALLEON (2026-10-02, Mac: "Audit this. It must be perfect") - HER DECK AND HER CREW: the deck lens of the audit
// of the new galleon (hull 2, the Small Ship) - D1 the leash, D2 her rail's spots and a landing on her, D3 aboard on her
// lower decks, D4 her lookout's bow, D5 a turning flight kept, D7 her hatchways, D8 a tread's underside, D9 the spots'
// cache, D10 her hands' idling and the comments that said otherwise, T4 a boarding's musters - each pinned over the
// real code: her deck baked by the real pool (test/navalSea.mjs) off her own colliders, world.js's leash and deck doors
// lifted whole (the suites' own way, test/auditnav2_deck.test.js), the naval host's own aboard(), her crew's brain on
// her real deck - and every other hull beside her.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as NAVAL_DECK from '../src/systems/naval/navalDeck.js';
import { buildDeck, deckOf as deckGrid, intoDeck, outOfDeck, mainLevel, DECK_STEP, DECK_HEADROOM } from '../src/systems/naval/navalDeck.js';
import { createCrewLife, crewRoster, deckExtentZ, LOOKOUT_BACK } from '../src/systems/naval/crewLife.js';
import { peopleFlatsOf } from '../src/scenes/navalCrew.js';
import { Boat, spawnBoat, HULL_NAMES, HULL_VARIANT_COUNTS } from '../src/systems/comeSailAwayBoat.js';
import { colliderPoses, raycastColliders, boxColliderTriangles, invertAffine, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { multiply } from '../src/world/mat4.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';
import { hullBuild, HULL } from '../src/systems/naval/navalShips.js';
import { MOBILE } from '../src/systems/naval/navalBoarding.js';
import { MEASURED } from '../src/world/galleonModel.js';
import { MEASURED as CARRACK_MEASURED } from '../src/world/carrackModel.js';
import { MODELS, ctxFor } from './csaScene.mjs';
import { sea, readyPool } from './navalSea.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
/** A function declaration of world.js's, lifted whole (the suites' own way). */
const lift = (name) => {
  const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(WORLD);
  assert.ok(m, `${name} lifted`);
  return m[0];
};
/** One line of world.js's from its start. */
const line = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
const added = (start) => (WORLD.includes(start) ? line(start) : '');
const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null);
/** A hull stood at rest - her colliders to cast at, her mesh node's frame. */
const standing = (hull, variant = 0) => { const b = new Boat(hull, variant); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
/** A deck's cells' centres, `[x, y, z]` in her frame. */
const cellsOf = (d) => { const out = []; for (let j = 0; j < d.y.length; j++) if (!Number.isNaN(d.y[j])) { const i = j % d.nx, k = (j - i) / d.nx; out.push([d.minX + (i + 0.5) * d.cell, d.y[j], d.minZ + (k + 0.5) * d.cell]); } return out; };
const DT = 0.1;

/** world.js's deck doors over the pool's decks, cast at her live colliders (csaColliderMesh's reading of them). */
function deckDoors(pool) {
  const body = `const { intoDeck, outOfDeck, DECK_HEADROOM, csa, raycastColliders, csaColliderMesh, tvSeaY, navalHullBoxOf, mainLevel } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}${line('  const NAVAL_RAIL_GAP = ')}
    ${lift('navalDeckSpots')}${lift('navalDeckPoint')}${lift('navalDeckLanding')}${lift('navalRailSpots')}
    return { navalDeckSpots, navalDeckPoint, navalDeckLanding, navalRailSpots };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ intoDeck, outOfDeck, DECK_HEADROOM, csa: { deckOf: (h, v) => pool.deckOf(h, v), models: null }, raycastColliders, csaColliderMesh: geometry, tvSeaY: () => 0, navalHullBoxOf: () => null, mainLevel });
}
/** world.js's deck registry, leash and carry, over `csa` (a pool, or a stand-in with its deckOf) and `foes`. */
function leashRig(csa, foes) {
  const body = `const { intoDeck, outOfDeck, DECK_STEP, csa, exteriorFoes } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}
    ${line('  const _deckBodies = new Set();')}${line('  const navalDeckBody = (f, boat) =>')}${added('  const navalHullStands = ')}${line('  const _leashLocal = [0, 0, 0];')}
    ${lift('navalLeash')}${lift('navalCarry')}
    return { navalLeash, navalCarry, navalDeckBody, bodies: _deckBodies };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ intoDeck, outOfDeck, DECK_STEP, csa, exteriorFoes: foes });
}
/** One body on her deck under the lifted leash: `step(from, to)` - where the leash leaves a body that stood at `from`
 *  (her frame) a frame ago and stands at `to` now. */
function leashOne(deck, boat) {
  const foes = [], w = leashRig({ deckOf: () => deck }, { foes }), m = boat.MeshObject.worldMatrix();
  const f = { dead: false, ai: { feet: [0, 0, 0] }, entity: {} };
  foes.push(f);
  w.navalDeckBody(f, boat);
  return {
    f, m,
    step(from, to) { f.ai.feet = outOfDeck(m, from); w.navalLeash(); f.ai.feet = outOfDeck(m, to); w.navalLeash(); return intoDeck(m, f.ai.feet); },
    /** the body pressing on to `to` from wherever the leash left it last */
    press(to) { f.ai.feet = outOfDeck(m, to); w.navalLeash(); return intoDeck(m, f.ai.feet); },
  };
}

// ── her own faces, for the probes ────────────────────────────────────────────────────────────────────────────────

const KEY = (i, k) => i * 4096 + k;
const bucketed = (faces) => {
  const map = new Map();
  for (const f of faces) for (let i = Math.floor(f.x0); i <= Math.floor(f.x1); i++) for (let k = Math.floor(f.z0); k <= Math.floor(f.z1); k++) { const key = KEY(i, k); if (!map.has(key)) map.set(key, []); map.get(key).push(f); }
  return map;
};
/** Her colliders' faces in her deck's frame, as the pool gathers them for her deck (at rest; a classic model's cpu
 *  triangles aside): `floors` every face with a height at a point (`up` an upward one within 30 degrees of level),
 *  `walls` the near-vertical ones (|n.y| under 5% - the bake's own), each bucketed by the metre. */
function facesOf(hull) {
  const boat = standing(hull), frame = invertAffine(boat.MeshObject.worldMatrix());
  const walls = [], floors = [];
  for (const { node, collider: c, world } of colliderPoses(boat.GameObject)) {
    if (c.m_IsTrigger || c.m_Enabled === false) continue;
    const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : geometry(c);
    if (!g) continue;
    const m = multiply(frame, world, new Float32Array(16)), p = g.positions, ix = g.indices;
    const at = (i) => [m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12], m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13], m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14]];
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const [ax, ay, az] = at(ix[t] * 3), [bx, by, bz] = at(ix[t + 1] * 3), [cx, cy, cz] = at(ix[t + 2] * 3);
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx, len = Math.hypot(nX, nY, nZ);
      if (!(len > 1e-12)) continue;
      const f = { ax, ay, az, bx, by, bz, cx, cy, cz, name: node?.name ?? '', x0: Math.min(ax, bx, cx), x1: Math.max(ax, bx, cx), y0: Math.min(ay, by, cy), y1: Math.max(ay, by, cy), z0: Math.min(az, bz, cz), z1: Math.max(az, bz, cz), up: nY > Math.cos(Math.PI / 6) * len };
      if (Math.abs(nY) < 0.05 * len) { walls.push(f); continue; }
      f.det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(f.det) > 1e-12) floors.push(f);
    }
  }
  return { boat, walls: bucketed(walls), floors: bucketed(floors) };
}
const heightOn = (f, x, z) => {
  if (x < f.x0 - 1e-9 || x > f.x1 + 1e-9 || z < f.z0 - 1e-9 || z > f.z1 + 1e-9) return NaN;
  const l1 = ((f.bz - f.cz) * (x - f.cx) + (f.cx - f.bx) * (z - f.cz)) / f.det, l2 = ((f.cz - f.az) * (x - f.cx) + (f.ax - f.cx) * (z - f.cz)) / f.det, l3 = 1 - l1 - l2;
  return l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9 ? NaN : l1 * f.ay + l2 * f.by + l3 * f.cy;
};
/** Every face of hers with a height at `(x, z)`: `[y, face]`. */
const heightsAt = (F, x, z) => { const out = []; for (const f of F.floors.get(KEY(Math.floor(x), Math.floor(z))) ?? []) { const y = heightOn(f, x, z); if (!Number.isNaN(y)) out.push([y, f]); } return out; };
const segD = (px, pz, x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz; let s = L2 ? ((px - x0) * dx + (pz - z0) * dz) / L2 : 0; s = Math.max(0, Math.min(1, s)); return Math.hypot(px - x0 - s * dx, pz - z0 - s * dz); };
/** Whether a wall of hers standing in `(lo, hi)` lies within `r` of `(x, z)`. */
const wallWithin = (F, x, z, lo, hi, r) => {
  for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let k = Math.floor(z - r); k <= Math.floor(z + r); k++) {
    for (const w of F.walls.get(KEY(i, k)) ?? []) {
      if (!(w.y1 > lo && w.y0 < hi) || x < w.x0 - r || x > w.x1 + r || z < w.z0 - r || z > w.z1 + r) continue;
      if (Math.min(segD(x, z, w.ax, w.az, w.bx, w.bz), segD(x, z, w.bx, w.bz, w.cx, w.cz), segD(x, z, w.cx, w.cz, w.ax, w.az)) < r) return true;
    }
  }
  return false;
};
/** Where a body stands on her at `(x, z)` - an upward face of hers under it with a head's room clear over it and no wall
 *  of hers in the body's band within its capsule's radius - each such floor's height. */
const standable = (F, x, z) => {
  const hs = heightsAt(F, x, z), out = [];
  for (const [y, f] of hs) {
    if (!f.up || hs.some(([o]) => o > y + 1e-3 && o < y + DECK_HEADROOM)) continue;
    if (wallWithin(F, x, z, y + DECK_STEP, y + DECK_HEADROOM, CAPSULE_RADIUS)) continue;
    out.push(y);
  }
  return out;
};

// ── D1: the leash ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D1 THE LEASH NEVER SETS A BODY ON ANOTHER PIECE\'S FLOOR MORE THAN A STEP OFF: a boarder anywhere on either flight\'s treads up her castle\'s well, a capsule clear of its walls - 1275 points each - stays on her flight (the port well\'s inner wall stands 3 mm inside a cell that holds her great cabin\'s floor and no tread: 192 port points dropped him 2.2-4.8 m onto her cabin\'s floor, none starboard; one hugging that wall as he climbed fell at z -11.41); a foe in her great cabin is never lifted onto a tread or her castle\'s roof (364 of 5705 cabin points: 60 onto a flight 2.3-2.6 m up, 304 onto her roof 4.8 m up); her open waist as it was - a body in her deck\'s inset margin never lifted (mutants: the nearest floor of any piece again, the body\'s piece unread)', async () => {
  const pool = await readyPool();
  const d = pool.deckOf(2, 0), F = facesOf(2), body = leashOne(d, F.boat);
  /** her flight's tread under a point: the highest upward face of her stairs there */
  const treadAt = (x, z) => { let best = NaN; for (const [y, f] of heightsAt(F, x, z)) if (f.up && /^Stairs/.test(f.name) && !(y <= best)) best = y; return best; };
  for (const [name, x0, x1, file] of [['port', -4.763, -3.363, -4.11], ['starboard', 3.334, 4.734, 3.89]]) {
    let n = 0, dropped = 0, lifted = 0, first = '';
    for (let ix = 0; ix <= Math.round((x1 - x0 - 2 * CAPSULE_RADIUS) / 0.05); ix++) {
      const x = x0 + CAPSULE_RADIUS + ix * 0.05;
      for (let iz = 0; iz <= 84; iz++) {
        const z = -14.6 + iz * 0.05, y = treadAt(x, z);
        if (Number.isNaN(y)) continue;
        n++;
        const got = body.step([file, y, z], [x, y, z]);   // from her kept file onto the tread beside it, the wall's side
        if (got[1] < y - DECK_STEP) { dropped++; first ||= `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) -> ${got.map((v) => v.toFixed(2))}`; }
        else if (got[1] > y + DECK_STEP) { lifted++; first ||= `UP (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) -> ${got.map((v) => v.toFixed(2))}`; }
      }
    }
    assert.equal(n, 1275, `her ${name} flight: its treads in her castle's well, wall to wall a capsule's radius in (15 x 85 points)`);
    assert.equal(dropped, 0, `her ${name} flight: dropped off her flight - first ${first}`);
    assert.equal(lifted, 0, `her ${name} flight: lifted - first ${first}`);
  }
  // a boarder hugging the port well's inner wall as he climbs, frame by frame - never off her flight
  for (const x of [-3.713, -4.06, -4.413]) {
    body.step([x, treadAt(x, -7.66), -7.66], [x, treadAt(x, -7.66), -7.66]);
    for (let z = -7.66; z >= -14.66; z -= 0.05) {
      const want = treadAt(x, z), got = body.press([x, want, z]);
      assert.ok(got[1] >= want - DECK_STEP, `climbing at x ${x}: dropped at z ${z.toFixed(2)} from ${want.toFixed(2)} to ${got[1].toFixed(2)}`);
    }
  }
  // her great cabin under her castle: a foe stepping anywhere in it from a cell of it
  const cabin = d.pieceAt(0, -14, 6.2);
  assert.ok(cabin > 0, 'her great cabin a piece of its own');
  let nc = 0, up = 0, upAt = '';
  for (let x = -5; x <= 5 + 1e-9; x += 0.1) for (let z = -17.5; z <= -10.6 + 1e-9; z += 0.1) {
    const y = MEASURED.mainDeckY;
    if (wallWithin(F, x, z, y + DECK_STEP, y + DECK_HEADROOM, CAPSULE_RADIUS)) continue;
    const was = d.clamp(x, z, [0, 0, 0], cabin);
    if (!was || Math.abs(was[1] - y) > 0.05) continue;
    nc++;
    const got = body.step(was, [x, y, z]);
    if (got[1] > y + DECK_STEP) { up++; upAt ||= `(${x.toFixed(2)}, ${z.toFixed(2)}) -> ${got.map((v) => v.toFixed(2))}`; }
  }
  assert.ok(nc > 5000, `her cabin's standable points (${nc})`);
  assert.equal(up, 0, `a foe in her great cabin lifted onto a tread or her castle's roof - first ${upAt}`);
  // her open waist: a body on her main deck off its cells (her inset's margin), nothing over it - never lifted
  const main = mainLevel(d);
  let nw = 0, waist = 0;
  for (let x = -6; x <= 6 + 1e-9; x += 0.1) for (let z = -20; z <= 22 + 1e-9; z += 0.1) {
    const hs = heightsAt(F, x, z), f = hs.find(([y, face]) => face.up && Math.abs(y - main) <= 0.1);
    if (!f || hs.some(([o]) => o > f[0] + 1e-3) || d.walkable(x, z)) continue;   // open to the sky, off her deck's cells
    if (wallWithin(F, x, z, f[0] + DECK_STEP, f[0] + DECK_HEADROOM, CAPSULE_RADIUS)) continue;
    nw++;
    const from = d.clamp(x, z, [0, 0, 0], 0, main) ?? d.clamp(x, z);
    if (body.step(from, [x, f[0], z])[1] > f[0] + DECK_STEP) waist++;
  }
  assert.ok(nw > 2500, `her open waist's margin (${nw} points)`);
  assert.equal(waist, 0, 'a body in her open waist\'s margin lifted onto a raised floor');
});

// ── D2: her rail's spots, and a landing ───────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D2 HER RAIL\'S SPOTS AND A LANDING ON HER MAIN DECK: a party over her rail stands on her main deck\'s rail (within DECK_STEP of it) wherever the other ship lies - abeam the new galleon\'s castle all eight of eight stood on her flights\' treads and her castle\'s roof, abeam the Carrack\'s bow on her forecastle - and a boarder put over her rail from off her side, at any height, comes down on her main deck, never a flight\'s tread nor a raised deck\'s edge (from 1.5 m off the galleon\'s side aft of z -9 he came down on her flights and her roof); one already standing on her castle\'s roof or a tread of hers stays where he stands (mutants: the rail at no level, the landing at no level, the feet\'s own floor unread)', async () => {
  const pool = await readyPool(), w = deckDoors(pool);
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    const boat = standing(hull), d = pool.deckOf(hull, 0), m = boat.MeshObject.worldMatrix(), main = mainLevel(d), b = hullBuild(hull);
    const off = [];
    for (let z = Math.ceil(b.aftZ); z <= b.bowZ; z += 1) {
      for (const side of [1, -1]) {
        for (const n of [4, 8]) {
          const spots = w.navalRailSpots(boat, outOfDeck(m, [side * 15, main, z]), n);
          assert.ok(spots.length >= 1, `${HULL_NAMES[hull]} z ${z}: a place at her rail`);
          for (const [f] of spots) { const p = intoDeck(m, f); if (!(Math.abs(p[1] - main) <= DECK_STEP)) off.push(`n ${n} z ${z} side ${side}: ${p.map((v) => v.toFixed(2))}`); }
        }
        // a landing from 1.5 m off her side - at her main deck's height, at a flight's, at her castle's roof's, from the
        // sea: on her main deck's own floor (set down on it by the ray, 5 cm over it), never a tread a step up
        for (const y of [main, main + 2.3, main + 4.8, main - 4]) {
          const at = w.navalDeckLanding(boat, outOfDeck(m, [side * (b.halfWidth + 1.5), y, z]));
          const p = intoDeck(m, at[0]);
          if (!(Math.abs(p[1] - main) <= 0.1)) off.push(`landing from (${side * (b.halfWidth + 1.5)}, ${y.toFixed(2)}, ${z}): ${p.map((v) => v.toFixed(2))}`);
        }
      }
    }
    assert.deepEqual(off, [], `${HULL_NAMES[hull]}: on her main deck, never a raised deck's edge or a flight's tread`);
  }
  // already aboard: on her castle's roof, and on a tread of her port flight - he stays where he stands
  const boat = standing(HULL.SmallShip), m = boat.MeshObject.worldMatrix();
  for (const at of [[0.5, MEASURED.castleRoofY, -16], [-4.11, 9.523, -12.16]]) {
    const p = intoDeck(m, w.navalDeckLanding(boat, outOfDeck(m, at))[0]);
    assert.ok(Math.abs(p[0] - at[0]) < 1e-6 && Math.abs(p[2] - at[2]) < 1e-6 && Math.abs(p[1] - at[1]) < 0.1, `stands where he stood: ${at} -> ${p.map((v) => v.toFixed(2))}`);
  }
  // the deck's own answer, on every hull: a body 3 m over a cell of hers lands on her main deck's own floor (within
  // DECK_FLOOR) - or, where a floor of hers stands there within a step of him (the Carrack's half deck over her main
  // deck), stays on it where he stands
  assert.equal(NAVAL_DECK.DECK_FLOOR, DECK_STEP / 2);
  let stood = 0;
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0), main = mainLevel(d);
    for (const c of cellsOf(d)) {
      const x = c[0] + 0.01, z = c[2] + 0.01, h = c[1] + 3, on = d.heightAt(x, z, h), q = d.land(x, z, h);
      if (Math.abs(on - h) <= DECK_STEP) { stood++; assert.deepEqual(q, [x, on, z], `${HULL_NAMES[hull]}: on a floor of hers at (${x.toFixed(2)}, ${on.toFixed(2)}, ${z.toFixed(2)})`); }
      else assert.ok(Math.abs(q[1] - main) <= NAVAL_DECK.DECK_FLOOR, `${HULL_NAMES[hull]}: a landing over (${c.map((v) => v.toFixed(2))}) at ${q[1].toFixed(2)}`);
    }
  }
  assert.ok(stood > 0, 'some over a floor of hers');
});

// ── D3: aboard below her main deck ────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D3 ABOARD ON HER LOWER DECKS: a man standing anywhere below her main deck - between her guns, on a gun, on her mast\'s step, her lower deck and her hold - is aboard by the host\'s own aboard(), under her main deck a body\'s own reach of a floor of hers (CAPSULE_RADIUS), never the feet\'s own 0.5 m cell alone (it read the galleon\'s 245 of 6316 standable lower points, the Carrack\'s 207 and the Large Galley\'s 1316 ashore: no Sail ho!, no alarm, rest and journeys open, playerAfloat false); and round her hull below her main deck none of the points off her hull read aboard (AUDIT GALLEON D-wall: a floor to stand aboard on looks up - at most 0.5% before it) (mutants: the feet\'s own cell, a metre\'s reach)', async () => {
  const misses = {};
  for (const hull of [HULL.SmallShip, HULL.Carrack, HULL.LargeGalley]) {
    const h = await sea({ hull });
    h.runtime.sailing = false;   // moored, off her helm
    const d = h.pool.deckOf(hull, 0), m = h.boat.MeshObject.worldMatrix(), main = mainLevel(d), cut = main - DECK_STEP, F = facesOf(hull);
    const b = hullBuild(hull);
    let n = 0, ashore = 0, first = '';
    for (let x = -b.halfWidth - 1; x <= b.halfWidth + 1; x += 0.2) for (let z = b.aftZ - 1; z <= b.bowZ + 1; z += 0.2) {
      for (const y of standable(F, x, z)) {
        if (y >= cut) continue;
        n++;
        h.view.feet = outOfDeck(m, [x, y + 0.01, z]);
        if (!h.host.aboard()) { ashore++; first ||= `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`; }
      }
    }
    misses[hull] = [ashore, n, first];
    if (hull === HULL.SmallShip) {
      for (const [p, what] of [[[4.74, 1.09, -2.51], 'her gun deck between two guns, 0.34 m inboard of her side'], [[3.0, 2.19, -0.7], 'on a starboard gun'], [[-0.96, 2.4, 0.19], 'on her mainmast\'s step'], [[0.8, 1.09, -2], 'her gun deck, open']]) {
        h.view.feet = outOfDeck(m, p);
        assert.equal(h.host.aboard(), true, what);
      }
      // off her hull below her main deck: in the air or the water round her, nothing of hers within 0.6 m under
      let nOff = 0, aboard = 0;
      for (let x = -b.halfWidth - 2; x <= b.halfWidth + 2; x += 0.25) for (let z = b.aftZ - 2; z <= b.bowZ + 2; z += 0.25) {
        const s = heightsAt(F, x, z).map(([y]) => y);
        for (let y = -1; y < cut; y += 0.25) {
          if ((s.some((v) => v < y) && s.some((v) => v > y)) || s.some((v) => v <= y + 0.05 && v >= y - 0.6)) continue;
          nOff++;
          h.view.feet = outOfDeck(m, [x, y, z]);
          if (h.host.aboard()) aboard++;
        }
      }
      assert.ok(nOff > 50000, `the points round her (${nOff})`);
      // AUDIT GALLEON D-wall: none - a floor to stand aboard on looks up (her bottom's and her flare's undersides stood
      // 1.03% of these aboard once each wall marked its own height in a cell; a reach of twice a body's reads 0.14%)
      assert.equal(aboard, 0, `round her hull read aboard: ${aboard} of ${nOff} (${(100 * aboard / nOff).toFixed(2)}%)`);
    }
  }
  const [gA, gN, gF] = misses[HULL.SmallShip], [cA, cN, cF] = misses[HULL.Carrack], [lA, lN, lF] = misses[HULL.LargeGalley];
  assert.ok(gN > 5000 && cN > 5000 && lN > 50000, `her lower decks' standable points (${gN}, ${cN}, ${lN})`);
  assert.equal(gA, 0, `the galleon: ${gA} of ${gN} standable points under her main deck read ashore - first ${gF}`);
  assert.ok(cA / cN < 0.002, `the Carrack: ${cA} of ${cN} read ashore - first ${cF}`);
  assert.ok(lA / lN < 0.01, `the Large Galley: ${lA} of ${lN} read ashore - first ${lF}`);
});

// ── D4: her lookout's bow ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D4 HER LOOKOUT KEEPS HER MAIN DECK\'S BOW: her bow LOOKOUT_BACK from her main deck\'s stem, a cell of her main deck, on every hull - the Carrack\'s ran up her forecastle\'s stair, and her lookout kept his watch up there 1460 s of every 1740 (never where her hands idle); the galleon\'s (0.5 m further forward with her bow\'s cells, D-wall), the Large Galley\'s and the small hulls\' where they were (mutants: her whole deck\'s extent, the bow at any level)', async () => {
  const pool = await readyPool();
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0), main = mainLevel(d), ext = deckExtentZ(d, main);
    const life = createCrewLife({ deck: d, roster: crewRoster({ hull, seed: 1, crew: 40 }).slice(0, 4), seed: 1 });
    if (!life.bow) continue;
    assert.ok(Math.abs(life.bow[1] - main) <= DECK_STEP, `${HULL_NAMES[hull]}: her bow on her main deck (${life.bow.map((v) => v.toFixed(2))}, main ${main.toFixed(2)})`);
    // PIN MOVED (SHIPS-2, 2026-10-07): Mac's carrack's fore mast's partner stands on her main deck's stem - her bow the
    // cell nearest it on her centre line, abaft the partner (1.25 m further aft); every other hull's where it was
    const reach = hull === HULL.Carrack ? 1.3 : d.cell;
    assert.ok(Math.abs(life.bow[2] - (ext[1] - LOOKOUT_BACK)) < reach && Math.abs(life.bow[0]) < d.cell, `${HULL_NAMES[hull]}: LOOKOUT_BACK from her main deck's stem (${life.bow[2]} in ${ext})`);
    assert.deepEqual(life.bow, d.nearest(0, ext[1] - LOOKOUT_BACK, main), `${HULL_NAMES[hull]}: the cell of her main deck nearest it`);
  }
  // the Carrack's lookout through a day, a fight, a muster each way, a night and a day's work: never off her main deck
  const d = pool.deckOf(HULL.Carrack, 0), main = mainLevel(d);
  const flats = peopleFlatsOf(standing(HULL.Carrack)).filter((f) => f.feet[1] >= main - DECK_STEP).map((f) => f.feet);
  let up = 0, watched = 0;
  for (const seed of [1, 2, 3]) {
    const roster = crewRoster({ hull: HULL.Carrack, seed, crew: 32 }).slice(0, 8);
    const life = createCrewLife({ deck: d, roster, seed, places: flats });
    for (const [secs, ctx] of [[600, {}], [120, { battle: true }], [60, { muster: 1 }], [60, { muster: -1 }], [300, { asleep: true }], [600, { work: 0.8 }]]) {
      for (let t = 0; t < secs; t += DT) {
        life.step(DT, ctx);
        for (const mm of life.members) {
          if (mm.gone || mm.below) continue;
          if (mm.state === 'watch') watched += DT;
          if (mm.pos[1] > main + DECK_STEP) up += DT;
        }
      }
    }
  }
  assert.ok(watched > 1000, `her lookout kept his watch (${watched.toFixed(0)} s)`);
  assert.equal(Math.round(up), 0, `the Carrack's hands off her main deck ${up.toFixed(0)} s`);
  // her bow on her main deck is a cell a hand's spot can share (the Carrack's main deck's stem cell is one): her
  // lookout never walks onto a hand standing there - he waits his turn, and keeps his watch once it is clear (he
  // stood on one 2.9 s, AUDIT NAV2 F41's law)
  const crew = createCrewLife({ deck: d, roster: Array.from({ length: 4 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 1 });
  crew.step(0.05, {});
  const look = crew.lookout(), bow = crew.bow, hand = crew.members.find((x) => x !== look);
  for (const x of crew.members) if (x !== look && x !== hand) { x.pos = [...d.nearest(0, -4, main)]; x.state = 'ready'; x.path = null; }
  hand.pos = [...bow]; hand.state = 'idle'; hand.t = 8; hand.path = null;
  look.pos = [...d.nearest(bow[0], bow[2] - 4, main)]; look.state = 'idle'; look.t = 0; look.path = null;
  let on = 0, longest = 0, kept = false;
  for (let t = 0; t < 16; t += 0.05) {
    crew.step(0.05, {});
    on = Math.hypot(look.pos[0] - hand.pos[0], look.pos[2] - hand.pos[2]) < 0.3 && !look.moving && !hand.moving ? on + 0.05 : 0;
    longest = Math.max(longest, on);
    kept ||= look.state === 'watch' && Math.hypot(look.pos[0] - bow[0], look.pos[2] - bow[2]) < 0.6;
  }
  assert.ok(longest < 0.2, `her lookout stood on a hand at her bow ${longest.toFixed(2)} s`);
  assert.ok(kept, 'and kept his watch at her bow once it was clear');
});

// ── D5: a turning flight kept ─────────────────────────────────────────────────────────────────────────────────────

/** A main deck 14 m square, a raised deck 2 m up over a corner of it, and a one-cell stair up to it - straight, or
 *  turning on a 2 x 2 landing (a dog-leg). */
function stairDeck(dogleg) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const flat = (x0, x1, z0, z1, y) => quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  const wallX = (x, z0, z1, y0 = 0, y1 = 4) => quad([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]);
  const wallZ = (z, x0, x1, y0 = 0, y1 = 4) => quad([x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]);
  flat(-6, 8, -6, 8, 0);
  flat(3, 6, -1, 6, 2.0);
  if (dogleg) {
    for (let k = 0; k < 4; k++) flat(-0.1, 0.6, k * 0.5, k * 0.5 + 0.5, 0.25 * (k + 1));   // up +z, a cell wide, walled
    wallX(-0.1, 0, 3.1); wallX(0.6, 0, 1.95);
    flat(-0.1, 1.0, 2, 3, 1.0);   // the landing, walled -x and +z
    wallZ(3.1, -0.1, 3.0);
    for (let i = 0; i < 4; i++) flat(1 + i * 0.5, 1.5 + i * 0.5, 2.4, 3.1, 1.0 + 0.25 * (i + 1));   // then up +x
    wallZ(2.4, 1.05, 3.0);
  } else {
    for (let i = 0; i < 8; i++) flat(-1 + i * 0.5, -0.5 + i * 0.5, 2.4, 3.1, 0.25 * (i + 1));
    wallZ(2.4, -1, 3.0); wallZ(3.1, -1, 3.0);
  }
  return buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -6, maxX: 8, minZ: -6, maxZ: 8 });
}

test('AUDIT GALLEON D5 A TURNING FLIGHT KEPT WHOLE: keepFlights\' way up a stair narrower than her inset is found in side steps alone - a way that turned on a landing by a diagonal step (its corners joined in the bare deck, never revived) was kept as six nodes of no piece\'s and the raised deck stood apart from her open deck; the straight stair joined as before (mutants: a corner step in the search again)', () => {
  for (const dogleg of [true, false]) {
    const d = stairDeck(dogleg);
    const raised = cellsOf(d).filter((c) => c[1] > 1.9);
    assert.ok(raised.length >= 24, `${dogleg ? 'the dog-leg' : 'the straight'} stair: her raised deck joined to her open deck (${raised.length} cells)`);
    const walk = d.path([-3, -3], [4.5, 3]);
    assert.ok(walk && Math.abs(walk.at(-1)[1] - 2) < 1e-6, `${dogleg ? 'the dog-leg' : 'the straight'}: a walk from her main deck up onto it`);
    // every cell of the stair a cell of her open deck
    const stair = dogleg ? [[0.25, 0.25], [0.25, 0.75], [0.25, 1.25], [0.25, 1.75], [0.75, 2.75], [1.25, 2.75], [1.75, 2.75], [2.25, 2.75], [2.75, 2.75]] : [[-0.75, 2.75], [0.25, 2.75], [1.25, 2.75], [2.25, 2.75]];
    for (const [x, z] of stair) assert.ok(d.walkable(x, z), `the stair's cell (${x}, ${z}) her deck`);
  }
});

// ── D7: her hatchways ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D7 HER HATCHWAYS ARE NO DECK: a part of hers that opens and shuts (the mod\'s Door Controller, a DoorTrigger under it) is baked a wall as it stands shut and never a floor - the new galleon\'s two hatch covers were 44 cells of her deck at 6.378 over her hatchways (the Carrack\'s two cargo doors 80 at 3.639 over her hold); 208 of the 552 walks between her 24 main-deck spots crossed one, her crew\'s hatch stood on the fore one, and a foe fallen down an open one was set back on the air over it at 6.378 - now no cell over either hole, no walk across one, her hatch on her deck beside the fore one and a fallen foe back on her deck at its edge; her doors still walls (her great cabin a room of its own) and every other hull\'s deck the bake it was (mutants: the covers a floor again, a part that opens unmarked, every door left out)', async () => {
  const pool = await readyPool();
  const d = pool.deckOf(HULL.SmallShip, 0), main = mainLevel(d);
  const holes = [MEASURED.hatchAft, MEASURED.hatchFore];
  const inHole = (x, z) => holes.some((h) => Math.abs(x) < h.halfX && z > h.z0 && z < h.z1);
  assert.deepEqual(cellsOf(d).filter((c) => inHole(c[0], c[2])).map((c) => c.map((v) => +v.toFixed(2))), [], 'no cell of her deck over either hatchway');
  assert.ok(cellsOf(d).every((c) => Math.abs(c[1] - 6.378) > 0.01), 'no cell at her covers\' height');
  // her hands' walks round her hatchways
  const spots = d.spots(24, main);
  assert.equal(spots.length, 24);
  let walks = 0, crossing = 0;
  for (const a of spots) for (const b of spots) {
    if (a === b) continue;
    const walk = d.path([a[0], a[2]], [b[0], b[2]]);
    assert.ok(walk, `a walk from ${a} to ${b}`);
    walks++;
    let cross = false;
    for (let i = 1; i < walk.length && !cross; i++) {
      const p = walk[i - 1], q = walk[i], n = Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / 0.05);
      for (let s = 0; s <= n && !cross; s++) cross = inHole(p[0] + (q[0] - p[0]) * s / n, p[2] + (q[2] - p[2]) * s / n);
    }
    if (cross) crossing++;
  }
  assert.equal(walks, 552);
  assert.equal(crossing, 0, `${crossing} of ${walks} walks across a hatchway`);
  for (const s of spots) assert.ok(!inHole(s[0], s[2]), `a spot over a hatchway: ${s}`);
  // her crew's hatch: on her deck, beside her fore hatchway, never over the hole
  const life = createCrewLife({ deck: d, roster: crewRoster({ hull: HULL.SmallShip, seed: 1, crew: 24 }).slice(0, 6), seed: 1 });
  const hatch = life.hatch, fore = MEASURED.hatchFore;
  assert.ok(d.walkable(hatch[0], hatch[2]) && Math.abs(hatch[1] - main) < 0.01, `her hatch on her main deck: ${hatch}`);
  assert.ok(!inHole(hatch[0], hatch[2]), `never over the hole: ${hatch}`);
  const gap = Math.max(Math.abs(hatch[0]) - fore.halfX, 0, fore.z0 - hatch[2], hatch[2] - fore.z1);
  assert.ok(gap < 1.2, `beside her fore hatchway (${gap.toFixed(2)} m off its edge): ${hatch}`);
  // a foe gone down her open aft hatchway: back on her deck at its edge, never on the air over it
  const boat = standing(HULL.SmallShip), body = leashOne(d, boat);
  for (const y of [5.9, 5.0, 3.0, 1.1]) {
    const got = body.step([1.9, main, -4.5], [0.4, y, -4.5]);
    assert.ok(Math.abs(got[1] - main) < 0.01 && !inHole(got[0], got[2]) && d.walkable(got[0], got[2]), `fallen to ${y} down her aft hatchway: set at ${got.map((v) => v.toFixed(3))}`);
  }
  // her doors still walls: her great cabin a room of its own, her deck before her castle's door no way into it
  assert.ok(d.pieceAt(0, -14, 6.2) > 0, 'her great cabin a piece of its own');
  assert.equal(d.walkable(0, -10.4), false, 'her castle\'s doorway no deck');
  // the Carrack's hatchways: no deck over them. PIN MOVED (SHIPS-2, 2026-10-07): the Carrack is Mac's carrack now - no
  // cargo doors over a hold (the mod's 4 x 5 m at 3.64), her two hatchways open companions down to her gun deck, each
  // under a house of hers (world/carrackModel.js MEASURED)
  const carrack = pool.deckOf(HULL.Carrack, 0);
  for (const h of [CARRACK_MEASURED.hatchAft, CARRACK_MEASURED.hatchFore]) {
    assert.deepEqual(cellsOf(carrack).filter((c) => Math.abs(c[0]) < h.halfX && c[2] > h.z0 && c[2] < h.z1).length, 0, `no cell over the Carrack's hatchway at ${h.z0}`);
  }
  // THE RULE: the pool marks what opens, and nothing but those parts' floors leaves any hull's deck - every hull baked
  // here off her own colliders with them marked as the pool marks them (a DoorTrigger under the node) is the pool's
  // deck, and baked with none marked differs from it at those parts' floors and the inset's margin round them alone
  const opens = (node) => !!node?.children?.some((k) => k.name === 'DoorTrigger');
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const probe = standing(hull), frame = invertAffine(probe.MeshObject.worldMatrix()), meshes = [];
    for (const { node, collider: c, world } of colliderPoses(probe.GameObject)) {
      if (c.m_IsTrigger || c.m_Enabled === false) continue;
      const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : c.classicModel != null ? null : geometry(c);
      if (!g) continue;
      const mm = multiply(frame, world, new Float32Array(16)), p = g.positions, out = new Float64Array(p.length);
      for (let i = 0; i < p.length; i += 3) { out[i] = mm[0] * p[i] + mm[4] * p[i + 1] + mm[8] * p[i + 2] + mm[12]; out[i + 1] = mm[1] * p[i] + mm[5] * p[i + 1] + mm[9] * p[i + 2] + mm[13]; out[i + 2] = mm[2] * p[i] + mm[6] * p[i + 1] + mm[10] * p[i + 2] + mm[14]; }
      meshes.push({ positions: out, indices: g.indices, moves: opens(node), name: node?.name });
    }
    const b = hullBuild(hull), ext = { minX: -b.halfWidth - 1, maxX: b.halfWidth + 1, minZ: b.aftZ - 1, maxZ: b.bowZ + 1 };
    const marked = buildDeck(meshes, ext), plain = buildDeck(meshes.map((q) => ({ ...q, moves: false })), ext), real = pool.deckOf(hull, 0);
    if (hull !== HULL.LargeGalley) assert.deepEqual([...marked.y].map(String), [...real.y].map(String), `${HULL_NAMES[hull]}: the pool's deck is hers with what opens marked`);
    const lids = meshes.filter((q) => q.moves).map((q) => q.name);
    const gone = cellsOf(plain).filter((c) => !marked.walkable(c[0], c[2]));
    if (hull === HULL.SmallShip) assert.deepEqual([lids.length, gone.length], [4, 82], `the galleon: her covers and her doors marked (${lids}), her hatchways' 82 cells gone`);
    // PIN MOVED (SHIPS-2, 2026-10-07): Mac's carrack's middle house's two door leaves are all of hers that open - shut,
    // a wall either way, and no floor of hers gone (the mod's Carrack's five doors and two cargo doors took her cargo
    // hatch's 116 cells)
    else if (hull === HULL.Carrack) assert.deepEqual([lids.length, gone.length], [2, 0], `the Carrack: her house door's leaves marked (${lids}), no floor gone`);
    else assert.equal(gone.length, 0, `${HULL_NAMES[hull]}: her deck the bake it was (${lids})`);
    for (const c of gone) assert.ok(hull === HULL.SmallShip ? holes.some((h) => Math.abs(c[0]) < h.halfX + 0.6 && c[2] > h.z0 - 0.6 && c[2] < h.z1 + 0.6) : c[0] > -2.6 && c[0] < 2.6 && c[2] > 0.4 && c[2] < 6.6, `${HULL_NAMES[hull]}: a cell gone away from her hatch: ${c}`);
  }
});

// ── D8: a tread's underside ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D8 A TREAD LOOKS UP: two floors a cell apart (0 and 0.8 m - past the motors\' step) join over a tread only where an UPWARD face lies a step from each at the side they share - a plank\'s underside there (a face looking down, 0.4 m up) joined them as a flight, a 0.8 m riser walked; every hull\'s bake as it was (mutants: |n.y| read again)', async () => {
  const P = [], I = [];
  const tri = (a, b, c) => { const n = P.length / 3; P.push(...a, ...b, ...c); I.push(n, n + 1, n + 2); };
  const flat = (x0, x1, z0, z1, y) => { tri([x0, y, z0], [x0, y, z1], [x1, y, z1]); tri([x0, y, z0], [x1, y, z1], [x1, y, z0]); };
  flat(-6, 0, -3, 3, 0);   // her main deck
  flat(0, 3, -3, 3, 0.8);   // a raised floor 0.8 m up, beside it
  const riser = (x, z0, z1, y0, y1) => { tri([x, y0, z0], [x, y1, z0], [x, y1, z1]); tri([x, y0, z0], [x, y1, z1], [x, y0, z1]); };
  riser(0, -3, 3, 0, 0.8);
  // a plank's underside along their seam, 0.4 m up and looking down - a sliver no cell's centre stands under
  tri([-0.1, 0.4, -3], [0.1, 0.4, 3], [-0.1, 0.4, 3]); tri([-0.1, 0.4, -3], [0.1, 0.4, -3], [0.1, 0.4, 3]);
  const d = buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -6, maxX: 3, minZ: -3, maxZ: 3 }, { inset: 0 });
  assert.equal(d.heightAt(-0.25, 0), 0, 'her main deck');
  assert.equal(d.walkable(1.5, 0), false, 'the floor 0.8 m up no part of her open deck: no walk up the riser');
  assert.ok(!d.flights, 'no flight over a face looking down');
  const walk = d.path([-3, 0], [1.5, 0]);
  assert.ok(walk && walk.every((p) => Math.abs(p[1]) < 1e-6), 'a walk toward it stays on her main deck');
  // the plank's top (an upward face) is a tread: the two join over it, a flight
  const P2 = [...P], I2 = [...I], n0 = P2.length / 3;
  P2.push(-0.1, 0.4, -3, -0.1, 0.4, 3, 0.1, 0.4, 3, 0.1, 0.4, -3);
  I2.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
  const d2 = buildDeck([{ positions: Float64Array.from(P2), indices: Uint32Array.from(I2) }], { minX: -6, maxX: 3, minZ: -3, maxZ: 3 }, { inset: 0 });
  assert.ok(d2.walkable(1.5, 0) && d2.flights?.some((v) => v), 'a tread looking up joins them');
  assert.ok(Math.abs(d2.path([-3, 0], [1.5, 0]).at(-1)[1] - 0.8) < 1e-6, 'a walk up over it');
});

// ── D9: the spots' cache ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON D9 THE SPOTS AT A LEVEL, CACHED FIRST: a second deck.spots(n, level) reads none of her cells - it is the array the first made, looked up before anything is filtered or laid out (a cached call filtered her every cell first: 130-170 us on the galleon and the Carrack, each crew stood and each muster); a level that keeps her every cell is her whole deck\'s spots; a level with none, none (mutants: the filter before the lookup, a level\'s spots kept by the count alone)', async () => {
  const nx = 12, nz = 20, base = new Float32Array(nx * nz).fill(NaN);
  for (let k = 1; k < nz - 1; k++) for (let i = 1; i < nx - 1; i++) base[k * nx + i] = k > 14 ? 1.5 : 1;   // a deck at 1, a step over her end
  let reads = 0;
  const y = new Proxy(base, { get: (t, k) => { if (typeof k === 'string' && /^\d+$/.test(k)) reads++; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
  const d = deckGrid({ cell: 0.5, minX: 0, minZ: 0, nx, nz, y });
  const first = d.spots(16, 1);
  assert.equal(first.length, 16);
  assert.ok(first.every((p) => Math.abs(p[1] - 1) < 1e-6), 'her main deck\'s spots');
  reads = 0;
  assert.equal(d.spots(16, 1), first, 'the same array');
  assert.equal(reads, 0, `a cached call read ${reads} of her cells`);
  assert.ok(d.spots(16, 1.5).every((p) => Math.abs(p[1] - 1.5) < 1e-6));
  assert.equal(d.spots(16, 1), first, 'kept by its level');
  // a level that keeps every cell (1.25: both within DECK_STEP): her whole deck's spots, the one array
  const whole = d.spots(8);
  assert.equal(d.spots(8, 1.25), whole, 'a level keeping her every cell is her whole deck\'s');
  reads = 0;
  assert.equal(d.spots(8, 1.25), whole);
  assert.equal(reads, 0);
  assert.equal(d.spots(8, 9).length, 0, 'none at a level of none');
  reads = 0;
  d.spots(8, 9);
  assert.equal(reads, 0, 'a level of none, cached too');
  // on her real decks: a cached call costs a lookup
  const pool = await readyPool();
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    const deck = pool.deckOf(hull, 0), main = mainLevel(deck), s = deck.spots(24, main);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) assert.equal(deck.spots(24, main), s);
    const us = (performance.now() - t0) / 2000 * 1000;
    assert.ok(us < 20, `${HULL_NAMES[hull]}: a cached spots(24, main) ${us.toFixed(2)} us`);
  }
});

// ── D10: her hands idle on her main deck, and the comments ────────────────────────────────────────────────────────

test('AUDIT GALLEON D10 HER HANDS IDLE ON HER MAIN DECK: a hand gone up her flight to talk with her officer at the helm comes back down the moment the talk ends - no hand idles, waits or is sought for a talk on her castle (the galleon\'s eight hands idled, waited and talked among themselves up there ~380 s of every 1740); her officers still talked with; and the comments that said otherwise say what was measured (mutants: the walk down unasked, a hand on her castle sought)', async () => {
  const pool = await readyPool();
  const d = pool.deckOf(HULL.SmallShip, 0), main = mainLevel(d);
  const flats = peopleFlatsOf(standing(HULL.SmallShip)).filter((f) => f.feet[1] >= main - DECK_STEP).map((f) => f.feet);
  // a day, a fight, a muster each way, a night and a day's work (the audit's run, 1740 s), five crews of eight: every
  // stretch a hand stands idle (or waits on a mate, or works) off her main deck - one step at most, the step he turns
  // to walk back down - and every second he talks there, and with whom
  let idleUp = 0, longest = 0, talkUp = 0, handTalkUp = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const roster = crewRoster({ hull: HULL.SmallShip, seed, crew: 32 }).slice(0, 8);
    while (roster.length < 8) roster.push({ mobile: 0, gender: 'male' });
    const life = createCrewLife({ deck: d, roster, seed, places: flats });
    const stretch = new Map();
    for (const [secs, ctx] of [[600, {}], [120, { battle: true }], [60, { muster: 1 }], [60, { muster: -1 }], [300, { asleep: true }], [600, { work: 0.8 }]]) {
      for (let t = 0; t < secs; t += DT) {
        life.step(DT, ctx);
        for (const mm of life.members) {
          const up = !mm.gone && !mm.below && !mm.station && mm.pos[1] > main + DECK_STEP;
          const idle = up && (mm.state === 'idle' || mm.state === 'wait' || mm.state === 'work' || mm.state === 'toWork' || mm.state === 'watch');
          const s = idle ? (stretch.get(mm) ?? 0) + DT : 0;
          stretch.set(mm, s);
          if (idle) { idleUp += DT; longest = Math.max(longest, s); }
          if (up && (mm.state === 'talk' || mm.state === 'toTalk')) { talkUp += DT; if (mm.mate && !mm.mate.station) handTalkUp += DT; }
        }
      }
    }
  }
  assert.ok(longest <= DT + 1e-9, `a hand stood idle off her main deck ${longest.toFixed(1)} s at a stretch (${idleUp.toFixed(1)} s in all)`);
  assert.equal(Math.round(handTalkUp), 0, `her hands talked among themselves off her main deck ${handTalkUp.toFixed(1)} s`);
  assert.ok(talkUp > 30, `her officers talked with (${talkUp.toFixed(0)} s of hands up with them)`);
  // a hand coming down her port flight with the player standing in his way on it: his walk given up (CREW_BLOCKED_S)
  // leaves him on a tread - from there he sets off down again at once, never idling up there
  const life = createCrewLife({ deck: d, roster: Array.from({ length: 4 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 2 });
  life.step(DT, {});
  const hand = life.members.find((x) => x !== life.lookout());
  for (const x of life.members) if (x !== hand) { x.pos = [...d.nearest(3, 10, main)]; x.state = 'ready'; x.path = null; }
  hand.pos = [-4.11, d.heightAt(-4.11, -14.16), -14.16]; hand.state = 'walk'; hand.speed = 1.2; hand.leg = 0;
  hand.path = d.path([hand.pos[0], hand.pos[2]], [-4.11, -6]);
  const avoid = [-4.11, d.heightAt(-4.11, -11.16), -11.16];
  let gaveUp = 0, stretch = 0, worst = 0;
  for (let t = 0; t < 12; t += DT) {
    const was = hand.state;
    life.step(DT, { avoid });
    if (was === 'walk' && hand.state === 'idle' && hand.pos[1] > main + DECK_STEP) gaveUp++;
    stretch = hand.state === 'idle' && hand.pos[1] > main + DECK_STEP ? stretch + DT : 0;
    worst = Math.max(worst, stretch);
  }
  assert.ok(gaveUp >= 1, 'his walk given up on her flight');
  assert.ok(worst <= DT + 1e-9, `idle on her flight ${worst.toFixed(1)} s at a stretch`);
  // and a hand who stands on her castle (held idle there) is never sought for a talk by one deciding on her main deck
  // below its front - forty decisions, the castle's hand the only idle man in reach
  const l3 = createCrewLife({ deck: d, roster: Array.from({ length: 4 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 4 });
  l3.step(DT, {});
  const [up, below] = l3.members.filter((x) => x !== l3.lookout());
  for (const x of l3.members) if (x !== up && x !== below) { x.pos = [...d.nearest(3, 10, main)]; x.state = 'ready'; x.path = null; }
  let sought = 0, talked = 0;
  for (let k = 0; k < 40; k++) {
    up.pos = [-2.11, MEASURED.castleRoofY, -14.16]; up.state = 'idle'; up.t = 1e9; up.path = null; up.mate = null; up.talk = null;
    below.pos = [...d.nearest(0, -8.66, main)]; below.state = 'idle'; below.t = 0; below.path = null; below.mate = null; below.talk = null;
    l3.step(DT, {});
    if (below.mate) talked++;
    if (below.mate === up) sought++;
  }
  assert.equal(sought, 0, `the hand on her castle sought for a talk ${sought} times of 40`);
  assert.equal(talked, 0, 'nobody else in reach to talk to');
  // the comments: what was measured
  const DECK = src('src/systems/naval/navalDeck.js'), HOST = src('src/scenes/navalHost.js');
  assert.doesNotMatch(DECK, /as often as one/, 'two risers between two centres "as often as one": four of fourteen gaps');
  assert.doesNotMatch(DECK, /at every\s+(?:\/\/\s*)?other tread/, 'cut "at every other tread": three times');
  assert.doesNotMatch(DECK, /a cell clear between its wells' walls/, 'one cell clear in the port well, two in the starboard\'s');
  assert.doesNotMatch(HOST, /DECK_REACH_M her rail's - feet at her main deck/, 'the aboard cut is mainLevel - DECK_STEP, on every hull');
});

// ── T4: a boarding's musters ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON T4 A BOARDING\'S MUSTERS STAND ON HER MAIN DECK: world.js navalDeckSpots asks her deck\'s spots at her main level - every one of a muster\'s spots on the new galleon (and the Carrack) within DECK_STEP of her main deck, never her castle\'s roof up its flights nor the Carrack\'s forecastle, the spots her whole deck would answer reaching both (mutants: the spots at no level)', async () => {
  const pool = await readyPool(), w = deckDoors(pool);
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    const boat = standing(hull), d = pool.deckOf(hull, 0), m = boat.MeshObject.worldMatrix(), main = mainLevel(d);
    // PIN MOVED (SHIPS-2, 2026-10-07): Mac's carrack has no raised deck a walk reaches (her houses' roofs no flight's;
    // the mod's Carrack's forecastle stood up its stair) - her deck one level, every spot of hers on it; the galleon's
    // castle the raised deck the musters must keep off
    if (hull === HULL.SmallShip) assert.ok(d.spots(48).some((p) => p[1] > main + 1), `${HULL_NAMES[hull]}: her whole deck's spots reach her raised deck`);
    else assert.ok(d.spots(48).every((p) => Math.abs(p[1] - main) <= DECK_STEP), `${HULL_NAMES[hull]}: her deck one level`);
    for (const n of [8, 16, 24, 48]) {
      const spots = w.navalDeckSpots(boat, n);
      assert.equal(spots.length, n);
      for (const [f] of spots) { const p = intoDeck(m, f); assert.ok(Math.abs(p[1] - main) <= DECK_STEP + 0.06, `${HULL_NAMES[hull]} spots(${n}): ${p.map((v) => v.toFixed(2))} on her main deck`); }
    }
  }
});

// ── D-wall: a wall's height in a cell ─────────────────────────────────────────────────────────────────────────────

/** A flat ground at 0 (x, z -4..4), a shelf at 1.5 over x -1..1, z -0.3..0.7 and, standing on the ground at z 0.2, one
 *  flat wall face - a pentagon low at x 0 (0.2 m) and high at x 4 (2.6 m) under the shelf's end - cut into triangles
 *  as a fan from corner `from` ('A' its foot at x 0, 'E' its top's knee at x 2): the same face, cut two ways. */
function shelfDeck(from) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  quad([-4, 0, -4], [-4, 0, 4], [4, 0, 4], [4, 0, -4]);
  quad([-1, 1.5, -0.3], [-1, 1.5, 0.7], [1, 1.5, 0.7], [1, 1.5, -0.3]);
  const A = [0, 0, 0.2], B = [4, 0, 0.2], C = [4, 2.6, 0.2], E = [2, 1.5, 0.2], D = [0, 0.2, 0.2];
  const ring = from === 'A' ? [A, B, C, E, D] : [E, D, A, B, C];
  const n = P.length / 3;
  for (const p of ring) P.push(...p);
  for (let q = 1; q + 1 < ring.length; q++) I.push(n, n + q, n + q + 1);
  return buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -4, maxX: 4, minZ: -4, maxZ: 4 });
}
const deckBake = (d) => JSON.stringify({ y: Array.from(d.y, String), more: d.more && [Array.from(d.more.at), Array.from(d.more.y), Array.from(d.more.piece)], floors: d.floors && [Array.from(d.floors.at), Array.from(d.floors.y)], flights: d.flights && Array.from(d.flights) });

test('AUDIT GALLEON D-wall A WALL\'S HEIGHT IN A CELL IS ITS OWN THERE: a near-vertical face walls each cell it stands over with its own part\'s height within the cell\'s square, never its whole triangle\'s - the same flat face cut two ways is the same deck (a fan from its foot walled the shelf over its low end 0-2.6 m, a fan from its knee 0-1.5 m: its part there is 0-0.53 m); a face on the line between two cells is the farther cell\'s, as a point on it is (Math.floor); and the new galleon\'s castle front, re-cut as Blender cuts it (a triangle from (-5.32, 6.18) to (-0.77, 8.77) whose sloping edge crosses her port flight 6.87 m up), walls none of her flight: her tread at 8.28 under it, her castle\'s roof and her flights her deck (they fell out of it, 168 cells, under the whole triangle\'s 6.18-8.77) (mutants: the whole triangle\'s height again, a face on a cell\'s far line its)', async () => {
  // the same face cut two ways: one deck
  const byFoot = shelfDeck('A'), byKnee = shelfDeck('E');
  assert.equal(deckBake(byFoot), deckBake(byKnee), 'the same face cut two ways, the same deck');
  const shelf = (d) => { const j = Math.floor((0.25 + 4) / d.cell) + Math.floor((0.25 + 4) / d.cell) * d.nx, out = []; for (let n = d.floors.at[j]; n < d.floors.at[j + 1]; n++) out.push(d.floors.y[n]); return out; };
  assert.ok(shelf(byFoot).some((y) => Math.abs(y - 1.5) < 1e-6) && shelf(byKnee).some((y) => Math.abs(y - 1.5) < 1e-6), `the shelf over the wall's low end a floor however it is cut (${shelf(byFoot)} | ${shelf(byKnee)})`);
  // a face on the line between two cells: the farther cell's (x 0 and z 0 are lines of the grid from -4)
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  quad([-4, 0, -4], [-4, 0, 4], [4, 0, 4], [4, 0, -4]);
  quad([0, 0, -1], [0, 2, -1], [0, 2, 1], [0, 0, 1]);   // along x 0, z -1..1
  quad([-3, 0, -2], [-3, 2, -2], [-1, 2, -2], [-1, 0, -2]);   // along z -2, x -3..-1
  const lines = buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -4, maxX: 4, minZ: -4, maxZ: 4 });
  const ground = (x, z) => { const j = Math.floor((z + 4) / lines.cell) * lines.nx + Math.floor((x + 4) / lines.cell); for (let n = lines.floors.at[j]; n < lines.floors.at[j + 1]; n++) if (Math.abs(lines.floors.y[n]) < 1e-6) return true; return false; };
  assert.equal(ground(0.25, 0.25), false, 'x 0..0.5: the wall along x 0 is its');
  assert.equal(ground(-0.25, 0.25), true, 'x -0.5..0: the wall on its far line is not its');
  assert.equal(ground(-2.25, -1.75), false, 'z -2..-1.5: the wall along z -2 is its');
  assert.equal(ground(-2.25, -2.25), true, 'z -2.5..-2: the wall on its far line is not its');
  // the new galleon's castle front as Blender cuts it
  const F = facesOf(HULL.SmallShip);
  let front = null;
  for (const list of F.walls.values()) for (const w of list) if (Math.abs(w.x0 + 5.32) < 0.01 && Math.abs(w.x1 + 0.77) < 0.01 && Math.abs(w.y0 - 6.18) < 0.01 && Math.abs(w.y1 - 8.77) < 0.01 && Math.abs(w.z0 + 10.3) < 0.01 && Math.abs(w.z1 + 10.3) < 0.01) front = w;
  assert.ok(front, 'her castle front\'s triangle from (-5.32, 6.18) to (-0.77, 8.77) at z -10.30');
  const pool = await readyPool();
  const d = pool.deckOf(HULL.SmallShip, 0), main = mainLevel(d);
  assert.ok(Math.abs(d.heightAt(-4.11, -10.16) - 8.28) < 0.01 && d.walkable(-4.11, -10.16), `her port flight's tread over it: ${d.heightAt(-4.11, -10.16)}`);
  assert.ok(front.y1 > d.heightAt(-4.11, -10.16) + DECK_STEP, 'the whole triangle\'s height walls that tread (the old marking\'s)');
  assert.equal(cellsOf(d).filter((c) => c[1] > main + DECK_STEP).length, 174, 'her castle\'s roof and her flights her deck - 174 cells');
});

test('AUDIT GALLEON D-wall HER DECK AS SHE STANDS: her entry ports (her bulwark open from z -0.58 to 1.58 on both sides, her side 0.12 m over her deck there) are deck a cell further out than her bulwark lets it run, and a boarder put aboard from off her side comes down ACROSS from where he stood - of his own row of cells, the main-deck cell nearest him (the nearest of all drew a man 9 m off her side at z 2 to her entry port\'s corner at z 1.09); every hull\'s open deck is one walk (the room under the Carrack\'s forecastle, opened to her waist, stood four cells apart from every walk - her lookout\'s bow in one); a floor to stand aboard on looks up (her bottom\'s and her flare\'s undersides stood the water round her aboard, 1.03%) (mutants: the nearest of all, the cells apart kept, the floors either way up)', async () => {
  const pool = await readyPool();
  // her entry ports, and a landing across
  const g = pool.deckOf(HULL.SmallShip, 0), gm = mainLevel(g);
  for (const side of [1, -1]) {
    const port = side > 0 ? 4.39 : -4.61, wall = side > 0 ? 3.89 : -4.11;
    for (const z of [-0.16, 0.34, 0.84]) assert.ok(g.walkable(port, z), `her entry port's cell (${port}, ${z})`);
    for (const z of [-0.66, 1.34, 2.34]) assert.ok(!g.walkable(port, z) && g.walkable(wall, z), `her bulwark's inset at z ${z}`);
  }
  const at = g.land(14, 2, gm + 1.8);
  assert.ok(Math.abs(at[2] - 2) < 1e-9 && Math.abs(at[0] - 4.14) < 0.01 && Math.abs(at[1] - gm) < 1e-6, `across from him at z 2: ${at.map((v) => v.toFixed(3))}`);
  const near = g.clamp(14, 2);
  assert.ok(near[2] < 1.1, `the nearest of all her entry port's corner: ${near.map((v) => v.toFixed(3))}`);
  const atPort = g.land(14, 0.3, gm + 1.8), off = g.land(-14, -15, gm + 1.8);
  assert.ok(Math.abs(atPort[0] - 4.64) < 0.01 && Math.abs(atPort[2] - 0.3) < 1e-9, `at her entry port, its cell: ${atPort.map((v) => v.toFixed(3))}`);
  assert.ok(Math.abs(off[1] - gm) <= NAVAL_DECK.DECK_FLOOR, `abeam her castle (no main deck in his row) her main deck nearest: ${off.map((v) => v.toFixed(2))}`);
  // every hull's open deck one walk - side steps within DECK_JOIN or up a flight (deck.path's own)
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0), { nx, y, flights } = d, seen = new Uint8Array(y.length);
    const first = y.findIndex((v) => !Number.isNaN(v)), stack = [first];
    let n = 0;
    seen[first] = 1;
    while (stack.length) {
      const j = stack.pop(), i = j % nx;
      n++;
      for (const [b, bit] of [[i > 0 ? j - 1 : -1, flights?.[j - 1] & 1], [i < nx - 1 ? j + 1 : -1, flights?.[j] & 1], [j - nx, flights?.[j - nx] & 2], [j + nx, flights?.[j] & 2]]) {
        if (b < 0 || b >= y.length || seen[b] || Number.isNaN(y[b])) continue;
        if (!(Math.abs(y[b] - y[j]) <= NAVAL_DECK.DECK_JOIN) && !bit) continue;
        seen[b] = 1; stack.push(b);
      }
    }
    assert.equal(n, d.count, `${HULL_NAMES[hull]}: every cell of her open deck one walk (${n} of ${d.count})`);
  }
  const carrack = pool.deckOf(HULL.Carrack, 0), cm = mainLevel(carrack);
  const life = createCrewLife({ deck: carrack, roster: [{ mobile: MOBILE.Warrior, gender: 'male' }], seed: 1 });
  const from = carrack.nearest(0, 0, cm), walk = carrack.path([from[0], from[2]], [life.bow[0], life.bow[2]]);
  assert.ok(walk && Math.hypot(walk.at(-1)[0] - life.bow[0], walk.at(-1)[2] - life.bow[2]) < 1e-6, `the Carrack's bow a walk's end (${life.bow.map((v) => v.toFixed(2))})`);
  // PIN MOVED (SHIPS-2, 2026-10-07): the room under the mod's Carrack's forecastle (her floor beside her walk at four
  // cells) is gone with her - Mac's carrack has no forecastle, her open deck one walk from her waist to her bow (above)
  // a floor to stand aboard on looks up
  for (const hull of [HULL.SmallShip, HULL.Carrack, HULL.LargeGalley]) {
    const d = pool.deckOf(hull, 0), Fh = facesOf(hull);
    let n = 0, down = 0;
    for (let j = 0; j < d.y.length; j++) {
      const i = j % d.nx, k = (j - i) / d.nx, x = d.minX + (i + 0.5) * d.cell, z = d.minZ + (k + 0.5) * d.cell, hs = heightsAt(Fh, x, z);
      for (let q = d.floors.at[j]; q < d.floors.at[j + 1]; q++) { n++; if (!hs.some(([h, f]) => f.up && Math.abs(h - d.floors.y[q]) < 2e-3)) down++; }
    }
    assert.ok(n > 2000, `${HULL_NAMES[hull]}: her floors (${n})`);
    assert.equal(down, 0, `${HULL_NAMES[hull]}: ${down} of her ${n} floors aboard a face looking down`);
  }
});

test('AUDIT GALLEON D-wall A TALK\'S PLACE ON HER MAIN DECK: a hand coming over to talk with one on her main deck takes his place on it - a flight\'s foot tread within a step of it, never two and three treads up beside him (a deck 7 m square with a stair as wide up its fore side: 12.3 s of four ten-minute runs a hand stood 0.6-0.9 m up it to talk, the Carrack\'s forecastle stair 7-13 s a run); her deck\'s clamp asked at a level answers a cell within a step of it (mutants: the place at any level, the level unread)', () => {
  const P = [], I = [];
  const quad = (a, b, c, e) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...e); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const flat = (x0, x1, z0, z1, y) => quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  flat(-3.5, 3.5, -3.5, 3.5, 0);
  for (let t = 0; t < 5; t++) flat(-3.5, 3.5, 3.5 + t * 0.5, 4 + t * 0.5, 0.3 * (t + 1));   // 0.3 m treads, 7 m wide
  flat(-3.5, 3.5, 6, 9, 1.5);
  const deck = buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -5, maxX: 5, minZ: -5, maxZ: 10 });
  const main = mainLevel(deck);
  assert.ok(Math.abs(main) < 1e-6 && cellsOf(deck).filter((c) => c[1] > main + DECK_STEP).length > 50, 'her main deck at 0, her stair and raised deck over it her deck');
  const at = deck.clamp(-1.25, 4.75, [0, 0, 0], 0, main), any = deck.clamp(-1.25, 4.75);
  assert.ok(Math.abs(at[1] - main) <= DECK_STEP && any[1] > main + DECK_STEP, `clamp at her main level: ${at.map((v) => v.toFixed(2))} (any level ${any.map((v) => v.toFixed(2))})`);
  let up = 0, talked = 0;
  for (const seed of [1, 2, 3, 4]) {
    const life = createCrewLife({ deck, roster: Array.from({ length: 8 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed });
    for (let t = 0; t < 600; t += DT) {
      life.step(DT, {});
      for (const m of life.members) { if (m.pos[1] > main + DECK_STEP) up += DT; if (m.state === 'talk') talked += DT; }
    }
  }
  assert.ok(talked > 1000, `her hands talked (${talked.toFixed(0)} s)`);
  assert.equal(Math.round(up * 10), 0, `a hand off her main deck ${up.toFixed(1)} s`);
});

// ── every hull and every rig ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON THE BAKES: every hull\'s deck - every rig of hers the one her rig 0 bakes - as the deck lens left it (PIN MOVED, AUDIT GALLEON D-wall: each wall its own height in a cell): the galleon\'s 838 cells (her hatchways out, her entry ports and her bow to her side), her main deck\'s 664 and her castle and flights over it; the Rowboat\'s 13 as it was, the Large Galley\'s 4016; PIN MOVED (SHIPS-2, 2026-10-07): the Carrack\'s 1087 (Mac\'s carrack: her main deck at 7.81 one level, her houses, her masts\' partners and her helm out) and the Large Boat\'s 95 (Mac\'s Tiny Ship: her deck at 0.90 and her helmsman\'s step at 1.55) where the mod\'s were 511 and 18', async () => {
  const pool = await readyPool();
  const counts = Array.from(HULL_NAMES, (_, hull) => pool.deckOf(hull, 0).count);
  assert.deepEqual(counts, [13, 95, 838, 4016, 1087]);
  const g = pool.deckOf(HULL.SmallShip, 0);
  assert.equal(cellsOf(g).filter((c) => Math.abs(c[1] - mainLevel(g)) <= DECK_STEP).length, 664, 'the galleon\'s main deck');
  for (let hull = 0; hull < HULL_NAMES.length; hull++) for (let v = 1; v < HULL_VARIANT_COUNTS[hull]; v++) assert.equal(pool.deckOf(hull, v), pool.deckOf(hull, 0));
  assert.ok(NAVAL_DECK.FLIGHT_JOIN > NAVAL_DECK.DECK_JOIN);
});
