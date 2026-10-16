// SEAT2b part two (b) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE WORKS IN BATTLE, THEIR LAW - the
// Walls' quicker wave, the Gatehouse that bars the Throne, the Rams that batter it and the blows that break them
// (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5; net/siege/siegeRef.js, its numbers pinned equal to net/fortLaw.js's); the
// pass's works (net/identityToken.js `sx`) and the wire's words for them (net/wire.js). `06-Systems/Online-Arc.md`
// SEAT2b part two (b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIEGE_GATEHOUSE, SIEGE_RAM, SIEGE_WALLS, SIEGE_WORK_IDS, SIEGE_UNITS_PER_M, SIEGE_TICK_MS, SIEGE_WAVE_MS, SIEGE_RAMS_MAX,
  worksOf, siegeGateVitality, siegeRamVitality, siegeWaveMs, siegeThroneBarred, refereeWorkBlow, siegeRamDown, siegeBreach,
  fieldOf, newBattle, newFighter, battleStep, siegeFieldFrame, siegeNextWave, siegeReturn, SIEGE_HIT,
} from '../../src/net/siege/siegeRef.js';
import { GATEHOUSE, RAM, WALLS_WAVE_STEP_MS, WALLS_WAVE_MIN_MS, gatehouseVitality, ramVitality, defendersWaveMs } from '../../src/net/fortLaw.js';
import { mintSiegeOrder, verifyOrder, siegePassValid } from '../../src/net/identityToken.js';
import { validSiegeIn, validSiegeOut } from '../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000_000;
/** A palace's field in metres: Gate, Market, Temple, the Throne, the attackers' camp, the defenders'. */
const SF = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
const CROWN_SF = [SF[0], SF[1], SF[2], [0, 0], SF[3], SF[4], SF[5]];
const fighter = (side, x, z, o = {}) => ({ side, pose: { x: x * M, y: 0, z: z * M }, down: false, here: true, ...o });
const run = (b, fs, from, to) => { const out = []; for (let t = from; t <= to; t += SIEGE_TICK_MS) out.push(...battleStep(b, fs, t)); return out; };
const SWORD = { w: 123, m: 9 };   // a Daedric Dai-Katana the look holds (its bucket 21 a material step)

test('SEAT2b part two (b) THE NUMBERS ARE THE LAW\'S: the Gatehouse\'s, the Ram\'s and the Walls\' copied into the relay\'s leaf and pinned equal to net/fortLaw.js (mutants: each number)', () => {
  assert.deepEqual([SIEGE_GATEHOUSE.vitality, SIEGE_GATEHOUSE.perTier, SIEGE_GATEHOUSE.blowShare], [GATEHOUSE.vitality, GATEHOUSE.perTier, GATEHOUSE.blowShare]);
  assert.deepEqual([SIEGE_RAM.vitality, SIEGE_RAM.damage, SIEGE_RAM.everyMs, SIEGE_RAM.crew, SIEGE_RAM.crewM, SIEGE_RAM.siegewright], [RAM.vitality, RAM.damage, RAM.everyMs, RAM.crew, RAM.crewM, RAM.siegewright]);
  assert.deepEqual([SIEGE_WALLS.stepMs, SIEGE_WALLS.minMs], [WALLS_WAVE_STEP_MS, WALLS_WAVE_MIN_MS]);
  for (const t of [0, 1, 2, 3]) assert.equal(siegeGateVitality(t), gatehouseVitality(t), `tier ${t}`);
  assert.deepEqual([siegeGateVitality(0), siegeGateVitality(1), siegeGateVitality(3)], [20000, 30000, 50000]);
  assert.deepEqual([siegeRamVitality(false), siegeRamVitality(true)], [ramVitality(false), ramVitality(true)]);
  assert.deepEqual([siegeRamVitality(0), siegeRamVitality(1)], [3000, 4500]);
  for (const tier of ['palace', 'crown']) for (const w of [0, 1, 2, 3]) {
    assert.equal(siegeWaveMs({ tier, works: { walls: w } }, 'defend'), defendersWaveMs(SIEGE_WAVE_MS[tier], w), `${tier} walls ${w}`);
    assert.equal(siegeWaveMs({ tier, works: { walls: w } }, 'attack'), SIEGE_WAVE_MS[tier], 'the attackers\' wave is the tier\'s');
  }
  assert.deepEqual([siegeWaveMs({ tier: 'palace', works: { walls: 3 } }, 'defend'), siegeWaveMs({ tier: 'crown', works: { walls: 1 } }, 'defend'), siegeWaveMs({ tier: 'palace' }, 'defend')], [11000, 27000, 20000]);
  assert.deepEqual(SIEGE_WORK_IDS, { gate: 'gh', ram: 'rm' });
});

test('SEAT2b part two (b) THE WORKS A PASS CARRIES: walls, the Gatehouse (-1 none), the Rams, a Siegewright, the Barracks - each a tier; a crown\'s Gatehouse always stands; no Ram without a gate; a Tourney\'s none; absent, none but a crown\'s own gate (mutants: each bound; the crown\'s gate; the Ram\'s gate; the Tourney)', () => {
  assert.deepEqual(worksOf([2, 1, 3, 1, 3], 'palace'), { walls: 2, gate: 1, rams: 3, siegewright: 1, barracks: 3 });
  assert.deepEqual(worksOf(undefined, 'palace'), { walls: 0, gate: -1, rams: 0, siegewright: 0, barracks: 0 });
  assert.deepEqual(worksOf(null, 'crown'), { walls: 0, gate: 0, rams: 0, siegewright: 0, barracks: 0 }, 'a crown\'s own Gatehouse');
  assert.deepEqual(worksOf(undefined, 'crown', 'tourney'), { walls: 0, gate: -1, rams: 0, siegewright: 0, barracks: 0 }, 'a Tourney fights behind nothing');
  assert.equal(worksOf([0, -1, 0, 0, 0], 'palace', 'tourney'), null, 'a Tourney carries none');
  for (const bad of [[4, 0, 0, 0, 0], [0, -2, 0, 0, 0], [0, 0, -1, 0, 0], [0, 0, SIEGE_RAMS_MAX + 1, 0, 0], [0, 0, 0, 2, 0], [0, 0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0.5, 0, 0, 0, 0], 'x', {}]) {
    assert.equal(worksOf(bad, 'palace'), null, JSON.stringify(bad));
  }
  assert.equal(worksOf([0, -1, 0, 0, 0], 'crown'), null, 'a crown without its Gatehouse');
  assert.equal(worksOf([0, -1, 2, 0, 0], 'palace'), null, 'Rams with no gate to strike');
  assert.deepEqual(worksOf([0, 0, SIEGE_RAMS_MAX, 0, 0], 'palace').rams, SIEGE_RAMS_MAX);
});

test('SEAT2b part two (b) A BATTLE BEHIND ITS WORKS: the Gatehouse whole at its tier, the first Ram fielded before it (a Siegewright\'s half again), the rest in the camp; a palace with no gate none; a Tourney none (mutants: the vitality; the Ram; the camp; the palace)', () => {
  const crown = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(CROWN_SF, 'crown'), works: worksOf([1, 2, 3, 1, 0], 'crown') });
  assert.deepEqual([crown.gate, crown.ram, crown.ramsLeft, crown.breached], [{ hp: 40000, max: 40000 }, { hp: 4500, max: 4500, charge: 0 }, 2, false]);
  const bare = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(CROWN_SF, 'crown') });
  assert.deepEqual([bare.gate, bare.ram], [{ hp: 20000, max: 20000 }, null], 'no works given: a crown\'s own gate, no Ram');
  const palace = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace'), works: worksOf([3, -1, 0, 0, 0], 'palace') });
  assert.deepEqual([palace.gate, palace.ram, palace.ramsLeft, siegeThroneBarred(palace)], [null, null, 0, false]);
  const gated = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace'), works: worksOf([3, 1, 1, 0, 0], 'palace') });
  assert.deepEqual([gated.gate, gated.ram, gated.ramsLeft, siegeThroneBarred(gated)], [{ hp: 30000, max: 30000 }, { hp: 3000, max: 3000, charge: 0 }, 0, true]);
  const tourney = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') });
  assert.deepEqual([tourney.gate ?? null, tourney.ram ?? null, siegeThroneBarred(tourney)], [null, null, false]);
});

test('SEAT2b part two (b) THE RAM AT THE GATE: two attackers within 3 m crew it - ten crewed seconds a stroke of 500; one alone, or a stroke\'s charge falling back uncrewed, none; the Gatehouse breached at nought opens the Throne to the banners (mutants: the crew; the radius; the stroke; the charge\'s fall; the breach; the bar)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace'), works: worksOf([0, 1, 2, 0, 0], 'palace') });
  b.gate.hp = 1200;
  const crew = [fighter('attack', 0, -40), fighter('attack', 2, -40)];
  assert.deepEqual(run(b, [crew[0]], T, T + 15_000), [], 'one alone: no stroke');
  assert.equal(b.ram.charge, 0);
  run(b, [...crew, fighter('attack', 3.5, -40)], T + 16_000, T + 24_000);
  assert.equal(b.gate.hp, 1200, 'nine crewed seconds: not yet');
  assert.equal(b.ram.charge, 9);
  run(b, [crew[0]], T + 25_000, T + 28_000);
  assert.equal(b.ram.charge, 5, 'uncrewed: the charge falls back a second a second');
  const ev = run(b, crew, T + 29_000, T + 33_000);
  assert.deepEqual(ev, [{ k: 'gate', hp: 700 }]);
  assert.equal(b.ram.charge, 0);
  assert.deepEqual(run(b, [fighter('attack', 0, -40), fighter('attack', 0, -43.5)], T + 35_000, T + 50_000), [], 'the second beyond 3 m');
  // the banners held, the gate standing: the Throne shut
  b.banners[0].side = 'attack'; b.banners[1].side = 'attack';
  const breach = run(b, crew, T + 51_000, T + 71_000);
  assert.deepEqual(breach.filter((e) => e.k !== 'banner'), [{ k: 'gate', hp: 200 }, { k: 'gate', hp: 0 }, { k: 'breach' }]);
  assert.equal(b.breached, true);
  assert.ok(b.throne > 0 && b.throne < 3, 'opened on the breach - the crew stands at the Throne');
  assert.equal(siegeThroneBarred(b), false);
  // a crown's Ram: the stroke is the same; a defender standing by stops nothing - the crew must be felled
  const k = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(CROWN_SF, 'crown'), works: worksOf([0, 0, 1, 0, 0], 'crown') });
  run(k, [fighter('attack', 0, -40), fighter('attack', 1, -40), fighter('defend', 0, -41)], T, T + 10_000);
  assert.equal(k.gate.hp, 19500);
  const k2 = newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(CROWN_SF, 'crown'), works: worksOf([0, 0, 1, 0, 0], 'crown') });
  run(k2, [fighter('attack', 0, -40), fighter('defend', 1, -40), fighter('attack', 0, -40, { down: true }), fighter('attack', 1, -40, { here: false })], T, T + 20_000);
  assert.equal(k2.gate.hp, 20000, 'a defender, a fallen attacker and one gone from the room crew nothing');
});

test('SEAT2b part two (b) A BLOW ON A WORK: an attacker\'s melee blow takes a tenth into the Gatehouse (at least 1), a defender\'s the whole into a Ram - the weapon\'s bucket, its reach to the work\'s edge, the field\'s ground, the striker\'s rate; never a shaft; a broken work takes nothing; a destroyed Ram\'s successor comes at the attackers\' next wave (mutants: the share; the floor; the reach; the size; the ground; the shaft; the rate; the clip; the next Ram)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace'), works: worksOf([0, 1, 2, 0, 0], 'palace') });
  const by = newFighter(10, T);
  const at = (x, z, y = 0) => ({ x: x * M, y: y * M, z: z * M });
  const gate = (o, now = T) => refereeWorkBlow(by, b.gate, { point: b.field.throne, size: SIEGE_GATEHOUSE.sizeM, from: at(0, -40 + 7.9), ground: 0, held: SWORD, d: 40, share: SIEGE_GATEHOUSE.blowShare, ...o }, now);
  assert.deepEqual(gate({}), { ok: true, dealt: 4, broke: false, why: null }, 'a tenth of 40, 7.9 m from the point (2.5 + 3 slack + 3 size within 8.5)');
  assert.equal(b.gate.hp, 30000 - 4);
  assert.equal(gate({ d: 4 }, T + 1000).dealt, 1, 'at least 1');
  assert.equal(gate({ from: at(0, -40 + 8.6) }, T + 2000).why, 'reach');
  assert.equal(gate({ size: 0, from: at(0, -40 + 6) }, T + 3000).why, 'reach', 'the edge is the work\'s size');
  assert.equal(gate({ from: at(0, -40, 9) }, T + 4000).why, 'reach', 'standing nine metres above the field');
  assert.equal(gate({ r: SIEGE_HIT.Shaft }, T + 5000).why, 'weapon', 'a shaft batters nothing');
  assert.equal(gate({ held: { w: 130, m: 0 } }, T + 6000).why, 'weapon', 'nor a bow\'s swing');
  assert.equal(gate({ held: null }, T + 7000).why, 'weapon', 'a weapon the look does not hold');
  // the clip: whatever is claimed, the weapon's bucket at most - the Gatehouse takes a tenth of that
  const before = b.gate.hp;
  const clipped = gate({ d: 1e6 }, T + 9000);
  assert.ok(clipped.ok && clipped.dealt > 0 && clipped.dealt < 100, `clipped: ${clipped.dealt}`);
  assert.equal(before - b.gate.hp, clipped.dealt);
  // the rate: four a second
  const quick = newFighter(10, T + 20_000);
  const blows = [0, 50, 100, 150, 200].map((ms) => refereeWorkBlow(quick, b.gate, { point: b.field.throne, size: 3, from: at(0, -40), ground: 0, held: SWORD, d: 10, share: 0.1 }, T + 20_000 + ms).why);
  assert.deepEqual(blows, [null, null, null, null, 'rate']);
  // the Ram: the whole, and a destroyed one's successor at the attackers' next wave
  b.ram.hp = 30;
  const ram = (now) => refereeWorkBlow(newFighter(10, now), b.ram, { point: b.field.throne, size: SIEGE_RAM.sizeM, from: at(0, -38), ground: 0, held: SWORD, d: 20, share: 1 }, now);
  assert.deepEqual(ram(T + 30_000), { ok: true, dealt: 20, broke: false, why: null });
  assert.deepEqual(ram(T + 31_000), { ok: true, dealt: 10, broke: true, why: null }, 'no more than it has');
  assert.equal(ram(T + 32_000).why, 'down', 'a broken work takes nothing');
  siegeRamDown(b, T + 32_000);
  assert.deepEqual([b.ram, b.ramsLeft, b.ramAt], [null, 1, siegeNextWave(T + 32_000, SIEGE_WAVE_MS.palace)]);
  assert.deepEqual(run(b, [], b.ramAt - 1000, b.ramAt - 1000), [], 'not before its wave');
  assert.deepEqual(run(b, [], b.ramAt, b.ramAt), [{ k: 'ram' }]);
  assert.deepEqual([b.ram, b.ramsLeft, b.ramAt], [{ hp: 3000, max: 3000, charge: 0 }, 0, null]);
  siegeRamDown(b, b.ramAt ?? T + 60_000);
  assert.equal(b.ramAt, null, 'the camp empty: none to come');
  siegeBreach(b);
  assert.deepEqual([b.gate.hp, b.breached, siegeThroneBarred(b)], [0, true, false]);
});

test('SEAT2b part two (b) THE WALLS\' WAVE AND THE FIELD\'S FRAME: a defender back from a drop waits for its quicker wave; the frame carries the Gatehouse, the Ram and the Walls where they stand (mutants: the side\'s wave; each field)', () => {
  const b = newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace'), works: worksOf([3, 1, 2, 0, 0], 'palace') });
  const d = { side: 'defend', pose: null, down: false }, a = { side: 'attack', pose: null, down: false };
  siegeReturn(b, d, T + 1000); siegeReturn(b, a, T + 1000);
  assert.deepEqual([d.upAt, a.upAt], [siegeNextWave(T + 1000, 11000), siegeNextWave(T + 1000, 20000)]);
  const f = siegeFieldFrame(b, [1, 2, 3]);
  assert.deepEqual([f.g, f.r, f.w], [[30000, 30000], [3000, 3000, 0, 1], 3]);
  b.ram = null; b.ramsLeft = 1;
  assert.deepEqual(siegeFieldFrame(b, [0, 0, 0]).r, [0, 0, 0, 1], 'a Ram to come');
  b.ramsLeft = 0;
  assert.equal('r' in siegeFieldFrame(b, [0, 0, 0]), false, 'none left');
  const bare = siegeFieldFrame(newBattle({ kind: 'siege', tier: 'palace', startMs: T, field: fieldOf(SF, 'palace') }), [0, 0, 0]);
  assert.deepEqual(['g' in bare, 'r' in bare, 'w' in bare], [false, false, false]);
});

test('SEAT2b part two (b) THE PASS AND THE WIRE: a siege\'s pass carries its works (a Tourney\'s none, a bad one refused) and a crown\'s whole field with them fits the token; a blow may name the Gatehouse or the Ram - a blow alone; the field\'s frame reads the works within their bounds (mutants: the pass\'s check; the size; the work\'s id; the frame\'s bounds)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor(T / 1000);
  const big = Array.from({ length: 7 }, () => [-1_000_000_000, -1_000_000_000]);
  const pass = await mintSiegeOrder({ s: 'acct-0123456789abcdef0123456789abcdef', sk: 0xffffffff, sw: 999_999, sd: 'attack', st: 'crown', sn: 'siege', sb: nowS + 600, se: nowS + 7800, sf: big, sx: [3, 3, SIEGE_RAMS_MAX, 1, 3] }, kp.privateKey, { subtle, nowS });
  assert.match(pass, /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9_-]{1,640}\.[A-Za-z0-9_-]{1,128}$/, `a crown's widest pass fits the hello's token (${pass.length})`);
  assert.deepEqual((await verifyOrder(pass, kp.publicKey, { subtle, nowS, kind: 'siege' })).claims.sx, [3, 3, SIEGE_RAMS_MAX, 1, 3]);
  const c = { o: 'siege', s: 'acct-x', sk: 3021, sw: 5, sd: 'attack', st: 'palace', sn: 'siege', sb: nowS, se: nowS + 7200, sf: SF, i: nowS, e: nowS + 60 };
  assert.equal(siegePassValid(c), true, 'none is none');
  assert.equal(siegePassValid({ ...c, sx: [0, 1, 1, 0, 0] }), true);
  assert.equal(siegePassValid({ ...c, sx: [0, 1, 1, 0] }), false);
  assert.equal(siegePassValid({ ...c, sn: 'tourney', sx: [0, -1, 0, 0, 0] }), false, 'a Tourney carries no works');
  assert.equal(siegePassValid({ ...c, st: 'crown', sf: CROWN_SF, sx: [0, -1, 0, 0, 0] }), false);
  await assert.rejects(mintSiegeOrder({ ...c, sx: [9, 0, 0, 0, 0] }, kp.privateKey, { subtle, nowS }));
  // the wire
  const blow = { k: 'blow', w: 123, m: 9, d: 30, r: 0 };
  assert.deepEqual(validSiegeIn({ ...blow, to: 'gh' }), { ...blow, to: 'gh' });
  assert.deepEqual(validSiegeIn({ ...blow, to: 'rm' }), { ...blow, to: 'rm' });
  assert.equal(validSiegeIn({ ...blow, to: 'gx' }), null);
  assert.equal(validSiegeIn({ k: 'cast', to: 'gh', d: 10 }), null, 'a blow\'s alone');
  assert.equal(validSiegeIn({ k: 'ask', to: 'rm' }), null);
  const f = { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: T, e: T + 1000, n: [1, 1, 0] };
  assert.deepEqual(validSiegeOut({ ...f, g: [100, 30000], r: [3000, 4500, 9, 2], w: 3 }), { ...f, g: [100, 30000], r: [3000, 4500, 9, 2], w: 3 });
  assert.deepEqual(validSiegeOut(f), f, 'none: none');
  for (const bad of [{ g: [30001, 30000] }, { g: [0, 0] }, { g: [0, 50001] }, { g: [1] }, { r: [4501, 4501, 0, 0] }, { r: [1, 1, 11, 0] }, { r: [1, 1, 0, SIEGE_RAMS_MAX + 1] }, { r: [2, 1, 0, 0] }, { w: 0 }, { w: 4 }]) {
    assert.equal(validSiegeOut({ ...f, ...bad }), null, JSON.stringify(bad));
  }
});
