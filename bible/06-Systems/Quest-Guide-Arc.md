# Quest-Guide-Arc (ACTIVE)

Opened 2026-09-29, Mac: *"How can we set the foundation and improve the
quest system substantially? Like really modernize it, make it more
accessible"*.

THE ANSWER, IN ONE PARAGRAPH. The quest MACHINE is finished and it stays
DFU's: Port-Doctrine lists "quest machine (quest script parsing +
execution)" among the things ported 1:1, and `06-Systems/Quest-Arc.md`
is its record. What is not modern is everything the PLAYER sees of it -
a journal of raw entries, no word when the journal changes, no way from
an entry to a place on the default skin, a deadline in one tab, nothing
marked anywhere, and an accessibility lane nobody has walked. So the arc
builds a layer of the port's own OVER the machine and never in it: one
read-only picture of the player's quests (GUIDE1, THE QUEST LENS -
SHIPPED), and on it the faces, each its own slice on the enhanced skin
with its own switch - and, where it departs from DFU, its own Ledger A
row, which is Mac's to approve (Port-Ledger's charter). The classic skin
stays DFU's, byte for byte.

## WHAT THE PLAYER HAS TODAY (the map, 2026-09-29)

Three read-only lanes walked the tree before a line was written (the
presentation surfaces, the machine's data, the bible's asks and rules).
What they found, with the gap each surface leaves:

| Surface | What it shows | The gap |
|---|---|---|
| Pause window, Quests tab (`src/ui/enhancedMenu.js` pauseQuests; PX4, PX22, QT-LIVE1) | Main / Side / Archived rail; the LATEST entry as the description; the trail newest-first; the live "Time remains", gold under a day | No "where"; no way to the map; and "latest" was the last entry of the machine's first-logged order - a step logged again showed a superseded entry (GUIDE1 fixed) |
| Chronicle (`src/ui/enhancedChronicle.js`, the L key; MAC-K2) | A card per quest, entries newest first, fold, Share to the party | No timer, no Main/Side split, no "where" |
| Classic logbook (`src/ui/questJournal.js`, U32) | DaggerfallQuestJournalWindow verbatim, with HandleQuestClicks' "Travel to location?" | None - it is DFU's |
| Quest popups (`say`, `prompt`) | The enhanced notice panel (ENH-NOTICE1) or DFU's parchment | None by themselves |
| News | Nothing. `log` is a bare addLogStep; no "journal updated", no "quest complete" (DISC6's player: "Theres no quest notification when you killed all monsters and no quest update in the log") | Everything |
| Marks | One: a residence an NPC marked, named on the town map (`stampResidenceQuestNames`, the town sheet's ring) | Nothing on the travel map, the held map, the compass or the dungeon map |
| The way there on the ENHANCED skin | Nothing: only the classic logbook ever calls `gotoPlace`, so the held map's consumer (`heldMap._consumeGotoPlace`) is never reached | DFU's own feature, missing on the default skin |
| DFU's quest debugger | `GUI/EnableQuestDebugger` is stored and read by nothing (no HUDQuestDebugger port) | DFU's, unported |
| Accessibility | The Settings Accessibility category: 19 DFU keys, no port rows; `textScale` dead since the old settings window (`01-Overview/Audit-54.md`); `play/index.html` sets `user-scalable=no`; no contrast or screen-reader audit (`01-Overview/Audit-UI.md`, `01-Overview/Audit-UI-2.md`); the notice stack is `aria-live="polite"` | A lane, empty |

## THE LAWS (every slice of this arc)

1. **THE MACHINE NEVER KNOWS.** No face writes quest state, and no face
   reads the journal the loud way (below). A game with the arc's faces
   and a game without them are the same game - pinned, not promised.
2. **NOTHING THE JOURNAL HAS NOT SAID.** PX4's law, made operational: "a
   Daggerfall quest speaks in journal entries, not objective flags: the
   entries ARE the tasks, and inventing checkbox objectives the machine
   does not track would be a lying UI" (`10-UI/UI-Arc.md`, PX4). A face
   shows an entry's words, the place DFU's own logbook would travel to
   from it, and of that place only what the entry says or DFU's
   find-place box would say. A face that wants more - a marker inside a
   dungeon - is an opt-in tier with its own row (GUIDE8), never a default.
3. **ONE WALK.** `questBridge.questLog()` (MAC-K2) walks the machine;
   `ui/questRail.js` decides which entries and in what order; the lens
   adds the rest. A face never walks the machine, and never builds a lens:
   the bridge makes the one (THE ONE CONSTRUCTION SEAM), so every host
   that has quests has it.
4. **THE CLASSIC SKIN IS DFU'S.** Every face asks `isEnhanced()`; the
   classic logbook, parchment and HUD are untouched.
5. **ACCESSIBLE BY CONSTRUCTION.** Every face is DOM on the enhanced
   skin: its text scales, news is `aria-live`, a state is never colour
   alone, `prefers-reduced-motion` is honoured, and a keyboard and a pad
   reach every control a mouse does.
6. **THE FOUR HOSTS.** A face fed through the bridge reaches all four
   hosts at once; a face wired through a host names all four in its
   record, each wired or flagged (Home.md, THE FOUR HOSTS RULE).

## GUIDE1 - THE QUEST LENS (SHIPPED 2026-09-29)

`src/ui/questLens.js`, made once by `createQuestBridge`
(`src/scenes/questBridge.js`, `bridge.lens`) and reset by its `restore` -
a loaded game's quests are the lens's baseline, not news. No face draws
from it yet; it is the floor every face of this arc stands on.

**What a look answers.** `lens.look({ canFindPlace, currentLocationName })`
- the classic logbook's own two gates, the host's - returns
`{ quests, events }` (AUDIT GUIDE O3: the archive is the journal
windows' own read, never the lens's). A quest view is its title (questRail's
`questTitleOf`), `main`, the deadline its own entries NAME (AUDIT GUIDE
H1: the tightest running counting clock a `=clock_` in a logged entry
names - a closing clock or a letter's arrival is the script's, not the
player's; the pause tab's "Time remains" keeps main's tightest counting
clock, DEAD-CLOCK's) and whether it is `urgent`, its entries in the order they were WRITTEN
(each with its step, message, time and lines; the latest with its target
too - AUDIT GUIDE O3/L5: nothing read an older entry's, and each one
asked the map every look), the `latest` of
them, `updatedAt`, and `target` - the latest entry's, never an older
one's: a quest that has moved on points where it points now. The events
are what changed since the previous look: `started`, `updated` (naming
the new entries - a step and message not written before: the same words
logged again at a new time are no news, AUDIT GUIDE H4), `urgent` (the
named deadline crossing under
`QUEST_URGENT_SECONDS`, one home in `ui/questRail.js`, shared with the
pause window's gold line), and `completed` / `ended` - the notebook's
own two verdicts, off the walk's new `ended` list (a quest the machine
has completed and still holds as a tombstone, with `questSuccess`). The
first look, and the first after a reset, is the baseline and says
nothing. A quest that lost every entry to `remove log step` leaves the
journal without an ending and, when it writes again, is `updated`, not
new.

**THE QUIET READ.** An entry's text is not free to read. The journal's
own read, `Message.getTextTokens` - DFU's logbook and the port's - reveals
the talk topics the entry names (QuestMacroHelper's reveal arm), latches
the quest's LastResourceReferenced, LastPlaceReferenced and
CurrentLogMessageId, re-seeds DFRandom (%n %fn %mn) and draws the quest's
own rolls (%god %olf). DFU's logbook does all of it each time it is
opened; a lens that read on every change would do it at moments no
player chose, and a talk topic would open because a HUD line was drawn.
`quietTokens` reads with the reveal off - `getTextTokens`' new fourth
argument, whose default is C#'s literal `true`, so every DFU caller is
unchanged - and puts the three latches, the seed and the rolls back,
including when the expansion throws. Measured over all 3,817 messages
of the corpus, from the same states, the journal's read moves 1,895
reveals, 1,761 resource latches, 846 place latches, 15 log ids, 7 seeds
and 94 roll draws; the quiet read moves none of them and prints the same
words. Two recorded differences:

- **%god's random arm** (a region with no temple of its own) answers the
  FIRST divine, because the quiet roll draws nothing. DFU's logbook
  re-rolls that word on every open, so no one value of it is the
  journal's.
- **Fifteen corpus messages** throw on DFU's own %di NRE when nothing has
  referenced a Place yet (LastPlaceReferenced.Scope before the null
  check; the corpus gate meets three because its reads latch in
  sequence). None of the fifteen is ever logged, so no journal entry is
  one; the quiet read answers null for each, puts the latch back and
  says so once.

Lines are read once per entry and kept; a macro that reads the world as
it is (%di's direction, a countdown's days) goes stale in a kept line, so
the bridge calls `rereadText()` each game hour (AUDIT GUIDE L6: nothing
called it, and the card's "I have 30 days" stood while its own time row
counted down). An entry that names a quest LETTER reads the letter's
signoff through DFU's own path (Item.expandMacro -> questLetterName ->
ExpandLetterSignoff), which reveals with no flag and draws the engine's
roll: the quiet read quiets both (AUDIT GUIDE L3 - latent, no logged
corpus entry names a letter).

**THE TARGET, AND THE SAID LAW.** `entryTarget` is DFU's
GetLastPlaceMentionedInMessage - the LAST Place any macro in the entry
names (DaggerfallQuestJournalWindow.cs:470-485), never
LastPlaceReferenced, which DFU's own comment says can point at an
unrelated home - and it now has ONE home: the classic logbook imports
`lastPlaceMentionedInMessage` from the lens and keeps no copy. Of that
place the lens gives only what is said: the building ONLY when the entry
names the building (`_p_`) - "a house in Daggerfall" stays a house in
Daggerfall; the town when the entry names it (`__p_`, `___p_`), when it
is on the player's map (DFU's find-place box names it) or when the
player stands in it - a claim never made where the map says no (AUDIT
GUIDE W2: a player cannot stand in a place their map lacks; a place of
the same name elsewhere is not it); the region only when the entry
names the region (`____p_`), the place is on the map or the player
stands in it (AUDIT GUIDE W1: the town's own name never unlocks it).
Only the target's own macros say anything. `find` is
what the logbook's Yes hands the travel map, present exactly when
HandleQuestClicks would offer the box: on the map, and not where the
player already is. The variant is drawn on a roll that draws nothing -
`getMessageResources` took the same `roll` seam `getTextTokens` carries,
Math.random by default - so a look never touches the engine's stream.

**THE WRITTEN ORDER - the one thing a player sees change.** The machine
keeps its log in a Map keyed by step, and `addLogStep` re-sets an
existing step in place, so the walk lists steps in the order each was
FIRST logged. A quest that logs step 0 again after step 1 still listed
step 0 first, and the pause window's description ("the LATEST log entry
as the description", PX4) and the chronicle's newest-first card showed a
superseded entry as the state of the quest. The bridge's walk now hands
each message the time its step was written (`steps`, aligned with
`messages`), and questRail orders a row's entries by that time
(`writtenOrder`, stable) - after READING them in the walk's order, the
logbook's, because a loud read latches the last-referenced resource and
place for the next entry's pronouns. The classic logbook keeps DFU's
order.

**Pins.** `test/guide1_questLens.test.js` (7): the feed over the real
bridge and machine; the order; the quiet read over every message of the
corpus; a whole game played twice, the lens re-reading and looking at
every tick and not - the same save, popups, topics, seed and roll draws,
and no draw from Math.random inside a look; the target and the said law
over producer-minted Places; the one homes. `test/questbridge.test.js`'s
MAC-K2 walk pin and `test/enhancedPause.test.js`'s PX22 timer pin grew
with the walk's `steps` and `ended` and the one urgent number.
`tools/mutants/guide1.json`: 38 mutants - 37 dead, and `GUIDE1-quiet-read-reveals`
equivalent as recorded since AUDIT GUIDE L3 gave the quiet read its own
silent hooks (the reveal flag is the first of two guards).

**Ledger.** GUIDE1 departs from nothing, so it has no section A row: the
lens is invisible to the machine; `revealDialogLinks` and `roll` are
seams whose defaults are DFU's; and the written order changes only what
the enhanced faces call "latest", which is what PX4 specified.

NOT SEEN IN A BROWSER - GUIDE1 has no face. The one visible change (the
latest entry) is pinned through the real walk.

## GUIDE2 - THE WAY THERE (SHIPPED 2026-09-29)

DFU's logbook has always taken a click on an entry to the place it names
(HandleQuestClicks: "Travel to location?", then the travel map opened on
the place). The enhanced skin - the default - never had it: only the
classic logbook ever called `gotoPlace`, so the held map's consumer
(`heldMap._consumeGotoPlace`) was never reached. GUIDE2 gives both
enhanced journal faces the way there, and says the place beside it.

**What the player sees.**

- **The pause window's Quests tab** (`ui/enhancedMenu.js` `questWhere`):
  under the quest's name and deadline, the WHERE LINE - the latest
  entry's target in the find-place box's own phrase ("Llugwych in
  Wayrest province", "The Feather and Dog, Bigtown in ... province",
  "Somewhere in ... province" with the region alone, "(you are here)"
  underfoot) - with **Show on map** beside it where a map can open, and
  "Not on your map yet. Ask around for directions." where the player's
  map is KNOWN not to have a named place (Daggerfall's own answer: ask,
  and an NPC marks it - `06-Systems/Talk-Arc.md`, THE COMPASS MARK). An
  OLDER entry naming a different place that is on the map carries its
  own small Show on map in the trail, because the classic logbook takes
  a click on any entry (offered once a place - by region and name, AUDIT
  GUIDE W5). The button's accessible name begins with its visible words:
  "Show on map: Llugwych in Wayrest province" (AUDIT GUIDE U12, WCAG
  2.5.3). The line and the button are the enhanced skin's alone: the
  classic skin's pause page reaches this tab too and draws neither (AUDIT
  GUIDE W3).
- **The chronicle** (the window the L key opens, `ui/enhancedChronicle.js`
  `questState`): the same line and the same way there on every live
  quest's card, under its head and standing when the card is folded -
  and the DEADLINE the pause tab has carried since PX5, which this
  window never showed, live once a second off the host's walk alone (no
  entry's text is read for it), gold under a day, a stopped clock
  repainting the card. One owner for its interval: every render and
  destroy clear it.

**The way there is DFU's own door, in DFU's order** (FindPlace_OnButtonClick):
the journal goes down, THEN the map is asked for with the place -
`gotoPlace({ siteDetails: find })`, the payload both maps already read.
The pause page keeps its own door law (AUDIT 27h A4): a HANDOFF, then the
door, and a map the host refuses resumes the game with DFU's refusal on
the notice stack. The chronicle closes itself first and reads the door
before the close (its destroy empties the module's deps). The street's
map door, `toggleTravelMap`, now answers whether a map opened - `true`
once it is in the slot, `false` from each of its nine refusals (six say
why first; a window already up with no place to go is silent, a pending
quest offer is shown instead - GiveOffer, DaggerfallUI.cs:612 - and a
party's travel question is asked; the journal's door always carries its
place, so of those three it meets only the offer: AUDIT GUIDE D6); the
travel callback inside it is untouched.

**THE FOUR HOSTS.**

| Host | The questions (is it on the map, is the player in it) | The way there |
|---|---|---|
| `scenes/world.js` - the street | its own (`canFindPlace` over the maps, `_questLoc`) | the door; the journal builder offers it only in exterior mode, because the same builder serves the interior host |
| `scenes/worldModes.js` - buildings | the street's (`host.questCanFindPlace`, `host.questLocationName`) | none: indoors DFU's map door refuses (IsPlayerInside), and a door that only ever says no is not drawn |
| `scenes/dungeonContext.js` - dungeons | the street's, delegated through worldModes the way the quest Share button's hooks are | none: this context owns no map |
| `scenes/exterior.js` - the fixed-town route | the city it stands in; no map to ask - and it hands its buildings' worldModes bag the same answer (AUDIT GUIDE W6: the Quests tab indoors had lost its "(you are here)") | none: it builds no travel map |

**THE THREE-STATE MAP.** A host with no map to ask hands no
`canFindPlace`, and the lens's `onMap` is now `null` there rather than
`false`: a face must not tell a player that a place is missing from a
map nobody looked at. With `null` the line names only what the entry
says, and offers no note and no way there.

**ONE HOMES.** DFU's `locationInRegionProvince` phrase moved from the
classic logbook into the lens (`locationInRegionText`; FIND_PLACE_TEXT
reads it); `remainWords` moved from the pause window into
`ui/questRail.js`, so the chronicle's deadline reads exactly as the tab's.

**Found on the way.** `test/chargenDom.mjs` had no `childNodes`, which
the Quests tab's PX22 meta line reads - so the tab had never been mounted
headless with a live quest in it; the minimal DOM carries it now. The
refusals' new `false` re-aimed four suites' door pins
(`test/audit64_travel.test.js`, `test/audit58_magic.test.js`,
`test/partytravel.test.js`, `test/fb0929_vampirehood.test.js` - AUDIT
GUIDE D2) and five other slices' mutant records by
content (`auditpartyui`, `auditpartyui2`, `party-travel`, `vamphood`,
`qtlive1`).

**NO LIVE TIMER IN A FACE'S SUITE** - learned the hard way, and a law for
every suite this arc adds. The first mutation campaign over GUIDE2 hung:
the pressed-chronicle pin mounted the window without a `finally`, so a
mutant that failed an assertion before the press left the chronicle's
real once-a-second interval armed, and the test process never exited
(`tools/mutate.mjs` waits on it with no timeout of its own). The suite
now RECORDS every interval instead of arming it - a pin fires one by
hand, and every mount asserts none is left standing - so a leak fails a
pin instead of holding the run open.

**Pins.** `test/guide2_wayThere.test.js` (6): the words over producer-
minted Places; the pause tab mounted and pressed (the handoff before the
door, the resume on a refusal, no door no button, the note, the unasked
map); the trail's older places (offered once); the chronicle mounted and
pressed (close before the map, the door read before the close, the line
on a shut card); the chronicle's live deadline; the four hosts by
source. `tools/mutants/guide2.json`: 24 mutants, 24 dead (25 until
AUDIT GUIDE W2 retired `GUIDE2-note-underfoot`: a place the map lacks is
never here, so the note's `!here` said nothing). Ledger A:
THE JOURNAL SAYS WHERE, AND TAKES YOU THERE.

NOT SEEN IN A BROWSER: both faces are driven headless over the minimal
DOM; the dress (`.px-qwhere`, `.cr-where`, the Plus button role) is
unlooked at on a real screen.

## GUIDE3 - THE HERALD (SHIPPED 2026-09-29)

DFU says nothing when the journal changes. A quest's `log` is a bare
addLogStep, `end quest` files the notebook in silence, and a clock inside
its last day is a number the logbook shows only when opened. DISC6's
player named what that costs (`01-Overview/Field-Bugs-2026-09-23.md`):
"Theres no quest notification when you killed all monsters and no quest
update in the log". GUIDE3 says the journal's news where the enhanced
skin says news - and nothing the quest itself says moves: its `say`
popups are the quest's, and stay the box they are.

**What the player sees.** A notice in the enhanced stack
(`ui/enhancedNotice.js`, ENH-NOTICE1/3 - the right edge; spoken through
the herald's own live region, below), one per quest, three rows in three
weights: the KIND ("New
quest", "Journal updated", "Under a day left", "Quest completed", "Quest
ended") in the sheet's small brass caps - a main quest's says so in words,
"New quest - Main Quest" (AUDIT GUIDE H10: never colour alone) - the
TITLE (questRail's `questTitleOf`; a main quest's in brass), and ONE
LINE - the newest entry's opening, or the time left in the journal's own
`remainWords` - and a deadline's notice that waited under a window says,
when the HUD shows again, the time the last look carries (AUDIT GUIDE H6).
An ending says only that it ended. A notice holds seven seconds of a
showing HUD (`HERALD_SECONDS`) and three quests at most (`HERALD_MAX`:
the least news first out, the oldest of equals - AUDIT GUIDE H5): every
word of it is in the journal, and the herald only points there.

**HOW IT IS SPOKEN** (AUDIT GUIDE H3/U19). A live region inserted with
its first words is often not read, and the stack's own region comes and
goes with its toasts. The herald keeps ONE empty live region of its own
(`#quest-herald-live`, polite, atomic, visually hidden) that stays while
the herald is on, and writes each notice into it once, whole - "Journal
updated: The Herald. The deadline moved." Its toasts are `aria-hidden`,
so nothing is read twice.

**ONE NOTICE PER QUEST.** Two pieces of news for one quest inside one
notice's life are one notice - its id kept, so the stack does not re-slide
it, and its clock restarted, moved to the stack's newest place - and the
one that stands is the one a player most needs: an ending is the last
word, a new quest stays new while its first entries land, and a deadline
outranks a routine entry while it is still under a day (AUDIT GUIDE H7:
a deadline that moved out of its last day is no longer the news).

**THE OPENING** (`entryOpening`, `ui/questRail.js` - one home, which
GUIDE4's tracker will read, beside `journalLines` and not in the lens: see
THE HUD STAYS LIGHT below). A logged entry is its author's 1996 text:
hard-wrapped for the logbook under a `%qdt:` date header. The opening
drops the header (built from `gameDate.js`'s own day and month tables,
so a sentence cannot be taken for it), joins the wrap, keeps the first
sentence (a stop before a capital: "Hmm... he said." is one), and past
`OPENING_MAX` (140) cuts it at a word with an ellipsis. Of the corpus's
408 logged entries, 395 open on the header, every one opens with words,
and 56 first sentences run past the cap (at 100 it was 159).

**WHO FEEDS IT.** The quest bridge (`scenes/questBridge.js`), after each
machine tick: one lens look, handed to the herald - only while it
listens (`heraldOn`: the enhanced skin, the `quest-herald` switch, and a
page to say it on - node drives the hosts headless and pays nothing).
THE ONE CONSTRUCTION SEAM again: every host that holds quests ticks the
bridge (`world.js`, `worldModes.js`, `exterior.js`), so the news reaches
all of them at once and no host carries a line of it. A herald that
starts listening mid-game hears a baseline first, never the backlog -
the lens's own: a look after a stretch with no look is one (AUDIT GUIDE
L8), and a lens the tracker kept looking has no backlog to skip (AUDIT
GUIDE H11: a flag of the bridge's own dropped the news of the tick the
herald came on in). A load is the lens's baseline already, and takes the
unloaded game's notices down with it (AUDIT GUIDE O2). A look - or a
face hearing it (AUDIT GUIDE L4) - that throws costs the news and one
warning, never the frame: the machine has ticked. The look is
GUIDE1's quiet one, and the pin plays a whole game through the bridge's
own tick with the herald listening and without: the same save, popups,
talk topics, seed, quest rolls and engine draws. It costs about 40
microseconds a look over three quests, at the machine's ten ticks a
second.

**ITS CLOCK IS THE HUD'S.** `ui/hud.js` `drawHud` - the one call all four
hosts make - draws it, OUTSIDE the skin's gate so that off (the classic
skin, the switch) it still reaches its hide door (AUDIT 64 F37): the
queue empties and the toasts slide out. It ticks on the frame's REAL
seconds (a news line is the port's page, not the world's: at a journey's
time scale it would be gone unread) and only while the HUD shows, on
LV2's hide gate: DFU's HUD does not Update under a window
(DaggerfallUI.cs:429-433, which midScreenText keeps), so news that lands
as a window opens waits for it to close. A dungeon's window returns above
drawHud and takes the HUD's hide door instead (`hideHudTextSurfaces`),
which hides the herald and the card too (AUDIT GUIDE O1). On a screen
under 520 pixels tall a notice keeps its kind and title (AUDIT GUIDE
H8: the stack's 90vh clip had cut it).

**THE HUD STAYS LIGHT - learned on the slice's first full run.** The
opening first lived in the lens, and the herald imported it from there.
But `ui/hud.js` imports the herald, and `save.js` reaches `hud.js`
(through the escort faces) from inside the quest layer: `place.js ->
talkTopics -> interiorPeople -> shopStock -> guilds -> factionRep ->
save.js -> hudEscortFaces -> hud.js -> questHerald -> questLens ->
place.js`, a cycle in which the lens read `SITE_TYPES` at load before
`place.js` had finished - a ReferenceError in every suite that loaded the
quest layer first (three of them). The opening moved to the rail, whose
imports are leaves, and the suite walks the herald's static imports:
they never reach the lens, the machine, `place.js` or the HUD.

**The stack, grown by two general seams:** a toast may carry a list of
rows (`drawEnhancedToasts` - PopupText's rows are still one each), and a
row record may carry a class of its own (`cls`, `paintRow`).

**No chime.** DFU's journal is silent, and a sound a player did not ask
for is not an accessibility feature; the stack is already read aloud.
A sound can be a row of its own when someone asks for one.

**The switch.** Features row `quest-herald` - Interface (beside Quick
slots, the HUD's other row), Enhanced, on by default (DECISIONS 2), the
player's own online (news is no one else's).

**Pins.** `test/guide3_herald.test.js` (8): the words; one notice per
quest (rank, cap, clock); the bridge's feed over the real bridge and
machine (one look after each tick and none between, the baseline, new,
updated, completed, ended); only while listening (the switch, the
classic skin, no page, the backlog, a look that throws); the machine
never knows (a whole game through the bridge's tick, heard and unheard);
the HUD's clock and the stack's face (the rows' classes, hidden and
stopped, run out, off at its hide door); one call, every host (by
source, and the herald's import graph kept off the quest machine); the
opening over the corpus. `test/enhancedNotice.test.js`'s
roster knows the herald as the stack's newest importer.
`tools/mutants/guide3.json`: 45 mutants (GUIDE4 added
`GUIDE3-small-word-kept`; AUDIT GUIDE D2). Ledger A: A QUEST'S NEWS IS A
NOTICE.

SEEN IN A BROWSER, NOT IN A GAME: the arc's first face looked at on a
real screen - headless Chromium over a harness page that feeds the real
module three notices beside a HUD toast (in the ignored `test-harness/`),
at 1280x720 and at a phone's 390x844: the kind in brass caps, the title
in the toast's yellow (a main quest's in brass), the opening in bone,
wrapping inside the stack's cap at both widths. Not yet seen over a
running game, which needs ARENA2.

## GUIDE4 - THE TRACKER (SHIPPED 2026-09-29)

DFU's HUD says nothing of quests: what a quest wants now, where, and by
when is a window away - and the enhanced journal (GUIDE2) is still a
window. GUIDE4 puts the quest the player follows on the HUD, quietly.

**What the player sees.** A card at the HUD's right-upper edge
(`ui/questTracker.js`, `#enhanced-questtracker`): the quest's TITLE (a
main quest's in brass, and its time row says "Main Quest" - AUDIT GUIDE
H10) behind a mark - the filled diamond for a quest
the player tracks, the hollow one for a quest the card is following -
the newest entry's OPENING (`entryOpening`, capped at 64 characters, so
two lines of the card), WHERE it points (the lens's `words`: the
find-place box's phrase, "(you are here)" underfoot) and the TIME LEFT
in the journal's own words - of a deadline the journal NAMED (AUDIT GUIDE
H1) - gold under a day as the journal's is. A
row with nothing to say is not drawn; with no quest to follow there is
no card.

**WHICH QUEST** (DECISIONS 2: on by default, but quiet). The one the
player TRACKS; else the one the journal last changed (the lens's news:
started, updated, urgent); else the one written last. An ending lets go
of both, and so does a tracked quest that is gone - checked every tick,
faces on or off, so no save carries a uid a later quest could be minted
under (AUDIT GUIDE T3). The choice is the journal's: one **Track** toggle
(`trackButton`, one home, `aria-pressed` carrying the state and one
constant name, "Track <quest> on the HUD" - AUDIT GUIDE T6/U13), and beside it the
note a screen reader learns the HUD's quest from - "On the HUD" (the
card), "On the compass" (the marks alone) - followed or tracked alike
(AUDIT GUIDE U14). It stands in both enhanced journal faces while either
face that follows is on (AUDIT GUIDE T2: the marks alone follow too) -
the pause window's Quests tab beside the clock, and every live card of
the chronicle - and a press changes it IN PLACE, and every other toggle
on the page with it: the focus stays, and no face is rebuilt under the
player (AUDIT GUIDE T5/U3). The Quests tab now OPENS on the quest the
card shows.

**THE PLAYER'S CHOICE IS KEPT, PER CHARACTER** - in DFU's per-mod save
slot (`systems/modSaveData.js`, IHasModSaveData) under the port's own
name, `QuestTracker`, by the quest's uid: a save writes it, a load
restores it, a save without the record (or with a record that is not
one) tracks nothing, and a new character tracks nothing. What the card
FOLLOWS is not a choice and is not kept: a load forgets it (the bridge's
`restore`), and the next look re-learns it.

**WHO FEEDS IT.** The bridge's one look a tick (GUIDE3), which now has
two listeners: the tracker hears EVERY look, the baseline too - it shows
the quests as they stand, not only what changed; after a stretch with
no face on, the first look is a baseline, not a diff against the look
before the gap, so the card follows the quest written last (AUDIT GUIDE
L8/T8). No face listening, no look. The look now asks the
host's own two questions (`ctx.questWhere`: is a place on the player's
map, which place does the player stand in - GUIDE2's gates and the
pause bag's own answers): `world.js` hands both, `exterior.js` the one
it can (the city it stands in; no map to ask). Each quest view carries
its target's `words`, computed in the lens, so the card reads them and
never imports the lens: THE HUD STAYS LIGHT, and this suite walks the
tracker's imports as GUIDE3's walks the herald's.

**WHERE IT STANDS** (a map of every HUD element the enhanced skin keeps
on screen, taken for this slice): the right-upper column, on the party
list's own line - 92 from the top, which clears the FPS read-out
(`ui/partyPanel.js`, AUDIT SOC C6) - with the touch screen's 76 as the
party list keeps it. Online the party list STEPS UNDER the card: the
card publishes its height (`--dfquest-h`, measured only when what it
says changed, 0 with no card or under a window) and the party list's
`top` adds it - the chat's `--dfchat-w` idiom - re-measured whenever the
card's box changes (a resize, a turned phone, a web font arriving: AUDIT
GUIDE O5/T4/U2), and on a short desktop window the party list is capped
above the screen's foot (AUDIT GUIDE U17). A phone takes the card at 104,
under the compass and the foe blade (the party list is at the bottom
there); the card takes the HUD's own scale and foe signature, so a
scaled compass never covers it (AUDIT GUIDE U8); a short screen keeps
the title and the time. It stands aside for the Overworld block and the
junction's disc (AUDIT GUIDE T1/D1/U7, TravelView's FURNITURE and
OW-NOTICES' `data-tview-block`) and, on a phone, for the chat's peek
lines (AUDIT GUIDE U1). Its plate holds every row at 4.5:1 over snow,
and keeps a solid colour under forced colours (AUDIT GUIDE U9/U10). It is drawn
on drawHud's one call, outside the skin's gate (off it is taken off the
page), hidden under the HUD's own gate, `aria-hidden` like the HUD's
other text - the herald is what speaks - and UPDATED, NOT REBUILT: a
still frame writes nothing.

**THE CUT, TWICE LOOKED AT.** Seen in Chromium, a two-line clamp cut a
90-character opening mid-word ("kil..."); the cap is 64 now, the clamp
allows a third line for a wide face, and `entryOpening` never ends on a
small word ("...to kill a..." reads "...to kill..."), which the herald's
cut takes too.

**No key this slice.** The plan named a key to cycle the tracked quest;
every letter is spent (KB1, `bible/10-UI/Controls.md`), so it would ship
unbound, as TravelView does - and the Track toggle already reaches it by
keyboard in both journal faces. GUIDE6's keyboard pass owns the quest
keys (DECISIONS 6).

**The switch.** Features row `quest-tracker` - Interface, beside
`quest-herald`, Enhanced, on by default, the player's own online.

**Pins.** `test/guide4_tracker.test.js` (9): which quest; the words;
the choice kept (the save slot); the bridge's feed over the real bridge
and machine (the baseline heard, the news followed, a tracked quest
through its ending, the host's questions and "(you are here)", no face
no look, no page no look); the machine never knows (a whole game with
the tracker and the host's questions at every look, and without); the
card (built once, aria-hidden, a still frame writes nothing, rows hidden
with nothing to say, the classes, hidden under the gate, the height
published and taken back, off at its hide door, the choice kept); the
journal's toggle in the Quests tab (and the tab opening on the card's
quest) and in the chronicle; one call, every host (by source, and the
import graph). `test/soc4_partyhud.test.js`'s position pins grew the
card's variable; GUIDE3's suite hears the herald alone (the tracker off)
and six of its feed mutants were re-aimed at the two-face gate and one
added, with `font1.json`'s GUIDE3 and `auditsoc.json`'s GUIDE4 re-aims
beside them (AUDIT GUIDE D2).
`tools/mutants/guide4.json`: 49 mutants. Ledger A: THE QUEST YOU FOLLOW,
ON THE HUD.

SEEN IN A BROWSER, NOT IN A GAME: the card in headless Chromium over a
harness page (in the ignored `test-harness/`) with a party list beside
it, at 1280x720, a phone's 390x844 and a short 844x390 - the party list
stepping under the card, the phone's card under the compass, the short
screen's title and time.

## GUIDE5 - THE MARKS (SHIPPED 2026-09-29)

Where a quest points, drawn where a player looks: the held map and the
enhanced compass (`ui/questMarks.js`).

**ONLY WHAT THE PLAYER'S MAP ALREADY HOLDS.** A mark stands exactly
where DFU's own logbook would offer the travel map - a target with
`find` (the lens's `entryTarget`: a place the entry names, on the
player's map by DFU's CanFindPlace, and not the place the player stands
in). A place named but not yet on the map gets no mark; it gets the
talk arc's answer instead, on the tracker's card, quietly: "Not on your
map yet. Ask around for directions." - which is what Daggerfall's
directions are for (`06-Systems/Talk-Arc.md`, THE COMPASS MARK: a
person who knows marks it). Nothing here is the quest debugger's
knowledge; GUIDE8's Exact tier is that, off by default.

**THE HELD MAP** (the enhanced map's world sheet, `ui/heldMap.js` over
`ui/inkMap.js` `paintQuestMark`): every active quest's place - a
diamond in the journal's gold (`QUEST_MARK_CSS`) standing above the
place's own mark (`QUEST_MARK_LIFT`; over a raided town `QUEST_RAID_LIFT`,
clear of the raid's blades, so neither overprints the other - AUDIT
GUIDE K7), tied to it, edged in the pen's ink so it reads on any
parchment, FILLED with that ink for the quest the tracker follows and
hollow for the rest (AUDIT GUIDE U16: a gold fill on the paper was 2:1,
the ink is 8:1 - the shape and the fill say it, not the colour alone; the
selection's amber is a ring). The legend names both kinds, "Followed
quest" and "Quest". Quests at one place are one mark, and its card says
the town alone, then each quest on its own line with its own building,
the followed quest first, "+N more" past the card's lines; a line keeps
its time whole and the label keeps its place (AUDIT GUIDE K2/K5). The
marks ride the party's poll (the host's `quests`, a function, read with
the window and again as they change), and answer a hover with a card -
after a party member (SOC6's first answer), the diamond, then a raided
town, then the quest's place, then the place itself - bounded by the
world events' own reader. A PRESS ON THE
DIAMOND PICKS ITS PLACE, one whose kind the key hides included (the
goto's own way, from the place's record): it had started a journey to
the bare pixel north of the place (AUDIT GUIDE K1/K4). A keyboard, or a
finger that never hovers, learns a place's quests from the place's own
card, which names them (AUDIT GUIDE K8/U15). The classic travel map is
DFU's and draws none: a player who chose DFU's own maps (the
`enhanced-map` switch) chose DFU's look.

**THE COMPASS** (`ui/enhancedHud.js` `drawQuestMark`): one mark - the
tracker's quest's place - a HOLLOW gold diamond edged dark, so it never
reads as the gate's burning one, at the gate's bearing law
(`compassMarkerLerp`, clamped: a place behind the player stands at the
strip's end on the side to turn toward). On the street only: buildings
and dungeons steer by their own frames. Hidden, never removed.

**THE HOST** (`scenes/world.js`): `questPixel` resolves a place with the
held map's own goto law - CanFindPlace's first half, `placePixelOf`
(`ui/travelMapWindow.js`: the region by name, the place by its map name,
the row's longitude and latitude) - through the host's one memo of it,
`placePixelMemo`, which the look's `canFindPlace` shares (AUDIT GUIDE
O3: MapsFile keeps one region, and a look asking about places in two
regions every tick re-parsed them 20-30 times a second; a place's pixel
never moves, and the discovered half stays live);
`questCompassMark` hands the compass the middle of that pixel in the
scene's frame (the streaming host's `pixelTranslation` plus half a
`TERRAIN_SIZE`, the party marks' own sum); drawHud forwards `quest` to
the enhanced HUD.

**THE FOUR HOSTS** (LAW 6; AUDIT GUIDE K9 - the record named the street
alone):

| Host | The held map's marks | The compass mark |
|---|---|---|
| `scenes/world.js` - the street | its `quests` (the tracker's views through `questPixel`) | `questCompassMark`, on drawHud's `quest` |
| `scenes/worldModes.js` - buildings | none: indoors DFU's map door refuses, and the held map is the street's | none: drawHud is handed no `quest`, and a building steers by its own frame |
| `scenes/dungeonContext.js` - dungeons | none: this context owns no map | none, as buildings |
| `scenes/exterior.js` - the fixed-town route | none: it builds no travel map, and its look asks no map (`questWhere` has no `canFindPlace`, so no target has a `find`) | none: its drawHud is handed no `quest` |

**ONE MODEL, TWO FACES.** The quest the player follows now has two faces
- the card (GUIDE4) and the marks - and one model: the bridge feeds the
tracker's model every look while EITHER is on, and forgets what it
followed when neither is (the player's tracked choice is the save's and
stays). GUIDE4's card no longer forgets on its own switch; it only
leaves the page.

**ONE PHRASE.** The herald, the card and a mark's card all say the time
left; `timeLeftWords` (`ui/questRail.js`) is its one home now.

**THE HUD STAYS LIGHT.** The marks module imports the skin, the prefs
and the rail alone - the enhanced HUD reads its gold and the bridge its
switch - and its suite walks the graph: never the lens, the machine,
the map readers or the raids.

**The switch.** Features row `quest-marks` - Interface, beside
`quest-tracker`, Enhanced, on by default (DECISIONS 7), the player's own
online.

**Pins.** `test/guide5_marks.test.js` (8): only what the map holds (the
marks, the merge, the cards, the resolver; the host's marks read and
checked; the card's note and no mark, the classic skin); one model, two
faces (the marks alone feed it, neither forgets it, the herald never
does); the held map (the poll, the legend's diamond, the ink - filled
and hollow - and the diamond above its place; the hover order and the
card); the compass (placed, clamped, hidden, never rebuilt); one host,
its laws (by source, and the import graph). GUIDE3's and GUIDE4's
suites hold the marks off and seven of their mutants (two of GUIDE3's,
five of GUIDE4's; AUDIT GUIDE D2) follow the new shapes.
`tools/mutants/guide5.json`: 34 mutants. Ledger A: WHERE A
QUEST POINTS, MARKED.

SEEN IN A BROWSER, NOT IN A GAME: headless Chromium over a harness page
(the ignored `test-harness/`) - the compass's hollow gold diamond on the
enhanced strip, the filled and the hollow diamonds above their places
on a parchment the real `paintQuestMark` inks, and the card's quiet
note.

## THE AUDIT (2026-09-29, Mac: "Lets do an audit on this before we merge")

GUIDE1-GUIDE5 read by eight lenses over a frozen tree, main merged in
first - `01-Overview/Audit-Guide.md` is the record. Every finding was
reproduced, fixed, pinned by a test that failed on the unfixed tree
(`test/audit_guide.test.js`, 38) and mutation-proven
(`tools/mutants/audit_guide.json`, 73); what it changed in a slice is
written into that slice's section above under its `AUDIT GUIDE <ID>`.
One call it made is Mac's to reverse (DECISIONS 8).

## THE SLICES (Mac, 2026-09-29: "This is your baby. Take your time")

In order. Every one reads the lens and nothing else. SHIPPED: GUIDE2 to GUIDE5 (above).

| Slice | What the player gets | DFU? | Switch |
|---|---|---|---|
| **GUIDE2 THE WAY THERE** | The enhanced journal (pause tab and chronicle) gets DFU's own logbook click: on an entry whose target has a `find`, "Show on map" closes the journal and opens the map on the place through the host's `gotoPlace` - world.js's `toggleTravelMap(place)`, which already hands it to the held map (`_travelMap.gotoPlace`) and refuses indoors in DFU's words. Under the title, a "where" line of the target's SAID names. world.js wires it; the dungeon and `?exterior` hosts flag it (DFU's map will not open inside). | Parity: DFU's logbook has it; the "where" line is the enhanced face's | none - the journal's own |
| **GUIDE3 THE HERALD** (SHIPPED) | The lens's events as the enhanced notices (ENH-NOTICE3's toast stack): "New quest", "Journal updated", "Quest completed" / "Quest ended", "Under a day left" - the title and the newest entry's opening, `aria-live`, no chime (the section above says why). Fed from the bridge's tick, so all four hosts at once. | Departure: DFU says nothing | `quest-herald` (interface, enhanced, `online: 'player'`) |
| **GUIDE4 THE TRACKER** (SHIPPED) | A HUD card: the tracked (else the last-changed) quest's title, its newest entry's opening, where it points and the live time left; a Track toggle in both journal faces, and the journal opens on the card's quest. The tracked quest is kept per character through `registerModSaveData`, by uid. The cycle key waits for GUIDE6 (the section above says why). | Departure | `quest-tracker` |
| **GUIDE5 THE MARKS** (SHIPPED) | Every active quest's place on the held map (the followed one filled) and the tracker's quest's place on the enhanced compass - only a target with `find` (DFU's own discovered gate). A place off the map gets the talk arc's hint on the card instead: ask about it, which is what Daggerfall's directions are for (`06-Systems/Talk-Arc.md`, THE COMPASS MARK). The classic travel map stays DFU's. | Departure | `quest-marks` |
| **GUIDE6 THE ACCESSIBLE JOURNAL** | The pause tab: filter by kind (Main, Guild - the quest list's own group, `findQuestMeta` - Other), sort by updated or deadline, search, each entry's date, the deadline as words AND a date, keyboard and pad navigation with visible focus, a text size that works, and an entry read aloud (speechSynthesis). | Enhanced face | per choice |
| **GUIDE7 THE ACCESSIBILITY SHELF** | Port rows in the Accessibility category: quest text size, high-contrast panels, reduce motion (the OS's, overridable), quest popups read aloud, notices held until dismissed - and the contrast and screen-reader audit Audit-UI named and nobody ran. | Port's own | per row |
| **GUIDE8 GUIDANCE TIERS** (SHIPPED 2026-10-05 - `03-World/Delve-Arc.md` GUIDE8; the *Town* tier and *Exact* indoors at AUDIT DELVE, `01-Overview/Audit-Delve.md`) | Journal by default: *Journal* (GUIDE5's law) / *Town* (the building the entry names, ringed on the town map and on the compass while the player is in its town) / *Exact* (the Town tier, and the marker a quest resource stands on, DFU's quest-debugger knowledge, on the dungeon's and the building's map and the compass). Exact is the one tier that can spoil; its own row. | Departure | `quest-guidance` |
| **GUIDE9 DFU'S QUEST DEBUGGER** | HUDQuestDebugger behind the inert `GUI/EnableQuestDebugger`: tasks, timers and globals per quest - for quest authors and bug reports. | 1:1 - DFU's | DFU's own key |

## DECISIONS (2026-09-29, Mac: "This is your baby. Take your time")

Mac handed the arc's open questions back with the arc. Each call is
recorded here as the arc's own, with its reason, so a later slice - or
Mac - can see what was decided and reverse it where it stands.

1. **The order** is the table's: GUIDE2 first (it is DFU's own feature,
   missing on the default skin), then the news, the tracker, the marks,
   the accessible journal and the shelf, the guidance tiers, the debugger.
2. **The herald is on by default** on the enhanced skin: the silence it
   answers is a reported bug (DISC6), and a notice is the enhanced skin's
   own idiom (ENH-NOTICE1/3). **The tracker is on by default too**, but
   quiet - it follows the quest the journal last changed until the player
   pins one, and says nothing when there is no quest to follow. Both are
   switches in the Features rows.
3. **The *Exact* guidance tier is allowed, off by default**, behind its
   own row: DFU itself has the knowledge (its quest debugger draws the
   markers) and a player who cannot read a dungeon should be able to ask
   for it; a player who wants Daggerfall never meets it.
4. **Text size starts with the quest faces** (GUIDE7's row), not a
   revived global `textScale` - one surface done properly before the
   whole UI is scaled. `user-scalable=no` stays on the game page: the
   touch layer's pinch and drag own the gesture, and the quest text size
   is the escape hatch it lacked.
5. **Read-aloud is in, and opt-in** (speechSynthesis, which the browser
   and the desktop shell both carry): off by default, never a voice a
   player did not ask for.
6. **The quest keys wait for GUIDE6's keyboard pass** (GUIDE4, the same
   day): every letter is spent (KB1), so a cycle key would ship unbound,
   and the journal's Track toggle already answers the keyboard. One pass
   decides the journal's keys and the tracker's together.
7. **The marks are on by default** (GUIDE5, the same day): they show
   only what the player's map already holds and the journal already
   said - DFU's own logbook offers the same place - so nothing is
   spoiled, and a player who wants Daggerfall's bare map turns them off.
8. **A deadline is one the journal names** (AUDIT GUIDE H1/L2, the
   audit). The HUD's faces - the herald's "Under a day left", the card's
   time and gold, a mark's card - count down only a clock a logged entry
   names (`=clock_`). A script runs clocks the player was never told of -
   a letter's arrival, the hour a quest waits before it closes itself
   (_BRISIEN's `_oneday_`, on every new game) - and DFU's journal shows
   no clock at all: the HUD counting them down was a spoiler, and at a
   quest's end a false alarm. Of the corpus's 234 clocked quests that
   log, 179 name a clock in a logged entry, 10 only in text never logged,
   45 none. A deadline once told stays told. The pause tab's and the
   chronicle's "Time remains" keep main's tightest counting clock
   (DEAD-CLOCK, PX5), unchanged - **Mac's call**: whether a clock no
   entry names should leave them too (45 quests would then show no time,
   and the main quest's S0000008 counts its letters' clocks).
