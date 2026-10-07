# TAVERN CARDS - a card table in every tavern (CARDS0, the design record)

**Status: DESIGN RECORD, written before a line of it is built (2026-10-07). Nothing here ships yet. The questions in
section 9 are Mac's to answer; until he does, every DECIDED below is the record's proposal, and a slice that ships one
records any change here first.**

## Mac's words

- Discord, #suggestions, "Card Games in Taverns" (2026-10-07, screenshot): Malarkey - "since the lead dev loves Pirates
  Online, this was my favorite activity after ship battles", then "Specifically Texas Hold'em"; maya - "yes please / i
  love poker so yk..."
- Mac, the same day: **"This is something id love to do as a meta game. Players being able to collect cards and
  particpate in our own unique card game."**
- **"I imagine actual detailed card physics, needing to be in a tavern and being set up in a sort of table enviroment
  where you can see other players sprites."**

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
- **DECIDED: Texas Hold'em ships first, as the house game.** It is what the thread asked for by name, it needs no
  collection, and it builds every seam the collectible game stands on - the table, the seat, the deal, the hidden hand,
  the card physics, the relay's shuffle - with rules nobody has to design. The collectible game then lands on a table
  that already works.
- Both games are played on the same table, with the same card bodies, the same seat and the same relay deal. A table
  says which game it is running when someone sits down first.

## 2. The table environment

- **FACT:** `src/world/buildingNames.js` keys the tavern (`BUILDING_TYPES.Tavern` 15, `isTavern`), and an interior is a
  presence room by building (`src/net/online.js`, `interior:${loc}.${layoutRoomKey(bk, layout)}`), so every player in
  one tavern already stands in one room and sees the others (`src/net/remotePlayers.js`).
- **MEASURE (CARDS2):** which interior models in the tavern blocks are tables, and their top's height and footprint.
  The record does not guess model ids. The slice reads them off the tavern interiors' RMB records and lists them here.
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
- **DECIDED: stakes are gold.** Offline, the player's own purse. Online, see section 5.
- **DECIDED: offline, tavern patrons play.** Sitting at a table with nobody there seats one to five patrons from the
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

The rules below are the record's PROPOSAL, written so Mac has something concrete to cut. Section 9 asks whether he
wants this, his own design, or a design pass of its own before any of it is built.

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
| **CARDS1** | The deck law, pure and DOM-free, one home for both ends: the 52-card deck, the unbiased shuffle, the Hold'em evaluator, the betting round's state machine, side pots. Pins deepEqual against hand tables; mutants. |
| **CARDS2** | The table: tavern table models measured and listed here, the seat (activation, the seat view, held movement, standing up), the seated pose for both bodies, peers drawn seated. Offline, alone at the table. |
| **CARDS3** | The card bodies: the plate, the pass, the deal arcs, the flip, the slide and settle, the fanned hand and the peek, the chips. Frame cost measured on the probe. |
| **CARDS4** | Offline Hold'em: the patrons, their temperaments and purses, gold stakes. The first playable game. |
| **CARDS5** | Online Hold'em: the relay deals and runs the table, hidden hands, spectators, the seat clock. Friendly tables. |
| **CARDS6** | Online stakes: buy-in and cash-out escrowed by the realm service. |
| **CARDS7** | The collectible game's rules engine (Iliac Hand or Mac's design), pure, both ends. |
| **CARDS8** | The catalog and the art pipeline: the first set of cards, the Card Binder, the starter deck, the deckbuilder window. |
| **CARDS9** | Collecting: foe drops, tavern packs, quest and boss cards, cards in the trade and the market. |
| **CARDS10** | Iliac Hand at the table, offline against patrons and online through the relay; the season ladder. |

## 9. Open questions for Mac

1. **The order.** Hold'em first, then the collectible game on the same table (the record's proposal) - or the
   collectible game first?
2. **The collectible game's rules.** Iliac Hand as written in section 6, your own design, or a design pass of its own
   before CARDS7?
3. **Gold stakes.** Real gold at the table (offline the purse, online escrowed) - or chips that buy nothing?
4. **Offline play.** Tavern patrons as opponents (the record's proposal) - or online only?
5. **The card art.** Who paints the cards, and in what style?
