// LW-TALK (2026-10-06, Mac: "I want to ensure everything is working with NPCs actually interacting with each other,
// talking" - asked how two who talk should stand, "Turn them"; bible/06-Systems/Living-World.md LW-TALK): THE TOWN'S
// PEOPLE FACE ONE ANOTHER AND TALK TOGETHER. The first cut, measured on the synthetic towns: every talker drawn on
// DFU's front-only idle record (88,358 of 88,358 standing frames), so two in a circle both faced the camera; a round
// of 40 s re-dealt a busy square three times a minute and began every circle's script on its first minute, while its
// people were still walking together (22-84% of the lines heard, by hour and town) - every spot on the same minute,
// ten lines in one frame and then half a minute of silence (73-82% of the day's seconds silent); a busy square's
// speakers talked to partners the street had not stood (58 of 77 lines); two homemakers drew their trade's one
// script half the time ("The baker's bread is getting smaller." opened a fifth of the town's talk); and a stranger who
// kept quiet never spoke when the player stopped before them. Pinned on the synthetic towns (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown, closeTown } from './lwTown.mjs';
import { LivingTown, GREET_REST_MIN, keepUnits, TALK_PULL_M } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker, STAND_FRAME } from '../src/characters/residentWalker.js';
import { PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD, MOVE_RECORDS, MOVE_FLIPS, PERSON_MOVE_SPEED, PERSON_IDLE_DISTANCE } from '../src/characters/mobilePerson.js';
import { mobileOrientation } from '../src/characters/mobileUnit.js';
import {
  spotRound, spotCircles, dealCircles, circleSlots, exchangeAt, slotSpoken, exchangeScript, circleLine, circleStands, circlesStands, aloneStand,
  lineMinutes, ROUND_S, GATHER_BEAT_S, OPEN_S, PAUSE_S, SLOT_LINES, CLOSE_S, TALK_SHARE, ALONE_FAR_M,
} from '../src/systems/livingWorld/meetups.js';
import { pickScript, MORNING_TALKS, DAY_TALKS, JOB_TALKS, TOKEN_FALLBACK } from '../src/systems/livingWorld/lines.js';
import { CREW_LINE_S } from '../src/systems/naval/crewLife.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { createLivingIndoors } from '../src/scenes/livingIndoors.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { POP_VISIBLE_RANGE } from '../src/systems/townPopulation.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const SYNTH = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
const SYNTH4 = Object.freeze({ mapId: 24680, blocks: 16, region: 17, people: 3, port: false });
const CLOSE = Object.freeze({ mapId: 777, blocks: 16, region: 17, people: 3, port: false });

function makeTown(fx, rec, minute, { relations = createRelations(), places = null } = {}) {
  const clock = { t: minute };
  const town = new LivingTown(fx.nav, {
    town: rec, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM, relations: () => relations, playerName: () => 'Mac', townName: 'Synth', regionName: 'Daggerfall',
    ...(places ? { tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null, places }) } : {}),
  });
  const sq = town.places.square;
  return { town, clock, at: [sq.x, 0, sq.z], eye: [sq.x, 1.6, sq.z] };
}
/** One frame at 30 a second, the clock with it; the player at the square looking north. */
const step = (t, viewYaw = 0) => { t.clock.t += RATE / 30; return t.town.update(1 / 30, t.at, viewYaw, t.eye, true, () => false); };
const run = (t, seconds, viewYaw = 0) => { let seats = []; for (let i = 0; i < Math.round(seconds * 30); i++) seats = step(t, viewYaw); return seats; };

test('LW-TALK the facing: a resident standing keeps the way they face - the walk wheel\'s record for their yaw against the camera (mobileOrientation), held on STAND_FRAME and flipped as the wheel is; DFU\'s idle record (the watch\'s 15) is the politeness gate\'s alone, turned to the player; walking, the wheel\'s cycle; on the street every one standing in a circle is drawn so (mutants: the idle for all, the held frame, the flip, the guard\'s post)', () => {
  const eye = [5, 1.6, -3];
  for (const yaw of [0, 1, 2, 3, -1.5, -2.8]) {
    const p = new ResidentWalker({}, { archive: 385, frameCount: () => 4, groundY: () => 0 });
    p.pos = [0, 0, 0]; p.yaw = yaw; p.moving = false;
    const o = mobileOrientation(yaw, p.pos, eye);
    for (let i = 0; i < 8; i++) {
      const out = p.update(0.25, eye, false);
      assert.deepEqual([out.record, out.frame, out.flip], [MOVE_RECORDS[o], STAND_FRAME, MOVE_FLIPS[o]], `yaw ${yaw}: the way they face, held`);
    }
    assert.equal(p.update(0.1, eye, true).record, PERSON_IDLE_RECORD, 'the gate: turned to the player');
  }
  const g = new ResidentWalker({}, { archive: 399, guard: true, frameCount: () => 4, groundY: () => 0 });
  g.pos = [0, 0, 0]; g.yaw = Math.PI;   // a post facing the road
  assert.equal(g.update(0.1, eye, false).record, MOVE_RECORDS[mobileOrientation(Math.PI, g.pos, eye)], 'the watch at his post faces the road');
  assert.equal(g.update(0.1, eye, true).record, PERSON_GUARD_IDLE_RECORD);
  const w = new ResidentWalker({}, { archive: 385, frameCount: () => 4, groundY: () => 0 });
  w.pos = [0, 0, 0]; w.yaw = 1; w.moving = true;
  const frames = new Set();
  for (let i = 0; i < 8; i++) frames.add(w.update(0.25, eye, false).frame);
  assert.ok(frames.size > 1, 'walking: the cycle');
  // on the street, those standing in a circle on the wheel, each toward the circle's middle - LW-ROOMS: PIN MOVED, at half
  // past six: a long gap at one place is spent at home now, and the late afternoon's stand-ins at the square went
  const t = makeTown(synthTown(), SYNTH, 100 * DAY_MIN + 18.5 * 60);
  const seats = run(t, 20);
  let checked = 0;
  for (const s of seats) {
    const c = t.town._inCircle.get(s.person.living.id);
    if (!c || s.person.moving) continue;
    const o = mobileOrientation(s.person.yaw, s.person.pos, t.eye);
    assert.deepEqual([s.out.record, s.out.flip], [MOVE_RECORDS[o], MOVE_FLIPS[o]], `${s.person.living.id}: toward their circle`);
    checked++;
  }
  assert.ok(checked >= 4, `circles standing (${checked})`);
});

test('LW-TALK a round is a meeting: ROUND_S two minutes, each spot\'s on a phase of its own (spotRound); those there the whole of it dealt as one deal (dealCircles - the rooms\' too); a circle\'s talk from `from`, GATHER_BEAT_S in where the host has no walk to add (mutants: the length, the phase, the beat)', () => {
  assert.equal(ROUND_S, 120);
  assert.equal(GATHER_BEAT_S, 1.5);
  const roundMin = ROUND_S * 0.2;
  const starts = new Set();
  for (const key of ['sq', 'm1004', 's1006', 'xe', 'xn', 'dock']) {
    const r = spotRound(key, 5000, roundMin);
    assert.ok(r.start <= 5000 && 5000 < r.end && Math.abs(r.end - r.start - roundMin) < 1e-9, `${key}: the round holding the minute`);
    assert.equal(spotRound(key, r.start + 1e-6, roundMin).round, r.round);
    assert.equal(spotRound(key, r.end + 1e-6, roundMin).round, r.round + 1);
    starts.add(Math.round(r.start * 1000));
  }
  assert.ok(starts.size >= 5, 'out of step, spot by spot');
  const who = (i) => ({ id: `T.${i}`, name: `N${i} S`, job: 'keeper' });
  const r = spotRound('sq', 5000, roundMin);
  const present = [0, 1, 2, 3, 4].map((i) => ({ who: who(i), t0: r.start - 1, t1: r.end + 1 }));
  present.push({ who: who(9), t0: r.start + 1, t1: r.end + 1 });   // come mid-round
  const cs = spotCircles('sq', present, 5000, roundMin);
  assert.deepEqual(cs.map((c) => c.members.length), [2, 3]);
  for (const c of cs) assert.ok(c.start === r.start && Math.abs(c.from - (r.start + GATHER_BEAT_S * 0.2)) < 1e-9);
  assert.deepEqual(dealCircles('sq', present.slice(0, 5).map((p) => p.who), r.round, r.start, r.end, GATHER_BEAT_S * 0.2), cs, 'one deal');
});

test('LW-TALK exchanges: from the gathering the first OPEN_S in, each next a slot of SLOT_LINES lines and PAUSE_S after the last, none past the round\'s end less CLOSE_S; TALK_SHARE of the slots spoken, else quiet; a dialogue - the slot\'s opener (turning slot by slot) its even lines, the others answering in turn; never the script said last; each script fixed as its exchange begins - the hour it began (never the reader\'s), the reader\'s memo the rest (mutants: the open, the pause, the close, the share, the opener\'s turn, the dialogue, the repeat, the memo, the hour)', () => {
  assert.deepEqual([[...OPEN_S], [...PAUSE_S], SLOT_LINES, CLOSE_S, TALK_SHARE], [[0, 6], [5, 15], 4, 3, 0.75]);
  const rate = 0.2, lineMin = lineMinutes(rate), perS = lineMin / CREW_LINE_S;
  const m = (i, job = 'keeper') => ({ id: `X.${i}`, name: `Nm${i} Sur`, job });
  let spoken = 0, all = 0;
  const opens = new Set(), pauses = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const c = { members: [m(1), m(2, 'smith')], seed, start: 1000, end: 1000 + ROUND_S * rate, from: 1000 + 3 * rate, index: 0 };
    const slots = circleSlots(c, lineMin);
    assert.ok(slots.length >= 3, `${seed}: exchanges in a round (${slots.length})`);
    assert.ok(slots[0] - c.from >= OPEN_S[0] * perS - 1e-9 && slots[0] - c.from <= OPEN_S[1] * perS + 1e-9, 'the first, OPEN_S in');
    opens.add(Math.round((slots[0] - c.from) / perS * 10));
    for (let k = 1; k < slots.length; k++) {
      const gap = slots[k] - slots[k - 1] - SLOT_LINES * lineMin;
      assert.ok(gap >= PAUSE_S[0] * perS - 1e-9 && gap <= PAUSE_S[1] * perS + 1e-9, 'a pause between');
      pauses.add(Math.round(gap / perS * 10));
    }
    assert.ok(slots.at(-1) + SLOT_LINES * lineMin <= c.end - CLOSE_S * perS + 1e-9, 'none the round would cut');
    assert.equal(exchangeAt(c, c.from - 1e-6, lineMin), null, 'gathering');
    for (let k = 0; k < slots.length; k++) {
      assert.deepEqual(exchangeAt(c, slots[k] + 1e-6, lineMin), { k, s: slots[k] });
      if (k) assert.equal(exchangeAt(c, slots[k] - 1e-6, lineMin), null, 'between two');
      all++;
      if (slotSpoken(c, k)) spoken++;
      else assert.equal(circleLine(c, slots[k] + 1e-6, lineMin, {}), null, 'a quiet spell');
    }
    let last = null;
    for (let k = 0; k < slots.length; k++) {
      if (!slotSpoken(c, k)) continue;
      const { script } = exchangeScript(c, k, lineMin, {}, null);
      assert.notEqual(script, last, `${seed}: never twice running`);
      last = script;
    }
  }
  assert.ok(Math.abs(spoken / all - TALK_SHARE) < 0.05, `spoken ${spoken} of ${all}`);
  assert.ok(opens.size > 40 && pauses.size > 80, `each circle's own open (${opens.size}) and pauses (${pauses.size}) - never one beat for all`);
  // a dialogue: a pair A-B-A-B, a trio A-B-A-C, the opener turning
  for (const n of [2, 3]) {
    const members = [m(1), m(2), m(3)].slice(0, n);
    const want = n === 2 ? [0, 1, 0, 1] : [0, 1, 0, 2];
    for (let seed = 1; seed <= 40; seed++) {
      const c = { members, seed, start: 0, end: ROUND_S * rate, from: 0, index: 0 };
      const slots = circleSlots(c, lineMin);
      for (let k = 0; k < slots.length; k++) {
        if (!slotSpoken(c, k)) continue;
        const { script } = exchangeScript(c, k, lineMin, {}, null);
        script.forEach((_, i) => assert.equal(circleLine(c, slots[k] + i * lineMin + 1e-6, lineMin, {}).who, members[(k + want[i]) % n], `${n}: slot ${k}, line ${i}`));
        assert.equal(circleLine(c, slots[k] + script.length * lineMin + 1e-6, lineMin, {}), null, 'quiet after its last line');
      }
    }
  }
  // fixed as it begins: the weather turning mid-exchange keeps the script the memo took; without one, it would swap
  let swapped = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const c = { members: [m(1), m(2)], seed, start: 0, end: ROUND_S * rate, from: 0, index: 0 };
    const k = circleSlots(c, lineMin).findIndex((_, i) => slotSpoken(c, i));
    if (k < 0) continue;
    const s = circleSlots(c, lineMin)[k];
    const memo = new Map();
    const a = circleLine(c, s + 1e-6, lineMin, { weather: null }, memo);
    const dry = exchangeScript(c, k, lineMin, { weather: null }, null).script, wet = exchangeScript(c, k, lineMin, { weather: 'rain' }, null).script;
    if (dry === wet) continue;
    swapped++;
    const b = circleLine(c, s + lineMin + 1e-6, lineMin, { weather: 'rain' }, memo);
    assert.equal(b?.text ?? null, dry.length > 1 ? circleLine(c, s + lineMin + 1e-6, lineMin, { weather: null }, null).text : null, 'the second line of the script begun dry');
    assert.ok(a);
  }
  assert.ok(swapped > 20, `the weather would have swapped ${swapped}`);
  // the hour it began, never the reader's: an exchange begun before eleven keeps the morning's pools
  let morning = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const c = { members: [m(1), m(2)], seed, start: 100 * DAY_MIN + 10 * 60 + 50, end: 100 * DAY_MIN + 10 * 60 + 50 + ROUND_S * rate, from: 100 * DAY_MIN + 10 * 60 + 58, index: 0 };
    const slots = circleSlots(c, lineMin);
    for (let k = 0; k < slots.length; k++) {
      const got = exchangeScript(c, k, lineMin, { hour: 23 }, null).script;
      assert.equal(got, exchangeScript(c, k, lineMin, { hour: 4 }, null).script, 'the reader\'s hour unread');
      const h = Math.floor(((slots[k] % DAY_MIN) + DAY_MIN) % DAY_MIN / 60);
      if (MORNING_TALKS.includes(got)) { morning++; assert.ok(h >= 5 && h < 11, 'a morning\'s script begun in the morning'); }
    }
  }
  assert.ok(morning > 20, `mornings (${morning})`);
});

test('LW-TALK on the street: a circle\'s talk waits for its people to gather - from where the last round stood them to their place in this one at the walking pace and GATHER_BEAT_S (`from`) - and is said aloud only while every one of them stands at their place on this street; the street keeps a circle whole - nearest first and nothing else, by this beat\'s deal; partners kept the whole round (mutants: the gather, the aloud, the whole, the keep\'s order, the deal before the read)', () => {
  for (const [fx, rec, hour] of [[synthTown(), SYNTH, 18], [closeTown(), CLOSE, 13]]) {
    const t = makeTown(fx, rec, 100 * DAY_MIN + hour * 60);
    run(t, 2);
    let heard = 0;
    /** @type {Map<string, string>} each one's partners this round */
    const partners = new Map();
    for (let i = 0; i < 30 * 100; i++) {
      step(t);
      const rows = new Map(t.town.pool.filter((r) => r.visible && r.res).map((r) => [r.res.id, r]));
      for (const l of t.town.speech(t.eye, 500)) {
        const c = t.town._inCircle.get(l.person.living.id);
        if (!c) continue;
        heard++;
        assert.ok(t.town._now >= c.circle.from, 'after its people gathered');
        for (const mm of c.circle.members) {
          const r = rows.get(mm.id);
          assert.ok(r && !r.person.moving, `${mm.id}: stood at their place with them`);
        }
      }
      if (i % 30) continue;
      for (const [id, c] of t.town._inCircle) {
        const key = `${c.circle.start}|${c.circle.members.map((x) => x.id).join(',')}`;
        const was = partners.get(id);
        if (was && was.split('|')[0] === String(c.circle.start)) assert.equal(key, was, `${id}: the same company all the round`);
        partners.set(id, key);
      }
    }
    assert.ok(heard > 40, `${rec.mapId}: heard ${heard}`);
  }
  // the gather, on its own: `from` is the round's start, the farthest walk from where the last round stood them, the beat
  const t = makeTown(closeTown(), CLOSE, 100 * DAY_MIN + 13 * 60);
  run(t, 1);
  const roundMin = ROUND_S * RATE;
  let gathered = 0;
  for (const [, c] of t.town._inCircle) {
    const spot = c.spot;
    const list = [];
    for (const res of t.town.peopleOf(t.town.dayOf(t.town._now))) for (const e of t.town.planOf(res, t.town.dayOf(t.town._now))) if (e.kind !== 'walk' && isOutdoor(e) && e.at === spot && e.t0 <= t.town._now) list.push({ who: res, t0: e.t0, t1: e.t1 });
    const now = spotCircles(spot.key, list, t.town._now, roundMin).find((x) => x.seed === c.circle.seed);
    const was = new Map();
    // LW-SPACE: PIN MOVED - a round's circles at a spot are laid together (meetups.js circlesStands), none on another
    const before = spotCircles(spot.key, list, now.start - 1e-6, roundMin);
    circlesStands(spot, before, t.town._street).forEach((ps, ci) => ps.forEach((st, i) => was.set(before[ci].members[i].id, st)));
    const all = spotCircles(spot.key, list, t.town._now, roundMin);
    const places = circlesStands(spot, all, t.town._street)[all.findIndex((x) => x.seed === now.seed)];
    const far = Math.max(...now.members.map((mm, i) => { const a = was.get(mm.id) ?? aloneStand(spot, mm.id, t.town._street); return Math.hypot(places[i].x - a.x, places[i].z - a.z); }));
    assert.ok(Math.abs(c.circle.from - (now.start + (far / PERSON_MOVE_SPEED + GATHER_BEAT_S) * RATE)) < 1e-9, 'gathered at the walking pace');
    gathered++;
  }
  assert.ok(gathered >= 4);
  // DFU's hiding (`_hidden` - the one home the street's coming on, its going and its keep read): out of sight beyond
  // POP_VISIBLE_RANGE whichever way the player faces, or behind them however near
  const R = POP_VISIBLE_RANGE;
  assert.deepEqual([[0, R + 1], [R, 2], [0, R - 1], [-3, 0.5], [0, -2], [-R - 1, -1]].map(([x, z]) => t.town._hidden(x, z, 0)), [true, true, false, false, true, true]);
  assert.deepEqual([[R - 1, 0], [-2, 0]].map(([x, z]) => t.town._hidden(x, z, Math.PI / 2)), [false, true], 'turned east');
  // the keep (keepUnits): a circle's people together, a unit as near as its nearest one - a circle TALK_PULL_M nearer, the
  // ring the ones alone at a spot stand in, beyond which its circles stand - nearest first while the whole of it fits: a
  // unit that does not fit waits, and a smaller one farther on still comes; ties by id. Nothing else orders it: put
  // first, those already on the street held every row from the nearer (a walk passing beside the player never came on,
  // nor a watchman back from his guard) and those in the player's sight let one go who stood just behind him
  {
    assert.equal(TALK_PULL_M, ALONE_FAR_M);
    const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
    const ring = { k: 'ring' }, pair = { k: 'pair' };
    const circleOf = (id) => ({ b: ring, c: ring, d: ring, e: pair, f: pair })[id];
    const W = [{ res: a, d: 5 }, { res: b, d: 9 }, { res: c, d: 2 }, { res: d, d: 30 }, { res: e, d: 4 }, { res: f, d: 40 }];
    const kept = (w, cap) => [...keepUnits(w, circleOf, cap)].map((r) => r.id).sort().join('');
    assert.deepEqual([10, 5, 4, 3, 2, 1].map((cap) => kept(W, cap)), ['abcdef', 'bcdef', 'abcd', 'bcd', 'ef', 'a']);
    assert.equal(kept([...W].reverse(), 3), 'bcd', 'whatever the order they are read in');
    const [x, y] = [{ id: 'x' }, { id: 'y' }];
    assert.deepEqual([[{ res: y, d: 3 }, { res: x, d: 3 }], [{ res: x, d: 3 }, { res: y, d: 3 }]].map((w) => [...keepUnits(w, () => undefined, 1)].map((r) => r.id)), [['x'], ['x']], 'a tie by id');
    const [g, h, i] = [{ id: 'g' }, { id: 'h' }, { id: 'i' }];
    const two = { k: 'two' }, of2 = (id) => (id === 'h' || id === 'i' ? two : undefined);
    assert.deepEqual([4.5, 6].map((at) => [...keepUnits([{ res: g, d: 2 }, { res: h, d: at }, { res: i, d: at + 1 }], of2, 2)].map((r) => r.id).sort().join('')), ['hi', 'g'],
      'a circle within the ring of one alone before them; beyond it, after');
    assert.match(rd('src/systems/livingWorld/livingTown.js'), /const keep = keepUnits\(wanted, \(id\) => this\._inCircle\.get\(id\)\?\.circle, this\.maxPopulation\);/, 'the census keeps by it');
  }
  // stepped past them (no arrival), out of the player's sight: their rows to the nearer
  {
    const s = makeTown(closeTown(), CLOSE, 100 * DAY_MIN + 19.5 * 60);   // LW-SPREAD: PIN MOVED - the evening goes out from six to a quarter past seven now
    s.town.maxPopulation = 8;
    run(s, 0.5);
    const was = new Set(s.town.pool.filter((r) => r.visible && r.res).map((r) => r.res.id));
    s.at = [s.at[0] + 18, 0, s.at[2] + 18]; s.eye = [s.at[0], 1.6, s.at[2]];
    for (let i = 0; i < 12; i++) step(s);
    const fresh = s.town.pool.filter((r) => r.active && r.res && !was.has(r.res.id)).length;
    // LW-ERRANDS: PIN MOVED - two and more (four before: more of the evening indoors now, at the guilds and the shops;
    // the street held first, none)
    assert.ok(fresh >= 2, `out of sight, their rows to the nearer (${fresh})`);
  }
  // the deal before the read: the census reads where each one stands by this beat's circles - read before them, an
  // arrival stood the street by the last scene's (none: each one about their own stand) and let 12 of the 24 it stood
  // go a beat later, dealt into circles farther off
  {
    // LW-SPREAD: PIN MOVED - the evening at half past seven (out from six to a quarter past seven now), and every walk of
    // its next second searched before the way in: the evening's walks out, searched a slice a frame (LW-PERF), came
    // nearer a beat later and let the farthest circles go - the searching's, not the deal's
    const s = makeTown(synthTown(), SYNTH, 100 * DAY_MIN + 19.5 * 60);
    for (const r of s.town.peopleOf(s.town.dayOf(s.clock.t))) {
      for (const ahead of [0, 0.2, 0.4]) {
        for (let k = 0; k < 400 && s.town.where(r, s.clock.t + ahead, true)?.pending; k++) { s.town._paths.cells(1e9); s.town._paths.budget(1e9); s.town._paths.run(); }
      }
    }
    step(s);
    const first = s.town.pool.filter((r) => r.active && r.res).map((r) => r.res.id);
    for (let i = 0; i < 9; i++) step(s);
    const let_go = first.filter((id) => !s.town.pool.some((r) => r.active && r.res?.id === id && !r.scheduleRecycle));
    assert.ok(first.length >= 20, `the street stood on arrival (${first.length})`);
    assert.deepEqual(let_go, [], 'none of them let go a beat later');
  }
  // whole: stood at once on arrival under a tight cap - every one of a circle on the street has the whole circle there
  for (const cap of [5, 9, 14]) {
    const a = makeTown(closeTown(), CLOSE, 100 * DAY_MIN + 18 * 60);
    a.town.maxPopulation = cap;
    run(a, 0.5);
    const on = new Set(a.town.pool.filter((r) => r.visible && r.res).map((r) => r.res.id));
    assert.ok(on.size > 0 && on.size <= cap);
    for (const id of on) { const c = a.town._inCircle.get(id); if (c) for (const mm of c.circle.members) assert.ok(on.has(mm.id), `cap ${cap}: ${mm.id} stood with ${id}`); }
  }
});

test('LW-TALK every reader deals alike: the deal is the plans\' - one taken off this street alone (the trample) is dealt and left out after, the spot\'s other circles as every reader has them, their partner left to their own counsel; two readers come at different minutes keep the same circles, gatherings and words (mutants: the deal from the street, the drop)', () => {
  // LW-SPREAD: PIN MOVED - the morning's market (from half past seven to half past ten): the evening's people are over the
  // town's spots now; LW-ROOMS: PIN MOVED - in the town of sixteen blocks: a long gap at one place spent at home, the
  // small town has no pair in the square's sight at a spot of three circles, at any ten minutes from seven to nine
  const a = makeTown(synthTown({ blocksW: 4, blocksH: 4 }), SYNTH4, 100 * DAY_MIN + 10 * 60);
  run(a, 30);
  const b = makeTown(synthTown({ blocksW: 4, blocksH: 4 }), SYNTH4, a.clock.t);
  for (let i = 0; i < 30 * 20; i++) { step(a); b.clock.t = a.clock.t; b.town.update(1 / 30, b.at, Math.PI, b.eye, true, () => false); }
  const view = (t) => [...t.town._inCircle.entries()].map(([id, c]) => `${id}:${c.circle.members.map((x) => x.id).join(',')}@${c.circle.from.toFixed(6)}`).sort();
  assert.deepEqual(view(b), view(a), 'the same circles and gatherings for every reader');
  const lineMin = lineMinutes(RATE);
  const words = (t) => [...new Set([...t.town._inCircle.values()].map((c) => c.circle))].map((c) => circleLine(c, t.town._now, lineMin, t.town.lineCtx(t.town._now))?.text ?? '').sort();
  assert.deepEqual(words(b), words(a), 'and the same words');
  // the trample on one reader alone
  const circles = [...new Set([...a.town._inCircle.values()].map((c) => c.circle))];
  const pair = circles.find((c) => c.members.length === 2 && a.town.pool.some((r) => r.visible && r.res?.id === c.members[0].id)
    && circles.filter((x) => a.town._inCircle.get(x.members[0].id).spot === a.town._inCircle.get(c.members[0].id).spot).length >= 3);
  assert.ok(pair, 'a pair on the street, at a spot of three circles and more');
  const gone = a.town.pool.find((r) => r.res?.id === pair.members[0].id);
  a.town.retire(gone.person);
  run(a, 1);
  b.clock.t = a.clock.t; b.town.update(1 / 30, b.at, Math.PI, b.eye, true, () => false);
  const left = pair.members[1].id;
  assert.equal(a.town._inCircle.has(pair.members[0].id), false, 'the taken: in no circle');
  if (b.town._inCircle.get(left)?.circle.members.some((x) => x.id === pair.members[0].id)) assert.equal(a.town._inCircle.has(left), false, 'their partner alone here');
  const others = (t) => view(t).filter((v) => !v.includes(pair.members[0].id) && !v.startsWith(`${left}:`));
  assert.deepEqual(others(a), others(b), 'every other circle as every reader has it');
});

test('LW-TALK the word to the player: one who kept quiet as the player came by speaks when the player stops before them - the rest no bar to that - and a word said rests GREET_REST_MIN; in a room a stop is the player standing still within the street\'s idle distance (mutants: the rest taken by the quiet pass, the stop indoors)', () => {
  const t = makeTown(synthTown(), SYNTH, 100 * DAY_MIN + 10 * 60);
  const seats = run(t, 3);
  const free = seats.map((s) => s.person).find((p) => !t.town._inCircle.has(p.living.id));
  assert.ok(free, 'one alone on the street');
  const res = free.living.res;
  let quietAt = null;
  for (let m = 0; m < 400 && quietAt == null; m++) {
    t.town._now = t.clock.t + m;
    t.town._greeted.clear();
    t.town._greetings.length = 0;
    t.town._greet(res, free, 3, false);
    if (!t.town._greetings.length) quietAt = t.town._now;
  }
  assert.ok(quietAt != null, 'a stranger keeps quiet now and then');
  t.town._now = quietAt + 1;
  t.town._greet(res, free, 2, true);
  assert.equal(t.town._greetings.length, 1, 'stopped before them: they speak');
  t.town._greetings.length = 0;
  t.town._now = quietAt + 2;
  t.town._greet(res, free, 2, true);
  assert.equal(t.town._greetings.length, 0, 'once in the rest');
  t.town._now = quietAt + 1 + GREET_REST_MIN;
  t.town._greet(res, free, 2, true);
  assert.equal(t.town._greetings.length, 1, 'and after it');
  // a room: walking in past them, quiet; standing still before them, a word
  const asked = [];
  const synced = [];
  const st = { clock: 100 * DAY_MIN + 1200 };
  const layer = createLivingIndoors({
    sprites: { sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res } }, pos: x.feet })), batches: () => [], clear() { synced.length = 0; } },
    building: () => ({ key: 7000, town: { insideAt: () => [{ res: { id: 'R.1', name: 'Ro Lane', job: 'labourer', cls: null }, e: { kind: 'tavern', t0: 0, t1: 1e12 } }], dayOf: (x) => Math.floor((x - 240) / DAY_MIN), talkBeat: () => null, lineCtx: () => ({}), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: (r, x, stopped) => { asked.push(stopped); return stopped ? 'Well met.' : null; }, o: { relations: () => createRelations() } } }),
    collider: () => ({ move(q, dx, dy, dz) { q[0] += dx; q[1] += dy; q[2] += dz; } }), floorAt: () => 0, origin: () => null, staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const at = layer.stood()[0].at;
  const near = [at[0] + PERSON_IDLE_DISTANCE - 0.3, 0, at[2]];
  layer.frame(0.016, [near[0] - 0.5, 0, near[2]], 0, near);   // coming by
  layer.frame(0.016, near, 0, near);                           // still moving this frame
  assert.deepEqual(asked, [false], 'passing: asked once, quiet');
  layer.frame(0.016, near, 0, near);                           // standing still before them
  assert.deepEqual(asked, [false, true], 'stopped: asked again');
  assert.deepEqual(layer.speech(near).map((l) => l.text), ['Well met.']);
});

test('LW-TALK the words: {place} a town of the town\'s road (its trips\' towns, the exchange\'s draw), never the fallback where it has one; the morning\'s and the day\'s talk at their hours and in the street alone; a trade\'s pool once however many share it; the commonest trades six scripts; over a day of two towns no opener a twentieth of the talk, and no circle the same script twice running; the host hands the towns of the road (mutants: the place, the hours, the room, the trade once, the pools)', () => {
  const m = (i, job) => ({ id: `W.${i}`, name: `Wn${i} Sur`, job });
  const rate = RATE, lineMin = lineMinutes(rate);
  let filled = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const c = { members: [m(1, 'merchant'), m(2, 'keeper')], seed, start: 0, end: ROUND_S * rate, from: 0, index: 0 };
    for (const [k, s] of circleSlots(c, lineMin).entries()) {
      if (!slotSpoken(c, k)) continue;
      const { script } = exchangeScript(c, k, lineMin, {}, null);
      const i = script.findIndex((l) => l.includes('{place}'));
      if (i < 0) continue;
      const line = circleLine(c, s + i * lineMin + 1e-6, lineMin, { places: ['Anticlere', 'Dunlain Falls'] });
      if (!line) continue;
      assert.ok(!line.text.includes(TOKEN_FALLBACK.place) && /Anticlere|Dunlain Falls/.test(line.text), line.text);
      filled++;
    }
  }
  assert.ok(filled > 20, `{place} filled (${filled})`);
  const t = makeTown(synthTown(), SYNTH, 100 * DAY_MIN + 10 * 60, { places: ['Anticlere'] });
  run(t, 0.2);
  assert.deepEqual(t.town.lineCtx(t.town._now).places, ['Anticlere'], 'the town\'s road read');
  for (let seed = 1; seed <= 3000; seed++) {
    for (const hour of [4, 7, 12, 16, 20, 23]) {
      const s = pickScript(seed, { hour });
      if (MORNING_TALKS.includes(s)) assert.ok(hour >= 5 && hour < 11, `morning at ${hour}`);
      if (DAY_TALKS.includes(s)) assert.ok(hour >= 8 && hour < 18, `day at ${hour}`);
      const r = pickScript(seed, { hour, room: 'tavern' });
      assert.ok(!MORNING_TALKS.includes(r) && !DAY_TALKS.includes(r), 'the street\'s alone');
    }
    assert.equal(pickScript(seed, { jobs: ['homemaker', 'homemaker'], hour: 20 }), pickScript(seed, { jobs: ['homemaker'], hour: 20 }), 'a trade once');
  }
  assert.ok(JOB_TALKS.homemaker.length >= 6 && JOB_TALKS.labourer.length >= 6);
  // a day of two towns: every exchange of every circle at every spot
  for (const [fx, rec] of [[synthTown(), SYNTH], [closeTown(), CLOSE]]) {
    const town = makeTown(fx, rec, 100 * DAY_MIN + 240).town;
    const day = 100, D0 = day * DAY_MIN + 240, roundMin = ROUND_S * rate;
    const bySpot = new Map();
    for (const res of town.peopleOf(day)) for (const e of town.planOf(res, day)) {
      if (e.kind === 'walk' || !isOutdoor(e)) continue;
      const l = bySpot.get(e.at.key) ?? [];
      l.push({ who: res, t0: e.t0, t1: e.t1 });
      bySpot.set(e.at.key, l);
    }
    const counts = new Map();
    let total = 0;
    for (const [key, list] of bySpot) {
      for (let at = D0; at < D0 + DAY_MIN; at += roundMin) {
        for (const c of spotCircles(key, list, at, roundMin)) {
          let last = null;
          for (const [k] of circleSlots(c, lineMin).entries()) {
            if (!slotSpoken(c, k)) continue;
            const { script } = exchangeScript(c, k, lineMin, {}, null);
            assert.notEqual(script, last, 'never twice running');
            last = script;
            counts.set(script[0], (counts.get(script[0]) ?? 0) + 1);
            total++;
          }
        }
      }
    }
    const top = Math.max(...counts.values());
    assert.ok(total > 500 && top / total < 0.05, `${rec.mapId}: the commonest opener ${(100 * top / total).toFixed(1)}% of ${total}`);
  }
  assert.match(rd('src/scenes/world.js'), /const places = \[\.\.\.new Set\(\[\.\.\.trips, \.\.\.told\]\.map\(\(tr\) => tr\.to\?\.name\)\.filter\(Boolean\)\)\]\.sort\(\);\n    return \{ away, visitors, holders, news, places \};/);
});

test('LW-TALK the hosts: the street\'s town deals, gathers, keeps circles whole and says aloud (livingTown.js); the rooms deal a table\'s company from its sitting and keep it put through its first round and its exchanges (scenes/livingIndoors.js); the road\'s parties talk in exchanges from their round\'s start (scenes/livingRoads.js); the bodies stand on the wheel (characters/residentWalker.js, world/travellerSprites.js) (mutants: each seam)', () => {
  const lt = rd('src/systems/livingWorld/livingTown.js');
  assert.match(lt, /const from = dealt\.start \+ \(far \/ PERSON_MOVE_SPEED \+ GATHER_BEAT_S\) \* this\._baseRate\(\);/);
  assert.match(lt, /c\.circle\.members\.every\(\(m\) => standing\.has\(m\.id\)\)/);
  assert.match(lt, /circleLine\(c\.circle, this\._now, lineMin, ctx, this\._scripts\)/);
  const li = rd('src/scenes/livingIndoors.js');
  assert.match(li, /dealCircles\(`in:\$\{b\.key\}:\$\{ti\}:\$\{co\.since\}`, at\.map\(\(m\) => m\.res\), round, start, start \+ beat\.roundMin, GATHER_BEAT_S \* beat\.roundMin \/ ROUND_S\)/);
  assert.match(li, /const on = t - co\.since < beat\.roundMin \|\| exchangeAt\(c, t, beat\.lineMin\) != null;/);
  assert.match(li, /circleLine\(c, t, beat\.lineMin, ctx, scripts\)/);
  const lr = rd('src/scenes/livingRoads.js');
  assert.match(lr, /const circle = \{ members, seed, start: round \* roundMin, end: \(round \+ 1\) \* roundMin, index: 0 \};/);
  assert.doesNotMatch(lr, /TALK_SHARE/);
  assert.match(rd('src/world/travellerSprites.js'), /out = w\.update\(dt, eye && eye\.length === 3 \? eye : f, false\);/);
  // the road's parties: a circle with no `from` talks from its round's start
  const c = { members: [{ id: 'a', name: 'A B', job: 'merchant' }, { id: 'b', name: 'C D', job: 'mercenary' }], seed: 5, start: 0, end: ROUND_S * RATE * 1.25, index: 0 };
  assert.ok(circleSlots(c, lineMinutes(RATE))[0] >= 0 && circleSlots(c, lineMinutes(RATE)).length >= 4);
});
