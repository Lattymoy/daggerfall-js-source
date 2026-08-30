// AUDIT 28 W2d - THE NEAR-DEATH WARNING: HUDFlickerController.cs,
// HUDFlickerBase.cs, HUDFlickerFast.cs, HUDFlickerSlow.cs (MIT,
// Daggerfall Workshop), ported whole. Enhancements/NearDeathWarning
// ships True and the port had nothing behind it.
//
// The shape: DaggerfallHUD.Update calls flickerController.NextCycle()
// every frame (:328). Below 40% health (`injuredThreshold`) a FAST red
// flicker runs on each new health loss - seven reversals and it times
// out; below 20% (`woundedThreshold`) a SLOW throb takes over between
// fast bursts and never times out on its own. The colour lands on the
// HUD's PARENT PANEL BackgroundColor - a full-screen tint under every
// HUD element - which is why it is drawn here as a screen quad under
// the bars, the same quad the damage flash uses.
//
// Pure: the controller takes the frame's dt, the detector's HealthLost
// and a roll, and answers the colour. Time.deltaTime is the argument,
// Random.Range(0f, 1f) is `rolls()`, and the two gates that read the
// fade system (FadeInProgress, the parent's alpha > 0.9) are the one
// departure: the port's HUD has no fade behaviour to read, so they are
// answered false and recorded.

/** HUDFlickerController.cs:24-25. */
export const INJURED_THRESHOLD = 0.4;
export const WOUNDED_THRESHOLD = 0.2;

/** HUDFlickerBase's AlphaDirection. */
export const ALPHA_DIRECTION = Object.freeze({ None: 0, Decreasing: 1, Increasing: 2 });

/** RandomlyReverseAlphaDirection's constants (HUDFlickerBase.cs). */
const MIN_CHANCE = -0.01;   // "negative so it takes a little while before it can reverse at least"
const CHANCE_STEP = 0.008;

/**
 * HUDFlickerBase, with Fast and Slow as the two Init tables. The base
 * constructor calls Init(), so a fresh flicker is a live one.
 */
export class HudFlicker {
  constructor(kind) {
    this.kind = kind;
    this.chanceReverseState = 0;
    this.init();
  }

  /** HUDFlickerFast.Init / HUDFlickerSlow.Init, verbatim. */
  init() {
    this.isTimedOut = false;
    if (this.kind === 'fast') {
      this.alphaSpeed = 7.0;
      this.alphaLower = 0.0;
      this.alphaUpper = 0.4;
      this.redValue = 0.3984;
      this.alphaValue = this.alphaLower;
      this.reversalCount = 0;
      this.reversalCountThreshold = 7;
    } else {
      this.alphaSpeed = 0.2;
      this.alphaLower = 0.1;
      this.alphaUpper = 0.4;
      this.alphaValue = this.alphaLower;
      this.redValue = 0.0;
      this.reversalCount = 0;
      this.reversalCountThreshold = -1;
    }
    this.alphaDirection = ALPHA_DIRECTION.Increasing;
  }

  _reverse() {
    if (this.alphaDirection === ALPHA_DIRECTION.Increasing) this.alphaDirection = ALPHA_DIRECTION.Decreasing;
    else if (this.alphaDirection === ALPHA_DIRECTION.Decreasing) this.alphaDirection = ALPHA_DIRECTION.Increasing;
    if (this.reversalCount !== -1) this.reversalCount++;
  }

  /** RandomlyReverseAlphaDirection: the chance climbs by 0.008 a
   *  second from -0.01 and resets there on a reversal. */
  _randomlyReverse(dt, rolls) {
    if (this.alphaDirection === ALPHA_DIRECTION.None) return;
    this.chanceReverseState += CHANCE_STEP * dt;
    if (rolls() < this.chanceReverseState) {
      this.chanceReverseState = MIN_CHANCE;
      this._reverse();
    }
  }

  /** CheckReverseAlphaDirection, verbatim - the bound reversal first,
   *  else the random one while inside the band. */
  _checkReverse(dt, rolls) {
    if ((this.alphaDirection === ALPHA_DIRECTION.Increasing && this.alphaValue >= this.alphaUpper)
      || (this.alphaDirection === ALPHA_DIRECTION.Decreasing && this.alphaValue <= this.alphaLower)) {
      this._reverse();
    } else if (this.alphaValue >= this.alphaLower && this.alphaValue <= this.alphaUpper) {
      this._randomlyReverse(dt, rolls);
    }
  }

  /** SetAlphaValue: an override lands as-is; a timed-out or directionless
   *  flicker is 0; else the alpha walks at alphaSpeed and clamps to
   *  [0, alphaUpper] - the LOWER bound is NOT the clamp floor. */
  _setAlpha(dt, overrideValue = -1) {
    if (overrideValue !== -1) { this.alphaValue = overrideValue; return; }
    const timedOut = this.reversalCount >= this.reversalCountThreshold && this.reversalCountThreshold !== -1;
    if (timedOut || this.alphaDirection === ALPHA_DIRECTION.None) this.alphaValue = 0;
    else if (this.alphaDirection === ALPHA_DIRECTION.Decreasing) this.alphaValue -= this.alphaSpeed * dt;
    else if (this.alphaDirection === ALPHA_DIRECTION.Increasing) this.alphaValue += this.alphaSpeed * dt;
    this.alphaValue = Math.min(Math.max(this.alphaValue, 0), this.alphaUpper);
  }

  /** Cycle (:88-102). */
  cycle(dt, rolls = Math.random) {
    if (!this.isTimedOut) {
      if (this.reversalCount >= this.reversalCountThreshold && this.reversalCountThreshold !== -1) this.isTimedOut = true;
      this._checkReverse(dt, rolls);
      this._setAlpha(dt);
    } else {
      this._setAlpha(dt, 0);
    }
  }
}

/** HUDFlickerController.GetPlayerCondition (:31-41): Dead at <= 0
 *  health, then the two thresholds on CurrentHealthPercent (`<`). */
export function playerCondition(health, maxHealth) {
  if (health <= 0) return 'Dead';
  const pct = maxHealth > 0 ? health / maxHealth : 0;
  if (pct < WOUNDED_THRESHOLD) return 'Wounded';
  if (pct < INJURED_THRESHOLD) return 'Injured';
  return 'Normal';
}

/**
 * HUDFlickerController, one per HUD. `nextCycle` answers the colour
 * the parent panel takes this frame - [r, 0, 0, a] - or null when the
 * controller does not write (the setting off, the fade gates, or a
 * dead player: :78 skips the assignment, so the last colour stands).
 */
export class HudFlickerController {
  constructor() {
    this.fast = new HudFlicker('fast');
    this.slow = new HudFlicker('slow');
    this.backColor = [0, 0, 0, 0];   // Parent.BackgroundColor - cleared by the default arm
  }

  /**
   * NextCycle (:43-83).
   * @param {{health:number, maxHealth:number, healthLost:number, dt:number,
   *          enabled?:boolean, fadeInProgress?:boolean, parentAlpha?:number, rolls?:Function}} f
   * @returns {number[]|null} the colour written this frame, or null
   */
  nextCycle({ health, maxHealth, healthLost = 0, dt, enabled = true, fadeInProgress = false, parentAlpha = 0, rolls = Math.random }) {
    if (!enabled || fadeInProgress || parentAlpha > 0.9) return null;
    const condition = playerCondition(health, maxHealth);
    // HealthLost > 0 restarts a timed-out fast flicker; HealthGain > 0
    // (a NEGATIVE loss) times the slow throb out unless Wounded.
    if (healthLost > 0 && this.fast.isTimedOut) this.fast.init();
    if (-healthLost > 0 && condition !== 'Wounded') this.slow.isTimedOut = true;
    let backColor;
    switch (condition) {
      case 'Injured':
        this.fast.cycle(dt, rolls);
        backColor = [this.fast.redValue, 0, 0, this.fast.alphaValue];
        break;
      case 'Wounded':
        this.fast.cycle(dt, rolls);
        this.slow.isTimedOut = !this.fast.isTimedOut;
        this.slow.cycle(dt, rolls);
        backColor = this.fast.isTimedOut
          ? [this.slow.redValue, 0, 0, this.slow.alphaValue]
          : [this.fast.redValue, 0, 0, this.fast.alphaValue];
        break;
      default:
        backColor = [0, 0, 0, 0];   // new Color()
        break;
    }
    if (condition !== 'Dead' && !sameColor(backColor, this.backColor)) this.backColor = backColor;
    return condition === 'Dead' ? null : this.backColor;
  }
}

const sameColor = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
