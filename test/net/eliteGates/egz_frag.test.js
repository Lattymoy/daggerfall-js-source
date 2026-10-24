// EG-ZC (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 10.5, 11.1, 11.2, 11.4,
// 11.10 and 22): THE LAST FRAGMENTS - spec law 5. THE COOLING SLAG (net/eliteGates/egSpanLaw.js `slag`, net/eliteGates/egFragLaw.js's Forge kit):
// a crossing whose crusts stand only after a spill, two spouts pouring in turn, proven by THE TIMED SOLVER, judged on the
// relay's fair trail and drawn and judged on this screen in the band's liquid; THE SHAFTS (egFragShaft): the Deepway's way
// down by a shaft of its band's kit - the Hollow Trunk, the Slag Chute - laid, proven, built, collided and drawn; THE
// ENGINES AS WRITTEN (net/eliteGates/egBrain.js): the Sluice's channel flooded 6 s, the Moon-Mirror lighting a branch, the Low Road's
// closing on either road; and THE LAW PIN - law 4 kept beside law 5, byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleSpecs, egFirstHallOf, egSpecDigest, egOnFight, egSpecGive, egSpecForget, EG_SPEC, EG_SEALED_MS, EG_CLOSING_SPAN_MS, EG_HALL_LEN_MAX, EG_STEP, EG_STEP_DOWN_CM, EG_DROP_CM } from '../../../src/net/eliteGates/egLaw.js';
import { egSlagState, egSlagLane, egSlagX, egPieceAt, egSpanPairs, egPairWindows, egSpanProof, egRoadCross, EG_SLAG_TELL_S, EG_SLAG_MOLTEN_S, EG_SLAG_CRUST_S, EG_SLAG_CYCLE_S,
  EG_SLAG_SPOUTS, EG_SLAG_WARN_S, EG_SHAFT_MAX_S, EG_SPAN_RUN_MPS, EG_CRUMBLE_SLACK_S, EG_DROP_LAND_MIN } from '../../../src/net/eliteGates/egSpanLaw.js';
import { EG_HAZARDS, EG_ENGINES, EG_FRAG_PIECES, EG_SHAFT_KITS, EG_SHAFT_NAMES, EG_SHAFT_PIECES, EG_SLAG_LAW, EG_SLAG_STEP, EG_SLAG_LANE_CM, EG_SLAG_LIP_CM, EG_MIRROR_REACH_M, EG_MIRROR_LIT_R,
  EG_ENGINE_PCT, EG_ENGINE_TELL_MS, egFragPassage, egFragShaft, egHazardParts, egHazardLawful } from '../../../src/net/eliteGates/egFragLaw.js';
import { EG_LAWS, EG_LAW_KEEP_DAYS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { egBreachNew, egEnter, egStep, egWord, egPoseIn, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFairNew } from '../../../src/net/eliteGates/egFair.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';
import { createEgSpan, egSlagCrustModel, egSlagMoltenModel, EG_STEP_GONE_Y } from '../../../src/scenes/eliteGates/egSpan.js';
import { egCircleColliderTris, buildEgCircleModel, egSlagSpouts, egWallFoot, EG_SLAG_SPOUT } from '../../../src/world/eliteGates/egHall.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { registerSpireObjs } from '../../../src/systems/eliteGates/spireKit.js';
import { EG_DRESS } from '../../../src/world/eliteGates/egBandArt.js';

const SEEDS = [77, 0xbeef, 3, 0x51ee, 12345];
/** Every hall over the seeds and twenty circles (the plain ground and one of each span decree), in law `law`. PIN MOVED (THE
 *  ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 8's by default - the fragments' pins read the course laid along +z from the
 *  plate; a LAW 9 hall's fragments stand along its way (test/net/eliteGates/law9_rooms.test.js) */
function* halls(geos = [0, 4], law = 8) {
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) for (const geo of geos) yield* egCircleSpecs(seed, c, geo, law);
}
/** The first hall (seeds 1-400, circles `circles`) whose spec `want` takes. PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): of spec
 *  law 8, its circle given (test/egGive8.mjs) - the breach, the span and the circle's mesh stand on law 8's ground */
function findHall(want, circles = [2, 20]) {
  for (let seed = 1; seed <= 400; seed++) for (let c = circles[0]; c <= circles[1]; c++) for (let s = 1; s <= 5; s++) {
    const h = egFirstHallOf(c) + s - 1;
    if (want(egHallOf(seed, h, 0, 8))) { egGive8(seed, [c]); return { seed, h, c, spec: egHallOf(seed, h, 0) }; }
  }
  throw new Error('no such hall');
}
const T0 = 1_800_000_000_000;
/** A breach of `n` members standing on hall `h`'s arrival plate, stepped to its wake (egfrag_relay's rig). */
function at(seed, h, n = 2) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const clock = { now: T0 + EG_SEALED_MS + 100 };
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, clock.now), null);
  B.h = h; B.sg = 'arrive'; B.wk = clock.now; B.cnt = { left: 1_800_000, at: clock.now }; B.pulledAt = clock.now; B.su = clock.now + 30_000;
  const spec = egHallOf(seed, h, 0), pos = {}, frames = [];
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  let bad = 0;
  const take = (list) => { for (const f of list) { const { to, ...rest } = f; if (!validEgOut(JSON.parse(JSON.stringify(rest)))) bad++; frames.push(f); } return list; };
  const step = (ms = 250) => { clock.now += ms; return take(egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: clock.now })), rng)); };
  const say = (sub, m) => take(egWord(B, sub, m, pos[sub], clock.now, rng));
  const put = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, spec, clock, pos, frames, step, say, put, bad: () => bad };
}
/** A slag crossing of its own (metres and seconds): its crust `d` deep, its clock's phase. */
const slagStep = (o = {}) => ({ i: 0, kind: 'slag', span: 0, x: 0, y: 0, z: 5, w: 4, d: 3, amp: 2.05, period: 20, phase: 0, beat: 0, gap: 2.4, road: 0, kit: 'forge', after: 0, ...o });

test('EG-ZC THE COOLING SLAG (section 11.2): a spill told 1.2 s, molten 6 s, then a crust 10 s, every 20 s - the way across only after a spill; two spouts side by side, the second half a cycle behind, so one crust always stands; the piece stands on the standing crust\'s lane; the spill\'s molten lanes laid on the crossing\'s own clock, 4 m wide and told over the wind-up floor (mutants: a crust that never breaks; the spouts pouring together; the spill out of step with its crust)', () => {
  assert.deepEqual([EG_SLAG_TELL_S, EG_SLAG_MOLTEN_S, EG_SLAG_CRUST_S, EG_SLAG_CYCLE_S, EG_SLAG_SPOUTS], [1.2, 6, 10, 20, 2]);
  assert.deepEqual([EG_HAZARDS.slag.tell, EG_HAZARDS.slag.live, EG_HAZARDS.slag.crust, EG_HAZARDS.slag.period], [1200, 6000, 10000, 20000], 'the hazard\'s numbers are the crust\'s');
  const s = slagStep({ phase: 0.35 });
  const share = { tell: 0, molten: 0, crust: 0, gone: 0 };
  let both = 0, none = 0, lastLane = -2, switches = 0;
  for (let k = 0; k < 2000; k++) {
    const t = k * 0.01 + 0.005, a = egSlagState(s, 0, t), b = egSlagState(s, 1, t);
    share[a.st]++;
    // the second spout is the first half a cycle on
    assert.equal(b.st, egSlagState(s, 0, t + EG_SLAG_CYCLE_S / 2).st);
    const crusts = (a.st === 'crust' ? 1 : 0) + (b.st === 'crust' ? 1 : 0);
    if (crusts === 2) both++;
    if (crusts === 0) none++;
    const lane = egSlagLane(s, t);
    if (lane !== lastLane) { switches++; lastLane = lane; }
    const p = egPieceAt(s, t);
    assert.equal(p.solid, lane >= 0);
    if (lane >= 0) assert.ok(Math.abs(s.x + p.dx - egSlagX(s, lane)) < 1e-9 && Math.abs(Math.abs(p.dx) - s.amp) < 1e-9, 'stood on its crust\'s lane');
  }
  assert.deepEqual([share.tell, share.molten, share.crust, share.gone].map((n) => Math.round(n / 10) / 10), [1.2, 6, 10, 2.8], 'told, molten, crust and gone - seconds in 20');
  assert.equal(both, 0, 'never two crusts');
  assert.equal(none, 0, 'never none');
  assert.ok(switches >= 2 && switches <= 4, 'the crust changes lanes each half cycle');
  assert.deepEqual([egSlagX(s, 0), egSlagX(s, 1)], [-2.05, 2.05]);
  // the spill: the hazard laid with the crossing tells and pours over the crust's lane while it is told and molten
  const { spec } = findHall((q) => q.steps.some((x) => x.kind === 'slag'), [16, 20]);
  const st = spec.steps.find((x) => x.kind === 'slag'), lanes = spec.hazards.filter((hz) => hz.kind === 'slag' && hz.z <= st.z && Math.abs(hz.y - st.y) < 1e-9);
  assert.equal(lanes.length, EG_SLAG_SPOUTS, 'a spill lane a spout');
  for (const hz of lanes) {
    const k = Math.abs(hz.sh[0] - egSlagX(st, 0)) < 1e-9 ? 0 : 1;
    assert.ok(Math.abs(hz.sh[0] - egSlagX(st, k)) < 1e-9 && hz.w === 4 && egHazardLawful(hz).ok, 'its lane over its spout\'s crust, 4 m wide, lawful');
    assert.ok(hz.sh[1] <= st.z - st.d / 2 + 1e-9 && hz.sh[3] >= st.z + st.d / 2 + EG_SLAG_LIP_CM / 100 - 1e-9, 'over the crust and onto the floor it pours toward');
    for (let t = 0; t < 40; t += 0.25) {
      const p = egHazardParts(hz, t)[0], S = egSlagState(st, k, t).st;
      assert.equal(p?.st ?? 'quiet', S === 'tell' ? 'tell' : S === 'molten' ? 'live' : 'quiet', `spout ${k} at ${t} s: the spill as its crust has it`);
    }
  }
});

test('EG-ZC THE SOLVER ACROSS THE SLAG (section 10.5): a landing on a crust is believed only while it holds through its crossing - a crust about to break is no landing, so the window shuts for the crossing at each change of lane and never longer than THE WAIT; a crust is left onto still ground, never onto a timed piece; a shaft crossed past 15 s is refused (mutants: the crossing\'s hold dropped; a crust left onto a Rail; the shaft\'s bound unasked)', () => {
  const ground = slagStep({ phase: 0 });
  const pair = egSpanPairs({ steps: [ground] }).find((p) => p.b === ground);
  const w = egPairWindows(pair);
  const hold = ground.d / EG_SPAN_RUN_MPS + EG_CRUMBLE_SLACK_S;
  assert.ok(w.wait >= hold - 0.1 && w.wait <= hold + 0.6, `the window shut for the crossing at the change (${w.wait.toFixed(2)} s, the crossing ${hold.toFixed(2)} s)`);
  assert.ok(w.wait < 4 && w.worst12 > 5, 'never a queue');
  // the rule itself, at the instants: a crust landed on with 0.3 s left breaks under the crossing; with 3 s left it holds
  const brk = EG_SLAG_TELL_S + EG_SLAG_MOLTEN_S + EG_SLAG_CRUST_S;   // spout 0's crust breaks
  const st = slagStep({ phase: 0 });
  const left03 = brk - 0.3, left3 = brk - 3;
  assert.equal(egSlagState(st, egSlagLane(st, left03), left03 + st.d / EG_SPAN_RUN_MPS + EG_CRUMBLE_SLACK_S).st === 'crust', false, '0.3 s left: it breaks under the crossing');
  assert.equal(egSlagState(st, egSlagLane(st, left3), left3 + st.d / EG_SPAN_RUN_MPS + EG_CRUMBLE_SLACK_S).st === 'crust', true, '3 s left: it holds');
  // a crust left onto a timed piece is refused; onto a ledge, believed
  const slag = slagStep({ i: 0, z: 5 }), rail = { i: 1, kind: 'rail', span: 0, x: 0, y: 0, z: 5 + 1.5 + 3.2 + 1.5, w: 3, d: 3, amp: 1, period: 7, phase: 0, beat: 0, gap: 3.2, road: 0, after: 0 };
  assert.ok(egSpanProof({ steps: [slag, rail] }).why.some((x) => /slag crust left onto a rail/.test(x)), 'onto a Rail: refused');
  const ledge = { ...rail, kind: 'ledge', amp: 0, period: 0, w: 2.4, d: 2, z: 5 + 1.5 + 2.4 + 1 };
  ledge.gap = 2.4;
  assert.ok(!egSpanProof({ steps: [slag, ledge] }).why.some((x) => /slag crust/.test(x)), 'onto a ledge: believed');
  // a shaft: its own steps crossed inside 15 s at their median
  const run = (n) => Array.from({ length: n }, (_, k) => ({ i: k, kind: 'still', span: 0, x: 0, y: 0, z: 2.4 + 1.3 + k * 5, w: 3, d: 2.6, amp: 0, period: 0, phase: 0, beat: 0, gap: 2.4, road: 0, after: 0 }));
  const shaftOf = (steps) => ({ steps, frags: [{ cls: 'shaft', kit: 'caverns', z0: 0, z1: steps.at(-1).z + 5, road: 0 }] });
  const short = run(6), long = run(24);
  assert.ok(egRoadCross({ steps: long }, 0).median > EG_SHAFT_MAX_S && egRoadCross({ steps: short }, 0).median < EG_SHAFT_MAX_S);
  assert.ok(egSpanProof(shaftOf(long)).why.some((x) => /a shaft crossed in/.test(x)), 'past 15 s: refused');
  assert.ok(egSpanProof(shaftOf(short)).ok, 'inside it: proven');
  assert.ok(egSpanProof({ steps: long }).ok, 'the same steps in no shaft: no such bound');
});

test('EG-ZC THE FORGE KIT LAYS IT (section 11.2, spec law 5): every Forge Gut passage of law 5 crosses its chasm\'s last stretch on a slag crossing - its last piece, left onto the far floor - with a spill lane a spout, the walls wider for its two lanes and the passage longer by its crust; law 4\'s Forge Gut never; the Wellhead\'s spans, Low Roads and Deepways carry it, every course proven, every hall inside its length (mutants: the slag laid in law 4; a crust stranded before the far floor; a spout\'s spill missing)', () => {
  assert.equal(EG_SLAG_LAW, 5);
  assert.ok(EG_FRAG_PIECES.forge.includes('slag'));
  assert.deepEqual(EG_STEP.slag, EG_SLAG_STEP);
  assert.equal(EG_SLAG_STEP.w, 400, 'a spout\'s lane 4 m wide - THE WIDTH RULE');
  for (const seed of [1, 2, 3, 99]) {
    let st = seed;
    const r = () => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st / 4294967296; };
    const r4 = (() => { let q = seed; return () => { q = (Math.imul(q, 1103515245) + 12345) >>> 0; return q / 4294967296; }; })();
    const Q = egFragPassage('forge', r, { law: 5 }), Q4 = egFragPassage('forge', r4, { law: 4 });
    assert.deepEqual(Q.course.map((it) => it.k), ['rail', 'rail', 'slag'], 'two conveyors, then the slag');
    assert.deepEqual(Q4.course.map((it) => it.k), ['rail', 'rail'], 'law 4: the conveyors alone');
    let run = 0;
    for (const it of Q.course) run += it.gap + EG_STEP[it.k].d;
    assert.equal(run, Q.zB - Q.zA, 'the crust\'s far edge is the far floor\'s');
    assert.deepEqual([Q.halfW, Q.len - Q4.len, Q.zA - Q4.zA], [420, EG_SLAG_STEP.d, 0], 'wider walls, a longer passage, its near floor where it stood');
    assert.ok(Q.halfW * 2 >= 2 * EG_SLAG_LANE_CM + EG_SLAG_STEP.w, 'both lanes inside its walls');
    assert.equal(Q.hazards.filter((hz) => hz.kind === 'slag').length, EG_SLAG_SPOUTS);
    assert.equal(Q4.hazards.filter((hz) => hz.kind === 'slag').length, 0);
    assert.ok(JSON.stringify(Q).match(/-?\d+\.\d+/g) === null, 'whole numbers only');
  }
  let slags = 0, forges = 0, low = 0, deep = 0;
  for (const s of halls()) {
    assert.ok(s.len <= EG_HALL_LEN_MAX, `hall ${s.h}: ${s.len} m`);
    if (s.steps.length) assert.ok(egSpanProof(s).ok, `hall ${s.h}: ${egSpanProof(s).why.join(', ')}`);
    for (const q of s.caves.filter((c) => c.kit === 'forge' && !c.shaft)) {
      forges++;
      const ss = s.steps.filter((x) => x.kind === 'slag' && x.z > q.zA && x.z < q.zB);
      assert.equal(ss.length, 1, `hall ${s.h}: its Forge Gut's slag crossing`);
      assert.ok(Math.abs(ss[0].z + ss[0].d / 2 - q.zB) < 1e-6 && ss[0].after === 0, 'left onto the far floor');
      assert.ok(egOnFight(s, q.x, q.zB + 1), 'the floor it pours toward is a fight floor');
      if (q.road === 1) low++;
    }
    // PIN MOVED (EG-HERO-LAY, spec law 7): a hero Forge Gut laid in the kit's place carries its own crust and spouts, as its
    // record draws them (test/tooling/eghero_wellhead.test.js) - the kit's law below is the code-built crossing's
    const hero = (x) => (s.heroes ?? []).some((q) => q.road === (x.road ?? 0) && x.z >= q.box[2] && x.z <= q.box[5]);
    for (const x of s.steps.filter((q) => q.kind === 'slag' && !hero(q))) {
      slags++;
      if (s.kind === 'deepway') deep++;
      assert.equal(s.band, 3, 'the Wellhead\'s alone');
      assert.equal(s.hazards.filter((hz) => hz.kind === 'slag' && hz.sh[1] <= x.z && hz.sh[3] >= x.z + x.d / 2).length, EG_SLAG_SPOUTS, `hall ${s.h}: its spouts' spills`);
    }
  }
  assert.ok(forges >= 10 && slags >= forges && low >= 1 && deep >= 1, `${forges} Forge Guts, ${slags} crossings, ${low} on a Low Road, ${deep} in a Deepway`);
  for (const s of halls([0], 4)) assert.equal(s.steps.filter((x) => x.kind === 'slag').length, 0, 'law 4 lays none');
});

test('EG-ZC THE SHAFTS (sections 11.1-11.2): every Deepway of law 5 goes down by a shaft of its band\'s kit in place of its three bare ledges - the Caverns\' throat, the Mist Stair\'s pit, the Hollow Trunk\'s moon-bound branches, the Slag Chute onto its crusts; its rim and foot traversal ground (blows land on none), its flights each under a metre, its Drop at most 4.5 m onto its walled landing, its own crossing inside 15 s, marked a shaft for the walls; law 4\'s Deepway keeps its ledges (mutants: a shaft of another band\'s kit; a flight past the envelope; the shaft a fight floor)', () => {
  assert.deepEqual(EG_SHAFT_KITS.map((k) => [...k]), [['caverns'], ['mist'], ['gloam'], ['forge', 'deep']]);
  assert.deepEqual({ ...EG_SHAFT_NAMES }, { gloam: 'the Hollow Trunk', forge: 'the Slag Chute' });
  for (const kit of ['caverns', 'mist', 'gloam', 'forge', 'deep']) for (const seed of [1, 5, 9]) {
    let st = seed;
    const r = () => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st / 4294967296; };
    const Q = egFragShaft(kit, r);
    assert.equal(Q.cls, 'shaft');
    assert.ok(Q.course.every((it) => EG_SHAFT_PIECES[kit].includes(it.k)), `${kit} lays its own pieces`);
    assert.equal(Q.course.filter((it) => it.k === 'drop').length, 1, 'one Drop');
    for (const it of Q.course) assert.ok(it.k === 'drop' ? -it.dy <= EG_DROP_CM : it.dy > -EG_STEP_DOWN_CM, `${kit}: ${it.k} ${it.dy} cm`);
    assert.equal(Q.course.filter((it) => it.k === 'slag').length, kit === 'forge' ? 1 : 0, 'the Slag Chute\'s crust');
    assert.equal(Q.course.filter((it) => it.k === 'moon').length > 0, kit === 'gloam', 'the Hollow Trunk\'s branches');
    if (kit === 'forge') assert.equal(Q.course.at(-1).k, 'slag', 'the crust left onto the foot');
    assert.equal(Q.yB, Q.course.reduce((a, it) => a + (it.dy ?? 0), 0));
    assert.ok(JSON.stringify(Q).match(/-?\d+\.\d+/g) === null, 'whole numbers only');
  }
  const seen = {};
  for (const s of halls()) {
    if (s.kind !== 'deepway') continue;
    const sh = s.frags.filter((f) => f.cls === 'shaft');
    assert.equal(sh.length, 1, `hall ${s.h}: one shaft`);
    const f = sh[0];
    assert.equal(s.frags.indexOf(f), 2, 'the Deepway\'s third fragment');
    assert.ok(EG_SHAFT_KITS[s.band].includes(f.kit), `its band's kit (${f.kit})`);
    // PIN MOVED (EG-HERO-LAY, spec law 7): a hero shaft laid in the kit's place - its own walls, flights and Drop as its record
    // draws them (test/tooling/eghero_cairn.test.js); it goes down, its exit under its mouth
    if (f.hero) { const q = s.heroes.find((x) => x.f === 2); assert.ok(q && q.id === f.hero && q.sockets.out[q.exit].y < q.y, 'a hero shaft goes down'); continue; }
    assert.equal(f.name, EG_SHAFT_NAMES[f.kit] ?? f.name);
    seen[f.kit] = (seen[f.kit] ?? 0) + 1;
    const q = s.caves.find((c) => c.shaft);
    assert.ok(q && q.kit === f.kit && q.z0 === f.z0 && q.yB < q.y, 'its walls marked a shaft, its foot under its rim');
    const own = s.steps.filter((x) => x.z > f.z0 && x.z < f.z1);
    assert.ok(own.length >= 4, 'its flights and its Drop');
    const drop = own.find((x) => x.kind === 'drop');
    assert.ok(!egOnFight(s, q.x, (q.z0 + q.zA) / 2) && !egOnFight(s, drop.x, drop.z), 'its rim and its landing no fight floors');
    assert.ok(drop && drop.d >= EG_DROP_LAND_MIN, 'its Drop\'s landing');
    let y = q.y;
    for (const x of own) { assert.ok(x.kind === 'drop' ? y - x.y <= EG_DROP_CM / 100 + 1e-9 : y - x.y < EG_STEP_DOWN_CM / 100, `step ${x.i}: ${(y - x.y).toFixed(2)} m down`); y = x.y; }
    assert.ok(Math.abs(y - q.yB) < 1e-9, 'its foot at its last step\'s height');
    assert.ok(egRoadCross({ steps: own }, 0).median <= EG_SHAFT_MAX_S, 'crossed inside 15 s');
    if (f.kit === 'gloam') assert.ok(own.some((x) => x.kind === 'moon') && egHallOf(s.seed, s.h, s.geo).caves.find((c) => c.shaft).kit === 'gloam');
    if (f.kit === 'forge') assert.equal(own.at(-1).kind, 'slag');
  }
  for (const k of ['caverns', 'mist', 'gloam', 'forge', 'deep']) assert.ok(seen[k] > 0, `some Deepway goes down ${k}'s shaft`);
  for (const s of halls([0], 4)) {
    if (s.kind !== 'deepway') continue;
    assert.ok(!s.frags.some((f) => f.cls === 'shaft') && !s.caves.some((c) => c.shaft), 'law 4: no shaft');
    assert.equal(s.steps.filter((x) => x.kind === 'ledge' && !x.kit).length, 3, 'law 4: its three bare ledges');
  }
});

test('EG-ZC THE LAW PIN (section 22, EG-H2\'s record): spec law 5 is the law, law 4 kept beside it its seven days WITH its generator - its halls byte for byte as they were (800 halls hashed whole); a hall says its law; the director draws every hall in its breach\'s own law (mutants: the law before drawn in the new; the breach\'s law forgotten)', () => {
  // PIN MOVED (AUDIT EG III): spec law 6 (the span decrees on every span) is the law now, laws 4 and 5 kept beside it, each
  // byte for byte (test/net/eliteGates/egaudit3_law.test.js pins law 6). PIN MOVED (EG-HERO-LAY): spec law 7 (the heroes laid) is the law
  // now, laws 4, 5 and 6 kept beside it (test/net/eliteGates/eghero_lay.test.js pins law 7). PIN MOVED (AUDIT EG V, f): spec law 8 (the ways
  // laid) is the law now, laws 4 to 7 kept beside it (test/net/eliteGates/egaudit5_f.test.js pins law 8)
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 9 is the law now, laws 4 to 8 kept beside it
  // (test/net/eliteGates/law9_rooms.test.js pins law 9)
  egSpecForget();
  // PIN MOVED (EG-PERFECT): spec law 10 the build's, laws 4 to 9 kept beside it
  assert.equal(EG_SPEC, 10);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.ok(egLawKnown(4) && egLawKnown(5) && egLawKnown(6) && egLawKnown(7) && egLawKnown(8) && egLawKnown(9) && egLawKnown(10) && !egLawKnown(11));
  assert.ok((Date.parse(EG_LAWS[5]) - Date.parse(EG_LAWS[4])) / 86_400_000 <= EG_LAW_KEEP_DAYS, 'the law before inside its keep');
  // law 4's halls as they stood before this law (46364ff52): every hall of four seeds, both grounds, a hundred halls each
  let acc = 0x811c9dc5;
  const per = {};
  for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) {
    const d = egSpecDigest(egHallOf(seed, h, geo, 4));
    acc = Math.imul(acc ^ d, 0x01000193) >>> 0;
    if (seed === 77 && geo === 0 && [1, 13, 78, 88].includes(h)) per[h] = d;
  }
  assert.deepEqual(per, { 1: 3167448703, 13: 853054473, 78: 1662358260, 88: 4228635459 }, 'a Span, a Deepway, the Shade and the Wellhead');
  assert.equal(acc >>> 0, 1228307904, 'law 4, byte for byte');
  const d4 = egHallOf(1, 82, 0, 4), d5 = egHallOf(1, 82, 0, 5), d6 = egHallOf(1, 82, 0);   // PIN MOVED (AUDIT EG III): law 5 named, law 6 the build's; PIN MOVED (EG-HERO-LAY): law 7 the build's; PIN MOVED (AUDIT EG V, f): law 8 the build's
  assert.deepEqual([d4.v, d5.v, d6.v], [4, 5, 10], 'each hall says its law');   // (PIN MOVED, EG-PERFECT: law 10 the build's)

  assert.notEqual(egSpecDigest(d4), egSpecDigest(d5), 'a Wellhead Deepway differs between them');
  // the director: a breach opened under law 4 runs law 4's halls (its stage's digest)
  const w = at(1, 82, 1);
  assert.equal(egStateOf(w.B, w.clock.now).dg, egSpecDigest(d6), 'a breach of this law: this law\'s hall');
  w.B.egv = 4;
  assert.equal(egStateOf(w.B, w.clock.now).dg, egSpecDigest(d4), 'a breach of the law before: its own law\'s hall');
  w.B.egv = 5;
  assert.equal(egStateOf(w.B, w.clock.now).dg, egSpecDigest(d5), 'and law 5\'s, its own');
  assert.equal(w.bad(), 0);
});

test('EG-ZC THE SLUICE FLOODS ITS LANE FOR 6 S (section 11.10): worked, its ring tells the flood 1.5 s and bites nothing itself; from the landing the channel burns 6 s on every screen - the place\'s fire, 20% a tick on a member in it; an add that walks into it 3 s on loses its 40% once, never twice; the flood kept until it runs (mutants: the flood a single blow; an add struck every beat; the channel never burning)', () => {
  assert.equal(EG_ENGINES.sluice.flood, 6000);
  const { seed, h, spec } = findHall((q) => q.engines.some((e) => e.kind === 'sluice') && q.kind !== 'court');
  const w = at(seed, h, 2), e = spec.engines.find((q) => q.kind === 'sluice');
  for (let k = 0; k < 24; k++) w.step();
  w.put('acct-0', e.x + 1, e.z);
  const out = w.say('acct-0', { k: 'use', i: e.i });
  assert.ok(out.some((f) => f.k === 'esay' && f.w === 'engine'), 'worked');
  const at0 = w.clock.now + EG_ENGINE_TELL_MS;
  const zone = out.find((f) => f.k === 'ez' && f.kind === 'burn');
  assert.ok(zone, 'the flood said');
  assert.deepEqual([zone.from, zone.until, zone.p, zone.el], [at0, at0 + 6000, EG_ENGINE_PCT, 'fire'], 'from its landing, 6 s, the place\'s 20% fire');
  const blow = out.find((f) => f.k === 'eb');
  assert.ok(blow, 'its ring said');
  assert.deepEqual([blow.p, blow.el, blow.at], [0, 'fire', at0], 'its ring bites nothing');
  assert.deepEqual(blow.s[0], zone.s, 'over the flood');
  const hit = w.B.F.engHits[0];
  assert.deepEqual([hit.at, hit.until], [at0, at0 + 6000]);
  const F = w.B.F, add = F.bodies.find((b) => b.role === EG_ROLE.add && !(b.fl & EG_FL.friend) && b.hp > 0);
  assert.ok(add, 'a wave stands');
  const [ax, az] = [(zone.s[1] + zone.s[3]) / 2, (zone.s[2] + zone.s[4]) / 2];
  const keep = (inside) => { add.x = inside ? ax : ax + 40; add.z = inside ? az : az + 40; add.mv = null; add.up = 0; };
  const hp0 = add.hp;
  while (w.clock.now < at0 + 3000) { keep(false); w.step(); }
  assert.equal(add.hp, hp0, 'outside the flood: untouched');
  assert.equal(w.B.F.engHits.length, 1, 'the flood still running');
  keep(true); w.step();
  assert.ok(Math.abs(add.hp - (hp0 - add.max * EG_ENGINES.sluice.pct)) < 1e-6 || !F.bodies.includes(add), 'in it 3 s on: its 40%');
  const hp1 = add.hp;
  for (let k = 0; k < 6; k++) { keep(true); w.step(); }
  assert.equal(add.hp, hp1, 'once a flood');
  while (w.clock.now < at0 + 6000) w.step();
  w.step();
  assert.equal(w.B.F.engHits.length, 0, 'run');
  assert.equal(w.bad(), 0);
});

test('EG-ZC THE MOON-MIRROR LIGHTS A BRANCH (section 11.10): worked, it lights the Moon branch nearest it within its reach for 6 s - a haven over its top on every screen - as well as blinding the Divers; a body on the lit branch while the beam is elsewhere is held in THE FAIR TRAIL, and not before the light (mutants: the branch never lit; the light that never goes out; the lit branch no support)', () => {
  assert.equal(EG_ENGINES.mirror.lit, 6000);
  assert.ok(EG_ENGINES.mirror.stun === 4000 && /blinds the Divers/.test(EG_ENGINES.mirror.what) && /lights a branch/.test(EG_ENGINES.mirror.what));
  const { seed, h, spec } = findHall((q) => q.engines.some((e) => e.kind === 'mirror' && q.steps.some((s) => s.kind === 'moon' && Math.hypot(s.x - e.x, s.z - e.z) <= EG_MIRROR_REACH_M)), [11, 15]);
  const w = at(seed, h, 2), e = spec.engines.find((q) => q.kind === 'mirror');
  const near = spec.steps.filter((s) => s.kind === 'moon').sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
  w.put('acct-0', e.x + 1, e.z);
  const out = w.say('acct-0', { k: 'use', i: e.i });
  const at0 = w.clock.now + EG_ENGINE_TELL_MS;
  const zone = out.find((f) => f.k === 'ez' && f.kind === 'haven');
  assert.ok(zone, 'a haven over the lit branch');
  assert.deepEqual(zone.s, ['d', near.x, near.z, EG_MIRROR_LIT_R], 'over the nearest branch');
  assert.deepEqual([zone.from, zone.until], [at0, at0 + 6000]);
  assert.deepEqual(w.B.F.lit, [{ i: near.i, from: at0, until: at0 + 6000 }]);
  assert.ok(w.B.F.engHits.some((q) => q.kind === 'mirror'), 'and its blinding blow still lands on the Divers');
  // the screen's half: the breach client, hearing the room's words, hands the spans the haven (systems/eliteGates/spireKit.js `lit`)
  const ME = 'acct-1', modes = { mode: 'dungeon', egHallBreach: () => w.B.b, egHallCircle: () => Math.ceil(h / 5), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const client = createEgClient({ modes: () => modes, online: () => ({ welcomes: 1, terminal: false, sendEg: () => true }), hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) },
    now: () => w.clock.now, entity: { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] }, player: { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } },
    cam: { pos: [0, 0, 0] }, say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [] });
  client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(w.B, w.clock.now)))));
  for (const f of w.frames) { const { to, ...rest } = f; const v = to && to !== ME ? null : validEgOut(JSON.parse(JSON.stringify(rest))); if (v) client.word(v); }
  assert.deepEqual(client.objs().lit, [{ s: zone.s, from: zone.from, until: zone.until }], 'the breach client hands the spans its haven');
  // THE FAIR TRAIL: a pose on the branch while its beam lies elsewhere
  const dark = (t0) => { for (let t = t0; t < t0 + 10_000; t += 50) if ([-250, 0, 250].every((d) => !egPieceAt(near, (t + d) / 1000).solid)) return t; return -1; };   // its beam elsewhere either side of the support's lag
  const sub = 'acct-1', m = w.B.mem[sub];
  const pose = (t) => egPoseIn(w.B, sub, { sx: spec.x0 + near.x, y: near.y, z: near.z }, t);
  const tBefore = dark(w.clock.now - 3000);
  assert.ok(tBefore > 0 && tBefore < at0);
  pose(tBefore);
  assert.ok(m.fair && m.fair.sup?.[0] !== tBefore, 'before the light: no support in the dark');
  const tLit = dark(at0 + 200);
  assert.ok(tLit > at0 && tLit < at0 + 6000);
  pose(tLit);
  assert.equal(m.fair.sup?.[0], tLit, 'lit: it holds');
  const tAfter = dark(at0 + 6200);
  pose(tAfter);
  assert.notEqual(m.fair.sup?.[0], tAfter, 'gone dark again');
  for (let k = 0; k < Math.ceil((6000 + EG_ENGINE_TELL_MS) / 250) + 2; k++) w.step();
  assert.equal(w.B.F.lit.length, 0, 'the light put out');
  assert.equal(w.bad(), 0);
  // its reach: the same hall with its branches carried past EG_MIRROR_REACH_M - nothing lit, the Divers still blinded
  const far = JSON.parse(JSON.stringify(spec));
  for (const s2 of far.steps) if (s2.kind === 'moon') s2.x += EG_MIRROR_REACH_M + 10;
  assert.ok(egSpecGive(far));
  try {
    const w2 = at(seed, h, 1);
    w2.put('acct-0', e.x + 1, e.z);
    const out2 = w2.say('acct-0', { k: 'use', i: e.i });
    assert.ok(out2.some((f) => f.k === 'esay' && f.w === 'engine') && !out2.some((f) => f.k === 'ez' && f.kind === 'haven'), 'past its reach: no branch lit');
    assert.equal(w2.B.F.lit.length, 0);
    assert.ok(w2.B.F.engHits.some((q) => q.kind === 'mirror'), 'the Divers still blinded');
  } finally { egSpecForget(); }
});

test('EG-ZC THE LOW ROAD\'S CLOSING WAITS ON EITHER ROAD (section 11.4): it begins at the first Low Road arrival or at the door\'s opening plus the roads\' difference, whichever comes first - a door opened from the High Road with a member below waits the difference, and that member\'s arrival brings the pull forward; a member who takes the Low Road after the door opened is waited for; a door opened by the Low Road closes as the High Road\'s (mutants: the early arrival ignored; the late Low Road left behind)', () => {
  const { seed, h, spec } = findHall((q) => !!q.fork && q.fork.lo > q.fork.hi + 4);
  const F = spec.fork, diff = Math.round((F.lo - F.hi) * 1000);
  // A: opened from the High Road, a member below - then its arrival, well inside the difference
  const a = at(seed, h, 2);
  a.put('acct-1', F.lowX, (F.z + F.plate) / 2);
  a.put('acct-0', spec.end.x, spec.end.z);
  a.step();
  assert.equal(a.B.sg, 'closing');
  assert.equal(a.B.su - a.B.dn, EG_CLOSING_SPAN_MS + diff, 'the difference waited');
  a.step(1000);
  a.B.mem['acct-1'].fair = { ...egFairNew(h), k: `${h}:0`, road: 1 };   // its trail took the Low Road (egPoseIn)
  a.put('acct-1', spec.end.x + 1, spec.end.z);
  const n0 = a.frames.length;
  a.step();
  assert.equal(a.B.lw, a.clock.now, 'the first Low Road arrival');
  assert.equal(a.B.su, a.clock.now + EG_CLOSING_SPAN_MS, 'its closing begins at its arrival');
  assert.ok(a.B.su < a.B.dn + EG_CLOSING_SPAN_MS + diff, 'the pull brought forward');
  assert.ok(a.frames.slice(n0).some((f) => f.k === 'sg' && f.su === a.B.su), 'every screen told');
  // B: nobody below at the opening - then a member takes the Low Road
  const b = at(seed, h, 2);
  b.put('acct-1', spec.arrive.x, spec.arrive.z);
  b.put('acct-0', spec.end.x, spec.end.z);
  b.step();
  assert.equal(b.B.su - b.B.dn, EG_CLOSING_SPAN_MS, 'the High Road\'s closing alone');
  b.put('acct-1', F.lowX, (F.z + F.plate) / 2);
  b.step();
  assert.equal(b.B.su - b.B.dn, EG_CLOSING_SPAN_MS + diff, 'the late Low Road waited for');
  // C: opened by a Low Road arrival
  const c = at(seed, h, 2);
  c.B.mem['acct-0'].fair = { ...egFairNew(h), k: `${h}:0`, road: 1 };
  c.put('acct-1', F.lowX, (F.z + F.plate) / 2);
  c.put('acct-0', spec.end.x, spec.end.z);
  c.step();
  assert.equal(c.B.sg, 'closing');
  assert.equal(c.B.su - c.B.dn, EG_CLOSING_SPAN_MS, 'opened by the Low Road: its closing begins at the door');
  assert.equal(a.bad() + b.bad() + c.bad(), 0);
});

test('EG-ZC ON THE SCREEN (sections 11.2, 11.6-11.8, 11.10): a slag crossing stands as its spouts\' lanes - each crust a bucket up only while it holds, each spill\'s molten sheet drawn only while it pours, in the band\'s liquid; a Moon branch the mirror lit stands while lit; a shaft\'s walls run 6 m under its foot and collide, the Hollow Trunk open to the moon; the spouts drawn, never collided; a crust\'s last second told in white, and the spill bites on my own feet (mutants: a crust up while molten; the sheet drawn on the crust; the lit branch dark; the walls stopping at the foot)', () => {
  const found = findHall((q) => q.steps.some((x) => x.kind === 'slag') && q.frags.some((f) => f.cls === 'shaft' && f.kit === 'forge'), [16, 20]);
  const made = [], R = { createMesh: (m) => { made.push(m); return { subMeshes: m.subMeshes }; }, destroyMesh: () => {} };
  const span = createEgSpan({ renderer: R, seed: found.seed, c: found.c }), draws = [], buckets = new Map();
  span.stand({ dynamicDraws: draws, collider: { addMesh: (key, p, i, mx, T) => buckets.set(key, T) } });
  const st = found.spec.steps.find((x) => x.kind === 'slag');
  const lanes = span.slags.filter((g) => g.h === found.spec.h && g.i === st.i);
  assert.equal(lanes.length, EG_SLAG_SPOUTS);
  for (let t = 100; t < 140; t += 0.7) {
    span.ride(t, 0.016, null, false);
    for (const g of span.slags.filter((q) => q.h === found.spec.h && q.i === st.i)) {
      const S = egSlagState(st, g.k, t).st;
      assert.equal(g.state, S);
      assert.equal(g.up, S === 'crust', `t ${t.toFixed(1)}: spout ${g.k}'s crust up only while it holds`);
      assert.equal(buckets.get(g.key)()[1] === EG_STEP_GONE_Y, S !== 'crust', 'its bucket sunk while it is no crust');
      if (S === 'crust') { const p = realmToDungeon(found.spec.x0 + egSlagX(st, g.k), st.y, st.z); assert.ok(Math.abs(g.T[0] - p[0]) < 1e-9 && Math.abs(g.T[2] - p[2]) < 1e-9, 'on its lane'); }
    }
  }
  // the models: the crust's top the cooled root, its sides and the spill the band's liquid - in the Wellhead's dress
  const crust = egSlagCrustModel(4, 3), molten = egSlagMoltenModel(4, 3);
  assert.deepEqual(new Set(crust.subMeshes.map((q) => q.textureRecord)), new Set([EG_DRESS.root, EG_DRESS.molten, EG_DRESS.edge]));
  assert.deepEqual(molten.subMeshes.map((q) => q.textureRecord), [EG_DRESS.molten]);
  const liquid = made.filter((m) => m.subMeshes.some((q) => q.textureRecord === EG_DRESS.molten));
  assert.ok(liquid.length >= 2 && liquid.every((m) => m.subMeshes.filter((q) => q.textureRecord === EG_DRESS.molten).every((q) => q.textureArchive === 38271)), 'in the Wellhead\'s liquid');
  // the draws: a crust shown only while it holds, a sheet only while it pours
  const t1 = (() => { for (let t = 200; t < 260; t += 0.1) if (egSlagState(st, 0, t).st === 'molten') return t; return 0; })();
  span.ride(t1, 0.016, null, false);
  const shown = draws.filter((d) => !d.hidden && d.gpu.subMeshes.some((q) => q.textureRecord === EG_DRESS.molten) && Math.abs(d.object.matrix[12] - realmToDungeon(found.spec.x0 + egSlagX(st, 0), 0, 0)[0]) < 1e-3 && Math.abs(d.object.matrix[14] - realmToDungeon(0, 0, st.z)[2]) < 1e-3);
  assert.equal(shown.length, 1, 'spout 0 pouring: its sheet alone');
  assert.ok(!shown[0].gpu.subMeshes.some((q) => q.textureRecord === EG_DRESS.root), 'the sheet, not the crust');
  // a lit branch
  const mc = findHall((q) => q.steps.some((x) => x.kind === 'moon') && q.kind === 'deepway', [11, 15]);
  const ms = mc.spec.steps.find((x) => x.kind === 'moon');
  const mspan = createEgSpan({ seed: mc.seed, c: mc.c }), MB = new Map();
  mspan.stand({ dynamicDraws: [], collider: { addMesh: (key, p, i, mx, T) => MB.set(key, T) } });
  let tD = 50;
  while (egPieceAt(ms, tD).solid) tD += 0.05;
  const lit = { h: mc.spec.h, objs: [], lit: [{ s: ['d', ms.x, ms.z, EG_MIRROR_LIT_R], from: 0, until: tD * 1000 + 500 }] };
  registerSpireObjs(() => lit);
  try {
    mspan.ride(tD, 0.016, null, false);
    assert.ok(mspan.steps.find((q) => q.h === mc.spec.h && q.i === ms.i).solid, 'lit: it stands in the dark');
    assert.deepEqual(mspan.lit, [{ h: mc.spec.h, i: ms.i }]);
    mspan.ride(tD + 0.6, 0.016, null, false);
    assert.equal(mspan.steps.find((q) => q.h === mc.spec.h && q.i === ms.i).solid, egPieceAt(ms, tD + 0.6).solid, 'its light out: the beam\'s again');
  } finally { registerSpireObjs(null); }
  // the walls and the spouts
  const tris = egCircleColliderTris(found.seed, found.c, 0), specs = egCircleSpecs(found.seed, found.c, 0);
  const s = specs.find((q) => q.h === found.spec.h), q = s.caves.find((c) => c.shaft);
  assert.equal(egWallFoot(q), 6);
  const foot = realmToDungeon(s.x0 + q.x, q.yB - 6, q.zB)[1];
  let deepest = Infinity;
  for (let i = 1; i < tris.length; i += 3) deepest = Math.min(deepest, tris[i]);
  assert.ok(deepest <= foot + 1e-4, 'the shaft\'s walls run 6 m under its foot - collided');
  const vaultAt = (spec2, cq) => { const p = realmToDungeon(spec2.x0 + cq.x, Math.max(cq.y, cq.yB) + cq.height, (cq.zA + cq.zB) / 2); for (let i = 0; i < tris2(spec2).length; i += 9) { const T = tris2(spec2); if ([T[i + 1], T[i + 4], T[i + 7]].every((y) => Math.abs(y - p[1]) < 0.01) && Math.min(T[i], T[i + 3], T[i + 6]) <= p[0] && Math.max(T[i], T[i + 3], T[i + 6]) >= p[0] && Math.min(T[i + 2], T[i + 5], T[i + 8]) <= p[2] && Math.max(T[i + 2], T[i + 5], T[i + 8]) >= p[2]) return true; } return false; };
  const cache = new Map(), tris2 = (spec2) => { const k = `${spec2.seed}:${spec2.c}`; if (!cache.has(k)) cache.set(k, egCircleColliderTris(spec2.seed, spec2.c, 0)); return cache.get(k); };
  assert.equal(vaultAt(s, q), true, 'the Slag Chute vaulted over its rim');
  const tr = findHall((x) => x.frags.some((f) => f.cls === 'shaft' && f.kit === 'gloam'), [11, 15]);
  assert.equal(vaultAt(tr.spec, tr.spec.caves.find((c) => c.shaft)), false, 'the Hollow Trunk open to the moon');
  const spouts = egSlagSpouts(s);
  assert.equal(spouts.length, EG_SLAG_SPOUTS * s.steps.filter((x) => x.kind === 'slag').length, 'a spout a lane');
  const model = buildEgCircleModel(found.seed, found.c, 0), P = model.positions;
  for (const sp of spouts) {
    const [x0, y0, z0, x1, y1, z1] = sp.box;
    assert.ok(Math.abs(y0 - realmToDungeon(0, st.y + EG_SLAG_SPOUT.up, 0)[1]) < 1e-6 || s.steps.some((x) => x.kind === 'slag' && Math.abs(y0 - realmToDungeon(0, x.y + EG_SLAG_SPOUT.up, 0)[1]) < 1e-6), 'over its crust');
    let drawn = false;
    for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - x0) < 1e-4 && Math.abs(P[i + 1] - y0) < 1e-3 && Math.abs(P[i + 2] - z0) < 1e-4) { drawn = true; break; }
    assert.ok(drawn, 'drawn');
    for (let i = 0; i < tris.length; i += 3) assert.ok(!(tris[i] > x0 + 0.01 && tris[i] < x1 - 0.01 && tris[i + 1] > y0 + 0.01 && tris[i + 1] < y1 - 0.01 && tris[i + 2] > z0 + 0.01 && tris[i + 2] < z1 - 0.01), 'never collided');
  }
  // the fight: a crust's last second told in white; the spill on my own feet
  const E = { b: '0123456789abcdef', h: found.spec.h, seed: found.seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: EG_FIGHT_EMPTY, co: [] };
  const brk = EG_SLAG_TELL_S + EG_SLAG_MOLTEN_S + EG_SLAG_CRUST_S;
  let t = (Math.ceil((5000 + st.phase) / EG_SLAG_CYCLE_S) * EG_SLAG_CYCLE_S - st.phase + brk - EG_SLAG_WARN_S / 2) * 1000;
  assert.equal(egSlagState(st, 0, t / 1000).st, 'crust');
  const hits = [], entity = { health: 100, maxHealth: 100 };
  let feet = realmToDungeon(found.spec.x0 + 30, st.y, st.z);
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => feet, player: () => entity, save: () => 100, strike: (d, how) => hits.push([d, how?.el, how?.name]), me: () => 'acct-mac' });
  fight.frame();
  const told = fight.shapes().filter((x) => Math.abs(x.origin[0] - egSlagX(st, 0)) < 1e-9 && Math.abs(x.origin[1] - (st.z - st.d / 2)) < 1e-9);
  assert.equal(told.length, 1, 'its last second told');
  assert.ok(told[0].color[0] > 0.9 && told[0].color[2] > 0.9 && told[0].t > 0.4 && told[0].t < 0.6, 'in white, half through its warning');
  t -= 3000; fight.frame();
  assert.equal(fight.shapes().filter((x) => Math.abs(x.origin[0] - egSlagX(st, 0)) < 1e-9 && Math.abs(x.origin[1] - (st.z - st.d / 2)) < 1e-9 && x.color[2] > 0.9).length, 0, 'three seconds left: untold');
  // the spill: standing on the floor's lip in spout 1's lane while it pours
  const hz = found.spec.hazards.find((x) => x.kind === 'slag' && Math.abs(x.sh[0] - egSlagX(st, 1)) < 1e-9 && x.sh[1] <= st.z);
  t = (() => { for (let q = 300; q < 340; q += 0.05) if (egHazardParts(hz, q)[0]?.st === 'live') return Math.round(q * 1000) + 25; return 0; })();
  feet = realmToDungeon(found.spec.x0 + hz.sh[0], hz.y, st.z + st.d / 2 + 0.6);
  fight.frame();
  const bite = hits.find((x) => x[2] === 'Slag Spill');
  assert.ok(bite && bite[1] === 'fire' && bite[0] === 20, 'the spill bites my feet - the place\'s 20% fire');
});
