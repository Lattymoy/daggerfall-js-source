// LW-PERF (2026-10-05, Mac: "how is performance after we integrate this?"; bible/06-Systems/Living-World.md "LW-PERF"):
// THE LIVING WORLD'S OWN COST, MEASURED - the script time it adds to a frame, on the engine the game runs on (V8), with
// no GPU and no ARENA2: the synthetic towns and map the tests stand (test/lwTown.mjs, test/lwRoads.mjs) and Hazelnut's
// own road bytes (vendor/roads-hazelnut). What a frame pays for:
//   - THE STREET: a town's census read on its beat and its walks searched (LivingTown.update), against DFU's own pool
//     (TownPopulation.update) on the same town - a village (3x3 blocks) and a great city (8x8), a morning, a noon and
//     an evening, the player crossing it; the way in (the first frame), the frames while the street is stood
//     (ARRIVAL_SHOW_S) and every frame after; and how soon every resident out of doors near the player is on the street.
//   - THE TOWN'S BUILD (LivingTown's constructor: its places and its census), paid once as the town streams in.
//   - THE ROADS: the way planner on Hazelnut's roads (one pair), the roads' layer's frame (its read of the parties near
//     spread over a few frames), and the deep's two readers.
//   - THE ROOM: twelve inside, talking and stirring.
// Budgets (a desktop's CPU; a frame is 16.7 ms at 60 Hz):
//   the great city, any frame after the street is stood        <= 12 ms
//   the great city, the frames while it is stood              <= 20 ms (its first, the census planned whole: <= 60 ms)
//   (a shared machine's noise - a collection, a deoptimisation - lifts one frame in a few runs; the budgets catch the
//   tens of milliseconds, not the noise)
//   every resident near on the city's street                  within 2.5 s of the way in
//   the roads' layer, any frame                               <= 6 ms
// Measured before LW-PERF (2026-10-05, this probe's own rows): the city's worst frame 36-120 ms, its way in 275-420 ms,
// the roads' read 5-10 ms once a second; after: see the bible's LW-PERF table.
//
// Usage: node tools/livingPerfProbe.mjs        (prints the table; exits 1 on a blown budget)
import { readFileSync } from 'node:fs';
import { synthTown } from '../test/lwTown.mjs';
import { livingMap } from '../test/lwRoads.mjs';
import { LivingTown, ARRIVAL_SHOW_S } from '../src/systems/livingWorld/livingTown.js';
import { TownPopulation } from '../src/systems/townPopulation.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { MobilePerson, PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { planRoute } from '../src/systems/travelRoute.js';
import { diversAt, fallenIn, CALENDAR_MPM, NATIVE_PER_M, partiesNear } from '../src/systems/livingWorld/trips.js';
import { createLivingRoads } from '../src/scenes/livingRoads.js';
import { createLivingIndoors } from '../src/scenes/livingIndoors.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { ROUND_S, lineMinutes } from '../src/systems/livingWorld/meetups.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const now = () => performance.now();
const ms = (x) => `${x.toFixed(2)} ms`;
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), p99: q(0.99), max: s[s.length - 1] ?? 0 };
};
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

/** A street crossed for `seconds` at 30 frames a second: the frame times, the way in, the stood frames, the fill. */
function street(kind, blocks, hour, seconds = 60) {
  const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
  const clock = { t: 100 * DAY_MIN + hour * 60 };
  const b0 = now();
  const pop = kind === 'living'
    ? new LivingTown(nav, { town: { mapId: 7000 + blocks * 10 + hour, blocks: blocks * blocks, region: 17, people: 3, port: false }, buildings, doors,
      makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
      clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, relations: () => createRelations(), playerName: () => 'Mac' })
    : new TownPopulation(nav, { totalBlocks: blocks * blocks, race: 'Breton', makePerson: (archive, guard) => new MobilePerson(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }) });
  const build = now() - b0;
  const W = blocks * 24 * 1.6, dt = 1 / 30, stood = [], after = [];
  let first = 0;
  for (let i = 0; i < seconds * 30; i++) {
    clock.t += dt * RATE;
    const at = [W * (0.15 + 0.7 * (i / (seconds * 30))), 0, W * 0.5 + 1];
    const a = now();
    pop.update(dt, at, Math.PI / 2, at, true, () => false);
    const f = now() - a;
    if (i === 0) first = f; else ((i + 1) / 30 <= ARRIVAL_SHOW_S ? stood : after).push(f);
  }
  return { build, first, stood: stats(stood), after: stats(after) };
}

/** How soon (s) every resident out of doors within 70 m of a player standing still is on a great city's street. */
function fill(blocks, hour) {
  const make = () => {
    const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
    const clock = { t: 100 * DAY_MIN + hour * 60 };
    const town = new LivingTown(nav, { town: { mapId: 12345, blocks: blocks * blocks, region: 17, people: 3, port: false }, buildings, doors,
      makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE });
    return { town, clock };
  };
  const live = make(), truth = make(), at = [blocks * 24 * 1.6 * 0.4, 0, blocks * 24 * 1.6 * 0.4];
  for (let i = 0; i < 30 * 20; i++) {
    live.clock.t += RATE / 30;
    live.town.update(1 / 30, at, 0, at, true);
    if (i % 15 !== 14) continue;
    const t = live.clock.t;
    const rows = new Set(live.town.pool.filter((r) => r.active && r.res).map((r) => r.res.id));
    truth.clock.t = t;
    const missing = truth.town.peopleOf(truth.town.dayOf(t)).filter((res) => { const w = truth.town.where(res, t, true); return w && Math.hypot(w.x - at[0], w.z - at[2]) < 70 && !rows.has(res.id); });
    if (!missing.length) return (i + 1) / 30;
  }
  return Infinity;
}

console.log('THE STREET (living vs DFU\'s pool on the same town; the player crossing it for a minute)');
for (const blocks of [3, 8]) {
  for (const hour of [8, 13, 19]) {
    street('living', blocks, hour, 2); street('classic', blocks, hour, 2);   // warm
    const L = street('living', blocks, hour), C = street('classic', blocks, hour);
    console.log(`  ${blocks}x${blocks} ${String(hour).padStart(2)}:00  living: build ${ms(L.build)}, way in ${ms(L.first)}, stood max ${ms(L.stood.max)}, after mean ${ms(L.after.mean)} p99 ${ms(L.after.p99)} max ${ms(L.after.max)}   |   DFU's: mean ${ms(C.after.mean)} max ${ms(C.after.max)}`);
    if (blocks === 8) {
      check(L.after.max <= 12, `the great city at ${hour}:00, any frame after the street is stood <= 12 ms (${ms(L.after.max)})`);
      check(L.stood.max <= 20 && L.first <= 60, `the great city at ${hour}:00, the way in <= 60 ms (${ms(L.first)}) and its stood frames <= 20 ms (${ms(L.stood.max)})`);
    }
  }
}
for (const [blocks, hour] of [[6, 8.5], [8, 8.5]]) {
  const s = fill(blocks, hour);
  check(s <= 2.5, `${blocks}x${blocks} at ${hour}: every resident near on the street within 2.5 s (${s} s)`);
}

console.log('THE ROADS');
{
  const bytes = (n) => new Uint8Array(readFileSync(new URL(`../vendor/roads-hazelnut/${n}`, import.meta.url)));
  const roads = bytes('roadData.bytes'), tracks = bytes('trackData.bytes');
  const on = []; for (let i = 0; i < roads.length; i++) if (roads[i]) on.push(i);
  let seed = 12345; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const times = [];
  while (times.length < 200) {
    const a = on[Math.floor(rnd() * on.length)], ax = a % 1000, ay = Math.floor(a / 1000), d = 3 + rnd() * 15, ang = rnd() * Math.PI * 2;
    const bx = Math.round(ax + Math.cos(ang) * d), by = Math.round(ay + Math.sin(ang) * d);
    if (bx < 0 || by < 0 || bx >= 1000 || by >= 500 || !roads[by * 1000 + bx]) continue;
    const t0 = now(); planRoute({ x: ax, y: ay }, { x: bx, y: by }, { roads, tracks }); times.push(now() - t0);
  }
  const s = stats(times);
  console.log(`  the way planner on Hazelnut's roads, one pair 3-18 px: mean ${ms(s.mean)}, max ${ms(s.max)} (two new pairs a frame at most, each once)`);
}
{
  const map = livingMap({ dives: true });
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const t0 = 300 * DAY_MIN + 600;
  const near = partiesNear(120, 120, t0, map.world, o, 6).parties[0];
  const here = near ? { x: near.at.x, z: near.at.z } : { x: 0, z: 0 };
  const clock = { t: t0 };
  const sprites = { sync() {}, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const layer = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => RATE, sceneOf: (x, z) => [x / NATIVE_PER_M, 0, z / NATIVE_PER_M], here: () => here, sprites, relations: () => createRelations(), memo: o.memo });
  const eye = [here.x / NATIVE_PER_M, 1.6, here.z / NATIVE_PER_M], frames = [];
  for (let i = 0; i < 1800; i++) { clock.t += RATE / 30; const a = now(); layer.frame(1 / 30, eye); layer.speech(eye); frames.push(now() - a); }
  const f = stats(frames.slice(1));
  console.log(`  the roads' layer (${map.world.townsNear(120, 120, 24).length} towns near, ${layer.parties().length} parties): the way in ${ms(frames[0])}, then mean ${ms(f.mean)} p99 ${ms(f.p99)} max ${ms(f.max)}`);
  check(f.max <= 6, `the roads' layer, any frame <= 6 ms (${ms(f.max)})`);
  const dungeon = map.world.dungeonsNear(120, 120, 18)[0];
  const dv = [], fl = [];
  for (let i = 0; i < 20; i++) { let a = now(); diversAt(dungeon, t0 + i, map.world, o); dv.push(now() - a); a = now(); fallenIn(dungeon, t0 + i, map.world, o); fl.push(now() - a); }
  console.log(`  the deep's readers, once a second below: the divers ${ms(stats(dv).mean)}, the fallen ${ms(stats(fl).mean)}`);
}

console.log('THE ROOM');
{
  const collider = { move(q, dx, dy, dz) { q[0] = Math.max(-6.7, Math.min(6.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; }, raycast: () => null };
  const synced = [];
  const sprites = { sync(list) { synced.length = 0; synced.push(...list); }, persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet }, pos: x.feet })), batches: () => [], clear() { synced.length = 0; } };
  const BEAT = { roundMin: ROUND_S * 2, lineMin: lineMinutes(2) };
  const res = Array.from({ length: 12 }, (_, i) => ({ id: `L9.${i}`, name: `R${i}`, job: 'labourer', cls: null }));
  const town = { insideAt: () => res.map((r) => ({ res: r, e: { kind: 'tavern', t0: 0, t1: 1e12 } })), dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => BEAT,
    lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: () => 'Hello.', o: { relations: () => createRelations() } };
  const st = { clock: 100 * DAY_MIN + 1200 };
  const layer = createLivingIndoors({ sprites, building: () => ({ key: 7000, town }), collider: () => collider, floorAt: () => 0, origin: () => [0, 0, -4.6], staticFeet: () => [], clock: () => st.clock, ready: () => true });
  const frames = [];
  for (let i = 0; i < 1800; i++) { st.clock += RATE / 30; const a = now(); layer.frame(1 / 30, [0, 0, -4.6], 0, [0, 1.6, -4.6]); layer.speech([0, 1.6, -4.6]); frames.push(now() - a); }
  const f = stats(frames.slice(1));
  console.log(`  twelve inside: the way in ${ms(frames[0])}, then mean ${ms(f.mean)} max ${ms(f.max)}`);
}

if (failures.length) { console.log(`\n${failures.length} budget(s) blown`); process.exit(1); }
console.log('\nevery budget held');
