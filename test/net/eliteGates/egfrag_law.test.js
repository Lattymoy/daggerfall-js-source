// EG-FULL, LAYER THREE (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 11): THE FRAGMENTS'
// LAW (net/eliteGates/egFragLaw.js), laid into the hall spec (net/eliteGates/egLaw.js) and proven by THE TIMED SOLVER (net/eliteGates/egSpanLaw.js) - the
// ten fragments and their signatures, every hazard inside THE WIDTH RULE and THE WIND-UP FLOOR on the shared clock, the
// passages' inner courses, the set pieces, THE FORK's two roads, the chambers' plays, the fragments' own pieces (the Moon
// branch, the Drum, the Bone bridge, the Sinking flight), THE MEDIAN, the ground after each run, the Annals of 3E 398.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EG_FRAGS, EG_PASSAGE_KITS, EG_CHAMBER_KITS, EG_SET_PIECES, EG_FRAG_PIECES, EG_HAZARDS, EG_ENGINES, EG_VIGNETTES, EG_PLAYS, EG_TUBE_MPS,
  egFragPassage, egFragChamber, egSetPiece, egSetPieceOf, egHazardParts, egHazardBites, egHazardLawful, egEclipseShafts, egWispAt, egMistAt, egTubeEdge, egTubeFair } from '../../../src/net/eliteGates/egFragLaw.js';
import { egPieceAt, egMoonBeamZ, egSpanProof, egSpanPairs, egRoadCross, egPairWindows, EG_MOON_MPS, EG_MOON_HALF, EG_MOON_EVERY_S, EG_DRUM_MPS, EG_SINK_MPS, EG_SINK_ON_S,
  EG_SPAN_RUN_MPS, EG_MEDIAN_X, EG_CRUMBLE_KINDS } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egHallOf, egCircleSpecs, egFirstHallOf, egTubeCircle, egOnFight, egAtDoor, egCirclePlan, EG_HALL_LEN_MAX, EG_FORK_FROM_C, EG_LOW_X_CM, EG_STEP } from '../../../src/net/eliteGates/egLaw.js';
import { EG_ANNALS, EG_ANNALS_FOUND, EG_ANNALS_LORDS, egAnnalsLordPage, egAnnalsNext } from '../../../src/net/eliteGates/egAnnals.js';
import { EG_BOSS_KEYS } from '../../../src/net/eliteGates/egLords.js';
import { egWindupFloorMs, shLane, shDisc, egPolyIn } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';   // AUDIT EG V: a caster pillar's stair climbs to the fight ground
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);

const SEEDS = [77, 0xbeef, 3, 0x51ee, 12345];
/** Every hall over the seeds and twenty circles (the plain ground and one of each span decree). */
function* halls(geos = [0, 4]) {
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) for (const geo of geos) yield* egCircleSpecs(seed, c, geo);
}

test('EG-FULL LAYER THREE THE LIBRARY (section 11.2): ten fragments, four bands, each its classes, its reverb, its light, its signature; every band\'s passages and chambers its own library\'s; the set pieces one a band; every engine and vignette named (mutants: a fragment in another band\'s library; a chamber kit with no chamber class)', () => {
  assert.deepEqual(Object.keys(EG_FRAGS), ['caverns', 'stacks', 'colonnade', 'ossuary', 'mist', 'gloam', 'eclipse', 'forge', 'clanpit', 'deep']);
  assert.deepEqual(Object.values(EG_FRAGS).map((f) => f.band), [0, 0, 0, 1, 1, 2, 2, 3, 3, 3]);
  for (const [b, list] of EG_PASSAGE_KITS.entries()) for (const k of list) { assert.equal(EG_FRAGS[k].band, b, `${k} in band ${b}`); assert.ok(EG_FRAGS[k].classes.includes('passage'), `${k} a passage`); }
  for (const [b, list] of EG_CHAMBER_KITS.entries()) for (const k of list) { assert.equal(EG_FRAGS[k].band, b, `${k} in band ${b}`); assert.ok(EG_FRAGS[k].classes.includes('chamber'), `${k} a chamber`); }
  for (const [k, f] of Object.entries(EG_FRAGS)) {
    assert.ok(['cave', 'stoneroom', 'quarry'].includes(f.reverb), `${k}'s reverb a preset`);
    assert.equal(f.light.length, 3);
    assert.ok(f.sign.length > 10 && EG_VIGNETTES[k]?.length, `${k}'s signature and vignettes`);
    if (f.engine) assert.ok(EG_ENGINES[f.engine], `${k}'s engine`);
  }
  assert.deepEqual([...EG_SET_PIECES], ['tube', 'sinking', 'moonpath', 'forgeline']);
  assert.ok(EG_PLAYS.includes('balcony') && EG_PLAYS.includes('arch') && EG_PLAYS.includes('surge') && EG_PLAYS.includes('engine'));
});

test('EG-FULL LAYER THREE THE HAZARDS ON THE SHARED CLOCK (section 11.2): a fire fall burns 2 s of every 5, its white shimmer the 1 s before; a cascade\'s shelves topple 1.5 s apart, each told 1.2 s; the Eclipse comes every 40 s told 6 s, its moon-shafts r 3 walking 1.5 m/s; the tide floods 15 s of every 60 told 5 s, ticking a second; a soul-wisp drifts its path; the mist rises and never harms; a bite only inside a live part, at its height - outside the Eclipse\'s havens (mutants: a fire fall untold; the cascade all at once; an Eclipse under its havens)', () => {
  const fall = { kind: 'fall', i: 0, sh: [-3, 10, 3, 10], w: 1.2, y: 0, phase: 0, period: 0 };
  let live = 0, tell = 0, tellBeforeLive = true, wasTell = false;
  for (let k = 0; k < 500; k++) {
    const p = egHazardParts(fall, k / 100)[0];
    if (p?.st === 'live') { live++; if (!wasTell && k % 500 > 0 && egHazardParts(fall, (k - 1) / 100)[0]?.st == null) tellBeforeLive = false; }
    if (p?.st === 'tell') tell++;
    wasTell = p?.st === 'tell' || p?.st === 'live';
  }
  assert.ok(Math.abs(live - 200) <= 1 && Math.abs(tell - 100) <= 1, `a fire fall: ${live / 100} s burning, ${tell / 100} s shimmering in 5`);
  assert.ok(tellBeforeLive, 'every burning follows its shimmer');
  // the cascade: shelf j told from 1.5 x j s
  const cas = { kind: 'cascade', i: 1, lanes: [[-3, 2, 3, 2], [-3, 8, 3, 8], [-3, 14, 3, 14]], w: 4, y: 0, phase: 0 };
  const firstTell = (j) => { for (let k = 0; k < 1000; k++) if (egHazardParts(cas, k / 100).some((p) => p.key.startsWith(`1:${j}:`) && p.st === 'tell')) return k / 100; return -1; };
  assert.deepEqual([0, 1, 2].map(firstTell), [0, 1.5, 3]);
  assert.ok(egHazardParts(cas, 1.3).some((p) => p.key.startsWith('1:0:') && p.st === 'live') && !egHazardParts(cas, 1.3).some((p) => p.key.startsWith('1:2:')), 'one shelf falls while the last is still standing');
  // the Eclipse: every 40 s, told 6 s; its havens r 3, walking 1.5 m/s
  const ecl = { kind: 'eclipse', i: 2, x: 0, z: 30, ring: 9, y: 0, phase: 0, period: 0 };
  assert.equal(egHazardParts(ecl, 33.4).length, 0);
  assert.equal(egHazardParts(ecl, 33.6)[0].st, 'tell');
  const pl = egHazardParts(ecl, 39.8)[0];
  assert.equal(pl.st, 'live');
  const [a0] = egEclipseShafts(ecl, 10), [a1] = egEclipseShafts(ecl, 11);
  assert.ok(Math.abs(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) - 1.5) < 0.01, 'the shafts walk 1.5 m/s');
  const [h] = egEclipseShafts(ecl, 39.8);
  assert.equal(egHazardBites(ecl, pl, h[0] + 1, 0, h[1]), false, 'inside a moon-shaft - a haven');
  assert.equal(egHazardBites(ecl, pl, 0, 0, 30), true, 'outside every shaft - struck');
  // the tide: 15 s of every 60, told 5 s, a key each second
  const tide = { kind: 'tide', i: 3, x: 0, z: 20, r: 16, y: 0, phase: 0, period: 0 };
  assert.equal(egHazardParts(tide, 39).length, 0);
  assert.equal(egHazardParts(tide, 41)[0].st, 'tell');
  const t1 = egHazardParts(tide, 46)[0], t2 = egHazardParts(tide, 47.2)[0];
  assert.ok(t1.st === 'live' && t2.st === 'live' && t1.key !== t2.key, 'the tide ticks each second');
  assert.equal(egHazardBites(tide, t1, 0, 2.5, 20), false, 'two and a half metres up - the dry floor');
  assert.equal(egHazardBites(tide, t1, 0, 0, 20), true);
  // the wisp drifts; the mist never harms
  const wisp = { kind: 'wisp', i: 4, path: [0, 10, 2, 1.5], y: 1.2, period: 9, phase: 0 };
  assert.notDeepEqual(egWispAt(wisp, 0), egWispAt(wisp, 2));
  assert.equal(EG_HAZARDS.mist.pct, 0);
  const mist = { phase: 0 };
  assert.equal(egMistAt(mist, 0.5), 1.5);
  assert.equal(egMistAt(mist, 2), 3);
  assert.equal(egMistAt(mist, 8), 0);
  // a bite only inside, live, at its height
  const surge = { kind: 'surge', i: 5, sh: [-1, 0, -1, 20], w: 4, y: 0, phase: 0, period: 0 };
  const sl = egHazardParts(surge, 7.5)[0];
  assert.equal(sl.st, 'live');
  assert.equal(egHazardBites(surge, sl, -1, 0, 10), true);
  assert.equal(egHazardBites(surge, sl, 2, 0, 10), false, 'outside the lane');
  assert.equal(egHazardBites(surge, sl, -1, 3, 10), false, 'above it');
  assert.equal(egHazardBites(surge, egHazardParts(surge, 6.5)[0], -1, 0, 10), false, 'told, not yet live');
});

test('EG-FULL LAYER THREE THE HAZARD LAW (sections 11.2 and 13.2): every hazard any hall lays keeps THE WIDTH RULE and its tell THE WIND-UP FLOOR - the surges\' and the shelves\' lanes 4 m, the basalt\'s disc r 2.5, the hammers\' r 3; the fire fall a timed traversal hazard of the place; NOTHING GETS FASTER, a hazard\'s clock the same at every depth (mutants: a 3 m surge; a hammer told under its floor)', () => {
  assert.equal(egWindupFloorMs(shLane(0, 0, 0, 10, 4)), 790);
  assert.ok(EG_HAZARDS.surge.tell >= egWindupFloorMs(shLane(0, 0, 0, 10, 4)) && EG_HAZARDS.cascade.tell >= egWindupFloorMs(shLane(0, 0, 0, 10, 4)));
  assert.ok(EG_HAZARDS.basalt.tell >= egWindupFloorMs(shDisc(0, 0, 2.5)) && EG_HAZARDS.hammer.tell >= egWindupFloorMs(shDisc(0, 0, 3)));
  assert.equal(EG_HAZARDS.fall.aim, 'trav');
  assert.equal(egHazardLawful({ kind: 'surge', sh: [0, 0, 0, 10], w: 3 }).ok, false, 'a 3 m surge refused');
  assert.equal(egHazardLawful({ kind: 'basalt', spots: [[0, 0]], r: 6 }).ok, false, 'a disc too wide for its tell refused (its floor 1.36 s past the basalt\'s 1.2)');
  const kinds = new Set(), clocks = {};
  for (const s of halls()) for (const hz of s.hazards) {
    kinds.add(hz.kind);
    const L = egHazardLawful(hz);
    assert.ok(L.ok, `hall ${s.h} (${hz.kind}): ${L.why.join(', ')}`);
    // a surge's channels and a wisp's path keep their own clocks; every other hazard's is its law's, at every depth
    if (hz.kind !== 'surge' && hz.kind !== 'wisp') { clocks[hz.kind] ??= hz.period; assert.equal(hz.period, clocks[hz.kind], `${hz.kind}'s clock at every depth`); }
  }
  for (const k of ['fall', 'surge', 'basalt', 'cascade', 'wisp', 'mist', 'hammer', 'tide', 'eclipse', 'hammerline']) assert.ok(kinds.has(k), `some hall lays a ${k}`);
});

test('EG-FULL LAYER THREE THE PASSAGES (sections 11.1, 11.5, 11.6 and 11.8): each kit\'s plan is whole centimetres and milliseconds, its inner course of its own pieces inside its chasm, its headroom at least 4.5 m over a walled course, its alcoves behind its walls; laid into a hall, its floors its fight floors and the chasm the course\'s - the law decides in integers, no transcendental in its generator (mutants: a course past its chasm; a passage under its headroom)', () => {
  for (const kits of EG_PASSAGE_KITS) for (const kit of kits) for (const seed of [1, 2, 3, 99]) {
    let st = seed;
    const r = () => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st / 4294967296; };
    const Q = egFragPassage(kit, r, { deep: 1 });
    const ints = JSON.stringify(Q).match(/-?\d+\.\d+/g);
    assert.equal(ints, null, `${kit}: whole numbers only`);
    let run = 0;
    for (const it of Q.course) { assert.ok(EG_FRAG_PIECES[kit].includes(it.k), `${kit} lays ${it.k}`); run += it.gap + EG_STEP[it.k].d; }
    assert.ok(run <= Q.zB - Q.zA, `${kit}: its course inside its chasm (${run} of ${Q.zB - Q.zA})`);
    if (!Q.open && kit !== 'gloam') assert.ok(Q.height >= 450, `${kit}: headroom ${Q.height} cm over its course`);
    for (const a of Q.alcoves) assert.ok(Math.abs(a.x) > Q.halfW, `${kit}: an alcove behind its wall`);
  }
  const src = readFileSync(new URL('../../../src/net/eliteGates/egFragLaw.js', import.meta.url), 'utf8');
  const gen = src.slice(src.indexOf('export function egFragPassage'), src.indexOf('// ── the shared clock'));
  assert.equal(/Math\.(sin|cos|tan|atan|atan2|hypot|sqrt|exp|log|pow)\b/.test(gen), false, 'the generator half is integer-exact');
  let laid = 0;
  for (const s of halls([0])) for (const q of s.caves) {
    laid++;
    if (q.tube || q.shaft) continue;   // PIN MOVED (EG-ZC): a shaft's rim and foot are traversal ground - blows land on none of it (section 11.1)
    assert.ok(egOnFight(s, q.x, (q.z0 + q.zA) / 2) && egOnFight(s, q.x, (q.zB + q.z1) / 2), `hall ${s.h}: a passage's floors are fight floors`);
    for (const st of s.steps.filter((x) => x.kit === q.kit && x.z > q.zA && x.z < q.zB)) assert.ok(Math.abs(st.x - q.x) < q.halfW, 'its course inside its walls');
  }
  assert.ok(laid > 100);
});

test('EG-FULL LAYER THREE THE SET PIECES (section 11.3): one a band - the Collapsing Tube in the Galleries\' first span from its third circle, the Sinking Stair, the Moon Path and the Forge Line in the Brinks into the Cairn, the Shade and the Wellhead; the Tube falls at 4.0 m/s from its start after the wake, outrun by THE SPAN BUILD with 25% to spare; each set piece proven like any course (mutants: the Tube faster than the margin; a Brink without its band\'s set piece)', () => {
  assert.equal(EG_TUBE_MPS, 4.0);
  assert.ok(egTubeFair({ mps: EG_TUBE_MPS }) && !egTubeFair({ mps: 4.5 }), 'the margin is the span build\'s');
  assert.equal(egSetPieceOf(6, 'brink', 1), 'sinking');
  assert.equal(egSetPieceOf(11, 'brink', 2), 'moonpath');
  assert.equal(egSetPieceOf(16, 'brink', 3), 'forgeline');
  assert.equal(egSetPieceOf(3, 'span', 0, 3), 'tube');
  assert.equal(egSetPieceOf(3, 'deepway', 0, 3), null, 'never in a Deepway - it would not fit the hall');
  assert.equal(egSetPieceOf(8, 'span', 1, 3), null);
  const seen = {};
  for (const seed of SEEDS) {
    const tc = egTubeCircle(seed);
    for (let c = 1; c <= 20; c++) for (const s of egCircleSpecs(seed, c, 0)) {
      for (const f of s.frags) if (f.play && f.cls === 'passage') seen[f.play] = (seen[f.play] ?? 0) + 1;
      if (s.tube) {
        assert.equal(c, tc, 'the Tube in its circle');
        assert.ok(s.tube.z1 - s.tube.z0 >= 60 && s.tube.z1 - s.tube.z0 <= 80, 'the Tube 60-80 m');
        assert.equal(egTubeEdge(s.tube, s.tube.start * 1000 - 1), -Infinity, 'still before its start');
        assert.ok(Math.abs(egTubeEdge(s.tube, s.tube.start * 1000 + 5000) - (s.tube.z0 + 20)) < 1e-9, 'four metres a second from its mouth');
      }
      if (s.kind === 'brink') assert.ok(s.frags.some((f) => f.play === EG_SET_PIECES[s.band]), `the Brink into band ${s.band} carries its set piece`);
      assert.ok(s.len <= EG_HALL_LEN_MAX, `hall ${s.h}: ${s.len} m`);
      if (s.steps.length) assert.ok(egSpanProof(s).ok, `hall ${s.h}: ${egSpanProof(s).why.join(', ')}`);
    }
  }
  for (const k of EG_SET_PIECES) assert.ok(seen[k] > 0, `${k} laid somewhere`);
  let st = 7;
  const r = () => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st / 4294967296; };
  assert.ok(egSetPiece('sinking', r).course.every((it) => it.k === 'sink' && it.dy < 0 && it.dy > -100), 'the Sinking Stair: each flight under a metre down');
  assert.equal(egSetPiece('forgeline', r).course.filter((it) => it.k === 'rail' && it.hammer).length, 3, 'three conveyors through hammer drops');
  assert.ok(egSetPiece('tube', r, { short: true }).len === 6000, 'the Tube at its least beside its decrees');
});

test('EG-FULL LAYER THREE THE FORK (section 11.4): from circle 2 every span forks at an island - the High Road over the void (two sections, its Reliquary cache on an island at its hardest point) meets the end plate by a Drop; the Low Road bridges across, drops into a passage of the band\'s kit, past its Battlemage\'s niche (a Memento niche too), its foes; both end on the end plate at the Low Road\'s height; each road proven alone, its median within its bound, the Low Road the longer (mutants: a fork before circle 2; the roads never meeting; a Low Road proven as the High Road\'s)', () => {
  let forks = 0;
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) {
    const s = egCircleSpecs(seed, c, 0).find((q) => q.kind === 'span');
    if (!s) continue;
    if (c < EG_FORK_FROM_C || s.tube || s.laid > 8) { assert.equal(s.fork, null, `circle ${c}: no fork`); continue; }
    assert.ok(s.fork, `circle ${c} (seed ${seed}): its span forks`);
    forks++;
    const F = s.fork;
    assert.equal(F.lowX - F.x, EG_LOW_X_CM / 100);
    assert.equal(s.end.y, F.yLow, 'the end plate at the Low Road\'s height');
    const low = s.steps.filter((q) => q.road === 1), high = s.steps.filter((q) => q.road === 0 && q.z > F.z);
    assert.ok(low.length && low.every((q) => Math.abs(q.x - F.lowX) < 5), 'the Low Road on its own line');
    assert.equal(high.filter((q) => q.kind === 'drop').length, 1, 'the High Road meets the plate\'s height by one Drop');
    // PIN MOVED (EG-HERO-LAY, spec law 7): the Low Road's passage may be a hero of the band's kit, laid in the kit's place
    assert.ok(s.caves.some((q) => q.road === 1 && q.x === F.lowX) || s.frags.some((f) => f.hero && f.cls === 'passage' && f.road === 1 && f.x === F.lowX), 'the Low Road\'s passage');
    const cache = s.spots.hcache?.[0], niche = s.spots.lniche?.[0];
    assert.ok(cache && s.islands.some((q) => q.road === 0 && Math.hypot(q.x - cache.x, q.z - cache.z) < 0.01), 'the cache on a High Road island');
    assert.ok(niche && (s.spots.niche ?? []).some((q) => Math.hypot(q.x - niche.x, q.z - niche.z) < 0.01), 'the Low Road\'s niche takes a Memento');
    assert.ok((s.spots.lowfoe ?? []).length >= 2, 'its foes');
    // the roads meet: the High Road's last step within a gap of the plate's rim; the Low Road's bridge onto it
    const last = high[high.length - 1];
    assert.ok(s.end.z - s.end.r - (last.z + last.d / 2) <= 3.2 + 1e-9, 'the High Road reaches the plate');
    assert.ok(s.lanes.some((l) => Math.abs(l.ax - F.lowX) < 1e-9 && Math.hypot(l.bx - s.end.x, l.bz - s.end.z) < s.end.r), 'the Low Road\'s bridge reaches the plate');
    assert.ok(egSpanProof(s).ok, egSpanProof(s).why.join(', '));
    for (const road of [0, 1]) { const c2 = egRoadCross(s, road); assert.ok(c2.n > 0 && c2.median <= EG_MEDIAN_X * c2.fast + 1e-9, `road ${road}'s median`); }
    assert.ok(F.lo > 0 && F.hi > 0 && F.lo > F.hi * 0.8, `the Low Road the longer way (${F.hi} s, ${F.lo} s)`);
    assert.ok(!egSpanPairs(s).some((p) => p.a && p.b && p.a.road !== p.b.road), 'no jump from one road to the other');
  }
  // two roads' steps that happen to meet end to end are never one road's pair
  const hi = { i: 0, kind: 'still', x: 0, y: 0, z: 5, w: 3, d: 2.6, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0, after: 0 };
  const lo = { ...hi, i: 1, x: 15, z: 5 + 1.3 + 2.4 + 1.3, road: 1 };
  assert.ok(!egSpanPairs({ steps: [hi, lo] }).some((p) => p.a === hi && p.b === lo), 'the High Road\'s step and the Low Road\'s are not a jump');
  assert.ok(forks >= 50, `${forks} forks`);
});

test('EG-FULL LAYER THREE THE CHAMBERS (section 11.4): a chamber is never a disc with walls - each names its play (a second fight floor on its stairs, a chokepoint arch 6 m wide, the channels surging, an engine) and carries its kit\'s signature; a balcony is a fight floor its ramp climbs to; the deep tide\'s three dry floors leave no point of the low floor more than 24 m from a stair; the Athenaeum is never a fragment (mutants: a balcony with no stair; the tide with one dry floor)', () => {
  const plays = new Set();
  for (const s of halls([0])) {
    const ch = s.frags.filter((f) => f.cls === 'chamber');
    if (s.kind === 'athenaeum') assert.equal(ch.length, 0, 'never a fragment in the Athenaeum');
    for (const f of ch) {
      // PIN MOVED (EG-HERO-LAY, spec law 7): a hero chamber's record names its plays as a list (section 11.5's `play`), at least one
      const fp = f.hero ? f.play.split(',') : [f.play];
      assert.ok(fp.length >= 1 && fp.every((p) => EG_PLAYS.includes(p)), `${f.kit}'s play ${f.play}`);
      for (const p of fp) plays.add(p);
      assert.ok(EG_CHAMBER_KITS[s.band].includes(f.kit));
    }
    // every second floor in a chamber has its stair
    for (const b of s.discs.filter((d) => d.role === 'balcony' && s.frags.some((f) => f.cls === 'chamber'))) assert.ok(s.ramps.some((q) => Math.abs(q.y1 - b.y) < 1e-9 && Math.hypot(q.bx - b.x, q.bz - b.z) <= b.r + 0.5), `hall ${s.h}: a balcony with its stair`);
    for (const q of s.ramps) {
      // EG-HERO-LAY (spec law 7): a hero's stair climbs to one of its fight floors - a polygon. PIN MOVED (AUDIT EG V, f: spec law
      // 8 lays a Rampart's caster pillar its stair from the walkway, 2 m up - the fight ground the walk graph's view stands beside
      // the fight floor, net/eliteGates/egWalkGraph.js egFightView)
      const top = egFightView(s).fl.find((x) => Math.abs(x.y - q.y1) < 1e-9 && (x.t === 'd' ? Math.hypot(q.bx - x.x, q.bz - x.z) <= x.r + 0.5 : x.t === 'p' && egPolyIn(x.poly, q.bx, q.bz, 0.5)));
      assert.ok(top, `hall ${s.h}: a ramp climbs to a fight floor`);
      assert.ok(q.y1 - q.y0 >= (top.g === 'pillar' ? 2 : 2.5) && q.y1 - q.y0 <= 4, 'a second floor 2.5-4 m up (a caster pillar 2 m)');
      assert.ok(Math.atan2(q.y1 - q.y0, Math.hypot(q.bx - q.ax, q.bz - q.az)) < (60 * Math.PI) / 180, 'walkable');
    }
    for (const d of s.deco.filter((x) => x.t === 'arch')) assert.equal(d.w, 6, 'the arch 6 m wide');
    for (const e of s.engines) assert.ok(EG_ENGINES[e.kind]);
    for (const hz of s.hazards.filter((x) => x.kind === 'tide')) {
      const feet = s.ramps.filter((q) => Math.hypot(q.ax - hz.x, q.az - hz.z) < hz.r);
      assert.ok(feet.length >= 3, 'the tide\'s dry floors');
      for (let a = 0; a < 360; a += 10) for (const rr of [hz.r * 0.5, hz.r - 0.5]) {
        const px = hz.x + rr * Math.sin((a * Math.PI) / 180), pz = hz.z + rr * Math.cos((a * Math.PI) / 180);
        assert.ok(Math.min(...feet.map((q) => Math.hypot(q.ax - px, q.az - pz))) <= 24, `no point of the low floor past 24 m from a stair (${a} deg)`);
      }
    }
  }
  for (const p of EG_PLAYS) assert.ok(plays.has(p), `some chamber plays ${p}`);
});

test('EG-FULL LAYER THREE THE FRAGMENTS\' OWN PIECES (sections 10.5 and 11.3): a Moon branch stands only while a moonbeam lies on it, the beams walking 2.5 m/s; a Drum rolls along at a fixed 2.0 m/s; a Bone bridge is the Crumble\'s law; a jump off a Sinking flight is taken as it sinks and a wait upon it is bounded; THE MEDIAN refuses a road whose ordinary crossing runs past 1.6 times its best; the ground after each run is the real gap (mutants: a branch lit in the dark; a drum that speeds; the solver jumping a gap it never measured)', () => {
  const moon = { kind: 'moon', z: 10, beat: 0, period: EG_MOON_EVERY_S, phase: 0 };
  for (let t = 0; t < 8; t += 0.05) assert.equal(egPieceAt(moon, t).solid, Math.abs(moon.z - egMoonBeamZ(moon, t)) <= EG_MOON_HALF);
  assert.ok(Math.abs(egMoonBeamZ(moon, 1.1) - egMoonBeamZ(moon, 1.0) - EG_MOON_MPS * 0.1) < 1e-9, 'the beams walk 2.5 m/s');
  let lit = 0;
  for (let t = 0; t < 4; t += 0.01) if (egPieceAt(moon, t).solid) lit++;
  assert.ok(Math.abs(lit / 400 - (2 * EG_MOON_HALF) / (EG_MOON_MPS * EG_MOON_EVERY_S)) < 0.01, 'lit its share of the beams\' spacing');
  const drum = { kind: 'drum', amp: 1.5, period: (4 * 1.5) / EG_DRUM_MPS, phase: 0 };
  for (let t = 0.1; t < 0.6; t += 0.1) assert.ok(Math.abs(Math.abs(egPieceAt(drum, t + 0.05).dz - egPieceAt(drum, t).dz) - EG_DRUM_MPS * 0.05) < 1e-9, 'a fixed 2.0 m/s');
  assert.ok(EG_CRUMBLE_KINDS.includes('bone'));
  const bone = { i: 0, kind: 'bone', x: 0, y: 0, z: 5, w: 2.6, d: 4, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0 };
  assert.ok(egSpanProof({ steps: [bone] }).why.some((w) => /too deep/.test(w)), 'a Bone bridge too deep to cross before it falls');
  // a sinking flight: the jump off it is taken EG_SINK_ON_S of sinking low
  const sink = { i: 0, kind: 'sink', x: 0, y: 0, z: 3.7, w: 3, d: 2.6, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0, after: 0 };
  const up = { i: 1, kind: 'still', x: 0, y: 0.3, z: 3.7 + 1.3 + 2.4 + 1.3, w: 3, d: 2.6, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0, after: 0 };
  const pair = (a, b) => egSpanPairs({ steps: [a, b] }).find((p) => p.a === a && p.b === b);
  const firm = { ...sink, kind: 'still' };
  assert.ok(egPairWindows(pair(firm, up)).open > 0, '0.3 m up from firm ground is a jump');
  assert.equal(egPairWindows(pair(sink, up)).open, 0, `0.3 m up from a flight sunk ${EG_SINK_MPS * EG_SINK_ON_S} m is not`);
  // a wait on a sinking flight is bounded: a Beat after it that keeps its rider waiting is refused
  const late = { i: 1, kind: 'beat', x: 0, y: -0.2, z: 3.7 + 1.3 + 2.4 + 1.3, w: 3, d: 2.6, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0, after: 0 };
  const w = egPairWindows(pair(sink, late));
  assert.equal(egSpanProof({ steps: [sink, late] }).why.some((x) => /sinking flight/.test(x)), w.wait > 2, 'a wait past two seconds on a sinking flight refused');
  // THE MEDIAN: a road of Beats out of step - fast at its best, ordinary far slower - is refused
  const beats = [];
  let z = 0;
  for (let k = 0; k < 6; k++) { z += 2.8 + 1.3; beats.push({ i: k, kind: 'beat', x: 0, y: 0, z, w: 3, d: 2.6, gap: 2.8, amp: 0, period: 0, phase: 0, beat: (k % 2) * 1.8, road: 0, after: 0 }); z += 1.3; }
  const c = egRoadCross({ steps: beats }, 0);
  assert.ok(c.fast > 0 && c.median >= c.fast, 'a crossing measured');
  // a road whose every window passes but whose ordinary crossing runs past its bound is refused - and only then
  let refused = 0;
  for (let k = 0; k < 60; k++) {
    const st = Array.from({ length: 3 }, (_, j) => ({ i: j, kind: 'rail', x: 0, y: 0, z: 5 + j * 5.4, w: 3, d: 2.6, gap: 2.8, amp: 0.4 + (k % 5) * 0.3, period: 4 + (k % 6), phase: (k * 0.61 + j * 1.7) % 9, beat: 0, road: 0, after: 0 }));
    const cc = egRoadCross({ steps: st }, 0), pr = egSpanProof({ steps: st }), med = pr.why.some((x) => /median/.test(x));
    if (med) refused++;
    if (!pr.why.some((x) => !/median/.test(x))) assert.equal(med, cc.median > EG_MEDIAN_X * cc.fast, 'THE MEDIAN refuses exactly a road past its bound');
  }
  assert.ok(refused > 0, 'some railed road runs past its bound');
  // the ground after a run is jumped: a run ending 4 m short of its ground is refused, 2.4 m short is not
  const lone = (after) => ({ i: 0, kind: 'still', x: 0, y: 0, z: 5, w: 3, d: 2.6, gap: 2.4, amp: 0, period: 0, phase: 0, beat: 0, road: 0, after });
  assert.equal(egSpanProof({ steps: [lone(2.4)] }).ok, true);
  assert.equal(egSpanProof({ steps: [lone(4)] }).ok, false, 'a gap past the reach after the run');
  // the ground after each run: every last step of a run knows its gap on, and the solver jumps it
  for (const s of halls([0])) for (const st of s.steps) {
    const next = s.steps.find((q) => q.road === st.road && q.i > st.i);
    const meets = next && Math.abs(next.z - next.d / 2 - next.gap - (st.z + st.d / 2)) < 0.011;
    if (!meets) assert.ok(st.after >= 0 && st.after <= 3.3, `hall ${s.h} step ${st.i}: ${st.after} m to the ground after it`);
  }
  // the Colossus's forge chamber begins at the approach's own gap (layer three's fix - 3 m more was out of reach)
  for (const seed of SEEDS) for (let c2 = 1; c2 <= 20; c2++) {
    const court = egCircleSpecs(seed, c2, 0)[4];
    if (court.lord !== 'colossus') continue;
    const last = court.steps[court.steps.length - 1], band = court.bands.find((b) => b.role === 'court');
    assert.ok(band.z0 - (last.z + last.d / 2) <= 3.2 + 1e-9, 'the forge in reach');
  }
});

test('EG-FULL LAYER THREE THE ANNALS OF 3E 398 (sections 3 and 11.10): thirty pages, each two sentences - seventeen behind the halls\' false walls, thirteen the lords\', one at each lord\'s first fall; a member\'s next found page is the first they lack (mutants: a lord with no page; a page found twice)', () => {
  assert.equal(EG_ANNALS.length, 30);
  assert.equal(EG_ANNALS_FOUND + EG_ANNALS_LORDS.length, 30);
  for (const [title, text] of EG_ANNALS) { assert.ok(title.length > 3); assert.equal(text.match(/[.!?](\s|$)/g)?.length, 2, `"${title}": two sentences`); }
  for (const k of EG_ANNALS_LORDS) { assert.ok(EG_BOSS_KEYS.includes(k)); assert.ok(egAnnalsLordPage(k) >= EG_ANNALS_FOUND); }
  assert.equal(new Set(EG_ANNALS_LORDS.map(egAnnalsLordPage)).size, 13);
  assert.equal(egAnnalsLordPage('kynreeve'), -1, 'a champion keeps no page');
  assert.equal(egAnnalsNext(0, 0), 0);
  assert.equal(egAnnalsNext(0b111, 0), 3);
  assert.equal(egAnnalsNext(0b1, 16), 16);
  assert.equal(egAnnalsNext((1 << 17) - 1, 3), -1, 'all seventeen held');
});
