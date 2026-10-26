// @ts-check
// WBX6 (2026-09-26, Swololo on Discord: "regeneration defeats the purpose if someone regenerates all the health back in
// 5 seconds. instead of wiping buffs, maybe disable regen in oblivion"): THE DEADLANDS HELD REGENERATION. One switch
// the world host sets every frame (scenes/world.js - beside arenaFrame: a made level stands under this player,
// systems/madeLevel.js), read where each regeneration lives:
//   - the Regenerate effect's round (systems/effects.js - the spell, the potion, the enchantment's cast),
//   - a RegensHealth enchantment's round (systems/enchantments.js),
//   - a career's Regenerate Health advantage (systems/passiveSpecials.js),
//   - a Brawler's Grit (systems/martialPowers.js).
// HEALING IS NOT REGENERATION: a Heal spell, a potion of healing and a friend's cast land as they always did - the fight
// still has its healers (World-Bosses.md section 6: standing the fight earns the spoils). Nothing is wiped.
//
// EVENT-RULES (2026-10-25, the owner, asked how regeneration should work in the world events: "Back, held in a fight"):
// WBX6 turned every regeneration OFF in the made levels, silently - a Regenerate's tile still said "Restores health
// every round" and healed nothing, and the Discord read it as broken. It is HELD now, not off: a regeneration heals
// REGEN_HELD_SHARE of what it would (the fractions carried round to round, each source its own, so a +1 every fourth
// round is a +1 every eighth), and NOTHING for REGEN_HELD_HURT_MS after the player loses health - so the boss's blows
// (WBX4: a share of the struck player's health) still cost what they cost in the thick of a fight, and the fighter who
// steps back heals again. The HUD says so: the made level's tile (ui/hud/statusTips.js madeRulesTile) and a Regenerate's
// own tip (`regenerate`) read regenHeldNow / regenPausedMs. Every natural regeneration comes through regenShare: the four
// above, and (AUDIT WORLD-EVENTS L1-3) Hist-Sap's (systems/loot/lootPowers.js), the Warden's Steadfast's
// (systems/arcanePowers.js) and the Firmament's hpRegen (systems/firmamentPowers.js), which healed whole inside the pause.
// AUDIT WORLD-EVENTS L1-9: each BODY carries its own fractions (the player's, and every foe's its own) - one carry for all
// the foes handed one foe's halves to the next. L1-10: the pause starts at the player's HURT DOOR (characters/
// playerEntity.js registerPlayerHurtListener - a blow, a spell, a fall, a poison's round; wired by systems/
// courtRulesDoor.js, the client's own: the account Worker bundles this file), not off a frame's health: a maximum that
// fell with its share kept is no hurt, a hit healed in the same frame is one, and a frame of the mode's change that reads
// no made level ends no pause.
//
// Offline and outside a made level the switch is off and nothing changes. Not a DFU member. Ledger A (WB; EVENT-RULES).
/** A held regeneration heals this share of its round. */
export const REGEN_HELD_SHARE = 0.5;
/** ...and none for this long after the player last lost health (ms). */
export const REGEN_HELD_HURT_MS = 5000;

let _on = false;
let _now = 0;
let _hurtAt = -Infinity;
/** The player's fractions carried to their next round, by source. @type {Map<string, number>} */
const _carry = new Map();
/** AUDIT WORLD-EVENTS L1-9: each other body's own. @type {WeakMap<object, Map<string, number>>} */
let _bodyCarry = new WeakMap();

/**
 * The made level's law on (a made level stands under this player and holds its regeneration) or off. Set every frame,
 * before any magic round of it; off, the carried fractions go (the pause's clock stays - a frame of the mode's change
 * that reads no level ends none, and off it holds nothing).
 * @param {boolean} on @param {number} [nowMs]
 */
export function setCourtRules(on, nowMs = performance.now()) {
  _on = !!on;
  _now = nowMs;
  if (!_on) { _carry.clear(); _bodyCarry = new WeakMap(); }
}
/** AUDIT WORLD-EVENTS L1-10: the player's hurt, at its door - the pause begins (exported for the pins). */
export function courtRulesHurt(hurt) {
  if (_on && hurt && hurt.after < hurt.before) _hurtAt = _now;
}
/** The pins' fresh start: off, no pause, nothing carried. */
export function _resetCourtRulesForTests() { setCourtRules(false, 0); _hurtAt = -Infinity; }

/** Whether a made level holds regeneration here now. */
export const regenHeldNow = () => _on;
/** How long the pause after a hurt has left (ms), 0 when a held regeneration heals. */
export const regenPausedMs = () => (_on ? Math.max(0, REGEN_HELD_HURT_MS - (_now - _hurtAt)) : 0);

/**
 * What a regeneration of `n` heals now: all of it outside a made level; inside one, none on the player while the
 * pause runs, else REGEN_HELD_SHARE of it with the fraction carried in `source`'s name, on its own body.
 * @param {number} n @param {string} source @param {any} [body] the healed body (none, or one `isPlayer`: the player's -
 *   a foe's own Regenerate is halved, never paused by the player's hurt)
 */
export function regenShare(n, source, body = null) {
  if (!_on || !(n > 0)) return n;
  const onPlayer = !body || !!body.isPlayer;
  if (onPlayer && regenPausedMs() > 0) return 0;
  let carry = _carry;
  if (!onPlayer) { carry = _bodyCarry.get(body) ?? new Map(); _bodyCarry.set(body, carry); }
  const c = (carry.get(source) ?? 0) + n * REGEN_HELD_SHARE;
  const out = Math.floor(c + 1e-9);
  carry.set(source, c - out);
  return out;
}
