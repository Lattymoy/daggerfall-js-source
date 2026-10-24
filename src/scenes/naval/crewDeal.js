// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CREW-TRADE (2026-10-23, bible/03-World/Captains-Sea.md CREW-TRADE) - HER CREW AT THE EXCHANGE, the naval host's side:
// the shipwright's window's model carries it (navalHost.js yardModel `crewDeal`) to the harbour office's exchange
// (scenes/harbourOffice.js), which prices, pays and says. Out of createNavalHost (HOST-SPLIT): the host hands her state,
// its roster's sync and its crew companions, and keeps no state of this module's.
// ═══════════════════════════════════════════════════════════════════
import { crewSpare, crewRoom, signOffOrder } from '../../systems/naval/crewTrade.js';
import { playerCrewCount } from '../../systems/naval/crewLife.js';
import { fleetCrossed } from '../../systems/fleet.js';
import { charterRecord } from '../../systems/naval/passage.js';   // AUDIT CREW-TRADE E1: a booked passage's boat

/**
 * A boat of mine's crew as the exchange deals in it: `st` her sea-fight state (navalHost.js myBoatState), `sync(boat)`
 * her roster made to match her deck and answered (navalHost.js crewHands - said to nobody), `companions` the crew
 * companions (systems/naval/crewCompanions.js - `awayOf(uid)` the names of hers ashore at the player's side).
 * @param {any} boat @param {any} st @param {(boat: any) => readonly { name: string }[]} sync
 * @param {{ awayOf: (uid: any) => { has: (name: string) => boolean } }} companions
 */
export function crewDealOf(boat, st, sync, companions) {
  const d = st.damage;
  /** The names of hers in the player's shore party (the party's own roll - kept for the shore while he sails). */
  const away = () => (boat?.uid ? companions.awayOf(boat.uid) : null);
  /** Her named hands now, by name and post. */
  const named = () => st.crew.hands.map((h) => ({ name: h.name, role: h.role }));
  /** Her crew as the exchange reads it: crewed (a hull whose deck stands men), a booked passage's (`charter` - AUDIT
   *  CREW-TRADE E1: her hands are her master's, a fresh full crew every booking, and three bookings sold 1,466 gold of
   *  them), her crew and her whole, in a fight, how many more she takes (`room`) and how many may leave her (`spare`,
   *  crewTrade.js crewSpare - `why` none may). */
  function stands() {
    const crewed = !!boat?.crewed && d.maxCrew > 0;
    const hands = crewed ? sync(boat) : [];
    const spare = crewSpare({ hull: boat.hull, crew: d.crew, hands, away: away(), crossed: !!boat.uid && fleetCrossed(boat.uid) });
    return { crewed, charter: !!charterRecord(boat?.charter), crew: d.crew, maxCrew: d.maxCrew, fighting: !!st.inFight, room: crewRoom(d), spare: spare.n, why: spare.why };
  }
  return {
    stands,
    /** `k` men signed on: her crew raised, never past her whole (navalDamage.js `muster` - no blow, no fire put out, a
     *  wreck a wreck), no loss on her spirits' books, her new hands named by her roster's sync. Answers `{ n, joined }` -
     *  the men she took and the named hands who joined her (AUDIT CREW-TRADE H3: said, as the shipwright's hire says
     *  them). @param {number} k */
    signOn(k) {
      const was = d.crew, before = new Set(st.crew.hands.map((h) => h.name));
      d.muster(was + Math.max(0, Math.floor(Number(k) || 0)));
      st.lastCrew = d.crew;
      sync(boat);
      return { n: d.crew - was, joined: named().filter((h) => !before.has(h.name)) };
    },
    /** `k` men signed off, as many as may leave her (`stands().spare`): the named hands past what her deck then stands
     *  paid off as the crew hall pays one off, the least worth losing first (crewTrade.js signOffOrder - AUDIT CREW-TRADE
     *  H1; the spirits a hall's recruit lifted leave with him - shipCrew.js release), her crew lowered (navalDamage.js
     *  `discharge`), no loss on her spirits' books. Answers `{ n, left }` - the men who left her and the named hands
     *  among them. @param {number} k */
    signOff(k) {
      const n = Math.min(Math.max(0, Math.floor(Number(k) || 0)), stands().spare);
      if (n <= 0) return { n: 0, left: [] };
      const was = d.crew;
      const going = signOffOrder(st.crew.hands, away()).slice(0, Math.max(0, st.crew.hands.length - playerCrewCount(boat.hull, was - n)));
      for (const h of going) st.crew.release(h.name);
      d.discharge(was - n);
      st.lastCrew = d.crew;
      sync(boat);
      return { n: was - d.crew, left: going.map((h) => ({ name: h.name, role: h.role })) };
    },
  };
}
