// @ts-check
// FIXED-PVE SPELL-RANK (bible/05-Combat/Fixed-PvE.md section 17, 2026-10-31: Normals only): a kill or a
// hold from a spell lands on a Normal template foe as Daggerfall has it. A ranked one - Strong, Elite, Champion, an
// elite, a boss - is immune to all of them: Disintegrate, a drained stat, Dispel, Paralyze, Pacify and Charm. A
// Dispel kills a Normal template foe, so it drops its loot. Any other target keeps Daggerfall's law.

/** Is `t` a template foe above Normal? @param {any} t */
export const spellRanked = (t) => !!t?.pveTemplate && (!!t.eliteFoe || (!!t.pveCategory && t.pveCategory !== 'normal'));

/** What a killing spell takes from `t`, which has `left` health: all of it, or nothing from a ranked foe. @param {any} t @param {number} left */
export const spellKill = (t, left) => (spellRanked(t) ? 0 : left);

/** The rounds a hold lasts on `t`: none on a ranked foe. @param {any} t @param {number} rounds */
export const spellHold = (t, rounds) => (spellRanked(t) ? 0 : rounds);

/** Does `t` refuse a Pacify or a Charm? A ranked foe does. @param {any} t */
export const spellSwayRefused = (t) => spellRanked(t);

/** A Dispel takes foe `f` of `pool` (exteriorFoes' shape): a ranked template foe is untouched, a Normal one is killed
 *  so it drops its loot, any other is removed as Daggerfall destroys it. @param {any} f @param {any} pool @param {number[]} feet */
export function spellDispel(f, pool, feet) {
  const e = f?.entity;
  if (!e?.pveTemplate) { pool.removeFoe(f); return; }
  if (!spellRanked(e)) pool.damageFoe(f, e.health ?? 0, feet, null, { kind: 'spell', whole: true });
}
