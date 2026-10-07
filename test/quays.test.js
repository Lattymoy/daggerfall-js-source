// QUAYS (2026-10-03, Mac: "Completely revamp port towns with actual piers and docking ports. I want these places to feel
// alive and connected with the oceans of daggerfall, along with having them appear when sailing and close to a port") -
// the port's quays off a harbour's berths (systems/naval/quays.js), their model (world/quayModel.js), the pool that
// stands them (scenes/quayPool.js), the docking and the gangways (scenes/navalHost.js), Come Sail Away's warp seam and
// the world's wiring. bible/03-World/Holdings.md section 7.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  planQuay, quayFrame, quayToScene, sceneToQuay, dockFor, madeFast, warpStep, quaySide, landwardOf, lanternLights, lanternHead, keyHash,
  QUAY_GAP, QUAY_WIDTH, QUAY_DECK_UP, QUAY_ENDS, PILE_DEPTH, JETTY_MAX, JETTY_LAND, JETTY_WIDTH, STEP_M, RAMP_SLOPE, CARGO_MAX,
  DOCK_REACH_M, DOCK_ANGLE, FAST_M, FAST_DEG, WARP_SPEED, LANTERN_UP, LANTERN_ARM, DOCK_WAY, GANGWAY_SLOPE, GANGWAY_CLEAR, GANGWAY_BACK,
} from '../src/systems/naval/quays.js';
import { findHarbour, hullSize, berthSize, alongside, offsetHarbour, BERTH_HULL } from '../src/systems/naval/shipLife.js';
import { quatOfYaw } from '../src/systems/naval/navalAI.js';
import { setGalleonStanding, setShipStanding } from '../src/systems/naval/navalShips.js';   // GALLEON-HOLDINGS: the mod's galleon as wide as the Carrack
import { outOfDeck } from '../src/systems/naval/navalDeck.js';
import { buildQuayModel, buildGangwayModel } from '../src/world/quayModel.js';
const JETTY_STEP_T = 1;   // quays.js JETTY_STEP: the shore walked a metre at a time
import { createQuayPool, gangwayMatrix, QUAY_STAND_M, QUAY_LEAVE_M, QUAY_RETRY_S, QUAY_LIGHTS_MAX, QUAY_LIGHT_REACH, QUAY_BUCKET } from '../src/scenes/quayPool.js';
import { whereWords } from '../src/ui/fleetPage.js';
import { sea } from './navalSea.mjs';
import { scene } from './csaScene.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** The coast: land north of z = 200, and a headland x 300-400 reaching south to z = -300 (shiplife.test.js's). */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const SEA = 34;
/** The ground: the bed 8 m down under the water; ashore `land(x, z)` over the sea's top (a bank 3 m up by default). */
const groundOf = (land = () => 3) => (x, z) => (coast(x, z) ? SEA - 8 : SEA + land(x, z));
const DEG = Math.PI / 180;
const HARBOUR = findHarbour({ rect: TOWN, isWater: coast });
const plan0 = (o = {}) => planQuay({ berth: HARBOUR.berths[0], hull: HARBOUR.hull, key: 'port:1', index: 0, seaY: SEA, groundAt: groundOf(), ...o });

test('QUAYS THE QUAY ALONG HER BERTH: in the berth\'s frame (+x to the land, +z along the shore), its face her widest and QUAY_GAP off her, QUAY_WIDTH deep, QUAY_ENDS past her bow and her stern, its deck QUAY_DECK_UP over the sea\'s top on piles down to the bed (PILE_DEPTH at most) wherever the ground is under it; the plan unlaid (null) while any ground it reads is not built', () => {
  assert.ok(HARBOUR && HARBOUR.berths.length >= 3, 'the coast\'s harbour');
  // SHIPS-2: the berth's hull its template's (shipLife.js berthSize - the mod's Carrack: every berth, quay and footprint
  // as it stood; Mac's carrack lies in toward it as any narrower hull)
  const hw = berthSize(BERTH_HULL).halfWidth;
  for (const [i, b] of HARBOUR.berths.entries()) {
    const p = planQuay({ berth: b, hull: HARBOUR.hull, key: 'port:1', index: i, seaY: SEA, groundAt: groundOf() });
    assert.ok(p, `berth ${i} laid`);
    const f = quayFrame(b, HARBOUR.hull);
    const ax = quayToScene(f, 1, 0);
    assert.ok(Math.abs(ax[0] - b.pos[0] + b.normal[0]) < 1e-9 && Math.abs(ax[1] - b.pos[1] + b.normal[1]) < 1e-9, 'its +x the land\'s way, against the shore\'s normal');
    const back = sceneToQuay(f, ...quayToScene(f, 3.5, -7.25));
    assert.ok(Math.abs(back[0] - 3.5) < 1e-9 && Math.abs(back[1] + 7.25) < 1e-9, 'the frame and the scene, both ways');
    assert.equal(p.quay.x0, hw + QUAY_GAP, 'the face her widest and the gap off her');
    assert.equal(p.quay.x1, hw + QUAY_GAP + QUAY_WIDTH);
    const s = berthSize(BERTH_HULL);
    assert.ok(Math.abs((p.quay.z1 - p.quay.z0) - (s.length + 2 * QUAY_ENDS)) < 1e-9, 'past her bow and her stern');
    // her bow along the frame's +z or its -z - the quay covers her either way she lies
    const bow = quayToScene(f, 0, f.zSign * s.bowZ), bowFromBerth = [b.pos[0] + Math.sin(b.yaw) * s.bowZ, b.pos[1] + Math.cos(b.yaw) * s.bowZ];
    assert.ok(Math.hypot(bow[0] - bowFromBerth[0], bow[1] - bowFromBerth[1]) < 1e-6, 'her bow where the frame says');
    assert.equal(p.deck, QUAY_DECK_UP);
    assert.ok(p.piles.length >= 2 * 10, `piles along both edges (${p.piles.length})`);
    for (const [x, z, foot] of p.piles) {
      assert.ok(foot >= -PILE_DEPTH - 1e-9 && foot < QUAY_DECK_UP, 'down to the bed, PILE_DEPTH at most');
      const g = groundOf()(...quayToScene(f, x, z)) - SEA;
      assert.ok(g < QUAY_DECK_UP - 0.5, 'never where the ground stands at the deck');
    }
  }
  // the bed shallower than PILE_DEPTH: the piles stand on it
  const shoal = plan0({ groundAt: (x, z) => (coast(x, z) ? SEA - 2 : SEA + 3) });
  assert.ok(shoal.piles.filter((p) => p[0] < shoal.quay.x1).every(([, , foot]) => Math.abs(foot - (-2.3)) < 1e-9), 'on the bed, a hair into it');
  // not built: null, laid again later
  assert.equal(plan0({ groundAt: () => -Infinity }), null, 'no ground at all');
  assert.equal(plan0({ groundAt: (x, z) => (coast(x, z) ? SEA - 8 : NaN) }), null, 'the shore behind it not built');
});

test('QUAYS THE SHORE WALKED: from the quay\'s back to the land at her waist - a bank that meets the deck takes a jetty JETTY_LAND onto it; dry ground under the deck takes the jetty to it and a ramp down to the ground (never steeper than RAMP_SLOPE, ending on it); a bank at the quay\'s very back a jetty of JETTY_LAND alone; no land within JETTY_MAX none, the quay standing alone', () => {
  const b = HARBOUR.berths[0], f = quayFrame(b, HARBOUR.hull);
  const landAt = (p) => { for (let x = p.quay.x1; x < p.quay.x1 + 60; x += 0.25) { const [sx, sz] = quayToScene(f, x, (f.z0 + f.z1) / 2); if (!coast(sx, sz)) return x; } return Infinity; };
  // a bank level with the deck (2 m up)
  let p = plan0({ groundAt: groundOf(() => 2) });
  assert.ok(p.jetty && !p.ramp, 'a jetty, no ramp');
  const shore = landAt(p);
  assert.equal(p.jetty.x0, p.quay.x1, 'from the quay\'s back');
  assert.ok(p.jetty.x1 >= shore + JETTY_LAND - 1 - 1e-9 && p.jetty.x1 <= shore + JETTY_LAND + 1 + 1e-9, `onto the bank JETTY_LAND (${p.jetty.x1.toFixed(2)} vs shore ${shore.toFixed(2)})`);
  // AUDIT HOLDINGS Q9: a bank standing over the deck by more than two steps (3 m up: a wall) met at its face, never run
  // JETTY_LAND into it
  const wall = plan0();
  assert.ok(wall.jetty && wall.jetty.x1 >= shore - 1 - 1e-9 && wall.jetty.x1 <= shore + 1e-9 + JETTY_STEP_T, `met at its face (${wall.jetty.x1.toFixed(2)} vs shore ${shore.toFixed(2)})`);
  assert.ok(Math.abs(p.jetty.z1 - p.jetty.z0 - JETTY_WIDTH) < 1e-9 && Math.abs((p.jetty.z0 + p.jetty.z1) / 2 - (f.z0 + f.z1) / 2) < 1e-9, 'JETTY_WIDTH, at her waist');
  // a beach: dry, 0.4 m up and rising 5 cm a metre - under the deck
  const beach = (x, z) => 0.4 + Math.max(0, z - 200) * 0.05;
  p = plan0({ groundAt: groundOf(beach) });
  assert.ok(p.jetty && p.ramp, 'a jetty and a ramp');
  assert.equal(p.ramp.x0, p.jetty.x1, 'the ramp from the jetty\'s end');
  assert.equal(p.ramp.y0, QUAY_DECK_UP, 'from the deck');
  const [ex, ez] = quayToScene(f, p.ramp.x1, (p.ramp.z0 + p.ramp.z1) / 2);
  assert.ok(Math.abs(p.ramp.y1 - beach(ex, ez)) < 0.1, `ending on the ground (${p.ramp.y1.toFixed(2)} on ${beach(ex, ez).toFixed(2)})`);
  assert.ok((p.ramp.y0 - p.ramp.y1) / (p.ramp.x1 - p.ramp.x0) <= RAMP_SLOPE + 1e-9, 'never steeper than RAMP_SLOPE');
  // a bank at the quay's very back: the ground at the deck from its first step
  p = plan0({ groundAt: (x, z) => { const [lx] = sceneToQuay(f, x, z); return lx >= plan0().quay.x1 - 1e-6 ? SEA + QUAY_DECK_UP - STEP_M / 2 : SEA - 8; } });
  assert.ok(p.jetty && Math.abs(p.jetty.x1 - p.jetty.x0 - JETTY_LAND) < 1e-9 && !p.ramp, 'a jetty JETTY_LAND long, onto it');
  // no land within JETTY_MAX: the quay alone
  p = plan0({ groundAt: (x, z) => { const [lx] = sceneToQuay(f, x, z); return lx > plan0().quay.x1 + JETTY_MAX + 5 ? SEA + 3 : SEA - 8; } });
  assert.ok(p && p.jetty === null && p.ramp === null, 'no jetty to nowhere');
  // the jetty's piles over the water, none on the land - PIN MOVED (AUDIT HOLDINGS, the mutants' run): read over the bank
  // the jetty runs JETTY_LAND onto (2 m up); the 3 m one is met at its face now (Q9), and no jetty stood over its land
  p = plan0({ groundAt: groundOf(() => 2) });
  const jp = p.piles.filter(([x]) => x > p.quay.x1 + 0.1);
  assert.ok(p.jetty.x1 > shore + 1, 'the jetty over the land');
  for (const [x, z] of jp) assert.ok(groundOf(() => 2)(...quayToScene(f, x, z)) - SEA < QUAY_DECK_UP, 'over the water');
});

test('QUAYS WHAT STANDS ON IT: bollards on its face by her stern, her waist and her bow; a lantern post at each landward corner; the port\'s cargo on its back - crates (some two high) and barrels, off the harbour\'s key and the berth\'s number (QUAY_SALT), the same on every client - clear of the jetty\'s mouth, its ends and its face', () => {
  const p = plan0();
  assert.equal(p.bollards.length, 3);
  for (const [x] of p.bollards) assert.ok(Math.abs(x - p.quay.x0) < 0.6, 'on the face');
  assert.deepEqual(p.lanterns.map(([x, z]) => [x > p.quay.x1 - 1, z < p.quay.z0 + 1 || z > p.quay.z1 - 1]), [[true, true], [true, true]], 'at the landward corners');
  assert.ok(p.cargo.length >= 1 && p.cargo.length <= CARGO_MAX, `cargo: ${p.cargo.length}`);
  const zJ = (p.jetty.z0 + p.jetty.z1) / 2;
  for (const c of p.cargo) {
    assert.ok(c.x - c.s / 2 >= p.quay.x0 + 1.2 && c.x + c.s / 2 <= p.quay.x1 + 1e-9, `on its back, its face kept clear (${c.x.toFixed(2)})`);
    assert.ok(Math.abs(c.z - zJ) >= JETTY_WIDTH / 2 + 1, 'clear of the jetty\'s mouth');
    assert.ok(c.z > p.quay.z0 + 1.5 && c.z < p.quay.z1 - 1.5, 'clear of its ends');
    assert.ok(c.kind === 'crate' || c.kind === 'barrel');
  }
  // across the ports and their berths: never a piece in the jetty's mouth or on the face
  for (let k = 0; k < 24; k++) for (const i of [0, 1, 2]) {
    const q = planQuay({ berth: HARBOUR.berths[i], hull: HARBOUR.hull, key: `port:${k}`, index: i, seaY: SEA, groundAt: groundOf() });
    const mid = (q.jetty.z0 + q.jetty.z1) / 2;
    for (const c of q.cargo) assert.ok(Math.abs(c.z - mid) >= JETTY_WIDTH / 2 + 1 && c.x - c.s / 2 >= q.quay.x0 + 1.2, `port:${k} berth ${i}: clear of the jetty and the face`);
  }
  assert.deepEqual(plan0().cargo, p.cargo, 'the same quay, the same cargo');
  const others = [1, 2, 3, 4].map((i) => JSON.stringify(plan0({ index: i }).cargo)).concat(['port:2', 'port:3'].map((k) => JSON.stringify(plan0({ key: k }).cargo)));
  assert.ok(others.some((o) => o !== JSON.stringify(p.cargo)), 'another berth or port, another load');
  assert.equal(keyHash('port:1'), keyHash('port:1'));
  assert.notEqual(keyHash('port:1'), keyHash('port:2'));
  assert.deepEqual(lanternLights(p, SEA)[0], (() => { const h = lanternHead(...p.lanterns[0], p.deck); const [x, z] = quayToScene(p.frame, h[0], h[2]); return [x, SEA + h[1], z]; })(), 'the light at the lantern\'s glass');
  assert.ok(Math.abs(lanternLights(p, SEA)[0][1] - (SEA + QUAY_DECK_UP + LANTERN_UP - 0.35)) < 1e-9, 'under the post\'s head');
  const [llx, llz] = sceneToQuay(p.frame, lanternLights(p, SEA)[0][0], lanternLights(p, SEA)[0][2]);
  assert.ok(Math.abs(llx - (p.lanterns[0][0] - LANTERN_ARM)) < 1e-9 && Math.abs(llz - p.lanterns[0][1]) < 1e-9, 'hung out LANTERN_ARM from its post, toward the water');
});

test('QUAYS THE MODEL: the plan built in classic textures - the ship\'s own planking for the decks, its darker plank for the timbers, iron for the bollards and the lanterns\' frames, a lamp\'s lit glass - its deck\'s top at QUAY_DECK_UP, nothing past the plan; the gangway a metre long along +z', () => {
  const p = plan0();
  const m = buildQuayModel(p);
  assert.ok(m.indices.length / 3 > 200, `triangles: ${m.indices.length / 3}`);
  assert.deepEqual(new Set(m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`)), new Set(['67_0', '67_8', '0_79', '0_10']));
  let maxX = -Infinity, minX = Infinity, deckTop = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], y = m.positions[i + 1];
    maxX = Math.max(maxX, x); minX = Math.min(minX, x);
    if (y <= QUAY_DECK_UP + 1e-6) deckTop = Math.max(deckTop, y);
  }
  assert.ok(Math.abs(deckTop - QUAY_DECK_UP) < 1e-6, 'the deck\'s top at QUAY_DECK_UP');
  const corner = (x, z) => { for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i] - x) < 1e-4 && Math.abs(m.positions[i + 1] - QUAY_DECK_UP) < 1e-4 && Math.abs(m.positions[i + 2] - z) < 1e-4) return true; return false; };
  for (const [x, z] of [[p.quay.x0, p.quay.z0], [p.quay.x1, p.quay.z0], [p.quay.x0, p.quay.z1], [p.quay.x1, p.quay.z1]]) assert.ok(corner(x, z), `the deck to its corner (${x.toFixed(1)}, ${z.toFixed(1)})`);
  assert.ok(minX >= p.quay.x0 - 0.5 && maxX <= Math.max(p.quay.x1, p.jetty?.x1 ?? 0, p.ramp?.x1 ?? 0) + 0.5, 'within the plan');
  const beachy = buildQuayModel(plan0({ groundAt: groundOf((x, z) => 0.4 + Math.max(0, z - 200) * 0.05) }));
  assert.ok(beachy.indices.length > 0);
  const g = buildGangwayModel();
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < g.positions.length; i += 3) { z0 = Math.min(z0, g.positions[i + 2]); z1 = Math.max(z1, g.positions[i + 2]); }
  assert.ok(Math.abs(z0) < 1e-6 && Math.abs(z1 - 1) < 1e-6, 'a metre along +z');
  // the matrix lays it from the foot to the head, level across
  const tx = (mm, v) => [0, 1, 2].map((k) => mm[k] * v[0] + mm[4 + k] * v[1] + mm[8 + k] * v[2] + mm[12 + k]);
  for (const [foot, head] of [[[0, 0, 0], [3, 2, 1]], [[10, 5, -4], [7, 7, -8]], [[1, 1, 1], [1, 0, 5]]]) {
    const mm = gangwayMatrix(foot, head);
    tx(mm, [0, 0, 1]).forEach((v, k) => assert.ok(Math.abs(v - head[k]) < 1e-5, 'its end at the head'));
    assert.ok(Math.abs(tx(mm, [1, 0, 0])[1] - foot[1]) < 1e-6, 'level across');
  }
});

test('QUAYS ALONGSIDE: every hull lies with her side QUAY_GAP off the quay\'s face - the Carrack the berth sounds for at its point, a narrower hull in toward the quay by the difference, the galley out from it', () => {
  const b = HARBOUR.berths[0];
  const face = (BERTH_HULL === HARBOUR.hull ? berthSize(BERTH_HULL).halfWidth : 0) + QUAY_GAP;
  for (const hull of [0, 1, 2, 3, 4]) {
    const at = alongside(b, hull, HARBOUR.hull);
    const toFace = (b.pos[0] - b.normal[0] * face - at[0]) * -b.normal[0] + (b.pos[1] - b.normal[1] * face - at[1]) * -b.normal[1];
    assert.ok(Math.abs(toFace - (hullSize(hull).halfWidth + QUAY_GAP)) < 1e-9, `hull ${hull}: her side the gap off the face`);
  }
  // PIN MOVED (SHIPS-2, 2026-10-07): the berth sounded for the mod's Carrack (berthSize's template, 8.43 m a side) - it
  // lies at its point where it stands in; Mac's carrack, 6.7 m a side, 1.73 m in toward the quay from it
  const at4 = alongside(b, 4, HARBOUR.hull);
  assert.ok(Math.abs(Math.hypot(at4[0] - b.pos[0], at4[1] - b.pos[1]) - (berthSize(4).halfWidth - hullSize(4).halfWidth)) < 1e-9 && Math.abs(berthSize(4).halfWidth - hullSize(4).halfWidth - 1.73) < 1e-9, 'Mac\'s carrack 1.73 m in');
  setShipStanding(4, false);
  try { assert.deepEqual(alongside(b, 4, HARBOUR.hull), b.pos, 'the mod\'s Carrack at the berth\'s point'); } finally { setShipStanding(4, true); }
  // PIN MOVED (GALLEON-HOLDINGS): the Small Ship is Mac's galleon, 5.86 m a side to the Carrack's 8.43 - she lies 2.57 m in
  // toward the quay from the berth's point; the mod's galleon, as wide as the Carrack, lies at it where she stands in
  const at2 = alongside(b, 2);
  assert.ok(Math.abs(Math.hypot(at2[0] - b.pos[0], at2[1] - b.pos[1]) - 2.57) < 1e-9, 'Mac\'s galleon 2.57 m in');
  setGalleonStanding(false);
  try { assert.deepEqual(alongside(b, 2), b.pos, 'the mod\'s galleon as wide'); } finally { setGalleonStanding(true); }
  assert.deepEqual(alongside(b, 4, undefined), at4, 'a harbour with no hull is BERTH_HULL\'s');
});

test('QUAYS DOCKING\'S LAW: the berth her alongside place lies within DOCK_REACH_M of, her bow within DOCK_ANGLE of its line either way, the nearest, a taken one passed over; made fast within FAST_M and FAST_DEG; warped in at DOCK_EASE, never faster than WARP_SPEED, her heading brought round with her', () => {
  const [b0, b1] = HARBOUR.berths;
  const berths = [{ key: 'k', index: 0, berth: b0, hull: HARBOUR.hull, name: 'Sentinel' }, { key: 'k', index: 1, berth: b1, hull: HARBOUR.hull, name: 'Sentinel' }];
  const at0 = alongside(b0, 2, HARBOUR.hull);
  const near = (d, yawOff = 0) => ({ pos: [at0[0] + b0.normal[0] * d, 0, at0[1] + b0.normal[1] * d], yaw: b0.yaw + yawOff, hull: 2 });
  let d = dockFor(near(10, 10 * DEG), berths);
  assert.ok(d && d.index === 0 && Math.abs(d.d - 10) < 1e-9 && d.yaw === b0.yaw && d.name === 'Sentinel', 'in reach, along it');
  assert.equal(dockFor(near(DOCK_REACH_M + 0.5), berths), null, 'past DOCK_REACH_M');
  assert.equal(dockFor(near(5, (DOCK_ANGLE + 2) * DEG), berths), null, 'her bow across it');
  d = dockFor(near(5, Math.PI - 5 * DEG), berths);
  assert.ok(d && Math.abs(Math.abs(((d.yaw - b0.yaw) % (2 * Math.PI)) + 0) - Math.PI) < 1e-9, 'lying the other way: the berth\'s line turned round');
  assert.equal(dockFor(near(5), [{ ...berths[0], free: false }]), null, 'another lies at it');
  assert.equal(dockFor(near(5), [{ ...berths[1] }, { ...berths[0] }]).index, 0, 'the nearest');
  // a Large Boat: her own alongside place, in toward the quay
  const at1 = alongside(b0, 1, HARBOUR.hull);
  const lb = dockFor({ pos: [at1[0] + b0.normal[0] * 4, 0, at1[1] + b0.normal[1] * 4], yaw: b0.yaw, hull: 1 }, berths);
  assert.ok(lb && Math.abs(lb.pos[0] - at1[0]) < 1e-9 && Math.abs(lb.pos[1] - at1[1]) < 1e-9 && Math.abs(lb.d - 4) < 1e-9, 'her own alongside place');
  assert.ok(madeFast(near(0.5, 2 * DEG), dockFor(near(0.5, 2 * DEG), berths)), 'made fast');
  assert.ok(!madeFast(near(FAST_M + 0.2), dockFor(near(FAST_M + 0.2), berths)), 'not yet - too far');
  assert.ok(!madeFast(near(0.5, (FAST_DEG + 1) * DEG), dockFor(near(0.5, (FAST_DEG + 1) * DEG), berths)), 'not yet - across it');
  assert.ok(!madeFast(near(0), null));
  // warped in from 20 m and 25 degrees off: never faster than WARP_SPEED, made fast within half a minute
  let s = near(20, 25 * DEG), pos = [s.pos[0], s.pos[2]], yaw = s.yaw, fastAt = null;
  const dock = dockFor(s, berths);
  for (let t = 0; t < 40; t += 0.1) {
    const n = warpStep(pos, yaw, dock, 0.1);
    assert.ok(Math.hypot(n.pos[0] - pos[0], n.pos[1] - pos[1]) <= WARP_SPEED * 0.1 + 1e-9, 'never faster than WARP_SPEED');
    pos = n.pos; yaw = n.yaw;
    const live = dockFor({ pos: [pos[0], 0, pos[1]], yaw, hull: 2 }, berths);
    if (fastAt == null && madeFast({ pos: [pos[0], 0, pos[1]], yaw }, live)) fastAt = t;
  }
  assert.ok(fastAt != null && fastAt > 20 / WARP_SPEED * 0.8 && fastAt < 30, `made fast at ${fastAt?.toFixed(1)} s`);
  assert.ok(Math.hypot(pos[0] - at0[0], pos[1] - at0[1]) < 0.05 && Math.abs(yaw - b0.yaw) < 0.01, 'home on her berth');
  assert.deepEqual(warpStep([1, 2], 0.3, dock, 0), { pos: [1, 2], yaw: 0.3 }, 'no time, no move');
  // which side lies to the quay
  assert.equal(quaySide(b0.yaw, landwardOf(b0)) * quaySide(b0.yaw + Math.PI, landwardOf(b0)), -1, 'turned round, her other side');
  const side = quaySide(b0.yaw, landwardOf(b0));
  const star = [Math.cos(b0.yaw), -Math.sin(b0.yaw)];
  assert.ok((star[0] * landwardOf(b0)[0] + star[1] * landwardOf(b0)[1]) * side > 0, 'the side facing the land');
  assert.ok(DOCK_WAY > 0);
});

/** A stand-in renderer and collider for the pool, and a clock. */
function poolWorld(o = {}) {
  const log = { made: [], destroyed: [], drawn: [], buckets: new Map(), removed: [] };
  const w = { feet: o.feet ?? [0, SEA, 150], mode: 'exterior', now: 0, harbours: o.harbours ?? [{ key: 'port:1', name: 'Sentinel', harbour: HARBOUR }], ground: o.ground ?? groundOf(), gangways: [] };
  const renderer = { createMesh: (m) => { const g = { m, id: log.made.length }; log.made.push(g); return g; }, destroyMesh: (g) => log.destroyed.push(g), drawMesh: (g, mm) => log.drawn.push([g, mm]) };
  const collider = { addMesh: (key, pos, idx, m, t) => log.buckets.set(key, { pos, idx, m, t }), removeBucket: (key) => { log.removed.push(key); log.buckets.delete(key); } };
  const pool = createQuayPool({
    renderer, prepare: async () => {}, collider: () => collider, harbours: () => w.harbours, seaY: () => SEA, groundAt: (x, z) => w.ground(x, z),
    feet: () => w.feet, mode: () => w.mode, gangways: () => w.gangways, now: () => w.now,
  });
  return { pool, log, w, renderer };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('QUAYS THE POOL: a harbour the naval host knows stands its quays while its mouth is within QUAY_STAND_M - a mesh and a collider bucket a berth, drawn at the berth\'s place on the sea\'s top - the bucket riding the berth as the world moves; past QUAY_LEAVE_M, forgotten, found again or indoors they come down; a berth on ground not built is laid again QUAY_RETRY_S later', async () => {
  const { pool, log, w } = poolWorld();
  pool.frame(); await settle();
  const n = HARBOUR.berths.length;
  assert.equal(log.made.length, n, 'a mesh a berth');
  assert.equal(log.buckets.size, n, 'a bucket a berth');
  for (let i = 0; i < n; i++) assert.ok(log.buckets.has(`${QUAY_BUCKET}port:1:${i}`));
  assert.equal(pool.standing().length, n);
  pool.frame(); await settle();
  assert.equal(log.made.length, n, 'stood once');
  log.drawn.length = 0;
  assert.equal(pool.draw(), n, 'drawn');
  const b0 = HARBOUR.berths[0], m0 = log.drawn[0][1];
  assert.ok(Math.abs(m0[12] - b0.pos[0]) < 1e-4 && Math.abs(m0[13] - SEA) < 1e-4 && Math.abs(m0[14] - b0.pos[1]) < 1e-4, 'at the berth, on the sea\'s top');
  const xAxis = [m0[0], m0[2]];
  assert.ok(Math.abs(xAxis[0] + b0.normal[0]) < 1e-5 && Math.abs(xAxis[1] + b0.normal[1]) < 1e-5, 'its +x to the land');
  // the bucket: a still one (AUDIT HOLDINGS Q7 - a mover's is never filed in the broadphase), baked where the berth lies
  // on the sea's top, the drawn matrix's own; a recentre stands it again where the berth lies now (offsetAll)
  let bk = log.buckets.get(`${QUAY_BUCKET}port:1:0`);
  assert.equal(bk.t, undefined, 'no translation: a still bucket');
  assert.deepEqual([...bk.m].map((v) => +v.toFixed(4)), [...m0].map((v) => +v.toFixed(4)), 'baked as it is drawn');
  const was = [...b0.pos];
  offsetHarbour(HARBOUR, [100, 0, -50]);
  pool.offsetAll();
  bk = log.buckets.get(`${QUAY_BUCKET}port:1:0`);
  assert.deepEqual([bk.m[12], bk.m[13], bk.m[14]].map((v) => +v.toFixed(4)), [was[0] + 100, SEA, was[1] - 50].map((v) => +v.toFixed(4)), 'stood again with the berth');
  assert.equal(log.buckets.size, n, 'each stood once');
  offsetHarbour(HARBOUR, [-100, 0, 50]);
  pool.offsetAll();
  assert.equal(pool.laid('port:1', 0), true, 'laid: the gangway may run onto it');
  assert.equal(pool.laid('port:1', 99), false);
  // past QUAY_LEAVE_M: down
  w.feet = [HARBOUR.mouth[0] + QUAY_LEAVE_M + 10, SEA, HARBOUR.mouth[1]];
  pool.frame();
  assert.equal(log.buckets.size, 0, 'the buckets gone');
  assert.equal(log.destroyed.length, n, 'the meshes freed');
  assert.equal(pool.standing().length, 0);
  // between: nothing new stood past QUAY_STAND_M
  w.feet = [HARBOUR.mouth[0] + (QUAY_STAND_M + QUAY_LEAVE_M) / 2, SEA, HARBOUR.mouth[1]];
  pool.frame(); await settle();
  assert.equal(log.made.length, n, 'nothing stood past QUAY_STAND_M');
  // back in: stood again; the harbour found again (a new frame): down and stood afresh; indoors: down
  w.feet = [0, SEA, 150];
  pool.frame(); await settle();
  assert.equal(log.buckets.size, n);
  const again = findHarbour({ rect: TOWN, isWater: coast });
  w.harbours = [{ key: 'port:1', name: 'Sentinel', harbour: again }];
  pool.frame(); await settle();
  assert.equal(log.made.length, 3 * n, 'stood afresh off the harbour found again');
  w.mode = 'interior';
  pool.frame();
  assert.equal(log.buckets.size, 0, 'indoors: none');
  w.mode = 'exterior';
  w.harbours = [];
  pool.frame(); await settle();
  assert.equal(log.buckets.size, 0, 'a harbour forgotten stands nothing');
});

test('QUAYS THE POOL WAITS FOR THE GROUND: a berth whose shore is not built yet is laid QUAY_RETRY_S later; its lanterns lit - the nearest QUAY_LIGHTS_MAX within QUAY_LIGHT_REACH; the gangways drawn where the host runs them out', async () => {
  let built = false;
  const { pool, log, w } = poolWorld({ ground: (x, z) => (built || coast(x, z) ? groundOf()(x, z) : -Infinity) });
  pool.frame(); await settle();
  assert.equal(log.made.length, 0, 'nothing laid on unbuilt ground');
  built = true;
  w.now = QUAY_RETRY_S - 0.1; pool.frame(); await settle();
  assert.equal(log.made.length, 0, 'not before QUAY_RETRY_S');
  w.now = QUAY_RETRY_S + 0.1; pool.frame(); await settle();
  assert.equal(log.made.length, HARBOUR.berths.length, 'laid once the ground is up');
  const lights = pool.lights();
  assert.ok(lights.length > 0 && lights.length <= QUAY_LIGHTS_MAX, `lights: ${lights.length}`);
  const ds = lights.map((l) => Math.hypot(l.x - w.feet[0], l.y - w.feet[1], l.z - w.feet[2]));
  assert.ok(ds.every((d, i) => d <= QUAY_LIGHT_REACH && (i === 0 || d >= ds[i - 1])), 'the nearest, within reach');
  w.feet = [5000, SEA, 5000];
  assert.deepEqual(pool.lights(), [], 'none far off');
  w.feet = [0, SEA, 150];
  w.gangways = [{ foot: [0, SEA + QUAY_DECK_UP, 190], head: [0, SEA + 4.5, 186] }];
  log.drawn.length = 0;
  pool.draw(); await settle();
  log.drawn.length = 0;
  assert.equal(pool.draw(), HARBOUR.berths.length + 1, 'the quays and the gangway');
  assert.deepEqual([...log.drawn[log.drawn.length - 1][1]], [...gangwayMatrix(w.gangways[0].foot, w.gangways[0].head)]);
  pool.destroyAll();
  assert.equal(log.buckets.size, 0);
});

/** The real naval host over the coast, my Small Ship at the helm, the port near. */
async function dockSea(o = {}) {
  const h = await sea({ hull: o.hull ?? 2, water: coast, settings: { ShipsAtSea: o.ships ?? 'off' } });
  h.log.docked = [];
  h.deps.harbourNear = () => ({ key: 'port:1', name: 'Sentinel', rect: TOWN });
  h.deps.dockedPort = (b, port) => h.log.docked.push([b.uid, port]);
  h.deps.shipName = () => 'Sea Witch';
  h.boat.GameObject.position = [5000, 0, 5000];
  h.view.feet = [5000, 0, 5000];   // past HARBOUR_STAND: the port's own roll not stood (a test that wants it comes ashore)
  h.run(0.2);
  const hb = h.host.harbourList();
  assert.equal(hb.length, 1, 'the harbour found');
  return { ...h, harbour: hb[0].harbour };
}
/** Lay my boat `d` m off berth `i`'s alongside place, turned `off` from its line. */
function layOff(h, i, d, off = 0) {
  const b = h.harbour.berths[i], at = alongside(b, h.boat.hull, h.harbour.hull);
  h.boat.GameObject.position = [at[0] + b.normal[0] * d, 0, at[1] + b.normal[1] * d];
  h.boat.GameObject.rotation = quatOfYaw(b.yaw + off);
  return b;
}
/** Come Sail Away's half of the warp: the host's step laid on her. */
function warpFor(h, seconds, flags = {}) {
  let last = null;
  for (let t = 0; t < seconds; t += 0.1) {
    last = h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1, ...flags });
    if (!last) return null;
    h.boat.GameObject.position = [last.pos[0], h.boat.GameObject.position[1], last.pos[1]];
    h.boat.GameObject.rotation = last.rotation;
  }
  return last;
}

test('QUAYS THE HELM DOCKS, by the real host: a summoned ship\'s berth alongside its quay for her hull; my ship at the helm, her sails struck and no oar pulling, slow, by a free berth and along it - her hands warp her in (said once), made fast (said once), the Fleet told the port she lies at; under sail, at the oars, too fast, past reach or across the berth\'s line she is left to her helm; a berth a sea ship lies at is none, and one only coming in to it is put off it', async () => {
  const h = await dockSea();
  // a summoned ship's berth (the Fleet's Summon): alongside its quay for her own hull - a Large Boat in toward the quay
  // by the beams' difference from where a Carrack lies
  const fb = h.host.freeBerth(1), fb4 = h.host.freeBerth(4);
  assert.ok(fb && fb4, 'a free berth');
  assert.ok(Math.abs(Math.hypot(fb.position[0] - fb4.position[0], fb.position[2] - fb4.position[2]) - (hullSize(4).halfWidth - hullSize(1).halfWidth)) < 1e-6, 'in toward the quay');
  const b = layOff(h, 0, 15, 15 * DEG);
  assert.equal(h.host.warp(h.boat, { struck: false, oars: false, dt: 0.1 }), null, 'under sail');
  assert.equal(h.host.warp(h.boat, { struck: true, oars: true, dt: 0.1 }), null, 'at the oars');
  h.runtime.state.velocityCurrent = [0, 0, DOCK_WAY + 0.5];
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'too fast');
  h.runtime.state.velocityCurrent = [0, 0, 0];
  const w = h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
  assert.ok(w && w.pos.length === 2 && w.rotation.length === 4, 'a step and a turn');
  assert.equal(h.log.say.filter((s) => /warp her in alongside Sentinel's quay/.test(s)).length, 1, 'said as she is taken in');
  assert.equal(h.host.dockedAt(h.boat), null, 'not yet made fast');
  warpFor(h, 30);
  assert.equal(h.log.say.filter((s) => /warp her in/.test(s)).length, 1, 'said once');
  assert.equal(h.log.say.filter((s) => s === "Made fast at Sentinel's quay.").length, 1, 'made fast, said once');
  const at = alongside(b, h.boat.hull, h.harbour.hull);
  assert.ok(Math.hypot(h.boat.GameObject.position[0] - at[0], h.boat.GameObject.position[2] - at[1]) < 0.05, 'alongside');
  assert.equal(h.host.dockedAt(h.boat), 'Sentinel');
  h.run(1.2);
  assert.deepEqual(h.log.docked.at(-1), [42, 'Sentinel'], 'the Fleet told where she lies');
  // cast off: under way again, she lies made fast nowhere
  h.boat.GameObject.position = [at[0] + b.normal[0] * 40, 0, at[1] + b.normal[1] * 40];
  assert.equal(h.host.dockedAt(h.boat), null);
  h.run(1.2);
  assert.deepEqual(h.log.docked.at(-1), [42, null], 'and the Fleet told she sailed');
  // past reach, across the line
  layOff(h, 0, DOCK_REACH_M + 3);
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'past reach');
  layOff(h, 0, 10, (DOCK_ANGLE + 5) * DEG);
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'across its line');
});

test('QUAYS A BERTH TAKEN AND A BERTH PUT OFF, by the real host: a ship of the sea moored at a berth leaves it none to dock at; one only coming in to it is sent to another free berth as my ship is warped in, and made fast there', async () => {
  const h = await dockSea({ ships: 'few' });
  // the port's roll: moored ships at some berths
  h.view.feet = [0, 0, 150];
  h.runtime.sailing = false;
  h.run(1);
  const moored = [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  assert.ok(moored.length >= 1, 'the port\'s own moored');
  const taken = moored[0].ship.errand.berth;
  h.runtime.sailing = true;
  layOff(h, taken, 8);
  const w = h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
  const toTaken = w && Math.hypot(w.pos[0] - alongside(h.harbour.berths[taken], 2, h.harbour.hull)[0], w.pos[1] - alongside(h.harbour.berths[taken], 2, h.harbour.hull)[1]) < 8;
  assert.ok(!toTaken, 'never warped in to a berth a ship lies at');
  // a ship coming in to the berth I dock at: put off it
  const free = h.harbour.berths.findIndex((_, i) => ![...h.host._sea.values()].some((e) => e.ship.errand?.berth === i));
  assert.ok(free >= 0, 'a free berth');
  // moored at it on her errand, though a fight has her off it: hers still
  const away = moored[0];
  const wasErrand = away.ship.errand, wasPos = [...away.ship.pos];
  away.ship.errand = { kind: 'moored', harbour: 'port:1', berth: free, until: Infinity, path: null, i: 0 };
  away.ship.pos = [wasPos[0] + 600, wasPos[1], wasPos[2]];
  layOff(h, free, 10);
  const held = h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
  const atFree = alongside(h.harbour.berths[free], 2, h.harbour.hull);
  assert.ok(!held || Math.hypot(held.pos[0] - atFree[0], held.pos[1] - atFree[1]) >= 9.5, 'a berth a ship is moored to is hers');
  away.ship.errand = wasErrand; away.ship.pos = wasPos;
  const comer = moored[0];
  comer.ship.errand = { kind: 'arrive', harbour: 'port:1', berth: free, path: null, i: 0 };
  layOff(h, free, 10);
  assert.ok(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), 'warped in');
  assert.ok(comer.ship.errand == null || comer.ship.errand.berth !== free, 'the comer put off it');
  warpFor(h, 30);
  assert.equal(h.host.dockedAt(h.boat), 'Sentinel', 'made fast at it');
});

test('QUAYS A SHIP SAILING BY TAKES NO BERTH, by the real host: the port\'s roll stands its own ship at a berth my ship passes over under way; lying still there, none (the gangway\'s test)', async () => {
  const h = await dockSea();
  layOff(h, 0, 0);
  h.runtime.state.velocityCurrent = [0, 0, 5];   // under way across it
  h.view.feet = [0, 0, 150];
  h.run(1);
  const at0 = [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored' && e.ship.errand.berth === 0);
  assert.equal(at0.length, 1, 'the berth still the port\'s');
  // AUDIT HOLDINGS (the mutants' run): lying still there - placed, never warped in (the warp's own berth is taken by the
  // warp, Q5) - the roll moors none into her
  const h2 = await dockSea();
  layOff(h2, 0, 0);
  h2.runtime.sailing = false;
  h2.view.feet = [0, 0, 150];
  h2.run(1);
  const rolled = [...h2.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  assert.ok(rolled.length >= 1, 'the roll stood');
  assert.ok(rolled.every((e) => e.ship.errand.berth !== 0), 'none moored into her');
});

test('QUAYS THE GANGWAY, by the real host: run out square to her side at her waist while she lies made fast - from her main deck\'s port down to the quay\'s deck, in from its face as far as a climb of GANGWAY_SLOPE asks (AUDIT HOLDINGS Q1); on foot at its foot, looking at her, Activate goes aboard (said); on her deck by its head, looking at the land, Activate steps ashore onto the quay, facing the land (said); the press is the sea\'s (takesActivate) - and none while she is under way', async () => {
  const h = await dockSea();
  layOff(h, 0, 6, 5 * DEG);
  warpFor(h, 30);
  assert.equal(h.host.dockedAt(h.boat), 'Sentinel');
  h.runtime.sailing = false;   // off the helm
  const ways = h.host.gangways();
  assert.equal(ways.length, 1, 'one gangway');
  const g = ways[0];
  assert.ok(Math.abs(g.foot[1] - QUAY_DECK_UP) < 1e-9, 'its foot on the quay\'s deck');
  const b = h.harbour.berths[0], f = quayFrame(b, h.harbour.hull);
  // PIN MOVED (AUDIT HOLDINGS Q1): its foot was on the quay's face, the plank climbing 2 m into her side under her deck
  const [fx, fz] = sceneToQuay(f, g.foot[0], g.foot[2]);
  const [hx, hz] = sceneToQuay(f, g.head[0], g.head[2]);
  assert.ok(hx < fx && hx > 0, 'its head on her side toward the quay');
  assert.ok(Math.abs(hz - fz) < 1e-9, 'square to her');
  // PIN MOVED (GALLEON-HOLDINGS): her head stands too high for GANGWAY_SLOPE on the quay (Mac's galleon's main deck, 6.2 m
  // up: 8.8 m of run on a 4.5 m quay) - it stops GANGWAY_BACK short of its back, steeper
  const back = f.halfWidth + QUAY_GAP + QUAY_WIDTH - GANGWAY_BACK;
  assert.ok(Math.abs(fx - back) < 1e-9 && Math.atan2(g.head[1] - g.foot[1], fx - hx) / DEG > GANGWAY_SLOPE, 'up from GANGWAY_BACK, steeper than GANGWAY_SLOPE');
  assert.ok(fx > f.halfWidth + QUAY_GAP + GANGWAY_CLEAR - 1e-9 && fx < f.halfWidth + QUAY_GAP + QUAY_WIDTH - GANGWAY_BACK + 1e-9, 'in on the quay\'s deck');
  const toShip = [-g.landward[0], 0, -g.landward[1]];
  // on the quay at its foot, looking at her
  h.view.feet = [...g.foot];
  h.view.look = { origin: [g.foot[0], g.foot[1] + 1.6, g.foot[2]], dir: toShip };
  assert.equal(h.host.takesActivate(), true, 'the sea takes the press');
  assert.equal(h.host.activate(), true);
  const [aboardAt, aboardYaw] = h.log.placed.at(-1);
  assert.deepEqual(aboardAt, g.deckAt, 'over her rail onto her deck');
  assert.ok(Math.abs(aboardYaw - Math.atan2(toShip[0], toShip[2])) < 1e-9, 'facing inboard');
  assert.ok(h.log.say.includes('You go aboard the Sea Witch.'));
  // looking away along the quay: not the gangway's
  h.view.look = { origin: h.view.look.origin, dir: [g.landward[0], 0, g.landward[1]] };
  assert.equal(h.host.takesActivate(), false, 'looking away');
  // on her deck by its head, looking at the land
  h.view.feet = [...g.deckAt];
  h.view.look = { origin: [g.deckAt[0], g.deckAt[1] + 1.6, g.deckAt[2]], dir: [g.landward[0], 0, g.landward[1]] };
  assert.equal(h.host.takesActivate(), true);
  assert.equal(h.host.activate(), true);
  const [ashoreAt, ashoreYaw] = h.log.placed.at(-1);
  const [ax] = sceneToQuay(f, ashoreAt[0], ashoreAt[2]);
  assert.ok(ax > f.halfWidth + QUAY_GAP && ax < f.halfWidth + QUAY_GAP + QUAY_WIDTH && Math.abs(ashoreAt[1] - QUAY_DECK_UP) < 1e-9, 'onto the quay');
  assert.ok(ax > fx, 'past its foot - never under the plank');
  assert.ok(Math.abs(ashoreYaw - Math.atan2(g.landward[0], g.landward[1])) < 1e-9, 'facing the land');
  assert.ok(h.log.say.includes("You step ashore at Sentinel's quay."));
  // on her deck far from it (her forecastle), looking at the land: not the gangway's
  const deck = h.pool.deckOf(2, 0);
  const fore = outOfDeck(h.boat.MeshObject.worldMatrix(), deck.nearest(0, 14));
  h.view.feet = [...fore];
  h.view.look = { origin: [fore[0], fore[1] + 1.6, fore[2]], dir: [g.landward[0], 0, g.landward[1]] };
  assert.ok(Math.hypot(fore[0] - g.head[0], fore[2] - g.head[2]) > 8, 'far from its head');
  assert.equal(h.host.takesActivate(), false, 'never from anywhere aboard');
  // the word, once a coming to it
  h.view.feet = [...g.foot];
  h.view.look = { origin: [g.foot[0], g.foot[1] + 1.6, g.foot[2]], dir: toShip };
  h.log.say.length = 0;
  h.run(0.5);
  assert.equal(h.log.say.filter((s) => /The gangway to the Sea Witch - Activate to go aboard/.test(s)).length, 1, 'said once');
  // ashore by the harbour now: the port's roll stands its ships, none at the berth she lies made fast at
  const rolled = [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  assert.ok(rolled.length >= 1, 'the roll stood');
  assert.ok(rolled.every((e) => e.ship.errand.berth !== 0), 'none moored into her');
  // under way again: no gangway
  h.boat.GameObject.position = [h.boat.GameObject.position[0] + b.normal[0] * 30, 0, h.boat.GameObject.position[2] + b.normal[1] * 30];
  assert.equal(h.host.gangways().length, 0, 'none for a ship under way');
  assert.equal(h.host.takesActivate(), false);
});

test('QUAYS COME SAIL AWAY\'S WARP SEAM, by the real runtime: each sailing step asks the host with her sails and her oars - her sails struck and no oar, the host\'s step laid on her, her way and her swing taken off; the oars pulling, the host told so; none answered, her helm her own', () => {
  const { rt, held, frame, place, helm, deps } = scene();
  const boat = helm(place(1, 0, [100, 34, 200], [0, 0, 1]));
  const asked = [];
  deps.warp = (b, s) => { asked.push({ b, ...s }); return { pos: [101, 203], rotation: quatOfYaw(0.2) }; };
  frame();
  assert.ok(asked.length >= 1 && asked[0].b === boat && asked[0].struck === true && asked[0].oars === false && asked[0].dt === 0.25, 'asked with her sails and her oars');
  assert.deepEqual([boat.GameObject.position[0], boat.GameObject.position[2]].map((v) => Math.round(v * 1000) / 1000), [101, 203], 'laid where the host says');
  const fwd = [2 * (boat.GameObject.rotation[0] * boat.GameObject.rotation[2] + boat.GameObject.rotation[3] * boat.GameObject.rotation[1]), 0];
  assert.ok(Math.abs(fwd[0] - Math.sin(0.2)) < 1e-3, 'turned as the host says');
  // at the oars, none answered: her helm her own - her way and her swing come on
  held.add('MoveForwards'); held.add('MoveRight');
  asked.length = 0;
  deps.warp = (b, s) => { asked.push(s); return null; };
  const z = boat.GameObject.position[2];
  for (let k = 0; k < 12; k++) frame();
  assert.ok(asked.some((s) => s.oars === true), 'the oars pulling, said');
  assert.ok(Math.hypot(boat.GameObject.position[0] - 101, boat.GameObject.position[2] - z) > 0.1, 'none answered: her helm her own');
  assert.ok(Math.hypot(...rt.state.MoveVectorCurrent) > 0 && rt.state.TurnCurrent !== 0, 'her way and her swing on');
  // the host answers: her way and her swing taken off
  deps.warp = () => ({ pos: [101, 203], rotation: quatOfYaw(0.2) });
  frame();
  assert.deepEqual(rt.state.MoveVectorCurrent, [0, 0, 0], 'her way off');
  assert.deepEqual(rt.state.velocityCurrent, [0, 0, 0], 'none carried');
  assert.equal(rt.state.TurnCurrent, 0, 'her swing off');
});

test('QUAYS THE FLEET\'S WORD: a ship shown made fast at a port\'s quay reads so, how far; afar, the last port the Fleet heard of her; one lying anywhere else is afloat', () => {
  assert.deepEqual(whereWords({ where: 'here', metres: 40, docked: 'Sentinel' }), { state: 'Made fast', tone: '', line: "Made fast at Sentinel's quay, 40 m away." });
  assert.deepEqual(whereWords({ where: 'here', metres: 40, docked: '' }), { state: 'Made fast', tone: '', line: 'Made fast at a quay, 40 m away.' });
  assert.deepEqual(whereWords({ where: 'here', metres: 40, docked: null }), { state: 'Afloat', tone: '', line: 'Lying 40 m away.' });
  assert.deepEqual(whereWords({ where: 'away', metres: 3277, way: 'north', docked: 'Wayrest' }), { state: 'Made fast', tone: 'is-away', line: "Made fast at Wayrest's quay, 3.3 km away to the north." });
  assert.deepEqual(whereWords({ where: 'away', metres: null, docked: 'Wayrest' }), { state: 'Made fast', tone: 'is-away', line: "Made fast at Wayrest's quay." });
  assert.equal(whereWords({ where: 'away', metres: null, docked: null }).state, 'Afloat');
  const src = read('src/scenes/fleetHost.js');
  assert.match(src, /docked: at\.where === 'here' \|\| at\.where === 'sailing' \? n0\(\)\?\.dockedAt\?\.\(at\.boat\) \?\? null : at\.where === 'away' \? rec\.port\?\.name \?\? null : null,/);
  assert.match(src, /const berth = n\?\.freeBerth\?\.\(rec\.hull\) \?\? null;/);
});

test('QUAYS THE WORLD\'S WIRING: the pool made beside the farms over the world\'s harbours (HARBOUR-BOOK - whatever runs on the water) and the naval host\'s gangways, the sea\'s top and the ground; stood each frame before the lights, drawn in the world pass, its lanterns in the lanterns\' hours, down with a re-anchor and a load; Come Sail Away handed the warp, the naval host the Fleet\'s word and her name - THE FOUR HOSTS: a building\'s and a dungeon\'s frames have no sea, the standalone street no naval host', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /quays = createQuayPool\(\{\n    renderer,\n    prepare: async \(model\) => \{ for \(const sm of model\.subMeshes\) \{ await getTexture\(sm\.textureArchive\); uploadRecord\(sm\.textureArchive, sm\.textureRecord, \{ opaque: true \}\); \} \},\n    collider: \(\) => collider,\n    harbours: \(\) => harbourBook\.list\(\),   \/\/ HARBOUR-BOOK: whatever runs on the water - a port's quays are its town's\n    seaY: \(\) => tvSeaY\(\),/);
  // AUDIT HOLDINGS Q6: a full-detail pixel's ground alone
  assert.match(w, /groundAt: \(x, z\) => \{ const p = csaPixelAt\(x, z\); return p && \(p\._stride \?\? 1\) === 1 \? surfaceAt\(x, z\) : NaN; \},/);
  assert.match(w, /quays\?\.offsetAll\(\);/);
  assert.match(w, /quayLaid: \(key, index\) => quays\?\.laid\(key, index\) \?\? true,/);
  assert.match(w, /gangways: \(\) => \(navalOn\(\) \? naval\?\.gangways\?\.\(\) \?\? \[\] : \[\]\),/);
  const frameAt = w.indexOf('try { quays?.frame(); }'), lightsAt = w.indexOf('if (lightsOnAt(minute)) {'), drawAt = w.indexOf('quays?.draw(renderer);');
  assert.ok(frameAt > 0 && frameAt < lightsAt && lightsAt < drawAt, 'stood before the lights, drawn in the world pass');
  // AUDIT HOLDINGS Q3: scene lights in the boats' selection, in the lanterns' hours alone - never the player's extras
  assert.match(w, /if \(lightsOnAt\(minute\)\) for \(const l of quays\?\.lights\(\) \?\? \[\]\) csaLit\.push\(\{ x: l\.x, y: l\.y, z: l\.z, range: l\.range, color: CITY_LIGHT_COLOR_F32 \}\);/);
  assert.ok(w.indexOf('csaLit.push(') < lightsAt, 'into the selection before it is made');
  assert.equal((w.match(/quays\?\.lights\(\)/g) ?? []).length, 1, 'nowhere else - not the extras');
  assert.equal((w.match(/quays\?\.destroyAll\(\);/g) ?? []).length, 2, 'down with a re-anchor and a load');
  assert.match(w, /warp: \(boat, s\) => naval\?\.warp\?\.\(boat, s\) \?\? null,/);
  assert.match(w, /dockedPort: \(boat, port\) => \{ const r = boat\?\.uid \? fleetShip\(boat\.uid\) : null; if \(r && \(r\.port\?\.name \?\? null\) !== port\) setShipPort\(boat\.uid, port == null \? null : \{ name: port \}\); \},/);
  assert.match(w, /shipName: \(boat\) => fleetHost\?\.nameOf\(boat\) \?\? '',/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!read(host).includes('createQuayPool'), `${host}: no quays`);
  const csa = read('src/systems/comeSailAway.js');
  assert.match(csa, /const w = deps\.warp\?\.\(boat, \{ struck: state\.sailPosition === 0, oars: vSqrMagnitude\(state\.MoveVectorTarget\) > 0 \|\| state\.TurnTarget !== 0, dt: dt\(\) \}\) \?\? null;/);
});
