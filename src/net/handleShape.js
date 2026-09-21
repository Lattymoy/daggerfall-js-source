// @ts-check
// ═══════════════════════════════════════════════════════════════════
// THE TWO NAME SHAPES, AND WHY THEY LIVE HERE RATHER THAN ON THE SERVER
//
// ACC1b wrote these two regexes in `server-account/src/guestName.js`,
// which was right while only the service asked them. ACC1e gave the
// player a field to type a handle INTO, and a field that accepts what
// the far end refuses is a refusal the player meets after pressing
// rather than before - so the client has to ask the same question.
//
// IT COULD NOT ASK IT WHERE IT WAS. Every import in this repo runs one
// way - `server/` and `server-account/` import from `src/`, never the
// reverse (server/src/relay.js takes wire.js, accounts.js takes
// identityToken.js, guestName.js takes nameGen.json). A client file
// reaching into `server-account/` would have been the only edge going
// the other way, and an architecture with one exception in it is an
// architecture nobody can state.
//
// SO THE LAW MOVED TO THE SIDE BOTH ENDS ALREADY IMPORT FROM, and
// guestName.js re-exports it so nothing that reads it there has to
// care. ACC1a's "ONE HOME BOTH ENDS" is the same move for the token.
//
// BOTH HALVES MOVED TOGETHER, AND THAT IS NOT A TIDINESS CHOICE.
// ACC1b's own words: "THE ONE SPACE IS THE LAW, and both halves of it
// are exported from here so neither can drift from the other." Taking
// HANDLE_RE and leaving GUEST_NAME_RE behind would have broken exactly
// the property that comment exists to hold - the two are one law seen
// from its two sides, and a law split across two files is a law with
// two futures.
//
// ═══ THE SHAPE IS THE ANTI-IMPERSONATION GUARANTEE ═════════════════
//
// A GUEST NAME ALWAYS CARRIES EXACTLY ONE SPACE; A CHOSEN HANDLE NEVER
// CARRIES ONE. That is the whole of it, and it is STRUCTURAL rather
// than a lookup: a guest cannot be auto-assigned a name that collides
// with somebody's account, because the two name spaces cannot overlap
// by construction. No query, no race, nothing to get wrong at 3am.
//
// The alternative was to check each generated name against the handle
// table. That is a lookup that can race a rename, and it answers "not
// taken YET".
// ═══════════════════════════════════════════════════════════════════

/**
 * A guest name is `<first> <surname>`; a handle is one word.
 *
 * THE LAW RESTS ON THE SPACE AND ON NOTHING ELSE, which is deliberate
 * and was learnt the hard way: the first cut spelled the guest shape as
 * `[A-Za-z]+ [A-Za-z]+` and its own pin caught `Akh'ar Arabi` on the
 * eighteenth draw - DFU's banks carry apostrophes and hyphens, and a
 * rule that enumerates an alphabet is a rule that breaks when the data
 * says something the author did not check. So a guest's name is
 * "exactly one space, and no other whitespace", a handle's is "no space
 * at all", and what the letters are is the bank's business. Everything
 * else a name must satisfy is `nameIsIssuable` - the wire's own law,
 * which bounds the length and the character range already.
 */
export const GUEST_NAME_RE = /^\S+ \S+$/;

/** ...and the handle's rule does TWO jobs, which are worth keeping
 *  apart: `[^\s]` is the disjointness law above (no whitespace, so it
 *  can never read as a guest's two words), and the leading letter is an
 *  ordinary product rule - it keeps a handle from being `12345` or
 *  `___`, which read as ids rather than as people. The second is a
 *  choice and can be relaxed; the first cannot. */
export const HANDLE_RE = /^[A-Za-z][^\s]{2,23}$/;

/** Is this the name of a guest - by its SHAPE, not by asking anybody? */
export const isGuestShaped = (name) => typeof name === 'string' && GUEST_NAME_RE.test(name);

/** Is this a handle a player may choose? One word, so it can never be
 *  read as a guest's. */
export const isHandleShaped = (name) => typeof name === 'string' && HANDLE_RE.test(name);
