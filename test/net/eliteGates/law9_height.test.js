// THE ASCENT - HEIGHT (LAW 9, 2026-10-16, Mac: "I want it to feel like you're actually traverversing corridors, different
// rooms, etc."; bible/11-Multiplayer/Elite-Gates-Ascent.md section 2, Elite-Gates.md section 31): HEIGHT EVERYWHERE - LAW 9's
// ways cross over and under each other, a fight floor stacked over a fight floor, so every test that asked "is this point on
// (or which) floor" in plan alone answers by the body's feet as well, in a hall of THE ASCENT's law (net/eliteGates/egWalkGraph.js
// EG_HEIGHT_LAW): the fight floor's own tests (net/eliteGates/egLaw.js), the blow judge (net/bossRef.js judgeShapes) and every screen's
// verdict (net/eliteGates/egFair.js egBlowLandsOn), the walk graph's drops (only at an open edge over the floor below - never through a
// floor, a ceiling or a wall), the fliers' air, the legion's and the lords' spots and charge ends and blows, the union floor,
// the haven grid, the Molten Rim and its zones, the client's traversal ground, the telegraph pass's floor choice, the wire's
// heights. Built on synthetic stacked halls (two discs 5 m apart in the same plan, a lane over a disc, a hero's polygon over
// a court); every law before answers in plan as it did, on the law pin's own halls, with any height handed it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleSpecs, egOnFight, egFightPieceAt, egKeepOnFight, egFloorTest, egOnFloor, egOnArrive, egAtDoor, egMoltenRim, egRimCastsBack, egStampFloors, egSpecGive, egSpecForget, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_HEIGHT_LAW, EG_STACK_M, EG_GROUND_UNDER_M, EG_GROUND_OVER_M, EG_DROP_OUT_M, egByHeight, egFeetY, egBears, egOneStorey, egStoreyY, egFightView, egWalkGraph, egWalkNext, egAirOf, egAirClear, egAirNext, egAirKeep, egArchCut, egDropAt, egFloorBetween } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egFightNew, egAim, egHitBody, egBodyNew, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egLegionRaise, egLegionStep, egSameStorey, walkAir } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsNew, egLordsWake, egLordsStep, egHavenFloor, egRuneRouteM, zoneOut } from '../../../src/net/eliteGates/egLords.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { readFileSync } from 'node:fs';
import { judgeShapes } from '../../../src/net/bossRef.js';
import { egBlowLandsOn, egFightFloorAt } from '../../../src/net/eliteGates/egFair.js';
import { egFloorLess, egBurnsIn, egZoneLandings } from '../../../src/net/eliteGates/egFloor.js';
import { egBlowOf, shDisc, egPolyIn } from '../../../src/net/eliteGates/egShape.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egFightFloors, egFloorPlan, egPerilOf } from '../../../src/world/eliteGates/egTelegraph.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_EDGE_DAGON } from '../../../src/render/gate/gateTelegraph.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { EG_LAWS } from '../../../src/net/eliteGates/egDurable.js';

const T0 = 1_800_000_000_000;
/** A synthetic hall of law `v` (9: THE ASCENT's) - its fight floor `fl`, the rest of the spec's fields as given. */
const hall = (v, fl, more = {}) => ({ v, seed: 1, h: 1, c: 1, slot: 1, kind: 'court', band: 0, x0: 0, len: 60, fl, discs: [], bands: [], lanes: [], steps: [], islands: [], caves: [], ramps: [], deco: [],
  spots: {}, rifts: [], vents: [], hazards: [], engines: [], alcoves: [], frags: [], ...more });
/** Two fight discs in one plan, 5 m apart: the court below (r 10), the gallery over it (r 6). */
const LOW = Object.freeze({ t: 'd', x: 0, z: 0, r: 10, y: 0 }), HIGH = Object.freeze({ t: 'd', x: 0, z: 0, r: 6, y: 5 });
/** A hero's record as a hall says it (net/eliteGates/egLaw.js heroSaid): one floor polygon at `y`, its open edges and its ceilings. */
const hero = (poly, y, open = [], ceil = null, fight = 1) => ({ id: 'ascent', kit: 'stacks', cls: 'chamber', f: 0, road: 0, x: 0, y, z: 0, exit: 0, box: [-12, y - 1, -12, 12, y + 6, 12],
  sockets: { in: { x: 0, y, z: -11, w: 4, h: 4 }, out: [] }, floors: [{ y, poly, fight }], ramps: [], open, ceil, graph: { nodes: [], edges: [] } });
const SQUARE = Object.freeze([[-4, -4], [4, -4], [4, 4], [-4, 4]]);   // counter-clockwise; edge 1 its +x side
/** A perch on the court's storey (2.5 m up, under EG_STACK_M): one storey with the court, another floor. */
const PERCH = Object.freeze({ t: 'd', x: 8, z: 0, r: 2, y: 2.5 });
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('THE ASCENT - HEIGHT (Elite-Gates-Ascent.md section 2): THE LAW OF IT - LAW 9 judges by height (EG_HEIGHT_LAW, a spec\'s own law number), every law before in plan alone (its halls\' every answer as it was); floors stacked stand EG_STACK_M (4 m) apart; a floor bears feet in the walk graph\'s band (0.5 m under to 3.0 m over its top), any floor when the feet are not known; a body\'s storey is the top of the fight floor its feet stand on, else its feet (mutants: the law gate at 8; the band\'s under or over widened; the stack\'s bound moved; a storey read off the feet on a floor)', () => {
  assert.deepEqual([EG_HEIGHT_LAW, EG_STACK_M, EG_GROUND_UNDER_M, EG_GROUND_OVER_M], [9, 4, 0.5, 3]);
  assert.deepEqual([4, 5, 6, 7, 8].map((v) => egByHeight({ v })), [false, false, false, false, false], 'the laws before judge in plan alone');
  // PIN MOVED (THE ROOMS, LAW 9 - 2026-10-16): law 9 is in EG_LAWS now (the build draws it) - it alone of them judges by height
  assert.ok(Object.keys(EG_LAWS).every((v) => egByHeight({ v: Number(v) }) === (Number(v) >= EG_HEIGHT_LAW)), 'every law a breach may be opened under today');
  assert.equal(egByHeight({ v: Math.max(...Object.keys(EG_LAWS).map(Number)) }), true, 'the newest, law 9, by height');
  assert.deepEqual([egByHeight({ v: 9 }), egByHeight({ law: 9 }), egByHeight({ v: 10 }), egByHeight(null), egByHeight({})], [true, true, true, false, false]);
  assert.deepEqual([egFeetY({ v: 9 }, 5), egFeetY({ v: 8 }, 5), egFeetY({ v: 9 }, undefined)].map(String), ['5', 'NaN', 'NaN'], 'a height handed a hall of the law before is not known');
  assert.deepEqual([egBears(0, 0), egBears(0, -0.5), egBears(0, -0.51), egBears(0, 3), egBears(0, 3.01), egBears(5, NaN)], [true, true, false, true, false, true], 'the band');
  assert.deepEqual([egOneStorey(0, 3.99), egOneStorey(0, 4), egOneStorey(5, 0), egOneStorey(5, NaN)], [true, false, false, true], 'the stack: 4 m apart is another storey');
  const view = egFightView(hall(9, [LOW, HIGH]));
  assert.deepEqual([egStoreyY(view, 8, 0, 0), egStoreyY(view, 0, 2.7, 0), egStoreyY(view, 0, 5.4, 0), egStoreyY(view, 14, 6, 0), String(egStoreyY(view, 0, NaN, 0))], [0, 0, 5, 6, 'NaN'],
    'a jump\'s apex on the court is the court\'s storey; over the void, the feet');
});

test('THE ASCENT - HEIGHT (section 2): THE FIGHT FLOOR BY THE FEET - egOnFight, egFightPieceAt, egKeepOnFight, egFloorTest, egOnFloor, egOnArrive and egAtDoor read the body\'s feet in a LAW 9 hall: on two discs stacked 5 m apart a body on the gallery is never on the court under it, nor one on the court on the gallery over it; a lane over a disc, a hero\'s polygon over a court the same; a spot kept for a body on the gallery stays on the gallery, with its height; a `y` left undefined - and every law before - answers in plan, as before (mutants: the band never asked; the highest piece not taken; the kept spot off its storey; its height dropped; the arrival plate or the door read in plan; the support floors read in plan)', () => {
  const S = hall(9, [LOW, HIGH]), S8 = hall(8, [LOW, HIGH]);
  // the gallery's rim and the court beyond it: a body on the gallery's height off its plan is on nothing
  assert.deepEqual([egOnFight(S, 0, 0, 0, 0), egOnFight(S, 0, 0, 0, 5), egOnFight(S, 8, 0, 0, 0), egOnFight(S, 8, 0, 0, 5), egOnFight(S, 8, 0, 0, 2.7)], [true, true, true, false, true]);
  assert.deepEqual([egOnFight(S, 8, 0, 0), egOnFight(S8, 8, 0, 0, 5)], [true, true], 'no height, or the law before: in plan');
  assert.equal(egFightPieceAt(S, 0, 0, 0, 5), HIGH, 'over both, at the gallery\'s height: the gallery');
  assert.equal(egFightPieceAt(S, 0, 0, 0, 0.3), LOW, 'at the court\'s: the court');
  assert.equal(egFightPieceAt(S, 0, 0, 0, 3.6), null, 'between them, off both bands: none');
  assert.equal(egFightPieceAt(S, 0, 0), LOW, 'no height: the first, as before');
  assert.equal(egFightPieceAt(S8, 0, 0, 0, 5), LOW, 'the law before: the first');
  assert.equal(egFightPieceAt(hall(9, [HIGH, LOW]), 0, 0, 0, 2), LOW, 'the one that bears the feet, whatever their order');
  assert.equal(egFightPieceAt(hall(9, [LOW, PERCH]), 8, 0, 0, 2.6), PERCH, 'of two that bear them (a perch over the court\'s plan), the highest');
  // a spot kept for a body on the gallery: on the gallery, `inset` in, its height with it
  assert.deepEqual(egKeepOnFight(S, 8, 0, 1, 5), [5, 0, 5], 'the gallery\'s edge, a metre in');
  assert.deepEqual(egKeepOnFight(S, 8, 0, 1, 0), [8, 0, 0], 'on the court: where it is');
  assert.deepEqual(egKeepOnFight(S, 3, 0, 1, 5), [3, 0, 5]);
  assert.deepEqual(egKeepOnFight(S, 8, 0, 1), [8, 0], 'no height: the court in plan, as before');
  assert.deepEqual(egKeepOnFight(S8, 8, 0, 1, 5), [8, 0], 'the law before');
  assert.deepEqual(egKeepOnFight(S, 30, 0, 1, 20), [9, 0, 0], 'feet no floor bears: every piece');
  assert.deepEqual([egFloorTest(S, 5)(8, 0), egFloorTest(S, 0)(8, 0), egFloorTest(S)(8, 0), egFloorTest(S, 5)(2, 0)], [false, true, true, true]);
  // a lane over a disc
  const lane = { t: 'l', ax: -12, az: 0, bx: 12, bz: 0, hw: 2, y: 5 }, disc = { t: 'd', x: 0, z: 0, r: 8, y: 0 }, L = hall(9, [disc, lane]);
  assert.equal(egFightPieceAt(L, 6, 0, 0, 5), lane);
  assert.equal(egFightPieceAt(L, 6, 0, 0, 0), disc);
  assert.equal(egFightPieceAt(L, 0, 5, 0, 5), null, 'off the lane at its height: on nothing');
  assert.deepEqual(egKeepOnFight(L, 0, 5, 0.5, 5), [0, 1.5, 5], 'kept to the lane, never the disc under');
  // a hero's polygon over a court
  const poly = { t: 'p', poly: SQUARE, y: 6 }, court = { t: 'd', x: 0, z: 0, r: 12, y: 0 }, P = hall(9, [court, poly], { heroes: [hero(SQUARE, 6)] });
  assert.equal(egFightPieceAt(P, 0, 0, 0, 6), poly);
  assert.equal(egFightPieceAt(P, 0, 0, 0, 0), court);
  assert.deepEqual([egOnFight(P, 6, 0, 0, 6), egOnFight(P, 6, 0, 0, 0)], [false, true]);
  assert.deepEqual(egKeepOnFight(P, 9, 0, 1, 6), [3, 0, 6], 'kept on the polygon');
  // the support floors (egOnFloor): a band over a disc, a hero's floor and stair
  const F = hall(9, [], { discs: [{ x: 0, z: 0, r: 8, y: 0, role: 'court' }], bands: [{ x: 0, y: 5, z0: -20, z1: 20, halfW: 2, role: 'bridge' }], heroes: [{ ...hero(SQUARE, 6, [], null, 0), ramps: [{ poly: [[6, 0, -2], [6, 0, 2], [9, 3, 2], [9, 3, -2]] }] }] });
  assert.deepEqual([egOnFloor(F, 4, 0, 0, 0), egOnFloor(F, 4, 0, 0, 5), egOnFloor(F, 0, 15, 0, 5), egOnFloor(F, 0, 15, 0, 0), egOnFloor(F, 0, 15, 0)], [true, false, true, false, true]);
  assert.deepEqual([egOnFloor(F, 0, 3, 0, 6), egOnFloor(F, 7, 0, 0, 1.5), egOnFloor(F, 7, 0, 0, 7)], [true, true, false], 'a hero\'s floor at its height; its stair along its rise');
  assert.equal(egOnFloor({ ...F, v: 8 }, 0, 15, 0, 0), true, 'the law before: in plan');
  // the arrival plate and the door, on their own floors
  const D = hall(9, [], { arrive: { x: 0, y: 0, z: 0, r: 5 }, end: { x: 0, y: 6, z: 50, r: 5 } });
  assert.deepEqual([egOnArrive(D, 1, 0, 1, 0), egOnArrive(D, 1, 0, 1, 5), egOnArrive(D, 1, 0, 1), egOnArrive({ ...D, v: 8 }, 1, 0, 1, 5)], [true, false, true, true]);
  assert.deepEqual([egAtDoor(D, 0, 50, 6), egAtDoor(D, 0, 50, 0), egAtDoor(D, 0, 50), egAtDoor({ ...D, v: 8 }, 0, 50, 0)], [true, false, true, true]);
});

test('THE ASCENT - HEIGHT (section 2): A BLOW LANDS ON ITS OWN STOREY - a blow begun in a LAW 9 hall says its height (its thrower\'s feet, or the height its caller names), and the relay\'s judge (net/bossRef.js judgeShapes) lands a stamp over two stacked discs on the floor of that storey alone: the gallery\'s blow never strikes a body on the court under it, nor the court\'s one on the gallery over it; every screen\'s own verdict judges the same floors (net/eliteGates/egFair.js egBlowLandsOn); the law before lands it on every floor under its anchor, as before, and says no height on the wire (mutants: no height said; the thrower\'s height not read; the floors under the anchor not held to the storey; the storey never asked of the struck body; the screen\'s verdict in plan)', () => {
  const S = hall(9, [LOW, HIGH]), S8 = hall(8, [LOW, HIGH]);
  // egAim: the height said with the blow
  for (const [spec, want] of [[S, 5], [S8, undefined]]) {
    const F = egFightNew(spec, T0, [40]);
    const lord = egBodyNew(F, EG_ROLE.lord, 0, 0, 0, 100, { y: 5 });
    const thrown = egAim(F, spec, { o: lord.i, s: [shDisc(0, 0, 3)], at: T0 + 1500, wu: 1500, p: 0.3 }, [], T0, []);
    const named = egAim(F, spec, { o: 0, s: [shDisc(0, 0, 3)], at: T0 + 1500, wu: 1500, p: 0.3, y: 0 }, [], T0, []);
    assert.equal(thrown.y, want, `law ${spec.v}: its thrower's feet`);
    assert.equal(named.y, spec.v === 9 ? 0 : undefined, `law ${spec.v}: the height its caller names`);
    assert.equal(Object.hasOwn(thrown, 'y'), spec.v === 9, 'the law before says no height at all (its words byte for byte)');
  }
  // the judge
  const tr = (y) => [[T0 - 200, 0, y, 0, 1], [T0 - 100, 0, y, 0, 1], [T0 + 100, 0, y, 0, 1]];
  const bodies = [{ sub: 'up', tr: tr(5) }, { sub: 'down', tr: tr(0) }];
  for (const [spec, want] of [[S, [['up', 1], ['down', 2]]], [S8, [['up', 1], ['down', 1], ['up', 2], ['down', 2]]]]) {
    const F = { h: 1, blows: [{ ...egBlowOf({ i: 1, s: [shDisc(0, 0, 3)], at: T0, wu: 1500, p: 0.3 }), y: 5 }, { ...egBlowOf({ i: 2, s: [shDisc(0, 0, 3)], at: T0, wu: 1500, p: 0.3 }), y: 0 }] };
    const out = judgeShapes(F, bodies, T0 + 150, egFightView(spec)).map((o) => [o.sub, o.i]);
    assert.deepEqual(out.sort(), [...want].sort(), `law ${spec.v}: ${JSON.stringify(out)}`);
  }
  // an anchor off every floor of its storey (a lane run on past the gallery): it lands on any floor of its storey - never the court
  const F4 = { h: 1, blows: [{ ...egBlowOf({ i: 5, s: [shDisc(12, 0, 9)], at: T0, wu: 1500, p: 0.3 }), y: 5 }] };
  const at = (x, y) => [[T0 - 200, x, y, 0, 1], [T0 - 100, x, y, 0, 1], [T0 + 100, x, y, 0, 1]];
  assert.deepEqual(judgeShapes(F4, [{ sub: 'up', tr: at(5, 5) }, { sub: 'down', tr: at(8, 0) }], T0 + 150, egFightView(S)).map((o) => o.sub), ['up'], 'off its floors\' plan: its storey still');
  const F5 = { h: 1, blows: [{ ...egBlowOf({ i: 6, s: [shDisc(12, 0, 9)], at: T0, wu: 500, p: 0.3, sp: 3000 }), y: 5 }] };
  const into = (x, y) => [[T0 - 200, 20, y, 20, 1], [T0 - 100, 20, y, 20, 1], [T0 + 600, x, y, 0, 1], [T0 + 700, x, y, 0, 1]];
  assert.deepEqual(judgeShapes(F5, [{ sub: 'up', tr: into(5, 5) }, { sub: 'down', tr: into(8, 0) }], T0 + 1500, egFightView(S)).map((o) => o.sub), ['up'], 'a field stepped into: its storey');
  // a blow of no height in a LAW 9 hall lands as before; a lingering field keeps to its storey too
  const F2 = { h: 1, blows: [egBlowOf({ i: 3, s: [shDisc(0, 0, 3)], at: T0, wu: 1500, p: 0.3 })] };
  assert.deepEqual(judgeShapes(F2, bodies, T0 + 150, egFightView(S)).map((o) => o.sub).sort(), ['down', 'up']);
  const F3 = { h: 1, blows: [{ ...egBlowOf({ i: 4, s: [shDisc(0, 0, 3)], at: T0, wu: 500, p: 0.3, sp: 3000 }), y: 5 }] };
  const walk = (y) => [[T0 - 200, 9, y, 9, 1], [T0 - 100, 9, y, 9, 1], [T0 + 600, 0, y, 0, 1], [T0 + 700, 0, y, 0, 1]];
  assert.deepEqual(judgeShapes(F3, [{ sub: 'up', tr: walk(5) }, { sub: 'down', tr: walk(0) }], T0 + 1500, egFightView(S)).map((o) => o.sub), ['up'], 'a field lasting: the storey it lies on');
  // the floors under a stamp, held to the storey
  assert.deepEqual([egStampFloors(S, ['d', 0, 0, 3], 5), egStampFloors(S, ['d', 0, 0, 3], 0), egStampFloors(S, ['d', 0, 0, 3]), egStampFloors(S8, ['d', 0, 0, 3], 5)], [[5], [0], [0, 5], [0, 5]]);
  assert.equal(egStampFloors(S, ['d', 20, 20, 3], 5), null, 'off every floor: any of its storey');
  assert.equal(egStampFloors(S, ['a'], 5), null, 'a CHECK: the whole floor (of its storey)');
  // every screen's own verdict
  const V = egFightView(S), high = { y: 5, s: [shDisc(0, 0, 3)] };
  assert.deepEqual([egBlowLandsOn(V, high, 0, 5, 0), egBlowLandsOn(V, high, 0, 0, 0), egBlowLandsOn(V, high, 0, 2.7, 0), egBlowLandsOn(V, { ...high, on: ['a'] }, 0, 0, 0)], [true, false, false, true]);
  assert.deepEqual([egBlowLandsOn(V, { s: high.s }, 0, 0, 0), egBlowLandsOn(egFightView(S8), high, 0, 0, 0), egBlowLandsOn(V, high, 0, NaN, 0)], [true, true, true], 'no height said, the law before, feet not known: in plan');
  assert.equal(egBlowLandsOn(V, { y: 0, s: [shDisc(9, 0, 3)] }, 7.5, 5, 0), false, 'off the gallery, at its height: the court\'s blow under it misses');
  const VP = egFightView(hall(9, [LOW, PERCH]));
  assert.deepEqual([egBlowLandsOn(VP, { y: 0, s: [shDisc(0, 0, 10)] }, 8, 2.5, 0), egBlowLandsOn(VP, { y: 0, s: [shDisc(8, 0, 3)] }, 8, 2.5, 0)], [false, true], 'one storey, but the perch under its anchor or not (the relay\'s floors)');
  // the wire carries the height, and refuses one that is no number
  const eb = { k: 'eb', ...egBlowOf({ i: 7, s: [shDisc(0, 0, 3)], at: T0, wu: 1500, p: 0.3 }) };
  assert.equal(validEgOut({ ...eb, y: 5 })?.y, 5);
  assert.equal(Object.hasOwn(validEgOut(eb), 'y'), false, 'none said, none heard');
  assert.equal(validEgOut({ ...eb, y: 1e9 }), null);
  const ez = { k: 'ez', i: 3, kind: 'burn', s: ['d', 0, 0, 3], from: T0, until: T0 + 1000, p: 0.1, b: 0, el: null };
  assert.equal(validEgOut({ ...ez, y: 5 })?.y, 5);
  assert.equal(Object.hasOwn(validEgOut(ez), 'y'), false);
});

test('THE ASCENT - HEIGHT (section 2): THE WALK GRAPH\'S DROPS ONLY WHERE A BODY FALLS - in a LAW 9 hall a higher piece is stepped off onto a lower one at an open edge of it over the lower floor, its landing EG_DROP_OUT_M past the edge, nearest where their plans meet: never through the higher floor at the middle of their overlap (where the law before stepped off), never at a hero\'s closed edge, never through a ceiling or a floor between, never across a wall; floors stacked past THE DROP have none; the law before keeps its drop at the overlap\'s middle (mutants: the drop at the overlap again; a hero\'s walls stepped off; the ceiling between ignored; a floor between ignored; the wall ignored; the landing on the higher floor)', () => {
  const drops = (spec) => { const G = egWalkGraph(egFightView(spec)); const out = []; G.adj.forEach((l, a) => l.forEach(([b, w]) => { if (!G.adj[b].some(([c]) => c === a)) out.push([G.nodes[a], G.nodes[b], w]); })); return out; };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // two discs 4.2 m apart (within THE DROP), the higher whole over the lower: the law before dropped at their shared heart
  const D = (v, more = {}) => hall(v, [LOW, { ...HIGH, y: 4.2 }], more);
  const [old] = drops(D(8));
  assert.ok(old && near(old[0].x, 0) && near(old[0].z, 0) && near(old[1].x, 0) && near(old[1].z, 0), 'law 8: through the gallery at its heart');
  const [d9, ...more] = drops(D(9));
  assert.equal(more.length, 0, 'one drop a pair');
  assert.ok(near(Math.hypot(d9[0].x, d9[0].z), 6) && near(Math.hypot(d9[1].x, d9[1].z), 6 + EG_DROP_OUT_M), `law 9: from the gallery's rim, onto the court past it (${JSON.stringify(d9)})`);
  const G9 = egWalkGraph(egFightView(D(9)));
  assert.deepEqual([G9.rg[d9[0].rg].f, G9.rg[d9[1].rg].f, d9[2]], [1, 0, 0.5], 'from the gallery\'s region to the court\'s, one way');
  assert.equal(drops(hall(9, [LOW, HIGH])).length, 0, 'stacked 5 m: past THE DROP, none');
  // nearest where their plans meet: a perch standing out past the court's rim steps off on its side over the court - the law
  // before stepped off 2.5 m inside the perch (the middle of their overlap)
  const side = hall(9, [LOW, { t: 'd', x: 9, z: 0, r: 4, y: 4.2 }]), [ds] = drops(side);
  assert.ok(Math.abs(ds[0].x - 5) < 0.05 && Math.abs(ds[0].z) < 0.3 && Math.abs(ds[1].x - (5 - EG_DROP_OUT_M)) < 0.05, `its inner rim, over the court (${ds[0].x}, ${ds[0].z})`);
  const far = egDropAt(egFightView(side), 1, 0, [14, 0]);
  assert.ok(far && Math.hypot(far[2], far[3]) <= 10 && far[0] > 8.5, `asked from past the court's rim: the nearest step that lands on the court (${far})`);
  const [os] = drops({ ...side, v: 8 });
  assert.ok(near(os[0].x, 7.5) && near(os[0].z, 0), 'law 8: inside the perch');
  // a hero's polygon: its closed edges are walls; an open edge is stepped off
  const court = { t: 'd', x: 0, z: 0, r: 10, y: 0 }, poly = { t: 'p', poly: SQUARE, y: 4.2 };
  const H = (open, extra = []) => hall(9, [court, poly], { heroes: [hero(SQUARE, 4.2, open), ...extra] });
  assert.equal(drops(H([])).length, 0, 'every edge closed: no drop');
  const [dp] = drops(H([[0, 1]]));
  assert.ok(near(dp[0].x, 4) && near(dp[1].x, 4 + EG_DROP_OUT_M) && Math.abs(dp[0].z) <= 4, `its open edge, the +x side (${JSON.stringify(dp)})`);
  // a ceiling between (a room's on the court, under the polygon's open edge) - and a floor between - and a wall
  const roof = { ...hero([[4.2, -6], [8, -6], [8, 6], [4.2, 6]], 0, [], [{ y: 3, poly: [[4.2, -6], [8, -6], [8, 6], [4.2, 6]] }], 0), floors: [] };
  assert.equal(drops(H([[0, 1]], [roof])).length, 0, 'a ceiling over the landing: no drop through it');
  assert.equal(egFloorBetween(egFightView(H([[0, 1]], [roof])), 4.5, 0, 0, 4.2), true);
  assert.equal(drops(hall(9, [court, poly], { heroes: [hero(SQUARE, 4.2, [[0, 1]])], bands: [{ x: 6, y: 2, z0: -8, z1: 8, halfW: 1.5, role: 'bridge' }] })).length, 0, 'a floor between: no drop through it');
  const walled = hall(9, [LOW, { t: 'd', x: 9, z: 0, r: 4, y: 4.2 }], { deco: [{ t: 'wall', x: 9, z: 0, r: 4.25, h: 3, y: 4.2 }] }), [dw] = drops(walled);
  assert.ok(dw && Math.abs(dw[0].x - 9) < 4 * 0.2 + 0.3 && Math.hypot(dw[1].x, dw[1].z) <= 10, `walled: only through the ring's gaps, onto the court (${dw?.[0].x}, ${dw?.[0].z})`);
  assert.deepEqual(egDropAt(egFightView(walled), 1, 0, [7.5, 0]).map((v) => Math.round(v * 100) / 100), [dw[0].x, dw[0].z, dw[1].x, dw[1].z].map((v) => Math.round(v * 100) / 100));
  // a slot 0.3 m wide in a gallery: a step off one of its walls lands on the far side - on the gallery itself, never a drop
  const U = [[-4, -4], [4, -4], [4, 4], [0.15, 4], [0.15, 0], [-0.15, 0], [-0.15, 4], [-4, 4]], slot = hall(9, [court, { t: 'p', poly: U, y: 4.2 }], { heroes: [hero(U, 4.2, U.map((_, e) => [0, e]))] });
  const Ds = egDropAt(egFightView(slot), 1, 0, [0, 2]);
  assert.ok(Ds && !egPolyIn(U, Ds[2], Ds[3]), `the landing off the gallery (${Ds})`);
  assert.deepEqual(Ds.map((v) => Math.round(v * 100) / 100), [0, 0, 0, EG_DROP_OUT_M], 'down the slot from its foot, never across it');
  // the law before, whatever its spec says of heroes or walls: its drop at the overlap's middle
  const [o8] = drops({ ...walled, v: 8 });
  assert.ok(near(o8[0].x, o8[1].x) && near(o8[0].z, o8[1].z), 'law 8: both nodes at one point, as before');
  // a walker on the gallery to a goal on the court below walks to the rim and steps off
  const V = egFightView(D(9)), b = { x: 0, z: 0, y: 4.2, r: 0.6 };
  const [tx, tz, last] = egWalkNext(V, b, 8, 0, 0);
  assert.ok(!last && near(Math.hypot(tx, tz), 6), `first to the rim (${tx}, ${tz})`);
  assert.deepEqual(egWalkNext(V, { x: 0, z: 0, y: 4.2, r: 0.6 }, 3, 0), [3, 0, true], 'a goal of no height over both floors: on its own storey, straight');
  const [ux, uz, ul] = egWalkNext(V, { x: 0, z: 0, y: 4.2, r: 0.6 }, 8, 0);
  assert.ok(!ul && near(Math.hypot(ux, uz), 6), 'one its storey holds not: the floor under it, down the drop');
  const [px, pz, pl] = egWalkNext(egFightView(D(8)), { x: 1, z: 0, y: 4.2, r: 0.6 }, 3, 0);
  assert.ok(!pl && near(px, 0) && near(pz, 0), 'the law before: the lowest, through the old drop');
});

test('THE ASCENT - HEIGHT (section 2): THE FLIERS\' AIR BY HEIGHT - in a LAW 9 hall each wall of the air says the heights it stands between (a passage from its floor to its roof, an arch and a chamber\'s ring from their foot to their top, a hero\'s closed edge from its floor to the ceiling over it), so a flier over a wall\'s top passes over it and one under a floor\'s walls is not barred by them; a point kept out of a passage\'s rock only beside it; an arch cuts only a run on its own storey; the law before, any height: as before (mutants: the walls\' heights dropped; a flier\'s body ignored; the ways\' sight not reckoned at the height; the rock kept at every height; the arch cutting every storey)', () => {
  const ring = { t: 'wall', x: 0, z: 0, r: 8, h: 3, y: 0 }, arch = { t: 'arch', x: 0, z: 0, w: 6, h: 4, r: 10, y: 0 }, cave = { x: 30, y: 0, yB: 0, z0: -10, z1: 10, halfW: 2, height: 4, open: false };
  const S = hall(9, [], { deco: [ring], caves: [cave] }), S8 = { ...S, v: 8 };
  const A = egAirOf(S), A8 = egAirOf(S8);
  assert.ok(A.walls.length > 0 && A.walls.every((w) => w.length === 6), 'each wall its heights');
  assert.ok(A8.walls.every((w) => w.length === 4), 'the law before: as before');
  assert.deepEqual(A.walls.map((w) => w.slice(0, 4)), A8.walls, 'the same walls in plan');
  assert.deepEqual([egAirClear(A, -12, 0.3, 0, 0.3, 0), egAirClear(A, -12, 0.3, 0, 0.3, 5), egAirClear(A, -12, 0.3, 0, 0.3, 1.5), egAirClear(A, -12, 0.3, 0, 0.3)], [false, true, false, false], 'over its top, clear; its body\'s head against it, not');
  assert.deepEqual(egAirNext(S, -12, 12, 0, 0.3, 5), [0, 0.3], 'over the ring, straight');
  assert.deepEqual(egAirNext(S, -12, 12, 0, 0.3, 0), [0, 9], 'at its foot, about it: to its gap');
  assert.deepEqual(egAirNext(S8, -12, 12, 0, 0.3, 5), [0, 9], 'the law before: about it at any height');
  assert.deepEqual(egAirKeep(S, 33, 0, 0), [31.4, 0], 'in the rock beside the passage: into its tunnel');
  assert.deepEqual(egAirKeep(S, 33, 0, 8), [33, 0], 'over its roof: where it is');
  assert.deepEqual(egAirKeep(S8, 33, 0, 8), [31.4, 0], 'the law before');
  const R = hall(9, [], { deco: [arch] });
  assert.equal(egArchCut(R, 5, -3, 5, 3, 0)?.[1], 0, 'on its storey: cut at the wall');
  assert.equal(egArchCut(R, 5, -3, 5, 3, 6), null, 'a storey up: no wall there');
  assert.equal(egArchCut({ ...R, v: 8 }, 5, -3, 5, 3, 6)?.[1], 0, 'the law before');
  // a hero's closed edges stand from its floor to the ceiling over it
  const P = hall(9, [], { heroes: [hero(SQUARE, 0, [], [{ y: 4, poly: SQUARE }])] }), AP = egAirOf(P);
  assert.ok(AP.walls.length === 4 && AP.walls.every((w) => w[4] === 0 && w[5] === 4), 'floor to ceiling');
  assert.deepEqual([egAirClear(AP, -6, 0.3, 0, 0.3, 0), egAirClear(AP, -6, 0.3, 0, 0.3, 6)], [false, true]);
  // a room a floor up: its walls stand from its floor (4 m) - a flier whose head is under them passes; one whose head is in them not
  const UP = egAirOf(hall(9, [], { heroes: [hero(SQUARE, 4)] }));
  assert.deepEqual([egAirClear(UP, -6, 0.3, 0, 0.3, 1.5), egAirClear(UP, -6, 0.3, 0, 0.3, 3)], [true, false], 'its body\'s head');
  // the ways' sight at the flier's height: about a passage's tall rock, under a room a floor up whose walls cross the near way
  const W = hall(9, [], { caves: [{ x: 0, y: 0, yB: 0, z0: -10, z1: 10, halfW: 2, height: 10, open: false }], heroes: [hero([[-3, -14], [3, -14], [3, -8], [-3, -8]], 6)] });
  assert.deepEqual(egAirNext(W, -20, -2, 20, 0, 0), [-6, -11], 'under the room: the near way about the rock');
  assert.deepEqual(egAirNext({ ...W, v: 8 }, -20, -2, 20, 0, 0), [-6, 11], 'the law before: the room\'s walls at every height - the far way');
  // a flier walked about the air at its own height (net/eliteGates/egLegion.js walkAir)
  for (const [v, want] of [[9, [0, 0.3]], [8, [0, 9]]]) {
    const spec = { ...S, v }, F = egFightNew(spec, T0, [40]), a = egBodyNew(F, 1, 0, -12, 12, 100, { y: 5 });
    walkAir(F, egFightView(spec), a, 0, 0.3, 0, 6, T0);
    assert.deepEqual([a.mv.tx, a.mv.tz], want, `law ${v}: its walk`);
  }
});

test('THE ASCENT - HEIGHT (section 2): THE LEGION AND THE LORDS KEEP TO THEIR STOREY - in a LAW 9 hall a Breaker on the gallery charging a member on it ends its run on the gallery (the law before ran on over the court\'s plan, off the gallery\'s edge); a champion stood on the gallery stands there, its Charge ends on it, and it throws no blow at a member on the court under it - it walks; the hunted\'s Harriers, the spots kept for a raise, the blows at a member all of the body\'s own storey (mutants: the run kept in plan; the lord stood on the lowest floor; a blow thrown at another storey; the storey never asked)', () => {
  const S = hall(9, [LOW, HIGH]), S8 = hall(8, [LOW, HIGH]);
  for (const [spec, end] of [[S, 5.2], [S8, 8]]) {
    const F = egFightNew(spec, T0, [40]);
    const [br] = egLegionRaise(F, [EG_KIND.breaker], [[0, 0, 5]], T0, [], {});
    br.up = 0;
    egLegionStep(F, egFightView(spec), T0 + 1000, [{ sub: 'a', x: 4, z: 0, y: 5 }], () => 0.5, [], {});
    assert.ok(br.runTo && Math.abs(br.runTo[0] - end) < 1e-6 && Math.abs(br.runTo[1]) < 1e-6, `law ${spec.v}: its run ends at ${end} (${br.runTo})`);
  }
  assert.deepEqual([egSameStorey(S, { x: 0, z: 0, y: 5 }, { x: 8, z: 0, y: 0 }), egSameStorey(S, { x: 0, z: 0, y: 0 }, { x: 8, z: 0, y: 2.6 }), egSameStorey(S8, { x: 0, z: 0, y: 5 }, { x: 8, z: 0, y: 0 })], [false, true, true]);
  // a Breaker on the gallery, a member on the court under it in reach: no blow, a walk
  {
    const F = egFightNew(S, T0, [40]);
    const [br] = egLegionRaise(F, [EG_KIND.breaker], [[0, 0, 5]], T0, [], {});
    br.up = 0;
    egLegionStep(F, egFightView(S), T0 + 1000, [{ sub: 'a', x: 8, z: 0, y: 0 }], () => 0.5, [], {});
    assert.equal(br.atk, null, 'no blow at a storey under it');
  }
  // the champion: stood on its floor, its Charge's end on it, and no blow a storey away
  const big = (v) => hall(v, [{ t: 'd', x: 0, z: 0, r: 20, y: 0 }, { t: 'd', x: 0, z: 0, r: 12, y: 5 }]);
  const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
  const fight = (v, my) => {
    const spec = big(v), F = egFightNew(spec, T0, [40]), out = [];
    const [L] = egLordsNew(F, spec, 'kynreeve', T0, out, { decrees: {}, n: 1, at: [0, 0, 5] });
    egLordsWake(F, spec, T0, out, { n: 1 });
    const rng = seeded(3), ends = [];
    let now = T0 + 3000;
    for (let k = 0; k < 400 && !ends.length; k++) { now += 250; egLordsStep(F, spec, now, [{ sub: 'a', x: 10, z: 0, y: my }], rng, [], { decrees: {}, n: 1, covenant: 0 }); if (L.atk?.to && L.lastBlow === 'Charge') ends.push(L.atk.to); }
    return { L, F, ends };
  };
  const up = fight(9, 5);
  assert.equal(up.L.y, 5, 'stood on the gallery (its place\'s height)');
  assert.ok(up.ends.length && Math.abs(up.ends[0][0] - 10.5) < 1e-6, `its Charge ends on the gallery, its body in (${up.ends[0]})`);
  const lane = [...up.F.blows, ...(up.F.pend ?? []).map((q) => q.b)].find((b) => b.nm === 'Charge').s[0];
  assert.ok(lane[0] === 'l' && Math.abs(lane[3] - 10.5) < 1e-6, `its lane laid on the gallery to the run's end (${lane})`);
  const old = fight(8, 0);
  assert.equal(old.L.y, 0, 'the law before: the fight ground under its plan, the lowest');
  assert.ok(old.ends.length && Math.abs(old.ends[0][0] - 18.5) < 1e-6, `the law before: on over the court's plan (${old.ends[0]})`);
  const under = fight(9, 0);
  assert.equal(under.F.bl, 0, 'a member on the court under the gallery: never a blow');
});

test('THE ASCENT - HEIGHT (section 2): THE UNION FLOOR, THE HAVEN GRID AND THE ZONES PER FLOOR - in a LAW 9 hall a member\'s union floor is its own storey\'s (a blow covering the whole of the small gallery it stands on is held, though the court under it is wide; the court\'s blow never held for it), the Haven Nova\'s grid and the Examination\'s route walk the floor of their own storey alone, the Molten Rim keeps a causeway only where a way meets the disc at its height and its zones say their floor, and a zone holds only feet its floor bears; every law before as it was (mutants: the union floor in plan; another storey\'s blow in the set; the haven grid in plan; the causeway from a bridge a storey up; the zone\'s floor ignored by the screens\' cast-back, by the void, by the burns)', () => {
  const small = { t: 'd', x: 0, z: 0, r: 2, y: 5 }, S = hall(9, [LOW, small]), S8 = hall(8, [LOW, small]);
  const aim = (spec, y, member) => { const F = egFightNew(spec, T0, [40]); return egAim(F, spec, { o: 0, s: [shDisc(0, 0, 3)], at: T0 + 1000, wu: 1000, p: 0.3, y }, [member], T0, []); };
  const onSmall = { sub: 'a', x: 0, z: 0, y: 5 }, onCourt = { sub: 'a', x: 0, z: 0, y: 0 };
  assert.equal(aim(S, 5, onSmall), null, 'the gallery\'s blow over all of it: held for the member on it');
  assert.ok(aim(S, 0, onSmall), 'the court\'s blow: not its storey');
  assert.ok(aim(S, 0, onCourt), 'the court is wide: room to run');
  assert.ok(aim(S8, 5, onSmall), 'the law before: its floor in plan, the court\'s room with it');
  // the haven grid on the floor of its storey
  const two = (v) => hall(v, [{ t: 'd', x: 0, z: 0, r: 20, y: 0 }, { t: 'd', x: 0, z: 0, r: 8, y: 5 }]);
  const Hup = egHavenFloor(two(9), [[0, 0, 3]], 1, 5), Hold = egHavenFloor(two(8), [[0, 0, 3]], 1, 5);
  assert.ok(Hup.havens.length > 1 && Hup.havens.every(([x, z]) => Math.hypot(x, z) <= 8 && egOnFight(two(9), x, z, 0, 5)), `on the gallery (${JSON.stringify(Hup.havens)})`);
  assert.ok(Hold.havens.some(([x, z]) => Math.hypot(x, z) > 8), 'the law before: over the court too');
  assert.ok(Hup.routeM < Hold.routeM, 'the route its own floor\'s');
  assert.ok(egRuneRouteM(two(9), [[0, 0]], 1, 5) < egRuneRouteM(two(9), [[0, 0]], 1, 0), 'the Examination\'s route walked on its storey');
  // THE MOLTEN RIM per floor
  const court = { t: 'd', x: 0, z: 0, r: 12, y: 0 };
  const rim = (v) => egMoltenRim(hall(v, [court], { lanes: [{ ax: 0, az: 11, bx: 0, bz: 30, hw: 2, y: 5, role: 'bridge' }, { ax: 11, az: 0, bx: 30, bz: 0, hw: 2, y: 0, role: 'bridge' }] }));
  const M9 = rim(9), M8 = rim(8);
  assert.deepEqual([M9.rings.length, M9.ways.length, M8.ways.length], [1, 1, 2], 'a bridge a storey over the rim keeps no causeway');
  assert.deepEqual(M9.ys, { rings: [0], ways: [0] });
  assert.equal(Object.hasOwn(M8, 'ys'), false, 'the law before: as it was');
  const zones = [{ kind: 'void', s: ['r', 0, 0, 9, 14], from: T0, until: T0 + 9000, y: 0 }];
  assert.deepEqual([egRimCastsBack(zones, 10, 0, T0 + 1, 0), egRimCastsBack(zones, 10, 0, T0 + 1, 5), egRimCastsBack(zones, 10, 0, T0 + 1), egRimCastsBack(zones.map(({ y, ...z }) => z), 10, 0, T0 + 1, 5)], [true, false, true, true]);
  // the union floor's zones
  const on = () => true, burn = { kind: 'burn', s: ['d', 0, 0, 5], from: T0, until: T0 + 9000, y: 5 }, gone = { ...burn, kind: 'void' };
  assert.deepEqual([egBurnsIn([burn], T0, T0 + 1000, 0).length, egBurnsIn([burn], T0, T0 + 1000, 5).length, egBurnsIn([burn], T0, T0 + 1000).length], [0, 1, 1]);
  assert.deepEqual([egFloorLess(on, [gone], T0, T0 + 1000, 0)(0, 0), egFloorLess(on, [gone], T0, T0 + 1000, 5)(0, 0), egFloorLess(on, [gone], T0, T0 + 1000)(0, 0)], [true, false, false]);
  assert.deepEqual(egZoneLandings([{ ...burn, from: T0 + 10 }], T0, T0 + 1000).map((q) => q.y), [5], 'a zone lands at its floor');
  assert.equal(Object.hasOwn(egZoneLandings([{ ...burn, from: T0 + 10, y: undefined }], T0, T0 + 1000)[0], 'y'), false);
  // a zone laid says the floor it lies on (a hall that judges by height), and the wire carries it
  for (const [v, want] of [[9, 5], [8, undefined]]) {
    const F = egFightNew(hall(v, [LOW, HIGH]), T0, [40]), out = [];
    const z = zoneOut(F, 'burn', ['d', 0, 0, 3], T0, T0 + 5000, out, { p: 0.1, b: 0, el: 'fire', y: 5, whole: true });
    assert.deepEqual([z.y, validEgOut(JSON.parse(JSON.stringify(out[0])))?.y, F.keep[0].y], [want, want, want], `law ${v}`);
  }
});

test('THE ASCENT - HEIGHT (section 2): A MEMBER\'S BLOW REACHES ITS OWN STOREY - a melee blow in a LAW 9 hall reaches no body a storey over or under the member, however near in plan; the law before as it was (mutants: the storey never asked; the member\'s floor test in plan)', () => {
  for (const [v, want] of [[9, 0], [8, 1]]) {
    const spec = hall(v, [LOW, HIGH]), F = egFightNew(spec, T0, [40]);
    const L = egBodyNew(F, EG_ROLE.lord, 0, 0.5, 0, 1000, { y: 5 });
    const p = { rate: 5, rateAt: T0, bucket: 1e6, bucketAt: T0, lv: 40, clipped: 0, dealt: 0 };
    const r = egHitBody(F, spec, p, L.i, 10, 0, { x: 0, y: 0, z: 0 }, T0, 1);
    assert.equal(r.got > 0 ? 1 : 0, want, `law ${v}: ${JSON.stringify(r.got)}`);
  }
  // a spell from a bridge 5 m over the court at a body far off at the bridge's height: struck from no fight floor - refused
  for (const [v, want] of [[9, 0], [8, 1]]) {
    const spec = hall(v, [LOW]), F = egFightNew(spec, T0, [40]);
    const L = egBodyNew(F, EG_ROLE.lord, 0, 9, 0, 1000, { y: 5 });
    const p = { rate: 5, rateAt: T0, bucket: 1e6, bucketAt: T0, lv: 40, clipped: 0, dealt: 0 };
    assert.equal(egHitBody(F, spec, p, L.i, 10, HIT_KINDS.Spell, { x: -8, y: 5, z: 0 }, T0, 1).got > 0 ? 1 : 0, want, `law ${v}: from the bridge`);
  }
});

test('THE ASCENT - HEIGHT (section 2): THE CLIENT\'S TRAVERSAL GROUND READS THE FLOOR UNDER THE FEET - the breach client\'s onTraverse (the made level\'s refusal of a technique\'s flight) asks the fight floor by my feet in a LAW 9 hall: under the gallery\'s plan on the court, on the court; on the gallery, on it; over the court\'s rim at the gallery\'s height, off every floor - traversal; the law before, in plan (mutants: the feet\'s height never handed; the floor asked in plan)', () => {
  let clock = 1_800_000_000_000 + EG_SEALED_MS + 60_000;
  const co = [['acct-0', 'Mac', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 30, clock);
  const yard = egCircleSpecs(77, 1, 0).find((s) => (s.fl ?? []).length);
  B.h = yard.h; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const player = { pos: [0, 0, 0], height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] }, stepThroughFire: async () => true };
  const online = { welcomes: 1, terminal: false, sendEg: () => true };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock,
    entity: { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] }, player, cam: { pos: [0, 0, 0] }, say: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {} });
  client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(B, clock)))));
  const stand = (x, y, z) => { player.pos = realmToDungeon(yard.x0 + x, y, z); return client.onTraverse(); };
  try {
    for (const v of [9, 8]) {
      egSpecForget();
      // PIN MOVED (THE ROOMS, LAW 9 - 2026-10-16): the yard is a real LAW 9 hall now, which says its law (`law` - egByHeight's
      // gate before `v`), so the law asked is said in both
      assert.ok(egSpecGive({ ...yard, v, law: v, fl: [{ ...LOW, z: 40 }, { ...HIGH, z: 40 }] }));
      assert.equal(egHallOf(77, yard.h, 0).v, v);
      const got = [stand(0, 0, 40), stand(0, 5, 40), stand(8, 5, 40), stand(8, 0, 40), stand(30, 0, 40)];
      assert.deepEqual(got, v === 9 ? [false, false, true, false, true] : [false, false, false, false, true], `law ${v}: ${got}`);
    }
  } finally { egSpecForget(); }
});

test('THE ASCENT - HEIGHT (section 2): THE TELEGRAPH ON THE FLOOR IT STANDS ON - the telegraph pass (world/eliteGates/egTelegraph.js egFloorPlan) draws a shape whose blow or zone says its height on the fight floors of that storey alone: the gallery\'s disc on the gallery, never on the court under it in plan, and the court\'s on the court; a shape of no height on every floor under its anchor, as before (mutants: the storey never asked; a CHECK drawn on every storey)', () => {
  const S = hall(9, [LOW, HIGH]), floors = egFightFloors(S);
  const shape = (kind, by) => ({ kind, origin: [0, 0], end: [3, 0], yaw: 0, r: 3, halfW: 1, halfArc: 0, body: 0, r0: 0, r1: 0, points: [], n: 0, t: 0.5, flash: 0, alpha: 1, color: [1, 0.3, 0.2], edge: TELEGRAPH_EDGE_DAGON,
    court: 0, style: 0, since: 0.5, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow, mine: false, y: NaN, order: 0, by });
  const heights = (sh) => [...new Set(egFloorPlan([sh], floors, null, null).draws.map((d) => d.f.y))].sort();
  assert.deepEqual(heights(shape(TELEGRAPH_KIND.disc, 5)), [5], 'the gallery\'s on the gallery');
  assert.deepEqual(heights(shape(TELEGRAPH_KIND.disc, 0)), [0], 'the court\'s on the court');
  assert.deepEqual(heights(shape(TELEGRAPH_KIND.disc, NaN)), [0, 5], 'no height: every floor under it in plan, as before');
  assert.deepEqual(heights(shape(TELEGRAPH_KIND.all, 5)), [5], 'a whole floor\'s: its own storey\'s');
  assert.deepEqual(heights(shape(TELEGRAPH_KIND.all, NaN)), [0, 5]);
  const past = { ...shape(TELEGRAPH_KIND.disc, 5), origin: [8, 0] };
  assert.deepEqual(heights(past), [5], 'its anchor past the gallery\'s rim (over the court\'s plan alone): on the gallery\'s part it covers, never the court');
  assert.deepEqual(heights({ ...past, by: NaN }), [0], 'no height: the court under its anchor, as before');
  // THE PERIL ARROW: the blow on my feet is one of my storey - never the gallery's over my plan on the court
  const blow = (y) => ({ s: [['d', 0, 0, 4]], at: T0 + 1000, wu: 1500, nm: 'Slam', ch: 0, ...(y != null ? { y } : {}) });
  assert.deepEqual([egPerilOf([blow(5)], [1, 0], 0, S, T0), egPerilOf([blow(0)], [1, 0], 0, S, T0)?.name, egPerilOf([blow()], [1, 0], 0, S, T0)?.name, egPerilOf([blow(5)], [1, 0], 5, S, T0)?.name], [null, 'Slam', 'Slam', 'Slam']);
});

test('THE ASCENT - HEIGHT (section 2): EVERY CALL SITE HANDS THE FEET - the relay\'s director (who is here, at the door, on the arrival plate, a hunted member\'s Harriers, a hit\'s object, the champion\'s ring and the lords\' wake rings, the Molten Rim\'s zones, the hall\'s own blows and pools), the legion and the lords (their spots, runs, blinks, haven grids, objects and zones), the client\'s traversal ground and door, and every screen\'s verdict, zones and telegraph slots - so each judges by the height it stands at (mutants: any site\'s height dropped)', () => {
  const sites = {
    'src/net/eliteGates/egBrain.js': ['egOnFight(view, b.x, b.z, 4, b.y)', 'egAtDoor(spec, b.x, b.z, b.y) && B.mem[b.sub]?.hereH === B.h', 'egOnArrive(spec, b.x, b.z, 1.5, b.y)) { m.hereH', 'egOnArrive(spec, b.x, b.z, 1.5, b.y)) { B.mem', 'egAtDoor(spec, p.x, p.z, p.y) || !fairOf', 'egAtDoor(spec, x, z, y)) { egFairCross', 'egOnArrive(spec, x, z, 2, y)',
      '[egKeepOnFight(view, b.x, b.z, 1, b.y)]', 'egStruckOff(view, body, p.x, p.y, p.z)', 'whole: true, y: ys?.[j]', "nm: 'Ashfall', y: m.y", "nm: 'Spark', y: o.y", "nm: 'Wellhead Vent', y: m.y", 'nm: E.name, y: e.y', "{ p, b, el, y }", 'egBears(H, egFeetY(spec, b.y))', 'egFightPieceAt(spec, fx, fz, 0, fy)', 'ringSpots(spec, L0.x, L0.z, 12, egWaveSize(F.n), rng, L0.y)',
      'return !Number.isFinite(oy) || egBears(oy, egFeetY(spec, b.y));', 'for (const a of reachable(b, spec.alcoves, false))', 'for (const q of reachable(b, spec.spots.hcache))', 'for (const q of reachable(b, spec.spots.lniche))', '(!egByHeight(spec) || egBears(o.y ?? 0, egFeetY(spec, b.y)))'],
    // PIN MOVED (FIELD BUGS 2026-10-18f TURNED-BLOW): the strike rule a hit's object is judged by moved into egBodies.js egStruckOff
    // (the one law every screen asks too) - egBlow hands it the striker's feet, and it reads the object's own
    'src/net/eliteGates/egBodies.js': ['egGroundAt(view, x, y, z, EG_STRIKE_PAD_M)', 'egGroundAt(view, b.x, egFeetY(view, b.y), b.z',
      // AUDIT FB1018f L3-6: the storey a hit's body stands in moved into egStoreyApart (the one law every screen asks too) - egHitBody
      // hands it the striker's feet and the body's, and egStrikeTurned the body's where its walk has carried it
      'egStoreyApart(F.view ?? spec, pose.x, pose.y, pose.z, bx, b.y, bz, r === HIT_KINDS.Melee)', 'egStoreyApart(view, x, y, z, bx, b.mv ? egWalkY(b.mv, now) : b.y, bz, false)', 'egOutOfReach(spec, pose.x, pose.y, pose.z, b, bx, bz)', 'egOutOfReach(spec, x, y, z, b, bx, bz)'],
    'src/net/eliteGates/egLegion.js': ['K.r, a.y);', 'egArchCut(spec, a.x, a.z, ex, ez, a.y)', 'egKeepOnFight(spec, mark.x, mark.z, 0.5, a.y)', 'egGroundAt(spec, a.x, egFeetY(spec, a.y), a.z, 0.5)', 'egOnFight(spec, n.m.x, n.m.z, -3, n.m.y)', "nm: 'Pyre', y: a.y", 'egAirKeep(view, gx, gz, a.y)', 'egAirNext(view, a.x, a.z, tx, tz, a.y)'],
    'src/net/eliteGates/egLords.js': ['regionOf(view, G, L.x, L.z, egFeetY(view, L.y), L.fr), to', 'egArchCut(view, L.x, L.z, to[0], to[1], L.y)', 'L.x + Math.sin(a) * 8, L.z + Math.cos(a) * 8, 1, L.y)', 'f.r * 0.7, 2, L.y)', 'L.z + Math.cos(yaw) * 8, L.r, L.y)', 'L.z + Math.cos(yaw) * 10, L.r, L.y)',
      'egHavenRouteM(havens, f), f.y)', 'egKeepOnFight(spec, G.x0 + (far % G.W) * g, G.z0 + Math.floor(far / G.W) * g, 3, y)', 'R, 1, f.y));', "{ r: 0.8, extra: { third: C.next }, y: by }", "zoneOut(F, 'void', shDisc(o.x, o.z, 11), o.stAt, o.stAt + 15_000, out, { y: o.y })", 'el: bl.el, y: bl.y }', 'spotY(spec, s) });', 'of the storey its feet stand in (the discs that bear them)'],
    'src/scenes/eliteGates/egClient.js': ['at.z, 0, at.y);', 'egAtDoor(spec, egLocalX(spec, at.sx), at.z, at.y)', '{ slot: egSlotAt(sx), sx, y, z }'],
    'src/scenes/eliteGates/egFight.js': ['onStorey(egBlowVerdict(bl, f[0], f[1], t, 400, me()), bl, f[0], fy, f[1], t)', 'onStorey(egBlowVerdict(bl, q[0], q[2], t, 400, sub), bl, q[0], q[1], q[2], t)', 'egBlowLandsOn(egFightView(spec), bl, x, y, z)', '(Number.isFinite(z.y) && !egBears(z.y, egFeetY(spec, fy)))', 'egRimCastsBack(F.zones, f[0], f[1], t, egFeetY(spec, fy))',
      'sh.by = Number.isFinite(bl.y) ? bl.y : NaN;   // THE ASCENT', "sh.style = TELEGRAPH_STYLE.weight; sh.by = Number.isFinite(bl.y) ? bl.y : NaN;", 'hv.by = sh.by;', 'sh.by = Number.isFinite(z.y) ? z.y : NaN;', 'sl.by = NaN;', '!!f && egOneStorey(st, bl.y) && bl.s.some', 'egStoreyY(egFightView(spec), f[0], fy, f[1])',
      // AUDIT FB1018f lane L3: the screen's strike rule is handed my feet's height (TURNED-BLOW's turnStandIn)
      'egStruckOff(view, b, at[0], at[1], at[2])', 'egStrikeTurned(view, b, at[0], at[1], at[2], now(), spec)'],
  };
  for (const [file, want] of Object.entries(sites)) {
    const src = rd(file);
    for (const w of want) assert.ok(src.includes(w), `${file}: ${w}`);
  }
  // egAirKeep's own height read in the lords' fliers is walkAir's (net/eliteGates/egLegion.js) - never a bare call
  assert.ok(!/egAirKeep\(view, gx, gz\)/.test(rd('src/net/eliteGates/egLegion.js')));
});

test('THE ASCENT - HEIGHT (section 2): EVERY LAW BEFORE, BYTE FOR BYTE - on the law pin\'s halls of laws 4 to 8 (four seeds, two grounds) every floor test handed a height answers exactly what it answers with none (the fight floor\'s tests, the support floors, the plates, the air, the arches, the rock, the Molten Rim), its air\'s walls say no heights, and every drop of its walk graph stands at one point (the overlap\'s middle, as it did) (mutants: the law gate opened to the laws before; a test reading its height ungated)', () => {
  const rng = (() => { let s = 99; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; })();
  let asked = 0, drops = 0;
  for (const law of [4, 5, 6, 7, 8]) for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (const h of [3, 5, 12, 14, 27, 33, 40, 45, 72, 90]) {
    const spec = egHallOf(seed, h, geo, law), view = egFightView(spec);
    assert.equal(egByHeight(spec), false);
    for (let k = 0; k < 12; k++) {
      const f = spec.fl?.[k % Math.max(1, spec.fl?.length ?? 1)], cx = f ? f.x ?? f.ax ?? f.poly?.[0][0] ?? 0 : 0, cz = f ? f.z ?? f.az ?? f.poly?.[0][1] ?? 0 : spec.len / 2;
      const x = cx + (rng() - 0.5) * 30, z = cz + (rng() - 0.5) * 30, y = [0, 2.5, 4, 5, -6, 12][k % 6], pad = [0, 1, 4, -1][k % 4];
      assert.equal(egOnFight(spec, x, z, pad, y), egOnFight(spec, x, z, pad));
      assert.equal(egFightPieceAt(view, x, z, pad, y), egFightPieceAt(view, x, z, pad));
      assert.deepEqual(egKeepOnFight(spec, x, z, Math.abs(pad), y), egKeepOnFight(spec, x, z, Math.abs(pad)));
      assert.equal(egOnFloor(spec, x, z, Math.abs(pad), y), egOnFloor(spec, x, z, Math.abs(pad)));
      assert.equal(egOnArrive(spec, x, z, 1, y), egOnArrive(spec, x, z, 1));
      assert.equal(egAtDoor(spec, x, z, y), egAtDoor(spec, x, z));
      assert.deepEqual(egAirNext(spec, x, z, cx, cz, y), egAirNext(spec, x, z, cx, cz));
      assert.deepEqual(egAirKeep(spec, x, z, y), egAirKeep(spec, x, z));
      assert.deepEqual(egArchCut(spec, x, z, cx, cz, y), egArchCut(spec, x, z, cx, cz));
      assert.deepEqual(egStampFloors(view, ['d', x, z, 3], y), egStampFloors(view, ['d', x, z, 3]));
      asked++;
    }
    assert.ok(egAirOf(spec).walls.every((w) => w.length === 4));
    assert.equal(Object.hasOwn(egMoltenRim(spec), 'ys'), false);
    const G = egWalkGraph(view);
    G.adj.forEach((l, a) => l.forEach(([b]) => { if (G.adj[b].some(([c]) => c === a)) return; drops++; assert.ok(G.nodes[a].x === G.nodes[b].x && G.nodes[a].z === G.nodes[b].z, `law ${law} ${seed}:${h}:${geo}: a drop at one point`); }));
  }
  assert.ok(asked >= 4000 && drops > 20, `${asked} asked, ${drops} drops`);
});
