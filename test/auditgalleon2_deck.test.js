// AUDIT GALLEON-2 (2026-10-03) - HER DECK AND HER CREW, AGAIN: the second audit's deck lens over the new galleon (hull 2,
// the Small Ship) and every hull beside her - DK1 a shut cover stood on, DK2 the leash on a piece of two levels, DK3 her
// doors, DK4 the mod's galleon's count, TS9 a flight climbed square - each pinned over the real code: her deck baked by
// the real pool (test/navalSea.mjs) off her own colliders, world.js's leash lifted whole (the suites' own way,
// test/auditgalleon_deck.test.js), the naval host's own aboard(), and a pool whose new galleon will not load.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildDeck, deckOf as deckGrid, intoDeck, outOfDeck, mainLevel, DECK_STEP, DECK_HEADROOM } from '../src/systems/naval/navalDeck.js';
import { Boat, spawnBoat, HULL_NAMES } from '../src/systems/comeSailAwayBoat.js';
import { colliderPoses, boxColliderTriangles, invertAffine, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { multiply } from '../src/world/mat4.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';
import { MELEE_DISTANCE } from '../src/characters/enemyMotor.js';
import * as ships from '../src/systems/naval/navalShips.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { MODELS, ctxFor, modCtxFor } from './csaScene.mjs';
import { sea, readyPool, modShipsPool } from './navalSea.mjs';

const { hullBuild, HULL } = ships;
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
const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null);
/** A hull stood at rest - her colliders, her mesh node's frame. */
const standing = (hull, variant = 0) => { const b = new Boat(hull, variant); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
/** SHIPS-2: a hull stood as the mod built it - hull 4 the mod's own Carrack, the game's when the new carrack's model will
 *  not load (test/navalSea.mjs modShipsPool): her cargo doors, her forecastle's stair and her five doors, the laws
 *  below were found on and still hold her. */
const standingMod = (hull, variant = 0) => { const b = new Boat(hull, variant); spawnBoat(b, modCtxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
/** A deck's cells' centres, `[x, y, z]` in her frame. */
const cellsOf = (d) => { const out = []; for (let j = 0; j < d.y.length; j++) if (!Number.isNaN(d.y[j])) { const i = j % d.nx, k = (j - i) / d.nx; out.push([d.minX + (i + 0.5) * d.cell, d.y[j], d.minZ + (k + 0.5) * d.cell]); } return out; };
const fmt = (p) => p.map((v) => v.toFixed(2)).join(', ');

/** world.js's deck registry, leash and carry, over `csa` (a pool, or a stand-in with its deckOf) and `foes`. */
function leashRig(csa, foes) {
  const body = `const { intoDeck, outOfDeck, DECK_STEP, csa, exteriorFoes } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}
    ${line('  const _deckBodies = new Set();')}${line('  const navalDeckBody = (f, boat) =>')}${line('  const navalHullStands = ')}${line('  const _leashLocal = [0, 0, 0];')}
    ${lift('navalLeash')}${lift('navalCarry')}
    return { navalLeash, navalCarry, navalDeckBody, bodies: _deckBodies };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ intoDeck, outOfDeck, DECK_STEP, csa, exteriorFoes: foes });
}
/** One body on her deck under the lifted leash: `step(from, to)` - where the leash leaves a body that stood at `from`
 *  (her frame) a frame ago and stands at `to` now; `press(to)` - on from wherever the leash left it last. */
function leashOne(deck, boat) {
  const foes = [], w = leashRig({ deckOf: () => deck }, { foes }), m = boat.MeshObject.worldMatrix();
  const f = { dead: false, ai: { feet: [0, 0, 0] }, entity: {} };
  foes.push(f);
  w.navalDeckBody(f, boat);
  return {
    f,
    step(from, to) { f.ai.feet = outOfDeck(m, from); w.navalLeash(); f.ai.feet = outOfDeck(m, to); w.navalLeash(); return intoDeck(m, f.ai.feet); },
    press(to) { f.ai.feet = outOfDeck(m, to); w.navalLeash(); return intoDeck(m, f.ai.feet); },
  };
}

// ── her own faces, for the probes (test/auditgalleon_deck.test.js's own) ──────────────────────────────────────────

const KEY = (i, k) => i * 4096 + k;
const bucketed = (faces) => {
  const map = new Map();
  for (const f of faces) for (let i = Math.floor(f.x0); i <= Math.floor(f.x1); i++) for (let k = Math.floor(f.z0); k <= Math.floor(f.z1); k++) { const key = KEY(i, k); if (!map.has(key)) map.set(key, []); map.get(key).push(f); }
  return map;
};
/** Her colliders' faces in her deck's frame (at rest; a classic model's cpu triangles aside): `floors` every face with a
 *  height at a point (`up` an upward one within 30 degrees of level), `walls` the near-vertical ones, each bucketed by
 *  the metre; `moves` whether the face is a part's that opens and shuts (a DoorTrigger under its node - the pool's own
 *  mark). `geo` reads a collider's triangles (the suites' models unless asked). */
function facesOf(hull, boat = standing(hull), geo = geometry) {
  const frame = invertAffine(boat.MeshObject.worldMatrix());
  const walls = [], floors = [];
  for (const { node, collider: c, world } of colliderPoses(boat.GameObject)) {
    if (c.m_IsTrigger || c.m_Enabled === false) continue;
    const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : geo(c);
    if (!g) continue;
    const moves = !!node?.children?.some((k) => k.name === 'DoorTrigger');
    const m = multiply(frame, world, new Float32Array(16)), p = g.positions, ix = g.indices;
    const at = (i) => [m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12], m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13], m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14]];
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const [ax, ay, az] = at(ix[t] * 3), [bx, by, bz] = at(ix[t + 1] * 3), [cx, cy, cz] = at(ix[t + 2] * 3);
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx, len = Math.hypot(nX, nY, nZ);
      if (!(len > 1e-12)) continue;
      const f = { ax, ay, az, bx, by, bz, cx, cy, cz, moves, name: node?.name ?? '', x0: Math.min(ax, bx, cx), x1: Math.max(ax, bx, cx), y0: Math.min(ay, by, cy), y1: Math.max(ay, by, cy), z0: Math.min(az, bz, cz), z1: Math.max(az, bz, cz), up: nY > Math.cos(Math.PI / 6) * len };
      if (Math.abs(nY) < 0.05 * len) { walls.push(f); continue; }
      f.det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(f.det) > 1e-12) floors.push(f);
    }
  }
  return { boat, walls: bucketed(walls), floors: bucketed(floors) };
}
/** Her parts that open and shut (a DoorTrigger under the node - the pool's own mark), each one's box in her deck's frame. */
function leavesOf(boat) {
  const frame = invertAffine(boat.MeshObject.worldMatrix()), out = [];
  for (const { node, collider: c, world } of colliderPoses(boat.GameObject)) {
    if (c.m_IsTrigger || c.m_Enabled === false || !node?.children?.some((k) => k.name === 'DoorTrigger')) continue;
    const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : geometry(c);
    if (!g) continue;
    const m = multiply(frame, world, new Float32Array(16)), p = g.positions, box = { name: node.name, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (let i = 0; i < p.length; i += 3) {
      const x = m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12], y = m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13], z = m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14];
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z);
    }
    out.push(box);
  }
  return out;
}
const heightOn = (f, x, z) => {
  if (x < f.x0 - 1e-9 || x > f.x1 + 1e-9 || z < f.z0 - 1e-9 || z > f.z1 + 1e-9) return NaN;
  const l1 = ((f.bz - f.cz) * (x - f.cx) + (f.cx - f.bx) * (z - f.cz)) / f.det, l2 = ((f.cz - f.az) * (x - f.cx) + (f.ax - f.cx) * (z - f.cz)) / f.det, l3 = 1 - l1 - l2;
  return l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9 ? NaN : l1 * f.ay + l2 * f.by + l3 * f.cy;
};
/** Every face of hers with a height at `(x, z)`: `[y, face]`. */
const heightsAt = (F, x, z) => { const out = []; for (const f of F.floors.get(KEY(Math.floor(x), Math.floor(z))) ?? []) { const y = heightOn(f, x, z); if (!Number.isNaN(y)) out.push([y, f]); } return out; };
const segD = (px, pz, x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz; let s = L2 ? ((px - x0) * dx + (pz - z0) * dz) / L2 : 0; s = Math.max(0, Math.min(1, s)); return Math.hypot(px - x0 - s * dx, pz - z0 - s * dz); };
/** Whether a wall of hers standing in `(lo, hi)` lies within `r` of `(x, z)` - `fixed` her fixed walls alone (a door's
 *  leaf, which opens, left out). */
const wallWithin = (F, x, z, lo, hi, r, fixed = false) => {
  for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let k = Math.floor(z - r); k <= Math.floor(z + r); k++) {
    for (const w of F.walls.get(KEY(i, k)) ?? []) {
      if ((fixed && w.moves) || !(w.y1 > lo && w.y0 < hi) || x < w.x0 - r || x > w.x1 + r || z < w.z0 - r || z > w.z1 + r) continue;
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

/** THE WALK EVERYWHERE (the reviewer's probe): a body standing on every standable floor of hers at or over her main deck
 *  that the leash leaves be, walking 0.75 m in 5 cm frames each of four ways with its feet on the surface it walks (the
 *  one within 0.3 m of the last, a capsule clear of every wall, a head's room) - how often the leash sets it more than
 *  DECK_STEP off that surface, and the first. */
function walkEverywhere(d, F, b) {
  const main = mainLevel(d), cache = new Map();
  const st = (x, z) => { const k = `${Math.round(x * 20)},${Math.round(z * 20)}`; let v = cache.get(k); if (!v) { v = standable(F, Math.round(x * 20) / 20, Math.round(z * 20) / 20); cache.set(k, v); } return v; };
  const near = (x, z, y) => { let best = NaN; for (const v of st(x, z)) if (Math.abs(v - y) <= 0.3 && !(Math.abs(best - y) <= Math.abs(v - y))) best = v; return best; };
  const body = leashOne(d, F.boat);
  let starts = 0, walks = 0, bad = 0, first = '';
  for (let x0 = -b.halfWidth; x0 <= b.halfWidth; x0 += 0.25) for (let z0 = b.aftZ; z0 <= b.bowZ; z0 += 0.25) {
    for (const y0 of st(x0, z0)) {
      if (y0 < main - DECK_STEP) continue;
      const s = body.step([x0, y0, z0], [x0, y0, z0]);
      if (Math.abs(s[0] - x0) > 1e-6 || Math.abs(s[2] - z0) > 1e-6 || Math.abs(s[1] - y0) > 1e-6) continue;   // the leash's own margin: not a start
      starts++;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        body.step([x0, y0, z0], [x0, y0, z0]);
        walks++;
        let y = y0;
        for (let n = 1; n <= 15; n++) {
          const x = x0 + dx * 0.05 * n, z = z0 + dz * 0.05 * n, t = near(x, z, y);
          if (Number.isNaN(t)) break;
          y = t;
          const got = body.press([x, y, z]);
          if (Math.abs(got[1] - y) > DECK_STEP) { bad++; first ||= `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) -> (${fmt(got)})`; break; }
          if (Math.hypot(got[0] - x, got[2] - z) > 0.02) break;   // held at an edge - its walk ends there
        }
      }
    }
  }
  return { starts, walks, bad, first };
}

// ── DK2: the leash on a piece of two levels ───────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 DK2: THE LEASH KEEPS A BODY ON THE LEVEL IT LAST STOOD ON - her open piece holds floors at two levels in some cells since D-wall (the deck under the Carrack\'s forecastle kept beside her walk as piece 0), and the leash took a piece\'s floor there nearest the body\'s height of the moment and its edge at any level: a body walking anywhere on any floor of hers at or over her main deck was set 2-3 m onto another level (the Carrack\'s 124 of 32904 walks, 3.64 <-> 6.77; none before D-wall), 6 of the 8 walks across her forecastle stair\'s top treads dropped 2.8 m, and 185 of the 914 standing points under her forecastle lifted 3.1 m onto it - now the floor of its piece nearest the one it LAST stood on, within FLIGHT_JOIN, else that piece\'s nearest cell within FLIGHT_JOIN of it, else its edge: none on any hull (mutants: the height of the moment again, its piece\'s floor at any distance, the edge at any level, the deck under her stair unread, the search blind to it)', async () => {
  const pool = await readyPool();
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0), F = facesOf(hull);
    const { starts, walks, bad, first } = walkEverywhere(d, F, hullBuild(hull));
    assert.ok(starts > 50, `${HULL_NAMES[hull]}: her standable starts (${starts})`);
    assert.equal(bad, 0, `${HULL_NAMES[hull]}: ${bad} of ${walks} walks set more than a step off the floor they walk - first ${first}`);
  }
  // the Carrack's forecastle stair: across its top treads, 5 cm a frame, the feet on the tread. SHIPS-2: the mod's own
  // Carrack's (Mac's carrack has no stair over her deck - her open deck one level, walked above)
  const mod = await modShipsPool();
  try {
  const d = mod.pool.deckOf(HULL.Carrack, 0), F = facesOf(HULL.Carrack, standingMod(HULL.Carrack)), main = mainLevel(d);
  const treadAt = (x, z, near) => { let best = NaN; for (const y of standable(F, x, z)) if (Math.abs(y - near) < 0.3 && !(Math.abs(best - near) < Math.abs(y - near))) best = y; return best; };
  let walks = 0, dropped = 0, first = '';
  for (let z = 11.8; z <= 14.6; z += 0.1) {
    const y0 = d.heightAt(0.32, z);
    if (!(y0 > main + DECK_STEP && y0 < 6.6)) continue;
    for (const dir of [-1, 1]) {
      const body = leashOne(d, F.boat);
      let y = treadAt(0.32, z, y0);
      if (Number.isNaN(y)) continue;
      body.step([0.32, y, z], [0.32, y, z]);
      walks++;
      for (let x = 0.32 + dir * 0.05; Math.abs(x - 0.32) < 1.2; x += dir * 0.05) {
        const t = treadAt(x, z, y);
        if (Number.isNaN(t)) break;
        y = t;
        const got = body.press([x, y, z]);
        if (got[1] < y - DECK_STEP) { dropped++; first ||= `z ${z.toFixed(2)} x ${x.toFixed(2)}: ${y.toFixed(2)} -> ${got[1].toFixed(2)}`; break; }
      }
    }
  }
  assert.equal(walks, 8, 'the walks across her stair\'s top treads');
  assert.equal(dropped, 0, `dropped off her stair: ${dropped} of ${walks} - first ${first}`);
  // standing on her main deck under her forecastle, no floor stood on before (a body new to the leash): never lifted,
  // and put on her deck under her forecastle beside it - a cell's diagonal across at the most, never slid out to her
  // waist (her deck there is her open piece's floor under her forecastle's, `more`)
  const body = leashOne(d, F.boat);
  let n = 0, lifted = 0, firstUp = '', across = 0, acrossAt = '';
  for (let x = -2; x <= 2; x += 0.1) for (let z = 13.6; z <= 16.6; z += 0.1) for (const y of standable(F, x, z)) {
    if (Math.abs(y - main) > 0.05) continue;
    n++;
    body.f.deckLocal = null;
    const got = body.press([x, y, z]), side = Math.hypot(got[0] - x, got[2] - z);
    if (got[1] > y + DECK_STEP) { lifted++; firstUp ||= `(${x.toFixed(2)}, ${z.toFixed(2)}) -> ${fmt(got)}`; }
    if (side > across) { across = side; acrossAt = `(${x.toFixed(2)}, ${z.toFixed(2)}) -> ${fmt(got)}`; }
  }
  assert.equal(n, 914, 'her standable main-deck points under her forecastle');
  assert.equal(lifted, 0, `lifted onto her forecastle standing still: ${lifted} of ${n} - first ${firstUp}`);
  assert.ok(across <= d.cell * Math.SQRT2, `moved ${across.toFixed(2)} m across her at ${acrossAt}`);
  // fallen through her main deck under her forecastle (stood on it a frame ago): back on it, never lifted onto her
  // forecastle - the floor of its piece nearest the one it stood on, never the one nearest where it fell to
  for (const [x, z] of [[0, 15.01], [-1, 14.51], [1, 15.51]]) for (const drop of [1.5, 2.5]) {
    const y0 = d.heightAt(x, z, main), got = leashOne(d, F.boat).step([x, y0, z], [x, y0 - drop, z]);
    assert.ok(Math.abs(y0 - main) < 0.01 && Math.abs(got[1] - main) < 0.01, `fallen ${drop} m through her deck at (${x}, ${z}): set at ${fmt(got)}`);
  }
  } finally { mod.restore(); }
});

test('AUDIT GALLEON-2 DK2: NEVER ONTO ANOTHER PIECE\'S FLOOR, WITHIN A FLIGHT\'S RISE OR PAST IT - two pieces of a deck beside each other across a 0.8 m ledge and no tread (past the motors\' step, within FLIGHT_JOIN): a body on either pressed over the ledge is put back on its own piece\'s edge at its own level, never stepped up or down onto the other (AUDIT GN-D1\'s law: the leash\'s threshold alone would let it) (mutants: any piece\'s floor in the cell, the piece filter unread, her open deck read in every piece)', () => {
  const P = [], I = [];
  const quad = (a, b, c, e) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...e); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  quad([-4, 0, -3], [-4, 0, 3], [0, 0, 3], [0, 0, -3]);   // her deck at 0
  quad([0, 0.8, -3], [0, 0.8, 3], [3, 0.8, 3], [3, 0.8, -3]);   // a platform 0.8 m up beside it
  quad([0, 0, -3], [0, 0.8, -3], [0, 0.8, 3], [0, 0, 3]);   // the ledge's face
  const d = buildDeck([{ positions: Float64Array.from(P), indices: Uint32Array.from(I) }], { minX: -4, maxX: 3, minZ: -3, maxZ: 3 }, { inset: 0 });
  const low = d.pieceAt(-2, 0, 0), high = d.pieceAt(1.5, 0, 0.8);
  assert.ok(low === 0 && high > 0, `her deck her open piece, the platform a piece of its own (${low}, ${high})`);
  const boat = { hull: 0, GameObject: { activeSelf: true }, MeshObject: { worldMatrix: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
  // off the platform over her deck, 0.8 m over it: back on the platform's edge
  const down = leashOne(d, boat).step([1.5, 0.8, 0], [-0.25, 0.8, 0]);
  assert.ok(Math.abs(down[1] - 0.8) < 1e-6 && down[0] >= 0, `kept on the platform: ${fmt(down)}`);
  // into the platform's ledge from her deck, 0.8 m under it: back on her deck's edge
  const up = leashOne(d, boat).step([-1.5, 0, 0], [0.25, 0, 0]);
  assert.ok(Math.abs(up[1]) < 1e-6 && up[0] <= 0, `kept on her deck: ${fmt(up)}`);
});

// ── DK1: a shut cover stood on ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 DK1: A SHUT COVER IS STOOD ON - D7 made a part that opens no floor, so the Carrack\'s two cargo doors (4 x 5 m mid her main deck, spawned shut) were a hole to standing aboard and to the leash: 600 of the 1575 points on them read ASHORE by the host\'s aboard() (none on the base or the galleon commits), and a boarder pressing across them at a player standing there was held 2.48 m off him (MELEE_DISTANCE 2.25); now her parts\' upward faces as they stand shut are baked beside her deck (`ajar`): standing aboard reads them, and the leash lets a body be within a step of one - her walk, her spots and a landing still never on one (D7), a foe gone down the open hatchway still set back at its edge (mutants: the covers unbaked, unread by aboard, unread by the leash, their margin unbaked, the leash\'s band a metre)', async () => {
  // SHIPS-2: the cargo doors are the mod's own Carrack's (test/navalSea.mjs modShipsPool - hull 4 as the game stands it
  // when the new carrack's model will not load); Mac's carrack has none (her hatchways open companions under her houses)
  const mod = await modShipsPool();
  try {
  for (const [hull, what, x0, x1, z0, z1, y, total] of [[HULL.Carrack, 'the Carrack\'s cargo doors', -2.01, 1.99, 1.0, 6.0, 3.64, 1575], [HULL.SmallShip, 'the galleon\'s fore cover', -1.25, 1.25, 2.95, 6.34, 6.44, 560], [HULL.SmallShip, 'the galleon\'s aft cover', -1.25, 1.25, -6.34, -2.95, 6.44, 560]]) {
    if (hull === HULL.SmallShip) mod.restore();
    const h = await sea(hull === HULL.Carrack ? { hull, pool: mod.pool } : { hull });
    h.runtime.sailing = false;   // moored, off her helm (D3's own setup)
    const m = h.boat.MeshObject.worldMatrix();
    let n = 0, ashore = 0, firstA = '';
    for (let x = x0 + 0.3; x <= x1 - 0.3 + 1e-9; x += 0.1) for (let z = z0 + 0.3; z <= z1 - 0.3 + 1e-9; z += 0.1) {
      n++;
      h.view.feet = outOfDeck(m, [x, y + 0.01, z]);
      if (!h.host.aboard()) { ashore++; firstA ||= `(${x.toFixed(2)}, ${z.toFixed(2)})`; }
    }
    assert.equal(n, total, `${what}: the points on it`);
    assert.equal(ashore, 0, `${what} shut: ${ashore} of ${n} read ashore - first ${firstA}`);
  }
  const pool = await readyPool();
  const d = mod.pool.deckOf(HULL.Carrack, 0), boat = standingMod(HULL.Carrack), main = mainLevel(d);
  // a boarder pressing across her shut cargo doors at a player standing on them
  const player = [0.09, 3.64, 2.8], body = leashOne(d, boat);
  body.step([3.0, main, 2.8], [3.0, main, 2.8]);
  let closest = Infinity, at = null;
  for (let x = 3.0; x >= 0.2; x -= 0.05) { at = body.press([x, 3.64, 2.8]); closest = Math.min(closest, Math.hypot(at[0] - player[0], at[2] - player[2])); }
  assert.ok(closest < MELEE_DISTANCE, `a boarder at a player on her shut cargo doors held ${closest.toFixed(2)} m off him (${fmt(at)})`);
  assert.ok(Math.abs(at[1] - 3.64) <= DECK_STEP, `on the doors: ${fmt(at)}`);
  // a body standing on the galleon's shut fore cover, a step over her deck: left where it stands (it was put on her deck
  // at the hatchway's edge)
  const g = pool.deckOf(HULL.SmallShip, 0), onCover = leashOne(g, standing(HULL.SmallShip)).step([0, 6.378, 4.6], [0, 6.378, 4.6]);
  assert.ok(Math.abs(onCover[0]) < 1e-6 && Math.abs(onCover[1] - 6.378) < 1e-6 && Math.abs(onCover[2] - 4.6) < 1e-6, `on her fore cover: ${fmt(onCover)}`);
  // D7's walk rule stands: no cell of hers over her cargo hatch, no landing on it, no spot
  const inHatch = (x, z) => x > -2.01 && x < 1.99 && z > 1 && z < 6;
  assert.deepEqual(cellsOf(d).filter((c) => inHatch(c[0], c[2])).length, 0, 'no cell of her deck over her cargo hatch');
  const land = d.land(0, 3.5, main + 3);
  assert.ok(d.walkable(land[0], land[2]) && !inHatch(land[0], land[2]), `a landing over her hatch comes down on her deck beside it: ${fmt(land)}`);
  assert.ok(d.spots(24, main).every((p) => !inHatch(p[0], p[2])), 'no spot over her hatch');
  // gone down her open hatchway, more than a step under her doors' tops: back on her deck at its edge
  for (const yy of [3.1, 2.0, 0.5]) {
    const got = leashOne(d, boat).step([3.0, main, 3.5], [0.4, yy, 3.5]);
    assert.ok(Math.abs(got[1] - main) < 0.01 && d.walkable(got[0], got[2]) && !inHatch(got[0], got[2]), `fallen to ${yy} down her cargo hatch: set at ${fmt(got)}`);
  }
  } finally { mod.restore(); }
});

// ── DK3: her doors ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 DK3: HER DOORS ARE WAYS IN - a door\'s leaf is baked a wall as it stands shut (D7), so the cells of its doorway and her deck\'s margin either side were no floor to the leash, and no boarder went through any door of hers: one chasing a player in the new galleon\'s great cabin stood 4.59 m off him at her castle\'s front; now the floor under each doorway a leaf alone walls, and her margin either side of it, are baked beside her deck (`ajar`) - the leash lets a body through (the motor\'s collider holds a shut door) and, pressed off one, puts it back on the floor of the room it came from; her deck itself the bake it was - her great cabin a piece of its own, her walk, her spots and her crew never through a door (mutants: the doorways unbaked, a leaf unmarked, a leaf no wall, the margin unbaked, the room a body came from unread, its band unread)', async () => {
  const pool = await readyPool();
  const d = pool.deckOf(HULL.SmallShip, 0), boat = standing(HULL.SmallShip), main = mainLevel(d);
  // a boarder chasing a player in her great cabin through her castle's doorway, 5 cm a frame
  const target = [0.1, main, -14], body = leashOne(d, boat);
  let pos = body.step([0.1, main, -7], [0.1, main, -7]), off = 0;
  for (let f = 0; f < 400; f++) {
    const dx = target[0] - pos[0], dz = target[2] - pos[2], L = Math.hypot(dx, dz) || 1;
    pos = body.press([pos[0] + dx / L * 0.05, main, pos[2] + dz / L * 0.05]);
    off = Math.max(off, Math.abs(pos[1] - main));
  }
  const gap = Math.hypot(pos[0] - target[0], pos[2] - target[2]);
  assert.ok(gap < MELEE_DISTANCE, `a boarder at a player in her great cabin stands ${gap.toFixed(2)} m off him (${fmt(pos)})`);
  assert.ok(off <= DECK_STEP, `never on another level (${off.toFixed(2)} m off her main deck)`);
  // and back out onto her deck
  for (let f = 0; f < 400; f++) {
    const dx = 0.1 - pos[0], dz = -7 - pos[2], L = Math.hypot(dx, dz) || 1;
    pos = body.press([pos[0] + dx / L * 0.05, main, pos[2] + dz / L * 0.05]);
  }
  assert.ok(Math.hypot(pos[0] - 0.1, pos[2] + 7) < 0.1 && d.walkable(pos[0], pos[2]), `back out on her deck: ${fmt(pos)}`);
  // in her doorway's margin on her cabin's side, pressed on into her castle's front beside her door: back on her cabin's
  // floor at its edge (z -11.41) - the room it came from, never out onto her main deck through the wall
  const cabin = d.pieceAt(0, -14, main), inside = leashOne(d, boat);
  let p = inside.step([0, main, -12.4], [0, main, -12.4]);
  for (const [x, z] of [[0, -11.9], [0, -11.4], [0, -11.16], [-0.5, -11.16], [-1.0, -11.16]]) p = inside.press([x, main, z]);
  assert.ok(Math.abs(p[2] + 11.41) < 0.01 && Math.abs(p[1] - main) < 0.01 && d.pieceAt(p[0], p[2], p[1], DECK_STEP) === cabin, `pressed into her castle's front from her cabin: ${fmt(p)}`);
  // through every door of hers at her main deck or over it - the galleon's castle door, the Carrack's five - each way, a
  // body walking straight through at the leaf's middle from a floor of hers 1.5 m one side to 1.5 m the other, 5 cm a
  // frame (each held at the doorway's near margin, 2.6-3.0 m short of 2 m beyond it)
  // SHIPS-2: the Carrack's five are the mod's own Carrack's (test/navalSea.mjs modShipsPool); Mac's carrack's one door
  // opens onto her aft companion, down to her gun deck - under her main deck, where no deck is (AUDIT NAV2 F34)
  let doors = 0;
  const mod = await modShipsPool();
  try {
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    const dk = (hull === HULL.Carrack ? mod.pool : pool).deckOf(hull, 0), bt = hull === HULL.Carrack ? standingMod(hull) : standing(hull), lv = mainLevel(dk);
    for (const leaf of leavesOf(bt)) {
      if (leaf.y1 - leaf.y0 < 1 || leaf.y0 < lv - DECK_STEP) continue;   // a door's leaf at her main deck or over it
      const x = (leaf.x0 + leaf.x1) / 2, zc = (leaf.z0 + leaf.z1) / 2;
      for (const dir of [1, -1]) {
        const za = zc - dir * 1.5, zb = zc + dir * 1.5, ya = dk.heightAt(x, za, leaf.y0), yb = dk.heightAt(x, zb, leaf.y0);
        assert.ok(Math.abs(ya - leaf.y0) <= DECK_STEP && Math.abs(yb - leaf.y0) <= DECK_STEP, `${HULL_NAMES[hull]} ${leaf.name}: a floor of hers either side (${ya}, ${yb})`);
        const walker = leashOne(dk, bt);
        let q = walker.step([x, ya, za], [x, ya, za]), most = 0;
        for (let f = 0; f < 200 && Math.abs(q[2] - zb) > 0.03; f++) { q = walker.press([x, q[1], q[2] + dir * 0.05]); most = Math.max(most, Math.abs(q[1] - leaf.y0)); }
        doors++;
        assert.ok(Math.abs(q[2] - zb) <= 0.03, `${HULL_NAMES[hull]} ${leaf.name} ${dir > 0 ? 'forward' : 'aft'}: held ${Math.abs(q[2] - zb).toFixed(2)} m short (${fmt(q)})`);
        assert.ok(most <= DECK_STEP, `${HULL_NAMES[hull]} ${leaf.name}: ${most.toFixed(2)} m off its level`);
      }
    }
  }
  } finally { mod.restore(); }
  assert.equal(doors, 12, 'the galleon\'s castle door and the Carrack\'s five, each both ways');
  // her deck the bake it was: her great cabin a piece of its own, her castle's doorway no deck, her walk never in
  assert.ok(d.pieceAt(0, -14, main) > 0, 'her great cabin a piece of its own');
  assert.equal(d.walkable(0, -10.4), false, 'her castle\'s doorway no deck');
  assert.ok(d.spots(48, main).every((p) => p[2] > -10), 'no spot through her door');
});

// ── TS9: a flight climbed square ──────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 TS9: A FLIGHT IS CLIMBED SQUARE, AND A STRAIGHT LINE UP IT IS ONE LEG - a walk steps over a flight\'s riser side to side, never across a corner (`steps`), and its corners are cut along a straight line up a flight that stays on it (`lineOnDeck` reads the flights): the diagonal over a riser allowed and the line blind to the flights both survived every suite (mutants: the corner step over a riser, the line blind to a flight)', () => {
  const nx = 7, nz = 9, N = nx * nz;
  // a flight four cells wide (i 1..4), its rows k 1..7 rising 0.6 m a row - past the motors' step, within a flight's - each
  // row joined to the next by its tread (bit 2: a cell's +z side)
  const y = new Float32Array(N).fill(NaN), flights = new Uint8Array(N);
  for (let k = 1; k <= 7; k++) for (let i = 1; i <= 4; i++) { y[k * nx + i] = 0.6 * (k - 1); if (k < 7) flights[k * nx + i] |= 2; }
  const d = deckGrid({ cell: 0.5, minX: 0, minZ: 0, nx, nz, y, flights });
  // a walk straight up it: one leg, every riser a tread's
  const up = d.path([1.25, 0.75], [1.25, 3.25]);
  assert.ok(up && up.length === 2, `up the flight from (2, 1) to (2, 6) in one leg: ${up?.map(fmt).join(' | ')}`);
  assert.ok(Math.abs(up[1][1] - 3) < 1e-6, 'onto the sixth row, 3 m up');
  // a straight line through a riser's corner (from (1, 1) to (4, 6), the corner at (3, 4)) is no leg: a body there would
  // step across a riser at a corner
  const corner = d.path([0.75, 0.75], [2.25, 3.25]);
  assert.ok(corner && corner.length > 2, `through a riser's corner, more than one leg: ${corner?.map(fmt).join(' | ')}`);
  // a diagonal over a riser is no step: (1, 1) at 0, the two beside it toward (2, 2) at 0.3, (2, 2) 0.85 up - its corner
  // a flight's rise past the motors' step, no tread to it from either side: no walk
  const y2 = new Float32Array(16).fill(NaN);
  y2[5] = 0; y2[6] = 0.3; y2[9] = 0.3; y2[10] = 0.85;
  const d2 = deckGrid({ cell: 0.5, minX: 0, minZ: 0, nx: 4, nz: 4, y: y2, flights: new Uint8Array(16) });
  assert.equal(d2.path([0.75, 0.75], [1.25, 1.25]), null, 'no walk across a riser\'s corner');
});

// ── the mod's galleon (her model would not load) ──────────────────────────────────────────────────────────────────

/** A pool whose new galleon will not load: hull 2 the mod's own galleon (test/auditgalleon_guns.test.js G4's own). */
async function fallbackPool() {
  const failing = async (url) => {
    if (String(url).includes('galleon.json')) return { ok: false, status: 404, json: async () => null, arrayBuffer: async () => null };
    const { fileURLToPath } = await import('node:url');
    const bytes = readFileSync(fileURLToPath(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  const renderer = { createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }), drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {} };
  const pipeline = { getTexture: async () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: failing, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  assert.equal(pool.models.galleon, false, 'her model missing: hull 2 is the mod\'s own galleon');
  return pool;
}

test('AUDIT GALLEON-2 DK2 and DK4: THE MOD\'S GALLEON - where the new galleon will not load, hull 2 is the mod\'s own galleon on her own build (MOD_SMALL_SHIP_BUILD): her deck 727 cells (the D-wall comment said 714 -> 750, measured over the new galleon\'s extent; 690 -> 727 over her own), and the walk everywhere never set off its floor (43 of her 19880 walks were, 6.77 <-> 8.84-9.40 under her forecastle) (mutants: as DK2\'s)', async () => {
  try {
    const pool = await fallbackPool();
    assert.equal(hullBuild(HULL.SmallShip), ships.MOD_SMALL_SHIP_BUILD, 'her numbers the mod galleon\'s');
    const d = pool.deckOf(HULL.SmallShip, 0);
    assert.equal(d.count, 727, 'the mod\'s galleon\'s deck');
    const DECK = src('src/systems/naval/navalDeck.js');
    assert.doesNotMatch(DECK, /the mod's galleon 714 -> 750/, 'measured over the new galleon\'s extent');
    assert.match(DECK, /the mod's galleon 690 -> 727/, 'over her own');
    const boat = pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    const geo = (c) => (c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null);
    const { starts, walks, bad, first } = walkEverywhere(d, facesOf(HULL.SmallShip, boat, geo), hullBuild(HULL.SmallShip));
    assert.ok(starts > 4000, `her standable starts (${starts})`);
    assert.equal(bad, 0, `the mod's galleon: ${bad} of ${walks} walks set more than a step off the floor they walk - first ${first}`);
  } finally {
    ships.setGalleonStanding?.(true);
  }
  assert.notEqual(hullBuild(HULL.SmallShip), ships.MOD_SMALL_SHIP_BUILD, 'standing again: hers');
});
