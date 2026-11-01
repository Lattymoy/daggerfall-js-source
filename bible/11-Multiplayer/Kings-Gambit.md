# The King's Gambit

A tactics minigame at a tavern's card table: armies and kings on a board laid on the cloth, ported from the Daggerfall
Unity mod `thekingsgambit.dfmod` onto the Iliac Bay card system. Offline the player challenges a tavern regular for a
gold stake. Online two players meet at the friendly table, or for gold at the realm's red table, and a season board
crowns a Grandmaster. The pieces are Iliac cards standing on discs, so no ARENA2 pixel reaches the board.

## How it works

**The law** (`src/net/kingsGambit.js`, pure, shared by page and relay). A board of `KG_COLS` x `KG_ROWS` (15 x 13) in
one of the mod's layouts (`KG_LAYOUTS`) of floor, walls, pillars and water. Each side has a free king and up to
`KG_MAX_UNITS` (12) units bought with `KG_POINT_BUDGET` (300) points from the mod's roster of 46 Daggerfall foes
(`KG_ROSTER`). A turn is `KG_ACTIONS_PER_TURN` (2) actions - a move of up to `KG_MOVE_RANGE` cells, an attack, or a
potion (`KG_POTIONS_PER_SIDE`, healing up to `KG_POTION_HEAL`) - by any piece. Melee reaches one cell; a ranged piece
reaches `KG_RANGED_RANGE` with a sight line. A blow deals attack x (0.8 to 1.2), from the game's seeded source.

**Hazards.** Fire, spikes and poison (`KG_HAZARD_DAMAGE`) lie in point-symmetric pairs. Three active pairs start the
game; every `KG_HAZARD_SPAWN_EVERY` rounds the warnings turn active and a new warning pair is laid, up to
`KG_MAX_HAZARDS`. A piece that ends its side's turn on an active hazard takes its damage. A side with no king or no
piece loses.

**Against a regular** (`src/systems/gambit/gambitTableSession.js`, `src/systems/gambit/gambitPatrons.js`). The setup
lists the regulars in the table's free chairs; the choice is the difficulty. Each regular's tier comes from the mod's
hash of their seed (`GAMBIT_TIERS`: Amateur, Seasoned, Veteran, Grandmaster), setting their points, potions, blunder
rate and least stake. Their army is auto-filled fresh each game. The stake is the least stake x 1, 2 or 5
(`GAMBIT_STAKE_MULTS`). A regular pays out at most `GAMBIT_NIGHT_MULT` (15) times their least stake a game day, net, kept
in a book on the save (`gambitPurses`, `GAMBIT_PURSES_BOOK_MAX` taverns). Saving is refused while a stake is down.

**Kings and crowns.** The kings are the Bay deck's four royals: Gothryd (Daggerfall), Eadwyre (Wayrest), Camaron
(Sentinel) and Gortwog (Orsinium), with the mod's king numbers (`KG_KING_LEVEL`, `KG_KING_HP`). The player's crown is
chosen at setup and kept on the character (`gambitCrown`), Daggerfall the first time. A regular's crown comes from their
seed; when it matches the player's, the next one is taken.

**The board on the cloth.** Each piece is the unit's Iliac card on a disc in its side's tone, a king's disc brass
(`src/world/gambitCloth.js`). A battle is played leaning over the board. Moves walk the path cell by cell; blows lunge;
the fallen topple and slide to their owner's pile. Highlights are told by shape as well as colour, and the log keeps
the last `GAMBIT_LOG_MAX` lines. The panel's words go through the text core (`src/ui/gambitTableWords.js`).

**Online** (`src/net/gambit/gambitTable.js`, run by the relay beside Hold'em and Iliac Hand). Two seats of a cloth's
chairs. Ready carries the army and crown; the relay keeps the army and tells the room only that the seat is ready. Both
ready, it deals `GAMBIT_FIRST_MS` later from its own random source. A turn has `GAMBIT_TURN_MS` (60 s); a turn run out
ends as End turn does, and a seat that times out `GAMBIT_IDLE_TURNS` times running is stood up and loses. A forfeit, a
stand or a dropped socket gives the game to the other seat. One cloth plays one game at a time across Hold'em, Iliac
Hand and The King's Gambit. Anyone at the cloth watches the board. The guest's page reads the board turned about its
middle, so each player sits at their own foot (`src/systems/gambit/gambitRemoteTable.js`).

**Gold online.** At the realm's red table a realm character stakes one of `GAMBIT_ONLINE_STAKES` (10, 50, 200, 1,000,
5,000) through the card tables' escrow, tagged `GAMBIT_STAKE_BB` so it is never mistaken for a Hold'em buy-in
(`server-account/src/cards.js`). Both stakes must match. The winner takes the pot; a void game returns each stake. A
King's Gambit cash-out is never more than twice its own stake.

**The season board** (`server-account/src/gambit.js`). A rated game between two accounts mints a `g1` receipt
(`src/net/gambit/gambitReceipt.js`), owed to both until acknowledged. `/v1/gambit/claim` writes one row a game with the
arena's Elo, season and pair caps; `/v1/gambit/board` shows the top ten. The season's #1 with `GAMBIT_CHAMPION_MIN_GAMES`
(10) rated games against `GAMBIT_CHAMPION_MIN_FOES` (5) foes holds the title **Grandmaster**, which lapses when another
takes the top.

## Rules

- The pieces are Iliac cards standing; the art is the port's own (the owner).
- The mod's roster stays whole, all 46 units; the nine without cards were painted into the Iliac set (the owner).
- The kings are the Bay's four (the owner).
- The offline opponent is a tavern regular, and choosing the regular is choosing the difficulty (the owner).
- The project has the mod author's permission (the owner).
- A regular's night is capped at 15 times their least stake; a game the rules leave undecided pays nothing either way.
- Online, a 60 s turn clock and three timeouts running forfeit the seat.
- Gold online is at the red table alone; the green table is friendly.
- The King's Gambit is a Features row, on by default.
- `src/net/kingsGambit.js` and `src/net/gambit/gambitTable.js` are in the relay's bundle: a change to them is a relay
  change (`test/net/relayversion.test.js`).

## Daggerfall Unity

Daggerfall Unity ships no such game; the mod does. Its rules are ported verbatim from its assembly (`TheKingsGambit`:
`GetReachable`, `InRange`, `HasLineOfSight`, `Attack`, `SpawnHazardPair`, `TierFor`). Departures: the pieces are Iliac
cards rather than the mod's sprites; its procedural particle blobs and IMGUI become the card table's panel and cloth;
its log keeps 12 lines, not two; its colours are replaced by the house's coat so nothing is told by colour alone; and
online play runs on the relay, not the mod's peer link.

## Code and tests

- `src/net/kingsGambit.js` - the game's law: board, roster, kings, commands, hazards
- `src/net/gambit/gambitTable.js`, `src/net/gambit/gambitStakes.js`, `src/net/gambit/gambitReceipt.js`, `src/net/gambit/gambitClaims.js` - the online table, stakes, rated receipts, claims
- `src/systems/gambit/gambitTableSession.js`, `src/systems/gambit/gambitPatrons.js`, `src/systems/gambit/gambitRemoteTable.js` - an evening with a regular, their play, the online mirror
- `src/scenes/gambitTableGame.js`, `src/world/gambitCloth.js`, `src/ui/gambitTableWords.js` - the table's game, the board on the cloth, its words
- `server/src/index.js` - the relay's King's Gambit table
- `server-account/src/gambit.js`, `server-account/src/cards.js` - the season board and the escrow
- `test/net/kg1_law.test.js`, `test/tooling/kg2_patrons.test.js` - the law, the regulars' play
- `test/systems/kg3_session.test.js`, `test/world/kg4_board.test.js`, `test/systems/kgset_cards.test.js` - offline play, the board, the nine cards
- `test/net/gambit/kg5_table.test.js`, `test/net/kg5_relay.test.js`, `test/net/kg5_client.test.js` - online play
- `test/net/gambit/kg6_gold.test.js`, `test/net/gambit/kg6_season.test.js` - gold and the season board

## Open

- `src/scenes/dungeonContext.js` stands no tavern, so it has no board online.
- The mod names no author; the credits use the unnamed form until the owner records one.
