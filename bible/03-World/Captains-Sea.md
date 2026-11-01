# The Captain's Sea

Reasons to sail: a crew that grows with its ship, a captain's log and standing with each crown, rewards for a boarding
beaten off, letters of marque, richer deep waters, the spyglass, the harbourmaster's board, a trade exchange (crew
included) and treasure charts. The player meets it at every port's harbour office and at sea. The Eltheric Ocean is its
own page (`Eltheric-Ocean.md`).

## How it works

- **A hand's service** (`src/systems/naval/shipCrew.js`). Every hand's fights and boardings (boardings count twice) rank
  him Green, Seasoned, Veteran or Old Salt (`VETERANCY`). Each of six posts (Gunner, Carpenter, Lookout, Cook, Bosun,
  First Mate) does one thing more by the rank of its best holder aboard (`POST_WORTH`, `crewWorth`).
- **The log and standing** (`src/systems/naval/captainLedger.js`, shown on `src/ui/captainPage.js`). Leagues sailed,
  the deepest water, ships sunk, taken and beaten off, prizes, plunder, contracts; a standing with each crown ranked
  Unsworn to Admiral (`CROWN_RANKS`), each rank bringing favours in that crown's harbours (`RANK_PERKS`): the
  shipwright's prices, the board's pay and offers, the letter of marque, the Admiralty's ship and seasoned hands.
- **Paid dead ends** (`src/systems/naval/navalLaw.js` `PIRATE_REWARD`). A pirate boarding beaten off is rewarded and
  logged.
- **Letter of marque** (`marque`, `setMarque`, `tearMarque`). A crown's letter makes a rival crown's lawful ships its
  prizes for its term: no grievance or witnesses of the signer's, standing with the signer for each. The rival still
  names it Piracy. Striking the signer's own ship tears it up.
- **Deep waters** (`src/systems/naval/navalDirector.js` `watersOf`). From `DEEP_PX` (12) map pixels off every port,
  pirates are more likely, bolder and higher level, and holds and casks richer.
- **The spyglass** (`src/systems/naval/shipKnowledge.js`, `src/ui/spyglassView.js`). No name over an unknown hull. Her
  colours and name are learned by the eye, a Lookout, the glass or her guns; the rest through the glass up close. A
  pirate may fly false colours.
- **The harbourmaster's board** (`src/systems/naval/harbourBoard.js`, `src/scenes/harbourOffice.js`). Contracts posted
  daily off the port's key and the world's day, the same for every client: a bounty on a named pirate, a hunt, a
  delivery to another port, a salvage of a sunk merchantman's casks, and the Admiralty's survey through the glass. The
  office also sells the letter of marque and the Admiralty's carrack.
- **The exchange** (`src/systems/naval/tradeGoods.js`). Eleven goods: eight of the Bay (wine, grain, wool, iron, spices,
  silk, silver, ivory) and the Eltheric Ocean's three (ether-amber, starglass, voidsilk). Each crown's ports make some
  and want others, each port twists by one good, prices drift daily the same for every client, with a spread and a
  day's stock. Goods go into the hold. Sailors are also priced as a good (`src/systems/naval/crewTrade.js`): signed onto
  the ship at the quay and off her by the head.
- **Treasure charts** (`src/systems/naval/treasureCharts.js`). Now and then a chart among a pirate's papers, read and
  marked, its cache floated and raised.

## Rules

- Make the naval experience rewarding and deep without overcomplicating it; replace observable ship names with a
  spyglass that shows allegiance, cargo and more; add an open sea map to reach the Eltheric Ocean (the owner).
- Where the game has a law it is used: a hold is still DFU's loot roll (only its rarity tier moves), Piracy is still
  `Crimes.Piracy` through LowerRepForCrime, gold is gold pieces.
- A port past the Bay keeps the nearest Bay crown's office (`src/systems/naval/navalShips.js` `crownOf` over the three
  capitals): board, contracts in that crown's standing, letter of marque, carrack, favours, and that crown's trade with
  its own twist (the owner: every gap past the Bay addressed). The Eltheric freeports stay crownless with their own
  harbourmaster.
- Only the world host stands the sea. The glass comes down at a door; the Captain page is the pause menu's anywhere.

## Daggerfall Unity

Daggerfall has no sea fight. Veterancy, crown standing, letters of marque and the spyglass are the port's own departure
(CAPTAIN'S SEA).

## Code and tests

- `src/systems/naval/shipCrew.js`, `captainLedger.js`, `navalDirector.js`, `shipKnowledge.js`, `harbourBoard.js`,
  `tradeGoods.js`, `crewTrade.js`, `treasureCharts.js` - the laws
- `src/scenes/harbourOffice.js` - the board, exchange and crew deals; `src/ui/captainPage.js` - the Captain page
- `test/systems/naval/captcrew.test.js`, `captlog.test.js`, `captwaters.test.js`, `spyglass.test.js`,
  `captboard.test.js`, `capttrade.test.js`, `crewtrade.test.js`, `auditcaptsea.test.js`
- `test/world/worldWide/bayleftsea_harbour.test.js` - a harbourmaster at every port past the Bay
