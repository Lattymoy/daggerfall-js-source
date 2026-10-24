// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): A SIEGE AS
// THIS CLIENT FIGHTS IT (bible/11-Multiplayer/Seats-Arc.md 6.2-6.8, 19) - entered from the board's Seat tab while the
// battle's door is open: the field this game derived from the town (systems/siegeField.js) sent for a pass (the service
// settles the field on an attacker's and a defender's agreeing - until then it asks again, said in words), then the
// battle's own room joined (`siege:<key>:<week>`, a fresh pass on every hello - net/online.js mintSiegePass), `in` said
// once a socket is open; the room's words folded (net/siege/siegeLink.js) and drawn (ui/siegeHud.js); a step refused or a rise
// at the camp moves the player there; a blow on a foe sent to the referee; at the end this fighter's receipt kept and
// carried to the service (net/siege/siegeClaims.js), its Honours on the card. Left at the window's close or by the player -
// the world's own room is joined again.
//
// The world is handed in (`online`, the book's two calls, the HUD, the clock, `movePlayer`), so the pins drive it with
// fakes. Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
//
// AUDIT-SEATS (2026-10-01): C1 - A BATTLE IS LEFT: by the player (the HUD's Leave, the result card's Close, the chat's
// `/leave` - scenes/world.js), when the player has been away from the seat's town BATTLE_AWAY_MS (`here`), when the
// battle's socket is closed for good, and at the window's close; the HUD is drawn only while the player stands in the
// battle's room (a building's room is not the field). C2 - the one mint slot (net/online.js mintSiegePass) is cleared
// only while it is this session's own. C3 - an unsettled field is said ONCE and asked again on a backing-off wait (5 s,
// 10, 20, 40, then every 60 s), so the service's hourly bound on passes is never reached. C7 - every settling answer to
// this fighter's receipt reaches the card (a refusal in words), so it never stands on "claim it".
import { siegeRoomKey, fieldOf, SIEGE_WORK_IDS, SIEGE_NPC, isSiegeNpcId } from './siegeRef.js';   // SEAT2b part two (b): the works' point and ids; part two (c): the relay's own fighters
import { foldSiege, siegeHudModel, siegeClaimRefusal, SIEGE_STATE_EMPTY, fightArmed } from './siegeLink.js';   // HERALDRY-SHOWN: fightArmed, the HUD's two sides' heraldry
import { readSiegeReceipt } from './siegeReceipt.js';

/** How long an unsettled field waits before the pass is asked again, ms - the first wait. */
export const SIEGE_PASS_RETRY_MS = 5000;
/** AUDIT-SEATS C3: the longest wait - each doubles from the first to this (a Royal Tourney's ring's too). */
export const PASS_RETRY_MAX_MS = 60_000;
/** AUDIT-SEATS C3: the wait before the `n`th ask again (1 the first): 5 s, 10, 20, 40, then 60 for good. */
export const passRetryMs = (n, first = SIEGE_PASS_RETRY_MS) => Math.min(PASS_RETRY_MAX_MS, first * 2 ** Math.max(0, n - 1));
/** AUDIT-SEATS C1: how long the player may be away from the seat's town before the battle is left, ms - a door, a load's
 *  frames or a step past the town's edge is no leaving. */
export const BATTLE_AWAY_MS = 5000;
/** AUDIT-SEATS C1: the chat's word that leaves a battle or a Royal Tourney (scenes/world.js) - `/leave`. */
export const isBattleLeaveCommand = (text) => /^\/leave$/i.test(String(text ?? '').trim());
/** AUDIT-SEATS C1: what the chat says to a `/leave` with nothing entered. */
export const BATTLE_NONE_TEXT = 'You are in no battle and no Royal Tourney.';
/** The words. */
export const SIEGE_SESSION_TEXT = Object.freeze({
  notHere: (town) => `Go to ${town} to fight for it. The battle is fought in the town itself.`,
  old: 'The server does not fight sieges yet.',
  entered: (side) => (side === 'watch' ? 'You are watching the battle as a spectator.' : `You fight for the ${side === 'attack' ? 'attackers' : 'defenders'}. Make for your camp's banner.`),
  left: 'You have left the battle.',
  refused: (why) => `The battle would not have you: ${why}`,
  away: (town) => `You have left ${town}, and the battle with it.`,   // AUDIT-SEATS C1
  closed: 'The connection to the battle closed. You have left it.',   // AUDIT-SEATS C1: its socket closed for good
  breach: (town) => `The Gatehouse of ${town} is breached.`,   // SEAT2b part two (b)
  ramDown: 'A Ram is destroyed at the gate.',   // SEAT2b part two (b)
  captainDown: 'The Rebel Captain falls at the palace door!',   // SEAT2b part two (c)
  struckBy: (kind) => (kind === 'guard' ? 'A town guard cuts you down.' : kind === 'captain' ? 'The Rebel Captain cuts you down.' : 'A rebel cuts you down.'),
});

/**
 * THE SESSION. `online` (net/online.js), `pass(seat, field)` and `claim(receipt)` the book's (net/townSeatBook.js
 * siegePass, claimSiege), `claims` (net/siege/siegeClaims.js, or null), `hud` (ui/siegeHud.js createSiegeHud, or null),
 * `nowMs()` (AUDIT-SEATS C6: the relay's clock - the pass's window is the relay's), `movePlayer(pose)` (a wire pose:
 * natives on x and z), `say(text)`, `relayOk()` the relay fights battles; AUDIT-SEATS C1: `here(seat)` whether the player
 * is still at the seat's town.
 * @param {{ online: any, pass: (seat: any, field: any) => Promise<any>, claims?: any, hud?: any, nowMs?: () => number,
 *   movePlayer?: (p: any) => void, say?: (t: string) => void, relayOk?: () => boolean, here?: (seat: any) => boolean }} deps
 */
export function createSiegeSession({ online, pass, claims = null, hud = null, nowMs = () => Date.now(), movePlayer = () => {}, say = () => {}, relayOk = () => true, here = () => true }) {
  /** @type {null | { seat: any, battle: any, field: any, room: string, side: string, window: number, sentIn: boolean, state: any, retryAt: number, joined: boolean, honours: any, tries: number, mint: any, awayAt: number|null }} */
  let s = null;
  async function ask() {
    if (!s) return;
    const at = s;
    const r = await pass(s.seat, s.field);
    if (s !== at) return;   // AUDIT-SEATS C1: left, or entered afresh, while it was asked
    if (!r?.ok) {
      // AUDIT-SEATS C3: said once, asked again on a backing-off wait
      if (r?.error === 'field-unsettled') { s.tries++; s.retryAt = nowMs() + passRetryMs(s.tries); if (s.tries === 1) say(r.text); return; }
      say(SIEGE_SESSION_TEXT.refused(r?.text ?? 'it is not open'));
      api.leave({ quiet: true });
      return;
    }
    s.side = r.side; s.window = Number(r.window) * 1000;
    s.room = siegeRoomKey(s.seat.key, r.week);
    // AUDIT-SEATS C2: this session's own mint, kept, so a leave clears the slot only while it is still this one's
    s.mint = async () => { const again = await pass(at.seat, at.field); return again?.ok ? again.pass : null; };
    online.mintSiegePass = s.mint;
    s.joined = true;
    say(SIEGE_SESSION_TEXT.entered(r.side));
  }
  const api = {
    /** The room the world must stand in while a battle is entered, else null (scenes/world.js keeps its own then). */
    room: () => (s?.joined ? s.room : null),
    active: () => !!s,
    side: () => s?.side ?? null,
    /** Enter `seat`'s battle - `battle` the Seat tab's (its kind, tier and two guilds), `field` the pass's `sf` this game
     *  derived (null: the player is not in the town). */
    enter(seat, battle, field) {
      if (!relayOk()) { say(SIEGE_SESSION_TEXT.old); return false; }
      if (!field) { say(SIEGE_SESSION_TEXT.notHere(seat?.name ?? 'the town')); return false; }
      if (s?.mint && online.mintSiegePass === s.mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: entered afresh - the old pass's mint goes
      s = { seat, battle: fightArmed(battle, seat), field, room: '', side: 'watch', window: 0, sentIn: false, state: SIEGE_STATE_EMPTY, retryAt: 0, joined: false, honours: undefined, tries: 0, mint: null, awayAt: null };
      ask();
      return true;
    },
    /** Leave it (`quiet`: no word; `words` another word than the plain one) - the world's room is the world's again.
     *  AUDIT-SEATS C1: true when there was a battle to leave. @param {{ quiet?: boolean, words?: string }} [o] */
    leave({ quiet = false, words = SIEGE_SESSION_TEXT.left } = {}) {
      if (!s) return false;
      const mint = s.mint;
      s = null;
      if (mint && online.mintSiegePass === mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: another battle's mint is not this one's to clear
      hud?.hide();
      if (!quiet) say(words);
      return true;
    },
    /** A word from the battle's room (net/online.js onSiege). SEAT2b part two (b): a breach and a Ram's end said once,
     *  off the field's frames. */
    onSiege(g, room) {
      if (!s || room !== s.room) return;
      const was = s.state;
      s.state = foldSiege(s.state, g, nowMs());
      if (g.k === 'f') {
        if (was.gate && was.gate[0] > 0 && s.state.gate && s.state.gate[0] === 0) say(SIEGE_SESSION_TEXT.breach(s.seat?.name ?? 'the town'));
        else if (was.ram && was.ram[0] > 0 && s.state.gate?.[0] > 0 && !(s.state.ram && s.state.ram[1] > 0)) say(SIEGE_SESSION_TEXT.ramDown);
      }
      // SEAT2b part two (c): the Captain's fall, and this fighter cut down by one of the relay's own - said once
      if (g.k === 'fell' && isSiegeNpcId(g.id) && was.npcs.find((n) => n.id === g.id)?.kind === 'captain') say(SIEGE_SESSION_TEXT.captainDown);
      if (g.k === 'fell' && g.id === online.id && isSiegeNpcId(g.by)) say(SIEGE_SESSION_TEXT.struckBy(was.npcs.find((n) => n.id === g.by)?.kind));
      if (g.k === 'back') movePlayer(g.p);
      if (g.k === 'up' && g.id === online.id && g.p) movePlayer(g.p);
      if (g.k === 'no') say(g.m);
      if (g.k === 'end' && g.rc && readSiegeReceipt(g.rc) && claims) {
        claims.keep(g.rc);
        claims.offer({ force: true });
      }
    },
    /** The service's answer to this fighter's claim (net/siege/siegeClaims.js onClaimed) - its Honours on the card. AUDIT-SEATS
     *  C7: every settling answer - a refusal's words in the Honours' place (net/siege/siegeLink.js siegeClaimRefusal) - and only
     *  this battle's own receipt's (`receipt`: an older battle's, settling now, is not this card's). */
    claimed(answer, receipt = null) {
      if (!s || (receipt != null && s.state.receipt != null && receipt !== s.state.receipt)) return;
      s.honours = answer?.ok === false ? siegeClaimRefusal(answer) : (answer?.data?.honours ?? answer?.honours ?? null);
    },
    /** Each frame: the pass asked again while the field settles, `in` said once on an open socket, the HUD drawn, the
     *  battle left when its window has closed. AUDIT-SEATS C1: and left once the player has been away from the seat's
     *  town BATTLE_AWAY_MS, or its socket has closed for good; the HUD drawn only in the battle's own room. */
    tick() {
      if (!s) return;
      const now = nowMs();
      if (here(s.seat)) s.awayAt = null;
      else if (s.awayAt == null) s.awayAt = now;
      else if (now - s.awayAt >= BATTLE_AWAY_MS) { api.leave({ words: SIEGE_SESSION_TEXT.away(s.seat?.name ?? 'the town') }); return; }
      if (!s.joined) { if (s.retryAt && now >= s.retryAt) { s.retryAt = 0; ask(); } return; }
      if (s.window && now >= s.window) { api.leave(); return; }
      if (online.room !== s.room) { s.sentIn = false; hud?.hide(); return; }
      if (online.terminal) { api.leave({ words: SIEGE_SESSION_TEXT.closed }); return; }
      const open = online.status === 'open';
      if (!open) s.sentIn = false;
      else if (!s.sentIn) s.sentIn = online.sendSiege({ k: 'in' });
      hud?.update(siegeHudModel(s.state, { seat: s.seat?.name, kind: s.battle?.kind, tier: s.battle?.tier, attacker: s.battle?.attackerGuild, defender: s.battle?.defenderGuild }, online.id, now,
        { watching: s.side === 'watch', honours: s.honours, claimable: !!s.state.receipt && s.honours === undefined }));
    },
    /** Whether a peer is this fighter's foe (a fighter of the other side). SEAT2b part two (c): or one of the relay's own
     *  fighting for the other side, standing (a guard an attacker's foe, a rebel and the Captain a defender's). */
    isFoe(id) {
      if (!s || s.side === 'watch') return false;
      if (isSiegeNpcId(id)) { const n = s.state.npcs.find((x) => x.id === id); return !!n && !n.down && !!SIEGE_NPC[n.kind] && SIEGE_NPC[n.kind].side !== s.side; }
      const f = s.state.roll[id];
      return !!f && !!f.side && f.side !== s.side && !f.down;
    },
    /** The peers this fighter may strike. */
    foes() { return s && s.side !== 'watch' ? [...Object.keys(s.state.roll), ...s.state.npcs.map((n) => n.id)].filter((id) => api.isFoe(id)) : []; },
    /** SEAT2b part two (c): the relay's own fighters as the field last said them (net/siege/siegeLink.js SiegeNpc) - none outside a
     *  battle. */
    npcs() { return s ? s.state.npcs : []; },
    /** AUDIT-SEATS G5: the side-mates standing this fighter may heal (not itself - a self-heal is the save's own). */
    mates() { return s && s.side !== 'watch' ? Object.keys(s.state.roll).filter((id) => id !== online.id && s.state.roll[id].side === s.side && !s.state.roll[id].down) : []; },
    /** A blow on a foe, to the referee (net/wire.js validSiegeIn's `blow`). True when it left. */
    blow(to, { w, m, d, r }) { return !!s && api.isFoe(to) && online.sendSiege({ k: 'blow', to, w, m, d, r }); },
    /** A cast on a peer - a harmful one on a foe, a heal on a side-mate. */
    cast(to, d, heal = false) {
      if (!s || s.side === 'watch') return false;
      if (isSiegeNpcId(to)) return !heal && api.isFoe(to) && online.sendSiege({ k: 'cast', to, d, h: 0 });   // SEAT2b part two (c): no heal reaches one
      const f = s.state.roll[to];
      if (!f || (heal ? f.side !== s.side : !api.isFoe(to))) return false;
      return online.sendSiege({ k: 'cast', to, d, h: heal ? 1 : 0 });
    },
    /** SEAT2b part two (b) (6.2): THE WORK THIS FIGHTER MAY STRIKE - an attacker the Gatehouse (`gh`) while it stands
     *  unbreached, a defender the Ram (`rm`) while one stands before it - or null (a spectator, a battle without, a relay
     *  that says no works: an older one never hears a work named). */
    workTarget() {
      if (!s || s.side === 'watch' || !s.state.gate || !(s.state.gate[0] > 0)) return null;
      if (s.side === 'attack') return SIEGE_WORK_IDS.gate;
      return s.side === 'defend' && s.state.ram && s.state.ram[0] > 0 ? SIEGE_WORK_IDS.ram : null;
    },
    /** SEAT2b part two (b): where the works stand - the Gatehouse (and its Ram) at the Throne's point, `[x, z]` in the
     *  room's units, off the field this game derived (the one the service settled where it agreed) - or null. */
    workPoint() { return s ? (fieldOf(s.field, s.battle?.tier ?? 'palace')?.throne ?? null) : null; },
    /** SEAT2b part two (b): a melee blow on the work this fighter may strike, to the referee. True when it left. */
    workBlow(to, { w, m, d, r }) { return !!s && to != null && api.workTarget() === to && online.sendSiege({ k: 'blow', to, w, m, d, r }); },
    /** This fighter has fallen (it waits for its wave). */
    down: () => !!s && !!s.state.roll[online.id]?.down,
    /** The state, for the pins. */
    get state() { return s?.state ?? null; },
  };
  return api;
}
