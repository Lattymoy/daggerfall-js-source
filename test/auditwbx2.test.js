// AUDIT WBX2 (2026-09-26, Mac: "Audit this before we merge"): THE BRANCH READ WHOLE AGAINST MAIN BEFORE IT MERGES -
// the relay's fight, its hub's receipts and the client's spoils - and every finding checked in the code before it was
// fixed. M1 a crash's spoils given again at every boot offline (their record's keeper was made online alone); M2 a
// Warden every fighter had left stood up whole for the first back; M3 a `spent` that came before the kill's own word
// lost, and the copy stored after it handed to every other device; M4 the kept copy handed to a court fighter's other
// tab or device before their own floor spent it; M5 a kill in the air stood him in two places (the screens flew him,
// the relay held him at the leap's start); M6 an older build's mark for anyone said spent for another account; M7 a
// root check's `first` that was always true; M8 the beat's copy of the kill's rule (M5's other half); M9 the sweep's
// cursors read twice. M10, the court's frame run twice on the collapse frame, is its putting itself away (the link is
// left first) - not changed. Design: bible/11-Multiplayer/World-Bosses.md section 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newFight, joinFight, retireShare, restoreShare, freeSeat, stepBrain, settleAt, applyHit, standsAt, leapAt, LEAP_AIR_MS,
  ATTACKS, HIT_KINDS, ABSENT_RETIRE_MS, BUCKET_DEPTH_X, dpsRef,
} from '../src/net/gateBrain.js';
import { mintReceipt, RECEIPT_TTL_S } from '../src/net/gateReceipt.js';
import { gateTimes } from '../src/net/gateLaw.js';
import { SOCIAL_ROOM, gateReceiptKey, GATE_HERE_HOLD_MS } from '../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { bossPlace } from '../src/world/gateBoss.js';
import { createSpoilsPool, spoilsStore, SPOILS_DAY_KEY, spentKey } from '../src/scenes/spoilsPool.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('AUDIT WBX2 M1 the crash\'s records have their keeper online or not: the spoils pool is made whatever the session, every save that lands is told to it, and the crash\'s door hands each record to it - offline no save could ever clear a record, and its spoils came back at every boot (mutants: the save\'s word online alone)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const spoilsPool = createSpoilsPool\(\{/, 'made online or not');
  assert.doesNotMatch(w, /const spoilsPool = gateLink \?/);
  assert.match(w, /\n {2}onSlotSaved\(\(characterId\) => \{ try \{ spoilsPool\.saved\(characterId\);/, 'every save that lands, told');
  assert.match(w, /onHanded: \(rec\) => spoilsPool\.adopt\(rec\)/, 'every record handed back, adopted');
});

/** A fight with two fighters of level 10 at `frac` of his health. */
function fightAt(frac) {
  const f = newFight(7, 0, 100_000_000, 'ruhn');
  joinFight(f, 'a', 'A', 10, 0, true);
  joinFight(f, 'b', 'B', 10, 0, true);
  f.hp = frac * f.max;
  return f;
}

test('AUDIT WBX2 M2 a Warden every fighter has left keeps the fraction he stood at: the first back, and a newcomer, find him there with an empty bucket - never whole (mutants: the last share out forgetting the fraction; the fraction of nothing taken as whole)', () => {
  // through the beat: both fighters gone past ABSENT_RETIRE_MS while the beat still runs (a socket with no fight of its own)
  const f = fightAt(0.1);
  for (let t = 250; t <= ABSENT_RETIRE_MS + 1000; t += 250) stepBrain(f, t, [], () => 0.5);
  assert.ok(f.players.a.retired && f.players.b.retired, 'both retired');
  assert.equal(f.max, 0);
  assert.ok(Math.abs(standsAt(f) - 0.1) < 1e-9, 'the fraction he stood at, kept');
  joinFight(f, 'a', 'A', 10, ABSENT_RETIRE_MS + 2000, true);   // back: the known fighter's `in`
  assert.ok(f.max > 0 && Math.abs(f.hp / f.max - 0.1) < 1e-9, `back at a tenth, not whole: ${f.hp / f.max}`);
  // a newcomer to a fight nobody stands in: at that fraction, and no fresh bucket on top of it
  const g = fightAt(0.25);
  retireShare(g, g.players.a); retireShare(g, g.players.b);
  assert.ok(joinFight(g, 'c', 'C', 10, 1000, true));
  assert.ok(Math.abs(g.hp / g.max - 0.25) < 1e-9, 'a newcomer never heals him');
  assert.equal(g.players.c.bucket, 0, 'and brings no full bucket to a bled fight');
  assert.ok(BUCKET_DEPTH_X * dpsRef(10) > 0);
  // and a seat freed as the last share leaves keeps it too
  const h = fightAt(0.5);
  retireShare(h, h.players.a);
  assert.ok(freeSeat(h, new Set(['a'])), 'b\'s seat freed (nothing done, not present; a is)');
  assert.equal(h.players.b, undefined);
  assert.equal(h.max, 0); assert.ok(Math.abs(standsAt(h) - 0.5) < 1e-9);
  restoreShare(h, h.players.a);
  assert.ok(Math.abs(h.hp / h.max - 0.5) < 1e-9);
  assert.equal(standsAt(newFight(7, 0, 1, 'ruhn')), 1, 'a fresh fight stands whole');
});

const DAY = 200;
/** The hub and the clock, Date.now moved with it for the relay's own reads. */
async function withHub(fn) {
  const realNow = Date.now;
  const clock = { t: gateTimes(DAY).openAt + 60_000 };
  Date.now = () => clock.t;
  try {
    const world = fakeRooms({ now: () => clock.t });
    const hub = world.room(SOCIAL_ROOM);
    const fell = (rc, here = []) => hub.room.fetch(new Request('https://relay.internal/internal/gate/fell', { method: 'POST', body: JSON.stringify({ d: DAY, at: clock.t, top: ['A'], n: rc.length, rc, here }) }));
    const mint = (sub, c) => mintReceipt({ d: DAY, b: 'ruhn', s: sub, c, x: 'dealt', l: 12 }, null, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock.t / 1000) });
    const rcpts = (ws) => ws.sent.filter((m) => m.t === 'gate' && m.k === 'rcpt');
    await fn({ hub, clock, fell, mint, rcpts });
  } finally { Date.now = realNow; }
}

test('AUDIT WBX2 M3 a spent word that comes before the kill\'s own is kept in the copy\'s place for a receipt\'s life: a hello between keeps it, the kill\'s word (and a tell again) stores no copy over it and hands none, and no other device is handed one (mutants: the mark handed over a hello; the copy stored over the mark; the mark\'s account handed it at the kill)', async () => {
  await withHub(async ({ hub, clock, fell, mint, rcpts }) => {
    const r = await mint('acct-peer-0005', 7);
    const court = hub.connect(); await hub.hello(court, 'peer-0005');
    await hub.raw(court, JSON.stringify({ t: 'gate', k: 'spent', d: DAY }));   // the floor spent it - before the hub heard of the kill
    const mark = { d: DAY, spent: true, e: Math.floor(clock.t / 1000) + RECEIPT_TTL_S };
    assert.deepEqual(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')), mark, 'the word, kept');
    clock.t += 10;
    const between = hub.connect(); await hub.hello(between, 'peer-0015', null, { tokenSub: 'acct-peer-0005', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.equal(rcpts(between).length, 0);
    assert.deepEqual(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')), mark, 'a hello between leaves the word standing');
    clock.t += 5000;   // the tell again, GATE_TELL_RETRY_MS on
    assert.equal((await fell([['acct-peer-0005', r]])).status, 200);
    assert.equal(rcpts(court).length + rcpts(between).length, 0, 'the kill hands its spent account nothing');
    assert.deepEqual(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')), mark, 'no copy stored over the word');
    assert.equal((await fell([['acct-peer-0005', r]])).status, 200, 'a tell said twice');
    const phone = hub.connect(); await hub.hello(phone, 'peer-0025', null, { tokenSub: 'acct-peer-0005', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.equal(rcpts(phone).length, 0, 'another device is handed nothing');
    // its life ends: the sweep, or the next hello, forgets it
    clock.t = (mark.e + 1) * 1000;
    const late = hub.connect(); await hub.hello(late, 'peer-0035', null, { tokenSub: 'acct-peer-0005', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.equal(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')), undefined);
  });
});

test('AUDIT WBX2 M4 a court fighter\'s kept copy is held from their hellos GATE_HERE_HOLD_MS - their own floor spends it and says so; past it, it is handed as any other (a court tab that died before its burst has them back); an account away from the court is held nothing (mutants: the hold never read; the hold never set)', async () => {
  await withHub(async ({ hub, clock, fell, mint, rcpts }) => {
    const r6 = await mint('acct-peer-0006', 8), r7 = await mint('acct-peer-0007', 9);
    assert.equal((await fell([['acct-peer-0006', r6], ['acct-peer-0007', r7]], ['acct-peer-0006'])).status, 200);
    assert.equal((await hub.room.state.storage.get(gateReceiptKey('acct-peer-0006'))).hold, clock.t + GATE_HERE_HOLD_MS);
    assert.equal((await hub.room.state.storage.get(gateReceiptKey('acct-peer-0007'))).hold, undefined, 'away from the court: no hold');
    clock.t += 1000;
    const town = hub.connect(); await hub.hello(town, 'peer-0016', null, { tokenSub: 'acct-peer-0006', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.equal(rcpts(town).length, 0, 'a tab in town, just after the kill: held');
    const away = hub.connect(); await hub.hello(away, 'peer-0007');
    assert.equal(rcpts(away).length, 1, 'the away fighter\'s next hello is handed theirs at once');
    clock.t += GATE_HERE_HOLD_MS;
    const later = hub.connect(); await hub.hello(later, 'peer-0026', null, { tokenSub: 'acct-peer-0006', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.deepEqual(rcpts(later).map((m) => m.r), [r6], 'past the hold: handed as any other');
    // and spent within the hold: never handed at all
    await hub.raw(later, JSON.stringify({ t: 'gate', k: 'spent', d: DAY }));
    const again = hub.connect(); await hub.hello(again, 'peer-0036', null, { tokenSub: 'acct-peer-0006', cl: 1 });   // ONE-SEAT: a device going online claims
    assert.equal(rcpts(again).length, 0);
  });
  assert.ok(GATE_HERE_HOLD_MS >= 30_000 && GATE_HERE_HOLD_MS <= 10 * 60_000, 'long enough for the floor to spend it, short enough to have them back');
});

test('AUDIT WBX2 M5/M8 the leap is ONE law: the beat flies him through the air as every screen does, and a kill in the air settles him where every screen froze him - the relay\'s state, a late joiner\'s, and the fall\'s fold on a screen that saw it agree (mutants: the relay\'s leap landing at once; the beat\'s own copy of the flight)', () => {
  const atk = { i: 1, a: ATTACKS.leap.id, at: 10_000, x: 0, z: 0, yw: 0, tg: [[10, 0]], until: 12_000 };
  const mid = atk.at - LEAP_AIR_MS / 2;
  assert.equal(leapAt(atk, atk.at - LEAP_AIR_MS - 1), null, 'on the floor through the wind-up');
  assert.deepEqual(leapAt(atk, mid), [5, 0], 'half way across the air');
  assert.deepEqual(leapAt(atk, atk.at + 500), [10, 0], 'down where it lands');
  // the screen's own place is the law's
  const s0 = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', hp: 100, max: 1000, x: 0, z: 0 };
  const flying = foldGate(s0, { k: 'atk', ...atk }, atk.at - 1000);
  assert.deepEqual(bossPlace(flying, mid), leapAt(atk, mid));
  // the beat: a step in the air carries him there
  const f = newFight(7, 0, 100_000_000, 'ruhn');
  joinFight(f, 'p', 'P', 10, 0, true);
  f.pos = [0, 0]; f.atk = { ...atk }; f.shieldUntil = 0; f.nextAt = Infinity;
  stepBrain(f, mid, [{ sub: 'p', x: 0, z: 20, dead: false }], () => 0.5);
  assert.deepEqual(f.pos.map((v) => Math.round(v * 1000) / 1000), [5, 0], 'the relay flies him as the screens do');
  // the kill in the air: the relay's state and the screen's fold, one place
  const g = newFight(7, 0, 100_000_000, 'ruhn');
  joinFight(g, 'p', 'P', 10, 0, true);
  g.pos = [0, 0]; g.atk = { ...atk }; g.hp = 1; g.shieldUntil = 0;
  applyHit(g, 'p', 50, HIT_KINDS.Spell, { x: 0, z: 0 }, mid);
  assert.ok(g.fell, 'he fell in the air');
  const seen = foldGate(flying, { k: 'fell', at: mid, top: [], n: 1 }, mid + 50, bossPlace);
  assert.deepEqual(g.pos.map((v) => Math.round(v * 1000) / 1000), [seen.x, seen.z].map((v) => Math.round(v * 1000) / 1000), 'where every screen froze him');
  const h = newFight(7, 0, 100_000_000, 'ruhn');
  h.pos = [0, 0]; h.atk = { ...atk };
  settleAt(h, mid);
  assert.deepEqual(h.pos, [5, 0]);
  // one copy of the rule: the beat asks the kill's
  const brain = read('src/net/gateBrain.js');
  assert.match(brain, /if \(f\.atk\) \{\n {4}settleAt\(f, now\);/);
  assert.match(read('src/world/gateBoss.js'), /const leap = atk \? leapAt\(atk, now\) : null;/);
});

test('AUDIT WBX2 M6 an older build\'s mark for anyone still refuses the spoils here, but only this account\'s own spend is said to the hub - said for another it made their receipt forgotten on every device (mutants: the word for any mark)', () => {
  const disk = new Map();
  const storage = { getItem: (k) => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, v), removeItem: (k) => disk.delete(k) };
  const st = spoilsStore(storage);
  st.set(SPOILS_DAY_KEY, [spentKey(700, '*')]);
  const spent = [];
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store: st, who: () => 'char-1', wall: () => 1_700_000_000_000, onSpent: (d) => spent.push(d) });
  assert.equal(p.grant({ day: 700, seed: 3, level: 5, acct: 'b' }), false, 'refused, as it was');
  assert.deepEqual(spent, [], 'but not said for b');
  assert.equal(p.spew({ day: 700, seed: 3, level: 5, at: [0, 0, 0], bearing: 0, acct: 'b' }), false);
  assert.deepEqual(spent, []);
  st.set(SPOILS_DAY_KEY, [spentKey(701, 'b')]);
  assert.equal(p.grant({ day: 701, seed: 3, level: 5, acct: 'b' }), false);
  assert.deepEqual(spent, [701], 'b\'s own: said again, for a hub that missed it');
});

test('AUDIT WBX2 M7 the stone asks for a player in a horn\'s root at every stand - its first, and one where it has moved (the gate of another place) - never while it stands still (mutants: the first stand only)', async () => {
  const { createGatePool, ROOT_TRAP } = await import('../src/scenes/gatePool.js');
  const { gateYaw } = await import('../src/net/gateLaw.js');
  const T = gateTimes(2000);
  let now = T.riseAt + 20_001;
  const landed = [];
  const col = { addMesh() {}, removeBucket() {} };
  const g = { day: 2000, px: 10, py: 10, spot: [0, 0], near: 'X', phase: 'sealed', t: T, fellAt: null };
  let shift = [0, 0, 0], feetAt = null;
  const pool = createGatePool({ collider: () => col, standing: () => g, pixelTranslation: () => shift, heightAt: () => 0, now: () => now, feet: () => feetAt, landBefore: (gg) => { landed.push(gg.day); return true; } });
  pool.frame(0.016);
  assert.deepEqual(landed, [], 'stood with nobody in its roots');
  const yaw = gateYaw(2000), c = Math.cos(yaw), s = Math.sin(yaw);
  feetAt = [64 + c * ROOT_TRAP.x, 0.5, -s * ROOT_TRAP.x];   // where a root will stand once the gate stands 64 m on
  now += 16; pool.frame(0.016);
  assert.deepEqual(landed, [], 'standing still, it asks nothing');
  shift = [64, 0, 0];
  now += 16; pool.frame(0.016);
  assert.deepEqual(landed, [2000], 'stood again where it moved, over them: set down');
  assert.match(read('src/scenes/gatePool.js'), /const f = feet\(\);\n {4}if \(f && g && inGateRoot\(place, f\)\) landBefore\(g\);/);
});

test('AUDIT WBX2 M9 the sweep reads its three cursors in one storage read', () => {
  const idx = read('server/src/index.js');
  assert.match(idx, /const cur = \(await this\.state\.storage\.get\(\['sweep:acct', 'sweep:party', 'sweep:gaterc'\]\)\);/);
  assert.doesNotMatch(idx, /storage\.get\('sweep:gaterc'\)/);
});
