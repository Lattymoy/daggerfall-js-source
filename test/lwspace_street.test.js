// LW-SPACE (2026-10-06, bible/06-Systems/Living-World.md "LW-SPACE"; Mac: "I notice NPCs and walk stuck inside each
// other"): NOBODY ON THE STREET STANDS OR WALKS INSIDE ANOTHER. DFU's walkers keep off one another by the tiles they claim
// (mobilePerson.js `_setTarget`, CityNavigation's Occupied flag); a resident claims none - its day lays its walk - and
// on the game's own towns 15-44% of the bodies in view at midday and in the evening stood inside another (Ripmarket at
// six: 30.5%). Three causes, each its own law here: those ALONE at a spot stood at places drawn off their ids (a bearing
// and a distance - at a busy spot, on one another and on the circles: `aloneStands`); a company LEAVING one place
// together (a shop's two at noon, a table's drinkers on the hour) walked one line at one pace, inside each other the
// whole way (`_fileOf`: in file); and a walker walked through whoever stood or came the other way on its line (`_dodge`:
// it steps aside). The towns are the synthetic ones (test/lwTown.mjs); the game's own where ARENA2_PATH names the data
// (test/lwRealTown.mjs, the streaming host's build replayed; tools/livingCrowdProbe.mjs measures them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown, closeTown } from './lwTown.mjs';
import { streetGeometry, townPlaces } from '../src/systems/livingWorld/places.js';
import { aloneStand, aloneStands, circleStands, circlesStands, SPACE_M, SPACE_FAR_M, ALONE_NEED_M, CIRCLE_APART } from '../src/systems/livingWorld/meetups.js';
import { LivingTown, FILE_M, FILE_MIN, DODGE_SIDES, DODGE_SETTLE_M } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { NAV_CELL } from '../src/world/cityNavigation.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { skipReal, hostTown, cities } from './lwRealTown.mjs';
import { streetAt } from '../tools/livingCrowdProbe.mjs';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 24680, blocks: 9, region: 17, people: 3, port: false });

/** A living town on a synthetic town's grid, the calendar's clock at `minute`. */
function makeTown(minute, built = synthTown(), town = TOWN) {
  const clock = { t: minute };
  const lt = new LivingTown(built.nav, {
    town, buildings: built.buildings, doors: built.doors,
    makePerson: (archive, guard) => new ResidentWalker(built.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM,
  });
  return { town: lt, clock, nav: built.nav };
}

/** The bodies in view a frame, through `hours`' `seconds` each, the player at `at` (else the square): how many
 *  body-frames, and how many of them stood within `near` m of another - and of those walking. */
function measure(built, hours, seconds, near = 0.5, at = null) {
  let frames = 0, inside = 0, walking = 0, walkingInside = 0;
  for (const hour of hours) {
    const { town, clock } = makeTown(100 * DAY_MIN + hour * 60, built, { ...TOWN, blocks: built.nav.width * built.nav.height / 4096 });
    const p = at ?? [town.places.square.x, 0, town.places.square.z];
    for (let i = 0; i < seconds * 30; i++) {
      clock.t += RATE / 30;
      const seats = town.update(1 / 30, p, 0, p, true);
      if (i < 5 * 30) continue;
      const pos = seats.map((s) => s.person.pos);
      frames += pos.length;
      for (let a = 0; a < pos.length; a++) {
        const moving = seats[a].person.moving;
        if (moving) walking++;
        for (let b = 0; b < pos.length; b++) if (a !== b && Math.hypot(pos[a][0] - pos[b][0], pos[a][2] - pos[b][2]) < near) { inside++; if (moving) walkingInside++; break; }
      }
    }
  }
  return { frames, inside, share: inside / Math.max(1, frames), walking, walkingShare: walkingInside / Math.max(1, walking) };
}

test('LW-SPACE aloneStands: those alone at a spot keep SPACE_M from every place already taken and from one another - one already placed keeps their place as others come (the earliest first), one whose own place is free stands on it, one whose is taken the nearest free place about the spot, on the street and seen from it; none free within SPACE_FAR_M, their own (mutants: the space unread, the earlier unkept, the turns untried, the street unread)', () => {
  const built = synthTown();
  const places = townPlaces(built.nav, built.doors, built.buildings);
  const street = streetGeometry(built.nav, places);
  const spot = places.square;
  const ids = Array.from({ length: 40 }, (_, i) => `L1.${i}`);
  // drawn off their ids alone, forty at one spot stand on one another (the birthday problem the street met)
  const own = ids.map((id) => aloneStand(spot, id, street));
  let onOne = 0;
  for (let a = 0; a < own.length; a++) for (let b = a + 1; b < own.length; b++) if (Math.hypot(own[a].x - own[b].x, own[a].z - own[b].z) < SPACE_M) onOne++;
  assert.ok(onOne > 20, `forty alone at their own places: ${onOne} pairs within SPACE_M (else this pins nothing)`);
  // a circle's three about the spot, taken first
  const circle = circleStands(spot, { index: 0, members: [{}, {}, {}] }, street);
  const got = aloneStands(spot, ids, circle, street);
  assert.equal(got.size, ids.length);
  const all = [...circle, ...ids.map((id) => /** @type {any} */ (got.get(id)))];
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) assert.ok(Math.hypot(all[a].x - all[b].x, all[a].z - all[b].z) >= SPACE_M - 1e-9, `places ${a} and ${b} keep SPACE_M`);
  }
  let ownKept = 0, moved = 0;
  for (const [i, id] of ids.entries()) {
    const st = /** @type {any} */ (got.get(id));
    assert.ok(street.holds(st.x, st.z) && street.clear(spot.x, spot.z, st.x, st.z), `${id}: on the street, seen from the spot`);
    const r = Math.hypot(st.x - spot.x, st.z - spot.z);
    assert.ok(r >= ALONE_NEED_M - 1e-9 && r <= SPACE_FAR_M + 1e-9, `${id}: about the spot (${r.toFixed(2)} m)`);
    assert.ok(Math.abs(Math.atan2(Math.sin(st.yaw - Math.atan2(spot.x - st.x, spot.z - st.z)), Math.cos(st.yaw - Math.atan2(spot.x - st.x, spot.z - st.z)))) < 1e-6, `${id}: facing the spot`);
    if (st.x === own[i].x && st.z === own[i].z) ownKept++; else moved++;
  }
  assert.ok(ownKept > 5 && moved > 5, `their own place where it is free (${ownKept}), another where not (${moved})`);
  // the earliest keep their places as others come: the first twenty placed alone, then forty - the twenty unmoved
  const first = aloneStands(spot, ids.slice(0, 20), circle, street);
  for (const id of ids.slice(0, 20)) assert.deepEqual(got.get(id), first.get(id), `${id} keeps the place they had as others came`);
});

test('LW-SPACE the town: at every spot through the day, each one alone stands SPACE_M from every other there - alone or in a circle - on the street, their stay\'s place the census\'s beat gave them, every reader alike (the beat dealt from the plans: a second town reads the same places); one alone keeps their place through a round as others come (the earlier stay first); before, drawn off their ids, a busy spot stood them on one another (mutants: the host\'s places unread, the circles not taken, the order unkept)', () => {
  const day = 100;
  const built = synthTown();
  const a = makeTown(day * DAY_MIN + 8 * 60, built), b = makeTown(day * DAY_MIN + 8 * 60, built);
  let checked = 0, pairs = 0, busiest = 0;
  for (let m = 7 * 60; m < 22 * 60; m += 15) {
    const t = day * DAY_MIN + m;
    for (const x of [a, b]) { x.town._now = t; x.town._tick([x.town.places.square.x, 0, x.town.places.square.z], 0); }
    /** @type {Map<string, { id: string, x: number, z: number, alone: boolean }[]>} */
    const bySpot = new Map();
    for (const res of a.town.residents) {
      const w = a.town.where(res, t, true);
      if (!w || w.moving || w.pending || w.e.kind === 'walk' || !isOutdoor(w.e)) continue;
      const wb = b.town.where(res, t, true);
      assert.deepEqual([wb?.x, wb?.z], [w.x, w.z], `${res.id} at minute ${m}: the same place on a second reader`);
      const list = bySpot.get(w.e.at.key) ?? [];
      list.push({ id: res.id, x: w.x, z: w.z, alone: !a.town._inCircle.has(res.id) });
      bySpot.set(w.e.at.key, list);
    }
    for (const list of bySpot.values()) {
      busiest = Math.max(busiest, list.length);
      for (const p of list) {
        if (!p.alone) continue;
        checked++;
        for (const q of list) {
          if (q === p) continue;
          pairs++;
          assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= SPACE_M - 1e-9, `${p.id} alone at minute ${m}: ${Math.hypot(p.x - q.x, p.z - q.z).toFixed(2)} m from ${q.id}`);
        }
      }
    }
  }
  assert.ok(checked > 100 && pairs > 500 && busiest >= 6, `a day of those alone (${checked}), against ${pairs} others, the busiest spot ${busiest}`);
  // a round's minute by minute: while the round's circles at a spot stand as they are and nobody leaves the ones alone
  // there, each one standing alone keeps their place as others come (the first bound for it first)
  /** @type {Map<string, { round: string, ids: Set<string>, at: Map<string, { x: number, z: number }> }>} */
  const was = new Map();
  let kept = 0, came = 0;
  for (let m = 16 * 60; m < 19 * 60; m += 0.5) {
    const t = day * DAY_MIN + m;
    a.town._now = t; a.town._tick([a.town.places.square.x, 0, a.town.places.square.z], 0);
    const rounds = new Map([...a.town._inCircle.values()].map((c) => [c.spot.key, `${c.circle.start}`]));
    /** @type {Map<string, Map<string, { x: number, z: number }>>} */
    const now = new Map();
    for (const [id, st] of a.town._aloneAt) { const l = now.get(st.spot.key) ?? new Map(); l.set(id, st); now.set(st.spot.key, l); }
    for (const [k, l] of now) {
      const before = was.get(k), round = rounds.get(k) ?? '-';
      if (before && before.round === round && [...before.ids].every((id) => l.has(id))) {
        if (l.size > before.ids.size) came++;
        for (const [id, st] of before.at) {
          const res = /** @type {any} */ (a.town.residents.find((r) => r.id === id));
          if (a.town.entryOf(res, t)?.e.kind === 'walk') continue;   // on their way: nowhere to keep yet
          kept++;
          const now_ = /** @type {any} */ (l.get(id));
          assert.ok(Math.hypot(now_.x - st.x, now_.z - st.z) < 1e-9, `${id} alone at ${k}, minute ${m}: kept their place as others came`);
        }
      }
      was.set(k, { round, ids: new Set(l.keys()), at: l });
    }
    for (const k of [...was.keys()]) if (!now.has(k)) was.delete(k);
  }
  assert.ok(kept > 500 && came > 10, `standing alone, kept (${kept}), as others came (${came})`);
});

test('LW-SPACE bound since: one whose stays at a spot run one into the next (a stall, then the talk) is bound for it since they set out for the first - one who came between takes no place of theirs; laid by hand, two whose own places meet (LW-LODGE\'s re-judge: since LW-SPREAD no day of the town\'s ran two stays at one spot together in the hours the pin above reads, and the mutant lived) (mutants: since the stay)', () => {
  const day = 100, D = day * DAY_MIN;
  const { town } = makeTown(D + 10 * 60);
  const spot = town.places.social[1];
  const street = town._street;
  // two whose own places at the spot stand within SPACE_M of each other - the later-bound the lower id, so the id breaks
  // no tie of theirs
  let a = null, b = null;
  for (let i = 0; i < 300 && !a; i++) {
    for (let k = 0; k < i && !a; k++) {
      const x = `L24680.${9300 + i}`, y = `L24680.${9300 + k}`;
      const p = aloneStand(spot, x, street), q = aloneStand(spot, y, street);
      if (Math.hypot(p.x - q.x, p.z - q.z) < SPACE_M) { a = x; b = y; }
    }
  }
  assert.ok(a && b && b < a, 'two whose own places meet');
  const A = { ...town.residents[0], id: /** @type {string} */ (a) }, B = { ...town.residents[1], id: /** @type {string} */ (b) };
  const from = town.places.square;
  const walk = (t0, t1) => ({ kind: 'walk', at: spot, from, to: spot, t0, t1 });
  const plan = (/** @type {any[]} */ es) => [{ kind: 'sleep', at: null, t0: D + 240, t1: es[0].t0 }, ...es, { kind: 'sleep', at: null, t0: es[es.length - 1].t1, t1: D + 1680 }];
  // A: there by ten, a stall till eleven, then the talk till noon; B: there by half past ten, the talk till noon
  town._plans.set(A.id, { day, plan: plan([walk(D + 590, D + 600), { kind: 'stall', at: spot, t0: D + 600, t1: D + 660 }, { kind: 'social', at: spot, t0: D + 660, t1: D + 720 }]), roads: true, home: A.home });
  town._plans.set(B.id, { day, plan: plan([walk(D + 620, D + 630), { kind: 'social', at: spot, t0: D + 630, t1: D + 720 }]), roads: true, home: B.home });
  town._planGen++;
  town._spaceAlone([A, B], D + 690);
  const own = aloneStand(spot, A.id, street);
  const ga = /** @type {any} */ (town._aloneAt.get(A.id)), gb = /** @type {any} */ (town._aloneAt.get(B.id));
  assert.ok(ga && gb, 'both placed');
  assert.ok(Math.hypot(ga.x - own.x, ga.z - own.z) < 1e-9, 'the first bound - since ten, through the stall to the talk - at their own place');
  assert.ok(Math.hypot(ga.x - gb.x, ga.z - gb.z) >= SPACE_M - 1e-6, 'the one who came between about them');
});

test('LW-SPACE circlesStands: a round\'s circles at a spot laid together - each at its own places where they keep SPACE_M from every circle before it, else about the nearest middle whose places do, turned to fit; every place on the street and seen from the spot, a circle\'s people CIRCLE_APART apart facing their middle; drawn one by one, a lane\'s circles stood inside each other (mutants: the circles unlaid, the street unread)', () => {
  const built = closeTown();
  const places = townPlaces(built.nav, built.doors, built.buildings);
  const street = streetGeometry(built.nav, places);
  let laidOne = 0, inside = 0, spots = 0, lanePlaced = 0;
  for (const spot of [places.square, ...places.social, ...places.market].filter(Boolean)) {
    const circles = Array.from({ length: 14 }, (_, index) => ({ index, members: Array.from({ length: index % 3 === 2 ? 3 : 2 }, () => ({})) }));
    const one = circles.map((c) => circleStands(spot, c, street));
    const flat = (/** @type {any[][]} */ ls) => ls.flatMap((l, ci) => l.map((p) => ({ ...p, ci })));
    for (const [a, b] of pairsOf(flat(one))) if (a.ci !== b.ci && Math.hypot(a.x - b.x, a.z - b.z) < SPACE_M) inside++;
    const laid = circlesStands(spot, circles, street);
    assert.equal(laid.length, circles.length);
    // and forty alone about them, in a lane: each on the street, seen from the spot, SPACE_M from every place
    const alone = aloneStands(spot, Array.from({ length: 40 }, (_, i) => `L2.${i}`), laid.flat(), street);
    for (const [id, st] of alone) {
      assert.ok(street.holds(st.x, st.z) && street.clear(spot.x, spot.z, st.x, st.z), `${spot.key} ${id}: alone, on the street, seen from the spot`);
      lanePlaced++;
    }
    for (const [ci, ps] of laid.entries()) {
      assert.equal(ps.length, circles[ci].members.length, `${spot.key} circle ${ci}: a place each`);
      const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length, mz = ps.reduce((s, p) => s + p.z, 0) / ps.length;
      for (const p of ps) {
        assert.ok(street.holds(p.x, p.z) && street.clear(spot.x, spot.z, p.x, p.z), `${spot.key} circle ${ci}: on the street, seen from the spot`);
        assert.ok(Math.abs(Math.hypot(p.x - mx, p.z - mz) - CIRCLE_APART / 2) < 0.05 || ps === one[ci], `${spot.key} circle ${ci}: about its middle`);
      }
      if (ps === one[ci]) laidOne++;
    }
    for (const [a, b] of pairsOf(flat(laid))) if (a.ci !== b.ci) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= SPACE_M - 1e-6, `${spot.key}: circles ${a.ci} and ${b.ci} apart`);
    spots++;
  }
  assert.ok(spots >= 10 && inside >= 10 && laidOne > 20 && lanePlaced >= 400, `spots ${spots}; drawn one by one, ${inside} places inside another circle's; laid as they were drawn ${laidOne}; alone about them ${lanePlaced}`);
});
/** Every pair of a list. @template T @param {T[]} list @returns {[T, T][]} */
const pairsOf = (list) => list.flatMap((a, i) => list.slice(i + 1).map((b) => /** @type {[any, any]} */ ([a, b])));

test('LW-SPACE in file: a company leaving one place together - walks from the same place begun within FILE_MIN of one another, one after another - walks it in file, each FILE_M behind the one before on its line, the first on it; one leaving later than FILE_MIN is no company; a patrol\'s pair is none of it (its second at the first\'s shoulder) (mutants: the file unread, the chain unread, the pair counted)', () => {
  const day = 100;
  const { town } = makeTown(day * DAY_MIN + 8 * 60, synthTown({ blocksW: 4, blocksH: 4 }), { ...TOWN, blocks: 16 });
  /** every walk of the day, by where it leaves from */
  const from = new Map();
  for (const res of town.residents) {
    for (const e of town.planOf(res, day)) {
      if (e.kind !== 'walk' || !e.from) continue;
      const list = from.get(e.from.key) ?? [];
      list.push({ res, e });
      from.set(e.from.key, list);
    }
  }
  let companies = 0, apart = 0, alone = 0, pairsSeen = 0;
  for (const list of from.values()) {
    list.sort((x, y) => x.e.t0 - y.e.t0 || (x.res.id < y.res.id ? -1 : 1));
    for (let i = 1; i < list.length; i++) {
      const p = list[i - 1], q = list[i];
      if (p.e.pair != null || q.e.pair != null) {
        if (p.e.pair != null && q.e.pair != null && p.e.t0 === q.e.t0) { pairsSeen++; assert.deepEqual([town._fileOf(p.res, p.e), town._fileOf(q.res, q.e)], [0, 0], 'a patrol\'s pair: its own way, never in file'); }
        continue;
      }
      if (q.e.t0 - p.e.t0 > FILE_MIN) {
        if (town._fileOf(q.res, q.e) === 0) alone++;
        continue;
      }
      const k = town._fileOf(q.res, q.e);
      assert.equal(k, town._fileOf(p.res, p.e) + 1, `${q.res.id} walks one behind ${p.res.id}`);
      // mid-walk, both on their lines: the later FILE_M behind the earlier where the two share it
      const t = q.e.t0 + Math.min(p.e.t1 - p.e.t0, q.e.t1 - q.e.t0) * 0.3;
      const wp = town.where(p.res, t, true), wq = town.where(q.res, t, true);
      if (!wp?.moving || !wq?.moving) continue;
      companies++;
      const d = Math.hypot(wp.x - wq.x, wp.z - wq.z);
      if (d >= SPACE_M) apart++;
      if (p.e.to === q.e.to) assert.ok(Math.abs(d - FILE_M * (k - town._fileOf(p.res, p.e))) < 1e-6 || d >= SPACE_M, `${p.res.id} and ${q.res.id}, one place to another: ${d.toFixed(2)} m apart`);
    }
  }
  assert.ok(companies >= 5 && alone > 20, `companies leaving together (${companies}), walks leaving alone (${alone})`);
  assert.ok(apart / companies > 0.8, `in file, the company apart (${apart} of ${companies})`);
  assert.ok(pairsSeen > 0, `a patrol's pair leaving together (${pairsSeen})`);
  // the chain, on its own: one after another within FILE_MIN of each other, each the next in file; a gap past it begins
  // another company - read off the day's walks by where they leave from
  const e = (/** @type {number} */ t0) => ({ kind: 'walk', from: { key: 'dX' }, t0 });
  const ws = [e(600), e(600), e(600 + FILE_MIN * 0.6), e(600 + FILE_MIN * 1.2), e(600 + FILE_MIN * 3)];
  const ids = ['b', 'a', 'c', 'd', 'e'];
  town._departures = { day: town.dayOf(600), gen: town._planGen, from: new Map([['dX', ws.map((w, i) => ({ t0: w.t0, id: ids[i], e: w })).sort((x, y) => x.t0 - y.t0 || (x.id < y.id ? -1 : 1))]]) };
  assert.deepEqual(ws.map((w, i) => town._fileOf(/** @type {any} */ ({ id: ids[i] }), /** @type {any} */ (w))), [1, 0, 2, 3, 0]);
});

/** A street with bodies set where a pin wants them: the town's own `_dodge` over its own pool. */
function laneTown() {
  const built = closeTown();
  const { town } = makeTown(100 * DAY_MIN + 12 * 60, built, { ...TOWN, blocks: 16 });
  // the street along z = 24 cells (three wide): a row's middle at x0 + s along +x
  const z0 = 24 * NAV_CELL + 1.5 * NAV_CELL, x0 = 30 * NAV_CELL;
  /** @param {string} id @param {number} x @param {number} z @param {number} yaw @param {boolean} moving */
  const body = (id, x, z, yaw, moving, halt = false) => ({ active: true, visible: true, res: { id }, person: { pos: [x, 0, z], yaw, moving }, side: 0, halt });
  return { town, z0, x0, body, street: town._street };
}
const EAST = Math.PI / 2, WEST = -Math.PI / 2;

test('LW-SPACE the step aside: a walker steps round one standing on its line - the nearest way aside that keeps SPACE_M and that the street holds, the right before the left - and back to its line once by; two coming at each other on one line both keep right and pass apart; of two going one way inside each other the higher id steps round and the lower keeps its line; one walking up to its stand steps aside for nobody within DODGE_SETTLE_M of it, and one the politeness gate holds stands; a wall on its right, round to its left (mutants: the step unread, the left before the right, the follower unread, the stand unread, the hold unread, the trail unread, the street unread)', () => {
  const { town, z0, x0, body, street } = laneTown();
  // one standing on the line three metres ahead: walked past at the walking pace, the body where its step aside puts it
  // each frame - stepped round to its right (east-going: its right is -z), and back on its line once by
  const stand = body('L1.900', x0 + 3, z0, 0, false);
  const walker = body('L1.100', x0, z0, EAST, true);
  town.pool = [walker, stand];
  let nearest = Infinity, maxSide = 0, onStreet = true;
  for (let i = 0; i < 6 * 30; i++) {
    const g = town._dodge(/** @type {any} */ (walker), walker.person, { x: x0 + PERSON_MOVE_SPEED * i / 30, z: z0, yaw: EAST, moving: true }, 1 / 30);
    walker.person.pos = [g.x, 0, g.z];
    nearest = Math.min(nearest, Math.hypot(g.x - (x0 + 3), g.z - z0));
    maxSide = Math.max(maxSide, z0 - g.z);
    onStreet &&= street.holds(g.x, g.z);
    if (i % 3 === 0) assert.ok(DODGE_SIDES.some((c) => Math.abs(walker.side) <= Math.abs(c) + 1e-9), 'within the ways aside');
  }
  assert.ok(nearest >= SPACE_M - 1e-6, `walked round the one standing: never nearer than ${nearest.toFixed(2)} m`);
  assert.ok(maxSide >= SPACE_M - 1e-6, `to its right (${maxSide.toFixed(2)} m)`);
  assert.ok(onStreet, 'every step on the street');
  assert.ok(Math.abs(walker.person.pos[2] - z0) < 1e-9 && walker.side === 0, `back on its line once by (${(walker.person.pos[2] - z0).toFixed(2)})`);

  // a wall on its right (the street's southern edge a hand off its body): it steps round to its left, the right not
  // held, and passes apart
  const edge = 24 * NAV_CELL + 0.4 + 0.05;   // the body's middle a hand inside the street's southern edge
  const hugger = body('L1.120', x0, edge, EAST, true);
  town.pool = [hugger, body('L1.920', x0 + 3, edge, 0, false)];
  let nearestWall = Infinity;
  for (let i = 0; i < 5 * 30; i++) {
    const g = town._dodge(/** @type {any} */ (hugger), hugger.person, { x: x0 + PERSON_MOVE_SPEED * i / 30, z: edge, yaw: EAST, moving: true }, 1 / 30);
    hugger.person.pos = [g.x, 0, g.z];
    nearestWall = Math.min(nearestWall, Math.hypot(g.x - (x0 + 3), g.z - edge));
    assert.ok(street.holds(g.x, g.z), 'on the street');
  }
  assert.ok(nearestWall >= SPACE_M - 1e-6, `round to its left, the right a wall: never nearer than ${nearestWall.toFixed(2)} m`);

  // a body trailing its day's place (behind it on its line, as a walker catching its walk up does): whoever stands between
  // the two is in its way as much as one ahead of the place
  const trailing = body('L1.150', x0, z0, EAST, true);
  town.pool = [trailing, body('L1.950', x0 + 1, z0, 0, false)];
  for (let i = 0; i < 30; i++) town._dodge(/** @type {any} */ (trailing), trailing.person, { x: x0 + 2.5, z: z0, yaw: EAST, moving: true }, 1 / 30);
  assert.ok(trailing.side > 0.5, `stepped aside for the one between it and its place (${trailing.side.toFixed(2)})`);

  // two coming at each other on one line: each keeps right, and they pass apart
  const a = body('L1.200', x0, z0, EAST, true), b = body('L1.201', x0 + 2, z0, WEST, true);
  town.pool = [a, b];
  for (let i = 0; i < 60; i++) {
    const ga = town._dodge(/** @type {any} */ (a), a.person, { x: x0, z: z0, yaw: EAST, moving: true }, 1 / 30);
    const gb = town._dodge(/** @type {any} */ (b), b.person, { x: x0 + 2, z: z0, yaw: WEST, moving: true }, 1 / 30);
    a.person.pos = [ga.x, 0, ga.z]; b.person.pos = [gb.x, 0, gb.z];
  }
  assert.ok(a.person.pos[2] < z0 && b.person.pos[2] > z0, `each to its own right (${a.person.pos[2] - z0}, ${b.person.pos[2] - z0})`);
  assert.ok(Math.abs(a.person.pos[2] - b.person.pos[2]) >= SPACE_M - 1e-9, `they pass apart (${Math.abs(a.person.pos[2] - b.person.pos[2]).toFixed(2)} m)`);

  // two going one way inside each other: the higher id steps round, the lower keeps its line
  const lo = body('L1.300', x0, z0, EAST, true), hi = body('L1.301', x0, z0, EAST, true);
  town.pool = [lo, hi];
  for (let i = 0; i < 60; i++) {
    const gl = town._dodge(/** @type {any} */ (lo), lo.person, { x: x0, z: z0, yaw: EAST, moving: true }, 1 / 30);
    const gh = town._dodge(/** @type {any} */ (hi), hi.person, { x: x0, z: z0, yaw: EAST, moving: true }, 1 / 30);
    lo.person.pos = [gl.x, 0, gl.z]; hi.person.pos = [gh.x, 0, gh.z];
  }
  assert.ok(Math.abs(lo.person.pos[2] - z0) < 1e-9, 'the lower id keeps its line');
  assert.ok(Math.abs(hi.person.pos[2] - z0) >= SPACE_M - 1e-9, `the higher steps round it (${(hi.person.pos[2] - z0).toFixed(2)})`);

  // walking up to its stand, DODGE_SETTLE_M off it: it is there, and steps aside for nobody
  const settling = body('L1.400', x0, z0, EAST, false);
  town.pool = [settling, body('L1.401', x0 + 0.3, z0, 0, false)];
  const gs = town._dodge(/** @type {any} */ (settling), settling.person, { x: x0 + DODGE_SETTLE_M * 0.9, z: z0, yaw: 0, moving: false }, 1 / 30);
  assert.ok(Math.abs(gs.z - z0) < 1e-9 && settling.side === 0, 'within DODGE_SETTLE_M of its stand: no step aside');
  // held by the politeness gate: stands - LW-SPREAD's audit: aside or not, where it stood (held, it drifted back to its line)
  const held = body('L1.500', x0, z0, EAST, true, true);
  town.pool = [held, body('L1.501', x0 + 1, z0, 0, false)];
  const gh = town._dodge(/** @type {any} */ (held), held.person, { x: x0, z: z0, yaw: EAST, moving: true }, 1 / 30);
  assert.ok(Math.abs(gh.z - z0) < 1e-9 && held.side === 0, 'held where it stands: no step aside');
  const aside = body('L1.510', x0, z0 - 0.9, EAST, true, true);
  aside.side = 0.9;
  town.pool = [aside];
  for (let i = 0; i < 30; i++) town._dodge(/** @type {any} */ (aside), aside.person, { x: x0, z: z0, yaw: EAST, moving: true }, 1 / 30);
  assert.equal(aside.side, 0.9, 'held aside: still aside, the way clear or not');
});

test('LW-SPACE the hold (LW-SPREAD\'s audit): a body the politeness gate holds stands where it is - one trailing its walk\'s point (catching it up, or round one in its way) walked up to it while held (mutants: the held body walking)', () => {
  const { town, clock } = makeTown(100 * DAY_MIN + 9 * 60, synthTown({ blocksW: 4, blocksH: 4 }), { ...TOWN, blocks: 16 });
  // one on a walk a minute from now still - its path searched - and the player a few metres off its way, as it comes in view
  let res = null, w = null;
  for (const r of town.peopleOf(town.dayOf(clock.t))) {
    for (let k = 0; k < 400 && (w = town.where(r, clock.t, true))?.pending; k++) { town._paths.cells(1e9); town._paths.budget(1e9); town._paths.run(); }
    const later = w?.moving ? town.where(r, clock.t + 1, true) : null;
    if (later?.moving && later.e === w?.e) { res = r; break; }
  }
  assert.ok(res && w, 'one on a walk');
  const at = [w.x + Math.cos(w.yaw) * 3, 0, w.z - Math.sin(w.yaw) * 3];   // three metres to its right
  let row = null;
  for (let i = 0; i < 30 && !row?.person.moving; i++) {
    clock.t += RATE / 30;
    town.update(1 / 30, at, 0, at, true);
    row = town._rowOf(res);
    if (!row?.visible) row = null;
  }
  assert.ok(row?.person.moving, 'walking in view');
  const p = row.person;
  // set back along its way (behind its walk's point, as a walker catching it up is), then held a second
  p.pos[0] -= Math.sin(p.yaw) * 1.5; p.pos[2] -= Math.cos(p.yaw) * 1.5;
  const was = [...p.pos];
  for (let i = 0; i < 30; i++) { clock.t += RATE / 30; town.update(1 / 30, [p.pos[0] + 1, 0, p.pos[2]], 0, at, true, (q) => q === p); }
  assert.ok(row.res && Math.hypot(p.pos[0] - was[0], p.pos[2] - was[2]) < 1e-9 && !p.moving, 'held: where it stood, still');
});

test('LW-SPACE the street through the day: on the open and the close-built towns, the bodies in view at eight, one and six - nearly none inside another (within half a metre: measured at LW-SPACE, 34.7% of the open town\'s body-frames and 51.5% of the close-built\'s before; after, none and 0.2% - the walkers 0.6% in the close-built town\'s lanes, 3.1% without the step aside), every step on the street (mutants: the host\'s places unread, the circles unlaid, the file unread, the step unread)', () => {
  for (const [name, built, limit, walkers] of [['open', synthTown({ blocksW: 4, blocksH: 4 }), 0.005, 0.005], ['close-built', closeTown(), 0.01, 0.015]]) {
    const m = measure(built, [8, 13, 18], 20);
    assert.ok(m.frames > 3000 && m.walking > 1000, `${name}: a street in view (${m.frames} body-frames, ${m.walking} walking)`);
    assert.ok(m.share < limit, `${name}: ${(100 * m.share).toFixed(2)}% of the body-frames within half a metre of another (limit ${100 * limit}%)`);
    assert.ok(m.walkingShare < walkers, `${name}: ${(100 * m.walkingShare).toFixed(2)}% of the walkers' (limit ${100 * walkers}%)`);
  }
});

test('LW-SPACE the game\'s own cities (ARENA2): Ripmarket, Wayrest and Daggerfall at one and in the evening (LW-SPREAD: at seven), the player at the square - nearly none in view inside another (tools/livingCrowdProbe.mjs, measured at LW-SPACE: 29.9%, 27.4% and 19.5% of the body-frames at one, 30.8%, 16.1% and 12.0% at six before; 0.0%, 0.1% and 0.4%, 3.0%, 0.4% and 0.2% after - the rest walkers through Ripmarket\'s square at six, its crowd forty-three), and no two inside each other a second (mutants: the host\'s places unread, the step unread)', { skip: skipReal }, () => {
  const all = cities();
  for (const name of ['Ripmarket', 'Wayrest', 'Daggerfall']) {
    const h = hostTown(/** @type {any} */ (all.find((c) => c.name === name)));
    for (const hour of [13, 19]) {   // LW-SPREAD: PIN MOVED - the evening out at seven (from six to a quarter past seven now)
      const m = streetAt(h, hour, 20);
      assert.ok(m.seen > 20, `${name} at ${hour}:00: a street in view (${m.seen.toFixed(1)})`);
      assert.ok(m.share < 0.04, `${name} at ${hour}:00: ${(100 * m.share).toFixed(1)}% of the body-frames inside another`);
      assert.ok(m.glued <= 1, `${name} at ${hour}:00: ${m.glued} pairs inside each other a second and more`);
    }
  }
});
