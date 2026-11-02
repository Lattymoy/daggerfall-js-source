// THE ASCENT - THE ROOMS AND THE WAYS (LAW 9, 2026-10-16, Mac: "I just feel like we could do more to utilizing climbing
// sections, different elevations. Something that isnt just a straight line from point A to point B. Like, I want it to feel
// like you're actually traverversing corridors, different rooms, etc. This is just too simple"; bible/11-Multiplayer/
// Elite-Gates-Ascent.md sections 1, 3, 4, 5 and 7): spec law 9's generator - THE ROUTE PLANNER (net/eliteGates/egAscent.js), THE ROOMS
// (net/eliteGates/egRoomLaw.js), the climbs, the voids - over THE LAW PIN's 800 halls (four seeds, two grounds, a hundred halls), each read
// from first principles here: the way turns, climbs and falls 10-30 m, crosses itself at most twice and 4 m apart, runs from the
// arrival plate to the door through 2-5 rooms, its links walked lengths; every room its own law's; every climb on the way the
// grip's arithmetic with a stair round it; every course proven where it stands and laid along +z; the spec said whole on the
// wire. And the build side (world/eliteGates/egHall.js, world/eliteGates/egRoomModel.js): the rooms in the circle's collider and mesh at the heights
// the law says, their clamp zones and the climbs'; the law pin (laws 4-8 byte for byte, law 9's 800 halls hashed whole); the
// lab's map (src/tools/spireMap.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egHallTry, egSpecDigest, egAscentCourses, egAscentProof, egCircleSpecs, egFirstHallOf, egOnFloor, egLawSeam, EG_SPEC, EG_ASCENT_LAW, EG_SPEC_SAID_MAX, EG_ASCENT_LAST_TRIES, EG_ASCENT_HERO_TRIES, EG_RELAY_MAX } from '../../../src/net/eliteGates/egLaw.js';
import { egAscentSane, egAscentWhy, egRouteLength, egRouteCrossings, egRouteMainOf, EG_ASCENT_ROOMS, EG_ASCENT_FRAGS_MAX, EG_ASCENT_RISE_CM, EG_ASCENT_CROSSINGS_MAX, EG_ROUTE_LEN_MAX_M, EG_ROUTE_S_MAX, EG_ROUTE_CLIMB_PLAN_M, EG_ASCENT_BOUND } from '../../../src/net/eliteGates/egAscent.js';
import { egRoomBuild, egRoomTurned, egRoomHero, egRoomFault, EG_ROOM_KINDS, EG_CLIMB_HANG_CM, EG_CLIMB_GRIP_MS, EG_CLIMB_MMPS, EG_CLIMB_GRIP_QUARTERS, EG_CLIMB_PITCH_MIN_CM, EG_CLIMB_PITCH_CM, EG_CLIMB_PITCHES, EG_CLIMB_LEDGE_CM, EG_CLIMB_WAY_MAX_CM, EG_CLIMB_SIDE_CM, EG_ROUND } from '../../../src/net/eliteGates/egRoomLaw.js';
import { egSpanProof, egRouteCross, EG_SPAN_RUN_MPS, EG_JUMP_G } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egRouted, egRouteLegs, egRouteRoads, egClimbGrip, egLegSeconds, egMantleS, EG_CLIMB_MPS, EG_CLIMB_HANG_M, EG_GRIP_S, EG_CLIMB_START_S, EG_CLIMB_LEDGE_MIN_M } from '../../../src/net/eliteGates/egRouteProof.js';
import { egRouteLen, EG_ROUTE_KINDS } from '../../../src/net/eliteGates/egRoute.js';
import { EG_LAWS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew } from '../../../src/net/eliteGates/egBrain.js';
import { egByHeight } from '../../../src/net/eliteGates/egWalkGraph.js';
import { PARKOUR_HANG_DROP, gripSeconds, freeClimbSpeed, freeStartSeconds, mantleDuration } from '../../../src/player/parkour.js';
import { walkSpeed } from '../../../src/player/motor.js';
import { buildEgCircleModel, egCircleColliderTris, egInHeroBox, egFragZones, egFragArena, egFragKeep, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { egRoomsOf, egClimbZones, EG_CLIMB_ZONE_OUT_M } from '../../../src/world/eliteGates/egRoomModel.js';
import { SD_REALM_FLOOR_RECORD } from '../../../src/world/superDungeon/sdRealm.js';
import { egMapOf, egRoomViews } from '../../../src/tools/spireMap.js';

// EG-PERFECT (spec law 10, 2026-10-18): this page holds LAW 9 - its 800 halls, its rooms, its route - byte for byte beside the
// law after it (test/net/eliteGates/egperfect_broken.test.js holds law 10's): every hall it lays unnamed is law 9's
egLawSeam(9);

/** THE LAW PIN's 800 halls (test/net/eliteGates/eghero_lay.test.js's own): four seeds, two grounds, a hundred halls - each laid once here. */
const LAW_HALLS = [];
for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) LAW_HALLS.push([seed, h, geo]);
let _all = null;
const all = () => (_all ??= LAW_HALLS.map(([s, h, g]) => egHallOf(s, h, g)));
const hashOf = (specs) => { let acc = 0x811c9dc5; for (const q of specs) acc = Math.imul(acc ^ egSpecDigest(q), 0x01000193) >>> 0; return acc >>> 0; };
const hash = (law) => hashOf(LAW_HALLS.map(([s, h, g]) => egHallOf(s, h, g, law)));
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
/** The main way's links in order: the road-0 link between each two of its nodes (either way it runs). */
const mainLinks = (R) => R.main.slice(1).map((b, k) => { const a = R.main[k]; return R.links.find((l) => l.road === 0 && ((l.a === a && l.b === b) || (l.b === a && l.a === b))); });
/** How far point p is from the segment a-b (three dimensions, m). */
function segNear(a, b, p) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L2)) : 0;
  return Math.hypot(a[0] + d[0] * t - p[0], a[1] + d[1] * t - p[1], a[2] + d[2] * t - p[2]);
}
/** Do two segments cross properly in plan ([x, y, z] points)? */
const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]));
const crosses = (a0, a1, b0, b1) => side(a0, a1, b0) * side(a0, a1, b1) < 0 && side(b0, b1, a0) * side(b0, b1, a1) < 0;
/** The main way's crossings read from the spec, first principles: each pair of its links whose lines cross in plan, a room's
 *  own links (both ends in its box) one part, a course's own one part, every other its own - `{ pairs, gaps }`, `gaps` the
 *  height between the two ways at every crossing (a room's own among them). */
function crossingsOf(spec) {
  const R = spec.route, N = R.nodes, ml = mainLinks(R);
  const boxes = spec.rooms.map((q) => spec.heroes[q.h].box), grounds = R.courses;
  const inB = (b, p) => p[0] >= b[0] - 0.011 && p[0] <= b[3] + 0.011 && p[2] >= b[2] - 0.011 && p[2] <= b[5] + 0.011 && p[1] >= b[1] - 0.5 && p[1] <= b[4] + 0.5;
  const inG = (g, p) => p[0] >= g.x0 - 1 && p[0] <= g.x1 + 1 && p[2] >= g.z0 - 1 && p[2] <= g.z1 + 1 && p[1] >= g.y0 - 1 && p[1] <= g.y1 + 1;
  const part = ml.map((l, i) => {
    const a = N[l.a], b = N[l.b], r = boxes.findIndex((B) => inB(B, a) && inB(B, b));
    if (r >= 0) return `r${r}`;
    const c = grounds.findIndex((g) => inG(g, a) && inG(g, b));
    return c >= 0 ? `c${c}` : `l${i}`;
  });
  const pairs = new Set(), gaps = [];
  for (let i = 0; i < ml.length; i++) for (let j = i + 2; j < ml.length; j++) {
    const a0 = N[ml[i].a], a1 = N[ml[i].b], b0 = N[ml[j].a], b1 = N[ml[j].b];
    if (!crosses(a0, a1, b0, b1)) continue;
    const dx = a1[0] - a0[0], dz = a1[2] - a0[2], ex = b1[0] - b0[0], ez = b1[2] - b0[2], den = dx * ez - dz * ex;
    const u = ((b0[0] - a0[0]) * ez - (b0[2] - a0[2]) * ex) / den, v = ((b0[0] - a0[0]) * dz - (b0[2] - a0[2]) * dx) / den;
    gaps.push(Math.abs(a0[1] + (a1[1] - a0[1]) * u - (b0[1] + (b1[1] - b0[1]) * v)));
    if (part[i] !== part[j]) pairs.add([part[i], part[j]].sort().join('|'));
  }
  return { pairs: pairs.size, gaps };
}

test('THE ASCENT - THE ROOMS: THE LAW PIN (section 22): spec law 9 is the law (EG_SPEC, EG_ASCENT_LAW), kept in EG_LAWS from 2026-10-16 beside laws 4 to 8, each inside its seven days; laws 4 to 8 byte for byte (their 800 halls hashed whole, as test/net/eliteGates/egaudit5_f.test.js recorded them); law 9\'s 800 halls hashed whole; a breach opened now records law 9, and a law 9 hall says its law (`law`, the gate HEIGHT reads) (mutants: law 9 not in the table; a law before moved; the spec\'s law unsaid)', () => {
  // PIN MOVED (EG-PERFECT, spec law 10 - test/net/eliteGates/egperfect_broken.test.js holds its own pin): law 9 kept beside law 10
  assert.deepEqual([EG_SPEC, EG_ASCENT_LAW], [10, 9]);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11].map(egLawKnown), [true, true, true, true, true, true, true, false]);
  assert.ok((Date.parse(EG_LAWS[10]) - Date.parse(EG_LAWS[4])) / 86_400_000 <= 7, 'every law before inside its keep');
  assert.deepEqual([hash(4), hash(5), hash(6), hash(7), hash(8)], [1228307904, 1301097644, 201408482, 2018192008, 3066462283], 'laws 4 to 8, byte for byte');
  assert.equal(hashOf(all()), 771537807, 'law 9, as THE ROOMS lay it');
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  assert.equal(B.egv, 10, 'a breach opened now is of the newest law (law 10 - PIN MOVED)');
  for (const s of all()) assert.ok(s.v === 9 && s.law === 9 && egByHeight(s), `${s.seed}:${s.h}: says its law`);
  for (const law of [4, 8]) assert.equal(Object.hasOwn(egHallOf(77, 5, 0, law), 'law'), false, `law ${law}: no \`law\` (its \`v\` is its law)`);
});

test('THE ASCENT - THE ROOMS: EVERY HALL LAYS AND STANDS (sections 1, 6 and 7): each of the 800 is laid (none wanting, inside EG_RELAY_MAX + 1 + EG_ASCENT_LAST_TRIES tries), proven (egAscentProof - every course by THE TIMED SOLVER where it stands, THE ROUTE\'S SANITY, the whole hall over THE ROUTE as THE PROOFS prove it), said whole on the wire (EG_SPEC_SAID_MAX), inside the hall\'s bound (x within 150 m, z -10 to 158 m, y within 60 m), its fragments within EG_ASCENT_FRAGS_MAX (rooms counted); its main way rises and falls 10-30 m, runs at most EG_ROUTE_LEN_MAX_M and EG_ROUTE_S_MAX at THE SPAN BUILD (THE PROOFS\' median over the route - egRouteCross), through as many rooms as its kind draws (mutants: the rise unbounded; the frags uncapped; a hall\'s rooms its kind\'s not)', (t) => {
  const st = { size: 0, frags: 0, rooms: {}, len: [], secs: [], rise: [], laid: 0 };
  assert.equal(EG_ASCENT_FRAGS_MAX, 11, 'the cap, raised as the spec\'s size allows (its worst measured below)');
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo} (${s.kind})`, R = s.route;
    assert.ok(s.laid < EG_RELAY_MAX + 1 + EG_ASCENT_LAST_TRIES + EG_ASCENT_HERO_TRIES, `${at}: laid on a try the law gives`);
    const pr = egAscentProof(s);
    assert.ok(pr.ok, `${at}: ${pr.why.slice(0, 3).join('; ')}`);
    const size = JSON.stringify(s).length;
    assert.ok(size <= EG_SPEC_SAID_MAX, `${at}: ${size} characters`);
    assert.ok(s.frags.length <= EG_ASCENT_FRAGS_MAX, `${at}: ${s.frags.length} fragments`);
    for (const n of R.nodes) assert.ok(Math.abs(n[0]) <= 150 && n[2] >= -10 && n[2] <= 158 && Math.abs(n[1]) <= 60, `${at}: a node at ${n} inside the bound`);
    assert.ok(s.len <= 158, `${at}: its length ${s.len}`);
    const ys = R.main.map((i) => R.nodes[i][1]), rise = Math.max(...ys) - Math.min(...ys);
    assert.ok(rise >= EG_ASCENT_RISE_CM[0] / 100 - 1e-9 && rise <= EG_ASCENT_RISE_CM[1] / 100 + 1e-9, `${at}: its way rises and falls ${rise} m`);
    const [lo, hi] = EG_ASCENT_ROOMS[s.kind];
    assert.ok(s.rooms.length >= lo && s.rooms.length <= hi, `${at}: ${s.rooms.length} rooms`);
    const len = egRouteLength(s), secs = egRouteCross(s, 0).median;
    assert.ok(len <= EG_ROUTE_LEN_MAX_M && secs <= EG_ROUTE_S_MAX, `${at}: ${len} m, ${secs} s`);
    st.size = Math.max(st.size, size); st.frags = Math.max(st.frags, s.frags.length); st.rooms[s.rooms.length] = (st.rooms[s.rooms.length] ?? 0) + 1;
    st.len.push(len); st.secs.push(secs); st.rise.push(rise); st.laid = Math.max(st.laid, s.laid);
  }
  assert.deepEqual(Object.keys(EG_ASCENT_ROOMS).sort(), ['athenaeum', 'brink', 'court', 'deepway', 'proving', 'rampart', 'scriptorium', 'span', 'yard']);
  assert.ok(Object.values(EG_ASCENT_ROOMS).every(([lo, hi]) => lo >= 2 && hi <= 5 && lo <= hi), 'two to five rooms a hall, by its kind');
  assert.ok(st.size < EG_SPEC_SAID_MAX * 0.85, `the worst spec ${st.size} characters - the cap's headroom`);
  const q = (a, f) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(f * (b.length - 1))].toFixed(1); };
  t.diagnostic(`worst spec ${st.size} chars, most frags ${st.frags}, rooms ${JSON.stringify(st.rooms)}, route m ${q(st.len, 0)}/${q(st.len, 0.5)}/${q(st.len, 1)}, s ${q(st.secs, 0)}/${q(st.secs, 0.5)}/${q(st.secs, 1)}, rise m ${q(st.rise, 0)}/${q(st.rise, 0.5)}/${q(st.rise, 1)}, last try ${st.laid}`);
});

test('THE ASCENT - THE ROOMS: THE ROUTE\'S CONTRACT (section 1, THE ROUTE\'s readers - net/eliteGates/egRoute.js): every hall\'s route is nodes and links of section 1\'s kinds on roads 0, 1 and 2; `main` runs from the ARRIVAL PLATE\'s node (its heart) to the DOOR\'s (the end plate\'s heart; the Court\'s lord\'s ground - its wake ring), each step of it a road-0 link; each link\'s `len` its WALKED length (a climb\'s and a drop\'s its height and its plan, any other its line); THE ROUTE\'s own reader measures the main way as the links say it; a road-2 way leaves the main way and a road-1 way rejoins it (mutants: a link\'s length its plan; the main way from another node; a room\'s long way round on the main road)', () => {
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`, R = s.route, N = R.nodes;
    assert.deepEqual(N[R.main[0]], [0, 0, 0], `${at}: from the arrival plate's heart`);
    assert.ok(Math.hypot(s.arrive.x, s.arrive.z) < 1e-9 && s.arrive.y === 0);
    const door = N[R.main[R.main.length - 1]];
    if (s.end) assert.ok(Math.hypot(door[0] - s.end.x, door[2] - s.end.z) <= 1e-6 && near(door[1], s.end.y), `${at}: to the door's heart (${door} - ${s.end.x}, ${s.end.z})`);
    else { const g = s.ring ?? s.foe; assert.ok(s.kind === 'court' && Math.hypot(door[0] - g.x, door[2] - g.z) < 1e-6, `${at}: the Court's way ends on its lord's ground's heart`); }
    for (const [i, l] of R.links.entries()) {
      assert.ok(EG_ROUTE_KINDS.includes(l.kind) && [0, 1, 2].includes(l.road) && N[l.a] && N[l.b], `${at}: link ${i}`);
      const p = N[l.a], q = N[l.b], plan = Math.hypot(q[0] - p[0], q[2] - p[2]), dy = Math.abs(q[1] - p[1]);
      const walked = l.kind === 'climb' || l.kind === 'drop' ? dy + plan : Math.hypot(plan, dy);
      assert.ok(near(l.len, walked, 0.02), `${at}: link ${i} (${l.kind}) said ${l.len} m, walked ${walked}`);
      if (l.kind === 'climb' || l.kind === 'drop') assert.equal(l.one, 1, `${at}: a ${l.kind} is taken one way`);
    }
    const ml = mainLinks(R);
    assert.ok(ml.every(Boolean), `${at}: the main way, link by link`);
    assert.ok(near(egRouteLen(s, 0), ml.reduce((a, l) => a + l.len, 0), 0.05), `${at}: THE ROUTE reads the main way's length (${egRouteLen(s, 0)})`);
    assert.ok(near(egRouteLength(s), egRouteLen(s, 0), 0.05));
    // the other roads: a side way (2) leaves the main way - every one reaches it; the other road (1) leaves and rejoins it
    const onMain = new Set(R.main);
    for (const road of [1, 2]) {
      const ls = R.links.filter((l) => l.road === road);
      if (!ls.length) continue;
      const adj = new Map();
      for (const l of R.links.filter((q) => q.road === road || q.road === 0)) { for (const [a, b] of [[l.a, l.b], [l.b, l.a]]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); } }
      for (const l of ls) {
        const seen = new Set([l.a]), qq = [l.a];
        let hit = onMain.has(l.a);
        while (qq.length && !hit) { const k = qq.shift(); for (const n of adj.get(k) ?? []) if (!seen.has(n)) { seen.add(n); qq.push(n); if (onMain.has(n)) hit = true; } }
        assert.ok(hit, `${at}: a road-${road} link reaches the main way`);
      }
    }
  }
});

test('THE ASCENT - THE ROOMS: NOT A STRAIGHT LINE (sections 1 and 5): every hall\'s main way runs along x and along z (it turns), most come back along -z (the serpentine), it crosses over or under itself at most EG_ASCENT_CROSSINGS_MAX times (a room\'s own stair round its own walk is the room\'s - a tower\'s - and a course\'s own one way) and every crossing - a room\'s own too - stands 4 m and more apart in height (THE ROUTE\'s stacked ways, HEIGHT\'s storey); hundreds of halls cross themselves; the law\'s count (egRouteCrossings) is the one read here (mutants: the crossings uncapped; a tower\'s turn 3.8 m over the one under it; the crossings counted link by link)', (t) => {
  const hist = {};
  let back = 0, minGap = Infinity;
  assert.equal(EG_ASCENT_CROSSINGS_MAX, 2);
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`, R = s.route, N = R.nodes, ml = mainLinks(R);
    const dx = (l) => Math.abs(N[l.b][0] - N[l.a][0]), dz = (l) => Math.abs(N[l.b][2] - N[l.a][2]);
    assert.ok(ml.some((l) => dx(l) > dz(l) + 1) && ml.some((l) => dz(l) > dx(l) + 1), `${at}: it turns`);
    // along the way's own order: a leg run back toward the plate
    if (R.main.slice(1).some((b, k) => N[b][2] < N[R.main[k]][2] - 3)) back++;
    const c = crossingsOf(s);
    assert.ok(c.pairs <= EG_ASCENT_CROSSINGS_MAX, `${at}: ${c.pairs} crossings`);
    assert.equal(egRouteCrossings(s), c.pairs, `${at}: the law's count`);
    for (const g of c.gaps) { assert.ok(g >= 4 - 1e-6, `${at}: two ways ${g.toFixed(2)} m apart where they cross`); minGap = Math.min(minGap, g); }
    hist[c.pairs] = (hist[c.pairs] ?? 0) + 1;
  }
  assert.ok(back >= all().length * 0.75, `${back} halls come back along -z`);
  assert.ok((hist[1] ?? 0) + (hist[2] ?? 0) >= 200, `the way crosses itself in ${(hist[1] ?? 0) + (hist[2] ?? 0)} halls`);
  t.diagnostic(`crossings ${JSON.stringify(hist)}, the closest crossing ${minGap.toFixed(2)} m apart, ${back} halls come back along -z`);
});

test('THE ASCENT - THE ROOMS: EVERY ROOM ITS OWN LAW\'S (section 3): each room is a hero whose `room` names its archetype (EG_ROOM_KINDS), its numbers, the sockets it uses and its turn - and built again from those words (egRoomBuild, egRoomTurned, egRoomHero: the world builds its walls so) it is its own hero exactly, without a fault (egRoomFault: its floors and stairs joined, its doors in its walls, its climbs the grip\'s, no wall across its ways nor along them within a body\'s reach - every doorway crossed square, its threshold EG_ROOM_THRESHOLD_CM in); its floors are no fight floor (a room is traversal), its way in and out on the route (mutants: a room\'s words not its record; a room on the fight floor; a socket off the route; a doorway\'s way along its wall, no threshold; the gallery\'s rail across the back stair\'s head; the wall reader blind)', (t) => {
  const kinds = {};
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`, N = s.route.nodes;
    for (const r of s.rooms) {
      const q = s.heroes[r.h];
      assert.ok(q && q.room && q.room.k === r.k && EG_ROOM_KINDS.includes(r.k), `${at}: room ${r.k}`);
      kinds[r.k] = (kinds[r.k] ?? 0) + 1;
      const { k, p, u, t: turn } = q.room, R = egRoomTurned(egRoomBuild(k, p, u, s.band, q.kit), u[0], turn), H = egRoomHero(R, u[1], [], q.id);
      assert.deepEqual(egRoomFault(H, R), [], `${at}: ${k} stands by its law`);
      const cm = (v) => Math.round(v * 100);
      assert.deepEqual(q.floors.map((g) => [cm(g.y - q.y), g.poly.map(([x, z]) => [cm(x - q.x), cm(z - q.z)])]), H.floors.map((g) => [g.y, g.poly]), `${at}: ${k}'s floors are its words'`);
      assert.deepEqual(q.open, H.open, `${at}: ${k}'s open edges are its words'`);
      assert.ok(q.floors.every((g) => g.fight === 0), `${at}: ${k} is traversal`);
      // its way in and its way out on the route: a link of it passes through each socket it uses
      for (const so of [q.sockets.in, q.sockets.out[q.exit]]) assert.ok(s.route.links.some((l) => segNear(N[l.a], N[l.b], [so.x, so.y, so.z]) < 0.05), `${at}: ${k}'s socket at (${so.x}, ${so.y}, ${so.z}) on the route`);
    }
    // no fight floor of the hall is a room's
    for (const f of (s.fl ?? []).filter((g) => g.t === 'p')) assert.ok(!s.rooms.some((r) => s.heroes[r.h].floors.some((g) => JSON.stringify(g.poly) === JSON.stringify(f.poly))), `${at}: a fight floor a room's`);
  }
  assert.deepEqual(Object.keys(kinds).sort(), [...EG_ROOM_KINDS].sort(), 'every archetype laid');
  // the reader reads a wall across a way, and one along it within a body's reach: a stair hall's first walk walled across
  const R0 = egRoomTurned(egRoomBuild('stair', [2000, 550, 0, 0], [0, 4], 0, 'caverns'), 0, 0), H0 = egRoomHero(R0, 4, [], 'x');
  assert.deepEqual(egRoomFault(H0, R0), []);
  const l0 = R0.way.links.find((l) => l.kind === 'walk' && R0.way.nodes[l.a][1] === 0 && R0.way.nodes[l.b][1] === 0 && Math.hypot(R0.way.nodes[l.b][0] - R0.way.nodes[l.a][0], R0.way.nodes[l.b][2] - R0.way.nodes[l.a][2]) > 300);
  const [pa, pb] = [R0.way.nodes[l0.a], R0.way.nodes[l0.b]], mx = (pa[0] + pb[0]) / 2, mz = (pa[2] + pb[2]) / 2, ux = pb[0] - pa[0], uz = pb[2] - pa[2], L0 = Math.hypot(ux, uz);
  const across = { s: [Math.round(mx - (uz / L0) * 200), Math.round(mz + (ux / L0) * 200), Math.round(mx + (uz / L0) * 200), Math.round(mz - (ux / L0) * 200)], y0: 0, y1: 110, k: 'r' };
  assert.ok(egRoomFault(H0, { ...R0, walls: [...R0.walls, across] }).some((w) => /meets a wall \(r\)/.test(w)), 'a rail across its way');
  const along = { s: [Math.round(pa[0] + (uz / L0) * 20), Math.round(pa[2] - (ux / L0) * 20), Math.round(pb[0] + (uz / L0) * 20), Math.round(pb[2] - (ux / L0) * 20)], y0: 0, y1: 300, k: 'w' };
  assert.ok(egRoomFault(H0, { ...R0, walls: [...R0.walls, along] }).some((w) => /meets a wall \(w\)/.test(w)), 'a wall along it, 20 cm off');
  t.diagnostic(`rooms laid: ${JSON.stringify(kinds)}`);
});

test('THE ASCENT - THE ROOMS: CLIMBING (section 4): a pitch on the way is the grip\'s own arithmetic at Climbing 0 with its fatigue spent, on THE PROOFS\' motor numbers (net/eliteGates/egRouteProof.js - the catch\'s reach 1.84 m and three quarters of a 2.1 s hold at the span build\'s free climb: 300 cm; the law takes 290, THE PROOFS prove to 332), at least 2.5 m (under it a mantle); at most two in a row with a rest ledge between (1.2 m deep - THE PROOFS stand a body on 0.8), never 9 m on the way, every one THE PROOFS\' grip (egClimbGrip), and ALWAYS A STAIR ROUND IT (its foot and its top joined by the route without a climb or a drop); off the way (road 2) a climb of 6-14 m to a cache or a vantage; every climb a link of the route taken one way that names it (`climb` - its number in `climbs`, its foot and lip the link\'s ends\' heights), its zone in the world (mutants: a pitch past the grip; three pitches in a row; the climb with no stair round; a side climb under 6 m; a climb link naming another\'s climb; the hang restated at 1.8 m)', (t) => {
  assert.equal(EG_CLIMB_HANG_CM, Math.round(EG_CLIMB_HANG_M * 100));
  assert.equal(EG_CLIMB_HANG_CM, Math.round(PARKOUR_HANG_DROP * 100) + 4, 'the catch: the hang\'s drop and the free climb\'s 4 cm (motor.js)');
  assert.equal(EG_CLIMB_GRIP_MS, Math.round(EG_GRIP_S * 1000));
  assert.equal(EG_CLIMB_GRIP_MS, Math.round(gripSeconds(0, 0) * 1000));
  assert.equal(EG_CLIMB_MMPS, Math.floor(EG_CLIMB_MPS * 1000));
  assert.equal(EG_CLIMB_MMPS, Math.floor(freeClimbSpeed(walkSpeed(10), 0) * 1000));
  const reach = EG_CLIMB_HANG_CM + Math.floor((EG_CLIMB_GRIP_MS * EG_CLIMB_MMPS * EG_CLIMB_GRIP_QUARTERS) / 4 / 10000);
  assert.ok(EG_CLIMB_PITCH_CM <= reach && reach - EG_CLIMB_PITCH_CM <= 10, `a pitch ${EG_CLIMB_PITCH_CM} cm, the grip's reach ${reach}`);
  assert.equal(egClimbGrip({ y0: 0, y1: EG_CLIMB_PITCH_CM / 100, ledges: [] }), '', 'the law\'s longest pitch THE PROOFS\' grip');
  assert.deepEqual([EG_CLIMB_PITCH_MIN_CM, EG_CLIMB_PITCHES, EG_CLIMB_LEDGE_CM, EG_CLIMB_WAY_MAX_CM, [...EG_CLIMB_SIDE_CM]], [250, 2, 120, 900, [600, 1400]]);
  assert.ok(EG_CLIMB_LEDGE_CM >= EG_CLIMB_LEDGE_MIN_M * 100, 'a rest ledge stands a body');
  let way = 0, side = 0;
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`, R = s.route, N = R.nodes;
    for (const c of s.climbs) {
      const ys = [c.y0, ...c.ledges, c.y1], pitches = ys.slice(1).map((y, k) => Math.round((y - ys[k]) * 100));
      assert.ok(Math.hypot(c.face[0], c.face[1]) === 1 && (c.ledges.length === 0 || c.d * 100 >= EG_CLIMB_LEDGE_CM - 1e-6), `${at}: a face, its ledges a body stands on`);
      if (c.road === 0) {
        way++;
        assert.ok(pitches.length <= EG_CLIMB_PITCHES && pitches.every((p) => p >= EG_CLIMB_PITCH_MIN_CM && p <= EG_CLIMB_PITCH_CM) && Math.round((c.y1 - c.y0) * 100) <= EG_CLIMB_WAY_MAX_CM, `${at}: a climb on the way of pitches ${pitches}`);
        assert.equal(egClimbGrip(c), '', `${at}: THE PROOFS' grip`);
      } else {
        side++;
        const H = Math.round((c.y1 - c.y0) * 100);
        assert.ok(c.road === 2 && H >= EG_CLIMB_SIDE_CM[0] && H <= EG_CLIMB_SIDE_CM[1], `${at}: a climb off the way ${H} cm`);
      }
    }
    const named = new Set();
    for (const l of R.links.filter((q) => q.kind === 'climb')) {
      assert.ok(N[l.b][1] > N[l.a][1] && Math.hypot(N[l.b][0] - N[l.a][0], N[l.b][2] - N[l.a][2]) <= EG_ROUTE_CLIMB_PLAN_M, `${at}: a climb up its own face`);
      const c = s.climbs[l.climb];
      assert.ok(Number.isInteger(l.climb) && c && near(c.y0, N[l.a][1]) && near(c.y1, N[l.b][1]) && c.road === l.road && !named.has(l.climb), `${at}: a climb link names its own climb`);
      named.add(l.climb);
      if (l.road !== 0) continue;
      const adj = new Map();
      for (const q of R.links) { if (q.kind === 'climb' || q.kind === 'drop') continue; for (const [a, b] of [[q.a, q.b], [q.b, q.a]]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); } }
      const seen = new Set([l.a]), qq = [l.a];
      while (qq.length) { const k = qq.shift(); for (const n of adj.get(k) ?? []) if (!seen.has(n)) { seen.add(n); qq.push(n); } }
      assert.ok(seen.has(l.b), `${at}: a stair round the climb from ${N[l.a]} to ${N[l.b]}`);
    }
    assert.equal(R.links.filter((q) => q.kind === 'climb').length, s.climbs.length, `${at}: every climb on the route`);
    assert.equal(egClimbZones(s).length, s.climbs.length);
  }
  assert.ok(way >= 300 && side >= 100, `${way} climbs on the way, ${side} off it`);
  t.diagnostic(`${way} climbs on the way, ${side} off it`);
});

test('THE ASCENT - THE ROOMS: THE WAY STANDS ON FLOORS (section 7\'s "nothing unwalkable is emitted" - what tools/egSpanSolve.mjs\'s real motor walks): along every walk, bridge and stair of the 800 halls\' proven roads (THE PROOFS\' legs: the main way and THE FORK\'s other), every half metre stands on a floor of its height - a disc, a band, a lane, a step at rest, a room\'s floor or stair, the hall\'s stairs (egOnFloor, spec.ramps); an island a gap past still ground is bridged to it, the Court\'s way ends on its lord\'s ground and the Low Road\'s on its bridge (mutants: an island\'s gap left open; the Court\'s way run past its ground to the course\'s edge; the Low Road\'s way off its bridge)', () => {
  let legs = 0;
  const onRamp = (s, x, z, y, lo = -Infinity, hi = Infinity) => (s.ramps ?? []).some((q) => {
    const dx = q.bx - q.ax, dz = q.bz - q.az, L2 = dx * dx + dz * dz, t = L2 > 0 ? Math.max(0, Math.min(1, ((x - q.ax) * dx + (z - q.az) * dz) / L2)) : 0, qy = q.y0 + (q.y1 - q.y0) * t;
    return Math.hypot(x - (q.ax + dx * t), z - (q.az + dz * t)) <= q.hw + 0.3 && (Number.isFinite(y) ? Math.abs(y - qy) <= 0.6 : qy >= lo && qy <= hi);
  });
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`;
    for (const road of egRouteRoads(s)) for (const g of egRouteLegs(s, road)) {
      if (g.kind !== 'walk' && g.kind !== 'bridge' && g.kind !== 'stair') continue;
      legs++;
      const n = Math.max(1, Math.ceil(Math.hypot(g.to[0] - g.from[0], g.to[2] - g.from[2]) / 0.5));
      for (let k = 0; k <= n; k++) {
        const f = k / n, x = g.from[0] + (g.to[0] - g.from[0]) * f, y = g.from[1] + (g.to[1] - g.from[1]) * f, z = g.from[2] + (g.to[2] - g.from[2]) * f;
        // a stair's link runs from a floor up its flight to a floor: its plan on a floor or a stair at any height between its ends
        const st = g.kind === 'stair', lo = Math.min(g.from[1], g.to[1]) - 0.6, hi = Math.max(g.from[1], g.to[1]) + 0.6;
        const ok = st ? [lo, (lo + hi) / 2, hi].some((yy) => egOnFloor(s, x, z, 0.3, yy)) || onRamp(s, x, z, NaN, lo, hi) : egOnFloor(s, x, z, 0.3, y) || onRamp(s, x, z, y);
        assert.ok(ok, `${at}: road ${road}'s link ${g.i} (${g.kind}) over nothing at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
  }
  assert.ok(legs > 20000, `${legs} legs walked`);
});

/** THE SPAN BUILD on the route's links (net/eliteGates/egSpanLaw.js's own, restated: its run, the walk's free climb at Climbing 0, the
 *  free climb's start, a rest on each ledge until the grip is back, the mantle from the hang's reach) and A CONFIDENT CLIMBER
 *  (Climbing 50 at the same run: the free climb at the run's pace, its start and its mantle, a fresh grip - no rest). */
const SPAN_B = { run: EG_SPAN_RUN_MPS, climb: EG_CLIMB_MPS, start: EG_CLIMB_START_S, rest: true, down: 1, g: EG_JUMP_G, mantle: (H) => egMantleS(Math.min(H, EG_CLIMB_HANG_M), 0) };
const SURE_B = { run: EG_SPAN_RUN_MPS, climb: freeClimbSpeed(EG_SPAN_RUN_MPS, 50), start: freeStartSeconds(50), rest: false, down: 1, g: EG_JUMP_G, mantle: (H) => mantleDuration(Math.min(H, EG_CLIMB_HANG_M), 50) };
/** A built room's quickest way (s) from its node a to its node b at build B over the links `ok` lets it take, each by THE
 *  PROOFS' law (egLegSeconds - a climb by its own pitches), a one-way link only its own way. */
function roomSeconds(R, a, b, B, ok) {
  const N = R.way.nodes.length, d = Array(N).fill(Infinity), done = Array(N).fill(false);
  const leg = (l, rev) => {
    const P = R.way.nodes[rev ? l.b : l.a].map((v) => v / 100), Q = R.way.nodes[rev ? l.a : l.b].map((v) => v / 100), dy = Q[1] - P[1], plan = Math.hypot(Q[0] - P[0], Q[2] - P[2]);
    const c = l.climb != null ? R.climbs[l.climb] : null;
    return { kind: l.kind, rise: dy, plan, len: l.kind === 'climb' || l.kind === 'drop' ? Math.abs(dy) + plan : Math.hypot(plan, dy), climb: c && { ...c, y0: c.y0 / 100, y1: c.y1 / 100, ledges: c.ledges.map((y) => y / 100), d: c.d / 100 } };
  };
  d[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || u === b) break;
    done[u] = true;
    for (const l of R.way.links) {
      if (!ok(l)) continue;
      if (l.a === u) d[l.b] = Math.min(d[l.b], d[u] + egLegSeconds(leg(l, false), B));
      if (!l.one && l.b === u) d[l.a] = Math.min(d[l.a], d[u] + egLegSeconds(leg(l, true), B));
    }
  }
  return d[b];
}

test('THE ASCENT - THE ROOMS: THE CLIMB IS THE FAST WAY (section 4\'s "the climb is the fast way, the long way round is the other" - THE PROOFS\' design ask): in every room of the 800 halls whose way climbs, its way round - THE LONG WAY ROUND (EG_ROUND: a bay beside the room, its stair rising away from the climb and a walk back at the top), the stair hall\'s round three walls - takes at least as long at THE SPAN BUILD (Climbing 0, its fatigue spent, a rest on every ledge) as its climb way, each timed by THE PROOFS\' own legs; a confident climber (Climbing 50) gains seconds climbing; the stair hall climbs only where its way goes up from its mouth to the gallery\'s side or back over the mouth (mutants: the way round a stair straight up beside the climb; the stair hall\'s climb on its way out ahead)', (t) => {
  assert.deepEqual({ ...EG_ROUND }, { sw: 300, land: 400, mid: 300, top: 400 });
  let rooms = 0, least = Infinity, gain = Infinity;
  const kinds = {};
  for (const s of all()) for (const r of s.rooms) {
    const q = s.heroes[r.h], { k, p, u } = q.room, R = egRoomBuild(k, p, u, s.band, q.kit), at = `${s.seed}:${s.h}:${s.geo} ${k} ${u.slice(0, 2).join('>')}`;
    if (!R.way.links.some((l) => l.kind === 'climb' && l.road === 0)) continue;
    if (k === 'stair') assert.ok(u[0] === 0 && (u[1] === 3 || u[1] === 4), `${at}: the stair hall climbs only up to the gallery's side or back over its mouth`);
    const a = R.sockets[u[0]].n, b = R.sockets[u[1]].n;
    const climbS = roomSeconds(R, a, b, SPAN_B, (l) => l.road === 0), roundS = roomSeconds(R, a, b, SPAN_B, (l) => l.road !== 2 && l.kind !== 'climb');
    assert.ok(Number.isFinite(climbS) && Number.isFinite(roundS) && roundS >= climbS, `${at}: the way round ${roundS.toFixed(2)} s, the climb ${climbS.toFixed(2)} s at THE SPAN BUILD`);
    const sure = roomSeconds(R, a, b, SURE_B, (l) => l.road !== 2 && l.kind !== 'climb') - roomSeconds(R, a, b, SURE_B, (l) => l.road === 0);
    assert.ok(sure >= 1, `${at}: a confident climber gains ${sure.toFixed(2)} s`);
    rooms++; kinds[k] = (kinds[k] ?? 0) + 1; least = Math.min(least, roundS - climbS); gain = Math.min(gain, sure);
  }
  assert.ok(rooms >= 300 && Object.keys(kinds).length === 3, `${rooms} rooms climb on their way (${JSON.stringify(kinds)})`);
  t.diagnostic(`${rooms} rooms climb on the way ${JSON.stringify(kinds)}: the way round at least ${least.toFixed(2)} s the longer at THE SPAN BUILD, a confident climber at least ${gain.toFixed(2)} s the quicker`);
});

test('THE ASCENT - THE ROOMS: THE COURSES WHERE THEY STAND, THE HALL OVER ITS ROUTE (sections 1 and 6 - THE PROOFS\' contract): every piece of a hall in one course (egAscentCourses, `route.courses` its ground); each course along +z road by road (its pieces\' z rising, its line one x - so egBridgeAhead, egSpanPairs and egBridgeOf read it in its own frame, never a turned one) and proven alone as a course (its route dropped - egRouted false - by THE TIMED SOLVER, THE MEDIAN aside); the whole hall proven ONCE over THE ROUTE (egSpanProof: every link of its proven roads by its kind\'s law, THE MEDIAN over the route - egRouteCross); every span link island to island along one course\'s line (its pieces - THE PROOFS\' egRouteSpanSteps - one line\'s, each piece of its road in one span link); laws 4-8 keep THE MEDIAN course by course (egSpanProof\'s own); and the way\'s own proof refuses a climb whose rest ledge is taken away, which neither a course nor THE ROUTE\'S SANITY reads (mutants: a course proven with its route; the hall\'s proof over the route dropped)', () => {
  let alone = 0, spans = 0;
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`, C = egAscentCourses(s);
    assert.equal(C.reduce((a, q) => a + q.steps.length, 0), s.steps.length, `${at}: every piece in a course`);
    for (const q of C) {
      assert.ok(!Object.hasOwn(q, 'route') && !egRouted(q), `${at}: a course proven as a course`);
      for (const road of [0, 1]) {
        const st = q.steps.filter((p) => (p.road ?? 0) === road);
        for (let k = 1; k < st.length; k++) assert.ok(st[k].z > st[k - 1].z, `${at}: a course along +z`);
      }
      assert.ok(egSpanProof(q, false).ok, `${at}: a course proven where it stands`);
      if (!egSpanProof(q).ok) alone++;
    }
    assert.ok(egRouted(s), `${at}: the hall proven over its route`);
    const pr = egSpanProof(s);
    assert.ok(pr.ok, `${at}: ${pr.why.slice(0, 3).join('; ')}`);
    for (const road of egRouteRoads(s)) {
      const seen = new Map();
      for (const g of egRouteLegs(s, road)) {
        if (g.kind !== 'span') continue;
        spans++;
        const xs = g.steps.map((p) => p.x);
        assert.ok(!xs.length || Math.max(...xs) - Math.min(...xs) <= 4, `${at}: road ${road}'s span link ${g.i} along one line`);
        for (const p of g.steps) seen.set(p, (seen.get(p) ?? 0) + 1);
      }
      for (const p of s.steps.filter((q) => (q.road ?? 0) === road)) assert.equal(seen.get(p), 1, `${at}: road ${road}'s piece ${p.i} in one span link`);
    }
  }
  assert.ok(alone > 0 && spans > 800, `${alone} courses whose median alone runs past 1.6 x - the route absorbs it; ${spans} span links`);
  // the way's own proof refuses what neither a course nor the sanity reads: a climb on the way with its rest ledge taken away
  // (its two pitches one, past the grip)
  const s9 = all().find((q) => q.route.links.some((l) => l.kind === 'climb' && l.road === 0 && q.climbs[l.climb].ledges.length));
  const l9 = s9.route.links.find((l) => l.kind === 'climb' && l.road === 0 && s9.climbs[l.climb].ledges.length);
  const bare = { ...s9, climbs: s9.climbs.map((c, i) => (i === l9.climb ? { ...c, ledges: [] } : c)) }, pr9 = egAscentProof(bare);
  assert.ok(!pr9.ok && pr9.why.every((w) => /^the way: road [01], link \d+: a pitch of/.test(w)), pr9.why.join('; '));
  // a law 8 hall: egSpanProof as it was (THE MEDIAN its own)
  const s8 = egHallOf(77, 7, 0, 8);
  assert.deepEqual(egSpanProof(s8), egSpanProof(s8, true));
});

test('THE ASCENT - THE ROOMS: WHAT IT SAYS FOR HEIGHT (section 2 - HEIGHT\'s ask): in a law 9 hall every spot says its height (`y`, centimetres - the floor it stands on), its foe its height (`foe.y`, metres), each rift its height (`y`, metres), its fight ground\'s heart its floor\'s, the Court\'s lord\'s wake ring its ground\'s (`ring.y` - net/eliteGates/egBrain.js ringWake wakes it by height); laws 4-8 say none they did not (mutants: a spot\'s height unsaid; the rifts\' unsaid; the wake ring\'s unsaid)', () => {
  let spots = 0, rifts = 0, foes = 0, rings = 0;
  for (const s of all()) {
    const at = `${s.seed}:${s.h}:${s.geo}`;
    for (const [k, v] of Object.entries(s.spots)) for (const q of v) { assert.ok(Number.isFinite(q.y), `${at}: spot ${k}`); spots++; }
    for (const q of s.rifts) { assert.ok(Number.isFinite(q.y) && Math.abs(q.y) <= 60, `${at}: a rift`); rifts++; }
    if (s.foe) { assert.ok(Number.isFinite(s.foe.y) && Math.abs(s.foe.y) <= 60, `${at}: the foe`); foes++; }
    if (s.ring) { assert.ok(egOnFloor(s, s.ring.x, s.ring.z, 0.3, s.ring.y), `${at}: the lord's wake ring at ${s.ring.y} m, its ground's floor`); rings++; }
    if (s.fight) assert.ok((s.fl ?? []).some((f) => near(f.y ?? 0, s.fight.y)), `${at}: the fight ground's heart at a floor's height`);
  }
  assert.ok(spots > 1000 && rifts > 50 && foes > 100 && rings > 100, `${spots} spots, ${rifts} rifts, ${foes} foes, ${rings} rings`);
  const s8 = egHallOf(77, 1, 0, 8);
  assert.ok(s8.rifts.every((q) => !Object.hasOwn(q, 'y')) && (!s8.foe || !Object.hasOwn(s8.foe, 'y')));
});

test('THE ASCENT - THE ROOMS: THE ROUTE\'S SANITY REFUSES (net/eliteGates/egAscent.js egAscentSane): a bridge that climbs, a stair past its steepest, a climb off its own face, a drop deeper than a Drop, a main way that does not begin at the plate or leaps between two nodes, one that crosses itself three times, one past EG_ROUTE_LEN_MAX_M - and a real hall stands (mutants: each refusal dropped)', () => {
  const s = all()[0], R = s.route;
  assert.equal(egAscentSane(s), '');
  const with_ = (route) => ({ ...s, route: { ...R, ...route } });
  const walked = (kind, q) => (kind === 'climb' || kind === 'drop' ? Math.abs(q[1]) + Math.hypot(q[0], q[2]) : Math.hypot(...q));
  const two = (kind, q, one = 0) => with_({ nodes: [[0, 0, 0], q], links: [{ a: 0, b: 1, kind, road: 0, len: walked(kind, q), one }], main: [0, 1] });
  assert.match(egAscentSane(two('bridge', [0, 1, 20])), /a bridge 1\.00 m up/);
  assert.match(egAscentSane(two('stair', [0, 4, 5])), /a stair 4\.00 m up over 5\.00 m/);
  assert.equal(egAscentSane(two('stair', [0, 3, 5])), '');
  assert.match(egAscentSane(two('climb', [0, 5, EG_ROUTE_CLIMB_PLAN_M + 1], 1)), /a climb 5\.00 m from its line/);
  assert.match(egAscentSane(two('drop', [0, -5, 1], 1)), /a drop of 5\.00 m/);
  assert.match(egAscentSane(with_({ main: [1, 0] })), /does not begin at the arrival plate/);
  assert.match(egAscentSane(with_({ nodes: [[0, 0, 0], [0, 0, 10], [10, 0, 10]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 10 }], main: [0, 1, 2] })), /leaps from node 1 to node 2/);
  assert.match(egAscentSane(with_({ links: R.links.map((l) => ({ ...l, len: l.len * 3 })) })), /the main way runs \d+ m, past 640/);
  // a way that comes back across its first leg four times, each 6 m over the last
  const zig = { nodes: [[0, 0, 0], [0, 0, 30], [-10, 0, 30], [-10, 6, 20], [10, 6, 20], [10, 6, 10], [-10, 12, 10], [-10, 12, 5], [10, 12, 5], [10, 18, 25], [-10, 18, 25]], main: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  zig.links = zig.main.slice(1).map((b, k) => { const p = zig.nodes[zig.main[k]], q = zig.nodes[b], dy = q[1] - p[1], plan = Math.hypot(q[0] - p[0], q[2] - p[2]); return { a: zig.main[k], b, kind: dy ? 'stair' : 'walk', road: 0, len: Math.hypot(plan, dy) }; });
  const Z = { ...s, rooms: [], route: { ...zig, courses: [] } };
  assert.equal(egRouteCrossings(Z), 4, 'the first leg crossed four times over');
  assert.match(egAscentSane(Z), /crosses itself 4 times, past 2/);
  // a way two crossings long stands
  const two2 = { nodes: zig.nodes.slice(0, 7), main: zig.main.slice(0, 7), links: zig.links.slice(0, 6) };
  assert.equal(egRouteCrossings({ ...Z, route: { ...two2, courses: [] } }), 2);
});

test('THE ASCENT - THE ROOMS: ONE SEED, ONE HALL (section 22): a law 9 try laid twice is the same bytes (its die a tape, its planner\'s die its own); the plan\'s main way is the fewest centimetres from the plate to the door over road 0 (egRouteMainOf); a hall whose first try does not stand is laid on a later one (mutants: the planner\'s die shared with the hall\'s)', () => {
  for (const [s, h, g] of [[77, 2, 0], [3, 41, 4], [12345, 77, 0]]) for (const at of [0, 1]) {
    const a = egHallTry(s, h, g, at), b = egHallTry(s, h, g, at);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${s}:${h}:${g} try ${at}`);
  }
  // the main way's search: a road-0 way, never a road-1 link, a one-way link only its own way
  const nodes = [[0, 0, 0], [0, 0, 10], [10, 0, 10], [10, 0, 0]];
  assert.deepEqual(egRouteMainOf(nodes, [{ a: 0, b: 1, road: 0, kind: 'walk', len: 1000 }, { a: 1, b: 2, road: 0, kind: 'walk', len: 1000 }, { a: 0, b: 3, road: 1, kind: 'walk', len: 10 }, { a: 3, b: 2, road: 0, kind: 'walk', len: 10 }], 0, 2), [0, 1, 2]);
  assert.deepEqual(egRouteMainOf(nodes, [{ a: 0, b: 1, road: 0, kind: 'walk', len: 1000 }, { a: 1, b: 2, road: 0, kind: 'walk', len: 1000 }, { a: 0, b: 3, road: 0, kind: 'walk', len: 10 }, { a: 3, b: 2, road: 0, kind: 'walk', len: 10 }], 0, 2), [0, 3, 2], 'the fewest centimetres');
  assert.equal(egRouteMainOf(nodes, [{ a: 1, b: 0, road: 0, kind: 'climb', len: 1000, one: 1 }], 0, 1), null);
  // a hall laid on a later try: its earlier tries refused, each for a reason the law names
  const later = all().find((q) => q.laid > 0);
  assert.ok(later, 'some hall laid again');
  egAscentWhy();
  const again = egHallTry(later.seed, later.h, later.geo, 0);
  assert.ok(!again || !egAscentProof(again).ok || JSON.stringify(again).length > EG_SPEC_SAID_MAX, 'its first try did not stand');
});

// ── the build side ───────────────────────────────────────────────────────────────────────────────────────────────
/** A circle with rooms, climbs and its ceilings - seed 7's first (the lab's). */
const C_SEED = 7, C_C = 1;
/** Does a bucket of triangles (nine numbers each, the dungeon's frame) hold a horizontal one under dungeon-frame (x, z) at
 *  height y (within a millimetre)? */
function trisHold(tris, x, y, z) {
  for (let i = 0; i < tris.length; i += 9) {
    if (Math.abs(tris[i + 1] - y) > 1e-3 || Math.abs(tris[i + 4] - y) > 1e-3 || Math.abs(tris[i + 7] - y) > 1e-3) continue;
    const a = [tris[i], tris[i + 2]], b = [tris[i + 3], tris[i + 5]], c = [tris[i + 6], tris[i + 8]];
    const s1 = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]), s2 = (c[0] - b[0]) * (z - b[1]) - (c[1] - b[1]) * (x - b[0]), s3 = (a[0] - c[0]) * (z - c[1]) - (a[1] - c[1]) * (x - c[0]);
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return true;
  }
  return false;
}
/** A floor's polygon's middle (its corners' mean - every room's floor is convex). */
const mid = (poly) => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
void EG_ASCENT_BOUND;

test('THE ASCENT - THE ROOMS: THE BUILD SIDE (section 4\'s and world/eliteGates/egHall.js\'s): the circle\'s collider holds every room\'s floor and ceiling at the height the law says them, and its walls (egRoomsOf - built again from the room\'s words); its mesh draws every floor\'s top in the floor\'s record at that same height (the top you see is the top you stand on); a room is no baked hero (egInHeroBox never holds it - its stairs are the hall\'s and drawn); the clamp: a hero zone each room, a climb zone each climb FIRST (egFragZones), the climb\'s arena with no ceiling and held along its face; the world\'s module pure (the swap\'s worker builds it) (mutants: a room\'s floors out of the collider; its walls out; the mesh\'s floor a slab low; the room a baked hero\'s box; no climb zone)', () => {
  const specs = egCircleSpecs(C_SEED, C_C, 0), tris = egCircleColliderTris(C_SEED, C_C, 0), model = buildEgCircleModel(C_SEED, C_C, 0);
  let floors = 0, ceils = 0, walls = 0, climbs = 0;
  // the mesh's floor-record triangles, nine numbers each
  const sm = model.subMeshes.filter((q) => q.textureRecord === SD_REALM_FLOOR_RECORD), mesh = [];
  for (const q of sm) for (let k = q.startIndex; k < q.startIndex + q.primitiveCount * 3; k++) { const v = model.indices[k] * 3; mesh.push(model.positions[v], model.positions[v + 1], model.positions[v + 2]); }
  for (const spec of specs) {
    const rooms = egRoomsOf(spec);
    assert.equal(rooms.length, spec.rooms.length, `hall ${spec.h}: every room built`);
    for (const { q, walls: W } of rooms) {
      assert.equal(egInHeroBox({ heroes: [q] }, (q.box[0] + q.box[3]) / 2, (q.box[2] + q.box[5]) / 2), false, 'a room is no baked hero');
      for (const g of q.floors) {
        const [x, z] = mid(g.poly), D = egToDungeon(spec, x, g.y, z);
        assert.ok(trisHold(tris, D[0], D[1], D[2]), `hall ${spec.h} ${q.room.k}: its floor at ${g.y} m in the collider`);
        assert.ok(trisHold(mesh, D[0], D[1], D[2]), `hall ${spec.h} ${q.room.k}: its floor at ${g.y} m drawn where it stands`);
        floors++;
      }
      for (const c of q.ceil ?? []) { const [x, z] = mid(c.poly), D = egToDungeon(spec, x, c.y, z); assert.ok(trisHold(tris, D[0], D[1], D[2]), 'its ceiling in the collider'); ceils++; }
      // a wall: a vertical pair of triangles at its line, from its foot to its head
      for (const w of W) {
        const a = egToDungeon(spec, w.a[0], w.y0, w.a[1]), b = egToDungeon(spec, w.b[0], w.y1, w.b[1]);
        let hit = false;
        for (let i = 0; i < tris.length && !hit; i += 9) hit = [0, 3, 6].some((o) => Math.abs(tris[i + o] - a[0]) < 1e-4 && Math.abs(tris[i + o + 1] - a[1]) < 1e-4 && Math.abs(tris[i + o + 2] - a[2]) < 1e-4) && [0, 3, 6].some((o) => Math.abs(tris[i + o] - b[0]) < 1e-4 && Math.abs(tris[i + o + 1] - b[1]) < 1e-4 && Math.abs(tris[i + o + 2] - b[2]) < 1e-4);
        assert.ok(hit, `hall ${spec.h} ${q.room.k}: a wall (${w.k}) in the collider`);
        walls++;
      }
    }
    // the clamp zones: the climbs' first, then the passages', the chambers', the heroes' - a room's among them
    const Z = egFragZones(spec), nc = spec.climbs.length;
    assert.ok(Z.slice(0, nc).every((q) => q.t === 'climb') && Z.slice(nc).every((q) => q.t !== 'climb'), 'the climbs first');
    assert.equal(Z.filter((q) => q.t === 'hero' && q.h.room).length, spec.rooms.length, 'a zone each room');
    for (const c of spec.climbs) {
      const [nx, nz] = c.face, mx = (c.x0 + c.x1) / 2 + nx * 0.6, mz = (c.z0 + c.z1) / 2 + nz * 0.6, y = (c.y0 + c.y1) / 2;
      const A = egFragArena(spec, egToDungeon(spec, mx, y, mz));
      assert.ok(A && A.zone.t === 'climb' && A.ceilAbove === Infinity, 'on its face: the climb\'s arena, open overhead');
      const L = Math.hypot(c.x1 - c.x0, c.z1 - c.z0), ux = (c.x1 - c.x0) / L, uz = (c.z1 - c.z0) / L;
      const past = egFragKeep(A.zone, c.x1 + ux * 1 + nx * 0.6, c.z1 + uz * 1 + nz * 0.6, 0.35);
      assert.ok(past && Math.abs((past[0] - c.x0) * ux + (past[1] - c.z0) * uz - (L - 0.35)) < 1e-6, 'held along its face');
      assert.equal(egFragKeep(A.zone, mx, mz, 0.35), null, 'free on its face');
      assert.ok(EG_CLIMB_ZONE_OUT_M >= 1);
      climbs++;
    }
  }
  assert.ok(floors >= 10 && ceils >= 3 && walls >= 40 && climbs >= 1, `${floors} floors, ${ceils} ceilings, ${walls} walls, ${climbs} climbs`);
  const src = readFileSync(new URL('../../../src/world/eliteGates/egRoomModel.js', import.meta.url), 'utf8');
  assert.ok(!/\b(document|window|navigator|renderer|gl)\./.test(src) && [...src.matchAll(/from '([^']+)'/g)].every((m) => /^(?:\.\.\/)+net\//.test(m[1])), 'pure: a spec in, triangles out');
});

test('THE ASCENT - THE ROOMS: THE LAB\'S MAP AND ROOMS (section 8 - src/tools/spireMap.js): a law 9 hall\'s map is its route - every link, by kind and road, the main way\'s marked, from the plate to the door, each room named at its middle, each climb\'s face, each void; a law 4-8 hall\'s its course\'s line; two views each room (its mouth, over it) (mutants: the main way unmarked; a law 8 hall\'s line a route)', () => {
  const s = all()[0], M = egMapOf(s);
  assert.equal(M.links.length, s.route.links.length);
  assert.equal(M.links.filter((l) => l.main).length, s.route.main.length - 1);
  assert.deepEqual([M.plate, M.door], [s.route.nodes[0], s.route.nodes[s.route.main[s.route.main.length - 1]]]);
  assert.equal(M.rooms.length, s.rooms.length);
  assert.equal(M.climbs.length, s.climbs.length);
  assert.equal(M.voids.length, s.voids.length);
  const s8 = egHallOf(77, 1, 0, 8), M8 = egMapOf(s8);
  assert.deepEqual([M8.links.length, M8.door], [1, [0, 0, s8.len]]);
  const specs = egCircleSpecs(C_SEED, C_C, 0), V = egRoomViews(specs);
  assert.equal(V.length, 2 * specs.reduce((a, q) => a + q.rooms.length, 0));
  assert.equal(egFirstHallOf(C_C), 1);
});

test('THE ASCENT - A STAIR OVER A HERO IS THE HALL\'S (the relay deploy\'s 500-seed sweep, seeds 172, 211, 301, 320, 359, 360, 375 and 435): a hero\'s box holds a ramp at its own height alone - a room\'s stair stacked over it is built in the hall\'s mesh and collider, never skipped as the hero\'s (mutant: the box asked in plan alone)', () => {
  const hero = { box: [-5, 0, -5, 5, 12.92, 5] };
  assert.equal(egInHeroBox({ heroes: [hero] }, 0, 0, 6), true, 'inside the box, at its height: the hero\'s own stair');
  assert.equal(egInHeroBox({ heroes: [hero] }, 0, 0, 22.5), false, 'over the box (seed 320\'s ramp, 21 to 24 m over a 12.92 m Clan Pit): the hall\'s');
  assert.equal(egInHeroBox({ heroes: [hero] }, 0, 0), true, 'asked in plan (a spout, an alcove): its box in plan, as before');
  assert.equal(egInHeroBox({ heroes: [hero] }, 9, 0, 6), false, 'beside it: never');
});
