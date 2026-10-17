// EG-ZJ (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 22 and 23, EG-ZB's
// departure 3, layer three's look and EG-ZC's shafts): THE FIGHT WHOLE ON THE WIRE - every body's feet on the wire (the fight
// ground under it, a graph walker's floors, a flier's mark) and every screen drawing it there; the whole fight a member who
// joins or reloads mid-fight is handed (the zones still burning, each object's and lord's state as said, each walk carried to
// its instant), folding to the company's own; the Cooling Slag's spill and its crust's tell on the crust's own surface down a
// Wellhead Deepway's Slag Chute - against the director (net/eliteGates/egBrain.js), the screen (scenes/eliteGates/egFight.js) and the real Room
// (test/fakeRoom.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../../fakeRoom.mjs';
import { EG_INTERNAL_OPEN, validEgOut } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, egCircleSpecs, EG_LORDS, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8, egGive8Hall } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egBreachNew, egEnter, egStep, egStateOf, egFightStateOf, champRing } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL, EG_Y_RESAY_M, egFightNew, egFightBind, egBodyNew, egBodyWire, egBodyAt, egWalk, egWalkY, egStop, egPlace, egCarry, egMovesOut, egHpOut, egObSay, egSetFl, egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egAirY, egIsleAhead, egLegionRaise, egLegionStep } from '../../../src/net/eliteGates/egLegion.js';
import { EG_OBJ, zoneOut, egLordHit } from '../../../src/net/eliteGates/egLords.js';
import { egFightView, egFeetAt, egGroundAt, egWalkFeet, egWalkNext, egPortalOf } from '../../../src/net/eliteGates/egWalkGraph.js';
import { foldEg, egBodyOf, egBodyHeight, egBodyPlace, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egLordBar } from '../../../src/ui/eliteGates/egSpireHud.js';
import { createEgFight, egBodyAct } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { BOSS_CUES } from '../../../src/world/gate/gateBoss.js';
import { egFightFloors, egFloorPlan, egHazardSurface } from '../../../src/world/eliteGates/egTelegraph.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL } from '../../../src/render/gate/gateTelegraph.js';
import { egHazardParts, EG_HAZARDS } from '../../../src/net/eliteGates/egFragLaw.js';
import { egSlagState, egSlagX, EG_SLAG_SPOUTS, EG_SLAG_CRUST_S, EG_SLAG_WARN_S } from '../../../src/net/eliteGates/egSpanLaw.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
/** Whole centimetres - the law's heights, and the wire's (section 9). */
const cmExact = (v) => Number.isFinite(v) && Math.round(v * 100) / 100 === v;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
/** The first hall (seeds 1-`seeds`, circles 1-20) `want` takes - the law's own, never a literal. PIN MOVED (THE ASCENT - THE
 *  ROOMS, LAW 9 - 2026-10-16): of spec law 8's halls, its circle given (test/egGive8.mjs) - the feet's pins were written on law 8's
 *  ground (its courts, its shafts, its lords' heights); LAW 9's storeys are test/net/eliteGates/law9_height.test.js's */
function findSpec(want, seeds = 120) {
  for (let seed = 1; seed <= seeds; seed++) for (let c = 1; c <= 20; c++) for (const s8 of egCircleSpecs(seed, c, 0, 8)) if (want(s8)) { egGive8(seed, [c]); return { seed, c, s: egHallOf(seed, s8.h, 0) }; }
  throw new Error('no such hall');
}
/** A frame as the wire carries it to a screen (JSON, then validEgOut). */
const wired = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };
/**
 * A breach of `n` at hall `h` of `seed`, woken with the company on the arrival plate (at the plate's own height): `at(sub, x, z,
 * y)` stands a member (the hall's frame), `step(ms)` beats the director - every frame held to the wire and folded into the
 * screen of `acct-0`, who has heard the whole breach (`seen()`).
 */
function breachAt(seed, h, { n = 2 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egGive8Hall(seed, h, 0);   // PIN MOVED (THE ASCENT): its circle given at law 8 (findSpec, above)
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z, y: spec.arrive.y ?? 0 }]));
  const frames = [];
  let E = EG_STATE_EMPTY;
  const step = (ms = 250) => {
    now += ms;
    const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng);
    for (const f of o) { if (f.to && f.to !== 'acct-0') continue; const v = wired(f); assert.ok(v, `the wire refuses ${f.k}: ${JSON.stringify(f).slice(0, 200)}`); E = foldEg(E, v, now); }
    frames.push(...o);
    return o;
  };
  for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const at = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, ...(y != null ? { y } : {}) }; };
  return { B, spec, pos, frames, step, at, now: () => now, seen: () => E, fold: (f) => { E = foldEg(E, wired(f), now); } };
}
/** A Court laid above the hall's own height, every floor of it (the law's - the fight centre's height is the hall's 0). */
const courtAbove = () => findSpec((q) => q.kind === 'court' && q.fl.length > 0 && q.fl.every((f) => f.y > 1));

test('EG-ZJ A BODY\'S FEET, THE LAW (sections 11.7 and 23; net/eliteGates/egWalkGraph.js egFeetAt, egWalkFeet; net/eliteGates/egLegion.js egAirY; net/eliteGates/egBodies.js): on a chamber\'s stair\'s top the balcony from above and the floor from under it, the lowest with no height, the balcony past the floor\'s rim, a height kept over no fight ground; a walker up the stair standing on the floor with its walk ending on the balcony; a flier at its mark\'s floor, past the band at its own feet; a body stood on the ground under it or at its height, whole centimetres; a walk carrying its height and its end\'s, said again past EG_Y_RESAY_M or with its feet off its line, a stop and a place on their ground; a body\'s row of eighteen with its state as said; the whole fight\'s walk carried to its instant; a standing body whose ground moves under it said again; a Sapper up a stair from the floor\'s height to the balcony\'s and off its lip at the floor\'s at once; a Caster on its pillar over a bastion standing on the pillar; the fight\'s ground kept unenumerated and bound again (mutants: the climb flat; the lip a glide; the walker\'s region by plan; the band\'s fallback dropped; a stair\'s end read off the wrong region; a flier at the floor past the band; a height in millimetres; a walk\'s end\'s height never resaid; the feet off the line unheard; a place left in the air; the state unsaid; the whole fight\'s walk at its head start)', () => {
  // a chamber's balcony over its floor and its stair between (the law's). PIN MOVED (AUDIT EG IV, the Fallen Stacks laid
  // since): a code-built chamber's discs - the first hall with a stair is now the Stacks', whose floors are polygons (its
  // stair and balcony test/net/eliteGates/eghero_lay.test.js's THE LEGION WALKS ITS GRAPH). PIN MOVED (AUDIT EG V, f: spec law 8 lays stairs
  // outside chambers too - a Rampart's caster pillars', the Wyrm's perches', the Rotunda's balconies' - so the hall asked for is
  // one with a code-built chamber)
  const { s: spec } = findSpec((q) => !q.heroes && (q.ramps ?? []).length > 0 && q.frags.some((f) => f.cls === 'chamber'));
  const view = egFightView(spec), q = spec.ramps[0];
  const low = spec.fl.find((f) => f.t === 'd' && f.y === q.y0 && Math.hypot(q.bx - f.x, q.bz - f.z) <= f.r);
  const high = spec.fl.find((f) => f.t === 'd' && f.y === q.y1 && Math.hypot(q.bx - f.x, q.bz - f.z) <= f.r + 0.5);
  assert.ok(low && high && q.y1 - q.y0 > 3, 'a balcony over the floor its stair climbs from');
  // AUDIT EG IV: a Deepway champion chamber's - its stair's top on its balcony's very rim, where a walker that reached the top
  // node (EG_NODE_REACH_M short of it) once stood outside the balcony by more than its region's pad, was told the floor's,
  // and walked back down the stair for ever
  assert.ok(Math.abs(Math.hypot(q.bx - high.x, q.bz - high.z) - high.r) < 1e-9, 'the stair\'s top on the balcony\'s rim');
  assert.equal(egFeetAt(view, q.bx, q.bz, q.y1), q.y1, 'at the stair\'s top, from the balcony: the balcony');
  assert.equal(egFeetAt(view, q.bx, q.bz, q.y0), q.y0, 'the same plan from the floor under it: the floor (section 11.7\'s band)');
  assert.equal(egFeetAt(view, q.bx, q.bz), q.y0, 'with no height: the lowest that holds it');
  const rim = [high.x + Math.sign(high.x - low.x) * (high.r - 0.5), high.z];
  assert.ok(Math.hypot(rim[0] - low.x, rim[1] - low.z) > low.r + 0.5, 'a point of the balcony past the floor\'s rim');
  assert.equal(egFeetAt(view, rim[0], rim[1], q.y0), q.y1, 'from the floor, past its rim: the band holds nothing, the balcony stands it (a leap up)');
  assert.equal(egFeetAt(view, 500, 500, -4.256), -4.26, 'over no fight ground: its height kept, whole centimetres');
  assert.equal(egFeetAt(view, 500, 500), 0, 'and with none known, nought');
  // a walker up the stair: on the floor now, its walk ending on the balcony; at the top, on the balcony
  const w = { x: q.ax, z: q.az, r: 0.6 };
  assert.deepEqual(egWalkNext(view, w, high.x, high.z, q.y1, 0.6), [q.bx, q.bz, false], 'up the stair: its top next');
  assert.deepEqual(egWalkFeet(view, w), [q.y0, q.y1], 'standing on the floor, its walk ending on the balcony');
  w.x = q.bx; w.z = q.bz;
  egWalkNext(view, w, high.x, high.z, q.y1, 0.6);
  assert.deepEqual(egWalkFeet(view, w), [q.y1, q.y1], 'at the top: on the balcony, its walk on it');
  assert.equal(egWalkFeet(egFightView({ fl: [] }), w), null, 'no fight ground, no floors');
  // a Court laid above the hall's own height: the ground under every body
  const { s: court } = courtAbove(), f0 = court.fl.find((f) => f.t === 'd'), cv = egFightView(court);
  assert.ok(f0.y > 1 && cmExact(f0.y));
  assert.equal(egAirY(cv, { x: f0.x, z: f0.z, y: f0.y + 1.1 }, {}), f0.y, 'a flier\'s mark jumping over the floor: the floor');
  assert.equal(egAirY(cv, { x: f0.x, z: f0.z, y: f0.y + 3.5 }, {}), f0.y + 3.5, 'past the band over it: the mark\'s own feet');
  assert.equal(egAirY(cv, { x: 500, z: 500, y: -8.234 }, {}), -8.23, 'over no fight ground (a span\'s platform): its own feet, whole centimetres');
  assert.equal(egAirY(cv, { x: f0.x, z: f0.z }, { y: 9 }), f0.y, 'no height known: the ground under the mark');
  assert.equal(egAirY(cv, { x: 500, z: 500 }, { y: 9 }), 9, 'and no ground: the flier\'s own');
  const F = egFightNew(court, T0, [40, 40]);
  assert.equal(F.view, cv, 'the fight reads the hall\'s fight ground');
  assert.ok(!Object.keys(F).includes('view') && !('view' in structuredClone(F)), 'unenumerated: storage never keeps the hall');
  const G = structuredClone(F);
  assert.equal(egFightBind(G, cv).view, cv, 'bound again on a woken room\'s beat');
  const lord = egBodyNew(F, EG_ROLE.lord, 0, f0.x, f0.z, 100, { now: T0 });
  assert.equal(lord.y, f0.y, 'stood on the fight ground under it');
  const fl = egBodyNew(F, EG_ROLE.add, EG_KIND.harrier, f0.x, f0.z, 10, { now: T0, y: -3.456 });
  assert.equal(fl.y, -3.46, 'or at the height it rose at, whole centimetres');
  // a walk: its height and its end's, carried; said again past EG_Y_RESAY_M or with its feet off its line
  egWalk(F, fl, f0.x + 10, f0.z, 0, 5, T0, court, 0, true, 2.004);
  assert.deepEqual(F.moves.at(-1).slice(5, 9), [5, T0, -3.46, 2], '`[i, x, z, tx, tz, v, at, y, ty, yw]`');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  assert.ok(near(egWalkY(fl.mv, T0 + 1000), (-3.46 + 2) / 2), 'half way, half the climb');
  assert.equal(egWalkY(fl.mv, T0 + 5000), 2, 'there, its end\'s');
  egCarry(F, T0 + 400);
  assert.ok(near(fl.y, -3.46 + 5.46 * 0.2), 'carried with its place');
  let n0 = F.moves.length;
  egWalk(F, fl, f0.x + 10, f0.z, 0, 5, T0 + 500, court, 0, true, 2 + EG_Y_RESAY_M - 0.01);
  assert.equal(F.moves.length, n0, 'its end\'s height within EG_Y_RESAY_M: no new word');
  egWalk(F, fl, f0.x + 10, f0.z, 0, 5, T0 + 600, court, 0, true, 2 + EG_Y_RESAY_M + 0.05);
  assert.equal(F.moves.length, n0 + 1, 'past it: said again');
  n0 = F.moves.length;
  fl.y = egWalkY(fl.mv, T0 + 700) - (EG_Y_RESAY_M + 0.1);
  egWalk(F, fl, f0.x + 10, f0.z, 0, 5, T0 + 700, court, 0, true, 2 + EG_Y_RESAY_M + 0.05);
  assert.equal(F.moves.length, n0 + 1, 'its feet off the walk\'s line (a lip stepped off): said again');
  assert.equal(F.moves.at(-1)[7], fl.y, 'from where its feet are');
  egStop(F, fl, T0 + 800);
  assert.deepEqual(F.moves.at(-1).slice(5, 9), [0, T0 + 800, fl.y, fl.y], 'a stop: where it stands');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  // a ground body's walk ends on the ground under its goal; a place on the ground there
  egWalk(F, lord, f0.x + 3, f0.z, 0, 3, T0, court);
  assert.deepEqual(F.moves.at(-1).slice(7, 9), [f0.y, f0.y], 'a lord\'s walk over its floor');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  const P = egFightNew(spec, T0, [40]), b = egBodyNew(P, EG_ROLE.add, EG_KIND.breaker, low.x, low.z, 10, { now: T0 });
  assert.equal(b.y, q.y0);
  egPlace(P, b, rim[0], rim[1], T0 + 10);
  assert.deepEqual([b.y, ...P.moves.at(-1).slice(7, 9)], [q.y1, q.y1, q.y1], 'set down past the floor\'s rim: on the balcony');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  egPlace(P, b, low.x, low.z, T0 + 20);
  assert.equal(b.y, q.y0, 'and back down on the floor');
  // a body's row: seventeen, its feet and its walk's end's, its state as said and since when
  const isle = egBodyNew(F, EG_ROLE.obj, EG_OBJ.isle, f0.x, f0.z, 1, { now: T0 });
  assert.deepEqual(egBodyWire(isle).slice(13, 18), [f0.y, f0.y, 0, 0, 0], 'nothing said yet');   // PIN MOVED (EG-ZQ): and its size, the eighteenth (0 its look's own); PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  const out = [];
  egObSay(isle, 2, T0 + 500, out);
  assert.deepEqual(out, [{ k: 'eob', i: isle.i, st: 2, at: T0 + 500 }]);
  assert.deepEqual(egBodyWire(isle).slice(13, 18), [f0.y, f0.y, 2, T0 + 500, 0], 'the island fallen, since its word');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  assert.equal(egBodyWire(fl).length, 19);   // PIN MOVED (EG-ZQ): a row of eighteen; PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  // the whole fight's walk carried to its instant: its place, its height and its `at` then
  egWalk(F, lord, f0.x + 9, f0.z, 0, 3, T0 + 2000, court);
  const row = egFightState(F, T0 + 3000).b.find((t) => t[0] === lord.i), [cx, cz] = egBodyAt(lord, T0 + 3000);
  assert.deepEqual([row[4], row[5], row[12]], [Math.round(cx * 100) / 100, Math.round(cz * 100) / 100, T0 + 3000], 'said where the room holds it now, its walk from now');
  assert.ok(Math.hypot(row[4] - lord.mv.x, row[5] - lord.mv.z) > 2, 'not its walk\'s head start');
  egWalk(F, fl, f0.x - 7, f0.z, 0, 5, T0 + 2000, court, 0, true, 3.33);
  const mid = egFightState(F, T0 + 2333).b.find((t) => t[0] === fl.i);
  assert.ok(mid[13] !== fl.y && mid[13] !== 3.33, 'a climb said mid-way');
  for (const t of egFightState(F, T0 + 2333).b) for (const v of t.slice(13, 15)) assert.ok(cmExact(v), `a height in whole centimetres (${v})`);
  assert.equal(egWalkY({ x: 1, z: 1, tx: 1, tz: 1, v: 2, at: T0, y: 0, ty: 3 }, T0 + 1), 3, 'a walk of no length: at its end\'s height at once');
  // a standing body whose ground moves under it (a stair's top reached, a lip stepped off) is said again where it stands
  egStop(F, fl, T0 + 2400);
  n0 = F.moves.length;
  egWalk(F, fl, fl.x, fl.z, 0, 5, T0 + 2500, court, 0, true, fl.y + EG_Y_RESAY_M + 0.1);
  assert.equal(F.moves.length, n0 + 1, 'its height\'s word, though it walks nowhere');
  // a ground body's walk without a height of its own ends on the ground under its goal - by the band, else the lowest there
  const P2 = egFightNew(spec, T0, [40]), g = egBodyNew(P2, EG_ROLE.add, EG_KIND.breaker, low.x, low.z, 10, { now: T0 });
  egWalk(P2, g, rim[0], rim[1], 0, 2, T0, spec);
  assert.deepEqual(P2.moves.at(-1).slice(7, 9), [q.y0, q.y1], 'past the floor\'s rim: its walk ends on the balcony');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  // THE LEGION ON THE GRAPH (net/eliteGates/egLegion.js): a Sapper climbs the stair and steps off the balcony's lip - its walks up the stair
  // from the floor's height to the balcony's, and off the lip at the floor's at once (a drop, never a glide)
  const ro = [], L2 = egFightNew(spec, T0, [40]), [sap] = egLegionRaise(L2, [EG_KIND.sapper], [[low.x, low.z]], T0, ro);
  let S2 = foldEg(EG_STATE_EMPTY, wired(ro[0]), T0);   // a screen hearing its words
  const climbSeen = [];
  const lip = egPortalOf(low, high), ux = (low.x - high.x) / Math.hypot(low.x - high.x, low.z - high.z), uz = (low.z - high.z) / Math.hypot(low.x - high.x, low.z - high.z);
  let goal = [rim[0], rim[1], 1.6], t = T0;
  const said = [], walkTo = (until) => {
    for (; t < T0 + 120_000 && !until(); t += 250) { egCarry(L2, t); egLegionStep(L2, view, t, [], () => 0.5, [], { sapGoal: () => goal, sapAt: () => {} }); const o = []; egMovesOut(L2, o); said.push(...o.flatMap((f) => f.m)); for (const f of o) { S2 = foldEg(S2, wired(f), t); if (f.m.some((m) => m[0] === sap.i && m[7] === q.y0 && m[8] === q.y1)) climbSeen.push([egBodyHeight(S2.fight.bodies.find((b) => b.i === sap.i), t + 1000), egWalkY(sap.mv, t + 1000)]); } }
  };
  walkTo(() => Math.hypot(sap.x - rim[0], sap.z - rim[1]) <= 1.6);
  assert.equal(sap.y, q.y1, 'up on the balcony');
  assert.ok(said.some((m) => m[7] === q.y0 && m[8] === q.y1), 'by the stair: a walk from the floor\'s height to the balcony\'s');
  assert.ok(climbSeen.length > 0 && climbSeen.every(([s, r]) => near(s, r, 1e-9) && s > q.y0 && s < q.y1), `the screen draws it climbing as the room holds it (${climbSeen.map((p) => p.join('/'))})`);
  const climb = said.length;
  goal = [lip[0] + ux * 2 - uz * 3, lip[1] + uz * 2 + ux * 3, 1.6];   // under the lip, aside: off the lip is the short way down
  walkTo(() => Math.hypot(sap.x - goal[0], sap.z - goal[1]) <= 1.6);
  const down = said.slice(climb), first = down.findIndex((m) => m[8] === q.y0);
  assert.ok(first >= 0 && sap.y === q.y0, 'down on the floor');
  assert.equal(down[first][7], q.y0, 'off the lip at the floor\'s height at once - a drop, never a glide');
  assert.ok(down.every((m) => [q.y0, q.y1].includes(m[7]) && [q.y0, q.y1].includes(m[8])), 'every walk on one floor or the other');
  // THE FLIERS AT THEIR MARK'S HEIGHT: a Wraith coming and tethered, a Diver circling, a Shade at its slayer, a Harrier hunting
  // a member held high over the floor on no ground - each flies at the member's own feet, never the floor under its way
  const high4 = q.y1 + 4.004, mark = { sub: 'acct-0', x: low.x + 3, z: low.z, y: high4 }, at4 = Math.round(high4 * 100) / 100;
  const off = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dz]) => [low.x + dx * (low.r + 3), low.z + dz * (low.r + 3)]).find(([x, z]) => !egGroundAt(view, x, NaN, z, 0.5));   // a hunter off every fight floor
  const fly = (k, setup, ctx = {}) => {
    const A = egFightNew(spec, T0, [40]), [a] = egLegionRaise(A, [k], [[low.x - 6, low.z]], T0, []);
    a.up = T0; setup?.(A, a);
    const words = [];
    for (let tt = T0 + 250; tt < T0 + 3000; tt += 250) { egCarry(A, tt); egLegionStep(A, view, tt, [mark], () => 0.5, [], ctx); const o = []; egMovesOut(A, o); words.push(...o.flatMap((f) => f.m).filter((m) => m[0] === a.i && m[5] > 0)); }
    return words;
  };
  for (const [k, name, setup, ctx] of [[EG_KIND.wraith, 'a Wraith coming'], [EG_KIND.wraith, 'a Wraith tethered', (A, a) => { a.x = low.x + 1; A.tethers.push([a.i, 'acct-0', 0, 810]); }], [EG_KIND.diver, 'a Diver circling', (A, a) => { a.next = T0 + 60_000; }],
    [EG_KIND.shade, 'a Shade at its slayer', (A, a) => { a.tg = 'acct-0'; a.burstAt = T0 + 60_000; }], [EG_KIND.harrier, 'a Harrier hunting', (A, a) => { [a.x, a.z] = off; }, { hunted: [mark] }]]) {
    const words = fly(k, setup, ctx);
    const air = ctx?.hunted ? words.slice(0, 1) : words;   // a hunter flies, then walks the graph to the floor's edge nearest them (EG-ZB)
    assert.ok(air.length > 0 && air.every((m) => m[8] === at4), `${name}: at the member's own height (${words.map((m) => m[8])})`);
  }
  const { s: ram } = findSpec((s) => s.kind === 'rampart' && s.discs.some((d) => d.role === 'pillar' && egFeetAt(egFightView(s), d.x, d.z) !== d.y));
  const pil = ram.discs.find((d) => d.role === 'pillar' && egFeetAt(egFightView(ram), d.x, d.z) !== d.y), rv = egFightView(ram);
  const c = { x: pil.x, z: pil.z, y: pil.y, r: 0.6 };
  egWalkNext(rv, c, pil.x + 0.5, pil.z, pil.y, 0.6);
  assert.deepEqual(egWalkFeet(rv, c), [pil.y, pil.y], 'a Caster on its pillar stands on the pillar, never the bastion under its plan');
});

/** Every body row a frame list said (`ead`, `efs`) and every walk (`emv`). */
const rowsOf = (frames) => frames.flatMap((f) => (f.k === 'ead' ? f.a : f.k === 'efs' ? f.b : []));
const walksOf = (frames) => frames.flatMap((f) => (f.k === 'emv' ? f.m : []));
/** The lords that fly (their hover is their look's, over the ground they keep). */
const EG_LORDS_FLY = new Set(Object.values(EG_LORDS).filter((L) => L.fly).map((L) => L.key));
/** A Court laid above the hall's own height, every floor of it, its lord a walker. */
const groundCourt = () => findSpec((q) => q.kind === 'court' && q.fl.length > 0 && q.fl.every((f) => f.y > 1) && !EG_LORDS_FLY.has(q.lord));

test('EG-ZJ EVERY BODY ON ITS FEET, BY THE DIRECTOR (section 23; EG-ZB\'s departure 3 closed): a Court laid above the hall\'s own height says its lord, its objects and its legion on that floor and every walk over it; a woken room\'s restored fight raises on that floor from its first beat; a span\'s shadows rise at the height of the member they shadow down a course that has dropped, and fly at it - to another platform\'s height when the company moves; from the Shade the Divers rise and circle at the island ahead\'s height; a Deepway\'s Lurkers stand on the floor past its shaft and a false wall on its alcove\'s - every row eighteen, every walk nine, every height whole centimetres (mutants: the rows\' height dropped; a restored fight raising at the hall\'s 0; the shadows\' flight at their own height; the Divers at nought; the shadows at the plates\' height; the alcove\'s floor ignored; the walk\'s height off the wire)', () => {
  // a Court above the hall's 0
  const { seed: cs, s: court } = groundCourt();
  const fy = new Set(court.fl.map((f) => f.y));
  const C = breachAt(cs, court.h);
  for (const sub of ['acct-0', 'acct-1']) C.at(sub, court.ring.x, court.ring.z, court.fl[0].y);
  for (let k = 0; k < 80 && !C.B.F.bodies.some((b) => b.role === EG_ROLE.lord && b.up2); k++) C.step();
  for (let k = 0; k < 120; k++) C.step();
  const rows = rowsOf(C.frames), walks = walksOf(C.frames);
  assert.ok(rows.some((t) => t[1] === EG_ROLE.lord) && walks.length > 0, 'its lord stood and walking');
  for (const t of rows) { assert.equal(t.length, 19); assert.ok(fy.has(t[13]) && fy.has(t[14]), `a ${['lord', 'add', 'object'][t[1]]} on the Court's floor (${t[13]}), never the hall's 0`); }
  for (const m of walks) { assert.equal(m.length, 10); assert.ok(fy.has(m[7]) && fy.has(m[8]), `a walk over the floor (${m[7]} to ${m[8]})`); }   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  // a woken room: its fight restored from storage keeps no hall, and from its first beat stands what it raises on the floor
  const R = structuredClone(C.B), rpos = (t) => ['acct-0', 'acct-1'].map((sub) => ({ sub, ...C.pos[sub], dead: false, at: t }));
  assert.equal(R.F.view, undefined, 'storage keeps no hall');
  let rnow = C.now(), rs = 99;
  const rrng = () => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs / 4294967296; };
  const after = [];
  for (let k = 0; k < 160 && !after.length; k++) { rnow += 250; after.push(...egStep(R, rnow, rpos(rnow), rrng).filter((f) => f.k === 'ead').flatMap((f) => f.a)); }
  assert.ok(after.length > 0 && after.every((t) => fy.has(t[13])), `risen after the restore on the Court's floor (${after.map((t) => t[13])})`);
  // a span whose course has dropped: its shadows at their member's height
  const { seed: ss, s: span } = findSpec((q) => q.kind === 'span' && q.band === 0 && q.steps.some((p) => p.kind === 'still' && Math.abs(p.y - (q.arrive.y ?? 0)) > 2));
  const plat = span.steps.find((p) => p.kind === 'still' && Math.abs(p.y - (span.arrive.y ?? 0)) > 2);
  const S = breachAt(ss, span.h);
  for (const sub of ['acct-0', 'acct-1']) S.at(sub, plat.x, plat.z, plat.y);
  for (let k = 0; k < 60; k++) S.step();
  const shadows = rowsOf(S.frames).filter((t) => t[1] === EG_ROLE.add && t[2] === EG_KIND.harrier);
  assert.ok(shadows.length >= 2, 'the shadows rose');
  for (const t of shadows) assert.equal(t[13], Math.round(plat.y * 100) / 100, 'at their member\'s height on the platform, never the plates\'');
  const theirs = new Set(shadows.map((t) => t[0])), flew = walksOf(S.frames).filter((m) => theirs.has(m[0]) && m[5] > 0);
  assert.ok(flew.length > 0 && flew.every((m) => m[8] === Math.round(plat.y * 100) / 100), 'and fly at it');
  const sv = egFightView(span), plat2 = span.steps.find((p) => p.kind === 'still' && Math.abs(p.y - plat.y) > 2 && !egGroundAt(sv, p.x, p.y, p.z, 1));
  for (const sub of ['acct-0', 'acct-1']) S.at(sub, plat2.x, plat2.z, plat2.y);
  const n1 = S.frames.length;
  for (let k = 0; k < 20; k++) S.step();
  const later = walksOf(S.frames.slice(n1)).filter((m) => theirs.has(m[0]) && m[5] > 0);
  assert.ok(later.length > 0 && later.at(-1)[8] === Math.round(plat2.y * 100) / 100, `the company on another platform: they fly to its height (${later.at(-1)?.[8]} for ${plat2.y})`);
  // from the Shade, the Divers rise over the island ahead at its height, and circle it there
  const ahead = (q, p) => egIsleAhead(egFightView(q).fl.filter((f) => f.g === 'island' || f.g === 'plate'), p.z);
  const { seed: hs, s: shade } = findSpec((q) => q.kind === 'span' && q.band === 2 && q.steps.some((p) => p.road === 0 && p.kind === 'still' && ahead(q, p) && Math.abs(ahead(q, p).y) > 1 && Math.abs(ahead(q, p).y - p.y) > 1));
  const hp = shade.steps.find((p) => p.road === 0 && p.kind === 'still' && ahead(shade, p) && Math.abs(ahead(shade, p).y) > 1 && Math.abs(ahead(shade, p).y - p.y) > 1), isle = ahead(shade, hp);
  const H = breachAt(hs, shade.h);
  for (const sub of ['acct-0', 'acct-1']) H.at(sub, hp.x, hp.z, hp.y);
  for (let k = 0; k < 26; k++) H.step();
  const divers = rowsOf(H.frames).filter((t) => t[1] === EG_ROLE.add && t[2] === EG_KIND.diver);
  assert.ok(divers.length > 0 && divers.every((t) => t[13] === isle.y), `the Divers over the island ahead at its height (${isle.y}), never their member's (${hp.y})`);
  const dset = new Set(divers.map((t) => t[0])), circled = walksOf(H.frames).filter((m) => dset.has(m[0]) && m[5] > 0);
  assert.ok(circled.length > 0 && circled.every((m) => m[8] === isle.y), 'circling it there');
  // a Deepway: its Lurkers on the floor past its shaft, a false wall on its alcove's floor
  const { seed: ds, s: deep } = findSpec((q) => q.kind === 'deepway' && (q.alcoves ?? []).some((a) => a.seal === 'seam' && a.y < -1) && (q.spots.lurker ?? []).some((p) => egFeetAt(egFightView(q), p.x, p.z) < -1), 60);
  const D = breachAt(ds, deep.h), dv = egFightView(deep);
  const lurks = rowsOf(D.frames).filter((t) => t[1] === EG_ROLE.add && t[2] === EG_KIND.lurker);
  assert.ok(lurks.some((t) => t[13] < -1), 'a Lurker past the shaft');
  for (const t of lurks) assert.equal(t[13], egFeetAt(dv, t[4], t[5]), 'each on the floor under it');
  const al = deep.alcoves.find((a) => a.seal === 'seam' && a.y < -1), wall = rowsOf(D.frames).find((t) => t[1] === EG_ROLE.obj && t[2] === EG_OBJ.fwall && t[3] === al.i);
  assert.ok(wall && wall[13] === al.y, `the false wall on its alcove's floor (${wall?.[13]} at ${al.y})`);
  // a Rampart's pinned Casters stand on their pillars' tops - over a bastion too, never the floor its plan shares
  const shared = (s, p) => egFeetAt(egFightView(s), p.x, p.z) !== s.discs.find((d) => d.role === 'pillar' && Math.hypot(d.x - p.x, d.z - p.z) < 0.01)?.y;   // a pillar whose plan shares a lower floor's
  const { seed: rs2, s: ram } = findSpec((s) => s.kind === 'rampart' && s.variant !== 'gauntlet' && (s.spots.pillar ?? []).slice(0, 2).some((p) => shared(s, p)));   // among the two a company of two is given
  const RA = breachAt(rs2, ram.h), casters = rowsOf(RA.frames).filter((t) => t[1] === EG_ROLE.add && t[2] === EG_KIND.caster);   // its wake's: the pinned ones
  const pillarY = (t) => ram.discs.find((d) => d.role === 'pillar' && Math.hypot(d.x - t[4], d.z - t[5]) <= d.r)?.y;
  assert.ok(casters.length > 0 && casters.every((t) => t[13] === pillarY(t) && t[13] > 1), `each Caster on its pillar's top (${casters.map((t) => `${t[13]}/${pillarY(t)}`)})`);
  // the wire: a row of nineteen and a walk of ten, their heights in the hall's bounds, a state in its own
  const row0 = rowsOf(C.frames)[0], efs0 = { k: 'efs', h: court.h, wk: T0, b: [row0], bl: [], tx: [], mk: [], pg: {} };
  assert.ok(validEgOut(efs0));
  assert.equal(validEgOut({ ...efs0, b: [[...row0.slice(0, 13), 401, ...row0.slice(14)]] }), null, 'feet past the hall\'s bound');   // PIN MOVED (EG-ZQ): each a row of eighteen; PIN MOVED (AUDIT EG V, b: a row of nineteen - its facing kept, so only the bound refuses it)
  assert.equal(validEgOut({ ...efs0, b: [[...row0.slice(0, 14), -401, ...row0.slice(15)]] }), null, 'a walk\'s end past it');
  assert.equal(validEgOut({ ...efs0, b: [[...row0.slice(0, 15), 100, ...row0.slice(16)]] }), null, 'a state past its bound');
  assert.equal(validEgOut({ ...efs0, zs: [{ i: 1, kind: 'lava', s: ['d', 0, 0, 3], from: T0, until: T0 + 1, p: 0, b: 0, el: null }] }), null, 'a zone the wire does not know');
  const mv0 = walks[0];
  assert.ok(validEgOut({ k: 'emv', m: [mv0] }));
  assert.equal(validEgOut({ k: 'emv', m: [[...mv0.slice(0, 7), 999, ...mv0.slice(8)]] }), null, 'a walk\'s height past the hall\'s bound');   // PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
  assert.equal(validEgOut({ k: 'emv', m: [[...mv0.slice(0, 8), -999, mv0[9]]] }), null, 'its end\'s');
  for (const t of [...rowsOf(D.frames), ...rowsOf(S.frames)]) for (const v of t.slice(13, 15)) assert.ok(cmExact(v), `whole centimetres (${v})`);
  for (const m of [...walksOf(D.frames), ...walksOf(S.frames)]) for (const v of m.slice(7)) assert.ok(cmExact(v), `whole centimetres (${v})`);
});

test('EG-ZJ THE LORDS\' WALKS ON THE SEAM CARRY THEIR FEET (EG5 + EG-ZK\'s lordWalk over net/eliteGates/egLegion.js walkGraph, merged; sections 11.7 and 23): Grath woken on his islands laid above the hall\'s height hunts the company over his bridges to the island he is not on, and every walk and place the frames say for him - his straight walks on an island, his walks along the graph, his Leap\'s landing - is at the islands\' height, never the hall\'s 0; the Proving Walk\'s Kynmarcher walks to its stair\'s foot at its floor\'s height, climbs with its walk ending on the floor 4 m up - its top reached though a blow stopped it short on the stair, its feet that floor\'s as a legion walker\'s are, and it walks there at that height - its row in the whole fight, as the seam says it, on that floor (mutants: a lord\'s straight walk at the hall\'s 0; its top reached, its feet left on the stair)', () => {
  // Grath on his islands, above the hall's 0
  const { seed: gs, s: gc } = findSpec((q) => q.kind === 'court' && q.lord === 'hound' && q.fl.every((f) => f.y > 1));
  const gy = gc.fl[0].y;
  assert.ok(gc.fl.every((f) => f.y === gy), 'his islands and bridges at one height');
  const G = breachAt(gs, gc.h), L = G.B.F.bodies.find((b) => b.role === EG_ROLE.lord);
  assert.equal(L.key, 'hound');
  for (const sub of ['acct-0', 'acct-1']) G.at(sub, gc.ring.x, gc.ring.z, gy);
  for (let k = 0; k < 80 && !L.up2; k++) G.step();
  assert.ok(L.up2, 'he woke');
  const isleOf = (x, z) => gc.spots.isle.findIndex((s) => Math.hypot(x - s.x, z - s.z) <= 11);
  const far = gc.spots.isle.filter((s, j) => j !== isleOf(L.x, L.z)).sort((a, b) => Math.hypot(b.x - L.x, b.z - L.z) - Math.hypot(a.x - L.x, a.z - L.z))[0];
  G.at('acct-0', far.x, far.z, gy); G.at('acct-1', far.x + 1, far.z, gy);
  const g0 = G.frames.length, from = isleOf(L.x, L.z);
  for (let k = 0; k < 240; k++) G.step();
  const his = walksOf(G.frames.slice(g0)).filter((m) => m[0] === L.i);
  assert.ok(his.some((m) => m[5] > 0) && isleOf(L.x, L.z) !== from, `he came over to their island (${L.x}, ${L.z})`);
  const bridgeEnd = (x, z) => gc.spots.bridge.some((e) => Math.hypot(x - e.x, z - e.z) < 2 || Math.hypot(x - e.bx, z - e.bz) < 2);
  assert.ok(his.some((m) => m[5] > 0 && bridgeEnd(m[3], m[4])), 'along a bridge, by its ends');
  for (const m of walksOf(G.frames).filter((w) => w[0] === L.i)) assert.ok(m[7] === gy && m[8] === gy, `his walk at his islands' height (${m[7]} to ${m[8]})`);
  for (const t of rowsOf(G.frames).filter((r) => r[0] === L.i)) assert.ok(t[13] === gy && t[14] === gy, `his row at it (${t[13]})`);
  assert.equal(egFightStateOf(G.B, G.now()).b.find((t) => t[0] === L.i)[13], gy, 'the whole fight says him there');
  // a champion up a chamber's stair
  const S = breachAt(31337, 43, { n: 1 }), K = S.B.F.bodies.find((b) => b.role === EG_ROLE.lord), q = S.spec.ramps[0], up = S.spec.fl.find((f) => f.t === 'd' && f.y > 3);
  assert.ok(K.key === 'kynmarcher' && q && up, 'the champion, its stair and the floor above');
  const low = egFeetAt(egFightView(S.spec), K.x, K.z);
  // PIN MOVED (AUDIT EG IV, lane1 #11): a Proving Walk's champion wakes at its court's ring - the member steps in at its heart first,
  // a beat, then goes up (before, the champion woke with the hall)
  const ring = champRing(S.spec);
  S.at('acct-0', ring.x, ring.z, 0); S.step();
  assert.ok(K.up2, 'the champion woke at its ring');
  S.at('acct-0', up.x + 3.5, up.z, up.y);
  const s0 = S.frames.length;
  for (let k = 0; k < 60; k++) S.step();
  const kw = walksOf(S.frames.slice(s0)).filter((m) => m[0] === K.i && m[5] > 0);
  const foot = kw.find((m) => m[3] === q.ax && m[4] === q.az), climb = kw.find((m) => m[3] === q.bx && m[4] === q.bz);
  assert.ok(foot && foot[7] === low && foot[8] === low, `to the stair's foot on its floor (${foot?.slice(7)} at ${low})`);
  const climbs = kw.filter((m) => m[3] === q.bx && m[4] === q.bz);
  assert.ok(climb && climbs.every((m, j) => m[8] === up.y && m[7] >= (j ? climbs[j - 1][7] : low) && m[7] < up.y), `up the stair from its feet on it, rising, its walk ending on the floor above (${climbs.map((m) => m.slice(7))} for ${up.y})`);
  // its top reached (within a node's reach, though a blow stopped it short on the stair), its feet are that floor's, as a
  // legion walker's are: every walk on the floor above at its height from its first step
  const above = kw.filter((m) => !(m[3] === q.bx && m[4] === q.bz) && Math.hypot(m[3] - up.x, m[4] - up.z) <= up.r);
  assert.ok(above.length > 0 && above.every((m) => m[7] === up.y && m[8] === up.y), `on the floor above, at its height (${above.map((m) => m.slice(7))})`);
  assert.equal(egFightStateOf(S.B, S.now()).b.find((t) => t[0] === K.i)[13], up.y, 'the whole fight says it there');
});

/** A fight on the screen over a link's state (`state()`) at `clock.t` - the renderer's batches and the texture door stood in, its 3D sounds
 *  heard (`heard`). */
function screen(state, clock, heard = []) {
  const renderer = { createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 0] }), destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const audio = { play3d: (clip, at, vol, o) => heard.push({ clip, at: [...at], pitch: o?.pitch }), play3dId: () => {}, playOneShot: () => {} };
  return createEgFight({ renderer, getTexture, audio, link: { state }, now: () => clock.t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0' });
}

test('EG-ZJ EVERY BODY DRAWN WHERE IT STANDS (scenes/eliteGates/egFight.js; section 11.7): a Court\'s lord laid above the hall\'s height drawn and struck at on its floor; a false wall\'s crystal on its alcove\'s floor past a Deepway\'s shaft; a walker up a stair drawn climbing it, its height carried from its word (mutants: the body at the hall\'s height; the crystal at the hall\'s height; the walk\'s height uncarried)', async () => {
  const { seed: cs, s: court } = groundCourt();
  const C = breachAt(cs, court.h), clock = { t: C.now() };
  const lord = C.B.F.bodies.find((b) => b.role === EG_ROLE.lord);
  let E = C.seen();
  const heard = [], fight = screen(() => E, clock, heard), centre = egHallCentre(court);
  fight.frame(); await new Promise((r) => setTimeout(r, 0));
  clock.t += 50; fight.frame();
  const tg = fight.hostTargets().find((q) => q.i === lord.i);
  assert.ok(tg, 'the lord a body my blows meet');
  assert.ok(near(tg.feet[1], centre[1] + lord.y, 1e-6) && lord.y > 1, `on its Court's floor (${tg.feet[1] - centre[1]} over the hall's height, the floor ${lord.y})`);
  const batch = fight.batches().find((b) => near(b.origin[0], tg.feet[0]) && near(b.origin[2], tg.feet[2]));
  assert.ok(batch && near(batch.origin[1], centre[1] + lord.y, 1e-6), 'drawn there');
  // woken, it roars from its own height; wounded into its second phase, it growls from there
  for (const sub of ['acct-0', 'acct-1']) C.at(sub, court.ring.x, court.ring.z, court.fl[0].y);
  for (let k = 0; k < 80 && !lord.up2; k++) C.step();
  E = C.seen(); clock.t = C.now(); fight.frame();
  const roar = heard.find((s) => s.pitch === BOSS_CUES.roar.pitch);
  assert.ok(roar && near(roar.at[1], centre[1] + lord.y + 3, 1e-6), `the wake's roar from its height (${roar?.at[1] - centre[1]})`);
  lord.hp = Math.floor(lord.max * 0.5);
  for (let k = 0; k < 4 && lord.ph < 2; k++) C.step();
  E = C.seen(); clock.t = C.now(); fight.frame();
  const growl = heard.find((s) => s.pitch === BOSS_CUES.growl.pitch);
  assert.ok(growl && near(growl.at[1], centre[1] + egBodyHeight(E.fight.bodies.find((b) => b.i === lord.i), clock.t) + 3, 1e-6), 'its phase\'s growl from there');
  // a false wall's crystal past a Deepway's shaft
  const { seed: ds, s: deep } = findSpec((q) => q.kind === 'deepway' && (q.alcoves ?? []).some((a) => a.seal === 'seam' && a.y < -1), 60);
  const D = breachAt(ds, deep.h), dfight = screen(D.seen, { t: D.now() }), dcentre = egHallCentre(deep);
  dfight.frame();
  const al = deep.alcoves.find((a) => a.seal === 'seam' && a.y < -1), wall = D.B.F.bodies.find((b) => b.t === 'fwall' && b.alc === al.i);
  const wt = dfight.hostTargets().find((q) => q.i === wall.i);
  assert.ok(wt && near(wt.feet[1], dcentre[1] + al.y, 1e-6), `its crystal on its alcove's floor (${wt?.feet[1] - dcentre[1]} at ${al.y})`);
  // a walk's height carried on the screen: up a stair, half way half the climb
  const { s: hall } = findSpec((q) => (q.ramps ?? []).length > 0), r = hall.ramps[0];
  const F = egFightNew(hall, T0, [40]), w = egBodyNew(F, EG_ROLE.add, EG_KIND.breaker, r.ax, r.az, 10, { now: T0 });
  egWalk(F, w, r.bx, r.bz, 0, 2, T0, hall, 0, true, r.y1);
  const seen = egBodyOf(egBodyWire(w), T0), half = T0 + (Math.hypot(r.bx - r.ax, r.bz - r.az) / 2 / 2) * 1000;
  assert.ok(near(egBodyHeight(seen, half), (r.y0 + r.y1) / 2, 1e-6), 'half way up, half the climb');
  assert.equal(egBodyHeight(seen, T0 + 60_000), r.y1, 'at the top, on the balcony');
  assert.deepEqual(egBodyPlace(seen, T0 + 60_000), [r.bx, r.bz]);
});

/** What a member joining at `now` is handed by its hello (server/src/index.js _egHello): the breach's `st` and the whole fight,
 *  through the wire, folded on an empty screen. */
const joinerAt = (B, now) => [egStateOf(B, now), egFightStateOf(B, now)].reduce((s, w) => foldEg(s, wired(w), now), EG_STATE_EMPTY);
/** The screen's fight against the room's, body by body at `now`: its place and feet, its state as said (an object's, a lord's
 *  phase and fall), its health and flags; the zones still burning, the tethers and the marks. */
function sameFight(S, B, now, who) {
  const F = B.F, live = (F.zones ?? []).filter((z) => z.until > now);
  assert.deepEqual(S.fight.bodies.map((b) => b.i).sort((a, b) => a - b), F.bodies.map((b) => b.i).sort((a, b) => a - b), `${who}: every body`);
  for (const rb of F.bodies) {
    const b = S.fight.bodies.find((q) => q.i === rb.i), [x, z] = egBodyAt(rb, now), [sx, sz] = egBodyPlace(b, now);
    assert.ok(Math.hypot(sx - x, sz - z) <= 0.015, `${who}: body ${rb.i} where the room holds it (${Math.hypot(sx - x, sz - z).toFixed(3)} m off)`);
    assert.ok(Math.abs(egBodyHeight(b, now) - (rb.mv ? egWalkY(rb.mv, now) : rb.y)) <= 0.006, `${who}: body ${rb.i} on its feet`);
    assert.deepEqual([b.hp, b.fl], [Math.ceil(rb.hp), rb.fl | 0], `${who}: body ${rb.i}'s health and flags`);
    if (rb.role === EG_ROLE.obj) assert.deepEqual([b.st, b.stAt], [rb.ws ?? 0, rb.wsAt ?? 0], `${who}: object ${rb.i}'s state as said`);
    if (rb.role === EG_ROLE.lord) assert.deepEqual([b.ph, b.fellAt ?? 0], [rb.up2 ? rb.ph : 0, rb.fellAt ?? 0], `${who}: the lord's phase and fall`);
  }
  assert.deepEqual(S.fight.zones.filter((z) => z.until > now).map((z) => [z.i, z.kind, z.until]).sort((a, b) => a[0] - b[0]), live.map((z) => [z.i, z.kind, z.until]).sort((a, b) => a[0] - b[0]), `${who}: the zones still burning`);
  assert.deepEqual([S.fight.tx, S.fight.mk], [F.tethers, F.marks], `${who}: the tethers and the marks`);
}

test('EG-ZJ THE JOINER\'S STATE (section 22; layer three\'s look departure closed): mid-fight in Grath\'s Court - his island cracked, then fallen under him with its void burning, then risen, then in his second phase - a member who joins or reloads is handed the fight whole - every body where the room holds it and on its feet, each island\'s state and its fall\'s instant, Grath\'s phase, the void, the tethers and the marks - the fight the company holds, word for word; the lord\'s bar shows from the wake, never before it; the whole fight said again every two seconds never stands its bodies anew (no add rises twice, no island stands again) and walks each from where it is; a fallen lord lies down at its flags, raised again it stands; every object\'s state word said through egObSay (a sweep) (mutants: an island\'s crack, fall or rise unkept; a phase unkept; a fall\'s instant unkept; no zones in the whole fight; the objects\' state unsaid; a joiner\'s island standing; the lord\'s phase lost; every add rising again; the walk\'s head start kept; a fallen lord standing)', () => {
  // Grath's Court (the law's): the company wakes him in his ring and stands on the island across from his
  const { seed, s: spec } = findSpec((q) => q.kind === 'court' && q.lord === 'hound');
  const G = breachAt(seed, spec.h), fy = spec.fl[0].y;
  assert.equal(egLordBar(G.seen()), null, 'asleep: no bar');
  for (const sub of ['acct-0', 'acct-1']) G.at(sub, spec.ring.x, spec.ring.z, fy);
  for (let k = 0; k < 80 && !G.B.F.bodies.some((b) => b.role === EG_ROLE.lord && b.up2); k++) G.step();
  const L = G.B.F.bodies.find((b) => b.role === EG_ROLE.lord), isles = G.B.F.bodies.filter((b) => b.t === 'isle');
  const far = [...isles].sort((a, b) => Math.hypot(b.x - L.x, b.z - L.z) - Math.hypot(a.x - L.x, a.z - L.z))[0];
  for (const sub of ['acct-0', 'acct-1']) G.at(sub, far.x, far.z, fy);
  const crackOf = () => G.frames.find((f) => f.k === 'eob' && f.st === 1);
  for (let k = 0; k < 800 && !crackOf(); k++) G.step();
  assert.ok(crackOf(), 'Grath leapt, and the island he left cracked');
  const cracked = crackOf().at;
  for (let k = 0; k < 4; k++) G.step();   // a second on, the island still cracked
  const crack = isles.find((o) => o.ws === 1);
  assert.deepEqual([crack.ws, crack.wsAt], [1, cracked], 'the room keeps it cracked, since its word');
  sameFight(joinerAt(G.B, G.now()), G.B, G.now(), 'a joiner while it cracks');
  sameFight(G.seen(), G.B, G.now(), 'the company while it cracks');
  let fell = 0;
  for (let k = 0; k < 800 && !fell; k++) if (G.step().some((f) => f.k === 'eob' && f.st === 2)) fell = G.now();
  assert.ok(fell, 'and fell');
  for (let k = 0; k < 9; k++) G.step();   // past the next whole fight
  assert.equal(egLordBar(G.seen())?.phase, 'I', 'awake: the lord\'s bar from his first phase');
  const now = G.now(), J = joinerAt(G.B, now), down = isles.find((o) => o.ws === 2);
  assert.deepEqual([down.ws, down.wsAt], [2, fell], 'the room keeps the island fallen, since its word');
  assert.ok((G.B.F.zones ?? []).some((z) => z.kind === 'void' && z.until > now), 'its void burning');
  sameFight(J, G.B, now, 'the joiner');
  sameFight(G.seen(), G.B, now, 'the company');
  const jd = J.fight.bodies.find((b) => b.i === down.i);
  assert.deepEqual([jd.st, jd.stAt], [2, fell], 'the joiner sees the island fallen, falling since it fell');
  assert.ok(J.fight.zones.some((z) => z.kind === 'void'), 'and its void - its own feet judged by it');
  assert.ok(J.fight.bodies.every((b) => b.born === 0), 'a joiner\'s bodies stood all along: none rises');
  // the island rises again 15 s on: said, and a joiner sees it standing since then
  let rose = 0;
  for (let k = 0; k < 120 && !rose; k++) if (G.step().some((f) => f.k === 'eob' && f.st === 0 && f.i === down.i)) rose = G.now();
  assert.ok(rose && down.ws === 0 && down.wsAt === rose, 'risen again, since its word');
  for (let k = 0; k < 9; k++) G.step();
  sameFight(joinerAt(G.B, G.now()), G.B, G.now(), 'a joiner after it rose');
  // Grath wounded past his first threshold: his second phase, on every screen and a joiner's
  L.hp = Math.floor(L.max * 0.5);
  for (let k = 0; k < 9; k++) G.step();
  assert.equal(L.ph, 2, 'his second phase');
  assert.equal(egLordBar(G.seen())?.phase, 'II');
  sameFight(joinerAt(G.B, G.now()), G.B, G.now(), 'a joiner in his second phase');
  assert.equal(egLordBar(joinerAt(G.B, G.now()))?.phase, 'II', 'a joiner\'s bar says it at once');
  // a fallen lord lies down at its flags; raised again it stands; a joiner sees it lying since its fall
  const out = [];
  const tf = G.now();
  L.hp = 0; egLordHit(G.B.F, spec, L, 'acct-0', 'M0', 0, null, tf, [], out);   // Grath falls (the producer's own fall: its flags, its word)
  const efl = out.find((f) => f.k === 'efl' && f.i === L.i), raise = [];
  let E = foldEg(G.seen(), wired(efl), tf + 10);   // a Twin's first fall says its flags alone (no efell)
  assert.equal(E.fight.bodies.find((b) => b.i === L.i).fellAt, tf + 10, 'its flags fallen: it lies');
  assert.equal(joinerAt(G.B, tf + 20).fight.bodies.find((b) => b.i === L.i).fellAt, tf, 'a joiner: lying since its fall');
  egSetFl(G.B.F, L, EG_FL.fell, false, raise);   // raised again (the Twins' fifteen seconds)
  E = foldEg(E, wired(raise[0]), tf + 30);
  assert.equal(E.fight.bodies.find((b) => b.i === L.i).fellAt, undefined, 'raised again: it stands');
  // a yard's legion: the whole fight every two seconds keeps each add's rise, and walks it from where it is
  const Y = breachAt(12345, 1);
  for (let k = 0; k < 60 && !Y.B.F.bodies.some((b) => b.role === EG_ROLE.add); k++) Y.step();
  const risen = new Map(Y.seen().fight.bodies.filter((b) => b.role === EG_ROLE.add).map((b) => [b.i, b.born]));
  assert.ok(risen.size > 0 && [...risen.values()].every((t) => t > 0), 'the legion rose, each heard rising');
  // one of them hurt (the room's word) and struck by my own blow (the screen's memory - scenes/eliteGates/egFight.js hostHit): both kept
  const [hi] = risen.keys(), hb = Y.B.F.bodies.find((b) => b.i === hi), ho = [];
  hb.hp -= 1; egHpOut(Y.B.F, Y.now(), ho, true);
  for (const f of ho) Y.fold(f);
  const mine = Y.now() - 5;
  Y.seen().fight.bodies.find((b) => b.i === hi).mineAt = mine;
  const hurt = Y.seen().fight.bodies.find((b) => b.i === hi).hurtAt;
  assert.equal(hurt, Y.now(), 'hurt, heard');
  let ahead = 0;
  const ys = Y.spec, yc = ys.fight;
  for (let k = 0; k < 48; k++) {
    if (k % 6 === 0) for (const [j, sub] of ['acct-0', 'acct-1'].entries()) Y.at(sub, yc.x + (k % 12 ? 8 : -8) + j, yc.z + 6, ys.fl[0].y ?? 0);   // the company moving, so the legion walks
    const o = Y.step(), efs = o.find((f) => f.k === 'efs');
    if (!efs) continue;
    const t = Y.now(), S = Y.seen();
    for (const [i, born] of risen) { const b = S.fight.bodies.find((q) => q.i === i); if (b) { assert.equal(b.born, born, 'its rise kept'); assert.notEqual(egBodyAct(b, t, 1, null, 0.9).act, 'rise', 'never rising again'); } }
    const hk = S.fight.bodies.find((b) => b.i === hi);
    if (hk) assert.deepEqual([hk.hurtAt, hk.mineAt], [hurt, mine], 'its hurt and my blow on it kept');
    for (const rb of Y.B.F.bodies) {
      if (!rb.mv || !(rb.mv.v > 0)) continue;
      const row = efs.b.find((q) => q[0] === rb.i), len = Math.hypot(row[9] - row[4], row[10] - row[5]), along = Math.min(len, ((t - rb.mv.at) / 1000) * rb.mv.v);
      if (len > 0.5 && along > 0.5) ahead = Math.max(ahead, along);   // what the walk's head start would have put on it
    }
    sameFight(S, Y.B, t, 'the company, the whole fight said again');
  }
  assert.ok(ahead > 0.5, 'a walk said mid-way, which its head start would have run on');
  // SWEEPS THE SOURCE: every object's state word is said through egObSay, which keeps it for the whole fight - none bare
  for (const f of ['egLords.js', 'egBrain.js', 'egLegion.js', 'egBodies.js']) {
    const src = readFileSync(new URL(`../../../src/net/eliteGates/${f}`, import.meta.url), 'utf8');
    const bare = (src.match(/k: 'eob'/g) ?? []).length - (f === 'egBodies.js' ? 1 : 0);
    assert.equal(bare, 0, `${f}: an object's state said bare`);
  }
  assert.equal((readFileSync(new URL('../../../src/net/eliteGates/egLords.js', import.meta.url), 'utf8').match(/egObSay\(/g) ?? []).length, 8, 'Grath\'s islands (cracked, fallen, risen), the soul-gems (a soul laid, emptied), the runes (lit, stood on) and the true umbra\'s glint');   // PIN MOVED (AUDIT EG V, b: lane1 #12 - the Night-Stalker's true umbra glints, said through egObSay)
});

const poseAt = (spec, x, z, y = 0) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; };
test('EG-ZJ A RELOAD MID-FIGHT IN THE ROOM (server/src/index.js _egHello; section 22): a member whose page reloads in a trial is handed, at its hello, the breach and the whole fight - the burning ground still to burn, an object\'s state as the room said it, every body on its floor, never ground burnt out - and its screen holds the room\'s fight at once (mutants: a burnt-out zone handed on; the hello\'s fight without its zones; a body\'s state unsaid)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const B0 = 'feedfacecafe0cc0';
  const eg = fakeRoom(egRoomKey(B0), { now: () => clock });
  const w = console.warn; console.warn = () => {};
  try {
    const subs = ['acct-mac', 'acct-ann'], co = subs.map((s, i) => [s, `M${i}`, i + 1]);
    const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B0, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 } }) }));
    assert.equal(res.status, 200);
    const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
    clock += EG_SEALED_MS; await beat(1000);
    const spec = egGive8Hall(12345, 1, 0), socks = {};
    for (const [i, [sub]] of co.entries()) {
      const ws = eg.connect();
      await eg.hello(ws, `peer-${sub}`, poseAt(spec, spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
      const z = await mintEgOrder({ o: 'egadmit', s: sub, eb: B0, ez: `${'c'.repeat(19)}${i}` }, (await eg.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
      await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
      socks[sub] = ws;
    }
    for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
    await beat(EG_GATHER_MS + 1000);
    for (let k = 0; k < 8; k++) { for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z)); await beat(1000); }
    const R = eg.room._eg;
    assert.equal(R.sg, 'trial');
    // burning ground laid and an object's state said, by the director's own words
    const f = spec.fl[0], rift = R.F.bodies.find((b) => b.role === EG_ROLE.obj && b.hp > 0);
    const spent = zoneOut(R.F, 'burn', shDisc(f.x + 4, f.z, 3), clock - 3000, clock - 500, [], { p: 0.05, b: 0, el: 'fire' });
    const zone = zoneOut(R.F, 'burn', shDisc(f.x, f.z, 3), clock, clock + 8000, [], { p: 0.05, b: 0, el: 'fire' });
    assert.ok(R.F.zones.includes(spent), 'a zone burnt out, still in the room\'s list');
    egObSay(rift, 1, clock, []);
    // acct-ann's page reloads: a new socket, a hello
    clock += 100;
    const again = eg.connect();
    await eg.hello(again, 'peer-acct-ann-2', poseAt(spec, spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: 'acct-ann', charLevel: 20 });
    const heard = again.sent.filter((m) => m.t === 'eg').map(({ t: _t, ...rest }) => rest);
    assert.deepEqual(heard.slice(0, 2).map((m) => m.k), ['st', 'efs'], 'the breach, then the whole fight');
    const efs = heard[1];
    assert.ok(efs.zs.some((z) => z.i === zone.i && z.kind === 'burn' && z.until === clock + 7900), 'the burning ground still to burn');
    assert.ok(efs.zs.every((z) => z.until > clock), 'and none burnt out');
    const row = efs.b.find((t) => t[0] === rift.i);
    assert.deepEqual(row.slice(15, 18), [1, clock - 100, 0], 'the object\'s state, since its word');   // PIN MOVED (EG-ZQ): and its size; PIN MOVED (AUDIT EG V, b: a body's facing on the wire - its row's nineteenth, a walk's tenth)
    for (const t of efs.b) assert.equal(t[13], egFeetAt(egFightView(spec), t[4], t[5], t[13]), 'every body on its floor');
    const J = heard.reduce((s, m) => foldEg(s, validEgOut(m), clock), EG_STATE_EMPTY);
    sameFight(J, R, clock, 'the reloaded screen');
  } finally { Date.now = realNow; console.warn = w; }
});

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Does a floor piece of the spec (`spec.fl`'s) hold (x, z) in plan? */
const holds = (f, x, z) => (f.t === 'd' ? Math.hypot(x - f.x, z - f.z) <= f.r : Math.hypot(x - Math.min(Math.max(x, Math.min(f.ax, f.bx)), Math.max(f.ax, f.bx)), z - Math.min(Math.max(z, Math.min(f.az, f.bz)), Math.max(f.az, f.bz))) <= f.hw);
/** The fight's floor plan at shared time `t` (ms) in hall `spec` of `seed` - the shapes it draws and where (scenes/eliteGates/egFight.js
 *  over world/eliteGates/egTelegraph.js egFloorPlan). */
function planAt(seed, spec, t) {
  const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', h: spec.h, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: { ...EG_STATE_EMPTY.fight, h: spec.h } };
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0' });
  fight.frame();
  fight.drawPass(I4, I4, [0, 0, 0], 1);
  return fight.plan();
}
/** The first shared instant (ms, past `from`) at which `want(ts)` holds, on a 50 ms step. */
const firstAt = (want, from = 40_000) => { for (let t = from; t < from + 60_000; t += 50) if (want(t / 1000)) return t; throw new Error('never'); };

test('EG-ZJ THE SHAFT\'S TELEGRAPHS ON THE SLAG (EG-ZC\'s departure closed; sections 11.2 and 11.7): down a Wellhead Deepway\'s Slag Chute (the law\'s), where no fight floor stands, the spill told and pouring and the crust\'s last second each drawn as one quad on the crust\'s own surface - before, the floors\' plan drew neither over the crust (at most clipped onto the floor past its lip); a Forge Gut\'s spill likewise, not its lip alone; the traversal ground\'s hazards keep their own surface and a fight floor\'s hazards the floors (mutants: the spill on the floors; the crust\'s tell on the floors; the slag\'s surface its floor\'s)', () => {
  const { seed, s: spec } = findSpec((q) => q.kind === 'deepway' && q.band === 3 && q.frags.some((f) => f.cls === 'shaft' && f.kit === 'forge'), 40);
  const chute = spec.frags.find((f) => f.cls === 'shaft' && f.kit === 'forge');
  const crust = spec.steps.find((s) => s.kind === 'slag' && s.z >= chute.z0 && s.z <= chute.z1);
  const spill = spec.hazards.filter((h) => h.kind === 'slag' && h.sh[1] >= chute.z0 && h.sh[1] <= chute.z1);
  assert.ok(crust && spill.length === EG_SLAG_SPOUTS, 'the Slag Chute\'s crossing: its crust and its two spouts');
  assert.ok(crust.y < -1 && spill.every((h) => h.y === crust.y), `the spill on the crust's surface, down the chute (${crust.y})`);
  assert.ok(!spec.fl.some((f) => holds(f, crust.x, crust.z)), 'no fight floor under the crust');
  assert.equal(egHazardSurface(spill[0]), crust.y, 'the slag: its own surface');
  const fall = findSpec((s) => s.hazards.some((h) => EG_HAZARDS[h.kind].aim === 'trav' && h.y !== 0), 40).s.hazards.find((h) => EG_HAZARDS[h.kind].aim === 'trav' && h.y !== 0);
  const fight = findSpec((s) => s.hazards.some((h) => EG_HAZARDS[h.kind].aim === 'fight' && h.kind !== 'slag'), 40).s.hazards.find((h) => EG_HAZARDS[h.kind].aim === 'fight' && h.kind !== 'slag');
  assert.equal(egHazardSurface(fall), fall.y, 'the traversal ground\'s: its own');
  assert.ok(Number.isNaN(egHazardSurface(fight)), 'a fight floor\'s: the floors it covers');
  const floors = egFightFloors(spec);
  // the spill told: one quad of its own at the crust's height
  const told = firstAt((ts) => egHazardParts(spill[0], ts).some((p) => p.st === 'tell' && p.k > 0.3));
  const plan = planAt(seed, spec, told), onSlag = (d) => d.sh.kind === TELEGRAPH_KIND.lane && Math.abs(d.sh.origin[0] - spill[0].sh[0]) < 1e-6 && Math.abs(d.sh.origin[1] - spill[0].sh[1]) < 1e-6;
  const mine = plan.draws.filter(onSlag);
  assert.equal(mine.length, 1, 'the spill drawn once');
  assert.deepEqual([mine[0].f, mine[0].sh.y], [null, crust.y], 'its own quad, on the crust\'s surface');
  assert.ok(Math.hypot(mine[0].over.courts[0][0] - spill[0].sh[0], mine[0].over.courts[0][1] - (spill[0].sh[1] + spill[0].sh[3]) / 2) < 1e-6, 'over its own lane');
  // before: the floors' plan had it on no floor (or clipped onto the floor past the lip) - never over the crust
  const before = egFloorPlan([{ ...mine[0].sh, y: NaN }], floors, null, null);
  assert.ok(before.draws.every((d) => d.f !== null && !holds(d.f.piece, crust.x, crust.z)), 'before: no quad of its own, nothing over the crust');
  // pouring: the same
  const live = firstAt((ts) => egHazardParts(spill[0], ts).some((p) => p.st === 'live'));
  assert.deepEqual(planAt(seed, spec, live).draws.filter(onSlag).map((d) => [d.f, d.sh.y]), [[null, crust.y]], 'pouring, on the crust');
  // the crust's last second, told in white: on its own surface too
  const k = 0, last = firstAt((ts) => { const S = egSlagState(crust, k, ts); return S.st === 'crust' && (1 - S.k) * EG_SLAG_CRUST_S < EG_SLAG_WARN_S * 0.7; });
  const tells = planAt(seed, spec, last).draws.filter((d) => d.sh.pool === TELEGRAPH_POOL.ground && Math.abs(d.sh.origin[0] - egSlagX(crust, k)) < 1e-6 && Math.abs(d.sh.origin[1] - (crust.z - crust.d / 2)) < 1e-6);
  assert.deepEqual(tells.map((d) => [d.f, d.sh.y]), [[null, crust.y]], 'the crust\'s tell on the crust');
  assert.ok(egFloorPlan([{ ...tells[0].sh, y: NaN }], floors, null, null).draws.every((d) => d.f !== null && !holds(d.f.piece, crust.x, crust.z)), 'before: no quad of its own, nothing over the crust');
  // a Forge Gut's spill over its chasm: its whole lane, not its lip on the far floor alone
  const gut = findSpec((q) => q.hazards.some((h) => h.kind === 'slag' && q.frags.some((f) => f.cls === 'passage' && f.kit === 'forge' && h.sh[1] >= f.z0 && h.sh[1] <= f.z1)), 40);
  const gs = gut.s.hazards.find((h) => h.kind === 'slag' && gut.s.frags.some((f) => f.cls === 'passage' && f.kit === 'forge' && h.sh[1] >= f.z0 && h.sh[1] <= f.z1));
  const gt = firstAt((ts) => egHazardParts(gs, ts).some((p) => p.st === 'tell' && p.k > 0.3));
  const gd = planAt(gut.seed, gut.s, gt).draws.filter((d) => d.sh.kind === TELEGRAPH_KIND.lane && Math.abs(d.sh.origin[0] - gs.sh[0]) < 1e-6 && Math.abs(d.sh.origin[1] - gs.sh[1]) < 1e-6);
  assert.deepEqual(gd.map((d) => [d.f, d.sh.y]), [[null, gs.y]], 'a Forge Gut\'s spill: one quad over its lane');
});
