// @ts-check
// TELL1 (bible/12-Enhanced-AI/Feud-Arc.md section 3.2): WHAT A BLOW'S TARGET TAKES - a leaf, importing nothing.
//
// `entityMods.registerWeaponBlowMod` scales a WEAPON blow by its striker's lights; nothing scaled a blow by the state
// of the one it lands on, for hands and spells as for weapons. A staggered foe takes a quarter more (TELL1), an
// overreached one more again (TELL4), a revenant's adaptations take some away and its weakness adds (RVN2, RVN3) - all
// here, read once at the tail of `combat/formulas.js calculateAttackDamage` (after either core, every attacker-side
// scale and mentor mode, before the reports - so they say what landed) and once at a spell's landing on a foe
// (`scenes/hostMagic.js applySpellToFoe`). A leaf because the brain registers into it and the formulas read it, and the
// formulas import the motor, which imports the brain.

/** @typedef {{ kind?: 'melee'|'arrow'|'spell', element?: number|null }} BlowTakenInfo */

/** @type {Map<string, (attacker: any, target: any, weapon: any, info: BlowTakenInfo) => number>} */
const _mods = new Map();

/** Register a multiplier on what a blow's TARGET takes, by name: `fn(attacker, target, weapon, info) -> multiplier`
 *  (1 for none). Re-registering a name replaces it; `null` removes it. */
export function registerBlowTakenMod(name, fn) { if (typeof fn === 'function') _mods.set(name, fn); else _mods.delete(name); }

/** The product of every registered multiplier for this blow (1 with none; a multiplier that throws, or answers no
 *  positive number, counts 1 - a state is not the blow's problem). */
export function blowTakenScale(attacker, target, weapon = null, info = {}) {
  let k = 1;
  for (const fn of _mods.values()) {
    try { const m = fn(attacker, target, weapon, info ?? {}); if (Number.isFinite(m) && m > 0) k *= m; } catch { /* a state is not the blow's problem */ }
  }
  return k;
}

/** `damage` through `blowTakenScale`: a landed blow (over 0) stays at least 1; nothing landed stays nothing. */
export function blowTaken(damage, attacker, target, weapon = null, info = {}) {
  if (!(damage > 0)) return damage;
  const k = blowTakenScale(attacker, target, weapon, info);
  return k === 1 ? damage : Math.max(1, Math.round(damage * k));
}

/** Tests: the registered names. */
export const blowTakenNames = () => [..._mods.keys()];
