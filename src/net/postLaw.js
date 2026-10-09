// @ts-check
// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items."): THE SERVER'S POST - ITS LAW, the one file the service (server-account/src/post.js), the operator's
// tool (tools/sendServerPost.mjs) and the client (net/serverPost.js, ui/enhancedPost.js) all read.
//
// A piece of the post is the developers' to one account: a subject, a body, and at most ONE item, which its reader
// claims into the online character they are playing. Nothing a player sends writes one - the operator's workflow
// (.github/workflows/server-post.yml) is its only sender.

/** A piece's id: the service's mintId shape, or the operator's statement's `lower(hex(randomblob(12)))` - 24 hex. */
export const POST_ID_RE = /^[A-Za-z0-9_-]{16,40}$/;
/** An operator's send's name ('hours-first-hourlock'): lower-case words and hyphens. One piece a batch an account. */
export const POST_BATCH_RE = /^[a-z0-9][a-z0-9-]{2,47}$/;
/** Who the post is from, as the box shows it. */
export const POST_SENDER = 'The Developers';
/** How many pieces the box lists, newest first - the rest wait behind them, never lost. */
export const POST_BOX_MAX = 50;
/** A subject's and a body's bounds, in characters. */
export const POST_SUBJECT_MAX = 80;
export const POST_BODY_MAX = 1200;
/** How often the client looks at the box while the game runs - the letterbox's own clock (net/mail.js MAIL_POLL_MS). */
export const POST_POLL_MS = 3 * 60 * 1000;

/** A string within `max`, or null. */
const text = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/**
 * WHAT A PIECE'S ITEM IS, as the box lists it - its name and its rarity, never the record (the record is the claim's).
 * Null for a piece with none, or a record that is not one.
 * @param {any} rec
 * @returns {{ name: string, rarity: string|null } | null}
 */
export function postItemHead(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  const name = text(rec.name, 80);
  if (!name) return null;
  return { name, rarity: typeof rec.rarity === 'string' && /^[a-z]{1,16}$/.test(rec.rarity) ? rec.rarity : null };
}

/**
 * A PIECE'S HEAD as the box carries it, checked on the way in (the client reads the service's answer through it), or
 * null: `{ id, from, subject, sentAt, read, item, claimed }` - `item` its postItemHead or null.
 * @param {any} p
 */
export function postHead(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !POST_ID_RE.test(p.id)) return null;
  const from = text(p.from, 40), subject = text(p.subject, POST_SUBJECT_MAX);
  if (!from || !subject || !Number.isSafeInteger(p.sentAt)) return null;
  const item = p.item == null ? null : postItemHead(p.item);
  if (p.item != null && !item) return null;
  return { id: p.id, from, subject, sentAt: p.sentAt, read: p.read === true, item, claimed: item ? p.claimed === true : false };
}

/** A WHOLE PIECE (`/v1/post/read`'s answer): its head and its body, or null. */
export function postWhole(p) {
  const head = postHead(p);
  const body = text(p?.body, POST_BODY_MAX);
  return head && body ? { ...head, body, read: true } : null;
}

/** The pieces that hold an item not yet taken - the mailbox's mark lights for these as for unread words. */
export const unclaimedOf = (/** @type {Array<{ item: any, claimed: boolean }>} */ heads) => heads.filter((h) => h.item && !h.claimed).length;
