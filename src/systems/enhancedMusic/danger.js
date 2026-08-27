// ENHANCED MUSIC - the danger meter. (EM4, 2026-08-27: "This is danger.")
//
// Mac's twist: a place's track crossfades into its DANGER track when
// the enemies have you, and back when they have lost you. Daggerfall
// has no such thing and DFU nothing to port; what IS DFU's is the
// signal - "an enemy that can see the player" is AreEnemiesNearby's own
// definition (encounters.areEnemiesNearby: `detected && inSight`), the
// law that refuses a rest. The meter reads the same fields.
//
// PROJECT-FINAL'S LESSON, kept: the stem arc drove its mix from a
// per-frame threat number and the music fluttered. This is a SLEW: it
// rises fast (a foe seeing you is news), HOLDS after the last sighting,
// and then falls slowly, and the on/off decision has hysteresis - so
// one foe stepping behind a pillar does not flip the music, and the
// danger track ends a beat after the fight does, not the frame the
// last foe dies. Pure: no audio, no globals, a function of dt.

/** The raw danger this frame, 0..1: every living foe that can see the
 *  player counts, nearer counting more; two in your face saturate it.
 *  `foes` are the hosts' own AI records (f.ai.detected, .inSight,
 *  ._dist, f.dead), exactly what areEnemiesNearby reads. */
export function dangerRaw(foes, { reach = 30 } = {}) {
  let sum = 0;
  for (const f of foes ?? []) {
    if (!f || f.dead || !f.ai) continue;
    if (!(f.ai.detected && f.ai.inSight)) continue;
    const dist = Number.isFinite(f.ai._dist) ? f.ai._dist : reach;
    sum += Math.max(0.25, Math.min(1, 1 - dist / reach));
  }
  return Math.min(1, sum);
}

export class DangerMeter {
  /**
   * @param {object} [tuning]
   * @param {number} [tuning.rise]  seconds to reach ~63% of a step up (fast)
   * @param {number} [tuning.hold]  seconds the level HOLDS after the raw signal drops
   * @param {number} [tuning.fall]  seconds to lose ~63% after the hold (slow)
   * @param {number} [tuning.on]    level at which danger switches ON
   * @param {number} [tuning.off]   level at which it switches OFF (below `on`: hysteresis)
   */
  constructor({ rise = 0.35, hold = 6, fall = 5, on = 0.5, off = 0.15 } = {}) {
    Object.assign(this, { rise, hold, fall, on, off });
    this.reset();
  }

  reset() { this.level = 0; this.active = false; this._held = 0; }

  /** One frame. Returns true when `active` CHANGED this frame. */
  update(dt, raw) {
    const r = Math.max(0, Math.min(1, raw));
    const step = Math.max(0, Math.min(1, dt));
    if (r >= this.level) {
      this.level += (r - this.level) * (1 - Math.exp(-step / this.rise));
      this._held = 0;
    } else if (this._held < this.hold) {
      this._held += step;                       // the hold: the fight is not over because you blinked
    } else {
      this.level += (r - this.level) * (1 - Math.exp(-step / this.fall));
    }
    const was = this.active;
    if (!was && this.level >= this.on) this.active = true;
    else if (was && this.level <= this.off) this.active = false;
    return this.active !== was;
  }
}
