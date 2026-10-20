// @ts-check
// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items."): THE SERVER'S POST, AS THIS CLIENT SEES IT - the box the pause face's mailbox draws
// (ui/enhanced/enhancedPost.js), looked at on the letterbox's clock (riding the heartbeat, net/heartbeat.js), a new piece said on
// the world tab, and a piece's item CLAIMED into the online character being played.
//
// THE CLAIM IS THE GUILD VAULT'S TAKE (net/guild/guildBook.js vaultTake): the service writes the item into the realm record
// (server-account/src/post.js claimPost) and answers it; the pack takes it on the answer, through realmGoldAct with
// `needsAnswer` - a claim that landed with its answer lost cannot put the item in the pack, and the checkpoint after it
// would write the record without it. So a lost answer ends the session (`abandon`), and a join reads the record, which
// holds it.
import { call, forgetSession } from './accountClient.js';
import { postHead, postWhole, unclaimedOf, POST_POLL_MS, POST_BOX_MAX } from './postLaw.js';
import { validLootItem } from '../systems/loot/loot.js';
import { ReportDesk } from './privateReport.js';   // PRIVATE-REPORT: the report form's desk, kept on the box for the sitting
import { t } from '../systems/textManager.js';

/** The box: `{ post: [head...], unread, unclaimed, max }`, newest first. */
export const postBoxCall = (io) => call(io, '/v1/post/box');
/** Open one of mine: `{ post: { ...head, body, readAt } }` - and it is read now. */
export const postReadCall = (io, id) => call(io, '/v1/post/read', { id });
/** Claim its item into the realm character `character`, its record standing at `realm`: `{ ok, id, item, realm: { seq } }`. */
export const postClaimCall = (io, { id, character, realm }) => call(io, '/v1/post/claim', { id, character, realm });
/** Throw one away: `{ ok, id }`. */
export const postDeleteCall = (io, id) => call(io, '/v1/post/delete', { id });

/** The world tab's line when a look finds post: who it is from and what about for one, a count for more, and where it
 *  waits - a line nobody spoke (the letterbox's own manner, net/mail.js mailNoticeText). */
export function postNoticeText(event) {
  const where = 'Open the mailbox beside the hourglass in the pause menu, or type /mail.';   // AUDIT SERVER-POST: /mail on either skin - the classic pause has no envelope
  const ps = Array.isArray(event?.post) ? event.post : [];
  // one piece, new or waiting: by name, and its gift by name (AUDIT SERVER-POST: the thirteen's Hourlock lands with the deploy,
  // so their first word of it is a sitting's first look - which said only "1 message waiting")
  const one = (p) => `Post from ${p.from}: "${p.subject}"${p.item && !p.claimed ? `, with ${p.item.name} to claim` : ''}. ${where}`;
  if (event?.kind === 'new') return ps.length === 1 ? one(ps[0]) : `${ps.length} new messages in your mailbox. ${where}`;
  // PRIVATE-REPORT: a reader's private reports - said apart from the post, and never what they say (the world tab is read
  // over a shoulder, on a stream)
  // AUDIT PRIVATE-REPORT CLI-6: `/mail`, never `/bug` - `/bug` lands on the send form, and the inbox is the mailbox's door
  if (event?.kind === 'reports') return t('report.notice', '{n, plural, one {# private report is waiting to be read.} other {# private reports are waiting to be read.}} Type /mail, or open the mailbox beside the hourglass, then click Private reports.', { n: event.unread });
  const n = event?.count ?? 0;
  if (n === 1 && ps.length === 1) return one(ps[0]);
  return `You have ${n} message${n === 1 ? '' : 's'} waiting in your mailbox. ${where}`;
}

/**
 * ONE PLAYER'S SERVER POST, as this client last saw it. `state`: 'unknown' (nobody has looked), 'signed-out', 'guest'
 * (`post-needs-account`), 'ready', 'error'. `version` moves on every change, so the mailbox repaints on a number.
 * `waiting` is what the mailbox's mark counts: pieces unread and items not yet claimed, each piece once.
 */
export class PostBox {
  /**
   * @param {object} o
   * @param {() => ({ fetch: any, base?: string, secret: string, storage?: any } | null)} o.ioOf  the service, now
   * @param {() => number} [o.now]
   * @param {((event: any) => void) | null} [o.onPost]  told when a look finds pieces that were not there before (`new`), and
   *        on a sitting's first look that finds some waiting (`waiting`)
   * @param {() => (string|null)} [o.character]  the character being played - an item is claimed into a realm character alone
   * @param {{ act: (o: any) => Promise<any>, abandon?: (why: string) => void } | null} [o.realm]  its record's act
   *        (systems/realmSaves.js realmGoldAct over the host's session)
   * @param {{ add: (rec: any) => void, changed: () => void } | null} [o.pack]  where a claimed item lands
   */
  constructor({ ioOf, now = () => Date.now(), onPost = null, character = () => null, realm = null, pack = null }) {
    this.ioOf = ioOf;
    this.now = now;
    this.onPost = onPost;
    this.character = character;
    this.realm = realm;
    this.pack = pack;
    this.state = 'unknown';
    /** @type {string|null} */ this.error = null;
    /** @type {any[]} */ this.post = [];
    this.unread = 0;
    this.unclaimed = 0;
    this.max = POST_BOX_MAX;
    /** @type {Map<string, any>} */ this.opened = new Map();
    this.version = 0;
    this.at = 0;
    this.busy = false;
    /** @type {Set<string>|null} */ this._known = null;
    /** @type {Promise<any>|null} */ this._looking = null;
    /** AUDIT SERVER-POST: this sitting's own changes to the box (a piece opened, claimed, thrown away), counted - a look
     *  that set out before one answers the box as it stood before it, and is not taken (a claim's "Waiting" brought back). */
    this._acts = 0;
    this._lookActs = 0;
    /** PRIVATE-REPORT: the report form's desk (net/privateReport.js), for the sitting; and, for a reader of the private
     *  reports alone, the service's count of them (`{ unread, open }`) - null for everyone else. */
    this.desk = new ReportDesk({ ioOf: () => this.ioOf?.() ?? null, onCounts: (c) => this._deskCounts(c) });
    /** AUDIT PRIVATE-REPORT CLI-1: the session the box's state is for. @type {string|null} */ this._secret = null;
    /** @type {{ unread: number, open: number } | null} */ this.reports = null;
  }

  /** What the mailbox's mark counts: a piece unread, or holding an item not yet claimed - each once. PRIVATE-REPORT: and,
   *  for a reader, the private reports nobody has opened. */
  get waiting() { return this.post.filter((p) => !p.read || (p.item && !p.claimed)).length + (this.reports?.unread ?? 0); }

  _changed() { this.version++; }

  _io() {
    const io = this.ioOf?.() ?? null;
    if (!io?.secret) {
      this._secret = null;
      if (this.state !== 'signed-out') { this.state = 'signed-out'; this.post = []; this.unread = 0; this.unclaimed = 0; this.reports = null; this.opened.clear(); this._known = null; this.desk.reset(); this._changed(); }
      return null;
    }
    // AUDIT PRIVATE-REPORT CLI-1: ANOTHER ACCOUNT ON THE SAME SITTING (the pause face's profile signs out and in) - the box
    // is the last account's until it looks, and a reader's count drew the inbox's door for an account that reads nothing:
    // all of it goes, the desk with it, and the next look is due at once
    if (this._secret !== null && io.secret !== this._secret) {
      this.state = 'unknown'; this.post = []; this.unread = 0; this.unclaimed = 0; this.reports = null; this.opened.clear(); this._known = null;
      this.error = null; this.at = 0; this.desk.reset(); this._changed();
    }
    this._secret = io.secret;
    return io;
  }

  /** AUDIT PRIVATE-REPORT CLI-2: THE DESK'S COUNTS ARE THE ENVELOPE'S - a report read or closed is off the count now, not
   *  at the next look three minutes on; and the next look's rise is measured from what this sitting last knew, so a new
   *  report after the only unread one was read is said. A reader's alone: the box holds counts only for a reader. */
  _deskCounts(/** @type {{ unread: number, open: number }} */ c) {
    if (!this.reports) return;
    if (this.reports.unread === c.unread && this.reports.open === c.open) return;
    this.reports = { unread: c.unread, open: c.open };
    this._changed();
  }

  /** A refusal the whole box answers to: `auth` forgets the session, a guest is a guest. True when it was one. */
  _boxRefusal(io, error) {
    if (error === 'auth') { forgetSession(io?.storage); this.state = 'signed-out'; this.post = []; this.unread = 0; this.unclaimed = 0; this.reports = null; this.opened.clear(); this._known = null; this.desk.reset(); this.error = error; this._changed(); return true; }
    if (error === 'post-needs-account') { this.state = 'guest'; this.post = []; this.unread = 0; this.unclaimed = 0; this.reports = null; this.desk.reset(); this.error = error; this._changed(); return true; }
    return false;
  }

  /** LOOK AT THE BOX - one look at a time; a second call while one is out answers with the first. */
  refresh() {
    if (this._looking) return this._looking;
    this._looking = this._refresh().finally(() => { this._looking = null; });
    return this._looking;
  }

  async _refresh() {
    this.at = this.now();   // stamped even with no session (the letterbox's rule): an unstamped look is due again at once
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    this._lookActs = this._acts;
    return this._take(await postBoxCall(io), io, true, io.secret);
  }

  /** What a look does with the box's answer - its own call's, or a heartbeat's `post` part. */
  _take(r, io = this.ioOf?.() ?? null, restamp = true, secret = this._secret) {
    if (restamp) this.at = this.now();
    // AUDIT PRIVATE-REPORT CLI-1: AN ANSWER FOR A SESSION NO LONGER STANDING IS NOBODY'S - another account signed in while it
    // was out: never taken (its post, a reader's count) nor acted on (its `auth` would forget the new session); looked again
    if (secret !== (this.ioOf?.()?.secret ?? null)) { this.at = 0; return { ok: false, error: 'stale' }; }
    if (r?.ok && this._lookActs !== this._acts) { this.at = 0; return { ok: true, stale: true }; }   // set out before a change of this sitting's: looked at again, never taken
    if (!r?.ok) {
      if (!this._boxRefusal(io, r?.error)) { this.state = 'error'; this.error = r?.error ?? 'server'; this._changed(); }
      return { ok: false, error: r?.error };
    }
    const post = (Array.isArray(r.data?.post) ? r.data.post : []).map(postHead).filter((p) => p !== null);
    const first = this._known === null;
    const fresh = first ? [] : post.filter((p) => !p.read && !this._known.has(p.id));
    const waits = post.filter((p) => !p.read || (p.item && !p.claimed));
    this._known = new Set(post.map((p) => p.id));
    const was = JSON.stringify([this.state, this.post, this.error, this.reports]);
    // PRIVATE-REPORT: a reader's count, said on the world tab when it rises (and on a sitting's first look, when any wait)
    const rr = r.data?.reports;
    const reports = rr && Number.isSafeInteger(rr.unread) && Number.isSafeInteger(rr.open) && rr.unread >= 0 && rr.open >= 0 ? { unread: rr.unread, open: rr.open } : null;
    const reportsRose = reports && reports.unread > 0 && (first ? true : reports.unread > (this.reports?.unread ?? 0));
    this.reports = reports;
    if (reports) this.desk.counts = { ...reports };
    this.post = post;
    this.unread = post.filter((p) => !p.read).length;
    this.unclaimed = unclaimedOf(post);
    this.max = Number.isSafeInteger(r.data?.max) ? r.data.max : POST_BOX_MAX;
    this.state = 'ready';
    this.error = null;
    for (const id of [...this.opened.keys()]) if (!this._known.has(id)) this.opened.delete(id);
    if (JSON.stringify([this.state, this.post, this.error, this.reports]) !== was) this._changed();
    if (fresh.length) this.onPost?.({ kind: 'new', post: fresh });
    else if (first && waits.length) this.onPost?.({ kind: 'waiting', count: waits.length, post: waits });
    if (reportsRose) this.onPost?.({ kind: 'reports', unread: reports.unread });
    return { ok: true, fresh };
  }

  /**
   * THE BOX AS A HEARTBEAT'S PART (net/heartbeat.js) - the letterbox's own (net/mail.js MailBox.heartbeatPart): due
   * POST_POLL_MS after the last look, stamped as it sets out, its answer taken as a look's.
   * @returns {import('./heartbeat.js').HeartbeatPart}
   */
  heartbeatPart() {
    const ready = (/** @type {number} */ nowMs, /** @type {number} */ early) => !this._looking && (this.at === 0 || nowMs - this.at >= POST_POLL_MS - early);
    /** @type {((v: any) => void)|null} */
    let settle = null;
    return {
      due: (nowMs) => ready(nowMs, 0),
      soon: (nowMs, early) => ready(nowMs, early),
      every: POST_POLL_MS,
      body: () => {
        this.at = this.now();
        if (!this._io()) return undefined;
        this._lookActs = this._acts;
        this._lookSecret = this._secret;   // AUDIT PRIVATE-REPORT CLI-1: whose look this is
        this._looking = new Promise((r) => { settle = r; });
        return true;
      },
      take: (r) => {
        const done = settle;
        settle = null;
        this._looking = null;
        const out = this._take(r, undefined, false, this._lookSecret);
        done?.(out);
      },
    };
  }

  /** OPEN ONE: the whole piece, from this sitting's copy or the service - which marks it read. */
  async open(id) {
    const kept = this.opened.get(id);
    if (kept) return { ok: true, post: kept };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await postReadCall(io, id);
    if (!r.ok) {
      if (this._boxRefusal(io, r.error)) return { ok: false, error: r.error };
      if (r.error === 'no-post') this._drop(id);
      return { ok: false, error: r.error };
    }
    const whole = postWhole(r.data?.post);
    if (!whole || whole.id !== id) return { ok: false, error: 'server' };
    this.opened.set(id, whole);
    const head = this.post.find((p) => p.id === id);
    if (head && !head.read) { head.read = true; this.unread = Math.max(0, this.unread - 1); this._acts++; }
    this._changed();
    return { ok: true, post: whole };
  }

  /**
   * CLAIM ITS ITEM into the online character being played. The service writes it into the record and answers it; the
   * pack takes it on the answer (checked as every item that arrives over the wire is - systems/loot/loot.js validLootItem).
   * Answers `{ ok, item }` or `{ ok: false, error }`.
   * @param {string} id
   */
  async claim(id) {
    const head = this.post.find((p) => p.id === id);
    if (!head?.item) return { ok: false, error: 'post-no-item' };
    if (head.claimed) return { ok: false, error: 'post-claimed' };
    const character = this.character?.() ?? null;
    if (!this.realm || !this.pack || !character) return { ok: false, error: 'realm-only' };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    if (this.busy) return { ok: false, error: 'busy' };
    this.busy = true; this._changed();
    /** @type {any} */
    let landed = null;
    try {
      const r = await this.realm.act({
        needsAnswer: true,
        apply: (/** @type {any} */ a) => {
          const rec = validLootItem(a?.data?.item);
          let held = false;
          if (rec) {
            try { this.pack?.add(rec); this.pack?.changed(); held = true; landed = rec; } catch (e) { console.warn('[post] a claimed item would not go in the pack', /** @type {any} */ (e)?.message ?? e); }
          }
          if (!held) this.realm?.abandon?.('unknown');   // the record holds what the pack does not: a join reads it
        },
        call: (/** @type {any} */ at) => postClaimCall(io, { id, character, realm: at }),
      });
      if (r?.unknown) return { ok: false, error: 'unknown' };   // the realm never said - the session is given up, and a join reads the record
      if (r?.ok) {
        this._acts++;
        head.claimed = true; head.read = true;
        const kept = this.opened.get(id);
        if (kept) { kept.claimed = true; }
        this.unclaimed = unclaimedOf(this.post);
        this.unread = this.post.filter((p) => !p.read).length;
        return landed ? { ok: true, item: landed } : { ok: false, error: 'unknown' };
      }
      if (this._boxRefusal(io, r?.error)) return { ok: false, error: r.error };
      if (r?.error === 'post-claimed') { head.claimed = true; this.unclaimed = unclaimedOf(this.post); }
      if (r?.error === 'no-post') this._drop(id);
      return { ok: false, error: r?.error ?? 'server' };
    } finally {
      this.busy = false;
      this._changed();
    }
  }

  /** THROW ONE AWAY - never a gift still waiting (the service refuses `post-unclaimed`, and so does this). */
  async remove(id) {
    const head = this.post.find((p) => p.id === id);
    if (head?.item && !head.claimed) return { ok: false, error: 'post-unclaimed' };
    const io = this._io();
    if (!io) return { ok: false, error: 'signed-out' };
    const r = await postDeleteCall(io, id);
    if (!r.ok && this._boxRefusal(io, r.error)) return { ok: false, error: r.error };
    if (r.ok || r.error === 'no-post') { this._drop(id); return { ok: true }; }
    return { ok: false, error: r.error };
  }

  _drop(id) {
    this._acts++;
    const at = this.post.findIndex((p) => p.id === id);
    if (at >= 0) this.post.splice(at, 1);
    this.unread = this.post.filter((p) => !p.read).length;
    this.unclaimed = unclaimedOf(this.post);
    this.opened.delete(id);
    this._known?.delete(id);
    this._changed();
  }
}
