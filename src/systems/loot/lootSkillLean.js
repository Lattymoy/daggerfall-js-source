// @ts-check
// SKILL-LEAN (bible/05-Combat/Fixed-PvE.md section 14): A FIXED-PVE FOE'S DROP LEANS TO ITS KILLER'S BEST SKILLS. Its
// weapons, armour, jewellery and clothing take their first skill lines on the roller's highest skills. Other lines roll
// as ever, and an Imbue stays random. The switch off, nothing leans. A leaf, no import.

/** [below this foe level, lines that lean]: a band ahead, so a band's drops make the next band's gear (2026-10-31)
 *  - one to 11, two to 27, three from 28. */
export const SKILL_LEAN_STEPS = Object.freeze([Object.freeze([12, 1]), Object.freeze([28, 2]), Object.freeze([Infinity, 3])]);
/** LEAN-CHANCE (2026-10-31, leaning eased so farming takes longer): each leaning line
 *  lands on a best skill this share of the time, else it rolls as ever - farming to top gear takes about twice as long. */
export const SKILL_LEAN_CHANCE = 0.25;
/** The groups whose skill lines lean. */
export const SKILL_LEAN_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);   // clothing: 2026-10-31

/** Lines that lean on a foe of `level`. @param {number} level */
export const leanLinesAt = (level) => (SKILL_LEAN_STEPS.find(([below]) => (Number(level) || 1) < below) ?? SKILL_LEAN_STEPS[2])[1];

let _skills = null;
let _scoped = null;
/** Register the roller's skills, best first (a function answering skill ids), or clear it with null. */
export function registerLeanSkills(fn) { _skills = typeof fn === 'function' ? fn : null; }

/**
 * Run `fn` with a foe of `level`'s lean: its first lines on the roller's best skills (`skills`, else the registered
 * roller's), each line at `chance`. Nests; synchronous. @param {number} level @param {() => any} fn
 * @param {number[]|null} [skills] @param {number} [chance]
 */
export function withSkillLean(level, fn, skills = null, chance = SKILL_LEAN_CHANCE) {
  const was = _scoped;
  let best = skills;
  if (!best && _skills) { try { best = _skills(); } catch { best = null; } }
  _scoped = Array.isArray(best) && best.length ? { lines: leanLinesAt(level), skills: Object.freeze(best.slice()), chance } : null;
  let out;
  try { out = fn(); } finally { _scoped = was; }
  if (out && typeof out.then === 'function') throw new TypeError('withSkillLean: the body must be synchronous');
  return out;
}
/** The lean now - `{ lines, skills, chance }` inside withSkillLean, else null. */
export const skillLean = () => _scoped;
