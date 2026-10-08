// LW-ROOMS (2026-10-08, Mac: "With living world integration, NPCs still group up in taverns"; bible/06-Systems/
// Living-World.md "LW-ROOMS"): THE TAVERN, MEASURED - no GPU and no ARENA2: the synthetic towns the pins stand
// (test/lwTown.mjs) and the synthetic hall on the port's own collider (test/lwRoom.mjs).
//   - THE TAVERN'S DAY: the people the plans put in a town's tavern (livingTown.js insideAt), the most at once before
//     noon, at noon, in the afternoon and in the evening, over five days; and its stays of four hours and more.
//   - THE ROOM: the hall sounded from its way in (scenes/livingIndoors.js soundRoom) - its places, the farthest from the
//     way in, the sounding's cost - and twelve the day has inside, stood and left astir ten real minutes: the biggest
//     crowd (people within CROWD_M of one another, chained), the nearest other, the distance from the way in.
//
// Usage: node tools/livingRoomProbe.mjs
import { synthTown, walledTown } from '../test/lwTown.mjs';
import { tavernHall } from '../test/lwRoom.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { createLivingIndoors, soundRoom } from '../src/scenes/livingIndoors.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { lineMinutes, ROUND_S } from '../src/systems/livingWorld/meetups.js';
import { isMain } from './lib/isMain.mjs';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE;
/** Two this near one another stand in one crowd (m), chained. */
export const CROWD_M = 2.5;
/** The towns: a hamlet's worth of blocks to a city's, and the walled one - each with one tavern. */
export const TOWNS = Object.freeze([
  ['3x3', () => synthTown(), 9], ['4x4', () => synthTown({ blocksW: 4, blocksH: 4 }), 16], ['6x6', () => synthTown({ blocksW: 6, blocksH: 6 }), 36], ['walled', () => walledTown(), 16],
]);
/** The day's parts the tavern's people are read in (hours, every quarter). */
export const PARTS = Object.freeze([['before noon', 6, 12], ['noon', 12, 14], ['afternoon', 14, 18], ['evening', 18, 24]]);

/** A synthetic town's tavern through five days: the most inside at once in each part, and its stays of four hours and
 *  more. @param {() => any} build @param {number} blocks */
export function tavernDay(build, blocks) {
  const { nav, buildings, doors } = build();
  const clock = { t: 100 * DAY_MIN };
  const town = new LivingTown(nav, { town: { mapId: 12345, blocks, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM });
  const tavern = buildings.find((b) => b.type === BUILDING_TYPES.Tavern).key;
  const most = Object.fromEntries(PARTS.map(([name]) => [name, 0]));
  let long = 0;
  for (let day = 100; day < 105; day++) {
    for (const [name, h0, h1] of PARTS) for (let m = h0 * 60; m < h1 * 60; m += 15) most[name] = Math.max(most[name], town.insideAt(tavern, day * DAY_MIN + m).length);
    for (const res of town.peopleOf(day)) for (const e of town.planOf(res, day)) if (e.kind === 'tavern' && e.at?.building === tavern && e.t1 - e.t0 >= 240 && res.work !== tavern && res.home !== tavern) long++;
  }
  return { people: town.peopleOf(100).length, most, long };
}

/** The hall sounded and twelve stood in it, left astir `seconds` real seconds, the player at the way in looking out.
 *  @param {{ w?: number, d?: number }} size @param {number} [seconds] */
export function hallAstir(size, seconds = 600) {
  const h = tavernHall(size);
  soundRoom(h.landing, h.collider, h.floorAt, [], [h.landing]);   // warm
  const t0 = performance.now();
  const spots = soundRoom(h.landing, h.collider, h.floorAt, [], [h.landing]);
  const ms = performance.now() - t0;
  const st = { clock: 100 * DAY_MIN + 1200 };
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet }, pos: x.feet })),
    batches: () => [], clear() { synced.length = 0; },
  };
  const beat = { roundMin: ROUND_S * 0.2, lineMin: lineMinutes(0.2) };
  const people = Array.from({ length: 12 }, (_, i) => ({ id: `L9.${i}`, name: `R${i}`, job: 'labourer', cls: null }));
  const town = {
    insideAt: () => people.map((res) => ({ res, e: { kind: 'tavern', t0: 0, t1: 1e12 } })),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => beat,
    lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: () => null,
    o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => h.collider, floorAt: h.floorAt, origin: () => h.landing, waysIn: () => [h.landing],
    staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  const read = () => {
    const at = layer.stood().map((s) => s.at);
    const near = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]) <= CROWD_M;
    const seen = new Set();
    let crowd = 0;
    for (let i = 0; i < at.length; i++) {
      if (seen.has(i)) continue;
      const q = [i];
      seen.add(i);
      for (let k = 0; k < q.length; k++) for (let j = 0; j < at.length; j++) if (!seen.has(j) && near(at[q[k]], at[j])) { seen.add(j); q.push(j); }
      crowd = Math.max(crowd, q.length);
    }
    const mean = (f) => at.reduce((s, p) => s + f(p), 0) / Math.max(1, at.length);
    return { stood: at.length, crowd, nearest: mean((p) => Math.min(...at.filter((q) => q !== p).map((q) => Math.hypot(p[0] - q[0], p[2] - q[2])))), door: mean((p) => Math.hypot(p[0] - h.door[0], p[2] - h.door[2])) };
  };
  const out = [];
  for (let f = 0; f <= seconds * 10; f++) {
    st.clock += 0.02;
    layer.frame(0.1, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
    if (f % 100 === 0) out.push(read());
  }
  const far = Math.max(0, ...spots.map((p) => Math.hypot(p[0] - h.door[0], p[2] - h.door[2])));
  return { spots: spots.length, far, ms, first: out[0], most: Math.max(...out.map((x) => x.crowd)), crowd: out.reduce((s, x) => s + x.crowd, 0) / out.length, nearest: out.reduce((s, x) => s + x.nearest, 0) / out.length, door: out.reduce((s, x) => s + x.door, 0) / out.length };
}

if (isMain(import.meta.url)) {
  console.log('THE TAVERN\'S DAY (the most inside at once, five days; its stays of four hours and more)');
  for (const [name, build, blocks] of TOWNS) {
    const r = tavernDay(build, blocks);
    console.log(`  ${name.padEnd(6)} ${String(r.people).padStart(3)} people: ${PARTS.map(([p]) => `${p} ${r.most[p]}`).join(', ')}; ${r.long} stays of four hours`);
  }
  console.log('THE ROOM (twelve the day has inside, ten minutes astir)');
  for (const size of [{ w: 24, d: 18 }, { w: 12, d: 10 }, { w: 40, d: 30 }]) {
    const r = hallAstir(size);
    console.log(`  ${size.w}x${size.d}: ${r.spots} places, the farthest ${r.far.toFixed(1)} m from the way in, sounded in ${r.ms.toFixed(1)} ms; ${r.first.stood} stood - on the way in the biggest crowd ${r.first.crowd}; astir the biggest ${r.most}, on average ${r.crowd.toFixed(1)}; the nearest other ${r.nearest.toFixed(2)} m, the way in ${r.door.toFixed(1)} m off`);
  }
}
