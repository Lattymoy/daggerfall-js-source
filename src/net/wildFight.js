// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE OPEN ZONE'S FIGHTS, AND A BODY'S ONE PIECE.
//
// The owner: "Wrothgarian mountains need to be turned into a open pvp zone ... players can choose 1 item of the
// equipped ones the killed player has by clicking the dead body".
//
// THE FIGHT IS THE DUEL'S, WITHOUT THE RING AND THE YES (net/duelSession.js). Two players standing in the zone may
// strike each other - never a member of my own party - and every blow goes out as the duel's own numbered `strike` or
// `spell` frame (on the `wild` frame, net/wire.js validWildData), and THE DEFENDER RESOLVES IT: the game's one formula
// against their own armour, on their own machine, answered with a `result`. Only a fair attacker's blows are taken (the
// host says who is fair: in the zone, not of my party), each number once, at most WILD_BLOWS_PER_S an attacker a
// second. Unlike a duel there is no floor: a blow can kill, and the last fair attacker whose blow landed within
// WILD_KILL_CREDIT_MS of the death is the killer.
//
// THE BODY'S ONE PIECE. The fallen's game tells its killer what its worn gear offers (`worn`: the records, and the
// death's id `s`); the killer's body window picks ONE (`pick`, by its place in that list) - once a death, the first
// pick standing. The fallen's game takes that piece out of its own pack, saves the character without it (the zone's
// death checkpoint, scenes/world.js wildDeathCheckpoint) and only then GIVES it (`gave` with the record). The killer's
// game holds nothing until the gift arrives, so a pick that goes unanswered (the fallen's game closed, the killer
// walked off) costs the killer the piece and never makes a second one (TRADE1's duplication law: fail toward loss). A
// pick waits WILD_PICK_WAIT_MS.
//
// Pure - no DOM, no game import: the host (scenes/world.js) hands in the socket, the clock, the law of who is fair and
// what a blow does, as the duel's manager is driven, so the pins run two of these against each other over a fake wire.
// ═══════════════════════════════════════════════════════════════════
import { tokenGate } from './wire.js';

/** The most blows (strikes and spells together) a defender takes from one attacker a second - the duel's own. */
export const WILD_BLOWS_PER_S = 5;
/** A kill's credit window, ms (systems/wildZone.js keeps the zone's numbers; this is the fight's, the same). */
export const WILD_CREDIT_MS = 10_000;
/** How long a killer's pick waits for the fallen's gift, ms. */
export const WILD_PICK_WAIT_MS = 10_000;
/** How long a body's offer stands at the killer's side, ms - the zone's two minutes and a margin. */
export const WILD_BODY_MS = 125_000;

/**
 * @param {object} o
 * @param {(data: any) => boolean} o.send          online.sendWild: true when the frame LEFT the socket
 * @param {() => number} [o.now]                   a monotonic clock, ms
 * @param {() => boolean} [o.can]                  may I fight now (in the zone, alive, outdoors)
 * @param {(peer: string) => boolean} [o.fair]      is this player one I may fight and be fought by (in the zone, not of my party)
 * @param {(d: any, from: string) => ({ hit: boolean, dmg: number } | null)} [o.onBlow]   resolve a fair blow on MY sheet
 * @param {(d: any, from: string) => void} [o.onResult]   the answer to one of my blows
 * @param {() => number[]} [o.vitals]              [health, maxHealth] for a result
 * @param {(from: string, body: { s: string, items: any[], sub: string|null }) => void} [o.onBody]   my victim's offer
 * @param {(peer: string, i: number) => void} [o.onPicked]   my killer picked my worn piece `i`: the host takes it out of
 *                                                          the pack, saves, and answers with settleOffer
 * @param {(from: string, it: any) => void} [o.onGot]    the piece I picked arrived
 * @param {(from: string) => void} [o.onNoGift]          the piece I picked did not
 */
export function createWildFight({
  send, now = () => Date.now(), can = () => false, fair = () => false, onBlow = () => null, onResult = () => {},
  vitals = () => [1, 1], onBody = () => {}, onPicked = () => {}, onGot = () => {}, onNoGift = () => {},
}) {
  let n = 0;                                  // my blows' numbers
  /** @type {Map<string, { seen: number, bucket: any }>} */
  const from = new Map();                     // an attacker's last number and their gate
  /** @type {{ id: string, sub: string|null, at: number } | null} */
  let struckBy = null;                        // the last fair attacker whose blow landed on me
  /** @type {{ to: string, s: string, pick: number|null, at: number } | null} */
  let offer = null;                           // my body's offer to my killer, and their pick when it stands
  /** @type {Map<string, { s: string, items: any[], sub: string|null, at: number, picked: boolean }>} */
  const bodies = new Map();                   // my victims' offers, by their peer id
  /** @type {{ from: string, s: string, i: number, at: number } | null} */
  let pending = null;                         // my pick, waiting on the gift

  const once = (data) => { try { return send(data) === true; } catch { return false; } };

  const mgr = {
    /** One of MY blows reached a fair player: out as a numbered strike or spell. The number when it left, 0 when not. */
    blow(to, kind, body) {
      if ((kind !== 'strike' && kind !== 'spell') || !can() || !fair(to)) return 0;
      const k = n + 1;
      if (!once({ ...body, k: kind, to, n: k })) return 0;
      n = k;
      return k;
    },
    /** The last fair attacker whose blow landed on me within the credit window - my killer, at a death - or null. */
    killer() { return struckBy && now() - struckBy.at <= WILD_CREDIT_MS ? { id: struckBy.id, sub: struckBy.sub } : null; },
    /** Forget who struck me (a respawn, a rise). */
    clearStruck() { struckBy = null; },
    /** MY DEATH, at `killer`'s hand: my worn gear's offer (`records`, the wire's copies, in my pack's order) under the
     *  death's id `s`. True when it left. */
    offerWorn(killer, s, records) {
      offer = { to: killer, s, pick: null, at: now() };
      return once({ k: 'worn', to: killer, s, items: records });
    },
    /** My killer's standing pick - `{ to, s, i }` - or null (no offer, or nothing picked). */
    claim() { return offer && offer.pick != null ? { to: offer.to, s: offer.s, i: offer.pick } : null; },
    /** The pick, if one stands, answered - with the piece's record when the host took it out of my pack, or with
     *  nothing (it was no longer there, or my body is gone) - and the offer is over. */
    settleOffer(record = null) {
      const o = offer;
      offer = null;
      if (!o || o.pick == null) return false;
      return once(record ? { k: 'gave', to: o.to, s: o.s, i: o.pick, it: record } : { k: 'gave', to: o.to, s: o.s, i: o.pick });
    },
    /** A victim's body I may take from: `{ s, items, sub }`, or null. */
    body(peer) { const b = bodies.get(peer); return b && !b.picked && now() - b.at <= WILD_BODY_MS ? b : null; },
    /** Every body I may take from, by peer id. */
    bodies() { return [...bodies.keys()].filter((p) => mgr.body(p)); },
    /** Pick worn piece `i` off `peer`'s body - once a body. True when the pick left. */
    pick(peer, i) {
      const b = mgr.body(peer);
      if (!b || pending || !(i >= 0 && i < b.items.length)) return false;
      if (!once({ k: 'pick', to: peer, s: b.s, i })) return false;
      b.picked = true;
      pending = { from: peer, s: b.s, i, at: now() };
      return true;
    },
    /** A directed wild frame from `peer`, projected and addressed to me; `sub` their account as the relay stamped it. */
    onFrame(peer, d, sub = null) {
      if (!d || typeof d.k !== 'string') return;
      switch (d.k) {
        case 'strike': case 'spell': {
          if (!can() || !fair(peer)) return;
          const st = from.get(peer) ?? { seen: 0, bucket: null };
          if (!(d.n > st.seen)) return;
          const g = tokenGate(st.bucket, now(), WILD_BLOWS_PER_S);
          st.bucket = g.bucket;
          from.set(peer, st);
          if (from.size > 64) from.delete(from.keys().next().value);
          if (!g.pass) return;
          st.seen = d.n;
          let r = null;
          try { r = onBlow(d, peer); } catch { r = null; }
          if (!r) return;
          if (r.hit && r.dmg > 0) struckBy = { id: peer, sub: sub ?? null, at: now() };
          const [hp, hm] = vitals();
          once({ k: 'result', to: peer, n: d.n, hit: r.hit ? 1 : 0, dmg: Math.max(0, Math.trunc(r.dmg || 0)), h: [Math.max(0, Math.trunc(hp)), Math.max(1, Math.trunc(hm))] });
          return;
        }
        case 'result':
          if (!(d.n <= n)) return;
          try { onResult(d, peer); } catch { /* the HUD is not the fight's problem */ }
          return;
        case 'worn':
          bodies.set(peer, { s: d.s, items: Array.isArray(d.items) ? d.items : [], sub: sub ?? null, at: now(), picked: false });
          if (bodies.size > 16) bodies.delete(bodies.keys().next().value);
          try { onBody(peer, { s: d.s, items: d.items, sub: sub ?? null }); } catch { /* the host's */ }
          return;
        case 'pick': {
          // my killer's choice - once a death (the first stands), from them alone, under this death's id; the host
          // answers it (settleOffer) once the piece is out of my pack and the character saved without it
          if (!offer || offer.to !== peer || offer.s !== d.s || offer.pick != null) return;
          offer.pick = d.i;
          try { onPicked(peer, d.i); } catch { /* the host's */ }
          return;
        }
        case 'gave': {
          if (!pending || pending.from !== peer || pending.s !== d.s || pending.i !== d.i) return;
          pending = null;
          if (d.it) { try { onGot(peer, d.it); } catch { /* the host's */ } } else { try { onNoGift(peer); } catch { /* the host's */ } }
          return;
        }
        default:
      }
    },
    /** The host's frame: a pick that waited too long is given up. */
    tick() {
      if (pending && now() - pending.at > WILD_PICK_WAIT_MS) { const p = pending; pending = null; try { onNoGift(p.from); } catch { /* the host's */ } }
      for (const [p, b] of bodies) if (now() - b.at > WILD_BODY_MS) bodies.delete(p);
    },
    /** The player left the world: every fight and offer forgotten. */
    reset() { from.clear(); bodies.clear(); struckBy = null; offer = null; pending = null; },
  };
  return mgr;
}
