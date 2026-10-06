// WATCH-DAY (2026-10-05, Mac: "improve the guards" - asked, the night watch, gate posts and pairs, the uniform only on
// duty; bible/06-Systems/Living-World.md WATCH-DAY): THE WATCH KEEPS THE TOWN ROUND THE CLOCK. The first cut kept two
// shifts (06-16, 14-24) and a day off, so from midnight to six nobody was on watch (the investigation's: zero outdoors
// 01-03h); every watchman walked his own random beat alone - no posts, no pairs (two shared a stop in under 3% of
// samples); and off duty he was still in uniform and still a guard to the crime response and the watch's stop, so more
// "guards" walked the street at five in the evening than mid-shift. Pinned on the synthetic town (test/lwTown.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown, closeTown } from './lwTown.mjs';
import { townPlaces, streetGeometry } from '../src/systems/livingWorld/places.js';
import { townCensus, watchRoster, watchShiftSize, townWatchCount, mintResident, WATCH_COMPANIES } from '../src/systems/livingWorld/census.js';
import { dayPlan, entryAt, watchDuty, patrolBeat, nightTail, morningWalk, walkMinutes, schedule, MIN_STAY, WATCH_SHIFTS, WATCH_ROTATION, DAY_MIN, DAY_START_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown, PAIR_SIDE_M, PAIR_BEHIND_M, WALK_FAST } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { GUARD_TEXTURE, PERSON_TEXTURES } from '../src/characters/mobilePerson.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const town = (blocks) => Object.freeze({ mapId: 12345, blocks, region: 17, people: 3, port: false });

test('WATCH-DAY the watch\'s strength: none in a hamlet, a lone patrol a shift in a village, a pair from nine blocks, a gate\'s post for each nine more to six; four companies of it; a watchman\'s own clothes one of his people\'s outfits, drawn on its own stream (mutants: the strength, the companies, the clothes)', () => {
  assert.equal(WATCH_COMPANIES, 4);
  assert.equal(WATCH_ROTATION, WATCH_COMPANIES);
  assert.deepEqual([1, 2, 8, 9, 17, 18, 27, 36, 45, 64].map((b) => watchShiftSize(town(b))), [0, 1, 1, 2, 2, 3, 4, 5, 6, 6]);
  assert.deepEqual([1, 2, 9, 64].map((b) => townWatchCount(town(b))), [0, 4, 8, 24]);
  const roster = watchRoster(town(27));
  assert.equal(roster.length, 16);
  for (const w of roster) {
    assert.equal(w.archive, GUARD_TEXTURE, 'on duty, the uniform');
    assert.ok(PERSON_TEXTURES.Breton.male.includes(w.civvies) || Object.values(PERSON_TEXTURES).some((t) => t.male.includes(w.civvies)), `${w.id}: his own clothes a man's outfit of his people`);
  }
  assert.equal('civvies' in mintResident(town(9), 'h', 3, 'keeper'), false, 'nobody else');
});

function townOf(blocks, opt = {}) {
  const t = town(blocks);
  const { nav, buildings, doors } = synthTown(opt);
  const places = townPlaces(nav, doors, buildings);
  const watch = townCensus(t, buildings).filter((r) => r.guard);
  return { t, nav, buildings, doors, places, watch, size: watchShiftSize(t) };
}
const planOf = (w, places, day, size) => dayPlan(w, places, day, { mpm: MPM, watch: size });
const onDuty = (e) => !!e && !!e.duty && (e.kind === 'watch' || e.kind === 'post' || e.kind === 'walk');

test('WATCH-DAY the duty: a watchman\'s shift a shift later each day (day, evening, night, off) - the four companies in four shifts every day; the first two of a company a patrol\'s pair, the rest at the gates, one to an exit (the gate each keeps turning by the day), more than the gates a second patrol; one alone where the company is one; a company\'s make by the watch\'s strength - a pair, and a gate for each one more (mutants: the rotation, the company, the pair, the posts, the posts overmanned, the gates\' turn)', () => {
  assert.deepEqual(WATCH_SHIFTS.map((s) => [...s]), [[6, 14], [14, 22], [22, 30]]);
  const big = townOf(64);
  assert.equal(big.size, 6);
  for (const day of [100, 101, 102, 103]) {
    const duties = big.watch.map((w) => watchDuty(w, big.places, day, big.size));
    for (let s = 0; s < 4; s++) assert.equal(duties.filter((d) => d.shift === s).length, big.size, `day ${day}: a company on shift ${s}`);
    for (const w of big.watch) assert.equal(watchDuty(w, big.places, day + 1, big.size).shift, (watchDuty(w, big.places, day, big.size).shift + 1) % 4, 'a shift later each day');
    for (let c = 0; c < 4; c++) {
      const co = duties.filter((d) => d.company === c);
      assert.deepEqual(co.filter((d) => d.kind === 'patrol').map((d) => [d.patrol, d.pair]), [[0, 0], [0, 1]], 'a pair on patrol');
      const gates = co.filter((d) => d.kind === 'post').map((d) => d.post.key).sort();
      assert.deepEqual(gates, big.places.exits.map((e) => e.key).sort(), 'a post at every gate');
    }
  }
  const turn = new Set([100, 101, 102, 103, 104, 105].map((day) => watchDuty(big.watch[8], big.places, day, big.size).post.key));
  assert.ok(turn.size > 1, 'the gate a watchman keeps turns with the days');
  // one alone; a pair; more than the gates
  const village = townOf(4);
  assert.deepEqual(village.watch.map((w) => watchDuty(w, village.places, 100, 1)).map((d) => [d.kind, d.pair]), [['patrol', null], ['patrol', null], ['patrol', null], ['patrol', null]]);
  const make = (blocks) => { const tw = townOf(blocks); return tw.watch.map((w) => watchDuty(w, tw.places, 100, tw.size)).filter((d) => d.company === 0).map((d) => [d.kind, d.patrol, d.pair]); };
  const P = ['post', -1, null];
  assert.deepEqual(make(9), [['patrol', 0, 0], ['patrol', 0, 1]], 'nine blocks: a pair');
  assert.deepEqual(make(18), [['patrol', 0, 0], ['patrol', 0, 1], P], 'eighteen: a pair and a gate');
  assert.deepEqual(make(36), [['patrol', 0, 0], ['patrol', 0, 1], P, P, P], 'thirty-six: a pair and three gates');
  const fewGates = { ...big.places, exits: big.places.exits.slice(0, 2) };
  const d6 = big.watch.map((w) => watchDuty(w, fewGates, 100, 6)).filter((d) => d.company === 0);
  assert.deepEqual(d6.map((d) => [d.kind, d.patrol, d.pair]), [['patrol', 0, 0], ['patrol', 0, 1], ['post', -1, null], ['post', -1, null], ['patrol', 1, 0], ['patrol', 1, 1]], 'two gates: two posts, and a second pair');
});

test('WATCH-DAY round the clock: at every ten minutes of the day, at the day\'s turn among them, a shift\'s strength on duty - the night\'s watch at its post or on its beat from ten at night to six in the morning (mutants: the night shift, the night\'s hold, the morning\'s tail)', () => {
  for (const [blocks, opt] of [[9, {}], [27, { blocksW: 6, blocksH: 6 }], [64, { blocksW: 6, blocksH: 6 }]]) {
    const tw = townOf(blocks, opt);
    for (const day of [100, 101]) {
      const plans = tw.watch.map((w) => planOf(w, tw.places, day, tw.size));
      const D0 = day * DAY_MIN + DAY_START_MIN;
      for (let t = D0; t < D0 + DAY_MIN; t += 10) {
        const n = plans.filter((p) => onDuty(p[entryAt(p, t)])).length;
        assert.ok(n >= tw.size, `${blocks} blocks, day ${day} at ${((t % DAY_MIN) / 60).toFixed(2)}h: ${n} on duty`);
      }
    }
  }
});

test('WATCH-DAY the night over the turn: a night\'s watchman stands at the day\'s end where the next day begins - his post, or his patrol\'s last stop held to 04:00 - and keeps it to six, then walks home in uniform and sleeps the morning (mutants: the start out, the tail, the hold)', () => {
  const tw = townOf(27, { blocksW: 6, blocksH: 6 });
  let nights = 0;
  for (const w of tw.watch) {
    const d = watchDuty(w, tw.places, 100, tw.size);
    if (d.shift !== 2) continue;
    nights++;
    const a = planOf(w, tw.places, 100, tw.size), b = planOf(w, tw.places, 101, tw.size);
    const end = a[a.length - 1], start = b[0];
    assert.deepEqual([end.kind, end.duty, end.t1], [d.kind === 'post' ? 'post' : 'watch', true, 101 * DAY_MIN + DAY_START_MIN], `${w.id}: on his watch at the turn`);
    assert.equal(start.at, end.at, `${w.id}: the next day begins where he stands`);
    assert.deepEqual([start.kind, start.duty, start.t0], [end.kind, true, 101 * DAY_MIN + DAY_START_MIN]);
    const six = 101 * DAY_MIN + 6 * 60;
    const lastDuty = b.filter((e) => e.duty && e.kind !== 'walk').at(-1);
    assert.equal(lastDuty.t1, six, `${w.id}: kept to six`);
    const after = b[b.indexOf(lastDuty) + 1];
    assert.deepEqual([after.kind, after.duty], ['walk', true], 'home in uniform');
    assert.equal(b[b.indexOf(after) + 1].kind, 'sleep', 'and to bed');
    const nt = nightTail(w, tw.places, 100, tw.size, MPM);
    assert.equal(nt.at, end.at);
  }
  assert.equal(nights, tw.size);
  // a town with no spots for a beat: nobody on watch at the turn, the morning begun at home and off duty
  const bare = { ...tw.places, exits: [], social: [], market: [] };
  for (const w of tw.watch.filter((x) => watchDuty(x, bare, 100, 2).shift === 2)) {
    assert.equal(nightTail(w, bare, 100, 2, MPM), null, `${w.id}: no watch at the turn`);
    const b = dayPlan(w, bare, 101, { mpm: MPM, watch: 2 });
    assert.deepEqual([b[0].kind, b.some((e) => e.duty)], ['sleep', false], `${w.id}: the morning at home, off duty`);
  }
});

test('WATCH-DAY the pair: a patrol\'s beat a district - the spots of the town nearest one of them, walked as a ring about their middle; the two of a patrol are at the same stop at the same minute all their shift, wherever they live, and the second walks at the first\'s shoulder - beside him where the street holds it, else behind (mutants: the beat across the town, the pair\'s own stops, the shoulder)', () => {
  const tw = townOf(64, { blocksW: 6, blocksH: 6 });
  const pool = [...tw.places.exits, ...tw.places.social, ...tw.places.market];
  const gap = (a, b) => Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1]);
  let beats = 0;
  for (const day of [100, 101, 102]) for (let company = 0; company < 4; company++) for (const shift of [0, 1, 2]) {
    const beat = patrolBeat(tw.places, tw.watch[0].town, company, 0, day, shift);
    assert.ok(beat.length >= 4 && beat.length <= 6, 'four to six spots');
    const rest = pool.filter((sp) => !beat.includes(sp));
    assert.ok(beat.some((a) => Math.max(...beat.map((b) => gap(a, b))) <= Math.min(...rest.map((b) => gap(a, b)))), `day ${day} company ${company}: the spots nearest one of them`);
    const cx = beat.reduce((a, sp) => a + sp.x, 0) / beat.length, cz = beat.reduce((a, sp) => a + sp.z, 0) / beat.length;
    const bearings = beat.map((sp) => Math.atan2(sp.x - cx, sp.z - cz));
    assert.ok(bearings.every((b, i) => i === 0 || b >= bearings[i - 1]), 'a ring about their middle');
    beats++;
  }
  assert.equal(beats, 36);
  let pairs = 0;
  for (const day of [100, 101]) {
    for (const w of tw.watch) {
      const d = watchDuty(w, tw.places, day, tw.size);
      if (d.pair !== 0 || d.shift === 3) continue;
      const mate = tw.watch.find((x) => { const e = watchDuty(x, tw.places, day, tw.size); return e.company === d.company && e.patrol === d.patrol && e.pair === 1; });
      const away = { ...mate, home: tw.buildings.find((b) => b.key !== w.home).key };   // the mate lives elsewhere
      const sa = planOf(w, tw.places, day, tw.size).filter((e) => e.kind === 'watch' && e.duty);
      const sb = planOf(away, tw.places, day, tw.size).filter((e) => e.kind === 'watch' && e.duty);
      assert.deepEqual(sb.map((e) => [e.at.key, e.t0, e.t1]), sa.map((e) => [e.at.key, e.t0, e.t1]), `day ${day}: ${w.id} and ${mate.id} together`);
      assert.ok(sa.every((e) => e.pair === 0) && sb.every((e) => e.pair === 1));
      pairs++;
    }
  }
  assert.ok(pairs >= 6);
  // the town draws him there: between two stops, the second of a pair a pace off the first - at his shoulder
  const lt = new LivingTown(tw.nav, { town: town(64), buildings: tw.buildings, doors: tw.doors, makePerson: (archive, guard) => new ResidentWalker(tw.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => 0, rate: () => RATE, mpm: MPM });
  let legs = 0;
  for (const w of tw.watch) {
    const d = watchDuty(w, tw.places, 100, tw.size);
    if (d.pair !== 0 || d.shift === 3) continue;
    const mate = tw.watch.find((x) => { const e = watchDuty(x, tw.places, 100, tw.size); return e.company === d.company && e.patrol === d.patrol && e.pair === 1; });
    const plan = planOf(w, tw.places, 100, tw.size);
    for (let i = 1; i < plan.length - 1; i++) {
      const e = plan[i];
      if (e.kind !== 'walk' || plan[i - 1].kind !== 'watch' || plan[i + 1].kind !== 'watch' || e.t1 - e.t0 < 2) continue;
      const t = (e.t0 + e.t1) / 2;
      const a = lt.where(w, t, true), b = lt.where(mate, t, true);
      assert.ok(a?.moving && b?.moving, 'both on the way');
      const apart = Math.hypot(b.x - a.x, b.z - a.z);
      assert.ok(apart > PAIR_SIDE_M / 2 && apart <= PAIR_BEHIND_M + 1e-6, `day 100: ${mate.id} at ${w.id}'s shoulder (${apart.toFixed(2)} m)`);
      legs++;
    }
  }
  assert.ok(legs >= 4, `${legs} legs walked together`);
  // the shoulder: a walk east along the street (z 40.8, the middle of the street's three cells at y 24-26)
  const line = (a, b) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { pts: [a, b], len, cum: [0, len] }; };
  const east = line([48.8, 40.8], [64.8, 40.8]);
  const near = (p, x, z) => Math.hypot(p.x - x, p.z - z) < 1e-6;
  assert.ok(near(lt._atShoulder(east, 8), 56.8, 40.8 - PAIR_SIDE_M), 'at his right shoulder');
  lt._street = { holds: (x, z) => z > 40.8 };
  assert.ok(near(lt._atShoulder(east, 8), 56.8, 40.8 + PAIR_SIDE_M), 'his left, where only that holds');
  lt._street = { holds: () => false };
  assert.ok(near(lt._atShoulder(east, 8), 56.8 - 1.2, 40.8), 'a pace behind, where neither does');
});

test('WATCH-DAY the uniform on duty: the walk out, the watch or the post, the walk home carry `duty`, nothing else does, and the duty changes only at home - never from the watch to the evening\'s spot, nor to the watch from an errand, nor kept at the watch\'s last spot into the evening (no watch outlasts its shift); the street dresses one of the watch by it - the uniform and the guard\'s flag on duty, his own clothes off it - and never changes him in view; a room draws him in his own clothes (mutants: the walk\'s mark, the change by home, the dressing, the change in view, the room)', () => {
  const tw = townOf(27, { blocksW: 6, blocksH: 6 });
  const home = (w) => tw.places.doors.get(w.home);
  for (const day of [100, 101, 102, 103]) {
    for (const w of tw.watch) {
      const plan = planOf(w, tw.places, day, tw.size);
      for (const e of plan) if (e.duty) assert.ok(e.kind === 'watch' || e.kind === 'post' || e.kind === 'walk', `${w.id}: ${e.kind} is no duty`);
      for (let i = 1; i < plan.length; i++) {
        const a = plan[i - 1], b = plan[i];
        if (!!a.duty !== !!b.duty) assert.equal(a.at, home(w), `${w.id} day ${day}: the duty changes at home (${a.kind} at ${a.at?.key} -> ${b.kind})`);
      }
      for (let i = 1; i < plan.length - 1; i++) {
        const e = plan[i];
        if (e.kind !== 'walk') continue;
        const before = plan[i - 1], after = plan[i + 1];
        if (before.duty && before.kind !== 'walk') assert.equal(e.duty, true, 'the walk off a watch in uniform');
        if (after.duty && after.kind !== 'walk') assert.equal(e.duty, true, 'the walk to a watch in uniform');
      }
      const d = watchDuty(w, tw.places, day, tw.size);
      const ends = d.shift === 3 ? day * DAY_MIN + WATCH_SHIFTS[2][1] * 60 - DAY_MIN : Math.min(day * DAY_MIN + WATCH_SHIFTS[d.shift][1] * 60, (day + 1) * DAY_MIN + DAY_START_MIN);
      for (const e of plan) if (e.duty && e.kind !== 'walk') assert.ok(e.t1 <= ends, `${w.id} day ${day}: the watch ends with its shift (${e.kind} at ${e.at.key} to ${((e.t1 % DAY_MIN) / 60).toFixed(2)})`);
    }
  }
  // the street dresses him by it - a watchman found mid-stay on duty (his watch) and off it (the evening's spot)
  const clock = { t: 0 };
  const lt = new LivingTown(tw.nav, { town: town(27), buildings: tw.buildings, doors: tw.doors, makePerson: (archive, guard) => new ResidentWalker(tw.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => clock.t, rate: () => RATE, mpm: MPM });
  const step = (sec, at, yaw = 0) => { for (let i = 0; i < Math.round(sec * 30); i++) { clock.t += RATE / 30; lt.update(1 / 30, at, yaw, at, true); } };
  const day = 100;
  const pick = (want) => {
    for (const w of tw.watch) for (const e of planOf(w, tw.places, day, tw.size)) {
      if (e.kind === 'walk' || !isOutdoor(e) || !!e.duty !== want || e.t1 - e.t0 < 30) continue;
      return { w, t: (e.t0 + e.t1) / 2 };
    }
    return null;
  };
  for (const want of [true, false]) {
    const got = pick(want);
    assert.ok(got, want ? 'one on his watch' : 'one off duty in the street');
    clock.t = got.t;
    // LW-TALK: PIN MOVED - where he stands is read by the minute's deal, a beat of the census there first (read before it,
    // his place was the last scene's: his own stand, 4 m off his place in the evening's circle, beyond its crowd's nearest)
    const was = lt.where(got.w, clock.t, true);
    step(1 / 30, [was.x + 1, 0, was.z], Math.PI / 2);
    const w0 = lt.where(got.w, clock.t, true);
    step(1, [w0.x + 1, 0, w0.z], Math.PI / 2);   // standing beside him, looking away
    const row = lt.pool.find((r) => r.res?.id === got.w.id && r.visible);
    assert.ok(row, `${got.w.id} on the street`);
    assert.equal(row.person.guard, want, `${got.w.id}: the guard's flag ${want ? 'on' : 'off'} duty`);
    assert.equal(row.person.archive, want ? GUARD_TEXTURE : got.w.civvies, `${got.w.id}: ${want ? 'the uniform' : 'his own clothes'}`);
    // never changed in view: wrong clothes on him while the player looks at him stay on; looked away from, changed
    row.person.setIdentity(want ? got.w.civvies : GUARD_TEXTURE, !want);
    const at = [row.person.pos[0] + 1, 0, row.person.pos[2]];
    step(0.3, at, -Math.PI / 2);   // looking at him
    assert.equal(row.person.guard, !want, 'not in view of the player');
    step(0.3, at, Math.PI / 2);   // looking away
    assert.equal(row.person.guard, want, 'changed out of sight');
  }
  assert.match(rd('src/world/travellerSprites.js'), /const archive = flat \? flat\.archive : look \? look\.archive : \(m\.res\.civvies \?\? m\.res\.archive\);/);
  assert.match(rd('src/world/travellerSprites.js'), /const archive = res\.civvies \?\? res\.archive;/);
});

test('WATCH-DAY the post keeps the road: one posted alone at a gate stands facing out of town (mutant: the post\'s facing)', () => {
  const tw = townOf(27, { blocksW: 6, blocksH: 6 });
  const lt = new LivingTown(tw.nav, { town: town(27), buildings: tw.buildings, doors: tw.doors, makePerson: (archive, guard) => new ResidentWalker(tw.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => 0, rate: () => RATE, mpm: MPM });
  const day = 100, t = day * DAY_MIN + 10 * 60;
  const posted = tw.watch.find((w) => { const d = watchDuty(w, tw.places, day, tw.size); return d.kind === 'post' && d.shift === 0; });
  const w = lt.where(posted, t, true);
  assert.equal(w.e.kind, 'post');
  assert.equal(w.yaw, w.e.at.yaw, 'facing the road');
});


test('WATCH-DAY in a great city (eight blocks by eight, a walk across it near three hours): the watch keeps every shift from its hour to its end - on his post or his patrol\'s first stop by the shift\'s start, kept to its end whatever his bedtime (the first cut left the evening\'s and the night\'s watch by the walk home before bed: the night\'s last stop never kept, and the morning began at a post its man had left), the evening off left in time to change at home and walk out (the next pin: LW-SPREAD\'s suppers near home, none here runs into the walk out); a day\'s watchman whose walk out is longer than the two hours from the turn to six leaves before the turn - his day off ends on the walk and his day begins on it; every watchman\'s day runs on from the last, at the turn as anywhere, and the town draws the walk across 04:00 unbroken (mutants: the bedtime cutting the watch, the morning begun at home, the day off ended at home, the walk out early for all)', () => {
  const tw = townOf(64, { blocksW: 8, blocksH: 8 });
  const far = Math.max(...tw.watch.map((w) => Math.max(...tw.places.exits.map((x) => walkMinutes(tw.places.doors.get(w.home), x, MPM)))));
  assert.ok(far > 150, `walks of near three hours (${far} minutes)`);
  const plans = new Map();
  const planAt = (w, day) => { const k = `${w.id}:${day}`; if (!plans.has(k)) plans.set(k, planOf(w, tw.places, day, tw.size)); return plans.get(k); };
  let across = null, shifts = 0, early = 0;
  for (let day = 100; day < 108; day++) {
    const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
    for (const w of tw.watch) {
      const plan = planAt(w, day), next = planAt(w, day + 1);
      assert.ok(plan[0].t0 <= D0 && plan.at(-1).t1 >= D1, `${w.id} day ${day}: the whole day`);
      for (let i = 1; i < plan.length; i++) assert.equal(plan[i].t0, plan[i - 1].t1, `${w.id} day ${day}: contiguous at ${i}`);
      const a = plan.at(-1), b = next[0];
      if (a.kind === 'walk') {
        across ??= { w, t: D1 };
        assert.deepEqual([b.kind, b.t0, b.t1, b.from, b.to, b.duty], ['walk', a.t0, a.t1, a.from, a.to, true], `${w.id} day ${day}: the walk out runs on into the next day`);
        assert.ok(a.t0 < D1 && a.t1 > D1, 'across the turn');
        assert.deepEqual(morningWalk(w, tw.places, day + 1, tw.size, MPM)?.t0, a.t0);
      } else assert.deepEqual([b.t0, b.at, !!b.duty], [D1, a.at, !!a.duty], `${w.id} day ${day}: the next day begins where this one ends`);
      const d = watchDuty(w, tw.places, day, tw.size);
      if (d.shift === 3) continue;
      shifts++;
      const [s0, s1] = WATCH_SHIFTS[d.shift].map((h) => day * DAY_MIN + h * 60);
      const stays = plan.filter((e) => e.duty && e.kind !== 'walk');
      if (plan[0].kind === 'walk') early++;
      assert.ok(stays[0].t0 <= s0, `${w.id} day ${day}: on watch by ${WATCH_SHIFTS[d.shift][0]}:00 (${((stays[0].t0 % DAY_MIN) / 60).toFixed(2)})`);
      assert.equal(stays.at(-1).t1, Math.min(s1, D1), `${w.id} day ${day}: kept to the shift's end`);
    }
  }
  assert.equal(shifts, 8 * 18);
  assert.ok(across && early >= 4, `walks out begun the night before (${early})`);
  // the town draws it: the walker on his way either side of 04:00, never a step longer than his pace
  const lt = new LivingTown(tw.nav, { town: town(64), buildings: tw.buildings, doors: tw.doors, makePerson: (archive, guard) => new ResidentWalker(tw.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => 0, rate: () => RATE, mpm: MPM });
  let prev = null;
  for (let t = across.t - 2; t <= across.t + 2; t += 0.25) {
    const p = lt.where(across.w, t, true);
    assert.ok(p?.moving, `${across.w.id}: on his way at ${(t - across.t).toFixed(2)} minutes from the turn`);
    if (prev) assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) <= MPM * WALK_FAST * 0.25 + 1e-6, 'unbroken');
    prev = p;
  }
});

test('WATCH-DAY the supper before the night\'s watch (LW-SPREAD: PIN MOVED - the great city\'s suppers are near home now, and none there ran into the walk out): off duty, a stay ends in time to change at home and walk out to the watch on its hour - a supper across the town from home, the post across it the other way: the supper cut at the watch\'s hour less the walk home and the walk out, the watch kept from its hour (mutants: the supper making it late)', () => {
  const day = 100, at = (/** @type {number} */ hh) => day * DAY_MIN + hh * 60;
  const home = { key: 'h', kind: 'door', cell: [0, 0], x: 0, z: 0, yaw: 0 };
  const supper = { key: 's', kind: 'social', cell: [300, 0], x: 480, z: 0, yaw: 0 };
  const post = { key: 'x', kind: 'exit', cell: [0, 400], x: 0, z: 640, yaw: 0 };
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const plan = schedule([{ kind: 'social', at: supper, from: at(17.5), dur: 75 }, { kind: 'post', at: post, from: at(22), dur: 8 * 60, until: at(30), slack: Infinity, mark: { duty: true, pair: null } }],
    { D0, D1, wake: at(13), bed: at(30), home, mpm: MPM, away: [] });
  const by = at(22) - walkMinutes(supper, home, MPM) - walkMinutes(home, post, MPM);
  assert.ok(by > at(17.5) + MIN_STAY && by < at(17.5) + 75, 'a supper that would run into the walk out');
  const s = plan.find((e) => e.kind === 'social'), p = plan.find((e) => e.kind === 'post');
  assert.equal(s?.t1, by, 'the supper left in time to change at home and walk out');
  assert.equal(p?.t0, at(22), 'on watch on the hour');
  const i = plan.findIndex((e) => e === s);
  assert.deepEqual(plan.slice(i + 1, i + 3).map((e) => [e.kind, e.from?.key, e.to?.key, !!e.duty]), [['walk', 's', 'h', false], ['walk', 'h', 'x', true]], 'by way of home, into the uniform there');
});
