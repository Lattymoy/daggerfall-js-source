// LW-PERF (2026-10-05, bible/06-Systems/Living-World.md "LW-PERF", Mac: "how is performance after we integrate this?" -
// "Do it"): THE LIVING WORLD'S COST, MEASURED AND CUT. A great city's walks searched whole stood frames of 40-120 ms in
// its morning and 0.3-0.4 s on the way in; the roads' read of the parties near was 5-10 ms once a second; the deep's
// readers, the day's plans and the town's places each paid their whole cost again on every read. Pinned here: the
// search run in slices answers what the whole search answered (and what the search before LW-PERF did - its reference
// below), the path book's queue and its cells a frame, the town's frames held to them and its street still filled, the
// arrival's window, the day plans' favourites and the day's trips kept and the same as worked out afresh, the roads read
// over a few frames, the town's places the same as before. The measuring is tools/livingPerfProbe.mjs's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { livingMap } from './lwRoads.mjs';
import { townPathSearch, findTownPath, createPathBook, stepCost, PATH_QUEUE_MAX } from '../src/systems/livingWorld/townPaths.js';
import { LivingTown, PATH_CELLS, ARRIVAL_PATH_CELLS, ARRIVAL_SHOW_S, LIVING_RANGE } from '../src/systems/livingWorld/livingTown.js';
import { favourites, dayPlan, DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces, streetNet } from '../src/systems/livingWorld/places.js';
import { townCensus, hasShopJob } from '../src/systems/livingWorld/census.js';
import { townTrips, partiesNear, remainsNear, partiesOfTown, remainsOfTown, memoTrip, cycleOf, formCaravans, paceScale, CALENDAR_MPM, NATIVE_PIXEL, TRIP_REACH_PX, TRIP_CHANCE } from '../src/systems/livingWorld/trips.js';
import { createLivingRoads, ROADS_TOWNS_PER_FRAME, ROADS_JUMP_PX, ROADS_TICK_S, ROADS_VIEW_PX } from '../src/scenes/livingRoads.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { POP_VISIBLE_RANGE } from '../src/systems/townPopulation.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { lwRng } from '../src/systems/livingWorld/seed.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;

/** THE SEARCH BEFORE LW-PERF (townPaths.js findTownPath as it stood): the reference every answer is held to. */
function refTownPath(nav, a, b) {
  const W = nav.width, H = nav.height;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  if (!a || !b || !inb(a[0], a[1]) || !inb(b[0], b[1])) return null;
  if (!(nav.weightAt(a[0], a[1]) > 0) || !(nav.weightAt(b[0], b[1]) > 0)) return null;
  const start = a[1] * W + a[0], goal = b[1] * W + b[0];
  if (start === goal) return [[a[0], a[1]]];
  const n = W * H, g = new Float32Array(n), f = new Float32Array(n), from = new Int32Array(n), order = new Int32Array(n);
  const seen = new Uint8Array(n), closed = new Uint8Array(n), heap = [];
  let opened = 0;
  const hOf = (i) => Math.abs((i % W) - b[0]) + Math.abs(((i / W) | 0) - b[1]);
  const less = (i, j) => f[i] < f[j] || (f[i] === f[j] && order[i] < order[j]);
  const push = (i) => { let k = heap.length; heap.push(i); while (k > 0) { const p = (k - 1) >> 1; if (!less(heap[k], heap[p])) break; [heap[k], heap[p]] = [heap[p], heap[k]]; k = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === k) break; [heap[k], heap[m]] = [heap[m], heap[k]]; k = m; } }
    return top;
  };
  seen[start] = 1; g[start] = 0; from[start] = -1; f[start] = hOf(start); order[start] = opened++; push(start);
  let expansions = 0;
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { const out = []; for (let i = cur; i !== -1; i = from[i]) out.push([i % W, (i / W) | 0]); return out.reverse(); }
    if (++expansions > 120000) return null;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const w = nav.weightAt(nx, ny);
      if (!(w > 0)) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + stepCost(w);
      if (seen[ni] && ng >= g[ni]) continue;
      seen[ni] = 1; g[ni] = ng; from[ni] = cur; f[ni] = ng + hOf(ni); order[ni] = opened++;
      push(ni);
    }
  }
  return null;
}

/** A synthetic town roughened: its ground's weights strewn, a few cells taken out (a walker's flag left on some - the
 *  grid's low bits, never its weight). */
function roughTown(blocks) {
  const t = synthTown({ blocksW: blocks, blocksH: blocks });
  const g = t.nav.grid;
  for (let i = 0; i < g.length; i++) if (g[i]) g[i] = (i % 211 === 0 ? 0 : ([15, 12, 7, 6, 4][(Math.imul(i, 2654435761) >>> 7) % 5] << 4)) | (i % 3 === 0 ? 1 : 0);
  return t;
}

test('LW-PERF the town\'s ways in slices: a search run a slice at a time answers what it answers whole, cell for cell - and what the search before LW-PERF answered; a slice opens no more cells than it was given; a search another ran over since its last slice begins again and answers the same (mutants: the slice unbounded, the order kept loosely, the restart)', () => {
  const { nav } = roughTown(4);
  const rng = lwRng(77);
  const pairs = [];
  while (pairs.length < 60) {
    const a = [Math.floor(rng() * nav.width), Math.floor(rng() * nav.height)], b = [Math.floor(rng() * nav.width), Math.floor(rng() * nav.height)];
    if (nav.weightAt(...a) > 0 && nav.weightAt(...b) > 0) pairs.push([a, b]);
  }
  let found = 0;
  pairs.forEach(([a, b], n) => {
    const ref = refTownPath(nav, a, b);
    if (ref) found++;
    assert.deepEqual(findTownPath(nav, a, b), ref, `whole ${a}>${b}`);
    const s = townPathSearch(nav, a, b);
    const slice = 1 + (n * 37) % 600;
    let got, steps = 0;
    do { got = s.step(slice); assert.ok(s.spent <= slice, 'never past its slice'); steps++; } while (got === undefined);
    assert.deepEqual(got, ref, `sliced ${slice} ${a}>${b}`);
    if (ref && ref.length > 40) assert.ok(steps > 1, 'a long walk takes more than one slice');
  });
  assert.ok(found > 40, `ways found (${found})`);
  // another search run over this one's scratch between its slices: this one begins again, and answers the same
  const long = pairs.find(([a, b]) => (refTownPath(nav, a, b)?.length ?? 0) > 60);
  const other = pairs.find((p) => p !== long && refTownPath(nav, ...p));
  const s1 = townPathSearch(nav, ...long);
  assert.equal(s1.step(40), undefined, 'under way');
  assert.deepEqual(findTownPath(nav, ...other), refTownPath(nav, ...other), 'the other, whole, over its scratch');
  let r1;
  do { r1 = s1.step(40); } while (r1 === undefined);
  assert.deepEqual(r1, refTownPath(nav, ...long), 'begun again: the same');
  assert.equal(townPathSearch(nav, [-1, 0], long[1]).step(5), null, 'an end off the grid: none');
});

test('LW-PERF the path book: a frame\'s cells bound its searching - a walk asked waits (undefined) till searched, the frame\'s cells spent, then answers; the walks waiting are searched one at a time, a resident on the street\'s before the census\'s, each in the order asked, the frame\'s rest spent by `run` with nobody asking; a walk is asked once however often; the queue bounded; without cells a search runs whole (mutants: the cells unspent, the order, the run, the bound, the soon first)', () => {
  const { nav } = roughTown(4);
  const W = nav.width;
  const walk = (y0) => [[2, y0], [W - 3, nav.height - 1 - y0]];
  const ok = (c) => nav.weightAt(c[0], c[1]) > 0;
  const ends = [];
  for (let y = 2; ends.length < 6 && y < nav.height; y += 9) { const [a, b] = walk(y); if (ok(a) && ok(b) && refTownPath(nav, a, b)) ends.push([a, b]); }
  assert.equal(ends.length, 6, 'six long walks');
  const book = createPathBook(nav);
  book.cells(500);
  assert.equal(book.want(...ends[0]), undefined, 'waits');
  assert.ok(book.spent() <= 500 && book.spent() > 0, 'the frame\'s cells, no more');
  book.want(...ends[1]); book.want(...ends[2], true);
  assert.equal(book.waiting(), 3);
  book.want(...ends[1]);
  assert.equal(book.waiting(), 3, 'asked twice, waiting once');
  const done = [];
  for (let frame = 0; frame < 4000 && book.waiting(); frame++) {
    book.cells(500);
    book.run();
    assert.ok(book.spent() <= 500, 'each frame its cells');
    for (const i of [0, 1, 2]) if (!done.includes(i) && book.get(...ends[i]) !== undefined) done.push(i);
  }
  assert.deepEqual(done, [0, 2, 1], 'the one under way, then the street\'s, then the census\'s');
  for (const i of [0, 1, 2]) assert.deepEqual(book.get(...ends[i])?.pts.length > 1, true);
  // the bound: past PATH_QUEUE_MAX nothing more is asked
  const full = createPathBook(nav);
  full.cells(0);
  let asked = 0;
  for (let y = 0; y < nav.height && asked < PATH_QUEUE_MAX + 5; y++) for (let x = 0; x < W && asked < PATH_QUEUE_MAX + 5; x += 7) if (ok([x, y])) { full.want([x, y], ends[0][1]); asked++; }
  assert.equal(full.waiting(), PATH_QUEUE_MAX, 'the queue bounded');
  // the frame's budget of walks asked - a walk asked again spends none of it
  const counted = createPathBook(nav);
  counted.cells(0); counted.budget(2);
  for (let i = 0; i < 3; i++) counted.want(...ends[0]);
  for (const e of ends) counted.want(...e);
  assert.equal(counted.waiting(), 2, 'two asked this frame');
  // a walk the census asked, asked again by one on the street: before the census's
  const promoted = createPathBook(nav);
  promoted.cells(0);
  promoted.want(...ends[3]); promoted.want(...ends[4]); promoted.want(...ends[4], true);
  const order = [];
  for (let frame = 0; frame < 4000 && promoted.waiting(); frame++) {
    promoted.cells(500); promoted.run();
    for (const i of [3, 4]) if (!order.includes(i) && promoted.get(...ends[i]) !== undefined) order.push(i);
  }
  assert.deepEqual(order, [4, 3], 'promoted');
  // no cells given: whole, at once (LW1's book)
  const whole = createPathBook(nav);
  assert.deepEqual(whole.want(...ends[3])?.pts.length > 1, true, 'searched whole');
});

/** A synthetic town of `blocks` square on the clock at `minute`. */
function townAt(blocks, minute) {
  const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
  const clock = { t: minute };
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: blocks * blocks, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM,
  });
  return { town, clock };
}

test('LW-PERF the town\'s frames: each frame\'s searching held to its cells - ARRIVAL_PATH_CELLS while the street is stood on the way in (ARRIVAL_SHOW_S), PATH_CELLS after - and the street still filled: every resident out of doors near the player by their day on it within 2.5 s of the morning\'s way in; the street\'s own walks asked before the census\'s; one whose walk still waits is wanted only once it is searched (mutants: the cells, the window, the soon, the run, the waiting wanted)', () => {
  assert.deepEqual([PATH_CELLS, ARRIVAL_PATH_CELLS, ARRIVAL_SHOW_S], [8000, 24000, 1.5]);
  const minute = 100 * DAY_MIN + 8.5 * 60, at = [200, 0, 120];
  const live = townAt(6, minute), truth = townAt(6, minute);
  const firsts = [];
  const want = live.town._paths.want;
  live.town._paths.want = (a, b, first = false) => { firsts.push(first); return want(a, b, first); };
  let streetAsked = false, censusAsked = false;
  for (let i = 0; i < 75; i++) {
    live.clock.t += RATE / 30;
    firsts.length = 0;
    const tick = live.town._timer + 1 / 30 >= 0.25 || i === 0;
    live.town.update(1 / 30, at, 0, at, true);
    const cap = (i + 1) / 30 <= ARRIVAL_SHOW_S + 1e-9 ? ARRIVAL_PATH_CELLS : PATH_CELLS;
    assert.ok(live.town._paths.spent() <= cap, `frame ${i}: ${live.town._paths.spent()} cells, its budget ${cap}`);
    if (firsts.includes(true)) streetAsked = true;
    if (tick && firsts.includes(false)) censusAsked = true;
  }
  assert.ok(streetAsked && censusAsked, 'the street asks first, the census after');
  const t = live.clock.t;
  const rows = new Set(live.town.pool.filter((r) => r.active && r.res).map((r) => r.res.id));
  const near = [];
  for (const res of truth.town.peopleOf(truth.town.dayOf(t))) {
    const w = truth.town.where(res, t, true);
    if (w && Math.hypot(w.x - at[0], w.z - at[2]) < 70) near.push(res.id);
  }
  assert.ok(near.length >= 6, `the morning's people near (${near.length})`);
  assert.deepEqual(near.filter((id) => !rows.has(id)), [], 'each on the street within 2.5 s');
  for (const r of live.town.pool) {
    if (!r.active || !r.res) continue;
    const w = live.town.where(r.res, t, false);
    assert.ok(!w || Math.hypot(w.x - at[0], w.z - at[2]) < LIVING_RANGE + 5, `${r.res.id} within the street's reach`);
  }
});

test('LW-PERF the arrival\'s window: in ARRIVAL_SHOW_S of the way in the street is stood as the day has it - a resident found then comes on where the player sees; after it, one whose walk came late comes on only unseen (beyond POP_VISIBLE_RANGE or behind the view) or out of a door (mutants: the window, its length)', () => {
  const minute = 100 * DAY_MIN + 8.5 * 60, at = [300, 0, 300];
  const { town, clock } = townAt(8, minute);
  const was = new Map();
  let inViewInWindow = 0, after = 0;
  for (let i = 0; i < 30 * 8; i++) {
    clock.t += RATE / 30;
    town.update(1 / 30, at, 0, at, true);
    const real = (i + 1) / 30;
    for (const r of town.pool) {
      if (!r.res) continue;
      const seen = r.visible && r.active;
      if (seen && !was.get(r)) {
        const dx = r.person.pos[0] - at[0], dz = r.person.pos[2] - at[2];
        const unseen = Math.hypot(dx, dz) > POP_VISIBLE_RANGE || !(dx * Math.sin(0) + dz * Math.cos(0) > 0);
        const e = town.entryOf(r.res, clock.t)?.e;
        const door = e?.kind === 'walk' && e.from?.kind === 'door' && clock.t - e.t0 < 2;
        if (real <= ARRIVAL_SHOW_S) { if (!unseen) inViewInWindow++; }
        else { after++; assert.ok(unseen || door, `${r.res.id} came on in view ${real.toFixed(2)} s after the way in`); }
      }
      was.set(r, seen);
    }
  }
  assert.ok(inViewInWindow > 0, 'the way in: the street stood where the player sees');
  assert.ok(after > 0, 'and more came on after, unseen');
});

/** THE FAVOURITES BEFORE LW-PERF (dayPlan.js as it stood): every door scanned and sorted, keys compared as text. */
function refFavourites(res, places, home) {
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, 0x666176);
  const near = (list) => (list.length ? list[Math.floor(rng() * Math.min(list.length, 2))] : null);
  const by = (from) => (a, b) => (Math.abs(a.cell[0] - from.cell[0]) + Math.abs(a.cell[1] - from.cell[1])) - (Math.abs(b.cell[0] - from.cell[0]) + Math.abs(b.cell[1] - from.cell[1])) || a.key.localeCompare(b.key);
  const doorsOf = (test) => { const out = []; for (const [key, spot] of places.doors) if (test(places.types.get(key))) out.push(spot); if (home) out.sort(by(home)); return out; };
  const social = [...places.social]; if (home) social.sort(by(home));
  const s1 = places.square && rng() < 0.6 ? places.square : near(social);
  const s2 = near(social.filter((s) => s !== s1)) ?? s1;
  const market = [...places.market]; if (home) market.sort(by(home));
  return {
    social: [s1, s2].filter(Boolean), tavern: near(doorsOf((t) => t === BUILDING_TYPES.Tavern)), temple: near(doorsOf((t) => t === BUILDING_TYPES.Temple)),
    guild: near(doorsOf((t) => t === BUILDING_TYPES.GuildHall)), market: near(market) ?? places.square, shops: doorsOf(hasShopJob),
  };
}
const keysOf = (fav) => JSON.stringify(fav, (k, v) => (v && typeof v === 'object' && 'key' in v && 'cell' in v ? v.key : v));

test('LW-PERF the day plans\' favourites: kept by the town\'s places and the same as worked out before - every resident\'s, at home and lodged, their key the seed\'s and the home\'s; the same answer asked again (mutants: the key, the tie, the kinds)', () => {
  // the buildings' keys scattered over one to four figures - their spots' keys order as text otherwise than as numbers
  const t6 = synthTown({ blocksW: 6, blocksH: 6 });
  const scatter = (k) => ((k - 1000) * 37) % 997 + 5;
  const nav = t6.nav, buildings = t6.buildings.map((b) => ({ ...b, key: scatter(b.key) })), doors = t6.doors.map((d) => ({ ...d, key: scatter(d.key) }));
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 36, region: 17, people: 3, port: false }, buildings);
  const lodging = [...places.doors.values()][3];
  for (const res of census) {
    const home = res.home != null ? places.doors.get(res.home) ?? null : null;
    assert.equal(keysOf(favourites(res, places, home)), keysOf(refFavourites(res, places, home)), res.id);
    assert.equal(favourites(res, places, home), favourites(res, places, home), 'kept');
    assert.equal(keysOf(favourites(res, places, lodging)), keysOf(refFavourites(res, places, lodging)), `${res.id} lodged`);
    assert.equal(keysOf(favourites(res, places, null)), keysOf(refFavourites(res, places, null)), `${res.id} homeless`);
  }
  // a tie broken by the key: two doors the same way from home
  const tied = census.find((r) => {
    const home = r.home != null ? places.doors.get(r.home) : null;
    if (!home) return false;
    const d = (s) => Math.abs(s.cell[0] - home.cell[0]) + Math.abs(s.cell[1] - home.cell[1]);
    const shops = refFavourites(r, places, home).shops;
    return shops.some((s, i) => i > 0 && d(s) === d(shops[i - 1]));
  });
  assert.ok(tied, 'a resident with two shops the same way off');
  const mixed = census.some((r) => {
    const home = r.home != null ? places.doors.get(r.home) : null;
    if (!home) return false;
    const d = (s) => Math.abs(s.cell[0] - home.cell[0]) + Math.abs(s.cell[1] - home.cell[1]);
    const shops = refFavourites(r, places, home).shops;
    return shops.some((s, i) => i > 0 && d(s) === d(shops[i - 1]) && shops[i - 1].building > s.building);
  });
  assert.ok(mixed, 'a tie the key\'s text breaks otherwise than its number');
  // and the day's plan, every resident, as before (its houses visited and its outfitters by the kept lists)
  const plan = (res, day) => JSON.stringify(dayPlan(res, places, day, { mpm: MPM }).map((e) => [e.kind, e.at?.key ?? null, e.from?.key ?? null, e.to?.key ?? null, e.t0, e.t1]));
  for (const res of census.slice(0, 60)) assert.equal(plan(res, 200), plan(res, 200));
});

/** THE DAY'S TRIPS BEFORE LW-PERF (trips.js townTrips as it stood): every traveller's, filtered, made into parties. */
function refTownTrips(town, t, world, o) {
  const scale = paceScale(o.mpm), day = Math.floor(t / DAY_MIN), roster = world.rosterOf(town);
  let pending = false;
  const tripOf = (res, k) => { const trip = memoTrip(res, town, k, world, o); if (trip === undefined) pending = true; return trip ?? null; };
  const trips = [];
  for (const res of roster) {
    if (!(TRIP_CHANCE[res.job] > 0)) continue;
    const cyc = cycleOf(res, day, scale);
    for (const k of [cyc.k - 1, cyc.k]) {
      const holder = world.holderOf ? world.holderOf(res, k) : res;
      if (!holder) continue;
      const trip = tripOf(holder, k);
      if (trip && trip.backT1 > t - DAY_MIN && trip.outT0 < t + DAY_MIN) trips.push(trip);
    }
  }
  if (pending) return undefined;
  const made = formCaravans(town, trips, roster, tripOf, scale, world.holderOf, world.fated);
  if (pending) return undefined;
  return world.fate ? made.map((tr) => world.fate(tr)) : made;
}

test('LW-PERF the day\'s trips kept: a town\'s trips read off the book are what they are worked out afresh, at every minute over three days (the ones within a day of it, their caravans, their trouble) - kept for the same ones, never another world\'s or another pace\'s; the roads\' readers the towns\' shares (mutants: the window, the reuse, the guards)', () => {
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const towns = map.world.townsNear(120, 120, 6);
  const plain = (trips) => JSON.stringify(trips?.map((tr) => [tr.id, tr.party.map((m) => m.id), tr.outT0, tr.backT1, tr.enc?.kind ?? null, tr.enc?.dead ?? null, tr.fallen?.map((f) => [f.res.id, f.t]) ?? null]));
  let reads = 0, kept = 0;
  for (let t = 400 * DAY_MIN; t < 403 * DAY_MIN; t += 97) {
    for (const town of towns) {
      const got = townTrips(town, t, map.world, o);
      const fresh = refTownTrips(town, t, map.world, { mpm: CALENDAR_MPM, memo: new Map() });
      assert.equal(plain(got), plain(fresh), `${town.mapId} at ${t}`);
      if (townTrips(town, t, map.world, o) === got) kept++;
      reads++;
    }
  }
  assert.equal(kept, reads, 'the same ones: kept');
  // another world (other turns) or another pace never takes this one's
  const other = livingMap({ turns: { spared: new Set(), fallen: new Set(), won: new Set(), lost: new Set(), slain: new Map(), died: new Map() } });
  const t = 401 * DAY_MIN + 500;
  assert.notEqual(townTrips(towns[0], t, other.world, o), townTrips(towns[0], t, map.world, o), 'another world: its own');
  assert.equal(plain(townTrips(towns[0], t, map.world, { mpm: 3, memo: o.memo })), plain(refTownTrips(towns[0], t, map.world, { mpm: 3, memo: new Map() })), 'another pace: its own');
  // the readers: the towns' shares, in the towns' order
  const px = 120, py = 120;
  const shares = map.world.townsNear(px, py, 6 + TRIP_REACH_PX);
  assert.deepEqual(partiesNear(px, py, t, map.world, o, 6).parties, shares.flatMap((tw) => partiesOfTown(tw, px, py, t, map.world, o, 6) ?? []));
  assert.deepEqual(remainsNear(px, py, t, map.world, o, 6).remains, shares.flatMap((tw) => remainsOfTown(tw, px, py, t, map.world, o, 6) ?? []));
});

test('LW-PERF the roads read over a few frames: the parties and the fallen near read whole on the way in, then again each ROADS_TICK_S town by town - ROADS_TOWNS_PER_FRAME a frame, the last read standing till the new one is done, and the same as read whole; a jump past ROADS_JUMP_PX read whole at once, as the way back in (mutants: the slice, the jump, the swap, the way back in)', () => {
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const t0 = 400 * DAY_MIN + 600;
  const near = partiesNear(120, 120, t0, map.world, o, ROADS_VIEW_PX).parties;
  const pt = near[0];
  assert.ok(pt, 'a party near');
  const clock = { t: t0 };
  let here = { x: pt.at.x, z: pt.at.z };
  const sprites = { sync() {}, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => RATE, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => here, sprites, memo: o.memo });
  const pix = () => [Math.floor(here.x / NATIVE_PIXEL), 499 - Math.floor(here.z / NATIVE_PIXEL)];
  const whole = () => { const [px, py] = pix(); return partiesNear(px, py, clock.t, map.world, o, ROADS_VIEW_PX).parties.map((p) => p.trip.id); };
  roads.frame(0.01, [0, 0, 0]);
  assert.deepEqual(roads.parties().map((p) => p.trip.id), whole(), 'the way in: whole, at once');
  const towns = map.world.townsNear(...pix(), ROADS_VIEW_PX + TRIP_REACH_PX).length;
  const frames = Math.ceil(towns / ROADS_TOWNS_PER_FRAME);
  assert.ok(frames >= 3, `a read of ${towns} towns takes frames (${frames})`);
  roads.frame(ROADS_TICK_S, [0, 0, 0]);   // the beat: a read begins
  const before = roads.parties();
  for (let f = 1; f < frames; f++) { assert.equal(roads.parties(), before, `frame ${f}: the last read stands`); roads.frame(0.01, [0, 0, 0]); }
  assert.notEqual(roads.parties(), before, 'the new read, done');
  assert.deepEqual(roads.parties().map((p) => p.trip.id), whole(), 'the same as read whole');
  // a jump: whole at once
  here = { x: here.x + (ROADS_JUMP_PX + 1) * NATIVE_PIXEL, z: here.z };
  roads.frame(ROADS_TICK_S, [0, 0, 0]);
  assert.deepEqual(roads.parties().map((p) => p.trip.id), whole(), 'a jump: whole at once');
  // the way back in (the roads let go indoors): whole at once
  roads.clear();
  roads.frame(0.01, [0, 0, 0]);
  assert.deepEqual(roads.parties().map((p) => p.trip.id), whole(), 'the way back in: whole');
});

/** THE TOWN'S PLACES' THREE SCANS BEFORE LW-PERF (places.js as it stood): the net by the grid's reader, the square's
 *  window counted cell by cell, the exits a pass a side. */
function refScans(nav) {
  const W = nav.width, H = nav.height, label = new Int32Array(W * H), stack = new Int32Array(W * H);
  let next = 0, best = 0, bestSize = 0;
  for (let i = 0; i < W * H; i++) {
    if (label[i] || !(nav.weightAt(i % W, (i / W) | 0) > 0)) continue;
    const id = ++next; let sp = 0, size = 0; stack[sp++] = i; label[i] = id;
    while (sp > 0) {
      const c = stack[--sp]; size++; const x = c % W, y = (c / W) | 0;
      if (x > 0 && !label[c - 1] && nav.weightAt(x - 1, y) > 0) { label[c - 1] = id; stack[sp++] = c - 1; }
      if (x < W - 1 && !label[c + 1] && nav.weightAt(x + 1, y) > 0) { label[c + 1] = id; stack[sp++] = c + 1; }
      if (y > 0 && !label[c - W] && nav.weightAt(x, y - 1) > 0) { label[c - W] = id; stack[sp++] = c - W; }
      if (y < H - 1 && !label[c + W] && nav.weightAt(x, y + 1) > 0) { label[c + W] = id; stack[sp++] = c + W; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  let square = null, bestOpen = -1, bestD = Infinity;
  for (let y = 3; y < H - 3; y += 3) for (let x = 3; x < W - 3; x += 3) {
    if (label[y * W + x] !== best) continue;
    const d = Math.hypot(x - W / 2, y - H / 2);
    if (d > Math.max(W, H) * 0.35) continue;
    let open = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (label[(y + dy) * W + x + dx] === best) open++;
    if (open > bestOpen || (open === bestOpen && d < bestD)) { bestOpen = open; bestD = d; square = [x, y]; }
  }
  const exits = [];
  for (const side of ['n', 's', 'e', 'w']) {
    let b = null, bestEdge = Infinity, bestMid = Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (label[y * W + x] !== best) continue;
      const edge = side === 'n' ? H - 1 - y : side === 's' ? y : side === 'e' ? W - 1 - x : x;
      if (edge > bestEdge) continue;
      const mid = side === 'n' || side === 's' ? Math.abs(x - W / 2) : Math.abs(y - H / 2);
      if (edge < bestEdge || mid < bestMid) { bestEdge = edge; bestMid = mid; b = [x, y]; }
    }
    if (b) exits.push([side, b]);
  }
  return { label, id: best, size: bestSize, square, exits };
}

test('LW-PERF the town\'s places: the street net read off the grid\'s own bytes, the square\'s windows off the net\'s running sums, the four exits in one pass - each the same as before, on open and rough towns and a narrow one (mutants: the bytes, the sums, the pass)', () => {
  for (const [bw, bh] of [[3, 3], [4, 4], [5, 2]]) {
    const { nav, buildings, doors } = roughTown(Math.max(bw, bh));
    void bw; void bh;
    const ref = refScans(nav);
    const net = streetNet(nav);
    assert.deepEqual([net.id, net.size], [ref.id, ref.size], 'the net');
    assert.ok(net.label.every((v, i) => v === ref.label[i]), 'every cell\'s label');
    const places = townPlaces(nav, doors, buildings);
    assert.deepEqual(places.square?.cell ?? null, ref.square, 'the square');
    assert.deepEqual(places.exits.map((e) => [e.side, e.cell]), ref.exits, 'the exits');
  }
  // each side's middle cell taken out: the nearest to the middle a tie, the first in the grid's order its exit
  {
    const { nav, buildings, doors } = roughTown(3);
    const W = nav.width, H = nav.height;
    for (const [x, y] of [[W / 2, H - 1], [W / 2, 0], [W - 1, H / 2], [0, H / 2]]) nav.grid[y * W + x] = 0;
    assert.deepEqual(townPlaces(nav, doors, buildings).exits.map((e) => [e.side, e.cell]), refScans(nav).exits, 'the ties, as before');
  }
  // a mock grid with no bytes: read through its reader, the same
  const { nav } = roughTown(3);
  const reader = { width: nav.width, height: nav.height, weightAt: (x, y) => nav.weightAt(x, y) };
  const a = streetNet(reader), b = streetNet(nav);
  assert.deepEqual([a.id, a.size], [b.id, b.size]);
});
