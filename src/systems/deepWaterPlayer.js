// ═══════════════════════════════════════════════════════════════════
// DW-D (2026-09-25): ILIAC PUDDLE NO MORE'S PLAYER API (DeepWaterPlayer.cs,
// jet082, 1.2.2) - the one public door the mod opens to other mods:
//
//   the published STATE (IsInWater, IsSwimming, IsHeadSubmerged,
//     IsUnderwater), changed by the swim driver's decisions and announced
//     once per frame through OnStateChanged (FlushStateChange - the driver's
//     late phase), each subscriber isolated from the others' throws;
//   ShouldSuppressOutdoorSwimming - a subscriber answering true (a boat,
//     a ride, a cutscene) turns the outdoor swim off for the frame; any one
//     true is enough, a throwing one is logged once and counts as false;
//   TryGetWaterColumn - the player's own column while the exterior context
//     is live (the host hands the lookup in: setColumnSource).
//
// A leaf, so a mod port that listens (There's a Hole in the Bottom of the
// Ocean, Come Sail Away) imports it without the world host.
// ═══════════════════════════════════════════════════════════════════

const state = { inWater: false, swimming: false, headSubmerged: false, underwater: false };
let pending = false;
const stateListeners = new Set();
const suppressors = new Set();
let suppressionFailureLogged = false;
let columnSource = null;   // () => ?{terrain, surfaceY, seafloorY, depth}

export const deepWaterPlayer = {
  get isInWater() { return state.inWater; },
  get isSwimming() { return state.swimming; },
  get isHeadSubmerged() { return state.headSubmerged; },
  get isUnderwater() { return state.underwater; },

  /** OnStateChanged += fn; the returned function is its -=. */
  onStateChanged(fn) { stateListeners.add(fn); return () => stateListeners.delete(fn); },

  /** ShouldSuppressOutdoorSwimming += fn; the returned function is its -=. */
  shouldSuppressOutdoorSwimming(fn) {
    suppressors.add(fn);
    return () => { suppressors.delete(fn); if (!suppressors.size) suppressionFailureLogged = false; };
  },

  /** TryGetWaterColumn: {terrain, surfaceY, seafloorY, depth} or null. */
  tryGetWaterColumn() { return columnSource ? columnSource() : null; },
};

/** EvaluateSwimmingSuppression: every subscriber asked, any true wins. */
export function evaluateSwimmingSuppression() {
  let flag = false;
  for (const fn of [...suppressors]) {
    try { flag = !!fn() || flag; } catch (e) {
      if (!suppressionFailureLogged) { suppressionFailureLogged = true; console.warn('[DeepWaters.Player] ShouldSuppressOutdoorSwimming subscriber threw:', e?.message ?? e); }
    }
  }
  return flag;
}

/** PublishState: a change marks the frame's announcement due. */
export function publishState(inWater, swimming, headSubmerged, underwater) {
  if (state.inWater !== inWater || state.swimming !== swimming || state.headSubmerged !== headSubmerged || state.underwater !== underwater) {
    state.inWater = inWater; state.swimming = swimming; state.headSubmerged = headSubmerged; state.underwater = underwater;
    pending = true;
  }
}

/** ClearState. */
export const clearState = () => publishState(false, false, false, false);

/** FlushStateChange: the frame's one announcement, each listener on its own. */
export function flushStateChange() {
  if (!pending) return;
  pending = false;
  for (const fn of [...stateListeners]) {
    try { fn(); } catch (e) { console.warn('[DeepWaters.Player] OnStateChanged subscriber threw:', e?.message ?? e); }
  }
}

/** The host's column lookup for TryGetWaterColumn (null: none - the exterior context is not live). */
export function setColumnSource(fn) { columnSource = fn; }
