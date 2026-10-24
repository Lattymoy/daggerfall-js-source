// @ts-check
// CROWN1 part two, the client (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): A ROYAL TOURNEY AS THIS
// CLIENT FIGHTS IT (bible/11-Multiplayer/Seats-Arc.md 7.6) - entered from a crown's Seat tab while its Edict rules: the
// ring's centre this game derived from the town (systems/siegeField.js royalRingWire, the crown's Palace square) sent for
// a pass (the service settles the ring once two contenders' agree - until then it asks again), then the tourney's own
// room joined (`royal:<key>:<week>`, a fresh pass on every hello - net/online.js mintSiegePass), `in` said once a socket
// is open; the room's words folded and drawn (net/royalLink.js, ui/siegeHud.js). A challenge is the profile card's own
// Challenge button: on a contender who has challenged this player it accepts (`yes`), else it challenges (`ask`). In a
// bout, the one opponent is the foe a melee swing reaches (the relay referees it); a mark or a step pulled back moves
// the player; a bout won hands this player a `t1` receipt, kept and carried to the service (net/siege/siegeClaims.js
// createRoyalClaims). Left at the week's end or by the player - the world's own room is joined again.
//
// The world is handed in, so the pins drive it with fakes. Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
//
// AUDIT-SEATS (2026-10-01): C1 - the tourney is LEFT as a siege is (net/siege/siegeSession.js): by the player (the HUD's Leave,
// the chat's `/leave`), once away from the crown's city BATTLE_AWAY_MS, when its socket closes for good, and at the
// week's end - a player who pressed "Watch the Royal Tourney" on a Monday no longer stands in its room all week, the
// city's peers and its Watch gone; the HUD drawn only in its room. C2 - the one mint slot cleared only while it is this
// session's own. C3 - an unsettled ring said once and asked again on the siege's backing-off wait.
import { royalRoomKey, ROYAL_RING } from './siege/siegeRef.js';
import { foldRoyal, royalHudModel, royalAskStands, ROYAL_STATE_EMPTY } from './royalLink.js';
import { readRoyalReceipt } from './siege/siegeReceipt.js';
import { passRetryMs, BATTLE_AWAY_MS } from './siege/siegeSession.js';

/** How long an unsettled ring waits before the pass is asked again, ms - the first wait (AUDIT-SEATS C3: doubling to
 *  siegeSession.js PASS_RETRY_MAX_MS). */
export const ROYAL_PASS_RETRY_MS = 5000;
/** The words. */
export const ROYAL_SESSION_TEXT = Object.freeze({
  notHere: (town) => `Go to ${town} to enter the Royal Tourney. Its ring stands before the castle.`,
  old: 'The server does not keep Royal Tourneys yet.',
  entered: (side) => (side === 'watch' ? 'You are watching the Royal Tourney as a spectator.' : 'You have entered the Royal Tourney. Challenge a contender from their card.'),
  left: 'You have left the Royal Tourney.',
  refused: (why) => `The Royal Tourney would not have you: ${why}`,
  asked: (who) => `${who} challenges you to a bout. Challenge them back from their card to accept.`,
  sent: (who) => `You challenge ${who} to a bout.`,
  away: (city) => `You have left ${city}, and the Royal Tourney with it.`,   // AUDIT-SEATS C1
  closed: 'The connection to the Royal Tourney closed. You have left it.',   // AUDIT-SEATS C1: its socket closed for good
});

/**
 * THE SESSION. `online` (net/online.js), `pass(seat, field, watch)` and the bouts' `claims` (net/siege/siegeClaims.js
 * createRoyalClaims, or null), `hud` (ui/siegeHud.js createSiegeHud, or null), `nowMs()` (AUDIT-SEATS C6: the relay's
 * clock), `movePlayer(pose)` (a wire pose), `say(text)`, `relayOk()` the relay keeps Royal Tourneys, `name(id)` a peer's
 * name; AUDIT-SEATS C1: `here(seat)` whether the player is still at the crown's city.
 * @param {{ online: any, pass: (seat: any, field: any, watch: boolean) => Promise<any>, claims?: any, hud?: any, nowMs?: () => number,
 *   movePlayer?: (p: any) => void, say?: (t: string) => void, relayOk?: () => boolean, name?: (id: string) => string, here?: (seat: any) => boolean }} deps
 */
export function createRoyalSession({ online, pass, claims = null, hud = null, nowMs = () => Date.now(), movePlayer = () => {}, say = () => {}, relayOk = () => true, name = () => '', here = () => true }) {
  /** @type {null | { seat: any, royal: any, field: any, watch: boolean, room: string, side: string, ends: number, sentIn: boolean, state: any, retryAt: number, joined: boolean, tries: number, mint: any, awayAt: number|null }} */
  let s = null;
  async function ask() {
    if (!s) return;
    const at = s;
    const r = await pass(s.seat, s.field, s.watch);
    if (s !== at) return;   // AUDIT-SEATS C1: left, or entered afresh, while it was asked
    if (!r?.ok) {
      // AUDIT-SEATS C3: said once, asked again on a backing-off wait
      if (r?.error === 'ring-unsettled') { s.tries++; s.retryAt = nowMs() + passRetryMs(s.tries, ROYAL_PASS_RETRY_MS); if (s.tries === 1) say(r.text); return; }
      say(ROYAL_SESSION_TEXT.refused(r?.text ?? 'it is not open'));
      api.leave({ quiet: true });
      return;
    }
    s.side = r.side; s.ends = Number(r.endsAt) * 1000;
    s.room = royalRoomKey(s.seat.key, r.week);
    // AUDIT-SEATS C2: this session's own mint, kept, so a leave clears the slot only while it is still this one's
    s.mint = async () => { const again = await pass(at.seat, at.field, at.watch); return again?.ok ? again.pass : null; };
    online.mintSiegePass = s.mint;
    s.joined = true;
    say(ROYAL_SESSION_TEXT.entered(r.side));
  }
  /** The bout this player fights, its countdown run - or null. */
  const fighting = (now) => {
    const b = s?.state.bout;
    return b && now >= b.s && now < b.e && (b.a === online.id || b.b === online.id) ? b : null;
  };
  const api = {
    /** The room the world must stand in while the tourney is entered, else null. */
    room: () => (s?.joined ? s.room : null),
    active: () => !!s,
    side: () => s?.side ?? null,
    /** Enter `seat`'s Royal Tourney - `royal` the Seat tab's (its prize and window), `field` the ring's centre this game
     *  derived (null: the player is not in the city), `watch` to spectate. */
    enter(seat, royal, field, { watch = false } = {}) {
      if (!relayOk()) { say(ROYAL_SESSION_TEXT.old); return false; }
      if (!field) { say(ROYAL_SESSION_TEXT.notHere(seat?.name ?? 'the city')); return false; }
      if (s?.mint && online.mintSiegePass === s.mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: entered afresh - the old pass's mint goes
      s = { seat, royal, field, watch: !!watch, room: '', side: 'watch', ends: 0, sentIn: false, state: ROYAL_STATE_EMPTY, retryAt: 0, joined: false, tries: 0, mint: null, awayAt: null };
      ask();
      return true;
    },
    /** Leave it (`quiet`: no word; `words` another word than the plain one). AUDIT-SEATS C1: true when there was a
     *  tourney to leave. @param {{ quiet?: boolean, words?: string }} [o] */
    leave({ quiet = false, words = ROYAL_SESSION_TEXT.left } = {}) {
      if (!s) return false;
      const mint = s.mint;
      s = null;
      if (mint && online.mintSiegePass === mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: another battle's mint is not this one's to clear
      hud?.hide();
      if (!quiet) say(words);
      return true;
    },
    /** A word from the tourney's room (net/online.js onSiege). */
    onSiege(g, room) {
      if (!s || room !== s.room) return;
      s.state = foldRoyal(s.state, g, nowMs());
      if (g.k === 'back') movePlayer(g.p);
      if (g.k === 'no') say(g.m);
      if (g.k === 'ask') say(ROYAL_SESSION_TEXT.asked(name(g.id) || 'A contender'));
      if (g.k === 'won' && readRoyalReceipt(g.rc) && claims) { claims.keep(g.rc); claims.offer({ force: true }); }
    },
    /** THE PROFILE CARD'S CHALLENGE on `peer` while entered: an accept where that contender's challenge at this player
     *  stands, else a challenge. True when it left (a spectator challenges no one). */
    challenge(peer) {
      if (!s?.joined || s.side === 'watch' || !peer || peer === online.id) return false;
      if (royalAskStands(s.state, peer, nowMs())) return online.sendSiege({ k: 'yes', to: peer });
      const sent = online.sendSiege({ k: 'ask', to: peer });
      if (sent) say(ROYAL_SESSION_TEXT.sent(name(peer) || 'them'));
      return sent;
    },
    /** Each frame: the pass asked again while the ring settles, `in` said once on an open socket, the HUD drawn, the
     *  tourney left at its week's end. AUDIT-SEATS C1: and left once the player has been away from the city
     *  BATTLE_AWAY_MS, or its socket has closed for good; the HUD drawn only in the tourney's own room. */
    tick() {
      if (!s) return;
      const now = nowMs();
      if (here(s.seat)) s.awayAt = null;
      else if (s.awayAt == null) s.awayAt = now;
      else if (now - s.awayAt >= BATTLE_AWAY_MS) { api.leave({ words: ROYAL_SESSION_TEXT.away(s.seat?.name ?? 'the city') }); return; }
      if (!s.joined) { if (s.retryAt && now >= s.retryAt) { s.retryAt = 0; ask(); } return; }
      if (s.ends && now >= s.ends) { api.leave(); return; }
      if (online.room !== s.room) { s.sentIn = false; hud?.hide(); return; }
      if (online.terminal) { api.leave({ words: ROYAL_SESSION_TEXT.closed }); return; }
      const open = online.status === 'open';
      if (!open) s.sentIn = false;
      else if (!s.sentIn) s.sentIn = online.sendSiege({ k: 'in' });
      hud?.update(royalHudModel(s.state, { seat: s.seat?.name, prize: s.royal?.prize, endsMs: s.ends }, online.id, now, { watching: s.side === 'watch', name }));
    },
    /** The peers this player may strike: its bout's opponent, the countdown run. */
    foes() {
      const b = s && s.side !== 'watch' ? fighting(nowMs()) : null;
      return b ? [b.a === online.id ? b.b : b.a] : [];
    },
    /** A blow on the opponent, to the referee. True when it left. */
    blow(to, { w, m, d, r }) { return api.foes().includes(to) && online.sendSiege({ k: 'blow', to, w, m, d, r }); },
    /** The ring this player must keep to - its centre (the pass's own point, wire natives) and radius - while its bout
     *  stands (the countdown included), else null. */
    ring() {
      const b = s?.state.bout;
      return b && (b.a === online.id || b.b === online.id) ? { centre: s.field[0], radius: ROYAL_RING.radiusM } : null;
    },
    /** The ring's centre to draw while entered (wire natives), else null. */
    ringCentre: () => (s?.joined ? s.field[0] : null),
    /** The state, for the pins. */
    get state() { return s?.state ?? null; },
  };
  return api;
}
