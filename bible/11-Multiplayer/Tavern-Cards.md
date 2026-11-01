# Tavern Cards

Every tavern has card tables. A player sits down, the camera moves to the seat, and the cards fly and settle on the
cloth. Three games share the table: Texas Hold'em, the house game; Iliac Hand, the port's own collectible card game;
and The King's Gambit (`Kings-Gambit.md`). Offline the tavern's regulars play; online the relay deals and other
players sit in the chairs. Cards are collected in play and kept in the Collections page's binder.

## How it works

**The tables** (`src/world/card/cardTableProp.js`, `src/world/placedCardTable.js`, `src/world/card/cardTables.js`).
The card table is a prop of its own; Daggerfall's tables are furniture. Every tavern stands `TAVERN_CARD_TABLES`: the
chips table first, on clear floor found by a walk from the entrance, then the gold table with its ring kept off the
first's. A spot is passed over when its table and ring would leave a walked cell unreachable; a room with no such spot
stands none. Seats stand round the table's own box at `SEAT_SPACING`, two to six (`HOLDEM_SEATS_MIN`,
`HOLDEM_SEATS_MAX`); a blocked seat is no seat.

**Sitting.** Activating a table offers its games. Seated, the camera is the seat's eye, movement is held, and the mouse
drives the hand and chips: hover lifts a card, a press peeks, a drag slides chips, a click checks and a push folds.
Leaving (activate, Escape, a hit) stands the player where they sat from. A seated peer is drawn seated in their chair
through `src/net/remotePlayers.js`; a spectator sees the board and the pot, never a hand.

**Card physics** (`src/world/card/cardMotion.js`, `src/world/card/cardScene.js`). A card is a thin plate drawn in the
room's pass. The physics is the picture, never the rules: the game's state says where a card belongs, and the flight
is seeded by the deal so every player sees the same card land in the same place.

**Hold'em** (`src/net/card/cardLaw.js`, `src/net/holdemTable.js`). No-limit, blinds from `HOLDEM_BBS`, two hole cards,
four betting rounds, side pots for an all-in. One pure evaluator, five-of-seven, read by both ends. A seat has
`HOLDEM_CLOCK_MS` to act, then checks or folds.

- Offline the regulars sit (`src/world/card/cardRegulars.js`, `src/systems/card/cardPatrons.js`), each with a purse and
  a temper (careful, reckless, sly); one who loses his purse leaves. Stakes are the player's own gold.
- Online the relay shuffles from its own CSPRNG, keeps the deck, tells each seat its own hole cards alone, and runs the
  turns. A seat whose player leaves folds.
- The gold table is the room's table at index `HOLDEM_GOLD_TABLE`; every other plays for chips. A realm character's
  buy-in (`HOLDEM_STAKE_MIN_BB` to `HOLDEM_STAKE_MAX_BB` big blinds) is escrowed by the account service
  (`server-account/src/cards.js` `stakeCards`, `/v1/cards/stake`), which answers a signed stake order the relay spends at
  the sit. Leaving pays a signed cash-out receipt (`src/net/card/cardReceipt.js`, `c1`) claimed at `/v1/cards/cashout`
  (`src/net/card/cardStakes.js`). A refused sit hands the whole stake back.

**Iliac Hand** (`src/net/iliac/iliacHand.js`, catalog `src/net/iliac/iliacCards.js`). Two players, decks of
`ILIAC_DECK_SIZE` (two copies of a card, one of a Legendary or rarer). Three holdings - places of the Iliac Bay - lie
between them. Magicka is the turn's number, to `ILIAC_MAGICKA_MAX`; a hand starts at `ILIAC_HAND_START`, draws one a
turn, to `ILIAC_HAND_MAX`; a side of a holding holds `ILIAC_ROOM` cards. Each turn both players commit hidden, then
reveal together, the one with more power first. After `ILIAC_TURNS` turns, whoever holds two of three holdings wins. A
card's text is data (`fx`), and its printed text is exactly what `fxText` says it does. A Prince's ongoing text rules
the board; a veiled holding hides cards played there until the end.

- Offline the regulars play (`src/systems/iliac/iliacPatrons.js`): decks by temper and the tavern's grade. Each side
  stakes a card for keeps; a loss leaves it with the regular, and a regular who loses can pay a card from his deck.
- Online the relay runs the table (`src/net/iliac/iliacTable.js`). A ranked seat's deck is vouched for by the service
  (`/v1/cards/deck`); the relay's signed result (`src/net/iliac/iliacReceipt.js`) is claimed at `/v1/iliac/claim` and
  ranks the player on a season board by the arena's Elo (`server-account/src/iliac.js`, `/v1/iliac/board`).

**Where cards come from** (`src/systems/card/cardSources.js`). A slain creature can drop its own card; tavern keepers
sell packs of five, the last rare or better, for gold earned in play (no paid packs); a guild quest can pay a guild's
card; the Oblivion Gate's boss, the Sea Serpent and the Abyss Dungeon's Brass Remnant drop their own at the aetheric tier
(`src/systems/bossCards.js`); a beaten regular pays in a card; and cards trade as any unbound item, with a worth
(`src/net/card/cardWorthLaw.js`).

**The binder** (`src/ui/collectionsPage.js`, `src/ui/card/cardBinderPage.js`). The Holdings rail's Collections page has
a Cards part beside the Codex; the cards are painted in code. The table's panels use the Enhanced Plus kit
(`src/ui/card/cardPanelKit.js`, `src/ui/card/cardTableHud.js`, `src/ui/iliacTableHud.js`).

## Rules

- The table lives in a tavern; a game is played seated, never from a menu (Mac).
- Detailed card physics, and other players' bodies seen at the table (Mac).
- A collectible game of our own, Iliac Hand, as proposed (Mac); Hold'em first, as the house game (Mac).
- Stakes are real gold (Mac); offline, tavern patrons play (Mac).
- One Collections tab; the collectible cards painted in code (Mac).
- A table prop of its own in every inn (the owner); two tables a tavern, one always gold for realm characters and one
  always chips for everyone (the owner).
- Cards come from foes, packs, guild quests, the world bosses and the Abyss Dungeon, winning and trading (Mac).
- The relay rolls: a deck or a result a client names is never believed.

## Daggerfall Unity

DFU has no card games; this is a departure (Ledger A, TAVERN CARDS). No seated pose existed; the seated body is the
port's own (`src/player/seatPose.js`).

## Code and tests

- `src/net/card/` - Hold'em's law, stakes, receipts, worth
- `src/net/holdemTable.js` - the relay's Hold'em table
- `src/net/iliac/` - Iliac Hand's rules, catalog, table, receipts, claims
- `src/world/card/` - the prop, seats, hand, motion, scene, regulars
- `src/world/placedCardTable.js` - where a tavern's tables stand
- `src/systems/card/`, `src/systems/iliac/` - sessions, patrons, sources, items
- `server-account/src/cards.js`, `server-account/src/iliac.js` - stakes, cash-outs, decks, the season board
- `test/world/fb1009c_walkwhole.test.js`, `test/world/fb1011e_wayround.test.js` - where the table stands
- `test/systems/loot/cards8_catalog.test.js` - each card's text is what it does
