// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") — THE GUILD HALL
// (bible/11-Multiplayer/Seats-Arc.md 8.2).
//
// A guild owns ONE home as its hall, bought from its gold treasury at
// the home's own price and half again, and owned by the GUILD, never a
// character: its row in the homes table names the guild (`guild_id`),
// and its character is the guild's own mark (guildHallOwner) - no
// character's id can ever be it, so no character's path (a home's sale,
// its decor, its rooms, its outside) reaches a hall by a character's
// name. Members walk in (the `guild` entry, the hall's default) or
// anyone (`public`); the Officers and the guildmaster furnish it; its
// sale pays the deed share back into the treasury. Server-wide one
// owner a building, as every home (HOME1).
//
// Its own module, beside net/guild/guildLaw.js and never inside it: guildLaw
// is in the relay's bundle (GUILD1c - the token carries a guild), where
// every byte is a relay deploy (test/net/relayversion.test.js SLAM8), and
// nothing of a hall is the relay's.
//
// The shapes BOTH ends read - the account service
// (server-account/src/halls.js) and the client. Pure: no clock, no DOM,
// no network.
// ═══════════════════════════════════════════════════════════════════

/** What each rank may do of the hall and the heraldry (the ranks that may) - guildLaw.js GUILD_POWERS's shape: the hall
 *  bought and sold and the heraldry chosen, the guildmaster's (the gold's taking is); who may walk in, and the decor, the
 *  Officers' too. GUILD1e: and the guild's board kept - any member pins, and the Officers and the guildmaster take down
 *  anyone's note (an author always takes down their own). */
export const HALL_POWERS = Object.freeze({
  hall: Object.freeze([0]),
  heraldry: Object.freeze([0]),
  hallEntry: Object.freeze([0, 1]),
  decorate: Object.freeze([0, 1]),
  notes: Object.freeze([0, 1]),   // GUILD1e: another member's note taken down from the guild's board
});
/** Whether a rank may do a thing of the hall's. */
export const hallMay = (rank, power) => (HALL_POWERS[power] ?? []).includes(rank);

/** What a hall costs over the home's own price: half again. */
export const GUILD_HALL_PRICE_MULT = 1.5;
/** A hall's price, for a home that costs `price` - whole gold, rounded up. 0 for a price the home law refuses. */
export const guildHallPrice = (price) => (Number.isSafeInteger(price) && price > 0 ? price + Math.ceil(price / 2) : 0);
/** Who may walk into a hall: its members, or anyone. */
export const GUILD_HALL_ENTRIES = Object.freeze(['guild', 'public']);
export const GUILD_HALL_ENTRY_DEFAULT = 'guild';
export const guildHallEntryOk = (v) => typeof v === 'string' && GUILD_HALL_ENTRIES.includes(v);
/** What a hall's entries read as, to its keepers. */
export const GUILD_HALL_ENTRY_WORDS = Object.freeze({ guild: 'Members', public: 'Anyone' });
/** The mark a hall's row carries where a home names its character - `guild:` and the guild's id. The colon is outside
 *  every character id's shape (service.js CHAR_ID_RE), so no character is ever it. */
export const guildHallOwner = (guildId) => `guild:${guildId}`;
