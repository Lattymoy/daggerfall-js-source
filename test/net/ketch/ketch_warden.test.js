// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 7): THE TONAL WARDEN'S LAW - its numbers; a fighter's
// seat (the crew's eight); the belief of a blow (awake, unwarded, on the bridge, within reach, its phase's floor held);
// the Discord (warded, the resonators, the Sentries asked, its clock's blow, the stun); the Last Note (the forks, the
// song's heal, the outer ring's sections); the Ketch turning west; a fight lost; its blows judged on the trails; the
// seam. tools/mutants/ketch_warden.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KW_TTK_S, KW_OPENING_MS, KW_LOST_MS, KW_PHASE_AT, KW_BODY, KW_DISCORD_FIRST_MS, KW_DISCORD_EVERY_MS, KW_DISCORD_PCT,
  KW_STUN_MS, KW_STUN_HIT_X, KW_SONG_FIRST_MS, KW_SONG_HEAL, KW_SONG_STUN_MS, KW_SECTION_FALLS, KW_SECTION_WARN_MS, KW_SECTION_GONE_MS,
  KW_ENDS_MS, KW_END_EVERY_MS, KW_TURN_MS, KW_BLOWS, KW_ID, forkCountFor, forkHpFor, newWardenFight, joinWarden, applyWardenHit,
  wardenOpen, retune, applyForkHit, forksOpen, sectionGone, stepWarden, wardenStateOf, judgeWarden, wardenAllows, KETCH_SEAM, KW_FORK,
} from '../../../src/net/ketch/ketchWarden.js';
import { KT_BRIDGE, KT_WARDEN_HOME, KT_SECTIONS, KT_FORK_RING } from '../../../src/net/ketch/ketchDeck.js';
import { KT_CREW_MAX } from '../../../src/net/ketch/ketchLaw.js';
import { dpsRef, HIT_KINDS, MELEE_REACH, POSE_SLACK, REPEAT_MAX } from '../../../src/net/gate/gateBrain.js';
import { BOSS_SEAM_KEYS } from '../../../src/net/bossSeam.js';

const T0 = 1_800_000_000_000, KEY = 'kt:00000001.0123456789abcdef';
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const take = (d, left) => Math.min(d, left);   // a purse that accepts every claim, to what is left of what it meets
const ON = (k = 0, r = 8) => ({ x: KT_BRIDGE.x + Math.sin(k) * r, y: 0, z: KT_BRIDGE.z + Math.cos(k) * r });
function fight(n = 4, lv = 30) {
  const f = newWardenFight(KEY, 1, T0);
  for (let k = 0; k < n; k++) joinWarden(f, `p${k}`, `P${k}`, lv, T0);
  return f;
}
const crewOn = (f, r = 8) => Object.keys(f.players).map((sub, k) => ({ sub, ...ON(k, r), dead: false }));
function beatTo(f, from, until, bodiesAt, rng = seeded(5), stop = () => false) {
  const out = [];
  for (let now = from; now <= until; now += 250) {
    for (const x of stepWarden(f, now, bodiesAt(now), rng)) out.push({ now, ...x });
    if (out.length && stop(out.at(-1))) break;
  }
  return out;
}

test('KETCH THE WARDEN\'S NUMBERS: a share of 600 s of reference damage (PIN MOVED, KETCH-LONGER: 300); awake six seconds on; lost after thirty; its phases at 65% and 35% - the Steersman, the Discord, the Last Note; the Discord a quarter of everyone\'s health every thirty seconds; the forks three and one for each two living, seven at most; the Ketch turning west at twenty-two minutes (mutants: the phases moved; a fork for every living; the end a minute early)', () => {
  assert.equal(KW_TTK_S, 600, 'PIN MOVED (KETCH-LONGER): 300 before');
  assert.deepEqual([KW_OPENING_MS, KW_LOST_MS], [6000, 30_000]);
  assert.deepEqual([...KW_PHASE_AT], [0.65, 0.35]);
  assert.deepEqual([KW_DISCORD_FIRST_MS, KW_DISCORD_EVERY_MS, KW_DISCORD_PCT], [8000, 30_000, 0.25]);
  assert.deepEqual([0, 1, 2, 4, 6, 8, 20].map(forkCountFor), [3, 3, 4, 5, 6, 7, 7]);
  assert.equal(forkHpFor([30, 30, 30, 30], 5), Math.round((KW_FORK.teamS * 4 * dpsRef(30)) / 5));
  assert.equal(KW_ENDS_MS, 22 * 60_000, 'PIN MOVED (KETCH-LONGER): fourteen before');
  assert.ok(KW_BODY.keep + KW_BODY.r <= KT_BRIDGE.core, 'it never stands on a section that falls');
  assert.deepEqual(wardenAllows(30).map((A) => A.key), [], 'out of every reach: it walks');
  assert.deepEqual(wardenAllows(5).map((A) => A.key), ['keel', 'lash', 'ring']);
  assert.deepEqual(wardenAllows(5, KW_BLOWS.ring.a, 1).map((A) => A.key), ['keel', 'lash'], 'the last left out');
  assert.deepEqual(wardenAllows(20, KW_BLOWS.keel.a, REPEAT_MAX).map((A) => A.key), [], 'never the keel a third time running');
});

test('KETCH A SEAT AT THE WARDEN: born at its helm facing the way in, one seat an account, each bringing its share at the fraction it stands at; the crew\'s eight at most; a fight over seats nobody (mutants: a ninth seated; a late fighter bringing a whole share to a hurt Warden)', () => {
  const f = newWardenFight(KEY, 1, T0);
  assert.deepEqual([f.wd.x, f.wd.z, f.wd.yw, f.op], [KT_WARDEN_HOME.x, KT_WARDEN_HOME.z, KT_WARDEN_HOME.yaw, T0 + KW_OPENING_MS]);
  for (let k = 0; k < KT_CREW_MAX; k++) assert.equal(joinWarden(f, `p${k}`, `P${k}`, 30, T0), true);
  assert.equal(f.max, KT_CREW_MAX * KW_TTK_S * dpsRef(30));
  assert.equal(joinWarden(f, 'p9', 'Nine', 30, T0), false, 'the crew\'s eight');
  assert.equal(joinWarden(f, 'p3', 'Three', 30, T0 + 5), true, 'a seat already held');
  const g = fight(1);
  g.hp = g.max / 2;
  joinWarden(g, 'late', 'Late', 30, T0);
  assert.equal(g.hp, g.max / 2, 'its share at the fraction it stands at');
  g.fell = { at: T0, top: [], n: 1 };
  assert.equal(joinWarden(g, 'later', 'L', 30, T0), false);
});

test('KETCH THE BELIEF OF A BLOW: nothing while it sleeps, from off the bridge, a storey off, or a melee blow past reach; then the purse\'s acceptance, never below its phase\'s floor (mutants: struck asleep; a melee blow from across the bridge; the floor ignored)', () => {
  const f = fight(1);
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Shaft, ON(), T0 + 100, take), 0, 'asleep');
  const t = f.op;
  assert.equal(wardenOpen(f, t), true);
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Shaft, { x: 0, y: 0, z: 150 }, t, take), 0, 'off the bridge');
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Shaft, { ...ON(), y: -12 }, t, take), 0, 'a storey off');
  const far = { x: KT_WARDEN_HOME.x, y: 0, z: KT_WARDEN_HOME.z - (KW_BODY.r + MELEE_REACH + POSE_SLACK + 1) };
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Melee, far, t, take), 0, 'a swing past reach');
  const close = { x: KT_WARDEN_HOME.x, y: 0, z: KT_WARDEN_HOME.z - KW_BODY.r - 1 };
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Melee, close, t, take), 100);
  assert.equal(applyWardenHit(f, 'nobody', 100, HIT_KINDS.Shaft, ON(), t, take), 0, 'not seated');
  const got = applyWardenHit(f, 'p0', 1e9, HIT_KINDS.Shaft, ON(), t, take);
  assert.equal(f.hp, KW_PHASE_AT[0] * f.max, 'held at the Steersman\'s floor');
  assert.ok(got > 0);
  assert.equal(f.players.p0.dealt, 100 + got);
});

test('KETCH THE DISCORD: past 65% - warded, the resonators false, two Sentries asked of the ship, its turn; the Discord\'s clock-blow over the whole bridge; every resonator put right (and each only once) breaks the ward and stuns it, struck heavier (mutants: no Sentries asked; a resonator put right twice; the stun not heavier)', () => {
  const f = fight(2), rng = seeded(3);
  const crew = (now) => crewOn(f);
  beatTo(f, T0, f.op, crew, rng);
  const t = f.op + 250;
  applyWardenHit(f, 'p0', 1e9, HIT_KINDS.Shaft, ON(), t, take);
  const turn = stepWarden(f, t + 250, crew(), rng);
  assert.deepEqual(turn.filter((x) => ['ph', 'ward', 'rs'].includes(x.k)).map((x) => x.k), ['ph', 'ward', 'rs']);
  assert.deepEqual([f.phase, f.ward, [...f.rs]], [2, true, [0, 0, 0, 0]]);
  assert.deepEqual(f.want, ['sentry', 'sentry']);
  assert.equal(f.outUntil, t + 250 + KW_TURN_MS);
  assert.equal(applyWardenHit(f, 'p0', 100, HIT_KINDS.Shaft, ON(), t + 5000, take), 0, 'warded');
  const dis = beatTo(f, t + 500, t + 250 + KW_DISCORD_FIRST_MS, crew, rng).filter((x) => x.k === 'bl' && x.b.a === KW_BLOWS.discord.a);
  assert.equal(dis.length, 1);
  assert.equal(dis[0].b.at, t + 250 + KW_DISCORD_FIRST_MS);
  assert.deepEqual(dis[0].b.s[0][0], 'a', 'the whole bridge');
  assert.equal(f.discordAt, t + 250 + KW_DISCORD_FIRST_MS + KW_DISCORD_EVERY_MS);
  const r0 = retune(f, 0, t + 9000);
  assert.deepEqual(r0, [{ k: 'rs', rs: [1, 0, 0, 0], at: t + 9000 }]);
  assert.deepEqual(retune(f, 0, t + 9001), [], 'only once');
  retune(f, 1, t + 9002); retune(f, 2, t + 9003);
  const last = retune(f, 3, t + 9004);
  assert.deepEqual(last.map((x) => x.k), ['rs', 'ward']);
  assert.deepEqual([f.ward, f.stunUntil], [false, t + 9004 + KW_STUN_MS]);
  const before = f.hp;
  assert.equal(applyWardenHit(f, 'p1', 100, HIT_KINDS.Shaft, ON(1), t + 9100, take), 100 * KW_STUN_HIT_X);
  assert.equal(before - f.hp, 100 * KW_STUN_HIT_X);
});

/** A fight carried into the Last Note at `now` answered. */
function intoLastNote(n = 4, rng = seeded(4)) {
  const f = fight(n), crew = () => crewOn(f);
  beatTo(f, T0, f.op, crew, rng);
  let t = f.op + 250;
  applyWardenHit(f, 'p0', 1e9, HIT_KINDS.Shaft, ON(), t, take);
  stepWarden(f, t += 250, crew(), rng);
  for (let k = 0; k < 4; k++) retune(f, k, t);
  t = Math.max(t, f.outUntil) + 250;
  applyWardenHit(f, 'p0', 1e9, HIT_KINDS.Shaft, ON(), t, take);
  stepWarden(f, t += 250, crew(), rng);
  assert.equal(f.phase, 3);
  return { f, t, crew };
}

test('KETCH THE LAST NOTE: the song called while forks rise on the core for the living, clear of the Warden; every fork broken before it lands stuns it and calls the song off; a song that lands heals it (mutants: the forks off the core; the song breaking with a fork standing; the heal missing)', () => {
  const rng = seeded(6);
  const { f, t, crew } = intoLastNote(4, rng);
  const s = beatTo(f, t, t + KW_TURN_MS + KW_SONG_FIRST_MS + 1000, crew, rng, (x) => x.k === 'fk');
  const fk = s.find((x) => x.k === 'fk');
  assert.ok(fk, 'the forks rise');
  assert.equal(fk.c.length, forkCountFor(4));
  for (const [x, z] of fk.c) {
    const d = Math.hypot(x - KT_BRIDGE.x, z - KT_BRIDGE.z);
    assert.ok(d >= KT_FORK_RING[0] - 1e-6 && d <= KT_FORK_RING[1] + 1e-6, 'on the core\'s ring');
  }
  assert.ok(s.some((x) => x.k === 'bl' && x.b.a === KW_BLOWS.song.a));
  const now = s.at(-1).now;
  assert.equal(forksOpen(f, now), true);
  const hp = f.hp, dealt = f.players.p0.dealt, forkHp = f.fk.c[0].h;
  const out = [];
  for (let c = 0; c < f.fk.c.length - 1; c++) out.push(...applyForkHit(f, 'p0', c, 1e9, HIT_KINDS.Shaft, ON(), now, take));
  assert.ok(Math.abs(f.players.p0.dealt - dealt - forkHp * (f.fk.c.length - 1)) < 1e-6, 'a fork\'s damage dealt - a part in the fight (AUDIT KETCH L1-8)');
  assert.equal(out.filter((x) => x.k === 'fkb').length, f.fk.c.length - 1);
  assert.ok(f.fk, 'one stands: the song goes on');
  // that one lands: healed
  const landAt = f.fk.at;
  beatTo(f, now + 250, landAt + 250, crew, rng);
  assert.ok(f.hp > hp, 'healed');
  assert.ok(Math.abs(f.hp - Math.min(f.max, hp + KW_SONG_HEAL * f.max)) < 1e-6);
  // the next song, every fork broken
  const s2 = beatTo(f, landAt + 500, landAt + 60_000, crew, rng, (x) => x.k === 'fk');
  const fk2 = s2.find((x) => x.k === 'fk');
  assert.ok(fk2);
  const at2 = s2.find((x) => x.k === 'fk').now;
  const broke = [];
  for (let c = 0; c < fk2.c.length; c++) broke.push(...applyForkHit(f, 'p1', c, 1e9, HIT_KINDS.Shaft, ON(1), at2 + 10, take));
  assert.deepEqual(broke.at(-1).k, 'stun');
  assert.equal(f.stunUntil, at2 + 10 + KW_SONG_STUN_MS);
  assert.equal(f.fk, null, 'the song called off');
  assert.ok(!f.blows.some((b) => b.i === fk2.i), 'its blow gone');
});

test('KETCH THE OUTER RING GIVES WAY: in the Last Note two sections at a time shudder and fall away for a while - never the core, never a section already falling (mutants: one section at a time; the warning skipped)', () => {
  const rng = seeded(8);
  const { f, t, crew } = intoLastNote(2, rng);
  const s = beatTo(f, t, t + 60_000, crew, rng).filter((x) => x.k === 'sec');
  assert.ok(s.length >= 2);
  const first = s[0];
  assert.equal(first.s.length, KW_SECTION_FALLS);
  const [k, at, back] = first.s[0];
  assert.equal(back - at, KW_SECTION_GONE_MS);
  assert.equal(at - first.now, KW_SECTION_WARN_MS);
  assert.ok(k >= 0 && k < KT_SECTIONS);
  assert.equal(new Set(first.s.map((q) => q[0])).size, first.s.length, 'never one twice');
  assert.equal(sectionGone(first.s, k, at - 1), false, 'shuddering');
  assert.equal(sectionGone(first.s, k, at), true, 'gone');
  assert.equal(sectionGone(first.s, k, back), false, 'back together');
});

test('KETCH THE KETCH TURNS WEST: fourteen minutes on from its wake, its clock-blow over the whole bridge every two seconds, nothing else done (mutants: the turn never coming; its blows every beat)', () => {
  const f = fight(1), rng = seeded(2), crew = () => crewOn(f);
  const t = f.endsAt - KW_BLOWS.west.wu;
  stepWarden(f, t - 250, crew(), rng);
  const w = beatTo(f, t, t + 6000, crew, rng).filter((x) => x.k === 'bl');
  assert.ok(w.length >= 3 && w.length <= 5 && w.every((x) => x.b.a === KW_BLOWS.west.a), 'one every two seconds');
  assert.deepEqual(w.slice(0, 3).map((x) => x.b.at), [f.endsAt, f.endsAt + KW_END_EVERY_MS, f.endsAt + 2 * KW_END_EVERY_MS]);
  assert.ok(f.ended);
  assert.equal(wardenOpen(f, t + 6000), false);
});

test('KETCH A FIGHT LOST: no living fighter on the bridge for thirty seconds - lost, said once, nothing stepped after (mutants: the wait shortened; the dead counted standing)', () => {
  const f = fight(2), rng = seeded(2);
  const dead = () => crewOn(f).map((b) => ({ ...b, dead: true }));
  const out = beatTo(f, T0, T0 + KW_LOST_MS + 1000, dead, rng);
  const lost = out.filter((x) => x.k === 'lost');
  assert.equal(lost.length, 1);
  assert.equal(lost[0].now, T0 + KW_LOST_MS);
  assert.deepEqual(stepWarden(f, T0 + KW_LOST_MS + 2000, crewOn(f), rng), []);
  assert.equal(wardenStateOf(f).lost, T0 + KW_LOST_MS);
});

test('KETCH ITS BLOWS JUDGED ON THE TRAILS: a plain blow\'s share on a body deep in it before and after its landing; an element\'s and a jumped wave\'s never; the song only while its forks stand (mutants: the fire counted; the wave counted; a song broken still landing)', () => {
  const f = fight(1);
  const at = T0 + 20_000;
  const stamp = (o) => ({ i: 1, o: KW_ID, at, wu: 1000, p: 0.3, b: 10, el: null, nm: 'x', y: 0, ...o });
  const here = { sub: 'p0', x: KT_BRIDGE.x, z: KT_BRIDGE.z, dead: false, tr: [[at - 100, KT_BRIDGE.x, KT_BRIDGE.z, 0], [at + 100, KT_BRIDGE.x, KT_BRIDGE.z, 0]] };
  f.blows = [stamp({ s: [['d', KT_BRIDGE.x, KT_BRIDGE.z, 5]] })];
  assert.deepEqual(judgeWarden(f, [here], at + 2000), [{ sub: 'p0', share: 0.3 }]);
  assert.deepEqual(judgeWarden(f, [here], at + 4000), [], 'judged once');
  f.blows = [stamp({ s: [['d', KT_BRIDGE.x, KT_BRIDGE.z, 5]], el: 'fire' }), stamp({ i: 2, s: [['d', KT_BRIDGE.x, KT_BRIDGE.z, 5]], jp: 1 })];
  assert.deepEqual(judgeWarden(f, [here], at + 2000), []);
  f.blows = [stamp({ i: 9, a: KW_BLOWS.song.a, s: [['a']], p: 0.7 })];
  f.fk = null;
  assert.deepEqual(judgeWarden(f, [here], at + 2000), [], 'its forks broken: no song');
  f.blows = [stamp({ i: 9, a: KW_BLOWS.song.a, s: [['a']], p: 0.7 })];
  f.fk = { i: 9, at, m: 1, c: [{ x: 0, z: 200, h: 1 }] };
  assert.deepEqual(judgeWarden(f, [here], at + 2000), [{ sub: 'p0', share: 0.7 }]);
});

test('KETCH THE KEEL-SONG COUNTED IN THE RELAY\'S ORDER: judged, then stepped, every beat - a song that lands unbroken is counted on every body on the bridge, once; a song whose forks all broke is not (AUDIT KETCH L1-3; mutants: the sung mark never set)', () => {
  for (const broken of [false, true]) {
    const rng = seeded(6);
    const { f, t, crew } = intoLastNote(3, rng);
    let fk = null, songs = 0;
    for (let now = t; now <= t + KW_TURN_MS + KW_SONG_FIRST_MS + 20_000; now += 250) {
      songs += judgeWarden(f, crew(now), now).filter((h) => h.share === Math.min(1, KW_BLOWS.song.p)).length;   // the relay judges first ...
      for (const x of stepWarden(f, now, crew(now), rng)) {                                                     // ... then steps
        if (x.k === 'fk' && !fk) { fk = x; if (broken) for (let c = 0; c < x.c.length; c++) applyForkHit(f, 'p0', c, 1e9, HIT_KINDS.Shaft, ON(), now, take); }
      }
    }
    assert.ok(fk, 'the forks rose');
    assert.equal(songs, broken ? 0 : Object.keys(f.players).length, broken ? 'broken: never counted' : 'sung: every body on the bridge, once');
  }
});

test('KETCH A SONG CALLED ON AN EMPTY BRIDGE: its forks stand at the fight\'s own fighters\' measure - never at nothing, so one who comes back can break them (AUDIT KETCH L1-13; mutants: the forks of nobody)', () => {
  const rng = seeded(6);
  const { f, t, crew } = intoLastNote(3, rng);
  const fk = beatTo(f, t, t + KW_TURN_MS + KW_SONG_FIRST_MS + 2000, () => [], rng, (x) => x.k === 'fk').find((x) => x.k === 'fk');
  assert.ok(fk, 'the song called with nobody on the bridge');
  assert.equal(fk.c.length, forkCountFor(3));
  assert.equal(fk.m, forkHpFor([30, 30, 30], forkCountFor(3)));
  assert.ok(fk.m > 0);
  void crew;
});

test('KETCH THE WARDEN ON THE BOSS SEAM: every member of the contract, the claim spent by the crew\'s purse (mutants: the seam\'s hit bypassing the purse)', () => {
  for (const k of BOSS_SEAM_KEYS) assert.equal(typeof KETCH_SEAM[k], 'function', k);
  assert.equal(KETCH_SEAM.name, 'ketch');
  const f = KETCH_SEAM.new({ room: KEY, fi: 3, now: T0 });
  assert.deepEqual([f.room, f.fi], [KEY, 3]);
  KETCH_SEAM.join(f, 'p0', 'P', 30, T0);
  assert.equal(KETCH_SEAM.hit(f, 'p0', 500, HIT_KINDS.Shaft, ON(), f.op, null, { spend: (d) => d / 5 }), 100, 'what the purse accepts');
  assert.equal(KETCH_SEAM.stateOf(f).k, 'ws');
});
