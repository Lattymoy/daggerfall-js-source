// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT-ACC F2: WHAT THIS SERVICE IS, SEPARATE FROM ITS ENTRYPOINT.
//
// These four constants lived in `src/index.js` until the audit stood
// the Worker up in a real workerd and it refused to boot:
//
//   Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
//   the provided value is not of type 'function or ExportedHandler'.
//
// IN A MODULE WORKER, EVERY NAMED EXPORT OF THE ENTRYPOINT IS AN
// ENTRYPOINT. workerd reads them as additional handlers - a
// WorkerEntrypoint, a Durable Object, a Workflow - and a plain string
// or Set is not one of those, so it is a hard startup failure rather
// than something ignored. The relay's own `server/src/index.js` is the
// control: it exports `default` and the `Room` Durable Object class,
// both legal, and it has deployed for months.
//
// No node test could see this. The tests IMPORTED those very names, so
// they proved the exports existed while the runtime rejected them for
// existing. The fix is not to hide them - it is to stop the entrypoint
// doubling as a library. The entrypoint answers requests; this file
// says what the service is; both the entrypoint and the tests read it
// from here.
// ═══════════════════════════════════════════════════════════════════

/** Bumped with every change to this Worker's law, and answered by
 *  /v1/health - the same discipline RELAY_VERSION keeps, for the same
 *  reason: a deploy that did not happen looks exactly like one that
 *  did. Kept in step with ACCOUNT_VERSION in wrangler.toml, which
 *  test/accountworker.test.js holds. */
export const ACCOUNT_VERSION = 'acct12';   // acct12: RENOWN4's track total in the mint's answer, GUILD1c's guild on the token (the mint's `gi`/`gt`/`gm` and its answer's tag) and the guild acts' signed orders (one deploy; acct11 and acct12 on their branch - main's WB5b took acct11 first); acct11: WB5b's gates closed (the kill receipt's claim; acct10 on its branch - RENOWN1, HOME1, DECOR1 and GUILD1 took acct10 first); acct10: RENOWN1's Renown, HOME1's online homes, DECOR1's decor and GUILD1's guilds (all unshipped, one deploy; acct9 on the branch - FOUNDER2 took acct9 first); acct8: DUEL1's duelling record; acct3: ACC3's titles and glyphs; acct4: ACC4's time played; acct5: MOD1's moderation; acct6: MAIL1's letters; acct7: TITLE-N's Dungeon Master and Patreon tiers; acct9: FOUNDER2's cutoff at 2026-09-25 (acct8 on its branch; DUEL1 took acct8 first)

/** A body bigger than this is not a request this service has. Read
 *  BEFORE the JSON is parsed, so a megabyte of nothing costs nothing. */
export const MAX_BODY_BYTES = 4 * 1024;

/** ═══ ACC2: THE SAVE ROUTES, AND WHY THEY ARE NOT IN `ROUTES` ══════
 *
 * Every route above is a fixed string, so a Set answers "does this
 * exist?". A save route carries the character and the slot in the path,
 * so it needs a match rather than a lookup - and the match lives here,
 * pure, beside the Set, because `index.js` asks BOTH before it decides
 * a path is a 404.
 *
 * `/v1/saves/<characterId>/<saveName>[/data|/shot]`, with both segments
 * percent-encoded by the caller: a save name is the player's own words
 * ("before the lich"), so it may hold a space, a slash or a hash, and
 * pasting it into a path unencoded is how one slot comes to address
 * another.
 *
 * It returns null for anything it is not sure of. A name that decodes
 * to nothing, one past SAVE_NAME_MAX, an id that is not id-shaped and a
 * tail that is not one of the two known parts are all "no such route"
 * rather than a request this service half-understands.
 */
export const SAVE_NAME_MAX = 64;
/** Both shapes `systems/characterId.js` mints - a `crypto.randomUUID()`
 *  where the runtime has one, and `<base36 stamp>-<10 random>` on an old
 *  WebView where it does not. A pin drives that minter and asserts every
 *  id it produces passes this. DELIBERATELY NOT `net/wire.js` ID_RE:
 *  that is the shape of a PEER id, which is a different thing that
 *  happens to look similar, and reusing it would tie a save's filing to
 *  a bound the online arc is free to move. */
export const CHAR_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
export const SAVE_PARTS = Object.freeze(['data', 'shot']);

export function savePathOf(path) {
  if (typeof path !== 'string' || !path.startsWith('/v1/saves/')) return null;
  const rest = path.slice('/v1/saves/'.length);
  if (!rest) return null;
  const seg = rest.split('/');
  if (seg.length < 2 || seg.length > 3) return null;
  const part = seg.length === 3 ? seg[2] : null;
  if (part !== null && !SAVE_PARTS.includes(part)) return null;
  let characterId, saveName;
  try { characterId = decodeURIComponent(seg[0]); saveName = decodeURIComponent(seg[1]); }
  catch { return null; }   // a malformed escape is not a slot
  if (!CHAR_ID_RE.test(characterId)) return null;
  // A NAME IS BOUNDED AND PRINTABLE. The store's own cards carry
  // whatever the player typed, and this is the one door where that
  // string becomes part of a key somebody else's row also lives under.
  if (!saveName || saveName.length > SAVE_NAME_MAX || /[\u0000-\u001f\u007f]/.test(saveName)) return null;
  return { characterId, saveName, part };
}

/** The R2 key. PLAYER FIRST, so "everything this account holds" is a
 *  prefix walk rather than a join against D1 - which is what makes a
 *  deleted account cleanable at all. Every segment is encoded, for the
 *  reason `savePathOf` decodes: a save name is player-typed. */
export const savePrefix = (playerId) => `saves/${encodeURIComponent(playerId)}/`;
export const saveKey = (playerId, characterId, saveName, part) =>
  `${savePrefix(playerId)}${encodeURIComponent(characterId)}/${encodeURIComponent(saveName)}/${part}`;

/** THE BOUNDS. `MAX_BODY_BYTES` above is 4 KiB and is right for every
 *  JSON route this service has; a save is hundreds of kilobytes, so the
 *  blob routes read a RAW body against these instead. Named here rather
 *  than written into the ladder, because a bound nobody can find is a
 *  bound somebody raises by accident. */
export const SAVE_MAX_BYTES = 4 * 1024 * 1024;
export const SHOT_MAX_BYTES = 256 * 1024;
/** Slots per ACCOUNT. An account at this bound is refused; its oldest
 *  slot is never taken to make room, because this is a BACKUP and a
 *  backup that deletes things to make room is not one. */
export const SAVES_MAX = 60;

/** Every path this service serves. Named once, so the 404 and the
 *  ladder cannot come to disagree about what exists. */
export const ROUTES = new Set([
  '/v1/health', '/v1/pubkey', '/v1/auth/guest', '/v1/auth/token', '/v1/auth/session',
  '/v1/account', '/v1/auth/logout',
  // ACC1c: username and password. `register` needs a session (it
  // upgrades the guest row that session belongs to); `login` and
  // `recover` are the two that do NOT, because a player standing at
  // them has no session yet - which is exactly why they are the two
  // that are throttled.
  '/v1/auth/register', '/v1/auth/login', '/v1/auth/recover',
  '/v1/account/password', '/v1/account/email',
  // ACC3: the one WRITE in the wardrobe. Holding a title is derived
  // and nothing can equip a glyph, so this is the only thing about
  // either that a player chooses - and so the only route.
  '/v1/account/title',
  // ACC4: the beat that counts time played. It writes, and it is the
  // service's clock that decides how much - the body is never read.
  '/v1/account/played',
  // MOD1: the one moderation route. Behind a session like every other,
  // and it refuses anybody the service's own lists do not name.
  '/v1/mod/mute',
  // ACC2: the LISTING is a fixed path; every other save route carries
  // the slot in it and is matched by `savePathOf`.
  '/v1/saves',
  // MAIL1: letters to a registered player, kept until their reader
  // throws them away. The box is a GET; the three that change something
  // are POSTs, each naming the letter in its body - never in the path,
  // so an id is never a URL a log keeps.
  '/v1/mail/inbox', '/v1/mail/send', '/v1/mail/read', '/v1/mail/delete',
  // DUEL1: the duelling record - the loser's own report, and any
  // account's two counts for the Inspect card. Both behind a session.
  '/v1/duel/loss', '/v1/duel/record',
  // RENOWN1: Renown - what one of the caller's characters
  // earned online. Behind a session; the level itself rides the token.
  '/v1/renown/xp',
  // HOME1: the online homes - one owner a building (homes.js). A town's
  // homes are read by every session, a guest's too (the doors say whose
  // a home is to everyone); the three that change one are an account's.
  '/v1/homes/town', '/v1/homes/mine', '/v1/homes/claim', '/v1/homes/release', '/v1/homes/entry',
  // DECOR1: an online home's decor (decor.js). Its pieces are read by every session (the room is the same room to
  // every visitor); the three that change one are its owner's.
  '/v1/homes/decor', '/v1/homes/decor/place', '/v1/homes/decor/move', '/v1/homes/decor/remove',
  // GUILD1: the guilds (guilds.js) - a character's own guild and the account's invitations read by any session (a
  // guest's reads nothing); the rest change one, an account's alone.
  '/v1/guilds/mine', '/v1/guilds/invites', '/v1/guilds/found', '/v1/guilds/invite', '/v1/guilds/answer', '/v1/guilds/leave',
  '/v1/guilds/remove', '/v1/guilds/rank', '/v1/guilds/ranks', '/v1/guilds/deposit', '/v1/guilds/withdraw', '/v1/guilds/handover',
  '/v1/guilds/disband',
  // WB5b: the gates closed - the kill receipt the relay signed, carried
  // here by the account it names. Behind a session.
  '/v1/gate/claim',
]);

/** The routes a caller reaches WITHOUT a credential. Everything else
 *  resolves a session first. Named rather than special-cased inside the
 *  ladder, so "what can a stranger reach?" has one answer. */
export const OPEN_ROUTES = new Set(['/v1/health', '/v1/auth/guest', '/v1/auth/login', '/v1/auth/recover']);
