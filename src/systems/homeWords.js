// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-PRICE (AUDIT HOME-PRICE E4/C4, 2026-10-04) — HOW A HOME'S GOLD IS SAID.
//
// The sums a home's lines say, and the account they say its gold moves in -
// one spelling for the door, the rent, the decorator and the arena's letter,
// so one door never says "45,000 gold ... your account at the Bank of the
// Empire" beside "10000 gold a day ... this region's bank account". Pure, and
// imports nothing: systems/online/onlineHomes.js, systems/homeRent.js,
// systems/arena/arenaText.js and scenes/decor/decorTool.js all read it, and onlineHomes
// already imports homeRent and arenaText.
// ═══════════════════════════════════════════════════════════════════

/** A sum of gold as every home's line says it - 250,000, never 250000 (HALL-GOLD's spelling). */
export const goldSum = (n) => Number(n).toLocaleString('en-US');
/** Online, where a home's gold comes from and goes to: EMPIRE-ACCOUNT's one account (systems/banking.js goldRegion). */
export const EMPIRE_ACCOUNT_WORDS = 'your account at the Bank of the Empire';
/** Offline, Daggerfall's own: the region's account. */
export const REGION_ACCOUNT_WORDS = "this region's bank account";
/** The words for the account a sum moved in: the Empire's when the gold moved in the Empire account, else the region's -
 *  `empire` is whether it did (systems/banking.js goldRegion answered the Empire's index). */
export const accountWords = (empire) => (empire ? EMPIRE_ACCOUNT_WORDS : REGION_ACCOUNT_WORDS);
