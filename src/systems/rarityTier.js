// RARE-BREAK1 (2026-09-25): THE LADDER'S ROLLED TIERS, AS A LEAF.
//
// The rarity ladder (systems/lootRarity.js, LR1) stamps a piece that rolled a tier with
// `item.rarity` - one of these three. The names live here, alone, so a reader that must not
// import the ladder (the combat formulas read no affix fold by name - RF1's law,
// test/rf1_entitymods.test.js) can still ask the one question it needs: did this piece come
// off the ladder? lootRarity.js re-exports ROLLED_TIERS from here; this is its one home.

/** The tiers the ladder ROLLS (an artifact is DFU's, Common is no roll). */
export const ROLLED_TIERS = Object.freeze(['magic', 'rare', 'legendary']);

/** Did this piece roll its tier on the ladder? Its own stamped field, nothing derived. */
export const rolledTier = (item) => ROLLED_TIERS.includes(item?.rarity);

/** AUDIT SET D3: a tier the port STAMPS on a piece - the ladder's rolled three, or the gate boss's Aetheric (SET6,
 *  minted whole, never rolled). The fading rule leaves every one alone: an Aetheric piece a player enchanted at the
 *  item maker faded whole on breaking, where a Legendary broke and stayed. */
export const stampedTier = (item) => rolledTier(item) || item?.rarity === 'aetheric';
