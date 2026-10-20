// @ts-check
// SHIPYARDS (2026-10-11, Mac: "A new highly detailed shipmaster vendor and crew recruitment station within it. All
// detailed functions including ship upgrading should be present here, along with ship buying, etc."; asked, Mac chose
// "Shipyard only - the shipyard sells every hull (Rowboat to Carrack/galleon) and buys them back; Come Sail Away's
// random shelf deeds/parts are retired"): THE SHIPMASTER'S TRADE - THE LAW.
//
// Every port town's shipyard (systems/portPlaces.js) is where a ship is had and let go, and where everything done to
// one at a port is done - one window, the shipmaster's (ui/shipyardWindow.js): the SHIPS for sale, the player's FLEET
// (her name, her berth, her sale), the SHIPWRIGHT's work (systems/naval/navalYard.js - her hull, her canvas, her hands
// by the head, her powder and her provisions), her REFITS (systems/fleet.js - her hold, rigging, hull and guns), and the
// CREW HALL (systems/crewHall.js - named recruits signed on to her deck). This file is what the shipyard sells, what it
// buys back and at what price; the window's host half is scenes/shipyardHost.js.
//
// THE STOCK (`SHIPYARD_HULLS`): every hull Come Sail Away builds - the Rowboat, the Large Boat, the Small Ship, the
// Carrack and the Large Galley, cheapest first - at the mod's own prices (comeSailAwayHulls.js HULL_PRICES; SHIP-PRICE
// was withdrawn and they stand). The Rowboat is sold as her PARTS, into the pack (the shelf's own form for her - she is
// launched wherever there is water); every other as her DEED, entered in the Fleet's book with this port the one she
// waits at (fleet.js titleDeed, the counter's own law). A yard never sells out. Each is minted as the shelf minted it
// (comeSailAwayItems.js mintDeed, mintParts), its number the host's (Come Sail Away's UID).
//
// THE PRICE. The shipyard's counter is a yard's (merchantYards.js YARD_QUALITY, YARD_PRICE_INDEX - the same in every
// town, never the region's walk, so no shipyard is a cheaper one to buy at and a dearer one to sell to), haggled by the
// counter's one law (shopStock.js calculateCost, tradeModes.js getTradePrice - Mercantile and Personality, live). A ship
// SOLD BACK fetches the counter's sale price on her WORTH: what she was bought for (a claimed prize her papers' quarter -
// SHIP-CLAIM), half what her refits cost in gold (REFIT_RESALE), and her hull's state (a wreck SALE_FLOOR of it). Online a
// sale is capped at half the least ask, as at every counter (calculateTradePrice), so no buy and sell back pays.
//
// WHAT IT TAKES BACK (`saleRefusal`): a ship of the player's that is HERE - made fast or lying at this port, laid up (her
// title in the book), or packed (her parts in the pack) - with nothing in her hold, nobody of hers ashore at the
// player's side, never one at her helm or fighting. Sold, her title leaves the book and her record the ledger (fleet.js
// forgetShip), her hurts and crew the sea fight's state (scenes/naval/navalHost.js forgetBoat), and a boat standing in the
// world is laid up first, by the mod's own law (LayUpBoat), so she leaves the water as a ship sent away does.
//
// THE SHELVES. The General Store and the Pawn Shop no longer shelve Come Sail Away's two items, and no shop buys them
// back (systems/shopStock.js) - a DECLARED departure from the mod (Ledger A, SHIPYARDS), as MERCHANT-YARDS took the horse
// and the cart off DFU's General Store.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (SHIPYARDS).
import { HULL_NAMES, HULL_PRICES } from './comeSailAway/comeSailAwayHulls.js';
import { mintDeed, mintParts, BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE } from './comeSailAway/comeSailAwayItems.js';
import { YARD_QUALITY, YARD_PRICE_INDEX } from './merchantYards.js';
import { calculateCost } from './shopStock.js';
import { getTradePrice } from './tradeModes.js';
import { upgradeCost, UPGRADE_LINES, UPGRADE_TIERS } from './fleet.js';
import { hullBuild, batteriesOf } from './naval/navalShips.js';
import { playerCrewCount } from './naval/crewLife.js';

/** The hulls the shipyard sells, cheapest first (HULL_PRICES: 4,000, 8,000, 100,000, 150,000, 200,000). */
export const SHIPYARD_HULLS = Object.freeze([0, 1, 2, 4, 3]);
/** The hulls sold as their parts (into the pack) - the Rowboat, as the shelf sold her; every other as her deed. */
export const PARTS_HULLS = Object.freeze([0]);
/** The counter's quality and price index - a yard's (systems/merchantYards.js). */
export const SHIPYARD_QUALITY = YARD_QUALITY;
export const SHIPYARD_PRICE_INDEX = YARD_PRICE_INDEX;
/** A ship sold back: the share of her refits' gold her worth keeps, and the share of her worth a wreck keeps (a whole
 *  hull all of it, a wreck SALE_FLOOR of it - between, by her hull's share). */
export const REFIT_RESALE = 0.5;
export const SALE_FLOOR = 0.6;

/** What the shipmaster says of each hull, by Come Sail Away's hull (the port's own ships where they stand in: Mac's
 *  Tiny Ship, galleon and carrack - Come-Sail-Away.md GALLEON, SHIPS-2). */
export const HULL_LINES = Object.freeze([
  'A rowboat with a pair of oars and room for two. Sold as parts: launch it from your pack anywhere there is water.',
  'A single-masted boat with a small cabin. Quick and easy to handle, with no crew to feed. The deed goes to your Fleet ledger.',
  'A galleon with two decks, ten gunports, a full crew and a captain\'s cabin.',
  'A great war galley with sixty oars, a ram on the bow and a huge crew. Too big for any quay.',
  'A three-masted carrack with high castles fore and aft, a deep hold and guns along its sides.',
]);

/** A ship's figures as the shipmaster gives them: her length and beam (m, her build as it stands), her crew whole and
 *  the named hands her deck stands at it (crewLife.js playerCrewCount), her guns (great guns and chasers - a stern's fire barrels apart), her hull and canvas. Pure. */
export function shipSpec(hull) {
  const b = hullBuild(hull);
  let guns = 0, barrels = false;
  for (const bt of batteriesOf(hull)) { if (bt.gun === 'barrel') barrels = true; else guns += bt.muzzles.length; }
  return {
    hull, name: HULL_NAMES[hull] ?? 'Boat', length: Math.round((b.bowZ - b.aftZ) * 10) / 10, beam: Math.round(b.halfWidth * 20) / 10,
    crew: b.crew, hands: playerCrewCount(hull, b.crew), guns, barrels, hullHp: b.hullHp, sailHp: b.sailHp, ram: !!b.ram,
    parts: PARTS_HULLS.includes(hull), price: HULL_PRICES[hull] ?? 0, line: HULL_LINES[hull] ?? '',
  };
}

/** One of the shipyard's ships, minted as the shelf minted her: the Rowboat's parts, any other's deed - variant I,
 *  at the hull's price, her number `uid` (the host's Come Sail Away UID). */
export const shipyardItem = (hull, uid) => (PARTS_HULLS.includes(hull) ? mintParts(hull, 0, uid) : mintDeed(hull, 0, uid, HULL_PRICES[hull]));

/** Whether an item is one of Come Sail Away's two - a ship's parts or her deed. */
export const isBoatItem = (it) => it?.templateIndex === BOAT_PARTS_TEMPLATE || it?.templateIndex === BOAT_DEED_TEMPLATE;

/** The gold her refits cost (systems/fleet.js upgradeCost, each tier she has of each line). Pure. */
export function refitGold(rec) {
  let gold = 0;
  for (const l of UPGRADE_LINES) {
    const tier = Math.max(0, Math.min(UPGRADE_TIERS, rec?.upgrades?.[l.id] | 0));
    for (let t = 0; t < tier; t++) gold += upgradeCost(rec.hull, l.id, t)?.gold ?? 0;
  }
  return gold;
}
/** HER WORTH SOLD BACK (gold, before the haggle): what she was bought for, half her refits' gold, by her hull's state -
 *  `hullShare` her hull against its whole (1 whole; a wreck 0). Pure. */
export function shipWorth(rec, hullShare = 1) {
  // AUDIT SHIPYARDS L1-2: never above what the yard asks for a new hull of hers - a record's worth is a save's word, and
  // past a few million the counter's 32-bit haggle (shopStock.js calculateTradePrice) turns an offer negative
  const whole = HULL_PRICES[rec?.hull] ?? 0;
  const value = Number.isFinite(rec?.value) ? Math.max(0, Math.min(whole || rec.value, rec.value)) : whole;
  const k = SALE_FLOOR + (1 - SALE_FLOOR) * Math.max(0, Math.min(1, Number.isFinite(hullShare) ? hullShare : 1));
  return Math.max(1, Math.round((value + refitGold(rec) * REFIT_RESALE) * k));
}

/** What the shipyard asks for a ship worth `value` - the counter's buying law at its quality and index, `skills` the
 *  buyer's live Mercantile and Personality. Pure. */
export function shipBuyPrice(value, skills) {
  const pieces = 1;   // a ship is one piece (FB0929's floor: a gold a piece)
  return getTradePrice('Buy', calculateCost(Math.max(0, value), SHIPYARD_QUALITY, SHIPYARD_PRICE_INDEX), SHIPYARD_QUALITY, skills, pieces);
}
/** What the shipyard pays for a ship of `worth` (shipWorth's) - the counter's selling law (online, half the least ask
 *  at most). Pure. */
export function shipSalePrice(worth, skills) {
  const pieces = 1;
  return Math.max(0, getTradePrice('Sell', calculateCost(Math.max(0, worth), SHIPYARD_QUALITY, SHIPYARD_PRICE_INDEX), SHIPYARD_QUALITY, skills, pieces));   // never a negative offer (AUDIT SHIPYARDS L1-2)
}

/**
 * WHY A SHIP CANNOT BE SOLD HERE, or null: `where` where she is (scenes/fleetHost.js whereIs - 'sailing', 'here',
 * 'laidup', 'away', 'packed'), `hold` the goods in her hold (her laid-up or packed cargo, or her own), `ashore` the hands of
 * hers at the player's side, `fighting` whether she is in a fight, `aboard` another player standing on her, `crossed`
 * whether she came into the realm through customs (systems/fleet.js fleetCrossed - kept, never sold). Pure.
 * @param {{ where: string, hold?: number, ashore?: number, fighting?: boolean, aboard?: number, atPort?: boolean, crossed?: boolean }} o
 */
export function saleRefusal({ where, hold = 0, ashore = 0, fighting = false, aboard = 0, atPort = true, crossed = false }) {
  if (!atPort) return SHIPYARD_TEXT.notPort;
  if (crossed) return SHIPYARD_TEXT.crossed;
  if (where === 'sailing') return 'Step away from the helm first.';
  if (where === 'away') return 'Bring the ship to this port first. The shipmaster buys only what he can see.';
  if (where !== 'here' && where !== 'laidup' && where !== 'packed') return 'No such ship of yours here.';
  if (fighting) return 'Not while the ship is in combat.';
  if (aboard > 0) return 'Another player is aboard.';
  if (ashore > 0) return 'Some of the crew are ashore with you. Send them back aboard first.';
  if (hold > 0) return 'Empty the hold first. The shipmaster does not buy cargo.';
  return null;
}

/** The shipyard's words. */
export const SHIPYARD_TEXT = Object.freeze({
  // AUDIT SHIPYARDS L7-4: a deed's ship is laid up at the yard until she is brought round - said, and the window turns
  // to Your fleet with her chosen; AUDIT SHIPYARDS L7-10: her parts are plural
  bought: (name, port) => `${name} is yours, laid up at ${port || 'this port'}. Press Bring here to have it brought to the quay.`,
  boughtParts: (name) => `${name} are in your pack. Use them by the water to launch the ship.`,
  heavy: (name) => `${name} weigh more than you can carry. Lighten your pack first.`,
  crossed: 'This ship came in through customs, so the shipmaster won\'t buy it. It stays yours.',
  sold: (name, gold) => `The shipmaster buys ${name} for ${Math.round(gold).toLocaleString('en-US')} gold.`,
  short: (gold) => `The shipmaster asks ${Math.round(gold).toLocaleString('en-US')} gold. You don't have enough.`,
  notPort: 'The shipmaster deals in ships at his own yard.',
  noSail: 'Turn on Come Sail Away in the mod settings and reload to buy a ship here.',   // AUDIT SHIPYARDS L7-11: the switch is read at a load
  steal: 'The shipmaster never takes an eye off his yard.',
});

export { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE };
