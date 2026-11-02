// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE BATTLE'S LAW -
// net/siege/siegeRef.js's battlefield (the banners, the Throne, the clock, the no-shows, Honours), the service's pass
// (net/identityToken.js's `siege` order) and the relay's receipt (net/siege/siegeReceipt.js). bible/11-Multiplayer/Seats-Arc.md
// 6.2-6.8; `06-Systems/Online-Arc.md` SEAT2a (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIEGE_BANNER, SIEGE_THRONE, SIEGE_LENGTH_MS, SIEGE_FORFEIT_MS, SIEGE_SPECTATORS_MAX, SIEGE_TICK_MS, SIEGE_UNITS_PER_M, SIEGE_OPENS_MS,
  fieldOf, newBattle, battleStep, honoured, siegeNextBeat, siegeCampPose, siegeFieldFrame, siegeBannerCount,
  siegeBreach,   // SEAT2b part two (b): a crown's Gatehouse breached
} from '../../src/net/siege/siegeRef.js';
import { BATTLE_LENGTH_MS, SIGN_CLOSES_MS } from '../../src/net/townSeatLaw.js';
import { mintSiegeOrder, verifyOrder, orderValid, siegePassValid, SIEGE_PASS_SPAN_S } from '../../src/net/identityToken.js';
import { mintSiegeReceipt, readSiegeReceipt, verifySiegeReceipt, siegeReceiptValid, SIEGE_RECEIPT_TTL_S, SIEGE_RESULTS } from '../../src/net/siege/siegeReceipt.js';
import { mintWatchReceipt, verifyWatchReceipt } from '../../src/net/watchReceipt.js';
import { verifyReceipt } from '../../src/net/gate/gateReceipt.js';
import { parseClient, relayFightsBattles, SIEGE_BATTLE_RELAY_MIN } from '../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000_000;
/** Gate, Market, Temple, the Throne, the attackers' camp, the defenders' (metres). */
const SF = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const fighter = (side, x, z, o = {}) => ({ side, pose: { x: x * M, y: 0, z: z * M }, down: false, here: true, ...o });
/** Beat a battle second by second from `from` to `to` (ms), the fighters as they stand. */
const run = (b, fs, from, to) => { const out = []; for (let t = from; t <= to; t += SIEGE_TICK_MS) out.push(...battleStep(b, fs, t)); return out; };

test('SEAT2a THE FIELD: a pass\'s field read in order - the banners, the Throne, the two camps; a palace three banners, a crown four; the battle\'s length the schedule\'s own (pinned EQUAL to townSeatLaw.js - the relay bundles this leaf); a siege\'s banners start the holder\'s, a Tourney\'s no one\'s (mutants: the order; the count; the lengths; the start)', () => {
  assert.deepEqual(fieldOf(SF, 'palace'), { banners: SF.slice(0, 3), throne: SF[3], camps: { attack: SF[4], defend: SF[5] } });
  assert.equal(fieldOf(SF, 'crown'), null, 'a crown needs four banners');
  assert.equal(fieldOf([...SF, [0, 0]], 'palace'), null, 'and a palace no more than its three');
  assert.ok(fieldOf([...SF.slice(0, 3), [0, 0], ...SF.slice(3)], 'crown'));
  assert.equal(fieldOf([...SF.slice(0, 5), [0, NaN]], 'palace'), null);
  assert.equal(fieldOf('nope', 'palace'), null);
  assert.deepEqual([siegeBannerCount('palace'), siegeBannerCount('crown')], [3, 4]);
  assert.deepEqual({ ...SIEGE_LENGTH_MS }, { ...BATTLE_LENGTH_MS }, 'the relay\'s clock is the schedule\'s');
  assert.equal(SIEGE_OPENS_MS, SIGN_CLOSES_MS, 'the door opens as the signing closes');
  assert.deepEqual([SIEGE_BANNER.radiusM, SIEGE_BANNER.raiseS, SIEGE_BANNER.decayPerS], [8, 20, 1]);
  assert.deepEqual([SIEGE_THRONE.palace.banners, SIEGE_THRONE.palace.holdS, SIEGE_THRONE.crown.banners, SIEGE_THRONE.crown.holdS, SIEGE_THRONE.decayPerS], [2, 120, 3, 180, 1]);
  assert.deepEqual([SIEGE_FORFEIT_MS, SIEGE_SPECTATORS_MAX, SIEGE_TICK_MS], [600_000, 60, 1000]);
  const s = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf([...SF.slice(0, 3), [0, 0], ...SF.slice(3)], 'crown') });
  assert.deepEqual([s.endMs - T, s.banners.map((bn) => bn.side)], [45 * 60_000, ['defend', 'defend', 'defend', 'defend']]);
  const t = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.deepEqual([t.endMs - T, t.banners.map((bn) => bn.side)], [20 * 60_000, [null, null, null]]);
  assert.equal(newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') }).endMs - T, 30 * 60_000);
});

test('SEAT2a THE BANNERS: raised by a side alone within 8 m in 20 s; frozen while both stand there; falling back a second a second when left; the other side\'s half-raise begun again; nothing before the start; a fallen or absent fighter holds nothing (mutants: the radius; the twenty; the freeze; the decay; the reset; the start; the fallen; the absent)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  const a = fighter('attack', 0, 40 - 7.9);
  assert.deepEqual(battleStep(b, [a], T - 1000), [], 'not before the start');
  assert.equal(b.banners[0].raise, 0);
  run(b, [a], T, T + 10_000);
  assert.equal(b.banners[0].raise, 10, 'ten beats in (the first at the start counts nothing)');
  const d = fighter('defend', 0, 40);
  run(b, [a, d], T + 11_000, T + 30_000);
  assert.deepEqual([b.banners[0].side, b.banners[0].raise], ['defend', 10], 'contested: frozen');
  run(b, [a, fighter('defend', 0, 40, { down: true })], T + 31_000, T + 39_000);
  assert.deepEqual([b.banners[0].side, b.banners[0].raise], ['defend', 20 - 1], 'a fallen defender holds nothing - nineteen');
  const ev = run(b, [a], T + 40_000, T + 40_000);
  assert.deepEqual(ev, [{ k: 'banner', i: 0, side: 'attack' }], 'raised at twenty');
  assert.deepEqual([b.banners[0].side, b.banners[0].raise, b.raised], ['attack', 0, true]);
  // left half-raised: falling back a second a second; the other side's start begins again
  run(b, [fighter('defend', 0, 40)], T + 41_000, T + 50_000);
  assert.deepEqual([b.banners[0].raise, b.banners[0].by], [10, 'defend']);
  run(b, [], T + 51_000, T + 54_000);
  assert.equal(b.banners[0].raise, 6, 'falling back');
  run(b, [fighter('attack', 0, 40)], T + 55_000, T + 55_000);
  assert.deepEqual([b.banners[0].raise, b.banners[0].by], [6 - 1, 'defend'], 'the holder standing at its own banner lets the other\'s raise fall back');
  run(b, [fighter('defend', 0, 40)], T + 56_000, T + 56_000);
  assert.deepEqual([b.banners[0].raise, b.banners[0].by], [6, 'defend']);
  run(b, [fighter('attack', 0, 48.1), fighter('defend', 0, 40, { here: false })], T + 57_000, T + 59_000);
  assert.equal(b.banners[0].raise, 3, 'out of the radius, or out of the room: nobody');
  // the Market, raised by attackers alone, from a fresh start
  const m = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  m.banners[1].raise = 5; m.banners[1].by = 'defend';
  run(m, [fighter('attack', 40, 0)], T, T + 1000);
  assert.deepEqual([m.banners[1].raise, m.banners[1].by], [1, 'attack'], 'the other side\'s half-raise begun again');
});

test('SEAT2a THE THRONE AND THE CLOCK: open to the attackers at 2 of 3 banners (3 of 4 at a crown), held uncontested 120 s (180) it is theirs, falling back a second a second otherwise, frozen while contested; at time a siege is the holder\'s, a Tourney the side with more banners\' (a dead heat a tie); a beat is never more than five seconds (mutants: the threshold; the hold; the decay; the contest; the time; the count; the clamp)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  const atThrone = fighter('attack', 0, -40);
  b.banners[0].side = 'attack';
  run(b, [atThrone], T, T + 10_000);
  assert.equal(b.throne, 0, 'one banner: shut');
  b.banners[1].side = 'attack';
  run(b, [atThrone], T + 11_000, T + 70_000);
  assert.equal(b.throne, 60);
  run(b, [atThrone, fighter('defend', 0, -40)], T + 71_000, T + 80_000);
  assert.equal(b.throne, 60, 'contested: frozen');
  run(b, [], T + 81_000, T + 90_000);
  assert.equal(b.throne, 50, 'left: falling back');
  b.banners[1].side = 'defend';
  run(b, [atThrone], T + 91_000, T + 95_000);
  assert.equal(b.throne, 45, 'shut again: falling back though the attackers stand there');
  b.banners[1].side = 'attack';
  const ev = run(b, [atThrone], T + 96_000, T + 96_000 + 74_000);
  assert.deepEqual(ev.at(-1), { k: 'end', result: 'attack' });
  assert.equal(b.result, 'attack');
  assert.deepEqual(battleStep(b, [atThrone], T + 200_000), [], 'an ended battle beats no more');
  // the clamp: a late alarm's beat counts five seconds at most
  const c = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  battleStep(c, [], T); battleStep(c, [fighter('attack', 0, 40)], T + 60_000);
  assert.equal(c.banners[0].raise, 5);
  // a crown: 3 of 4, and 180 s
  const k = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf([...SF.slice(0, 3), [0, 0], ...SF.slice(3)], 'crown') });
  k.banners[0].side = 'attack'; k.banners[1].side = 'attack';
  run(k, [fighter('attack', 0, -40)], T, T + 5000);
  assert.equal(k.throne, 0, 'two of four: shut');
  k.banners[2].side = 'attack';
  // SEAT2b part two (b) (PIN MOVED - 6.2: a crown's Throne "opens while the attackers hold 3 of 4 banners AND the
  // Gatehouse is breached"; SEAT2a opened it on the banners alone until the Gatehouse was raised): three of four, its
  // Gatehouse standing - shut; breached, its 180 s
  run(k, [fighter('attack', 0, -40)], T + 6000, T + 9000);
  assert.equal(k.throne, 0, 'three of four, the Gatehouse standing: shut');
  siegeBreach(k);
  run(k, [fighter('attack', 0, -40)], T + 10_000, T + 10_000 + 178_000);
  assert.equal(k.result, null, 'not at 179');
  run(k, [fighter('attack', 0, -40)], T + 189_000, T + 189_000);
  assert.equal(k.result, 'attack');
  // time
  const h = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  const both = [fighter('attack', 0, 80), fighter('defend', 0, -60)];
  battleStep(h, both, T + SIEGE_LENGTH_MS.palace - 1000);
  assert.equal(h.result, null);
  assert.deepEqual(battleStep(h, both, T + SIEGE_LENGTH_MS.palace), [{ k: 'end', result: 'defend' }], 'at time the holder keeps it');
  // a Tourney's count
  const tour = (sides) => { const t = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') }); sides.forEach((s, i) => { t.banners[i].side = s; }); battleStep(t, both, T + SIEGE_LENGTH_MS.tourney); return t.result; };
  assert.equal(tour(['attack', 'attack', 'defend']), 'attack');
  assert.equal(tour(['defend', null, null]), 'defend');
  assert.equal(tour(['attack', 'defend', null]), 'tie');
  assert.equal(tour([null, null, null]), 'tie');
  const td = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.deepEqual(run(td, [fighter('defend', 0, 40)], T, T + 20_000), [{ k: 'banner', i: 0, side: 'defend' }]);
  assert.equal(td.raised, false, 'a banner the defenders raise is no attackers\' banner (6.8)');
  const tt = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  tt.banners[0].side = 'attack'; tt.banners[1].side = 'attack';
  run(tt, [fighter('attack', 0, -40)], T, T + 200_000);
  assert.equal(tt.result, null, 'a Tourney has no Throne');
});

test('SEAT2a THE NO-SHOWS AND HONOURS: no attacker in a siege\'s room by ten minutes is a forfeit, nobody at all `absent`; a Tourney\'s absent contender just holds nothing; a fighter honoured for felling a foe or for standing half the battle in the room; the beat lands on the start, the forfeit mark and the end (mutants: the forfeit; the absence; the Tourney\'s; the stood clock; the half; the felled; the beat\'s marks)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  const d = fighter('defend', 0, -60);
  battleStep(b, [d], T + SIEGE_FORFEIT_MS - 1000);
  assert.equal(b.result, null);
  assert.deepEqual(battleStep(b, [d], T + SIEGE_FORFEIT_MS), [{ k: 'end', result: 'forfeit' }]);
  const n = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.deepEqual(battleStep(n, [fighter('defend', 0, 0, { here: false })], T + SIEGE_FORFEIT_MS), [{ k: 'end', result: 'absent' }], 'a defender not in the room came no more than an attacker');
  const early = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  battleStep(early, [fighter('attack', 0, 80)], T - 1000);
  battleStep(early, [d], T + SIEGE_FORFEIT_MS);
  assert.equal(early.result, 'forfeit', 'an attacker gone before the start never came: the battle is not joined before it');
  const late = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  battleStep(late, [fighter('attack', 0, 80)], T + 60_000);
  battleStep(late, [], T + SIEGE_FORFEIT_MS);
  assert.equal(late.result, null, 'an attacker came and went: no forfeit');
  const tour = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  battleStep(tour, [d], T + SIEGE_FORFEIT_MS);
  assert.equal(tour.result, null, 'a Tourney runs its clock');
  // Honours
  const h = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  const stayed = fighter('defend', 0, -60), left = fighter('defend', 0, -60), feller = fighter('attack', 0, 80);
  run(h, [stayed, left, feller], T, T + 60_000);
  left.here = false; feller.here = false; feller.felled = 1;
  run(h, [stayed, left, feller], T + 61_000, T + 200_000);
  assert.deepEqual([stayed.stood, left.stood], [200, 60]);
  assert.equal(honoured(stayed, h), true);
  assert.equal(honoured(left, h), false, 'sixty of two hundred');
  assert.equal(honoured(feller, h), true, 'a foe felled');
  left.stood = 100;
  assert.equal(honoured(left, h), true, 'exactly half');
  left.stood = 99;
  assert.equal(honoured(left, h), false);
  // the beat
  assert.equal(siegeNextBeat(h, T - 300), T, 'the start');
  assert.equal(siegeNextBeat(h, T + 500), T + 1500);
  const f = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.equal(siegeNextBeat(f, T + SIEGE_FORFEIT_MS - 300), T + SIEGE_FORFEIT_MS, 'the forfeit mark');
  f.attackSeen = true;
  assert.equal(siegeNextBeat(f, T + SIEGE_FORFEIT_MS - 300), T + SIEGE_FORFEIT_MS + 700, 'no mark once an attacker came');
  assert.equal(siegeNextBeat(f, f.endMs - 1), f.endMs, 'the end');
});

test('SEAT2a THE CAMP AND THE FRAME: a camp is a pose at the side\'s point, the height and facing kept; the field\'s frame each banner [held, whole seconds, by whom], the Throne\'s whole seconds, the clock and who is in (mutants: the camp; the codes; the floors)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.deepEqual(siegeCampPose(b, 'attack', { x: 1, y: 7, z: 2, yaw: 1.5, pitch: 0.3 }), { x: SF[4][0], y: 7, z: SF[4][1], yaw: 1.5, pitch: 0 });
  assert.deepEqual(siegeCampPose(b, 'defend', null), { x: SF[5][0], y: 0, z: SF[5][1], yaw: 0, pitch: 0 });
  b.banners[0] = { side: 'attack', raise: 3.7, by: 'defend' };
  b.banners[2] = { side: 'defend', raise: 0, by: 'attack' };
  b.banners[1] = { side: null, raise: 0, by: null };
  b.throne = 12.9;
  assert.deepEqual(siegeFieldFrame(b, [3, 4, 5]), { k: 'f', b: [[1, 3, 2], [0, 0, 0], [2, 0, 1]], th: 12, s: T, e: T + SIEGE_LENGTH_MS.palace, n: [3, 4, 5] });
});

test('SEAT2a THE PASS: the service\'s `siege` order - the account, the seat and week, a side or a spectator\'s, the battle\'s kind, tier, start, window and field (a palace six points, a crown seven, whole units within their bound); its fields never on another kind, another kind\'s never on it; verified only as a siege\'s; the hello carries it as a token\'s shape (mutants: each field\'s check; the disjointness; the kind)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const base = { s: 'acct-0001', sk: 3021, sw: 20, sd: 'attack', st: 'palace', sn: 'siege', sb: nowS, se: nowS + 7200, sf: SF };
  const pass = await mintSiegeOrder(base, kp.privateKey, { subtle, nowS });
  const v = await verifyOrder(pass, kp.publicKey, { subtle, nowS, kind: 'siege' });
  assert.ok(v.ok);
  assert.deepEqual({ ...v.claims, i: 0, e: 0 }, { o: 'siege', ...base, i: 0, e: 0 });
  assert.equal((await verifyOrder(pass, kp.publicKey, { subtle, nowS, kind: 'guild' })).ok, false, 'never another kind');
  const ok = (o) => orderValid({ o: 'siege', ...base, ...o, i: nowS, e: nowS + 60 });
  assert.ok(ok({}));
  assert.ok(ok({ sd: 'watch' }) && ok({ sd: 'defend' }) && ok({ sn: 'tourney' }));
  assert.ok(ok({ st: 'crown', sf: [...SF, [0, 0]] }));
  for (const bad of [{ sk: -1 }, { sk: 2 ** 32 }, { sk: 1.5 }, { sw: -1 }, { sd: 'neutral' }, { st: 'castle' }, { sn: 'raid' }, { sb: 0 }, { se: nowS }, { se: nowS + SIEGE_PASS_SPAN_S + 1 },
    { sf: SF.slice(1) }, { st: 'crown' }, { sf: [...SF.slice(1), [0.5, 0]] }, { sf: [...SF.slice(1), [1e9 + 1, 0]] }, { sf: [...SF.slice(1), [0]] }, { sf: 'x' }, { mu: 0 }, { lv: 3 }, { gi: 'g-1' }]) {
    assert.equal(ok(bad), false, JSON.stringify(bad));
  }
  assert.ok(ok({ se: nowS + SIEGE_PASS_SPAN_S, sf: [...SF.slice(1), [-1e9, 1e9]] }), 'the bounds are inclusive');
  assert.equal(SIEGE_PASS_SPAN_S, 2 * 3600, 'a window two hours long (6.3)');
  assert.equal(siegePassValid({ ...base, sd: undefined }), false);
  for (const f of ['sk', 'sw', 'sd', 'st', 'sn', 'sb', 'se', 'sf']) {
    assert.equal(orderValid({ o: 'guild', s: 'acct-0001', [f]: base[f], i: nowS, e: nowS + 60 }), false, `${f} on another kind`);
  }
  await assert.rejects(mintSiegeOrder({ ...base, sd: 'neutral' }, kp.privateKey, { subtle, nowS }), /refused/);
  // the hello's own field, a token's shape
  const hello = { t: 'hello', id: 'peer-0001', secret: 'a'.repeat(32), name: 'x', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null };
  const p = parseClient(JSON.stringify({ ...hello, sp: pass }), { hasHello: false });
  assert.equal(p.sp, pass);
  assert.deepEqual(parseClient(JSON.stringify({ ...hello, sp: 'not a pass' }), { hasHello: false }), { error: 'bad pass' });
  assert.deepEqual(parseClient(JSON.stringify({ ...hello, sp: 7 }), { hasHello: false }), { error: 'bad pass' });
  assert.equal('sp' in parseClient(JSON.stringify(hello), { hasHello: false }), false);
  assert.equal(SIEGE_BATTLE_RELAY_MIN, 147);   // PIN MOVED (main's FRIENDS-SYNC took world142): world145 until that merge   // PIN MOVED (MERGE #519-#523): main's ELITE FOES took world143 - world146 until that merge
  assert.deepEqual(['world146', 'world148', 'world148', 'x141', null].map(relayFightsBattles), [false, true, true, false, false]);
});

test('SEAT2a THE RECEIPT: `s1` - the account, the seat and week, its side, the result, whether a banner was raised, its Honours - signed by the relay\'s key, verified rung for rung, read unsigned by the client; never the gate\'s, the raid\'s or the Watch\'s, nor they it (mutants: each field; the TTL; the version; the disjointness)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const what = { s: 'acct-0001', sk: 3021, sw: 20, sd: 'defend', r: 'forfeit', a: 0, h: 1 };
  const rc = await mintSiegeReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(rc.startsWith('s1.'));
  const v = await verifySiegeReceipt(rc, kp.publicKey, { subtle, nowS });
  assert.deepEqual(v, { ok: true, claims: { ...what, th: 0, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S } });   // PIN MOVED (AUDIT-SEATS): T1 - every receipt carries `th`, 0 where the Throne was not reached
  assert.equal(SIEGE_RECEIPT_TTL_S, 7 * 24 * 3600);
  assert.deepEqual([...SIEGE_RESULTS], ['attack', 'defend', 'tie', 'forfeit', 'absent']);
  assert.deepEqual((await verifySiegeReceipt(rc, kp.publicKey, { subtle, nowS: nowS + SIEGE_RECEIPT_TTL_S })), { ok: false, why: 'expired' });
  assert.deepEqual((await verifySiegeReceipt(rc, kp.publicKey, { subtle, nowS: nowS - 60 })), { ok: false, why: 'future' });
  const unsigned = await mintSiegeReceipt(what, null, { subtle, nowS });
  assert.deepEqual(await verifySiegeReceipt(unsigned, kp.publicKey, { subtle, nowS }), { ok: false, why: 'unsigned' });
  assert.deepEqual(readSiegeReceipt(unsigned), { ...what, th: 0, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S, signed: false });   // PIN MOVED (AUDIT-SEATS): T1 - and `th`
  assert.equal(readSiegeReceipt(rc).signed, true);
  const [, body, sig] = rc.split('.');
  // a signature changed in its first character - never the same signature (CROWN1's fix: replacing the last two with
  // `AA` left one signature in 256 unchanged, and that run verified)
  const forged = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
  assert.notEqual(forged, sig);
  assert.deepEqual(await verifySiegeReceipt(`s1.${body}.${forged}`, kp.publicKey, { subtle, nowS }), { ok: false, why: 'signature' });
  assert.deepEqual(await verifySiegeReceipt(`r1.${body}.${sig}`, kp.publicKey, { subtle, nowS }), { ok: false, why: 'version' });
  assert.equal((await verifyReceipt(rc, kp.publicKey, { subtle, nowS })).ok, false, 'never a gate\'s');
  assert.equal((await verifyWatchReceipt(rc, kp.publicKey, { subtle, nowS })).ok, false, 'never a Watch\'s');
  const watch = await mintWatchReceipt({ s: 'acct-0001', x: 1, y: 1, c: 1 }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifySiegeReceipt(watch, kp.publicKey, { subtle, nowS })).ok, false, 'nor a Watch\'s a siege\'s');
  const valid = (o) => siegeReceiptValid({ ...what, ...o, i: nowS, e: nowS + 60 });
  assert.ok(valid({}) && valid({ sd: 'attack', r: 'attack', a: 1, h: 0 }) && valid({ r: 'tie' }) && valid({ r: 'absent' }));
  for (const bad of [{ s: 'x' }, { sk: -1 }, { sk: 2 ** 32 }, { sw: -1 }, { sd: 'watch' }, { r: 'void' }, { a: 2 }, { h: true }, { n: 'x' }, { k: 'guest' }, { o: 'siege' }, { d: 1 }, { b: 'x' }, { w: 1 }, { x: 1 }, { y: 1 }, { c: 1 }, { t: 'x' }]) {
    assert.equal(valid(bad), false, JSON.stringify(bad));
  }
  assert.equal(siegeReceiptValid({ ...what, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S + 1 }), false, 'a week at most');
  assert.equal(siegeReceiptValid({ ...what, i: nowS, e: nowS }), false);
  await assert.rejects(mintSiegeReceipt({ ...what, r: 'void' }, kp.privateKey, { subtle, nowS }), /refused/);
});
