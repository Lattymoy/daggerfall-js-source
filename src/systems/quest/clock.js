// THE QUEST CLOCK (Q1) - Clock.cs, declaration + time math whole.
// "Clock _sym_ [dd.hh:mm [dd.hh:mm]] [flag N] [range MIN MAX]": no
// time value starts the timer at a random 1min..1week; one value is
// exact; two are a random range (second must exceed the first or the
// first stands alone). flag&16 - and the flag&1 hack that keeps
// automatic NPC quests like A0C00Y17 from ending instantly - set the
// timer to 2.5x cautious travel time of the quest's places, which
// needs resolved Places: that arm rides deps.travelSeconds and until
// Q3 wires it the clock stores travelTimePending=true and 0 seconds,
// loudly (never a silent wrong number). Random draws are
// UnityEngine.Random -> injectable uniform roll (THE ENGINE-PRNG RULE,
// Ledger A).
// The tick half (enable/stop, TriggerTask on zero) ships with the
// machine (Q2).

import { QuestResource, matchFirst } from './questResource.js';
import { calculateTravelTime } from '../travel.js';
import { worldCoordToMapPixel } from '../../formats/mapsFile.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { raisedSince } from './questStamps.js';

const DECL = /(Clock|clock) (?<symbol>[a-zA-Z0-9_.-]+)/;
// C# optionsMatchStr: the time-value groups are EMPTY named groups
// before the value pattern - they exist so group.Success marks which
// shape matched. One combined scan with distinct names works here.
// NOTE the ddhhmm separator is `.` = ANY CHARACTER, as in the C# -
// bug-for-bug, not a typo fix.
const OPTIONS = /(?<ddhhmm>\d+.\d+:\d+)|(?<hhmm>\d+:\d+)|(?<mm>\d+)|flag (?<flag>\d+)|range (?<minRange>\d+) (?<maxRange>\d+)/g;
const TIME_VALUE = [
  /(?<days>\d+).(?<hours>\d+):(?<minutes>\d+)/,   // C# uses `.` (any char) here too - kept verbatim
  /(?<h2>\d+):(?<m2>\d+)/,
  /(?<m3>\d+)/,
];

const getTimeInSeconds = (days, hours, minutes) => days * 86400 + hours * 3600 + minutes * 60;

/** TIME3: the quest clock's WHOLE seconds - DFU's sample is WorldTime.Now.ToSeconds(), whole seconds of a clock that
 *  keeps its fraction, so the gap between two samples loses nothing. The port sampled the fractional reading and cut
 *  the GAP to whole seconds instead, dropping the fraction at every tick: ten ticks a real second at TimeScale 12 left
 *  a fifth to a third of every countdown played uncharged (test/time3_quests.test.js). */
const wholeSeconds = (caller) => Math.floor(caller?.nowSeconds?.() ?? 0);

/** Clock.cs GetTravelTimeInSeconds (:422-460), Q3-i: the flag&16 /
 *  _2place_ travel arm over the world seam. A single place routes the
 *  port's own TravelTimeCalculator - CAUTIOUS speed WITH CART, no
 *  inn/ship/horse, exactly C#'s argument row - from the player's
 *  current map pixel to the place's exterior world coords, floors at
 *  one day (1440 minutes), and multiplies 2.5x for the return trip
 *  (int-truncated). The no-place overload SUMS one-way times over
 *  every Place resource and applies the multiplier once. A place
 *  whose location cannot resolve logs and counts 0, as C#. */
export function travelTimeSeconds(quest, place = null, returnTrip = true) {
  const world = quest?.hooks?.world;
  if (!world) return null;
  if (place === null) {
    const places = [...quest.resources.values()].filter((r) => r.isPlace);
    if (!places.length) {
      console.warn('[quest] Clock wants a travel time but quest has no Place resources.');
      return 0;
    }
    let total = 0;
    for (const p of places) total += travelTimeSeconds(quest, p, false) ?? 0;
    if (returnTrip) total = Math.trunc(total * 2.5);
    return total;
  }
  const sd = place.siteDetails;
  const location = sd ? world.maps.getLocationByName(sd.regionName, sd.locationName) : null;
  if (!location) {
    console.warn(`[quest] Could not find Quest Place ${sd?.regionName}/${sd?.locationName}`);
    return 0;
  }
  const endPos = worldCoordToMapPixel(location.exterior.recordElement.header.x, location.exterior.recordElement.header.y);
  const { minutes } = calculateTravelTime(world.playerPixel(), endPos,
    { speedCautious: true, sleepModeInn: false, travelShip: false, hasHorse: false, hasCart: true },
    (x, y) => world.maps.getClimateIndex(x, y));
  let travelTimeMinutes = minutes;
  if (returnTrip) travelTimeMinutes = Math.trunc(travelTimeMinutes * 2.5);
  if (travelTimeMinutes < 1440) travelTimeMinutes = 1440;
  return getTimeInSeconds(0, 0, travelTimeMinutes);
}

export function matchTimeValue(text) {
  const m = matchFirst(text, TIME_VALUE);
  if (!m) return 0;
  const g = m.groups;
  const days = questParseInt(g.days ?? '');
  const hours = questParseInt(g.hours ?? g.h2 ?? '');
  const minutes = questParseInt(g.minutes ?? g.m2 ?? g.m3 ?? '');
  return getTimeInSeconds(days, hours, minutes);
}

/** WORLD7 (Mac: "quests dont seem to work in online"): the most world seconds ONE played frame charges a quest clock
 *  online - thirty world minutes, two and a half real minutes under the shared clock's twelve-to-one; a frame never
 *  spans it. A gap past it is time AWAY (the tab closed or hidden - a hidden tab runs no frames and charges one step
 *  when it comes back - the character off the world, a window held) and is forgiven. Offline there is no bound: a rest or a trip charges its whole span, DFU's own. */
export const PLAYED_STEP_MAX_SECONDS = 30 * 60;

/**
 * DEAD-CLOCK (2026-09-26, KimNix on the Discord: "the quest keeps resting its time"): WHETHER A CLOCK'S END CAN CHANGE
 * ANYTHING. A finished clock sets the task of its own name (`_triggerTask`); that task runs actions, or a `when` reads
 * it, or an `until ... performed` waits on it. A clock none of that names is a script's leftover - N0B20Y02's
 * `_oneday_` (`Clock _oneday_ 1.03:00`, `variable _oneday_`, read by nothing) - and the journal's "Time remains",
 * which counts down the tightest running clock, counted it down between the trance's three hours and the punishment's
 * seven days: the time seemed to reset twice. An action the registry could not read counts as an action.
 */
export function clockCounts(quest, clock) {
  const name = clock?.symbol?.name;
  const task = name ? quest?.tasks?.get(name) : null;
  if (!task) return false;
  if (task.actions.some((a) => !a.isTriggerCondition) || task.pendingActionLines?.length) return true;
  for (const t of quest.tasks.values()) {
    if (t.targetSymbol?.name === name) return true;   // until _x_ performed
    for (const a of t.actions) if (a.evaluations?.some((e) => new QuestSymbol(e.task).name === name)) return true;   // when _x_ / and _x_ / or not _x_ (the script's spelling, `_x_`)
  }
  return false;
}

/**
 * REST8 (2026-10-03, bible/06-Systems/Rest-Arc.md section 8; Mac's OPEN 12, option A): QUEST WAITS ONLINE - TIMEFREE's
 * DELAY HALF, back on QCLOCK-WORLD's clock. TIMEFREE (2026-10-02, `Online-Time-Arc.md` 6.3b) read every clock off its
 * script as a deadline or a delay, froze the deadlines and cut the delays; QCLOCK-WORLD (6.3c) reverted it whole and put
 * every clock on played world time, and its audit measured what that cost the waits (121 of them: median 0.3 h of play,
 * p90 24.3, the main quest's letters 20-26 h each). This brings back the reading and the cut, and NOT the freeze:
 *  - a DEADLINE - its end loses the quest ("you have 14 days": its end alone ends the quest with no reward), costs a
 *    standing, or shuts a reward that waits on it NOT having run out ("return before the time is up and be paid": a
 *    `not _clock_` reader pays). Online it runs on QCLOCK-WORLD's played world time (chargeSeconds: the lived step, never
 *    a raise) and fires as DFU's; its day count, its "Time remains" and the herald's warning stand.
 *  - a DELAY - everything else: Brisienna's letter (7-14 days), the tutorial's pages, "come back in three days", a
 *    reward that comes after a wait, a closing (AUDIT TIMEFREE T1). Online its remainder is cut once to
 *    ONLINE_DELAY_SECONDS of the character's own clock (about two real minutes of play) - or its own, if less - and then
 *    charged as any clock: the beat lands, nobody plays a day for a letter.
 * The reading is the script's own tasks: what the end does, what starts from it, what a `when` reads of it, and who
 * started the clock; the run-time half is the quest's success (Clock isDeadline). AUDIT TIMEFREE read all 399 vendored
 * clocks by hand (262 deadlines, 137 delays) and its two hand tables below stand as it left them; REST8's own read found
 * two deadlines the reading called delays (R1, readsAsDeadline: K0C00Y02's gold, S0000502's tower) - 264 and 135 then;
 * AUDIT REST-PARTY D2 two more, by hand (ONLINE_DEADLINES: N0B00Y17's scholar, K0C30Y03's guard) - 266 and 133 now,
 * the main quest's deadlines 31. THE EDGE: a deadline read as a delay fires its end - a failure - two minutes in (as
 * under TIMEFREE, whose delays were cut the same); a delay read as a deadline now only waits its played days, where
 * TIMEFREE froze it for ever. The one harmful misreading is the first (R1's two were it), so the pins hold the split,
 * both tables and the main quest's 31 deadlines, and test/rest8_questwaits.test.js ticks every vendored clock past the
 * short wait. Offline none of it - DFU's clock. [SUPERSEDES QCLOCK-WORLD's delays on played time; TIMEFREE's frozen
 * deadlines stay reverted.]
 */
export const ONLINE_DELAY_SECONDS = 24 * 60;
/** The actions that mean the quest is going somewhere good - GivePc (`give pc nothing` too: it is the success), TrainPc
 *  (it sets the success), StartQuest (the next part of a line), GetItem (AUDIT TIMEFREE T4: a quest item handed to the
 *  player - S0000002's letter43 three to seven days on, the main quest's next page). */
const PROGRESS = new Set(['GivePc', 'TrainPc', 'StartQuest', 'GetItem']);
const NEGATED = new Set(['whenNot', 'andNot', 'orNot']);

/** What firing the task `name` comes to: the action types reached - its own actions, the tasks it starts (`start
 *  task`, `setvar`) and the tasks a positive `when`/`and`/`or` of anything reached sets off, transitively - whether any
 *  of them lowers a standing, and whether any SETTLES the quest well: a reward handed over (`give pc X` or `give pc
 *  nothing` - the forms that mark the quest a success; `notify` and `silently` hand over a letter), TrainPc (it marks
 *  the success too) or the next quest started. A clock it starts is NOT followed: Brisienna's invitation (a delay)
 *  starts her fortnight (a deadline), and each is asked on its own - followed, the invitation read as the deadline and
 *  never came. */
function reached(quest, name, { conditional = true, alone = false } = {}) {
  const seen = new Set([name]);
  const queue = [name];
  const types = new Set();
  let lowers = false, settles = false;
  const visit = (next) => { if (next && !seen.has(next)) { seen.add(next); queue.push(next); } };
  while (queue.length) {
    const n = queue.shift();
    for (const a of quest.tasks.get(n)?.actions ?? []) {
      if (a.isTriggerCondition) continue;
      const type = a.constructor?.typeName;
      if (type) types.add(type);
      if ((type === 'ChangeReputeWith' || type === 'LegalRepute') && Number(a.amount) < 0) lowers = true;
      if ((type === 'GivePc' && (a.isNothing || (!a.textId && !a.silently))) || type === 'TrainPc' || type === 'StartQuest') settles = true;
      if (type === 'StartTask') visit(a.taskSymbol?.name);   // (a clock it starts is not followed: that clock is asked on its own)
    }
    if (!conditional) continue;   // (the starter's own reach: what it does, not what a later `when` may)
    for (const [tn, t] of quest.tasks) {
      if (seen.has(tn)) continue;
      const reader = t.actions.find((a) => a.isTriggerCondition && a.evaluations?.some((e) => !NEGATED.has(e.op) && new QuestSymbol(e.task).name === n));
      if (!reader) continue;
      // AUDIT TIMEFREE T3: `alone` follows a `when` only if the end ALONE sets it off - the engine's own reading of the
      // condition (WhenTask._checkEvals), with what this end has set so far true and every other task not set:
      // `when _firsttimer_ and not _S.03_` fires on the time-out alone; `when _S.01_ and _S.02_ and _delay_` waits on
      // the story too, and is a beat after it, not a loss
      if (alone && !reader._checkEvals?.call({ evaluations: reader.evaluations, _isTaskSet: (sym) => seen.has(sym.name) })) continue;
      visit(tn);
    }
  }
  return { types, lowers, settles };
}

/** The reading alone: whether the end of the clock `name` loses the quest, costs a standing, or shuts a reward. */
function readsAsDeadline(quest, name) {
  // its end costs a standing - Brisienna's fortnight, a questor's patience. AUDIT TIMEFREE T2: what the end itself DOES
  // (its task and the tasks that starts), not what a later `when` may: K0C00Y05's letter comes after a few hours, and
  // only `when _S.09_ and _S.04_` - the player's own misstep - costs the knight's favour; read whole, the letter never came
  if (reached(quest, name, { conditional: false }).lowers) return true;
  // its end loses the quest - by the end alone (AUDIT TIMEFREE T3: S0000016's minute before the main quest's endings
  // reaches `end quest` only through `when _S.01_ and _S.02_ and _delay_`; read whole, the endings never played online).
  // REST8 R1: and with no progress the end ALONE makes - T3's own reading, applied to the reward too. A reward a later
  // `when` pays only with the story's help is not what the time-out does: K0C00Y02's gold ("you only have =2mondung_
  // days": `when _2mondung_ and _mggold_` pays, `when _2mondung_ and not _mggold_` ends it unpaid) and S0000502's tower
  // ("my master will wait inside for =towertime_ days": `when _towertime_ and not _goout_` ends it, the reward only
  // `when _S.16_ and _S.09_`). Read whole, both were delays, and online each quest ended unpaid two minutes in (under
  // TIMEFREE too, whose delays were cut the same); the only two clocks of the 399 the change moves.
  const alone = reached(quest, name, { alone: true }).types;
  if (alone.has('EndQuest') && ![...PROGRESS].some((t) => alone.has(t))) return true;
  for (const [tn, t] of quest.tasks) {   // ...or shuts a reward that waits on it not having run out
    if (!t.actions.some((a) => a.isTriggerCondition && a.evaluations?.some((e) => NEGATED.has(e.op) && new QuestSymbol(e.task).name === name))) continue;
    // AUDIT TIMEFREE T2: the reader's own reward, not one a chain of later `when`s reaches - M0B11Y18's "not yet" line
    // (`when _S.18_ and not _S.02_`: say 1054) pays nothing; read whole, the traitor's arrival never came. T4: and a
    // reward it SETTLES (`give pc`, the next quest) outranks what the end leads to - O0B00Y11 pays the heist only
    // `when ... not _S.01_`, and its end, which hands the haul back as the posse comes, is still the loss of that pay
    if (reached(quest, tn, { conditional: false }).settles) return true;
  }
  return false;
}

/** The tasks that start the clock `name` (`start timer _name_`), but the quest's headless start-up block - whose
 *  symbol is a number (quest/task.js) - which starts the quest's own lifetime clocks, not a closing. */
function startersOf(quest, name) {
  const out = [];
  for (const [tn, t] of quest.tasks) {
    if (/^\d+$/.test(tn)) continue;
    if (t.actions.some((a) => a.constructor?.typeName === 'StartStopTimer' && a.isStartTimer && a.targetSymbol?.name === name)) out.push(tn);
  }
  return out;
}

/** AUDIT TIMEFREE T1: A CLOSING CLOCK. A clock that ends the quest and nothing else reads as a deadline - but when the
 *  task that STARTS it has already settled the quest (the reward handed over, the next quest started - what the starter
 *  DOES, not what a later `when` may: S0000500's traitor scene leads to the reward only once the contact is met, and
 *  its escape is a real deadline) or is itself a deadline running out (the failure already dealt), its end is no loss:
 *  it is the script closing the quest a while after the outcome. M0B40Y05's `_end_` (`Clock _end_ 00:00`, started by
 *  `give pc _gold_`), Brisienna's `_oneday_` (started by meeting her - whose `start task` starts the main quest - and by
 *  her fortnight running out), the main quest's S0000007 `_delay_`. Read as deadlines they never ran out online and
 *  those quests stood open for ever (REST8: they would close only after their days played - a delay closes them on the
 *  short wait). (The run-time half - a quest already a success - is the Clock's `isDeadline`.) */
function closes(quest, name) {
  for (const tn of startersOf(quest, name)) {
    if (reached(quest, tn, { conditional: false }).settles) return true;
    if (tn !== name && quest.resources?.get?.(tn)?.isClock && readsAsDeadline(quest, tn)) return true;
  }
  return false;
}

/** What a QUIET close does: the quest ended, a kept item made the player's, the questor let go - nothing said, nothing
 *  sent, no standing touched. */
const QUIET_CLOSE = new Set(['EndQuest', 'MakePermanent', 'DropAsQuestor']);

/** BODYGUARD-CLOSE (FIELD BUGS 2026-10-03, AverageDoggo: "Assassins killed, gold rewarded thanked for my help but quest
 *  remains uncompleted"): A START-UP CLOSING. A clock the start-up block started is the quest's lifetime, kept a
 *  deadline through a success the start-up block itself hands over (A0C41Y18's finger and gold, its 1001 days). But
 *  when the start-up block settles nothing - the success, if it comes, is a later task's - and the clock's end is a
 *  QUIET close, that end is the only `end quest` a script that pays and never closes has: A0C01Y01 (The Bodyguard)
 *  pays on `when _clickqgiver_ and _slain_` and ends only on `_timer_`, a day and three hours after the offer. Frozen
 *  online, it stood paid and open for ever. The run-time half is the Clock's `isDeadline`, as T1's: still a deadline
 *  until the quest is a success. An end that costs a standing or says or sends anything (R0C10Y01's -20 beside its own
 *  `_delay_`, A0C10Y05's "too late" line) is a loss even then, and stays frozen. */
function closesStartUp(quest, name) {
  const startUp = [...(quest.tasks?.keys() ?? [])].filter((tn) => /^\d+$/.test(tn));
  const starts = (tn) => quest.tasks.get(tn)?.actions.some((a) => a.constructor?.typeName === 'StartStopTimer' && a.isStartTimer && a.targetSymbol?.name === name);
  if (!startUp.some(starts)) return false;
  if (startUp.some((tn) => reached(quest, tn, { conditional: false }).settles)) return false;
  const end = reached(quest, name, { conditional: false });
  return end.types.has('EndQuest') && !end.lowers && [...end.types].every((t) => QUIET_CLOSE.has(t));
}

/** TIMEFREE (REST8's reading): whether `clock` is a deadline (see above) as the script reads - the run-time half
 *  aside. Answers false for a clock with no name or no quest. */
export function clockIsDeadline(quest, clock) {
  const name = clock?.symbol?.name;
  if (!name || !quest?.tasks) return false;
  return readsAsDeadline(quest, name) && !closes(quest, name);
}

/** TIMEFREE: the clocks whose end is a PENALTY the reading above cannot see - the end does not lose the quest or cost
 *  a standing, it sends something after the player: the cure quests' hunters (`when _huntstart_ create foe`),
 *  U0C00Y00's monster slipping away to its hideout, M0B11Y18's mark leaving the house. AUDIT TIMEFREE T6: and
 *  Brisienna's month (`_remindpc_`), whose end only words a reminder and starts her fortnight - the first half of her
 *  deadline; a delay, it sent "you are late" two minutes after the invitation. (Not a rule: S0000011's `_S.11_` has the
 *  same shape - a letter and a long clock - and its letter is the main quest's next page.) Deadlines, by hand.
 *  REST8: the table matters more than it did - read as delays, the hunters would come and the mark would leave two
 *  minutes in; as deadlines they keep their played days.
 *  AUDIT REST-PARTY D2: two more of the mark's class - someone who LEAVES, and what only they held goes with them:
 *  N0B00Y17's `_time2_` ("I'll expect you back here within =time2_ days. Please be prompt." - its end hides the scholar,
 *  and the `_scholarreward_` the ingredients buy goes with him) and K0C30Y03's `_S.13_` (a day or two after the banker
 *  is asked, the guard who knows where the patsy hides leaves town - "_guard_ has left" - and his lead with him). Read as
 *  delays, the scholar and the guard were gone two minutes after the player was sent off.
 *  AUDIT REST-PARTY D1: and one the reading DOES call a deadline, here for the run-time half: B0B81Y02's `_S.30_`, the
 *  180 days to find the artifact (`end quest`) the map read in the lich's lair starts. The knight's `give pc nothing`
 *  (`_success_`: the lich's death reported, the quest a success but not over) can come after the map is read, and a
 *  task started the clock - so isDeadline read the success as the quest closing, and online the artifact hunt ended two
 *  minutes after the knight's word. An entry here is never a closing (isDeadline: `_closesOnSuccess` skips the table). */
export const ONLINE_DEADLINES = Object.freeze({
  $CUREWER: Object.freeze(['huntstart']),
  $CUREVAM: Object.freeze(['huntstart']),
  U0C00Y00: Object.freeze(['escapetime']),
  M0B11Y18: Object.freeze(['S.05']),
  _BRISIEN: Object.freeze(['remindpc']),
  N0B00Y17: Object.freeze(['time2']),   // AUDIT REST-PARTY D2: the scholar's "Please be prompt"
  K0C30Y03: Object.freeze(['S.13']),   // AUDIT REST-PARTY D2: the guard's lead
  B0B81Y02: Object.freeze(['S.30']),   // AUDIT REST-PARTY D1: the artifact hunt, through the knight's reward
});

/** AUDIT TIMEFREE T1: the closing after a FAILURE the reading cannot tell from a story beat (a starter that costs a
 *  standing is as often the plot - S0000500's traitor - as the loss): R0C11Y03's turn after the item went to the
 *  chemist, whose own end costs the questgiver and ends the quest. Frozen, the failed quest stood open for ever. A delay,
 *  by hand. (N0B20Y02's week of the mage's revenge and N0B10Y03's hour after the unguarded hall end the quest only
 *  `when` the failure AND the clock stand - T3's reading already calls them delays.) */
export const ONLINE_CLOSINGS = Object.freeze({
  R0C11Y03: Object.freeze(['2ndparton']),
});

/** REST8: whether the quest's DELAYS take the short wait - online (the shared clock standing), the quest's own word.
 *  TIMEFREE's `questTimeFree`, named for what it gates now: a deadline online is time, played. */
export const questWaitsShort = (quest) => !!quest?.hooks?.sharedClock?.();

/** Clock.cs's travel arm (setResource): flag&16, or the flag&1 HACK - bit 0, a range, and a zero time. AUDIT REST-PARTY
 *  D3: one predicate for the parse and for a restore from a save older than the "at once" mark, which has no
 *  declaration to read - only the flag, the range and the starting time the save kept. */
const travelArmed = (flag, maxRange, seconds) => (flag & 16) === 16 || ((flag & 1) === 1 && maxRange > 0 && seconds === 0);

export class Clock extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.flag = 0;
    this.minRange = 0;
    this.maxRange = 0;
    this.startingTimeInSeconds = 0;
    this.remainingTimeInSeconds = 0;
    this.clockEnabled = false;
    this.clockFinished = false;
    this._lastWorldTimeSample = 0;
    this._lastRaisedSample = null;   // TIME3: the session's raised seconds at that sample - transient: a restore is a resume
    this.travelTimePending = false;   // Q1: the flag&16 / flag&1-hack arms pend Place resolution (Q3)
    this._deadline = null;   // REST8 (TIMEFREE's reading): asked on first need (isDeadline)
    this._closesOnSuccess = false;   // AUDIT TIMEFREE T1: a task started it, so a success makes it a closing
    this.declaredAtOnce = false;   // AUDIT TIMEFREE T3: `Clock _x_ 00:00`, no travel arm (setResource; saved - AUDIT REST-PARTY D3)
    this.startedAfterSuccess = false;   // AUDIT TIMEFREE T5: started once the quest was already a success (saved)
    if (line !== null) this.setResource(line);
  }

  setResource(line) {
    super.setResource(line);
    const match = DECL.exec(line);
    if (!match) return;
    this.symbol = new QuestSymbol(match.groups.symbol);
    const optionsLine = line.slice(match.index + match[0].length);

    let timeValue0 = -1, timeValue1 = -1, currentTimeValue = 0;
    for (const option of optionsLine.matchAll(OPTIONS)) {
      const g = option.groups;
      if (g.ddhhmm != null || g.hhmm != null || g.mm != null) {
        const timeValue = matchTimeValue(option[0]);
        if (currentTimeValue === 0) { timeValue0 = timeValue; currentTimeValue++; }
        else if (currentTimeValue === 1) { timeValue1 = timeValue; currentTimeValue++; }
        else throw new Error('Clock cannot specify more than 2 time values.');
      }
      if (g.flag != null) this.flag = questParseInt(g.flag);
      if (g.minRange != null) this.minRange = questParseInt(g.minRange);
      if (g.maxRange != null) this.maxRange = questParseInt(g.maxRange);
    }

    const roll = this.parentQuest?.rolls ?? Math.random;
    const fromRange = (min, max) => min + Math.floor(roll() * (max + 1 - min));   // Random.Range(min, max+1)

    // AUDIT TIMEFREE T3: a clock declared at an explicit zero with no travel arm (`Clock _end_ 00:00`) is the script's
    // "at once" - never a deadline, whatever its end does (S0000106's start-up favour, M0B40Y05's close)
    this.declaredAtOnce = (currentTimeValue === 1 && timeValue0 === 0) || (currentTimeValue === 2 && timeValue0 === 0 && timeValue1 <= 0);
    let clockTimeInSeconds = 0;
    if (currentTimeValue === 0) {
      // "clock _symbol_": random between 1 minute and 1 week
      clockTimeInSeconds = fromRange(getTimeInSeconds(0, 0, 1), getTimeInSeconds(7, 0, 0));
    } else if (currentTimeValue === 1) {
      clockTimeInSeconds = timeValue0;
    } else if (currentTimeValue === 2) {
      clockTimeInSeconds = timeValue1 > timeValue0 ? fromRange(timeValue0, timeValue1) : timeValue0;
    }

    // flag&16: 2.5x cautious travel time of the quest's Places; the
    // flag&1 + maxRange>0 + zero-time HACK forces the same check.
    if (travelArmed(this.flag, this.maxRange, clockTimeInSeconds)) {
      this.declaredAtOnce = false;   // (a travel clock: 2.5 trips, not "at once")
      const travel = this.parentQuest?.travelSeconds?.();
      if (travel != null) clockTimeInSeconds = travel;
      else { this.travelTimePending = true; clockTimeInSeconds = 0; }
    }

    this.startingTimeInSeconds = clockTimeInSeconds;
    this.remainingTimeInSeconds = clockTimeInSeconds;
  }

  get isClock() { return true; }

  /** TIMEFREE (REST8's reading): this clock is a deadline. The script's reading is asked once (the tasks do not change
   *  after the parse); AUDIT TIMEFREE T1's run-time half is asked every time: once the quest is a SUCCESS (`give pc`,
   *  `give pc nothing`, `train pc` set it), no clock is a loss any more, and a deadline a task started is the script
   *  closing the quest - S0000009's two days after the contact, whose reward a `when` on the same click pays. A clock the
   *  start-up block started stays a deadline: A0C41Y18 is a success from its first lines and keeps its finger and its
   *  gold for its 1001 days, as DFU does - but for a start-up closing (closesStartUp, BODYGUARD-CLOSE: the start-up block
   *  settles nothing and the end only closes; The Bodyguard's `_timer_`). AUDIT TIMEFREE T5: and so does one started
   *  AFTER the success - a new limit, not a close: M0B11Y18 pays for the raid, then offers the traitor's hunt and "will
   *  wait =gettraitor_ days"; closed on the success, that hunt ended a couple of minutes after the player took it. */
  get isDeadline() {
    const q = this.parentQuest;
    if (this._deadline == null) {
      const name = this.symbol?.name;
      const atOnce = this.declaredAtOnce && !/^_2.*_$/.test(this.symbol?.original ?? '');   // (a `_2place_` clock's zero is its trip, StartTimer's)
      this._deadline = (ONLINE_DEADLINES[q?.questName] ?? []).includes(name)
        || (!(ONLINE_CLOSINGS[q?.questName] ?? []).includes(name) && !atOnce && clockIsDeadline(q, this));
      // AUDIT REST-PARTY D1/D4: never a table entry - the hand's word stands through the success (B0B81Y02's artifact
      // hunt outlives the knight's reward), and until D4 nothing failed when the exemption went
      this._closesOnSuccess = this._deadline && !(ONLINE_DEADLINES[q?.questName] ?? []).includes(name)
        && !!q?.tasks && (startersOf(q, name).length > 0 || closesStartUp(q, name));   // BODYGUARD-CLOSE: a start-up closing too
    }
    return this._deadline && !(this._closesOnSuccess && q?.questSuccess && !this.startedAfterSuccess);
  }

  /** REST8: this clock takes the SHORT WAIT - a delay on a quest online: its remainder cut to ONLINE_DELAY_SECONDS
   *  (tick, liveRemainingSeconds), its day count "a few" (expandMacro), no "Time remains" for it (questBridge's walk).
   *  A deadline answers false, online and off, and is QCLOCK-WORLD's: played time, DFU's end. (Online asked first, so
   *  an offline or headless quest never reads its script.) */
  get waitsShort() { return questWaitsShort(this.parentQuest) && !this.isDeadline; }

  /** Q2 - Clock.cs Tick: whole world-seconds since the last sample
   *  come off the remainder; at zero the SAME-NAMED task starts and
   *  the clock finishes. The world clock is the quest's nowSeconds (TIME3: online the character's own, charged only as
   *  it moves with the world - QCLOCK-WORLD)
   *  seam (classic game seconds, machine-injected). */
  /** ExpandMacro (Clock.cs): =symbol_ answers days remaining (the
   *  ShowQuestJournalClocksAsCountdown setting picks remaining vs
   *  starting; DFU default false = the STARTING time), Ceiling of
   *  seconds/86400. */
  expandMacro(macroType) {
    if (macroType !== 5) return false;   // DetailsMacro
    // REST8 (TIMEFREE's words, for a delay alone): online a wait is no count of days - "come back in =wait_ days" reads
    // "come back in a few days" and lands about two real minutes on; a deadline's "you have =x_ days" keeps its number,
    // the days it runs in play
    if (this.waitsShort) return 'a few';
    const secs = this.parentQuest?.hooks?.world?.showClocksAsCountdown?.()
      ? this.remainingTimeInSeconds : this.startingTimeInSeconds;
    return String(Math.ceil(secs / 86400));
  }

  /** The seconds the NEXT tick charges as of the caller's now: the gap since the last sample, and online (a finite
   *  played step) never negative and never more than one step. ONE arithmetic - tick subtracts it, and
   *  liveRemainingSeconds reads it - so a reader can never disagree with the charge.
   *  TIME3: online the quest's clock is the character's own (LIVED1), and the gap has two parts: the time RAISED since
   *  the sample (a rest, a loiter, a journey, a sentence - the session's count, raisedSeconds) and the time lived with
   *  the world, the event clock's own movement while they play. QCLOCK-WORLD (2026-10-02, Mac: "go back to the quest
   *  timer tied to the online world clock"; asked, "Shared world clock" - resting, waiting and travel spend no quest
   *  days): online only the lived part is charged, one played step at most (WORLD7's law: the rest is time away,
   *  forgiven), and a raise never. [SUPERSEDES TIME3's raise charged whole, and TIMEFREE's quests without time.]
   *  Offline the one clock's raw gap stands, DFU's own arithmetic. Never more than the clock moved, never less than
   *  nothing. */
  chargeSeconds(caller) {
    const now = wholeSeconds(caller);
    const step = caller.questClockStepMax?.() ?? Infinity;
    const raw = now - this._lastWorldTimeSample;
    if (!Number.isFinite(step)) return Math.trunc(raw);
    const raised = raisedSince(caller.raisedSeconds?.(), this._lastRaisedSample);
    return Math.trunc(Math.min(Math.max(raw - raised, 0), step));   // QCLOCK-WORLD: the lived step, never the raise
  }

  /** QT-LIVE1 (Mac, 2026-09-21: "The time doesn't print out live?"): the remainder AS OF NOW. The machine ticks off
   *  the frame loop and every host holds that tick under the pause gate, so `remainingTimeInSeconds` is the remainder
   *  as of the last tick BEFORE the menu opened - and online the world runs on under the menu, so a journal reading
   *  the field showed a number the next tick would already have moved past. This is that next tick's answer without
   *  taking it: the field less the charge, floored at zero. A clock that is not running answers its field. REST8: a
   *  delay online reads from the short wait, the cut the next tick makes - the one arithmetic still. */
  liveRemainingSeconds(caller) {
    if (!this.clockEnabled || this.clockFinished) return this.remainingTimeInSeconds;
    if (this.waitsShort) return Math.max(0, Math.min(this.remainingTimeInSeconds, ONLINE_DELAY_SECONDS) - this.chargeSeconds(caller));
    return Math.max(0, this.remainingTimeInSeconds - this.chargeSeconds(caller));
  }

  tick(caller) {
    if (!this.clockEnabled || this.clockFinished) return;
    const now = wholeSeconds(caller);
    // WORLD7: online a clock charges PLAYED time - the frame's world time, never more than one played step (the
    // hosts' word through the quest: PLAYED_STEP_MAX_SECONDS under the shared clock, no bound offline). A gap past the
    // step is time away and is forgiven, the sample moved. WORLD5 stood every clock down instead (Mac, WORLD1: "time
    // limits on quest ... naturally disabled while online"), and a Daggerfall clock is a DELAY as often as a limit:
    // Brisienna's letter (7-14 days), the tutorial's pages, every "come back in three days" never came, and the main
    // quest never began online. A limit still stands, in hours played; none expires while away.
    // AUDIT WORLD7/8 A1-A2: online the sample can sit AHEAD of the world - an offline save is game-weeks past the shared
    // calendar, the relay's welcome can correct this machine's clock backwards - and a negative gap ADDED its whole span
    // to every running clock (Brisienna's fourteen days became forty-four played, for exactly the character Mac
    // brought over). Online a backward sample is a resume: nothing charged, the sample moved. Offline the raw gap
    // stands, DFU's own arithmetic (a backward jump there is a load, whose sample is the save's).
    // REST8: online a DELAY's remainder is cut once to the short wait, then charged as any clock (the played step, never
    // a raise) - its beat lands about two real minutes on. A DEADLINE is charged as QCLOCK-WORLD charges it and fires
    // as DFU's, armed at nothing too (TIMEFREE froze it, and its T7 guard went with the freeze).
    if (this.waitsShort) this.remainingTimeInSeconds = Math.min(this.remainingTimeInSeconds, ONLINE_DELAY_SECONDS);
    this.remainingTimeInSeconds -= this.chargeSeconds(caller);
    if (this.remainingTimeInSeconds <= 0) {
      this._triggerTask(caller);
      this.clockEnabled = false;
      this.clockFinished = true;
      this.remainingTimeInSeconds = 0;
    }
    this._lastWorldTimeSample = now;
    this._lastRaisedSample = caller.raisedSeconds?.() ?? null;   // TIME3
  }

  /** StartTimer, with the "_2place_" arm: a clock named _2X_ over a
   *  place _X_ computes a one-way trip at start time - which needs the
   *  Q3 travel seam (quest.travelSecondsTo); absent, the arm is
   *  skipped loudly via travelTimePending. */
  startTimer() {
    if (this.clockEnabled) return;
    if (this.symbol.original.startsWith('_2') && this.symbol.original.endsWith('_') && this.startingTimeInSeconds === 0) {
      const inner = this.symbol.original.slice(2, -1);
      const targetPlace = this.parentQuest.getPlace?.(new QuestSymbol(inner));
      if (targetPlace) {
        const travel = this.parentQuest.travelSecondsTo?.(targetPlace);
        if (travel != null) {
          this.startingTimeInSeconds = travel;
          this.remainingTimeInSeconds = travel;
        } else {
          this.travelTimePending = true;
        }
      }
    }
    // AUDIT quest-P15: a flag&16 / hack clock whose travel time pends
    // Q3 would otherwise arm at 0s and fire on the FIRST tick - the
    // exact instant-end symptom the C# hack exists to prevent. HELD
    // (disabled, loud) until the travel seam lands; never a made-up
    // number, never an instant quest end.
    if (this.travelTimePending && this.startingTimeInSeconds === 0) {
      console.warn(`[quest] clock ${this.symbol?.name}: travel-time arm pends Q3; timer held`);
      return;
    }
    if (!this.clockFinished) {
      this.clockEnabled = true;
      this.startedAfterSuccess = !!this.parentQuest?.questSuccess;   // AUDIT TIMEFREE T5
      this._lastWorldTimeSample = wholeSeconds(this.parentQuest);
      this._lastRaisedSample = this.parentQuest.raisedSeconds?.() ?? null;   // TIME3
    }
  }

  stopTimer() {
    if (!this.clockFinished) this.clockEnabled = false;
  }

  _triggerTask(caller) {
    const task = caller.getTask(this.symbol);
    if (task) task.start();
    else console.warn(`[quest] Clock timer ${this.symbol.name} completed but could not find a task with same name.`);
  }

  // ---- the save envelope (Q4-iv; Clock.cs:490-530) ----

  getSaveData() {
    return {
      lastWorldTimeSample: this._lastWorldTimeSample,
      startingTimeInSeconds: this.startingTimeInSeconds,
      remainingTimeInSeconds: this.remainingTimeInSeconds,
      flag: this.flag,
      minRange: this.minRange,
      maxRange: this.maxRange,
      clockEnabled: this.clockEnabled,
      clockFinished: this.clockFinished,
      startedAfterSuccess: this.startedAfterSuccess,   // AUDIT TIMEFREE T5 (the port's; absent from a save before it - false)
      declaredAtOnce: this.declaredAtOnce,   // AUDIT REST-PARTY D3 (the port's; a restore has no declaration to read)
    };
  }

  /** RestoreSaveData: plain assigns; the saved starting time is
   *  authoritative, so the port's travelTimePending (headless-only)
   *  clears. */
  restoreSaveData(dataIn) {
    if (dataIn == null) return;
    this._lastWorldTimeSample = Number.isFinite(dataIn.lastWorldTimeSample) ? dataIn.lastWorldTimeSample : wholeSeconds(this.parentQuest);   // AUDIT WORLD7/8 A11: a save from before the field stamped NaN into the remainder
    this._lastRaisedSample = this.parentQuest?.raisedSeconds?.() ?? null;   // TIME3: a restore (a load, a party member's copy) is a resume - no raise counted ACROSS it (AUDIT TIME: the count now, so a raise after it, before the first tick, is a raise - QCLOCK-WORLD: charged nothing)
    this.startingTimeInSeconds = dataIn.startingTimeInSeconds;
    this.remainingTimeInSeconds = dataIn.remainingTimeInSeconds;
    this.flag = dataIn.flag;
    this.minRange = dataIn.minRange;
    this.maxRange = dataIn.maxRange;
    this.clockEnabled = dataIn.clockEnabled;
    this.clockFinished = dataIn.clockFinished;
    this.startedAfterSuccess = dataIn.startedAfterSuccess === true;   // AUDIT TIMEFREE T5
    // AUDIT REST-PARTY D3: the "at once" mark rides the save. A restored clock is built bare (Quest.restoreSaveData) and
    // has no declaration to read, so it came back false and S0000106's start-up favour (`Clock _delay_ 00:00`) read as a
    // deadline after every load, a party member's copy and a resync. A save from before the mark: the parse's own
    // predicate over what the save kept - a zero starting time and no travel arm. All 399 vendored clocks read the same
    // either way; only a two-value range drawn at zero (`00:00 01:00`) could differ, and no script declares one.
    this.declaredAtOnce = typeof dataIn.declaredAtOnce === 'boolean' ? dataIn.declaredAtOnce
      : this.startingTimeInSeconds === 0 && !travelArmed(this.flag, this.maxRange, 0);
    this.travelTimePending = false;
  }
}
