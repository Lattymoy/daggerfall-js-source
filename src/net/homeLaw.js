// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 (2026-09-25) — AN ONLINE HOME: ONE OWNER A BUILDING, SERVER-WIDE.
//
// Mac: "allowing online players to purchase housing in any location";
// asked: "Housing is exclusive. World is super large. Can revisit later
// if needed"; a home is bought "At its front door"; a house bought
// offline "Stay[s] offline only"; who walks in, "Owner chooses".
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/homes.js), which keeps the one registry, and the
// client (net/accountClient.js and the door) - so they cannot come to
// disagree. Pure: no clock, no DOM, no network.
//
// A HOME is a building in a town, named by the town's unsigned map id
// and the building's key there (talkTopics.js makeBuildingKey - every
// client builds the same key for the same town, and a key alone is
// unique only inside its town). It belongs to one CHARACTER of one
// registered account; its door names the account's handle, the name
// the relay signs over a head, never the character's.
// ═══════════════════════════════════════════════════════════════════

/** How many town homes one character may hold (PLOT1's homesteads will count apart). */
export const HOME_CAP = 3;
/** Who may walk in, as the owner sets it: the owner alone, the owner's party, anyone. GUILD1 adds a guild's. */
export const HOME_ENTRIES = Object.freeze(['private', 'party', 'public']);
/** A home bought is its owner's alone until they say otherwise. */
export const HOME_ENTRY_DEFAULT = 'private';
/** The dearest price a claim may name (a Daggerfall house's is its model's radius x 1280 - tens of thousands). */
export const HOME_PRICE_MAX = 10_000_000;
/** Claims an account may make an hour - a cap stops a hoard, this stops a claim-and-release churn. */
export const HOME_CLAIMS_MAX = 20;
export const HOME_CLAIMS_WINDOW_S = 3600;
/** The most homes one town's answer lists (a town has a few hundred buildings; the widest, Daggerfall's, 316). */
export const HOME_TOWN_MAX = 512;
/** The politic regions, 0..61. */
export const HOME_REGION_MAX = 61;
/** A building key's widest value: (blockX<<16)+(blockY<<8)+record inside an 8x8 town, and 0 spelt 1<<24. */
export const HOME_KEY_MAX = 1 << 24;

/** A town's map id, unsigned (the room keys' spelling: MAPS.BSA reads it signed). */
export const homeMapIdOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= 0xffffffff;
export const homeBuildingKeyOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= HOME_KEY_MAX;
export const homeRegionOk = (v) => Number.isSafeInteger(v) && v >= 0 && v <= HOME_REGION_MAX;
export const homePriceOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= HOME_PRICE_MAX;
export const homeEntryOk = (v) => typeof v === 'string' && HOME_ENTRIES.includes(v);

const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && a.toLowerCase() === b.toLowerCase();

/**
 * WHETHER A PLAYER MAY WALK IN. `home` is a town answer's row ({owner, entry, mine}) or null for a building no player
 * owns (its own law stands - DFU's locks). The owner always; anyone when public; when party, a player whose party
 * holds the owner - `partyNames` are the handles the relay signed over the party's heads.
 */
export function homeMayEnter(home, { partyNames = [] } = {}) {
  if (!home) return true;
  if (home.mine) return true;
  if (home.entry === 'public') return true;
  if (home.entry === 'party') return (partyNames ?? []).some((n) => sameName(n, home.owner));
  return false;
}
