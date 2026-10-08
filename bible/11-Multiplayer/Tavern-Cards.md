# TAVERN CARDS - a card table in every tavern (CARDS0, the design record)

**Status: DESIGN RECORD, being built - CARDS1 SHIPPED (2026-10-07, section 10; Mac: "Do it"), CARDS2 SHIPPED (the same day, section 11; Mac: "Continue"), CARDS2b SHIPPED (section 12; Mac: "Continue") - the seated Morrowind body, the others' to see, on relay world176; AUDIT CARDS over all of it the same day (section 13, `01-Overview/Audit-Cards.md`); CARDS4 SHIPPED (section 14) and CARDS3 SHIPPED (section 15) together (Mac: "Do 3 and 4") - offline Hold'em against the tavern's regulars for gold, the cards and chips on the cloth; AUDIT CARDS-2 over all of it (section 16, `01-Overview/Audit-Cards-2.md`; Mac: "Perfection"); then (Mac: "Do 3 4 and 5") CARDS5 SHIPPED (section 17, the relay deals - online Hold'em between players, friendly), CARDS4b (section 18, the regulars seated in their chairs) and CARDS3b (section 19, the held hand, the peek, the chips dragged, the riffle); then (Mac: "I wanna do a deep comprehensive of everything and give the cards daggerfall especially themes") AUDIT CARDS-3 over all of it (section 20, `01-Overview/Audit-Cards-3.md`) and CARDS-BAY SHIPPED (section 21, the deck of the Iliac Bay); then (Mac: "#2 and cleanup") CARDS-TIDY (section 22) and CARDS6 SHIPPED (section 23, gold tables online - the stakes escrowed by the realm service); then (Mac: "2 and 3") AUDIT CARDS-4 over them (section 25, `01-Overview/Audit-Cards-4.md`) and CARDS6b SHIPPED (section 24, the top-up and gold owed elsewhere); then (Mac: "So what about card collections?") the Holdings rail's COLLECTIONS page, CARDS7 SHIPPED (Iliac Hand's rules) and CARDS8 SHIPPED (the first set, its painted faces, the Card Binder and the starter deck) - section 26. Mac answered
four of section 9's five questions the same day, and the house deck's art (Q5) on 2026-10-08; the collectible cards' art is still open. Every DECIDED below binds the build
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
- Mac, 2026-10-08: **"So what about card collections? I think we add a new tab in holdings for the weapon codex and card
  collection"**; asked, he answered: **"One 'Collections' tab"** (a Codex | Cards switch on one Holdings entry), the
  collectible cards **"Painted in code"**, and the scope **"Tab + CARDS7 + CARDS8"** (section 26).

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
  stands the player back where they sat from. **FACT:** no seated pose existed in the characters (grep for a sit
  pose in `src/characters/` found none) - CARDS2b poses the Morrowind body (section 12); the sprite lane has no sitting
  art and is CARDS2c.
- **DECIDED (Mac): you see the other players.** A seated peer is drawn seated in their chair, through the same
  `remotePlayers.js` body every peer already has (sprite or Morrowind, whichever they wear), facing the table. Their
  face-down cards sit in front of them on the cloth; their chips stack beside them.
- **DECIDED: spectators.** A player standing near a table sees the community cards and the pot, never a hand. A
  spectator can take an empty seat between hands.

## 3. Card physics

- **DECIDED (Mac): actual detailed card physics.** A card is a body: a thin rigid plate (63 x 88 mm, the poker size, a
  quarter millimetre thick) with a front, a back and an edge, drawn by the WebGL2 renderer as its own pass.
  **AS BUILT (CARDS3, recorded at AUDIT CARDS-2):** drawn a millimetre thick (`CARD_T`, so the cloth never shows
  through), and in the room's own pass after the decor (`drawMesh`, no pass of its own) - section 15.
- **DECIDED: the physics is the picture, never the rules.** What a card IS (whose, face up or down, which card) is the
  game's state, settled by the law in section 5. The physics only decides how it gets there: a dealt card flies on an
  arc, spins, lands, slides on the cloth's friction and settles; a flipped card turns over its long edge; a mucked hand
  is pushed to the centre; a shuffle riffles in the dealer's hands. A card that settles somewhere odd still belongs
  where the law says, and the next frame of state wins.
- **DECIDED: deterministic per deal.** The throw's start, velocity and spin come from the deal's own seed, so every
  player at the table sees the same card land in the same place - the room's picture, not each client's own.
- **DECIDED: the player's own hand** is held up in the seat view, fanned, and can be peeked (lifted at the corner) or
  squeezed. Mouse over a card lifts it; a drag slides chips into the pot; a click on the cards checks, a push folds.
  **BUILT at CARDS3b (section 19):** the hand held up and fanned in the seat view, the peek (the cursor over it, or a
  press held on it), a drag of chips from the stack into the betting ground. **NOT BUILT:** the squeeze, a click on the
  cards to check and a push to fold - the panel's buttons do both.
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
  enforce, so a character the service does not keep plays for no gold (a friendly table). BUILT: CARDS6 (section 23).
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
  RENDER OF GAME DATA IS GAME DATA"). ANSWERED (section 9 Q5): painted in code (section 26).

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
- **No client-dealt card online, ever.** The relay shuffles, or nobody plays. **Between players** (AUDIT CARDS-2,
  reconciling CARDS4): a patrons' table online is one player's own, nobody else's cards are dealt there and no gold
  moves (section 14's friendly game) - the refusal is of a table players share, which only the relay deals (CARDS5).
- **No card art from ARENA2.**
- **No paid packs.** A pack costs gold earned in the game.

## 8. The slices

Each ships alone and is verifiable without the next.

| Slice | What it builds |
|---|---|
| **CARDS1** SHIPPED | The deck law, pure and DOM-free, one home for both ends: the 52-card deck, the unbiased shuffle, the Hold'em evaluator, the betting round's state machine, side pots. Pins deepEqual against hand tables; mutants. |
| **CARDS2** SHIPPED | The table and the seat: a tavern's own table (the one nameable id, and the census for the rest), its seats, the seat view, held movement, standing up. Offline, alone at the table. |
| **CARDS2b** SHIPPED | The body drawn at its seat, the Morrowind body posed seated (the climb rig's solver), peers drawn seated (`st` on the pose, relay world176), a hit and Escape standing you up. |
| **CARDS2c** | The sprite lane seated: Eye Of The Beholder has no sitting art, so a sprite body stands at its seat today. |
| **CARDS3** SHIPPED | The card bodies: the plate, the deal arcs, the flip, the slide and settle, the fold to the muck, the chips and the pot's push - drawn in the room's pass, seen in the lab's probe (section 15); CARDS3b the held hand, the peek, the chips dragged, the riffle (section 19). OPEN: the squeeze, the frame cost measured on a phone. |
| **CARDS-BAY** SHIPPED | The house deck of the Iliac Bay: the four crowns as the suits, their royals as the courts, their seals as the aces, the Bay's medallion on the back - painted in code, ours (section 21). |
| **CARDS4** SHIPPED | Offline Hold'em: the patrons, their temperaments and purses, gold stakes. The first playable game. |
| **CARDS5** SHIPPED | Online Hold'em: the relay deals and runs the table, hidden hands, spectators, the seat clock. Friendly tables (section 17). |
| **CARDS6** SHIPPED | Online stakes: buy-in and cash-out escrowed by the realm service (section 23). |
| **CARDS7** | The collectible game's rules engine (Iliac Hand or Mac's design), pure, both ends. SHIPPED 2026-10-08 (section 26). |
| **CARDS8** | The catalog and the art pipeline: the first set of cards, the Card Binder, the starter deck, the deckbuilder window. SHIPPED 2026-10-08 (section 26): the deck builder is the Holdings rail's Collections page. |
| **CARDS9** | Collecting: foe drops, tavern packs, quest and boss cards, cards in the trade and the market. |
| **CARDS10** | Iliac Hand at the table, offline against patrons and online through the relay; the season ladder. |

## 9. Questions for Mac (four answered 2026-10-07)

1. **The order.** ANSWERED: Hold'em first.
2. **The collectible game's rules.** ANSWERED: Iliac Hand as proposed.
3. **Gold stakes.** ANSWERED: real gold (offline the purse, online escrowed).
4. **Offline play.** ANSWERED: tavern patrons play.
5. **The card art.** ANSWERED for the house deck (2026-10-08, Mac: "give the cards daggerfall especially themes instead of
   the simple hearts queens and kings"; then, asked: the suits the Iliac Bay's kingdoms, the courts their royals, the ace
   the crown's seal): the Hold'em deck is the Bay's, painted in code from paths (section 21). ANSWERED for the
   collectible cards (2026-10-08, asked with CARDS8): **"Painted in code"** - each card a framed emblem of what it
   pictures in its tier's colours, our own paths (section 26).

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
  still die (31 of 31). `net/dice.js` is relay law, so its bytes moved the relay's hash. **AUDIT CARDS C1 corrected
  this record:** CARDS1 re-hashed `world175` in place calling it undeployed - it was LIVE (the relay's `/health`
  answered world175; relay-deploy.yml deploys every push to main that moves RELAY_VERSION), so its row was restored
  byte for byte and the lift rides world176, CARDS2b's version.
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
- **Ledger:** section A row TAVERN CARDS, narrowed to say CARDS2 landed and CARDS2b is open (CARDS2b landed after
  it; section 12). Superseded since: the seated eye is 1.22 m (CARDS2b, the seated head's), the seats stand 0.35 m
  out, square to their side and round the table's own box, and "the nearest free seat" counts the others' (AUDIT
  CARDS, section 13).

## 12. CARDS2b (2026-10-07): the seated body

Mac: **"Continue"**.

- **The request** (`src/player/seatPose.js`, pure). Morrowind has no sitting animation, so the seat is posed the way
  CLIMB6 poses a climb: a request in the world - the hips dropped, the feet planted on the floor a thigh's length
  ahead with the knees forward, the hands on the table's top with the elbows out and down and the palms flat - which
  the climb rig's own `climbRequestToRig` maps into the rig and `applyClimbRig` solves on the skeleton's bones. No
  number names a bone. (CARDS2b first turned the head to the table's middle too; AUDIT CARDS D1 took it out - section
  13.)
- **MEASURED on retail's biped** (Weapon Sheathing's vendored `xbase_anim_sh.nif`, the skeleton CLIMB6 measured on):
  its pelvis stands at 1.09 m, its thigh 0.46 m, its shin 0.53 m. The first guess (a 0.45 m drop, the hands 0.55 m
  ahead) left the hips high and the hands 8 cm short of the table; the shipped numbers - a 0.48 m drop, the feet and
  the hands 0.45 m ahead - put the hips level with the knees over standing shins, the feet on their marks, and both
  hands on the top to a millionth of a unit (`test/cards2b_seated.test.js` solves it). The seated eye is no longer its
  own guess: `SEATED_EYE_HEIGHT` is the standing eye (motor.js `EYE_HEIGHT`) lowered by the drop, 1.22 m, where the
  seated head is - and CARDS2's seats moved with it.
- **My view** (`scenes/worldModes.js`). Seated, the view is the seat's own, first person - section 2's fixed seat
  view - so this host draws no seated body of its own (the capsule stays where it sat down from - a chair is no floor
  to stand a capsule in). A hit (any health lost through the health door, `registerPlayerHurtListener` - a duel's sparring blows never reach it, AUDIT CARDS B4) and Escape (spent above the one key
  dispatch, the way a gathering act's end spends it, when no window is up) stand you up, as the press and a step do.
  (CARDS2b first drew the body at the seat and let the view follow it in third person; the sweep of the host's pins
  showed that rewrote four hosts' worth of pinned lines - DISC18, CLIMB6 C16, AUDIT 65 XL-4, U43 - for a view the
  design never asked for, and it was taken back the same day.)
- **The others' bodies.** The pose a seated player sends is the seat's - the feet and the facing the body is drawn at,
  through the room's own frame (`sceneToOnline`) - and carries `st`, the table's top above the feet in 5 cm steps
  (1..40, `wire.js` `seatOf`, `POSE_SEAT_TOP_MAX`), omitted standing so a standing pose keeps its bytes. `poseChanged`
  sends a sit or a stand at once; `lerpPose` carries it whole; `peerBodies` hands the peer's rig the same request at
  its drawn feet and facing (`seatFor`, rebuilt only while the arrival eases in) and does not walk it into the chair;
  `fpArm`'s `thirdClimb` answers the seat (`thirdSeat`) whenever no climb holds the body - a sitter never climbs.
- **Relay world176** (NOT YET DEPLOYED): `validPose` relays `st`. An older relay strips it, and the others see the
  sitter standing at the seat. The bump was the sed over the 37 test files with `relayversion.test.js` excluded, and
  the law's row appended. The first bump REPLACED `RELAY_VERSION`'s comment - which is the relay's whole version
  chain, 148 KB of it - with CARDS2b's own sentence; HT-WAIST-NET's pin caught it, the chain was restored with
  CARDS2b at its head ("world175 before it: ..."), and the undeployed row re-hashed in place.
- **CARDS2c, open:** the sprite lane. Eye Of The Beholder has no sitting art, so a sprite body - mine in that lane, a
  peer's walker or paperdoll - stands at its seat facing the table.
- **Not verified in a live tavern** (no ARENA2 here). The pose is verified on the real skeleton, not on screen.
- **Pins:** `test/cards2b_seated.test.js`, 7 tests. `tools/mutants/cards2b.json`: 32, 32 dead (one survived the
  first pass - the peer's table top, pinned at the default height, which a mutant dropping it could not move - and two
  records were re-aimed to parse).

## 13. AUDIT CARDS (2026-10-07): the arc audited

Mac: **"Lets do a comprehensive audit on everything developed so far"**. Five lanes over a frozen snapshot, and the
sweep of every test reading a touched host; the whole record is `01-Overview/Audit-Cards.md`. What it changed, here:

- **The relay record (C1, C2).** `world175` was live; its row is main's again, and world176 carries CARDS1's dice lift
  beside the seat. The version chains in 37 test files were rebuilt from main: appended, never renamed.
- **The view (S1).** The seat's view is first person - section 2's fixed seat view - and this host draws no seated body
  of its own; the others see it through `st`.
- **The seat's lifetime (B1, B2).** The forced road out (a load, a teleport, a respawn) empties the seat as the door
  does, a new room seats nobody, the pose never says a seat outside a building, and the seated eye stands aside while a
  death screen holds the camera.
- **The table (B3, B6).** Another player's seat is taken (`takenSeats`, the seated feet of the players I can see in my room); the seats
  stand round the table's OWN box through its matrix, never the world box's bulge.
- **The body (D1-D6).** Seats sit SQUARE to their side, 0.35 m out (`SEAT_OUT`, now seatPose's - the edge and the
  hands' one home), the hands 0.1 m past the edge; no head turn; the body's distances follow its race; the seat wins
  over a climb's tail; a sit or a stand is drawn whole, not as a slide; and a sitter is no walker to any reader
  (`peerMoving`). Proven by solving EVERY seat of a real table on retail's biped: both wrists inside the table's edge.
- **The law (A1-A3).** A short big blind against nobody owes only what a live seat bet (`owedBy`); a bad table is
  refused, never thrown on; chips are safe integers.
- **Recorded, not built:** a readied spell fires on its press before the release stands you up (B5); a duel's sparring
  blows do not stand you up (B4); seated, foes and the collider stand at the capsule until the first blow (C4); a
  tall, slight race's hands stop a few centimetres short of the table (D2); CARDS5 needs a fold out of turn for a seat
  whose player leaves (section 5) - built at CARDS4 (`foldSeat`, section 14).

## 14. CARDS4 (2026-10-07): offline Hold'em against the tavern

Mac: **"Do 3 and 4"**. The first playable game: sit at a tavern's card table, buy in, and play no-limit Hold'em against
the house's regulars until you stand, go broke or empty the table.

- **The patrons' play** (`src/systems/cardPatrons.js`, pure). Before the flop a hand is its Chen score over twenty;
  after it, its equity - Monte Carlo over `EQUITY_SAMPLES` (200) deals of the unseen cards, a tie its share, cards known
  dead never dealt. Each patron is one of three tempers (`PATRON_TEMPERS`: tight, loose, a bluffer), four numbers each: the
  preflop line he plays from, the strength he raises with, how often he bets air, the edge over the pot's odds a call
  wants. A raise is sized off the pot - a half to the whole, more the stronger - and clamped to what the law allows.
  The bluff is the decision's FIRST draw (a constant source would spin the shuffle's rejection loop forever otherwise -
  found by the pins' first hang). Every decision is one `legalActions` allows, swept over thousands of seeded spots.
- **The evening** (`src/systems/cardTableSession.js`, pure). The table's clock over the cards' law: the stakes by the
  tavern's quality (`TABLE_STAKES`: 1/2 to quality 7, 5/10 to 13, 25/50 above), the buy-in 20 to 100 big blinds and never past
  the purse, the regulars' purses 30 to 120 big blinds; a patron acts after `THINK_MS` and a seeded spread, the next
  hand waits `HAND_GAP_MS` after a showdown, a broke patron leaves (his chair shows empty), the evening is over
  `broke`, `empty` or `left`. Standing mid-hand folds you OUT OF TURN - `foldSeat` in the cards' law, the primitive
  CARDS5's leaver needs too (section 13) - your pot chips stay, the rest comes home.
- **The panel** (`src/ui/cardTableHud.js`). The port's own panel, not a pausing window - the patrons play on - holding
  the cursor while it stands: the seats, the cards each may see, the pot, the buttons the law allows, a raise slider,
  the log. It swallows its own presses and keys (a slider's arrow is never a step that stands you up).
- **The host** (`worldModes.js` - THE FOUR HOSTS, AUDIT CARDS-2 L13: the interior mode machine both `world.js` and
  `exterior.js` mount through `createWorldModes`, so the table stands in either's taverns; `dungeonContext.js` has no
  tavern and the `?interior` viewer no body; the save's refusal while chips are on the table is `world.js`'s, the one
  host that saves). Sitting opens the panel; dealing in
  takes the buy-in from the purse; the frame runs the patrons under any window; every road off the seat (the stand, a
  hit, the door, a new room, a forced exit) goes through `standFromCardTable` and cashes the table out - the three bare
  seat clears that would have dropped the chips are gone. The regulars are named by the living world's namer on a seed
  of the building's key: the same faces every evening at this tavern.
- **DECIDED: online it is a friendly game.** A patron's gold paid on the client is a faucet the realm service never
  sees (section 5: a stake the service does not hold plays for no gold), so a realm character - or any online page -
  plays for chips and no purse is touched. Real-gold online tables are CARDS6's escrow.
- **Open:** the regulars are names, not the room's living residents seated at the table (needs a host seam into the
  living world's crowd); the patrons do not talk.
- **Pins:** `test/cards4_patrons.test.js` 4, `test/cards4_session.test.js` 5, `test/cards4_hud.test.js` 6.
  `tools/mutants/cards4.json`: 17, all dead (three survived the first pass - a dead-card pin that compared a call
  with itself, an evening seed in which nobody went broke, and an empty chair nobody looked at; each pinned).

## 15. CARDS3 (2026-10-07): the cards on the cloth

The same ask. Section 3's physics, closed-form in time so a slow or skipped frame lands on the same pose, seeded so a
table's throws are its own.

- **The motion** (`src/world/cardMotion.js`, pure). A throw from the dealer's hand (`DEAL_LIFT` over the top) on an
  arc (`ARC_HEIGHT`) at `FLIGHT_SPEED`, never quicker than `FLIGHT_MIN_S`, spinning; a slide under the cloth's
  `SLIDE_DECEL` that stops EXACTLY on its rest with no speed left; a flip over the long edge (`FLIP_S`) or at its middle;
  chips stacked greedily from `CHIP_VALUES` in columns of `CHIP_STACK_MAX`, pushed over `PUSH_S`.
- **The scene** (`src/world/cardScene.js`, pure). `tablePlaces` lays each seat's hole cards, bet and stack, the board
  along the long side, the burn at its head, the muck and the pot either side; `CardScene` turns the session's events
  into motions - the deal round from the dealer's left, the player's own two turned up where they lie, the board thrown
  face down and turned over its edge, a fold to the muck, a showdown's hands turned and the pot pushed to its winner -
  and `poses(t)` is the whole picture at any clock. A card the player may not know is a back, even told it.
- **The draw** (`src/render/cardTableDraw.js`). One atlas (52 faces, the back, the stock, five chips) painted on a
  canvas and uploaded once under the key `drawMesh` reads; 52 face plates, a back plate and five chip drums made at the
  first card; each drawn with its own matrix; all freed with the table (`closeCardGame`). The host draws it in the
  room's own pass after the decor.
- **Seen, not assumed** (`cards.html`, `src/tools/cardsLab.js`, `tools/cardsProbe.mjs`: a felt table, a seeded evening
  played to a clock, four cameras, Chromium screenshots). The first cut was wrong three ways the pins had not seen:
  every face culled (the quads wound clockwise - the renderer's front is counter-clockwise about the normal), every face
  mirrored (the world is Daggerfall's left-handed axes drawn through a mirror, so from above +X runs right), and the
  board a card's width off its slots (an edge flip moves the card across - a dealer throws it a width short,
  `flipShift`; a player's own cards turn at their middle). Each is now a pin and a mutant.
- **Not yet:** the fanned hand and the peek, a drag of chips to bet (the panel's buttons do it), the shuffle's riffle;
  the frame cost on a phone (the lab draws 60-odd meshes with no measurable cost on the probe's software GL).
- **Not verified in a live tavern** (no ARENA2 here): the lab's table stands for the room's.
- **Pins:** `test/cards3_motion.test.js` 8, `test/cards3_draw.test.js` 6. `tools/mutants/cards3.json`: 15, all dead
  (two survived the first pass - a short throw's least flight and a careless `holeOf`; both pinned).

## 16. AUDIT CARDS-2 (2026-10-08): the arc audited again

Mac: **"Lets do a deep comprehensive audit on everything so far. Perfection"**. Six lanes over a frozen snapshot, every
finding reproduced on the live tree before and after its fix; the whole record is `01-Overview/Audit-Cards-2.md`. What it
changed, here:

- **The gold (H1, M2).** A load's road stands up WITHOUT cashing out (the save's purse is already the character's; the
  chips were the discarded game's), and the save refuses while chips are on the table. The buy-in reads the purse again
  at the press.
- **The regulars (H2).** Their purses and tempers are kept by the game day in a book on the character's save
  (`regularsFor`, `regularsAfter`, `REGULARS_BOOK_MAX`): a re-sit seats the same purses, a broke regular "leaves for the
  night", and a table every regular has lost to refuses the deal until tomorrow. Their play takes the price
  (`PRICE_PER_DOUBLING` past `PRICE_FREE_BB` big blinds), defends a cheap one (`DEFEND` under `DEFEND_ODDS`) and bends a
  hand by the bettor's bet (`BETTOR_BEND`, at most `BETTOR_BET_MAX` pots) for the raise as for the call. Lane F's
  money-printers now lose or break even at 5/10 (exploit -0.5, nut-shover -20, stealer +18 bb/h).
- **The law and the clock (M1, L1, L2, M6, M7).** An uncontested pot is the one seat still in's; every street crossed
  is its own event; a patron waits for the cloth (`settleMs`); the last showdown stays in the view until the next deal.
- **The panel (M3, M7, M8, L8, L10, L15).** Phone-width; the showdown shown with its hands named; only contested pots
  won; only the slider's keys swallowed; the player in the second person; the street named.
- **The cloth (M4, M5, L3-L6).** Every chip drawn once on every frame; the edge flip on its edge; a fold from where the
  card is; the closing call slid in; the run-out's streets in turn and the pot after the river; board layers and the
  burn clear; stacks away from the cards, a pot scooped over them; a small table's places fit.
- **The probe (M10).** It reads the frame back and fails a face-up card that paints no face; it measures no frame cost.
- **The seat (L7, L9, L11, the dead).** The regulars only in free chairs, named by the town; the seat holds the head; the
  dead stand up.
- **Counts as of this audit** (the slices' sections give theirs as they shipped): cards1 15 tests, cards2 10, cards2b 8,
  cards3_motion 8, cards3_draw 6, cards4_patrons 4, cards4_session 5, cards4_hud 6; the audit's `auditcards2_table` 9,
  `auditcards2_host` 9, `auditcards2_cloth` 6. Mutants: cards1 48, cards2 56, cards2b 40, cards3 15, cards4 17 - all dead
  (one equivalent as recorded) - and `tools/mutants/auditcards2.json` 95 dead, one equivalent.
- **Before a pull request:** merge main (three conflicts; `tryExit`'s seat line stays first - the audit record says why).

## 17. CARDS5 (2026-10-08): the relay deals

Mac: **"Do 3 4 and 5"**. Section 5 built for the friendly table: players in one tavern play one another, and the relay
holds every card.

- **The relay's table** (`src/net/holdemTable.js`, pure and plain data - one home for the relay and its pins; with
  `net/cardLaw.js` it joins the relay's bundle, `world176`, undeployed, re-hashed in place). A building's room keeps its
  card tables by the table's index; A TABLE'S SEATS ARE ITS CHAIRS (the chair the client took - every client computes the
  same chairs from the same room, so every eye maps the cloth alike). The relay shuffles from its own CSPRNG
  (`shuffleDeck` over the dice's unbiased draw) and keeps the deck in the table, which no frame carries; each seat is
  told its own hole cards in a message to it alone, the room the public hand (`viewFor`'s spectator's view) with every
  event; the seat to act is told what it may do and its clock (`HOLDEM_CLOCK_MS`, section 5's 30 s - checked if it can
  be, folded if not, `timeoutAction`); a player who stands or leaves the room is folded out of turn (`foldSeat`) and
  stood up at the hand's end; a seat out of chips stands up. The hand's `seed` travels with the deal: one picture.
- **Friendly** (section 5): every seat sits with `HOLDEM_CHIPS_BB` big blinds of chips at the stakes the first sitter's
  tavern sets (`HOLDEM_BBS`, the taverns' own); no gold moves. Real stakes are CARDS6's escrow.
- **The wire** (`net/wire.js`): the `holdem` frame (`validHoldemIn` - sit, stand, act, look; `HOLDEM_FRAME_MAX`,
  `holdemGate`), sent only to a relay at `HOLDEM_RELAY_MIN` (a relay before it closes on it); the relay's words checked by
  `validHoldemOut`. The table's state rides a frame as `state`, never a second `table` (the frame's `table` is its index -
  found by the first pin, a spread would have written the one over the other).
- **The relay** (`server/src/index.js`): only an interior's room keeps a table; the tables checkpointed to storage (a
  hibernated room keeps its hands) and the alarm armed for the soonest clock or deal; a socket's leave stands it up.
- **The client** (`src/systems/cardRemoteTable.js`): the relay's frames folded into the very shapes the offline evening
  offers (`view`, `legal`, `drain`), the relay's clock moved onto this one, a hand already under way told as the events
  it took (`CATCH_UP_MS`) so a newcomer's cloth lies at rest at once (a room come into asks for each of its tables -
  AUDIT CARDS-3 D7; before it, nothing showed till the table's next event). The host (`worldModes.js`): online, sitting joins
  the relay's table (no buy-in); the panel says whose turn and my clock, the relay's refusals in words; alone, "Play the
  regulars" stands up from it and plays the friendly game; the stand names its table. THE ROOM WATCHES (section 2): every
  table a player does not sit at is laid on its own cloth from the room's frames - a scene and a draw of its own, let go
  when its last seat stands, the room changes or the interior is left.
- **Not yet:** spectators near the table only (the whole room watches every table); a seat a player takes after the
  regulars began is the relay's table, not the regulars' game - his chair is his, and no regular is drawn in it (AUDIT
  CARDS-3 E-N3); real stakes (CARDS6).
- **Pins:** `test/cards5_relay.test.js` 6 (the table, the deal's privacy, the clock and the leaver, the words both ways,
  the client's session, the relay end to end on the fake room - three players, a hibernation), `test/cards5_client.test.js`
  9 (the remote table, three hosts over an in-process relay, the regulars instead; AUDIT CARDS-3's driven host seams). `tools/mutants/cards5.json`: 25, all
  dead.

## 18. CARDS4b (2026-10-08): the regulars in their chairs

The same ask. CARDS4's regulars were names on the panel; now they sit at the table.

- **Their bodies** (`src/world/cardRegulars.js`): each regular's look minted from the seed that names him (the town, the
  building, the order - CARDS4's namer, which now answers its seeds too): his region's people (the name bank's race), a
  face, and a tavern-goer's clothes from Daggerfall's own templates in the slots they are worn in (`REGULAR_CLOTHES` - a
  shirt or tunic, trousers or a skirt, or a gown; shoes or boots). The interior host hands world.js its regulars every
  frame (`host.cardRegulars` - none outside a building, none at a relay's table), and world.js stands them on layers of
  their own (world/familyBodies.js's, which now take a seat: `st`) - a Morrowind body posed seated through the pose's own
  byte, as a seated peer is; the sprite lane stands at the chair, CARDS2c's open. They are freed the moment none sit.
- **Their voices**: each action, a win and a broke regular's leaving said over his head for `BARK_MS` (`regularBark`), on
  the crew's one speech layer with the room's talk - with the living world off too.
- **Pins:** `test/cards4b_regulars.test.js` 4, and the host block's own run in `auditcards2_host` (stood in the chairs,
  seated, a play voiced). `tools/mutants/cards4b.json`: 10, all dead.

## 19. CARDS3b (2026-10-08): the hand held, the chips dragged, the riffle

The same ask; section 3's DECIDED hand and chips.

- **The held hand** (`src/world/cardHand.js`): the player's two, once landed and turned on the cloth, are drawn held
  before the eye (`heldMatrices` - the camera's own frame composed), low and a little right of the middle, fanned with the
  screen's right-hand card in front, leaning back the shy way; PEEKED - the cursor over them, or a press held on them -
  they come up toward the eye and spread (`PEEK_RATE` easing). Seen in the lab (`?cam=seat&peek=1`) and checked by the
  probe's face pixels: the faces upright and unmirrored (the world's mirror puts the view's +X on the screen's left, which
  the first cut put the hand on).
- **The chips** (`tablePoint`, `onStack`, `inBetZone`, `dragBet`): a press on his own stack picks up the panel's bet - the
  raise slider's when he set it (clamped to the law), else the call, else (nothing to call) the least bet: DECIDED (AUDIT
  CARDS-3 C7), chips pushed in with the slider untouched CALL - carried on the cloth under the cursor and let go in the
  betting ground (nearer the middle than his cards, and on the table: `onTable`) as the bet; anywhere else - off the
  table, over the panel, a turn gone by - it goes back. A press on his stack is always the chips', his turn or not. The press is taken at the capture
  phase, before the seat's "a swing stands you up" hears it; a press on the panel is the panel's; the listeners are the
  game's and go with it.
- **The riffle** (`riffleAt`, `RIFFLE_S`): the dealer riffles at his deck place before every deal - two halves part and
  fall one card from each in turn into one pile - and the deal begins when it is done; the evening's first patron waits
  it out.
- **Recorded:** a thrown card's last centimetres may skim a seat's chip stack for a frame (the pin on chips through cards
  is a pin on cards at rest, every frame - AUDIT CARDS-3 found a pot share coming home through a resting card, fixed).
- **Pins:** `test/cards3b_hand.test.js` 7. `tools/mutants/cards3b.json`: 14, all dead.

## 20. AUDIT CARDS-3 (2026-10-08): the arc audited a third time

Mac: **"I wanna do a deep comprehensive of everything"**. Five lanes over a frozen snapshot of CARDS5, CARDS4b and
CARDS3b (`01-Overview/Audit-Cards-3.md`): 4 HIGH, about 20 MED and a tail of LOW, every one reproduced and fixed or
recorded. What changed in the record:

- **The relay** (`world176`, undeployed, re-hashed in place): a refused sit moves nothing elsewhere; ONE SEAT AN
  ACCOUNT in a room ('account seated'); a seat whose player has no socket in the room is stood up on the alarm and by an
  empty room's sweep (no ghost deals for ever, nobody takes a ghost's cards by its id), the alarm given back to the
  room's forgetting with the last table; the room's sits on one gate ('busy'); a table open at other chairs or stakes
  refused ('table differs'); a dropped player's sit takes his own chair back mid-hand; a run-out's streets lengthen the
  pause before the next deal (`HOLDEM_RUNOUT_MS`).
- **The client**: the relay's frames on the cloth's clock; MY CHAIR IS THE ONE MY ID SITS IN (pending until a state shows
  it; a refused or raced chair stands the player up; a chair the relay empties turns the game over, said to him); a new
  socket asks its sit again; a stand the gate kept is said again until it goes; a refusal painted, then cleared; the
  panel's message rewritten in place (its slider and buttons kept); a room asks for its tables on the way in; a seated
  player never watches his own table; the regulars only with a chair for one, never drawn in a player's.
- **The hand and the cloth**: the panel docks right on a wide screen and the hand lifts clear of it; each held card eases
  between the cloth and the hand; the deal waits for the cloth to settle; pointer events (touch reaches the cards); a
  bet kept to the table; the carried chips off the stack; a pot share home in the stack's own columns.
- **THE FOUR HOSTS** (lane D): the card table is `worldModes.js`'s, mounted by world.js and exterior.js. world.js hands it
  `cardOnline` and `cardRegulars`; exterior.js hands it neither - in that host the table is the offline game and its
  regulars are names on the panel, unseen and unheard. The dungeon host has no tables.
- **Pins:** `test/auditcards3_relay.test.js` 8, `test/auditcards3_host.test.js` 4, `test/auditcards3_pins.test.js` 7, and
  six driven host tests in `cards5_client`. `tools/mutants/auditcards3.json`: 111 dead, 2 equivalent.

## 21. CARDS-BAY (2026-10-08): the deck of the Iliac Bay

Mac: **"give the cards daggerfall especially themes instead of the simple hearts queens and kings"**; asked, he chose the
Iliac Bay's kingdoms as the suits, and their royals for the courts with the crown's seal as the ace.

- **The suits are the Bay's four crowns** (`src/render/cardFaces.js` `SUIT_CROWNS`, in cardLaw's suit order): clubs are
  ORSINIUM (an axe, iron green), diamonds SENTINEL (a sun, desert gold), hearts WAYREST (a rose, crimson), spades
  DAGGERFALL (a dagger, royal blue). A four-colour deck: no two crowns share an ink. The charges are the port's own
  reading of the game's words - Wayrest's Knights of the Rose, the ship "Sentinel Sun", the cargo "Orsinium Iron" and
  Gortwog's cleaver, the dagger Daggerfall is named for.
- **The courts are the crowns' royals, the game's names only** (3E 405, the roll `systems/naval/navalShips.js` already
  sails under, and `lootRarity.js`'s King Gortwog): Daggerfall - Gothryd, Aubk-i, Nulfaga (the court's mage); Wayrest -
  Eadwyre, Barenziah, Helseth; Sentinel - Camaron, Akorithi, Lhotun; Orsinium - Gortwog, and a queen and a champion the
  game names nobody for, who carry their titles alone. Each is a painted bust in the crown's colour, the rank's headwear
  (a crown, a circlet and veil, a coronet, a helm, a mage's hood), the crown's shield at the shoulder, the skin of the
  crown's people (an orc's tusks for Orsinium), the name across the foot.
- **The ace is the crown's seal**: its charge large in a double ring, the crown's name beneath. **The back** is the Bay's
  medallion on a crimson field in a gold lattice, the four charges round it as the kingdoms lie (Daggerfall north,
  Wayrest east, Sentinel south, Orsinium west).
- **The corners keep the poker player's letters** (2-10, J, Q, K, A) beside the charge: the game is Hold'em, and the
  hand's names (a pair of kings, a flush) are the game's.
- **THE ART IS OURS** (section 6.2): every face is painted from canvas paths in code - no ARENA2 pixel, no font glyph for
  a charge. ONE HOME: the cloth's atlas (`render/cardTableDraw.js`, its cells now 128 x 180 for the royals) and the
  panel's little cards (`ui/cardTableHud.js`, each card its own painted face; a page with no canvas writes "K Daggerfall")
  are one painter. The panel's hover names the card ("Gothryd, King of Daggerfall", "The Seal of Wayrest").
- **Pins:** `test/cardsbay_faces.test.js` 7 (the crowns, the royals against the game's roll, the pips, every face inked
  and drawn not written, the back, the panel painting with the same painter, no ARENA2 read). Mutants in
  `tools/mutants/auditcards3.json` (BAY-*).

## 22. CARDS-TIDY (2026-10-08): the deck one thing, the frames lighter, the table watched from near it

Mac: **"#2 and cleanup"** - AUDIT CARDS-3's recorded-not-built, done beside CARDS6.

- **The deck is one thing on the cloth** (`world/cardScene.js`, `world/cardMotion.js` `gatherMotion`, `GATHER_S`): a new
  hand no longer wipes the cloth - the last hand's cards are swept face down to the new dealer's deck place (any still
  on their way from the hand before simply join it), and only then does he riffle; between the riffle and the hand's
  end the squared deck lies there (`DECK_PLATES` for a whole deck), thinning card by card as it is dealt. The session's
  first thought waits the gathering out too.
- **A room frame names only what changed** (`net/holdemTable.js` `stateDelta`, `STATE_KEYS`; relay `world176`,
  undeployed, re-hashed in place): the relay keeps, per wake, the last state it told the room of each table and sends
  the changed fields alone (`delta`); a wake, a table's first frame and a look say it whole. The client lays a delta
  over the table it knows (`validHoldemOut` checks both the delta's fields and the merge); with none under it, or a
  merge that is no table, it asks for the whole (`look`).
- **A table is watched from near it** (section 2): within `CARD_WATCH_M` of its middle the room's frames are laid on its
  cloth; walked up to, it is asked for (`look`) and laid at once; walked away (past a metre more), let go.
- **exterior.js**, the dev location scene, has no online room and no save: there the card table is the offline game,
  and its regulars are names on the panel (the host carries no family layers to seat them). DECIDED: so it stays.
- **Pins:** in `cards3b_hand`, `cards5_client` and `auditcards3_pins`; mutants `TIDY-*` in `tools/mutants/auditcards3.json`.

## 23. CARDS6 (2026-10-08): gold tables online - the stakes escrowed by the realm service

Mac: **"#2"**. Section 5, DECIDED: "online stakes are escrowed there. Sitting down moves the buy-in from the character
to the table; standing up moves the stack back." FACT: the relay has no door to the service - the gold goes round by the
player, the service's word one way and the relay's the other, each signed:

- **THE STAKE** (`server-account/src/cards.js` `stakeCards`, `/v1/cards/stake`; migration 0088 `card_stakes`): a realm
  character's buy-in (`HOLDEM_STAKE_MIN_BB`..`HOLDEM_STAKE_MAX_BB` big blinds, the tavern's own buy-in by pin) leaves its
  record (`payFromSave`) and is held as a row, in one batch; the answer is the service's ORDER on it
  (`net/identityToken.js` `mintStakeOrder`, kind `stake`: the account, the stake's id, the room, the table, the sum, the
  stakes - a minute's life). A request asked twice is one stake (`rid`).
- **THE SEAT** (relay `world176`, undeployed, re-hashed in place): a sit carrying a stake order is checked with the key
  the room already holds (the kind, the account, this room and table and stakes) and its stake SPENT before anything
  else - one stake, one seat, ever. The first sitter's stake makes the table a GOLD TABLE (`publicView.gold`); every seat
  at it is staked, and a friendly table seats no stake ('gold table', 'friendly table'). A seat sits with its stake's
  chips. A sit refused after its stake was spent - a chair taken, a table of other chairs, the gate - hands the whole
  stake back; an order for this room at another table or stakes is spent and handed back ('stake elsewhere'); another
  room's is that room's - left unspent, nothing handed back (AUDIT CARDS-4 A2/B1: each room remembers only its own
  spends, so a refund here while the room it names still seated it was the stake paid twice); another account's is
  refused and left unspent. A room that cannot sign a cash-out seats and voids no stake ('stakes closed', B3).
- **THE CASH-OUT** (`net/cardReceipt.js`, `c1`, the relay's fourth signature under GATE_SIGNING_KEY): a staked seat gone
  from the table - stood up, out of chips, gone from the room - leaves with a receipt for its stack (`stood`, `broke`); a
  refused sit's and a void's are the whole stake (`refused`, `void`). A leaver folded out of a hand that goes on is cashed
  out AT ONCE with his stack behind (he can win nothing more, and he is walking out of the room), never again at the
  hand's end, and his chair is not his to play again ('cashed out'). The table queues what its seats leave with
  (`t.cashouts`, kept with the table) and the relay signs it before the tables are saved; each receipt is sent to the
  account's sockets and OWED to it in the room (`cashout:<account>`, each a receipt's life, `HOLDEM_OWED_MAX` of them)
  until its client says it holds it (`ack`) - told again at every look and sit there. A cash-out leaves the table's
  queue only once it is signed and kept, and a table is never forgotten with one unsigned (B4).
- **THE CLAIM** (`cashoutCards`, `/v1/cards/cashout`): the receipt pays the character that staked it, into the account
  of the region it was staked from (`creditSave`; AUDIT CARDS-4 A7), and turns the row PAID in the same batch - once,
  whenever it is brought (A3: its row spends it, so its age keeps no gold), where the record stands asked first (E6). A
  refusal says why (A4), and the device keeps one refused on its signature or its clock. A character with a stake held
  is not deleted ('cards-held'). A stake handed back whole is
  the stake, never more or less; a seat leaves with no more than every seat's deepest stake at its stakes; another
  account's receipt, another character's, an unsigned or rewritten one pay nothing.
- **A STAKE NEVER SAT** (the sit never sent, its answer lost, the game closed while the service answered): the device
  keeps its order (`net/cardStakes.js`), and once its minute is past (no room can sit it) hands it to the room it names
  (`void`) - spent there, the whole of it back in a `void` receipt, for as long as a receipt lives (AUDIT CARDS-4 C6:
  `HOLDEM_STAKE_VOID_S`, not a week). A lost stake answer is asked again by the same request: the same stake, the SAME
  order (A1: minted at the stake's own instant - a repeat is never a fresh minute to sit on), the purse paying it then
  if the service takes it then (C1).
- **ON THE DEVICE** (`net/cardStakes.js`, world.js `cardStakes`): the stake is the record's own act (realmSaves.js
  `realmGoldAct` - the purse checkpointed, the gold held out while asked); the request kept first, the order till the
  relay sits it; each receipt kept, its stake let go, acked to the room and claimed as the record's act. A cash-out frame
  is heard on any socket - the room just left included (online.js). The panel: a realm character online sits at the
  relay's table through a gold buy-in ("The realm is holding your stake..."), the table's note says the realm holds it.
- **WHAT HOLDS IT TOGETHER**: every chip at a gold table came in as a stake, the law conserves every chip, and each
  stake comes back exactly once - in the receipt of its seat, its refusal or its void. A receipt never brought leaves its
  stake held at the service: gold that left the record for the table (a loser's stake is already in the winners'
  receipts). A player who never returns to a room where a receipt is owed him (he left before its frame reached him)
  finds it there when he does, within a receipt's life and the room's bound on what it owes one account (AUDIT CARDS-4
  D7); the host says on each visit what other rooms still owe him (section 24).
- **Then:** the top-up and gold owed elsewhere (section 24); AUDIT CARDS-4 over all of it (section 25).
- **Pins:** `test/cards6_service.test.js` 3 (on the real Worker over SQLite), `test/cards6_relay.test.js` 6 (the fake
  room), `test/cards6_client.test.js` 4, `test/cards6_law.test.js` 2. `tools/mutants/cards6.json`: 36, all dead. AUDIT
  CARDS-4 added to them (section 25).

## 24. CARDS6b (2026-10-08): the top-up, and gold owed elsewhere

Mac: **"2 and 3"** - section 23's "Not yet", built after AUDIT CARDS-4 (section 25) found its fixes in the same code.

- **THE TOP-UP** (`net/holdemTable.js` `topUp`, relay `_holdemTopUp`, the `topup` word): a gold table's seat adds a
  stake of its own account's between hands - never while a hand holds it (the chips in play are the hand's: 'in hand'),
  from `HOLDEM_TOPUP_MIN_BB` and never past `HOLDEM_STAKE_MAX_BB` ('bad stake'). The order is a stake order like a
  buy-in's (the service holds a top-up from `HOLDEM_TOPUP_MIN_BB`, `topup: true`); the relay checks it against the seat
  BEFORE it spends it - a refusal spends nothing, and the device voids it back in its room after its minute - reads the
  table again after the order's await, spends it, adds it to the stack, and settles it AT ONCE in a `joined` receipt
  (`net/cardReceipt.js`: nothing back by it - its chips come home in the seat's own receipt). The panel offers "Top up
  N" between hands (the most from the purse to the table's most); the log says it.
- **GOLD OWED ELSEWHERE** (`net/cardStakes.js` `elsewhere`, worldModes `cardElsewhereSay`): the device keeps a sat stake
  (AUDIT CARDS-4 C4) and the words for where it was staked (the building and its town). Each room keeps its own spends
  and its own cash-outs, so only that room hands a cash-out over or voids a stake back; on each visit to a card room the
  host says what other rooms still owe this character ("Gold you staked waits at card tables elsewhere - 500 at The
  Bilge, Wayrest. Each table hands it over when you return."). What nothing can bring home any more (past a receipt's
  life) the device lets go (`prune`).
- **Pins:** `test/cards6b_topup.test.js` 3. Its mutants are in `tools/mutants/auditcards4.json` (the `AC4-T-` records).

## 25. AUDIT CARDS-4 (2026-10-08): the gold tables audited

Mac: **"2 and 3"**. Five lanes over a frozen snapshot of sections 22-23, one of them the device, the relay and the
service at once over about 14,000 gold evenings - the record is `01-Overview/Audit-Cards-4.md`. What it changed here:

- **A stake asked again** after a lost answer is paid from the purse when the service takes it then (C1 - it was paid
  twice); kept on any word but the service's own refusal (C2); its repeat is the SAME order (A1).
- **Another room's order** is left unspent and nothing is handed back; its own room voids it (A2/B1). The table is read
  again after an order's await (B2); a room that cannot sign a receipt seats and voids no stake (B3); a cash-out leaves
  the queue only once kept (B4); a void reaches a receipt's life (C6).
- **A receipt** is acked only once kept (C3), filed to the character that staked it (C4), paid whenever it is brought
  (A3), let go only when refused for what it is (A4/A5), claimed where the record stands first (E6); a character with a
  stake held is not deleted.
- **The frames** are numbered per table, a delta laid only on the one before it (D1); a far table's change asks nothing
  (D2); the approach has the watch's slack (D3); the watch closes at the sit (D4); the last pile goes with the gathered
  cards (D5); a table's hand shape is checked (D6).
- **Recorded:** a staked player all in who drops while another must act is folded and forfeits (B7, the law's leaver).
- **Pins:** `test/auditcards4_client.test.js`, `_pins`, `_tidy` and additions across the cards' tests;
  `tools/mutants/auditcards4.json` - every fix's record and every lane survivor's, three equivalent with why.

## 26. COLLECTIONS, CARDS7 and CARDS8 (2026-10-08): the codex and the cards, Iliac Hand's rules, the first set

Mac: **"So what about card collections? I think we add a new tab in holdings for the weapon codex and card
collection"**; asked, **"One 'Collections' tab"**, the collectible cards **"Painted in code"**, and **"Tab + CARDS7 +
CARDS8"**.

- **THE COLLECTIONS PAGE** (`ui/collectionsPage.js`, the Holdings rail's last entry): a Codex | Cards switch. The CODEX
  part draws LOOT10's own rows (`systems/lootCodex.js`: every Legendary found and not, a row opened whole - its lines,
  power, lore and the day found - then the Aetheric sets), the rows the Reforge's Codex page draws, so the two never
  disagree; the pack's Codex button still opens that window. The CARDS part is the binder's (below). The page shows while
  Loot rarity makes Legendaries or a binder is carried.
- **CARDS7, THE RULES** (`net/iliacHand.js`, pure - it imports only `cardLaw.js`, `dice.js` and the catalog, so the
  relay can run it later): section 6.1 as built. Two decks of 30 (two of a card, one of a Legendary or rarer); three
  holdings drawn from the locations; magicka the turn's number to ten (and a card's bonus); a hand of four, a card drawn
  a turn, seven at most; four cards a side of a holding. Both players COMMIT hidden, then the turn is revealed together -
  the player with more power showing first (a face-down card counts for nothing, so the order says nothing of it). After
  the sixth turn two holdings held wins, else the greater power across all three, else a draw. The only randomness is
  the injected `rand32` at the deal (the holdings, the two shuffles): the same seed and plays are the same game. A small
  effect language (`reveal`, `ongoing`, `end`; `buff`, `weaken`, `destroy`, `move`, `draw`, `magicka`, `summon`,
  `transform`, and the ongoing `room`, `veil`, `nospell`, `discount`; targets by side and holding, filtered by tag or
  cost, the weakest or the strongest) - and every card's text is its effects' own words (`fxText`), pinned equal. The
  locations bend their holdings: Daggerfall's knights, Sentinel's sun, Wayrest's walls, Shornhelm, Orsinium's orcs,
  Betony and Evermor's gifts, Castle Daggerfall and Privateer's Hold (no spells; the Hold's cards face down till the
  end), the Mages Guild Hall's cheaper spells, the vampire's crypt. Its numbers are MEASURE (section 6): in 3,000 random
  games each seat won over a thousand, about 85% decided on holdings, 1.5% drawn.
- **CARDS8, THE FIRST SET** (`net/iliacCards.js`): 82 cards - 57 units, 14 spells (six of them the artifacts: Mehrunes'
  Razor, the Wabbajack, Azura's Star, the Oghma Infinium, Chrysamere, the Sanguine Rose), 11 Princes - and 11
  locations, drawn from Daggerfall itself (its creatures, guilds, temples, knightly orders and Princes; King Gothryd).
  Rarity is the loot's tiers (common 26, magic 23, rare 13, legendary 12, aetheric 2 - Mehrunes Dagon and Molag Bal -
  artifact 6); a card's power follows what it is (a Lich outranks an Orc, the Giant stands tallest). The STARTER DECK:
  thirty commons and magics.
- **THE FACES** (`render/iliacCardFaces.js`; section 9 Q5, "Painted in code"): the frame the tier's colour
  (`lootRarity.js` RARITIES), heavier up the tiers - studs, a double rule, an aetheric glow; the kind by its window (a
  unit's square, a spell's rounded, a Prince's arch, a location's landscape); a magicka gem, a power shield; one of 35
  emblems drawn from paths; the name banner and the rules box; the back a compass rose of the Bay. No ARENA2 pixel, no
  raster.
- **THE CARDS AS ITEMS** (`systems/iliacItems.js`; section 6.3): a card is template 581 named by its `card` - two of one
  card stack, two cards never (`inventory.js` stacksWith), a split keeps it (splitStack); its name is the catalog's
  ("Card: Rat"), never stored; weightless, worth a coin, not bound (CARDS9 brings it into the trade and the market). The
  CARD BINDER is template 582, the Wallet's shape (bound, pack-only, refused by the realm's trade - `BOUND_TEMPLATES`):
  it organizes - the cards stay in the pack's own `items`, never a second list, and leave the pages for the binder's
  sheet while it is carried - and holds the DECKS (`decks`, declared item fields, replaced whole when they change). Every
  character is given a binder and the starter deck's thirty cards once (`binderGift`: at chargen, and on an older save's
  load), the starter deck laid in it.
- **THE DECK BUILDER** (`ui/cardBinderPage.js`, the Collections page's Cards): the collection in a grid of the painted
  faces - a held card at its count, an unheld one dim (what is still to find) - narrowed by kind; the decks with the
  rules' word on each and the pack's (a deck needs the cards it names); a deck built a press at a time (a card in the
  grid goes in, never more than the binder holds; one in the deck comes out) and kept once lawful; a deck taken apart on a
  second press, its cards staying in the binder.
- **Not yet:** where cards come from (foes, tavern packs, quests, winning, the trade and the market - CARDS9) and Iliac
  Hand at the table against patrons and online (CARDS10). A card minted offline that walks into the realm is worth
  nothing to its gold law today; CARDS9 decides its customs before cards change hands there.
- **Pins:** `test/cards7_rules.test.js` 27, `test/cards8_catalog.test.js` 8, `test/cards8_faces.test.js` 7,
  `test/cards8_binder.test.js` 5. `tools/mutants/cards8.json` 21, all dead; the engine's own 22 were run by its
  builder, all caught.
