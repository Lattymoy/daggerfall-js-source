// DECK-WALK and SHIPMATES (2026-09-29, Mac: "Boarding scenarios should be seamless ... There's an issue where
// enemies/allys can navigate on the railing of ships" and "Ally crew member's should have green health bars above their
// head, and not be able to engage in friendly fire"):
//
//   DECK-WALK  - a ship's walkable deck read off her own colliders (systems/naval/navalDeck.js): her main deck's floors
//                with headroom, no wall through them, off every edge, her open piece alone - the rail's ramp, a mast, a
//                crate, a boom's shadow and a cabin no deck; a muster spread across it; a walk across it. Every body on a
//                deck is kept on it (the leash: an edge, never a centre) and carried by her (the carry: her way, her
//                turn, her roll - in her mesh node's frame, which the swell rolls).
//   SHIPMATES  - the player's crew on a deck: every door of the player's harm passes them by (the swing, even alone;
//                the shaft; the spell and its blast; the torch; the charge), their own blasts and shafts pass the player,
//                a green bar over each head, and a room's reader stands another's crew as its own allies (`cw`).
import './modsOff.js';
import { byClass } from './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildDeck, deckOf as deckGrid, intoDeck, outOfDeck, mainLevel, DECK_CELL, DECK_STEP, DECK_HEADROOM, DECK_INSET } from '../src/systems/naval/navalDeck.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat, spawnBoat } from '../src/systems/comeSailAwayBoat.js';
import { raycastColliders, boxColliderTriangles } from '../src/world/prefabColliders.js';
import { MODELS, ctxFor } from './csaScene.mjs';
import { isShipmate, sparedByPlayer } from '../src/combat/friendlyFire.js';
import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { resetToDefaults } from '../src/systems/settings.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { drawCrewBars, destroyNavalHud, tagAlpha, CREW_BAR_RANGE, CREW_FADE_FROM, CREW_GREEN, TAG_FADE_TO } from '../src/ui/navalHud.js';
import { PARTY_GREEN_CSS } from '../src/net/social.js';
import { crewTeamOf, CREW_TEAMS, GRAPPLE_S, HAND } from '../src/systems/naval/navalBoarding.js';
import { sea } from './navalSea.mjs';

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

// ── a little ship, made of her faces ─────────────────────────────────────────────────────────────────────────────

/** Quads (corners in order round each) as one mesh. */
function quads(list) {
  const positions = [], indices = [];
  for (const q of list) { const b = positions.length / 3; for (const p of q) positions.push(...p); indices.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  return { positions, indices };
}
const box = (x0, y0, z0, x1, y1, z1) => boxColliderTriangles({ m_Center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, m_Size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 } });
const wall = (x0, z0, x1, z1, y0, y1) => quads([[[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]]]);
/** Her deck at 2 m over x -3..3, z -8..8; a bulwark each side rising 45 degrees to a flat rail at 3 m (x 4..4.3); a
 *  cabin walled in at her stern (x -2..2, z -8..-5, no door); a boom 1.2 m over her deck (x -1..1, z -3.2..-2.8); a
 *  crate (x 1..2, z -1..0); a mast (x -0.2..0.2, z 1.8..2.2); two 0.3 m stairs up to a forecastle at 2.9 m (z 5..8). */
const SLOOP = [
  quads([
    [[-3, 2, -8], [3, 2, -8], [3, 2, 8], [-3, 2, 8]],
    [[3, 2, -8], [4, 3, -8], [4, 3, 8], [3, 2, 8]], [[-3, 2, 8], [-4, 3, 8], [-4, 3, -8], [-3, 2, -8]],
    [[4, 3, -8], [4.3, 3, -8], [4.3, 3, 8], [4, 3, 8]], [[-4.3, 3, -8], [-4, 3, -8], [-4, 3, 8], [-4.3, 3, 8]],
    [[-3, 2.3, 4], [3, 2.3, 4], [3, 2.3, 4.5], [-3, 2.3, 4.5]], [[-3, 2.6, 4.5], [3, 2.6, 4.5], [3, 2.6, 5], [-3, 2.6, 5]],
    [[-3, 2.9, 5], [3, 2.9, 5], [3, 2.9, 8], [-3, 2.9, 8]],
  ]),
  wall(-3, 4, 3, 4, 2, 2.3), wall(-3, 4.5, 3, 4.5, 2.3, 2.6), wall(-3, 5, 3, 5, 2.6, 2.9),   // the stairs' risers
  wall(-2, -8, -2, -5, 2, 4.2), wall(2, -8, 2, -5, 2, 4.2), wall(-2, -5, 2, -5, 2, 4.2),   // the cabin
  box(-1, 3.2, -3.2, 1, 3.4, -2.8), box(1, 2, -1, 2, 3, 0), box(-0.2, 2, 1.8, 0.2, 12, 2.2),
];
const EXTENT = { minX: -5, maxX: 5, minZ: -9, maxZ: 9 };
const sloop = () => buildDeck(SLOOP, EXTENT);
const cells = (deck) => { const out = []; for (let j = 0; j < deck.y.length; j++) if (!Number.isNaN(deck.y[j])) { const i = j % deck.nx, k = (j - i) / deck.nx; out.push([deck.minX + (i + 0.5) * deck.cell, deck.y[j], deck.minZ + (k + 0.5) * deck.cell]); } return out; };
/** Whether the straight leg from `a` to `b` stays on the deck at every tenth of a cell. */
const legOnDeck = (deck, a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (deck.cell * 0.1)); for (let s = 0; s <= n; s++) if (!deck.walkable(a[0] + (b[0] - a[0]) * s / n, a[2] + (b[2] - a[2]) * s / n)) return false; return true; };

test('DECK-WALK THE DECK (a little ship made of her faces): her main deck at 2 m and the stairs up to her forecastle at 2.9 m - never the bulwark\'s 45-degree ramp, the flat rail at 3 m, the crate\'s top, the deck in a boom\'s shadow, a thin mast\'s cells or the cabin walled in at her stern; every cell a cell in from her edges (mutants: the headroom unread, walls unread, the step unread, no inset, the cabin kept, the main level the highest)', () => {
  const d = sloop();
  assert.equal(d.cell, DECK_CELL);
  assert.ok(d.count > 150, `a deck: ${d.count} cells`);
  const at = (x, z, want, what) => assert.ok(Math.abs(d.heightAt(x, z) - want) < 1e-6, `${what}: ${d.heightAt(x, z)}`);   // her heights are kept as float32
  at(0, 0.75, 2, 'her main deck');
  at(0, 4.25, 2.3, 'the stairs, a tread at a time');
  at(0, 4.75, 2.6, 'the second tread');
  at(0, 6.75, 2.9, 'her forecastle');
  for (const [x, z, what] of [[3.5, 0, 'the bulwark\'s ramp'], [4.15, 0, 'the rail\'s top'], [2.75, 0, 'her edge (the inset)'], [0, -3, 'under the boom'], [1.5, -0.5, 'the crate'], [0, 2, 'the mast'], [0.25, 2.25, 'the mast\'s other cell'], [0, -6.25, 'the cabin'], [-1.25, -7.25, 'the cabin\'s corner'], [0, 7.75, 'her bow\'s edge']]) {
    assert.equal(d.walkable(x, z), false, what);
    assert.ok(Number.isNaN(d.heightAt(x, z)), what);
  }
  for (const [x, z, what] of [[2.25, -3, 'beside the boom'], [1.25, 2, 'beside the mast'], [-2.25, 0, 'along her side'], [-2.25, -4.25, 'before the cabin\'s wall, past the boom\'s end']]) assert.equal(d.walkable(x, z), true, what);
  // every cell stands on a face with its headroom and at most a tread off its neighbours
  for (const c of cells(d)) {
    assert.ok([2, 2.3, 2.6, 2.9].some((h) => Math.abs(c[1] - h) < 1e-6), `a floor's height: ${c[1]}`);
    assert.ok(Math.abs(c[0]) <= 3 - DECK_INSET * DECK_CELL, `off her side: ${c[0]}`);
  }
  assert.equal(DECK_HEADROOM, 1.7);
  assert.equal(DECK_STEP, 0.4);
});

test('DECK-WALK THE CLAMP AND THE NEAREST: a point on deck is itself; a point on the rail, over the side or out at sea is put on the deck\'s edge nearest it - sliding along it as it moves, never snapped to a cell\'s centre; the nearest cell by a ring search is the nearest by every cell (mutants: a centre for the clamp, the rings\' stop one early, the square\'s distance unread)', () => {
  const d = sloop();
  assert.deepEqual(d.clamp(1.1, 3.25), [1.1, 2, 3.25], 'on deck: untouched');
  const rail = d.clamp(4.15, 3.25);
  assert.ok(d.walkable(rail[0], rail[2]), 'back on deck');
  assert.ok(Math.abs(rail[0] - 2.5) < 1e-2 && rail[2] === 3.25 && rail[1] === 2, `her edge, where it pressed: ${rail}`);
  const slide = [3.05, 3.15, 3.35].map((z) => d.clamp(3.5, z));
  assert.deepEqual(slide.map((p) => p[2]), [3.05, 3.15, 3.35], 'along the edge as it presses');
  assert.ok(slide.every((p) => Math.abs(p[0] - rail[0]) < 1e-9), 'the same edge');
  const far = d.clamp(40, 60);
  assert.ok(d.walkable(far[0], far[2]));
  assert.ok(Math.abs(far[1] - 2.9) < 1e-6, 'the forecastle\'s corner, the nearest of her');
  // the ring search against every cell
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const sq = (x, z, c) => { const dx = Math.max(0, Math.abs(x - c[0]) - d.cell / 2), dz = Math.max(0, Math.abs(z - c[2]) - d.cell / 2); return dx * dx + dz * dz; };
  const all = cells(d);
  for (let n = 0; n < 400; n++) {
    const x = -12 + rnd() * 24, z = -14 + rnd() * 28;
    const got = d.nearest(x, z), best = Math.min(...all.map((c) => sq(x, z, c)));
    assert.ok(Math.abs(sq(x, z, got) - best) < 1e-9, `nearest to (${x.toFixed(2)}, ${z.toFixed(2)})`);
    const p = d.clamp(x, z);
    assert.ok(d.walkable(p[0], p[2]) && Math.abs(Math.hypot(p[0] - x, p[2] - z) - Math.sqrt(best)) < 1e-3, 'the clamp: the nearest point of the nearest square (a hair inside it)');
  }
});

test('DECK-WALK THE SPOTS AND THE WALK: a muster spread across her deck from her middle out, each on deck and none on another; a walk from her waist to her forecastle round the mast, the crate and the boom and up her stairs, every leg on deck and no tread too high; one cell to itself (mutants: the spread unread, the corners cut past an edge, the tread unread)', () => {
  const d = sloop();
  const spots = d.spots(6);
  assert.equal(spots.length, 6);
  for (const s of spots) assert.ok(d.walkable(s[0], s[2]), `on deck: ${s}`);
  for (let i = 0; i < spots.length; i++) for (let j = 0; j < i; j++) assert.ok(Math.hypot(spots[i][0] - spots[j][0], spots[i][2] - spots[j][2]) >= 2, 'spread, a pace and more apart');
  assert.ok(Math.abs(spots[0][2] - 1) < 3, `the first her middle: ${spots[0]}`);
  const walk = d.path([0, -4.25], [0, 7]);
  assert.ok(walk && walk.length >= 3, 'a walk round what stands in the way');
  assert.ok(Math.abs(walk.at(-1)[1] - 2.9) < 1e-6, 'up on her forecastle');
  for (let i = 1; i < walk.length; i++) {
    assert.ok(legOnDeck(d, walk[i - 1], walk[i]), `leg ${i} on deck`);
    assert.ok(Math.abs(walk[i][1] - walk[i - 1][1]) <= DECK_STEP * Math.ceil(Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][2] - walk[i - 1][2]) / (d.cell * 0.5)));
  }
  const open = d.path([-2.25, -2], [-2.25, 1]);
  assert.equal(open.length, 2, 'a straight walk is one leg');
  assert.equal(d.path([0.75, 0.75], [0.75, 0.75]).length, 1);
  // the walk's own scratch: the same answer again, and after a thousand others
  const again = d.path([0, -4.25], [0, 7]);
  assert.deepEqual(again, walk);
  for (let n = 0; n < 200; n++) d.path([-2.25, -4], [2.25, 6]);
  assert.deepEqual(d.path([0, -4.25], [0, 7]), walk);
});

/** Whether a leg keeps off every blocked cell - a thick line: fine samples a hair either side of it, so a leg through
 *  the corner of a blocked cell is seen (a sample on the leg itself never lands in the cell beside a corner). */
const legClear = (deck, a, b) => {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(len / (deck.cell * 0.01)), e = deck.cell * 1e-3;
  const px = len ? -(b[2] - a[2]) / len * e : 0, pz = len ? (b[0] - a[0]) / len * e : 0;
  for (let s = 0; s <= n; s++) {
    const x = a[0] + (b[0] - a[0]) * s / n, z = a[2] + (b[2] - a[2]) * s / n;
    if (!deck.walkable(x + px, z + pz) || !deck.walkable(x - px, z - pz)) return false;
  }
  return true;
};

test('DECK-WALK THE CORNER AND THE LEDGE (grids of 1 m cells): two blocked cells meeting at a corner are a wall no walk squeezes through, and no leg of it cuts past a blocked cell\'s corner; a ledge higher than a tread is walked round by its ramp, never stepped off in a straightened leg (mutants: the walk\'s corner rule, the leg\'s corner rule, the leg\'s tread)', () => {
  const y = new Float32Array(25).fill(0);
  y[1 * 5 + 2] = NaN; y[2 * 5 + 1] = NaN;
  const grid = deckGrid({ cell: 1, minX: 0, minZ: 0, nx: 5, nz: 5, y });
  for (const [a, b] of [[[1.5, 1.5], [2.5, 2.5]], [[1.5, 0.5], [3.5, 2.5]], [[0.5, 1.5], [2.5, 3.5]], [[1.5, 1.5], [3.5, 3.5]]]) {
    const walk = grid.path(a, b);
    assert.ok(walk.length > 2, `round the wall: ${JSON.stringify(walk)}`);
    for (let i = 1; i < walk.length; i++) assert.ok(legClear(grid, walk[i - 1], walk[i]), `no corner cut: ${JSON.stringify(walk)}`);
  }
  assert.equal(deckGrid({ cell: 1, minX: 0, minZ: 0, nx: 5, nz: 5, y: new Float32Array(25).fill(0) }).path([1.5, 1.5], [2.5, 2.5]).length, 2, 'straight across with no wall');
  // a ledge: columns 0-2 at 0 m and 3-5 at 1 m, joined only by the ramp along the top row
  const ledge = new Float32Array(24);
  for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) ledge[k * 6 + i] = k === 3 ? [0, 0.25, 0.5, 0.75, 1, 1][i] : i < 3 ? 0 : 1;
  const up = deckGrid({ cell: 1, minX: 0, minZ: 0, nx: 6, nz: 4, y: ledge }).path([1.5, 0.5], [4.5, 0.5]);
  assert.ok(up.length > 2 && up.some((q) => q[2] > 3), `by the ramp, never off the ledge: ${JSON.stringify(up)}`);
});

test('DECK-WALK HER FRAME: a point goes into the deck through her mesh node\'s live matrix and out of it the same way - rolled, pitched, turned and moved, to the bit round the trip, writing into the array given (mutants: the inverse\'s rows swapped, the translation unread)', () => {
  const m = matrixOf({ yaw: 0.52, roll: 0.21, pitch: -0.09, at: [103.5, -0.7, -48.25] });
  const q = [1.25, 2, -3.5];
  const w = outOfDeck(m, q);
  const back = intoDeck(m, w);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - q[i]) < 1e-9);
  const into = [0, 0, 0];
  assert.equal(intoDeck(m, w, into), into, 'written where asked');
  const rest = matrixOf({});
  assert.deepEqual(intoDeck(rest, [4, 5, 6]), [4, 5, 6]);
  assert.deepEqual(outOfDeck(matrixOf({ at: [1, 2, 3] }), [4, 5, 6]), [5, 7, 9]);
});

/** A column-major rigid matrix: yaw about y, then pitch about x and roll about z (the swell's), then moved. */
function matrixOf({ yaw = 0, roll = 0, pitch = 0, at = [0, 0, 0] }) {
  const mul = (a, b) => { const r = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
  const Ry = [Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
  const Rx = [1, 0, 0, 0, Math.cos(pitch), -Math.sin(pitch), 0, Math.sin(pitch), Math.cos(pitch)];
  const Rz = [Math.cos(roll), -Math.sin(roll), 0, Math.sin(roll), Math.cos(roll), 0, 0, 0, 1];
  const R = mul(Ry, mul(Rx, Rz));   // row-major
  return Float64Array.from([R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, at[0], at[1], at[2], 1]);
}

// ── the real hulls ──────────────────────────────────────────────────────────────────────────────────────────────

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
let _pool = null;
async function pool() {
  if (!_pool) { _pool = createComeSailAwayPool({ fetchFn: fileFetch, log: { warn() {} } }); assert.ok(await _pool.ensureModels()); }
  return _pool;
}
const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : null);
/** The hull stood at rest - her colliders to cast at. */
const standing = (hull) => { const b = new Boat(hull, 0); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };

test('DECK-WALK THE REAL HULLS: the Small Ship\'s main deck at 6.20 m, the Large Galley\'s at 10.25, the Carrack\'s at 7.81 (PIN MOVED, SHIPS-2: Mac\'s carrack - the mod\'s stood at 3.64) - each cell a floor her own colliders stand under a head\'s height clear (a ray down from DECK_HEADROOM over it meets her deck and nothing first), none on a rail; her open deck alone (the Small Ship\'s great cabin under her castle aft of 10.3 m and the Carrack\'s rooms under her half deck no deck - PIN MOVED, GALLEON 2026-10-01: the Small Ship is the new galleon, her castle\'s roof up its flights her deck as the Carrack\'s forecastle up its stair is hers); sixteen spots all on it, where the box\'s blind rays stood one on the Galleon\'s outer bow (mutants: the frame unread, the pieces kept, the headroom unread)', async () => {
  const p = await pool();
  // PIN MOVED (AUDIT GALLEON D7, 2026-10-02): her hatchways no deck (a part that opens is no floor of hers) - the
  // galleon's main deck 654 of her 828 cells (79%: her hatchways' 82 out of it), her castle and flights the 174 they
  // were (21%); the Carrack's 400 of 433 (her cargo hatch out), her forecastle's 33 (8%). PIN MOVED (AUDIT GALLEON
  // D-wall, 2026-10-02): a wall marks a cell with its own height there - the galleon's main deck 664 of 838 (her entry
  // ports and her bow to her side, 10 more), her castle and flights the 174 they were; the Carrack's 465 of 511 (the
  // ground under her half deck's stairs and the room under her forecastle), her forecastle 39 and her stair 7 (9%)
  // PIN MOVED (SHIPS-2, 2026-10-07): hull 4 is Mac's carrack - her main deck at 7.81 her whole open deck (1087 cells,
  // one level: her houses, her masts' partners and her helm out of it), no raised deck a walk reaches
  for (const [hull, level, aftOf, raised, share] of [[2, 6.2, -10.3, 0.208, 0.792], [3, 10.25, null, 0, 0.8], [4, 7.81, null, 0, 0.99]]) {
    const d = p.deckOf(hull, 0);
    assert.equal(p.deckOf(hull, 0), d, 'baked once');
    assert.ok(d.count > 300, `hull ${hull}: ${d.count} cells`);
    const all = cells(d);
    const main = all.filter((c) => Math.abs(c[1] - level) <= DECK_STEP).length;
    // her main deck, and her raised deck up its flights no more than `raised` of it (the Small Ship's castle, the
    // Carrack's forecastle)
    assert.ok(main / all.length > share && all.filter((c) => c[1] > level + DECK_STEP).length <= raised * all.length + 1e-9, `hull ${hull}: her main deck (${main} of ${all.length})`);
    if (aftOf != null) assert.ok(all.every((c) => c[2] > aftOf || c[1] > level + DECK_STEP), `hull ${hull}: nothing of her main deck aft of ${aftOf}`);
    const b = standing(hull);
    for (let i = 0; i < all.length; i += 9) {
      const c = all[i];
      const hit = raycastColliders(b.GameObject, [c[0], c[1] + DECK_HEADROOM - 0.05, c[2]], [0, -1, 0], DECK_HEADROOM + 1, { triggers: false, geometry });
      assert.ok(hit && Math.abs(hit.point[1] - c[1]) < 0.12, `hull ${hull} at (${c[0]}, ${c[2]}): her floor under a head's height clear (${hit?.point[1]} for ${c[1]})`);
    }
    // PIN MOVED (AUDIT NAV2 F34): her forecastle, 2.49 m up her stair, is her deck now - a spot never under her main deck
    // (her hold, her lower deck), and a floor of hers where it stands (GALLEON: the new galleon's castle 4.8 m up)
    for (const s of d.spots(16)) assert.ok(d.walkable(s[0], s[2]) && s[1] > level - DECK_STEP && Math.abs(d.heightAt(s[0], s[2]) - s[1]) < 1e-6, `hull ${hull}: a spot on her deck ${s}`);
    // GALLEON: her hands' and her musters' spots her main deck's alone
    for (const s of d.spots(16, mainLevel(d))) assert.ok(Math.abs(s[1] - mainLevel(d)) <= DECK_STEP, `hull ${hull}: a spot on her main deck ${s}`);
  }
  // HER MESH NODE'S FRAME: her deck's heights are her node's, a ray in the world (her root at the origin) meeting it as
  // high over the root as her node stands (PIN MOVED, SHIPS-2: hull 1 is Mac's Tiny Ship, her node at her root, where
  // the mod's Large Boat's stood 0.1 m up it)
  const boat = p.deckOf(1, 0), lb = standing(1), up = lb.MeshObject.worldMatrix()[13];
  assert.ok(Math.abs(up) < 1e-6, 'her node at her root');
  for (const c of cells(boat)) {
    const hit = raycastColliders(lb.GameObject, [c[0], c[1] + 2, c[2]], [0, -1, 0], 4, { triggers: false, geometry });
    assert.ok(hit && Math.abs(hit.point[1] - (c[1] + up)) < 0.02, `her deck in her node's frame (${hit?.point[1]} for ${c[1]})`);
  }
  // the Carrack's rail at 5 m forward: its top 4.67 m at 6.5 m out, over her deck at 3.64
  // PIN MOVED (SHIPS-2, 2026-10-07): the Carrack is Mac's carrack - her rail 6 m out abaft her middle house (z -11), her
  // waist inside it, her middle house (over her aft hatchway) no deck
  const carrack = p.deckOf(4, 0);
  assert.equal(carrack.walkable(6.2, -11), false, 'her rail');
  assert.equal(carrack.walkable(3, -11), true, 'her waist');
  assert.equal(carrack.walkable(0, -6.5), false, 'her middle house, over her aft hatchway');
  const back = carrack.clamp(6.2, -11);
  assert.ok(back[0] < 5.5 && carrack.walkable(back[0], back[2]) && Math.abs(back[1] - 7.81) < 0.15, `off the rail onto her deck: ${back}`);
});

// ── the leash and the carry, lifted from the world host ──────────────────────────────────────────────────────────

/** The world host's deck registry, leash and carry over a stand-in boat: her mesh node's matrix is the test's. */
function deckRig(deck) {
  const foes = [];
  const boat = { hull: 4, variant: 0, GameObject: { activeSelf: true, worldMatrix: () => rootM }, MeshObject: { worldMatrix: () => meshM } };
  let meshM = matrixOf({}), rootM = matrixOf({});
  const body = `
    const { intoDeck, outOfDeck, DECK_STEP, csa, exteriorFoes } = s;
    ${line('  const navalDeckToWorld = (boat, p, out) =>')}${line('  const navalWorldToDeck = (boat, p, out) =>')}
    ${line('  const _deckBodies = new Set();')}${line('  const navalDeckBody = (f, boat) =>')}${line('  const _leashLocal = [0, 0, 0];')}
    ${lift('navalLeash')}${lift('navalCarry')}
    return { navalLeash, navalCarry, navalDeckBody, bodies: _deckBodies };`;
  // eslint-disable-next-line no-new-func
  const w = new Function('s', body)({ intoDeck, outOfDeck, DECK_STEP, csa: { deckOf: () => deck }, exteriorFoes: { foes } });
  const stand = (local) => { const f = { dead: false, ai: { feet: outOfDeck(meshM, local) }, entity: {} }; foes.push(f); w.navalDeckBody(f, boat); return f; };
  return { ...w, boat, foes, stand, pose: (o) => { meshM = matrixOf(o); rootM = matrixOf({ ...o, roll: 0, pitch: 0 }); }, mesh: () => meshM };
}
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test('DECK-WALK THE LEASH: a body on her deck stays where it stands - on a deck rolled 12 degrees and pitched too, where the root\'s frame read it as off her deck; one climbed onto her rail, stepped over the side or fallen through her deck is set back on it, at her edge and her height; a body gone, dead or off her is let go (mutants: the root\'s frame, the edge a centre, the height unread, a body kept past its death)', () => {
  const r = deckRig(sloop());
  r.pose({ yaw: 0.8, roll: 0.21, pitch: 0.07, at: [210, 0.4, -95] });
  const onDeck = r.stand([1.1, 2, 3.25]);
  const was = [...onDeck.ai.feet];
  const railed = r.stand([4.15, 3, 3.1]);
  const over = r.stand([6, 0.5, 3.1]);
  const fallen = r.stand([1.1, 1.2, 3.25]);
  r.navalLeash();
  assert.ok(near(onDeck.ai.feet, was), 'on her rolled deck: untouched');
  for (const [f, what, z, x] of [[railed, 'the rail', 3.1, 2.5], [over, 'over the side', 3.1, 2.5], [fallen, 'through her deck', 3.25, 1.1]]) {
    const local = intoDeck(r.mesh(), f.ai.feet);
    assert.ok(sloop().walkable(local[0], local[2]), `${what}: back on deck (${local})`);
    assert.ok(Math.abs(local[1] - 2) < 1e-6, `${what}: at her height`);
    assert.ok(Math.abs(local[2] - z) < 1e-6 && Math.abs(local[0] - x) < 1e-2, `${what}: where it pressed - her edge, not a cell's centre (${local})`);
  }
  assert.equal(r.bodies.size, 4);
  railed.dead = true;
  r.foes.splice(r.foes.indexOf(over), 1);
  r.boat.GameObject.activeSelf = true;
  r.navalLeash();
  assert.equal(r.bodies.size, 2, 'the dead and the gone let go');
});

test('DECK-WALK THE CARRY: every deck body where the leash last left it, taken through her pose now - her way, her turn and her roll - before the foes move: a ship under way no longer sails out from under her boarders; a body the leash has not yet seen is left where it stands (mutants: the carry unwired, carried from the world\'s place, carried by the root)', () => {
  const r = deckRig(sloop());
  r.pose({ yaw: 0.1, at: [0, 0, 0] });
  const f = r.stand([-1.6, 2, 3.1]);
  const fresh = [...f.ai.feet];
  r.navalCarry();
  assert.deepEqual(f.ai.feet, fresh, 'not yet leashed: nothing to carry from');
  r.navalLeash();
  for (let t = 0; t < 30; t++) {
    r.pose({ yaw: 0.1 + t * 0.01, roll: Math.sin(t) * 0.1, at: [0, 0, 4.5 * t / 10] });   // under way at 4.5 m/s, turning, rolling
    r.navalCarry();
    r.navalLeash();
  }
  assert.ok(near(intoDeck(r.mesh(), f.ai.feet), [-1.6, 2, 3.1], 1e-6), 'where it stood on her, thirty frames on');
  assert.match(WORLD, /if \(_deckBodies\.size\) navalCarry\(\);[^\n]*\n\s+exteriorFoes\.update\(foeDt, _pf, cam\.pos, _foeSenses\(\)\);[^\n]*\n\s+if \(_deckBodies\.size\) navalLeash\(\);/, 'carried before the foes move, leashed after');
  assert.match(WORLD, /const deck = boat\.MeshObject && csa\.deckOf\?\.\(boat\.hull, boat\.variant \?\? 0\);\n\s+if \(deck\?\.count\) \{/, 'the muster\'s spots off the same deck');
});

// ── SHIPMATES ───────────────────────────────────────────────────────────────────────────────────────────────────

const mate = (o = {}) => ({ id: 'mate', dead: false, deckBoat: {}, entity: { team: 'PlayerAlly' }, ai: { height: 1.8, isHostile: true }, ...o });

test('SHIPMATES WHO THEY ARE: an ally of the player\'s standing on a deck, alive - or a room\'s crew its owner names; a pirate on a deck is none, nor a summoned ally on land (DFU\'s own friendly fire kept); the player\'s harm passes a shipmate and a town\'s defender by (mutants: the deck unread, the team unread, the dead spared, the named crew unread)', () => {
  assert.equal(isShipmate(mate()), true);
  assert.equal(isShipmate(mate({ dead: true })), false, 'the fallen');
  assert.equal(isShipmate(mate({ entity: { team: 'Criminals' } })), false, 'her pirates, on her own deck');
  assert.equal(isShipmate(mate({ deckBoat: null })), false, 'a summoned daedra on the shore');
  assert.equal(isShipmate(mate({ deckBoat: null, shipmate: true })), true, 'a room\'s crew its owner names');
  assert.equal(isShipmate(null), false);
  assert.equal(sparedByPlayer(mate()), true);
  assert.equal(sparedByPlayer({ defender: true }), true, 'the town\'s defenders, as before');
  assert.equal(sparedByPlayer(mate({ entity: { team: 'Criminals' } })), false);
  assert.deepEqual(CREW_TEAMS, { pirate: 'Criminals', merchant: 'KnightsAndMages', navy: 'KnightsAndMages' });
  assert.equal(crewTeamOf({ faction: 'navy' }), 'KnightsAndMages');
  assert.equal(crewTeamOf(null), 'Criminals');
});

test('SHIPMATES THE SWING, through the pool that holds them: a shipmate in reach is never the swing\'s - beside a pirate or alone, where the vanilla arm strikes a lone ally (friendlyProtected\'s fallback); the pirate beside him still is; an ally on land keeps DFU\'s own law (mutants: the spare unread)', async () => {
  resetToDefaults();
  const pool = foesPool('aaa-0001');
  const pw = () => new PlayerWeapon({ weapon: { name: 'Saber', templateIndex: WEAPONS.Saber, material: 0 }, liveSpeed: 50 });
  const eye = [100, 1.6, 98.8], look = [0, 0, 1], feet = [100, 0, 98.8], inView = () => true;
  const crewman = await pool.spawnFoe(144, [100, 0, 100], { feetGiven: true, loose: true, transient: true, allied: true });
  crewman.deckBoat = {};   // on her deck (the world's registry, DECK-WALK)
  const health = crewman.entity.health;
  assert.equal(pool.resolvePlayerHit(pw(), eye, look, feet, inView, null), false, 'alone in reach: no swing lands on him');
  assert.equal(crewman.entity.health, health);
  const pirate = await pool.spawnFoe(143, [100.4, 0, 100.1], { feetGiven: true, loose: true, transient: true, team: 'Criminals' });
  assert.equal(pool.resolvePlayerHit(pw(), eye, look, feet, inView, null), true, 'the pirate beside him is the swing\'s');
  assert.equal(crewman.entity.health, health, 'and still not him');
  pirate.dead = true;
  crewman.deckBoat = null;   // an ally ashore - a summoned daedra, say
  assert.equal(pool.resolvePlayerHit(pw(), eye, look, feet, inView, null), true, 'an ally on land keeps the vanilla arm');
});

test('SHIPMATES THE SHAFT: the player\'s shaft flies through a shipmate to the pirate behind him; a crewman\'s own shaft loosed at a pirate spends itself on the player it meets and deals nothing (mutants: the spare unread)', () => {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  const pirate = { id: 'pirate', dead: false, ai: { height: 1.8 }, entity: { team: 'Criminals' } };
  f.fire([0, 0.9, 0], [0, 0, 1], { fromPlayer: true, weapon: {} });
  const hits = [];
  const targets = [{ feet: [0, 0, 1.5], ref: mate() }, { feet: [0, 0, 4], ref: pirate }];
  for (let i = 0; i < 20 && !hits.length; i++) f.update(0.05, { foeTargets: targets, onPlayerArrowHitFoe: (m, t) => hits.push(t.id) });
  assert.deepEqual(hits, ['pirate']);
  const g = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  g.fire([0, 0.9, -2], [0, 0, 1], { enemy: true, shooterFoe: mate(), weapon: {}, aimFoe: pirate });
  const onMe = [];
  for (let i = 0; i < 20 && !g.arrows[0].dead; i++) g.update(0.05, { foeTargets: [], playerFeet: [0, 0, 0], playerHeight: 1.8, onPlayerHit: (m) => onMe.push(m) });
  assert.deepEqual(onMe, [], 'loosed at the pirate: nothing dealt the player');
});

const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const spellOf = (rangeType, name) => ({ name, index: 90, element: 4, rangeType, effects: [fx(4, 0), EMPTY, EMPTY] });
const foeRec = (id, feet, extra = {}) => ({
  id, ai: { feet, height: 1.8, isHostile: true }, dead: false,
  entity: { health: 100, maxHealth: 100, level: 1, team: 'Criminals', stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, activeEffects: [], skills: new Array(40).fill(0) },
  ...extra,
});
const crewRec = (id, feet) => { const f = foeRec(id, feet, { deckBoat: {} }); f.entity.team = 'PlayerAlly'; return f; };
function spellRig(foes) {
  const hurt = [], mine = [];
  const player = { isPlayer: true, level: 4, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt: (n) => mine.push(n), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => foes,
    foeSinks: (f) => ({ hurt: (n) => hurt.push([f.id, n]), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5,
    startCastAnim: null,
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, hurt, mine, player };
}
const struck = (hurt) => [...new Set(hurt.map(([id]) => id))].sort();

test('SHIPMATES THE SPELL: the player\'s area, touch, missile and blast pass a shipmate by and land on the pirate; a crewman\'s own blast at a pirate passes the player and the rest of the crew by (mutants: the spare unread, the crew\'s blast unspared)', () => {
  const area = spellRig([crewRec('mate', [0, 0, 1.2]), foeRec('pirate', [1.5, 0, 2.5])]);
  area.magic.readySpell(spellOf(3, 'Aura'));
  area.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.deepEqual(struck(area.hurt), ['pirate'], 'the area around the caster');
  const touch = spellRig([crewRec('mate', [0, 0, 1.2])]);
  touch.magic.readySpell(spellOf(1, 'Touch'));
  assert.equal(touch.magic.castInput([0, 0.9, 0], [0, 0, 1]), false, 'a touch with only a shipmate in reach finds no target');
  const ball = spellRig([crewRec('mate', [0, 0, 5]), foeRec('pirate', [0, 0, 6])]);
  ball.magic.readySpell(spellOf(4, 'Fireball'));
  ball.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  for (let i = 0; i < 60 && !ball.hurt.length; i++) ball.magic.update(0.05, [0, 0, 0]);
  assert.deepEqual(struck(ball.hurt), ['pirate'], 'the blast leaves him standing, inside its radius');
  assert.match(src('src/scenes/hostMagic.js'), /const crewBlast = isShipmate\(caster\?\.foe\);[\s\S]{0,400}if \(crewBlast && isShipmate\(t\)\) continue;[\s\S]{0,4000}if \(playerFeet && !crewBlast && sphereOverlapsCapsule\(pos, EXPLOSION_RADIUS, playerFeet, playerHeight, PLAYER_BODY_RADIUS\)\) \{/, 'a crewman\'s blast: the crew and the player passed by');
  assert.match(src('src/scenes/hostMagic.js'), /if \(playerFeet && !isShipmate\(m\.casterFoe\)\) \{/, 'a crewman\'s missile flies past the player');
  assert.match(src('src/scenes/hostMagic.js'), /casterFoe \? \{ entity: m\.casterFoe\.entity, sinks: foeSinks\(m\.casterFoe\), foe: m\.casterFoe \}/, 'the caster wrapper carries its foe');
});

test('SHIPMATES THE TORCH AND THE CHARGE by source: the thrown torch and a mount\'s charge pass the player\'s crew by, as the defenders (mutants: either unfiltered)', () => {
  assert.match(WORLD, /foes: \(\) => \[\.\.\.cityGuards\.guards\.filter\(\(g\) => !g\.defender\), \.\.\.exteriorFoes\.foes\.filter\(\(f\) => !sparedByPlayer\(f\)\)\], foeSinks/);
  assert.match(WORLD, /foes: \(\) => exteriorFoes\.foes\.filter\(\(f\) => !sparedByPlayer\(f\)\), guards: \(\) => cityGuards\.guards\.filter/);
});

test('SHIPMATES THE CREW\'S BARS: a green bar a crewman - the party\'s one green - at the HUD\'s scale over his head, the fill his health, fading with his distance to CREW_BAR_RANGE; one node a slot, moved, never rebuilt; a window over the world hides them all, and every clear; the world projects every shipmate\'s head (mine and a room\'s) through the frame\'s matrices behind a sight cache of the crew\'s own (mutants: the green another, rebuilt each frame, never hidden, the fade reversed, the clear unwired)', () => {
  destroyNavalHud();
  assert.equal(CREW_GREEN, PARTY_GREEN_CSS);
  drawCrewBars([{ x: 300, y: 120, share: 0.4, distance: 10 }, { x: 500, y: 160, share: 1, distance: 40 }], { scale: 1.25 });
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const bars = byClass(layer, 'dfnaval-crew');
  assert.equal(bars.length, 2);
  assert.equal(bars[0].children[0].style.width, '40%');
  assert.equal(bars[0].style.transform, 'translate(300px, 120px) scale(1.25) translate(-50%, -100%)');
  assert.deepEqual(bars.map((b) => b.style.opacity), ['1', String(Math.round(tagAlpha(40, CREW_BAR_RANGE, CREW_FADE_FROM) * 100) / 100)]);
  assert.ok(Number(bars[1].style.opacity) < Number(bars[0].style.opacity), 'the farther, the fainter');
  assert.equal(tagAlpha(CREW_FADE_FROM, CREW_BAR_RANGE, CREW_FADE_FROM), 1, 'whole to its fade');
  assert.equal(tagAlpha(CREW_BAR_RANGE, CREW_BAR_RANGE, CREW_FADE_FROM), TAG_FADE_TO, 'the tags\' faintest at the crew\'s reach');
  drawCrewBars([{ x: 310, y: 120, share: 0.25, distance: 10 }], { scale: 1.25 });
  const again = byClass(layer, 'dfnaval-crew');
  assert.equal(again[0], bars[0], 'the same node');
  assert.equal(again[0].children[0].style.width, '25%');
  assert.equal(again[1].style.display, 'none', 'a slot with no crewman hidden');
  drawCrewBars([{ x: 310, y: 120, share: 0.25, distance: 10 }], { covered: true });
  assert.ok(byClass(layer, 'dfnaval-crew').every((n) => n.style.display === 'none'), 'covered: all hidden');
  destroyNavalHud();
  // the world's side
  assert.match(WORLD, /navalTags\(proj, view, mwv\.eye\);[^\n]*\n\s+navalCrewBars\(proj, view, mwv\.eye\);/);
  assert.match(WORLD, /for \(const f of _mode\(\) === 'exterior' \? exteriorFoes\.foes : _insidePool\(\)\) \{[^\n]*\n\s+const feet = f\.ai\?\.feet;\n\s+if \(!isShipmate\(f\) \|\| !feet \|\| !f\.entity\) continue;/);   // PIN MOVED (CREW-COMPANIONS): indoors and underground, my companions' bars
  assert.match(WORLD, /if \(crewSight\.blocked\(player\.collider, eye, key, head\)\) continue;/);
  assert.match(WORLD, /const crewSight = createSightCache\(\);/);
  assert.match(WORLD, /drawNavalHud\(null\); drawNavalTags\(\[\]\); drawCrewBars\(\[\]\); drawCrewLines\(\[\]\); \};/);
});

// ── the room: another's crew ────────────────────────────────────────────────────────────────────────────────────

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
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const foesPool = (self) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
};

test('SHIPMATES IN A ROOM: my crew on a deck rides my foes frame named (`cw`) and a reader stands each as its own ally and shipmate - spared its harm, wearing its bar; a pirate on the same deck is not named; a later frame that no longer names him stands him as his species again (mutants: cw unwritten, the build\'s side ignored, the flip back ignored)', async () => {
  const owner = foesPool('aaa-0001'), reader = foesPool('mmm-0002');
  const crewman = await owner.spawnFoe(0, [100, 0, 100], { feetGiven: true, loose: true, transient: true, allied: true });
  const pirate = await owner.spawnFoe(0, [102, 0, 100], { feetGiven: true, loose: true, transient: true, team: 'Criminals' });
  crewman.deckBoat = {}; pirate.deckBoat = {};   // the world's deck registry (DECK-WALK)
  const fr = owner.foesFrame(true);
  const rec = fr.f.find((r) => r.f[0] === 100);
  assert.deepEqual(fr.cw, [rec.i], 'my crewman named; her pirate not');
  reader.applyFoes('aaa-0001', fr);
  for (let i = 0; i < 5; i++) await settle();
  const pups = reader.foes.filter((f) => f.puppet === 'aaa-0001');
  const pup = pups.find((f) => f.ai.feet[0] === 100), other = pups.find((f) => f.ai.feet[0] === 102);
  assert.ok(pup && other, 'both stood here');
  assert.equal(pup.entity.team, 'PlayerAlly');
  assert.equal(isShipmate(pup), true, 'a shipmate here too');
  assert.equal(sparedByPlayer(pup), true);
  assert.equal(isShipmate(other), false);
  crewman.deckBoat = null;   // his fight over: off her deck
  const fr2 = owner.foesFrame(true);
  assert.equal(fr2.cw, undefined);
  reader.applyFoes('aaa-0001', fr2);
  assert.equal(isShipmate(pup), false, 'no longer named');
  assert.notEqual(pup.entity.team, 'PlayerAlly', 'his species\' side again');
});

// ── the boarding's musters ──────────────────────────────────────────────────────────────────────────────────────

test('DECK-WALK A MUSTER IS ONE CREW ON ONE DECK: the ship I board stands her captain and her men as her faction\'s one team (a pirate\'s Spellsword among her barbarians fought them with infighting on) on her deck, and my hands on her deck too (mutants: the team dropped, the deck dropped)', async () => {
  const h = await sea({ hull: 2 });
  h.boat.crewed = true;   // hands go over with me
  const id = h.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  h.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  assert.equal(h.host.boarding?.phase, 'fight');
  const enemies = h.log.foes.filter((f) => f.side === 'enemy'), hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.ok(enemies.length > 1);
  assert.ok(enemies.every((f) => f.team === crewTeamOf(e.ship.cls) && f.boat === e.boat), 'one crew, on her deck');
  assert.equal(crewTeamOf(e.ship.cls), 'KnightsAndMages');
  assert.ok(hands.length > 0, 'a crewed boat\'s hands go over');
  assert.ok(hands.every((f) => f.mobile === HAND && f.boat === e.boat && f.team === null), 'my hands: on her deck, the player\'s side');
});

test('DECK-WALK A REPEL IS ONE CREW ON MY DECK: a pirate boarding my wrecked boat stands her party as the Criminals\' one team on my deck, and my hands stand to on it beside me (mutants: the party\'s team dropped, its deck dropped, the hands\' deck dropped)', async () => {
  const h = await sea({ hull: 2, save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  h.boat.crewed = true;
  const id = h.host.spawnShip('pirateBrig', { range: 16, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [16, 0, 0];
  h.host.frame(0.1);
  h.run(0.5);
  assert.equal(h.host.boarding?.kind, 'repel', 'a wrecked boat is boarded at once');
  h.run(GRAPPLE_S + 0.2);
  const party = h.log.foes.filter((f) => f.side === 'enemy'), hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.ok(party.length > 1);
  assert.ok(party.every((f) => f.team === 'Criminals' && f.boat === h.boat), 'her party: one crew, on my deck');
  assert.ok(hands.length > 0 && hands.every((f) => f.boat === h.boat && f.team === null), 'my hands, on my deck');
});
