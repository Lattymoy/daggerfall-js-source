// LW-LODGE (2026-10-06, bible/06-Systems/Living-World.md "LW-LODGE"; Mac: NPCs should "use tavern rooms" - "Lodgers in
// their rooms"): A LODGER HAS A ROOM. One who lodges at a tavern - a visitor, a ship's hand ashore, one of the town whose
// home is its rooms - was stood in its common room whenever their day had them up at home there (the first cut stood
// every one inside a building on the ground floor's spots), and their evening's tavern was the nearer of the two
// nearest home, theirs or the next. Now they breakfast in the common room after waking and sup there in the evening, and
// go up to their room before bed (dayPlan.js isLodger, LODGE_BREAKFAST_MIN, LODGE_UP_MIN); the tavern's beds are dealt to
// its lodgers (livingTown.js lodgersAt, scenes/livingIndoors.js bedsOf), never the bed of the room the player rents, and
// one up in their room is seen by it (bedStand). The town is the synthetic one (test/lwTown.mjs); the room a mock
// collider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { dayPlan, isLodger, favourites, LODGE_BREAKFAST_MIN, LODGE_UP_MIN, DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { createLivingIndoors, bedStand, bedsOf, BED_STEP_M, BED_FAN, INDOOR_TICK_S } from '../src/scenes/livingIndoors.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MPM = PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 24680, blocks: 16, region: 17, people: 3, port: false });

/** A town of four blocks by four with a second tavern among its houses. */
function inns() {
  const fx = synthTown({ blocksW: 4, blocksH: 4 });
  const buildings = fx.buildings.map((b) => (b.key === 1012 ? { ...b, type: B.Tavern } : b));
  const places = townPlaces(fx.nav, fx.doors, buildings);
  const census = townCensus(TOWN, buildings, new Set(places.doors.keys()));
  const taverns = [...places.doors.values()].filter((s) => places.types.get(s.building ?? -1) === B.Tavern);
  return { fx, buildings, places, census, taverns };
}
const hm = (day, t) => ((t - day * DAY_MIN) / 60).toFixed(2);

test('LW-LODGE a lodger\'s day: one whose home is a tavern\'s door and who is not its staff; up in their room on waking, breakfast in the common room LODGE_BREAKFAST_MIN after waking, up in their room again before going out; supper at their own tavern - not the next nearest - till LODGE_UP_MIN before bed at the latest, up in their room till bed, asleep there; the tavern\'s own staff and a household no lodgers (mutants: the breakfast, the staff, the supper\'s tavern, the going up)', () => {
  const { places, census, taverns } = inns();
  const [inn, other] = taverns;
  // the law
  const keeper = census.find((r) => r.job === 'innkeeper');
  const visitor = census.find((r) => r.job === 'merchant');
  assert.ok(isLodger(visitor, places, inn) && !isLodger(keeper, places, places.doors.get(keeper.work)) && !isLodger(visitor, places, places.doors.get(census.find((r) => r.job === 'homemaker').home)), 'a lodger: home a tavern\'s door, not its staff');
  let days = 0, breakfasts = 0, suppers = 0, otherInn = 0, cut = 0;
  for (const res of census.filter((r) => ['merchant', 'pedlar', 'adventurer', 'pilgrim', 'mercenary'].includes(r.job))) {
    for (let day = 100; day < 107; day++) {
      const plan = dayPlan(res, places, day, { mpm: MPM, visitor: true, home: inn });
      days++;
      const D0 = day * DAY_MIN;
      const at = (i) => plan[i];
      // sleep, up in their room, breakfast in the common room
      const i = plan.findIndex((e) => e.kind === 'tavern' && e.at === inn);
      assert.ok(i > 0, `${res.id} day ${day}: in the common room`);
      const wake = plan.find((e) => e.kind === 'home')?.t0 ?? 0;
      if (i === 2 && at(0).kind === 'sleep' && at(1).kind === 'home' && at(1).at === inn) {
        breakfasts++;
        const b = at(2);
        assert.ok(b.t0 - wake >= LODGE_BREAKFAST_MIN[0] - 1e-6 && b.t0 - wake <= LODGE_BREAKFAST_MIN[1] + 1e-6, `${res.id} day ${day}: breakfast ${hm(day, b.t0)}, woken ${hm(day, wake)}`);
        assert.ok(b.t1 - b.t0 >= 20 - 1e-6 && b.t1 - b.t0 <= 40 + 1e-6);
        assert.ok(at(3).kind === 'home' || at(3).kind === 'walk', `${res.id} day ${day}: then up in their room or out`);
      }
      // supper at their own, up in their room before bed
      const sup = [...plan].reverse().find((e) => e.kind === 'tavern');
      if (sup && sup.t0 >= D0 + 17 * 60) {
        if (sup.at !== inn) { otherInn++; continue; }
        suppers++;
        const after = plan.slice(plan.indexOf(sup) + 1);
        assert.equal(after[0]?.kind, 'home', `${res.id} day ${day}: up in their room after supper`);
        assert.equal(after[0].at, inn);
        const up = after[0].t1 - after[0].t0;   // their supper ends at its own length, or LODGE_UP_MIN before bed - the earlier
        assert.ok(up >= LODGE_UP_MIN[0] - 1e-6, `${res.id} day ${day}: up ${up.toFixed(0)} minutes before bed`);
        if (up <= LODGE_UP_MIN[1] + 1e-6) cut++;
        assert.equal(after[1]?.kind, 'sleep');
      }
    }
  }
  assert.equal(otherInn, 0, 'supper at their own tavern, never the next');
  assert.ok(breakfasts > days * 0.7 && suppers > days * 0.7, `breakfasts ${breakfasts}, suppers ${suppers} of ${days} days`);
  assert.ok(cut > suppers / 3, `supper cut to go up before bed (${cut} of ${suppers})`);
  // the first cut's tavern was the nearer of the two nearest home: another tavern for some
  assert.ok(census.some((r) => favourites(r, places, inn).tavern === other), 'their nearest two taverns are both of the town\'s');
  // one of the town whose home is a tavern's rooms (an adventurer with no house): their own supper, up before bed
  let homed = 0;
  for (const base of census.filter((r) => r.job === 'adventurer')) {
    const res = { ...base, home: inn.building };
    for (let day = 100; day < 107; day++) {
      const plan = dayPlan(res, places, day, { mpm: MPM });
      assert.ok(plan.some((e) => e.kind === 'tavern' && e.at === inn && e.t0 < day * DAY_MIN + 12 * 60), `${res.id} day ${day}: breakfast at home`);
      const sup = [...plan].reverse().find((e) => e.kind === 'tavern');
      if (!sup || sup.t0 < day * DAY_MIN + 17 * 60) continue;
      homed++;
      assert.equal(sup.at, inn, `${res.id} day ${day}: their own supper`);
      assert.equal(plan[plan.indexOf(sup) + 1]?.kind, 'home', `${res.id} day ${day}: up before bed`);
    }
  }
  assert.ok(homed > 5, `an adventurer living at the tavern (${homed})`);
  // the staff and a household: no breakfast in the common room, no going up
  for (const res of census.filter((r) => ['innkeeper', 'server', 'homemaker'].includes(r.job)).slice(0, 12)) {
    for (let day = 100; day < 103; day++) {
      const plan = dayPlan(res, places, day, { mpm: MPM });
      const first = plan.find((e) => e.kind !== 'sleep' && e.kind !== 'home');
      assert.ok(!(first?.kind === 'tavern' && first.at.building === res.home && res.job !== 'innkeeper' && res.job !== 'server'), `${res.id}: no lodger's breakfast`);
      if (res.job === 'innkeeper' || res.job === 'server') assert.ok(!plan.some((e, k) => e.kind === 'tavern' && k <= 2), `${res.id}: the staff breakfast at no table of their own`);
    }
  }
});

test('LW-LODGE who lodges at a tavern: the day\'s visitors lodged there (and a packet\'s hands), and the town\'s own whose home is its door - in the order of their ids, its staff aside; another tavern\'s none of them, and no building but a tavern has any (mutants: the staff, the visitors, the households, the tavern)', () => {
  const { fx, buildings, places, census, taverns } = inns();
  const [inn, other] = taverns;
  const visitors = census.filter((r) => ['merchant', 'pedlar', 'pilgrim'].includes(r.job)).flatMap((r) => [1, 2].map((k) => ({ ...r, id: `${r.id}v${k}`, roll: /** @type {const} */ ('t') })));
  const homed = census.find((r) => r.job === 'homemaker');
  const lt = new LivingTown(fx.nav, {
    town: TOWN, buildings, doors: fx.doors, makePerson: () => null, clock: () => 100 * DAY_MIN, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: MPM,
    tripsOf: () => ({ away: new Map(), visitors: visitors.map((res) => ({ res, inT: 100 * DAY_MIN, outT: 101 * DAY_MIN + 600, yaw: 0, dock: false })), holders: null, news: null }),
    extraPeople: () => [{ ...homed, id: 'L24680.x1', home: inn.building }],
  });
  const day = 100;
  const at = lt.lodgersAt(/** @type {number} */ (inn.building), day);
  const there = (res) => lt._lodging(res).building;
  for (const v of visitors) assert.equal(at.some((r) => r.id === v.id), there(v) === inn.building, `${v.id}: lodged where its id draws`);
  assert.ok(at.some((r) => r.id === 'L24680.x1'), 'one of the town whose home is its door');
  assert.ok(!at.some((r) => r.work === inn.building), 'its staff aside');
  assert.deepEqual(at.map((r) => r.id), [...at.map((r) => r.id)].sort(), 'in the order of their ids');
  const at2 = lt.lodgersAt(/** @type {number} */ (other.building), day);
  assert.ok(at.length > 0 && at2.length > 0 && !at.some((r) => at2.includes(r)), 'each tavern its own');
  assert.ok(at.length + at2.length >= visitors.length, 'every visitor lodged at one');
  const house = census.find((r) => r.job === 'homemaker' && r.home != null)?.home;
  assert.ok(house != null && lt.peopleOf(day).some((r) => r.home === house && r.work !== house), 'a household at home');
  assert.deepEqual(lt.lodgersAt(/** @type {number} */ (house), day), [], 'a house has no lodgers - its household is its own');
});

test('LW-LODGE the rooms dealt: each lodger, in the order of their ids, the bed their id and the tavern draw, or the next free after it - none twice; the first in id order housed where lodgers outnumber beds; the same deal on every reader - but the bed of the room the player rents no lodger\'s: the one it fell to takes the first bed after it nobody has (else the common room), the rest keep theirs (mutants: the draw, the probe, the rented bed, the rehoused)', () => {
  const ids = Array.from({ length: 5 }, (_, i) => `L1.t${i}`);
  const deal = bedsOf(ids, 8, 1000);
  assert.equal(deal.size, 5);
  assert.equal(new Set(deal.values()).size, 5, 'none twice');
  for (const b of deal.values()) assert.ok(b >= 0 && b < 8);
  assert.deepEqual([...bedsOf(ids, 8, 1000)], [...deal], 'the same on every reader');
  assert.notDeepEqual([...bedsOf(ids, 8, 1001)].map(([, b]) => b), [...deal].map(([, b]) => b), 'the tavern\'s own draw');
  // the rented bed: never dealt; the lodger it fell to the first bed after it nobody has; the rest keep theirs
  for (const rented of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const r = bedsOf(ids, 8, 1000, rented);
    assert.ok(![...r.values()].includes(rented), `bed ${rented} rented: no lodger's`);
    assert.equal(r.size, 5, 'all housed');
    for (const [id, b] of r) {
      if (deal.get(id) !== rented) { assert.equal(b, deal.get(id), `${id}: the rest keep theirs`); continue; }
      let free = rented;
      do free = (free + 1) % 8; while ([...deal.values()].includes(free));
      assert.equal(b, free, `${id}: the first bed after it nobody has`);
    }
  }
  // more lodgers than beds: the first in id order have them; the rented bed's lodger then none
  const six = Array.from({ length: 6 }, (_, i) => `L1.t${i}`);
  const all = bedsOf(six, 4, 1000);
  assert.deepEqual([...all.keys()], ['L1.t0', 'L1.t1', 'L1.t2', 'L1.t3'], 'the first in id order housed');
  const many = bedsOf(six, 4, 1000, 1);
  assert.equal(many.size, 3, 'three beds left: three lodgers housed');
  assert.ok([...many.keys()].every((id) => all.has(id) && all.get(id) !== 1), 'the one the rented bed fell to in the common room');
  assert.equal(bedsOf(ids, 0, 1000).size, 0, 'no beds: no rooms');
});

/** A mock room with a bed in it: a box `w` by `d` about the origin, the floor at 0; the bed a solid box (its walls stop a
 *  step), its top at 0.5 - a Rest marker on it. */
function bedroom({ w = 6, d = 5, bed = [[-0.5, -1], [0.5, 1]] } = {}) {
  const inBed = (x, z) => x > bed[0][0] && x < bed[1][0] && z > bed[0][1] && z < bed[1][1];
  const collider = {
    move(q, dx, dy, dz) {
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const nx = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx / steps)), nz = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz / steps));
        if (inBed(nx, nz) && !inBed(q[0], q[2])) break;   // walked into the bed: stopped
        q[0] = nx; q[2] = nz;
      }
      q[1] += dy;
    },
  };
  const floorAt = (x, y, z) => (inBed(x, z) ? 0.5 : 0);
  return { collider, floorAt, inBed };
}

test('LW-LODGE by their bed: a step out from the bed (BED_STEP_M) the nearest way of BED_FAN the room lets them walk - down off a solid bed onto the floor where any way comes down (by more than BED_LEVEL_M, no more than BED_DROP_M), level beside a bed whose marker is on the floor, never higher; facing the bed; never through a wall nor stopped short against one; the bed\'s own place where no way serves (mutants: the step, the walls, the stopped, the floor, the down, the facing)', () => {
  assert.deepEqual([[...BED_STEP_M], BED_FAN], [[0.9, 1.3], 8]);
  const r = bedroom();
  const st = bedStand([0, 0.5, 0], r.collider, r.floorAt);
  assert.ok(!r.inBed(st.feet[0], st.feet[2]) && st.feet[1] === 0, `on the floor beside it (${st.feet.map((v) => v.toFixed(2))})`);
  const d = Math.hypot(st.feet[0], st.feet[2]);
  assert.ok(d >= 0.5 && d <= 1.3 + 1e-9, `a step from it (${d.toFixed(2)})`);
  assert.ok(Math.abs(st.yaw - Math.atan2(-st.feet[0], -st.feet[2])) < 1e-9, 'facing the bed');
  // a bed in a corner, its walls on two sides: the open sides
  const corner = bedroom({ w: 4, d: 4, bed: [[1, 1], [2, 2]] });
  const sc = bedStand([1.5, 0.5, 1.5], corner.collider, corner.floorAt);
  assert.ok(!corner.inBed(sc.feet[0], sc.feet[2]) && sc.feet[0] < 1.6 && sc.feet[2] < 1.6, 'out into the room');
  // a bed in a closet: every step stopped short by its walls - its own place
  const closet = bedroom({ w: 1.0, d: 1.0, bed: [[-0.5, -0.5], [0.5, 0.5]] });
  assert.deepEqual(bedStand([0, 0.5, 0], closet.collider, closet.floorAt), { feet: [0, 0.5, 0], yaw: 0 }, 'none free: by its own place');
  // a bed not solid (its marker on the floor): the floor at its own height
  const flat = bedroom();
  const sf = bedStand([0, 0, 0], flat.collider, () => 0);
  assert.ok(sf.feet[1] === 0 && Math.hypot(sf.feet[0], sf.feet[2]) >= 0.9 * 0.75, 'level beside it');
  // the steps along the bed's length stay on it, those across come down: across
  assert.ok(Math.abs(st.feet[0]) > 0.5, 'down off its side, not along its top');
  // another floor (a stair down beside the bed): not there
  const stair = bedroom();
  const low = bedStand([0, 0.5, 0], stair.collider, (x, y, z) => (stair.inBed(x, z) ? 0.5 : x > 0 ? -2 : 0));
  assert.ok(low.feet[0] <= 0 && low.feet[1] === 0, 'the room\'s own floor');
});

/** An indoors layer over a mock tavern: its common room and two bedrooms off it (the beds at x 4 and 4.5, z 4 - a mock
 *  collider of one open box, the beds solid). */
function tavernRig({ inside = [], lodgers = [], rented = -1, clock = 1000 } = {}) {
  const r = bedroom({ w: 14, d: 14, bed: [[3.5, 3.5], [4.0, 4.5]] });
  const synced = [];
  const sprites = { sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res } }, pos: x.feet })), batches: () => [], clear() { synced.length = 0; } };
  const st = { inside, lodgers, clock, rented };
  const town = {
    insideAt: (key) => (key === 7000 ? st.inside.map(([res, kind]) => ({ res, e: { kind } })) : []),
    lodgersAt: (key) => (key === 7000 ? st.lodgers : []),
    dayOf: (t) => Math.floor((t - 240) / 1440), o: { relations: () => null },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => r.collider, floorAt: r.floorAt, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => st.clock,
    beds: () => [[3.75, 0.5, 4.0], [-4, 0, -4]], rented: () => st.rented,
  });
  return { layer, synced, st };
}
const L = (i) => ({ id: `L9.t${i}`, name: `Lodger ${i}`, cls: null });

test('LW-LODGE in the tavern: a lodger up in their room (their day\'s home there) stands by their bed - at no table, never stirring; at breakfast and supper (their day\'s tavern) in the common room with the rest; the bed of the room the player rents no lodger\'s; one gone up or come down changes place where the player is not looking (mutants: the bed unread, the table, the stir, the rented, the going up)', () => {
  const a = L(1), b = L(2), c = L(3);
  const rig = tavernRig({ inside: [[a, 'home'], [b, 'tavern'], [c, 'home']], lodgers: [a, b, c] });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const beds = rig.layer.beds();
  assert.equal(beds.length, 2);
  const deal = bedsOf([a.id, b.id, c.id], 2, 7000);
  const stood = new Map(rig.layer.stood().map((s) => [s.id, s]));
  for (const x of [a, c]) {
    const bed = deal.get(x.id);
    if (bed == null) { assert.equal(stood.get(x.id)?.bed, -1, `${x.id}: no bed left - the common room`); continue; }
    assert.equal(stood.get(x.id)?.bed, bed, `${x.id}: up in their room`);
    assert.deepEqual(stood.get(x.id)?.at, beds[bed].feet, `${x.id}: by their bed`);
    assert.equal(stood.get(x.id)?.table, -1, `${x.id}: at no table`);
    assert.equal(rig.synced.find((y) => y.res.id === x.id)?.yaw, beds[bed].yaw, `${x.id}: facing the bed`);
  }
  assert.equal(stood.get(b.id)?.bed, -1, 'at supper: the common room');
  // no stirring in one's room, however long
  const before = rig.layer.stood().filter((s) => s.bed >= 0).map((s) => JSON.stringify(s.at));
  for (let i = 0; i < 400; i++) rig.layer.frame(0.5, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.deepEqual(rig.layer.stood().filter((s) => s.bed >= 0).map((s) => JSON.stringify(s.at)), before, 'in their room, still');
  assert.ok(rig.layer.stood().every((s) => !s.walking || s.bed < 0));
  // the rented bed: the lodger it was theirs takes the other
  const owner = [...deal].find(([, i]) => i === 0)?.[0];
  if (owner) {
    const rented = tavernRig({ inside: [[a, 'home'], [b, 'home'], [c, 'home']], lodgers: [a, b, c], rented: 0 });
    rented.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
    assert.ok(rented.layer.stood().every((s) => s.bed !== 0), 'the rented room no lodger\'s');
  }
  // down to supper where the player is not looking: by their bed in view they stay; looked away from, the common room
  const lone = tavernRig({ inside: [[a, 'home']], lodgers: [a] });
  lone.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const bedA = bedsOf([a.id], 2, 7000).get(a.id) ?? -1;
  assert.equal(lone.layer.stood()[0]?.bed, bedA);
  const toward = Math.atan2(beds[bedA].feet[0], beds[bedA].feet[2]);
  lone.st.inside = [[a, 'tavern']];
  lone.layer.frame(INDOOR_TICK_S, [0, 0, 0], toward, [0, 1.6, 0]);
  lone.layer.frame(0.016, [0, 0, 0], toward, [0, 1.6, 0]);
  assert.equal(lone.layer.stood()[0]?.bed, bedA, 'in view: still up there');
  lone.layer.frame(0.016, [0, 0, 0], toward + Math.PI, [0, 1.6, 0]);
  lone.layer.frame(0.016, [0, 0, 0], toward + Math.PI, [0, 1.6, 0]);
  assert.equal(lone.layer.stood()[0]?.bed, -1, 'looked away from: down in the common room');
});

test('LW-LODGE the hosts: the building host hands the room its beds (its Rest markers, RentRoom\'s own list) and the bed of the room the player rents there (findRentedRoom\'s, by the town and the building); the world host hands them to the room\'s residents (mutants: the beds unhanded, the rented unhanded)', () => {
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /get interiorBeds\(\) \{ return interiorRestMarkers\(\)\.map\(\(m\) => \[m\.x, m\.y, m\.z\]\); \},/);
  assert.match(modes, /findRentedRoom\(playerEntity\.rentedRooms \?\? \[\], questSceneCtx\?\.\(\)\?\.mapId \?\? 0, b\.buildingKey \?\? 0, b\.buildingType === BUILDING_TYPES\.Tavern\)/);
  assert.match(modes, /return room \? room\.allocatedBedIndex \?\? -1 : -1;/);
  const world = rd('src/scenes/world.js');
  assert.match(world, /beds: \(\) => modes\?\.interiorBeds \?\? \[\],/);
  assert.match(world, /rented: \(\) => modes\?\.rentedBedHere \?\? -1,/);
});
