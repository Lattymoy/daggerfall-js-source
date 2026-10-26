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
import { createCityGuards, MAX_ACTIVE_GUARD_SPAWNS } from '../../../src/scenes/cityGuards.js';
import { watchStep, WATCH_WAIT } from '../../../src/scenes/livingWorld/livingWatch.js';
import { synthTown } from '../../lwTown.mjs';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { createRelations, EVENTS, HAND_KINDS } from '../../../src/systems/livingWorld/relations.js';
import { handDeath, turnKey, placeAt } from '../../../src/systems/livingWorld/lives.js';
import { KILLED_NEWS, newsScript } from '../../../src/systems/livingWorld/lines.js';
import { townCensus, mintResident } from '../../../src/systems/livingWorld/census.js';
import { validFoeRecord, LIVING_ID_RE, RELAY_VERSION } from '../../../src/net/wire.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';
import { uninstallSurvivalLoot } from '../../../src/systems/survival/loot.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
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
  assert.equal(RELAY_VERSION, 'world264');   // PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD's world260, #1281's world261 and #1238's world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world183, CHAP4c (the chapters' seats' titles on the token - past THE WROTHGARIAN ZONE's world177, TAVERN CARDS' world178, HOURS-FIRST's world179, TAVERN-TABLES' world180, TV-BEYOND's world181 and CARDS10's world182 at the merges); PIN MOVED (SERPENT3's merge of main): the `lr` came with WATCH-FIX's world172; SERPENT3 moved it on (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST's and WATCH-FIX's at the merges); PIN MOVED (Project Legacy's merge of main): LEGACY7 after it (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's and SERPENT3's at the merge); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED; PIN MOVED (the Super Dungeons arc's merge of main): SUPER-DUNGEONS after that (world176, a re-laid dungeon's room of its own and the Super dungeon's frame - world171 on its branch, renumbered past CRYSTAL-FIST's at one merge and past WATCH-FIX's, SERPENT3's and LEGACY7's at the next)
  for (const r of townCensus(TOWN, synthTown().buildings)) assert.ok(LIVING_ID_RE.test(r.id), `${r.id}: every id the census mints rides`);
  assert.ok(LIVING_ID_RE.test(mintResident(TOWN, 't', 3, 'merchant', { gen: 170 }).id), 'a newcomer\'s too');
  assert.deepEqual(validFoeRecord({ i: 3, t: 146, lr: 'L12345.w0' }), { i: 3, t: 146, lr: 'L12345.w0' });
  assert.equal(validFoeRecord({ i: 3, t: 146, lr: 'Robert\'); DROP' }), null, 'a record with a bad name is refused whole');
  assert.equal(validFoeRecord({ i: 3, t: 146, lr: 7 }), null);
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.match(xf, /if \(onWatch && typeof f\.livingFrom\?\.id === 'string' && LIVING_ID_RE\.test\(f\.livingFrom\.id\)\) r\.lr = f\.livingFrom\.id;/, 'the writer: a watch record, its resident\'s id');
  assert.match(xf, /f\.livingId = typeof r\.lr === 'string' \? r\.lr : null;/, 'the reader: the puppet carries it');
  const w = hostText('src/scenes/world.js');
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
  const w = hostText('src/scenes/world.js');
  assert.match(w, /live: \(\(living\) => \(\) => _streetHolds\(person, living\)\)\(person\.living\),/);
  assert.match(w, /if \(it\) return !!it\.active && \(person\.living \?\? null\) === \(living \?\? null\);/);
  assert.match(w, /const livingWatchStep = \(\) => watchStep\(_livingWatchTurned, cityGuards\.guards, \{ resolve: livingResidentOf, localOf: livingLocalOf \}\);/);
  assert.match(w, /if \(livingWorldOn\(\)\) \{ livingWatchStep\(\); livingPeerWatchStep\(\); \}/);
  assert.match(w, /slay: livingSlay, killed: livingKilled,/);
  assert.match(w, /if \(!turns\.slain\.size && !turns\.died\.size && !turns\.killed\.size\) return false;/);
  assert.match(rd('src/scenes/exterior.js'), /live: \(\) => !!population\?\.pool\.find\(\(i\) => i\.person === person\)\?\.active,/);
  assert.match(rd('src/systems/roleplayRealism/rrRidingHost.js'), /g\.livingFrom = from; chargeFoe\(g, fwd\);/, 'the trample\'s guard marked as before');
  const bible = rd('bible/06-Systems/Living-World.md');
  const sec = bible.slice(bible.indexOf('## WATCH-FIX'), bible.indexOf('\n## ', bible.indexOf('## WATCH-FIX') + 5));
  for (const host of ['world.js', 'worldModes.js', 'exterior.js', 'dungeonContext.js']) assert.ok(sec.includes(host), `the record names ${host}`);
});
