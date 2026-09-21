// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM7 — THE FOUR QUARTERS: what a town's pixels and its names are,
// asked once, for both skins.
//
// Mac (2026-09-21): "keep our own version of the colored buildings that
// classic uses, plus let's enhance the location names on the buildings
// more".
//
// CLASSIC COLOURS A TOWN BY WHAT IS IN IT. Every RMB block carries a
// 64x64 byte grid (`autoMapData`), one byte a pixel, and the byte is
// `BuildingType + 1`. DFU sorts those bytes into four groups and paints
// each in its own colour (ExteriorAutomap.cs:1482-1541) - the temple's
// tan, the shop's blue, the tavern's green, the house's slate - which
// is the single thing that makes its town map readable at a glance.
// The enhanced sheet keeps that reading and re-voices it; the classic
// window keeps the colours themselves. Both ask the question HERE.
//
// THE SETS LIVED TWICE and the second copy was a real hazard rather
// than a tidiness complaint: `ui/exteriorAutomapWindow.js` had them for
// the stamp and `ui/inkTown.js` had them for the trace, so a byte
// regrouped in one skin would have silently disagreed with the other -
// the same building drawn as a shop on one map and a house on the
// next. ONE HOME, BOTH ENDS.
//
// AND THE PLATE ASKS IT TOO. A building summary carries
// `buildingType`, and the byte is that type PLUS ONE, so a NAME can be
// classified by the same ladder its own pixels are - which is what
// lets a tavern's name be lettered in the tavern's ink over the
// tavern's wash. `quarterOfType` is that one conversion, written once
// so the `+ 1` cannot drift.
// ═══════════════════════════════════════════════════════════════════

/** A pixel that is not a building at all. */
export const STREET_BYTE = 0;
/** Scenery, not architecture - see SHOWALL_SET below. */
export const GROUND_FLAT_BYTE = 0xfb;

// the byte groups (ExteriorAutomap.cs:1482-1541; byte = BuildingType + 1)
export const TEMPLE_SET = Object.freeze([12, 15]);
export const SHOP_SET = Object.freeze([1, 3, 4, 6, 7, 9, 10, 11, 13, 14]);
export const TAVERN_BYTE = 16;
export const HOUSE_SET = Object.freeze([2, 5, 8, 17, 18, 19, 20, 21, 22, 23, 24]);
/** The bytes the shipped map only draws in its "show all" mode - ships
 *  and specials (:1519-1528), the town's own furniture rather than its
 *  buildings, and 0xfb (the ground flat) is one of them. They are NOT a
 *  quarter: classic draws them in the HOUSE colour when the mode asks
 *  for them and strips them otherwise, and the enhanced sheet takes the
 *  default reading and never draws them at all. Folding this set into
 *  the built-up one drew every patch of scenery as architecture, which
 *  is how a pin found it - it asked whether a ground flat is a
 *  building and got "yes". */
export const SHOWALL_SET = Object.freeze([25, 117, 224, 250, 251]);

/** The quarters, in the order classic's own ladder tests them. */
export const QUARTERS = Object.freeze(['temple', 'shop', 'tavern', 'house']);

const TEMPLES = new Set(TEMPLE_SET);
const SHOPS = new Set(SHOP_SET);
const HOUSES = new Set(HOUSE_SET);
const SHOWALL = new Set(SHOWALL_SET);

/**
 * WHICH QUARTER A BYTE BELONGS TO, or null for street, scenery and
 * anything the ladder does not know. Classic's own order, so a byte
 * that somehow sat in two sets would land where classic puts it.
 * @param {number} byte
 * @returns {'temple'|'shop'|'tavern'|'house'|null}
 */
export function quarterOf(byte) {
  if (TEMPLES.has(byte)) return 'temple';
  if (SHOPS.has(byte)) return 'shop';
  if (byte === TAVERN_BYTE) return 'tavern';
  if (HOUSES.has(byte)) return 'house';
  return null;
}

/** Is this byte one classic draws only in its "show all" mode? */
export const isShowAllByte = (byte) => SHOWALL.has(byte);

/** THE ONE PLACE THE `+ 1` IS WRITTEN. A building summary's
 *  `buildingType` is the FLD byte minus one, so a plate and its own
 *  pixels go through the same ladder.
 *  @param {number|null|undefined} type */
export const quarterOfType = (type) => (type == null ? null : quarterOf(type + 1));

/**
 * DFU'S OWN FOUR COLOURS, as 0xAARRGGBB - the defaults the classic
 * window falls back to when settings.ini carries no override
 * (`AutomapTempleColor` and its three siblings). They are DATA rather
 * than a choice, which is why they live beside the sets that select
 * them: the classic skin draws them as they are, and the enhanced
 * sheet derives its washes and its name inks FROM them, so a town's
 * two maps cannot come to disagree about what colour a tavern is.
 */
export const CLASSIC_ARGB = Object.freeze({
  temple: 0xffc37d45,
  shop: 0xff1855be,
  tavern: 0xff307555,
  house: 0xff283c45,
});

/** The settings key each quarter's colour is overridden by, so the
 *  classic window reads its four in one loop rather than four literals.
 */
export const CLASSIC_SETTING = Object.freeze({
  temple: 'AutomapTempleColor',
  shop: 'AutomapShopColor',
  tavern: 'AutomapTavernColor',
  house: 'AutomapHouseColor',
});

/** `CLASSIC_ARGB` split into channels, which is what every consumer
 *  actually wants - a colour string, a mix, a packed ABGR.
 *  @param {number} argb @returns {{r:number,g:number,b:number,a:number}} */
export const argbChannels = (argb) => ({
  a: (argb >>> 24) & 0xff,
  r: (argb >>> 16) & 0xff,
  g: (argb >>> 8) & 0xff,
  b: argb & 0xff,
});
