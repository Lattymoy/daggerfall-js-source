// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE OPEN ZONE'S FIGHTS, AND A BODY'S ONE PIECE.
//
// The owner: "Wrothgarian mountains need to be turned into a open pvp zone ... players can choose 1 item of the
// equipped ones the killed player has by clicking the dead body".
//
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): THE RELAY REFEREES THE ZONE
// (net/wildRef.js). WILD1 let THE DEFENDER resolve every blow on its own machine and THE FALLEN give its killer's piece -
// so a client that never took a blow never fell, and one that fell gave what it chose. Now:
//   - A BLOW goes out as before - a numbered `strike` or `spell` on the `wild` frame (net/wire.js validWildData), to the
//     player it names, only at a fair one (the host says who: in the zone, not of my party) - carrying the damage MY
//     sheet rolled (`d`), and the relay judges it (the weapon my look holds, the arms my token signs, the reach from where
//     it believes us both) and says what landed to both of us (`wref` `hp`); nobody resolves anything here.
//   - A FALL is the referee's word (`wref` `fell`), and so is its killer.
//   - THE BODY'S ONE PIECE. The fallen's game shows its killer what its worn gear offers (`worn`: the records, under the
//     fall's remains id `s`); the killer's body window picks ONE (`pick`, its place in that list) - TO THE RELAY, in the
//     room that refereed the fall, once a fall - and the relay signs the fall with it (net/wildReceipt.js). The account
//     service takes that piece off the fallen's record against the receipt and the room's remains hold it for the killer
//     alone (net/wildRemains.js takes it for them).
//
// Pure - no DOM, no game import: the host (scenes/world.js) hands in the socket, the clock and the law of who is fair, so
// the pins drive this over a fake wire.
// ═══════════════════════════════════════════════════════════════════

/** How long a body's offer stands at the killer's side, ms - the referee's pick window (net/wildRef.js WILD_REF.pickMs,
 *  pinned equal): a pick past it reaches a fall already signed without one. */
export const WILD_BODY_MS = 60_000;

/**
 * @param {object} o
 * @param {(data: any, opts?: { room?: string|null }) => boolean} o.send   online.sendWild: true when the frame LEFT the socket
 * @param {() => number} [o.now]                   a monotonic clock, ms
 * @param {() => boolean} [o.can]                  may I fight now (in the zone, alive, outdoors)
 * @param {(peer: string) => boolean} [o.fair]      is this player one I may fight (in the zone, not of my party)
 * @param {(from: string, body: { s: string, items: any[], sub: string|null }) => void} [o.onBody]   my victim's offer
 */
export function createWildFight({ send, now = () => Date.now(), can = () => false, fair = () => false, onBody = () => {} }) {
  let n = 0;                                  // my blows' numbers
  /** @type {Map<string, { s: string, items: any[], sub: string|null, room: string|null, at: number, picked: boolean, offered: boolean }>} */
  const bodies = new Map();                   // my victims' offers, by their peer id

  const once = (data, opts) => { try { return send(data, opts) === true; } catch { return false; } };

  const mgr = {
    /** One of MY blows at a fair player: out as a numbered strike or spell, for the referee. The number when it left, 0
     *  when not. */
    blow(to, kind, body) {
      if ((kind !== 'strike' && kind !== 'spell') || !can() || !fair(to)) return 0;
      const k = n + 1;
      if (!once({ ...body, k: kind, to, n: k })) return 0;
      n = k;
      return k;
    },
    /** MY FALL, the referee's word, at `killer`'s hand: my worn gear's offer (`records`, the wire's copies, in my pack's
     *  order - systems/wildDropLaw.js wornOffer) under the fall's remains id `s`. True when it left. */
    offerWorn(killer, s, records) {
      return once({ k: 'worn', to: killer, s, items: records });
    },
    /** A victim's body I may take from (its offer come): `{ s, items, sub, room }`, or null. */
    body(peer) { const b = bodies.get(peer); return b && b.offered && !b.picked && now() - b.at <= WILD_BODY_MS ? b : null; },
    /** Every body I may take from, by peer id. */
    bodies() { return [...bodies.keys()].filter((p) => mgr.body(p)); },
    /** Pick worn piece `i` off `peer`'s body - once a body, to the room that refereed the fall. True when the pick left. */
    pick(peer, i) {
      const b = mgr.body(peer);
      if (!b || !(Number.isInteger(i) && i >= 0 && i < b.items.length)) return false;
      // AUDIT INT9: and what the offer showed there - the relay signs it beside the place, and the service matches it
      // against what the fallen really wears
      const it = b.items[i], t = it?.templateIndex, m = it?.material ?? 0;
      const tm = Number.isInteger(t) && t >= 0 && t < 65536 && Number.isInteger(m) && m >= 0 && m < 65536 ? { t, m } : {};
      if (!once({ k: 'pick', r: b.s, w: i, ...tm }, { room: b.room })) return false;
      b.picked = true;
      return true;
    },
    /** A fall of mine the referee called (`wref` `fell`, `by` me): the fallen's offer is awaited under its remains id `r`,
     *  from the room `room` it came from. */
    fell(peer, r, room = null) {
      bodies.set(peer, { s: r, items: [], sub: null, room, at: now(), picked: false, offered: false });
      if (bodies.size > 16) bodies.delete(bodies.keys().next().value);
    },
    /** A directed wild frame from `peer`, projected and addressed to me; `sub` their account as the relay stamped it. The
     *  one the zone routes now: a fallen's offer of its worn gear - taken only from one the referee said fell by my hand,
     *  under that fall's id, once. */
    onFrame(peer, d, sub = null) {
      if (!d || d.k !== 'worn') return;
      const b = bodies.get(peer);
      if (!b || b.s !== d.s || b.offered || b.picked || now() - b.at > WILD_BODY_MS) return;
      b.offered = true;
      b.items = Array.isArray(d.items) ? d.items : [];
      b.sub = sub ?? null;
      try { onBody(peer, { s: d.s, items: b.items, sub: b.sub }); } catch { /* the host's */ }
    },
    /** The host's frame: a body past its time goes. */
    tick() { for (const [p, b] of bodies) if (now() - b.at > WILD_BODY_MS) bodies.delete(p); },
    /** The player left the world: every body forgotten. */
    reset() { bodies.clear(); },
  };
  return mgr;
}
