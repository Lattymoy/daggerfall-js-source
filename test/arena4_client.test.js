// ARENA4 (2026-10-02): THE ARENA ONLINE ON THE CLIENT, DRIVEN - the hall's fold, the mirror of a relay's bout
// (net/arenaLink.js), the receipts carried (net/arenaClaims.js), the window's online model (systems/arenaBoard.js), the
// bout driver standing a relay's bout over a fake stage (scenes/arenaBouts.js startRelay / relayWord - its puppets, its
// HUD, the verdict, my health the relay's, my yield and my misses told) and the host's glue (scenes/arenaOnline.js - the
// queue, the call to the sand, my `in`, my blows' claims).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldHall, HALL_EMPTY, mirrorOf, mirrorEvents, mirrorHealth, walkAt, walkDone } from '../src/net/arenaLink.js';
import { createArenaClaims, arenaClaimVerdict, arenaReceiptIsMine, ARENA_CLAIMS_KEY } from '../src/net/arenaClaims.js';
import { mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { createArenaBouts, ARENA_PUPPET_OWNER } from '../src/scenes/arenaBouts.js';
import { createArenaOnline, hitKindOf, newBoutId } from '../src/scenes/arenaOnline.js';
import { arenaBoard, onlineCards, ladderTitleOfReached, boardsPageOnline, teamPageOnline } from '../src/systems/arenaBoard.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { arenaLadderOf, ARENA_HIT, ARENA_FLOOR_CENTRE, ARENA_LADDER_SPEC, ARENA_BEASTS, ARENA_WEAPON_MAX, ARENA_MATERIAL_MOD, ARENA_TEAM_POINTS } from '../src/net/arenaLaw.js';
import { arenaMarks } from '../src/net/arenaBrain.js';
import { LADDER_TIERS } from '../src/systems/arenaLadder.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { weaponMaxDamage, WEAPONS } from '../src/characters/weapons.js';
import { WEAPON_MATERIAL_MODIFIER } from '../src/combat/formulas.js';
import { boutMarks } from '../src/systems/arenaFighters.js';
import { floorCentre, RING_R, ARRIVE } from '../src/world/arenaFloor.js';
import { TEAM_POINTS } from '../src/systems/arenaLeague.js';
import { ARENA_RATING_MIN, ARENA_RATING_MAX } from '../src/net/identityToken.js';
import { ARENA_ELO_MIN, ARENA_ELO_MAX, ARENA_RING_R } from '../src/net/arenaLaw.js';

const { subtle } = globalThis.crypto;
const O = '0123456789abcdef';
/** A relay's `st` word for a bout between Alva (p0) and Brann (p1). */
const pvpSt = (ph = 'call', me = 'p0', extra = {}) => ({ k: 'st', o: O, kind: 'pvp', ph, pa: 5000, fa: ph === 'fight' ? 9000 : null, lim: 180000,
  f: [['p0', 'Alva', 0, 340, 340, '', 0, -1, 0, '', ''], ['p1', 'Brann', 1, 360, 360, '', 0, -1, 0, '', '']], me, sp: 0, ...extra });
/** A ladder bout's: me against a Rogue (the relay's a0). */
const pveSt = (ph = 'call') => ({ k: 'st', o: O, kind: 'pve', ph, pa: 5000, fa: null, lim: 180000, tier: 0, bout: 1,
  f: [['p0', 'Ceryn', 0, 90, 90, '', 0, -1, 0, '', ''], ['a0', '-', 1, 26, 26, '', 1, 136, 50, '', '']], me: 'p0', sp: 2 });

test('ARENA4 the relay\'s tables are the game\'s: the ladder\'s opponents row for row, the beasts\' bodies, the weapons\' maxima and the materials, the marks, the floor\'s centre and ring, the team points, the rating\'s bounds on the token (mutants: a tier\'s opponent changed on one side; a beast\'s health; a material\'s modifier)', () => {
  assert.deepEqual(ARENA_LADDER_SPEC.map((t) => t.map((b) => b.map(([m, l]) => ({ m, l })))), LADDER_TIERS.map((t) => [...t.bouts, t.champion].map((b) => b.map((o) => ({ m: o.mobile, l: o.level })))), 'the relay\'s ladder is the game\'s');
  for (const [mob, [lv, minH, maxH, minD, maxD]] of Object.entries(ARENA_BEASTS)) {
    const b = ENEMY_BASICS[mob];
    assert.deepEqual([lv, minH, maxH, minD, maxD], [b.level, b.minHealth, b.maxHealth, b.minDamage, b.maxDamage], `beast ${mob}`);
  }
  for (const [t, max] of Object.entries(ARENA_WEAPON_MAX)) assert.equal(max, weaponMaxDamage(Number(t)), `weapon ${t}`);
  assert.equal(Object.keys(ARENA_WEAPON_MAX).length, Object.values(WEAPONS).filter((w) => w !== WEAPONS.Arrow).length, 'every weapon but the arrow');
  assert.deepEqual([...ARENA_MATERIAL_MOD], [...WEAPON_MATERIAL_MODIFIER]);
  for (const [s, per] of [[2, [1, 1]], [2, [1, 2]], [4, [1, 1, 1, 1]]]) assert.deepEqual(arenaMarks(s, per), boutMarks(s, per), `marks ${s}`);
  floorCentre().forEach((v, i) => assert.ok(Math.abs(ARENA_FLOOR_CENTRE[i] - v) < 1e-9, `the floor's centre, axis ${i}`));
  assert.equal(ARENA_RING_R, RING_R);
  assert.deepEqual(ARENA_TEAM_POINTS, { ...TEAM_POINTS, pvp: 2 });
  assert.deepEqual([ARENA_RATING_MIN, ARENA_RATING_MAX], [ARENA_ELO_MIN, ARENA_ELO_MAX]);
  assert.deepEqual([...ARRIVE.rival.at], [6, 0, 0], 'the second fighter on side 1\'s mark');
});

test('ARENA4 the hall\'s fold: queued with its band, an offer on this screen\'s clock, the call to the sand, a refusal said; the bouts to watch (mutants: an offer\'s lapse on the relay\'s clock; the call kept as queued)', () => {
  let h = foldHall(HALL_EMPTY, { k: 'qd', n: 3, band: 200 }, 100);
  assert.deepEqual([h.queue, h.band, h.n], ['queued', 200, 3]);
  h = foldHall(h, { k: 'of', o: O, vs: { n: 'Brann', r: 1040 }, until: 50_000 }, 200, 30_000);
  assert.deepEqual([h.queue, h.offer.until, h.offer.vs.n], ['offer', 20_000, 'Brann'], 'the lapse on my clock');
  h = foldHall(h, { k: 'go', o: O, side: 1, vs: { n: 'Brann' } }, 300);
  assert.deepEqual([h.queue, h.go.side, h.offer], ['going', 1, null]);
  h = foldHall(h, { k: 'qx', m: 'declined' }, 400);
  assert.deepEqual([h.queue, h.said], ['idle', 'declined']);
  h = foldHall(h, { k: 'live', l: [{ o: O, kind: 'pvp', a: { n: 'A' }, sp: 3, at: 1 }] }, 500);
  assert.equal(h.live.length, 1);
});

test('ARENA4 the mirror: a relay\'s bout in the bout law\'s own shape - its fighters named by the bout\'s seed, its phases, outs and tallies moved by its events on this screen\'s clock, its health by its `hp`; a walk carried on (mutants: an event\'s time read raw; an out not taken; my health read as another\'s; the offset the lowest heard)', () => {
  const names = (i, mob) => ({ name: `Rogue${i}-${mob}`, home: 'Wayrest', epithet: 'the Sly' });
  const M = mirrorOf(pveSt('call'), 1000, { names });
  assert.equal(M.b.fighters[1].name, 'Rogue0-136');
  assert.equal(M.b.fighters[1].home, 'Wayrest');
  assert.equal(M.b.phase, 'call');
  assert.deepEqual(M.ai, [{ id: 'a0', i: 0, mobile: 136 }]);
  const clock = { off: null };
  const heard = mirrorEvents(M, [{ k: 'fight', at: 20_000 }], 2000, clock);
  assert.equal(clock.off, 18_000);
  assert.equal(M.b.phase, 'fight');
  assert.equal(M.b.fightAt, 2000, 'on this screen\'s clock');
  assert.equal(heard[0].at, 2000);
  mirrorEvents(M, [{ k: 'hit', at: 21_000, a: 'p0', b: 'a0', dmg: 7 }, { k: 'yield', at: 21_500, a: 'a0' }, { k: 'end', at: 21_500, side: 0, how: 'yield' }], 3600, clock);
  assert.equal(clock.off, 17_985, 'ARENA5: the highest offset heard (the least delayed), let down five a word');
  assert.equal(M.b.fighters[0].dealt, 7);
  assert.equal(M.b.fighters[1].out, 'yield');
  assert.deepEqual([M.b.result.side, M.b.result.how, M.b.result.winners], [0, 'yield', ['p0']]);
  assert.deepEqual(mirrorHealth(M, [['p0', 45, 90], ['a0', 2, 26]]), [45, 90], 'my own health back');
  assert.equal(M.b.fighters[1].health, 2);
  const mv = { x: 0, z: 0, tx: 10, tz: 0, v: 2, at: 10_000 };
  assert.deepEqual(walkAt(mv, 2000, 9000), [2, 0], 'a second of walk at 2 m/s');
  assert.equal(walkDone(mv, 2000, 9000), false);
  assert.equal(walkDone(mv, 7000, 9000), true);
});

test('ARENA4 the receipts carried: kept one a bout, offered for the signed-in account alone (a ladder\'s by `s`, a players\' by `f`), let go once counted or out of order, kept for a guest; what was counted said (mutants: another\'s offered; a guest\'s let go; one bout kept twice; an unsigned one kept)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const nowS = Math.floor(Date.now() / 1000);
  const r1 = await mintArenaReceipt({ a: 'p', j: O, f: ['acct-a', 'acct-b'], r: 0, h: 'fall' }, priv, { subtle, nowS });
  const r2 = await mintArenaReceipt({ a: 'l', j: 'f'.repeat(16), s: 'acct-c', q: 0, u: 0, r: 1, h: 'fall' }, priv, { subtle, nowS });
  assert.equal(arenaReceiptIsMine({ a: 'p', f: ['acct-a', 'acct-b'] }, 'acct-b'), true);
  assert.equal(arenaReceiptIsMine({ a: 'l', s: 'acct-c' }, 'acct-b'), false);
  const store = new Map();
  const asked = [], counted = [];
  let answer = { ok: true, data: { recorded: true, kind: 'pvp', result: 'won', rating: 1016, delta: 16, rated: true } };
  const C = createArenaClaims({ claim: async (r) => { asked.push(r); return answer; }, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, me: () => 'acct-a', onCounted: (d) => counted.push(d) });
  assert.equal(C.add(r1), true);
  C.add(r1);
  C.add(r2);
  await C.flush();
  assert.deepEqual(asked, [r1], 'only my own, once');
  assert.equal(counted[0].rating, 1016);
  assert.deepEqual(store.get(ARENA_CLAIMS_KEY), [r2], 'counted, let go; another\'s waits');
  assert.equal(arenaClaimVerdict({ ok: true, data: { recorded: false, why: 'guest' } }), 'keep');
  assert.equal(arenaClaimVerdict({ ok: true, data: { recorded: false, why: 'order' } }), 'done');
  assert.equal(arenaClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep', 'the service can mend its key');
  assert.equal(arenaClaimVerdict({ ok: false, error: 'offline' }), 'keep');
  answer = { ok: true, data: { recorded: false, why: 'guest' } };
  void answer;
  // ARENA5: one a bout however often the relay hands it, kept while the service cannot answer - and an unsigned one
  // never (the service could only decline it)
  const K = createArenaClaims({ claim: async () => ({ ok: false, error: 'offline' }), me: () => 'acct-a' });
  K.add(r1); K.add(r1);
  await K.flush();
  assert.equal(K.kept().length, 1, 'one a bout');
  const bare = await mintArenaReceipt({ a: 'p', j: 'e'.repeat(16), f: ['acct-a', 'acct-b'], r: 0, h: 'fall' }, null, { subtle, nowS });
  assert.equal(K.add(bare), false, 'an unsigned receipt is never kept');
});

test('ARENA4 the window online: the Bouts page carries the bouts on the sand (Watch each) and the challenge (Find a match, then Leave the queue, then Accept/Decline with its clock); offline the challenge says so; the ladder is the account\'s; the header its rating and rank (mutants: the offer\'s presses missing; the offline press allowed; the save\'s ladder online)', () => {
  const board = {
    season: 3, day: 9, endsAt: 0, champion: { name: 'Ivo', title: null, glyphs: ['laurel'] },
    pvp: { rows: [{ rank: 1, name: 'Ivo', rating: 1100, wins: 5, losses: 1, draws: 0, bouts: 6, you: false }], pinned: { rank: 7, name: 'Alva', rating: 980, wins: 1, losses: 2, draws: 1, bouts: 4, you: true }, total: 7 },
    pve: { rows: [{ rank: 1, name: 'Ceryn', reached: 40, losses: 3, grand: true, you: false }], pinned: null, total: 1 },
    fast: { rows: [], pinned: null, total: 0 },
    team: { standings: { red: 12, blue: 30 }, last: { season: 2, red: 50, blue: 40, winner: 'red' }, laurel: 'red', members: { red: 4, blue: 6 }, rosters: { red: { rows: [{ rank: 1, name: 'Alva', points: 4, wins: 3, banner: 'red', you: true }], pinned: null, total: 1 }, blue: { rows: [], pinned: null, total: 0 } } },
    hall: [{ name: 'Ceryn', at: 1 }],
    me: { ladder: arenaLadderOf([{ tier: 0, bout: 0 }, { tier: 0, bout: 1 }]), pvp: { rating: 980, wins: 1, losses: 2, draws: 1, bouts: 4 }, rank: 7, banner: 'red', points: 4, grand: false, champion: false },
  };
  const at = (hall) => arenaBoard({ ladder: null, league: null, gameMinutes: 600_000, name: 'Alva', online: { board, hall, guest: false, busy: false, now: 1000 } });
  let m = at({ status: 'open', queue: 'idle', live: [{ o: O, kind: 'pvp', a: { n: 'Ivo', r: 1100 }, b: { n: 'Gwyn', r: 1050 }, sp: 4, at: 1 }] });
  const players = m.bouts.cards.find((c) => c.kind === 'players');
  assert.equal(players.live[0].a.name, 'Ivo');
  assert.equal(players.live[0].watching, ARENA_TEXT.online.watching(4));
  assert.deepEqual(players.live[0].acts.map((a) => a.act), ['spectate']);
  const ch = (mm) => mm.bouts.cards.find((c) => c.kind === 'challenge');
  assert.deepEqual(ch(m).acts.map((a) => [a.act, a.why]), [['queue', null], ['casual', null]]);   // ARENA4b (PIN MOVED): Casual bout beside Find a match (test/arena4b_casual.test.js)
  assert.deepEqual(ch(at({ status: 'open', queue: 'queued', band: 300, n: 4, live: [] })).acts.map((a) => a.act), ['unqueue']);
  const off = ch(at({ status: 'open', queue: 'offer', offer: { o: O, vs: { n: 'Brann', r: 1040 }, until: 18_000 }, live: [] }));
  assert.deepEqual(off.acts.map((a) => a.act), ['accept', 'decline']);
  assert.ok(off.lines.includes(ARENA_TEXT.online.offerClock(17)), 'the clock on this screen');
  assert.equal(off.offer.name, 'Brann');
  assert.equal(ch(at({ status: 'off', queue: 'idle', live: [] })).acts[0].why, ARENA_TEXT.online.whyOffline);
  m = at({ status: 'open', queue: 'idle', live: [] });
  assert.equal(m.ladder.tiers[0].won, 2, 'the account\'s climb, not the save\'s');
  assert.equal(m.ladder.online, ARENA_TEXT.online.ladderOnline);
  assert.deepEqual([m.header.rating, m.header.rank], [ARENA_TEXT.online.ratingChip(980), ARENA_TEXT.online.rankChip(7)]);
  assert.equal(m.header.season, ARENA_TEXT.online.seasonLine(3, 9));
  assert.equal(m.boards.pvp.pinned.cells[0], '980', 'my row pinned under the top');
  assert.equal(m.boards.pvp.champion, ARENA_TEXT.online.champion('Ivo'));
  assert.equal(m.boards.pve.rows[0].cells[0], ARENA_TEXT.titles[9], 'a Grand Champion\'s title');
  assert.equal(ladderTitleOfReached(4), ARENA_TEXT.titles[0]);
  assert.equal(ladderTitleOfReached(3), null);
  assert.equal(m.team.joined, 'red');
  assert.equal(m.team.laurel, 'red');
  assert.equal(m.team.laurelYou, true);
  assert.equal(m.rules.at(-1).head, ARENA_TEXT.online.rules.head);
  assert.equal(m.hall[0], ARENA_TEXT.online.hallTheir('Ceryn'));
  void onlineCards; void boardsPageOnline; void teamPageOnline;
});

/** A fake stage and bout driver for a relay's bout. */
function driverOf({ me = 'p0', kind = 'pvp' } = {}) {
  let t = 1000;
  const P = { name: 'Alva', health: 80, maxHealth: 80 };
  const said = [], notices = [], spawned = [], removed = [], huds = [], sent = [];
  const c = [ARENA_FLOOR_CENTRE[0], ARENA_FLOOR_CENTRE[1], ARENA_FLOOR_CENTRE[2]];
  const stage = {
    kind: 'floor', centre: () => c,
    spawn: async (mobile, feet, o) => { const foe = { mobile, entity: { health: 20, maxHealth: 20 }, ai: { feet: [...feet], yaw: o.yaw ?? 0, isHostile: true } }; spawned.push(foe); return foe; },
    remove: (f) => removed.push(f), heightAt: () => null,
  };
  const healths = [];
  const D = createArenaBouts({ now: () => t, playerEntity: P, say: (l) => said.push(l), notice: (l) => notices.push(l), drawHud: (m) => huds.push(m), heal: () => { P.health = P.maxHealth; }, pay: (g) => { P.gold = (P.gold ?? 0) + g; } });
  D.setStage(stage);
  D.startRelay({ o: O, kind, me, next: kind === 'pve' ? { tier: 0, bout: 1, purse: 50, champion: false, grand: false } : null, names: (i, mob) => ({ name: `Rogue${i}`, home: 'Wayrest', epithet: '' }),
    send: { hit: (w) => { sent.push(w); return true; }, yield: () => { sent.push({ k: 'yd' }); return true; } }, myHealth: (h) => { P.health = h; healths.push(h); } });
  return { D, P, said, notices, spawned, removed, huds, sent, healths, step: (ms) => { t += ms; }, now: () => t };
}

test('ARENA4 the driver on a relay\'s bout between players: the mirror stands on the `st`, the Herald calls it from the relay\'s events, the HUD reads it, my health is the relay\'s on my own scale, the verdict names the winner, a sheathe at the line and a swing at nothing are told the relay (mutants: my health taken whole; the yield sent above the line; the miss unsent)', async () => {
  const R = driverOf();
  assert.equal(R.D.relayWord(pvpSt('call')), true);
  assert.equal(R.D.bout().fighters[1].name, 'Brann');
  assert.ok(R.D.holds(), 'my own bout holds me - no doors, no rest');
  R.D.relayWord({ k: 'ev', e: [{ k: 'call', at: 5000 }, { k: 'crier', at: 5100, a: 'p0' }] });
  assert.ok(R.said.some((l) => l.includes('Alva')), 'the Herald cries me');
  R.D.relayWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }] });
  assert.equal(R.D.bout().phase, 'fight');
  R.D.frame(0.016, { sheathed: false });
  const hud = R.huds.at(-1);
  assert.equal(hud.left[0].name, 'Alva', 'my side on the left');
  assert.equal(hud.right[0].name, 'Brann');
  R.D.relayWord({ k: 'hp', h: [['p0', 170, 340], ['p1', 360, 360]] });
  assert.deepEqual(R.healths, [40], 'half of the relay\'s vitality is half of mine');
  R.D.frame(0.016, { sheathed: true });
  assert.ok(R.said.includes(ARENA_TEXT.refuse.yieldEarly), 'above the line, refused here');
  assert.equal(R.sent.filter((w) => w.k === 'yd').length, 0);
  R.D.relayWord({ k: 'hp', h: [['p0', 30, 340], ['p1', 360, 360]] });
  R.D.frame(0.016, { sheathed: false });
  R.D.frame(0.016, { sheathed: true });
  assert.equal(R.sent.filter((w) => w.k === 'yd').length, 1, 'at the line, my yield to the relay');
  R.D.playerSwing(0);
  assert.deepEqual(R.sent.find((w) => w.k === 'hit'), { k: 'hit', i: 'p1', d: 0, r: 0 }, 'a swing at nothing, the judges\' miss');
  R.D.relayWord({ k: 'ev', e: [{ k: 'yield', at: 12_000, a: 'p0' }, { k: 'end', at: 12_000, side: 1, how: 'yield' }, { k: 'verdict', at: 13_500, side: 1, how: 'yield' }] });
  assert.ok(R.said.includes(ARENA_TEXT.verdict.yield('Brann', 'Alva')), 'the Herald\'s verdict');
  R.D.relayWord({ k: 'cr', c: -1, n: 6 });
  assert.ok(R.D.crowd().mood < 0.5, 'the stands\' boos are heard');
});

test('ARENA4 the driver on a relay\'s ladder bout: the relay\'s fighter stood as a puppet the dungeon\'s own lane hands to the referee, walked by its words, its blow telegraphed; a win pays the tier\'s purse here, the climb is the service\'s (mutants: the puppet\'s owner not the relay\'s; the walk not carried; a purse on a loss)', async () => {
  const R = driverOf({ kind: 'pve' });
  R.D.relayWord({ k: 'mv', i: 'a0', x: ARENA_FLOOR_CENTRE[0] + 6, z: ARENA_FLOOR_CENTRE[2], tx: ARENA_FLOOR_CENTRE[0] + 6, tz: ARENA_FLOOR_CENTRE[2], v: 0, at: 5000 });
  R.D.relayWord(pveSt('call'));
  await new Promise((r) => setTimeout(r, 0));
  const foe = R.spawned[0];
  assert.equal(foe.mobile, 136, 'the Rogue');
  assert.equal(foe._ownFrom, ARENA_PUPPET_OWNER, 'its blows go to the relay');
  assert.equal(foe._ownI, 0);
  assert.equal(foe.ai.isHostile, false);
  assert.equal(foe.ai.feet[0], ARENA_FLOOR_CENTRE[0] + 6, 'stood where the relay said');
  R.D.relayWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }] });
  R.D.relayWord({ k: 'mv', i: 'a0', x: ARENA_FLOOR_CENTRE[0] + 6, z: ARENA_FLOOR_CENTRE[2], tx: ARENA_FLOOR_CENTRE[0], tz: ARENA_FLOOR_CENTRE[2], v: 3, at: 9000 });
  R.step(1000);
  R.D.frame(0.016, {});
  assert.ok(Math.abs(foe._pup.feet[0] - (ARENA_FLOOR_CENTRE[0] + 6 - 3)) < 0.01, `a second of its walk at 3 m/s: ${foe._pup.feet[0]}`);
  assert.equal(foe._pup.moving, true);
  R.D.relayWord({ k: 'atk', i: 'a0', at: 10_500, x: ARENA_FLOOR_CENTRE[0] - 6, z: ARENA_FLOOR_CENTRE[2], tg: 'p0' });
  assert.equal(foe._pup.strike, 'melee', 'the blow telegraphed - its clip plays');
  R.D.relayWord({ k: 'ev', e: [{ k: 'fall', at: 20_000, a: 'a0' }, { k: 'end', at: 20_000, side: 0, how: 'fall' }, { k: 'verdict', at: 21_500, side: 0, how: 'fall' }] });
  assert.equal(R.P.gold, 50, 'the Pit\'s purse');
  assert.ok(R.notices.at(-1).includes(ARENA_TEXT.purse.won(50)));
  // ARENA5: a loss pays nothing - the purse is the winner's alone
  const L = driverOf({ kind: 'pve' });
  L.D.relayWord(pveSt('call'));
  await new Promise((r) => setTimeout(r, 0));
  L.D.relayWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }, { k: 'fall', at: 20_000, a: 'p0' }, { k: 'end', at: 20_000, side: 1, how: 'fall' }, { k: 'verdict', at: 21_500, side: 1, how: 'fall' }] });
  assert.equal(L.P.gold, undefined, 'no purse on a loss');
  assert.ok(L.notices.at(-1).includes(ARENA_TEXT.purse.lost));
  assert.equal(hitKindOf('arrow'), ARENA_HIT.Shaft);
  assert.equal(hitKindOf('spell'), ARENA_HIT.Spell);
  assert.equal(hitKindOf('melee'), ARENA_HIT.Melee);
});

test('ARENA4 the host\'s glue: the window queues in the hall, a call sends me to the sand on my side, my `in` is said once I stand in the bout\'s room (a ladder\'s with its tier, its bout, my level and my health), its receipt carried, my blows claimed (mutants: the `in` before the room; the rival\'s side as the first\'s; the receipt dropped; the ladder\'s step lost from its `in`)', async () => {
  const hallSent = [], boutSent = [];
  const hallLink = { status: 'open', join() {}, leave() {}, sendArena: (w) => { hallSent.push(w); return true; } };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  const asked = [], entered = [], claimed = [];
  const bouts = { ask: (p) => asked.push(p), relayWord: () => true, dismiss() {}, holds: () => false };
  const board = { me: { ladder: arenaLadderOf([{ tier: 0, bout: 0 }]) } };
  const A = createArenaOnline({
    now: () => 0, session: () => session, makeHall: () => hallLink, bouts,
    account: { board: async () => ({ ok: true, data: board }), claim: async (r) => { claimed.push(r); return { ok: true, data: { recorded: true, kind: 'pvp', result: 'won', rating: 1016, delta: 16, rated: true } }; }, team: async () => ({ ok: true }), me: () => 'acct-a' },
    enterFloor: (kind, o) => { entered.push([kind, o]); return true; }, level: () => 12, maxHealth: () => 140, inBout: () => false,
  });
  assert.equal(A.live(), true);
  const m = A.model();
  assert.ok(m, 'the window\'s online half');
  assert.deepEqual(A.act('queue'), { ok: true, text: ARENA_TEXT.online.queueState.queued });
  assert.deepEqual(hallSent.at(-1), { k: 'q', lv: 12 });
  hallLink.onArena({ k: 'of', o: O, vs: { n: 'Brann', r: 1040 }, until: 20_000 });
  assert.equal(A.hall().queue, 'offer');
  A.act('accept');
  assert.deepEqual(hallSent.at(-1), { k: 'y', o: O });
  hallLink.onArena({ k: 'go', o: O, side: 1, vs: { n: 'Brann', r: 1040 } });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(entered.at(-1), ['rival', O], 'the second fighter to side 1\'s mark');
  assert.equal(asked.at(-1).relay.me, 'p1');
  A.tick();
  assert.equal(boutSent.length, 0, 'nothing said before I stand in the bout\'s room');
  session.room = `arena:b${O}`;
  A.tick(); A.tick();
  assert.deepEqual(boutSent, [{ k: 'in', r: 'f' }], 'my `in`, once');
  A.hit({ i: 'p0', d: 12.4, kind: 'melee', w: 120, m: 3, q: 5 });
  assert.deepEqual(boutSent.at(-1), { k: 'hit', i: 'p0', d: 12, r: 0, w: 120, m: 3, q: 5 });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const r = await mintArenaReceipt({ a: 'p', j: O, f: ['acct-b', 'acct-a'], r: 1, h: 'fall' }, priv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  A.word({ k: 'rc', r }, `arena:b${O}`);
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(claimed, [r], 'carried to the service');
  // the ladder online: the account's next bout, with my level and health in the `in`
  const sB = { ...session, room: 'world:1,1' };
  const B = createArenaOnline({ now: () => 0, session: () => sB, makeHall: () => hallLink, bouts, account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: (k, o) => { entered.push([k, o]); return true; }, level: () => 12, maxHealth: () => 140 });
  B.model();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(B.fightLadder(), { ok: true, text: '' });
  const [kind, o2] = entered.at(-1);
  assert.equal(kind, 'ladder');
  assert.match(o2, /^[0-9a-f]{16}$/);
  assert.equal(B.bout().bout, 1, 'the Pit\'s second bout');
  sB.room = `arena:b${o2}`;
  B.tick();
  assert.deepEqual(boutSent.at(-1), { k: 'in', r: 'f', tier: 0, bout: 1, lv: 12 }, 'ARENA5: in its room, the ladder\'s `in` - its tier, its bout, my level');
  assert.match(newBoutId(), /^[0-9a-f]{16}$/);
});
