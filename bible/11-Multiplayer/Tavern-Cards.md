# TAVERN CARDS - a card table in every tavern (CARDS0, the design record)

**Status: DESIGN RECORD, being built - CARDS1 SHIPPED (2026-10-07, section 10; Mac: "Do it"), CARDS2 SHIPPED (the same day, section 11; Mac: "Continue") - the seat, without the seated body (CARDS2b). Mac answered
four of section 9's five questions the same day; the card art is still open. Every DECIDED below binds the build
slices, and a slice that ships one records any change here first.**

## Mac's words

- Discord, #suggestions, "Card Games in Taverns" (2026-10-07, screenshot): Malarkey - "since the lead dev loves Pirates
  Online, this was my favorite activity after ship battles", then "Specifically Texas Hold'em"; maya - "yes please / i
  love poker so yk..."
- Mac, the same day: **"This is something id love to do as a meta game. Players being able to collect cards and
  particpate in our own unique card game."**
- **"I imagine actual detailed card physics, needing to be in a tavern and being set up in a sort of table enviroment
  where you can see other players sprites."**
- answering this record (section 9): the order **"Hold'em first"**; the collectible rules **"Iliac Hand as
  proposed"**; the stakes **"Real gold"**; offline play **"Yes, patrons play"**.

## How to read this page

| Mark | Meaning |
|---|---|
| **DECIDED (Mac)** | Mac's own word, quoted above. |
| **DECIDED** | The record's proposal. Binding on the build slices once Mac answers section 9; he may overrule any of it. |
| **FACT** | What the tree does today, read off the file named. |
| **MEASURE** | A number or an id this page cannot know yet; the named slice measures it before it builds on it. |

Not a DFU member, any of it: Daggerfall has no card games and Daggerfall Unity has none. Each slice that ships opens or
narrows its Ledger section A row (`01-Overview/Port-Ledger.md`), the way DICE1 and ARENA did.

## 1. The shape - two games, one table

- **DECIDED (Mac): the table lives in a tavern.** A game is played seated at a tavern table, never from a menu.
- **DECIDED (Mac): a collectible game of our own** - cards are collected in play and built into decks. This is the meta
  game: the long arc, the reason to come back.
- **DECIDED (Mac): Texas Hold'em ships first, as the house game.** It is what the thread asked for by name, it needs no
  collection, and it builds every seam the collectible game stands on - the table, the seat, the deal, the hidden hand,
  the card physics, the relay's shuffle - with rules nobody has to design. The collectible game then lands on a table
  that already works.
- Both games are played on the same table, with the same card bodies, the same seat and the same relay deal. A table
  says which game it is running when someone sits down first.

## 2. The table environment

- **FACT:** `src/world/buildingNames.js` keys the tavern (`BUILDING_TYPES.Tavern` 15, `isTavern`), and an interior is a
  presence room by building (`src/net/online.js`, `interior:${loc}.${layoutRoomKey(bk, layout)}`), so every player in
  one tavern already stands in one room and sees the others (`src/net/remotePlayers.js`).
- **MEASURE (CARDS2, still open):** which interior models in the tavern blocks are tables. The record does not guess
  model ids, and this container carries no ARENA2: CARDS2 ships the one id the tree can name (41130) and the census
  that names the rest (section 11).
- **DECIDED: a table is a card table if it is a table model in a tavern interior** with clear floor on at least two
  sides. No placed prop, no new mesh: the game finds the tables Daggerfall already put there. Two to six seats per
  table, set by its footprint (MEASURE: the seat spacing, from the table's size).
- **DECIDED: sitting.** Activating a card table offers its game; accepting puts the player in a SEAT. Seated, the
  camera moves to a fixed seat view over the table (the player's eyes at the seat, looking at the table's centre),
  movement is held, and the mouse drives the hand and the chips. Leaving the seat (the activate key, Escape, or a hit)
  stands the player back where they sat from. **FACT:** no seated pose exists in the characters today (grep for a sit
  pose in `src/characters/` finds none) - CARDS2 adds one for both bodies, sprite and Morrowind.
- **DECIDED (Mac): you see the other players.** A seated peer is drawn seated in their chair, through the same
  `remotePlayers.js` body every peer already has (sprite or Morrowind, whichever they wear), facing the table. Their
  face-down cards sit in front of them on the cloth; their chips stack beside them.
- **DECIDED: spectators.** A player standing near a table sees the community cards and the pot, never a hand. A
  spectator can take an empty seat between hands.

## 3. Card physics

- **DECIDED (Mac): actual detailed card physics.** A card is a body: a thin rigid plate (63 x 88 mm, the poker size, a
  quarter millimetre thick) with a front, a back and an edge, drawn by the WebGL2 renderer as its own pass.
- **DECIDED: the physics is the picture, never the rules.** What a card IS (whose, face up or down, which card) is the
  game's state, settled by the law in section 5. The physics only decides how it gets there: a dealt card flies on an
  arc, spins, lands, slides on the cloth's friction and settles; a flipped card turns over its long edge; a mucked hand
  is pushed to the centre; a shuffle riffles in the dealer's hands. A card that settles somewhere odd still belongs
  where the law says, and the next frame of state wins.
- **DECIDED: deterministic per deal.** The throw's start, velocity and spin come from the deal's own seed, so every
  player at the table sees the same card land in the same place - the room's picture, not each client's own.
- **DECIDED: the player's own hand** is held up in the seat view, fanned, and can be peeked (lifted at the corner) or
  squeezed. Mouse over a card lifts it; a drag slides chips into the pot; a click on the cards checks, a push folds.
- **MEASURE (CARDS3):** the frame cost. Fifty-two plates and a few dozen chips is small, but the interior frame is
  already measured against phones; the slice reports the cost on the probe before it ships.

## 4. Texas Hold'em, the house game

- No-limit Texas Hold'em, two to six seats, the standard rules: blinds, two hole cards, the flop, the turn, the river,
  four betting rounds, the showdown, side pots for an all-in.
- **DECIDED: the hand evaluator is one pure module** (`net/cardLaw.js` or its name at CARDS1), read by both ends like
  `net/dice.js` is: five-of-seven best hand, every category from high card to the straight flush, the wheel (A-2-3-4-5),
  ties split by kicker, side pots by contribution. Its pins are deepEqual against hand-written tables, mutation-checked.
- **DECIDED (Mac): stakes are gold.** Offline, the player's own purse. Online, see section 5.
- **DECIDED (Mac): offline, tavern patrons play.** Sitting at a table with nobody there seats one to five patrons from the
  tavern's own crowd, each with a purse and a temperament (tight, loose, a bluffer). They are this game's NPCs, not
  DFU's: their talk and their money are the table's, never a quest's. A patron who loses his purse leaves the table.

## 5. Online: the relay deals

- **FACT:** the relay already rolls dice from its own CSPRNG and refuses a client's number (`net/dice.js`, DICE1: "THE
  RELAY ROLLS"), and the trade is already a two-sided state machine whose confirmed offer is what each side gets
  (`net/tradeSession.js`, TRADE1).
- **DECIDED: the relay shuffles.** A deck said by a client is a deck the client chose. The relay shuffles from its own
  CSPRNG (an unbiased Fisher-Yates over rejection-sampled draws, the dice's own law), keeps the deck, and tells each
  seat its own hole cards ONLY - a frame addressed to one player, never to the room. The community cards go to the
  room as they turn. At the showdown, the hands still in are told to everyone. A folded hand is never told.
- **DECIDED: the relay runs the table.** Whose turn, the legal actions, the pot and the side pots are the relay's;
  a client asks (`bet`, `call`, `check`, `fold`, `raise`) and the relay answers with the new state. A seat that does not
  act in its time (MEASURE: 30 s) is checked if it can be, folded if not. A seat whose player leaves the room folds and
  is stood up at the hand's end.
- **FACT:** a realm character's gold moves on its save through the service (`net/realmGoldLaw.js`, REALM P2.2, read by
  `server-account/src/realm.js`). **DECIDED: online stakes are escrowed there.** Sitting down moves the buy-in from the
  character to the table; standing up moves the stack back. A stake the service does not hold is a stake nobody can
  enforce, so a character the service does not keep plays for no gold (a friendly table).
- **DECIDED: the physics seed travels with the deal** (section 3), so the room sees one picture.

## 6. The collectible game (the meta game)

**DECIDED (Mac): "Iliac Hand as proposed".** The rules below were the record's proposal; Mac took them as written.
Their numbers (deck size, turn count, magicka cap) are MEASURE until CARDS7 plays them against patrons and reports.

### 6.1 The game - "Iliac Hand" (working name)

- Two players. Each brings a deck of 30 cards (at most two of one card, one of a legendary).
- **Three holdings** lie between them - three location cards drawn from the Iliac Bay (Daggerfall, Sentinel and
  Wayrest at first; every region of the map in time). Each turn a player plays cards to their side of a holding.
- **Magicka** pays for cards: one on the first turn, one more each turn, to ten.
- **Unit cards** have a power. **Spell cards** change power, move units, or destroy. **Prince cards** (legendary) are a
  Daedric Prince's rule over the whole board for as long as they stand.
- After six turns, a player holds a holding if their power there is higher. **Hold two of three to win.** A location's
  own text bends its holding (Sentinel's sun, Wayrest's walls, a dungeon's darkness).
- It is short (six turns, four to six minutes), so a tavern evening holds several games, and it has no life total to
  grind down - it is a game of where to commit, which reads well across a table.

### 6.2 The cards

- Drawn from Daggerfall itself: the creatures (a rat, a skeletal warrior, a vampire ancient), the guilds and the
  temples, the knightly orders, the provinces, the Daedric Princes, the artifacts. Every card names the thing it
  pictures, and its power and text follow from what that thing is in the game (a Lich outranks an Orc).
- **DECIDED: rarity is the loot's.** A card carries a tier of `RARITY_ORDER` (`src/systems/lootRarity.js`: common,
  magic, rare, legendary, aetheric, artifact) and draws with that tier's treatment, the way an item does.
- **DECIDED: the art is ours.** A card's picture can never be an ARENA2 sprite or a render of one (Port-Doctrine, "A
  RENDER OF GAME DATA IS GAME DATA"). MEASURE: who paints them, and in what style - section 9.

### 6.3 Collecting

- **DECIDED: a card is an item.** It sits in the pack, weighs nothing, stacks, and is kept in a **Card Binder** (an
  item like the Wallet, `06-Systems/Wallet.md`) that holds the collection and the decks.
- Where cards come from:
  - **Foes.** A slain creature can drop its own card (a rare draw; MEASURE: the rate). A rat drops a rat.
  - **Tavern keepers** sell packs (five cards, one rare or better).
  - **Quests and bosses.** A guild's quest can pay a card of that guild; the Oblivion Gate's boss and the Sea Serpent
    can drop their own, at the aetheric tier.
  - **Winning.** A tavern regular who loses to you can pay in a card from his deck.
  - **Trading.** The trade (`net/tradeSession.js`) and the market (`net/marketLaw.js`) take cards like any item.
- **DECIDED: a starter deck** comes with the first binder, so a new player can sit down at once.

### 6.4 Playing it

- At the same tavern table, seated the same way. Offline against a patron who has a deck of his own (a deck per
  temperament, growing harder with the tavern's town). Online against another player, the relay running the game
  exactly as it runs Hold'em - hidden hands, its own shuffle, its own clock.
- **DECIDED: a ladder.** Online wins rank a player on a season board, the Arena's way (`11-Multiplayer/Arena.md`), with a
  title for the top of it.

## 7. What the record refuses

- **No card game from a menu.** The table is the game (Mac: "needing to be in a tavern").
- **No client-dealt card online, ever.** The relay shuffles, or nobody plays.
- **No card art from ARENA2.**
- **No paid packs.** A pack costs gold earned in the game.

## 8. The slices

Each ships alone and is verifiable without the next.

| Slice | What it builds |
|---|---|
| **CARDS1** SHIPPED | The deck law, pure and DOM-free, one home for both ends: the 52-card deck, the unbiased shuffle, the Hold'em evaluator, the betting round's state machine, side pots. Pins deepEqual against hand tables; mutants. |
| **CARDS2** SHIPPED | The table and the seat: a tavern's own table (the one nameable id, and the census for the rest), its seats, the seat view, held movement, standing up. Offline, alone at the table. |
| **CARDS2b** | The seated pose for both bodies (sprite and Morrowind), the body moved to its seat, peers drawn seated (a pose field on the wire, so a RELAY_VERSION), a hit standing you up, Escape. |
| **CARDS3** | The card bodies: the plate, the pass, the deal arcs, the flip, the slide and settle, the fanned hand and the peek, the chips. Frame cost measured on the probe. |
| **CARDS4** | Offline Hold'em: the patrons, their temperaments and purses, gold stakes. The first playable game. |
| **CARDS5** | Online Hold'em: the relay deals and runs the table, hidden hands, spectators, the seat clock. Friendly tables. |
| **CARDS6** | Online stakes: buy-in and cash-out escrowed by the realm service. |
| **CARDS7** | The collectible game's rules engine (Iliac Hand or Mac's design), pure, both ends. |
| **CARDS8** | The catalog and the art pipeline: the first set of cards, the Card Binder, the starter deck, the deckbuilder window. |
| **CARDS9** | Collecting: foe drops, tavern packs, quest and boss cards, cards in the trade and the market. |
| **CARDS10** | Iliac Hand at the table, offline against patrons and online through the relay; the season ladder. |

## 9. Questions for Mac (four answered 2026-10-07)

1. **The order.** ANSWERED: Hold'em first.
2. **The collectible game's rules.** ANSWERED: Iliac Hand as proposed.
3. **Gold stakes.** ANSWERED: real gold (offline the purse, online escrowed).
4. **Offline play.** ANSWERED: tavern patrons play.
5. **The card art.** OPEN: who paints the cards, and in what style? Needed by CARDS8, not before.

## 10. CARDS1 (2026-10-07): the cards' law

Mac, after CARDS0's answers: **"Do it"**.

`src/net/cardLaw.js` - pure, DOM-free, one home for both ends, the way `net/dice.js` is the dice's. Nothing draws, sits
or deals yet; the relay (CARDS5) and the patrons (CARDS4) will read it.

- **The card** is an integer 0..51 - rank `c % 13` (the deuce 0 .. the ace 12), suit `Math.floor(c / 13)` (clubs,
  diamonds, hearts, spades) - and is written `As`, `Td`, `2c` (`cardText`, `parseCard`).
- **The shuffle** (`shuffleDeck`) is Fisher-Yates from the top, each swap partner drawn from 0..i by the dice's own
  unbiased draw. ONE HOME: the rejection sample that lived inside `rollDice` is now `drawBelow(m, rand32)` in
  `net/dice.js`, `rollDice` and `shuffleDeck` both call it, and the test sweeps `cardLaw.js` for a second `2 ** 32`.
  The two dice mutants on those lines (`DC-rejection-dropped`, `DC-face-off-by-one`) were re-aimed by content and
  still die (31 of 31). `net/dice.js` is relay law, so its bytes moved the relay's hash: `world175` (TEXT-F1, NOT YET
  DEPLOYED) was re-hashed in place in `test/relayversion.test.js`, the way AUDIT 657 and LEGACY7 re-hashed undeployed
  rows - no roll changed, so no new version.
- **The hand's rank** (`rankFive`, `bestHand`, `compareHands`): nine categories, each with its tie-break ranks, the
  wheel topped by its five, no straight round the corner, the best five of seven by trying all twenty-one.
- **The pots** (`sidePots`): a layer per level some seat put in, contested by the seats still in that reached it; a
  layer the same seats contest as the one below joins it, so a folded blind is chips in a pot and never a pot; an
  uncalled bet is a top layer only its owner contests, so it goes home.
- **The hand** (`newHand`, `legalActions`, `act`, `timeoutAction`, `viewFor`): No-Limit Hold'em as a casino deals
  it. Heads-up the button posts the small blind and acts first before the flop, last after it. The deal is one card
  at a time from the seat left of the button; a burn before each street. A short big blind is still a full big blind
  to call. The minimum raise is the last full raise and resets to the big blind each street. A seat that already acted
  may raise again only when the raising since its action adds up to a full raise - so one short all-in does not
  re-open the betting and two that add up do. A seat with nobody left to bet against is never asked to act unless it
  faces a bet; the board then runs out. At the showdown each pot goes to its best hand, a split's odd chips one each
  from the seat left of the button; a hand won uncontested shows nothing. Every step returns a NEW state - a refused
  action is `null` and changes nothing, which is what lets a relay keep the last good one. `viewFor` is what a seat
  may see: its own hole cards, another's only shown down and still in, never the deck or the burns.
- **Pins:** `test/cards1_cardlaw.test.js`, 14 tests, deepEqual against hand tables and whole hands played through.
  `tools/mutants/cards1.json`: 40 mutants, 40 dead. Two survived the first pass - `parseCard` reading a capital suit,
  and the minimum bet carried from one street to the next - and each was pinned.
- **Ledger:** section A row TAVERN CARDS - THE CARDS' LAW.

## 11. CARDS2 (2026-10-07): the table and the seat

Mac: **"Continue"**.

- **The table** (`src/world/cardTables.js`, pure). A card table is a table model a tavern already stands - no placed
  prop. FLAGGED: `CARD_TABLE_MODELS` holds the ONE id the tree can name as a table, 41130 ("Table" in the vendored
  World of Daggerfall's `LocationHelper.cs` model list; 41100 is a chair there, though two of our tests' fixtures call
  it a table). This container carries no ARENA2, so the tavern blocks' other tables could not be measured. The census
  measures them: `node tools/cardTableCensus.mjs <arena2 folder>` lists every prop in the furniture range (41000-43999)
  the tavern interiors stand, how often, in how many blocks, and its size in metres - the ids whose size reads as a
  table go into the set, and the flag retires.
- **The seats.** Round the table's world box on the floor it stands on: along each side as many as fit at 0.75 m (one
  on a side of 0.6 m or more), 0.45 m out from the edge, in a fixed order (+x, -x, +z, -z). A seat is kept when the
  host's probe finds nothing of the room between the table's middle and the seat's eye, and something to sit over
  under it - the floor, a chair, a bench, never a table's top or the air. At most six, taken round the sides in turn;
  fewer than two kept and the table is no card table. Every length is MEASURE: they are a person's, not Daggerfall's.
- **The seat** (`scenes/worldModes.js`, the interior host). In a tavern, a card table that seats two is an activation
  target (`cardtable:i`, struck at its surface as a bed is, the default reach, the hover word "Card table"). The press
  seats the player at the nearest free seat: the eye moves to a seated eye (1.15 m) looking at the table's middle and
  the view stays first person. The body is given nothing to walk with: the press again, a move key, a jump, the
  stick's throw or the autorun latch stands them up first, so the motor runs on unheld and gravity and the crouch edge
  stay DFU's. (The paralysis bag was the first thought; AUDIT 39's pin holds its text in all four hosts, and a seat is
  not a paralysis - `player.paralyzed` feeds the rig.) The room's end empties the seat. The body stays where it
  stood: moving it, and drawing it seated, is CARDS2b.
- **THE FOUR HOSTS.** `scenes/worldModes.js` (interiors): WIRED. `scenes/exterior.js`, `scenes/world.js`,
  `scenes/dungeonContext.js`: no tavern table stands in them, so no seat - pinned (the test sweeps them for the seat's
  key). The `?interior` viewer (`scenes/interior.js`) flies a camera and has no body to seat.
- **Not verified in a live tavern.** No ARENA2 here, so no browser probe reached a tavern: the seat is pinned by its
  law and by source. The first eye on it is Mac's, with the census.
- **Pins:** `test/cards2_seat.test.js`, 8 tests. `tools/mutants/cards2.json`: 38, 38 dead; the one first-pass
  survivor was a finite guard the upper bound already made, and it was deleted rather than pinned.
- **Ledger:** section A row TAVERN CARDS, narrowed to say CARDS2 landed and CARDS2b is open.
