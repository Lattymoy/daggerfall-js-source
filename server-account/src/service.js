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
export const ACCOUNT_VERSION = 'acct3';   // acct3: ACC3's titles and glyphs

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
const CHAR_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
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
  // ACC2: the LISTING is a fixed path; every other save route carries
  // the slot in it and is matched by `savePathOf`.
  '/v1/saves',
]);

/** The routes a caller reaches WITHOUT a credential. Everything else
 *  resolves a session first. Named rather than special-cased inside the
 *  ladder, so "what can a stranger reach?" has one answer. */
export const OPEN_ROUTES = new Set(['/v1/health', '/v1/auth/guest', '/v1/auth/login', '/v1/auth/recover']);
