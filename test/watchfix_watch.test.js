// WATCH-FIX (2026-10-05, Mac: "improve the guards"; bible/06-Systems/Living-World.md WATCH-FIX): THE WATCH'S OWN BUGS.
// The investigation's four, each pinned here on the real pool (scenes/cityGuards.js, a synthesised career) and the
// synthetic town (test/lwTown.mjs):
//   - A FALSE SLAIN: the turned watch read any `dead` as a kill, so the watch walking off when the crime cleared slew the
//     resident by the player's hand (the palace household turned, the witnesses' crime). Now the guard's END decides -
//     a body the player's own blow made (`killedBy`), a body another hand made, or none at all.
//   - THE IDENTITY LOST: a watchman the crime response, the minute's sweep or the summons turned carried no mark, so he
//     was taken for the day and his guard was nobody's - cut down, he walked his beat the next morning. Every
//     conversion is one law now (turnNpc), its guard marked; the resident is LENT to it and comes back to his day when
//     it walks away; a load keeps the mark by id.
//   - THE CAP RACE: DFU's crime response is one synchronous member; here every stand awaits, so two calls interleaved -
//     the second read the cap before the first's guards landed, and turned the same walker again. The calls take turns,
//     a walker is claimed across the await, and one already taken is never turned.
//   - ONLINE, TWO OF HIM: another player's watchman rode the stream while his resident walked the reader's street. The
//     record names him now (`lr`, world172) and the reader's town takes him off its street while it stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCityGuards, MAX_ACTIVE_GUARD_SPAWNS } from '../src/scenes/cityGuards.js';
import { watchStep, WATCH_WAIT } from '../src/scenes/livingWatch.js';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations, EVENTS, HAND_KINDS } from '../src/systems/livingWorld/relations.js';
import { handDeath, turnKey, placeAt } from '../src/systems/livingWorld/lives.js';
import { KILLED_NEWS, newsScript } from '../src/systems/livingWorld/lines.js';
import { townCensus, mintResident } from '../src/systems/livingWorld/census.js';
import { validFoeRecord, LIVING_ID_RE, RELAY_VERSION } from '../src/net/wire.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { uninstallSurvivalLoot } from '../src/systems/survival/loot.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

// ---- the real guard pool, its career synthesised (cityguards.test.js's own stub) --------------------------------------
function stubClassCfg() {
  const b = new Uint8Array(80);
  const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
/** A fetch that is let go of by hand: the first watchman of a session waits on CLASS18.CFG - the window the race ran in. */
function heldFetch() {
  const waiting = [];
  return { fetchBytes: () => new Promise((resolve) => waiting.push(() => resolve(stubClassCfg()))), release: () => { for (const go of waiting.splice(0)) go(); } };
}
function pool({ fetchBytes = async () => stubClassCfg(), crime = 5 } = {}) {
  uninstallSurvivalLoot();
  const player = { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 }, crimeCommitted: crime, legalRep: {} };
  return createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes,
    getTexture: async () => ({ getFrameCount: () => 4, getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {}, currentMinute: () => 523530, playerEntity: player, audio: null, onPlayerHurt: () => {}, rand: () => 0.9,
  });
}
/** A street walker as the hosts hand one: its body (`person`, with the living world's identity when it is a resident),
 *  `live()` its row still on the street, `disable()` the street taking it. */
function walker(pos, { guard = true, living = null } = {}) {
  const w = { person: { living }, on: true, disabled: 0 };
  return Object.assign(w, { pos, fwdYaw: 0, guard, live: () => w.on, disable: () => { w.on = false; w.disabled++; } });
}
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

test('WATCH-FIX the cap race: two crimes in one breath on the same street - the second call waits its turn, reads the cap with the first call\'s watch standing and turns nobody the first took; a walker claimed across the stand\'s await is never turned twice; a call whose world was swept while it waited stands nobody; a summons waiting its turn counts (mutants: the turn, the claim, the street\'s read, the sweep, the summons waiting)', async () => {
  const held = heldFetch();
  const g = pool({ fetchBytes: held.fetchBytes });
  const street = [walker([5, 0, 5]), walker([-6, 0, 4]), walker([3, 0, -7])];
  const a = g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: street });
  const b = g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: street });   // the same pool, read in the same frame
  await flush();
  held.release();
  await Promise.all([a, b]);
  assert.deepEqual(street.map((w) => w.disabled), [1, 1, 1], 'each walker turned once');
  // DFU's answer, as one synchronous member after another: the first call turns the three; the second finds them gone
  // and its fallback stands two to five more (rand 0.9: five). Interleaved, both calls turned all three - six watchmen
  // out of three walkers - before either fell back.
  assert.equal(g.activeCount(), 3 + 5, 'three turned, then the second call\'s fallback - never the walkers twice');
  // the cap read after the first call's watch landed: three standing, the first call's fallback stands five more - eight,
  // past the cap (HowManyEnemiesOfType <= maxActiveGuardSpawns), so the second stands none. Interleaved it read three
  const c = pool({ fetchBytes: held.fetchBytes });
  for (let i = 0; i < 3; i++) c.guards.push({ dead: false, defender: false, ai: { isHostile: true }, entity: { team: 'PlayerEnemy' } });
  const c1 = c.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  const c2 = c.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  await flush(); held.release(); await Promise.all([c1, c2]);
  assert.equal(MAX_ACTIVE_GUARD_SPAWNS, 5);
  assert.equal(c.activeCount(), 3 + 5, 'the first call\'s five; the second reads eight standing and stands none');
  // AUDIT DISC19's law across the turn: a summons waiting behind a crime's stand is a squad on its way to the town watch
  const d = pool({ fetchBytes: held.fetchBytes });
  const crime = d.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  const summons = d.summonDefenders({ playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [], threats: [{ ai: { feet: [8, 0, 8] }, dead: false }] });
  assert.equal(d.defenderCount(), 1, 'waiting its turn, and counted');
  await flush(); held.release(); await Promise.all([crime, summons]);
  assert.equal(d.defenderCount(), d.guards.filter((x) => x.defender && !x.dead).length, 'landed, and counted once');
  // a walker claimed by a swing's conversion is not the sweep's too
  const s = pool({ fetchBytes: held.fetchBytes });
  s.guards.push({ dead: false, defender: false, ai: { isHostile: true }, entity: { team: 'PlayerEnemy' } });   // a watchman standing, so the sweep runs
  const one = walker([4, 0, 4]);
  const swing = s.resolveCivilianHit({ weapon: null }, [0, 1.6, 0], [4 / Math.hypot(4, 1.6, 4), -1.6 / Math.hypot(4, 1.6, 4), 4 / Math.hypot(4, 1.6, 4)], [0, 0, 0], [one]).catch(() => null);
  const sweep = s.makeNpcGuardsIntoEnemies({ pool: [one], playerFeet: [0, 0, 0] });
  await flush(); held.release(); await Promise.all([swing, sweep]);
  assert.equal(one.disabled, 1, 'one walker, one watchman');
  assert.equal(s.guards.length, 2, 'the swing\'s alone');
  // swept mid-call and while waiting: the first call's fallback is standing its five when the world goes; the second
  // waits its turn behind it
  const w = pool({ fetchBytes: held.fetchBytes });
  const w1 = w.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  const w2 = w.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  await flush();
  w.clearLive();   // a fast travel: the town both calls were for is gone
  held.release(); await Promise.all([w1, w2]); await flush();
  assert.equal(w.activeCount(), 0, 'nothing of a swept world stands in the next - neither the rest of the first call\'s nor the second\'s');
});

test('WATCH-FIX the conversion is one law: every arm turns a walker through turnNpc - the immediate arm, the witness arm, the minute\'s sweep, the town watch\'s summons and the swing - the guard marked with the resident\'s identity as it was turned; a walker another arm took (`live()` false) is never turned; the guard\'s end says whose hand (mutants: the mark, the street\'s read, whose hand)', async () => {
  const g = pool();
  const id = { id: 'L12345.w0', res: { id: 'L12345.w0', guard: true }, town: {} };
  const w = walker([5, 0, 5], { living: id });
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [w] });
  assert.equal(g.guards[0].livingFrom, id, 'the guard stands for the resident, by the identity he was turned with');
  const gone = walker([6, 0, 6]);
  gone.on = false;   // the street took him already
  const before = g.guards.length;
  await g.makeNpcGuardsIntoEnemies({ pool: [gone], playerFeet: [0, 0, 0] });
  assert.equal(g.guards.length, before, 'a walker no longer on the street is never turned');
  assert.equal(gone.disabled, 0);
  // whose hand: the player's blow, a foe's, a peer's
  const [p] = g.guards;
  g.hurtGuard(p, 9999, [0, 0, 0], null);
  assert.deepEqual([p.dead, p.corpse, p.killedBy], [true, true, 'player']);
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [walker([7, 0, 7])] });
  const q = g.guards.find((x) => !x.dead);
  q.hurtFromFoe(9999, null);
  assert.equal(q.killedBy, 'other', 'a beast\'s blow is no deed of the player\'s');
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [walker([8, 0, 8])] });
  const r = g.guards.find((x) => !x.dead);
  g.hurtGuard(r, 9999, [0, 0, 0], null, { fromPlayer: false, peer: true });
  assert.equal(r.killedBy, 'peer');
  // every arm through the one law, and none of them turning a walker by hand
  const cg = rd('src/scenes/cityGuards.js');
  assert.equal((cg.match(/await turnNpc\(/g) ?? []).length, 5, 'the immediate arm, the witness arm, the sweep, the summons, the swing');
  assert.doesNotMatch(cg, /await spawnGuardAt\(p\.pos, p\.fwdYaw, playerFeet \?\? null\);\n\s*p\.disable\(\);/, 'no arm turns a walker by hand');
  assert.match(cg, /if \(claimed\.has\(who\) \|\| p\.live\?\.\(\) === false\) return null;/);
});

test('WATCH-FIX a load keeps whom a guard stands for: the snapshot names the resident by id, the restore marks the guard with it (mutants: the snapshot\'s id, the restore\'s mark)', async () => {
  const g = pool();
  const id = { id: 'L12345.w1', res: null, town: null };
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [walker([5, 0, 5], { living: id })] });
  const snap = g.snapshotWorld((p) => ({ x: p[0], z: p[2] }));
  assert.equal(snap[0].living, 'L12345.w1');
  const h = pool();
  h.restoreWorld(snap, (x, z) => [x, z]);
  await flush();
  assert.deepEqual(h.guards[0].livingFrom, { id: 'L12345.w1', res: null, town: null });
  const anon = pool();
  await anon.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [walker([5, 0, 5])] });
  assert.equal('living' in anon.snapshotWorld((p) => ({ x: p[0], z: p[2] }))[0], false, 'one who stands for nobody saves none');
});

// ---- the town and the follower -------------------------------------------------------------------------------------
function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };   // 10:00, the day shift on
  const rel = createRelations();
  const kills = [], slays = [];
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, relations: () => rel,
    slay: (res, t, seen) => slays.push({ id: res.id, t, seen }), killed: (res, t) => kills.push({ id: res.id, t }), ...extra,
  });
  return { town, clock, rel, kills, slays };
}
/** Run `seconds` at 30 frames a second, the player at `at`. */
function run(t, seconds, at, yaw = 0) { for (let i = 0; i < Math.round(seconds * 30); i++) { t.clock.t += RATE / 30; t.town.update(1 / 30, at, yaw, at, true); } }
/** One of the watch on the street with the player beside him: his resident, his row, where the player stands. */
function watchmanOnStreet(t) {
  const day = t.town.dayOf(t.clock.t);
  for (const res of t.town.peopleOf(day).filter((r) => r.guard)) {
    let w = null;
    for (let k = 0; k < 200 && (!w || w.pending); k++) { w = t.town.where(res, t.clock.t, true); t.town._paths.run(); }
    if (!w || w.pending) continue;
    const at = [w.x + 1, 0, w.z];
    run(t, 1, at);
    const row = t.town.pool.find((r) => r.res?.id === res.id && r.visible);
    if (row) return { res, row, at };
  }
  return null;
}
/** The host's own take of a walker (world.js _guardPool's disable): the row let go where it stands. */
const streetTakes = (row) => { row.person.release(); row.active = false; row.scheduleEnable = false; row.scheduleRecycle = false; row.visible = false; };
const onStreet = (t, res) => t.town.pool.some((r) => r.res?.id === res.id && r.active);

test('WATCH-FIX the walk-away: a watchman the crime turned is LENT to his guard - off the street, never taken for the day - and when the guard walks off with the crime he is BACK on his beat; no deed, no regard moved (mutants: the lend, the take undone, the back, the census\'s skip, the body read as a kill)', () => {
  const t = makeTown();
  const got = watchmanOnStreet(t);
  assert.ok(got, 'one of the watch on his beat');
  const { res, row, at } = got;
  const turned = [];
  const guard = { livingFrom: row.person.living, dead: false, corpse: false, ai: { feet: [0, 0, 0] } };
  const guards = [guard];
  streetTakes(row);   // the conversion: his body gone from the street, a guard stood in his place
  run(t, 0.5, at);   // the census reads the disabled row first - taken, as the first cut left him
  watchStep(turned, guards);
  assert.equal(turned.length, 1, 'his guard followed');
  run(t, 2, at);
  assert.equal(onStreet(t, res), false, 'with the watch: not on the street');
  assert.equal(t.town._taken.has(res.id), false, 'and not taken for the day');
  // the crime clears: the watch walks away (no body)
  guard.dead = true;
  watchStep(turned, guards);
  guards.length = 0;   // spliced (no corpse)
  assert.equal(turned.length, 0);
  assert.equal(t.town._lent.has(res.id), false);
  run(t, 8, at, Math.PI);   // a full street: he comes on as a row frees out of the player's sight (the census's own rule) - the player turned
  assert.ok(onStreet(t, res), 'back on his beat');
  assert.deepEqual([t.slays, t.kills], [[], []], 'nobody slain, nobody killed');
  for (const kin of t.town.kinOf(res)) assert.equal(t.rel.regard(kin.id, t.town.dayOf(t.clock.t)), 0, `${kin.id}: nothing turned`);
  // the other order: lent before the census reads the disabled row
  const t2 = makeTown();
  const g2 = watchmanOnStreet(t2);
  const guard2 = { livingFrom: g2.row.person.living, dead: false, corpse: false };
  streetTakes(g2.row);
  const turned2 = [];
  watchStep(turned2, [guard2]);
  run(t2, 1, g2.at);
  assert.equal(t2.town._taken.has(g2.res.id), false, 'lent first: the census never takes him');
  guard2.dead = true;
  watchStep(turned2, []);
  run(t2, 8, g2.at, Math.PI);
  assert.ok(onStreet(t2, g2.res), 'and back');
});

test('WATCH-FIX the ends: the player\'s own blow SLAYS him (the town\'s deed, once, however long the body lies); another hand KILLS him - dead for good, nobody\'s regard moved; one the conversion took who is not of the watch steps back whatever his guard\'s end (mutants: whose hand, the corpse, the watch\'s alone, the follow once, the killed)', () => {
  const t = makeTown();
  const { res, row, at } = watchmanOnStreet(t);
  const day = t.town.dayOf(t.clock.t);
  const guard = { livingFrom: row.person.living, dead: false, corpse: false, ai: { feet: [at[0], 0, at[2]] } };
  const guards = [guard];
  streetTakes(row);
  const turned = [];
  watchStep(turned, guards);
  guard.dead = true; guard.corpse = true; guard.killedBy = 'player';
  for (let i = 0; i < 5; i++) watchStep(turned, guards);   // the body lies in the list, beat after beat
  assert.equal(t.slays.length, 1, 'slain once');
  assert.equal(t.slays[0].id, res.id);
  for (const kin of t.town.kinOf(res)) {   // his household turned, once - and one who saw it (his patrol's mate beside him) counts the crime too
    const r = t.rel.regard(kin.id, day);
    assert.ok(r === EVENTS.slain || r === EVENTS.slain + EVENTS.crime, `${kin.id}: his household turned, once (${r})`);
  }
  run(t, 2, at);
  assert.equal(onStreet(t, res), false, 'dead: never back');
  // another hand
  const u = makeTown();
  const w = watchmanOnStreet(u);
  const ug = { livingFrom: w.row.person.living, dead: false, corpse: false, ai: { feet: [w.at[0], 0, w.at[2]] } };
  streetTakes(w.row);
  const ut = [];
  watchStep(ut, [ug]);
  ug.dead = true; ug.corpse = true; ug.killedBy = 'other';
  watchStep(ut, [ug]);
  assert.deepEqual(u.slays, [], 'no deed of the player\'s');
  assert.deepEqual(u.kills.map((k) => k.id), [w.res.id], 'killed - the turn the host makes');
  for (const kin of u.town.kinOf(w.res)) assert.equal(u.rel.regard(kin.id, u.town.dayOf(u.clock.t)), 0, `${kin.id}: nobody turned`);
  run(u, 2, w.at);
  assert.equal(onStreet(u, w.res), false);
  assert.equal(u.town._taken.get(w.res.id), u.town.dayOf(u.clock.t), 'off the street');
  // one not of the watch, turned by the witness arm's quirk: his guard cut down by the player is never his death
  const v = makeTown();
  const day3 = v.town.dayOf(v.clock.t);
  const baker = v.town.peopleOf(day3).find((r) => !r.guard);
  const bakerGuard = { livingFrom: { id: baker.id, res: baker, town: v.town }, dead: false, corpse: false, ai: { feet: [0, 0, 0] } };
  const vt = [];
  watchStep(vt, [bakerGuard]);
  assert.ok(v.town._lent.has(baker.id), 'he stepped aside');
  bakerGuard.dead = true; bakerGuard.corpse = true; bakerGuard.killedBy = 'player';
  watchStep(vt, [bakerGuard]);
  assert.deepEqual([v.slays, v.kills], [[], []], 'not his death');
  assert.equal(v.town._lent.has(baker.id), false, 'back to his day');
});

test('WATCH-FIX a load\'s guard knows only the id: found by it and lent; one never found is let be after WATCH_WAIT beats (mutants: the resolve)', () => {
  assert.equal(WATCH_WAIT, 600);
  const t = makeTown();
  const day = t.town.dayOf(t.clock.t);
  const watch = t.town.peopleOf(day).find((r) => r.guard);
  const g = { livingFrom: { id: watch.id, res: null, town: null }, dead: false };
  const turned = [];
  const resolve = (id) => { const res = t.town.residentOf(id); return res ? { town: t.town, res } : null; };
  watchStep(turned, [g], { resolve });
  assert.ok(t.town._lent.has(watch.id), 'found by id and lent');
  assert.equal(t.town.residentOf('L12345.w99'), null);
  const lost = { livingFrom: { id: 'L12345.w99', res: null, town: null }, dead: false };
  const lt = [];
  for (let i = 0; i <= WATCH_WAIT; i++) watchStep(lt, [lost], { resolve });
  assert.equal(lt.length, 0, 'never found: let be');
});

test('WATCH-FIX the town\'s side: `killed` a hand death of its own kind - the lives empty the place from that minute, the town tells it (one of the watch\'s words, or the town\'s), the save keeps it; a resident with the watch is in no room either (mutants: the kind, the hand read, the news, the room\'s skip)', () => {
  assert.deepEqual(HAND_KINDS, ['slain', 'died', 'killed']);
  const rel = createRelations();
  const res = mintResident(TOWN, 'w', 0, 'guard');
  assert.ok(rel.turn('killed', turnKey(res, 7), { t: 1234, who: res.name }));
  assert.equal(handDeath(res, 7, rel.turns()), 1234, 'dead from that minute');
  assert.equal(placeAt(res, 7, rel.turns()).hand, 1234);
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  assert.equal(back.turns().killed.get(turnKey(res, 7))?.t, 1234, 'the save keeps it');
  assert.ok(KILLED_NEWS.watch.length && KILLED_NEWS.town.length);
  const told = newsScript(0, [{ kind: 'killed', who: 'Ada', watch: true }, { kind: 'killed', who: 'Ada', watch: true }]);
  if (told) assert.ok(KILLED_NEWS.watch.includes(told.script), 'one of the watch, told as one');
  // the town's news of it
  const t = makeTown();
  const watch = t.town.peopleOf(t.town.dayOf(t.clock.t)).find((r) => r.guard);
  t.rel.turn('killed', turnKey(watch, 0), { t: t.clock.t, who: watch.name });
  const news = t.town.deedNews(t.clock.t + 61);
  assert.deepEqual(news.map((n) => [n.kind, n.who, n.watch]), [['killed', watch.name, true]]);
  // a resident with the watch stands in no room
  const k = makeTown();
  const room = synthTown().buildings.map((b) => ({ key: b.key, in: k.town.insideAt(b.key, k.clock.t) })).find((x) => x.in.length);
  assert.ok(room, 'someone indoors at ten in the morning');
  const who = room.in[0].res;
  k.town.lend(who);
  assert.equal(k.town.insideAt(room.key, k.clock.t).some((x) => x.res.id === who.id), false, 'lent: out of the room');
  k.town.back(who);
  assert.ok(k.town.insideAt(room.key, k.clock.t).some((x) => x.res.id === who.id), 'back: in it again');
});

test('WATCH-FIX online: the watch\'s record names the resident its watchman stands for (`lr`, the census\'s id - world172), a reader\'s town takes him off its street while the record stands and has him back when it goes (mutants: the wire\'s word, the writer, the reader, the town\'s skip, its free, the host\'s set)', () => {
  assert.equal(RELAY_VERSION, 'world175');   // PIN MOVED (SERPENT3's merge of main): the `lr` came with WATCH-FIX's world172; SERPENT3 moved it on (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST's and WATCH-FIX's at the merges); PIN MOVED (Project Legacy's merge of main): LEGACY7 after it (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's and SERPENT3's at the merge); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED)
  for (const r of townCensus(TOWN, synthTown().buildings)) assert.ok(LIVING_ID_RE.test(r.id), `${r.id}: every id the census mints rides`);
  assert.ok(LIVING_ID_RE.test(mintResident(TOWN, 't', 3, 'merchant', { gen: 170 }).id), 'a newcomer\'s too');
  assert.deepEqual(validFoeRecord({ i: 3, t: 146, lr: 'L12345.w0' }), { i: 3, t: 146, lr: 'L12345.w0' });
  assert.equal(validFoeRecord({ i: 3, t: 146, lr: 'Robert\'); DROP' }), null, 'a record with a bad name is refused whole');
  assert.equal(validFoeRecord({ i: 3, t: 146, lr: 7 }), null);
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.match(xf, /if \(onWatch && typeof f\.livingFrom\?\.id === 'string' && LIVING_ID_RE\.test\(f\.livingFrom\.id\)\) r\.lr = f\.livingFrom\.id;/, 'the writer: a watch record, its resident\'s id');
  assert.match(xf, /f\.livingId = typeof r\.lr === 'string' \? r\.lr : null;/, 'the reader: the puppet carries it');
  const w = rd('src/scenes/world.js');
  assert.match(w, /for \(const f of exteriorFoes\.foes\) if \(f\.puppet && typeof f\.livingId === 'string'\) _livingPeerWatch\.add\(f\.livingId\);\n\s*for \(const p of built\.values\(\)\) p\.population\?\.peerLend\?\.\(_livingPeerWatch\);/, 'the host tells every town');
  // the reader's town
  const t = makeTown();
  const { res, at } = watchmanOnStreet(t);
  t.town.peerLend(new Set([res.id]));
  assert.equal(onStreet(t, res), false, 'his row free at once - the peer\'s guard stands where he stood');
  run(t, 2, at);
  assert.equal(onStreet(t, res), false, 'and kept off while the record stands');
  t.town.peerLend(new Set());
  run(t, 8, at, Math.PI);
  assert.ok(onStreet(t, res), 'the record gone: back on his beat');
  assert.equal(t.town._taken.has(res.id), false, 'never taken');
});

test('WATCH-FIX the hosts: the street\'s pool reads each walker\'s row - and, the living town\'s, the resident it was read as; the turned watch is followed every frame in the lane, its resident found by id and his fall placed in his town\'s frame; the town is handed `killed` and the lives read it; the fixed-city page\'s pool reads its row too; the record names all four hosts (mutants: the street\'s read, the identity read, the follower unstepped, the killed unread)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /live: \(\(living\) => \(\) => _streetHolds\(person, living\)\)\(person\.living\),/);
  assert.match(w, /if \(it\) return !!it\.active && \(person\.living \?\? null\) === \(living \?\? null\);/);
  assert.match(w, /const livingWatchStep = \(\) => watchStep\(_livingWatchTurned, cityGuards\.guards, \{ resolve: livingResidentOf, localOf: livingLocalOf \}\);/);
  assert.match(w, /if \(livingWorldOn\(\)\) \{ livingWatchStep\(\); livingPeerWatchStep\(\); \}/);
  assert.match(w, /slay: livingSlay, killed: livingKilled,/);
  assert.match(w, /if \(!turns\.slain\.size && !turns\.died\.size && !turns\.killed\.size\) return false;/);
  assert.match(rd('src/scenes/exterior.js'), /live: \(\) => !!population\?\.pool\.find\(\(i\) => i\.person === person\)\?\.active,/);
  assert.match(rd('src/systems/rrRidingHost.js'), /g\.livingFrom = from; chargeFoe\(g, fwd\);/, 'the trample\'s guard marked as before');
  const bible = rd('bible/06-Systems/Living-World.md');
  const sec = bible.slice(bible.indexOf('## WATCH-FIX'), bible.indexOf('\n## ', bible.indexOf('## WATCH-FIX') + 5));
  for (const host of ['world.js', 'worldModes.js', 'exterior.js', 'dungeonContext.js']) assert.ok(sec.includes(host), `the record names ${host}`);
});
