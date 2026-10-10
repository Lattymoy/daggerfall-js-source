// AUDIT LW-II-2 (2026-10-10, the second audit of THE LIVING WORLD II): THE OUTLAWS, AUDITED AGAIN - LW12's band chest,
// its hideout stood and let go, its election, its origin, and the laws the first audit's pins left unheld. Every fixture
// the real producers' (test/lwRoads.mjs livingMap with its real fate, outlaws.js's hideouts and bands, hideouts.js's
// chest over townTrips and the shops' own roll); the host's wiring swept or lifted from world.js. Synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap } from './lwRoads.mjs';
import { hideoutsOf, bandTrouble, outlawBandAt, genAt, bandPeople, takeOf, TAKE_DAYS, TAKE_PURSE_SHARE, ROB_GOLD, BAND_ERA_DAYS } from '../src/systems/livingWorld/outlaws.js';
import { townTrips, newsOf, NEWS_DAYS, CALENDAR_MPM, NATIVE_PER_M } from '../src/systems/livingWorld/trips.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { createHideouts, createHideoutBook, bandChest, chestPiece, CHEST_SLICE_MS, BAND_KEEP_M, BAND_LIVE_M, HIDEOUTS_ASK_MS } from '../src/scenes/hideouts.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { purseOf, CARAVAN_QUALITY } from '../src/systems/livingWorld/caravanDoor.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { goldStack } from '../src/systems/inventory.js';
import { isBagItem } from '../src/net/bagLaw.js';
import { isSurvivalItem } from '../src/systems/survival/items.js';
import { lwRng, textSeed } from '../src/systems/livingWorld/seed.js';
import { amGroupRollOwner } from '../src/systems/campEncounters.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { yardStock } from '../src/systems/merchantYards.js';   // MERCHANT-YARDS: where the horse, the cart and the wagons are sold now

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const PLAYER = { level: 5 };

/** The synthetic map with its region's hideouts and their bands holding the road up, as the host composes them. */
function realMap() {
  const map = livingMap({});
  map.world.townsIn = (r) => map.towns.filter((t) => t.region === r);
  const hs = hideoutsOf(17, map.world) ?? [];
  map.trouble.bandAt = (trip, px, py, t) => bandTrouble(trip, px, py, t, hs);
  return { map, hs, o: { mpm: CALENDAR_MPM, memo: new Map() } };
}
/** The chest's deps as world.js's livingBandChest wires them (swept in P5), over the synthetic map. */
const chestDeps = (map, o, onRead = () => {}) => ({
  townOf: (id) => map.byId.get(id),
  tripsOf: (town, at) => { onRead(town, at); return townTrips(town, at, map.world, o); },
  shelf: (q) => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, PLAYER, q),
  gold: (n) => goldStack(n),
});
const drain = (gen) => { for (;;) { const r = gen.next(); if (r.done) return r.value; } };
const names = (items) => items.map((it) => `${it.group}:${it.name}:${it.stackCount ?? 1}`);
const goodsOf = (c) => c.items.filter((it) => it.group !== 'Currency');

/** Each band of the map that robbed parties of late, the first minute found: its band, minute and take - the first one
 *  robbed parties of BOTH its leg's towns, before today, a pedlar among them (the fixture P5 and P11 read). */
let _takes = null;
function takes() {
  if (_takes) return _takes;
  const { map, hs, o } = realMap();
  const out = [];
  for (const h of hs) {
    for (let day = 300; day < 420; day += 3) {
      const t = day * DAY_MIN + 600;
      const band = outlawBandAt(h, t);
      if (!band || out.some((x) => x.band.key === band.key && x.full)) continue;
      const whole = [], today = [];
      for (let d = 0; d <= TAKE_DAYS; d++) for (const id of [h.a, h.b]) { const trs = townTrips(map.byId.get(id), t - d * DAY_MIN, map.world, o) ?? []; whole.push(...trs); if (!d) today.push(...trs); }
      const take = takeOf(band, whole, t);
      if (!take.robbed.length) continue;
      const full = take.robbed.some((tr) => tr.from.mapId === h.a) && take.robbed.some((tr) => tr.from.mapId === h.b)
        && takeOf(band, today, t).robbed.length < take.robbed.length && take.robbed.some((tr) => tr.kind === 'pedlar');
      if (!out.some((x) => x.band.key === band.key) || full) out.push({ h, band, t, take, full });
    }
  }
  return (_takes = { map, hs, o, list: out, full: out.find((x) => x.full) ?? null });
}

/** A hideouts host over one real hideout, its deps recorded (lw12's hostOver over the real producers). */
function hostAt(h, { bandAt, t, chest, rel = createRelations(), relations = null, owner = () => true, engaged, now, renderer, getTexture, meshes, spawn = null } = {}) {
  const log = { spawned: [], removed: [], piles: [], removedPiles: [], said: [] };
  const clock = { t, here: { x: h.x + 50 * NATIVE_PER_M, z: h.z } };
  const deps = {
    hideoutsNear: () => [h], bandAt, clock: () => clock.t, here: () => clock.here, ready: () => true, owner: (feet) => owner(feet),
    sceneOf: (nx, nz) => [nx / NATIVE_PER_M, 0, nz / NATIVE_PER_M],
    spawn: spawn ?? ((type, feet, o) => { const rec = { type, feet, o, dead: false, entity: {} }; log.spawned.push(rec); return Promise.resolve(rec); }),
    remove: (rec) => log.removed.push(rec), inPool: (rec) => log.spawned.includes(rec) && !log.removed.includes(rec),
    relations: relations ?? (() => rel), say: (s) => log.said.push(s), chest,
    dropPile: (items, feet) => { const pile = { items: [...items], feet: [...feet] }; log.piles.push(pile); return pile; },
    removePile: (p) => log.removedPiles.push(p),
    engaged, now, renderer, getTexture, meshes, uploadRecordFrame: () => {},
  };
  return { host: createHideouts(deps), log, clock, rel, deps };
}
const tick = async (host, n = 1) => { for (let i = 0; i < n; i++) { host.frame(1.01); host.frame(0); await new Promise((r) => setImmediate(r)); } };
/** The map's first hideout, standing its band at a noon. */
function standing() {
  const f = takes();
  const h = f.hs[0];
  let t = 300 * DAY_MIN + 720;
  while (!outlawBandAt(h, t)) t += DAY_MIN;
  return { ...f, h, t, band: outlawBandAt(h, t) };
}

test('AUDIT LW-II-2 C4: a band\'s chest holds none of a general store\'s fixed pieces - no Transportation (the horse, the cart, the wagons), no Materials Bag, no provisions or Campfires - but goods DRAWN on the band\'s seed off its back shelf\'s own draws: the same chest each time it is stood, two bands\' chests apart, never the roll\'s first pieces (mutants: the pieces, the shelf, the draw, the seed)', () => {
  // the store's fixed pieces as its counter shelf mints them (online, where the bag is)
  const where = globalThis.location;
  let counter;
  try { globalThis.location = { search: '?online' }; counter = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, PLAYER, { rolls: lwRng(7, 7) }); } finally { globalThis.location = where; }
  const fixed = counter.filter((it) => it.group === 'Transportation' || isBagItem(it) || isSurvivalItem(it));
  // PIN MOVED (MERCHANT-YARDS, main's #748, at the merge): the General Store sells no horse, cart or wagon any more - the
  // town's Stable and Wagon Yard do (systems/merchantYards.js) - so its fixed pieces are the bag and the provisions; the
  // chest's Transportation guard stands should a store's roll ever carry one again (its mutant recorded equivalent)
  assert.deepEqual(['Transportation', 'bag', 'survival'].map((k) => fixed.some((it) => (k === 'bag' ? isBagItem(it) : k === 'survival' ? isSurvivalItem(it) : it.group === k))), [false, true, true]);
  assert.equal(counter.filter((it) => it.group === 'Transportation').length, 0, 'the horse, the cart and the wagons are the yards\' now');
  const yards = [...yardStock('stable'), ...yardStock('transport')];
  assert.ok(yards.length >= 4 && yards.every((it) => it.group === 'Transportation'), 'the yards mint the horse, the cart and the wagons');
  for (const it of yards) assert.equal(chestPiece(it), false, `${it.name}: never a band's, whoever stocks it`);
  for (const it of fixed) assert.equal(chestPiece(it), false, `${it.name} is the store's, never a band's`);
  const draws = counter.filter((it) => !fixed.includes(it) && /Weapons|Clothing|Books/.test(it.group));
  assert.ok(draws.length > 5 && draws.every(chestPiece), 'its own draws');
  // the real chests of every band that robbed: their goods off the back shelf's roll on the band's seed, drawn
  const { map, o, list } = takes();
  assert.ok(new Set(list.map((x) => x.band.key)).size >= 2, `${list.length} bands with a take`);
  const firstN = [];
  const seen = new Map();
  for (const { band, t, take } of list) {
    const asked = [];
    const deps = chestDeps(map, o);
    const c = drain(bandChest(band, t, { ...deps, shelf: (q) => { asked.push(q.shelfIndex); return deps.shelf(q); } }));
    assert.deepEqual(asked, [1], 'a back shelf\'s roll: none of the counter\'s pieces');
    const goods = goodsOf(c);
    assert.equal(goods.length, take.goods);
    assert.ok(goods.every((it) => it.group !== 'Transportation' && !isBagItem(it) && !isSurvivalItem(it)), `${band.key}: ${names(goods)}`);
    const roll = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, PLAYER, { rolls: lwRng(textSeed(band.key), 0x63687374), shelfIndex: 1 }).filter(chestPiece);
    const left = names(roll);
    for (const n of names(goods)) { const i = left.indexOf(n); assert.ok(i >= 0, `${n}: off the band's own roll`); left.splice(i, 1); }
    firstN.push(names(goods).join() === names(roll.slice(0, goods.length)).join());
    assert.deepEqual(names(goodsOf(drain(bandChest(band, t, chestDeps(map, o))))), names(goods), 'the same chest each time it is stood');
    if (!seen.has(band.key)) seen.set(band.key, names(goods).join());
  }
  assert.ok(firstN.some((x) => !x), 'drawn, never the roll\'s first pieces');
  assert.equal(new Set(seen.values()).size, seen.size, 'two bands\' chests apart');
});

test('AUDIT LW-II-2 P5: the real chest (hideouts.js bandChest, world.js livingBandChest) - its take over the troubled trips of its leg\'s TWO towns these TAKE_DAYS + 1 days (takeOf\'s robbed, a stack of take.gold, take.goods of goods); the host wiring it so, standing a band over the character\'s routs, and the hideouts about the player the regions\' of the towns within eight pixels (mutants: the gold, the days, the towns, the routs, the radius)', () => {
  const { map, o, full } = takes();
  assert.ok(full, 'a band that robbed parties of both its towns, before today');
  const { h, band, t, take } = full;
  const c = drain(bandChest(band, t, chestDeps(map, o)));
  assert.deepEqual(c.robbed.map((tr) => tr.id), take.robbed.map((tr) => tr.id), 'its robbed: both towns, every day of the fortnight');
  assert.ok(c.robbed.some((tr) => tr.from.mapId === h.b) && c.robbed.some((tr) => tr.from.mapId === h.a));
  assert.ok(take.gold > 0);
  assert.deepEqual(c.items.filter((it) => it.group === 'Currency').map((it) => it.stackCount), [take.gold], 'the gold, one stack');
  assert.equal(goodsOf(c).length, take.goods);
  // the host's wiring - the chest, the stood band, the hideouts near
  assert.match(WORLD, /const livingBandChest = \(band, t\) => bandChest\(band, t, \{\n\s*townOf: \(id\) => livingTownOfId\(id\),\n\s*tripsOf: \(town, at\) => tripsOfTown\(town, at, livingTripWorld, livingTripO\(\)\),\n\s*shelf: \(o\) => stockShopShelf\(\{ buildingType: TALK_BUILDING_TYPES\.GeneralStore, quality: 10 \}, playerEntity, o\),\n\s*gold: \(n\) => goldStack\(n\),\n\s*\}\);/);
  assert.match(WORLD, /\n\s*chest: livingBandChest,\n/);
  assert.match(WORLD, /\n\s*bandAt: \(h, t\) => outlawBandAt\(h, t, livingRouts\(\)\),\n\s*clock: \(\) => skyMinutes\(\),/);
  assert.match(WORLD, /const livingHideoutsNear = \(x, z\) => \{\n\s*const px = Math\.floor\(x \/ 32768\), py = 499 - Math\.floor\(z \/ 32768\);\n\s*const regions = new Set\(livingTripWorld\.townsNear\(px, py, 8\)\.map\(\(t\) => t\.region \| 0\)\);\n\s*return \[\.\.\.regions\]\.flatMap\(\(r\) => livingHideoutsOf\(r\)\);/);
});

test('AUDIT LW-II-2 C5: the chest\'s take is never read in the frame that stands the hideout - worked from the next frame a slice a frame (CHEST_SLICE_MS, a town-day a step) and its pile laid once done: the take\'s minting, C2\'s measure (untouched not looted, a piece taken looted); a rout before it is done reads the rest for its thanks (mutants: the stand frame, the slice, the lay, the rout)', async () => {
  assert.equal(CHEST_SLICE_MS, 3);
  const { map, o, full } = takes();
  const { h, band, t } = full;
  const whole = drain(bandChest(band, t, chestDeps(map, o)));
  let ms = 0, reads = 0;
  const { host, log, rel } = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, now: () => ms,
    chest: (b, at) => bandChest(b, at, chestDeps(map, o, () => { reads++; ms += 2; })) });   // a town-day read: two of the clock's ms
  host.frame(1.01);
  assert.equal(host.shown()?.band, band.key, 'stood');
  assert.deepEqual([reads, host.shown().pile], [0, false], 'the stand frame reads no trip');
  const per = [];
  for (let i = 0; i < 60 && !host.shown().pile; i++) { const r0 = reads; host.frame(0.01); per.push(reads - r0); }
  assert.equal(reads, 2 * (TAKE_DAYS + 1), 'its fortnight read whole, once');
  assert.ok(per.length >= TAKE_DAYS && per.every((n) => n <= 2), `a slice a frame: ${per}`);
  assert.equal(host.shown().pile, true, 'laid once done');
  assert.deepEqual(names(log.piles[0].items), names(whole.items), 'the take\'s chest');
  host.frame(0.01);
  assert.equal(rel.turns().looted.has(band.key), false, 'laid late, untouched: not looted');
  log.piles[0].items.pop();
  host.frame(0.01);
  assert.ok(rel.turns().looted.has(band.key), 'a piece taken: looted');
  // routed before its chest was worked: its robbed thanked all the same
  let slow = 0;
  const r = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, now: () => slow, chest: (b, at) => bandChest(b, at, chestDeps(map, o, () => { slow += 100; })) });
  r.host.frame(1.01);
  await new Promise((res) => setImmediate(res));
  r.log.spawned.forEach((rec) => { rec.dead = true; rec.corpse = true; });
  r.host.frame(1.01);
  assert.equal(r.host.shown().routed, true);
  const day = Math.floor((t - 240) / DAY_MIN);
  assert.ok(whole.robbed.length >= 2 && whole.robbed.every((tr) => tr.party.every((m) => r.rel.regard(m.id, day) > 0)), 'its robbed thank the player');
});

test('AUDIT LW-II-2 P11: the take - a pedlar\'s robbery puts a quarter of its counter\'s purse in it (TAKE_PURSE_SHARE), never ROB_GOLD; the rout\'s `helped` regard from every member of EVERY party robbed, and the hideout stood again empty for the character (the host\'s routs); two hideouts in reach, the NEAREST standing a band takes the trouble; the leader a Nightblade, a Barbarian or a Rogue, each (mutants: the counter kinds, the thanks, the nearest, the leader)', async () => {
  const { map, o, hs, full } = takes();
  const { h, band, t, take } = full;
  const quarter = (tr) => Math.round(purseOf(CARAVAN_QUALITY(tr)) * TAKE_PURSE_SHARE);
  const pedlars = take.robbed.filter((tr) => tr.kind === 'pedlar');
  assert.ok(pedlars.length >= 1);
  for (const tr of pedlars) {
    assert.notEqual(quarter(tr), ROB_GOLD);
    assert.equal(takeOf(band, [tr], t).gold, quarter(tr), `${tr.id}: its counter's quarter`);
  }
  // routed: every party robbed thanks the player, then its hideout stands empty for them
  const rel = createRelations();
  const { host, log, clock } = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at, rel.turns().routed), t, rel, now: () => 0, chest: (b, at) => bandChest(b, at, chestDeps(map, o)) });
  await tick(host);
  assert.equal(host.shown().pile, true);
  log.spawned.forEach((rec) => { rec.dead = true; rec.corpse = true; });
  await tick(host);
  assert.equal(host.shown().routed, true);
  const day = Math.floor((t - 240) / DAY_MIN);
  assert.ok(take.robbed.length >= 2);
  for (const tr of take.robbed) for (const m of tr.party) assert.ok(rel.regard(m.id, day) > 0, `${m.id} of ${tr.id} thanks the player`);
  clock.here = { x: h.x + (BAND_KEEP_M + 10) * NATIVE_PER_M, z: h.z };
  await tick(host);
  clock.t = t + 60;
  clock.here = { x: h.x + 50 * NATIVE_PER_M, z: h.z };
  await tick(host);
  assert.deepEqual([host.shown()?.key, host.shown()?.band], [h.key, null], 'stood again: empty for the one who routed it');
  // the nearest: a second hideout a pixel off, its key after the first's - both standing a band
  const h0 = hs[0], near = { ...h0, key: 'O17.9', px: h0.px + 1 };
  let tb = 300 * DAY_MIN;
  for (let i = 0; i < 4000 && !(outlawBandAt(h0, tb) && outlawBandAt(near, tb)); i++) tb += DAY_MIN;
  assert.ok(outlawBandAt(h0, tb) && outlawBandAt(near, tb));
  const ids = [...Array(80)].map((_, i) => `L1000.t${i}:7`);
  const atNear = ids.map((id) => bandTrouble({ id }, near.px, near.py, tb, [h0, near])).filter(Boolean);
  const atFirst = ids.map((id) => bandTrouble({ id }, h0.px, h0.py, tb, [h0, near])).filter(Boolean);
  assert.ok(atNear.length > 0 && atNear.every((g) => g.band.hideout.key === 'O17.9'), 'the nearer band, whatever its key');
  assert.ok(atFirst.length > 0 && atFirst.every((g) => g.band.hideout.key === h0.key));
  // the leader's three classes
  const leaders = new Set();
  for (let g = 0; g < 300; g++) leaders.add(bandPeople(h0, `${h0.key}~${g}`)[0].cls);
  assert.deepEqual([...leaders].sort((a, b) => a - b), [MOBILE_TYPES.Nightblade, MOBILE_TYPES.Barbarian, MOBILE_TYPES.Rogue].sort((a, b) => a - b));
});

test('AUDIT LW-II-2 P2: genAt\'s eras kept per hideout, read out of order - a minute an era on read first, then the earlier one - answer as a fresh reader\'s first read does (online: the band\'s key, name and people every reader\'s) (mutants: the cache\'s reset)', async () => {
  const fresh = await import(`../src/systems/livingWorld/outlaws.js?auditlwii2-p2=${Date.now()}`);
  const { hs } = takes();
  const era = BAND_ERA_DAYS * DAY_MIN;
  let differs = 0;
  for (let i = 0; i < 60; i++) {
    const h = { ...hs[0], key: `O${300 + i}.0` };
    const early = 405 * 360 * DAY_MIN + (i % 5) * 9 * DAY_MIN;
    const late = genAt(h, early + era);
    const got = genAt(h, early);
    const want = fresh.genAt(h, early);
    assert.deepEqual(got, want, `${h.key}`);
    if (late.gen !== got.gen) differs++;
  }
  assert.ok(differs > 0, 'eras with a rout between them');
});

test('AUDIT LW-II-2 C13: online one reader stands a band\'s people - one who loses the election gives them up (its living taken out, `owned` dropped, a body still coming taken out as it comes) and takes them up again when it falls back; the host\'s election counts the peers within BAND_KEEP_M of the camp, so one standing it from past BAND_LIVE_M and one walking up agree (mutants: the give-up, the coming, the filter)', async () => {
  const { map, o, h, t, band } = standing();
  const chest = (b, at) => bandChest(b, at, chestDeps(map, o));
  let mine = true;
  const { host, log } = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, owner: () => mine, now: () => 0, chest });
  await tick(host);
  const n = band.people.length;
  assert.equal(host.shown().foes, n);
  mine = false;
  await tick(host);
  assert.deepEqual([host.shown()?.foes, host.shown()?.tents > 0, log.removed.length], [0, true, n], 'given up, its camp every reader\'s still');
  await tick(host);
  assert.equal(log.spawned.length, n, 'nothing stood meanwhile');
  mine = true;
  await tick(host);
  assert.deepEqual([host.shown().foes, log.spawned.length], [n, 2 * n], 'taken up again');
  // a body still coming when the election moved: taken out as it comes
  const pend = [], made = [];
  let mine2 = true;
  const c = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, owner: () => mine2, now: () => 0, chest,
    spawn: () => new Promise((res) => pend.push(() => { const rec = { dead: false, entity: {} }; made.push(rec); c.log.spawned.push(rec); res(rec); })) });
  c.host.frame(1.01);
  assert.equal(pend.length, n);
  mine2 = false;
  c.host.frame(1.01);
  pend.forEach((go) => go());
  await new Promise((res) => setImmediate(res));
  assert.deepEqual([c.host.shown().foes, c.log.removed.length], [0, n], 'came after it was given up: taken out');
  // the election as the host reads it (world.js livingHideoutOwner, lifted): one at 250 m standing it, one walking up
  const src = /const livingHideoutOwner = (\(feet\) => [^\n]*);\n/.exec(WORLD)?.[1];
  assert.ok(src, 'the host\'s election');
  const election = new Function('amGroupRollOwner', 'online', 'player', 'peersNear', 'BAND_KEEP_M', 'BAND_LIVE_M', `return ${src};`);
  const camp = [0, 0, 0];
  const a = { id: 'a', feet: [250, 0, 0] }, b = { id: 'b', feet: [100, 0, 0] };
  const owns = (me, peers) => election(amGroupRollOwner, { id: me.id }, { feetAt: () => me.feet }, () => peers, BAND_KEEP_M, BAND_LIVE_M)(camp);
  assert.deepEqual([owns(a, [b]), owns(b, [a])], [true, false], 'one of them stands its people');
  assert.equal(owns(b, [{ id: 'a', feet: [BAND_KEEP_M + 1, 0, 0] }]), true, 'one past BAND_KEEP_M is none of it');
});

test('AUDIT LW-II-2 C14: an outlaw drawing on the player holds its hideout past BAND_KEEP_M (none let go under it); the session keeps a band\'s struck-down by its key - stood again, the rest stand, and the last of them down routs it, struck even in the second it was left; another character\'s records keep none; the host\'s `engaged` the pool\'s own cull\'s spare (mutants: the hold, the kept, the filter, the last blow, the character, the wire)', async () => {
  const { map, o, h, t, band } = standing();
  const chest = (b, at) => bandChest(b, at, chestDeps(map, o));
  const n = band.people.length;
  const far = { x: h.x + (BAND_KEEP_M + 40) * NATIVE_PER_M, z: h.z }, near = { x: h.x + 50 * NATIVE_PER_M, z: h.z };
  // held while one draws on the player
  const A = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, now: () => 0, chest, engaged: (rec) => !!rec.onMe });
  await tick(A.host);
  A.log.spawned[0].onMe = true;
  A.clock.here = far;
  await tick(A.host, 2);
  assert.deepEqual([!!A.host.shown(), A.log.removed.length], [true, 0], 'held: the one at the player\'s heels stays');
  A.log.spawned[0].onMe = false;
  await tick(A.host);
  assert.deepEqual([A.host.shown(), A.log.removed.length], [null, n], 'let go once none draws on the player');
  // the struck-down kept by the band's key
  const B = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at, B.rel.turns().routed), t, now: () => 0, chest });
  await tick(B.host);
  B.log.spawned.slice(0, 2).forEach((rec) => { rec.dead = true; rec.corpse = true; });
  await tick(B.host);
  B.log.spawned.slice(0, 2).forEach((rec) => { rec.corpse = false; });   // their bodies taken up since (C3's latch)
  B.clock.here = far;
  await tick(B.host);
  assert.equal(B.host.shown(), null);
  B.clock.here = near;
  await tick(B.host);
  const again = B.log.spawned.slice(n);
  assert.deepEqual(again.map((rec) => rec.living.outlaw), band.people.slice(2).map((p) => p.id), 'the rest stand - never the struck-down again whole');
  assert.equal(B.host.shown().foes, n - 2);
  // the last of them down in the second it was left: routed when stood again
  again.forEach((rec) => { rec.dead = true; rec.corpse = true; });
  B.clock.here = far;
  await tick(B.host);
  assert.equal(B.rel.turns().routed.size, 0, 'left before the rout was read');
  B.clock.here = near;
  await tick(B.host, 2);
  assert.deepEqual([B.host.shown()?.routed, B.rel.turns().routed.size, B.log.spawned.length], [true, 1, 2 * n - 2], 'every one down: routed, nobody stood');
  // another character's records: none of the last's struck-down
  let cur = createRelations();
  const D = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, now: () => 0, chest, relations: () => cur });
  await tick(D.host);
  D.log.spawned.slice(0, 3).forEach((rec) => { rec.dead = true; rec.corpse = true; });
  await tick(D.host);
  cur = createRelations();
  await tick(D.host, 2);
  assert.equal(D.host.shown().foes, n, 'a load: the band stands whole for the loaded character');
  // the host's `engaged`: the pool's own cull spares such a foe
  assert.match(WORLD, /\n\s*engaged: \(f\) => !!f\.ai\?\.detected && f\.ai\.targetIsLocalPlayer !== false,/);
  assert.match(read('src/scenes/exteriorFoes.js'), /!\(f\.ai\.detected && f\.ai\.targetIsLocalPlayer !== false\)/);
});

test('AUDIT LW-II-2 H2: the hideout follows the streaming origin - offsetAll moves its tents and its fire\'s centre, its fire\'s batch minted again there (the old one freed, its frame kept), and a chest laid after lands at the moved centre; the host\'s recentre block calls it beside the camps (mutants: the tents, the centre, the batch, the wire)', async () => {
  const { map, o, full } = takes();
  const { h, t } = full;   // a band with a take: its chest laid
  const made = [], freed = [];
  const renderer = {
    createBillboardBatch: (archive, record, size, centers) => { const bb = { archive, record, centers: centers.map((c) => [...c]), frame: null }; made.push(bb); return bb; },
    destroyBillboardBatch: (bb) => freed.push(bb),
  };
  const getTexture = () => Promise.resolve({ getFrameCount: () => 1, getSize: () => ({ width: 8, height: 16 }) });
  const meshes = { getGpuMesh: () => Promise.resolve({}) };
  let ms = 0;
  const { host, log } = hostAt(h, { bandAt: (x, at) => outlawBandAt(x, at), t, now: () => ms, renderer, getTexture, meshes,
    chest: (b, at) => bandChest(b, at, chestDeps(map, o, () => { ms += 100; })) });   // a town-day a frame: laid long after
  host.frame(1.01);
  await new Promise((r) => setImmediate(r));
  const tentsAt = () => { const out = []; host.draw({ drawMesh: (g, m) => out.push([m[12], m[14]]) }); return out; };
  const centre = [h.x / NATIVE_PER_M, 0, h.z / NATIVE_PER_M];
  const before = tentsAt();
  assert.ok(before.length >= 2);
  const fire = host.batches()[0];
  assert.deepEqual(fire?.centers, [centre]);
  fire.frame = 3;
  const off = [-819.2, 0, 409.6];
  host.offsetAll(off);
  const after = tentsAt();   // the draw's matrix is single precision: to a few cm at a pixel 113 east
  assert.ok(after.length === before.length && after.every(([x, z], i) => Math.abs(x - before[i][0] - off[0]) < 0.05 && Math.abs(z - before[i][1] - off[2]) < 0.05), `its tents moved: ${after} from ${before}`);
  const moved = [centre[0] + off[0], centre[1] + off[1], centre[2] + off[2]];
  assert.deepEqual([freed, made.length], [[fire], 2], 'the old batch freed, one minted');
  assert.deepEqual([host.batches()[0], host.batches()[0].centers, host.batches()[0].frame], [made[1], [moved], 3], 'the fire at the moved centre, its frame kept');
  for (let i = 0; i < 80 && !host.shown().pile; i++) host.frame(0.01);
  assert.equal(host.shown().pile, true);
  assert.deepEqual(log.piles[0].feet, moved, 'its chest laid at the moved centre');
  host.clear();
  assert.deepEqual(freed, [fire, made[1]], 'the let-go frees the batch it holds');
  const a = WORLD.indexOf('    const r = state.update(cam.pos);'), b = WORLD.indexOf('    if (r.pixelChanged) {', a);
  assert.ok(a > 0 && b > a);
  assert.match(WORLD.slice(a, b), /\n\s*_livingHideoutsHost\?\.offsetAll\(r\.offset\);[^\n]*\n\s*camps\.offsetAll\(r\.offset\);/, 'the recentre block, beside the camps');
});

test('AUDIT LW-II-2 H9: a teleport lets the stood hideout go beside the camps, before the new frame begins - it stood a second in the new frame, its tents and chest the old one\'s (mutants: the free)', () => {
  const a = WORLD.indexOf('  async function _teleportToPixel('), b = WORLD.indexOf('\n  }\n', a);
  assert.ok(a > 0 && b > a);
  const body = WORLD.slice(a, b);
  const free = body.indexOf('\n    _livingHideoutsHost?.clear();\n'), camps = body.indexOf('\n    camps.destroyAll();\n'), init = body.indexOf('queue.push(...state.init(px, py));');
  assert.ok(free > 0 && camps > 0 && init > 0, 'the hideout let go in the teleport');
  assert.ok(free < init && Math.abs(free - camps) < 1200, 'beside the camps, before state.init');
});

test('AUDIT LW-II-2 H3: the trouble world\'s `resolved` (a region\'s bands found late) makes LW16\'s kept word again with the fates and the memo - its told trips, its visitors and its carried visits, B11\'s last word kept and told meanwhile - so a late reader\'s towns tell the news the early one\'s do (the host\'s news read and `resolved` lifted from world.js over AUDIT LW-II C8\'s two readers) (mutants: the told, the visitors, the carried, the last)', () => {
  const res = /const livingHideoutsOf = createHideoutBook\(\{[\s\S]*?\n\s*resolved: (\(\) => \{[^\n]*\}),\n/.exec(WORLD)?.[1];
  assert.ok(res, 'the host\'s resolved');
  const resolvedOf = new Function('_livingFates', '_livingTripMemo', '_livingToldKept', '_livingVisitorsKept', '_livingCarried', '_livingCarriedLast', `return ${res};`);
  // what it makes again, and what it keeps
  const maps = [0, 1, 2, 3, 4, 5].map((i) => new Map([[`k${i}`, i === 4 ? { visits: ['word'], map: 77 } : i]]));
  resolvedOf(...maps)();
  assert.deepEqual(maps.slice(0, 5).map((m) => m.size), [0, 0, 0, 0, 0], 'fates, memo, told, visitors, carried made again');
  assert.deepEqual([...maps[5]], [['k5', 5], [77, ['word']]], 'B11\'s last word kept - the worked word told while it is worked again');
  // the host's news read over C8's two readers
  const a0 = WORLD.indexOf('  const livingRoadNewsAt = (town, t, o) => {'), b0 = WORLD.indexOf('\n  };\n', a0);
  assert.ok(a0 > 0 && b0 > a0);
  const newsSrc = WORLD.slice(a0, b0 + 5);
  const T = (mapId, px, py, blocks) => ({ mapId, px, py, blocks, type: 0, region: 17, people: 3, name: `T${mapId}`, port: false });
  const straight = (p, q) => {
    const k = Math.max(Math.abs(p.px - q.px), Math.abs(p.py - q.py));
    const pixels = [];
    for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(p.px + ((q.px - p.px) * i) / k), y: Math.round(p.py + ((q.py - p.py) * i) / k) });
    return { pixels, kinds: pixels.slice(1).map(() => 'road') };
  };
  const T0 = 405 * 360 * DAY_MIN;
  const reader = (plannedAfter) => {
    const towns = [T(901, 100, 100, 24), T(902, 108, 100, 20), T(903, 104, 106, 6), T(904, 112, 104, 8)];
    const rosters = new Map();
    const livingTripWorld = {
      townsNear: (px, py, r) => towns.filter((x) => Math.max(Math.abs(x.px - px), Math.abs(x.py - py)) <= r).sort((p, q) => p.mapId - q.mapId), routeOf: straight,
      rosterOf: (x) => { let r = rosters.get(x.mapId); if (!r) { r = travellerRoster(x); rosters.set(x.mapId, r); } return r; },
      templeTown: (x) => x.blocks >= 16, dryAt: () => true, townsIn: () => towns,
    };
    let n = 0, now = 0;
    const legWorld = { ...livingTripWorld, routeOf: (p, q) => (n < plannedAfter ? undefined : straight(p, q)) };
    const kept = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map()];
    const [_livingFates, _livingTripMemo, _livingToldKept] = kept;
    const hideouts = createHideoutBook({ of: (r) => { n++; return hideoutsOf(r, legWorld); }, generation: () => 0, now: () => (now += HIDEOUTS_ASK_MS), resolved: resolvedOf(...kept) });
    const tw = { climateAt: () => 0, foesOf: ({ size }) => Array(size).fill(10), bandAt: (trip, px, py, at) => bandTrouble(trip, px, py, at, hideouts(17)) };
    livingTripWorld.fate = (trip) => { let f = _livingFates.get(trip.id); if (!f) { f = troubledTrip(trip, troubleOf(trip, tw)); _livingFates.set(trip.id, f); } return f; };
    const livingRelations = { turns: () => ({ won: new Set() }) };
    const newsAt = new Function('townTrips', 'livingTripWorld', 'NEWS_DAYS', 'newsOf', 'livingRelations', 'livingFoeWord', '_livingToldKept', `${newsSrc}\n  return livingRoadNewsAt;`)(
      townTrips, livingTripWorld, NEWS_DAYS, newsOf, livingRelations, (f) => `foe${f}`, _livingToldKept);
    const o = { mpm: CALENDAR_MPM, memo: _livingTripMemo };
    const news = new Map();
    for (let pass = 0; pass < 2; pass++) {
      for (let day = 0; day < 120; day++) {
        for (const town of [towns[2], towns[3]]) {
          const noon = T0 + day * DAY_MIN + 720;
          townTrips(town, noon, livingTripWorld, o);   // the roads' read of the day (the band's book asked)
          const got = newsAt(town, noon, o);
          if (pass === 1) news.set(`${town.mapId}:${day}`, got.news.map((x) => `${x.kind}:${x.foe}`).join('|'));
        }
      }
    }
    return news;
  };
  const early = reader(0), late = reader(10);
  const bandWord = (v) => v.split('|').some((x) => x && !/:foe\d+$/.test(x));
  assert.ok([...early.values()].some(bandWord), 'the band in the early reader\'s news');
  assert.deepEqual([...late].filter(([k, v]) => early.get(k) !== v), [], 'the late reader\'s towns tell the same news');
});
