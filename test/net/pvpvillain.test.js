// PVP-VILLAIN (the PvP rework, 2026-10-29 - the owner's "v3" numbers; "if u get attacked first u dont gain any villany to
// kill htem", "as well as if somoe attack your party", "so u cant get pushed in becoming a villian its a CHOICES";
// bible/11-Multiplayer/PvP-Rework.md): the villain meter's law (systems/wild/villainLaw.js), the referee's kill-side points
// (net/wild/wildRef.js), the signed fall carrying them (wildReceipt.js `vp`), the relay's words (`vil`, the flag's `v`),
// the red skull on the page (scenes/pvpFlagHost.js) and the sheet's bar (ui/pvpVillainBar.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VILLAIN, villainClamp, isVillain, villainKillPoints, villainAfter, villainMonsterLowers, villainQuestLowers, villainRaidLowers } from '../../src/systems/wild/villainLaw.js';
import { newWildRef, wildZone, wildBlow, wildOpen, wildFirst, wildOpenedBy, wildVillainy, wildRed, wildFlagWord, wildAggroWord, wildCarry, wildCarryOf, wildFallOf, wildCredit, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { PVP_FLAG, pvpFlagRefusal } from '../../src/systems/wild/pvpFlag.js';
import { mintWildReceipt, readWildReceipt, wildReceiptValid, WILD_VILLAIN_MAX } from '../../src/net/wild/wildReceipt.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { validWildRefOut, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { createPvpFlagHost, pvpVillainy } from '../../src/scenes/pvpFlagHost.js';
import { villainyLine, statsVillainy } from '../../src/ui/pvpVillainBar.js';
import { fakeRoom } from '../fakeRoom.mjs';

const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
const FIST = { w: -1, m: 0 };
const L = PVP_FLAG.lockMs;
const A = 'acct-a', B = 'acct-b', C = 'acct-c';
const hit = (st, now, by = A, to = B) => wildBlow(st, by, to, { d: 999, held: FIST, rid: '0123456789ab' }, now);
/** Fighters in the zone past their safe passage: `[sub, level, flag]`. */
function enter(...who) {
  const st = newWildRef();
  who.forEach(([sub, cl, fl], i) => { wildZone(st, sub, { id: `peer-${sub.slice(-1)}`, lv: 10, cl, ci: `r-${sub.slice(-1)}`, fl }, true, at(i % 2 ? 1 : -1), 0); st.fighters.get(sub).graceUntil = -Infinity; });
  return st;
}
/** `by` strikes `to` until it falls; answers the fall and the time. */
function fell(st, t0, by = A, to = B) {
  let r, k = 0;
  do { r = hit(st, t0 + 300 * k++, by, to); } while (!r.fell && k < 400);
  assert.ok(r.fell, `${to} fell`);
  return { fall: r.fall, now: t0 + 300 * (k - 1) };
}

test('PVP-VILLAIN THE LAW (systems/wild/villainLaw.js): 0..10,000, red at 5,000; a kill +100 a level from 5 under, +2,000 an unflagged victim, none in self-defence; a monster at or above my level less 1 -1, a quest -200, a raid -500 (none while red) (mutants: each number; each edge)', () => {
  assert.deepEqual(VILLAIN, { max: 10_000, red: 5_000, perLevel: 100, fromLevels: 5, unflagged: 2_000, monster: 1, monsterBelow: 1, quest: 200, raid: 500 });
  assert.deepEqual([villainClamp(-5), villainClamp(12_000), villainClamp('x'), villainClamp(3240.9)], [0, 10_000, 0, 3240]);
  assert.deepEqual([isVillain(4999), isVillain(5000), isVillain(null)], [false, true, false]);
  const k = (killer, victim, flagged = true, defended = false) => villainKillPoints({ killer, victim, flagged, defended });
  assert.deepEqual([k(40, 35), k(40, 36), k(40, 30), k(40, 40), k(35, 45)], [500, 0, 1000, 0, 0], 'flagged: from 5 under, none above');
  assert.deepEqual([k(40, 35, false), k(40, 36, false), k(30, 45, false)], [2500, 2000, 2000], 'unflagged: the same and 2,000');
  assert.deepEqual([k(45, 30, false, true), k(40, 30, true, true)], [0, 0], 'self-defence adds none');
  assert.deepEqual([k(null, 30), k(null, 30, false)], [0, 2000], 'no level: no level points');
  assert.deepEqual([villainAfter(9_900, 500), villainAfter(100, -200), villainAfter(4_000, 1_000)], [10_000, 0, 5_000]);
  assert.deepEqual([villainMonsterLowers(40, 39), villainMonsterLowers(40, 38), villainMonsterLowers(40, 50)], [1, 0, 1]);
  assert.deepEqual([villainQuestLowers(), villainRaidLowers(4_999), villainRaidLowers(5_000)], [200, 500, 0]);
});

test('PVP-VILLAIN THE REFEREE (net/wild/wildRef.js): a fall carries its points (`vp`) - by the levels the tokens sign and the victim\'s flag; none where the victim struck first, or struck the killer\'s party first; the meter laid on the killer, red at 5,000 holds its flag up (mutants: the first strike unkept; the party unasked; the meter unlaid; the flag unheld)', () => {
  let st = enter([A, 45, 1], [B, 40, 1]);
  let { fall, now } = fell(st, 1_000);
  assert.equal(fall.vp, 500, '5 under, flagged');
  assert.deepEqual(wildVillainy(st, fall), { vi: 500, turned: false });
  assert.equal(st.fighters.get(A).vi, 500);
  st = enter([A, 45, 1], [B, 40, 1]);
  hit(st, 1_000, B, A);
  assert.equal(wildFirst(st, A, B, 1_000), B, 'the victim struck first');
  ({ fall } = fell(st, 2_000));
  assert.equal(fall.vp, 0, 'self-defence');
  st = enter([A, 45, 1], [B, 40, 0]);
  ({ fall, now } = fell(st, 1_000));
  assert.equal(fall.vp, 2500, 'an unflagged victim, 5 under');
  st = enter([A, 45, 1], [B, 40, 1], [C, 45, 1]);
  hit(st, 1_000, B, C);
  assert.deepEqual(wildOpenedBy(st, B, 1_000), [C], 'the victim opened on C');
  ({ fall } = fell(st, 2_000));
  assert.equal(fall.vp, 500, 'the referee alone: C is no party of its');
  assert.deepEqual(wildVillainy(st, fall, true), { vi: 0, turned: false }, 'C the killer\'s party: none');
  assert.equal(fall.vp, 0);
  // the fight's minute: a blow of the killer's a minute ago is a new fight's
  st = enter([A, 45, 1], [B, 40, 1]);
  wildOpen(st, B, A, 0);
  assert.equal(wildFirst(st, A, B, L - 1), B);
  assert.equal(wildFirst(st, A, B, L), null, 'stale');
  wildOpen(st, A, B, L);
  assert.equal(wildFirst(st, A, B, L), A, 'a new fight, opened by its striker');
  // red: the flag held up, the words marked
  st = enter([A, 45, 1], [B, 30, 0]);
  st.fighters.get(A).vi = 4_000;
  ({ fall, now } = fell(st, 1_000));
  assert.deepEqual(wildVillainy(st, fall), { vi: 7_500, turned: true });
  const x = st.fighters.get(A);
  wildZone(st, A, { id: 'peer-a', lv: 10, cl: 45, ci: 'r-a', fl: 0 }, true, at(-1), now + 10 * L);
  assert.equal(x.flag, true, 'a villain is always in aggro');
  assert.deepEqual(wildRed(x), { v: 1 });
  assert.equal(wildFlagWord(x, now + 10 * L).v, 1);
  x.aggroSaid = -Infinity;
  assert.equal(wildAggroWord(x, now).v, 1);
  assert.deepEqual(wildRed(st.fighters.get(B)), {});
  // the meter rides the carry into the next room, and a kept fall its points
  const carry = wildCarryOf(wildCarry(st, A, now));
  assert.equal(carry.vi, 7_500);
  const next = newWildRef();
  wildZone(next, A, { id: 'peer-a', lv: 10, cl: 45, ci: 'r-a', carry }, true, at(0), now + 10 * L);
  assert.equal(next.fighters.get(A).vi, 7_500, 'no decay, no age');
  assert.equal(wildFallOf(JSON.parse(JSON.stringify(fall))).vp, 2_000 + 1500);
  assert.equal(wildFallOf({ ...fall, vp: 'x' }).vp, 0);
  // a death the referee did not see, credited, carries points too
  st = enter([A, 45, 1], [B, 40, 1]);
  hit(st, 1_000);
  assert.equal(wildCredit(st, B, 'abcdefabcdef', 2_000).fall.vp, 500);
});

test('PVP-VILLAIN THE RECEIPT (net/wild/wildReceipt.js): a fall signs its points as `vp`, absent for none, 1..10,000 (mutants: the points unsigned; the bound)', async () => {
  const base = { f: 'acct-0001', c: 'r00000000000000000a01', k: 'acct-0002', r: '0123456789ab', w: -1 };
  const o = { subtle: globalThis.crypto.subtle, nowS: 1_800_000_000 };
  assert.equal(readWildReceipt(await mintWildReceipt({ ...base, vp: 2_500 }, null, o)).vp, 2_500);
  assert.equal(readWildReceipt(await mintWildReceipt(base, null, o)).vp, undefined);
  assert.equal(WILD_VILLAIN_MAX, VILLAIN.max);
  const c = { ...base, i: 1, e: 2 };
  assert.deepEqual([0, WILD_VILLAIN_MAX + 1, '5', 1.5].map((vp) => wildReceiptValid({ ...c, vp })), [false, false, false, false]);
  assert.equal(wildReceiptValid({ ...c, vp: WILD_VILLAIN_MAX }), true);
});

test('PVP-VILLAIN THE WIRE (net/wire.js): the flag word\'s `v` 1 (up alone), and `vil` my meter 0..10,000 (mutants: the mark dropped; the meter unbounded)', () => {
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 1, v: 1 }), { k: 'flag', id: 'peer-0001', f: 1, v: 1 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 0, v: 1 }), { k: 'flag', id: 'peer-0001', f: 0 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 1, v: 2 }), { k: 'flag', id: 'peer-0001', f: 1 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'vil', n: 3_240 }), { k: 'vil', n: 3_240 });
  for (const n of [-1, 10_001, '5', 1.5]) assert.equal(validWildRefOut({ t: 'wref', k: 'vil', n }), null, String(n));
});

test('PVP-VILLAIN THE PAGE (scenes/pvpFlagHost.js, ui/pvpVillainBar.js): a peer the referee marks wears a red skull, my meter at 5,000 mine, my flag stays up; the sheet says "Villainy 3,240 / 5,000" on a bar to 10,000 marked at 5,000 (mutants: the red unread; my meter unheard; the drop allowed; the line)', () => {
  const said = [];
  const online = { id: 'peer-me', wildOk: true, setWildFlag: () => {} };
  const f = createPvpFlagHost(() => online, { level: 40 }, (l) => said.push(l), { say: () => {} }, { doc: null, now: () => 0 });
  assert.equal(pvpVillainy(), null, 'unheard: no bar');
  f.heard({ k: 'flag', id: 'peer-x', f: 1, v: 1 });
  f.heard({ k: 'flag', id: 'peer-y', f: 1 });
  assert.deepEqual([f.skullOf('peer-x'), f.skullOf('peer-y')], ['red', 'white']);
  f.heard({ k: 'flag', id: 'peer-x', f: 1 });
  assert.equal(f.skullOf('peer-x'), 'white', 'no longer marked');
  assert.equal(f.wrap(() => assert.fail('taken here'))({ k: 'vil', n: 3_240 }), undefined);
  assert.equal(pvpVillainy(), 3_240);
  f.toggle();
  assert.equal(f.mySkull(), 'white');
  f.heard({ k: 'vil', n: 5_000 });
  assert.equal(f.mySkull(), 'red');
  assert.equal(f.toggle(), false);
  assert.equal(said.at(-1), 'You are a villain. Your PvP flag stays on.');
  assert.equal(pvpFlagRefusal({ on: false, red: true }), 'You are a villain. Your PvP flag stays on.');
  assert.deepEqual([villainyLine(3_240), villainyLine(0), villainyLine(6_100)], ['3,240 / 5,000', '0 / 5,000', '6,100 / 10,000']);
  const node = (tag, cls, text) => ({ tag, cls, text, kids: [], style: {}, append(...k) { this.kids.push(...k); } });
  const detail = node('div');
  const meter = (now, max, tone) => ({ ...node('meter'), now, max, tone });
  statsVillainy(detail, { el: node, meter }, null);
  assert.equal(detail.kids.length, 0, 'none before the referee\'s word');
  statsVillainy(detail, { el: node, meter }, 3_240);
  const [row] = detail.kids, [top, bar] = row.kids;
  assert.deepEqual(top.kids.map((k) => k.text), ['Villainy', '3,240 / 5,000']);
  assert.deepEqual([bar.now, bar.max, bar.kids[0].style.left], [3_240, 10_000, '50%']);
  statsVillainy(detail, { el: node, meter }, 5_000);
  assert.equal(detail.kids.at(-1).text, 'You are a villain. You have a red skull, and your PvP flag stays on.');
});

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };

test('PVP-VILLAIN THE RELAY (server/src/index.js _wildVillainy): one entering is told its meter; a kill tells its killer the meter and signs the points in the fall\'s receipt; a new villain\'s red said to the room (mutants: the meter untold; the receipt unpointed; the red unsaid)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(CELL, { now: () => clock });
    const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
    const join = async (id, x, ci, cl) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci, charLevel: cl }); return ws; };
    const a = await join('peer-0001', -1, 'r00000000000000000a02', 45), b = await join('peer-0002', 1, 'r00000000000000000a01', 30);
    await say(a, { k: 'zone', z: 1, fl: 1 });
    await say(b, { k: 'zone', z: 1, fl: 0 });
    const vils = (ws) => ws.sent.filter((m) => m.t === 'wref' && m.k === 'vil').map((m) => m.n);
    assert.deepEqual(vils(a), [0], 'told on entry');
    clock += WILD_GRACE.ms + 1;
    for (let n = 1; n < 400 && !b.sent.some((m) => m.t === 'wref' && m.k === 'fell'); n++) { clock += 300; await say(a, { k: 'strike', to: 'peer-0002', n, by: 'melee', p: W(-1), d: 999 }); }
    assert.ok(b.sent.some((m) => m.t === 'wref' && m.k === 'fell'), 'b fell');
    assert.deepEqual(vils(a), [0, 3_500], '15 under and unflagged');
    assert.deepEqual(vils(b), [0], 'the victim is told nothing new');
    clock += 61_000;
    await say(a, { k: 'zone', z: 1 });
    const rc = a.sent.find((m) => m.t === 'wref' && m.k === 'rc');
    assert.equal(readWildReceipt(rc.rc).vp, 3_500, 'signed in the fall');
    clock += 120_001;
    await say(b, { k: 'zone', z: 1, fl: 0 });   // risen
    const fells = () => b.sent.filter((m) => m.t === 'wref' && m.k === 'fell').length;
    for (let n = 500; n < 900 && fells() < 2; n++) { clock += 300; await say(a, { k: 'strike', to: 'peer-0002', n, by: 'melee', p: W(-1), d: 999 }); }
    assert.equal(fells(), 2, 'b fell again');
    assert.deepEqual(vils(a).at(-1), 7_000);
    assert.ok(b.sent.some((m) => m.t === 'wref' && m.k === 'flag' && m.id === 'peer-0001' && m.v === 1), 'the room told a villain is red');
  } finally { Date.now = realNow; }
});
