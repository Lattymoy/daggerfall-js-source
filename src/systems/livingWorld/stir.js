// @ts-check
// LW-STIR (2026-10-08, bible/06-Systems/Living-World.md "LW-STIR"; Mac: "I say we improve the living world and go deeper.
// Having spontaneous interactions, like a traveller being hostile with a guard and other smaller details that make the
// world feel more alive"): THE STREET STIRS. Now and then two at one spot are more than a talking circle: the watch at a
// gate questions a stranger come in by it (halted there: `gateHalt`), and on its rounds stops one standing where it
// stops, and the stranger answers as their humour has them that day - civil, curt, or hostile, the hostile shouting
// back; two of the town fall out over a cart wheel or a goat, and the watch standing by breaks it up; a buyer haggles at
// a stall; a beggar asks a coin of one standing near. While words are shouted the spot falls quiet and turns to look.
// And the street has its small voices: the night watch calling the hour, a stall crying its wares, a beggar's call, a
// drinker's song on the way home from the tavern.
//
// EVERY READER ALIKE, as the town's talk is (meetups.js): an incident is dealt from the day's plans - the stays at a
// spot, their minutes, the spot's key, the day and the people's ids - never from what one reader's street shows; a
// small voice from the plan entry its resident is in and the clock. Nothing is sent.
import { lwSeed, textSeed } from './seed.js';
import { ROUND_S, spotRound, lineMinutes } from './meetups.js';
import { TAVERN_DRINK } from './dayPlan.js';
import {
  GATE_SCRIPTS,
  CHALLENGE_SCRIPTS,
  QUARREL_SCRIPTS,
  BREAK_UP_LINES,
  HAGGLE_SCRIPTS,
  PLEA_SCRIPTS,
  WATCH_HOURS,
  WATCH_CALLS,
  STALL_CRIES,
  BEGGAR_CRIES,
  DRINKING_SONGS,
  fillLine,
  firstNameOf,
  watchWords,
  morningWatchWords,
  watchBuys,
  moveAlong,
  beggarWords,
  theDivines,
  cutpurseScripts,
  chaseLines,
  gotAwayLines,
  diceScripts,
  sermonScripts,
  flirtScripts,
  newsCries,
} from './lines.js';

/** How long the two of an incident take to come together before its first line, and stand so after its last (real
 *  seconds - the clock's minutes by its rate, as the talk's lines are). */
export const STIR_GATHER_S = 4;
export const STIR_AFTER_S = 3;
/** The share of the strangers come in at a gate the watch keeps that it halts there (a party together); of the watch's
 *  stops a stranger stands at that the watch stops them; of one of the town's stays at a spot that they fall out with
 *  another there (QUARREL_EVENING times it of an evening between two who drink); of one's stays at a spot with stalls
 *  that they haggle at one; of each standing near a beggar that the beggar asks them. */
export const GATE_SHARE = 0.6;
export const CHALLENGE_SHARE = 0.5;
export const QUARREL_SHARE = 0.03;
export const QUARREL_EVENING = 4;
export const HAGGLE_SHARE = 0.2;
export const PLEA_SHARE = 0.1;
/** The gate's longest word (GATE_SCRIPTS), its lines - a stranger halted there stands for it. */
export const GATE_LINES = Math.max(
  ...Object.values(GATE_SCRIPTS)
    .flat()
    .map((x) => x.length),
);
/** Who drinks, for an evening's quarrel and a song on the way home (a resident's `drink`): dayPlan.js's own, who goes to
 *  the tavern of an evening (AUDIT LW-STIR D2: a second literal of it, tied to nothing). */
export const DRINKER = TAVERN_DRINK;
export const SONG_DRINK = 0.8;
/** WATCH-LIFE (the owner: "Guards should have a more Living world presence and NPC interaction"): of the watch's stops on
 *  its rounds where one of the town stands, the share where it has a word with them (none where it stopped a stranger).
 *  LW-ANTICS ("more activities, more shenanigans"): CUTPURSE_HANDS of the town's beggars and labourers are light of
 *  finger, and CUTPURSE_SHARE of their stays by day at a spot of CUTPURSE_CROWD or more end in a purse lifted; of one's
 *  evening stays with another of the town, DICE_SHARE at dice and FLIRT_SHARE a warmer word; of a priest's stays at their
 *  temple's door with one there, SERMON_SHARE a sermon. */
export const WATCH_WORD_SHARE = 0.45;
export const CUTPURSE_HANDS = 0.15;
export const CUTPURSE_SHARE = 0.35;
export const CUTPURSE_CROWD = 4;
export const DICE_SHARE = 0.05;
export const FLIRT_SHARE = 0.02;
export const SERMON_SHARE = 0.8;
/** LW-ANTICS: the newer kinds - laid after the first five, so a round keeps the incident it always had. */
export const ANTIC_KINDS = Object.freeze(['watchword', 'cutpurse', 'dice', 'sermon', 'flirt']);
/** LW-ANTICS: a cutpurse runs CHASE_M from their stand from the first shout; the watch catches them CAUGHT_M behind. */
export const CHASE_M = 12;
export const CAUGHT_M = 1;
const LIGHT = new Set(['beggar', 'labourer']);
/** AUDIT LW-ANTICS B10: the stalls that sell a bite - a labourer's or a courier's stint is no stall of food. */
export const FOOD_SELLERS = Object.freeze(new Set(['fisher', 'farmer', 'carter', 'merchant']));
/** AUDIT LW-ANTICS B6: the hours the watch's morning words are said in ("Morning, {b}. Quiet night?"). */
export const MORNING_HOURS = Object.freeze([5, 11]);
/** The hour of the day at minute `t`. @param {number} t */
const hourOf = (t) => (((t % 1440) + 1440) % 1440) / 60;
/** LW-ANTICS: whether one of the town is light of finger - their own draw, the same every day. @param {StirWho} who */
export const lightFingered = (who) =>
  LIGHT.has(who.job) && !who.guard && (lwSeed(textSeed(who.id), 0x6c696768) % 100000) / 100000 < CUTPURSE_HANDS; // 'ligh'
/** A stranger's humour that day: the shares of civil, curt and hostile - a sellsword's and a sailor's rougher. */
/** @type {Readonly<Record<'stranger'|'rough', readonly (readonly ['civil'|'curt'|'hostile', number])[]>>} */
export const HUMOURS = Object.freeze({
  stranger: Object.freeze([
    /** @type {const} */ (['civil', 0.5]),
    /** @type {const} */ (['curt', 0.3]),
    /** @type {const} */ (['hostile', 0.2]),
  ]),
  rough: Object.freeze([
    /** @type {const} */ (['civil', 0.3]),
    /** @type {const} */ (['curt', 0.35]),
    /** @type {const} */ (['hostile', 0.35]),
  ]),
});
const ROUGH = new Set(['mercenary', 'sailor']);
/** AUDIT LW-STIR A5: the pleas that name nobody - a stranger's (a beggar knows the town's names, not a traveller's). */
export const PLEA_UNNAMED = Object.freeze(PLEA_SCRIPTS.filter((s) => s.every((l) => !l.text.includes('{b}'))));
/** THE SMALL VOICES: how long a word stays up (real seconds); the night watch calls the hour within CALL_SPREAD_MIN of
 *  it, CALL_SHARE of the hours; a stall cries every CRY_EVERY_MIN of the clock CRY_SHARE of the time (by day), a beggar
 *  BEG_EVERY_MIN; one who drinks sings SONG_EVERY_MIN on a walk home from the tavern late. */
export const VOICE_S = 3.4;
export const CALL_SHARE = 0.6;
export const CALL_SPREAD_MIN = 6;
export const CRY_EVERY_MIN = 6;
export const CRY_SHARE = 0.3;
export const BEG_EVERY_MIN = 8;
export const BEG_SHARE = 0.3;
export const SONG_EVERY_MIN = 3;
export const SONG_SHARE = 0.35;

/** @typedef {{ id: string, name: string, job: string, town?: number, guard?: boolean, drink?: number, work?: number|null }} StirWho */
/** @typedef {{ who: StirWho, kind: string, t0: number, t1: number, duty?: boolean, pair?: number | null }} SpotStay - one
 *  stands at the spot through [t0, t1) (a plan's outdoor stay; `duty` the watch on duty, `pair` its patrol's man: the
 *  first (0) or alone (null) speaks for the watch, the second stands by) */
/** @typedef {{ by: 'a'|'b'|'g', text: string, loud: boolean }} StirLine */
/** @typedef {{ kind: 'gate'|'challenge'|'quarrel'|'haggle'|'plea'|'watchword'|'cutpurse'|'dice'|'sermon'|'flirt', spot: string, members: StirWho[], anchor: 0|1,
 *   guard: StirWho | null, mood: string | null, script: readonly StirLine[], seed: number, round: number, t0: number,
 *   from: number, end: number, loudFrom: number, god?: string | null }} Incident -
 *  `members` [a, b], the two; `anchor` which of them keeps their own stand - the watch at its post, a beggar, a stall's
 *  keeper, else the one there first - the other coming to stand before them; `guard` the watch who steps in (a
 *  quarrel's); `round` the spot's talk round it falls in, whole (meetups.js spotRound); `t0` they begin to come
 *  together, `from` its first line, `end` it is over; `loudFrom` its first shouted line (Infinity: none); `god` a sermon's */

/** The draw in [0, 1) of a seed's parts. @param {...number} parts */
const draw = (...parts) => (lwSeed(...parts) % 100000) / 100000;

/** AUDIT LW-STIR A1: the slack of a sum on the clock - a few of its last bits, never under 1e-9. The online sky's clock
 *  passes 2^24 minutes in 2028, where a bit is 3.7e-9: a fixed 1e-9 lost every gate's word whose sum came out one bit
 *  long, and the stranger stood the whole halt unquestioned. @param {number} v */
const slack = (v) => Math.max(1e-9, Math.abs(v) * 8 * Number.EPSILON);

/** LW-STIR: whether one is a stranger to the town's watch - of another town (a visitor, a ship's hand ashore), not the
 *  watch itself. @param {StirWho} who @param {number} mapId */
export function strangerOf(who, mapId) {
  return !who.guard && who.town != null && who.town !== mapId;
}

/** LW-STIR: a stranger's humour on `day` - their own draw on the day's (HUMOURS: a sellsword's and a sailor's rougher).
 *  @param {StirWho} who @param {number} day @returns {'civil'|'curt'|'hostile'} */
export function humourOf(who, day) {
  const table = ROUGH.has(who.job) ? HUMOURS.rough : HUMOURS.stranger;
  let r = draw(textSeed(who.id), day, 0x68756d72); // 'humr'
  for (const [mood, w] of table) {
    if (r < w) return mood;
    r -= w;
  }
  return table[table.length - 1][0];
}

/** A script of a pool, on a seed. @template T @param {readonly T[]} pool @param {number} seed @returns {T} */
const pick = (pool, seed) => pool[lwSeed(seed, 0x70696b) % pool.length]; // 'pik'

/**
 * LW-STIR: HOW LONG A STRANGER COME IN AT A GATE THE WATCH KEEPS HALTS THERE (the clock's minutes; 0, waved through) -
 * GATE_SHARE of the arrivals, a party come in together halting together (the draw the gate's, the day's and the
 * second's), long enough for the gate's longest word (GATE_LINES) whole in a round of the gate's (meetups.js spotRound):
 * from the next round's start when the one they come in at is too short - their turn waited. The planner's (dayPlan.js
 * schedule: the stay at the gate), read where a post keeps the gate through it; the word's `gate` incident
 * (spotIncidents). Pure. @param {string} spotKey @param {number} day @param {number} inT @param {number} perS
 * @returns {number}
 */
export function gateHalt(spotKey, day, inT, perS) {
  return gateWord(spotKey, day, inT, perS)?.halt ?? 0;
}

/**
 * AUDIT LW-STIR A2: gateHalt's halt and the round of the gate's its word falls in (null: waved through) - one party's
 * word a round, as the street has one incident at a spot a round: a second party halted for a word in a round another's
 * holds stood its halt out unquestioned (684 such pairs in the lens's days). livingTown.js `_gateHalts` waves it through.
 * Pure. @param {string} spotKey @param {number} day @param {number} inT @param {number} perS
 * @returns {{ halt: number, round: number } | null}
 */
export function gateWord(spotKey, day, inT, perS) {
  if (!(perS > 0) || draw(textSeed(spotKey), day, Math.round(inT * 60), 0x67617465) >= GATE_SHARE) return null; // 'gate'
  const len = (STIR_GATHER_S + STIR_AFTER_S) * perS + GATE_LINES * lineMinutes(perS);
  const r = spotRound(spotKey, inT, ROUND_S * perS);
  const start = inT + len <= r.end ? inT : r.end + 1e-6;
  return { halt: start - inT + len, round: spotRound(spotKey, start, ROUND_S * perS).round };
}

/**
 * LW-STIR: THE DAY'S INCIDENTS AT ONE SPOT - from every stay at it that day (`stays`, the plans'), each laid as it would
 * be and the first in time kept where two would cross (one at a spot at a time, one at a time for each of its people):
 * - THE GATE: a stranger halted at a gate (`gate`, gateHalt) questioned by the watch posted there through it - one of
 *   each party halted together, by the draw, the gate's word (GATE_SCRIPTS) ending as the halt does;
 * - THE WATCH STOPS A STRANGER: each of the watch's stops at the spot (`watch` on duty) with a stranger standing there
 *   through the whole of a challenge (`strangerOf`) - CHALLENGE_SHARE of them, the stranger the stop's draw of those
 *   who stand long enough; their answer by their humour (`humourOf`);
 * - A QUARREL: one of the town at the spot falls out with another of it there (neither on duty, working a stall nor
 *   begging) - QUARREL_SHARE of their stays there, QUARREL_EVENING times it from six in the evening between two who
 *   drink, the other the draw's; the watch on duty standing there through it steps in (BREAK_UP_LINES);
 * - A HAGGLE: one come to a spot with stalls haggles at one of them (HAGGLE_SHARE of their stays there);
 * - A PLEA: a beggar asks one standing near (PLEA_SHARE of each). One a day between the same two at one spot.
 * Each falls whole in one of the spot's talk rounds (meetups.js spotRound, the town's round: ROUND_S of the clock's
 * rate) - from the next round's start when the one they meet in is too short - and one at a spot a round (the gate's
 * first, halted for it; then the first in time): the street takes its two out of the round's circles and stands them
 * the round through, the one who comes before the one who keeps their stand (`anchor`; livingTown.js) - so the round's
 * places at the spot stand as they are through it. Pure over the stays, the spot's key, the day, the town and the
 * clock's rate (`perS`: its minutes a real second; a line `lineMin`). ANTIC_KINDS after these, in rounds none took.
 * @param {string} spotKey @param {readonly SpotStay[]} given @param {number} day @param {number} mapId
 * @param {number} lineMin @param {number} perS @param {{ building?: number|null, god?: string|null } | null} [spot] its door's
 * @param {{ antics?: boolean }} [o] - `antics` false: the first five alone (the pins' read of them)
 * @returns {Incident[]}
 */
export function spotIncidents(
  spotKey,
  given,
  day,
  mapId,
  lineMin,
  perS,
  spot = null,
  { antics: withAntics = true } = {},
) {
  if (!(lineMin > 0) || !(perS > 0) || given.length < 2) return [];
  const spotSeed = textSeed(spotKey);
  // in the clock's order, then the ids' - whatever order they were read in
  const stays = [...given].sort(
    (x, y) => x.t0 - y.t0 || (x.who.id < y.who.id ? -1 : x.who.id > y.who.id ? 1 : 0) || x.t1 - y.t1,
  );
  const gather = STIR_GATHER_S * perS,
    after = STIR_AFTER_S * perS,
    roundMin = ROUND_S * perS;
  /** @type {Incident[]} */
  const laid = [];
  /** an incident of `kind` between `a` and `b` (`anchor` the one who keeps their stand) soon after they meet in the
   *  overlap of their stays [o0, o1), whole in the spot's round - else from the next round's start - if it fits */
  const lay = (
    /** @type {Incident['kind']} */ kind,
    /** @type {StirWho} */ a,
    /** @type {StirWho} */ b,
    /** @type {0|1} */ anchor,
    /** @type {readonly StirLine[]} */ script,
    /** @type {number} */ seed,
    /** @type {number} */ o0,
    /** @type {number} */ o1,
    mood = /** @type {string|null} */ (null),
    guards = /** @type {readonly SpotStay[]|null} */ (null),
    /** LW-ANTICS: the watch's words where it steps in, the words with none, and the list the incident is laid on */
    stepsOf = BREAK_UP_LINES,
    unwatched = /** @type {readonly (readonly StirLine[])[] | null} */ (null),
    into = laid,
  ) => {
    const soon =
      o0 + draw(seed, 0x77616974) * Math.min(5, Math.max(0, o1 - o0 - gather - script.length * lineMin - after)); // 'wait' - soon after they meet
    const steps = pick(stepsOf, lwSeed(seed, 0x6272656b)); // 'brek'
    const alone = unwatched ? pick(unwatched, lwSeed(seed, 0x676f6e65)) : null; // 'gone'
    for (const t0 of [soon, spotRound(spotKey, soon, roundMin).end + 1e-6]) {
      const r = spotRound(spotKey, t0, roundMin);
      const from = t0 + gather;
      // the watch stands through it, its words too: steps in - AUDIT LW-STIR A3: whichever of it does on this try (one
      // chosen before, the first there, left at a handover; the one who came on stood by)
      const g =
        guards?.find((w) => w.t0 <= from && w.t1 >= from + (script.length + steps.length) * lineMin + after)?.who ??
        null;
      const lines = g ? Object.freeze([...script, ...steps]) : alone ? Object.freeze([...script, ...alone]) : script;
      const end = from + lines.length * lineMin + after;
      if (end > o1 + slack(o1) || end > r.end + slack(r.end)) continue; // (a gate's ends as its halt does: the clock's sums - AUDIT LW-STIR A1)
      const loud = lines.findIndex((l) => l.loud);
      into.push({
        kind,
        spot: spotKey,
        members: [a, b],
        anchor,
        guard: g,
        mood,
        script: lines,
        seed,
        round: r.round,
        t0,
        from,
        end,
        loudFrom: loud < 0 ? Infinity : from + loud * lineMin,
      });
      return;
    }
  };
  const overlap = (/** @type {SpotStay} */ x, /** @type {SpotStay} */ y) => [
    Math.max(x.t0, y.t0),
    Math.min(x.t1, y.t1),
  ];
  const byId = (/** @type {SpotStay} */ x, /** @type {SpotStay} */ y) =>
    x.who.id < y.who.id ? -1 : x.who.id > y.who.id ? 1 : 0;
  /** of two who meet at the spot, the one there first (their stay's start, then the lower id): 0 `x`, 1 `y` */
  const first = (/** @type {SpotStay} */ x, /** @type {SpotStay} */ y) =>
    /** @type {0|1} */ (y.t0 < x.t0 || (y.t0 === x.t0 && byId(y, x) < 0) ? 1 : 0);
  const stopped = new Set();
  /** AUDIT LW-ANTICS A3: the watch's stops that stopped a stranger (its man and the stop's start) - no word there */
  const stoppedAt = new Set();
  // the gate: the halted strangers of each arrival, one of them questioned by the post keeping the gate through it
  /** @type {Map<number, SpotStay[]>} */
  const halted = new Map();
  for (const s of stays)
    if (s.kind === 'gate' && strangerOf(s.who, mapId)) {
      const l = halted.get(s.t0) ?? [];
      l.push(s);
      halted.set(s.t0, l);
    }
  for (const [t0, them] of halted) {
    const t1 = Math.min(...them.map((s) => s.t1));
    const post = stays.filter((g) => g.duty && g.kind === 'post' && g.t0 <= t0 && g.t1 >= t1).sort(byId)[0];
    if (!post) continue;
    const seed = lwSeed(spotSeed, day, Math.round(t0 * 60), 0x67617465); // 'gate'
    const s = them
      .map((x) => ({ x, k: lwSeed(seed, textSeed(x.who.id)) }))
      .sort((a, b) => a.k - b.k || byId(a.x, b.x))[0].x;
    const mood = humourOf(s.who, day);
    const script = pick(GATE_SCRIPTS[mood], lwSeed(seed, textSeed(s.who.id)));
    lay(
      'gate',
      post.who,
      s.who,
      0,
      script,
      lwSeed(seed, textSeed(s.who.id), 1),
      t1 - (gather + script.length * lineMin + after),
      t1,
      mood,
    ); // the post keeps it
    stopped.add(s.who.id);
  }
  // the watch stops a stranger
  for (const g of stays) {
    if (!g.duty || g.kind !== 'watch' || g.pair === 1) continue;
    const seed = lwSeed(spotSeed, day, textSeed(g.who.id), Math.round(g.t0), 0x68616c74); // 'halt'
    if (draw(seed) >= CHALLENGE_SHARE) continue;
    const them = stays
      .filter((s) => !s.duty && s.kind !== 'gate' && strangerOf(s.who, mapId) && !stopped.has(s.who.id))
      .map((s) => ({ s, k: lwSeed(seed, textSeed(s.who.id), Math.round(s.t0)) }))
      .sort((x, y) => x.k - y.k || (x.s.who.id < y.s.who.id ? -1 : 1));
    for (const { s } of them) {
      const mood = humourOf(s.who, day);
      const script = pick(CHALLENGE_SCRIPTS[mood], lwSeed(seed, textSeed(s.who.id)));
      const [o0, o1] = overlap(g, s);
      const n = laid.length;
      lay('challenge', g.who, s.who, first(g, s), script, lwSeed(seed, textSeed(s.who.id), 1), o0, o1, mood);
      if (laid.length > n) {
        stopped.add(s.who.id);
        stoppedAt.add(`${g.who.id}|${g.t0}`);
        break;
      } // one stop of a stranger a day at the spot
    }
  }
  // two at the spot together: a plea, a haggle, a quarrel - one a day between the same two at one spot
  // AUDIT LW-STIR A7: the watch that steps in - never the second of a pair, who stands by (the first in time, then id)
  const watch = stays.filter((s) => s.duty && s.pair !== 1);
  const met = new Set();
  const pairOf = (/** @type {StirWho} */ a, /** @type {StirWho} */ b) =>
    a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  const meets = (/** @type {SpotStay} */ x, /** @type {SpotStay} */ y) => {
    const [o0, o1] = overlap(x, y);
    return o1 > o0;
  };
  // LW-PERF (AUDIT FULLER-LW A7): the stays that meet one, in the clock's order - from those begun a longest stay before
  // it to its end, never the whole day's at the spot again for each (a city's square of a thousand stays: n squared)
  const longest = stays.reduce((m, y) => Math.max(m, y.t1 - y.t0), 0);
  const metBy = (/** @type {SpotStay} */ x) => {
    let lo = 0,
      hi = stays.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (stays[m].t0 < x.t0 - longest) lo = m + 1;
      else hi = m;
    }
    const out = [];
    for (let i = lo; i < stays.length && stays[i].t0 < x.t1; i++) if (meets(x, stays[i])) out.push(stays[i]);
    return out;
  };
  for (const x of stays) {
    if (x.duty) continue;
    const seed = lwSeed(spotSeed, day, textSeed(x.who.id), Math.round(x.t0));
    if (x.kind === 'beg') {
      // a beggar asks one standing near: PLEA_SHARE of each who stands there with them
      for (const y of metBy(x)) {
        if (y.duty || y.kind === 'beg' || y.who.id === x.who.id) continue;
        const pair = pairOf(x.who, y.who),
          ps = lwSeed(spotSeed, day, textSeed(pair));
        if (met.has(pair) || draw(ps, 0x706c6561) >= PLEA_SHARE) continue; // 'plea'
        met.add(pair);
        const [o0, o1] = overlap(x, y);
        // the beggar keeps their place - AUDIT LW-STIR A4: a stall's keeper theirs, the beggar come to the stall; A5: a
        // stranger is asked by no name (a beggar called one of Wayrest "kind Finn")
        lay(
          'plea',
          x.who,
          y.who,
          y.kind === 'stall' ? 1 : 0,
          pick(strangerOf(y.who, mapId) ? PLEA_UNNAMED : PLEA_SCRIPTS, ps),
          ps,
          o0,
          o1,
        );
      }
      continue;
    }
    if (x.kind === 'stall') continue; // a stall is haggled at, by one come to it
    const stalls = metBy(x).filter((y) => y.kind === 'stall' && !y.duty && y.who.id !== x.who.id);
    if (stalls.length && draw(seed, 0x68616767) < HAGGLE_SHARE) {
      // 'hagg'
      // one come to a spot with stalls haggles at one of them: HAGGLE_SHARE of their stays there
      const y = stalls[lwSeed(seed, 0x61742020) % stalls.length]; // 'at  '
      const pair = pairOf(x.who, y.who),
        ps = lwSeed(spotSeed, day, textSeed(pair));
      if (met.has(pair)) continue;
      met.add(pair);
      const [o0, o1] = overlap(x, y);
      lay('haggle', x.who, y.who, 1, pick(HAGGLE_SCRIPTS, ps), ps, o0, o1); // at the stall
      continue;
    }
    // one of the town falls out with another of it there (neither on duty, at a stall nor begging - the watch's own
    // neither): QUARREL_SHARE of their stays there, QUARREL_EVENING times it from six between two who drink - each one's
    // own draw, the other the draw's of those there with them (a busy spot's falling out grows with its people, not
    // with their pairs: dealt by the pair, an evening's spot of ten fell out three times in half an hour)
    if (x.who.town !== mapId || x.who.guard) continue;
    const others = metBy(x).filter(
      (y) =>
        !y.duty &&
        y.kind !== 'stall' &&
        y.kind !== 'beg' &&
        y.who.id !== x.who.id &&
        y.who.town === mapId &&
        !y.who.guard,
    );
    if (!others.length) continue;
    const y = others[lwSeed(seed, 0x77697468) % others.length]; // 'with'
    const [o0, o1] = overlap(x, y);
    const evening =
      ((o0 % 1440) + 1440) % 1440 >= 18 * 60 && (x.who.drink ?? 0) > DRINKER && (y.who.drink ?? 0) > DRINKER;
    if (draw(seed, 0x71727265) >= QUARREL_SHARE * (evening ? QUARREL_EVENING : 1)) continue; // 'qrre'
    const pair = pairOf(x.who, y.who),
      ps = lwSeed(spotSeed, day, textSeed(pair));
    if (met.has(pair)) continue;
    met.add(pair);
    lay('quarrel', x.who, y.who, first(x, y), pick(QUARREL_SCRIPTS, ps), ps, o0, o1, null, watch); // the one who falls out, the aggrieved
  }
  // WATCH-LIFE and LW-ANTICS: the newer kinds, on their own draws, laid after the first five (`antics`)
  /** @type {Incident[]} */
  const antics = [];
  const busy = (/** @type {number} */ t) => stays.filter((s) => s.t0 <= t && s.t1 > t).length;
  // the watch on its rounds has a word with one of the town standing at its stop - a bite at a stall, a beggar moved on
  for (const g of withAntics ? stays : []) {
    if (!g.duty || g.kind !== 'watch' || g.pair === 1 || stoppedAt.has(`${g.who.id}|${g.t0}`)) continue;
    const seed = lwSeed(spotSeed, day, textSeed(g.who.id), Math.round(g.t0), 0x776f7264); // 'word'
    if (draw(seed) >= WATCH_WORD_SHARE) continue;
    const them = metBy(g)
      .filter(
        (s) => !s.duty && s.kind !== 'gate' && s.who.town === mapId && !s.who.guard && !met.has(pairOf(g.who, s.who)),
      )
      .map((s) => ({ s, k: lwSeed(seed, textSeed(s.who.id), Math.round(s.t0)) }))
      .sort((x, y) => x.k - y.k || byId(x.s, y.s));
    const y = them[0]?.s;
    if (!y) continue;
    met.add(pairOf(g.who, y.who)); // AUDIT LW-ANTICS B9: one word a day between a watchman and one of the town at a spot
    const [o0, o1] = overlap(g, y);
    // AUDIT LW-ANTICS B9: a beggar moved along goes - the words at the end of their pitch, the watch there through it;
    // one who stays on has a word that keeps them there (beggarWords); B10: a bite only at a stall of food; B6: the
    // morning's words in the morning
    const gone = y.kind === 'beg' ? pick(moveAlong(), seed) : null;
    const goneLen = gone ? gather + gone.length * lineMin + after : 0;
    if (gone && g.t1 >= y.t1 && y.t1 - o0 > goneLen) {
      lay(
        'watchword',
        g.who,
        y.who,
        1,
        gone,
        lwSeed(seed, 1),
        Math.max(o0, y.t1 - goneLen),
        y.t1,
        null,
        null,
        BREAK_UP_LINES,
        null,
        antics,
      );
      continue;
    }
    const buys = y.kind === 'stall' && FOOD_SELLERS.has(y.who.job);
    const h = hourOf(o0);
    const pool = buys
      ? watchBuys()
      : y.kind === 'beg'
        ? beggarWords()
        : h >= MORNING_HOURS[0] && h < MORNING_HOURS[1]
          ? [...morningWatchWords(), ...watchWords()]
          : watchWords();
    lay(
      'watchword',
      g.who,
      y.who,
      buys || y.kind === 'beg' ? 1 : first(g, y),
      pick(pool, seed),
      lwSeed(seed, 1),
      o0,
      o1,
      null,
      null,
      BREAK_UP_LINES,
      null,
      antics,
    );
  }
  for (const x of withAntics ? stays : []) {
    if (x.duty) continue;
    const seed = lwSeed(spotSeed, day, textSeed(x.who.id), Math.round(x.t0), 0x616e7463); // 'antc'
    // a purse lifted by day at a crowded spot at the end of the cutpurse's stay, the one robbed staying on (AUDIT
    // LW-ANTICS A1: so the run ends the thief's stay, never a walk back to them): the watch on duty standing by gives
    // chase (chaseLines), else the robbed shout after them (gotAwayLines); A9: by day at the lift's own minute
    if (x.who.town === mapId && lightFingered(x.who) && draw(seed, 0x63757470) < CUTPURSE_SHARE) {
      // 'cutp'
      const marks = metBy(x).filter((y) => !y.duty && y.kind !== 'beg' && y.who.id !== x.who.id && !y.who.guard);
      const y = marks[lwSeed(seed, 0x6d61726b) % Math.max(1, marks.length)]; // 'mark'
      const len = gather + (cutpurseScripts()[0].length + chaseLines()[0].length + 1) * lineMin + after;
      const [o0] = y ? overlap(x, y) : [0];
      const at = Math.max(o0, x.t1 - len),
        h = hourOf(at);
      const pair = y ? pairOf(x.who, y.who) : '';
      if (y && !met.has(pair) && h >= 9 && h < 18 && y.t1 >= x.t1 && busy(at) >= CUTPURSE_CROWD && x.t1 - o0 > len) {
        met.add(pair);
        const ps = lwSeed(spotSeed, day, textSeed(pair), 0x63757470);
        lay(
          'cutpurse',
          x.who,
          y.who,
          1,
          pick(cutpurseScripts(), ps),
          ps,
          at,
          x.t1,
          null,
          watch,
          chaseLines(),
          gotAwayLines(),
          antics,
        );
        continue;
      }
    }
    // a priest at their own temple's door with one there: a sermon
    if (
      x.who.job === 'priest' &&
      x.kind === 'social' &&
      spot?.building != null &&
      x.who.work === spot.building &&
      draw(seed, 0x7365726d) < SERMON_SHARE
    ) {
      // 'serm'
      const them = metBy(x).filter((y) => !y.duty && y.who.id !== x.who.id);
      const y = them[lwSeed(seed, 0x68656172) % Math.max(1, them.length)]; // 'hear'
      if (y && !met.has(pairOf(x.who, y.who))) {
        met.add(pairOf(x.who, y.who));
        const [o0, o1] = overlap(x, y);
        const n = antics.length;
        lay(
          'sermon',
          x.who,
          y.who,
          0,
          pick(sermonScripts(), seed),
          lwSeed(seed, 2),
          o0,
          o1,
          null,
          null,
          BREAK_UP_LINES,
          null,
          antics,
        );
        if (antics.length > n) antics[n].god = spot?.god ?? null; // AUDIT LW-ANTICS B7: the temple's own god
        continue;
      }
    }
    // of an evening, two of the town (the watch off duty too) at dice - else a warmer word; AUDIT LW-ANTICS A9: the
    // evening of their meeting, not of the stay's start
    if (x.who.town !== mapId || x.kind === 'stall' || x.kind === 'beg' || x.kind === 'gate' || hourOf(x.t1) < 18)
      continue;
    const others = metBy(x).filter(
      (y) => !y.duty && y.kind !== 'stall' && y.kind !== 'beg' && y.who.id !== x.who.id && y.who.town === mapId,
    );
    if (!others.length) continue;
    const y = others[lwSeed(seed, 0x77697468) % others.length]; // 'with'
    const pair = pairOf(x.who, y.who),
      ps = lwSeed(spotSeed, day, textSeed(pair), 0x616e7463);
    if (met.has(pair)) continue;
    const [o0, o1] = overlap(x, y);
    if (hourOf(o0) < 18 && hourOf(o1) >= 18) continue; // met before six: not yet the evening's (a stay over the evening's start)
    const r = draw(seed, 0x64696365); // 'dice'
    if (r < DICE_SHARE) {
      met.add(pair);
      lay(
        'dice',
        x.who,
        y.who,
        first(x, y),
        pick(diceScripts(), ps),
        ps,
        o0,
        o1,
        null,
        null,
        BREAK_UP_LINES,
        null,
        antics,
      );
    } else if (r < DICE_SHARE + FLIRT_SHARE && !x.who.guard && !y.who.guard) {
      met.add(pair);
      lay(
        'flirt',
        x.who,
        y.who,
        first(x, y),
        pick(flirtScripts(), ps),
        ps,
        o0,
        o1,
        null,
        null,
        BREAK_UP_LINES,
        null,
        antics,
      );
    }
  }
  // one at the spot a round (so one at a time, and one at a time for each of its people): the gate's first, halted for
  // it - then the first in time; LW-ANTICS: the newer kinds only in a round none of the first five took
  laid.sort((p, q) => (p.kind === 'gate' ? 0 : 1) - (q.kind === 'gate' ? 0 : 1) || p.t0 - q.t0 || p.seed - q.seed);
  antics.sort((p, q) => p.t0 - q.t0 || p.seed - q.seed);
  /** @type {Incident[]} */
  const out = [];
  const busyWith = (/** @type {Incident} */ inc) =>
    out.some(
      (o) =>
        o.round === inc.round ||
        (o.t0 < inc.end && inc.t0 < o.end && o.members.some((m) => inc.members.some((n) => n.id === m.id))),
    );
  for (const inc of laid) if (!out.some((o) => o.round === inc.round)) out.push(inc);
  for (const inc of antics) if (!busyWith(inc)) out.push(inc);
  return out.sort((p, q) => p.t0 - q.t0 || p.seed - q.seed);
}

/** LW-ANTICS: A CUTPURSE'S RUN - how far from their stand the cutpurse of `inc` has run at minute `t` (`reach` at most,
 *  CHASE_M unless the street holds less - AUDIT LW-ANTICS A2; from its first shout, at a frightened run's pace `speed`
 *  m/s; `perS` the clock's minutes a real second), and how far behind them the watch stepping in runs (CAUGHT_M once
 *  caught). Null: no run now. Pure.
 *  @param {Incident} inc @param {number} t @param {number} perS @param {number} speed @param {number} [reach]
 *  @returns {{ thief: number, guard: number, running: boolean } | null} */
export function cutpurseRun(inc, t, perS, speed, reach = CHASE_M) {
  if (inc.kind !== 'cutpurse' || !(perS > 0) || t < inc.loudFrom || t >= inc.end) return null;
  const s = (t - inc.loudFrom) / perS;
  const thief = Math.min(reach, speed * s);
  const guard = inc.guard ? Math.max(0, Math.min(thief - CAUGHT_M, speed * Math.max(0, s - 0.6) * 1.15)) : 0;
  return { thief, guard, running: thief < reach || (!!inc.guard && guard < thief - CAUGHT_M - 1e-6) };
}

/** LW-STIR: whether an incident's people are any of `ids`. @param {Incident} inc @param {Set<string>} ids */
export const stirHas = (inc, ids) => inc.members.some((m) => ids.has(m.id)) || (!!inc.guard && ids.has(inc.guard.id));

/**
 * LW-STIR: the line an incident is saying at minute `t` - its script a line every `lineMin` from its `from`, each by
 * its part (`a`, `b`, `g`) - or null: gathering, or done. AUDIT LW-STIR: the gate's and the watch's {place} is the
 * stranger's own town where the roads know it (`ctx.home`: they named a town of this one's own travels as theirs).
 * @param {Incident} inc @param {number} t @param {number} lineMin
 * @param {{ town?: string, region?: string, places?: readonly string[] | null, home?: string | null }} [ctx]
 * @returns {{ who: StirWho, text: string, loud: boolean, index: number } | null}
 */
export function stirLine(inc, t, lineMin, ctx = {}) {
  if (!(lineMin > 0) || t < inc.from) return null;
  const index = Math.floor((t - inc.from) / lineMin);
  const line = inc.script[index];
  if (!line) return null;
  const who = line.by === 'g' ? inc.guard : inc.members[line.by === 'a' ? 0 : 1];
  if (!who) return null;
  const place =
    (inc.kind === 'gate' || inc.kind === 'challenge') && ctx.home
      ? ctx.home
      : ctx.places?.length
        ? ctx.places[lwSeed(inc.seed, 0x706c6163) % ctx.places.length]
        : null; // 'plac'
  const text = fillLine(line.text, {
    town: ctx.town,
    region: ctx.region,
    place,
    god: inc.god ?? (inc.kind === 'sermon' ? theDivines() : null),
    a: firstNameOf(inc.members[0].name),
    b: firstNameOf(inc.members[1].name),
  });
  return { who, text, loud: line.loud, index };
}

/** LW-STIR: whether minute `t` is in an incident's shouting - from its first shouted line to its end. @param {Incident} inc @param {number} t */
export const stirLoud = (inc, t) => t >= inc.loudFrom && t < inc.end;

/**
 * LW-STIR: A SMALL VOICE - what one says aloud by themselves at minute `t`, by the plan entry they are in (`e`): the night
 * watch on duty calls the hour (WATCH_HOURS, by the weather), a stall cries its wares by day, a beggar calls, one who
 * drinks sings on a walk home from the tavern late (`fromTavern(e)`). Each now and then, on their own draws of the
 * clock; up VOICE_S. Pure. `perS` the clock's minutes a real second.
 * @param {StirWho} who @param {{ kind: string, duty?: boolean, pair?: number | null, from?: any } | null} e @param {number} t @param {number} perS
 * @param {{ town?: string, weather?: string | null, places?: readonly string[] | null }} [ctx] @param {(e: any) => boolean} [fromTavern]
 * @returns {{ text: string, kind: 'shout'|'sing' } | null}
 */
export function smallVoice(who, e, t, perS, ctx = {}, fromTavern = () => false) {
  if (!e || !(perS > 0)) return null;
  const up = VOICE_S * perS;
  const id = textSeed(who.id);
  const tod = ((t % 1440) + 1440) % 1440,
    hour = Math.floor(tod / 60),
    dayHour = Math.floor(t / 60);
  const fill = (/** @type {string} */ text, /** @type {number} */ seed) =>
    fillLine(text, {
      town: ctx.town,
      hour: WATCH_HOURS[/** @type {keyof typeof WATCH_HOURS} */ (hour)],
      place: ctx.places?.length ? ctx.places[lwSeed(seed, 0x706c6163) % ctx.places.length] : null,
    });
  /** a voice every `every` minutes, `share` of them, up `up` at its own minute in it */
  const now = (/** @type {number} */ every, /** @type {number} */ share, /** @type {number} */ salt) => {
    const k = Math.floor(t / every),
      seed = lwSeed(id, k, salt);
    if (draw(seed) >= share) return null;
    const at = k * every + draw(seed, 1) * Math.max(0, every - up);
    return t >= at && t < at + up ? seed : null;
  };
  if (e.duty && (e.kind === 'watch' || e.kind === 'post') && e.pair !== 1 && hour in WATCH_HOURS) {
    // AUDIT LW-STIR A6: the first of a pair calls it, the second stands by
    const seed = lwSeed(id, dayHour, 0x63616c6c); // 'call'
    if (draw(seed) >= CALL_SHARE) return null;
    const at = dayHour * 60 + draw(seed, 1) * CALL_SPREAD_MIN;
    if (!(t >= at && t < at + up)) return null;
    const w =
      ctx.weather === 'rain' || ctx.weather === 'thunder' || ctx.weather === 'snow' || ctx.weather === 'fog'
        ? ctx.weather
        : 'fair';
    return { text: fill(pick(WATCH_CALLS[w], seed), seed), kind: 'shout' };
  }
  if (e.kind === 'stall' && who.job === 'courier' && hour >= 8 && hour < 18) {
    // LW-ANTICS: a courier cries the news
    const seed = now(CRY_EVERY_MIN, CRY_SHARE, 0x6e657773); // 'news'
    return seed == null ? null : { text: fill(pick(newsCries(), seed), seed), kind: 'shout' };
  }
  if (e.kind === 'stall' && hour >= 8 && hour < 18) {
    const seed = now(CRY_EVERY_MIN, CRY_SHARE, 0x63727920); // 'cry '
    return seed == null ? null : { text: fill(pick(STALL_CRIES, seed), seed), kind: 'shout' };
  }
  if (e.kind === 'beg') {
    const seed = now(BEG_EVERY_MIN, BEG_SHARE, 0x62656720); // 'beg '
    return seed == null ? null : { text: fill(pick(BEGGAR_CRIES, seed), seed), kind: 'shout' };
  }
  if (e.kind === 'walk' && (who.drink ?? 0) > SONG_DRINK && (hour >= 21 || hour < 3) && fromTavern(e)) {
    const seed = now(SONG_EVERY_MIN, SONG_SHARE, 0x736f6e67); // 'song'
    return seed == null ? null : { text: fill(pick(DRINKING_SONGS, seed), seed), kind: 'sing' };
  }
  return null;
}
