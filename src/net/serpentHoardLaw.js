// @ts-check
// SERPENT-SET (2026-10-05, Mac: "The serpent boss needs to use the currency from oblivion gate and have its own equipment
// rewards"): THE SERPENT'S HOARD, AS BOTH ENDS READ IT - the hoard is rolled on the device (systems/serpentSpoils.js) and
// the account service counts what it paid (server-account/src/serpents.js). Design: bible/11-Multiplayer/Sea-Serpent.md
// section 8.
//
// ITS OWN FILE, NEVER net/serpentLaw.js: the relay bundles that one (it runs the serpent's fight), and RELAY_VERSION
// hashes every file of its graph (test/relayversion.test.js) - a law the relay never reads, written there, would have
// been a relay deploy that drops every connected player. The relay does not import this.
//
// Pure. Not a DFU member. Ledger A (SERPENT1).

/** The Deadlands Embers a serpent's receipt pays - one, to a ship that dealt and one that stood alike (the gate's own law:
 *  an ember a receipt, WB5b). The hoard mints them, and the service writes them on the kill's row (`serpent_kills.stones`,
 *  migration 0083), so the insignia's purse counts a serpent's embers as a breach's. */
export const SERPENT_EMBERS = 1;
