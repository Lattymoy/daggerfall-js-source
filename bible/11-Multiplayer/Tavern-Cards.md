# TAVERN CARDS - a card table in every tavern (CARDS0, the design record)

**Status: DESIGN RECORD, being built - CARDS1 SHIPPED (2026-10-07, section 10; Mac: "Do it"), CARDS2 SHIPPED (the same day, section 11; Mac: "Continue"), CARDS2b SHIPPED (section 12; Mac: "Continue") - the seated Morrowind body, the others' to see, on relay world176; AUDIT CARDS over all of it the same day (section 13, `01-Overview/Audit-Cards.md`); CARDS4 SHIPPED (section 14) and CARDS3 SHIPPED (section 15) together (Mac: "Do 3 and 4") - offline Hold'em against the tavern's regulars for gold, the cards and chips on the cloth. Mac answered
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
| **CARDS2b** SHIPPED | The body drawn at its seat, the Morrowind body posed seated (the climb rig's solver), peers drawn seated (`st` on the pose, relay world176), a hit and Escape standing you up. |
| **CARDS2c** | The sprite lane seated: Eye Of The Beholder has no sitting art, so a sprite body stands at its seat today. |
| **CARDS3** SHIPPED | The card bodies: the plate, the pass, the deal arcs, the flip, the slide and settle, the fanned hand and the peek, the chips. Frame cost measured on the probe. |
| **CARDS4** SHIPPED | Offline Hold'em: the patrons, their temperaments and purses, gold stakes. The first playable game. |
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
- **The host** (`worldModes.js`, the interior only - a tavern is an interior). Sitting opens the panel; dealing in
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
