// @ts-check
// KG6 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8, 10.7 and 19): THE KING'S GAMBIT'S GOLD ONLINE -
// the stakes' one home, a leaf every end imports (the relay's table, net/gambit/gambitTable.js; the account service's escrow,
// server-account/src/cards.js; the client's panel), so the account Worker carries no game law for them.
//
// 10.7, DECIDED: "gold online through CARDS6's escrow at the red table, at the mod's online stakes (10, 50, 200, 1,000
// and 5,000 each), the winner's receipt carrying both stakes". A stake is CARDS6's own - held by the realm service
// (`/v1/cards/stake`), its order spent by the relay once, its gold home in the relay's receipt (net/card/cardReceipt.js) -
// told from a Hold'em buy-in by its big blind: GAMBIT_STAKE_BB, which no Hold'em table plays (holdemTable.js
// HOLDEM_BBS), so the service's sum of a table's stakes (cashoutCards) counts a King's Gambit pot's two stakes alone.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).

/** The mod's online stakes, each player's (its stake buttons online). */
export const GAMBIT_ONLINE_STAKES = Object.freeze([10, 50, 200, 1000, 5000]);
/** A King's Gambit stake's big blind - none of Hold'em's (2, 10, 50): the escrow's mark of the game. */
export const GAMBIT_STAKE_BB = 1;
/** Whether `amount` is one of the stakes. @param {any} amount */
export const gambitStakeOk = (amount) => GAMBIT_ONLINE_STAKES.includes(amount);
