// @ts-check
// CASUAL-LIFE (2026-10-28, asked: "they need to be able to pick a casual, no death, no lineage character creation";
// "casual needs to replace lineage's wording"): ONLINE'S NO LINEAGE IS CASUAL - no house (legacyHost.js found) and a
// death that costs nothing: no tenth of the purse (deathPenalty.js) and no piece to a revenant (revenant.js
// revenantTakes). The Wild keeps its own law: a player's kill there takes the zone's share (world.js
// respawnOnlinePlayer). A leaf, so the death laws can ask it without importing the family.
/** The answer's stored value - family.js NO_LINEAGE, kept as it was so every character who answered it is Casual. */
export const NO_LINEAGE = 'none';
/** Whether `entity` is a Casual character (its chargen answer, kept on it as `legacyChoice`). */
export const isCasual = (entity) => entity?.legacyChoice === NO_LINEAGE;
