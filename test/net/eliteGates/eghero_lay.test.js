// EG-HERO-LAY (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.4-
// 11.8, 22 and 31) - SPEC LAW 7, THE HEROES LAID. A hall lays a registered hero fragment of the same kit and class in place of
// a code-built one: the hall's own hero die tosses a fair coin a slot, in the slots' order, and the first heads whose hero
// fits stands - at most one a hall (net/eliteGates/egLaw.js heroHall, egHeroStatic, heroFit). Where none does, law 6's hall stands but
// its number. Everything the relay judges comes from the hero's LAW record (its fight floors as polygons, its stairs, course,
// hazards, places, alcoves, lights, floors, ceilings, open edges and walk graph); the client draws its mesh at its origin into
// the circle's one mesh and collides on its proxy in the circle's one bucket. At this base the registry holds the reference
// alone (never laid), so the laying is pinned on a TEST registry: the reference re-labelled layable and a chamber and a shaft
// written and baked as every hero is (test/fixtures/egheroLay.mjs), laid through net/eliteGates/egLaw.js egHeroSeam and drawn through
// world/eliteGates/egHall.js egHeroMeshSeam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egHeroSeam, egHeroTrials, egHeroCands, egHeroStatic, egHeroExit, egHeroCourtOf, egHeroLanding, egSpecDigest, egCircleOfHall, egSpecGive, egSpecForget, egFirstHallOf, egOnFight, egOnFloor, egFightPieceAt, egKeepOnFight, egFloorTest,
  EG_SPEC, EG_HERO_LAW, EG_DECREE_LAW, EG_HALL_LEN_MAX, EG_HANG_CM, EG_SPEC_SAID_MAX, EG_HERO_WAY_CM, EG_HERO_SHAFT_CM, EG_HERO_LAND_ROOM_CM, EG_FRAGS_MAX, EG_STEP } from '../../../src/net/eliteGates/egLaw.js';
import { EG_LAWS, EG_LAW_KEEP_DAYS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { EG_HERO_FRAGS, egHeroFragRegistry, egHeroFragLaws } from '../../../src/net/eliteGates/egHeroFrags.js';
import { EG_FRAGS, egFragBoxAt, egFragApart, egHazardParts, egHazardBites, EG_FRAG_APART_CM } from '../../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egCourseOf, egSpanPairs, egJumpReach, EG_SPAN_RUN_MPS, EG_JUMP_MPS, EG_JUMP_FWD } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egFightFloorAt, egSupportAt, EG_HOLD } from '../../../src/net/eliteGates/egFair.js';
import { judgePlace } from '../../../src/net/bossRef.js';
import { egUnionHolds } from '../../../src/net/eliteGates/egFloor.js';
import { egFightView, egWalkGraph, egWalkNext, egGroundAt, egFeetAt, egAirOf, egAirClear, egSeesIn } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egPolyIn, egPolyDist, egPolyKeep, egPieceIn } from '../../../src/net/eliteGates/egShape.js';
import { egBreachNew, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SPEC_WIRE_MAX } from '../../../src/net/wire.js';
import { EG_HERO_FRAG_MESHES, egHeroFragMeshes } from '../../../src/world/eliteGates/egHeroFragModel.js';
import { buildEgCircleModel, egCircleColliderTris, egCircleLights, egHeroMeshSeam, egHeroGroundYs, EG_HERO_GROUND_HAND_M, EG_HERO_ROCK_CELL_M, egFragArena, egFragZones, egShaftLedgeAt, egSlagSpouts, egToDungeon, EG_LAMP } from '../../../src/world/eliteGates/egHall.js';
import { egCircleParts, egCirclePartsTransfers } from '../../../src/world/eliteGates/egCircleParts.js';
import { egFightFloors, egOnFloorAt } from '../../../src/world/eliteGates/egTelegraph.js';
import { egHallReverb } from '../../../src/systems/eliteGates/egReverb.js';
import { SD_ROOT_DEPTH } from '../../../src/world/superDungeon/sdRealm.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { sweepStand, sweepCourse } from '../../../tools/egSpanSolve.mjs';
import { graph } from '../../importGraph.mjs';   // the relay's walk (test/net/relayversion.test.js RELAY_GRAPH's own)
import { layFixtures } from '../../fixtures/egheroLay.mjs';

const FX = layFixtures();
const REF = EG_HERO_FRAGS.egRefFrag;
/** THE TEST REGISTRY: the reference re-labelled layable, the chamber and the shaft (and their meshes). */
const TEST = egHeroFragRegistry([{ ...REF, variant: 'test' }, FX.chamber.law, FX.shaft.law]);
const MESHES = egHeroFragMeshes([EG_HERO_FRAG_MESHES.egRefFrag, FX.chamber.mesh, FX.shaft.mesh], TEST);
/** `fn` run with registry `laws` (the test's by default) and its meshes laid, both restored after. */
function withHeroes(fn, laws = TEST, meshes = MESHES) {
  const a = egHeroSeam(laws), b = egHeroMeshSeam(meshes);
  try { return fn(); } finally { egHeroSeam(a); egHeroMeshSeam(b); }
}
/** THE LAW PIN's 800 halls (test/net/eliteGates/egz_frag.test.js, test/net/eliteGates/egaudit3_law.test.js): four seeds, two grounds, a hundred halls. */
const LAW_HALLS = [];
for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) LAW_HALLS.push([seed, h, geo]);
const hash = (law) => { let acc = 0x811c9dc5; for (const [s, h, g] of LAW_HALLS) acc = Math.imul(acc ^ egSpecDigest(egHallOf(s, h, g, law)), 0x01000193) >>> 0; return acc >>> 0; };
/** The halls the laying's pins read, each with a hero of the test registry (seed, hall, ground): a Span's Low Road, a first
 *  circle's Span, a Brink, a Deepway's shaft, a Deepway's chamber, a Rift-Yard's, a Wellspring's, a Proving Walk's. */
const H = { low: [0xbeef, 7, 0], high: [0xbeef, 2, 0], brink: [8, 26, 0], shaft: [77, 17, 0], deepCh: [12345, 12, 0], deepRift: [34, 12, 0], yard: [3, 16, 0], spring: [8, 24, 0], proving: [2, 8, 0] };
// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the laying's pins read spec law 8's halls by name - the hero laid on a
// course along +z from the plate, where laws 7 and 8 lay it; a LAW 9 hall lays its hero where its course stands along its way,
// beside its rooms (test/net/eliteGates/law9_rooms.test.js)
const hall = (k, law = 8) => withHeroes(() => egHallOf(...H[k].slice(0, 2), H[k][2], law));
/** A circle's five halls of spec law 8, given as a law-foreign client is given them (egSpecGive - the relay's bytes for a breach
 *  of law 8): the circle drawn, collided and swept where law 8 lays its hero (PIN MOVED, THE ASCENT) - egSpecForget after. */
const give8 = (seed, c) => { for (let s = 1; s <= 5; s++) egSpecGive(egHallOf(seed, egFirstHallOf(c) + s - 1, 0, 8)); };
const cm = (v) => Math.round(v * 100);

test('EG-HERO-LAY THE LAW PIN (sections 9 and 22): spec law 7 is the law, laws 4, 5 and 6 kept beside it their seven days each, byte for byte (their 800 halls hashed whole, the existing pins); a hall of law 7 with no layable hero for its kits is law 6\'s hall but its number - so with the reference alone registered (which no hall lays) every law-7 hall is law 6\'s; with the ten heroes (the merge of the four bands\' authors) every one fits its slot (the Stacks\' chamber since its second shelf was deepened to leave THE LANDING ROOM), law 7\'s 800 halls are hashed whole, each with no hero laid is law 6\'s, and the heroes laid as counted; a breach opened records law 7; the law\'s copies of the wire\'s bound and the hang held equal (mutants: law 7 not in the table; the law before forgotten; the reference laid; a hall with no hero moved)', () => {
  // PIN MOVED (AUDIT EG V, f): spec law 8 (the ways laid) is the build's law, law 7 kept beside it - this pin names law 7, whose
  // laying it holds (test/net/eliteGates/egaudit5_f.test.js pins law 8's)
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): spec law 9 the build's, laws 4 to 8 kept beside it
  // PIN MOVED (EG-PERFECT, 2026-10-18): spec law 10 (THE BROKEN WAY) is the build's law, laws 4 to 9 kept beside it
  // (test/net/eliteGates/egperfect_broken.test.js pins law 10)
  assert.deepEqual([EG_SPEC, EG_HERO_LAW, EG_DECREE_LAW], [10, 7, 6]);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11].map(egLawKnown), [true, true, true, true, true, true, true, false]);
  assert.ok((Date.parse(EG_LAWS[7]) - Date.parse(EG_LAWS[4])) / 86_400_000 <= EG_LAW_KEEP_DAYS, 'every law before inside its keep');
  assert.deepEqual([hash(4), hash(5), hash(6)], [1228307904, 1301097644, 201408482], 'laws 4, 5 and 6, byte for byte');
  // the reference alone registered: no candidate anywhere, so law 7 is law 6 but its number
  const REF_ONLY = egHeroFragRegistry([REF]);
  for (const kit of Object.keys(EG_FRAGS)) for (const cls of ['passage', 'chamber', 'shaft']) assert.deepEqual(egHeroCands(kit, cls, REF_ONLY), [], `${kit} ${cls}: no hero to lay`);
  withHeroes(() => {
    for (const [s, h, g] of LAW_HALLS.slice(0, 200)) {
      const a = egHallOf(s, h, g, 6), b = egHallOf(s, h, g, 7);
      assert.equal(JSON.stringify({ ...b, v: 6 }), JSON.stringify(a), `seed ${s} hall ${h} ground ${g}: law 7 with no hero is law 6's`);
      assert.equal(b.heroes, undefined);
    }
  }, REF_ONLY, {});
  // PIN MOVED (EG-HERO-LAY at the merge of the ten heroes - the registry is real): the reference and the four bands' ten, each
  // but the reference a candidate of its kit and class; law 7's 800 halls hashed whole, each with no hero laid law 6's but its
  // number. PIN MOVED (AUDIT EG IV): every one fits its slot - the Stacks' chamber, refused at the merge (its second shelf left
  // THE SPAN BUILD's landing 12 cm before its far edge), since its author deepened that shelf to 2.0 m (52 cm)
  const ids = Object.keys(EG_HERO_FRAGS);
  assert.equal(ids.length, 11);
  for (const id of ids) { const L = EG_HERO_FRAGS[id]; assert.equal(egHeroCands(L.kit, L.class).includes(L), id !== 'egRefFrag', id); }
  for (const id of ids) assert.equal(egHeroStatic(EG_HERO_FRAGS[id]), '', id);
  assert.equal(hash(7), 2018192008, 'law 7, as the ten heroes lay it');
  const laid = {};
  for (const [s, h, g] of LAW_HALLS) {
    const a = egHallOf(s, h, g, 6), b = egHallOf(s, h, g, 7);
    if (b.heroes) { assert.equal(b.heroes.length, 1, 'one hero a hall'); laid[b.heroes[0].id] = (laid[b.heroes[0].id] ?? 0) + 1; continue; }
    assert.equal(JSON.stringify({ ...b, v: 6 }), JSON.stringify(a), `seed ${s} hall ${h} ground ${g}: law 7 with no hero is law 6's`);
  }
  assert.deepEqual(laid, { egheroOssuary: 22, egheroGloam: 24, egheroEclipse: 3, egheroClanPit: 10, egheroForgeGut: 4, egheroColonnade: 3, egheroCaverns: 3, egheroStacks: 6, egheroDeepCaverns: 3 });
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  assert.equal(B.egv, 10, 'a breach opened now is of law 10 (PIN MOVED, AUDIT EG V; THE ASCENT; EG-PERFECT)');
  assert.equal(EG_SPEC_SAID_MAX, EG_SPEC_WIRE_MAX, 'the law\'s bound on a spec said whole is the wire\'s');
  assert.equal(EG_HANG_CM, SD_ROOT_DEPTH * 100, 'the hanging underside is the Steps\' root');
  assert.equal(EG_HERO_WAY_CM, EG_STEP.ledge.w);
  assert.equal(EG_HERO_SHAFT_CM, 810, 'four flights of 0.9 m and the deepest Drop, 4.5 m');
  assert.equal(EG_FRAGS_MAX, 4);
});

test('EG-HERO-LAY THE ODDS (spec law 7): with heroes registered, each slot a code-built fragment of a hero\'s kit and class fills (never a set piece) gets a fair coin off the hall\'s own hero die, in the slots\' order; the first heads whose hero fits is laid at its slot - at most one a hall; tails, or a hero that does not fit, leaves law 6\'s hall but its number; over the pins\' halls the coins and the fits as counted (mutants: the coin unfair; every hall a hero; a second hero; a refused hero kept; the reference laid)', () => {
  // PIN MOVED (AUDIT EG V, f): law 7's coins and fits, named (spec law 8 is the build's - test/net/eliteGates/egaudit5_f.test.js)
  withHeroes(() => {
    const tally = {};
    let halls = 0, heroes = 0;
    for (const seed of [77, 0xbeef, 3, 12345, 1, 2, 5, 8, 13]) for (let h = 1; h <= 100; h++) {
      const trials = egHeroTrials(seed, h, 0, 7), spec = egHallOf(seed, h, 0, 7), law6 = egHallOf(seed, h, 0, 6);
      if (!trials.length) { assert.equal(JSON.stringify({ ...spec, v: 6 }), JSON.stringify(law6), `seed ${seed} hall ${h}: no slot, law 6's hall`); continue; }
      halls++;
      for (const t of trials) { const k = `${t.cls} ${t.why === 'tails' ? 'tails' : t.why ? 'refused' : 'laid'}`; tally[k] = (tally[k] ?? 0) + 1; }
      // the slots in order, each its fragment's kit and class; the heads the hero die's draws under one half
      for (const t of trials) {
        assert.equal(law6.frags[t.n].kit, t.kit); assert.equal(law6.frags[t.n].cls, t.cls);
        assert.equal(t.why === 'tails', t.u >= 0.5, 'tails at a half and over');
      }
      const laid = trials.find((t) => t.why === '');
      if (laid) {
        heroes++;
        assert.equal(spec.heroes.length, 1, 'one hero a hall');
        assert.equal(spec.heroes[0].id, laid.id); assert.equal(spec.heroes[0].f, laid.n, 'at its slot');
        assert.equal(spec.frags[laid.n].hero, laid.id);
        assert.equal(trials.indexOf(laid), trials.length - 1, 'no coin is tossed after a hero stands');
        assert.ok(egSpanProof(spec).ok && spec.len <= EG_HALL_LEN_MAX && JSON.stringify(spec).length <= EG_SPEC_SAID_MAX);
        assert.notEqual(laid.id, 'egRefFrag:reference');
      } else assert.equal(JSON.stringify({ ...spec, v: 6 }), JSON.stringify(law6), `seed ${seed} hall ${h}: no hero stands - law 6's hall`);
    }
    assert.deepEqual(tally, { 'passage tails': 21, 'passage laid': 10, 'passage refused': 2, 'chamber tails': 9, 'chamber laid': 6, 'shaft tails': 3, 'shaft laid': 3 });
    assert.deepEqual([halls, heroes], [49, 19]);
    // a refused hero: the Cairn's Brink (seed 77 hall 26), whose sinking stair's last gap the hero's hall widens past the
    // span build's jump - THE TIMED SOLVER refuses it, and law 6's hall stands
    const [t] = egHeroTrials(77, 26, 0, 7);
    assert.match(t.why, /^THE TIMED SOLVER refuses the hall/);
    assert.equal(JSON.stringify({ ...egHallOf(77, 26, 0, 7), v: 6 }), JSON.stringify(egHallOf(77, 26, 0, 6)));
    // a hero whose slot comes after a fragment of its class (a Deepway's last passage, after a Broken Colonnade's): laid at
    // its own slot, never the first of its class - the colonnade, the chamber and the shaft before it law 6's
    const dw = egHallOf(18, 22, 0, 7), dw6 = egHallOf(18, 22, 0, 6);
    assert.deepEqual(egHeroTrials(18, 22, 0, 7).map((t) => [t.n, t.cls, t.why]), [[2, 'shaft', 'tails'], [3, 'passage', '']]);
    assert.deepEqual([dw.heroes[0].f, dw.frags[3].hero], [3, 'egRefFrag']);
    assert.deepEqual(dw.frags.slice(0, 3), dw6.frags.slice(0, 3), 'the fragments before its slot law 6\'s');
  });
  // the reference is never a candidate, whatever its kit and class
  assert.deepEqual(egHeroFragLaws('caverns', TEST).map((L) => L.variant).sort(), ['test', 'test-chamber', 'test-shaft']);
  assert.deepEqual(egHeroCands('caverns', 'passage', egHeroFragRegistry([REF])), []);
  // two heroes of one kit and class: the coin's own draw picks between them (heads at u: the one at u x 2 x their count)
  const two = egHeroFragRegistry([{ ...REF, variant: 'test' }, { ...REF, id: 'egRefFragTwo', variant: 'test-two' }]), ids = {};
  withHeroes(() => {
    for (const seed of [77, 0xbeef, 3, 12345, 1, 2, 5, 8, 13]) for (let h = 1; h <= 30; h++) for (const t of egHeroTrials(seed, h, 0, 7)) if (t.id) {
      assert.equal(t.id, t.u < 0.25 ? 'egRefFrag' : 'egRefFragTwo');
      ids[t.id] = (ids[t.id] ?? 0) + 1;
    }
  }, two);
  assert.deepEqual(ids, { egRefFrag: 9, egRefFragTwo: 4 });
});

test('EG-HERO-LAY THE FIT AT ITS SLOT (egHeroStatic, egHeroExit, egHeroCourtOf): the mouth at least a ledge wide with a floor at its foot; the course leaves by the lowest exit the course\'s line passes through (at least a ledge wide), a floor under it, at the height its slot keeps - a passage\'s at its mouth\'s or as far under as its kit\'s own passage goes (the Mist Stair\'s 3.6 m), never off it on the Low Road; a shaft\'s under its mouth by at most four flights and the deepest Drop; a chamber\'s at its mouth\'s, its middle on a fight floor reaching past a rift\'s inset; THE LANDING ROOM (egHeroLanding - at the merge of the ten heroes): THE SPAN BUILD\'s running jump onto each piece of its inner course comes down at least 40 cm before the piece\'s far edge - the least the real motor leaps again from, under the least every code-built landing a piece launches onto leaves - unless the piece moves along the course or a step down is run off onto it (mutants: each bound loosened or dropped)', () => {
  const T = { ...REF, variant: 'test' }, sock = (o) => ({ ...T, sockets: { in: T.sockets.in, out: [{ ...T.sockets.out[1], ...o }] } });
  assert.equal(egHeroStatic(T), ''); assert.equal(egHeroStatic(T, true), '');
  assert.equal(egHeroExit(T), 1, 'the floor\'s exit: the balcony\'s stands off the line and 1.5 m up');
  assert.equal(egHeroExit({ ...T, sockets: { in: T.sockets.in, out: [T.sockets.out[1], { ...T.sockets.out[1], x: 0, y: -50 }] } }), 1, 'the lowest');
  assert.equal(egHeroExit({ ...T, sockets: { in: T.sockets.in, out: [T.sockets.out[1], { ...T.sockets.out[1], x: 0 }] } }), 1, 'of two as low, the nearer the line');
  assert.equal(egHeroExit(sock({ w: EG_HERO_WAY_CM - 1, x: 0 })), -1, 'narrower than a ledge');
  assert.equal(egHeroExit(sock({ w: 300, x: 151 })), -1, 'the line passes beside it');
  assert.equal(egHeroExit(sock({ w: 300, x: 150 })), 0, 'the line on its edge');
  assert.match(egHeroStatic({ ...T, sockets: { ...T.sockets, in: { ...T.sockets.in, w: EG_HERO_WAY_CM - 1 } } }), /mouth/);
  assert.equal(egHeroStatic({ ...T, sockets: { ...T.sockets, in: { ...T.sockets.in, w: EG_HERO_WAY_CM } } }), '', 'a mouth a ledge wide');
  assert.match(egHeroStatic({ ...T, floors: T.floors.filter((f) => f.fight) }), /mouth/, 'no floor at the mouth\'s foot');
  assert.match(egHeroStatic(sock({ y: 10 })), /exit stands at 10/, 'a passage\'s exit never rises');
  assert.match(egHeroStatic(sock({ y: -10 })), /exit stands at -10/, 'nor falls, where its kit\'s own passage does not');
  assert.match(egHeroStatic(sock({ z: 2000 })), /no floor reaches/, 'a floor under the exit');
  assert.match(egHeroStatic({ ...T, box: [T.box[0], T.box[1], -11, T.box[3], T.box[4], T.box[5]] }), /box/);
  // the Mist Stair's passage winds down: its exit as deep as its own code-built passage's flights (3.6 m), not one cm more
  const mist = (y) => ({ ...T, kit: 'mist', band: 1, sockets: { in: T.sockets.in, out: [{ ...T.sockets.out[1], y }] }, floors: [...T.floors, { y, poly: [[300, 2100], [300, 3000], [-300, 3000], [-300, 2100]], fight: 0 }] });
  assert.equal(egHeroStatic(mist(-360)), '');
  assert.match(egHeroStatic(mist(-361)), /exit stands at -361/);
  assert.match(egHeroStatic(mist(-360), true), /exit stands at -360/, 'never down on the Low Road');
  // the shaft: down, at most EG_HERO_SHAFT_CM
  const S = FX.shaft.law, sh = (y) => ({ ...S, sockets: { in: S.sockets.in, out: [{ ...S.sockets.out[0], y }] }, floors: S.floors.map((f) => (f.y === S.sockets.out[0].y ? { ...f, y } : f)) });
  assert.equal(egHeroStatic(S), '');
  assert.equal(egHeroStatic(sh(-EG_HERO_SHAFT_CM)), '');
  assert.match(egHeroStatic(sh(-EG_HERO_SHAFT_CM - 1)), /exit stands/);
  assert.match(egHeroStatic(sh(0)), /exit stands at 0/, 'a shaft goes down');
  // the chamber: its exit at its mouth's height; its middle on a fight floor at it, reaching past 3 m
  const C = FX.chamber.law;
  assert.equal(egHeroStatic(C), '');
  assert.deepEqual(egHeroCourtOf(C), { cz: 1702, R: 1598 }, 'its middle half its length along the course; its reach to the nearest edge');
  assert.match(egHeroStatic({ ...C, sockets: { in: C.sockets.in, out: [{ ...C.sockets.out[0], y: -20 }] }, floors: [...C.floors, { y: -20, poly: [[300, 3300], [300, 3405], [-300, 3405], [-300, 3300]], fight: 0 }] }), /exit stands at -20/);
  const small = { ...C, floors: C.floors.map((f) => (f.fight && f.y === 0 ? { ...f, poly: [[300, 1400], [300, 2004], [-300, 2004], [-300, 1400]] } : f)) };
  assert.equal(egHeroCourtOf(small), null, 'a court reaching no further than a rift\'s 3 m inset');
  assert.deepEqual(egHeroCourtOf({ ...small, floors: small.floors.map((f) => (f.fight && f.y === 0 ? { ...f, poly: [[301, 1401], [301, 2003], [-301, 2003], [-301, 1401]] } : f)) }), { cz: 1702, R: 301 });
  assert.match(egHeroStatic({ ...C, floors: C.floors.map((f) => ({ ...f, fight: 0 })) }), /middle/);
  // THE LANDING ROOM: the reference's first shelf (a 1 m gap, 2 m deep) takes the span build's running jump 2.56 m on - 44 cm
  // before its far edge; its far edge drawn back 4 cm leaves 40 and stands, 10 cm leaves 34 and is refused. PIN MOVED (AUDIT
  // EG IV): the bound 40 cm, not 20 - the real motor stood on a landing 32 cm short of the edge in 5 of 37 crossings
  const edge = (dz, dy = 0) => ({ ...T, course: T.course.map((c, i) => (i === 0 ? { ...c, z: c.z - dz / 2, d: c.d - dz, y: c.y + dy } : c)) });
  assert.equal(EG_HERO_LAND_ROOM_CM, 40);
  assert.equal(egHeroLanding(T), '');
  assert.equal(egHeroLanding(edge(4)), '');
  assert.match(egHeroLanding(edge(10)), /^its course's piece 0 \(ledge\) leaves the span build's landing 34 cm before its far edge, under 40$/);
  assert.equal(egHeroStatic(edge(10)), egHeroLanding(edge(10)), 'the fit holds it');
  // a metre down, the running jump flies past it (49 cm past its far edge) - but a player runs off onto it, 1.7 m on
  assert.match(egHeroLanding({ ...edge(0, -100), course: edge(0, -100).course.map((c, i) => (i === 0 ? { ...c, gap: c.gap + 40, z: c.z + 20, d: c.d - 40 } : c)) }), /piece 0/, 'a gap of 1.4 m: run off, short of it - refused');
  assert.equal(egHeroLanding(edge(0, -100)), '', 'run off onto it');
  // a piece moving along the course is the solver's alone; every code-built landing a piece launches onto, over the law pin's
  // halls, leaves the room (0.44 m at worst) - only one launched from still ground after its run-up leaves less (0.24 m)
  // PIN MOVED (AUDIT EG V, f): law 7's - spec law 8 judges a Drift as still ground (it swings across the course, never along it:
  // test/net/eliteGates/egaudit5_f.test.js)
  assert.equal(egHeroLanding({ ...T, course: T.course.map((c, i) => (i === 1 ? { ...c, d: 100, z: c.z - 120 } : c)) }, 7), '', 'a Drift, its far edge 1.9 m back - judged, past it');
  let worst = Infinity, ground = Infinity;
  for (const [sd, h, g] of LAW_HALLS) for (const p of egSpanPairs(egHallOf(sd, h, g, 6))) {
    const { a, b } = p;
    if (!b || b.amp > 0 || b.kind === 'riser' || (a && a.amp > 0)) continue;
    const dy = b.y - (a ? a.y : b.y);
    if (dy < -0.3) continue;   // a step down: run off
    const room = b.z + b.d / 2 - (a ? a.z + a.d / 2 : p.edge) - (EG_SPAN_RUN_MPS + EG_JUMP_MPS * EG_JUMP_FWD) * egJumpReach(dy).air;
    if (a) worst = Math.min(worst, room); else ground = Math.min(ground, room);
  }
  assert.ok(worst >= EG_HERO_LAND_ROOM_CM / 100 && worst < EG_HERO_LAND_ROOM_CM / 100 + 0.1, `every code-built landing a piece launches onto leaves the room: ${worst.toFixed(3)} m at worst`);
  assert.equal(Math.round(ground * 100), 24, 'a landing launched from still ground, after its run-up');
});

test('EG-HERO-LAY A PASSAGE LAID FROM ITS LAW (sections 11.4-11.7): on THE FORK\'s Low Road the hero\'s mouth stands at the slot\'s start on the road\'s line, its fight floors in the fight floor as polygons at its origin, its stair as the hall\'s ramp, its inner course its record\'s pieces at their places and sizes (the span generator\'s steps, its kit\'s), its hazards, its places (an engine anchor its kit\'s Sluice), its alcove and its lights, its law in `heroes`, its fragment, and the course on from its exit at the exit\'s height; a hero whose box meets the High Road\'s pieces does not fit (mutants: each field dropped or moved off the origin)', () => {
  const spec = hall('low'), q = spec.heroes[0], rec = TEST.egRefFrag, law6 = egHallOf(...H.low.slice(0, 2), 0, 6);
  const at = (p) => [q.x + p[0] / 100, q.z + p[1] / 100];
  assert.equal(q.road, 1); assert.equal(q.x, spec.fork.lowX, 'on the Low Road\'s line');
  assert.equal(q.y, spec.fork.yLow, 'at the slot\'s height');
  // the slot's start: where law 6's code-built passage stood
  const code = law6.frags[q.f];
  assert.deepEqual([code.cls, code.road, code.x, code.z0, code.y], ['passage', 1, q.x, q.z, q.y]);
  assert.deepEqual(spec.frags[q.f], { kit: 'caverns', cls: 'passage', name: EG_FRAGS.caverns.name, x: q.x, y: q.y, z0: q.z, z1: q.z + rec.box[5] / 100, play: '', reverb: 'cave', road: 1, hero: 'egRefFrag' });
  assert.deepEqual(q.box, egFragBoxAt(rec, cm(q.x), cm(q.y), cm(q.z)).map((v) => v / 100));
  // its fight floors, as polygons, at its origin and their heights
  assert.deepEqual(spec.fl.filter((f) => f.t === 'p'), rec.floors.filter((f) => f.fight).map((f) => ({ t: 'p', poly: f.poly.map(at), y: q.y + f.y / 100 })));
  assert.deepEqual(q.floors, rec.floors.map((f) => ({ y: q.y + f.y / 100, poly: f.poly.map(at), fight: f.fight })));
  assert.deepEqual(q.open, rec.open); assert.deepEqual(q.ceil, rec.ceil.map((c) => ({ y: q.y + c.y / 100, poly: c.poly.map(at) })));
  assert.deepEqual(q.graph.nodes[0], [q.x + 2.25, q.y + 1.5, q.z + 27.5, 0.5]); assert.deepEqual(q.graph.edges, rec.graph.edges);
  assert.deepEqual(q.sockets.out[q.exit], { x: q.x - 1, y: q.y, z: q.z + 30, w: 3, h: 4 });
  // its stair: from the middle of its low corners to the middle of its high ones
  assert.deepEqual(spec.ramps, [{ ax: q.x + 2.25, az: q.z + 22.5, bx: q.x + 2.25, bz: q.z + 25, hw: 0.75, y0: q.y, y1: q.y + 1.5 }]);
  // its inner course: the span generator's steps at the record's places and sizes, on its road, its kit's
  const mine = spec.steps.filter((s) => s.kit === 'caverns' && s.road === 1);
  assert.deepEqual(mine.map((s) => [s.kind, cm(s.x), cm(s.y), cm(s.z), cm(s.w), cm(s.d), cm(s.amp), s.period * 1000, s.phase * 1000, cm(s.gap), cm(s.after)]),
    rec.course.map((c) => [c.kind, cm(q.x) + c.x, cm(q.y) + c.y, cm(q.z) + c.z, c.w, c.d, c.amp, c.period, c.phase, c.gap, c.after]));
  // its hazards on the shared clock, as the spec says a hazard
  const hz = spec.hazards.slice(-rec.hazards.length);
  assert.deepEqual(hz.map((h) => [h.kind, h.x, h.z, h.y, h.period, h.phase, h.w, h.r, h.ring, h.sh, h.spots, h.lanes, h.path]), rec.hazards.map((h) => [h.kind, ...at([h.x, h.z]), q.y + h.y / 100, h.period / 1000, h.phase / 1000, h.w / 100, h.r / 100, h.ring / 100, h.sh ? [...at([h.sh[0], h.sh[1]]), ...at([h.sh[2], h.sh[3]])] : null, h.spots ? h.spots.map(at) : null, null, null]));
  // its places: every anchor a spot of its fragment and road (its height in cm, the law's), its engine its kit's Sluice
  for (const k of ['rift', 'caster', 'lurker', 'niche', 'hazard']) assert.deepEqual(spec.spots[k].filter((s) => s.f === q.f).map((s) => [s.x, s.z, s.y, s.road]), rec.anchors[k].map((p) => [...at([p[0], p[2]]), cm(q.y) + p[1], 1]), k);
  assert.deepEqual(spec.engines, [{ i: 0, kind: 'sluice', x: q.x, z: q.z + 26, y: q.y }]);
  assert.deepEqual(spec.alcoves.slice(-1), [{ i: spec.alcoves.length - 1, x: q.x - 4, z: q.z + 5, y: q.y, seal: 'seam', side: -1, holds: 'shard' }]);
  assert.deepEqual(spec.lights.slice(-3), rec.lights.map((l) => [q.x + l[0] / 100, q.y + l[1] / 100, q.z + l[2] / 100, l[3]]));
  // the course on from its exit: the Low Road's niche band begins at its +Z face, at the exit's height
  assert.ok(spec.bands.some((b) => b.z0 === q.z + rec.box[5] / 100 && b.y === q.y && b.x === q.x), 'the next ground at the exit');
  // the High Road's pieces stand apart from its box - a hero as wide as the gap between the roads does not fit there
  const wide = { ...TEST.egRefFrag, box: [-1800, ...REF.box.slice(1)] }, W = egHeroFragRegistry([wide]);
  withHeroes(() => {
    const t = egHeroTrials(...H.low, 8).find((x) => x.id);
    assert.match(t.why, /its box meets step \d+'s swept box/);
    assert.equal(egHallOf(...H.low.slice(0, 2), 0, 8).heroes, undefined);
  }, W);
  for (const s of spec.steps) if (s.road === 0) assert.ok(egFragApart(egFragBoxAt(rec, cm(q.x), cm(q.y), cm(q.z)), [cm(s.x - s.w / 2 - s.amp), cm(s.y) - EG_HANG_CM, cm(s.z - s.d / 2 - s.gap), cm(s.x + s.w / 2 + s.amp), cm(s.y), cm(s.z + s.d / 2)], EG_FRAG_APART_CM));
  // a first circle's Span (its one course - the High Road's own passage) and a Brink lay it too, on the course's line
  for (const k of ['high', 'brink']) { const s = hall(k); assert.deepEqual([s.heroes[0].x, s.heroes[0].road, s.frags[s.heroes[0].f].hero], [0, 0, 'egRefFrag'], k); }
  // an inner piece keeps its authored size (EG6c's departure 12), never EG_STEP's
  const wideLedge = egHeroFragRegistry([{ ...TEST.egRefFrag, course: TEST.egRefFrag.course.map((c, i) => (i === 0 ? { ...c, w: 280 } : c)) }]);
  withHeroes(() => assert.deepEqual(egHallOf(...H.low.slice(0, 2), 0, 8).steps.filter((x) => x.kit === 'caverns' && x.road === 1).map((x) => x.w), [2.8, 3, 2.4]), wideLedge);
  // a hero that would carry the hall past EG_HALL_LEN_MAX does not fit
  const L = 9000, long = egHeroFragRegistry([{ ...TEST.egRefFrag, box: [...REF.box.slice(0, 5), L], sockets: { in: REF.sockets.in, out: [{ ...REF.sockets.out[1], z: L }] }, floors: [...REF.floors, { y: 0, poly: [[300, 3000], [300, L], [-300, L], [-300, 3000]], fight: 0 }], open: [...REF.open, [4, 1], [4, 3]], ceil: null }]);
  withHeroes(() => assert.match(egHeroTrials(...H.high, 8).find((t) => t.id)?.why ?? '', /past 158 m/), long);
});

test('EG-HERO-LAY A CHAMBER AND A SHAFT LAID (sections 8.1, 8.5, 8.8 and 11.4): a hero chamber\'s court is laid at its own size - its mouth at the court\'s near edge, its middle the court\'s, its reach the court\'s radius - with no code-built disc, its trial on its fight floors (a Rift-Yard\'s rifts its own rift anchors where it names five, a Deepway\'s where it names three, a Wellspring\'s set by the hall law on its floor), the Clan Pit\'s Honour Horn its kit\'s; a hero shaft lowers the course to its exit (mutants: the code-built disc kept; the court at the code-built size; the anchors unread; the trial off its floors; the horn lost; the shaft\'s exit unread)', () => {
  const inF = (spec, x, z) => spec.fl.some((f) => f.t === 'p' && egPolyIn(f.poly, x, z));
  const C = FX.chamber.law, R = egHeroCourtOf(C);
  for (const k of ['yard', 'spring', 'proving', 'deepCh']) {
    const spec = hall(k), q = spec.heroes[0];
    assert.equal(q.cls, 'chamber', k);
    assert.ok(!spec.discs.some((d) => d.role === 'court'), `${k}: no code-built court disc`);
    assert.ok(!spec.fl.some((f) => f.t === 'd' && Math.abs(f.z - (q.z + R.cz / 100)) < 1e-9), `${k}: nor its fight floor`);
    assert.equal(spec.chamber, 1);
    assert.deepEqual(spec.frags[q.f], { kit: 'caverns', cls: 'chamber', name: EG_FRAGS.caverns.name, x: 0, y: q.y, z0: q.z, z1: (cm(q.z) + C.box[5]) / 100, play: 'balcony', reverb: 'cave', road: 0, hero: 'egLayChamber' });
    // the trial's places the hall set inside its box stand on its fight floors (its own anchors aside)
    const places = [...Object.values(spec.spots).flat().filter((p) => p.f !== q.f), ...(spec.foe ? [spec.foe] : [])];
    for (const p of places) if (p.x >= q.box[0] && p.x <= q.box[3] && p.z >= q.box[2] && p.z <= q.box[5]) assert.ok(inF(spec, p.x, p.z), `${k}: (${p.x}, ${p.z}) on its fight floor`);
    if (k !== 'proving') assert.ok(spec.bands.some((b) => b.role === 'bridge' && Math.abs(b.z1 - q.z) < 1e-9), `${k}: a bridge to its mouth`);
  }
  const yard = hall('yard'), qy = yard.heroes[0];
  assert.equal(yard.variant, 'riftyard');
  assert.deepEqual(yard.rifts, C.anchors.rift.map((p) => ({ x: qy.x + p[0] / 100, z: qy.z + p[2] / 100 })), 'its rifts set in its walls');
  assert.deepEqual(yard.engines, [{ i: 0, kind: 'sluice', x: 0, z: (cm(qy.z) + 900) / 100, y: qy.y }]);
  const spring = hall('spring'), qs = spring.heroes[0], zc = cm(qs.z) + R.cz;
  assert.equal(spring.variant, 'wellspring');
  assert.deepEqual(spring.rifts, [{ x: 0, z: (zc + Math.floor(R.R / 3)) / 100 }], 'the Wellspring\'s great rift a third of its reach from its middle');
  assert.equal(spring.spots.anchor.length, 3);
  for (const p of spring.spots.anchor) assert.ok(Math.abs(Math.hypot(p.x * 100, p.z * 100 - zc) - (R.R - 400)) <= 2, 'its anchors 4 m inside its reach');
  const deep = hall('deepCh'), qd = deep.heroes[0], obj = deep.spots.chamber[0].obj;
  assert.deepEqual(deep.spots.niche.at(-1), { x: (R.R - 200) / 100, z: (cm(qd.z) + R.cz) / 100 }, 'the Deepway\'s niche R - 2 m from its middle');
  assert.equal(obj, 1, 'a champion\'s chamber');
  assert.ok(deep.bands.some((b) => b.role === 'bridge' && b.z0 === (cm(qd.z) + C.box[5]) / 100), 'the bridge on from its exit face, never back over its floor');
  const dr = hall('deepRift'), qr = dr.heroes[0];
  assert.deepEqual([dr.spots.chamber[0].obj, dr.twist], [0, 'captive']);
  assert.deepEqual(dr.rifts, C.anchors.rift.slice(0, 3).map((p) => ({ x: qr.x + p[0] / 100, z: (cm(qr.z) + p[2]) / 100 })), 'a Deepway\'s three rifts its own');
  const zr = cm(qr.z) + R.cz;
  assert.equal(dr.spots.chain.length, 3);
  for (const p of dr.spots.chain) assert.ok(Math.abs(Math.hypot(p.x * 100, p.z * 100 - zr) - Math.floor(R.R / 2)) <= 2, 'the Captive\'s chains half its reach about its middle');
  // the fight's bounding disc over its polygons
  const xs = dr.fl.flatMap((f) => (f.t === 'p' ? f.poly.map((p) => p[0]) : [f.ax - f.hw, f.bx + f.hw])), zs = dr.fl.flatMap((f) => (f.t === 'p' ? f.poly.map((p) => p[1]) : [f.az, f.bz]));
  assert.equal(dr.fight.z, Math.round((Math.min(...zs) + Math.max(...zs)) * 50) / 100, 'the fight\'s middle over its fight floors');
  assert.ok(dr.fight.r * 2 >= Math.max(...xs) - Math.min(...xs));
  const prov = hall('proving'), qp = prov.heroes[0], next = prov.steps.find((x) => x.z > qp.z);
  assert.equal(cm(next.z - next.d / 2 - next.gap), cm(qp.z) + C.box[5], 'the second span from its exit face');
  // a Reliquary Vault's Proving Walk keeps its code-built court; a court too narrow for the champion's standards does not fit
  withHeroes(() => assert.match(egHeroTrials(58, 8, 0, 8)[0].why, /Reliquary Vault/));
  const narrow = egHeroFragRegistry([{ ...C, floors: C.floors.map((f) => (f.fight && f.y === 0 ? { ...f, poly: [[600, 100], [600, 3300], [-600, 3300], [-600, 100]] } : f)),
    graph: { ...C.graph, nodes: C.graph.nodes.map((n) => (n[1] === 0 ? [Math.max(-500, Math.min(500, n[0])), ...n.slice(1)] : n)) } }]);
  withHeroes(() => assert.match(egHeroTrials(...H.proving, 8).find((t) => t.id).why, /proving's place at \(-?\d+, \d+\) stands on none of its fight floors/), narrow);
  withHeroes(() => assert.equal(egHallOf(...H.deepRift, 8).heroes?.[0].id, 'egLayChamber', 'its rifts in its walls its own places, never held to its floor'), narrow);
  assert.deepEqual(prov.foe, { x: 0, z: (cm(qp.z) + R.cz + 400) / 100 }, 'the champion 4 m past its middle');
  // the Clan Pit's own call: a chamber of its kit stands its Honour Horn at the court's middle
  const pit = egHeroFragRegistry([{ ...C, id: 'egLayPit', kit: 'clanpit', band: 3, reverb: 'quarry', variant: 'test-pit' }]);
  withHeroes(() => {
    let found = null;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) for (let h = 77; h <= 100 && !found; h++) { const s = egHallOf(seed, h, 0, 8); if (s.heroes) found = s; }
    assert.ok(found, 'a Clan Pit hero laid');
    const q = found.heroes[0];
    assert.deepEqual(found.spots.horn, [{ x: 0, z: (cm(q.z) + R.cz) / 100, r: 6 }]);
    assert.deepEqual(found.engines, [], 'the Clan Pit has no engine');
  }, pit);
  // the shaft: the course on from its exit, its height under its mouth
  const sh = hall('shaft'), qh = sh.heroes[0], S = FX.shaft.law, law6 = egHallOf(...H.shaft.slice(0, 2), 0, 6);
  assert.equal(qh.cls, 'shaft');
  assert.ok(!sh.caves.some((c) => c.shaft), 'no code-built shaft beside it');
  const after = sh.frags[qh.f + 1];
  assert.deepEqual([after.cls, after.z0, after.y], ['passage', qh.z + S.box[5] / 100, qh.y + S.sockets.out[0].y / 100], 'the last passage at its exit, at the exit\'s height');
  assert.ok(Math.abs(sh.end.y - (qh.y - 6.2)) < 1e-9 && sh.end.y !== law6.end.y, 'the end plate down with it');
  assert.deepEqual(egShaftLedgeAt(sh, egToDungeon(sh, 0, qh.y + 0.05, qh.z + 1.5)), [0, 1], 'on its rim the camera leans out over the drop');
  assert.equal(egShaftLedgeAt(sh, egToDungeon(sh, 0, qh.y - 6.15, qh.z + 27)), null, 'never on its foot');
});

test('EG-HERO-LAY THE SOLVER AND THE REAL MOTOR (section 10.5; tools/egSpanSolve.mjs): every course of a hall a hero stands in is proven by THE TIMED SOLVER, and the sweep\'s real motor (player/motor.js PlayerMotor on player/collider.js Collider over the circle\'s floors - the hero\'s proxy in its bucket - and its pieces as the screen rides them) crosses each: a Span\'s two roads through a passage, a first circle\'s Span, a Deepway down a hero shaft and through a hero chamber (mutants: the proxy left out of the collider; the hero\'s floors unread by the sweep\'s ground)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): spec law 8's circles swept (give8); a LAW 9 hall's courses are swept along its route
  // by THE ROUTE'S PROOFS (tools/egSpanSolve.mjs)
  withHeroes(() => {
    for (const k of ['low', 'high', 'shaft', 'deepCh']) {
      give8(H[k][0], egCircleOfHall(H[k][1]));
      const [seed, h, geo] = H[k], S = sweepStand(seed, egCircleOfHall(h), geo), spec = S.specs.find((s) => s.h === h);
      assert.ok(spec.heroes, `${k}: its hero stood`);
      assert.ok(egSpanProof(spec).ok, `${k}: proven`);
      for (const road of [0, 1]) {
        if (!egCourseOf(spec, road)?.steps.length) continue;
        const r = sweepCourse(S, spec, road, 1_800_000_000 + 0.37 + 200 * road);
        assert.ok(r.ok, `${k} road ${road}: ${r.why} at step ${r.step}`);
      }
      S.span.clear();
      egSpecForget();
    }
  });
});


test('EG-HERO-LAY THE RELAY JUDGES FROM THE LAW (sections 11.7, 13.2 and 21): the census\'s fight floor is the hero\'s polygons at their heights (net/eliteGates/egFair.js egFightFloorAt - its balcony 1.5 m up the highest under a body on it; its chasm none), its hazards bite on the shared clock - judged by the relay (net/bossRef.js judgePlace) as every screen bites (egHazardBites) - only on its fight floor; the union floor\'s floor, the fight floor\'s piece and the legion\'s keep are its polygons; its floors and stairs hold a body on the fair trail (mutants: a polygon unread in each)', () => {
  const spec = hall('low'), q = spec.heroes[0], h = spec.h;
  const near = [q.x, q.y, q.z + 5], chasm = [q.x, q.y, q.z + 15], balc = [q.x + 2.25, q.y + 1.5, q.z + 27.5], far = [q.x, q.y, q.z + 25];
  assert.deepEqual(egFightFloorAt(spec, ...near)?.poly, spec.fl.find((f) => f.t === 'p' && egPolyIn(f.poly, near[0], near[2]))?.poly);
  assert.equal(egFightFloorAt(spec, ...chasm), null, 'the chasm is no fight floor');
  assert.equal(egFightFloorAt(spec, ...balc)?.y, q.y + 1.5, 'the balcony, the highest under a body on it');
  assert.equal(egFightFloorAt(spec, far[0] + 2.25, q.y, far[2] + 2.5)?.y, q.y, 'under the balcony, the floor');
  assert.ok(egOnFight(spec, near[0], near[2]) && !egOnFight(spec, chasm[0], chasm[2]) && !egOnFight(spec, q.x + 2.9, q.z + 5, -0.5) && egOnFight(spec, q.x + 2.4, q.z + 5, -0.5));
  assert.equal(egFightPieceAt(spec, near[0], near[2]).t, 'p');
  assert.ok(egOnFloor(spec, q.x, q.z + 0.5) && egOnFloor(spec, q.x + 2.25, q.z + 23.75) && !egOnFloor(spec, q.x - 2.8, q.z + 15), 'its floors and stair are floor, its chasm none');
  assert.ok(egOnFloor({ ...spec, heroes: [{ ...q, floors: [] }] }, q.x + 2.25, q.z + 23.75), 'its stair is floor by itself (its floors taken away)');
  assert.deepEqual(egKeepOnFight(spec, chasm[0], q.z + 12, 0.5), [chasm[0], q.z + 8.5], 'kept half a metre inside the near floor\'s lip');
  assert.ok(egFloorTest(spec)(near[0], near[2]) && !egFloorTest(spec)(chasm[0], chasm[2]), 'the union floor\'s floor');
  // the fair trail: its floors (a fight floor or not) and its stair hold a body; its chasm holds none
  assert.equal(egSupportAt(spec, q.x, q.y, q.z + 0.5, 0), EG_HOLD.island, 'its threshold');
  assert.equal(egSupportAt(spec, ...balc, 0), EG_HOLD.island, 'its balcony');
  assert.equal(egSupportAt(spec, q.x + 2.25, q.y + 0.75, q.z + 23.75, 0), EG_HOLD.island, 'its stair');
  // its basalt falls on the near floor: the relay's judge and the screen's own bite agree, on the floor alone
  const basalt = spec.hazards.find((z) => z.kind === 'basalt');
  let tLive = 0;
  for (let t = 1_800_000_000; ; t += 0.05) { const p = egHazardParts(basalt, t).find((x) => x.st === 'live'); if (p) { tLive = t; break; } }
  const part = egHazardParts(basalt, tLive).find((x) => x.st === 'live'), [sx, sz] = [part.sh[1], part.sh[2]], now = Math.round(tLive * 1000);
  assert.ok(egHazardBites(basalt, part, sx, q.y, sz), 'the screen\'s bite');
  const trail = (x, y, z) => [[now - 100, x, y, z, h], [now + 100, x, y, z, h]];
  const F = { h };
  const hits = judgePlace(F, spec, 1, [{ sub: 'a', tr: trail(sx, q.y, sz) }, { sub: 'b', tr: trail(sx, q.y - 6, sz) }], now);
  assert.deepEqual(hits.map((x) => x.sub), ['a'], 'the relay\'s: the body on the floor, never one under it');
  // the union floor walls the escape at its polygon's edges: a lane across the whole near floor leaves no floor
  const blow = { s: [['l', q.x - 5, q.z + 5, q.x + 5, q.z + 5, 14]], at: 2000, ch: 0 };
  assert.equal(egUnionHolds([], blow, near[0], near[2], 0, egFloorTest(spec)), true, 'nowhere to stand on its floor');
});

test('EG-HERO-LAY THE LEGION WALKS ITS GRAPH (section 11.7): the hall\'s walk graph takes the hero\'s fight floors as regions, met where their plans meet, its stair the way up, its law\'s nodes and edges joined and a node at its sockets\' feet; a walker on its floor goes up to its balcony by the stair, and on a notched floor goes round the notch, never through it; its feet ride its floors; its walls stand in the fliers\' air (mutants: the record\'s graph unread; a straight walk through the notch; the polygon\'s nearest unread; the walls left out of the air)', () => {
  const spec = hall('low'), q = spec.heroes[0], view = egFightView(spec), G = egWalkGraph(view);
  const has = (x, z) => G.nodes.some((n) => Math.abs(n.x - x) < 1e-9 && Math.abs(n.z - z) < 1e-9);
  let joined = 0;
  for (const [x, y, z] of q.graph.nodes) if (spec.fl.some((f) => f.t === 'p' && Math.abs(f.y - y) <= 0.6 && egPolyIn(f.poly, x, z, 0.3))) { joined++; assert.ok(has(x, z), `its node (${x}, ${z})`); }
  assert.equal(joined, 6, 'its six nodes on its fight ground - the threshold\'s alone on none');
  const ex = q.sockets.out[q.exit];
  assert.ok(has(ex.x, ex.z), 'a node at its exit\'s foot');
  // from its floor up to its balcony: by the stair's foot
  const b = { x: q.x - 1, z: q.z + 26, y: q.y, fr: -1, wn: -1 };
  const [x1, z1, last] = egWalkNext(view, b, q.x + 2.25, q.z + 28.5, q.y + 1.5);
  assert.equal(last, false, 'not straight up its wall');
  assert.deepEqual([x1, z1], [q.x + 2.25, q.z + 22.5], 'to the stair\'s foot first');
  assert.equal(egFeetAt(view, q.x + 2.25, q.z + 28, q.y + 1.5), q.y + 1.5, 'feet on the balcony');
  assert.equal(egGroundAt(view, q.x + 2.25, q.y, q.z + 28)?.y, q.y, 'and under it, the floor');
  // a notched floor (an L): from one arm to the other the walk goes by the corner, never through the notch
  const L = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  const lv = { fl: [{ t: 'p', poly: L, y: 0 }], heroes: [{ graph: { nodes: [[2, 0, 2, 0.5]], edges: [] }, sockets: { in: { x: 2, y: 0, z: 0 }, out: [] }, floors: [], open: [] }] };
  assert.equal(egSeesIn(L, 8, 2, 2, 8), false); assert.equal(egSeesIn(L, 8, 2, 2, 2), true);
  const w = { x: 8, z: 2, y: 0, fr: -1, wn: -1 }, step = egWalkNext(lv, w, 2, 8, 0);
  assert.deepEqual(step, [2, 2, false], 'by the corner\'s node');
  assert.deepEqual(egWalkNext(lv, { x: 3, z: 3, y: 0, fr: -1, wn: -1 }, 2, 8, 0), [2, 8, true], 'straight where the way stays on it');
  assert.deepEqual(egPolyKeep(L, 6, 8, 0.5), [3.5, 8], 'the nearest point, half a metre inside the notch\'s wall');
  assert.ok(egPolyDist(L, 7, 7) > 0 && egPolyDist(L, 2, 2) < 0 && egPieceIn({ t: 'p', poly: L }, 2, 9.6, -0.3) && !egPieceIn({ t: 'p', poly: L }, 2, 9.8, -0.3));
  // the air: a flier never through its walls
  const A = egAirOf(spec);
  assert.equal(egAirClear(A, q.x - 6, q.z + 5, q.x + 1, q.z + 5), false, 'its west wall');
  assert.equal(egAirClear(A, q.x - 1, q.z + 2, q.x + 1, q.z + 28), true, 'along it, the way clear');
});

test('EG-HERO-LAY THE CLIENT DRAWS IT (sections 11.6-11.9; THE SWAP; EVERY ALLOCATION HAS AN OWNER): the circle\'s one mesh carries the hero\'s mesh half at its origin (its ground where its law lays ground, its rock a record\'s cell at a time, each an occluder of its own) and the circle\'s one collider bucket its proxy - so they are freed with the circle, no buffer of their own; its lights join the circle\'s in its kit\'s colours; its clamp is its law\'s - its walls hold, its open edges and stair free, its ceiling over it or the sky; its reverb zone its box\'s reach; no code-built niche or spout inside its box; its fight floors cut for the telegraph pass (mutants: the mesh off its origin; its rock not dithered; its ground told by its record; its rock one piece; the proxy dropped; a wall unread; an open edge clamped; the ceiling unread)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): the circle drawn of spec law 8's halls (give8)
  withHeroes(() => {
    const [seed, h] = H.low, c = egCircleOfHall(h);
    give8(seed, c);
    const spec = egHallOf(seed, h, 0), q = spec.heroes[0], mesh = EG_HERO_FRAG_MESHES.egRefFrag;
    const model = buildEgCircleModel(seed, c, 0), tris = egCircleColliderTris(seed, c, 0);
    egHeroMeshSeam({});   // the same halls, the hero's mesh unknown to this build: its law stands, nothing of it drawn
    const bare = buildEgCircleModel(seed, c, 0), bareTris = egCircleColliderTris(seed, c, 0);
    egHeroMeshSeam(MESHES);
    assert.equal(model.indices.length - bare.indices.length, mesh.indices.length, 'its every triangle in the circle\'s one mesh');
    // PIN MOVED (EG-HERO-LAY at the merge of the ten heroes): its ground is where its law lays ground (a triangle topping out
    // within a hand of a floor or a stair's corner), never told by its record; its rock a record's cell at a time, each an
    // occluder of its own (EG_HERO_ROCK_CELL_M) - a ray dithers the rock it crosses, never the whole fragment
    const ys = egHeroGroundYs(q), cells = new Set();
    let rockTris = 0;
    for (const sm of mesh.subMeshes) for (let k = sm.startIndex; k < sm.startIndex + sm.primitiveCount * 3; k += 3) {
      const P3 = [0, 1, 2].map((v) => mesh.indices[k + v] * 3), top = Math.max(...P3.map((p) => mesh.positions[p + 1]));
      if (ys.some((y) => Math.abs(top - y) <= EG_HERO_GROUND_HAND_M)) continue;
      rockTris++;
      cells.add(`${sm.record}:${Math.floor(P3.reduce((a, p) => a + mesh.positions[p], 0) / 3 / EG_HERO_ROCK_CELL_M)}:${Math.floor(P3.reduce((a, p) => a + mesh.positions[p + 2], 0) / 3 / EG_HERO_ROCK_CELL_M)}`);
    }
    const ownedTris = (m) => m.occluders.reduce((a, o) => a + o.r.reduce((b, [, , n]) => b + n, 0), 0);
    assert.ok(rockTris > 0 && rockTris < mesh.indices.length / 3, 'some of it ground, some rock');
    assert.equal(ownedTris(model) - ownedTris(bare), rockTris, 'its rock, and none of its ground, the occluders\'');
    assert.equal(model.occluders.length - bare.occluders.length, cells.size, 'a piece a record\'s cell');
    assert.equal(tris.length - bareTris.length, mesh.collider.length, 'its proxy in the circle\'s one bucket');
    const at = egToDungeon(spec, q.x, q.y, q.z);
    const want = Float32Array.from(mesh.collider, (v, i) => v + at[i % 3]);
    let k = -1;
    for (let i = 0; i + want.length <= tris.length && k < 0; i += 9) if (want.every((v, j) => tris[i + j] === v)) k = i;
    assert.ok(k >= 0, 'its proxy at its origin, whole, in the bucket');
    const pos = new Set(); for (let i = 0; i < model.positions.length; i += 3) pos.add(`${Math.round(model.positions[i] * 100)},${Math.round(model.positions[i + 1] * 100)},${Math.round(model.positions[i + 2] * 100)}`);
    for (let v = 0; v < mesh.positions.length; v += 3) assert.ok(pos.has(`${Math.round((mesh.positions[v] + at[0]) * 100)},${Math.round((mesh.positions[v + 1] + at[1]) * 100)},${Math.round((mesh.positions[v + 2] + at[2]) * 100)}`), `vertex ${v / 3} at its origin`);
    const bareB = new Set(bare.occluders.map((o) => o.b.join())), rock = model.occluders.filter((o) => !bareB.has(o.b.join()));
    assert.equal(rock.length, cells.size);
    assert.ok(rock.every((o) => o.r.length === 1), 'each piece one record\'s');
    const B = rock.reduce((b, o) => [Math.min(b[0], o.b[0]), Math.min(b[1], o.b[1]), Math.min(b[2], o.b[2]), Math.max(b[3], o.b[3]), Math.max(b[4], o.b[4]), Math.max(b[5], o.b[5])], [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    assert.ok(B[1] < at[1] && B[4] > at[1] + 6 && B[0] < at[0] - 3 && B[3] > at[0] + 3, 'its rock: its walls and vault, about its origin');
    const parts = egCircleParts(seed, c, 0);
    assert.equal(egCirclePartsTransfers(parts).length, 4 + 1 + parts.gates.length * 5, 'no buffer of its own: the circle\'s mesh and bucket carry it');
    const lamps = egCircleLights(seed, c, 0), band = lamps.filter((l) => Math.abs(l.y - (at[1] + 4)) < 1e-6 && Math.abs(l.x - at[0]) < 1e-6);
    assert.deepEqual(band.map((l) => l.color), [[...EG_FRAGS.caverns.light], [...EG_FRAGS.caverns.light]], 'its band lights in its kit\'s colour');
    assert.ok(lamps.some((l) => Math.abs(l.y - (at[1] + 1)) < 1e-6 && l.color.join() === EG_LAMP.lava.join()), 'its lava light');
    // its clamp: its law's walls, open edges and ceilings
    const zones = egFragZones(spec), Z = zones.find((z) => z.t === 'hero');
    assert.ok(Z && !zones.some((z) => z.t === 'passage' && z.x === q.x), 'a hero zone, no code-built passage\'s');
    const arena = (x, y, z) => egFragArena(spec, egToDungeon(spec, x, y, z));
    const A = arena(q.x, q.y, q.z + 5);
    assert.ok(Math.abs(A.ceilAbove - (6 - 1.8)) < 1e-9, 'under its vault: 6 m less the body');
    assert.equal(arena(q.x, q.y, q.z + 25.5).ceilAbove, 6 - 1.8);
    assert.equal(arena(q.x, q.y + 0.1, q.z + 14.5)?.ceilAbove ?? Infinity, Infinity, 'over its chasm, open to the sky');
    const keep = (x, y, z) => { const a = arena(x, y, z); const p = a?.clamp(egToDungeon(spec, x, y, z), 0.35); return p ? [Math.round((dungeonToRealm(p[0], 0, p[1])[0] - spec.x0) * 100) / 100, Math.round(dungeonToRealm(p[0], 0, p[1])[2] * 100) / 100] : null; };
    assert.deepEqual(keep(q.x + 2.9, q.y, q.z + 5), [q.x + 2.65, q.z + 5], 'its east wall holds the body its radius inside');
    assert.equal(keep(q.x + 2, q.y, q.z + 5), null, 'clear of it, nothing');
    assert.equal(keep(q.x, q.y, q.z + 9.3), null, 'its chasm\'s lip is open - a body steps off into the void');
    assert.equal(keep(q.x + 2.8, q.y + 0.75, q.z + 23.75), null, 'on its stair, free - its wall 0.2 m off');
    assert.deepEqual(keep(q.x + 2.8, q.y, q.z + 21.5), [q.x + 2.65, q.z + 21.5], 'off it, on its floor, that wall holds');
    assert.equal(keep(q.x, q.y, q.z + 8.8), null, 'at its chasm\'s lip, inside its floor: that edge is open');
    assert.deepEqual(keep(q.x + 3.4, q.y, q.z + 5), [q.x + 2.65, q.z + 5], 'past its wall, put back inside');
    // the reverb's zone: its box's reach across
    const zone = egHallReverb(spec).zones.find((z) => Math.abs(z.x - q.x) < 1e-9);
    assert.deepEqual([zone.half, zone.z0, zone.z1, zone.preset], [4.5, q.z, q.z + 30, 'Cave']);
    // the telegraph pass: each fight floor polygon cut into triangles of its own area
    const fl = egFightFloors(spec).filter((f) => f.piece.t === 'p');
    for (const f of fl) {
      let area = 0; for (let t = 0; t < f.tris.length; t += 6) area += Math.abs((f.tris[t + 2] - f.tris[t]) * (f.tris[t + 5] - f.tris[t + 1]) - (f.tris[t + 4] - f.tris[t]) * (f.tris[t + 3] - f.tris[t + 1])) / 2;
      const P = f.piece.poly; let a2 = 0; for (let i = 0; i < P.length; i++) a2 += P[i][0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * P[i][1];
      assert.ok(Math.abs(area - a2 / 2) < 1e-3, 'its triangles its own area');
    }
    assert.ok(egOnFloorAt(spec, q.x + 2, q.z + 5, q.y, 0.5) && !egOnFloorAt(spec, q.x + 2.8, q.z + 5, q.y, 0.5));
    // a chamber's mesh, read from the meshes it is handed (a test's seam)
    const [s2, h2] = H.deepCh, c2 = egCircleOfHall(h2);
    give8(s2, c2);
    const withMesh = buildEgCircleModel(s2, c2, 0);
    egHeroMeshSeam({});
    const without = buildEgCircleModel(s2, c2, 0);
    egHeroMeshSeam(MESHES);
    assert.equal(withMesh.indices.length - without.indices.length, FX.chamber.mesh.indices.length, 'the chamber\'s mesh drawn');
    // nothing code-built inside its box - no stair, no niche: its own mesh and proxy hold them
    const lo = egToDungeon(spec, q.box[0] + 0.05, q.box[1] + 0.05, q.box[2] + 0.05), hi = egToDungeon(spec, q.box[3] - 0.05, q.box[4] - 0.05, q.box[5] - 0.05);
    const inBox = (a, i) => a[i] > lo[0] && a[i] < hi[0] && a[i + 1] > lo[1] && a[i + 1] < hi[1] && a[i + 2] > lo[2] && a[i + 2] < hi[2];
    for (let i = 0; i < bareTris.length; i += 3) assert.ok(!inBox(bareTris, i), 'no code-built collider triangle in its box');
    for (let i = 0; i < bare.positions.length; i += 3) assert.ok(!inBox(bare.positions, i), 'no code-built drawn vertex in its box');
  });
  egSpecForget();
  // no code-built spout over a hero's slag, nor niche in its walls
  const slag = { x0: 0, steps: [{ kind: 'slag', x: 0, y: 0, z: 10, w: 4, d: 3, amp: 2.05, period: 20, phase: 0 }], caves: [] };
  assert.equal(egSlagSpouts(slag).length, 2);
  assert.equal(egSlagSpouts({ ...slag, heroes: [{ box: [-5, -1, 0, 5, 6, 20] }] }).length, 0);
});

test('EG-HERO-LAY A DURABLE BREACH KEEPS ITS LAW (section 22, THE LAW PIN): with heroes registered, a breach opened under law 6 draws law 6\'s halls - no hero in any - and its director\'s digest is law 6\'s, while a breach of law 7 draws the hero\'s hall (mutants: the breach\'s law forgotten; law 6 laying heroes)', () => {
  withHeroes(() => {
    const [seed, h] = H.low;
    const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
    B.h = h; B.egv = 7;   // PIN MOVED (THE ASCENT): the breach of law 7 named (one opened now is of law 9)
    const s7 = egHallOf(seed, h, 0, 7), s6 = egHallOf(seed, h, 0, 6);

    assert.ok(s7.heroes && !s6.heroes);
    assert.equal(egStateOf(B, 1_800_000_000_000).dg, egSpecDigest(s7), 'law 7\'s breach: the hero\'s hall');
    B.egv = 6;
    assert.equal(egStateOf(B, 1_800_000_000_000).dg, egSpecDigest(s6), 'law 6\'s breach: law 6\'s hall');
    for (const [s, hh, g] of LAW_HALLS.slice(0, 200)) assert.equal(egHallOf(s, hh, g, 6).heroes, undefined);
  });
});

test('EG-HERO-LAY THE RELAY\'S BUNDLE (test/net/relayversion.test.js RELAY_GRAPH): net/eliteGates/egHeroFrags.js and every hero law JSON it imports walk under net/eliteGates/egLaw.js, after net/eliteGates/egFragLaw.js - no world/, scenes/ or render/ file joins, and no mesh half; net/eliteGates/egHeroFrags.js imports the reader and the law halves alone (mutants: a mesh half in the relay; the registry not the law\'s)', () => {
  const RELAY_GRAPH = graph('server/src/index.js');
  const i = RELAY_GRAPH.indexOf('src/net/eliteGates/egFragLaw.js');
  assert.deepEqual(RELAY_GRAPH.slice(i - 1, i + 3), ['src/net/eliteGates/egLaw.js', 'src/net/eliteGates/egFragLaw.js', 'src/net/eliteGates/egHeroFrags.js', 'src/assets/egfrags/egRefFrag.law.json']);
  assert.deepEqual(RELAY_GRAPH.filter((f) => /^src\/(world|scenes|render)\//.test(f)), ['src/world/mat4.js', 'src/world/segment.js']);
  assert.ok(!RELAY_GRAPH.some((f) => f.endsWith('.mesh.json')), 'no mesh half');
  const src = readFileSync(new URL('../../../src/net/eliteGates/egHeroFrags.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.ok(imports.every((p) => p === './egFragLaw.js' || /^(?:\.\.\/)+assets\/egfrags\/[A-Za-z0-9]+\.law\.json$/.test(p)), imports.join(', '));
  assert.match(readFileSync(new URL('../../../src/net/eliteGates/egLaw.js', import.meta.url), 'utf8'), /^import \{ EG_HERO_FRAGS, egHeroFragLaws \} from '\.\/egHeroFrags\.js';/m);
});
