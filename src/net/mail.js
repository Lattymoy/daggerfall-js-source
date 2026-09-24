// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAIL1 - THE LETTERBOX, AS THE CLIENT SEES IT.
//
// Addison Knox: "An in-game mail system where players can send messages
// to offline players (e.g. notes, contracts, invitations)."
//
// The account service keeps the letters (server-account/src/letters.js)
// and their law is net/letterLaw.js. This is the client's half: the four
// routes, and ONE MODEL of the box that the friends panel's Letters tab
// draws and the host polls - so the panel decides nothing about the
// wire and the wire nothing about pixels (net/accountClient.js's rule).
//
// PURE THE SAME WAY accountClient.js IS: the service is reached through
// `ioOf()`, which the host builds from its storage each time (a player
// can sign in or out between two looks), and the clock is an argument.
// A node test drives the whole box against a fetch that answers the real
// service's shapes.
//
// ═══ FOUND, NOT PUSHED ═════════════════════════════════════════════
//
// A letter waits in the service; nothing tells this client one arrived.
// The box is looked at when the Letters tab opens, when the host starts,
// and every MAIL_POLL_MS after - one GET, a few hundred bytes, against a
// per-account budget of ACCOUNT_MAX a minute. A letter written to a
// player who is online reaches them within that interval, which for
// words meant for somebody who is AWAY is the right trade: a push would
// need the relay and the service to talk, and neither has a reason to.
//
// ═══ WHAT THE SERVICE SAYS IS CHECKED BEFORE IT IS KEPT ════════════
//
// A letter's words came from another player's keyboard. The panel writes
// them with textContent and nothing else; this checks their SHAPE, so a
// malformed answer (a proxy's page, a service that has moved on) is
// dropped rather than drawn: an id the service could have minted, text
// where text belongs, a time that is a time.
//
// Not a DFU member: Daggerfall Unity has no letters between players. Ledger A row (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { call, forgetSession, handleShapeOk } from './accountClient.js';
import { letterWords, LETTER_ID_RE, LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTERS_INBOX_MAX } from './letterLaw.js';
import { agoLadder } from './social.js';   // AUDIT 68 S14-ago-text-duplicated: the friends list's own ladder, not a copy of it

/** How often the host looks at the box while the game runs. */
export const MAIL_POLL_MS = 3 * 60 * 1000;

// ── THE ROUTES ──────────────────────────────────────────────────────
// The thinnest wrappers, as accountClient.js's are: so no surface ever spells a path.

/** The box: `{ letters: [{ id, from, title, glyphs, subject, sentAt, read }], unread, max }`, newest first. */
export const inboxCall = (io) => call(io, '/v1/mail/inbox');
/** Send one: `{ ok, id, to }`, `to` the reader's handle as they spell it. */
export const sendCall = (io, { to, subject, body }) => call(io, '/v1/mail/send', { to, subject, body });
/** Open one of mine: `{ letter: { id, from, title, glyphs, subject, body, sentAt, readAt } }` - and it is read now. */
export const readCall = (io, id) => call(io, '/v1/mail/read', { id });
/** Throw one away: `{ ok, id }`. */
export const deleteCall = (io, id) => call(io, '/v1/mail/delete', { id });

// ── THE SHAPES ──────────────────────────────────────────────────────

/** A letter's head, as the box keeps it: who, their badge, what about, when, whether opened.
 *  @typedef {{ id: string, from: string, title: string|null, glyphs: string[], subject: string, sentAt: number, read: boolean }} LetterHead */
/** A whole letter: its head and its words.
 *  @typedef {LetterHead & { body: string }} Letter */

const text = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);
const when = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);
const glyphList = (v) => (Array.isArray(v) ? v.filter((g) => typeof g === 'string').slice(0, 8) : []);

/** A letter's head as the box keeps it, or null for one that is not a letter's shape.
 *  @returns {LetterHead|null} */
export function letterHead(l) {
  if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !LETTER_ID_RE.test(l.id)) return null;
  const from = text(l.from, 64), subject = text(l.subject, LETTER_SUBJECT_MAX), sentAt = when(l.sentAt);
  if (!from || !subject || !sentAt) return null;
  return { id: l.id, from, title: text(l.title, 64), glyphs: glyphList(l.glyphs), subject, sentAt, read: l.read === true };
}

/** A whole letter as the box keeps it, or null.
 *  @returns {Letter|null} */
export function letterWhole(l) {
  const head = letterHead(l);
  const body = text(l?.body, LETTER_BODY_MAX);
  return head && body ? { ...head, body, read: true } : null;
}

/** How long ago a letter was sent, in the friends list's own manner (net/social.js agoLadder). */
export function letterAgeText(sentAtS, nowMs) {
  return agoLadder(nowMs - sentAtS * 1000);
}

/** A reply's subject: "Re: " once, however many times the letter has gone back and forth, within the bound. */
export function replySubject(subject) {
  const s = `Re: ${String(subject ?? '').replace(/^(re:\s*)+/i, '')}`;
  return s.length <= LETTER_SUBJECT_MAX ? s : s.slice(0, LETTER_SUBJECT_MAX);
}

/** The chat's line when a look finds letters: who wrote and what about for one, a count for more, and where to read
 *  them - a line nobody spoke (the world tab's system lines, SRV-N's flag). */
export function mailNoticeText(event) {
  if (event?.kind === 'new') {
    const ls = Array.isArray(event.letters) ? event.letters : [];
    if (ls.length === 1) return `A letter from ${ls[0].from}: "${ls[0].subject}". Open Social, then Letters.`;
    return `${ls.length} new letters. Open Social, then Letters.`;
  }
  const n = event?.count ?? 0;
  return `You have ${n} unread letter${n === 1 ? '' : 's'}. Open Social, then Letters.`;
}

// ── THE BOX ─────────────────────────────────────────────────────────

/**
 * ONE PLAYER'S LETTERBOX, as this client last saw it.
 *
 * `state` is what the Letters tab draws its top from:
 *   - 'unknown'    - nobody has looked yet
 *   - 'signed-out' - no session on this device (or the service stopped honouring it: `auth` forgets it)
 *   - 'guest'      - a session without a username: letters need one (`mail-needs-account`)
 *   - 'ready'      - the box, as of `at`
 *   - 'error'      - the last look failed (`error` says how); the letters of the look before it stay shown
 * `version` moves on every change, so a surface repaints on a number rather than a frame.
 */
export class MailBox {
  /**
   * @param {object} opts
   * @param {() => ({ fetch: any, base?: string, secret: string, storage?: any } | null)} opts.ioOf  the service, now
   * @param {() => number} [opts.now]  ms
   * @param {(event: { kind: 'new', letters: object[] } | { kind: 'waiting', count: number }) => void} [opts.onLetter]
   *        told when a look finds letters that were not there before (`new`), and on the first look of a sitting
   *        that finds unread ones (`waiting`) - the host's line in the chat
   */
  constructor({ ioOf, now = () => Date.now(), onLetter = null }) {
    this.ioOf = ioOf;
    this.now = now;
    this.onLetter = onLetter;
    this.state = 'unknown';
    /** @type {string|null} */ this.error = null;
    /** @type {LetterHead[]} */ this.letters = [];
    this.unread = 0;
    this.max = LETTERS_INBOX_MAX;
    /** The whole letters opened this sitting, by id - a second look at one is not a second call.
     *  @type {Map<string, Letter>} */
    this.opened = new Map();
    this.version = 0;
    this.at = 0;
    /** @type {Set<string>|null} ids seen by the last look - null until the first, which announces differently */
    this._known = null;
    /** @type {Promise<any>|null} */ this._looking = null;
  }

  _changed() { this.version++; }

  /** The service, or null - and when null the box says so (a sign-out between two looks). */
  _io() {
    const io = this.ioOf?.() ?? null;
    if (!io?.secret) { if (this.state !== 'signed-out') { this.state = 'signed-out'; this.letters = []; this.unread = 0; this.opened.clear(); this._known = null; this._changed(); } return null; }
    return io;
  }

  /** A refusal the whole box answers to: `auth` forgets the session (accountClient's rule), a guest is a guest. True
   *  when it was one of those. */
  _boxRefusal(io, error) {
    if (error === 'auth') { forgetSession(io.storage); this.state = 'signed-out'; this.letters = []; this.unread = 0; this.opened.clear(); this._known = null; this.error = error; this._changed(); return true; }
    if (error === 'mail-needs-account') { this.state = 'guest'; this.letters = []; this.unread = 0; this.error = error; this._changed(); return true; }
    return false;
  }

  /** Is a look due (the host's poll)? */
  due(nowMs = this.now()) { return !this._looking && (this.at === 0 || nowMs - this.at >= MAIL_POLL_MS); }

  /** LOOK AT THE BOX. One look at a time - a second call while one is out answers with the first. */
  refresh() {
    if (this._looking) return this._looking;
    this._looking = this._refresh().finally(() => { this._looking = null; });
    return this._looking;
  }

  async _refresh() {
    // STAMPED EVEN WHEN THERE IS NO SESSION: an unstamped look is due again at once, and the host's frame would read and
    // parse the store sixty times a second for a player who is signed out. A sign-in is found at the next look, or
    // when the Letters tab opens.
    this.at = this.now();
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await inboxCall(io);
    this.at = this.now();
    if (!r.ok) {
      if (!this._boxRefusal(io, r.error)) { this.state = 'error'; this.error = r.error ?? 'server'; this._changed(); }
      return { ok: false, error: r.error };
    }
    const letters = (Array.isArray(r.data?.letters) ? r.data.letters : []).map(letterHead).filter((l) => l !== null);
    const first = this._known === null;
    const fresh = first ? [] : letters.filter((l) => !l.read && !this._known.has(l.id));
    this._known = new Set(letters.map((l) => l.id));
    const was = JSON.stringify([this.state, this.letters, this.error]);
    this.letters = letters;
    this.unread = letters.filter((l) => !l.read).length;
    this.max = Number.isSafeInteger(r.data?.max) ? r.data.max : LETTERS_INBOX_MAX;
    this.state = 'ready';
    this.error = null;
    for (const id of [...this.opened.keys()]) if (!this._known.has(id)) this.opened.delete(id);   // thrown away elsewhere
    if (JSON.stringify([this.state, this.letters, this.error]) !== was) this._changed();
    if (fresh.length) this.onLetter?.({ kind: 'new', letters: fresh });
    else if (first && this.unread) this.onLetter?.({ kind: 'waiting', count: this.unread });
    return { ok: true, fresh };
  }

  /** The host's frame: a look when one is due. Never awaited by a frame - it lands on its own. */
  poll(nowMs = this.now()) { if (this.due(nowMs)) this.refresh(); }

  /** OPEN ONE: the whole letter, from this sitting's copy or the service - which marks it read. */
  async open(id) {
    const kept = this.opened.get(id);
    if (kept) return { ok: true, letter: kept };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await readCall(io, id);
    if (!r.ok) {
      if (this._boxRefusal(io, r.error)) return { ok: false, error: r.error };
      if (r.error === 'no-letter') { this._drop(id); }
      return { ok: false, error: r.error };
    }
    const letter = letterWhole(r.data?.letter);
    if (!letter || letter.id !== id) return { ok: false, error: 'server' };
    this.opened.set(id, letter);
    const head = this.letters.find((l) => l.id === id);
    if (head && !head.read) { head.read = true; this.unread = Math.max(0, this.unread - 1); }
    this._changed();
    return { ok: true, letter };
  }

  /** SEND ONE - checked here by the letter's own law first, so a refusal the service would give is given at once. */
  async send({ to, subject, body }) {
    const handle = typeof to === 'string' ? to.trim() : '';
    if (!handleShapeOk(handle)) return { ok: false, error: 'no-reader' };
    const words = letterWords({ subject, body });
    if ('error' in words) return { ok: false, error: words.error };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await sendCall(io, { to: handle, subject: words.subject, body: words.body });
    if (!r.ok) { this._boxRefusal(io, r.error); return { ok: false, error: r.error }; }
    return { ok: true, to: typeof r.data?.to === 'string' ? r.data.to : handle };
  }

  /** THROW ONE AWAY. Gone from the box whether the service deleted it now or it was already gone. */
  async remove(id) {
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await deleteCall(io, id);
    if (!r.ok && this._boxRefusal(io, r.error)) return { ok: false, error: r.error };
    if (r.ok || r.error === 'no-letter') { this._drop(id); return { ok: true }; }
    return { ok: false, error: r.error };
  }

  _drop(id) {
    const at = this.letters.findIndex((l) => l.id === id);
    if (at >= 0) { if (!this.letters[at].read) this.unread = Math.max(0, this.unread - 1); this.letters.splice(at, 1); }
    this.opened.delete(id);
    this._known?.delete(id);
    this._changed();
  }
}
