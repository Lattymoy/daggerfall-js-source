// LW-ANTICS and WATCH-LIFE (2026-10-28, bible/06-Systems/Living-World.md "LW-ANTICS", "WATCH-LIFE"; the owner: "Living
// world NPCs should partake in more activities, more shenanigans", "Guards should have a more Living world presence and
// NPC interaction"). THE STREET'S NEWER KINDS: the watch's word with one of the town at its stop (a bite at a stall, a
// beggar moved along), a purse lifted at a crowded spot and the watch's chase, two at dice or a warmer word of an
// evening, a priest's sermon at their temple's door, a courier crying the news; and a city's watch walking more
// patrols. Every one dealt from the plans as LW-STIR's are, every reader alike. The town is the synthetic one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from '../../lwTown.mjs';
import { LivingTown, FLEE_SPEED } from '../../../src/systems/livingWorld/livingTown.js';
import { travellerRoster, watchShiftSize, watchExtraOf, townWatchCount, WATCH_COMPANIES } from '../../../src/systems/livingWorld/census.js';
import { watchDuty, patrolBeat, DAY_MIN, DAY_START_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { spotRound, lineMinutes, ROUND_S } from '../../../src/systems/livingWorld/meetups.js';
import {
  spotIncidents, stirLine, smallVoice, cutpurseRun, lightFingered, ANTIC_KINDS, WATCH_WORD_SHARE, CUTPURSE_HANDS,
  CUTPURSE_SHARE, CUTPURSE_CROWD, DICE_SHARE, FLIRT_SHARE, SERMON_SHARE, CHASE_M, CAUGHT_M, STIR_GATHER_S, STIR_AFTER_S, CRY_SHARE,
} from '../../../src/systems/livingWorld/stir.js';
import {
  watchWords, watchBuys, moveAlong, cutpurseScripts, chaseLines, gotAwayLines, diceScripts, sermonScripts, flirtScripts, newsCries,
} from '../../../src/systems/livingWorld/lines.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { lwSeed, textSeed } from '../../../src/systems/livingWorld/seed.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE;
const DAY = 100, D0 = DAY * DAY_MIN + DAY_START_MIN;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const MAP = 24680;
const LINE = lineMinutes(RATE), ROUND = ROUND_S * RATE;
const who = (id, o = {}) => ({ id, name: 'Tam Ashby', job: 'crafter', town: MAP, drink: 0.2, ...o });
const stay = (w, kind, t0, t1, o = {}) => ({ who: w, kind, t0, t1, duty: false, pair: null, ...o });
const deal = (key, stays, spot = null, o = undefined) => spotIncidents(key, stays, DAY, MAP, LINE, RATE, spot, o);
const isScript = (pool, lines) => pool.some((s) => s.length <= lines.length && s.every((l, i) => l === lines[i]));
const tailOf = (pool, lines) => pool.some((s) => s.length <= lines.length && s.every((l, i) => l === lines[lines.length - s.length + i]));
const wholeRound = (inc) => spotRound(inc.spot, inc.t0, ROUND).round === inc.round && spotRound(inc.spot, inc.end - 1e-9, ROUND).round === inc.round;
/** The first id of `n` tries that a test of `ok` takes. */
const idWhere = (ok, prefix, n = 4000) => { for (let i = 0; i < n; i++) { const id = `${prefix}${i}`; if (ok(id)) return id; } return null; };
function townOf(built = synthTown(), blocks = 45) {
  return new LivingTown(built.nav, {
    town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: (archive, guard) => new ResidentWalker(built.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => H(12), rate: () => RATE, mpm: MPM, tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }),
  });
}
const tickAt = (lt, t) => { lt._now = t; lt._tick([0, 0, 0], 0); };

test('LW-ANTICS the shares, the kinds and the light-fingered: CUTPURSE_HANDS of the town\'s beggars and labourers, their own draw the same every day, never another trade nor the watch (mutants: each share, the hands, the trades)', () => {
  assert.deepEqual([WATCH_WORD_SHARE, CUTPURSE_HANDS, CUTPURSE_SHARE, CUTPURSE_CROWD, DICE_SHARE, FLIRT_SHARE, SERMON_SHARE, CHASE_M, CAUGHT_M], [0.45, 0.15, 0.35, 4, 0.05, 0.02, 0.8, 12, 1]);
  assert.deepEqual([...ANTIC_KINDS], ['watchword', 'cutpurse', 'dice', 'sermon', 'flirt']);
  let light = 0;
  for (let i = 0; i < 4000; i++) { const w = who(`L1.${i}`, { job: i % 2 ? 'beggar' : 'labourer' }); if (lightFingered(w)) light++; assert.equal(lightFingered(w), lightFingered({ ...w })); }
  assert.ok(Math.abs(light / 4000 - CUTPURSE_HANDS) < 0.02, `${light} of 4000`);
  for (let i = 0; i < 400; i++) for (const job of ['crafter', 'homemaker', 'merchant', 'priest']) assert.equal(lightFingered(who(`L1.${i}`, { job })), false);
  assert.equal(lightFingered(who(idWhere((id) => lightFingered(who(id, { job: 'labourer' })), 'L1.'), { job: 'labourer', guard: true })), false, 'never the watch');
});

test('WATCH-LIFE the watch\'s word: of its rounds\' stops where one of the town stands, WATCH_WORD_SHARE has a word with them - a bite bought at a stall (watchBuys, the keeper keeping their stall), a beggar moved along (moveAlong, at their pitch), else its talk (watchWords); the first of a pair alone, none with a stranger, none where it stopped a stranger (mutants: the share, the pair, the stall, the beggar, the stranger)', () => {
  let words = 0, n = 0;
  const kinds = { buy: 0, move: 0, talk: 0 };
  for (let i = 0; i < 600; i++) {
    const g = who(`L${MAP}.w${i}`, { job: 'guard', guard: true });
    const kind = ['social', 'stall', 'beg'][i % 3];
    const y = who(`L${MAP}.${i}`, { job: kind === 'beg' ? 'beggar' : 'crafter' });
    const got = deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(y, kind, H(9.9), H(11))]).filter((x) => x.kind === 'watchword');
    n++;
    if (!got.length) continue;
    words++;
    const w = got[0];
    assert.ok(wholeRound(w) && w.members[0].id === g.id && w.members[1].id === y.id);
    const pool = kind === 'stall' ? watchBuys() : kind === 'beg' ? moveAlong() : watchWords();
    assert.ok(isScript(pool, w.script), `${kind}: its own words`);
    if (kind !== 'social') { assert.equal(w.anchor, 1, `${kind}: they keep their place`); kinds[kind === 'stall' ? 'buy' : 'move']++; } else kinds.talk++;
  }
  assert.ok(Math.abs(words / n - WATCH_WORD_SHARE) < 0.08, `${words} of ${n}`);
  assert.ok(kinds.buy > 20 && kinds.move > 20 && kinds.talk > 20, JSON.stringify(kinds));
  // the second of a pair stands by; a stranger is no word of this kind; a stop that stopped a stranger has no other
  for (let i = 0; i < 200; i++) {
    const g = who(`L${MAP}.w${i}`, { job: 'guard', guard: true }), y = who(`L${MAP}.${i}`);
    assert.equal(deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 1 }), stay(y, 'social', H(9.9), H(11))]).filter((x) => x.kind === 'watchword').length, 0, 'the second of a pair: none');
    assert.equal(deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(who(`L77.t${i}`, { town: 77 }), 'social', H(9.9), H(11))]).filter((x) => x.kind === 'watchword').length, 0, 'a stranger: none');
  }
});

test('LW-ANTICS a cutpurse: one light of finger, by day, at a spot of CUTPURSE_CROWD or more, lifts a purse from one standing there in CUTPURSE_SHARE of their stays - near the end of the cutpurse\'s stay, the one robbed keeping their stand; the watch standing by steps in (chaseLines) else the robbed shout after them (gotAwayLines); never by night, nor under the crowd, nor one honest (mutants: the hands, the crowd, the hours, the share, the end, the chase, the getaway)', () => {
  const thief = (i) => who(idWhere((id) => lightFingered(who(id, { job: 'labourer' })), `L${MAP}.${i}x`), { job: 'labourer' });
  const crowd = (i, t0, t1, n) => Array.from({ length: n }, (_, k) => stay(who(`L${MAP}.c${i}.${k}`), 'social', t0 - 5, t1 + 5));
  let lifted = 0, tries = 0, watched = 0, gone = 0, drawn = 0, drawnLifted = 0;
  for (let i = 0; i < 160; i++) {
    const x = thief(i), mark = who(`L${MAP}.m${i}`);
    // the cutpurse's own draw (stir.js: 'antc', then 'cutp')
    const share = (lwSeed(lwSeed(textSeed(`m${i}`), DAY, textSeed(x.id), Math.round(H(11)), 0x616e7463), 0x63757470) % 100000) / 100000 < CUTPURSE_SHARE;
    const stays = [stay(x, 'social', H(11), H(12)), stay(mark, 'social', H(10.8), H(12.2)), ...crowd(i, H(10.8), H(12.2), 3)];   // no stall: a haggle keeps its round
    const withWatch = i % 2 === 0;
    if (withWatch) stays.push(stay(who(`L${MAP}.w${i}`, { job: 'guard', guard: true }), 'watch', H(10.8), H(12.2), { duty: true, pair: 0 }));
    const got = deal(`m${i}`, stays).filter((y) => y.kind === 'cutpurse');
    tries++;
    if (share) drawn++;
    if (!got.length) continue;
    assert.ok(share, 'a lift only where its own draw said');
    lifted++;
    if (!withWatch) drawnLifted++;
    const c = got[0];
    assert.equal(c.members[0].id, x.id, 'the cutpurse');
    assert.equal(c.anchor, 1, 'the one robbed keeps their stand');
    assert.ok(isScript(cutpurseScripts(), c.script), 'the lift and the shout');
    assert.ok(c.end > H(12) - (STIR_GATHER_S * RATE + 7 * LINE + STIR_AFTER_S * RATE) - ROUND && c.end <= H(12) + 1e-6, `near the end of the stay (${((c.end - H(11)) / LINE).toFixed(1)} lines in)`);
    if (c.guard) { watched++; assert.ok(tailOf(chaseLines(), c.script), 'the watch gives chase'); } else { gone++; assert.ok(tailOf(gotAwayLines(), c.script), 'got away'); }
    if (withWatch) assert.ok(c.guard || !c.guard, 'a watch standing through it may step in');
  }
  // the draw CUTPURSE_SHARE of the stays; with no watch there most of them land (a quarrel keeps its round), with one the
  // watch's own word may take the time first
  assert.ok(Math.abs(drawn / tries - CUTPURSE_SHARE) < 0.08 && drawnLifted >= 0.5 * drawn / 2 && watched > 3 && gone > 5, `${drawn} drawn, ${lifted} of ${tries} lifted, ${watched} chased, ${gone} got away`);
  // never by night, nor under the crowd, nor one honest
  for (let i = 0; i < 120; i++) {
    const x = thief(i), mark = who(`L${MAP}.m${i}`);
    assert.equal(deal(`n${i}`, [stay(x, 'social', H(20), H(21)), stay(mark, 'social', H(19.8), H(21.2)), ...crowd(i, H(19.8), H(21.2), 3)]).filter((y) => y.kind === 'cutpurse').length, 0, 'by night: none');
    assert.equal(deal(`m${i}`, [stay(x, 'stall', H(11), H(12)), stay(mark, 'social', H(10.8), H(12.2)), ...crowd(i, H(10.8), H(12.2), 1)]).filter((y) => y.kind === 'cutpurse').length, 0, 'under the crowd: none');
    assert.equal(deal(`m${i}`, [stay(who(`L${MAP}.h${i}`, { job: 'homemaker' }), 'social', H(11), H(12)), stay(mark, 'social', H(10.8), H(12.2)), ...crowd(i, H(10.8), H(12.2), 3)]).filter((y) => y.kind === 'cutpurse').length, 0, 'honest: none');
  }
});

test('LW-ANTICS of an evening, two of the town at dice (DICE_SHARE, the watch off duty too) or a warmer word (FLIRT_SHARE, never the watch); a priest at their own temple\'s door with one there preaches (SERMON_SHARE, at another\'s door none); never by day, never a stranger (mutants: the evening, the dice, the flirt, the watch, the door)', () => {
  let dice = 0, flirt = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const a = who(`L${MAP}.${i}`), b = who(`L${MAP}.b${i}`, { job: i % 7 ? 'labourer' : 'guard', guard: i % 7 === 0 });
    const got = deal(`e${i}`, [stay(a, 'social', H(19), H(20)), stay(b, 'social', H(19), H(20))], null, undefined);
    n++;
    for (const x of got) {
      if (x.kind === 'dice') { dice++; assert.ok(isScript(diceScripts(), x.script)); }
      if (x.kind === 'flirt') { flirt++; assert.ok(isScript(flirtScripts(), x.script)); assert.ok(!x.members.some((m) => m.guard), 'never the watch'); }
    }
    assert.equal(deal(`e${i}`, [stay(a, 'social', H(11), H(12)), stay(b, 'social', H(11), H(12))]).filter((x) => x.kind === 'dice' || x.kind === 'flirt').length, 0, 'by day: none');
    assert.equal(deal(`e${i}`, [stay(a, 'social', H(19), H(20)), stay(who(`L77.t${i}`, { town: 77 }), 'social', H(19), H(20))]).filter((x) => x.kind === 'dice' || x.kind === 'flirt').length, 0, 'a stranger: none');
  }
  // two at one spot each draw: about twice the share between them
  assert.ok(Math.abs(dice / n - 2 * DICE_SHARE) < 0.03 && flirt > 30, `${dice} at dice, ${flirt} flirting, of ${n}`);
  let sermons = 0;
  for (let i = 0; i < 400; i++) {
    const priest = who(`L${MAP}.p${i}`, { job: 'priest', work: 1001 }), y = who(`L${MAP}.${i}`);
    const at = deal(`t${i}`, [stay(priest, 'social', H(8), H(8.75)), stay(y, 'social', H(7.9), H(9))], { building: 1001 }).filter((x) => x.kind === 'sermon');
    if (at.length) { sermons++; assert.ok(isScript(sermonScripts(), at[0].script) && at[0].members[0].id === priest.id && at[0].anchor === 0); }
    assert.equal(deal(`t${i}`, [stay(priest, 'social', H(8), H(8.75)), stay(y, 'social', H(7.9), H(9))], { building: 1003 }).filter((x) => x.kind === 'sermon').length, 0, 'another\'s door: none');
  }
  assert.ok(Math.abs(sermons / 400 - SERMON_SHARE) < 0.08, `${sermons} sermons of 400`);
});

test('LW-ANTICS the first five keep their rounds: on the synthetic town\'s days every incident of the first five kinds stands as it would with the newer kinds dealt or not, and a newer one only in a round none of them took, its people in no other at once (mutants: the antics first, the overlap)', () => {
  const lt = townOf();
  let checked = 0, newer = 0;
  for (const day of [100, 101, 102]) {
    lt._now = day * DAY_MIN + 720;
    lt._tick([0, 0, 0], 0);
    const stays = new Map();
    for (const res of lt.peopleOf(day)) for (const e of lt.planOf(res, day)) {
      if (e.kind === 'walk' || !e.at?.key || !['market', 'social', 'stall', 'beg', 'dock', 'watch', 'post', 'gate'].includes(e.kind)) continue;
      const l = stays.get(e.at.key) ?? []; l.push({ who: res, kind: e.kind, t0: e.t0, t1: e.t1, duty: !!e.duty, pair: e.pair ?? null }); stays.set(e.at.key, l);
    }
    for (const [key, list] of stays) {
      const all = spotIncidents(key, list, day, MAP, LINE, RATE, null), first = spotIncidents(key, list, day, MAP, LINE, RATE, null, { antics: false });
      const old = all.filter((x) => !ANTIC_KINDS.includes(x.kind));
      assert.deepEqual(old.map((x) => [x.kind, x.round, x.members.map((m) => m.id)]), first.map((x) => [x.kind, x.round, x.members.map((m) => m.id)]), `${key}: the first five as they were`);
      checked += old.length;
      for (const x of all.filter((y) => ANTIC_KINDS.includes(y.kind))) {
        newer++;
        assert.ok(!old.some((o) => o.round === x.round), `${key}: a round of its own`);
        assert.ok(wholeRound(x));
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const p = all[i], q = all[j];
        if (p.t0 < q.end && q.t0 < p.end) assert.ok(!p.members.some((m) => q.members.some((k) => k.id === m.id)), `${key}: one at a time for each`);
      }
    }
  }
  assert.ok(checked > 20 && newer > 10, `${checked} of the first five, ${newer} newer`);
});

test('LW-ANTICS the cutpurse\'s run (cutpurseRun): from the first shout at a frightened run\'s pace, CHASE_M at most; the watch 0.6 s behind and a little faster, holding them CAUGHT_M behind; none before the shout or after the end (mutants: the pace, the reach, the hold, the delay)', () => {
  const inc = { kind: 'cutpurse', loudFrom: 1000, end: 1000 + 30 * RATE, guard: { id: 'g' } };
  assert.equal(cutpurseRun(inc, 999, RATE, FLEE_SPEED), null);
  assert.equal(cutpurseRun(inc, inc.end, RATE, FLEE_SPEED), null);
  const at = (s) => cutpurseRun(inc, 1000 + s * RATE, RATE, FLEE_SPEED);
  assert.ok(Math.abs(at(2).thief - 2 * FLEE_SPEED) < 1e-9 && at(2).running);
  assert.equal(at(0.5).guard, 0, 'the watch not off yet');
  assert.ok(at(2).guard > 0 && at(2).guard < at(2).thief - CAUGHT_M);
  assert.equal(at(20).thief, CHASE_M);
  assert.ok(Math.abs(at(20).guard - (CHASE_M - CAUGHT_M)) < 1e-9 && !at(20).running, 'caught, held');
  const alone = cutpurseRun({ ...inc, guard: null }, 1000 + 20 * RATE, RATE, FLEE_SPEED);
  assert.ok(alone.thief === CHASE_M && alone.guard === 0 && !alone.running, 'none chasing: away');
  assert.equal(cutpurseRun({ ...inc, kind: 'quarrel' }, 1000 + 2 * RATE, RATE, FLEE_SPEED), null);
});

test('LW-ANTICS on the street: a cutpurse the watch catches - from the first shout the cutpurse runs from their stand along a clear line, at a run\'s pace, CHASE_M; the watchman runs after and stands CAUGHT_M behind; caught, the cutpurse turns to him; the one robbed keeps their stand; after it, their own again (mutants: the run unstood, the guard unrun, the turn, the pace)', () => {
  const lt = townOf();
  let found = null;
  for (let day = 100; day < 130 && !found; day++) {
    tickAt(lt, day * DAY_MIN + 720);
    for (const [, list] of lt._stirDays.get(day)?.by ?? []) { const c = list.find((x) => x.kind === 'cutpurse' && x.guard); if (c) { found = { day, c }; break; } }
  }
  assert.ok(found, 'a cutpurse the watch steps in on');
  const { c } = found;
  const people = lt.peopleOf(found.day);
  const thief = people.find((r) => r.id === c.members[0].id), mark = people.find((r) => r.id === c.members[1].id), guard = people.find((r) => r.id === c.guard.id);
  tickAt(lt, c.loudFrom - 1e-6);
  const stand = lt._aloneAt.get(thief.id), was = lt.where(mark, lt._now, false);
  assert.ok(stand && was && !lt.where(thief, lt._now, false).run, 'before the shout: at their stand');
  let caught = null, maxRun = 0;
  for (let s = 0.5; c.loudFrom + s * RATE < c.end; s += 0.5) {
    tickAt(lt, c.loudFrom + s * RATE);
    const w = lt.where(thief, lt._now, false), g = lt.where(guard, lt._now, false), m = lt.where(mark, lt._now, false);
    assert.ok(w?.run, `${s} s: the cutpurse running or held`);
    const d = Math.hypot(w.x - stand.x, w.z - stand.z);
    maxRun = Math.max(maxRun, d);
    assert.ok(d <= CHASE_M + 1e-6 && Math.abs(d - Math.min(CHASE_M, FLEE_SPEED * s)) < 1e-6, `${s} s: ${d.toFixed(2)} m out`);
    assert.ok(lt._street.clear(stand.x, stand.z, w.x, w.z), 'a clear line');
    assert.ok(Math.hypot(m.x - was.x, m.z - was.z) < 1e-6, 'the one robbed keeps their stand');
    if (g?.run) { const gap = Math.hypot(g.x - w.x, g.z - w.z); assert.ok(gap >= CAUGHT_M - 1e-6, 'the watch never past them'); if (!w.moving && !g.moving) caught = { w, g }; }
  }
  assert.ok(Math.abs(maxRun - CHASE_M) < 1e-6, 'run out to CHASE_M');
  assert.ok(caught && Math.abs(Math.hypot(caught.g.x - caught.w.x, caught.g.z - caught.w.z) - CAUGHT_M) < 1e-6, 'caught, held CAUGHT_M behind');
  assert.ok(Math.abs(Math.sin(caught.w.yaw - Math.atan2(caught.g.x - caught.w.x, caught.g.z - caught.w.z))) < 1e-6 && Math.cos(caught.w.yaw - Math.atan2(caught.g.x - caught.w.x, caught.g.z - caught.w.z)) > 0, 'turned to the watch');
  tickAt(lt, c.end + 1e-6);
  assert.ok(!lt.where(thief, lt._now, false)?.run, 'after: their own again');
  // the body: at a run's pace while it runs
  const row = { active: true, visible: true, res: thief, person: new ResidentWalker(lt.nav, { archive: thief.archive, frameCount: () => 4, groundY: () => 0 }), paused: false, halt: false, side: 0 };
  row.person.pos = [stand.x, 0, stand.z];
  lt.pool = [row];
  lt.o.clock = () => c.loudFrom + 1.5 * RATE;
  lt._timer = 0;
  lt.update(1 / 30, [stand.x + 30, 0, stand.z], 0, [stand.x + 30, 1.6, stand.z], true);
  assert.equal(row.person.pace, FLEE_SPEED / PERSON_MOVE_SPEED, 'the run\'s cadence');
  lt.pool = [];
});

test('WATCH-LIFE a city\'s patrols: from 25 blocks a pair more a shift, two from 40, three from 60 (watchExtraOf), after the shift\'s own - in pairs, each pair a beat of its own; every post and every rank of the shift as it was (mutants: the extra, the pairs, the beats, the posts)', () => {
  assert.deepEqual([1, 9, 24, 25, 39, 40, 59, 60, 64, 100].map((blocks) => watchExtraOf({ mapId: 1, blocks })), [0, 0, 0, 2, 2, 4, 4, 6, 6, 6]);
  for (const blocks of [9, 30, 45, 64]) assert.equal(townWatchCount({ mapId: 1, blocks }), WATCH_COMPANIES * (watchShiftSize({ mapId: 1, blocks }) + watchExtraOf({ mapId: 1, blocks })));
  const lt = townOf(synthTown({ blocksW: 4, blocksH: 4 }), 64);
  const places = lt.places, size = watchShiftSize({ mapId: MAP, blocks: 64 });
  assert.equal(size, 6);
  const watch = lt.residents.filter((r) => r.job === 'guard');
  assert.equal(watch.length, WATCH_COMPANIES * 12, 'four companies of twelve');
  for (let day = 100; day < 104; day++) {
    for (const company of [0, 1, 2, 3]) {
      const men = watch.filter((r) => r.slot % WATCH_COMPANIES === company).map((r) => ({ r, d: watchDuty(r, places, day, size) }));
      const extra = men.filter(({ r }) => Math.floor(r.slot / WATCH_COMPANIES) >= size);
      assert.equal(extra.length, 6);
      assert.ok(extra.every(({ d }) => d.kind === 'patrol' && d.post === null), 'the extra patrol');
      const byPatrol = new Map();
      for (const { d } of extra) byPatrol.set(d.patrol, [...(byPatrol.get(d.patrol) ?? []), d.pair]);
      assert.deepEqual([...byPatrol.values()].map((p) => [...p].sort()), [[0, 1], [0, 1], [0, 1]], 'in pairs');
      const own = men.filter(({ r }) => Math.floor(r.slot / WATCH_COMPANIES) < size && ({ ...r }).slot >= 0).map(({ d }) => d);
      assert.ok(own.every((d) => !byPatrol.has(d.patrol) || d.kind === 'post'), 'a beat of their own');
      const beats = new Set([...byPatrol.keys()].map((p) => patrolBeat(places, MAP, company, p, day, 0).map((s) => s.key).join(',')));
      assert.ok(beats.size >= 2, 'their own beats');
      // the shift's own ranks as a census of the shift alone deals them
      for (const { r, d } of men) if (Math.floor(r.slot / WATCH_COMPANIES) < size) assert.deepEqual(d, watchDuty(r, places, day, size));
    }
  }
});

test('LW-ANTICS a courier at their stint in town cries the news (newsCries) where a stall cries its wares; the rest as they were (mutants: the crier unread)', () => {
  let news = 0, wares = 0;
  for (let i = 0; i < 400; i++) {
    const c = who(`L${MAP}.t${i}`, { job: 'courier' }), k = who(`L${MAP}.${i}`, { job: 'crafter' });
    for (let t = H(9); t < H(17); t += 0.25) {
      const v = smallVoice(c, { kind: 'stall' }, t, RATE, { town: 'Synth', places: ['Wayrest'] });
      if (v) { news++; assert.ok(newsCries().some((x) => v.text === x.replace('{place}', 'Wayrest').replace('{town}', 'Synth'))); }
      const w = smallVoice(k, { kind: 'stall' }, t, RATE, { town: 'Synth', places: ['Wayrest'] });
      if (w) { wares++; assert.ok(!newsCries().some((x) => w.text === x.replace('{place}', 'Wayrest').replace('{town}', 'Synth'))); }
    }
  }
  assert.ok(news > 100 && wares > 100 && Math.abs(news / wares - 1) < 0.35, `${news} news, ${wares} wares (CRY_SHARE ${CRY_SHARE} each)`);
});

test('LW-ANTICS said aloud: each newer kind\'s lines by their speakers - the watch\'s own voice for its chase (mutants: the speaker)', () => {
  const lt = townOf();
  const seen = new Set();
  for (let day = 100; day < 112; day++) {
    tickAt(lt, day * DAY_MIN + 720);
    for (const [, list] of lt._stirDays.get(day)?.by ?? []) for (const x of list) {
      if (!ANTIC_KINDS.includes(x.kind)) continue;
      seen.add(x.kind);
      for (let i = 0; i < x.script.length; i++) {
        const l = stirLine(x, x.from + (i + 0.5) * LINE, LINE, { town: 'Synth' });
        assert.ok(l && l.index === i);
        const by = x.script[i].by;
        assert.equal(l.who.id, by === 'g' ? x.guard.id : x.members[by === 'a' ? 0 : 1].id, `${x.kind}: line ${i} by ${by}`);
        assert.ok(!/\{\w+\}/.test(l.text), `${x.kind}: filled (${l.text})`);
      }
    }
  }
  assert.ok(['watchword', 'cutpurse', 'dice'].every((k) => seen.has(k)), [...seen].join(','));
});
