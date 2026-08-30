// VB1 - THE VITALS INDICATORS (F148) AND THE COLOUR SWAP (F149).
// Three DFU members, ported whole (MIT, Daggerfall Workshop):
//
//   HUDVitals.cs            the nine-bar rig: three art-filled main
//                           bars, three dark SMOOTHED LOSS trails
//                           behind them, three bright INSTANT GAIN
//                           bars between (:30-46, :99-119), plus the
//                           health/fatigue art-and-colour swap
//                           (:181-198)
//   VerticalProgressSmoother.cs  the 0.4s lerp with its two entry
//                           delays (-0.5s cold, -0.25s re-triggered)
//   VitalsChangeDetector.cs the previous-value snapshot that turns
//                           raw vital writes into Lost/Gain events
//
// EnableVitalsIndicators ships TRUE, so DFU's damage trail - the dark
// band that lingers where health just was, and the bright band that
// leads where it is going - is the DEFAULT look, and the port's three
// plain bars were the setting-FALSE path all along (the F148 row).
//
// TWO RIGS, ONE DETECTOR - DFU's own shape, not a simplification:
// DaggerfallHUD owns one HUDVitals and HUDLarge owns ANOTHER
// (HUDLarge.cs:66), while GameManager holds the single
// VitalsChangeDetector both subscribe to. Both rigs take every change
// event; only the ENABLED one Updates (HUDVitals.cs:206), which is why
// the idle rig drifts stale and DFU resets the detector on the large-
// HUD toggle (VitalsChangeDetector.cs:160-164) - ported here as the
// mode-flip unprime in updateHudVitals.
//
// THE DETECTOR'S PAUSE GATE (VitalsChangeDetector.cs:68-69) is
// IsGamePaused; the port's nearest seam is the active cursor - every
// overlay that pauses the world frees the pointer. The smoother
// freezes with it: DFU pauses via Time.timeScale = 0, which zeroes the
// deltaTime Cycle adds (VerticalProgressSmoother.cs:40), so a paused
// frame passes dt 0 here.
//
// DFU's other detector resets - world init, save load, the court
// screen (VitalsChangeDetector.cs:139-158) - need no port seam: every
// one of those paths boots a scene host afresh (the load flows
// navigate), and module state starts unprimed. The one reset the port
// CAN reach mid-frame-loop, the large-HUD toggle, is handled below.
//
// LoadAssets reads SwapHealthAndFatigueColors once at construction
// (:181), so DFU applies a swap flip on restart; the port reads it at
// draw time, the same per-frame posture largeHudEnabled already has -
// a flip lands on the next frame. Recorded here, not in the Ledger:
// the VALUES swapped are verbatim, only the read moment differs.

import { getBool } from '../systems/settings.js';

// HUDVitals.cs:41-46, Unity Color floats verbatim.
export const HEALTH_LOSS_COLOR = Object.freeze([0, 0.22, 0]);
export const FATIGUE_LOSS_COLOR = Object.freeze([0.44, 0, 0]);
export const MAGICKA_LOSS_COLOR = Object.freeze([0, 0, 0.44]);
export const HEALTH_GAIN_COLOR = Object.freeze([0.60, 1, 0.60]);
export const FATIGUE_GAIN_COLOR = Object.freeze([1, 0.50, 0.50]);
export const MAGICKA_GAIN_COLOR = Object.freeze([0.70, 0.70, 1]);

export const VITAL_KEYS = Object.freeze(['health', 'fatigue', 'magicka']);

export const vitalsIndicatorsEnabled = () => getBool('GUI', 'EnableVitalsIndicators');
export const swapHealthAndFatigueColors = () => getBool('GUI', 'SwapHealthAndFatigueColors');

/** LoadAssets (:181-202): the swap exchanges the health and fatigue
 *  bars' ART (MAIN03I0 <-> MAIN04I0) and their loss/gain colours;
 *  magicka never swaps. `art` is loadHud's map - the files stay loaded
 *  under their own names and the swap is a re-mapping, so both HUDs
 *  (hud.js's bars and hudLarge.js's, which reuse the same textures)
 *  swap together, exactly as DFU's two HUDVitals both run LoadAssets. */
export function vitalsSkin(art, swapped = swapHealthAndFatigueColors()) {
  return swapped ? {
    health: { img: art.fatigue, loss: FATIGUE_LOSS_COLOR, gain: FATIGUE_GAIN_COLOR },
    fatigue: { img: art.health, loss: HEALTH_LOSS_COLOR, gain: HEALTH_GAIN_COLOR },
    magicka: { img: art.magicka, loss: MAGICKA_LOSS_COLOR, gain: MAGICKA_GAIN_COLOR },
  } : {
    health: { img: art.health, loss: HEALTH_LOSS_COLOR, gain: HEALTH_GAIN_COLOR },
    fatigue: { img: art.fatigue, loss: FATIGUE_LOSS_COLOR, gain: FATIGUE_GAIN_COLOR },
    magicka: { img: art.magicka, loss: MAGICKA_LOSS_COLOR, gain: MAGICKA_GAIN_COLOR },
  };
}

// ── VerticalProgressSmoother, verbatim ─────────────────────────────

/** timerMax (VerticalProgressSmoother.cs:14). */
export const SMOOTH_TIMER_MAX = 0.4;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A VerticalProgress: Amount defaults to 1 and CLAMPS on every set
 *  (VerticalProgress.cs:25-31) - the clamp is why a huge hit cannot
 *  drive the main bar below empty. The smoother adds the timer trio. */
export function createSmoother() {
  return { amount: 1, prev: 0, target: 0, timer: 0, cycleTimer: false };
}

/** BeginSmoothChange (:21-33). The FIRST change waits half a second
 *  before moving; a change landing mid-cycle re-arms at only a quarter
 *  second - repeated hits keep the trail moving instead of resetting
 *  its delay in full each time. prev is captured from the CURRENT
 *  amount, mid-lerp or not. */
export function beginSmoothChange(bar, target) {
  if (bar.cycleTimer === false) {
    bar.cycleTimer = true;
    bar.timer = -0.5;
  } else {
    bar.timer = -0.25;
  }
  bar.prev = bar.amount;
  bar.target = target;
}

/** Cycle (:35-50): nothing moves until the (negative) timer climbs to
 *  zero, then a 0.4s lerp prev -> target; reaching timerMax disarms. */
export function cycleSmoother(bar, dt) {
  if (!bar.cycleTimer) return;
  bar.timer += dt;
  if (bar.timer >= 0) {
    const t = clamp01(bar.timer / SMOOTH_TIMER_MAX);
    bar.amount = clamp01(bar.prev + (bar.target - bar.prev) * t);
    if (bar.timer >= SMOOTH_TIMER_MAX) bar.cycleTimer = false;
  }
}

// ── VitalsChangeDetector, verbatim ─────────────────────────────────

/** The previous-value snapshot (VitalsChangeDetector.cs:22-27), plus
 *  a primed flag standing for Start()'s ResetVitals - the first update
 *  resets rather than reporting the whole bar as a change. */
export function createVitalsDetector() {
  return {
    primed: false,
    prevMaxHealth: 0, prevMaxFatigue: 0, prevMaxMagicka: 0,
    prevHealth: 0, prevFatigue: 0, prevMagicka: 0,
  };
}

/** Update + UpdateDeltas (:66-123). `cur` carries current and max for
 *  all three vitals. Any MAX change resets and reports nothing for
 *  the frame - "the current relative vital lost calculation is not
 *  valid when Max Vital changes" (:71-78) - which is also what
 *  re-syncs the bars after a level-up, a drain, or a new character.
 *  Answers { reset, health, fatigue, magicka } where each vital is
 *  null (no change) or { lost, lostPercent }; GainPercent is DFU's
 *  -1 * LostPercent and needs no field of its own. */
export function detectVitals(det, cur) {
  if (!det.primed
    || cur.maxHealth !== det.prevMaxHealth
    || cur.maxFatigue !== det.prevMaxFatigue
    || cur.maxMagicka !== det.prevMaxMagicka) {
    det.primed = true;
    det.prevMaxHealth = cur.maxHealth;
    det.prevMaxFatigue = cur.maxFatigue;
    det.prevMaxMagicka = cur.maxMagicka;
    det.prevHealth = cur.health;
    det.prevFatigue = cur.fatigue;
    det.prevMagicka = cur.magicka;
    // ResetVitals runs UpdateDeltas too (:135) - previous equals
    // current, so every Lost is zero and no event fires - then raises
    // OnReset, which is the caller's cue to SynchronizeImmediately.
    return { reset: true, health: null, fatigue: null, magicka: null };
  }
  const delta = (prev, c, max) => {
    const lost = prev - c;
    return lost !== 0 ? { lost, lostPercent: lost / max } : null;
  };
  const r = {
    reset: false,
    health: delta(det.prevHealth, cur.health, cur.maxHealth),
    fatigue: delta(det.prevFatigue, cur.fatigue, cur.maxFatigue),
    magicka: delta(det.prevMagicka, cur.magicka, cur.maxMagicka),
  };
  det.prevHealth = cur.health;
  det.prevFatigue = cur.fatigue;
  det.prevMagicka = cur.magicka;
  return r;
}

// ── HUDVitals, verbatim ────────────────────────────────────────────

/** One HUDVitals instance: main/loss smoothers, plain gain bars.
 *  Every amount starts at VerticalProgress's default 1. */
export function createVitalsRig() {
  const trio = (make) => ({ health: make(), fatigue: make(), magicka: make() });
  return {
    main: trio(createSmoother),
    loss: trio(createSmoother),
    gain: trio(() => ({ amount: 1 })),
  };
}

const ratioOf = (cur, key) =>
  clamp01((cur[key] ?? 0) / (key === 'health' ? cur.maxHealth : key === 'fatigue' ? cur.maxFatigue : cur.maxMagicka));

/** SynchronizeImmediately (:258-274) - every bar snaps to the live
 *  ratio; the indicator bars only when the setting is on, exactly as
 *  the member itself branches (:265). */
export function synchronizeImmediately(rig, cur, indicators = vitalsIndicatorsEnabled()) {
  for (const k of VITAL_KEYS) {
    rig.main[k].amount = ratioOf(cur, k);
    if (indicators) {
      rig.gain[k].amount = rig.main[k].amount;
      rig.loss[k].amount = rig.main[k].amount;
    }
  }
}

/** The three VitalsDetector_*Changed handlers (:290-358), one law.
 *  The gain bar snaps to the new ratio. On a LOSS the main bar drops
 *  by the lost fraction AT ONCE - leaving the dark loss bar holding
 *  the old level behind it - and on a GAIN the loss bar JUMPS UP by
 *  the gained fraction (GainPercent = -LostPercent) while the main
 *  bar holds; then BOTH smooth toward the live target, which is what
 *  animates the band shut. */
export function applyVitalsChange(rig, key, change, cur) {
  rig.gain[key].amount = ratioOf(cur, key);
  if (change.lost !== 0) {
    if (change.lost > 0) rig.main[key].amount = clamp01(rig.main[key].amount - change.lostPercent);
    else rig.loss[key].amount = clamp01(rig.loss[key].amount + -1 * change.lostPercent);
    const target = rig.gain[key].amount;
    beginSmoothChange(rig.main[key], target);
    beginSmoothChange(rig.loss[key], target);
  }
}

/** UpdateAllVitals (:276-288): "these progress bars never
 *  smooth-change" - the gains snap to the live ratio every frame,
 *  then the six smoothers Cycle. */
export function updateAllVitals(rig, cur, dt) {
  for (const k of VITAL_KEYS) rig.gain[k].amount = ratioOf(cur, k);
  for (const k of VITAL_KEYS) cycleSmoother(rig.loss[k], dt);
  for (const k of VITAL_KEYS) cycleSmoother(rig.main[k], dt);
}

// ── the two instances and the one detector (the host seam) ─────────

let _detector = createVitalsDetector();
let _rigs = { small: createVitalsRig(), large: createVitalsRig() };
let _lastLarge = null;
// AUDIT 28 W2d: VitalsChangeDetector.HealthLost as this frame's field -
// HUDFlickerController reads it off the same detector (:56-58).
let _lastHealthLost = 0;
/** The detector's HealthLost for the frame updateHudVitals last ran
 *  (0 on a reset frame, 0 while paused, negative on a gain). */
export const lastHealthLost = () => _lastHealthLost;

/** The tests' door, and what a fresh boot gets for free. */
export function _resetHudVitals() {
  _detector = createVitalsDetector();
  _rigs = { small: createVitalsRig(), large: createVitalsRig() };
  _lastLarge = null;
  _lastHealthLost = 0;
}

/**
 * One frame of the vitals rig, from drawHud. `isLarge` names which
 * HUDVitals instance is ENABLED this frame - only that one Updates
 * (HUDVitals.cs:206), though change events reach BOTH (each subscribes
 * to the one detector). A mode FLIP unprimes the detector, which is
 * DaggerfallHUD_OnLargeHUDToggle's ResetVitals (:160-164): the idle
 * rig took events without cycling and must resynchronize.
 * Answers the rig to draw from.
 */
export function updateHudVitals(isLarge, cur, dt, paused = false) {
  if (_lastLarge !== null && _lastLarge !== isLarge) _detector.primed = false;
  _lastLarge = isLarge;
  const indicators = vitalsIndicatorsEnabled();
  // VitalsChangeDetector.Update - skipped while paused (:68-69).
  _lastHealthLost = 0;
  if (!paused) {
    const ev = detectVitals(_detector, cur);
    _lastHealthLost = ev.health?.lost ?? 0;
    if (ev.reset) {
      // OnReset is STATIC (:45) - both instances hear it.
      synchronizeImmediately(_rigs.small, cur, indicators);
      synchronizeImmediately(_rigs.large, cur, indicators);
    } else if (indicators) {
      // the handlers bail without the setting (:292-295)
      for (const k of VITAL_KEYS) {
        const c = ev[k];
        if (c) { applyVitalsChange(_rigs.small, k, c, cur); applyVitalsChange(_rigs.large, k, c, cur); }
      }
    }
  }
  // HUDVitals.Update (:204-216), the enabled instance only. A paused
  // frame cycles with dt 0 - DFU's Time.timeScale = 0.
  const rig = isLarge ? _rigs.large : _rigs.small;
  if (indicators) updateAllVitals(rig, cur, paused ? 0 : dt);
  else synchronizeImmediately(rig, cur, indicators);
  return rig;
}

// ── the draw ───────────────────────────────────────────────────────

/**
 * Draw one HUD's vitals in DFU's Components.Add order (:108-119):
 * the three LOSS bars first (behind), the three GAINS, then the three
 * art-filled MAIN bars on top. Without indicators only the mains
 * exist. Every bar is bottom-anchored in its rect and shows the
 * BOTTOM `amount` of its texture (VerticalProgress.DrawProgress),
 * which is the same v-window barFill answers.
 *
 * `rects` maps each vital key to its screen rect {x, y, w, h} - the
 * small HUD's strided columns or LARGE_HUD_RECTS scaled - so the two
 * HUDs share the one law with only geometry differing.
 */
export function drawVitalsBars(renderer, rig, skin, rects, indicators = vitalsIndicatorsEnabled()) {
  const filled = (rect, a) => {
    const h = rect.h * a;
    return { x: rect.x, y: rect.y + rect.h - h, w: rect.w, h };
  };
  if (indicators) {
    for (const k of VITAL_KEYS) {
      const a = rig.loss[k].amount;
      if (a > 0) renderer.drawScreenQuad(null, filled(rects[k], a), undefined, [...skin[k].loss, 1]);
    }
    for (const k of VITAL_KEYS) {
      const a = rig.gain[k].amount;
      if (a > 0) renderer.drawScreenQuad(null, filled(rects[k], a), undefined, [...skin[k].gain, 1]);
    }
  }
  for (const k of VITAL_KEYS) {
    const a = rig.main[k].amount;
    if (a > 0 && skin[k].img) {
      renderer.drawScreenQuad(skin[k].img.tex, filled(rects[k], a), { u0: 0, v0: 1 - a, u1: 1, v1: 1 });
    }
  }
}
