// @ts-check
// TESA10/TESA11 (bible/03-World/Arena-Provinces.md) - THE CAPITALS' MAP IDS, alone: their lane and the test of one, with no
// import, so a reader that keys by a map id (systems/banking.js's deeds, AUDIT RELEASE R2-9) asks it without the
// capitals' plans. world/tamrielCapitals.js re-exports both.

/** The capitals' lane - after the country places' 64 (0x300-0x33f) and the lairs' (0x340). */
export const CAPITAL_LANE = 0x341;
/** Is a map id a capital's - any slice's (world/tamrielCapitals.js capitalPlaceId). */
export const isCapitalPlaceId = (id) =>
  ((Number(id) >>> 20) & 0xfff) === CAPITAL_LANE && ((Number(id) >>> 0) & 0x80000) !== 0;
