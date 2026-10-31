// @ts-check
// SKILL-LEAN (bible/05-Combat/Fixed-PvE.md section 14; the owner, 2026-10-30: "as they are higher tier area they have
// better leaning skill gear", "1 line leans in 1-20 then 2 line leans in the 10-25 area and the 20-35 area has 3",
// "to their highest skills", "for all weapons armor jewelry"; 2026-10-31 "clothing need to lean as well"): A FIXED-PVE
// FOE'S DROP LEANS TO ITS KILLER'S BEST SKILLS. Its weapons, armour, jewellery and clothing take their first skill lines on the roller's highest skills - one line from a foe
// to level 20, two to 35, three in the top band. Other lines roll as ever. Only a template foe's body: the switch off,
// nothing leans. A leaf: the registered roller and the scope, no import.

/** [below this foe level, lines that lean]: one to 20, two to 35, three in the top band (the owner: "23 to early"). */
export const SKILL_LEAN_STEPS = Object.freeze([Object.freeze([21, 1]), Object.freeze([36, 2]), Object.freeze([Infinity, 3])]);
/** The groups whose skill lines lean. */
export const SKILL_LEAN_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);   // clothing: the owner, 2026-10-31

/** Lines that lean on a foe of `level`. @param {number} level */
export const leanLinesAt = (level) => (SKILL_LEAN_STEPS.find(([below]) => (Number(level) || 1) < below) ?? SKILL_LEAN_STEPS[2])[1];

let _skills = null;
let _scoped = null;
/** Register the roller's skills, best first (a function answering skill ids), or clear it with null. */
export function registerLeanSkills(fn) { _skills = typeof fn === 'function' ? fn : null; }

/**
 * Run `fn` with a foe of `level`'s lean: its first lines on the roller's best skills (`skills`, else the registered
 * roller's). Nests; synchronous. @param {number} level @param {() => any} fn @param {number[]|null} [skills]
 */
export function withSkillLean(level, fn, skills = null) {
  const was = _scoped;
  let best = skills;
  if (!best && _skills) { try { best = _skills(); } catch { best = null; } }
  _scoped = Array.isArray(best) && best.length ? { lines: leanLinesAt(level), skills: Object.freeze(best.slice()) } : null;
  let out;
  try { out = fn(); } finally { _scoped = was; }
  if (out && typeof out.then === 'function') throw new TypeError('withSkillLean: the body must be synchronous');
  return out;
}
/** The lean now - `{ lines, skills }` inside withSkillLean, else null. */
export const skillLean = () => _scoped;
