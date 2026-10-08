// LW-STIR (2026-10-08, bible/06-Systems/Living-World.md "LW-STIR"; Mac: "I say we improve the living world and go deeper.
// Having spontaneous interactions, like a traveller being hostile with a guard and other smaller details that make the
// world feel more alive"): THE STREET STIRS. The street's people only ever stood alone or talked in circles: the watch
// never spoke to a stranger, nobody fell out, nobody haggled, and the street had no voice of its own. Now the watch at a
// gate questions a stranger come in by it (halted there by the plans: stir.js gateHalt, dayPlan.js `gate`) and on its
// rounds stops one standing where it stops, the stranger answering by their humour - civil, curt or hostile; two of the
// town fall out and the watch standing by breaks it up; a buyer haggles at a stall; a beggar asks one standing near.
// While words are shouted the spot's circles hush and its others turn to look; and the street has its small voices - the
// night watch calling the hour, a stall's cry, a beggar's call, a drinker's song on the way home. All of it dealt from
// the plans, the seeds and the clock (stir.js spotIncidents, smallVoice): every reader alike, nothing sent. On the
// synthetic towns (test/lwTown.mjs) and the game's own where ARENA2_PATH names the data (test/lwRealTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { skipReal, hostTown, cities } from './lwRealTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { dayPlan, isOutdoor, OUTDOOR, DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { spotRound, circleLine, lineMinutes, aloneStands, besideStand, ROUND_S, SPACE_M, FACE_M, CIRCLE_APART } from '../src/systems/livingWorld/meetups.js';
import {
  spotIncidents, gateHalt, humourOf, strangerOf, stirLine, stirLoud, stirHas, smallVoice,
  GATE_SHARE, GATE_LINES, CHALLENGE_SHARE, QUARREL_SHARE, QUARREL_EVENING, HAGGLE_SHARE, PLEA_SHARE, DRINKER, HUMOURS,
  STIR_GATHER_S, STIR_AFTER_S, VOICE_S, CALL_SHARE, CALL_SPREAD_MIN, SONG_DRINK,
} from '../src/systems/livingWorld/stir.js';
import {
  GATE_SCRIPTS, CHALLENGE_SCRIPTS, QUARREL_SCRIPTS, BREAK_UP_LINES, HAGGLE_SCRIPTS, PLEA_SCRIPTS,
  WATCH_HOURS, WATCH_CALLS, STALL_CRIES, BEGGAR_CRIES, DRINKING_SONGS, fillLine,
} from '../src/systems/livingWorld/lines.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const DAY = 100, D0 = DAY * DAY_MIN + DAY_START_MIN;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const MAP = 24680;
const LINE = lineMinutes(RATE), ROUND = ROUND_S * RATE, GATHER = STIR_GATHER_S * RATE, AFTER = STIR_AFTER_S * RATE;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** One of the town (or of `town`), as a stay's `who` is. */
const who = (id, o = {}) => ({ id, name: 'Tam Ashby', job: 'crafter', town: MAP, drink: 0.2, ...o });
/** A stay at a spot. */
const stay = (w, kind, t0, t1, o = {}) => ({ who: w, kind, t0, t1, duty: false, pair: null, ...o });
/** The day's incidents at a spot of the town. */
const deal = (key, stays) => spotIncidents(key, stays, DAY, MAP, LINE, RATE);
/** An incident whole in its round of its spot. */
const wholeRound = (inc) => spotRound(inc.spot, inc.t0, ROUND).round === inc.round && spotRound(inc.spot, inc.end - 1e-9, ROUND).round === inc.round;
/** A living town on the synthetic grid (its watch posting the gates at 45 blocks), with `visitors`, no bodies made. */
function townOf(built, blocks = 45, visitors = []) {
  return new LivingTown(built.nav, {
    town: { mapId: MAP, blocks, region: 17, people: 3, port: false }, buildings: built.buildings, doors: built.doors,
    makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM,
    tripsOf: () => ({ away: new Map(), visitors, holders: null, news: null }),
  });
}
/** Visitors of another town in at the four gates through the day, a party of two apiece. */
function visitorsOf(n = 16) {
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const vis = travellerRoster({ mapId: 999, blocks: 45, region: 17, people: 3 }).slice(0, n).map((res, i) => ({ res, inT: D0 + 300 + ((i * 97) % 700), outT: H(17), yaw: yaws[i % 4] }));
  for (let i = 1; i < vis.length; i += 2) { vis[i].inT = vis[i - 1].inT; vis[i].yaw = vis[i - 1].yaw; }   // in twos, a party apiece
  for (const v of vis) v.outT = Math.max(v.outT, v.inT + 120);   // AUDIT LW-STIR C2: gone no sooner than the roads let one (trips.js: a stay of two hours at the least before noon) - those in after five left before they came
  return vis;
}
/** The town's census stood by a tick at minute `t`. */
const tickAt = (lt, t) => { lt._now = t; lt._tick([0, 0, 0], 0); };
/** Rows for speech: each one at `ids`' places this beat, standing (`moving` those walking). */
const rowsOf = (lt, ids, moving = new Set()) => ids.flatMap((id) => {
  const res = lt.peopleOf(lt.dayOf(lt._now)).find((r) => r.id === id);
  const w = res ? lt.where(res, lt._now, false) : null;
  if (!w || w.pending) return [];   // indoors, or on a walk not searched yet: on no street
  return [{ active: true, visible: true, res, flee: false, person: { pos: [w.x, 0, w.z], yaw: w.yaw, moving: w.moving || moving.has(id), living: { id } } }];
});
/** What the street says from `eye` with `rows` on it (the pool given back after: a row the street finds disabled is taken). */
const sayWith = (lt, rows, eye, range) => { lt.pool = rows; lt._greetings = []; const out = lt.speech(eye, range); lt.pool = []; return out; };
/** The turn between two ways (radians, -pi to pi). */
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test('LW-STIR the gate (Mac: "a traveller being hostile with a guard"): a stranger come in at a gate the watch keeps halts there - GATE_SHARE of the arrivals, a party together (gateHalt: the gate\'s, the day\'s and the minute\'s draw), as long as the gate\'s longest word whole in one round of the gate\'s, waiting for the next round\'s start when theirs is too short; the plan stands them there before the walk in (dayPlan.js schedule: `gate`, a kind of the street\'s); the post keeping the gate through it questions one of each party, by the draw - its word by their humour, ending as the halt does, the post keeping their stand; none without a post through it, off duty, nor one of the town (mutants: the share, the round, the halt\'s stay, the post through it, the stranger, the anchor)', () => {
  const L = GATHER + AFTER + GATE_LINES * LINE;
  assert.equal(GATE_LINES, Math.max(...Object.values(GATE_SCRIPTS).flat().map((x) => x.length)));
  let n = 0, halted = 0, waited = 0;
  for (const key of ['xn', 'xe', 'xs', 'xw']) {
    for (let k = 0; k < 500; k++) {
      const inT = H(6) + k * 1.37;
      const h = gateHalt(key, DAY, inT, RATE);
      n++;
      if (!h) continue;
      halted++;
      const start = inT + h - L;
      assert.ok(start >= inT - 1e-9 && h <= 2 * L + 1e-6, `${key} at ${inT}: the word's length (${h.toFixed(2)} of ${L.toFixed(2)})`);
      assert.equal(spotRound(key, start, ROUND).round, spotRound(key, inT + h - 1e-9, ROUND).round, `${key} at ${inT}: whole in one round`);
      if (start > inT + 1e-9) { waited++; assert.ok(Math.abs(start - spotRound(key, start, ROUND).start) < 1e-5, 'waited for the next round'); }
    }
  }
  assert.ok(Math.abs(halted / n - GATE_SHARE) < 0.05, `halted ${halted} of ${n}`);
  assert.ok(waited > 10 && waited < halted / 2, `waited their turn (${waited} of ${halted})`);
  assert.equal(gateHalt('xn', DAY, H(9), 0), 0, 'no clock, no halt');
  // the dealer: a party of three halted together at the gate the post keeps (come in well into a round, their turn not waited)
  let inT = H(10);
  while (!(gateHalt('xn', DAY, inT, RATE) === L && inT - spotRound('xn', inT, ROUND).start > 8)) inT += 1;
  const h = gateHalt('xn', DAY, inT, RATE);
  const post = stay(who(`L${MAP}.w9`, { job: 'guard', guard: true, name: 'Hal Ward' }), 'post', H(6), H(14), { duty: true });
  const party = [0, 1, 2].map((i) => stay(who(`L999.t${i}`, { town: 999, job: i ? 'mercenary' : 'merchant', name: `${['Bram', 'Cass', 'Dun'][i]} Roe` }), 'gate', inT, inT + h));
  const got = deal('xn', [post, ...party]);
  assert.equal(got.length, 1, 'one of the party questioned');
  const [g] = got;
  assert.equal(g.kind, 'gate');
  assert.ok(g.members[0] === post.who && g.anchor === 0, 'by the post, keeping the gate');
  assert.ok(party.some((s) => s.who === g.members[1]));
  assert.equal(g.mood, humourOf(g.members[1], DAY));
  assert.ok(GATE_SCRIPTS[g.mood].includes(g.script), 'the gate\'s word, by their humour');
  assert.ok(Math.abs(g.end - (inT + h)) < 1e-9 && g.t0 >= inT - 1e-9 && wholeRound(g), 'ending as the halt does, whole in its round');
  assert.ok(Math.abs(g.from - (g.t0 + GATHER)) < 1e-9 && Math.abs(g.end - (g.from + g.script.length * LINE + AFTER)) < 1e-9);
  assert.deepEqual(deal('xn', [...party].reverse().concat(post)), got, 'whatever order the stays come in');
  // the gate's word first: a stop of the watch's at the gate in its round, its own word earlier, gives way to it
  const r = spotRound('xn', g.t0, ROUND);
  let gaveWay = 0;
  for (let k = 0; k < 200 && !gaveWay; k++) {
    const watchman = stay(who(`L${MAP}.w${10 + k}`, { job: 'guard', guard: true, name: 'Ser Pike' }), 'watch', r.start + 0.5, r.start + 20, { duty: true, pair: 0 });
    const loiterer = stay(who(`L999.t${50 + k}`, { town: 999, name: 'Odd Lane' }), 'social', r.start - 30, r.start + 40);
    const own = deal('xn', [watchman, loiterer]).find((x) => x.kind === 'challenge');
    if (!own || own.round !== g.round || own.t0 >= g.t0) continue;
    const both = deal('xn', [post, ...party, watchman, loiterer]);
    assert.ok(both.some((x) => x.kind === 'gate' && x.round === g.round) && !both.some((x) => x.kind === 'challenge' && x.round === g.round), 'the gate\'s word first');
    gaveWay++;
  }
  assert.ok(gaveWay, 'a stop gave way');
  assert.deepEqual(deal('xn', party), [], 'no post, no word');
  assert.deepEqual(deal('xn', [{ ...post, t1: inT + h - 0.5 }, ...party]), [], 'the post gone before the halt is over');
  assert.deepEqual(deal('xn', [{ ...post, duty: false }, ...party]), [], 'off duty');
  assert.deepEqual(deal('xn', [post, ...party.map((s) => ({ ...s, who: { ...s.who, town: MAP } }))]).filter((x) => x.kind === 'gate'), [], 'one of the town is no stranger');
  assert.ok(strangerOf(party[0].who, MAP) && !strangerOf(post.who, MAP) && !strangerOf({ ...party[0].who, guard: true }, MAP));
  // the plan: the halt a stay at the gate, the walk in after it - waved through, in at once
  const built = synthTown();
  const places = townPlaces(built.nav, built.doors, built.buildings);
  const exit = places.exits[0], lodging = [...places.doors.values()][0];
  const v = travellerRoster({ mapId: 999, blocks: 9, region: 17, people: 3 })[0];
  const away = (halt) => [{ t0: D0 - DAY_MIN, t1: inT, exit, armed: false, halt }, { t0: H(17), t1: D0 + 2 * DAY_MIN, exit, armed: false }];
  const plain = dayPlan(v, places, DAY, { mpm: MPM, visitor: true, home: lodging, away: away(0) });
  const held = dayPlan(v, places, DAY, { mpm: MPM, visitor: true, home: lodging, away: away(h) });
  const gi = held.findIndex((e) => e.kind === 'gate');
  assert.ok(gi > 0, 'a stay at the gate');
  assert.deepEqual([held[gi - 1].kind, held[gi - 1].t1], ['away', inT]);
  assert.ok(held[gi].at === exit && held[gi].t0 === inT && Math.abs(held[gi].t1 - (inT + h)) < 1e-9);
  assert.ok(held[gi + 1].kind === 'walk' && held[gi + 1].from === exit && Math.abs(held[gi + 1].t0 - (inT + h)) < 1e-9, 'then the walk in');
  assert.ok(!plain.some((e) => e.kind === 'gate'));
  assert.equal(plain.find((e) => e.kind === 'walk' && e.from === exit)?.t0, inT, 'waved through: in at once');
  assert.ok(OUTDOOR.has('gate') && isOutdoor(held[gi]), 'seen in the street');
});

test('LW-STIR the town at its gates: the plans halt a stranger where a post of the town\'s watch keeps their gate through the halt (livingTown.js _gateHalt; WATCH-DAY: a gate\'s post for each nine blocks past nine) - a visitor\'s plan holds its gate stay exactly then, none where no post keeps it (a town of nine blocks posts none), nor off a ship; each halt\'s round at its gate has its word, the post\'s, to one halted in it (one a spot a round: a second party whose word would fall in it waved through at once - AUDIT LW-STIR A2); on the street the post keeps their stand and the stranger comes before them, FACE_M off, the two turned to each other, the rest at the gate turned to them while it is shouted (mutants: the post through it, the halt read, the anchor, the stand before, the faces)', () => {
  const built = synthTown();
  const vis = visitorsOf();
  const lt = townOf(built, 45, vis);
  tickAt(lt, H(12));
  const guards = lt.peopleOf(DAY).filter((r) => r.job === 'guard' && r.town === MAP);
  const kept = (exit, t0, t1) => guards.find((g) => lt.planOf(g, DAY).some((e) => e.kind === 'post' && e.duty && e.at.key === exit.key && e.t0 <= t0 && e.t1 >= t1)) ?? null;
  let halts = 0;
  /** @type {Map<string, { exit: any, round: number, ids: string[] }>} */
  const arrivals = new Map();
  for (const v of vis) {
    const plan = lt.planOf(v.res, DAY);
    const exit = plan.find((e) => e.kind === 'away').at;
    const h = gateHalt(exit.key, DAY, v.inT, RATE);
    const g = plan.find((e) => e.kind === 'gate');
    assert.equal(!!g, h > 0 && !!kept(exit, v.inT, v.inT + h), `${v.res.id}: halted where a post keeps the gate`);
    if (!g) continue;
    halts++;
    assert.ok(g.at === exit && g.t0 === v.inT && Math.abs(g.t1 - v.inT - h) < 1e-9);
    const round = spotRound(exit.key, g.t1 - 1e-9, ROUND).round, k = `${exit.key}|${round}`;
    const a = arrivals.get(k) ?? { exit, round, ids: [] };
    a.ids.push(v.res.id);
    arrivals.set(k, a);
  }
  assert.ok(halts >= 6 && arrivals.size >= 3, `halted ${halts}, ${arrivals.size} arrivals`);
  const by = lt._stirDays.get(DAY).by;
  let shouted = 0;
  for (const [k, a] of arrivals) {
    const words = (by.get(a.exit.key) ?? []).filter((x) => x.round === a.round);
    assert.equal(words.length, 1, `${k}: one word a round`);
    const [w] = words;
    assert.ok(w.kind === 'gate' && a.ids.includes(w.members[1].id), `${k}: to one halted`);
    assert.equal(w.members[0].id, kept(a.exit, w.t0, w.end)?.id, `${k}: by the post keeping it`);
    // on the street, in the middle of the word: the post at their own stand, the stranger before them
    const t = (w.from + w.end) / 2;
    tickAt(lt, t);
    const [post, stranger] = w.members;
    const p = lt._aloneAt.get(post.id), s = lt._aloneAt.get(stranger.id);
    assert.ok(p?.spot === a.exit && s?.spot === a.exit, `${k}: both at the gate`);
    assert.ok(Math.abs(Math.hypot(p.x - s.x, p.z - s.z) - FACE_M) < 1e-6, `${k}: FACE_M before the post`);
    const wp = lt.where(post, t, false), ws = lt.where(stranger, t, false);
    assert.ok(Math.abs(turn(wp.yaw, Math.atan2(s.x - p.x, s.z - p.z))) < 1e-9 && Math.abs(turn(ws.yaw, Math.atan2(p.x - s.x, p.z - s.z))) < 1e-9, `${k}: turned to each other`);
    const off = townOf(built, 45, vis);
    off._stirOf = () => ({ by: new Map(), spots: new Map() });   // the word unsaid: where the post stands then
    tickAt(off, t);
    const p0 = off._aloneAt.get(post.id);
    assert.ok(p0 && Math.hypot(p0.x - p.x, p0.z - p.z) < 1e-9, `${k}: the post keeps their stand`);
    // shouted: those else at the gate turn to it
    const loudAt = Number.isFinite(w.loudFrom) ? (w.loudFrom + w.end) / 2 : null;
    if (loudAt == null) continue;
    tickAt(lt, loudAt);
    const mid = lt._stirAt.get(a.exit.key)?.mid;
    assert.ok(mid, `${k}: shouted at the gate`);
    for (const id of a.ids.filter((x) => x !== stranger.id)) {
      const r = lt.peopleOf(DAY).find((x) => x.id === id), wr = lt.where(r, loudAt, false);
      if (!wr || wr.moving || wr.pending || wr.e.kind !== 'gate') continue;
      assert.ok(Math.abs(turn(wr.yaw, Math.atan2(mid.x - wr.x, mid.z - wr.z))) < 1e-9, `${id}: turned to the shouting`);
      shouted++;
    }
  }
  assert.ok(shouted >= 1, `one of a party turned to it (${shouted})`);
  // a post whose watch ends within the halt keeps it for nobody, unless another keeps it through
  let cut = 0;
  for (const exit of lt.places.exits) {
    const posts = guards.flatMap((gd) => lt.planOf(gd, DAY).filter((e) => e.kind === 'post' && e.duty && e.at === exit));
    for (const p of posts) {
      for (let t = p.t1 - 5; t < p.t1; t += 0.25) {
        const h = gateHalt(exit.key, DAY, t, RATE);
        if (!h || t + h <= p.t1 || posts.some((q) => q.t0 <= t && q.t1 >= t + h)) continue;
        assert.equal(lt._gateHalt(exit, t, DAY), 0, `${exit.key} at ${t}: the post gone within the halt`);
        cut++;
      }
    }
  }
  assert.ok(cut > 0, `a halt its post would leave (${cut})`);
  assert.ok(vis.every((v) => !townOf(built, 9, vis).planOf(v.res, DAY).some((e) => e.kind === 'gate')), 'no post: nobody halted');
  const ship = townOf(built, 45, vis.map((v) => ({ ...v, dock: true })));
  assert.ok(vis.every((v) => !ship.planOf(v.res, DAY).some((e) => e.kind === 'gate')), 'off a ship: nobody halted');
});

test('LW-STIR the watch on its rounds: a stop of the watch\'s (on duty, `watch`) where a stranger stands - CHALLENGE_SHARE of the stops, the stop\'s own draw, the stranger the draw\'s of those there long enough - stops them: their answer by their humour that day (CHALLENGE_SCRIPTS), soon after they meet, whole in a round of the spot\'s, the one there first keeping their stand; the second of a pair never speaks for it, the town\'s own are never stopped, a stranger halted at a gate is the gate\'s, and a stranger once a day at a spot (mutants: the share, the second of the pair, the stranger, once a day, the round, the one there first)', () => {
  const T = H(11);
  const guard = (id, pair, t0 = T, t1 = T + 20) => stay(who(id, { job: 'guard', guard: true, name: 'Ser Pike' }), 'watch', t0, t1, { duty: true, pair });
  const stranger = stay(who('L999.t3', { town: 999, job: 'merchant', name: 'Bram Stoke' }), 'social', T - 30, T + 150);
  let n = 0, hits = 0, firstGuard = 0, twice = 0;
  for (let k = 0; k < 400; k++) {
    const key = `s${k}`;
    n++;
    const c = deal(key, [guard(`L${MAP}.w0`, 0), stranger]).find((x) => x.kind === 'challenge');
    if (!c) continue;
    hits++;
    assert.ok(c.members[0].id === `L${MAP}.w0` && c.members[1] === stranger.who);
    assert.equal(c.mood, humourOf(stranger.who, DAY));
    assert.ok(CHALLENGE_SCRIPTS[c.mood].includes(c.script));
    assert.ok(c.t0 >= T - 1e-9 && c.end <= T + 20 + 1e-9 && wholeRound(c), `${key}: in the stop, whole in a round`);
    assert.ok(c.t0 <= T + 5 + 1e-9 || Math.abs(c.t0 - spotRound(key, c.t0, ROUND).start - 1e-6) < 1e-5, `${key}: soon after they meet, else from the next round`);
    assert.equal(c.anchor, 1, 'the stranger there first keeps their stand');
    const later = deal(key, [guard(`L${MAP}.w0`, 0), { ...stranger, t0: T + 1 }]).find((x) => x.kind === 'challenge');
    if (later) { assert.equal(later.anchor, 0, 'the watch there first keeps theirs'); firstGuard++; }
    assert.deepEqual(deal(key, [guard(`L${MAP}.w4`, 1), stranger]).filter((x) => x.kind === 'challenge'), [], 'the second of a pair never speaks for it');
    assert.deepEqual(deal(key, [guard(`L${MAP}.w0`, 0), { ...stranger, who: { ...stranger.who, town: MAP } }]).filter((x) => x.kind === 'challenge'), [], 'one of the town');
    assert.deepEqual(deal(key, [guard(`L${MAP}.w0`, 0), { ...stranger, kind: 'gate' }]).filter((x) => x.kind === 'challenge'), [], 'one halted at a gate is the gate\'s');
    // two stops a stranger stands through, each its own draw: stopped once
    if (deal(key, [guard(`L${MAP}.w0`, 0, T + 60, T + 80), stranger]).some((x) => x.kind === 'challenge')) {
      twice++;
      assert.equal(deal(key, [guard(`L${MAP}.w0`, 0), guard(`L${MAP}.w0`, 0, T + 60, T + 80), stranger]).filter((x) => x.kind === 'challenge').length, 1, `${key}: once a day`);
    }
  }
  assert.ok(hits > n * 0.3 && hits < n * (CHALLENGE_SHARE + 0.07), `stopped at ${hits} of ${n} stops`);
  assert.ok(firstGuard > 20 && twice > 20, `the watch there first (${firstGuard}), two stops (${twice})`);
});

test('LW-STIR two of the town: one who stands at a spot with others of the town falls out with one of them, the draw\'s - QUARREL_SHARE of their stays there, QUARREL_EVENING times it from six between two who drink, so a busy spot\'s falling out grows with its people, not their pairs (dealt by the pair, an evening\'s spot of ten fell out three times in half an hour); a stranger, the watch and one at a stall or begging never; the watch on duty standing by through it steps in (BREAK_UP_LINES), the one who began it having the last word; one come to a spot with stalls haggles at one (HAGGLE_SHARE), at the stall; a beggar asks one standing near (PLEA_SHARE of each), from where they sit; one a day between the same two at a spot, one at a spot a round, whatever order the stays come in (mutants: the evening, the drinkers, the town\'s own, by the person, the watch stepping in, the haggle\'s, the plea\'s, once a day, a round)', () => {
  const span = (t0, list) => list.map((w) => stay(w, 'social', t0, t0 + 120));
  /** the quarrels a spot of `people` has from `t0`, over `spots` spots, a spot apiece */
  const quarrels = (t0, people, spots = 3000) => {
    let q = 0;
    for (let k = 0; k < spots; k++) q += deal(`c${k}`, span(t0, people(k))).filter((x) => x.kind === 'quarrel').length;
    return q / spots;
  };
  const two = (da, db) => (k) => [who(`L${MAP}.${k}a`, { drink: da }), who(`L${MAP}.${k}b`, { drink: db })];
  const byDay = quarrels(H(10), two(0.9, 0.9)), evening = quarrels(H(19), two(0.9, 0.9)), oneDrinks = quarrels(H(19), two(0.9, 0.3));
  const p = (s) => 1 - (1 - s) ** 2;   // either of the two falls out
  assert.ok(Math.abs(byDay - p(QUARREL_SHARE)) < 0.015, `by day: ${byDay}`);
  assert.ok(Math.abs(evening - p(QUARREL_SHARE * QUARREL_EVENING)) < 0.03, `an evening between two who drink: ${evening}`);
  assert.ok(Math.abs(oneDrinks - p(QUARREL_SHARE)) < 0.015, `one of them sober: ${oneDrinks}`);
  assert.ok(DRINKER > 0.3 && DRINKER < 0.9);
  const ten = quarrels(H(10), (k) => Array.from({ length: 10 }, (_, i) => who(`L${MAP}.${k}x${i}`)), 1000);
  assert.ok(ten / byDay > 3 && ten / byDay < 7, `ten at a spot fall out ${(ten / byDay).toFixed(1)} times as two do (by the pair, 45 times)`);
  // a stranger, the watch, one at a stall or begging: never
  for (const [what, other] of [['a stranger', { town: 999 }], ['the watch off duty', { guard: true, job: 'guard' }]]) {
    assert.equal(quarrels(H(19), (k) => [who(`L${MAP}.${k}a`, { drink: 0.9 }), who(`L${MAP}.${k}b`, { drink: 0.9, ...other })], 1500), 0, what);
  }
  let worked = 0;
  for (let k = 0; k < 1500; k++) worked += deal(`w${k}`, [stay(who(`L${MAP}.${k}a`, { drink: 0.9 }), 'social', H(19), H(21)), stay(who(`L${MAP}.${k}b`, { drink: 0.9 }), k % 2 ? 'stall' : 'beg', H(8), H(22))]).filter((x) => x.kind === 'quarrel').length;
  assert.equal(worked, 0, 'one working a stall or begging');
  // the watch standing by steps in, the one who began it having the last word; gone before the end, it does not
  let broken = 0;
  for (let k = 0; k < 3000 && broken < 25; k++) {
    const pair = span(H(10), two(0.2, 0.2)(k));
    const q = deal(`c${k}`, pair).find((x) => x.kind === 'quarrel');
    if (!q) continue;
    assert.ok(QUARREL_SCRIPTS.includes(q.script) && q.guard === null && wholeRound(q));
    assert.ok(pair.some((s) => s.who === q.members[0]) && pair.some((s) => s.who === q.members[1]) && q.members[0] !== q.members[1]);
    const w = who(`L${MAP}.w1`, { job: 'guard', guard: true, name: 'Ser Pike' });
    const by = deal(`c${k}`, [...pair, stay(w, 'watch', H(10), H(12), { duty: true, pair: 0 })]).find((x) => x.kind === 'quarrel');
    if (!by) continue;   // with the watch's words too it ran past its round and the stays: none
    assert.ok(by.guard === w && BREAK_UP_LINES.some((b) => by.script.length === q.script.length + b.length && b.every((l, i) => by.script[q.script.length + i] === l)), `c${k}: the watch's words after the grievance's`);
    assert.ok(by.script[q.script.length].by === 'g' && by.script[q.script.length].loud && by.script[by.script.length - 1].by === 'a');
    const short = deal(`c${k}`, [...pair, stay(w, 'watch', H(10), q.end + LINE, { duty: true, pair: 0 })]).find((x) => x.kind === 'quarrel');
    assert.ok(short && short.guard === null && short.script === q.script, `c${k}: gone before it would end, the watch keeps out`);
    broken++;
  }
  assert.ok(broken >= 25, `the watch stepped in (${broken})`);
  // a haggle: one come to a spot with stalls, at one of them; two stalls, none
  let haggles = 0;
  for (let k = 0; k < 2000; k++) {
    const keeper = stay(who(`L${MAP}.${k}k`, { job: 'merchant' }), 'stall', H(8), H(18)), buyer = stay(who(`L${MAP}.${k}b`), 'market', H(10), H(11));
    const x = deal(`m${k}`, [keeper, buyer]).filter((i) => i.kind === 'haggle');
    if (!x.length) continue;
    haggles++;
    assert.ok(x[0].members[0] === buyer.who && x[0].members[1] === keeper.who && x[0].anchor === 1 && HAGGLE_SCRIPTS.includes(x[0].script), 'the buyer comes to the stall');
  }
  assert.ok(Math.abs(haggles / 2000 - HAGGLE_SHARE) < 0.03, `haggled ${haggles} of 2000`);
  for (let k = 0; k < 300; k++) assert.deepEqual(deal(`m${k}`, [stay(who(`L${MAP}.${k}k`), 'stall', H(8), H(18)), stay(who(`L${MAP}.${k}l`), 'stall', H(8), H(18))]), []);
  // a plea: a beggar asks one standing near, from where they sit; two beggars, none
  let pleas = 0;
  for (let k = 0; k < 2000; k++) {
    const beggar = stay(who(`L${MAP}.${k}g`, { job: 'beggar' }), 'beg', H(8), H(18)), passer = stay(who(`L${MAP}.${k}p`, { town: k % 2 ? MAP : 999 }), 'social', H(10), H(11));
    const x = deal(`b${k}`, [beggar, passer]).filter((i) => i.kind === 'plea');
    if (!x.length) continue;
    pleas++;
    assert.ok(x[0].members[0] === beggar.who && x[0].members[1] === passer.who && x[0].anchor === 0 && PLEA_SCRIPTS.includes(x[0].script));
  }
  assert.ok(Math.abs(pleas / 2000 - PLEA_SHARE) < 0.025, `asked ${pleas} of 2000`);
  for (let k = 0; k < 300; k++) assert.deepEqual(deal(`b${k}`, [stay(who(`L${MAP}.${k}g`), 'beg', H(8), H(18)), stay(who(`L${MAP}.${k}h`), 'beg', H(8), H(18))]), []);
  // once a day between the same two at a spot (the morning's and the evening's stays), one at a spot a round, any order
  let busy = 0;
  for (let k = 0; k < 400; k++) {
    const a = who(`L${MAP}.${k}a`, { drink: 0.9 }), b = who(`L${MAP}.${k}b`, { drink: 0.9 }), c = who(`L${MAP}.${k}c`, { drink: 0.9 });
    const stays = [stay(a, 'social', H(10), H(12)), stay(b, 'social', H(10), H(12)), stay(a, 'social', H(19), H(21)), stay(b, 'social', H(19), H(21)), stay(c, 'social', H(19), H(21)), stay(who(`L${MAP}.${k}k`), 'stall', H(8), H(22))];
    const got = deal(`d${k}`, stays);
    const ab = got.filter((x) => stirHas(x, new Set([a.id])) && stirHas(x, new Set([b.id])));
    assert.ok(ab.length <= 1, `d${k}: once a day between the same two`);
    assert.equal(new Set(got.map((x) => x.round)).size, got.length, `d${k}: one a round`);
    assert.ok(got.every(wholeRound));
    assert.deepEqual(deal(`d${k}`, [...stays].reverse()), got, `d${k}: whatever order`);
    if (got.length >= 3) busy++;
  }
  assert.ok(busy >= 3, `a busy day at a spot (${busy})`);
  // two who would fall out in the morning and again in the evening, each dealt alone: once
  let once = 0;
  for (let k = 0; k < 3000 && once < 10; k++) {
    const a = who(`L${MAP}.${k}a`, { drink: 0.9 }), b = who(`L${MAP}.${k}b`, { drink: 0.9 });
    const morning = [stay(a, 'social', H(10), H(12)), stay(b, 'social', H(10), H(12))], evening = [stay(a, 'social', H(19), H(21)), stay(b, 'social', H(19), H(21))];
    if (!deal(`o${k}`, morning).length || !deal(`o${k}`, evening).length) continue;
    assert.equal(deal(`o${k}`, [...morning, ...evening]).length, 1, `o${k}: once a day`);
    once++;
  }
  assert.ok(once >= 10, `two who would fall out twice (${once})`);
});

test('LW-STIR the humour and the words: a stranger\'s humour is theirs that day - civil, curt or hostile by HUMOURS, a sellsword\'s and a sailor\'s rougher - the same on every read; an incident\'s line every LINE from its first, each by its part (a and b its two, g the watch stepping in), the town, the place and their first names filled, none before its first or after its last; shouted from its first shouted line to its end (stirLoud) (mutants: the humour\'s table, the parts, the line\'s time, the shouting)', () => {
  for (const [jobs, table] of [[['merchant', 'pedlar', 'pilgrim'], HUMOURS.stranger], [['mercenary', 'sailor'], HUMOURS.rough]]) {
    const count = { civil: 0, curt: 0, hostile: 0 };
    for (let i = 0; i < 6000; i++) count[humourOf(who(`L999.t${i}`, { job: jobs[i % jobs.length], town: 999 }), DAY + (i % 7))]++;
    for (const [mood, share] of table) assert.ok(Math.abs(count[mood] / 6000 - share) < 0.025, `${jobs[0]}: ${mood} ${count[mood]}`);
  }
  assert.ok(HUMOURS.rough.find(([m]) => m === 'hostile')[1] > HUMOURS.stranger.find(([m]) => m === 'hostile')[1], 'a sellsword rougher');
  const one = who('L999.t7', { town: 999, job: 'merchant' });
  assert.equal(humourOf(one, DAY), humourOf({ ...one }, DAY), 'the same on every read');
  assert.ok(new Set(Array.from({ length: 30 }, (_, d) => humourOf(one, DAY + d))).size > 1, 'another day, another humour');
  // the words, by their parts and the clock
  const guard = who(`L${MAP}.w2`, { job: 'guard', guard: true, name: 'Hal Ward' }), a = who(`L${MAP}.5`, { name: 'Ada Wren' }), b = who(`L${MAP}.6`, { name: 'Bram Stoke' });
  const script = [...QUARREL_SCRIPTS[0], ...BREAK_UP_LINES[0]];
  const inc = { kind: 'quarrel', spot: 'sq', members: [a, b], anchor: 0, guard, mood: null, script, seed: 7, round: 0, t0: H(10), from: H(10) + GATHER, end: H(10) + GATHER + script.length * LINE + AFTER, loudFrom: H(10) + GATHER + script.findIndex((l) => l.loud) * LINE };
  const ctx = { town: 'Ripmarket', region: 'Wayrest', places: ['Daggerfall'] };
  assert.equal(stirLine(inc, inc.from - 1e-6, LINE, ctx), null, 'none before its first');
  assert.equal(stirLine(inc, inc.from + script.length * LINE + 1e-6, LINE, ctx), null, 'none after its last');
  for (const [i, l] of script.entries()) {
    const said = stirLine(inc, inc.from + (i + 0.5) * LINE, LINE, ctx);
    assert.equal(said.index, i);
    assert.equal(said.who, l.by === 'a' ? a : l.by === 'b' ? b : guard, `line ${i}: by its part`);
    assert.equal(said.loud, l.loud);
    assert.equal(said.text, fillLine(l.text, { town: 'Ripmarket', region: 'Wayrest', place: 'Daggerfall', a: 'Ada', b: 'Bram' }));
    assert.ok(!said.text.includes('{'), `line ${i}: filled`);
  }
  assert.ok(stirLine(inc, inc.from + 0.5 * LINE, LINE, ctx).text.includes('Bram'), 'their first names');
  assert.ok(!stirLoud(inc, inc.loudFrom - 1e-6) && stirLoud(inc, inc.loudFrom) && stirLoud(inc, inc.end - 1e-6) && !stirLoud(inc, inc.end), 'shouted from its first shout to its end');
  assert.ok(Object.values(GATE_SCRIPTS.hostile).every((s) => s.some((l) => l.loud)) && [...GATE_SCRIPTS.civil, ...CHALLENGE_SCRIPTS.civil].every((s) => s.every((l) => !l.loud)), 'the hostile shout, the civil never');
  assert.ok(stirHas(inc, new Set([guard.id])) && stirHas(inc, new Set([b.id])) && !stirHas(inc, new Set(['L1.1'])));
});

test('LW-STIR the small voices: the night watch on duty calls the hour (WATCH_HOURS, nine at night to five) CALL_SHARE of the hours, within CALL_SPREAD_MIN of it, by the weather (WATCH_CALLS), never by day nor off duty; a stall cries its wares by day (eight to six), a beggar calls, one who drinks deep (SONG_DRINK) sings on a walk from a tavern\'s door late (nine to three) - each now and then, on their own draws of the clock, a word up VOICE_S; nobody else (mutants: the hours, the duty, the stall\'s day, the song\'s drink, the tavern, the night)', () => {
  const up = VOICE_S * RATE;
  const guard = who(`L${MAP}.w3`, { job: 'guard', guard: true });
  const said = (w, e, t0, t1, step = 0.05, ctx = { town: 'Ripmarket', weather: null }, tav = () => false) => {
    const out = [];
    let was = null;
    for (let t = t0; t < t1; t += step) {
      const v = smallVoice(w, e, t, RATE, ctx, tav);
      if (v && v.text !== was) out.push({ t, ...v });
      was = v?.text ?? null;
    }
    return out;
  };
  // the night watch calls the hour
  const night = said(guard, { kind: 'post', duty: true }, H(6), H(30), 0.05);
  const byHour = new Map();
  for (const v of night) {
    const hour = Math.floor(((v.t % DAY_MIN) + DAY_MIN) % DAY_MIN / 60);
    assert.ok(hour in WATCH_HOURS, `called at ${hour}: the night's hours`);
    assert.ok(v.t % 60 < CALL_SPREAD_MIN + up, 'within CALL_SPREAD_MIN of the hour');
    assert.ok(v.kind === 'shout' && v.text.startsWith(WATCH_HOURS[hour]) && WATCH_CALLS.fair.some((c) => fillLine(c, { town: 'Ripmarket', hour: WATCH_HOURS[hour] }) === v.text), `${hour}: the hour, fair`);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  let calls = 0, hours = 0;
  for (let k = 0; k < 400; k++) {
    const g = who(`L${MAP}.w${k}`, { job: 'guard', guard: true });
    for (const hh of [21, 23, 26, 28]) { hours++; if (said(g, { kind: 'watch', duty: true }, H(hh), H(hh) + 10, 0.1).length) calls++; }
  }
  assert.ok(Math.abs(calls / hours - CALL_SHARE) < 0.05, `called ${calls} of ${hours} hours`);
  const rain = said(guard, { kind: 'post', duty: true }, H(21), H(30), 0.05, { town: 'Ripmarket', weather: 'rain' });
  assert.ok(rain.length && rain.every((v) => WATCH_CALLS.rain.some((c) => fillLine(c, { town: 'Ripmarket', hour: v.text.split(',')[0] }) === v.text || v.text.includes(c.split('{hour}').pop().slice(0, 8)))), 'by the weather');
  assert.equal(said(guard, { kind: 'post', duty: false }, H(21), H(30)).length, 0, 'off duty: none');
  assert.equal(said(guard, { kind: 'social', duty: true }, H(21), H(30)).length, 0, 'nor about another business');
  // a stall's cry by day, a beggar's call; each up VOICE_S
  const keeper = who(`L${MAP}.40`, { job: 'merchant' });
  const cries = said(keeper, { kind: 'stall' }, H(6), H(21), 0.02);
  assert.ok(cries.length > 10 && cries.every((v) => v.t >= H(8) && v.t < H(18) && v.kind === 'shout' && STALL_CRIES.some((c) => fillLine(c, { town: 'Ripmarket' }) === v.text || c.includes('{place}'))), 'a stall cries by day');
  const beggar = who(`L${MAP}.41`, { job: 'beggar' });
  const calls2 = said(beggar, { kind: 'beg' }, H(8), H(20), 0.02);
  assert.ok(calls2.length > 10 && calls2.every((v) => v.kind === 'shout' && BEGGAR_CRIES.some((c) => fillLine(c, { town: 'Ripmarket' }) === v.text || c.includes('{place}'))), 'a beggar calls');
  for (const v of cries.slice(0, 5)) assert.ok(smallVoice(keeper, { kind: 'stall' }, v.t + up - 0.03, RATE, { town: 'Ripmarket' }) && !smallVoice(keeper, { kind: 'stall' }, v.t + up + 0.03, RATE, { town: 'Ripmarket' }), 'up VOICE_S');
  // a drinker's song on the way home from the tavern, late
  const tavern = { kind: 'door', building: 7 }, tav = (e) => e.from === tavern;
  let songs = 0;
  for (let k = 0; k < 60; k++) {
    const deep = who(`L${MAP}.${k}`, { drink: 0.95 });
    const sung = said(deep, { kind: 'walk', from: tavern }, H(20), H(28), 0.05, { town: 'Ripmarket' }, tav);
    songs += sung.length;
    assert.ok(sung.every((v) => v.kind === 'sing' && DRINKING_SONGS.some((s) => fillLine(s, { town: 'Ripmarket' }) === v.text || s.includes('{')) && (((v.t % DAY_MIN) + DAY_MIN) % DAY_MIN >= 21 * 60 || ((v.t % DAY_MIN) + DAY_MIN) % DAY_MIN < 3 * 60)), 'late, a song');
    assert.equal(said(who(`L${MAP}.${k}`, { drink: SONG_DRINK - 0.01 }), { kind: 'walk', from: tavern }, H(20), H(28), 0.05, {}, tav).length, 0, 'one who drinks less: none');
    assert.equal(said(deep, { kind: 'walk', from: { kind: 'door', building: 8 } }, H(20), H(28), 0.05, {}, tav).length, 0, 'not from the tavern: none');
  }
  assert.ok(songs > 30, `sung on the way home (${songs})`);
  assert.equal(said(who(`L${MAP}.1`, { drink: 0.95 }), { kind: 'social' }, H(6), H(30), 0.1).length, 0, 'about other business, nobody');
  assert.equal(smallVoice(guard, null, H(22), RATE), null);
});

test('LW-STIR on the street: an incident takes its two out of the round\'s circles and stands them the round through - the one who comes before the one who keeps their stand, FACE_M off, turned to each other (meetups.js aloneStands `beside`, besideStand), every place SPACE_M from every other; said aloud only while both stand on this street, each line by its speaker, shouted a shout; while it is shouted the spot\'s circles hush and its others turn to look; the watch steps in by its own voice (mutants: the circles kept, the stand before, the hush, the turn, the shout, the both standing)', () => {
  const built = synthTown();
  const lt = townOf(built, 9);
  tickAt(lt, H(12));
  const ctx = lt.lineCtx(H(12));
  let hushed = 0, turned = 0, said = 0, checked = 0;
  for (const [key, list] of lt._stirDays.get(DAY).by) {
    for (const inc of list) {
      // in its loud part where it has one, else its middle
      const t = Number.isFinite(inc.loudFrom) ? inc.loudFrom + 0.5 * LINE : (inc.from + inc.end) / 2;
      tickAt(lt, t);
      const [a, b] = inc.members;
      const pa = lt._aloneAt.get(a.id), pb = lt._aloneAt.get(b.id);
      if (!(pa?.spot.key === key && pb?.spot.key === key)) continue;
      checked++;
      assert.ok(!lt._inCircle.has(a.id) && !lt._inCircle.has(b.id), `${key}: out of the circles`);
      assert.ok(lt._inStir.get(a.id)?.inc === inc && lt._inStir.get(b.id)?.inc === inc && lt._inStir.get(a.id).keeps === inc.members[inc.anchor].id);
      assert.ok(Math.abs(Math.hypot(pa.x - pb.x, pa.z - pb.z) - FACE_M) < 1e-6, `${key}: FACE_M apart`);
      const others = [...lt._inCircle.values()].filter((c) => c.spot.key === key).map((c) => c.place).concat([...lt._aloneAt.values()].filter((s) => s.spot.key === key && s !== pa && s !== pb));
      for (const q of others) for (const p of [pa, pb]) assert.ok(Math.hypot(q.x - p.x, q.z - p.z) >= SPACE_M - 1e-6, `${key}: SPACE_M from the rest`);
      // said aloud: the line of the moment, by its speaker, while both stand
      const line = stirLine(inc, t, LINE, ctx);
      const ids = [...new Set([a.id, b.id, ...[...lt._inCircle].filter(([, c]) => c.spot.key === key).map(([id]) => id), ...[...lt._aloneAt].filter(([, s]) => s.spot.key === key).map(([id]) => id)])];
      const out = sayWith(lt, rowsOf(lt, ids), [pa.x, 1.6, pa.z], 50);
      const mine = out.filter((o) => o.person.living.id === a.id || o.person.living.id === b.id);
      if (line && line.who !== inc.guard) {
        assert.equal(mine.length, 1, `${key}: one line of theirs`);
        assert.ok(mine[0].person.living.id === line.who.id && mine[0].text === line.text && mine[0].kind === (line.loud ? 'shout' : 'talk'), `${key}: by its speaker, ${line.loud ? 'shouted' : 'said'}`);
        said++;
        assert.equal(sayWith(lt, rowsOf(lt, ids, new Set([line.who.id === a.id ? b.id : a.id])), [pa.x, 1.6, pa.z], 50).filter((o) => o.person.living.id === a.id || o.person.living.id === b.id).length, 0, `${key}: not while the other walks`);
      }
      if (!stirLoud(inc, t)) continue;
      // shouted: the spot's circles hush - a line its circle has this moment goes unsaid - and its others turn to look
      const mid = lt._stirAt.get(key)?.mid;
      assert.ok(mid && Math.abs(mid.x - (pa.x + pb.x) / 2) < 1e-9 && Math.abs(mid.z - (pa.z + pb.z) / 2) < 1e-9, `${key}: the shouting's middle`);
      for (const [id, c] of lt._inCircle) {
        if (c.spot.key !== key) continue;
        const cl = circleLine(c.circle, t, LINE, ctx, lt._scripts);
        if (cl && cl.who.id === id) { assert.ok(!out.some((o) => o.person.living.id === id), `${id}: hushed`); hushed++; }
      }
      for (const [id, s] of lt._aloneAt) {
        if (s.spot.key !== key || id === a.id || id === b.id) continue;
        const r = lt.peopleOf(DAY).find((x) => x.id === id), w = lt.where(r, t, false);
        if (!w || w.moving || w.pending || w.e.kind === 'post') continue;   // on their way, or keeping the road
        assert.ok(Math.abs(turn(w.yaw, Math.atan2(mid.x - w.x, mid.z - w.z))) < 1e-9, `${id}: turned to look`);
        turned++;
      }
    }
  }
  assert.ok(checked >= 12 && said >= 10 && hushed >= 1 && turned >= 5, `stood ${checked}, said ${said}, hushed ${hushed}, turned ${turned}`);
  // a circle one of an incident was dealt into gathers without them: its talk waits for none of the two (the same town
  // with no incident: their walk to the circle's place waited for)
  const off = townOf(built, 9);
  off._stirOf = () => ({ by: new Map(), spots: new Map() });
  let lost = 0, sooner = 0;
  for (const list of lt._stirDays.get(DAY).by.values()) {
    for (const inc of list) {
      const t = inc.from;
      tickAt(lt, t); tickAt(off, t);
      for (const [id, c] of off._inCircle) {
        if (!inc.members.some((m) => m.id === id)) continue;
        const kept = [...lt._inCircle.values()].find((x) => x.circle.seed === c.circle.seed)?.circle;
        if (!kept) continue;   // a circle of two the incident took one of: left alone, no circle
        lost++;
        assert.ok(kept.from <= c.circle.from + 1e-9 && !kept.members.some((m) => inc.members.includes(m)), `${id}'s circle: without them`);
        if (kept.from < c.circle.from - 1e-9) sooner++;
      }
    }
  }
  assert.ok(lost >= 3 && sooner >= 1, `circles an incident took one of (${lost}), talking sooner for it (${sooner})`);
  // the watch steps in by its own voice: a quarrel with the watch standing by, at its break-up line
  const g = who(`L${MAP}.w1`, { job: 'guard', guard: true, name: 'Ser Pike' }), x = who(`L${MAP}.3`, { name: 'Ada Wren' }), y = who(`L${MAP}.4`, { name: 'Bram Stoke' });
  const script = [...QUARREL_SCRIPTS[1], ...BREAK_UP_LINES[2]];
  const inc = { kind: 'quarrel', spot: 'sq', members: [x, y], anchor: 1, guard: g, mood: null, script, seed: 9, round: 0, t0: H(10), from: H(10) + GATHER, end: H(10) + GATHER + script.length * LINE + AFTER, loudFrom: H(10) + GATHER + 2 * LINE };
  const at = inc.from + (QUARREL_SCRIPTS[1].length + 0.5) * LINE;
  assert.equal(stirLine(inc, at, LINE, ctx).who, g);
  assert.match(rd('src/systems/livingWorld/livingTown.js'), /if \(inc\.guard && !absent\.has\(inc\.guard\.id\)\) this\._stirVoice\.set\(inc\.guard\.id, inc\);/, 'the watch\'s voice, while it is on this street');
  assert.match(rd('src/systems/livingWorld/livingTown.js'), /const inc = own \?\? this\._stirVoice\.get\(id\) \?\? null;/, 'heard by its own row');
});

test('LW-STIR the places before (meetups.js besideStand, aloneStands `beside`): the one who comes stands FACE_M before the one who keeps their stand - the way they face, else a step of arc about them - SPACE_M from every place taken, on the street with nothing between; laid at their own turn, or just after the one they come to where that one comes after them; the rest laid as they were, none on another (mutants: the way they face, the arc, the turn, the wait)', () => {
  const built = synthTown();
  const lt = townOf(built, 9);
  const street = lt._street, spot = lt.places.square;
  const ids = Array.from({ length: 14 }, (_, i) => `L${MAP}.${i}`);
  const plain = aloneStands(spot, ids, [], street);
  assert.equal(FACE_M, CIRCLE_APART);
  for (const [v, k] of [[ids[9], ids[2]], [ids[1], ids[6]]]) {
    const got = aloneStands(spot, ids, [], street, new Map([[v, k]]));
    const pk = got.get(k), pv = got.get(v);
    assert.ok(Math.abs(Math.hypot(pk.x - pv.x, pk.z - pv.z) - FACE_M) < 1e-6, `${v} before ${k}`);
    assert.ok(Math.abs(turn(pv.yaw, Math.atan2(pk.x - pv.x, pk.z - pv.z))) < 1e-9, `${v}: facing them`);
    assert.ok(street.holds(pv.x, pv.z) && street.clear(pk.x, pk.z, pv.x, pv.z), `${v}: on the street, nothing between`);
    const all = [...got.values()];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) >= SPACE_M - 1e-6, 'none on another');
    // those laid before the one who comes keep their places
    const before = ids.slice(0, Math.min(ids.indexOf(v), ids.indexOf(k) + 1));
    for (const id of before) assert.deepEqual(got.get(id), plain.get(id), `${id}: as they were`);
  }
  // the way they face first: before them, on their own bearing to the spot, where it is free
  const by = { x: spot.x + 3, z: spot.z, yaw: Math.atan2(-3, 0) };
  const free = () => true;
  const p = besideStand(spot, by, free, street);
  assert.ok(p && Math.abs(p.x - (by.x + Math.sin(by.yaw) * FACE_M)) < 1e-9 && Math.abs(p.z - (by.z + Math.cos(by.yaw) * FACE_M)) < 1e-9, 'the way they face');
  const q = besideStand(spot, by, (x, z) => Math.hypot(x - p.x, z - p.z) >= SPACE_M, street);
  assert.ok(q && Math.abs(Math.hypot(q.x - by.x, q.z - by.z) - FACE_M) < 1e-9 && Math.hypot(q.x - p.x, q.z - p.z) >= SPACE_M - 1e-9, 'taken: a step of arc about them');
  assert.equal(besideStand(spot, by, () => false, street), null, 'none free: none');
});

test('LW-STIR every reader alike: two readers of a town - one stood through the morning beat by beat, one come at noon - deal the same day\'s incidents at every spot, stand the same two together at the same places, shout at the same spots and say the same words (nothing sent: the plans, the seeds and the clock) (mutants: a reader\'s own street in the deal)', () => {
  const built = synthTown();
  const vis = visitorsOf(12);
  const a = townOf(built, 45, vis), b = townOf(built, 45, vis);
  for (let t = H(6); t < H(13); t += 7) tickAt(a, t);
  const flat = (lt) => [...lt._stirDays.get(DAY).by].map(([k, l]) => [k, l.map((x) => [x.kind, x.members.map((m) => m.id), x.anchor, x.guard?.id ?? null, x.mood, x.t0, x.end, x.script.map((s) => s.text)])]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
  let shouts = 0, lines = 0;
  for (let t = H(13); t < H(19); t += 0.37) {
    tickAt(a, t); tickAt(b, t);
    if (t === H(13)) assert.deepEqual(flat(a), flat(b), 'the day\'s incidents');
    const stir = (lt) => [...lt._inStir].map(([id, x]) => [id, x.other, x.keeps, lt._aloneAt.get(id) ? [lt._aloneAt.get(id).x, lt._aloneAt.get(id).z] : null]).sort();
    assert.deepEqual(stir(a), stir(b), `${t}: the same two, the same places`);
    assert.deepEqual([...a._stirAt.keys()].sort(), [...b._stirAt.keys()].sort(), `${t}: shouted at the same spots`);
    shouts += a._stirAt.size;
    const ids = [...a._inStir.keys()];
    if (!ids.length) continue;
    const said = (lt) => sayWith(lt, rowsOf(lt, ids), [0, 0, 0], 1e6).filter((o) => lt._inStir.has(o.person.living.id)).map((o) => [o.person.living.id, o.text, o.kind]).sort();
    const sa = said(a);
    assert.deepEqual(sa, said(b), `${t}: the same words`);
    lines += sa.length;
  }
  assert.ok(shouts > 5 && lines > 40, `shouted ${shouts}, said ${lines}`);
});

test('LW-STIR the host: the street\'s words reach the one layer as they are said - a shout a shout, a song a song (world.js livingLinePoints: the kind passed through; ui/navalHud.js draws each its own way); a room\'s talk is talk (FLAGGED: no incident indoors yet)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /name: livingRelations\.known\(id\) \? firstNameOf\(l\.person\.nameNPC\) : null, who: key, kind: l\.kind \?\? 'talk', distance: d \}\);   \/\/ LW-STIR: a shout, a song/);
  assert.match(rd('src/ui/navalHud.js'), /\.dfnaval-say\.sing \{/);
  assert.match(rd('src/ui/navalHud.js'), /\.dfnaval-say\.shout \{/);
  assert.match(w, /points\.push\(\{ x: at\.x, y: at\.y, text: l\.text, who: key, kind: 'talk', distance: d, name: livingRelations\.known\(id\) \? firstNameOf\(l\.person\.nameNPC\) : null \}\);/, 'a room\'s talk');
  assert.equal(BUILDING_TYPES.Tavern, 15);
});

test('LW-STIR the game\'s own cities (ARENA2): Daggerfall, Wayrest and Ripmarket, a day of strangers in at their four gates - every arrival halted at a kept gate has its word in its round, by the post keeping it; the strangers\' humours by HUMOURS; every incident whole in its round, one at a spot a round, its two FACE_M apart in the middle of it', { skip: skipReal }, () => {
  const all = cities();
  for (const name of ['Daggerfall', 'Wayrest', 'Ripmarket']) {
    const h = hostTown(/** @type {any} */ (all.find((c) => c.name === name)));
    const vis = visitorsOf(16);
    const lt = new LivingTown(h.nav, { town: h.town, buildings: h.buildings, doors: h.doors, makePerson: () => null, suppressSpawns: () => true, clock: () => H(12), rate: () => RATE, mpm: MPM, tripsOf: () => ({ away: new Map(), visitors: vis, holders: null, news: null }) });
    tickAt(lt, H(12));
    const by = lt._stirDays.get(DAY).by;
    let halts = 0, words = 0, apart = 0;
    for (const v of vis) {
      const g = lt.planOf(v.res, DAY).find((e) => e.kind === 'gate');
      if (!g) continue;
      halts++;
      const round = spotRound(g.at.key, g.t1 - 1e-9, ROUND).round;
      const w = (by.get(g.at.key) ?? []).find((x) => x.round === round);
      assert.ok(w?.kind === 'gate', `${name} ${v.res.id}: its word`);
      assert.ok(lt.planOf(w.members[0], DAY).some((e) => e.kind === 'post' && e.duty && e.at === g.at && e.t0 <= w.t0 && e.t1 >= w.end), `${name}: by the post`);
    }
    for (const [key, list] of by) {
      assert.equal(new Set(list.map((x) => x.round)).size, list.length, `${name} ${key}: one a round`);
      for (const inc of list) {
        assert.ok(wholeRound(inc), `${name} ${key}: whole in its round`);
        words++;
        tickAt(lt, (inc.from + inc.end) / 2);
        const pa = lt._aloneAt.get(inc.members[0].id), pb = lt._aloneAt.get(inc.members[1].id);
        if (pa?.spot.key === key && pb?.spot.key === key) { assert.ok(Math.abs(Math.hypot(pa.x - pb.x, pa.z - pb.z) - FACE_M) < 1e-6, `${name} ${key}: FACE_M apart`); apart++; }
      }
    }
    assert.ok(halts >= 4 && words >= 15 && apart >= words * 0.8, `${name}: halted ${halts}, ${words} incidents, ${apart} stood apart`);
  }
});
