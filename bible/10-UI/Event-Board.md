# The Event Board (EVENTS1, 2026-10-23)

The owner, 2026-10-23, over the Discord's #feature-feedback threads "Make announcements for Fallen Stars and Town Raids"
(PanickedTofu: "I only ever get a notification about them AFTER they've been claimed by other players... Nothing feels
worse than spending 5 minutes to fast travel to a point only to arrive to nothing") and "Things are starting to get
worse" (EvoAva, on raids): "On the topic of event notifications. Instead of stuffing these in the chat menu, there must
be a less obstructive and more detailed way to handle them."

Not a DFU member: Daggerfall has no shared events. Ledger A row EVENTS1 (`01-Overview/Port-Ledger.md`). Audited the
same day, every finding fixed or recorded: AUDIT EVENTS1, `01-Overview/audits/Audit-Event-Board.md` - this page is the
design as it stands after it.

## 1. What was wrong

- **Every shared event spoke in the chat.** The gate's omen, rise, opening, seal and collapse, the sea serpent's bells and
  its kill, the Abyss Dungeon's find, kill and fading, a fallen star's omen, landing and hold, and the Witches'
  Festival's nights were each a sentence on the chat's every tab (`scenes/world.js` chatNotice, `net/chat.js` pushAll),
  between the players' own lines, said once. The only other place to read them was the Timers window under the pause
  menu (TIMERS1, `ui/enhanced/enhancedTimers.js`).
- **The stars spoke too late, to too few.** A star's omen and its landing were said to its own region alone, 90 seconds
  before it fell (`STAR_OMEN_MS`); its hold was said to everyone. A player anywhere else heard of a star only once it was
  taken - PanickedTofu's report exactly. The Timers row named the next star's town only from its omen too.
- **The raids spoke only at the start, to the region, on the HUD's line.** The mod's `AddHUDText` lines
  (`systems/raidingParties.js`, fix 8: DFU's PopupText - the top of the classic panel, the notices' stack under Enhanced
  Plus - which files each line in the journal's Messages page as it goes) and the map's ring (`ui/eventMapMarks.js`),
  which stands only while a raid runs - two classic hours, ten real minutes, against a fast travel of five. PanickedTofu:
  "I only see them on my map either right before completion or after they're done."

## 2. What ships

**THE BOARD** (`ui/eventBoard.js`, its law `systems/eventBoard.js`). One plate at the HUD's left edge, titled *World
Events*: the shared events a player can still reach. A row is an event under way (counting to its end) or one coming
within `EVENT_SOON_MS` (15 minutes) once it says where - the gate from its omen, the serpent from its bells, every star
from its warning (section 3), a raid from its roll (a raid early in a day from a quarter hour before the day turns:
raidTimerList looks ahead to the next day's roll, which is the day's own). An event no one can join any more leaves it -
the gate sealed, the Abyss Dungeon collapsing after its kill (the Timers window's `shut` rows). Each row says, in the
player's words, its name (*Dagon's Breach is open*, *Raid on Ilessan Hills*), its clock (*9:00 left*, *in 4:30*), how far
and which way from the player's map pixel (*12 km SW*, *Nearby* on the same pixel - a pixel is `PIXEL_M`, 819.2 m; the
number in the language's own form, tenths under 10 km), then where (*Near Copperham*, *Off Sentinel*) - the way first,
so a long place name cut at the plate's edge never cuts the distance - and, for a running raid, its count where the relay
keeps one (*Raiders down: 7 of 18*). Live rows first, each soonest first. The raids on it are the nearest two of the
day's (about twenty-two across the Bay). The rest are counted (*2 more in Timers* - the window's own name, which is not
translated). The resets, the seat week, the battles and a company's Elite Breach stay the Timers window's alone - they
are schedules, not places.

**ITS PLACE, MEASURED** (AUDIT EVENTS1 B1-B5). The plate stands at the left edge under whatever stands above it there -
the chat's peek however wide the player made it, the open chat, an open Social panel - and never higher than its home
(`clamp(244px, 40vh, 460px)`). Its room runs down to whatever crosses its span below that - the status widget, the quick
slots, the hotbar, the vitals, the touch buttons, the travel bar, the party list; on the classic skin, the canvas vitals'
foot (`EVENT_CLASSIC_FOOT`, 22% of the screen). It wears the HUD's scale (`--hud-scale`, copied off `.hud` as the loot
banners do). Its rows are four on a screen 900 px tall or more, three below that, and a row fewer until the plate fits its
room; where not even its news fits, the news is said on the HUD's line (DFU's PopupText, as the raids said theirs) and the
plate stands down until there is room. A plate with nothing left on it stands down too. The status widget never makes
way for it: the widget keeps its place, the board fits above it.

**THE NEWS** at the board's head, in its kind's colour (the serpent's, the Abyss Dungeon's and the star's their map
rings'; the gate's, the raids' and the festival's the board's own). It opens when an event comes onto the board
(*Starfall · Starting soon*) and when it begins (*Town Raid · Under way*) - an ANNOUNCEMENT, the board's own - with the
event's name, clock, way, place and detail; and the events' own lines ride it as its notes. A NEWS IS ONE EVENT'S
(AUDIT EVENTS1 A1, A7): a line comes with its event's id where its kind has several at once (a star's `star:<night>.<k>`,
a raid's `raid:<key>`) and joins that event's news, or one of its own; a gate's, a serpent's, an Abyss Dungeon's or the
festival's line joins its kind's (one event at a time). A line whose event has left the board - a star's hold, a raid's
cleansing - stands alone, never under another event's row. While a news stands, its row leaves the list (the news is the
row, opened). One at a time, `EVENT_TOAST_MS` (9 s) of shown time each, the rest waiting; a line that joins a news
already showing has at least `EVENT_NOTE_MIN_MS` (5 s) of its own; its clock stops while the HUD is hidden. The same line
twice within a minute is one.

**WHAT IS NEWS** (AUDIT EVENTS1 A5). The board watches from its first read of the world: a row is news when its event came
onto the board no earlier than `EVENT_SEED_GRACE_MS` (5 s) before that read - each row says when (`since`: the gate's
omen or opening, the serpent's bells or rising, a star's warning or fall, a raid's horizon or start, the Abyss Dungeon's
find). So the parts of the world that fill in late (the stars' scan, the omens' places, the hub's Abyss Dungeon, the
raids' roll) announce nothing that stood before the page opened, however late they come.

**THE VOICE** (AUDIT EVENTS1 B7): a visually hidden, atomic, polite live region, made once, written once when a news first
shows and again only when a line joins it - never its clock. The plate itself is `aria-hidden`.

**EVERY LINE IS KEPT** (AUDIT EVENTS1 C4, C5): each line is also filed in the journal's Messages page (the host's
`townTalk.hudMessageSink`, where DFU's AddHUDText files every HUD line and the raids' lines were filed), so a news dropped
past the six kept, or said while the board was off its frame, is read there - once: a line said again on the HUD's line
(no room, or the board switched off with it in hand) is not filed again (`eventHudLine`).

**WHO IS TOLD.** The board lists every event it carries wherever the player stands. The news announces every gate,
serpent, Abyss Dungeon and star to every screen; a raid only where the player stands in its region - the raids' own
region (`raidRegionNow`, the mod's rule: none at sea past the Veil, AUDIT CAPTAIN'S SEA G7) - or within
`EVENT_RAID_REACH_M` (25 km).

**THE DOOR** (`systems/eventNotices.js`): `eventNotice(kind, text, id)` is what each event's line goes through now. It is
filed in the journal and waits until the HUD's next frame takes it into the board's news - so a line said from a relay's
word, a frame or a promise is drawn once.

| line | said by | before | now |
|---|---|---|---|
| the gate's omen, rise, opening, seal, collapse, rite, marks, portents | `systems/gate/gateOmen.js` (`say`) | chat, every tab | news, `gate` |
| the gate's fall | `scenes/world.js` (`onFell`) | chat | news, `gate` |
| the rite broken | `scenes/world.js` (createRiteHost `say`) | chat | news, `gate` |
| the serpent's bells, rising, seal, dive; its kill | `systems/serpent/serpentOmen.js`, `scenes/world.js` | chat | news, `serpent` |
| the Abyss Dungeon's find, marks, kill, fading, Hour | `scenes/superDungeon/sdHost.js` (`say`) | chat | news, `super` |
| a star's omen and fall (its region), its hold (everyone) | `scenes/starfall/starfallHost.js` | chat | news, `star`, its id |
| a raid's attack, withdrawal, cleansing | `systems/raidingParties.js` (`say`) | `AddHUDText` (hudText, the journal) | news, `raid`, its id; the journal |
| the festival's open days and its nights | `scenes/witchesHost.js` | chat (online; offline nowhere) | news, `festival` |

What stays in the chat: the claims, receipts and spoils (each a line to the player alone), the Motherlodes' regional
lines (`net/motherlodeBook.js`), the server and build notices (SRV-N), the party's rest, and every player's words.

**THE SWITCH** (`systems/features.js` `event-board`, the Interface tab's Messages & prompts, prefs key `eventBoard`, on
by default, every skin): off - or, under Enhanced Plus, the board's piece put away with the HUD editor's X (AUDIT EVENTS1
B8) - the board comes down, forgets what it read (B9), and each line goes where it went before, a line already taken in
that frame too (C4): a raid's to the HUD's line (the mod's `AddHUDText`), every other to the chat the host seated beside
its source (the HUD's line on a host that seated none). **MOVABLE** under Enhanced Plus (`ui/hud/hudLayout.js`
HUD_PIECES `events`, `.evhud`): the plate is off the page while nothing stands on it, so the editor's preview stands in
for it (B6). **DRESSED** as the star's tracker is: Enhanced Plus's kit panel (`ui/enhanced/enhancedFrame.js` FRAME_ROLES
`panel`), the kit's rules cut to it on the classic skin, its ink and shadow on the plate the dresses ink (B11).

## 3. The stars' towns, said earlier

`systems/starfall/starfallClient.js` starTimerRows names EVERY star's town (and carries its map pixel) from
`STAR_WARN_MS` (10 minutes) before it falls - the night's three falls are 7.5 minutes apart, so two can be coming at once
(AUDIT EVENTS1 A3) - and the soonest beyond the warning without its town, where it had named only the next star, and from
its omen (90 seconds). The sites are already every client's own (found over the client's map files), so nothing new is
sent; the Timers row and the board say it at once, and the board's news announces it to every screen. The omen and the
landing stay the region's lines, as `11-Multiplayer/Starfall.md` section 8 has them - in the news now.

## 4. Where it stands (measured)

`tools/eventBoardProbe.mjs` draws the board over the real HUD in Chromium - the enhanced HUD through `drawEnhancedHud`
(its buffs in the status widget), a live chat panel (its peek full, widened by the player, or open), the quest card and
the party list - on Enhanced Plus and the classic skin at 1920x1080, 1280x720 (two buffs and six), 1280x600, 1024x700,
1024x560, 844x390 and 390x844, and at 1280x720 with the HUD's scale 1.5. Wherever the board stands it fails on any
overlap with the chat, the quick slots, the buffs, the vitals, the hotbar, the compass, the quest card, the party list
or the temperature plate, or anything outside the screen; wherever it stands down it fails unless its news reached the
HUD's line; on a desk it fails unless the board and its news stand. As measured: a desk shows the board; six buffs at
720 px, the HUD's scale 1.5 at 720 px, an open chat under Enhanced Plus and a phone on its side leave it no room, and its
news goes to the HUD's line. The classic skin's canvas HUD is not drawn there: the classic foot stands for it.

## 5. The four hosts

`ui/hud/hud.js` drawHud - the one call all four hosts make - draws the board under the HUD's own hide gate, and
`hideHudTextSurfaces` reaches its hide door, so the board and its news stand in every host. The SOURCE is seated by one:
`scenes/world.js` (its `timersSource`, wrapped where it is made - `seatEventBoard` answers the function as handed - with
the chat for the switch off and `townTalk` for the journal). `scenes/exterior.js` (the fixed-city bench),
`scenes/worldModes.js` (interiors, the streaming host's own modes - its board is the world's) and
`scenes/dungeonContext.js` (the standalone dungeon) seat none, and no event's line is said there: every event producer,
the raids' included, runs in `scenes/world.js` alone (offline raids on its own offline path, where the source is none and
the board lists nothing). The host grew no line: the raid list moved out of `timersSource` to `systems/raidingParties.js`
raidTimerList (with each town's pixel, its ledger and its key), which paid for the player's pixel, the three sites and
the raids' own region on the source (`test/scenes/hostceiling.test.js`: 36,283 -> 36,281).

The source turns non-null once the relay's clock is heard and never turns back: a dropped link keeps the board reading
the local clock and the last records heard (the Timers window does the same).

## 6. What it does not do

- **How often events come** is unchanged: three stars an hour while the festival runs, about twenty-two raids a two-hour
  day across the Bay, the gate every game day. PanickedTofu and EvoAva also asked for more of them (EvoAva: more raids
  where too many players go to one); that is a balance call, the owner's, left open here.
- **A raid on the map before it starts.** The map's ring (`ui/eventMapMarks.js` raidMapMarks) still stands while a raid
  runs; the board names a coming raid a quarter of an hour ahead.
- **Travel time.** The board says how far, not how long: a trip's real time depends on the travel mode and the Overworld.
- **The retro pillarbox on the classic skin** (AUDIT EVENTS1 B12, recorded): `--ui-pillar` is written by the enhanced
  HUD alone, so on the classic skin with retro aspect correction the board, like the chat, stands over the black bar.

## 7. Proof

`test/systems/events1_board.test.js` (17: the way, the law's numbers, the gate and the serpent, the Abyss Dungeon, the
stars through starTimerRows, the raids through raidTimerList, the count and the region, the look ahead, the cut, the
announcements, the news, the door, the journal once, and EVENTS2's four - section 8), `test/ui/events1_board_ui.test.js` (10: the plate on a fake document, its place
measured, its fit, the news, what stood before, the switch, EVENTS2's chip on the plate, the scale, the dress and the piece, the seams),
`test/systems/starfall/star6_words.test.js` (the warning), `tools/mutants/events1.json` (133, all dead - EVENTS2's 32
among them), and `tools/eventBoardProbe.mjs` (every case above, all clear).

## 8. Each kind the player's own (EVENTS2, 2026-10-24)

The players on Discord, five of them behind it: "Allow us to filter which events we want to show up in the event
tracker" - "I don't want all this crap cluttering up my interface". The owner: "No band aids".

**THE DEPARTURE.** Daggerfall Unity has no event board - no shared events, no news of them and nothing to filter - so
this departs from no DFU member; it widens the port's own board (Ledger A row EVENTS1, `01-Overview/Port-Ledger.md`).

**ONE HOME FOR THE KINDS.** The six kinds - the gate, the sea serpent, the Abyss Dungeon, a fallen star, a town raid and
the Witches' Festival - stood in four lists: the board's rows (`EVENT_BOARD_KINDS`), the door's (`EVENT_NOTICE_KINDS`),
the headings (`EVENT_KIND_TEXT`) and the marks (`EVENT_KIND_CSS`), with the single kinds a fifth. They have one home
now, `systems/features.js:"export const EVENT_KINDS ="`: each kind's name in the player's words (the news's heading and
the chip's - the `events.kind.*` words, already translated), whether it is a row on the board (the festival is news
alone) and whether it has one event at a time. It is declared there with the row whose chips they are, as the Windmills'
key is: `uiPrefs` reads that page's defaults, so it cannot import the door or the board without a cycle, and the page
is already on the boot path (BOOT2's reach stays 84). The board's rows, the single kinds, the headings and the door's
kinds are derived from it; the marks are the Timers window's colours and stay the plate's, and a pin holds them to the
same kinds.

**THE SWITCHES.** Each kind is a part of the Event board row (`event-board`), its pref `eventBoard-<kind>`
(`systems/features.js:"export const eventKindPref ="`), on by default and the player's own online. They are declared on
the row as the blood row's three are (`also` and `parts`, FT18), so the drawer the row already had draws them as toggle
chips under its tile - in Settings and on the Features page alike - and Defaults sets them back. The row's note says
what they do.

**THE LAW** (`systems/eventBoard.js`). `eventBoardModel(src, { shown })` drops a kind turned off BEFORE the cut: its
rows free their places (with the raids off, the coming star takes the row a raid had), and "N more in Timers" never
counts it. The model's `all` is what the board may show; its `every` is every kind's rows, uncut. eventAnnouncements
keeps its memory over `every` and announces no kind turned off, so a kind turned back on mid-event announces nothing
that stood while it was off: a star that fell then comes back onto the board, never as news, and one that falls after
it is news again.

**AT THE DOOR** (`systems/eventNotices.js`). `systems/eventNotices.js:"export const eventKindShown ="` stands beside
`eventBoardOn`, and `eventNotice` reads it after the board's switch: a line of a kind turned off is filed in the
journal's Messages page and said nowhere else - no news, and not back on the chat, which is what the players asked to be
spared. With the board off, every line goes where it went before whatever its kind (section 2, THE SWITCH).

**ON THE PLATE** (`ui/eventBoard.js`). The chips are read every frame. A chip pressed has the source read again at once,
so its rows leave with no wait for the next read; a line of it still waiting at the door is let go, and a news of it
showing or waiting is taken down (`ui/eventBoard.js:"for (const k of hiddenKinds) toasts.drop(k);"`). Each of those
lines is in the journal already, where the door filed it.

**WHAT IT LEAVES.** The Timers window under the pause menu is the whole schedule, every kind, whatever the chips say.
The plate takes no pointer still: the chips are the row's, never the HUD's.

**THE FOUR HOSTS.** No host grew a line (HOST-SPLIT): the filter is read where the board and the door read the player's
prefs. `scenes/world.js` seats the source as section 5 says and is unchanged. `scenes/exterior.js` (the fixed-city
bench), `scenes/worldModes.js` (interiors - its board is the world's) and `scenes/dungeonContext.js` (the standalone
dungeon) draw the board through drawHud as before and say no event's line, so the chips change nothing there.

**PROOF.** `test/systems/events1_board.test.js` - the one home and the row's parts, the cut with a kind off, the memory
turned back on, the door and the drop; `test/ui/events1_board_ui.test.js` - a chip pressed on the plate, the marks, the
Timers window untouched; `tools/mutants/events1.json` - 32 new records, each dead, and five of EVENTS1's re-aimed at the
lines this moved (section 7's 133, all dead).
