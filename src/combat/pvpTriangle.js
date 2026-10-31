// PVP-TRIANGLE (the PvP rework): a player's arrows and harmful spells at a player, scaled by the
// striker's level. The sim's numbers (bible/11-Multiplayer/PvP-Rework.md PVP-TRIANGLE); the Shield's share and the hit
// cap are the referee's (net/siege/refereeHealthShare.js PVP_SHIELD, siegeRef.js PVP_HIT).

/** From `late` the gear's last tiers land, and the arrows and spells take their late numbers. */
export const PVP_TRIANGLE = Object.freeze({ late: 40, arrow: 1.28, arrowLate: 1.67, spell: 0.96, spellLate: 0.81 });
/** What an arrow of a striker at `level` multiplies by against a player. */
export const pvpArrowScale = (level) =>
  (Number(level) || 0) >= PVP_TRIANGLE.late ? PVP_TRIANGLE.arrowLate : PVP_TRIANGLE.arrow;
/** What a harmful spell of a caster at `level` multiplies by against a player. */
export const pvpSpellScale = (level) =>
  (Number(level) || 0) >= PVP_TRIANGLE.late ? PVP_TRIANGLE.spellLate : PVP_TRIANGLE.spell;
