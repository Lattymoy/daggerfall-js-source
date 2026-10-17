// @ts-check
// YARD-RANGE (2026-10-11): how far other players' yards are drawn - the law the yards' host (scenes/homeYards.js) and the
// Other players card (ui/enhanced/enhancedMenu.js) both read, a leaf, as net/peer/peerRange.js is for the players themselves. Not a
// DFU member: Daggerfall has no other players' yards. Ledger A (YARD-RANGE).

/** AUDIT: how far from the eye a yard's pieces are drawn, metres (scenes/homeYards.js) - a stranger's at most, one's own
 *  always. */
export const YARD_DRAW_M = 300;
/**
 * YARD-RANGE (2026-10-11, a player: "browser version for me is unplayable nowadays I get like 20-40 fps in cities" -
 * 1,523 draws, 61 ms of script; the owner: "look into limiting and improving performance with player's exterior decor
 * items"): HOW FAR OTHER PLAYERS' YARDS ARE DRAWN, the Other players card's choice beside their own draw distance
 * (ui/enhanced/enhancedMenu.js, `yardRange`) - metres on the ground from the eye to a yard's house; 0, none: no stranger's yard
 * stands at all (no draw, no solid, no lamp). The default is YARD_DRAW_M, the distance every yard was drawn at before.
 * One's own yard - a home's, a hall's its keeper keeps (homeOutsideKept) - is drawn to YARD_DRAW_M whatever the choice.
 * Its YARD_RANGE_DEFAULT is pinned equal to the shelf's (systems/uiPrefs.js) by test/scenes/yardrange.test.js, not imported.
 */
export const YARD_RANGE_TIERS = Object.freeze([0, 75, 150, YARD_DRAW_M]);
export const YARD_RANGE_DEFAULT = YARD_DRAW_M;
/** YARD-RANGE: the range a stored choice stands for - one of the tiers, else the default. */
export const yardRangeOf = (v) => (YARD_RANGE_TIERS.includes(v) ? v : YARD_RANGE_DEFAULT);
