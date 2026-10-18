// @ts-check
// PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): A
// PLAYER'S PRIVATE REPORT, AS THIS CLIENT SEES IT - the desk the mailbox window's report form and the readers' inbox draw
// (ui/enhanced/enhancedReport.js), kept on the host's PostBox (net/serverPost.js) for the sitting, so a report half
// written survives the pause face being rebuilt, closed or opened again.
//
// A SEND IS ONE REPORT, however often it is asked. Its `rid` is minted once a draft and kept until the service answers it
// - a lost answer (`offline`, `server`) asked again is answered the report it made (server-account/src/reports.js
// sendReport's `repeat`) - and a draft changed after a failure is a new send, never the old one's answer.
import { call, forgetSession } from './accountClient.js';
import { t } from '../systems/textManager.js';
import { BUILD_TAG, UPDATE } from '../buildTag.js';
import { reportWordsOf, reportContextOf, reportHead, reportInboxHead, reportWhole, REPORT_INBOX_MAX } from './reportLaw.js';

/** A send: `{ ok, id, sentAt }` or `{ ok, repeat, id, sentAt }`. */
export const reportSendCall = (io, o) => call(io, '/v1/report/send', o);
/** My own: `{ reports: [head...], max }`. */
export const reportMineCall = (io) => call(io, '/v1/report/mine', {});
/** A reader's inbox, a page of it: `{ which, page, more, reports: [head + from...], unread, open, max }`. */
export const reportInboxCall = (io, which, page = 0) => call(io, '/v1/report/inbox', { which, page });
/** A reader's one report, opened: `{ report: { ...head, from, body, context, closedAt } }`. */
export const reportReadCall = (io, id) => call(io, '/v1/report/read', { id });
/** A reader's close (or open again): `{ ok, id, state }`. */
export const reportCloseCall = (io, id, state) => call(io, '/v1/report/close', { id, state });

/** A send's own id - the notice board's shape (net/noticeBook.js mintNoticeRid). */
export function mintReportRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `r${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/** WHAT RIDES WITH A REPORT, and all of it: the update and the build the pause window prints (REL8, buildTag.js), and
 *  whether this is the desktop app (app/preload.cjs's bridge) or a browser. The form says so before it is sent. */
export function reportContext({ update = UPDATE, build = BUILD_TAG, desktop = !!(/** @type {any} */ (globalThis).daggerShell) } = {}) {
  return reportContextOf({ update, build, app: desktop ? 'desktop' : 'browser' });
}

/** The word a report's state says to its reporter and to a reader, in the player's language, read when it is said. */
const STATE_WORDS = Object.freeze({
  open: () => t('report.state.open', 'Open'),
  fixed: () => t('report.state.fixed', 'Fixed'),
  wontfix: () => t('report.state.wontfix', 'Won\'t fix'),
  duplicate: () => t('report.state.duplicate', 'Duplicate'),
});
export const reportStateText = (/** @type {string} */ state) => STATE_WORDS[state]?.() ?? String(state);
/** The word a report's kind says in a list. */
const KIND_WORDS = Object.freeze({
  exploit: () => t('report.kindWord.exploit', 'Exploit'),
  bug: () => t('report.kindWord.bug', 'Bug'),
  security: () => t('report.kindWord.security', 'Security'),
});
export const reportKindText = (/** @type {string} */ kind) => KIND_WORDS[kind]?.() ?? String(kind);

/** The form empty. */
const emptyDraft = () => ({ kind: /** @type {string|null} */ (null), subject: '', body: '' });
/** A count the service answered, or null - a safe integer, never below nought (the box's own check, serverPost.js). */
const countsOf = (/** @type {any} */ d) => (Number.isSafeInteger(d?.unread) && Number.isSafeInteger(d?.open) && d.unread >= 0 && d.open >= 0 ? { unread: d.unread, open: d.open } : null);

/**
 * THE DESK. `version` moves on every change, so a window repaints on a number. `mine` and `inbox` are null until looked at,
 * then the last good answer (a failed look keeps it and says `error`).
 *
 * AUDIT PRIVATE-REPORT CLI-1: THE DESK IS ONE ACCOUNT'S. Everything on it - the draft, the send's id, my list, a reader's
 * inbox and the whole reports they opened - is the account whose session asked for it, and goes the moment another
 * session stands in its place (`_io`: the session changed) or none does (the box's reset, `reset`). It outlived a sign-out:
 * the next account's form held the last one's draft and listed its titles, and a reader's opened reports answered from
 * this copy to an account that may read none.
 */
export class ReportDesk {
  /**
   * @param {object} o
   * @param {() => ({ fetch: any, base?: string, secret: string, storage?: any } | null)} o.ioOf  the service, now
   * @param {() => string} [o.rid]
   * @param {() => any} [o.context]
   * @param {((counts: { unread: number, open: number }) => void) | null} [o.onCounts]  told each time the desk takes a
   *        reader's counts (an inbox look, a report opened) - the box's envelope counts them (AUDIT PRIVATE-REPORT CLI-2)
   */
  constructor({ ioOf, rid = () => mintReportRid(), context = () => reportContext(), onCounts = null }) {
    this.ioOf = ioOf;
    this.rid = rid;
    this.context = context;
    this.onCounts = onCounts;
    this.version = 0;
    /** @type {string|null} the session the desk's state is for */ this._secret = null;
    this.sending = false;
    this.reset();
  }

  /** EVERYTHING ON THE DESK GONE - another account, or none. A look or a send still out answers to nobody (`_epoch`). */
  reset() {
    /** What the form holds. */
    this.draft = emptyDraft();
    /** @type {any[]|null} */ this.mine = null;
    /** @type {string|null} */ this.mineError = null;
    /** @type {{ open: any[]|null, closed: any[]|null }} */ this.inbox = { open: null, closed: null };
    /** AUDIT PRIVATE-REPORT SVC-4: whether another page of each list waits. */
    this.inboxMore = { open: false, closed: false };
    /** @type {string|null} */ this.inboxError = null;
    this.counts = { unread: 0, open: 0 };
    /** @type {Map<string, any>} */ this.opened = new Map();
    /** AUDIT PRIVATE-REPORT UI-4: how the last send ended - `{ ok, repeat?, error? }` - for whichever pane stands when it
     *  answers (a face rebuilt mid-send, a window closed and opened again), null once said. */
    /** @type {any} */ this.lastSend = null;
    /** @type {string|null} the send's id, minted for `_ridKey`'s words */ this._rid = null;
    /** @type {string|null} the cleaned words `_rid` was minted for */ this._ridKey = null;
    /** @type {Promise<any>|null} */ this._mineLook = null;
    this._mineAgain = false;
    /** AUDIT PRIVATE-REPORT CLI-4: each list's newest look; an older one answering later is never taken */
    this._inboxSeq = { open: 0, closed: 0 };
    /** a look set out before the last reset answers to nobody */
    this._epoch = (this._epoch ?? 0) + 1;
    /** @type {Set<string>} AUDIT PRIVATE-REPORT UI-8: the reports a close is out for */ this.closing = new Set();
    this._changed();
  }

  _changed() { this.version++; }
  /** An answer that is nobody's now: the desk was reset since it set out, or the session it was asked under no longer
   *  stands (another account signed in, and nothing has asked the desk since) - never taken nor acted on (its `auth` would
   *  forget the new session). */
  _stale(/** @type {any} */ io, /** @type {number} */ epoch) { return epoch !== this._epoch || (this.ioOf?.()?.secret ?? null) !== io?.secret; }

  /** The service, or null. AUDIT PRIVATE-REPORT CLI-1: a session not the one the desk's state is for clears it first. */
  _io() {
    const io = this.ioOf?.() ?? null;
    const secret = io?.secret || null;
    if (secret !== this._secret) {
      const had = this._secret;
      this._secret = secret;
      if (had !== null) this.reset();
    }
    return secret ? io : null;
  }
  /** A refusal the desk answers to: `auth` forgets the session and the desk with it; `not-report-reader` drops what only a
   *  reader may hold (AUDIT PRIVATE-REPORT CLI-1: the last good inbox and its opened reports were kept and drawn). */
  _refused(io, error) {
    if (error === 'auth') { forgetSession(io?.storage); this.reset(); this._secret = null; return; }
    if (error === 'not-report-reader') {
      this.inbox = { open: null, closed: null }; this.inboxMore = { open: false, closed: false }; this.opened.clear();
      this.counts = { unread: 0, open: 0 };
      this._changed();
    }
  }
  /** The reader's counts taken, and the box told (AUDIT PRIVATE-REPORT CLI-2). */
  _takeCounts(/** @type {{ unread: number, open: number }} */ c) {
    this.counts = { ...c };
    this.onCounts?.({ ...c });
  }

  /** THE FORM CHANGED: what it holds. The send's id follows the cleaned words (`send`), not each key pressed. */
  setDraft(/** @type {{ kind?: string|null, subject?: string, body?: string }} */ patch) {
    this.draft = { ...this.draft, ...patch };
  }

  /**
   * SEND THE DRAFT. Answers `{ ok, id, repeat? }` - and the draft is cleared and my list looked at again - or
   * `{ ok: false, error }`: the law's word for words the service would refuse, never asked; `signed-out`; `busy`; or
   * the service's. The outcome is kept (`lastSend`) for the pane standing when it lands.
   *
   * AUDIT PRIVATE-REPORT CLI-8, TEST-6: ONE SEND ID A REPORT'S WORDS. The id is minted for the cleaned words and kept while
   * they stand - a lost answer asked again is the report it made, however the raw text was touched between - and any
   * change of the kind, the title or the words is a new send, never answered with the old words' report.
   */
  async send() {
    if (this.sending) return { ok: false, error: 'busy' };
    /** an end said before the call, kept for the pane as every end is */
    const ended = (/** @type {any} */ out) => { this.lastSend = out; this._changed(); return out; };
    const words = reportWordsOf(this.draft);
    if ('error' in words) return ended({ ok: false, error: words.error });
    const io = this._io();
    if (!io) return ended({ ok: false, error: 'signed-out' });
    const key = JSON.stringify(words);
    if (this._ridKey !== key) { this._rid = this.rid(); this._ridKey = key; }
    const epoch = this._epoch;
    this.sending = true; this.lastSend = null; this._changed();
    let out;
    try {
      const r = await reportSendCall(io, { ...words, context: this.context(), rid: this._rid });
      if (this._stale(io, epoch)) return { ok: false, error: 'signed-out' };   // another account since: it is not theirs
      if (!r.ok) { this._refused(io, r.error); out = { ok: false, error: r.error ?? 'server' }; return out; }
      this._rid = null; this._ridKey = null;
      // AUDIT PRIVATE-REPORT CLI-9: the form emptied only if it still holds the words that went
      if (JSON.stringify(reportWordsOf(this.draft)) === key) this.draft = emptyDraft();
      this.loadMine().catch(() => {});
      out = { ok: true, id: r.data?.id, repeat: r.data?.repeat === true };
      return out;
    } finally {
      this.sending = false;
      if (out && epoch === this._epoch) this.lastSend = out;
      this._changed();
    }
  }

  /** LOOK AT MY OWN. AUDIT PRIVATE-REPORT CLI-3 (ASYNC NEVER DROPS): a look asked while one is out is COALESCED - the out
   *  look is followed by another, and every caller waits on both - never folded into an answer the service gave before
   *  the send that asked for it. */
  loadMine() {
    if (this._mineLook) { this._mineAgain = true; return this._mineLook; }
    this._mineLook = (async () => {
      let r;
      do { this._mineAgain = false; r = await this._loadMine(); } while (this._mineAgain);
      return r;
    })().finally(() => { this._mineLook = null; });
    return this._mineLook;
  }
  async _loadMine() {
    const io = this._io();
    if (!io) { this.mine = null; this.mineError = 'signed-out'; this._changed(); return { ok: false, error: 'signed-out' }; }
    const epoch = this._epoch;
    const r = await reportMineCall(io);
    if (this._stale(io, epoch)) return { ok: false, error: 'signed-out' };
    if (!r.ok) { this._refused(io, r.error); this.mineError = r.error ?? 'server'; this._changed(); return { ok: false, error: this.mineError }; }
    this.mine = (Array.isArray(r.data?.reports) ? r.data.reports : []).map(reportHead).filter((h) => h !== null);
    this.mineError = null;
    this._changed();
    return { ok: true };
  }

  /** A READER'S INBOX, `which` 'open' or 'closed' - its first page, or (`more`) the next, added under the rows held.
   *  AUDIT PRIVATE-REPORT CLI-4: an answer older than the newest look of its list is never taken. */
  async loadInbox(which = 'open', { more = false } = {}) {
    const w = which === 'closed' ? 'closed' : 'open';
    const io = this._io();
    if (!io) { this.inboxError = 'signed-out'; this._changed(); return { ok: false, error: 'signed-out' }; }
    const held = more ? (this.inbox[w] ?? []) : null;
    const page = more ? Math.ceil((held?.length ?? 0) / REPORT_INBOX_MAX) : 0;
    const seq = ++this._inboxSeq[w];
    const epoch = this._epoch;
    const r = await reportInboxCall(io, w, page);
    if (this._stale(io, epoch) || seq !== this._inboxSeq[w]) return { ok: false, error: 'stale' };
    if (!r.ok) { this._refused(io, r.error); this.inboxError = r.error ?? 'server'; this._changed(); return { ok: false, error: this.inboxError }; }
    const list = (Array.isArray(r.data?.reports) ? r.data.reports : []).map(reportInboxHead).filter((h) => h !== null);
    if (held) { const seen = new Set(held.map((p) => p.id)); this.inbox[w] = [...held, ...list.filter((p) => !seen.has(p.id))]; }
    else this.inbox[w] = list;
    this.inboxMore[w] = r.data?.more === true;
    const c = countsOf(r.data);
    if (c) this._takeCounts(c);
    this.inboxError = null;
    this._changed();
    return { ok: true };
  }

  /** OPEN ONE, a reader's: from this sitting's copy, or the service - which marks it read. */
  async open(/** @type {string} */ id) {
    const kept = this.opened.get(id);
    if (kept) return { ok: true, report: kept };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const epoch = this._epoch;
    const r = await reportReadCall(io, id);
    if (this._stale(io, epoch)) return { ok: false, error: 'signed-out' };
    if (!r.ok) { this._refused(io, r.error); return { ok: false, error: r.error ?? 'server' }; }
    const whole = reportWhole(r.data?.report);
    if (!whole || whole.id !== id) return { ok: false, error: 'server' };
    this.opened.set(id, whole);
    const head = this.inbox.open?.find((p) => p.id === id);
    if (head && !head.read) { head.read = true; this._takeCounts({ ...this.counts, unread: Math.max(0, this.counts.unread - 1) }); }
    this._changed();
    return { ok: true, report: whole };
  }

  /** CLOSE ONE as `state` (or open it again, 'open'): the copy kept and both lists looked at again. One close a report at a
   *  time (AUDIT PRIVATE-REPORT UI-8: a second press sent a second close and the lists' looks twice). */
  async close(/** @type {string} */ id, /** @type {string} */ state) {
    if (this.closing.has(id)) return { ok: false, error: 'busy' };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const epoch = this._epoch;
    this.closing.add(id); this._changed();
    try {
      const r = await reportCloseCall(io, id, state);
      if (this._stale(io, epoch)) return { ok: false, error: 'signed-out' };
      if (!r.ok) { this._refused(io, r.error); return { ok: false, error: r.error ?? 'server' }; }
      const kept = this.opened.get(id);
      if (kept) this.opened.set(id, { ...kept, state });
      this._changed();
      await Promise.all([this.loadInbox('open'), this.inbox.closed ? this.loadInbox('closed') : null]);
      return { ok: true, state };
    } finally {
      this.closing.delete(id); this._changed();
    }
  }
}
