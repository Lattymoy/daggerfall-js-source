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
import { foeTitle } from '../systems/foeTitle.js';   // FOE-TITLE: what a special foe is called, one home

export const FOE_TARGET_SECONDS = 6;
/** LOOT7 (the Loot arc): a CHAMPION's trait before its name; ELITE FOES: "Elite" before it; REVENANT: its own name -
 *  systems/foeTitle.js, the one home every surface asks (a leaf, as this one is). */
const titled = (e, base) => foeTitle(e, base);

let _foe = null;
let _left = 0;

/** The one call both damage paths make. `fromPlayer` is already the
 *  flag each of them takes, so this asks nothing new of either. */
export function markFoeStruck(foe, { fromPlayer = true } = {}) {
  if (!fromPlayer || !foe?.entity) return;
  // AUDIT PRE-MERGE 1003 U3: a fighter of the bout on the sand (its `entity.bout` tag - scenes/arenaBouts.js) is the
  // versus bar's, which names it and draws its health already (ui/arenaHud.js): the frame stood on every ladder bout
  // from the first blow, under the bar, its name bleeding through. The undercroft's chained beasts carry a tag too
  // (world/arenaUndercroft.js chainTag) and no bar stands for them - they keep the frame.
  const bout = foe.entity.bout;
  if (bout && !bout.chained) return;
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
    name: String(titled(e, e.name ?? e.career?.name ?? 'Foe')),   // LOOT7: a champion's trait before its name; ELITE FOES: an elite's word; REVENANT: its own name
    health: Math.max(0, e.health ?? 0),
    maxHealth: max,
    fade: Math.min(1, _left / 1.5),   // the last second and a half
  };
}

/** WHICH foe the target frame shows - the entity itself, not its name.
 *  Two rats are two foes: the HUD's loss readout keys on this, so a
 *  switch between same-named foes does not carry one's lost health onto
 *  the other's bar. Null when there is no target. */
export function foeTargetRef() {
  const e = _foe?.entity;
  return e && !_foe.dead ? e : null;
}

/** A host tearing down, and the tests. */
export function clearFoeTarget() { _foe = null; _left = 0; }
