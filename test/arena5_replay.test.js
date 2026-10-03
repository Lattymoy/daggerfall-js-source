// ARENA5 (2026-10-03): YOUR LADDER REPLAY, DRIVEN (bible/11-Multiplayer/Arena.md 2, the Spectate row - offline: "exhibitions,
// your ladder replay"). The recording's law (systems/arenaReplay.js - ten ticks a second of each fighter's feet, facing
// and health as closed-loop byte deltas with standing runs folded, the law's events and the strikes; bounded and
// measured); the record through the save's arena record (systems/save.js - versioned, an older save none, a broken one
// none, the newest three kept); a ladder bout played through headless records itself and keeps its replay at the
// healers (scenes/arenaBouts.js beginRecording / recordFrame / keepRecording - never the pit's, an exhibition's or a bout
// left before its verdict); the replay played back through the relay's own mirror (askReplay / replayFrame / replayFeed
// - puppets on the recorded walks, the Herald's call from the records, the HUD, the crowd, the verdict - paying nothing,
// counting nothing, holding no gate); offered by the Herald and the Records page (systems/arenaHerald.js,
// systems/arenaBoard.js recordsPage, scenes/arenaGate.js windowAct) and both hosts' doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as RP from '../src/systems/arenaReplay.js';
import { createArenaBouts, YOU, ARENA_PUPPET_OWNER } from '../src/scenes/arenaBouts.js';
import { newArenaLadder, nextLadderBout, exhibitionFor, practiceBout } from '../src/systems/arenaLadder.js';
import * as LG from '../src/systems/arenaLeague.js';
import { heraldChoice } from '../src/systems/arenaHerald.js';
import { recordsPage } from '../src/systems/arenaBoard.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const at = (day, hour = 12) => (405 * 360 + day) * MINUTES_PER_DAY + hour * 60;
const F2 = [{ id: 'you', name: 'Hero', side: 0, mobile: 145, gender: 'female', home: '', epithet: '', health: 100, maxHealth: 100 }, { id: 'f0', name: 'Gorlak', side: 1, mobile: 138, gender: 'male', home: 'Wayrest', epithet: 'the Red', health: 40, maxHealth: 40 }];
const NEXT = { tier: 0, bout: 0, label: 'bout 1 of 3', tierName: 'The Pit', champion: false, grand: false, free: false, beasts: false };

/** A recording of `secs` seconds, `fighters` circling the centre (every tick moving and turning), finished. */
function circling(fighters, secs) {
  const R = RP.newRecording({ t0: 0, fighters, next: NEXT, sides: ['red', null], at: at(40) });
  for (let t = 0; t <= secs * 1000; t += 33) {
    const poses = fighters.map((_, i) => { const a = t / 900 + i * 2; return [Math.cos(a) * (5 + i), Math.sin(a) * (5 + i), a + Math.PI / 2]; });
    RP.recordTick(R, t, poses, fighters.map((f) => [Math.max(1, f.health - t / 4000), f.maxHealth]));
  }
  return RP.finishRecording(R, { side: 0, how: 'fall' });
}

test('ARENA5 the recording: ten ticks a second, the feet a tenth of a metre and the facing a 256th of a turn, closed on its own output - the decode is the quantized poses exactly; a fighter standing still costs a run, not a tick (mutants: ARENA5-REPLAY-DRIFT, ARENA5-REPLAY-RUN-DROPPED, ARENA5-REPLAY-TICK-RATE)', () => {
  const R = RP.newRecording({ t0: 1000, fighters: F2, next: NEXT, sides: ['red', null], at: at(40) });
  const want = [];
  for (let k = 0; k < 50; k++) {
    const t = 1000 + k * RP.REPLAY_TICK_MS + 5;
    const poses = [[k * 0.234, -k * 0.11, k * 0.07], k < 20 ? [3, 0, Math.PI] : [3 + (k - 20) * 0.3, 0.5, Math.PI]];   // the second stands still twenty ticks
    RP.recordTick(R, t, poses, [[100, 100], [40 - k * 0.5, 40]]);
    want.push(poses.map(([x, z, y]) => [Math.round(x / 0.1) + 0, Math.round(z / 0.1) + 0, ((Math.round((y / (Math.PI * 2)) * 256) % 256) + 256) % 256]));
  }
  assert.equal(R.ticks, 50, 'one sample a tick');
  const rec = RP.finishRecording(R, { side: 0, how: 'fall' });
  assert.equal(rec.n, 50);
  assert.deepEqual(RP.decodePoses(rec), want, 'decoded, the quantized poses - no drift');
  // the standing run folded: twenty ticks of the second fighter standing cost a few bytes
  const bytes = RP.fromBase64(rec.d);
  assert.equal(bytes.length, 49 * 3 + 2 + 30 * 3, 'the first fighter a triple a tick; the second\'s nineteen standing ticks one run, then its thirty moving');
  assert.ok([...bytes].some((b) => b === 128), 'the run marker in the stream');
  // health logged only when its share moves
  assert.deepEqual(rec.hp0, [255, 255]);
  assert.ok(rec.hp.length > 0 && rec.hp.length % 3 === 0 && rec.hp.filter((_, i) => i % 3 === 1).every((i) => i === 1), 'only the hurt fighter\'s');
  // a jump past a byte's reach (a fighter set down twenty metres off): the stream catches up a tick later, closed on its own
  // output - an open loop would leave the decode short of it for good
  const J = RP.newRecording({ t0: 0, fighters: F2.slice(0, 1) });
  for (const [k, x] of [[0, 0], [1, 20], [2, 20], [3, 20]]) RP.recordTick(J, k * 100, [[x, 0, 0]]);
  assert.deepEqual(RP.decodePoses(RP.finishRecording(J)).map((p) => p[0][0]), [0, 127, 200, 200]);
  // a long frame's missed ticks carry the pose; past the cap it stops
  const L = RP.newRecording({ t0: 0, fighters: F2.slice(0, 1) });
  RP.recordTick(L, 1000, [[1, 1, 0]]);
  assert.equal(L.ticks, 11, 'a second at ten a second, its first tick included');
  RP.recordTick(L, RP.REPLAY_MAX_TICKS * RP.REPLAY_TICK_MS + 5000, [[2, 2, 0]]);
  assert.equal(L.ticks, RP.REPLAY_MAX_TICKS);
  assert.equal(L.full, true, 'past four minutes: kept to there');
});

test('ARENA5 the record\'s size, measured: a one-on-one bout of three minutes and a Grand Melee\'s four fighters for the whole four, every fighter moving every tick, both under REPLAY_BYTES_MAX; three kept stay a small part of a save (mutant: ARENA5-REPLAY-CAP)', () => {
  const duel = circling(F2, 200);
  const melee = circling([...F2, { ...F2[1], id: 'f1' }, { ...F2[1], id: 'f2' }], 250);
  const bd = RP.replayBytes(duel), bm = RP.replayBytes(melee);
  assert.ok(bd < 24_000, `a duel's record ${bd} bytes`);
  assert.ok(bm <= RP.REPLAY_BYTES_MAX, `a Grand Melee's worst ${bm} bytes`);
  assert.equal(melee.n, RP.REPLAY_MAX_TICKS, 'capped at four minutes');
  assert.ok(RP.replayOk(melee) && RP.replayOk(duel));
  console.log(`# replay bytes: duel 200 s ${bd}, melee capped ${bm}`);
});

test('ARENA5 the law\'s events and the strikes kept: each event its time to a hundredth, its kind, its fighters by place, the fields it does not carry left off; a strike a fighter in 300 ms (mutants: ARENA5-REPLAY-EVENT-IDS, ARENA5-REPLAY-STRIKE-GAP)', () => {
  const R = RP.newRecording({ t0: 1000, fighters: F2 });
  RP.recordEvent(R, { k: 'call', at: 1000 });
  RP.recordEvent(R, { k: 'count', at: 2500, n: 2 });
  RP.recordEvent(R, { k: 'hit', at: 3004, a: 'f0', b: 'you', dmg: 12 });
  RP.recordEvent(R, { k: 'verdict', at: 9000, side: null, how: 'judges' });
  RP.recordEvent(R, { k: 'nonsense', at: 9100 });
  assert.deepEqual(R.ev, [[0, 0], [150, 3, -1, -1, 0, 2], [200, 5, 1, 0, 12], [800, RP.REPLAY_EVENTS.indexOf('verdict'), -1, -1, 0, -9, -1, 'judges']]);
  RP.recordStrike(R, 3000, 'you'); RP.recordStrike(R, 3200, 'you'); RP.recordStrike(R, 3350, 'you'); RP.recordStrike(R, 3210, 'f0'); RP.recordStrike(R, 3300, 'nobody');
  assert.deepEqual(R.k, [200, 0, 235, 0, 221, 1]);
  assert.equal(RP.playerMobileOf({ career: { name: 'Knight' } }), MOBILE_TYPES.Knight);
  assert.equal(RP.playerMobileOf({ career: { name: 'My Own Thing' } }), MOBILE_TYPES.Warrior, 'a career of one\'s own: the Warrior');
});

test('ARENA5 the save\'s arena record carries the replays: versioned, the newest three kept, read back whole; a save from before ARENA5 and any broken record none (mutants: ARENA5-REPLAY-SAVE-DROPPED, ARENA5-REPLAY-KEEP, ARENA5-REPLAY-VALIDATE)', () => {
  const recs = [1, 2, 3, 4].map((k) => ({ ...circling(F2, 5), at: at(40 + k) }));
  let list = [];
  for (const r of recs) list = RP.keepReplay(list, r);
  assert.deepEqual(list.map((r) => r.at), [at(44), at(43), at(42)], 'the newest three, newest first');
  const entity = { name: 'Hero', items: [], arenaLadder: newArenaLadder(), arenaReplays: list };
  const snap = snapshotPlayer(entity, {});
  assert.equal(snap.arena.replays.length, 3);
  assert.equal(snap.arena.replays[0].v, RP.REPLAY_VERSION, 'versioned inside its own shape');
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.arenaReplays, JSON.parse(JSON.stringify(list)), 'read back whole');
  assert.deepEqual(RP.decodePoses(back.arenaReplays[0]), RP.decodePoses(list[0]));
  // a save from before ARENA5: none
  const old = JSON.parse(JSON.stringify(snap));
  delete old.arena.replays;
  const b2 = {};
  restorePlayer(b2, old);
  assert.deepEqual(b2.arenaReplays, []);
  assert.equal(b2.arenaLadder.v, 1, 'the ladder read as ever');
  // broken records: each dropped, the good kept
  const bad = [{ ...list[0], v: 2 }, { ...list[0], d: list[0].d.slice(0, -4) }, { ...list[0], f: [] }, { ...list[0], n: list[0].n + 1 }, 'junk', null, list[1]];
  assert.deepEqual(RP.arenaReplaysRestore(bad).map((r) => r.at), [list[1].at]);
  assert.deepEqual(RP.arenaReplaysRestore('junk'), []);
  assert.equal(RP.keepReplay(list, { v: 1 }).length, 3, 'a broken record is never kept');
});

/** A bout driver over a fake floor: the bodies it stands kept, its words, its notices, its pay. */
function rig(P) {
  let t = 1000;
  const log = { say: [], notice: [], pay: [], hud: [], cues: [] };
  const foes = [];
  const stage = {
    kind: 'floor', centre: () => [10, 0, 20],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null, yaw: o.yaw ?? 0 } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => 8,
  };
  const renderer = { createBillboardBatch: (a, r, size, at2) => ({ archive: a, record: r, size, at: at2, tint: undefined }), destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, gameMinutes: () => at(40) + Math.floor((t - 1000) / 1000), renderer, getTexture,   // the game's clock runs through a bout
    say: (l) => log.say.push(l), notice: (ls) => log.notice.push(...ls), pay: (g) => log.pay.push(g), heal: () => { P.health = P.maxHealth; },
    drawHud: (m) => log.hud.push(m), sound: { cue: (l) => log.cues.push(...l.map((c) => c.s)), bed: () => {}, stop: () => {} },
  });
  const step = (ms, o = {}) => { t += ms; A.frame(ms / 1000, { playerFeet: [6, 0, 20], playerYaw: 1, sheathed: false, ...o }); };
  return { A, P, foes, stage, log, step, now: () => t };
}
/** A ladder bout fought to my opponent's fall and the healers. */
async function fightOne(r) {
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  await settle();
  for (let i = 0; i < 300 && r.A.bout()?.phase !== 'fight'; i++) r.step(100);
  const f = r.foes[0];
  r.A.playerSwing(1);
  f.entity.bout.hooks.hurt(f, 10, { fromPlayer: true });
  f.entity.health = 30;
  r.step(100);
  f.ai.feet[0] += 1.5;
  for (let k = 1; k <= 5; k++) r.step(100, { playerFeet: [6 + k * 0.3, 0, 20] });   // I close on him
  r.step(100);
  f.entity.health = 1; f.entity.bout.out = true; f.entity.bout.hooks.floor(f);
  for (let i = 0; i < 200 && r.A.bout()?.phase !== 'done'; i++) r.step(100);
}

test('ARENA5 a ladder bout records itself and keeps its replay at the healers: my fighter as the class enemy of my career, its opponent, the bout, my banner\'s half, the game minute its verdict wrote (its Records row); the call, the fight, my swing, the blow, the fall and the verdict in it - never the pit\'s, an exhibition\'s, or a bout left before its verdict (mutants: ARENA5-REC-NOT-BEGUN, ARENA5-REC-NOT-KEPT, ARENA5-REC-PRACTICE, ARENA5-REC-EVENTS, ARENA5-REC-SWING, ARENA5-REC-ROW-MINUTE)', async () => {
  const P = { name: 'Hero', gender: 'female', career: { name: 'Knight' }, health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: LG.joinBanner(LG.newArenaLeague(), 'red', at(40)).league };
  const r = rig(P);
  await fightOne(r);
  assert.equal(P.arenaReplays?.length, 1, 'kept');
  const rec = P.arenaReplays[0];
  assert.ok(RP.replayOk(rec));
  assert.deepEqual(rec.f.map((f) => [f.n, f.s, f.m, f.g]), [['Hero', 0, MOBILE_TYPES.Knight, 'female'], [r.A.bout().fighters[1].name, 1, MOBILE_TYPES.Thief, r.foes[0].o.gender]]);
  assert.deepEqual([rec.next.tier, rec.next.bout, rec.next.label], [0, 0, 'bout 1 of 3']);
  assert.deepEqual(rec.sides, ['red', null], 'my banner on my half');
  assert.equal(rec.at, P.arenaLeague.bouts[0].at, 'the game minute its verdict wrote - the Records page\'s row');
  assert.ok(rec.at > at(40), 'the clock ran on through the bout');
  assert.equal(recordsPage({ ladder: P.arenaLadder, league: P.arenaLeague, gameMinutes: rec.at, replays: P.arenaReplays }).bouts[0].replay?.i, 0, 'offered on its row');
  const kinds = rec.ev.map((e) => RP.REPLAY_EVENTS[e[1]]);
  for (const k of ['call', 'crier', 'walk', 'count', 'fight', 'hit', 'fall', 'end', 'verdict', 'heal', 'done']) assert.ok(kinds.includes(k), `the ${k} kept`);
  assert.deepEqual(rec.r, { side: 0, how: 'fall' });
  assert.ok(rec.k.length >= 2 && rec.k[1] === 0, 'my swing kept');
  const poses = RP.decodePoses(rec);
  assert.ok(poses.length > 50, 'ten ticks a second');
  assert.deepEqual(poses[poses.length - 1][0].slice(0, 2), [-40, 0], 'my feet from the floor\'s centre (6 - 10 m, 20 - 20 m)');
  assert.equal(poses[poses.length - 1][0][2], Math.round((1 / (Math.PI * 2)) * 256), 'my facing - my view\'s yaw');
  // a second bout: the newest first
  await fightOne(r);
  assert.equal(P.arenaReplays.length, 2);
  // the pit's sparring records nothing; an exhibition nothing
  const P2 = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder() };
  const r2 = rig(P2);
  r2.A.setStage({ ...r2.stage, kind: 'pit', gates: false });
  r2.A.ask({ where: 'pit', kind: 'practice', next: practiceBout(P2.arenaLadder) });
  await settle();
  for (let i = 0; i < 300 && r2.A.bout()?.phase !== 'fight'; i++) r2.step(100);
  r2.foes[0].entity.health = 1; r2.foes[0].entity.bout.out = true; r2.foes[0].entity.bout.hooks.floor(r2.foes[0]);
  for (let i = 0; i < 200 && r2.A.bout()?.phase !== 'done'; i++) r2.step(100);
  assert.equal(P2.arenaReplays, undefined, 'the pit keeps none');
  r2.A.setStage(r2.stage);
  r2.A.ask({ where: 'floor', kind: 'exhibition', ex: exhibitionFor(at(40) - (at(40) % MINUTES_PER_DAY) + 12 * 60) });
  await settle();
  for (let i = 0; i < 600 && r2.A.bout()?.phase !== 'done'; i++) r2.step(500);
  assert.equal(P2.arenaReplays, undefined, 'an exhibition keeps none');
  // a bout left before its verdict keeps none
  const P3 = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder() };
  const r3 = rig(P3);
  r3.A.setStage(r3.stage);
  r3.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P3.arenaLadder) });
  await settle();
  for (let i = 0; i < 300 && r3.A.bout()?.phase !== 'fight'; i++) r3.step(100);
  r3.A.setStage(null);
  assert.equal(P3.arenaReplays, undefined, 'its stage gone mid-bout: nothing kept');
});

test('ARENA5 a replay played back through the relay\'s own mirror: every fighter a puppet on its recorded walk (mine as my career\'s class enemy), the Herald\'s call from the records, the crowd in its banner\'s colours, the HUD with their names, the verdict - and nothing paid, nothing counted, no gate held (mutants: ARENA5-PLAY-NO-FEED, ARENA5-PLAY-WALKS, ARENA5-PLAY-CALL, ARENA5-PLAY-FIRST-PLACES, ARENA5-PLAY-YAW)', async () => {
  const P = { name: 'Hero', gender: 'female', career: { name: 'Knight' }, health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: LG.joinBanner(LG.newArenaLeague(), 'red', at(40)).league };
  const r = rig(P);
  await fightOne(r);
  const rec = P.arenaReplays[0];
  const ladder = JSON.stringify(P.arenaLadder), league = JSON.stringify(P.arenaLeague);
  const poses = RP.decodePoses(rec);
  // to the stands: a fresh driver (the floor entered again), the replay asked
  const w = rig(P);
  assert.equal(w.A.askReplay({ v: 9 }), false, 'a broken record is not asked');
  assert.equal(w.A.askReplay(rec), true);
  assert.equal(w.A.replaying(), true);
  assert.deepEqual(w.A.floorBanners(), { west: 'red', east: null }, 'the floor hangs its recorded banners');
  w.A.setStage(w.stage);
  w.step(16);
  await settle(); await settle();
  assert.equal(w.foes.length, 2, 'both fighters stood');
  assert.deepEqual(w.foes.map((f) => f.mobile).sort(), [MOBILE_TYPES.Knight, MOBILE_TYPES.Thief].sort(), 'me as a Knight, my opponent as he was');
  const me = w.foes.find((f) => f.mobile === MOBILE_TYPES.Knight);
  assert.ok(Math.abs(me.ai.feet[0] - (10 + poses[0][0][0] * 0.1)) < 1e-6 && Math.abs(me.ai.feet[2] - (20 + poses[0][0][1] * 0.1)) < 1e-6, 'stood where the bout began');
  assert.equal(me._ownFrom, ARENA_PUPPET_OWNER, 'the relay\'s own puppet');
  assert.equal(w.A.relay()?.me, '', 'watched from the stands');
  assert.equal(w.A.holds(), false, 'no gate held');
  // run it through
  const said = () => w.log.say.join('\n');
  let moved = 0, farthest = -Infinity, yaw = null;
  for (let i = 0; i < 2000 && w.A.bout()?.phase !== 'done'; i++) {
    const was = me._pup ? [...me._pup.feet] : null;
    w.step(50);
    if (was && me._pup && (was[0] !== me._pup.feet[0] || was[2] !== me._pup.feet[2])) moved++;
    if (me._pup) { farthest = Math.max(farthest, me._pup.feet[0]); if (!me._pup.moving) yaw = me._pup.yaw; }
  }
  assert.ok(Math.abs(farthest - (10 + (7.5 - 10))) < 0.06, `my puppet closed on him as I did (${farthest})`);
  assert.ok(Math.abs(yaw - (Math.round((1 / (Math.PI * 2)) * 256) / 256) * Math.PI * 2) < 1e-9, 'standing, it faces as I faced');
  assert.equal(w.A.bout()?.phase, 'done', 'the bout runs to its healers');
  assert.ok(said().includes(ARENA_TEXT.replay.call('The Pit', 'bout 1 of 3')), 'the Herald names it from the records');
  assert.ok(!said().includes(ARENA_TEXT.call.exhibition), 'never as an exhibition');
  assert.ok(said().includes(ARENA_TEXT.count[3]), 'the count and the word');
  assert.ok(/is down!/.test(said()), 'the verdict');
  assert.ok(w.log.cues.includes('drumsCall') && w.log.cues.includes('bell'), 'the crowd heard it');
  assert.equal(w.A.bout().result.how, 'fall');
  assert.ok(w.A.crowd(), 'a crowd');
  const huds = w.log.hud.filter(Boolean);
  assert.ok(huds.length > 0 && huds.at(-1).left[0].name === 'Hero', 'the HUD with our names');
  assert.equal(huds.at(-1).left[0].team, 'red', 'my banner\'s pennant');
  assert.ok(moved > 0, 'the puppets walked');
  assert.deepEqual(w.log.pay, [], 'it paid nothing');
  assert.equal(JSON.stringify(P.arenaLadder), ladder, 'the ladder untouched');
  assert.equal(JSON.stringify(P.arenaLeague), league, 'the Records page untouched');
  assert.equal(P.arenaReplays.length, 1, 'a replay records no replay');
  // the stands' presses: heard by my crowd alone
  assert.equal(w.A.cheer(1), false, 'over: no cheer');
});

test('ARENA5 the replay\'s feed itself: the fighters\' first places, the state at the first bell (every fighter the relay\'s own `a` puppet), the walks between ticks at their speed, the blows at the nearest foe, the health, the events in order - the call handed back for the host (mutants: ARENA5-FEED-ORDER, ARENA5-FEED-ATK-TARGET)', () => {
  const rec = circling(F2, 3);
  rec.k = [100, 0];
  rec.ev = [[0, 0], [150, 3, -1, -1, 0, 2], [200, 5, 1, 0, 12]];
  const feed = RP.replayFeed(rec, { t0: 5000, centre: [10, 0, 20] });
  assert.equal(feed.first.length, 2);
  assert.deepEqual(feed.first[0], { k: 'mv', i: 'a0', x: 10 + rec.s[0] * 0.1, z: 20 + rec.s[1] * 0.1, tx: 10 + rec.s[0] * 0.1, tz: 20 + rec.s[1] * 0.1, v: 0, at: 5000 });
  assert.deepEqual(feed.st.f.map((f) => [f[0], f[1], f[2], f[6], f[7]]), [['a0', 'Hero', 0, 1, 145], ['a1', 'Gorlak', 1, 1, 138]]);
  assert.deepEqual([feed.st.me, feed.st.kind, feed.st.ph, feed.st.pa, feed.st.tier, feed.st.bout], ['', 'pve', 'call', 5000, 0, 0]);
  const at0 = feed.due(5000);
  assert.ok(at0.some((w) => w.k === 'call'), 'the call handed back at its moment');
  assert.ok(at0.some((w) => w.k === 'mv'), 'the first walks');
  const by = feed.due(5000 + 1600);
  const atk = by.find((w) => w.k === 'atk');
  assert.ok(atk && atk.i === 'a0' && atk.tg === 'a1', 'my blow at my opponent');
  const ev = by.filter((w) => w.k === 'ev').map((w) => w.e[0]);
  assert.deepEqual(ev.map((e) => [e.k, e.at]), [['count', 6500]], 'events at their own moments');
  const later = feed.due(5000 + 2100).filter((w) => w.k === 'ev').map((w) => w.e[0]);
  assert.deepEqual(later[0], { k: 'hit', at: 7000, a: 'a1', b: 'a0', dmg: 12 });
  const mv = by.find((w) => w.k === 'mv');
  assert.ok(Math.abs(mv.v - Math.hypot(mv.tx - mv.x, mv.tz - mv.z) / 0.1) < 1e-9, 'a tick\'s walk in a tick');
  assert.equal(feed.due(5000 + 2100).length, 0, 'nothing twice');
  assert.equal(RP.replayFeed({ v: 9 }, { t0: 0, centre: [0, 0, 0] }), null);
  assert.match(RP.replayBoutId(rec), /^[0-9a-f]{16}$/);
});

test('ARENA5 offered: the Herald\'s R when the records keep a bout, the Records page\'s Watch the replay on its row (refused away from the gate), the window\'s press through the gate to the Herald\'s door - offline; both hosts stand it on the floor\'s instance (mutants: ARENA5-HERALD-NO-REPLAY, ARENA5-RECORDS-NO-PRESS, ARENA5-WINDOW-REPLAY-GATE)', () => {
  const H = heraldChoice({ gameMinutes: at(40, 3), ladder: newArenaLadder(), replays: 2 });
  assert.ok(H.options.some((o) => o.act === 'replay' && o.code === 'KeyR' && o.label === ARENA_TEXT.replay.herald));
  assert.ok(H.lines.includes(ARENA_TEXT.replay.heraldLine));
  assert.ok(!heraldChoice({ gameMinutes: at(40, 3), ladder: newArenaLadder() }).options.some((o) => o.act === 'replay'), 'none kept: none offered');
  // the Records page: the row fought at the record's minute and tier carries it
  const rec = { ...circling(F2, 2), at: at(40) };
  let L = LG.leagueAfterBout(LG.newArenaLeague(), { gameMinutes: at(39), tier: 0, label: 'bout 1 of 3', opp: 'A', won: false, how: 'fall', purse: 0 });
  L = LG.leagueAfterBout(L, { gameMinutes: at(40), tier: 0, label: 'bout 1 of 3', opp: 'Gorlak', won: true, how: 'fall', purse: 50 });
  const page = recordsPage({ ladder: newArenaLadder(), league: L, gameMinutes: at(41), replays: [rec], atGate: true });
  assert.deepEqual(page.bouts.map((b) => !!b.replay), [true, false]);
  assert.deepEqual(page.bouts[0].replay, { act: 'replay', label: ARENA_TEXT.replay.press, i: 0, why: '' });
  assert.equal(recordsPage({ ladder: newArenaLadder(), league: L, gameMinutes: at(41), replays: [rec], atGate: false }).bouts[0].replay.why, ARENA_TEXT.window.whyGate);
  // the press: at the gate, a record kept, offline - to the Herald's door
  const P = { name: 'Hero', health: 10, maxHealth: 10, arenaLadder: newArenaLadder(), arenaLeague: L, arenaReplays: [rec] };
  let gate = true, on = null;
  const acts = [];
  const G = createArenaGate({ playerEntity: P, gameMinutes: () => at(41), showOverlay: () => {}, atGate: () => gate, heraldAct: (a) => acts.push(a), online: () => on, openWindow: null });
  assert.deepEqual(G.windowAct('replay', { i: 0 }), { ok: true, text: '' });
  assert.deepEqual(acts, ['replay:0']);
  assert.deepEqual(G.windowAct('replay', { i: 2 }), { ok: false, text: ARENA_TEXT.replay.gone });
  gate = false;
  assert.deepEqual(G.windowAct('replay', { i: 0 }), { ok: false, text: ARENA_TEXT.window.whyGate });
  gate = true; on = { live: () => true, board: () => null, refresh: () => {}, climb: () => null, model: () => null };
  assert.deepEqual(G.windowAct('replay', { i: 0 }), { ok: false, text: ARENA_TEXT.replay.offline });
  on = null;
  assert.ok(G.heraldChoice({}).options.some((o) => o.act === 'replay'), 'the gate\'s Herald offers it offline');
  assert.ok(G.board().records.bouts[0].replay, 'the window\'s board carries it');
  // both hosts: the Herald's door stands it on the instance; my facing handed in
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(f);
    assert.match(s, /else if \(a === 'replay' \|\| String\(a\)\.startsWith\('replay:'\)\) \{/, f);
    assert.match(s, /if \(arenaBouts\.askReplay\(rec\)\) modes\?\.enterArenaFloor\?\.\('watch'\);/, f);
    assert.match(s, /playerFeet: player\.pos, playerYaw: cam\.yaw,/, f);
  }
  // AUDIT PRE-MERGE 1003 U14: each press named by its bout (its opponent and its day)
  assert.match(read('src/ui/arenaWindow.js'), /if \(b\.replay\) \{ const acts = el\('div', 'aw-boutacts'\); acts\.append\(press\(b\.replay, \(\) => doAct\('replay', \{ i: b\.replay\.i \}\), '', `\$\{b\.opp\}, \$\{b\.when\}`\)\); li\.append\(acts\); \}/);
  assert.equal(YOU, 'you');
});
