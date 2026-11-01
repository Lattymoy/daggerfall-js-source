# The Event Board

A plate at the HUD's left edge, titled *World Events*, listing the shared events a player can still reach: Dagon's
Breach, the sea serpent, the Abyss Dungeon, fallen stars and town raids. Its head shows news when an event comes up or
begins. Event lines that once went to the chat go here instead, and every line is also filed in the journal's Messages
page. Each kind can be switched off.

## How it works

**Rows** (`src/systems/eventBoard.js` `eventBoardModel`, drawn by `src/ui/eventBoard.js`). A row is an event under way,
counting to its end, or one starting within `EVENT_SOON_MS` (15 minutes) once its place is known. It shows the name, the
clock, the distance and direction from the player's map pixel ("12 km SW", "Nearby"), then the place, and for a
running raid its count where the relay keeps one. Live rows come first, each soonest first. The raids shown are the
nearest two; the rest are counted ("2 more in Timers"). An event no one can join any more leaves the board.

**Place.** The plate stands under whatever is above it at the left edge (the chat's peek, the open chat, the Social
panel) and its room runs down to the first HUD piece below. On the classic skin the floor is `EVENT_CLASSIC_FOOT`
(22% of the screen). It wears the HUD's scale. It shows four rows on a screen 900 px tall or more, three below that,
and fewer until it fits. Where not even its news fits, the news goes to the HUD's line and the plate stands down.

**News.** An announcement opens when an event comes onto the board and when it begins, in its kind's color, and the
event's own lines ride it as notes. A line carries its event's id where a kind has several at once (`star:...`,
`raid:...`). One news shows at a time for `EVENT_TOAST_MS` (9 s); a joining line gets at least `EVENT_NOTE_MIN_MS`.
The same line twice within a minute is one. Only events that came up after the board's first read, less
`EVENT_SEED_GRACE_MS`, are news, so late-loading state announces nothing old. A hidden polite live region speaks each
news once.

**Who is told.** The board lists every event it carries wherever the player stands. News of a gate, serpent, Abyss
Dungeon or star goes to every screen. A raid's news goes only to players in its region (past the Bay, the province's
district) or within `EVENT_RAID_REACH_M` (25 km).

**Stars.** `src/systems/starfall/starfallClient.js` `starTimerRows` names every star's town from `STAR_WARN_MS`
(10 minutes) before it falls. The sites are found from each client's own map files, so nothing new is sent.

**The door** (`src/systems/eventNotices.js` `eventNotice(kind, text, id)`). Every event line goes through it: it is
filed in the journal and taken into the board's news on the next HUD frame. Producers: `src/systems/gate/gateOmen.js`,
`src/systems/serpent/serpentOmen.js`, `src/scenes/superDungeon/sdHost.js`, `src/scenes/starfall/starfallHost.js`,
`src/systems/raidingParties.js`, `src/scenes/witchesHost.js` and `src/scenes/seasonHost.js`. Claims, receipts, spoils,
Motherlode lines, server notices and players' words stay in the chat.

**Hosts.** `src/ui/hud/hud.js` `drawHud`, called by every host, draws the board under the HUD's hide gate. Only
`src/scenes/world.js` seats a source (`seatEventBoard` over its `timersSource`) and runs event producers; the other
hosts draw an empty board. A dropped link keeps the board on the local clock and the last records heard.

## Rules

- Event notices go somewhere less obstructive and more detailed than the chat (the owner).
- Players can filter which kinds show (the owner asked for a full fix, not a patch).
- The kinds have one home, `src/systems/features.js` `EVENT_KINDS`: gate, serpent, super (Abyss Dungeon), star, raid,
  festival and season. The festival and season are news only, with no board row.
- The switch is Features `event-board` (pref `eventBoard`, on, every skin). Each kind is a part of that row, pref
  `eventBoard-<kind>` (`eventKindPref`), on by default. A kind turned off is dropped before the row cut, announces
  nothing, and its lines are filed in the journal only. With the board off, every line goes where it went before: a
  raid's to the HUD line, others to the chat.
- Under Enhanced Plus the plate is a movable HUD piece (`events` in `src/ui/hud/hudLayout.js`).
- The Timers window under the pause menu stays the whole schedule, whatever the chips say.

## Code and tests

- `src/systems/eventBoard.js` - the model, cut, news memory and constants
- `src/ui/eventBoard.js` - the plate, its place and news
- `src/systems/eventNotices.js` - the door every event line uses
- `test/systems/events1_board.test.js` - the law, kinds, filters, the door
- `test/ui/events1_board_ui.test.js` - the plate, its fit, chips, dress
- `test/systems/starfall/star6_words.test.js` - the stars' warning
- `tools/eventBoardProbe.mjs` - the board over the real HUD in Chromium at many sizes

## Open

- How often events come is unchanged; players asked for more raids. That is the owner's balance call.
- The map shows a raid's ring only while it runs.
- The board gives distance, not travel time.
- On the classic skin with retro aspect correction, the board (like the chat) stands over the black pillarbox bar.
