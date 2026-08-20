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
// UnityEngine.Random -> injectable uniform roll (Ledger A).
// The tick half (enable/stop, TriggerTask on zero) ships with the
// machine (Q2).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';

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

export function matchTimeValue(text) {
  const m = matchFirst(text, TIME_VALUE);
  if (!m) return 0;
  const g = m.groups;
  const days = questParseInt(g.days ?? '');
  const hours = questParseInt(g.hours ?? g.h2 ?? '');
  const minutes = questParseInt(g.minutes ?? g.m2 ?? g.m3 ?? '');
  return getTimeInSeconds(days, hours, minutes);
}

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
    this.travelTimePending = false;   // Q1: the flag&16 / flag&1-hack arms pend Place resolution (Q3)
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
    if ((this.flag & 16) === 16 || ((this.flag & 1) === 1 && this.maxRange > 0 && clockTimeInSeconds === 0)) {
      const travel = this.parentQuest?.travelSeconds?.();
      if (travel != null) clockTimeInSeconds = travel;
      else { this.travelTimePending = true; clockTimeInSeconds = 0; }
    }

    this.startingTimeInSeconds = clockTimeInSeconds;
    this.remainingTimeInSeconds = clockTimeInSeconds;
  }

  get isClock() { return true; }

  /** Q2 - Clock.cs Tick: whole world-seconds since the last sample
   *  come off the remainder; at zero the SAME-NAMED task starts and
   *  the clock finishes. The world clock is the quest's nowSeconds
   *  seam (classic game seconds, machine-injected). */
  tick(caller) {
    if (!this.clockEnabled || this.clockFinished) return;
    const now = caller.nowSeconds?.() ?? 0;
    const difference = now - this._lastWorldTimeSample;
    this.remainingTimeInSeconds -= Math.trunc(difference);
    if (this.remainingTimeInSeconds <= 0) {
      this._triggerTask(caller);
      this.clockEnabled = false;
      this.clockFinished = true;
      this.remainingTimeInSeconds = 0;
    }
    this._lastWorldTimeSample = now;
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
      this._lastWorldTimeSample = this.parentQuest.nowSeconds?.() ?? 0;
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
}
