// AUDIT LW-STIR (2026-10-08, Mac, of LW-STIR: "Lets audit everything and ensure perfection"; the record is
// bible/01-Overview/Audit-LW-Stir.md) - every pin red on the code as it stood (its mutants,
// tools/mutants/auditlwstir.json), on the synthetic towns (test/lwTown.mjs) and, where ARENA2_PATH names the data, the
// game's own (test/lwRealTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { DAY_MIN, DAY_START_MIN, walkMinutes, TAVERN_DRINK, dayPlan } from '../src/systems/livingWorld/dayPlan.js';
import { lineMinutes, spotRound, ROUND_S, besideStand, aloneStands, FACE_M, SPACE_M } from '../src/systems/livingWorld/meetups.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { exitToward } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import {
  stirLine, spotIncidents, smallVoice, gateHalt, gateWord, humourOf, STIR_GATHER_S, STIR_AFTER_S, PLEA_UNNAMED, GATE_SHARE, CHALLENGE_SHARE, QUARREL_SHARE,
  QUARREL_EVENING, HAGGLE_SHARE, PLEA_SHARE, DRINKER, SONG_DRINK, HUMOURS, VOICE_S, CALL_SHARE, CALL_SPREAD_MIN, CRY_EVERY_MIN, CRY_SHARE, BEG_EVERY_MIN,
  BEG_SHARE, SONG_EVERY_MIN, SONG_SHARE,
} from '../src/systems/livingWorld/stir.js';
import { GATE_SCRIPTS, CHALLENGE_SCRIPTS, QUARREL_SCRIPTS, PLEA_SCRIPTS, HAGGLE_SCRIPTS, BREAK_UP_LINES, WATCH_HOURS, WATCH_CALLS, STALL_CRIES, BEGGAR_CRIES, DRINKING_SONGS, fillLine } from '../src/systems/livingWorld/lines.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const DAY = 100, D0 = DAY * DAY_MIN + DAY_START_MIN;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const MAP = 24680;
const LINE = lineMinutes(RATE), GATHER = STIR_GATHER_S * RATE, AFTER = STIR_AFTER_S * RATE;

/** A living town on the synthetic grid (its watch posting the gates at 45 blocks), with `visitors`, no bodies made. */
function townOf(built, visitors, blocks = 45) {
  return new LivingTown(built.nav, {
    town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM,
    tripsOf: () => ({ away: new Map(), visitors, holders: null, news: null, places: ['Daggerfall', 'Sentinel'] }),
  });
}
/** What the street says from `eye` with the residents `ids` stood where they stand (rows given back after). */
function sayWith(lt, ids, eye) {
  lt.pool = ids.flatMap((id) => {
    const res = lt.peopleOf(lt.dayOf(lt._now)).find((r) => r.id === id);
    const w = res ? lt.where(res, lt._now, false) : null;
    return w && !w.pending ? [{ active: true, visible: true, res, flee: false, person: { pos: [w.x, 0, w.z], yaw: w.yaw, moving: !!w.moving, living: { id } } }] : [];
  });
  lt._greetings = [];
  const out = lt.speech(eye, 1e6);
  lt.pool = [];
  return out;
}

test('AUDIT LW-STIR F1: the gate\'s and the watch\'s {place} is the stranger\'s own town - their trip\'s home, where the roads know it - never a town of this one\'s own travels (a stranger come from Wayrest named Daggerfall, a town this one\'s people go to, as theirs); a quarrel\'s and a haggle\'s {place} is still the roads\' (mutants: the home unread, the home for every word, the trip unread)', () => {
  // the words, by the line: the home where the word is the gate's or the watch's, the roads' town elsewhere
  const post = { id: `L${MAP}.w9`, name: 'Hal Ward', job: 'guard', town: MAP, guard: true }, stranger = { id: 'L999.t1', name: 'Bram Stoke', job: 'merchant', town: 999 };
  const civil = GATE_SCRIPTS.civil.find((s) => s.some((l) => l.text.includes('{place}')));
  const word = (kind, script, members = [post, stranger]) => ({ kind, spot: 'xn', members, anchor: 0, guard: null, mood: 'civil', script, seed: 11, round: 0, t0: H(10), from: H(10) + GATHER, end: H(10) + GATHER + script.length * LINE + AFTER, loudFrom: Infinity });
  const placeLine = (inc) => inc.script.findIndex((l) => l.text.includes('{place}'));
  const said = (inc, ctx) => stirLine(inc, inc.from + (placeLine(inc) + 0.5) * LINE, LINE, ctx).text;
  const ctx = { town: 'Ripmarket', places: ['Daggerfall'], home: 'Wayrest' };
  const gate = word('gate', civil);
  assert.ok(said(gate, ctx).includes('Wayrest') && !said(gate, ctx).includes('Daggerfall'), `the gate: ${said(gate, ctx)}`);
  const stop = word('challenge', CHALLENGE_SCRIPTS.civil.find((s) => s.some((l) => l.text.includes('{place}'))));
  assert.ok(said(stop, ctx).includes('Wayrest'), `the watch's stop: ${said(stop, ctx)}`);
  assert.ok(said(gate, { ...ctx, home: null }).includes('Daggerfall'), 'no home known: the roads\' town, as before');
  const quarrel = word('quarrel', QUARREL_SCRIPTS.find((s) => s.some((l) => l.text.includes('{place}'))) ?? [{ by: 'a', text: 'Back from {place}, are you?', loud: false }], [stranger, post]);
  assert.ok(said(quarrel, ctx).includes('Daggerfall') && !said(quarrel, ctx).includes('Wayrest'), 'a quarrel\'s: the roads\'');
  // the street: strangers come from Wayrest, halted at the kept gates - each gate word's {place} line says Wayrest
  const built = synthTown();
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).map((res, i) => ({ res, inT: D0 + 300 + ((i * 53) % 700), outT: Math.max(H(17), D0 + 420 + ((i * 53) % 700)), yaw: yaws[i % 4], trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis);
  lt._now = H(12); lt._tick([0, 0, 0], 0);
  let heard = 0;
  for (const [, list] of lt._stirDays.get(DAY).by) {
    for (const inc of list) {
      if (inc.kind !== 'gate') continue;
      const i = placeLine(inc);
      if (i < 0) continue;
      lt._now = inc.from + (i + 0.5) * LINE; lt._tick([0, 0, 0], 0);
      const at = lt._aloneAt.get(inc.members[0].id);
      if (!at) continue;
      const line = sayWith(lt, inc.members.map((m) => m.id), [at.x, 1.6, at.z]).find((o) => inc.members.some((m) => m.id === o.person.living.id));
      if (!line) continue;
      assert.ok(line.text.includes('Wayrest') && !/Daggerfall|Sentinel/.test(line.text), `${inc.members[1].id} at ${inc.spot}: "${line.text}"`);
      heard++;
    }
  }
  assert.ok(heard >= 2, `the gate's words naming their home, heard (${heard})`);
});

/** A resident of the dealer's (stir.js StirWho) and a stay of one at a spot (SpotStay), as `_stirOf` mints them. */
const who = (id, o = {}) => ({ id, name: 'Tam Ashby', job: 'crafter', town: MAP, drink: 0.2, ...o });
const stay = (w, kind, t0, t1, o = {}) => ({ who: w, kind, t0, t1, duty: false, pair: null, ...o });
const guardOf = (id, o = {}) => who(`L${MAP}.${id}`, { job: 'guard', guard: true, name: 'Hal Ward', ...o });

test('AUDIT LW-STIR A1: a gate\'s word is laid whole past 2^24 minutes - the online sky\'s clock there in 2028, at its 0.4 minutes a second - its sum\'s slack a few of the clock\'s last bits (a fixed 1e-9 was under one: 416 of 955 halted strangers of a day stood the halt unquestioned) (mutants: the fixed slack, the halt\'s end unslacked)', () => {
  const rate = 2 * RATE, line = lineMinutes(rate);   // the online sky's
  for (const day of [11659, 12000]) {
    const d0 = day * DAY_MIN + DAY_START_MIN;
    assert.ok(d0 > 2 ** 24, 'past 2^24 minutes');
    const post = stay(guardOf('w9'), 'post', d0, d0 + 1400, { duty: true });
    let halted = 0, asked = 0;
    for (let k = 0; k < 400; k++) {
      const inT = d0 + 120 + k * 2.37, h = gateHalt('xn', day, inT, rate);
      if (!h) continue;
      halted++;
      const s = stay(who(`L999.t${k}`, { town: 999, job: 'merchant' }), 'gate', inT, inT + h);
      const got = spotIncidents('xn', [post, s], day, MAP, line, rate);
      if (got.length === 1 && got[0].kind === 'gate' && got[0].members[1] === s.who) asked++;
    }
    assert.ok(halted >= 200, `day ${day}: halted ${halted}`);
    assert.equal(asked, halted, `day ${day}: every one halted questioned`);
  }
});

test('AUDIT LW-STIR A2: one party\'s word a round of a gate\'s - a party come in for a word in a round an earlier one\'s holds is waved through, in at once (it stood its halt out unquestioned: 684 such pairs in the lens\'s days), and every halt the plans keep is questioned, by the round gateWord names (mutants: the round unheld, the round of the arrival)', () => {
  const built = synthTown();
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  // two by two a minute apart at one gate: the pairs' words fall in one round of the gate's more often than not
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).map((res, i) => ({ res, inT: D0 + 300 + Math.floor(i / 2) * 41 + (i % 2), outT: Math.max(H(17), D0 + 420 + Math.floor(i / 2) * 41 + (i % 2)), yaw: yaws[Math.floor(i / 2) % 4], trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis);
  lt._now = H(12); lt._tick([0, 0, 0], 0);
  const guards = lt.peopleOf(DAY).filter((r) => r.job === 'guard' && r.town === MAP);
  const kept = (exit, t0, t1) => guards.some((g) => lt.planOf(g, DAY).some((e) => e.kind === 'post' && e.duty && e.at.key === exit.key && e.t0 <= t0 && e.t1 >= t1));
  const by = lt._stirDays.get(DAY).by;
  let halts = 0, waved = 0;
  /** @type {Map<string, Set<number>>} */
  const held = new Map();
  for (const v of [...vis].sort((a, b) => a.inT - b.inT)) {
    const plan = lt.planOf(v.res, DAY);
    const exit = plan.find((e) => e.kind === 'away').at;
    const w = gateWord(exit.key, DAY, v.inT, RATE);
    const g = plan.find((e) => e.kind === 'gate');
    const rounds = held.get(exit.key) ?? new Set();
    held.set(exit.key, rounds);
    if (!w || !kept(exit, v.inT, v.inT + w.halt)) { assert.ok(!g, `${v.res.id}: no halt`); continue; }
    if (rounds.has(w.round)) {
      assert.ok(!g, `${v.res.id}: its round held - waved through`);
      assert.equal(plan.find((e) => e.kind === 'walk' && e.from === exit)?.t0, v.inT, `${v.res.id}: in at once`);
      waved++;
      continue;
    }
    rounds.add(w.round);
    assert.ok(g && g.t0 === v.inT && Math.abs(g.t1 - v.inT - w.halt) < 1e-9, `${v.res.id}: halted`);
    halts++;
    const word = (by.get(exit.key) ?? []).find((x) => x.kind === 'gate' && x.members[1].id === v.res.id);
    assert.ok(word, `${v.res.id}: questioned`);
    assert.equal(word.round, w.round, `${v.res.id}: in the round gateWord names`);
  }
  assert.ok(halts >= 4 && waved >= 2, `halted ${halts}, waved through ${waved}`);
});

test('AUDIT LW-STIR A3: the watch that steps into a quarrel is whichever of it stands through the words - at a handover the one come on, never one leaving as it begins (the first there was chosen, and the quarrel laid with nobody while the other stood through it) (mutants: the guard chosen before)', () => {
  const line = lineMinutes(RATE);
  let laid = 0;
  for (let i = 0; i < 400 && laid < 4; i++) {
    const x = stay(who(`L${MAP}.r${i}a`, { name: 'Ada Moss', drink: 0.9 }), 'social', H(19), H(20));
    const y = stay(who(`L${MAP}.r${i}b`, { name: 'Bo Hale', drink: 0.9 }), 'social', H(19), H(20));
    const leaving = stay(guardOf('w1'), 'watch', H(18.5), H(19) + 1, { duty: true });
    const on = stay(guardOf('w2', { name: 'Ser Pike' }), 'watch', H(19) - 1, H(19.5), { duty: true });
    const q = spotIncidents('sq', [x, y, leaving, on], DAY, MAP, line, RATE).find((z) => z.kind === 'quarrel');
    if (!q) continue;
    laid++;
    assert.equal(q.guard?.id, on.who.id, `${x.who.id}: the one come on steps in`);
    assert.ok(on.t0 <= q.from && on.t1 >= q.end && q.script.some((l) => l.by === 'g'), 'standing through its words, and saying its own');
  }
  assert.equal(laid, 4);
});

test('AUDIT LW-STIR A4: a beggar\'s plea to a stall\'s keeper is put at the stall - the keeper keeps their stand, the beggar comes to it (the keeper left the stall for the beggar\'s place); to one standing elsewhere, the beggar keeps theirs (mutants: the beggar\'s stand always)', () => {
  const line = lineMinutes(RATE);
  let keeper = 0, other = 0;
  for (let i = 0; i < 600 && (keeper < 3 || other < 3); i++) {
    const beg = stay(who(`L${MAP}.b${i}`, { job: 'beggar' }), 'beg', H(9), H(12));
    const stall = stay(who(`L${MAP}.k${i}`, { job: 'merchant' }), 'stall', H(9), H(12));
    const by = stay(who(`L${MAP}.p${i}`), 'social', H(9.5), H(10.5));
    for (const p of spotIncidents('mk', [beg, stall, by], DAY, MAP, line, RATE).filter((z) => z.kind === 'plea')) {
      assert.equal(p.members[0], beg.who, 'the beggar asks');
      if (p.members[1] === stall.who) { assert.equal(p.anchor, 1, 'at the stall'); keeper++; } else { assert.equal(p.anchor, 0, 'where the beggar sits'); other++; }
    }
  }
  assert.ok(keeper >= 3 && other >= 3, `to a keeper ${keeper}, to another ${other}`);
});

test('AUDIT LW-STIR A5: a beggar asks a stranger by no name (one of Wayrest was asked "A septim for bread, kind Finn?") - one of the town still may be named (mutants: the stranger\'s pool)', () => {
  assert.ok(PLEA_UNNAMED.length >= 2 && PLEA_UNNAMED.length < PLEA_SCRIPTS.length && PLEA_UNNAMED.every((s) => s.every((l) => !l.text.includes('{b}'))), 'the unnamed pleas');
  const line = lineMinutes(RATE);
  let strangers = 0, named = 0;
  for (let i = 0; i < 1500 && (strangers < 12 || named < 1); i++) {
    const beg = stay(who(`L${MAP}.b${i}`, { job: 'beggar' }), 'beg', H(9), H(12));
    const s = stay(who(`L999.v${i}`, { town: 999, name: 'Finn Roe' }), 'social', H(9.5), H(10.5));
    const t = stay(who(`L${MAP}.n${i}`, { name: 'Ida Moss' }), 'social', H(10.6), H(11.6));
    for (const p of spotIncidents('sq', [beg, s, t], DAY, MAP, line, RATE).filter((z) => z.kind === 'plea')) {
      const said = p.script.map((_, j) => stirLine(p, p.from + (j + 0.5) * line, line, { town: 'Ripmarket' })?.text ?? '').join(' ');
      if (p.members[1] === s.who) { assert.ok(!said.includes('Finn'), `to a stranger: "${said}"`); strangers++; } else if (said.includes('Ida')) named++;
    }
  }
  assert.ok(strangers >= 12 && named >= 1, `to strangers ${strangers}, one of the town named ${named}`);
});

test('AUDIT LW-STIR A6: the first of a patrol\'s pair calls the hour, the second stands by (both called each hour, a minute or two apart); a post and one alone call as before (mutants: the second calling)', () => {
  const g = guardOf('w4');
  const calls = (pair) => {
    let n = 0;
    for (let t = H(21); t < H(29); t += 0.05) if (smallVoice(g, { kind: 'watch', duty: true, pair }, t, RATE, { town: 'Ripmarket' })) n++;
    return n;
  };
  assert.equal(calls(1), 0, 'the second never');
  assert.ok(calls(0) > 0 && calls(0) === calls(null), 'the first, as one alone');
  assert.ok(Object.keys(WATCH_HOURS).length >= 8);
});

test('AUDIT LW-STIR A7: the second of a pair never breaks up a quarrel - the first speaks for the watch, whichever came first or sorts first (the second spoke for it where his stay began first, or his id sorted first) (mutants: the second chosen)', () => {
  const line = lineMinutes(RATE);
  for (const [a, b, early] of [['w0', 'w4', 1], ['w8', 'w12', 0]]) {
    let n = 0;
    for (let i = 0; i < 2000 && n < 6; i++) {
      const x = stay(who(`L${MAP}.r${i}a`, { name: 'Ada Moss', drink: 0.9 }), 'social', H(19), H(20));
      const y = stay(who(`L${MAP}.r${i}b`, { name: 'Bo Hale', drink: 0.9 }), 'social', H(19), H(20));
      const first = stay(guardOf(a), 'watch', H(18.9), H(20.5), { duty: true, pair: 0 });
      const second = stay(guardOf(b, { name: 'Ser Pike' }), 'watch', H(18.9) - early, H(20.5), { duty: true, pair: 1 });
      const q = spotIncidents('sq', [x, y, first, second], DAY, MAP, line, RATE).find((z) => z.kind === 'quarrel' && z.guard);
      if (!q) continue;
      n++;
      assert.equal(q.guard.id, first.who.id, `${a}/${b}: the first`);
    }
    assert.equal(n, 6, `${a}/${b}: broken up`);
  }
});

/** An incident as a line of text (its kind, its two, who keeps their stand, the watch, the mood, its minutes). */
const flatInc = (x) => `${x.spot}:${x.kind}:${x.members.map((m) => m.id).join('+')}:${x.anchor}:${x.guard?.id ?? ''}:${x.mood}:${x.t0.toFixed(4)}:${x.end.toFixed(4)}`;
const dealOf = (lt, day = DAY) => [...lt._stirDays.get(day).by.values()].flat().map(flatInc).sort();
/** A town on the synthetic grid built as townOf does, the host's own options laid over. */
const townWith = (built, blocks, o) => new LivingTown(built.nav, {
  town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
  makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM, ...o,
});

test('AUDIT LW-STIR B1 / C1: the day\'s incidents are dealt again when the plans are made again with the same people - the roads\' word come after a reader\'s first census (the host answers nothing while its ways are asked): the reader there before deals the day a reader come after does, never the day the plans before it made (2292 beats of a morning staged apart, a traveller on the road staged at 372) (mutants: the plans unread)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const probe = townWith(built, 16, { tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }) });
  probe._now = H(6); probe._tick([0, 0, 0], 0);
  const travellers = probe.residents.filter((r) => r.roll === 't');
  assert.ok(travellers.length >= 6, `the census's travellers (${travellers.length})`);
  const word = { away: new Map(travellers.map((r) => [r.id, [{ t0: H(8), t1: H(15), yaw: 0, armed: false }]])), visitors: [], holders: null, news: null, places: ['Daggerfall'] };
  let asked = true;
  const early = townWith(built, 16, { tripsOf: () => (asked ? undefined : word) });
  early._now = H(6); early._tick([0, 0, 0], 0);   // its first census: the ways still asked
  const before = dealOf(early);
  asked = false;
  early._now = H(6) + 0.05; early._tick([0, 0, 0], 0);   // the roads' word in: the plans made again, the same people
  const late = townWith(built, 16, { tripsOf: () => word });
  late._now = H(6) + 0.05; late._tick([0, 0, 0], 0);
  assert.notDeepEqual(before, dealOf(late), 'the travellers\' day moved the deal');
  assert.deepEqual(dealOf(early), dealOf(late), 'the reader there before deals as the one come after');
  for (let t = H(8); t < H(15); t += 3.7) {
    early._now = t; early._tick([0, 0, 0], 0);
    for (const [id] of early._inStir) assert.ok(!word.away.has(id), `${id} on the road, staged at ${t}`);
  }
});

test('AUDIT LW-STIR B2: the day is dealt from the people every reader has - one lent to the watch (this reader\'s or a peer\'s) dealt as everyone, and left out, as the struck down are (a lend cut 5 of 12 incidents between others mid-word); none of a household living here beyond the census (`extraPeople`, a player\'s own another reader has not: its draws moved 49 of 752 of the town\'s own incidents), nor any of it in one (mutants: the lent undealt, the household dealt)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const plain = townWith(built, 16, { tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }) });
  let cut = 0, lentOut = 0;
  for (let k = 0; k < 160; k++) {
    const T = H(9) + k * 3.3;
    plain._lent.clear();
    plain._now = T; plain._tick([0, 0, 0], 0);
    const now = [...plain._inStir].filter(([id, x]) => x.inc.members[0].id === id && x.inc.from <= T && x.inc.end > T + 0.1).map(([, x]) => x);
    if (!now.length) continue;
    const x = now[0];
    const third = k % 3 ? plain.peopleOf(DAY).find((r) => r.job !== 'guard' && !x.inc.members.some((m) => m.id === r.id) && plain.entryOf(r, T)?.e.at?.key === x.spot.key && plain.entryOf(r, T)?.e.kind !== 'walk') : null;   // a third at the spot, or (each third try) one of its two
    const deal = dealOf(plain);
    const member = x.inc.members[1];
    plain.lend(third ?? plain.peopleOf(DAY).find((r) => r.id === member.id));
    plain._now = T + 0.05; plain._tick([0, 0, 0], 0);
    assert.deepEqual(dealOf(plain), deal, `${T}: the day's deal kept`);
    if (third) { const now2 = plain._inStir.get(x.inc.members[0].id)?.inc; assert.equal(now2 && flatInc(now2), flatInc(x.inc), `${T}: the incident beside the lent kept`); cut++; }
    else { assert.ok(!plain._inStir.has(member.id) && !plain._inStir.has(x.inc.members[0].id), `${T}: one of its two lent: left out`); lentOut++; }
  }
  assert.ok(cut >= 4 && lentOut >= 2, `incidents with a third at their spot lent ${cut}, one of their two ${lentOut}`);
  const house = plain.homeFor('fam1');
  const base = townCensus({ mapId: MAP, blocks: 16, region: 17, people: 3 }, built.buildings);
  const extra = [0, 1, 2].map((i) => ({ ...base[i + 40], id: `LEG.fam1.${i}`, home: house, household: 'fam1' }));
  const one = townWith(built, 16, { tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }) });
  const two = townWith(built, 16, { tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null }), extraPeople: () => extra });
  for (let d = 0; d < 6; d++) {
    const day = DAY + d;
    for (const lt of [one, two]) { lt._now = day * DAY_MIN + 300; lt._tick([0, 0, 0], 0); }
    assert.ok(two.peopleOf(day).some((r) => r.id === extra[0].id), 'the household lives here');
    assert.deepEqual(dealOf(two, day), dealOf(one, day), `day ${day}: the town's incidents the reader's without it`);
  }
});

test('AUDIT LW-STIR B4: an incident\'s two at its spot are drawn as themselves while it runs - a beggar or a stall\'s keeper stood as their still picture, looking the same from every side, never turned to the one before them (12 of 12 in view); themselves again in the round after (mutants: the still picture kept)', () => {
  const built = synthTown({ blocksW: 3, blocksH: 3 });
  const deal = townOf(built, [], 45);
  deal._now = H(12); deal._tick([0, 0, 0], 0);
  const incs = [...deal._stirDays.get(DAY).by.values()].flat().filter((x) => (x.kind === 'plea' || x.kind === 'haggle') && x.t0 > H(7));
  let n = 0;
  for (const inc of incs.slice(0, 6)) {
    const keeper = inc.members[inc.anchor], comer = inc.members[1 - inc.anchor];
    const spot = deal._stirDays.get(DAY).spots.get(inc.spot);
    const clock = { t: inc.t0 - 2 };
    const lt = new LivingTown(built.nav, {
      town: { mapId: MAP, blocks: 45, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
      makePerson: (archive, guard) => new ResidentWalker(built.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
      clock: () => clock.t, rate: () => RATE, mpm: MPM, flatOf: (want) => ({ ...want, frameCount: 2 }),
      tripsOf: () => ({ away: new Map(), visitors: [], holders: null, news: null, places: ['Daggerfall'] }),
    });
    const at = [spot.x, 0, spot.z], mid = (inc.from + inc.end) / 2;
    /** @type {any} */
    let seen = null;
    while (clock.t < mid) {
      clock.t += RATE / 30;
      const seats = lt.update(1 / 30, at, 0, at, true);
      const k = seats.find((q) => q.person.living.res.id === keeper.id), c = seats.find((q) => q.person.living.res.id === comer.id);
      if (k && c && clock.t >= mid - RATE / 30) seen = { k: k.person, c: c.person };
    }
    if (!seen) continue;
    n++;
    assert.ok(!seen.k.stillLook, `${inc.kind} ${keeper.id}: themselves, not their still picture`);
    const toComer = Math.atan2(seen.c.pos[0] - seen.k.pos[0], seen.c.pos[2] - seen.k.pos[2]);
    assert.ok(Math.abs(Math.atan2(Math.sin(seen.k.yaw - toComer), Math.cos(seen.k.yaw - toComer))) < 0.35, `${keeper.id}: turned to the one before them`);
  }
  assert.ok(n >= 3, `pleas and haggles in view (${n})`);
});

test('AUDIT LW-STIR B6: a small voice is by the plan entry where the body is - one held on their walk by the politeness gate owes its minutes, and cries nothing of the stall they have not reached (a keeper cried "Salt! Good salt from the coast!" from 8.8 m short of it) (mutants: the clock\'s entry)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const lt = townOf(built, [], 16);
  lt._now = H(6); lt._tick([0, 0, 0], 0);
  let held = 0;
  for (const r of lt.peopleOf(DAY)) {
    const plan = lt.planOf(r, DAY);
    const k = plan.findIndex((e, i) => i > 0 && e.kind === 'stall' && e.t0 > H(8.5) && e.t1 - e.t0 > 30 && plan[i - 1].kind === 'walk');
    if (k < 0) continue;
    const walk = plan[k - 1], stall = plan[k];
    // a minute of its stall when it cries, by the clock
    let t = stall.t0 + 0.01;
    for (; t < stall.t0 + 25; t += 0.02) {
      lt._now = t; lt._tick([0, 0, 0], 0);
      const w = lt.where(r, t, false);
      if (!w || w.pending) continue;
      const row = { active: true, visible: true, res: r, flee: false, person: { pos: [w.x, 0, w.z], yaw: w.yaw, moving: false, living: { id: r.id } } };
      lt.pool = [row]; lt._greetings = [];
      const free = lt.speech([w.x, 1.6, w.z], 1e6).some((o) => o.kind === 'shout');
      if (!free) continue;
      lt._lag.set(r.id, t - walk.t1 + 1);   // held on the walk: a minute short of its end
      const owed = lt.speech([w.x, 1.6, w.z], 1e6).some((o) => o.kind === 'shout');
      lt._lag.delete(r.id); lt.pool = [];
      assert.equal(owed, false, `${r.id} held on their walk at ${t}: no cry`);
      held++;
      break;
    }
    if (held >= 3) break;
  }
  assert.ok(held >= 3, `stall keepers crying, held (${held})`);
});

test('AUDIT LW-STIR B7: one of an incident is its own after its words - walking on in the round, they greet the player who stops before them (held the round through, 9 of 9 passed the player unspoken) (mutants: the round\'s hold at the greeting, at the street\'s words)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const lt = townOf(built, [], 16);
  lt._now = H(6); lt._tick([0, 0, 0], 0);
  let n = 0;
  for (const inc of [...lt._stirDays.get(DAY).by.values()].flat()) {
    const r = spotRound(inc.spot, inc.t0, ROUND_S * RATE);
    for (const m of inc.members) {
      const res = lt.peopleOf(DAY).find((x) => x.id === m.id);
      for (let t = inc.end + 0.5; t < r.end - 0.1; t += 0.5) {
        const e = lt.entryOf(res, t)?.e;
        if (e?.kind !== 'walk' || e.to?.key === inc.spot) continue;
        lt._now = t; lt._tick([0, 0, 0], 0);
        if (lt._inStir.get(m.id)?.inc !== inc) break;
        lt._greetings = []; lt._greeted.delete(m.id);
        const w = lt.where(res, t, false);
        const person = { pos: [w?.x ?? 0, 0, w?.z ?? 0], yaw: 0, moving: false, living: { id: m.id } };
        lt._greet(res, person, 1, true);
        assert.equal(lt._greetings.length, 1, `${m.id} at ${t}: a word for the player, after the ${inc.kind}`);
        lt.pool = [{ active: true, visible: true, res, flee: false, person }];
        const said = lt.speech([person.pos[0], 1.6, person.pos[2]], 1e6);
        lt.pool = [];
        assert.ok(said.some((o) => o.person === person && o.text === lt._greetings[0].text), `${m.id}: said on the street`);
        n++;
        break;
      }
    }
  }
  assert.ok(n >= 4, `of an incident, walking on in its round (${n})`);
});

test('AUDIT LW-STIR C2: a gate never halts a stranger out of their walk out - a party whose halt and walk in from the gate would reach their leaving is waved through, in at once (a day visit of two hours lost its walk out to the halt: in at the tavern\'s door, then "away" at the gate to the day\'s end); one with the time halted as before (mutants: the short party halted, the walk in unread)', () => {
  const built = synthTown({ blocksW: 8, blocksH: 8 });
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, 48).map((res, i) => ({ res, inT: D0 + 240 + i * 7, outT: 0, yaw: yaws[i % 4], trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis, 64);
  for (const [i, v] of vis.entries()) v.outT = v.inT + walkMinutes(exitToward(lt.places, v.yaw), lt._lodging(v.res), MPM) + (i % 2 ? 2 : 40);   // two minutes to spare, or forty
  let waved = 0, halted = 0;
  for (const [i, v] of vis.entries()) {
    const plan = lt.planOf(v.res, DAY);
    const exit = exitToward(lt.places, v.yaw);
    const out = plan.some((e) => e.kind === 'walk' && e.to === exit && e.t0 >= v.inT);
    assert.ok(out, `${v.res.id}: walks out by the gate`);
    const w = gateWord(exit.key, DAY, v.inT, RATE);
    const g = plan.find((e) => e.kind === 'gate');
    if (!w || !lt._gateOf(exit, DAY).keeps(v.inT, w.halt)) { assert.ok(!g); continue; }
    if (i % 2) { assert.ok(!g, `${v.res.id}: two minutes to spare - waved through`); waved++; } else if (g) halted++;
  }
  assert.ok(waved >= 4 && halted >= 4, `waved through ${waved}, halted ${halted}`);
});

// ---- AUDIT LW-STIR lens D: the laws no pin could fail (its survivors, each now killed - tools/mutants/auditlwstir.json D-*)

test('AUDIT LW-STIR D2: the dealer\'s numbers are the record\'s, by their literals - each was pinned against itself (a measured rate beside the imported constant, or a band), so any other value passed - and who drinks is dayPlan\'s own who goes to the tavern of an evening, one export (mutants: each number)', () => {
  assert.deepEqual(
    { GATE_SHARE, CHALLENGE_SHARE, QUARREL_SHARE, QUARREL_EVENING, HAGGLE_SHARE, PLEA_SHARE, DRINKER, SONG_DRINK, VOICE_S, CALL_SHARE, CALL_SPREAD_MIN, CRY_EVERY_MIN, CRY_SHARE, BEG_EVERY_MIN, BEG_SHARE, SONG_EVERY_MIN, SONG_SHARE, STIR_GATHER_S, STIR_AFTER_S },
    { GATE_SHARE: 0.6, CHALLENGE_SHARE: 0.5, QUARREL_SHARE: 0.03, QUARREL_EVENING: 4, HAGGLE_SHARE: 0.2, PLEA_SHARE: 0.1, DRINKER: 0.55, SONG_DRINK: 0.8, VOICE_S: 3.4, CALL_SHARE: 0.6, CALL_SPREAD_MIN: 6, CRY_EVERY_MIN: 6, CRY_SHARE: 0.3, BEG_EVERY_MIN: 8, BEG_SHARE: 0.3, SONG_EVERY_MIN: 3, SONG_SHARE: 0.35, STIR_GATHER_S: 4, STIR_AFTER_S: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(HUMOURS)), { stranger: [['civil', 0.5], ['curt', 0.3], ['hostile', 0.2]], rough: [['civil', 0.3], ['curt', 0.35], ['hostile', 0.35]] });
  assert.equal(DRINKER, TAVERN_DRINK, 'one export');
});

test('AUDIT LW-STIR D4: the gate\'s laws - the post that keeps it is a `post` there from the halt\'s start to its end, the lower id of two; one of a party, the draw\'s (not the first) (mutants: the post\'s kind, its start, the second post, the party\'s first)', () => {
  const line = lineMinutes(RATE);
  const gateAt = (inT) => gateHalt('xn', DAY, inT, RATE);
  let inT = H(10);
  for (let k = 0; k < 400 && !gateAt(inT); k++) inT += 1.3;
  const h = gateAt(inT);
  assert.ok(h > 0);
  const stranger = stay(who('L999.t1', { town: 999, job: 'merchant' }), 'gate', inT, inT + h);
  const word = (stays) => spotIncidents('xn', stays, DAY, MAP, line, RATE).filter((z) => z.kind === 'gate');
  assert.equal(word([stay(guardOf('w9'), 'post', H(6), H(14), { duty: true }), stranger]).length, 1, 'kept: questioned');
  assert.equal(word([stay(guardOf('w9'), 'watch', H(6), H(14), { duty: true }), stranger]).length, 0, 'a patrol standing there keeps no gate');
  assert.equal(word([stay(guardOf('w9'), 'post', inT + 0.01, H(14), { duty: true }), stranger]).length, 0, 'a post come on after the halt began keeps it for nobody');
  const two = word([stay(guardOf('w9'), 'post', H(6), H(14), { duty: true }), stay(guardOf('w12'), 'post', H(6), H(14), { duty: true }), stranger]);
  assert.equal(two[0]?.members[0].id, `L${MAP}.w12`, 'of two posts, the lower id');
  const asked = new Set();
  for (let k = 0; k < 60; k++) {
    let t = H(9) + k * 9.7;
    for (let j = 0; j < 400 && !gateAt(t); j++) t += 0.9;
    const party = [0, 1, 2].map((i) => stay(who(`L999.p${k}.${i}`, { town: 999 }), 'gate', t, t + gateAt(t)));
    const w = word([stay(guardOf('w9'), 'post', H(6), H(20), { duty: true }), ...party]);
    if (w.length) asked.add(party.findIndex((x) => x.who === w[0].members[1]));
  }
  assert.deepEqual([...asked].sort(), [0, 1, 2], 'each of a party asked by the draw');
});

test('AUDIT LW-STIR D4: the watch on its rounds - only a patrol\'s stop challenges (a post never), each stop one stranger: the draw\'s, the next tried where the first will not fit, never two (mutants: the post challenging, the first only, two a stop, the first by the list)', () => {
  const line = lineMinutes(RATE);
  const T = H(11);
  const challenges = (key, stays) => spotIncidents(key, stays, DAY, MAP, line, RATE).filter((z) => z.kind === 'challenge');
  let postSaid = 0, tried = 0, alone = 0, both = new Set();
  for (let k = 0; k < 300; k++) {
    const key = `s${k}`;
    const A = stay(who('L999.a', { town: 999 }), 'social', T, T + 1);   // too short to be stopped
    const B = stay(who('L998.b', { town: 998 }), 'social', T - 30, T + 150);
    const C = stay(who('L997.c', { town: 997 }), 'social', T - 30, T + 150);
    const patrol = stay(guardOf('w0'), 'watch', T, T + 20, { duty: true, pair: null });
    postSaid += challenges(key, [stay(guardOf('w0'), 'post', T, T + 20, { duty: true }), B]).length;
    const withA = challenges(key, [patrol, A, B]), withoutA = challenges(key, [patrol, B]);
    assert.equal(withA.length, withoutA.length, `${key}: one too short is passed over for the next`);
    tried += withA.length;
    const bc = challenges(key, [patrol, B, C]);
    if (bc.length) { both.add(bc[0].members[1].id); alone++; }
    // a long stop meeting two strangers in two rounds: one stopped
    const long = stay(guardOf('w0'), 'watch', T, T + 150, { duty: true, pair: null });
    const B1 = stay(who('L998.b', { town: 998 }), 'social', T, T + 20), C1 = stay(who('L997.c', { town: 997 }), 'social', T + 90, T + 110);
    assert.ok(challenges(key, [long, B1, C1]).length <= 1, `${key}: one stranger a stop`);
  }
  assert.equal(postSaid, 0, 'a post challenges nobody');
  assert.ok(tried > 50 && alone > 50, `challenges ${tried}, ${alone}`);
  assert.deepEqual([...both].sort(), ['L997.c', 'L998.b'], 'the stranger the draw\'s');
});

test('AUDIT LW-STIR D4: two of the town and the beggar - a quarrel four times as likely from six o\'clock between two who drink, no sooner; one who haggles at a stall does not also fall out there; a beggar never asks the watch; a plea and a haggle once a day between the same two however often they meet; the stall the draw\'s of two (mutants: the evening\'s hour, the haggler falling out, the watch asked, once a day for each, the first stall)', () => {
  const line = lineMinutes(RATE);
  const rate = (from) => {
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      const x = stay(who(`L${MAP}.e${i}a`, { drink: 0.9 }), 'social', from, from + 25), y = stay(who(`L${MAP}.e${i}b`, { drink: 0.9 }), 'social', from, from + 25);
      n += spotIncidents('sq', [x, y], DAY, MAP, line, RATE).filter((z) => z.kind === 'quarrel').length;
    }
    return n / 4000;
  };
  const before = rate(H(17) + 30), after = rate(H(18) + 1);
  assert.ok(before > 0.025 && before < 0.075 && after > 0.15 && after < 0.3, `from six: ${before} before, ${after} after`);
  let haggles = 0, both = 0, toWatch = 0, pleas = 0, stalls = new Set();
  for (let i = 0; i < 3000; i++) {
    const x = stay(who(`L${MAP}.h${i}`, { drink: 0.9 }), 'social', H(19), H(21));
    const s1 = stay(who(`L${MAP}.k${i}a`), 'stall', H(8), H(19.4)), s2 = stay(who(`L${MAP}.k${i}b`), 'stall', H(8), H(19.4));
    const y = stay(who(`L${MAP}.h${i}y`, { drink: 0.9 }), 'social', H(20), H(21));   // met an hour on: another round than the haggle's
    const got = spotIncidents('mk', [x, s1, s2, y], DAY, MAP, line, RATE);
    const hg = got.filter((z) => z.kind === 'haggle' && z.members[0] === x.who);
    haggles += hg.length;
    for (const z of hg) stalls.add(z.members[1] === s1.who ? 'a' : 'b');
    if (hg.length && got.some((z) => z.kind === 'quarrel' && z.members[0] === x.who)) both++;
    // a beggar and the watch standing by; a passer met twice; a buyer at the stall twice
    const beg = stay(who(`L${MAP}.b${i}`, { job: 'beggar' }), 'beg', H(8), H(20));
    const w = stay(guardOf(`w${i}`), 'watch', H(9), H(10), { duty: true, pair: null });
    const m1 = stay(who(`L${MAP}.m${i}`), 'social', H(9), H(9) + 30), m2 = stay(who(`L${MAP}.m${i}`), 'social', H(17), H(17) + 30);
    const g = spotIncidents('bg', [beg, w, m1, m2], DAY, MAP, line, RATE);
    toWatch += g.filter((z) => z.kind === 'plea' && z.members[1] === w.who).length;
    const pl = g.filter((z) => z.kind === 'plea' && z.members[1].id === m1.who.id).length;
    assert.ok(pl <= 1, `${i}: one plea a day`);
    pleas += pl;
    const b1 = stay(who(`L${MAP}.u${i}`), 'social', H(9), H(9) + 30), b2 = stay(who(`L${MAP}.u${i}`), 'social', H(15), H(15) + 30);
    assert.ok(spotIncidents('st', [s1, b1, b2], DAY, MAP, line, RATE).filter((z) => z.kind === 'haggle').length <= 1, `${i}: one haggle a day`);
  }
  assert.ok(haggles > 300 && pleas > 100, `haggles ${haggles}, pleas ${pleas}`);
  assert.equal(both, 0, 'a haggler does not also fall out');
  assert.equal(toWatch, 0, 'the watch is never asked');
  assert.deepEqual([...stalls].sort(), ['a', 'b'], 'the stall the draw\'s');
});

test('AUDIT LW-STIR D4: the deal\'s order and edges - of two who meet at once the lower id is there first; of two incidents in a round the first in time is kept; a word ends in its two\'s time together; the watch steps in only standing from its first line; a line from its first minute (mutants: the tie, the round\'s order, the overlap\'s end, the watch\'s start, the first minute)', () => {
  const line = lineMinutes(RATE);
  const T = H(11);
  let ties = 0;
  for (let k = 0; k < 200; k++) {
    const g = stay(guardOf('w5'), 'watch', T, T + 20, { duty: true, pair: null }), s = stay(who('L999.a', { town: 999 }), 'social', T, T + 60);
    const c = spotIncidents(`t${k}`, [g, s], DAY, MAP, line, RATE).find((z) => z.kind === 'challenge');
    if (!c) continue;
    assert.equal(c.anchor, `L${MAP}.w5` < 'L999.a' ? 0 : 1, 'the lower id there first');
    ties++;
  }
  assert.ok(ties > 20);
  // two pleas of one beggar: each dealt alone, then together - the round keeps the first in time
  let kept = 0;
  for (let k = 0; k < 2000 && kept < 6; k++) {
    const beg = stay(who(`L${MAP}.b${k}`, { job: 'beggar' }), 'beg', H(8), H(20));
    const y1 = stay(who(`L${MAP}.y${k}a`), 'social', H(10), H(10) + 30), y2 = stay(who(`L${MAP}.y${k}b`), 'social', H(10) + 3, H(10) + 33);
    const one = spotIncidents('pl', [beg, y1], DAY, MAP, line, RATE)[0], two = spotIncidents('pl', [beg, y2], DAY, MAP, line, RATE)[0];
    if (!one || !two || one.round !== two.round || one.t0 === two.t0) continue;
    const both = spotIncidents('pl', [beg, y1, y2], DAY, MAP, line, RATE);
    assert.equal(both.length, 1);
    assert.equal(both[0].t0, Math.min(one.t0, two.t0), 'the first in time');
    kept++;
  }
  assert.equal(kept, 6);
  // a short time together: no word outlasts it
  for (let k = 0; k < 300; k++) {
    const x = stay(who(`L${MAP}.o${k}`), 'social', H(10), H(10) + 1.5 + (k % 7) * 0.4), st = stay(who(`L${MAP}.k${k}`), 'stall', H(8), H(20));
    for (const z of spotIncidents(`o${k}`, [x, st], DAY, MAP, line, RATE)) assert.ok(z.end <= x.t1 + 1e-6, `${k}: ${z.kind} ends by ${x.t1}`);
  }
  // the watch come on mid-quarrel never steps in
  let late = 0;
  for (let i = 0; i < 400; i++) {
    const x = stay(who(`L${MAP}.r${i}a`, { drink: 0.9 }), 'social', H(19), H(20)), y = stay(who(`L${MAP}.r${i}b`, { drink: 0.9 }), 'social', H(19), H(20));
    const bare = spotIncidents('sq', [x, y], DAY, MAP, line, RATE).find((z) => z.kind === 'quarrel');
    if (!bare) continue;
    const w = stay(guardOf('w2'), 'watch', bare.from + line * 0.5, H(21), { duty: true, pair: null });
    const q = spotIncidents('sq', [x, y, w], DAY, MAP, line, RATE).find((z) => z.kind === 'quarrel');
    assert.equal(q?.guard ?? null, null, `${i}: come on after its first line`);
    late++;
  }
  assert.ok(late > 20);
  const inc = spotIncidents('sq', [stay(who(`L${MAP}.b1`, { job: 'beggar' }), 'beg', H(8), H(20)), ...Array.from({ length: 40 }, (_, i) => stay(who(`L${MAP}.q${i}`), 'social', H(9) + i * 5, H(9) + i * 5 + 30))], DAY, MAP, line, RATE)[0];
  assert.ok(inc && stirLine(inc, inc.from, line)?.index === 0 && stirLine(inc, inc.from - 1e-6, line) === null, 'its first line from its first minute');
});

test('AUDIT LW-STIR D5 / D6: the small voices\' laws - the hour called by every weather\'s own words, within CALL_SPREAD_MIN of the hour and not on it; a stall cries from eight to before six, a song from nine to before three, each at its own minute in its slot; a beggar on the beggar\'s beat; the words of each its own pool, filled as said (mutants: snow and thunder as fair, the hours\' edges, the spread, the minute in the slot, the beggar\'s beat, the pools swapped)', () => {
  const g = guardOf('w4'), keeper = who(`L${MAP}.k1`, { job: 'merchant' }), beggar = who(`L${MAP}.b1`, { job: 'beggar' }), drinker = who(`L${MAP}.d1`, { drink: 0.95 });
  const ctx = { town: 'Ripmarket' };
  for (const w of ['rain', 'thunder', 'snow', 'fog', 'fair']) {
    const said = [];
    for (let t = H(21); t < H(29); t += 0.05) { const v = smallVoice(g, { kind: 'watch', duty: true, pair: 0 }, t, RATE, { ...ctx, weather: w === 'fair' ? null : w }); if (v) said.push(v.text); }
    assert.ok(said.length > 10, w);
    assert.ok(said.every((x) => WATCH_CALLS[w].some((c) => Object.values(WATCH_HOURS).some((hr) => fillLine(c, { ...ctx, hour: hr }) === x))), `${w}: its own words`);
  }
  let late = 0;
  for (let t = H(21); t < H(21) + 60 * 80; t += 0.05) {
    const v = smallVoice(g, { kind: 'watch', duty: true, pair: 0 }, t, RATE, ctx);
    const prev = smallVoice(g, { kind: 'watch', duty: true, pair: 0 }, t - 0.05, RATE, ctx);
    if (v && !prev) { const m = ((t % 60) + 60) % 60; assert.ok(m < CALL_SPREAD_MIN + 0.1, `called ${m} past the hour`); if (m > 1) late++; }
  }
  assert.ok(late > 3, `called after the hour mark (${late})`);
  const hoursOf = (whoAt, e, from, to, fromTavern) => {
    const hours = new Set(); let offs = 0, n = 0;
    for (let t = from; t < to; t += 0.05) {
      const v = smallVoice(whoAt, e, t, RATE, ctx, fromTavern), prev = smallVoice(whoAt, e, t - 0.05, RATE, ctx, fromTavern);
      if (v && !prev) { hours.add(Math.floor((((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60)); n++; if (((t % (e.kind === 'walk' ? SONG_EVERY_MIN : e.kind === 'beg' ? BEG_EVERY_MIN : CRY_EVERY_MIN)) + 60) % 1 > 0 && t % (e.kind === 'walk' ? SONG_EVERY_MIN : e.kind === 'beg' ? BEG_EVERY_MIN : CRY_EVERY_MIN) > 0.5) offs++; }
    }
    return { hours, offs, n };
  };
  const cries = { hours: new Set(), offs: 0 };
  for (const k of [0, 1, 2, 3, 4, 5]) { const c = hoursOf(who(`L${MAP}.k${k}`, { job: 'merchant' }), { kind: 'stall' }, H(0), H(24)); c.hours.forEach((x) => cries.hours.add(x)); cries.offs += c.offs; }
  assert.ok(cries.hours.has(8) && cries.hours.has(17) && !cries.hours.has(7) && !cries.hours.has(18), `cries ${[...cries.hours]}`);
  assert.ok(cries.offs > 5, 'a cry at its own minute in its slot');
  const songs = { hours: new Set() };
  for (const k of [0, 1, 2, 3, 4, 5]) hoursOf(who(`L${MAP}.d${k}`, { drink: 0.95 }), { kind: 'walk' }, H(20), H(28), () => true).hours.forEach((x) => songs.hours.add(x));
  assert.ok(songs.hours.has(21) && songs.hours.has(2) && !songs.hours.has(20) && !songs.hours.has(3), `songs ${[...songs.hours]}`);
  const begs = hoursOf(beggar, { kind: 'beg' }, H(0), H(24 * 20));
  assert.ok(Math.abs(begs.n / (24 * 20) - (60 / BEG_EVERY_MIN) * BEG_SHARE) < 0.25, `a beggar's beat: ${begs.n / (24 * 20)} an hour`);
  for (let t = H(9); t < H(16); t += 0.05) {
    const c = smallVoice(keeper, { kind: 'stall' }, t, RATE, ctx);
    if (c) assert.ok(STALL_CRIES.some((x) => fillLine(x, ctx) === c.text), `a stall's cry: ${c.text}`);
    const b = smallVoice(beggar, { kind: 'beg' }, t, RATE, ctx);
    if (b) assert.ok(BEGGAR_CRIES.some((x) => fillLine(x, ctx) === b.text), `a beggar's: ${b.text}`);
  }
  for (let t = H(21); t < H(26); t += 0.05) {
    const v = smallVoice(drinker, { kind: 'walk' }, t, RATE, ctx, () => true);
    if (v) assert.ok(DRINKING_SONGS.some((x) => fillLine(x, ctx) === v.text), `a song: ${v.text}`);
  }
});

test('AUDIT LW-STIR D9: the place before one who keeps their stand - on the street, the way to it clear from them and from the spot, tried all the way round them; at a spot crowded past it, their own place, never on the one they come to; and one coming to one gone from the spot is laid all the same (mutants: the street unread, either way unread, half the round, on the keeper, waiting for one not there)', () => {
  const spot = { x: 0, z: 0, key: 'sp' };
  const by = { x: 0, z: 2, yaw: 0 };   // facing +z, away from the spot
  const all = () => true;
  const front = { x: by.x, z: by.z + FACE_M };
  const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 1e-6;
  // the street: only the west of them holds
  const west = besideStand(spot, by, all, { holds: (x) => x < by.x - 0.3, clear: all });
  assert.ok(west && west.x < by.x - 0.3 && Math.abs(Math.hypot(west.x - by.x, west.z - by.z) - FACE_M) < 1e-6, 'on the street');
  // a wall between them and the front
  const walled = besideStand(spot, by, all, { holds: all, clear: (x0, z0, x1, z1) => !(x0 === by.x && z0 === by.z && z1 > by.z + 0.2) });
  assert.ok(walled && walled.z <= by.z + 0.2, 'nothing between them and it');
  // the spot's line to the front blocked
  const hidden = besideStand(spot, by, all, { holds: all, clear: (x0, z0, x1, z1) => !(x0 === spot.x && z0 === spot.z && z1 > by.z + 0.2) });
  assert.ok(hidden && hidden.z <= by.z + 0.2 && !near(hidden, front), 'seen from the spot');
  // only behind them is free
  const behind = besideStand(spot, by, (x, z) => z < by.z - FACE_M + 0.05, { holds: all, clear: all });
  assert.ok(behind && Math.abs(behind.z - (by.z - FACE_M)) < 0.05, 'all the way round');
  // a crowded spot (the town's square, on its street): the keeper ringed at FACE_M - the comer at their own place, apart
  const lt = townOf(synthTown(), [], 45);
  const street = lt._street, sq = lt.places.square;
  const own = aloneStands(sq, ['keep'], [], street).get('keep');
  assert.ok(own);
  const ring = Array.from({ length: 24 }, (_, i) => ({ x: own.x + Math.sin(i * Math.PI / 12) * FACE_M, z: own.z + Math.cos(i * Math.PI / 12) * FACE_M }));
  const placed = aloneStands(sq, ['keep', 'come'], ring, street, new Map([['come', 'keep']]));
  const k = placed.get('keep'), c = placed.get('come');
  assert.ok(k && c && near(k, own), 'the keeper at their stand');
  assert.ok(Math.hypot(k.x - c.x, k.z - c.z) >= SPACE_M - 1e-6, 'never on the one they come to');
  // the one they come to not at the spot: laid all the same
  assert.ok(aloneStands(sq, ['come'], [], street, new Map([['come', 'keep']])).has('come'), 'laid, though the one they come to is gone');
});

test('AUDIT LW-STIR D1: the small voices on the street - a stall\'s keeper standing at it cries its wares, never while walking; the night watch calls the hour; one who drinks deep sings walking home from the tavern\'s door, and from no other door; a word to the player first (the street\'s wiring was pinned by no test: the voices unsaid passed every one) (mutants: unsaid, while walking, a song standing only, any door, no door, the greeting and the voice both)', () => {
  const built = synthTown();
  const lt = townOf(built, [], 45);
  lt._now = H(6); lt._tick([0, 0, 0], 0);
  const ctxOf = () => lt.lineCtx(lt._now);
  /** what the street says of one, stood (`moving`) at minute t */
  const say = (res, t, moving = false, greeting = null) => {
    lt._now = t; lt._tick([0, 0, 0], 0);
    if (lt._inCircle.has(res.id) || lt._inStir.has(res.id)) return null;
    const w = lt.where(res, t, false);
    if (!w) return null;
    const person = { pos: [w.x, 0, w.z], yaw: w.yaw, moving, living: { id: res.id } };
    lt.pool = [{ active: true, visible: true, res, flee: false, person }];
    lt._greetings = greeting ? [{ person, text: greeting, until: Infinity }] : [];
    const out = lt.speech([w.x, 1.6, w.z], 1e6).filter((o) => o.person === person);
    lt.pool = []; lt._greetings = [];
    return out;
  };
  const tavern = (e) => e.from?.kind === 'door' && lt.typeOf(e.from.building) === BUILDING_TYPES.Tavern;
  let cried = 0, called = 0, sung = 0;
  for (const res of lt.peopleOf(DAY)) {
    for (const e of lt.planOf(res, DAY)) {
      const want = e.kind === 'stall' && cried < 2 ? 'cry' : e.duty && (e.kind === 'watch' || e.kind === 'post') && e.pair !== 1 && called < 2 ? 'call' : e.kind === 'walk' && (res.drink ?? 0) > SONG_DRINK && tavern(e) && sung < 2 ? 'song' : null;
      if (!want) continue;
      for (let t = Math.max(e.t0, want === 'cry' ? H(9) : H(21)) + 0.01; t < Math.min(e.t1, want === 'cry' ? H(17) : H(26)); t += 0.04) {
        const v = smallVoice(res, e, t, RATE, ctxOf(), tavern);
        if (!v) continue;
        const out = say(res, t, want === 'song');
        if (!out) continue;
        assert.deepEqual(out.map((o) => [o.text, o.kind]), [[v.text, v.kind]], `${res.id} ${want} at ${t}`);
        if (want === 'cry') {
          assert.deepEqual(say(res, t, true), [], 'no cry while walking');
          assert.deepEqual(say(res, t, false, 'Good day.')?.map((o) => o.text), ['Good day.'], 'the word to the player first, alone');
          cried++;
        } else if (want === 'call') called++;
        else {
          const own = lt.typeOf;
          lt.typeOf = (k) => (k === e.from.building ? BUILDING_TYPES.House : own.call(lt, k));
          assert.deepEqual(say(res, t, true), [], 'from a house\'s door, no song');
          lt.typeOf = own;
          sung++;
        }
        break;
      }
    }
  }
  assert.ok(cried >= 2 && called >= 2 && sung >= 1, `cried ${cried}, called ${called}, sung ${sung}`);
});

test('AUDIT LW-STIR D3: the spot hushes and turns only while words are shouted - before an incident\'s first shout its circles keep their talk and their faces; in it, a circle\'s people turn to it, while a post keeps the road; through its words its two say nothing else and greet nobody (mutants: hushed all through, the circles unturned, the post turned, the two falling through to other words, a greeting mid-word)', () => {
  const built = synthTown();
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, 48).map((res, i) => ({ res, inT: D0 + 180 + i * 13, outT: D0 + 480 + i * 13, yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][i % 4], dock: false, trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis, 45);
  const tick = (t) => { lt._now = t; lt._tick([0, 0, 0], 0); };
  tick(H(6));
  const all = [...lt._stirDays.get(DAY).by.values()].flat();
  let quiet = 0, turned = 0, silent = 0;
  const circlesAt = (key) => [...lt._inCircle].filter(([, c]) => c.spot.key === key);
  for (const inc of all) {
    const calm = Math.min(inc.loudFrom, inc.end);
    if (calm - inc.from > 0.2) {
      tick((inc.from + calm) / 2);
      assert.ok(!lt._stirAt.has(inc.spot), `${inc.kind} at ${inc.spot}: no hush before its shouting`);
      for (const [id, c] of circlesAt(inc.spot)) {
        const res = lt.peopleOf(DAY).find((r) => r.id === id), w = res && lt.where(res, lt._now, false);
        if (w && !w.moving && w.e.at === c.spot) { assert.ok(Math.abs(w.yaw - c.place.yaw) < 1e-9, `${id}: their circle's face`); quiet++; }
      }
    }
    if (Number.isFinite(inc.loudFrom)) {
      tick((inc.loudFrom + inc.end) / 2);
      const mid = lt._stirAt.get(inc.spot)?.mid;
      for (const [id, c] of circlesAt(inc.spot)) {
        const res = lt.peopleOf(DAY).find((r) => r.id === id), w = res && lt.where(res, lt._now, false);
        if (!mid || !w || w.moving || w.e.at !== c.spot || w.e.kind === 'post') continue;
        const to = Math.atan2(mid.x - w.x, mid.z - w.z);
        assert.ok(Math.abs(Math.atan2(Math.sin(w.yaw - to), Math.cos(w.yaw - to))) < 1e-9, `${id}: turned to the shouting`);
        turned++;
      }
    }
    // through its words: its two say its lines alone, and greet nobody
    if (inc.end - inc.from > 0.5 && silent < 12) {
      const t = inc.from + 0.01;
      tick(t);
      if (lt._inStir.get(inc.members[0].id)?.inc !== inc) continue;
      for (const m of inc.members) {
        const res = lt.peopleOf(DAY).find((r) => r.id === m.id);
        lt._greetings = []; lt._greeted.delete(m.id);
        lt._greet(res, {}, 1, true);
        assert.equal(lt._greetings.length, 0, `${m.id}: no greeting mid-word`);
        const rows = inc.members.map((x) => ({ active: true, visible: true, res: lt.peopleOf(DAY).find((r) => r.id === x.id), flee: false, person: { pos: [0, 0, 0], yaw: 0, moving: false, living: { id: x.id } } }));
        const greeted = rows.find((r) => r.res.id === m.id);
        lt._greetings = [{ person: greeted.person, text: 'Good day.', until: Infinity }];
        lt.pool = rows;
        const said = lt.speech([0, 1.6, 0], 1e6).filter((o) => o.person === greeted.person);
        lt.pool = []; lt._greetings = [];
        const line = stirLine(inc, t, lineMinutes(RATE), { ...lt.lineCtx(t), home: lt._homeOf(inc.members[1]) });
        assert.deepEqual(said.map((o) => o.text), line?.who.id === m.id ? [line.text] : [], `${m.id}: its line or nothing`);
      }
      silent++;
    }
  }
  assert.ok(quiet >= 3 && turned >= 2 && silent >= 6, `quiet ${quiet}, turned ${turned}, through the words ${silent}`);
  // a post keeps the road while words are shouted at its spot (no post stands by another's word on these towns: staged)
  tick(H(12));
  const post = lt.peopleOf(DAY).find((r) => lt.entryOf(r, lt._now)?.e.kind === 'post' && !lt._inCircle.has(r.id) && !lt._inStir.has(r.id));
  const pe = post && lt.entryOf(post, lt._now).e;
  assert.ok(post && pe);
  lt._stirAt.set(pe.at.key, { inc: all[0], mid: { x: pe.at.x + 3, z: pe.at.z + 1 } });
  assert.equal(lt.where(post, lt._now, false).yaw, pe.at.yaw, 'the post keeps the road');
});

test('AUDIT LW-STIR D7: a patrol\'s stop staged on the street - the stranger names their own town (F1\'s street pin skipped every word but the gate\'s); no quarrel, haggle, plea or break-up line names a place, so the talk\'s {place} is the gate\'s and the watch\'s alone to fill (mutants: the watch\'s word given the talk\'s town)', () => {
  for (const pool of [QUARREL_SCRIPTS, HAGGLE_SCRIPTS, PLEA_SCRIPTS, BREAK_UP_LINES]) assert.ok(pool.every((sc) => sc.every((l) => !l.text.includes('{place}'))), 'no place named');
  const built = synthTown();
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, 4).map((res, i) => ({ res, inT: D0 + 200 + i, outT: D0 + 900, yaw: 0, dock: false, trip: { from: { name: 'Wayrest' }, party: [res] } }));
  const lt = townOf(built, vis, 45);
  lt._now = H(6); lt._tick([0, 0, 0], 0);
  const line = lineMinutes(RATE);
  let heard = 0;
  for (const g of lt.peopleOf(DAY).filter((r) => r.job === 'guard')) {
    for (const e of lt.planOf(g, DAY)) {
      if (heard >= 2 || e.kind !== 'watch' || !e.duty || e.pair === 1 || e.t1 - e.t0 < 6) continue;
      for (const v of vis) {
        const got = spotIncidents(e.at.key, [{ who: g, kind: 'watch', t0: e.t0, t1: e.t1, duty: true, pair: e.pair ?? null }, { who: v.res, kind: 'social', t0: e.t0 - 30, t1: e.t1 + 60, duty: false, pair: null }], DAY, MAP, line, RATE);
        const inc = got.find((z) => z.kind === 'challenge');
        const i = inc ? inc.script.findIndex((l) => l.text.includes('{place}')) : -1;
        if (!inc || i < 0) continue;
        lt._stirOf = () => ({ by: new Map([[e.at.key, [inc]]]), spots: new Map([[e.at.key, e.at]]) });
        lt._now = inc.from + (i + 0.5) * line; lt._tick([0, 0, 0], 0);
        lt.pool = inc.members.map((m) => ({ active: true, visible: true, res: m, flee: false, person: { pos: [0, 0, 0], yaw: 0, moving: false, living: { id: m.id } } }));
        lt._greetings = [];
        const said = lt.speech([0, 1.6, 0], 1e6);
        lt.pool = [];
        assert.equal(said.length, 1);
        assert.ok(said[0].text.includes('Wayrest') && !said[0].text.includes('Daggerfall'), `the watch's stop: "${said[0].text}"`);
        heard++;
        break;
      }
    }
  }
  assert.equal(heard, 2);
});

test('AUDIT LW-STIR D8: the town\'s wiring - the patrol\'s pair read into the deal, its second never speaking for the watch (a day of the synthetic town reaches it); the struck down dealt, left out where shown; a halt near the day\'s end begins nothing past it; a gate halts only where a post keeps that gate (a town of 25 blocks posts one) (mutants: the pair dropped, the deal of this reader\'s living, the halt unweighed at the day\'s end, a gate past it, a post at another gate)', () => {
  const built = synthTown();
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const line = lineMinutes(RATE);
  let reached = 0;
  for (const day of [102, 103]) {
    const d0 = day * DAY_MIN + DAY_START_MIN;
    const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, 48).map((res, i) => ({ res, inT: d0 + 180 + i * 13, outT: d0 + 480 + i * 13, yaw: yaws[i % 4], dock: false, trip: { from: { name: 'Wayrest' }, party: [res] } }));
    const lt = townOf(built, vis, 45);
    lt._now = d0 + 600; lt._tick([0, 0, 0], 0);
    const second = (id, t) => lt.planOf(lt.peopleOf(day).find((r) => r.id === id), day).find((e) => e.duty && e.t0 <= t && e.t1 > t)?.pair === 1;
    for (const inc of [...lt._stirDays.get(day).by.values()].flat()) {
      if (inc.kind === 'challenge') assert.ok(!second(inc.members[0].id, inc.t0), `${inc.spot}: a pair's second challenged`);
      if (inc.guard) assert.ok(!second(inc.guard.id, inc.from), `${inc.spot}: a pair's second stepped in`);
    }
    // the dealer over the plans with the pair unread: some spot of the day deals otherwise
    const stays = new Map();
    for (const res of lt.peopleOf(day)) for (const e of lt.planOf(res, day)) {
      if (e.kind === 'walk' || !e.at?.key || !['social', 'market', 'stall', 'beg', 'watch', 'post', 'gate'].includes(e.kind)) continue;
      const l = stays.get(e.at.key) ?? []; l.push({ who: res, kind: e.kind, t0: e.t0, t1: e.t1, duty: !!e.duty, pair: null }); stays.set(e.at.key, l);
    }
    for (const [k, l] of stays) if (spotIncidents(k, l, day, MAP, line, RATE).map(flatInc).join() !== (lt._stirDays.get(day).by.get(k) ?? []).map(flatInc).join()) { reached++; break; }
    // one of an incident struck down: the day's deal kept, the incident unstaged
    const inc = [...lt._stirDays.get(day).by.values()].flat().find((x) => x.kind !== 'gate' && x.t0 > lt._now);
    const deal = dealOf(lt, day);
    lt._now = (inc.from + inc.end) / 2;
    lt._take(lt.peopleOf(day).find((r) => r.id === inc.members[1].id));
    lt._tick([0, 0, 0], 0);
    assert.deepEqual(dealOf(lt, day), deal, `day ${day}: the struck down dealt`);
    assert.ok(!lt._inStir.has(inc.members[0].id), 'left out where shown');
  }
  assert.ok(reached >= 1, 'a day the pair decides');
  // the day's end
  const lt = townOf(built, [], 45);
  const res = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 })[0];
  const exit = lt.places.exits[0], home = lt._lodging(res), D1 = D0 + DAY_MIN;
  const back = walkMinutes(exit, home, MPM);
  for (const t1 of [D1 - back - 1, D1 - 0.5]) {
    const plan = dayPlan(res, lt.places, DAY, { mpm: MPM, visitor: true, home, away: [{ t0: D0 - DAY_MIN, t1, exit, armed: false, halt: 5 }, { t0: D1 + 600, t1: D0 + 2 * DAY_MIN, exit, armed: false }] });
    assert.ok(plan.every((e) => e.t1 <= D1 + 1e-6), `in at ${t1 - D0}: nothing past the day's end`);
    assert.ok(!plan.some((e) => e.kind === 'gate'), 'no halt the day cannot hold');
  }
  // a town of 25 blocks: one post at a time
  const five = synthTown({ blocksW: 5, blocksH: 5 });
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, 40).map((r, i) => ({ res: r, inT: D0 + 180 + i * 17, outT: D0 + 600 + i * 17, yaw: yaws[i % 4], dock: false, trip: { from: { name: 'Wayrest' }, party: [r] } }));
  const t25 = townOf(five, vis, 25);
  t25._now = H(12); t25._tick([0, 0, 0], 0);
  const posts = t25.peopleOf(DAY).filter((g) => g.job === 'guard').flatMap((g) => t25.planOf(g, DAY).filter((e) => e.kind === 'post' && e.duty));
  let unposted = 0;
  for (const v of vis) {
    const ex = exitToward(t25.places, v.yaw), w = gateWord(ex.key, DAY, v.inT, RATE);
    const g = t25.planOf(v.res, DAY).find((e) => e.kind === 'gate');
    const kept = !!w && posts.some((e) => e.at.key === ex.key && e.t0 <= v.inT && e.t1 >= v.inT + w.halt);
    if (g) assert.ok(kept, `${v.res.id}: halted at ${ex.key} where its post keeps it`);
    if (w && !kept && posts.some((e) => e.t0 <= v.inT && e.t1 >= v.inT + w.halt)) unposted++;
  }
  assert.ok(unposted >= 3, `come in at a gate unposted while another was (${unposted})`);
});
