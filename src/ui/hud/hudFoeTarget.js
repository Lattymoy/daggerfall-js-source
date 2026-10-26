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
import { foeTitle } from '../../systems/foeTitle.js';   // FOE-TITLE: what a special foe is called, one home
import { bossTraitWords, bossTraitRules, bossWardNow, bossClockS } from '../../systems/bossTraits.js';   // BOSS-TRAITS: the traits a foe carries, their rules, its ward

export const FOE_TARGET_SECONDS = 6;
/** LOOT7 (the Loot arc): a CHAMPION's trait before its name; ELITE FOES: "Elite" before it; REVENANT: its own name -
 *  systems/foeTitle.js, the one home every surface asks (a leaf, as this one is). */
const titled = (e, base) => foeTitle(e, base, { traits: false });   // AUDIT WORLD-EVENTS L5-12: the traits are said on their own line below

let _foe = null;
let _left = 0;
/** TELL9: seconds since the player last struck a foe (markFoeStruck) - a threat yields to a foe struck this recently. */
let _sinceStruck = Infinity;
/** TELL9 (bible/12-Enhanced-AI/Feud-Arc.md 11.1): a foe that winds up at me takes the bar unless I struck another in
 *  the last THREAT_YIELD_S seconds. */
export const THREAT_YIELD_S = 2;
/** TELL9: the poise track's reader - `(foe) => { state, fill, word } | null` - registered by the host that knows the
 *  brain (scenes/hostCombat.js: ai/tactics.js poiseTrack); this leaf imports none. */
let _poiseOf = null;
export function setFoePoiseReader(fn) { _poiseOf = typeof fn === 'function' ? fn : null; }

/** The one call both damage paths make. `fromPlayer` is already the
 *  flag each of them takes, so this asks nothing new of either. */
export function markFoeStruck(foe, { fromPlayer = true } = {}) {
  if (!fromPlayer || !foe?.entity) return;
  // AUDIT PRE-MERGE 1003 U3: a fighter of the bout on the sand (its `entity.bout` tag - scenes/arena/arenaBouts.js) is the
  // versus bar's, which names it and draws its health already (ui/arena/arenaHud.js): the frame stood on every ladder bout
  // from the first blow, under the bar, its name bleeding through. The undercroft's chained beasts carry a tag too
  // (world/arena/arenaUndercroft.js chainTag) and no bar stands for them - they keep the frame.
  const bout = foe.entity.bout;
  if (bout && !bout.chained) return;
  _foe = foe;
  _left = FOE_TARGET_SECONDS;
  _sinceStruck = 0;   // TELL9: a threat yields to it for THREAT_YIELD_S
}

/** STAND-IN-BAR (AUDIT KETCH II, 2026-10-26, the owner: "the additional enemies dont have health bars"): A BODY THE RELAY
 *  KEEPS THE HEALTH OF - an event's host: the gate's legion, the Spire's, the Hour's Echoes, the Sky-Ketch's constructs
 *  (world/gate/gateBoss.js hostStandIn) - is struck through the dungeon host's landOnHost, which never marked it, so none of
 *  them ever had the bar; and its stand-in's own health is a count nothing empties (STAND_IN_WHOLE). A blow on one that
 *  went (`went`, the event's own answer) marks it - `hb` the host's foe-shaped record, its stand-in its `entity` - and the bar
 *  reads its health off the relay's word (`relayShare`, foeTarget). Answers `went`, so the host's return stays one line. */
export function markHostStruck(hb, went) {
  if (went) markFoeStruck(hb);
  return went;
}
/** The relay's share of a stand-in's health (0 to 1), or null - its word not heard, or a reader that throws. */
const relayShareOf = (e) => { try { const v = typeof e.relayShare === 'function' ? e.relayShare() : null; return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null; } catch { return null; } };

/** TELL9 (11.1): a foe began a wind-up at the local player (scenes/hostCombat.js tellCues, at its wind's start): it is
 *  the bar's foe now, unless I struck another in the last THREAT_YIELD_S - the foe I am fighting keeps it; its own
 *  wind-up refreshes its welcome. A bout's fighter is the versus bar's (as markFoeStruck); a dead foe has none. */
export function markFoeThreat(foe) {
  if (!foe?.entity || foe.dead) return;
  const bout = foe.entity.bout;
  if (bout && !bout.chained) return;
  if (_foe && _foe !== foe && !_foe.dead && (_sinceStruck < THREAT_YIELD_S || _foe.duel)) return;   // AUDIT TELL U7: nor while my duel's opponent holds it (its health comes only as the duel's word does)
  _foe = foe;
  _left = FOE_TARGET_SECONDS;
}

/** Per-frame decay, from the one host-agnostic HUD call. */
export function tickFoeTarget(dt = 0) {
  _sinceStruck += dt;
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
  // STAND-IN-BAR: a relay's body - its health the relay's share; none heard, or none left (its fall), no bar
  const share = e.relayHealth ? relayShareOf(e) : null;
  if (e.relayHealth && !(share > 0)) return null;
  const max = e.maxHealth || e.health || 1;
  return {
    name: String(titled(e, e.name ?? e.career?.name ?? 'Foe')),   // LOOT7: a champion's trait before its name; ELITE FOES: an elite's word; REVENANT: its own name
    health: share != null ? share * max : Math.max(0, e.health ?? 0),
    maxHealth: max,
    fade: Math.min(1, _left / 1.5),   // the last second and a half
    poise: _poiseOf ? _poiseOf(_foe) ?? null : null,   // TELL9: the poise track under the health (null: none drawn)
    traits: bossTraitWords(e),   // BOSS-TRAITS: every trait's word (systems/bossTraits.js)
    rules: bossTraitRules(e),   // AUDIT WORLD-EVENTS L5-6: and what each one does - the trait line's tip
    ward: bossWardNow(e, bossClockS())?.now ?? 0,   // BOSS-TRAITS: what its ward holds now (AUDIT WORLD-EVENTS L2-5: on the traits' clock; L2-7: a puppet's as its owner says it)
  };
}

/** WHICH foe the target frame shows - the entity itself, not its name.
 *  Two rats are two foes: the HUD's loss readout keys on this, so a
 *  switch between same-named foes does not carry one's lost health onto
 *  the other's bar. Null when there is no target. */
export function foeTargetRef() {
  const e = _foe?.entity;
  return e && !_foe.dead && !(e.relayHealth && !(relayShareOf(e) > 0)) ? e : null;   // STAND-IN-BAR: a relay's body fallen is no target
}

/** A host tearing down, and the tests. */
export function clearFoeTarget() { _foe = null; _left = 0; _sinceStruck = Infinity; }
