// PX30 - WHO YOU ARE FIGHTING.
//
// Mac's reference (ESO's Clean UI) names the target above a health bar
// at the top of the screen. Daggerfall has no such thing: DFU tells you
// nothing about a foe's health, ever, and the classic HUD has no target
// frame - so this is a DEPARTURE, on the enhanced skin only, and it
// needs a source that does not exist yet.
//
// THE SOURCE IS THE BLOW YOU LANDED. ESO's frame follows the reticle;
// this follows the last foe the PLAYER struck, which is the same
// question a player is actually asking - "did I hurt it, and how much
// is left" - and costs nothing. A reticle target would want a foe
// raycast every frame, which is real work for an answer the player only
// wants while fighting.
//
// It FADES rather than latching: a foe you stopped fighting thirty
// seconds ago is not your target, and a bar that never leaves is
// furniture. It clears at once when the foe dies, because a dead thing
// has no health to report.
export const FOE_TARGET_SECONDS = 6;

let _foe = null;
let _left = 0;

/** The one call both damage paths make. `fromPlayer` is already the
 *  flag each of them takes, so this asks nothing new of either. */
export function markFoeStruck(foe, { fromPlayer = true } = {}) {
  if (!fromPlayer || !foe?.entity) return;
  _foe = foe;
  _left = FOE_TARGET_SECONDS;
}

/** Per-frame decay, from the one host-agnostic HUD call. */
export function tickFoeTarget(dt = 0) {
  if (!_foe) return;
  _left -= dt;
  if (_left <= 0 || _foe.dead) { _foe = null; _left = 0; }
}

/**
 * What the HUD should show, or null. Pure read: name, health, max, and
 * how much of its welcome is left (for a fade).
 */
export function foeTarget() {
  const e = _foe?.entity;
  if (!e || _foe.dead) return null;
  const max = e.maxHealth || e.health || 1;
  return {
    name: String(e.name ?? e.career?.name ?? 'Foe'),
    health: Math.max(0, e.health ?? 0),
    maxHealth: max,
    fade: Math.min(1, _left / 1.5),   // the last second and a half
  };
}

/** A host tearing down, and the tests. */
export function clearFoeTarget() { _foe = null; _left = 0; }
