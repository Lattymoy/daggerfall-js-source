// @ts-check
// REVENANT-HARM (2026-10-02): WHO LAST HARMED THE PLAYER, when no blow says it. A killing BLOW names its foe (the struck
// seam, systems/sigilSetPowers.js's landed blow); a spell's burn, a lingering effect's round and a poison's tick reach
// the player's hurt with nobody on them. So each leaves its foe here as it lands:
//   - a spell landing on the player (scenes/hostMagic.js applySpellToPlayer - a missile, a blast, a touch);
//   - a lingering effect's round (systems/effects.js runEffectRound - the caster the entry carries);
//   - any foe's blow that reaches the player (the struck seam) - a poisoned weapon's dose rides that blow, and its ticks
//     come later, so this mark lasts longest.
// systems/revenant.js reads it when a hurt with no blow takes the player's last health. A LEAF: it imports nothing.
// RVN10 (bible/12-Enhanced-AI/Feud-Arc.md 21.2): and THE FIGHT - each foe's harm opens a fight with the player, or carries
// its fight on (a harm within HARM_FIGHT_MS of its last); and the last hurt that left the player under half its health.
// A foe I run from is ROUTED when its fight saw that hurt (systems/revenant.js revenantRoutable).

/** How long each kind of mark stands (milliseconds of the wall clock). */
export const HARM_MARK_SPELL_MS = 30000;
export const HARM_MARK_STRUCK_MS = 120000;

/** RVN10: how near each harm must follow its foe's last to carry its fight on (milliseconds of the wall clock). */
export const HARM_FIGHT_MS = 30000;

/** @type {{ entity: any, until: number } | null} */
let _mark = null;
/** RVN10: each foe's fight with the player - since its first harm, and its last harm's time. */
let _fights = new WeakMap();
/** RVN10: when a hurt last left the player under half its health - or null. */
let _lowAt = null;

/** A foe's harm reached the player now - its entity stands as the last harm until `ms` passes or another lands. RVN10:
 *  and its fight opens (or, within HARM_FIGHT_MS of its last harm, carries on). */
export function markPlayerHarm(entity, { ms = HARM_MARK_SPELL_MS, now = Date.now() } = {}) {
  if (!entity || entity.isPlayer) return;
  _mark = { entity, until: now + ms };
  const f = _fights.get(entity);
  _fights.set(entity, { since: f && now - f.at <= HARM_FIGHT_MS ? f.since : now, at: now });
}
/** RVN10: when `entity`'s fight with the player began - while its last harm is within HARM_FIGHT_MS - or null. */
export function harmFightSince(entity, now = Date.now()) {
  const f = entity ? _fights.get(entity) : null;
  return f && now - f.at <= HARM_FIGHT_MS ? f.since : null;
}
/** RVN10: a hurt left the player under half its health now. */
export function markPlayerLow(now = Date.now()) { _lowAt = now; }
/** RVN10: did a hurt leave the player under half its health since `since` (a fight's start)? */
export const playerLowSince = (since) => _lowAt != null && since != null && _lowAt >= since;
/** RVN10: every fight ended - the player's death (no rout after it: the respawn's jump is no flight), a load, a new game. */
export function endPlayerFights() { _fights = new WeakMap(); _lowAt = null; }
/** The foe whose harm last reached the player, while its mark stands - or null. */
export function playerHarmMark(now = Date.now()) {
  return _mark && now <= _mark.until ? _mark.entity : null;
}
/** AUDIT (2026-10-02): the mark forgotten - a load, a new game, a death already answered, or (`entity` given) that foe
 *  judged (a beaten revenant kneels: its harm is no one's death now). */
export function clearPlayerHarm(entity = null) {
  if (!entity || _mark?.entity === entity) _mark = null;
  if (entity) _fights.delete(entity);   // RVN10: a judged foe's fight is over
}
/** Tests only. */
export function _resetHarmMarkForTests() { _mark = null; endPlayerFights(); }
