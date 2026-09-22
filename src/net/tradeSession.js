// @ts-check
// TRADE1 (2026-09-21): THE TRADE, AS A STATE MACHINE. Pure - no DOM, no game import: everything the game owns (the pack,
// the item law, the socket) is handed in, so test/trade_session.test.js drives two of these against each other over a
// fake wire and pins the law without a browser.
//
// WHAT A TRADE IS. Two players stand in one room. One asks (`ask`), the other answers (`yes`/`no`). Then each stages an
// OFFER - some items from the pack and some gold - and every change to an offer bumps that side's REVISION `r`. Each
// side LOCKS ("I accept exactly this: your offer at revision o, mine at r"), and only when both are locked on the
// revisions both still hold may each CONFIRM (the second, final press). When both have confirmed, each side hands its
// goods over in a `commit` frame and takes the other's. Any change to either offer unlocks both. That is the whole of
// the anti-scam law: what you confirmed is what you get, by arithmetic.
//
// THE DUPLICATION LAW (the LOOT-DUP lesson, net/hitPend.js - a peer-to-peer item hand-over has already duplicated loot
// once in this codebase). The relay holds no inventory, so no design here can be atomic across two machines; what it
// CAN do is choose which way to fail, and this one fails toward LOSS, never toward DUPLICATION:
//   - nothing leaves a pack until BOTH sides have confirmed (before that a cancel costs nothing);
//   - the goods are RESERVED (taken out of the pack) the moment the commit is decided, and put back ONLY if the commit
//     frame never left the socket (`sent` never fired) - the frame's own fate, as hitPend has it;
//   - once a commit has LEFT, the goods are gone from this pack for good: the peer either applied them or the wire lost
//     them, and restoring them here would be the duplication;
//   - the peer's commit is applied only AFTER mine has left, so a side whose send failed cannot end up holding both
//     parties' goods;
//   - and the goods applied are checked against the offer that was locked: a commit that differs from the offer the
//     receiver confirmed is a forged trade and is refused.
// RANGE (2026-09-21): a trade needs the two BODIES within TRADE_RANGE_M (5 m) of each other - metres in the scene, never a
// map pixel or a relay room. The host measures (`near`); the session refuses to lock or confirm out of range, and the manager ends a live, still-negotiating trade the frame the
// peer steps past it (and tells the peer). Once both have confirmed, the exchange is not a range question.
// The residual failure is a connection dropping in the seconds between the two commits: one side can lose an offer. That
// is stated in the chat, not hidden, and it is the price of having no server-side inventory.

/** How long a frame may wait for the socket (its gate, a reconnect) before the trade is called broken, ms. */
export const OUTBOX_TTL_MS = 6000;
/** How long an ask stands before it is refused, ms: 30 seconds to accept, then it is off until a new one is offered. */
export const ASK_TTL_MS = 30_000;
/** How long a side waits for the other's commit after its own left before it says so, ms. */
export const COMMIT_WAIT_MS = 20_000;
/** The most frames one session holds unsent. */
export const OUTBOX_MAX = 32;

/** HOW NEAR TWO PLAYERS MUST STAND TO TRADE, IN METRES - the world's own unit (scene units are metres: the person reach is
 *  256 * GLOBAL_SCALE = 6.4, a body is 1.8 tall). It is NOT a map pixel and NOT a relay room: a pixel is ~820 m, a cell is
 *  16 of them, and neither says anything about two bodies standing beside each other. Every check below (the F-menu row,
 *  the ask, the accept, the lock, the confirm, and every frame of a live trade that is still being negotiated) measures
 *  the straight line between the two bodies in this one number, from BOTH ends - each side enforces it for itself, so a
 *  client that stops checking cannot keep the other one in a trade. */
export const TRADE_RANGE_M = 5;

/** Is this a scene position - an Array OR a typed array (the player's own `pos` is a Float32Array(3), the peers' feet a plain
 *  Array) with at least three finite numbers? `Array.isArray` alone said "no" to the player's own position, so every trade
 *  read as too far away (snapshot 3's bug). */
/** @param {any} v  an Array or a typed array - the guard below is the type */
const isPos = (v) => (Array.isArray(v) || ArrayBuffer.isView(v)) && /** @type {ArrayLike<number>} */ (v).length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);

/** The straight-line distance between two scene positions [x, y, z], in metres; Infinity when either is not a position
 *  (an unknown place is never "near"). */
export function tradeDistance(a, b) {
  if (!isPos(a) || !isPos(b)) return Infinity;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Are two scene positions within `max` metres of each other (inclusive)? NaN and a missing position are never near. */
export function inTradeRange(a, b, max = TRADE_RANGE_M) { return tradeDistance(a, b) <= max; }

/** The words for why a trade ended, from the wire's TRADE_WHY codes. */
export function tradeWhyText(why, name = 'They') {
  switch (why) {
    case 'declined': return `${name} declined the trade`;
    case 'left': return `${name} went away - the trade is off`;
    case 'busy': return `${name} is already trading`;
    case 'timeout': return 'The trade timed out';
    case 'range': return `You are more than ${TRADE_RANGE_M} m apart - the trade is off`;
    case 'refused': return `${name}'s offer was not valid - the trade is off`;
    default: return `${name} cancelled the trade`;
  }
}

/** Stable JSON (sorted keys) so two records that mean the same thing compare equal whatever key order a client wrote. */
export function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

/**
 * One trade between me and one peer.
 *
 * `pack` is the game's side of the counter (net/tradeSession.js never touches an item):
 *   offerable(item)        -> null, or the reason this item may not be traded (worn, quest, summoned ...)
 *   wire(entries)          -> the offer's records as they go on the wire ([{item,count}] -> [record]), or null
 *   unwire(records)        -> the peer's records as MY game would mint them (validLootList), or null when any is no item
 *   take(entries, gold)    -> a handle once the goods are OUT of the pack (reserved), or null when they are not all there
 *   restore(handle)        -> put a reserved lot back exactly
 *   give(items, gold)      -> add a received lot to the pack
 *   fits(items, gold, mineEntries, mineGold) -> can this pack carry the peer's lot once my own offer has left it
 *   gold()                 -> the gold I hold
 */
export class TradeSession {
  /**
   * @param {object} o
   * @param {string} o.sid
   * @param {string|null} o.me
   * @param {string} o.peer
   * @param {string} [o.peerName]
   * @param {boolean} [o.initiator]
   * @param {any} o.pack
   * @param {(data: any) => boolean} o.send
   * @param {() => number} [o.now]
   * @param {(text: string) => void} [o.say]
   * @param {() => void} [o.onChange]  called with nothing: the window re-reads the session it holds
   * @param {(s: TradeSession) => void} [o.onEnd]
   * @param {() => boolean|null} [o.near]
   */
  constructor({ sid, me, peer, peerName = 'Someone', initiator = false, pack, send, now = () => Date.now(), say = () => {}, onChange = () => {}, onEnd = () => {}, near = () => true }) {
    this.sid = sid; this.me = me; this.peer = peer; this.peerName = peerName; this.initiator = initiator;
    this.pack = pack; this._send = send; this._now = now; this._say = say; this._changed = onChange; this._ended = onEnd;
    this._near = near;          // () => boolean: is the peer within TRADE_RANGE_M of me right now (the host measures; an unknown place is false)
    /** 'open' (negotiating) | 'committing' (goods reserved/sent) | 'done' | 'cancelled' */
    this.phase = 'open';
    this.mine = { entries: [], gold: 0 }; this._mineWire = [];
    this.rev = 0;
    this.theirs = { items: [], gold: 0 }; this._theirRaw = []; this.theirRev = 0;
    this.myLock = false; this.theirLock = false; this.myConfirm = false; this.theirConfirm = false;
    this._outbox = [];
    this._handle = null;        // my reserved goods
    this._sentCommit = false;   // my commit LEFT the socket
    this._pendingIn = null;     // their commit, held until mine has left
    this._applied = false;
    this._committedAt = 0;
    this._waitSaid = false;
    this.lastMessage = '';      // the last thing the window should say, for its footer
  }

  // ---- reading ----------------------------------------------------------------------------------------------------
  get bothLocked() { return this.myLock && this.theirLock; }
  get isOpen() { return this.phase === 'open'; }
  get isOver() { return this.phase === 'done' || this.phase === 'cancelled'; }
  /** Is anything at all on the table? An empty-for-empty trade cannot be locked. */
  get hasContent() { return this.mine.entries.length > 0 || this.mine.gold > 0 || this.theirs.items.length > 0 || this.theirs.gold > 0; }
  /** Items of mine staged in the offer (the window hides them from my pack column). */
  stagedItems() { return this.mine.entries.map((e) => e.item); }

  // ---- my actions -------------------------------------------------------------------------------------------------
  /** Replace my offer. `entries` are `{item, count}` over my LIVE pack; every change unlocks both sides. Returns
   *  `{ ok, why }` - a refusal leaves the offer exactly as it was. */
  setOffer(entries, gold = 0) {
    if (this.phase !== 'open') return { ok: false, why: 'The trade is over.' };
    const list = Array.isArray(entries) ? entries : [];
    const g = Math.floor(Number(gold));
    if (!Number.isFinite(g) || g < 0) return { ok: false, why: 'That is not an amount of gold.' };
    if (g > this.pack.gold()) return { ok: false, why: 'You do not have that much gold.' };
    const seen = new Set(), clean = [];
    for (const e of list) {
      const item = e?.item;
      const count = Math.floor(Number(e?.count ?? 1));
      if (!item || seen.has(item)) return { ok: false, why: 'That item is already offered.' };
      const no = this.pack.offerable(item);
      if (no) return { ok: false, why: no };
      const have = Math.max(1, item.stackCount ?? 1);
      if (!(count >= 1) || count > have) return { ok: false, why: 'You do not have that many.' };
      seen.add(item); clean.push({ item, count });
    }
    let wired;
    if (clean.length) {
      wired = this.pack.wire(clean);
      if (!wired) return { ok: false, why: 'That cannot be traded.' };
    } else wired = [];
    this.mine = { entries: clean, gold: g }; this._mineWire = wired;
    this.rev++;
    this._unlockBoth();
    // an unsent offer/lock/confirm is superseded by this one - the wire carries the newest, not the history
    this._outbox = this._outbox.filter((f) => f.sent || !['offer', 'lock', 'confirm'].includes(f.data.k));
    this._enqueue({ k: 'offer', r: this.rev, items: wired, g });
    this._changed();
    return { ok: true };
  }

  /** "I accept exactly this." Refused when the table is empty, or when this pack cannot carry what the peer offers. */
  lock() {
    if (this.phase !== 'open' || this.myLock) return { ok: false };
    if (!this.hasContent) return { ok: false, why: 'Nothing is being traded.' };
    if (!this._near()) return { ok: false, why: `You must stay within ${TRADE_RANGE_M} m of ${this.peerName} to trade.` };
    if (!this.pack.fits(this.theirs.items, this.theirs.gold, this.mine.entries, this.mine.gold)) return { ok: false, why: 'You cannot carry that much.' };
    this.myLock = true;
    this._enqueue({ k: 'lock', r: this.rev, o: this.theirRev, l: 1 });
    this._changed();
    return { ok: true };
  }

  unlock() {
    if (this.phase !== 'open' || !this.myLock || this.myConfirm) return { ok: false };
    this.myLock = false; this.theirConfirm = false;
    this._enqueue({ k: 'lock', r: this.rev, o: this.theirRev, l: 0 });
    this._changed();
    return { ok: true };
  }

  /** The final press, allowed only with both sides locked. The commit follows at once when the peer has confirmed too. */
  confirm() {
    if (this.phase !== 'open' || !this.bothLocked || this.myConfirm) return { ok: false };
    if (!this._near()) return { ok: false, why: `You must stay within ${TRADE_RANGE_M} m of ${this.peerName} to trade.` };
    this.myConfirm = true;
    this._enqueue({ k: 'confirm', r: this.rev, o: this.theirRev });
    this._maybeCommit();
    this._changed();
    return { ok: true };
  }

  /** End it. Free while negotiating; impossible once the goods are in flight (the answer says so). */
  cancel(why = 'cancelled') {
    if (this.phase !== 'open') return { ok: false, why: this.phase === 'committing' ? 'The goods are already changing hands.' : undefined };
    this._trySendOnce({ k: 'cancel', why });
    // the player's own cancel is said by the window closing; every other reason is a line in the chat
    this._finish('cancelled', why === 'cancelled' ? 'You cancelled the trade.' : tradeWhyText(why, this.peerName), { silent: why === 'cancelled' });
    return { ok: true };
  }

  /** The host's word that the peer has left the room or walked out of reach. */
  peerGone(why = 'left') {
    if (this.phase === 'open') this._finish('cancelled', tradeWhyText(why, this.peerName));
  }

  // ---- the peer's frames ------------------------------------------------------------------------------------------
  receive(d) {
    if (this.isOver || d.s !== this.sid) return;
    switch (d.k) {
      case 'offer': return this._onOffer(d);
      case 'lock': return this._onLock(d);
      case 'confirm': return this._onConfirm(d);
      case 'commit': return this._onCommit(d);
      case 'cancel':
        if (this.phase === 'open') this._finish('cancelled', tradeWhyText(d.why ?? 'cancelled', this.peerName));
        return;
      default: return;
    }
  }

  _onOffer(d) {
    if (this.phase !== 'open' || d.r <= this.theirRev) return;   // stale or replayed
    const items = d.items.length ? this.pack.unwire(d.items) : [];
    if (!items) { this.cancel('refused'); return; }
    this.theirs = { items, gold: d.g }; this._theirRaw = d.items; this.theirRev = d.r;
    this._unlockBoth();
    this._changed();
  }

  _onLock(d) {
    if (this.phase !== 'open' || d.r !== this.theirRev || d.o !== this.rev) return;   // a lock on an offer that has since changed is nothing
    this.theirLock = d.l === 1;
    if (!this.theirLock) { this.theirConfirm = false; this.myConfirm = false; }
    this._changed();
  }

  _onConfirm(d) {
    if (this.phase !== 'open' || !this.bothLocked || d.r !== this.theirRev || d.o !== this.rev) return;
    this.theirConfirm = true;
    this._maybeCommit();
    this._changed();
  }

  _onCommit(d) {
    // a commit is only ever sent by a side that has seen both confirms, on the revisions both hold
    if (this.phase === 'open' && !(this.myConfirm && this.theirConfirm)) { this.cancel('refused'); return; }
    if (this._pendingIn || this._applied) return;
    if (d.r !== this.theirRev || d.o !== this.rev || d.g !== this.theirs.gold || canon(d.items) !== canon(this._theirRaw)) {
      // the goods are not the offer that was locked: a forged commit. Nothing of mine has moved if I have not committed.
      if (this.phase === 'open') { this.cancel('refused'); return; }
      this._say(`${this.peerName}'s goods were not what was offered - they were refused.`);
      this._finish('done', null); return;
    }
    this._pendingIn = d;
    this._maybeApply();
  }

  // ---- the commit -------------------------------------------------------------------------------------------------
  _maybeCommit() {
    if (this.phase !== 'open' || !(this.myConfirm && this.theirConfirm && this.bothLocked)) return;
    // NO RANGE CHECK HERE, ON PURPOSE. Range is asked of every PRESS (lock, confirm) and every FRAME while negotiating, where
    // refusing is free. At this line the peer may already have committed (their goods are OUT of their pack): a refusal
    // here because my measurement said 5.02 m where theirs said 4.98 m would strand their goods - range would have turned
    // into a loss. Both confirms were given in range; the exchange that follows them is not a range question.
    const handle = this.pack.take(this.mine.entries, this.mine.gold);
    if (!handle) { this.cancel('refused'); this._say('Your goods changed - the trade is off.'); return; }
    this._handle = handle;
    this.phase = 'committing';
    this._committedAt = this._now();
    this._enqueue({ k: 'commit', r: this.rev, o: this.theirRev, items: this._mineWire, g: this.mine.gold }, {
      sent: () => { this._sentCommit = true; this._maybeApply(); this._changed(); },
      // the frame never left: the goods come back, and only now - the fate hitPend's law names
      dropped: () => {
        if (this._sentCommit || !this._handle) return;
        this.pack.restore(this._handle); this._handle = null;
        this._finish('cancelled', 'The connection failed before the goods were sent - nothing was traded.');
      },
    });
  }

  _maybeApply() {
    if (this.phase !== 'committing' || !this._sentCommit || !this._pendingIn || this._applied) return;
    const d = this._pendingIn; this._pendingIn = null;
    const items = d.items.length ? this.pack.unwire(d.items) : [];
    if (!items) { this._say(`${this.peerName}'s goods were not valid - they were refused.`); this._finish('done', null); return; }
    this._applied = true;
    this.pack.give(items, d.g);
    this._finish('done', `Trade with ${this.peerName} complete.`);
  }

  // ---- the wire ---------------------------------------------------------------------------------------------------
  _enqueue(data, fate = null) {
    if (this._outbox.length >= OUTBOX_MAX) { this._outbox.shift(); }
    this._outbox.push({ data: { ...data, to: this.peer, s: this.sid }, at: this._now(), fate, sent: false });
    this._flush();
  }

  /** One best-effort frame, never queued (a cancel is no reason to hold the door). */
  _trySendOnce(data) { try { this._send({ ...data, to: this.peer, s: this.sid }); } catch { /* the session is over either way */ } }

  _flush() {
    const now = this._now();
    while (this._outbox.length) {
      const f = this._outbox[0];
      if (now - f.at > OUTBOX_TTL_MS) {
        // the socket never took it: this frame's story ends as DROPPED, and so does everything behind it
        for (const g of this._outbox.splice(0)) { g.fate?.dropped?.(); }
        if (this.phase === 'open') this._finish('cancelled', tradeWhyText('timeout'));
        return;
      }
      let ok = false;
      try { ok = this._send(f.data) === true; } catch { ok = false; }
      if (!ok) return;   // the gate is spent or the socket is away - it waits for the next tick
      this._outbox.shift(); f.sent = true; f.fate?.sent?.();
    }
  }

  /** The host's frame: retry what is waiting, and say when a commit is slow. */
  tick() {
    if (this.isOver) return;
    this._flush();
    if (this.phase === 'committing' && this._sentCommit && !this._applied) {
      const waited = this._now() - this._committedAt;
      if (waited > COMMIT_WAIT_MS && !this._waitSaid) { this._waitSaid = true; this._say(`Still waiting for ${this.peerName}'s goods...`); }
      if (waited > COMMIT_WAIT_MS * 3) this._finish('done', `${this.peerName}'s goods never arrived - the trade may not have completed.`);
    }
  }

  // ---- internals --------------------------------------------------------------------------------------------------
  _unlockBoth() { this.myLock = this.theirLock = this.myConfirm = this.theirConfirm = false; }

  _finish(phase, text, { silent = false } = {}) {
    if (this.isOver) return;
    this.phase = phase;
    this._outbox = this._outbox.filter((f) => f.data.k === 'cancel');
    if (text && !silent) this._say(text); else if (text) this.lastMessage = text;
    if (text) this.lastMessage = text;
    this._changed();
    this._ended(this);
  }
}

/**
 * The trades a player has going: at most ONE live session, plus asks in and out. Asks are the F-menu's business - a
 * peer asks, the other presses F on them and the row reads "Accept trade" - so no new panel exists to stand under a
 * window. `send(data)` is online.sendTrade; `open(session)` is the host putting the window up.
 * `near(peerId)` is the host's measurement of TRADE_RANGE_M (metres between the two bodies; false for a peer it cannot
 * place): no ask, accept or answer happens out of range, and a live trade ends the frame the peer steps past it.
 */
/**
 * @param {object} o
 * @param {(data: any) => boolean} o.send
 * @param {any} o.pack
 * @param {() => number} [o.now]
 * @param {(text: string) => void} [o.say]
 * @param {(id: string) => string|null} [o.peerName]
 * @param {(s: TradeSession) => void} [o.open]
 * @param {(s: TradeSession) => void} [o.close]
 * @param {(() => string)|undefined} [o.mintSid]
 * @param {() => number} [o.rand]
 * @param {() => string} [o.selfId]
 * @param {(peer: string) => boolean|null} [o.near]
 */
export function createTradeManager({ send, pack, now = () => Date.now(), say = () => {}, peerName = () => null, open = () => {}, close = () => {}, mintSid, rand = Math.random, selfId = () => '', near = () => true }) {
  let session = null;
  let outgoing = null;                 // { peer, s, at }
  const incoming = new Map();          // peerId -> { s, at }
  const nameOf = (id) => peerName(id) ?? 'Someone';
  const FAR_TEXT = `too far away (max ${TRADE_RANGE_M} m)`;
  const mint = mintSid ?? (() => { let s = ''; while (s.length < 10) s += rand().toString(36).slice(2); return s.slice(0, 10).padEnd(10, '0'); });

  const begin = (peer, sid, initiator) => {
    session = new TradeSession({
      sid, me: null, peer, peerName: nameOf(peer), initiator, pack, send, now, say, near: () => near(peer) === true,
      onChange: () => mgr.onChange?.(session),
      onEnd: (s) => { if (session === s) { mgr.onChange?.(s); close(s); } },
    });
    open(session);
    return session;
  };

  const mgr = {
    onChange: null,
    get session() { return session && !session.isOver ? session : null; },
    /** What the F-menu should say about a peer: 'none' | 'incoming' | 'outgoing' | 'active' | 'busy'. */
    stateFor(peer) {
      if (session && !session.isOver) return session.peer === peer ? 'active' : 'busy';
      if (incoming.has(peer)) return 'incoming';
      if (outgoing?.peer === peer) return 'outgoing';
      return outgoing ? 'busy' : 'none';
    },
    /** Ask `peer` to trade. */
    request(peer) {
      const st = mgr.stateFor(peer);
      if (st === 'incoming') return mgr.accept(peer);
      if (st !== 'none') return { ok: false, why: st === 'outgoing' ? 'request sent' : st === 'active' ? 'already trading' : 'you are trading' };
      if (near(peer) !== true) return { ok: false, why: FAR_TEXT };
      const s = mint();
      if (!send({ k: 'ask', to: peer, s })) return { ok: false, why: 'try again' };
      outgoing = { peer, s, at: now() };
      say(`You offered to trade with ${nameOf(peer)}.`);
      return { ok: true };
    },
    accept(peer) {
      const a = incoming.get(peer);
      if (!a || (session && !session.isOver)) return { ok: false, why: 'gone' };
      if (near(peer) !== true) return { ok: false, why: FAR_TEXT };
      if (!send({ k: 'yes', to: peer, s: a.s })) return { ok: false, why: 'try again' };
      // taking THIS ask up takes my own pending ask to someone else back - and says so, or they could accept it later
      // and be left in a window nobody answers
      if (outgoing) send({ k: 'cancel', to: outgoing.peer, s: outgoing.s });
      incoming.delete(peer); outgoing = null;
      begin(peer, a.s, false);
      return { ok: true };
    },
    decline(peer) {
      const a = incoming.get(peer);
      if (!a) return { ok: false };
      incoming.delete(peer);
      send({ k: 'no', to: peer, s: a.s });
      return { ok: true };
    },
    /** A frame from `from`, already projected and addressed to me. */
    onFrame(from, d) {
      const live = session && !session.isOver ? session : null;
      switch (d.k) {
        case 'ask': {
          if (live) { send({ k: 'no', to: from, s: d.s }); return; }
          // an ask from further than TRADE_RANGE_M is answered with the reason and never stood in the list: nobody across
          // the street (or the cell) gets a line into this chat, and the asker's own client learns why at once
          if (near(from) !== true) { send({ k: 'cancel', to: from, s: d.s, why: 'range' }); return; }
          if (outgoing?.peer === from) {
            // crossed asks: the smaller id keeps its own ask, the other takes it up - one trade, not two
            if (from < selfId()) { outgoing = null; incoming.set(from, { s: d.s, at: now() }); mgr.accept(from); }
            return;
          }
          if (incoming.size >= 4 && !incoming.has(from)) return;
          const fresh = !incoming.has(from);   // a repeated ask renews the timer and says nothing - a peer cannot fill your chat with it
          incoming.set(from, { s: d.s, at: now() });
          if (fresh) say(`${nameOf(from)} wants to trade - press F on them to accept.`);
          mgr.onChange?.(null);
          return;
        }
        case 'yes':
          if (outgoing && outgoing.peer === from && outgoing.s === d.s && !live) { const s = outgoing.s; outgoing = null; begin(from, s, true); return; }
          if (live && live.peer === from && live.sid === d.s) return;   // this trade's own yes, twice
          // a yes to an ask that is no longer mine (I am trading with someone else, or it timed out): the accepter has
          // already opened a window - tell them, so it closes instead of standing open with nobody on the other side
          send({ k: 'cancel', to: from, s: d.s, why: live ? 'busy' : 'timeout' });
          return;
        case 'no':
          if (outgoing && outgoing.peer === from && outgoing.s === d.s) { outgoing = null; say(tradeWhyText('declined', nameOf(from))); }
          return;
        case 'cancel':
          if (live && from === live.peer) { live.receive(d); return; }
          // outside a session a cancel names an ASK: mine that they will not take (out of range), or theirs they took back
          if (outgoing && outgoing.peer === from && outgoing.s === d.s) { outgoing = null; say(tradeWhyText(d.why ?? 'cancelled', nameOf(from))); }
          else if (incoming.get(from)?.s === d.s) { incoming.delete(from); if (d.why === 'timeout') say(`${nameOf(from)}'s trade offer expired.`); mgr.onChange?.(null); }
          return;
        default:
          if (live && from === live.peer) live.receive(d);
      }
    },
    /** The host's frame. */
    tick() {
      const t = now();
      // NOT ACCEPTED IN ASK_TTL_MS: the offer is refused - on the asker's side at once, and the other side is TOLD, so the
      // "Accept trade" row goes away with it instead of opening a window nobody will answer. A new offer starts a new 30 s.
      if (outgoing && t - outgoing.at > ASK_TTL_MS) {
        const o = outgoing; outgoing = null;
        send({ k: 'cancel', to: o.peer, s: o.s, why: 'timeout' });
        say(`${nameOf(o.peer)} did not accept within ${ASK_TTL_MS / 1000} seconds - the trade offer is off.`);
        mgr.onChange?.(null);
      }
      for (const [p, a] of incoming) if (t - a.at > ASK_TTL_MS) { incoming.delete(p); say(`${nameOf(p)}'s trade offer expired.`); mgr.onChange?.(null); }
      // a live, still-negotiating trade ends for free the frame the peer is past TRADE_RANGE_M - and the peer is told, so
      // a client that measured 4.98 m where this one measured 5.02 m does not sit in a window nobody can finish. A trade
      // whose goods are already changing hands is not this rule's to end (cancel answers { ok:false } in that phase).
      if (session && session.phase === 'open' && near(session.peer) !== true) session.cancel('range');
      session?.tick();
    },
    /** A peer left the room (or is no longer reachable). Range is `near`'s and ends a trade in tick(). */
    peerGone(peer, why = 'left') {
      incoming.delete(peer);
      if (outgoing?.peer === peer) outgoing = null;
      if (session && !session.isOver && session.peer === peer) session.peerGone(why);
    },
    /** The player left the game or the room: end everything that can be ended for free. */
    reset() { if (session && !session.isOver) session.cancel('cancelled'); incoming.clear(); outgoing = null; },
  };
  return mgr;
}
