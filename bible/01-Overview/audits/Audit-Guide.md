# AUDIT GUIDE - the Quest Guide read before it merges, 2026-09-29

Mac: *"Lets do an audit on this before we merge"*, of the Quest Guide arc (`06-Systems/Quest-Guide-Arc.md`) as it stood
at GUIDE5 (`e52522c4f`): GUIDE1 THE QUEST LENS, GUIDE2 THE WAY THERE, GUIDE3 THE HERALD, GUIDE4 THE TRACKER and GUIDE5
THE MARKS. Main came in first (#433-#439, `fefcd8aab` - the baseline is the tree that would merge), and eight lenses
read it, each over that frozen tree, each reproducing what it reported with the repo's own code:

- **L** the lens and the bridge - the quiet read against every message of the corpus, the feed, the cost of a look;
- **H** the herald and the notice stack - every clock of the corpus, the live region, a short screen, a real browser;
- **T** the tracker and its save - the card on the real HUD, the choice across saves and loads;
- **W** the way there - the target's law against DFU's HandleQuestClicks, the four hosts, the classic skin;
- **K** the marks, the held map and the compass - the press, a shared place, MAP-KEY's filters, the raids;
- **O** online and the lifecycle - a load, a shared quest's resync, the dungeon's windows, the region cache;
- **U** input, layout and accessibility on real Chromium - the phone, the scaled HUD, a screen reader's tree, contrast;
- **D** the record, the doctrine and the merge - every claim of the arc's pages against the code, every cite.

Every finding below was checked against the code before it was fixed, pinned by a test that FAILED on the unfixed tree
for the finding's reason (`test/ui/quest/audit_guide.test.js`, 38 tests; the style sheet's and the hosts' wiring, which a new
suite cannot run against the old files, were proven red by their mutants instead) and mutation-proven:
`tools/mutants/audit_guide.json` 73, all dead. Each fix carries an `AUDIT GUIDE <ID>` comment. An ID two lenses found
is written once, with both names.

## Fixed

**The lens and the bridge** (`src/ui/quest/questLens.js`, `src/scenes/quest/questBridge.js`, `src/ui/quest/questRail.js`,
`src/scenes/world.js`, `src/ui/travel/travelMapWindow.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H1, L2 | high | THE HUD COUNTED DOWN CLOCKS THE PLAYER WAS NEVER TOLD OF. A quest's "time left" was the walk's tightest running clock - any clock: a letter's arrival, the hour a quest waits before it closes itself. On every new game _BRISIEN logs "I met a lady" and starts `_oneday_`, whose task only ends the quest: "Under a day left - Lady Brisienna - 23 hours 59 min left" on the herald, the card's time gold, and a day later "Quest ended". A0C01Y09 said "1 hour left" with 29 days on its deadline; K0C00Y00 counted down to a letter. DFU's journal shows no clock at all. Of 234 clocked quests that log, 83 run a clock no logged entry names, 30 of them under a day. | The HUD's faces count only a clock a logged entry NAMES (`=clock_`, Clock.ExpandMacro's DetailsMacro, read unexpanded): the walk hands each quest's `clocks`, the lens keeps the tightest named one, and a deadline once told stays told. The pause tab's and the chronicle's "Time remains" keep main's DEAD-CLOCK number - Mac's call (below). |
| O3, L5 | med | A look asked the map about every entry of every quest, every tick: `canFindPlace` -> `getRegionByName`, and MapsFile keeps one region, so quests in two regions re-parsed them 20-30 times a second (and the held map's poll and the compass did it again). 90% of a look's time; 14.5 MB/s of garbage with 30 quests. Nobody read an older entry's target. | Only the latest entry is given a target; the archive is not parsed (nobody reads it); a place's pixel is read once a session through the host's `placePixelMemo` (`ui/travel/travelMapWindow.js`), which `canFindPlace`, the marks and the compass share - the discovered half stays live. |
| H4, O4 | low | "Journal updated" when nothing was new: the news key held the entry's TIME, so P0B10L07's re-log on every click, and a shared quest's resync rewriting the times, were news each time. | News is a step and message not written before (`newsKey`); the same words at a new time are not. |
| L3 | low | The quiet read was loud for a quest LETTER: an entry naming one reads its signoff through DFU's own path (Item.expandMacro -> questLetterName -> ExpandLetterSignoff), which reveals talk topics with no flag and draws on the engine's roll. No logged corpus entry names a letter yet. | For the read, the quest's hooks answer nothing (addDialog, dialogLink) and the engine's roll is the quiet one - both put back however the read ends. |
| L4 | low | A face that threw while HEARING a look (the herald's `hear`, the tracker's) escaped the bridge's tick every tick and reached the host's frame, which has no try: the crash overlay. Only the look was contained. | The look and its listeners in one try: a face that throws costs the news and one warning, never the frame. |
| L6 | low | `rereadText()` was never called, though the record said a face calls it: a kept opening whose macros read the world ("I have =1stparton_ days") stood while its own time row counted down. | The bridge re-reads the kept lines each game hour. |
| L8, T8 | low | After a stretch with every face off, the next look diffed against the look before the gap: its "news" was the backlog in the walk's order, and the card followed the last quest of the walk, not the one written last. | No look last tick: the lens is reset first, so the look is a baseline. |
| O2, H2, L1 | med | A quickload kept the unloaded game's notices, and the next news of the same uid merged into them: "Quest ended" over a live quest, another save's verdict under this one's title. | A load clears the herald with the lens's baseline. |
| T3 | low | The tracked quest was let go only when its ending was HEARD: with every face off, the pin outlived the quest into the save, and after a load (the uid counter is re-derived, Q4-iv) an unrelated quest minted under that uid showed as tracked. | The bridge lets go of a tracked quest that is gone or complete every tick, faces on or off. |
| W1 | low | The town's own name (`__p_`) unlocked the REGION too: an entry naming only "Llugwych" said "Llugwych in Wayrest province" off the map, beside "Not on your map yet" - more than the entry or DFU's box says (the said law; `__DEMO08:1020`). | The region only where the entry names it (`____p_`) or DFU's box would: the place on the map, or the player in it. |
| W2 | low | "(you are here)" is a CLAIM, and it was made by name alone: standing in a Llugwych the map says is not the one the entry names, the entry's town and region were revealed and the off-map note dropped. | Here needs the map's yes (or no map to ask); a place the map lacks is never here. `find` keeps DFU's name-only gate (DaggerfallQuestJournalWindow.cs:448-450). |
| W4 | low | The opening's first sentence stopped at "St." and at initials, ran on past a stop inside a closing quote (P0A01L00:1015), knew only ASCII capitals, and found the date header only on the first line. | A stop is `[.!?]` with its closing quotes before a capital (`\p{Lu}`); abbreviations and initials are not stops; the header is the first non-empty line. |

**The herald** (`src/ui/quest/questHerald.js`, `src/ui/enhanced/enhancedNotice.js`, `src/ui/hud/hud.js`, `src/ui/enhanced/enhancedStyle.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1, T7, H9 | med | A dungeon's window left the herald's notice painted and frozen over it, and the card too: both dungeon hosts return above drawHud while a window is up, and the HUD's hide door (`hideHudTextSurfaces`) never reached either face; the draw watchdog then took the notice down and a rebuild announced it again. | The hide door hides the herald and the card - their clocks stopped, the card's height withdrawn. |
| H3, U19 | med | The news was often not spoken: the stack's `aria-live` root is built with its first notice and taken down with its last (ENH-NOTICE1), and a live region inserted with its words is commonly not read; a merged notice rewrote one row of three, with no `aria-atomic`. | The herald keeps ONE live region of its own (`#quest-herald-live`, polite, atomic, visually hidden) standing while it is on, and says each notice into it once, whole ("Journal updated: The Herald. The deadline moved."); its toasts are `aria-hidden`. |
| H5 | low | Past three notices the OLDEST row went, by position: a merged notice kept its old slot, so the freshest news was evicted, and four events in one look dropped the first undrawn. | A merged notice moves to the newest place; past three the least news goes - the lowest rank, the oldest among equals. |
| H6 | low | A deadline's notice said the time it was heard at: after a rest (the machine ticks, no face looks) or a window, "3 hours left" stood for hours. | When the HUD shows again the herald re-reads the time from the last look. |
| H7 | low | A merged notice contradicted itself - "Under a day left" over "3 days left" - because a deadline outranked an entry after the deadline had moved. | A deadline keeps its rank only while the quest is still under a day. |
| H8 | low | The stack's 90vh clip hid a three-row notice whole on a short screen, or clipped the HUD's own lines beside it. | Under 520 pixels tall the herald's third line goes; the kind and title stay. |
| H10, U11 | low | A main quest was told by colour alone, on the herald and on the card (WCAG 1.4.1; the arc's LAW 5). | Said: "New quest - Main Quest" on the kind row, "Main Quest" on the card's time row (the pause tab's own tag). |

**The tracker** (`src/ui/quest/questTracker.js`, `src/ui/enhanced/enhancedMenu.js`, `src/ui/enhanced/enhancedChronicle.js`,
`src/ui/enhanced/enhancedStyle.js`, `src/ui/partyPanel.js`, `src/ui/travel/travelViewHud.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1, D1 | med | On a touch screen the card painted over the Overworld's block (the travel view draws the HUD under it, and TravelView's FURNITURE lacked `.qtrack`) - the screenshot shows it. | The card steps aside - keeping its line, so the party list never jumps - under OW-NOTICES' `data-tview-block="top"`, and FURNITURE names it. |
| U1 | med | On a phone the card (top 104) lay over the chat's peek lines, full width at 72: both unreadable. | Under 720 wide the card steps aside while the chat peeks. |
| T2, U4 | med | With the tracker off and the marks on, the tracked quest still steered the compass and the filled diamond, and no Track toggle stood anywhere to change it; the Quests tab opened on its first row. | `followOn()` - the card or the marks - gates the toggles and the tab's opening, the bridge's own condition. |
| O5, T4, U2 | low | The card's height was measured only when its words changed: a turned phone, a resize across the short-screen rule, or the web font arriving after the first measure left the party list 74 px under it or 90 px below. | A ResizeObserver re-measures; the height published is the card's own bottom against the party list's line. |
| U8 | low | The HUD's scale grows the compass and the foe frame; the card's top was fixed, and at 1.5-2 on a phone they overlapped. | The card takes the HUD's `--hud-scale` and foe signature and clears them (`--qt-clear`), re-measuring when they change. |
| U7 | low | A journey's junction disc stood in the card's corner. | The card steps aside while the disc shows. |
| T5, U3 | low | Pressing Track rebuilt the face under the player: the keyboard's focus went to the page, and the chronicle's scroll to the top. | The toggle changes in place, and every other toggle on the page with it; nothing is rebuilt. |
| T6, U13 | low | The toggle's name flipped with its state ("Stop tracking X", pressed) - two signals for one fact (WAI-ARIA APG). | One word and one name, "Track X on the HUD"; `aria-pressed` carries the state. |
| U14 | low | Which quest the HUD follows reached no screen reader: the card and the HUD are `aria-hidden`, and a followed quest's toggle read "not pressed". | Its toggle says so: "On the HUD" (the card), "On the compass" (the marks alone), followed or tracked. |
| U9 | low | The card's dim rows fell under 4.5:1 over snow or a bright sky (a plate at 0.6). | The toast's own plate (0.82) and lighter dim rows. |
| U10 | low | Under forced colours the card's plate - a background image - went, and its text stood on the sky. | A plate of the system's own `Canvas`. |
| U17 | low | Off a touch screen the party list had no height cap: a full party ran off the foot of a short window once it stepped under the card. | Capped at the window's foot, less the card's line. |

**The way there** (`src/ui/enhanced/enhancedMenu.js`, `src/scenes/exterior.js`, `src/ui/quest/questLens.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W3 | low | On the CLASSIC skin the pause page's Controls opens the enhanced window (DISC22-B), and its Quests tab drew GUIDE2's where line and Show on map (LAW 4). | The line and the button are the enhanced skin's alone. |
| W5 | low | The trail offered a place once by its NAME: an older entry naming a same-named town in another region lost its Show on map. | By region and name. |
| W6 | low | On the `?exterior` route a building's Quests tab lost "(you are here)", which the chronicle and the card kept: the route's worldModes bag had no `questLocationName`. | The route hands its buildings the city it stands in. |
| U12 | low | "Show on map"'s accessible name did not begin with its visible words (WCAG 2.5.3). | "Show on map: Llugwych in Wayrest province". |

**The marks** (`src/ui/quest/questMarks.js`, `src/ui/heldMap.js`, `src/ui/ink/inkMap.js`, `src/ui/enhanced/enhancedStyle.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| K1, K4, U15 | med | A PRESS ON A QUEST'S DIAMOND STARTED A JOURNEY TO NOWHERE. The diamond stands 17 px above its place, out of the place mark's 16 px reach, so a press fell to the map-coordinates arm: with Travel Options' default and AllowTargetingMapCoordinates, a "Map coordinates" journey to the bare pixel north of the place. With the place's kind hidden by the key (MAP-KEY) the same, over a blank pixel. | A press on the diamond picks its place - the inked mark on that pixel, else (its kind hidden) the place's own record, the goto's way; the cursor says so. |
| K2 | med | A mark two quests share said the FIRST quest's where - its building included - for both. | The town alone, then each quest on its own line with its own building. |
| K3 | med | The legend's new item made the foot wrap into the place card: on a phone the foot covered the lower 20 px of Travel here, and a tap flipped the Ports filter; at 1280 online the Overworld button lay over Begin journey. Partly main's (a party and a traveller, or a raid, did it before). | While a place is picked, the card stands above the foot. |
| K5 | low | Six quests at one place: the card listed four and dropped the followed one, the label cut at 120 lost the place, a time was cut mid-phrase. | The followed quest first, "+N more" past the card's lines, cuts at a word, and the label keeps its place. |
| K6 | low | On a phone the legend ran nowrap off the screen, the quest's word first (main's overflow with three items or more). | The legend wraps inside the foot under 860. |
| K7 | low | At a raided town the diamond (17 up) overprinted the raid's blades (18 up), and the raid won the hover everywhere: the quest's card was unreachable. | The diamond stands clear of the blades (`QUEST_RAID_LIFT`); on it, it answers as the quest - where both reaches meet too. |
| K8 | low | The quest's card was pointer-only: the place's own card, which a keyboard and a finger reach, never named the quests pointing at it (LAW 5). | The place card names them, with their time. |
| U16 | low | The followed quest's filled diamond differed from the hollow one by a gold fill on the paper, 2:1 (WCAG 1.4.11), and the legend showed one kind. | Filled with the pen's ink (8:1); the legend names both, "Followed quest" and "Quest". |
| U18 | low | The decorative ◈ before a where line was read aloud as text. | Its alt text is empty (`content: '\25c8' / ''`). |

**The record** (`bible/06-Systems/Quest-Guide-Arc.md`, `bible/10-UI/UI-Arc.md`, `src/ui/quest/questJournal.js`,
`src/ui/enhanced/enhancedHudText.js`, `src/ui/quest/questLens.js`, the patch notes, the GUIDE suites)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | low | The counts: guide3.json holds 45 (GUIDE4 added `GUIDE3-small-word-kept`), the record said 44 in three places; "three suites' door pins" were four (`fb0929_vampirehood`); "four feed mutants" were six re-aimed and one added (with font1's and auditsoc's re-aims unnamed); "five of their mutants" were seven. | Each count corrected. |
| D3 | low | UI-Arc and `enhancedHudText.js` cited the classic logbook's lines 642-643 for what stands at 628-629. | Corrected. |
| D4 | low | The lens cited DaggerfallQuestJournalWindow.cs:474-481 for PatchRegionIndex and locationInRegionProvince - copied from main's own wrong cite in `questJournal.js` - where they are :455-456 and :459-462, and GetLastPlaceMentionedInMessage is :470-485. | All three, in both files. |
| D5 | low | The news's patch notes promised "one notice with the latest news" and "the title and one line": the herald keeps the highest rank, and an ending has no third line. | Worded as the arc does. |
| D6 | low | "Nine refusals, every one says why first": three do not - one is silent, one shows a pending quest offer instead, one asks the party-travel question; the journal's door, which always carries its place, meets only the offer. | Worded so, in the record and at world.js. |
| K9 | low | THE FOUR HOSTS rule: GUIDE5's record named the street alone. | GUIDE5's four hosts, each named. |
| O6 | low | The HUD-STAYS-LIGHT pins matched only `import ... from` lines: a side-effect or dynamic import was not seen, and the graph was never walked from the HUD. | The three suites walk every static, side-effect and dynamic import. |

## What the whole suite and the kill run found

With every lens's fix in, the kill run over the audit's records and every GUIDE record (263: `audit_guide` 72,
`guide1`-`guide5` 191) left eight standing. Each was a finding:

- **H11** (low, fixed): GUIDE3's own flag in the bridge - the herald's first look after it came on is a baseline -
  said nothing once L8 made the lens reset after a gap; where the tracker had kept the lens looking, it dropped the
  real news of the tick the herald came on in. It is gone: the baseline is the lens's
  (`test/ui/quest/audit_guide.test.js` H11). GUIDE3's two records on it are re-aimed at the lens's gap rule, where the law
  now stands, and GUIDE4's and L4's that named it follow.
- `GUIDE2-note-underfoot` was made equivalent by W2 - a place the map lacks is never here, so the off-map note's
  `!here` said nothing. The clause is gone and the record retired (guide2: 24).
- `GUIDE1-town-underfoot-unnamed` survived because every pin asked the map: the fixed-town route asks it nothing, and
  there the town the player stands in is named by the standing alone. Pinned now.
- `GUIDE4-no-redraw` survived because GUIDE4's chronicle pin mounted its window off the page (the other toggles then
  had nothing to follow) and pressed only one toggle. It is on the page and presses two.
- `AUDIT-GUIDE-K2-...` and `-K7-...` survived pins too kind to them: the followed quest had no building of its own,
  and nothing pointed where the diamond's and the blades' reaches meet. Both do now.
- `GUIDE1-quiet-read-reveals` is equivalent, as recorded: L3's own hooks answer nothing, so the reveal flag is the
  first of two guards - the letter's signoff, which reveals with no flag, passes only the second.
- Dropping trackButton's redraw callback (no face passes one since T5) made `AUDIT-GUIDE-T5-the-face-rebuilt` a
  mutant of nothing; it is re-aimed at a face that rebuilds on the press, and dies.

Then, with `tv5`'s 85 beside them: 348 records, 347 dead, the one equivalent standing. Also gone with them: the dead
`where` a shared mark kept beside its town.

The whole suite then found two pins the audit's own fixes had moved, both red for the right reason:

- `test/ui/travel/tv5_far_places.test.js` holds TravelView's FURNITURE list exactly, and T1 added the card to it: the pin names
  `.qtrack` now. The tv5 records' verdicts until then ran over that red pin and said nothing; they are judged again
  below.
- GUIDE2's four-hosts pin forbids a bare `return;` in the street's map door, and D6's first wording of its comment
  said "before they return;". Reworded.

Last, on that green baseline, every committed record on a file the audit changed - 2,489 on twenty files, the GUIDE
and audit records among them: 2,476 dead, 7 equivalent as recorded, 6 survived, and none of the six is the audit's.
Two FB0929D-MAPKEY records are killed only by a measurement against the player's own FMAP_PAL.COL (their `why` says
so; below). Four tv5 records survive on main (below).

## Found at the integration

Main was red on one test of its own: TO-ROADS x OW-PATH (`9921c7901`) gave `travelViewWalkTo` a `roads` option and
`test/systems/travel/tv6_dungeons.test.js`'s AUDIT OW4 D1/D6 lift still read the old signature. Fixed in the merge.

## Not faults

- **L:** the lens is invisible to the machine - over 36 corpus quests, three ways: the save envelope byte-identical, a
  1,978-field digest, a 488-call seam trace, the DFRandom seed, and Math.random's draws (28, none inside 800 looks);
  3,817 corpus messages read quiet and deep-checked.
- **D:** the quest machine is touched only by parameters whose defaults are DFU's (`revealDialogLinks = true` in
  `message.js`, `roll = Math.random` in `questMacros.js`): its digest over 265 quests is the same on main and here.
  Ledger A's four rows cover every departure.
- **W:** `find` is HandleQuestClicks' gate exactly - the name alone, as DFU's is.

## Not changed, and why

- **The pause tab's and the chronicle's "Time remains"** keep main's DEAD-CLOCK number (PX5), which counts clocks no
  entry names: _BRISIEN's `_oneday_` shows gold there on every new game. Whether they drop unnamed clocks too is
  **Mac's call** (Quest-Guide-Arc DECISIONS 8): 45 quests would show no time, and the main quest's S0000008 counts
  its letters' clocks.
- **W7:** the chronicle - DFU's L key window - offers the way only from a quest's latest entry; DFU's logbook takes any
  entry, and the pause tab gives older entries theirs. A way on every entry of an open card is **Mac's call**.
- **L7:** a quest whose only entry was removed (`remove log step`) is "New quest" after a load, not "Journal updated":
  a load keeps no memory of removed entries, and a silent quest and an emptied one read the same.
- **U5:** the FPS read-out covers the card's title (and the party list, on main): a diagnostic overlay.
- **U6, the rest:** a transient notice may still cover the card on a short screen; H8 trimmed the notice.
- **W2, the rest:** a same-named place that IS on the map is still "here" - the map cannot tell two places of one name.

## Pre-existing on main

- Stale cites main carries, named here by their rows so no tool reads them as claims: three closed Ledger rows
  (UseItem's unbuilt destinations, renderCharacterSprite's clear colour, detect treasure outdoors) cite world.js and
  dungeonContext.js lines that have moved; Port-Status's keyboard row cites an enhancedMenu.js line the FLAGGED
  comment has left; Quest-Arc's note on the gender arm cites questBridge.js for code that lives in `staticNpc.js`
  now. The classic logbook's own wrong cite was D4's and is fixed.
- `test/tooling/da9_arena2detect.test.js` DA9-Windows fails whenever the TMPDIR path contains "daggerfall"
  (`app/lib/arena2Detect.cjs`).
- Four tv5 records - `EDGE-FURNITURE-stale-on-show`, `AUDIT-DEEP2-E6-bands-unshared`, `-E7-corner-piece-ignored`
  and `-E8-foot-ends-overlap` - survive on main: the Overworld Block (`4150578f3`) left `test/ui/travel/tv5_far_places.test.js`
  unable to fail them. At its parent all four die; at it, and at main today (#446), all four stand. The travel
  view's readout is not this arc's, and its pins are left to its own next pass.
- A press on a raid's blades falls to the map-coordinates arm as a quest's diamond did (K1).
- The party list stands over the Overworld's block on a touch screen (`.dfparty.touch`).
- A video that holds the frame, and the realm's exit wait, leave the DOM HUD standing.
- The chronicle's own fold jumps the scroll; a rail row has no selected state for a screen reader; the notice stack's
  live region comes and goes with its toasts (ENH-NOTICE1 - the herald no longer depends on it).

## What this audit could not see

A running game: every lens drove the real modules headless or in Chromium over a harness page - ARENA2 is not in the
tree. The screen-reader findings were read off the accessibility tree, not heard. And the two FB0929D-MAPKEY records
on the marks' ink mix (`MARK_INK_MIX`), which only the player's own FMAP_PAL.COL can kill: without ARENA2 their pin
has nothing to measure, so they stand here as they stand on main.

## The deploy

Client only. No relay, no account service, no migration: the herald, the card and the marks ride the next site build,
and the tracker's choice is the save's own per-mod slot, as GUIDE4 shipped it.
