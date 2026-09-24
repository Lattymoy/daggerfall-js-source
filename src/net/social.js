// @ts-check
// SOC2 (2026-09-16, Mac: "A social button next to the chat UI, that when tapped opens the new friends list + party
// interface. Players should now be able to friend other users, see if they are online/last online + be able to
// invite friends or other individuals to the new 4 person party system. Party system: Upon joining a party, the
// players name who are in a party together should turn green"): THE CLIENT'S PICTURE - pure, DOM-free.
//
// THE SHAPE. The hub (server/src/index.js, SOC1) is the one authority: it keeps the accounts, the friendships, the
// parties, and it says what it knows in six frames (net/wire.js validSocialFrame - state, presence, party, invite,
// note, error) plus a party member's pose ({t:'party', acct, p}). This module is what a client HOLDS of that: the
// last state frame, kept current by the smaller ones, and the questions the panels ask of it - is this peer in my
// party (green), is this peer a friend, what does the badge count, what does a note say in words. Nothing here
// talks to a socket: the session (net/online.js) hands frames in through `apply` and `applyParty`, and the panels
// send acts through the session's `sendSocial`. So the whole thing is driven with plain objects and no browser
// (test/soc2_session.test.js), which is what lets the awkward cases - a member with two tabs, an invite that lapsed
// while the panel was closed, a note about myself - be written down as pins rather than as hopes.
//
// PEERS, NOT ACCOUNTS, IN THE WORLD. Everything drawn over a body in the world is keyed by PEER id (a tab's), and a
// friend or a party member is an ACCOUNT (a person, with as many tabs as they like). The hub says, on every row, the
// peer ids that account's tabs stand as right now (`peers`), so `partyPeers()` and `friendOfPeer(id)` are the
// bridge: net/remotePlayers.js asks `colorOf(id)` for the name over a body, the F-menu asks `relation` of the peer
// in front of the player. A stranger is neither, and is acted on by peer id alone (the hub resolves it).
//
// THE CLOCK. Every stamp the hub says is the RELAY'S clock (a wall millisecond; the welcome's `now` says how far this
// machine is from it - net/online.js clockOffsetMs). "Last online" is therefore read against the relay's clock as
// this machine sees it: `now()` here is the session's clock plus the offset the host hands in.
//
// Not a DFU member: Daggerfall Unity has no friends, no parties and no online. Ledger A row (ONLINE).
import { NOTE_CODES, INVITE_TTL_MS, PARTY_MAX, PENDING_MAX } from './wire.js';
import { keptToken } from './online.js';
import { appStorage } from '../systems/appStorage.js';   // the app's own storage - localStorage in a browser, the shell's file store on the desktop

/** SOC2 (Mac: "friend other users"): THE ACCOUNT - the id a FRIEND is. A peer id is a tab's (TABS1, net/online.js
 *  peerId) and dies with it, which is exactly wrong for a friend list: a friend is a person, and here a person is a
 *  browser profile. So this one is minted once in the APP'S OWN storage (systems/appStorage.js appStorage - the seam
 *  the saves and the settings use) and kept for the life of the profile; every tab of the profile carries it, so two
 *  tabs are two players (two peers) of ONE account. The same shape as the peer's (the wire's one id law); an `a` first
 *  so a reader tells the two apart. Sent in the HUB'S hello alone (world.js chatStart hands it to the world tab's
 *  link) - never in a presence room's, which keeps no account and is told none (SOC1: the hub is the one place that
 *  can check it). It lives HERE and not beside peerId because TABS1's pin holds net/online.js to the tab's storage
 *  and never the browser-wide one - and that pin is right about the peer. */
/** AUDIT SOC B10: an account is a DURABLE thing. keptToken mints afresh when a storage will not hold the token, which
 *  is right for a TAB's id (a tab is ephemeral anyway) and wrong for an account: every load would be a new permanent
 *  record on the hub - the sweep forgets the unlisted after ACCOUNT_IDLE_MS, but a day's worth of loads stands - and
 *  a friend made would be lost on the next load. So the pair is NULL when the storage will not keep it (read back
 *  after the write), the hello carries no account, and the host says so once (scenes/world.js socialStart). */
const kept = (storage, key, re, mint) => {
  const v = keptToken(storage, key, re, mint);
  let back = null;
  try { back = storage?.getItem?.(key) ?? null; } catch { back = null; }
  return back === v ? v : null;
};
/** The reason `actionsFor` gives for a peer already seated with me - ONE home, read by player/socialPick.js peerRelationText too (AUDIT DROPS: a rewording here used to drop the plaque's 'In your party' line with every pin green). */
export const WHY_IN_PARTY = 'in your party';
export const accountId = (storage = appStorage()) => kept(storage, 'dagger.online.account', /^[A-Za-z0-9_-]{4,40}$/,
  () => 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4));

/** SOC2: the account's secret, minted beside it (AUDIT ONLINE A3's law for the peer, again): the first hello to the hub
 *  mints it there, a later one must match, and a tab that copies the id without it is admitted with no account. */
export const accountSecret = (storage = appStorage()) => kept(storage, 'dagger.online.accountSecret', /^[A-Za-z0-9_-]{8,64}$/,
  () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join(''));

/** The green a party member's name is drawn in over the world (RGBA, the name draw's own units) - "the players name
 *  who are in a party together should turn green". */
export const PARTY_GREEN = Object.freeze([0.45, 1, 0.45, 1]);
/** The same green for the DOM (the chat's lines and roster rows, the panels). */
export const PARTY_GREEN_CSS = '#73ff73';
/** The friend mark's colour for the DOM - a friend who is not in my party (the world draws no friend colour: a friend
 *  is a list, a party is a formation). */
export const FRIEND_CSS = '#8fd0ff';

/**
 * A row as the hub names an account: id, name, whether online, when last seen (the relay's clock, ms; null unknown),
 * the peer ids its tabs stand as.
 * @typedef {{ acct: string, name: string, online: boolean, seen: number|null, peers: string[] }} SocialRow
 * @typedef {SocialRow & { at: number }} PendingRow
 * @typedef {SocialRow & { p: PartyPose|null }} MemberRow
 * @typedef {{ px: number, py: number, in: number, loc: string, h: number, hm: number, f: number, fm: number, m: number, mm: number, race: string, gender: string, face: number }} PartyPose
 * @typedef {{ id: string, leader: string, members: MemberRow[] }} PartyView
 * @typedef {{ party: string, from: { acct: string, name: string }, members: { acct: string, name: string }[], at: number, expires: number, got?: number }} Invite   AUDIT SOC B2: `got` is when it ARRIVED here, on this clock
 * @typedef {{ code: string, acct: string|null, name: string|null }} Note
 */

/** How the state changed, for a listener that wants to know what to repaint: 'state' the whole picture, 'presence' a
 *  friend's row, 'party' the party, 'invite' an invite in, 'pose' a member's pose, 'note', 'error'. */
export class SocialState {
  constructor({ now = () => Date.now(), acct = null } = {}) {
    /** @type {string|null} my account, once the hub has said it */
    this.acct = null;
    /** @type {string[]} AUDIT SOC C20: the peer ids MY OWN tabs stand as, as the hub's picture names them - so a
     *  second tab of mine on the roster is me (`accountOfPeer`, `relation` 'me'), not a stranger to friend or invite */
    this.peers = [];
    this._colors = null;   // AUDIT SOC C23: the colour answers, kept per version
    /** AUDIT SOC B19: the account this session SENT - a state frame naming another is a relay's lie and is refused at
     *  the picture's door (`others()` would otherwise seat me among the others, and `relation` call a stranger me). */
    this.expect = acct;
    /** @type {string|null} my name as the hub holds it */
    this.name = null;
    /** @type {Map<string, SocialRow>} acct -> row, in the hub's order */
    this.friends = new Map();
    /** @type {PendingRow[]} requests TO me */
    this.in = [];
    /** @type {PendingRow[]} requests FROM me */
    this.out = [];
    /** @type {PartyView|null} */
    this.party = null;
    /** @type {Map<string, Invite>} party id -> invite */
    this.invites = new Map();
    /** Bumps on every change a panel would show; a panel repaints on a new number, never per frame (ChatLog's law). */
    this.version = 0;
    /** AUDIT PARTY8: bumps on a member's pose alone - the rows read it in place; `version` no longer moves for one. */
    this.poseVersion = 0;
    /** @type {((note: Note, text: string) => void)|null} a note in, with its words - the chat's system line */
    this.onNote = null;
    /** @type {((text: string) => void)|null} the hub refused one act, in words */
    this.onError = null;
    /** @type {((invite: Invite) => void)|null} an invite in - the toast */
    this.onInvite = null;
    /** @type {((kind: string) => void)|null} anything changed - `kind` names what */
    this.onChange = null;
    /** The last refusal, for a panel that shows it beside the button; null once anything else happens. */
    this.lastError = null;
    this._now = now;
    this._offset = 0;
  }

  /** WORLD5's offset: the relay's clock minus this machine's, so "last online" is read on the relay's clock. */
  setClockOffset(ms) { this._offset = Number.isFinite(ms) ? ms : 0; }
  /** Now, on the relay's clock. */
  now() { return this._now() + this._offset; }

  _changed(kind) { this.version++; this._colors = null; this.onChange?.(kind); }

  /** A hub frame in - one the wire's door already projected (net/online.js hands nothing else in). Returns what changed, or null. */
  apply(f) {
    if (!f || f.t !== 'social') return null;
    switch (f.k) {
      case 'state': {
        if (this.expect && f.acct !== this.expect) return null;   // AUDIT SOC B19: not my picture
        const got = this.now();
        this.acct = f.acct; this.name = f.name; this.peers = Array.isArray(f.peers) ? f.peers.slice() : [];   // a frame from before AUDIT SOC names none
        this.friends = new Map(f.friends.map((r) => [r.acct, r]));
        this.in = f.in.slice(); this.out = f.out.slice();
        this.party = f.party;
        this.invites = new Map(f.invites.slice(0, PENDING_MAX).map((i) => [i.party, { ...i, got }]));
        this.lastError = null;
        this._changed('state');
        return 'state';
      }
      case 'presence': {
        // a friend's row - kept only for a friend (the hub says presence to friends alone; a stale one for someone I
        // have since removed is not a friend back)
        const { t, k, ...row } = f;
        if (!this.friends.has(row.acct)) return null;
        this.friends.set(row.acct, row);
        // and a party member is the same person: the seat's row follows (online, peers) - the pose stays
        if (this.party) for (const m of this.party.members) if (m.acct === row.acct) { m.online = row.online; m.seen = row.seen; m.peers = row.peers; m.name = row.name; }
        this._changed('presence');
        return 'presence';
      }
      case 'party': {
        // the party as the hub has it - the poses I already hold ride over, since a view says the LATEST pose the hub
        // holds and a pose frame in between is newer than a view composed before it only when it is
        if (f.party && this.party && f.party.id === this.party.id) {
          // AUDIT PARTY-REST: ...unless the hub says the seat is OFFLINE - then its last pose is a ghost's, and a gate that
          // counted it ("gather the party") or a mirror that read its stale `rest` acted on someone who is not here
          for (const m of f.party.members) { const was = this.party.members.find((x) => x.acct === m.acct); if (was?.p && !m.p && m.online !== false) m.p = was.p; }
        }
        // AUDIT SOC B16: a view that says what I already hold moves nothing - the version is the panels' repaint clock
        const same = JSON.stringify(f.party) === JSON.stringify(this.party);
        this.party = f.party;
        const spent = !!f.party && this.invites.delete(f.party.id);   // seated: that invite is spent
        if (same && !spent) return null;
        this._changed('party');
        return 'party';
      }
      case 'invite': {
        const { t, k, ...invite } = f;
        if (this.party && this.party.id === invite.party) return null;   // an invite to the party I sit in is nothing
        // AUDIT SOC B1/B2: the door bounds a STATE frame's invites at PENDING_MAX; this arm is one invite at a time, so it
        // is bounded here - the oldest goes when the map is full - and every invite is stamped on ARRIVAL (`got`), on
        // this clock, because `at` and `expires` are the relay's word and a relay that stamps the future hands out an
        // invitation that never lapses
        invite.got = this.now();
        if (!this.invites.has(invite.party) && this.invites.size >= PENDING_MAX) {
          /** @type {[string, Invite]|null} */ let oldest = null;   // a TUPLE, said so: inferred as an array of string|Invite it failed `npm run types` on main (BA-CRASH1 found it in the way)
          for (const [id, inv] of this.invites) if (!oldest || inv.got < oldest[1].got) oldest = [id, inv];
          if (oldest) this.invites.delete(oldest[0]);
        }
        this.invites.set(invite.party, invite);
        this._changed('invite');
        this.onInvite?.(invite);
        return 'invite';
      }
      case 'note': {
        const note = { code: f.code, acct: f.acct, name: f.name };
        // a member whose seat lapsed takes their outstanding invites with them; nothing else in a note moves the picture
        let swept = false;
        if (f.code === 'party.lapsed') for (const [id, inv] of [...this.invites]) if (inv.from.acct === f.acct) { this.invites.delete(id); swept = true; }
        if (swept) this._changed('note');   // AUDIT SOC B16: a note that changed nothing repaints nothing - the chat line is the whole of it
        this.onNote?.(note, noteText(note, this.acct));
        return 'note';
      }
      case 'error': {
        this.lastError = f.m;
        this._changed('error');
        this.onError?.(f.m);
        return 'error';
      }
      default: return null;
    }
  }

  /** A party member's pose in (net/online.js onParty) - onto the seat, if the account holds one. */
  applyParty(acct, p) {
    if (!this.party || !p) return false;
    const m = this.party.members.find((x) => x.acct === acct);
    if (!m) return false;
    const first = !m.p;
    m.p = p;
    // AUDIT PARTY8: a pose that REPLACES one is a quiet change - the panels read the row in place (socialPanel's live
    // pass, partyPanel's own paint) and a version bump rebuilt the open panel's every button under the pointer. The
    // FIRST pose of a seat still repaints: its row has no line to write into yet.
    if (first) this._changed('pose');
    else { this.poseVersion++; this.onChange?.('pose'); }
    return true;
  }

  /** Invites that still stand - the lapsed ones dropped as they are read (the hub drops them on its side the same way):
   *  lapsed when the relay's `expires` has passed OR when INVITE_TTL_MS has passed since it ARRIVED here (`got`, this
   *  clock - AUDIT SOC B2: the relay's stamps alone let a relay hand out an invitation that never lapses). */
  liveInvites() {
    const now = this.now();
    for (const [id, inv] of this.invites) if (now >= inv.expires || now - (inv.got ?? now) >= INVITE_TTL_MS) this.invites.delete(id);
    return [...this.invites.values()];
  }

  /** What the button's badge counts: requests to me and invites standing. */
  pendingCount() { return this.in.length + this.liveInvites().length; }

  /** The party's members other than me, in seat order. */
  others() { return this.party ? this.party.members.filter((m) => m.acct !== this.acct) : []; }
  /** Am I the leader. */
  leads() { return !!this.party && this.party.leader === this.acct; }
  /** Seats left. */
  seatsFree() { return this.party ? Math.max(0, PARTY_MAX - this.party.members.length) : PARTY_MAX - 1; }

  /** The peer ids of my party's other members - the names to draw green. A Set, fresh each call (cheap: at most PARTY_MAX - 1
   *  members, at most ACCOUNT_TABS_MAX peers each). */
  partyPeers() {
    const out = new Set();
    for (const m of this.others()) for (const id of m.peers) out.add(id);
    return out;
  }
  /** Is this peer id one of my party's other members' tabs. */
  isPartyPeer(id) { for (const m of this.others()) if (m.peers.includes(id)) return true; return false; }
  /** The account behind a peer id, if it is a friend's or a party member's tab; null for a stranger (or my own). */
  accountOfPeer(id) {
    if (!id) return null;
    if (this.acct && this.peers.includes(id)) return this.acct;   // AUDIT SOC C20: my own other tab - `relation` says 'me'
    if (this.party) for (const m of this.party.members) if (m.peers.includes(id)) return m.acct;   // my own seat's tabs included: `relation` says 'me' for them
    for (const r of this.friends.values()) if (r.peers.includes(id)) return r.acct;
    for (const r of this.in) if (r.peers.includes(id)) return r.acct;
    for (const r of this.out) if (r.peers.includes(id)) return r.acct;
    return null;
  }
  /** Is this peer a friend's tab. */
  isFriendPeer(id) { const a = this.accountOfPeer(id); return !!a && this.friends.has(a); }
  /** AUDIT SOC C23: the two colour questions are asked per name per FRAME (the world's name pass) and per row per
   *  repaint, and each scanned every list for the id; an answer holds until the picture changes, so they are kept per
   *  version (`_changed` drops them). At most two entries per peer in the room between changes. */
  _colour(id, css) {
    const key = (css ? 'c' : 'w') + id;
    const kept = (this._colors ??= new Map());
    if (kept.has(key)) return kept.get(key);
    const v = css ? (this.isPartyPeer(id) ? PARTY_GREEN_CSS : this.isFriendPeer(id) ? FRIEND_CSS : null) : (this.isPartyPeer(id) ? PARTY_GREEN : null);
    kept.set(key, v);
    return v;
  }
  /** The colour a peer's name is drawn in over the world: PARTY_GREEN for my party, null for everyone else. */
  colorOf(id) { return this._colour(id, false); }
  /** The same question for the DOM (the chat's lines and roster rows): PARTY_GREEN_CSS for my party, FRIEND_CSS for a
   *  friend who is not, null for a stranger - ONE HOME for what a colour means (SOC4's pin holds world.js to asking,
   *  never deciding), so a friend list and a formation can never disagree between the world and the chat. */
  cssColorOf(id) { return this._colour(id, true); }
  /** How an account stands to me: 'me', 'friend', 'in' (they asked), 'out' (I asked), 'none'. */
  relation(acct) {
    if (!acct) return 'none';
    if (acct === this.acct) return 'me';
    if (this.friends.has(acct)) return 'friend';
    if (this.in.some((r) => r.acct === acct)) return 'in';
    if (this.out.some((r) => r.acct === acct)) return 'out';
    return 'none';
  }
  /** Is this account seated in my party. */
  inMyParty(acct) { return !!this.party && this.party.members.some((m) => m.acct === acct); }

  /** The F-menu's and the roster's answer for a PEER in the world: what can be done with them, and why not.
   *  @returns {{ acct: string|null, relation: string, canFriend: boolean, canInvite: boolean, whyNotFriend: string|null, whyNotInvite: string|null }} */
  actionsFor(peerId) {
    const acct = this.accountOfPeer(peerId);
    const relation = this.relation(acct);
    const seated = !!acct && this.inMyParty(acct);
    let whyNotFriend = null, whyNotInvite = null;
    if (relation === 'me') { whyNotFriend = 'that is you'; whyNotInvite = 'that is you'; }
    else if (relation === 'friend') whyNotFriend = 'already friends';
    else if (relation === 'out') whyNotFriend = 'request sent';
    if (!whyNotInvite) {
      if (seated) whyNotInvite = WHY_IN_PARTY;
      else if (this.party && this.seatsFree() === 0) whyNotInvite = 'the party is full';
      // any member may invite - the hub's law, so the leader's seat is no gate here
    }
    return { acct, relation, canFriend: !whyNotFriend, canInvite: !whyNotInvite, whyNotFriend, whyNotInvite };
  }
}

/** "Online", or how long ago, in words a row can carry: "Online", "Last online just now", "... 5 min ago", "... 3 h
 *  ago", "... 2 days ago", "... 3 weeks ago", "Last online long ago" past a year; "Never online" for no stamp. `now`
 *  and `seen` on one clock (the relay's). */
export function lastOnlineText(online, seen, now) {
  if (online) return 'Online';
  if (!Number.isFinite(seen) || seen == null) return 'Never online';
  return `Last online ${agoLadder(now - seen)}`;
}

/** How long `ms` is, as a row says it: "just now", "5 min ago", "3 h ago", "yesterday", "2 days ago", "3 weeks ago",
 *  "long ago" past a year; a negative span (clocks apart) is "just now". AUDIT 68 S14-ago-text-duplicated: the ONE
 *  ladder - the friends list's and the letterbox's (net/mail.js letterAgeText) were two copies of it. */
export function agoLadder(ms) {
  const ago = Math.max(0, ms);
  const min = 60_000, hour = 60 * min, day = 24 * hour, week = 7 * day;
  if (ago < min) return 'just now';
  if (ago < hour) return `${Math.floor(ago / min)} min ago`;
  if (ago < day) return `${Math.floor(ago / hour)} h ago`;
  if (ago < 2 * day) return 'yesterday';
  if (ago < week * 2) return `${Math.floor(ago / day)} days ago`;
  if (ago < 365 * day) return `${Math.floor(ago / week)} weeks ago`;
  return 'long ago';
}

/** The words for a note the hub said as a code (net/wire.js NOTE_CODES) - the relay writes no chat line, this does.
 *  The note's subject is `acct`/`name`; `me` tells "you" from "them". */
export function noteText(note, me = null) {
  const who = note?.name ?? 'Someone';
  const mine = !!note?.acct && note.acct === me;
  switch (note?.code) {
    case 'friend.requested': return `${who} wants to be your friend`;
    case 'friend.accepted': return `${who} accepted your friend request`;
    case 'party.invited': return `Invited ${who} to your party`;
    case 'party.declined': return `${who} declined your party invitation`;
    case 'party.joined': return `${who} joined the party`;
    case 'party.left': return `${who} left the party`;
    case 'party.kicked': return mine ? 'You were removed from the party' : `${who} was removed from the party`;
    case 'party.leader': return mine ? 'You lead the party now' : `${who} leads the party now`;
    case 'party.lapsed': return `${who} dropped from the party`;
    default: return NOTE_CODES.includes(note?.code) ? String(note.code) : '';
  }
}
