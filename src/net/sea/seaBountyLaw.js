// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a freeport's
// bounty board on the open sea's killers; bible/03-World/Eltheric-Ocean.md SEA-BOUNTY) - THE BOARD'S LAW, both ends'.
//
// A WANTED CAPTAIN is a realm character who has killed another player at sea (a fall the relay refereed in a room of the
// open sea - net/wild/wildReceipt.js `m`, net/wire.js seaRoomOf) within SEA_WANTED_DAYS, or one a bounty still stands on.
// Any player may POST gold on a wanted captain's head at a freeport's harbourmaster - SEA_BOUNTY_MIN to SEA_BOUNTY_MAX a
// post, off the poster's own record (the service's, never minted). The bounty STANDS until its captain falls at sea at
// another player's hand: then all of it is OWED to that hand - the fall's own receipt names the killer's character
// (`kc`) - and collected at any freeport, into that character's record. No gold is made or lost: every coin owed was
// posted.
//
// Pure: the numbers, the shapes, and the board's words.
// ═══════════════════════════════════════════════════════════════════

/** The fewest gold a post may put on a head. */
export const SEA_BOUNTY_MIN = 100;
/** The most one post may. */
export const SEA_BOUNTY_MAX = 50_000;
/** The posts a freeport's board offers: a press each. */
export const SEA_BOUNTY_POSTS = Object.freeze([500, 2000, 10_000]);
/** A captain is wanted this many days after a kill at sea (and for as long as a bounty stands on them). */
export const SEA_WANTED_DAYS = 14;
/** The board's rows at most. */
export const SEA_BOARD_MAX = 12;
/** A post's request id - one asked twice is one post. */
export const SEA_BOUNTY_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

/** A post's gold, well-formed: a whole sum within the bounds. */
export const seaBountyGoldOk = (n) => Number.isSafeInteger(n) && n >= SEA_BOUNTY_MIN && n <= SEA_BOUNTY_MAX;

/**
 * The board's answer, as the client reads it: `{ wanted: [{ char, name, kills, bounty }], owed, mine, prizes, back }` - each
 * row a wanted captain (their character, name, kills at sea within SEA_WANTED_DAYS, the bounty standing), at most
 * SEA_BOARD_MAX; `owed` the gold owed the asking character; `mine` the bounty on their own head; SHIP-PVP: `prizes` the
 * pieces of wrecks they boarded held for them, `back` their own hold's due back. Anything malformed dropped; null for a
 * body that is no board.
 */
export function readSeaBoard(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.wanted)) return null;
  const gold = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
  const wanted = v.wanted.slice(0, SEA_BOARD_MAX)
    .filter((w) => w && typeof w.char === 'string' && w.char.length <= 40 && typeof w.name === 'string' && w.name.length > 0 && w.name.length <= 64)
    .map((w) => ({ char: w.char, name: w.name, kills: gold(w.kills), bounty: gold(w.bounty) }));
  return { wanted, owed: gold(v.owed), refund: gold(v.refund), mine: gold(v.mine), prizes: gold(v.prizes), back: gold(v.back) };
}
