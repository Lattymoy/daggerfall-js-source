# Tutorials (TUT1, 2026-10-11)

Mac: *"With the introduction of so many new systems, I'd like to replace the current DFU tutorial with our own custom
tutorial that not only explains how to play, but has popups for whenever you are interacting with a new system. We are
also now DFO Online/DFO, so dont mention daggerfall. We also need a menu section where tutorials can be revisited. This
needs to be comprehensive."*

## What it replaced

A new character started DFU's `_TUTOR__` quest (`vendor/dfu-quests/Quests/_TUTOR__.txt`, through
`scenes/quest/questBridge.js` GAME_START_QUESTS - StartGameBehaviour.cs:445-447): a Yes/No prompt and seventeen pages on quest
clocks, in Privateer's Hold and the first city, about DFU's own controls and nothing the port has added since. It named
the old game on its first page.

It is no longer started. What it did besides its pages is kept: every way out of it - finished, or No on any page - ran
its `_no_` task, `start quest 977 977`, the curse on the old capital's streets (a world quest, `scenes/quest/questFoeHost.js`
WORLD_QUESTS). So GAME_START_QUESTS is now `['S0000977', '_BRISIEN']`: the curse starts where the tutorial stood, as it
did for a player who said No to its first page. A save from before TUT1 still inside `_TUTOR__` leaves it at the load
(`retireDfuTutorial`, called after the machine is restored): the quest is removed - no notebook entry, it had nothing to
file - and the curse starts unless the save already holds it. The vendored file stays: it is DFU's data, and the
curse's pins (`test/systems/quest/cursesync.test.js`) read its `_no_` task. Port-Ledger section A carries the departure.

## The three parts

- **The words** - `src/systems/tutorialCatalogue.js`. Sixty-nine pages in thirteen groups (Getting Started, Combat &
  Magic, Your Character, Exploring, Travel & Mounts, Towns, Trade & Guilds, Quests & Bounties, Loot & Gear,
  Professions & Survival, Ships & the Sea, Challenges, Family & Legacy, Playing Online). Each page: an id, a title, a
  `trigger` sentence (when it pops, or MENU_ONLY), paragraphs and points. Every claim was checked against the system's
  own bible page and code when it was written; a slice that changes how a system plays changes its page.
  SHIPYARDS (2026-10-11, `03-World/Shipyards.md`) did: Sailing sends the player to a port's shipyard, not a shelf;
  Shipwrights became Shipyards (the shipmaster, the crew hall, the helm's shipwright); Lighthouses is new - TUT1's
  sixty-eight pages are sixty-nine. AUDIT SHIPYARDS (L7-4, L7-6): Sailing says a bought ship is laid up and brought round
  from the shipyard's Your fleet page (she never waited at the quay), and Shipyards says port towns have one (a town with
  no room stands none).
  TUT1 AUDIT (Mac: "Ensure explanations dont sound AI and arent overloaded"): every page rewritten plain and short -
  at most two paragraphs, three points and sixty words (the first cut averaged 49 words and ran to 113; now 33 and
  60), no asides, no flourish, the words a player uses. The popup lost its foot (the welcome page says where every
  page is read again), a last line is never one word, and a key is named as the keyboard prints it (`keyWord`: `1`,
  `BACKSPACE`, `NUMPAD /` - never the Controls page's `A1`, `BCKSPC`, `KPADDIVIDE`). `test/ui/tut1_tutorials.test.js`
  holds every page to the limits.
  CRAFT-HOWTO (FIELD BUGS 2026-10-18d; MoonGeneral, the Discord's #bug-reports: "Write a bit more detailed piece about
  crafting in the tutorial ... something that helps new players know where to look") added a **Crafting** page to
  Professions & Survival, after Professions: crafting is done at a station, worked from the Stores page - {Professions}, then Holdings > Stores (AUDIT FB1018D L1-6: "Menu > Holdings" is the Enhanced menu's alone);
  each station's shops as the interior host's station questions answer them (a forge at Weaponsmiths and Armorers, a
  loom at Clothing Stores, a workbench at Furniture Stores and joineries, a jeweller's bench at Pawn Shops and Gem
  Stores, a mason's bench at General Stores, Alchemy at Alchemists, Enchanting at Mages Guild halls), a home's own
  stations, cooking at any fire, and each crafting profession's own page (`ui/professions/profPages.js` `CRAFT_HOW`)
  for the rest. Its words are routed through the text core (`tutorials.crafting.*`, drafted in the thirteen whole
  languages). It pops with the first gather, after Gathering and Professions (`scenes/gatherHost.js`'s press, the one
  seam of the three). The Professions page's key had been said to open "them and your Stores": since HOLDINGS the key
  lands on the Professions page and the Stores page is Holdings', so the page says that now. With it the book holds
  seventy-two pages (it held seventy-one before - the count above is the first cut's). Pinned by
  `test/ui/professions/fb1018d_crafthowto.test.js`.
- **The law** - `src/systems/tutorials.js`. The read list and the popups' switch live on the port's prefs shelf
  (`tutorialsSeen`, `tutorialPopups` in `systems/uiPrefs.js` PREF_DEFAULTS) - the PLAYER's, not the character's: a
  second character does not need the inventory explained again. `noteFirstUse(id, { after })` is the trigger every
  seam calls; it is pure and cheap, and a page read or the popups off answer at once.
- **The face** - `src/ui/tutorialPopup.js` (the popup) and `src/ui/tutorialsPane.js` (the menu).

## The popup

A page is a DaggerfallUI.MessageBox in every way that matters - modal, laid over what the player just opened, put away
by a click or any key - so it is an `ActionTextBox` (a `TutorialBox`) offered through `systems/notify.js`'s ladder,
pushed. The four hosts are already its presenters, and both skins already draw it (the enhanced notice panel, the
classic parchment); no host was handed a new seam.

- **Read when dismissed, not when raised.** The box's own close (`onClose`) marks the page read. A box REPLACED in the
  slot before anyone reads it (a lazy window's chunk landing, a host's `showOverlay`) goes back to the front of the line
  and is offered again; a box no presenter takes waits and is offered again (`RETRY_MS`, at most `MAX_RETRIES`).
- **A beat late, one at a time.** A page is offered `SHOW_DELAY_MS` after its trigger, so the window that triggered it
  holds the slot first and the page is pushed over it. A door that is a scene's change (Dagon's Breach, the Rift, the
  arena's sand, a dungeon's first build) asks `after: SCENE_CHANGE_TUTORIAL_MS`, so its page is read on the far side.
  While one page stands, the next waits for its close; while the pause window stands (`pauseDoor.js` pauseFlowShowing)
  every page waits for it - a page is never pushed over the menu.
- **Keys as bound.** A page writes `{Action}` and the popup fills it with the key the player has bound now
  (`boundKeyName`: the Controls page's own names), `[unbound]` when nothing is.
- **The welcome tour.** `startTutorialTour()` - one box of the tour's unread pages (`TUTORIAL_TOUR`: welcome,
  movement, using things, the HUD, the menu and saving), each dismissal turning the page (`addNext`). The two
  new-game seams call it right after `questBridge.initAtGameStart()`: `world.js:"    startTutorialTour();"` and its
  twin in `exterior.js`, where `_TUTOR__` used to speak its first page.

THE FOUR HOSTS: `world.js` and `exterior.js` import `startTutorialTour`; `worldModes.js` and `dungeonContext.js` import
`SCENE_CHANGE_TUTORIAL_MS`. Each import loads the module, and the module registers itself as the trigger's handler
(`setTutorialHandler(tutorialFirstUse)`); a trigger before any host has loaded waits, a few at most.

## The seams

One shared door is one seam for every host. The trigger stands in:

- the window doors: `inventoryDoor` (the pack, or the loot page for a pile or a body), `charSheetDoor` (the sheet, or
  level-up while one is owed), `spellbookDoor`, `restDoor`, `automapDoor` and `townMapDoor`, `travelMapDoor`,
  `talkDoor`, `tradeDoor` and `merchantRepairDoor`, `tavernDoor`, `chronicleDoor` (quests, or the notebook),
  `bountyDoor` (the board), `noticeDoor`, `arenaDoor`, `brokerDoor`, `reforgeDoor`, `playerTradeDoor`,
  `navalPlunderDoor` (the shipwright's yard and a port's shipyard - one page - or a prize's hold);
- the windows with no door: `BankWindow`, `SpellMakerWindow`, `GuildServiceWindow` and `CovenWindow`,
  `CourtScreenWindow`, `DeathScreen` (the page waits beneath it - it keeps the top - and is read after),
  `createUseMagicItemWindow`, `socketChooser`, `setCard`, `createCardTableHud` and `openIliacTableGame`,
  `createSuccessionOverlay`, the wallet's sheet (`enhancedInventory.js` walletSheet, the classic box in
  `nativeInventory.js`);
- the systems: the first weapon drawn (`PlayerWeapon.toggleSheath`), the first hotbar press (`useQuickslot`,
  `pressHotbar`), the first gather (`gatherHost`), the first torch lit, the transport window and a quick mount, a wagon
  touched (`horseCartPool`), a lighthouse climbed (`portHost`, SHIPYARDS), the Overworld, a carriage, a disease begun, a search, a summoning, a felt need (the HUD's
  survival chips), a rare find (the loot banner), quest news (the herald) and a quest followed (the tracker), a
  level-up announced, a revenant's card and its judgement (with the companion page beside it), chat opened;
- the hosts' own arms, where no module stands between: `world.js` a boat touched, a portal stone used, F pressed, a duel
  asked, a material bagged, the online session's setup, the open zone entered; `worldModes.js` a house offered or
  rented, an Ocean Hole entered;
- the scene changes: `dungeonContext.js` at a build, the page of the place it stands - Dagon's Breach's court, the
  arena's sand, the Abyss Dungeon or its Shattered Hour, or the first dungeon past the starting cave.

A trigger is never put inside a host closure a test lifts and `eval`s (the card table's, the succession's - the first
cut did, and those pins named `noteFirstUse` undefined): it goes in the module that closure calls. And no module the
account Worker bundles imports `systems/tutorials.js` (`test/server/accountdeploy.test.js` walks that graph - the wallet's
ledger is in it, so its page pops from the two views that show the ledger instead).

`test/ui/tut1_tutorials.test.js` sweeps src/ both ways: every page that says it pops has a seam, every seam names a page,
and a MENU_ONLY page has none.

## AUDIT TUT1 (2026-10-11, Mac: "Audit and ensure perfection")

An independent read of the whole change found four bugs and three slips; each is fixed and pinned, and every new pin
was mutation-checked (six mutants, six dead).

1. **A page could vanish and stall the line for the session.** The dungeon's pack crossing to the sheet (and two more
   of its doors) writes the slot by hand; its stack swaps the top in place and disposes nothing, so a page over the
   pack was dropped with neither its close nor its replacement told. A watchdog now asks the hosts while a page stands
   (`systems/notify.js` windowHeld; each host registers a `holds`-only presenter beside its own, answering from its
   stack - townTalk, worldModes' interior, the dungeon's - so the pinned presenters keep their shape); twice no and the page is offered again. A page merely covered is still held, and waits.
2. **A held key or the attack click swatted a page unread.** The hosts hand every keydown to the top window, repeats
   included, and a click to it whatever it is. A page now takes no input until it has stood `INPUT_GRACE_MS` and a
   fresh press (a key going down, not repeating; a click; a tap; the pad and the touch layer press real keys) has come
   after the grace - a key pressed as it appeared and held is not a reading. A click it is not ready for is still its
   own, never the world's.
3. **A scene's page could land under the loading screen** (the 4 s count starts at the door; a cold dungeon build can
   take longer) and the first key after arrival put it away. Pages wait out `loadingHeld()`. An Ocean Hole popped two
   pages back to back (its door's and the build's); the build alone asks now, by the abyss's id.
4. **The pause hold missed windows the door opens past its own entry** - the classic window's Controls detour to the
   enhanced Settings, and the fresh classic window its Resume opens. Both are tracked (`pauseDoor.js` `shown`).

The slips: a counter refused to a transformed lycanthrope, and a summoning refused for gold, popped their pages
though nothing opened (both moved past the refusal); another player's horse or wagon popped the page for the player's
own (only `KEY_WAGON`, `KEY_FOLLOWING_WAGON` and `KEY_HORSE` do now). And `retireDfuTutorial` keeps a throwing curse
start from aborting the load around it.

Checked and found sound by the same read: no server or worker bundle reaches the tutorial modules; PlayerWeapon is the
local player's alone; the per-frame seams call only with something to show (and the read set is kept while the shelf's
list is the same array - 0.3 microseconds a call); the L and N keys reach the quests and notebook pages; the pane
writes text only through textContent; the welcome tour starts only for a new character (an heir, the Test Room, a
headless `?class=`, a new online character), never a loaded save.

## PLEA-LOOP: a page over a decision (FIELD BUGS 2026-10-13b)

A page is pushed over the window that reached its system, and the keys go to the page alone - which is DFU's law: the
top window takes the input. The court broke it on the enhanced skin. The Crime page's seam is the courtroom's
constructor, so a beat after the court opens the page stands over the plea; the plea, the enhanced keyed menu's DOM
dialog, answered its own buttons wherever it stood, and its scrim took the click the page's "click or press any key"
asked for. A Guilty pressed under the page pleaded, the prison screen replaced the PAGE, and the answered plea stayed in
the stack, painted with live buttons - a loop of pleas (`01-Overview/bugs/Field-Bugs-2026-10-13b.md` PLEA-LOOP). A covered
keyed menu now takes no pointer and answers nothing (`ui/windowStack.js` windowCovered, `ui/enhanced/enhancedDialog.js`): the
click falls through to the canvas and puts the page away, as a key does. A buttoned box (`ui/messageBox.js`'s, DLG1)
always replayed its press on the canvas, so its host handed that to the top window; the keyed menu was the one
dialog that reached its window directly.

## The menu

The pause window has a **Tutorials** tab (`enhancedMenu.js` PAUSE_TABS, before System); the front door and both shell
rails carry a **Tutorials** section (SECTIONS_BOOT, SECTIONS_CLASSIC, SECTIONS_PAUSE). Both draw the one pane,
`drawTutorialsPane` - the Screenshots pane's law. It is the journal's bones: the pages on a left rail under their
groups (a gem on a page not yet read), a search over titles and words, the chosen page on the right - its title in wing
rules, its group and when it pops, its paragraphs, its points - with Previous and Next. Above it: the popups' switch,
Show all again (asks twice; every popup will show once more) and Mark all read. Reading a page in the book marks it
read. The pane repaints only itself, so the search box keeps its focus. `releaseTutorialsPane` at the menu's unmount.

## Not done

- No browser probe has driven a popup in the real game here: this container has no ARENA2. The line, the box and the
  seams are pinned headless; the draw is the message box's own, on both skins.
- The menu's About pane still says "Daggerfall Online" - Mac's rename to DFO was asked for the tutorial; the brand
  elsewhere is a change of its own.
