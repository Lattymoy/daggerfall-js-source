// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): A FOE'S STRENGTH IS ITS LEVEL AND ITS CATEGORY, NEVER THE PLAYER'S.
// The reference player is a planning line, not a reader of anyone: the blow and the health a player of each level
// is expected to bring in that level's band of gear. A Normal foe of a level falls to that player in NORMAL_BLOWS, and
// takes the edge more blows to fell them (the owner's 10-30%, the middle by default). The categories stand on it.
// Starting values, to be measured with the reference builds before any foe stands on them. Ledger A (FIXED-PVE).

/** [level, landed blow, health] of the reference player: plain kit at 1, Magic by 20, Rare by 30, Legendary by 40. */
export const REFERENCE_PLAYER = Object.freeze([
  Object.freeze([1, 6, 45]), Object.freeze([10, 20, 140]), Object.freeze([20, 60, 330]),
  Object.freeze([30, 180, 650]), Object.freeze([40, 450, 1000]), Object.freeze([45, 800, 1265]),
]);
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 45;
/** Blows the reference player needs on a Normal foe of its level. */
export const NORMAL_BLOWS = 5;
/** The player's edge over a Normal foe of its level: the foe needs this much more blows to fell them. */
export const PLAYER_EDGE = Object.freeze({ min: 0.1, mid: 0.2, max: 0.3 });
/** A blow lands within this share either side of its middle. */
export const DAMAGE_SPREAD = 0.4;

/** Health and blow factors over a Normal foe, and who the category is made for. */
export const PVE_CATEGORIES = Object.freeze({
  normal: Object.freeze({ health: 1, damage: 1, party: 1, label: 'Normal' }),
  strong: Object.freeze({ health: 1.6, damage: 1.25, party: 1, label: 'Strong' }),
  elite: Object.freeze({ health: 8, damage: 2, party: 2, label: 'Elite' }),
  champion: Object.freeze({ health: 14, damage: 2.4, party: 3, label: 'Champion' }),
  boss: Object.freeze({ health: 400, damage: 3, party: 5, label: 'Boss' }),
  raidBoss: Object.freeze({ health: 1000, damage: 4, party: 10, label: 'Raid Boss' }),
});
export const CATEGORY_KEYS = Object.freeze(Object.keys(PVE_CATEGORIES));

const clampLevel = (l) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(Number(l) || LEVEL_MIN)));

/** The reference player at `level`: the blow between anchors on a geometric line (gear compounds), health on a straight one. */
export function referencePlayer(level) {
  const L = clampLevel(level);
  let i = 0; while (i < REFERENCE_PLAYER.length - 2 && REFERENCE_PLAYER[i + 1][0] < L) i++;
  const [l0, b0, h0] = REFERENCE_PLAYER[i], [l1, b1, h1] = REFERENCE_PLAYER[i + 1];
  const t = (L - l0) / (l1 - l0);
  return { level: L, blow: b0 * (b1 / b0) ** t, health: h0 + (h1 - h0) * t };
}

/**
 * A foe's numbers at `level` in `category`, before its roles: whole health, a blow's [min, max]. Pure.
 * @param {number} level @param {string} [category] @param {number} [edge]
 */
export function categoryStats(level, category = 'normal', edge = PLAYER_EDGE.mid) {
  const c = PVE_CATEGORIES[category] ?? PVE_CATEGORIES.normal;
  const ref = referencePlayer(level);
  const health = Math.max(1, Math.round(ref.blow * NORMAL_BLOWS * c.health));
  const mean = (ref.health / (NORMAL_BLOWS * (1 + edge))) * c.damage;
  return { level: ref.level, category: PVE_CATEGORIES[category] ? category : 'normal', health,
    damage: [Math.max(1, Math.round(mean * (1 - DAMAGE_SPREAD))), Math.max(1, Math.round(mean * (1 + DAMAGE_SPREAD)))] };
}
