// LW-ANTICS and WATCH-LIFE (2026-10-28, bible/06-Systems/Living-World.md "LW-ANTICS", "WATCH-LIFE"; the owner: "Living
// world NPCs should partake in more activities, more shenanigans", "Guards should have a more Living world presence and
// NPC interaction"). THE STREET'S NEWER KINDS: the watch's word with one of the town at its stop (a bite at a stall, a
// beggar moved along), a purse lifted at a crowded spot and the watch's chase, two at dice or a warmer word of an
// evening, a priest's sermon at their temple's door, a courier crying the news; and a city's watch walking more
// patrols. Every one dealt from the plans as LW-STIR's are, every reader alike. The town is the synthetic one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from '../../lwTown.mjs';
import { LivingTown, FLEE_SPEED, RUN_MIN_M, JOIN_M, JOIN_SPAN_M } from '../../../src/systems/livingWorld/livingTown.js';
import { travellerRoster, watchShiftSize, watchExtraOf, townWatchCount, WATCH_COMPANIES } from '../../../src/systems/livingWorld/census.js';
import { watchDuty, patrolBeat, DAY_MIN, DAY_START_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { spotRound, lineMinutes, ROUND_S } from '../../../src/systems/livingWorld/meetups.js';
import {
  spotIncidents, stirLine, smallVoice, cutpurseRun, lightFingered, ANTIC_KINDS, WATCH_WORD_SHARE, CUTPURSE_HANDS,
  CUTPURSE_SHARE, CUTPURSE_CROWD, DICE_SHARE, FLIRT_SHARE, SERMON_SHARE, CHASE_M, CAUGHT_M, STIR_GATHER_S, STIR_AFTER_S, CRY_SHARE,
  FOOD_SELLERS, MORNING_HOURS,
} from '../../../src/systems/livingWorld/stir.js';
import {
  watchWords, morningWatchWords, watchBuys, moveAlong, beggarWords, cutpurseScripts, chaseLines, gotAwayLines, diceScripts, sermonScripts, flirtScripts, newsCries,
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

test('WATCH-LIFE the watch\'s word: of its rounds\' stops where one of the town stands, WATCH_WORD_SHARE has a word with them - a bite bought at a stall of food (watchBuys, the keeper keeping their stall; AUDIT B10: FOOD_SELLERS alone), a beggar moved along at the end of their pitch (moveAlong; AUDIT B9: they go after it), else its talk (watchWords; AUDIT B6: the morning\'s words in MORNING_HOURS alone); the first of a pair alone, none with a stranger; AUDIT A3: none at a stop that stopped a stranger; AUDIT B9: one a day between a watchman and one of the town (mutants: the share, the pair, the food, the beggar\'s end, the morning, the stranger, the stopped stop, the one a day)', () => {
  assert.deepEqual([[...FOOD_SELLERS].sort(), [...MORNING_HOURS]], [['carter', 'farmer', 'fisher', 'merchant'], [5, 11]]);
  let words = 0, n = 0;
  const kinds = { buy: 0, move: 0, talk: 0, stall: 0 };
  const talk = [...morningWatchWords(), ...watchWords()];
  for (let i = 0; i < 800; i++) {
    const g = who(`L${MAP}.w${i}`, { job: 'guard', guard: true });
    const kind = ['social', 'stall', 'craft', 'beg'][i % 4];
    const y = who(`L${MAP}.${i}`, { job: kind === 'beg' ? 'beggar' : kind === 'stall' ? 'fisher' : 'crafter' });
    const pitchEnd = kind === 'beg' ? H(10.4) : H(11);
    const got = deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(y, kind === 'craft' ? 'stall' : kind, H(9.9), pitchEnd)]).filter((x) => x.kind === 'watchword');
    n++;
    if (!got.length) continue;
    words++;
    const w = got[0];
    assert.ok(wholeRound(w) && w.members[0].id === g.id && w.members[1].id === y.id);
    const pool = kind === 'stall' ? watchBuys() : kind === 'beg' ? moveAlong() : talk;
    assert.ok(isScript(pool, w.script), `${kind}: its own words`);
    if (kind === 'beg') assert.ok(w.end <= pitchEnd + 1e-6 && w.end > pitchEnd - ROUND, 'moved along at the end of the pitch: they go after it');
    if (kind === 'stall' || kind === 'beg') { assert.equal(w.anchor, 1, `${kind}: they keep their place`); kinds[kind === 'stall' ? 'buy' : 'move']++; } else kinds[kind === 'craft' ? 'stall' : 'talk']++;
  }
  assert.ok(Math.abs(words / n - WATCH_WORD_SHARE) < 0.08, `${words} of ${n}`);
  assert.ok(kinds.buy > 20 && kinds.move > 20 && kinds.talk > 20 && kinds.stall > 20, JSON.stringify(kinds));
  let afternoon = 0, stays = 0;
  for (let i = 0; i < 400; i++) {
    const g = who(`L${MAP}.w${i}`, { job: 'guard', guard: true }), y = who(`L${MAP}.${i}`);
    // the second of a pair stands by; a stranger is no word of this kind
    assert.equal(deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 1 }), stay(y, 'social', H(9.9), H(11))]).filter((x) => x.kind === 'watchword').length, 0, 'the second of a pair: none');
    assert.equal(deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(who(`L77.t${i}`, { town: 77 }), 'social', H(9.9), H(11))]).filter((x) => x.kind === 'watchword').length, 0, 'a stranger: none');
    // a beggar whose pitch outlasts the stop is no word of moving along: a word that keeps them there
    for (const x of deal(`s${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(who(`L${MAP}.${i}`, { job: 'beggar' }), 'beg', H(9.9), H(11))]).filter((q) => q.kind === 'watchword')) { stays++; assert.ok(isScript(beggarWords(), x.script) && x.anchor === 1, 'the beggar stays on: no moving along'); }
    // the morning's words never of an afternoon
    for (const x of deal(`a${i}`, [stay(g, 'watch', H(15), H(15.5), { duty: true, pair: 0 }), stay(y, 'social', H(14.9), H(16))]).filter((q) => q.kind === 'watchword')) { afternoon++; assert.ok(isScript(watchWords(), x.script), 'of an afternoon: never the morning\'s'); }
    // two stops of one watchman at the spot, one of the town there through both: one word between them a day
    assert.ok(deal(`d${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(g, 'watch', H(13), H(13.5), { duty: true, pair: 0 }), stay(y, 'social', H(9.9), H(14))]).filter((q) => q.kind === 'watchword').length <= 1, 'one a day');
    // a stop that stopped a stranger has no word with another there
    const stranger = who(`L77.t${i}`, { town: 77 });
    const both = deal(`c${i}`, [stay(g, 'watch', H(10), H(10.5), { duty: true, pair: 0 }), stay(stranger, 'social', H(9.9), H(11)), stay(y, 'social', H(9.9), H(11))]);
    if (both.some((q) => q.kind === 'challenge')) assert.equal(both.filter((q) => q.kind === 'watchword').length, 0, 'the stop that stopped a stranger: no word');
  }
  assert.ok(afternoon > 40 && stays > 40, `${afternoon} words of an afternoon, ${stays} with a beggar staying on`);
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
    // AUDIT LW-ANTICS A1: the one robbed stays on past the thief, so the run ends the thief's stay - one who leaves first is no mark
    assert.equal(deal(`m${i}`, [stay(x, 'social', H(11), H(12)), stay(mark, 'social', H(10.8), H(11.95)), ...crowd(i, H(10.8), H(11.8), 3)]).filter((y) => y.kind === 'cutpurse').length, 0, 'the marks gone first: none');
    // AUDIT LW-ANTICS A9: by day at the lift's own minute - a stay begun by day that ends after six none
    assert.equal(deal(`m${i}`, [stay(x, 'social', H(17.4), H(18.4)), stay(mark, 'social', H(17.2), H(18.6)), ...crowd(i, H(17.2), H(18.6), 3)]).filter((y) => y.kind === 'cutpurse').length, 0, 'after six: none');
  }
});

test('LW-ANTICS of an evening, two of the town at dice (DICE_SHARE, the watch off duty too) or a warmer word (FLIRT_SHARE, never the watch); a priest at their own temple\'s door with one there preaches (SERMON_SHARE, at another\'s door none); never by day, never a stranger (mutants: the evening, the dice, the flirt, the watch, the door)', () => {
  let dice = 0, flirt = 0, n = 0, lateMet = 0;
  for (let i = 0; i < 3000; i++) {
    const a = who(`L${MAP}.${i}`), b = who(`L${MAP}.b${i}`, { job: i % 7 ? 'labourer' : 'guard', guard: i % 7 === 0 });
    const got = deal(`e${i}`, [stay(a, 'social', H(19), H(20)), stay(b, 'social', H(19), H(20))], null, undefined);
    n++;
    for (const x of got) {
      if (x.kind === 'dice') { dice++; assert.ok(isScript(diceScripts(), x.script)); }
      if (x.kind === 'flirt') { flirt++; assert.ok(isScript(flirtScripts(), x.script)); assert.ok(!x.members.some((m) => m.guard), 'never the watch'); }
    }
    assert.equal(deal(`e${i}`, [stay(a, 'social', H(11), H(12)), stay(b, 'social', H(11), H(12))]).filter((x) => x.kind === 'dice' || x.kind === 'flirt').length, 0, 'by day: none');
    // AUDIT LW-ANTICS A9: the evening of their meeting - met at five, none; met at a quarter past six of a stay begun at
    // half past five, theirs as any evening's
    assert.equal(deal(`f${i}`, [stay(a, 'social', H(17), H(18.5)), stay(b, 'social', H(17), H(18.5))]).filter((x) => x.kind === 'dice' || x.kind === 'flirt').length, 0, 'met by day: none');
    lateMet += deal(`e${i}`, [stay(a, 'social', H(17.5), H(19.5)), stay(b, 'social', H(18.25), H(19.5))]).filter((x) => x.kind === 'dice').length;
    assert.equal(deal(`e${i}`, [stay(a, 'social', H(19), H(20)), stay(who(`L77.t${i}`, { town: 77 }), 'social', H(19), H(20))]).filter((x) => x.kind === 'dice' || x.kind === 'flirt').length, 0, 'a stranger: none');
  }
  // two at one spot each draw: about twice the share between them
  assert.ok(Math.abs(dice / n - 2 * DICE_SHARE) < 0.03 && flirt > 30, `${dice} at dice, ${flirt} flirting, of ${n}`);
  // each of the two draws (one begun before six too): about 1 - (1 - DICE_SHARE)^2 of the pairs, never one draw's share alone
  assert.ok(lateMet / n > 1.5 * DICE_SHARE, `${lateMet} at dice met after six in a stay begun before, of ${n}`);
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

test('AUDIT LW-ANTICS A1/A2 after the run: the thief\'s words over, they stand where the run ended through the rest of their stay (the lift laid at its end), never back at their stand beside the one robbed; their next walk taken up where its line comes within JOIN_M of them; a lane clear for less than CHASE_M is run as far as it holds, RUN_MIN_M or more, none under it (mutants: the hold, the join, the best reach, the floor)', () => {
  assert.deepEqual([RUN_MIN_M, JOIN_M, JOIN_SPAN_M], [4, 4, 30]);
  const lt = townOf();
  const lifts = [];
  for (let day = 100; day < 124 && lifts.length < 12; day++) {
    tickAt(lt, day * DAY_MIN + 720);
    for (const [, list] of lt._stirDays.get(day)?.by ?? []) for (const c of list) if (c.kind === 'cutpurse' && !c.guard) lifts.push({ day, c });
  }
  assert.ok(lifts.length >= 6, `${lifts.length} lifts`);
  let back = 0, joined = 0, ahead = 0, walks = 0;
  for (const { day, c } of lifts.slice(0, 12)) {
    const people = lt.peopleOf(day);
    const thief = people.find((r) => r.id === c.members[0].id), mark = people.find((r) => r.id === c.members[1].id);
    tickAt(lt, c.end - 1e-4);
    const ran = lt.where(thief, lt._now, false), stand = lt._aloneAt.get(thief.id), robbed = lt.where(mark, lt._now, false);
    const way = lt._chaseWays.get(lt._inStir.get(thief.id)?.inc);   // the day dealt again: its incident this one's twin
    assert.ok(ran?.run && way && way.len >= RUN_MIN_M - 1e-9 && way.len <= CHASE_M + 1e-9, 'run out');
    assert.ok(Math.abs(Math.hypot(ran.x - stand.x, ran.z - stand.z) - way.len) < 1e-6, 'as far as the way holds');
    const plan = lt.planOf(thief, day), i = plan.findIndex((e) => e.kind !== 'walk' && e.t0 <= c.from && e.t1 >= c.end - 1e-6);
    const walk = plan.slice(i + 1).find((e) => e.kind === 'walk');
    for (const t of [c.end + 1e-4, (c.end + (walk?.t0 ?? plan[i].t1)) / 2]) {
      tickAt(lt, t);
      const w = lt.where(thief, t, false);
      if (!w || w.e.kind === 'walk') continue;
      assert.ok(Math.hypot(w.x - ran.x, w.z - ran.z) < 1e-6 && !w.moving, 'held where they ran, through the rest of the stay');
    }
    if (!walk) continue;
    walks++;
    // the run toward where they walk next - or off to that side of the one robbed, never through them
    if (walk.to && Math.hypot(walk.to.x - stand.x, walk.to.z - stand.z) > 1 && (way.dx * (walk.to.x - stand.x) + way.dz * (walk.to.z - stand.z)) >= -1e-6) ahead++;
    // their walk on: the first seconds of it never back beside the one robbed, where its line passes near them
    let near = Infinity;
    for (let k = 1; k <= 20; k++) {
      const t = walk.t0 + k * 0.5 * RATE;
      tickAt(lt, t);
      const w = lt.where(thief, t, true);
      if (!w || w.pending) continue;
      near = Math.min(near, Math.hypot(w.x - robbed.x, w.z - robbed.z));
    }
    const held = lt._ranTo.get(thief.id);
    if (held?.join != null && held.join >= 0) joined++;
    if (near < 3) back++;
  }
  assert.ok(back <= 2, `${back} walked back beside the one robbed`);
  assert.ok(joined >= 3, `${joined} walks taken up where they ran`);
  assert.ok(ahead >= 0.75 * walks, `${ahead} of ${walks} run toward the way on`);
  // a lane: the farthest bearing the street holds, RUN_MIN_M or more - none clear so far, no run
  const inc = { seed: 7 };
  lt._street = { ...lt._street, reach: () => 7.5 };
  const lane = lt._chaseWayOf(inc, { x: 0, z: 0 }, { x: 0, z: -1 });
  assert.ok(lane && Math.abs(lane.len - 7.5) < 1e-9, 'the lane run as far as it holds');
  lt._street = { ...lt._street, reach: () => RUN_MIN_M - 0.5 };
  assert.equal(lt._chaseWayOf({ seed: 8 }, { x: 0, z: 0 }, { x: 0, z: -1 }), null, 'under RUN_MIN_M: no way');
});

test('AUDIT LW-ANTICS B7 a sermon\'s god: the temple\'s own, by its faction (guildFactions.js DIVINES), the Divines where none is known; a market\'s scales the town\'s (mutants: the god unread)', () => {
  let laid = null;
  for (let i = 0; i < 400 && !laid; i++) {
    const priest = who(`L${MAP}.p${i}`, { job: 'priest', work: 1001 }), y = who(`L${MAP}.${i}`);
    laid = deal(`d${i}`, [stay(priest, 'social', H(10), H(11)), stay(y, 'social', H(10), H(11))], { building: 1001, god: 'Kynareth' }).find((x) => x.kind === 'sermon') ?? null;
  }
  assert.ok(laid && laid.god === 'Kynareth');
  const gods = sermonScripts().flat().filter((l) => l.text.includes('{god}'));
  assert.ok(gods.length >= 1 && !sermonScripts().flat().some((l) => /Stendarr|this market/.test(l.text)), 'no god named whatever the temple');
  const said = (inc) => inc.script.map((_, k) => stirLine(inc, inc.from + (k + 0.5) * LINE, LINE, { town: 'Ripmarket' })?.text ?? '').join(' | ');
  const withGod = { ...laid, script: gods.map((l) => ({ ...l, by: 'a' })) };
  assert.match(said(withGod), /Kynareth/);
  assert.match(said({ ...withGod, god: null }), /the Divines/);
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
      // AUDIT WATCH-LIFE B8: each patrol of the shift a district apart - no stop of an earlier patrol's beat, where the town
      // has a beat's worth besides; the first patrol's beat as it was dealt
      const all = [...byPatrol.keys(), ...own.filter((d) => d.kind === 'patrol').map((d) => d.patrol)];
      const taken = new Set();
      for (const q of [...new Set(all)].sort((a, b) => a - b)) {
        const beat = patrolBeat(places, MAP, company, q, day, 0);
        const free = [...places.exits, ...places.social, ...places.market].filter((sp) => !taken.has(sp)).length;
        if (free >= 4) assert.ok(beat.every((sp) => !taken.has(sp)), `patrol ${q}: a district of its own`);
        for (const sp of beat) taken.add(sp);
      }
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
