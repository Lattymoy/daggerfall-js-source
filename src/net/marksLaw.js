// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MARKS1 (2026-09-28, Mac: "New currency"; "Continue! Remember, this is
// your baby"; "continue") — MARKS, THE SERVER'S CURRENCY: what a Mark is
// worth, where one comes from, where it goes, and every bound both ends
// read. The record is bible/06-Systems/Professions-Arc.md 10.5 (PROF0).
//
// WHY A SECOND CURRENCY. Online gold is the save's ("The GOLD is the
// client's, the economy being the save's" - GUILD1), so anything paid in
// purse gold can be paid by a client that never had it. A Mark is held by
// the account service alone and struck only for an act a server
// witnessed: it is the one thing a modified client cannot print.
//
// THE ONE-WAY DOOR. Marks sell for gold at a Bank of the Empire counter,
// 1 for 8 (a spread that is itself a sink), 300 a UTC day; GOLD NEVER
// BUYS MARKS - that door would strike a Mark from gold a client may not
// have had. There is no route, function or table here that turns gold
// into Marks, and the pins hold that.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/marks.js), which keeps every balance and the one
// ledger, and the client. Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════

/** The most an account's balance - or a guild's Marks treasury - holds. */
export const MARKS_MAX = 10_000_000;
/** A Mark is worth about this much gold of play (the record's yardstick; the Bank pays less - its spread). */
export const MARK_WORTH_GOLD = 10;

/**
 * THE FAUCETS - only acts a server witnessed, each capped. MARKS1 strikes the first (the gate's receipts); the rest
 * come with their slices, and are named here so the cap is the law before the faucet is built.
 *   gate      - an Oblivion Gate receipt the relay signed and the service counted (WB5b): 50 (100 under a Daedric
 *               Incursion, SEAT0 9.3 - the second half at the Turning, seatIncursion.js). SILVER-WAYS: under the day's
 *               COMBAT cap (MARKS_COMBAT) with the raids', no longer two a day of its own.
 *   raid      - SILVER-WAYS (2026-10-03, Mac: "Do it"): a town defended - a raid's receipt the relay signed at its
 *               cleanse (RAID3/RAID4) and the service counted once a (raid, account): 30, under the COMBAT cap.
 *   writ      - a Court writ's pay (PROF1 - BUILT, server-account/src/professions.js): its units x the material's
 *               value x 1.2, 3 an account a UTC day.
 *   honour    - a Siege Honour (SEAT0 6.8): one a siege.
 *   deed      - SILVER-WAYS: a GUILD DEED, struck to a guild's treasury (never an account's) when `members` accounts of
 *               it - each a character `tenureS` in the guild - have claimed the same raid or gate: 25, `perDay` a guild a
 *               UTC day.
 *   motherlode - a Motherlode find (PROF2b): 10, one an account a UTC day.
 */
export const MARKS_FAUCETS = Object.freeze({
  gate: Object.freeze({ amount: 50 }),
  raid: Object.freeze({ amount: 30 }),
  writ: Object.freeze({ perDay: 3 }),   // PROF1: the pay is each writ's own (professionLaw.js writPay)
  deed: Object.freeze({ amount: 25, perDay: 4, members: 3, tenureS: 7 * 86_400 }),
  motherlode: Object.freeze({ amount: 10, perDay: 1 }),
});
/**
 * SILVER-WAYS: THE DAY'S COMBAT CAP - what the gates and the raids strike an account together, a UTC day. The gate was
 * two a day of its own (100); a fighter now earns by raids too, and the day's ceiling rose by one raid's worth and a
 * little (150 = three gates, or five raids, or two gates and a raid and part of another). The strike that meets the cap
 * pays what the day has left of it (`combatStrike`), never nothing for a few silver short.
 */
export const MARKS_COMBAT = Object.freeze({ kinds: Object.freeze(['gate', 'raid']), perDay: 150 });
/** What a combat faucet's `amount` strikes when `earned` is the day's combat silver so far: the amount, or the day's last. */
export const combatStrike = (amount, earned) => Math.max(0, Math.min(amount, MARKS_COMBAT.perDay - Math.max(0, earned)));
/** The Bank of the Empire's exchange: Marks for gold, never the other way. */
export const MARKS_BANK = Object.freeze({ goldPerMark: 8, perDay: 300 });
/** One guild deposit or withdrawal of Marks, at most. */
export const MARKS_MOVE_MAX = 1_000_000;
/** The ledger lines a guild's view shows. */
export const MARKS_LEDGER_SHOWN = 50;
/** The weekly report's span, in UTC days. */
export const MARKS_REPORT_DAYS = 7;
/** Marks acts an account may make an hour (an exchange and a guild move each count). */
export const MARKS_OPS_MAX = 120;
export const MARKS_OPS_WINDOW_S = 3600;

/** Every kind of line the one ledger holds, and which way it moves Marks. */
export const MARKS_KINDS = Object.freeze({
  gate: 'mint',               // the relay's receipt, counted
  exchange: 'burn',           // sold to the Bank for gold
  'guild-deposit': 'move',    // a member's balance into the guild's treasury
  'guild-withdraw': 'move',   // the guildmaster's, out of it
  writ: 'mint',               // PROF1: a Court writ filled from the Stores - an act the service witnessed (it took the units)
  respec: 'burn',             // PROF1: a specialisation changed (PROF0 3.3: 1,000 Marks)
  stock: 'burn',              // PROF3: the smith's stock - the fittings no profession yields yet, bought into the Stores (PROF0 24)
  'market-fee': 'burn',       // PROF5: a listing's fee, 1% of its worth, at least 1 (PROF0 10.4)
  'market-tax': 'burn',       // PROF5: a sale's tax, 5% of it - the seller's, from the proceeds
  courier: 'burn',            // PROF5: a courier's fee, the buyer's, on top of the price
  'market-sale': 'move',      // PROF5: a sale's proceeds, the buyer's balance into the seller's
  'order-escrow': 'move',     // PROF5: a buy order's Marks, held while it stands (the ledger's `escrow` end, the order's id)
  'order-fill': 'move',       // PROF5: a fill's pay, out of the order's escrow into the filler's balance
  'order-return': 'move',     // PROF5: what is left of an order's escrow, back to its poster at a cancel or its seventh day
  'bid-escrow': 'move',       // PROF5b: an auction bid and its courier, held while it stands (the `escrow` end, the bid's id)
  'bid-return': 'move',       // PROF5b: an outbid (or a removed auction's) bid's escrow, back to its bidder
  'auction-sale': 'move',     // PROF5b: the winning bid less its tax, out of its escrow into the seller's balance
  'writ-escrow': 'move',      // PROF6: a guild writ's whole pay, from its guild's treasury, held while it stands (the writ's id)
  'writ-pay': 'move',         // PROF6: a delivery's pay less its tax, out of the writ's escrow into the deliverer's balance
  'writ-return': 'move',      // PROF6: what is left of a guild writ's escrow, back to its guild at a withdrawal or its seventh day
  'commission-escrow': 'move', // PROF6: a commission's pay, held while it stands (the commission's id)
  'commission-pay': 'move',   // PROF6: the pay less its tax, out of the escrow into the crafter's balance
  'commission-return': 'move', // PROF6: a withdrawn, declined or expired commission's pay, back to its poster
  tribute: 'burn',            // SEAT1b: a guild's Tribute at the seat it pledged, from its treasury (Seats-Arc 4.2)
  'seat-claim': 'burn',       // SEAT1c: a Charter's claim fee, from the taker's treasury at the Turning (5.2)
  'seat-upkeep': 'burn',      // SEAT1d: a Charter's week, from its holder's treasury at the Turning (7.1)
  'seat-edict': 'burn',       // SEAT1d: a Festival's cost, at the Turning that makes it law (7.6)
  tithe: 'move',              // SEAT1d: a sale's Tithe (and a courier's share) to its seat's holder - burnt where none can take it (7.2)
  'bounty-escrow': 'move',    // SEAT1d: a Bounty's set-aside, held while it rules (the `escrow` end, `bounty:<key>:<week>`)
  bounty: 'move',             // SEAT1d: twenty Drakes a camp cleared, out of the Bounty's escrow
  'bounty-return': 'move',    // SEAT1d: what a Bounty's escrow did not pay, home to its guild at the next Turning
  // AUDIT-SEATS: the kinds the guilds and the seats wrote that this list never named
  heraldry: 'burn',           // GUILD1d: a guild's heraldry changed (Seats-Arc 8.1: 500 Drakes)
  'sellsword-escrow': 'move', // SEAT2a: a Sellsword's fee, from the hiring guild's treasury, held while the contract stands
  'sellsword-fee': 'move',    // SEAT2a: the fee, out of the escrow to the Sellsword at the battle's end
  'sellsword-return': 'move', // SEAT2a: a withdrawn or unearned contract's fee, home to its guild
  'siege-honours': 'mint',    // SEAT2a: a siege's Honours, off the fighter's relay-signed receipt (Seats-Arc 6.8)
  conscription: 'move',       // CROWN1: a palace seat's share of its Tithe to its crown's treasury
  'royal-escrow': 'move',     // CROWN1: a Royal Tourney's prize, held from the crown's treasury while it rules
  'royal-prize': 'move',      // CROWN1: the prize, out of the escrow to the champion's account
  'royal-return': 'move',     // CROWN1: a Tourney no bout won - the prize home
  'fealty-tribute': 'move',   // CROWN2: a vassal's 5% of its Tithe to its liege
  'gate-incursion': 'mint',   // AUDIT-SEATS: a Daedric Incursion's second half of a gate's Marks, once three claims agree (9.3)
  fort: 'burn',               // SEAT2b: a fortification project's Marks, from the holder's treasury as it is begun (7.5)
  'seat-strike-refund': 'mint', // AUDIT-SEATS S4: a struck seat's claim fee, minted back to its holder within the Season (16)
  raid: 'mint',               // SILVER-WAYS: a town defended - the relay's raid receipt, counted (under the day's combat cap)
  'guild-deed': 'mint',       // SILVER-WAYS: a guild deed - three of a guild's accounts on one raid or gate - into its treasury
  'contract-escrow': 'move',  // SILVER-WAYS: a guild contract's whole pay, from its treasury, held while it stands (the contract's id)
  'contract-pay': 'move',     // SILVER-WAYS: a defender's pay less its tax, out of the contract's escrow
  'contract-return': 'move',  // SILVER-WAYS: what is left of a contract's escrow, home to its guild at a withdrawal or its seventh day
  motherlode: 'mint',         // PROF2b: a Motherlode found - the relay's word that the striker stood in its cell, counted
});

/** The switch the service's config holds (MARKS_OPEN): off, dev (the developers alone), on. */
export const MARKS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const marksSwitchOf = (v) => (MARKS_SWITCH.includes(v) ? v : 'off');

/** The UTC day a moment falls in - every cap counts by it. */
export const utcDay = (nowS) => Math.floor(nowS / 86400);
/** A whole number of Marks to move: 1 up to `max`. */
export const marksAmountOk = (n, max = MARKS_MOVE_MAX) => Number.isSafeInteger(n) && n >= 1 && n <= max;
/** The gold the Bank pays for `marks`. */
export const exchangeGold = (marks) => marks * MARKS_BANK.goldPerMark;
/** A request id, so an answer lost and asked again is answered again rather than charged twice: 8-40 of [A-Za-z0-9_-]. */
export const MARKS_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

/** A balance as a person reads it: "1,240 Marks", "1 Mark". */
export const marksText = (n) => `${Number(n).toLocaleString('en-US')} silver`;
