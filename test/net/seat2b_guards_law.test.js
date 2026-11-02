// SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE RELAY'S OWN FIGHTERS' LAW -
// net/siege/siegeRef.js's Barracks guards and a revolt's rising (their posts, their beat, their blows, their falls and rises,
// a guard counted at a point, the revolt's end and its Honours), the field's frame and the wire that carries them
// (net/wire.js), the revolt's pass (net/identityToken.js) and the schedule's law for a revolt (net/townSeatLaw.js).
// bible/11-Multiplayer/Seats-Arc.md 6.1, 7.5, 7.7; `06-Systems/Online-Arc.md` SEAT2b part two (c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIEGE_NPC, SIEGE_NPC_KINDS, SIEGE_BARRACKS_GUARDS, SIEGE_REVOLT, SIEGE_NPC_MAX, SIEGE_LENGTH_MS, SIEGE_UNITS_PER_M, SIEGE_TICK_MS, SIEGE_PROTECT_MS,
  isSiegeNpcId, siegeGuards, revoltRising, siegeNpcAt, siegeNpcPose, siegeNpcFell, siegeNpcFoe, siegeRevoltDown, siegeVitality,
  fieldOf, newBattle, battleStep, honoured, siegeFieldFrame, newFighter, worksOf, siegeNextWave, siegeWaveMs, refereeBlow, siegeCampPose,
} from '../../src/net/siege/siegeRef.js';
import { barracksGuards, REVOLT } from '../../src/net/fortLaw.js';
import {
  BATTLE_LENGTH_MS, battleLengthMs, battleSpanMs, placeBattles, siegeStartMs, CROWN_SIEGE_SLOT, settleField, turningPlan, chronicleLine, seatBattleLine,
  battleAnnouncement, atSiegeWindow, STANDING_CHANGES,
} from '../../src/net/townSeatLaw.js';
import { siegePassValid } from '../../src/net/identityToken.js';
import { validSiegeIn, validSiegeOut } from '../../src/net/wire.js';

const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000_000;
/** Gate, Market, Temple, the Throne, the attackers' camp, the defenders' (metres). */
const SF = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const CROWN_SF = [SF[0], SF[1], SF[2], [0, 0], SF[3], SF[4], SF[5]];
const FIELD = fieldOf(SF, 'palace');
/** A fighter as the relay hands battleStep one: its account, its pose (metres), its vitality. */
const fighter = (sub, side, x, z, o = {}) => ({ ...newFighter(10, T), sub, side, pose: { x: x * M, y: 0, z: z * M }, here: true, ...o });
const beat = (b, fs, t) => battleStep(b, fs, t);
const metresTo = (n, f, t) => { const [x, z] = siegeNpcAt(n, t); return Math.hypot(x - f.pose.x, z - f.pose.z) / M; };

test('SEAT2b part two (c) THE LAW\'S NUMBERS, pinned EQUAL to net/fortLaw.js (the relay bundles this leaf): the Barracks\' guards 2, 4, 6; the revolt\'s Captain of Renown 50 (vitality 400) and twelve rebels for the window\'s two hours - its length the schedule\'s; thirteen at most in a room; their ids `n0`-`n12`, never a peer\'s nor a work\'s (mutants: the guards; the revolt; the ids)', () => {
  assert.deepEqual([...SIEGE_BARRACKS_GUARDS], [0, 1, 2, 3].map(barracksGuards));
  assert.deepEqual([SIEGE_REVOLT.captainRenown, SIEGE_REVOLT.rebels, SIEGE_REVOLT.windowMs], [REVOLT.captainRenown, REVOLT.rebels, REVOLT.windowMs]);
  assert.equal(SIEGE_LENGTH_MS.revolt, REVOLT.windowMs);
  assert.deepEqual({ ...SIEGE_LENGTH_MS }, { ...BATTLE_LENGTH_MS }, 'the relay\'s clock is the schedule\'s');
  assert.equal(SIEGE_NPC.captain.lv, REVOLT.captainRenown);
  assert.deepEqual([siegeVitality(SIEGE_NPC.guard.lv), siegeVitality(SIEGE_NPC.rebel.lv), siegeVitality(SIEGE_NPC.captain.lv)], [360, 340, 400]);
  assert.deepEqual(['guard', 'rebel', 'captain'].map((k) => SIEGE_NPC_KINDS[SIEGE_NPC[k].code]), ['guard', 'rebel', 'captain']);
  assert.deepEqual([SIEGE_NPC.guard.side, SIEGE_NPC.rebel.side, SIEGE_NPC.captain.side], ['defend', 'attack', 'attack']);
  assert.equal(SIEGE_NPC_MAX, 13);
  assert.deepEqual(['n0', 'n9', 'n12'].map(isSiegeNpcId), [true, true, true]);
  assert.deepEqual(['n13', 'n01', 'n', 'gh', 'rm', 'peer-0001', 'N1', 'n1 ', 7].map(isSiegeNpcId), [false, false, false, false, false, false, false, false, false]);
});

test('SEAT2b part two (c) THE GUARDS\' POSTS (7.5): the Barracks\' tier fields 0, 2, 4 or 6 at a siege - the Throne first, then the banners from the palace\'s end back to the Gate, round again; whole, at their posts; a Tourney fields none, nor a siege with no Barracks (mutants: the count; the order; the round; the Tourney)', () => {
  assert.deepEqual([0, 1, 2, 3].map((t) => siegeGuards(FIELD, t).length), [0, 2, 4, 6]);
  const six = siegeGuards(FIELD, 3);
  assert.deepEqual(six.map((n) => n.post), [SF[3], SF[2], SF[1], SF[0], SF[3], SF[2]]);
  assert.deepEqual(six.map((n) => n.id), ['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
  assert.deepEqual([six[0].hp, six[0].max, six[0].down, six[0].x, six[0].z], [360, 360, false, SF[3][0], SF[3][1]]);
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 2], 'palace') });
  assert.equal(b.npcs.length, 4);
  assert.deepEqual(newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: FIELD }).npcs, []);
  assert.deepEqual(newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD }).npcs, []);
});

test('SEAT2b part two (c) A GUARD\'S BEAT: it marks an attacker within its reach, walks at it at its pace, winds a blow up within two metres and lands it a beat later for 20 on the room\'s held vitality; a fighter that steps out of reach in the wind-up takes nothing, a protected one nothing; its mark past its leash is let go and it walks home; a defender is never its mark (mutants: the aggro; the pace; the strike; the wind-up; the damage; the dodge; the protection; the leash; the sides)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  const g = b.npcs[0];   // at the Throne, (0, -40)
  const a = fighter('A', 'attack', 0, -30), d = fighter('D', 'defend', 0, -45);
  const fs = [a, d];
  assert.deepEqual(beat(b, fs, T), []);
  assert.equal(g.tg, 'A', 'the attacker, never the defender beside it');
  assert.deepEqual([g.tx, g.tz], [0, -31.5 * M], 'it walks at its mark, stopping a metre and a half short');
  beat(b, fs, T + 1000);
  assert.equal(Math.round(metresTo(g, a, T + 1000) * 10) / 10, 5, 'five metres a second');
  beat(b, fs, T + 2000);
  assert.deepEqual(g.atk, { at: T + 3000, to: 'A' }, 'within two metres: a blow wound up a beat');
  const hit = beat(b, fs, T + 3000).find((e) => e.k === 'nhit');
  assert.deepEqual(hit, { k: 'nhit', n: 'n0', to: 'A', h: 300, m: 320, fell: false });
  assert.equal(a.hp, 300);
  beat(b, fs, T + 4000);
  assert.equal(g.atk?.at, T + 5000, 'the next a blow\'s time after the last began');
  a.pose = { x: 0, y: 0, z: -25 * M };   // stepped away in the wind-up
  assert.deepEqual(beat(b, fs, T + 5000).filter((e) => e.k === 'nhit'), []);
  assert.equal(a.hp, 300);
  // a protected fighter takes nothing
  const b2 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  const p = fighter('P', 'attack', 0, -38.5, { safeTo: T + 60_000 });
  beat(b2, [p], T); assert.ok(b2.npcs[0].atk);
  assert.deepEqual(beat(b2, [p], T + 1000).filter((e) => e.k === 'nhit'), []);
  assert.equal(p.hp, 320);
  // past the leash: let go, home
  const b3 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  const far = fighter('F', 'attack', 0, -30);
  beat(b3, [far], T); assert.equal(b3.npcs[0].tg, 'F');
  far.pose = { x: 0, y: 0, z: (-40 + 24.5) * M };   // 24.5 m from the post
  beat(b3, [far], T + 1000);
  assert.deepEqual([b3.npcs[0].tg, b3.npcs[0].tx, b3.npcs[0].tz], [null, SF[3][0], SF[3][1]]);
  // a guard away from its post marks no one past its leash, however near
  const b5 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  Object.assign(b5.npcs[0], { x: 0, z: -20 * M, tx: 0, tz: -20 * M });   // 20 m north of its post
  beat(b5, [fighter('Q', 'attack', 0, -10)], T);   // 10 m from it, 30 m from its post
  assert.equal(b5.npcs[0].tg, null);
  // a mark three metres off: walked at, not struck at
  const b6 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  beat(b6, [fighter('S', 'attack', 0, -37)], T);
  assert.deepEqual([b6.npcs[0].tg, b6.npcs[0].atk], ['S', null]);
  // never aggro on one beyond its reach
  const b4 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  beat(b4, [fighter('Z', 'attack', 0, -27.5)], T);
  assert.equal(b4.npcs[0].tg, null, '12.5 m off: no mark');
});

test('SEAT2b part two (c) A GUARD\'S FALL AND RISE, AND ITS POINT: a guard standing at a banner contests it as a defender does - the attackers alone there raise nothing; felled (siegeNpcFell) it stops where it stood and rises with the defenders\' wave at THEIR CAMP, whole and protected, walking back to its post; a fighter it fells rises at its own side\'s wave (mutants: the presence; the fall; the wave; the camp; the protection)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  const g = b.npcs[1];   // at the Temple banner, (-40, 0)
  const a = fighter('A', 'attack', -40, 6, { hp: 10_000, max: 10_000 });
  for (let t = T; t <= T + 25_000; t += SIEGE_TICK_MS) beat(b, [a], t);
  assert.deepEqual([b.banners[2].side, b.raised], ['defend', false], 'a guard there: frozen');
  siegeNpcFell(b, g, T + 25_500);
  assert.deepEqual([g.down, g.hp, g.atk, g.upAt, g.tx, g.tz], [true, 0, null, siegeNextWave(T + 25_500, siegeWaveMs(b, 'defend')), g.x, g.z]);
  for (let t = T + 26_000; t < g.upAt; t += SIEGE_TICK_MS) beat(b, [a], t);
  assert.equal(g.down, true);
  const wave = g.upAt, up = beat(b, [a], wave);
  assert.deepEqual(up.filter((e) => e.k === 'nup'), [{ k: 'nup', n: 'n1' }]);
  assert.deepEqual([g.down, g.hp, g.x, g.z, g.safeTo, g.upAt], [false, 360, SF[5][0], SF[5][1], wave + SIEGE_PROTECT_MS, 0], 'whole, at the defenders\' camp, protected');
  beat(b, [a], wave + 1000);
  assert.deepEqual([g.tx, g.tz], [SF[2][0], SF[2][1]], 'the next beat it walks back to its post');
  // with no guard standing there the attacker raises it
  const b2 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  siegeNpcFell(b2, b2.npcs[1], T); b2.npcs[1].upAt = T + 3_600_000;
  const a2 = fighter('A', 'attack', -40, 6);
  const ev = []; for (let t = T; t <= T + 21_000; t += SIEGE_TICK_MS) ev.push(...beat(b2, [a2], t));
  assert.ok(ev.some((e) => e.k === 'banner' && e.i === 2 && e.side === 'attack'));
  // a fighter a guard fells: its own side's wave
  const b3 = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([3, -1, 0, 0, 1], 'palace') });
  const weak = fighter('W', 'attack', 0, -38.5, { hp: 5 });
  beat(b3, [weak], T);
  const e = beat(b3, [weak], T + 1000).find((x) => x.k === 'nhit');
  assert.deepEqual([e.fell, weak.down, weak.hp, weak.upAt], [true, true, 0, siegeNextWave(T + 1000, siegeWaveMs(b3, 'attack'))]);
});

test('SEAT2b part two (c) A BLOW ON ONE IS THE REFEREE\'S: refereeBlow judges a guard as a fighter (the reach to where its walk has carried it, on the field\'s ground); the sides kept - an attacker\'s foe a guard, a defender\'s a rebel and the Captain (mutants: the pose; the ground; the sides)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD, works: worksOf([0, -1, 0, 0, 1], 'palace') });
  const g = b.npcs[0];
  g.tx = 0; g.tz = -30 * M; g.at = T;   // walking north at five a second
  assert.deepEqual(siegeNpcAt(g, T + 1000), [0, -35 * M]);
  assert.deepEqual(siegeNpcPose(g, T + 1000, 7, 99), { x: 0, y: 7, z: -35 * M });
  assert.deepEqual(siegeNpcPose(g, T + 1000, null, 99), { x: 0, y: 99, z: -35 * M });
  const by = { ...newFighter(10, T), pose: { x: 0, y: 0, z: -33 * M } };
  const held = { w: 123, m: 9 };
  const r = refereeBlow(by, g, { from: by.pose, at: siegeNpcPose(g, T + 1000, 0), held, d: 50, r: 0 }, T + 1000);
  assert.deepEqual([r.ok, r.dealt, g.hp], [true, 50, 310]);
  const far = { ...newFighter(10, T), pose: { x: 0, y: 0, z: -20 * M } };
  assert.equal(refereeBlow(far, g, { from: far.pose, at: siegeNpcPose(g, T + 1000, 0), held, d: 50, r: 0 }, T + 1000).why, 'reach');
  siegeNpcFell(b, g, T + 1000);
  assert.deepEqual([g.x, g.z, g.tx, g.tz, g.at], [0, -35 * M, 0, -35 * M, T + 1000], 'felled where its walk had carried it, and stopped');
  assert.deepEqual([siegeNpcFoe(g, 'attack'), siegeNpcFoe(g, 'defend'), siegeNpcFoe(g, 'watch'), siegeNpcFoe({ kind: 'rebel' }, 'defend'), siegeNpcFoe({ kind: 'captain' }, 'attack')], [true, false, false, true, false]);
});

test('SEAT2b part two (c) THE RISING (7.7): a revolt is its window long with no banner and no Throne; its Captain (`n0`, vitality 400) at the palace door and twelve rebels on a ring four metres about it; the rebels mark the defenders; the Captain felled puts it down (`defend`), his standing at the window\'s end lapses the Charter (`attack`); it earns no Honours (mutants: the length; the banners; the ring; the marks; the two ends; Honours)', () => {
  const b = newBattle({ kind: 'revolt', tier: 'palace', startMs: T, field: FIELD });
  assert.deepEqual([b.endMs - T, b.banners, b.npcs.length, b.npcs[0].kind, b.npcs[0].max], [2 * 3600 * 1000, [], 13, 'captain', 400]);
  assert.deepEqual(b.npcs.map((n) => n.id), revoltRising(FIELD).map((n) => n.id));
  for (const n of b.npcs.slice(1)) assert.ok(Math.abs(Math.hypot(n.x - SF[3][0], n.z - SF[3][1]) / M - 4) < 0.02, 'the ring (whole room units)');
  assert.deepEqual([b.npcs[1].kind, b.npcs[1].max], ['rebel', 340]);
  const d = fighter('D', 'defend', 0, -30, { hp: 10_000, max: 10_000 });
  beat(b, [d], T);
  assert.ok(b.npcs.every((n) => n.tg === 'D'), 'all of them at the defender');
  assert.equal(siegeRevoltDown(b), false);
  siegeNpcFell(b, b.npcs[0], T + 1500);
  assert.equal(siegeRevoltDown(b), true);
  assert.equal(b.npcs[0].upAt, 0, 'the Captain never rises');
  assert.deepEqual(beat(b, [d], T + 2000).filter((e) => e.k === 'end'), [{ k: 'end', result: 'defend' }]);
  assert.equal(honoured({ ...d, felled: 3, stood: 9999 }, b), false, 'no Honours in a revolt');
  const b2 = newBattle({ kind: 'revolt', tier: 'palace', startMs: T, field: FIELD });
  let ends = [];
  for (let t = T; t <= b2.endMs && !b2.result; t += 60_000) ends = beat(b2, [], t);
  assert.deepEqual([b2.result, ends.at(-1)], ['attack', { k: 'end', result: 'attack' }]);
  const rebel = newBattle({ kind: 'revolt', tier: 'palace', startMs: T, field: FIELD }).npcs[3];
  siegeNpcFell(b2, rebel, T);
  assert.equal(rebel.upAt, 0, 'a rebel never rises');
  assert.equal(honoured({ felled: 1 }, newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: FIELD })), true);
});

test('SEAT2b part two (c) THE FIELD\'S FRAME AND THE WIRE: `np` each one `[id, code, vitality, whole, x, z, tx, tz, down, its blow\'s landing]` where it stands at the frame\'s moment, `v` 1 for a revolt (no banners); validSiegeOut keeps them and refuses a bad row; validSiegeIn takes a blow or a cast on one, never a challenge; `hp` and `fell` name one, never one felled by another (mutants: the rows; the moment; the revolt\'s banners; the wire\'s checks)', () => {
  const b = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(CROWN_SF, 'crown'), works: worksOf([0, 0, 0, 0, 1], 'crown') });
  const g = b.npcs[0];
  g.tx = g.x + 10 * M; g.at = T;
  const f = siegeFieldFrame(b, [1, 0, 0], T + 1000);
  assert.deepEqual(f.np[0], ['n0', 1, 360, 360, g.x + 5 * M, g.z, g.x + 10 * M, g.z, 0, 0]);
  assert.equal(f.v, undefined);
  const w = validSiegeOut(JSON.parse(JSON.stringify(f)));
  assert.deepEqual(w.np, f.np);
  for (const bad of [['n13', 1, 1, 1, 0, 0, 0, 0, 0, 0], ['n0', 4, 1, 1, 0, 0, 0, 0, 0, 0], ['n0', 1, 2, 1, 0, 0, 0, 0, 0, 0], ['n0', 1, 1, 1, 0.5, 0, 0, 0, 0, 0], ['n0', 1, 1, 1, 0, 0, 0, 0, 2, 0], ['n0', 1, 1, 1, 0, 0, 0, 0, 0, -1], ['n0', 1, 1, 1, 0, 0, 0, 0, 0]]) {
    assert.equal(validSiegeOut({ ...f, np: [bad] }), null, JSON.stringify(bad));
  }
  assert.equal(validSiegeOut({ ...f, np: [f.np[0], f.np[0]] }), null, 'each id once');
  const rv = newBattle({ kind: 'revolt', tier: 'palace', startMs: T, field: FIELD });
  const rf = JSON.parse(JSON.stringify(siegeFieldFrame(rv, [0, 1, 0], T)));
  assert.deepEqual([rf.v, rf.b, rf.np.length], [1, [], 13]);
  assert.deepEqual(validSiegeOut(rf).np.length, 13);
  assert.equal(validSiegeOut({ ...rf, v: undefined }), null, 'no banners: a revolt\'s alone');
  assert.equal(validSiegeOut({ ...rf, v: 2 }), null);
  assert.equal(validSiegeOut({ ...f, v: 1 }), null, 'a revolt has no banners');
  assert.deepEqual(validSiegeIn({ k: 'blow', to: 'n3', w: 123, m: 9, d: 40, r: 0 }), { k: 'blow', to: 'n3', w: 123, m: 9, d: 40, r: 0 });
  assert.deepEqual(validSiegeIn({ k: 'cast', to: 'n3', d: 40 }), { k: 'cast', to: 'n3', d: 40, h: 0 });
  assert.equal(validSiegeIn({ k: 'ask', to: 'n3' }), null);
  assert.equal(validSiegeIn({ k: 'blow', to: 'n13', w: 123, m: 9, d: 40, r: 0 }), null);
  assert.deepEqual(validSiegeOut({ k: 'hp', id: 'n3', h: 10, m: 340 }), { k: 'hp', id: 'n3', h: 10, m: 340 });
  assert.deepEqual(validSiegeOut({ k: 'fell', id: 'n3', by: 'peer-0001' }), { k: 'fell', id: 'n3', by: 'peer-0001' });
  assert.deepEqual(validSiegeOut({ k: 'fell', id: 'peer-0001', by: 'n3' }), { k: 'fell', id: 'peer-0001', by: 'n3' });
  assert.equal(validSiegeOut({ k: 'fell', id: 'n2', by: 'n3' }), null);
});

test('SEAT2b part two (c) A REVOLT\'S PASS AND ITS WEEK: its pass the holder\'s defenders\' or a spectator\'s, never an attacker\'s, with no works; its field settled on its first defender\'s; its schedule the holder\'s window (a crown\'s its Saturday slot), two hours long and held two; its words (mutants: the pass; the field; the window; the length)', () => {
  const c = { o: 'siege', s: 'acct-x', sk: 5, sw: 9, sd: 'defend', st: 'palace', sn: 'revolt', sb: 1000, se: 1000 + 7200, sf: SF, i: 1, e: 2 };
  assert.equal(siegePassValid(c), true);
  assert.equal(siegePassValid({ ...c, sd: 'watch' }), true);
  assert.equal(siegePassValid({ ...c, sd: 'attack' }), false);
  assert.equal(siegePassValid({ ...c, sx: [0, -1, 0, 0, 0] }), false, 'a revolt carries no works');
  assert.equal(settleField([{ side: 'defend', field: 'X', at: 1 }], false, 'revolt'), 'X');
  assert.equal(settleField([{ side: 'defend', field: 'X', at: 1 }], false), null, 'a siege waits on both sides');
  assert.deepEqual([battleLengthMs({ kind: 'revolt', tier: 'crown' }), battleSpanMs({ kind: 'revolt', tier: 'crown' })], [2 * 3600_000, 2 * 3600_000]);
  assert.deepEqual([atSiegeWindow({ kind: 'revolt' }), atSiegeWindow({ kind: 'siege' }), atSiegeWindow({ kind: 'tourney' })], [true, true, false]);
  const W = 30;
  const { placed } = placeBattles(W, [
    { key: 1, kind: 'revolt', tier: 'palace', attacker: '', defender: 'g1', window: { day: 1, hour: 21 } },
    { key: 2, kind: 'revolt', tier: 'crown', kingdom: 'wayrest', attacker: '', defender: 'g2', window: { day: 0, hour: 18 } },
    { key: 3, kind: 'siege', tier: 'palace', attacker: 'g3', defender: 'g4', window: { day: 1, hour: 21 } },
  ]);
  const by = new Map(placed.map((p) => [p.key, p]));
  assert.deepEqual([by.get(1).startsAt, by.get(1).endsAt - by.get(1).startsAt], [siegeStartMs(W, 1, 21), 2 * 3600_000]);
  assert.equal(by.get(2).startsAt, siegeStartMs(W, CROWN_SIEGE_SLOT.wayrest.day, CROWN_SIEGE_SLOT.wayrest.hour), 'a crown\'s at its slot');
  assert.equal(by.get(3).moved, false, 'no guild in common: the empty attacker is none');
  const seat = { key: 1, name: 'Anticlere', tier: 'palace' };
  const SH = { name: 'Silver Hand', tag: 'SH' };
  assert.equal(chronicleLine({ kind: 'revolt-down', week: 3, data: { guild: SH } }, seat).replace(/^.*?, /, ''), 'Anticlere rose against Silver Hand <SH>. The rebel captain fell at the palace door, and the Charter held.');
  assert.match(chronicleLine({ kind: 'revolt-stood', week: 3, data: { guild: SH } }, seat), /rose against Silver Hand <SH>, and the rebel captain held the palace door\. .* lapsed\.$/);
  assert.match(chronicleLine({ kind: 'revolt', week: 3, data: { guild: SH } }, seat), /Standing under Silver Hand <SH> fell to nothing, and the town rose in revolt\.$/);
  assert.equal(seatBattleLine({ kind: 'revolt', guild: null, against: SH }), 'The town rises against Silver Hand <SH> this week. A Rebel Captain holds the palace door.');
  assert.match(battleAnnouncement({ kind: 'revolt', startsAt: siegeStartMs(W, 1, 21), defenderGuild: SH, attackerGuild: null }, 'Anticlere'),
    /^Anticlere rises against Silver Hand <SH>: a Rebel Captain and twelve rebels hold its palace door\. The revolt begins Thursday at 21:00 UTC: fell the Captain within two hours, or the Charter lapses\.$/);
  assert.equal(STANDING_CHANGES.revoltTo, 20);
});

test('SEAT2b part two (c) THE TURNING\'S PLAN (7.7): a held seat whose Standing after its week is nought revolts - unless a Right of Siege is granted there (the siege takes the window); a Charter whose revolt was not put down (`revolted`) lapses unreckoned - no upkeep, no Edict, no Standing, no Right (mutants: the due; the siege first; the lapse)', () => {
  const holder = (o = {}) => ({ guild: 'g1', standing: 0, truceWeek: null, tithe: 6, owed: 0, watched: false, gates: 0, writs: 0, edict: null, ...o });
  const seats = [{ key: 1, tier: 'palace', holder: holder(), guilds: [{ guild: 'g1', influence: 0, legacy: 0, pledgedAt: 0 }] }];
  const treasuries = new Map([['g1', 1e6]]);
  const p = turningPlan({ week: 10, seats, treasuries });
  assert.equal(p.standings[0].standing, 0, 'its week left it none');
  assert.deepEqual(p.revolts, [{ key: 1, guild: 'g1' }]);
  const kept = turningPlan({ week: 10, seats: [{ ...seats[0], holder: holder({ standing: 40 }) }], treasuries });
  assert.deepEqual(kept.revolts, []);
  const challenged = turningPlan({ week: 10, seats: [{ ...seats[0], guilds: [...seats[0].guilds, { guild: 'g2', influence: 1e7, legacy: 0, pledgedAt: 0 }] }], treasuries });
  assert.deepEqual([challenged.rights.length, challenged.revolts], [1, []]);
  const lapsed = turningPlan({ week: 10, seats: [{ ...seats[0], holder: holder({ revolted: true, edict: 'market-day' }) }], treasuries });
  assert.deepEqual(lapsed.upkeep, [{ key: 1, guild: 'g1', amount: 0, paid: 0, owed: 0, state: 'revolt' }]);
  assert.deepEqual([lapsed.standings, lapsed.edicts, lapsed.rights, lapsed.revolts, lapsed.held], [[], [], [], [], []]);
});
