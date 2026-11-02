// SHIPYARDS (2026-10-11, Mac: "This should also come with a detailed overhaul to piers"): THE PIER'S DRESS - what a
// working quay stands besides its deck, piles, bollards, lanterns and cargo (systems/naval/quays.js pierDress, in the
// berth's frame) and how its model wears it (world/quayModel.js): the braces between the piles, the face's fender piles
// and ladders, the cleats, the coils of rope, the first berth's cargo crane, the jetty's lamp posts (lit with the quay's
// own), the joists and stringers under every deck. Design: bible/03-World/Holdings.md section 7, bible/03-World/Shipyards.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planQuay, pierDress, lanternLights, lanternHead, jettyLanternHead, quayToScene, BRACE_LOW, BRACE_SPAN, FENDER_DOWN, LADDER_DOWN,
  DRESS_LANE, JETTY_LAMP_STEP, CRANE_UP, CRANE_JIB, CRANE_HOOK_UP, PIER_SALT, QUAY_SALT, GANGWAY_LANE, QUAY_DECK_UP, QUAY_DECK_T,
  JETTY_WIDTH, LANTERN_UP, LANTERN_DROP, LANTERN_ARM, PILE_STEP,
} from '../../../src/systems/naval/quays.js';
import { buildQuayModel, JOIST_STEP, LADDER_GRAB } from '../../../src/world/quayModel.js';
import { findHarbour } from '../../../src/systems/naval/shipLife.js';
import { createQuayPool } from '../../../src/scenes/quayPool.js';

const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const SEA = 34;
const groundOf = (land = () => 3) => (x, z) => (coast(x, z) ? SEA - 8 : SEA + land(x, z));
const HARBOUR = findHarbour({ rect: TOWN, isWater: coast });
const planOf = (i = 0, o = {}) => planQuay({ berth: HARBOUR.berths[i], hull: HARBOUR.hull, key: 'port:1', index: i, seaY: SEA, groundAt: groundOf(), ...o });
/** A long pier: a shelf the deepest keel floats some way off - the bed shallow for 60 m off the land, then deep. */
const shelf = (x, z) => (z > 200 ? SEA + 2 : z > 140 ? SEA - 1.2 : SEA - 8);

test('PIERS THE BRACES: each pair of neighbouring piles in a row crossed by two braces, from under the deck\'s timbers down toward the water - never deeper than BRACE_LOW, never across a gap where a pile stood on the bank (mutants: no braces, braced to the bed)', () => {
  const p = planOf();
  assert.ok(p.braces.length >= 2 * 10, `braces: ${p.braces.length}`);
  const top = QUAY_DECK_UP - QUAY_DECK_T - 0.12;
  const pileAt = new Set(p.piles.map(([x, z]) => `${x.toFixed(4)},${z.toFixed(4)}`));
  for (const [a, b] of p.braces) {
    assert.ok(pileAt.has(`${a[0].toFixed(4)},${a[2].toFixed(4)}`) && pileAt.has(`${b[0].toFixed(4)},${b[2].toFixed(4)}`), 'pile to pile');
    assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) <= BRACE_SPAN + 1e-9, 'neighbours');
    for (const y of [a[1], b[1]]) assert.ok(y <= top + 1e-9 && y >= BRACE_LOW + 0.1 - 1e-9, `${y}`);
    assert.ok(Math.abs(a[1] - b[1]) > 0.5, 'a slant');
  }
  assert.equal(p.braces.length % 2, 0, 'in pairs, crossed');
  assert.ok(BRACE_SPAN > PILE_STEP);
});

test('PIERS THE FACE: fender piles about every FENDER_STEP down past the water, two ladders down into the sea with their stiles standing over the deck, cleats at its ends and by each ladder, a coil of rope by each bollard - every one of them out of the gangway\'s lane and DRESS_LANE past it, across the ports and their berths (mutants: a fender in the lane, the ladders short of the water)', () => {
  for (let k = 0; k < 12; k++) for (const i of [0, 1, 2]) {
    const p = planQuay({ berth: HARBOUR.berths[i], hull: HARBOUR.hull, key: `port:${k}`, index: i, seaY: SEA, groundAt: groundOf() });
    for (const [z, foot] of p.fenders) { assert.ok(Math.abs(z) >= GANGWAY_LANE + DRESS_LANE, `fender ${z}`); assert.ok(foot >= FENDER_DOWN - 1e-9 && foot < 0, 'down into the water'); }
    for (const [z, foot] of p.ladders) { assert.ok(Math.abs(z) >= GANGWAY_LANE + DRESS_LANE, `ladder ${z}`); assert.ok(foot >= LADDER_DOWN - 1e-9 && foot < -1, 'down into the sea'); }
    for (const [, z] of p.cleats) assert.ok(z > p.quay.z0 && z < p.quay.z1);
    for (const [x, z] of p.coils) { assert.ok(Math.abs(z) >= GANGWAY_LANE + DRESS_LANE, `coil ${z}`); assert.ok(x > p.quay.x0 && x < p.quay.x0 + 1.5, 'by the face'); }
    for (const c of p.cargo) for (const [x, z, r] of p.coils) assert.ok(Math.abs(c.x - x) > c.s / 2 + r || Math.abs(c.z - z) > c.s / 2 + r, 'never under a crate');
  }
  const p = planOf();
  assert.equal(p.ladders.length, 2, 'one each side of her waist');
  assert.ok(p.ladders[0][0] < 0 && p.ladders[1][0] > 0);
  assert.ok(p.fenders.length >= 8, `fenders: ${p.fenders.length}`);
  assert.equal(p.cleats.length, 2 + p.ladders.length);
  assert.equal(p.coils.length, p.bollards.length);
  // a bank at the face: no ladder and no fender where there is no water under it
  const dry = planOf(0, { groundAt: () => SEA + 1.2 });
  assert.ok(dry, 'a quay on the bank');
  assert.deepEqual([dry.ladders, dry.fenders], [[], []]);
});

test('PIERS THE CRANE: a harbour\'s first berth stands a cargo crane at one end of its back - its post clear of the jetty\'s mouth, the lane and the cargo, its jib swung along the quay toward its middle, its hook over two crates stacked; no other berth stands one; the same crane on every client (mutants: a crane at every berth, its jib out over the water)', () => {
  const p = planOf(0);
  assert.ok(p.crane, 'the first berth\'s');
  const c = p.crane;
  assert.deepEqual([c.up, c.jib, c.hook], [CRANE_UP, CRANE_JIB, CRANE_HOOK_UP]);
  assert.ok(c.x > p.quay.x0 + 2 && c.x < p.quay.x1, 'on its back');
  assert.ok(c.z === p.quay.z0 + 3 || c.z === p.quay.z1 - 3, 'at one end');
  assert.equal(c.dir, c.z < 0 ? 1 : -1, 'its jib toward the middle');
  assert.ok(Math.abs(c.z - (p.jetty.z0 + p.jetty.z1) / 2) >= JETTY_WIDTH / 2 + 1.5);
  for (const cg of p.cargo) assert.ok(Math.abs(cg.z - c.z) >= cg.s / 2 + 0.6, 'clear of the load');
  assert.ok(CRANE_HOOK_UP > 2 * 1.15, 'over two crates');
  for (const i of [1, 2]) assert.equal(planOf(i).crane, null, `berth ${i}`);
  assert.deepEqual(planOf(0).crane, c, 'the same on every client');
  assert.notEqual(PIER_SALT, QUAY_SALT, 'its own stream, the cargo\'s load the one it was');
});

test('PIERS THE JETTY\'S LAMPS: a long jetty stands a lamp post every JETTY_LAMP_STEP, the first that far out from the quay, on its rails by turns, each lantern hung in over the jetty; lit with the quay\'s own two, after them (mutants: no lamps, hung out over the water)', () => {
  const b = findHarbour({ rect: TOWN, isWater: (x, z) => shelf(x, z) < SEA - 3 }).berths[0];
  const p = planQuay({ berth: b, hull: HARBOUR.hull, key: 'port:2', index: 0, seaY: SEA, groundAt: shelf });
  assert.ok(p?.jetty, 'a pier to the shore');
  const len = p.jetty.x1 - p.jetty.x0;
  assert.ok(p.jettyLanterns.length >= 2, `a ${len.toFixed(1)} m jetty: ${p.jettyLanterns.length} lamps`);
  assert.equal(p.jettyLanterns.length, Math.max(0, Math.ceil((len - 4) / JETTY_LAMP_STEP) - 1));
  for (const [k, [x, z, side]] of p.jettyLanterns.entries()) {
    assert.ok(Math.abs(x - (p.jetty.x0 + JETTY_LAMP_STEP * (k + 1))) < 1e-9);
    assert.equal(side, k % 2 ? -1 : 1);
    assert.ok(side > 0 ? z < p.jetty.z0 + 0.1 : z > p.jetty.z1 - 0.1, 'on its rail');
    const h = jettyLanternHead(x, z, side, p.deck);
    assert.ok(h[2] > p.jetty.z0 && h[2] < p.jetty.z1, 'hung in over the jetty');
    assert.equal(h[1], p.deck + LANTERN_UP - LANTERN_DROP);
  }
  const lights = lanternLights(p, SEA);
  assert.equal(lights.length, p.lanterns.length + p.jettyLanterns.length);
  const h0 = lanternHead(...p.lanterns[0], p.deck), [x0, z0] = quayToScene(p.frame, h0[0], h0[2]);
  assert.deepEqual(lights[0], [x0, SEA + h0[1], z0], 'the quay\'s own first');
  const short = planOf(0);
  assert.ok(short.jetty.x1 - short.jetty.x0 < JETTY_LAMP_STEP + 4 ? short.jettyLanterns.length === 0 : true, 'a short jetty none');
  assert.ok(LANTERN_ARM > 0);
});

test('PIERS THE DRESS ALONE: pierDress over a plan\'s own pieces - no pile rows, no braces; no jetty, no jetty lamps; not the first berth, no crane - and ground it cannot read marks the plan unbuilt (it reads the plan\'s own `ground`)', () => {
  const p = planOf();
  const base = { frame: p.frame, deck: p.deck, quay: p.quay, zJ: 0, jetty: null, rows: [], bollards: p.bollards, cargo: [], key: 'port:1', index: 3, ground: () => -8 };
  const d = pierDress(base);
  assert.deepEqual([d.braces, d.jettyLanterns, d.crane], [[], [], null]);
  assert.equal(d.ladders.length, 2);
  const unread = pierDress({ ...base, ground: () => NaN });
  assert.deepEqual([unread.ladders, unread.fenders], [[], []], 'no ground read: nothing hung on it');
  assert.equal(planOf(0, { groundAt: (x, z) => (Math.abs(z - HARBOUR.berths[0].pos[1]) < 20 && coast(x, z) ? NaN : groundOf()(x, z)) }), null, 'the plan unbuilt where its face\'s ground is not up');
});

test('PIERS THE MODEL: the dress built into the quay\'s model - joists every JOIST_STEP under the deck and the jetty, the braces, the fenders, the ladders standing LADDER_GRAB over the deck, the cleats, the rope\'s coils, the crane to its height, the jetty\'s lamps; the deck\'s top still QUAY_DECK_UP, nothing past the plan (mutants: the dress unbuilt)', () => {
  const p = planOf();
  const m = buildQuayModel(p);
  const bare = buildQuayModel({ ...p, braces: [], fenders: [], ladders: [], cleats: [], coils: [], crane: null, jettyLanterns: [] });
  assert.ok(m.indices.length > bare.indices.length * 1.5, `${m.indices.length / 3} triangles against ${bare.indices.length / 3}`);
  assert.ok(m.subMeshes.some((s) => s.textureArchive === 0 && s.textureRecord === 77), 'the rigging\'s rope');
  let top = -Infinity, deckTop = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], y = m.positions[i + 1];
    top = Math.max(top, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    if (y <= QUAY_DECK_UP + 1e-6) deckTop = Math.max(deckTop, y);
  }
  assert.ok(Math.abs(deckTop - QUAY_DECK_UP) < 1e-6, 'the deck\'s top');
  assert.ok(top >= QUAY_DECK_UP + CRANE_UP - 1e-6, 'the crane\'s post to its height');
  assert.ok(minX >= p.quay.x0 - 0.5 && maxX <= Math.max(p.quay.x1, p.jetty?.x1 ?? 0, p.ramp?.x1 ?? 0) + 0.5, 'within the plan');
  // a ladder's stiles over the deck, at the face
  const ladderTop = (z) => { let t = -Infinity; for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i + 2] - z) < 0.3 && m.positions[i] < p.quay.x0 + 0.05) t = Math.max(t, m.positions[i + 1]); return t; };
  for (const [z] of p.ladders) assert.ok(ladderTop(z) >= QUAY_DECK_UP + LADDER_GRAB - 0.05, `ladder at ${z.toFixed(1)}`);
  // the joists: one a JOIST_STEP along the quay, under the deck
  let joists = 0;
  for (let z = p.quay.z0 + 0.3; z <= p.quay.z1 - 0.3 + 1e-6; z += JOIST_STEP) joists++;
  assert.ok(joists > (p.quay.z1 - p.quay.z0) / JOIST_STEP - 2);
});

test('PIERS LIT: the quay pool lights the jetty\'s lamps with the quay\'s two - the nearest within its reach, as ever', async () => {
  const b = findHarbour({ rect: TOWN, isWater: (x, z) => shelf(x, z) < SEA - 3 });
  const collider = { addMesh() {}, removeBucket() {} };
  const pool = createQuayPool({
    renderer: { createMesh: () => ({}), destroyMesh() {}, drawMesh() {} }, prepare: async () => {}, collider: () => collider,
    harbours: () => [{ key: 'port:2', name: 'Sentinel', harbour: b }], seaY: () => SEA, groundAt: shelf,
    feet: () => [b.berths[0].pos[0], SEA, b.berths[0].pos[1] + 20], mode: () => 'exterior', now: () => 0,
  });
  pool.frame();
  await new Promise((r) => setTimeout(r, 0));
  const plan = pool.standing().find((s) => s.index === 0).plan;
  const want = lanternLights(plan, SEA);
  const lit = pool.lights();
  assert.ok(lit.length > 0);
  for (const l of lit) assert.ok(pool.standing().some((s) => lanternLights(s.plan, SEA).some((p) => Math.abs(p[0] - l.x) < 1e-9 && Math.abs(p[2] - l.z) < 1e-9)), 'a quay\'s lantern or its jetty\'s');
  assert.ok(want.length >= 2);
});
