// @ts-check
// SWAP-PACE (2026-10-28, Dudey: "Weapon swap takes too long could be halved in PVE zones and stays the same in PVP-Zones";
// a DEPARTURE, Port-Ledger A): the equip countdown drains at DFU's 980 units a second (WeaponManager.cs:677-693) in the
// open PvP zone (wildZone.js wildHere: Cyrodiil, the open sea, their dungeons) and twice as fast everywhere else.
import { wildHere } from '../../systems/wild/wildZone.js';

/** How many times faster than DFU the swap pause drains outside the open PvP zone. */
export const PVE_SWAP_PACE = 2;

/** The drain's multiplier: 1 in the open PvP zone, PVE_SWAP_PACE elsewhere. */
export const swapPace = (pvp = wildHere()) => (pvp ? 1 : PVE_SWAP_PACE);
