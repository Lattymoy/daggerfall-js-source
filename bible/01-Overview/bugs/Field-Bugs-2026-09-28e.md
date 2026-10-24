# FIELD BUGS 2026-09-28e - the deck, the level box, the cursed stars, the passage, the frame rate

Mac, with four screenshots of the Discord's bug-reports threads and one line of Mac's own. This page is the batch's
record; each fix has its own section below. Then Mac's answers to the page's own questions: SHIP-SAIL and FPS-VSYNC.
Mutants: `tools/mutants/disc28e.json` (95: 93 dead, 2 recorded equivalent - AUDIT 28e, below).

The list, as the screenshots carried it:

1. michelle!!, *"unable to add attributes"*: *"i'm having issues adding attributes on create a character. i can't see
   the different options. i've tried safari and firefox and switching to landscape."* Her screenshot: the Strength
   description, "What these buy you", "12 left to spend", Roll again, Back, a red *"CRASH (2) / unknown error"* box. A
   reply in the thread: *"I actually use classic to create the character, then save and go back to enhanced"*.
2. dragonatg, *"Level Progress Inconsistency"*: *"The level progress is inconsistent between the Uis. On GrimoireUi a
   level progress of 93% is only 12/100 on EnhancedPlus."*
3. Regi, *"FPS issues and FPS limit"*: *"FPS are TANKING when my character loads into the outdoors (see first video).
   When I try a test room character, this issue is resolved (second video). Settings are also set for 300 FPS but it
   seems it's limited to 60 (possibly by vsync)."* Then: *"There was also a mysterious "uc crash" but i haven't managed
   to get the popup again."*
4. Megatronism, *"Werewolf (ect..) level up bug"*: *"The permanent stat bonuses from being a werewolf (vampire, ect...)
   Do not appear on the level up screen, only showing what your stats would be before the bonuses were applied. You
   can actually put points into an already maxed out attribute if you are not careful, and waste part of your level
   up, since it will show the attribute as being less than it really is."*
5. Mac: *"Also a bug where a player is at a port but unable to set sail"*.

## SHIP-PORT: the deck is no port (5)

No screenshot came with it, so every door to the sea was read against the retail MAPS.BSA before anything was
changed. Four systems sail, and three of them read "a port" three ways: the travel map's passage (Travel Options'
378 harbours, `systems/travel/travelPorts.js`, the mod's own list verbatim), the bank's ship and Come Sail Away's deeds (the
location's `PortTownAndUnknown` byte), and the Overworld's crossing (no port at all - the player's own boat to hand).
The two lists do not fight: of the 15,251 locations, 343 carry the byte and every one of them is among the 378 (the
other 35 are the mod's additions). So no harbour where the bank sells a ship refuses the passage.

What does refuse it is the player's own ship. Bought at the bank and boarded from the transport picker, it puts the
player on "Your Ship" (2,2 or 5,5) - in neither list - and Travel Options' `IsNotAtPort` asks of the pixel stood on,
while every trip from the deck is reckoned from the port the ship was boarded at (`playerTravelOrigin`,
TravelTimeCalculator.GetPlayerTravelPosition). So the map refused By ship ("since there's no port"), knocked it off as
it opened, and By land walked from the deck onto the sea into the mod's ocean stop ("maybe you should travel on a
ship") - a player on their own ship in a harbour could not sail it anywhere. The mod does the same (it reads
PlayerGPS.CurrentLocation), but its own `HasNoOceanTravel` names `IsOnShip` - the passage from the deck it meant. The
one dep bag both maps and a party's fare read now hands the ship laws the boarding port when the player stands on
their ship (`travelOriginMapId`); ashore nothing changed. Departure 20 in `06-Systems/Travel-Options.md`.

Two more on the same road:

- **The re-bill.** The enhanced map's card priced the trip, then ran the mod's OnPush guard and never priced it again,
  so a guard that knocked the ship off showed By land over the ship's days and fare, and Begin gold-checked that fare -
  a walk refused for gold it does not cost. The card re-bills whenever the guard moved the ship, as the classic window
  refreshes after its guard.
- **The Overworld's line.** The Overworld sails the player's own boats alone (OWS2); with none to hand, a place across
  the water was refused with "a boat would carry you across the water" - which at a port reads as no way to sail. At
  first the line named the map's passage; Mac's answer made it the passage itself - SHIP-SAIL, below.

Not changed, and why: Come Sail Away's "Unable to raise sail. Boat is obstructed." is the mod's own refusal while any
of a boat's five nodes reads land (`03-World/Come-Sail-Away.md`, seen on Daggerfall's town pond), and its deeds want
a port by the byte within its search square - both 1:1. CORRECTED (2026-09-29, FIELD-CSA2): the refusal is the mod's,
but on the open sea it was the port's fault - with Iliac Puddle No More on (the default) the node law read the flat
sea at the drawn ground's 34.000001 m, never under the mod's 34 as Unity's 16-bit heightmap reads it (33.994), so every
boat a deed put in the water beside a port read land, would not row, and refused its sail. That was the report's
"at a port but unable to set sail" too; the town pond it was seen on (with the mod off) read land for its own reason.
`01-Overview/bugs/Field-Bugs-2026-09-29c.md`. CORRECTED: this page first said the classic window and a
party's fare run the mod's guard before pricing the trip, so a fresh popup read the ocean as none. They do not - the
popup prices itself as it is built (`TravelPopUpWindow`'s constructor ends in `refresh()`), so its guard sees the
water; `test/systems/travel/disc28e_shipport.test.js` pins it through the real popup. `test/systems/travel/disc28e_shipport.test.js` (5).

## LEVEL-PCT: the classic Level box reads the law that levels the character (2)

GrimoireUI is the classic skin under an art pack (`10-UI/Overhauls.md`), so its "Progress made to the next level: 93%"
is the classic sheet's Level box (`ui/charsheet.js` `_showLevel`), and Enhanced Plus's "Toward the next 12/100" is the
Ascension's crown. The crown asks whose law levels the character; the box never did. A character who chose Oblivion
Remaster-like levelling at creation (ORL1) levels by a bar out of 100 - and still has DFU's skill sum kept
(`advancement.js` raiseSkills feeds both), a sum that levels nothing for them. The report's numbers are one history:
one primary raise and two miscellaneous ones put 8 + 2 + 2 on the bar and 1 on the sum, which DFU's arithmetic reads
as 93%. The box now reads the bar for such a character (12%), through `levelBarProgress`, the one reading the crown
draws too.

Found beside it: the box's DFU arithmetic was a double's. DFU holds the level in a `float currentLevel`
(DaggerfallCharacterSheetWindow.cs:782), so the quotient is a single before its fraction is taken; in a double 36/15's
fraction is 0.3999... and 39/15's 0.6000..., and the box read 39% and 60% where DFU's reads 40% and 59% - two of
the fifteen spans a level has (the sum never falls below its start, so 28 to 42). It is a single now (`Math.fround`),
pinned against DFU's own values for those fifteen. `test/systems/disc28e_levelpct.test.js` (4), seven mutants.

## ASCEND-LIVE: the Ascension's stars wear what the character has (4)

Every level-up lane spends and caps the PERMANENT value - DFU's StatsRollout draws and caps GetPermanentStatValue and
the mod reads `.base` - and still does. The curse's bonuses ride the live channel (a werewolf's +40 on Strength,
Agility, Endurance and Speed; a vampire's +20 by night, -20 by day), so the Ascension's stars, read off the permanent
value, said 63 for a werewolf whose Stats page says 100, and a point there moved nothing the player has while the
curse lasts. A row now carries its live value (liveStat's own law over the working permanent value) and whether a
press the law allows would show; the star wears the live value, tinted as the classic sheet tints a live value above
or below its permanent one, and the chosen star's line says it in words: "100 with its bonus - a point here shows only
once that ends". The presses, the caps and the exit gate are unchanged. The classic skin's level-up is DFU's own
window (DFU draws the permanent values there too) and is untouched. `10-UI/UI-Arc.md` ASCEND-LIVE;
`test/systems/disc28e_ascendlive.test.js` (7), twenty-eight mutants.

## THE READING: the phone's attribute rows (1)

Already fixed and live. This is the report `01-Overview/bugs/Field-Bugs-2026-09-27-phone-backup-drains.md` records
(CHARGEN-PHONE, `08db3b3c`, merged in PR 409 with its audit `54daf140`); the screenshot is the pre-fix layout, where
the attribute list got a sliver of the screen under the description card. The live site serves this tree's head
(its `build-tag` meta read 74ad1ed58655 on 2026-09-28), which carries the one scrolling column. The two errors behind
"CRASH (2) / unknown error" were never traced: before that fix the box printed "unknown error" for any error event
with no error object, and a bare line with no `at` under it means the event had no file either - the shape of a muted
cross-origin "Script error.", which a browser's own injected scripts raise (both her browsers are WebKit on iOS). The
box has printed the event's own message since, so a repeat will name itself. Nothing changed here.

## THE READING: the frame rate (3)

- **300 is 60 on a 60 Hz screen, by design - in a browser.** The Frame Rate Cap holds frames back; it never runs
  faster than the screen, because every frame waits on requestAnimationFrame, which waits on the screen (FPS-CAP1,
  `07-Rendering/Rendering-Arc.md`; the patch notes say "The game never runs faster than your screen"). The desktop app
  was the same Chromium with no switch to lift the wait - until FPS-VSYNC, below.
- **The outdoors.** The report's counter reads "in frame 63.8 before 9.7 stream 0", 48 draws, and a GPU line ending
  "ACO), OpenGL ES 3..." at dpr 1 - an AMD card on Mesa (Linux). 63.8 ms inside the frame is SCRIPT-SPLIT's own
  reading (`07-Rendering/Performance-Exterior.md`): the time the frame callback takes, which includes waiting on the GPU.
  The Test Room is not the same place: its characters start in Privateer's Hold and always offline, so it compares a
  dungeon to an exterior (online, if the save was). Not reproducible here (SwiftShader); the questions are
  SCRIPT-SPLIT's three - Render Scale at 50%, the counter's whole lines, and whether the save was online.
- **"uc crash".** No such label exists in the tree; "uc" is almost certainly a minified name from the build the player
  ran (the same shape as the recorded "'Ut' before initialization"). It can be read only against that build: the app's
  version names it, and the recorded way is to rebuild that commit and slice the bundle at the crash's line and column.

Nothing changed for the outdoors or "uc"; the cap is FPS-VSYNC's.

## SHIP-SAIL: the Overworld takes the passage (Mac's answer)

Asked whether the Overworld should book the map's ship passage itself, Mac: *"Shouldn't it already function as such?"*
It does now. Where the Overworld refuses a place across the water (no route by land, no boat of the player's own to
hand) and the map's passage sails there from here, the Overworld OFFERS it in a Yes/No box - "There is no way to
Wayrest by land. Sail there by ship?", the fare in the party prompts' own words, the days as the map counts them (none
online, where the arrival is now), and the popup's warning to a diseased or poisoned traveller. It is priced by the
map's own popup, headless (`partyTripFare`: the ports rule, the guild's blessing, the fare, the two-sided gold gate),
refused by the map door's own rungs (foes near, the sun, indoors - `partyTravelRefusal`), and on Yes taken as the map
takes it: a party gathered is asked first, then the fade and `fastTravelTo`. A purse that cannot pay is told so ("You
cannot afford the journey (150 gold).") and not asked; where the passage's own law refuses the place - no port here -
the boat's line stands (with Come Sail Away off, the plain refusal). The passage is Daggerfall's, so it is offered
whatever that mod says (AUDIT 28e: it was offered only with the mod on). The same offer answers both doors to it: a
town clicked in the Overworld, and a place picked on the map with By land chosen. `test/systems/travel/disc28e_shipport.test.js` (the
offer and the popup's pricing), twenty-three mutants.

## FPS-VSYNC: the desktop app runs past the screen, as DFU does (Mac's answer)

Asked whether the desktop app should run above the screen's refresh, Mac: *"Yes"*. Done by DFU's own law for VSync
off (StartGameBehaviour.cs:238-250): frames do not wait for the screen, and the Frame Rate Cap is what holds them (Off
lets them run free). With VSync on, DFU's cap does nothing; this one still holds frames back below the screen - FPS-CAP1's
departure, which stands there, in the app as in a browser (AUDIT 28e: this page first said the app keeps DFU's rule
whole). A page cannot stop waiting; the app's Chromium can, if told before it starts. So the shell reads the player's saved VSync at launch
(`app/lib/frameRate.cjs`: the page's own settings blob in the shell's file store, read as the page's GetBool reads it)
and, with it off, lifts both of Chromium's waits (`disable-gpu-vsync`, `disable-frame-rate-limit`); the page's cap
(`systems/frameCap.js`) then holds the frames, up to its 300. VSync on - DFU's default - changes nothing, so no install
runs uncapped unless its player turns VSync off. In the app the VSync row is a real switch now, said to take effect
the next time the app starts (the settings screen's `restart` tier); in a browser it stays unavailable. The report's
"300 FPS but limited to 60 (possibly by vsync)" is answered in the app: turn Wait For Screen Refresh off, restart.
`test/ui/settings/disc28e_vsync.test.js` (7), twenty-seven mutants. Measured in Electron under Xvfb (AUDIT 28e, below); not on a
real desktop GPU.

## AUDIT 28e (2026-09-29, Mac: "Please audit this")

Four lanes over a frozen snapshot of the batch (a worktree at 71354d35), each told to reproduce before it reported -
SEA (the deck, the passage, the offer), LEVEL (the box and the stars), FRAME (the shell's VSync), RECORDS (the pages,
the pins, the mutants) - and the fixes made in the tree beside them, never in what they read.

**SEA.**
- BUG: **Yes to the passage left the journey on the ground running.** The fade and `fastTravelTo` touched neither the
  mod's destination, the Overworld's trip nor a party's walk; the view rose again over the black screen for the old
  trip, and past the arrival the autopilot drove from the far shore back into the sea - the mod's ocean stop. Yes now
  ends it first (`clearTravelDestination`, the mod's own: the panel, the route, the autopilot, the walk).
- RISK: **a passage from the deck skipped DFU's ship-scene cache** (`performFastTravel` :330-332, "Cache scene first,
  if fast travelling while on ship") - SHIP-PORT opened that door. `fastTravelTo` caches the deck's scene now, after
  the pre-travel event and before the teleport.
- RISK: **No left the Overworld down** (the box cuts the view; the HUD line it replaced did not). No raises it again.
- NITs: a purse that holds the fare but not the inns' coin is told the coin (`fareText`'s third argument); a pending
  quest offer is handed over first, the map door's GiveOffer rung; departure 20 says a ship boarded in the wilderness
  reads no port from its deck.
- From RECORDS: **the offer was asked only with Come Sail Away on** - it sat behind the boat mod's own check. The
  passage is Daggerfall's: offered with the mod off, the boat's line still the mod's.
- Verified: the box outlives the map's close and takes one journey; two offers before a frame leave one box; the
  deck's reading across saves, loads and disembarking; the party's round and the fade's three ends; online, no days.

**LEVEL.**
- BUG: **the live line reflowed the window, and taps missed or landed on the wrong star.** Inside the pick name it
  wrapped to four lines on a phone and came and went with the choice, so the figure above it jumped (390x664: 42 of
  56 aimed taps landed; 360x640: 20, four on another attribute); on a desktop it widened the pick and moved + from
  under the pointer. Each attribute's line now sits over its own blurb, all eight laid in one cell with only the chosen
  one seen, so the band is the tallest's whichever star is chosen; on a phone or a short screen the line takes the
  blurb's place; Luck's blurb is a line shorter (at 360 to 375 wide it was the only one to run to a third line). The
  lane's own probes, re-run: 56 of 56 at every size tried, plain and cursed (the base drew 47 at 360x640); + never
  moves; Ascend shows 34-36px at 844x390 (the base, 22).
- BUG: **the Oghma Infinium's window read the skill sum for a character the mod's bar levels** - the crown asks the
  character's law now, not the screen's lane.
- BUG: **a point held at a floor was not flagged** (a vampire's day never takes a stat below 1) - `capped` asks liveStat
  one point on, so a floor is a ceiling's twin; the line then says "1 for now - a point here won't show".
- RISK: the tints lost to a raised star's gold and beat a full star's grey - by specificity now, measured in Chromium.
- NIT: the mod's canvas window printed the raw bar - `levelBarProgress`, the one reading.
- NOT CHANGED, for the record: at the survival floor the needs' entry is capped against the permanent value when it
  is written each minute (`survival/needs.js`), looser at the read, so a point the star counts can be taken back a
  minute later (Personality 38 under -36: the star 9, the Stats page 9, then 6) - the survival law's two caps, not this
  window's. And the box and the crown differ by a point for ordinary characters: DFU's single against an exact
  fraction, both faithful.

**FRAME.**
- BUG: **with VSync off the Frame Rate Cap could not hold frames above the screen** - 144, 240 and 300 each drew about
  56 a second. With the wait lifted a browser frame that draws nothing costs a whole refresh
  (`display_scheduler.cc`: `if (!needs_draw_) return kLate`), and the gate's held callbacks were exactly those. THE
  PACER (`systems/frameCap.js` `installFramePacer`, first thing at boot, only where the shell says it lifted the wait -
  `daggerShell.framesLifted`, the launch's own switches): a request waits on a timer until just before its slot, and
  the frame that answers is the slot. Measured in Electron 42 under Xvfb with the lane's harness: 144, 240, 300 draw
  144, 240, 300 (5 ms of work a frame: 180); VSync on is untouched (no pacer; 30 still draws 30).
- NITs: the switches' comment said both must go (the frame-rate limit alone frees rAF); the launch read built a whole
  file store, listing every save slot before the single-instance lock - one file now (`fileStorage.cjs` readPref).
- STILL OPEN, for Mac below: CSS animations run at the compositor's rate with the wait lifted; only Linux/X11 was
  measured; on macOS closing the window does not quit the app, so "the next time the app starts" means Cmd+Q.

**RECORDS.** The page's own claims, corrected above in place: the app keeps DFU's rule for VSync OFF, not whole
(with VSync on the cap still holds frames below the screen - FPS-CAP1's departure, which stands there); LEVEL-PCT's
example span (27) is one no character reaches - 36 and 39 are the two of a level's fifteen; the `restart` tier had no
dot of its own and no line in the tier lists; departure 20 was missing from the ledger's Travel Options row; Active-Arcs
still named the retired hint line. The pins: five source pins a comment could satisfy read CODE now
(`test/codeOnly.mjs`); the stars' lowered tint, their screen-reader words, the colours and the folds' channel were
unpinned (`liveTint`, `starLabel`); the ship tests' places are the retail MAPS.BSA's own. Left as practice:
citeShift has moved the historical quotes in `test/scenes/citedrift.test.js` at every batch since at least 698c040b.

## For Mac

- **SHIP-PORT's deck is a departure from Travel Options** (departure 20): on the ship, the ports rule asks of the port
  the ship was boarded at. Kept unless you say otherwise.
- **A point into a curse-capped attribute is still allowed**, as DFU allows it (it counts after a cure). The window now
  says so where it happens; making the press refuse there would change the law, and is yours.
- **With VSync off in the app, CSS animations are not paced** (the boot home's drifting sky, a caret's blink): the
  compositor draws them as fast as it can, so the menus work the GPU hard; DFU's own menus run uncapped with VSync off
  and no cap, but a cap would hold them. Pausing those animations while the wait is lifted is the fix, if you want it.
- **Only Linux/X11 was measured** for FPS-VSYNC: Windows (tearing in fullscreen), macOS and native Wayland are not.

## Records

- Tests: `test/systems/disc28e_levelpct.test.js` (4), `test/systems/disc28e_ascendlive.test.js` (7), `test/systems/travel/disc28e_shipport.test.js`
  (5), `test/ui/settings/disc28e_vsync.test.js` (7) - each red before its fix, but for pins that hold a correction or a mutant
  rather than a fix: the shipport popup's pricing (it held before the batch too), and ascendlive's fold and colours.
  The layout's proof is the level lane's browser probes (aimed taps, band heights, the exit), re-run after the fix;
  the pacer's, the frame lane's Electron harness.
  `test/codeOnly.mjs`, the source pins' code reader (AUDIT 28e).
- Mutants: `tools/mutants/disc28e.json` (95: 93 dead; the deck's column and the percent's scale recorded equivalent);
  `lv1.json`'s `canRaise-restates-the-law-instead-of-asking-it` re-aimed by content (the row's `canRaise` is a const
  now), dead.
- Citations: `tools/citeShift.mjs --apply` (93 moved) and the four struck `world.js` cites CD4 reads moved by hand;
  then, over the Overworld's ship question, `--apply --struck` against that state (20 moved); the second commit
  (SHIP-SAIL, FPS-VSYNC), `--apply --struck` (24 moved); the audit's, `--apply --struck` against 71354d35.
- Re-aimed: `test/systems/travel/to1_travelOptions.test.js`'s D1 pin reads the location through `travelOriginMapId`.
