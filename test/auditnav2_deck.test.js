// AUDIT NAV2 (2026-09-30) - THE DECK: the deep audit of the naval second pass, its deck, frame and online lenses'
// findings F4, F11, F32-F34, F36, F38, F39, F57, F58, F60 and F61, pinned over the real code - Come Sail Away's own
// hulls through the real pool (test/navalSea.mjs, test/csaScene.mjs) and buildDeck, the real exterior foe pool, the
// naval host through real frames, Immersive Footsteps' component, and world.js's deck doors, leash and carry lifted
// whole (test/deckwalk.test.js's way).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { intoDeck, outOfDeck, DECK_STEP, DECK_HEADROOM } from '../src/systems/naval/navalDeck.js';
import * as NAVAL_DECK from '../src/systems/naval/navalDeck.js';   // its AUDIT NAV2 names, read where the tree may not have them yet
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat, spawnBoat, HULL_VARIANT_COUNTS, HULL_NAMES } from '../src/systems/comeSailAwayBoat.js';
import { colliderPoses, raycastColliders, boxColliderTriangles, invertAffine, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { multiply } from '../src/world/mat4.js';
import { STEP_OFFSET } from '../src/player/motor.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { mainLevel } from '../src/scenes/navalCrew.js';
import { createImmersiveFootsteps, readFootstepSettings, FIXED_DELTA_TIME, IMMERSIVE_FOOTSTEPS_VENDOR, SHALLOW_WATER_TILES } from '../src/systems/immersiveFootsteps.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { SEASON } from '../src/world/climateSwaps.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { MODELS, ctxFor } from './csaScene.mjs';
import { sea, readyPool, freshPool, modShipsPool } from './navalSea.mjs';

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
/** A line the fixes add: none before them, so the red run lifts what the tree had. */
const added = (start) => (WORLD.includes(start) ? line(start) : '');
const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null);
/** A hull stood at rest - her colliders to cast at, her mesh node's frame. */
const standing = (hull, variant = 0) => { const b = new Boat(hull, variant); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
/** A deck's cells' centres, `[x, y, z]` in her frame. */
const cellsOf = (d) => { const out = []; for (let j = 0; j < d.y.length; j++) if (!Number.isNaN(d.y[j])) { const i = j % d.nx, k = (j - i) / d.nx; out.push([d.minX + (i + 0.5) * d.cell, d.y[j], d.minZ + (k + 0.5) * d.cell]); } return out; };
const cellKey = (d, p) => `${Math.floor((p[0] - d.minX) / d.cell)},${Math.floor((p[2] - d.minZ) / d.cell)}`;
const settle = () => new Promise((r) => setTimeout(r, 0));
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

/** world.js's deck doors over the pool's decks, cast at her live colliders (csaColliderMesh's reading of them). */
function deckDoors(pool) {
  const body = `const { intoDeck, outOfDeck, DECK_HEADROOM, csa, raycastColliders, csaColliderMesh, tvSeaY, navalHullBoxOf, mainLevel } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}${line('  const NAVAL_RAIL_GAP = ')}
    ${lift('navalDeckSpots')}${lift('navalDeckPoint')}${lift('navalDeckLanding')}${lift('navalRailSpots')}
    return { navalDeckSpots, navalDeckPoint, navalDeckLanding, navalRailSpots };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)({ intoDeck, outOfDeck, DECK_HEADROOM, csa: { deckOf: (h, v) => pool.deckOf(h, v), models: null }, raycastColliders, csaColliderMesh: geometry, tvSeaY: () => 0, navalHullBoxOf: () => null, mainLevel: NAVAL_DECK.mainLevel });
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

// ── F57: one deck a hull, baked at the load ─────────────────────────────────────────────────────────────────────

/** A boat's switched-on, non-trigger colliders as the deck's bake reads them: each its kind, its source, its pose. */
const collidersOf = (b) => colliderPoses(b.GameObject).filter(({ collider: c }) => !c.m_IsTrigger && c.m_Enabled !== false)
  .map(({ collider: c, world }) => [c.type, c.m_Mesh?.mesh ?? c.m_Mesh?.builtin ?? c.classicModel ?? JSON.stringify([c.m_Center, c.m_Size]), ...Array.from(world, (v) => Math.round(v * 1e6) / 1e6)].join('|'));

test('AUDIT NAV2 F57 ONE DECK A HULL, BAKED AT THE LOAD: every rig of a hull stands her rig 0\'s own colliders - the Large Boat\'s seven carry none of their own (the sharing proven, not assumed) - so every rig\'s deck is the one the preload baked: no deckOf asked mid-voyage bakes (a Coasting Trader\'s rig 3 first seen cost an 8.6-9.3 ms crew frame) (mutants: keyed by rig again)', async () => {
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const rig0 = collidersOf(standing(hull, 0));
    assert.ok(rig0.length >= 1, `${HULL_NAMES[hull]}: her colliders`);
    for (let v = 1; v < HULL_VARIANT_COUNTS[hull]; v++) assert.deepEqual(collidersOf(standing(hull, v)), rig0, `${HULL_NAMES[hull]} rig ${v}: rig 0's colliders, none of its own`);
  }
  assert.equal(HULL_VARIANT_COUNTS[1], 7, 'the Large Boat\'s seven rigs');
  const pool = await freshPool();   // preloaded, as the world's load leaves it
  const baked = Array.from(HULL_NAMES, (_, hull) => pool.deckOf(hull, 0));
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    assert.ok(baked[hull]?.count > 0, `${HULL_NAMES[hull]}: a deck`);
    for (let v = 0; v < 7; v++) assert.equal(pool.deckOf(hull, v), baked[hull], `${HULL_NAMES[hull]} rig ${v}: the deck the preload baked, never one baked now`);
  }
});

// ── F58: the spots made once a count ────────────────────────────────────────────────────────────────────────────

/** Farthest-point sampling from the cell nearest her middle, made fresh - the reference the memo must answer as. */
function spotsFresh(d, n) {
  if (!d.count || n <= 0) return [];
  const cells = [];
  let sx = 0, sz = 0;
  const centre = (j) => { const i = j % d.nx, k = (j - i) / d.nx; return [d.minX + (i + 0.5) * d.cell, d.y[j], d.minZ + (k + 0.5) * d.cell]; };
  for (let j = 0; j < d.y.length; j++) if (!Number.isNaN(d.y[j])) { cells.push(j); const c = centre(j); sx += c[0]; sz += c[2]; }
  const out = [d.nearest(sx / d.count, sz / d.count)];
  const far = new Float64Array(cells.length).fill(Infinity);
  while (out.length < Math.min(n, cells.length)) {
    const last = out[out.length - 1];
    let best = -1, bestD = -1;
    for (let q = 0; q < cells.length; q++) {
      const c = centre(cells[q]), dx = c[0] - last[0], dz = c[2] - last[2];
      far[q] = Math.min(far[q], dx * dx + dz * dz);
      if (far[q] > bestD) { bestD = far[q]; best = q; }
    }
    if (bestD <= 0) break;
    out.push(centre(cells[best]));
  }
  return out;
}

test('AUDIT NAV2 F58 THE SPOTS MADE ONCE A COUNT: deck.spots(n) is one frozen array every time it is asked (its spots frozen too - a caller only reads or copies them), the very spots farthest-point sampling makes fresh, on every hull; its distances off centres laid out once (the Large Galley\'s spots(24) made a centre a cell a pass: 1.3 ms and 3.7 MB, every crew stood and every boarding) (mutants: made fresh each ask, left unfrozen, a centre misread)', async () => {
  const pool = await readyPool();
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0);
    for (const n of [1, 6, 16, 24]) {
      const s = d.spots(n);
      assert.equal(d.spots(n), s, `${HULL_NAMES[hull]} spots(${n}): the same array`);
      assert.ok(Object.isFrozen(s) && s.every((p) => Object.isFrozen(p)), `${HULL_NAMES[hull]} spots(${n}): frozen`);
      assert.deepEqual(s, spotsFresh(d, n), `${HULL_NAMES[hull]} spots(${n}): the spots a fresh sampling makes`);
    }
  }
  assert.equal(pool.deckOf(3, 0).spots(24), pool.deckOf(3, 0).spots(24));
});

// ── F61: the walk's heuristic ───────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F61 THE WALK\'S HEURISTIC: path() asks Math.hypot nothing - its straight line home is a square root of its own (1.6x the speed, the same walks); and the corner cut\'s cost is said as it is, quadratic in the walk (mutants: the hypot back)', async () => {
  const d = (await readyPool()).deckOf(3, 0);
  const cells = cellsOf(d);
  const walks = [];
  const real = Math.hypot;
  let asked = 0;
  Math.hypot = (...a) => { asked++; return real(...a); };
  try {
    for (let q = 0; q < 40; q++) walks.push(d.path([cells[q * 97 % cells.length][0], cells[q * 97 % cells.length][2]], [cells[q * 389 % cells.length][0], cells[q * 389 % cells.length][2]]));
  } finally { Math.hypot = real; }
  assert.equal(asked, 0, 'no hypot in the walk');
  assert.ok(walks.every((w) => w && w.length >= 1), 'every walk found');
  const DECK = src('src/systems/naval/navalDeck.js');
  assert.doesNotMatch(DECK, /a\s*(?:\/\/\s*)?walk's cost linear in its length/, 'the corner cut is no linear cost');
  assert.match(DECK, /quadratic/, 'said as it is');
});

// ── F32: a small hull's deck ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F32 A SMALL HULL\'S DECK: kept off her walls and her open side, never off a bench (the Large Boat\'s midship compartment lost 18 of its 30 cells between her 0.6-0.7 m thwarts), and never kept off at all where that would take more than half her deck (the Rowboat\'s 4 cells); every hull stands sixteen distinct spots when she has the room, the Small Ship\'s, the Large Galley\'s and the Carrack\'s decks as they were; a rail\'s points each a cell of their own - fewer than asked on a short rail, never two bodies on one spot (mutants: the bench inset, no half-deck rule, the rail\'s cells repeated)', async () => {
  const pool = await readyPool();
  const counts = [];
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const d = pool.deckOf(hull, 0);
    counts.push(d.count);
    const s = d.spots(16);
    assert.equal(new Set(s.map((p) => cellKey(d, p))).size, Math.min(16, d.count), `${HULL_NAMES[hull]}: sixteen distinct spots, or one a cell`);
    for (const p of s) assert.ok(d.walkable(p[0], p[2]), `${HULL_NAMES[hull]}: on her deck`);
  }
  assert.ok(counts[1] >= 16, `the Large Boat: room for sixteen (${counts[1]} cells)`);
  assert.ok(counts[0] >= 12, `the Rowboat: her deck whole (${counts[0]} cells)`);
  // the thwarts are the mod's own Large Boat's (SHIPS-2: hull 1 as the game stands it when Mac's Tiny Ship's model will
  // not load - test/navalSea.mjs modShipsPool; his boat has none, her deck open between her mast and her helmsman's step)
  const mod = await modShipsPool();
  try {
    const lb = mod.pool.deckOf(1, 0);
    assert.equal(lb.walkable(0.1, -1.24), true, 'the Large Boat: against her after thwart');
    assert.equal(lb.walkable(0.1, 1.26), true, 'against her fore thwart');
    assert.equal(lb.walkable(-0.9, -0.24), false, 'still kept off her side');
    assert.equal(lb.walkable(1.1, -0.24), false, 'either side');
  } finally { mod.restore(); }
  // the big three as they are: PIN MOVED (GALLEON, 2026-10-01) - the Small Ship is the new galleon, her main deck's 736
  // cells and her castle's two flights and roof over them (F34); the Carrack's forecastle joined up its stair (a flight
  // finer than a cell, navalDeck.js `linked`): her 515, the stair's foot at her main deck and the 33 cells up it; the
  // Large Galley's every cell as it was. PIN MOVED (AUDIT GALLEON D7, 2026-10-02): a part that opens is no floor of
  // hers - the galleon's two hatchways (her covers' 44 cells at 6.378 and the inset's margin round them, 82) and the
  // Carrack's cargo hatch (her cargo doors' 80 at 3.639 and its margin, 116) are holes when open, no deck: the
  // galleon's main deck 654 of 828, the Carrack's 399 and her stair's foot of 433, 33 up her stair as before. PIN MOVED
  // (AUDIT GALLEON D-wall, 2026-10-02): a wall marks a cell with its own height there, never its whole triangle's (her
  // deck the same however her faces are cut): the galleon's side under her deck no longer walls her deck's edge at her
  // entry ports (z -0.58 to 1.58, both sides: her side's parts there 2.9-6.1 m, under her 6.20 deck) nor at her bow (5
  // cells), and her foremast's partner walls a cell its edges missed (one) - her main deck 664 of 838, her castle and
  // flights the 174 they were; the Carrack's ground under her half deck's stairs (their stringers 2.2-3.1 m over it there)
  // and the room under her forecastle (its bulkhead 1.8 m up) are her deck - 465 at her main level of 511, her
  // forecastle 39 and her stair; the Large Galley's tent 4016
  const small = pool.deckOf(2, 0);
  assert.equal(cellsOf(small).filter((c) => Math.abs(c[1] - mainLevel(small)) <= DECK_STEP).length, 664, 'the Small Ship\'s main deck, 664');
  assert.equal(small.count, 838, 'the Small Ship\'s 838, her castle with it');
  assert.equal(pool.deckOf(3, 0).count, 4016, 'the Large Galley\'s 4016');
  // PIN MOVED (SHIPS-2, 2026-10-07): the Carrack is Mac's carrack - her open deck one level, 1087 cells
  const carrack = pool.deckOf(4, 0);
  assert.equal(carrack.count, 1087, 'the Carrack\'s 1087');
  assert.equal(cellsOf(carrack).filter((c) => Math.abs(c[1] - mainLevel(carrack)) <= DECK_STEP).length, 1087, 'her main deck\'s every one');
  // her rail: a cell a point
  const w = deckDoors(pool);
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const boat = standing(hull), d = pool.deckOf(hull, 0), m = boat.MeshObject.worldMatrix();
    for (const side of [1, -1]) {
      for (const n of [4, 13]) {
        const pts = w.navalRailSpots(boat, [side * 30, 0, 0], n);
        const keys = pts.map(([f]) => cellKey(d, intoDeck(m, f)));
        assert.equal(new Set(keys).size, keys.length, `${HULL_NAMES[hull]} ${n} over her ${side > 0 ? 'starboard' : 'port'} rail: a cell each`);
        assert.ok(pts.length >= Math.min(n, 2) && pts.length <= n);
        if (n === 4 && hull > 0) assert.equal(pts.length, 4, `${HULL_NAMES[hull]}: four hands, four places`);
      }
    }
  }
});

// ── F33: a deck point set down on her deck ──────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F33 A DECK POINT SET DOWN ON HER DECK: the ray that sets a muster\'s spot, a landing and a rail point down on her live colliders starts under the headroom her deck keeps (DECK_HEADROOM), never over it - every cell\'s point on every hull within DECK_STEP of her deck there (from 3 m up it met the Carrack\'s bow structure over 26 of her 515 cells, 2.1-2.7 m over her deck) (mutants: the ray from 3 m again, the spots\' ray alone)', async () => {
  const pool = await readyPool();
  const w = deckDoors(pool);
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const boat = standing(hull), d = pool.deckOf(hull, 0), m = boat.MeshObject.worldMatrix();
    const off = [];
    for (const c of cellsOf(d)) {
      const q = intoDeck(m, w.navalDeckPoint(boat, d, c)[0]);
      if (!(Math.abs(q[1] - d.heightAt(q[0], q[2])) <= DECK_STEP)) off.push(`(${c[0].toFixed(2)}, ${c[2].toFixed(2)}) ${(q[1] - c[1]).toFixed(2)} m over`);
    }
    assert.deepEqual(off, [], `${HULL_NAMES[hull]}: every cell's point on her deck`);
    for (const [f] of w.navalDeckSpots(boat, Math.min(d.count, 600))) {
      const q = intoDeck(m, f);
      assert.ok(Math.abs(q[1] - d.heightAt(q[0], q[2])) <= DECK_STEP, `${HULL_NAMES[hull]}: a muster's spot on her deck (${q.map((v) => v.toFixed(2))})`);
    }
  }
});

// ── F34: raised decks ───────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F34 RAISED DECKS, JOINED AND KEPT: PIN MOVED (GALLEON, 2026-10-01: the Small Ship is the new galleon - her castle aft up two flights, port and starboard, where the mod\'s galleon had her forecastle stair forward, its treads 0.385 m on 0.25 m risers - two risers between two cells\' centres as often as one, a flight finer than a cell, joined over the tread between them and kept a cell wide where her castle\'s well walls it) - a walk from her waist climbs either flight onto her castle; every piece of her kept (her cabin under her castle): the leash keeps a body on her castle or her flight where it stands, and one stepped off her castle over her side back onto it; the Large Galley\'s rowers never her deck, her crew\'s main level still her main deck (mutants: one level a cell, the largest piece alone, the tread\'s join, the leash off its piece, a flight\'s tread unread, a flight\'s margin taken)', async () => {
  const pool = await readyPool();
  const d = pool.deckOf(2, 0);
  assert.ok(STEP_OFFSET >= DECK_STEP, 'the motors climb a tread');
  assert.equal(NAVAL_DECK.DECK_JOIN, STEP_OFFSET, 'her floors joined at the motors\' own step');
  assert.equal(NAVAL_DECK.FLIGHT_JOIN, 2 * STEP_OFFSET, 'a flight\'s two risers, each the motors\' step');
  for (const x of [-4.11, 3.89]) {
    for (const [z, y, what] of [[-7.66, 6.495, 'a tread over her main deck'], [-8.16, 6.763, 'the next'], [-8.66, 7.274, 'two risers on'], [-12.16, 9.523, 'up her castle\'s well'], [-14.66, 10.995, 'her flight\'s head'], [-15.16, 11.018, 'her castle']]) {
      assert.ok(Math.abs(d.heightAt(x, z) - y) < 0.02, `${what} (${x}): ${d.heightAt(x, z)}`);
    }
  }
  const sideOf = (p, q) => {   // the flight bit of the side two neighbouring cells share, or 0
    const i = Math.floor((p[0] - d.minX) / d.cell), k = Math.floor((p[2] - d.minZ) / d.cell), ii = Math.floor((q[0] - d.minX) / d.cell), kk = Math.floor((q[2] - d.minZ) / d.cell);
    if (Math.abs(i - ii) + Math.abs(k - kk) !== 1) return 0;
    const j = Math.min(k * d.nx + i, kk * d.nx + ii);
    return (d.flights?.[j] ?? 0) & (i !== ii ? 1 : 2);
  };
  for (const [to, x] of [[[-2.5, -16.5], -4.11], [[2.5, -16.5], 3.89]]) {
    const walk = d.path([0, 0], to);
    assert.ok(walk, `a walk from her waist to her castle (${to})`);
    assert.ok(Math.abs(walk[0][1] - 6.2) < 0.02 && Math.abs(walk.at(-1)[1] - 11.018) < 0.02, `from her main deck up on her castle: ${walk[0]} -> ${walk.at(-1)}`);
    const trod = [];   // her deck under the walk, every 5 cm of it (a straight leg runs up the flight whole)
    for (let i = 1; i < walk.length; i++) {
      const a = walk[i - 1], b = walk[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.05);
      for (let q = 0; q <= n; q++) { const px = a[0] + (b[0] - a[0]) * q / n, pz = a[2] + (b[2] - a[2]) * q / n; trod.push([px, d.heightAt(px, pz), pz]); }
    }
    assert.ok(trod.every((p) => !Number.isNaN(p[1])), 'every step of it on her deck');
    assert.ok(trod.some((p) => p[1] > 7.3 && p[1] < 10.9 && Math.abs(p[0] - x) < d.cell), `up her ${x < 0 ? 'port' : 'starboard'} flight's treads`);
    for (let i = 1; i < trod.length; i++) {
      const rise = Math.abs(trod[i][1] - trod[i - 1][1]);
      assert.ok(rise <= STEP_OFFSET || (rise <= NAVAL_DECK.FLIGHT_JOIN && sideOf(trod[i - 1], trod[i])), `a tread at a time, or a flight's two (${trod[i - 1][1]} to ${trod[i][1]})`);
    }
  }
  // the leash, lifted from the world host, over her real deck and her mesh node
  const boat = standing(2), m = boat.MeshObject.worldMatrix();
  const foes = [];
  const w = leashRig({ deckOf: () => d }, { foes });
  const stand = (local) => { const f = { dead: false, ai: { feet: outOfDeck(m, local) }, entity: {} }; foes.push(f); w.navalDeckBody(f, boat); return f; };
  const castle = stand([0.5, 11.018, -16]), flight = stand([-4.11, 9.523, -12.16]), other = stand([3.89, 8.787, -11.16]);
  const was = [castle, flight, other].map((f) => [...f.ai.feet]);
  for (let i = 0; i < 3; i++) { w.navalCarry(); w.navalLeash(); }
  assert.ok(near(castle.ai.feet, was[0]), `her castle: untouched (${intoDeck(m, castle.ai.feet).map((v) => v.toFixed(2))})`);
  assert.ok(near(flight.ai.feet, was[1]), 'her port flight: untouched');
  assert.ok(near(other.ai.feet, was[2]), 'her starboard flight: untouched');
  // over the side of her castle: back onto her castle, never onto her main deck 4.8 m under it
  castle.ai.feet = outOfDeck(m, [7.5, 11.018, -16]);
  w.navalLeash();
  const back = intoDeck(m, castle.ai.feet);
  assert.ok(Math.abs(back[1] - 11.018) < 0.05 && back[0] < 7.5, `back on her castle: ${back.map((v) => v.toFixed(2))}`);
  // her great cabin under her castle: a piece of hers, never her open deck
  assert.ok(d.pieceAt(0, -14, 6.2) > 0, 'her cabin a piece of its own');
  // AUDIT GALLEON T1 (2026-10-02): the leash ON A PIECE OF ITS OWN - the new galleon's castle and flights are her open
  // deck (piece 0), so every case above stood on piece 0 and the leash's piece went unread (four records survived): a
  // foe in her great cabin (piece 1, under her castle at 6.2) stepping out through her castle's front (z -10, no floor
  // of hers) is put back on his cabin's edge at z -11.41 - never onto her main deck before it, nor her castle's roof
  // over him - and one standing in it keeps his floor (his own height read: her roof is the cabin cell's open deck).
  // PIN MOVED (AUDIT GALLEON-2 DK3, 2026-10-03): through her front at x 1.5, beside her door - her doorway at x 0 is a
  // way through it now (navalDeck.js `ajar`), the point this pin stepped him to (0, -10) a floor of it
  const inCabin = stand([0, 6.2, -14]), stays = stand([0.5, 6.2, -15]);
  for (let i = 0; i < 2; i++) { w.navalCarry(); w.navalLeash(); }
  inCabin.ai.feet = outOfDeck(m, [1.5, 6.2, -10]);
  w.navalLeash();
  const out = intoDeck(m, inCabin.ai.feet);
  assert.ok(Math.abs(out[2] - -11.41) < 0.01 && Math.abs(out[1] - 6.202) < 0.01 && d.pieceAt(out[0], out[2], out[1]) === d.pieceAt(0, -14, 6.2), `back on her cabin's edge: ${out.map((v) => v.toFixed(3))}`);
  const kept = intoDeck(m, stays.ai.feet);
  assert.ok(Math.abs(kept[1] - 6.2) < 1e-6 && Math.abs(kept[2] - -15) < 1e-6, `in her cabin, on its floor: ${kept.map((v) => v.toFixed(3))}`);
  // the Large Galley: her rowers' benches under her deck never deck; her crew's level her main deck
  const g = pool.deckOf(3, 0);
  assert.ok(Math.abs(mainLevel(g) - 10.25) < 0.05, `the Galley's main level: ${mainLevel(g)}`);
  assert.ok(cellsOf(g).every((c) => c[1] > 10.25 - DECK_STEP), 'no rower\'s bench in her deck');
  assert.ok(Math.abs(mainLevel(d) - 6.202) < 0.05, `the Small Ship's: ${mainLevel(d)}`);
  const rowerAt = cellsOf(g)[Math.floor(cellsOf(g).length / 2)];
  assert.ok(Math.abs(g.heightAt(rowerAt[0], rowerAt[2], 6.5) - 10.25) < 0.05, 'asked at a rower\'s height: her deck the floor there');
});

// ── F36, F60, F4: aboard ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F36 ABOARD IS STANDING ON HER: a floor of hers under the feet - her deck, by her rail past its inset edge, her poop, below decks - is aboard; a quay off her bow, off her stern, a beach under her bow quarter and the water round her are not (her hull\'s box grown a metre read 332 m2 round a moored Small Ship as aboard, one quay point 19.6 m from her hull) (mutants: the box again, the reach unread, the height unread)', async () => {
  const h = await sea({ hull: 2 });
  h.runtime.sailing = false;   // moored, off her helm
  const deck = h.pool.deckOf(2, 0), m = h.boat.MeshObject.worldMatrix();
  const at = (x, y, z) => { h.view.feet = outOfDeck(m, [x, y, z]); return h.host.aboard(); };
  assert.equal(at(...deck.nearest(0, 0)), true, 'her waist');
  const rail = deck.rail(1, 0);
  assert.equal(at(rail[0] + 0.7, rail[1], rail[2]), true, 'by her rail, past her deck\'s inset edge');
  // PIN MOVED (GALLEON, 2026-10-01): the new galleon's castle at 11.02 and her gun deck at 1.08, her stem at 21.9
  assert.equal(at(0.5, 11.02, -16), true, 'her castle');
  assert.equal(at(0.8, 1.09, -2), true, 'her gun deck');
  for (const [p, what] of [[[8.5, 1.5, 17], 'a quay beside her bow'], [[9, 1.5, -21], 'a quay beside her stern'], [[6, 0.5, 19], 'a beach under her bow quarter'], [[0, 1.5, 23.5], 'the water off her stem'], [[11, 1.5, 0], 'a quay off her side']]) {
    h.view.feet = p;
    assert.equal(h.host.aboard(), false, what);
  }
  // by her rail over no floor of hers (her side's ramp), her deck within DECK_REACH_M: aboard; under her keel: not
  let ramp = null;
  for (let x = rail[0] + deck.cell; x < rail[0] + 4 && !ramp; x += deck.cell / 4) if (!deck.under(x, rail[2], rail[1] + 0.3, 0) && deck.under(x, rail[2], rail[1] + 0.3, 1)) ramp = [x, rail[1] + 0.3, rail[2]];
  assert.ok(ramp, 'a point by her rail over no floor, her deck in reach');
  assert.equal(at(...ramp), true, `by her rail over no floor of hers: ${ramp.map((v) => v.toFixed(2))}`);
  // PIN MOVED (GALLEON-2, 2026-10-02): her keel 4.64 m down on Mac's second export (3.89 on his first) - the floor inside
  // her V lies within a step of -4.6, so the swimmer is taken 0.76 m under her keel
  assert.equal(at(0, -5.4, 0), false, 'a swimmer under her keel');
  // AUDIT GALLEON D-wall (2026-10-02): a quay against her port quarter at 1.5 m, 0.3 m off her side under her main deck
  // - her floors looking up now (her flare's underside no floor), it is a metre's reach of her gun deck that would read
  // it aboard (the body's own reads none of the points round her hull, AUDIT GALLEON D3)
  assert.equal(at(-5.61, 1.5, -15), false, 'a quay against her port quarter, under her main deck');
  // round her, off her hull at a quay's height and in the water: never aboard
  let slack = 0;
  for (let x = -12; x <= 12; x += 1) for (let z = -28; z <= 24; z += 1) {
    if (Math.abs(x) <= 5.9 && z >= -19.95 && z <= 21.95) continue;   // her hull's own box
    for (const y of [1.5, 0]) { h.view.feet = [x, y, z]; if (h.host.aboard()) slack++; }
  }
  assert.equal(slack, 0, 'nothing off her hull reads aboard');
});

test('AUDIT NAV2 F60 A SHIP FAR OFF IS NEVER ASKED: a player 300 m from every hull - aboard() builds no hull\'s box and asks no deck of hers (her box, 1 KB, was built for every boat and every sea ship on every call: 3.34 us and 11 KB, each step\'s hostileNear, the threats, playerAfloat each frame) (mutants: the far test dropped)', async () => {
  const h = await sea({ hull: 2 });
  h.runtime.sailing = false;
  for (const [cls, bearing] of [['pirateBrig', 0.4], ['merchantCarrack', 2.2], ['navyGalley', 4.1]]) h.host.spawnShip(cls, { range: 500, bearing });
  for (let i = 0; i < 3; i++) h.host.frame(0.1);   // a hull built a frame
  const boats = [h.boat, ...[...h.host._sea.values()].map((e) => e.boat)];
  assert.equal(boats.filter(Boolean).length, 4, 'my boat and three sea ships, built');
  const waist = outOfDeck(h.boat.MeshObject.worldMatrix(), h.pool.deckOf(2, 0).nearest(0, 0));
  let asked = 0;
  const kept = boats.map((b) => [b.MeshCollider, b.MeshObject]);
  for (const [i, b] of boats.entries()) {
    Object.defineProperty(b, 'MeshCollider', { configurable: true, get() { asked++; return kept[i][0]; } });
    Object.defineProperty(b, 'MeshObject', { configurable: true, get() { asked++; return kept[i][1]; } });
  }
  const deckOf = h.pool.deckOf;
  h.pool.deckOf = (...a) => { asked++; return deckOf(...a); };
  try {
    h.view.feet = [0, 0, -300];
    assert.equal(h.host.aboard(), false);
    assert.equal(asked, 0, 'no box built, no deck asked');
    h.view.feet = waist;
    assert.equal(h.host.aboard(), true, 'on her deck: asked, and aboard');
  } finally {
    h.pool.deckOf = deckOf;
    for (const [i, b] of boats.entries()) for (const [k, v] of [['MeshCollider', kept[i][0]], ['MeshObject', kept[i][1]]]) Object.defineProperty(b, k, { value: v, writable: true, configurable: true, enumerable: true });
  }
});

test('AUDIT NAV2 F4 ANOTHER PLAYER\'S BOAT UNDER ME IS ABOARD: riding a peer\'s boat (Come Sail Away\'s riding - the host\'s aboardPeer, the world\'s csaAboard) is standing aboard: a pirate closing on her is an enemy near, the rest, the journey and the time scale held (SEA-PEACE read the rider as ashore); off her, ashore again (mutants: the dep unread, the world\'s wiring dropped)', async () => {
  const h = await sea({ hull: null });
  h.host.spawnShip('pirateBrig', { range: 300, bearing: 0 });
  h.run(6);
  assert.equal(h.host.aboard(), false, 'ashore');
  assert.equal(h.host.hostileNear(), false);
  const theirs = standing(2);
  h.deps.aboardPeer = () => theirs;
  assert.equal(h.host.aboard(), true, 'riding their boat');
  assert.equal(h.host.hostileNear(), true, 'the pirate an enemy near');
  h.deps.aboardPeer = () => null;
  assert.equal(h.host.aboard(), false, 'off her');
  assert.match(WORLD, /aboardPeer: \(\) => csaAboard\.aboard\?\.boat \?\? null,/, 'the world hands the naval host the boat I ride');
});

// ── F11: the dead ride her and go down with her ────────────────────────────────────────────────────────────────

function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 600, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
/** The real exterior foe pool over stand-ins (test/deckwalk.test.js's): its batches' baked centres kept, the destroyed ones counted. */
function foesPool() {
  const destroyed = [];
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: (a, r, s, centers) => ({ a, r, centers: centers.map((c) => [...c]) }), destroyBillboardBatch: (b) => { destroyed.push(b); }, destroyBatch: (b) => { destroyed.push(b); }, textures: new Map() },
    // a floor 0.3 under every downward ray's start: the corpse falls where the feet stood (floorLanding's footprint)
    collider: { raycast: (o, d) => (d[1] < 0 ? 0.3 : Infinity), heightAt: () => NaN, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  return { pool, destroyed };
}
/** Where a corpse's batch draws: its baked centre moved by its origin. */
const drawnAt = (c) => c.batch.centers[0].map((v, i) => v + (c.batch.origin?.[i] ?? 0));

test('AUDIT NAV2 F11 THE DEAD LIE ON HER DECK AND GO DOWN WITH HER: a crewman killed on a ship\'s deck - his corpse carried with her (her way 20 m, her list), his body where it lies to loot; her hull out of the pool (the naval host\'s drop()) and his corpse is gone with her, the record letting her hull go (it hung in the air where he fell, its batch drawn on after she sank, her prefab tree kept by the record) (mutants: the dead let go by the leash, the corpse not carried, left behind at her drop, the hull kept)', async () => {
  const h = await sea({ hull: 2 });
  const id = h.host.spawnShip('merchantGalleon', { range: 40, bearing: Math.PI / 2, yaw: 0 });
  h.host.frame(0.1);
  const e = h.host._sea.get(id);
  assert.ok(e?.boat && h.pool.seaBoats.includes(e.boat), 'her hull in the pool');
  const { pool: foes, destroyed } = foesPool();
  const w = leashRig(h.pool, foes);
  const deck = h.pool.deckOf(e.boat.hull, 0);
  const at = deck.nearest(0, 3);
  const f = await foes.spawnFoe(0, outOfDeck(e.boat.MeshObject.worldMatrix(), at), { feetGiven: true, loose: true, transient: true, team: 'KnightsAndMages' });
  w.navalDeckBody(f, e.boat);
  w.navalCarry(); w.navalLeash();
  foes.damageFoe(f, 10000, null, null, { fromPlayer: false, bypassShield: true });
  for (let i = 0; i < 10; i++) await settle();
  const c = f.corpseMarker;
  assert.ok(f.dead && c, 'fallen: his corpse on her deck');
  for (let t = 1; t <= 20; t++) {   // she sails 20 m on and takes a 10 degree list
    const p = e.boat.GameObject.localPosition;
    e.boat.GameObject.localPosition = [p[0], p[1], p[2] + 1];
    const half = 0.0873 * t / 20;
    e.boat.MeshObject.localRotation = [0, 0, Math.sin(half), Math.cos(half)];
    w.navalCarry(); w.navalLeash();
  }
  const where = outOfDeck(e.boat.MeshObject.worldMatrix(), at);
  assert.ok(near(c.pos, where, 0.2), `his body where he fell on her deck, 20 m on: ${c.pos.map((v) => v.toFixed(2))} for ${where.map((v) => v.toFixed(2))}`);
  assert.ok(near(drawnAt(c), c.pos, 1e-6), `drawn there: ${drawnAt(c).map((v) => v.toFixed(2))}`);
  assert.equal(f.corpseMarker, c, 'still his body, to loot');
  assert.ok(foes.batches().includes(c.batch));
  // her hull gone: the host drops her (her crew over the side, her hull out of the pool) - the world's next carry
  h.host.clear();
  assert.equal(h.pool.seaBoats.includes(e.boat), false, 'dropped');
  w.navalCarry(); w.navalLeash();
  assert.ok(destroyed.includes(c.batch), 'his corpse gone with her');
  assert.equal(foes.batches().includes(c.batch), false, 'drawn no more');
  assert.equal(f.corpse, false);
  assert.equal(f.deckBoat, null, 'the record lets her hull go');
  assert.equal(w.bodies.has(f), false);
});

// ── F38: a quay over shallow water ──────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F38 A QUAY OVER SHALLOW WATER IS WALKED ON: a model over a shallow-water tile (a coast\'s or a river\'s edge, SHALLOW_WATER_TILES) plays the model\'s own ground - the armour\'s, as over the open sea - never the shallow water\'s splash; wading the same tile off the model still splashes (mutants: tile 0 alone)', async () => {
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_FOOTSTEPS_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const c = createImmersiveFootsteps({ audio: { registerSound: async () => true, playOneShot() {} }, settings: () => readFootstepSettings(() => store), random: () => 0, fetchClip: async () => new Uint8Array([1]) });
  const entity = { items: [], activeEffects: [] };
  const outdoors = (o = {}) => ({ paused: false, entity, grounded: true, standingStill: false, isRunning: false, movingLessThanHalfSpeed: false, transportMode: TRANSPORT_MODES.Foot, swimming: false, pos: [0, 0, 0], inside: false, inDungeon: false, season: SEASON.Summer, climateIndex: CLIMATES.Woodlands, tileMapIndex: 2, waterWalking: false, ...o });
  c.update(0, outdoors());
  await c.settle();
  const setAt = (o) => { for (let i = 0; i < 30; i++) c.update(FIXED_DELTA_TIME, outdoors(o)); return c.status().currentSet; };
  const overSea = setAt({ tileMapIndex: 0, onStaticGeometry: true });
  assert.doesNotMatch(overSea, /Water/, `over the open sea: ${overSea}`);
  for (const tile of SHALLOW_WATER_TILES) {
    setAt({ tileMapIndex: 2 });   // off it first: the floor read afresh
    assert.equal(setAt({ tileMapIndex: tile, onStaticGeometry: true }), overSea, `a quay over tile ${tile}`);
  }
  assert.equal(setAt({ tileMapIndex: 5 }), 'ShallowWaterFootstepsMain', 'wading tile 5 off the model');
});

// ── F39: a classic model on her deck ────────────────────────────────────────────────────────────────────────────

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};

test('AUDIT NAV2 F39 A CLASSIC MODEL ON HER DECK IS NO DECK: the Large Galley\'s helm (her DriveTrigger\'s ModelHelper, classic model 41123) stands in her deck\'s bake as it stands in the world\'s collider (world.js csaColliderMesh reads the pipeline\'s cpu model) - over a stand-in model her helm\'s cells are no deck; with no model in (this bench\'s pipeline, no ARENA2) they read open deck as before (mutants: the classic collider skipped)', async () => {
  const model = boxColliderTriangles({ m_Center: { x: 0, y: 0.75, z: 0 }, m_Size: { x: 0.9, y: 1.5, z: 0.9 } });
  const tex = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const renderer = { createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }), drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (a, r, s, c) => ({ a, r, s, c }), destroyBillboardBatch() {}, destroyMesh() {} };
  const pipeline = { getTexture: async () => tex(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }), cpuModels: new Map([[41123, { positions: model.positions, indices: model.indices }]]) };
  const withModel = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await withModel.preload(), true);
  const galley = standing(3);
  const helm = colliderPoses(galley.GameObject).find(({ collider: c }) => c.classicModel === 41123);
  assert.ok(helm, 'her helm\'s classic model, a collider of hers');
  const inNode = multiply(invertAffine(galley.MeshObject.worldMatrix()), helm.world, new Float32Array(16));
  const at = outOfDeck(inNode, [0, 0.75, 0]);   // the model's middle, in her mesh node's frame
  const plain = (await readyPool()).deckOf(3, 0), baked = withModel.deckOf(3, 0);
  assert.equal(plain.walkable(at[0], at[2]), true, `no model in: open deck at her helm (${at.map((v) => v.toFixed(2))})`);
  assert.equal(baked.walkable(at[0], at[2]), false, 'the helm stands in her deck\'s bake');
  assert.ok(baked.count < plain.count && baked.count > plain.count - 40, `her helm\'s cells alone: ${plain.count} -> ${baked.count}`);
});
