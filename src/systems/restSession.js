// The rest session machine (Systems side of U7). Behavior ported
// from DFU's DaggerfallRestWindow (MIT, Daggerfall Workshop) - the
// hour ticking, interrupts, and completion rules; the panel itself
// lives in ui/restWindow.js.
//
// Timing: an hour of rest passes in restWaitTimePerHour = 0.75 REAL
// seconds (loiter 1.25), advanced in minutesPerTick = 10 classic-
// minute sub-ticks (6 per hour) so world time - and with it our
// magic rounds, diseases, poisons - flows through the rest exactly
// as DFU's RaiseTime does. Each completed HOUR: the enemy check
// (the RESTING AreEnemiesNearby variant - an aware foe at any
// spawn-band range, an unaware one only within 12 units) breaks the
// rest (TEXT.RSC 354); then vitals tick for TimedRest/FullRest (the
// S20 per-hour rates + a Medical tally - loiter recovers NOTHING)
// and the mode's completion is checked: FullRest ends when fully
// healed (health AND fatigue full, magicka full or NoRegenSpellPoints
// - TEXT.RSC 350 "You are healed."), TimedRest when the hours run
// out (353 "You wake up."), Loiter likewise (349). Death mid-rest
// ends the session at once (the scene's death screen takes over;
// DFU's "You never awaken." line rides that flow).
//
// Pre-rest gates (the scene owns them, constants here): enemies
// nearby -> 354; swimming or airborne -> 355 "You cannot rest now.";
// loiter requests above the classic 3-hour cap are refused with the
// cannot-loiter lines. Building trespass/rent rules pend towns.

export const MINUTES_PER_TICK = 10;          // classic minutes per sub-tick
export const REST_WAIT_PER_HOUR = 0.75;      // real seconds per rested hour
export const LOITER_WAIT_PER_HOUR = 1.25;    // loiter runs slower
export const LOITER_LIMIT_HOURS = 3;         // classic's cap (DFU LoiterLimitInHours default)

export const REST_TEXT = Object.freeze({
  loiterDone: 349, healed: 350, wakeUp: 353, enemiesNearby: 354, cannotRestNow: 355,
});
export const REST_PROMPT = 'Rest how many hours : ';
export const LOITER_PROMPT = 'Loiter how many hours : ';
export const CANNOT_LOITER_LINES = Object.freeze([
  'You cannot loiter more', `than ${LOITER_LIMIT_HOURS} hours at a time.`,
]);

/**
 * One running rest. mode = 'timed' | 'full' | 'loiter'; hours only
 * for timed/loiter. deps (the scene's):
 *   advanceMinutes(n)  - move the classic clock (magic rounds catch up)
 *   tickVitals()       - apply the three per-hour rates + the Medical
 *                        tally; returns TRUE when fully healed
 *   enemiesNearby()    - the RESTING variant
 *   dead()             - health gone (disease/poison through the hours)
 * tick(dt) returns null while running, else the end result
 * { textId, enemyBroke, died }.
 */
export class RestSession {
  constructor(mode, hours, deps) {
    this.mode = mode;
    this.hoursRemaining = hours ?? 0;
    this.deps = deps;
    this.totalHours = 0;
    this._minutesOfHour = 0;
    this._timer = 0;
    this._subTickEvery = (mode === 'loiter' ? LOITER_WAIT_PER_HOUR : REST_WAIT_PER_HOUR) / (60 / MINUTES_PER_TICK);
  }

  /** End the session early (the toggle key / Escape): the mode's own
   *  finish text, exactly as DFU's EndRest on the rest binding. */
  endEarly() {
    return { textId: this.mode === 'loiter' ? REST_TEXT.loiterDone : REST_TEXT.wakeUp, enemyBroke: false, died: false };
  }

  tick(dt) {
    // The per-frame checks (DFU's Update): death ends at once (the
    // death flow owns the message); an already-healed FullRest ends
    // without waiting for an hour; a spent timed/loiter count ends.
    if (this.deps.dead()) return { textId: null, enemyBroke: false, died: true };
    if (this.mode === 'full' && this.deps.fullyHealed?.()) return { textId: REST_TEXT.healed, enemyBroke: false, died: false };
    if (this.mode !== 'full' && this.hoursRemaining < 1) return this.endEarly();

    this._timer += dt;
    while (this._timer >= this._subTickEvery) {
      this._timer -= this._subTickEvery;
      this.deps.advanceMinutes(MINUTES_PER_TICK);
      this._minutesOfHour += MINUTES_PER_TICK;
      if (this._minutesOfHour < 60) continue;
      this._minutesOfHour = 0;
      this.totalHours++;
      // A full hour: the enemy break first, then vitals/completion.
      if (this.deps.enemiesNearby()) return { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false };
      if (this.mode === 'timed') {
        this.deps.tickVitals();
        if (--this.hoursRemaining < 1) return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false };
      } else if (this.mode === 'full') {
        if (this.deps.tickVitals()) return { textId: REST_TEXT.healed, enemyBroke: false, died: false };
      } else {
        if (--this.hoursRemaining < 1) return { textId: REST_TEXT.loiterDone, enemyBroke: false, died: false };
      }
    }
    return null;
  }
}
