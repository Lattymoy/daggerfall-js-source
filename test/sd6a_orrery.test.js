// SD6a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY OF ENDINGS'
// LAW (net/sdBrain.js) - six Ending-stones, each an hour of twelve; a turn turns one stone one hour and its partners
// with it (the gearing, hidden); the true hours said in riddles on six plaques; the dial lighting how many stand true;
// the fray snapping the Hour back at 48 turns. Everything drawn from the slot, the same on the relay and every page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SD_ORRERY, SD_STONES, SD_HOURS, SD_STONE_RING_R, SD_STONE_BEARINGS, SD_STONE_POS, SD_STONE_REACH, SD_STONE_REACH_SLACK,
  SD_FRAY_MAX, SD_FRAY_LASH, SD_STONE_SETTLE_MS, SD_TURN_HZ, SD_TRUTH_TURNS_MIN, SD_TRUTH_TURNS_MAX, SD_WALK,
  sdHour, sdHourShown, sdTurnsFor, sdRiddleText, sdRiddleHolds, orreryOf, orreryTurn, orreryLit, orreryConcord,
  orrerySolve, orreryShortest, orreryFresh, orreryStep, stoneInReach, inOrreryHall,
} from '../src/net/sdBrain.js';

const SLOTS = Array.from({ length: 500 }, (_, i) => 1 + i * 7919);
/** Turn stone i `t` hours the short way round (forward or back), one turn at a time. */
const turnBy = (o, st, i, t) => { let s = st; const n = sdTurnsFor(t), a = sdHour(t) <= 6 ? 1 : -1; for (let k = 0; k < n; k++) s = orreryTurn(o, s, i, a); return s; };

test('SD6a the stones: the Bay\'s six endings, each with its sign, on a ring in the hall - none on the walk in or the way on, each its own reach (mutants: a stone on the walk)', () => {
  assert.deepEqual(SD_STONES.map((s) => s.name), ['Daggerfall', 'Sentinel', 'Wayrest', 'Orsinium', 'the Underking', 'the Blades']);
  assert.deepEqual(SD_STONES.map((s) => s.sign), ['the lion', 'the sun', 'the ship', 'the tusk', 'the crown of bone', 'the dragon']);
  assert.equal(SD_HOURS, 12);
  assert.equal(SD_STONE_POS.length, 6);
  for (const [i, p] of SD_STONE_POS.entries()) {
    assert.ok(Math.abs(Math.hypot(p.x - SD_ORRERY.x, p.z - SD_ORRERY.z) - SD_STONE_RING_R) < 1e-9, 'on the ring');
    assert.ok(SD_STONE_RING_R + SD_STONE_REACH < SD_ORRERY.r, 'its reach inside the hall');
    const toWalk = Math.abs(Math.atan2(Math.sin(SD_STONE_BEARINGS[i] - Math.PI), Math.cos(SD_STONE_BEARINGS[i] - Math.PI)));
    const toWayOn = Math.abs(Math.atan2(Math.sin(SD_STONE_BEARINGS[i]), Math.cos(SD_STONE_BEARINGS[i])));
    assert.ok(toWalk > 0.4 && toWayOn > 0.4, `${SD_STONES[i].name} clear of the walk in and the way on`);
    assert.ok(Math.abs(p.x - SD_WALK.x) > SD_WALK.halfW + 2, 'off the walk\'s line');
    for (const [j, q] of SD_STONE_POS.entries()) if (j !== i) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 2 * (SD_STONE_REACH + SD_STONE_REACH_SLACK), 'no place reaches two stones');
  }
});

test('SD6a the hours: twelve, shown 1 to 12 (none is the twelfth); a stone moved t hours the short way round (mutants: twelve shown as nothing)', () => {
  assert.equal(sdHour(-1), 11); assert.equal(sdHour(25), 1); assert.equal(sdHour(12), 0);
  assert.equal(sdHourShown(0), 12); assert.equal(sdHourShown(3), 3); assert.equal(sdHourShown(-1), 11);
  assert.deepEqual([0, 1, 5, 6, 7, 11].map(sdTurnsFor), [0, 1, 5, 6, 5, 1]);
});

test('SD6a THE GEARING: each stone turns itself one hour and one or two stones before it in a hidden order, by one or two hours either way - so the first turns alone, the last no other turn moves, and every set of hours is reachable (mutants: a stone turning itself two; a partner after it; a partner by nothing)', () => {
  for (const s of SLOTS) {
    const o = orreryOf(s);
    assert.deepEqual([...o.order].sort(), [0, 1, 2, 3, 4, 5], 'an order of the six');
    for (let i = 0; i < 6; i++) assert.equal(o.gear[i][i], 1, 'a stone turns itself one hour');
    for (let p = 0; p < 6; p++) {
      const i = o.order[p];
      const partners = [...o.gear[i].keys()].filter((j) => j !== i && o.gear[i][j] !== 0);
      for (const j of partners) {
        assert.ok(o.order.indexOf(j) < p, 'only stones before it');
        assert.ok([-2, -1, 1, 2].includes(o.gear[i][j]), 'by one or two, either way');
      }
      if (p === 0) assert.equal(partners.length, 0, 'the first turns alone');
      else assert.ok(partners.length >= 1 && partners.length <= 2, 'one or two partners');
    }
    const last = o.order[5];
    for (let i = 0; i < 6; i++) if (i !== last) assert.equal(o.gear[i][last], 0, 'the last no other turn moves');
    // every set of hours reachable: the solve's turns, made, reach any target from any hours
    const target = [0, 1, 2, 3, 4, 5].map((j) => sdHour(s * 31 + j * 5));
    const from = [0, 1, 2, 3, 4, 5].map((j) => sdHour(s * 17 + j * 7));
    const t = orrerySolve({ ...o, truth: target }, from);
    let st = from;
    for (let i = 0; i < 6; i++) st = turnBy(o, st, i, t[i]);
    assert.deepEqual(st, target);
  }
});

test('SD6a THE RIDDLES fix the truth, one way: two stones plainly, four tied to one known before them - every clue true of the truth, the clues a forest rooted in the two plain ones (mutants: a false opposite; a false mirror; an offset of six)', () => {
  for (const s of SLOTS) {
    const o = orreryOf(s);
    assert.equal(o.riddles.length, 6);
    assert.equal(o.riddles.filter((c) => c.kind === 'plain').length, 2, 'two plainly');
    for (const c of o.riddles) {
      assert.ok(sdRiddleHolds(c, o.truth), `${c.text} holds of the truth`);
      assert.ok(['plain', 'offset', 'opposite', 'mirror'].includes(c.kind));
      if (c.kind === 'offset') assert.ok(Number.isInteger(c.k) && Math.abs(c.k) <= 5, 'an offset of six is said as opposite');
      assert.ok(!/undefined|NaN/.test(c.text), c.text);
    }
    // the shape that makes them one solution: every relation a bijection of the hours, and the relations a forest each
    // of whose trees holds exactly one plain clue - so every stone is fixed, and fixed once
    const root = [0, 1, 2, 3, 4, 5];
    const find = (x) => (root[x] === x ? x : (root[x] = find(root[x])));
    for (const c of o.riddles) if (c.kind !== 'plain') { const a = find(c.a), b = find(c.b); assert.notEqual(a, b, 'no clue closes a loop'); root[a] = b; }
    const plainRoots = o.riddles.filter((c) => c.kind === 'plain').map((c) => find(c.a));
    assert.equal(new Set(plainRoots).size, 2, 'the plain ones in different trees');
    for (let j = 0; j < 6; j++) assert.ok(plainRoots.includes(find(j)), 'every stone tied to a plain one');
  }
});

test('SD6a THE RIDDLES by brute force: of all 12^6 sets of hours, the truth alone answers every plaque', () => {
  for (const s of [1, 2, 3, 4242, 999_999_999]) {
    const o = orreryOf(s);
    const clues = [...o.riddles].sort((a, b) => (a.kind === 'plain' ? -1 : 0) - (b.kind === 'plain' ? -1 : 0));
    const h = [0, 0, 0, 0, 0, 0];
    let found = 0, which = null;
    for (h[0] = 0; h[0] < 12; h[0]++) for (h[1] = 0; h[1] < 12; h[1]++) for (h[2] = 0; h[2] < 12; h[2]++)
      for (h[3] = 0; h[3] < 12; h[3]++) for (h[4] = 0; h[4] < 12; h[4]++) for (h[5] = 0; h[5] < 12; h[5]++)
        if (clues.every((c) => sdRiddleHolds(c, h))) { found++; which = [...h]; }
    assert.equal(found, 1, `slot ${s}: one solution`);
    assert.deepEqual(which, [...o.truth]);
  }
});

test('SD6a the riddles\' words - the design\'s own four forms (mutants: more and fewer swapped)', () => {
  assert.equal(sdRiddleText({ kind: 'plain', a: 0, h: 3 }), 'Daggerfall keeps the third hour.');
  assert.equal(sdRiddleText({ kind: 'plain', a: 4, h: 0 }), 'The Underking keeps the twelfth hour.');
  assert.equal(sdRiddleText({ kind: 'offset', a: 2, b: 1, k: 2 }), 'Wayrest keeps the hour Sentinel keeps, and two more.');
  assert.equal(sdRiddleText({ kind: 'offset', a: 5, b: 3, k: -4 }), 'The Blades keeps the hour Orsinium keeps, and four fewer.');
  assert.equal(sdRiddleText({ kind: 'offset', a: 1, b: 5, k: 0 }), 'Sentinel keeps the hour the Blades keeps.');
  assert.equal(sdRiddleText({ kind: 'opposite', a: 4, b: 3 }), 'The Underking stands opposite Orsinium.');
  assert.equal(sdRiddleText({ kind: 'mirror', a: 5, b: 0 }), 'Read the Blades from twelve backwards and you read Daggerfall.');
  assert.ok(sdRiddleHolds({ kind: 'mirror', a: 5, b: 0 }, [3, 0, 0, 0, 0, 9]) && !sdRiddleHolds({ kind: 'mirror', a: 5, b: 0 }, [3, 0, 0, 0, 0, 3]));
  assert.ok(sdRiddleHolds({ kind: 'opposite', a: 4, b: 3 }, [0, 0, 0, 10, 4, 0]) && !sdRiddleHolds({ kind: 'opposite', a: 4, b: 3 }, [0, 0, 0, 10, 5, 0]));
  assert.ok(sdRiddleHolds({ kind: 'offset', a: 2, b: 1, k: 2 }, [0, 11, 1, 0, 0, 0]));
});

test('SD6a THE START: a way from it to the truth of 12 to 24 turns at its shortest - the drawn way, made, reaches the truth (mutants: a start a few turns from the truth)', () => {
  assert.equal(SD_TRUTH_TURNS_MIN, 12); assert.equal(SD_TRUTH_TURNS_MAX, 24);
  for (const s of SLOTS) {
    const o = orreryOf(s);
    const n = orreryShortest(o, o.start);
    assert.ok(n >= SD_TRUTH_TURNS_MIN && n <= SD_TRUTH_TURNS_MAX, `slot ${s}: ${n} turns`);
    assert.deepEqual(orrerySolve(o, o.start), [...o.way]);
    let st = [...o.start];
    for (let i = 0; i < 6; i++) st = turnBy(o, st, i, o.way[i]);
    assert.ok(orreryConcord(o, st), 'the way reaches the Concord');
    assert.ok(!orreryConcord(o, o.start));
  }
});

test('SD6a A HALL THAT LEARNS: turning each stone once shows the gearing; setting first the stone no other turn moves, then the next, reaches the Concord inside the fray in every Hollow - and turning at random never does (mutants: the fray shortened)', () => {
  for (const s of SLOTS) {
    const o = orreryOf(s);
    let state = orreryFresh(o), turns = 0;
    const step = (i, a) => { const r = orreryStep(o, state, i, a); assert.ok(r && !r.x, 'never snaps'); state = r; turns++; };
    // learn: one turn of each stone forward, watching every stone
    const seen = [];
    for (let i = 0; i < 6; i++) { const before = state.st; step(i, 1); seen[i] = state.st.map((h, j) => sdHour(h - before[j])); }
    // the order, as the hall reads it: repeatedly, the stone no remaining stone's turn moves
    const left = [0, 1, 2, 3, 4, 5], order = [];
    while (left.length) { const j = left.find((c) => left.every((i) => i === c || seen[i][c] === 0)); order.unshift(j); left.splice(left.indexOf(j), 1); }
    // then each stone set in turn to its true hour (the plaques' one answer - the brute force above), the first set the
    // one no turn moves: a stone once set is never moved again
    for (let p = 5; p >= 0 && !state.ok; p--) {
      const j = order[p], t = sdHour(o.truth[j] - state.st[j]);
      for (let k = 0; k < sdTurnsFor(t) && !state.ok; k++) step(j, t <= 6 ? 1 : -1);
    }
    assert.ok(state.ok, `slot ${s}: the Concord`);
    assert.ok(turns < SD_FRAY_MAX, `slot ${s}: ${turns} turns, under the fray`);
  }
  // at random: a thousand halls turning at random to the fray, and none comes to the Concord
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  for (let trial = 0; trial < 1000; trial++) {
    const o = orreryOf(SLOTS[trial % 50]);
    let state = orreryFresh(o), snapped = false;
    for (let k = 0; k < SD_FRAY_MAX && !snapped; k++) { state = orreryStep(o, state, Math.floor(rnd() * 6), rnd() < 0.5 ? 1 : -1); assert.ok(!state.ok); snapped = state.x; }
    assert.ok(snapped, 'the fray snaps it back');
  }
});

test('SD6a ONE TURN JUDGED: the turned stone one hour, its partners by their gears, the fray one more, the dial how many stand true; at 48 the Hour snaps back and lashes the hall - unless that turn made the Concord, which is kept (mutants: the snap on the Concord; the Concord not kept; a back turn turned forward)', () => {
  assert.equal(SD_FRAY_MAX, 48); assert.equal(SD_FRAY_LASH, 0.25); assert.equal(SD_STONE_SETTLE_MS, 700); assert.equal(SD_TURN_HZ, 3);
  const o = orreryOf(1);
  const i = o.order[3];
  const fwd = orreryTurn(o, o.start, i, 1), back = orreryTurn(o, o.start, i, -1);
  for (let j = 0; j < 6; j++) {
    assert.equal(fwd[j], sdHour(o.start[j] + o.gear[i][j]));
    assert.equal(back[j], sdHour(o.start[j] - o.gear[i][j]));
  }
  assert.equal(sdHour(fwd[i] - o.start[i]), 1);
  assert.equal(orreryLit(o, o.truth), 6);
  assert.equal(orreryLit(o, o.truth.map((h, j) => (j < 2 ? sdHour(h + 1) : h))), 4, 'how many, not which');
  const fresh = orreryFresh(o);
  assert.deepEqual(fresh, { st: [...o.start], f: 0, ok: false });
  const one = orreryStep(o, fresh, i, 1);
  assert.deepEqual(one, { st: fwd, f: 1, ok: false, x: false, lit: orreryLit(o, fwd) });
  // the 48th turn, not the Concord: snapped back, the fray to nothing, the hall lashed
  const snap = orreryStep(o, { st: [...o.start], f: SD_FRAY_MAX - 1, ok: false }, i, 1);
  assert.deepEqual(snap, { st: [...o.start], f: 0, ok: false, x: true, lit: orreryLit(o, o.start) });
  // the 48th turn that makes the Concord: kept
  const nearly = orreryTurn(o, o.truth, i, -1);
  const won = orreryStep(o, { st: nearly, f: SD_FRAY_MAX - 1, ok: false }, i, 1);
  assert.deepEqual(won, { st: [...o.truth], f: SD_FRAY_MAX, ok: true, x: false, lit: 6 });
  assert.equal(orreryStep(o, won, i, 1), null, 'the Concord is kept');
});

test('SD6a the reach and the hall: a stone turned from within 3 m of it (the relay a metre more for a pose\'s lag), the lash on whoever stands in the hall (mutants: the reach widened; the hall\'s edge moved)', () => {
  const p = SD_STONE_POS[2];
  assert.ok(stoneInReach(2, p.x + 2.9, p.z));
  assert.ok(!stoneInReach(2, p.x + 3.1, p.z));
  assert.ok(stoneInReach(2, p.x, p.z - 3.9, SD_STONE_REACH_SLACK) && !stoneInReach(2, p.x, p.z - 4.1, SD_STONE_REACH_SLACK));
  assert.ok(!stoneInReach(2, NaN, p.z) && !stoneInReach(2, p.x, Infinity));
  assert.ok(inOrreryHall(SD_ORRERY.x + 17.9, SD_ORRERY.z) && !inOrreryHall(SD_ORRERY.x, SD_ORRERY.z + 18.1));
  assert.ok(!inOrreryHall(undefined, 3));
});

test('SD6a drawn from the slot alone - the same draw after the cache has turned over, another slot another answer; and THE GOLDEN DRAW: a change here changes every Hollow\'s answer on the relay as on the page, so it moves the relay\'s version with it', () => {
  const first = JSON.stringify(orreryOf(1));
  for (let s = 2; s < 200; s++) orreryOf(s);
  assert.equal(JSON.stringify(orreryOf(1)), first);
  assert.notDeepEqual(orreryOf(1).truth, orreryOf(2).truth);
  assert.equal(orreryOf(0), null); assert.equal(orreryOf(-3), null); assert.equal(orreryOf(1.5), null);
  const o = orreryOf(1);
  assert.deepEqual(o.order, [4, 1, 5, 2, 0, 3]);
  assert.deepEqual(o.start, [0, 9, 9, 6, 11, 1]);
  assert.deepEqual(o.truth, [11, 10, 4, 9, 5, 7]);
  assert.deepEqual(o.riddles.map((c) => c.text), [
    'The Blades keeps the hour Daggerfall keeps, and four fewer.',
    'Daggerfall keeps the hour Orsinium keeps, and two more.',
    'Wayrest stands opposite Sentinel.',
    'Orsinium keeps the ninth hour.',
    'Sentinel keeps the tenth hour.',
    'The Underking keeps the hour Sentinel keeps, and five fewer.',
  ]);
});
