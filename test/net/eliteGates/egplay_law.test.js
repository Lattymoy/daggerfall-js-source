// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 6, 7, 8 and 9): THE ELITE
// BREACH'S LAW (net/eliteGates/egLaw.js) - one seed and one circle give one level on every machine (the relay judges the floors
// the client stands, so the spec is integers off the port's seeded die and an integer sine table - never a float trig
// call); every hall's fight inside the gate's wire bound; the first circle fixed, deeper ones drawn; the clock's phases,
// THE COUNT and a Redoubt's fifteen minutes; a Rampart's vents told before they erupt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egCircleOf, egCircleSpecs, egSpecDigest, egPhase, egTimes, egAdmits, egCountNew, egCountLeft, egCountRun, egCountHold, egCountRedoubt, egCountText,
  egCircleOfHall, egSlotOfHall, egIsCourt, egFirstHallOf, egVentAt, egOnArrive, egAtDoor, egRoomKey, isEgRoom, egBreachOfRoom, lawSin, lawCos,
  EG_HALL_LEN_MAX, EG_HALL_PITCH, EG_SEALED_MS, EG_ADMIT_MAX_MS, EG_RISE_MS, EG_LAST_WORD_MS, EG_COUNT_START_MS, EG_REDOUBT_HOLD_MS, EG_COUNT_CAP_MS, EG_VENT_WARN_MS, EG_VENT_FIRE_MS } from '../../../src/net/eliteGates/egLaw.js';
import { GATE_COURT_BOUND } from '../../../src/net/wire.js';

const T0 = 1_800_000_000_000;

test('EG-PLAY ONE SEED, ONE LEVEL: a hall\'s spec is the same object asked twice and the same bytes laid fresh, frozen; the generator calls no float trigonometry, no clock and no Math.random - its sines are the integer table, exact at the quarter turns (mutants: a float sine in the law; the spec mutable)', () => {
  const a = egHallOf(0x1234, 7), b = egHallOf(0x1234, 7);
  assert.equal(a, b, 'cached');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.discs) && Object.isFrozen(a.steps));
  const d = egSpecDigest(a);
  for (let h = 1; h <= 40; h++) egHallOf(99, h);   // the cache rolls over
  assert.equal(egSpecDigest(egHallOf(0x1234, 7)), d, 'the same bytes laid again');
  assert.notEqual(egSpecDigest(egHallOf(0x1235, 7)), d, 'another seed, another hall');
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLaw.js', import.meta.url), 'utf8');
  const gen = src.slice(src.indexOf('// ── the law\'s trigonometry'), src.indexOf('/** A circle\'s five specs'));
  assert.ok(gen.length > 2000, 'the generator found');
  for (const bad of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Math.sqrt', 'Math.hypot', 'Math.pow', 'Math.exp', 'Math.log', 'Date.now', 'performance.now']) assert.ok(!gen.includes(bad), `the generator calls ${bad}`);
  assert.deepEqual([lawSin(0), lawSin(90), lawSin(180), lawSin(270), lawCos(0), lawSin(30), lawSin(-30), lawSin(405)], [0, 10000, 0, -10000, 10000, 5000, -5000, 7071]);
  assert.throws(() => lawSin(7), /multiple of 5/);
});

test('EG-PLAY THE HALLS IN THE WIRE\'S BOUNDS: every hall of the first twelve circles over many seeds runs no longer than EG_HALL_LEN_MAX, under the gate\'s GATE_COURT_BOUND, and every point its fight frames name (the foe, the rifts, the gate and its Ward-Bearers, the ring, the vents) lies inside it; each hall has its arrival plate, every hall but a Court its far plate (mutants: the bound lifted; a Court with a door)', () => {
  assert.ok(EG_HALL_LEN_MAX < GATE_COURT_BOUND);
  let n = 0, longest = 0;
  for (const seed of [1, 2, 0xdead, 0xbeef, 0x7fffffff, 0xffffffff, 12345]) {
    for (let c = 1; c <= 12; c++) {
      for (const s of egCircleSpecs(seed, c)) {
        n++;
        longest = Math.max(longest, s.len);
        assert.ok(s.len <= EG_HALL_LEN_MAX, `hall ${s.h} of seed ${seed} runs ${s.len} m`);
        assert.ok(s.arrive && egOnArrive(s, s.arrive.x, s.arrive.z), 'its arrival plate');
        if (egIsCourt(s.h)) assert.equal(s.end, null, 'a Court has no door - its fall is the Redoubt');
        else assert.ok(s.end && egAtDoor(s, s.end.x, s.end.z), 'its far plate and door');
        const pts = [s.foe, s.ring, s.gate, ...(s.gate?.bearers ?? []), ...s.rifts, ...s.vents, s.fight].filter(Boolean);
        for (const p of pts) assert.ok(Math.abs(p.x) <= GATE_COURT_BOUND && Math.abs(p.z) <= GATE_COURT_BOUND, `a fight point out of bounds in hall ${s.h}`);
        assert.equal(s.x0, (egSlotOfHall(s.h) - 1) * EG_HALL_PITCH);
      }
    }
  }
  assert.equal(n, 7 * 12 * 5);
  assert.ok(longest > 60, 'the halls are long enough to cross');
});

test('EG-PLAY THE CIRCLE\'S RHYTHM (EG-FULL, section 7): the first circle is fixed - the Rift-Yard, the Span, the Proving Walk, the Siege-Walk, the Court; deeper, slot 1 is the Yard or the Rampart (a Brink at circles 6, 11 and 16) and slot 4 the Yard or the Rampart, slot 2 the traverse (the Span, or from circle 3 the Deepway), slot 3 the mixed (the Proving Walk, the Athenaeum, or a Scriptorium twist), the Court always fifth; halls count circles by five; the breach\'s room key (mutants: the first circle drawn; a Brink anywhere else; the Court moved)', () => {
  assert.deepEqual([...egCircleOf(5, 1)], ['yard', 'span', 'proving', 'rampart', 'court']);
  const seen = new Set(), deep = new Set(), mixed = new Set();
  for (const seed of [77, 5, 0xbeef]) {
    for (let c = 2; c < 40; c++) {
      const k = egCircleOf(seed, c);
      assert.equal(k[4], 'court', 'the Court is fifth');
      if (c === 6 || c === 11 || c === 16) assert.equal(k[0], 'brink', `circle ${c} opens on a Brink`);
      else assert.ok(['yard', 'rampart'].includes(k[0]), `slot 1 of circle ${c}: ${k[0]}`);
      assert.ok(['yard', 'rampart'].includes(k[3]), `slot 4 of circle ${c}: ${k[3]}`);
      assert.ok(c >= 3 ? ['span', 'deepway'].includes(k[1]) : k[1] === 'span', `slot 2 of circle ${c}: ${k[1]}`);
      assert.ok(['proving', 'athenaeum', 'scriptorium'].includes(k[2]), `slot 3 of circle ${c}: ${k[2]}`);
      seen.add(k[0]); deep.add(k[1]); mixed.add(k[2]);
    }
  }
  assert.ok(seen.has('yard') && seen.has('rampart') && seen.has('brink'), 'every opening drawn');
  assert.ok(deep.has('deepway') && mixed.has('athenaeum'), 'the Deepway and the Athenaeum drawn');
  assert.deepEqual([egCircleOfHall(1), egCircleOfHall(5), egCircleOfHall(6), egSlotOfHall(6), egSlotOfHall(10), egFirstHallOf(3)], [1, 1, 2, 1, 5, 11]);
  assert.equal(egRoomKey('0123456789abcdef'), 'eg:0123456789abcdef');
  assert.equal(isEgRoom('eg:0123456789abcdef'), true);
  assert.equal(isEgRoom('eg:0123456789ABCDEF'), false);
  assert.equal(egBreachOfRoom('eg:0123456789abcdef'), '0123456789abcdef');
});

test('EG-PLAY THE CLOCK AND THE COUNT: rising for twenty seconds, sealed to five minutes, open five more, then deep or ended; THE COUNT thirty minutes, running and held, a Redoubt\'s fifteen more never past thirty in hand nor the last word (mutants: the door open while sealed; the Redoubt uncapped)', () => {
  const rec = { openedAt: T0 };
  assert.equal(egPhase(rec, T0 + EG_RISE_MS - 1), 'rising');
  assert.equal(egPhase(rec, T0 + EG_SEALED_MS - 1), 'sealed');
  assert.equal(egPhase(rec, T0 + EG_SEALED_MS), 'open');
  assert.equal(egAdmits(rec, T0 + EG_SEALED_MS + EG_ADMIT_MAX_MS - 1), true);
  assert.equal(egPhase(rec, T0 + EG_SEALED_MS + EG_ADMIT_MAX_MS), 'ended');
  assert.equal(egPhase({ ...rec, wokeAt: T0 + EG_SEALED_MS + 10 }, T0 + EG_SEALED_MS + 20), 'deep');
  assert.equal(egPhase({ ...rec, wokeAt: 1, endAt: T0 + 100, why: 'tear' }, T0 + 200), 'torn');
  assert.equal(egPhase({ ...rec, wokeAt: 1 }, T0 + EG_LAST_WORD_MS), 'ended');
  assert.equal(egTimes(rec).admitUntil, T0 + EG_SEALED_MS + EG_ADMIT_MAX_MS);
  let c = egCountNew();
  assert.equal(egCountLeft(c, T0), EG_COUNT_START_MS);
  c = egCountRun(c, T0);
  assert.equal(egCountLeft(c, T0 + 60_000), EG_COUNT_START_MS - 60_000);
  c = egCountHold(c, T0 + 60_000);
  assert.equal(egCountLeft(c, T0 + 999_999), EG_COUNT_START_MS - 60_000, 'held');
  const r = egCountRedoubt({ left: 20 * 60_000, at: 0 }, T0, 10 * EG_LAST_WORD_MS);
  assert.equal(r.left, EG_COUNT_CAP_MS, 'twenty and fifteen is thirty in hand at most');
  assert.equal(egCountRedoubt({ left: 5 * 60_000, at: 0 }, T0, 10 * EG_LAST_WORD_MS).left, 5 * 60_000 + EG_REDOUBT_HOLD_MS);
  assert.equal(egCountRedoubt({ left: 5 * 60_000, at: 0 }, T0, 7 * 60_000).left, 7 * 60_000, 'never past the last word');
  assert.deepEqual([egCountText(0), egCountText(61_000), egCountText(30 * 60_000), egCountText(999)], ['0:00', '1:01', '30:00', '0:01']);
});

test('EG-PLAY A RAMPART\'S VENTS: each lane quiet, then told EG_VENT_WARN_MS before it erupts EG_VENT_FIRE_MS, on its own cycle and phase from the hall\'s wake - the same instants on every screen (mutants: the eruption untold; the phase ignored)', () => {
  const v = { x: 0, z: 30, d: 4, halfW: 3.5, cycle: 5000, phase: 1200 };
  const woke = T0, states = [];
  for (let t = 0; t < 10_000; t += 100) states.push(egVentAt(v, woke, woke + t).st);
  const fires = states.map((s, i) => (s === 'fire' && states[i - 1] !== 'fire' ? i : -1)).filter((i) => i >= 0);
  assert.equal(fires.length, 2, 'once a cycle');
  for (const i of fires) assert.ok(states.slice(i - EG_VENT_WARN_MS / 100, i).every((s) => s === 'warn'), 'told before it erupts');
  assert.equal(states.filter((s) => s === 'fire').length, 2 * (EG_VENT_FIRE_MS / 100));
  const shifted = egVentAt({ ...v, phase: 0 }, woke, woke + fires[0] * 100).st;
  assert.notEqual(shifted, 'fire', 'its phase moves it');
});
