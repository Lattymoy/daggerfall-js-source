// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE KETCH'S DECK PLAN - where every part stands and the clocks
// its hazards run on, the law both ends read: the frame (the Hour's own move), the mast-lift's round trip, the Sailwalk's
// course (the Hour's course law), the bridge's eight sections and the resonators each in the middle of one, the cradles on
// the core, the hazards' landings, a point's part of the ship, the engine's appetite. tools/mutants/ketch_deck.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KT_ORIGIN, deckToDungeon, dungeonToDeck, KT_LIFT, KT_LIFT_CYCLE, liftYAt, KT_MAIN_TOP, KT_YARD, KT_LINE, KT_COURSE, KT_COURSE_SPEC,
  KT_BRIDGE, KT_GANGWAY, KT_RESONATORS, KT_BRIDGE_CRADLES, KT_SECTIONS, sectionAt, KT_HAMMER, hammerPhase, KT_STEAM, KT_ARCS, hazardsBetween,
  deckZoneAt, gangwayHolds, onBridge, zoneFloorY, engineNeeds, KT_SOCKETS, KT_ENGINE, KT_SOCKET_R, KT_CRADLES, KT_HOLD, KT_WAIST, KT_MAIN_MAST,
  KT_STEP_SIZES, KT_ANCHOR_LIFT, KT_ARRIVE,
} from '../../../src/net/ketch/ketchDeck.js';
import { SD_REALM_ORIGIN } from '../../../src/net/superDungeon/sdBrain.js';
import { SD_DRIFT_SIZE, SD_BEAT_SIZE, SD_CRUMBLE_SIZE, SD_RISER_H } from '../../../src/world/superDungeon/sdSteps.js';

test('KETCH THE FRAME: the deck\'s frame into the dungeon\'s is the Shattered Hour\'s own move - one translation, and back (mutants: the origin its own; the way back not the way there)', () => {
  assert.deepEqual([...KT_ORIGIN], [...SD_REALM_ORIGIN]);
  const p = deckToDungeon(3, -6, 120), q = dungeonToDeck(...p);
  assert.deepEqual(q.map((v) => Math.round(v * 1e6) / 1e6), [3, -6, 120]);
  assert.deepEqual(deckToDungeon(0, 0, 0), [...SD_REALM_ORIGIN]);
});

test('KETCH THE MAST-LIFT\'S ROUND TRIP on the shared clock: at its foot a wait, rising (eased), at the top a wait, falling - dead at its foot while the engine is unfed; the cycle twice the rise and the wait (mutants: the cage at the top unfed; the wait at the top skipped)', () => {
  const { y0, y1, rise: R, wait: Wt } = KT_LIFT;
  assert.equal(KT_LIFT_CYCLE, 2 * (R + Wt));
  assert.equal(liftYAt(Wt + R / 2, false), y0, 'unfed: at its foot');
  assert.equal(liftYAt(1, true), y0, 'its first wait');
  assert.ok(Math.abs(liftYAt(Wt + R / 2) - (y0 + y1) / 2) < 1e-9, 'halfway up at half its rise (the ease is symmetric)');
  assert.equal(liftYAt(Wt + R + 1), y1, 'its wait at the top');
  assert.ok(liftYAt(2 * Wt + R + R / 4) < y1 && liftYAt(2 * Wt + R + R / 4) > y0, 'coming down');
  assert.equal(liftYAt(KT_LIFT_CYCLE * 7 + 0.5), y0, 'the cycle repeats');
  assert.equal(liftYAt(NaN), y0);
  assert.ok(liftYAt(-KT_LIFT_CYCLE + Wt + R + 1) === y1, 'a clock before zero reads as the cycle');
});

test('KETCH THE MAIN TOP, THE YARD AND THE LINE: the top about the lift\'s head, the yard from its port edge out to the Sailwalk\'s first top, the bosun\'s line\'s post on the top - and the main mast beside the tower, on the waist (mutants: the yard short of the first top; the line\'s post off the top; the mast off the waist)', () => {
  assert.equal(KT_MAIN_TOP.y, KT_LIFT.y1);
  assert.ok(KT_YARD.x0 <= KT_MAIN_TOP.x + KT_MAIN_TOP.r, 'the yard begins on the top');
  assert.ok(KT_YARD.x1 >= KT_COURSE_SPEC.start.x - KT_COURSE_SPEC.start.r, 'and reaches the first top');
  assert.ok(Math.hypot(KT_LINE.x - KT_MAIN_TOP.x, KT_LINE.z - KT_MAIN_TOP.z) + KT_LINE.r <= KT_MAIN_TOP.r, 'the line\'s post stands on the top');
  assert.ok(KT_MAIN_MAST.z > KT_WAIST.z0 && KT_MAIN_MAST.z < KT_WAIST.z1 && KT_MAIN_MAST.x < KT_WAIST.x1, 'the main mast stands on the waist');
  assert.ok(Math.abs(KT_MAIN_MAST.z - KT_LIFT.z) > KT_LIFT.half, 'and outside the tower');
});

test('KETCH THE SAILWALK IS THE HOUR\'S COURSE LAW: its steps\' sizes the Hour\'s own (pinned equal), three sections - six drifting spars, the beating plates and a riser, seven rotten planks stepping down - from the first top to the bridge\'s deck, its tops the course\'s checkpoints (mutants: a drift\'s size not the Hour\'s; the rigging not descending; a section dropped)', () => {
  assert.deepEqual(KT_STEP_SIZES.drift, { w: SD_DRIFT_SIZE.w, d: SD_DRIFT_SIZE.d });
  assert.deepEqual(KT_STEP_SIZES.beat, { w: SD_BEAT_SIZE.w, d: SD_BEAT_SIZE.d });
  assert.deepEqual(KT_STEP_SIZES.crumble, { w: SD_CRUMBLE_SIZE.w, d: SD_CRUMBLE_SIZE.d });
  assert.equal(KT_STEP_SIZES.riser, SD_RISER_H);
  const kinds = KT_COURSE_SPEC.sections.map((s) => s.pieces.map((p) => p.kind));
  assert.deepEqual(kinds, [Array(6).fill('drift'), ['beat', 'beat', 'riser', 'beat', 'beat', 'beat'], Array(7).fill('crumble')]);
  assert.equal(KT_COURSE_SPEC.sections[2].descend, true);
  assert.equal(KT_COURSE.steps.length, 19);
  assert.equal(KT_COURSE.checkpoints.length, 3, 'the first top, the second, the mizzen top');
  assert.equal(KT_COURSE.checkpoints[0].y, KT_LIFT.y1, 'the first top at the main top\'s height');
  for (const s of KT_COURSE.steps) assert.ok(Math.abs(s.x - KT_COURSE_SPEC.x) < 0.01 || s.kind === 'riser', `step ${s.i} on the Sailwalk's line`);
  assert.ok(KT_COURSE.end > KT_COURSE.checkpoints[2].z, 'its end past the last top');
  assert.ok(gangwayHolds(KT_GANGWAY.ax, KT_GANGWAY.az) && onBridge(KT_GANGWAY.bx, KT_GANGWAY.bz, 0.5), 'the gangway from its end to the bridge\'s rim');
});

test('KETCH THE BRIDGE: eight sections by bearing about its centre, none inside the core; the four resonators each in the middle of 0, 2, 4 and 6 (the ring\'s seams never through one); the two cradles on the core (never on a section that falls) (mutants: a resonator on a seam; a cradle off the core; the core falling)', () => {
  assert.equal(KT_SECTIONS, 8);
  assert.equal(sectionAt(KT_BRIDGE.x, KT_BRIDGE.z + 5), -1, 'the core never falls');
  assert.equal(sectionAt(KT_BRIDGE.x + 0.01, KT_BRIDGE.z + 20), 0);
  assert.equal(sectionAt(KT_BRIDGE.x + 20, KT_BRIDGE.z + 0.01), 1);
  assert.equal(sectionAt(KT_BRIDGE.x + 20, KT_BRIDGE.z - 0.01), 2);
  assert.equal(sectionAt(KT_BRIDGE.x - 0.01, KT_BRIDGE.z + 20), 7);
  assert.equal(sectionAt(KT_BRIDGE.x, KT_BRIDGE.z + 40), -1, 'past the rim');
  assert.deepEqual(KT_RESONATORS.map(([x, z]) => sectionAt(x, z)), [0, 2, 4, 6]);
  for (const [x, z] of KT_RESONATORS) {
    const a = ((Math.atan2(x - KT_BRIDGE.x, z - KT_BRIDGE.z) % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4);
    assert.ok(Math.abs(a - Math.PI / 8) < 1e-9, 'in the middle of its section');
  }
  for (const [x, z] of KT_BRIDGE_CRADLES) { assert.equal(sectionAt(x, z), -1); assert.ok(Math.hypot(x - KT_BRIDGE.x, z - KT_BRIDGE.z) < KT_BRIDGE.core - 2); }
});

test('KETCH THE ENGINE: seven sockets on a ring about its drum, facing aft; six cradles aft in the hold; it eats three cells and one for each two aboard, four to seven (mutants: the appetite unbounded; a socket off the ring)', () => {
  assert.equal(KT_SOCKETS.length, 7);
  for (const [x, z] of KT_SOCKETS) assert.ok(Math.abs(Math.hypot(x - KT_ENGINE.x, z - KT_ENGINE.z) - KT_SOCKET_R) < 1e-9);
  assert.ok(KT_SOCKETS.every(([, z]) => z >= KT_ENGINE.z - KT_SOCKET_R * 0.6), 'facing aft');
  assert.equal(KT_CRADLES.length, 6);
  for (const [x, z] of KT_CRADLES) assert.ok(x >= KT_HOLD.x0 && x <= KT_HOLD.x1 && z > KT_ENGINE.z + 40 && z <= KT_HOLD.z1);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(engineNeeds), [6, 6, 6, 7, 7, 7, 7, 7, 7, 7], 'PIN MOVED (KETCH-LONGER): five and one for each two aboard, every socket from three');
});

test('KETCH THE HAZARDS ON THE SHARED CLOCK: each hammer\'s row a half second on, its lanes a second apart, so every row leaves a lane clear two seconds in three; the steam lanes half a cycle apart; the arcs a third; each landing once in its window, in order, with its storey (mutants: two lanes of a row at once; a landing counted twice at a window\'s edge; the gallery\'s hazards in the hold)', () => {
  for (let ri = 0; ri < KT_HAMMER.rows.length; ri++) {
    const ph = KT_HAMMER.lanes.map((_, li) => hammerPhase(ri, li));
    assert.equal(new Set(ph).size, 3, `row ${ri}: three landings a cycle, a second apart`);
  }
  const all = hazardsBetween(100, 100 + 60);
  const by = (k) => all.filter((h) => h.k === k);
  assert.equal(by('hammer').length, 18 * 20, 'eighteen hammers, twenty cycles of three seconds');
  assert.equal(by('steam').length, 2 * 15);
  assert.equal(by('arc').length, 3 * 12);
  assert.ok(all.every((h, i) => i === 0 || all[i - 1].at <= h.at), 'in order');
  assert.ok(by('hammer').every((h) => h.y === -6) && by('arc').every((h) => h.y === -12));
  // each once across abutting windows
  const a = hazardsBetween(100, 130), b = hazardsBetween(130, 160);
  assert.equal(a.length + b.length, all.length);
  assert.deepEqual(hazardsBetween(100, 160, { gallery: false }).map((h) => h.k).filter((k, i, s) => s.indexOf(k) === i), ['arc']);
  assert.deepEqual(hazardsBetween(100, 160, { hold: false }).map((h) => h.k).filter((k, i, s) => s.indexOf(k) === i), ['hammer', 'steam'], 'and the hold\'s never with the gallery\'s alone');
  assert.deepEqual(hazardsBetween(5, 5), []);
  assert.equal(KT_STEAM.el, 'fire');
  assert.equal(KT_ARCS.el, 'shock');
});

test('KETCH WHERE A BODY STANDS: the anchor deck, the waist, the gun deck and its landing, the hold, the main top and its yard, the Sailwalk, the gangway, the bridge, the cabin, the lift\'s shaft - and the open sky; each zone\'s floor (mutants: the hold read as the gallery; the shaft read as the waist)', () => {
  const z = (x, y, zz) => deckZoneAt(x, y, zz);
  assert.equal(z(KT_ARRIVE.x, 0, KT_ARRIVE.z), 'anchor');
  assert.equal(z(KT_ANCHOR_LIFT.x, 0, KT_ANCHOR_LIFT.z), 'anchor');
  assert.equal(z(0, 0, 30), 'waist');
  assert.equal(z(0, -6, 80), 'gallery');
  assert.equal(z(0, -6, 118), 'landing');
  assert.equal(z(0, -12, 100), 'hold');
  assert.equal(z(KT_LIFT.x, 0, KT_LIFT.z), 'lift');
  assert.equal(z(KT_MAIN_TOP.x - 4, KT_MAIN_TOP.y, KT_MAIN_TOP.z), 'top');
  assert.equal(z((KT_YARD.x0 + KT_YARD.x1) / 2, KT_YARD.y, KT_YARD.z), 'top');
  assert.equal(z(KT_COURSE_SPEC.x, 10, 90), 'sailwalk');
  assert.equal(z(KT_BRIDGE.x, 0, KT_BRIDGE.z), 'bridge');
  assert.equal(z(0, 0, 230), 'cabin');
  assert.equal(z(80, 0, 30), null);
  assert.equal(z(NaN, 0, 0), null);
  assert.deepEqual(['gallery', 'landing', 'hold', 'top', 'bridge'].map(zoneFloorY), [-6, -6, -12, 16, 0]);
});

test('KETCH THE BOSUN\'S LINE SETS ITS RIDER DOWN ON THE GANGWAY, PAST THE GUST, FACING THE BRIDGE: its landing on the gangway, beyond the Rotten Rigging\'s breath (which blows to the course\'s end), the rider\'s forward along the gangway toward the bridge; the line drawn to it (AUDIT KETCH L3-7, L4-6; mutants: set down in the gust; facing the bow)', async () => {
  const { KT_LINE_LAND, KT_GANGWAY, KT_COURSE, KT_BRIDGE, deckZoneAt } = await import('../../../src/net/ketch/ketchDeck.js');
  const { inBreath } = await import('../../../src/world/superDungeon/sdSteps.js');
  const { bosunLineAt } = await import('../../../src/world/ketch/ketchModel.js');
  assert.equal(deckZoneAt(KT_LINE_LAND.x, 0.1, KT_LINE_LAND.z), 'gangway');
  assert.ok(KT_LINE_LAND.z > KT_COURSE.end && !inBreath(KT_LINE_LAND.z, KT_COURSE), 'past the gust');
  const f = [Math.sin(KT_LINE_LAND.yaw), Math.cos(KT_LINE_LAND.yaw)], to = [KT_BRIDGE.x - KT_LINE_LAND.x, KT_BRIDGE.z - KT_LINE_LAND.z], d = Math.hypot(...to);
  assert.ok((f[0] * to[0] + f[1] * to[1]) / d > 0.95, 'facing the bridge, never the bow');
  const g = [KT_GANGWAY.bx - KT_GANGWAY.ax, KT_GANGWAY.bz - KT_GANGWAY.az], gd = Math.hypot(...g);
  assert.ok(Math.abs((f[0] * g[0] + f[1] * g[1]) / gd - 1) < 1e-9, 'along the gangway');
  const end = bosunLineAt(1);
  assert.ok(Math.hypot(end[0] - KT_LINE_LAND.x, end[2] - KT_LINE_LAND.z) < 1e-9, 'the line ends over it');
});

test('KETCH THE WARP\'S BREATH IS DRAWN OVER ITS OWN COURSE: the streaks about the Ketch\'s line (x 24), the Hour\'s about its own (x 0) - the gust\'s warning where the gust blows (AUDIT KETCH L4-5; mutants: the streaks about x 0)', async () => {
  const { buildBreathModel } = await import('../../../src/world/superDungeon/sdStepsModel.js');
  const { SD_COURSE } = await import('../../../src/world/superDungeon/sdSteps.js');
  const { KT_COURSE } = await import('../../../src/net/ketch/ketchDeck.js');
  const meanX = (m) => { let s = 0, n = 0; for (let i = 0; i < m.positions.length; i += 3) { s += m.positions[i]; n++; } return s / n; };
  assert.ok(Math.abs(meanX(buildBreathModel(KT_COURSE)) - KT_COURSE.checkpoints[2].x) < 2, 'the Ketch\'s');
  assert.ok(Math.abs(meanX(buildBreathModel(SD_COURSE)) - SD_COURSE.checkpoints[2].x) < 2, 'the Hour\'s, as it was');
});
