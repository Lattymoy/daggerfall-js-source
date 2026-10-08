// AUDIT LW-STIR (2026-10-08, Mac, of LW-STIR: "Lets audit everything and ensure perfection"; the record is
// bible/01-Overview/Audit-LW-Stir.md) - every pin red on the code as it stood (its mutants,
// tools/mutants/auditlwstir.json), on the synthetic towns (test/lwTown.mjs) and, where ARENA2_PATH names the data, the
// game's own (test/lwRealTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { DAY_MIN, DAY_START_MIN, walkMinutes } from '../src/systems/livingWorld/dayPlan.js';
import { lineMinutes, spotRound, ROUND_S } from '../src/systems/livingWorld/meetups.js';
import { exitToward } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { stirLine, spotIncidents, smallVoice, gateHalt, gateWord, STIR_GATHER_S, STIR_AFTER_S, PLEA_UNNAMED } from '../src/systems/livingWorld/stir.js';
import { GATE_SCRIPTS, CHALLENGE_SCRIPTS, QUARREL_SCRIPTS, PLEA_SCRIPTS, WATCH_HOURS } from '../src/systems/livingWorld/lines.js';
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
