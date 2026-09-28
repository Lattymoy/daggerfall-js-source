// AUDIT WBX (2026-09-26, Mac: "Do a comprehensive audit on everything so far"): THE OBLIVION GATE, AUDITED AGAIN - the
// relay's fight (R: shares left behind, seats held by nothing, a dead band at the court's edge, "half the fight" read
// off the wall, the bar frozen through the Wrath's wind-up, a blow after midnight, a client that did not know the new
// attacks, receipts kept for ever), the spoils (S: a receipt spent on one device given again on another, the level a
// receipt was earned at, a crash record cleared by two clocks, two tabs, a full store, the pack's own pictures), and
// the court (F: a weapon destroyed on him, where he fell, a charge that froze him, a Soul Trap at range and recast, the
// charge's width, the burning ground's dance, steps in the air, the Wrath slept through). Design:
// bible/11-Multiplayer/World-Bosses.md section 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newFight, joinFight, applyHit, stepBrain, attacksFor, settleAt, ATTACKS, ATTACK_BY_ID, BOSS_R, COURT_R, BOSS_REACH_R, COURT_CENTRE, ABSENT_RETIRE_MS, BRAIN_TICK_MS, HIT_KINDS,
} from '../src/net/gateBrain.js';
import { mintReceipt, readReceipt, receiptValid, RECEIPT_TTL_S } from '../src/net/gateReceipt.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { SOCIAL_ROOM, GATE_BRAIN_V, gateReceiptKey, relaySupportsGateSpent, GATE_SPENT_RELAY_MIN, validGateIn } from '../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { bossPlace } from '../src/world/gateBoss.js';
import { telegraphShape, telegraphField } from '../src/render/gateTelegraph.js';
import { inAttack, chargeStrikes } from '../src/net/gateStrike.js';
import { createSpoilsPool, spoilsStore, recoverSpoils, spoilsLevel, SPOILS_STORE_KEY, SPOILS_DAY_KEY, SPOILS_RECORD_V, spentKey } from '../src/scenes/spoilsPool.js';
import { SPECIAL_ARTIFACT_HANDLERS, ARTIFACTS } from '../src/systems/artifactEffects.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });

// ═══ R: THE RELAY'S FIGHT ════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WBX R1 a share leaves with its fighter: one gone ABSENT_RETIRE_MS takes its share out of his health at the fraction he stands at, and brings it back when it returns - its seat, its blows and its claim kept; twenty accounts that said `in` and left no longer make him unkillable (mutants: the share left in him; the return healing him)', () => {
  const f = newFight(7, 0, 10_000_000, 'ruhn');
  for (let i = 0; i < 10; i++) joinFight(f, `h${i}`, `H${i}`, 20, 0, true);
  const honest = f.max;
  for (let i = 0; i < 20; i++) joinFight(f, `g${i}`, `G${i}`, 60, 0, true);
  assert.ok(f.max > honest * 5, 'twenty level-60 claims brought far more than the ten who stayed');
  const here = Array.from({ length: 10 }, (_, i) => body(`h${i}`, 0, 5 + i * 0.1));
  let t = 0;
  for (; t <= ABSENT_RETIRE_MS + 1000; t += BRAIN_TICK_MS) stepBrain(f, t, here, seeded(3));
  assert.ok(Math.abs(f.max - honest) < 1e-6, 'the gone twenty\'s shares are out of him');
  assert.ok(Object.values(f.players).filter((p) => p.retired).length === 20 && Object.keys(f.players).length === 30, 'their seats and claims kept');
  f.hp = f.max * 0.4;
  const frac = f.hp / f.max;
  stepBrain(f, t, [...here, body('g0', 0, 9)], seeded(4));
  assert.ok(!f.players.g0.retired && Math.abs(f.hp / f.max - frac) < 1e-9, 'back, its share back at the fraction he stands at - a return never heals him');
  assert.ok(Math.abs(f.max - (honest + f.players.g0.share)) < 1e-6);
});

test('AUDIT WBX R3 no dead band at the court\'s edge: a lone fighter against the rim is cleaved in the Warden\'s phase - the cleave\'s reach covers the gap his ring leaves (mutants: the cleave back at 6)', () => {
  const gap = COURT_R - BOSS_REACH_R - BOSS_R;
  assert.ok(ATTACKS.cleave.range >= gap && ATTACKS.cleave.r >= COURT_R - BOSS_REACH_R, `the cleave's range ${ATTACKS.cleave.range} and reach ${ATTACKS.cleave.r} cover the rim's gap ${gap.toFixed(2)}`);
  assert.ok(attacksFor(1, gap, 0).some((a) => a === ATTACKS.cleave), 'begun at the rim\'s gap');
  const f = newFight(7, 0, 10_000_000, 'ruhn');
  joinFight(f, 'p', 'P', 20, 0, true);
  const seen = new Set();
  for (let t = 0; t < 60_000; t += BRAIN_TICK_MS) for (const w of stepBrain(f, t, [body('p', 0, COURT_R)], seeded(5))) if (w.k === 'atk') seen.add(ATTACK_BY_ID[w.a].key);
  assert.ok(seen.has('cleave'), `he strikes the fighter at the rim: ${[...seen]}`);
});

test('AUDIT WBX R5/R6 the bar through the Wrath\'s wind-up, and midnight is his: blows landing in the wind-up are said on the bar; a blow at or after the Wrath\'s hour lands nothing, beat or no beat (mutants: the wind-up\'s silence; a blow after midnight)', () => {
  const f = newFight(7, 0, 100_000, 'ruhn');
  joinFight(f, 'p', 'P', 30, 0, true);
  const bodies = [body('p', 0, 3)];
  let t = 0;
  for (; t < 100_000 - ATTACKS.wrath.windup + 500; t += BRAIN_TICK_MS) stepBrain(f, t, bodies, seeded(6));
  assert.equal(ATTACK_BY_ID[f.atk?.a], ATTACKS.wrath, 'the Wrath winding up');
  const said = [];
  for (let i = 0; i < 12; i++, t += BRAIN_TICK_MS) { applyHit(f, 'p', 50, HIT_KINDS.Spell, { x: 0, z: 3 }, t); said.push(...stepBrain(f, t, bodies, seeded(7))); }
  assert.ok(said.some((w) => w.k === 'hp'), 'the blows in the wind-up are on the bar');
  const g = newFight(7, 0, 50_000, 'ruhn');
  joinFight(g, 'p', 'P', 30, 0, true);
  assert.ok(applyHit(g, 'p', 20, HIT_KINDS.Spell, { x: 0, z: 3 }, 49_999) > 0);
  assert.equal(applyHit(g, 'p', 20, HIT_KINDS.Spell, { x: 0, z: 3 }, 60_000), 0, 'after midnight, with no beat to have said the Wrath');
});

test('AUDIT WBX R7/R6/R8 the relay\'s door: an `in` without the brain\'s law (a tab loaded before the deploy) is refused in words it knows; a blow arms the beat as an `in` does; the hub\'s sweep forgets an expired receipt (mutants: the law unasked; a blow that never wakes him; the receipt kept for ever)', async () => {
  const DAY = 200, TT = gateTimes(DAY), KEY = gateRoomKey(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(KEY);
    const pose = { x: COURT_CENTRE[0], y: 0, z: COURT_CENTRE[2] + 3, yaw: 0, pitch: 0 };
    const a = r.connect(); await r.hello(a, 'peer-0001', pose);
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'in', lv: 10 }));
    assert.deepEqual(a.sent.filter((m) => m.t === 'gate').at(-1), { t: 'gate', k: 'no', m: 'the gate is closed' }, 'no law, no fight');
    assert.ok(!r.room._fight, 'no fight made for it');
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    assert.ok(r.room._fight?.players['acct-peer-0001'], 'with it, in');
    await r.room.state.storage.deleteAlarm?.();
    r.alarm.at = null;
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'hit', q: 1, d: 5, r: HIT_KINDS.Spell }));
    assert.ok(r.alarm.at != null && r.alarm.at <= clock + BRAIN_TICK_MS, 'a blow wakes the beat');
    assert.match(read('server/src/index.js'), /for \(const \[k, r\] of kept\) \{ glast = k; if \(!r \|\| typeof r !== 'object' \|\| !\(Number\.isFinite\(r\.e\) && now < r\.e \* 1000\)\) dead\.push\(k\); \}/, 'the hub\'s sweep takes expired receipts');
  } finally { Date.now = realNow; }
});

// ═══ S: THE SPOILS ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WBX S1 a spent receipt is said to the hub, which forgets its kept copy (that day\'s alone): the next hello of any device is handed nothing; the court\'s fighters are not handed it by the hub at the kill, and any other account on its newest tab alone (mutants: the hub keeping it; every tab handed it)', async () => {
  const DAY = 200, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 60_000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const r = await mintReceipt({ d: DAY, b: 'ruhn', s: 'acct-peer-0005', c: 7, x: 'dealt', l: 12 }, null, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
    const r2 = await mintReceipt({ d: DAY, b: 'ruhn', s: 'acct-peer-0006', c: 8, x: 'dealt', l: 12 }, null, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
    const t1 = hub.connect(), t2 = hub.connect(), h6 = hub.connect();
    await hub.hello(t1, 'peer-0005'); clock += 10; await hub.hello(t2, 'peer-0015', null, { tokenSub: 'acct-peer-0005', cl: 1 }); await hub.hello(h6, 'peer-0006');   // ONE-SEAT: a second device going online claims (t1 goes)   // AUDIT ONESEAT T2: h6's hello had slid into that comment, and "a fighter in the court: its floor gives it" asked a socket that never said hello
    const res = await hub.room.fetch(new Request('https://relay.internal/internal/gate/fell', { method: 'POST', body: JSON.stringify({ d: DAY, at: clock, top: ['A'], n: 2, rc: [['acct-peer-0005', r], ['acct-peer-0006', r2]], here: ['acct-peer-0006'] }) }));
    assert.equal(res.status, 200);
    const rc = (ws) => ws.sent.filter((m) => m.t === 'gate' && m.k === 'rcpt');
    assert.equal(rc(t1).length + rc(t2).length, 1, 'one tab of the account handed it');
    assert.equal(rc(t2).length, 1, 'the newest');
    assert.equal(rc(h6).length, 0, 'a fighter in the court: its floor gives it');
    assert.ok(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0006')), 'kept for its next hello all the same');
    // spent: forgotten - that day's only
    await hub.raw(t2, JSON.stringify({ t: 'gate', k: 'spent', d: DAY - 7 }));
    assert.equal((await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')))?.r, r, 'an older day\'s word forgets nothing');
    await hub.raw(t2, JSON.stringify({ t: 'gate', k: 'spent', d: DAY }));
    // AUDIT WBX2 M3: its copy gone, and the word kept in its place for a receipt's life
    assert.deepEqual(await hub.room.state.storage.get(gateReceiptKey('acct-peer-0005')), { d: DAY, spent: true, e: Math.floor(clock / 1000) + RECEIPT_TTL_S }, 'spent: forgotten');
    const later = hub.connect(); await hub.hello(later, 'peer-0005', null, { cl: 1 });   // ONE-SEAT: the next device claims - admitted, so what it is not handed is the receipt's doing
    assert.ok(later.sent.some((m) => m.t === 'welcome'), 'in');
    assert.equal(rc(later).length, 0, 'the next device is handed nothing');
  } finally { Date.now = realNow; }
  assert.equal(GATE_SPENT_RELAY_MIN, 116);   // world114 on its branch - main's Enhanced Plus patch and GUILD1c took 114 and 115, neither hears it
  assert.ok(relaySupportsGateSpent('world116') && !relaySupportsGateSpent('world115') && !relaySupportsGateSpent('world114'), 'never said to a relay that would close the socket on it');
  assert.equal(validGateIn({ k: 'spent', d: 3 }).d, 3);
});

/** A pool over a store, recording what it says spent and what it takes. */
function pool({ store = spoilsStore(new Map()), who = 'char-1' } = {}) {
  const spent = [], took = [];
  const w = { who };
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: (x) => took.push(x), store, who: () => w.who, wall: () => 1_700_000_000_000, onSpent: (d) => spent.push(d) });
  return { p, store, spent, took, w };
}
const mapStorage = (full = () => false) => { const disk = new Map(); return { disk, getItem: (k) => disk.get(k) ?? null, setItem: (k, v) => { if (full(k, v)) throw new Error('QuotaExceededError'); disk.set(k, v); }, removeItem: (k) => disk.delete(k) }; };

test('AUDIT WBX S1/S3/S5 the pool: a spend said to the hub once its record is safe, and again when a spent receipt is offered; the record cleared by the save that holds its pieces, never by a clock; a record the store will not hold leaves the mark in memory alone and the word for the hub until a save (mutants: said before it is safe; the clock rule for this build\'s record; the mark on the device with no record)', () => {
  const st = spoilsStore(mapStorage());
  const a = pool({ store: st });
  assert.equal(a.p.grant({ day: 700, seed: 3, level: 5, acct: 'x' }), true);
  assert.deepEqual(a.spent, [700], 'safe on the device: said at once');
  assert.equal(a.p.grant({ day: 700, seed: 3, level: 5, acct: 'x' }), false);
  assert.deepEqual(a.spent, [700, 700], 'offered again: said again');
  const rec = st.get(SPOILS_STORE_KEY)[0];
  assert.equal(rec.v, SPOILS_RECORD_V); assert.equal(typeof rec.id, 'string');
  // no clock clears it - a slot stamped after it holds nothing it knows of
  const got = [];
  assert.equal(recoverSpoils(st, (x) => got.push(x), { who: 'char-1', saves: [{ characterId: 'char-1', dateAndTime: { realTime: 9e15 } }] }), rec.pieces.length);
  assert.equal(a.p.saved('char-2'), 0, 'another character\'s save holds nothing of mine');
  assert.equal(a.p.saved('char-1'), 1, 'my save, the pieces in my pack: cleared');
  assert.equal(st.get(SPOILS_STORE_KEY), null);
  // a full store: the record would not land
  const disk = mapStorage((k) => k === SPOILS_STORE_KEY);
  const s2 = spoilsStore(disk);
  const b = pool({ store: s2 });
  b.p.grant({ day: 701, seed: 4, level: 5, acct: 'x' });
  assert.deepEqual(b.spent, [], 'not safe: nothing said to the hub');
  assert.equal(disk.disk.has(SPOILS_DAY_KEY), false, 'and no mark on the device with no record under it');
  assert.equal(b.p.grant({ day: 701, seed: 4, level: 5, acct: 'x' }), false, 'this session still knows it spent it');
  assert.equal(b.p.saved('char-1'), 1, 'a save that lands holds the pieces...');
  assert.deepEqual(b.spent.slice(-1), [701], '...and the hub is told then');
  assert.deepEqual(JSON.parse(disk.disk.get(SPOILS_DAY_KEY)), [spentKey(701, 'x')], 'the mark made fast');
  // the crash's door hands this build's record over and the pool adopts it
  const s3 = spoilsStore(mapStorage());
  const c = pool({ store: s3 });
  c.p.grant({ day: 702, seed: 5, level: 5, acct: 'x' });
  const fresh = pool({ store: s3 });
  recoverSpoils(s3, () => {}, { who: 'char-1', onHanded: (r) => fresh.p.adopt(r) });
  assert.equal(fresh.p.saved('char-1'), 1, 'handed over at boot, cleared by the next save');
});

test('AUDIT WBX S2 the receipt says the level the fight admitted its account at, and the spoils roll no higher: a level-1 claim\'s receipt carried to a level-50 character rolls at 1; an older receipt with none rolls at the player\'s (mutants: the level unsigned; the player\'s level whatever the claim)', async () => {
  const nowS = 1_790_000_000;
  const r = await mintReceipt({ d: 5, b: 'ruhn', s: 'acct-x', c: 9, x: 'stood', l: 1 }, null, { subtle: globalThis.crypto.subtle, nowS });
  assert.equal(readReceipt(r).l, 1);
  const old = await mintReceipt({ d: 5, b: 'ruhn', s: 'acct-x', c: 9, x: 'stood' }, null, { subtle: globalThis.crypto.subtle, nowS });
  assert.equal(readReceipt(old).l, undefined, 'an older receipt carries none, and still reads');
  assert.equal(receiptValid({ ...readReceipt(r), signed: undefined, l: 0 }), false, 'a level of nothing is no receipt');
  assert.equal(spoilsLevel(50, 1), 1);
  assert.equal(spoilsLevel(8, 30), 8, 'never over the player\'s own');
  assert.equal(spoilsLevel(50, undefined), 50);
  assert.equal(spoilsLevel(0, undefined), 1);
  assert.match(read('server/src/index.js'), /mintReceipt\(\{ d: f\.day, b: f\.boss, s: sub, c: rand32\(\), x: earnedBy\(f, sub\), l: f\.players\[sub\]\.lv \}/, 'the relay signs the level it admitted');
});

// ═══ F: THE COURT ════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WBX F1/F2 no weapon is worn or destroyed on him: the Razor\'s whole-health blow passes his stand-in by, and no Strikes payload bills its weapon for a blow on him - every other foe as DFU has it (mutants: the Razor on the stand-in; the payload\'s bill on him)', () => {
  const razor = SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.MehrunesRazor);
  const item = { currentCondition: 100, maxCondition: 100 };
  assert.equal(razor.strikes({ target: { health: 1e9, spareGear: true }, item, rolls: () => 0.999 }), null, 'not him');
  const foe = razor.strikes({ target: { health: 40, stats: {} }, item, rolls: () => 0 });
  assert.ok(foe === null || foe.durabilityLoss === 40, 'a foe as the artifact has it');
  const e = read('src/systems/enchantments.js');
  assert.match(e, /applyResults\(target\?\.spareGear && r\?\.durabilityLoss \? \{ \.\.\.r, durabilityLoss: 0 \} : r, env\);/, 'the Strikes payloads\' bill spared on him');
  assert.match(read('src/scenes/hostEnchant.js'), /if \(target\?\.spareGear\) \{ bossSpell\?\.\(record\); return; \}/, 'a Cast When Strikes spell goes by his own spell door');
  assert.match(read('src/scenes/dungeonContext.js'), /bossSpell: opts\.gateBoss \? \(record\) => \{ spellOnBoss\(record\); \} : null,/);
});

test('AUDIT WBX F3/F4 where he stands: his fall frozen where he fell (a charge\'s head, a leap\'s flight, a walk\'s step) on every screen and in the relay\'s state; a walk\'s word ends the attack before it, so he is never drawn frozen at a charge\'s end while he walks (mutants: the fall at the last word\'s start; the charge kept through the walk)', () => {
  const s0 = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', hp: 100, max: 1000, x: 0, z: 10 };
  const charge = foldGate(s0, { k: 'atk', i: 3, a: ATTACKS.charge.id, at: 1000, x: 0, z: 10, yw: Math.PI, tg: [[0, -10]] }, 900);
  const fell = foldGate(charge, { k: 'fell', at: 1000 + ATTACKS.charge.active, top: [], n: 1 }, 1100, bossPlace);
  assert.deepEqual([fell.x, fell.z].map((v) => Math.round(v * 100) / 100), [0, -10], 'at the charge\'s end, not its start');
  assert.equal(fell.atk, null); assert.equal(fell.move, null);
  assert.deepEqual(bossPlace(fell, 5000), [fell.x, fell.z], 'and there after');
  const walked = foldGate(charge, { k: 'mv', x: 0, z: -10, tx: 10, tz: -10, v: 4, at: 3000 }, 3000);
  assert.equal(walked.atk, null, 'the walk ends the charge');
  const [wx] = bossPlace(walked, 4000);
  assert.ok(wx > 3, `walking, not frozen at the lane's end: x ${wx}`);
  // the relay: the kill settles his place by the beat's own rule
  const f = newFight(7, 0, 10_000_000, 'ruhn');
  joinFight(f, 'p', 'P', 10, 0, true);
  f.pos = [0, 10]; f.atk = { i: 1, a: ATTACKS.charge.id, at: 1000, x: 0, z: 10, yw: Math.PI, tg: [[0, -10]], until: 5000 };
  settleAt(f, 1000 + ATTACKS.charge.active);
  assert.deepEqual(f.pos.map((v) => Math.round(v * 100) / 100), [0, -10]);
  // ...and the killing blow settles it: struck down half way down his lane, the relay's state says half way
  const g = newFight(7, 0, 10_000_000, 'ruhn');
  joinFight(g, 'p', 'P', 10, 0, true);
  g.pos = [0, 10]; g.atk = { i: 1, a: ATTACKS.charge.id, at: 1000, x: 0, z: 10, yw: Math.PI, tg: [[0, -10]], until: 5000 };
  g.hp = 1; g.shieldUntil = 0;
  applyHit(g, 'p', 50, HIT_KINDS.Spell, { x: 0, z: 0 }, 1000 + ATTACKS.charge.active / 2);
  assert.ok(g.fell, 'he fell');
  assert.deepEqual(g.pos.map((v) => Math.round(v * 100) / 100), [0, 0], 'where the blow found him');
});

test('AUDIT WBX F7 the charge shows as wide as it strikes - his body\'s width about its lane, the telegraph, the static law and the sweep one (mutants: the lane drawn at half its width)', () => {
  const atk = { i: 1, a: ATTACKS.charge.id, at: 1000, x: 0, z: 0, yw: 0, tg: [[0, 20]] };
  const sh = telegraphShape(atk, 1, 1000);
  assert.equal(sh.halfW, Math.max(ATTACKS.charge.width / 2, BOSS_R));
  for (const off of [1.7, 1.76, 1.79, 1.81, 1.9]) {
    const drawn = telegraphField(sh, off, 10).inside, law = inAttack(atk, off, 10), swept = chargeStrikes(atk, off, 10, 1000 + ATTACKS.charge.active, 999);
    assert.equal(drawn, law, `${off}: drawn as the law`); assert.equal(law, swept, `${off}: the law as the sweep`);
  }
});

/** A court driven by hand, as the WBX pins drive it. */
function court({ feet = [0, 0, 5], health = 100 } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const sounds = [];
  const me = { health, maxHealth: health, level: 12 };
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, audio: { play3d: (clip) => sounds.push(clip) },
    feet: () => courtToDungeon(feet[0], feet[1], feet[2]), player: () => me, save: () => 100, strike: () => {},
  });
  return { c, link, clock, sounds, me };
}

test('AUDIT WBX F6/F9 the court: my trap on him is said while it runs (a recast stacks onto it) and outlives a walk out and back in the same day; no step on the stone while a leap carries him (mutants: the trap forgotten at the door; steps in the air)', () => {
  const h = court();
  const st = { ...GATE_STATE_EMPTY, day: 9, boss: 'ruhn', hp: 900, max: 1000, wrathAt: 1e12 };
  h.link.st = st; h.clock.t = 1000; h.c.frame();
  assert.equal(h.c.trapNow(), null);
  assert.equal(h.c.trapped({ chance: 40, rounds: 3 }), true);
  assert.deepEqual(h.c.trapNow(), { chance: 40 });
  h.c.leave(); h.clock.t = 2000; h.c.frame();
  assert.deepEqual(h.c.trapNow(), { chance: 40 }, 'out and back in: still running');
  assert.match(read('src/scenes/dungeonContext.js'), /const running = opts\.bossTrapNow\?\.\(\) \?\? null;\n\s*if \(running\) boss\.entity\.activeEffects = \[\{ kind: 'soulTrap', chance: running\.chance, roundsRemaining: 0 \}\];/, 'a recast\'s incumbent');
  // a leap in the air: no stride counted
  const g = court();
  const leap = { i: 2, a: ATTACKS.leap.id, at: 10_000, x: 0, z: -12, yw: 0, tg: [[0, 12]] };
  g.link.st = { ...st, atk: leap, x: 0, z: -12 };
  for (let t = 9000; t <= 10_000; t += 16) { g.clock.t = t; g.c.frame(); }
  assert.match(read('src/scenes/gateCourt.js'), /if \(bossHop\(s, t\) > 0\) \{ stepFrom = null; strideRun = 0; \}/);
});

test('AUDIT WBX F5 a Soul Trap reaches him at range and bursting, not by touch alone: the missile may meet him when its spell is a duel\'s or a trap, and so may its blast (mutants: the missile\'s duel word alone)', () => {
  const m = read('src/scenes/hostMagic.js');
  assert.match(m, /boss: !!duelSpellOf\(sp\) \|\| \(sp\.effects \?\? \[\]\)\.some\(\(e\) => e && isSoulTrapEffect\(e\)\)/);
  assert.match(m, /if \(m\.boss \?\? m\.duel\) \{/);
  assert.match(m, /if \(boss && caster\?\.entity === playerEntity\) for \(const t of sweepFoes\(pos, EXPLOSION_RADIUS, bossMarksFor\(spell\)\)\) giveToBoss\(t, spell\);/);
});

// ═══ W: THE GATE IN THE WORLD, AND ITS MUSIC ═════════════════════════════════════════════════════════════════════════

test('AUDIT WBX W1/W6 a player standing in a horn\'s root the moment the stone comes up whole is set down before the gate, not sealed in it - the threshold, the plinth\'s open flags and the ground about it are left alone; the fire\'s box is made when the gate\'s place moves, not every frame the hover asks (mutants: the roots\' check removed; the box made every frame; the box left where the gate stood)', async () => {
  const { createGatePool, inGateRoot, ROOT_TRAP } = await import('../src/scenes/gatePool.js');
  const { gateTimes: times } = await import('../src/net/gateLaw.js');
  const place = { origin: [100, 5, 200], yaw: 0.7 };
  const at = (lx, ly, lz) => { const c = Math.cos(place.yaw), s = Math.sin(place.yaw); return [place.origin[0] + c * lx + s * lz, place.origin[1] + ly, place.origin[2] - s * lx + c * lz]; };
  assert.ok(inGateRoot(place, at(ROOT_TRAP.x, 0, 0)) && inGateRoot(place, at(-ROOT_TRAP.x, 0.3, 0)) && inGateRoot(place, at(-3.6, 0, -1)), 'in a root');
  for (const p of [at(0, 0, 0), at(0, 0, 12), at(-7.9, 0, 0), at(0, 0, -5), at(ROOT_TRAP.x, 12, 0)]) assert.equal(inGateRoot(place, p), false, 'the threshold, the ground about, and over the horns are free');
  // the pool: the first frame the stone stands whole under a player in a root lands them before the gate
  const T = times(2000);
  let now = T.riseAt + 5000;
  const landed = [];
  const col = { buckets: new Map(), addMesh(k) { this.buckets.set(k, true); }, removeBucket(k) { this.buckets.delete(k); } };
  const g = { day: 2000, px: 10, py: 10, spot: [0, 0], near: 'X', phase: 'rising', t: T, fellAt: null };
  let feetAt = null;
  let shift = [0, 0, 0];
  const pool = createGatePool({ collider: () => col, standing: () => ({ ...g, phase: now >= T.riseAt + 20_000 ? 'sealed' : 'rising' }), pixelTranslation: () => shift, heightAt: () => 0, now: () => now, feet: () => feetAt, landBefore: (gg) => { landed.push(gg.day); return true; } });
  pool.frame(0.016);
  const yaw = (await import('../src/net/gateLaw.js')).gateYaw(2000);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  feetAt = [c * ROOT_TRAP.x, 0.5, -s * ROOT_TRAP.x];
  now = T.riseAt + 20_001;
  pool.frame(0.016);
  assert.deepEqual(landed, [2000], 'set down before the gate as the stone stands');
  pool.frame(0.016);
  assert.equal(landed.length, 1, 'once, as it stands - not every frame');
  // W6: the hover asks for the fire's box every frame; it is made again only when the gate's place moves
  const box = pool.targets();
  assert.equal(box.length, 1);
  pool.frame(0.016);
  assert.equal(pool.targets(), box, 'the same box while the gate stands where it stood');
  shift = [64, 0, 0];
  pool.frame(0.016);
  const moved = pool.targets();
  assert.notEqual(moved, box, 'a new box where it stands now');
  assert.ok(Math.abs((moved[0].aabb.min[0] - box[0].aabb.min[0]) - 64) < 1e-6, 'moved with the gate');
});

test('AUDIT WBX W2/W3 the court\'s music: a song made in code plays where MIDI.BSA did not load; the fanfare\'s time is counted from its own first note - SCORE_STING_LEAD_MS after the court asked for it, the war song\'s fade and the player\'s start (mutants: the archive asked of a made song; the fanfare cut under the fade)', async () => {
  const { MUSIC_FADE_OUT_S } = await import('../src/systems/music.js');
  const { SCORE_STING_LEAD_MS } = await import('../src/systems/gateScore.js');
  assert.equal(SCORE_STING_LEAD_MS, Math.round(MUSIC_FADE_OUT_S * 1000 + 60), 'the fade out and the player\'s beat on');
  const m = read('src/systems/music.js');
  assert.match(m, /_ensurePlayer\(made = false\) \{\n[^\n]*\n\s*if \(!this\.enabled && !made\) return null;/);
  assert.match(m, /const player = this\._ensurePlayer\(this\._made\.has\(name\)\);/);
  assert.match(m, /if \(!this\.archive\) return false;/);
  assert.match(read('src/systems/gateScore.js'), /if \(law === GATE_SONGS\.fell && stingAt === null\) stingAt = now \+ SCORE_STING_LEAD_MS;/);
});
