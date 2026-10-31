// DLV3 (bible/03-World/Delve-II.md section 7): A DUNGEON'S ENCOUNTERS, KEPT BY ITS ROOM - the wire's `dv` (its bounds
// the law's, pinned equal), the room's plan and its hash, a site's ledger folded on the owning party's words, acts and
// blows (the party the hub's word, the reach the pose the room heard, the level the token's), what the room says back
// (each socket its own `me`, no account named), the ends, the rest and the respawn, a hibernation's wake and the
// room's forgetting. Driven through the real Room (test/fakeRoom.mjs). Held to fail under tools/mutants/dlv3.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClient, validDelveIn, validDelveOut, relaySupportsDelve, DELVE_RELAY_MIN, DELVE_KINDS_WIRE, DELVE_PHASE_WIRE_MAX, DELVE_LEVEL_MAX,
  DELVE_WAVES_WIRE, DELVE_WAVE_WIRE_MAX, DELVE_PIECES_MAX, DELVE_BLOWS_WIRE_MAX, DELVE_SITES_WIRE_MAX, DELVE_SITE_I_MAX, DELVE_ACTS, DELVE_NO,
  delvePlanKey, delveLedgerKey, DELVE_RESPAWN_MS, DELVE_RESPAWN_ELITE_MS, RELAY_VERSION, DELVE_HZ_MAX, worldRoom,
} from '../../../src/net/wire.js';
import {
  DELVE_KIND_NAMES, DP, HOLD_WAVES, HOLD_WAVE_MAX, HOLD_GATHER_MS, HOLD_BREATH_MS, DELVE_LEAVE_MS, VIGIL_REST_MS, litanyCount, sealCount,
  delvePlanHash, holdWaveSize, HOLD_CAPTAIN_MIN_MS, DELVE_PARTY_MAX, WEIGHT, FLAME, springSpots, weightSpots, weighPlates, PUZZLE_RISE_MS,
  litanyShowMs,
} from '../../../src/net/delve/delveLaw.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { ktLeastMs } from '../../../src/net/ketch/ketchBrain.js';
import { STAR_BLOWS_WIRE_MAX, starClearFloorMs } from '../../../src/net/starfall/starfallLaw.js';
import { DSITE } from '../../../src/world/dungeon/delveSites.js';
import { DUNGEON_RESPAWN_MS, ELITE_DUNGEON_RESPAWN_MS } from '../../../src/systems/dungeon/dungeonRespawn.js';
import { delveCrystalC } from '../../../src/scenes/delve/delveBodies.js';
import { Room } from '../../../server/src/index.js';
import { DELVE_PLANS_MAX, DELVE_KIN_NO_MS } from '../../../server/src/delveRoom.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { OnlineSession } from '../../../src/net/online.js';

const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const KEY = 'dungeon:m7';
const HOLD = { i: 0, kind: 'hold', x: 10, y: 0, z: 20, r: 4, vault: [13.4, 0, 20] };
const LIT = { i: 1, kind: 'litany', x: 70, y: 0, z: 20, r: 4, vault: [70, 0, 20] };
const VIG = { i: 2, kind: 'vigil', x: 10, y: 0, z: 90, r: 4, vault: [13.4, 0, 90] };
const tupleOf = (s) => [s.i, DELVE_KIND_NAMES.indexOf(s.kind) + 1, s.x, s.y, s.z, s.r, ...s.vault];
const planOf = (sites, e = 0) => ({ t: 'dv', k: 'pl', h: delvePlanHash(sites.map((s) => ({ ...s, tier: e ? 'elite' : 'regular' }))), e, s: sites.map(tupleOf) });
const PLAN = planOf([HOLD, LIT, VIG]);
const word = (i, o = {}) => ({ t: 'dv', k: 'w', h: PLAN.h, i, lv: 10, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, st: -1, hb: 0, iw: 1, ...o });
const dv = (ws, k) => ws.sent.filter((m) => m.t === 'dv' && (!k || m.k === k));
const seen = (ws, i) => dv(ws, 'dl').filter((m) => m.i === i).at(-1);
const evs = (ws, i) => dv(ws, 'ev').filter((m) => m.i === i).flatMap((m) => m.ev.map((e) => e.k));
/** Every word the room said to `ws`, read back by the wire's own law - none dropped. */
const wireReads = (ws) => { for (const m of dv(ws)) assert.ok(validDelveOut(m), `the wire drops ${JSON.stringify(m)}`); };

/** A dungeon's room on a clock of the pin's, the hub's kin word the pin's table (`kin`: the accounts of the owner's party;
 *  the hub silent on acct-H). `asked` the subjects the hub was asked about. */
async function withRoom(fn, { kin = [], hub = null } = {}) {
  const realNow = Date.now, realKin = Room.prototype._instanceKinOf; let clock = 1_800_000_000_000; Date.now = () => clock;
  const party = new Set(kin.map((n) => `acct-${n}`)), asked = [];
  Room.prototype._instanceKinOf = async function (subject) { asked.push(subject); if (hub) return hub(subject); return subject === 'acct-H' ? null : party.has(subject); };
  const world = fakeRooms({ now: () => clock });
  const r = world.room(KEY);
  /** A player: hello'd with its account and level (`kind` its token's), standing at `at`. */
  const join = async (n, at = [HOLD.x, 0, HOLD.z], lv = 10, kind = 'linked') => { const ws = r.connect(); await r.hello(ws, `id-${n}`, null, { name: n, kind, tokenSub: `acct-${n}`, charLevel: lv }); await stand(ws, at); return ws; };
  const stand = (ws, [x, y, z]) => r.pose(ws, { x, y, z, yaw: 0, pitch: 0 });
  const say = (ws, o) => r.raw(ws, JSON.stringify(o));
  try { await quiet(() => fn({ r, world, join, stand, say, step: (ms) => { clock += ms; }, now: () => clock, party, asked })); } finally { Date.now = realNow; Room.prototype._instanceKinOf = realKin; }
}

test('DLV3 THE WIRE\'S BOUNDS ARE THE LAW\'S: the kinds, the phases, a level, the waves and their size, the pieces, the Vigil\'s blows, the sites a plan holds and a site\'s number, the respawn (mutants: each moved)', () => {
  assert.equal(DELVE_KINDS_WIRE, DELVE_KIND_NAMES.length);
  assert.equal(DELVE_PHASE_WIRE_MAX, Math.max(...Object.values(DP)));
  assert.equal(DELVE_LEVEL_MAX, 99);
  assert.equal(DELVE_WAVES_WIRE, HOLD_WAVES);
  assert.equal(DELVE_WAVE_WIRE_MAX, HOLD_WAVE_MAX);
  assert.equal(DELVE_PIECES_MAX, Math.max(litanyCount('elite'), sealCount(DELVE_PARTY_MAX)));
  assert.equal(DELVE_BLOWS_WIRE_MAX, STAR_BLOWS_WIRE_MAX);
  assert.ok(DELVE_SITES_WIRE_MAX >= DSITE.max);
  assert.equal(delveCrystalC(DELVE_SITE_I_MAX, 0) + 16, delveCrystalC(0, 0) + 16 * 16, 'sixteen sites on the crystal seam');
  assert.deepEqual([DELVE_RESPAWN_MS, DELVE_RESPAWN_ELITE_MS], [DUNGEON_RESPAWN_MS, ELITE_DUNGEON_RESPAWN_MS]);
  assert.deepEqual(DELVE_ACTS, ['take', 'light', 'drop', 'set']);
  assert.equal(relaySupportsDelve(`world${DELVE_RELAY_MIN}`), true);
  assert.equal(relaySupportsDelve(`world${DELVE_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsDelve(RELAY_VERSION), true, 'this relay keeps them');
  assert.equal(relaySupportsDelve('world297'), false, 'AUDIT LITANY-STAND: a relay that judges a Litany step said once plays no site with this page');
  assert.equal(relaySupportsDelve('world291'), false, 'the relay before it keeps none and closes the socket on `dv` - world292 is the first (world284, world288 then world289 on its branch, renumbered past main at the merges)');   // PIN MOVED (the merges of DRAGON's world288 and of world289 to world291)
});

test('DLV3 A WORD ON THE WIRE: each kind projected to its own fields; a plan\'s sites each once, its numbers bounded; past a bound, nothing - and never before a hello (mutants: a plan\'s site twice; the ward\'s flag unread; a blow of nothing)', () => {
  assert.deepEqual(validDelveIn(word(0)), { k: 'w', h: PLAN.h, i: 0, lv: 10, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, st: -1, hb: 0, iw: 1 });
  assert.equal(validDelveIn({ ...word(0), iw: 2 }), null);
  assert.equal(validDelveIn({ ...word(0), lv: 100 }), null);
  assert.equal(validDelveIn({ ...word(0), kn: HOLD_WAVE_MAX + 1 }), null);
  assert.equal(validDelveIn({ ...word(DELVE_SITE_I_MAX + 1) }), null);
  assert.deepEqual(validDelveIn(PLAN), { k: 'pl', h: PLAN.h, e: 0, s: PLAN.s });
  assert.equal(validDelveIn({ ...PLAN, s: [tupleOf(HOLD), tupleOf(HOLD)] }), null, 'a site twice');
  assert.equal(validDelveIn({ ...PLAN, s: [] }), null);
  assert.equal(validDelveIn({ ...PLAN, s: [[0, 8, 0, 0, 0, 4, 0, 0, 0]] }), null, 'a kind past the law\'s');
  assert.equal(validDelveIn({ ...PLAN, s: [[0, 1, 0, 0, 0, 9, 0, 0, 0]] }), null, 'a ward past the bound');
  assert.deepEqual(validDelveIn({ k: 'x', h: 1, i: 0, j: 2, d: 7.5, r: 1, q: 4 }), { k: 'x', h: 1, i: 0, j: 2, d: 7.5, r: 1, q: 4 });
  assert.equal(validDelveIn({ k: 'x', h: 1, i: 0, j: 2, d: 0, r: 1, q: 4 }), null, 'a blow of nothing');
  assert.equal(validDelveIn({ k: 'a', h: 1, i: 0, a: 4, j: 0 }), null, 'no fifth act');
  assert.deepEqual(validDelveIn({ k: 'v', h: 1, i: 3 }), { k: 'v', h: 1, i: 3 });
  assert.deepEqual(parseClient(JSON.stringify(word(0)), { hasHello: false }), { error: 'dv before hello' });
  assert.equal(parseClient(JSON.stringify(word(0)), { hasHello: true }).t, 'dv');
  assert.equal(validDelveOut({ t: 'dv', k: 'ev', ph: 1, i: 0, ev: [{ k: 'won', earned: ['acct-a'] }] }).ev[0].earned, undefined, 'no account read off the wire');
  assert.equal(validDelveOut({ t: 'dv', k: 'ev', i: 0, ev: [] }), null, 'never without its plan');
});

test('DLV3 THE PLAN: each heard is kept, checked against its own hash, its sites apart; a word under a plan the room does not keep asks for it; another page\'s plan stands beside mine and moves nothing of it; past DELVE_PLANS_MAX the least used with nothing at stake gives way, and with every one at stake the newest is told to wait; a cell keeps none (mutants: the hash unchecked; a plan dropped over a running attempt; another plan\'s word moving mine; the cap unread)', async () => {
  await withRoom(async ({ r, world, join, say }) => {
    const X = world.room(worldRoom(3_000, 3_000)), x = X.connect();
    await X.hello(x, 'id-X', null, { name: 'X', kind: 'linked', tokenSub: 'acct-X', charLevel: 10 });
    await X.raw(x, JSON.stringify(PLAN));
    assert.ok(![...X.store.keys()].some((k) => k.startsWith('dv:')), 'the open country keeps no dungeon\'s plan');
    const A = await join('A');
    await say(A, word(0));
    assert.equal(dv(A, 'pl?').length, 1, 'no plan yet: asked for it');
    await say(A, { ...PLAN, h: (PLAN.h + 1) >>> 0 });
    assert.equal(r.store.get(delvePlanKey((PLAN.h + 1) >>> 0)), undefined, 'a plan that is not its own hash: junk');
    await say(A, PLAN);
    assert.deepEqual(r.store.get(delvePlanKey(PLAN.h)).s, PLAN.s);
    assert.deepEqual(dv(A, 'dl').map((m) => [m.i, m.ph]), [[0, PLAN.h], [1, PLAN.h], [2, PLAN.h]], 'every site said to the page that came in, under its plan');
    await say(A, { ...word(0), h: 99 });
    assert.deepEqual(dv(A).at(-1), { t: 'dv', k: 'pl?' }, 'a plan the room does not keep: asked for');
    await say(A, word(0, { o: 1 }));
    assert.equal(seen(A, 0).p, DP.gather, 'the Hold wakes under my plan');
    // a page of another build: its own plan beside mine, its own sites
    const other = planOf([{ ...HOLD, x: HOLD.x + 0.5 }, LIT]), B = await join('B');
    await say(B, other);
    await say(B, { ...word(0, { o: 1 }), h: other.h });
    assert.equal(dv(B, 'dl').filter((m) => m.ph === other.h && m.i === 0).at(-1).p, DP.gather, 'its own Hold, its own');
    assert.equal(r.room._dv.plans.get(PLAN.h).recs.get(0).led.own, 'acct-A', 'mine untouched');
    assert.ok(r.store.get(delvePlanKey(PLAN.h)) && r.store.get(delvePlanKey(other.h)), 'both kept');
    // the cap: two more fill it; a fifth with every one at stake waits, and with one idle that one gives way
    assert.equal(DELVE_PLANS_MAX, 4);
    const extra = (k) => planOf([{ ...HOLD, x: HOLD.x + k }]);
    const C = await join('C'), D = await join('D'), E = await join('E');
    await say(C, extra(1)); await say(C, { ...word(0, { o: 1 }), h: extra(1).h });
    await say(D, extra(2));
    await say(E, extra(3));
    assert.ok(r.store.get(delvePlanKey(extra(3).h)), 'a fifth kept');
    assert.equal(r.store.get(delvePlanKey(extra(2).h)), undefined, 'the least used, with nothing at stake, gave way');
    await say(E, { ...word(0, { o: 1 }), h: extra(3).h });
    await say(D, extra(2));
    assert.deepEqual(dv(D, 'no').at(-1), { t: 'dv', k: 'no', m: DELVE_NO.plan }, 'every one at stake: told to wait');
    assert.equal(r.store.get(delvePlanKey(extra(2).h)), undefined);
  });
});

test('DLV3 THE HOLD ONLINE, A PARTY OF THREE, A GUEST AMONG THEM: the first word in the ward starts it for its speaker; the party\'s member counts, a stranger does not and is told; the waves move on the foes\' machine\'s word alone; the earners each open their share once (mutants: a stranger counted; the ward\'s flag unread; a share opened twice; the room answered for an unmoved word; a guest refused its party; the hub\'s silence read as a no)', async () => {
  await withRoom(async ({ r, join, stand, say, step, asked }) => {
    const A = await join('A'), B = await join('B'), C = await join('C');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    assert.deepEqual(evs(A, 0), ['gather'], 'woken by its first word in the ward');
    assert.equal(seen(A, 0).me.fm, 1, 'A\'s machine stands its foes');
    const Z = r.connect();   // no hello yet
    await say(B, word(0));
    assert.equal(seen(B, 0).me.pa, 1, 'B is of the party');
    assert.equal(seen(B, 0).me.fm, 0, 'and its machine is not the foes\'');
    const nA = dv(A, 'dl').length, nC = dv(C, 'dl').length;
    await say(C, word(0));
    assert.deepEqual(dv(C, 'no').at(-1), { t: 'dv', k: 'no', m: DELVE_NO.party, i: 0 });
    assert.equal(seen(C, 0).me.pa, 0);
    assert.deepEqual([dv(A, 'dl').length, dv(C, 'dl').length], [nA, nC + 1], 'a word that moves nothing: answered to its speaker alone');
    const G = await join('G', [HOLD.x, 0, HOLD.z], 10, 'guest'), H = await join('H');
    asked.length = 0;
    await say(G, word(0));
    assert.deepEqual([seen(G, 0).me.pa, asked], [1, ['acct-G']], 'a guest\'s party the hub\'s word, as any member\'s');
    await say(H, word(0));
    assert.deepEqual(dv(H, 'no').at(-1), { t: 'dv', k: 'no', m: DELVE_NO.busy, i: 0 }, 'the hub silent: busy');
    await say(B, word(0, { iw: 0 }));
    step(HOLD_GATHER_MS);
    await say(A, word(0, { o: 1 }));
    const st = seen(A, 0);
    assert.equal(st.p, DP.wave);
    assert.equal(st.wz, holdWaveSize(1, 3), 'three in the ward: A, B and the guest G - never C or H');
    // the party talks as it fights: a word a second each, their poses fresh (the clock runs while one was heard)
    const beat = async (ms) => { for (let t = 0; t < ms; t += 1_000) { step(1_000); for (const ws of [A, B, G]) await stand(ws, [HOLD.x, 0, HOLD.z]); await say(A, word(0, { o: 1 })); await say(B, word(0)); await say(G, word(0)); } };
    for (let w = 1; w <= HOLD_WAVES; w++) {
      await beat(starClearFloorMs(seen(A, 0).wz, 3) + 1_000);
      await say(B, word(0, { kw: w, kn: HOLD_WAVE_MAX, wc: w }));   // not the machine: moves no wave
      assert.equal(seen(B, 0).w, w);
      await say(A, word(0, { o: 1, kw: w, kn: seen(A, 0).wz, wc: w }));
      assert.equal(seen(A, 0).p, DP.breath, `wave ${w} cleared on the machine's word`);
      await beat(HOLD_BREATH_MS + 1_000);
    }
    assert.equal(seen(A, 0).p, DP.captain);
    await beat(HOLD_CAPTAIN_MIN_MS + 1_000);
    await say(A, word(0, { o: 1, cf: 1 }));
    assert.equal(seen(A, 0).p, DP.won);
    assert.equal(seen(A, 0).me.ea, 1); assert.equal(seen(B, 0).me.ea, 1); assert.equal(seen(C, 0).me.ea, 0, 'a stranger earned nothing');
    assert.equal(seen(G, 0).me.ea, 1, 'the guest of the party earned its share');
    assert.ok(!JSON.stringify(A.sent).includes('"earned"'), 'no account named on the wire');
    await say(A, { t: 'dv', k: 'v', h: PLAN.h, i: 0 });
    assert.deepEqual(dv(A, 'v').at(-1), { t: 'dv', k: 'v', ph: PLAN.h, i: 0, ok: 1 });
    await say(A, { t: 'dv', k: 'v', h: PLAN.h, i: 0 });
    assert.deepEqual(dv(A, 'v').at(-1), { t: 'dv', k: 'v', ph: PLAN.h, i: 0, ok: 0 }, 'once');
    await say(C, { t: 'dv', k: 'v', h: PLAN.h, i: 0 });
    assert.deepEqual(dv(C, 'v').at(-1), { t: 'dv', k: 'v', ph: PLAN.h, i: 0, ok: 0 });
    assert.equal(seen(A, 0).me.ea, 0, 'opened: no more to open');
    assert.equal(dv(Z).length, 0, 'a socket not yet hello\'d hears nothing, the whole Hold through');
    wireReads(A); wireReads(B); wireReads(C);
  }, { kin: ['B', 'G'] });
});

test('DLV3 THE ROOM JUDGES THE WARD AND THE REACH: a word whose screen says it is in the ward counts only where the pose the room heard agrees, and one whose screen says it is out never - waking it and once it runs; a still defender\'s pose stands as it is; the level the token\'s, not the word\'s (mutants: the pose unread; the screen\'s word unread; the word\'s level believed)', async () => {
  await withRoom(async ({ r, join, stand, say, step }) => {
    const A = await join('A', [HOLD.x + 30, 0, HOLD.z], 7);
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    assert.equal(seen(A, 0).p, DP.idle, 'my screen says the ward, my pose says the corridor: nothing');
    await stand(A, [HOLD.x, 0, HOLD.z]);
    await say(A, word(0, { o: 1, iw: 0 }));
    assert.equal(seen(A, 0).p, DP.idle, 'my pose says the ward, my screen says a wall stands between: nothing');
    await say(A, word(0, { o: 1, lv: 60 }));
    assert.equal(seen(A, 0).p, DP.gather);
    const led = r.store.get(delveLedgerKey(PLAN.h, 0)).led;
    assert.equal(led.a['acct-A'].lv, 7, 'the token\'s level, never the word\'s');
    const B = await join('B'), D = await join('D', [HOLD.x + 30, 0, HOLD.z]);
    await say(B, word(0, { iw: 0 }));   // in the ward by its pose, out by its screen
    await say(D, word(0));   // in by its screen, out by its pose
    step(HOLD_GATHER_MS);
    await say(A, word(0, { o: 1 }));
    assert.equal(seen(A, 0).wz, holdWaveSize(1, 1), 'once it runs too: A alone in the ward');
    for (let t = 0; t < 40_000; t += 1_000) { step(1_000); await say(A, word(0, { o: 1 })); }   // forty seconds without a pose
    assert.notEqual(seen(A, 0).p, DP.idle, 'standing still in the ward: still in it');
    assert.ok(!evs(A, 0).includes('failed'));
  }, { kin: ['B', 'D'] });
  await withRoom(async ({ join, stand, say }) => {
    const A = await join('A', [HOLD.x + 30, 0, HOLD.z]), E = await join('E');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));   // its screen in, its pose out
    await stand(A, [HOLD.x, 0, HOLD.z]);
    await say(A, word(0, { o: 1, iw: 0 }));   // its pose in, its screen out
    await stand(A, [HOLD.x + 30, 0, HOLD.z]);
    await say(E, word(0, { o: 1 }));
    assert.deepEqual([seen(E, 0).p, seen(E, 0).me.fm, dv(E, 'no').length], [DP.gather, 1, 0], 'neither started an attempt: a stranger in the ward wakes it, its own');
  });
});

test('DLV3 THE ENDS: a party that left fails its Hold on the next word heard at the site, whoever says it - the stranger\'s too; a Vigil gone dark rests with its site; a won site stands again at the dungeon\'s respawn, an Elite\'s at forty minutes (mutants: the site stepped only by its party; the rest dropped; the respawn unread)', async () => {
  await withRoom(async ({ join, stand, say, step }) => {
    const A = await join('A'), C = await join('C');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    step(DELVE_LEAVE_MS + 10);
    await say(C, word(0));
    assert.ok(evs(C, 0).includes('failed'), 'the stranger\'s word stepped it: failed, and said');
    assert.ok(evs(A, 0).includes('failed'), 'to the whole room');
    await stand(C, [HOLD.x, 0, HOLD.z]);
    await say(C, word(0));
    assert.equal(seen(C, 0).p, DP.gather, 'and the next word starts anew - its own');
  });
  await withRoom(async ({ r, join, stand, say, step }) => {
    const A = await join('A', [VIG.x, 0, VIG.z]);
    await say(A, PLAN);
    await say(A, word(2, { o: 1 }));
    step(HOLD_GATHER_MS);
    for (let n = 1; n < 80 && seen(A, 2).p !== DP.idle; n++) { step(1_000); await stand(A, [VIG.x, 0, VIG.z]); await say(A, word(2, { o: 1, hb: n * 9 })); }
    assert.ok(evs(A, 2).includes('failed'));
    const end = validDelveOut(dv(A, 'ev').filter((m) => m.i === 2).at(-1)).ev.find((e) => e.k === 'failed');
    assert.deepEqual([end.dark, end.rest], [true, VIGIL_REST_MS], 'dark, and its rest, through the wire');
    assert.ok(seen(A, 2).rs > 0 && seen(A, 2).rs <= VIGIL_REST_MS, 'dark: its rest said');
    step(1_000);
    await stand(A, [VIG.x, 0, VIG.z]);
    await say(A, word(2, { o: 1 }));
    assert.equal(seen(A, 2).p, DP.idle, 'resting: a word in the ward wakes nothing');
    assert.ok(r.store.get(delveLedgerKey(PLAN.h, 2)).rest > 0, 'kept with the site, through a hibernation');
    step(VIGIL_REST_MS);
    await stand(A, [VIG.x, 0, VIG.z]);
    await say(A, word(2, { o: 1 }));
    assert.equal(seen(A, 2).p, DP.gather, 'rested: it wakes');
    wireReads(A);
  });
  for (const [e, ms] of [[0, DELVE_RESPAWN_MS], [1, DELVE_RESPAWN_ELITE_MS]]) {
    await withRoom(async ({ r, join, stand, say, step }) => {
      const plan = planOf([HOLD, LIT, VIG], e);
      const A = await join('A', [LIT.x, 0, LIT.z]);
      await say(A, plan);
      const w = (o) => ({ ...word(1, o), h: plan.h });
      await say(A, w());
      const led = () => r.room._dv.plans.get(plan.h).recs.get(1).led;
      led().p = DP.won; led().wonAt = Date.now(); led().earned = ['acct-A'];   // won, as the Litany's own pins win it
      step(ms - 1);
      await say(A, w());
      assert.equal(seen(A, 1).p, DP.won, 'won until the respawn');
      step(2);
      await say(A, w());
      assert.notEqual(seen(A, 1).p, DP.won, 'stands again at the respawn');
    });
  }
});

test('DLV3 THE HUB\'S WORD (AUDIT DLV3 5, 6, P1): a stranger\'s words ask the hub once and are refused from its kept no; a frame the hub keeps waiting still says and keeps what its step moved; and one that waited folds nothing into a ledger another frame has begun meanwhile (mutants: the no never kept; the step lost on a silent hub; the fold into the ledger read before the wait)', async () => {
  await withRoom(async ({ r, join, say, step, asked }) => {
    const A = await join('A'), C = await join('C');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    asked.length = 0;
    for (let t = 0; t < 20; t++) { step(1_000); await say(A, word(0, { o: 1 })); await say(C, word(0)); }
    assert.deepEqual(asked, ['acct-C'], 'twenty words, one ask: the no kept');
    assert.equal(dv(C, 'no').length, 20, 'and each refused');
    for (let t = 0; t < DELVE_KIN_NO_MS; t += 1_000) { step(1_000); await say(A, word(0, { o: 1 })); }   // A holds on
    await say(C, word(0));
    assert.deepEqual(asked, ['acct-C', 'acct-C'], 'asked again once the no is old');
  });
  await withRoom(async ({ r, join, say, step }) => {
    const A = await join('A'), H = await join('H');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    step(HOLD_GATHER_MS);
    await say(H, word(0));   // the hub is silent on H: refused busy - and the gather's end, stepped by H's word, said and kept
    assert.deepEqual(dv(H, 'no').at(-1), { t: 'dv', k: 'no', m: DELVE_NO.busy, i: 0 });
    assert.ok(evs(A, 0).includes('wave'), 'the first wave said to the room');
    assert.equal(r.store.get(delveLedgerKey(PLAN.h, 0)).led.p, DP.wave, 'and kept');
  });
  let open = null;
  const gate = new Promise((res) => { open = res; });
  await withRoom(async ({ r, join, say, step }) => {
    const A = await join('A'), B = await join('B'), E = await join('E');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    const first = r.room._dv.plans.get(PLAN.h).recs.get(0).led;
    step(DELVE_LEAVE_MS - 1_000);
    const waiting = say(B, word(0));   // B's ask of the hub waits on the gate - the attempt still runs
    await new Promise((res) => setImmediate(res));
    step(2_000);   // A is gone too long now
    await say(E, word(0, { o: 1 }));   // E's word fails the old attempt and begins its own - E is the owner: no ask
    const second = r.room._dv.plans.get(PLAN.h).recs.get(0).led;
    assert.ok(second && second !== first && second.own === 'acct-E');
    open();
    await waiting;
    assert.equal(r.room._dv.plans.get(PLAN.h).recs.get(0).led, second, 'the new attempt stands');
    assert.equal(first.p, DP.idle, 'and B folded nothing into the old');
  }, { hub: async (subject) => { if (subject === 'acct-B') await gate; return true; } });
});

test('DLV3 A SHARE\'S ASK STEPS THE SITE FIRST: an ask at a site its party left fails it, and the end is said to the room and kept before the answer (AUDIT DLV3 5 - mutants: the step lost on an ask)', async () => {
  await withRoom(async ({ r, join, say, step }) => {
    const A = await join('A'), B = await join('B', [500, 0, 500]);
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    step(DELVE_LEAVE_MS + 10);
    await say(A, { t: 'dv', k: 'v', h: PLAN.h, i: 0 });
    assert.ok(evs(B, 0).includes('failed'), 'the end said to the room');
    assert.equal(r.store.get(delveLedgerKey(PLAN.h, 0)).led, null, 'and kept');
    assert.deepEqual(dv(A, 'v').at(-1), { t: 'dv', k: 'v', ph: PLAN.h, i: 0, ok: 0 }, 'then the answer: nothing to open');
  });
});

test('DLV3 A MENTOR\'S LEVEL: a word may say the level lower than the token, never higher (Delve-II 5.2; the serpent\'s Math.min - mutants: the token\'s outright)', async () => {
  await withRoom(async ({ r, join, say }) => {
    const A = await join('A', [HOLD.x, 0, HOLD.z], 40);
    await say(A, PLAN);
    await say(A, word(0, { o: 1, lv: 10 }));
    assert.equal(r.store.get(delveLedgerKey(PLAN.h, 0)).led.a['acct-A'].lv, 10, 'its world level, lower: believed');
  });
});

test('DLV3 THE LITANY\'S ORDER: said with the state while it is shown, never after - the party must remember it (mutants: the order said in every phase)', async () => {
  await withRoom(async ({ join, say, step }) => {
    const A = await join('A', [LIT.x, 0, LIT.z]);
    await say(A, PLAN);
    await say(A, word(1, { o: 1 }));
    step(HOLD_GATHER_MS);
    await say(A, word(1, { o: 1 }));
    assert.equal(seen(A, 1).p, DP.show);
    assert.equal(seen(A, 1).or.length, litanyCount('regular'), 'shown: the order');
    step(litanyShowMs(litanyCount('regular')));
    await say(A, word(1, { o: 1 }));
    assert.equal(seen(A, 1).p, DP.work);
    assert.equal(seen(A, 1).or, undefined, 'after the show: never');
    wireReads(A);
  });
});

test('DLV3 BLOWS AND ACTS IN THE ROOM: a blow lands from within its reach of the pose the room heard - never from across the ward, never a stranger\'s; one attempt a hand at a time; a weight taken at its home and set on a plate where the room hears me stand; every word said, the wire reads (mutants: the pose unread on a blow or an act; a stranger\'s blow; the carrier named for any; two attempts in one hand; a word the wire drops)', async () => {
  const WS = { i: 3, kind: 'wellsprings', x: 10, y: 0, z: 150, r: 4, vault: [13.4, 0, 150] };
  const WEI = { i: 4, kind: 'weighing', x: 70, y: 0, z: 150, r: 4, vault: [70, 0, 153.4] };
  const BRZ = { i: 5, kind: 'brazier', x: 130, y: 0, z: 150, r: 4, vault: [133.4, 0, 150] };
  const P2 = planOf([HOLD, WS, WEI, BRZ]);
  const w = (i, o) => ({ ...word(i, o), h: P2.h });
  await withRoom(async ({ join, stand, say, step }) => {
    const A = await join('A', [WS.x, 0, WS.z]), C = await join('C', [WS.x, 0, WS.z]);
    await say(A, P2);
    await say(A, w(3, { o: 1 }));
    step(HOLD_GATHER_MS);
    await say(A, w(3, { o: 1 }));
    assert.equal(seen(A, 3).p, DP.spring);
    const hp = seen(A, 3).h[0], spots = springSpots({ ...WS, tier: 'regular' }, seen(A, 3).h.length);
    let q = 0;
    const blow = (ws) => say(ws, { t: 'dv', k: 'x', h: P2.h, i: 3, j: 0, d: 50, r: HIT_KINDS.Melee, q: ++q });
    await stand(A, [2 * WS.x - spots[0][0], 0, 2 * WS.z - spots[0][2]]);   // in the ward, across it from the source
    await blow(A);
    assert.equal(seen(A, 3).h[0], hp, 'from across the ward: nothing');
    await stand(C, spots[0]);
    await blow(C);
    assert.equal(seen(C, 3).h[0], hp, 'a stranger\'s: nothing');
    await stand(A, spots[0]);
    await blow(A);
    assert.equal(seen(A, 3).h[0], hp - 50, 'within its reach of the pose the room heard');
    // one attempt a hand: A's own Wellsprings runs, so the Weighing waits for another's word (AUDIT DLV3 P3)
    await stand(A, [WEI.x, 0, WEI.z]);
    await say(A, w(4));
    assert.deepEqual([seen(A, 4).p, dv(A, 'no').at(-1)], [DP.idle, { t: 'dv', k: 'no', m: DELVE_NO.held, i: 4 }], 'held: told, and nothing starts');
    // the Weighing, F's: the room reads each act's reach off F's pose
    const site = { ...WEI, tier: 'regular' }, homes = weightSpots(site), plates = weighPlates(site);
    const F = await join('F', [WEI.x, 0, WEI.z]), G = await join('G', [BRZ.x, 0, BRZ.z]);
    await say(F, w(4));
    assert.equal(seen(F, 4).p, DP.work);
    const act = (a, j) => say(F, { t: 'dv', k: 'a', h: P2.h, i: 4, a: DELVE_ACTS.indexOf(a), j });
    const far = ((h) => { const dx = h[0] - WEI.x, dz = h[2] - WEI.z, d = Math.hypot(dx, dz); return [WEI.x - (dx / d) * 5.5, h[1], WEI.z - (dz / d) * 5.5]; })(homes[0]);
    await stand(F, far);
    await act('take', 0);
    assert.equal(seen(F, 4).me.hd, -2, 'across the ward, past a press\'s reach (DELVE_PRESS_M): nothing in hand');   // PIN MOVED (DLV4's probe: a weight is taken by a press, from as far as one reaches - its home, on a gate, is within that of the heart)
    await stand(F, homes[0]);
    await act('take', 0);
    assert.equal(seen(F, 4).me.hd, 0, 'taken at its home');
    assert.equal(seen(C, 4).wt[0][0], WEIGHT.carried, 'the room sees it carried');
    assert.equal(seen(C, 4).me.hd, -2, 'and not by C');
    step(Math.ceil(ktLeastMs(Math.hypot(plates[0][0] - homes[0][0], plates[0][2] - homes[0][2]), true)) + 500);
    await stand(F, plates[0]);
    await say(F, w(4));
    await act('set', -1);
    assert.deepEqual(seen(F, 4).wt[0].slice(0, 2), [WEIGHT.plate, 0], 'set on its plate');
    assert.equal(seen(F, 4).me.hd, -2);
    // the Brazier Rite, G's: the flame in G's hands is G's, in another's a peer's
    await say(G, w(5));
    step(PUZZLE_RISE_MS);
    await say(G, w(5));
    assert.equal(seen(G, 5).p, DP.work);
    await say(G, { t: 'dv', k: 'a', h: P2.h, i: 5, a: DELVE_ACTS.indexOf('take'), j: -1 });
    assert.deepEqual([seen(G, 5).fl, seen(G, 5).me.hd, seen(C, 5).me.hd], [FLAME.carried, -1, -2], 'the flame G\'s, never C\'s');
    for (const ws of [A, C, F, G]) wireReads(ws);
  });
});

test('DLV3 A HIBERNATION\'S WAKE AND THE ROOM\'S FORGETTING: the plan and each ledger read back from storage, its accounts a map with no prototype; the room\'s memory forgotten with nobody in it, its encounters with it (mutants: the accounts\' map read back with a prototype; a still word never written; the encounters kept past the memory)', async () => {
  await withRoom(async ({ r, join, say, step, now }) => {
    const A = await join('A');
    await say(A, PLAN);
    await say(A, word(0, { o: 1 }));
    r.wake();
    step(HOLD_GATHER_MS);
    await say(A, word(0, { o: 1 }));
    assert.equal(seen(A, 0).p, DP.wave, 'woken from storage, and on');
    for (let t = 0; t < 8_000; t += 1_000) { step(1_000); await say(A, word(0, { o: 1 })); }   // words that move nothing
    assert.ok(now() - r.store.get(delveLedgerKey(PLAN.h, 0)).led.a['acct-A'].last <= 5_000, 'a still defender\'s moment written within five seconds');
    const led = r.room._dv.plans.get(PLAN.h).recs.get(0).led;
    assert.equal(Object.getPrototypeOf(led.a), null, 'its accounts a map with no prototype again');
    assert.ok(Object.hasOwn(led.a, 'acct-A'));
    r.drop(A);
    for (let k = 0; k < 4 && [...r.store.keys()].some((k) => k.startsWith('dv:')); k++) await r.fire();
    assert.ok(![...r.store.keys()].some((k) => k.startsWith('dv:')), 'forgotten with the memory');
    assert.ok(!r.store.has(delvePlanKey(PLAN.h)) && !r.store.has(delveLedgerKey(PLAN.h, 0)), 'the plan and the ledger both');
    const A2 = await join('A2');
    await say(A2, word(0));
    assert.equal(dv(A2, 'pl?').length, 1, 'and from the room\'s own memory: the plan asked for again');
  });
});

test('DLV3 THE SESSION: a word leaves only a welcomed socket in a dungeon\'s room at a relay that keeps the encounters - never a reconnect\'s socket before its own welcome; my pose made current first, as sendPose says it; DELVE_HZ_MAX a second; the room\'s word heard from a dungeon\'s room alone (mutants: the welcome unread; the pose not made current; a body lying down said standing; heard from any room)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_800_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const frames = (ws, k) => ws.sent.map((x) => JSON.parse(x)).filter((f) => !k || f.t === k);
  const welcome = (ws, v) => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v });
  const at = { x: HOLD.x, y: 0, z: HOLD.z, yaw: 0, pitch: 0 };
  const w = word(0);
  delete w.t;
  const log = console.info; console.info = () => {};
  try {
    s.join(KEY, at);
    sockets[0].open();
    assert.equal(s.sendDelve(w), false, 'opened, not welcomed');
    welcome(sockets[0], `world${DELVE_RELAY_MIN - 1}`);
    assert.equal(s.sendDelve(w), false, 'an older relay would close the socket for it');
    welcome(sockets[0], RELAY_VERSION);
    s.sendPose(at);
    assert.equal(s.sendDelve(w), true);
    assert.equal(s.sendDelve({ ...w, iw: 2 }), false, 'a word the wire would refuse');
    t += 5;
    s.sendPose({ ...at, x: HOLD.x + 1 });   // inside the pose rate: kept, not said
    const n = sockets[0].sent.length;
    assert.equal(s.sendDelve(w), true);
    assert.deepEqual(frames(sockets[0]).slice(n).map((f) => [f.t, f.p?.x]), [['pose', HOLD.x + 1], ['dv', undefined]], 'my pose made current, then the word');
    s.poseDown = () => [HOLD.x + 2, 0, HOLD.z];
    t += 5;
    s.sendPose({ ...at, x: HOLD.x + 3 });
    assert.equal(s.sendDelve(w), true);
    assert.equal(frames(sockets[0], 'pose').at(-1).p.dd, 1, 'a body lying down said lying, as sendPose says it');
    s.poseDown = null;
    let went = 0;
    for (let k = 0; k < 3 * DELVE_HZ_MAX; k++) if (s.sendDelve(w)) went++;
    assert.ok(went < DELVE_HZ_MAX, `the gate holds: ${went}`);
    t += 5_000;   // the bucket full again: what follows is refused for its own reason
    assert.equal(s.sendDelve(w), true);
    const heard = [];
    s.onDelve = (m, room) => heard.push([m.k, room]);
    sockets[0].receive({ t: 'dv', k: 'pl?' });
    s.join('dungeon:m8', at);   // another dungeon: its socket opens before its welcome, the last welcome's word kept
    const B = sockets.at(-1);
    B.open();
    assert.equal(s.sendDelve(w), false, 'never before this socket\'s own welcome');
    assert.equal(frames(B, 'dv').length, 0);
    s.join(worldRoom(1000, 1000), at);
    const C = sockets.at(-1);
    C.open();
    welcome(C, RELAY_VERSION);
    assert.equal(s.sendDelve(w), false, 'a cell is no dungeon');
    C.receive({ t: 'dv', k: 'pl?' });
    assert.deepEqual(heard, [['pl?', KEY]], 'heard from a dungeon\'s room alone');
  } finally { console.info = log; }
});
