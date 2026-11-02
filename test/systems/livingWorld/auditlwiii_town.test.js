// AUDIT LW-III (bible/01-Overview/audits/Audit-LivingWorld-III.md, "The town"): WHAT ONE READER ALONE HAS MOVES NOBODY ELSE -
// one lent to the watch is dealt still (and left out), the deal's every place is taken, and a circle's one left holds
// their place, so a lend or a trample in one reader never re-deals another's circles or stands another's alone anew
// (livingTown.js `_tick`, `_spaceAlone`); one whose walk in has ended early is in the room (`insideAt`); a circle's line
// along the way out laid whole, never two on one clamp (meetups.js circleStands). On the synthetic towns: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown, closeTown } from '../../lwTown.mjs';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { DAY_MIN, isOutdoor } from '../../../src/systems/livingWorld/dayPlan.js';
import { circleStands, SPACE_M } from '../../../src/systems/livingWorld/meetups.js';
import { findTownPath, pathLine } from '../../../src/systems/livingWorld/townPaths.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE, DAY = 100, MAP = 24680;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const townOf = (built, map = MAP, blocks = 16) => () => new LivingTown(built.nav, {
  town: { mapId: map, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
  makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM,
  tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }),
});
const circlesOf = (lt, skip) => [...lt._inCircle].filter(([id]) => !skip.has(id)).map(([id, c]) => `${id}:${c.circle.members.map((m) => m.id).join('+')}`).sort();
const aloneOf = (lt, skip) => [...lt._aloneAt].filter(([id]) => !skip.has(id)).map(([id, a]) => `${id}:${a.x.toFixed(2)},${a.z.toFixed(2)}`).sort();

test('AUDIT LW-III A LEND MOVES NOBODY ELSE: one of a circle lent to the watch at a spot of two circles or more - every other circle of the town as a reader without the lend deals it, at the same minute (mutants: the lent dealt, the lent kept out)', () => {
  const mk = townOf(synthTown({ blocksW: 4, blocksH: 4 }));
  let tried = 0;
  for (let k = 0; k < 60 && tried < 12; k++) {
    const T = H(8) + k * 3.7;
    const lt = mk(); lt._now = T; lt._tick([0, 0, 0], 0);
    const bySpot = new Map();
    for (const [, c] of lt._inCircle) { const s = bySpot.get(c.spot.key) ?? new Set(); s.add(c.circle); bySpot.set(c.spot.key, s); }
    const busy = [...bySpot].find(([, s]) => s.size >= 2);
    if (!busy) continue;
    const circle = [...busy[1]][0];
    const victim = lt.peopleOf(DAY).find((r) => r.id === circle.members[0].id);
    tried++;
    const ctl = mk(); ctl._now = T; ctl._tick([0, 0, 0], 0);
    lt.lend(victim); lt._tick([0, 0, 0], 0);
    const skip = new Set(circle.members.map((m) => m.id));
    assert.deepEqual(circlesOf(lt, skip), circlesOf(ctl, skip), `lent ${victim.id} at ${T}: the others dealt alike`);
    assert.deepEqual(aloneOf(lt, skip), aloneOf(ctl, skip), `and those alone stood alike`);
  }
  assert.ok(tried >= 6, `lends tried (${tried})`);
  // one alone at a spot others stand alone at, lent: the others stand where they stood
  let lone = 0;
  for (let k = 0; k < 60 && lone < 30; k++) {
    const T = H(9) + k * 4.1;
    const lt = mk(); lt._now = T; lt._tick([0, 0, 0], 0);
    const by = new Map();
    for (const [id, a] of lt._aloneAt) by.set(a.spot.key, [...(by.get(a.spot.key) ?? []), id]);
    const ids = [...by.values()].find((l) => l.length >= 3);
    if (!ids) continue;
    const ctl = mk(); ctl._now = T; ctl._tick([0, 0, 0], 0);
    for (const id of ids.slice(0, 6)) {
      lone++;
      const one = mk(); one._now = T; one._tick([0, 0, 0], 0);
      one.lend(one.peopleOf(DAY).find((r) => r.id === id)); one._tick([0, 0, 0], 0);
      const other = ctl._inStir.get(id)?.other;   // an incident of theirs falls with them: its other stands alone, rightly
      const skip = new Set([id, ...(other ? [other] : [])]);
      assert.deepEqual(aloneOf(one, skip), aloneOf(ctl, skip), `lent ${id}, alone at ${T}: the others alone stood alike`);
    }
  }
  assert.ok(lone >= 4, `lone lends tried (${lone})`);
});

test('AUDIT LW-III A TRAMPLE MOVES NOBODY ELSE: one of a two-circle struck down in this reader alone - its partner holds their place, and everyone else alone at the spot stands where a reader without it stands them (mutants: the deal\'s whole laying taken, the one left holding, the left out holding)', () => {
  for (const built of [synthTown({ blocksW: 4, blocksH: 4 }), closeTown({ blocksW: 4, blocksH: 4 })]) {
    const mk = townOf(built);
    let tried = 0;
    for (let k = 0; k < 80 && tried < 10; k++) {
      const T = H(8) + k * 5.3;
      const lt = mk(); lt._now = T; lt._tick([0, 0, 0], 0);
      const aloneBy = new Map();
      for (const [, a] of lt._aloneAt) aloneBy.set(a.spot.key, (aloneBy.get(a.spot.key) ?? 0) + 1);
      const hit = [...lt._inCircle].find(([, c]) => c.circle.members.length === 2 && (aloneBy.get(c.spot.key) ?? 0) >= 1);
      if (!hit) continue;
      tried++;
      const [vid, c] = hit;
      const partner = c.circle.members.find((m) => m.id !== vid).id;
      const was = lt._inCircle.get(partner).place;
      const ctl = mk(); ctl._now = T; ctl._tick([0, 0, 0], 0);
      lt._taken.set(vid, lt.dayOf(T)); lt._tick([0, 0, 0], 0);
      const skip = new Set([vid, partner]);
      assert.deepEqual(aloneOf(lt, skip), aloneOf(ctl, skip), `trampled ${vid} at ${T}: the others alone stood alike`);
      // nobody alone stands in a circle's place (the deal's whole laying taken)
      for (const [, al] of lt._aloneAt) for (const [, ci] of lt._inCircle) if (ci.spot === al.spot) assert.ok(Math.hypot(ci.place.x - al.x, ci.place.z - al.z) >= SPACE_M - 1e-6, 'none alone in a circle\'s place');
      const held = lt._aloneAt.get(partner);
      assert.ok(held && Math.hypot(held.x - was.x, held.z - was.z) < 1e-9, 'the one left at their place in the deal');
    }
    assert.ok(tried >= 5, `tramples tried (${tried})`);
  }
});

test('AUDIT LW-III IN AT THE DOOR: one whose walk in has ended before its planned minute is in the room it walked to - never in no street and no room (mutants: the early in)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const lt = townOf(built, 5151)();
  let walks = 0, gone = 0;
  for (const r of lt.peopleOf(DAY).slice(0, 80)) {
    const plan = lt.planOf(r, DAY);
    plan.forEach((e, i) => {
      const after = plan[i + 1];
      if (e.kind !== 'walk' || !after || isOutdoor(after) || after.kind === 'walk' || after.at?.building == null) return;
      if (after.kind === 'sleep' || (after.kind === 'work' && r.work === after.at.building)) return;
      const cells = findTownPath(built.nav, e.from.cell, e.to.cell);
      if (!cells) return;
      walks++;
      const get = lt._paths.get;
      lt._paths.get = (a, b) => (a === e.from.cell && b === e.to.cell ? pathLine(cells) : get.call(lt._paths, a, b));
      for (let t = e.t0; t < e.t1; t += 0.25) {
        if (!lt.where(r, t, false) && !lt.insideAt(after.at.building, t).some((x) => x.res.id === r.id)) { gone++; break; }
      }
      lt._paths.get = get;
    });
  }
  assert.ok(walks > 20, `walks into a room (${walks})`);
  assert.equal(gone, 0, 'none in no street and no room');
});

test('AUDIT LW-III A CIRCLE\'S LINE LAID WHOLE: where nothing about a circle\'s middle is open, its members along the way out stand a pace apart or spread the way\'s length - never two on one clamp (mutants: the whole line)', () => {
  const built = closeTown({ blocksW: 6, blocksH: 6 });
  const lt = townOf(built, 5150, 36)();
  let laid = 0;
  for (const spot of [...lt.places.squares, ...lt.places.market].slice(0, 6)) {
    for (let idx = 0; idx < 10; idx++) for (const n of [2, 3]) {
      const pl = circleStands(spot, { index: idx, members: Array(n).fill(0) }, lt._street);
      laid++;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(pl[i].x - pl[j].x, pl[i].z - pl[j].z) >= SPACE_M - 1e-6, `${spot.key} circle ${idx} of ${n}: members apart`);
    }
  }
  assert.ok(laid > 20);
});
