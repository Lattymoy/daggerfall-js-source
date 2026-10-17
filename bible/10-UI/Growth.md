# Growth - one tab for how a character grows (GROWTH)

> Design page and record (2026-10-17). Shipped in one pull request beside RVN-OWN-KNEEL (#997), by the owner's choice;
> its parts are the parts of this page. Where the page and the code disagree, the code's own headers
> (`src/ui/growth/growthTab.js`, `src/ui/growth/specGuide.js`, `src/ui/growth/growthStage.js`) and the pins are what runs.

## 1. What was asked

The owner, 2026-10-17, on top of RVN-OWN-KNEEL's pull request:

> *"I want to properly give the specialization its own UI for ease of player use and proper descriptions instead of
> keeping players guessing."*
>
> *"On top of this instead of having ascend in one place and the firmament trees in another (including the new naval
> tree), I want to give the firmament, level up page, and specializations its own tab within the pause menu."*

Four questions were put, and the owner chose:

- **The tab's name:** *Growth*.
- **The skies:** *drawn in the tab* - the Firmament and the captain's stars stand inside the tab's pane, not over it.
- **The old doors:** *move them* - the Stats page's Ascend and Firmament buttons, the Master Skills page's two
  specialisation cards and the Captain page's "Open the stars" all lead into the tab now; none stays where it was.
- **The classic skin:** *yes* - the classic sheet's specialisation rows open the same guide.

## 2. What stood before, and what DFU does

Measured on the merge base (ce80d92d7):

| Thing | Where it stood | What it said |
|---|---|---|
| The Ascension (LV1, ASCEND-ANYTIME) | the enhanced Stats page's Ascend button, swapped in over the pause window (`pauseDoor.js` and `charSheetDoor.js`, each its own copy) | the stars; a level owed went to the rollout instead |
| The Firmament (FIRM1) | the Stats page's Firmament button beside Ascend, swapped in over the window (`firmamentOver.js`, DELETED by GROWTH3) | the sky, online alone |
| The captain's stars (CAPTAIN-TREE) | the Holdings tab's Captain page, "Open the stars" - the pause put down and the sky opened over the world | the captain's sky |
| The specialisations (SCHOOLS1, MARTIAL1) | two cards on the Stats tab's Master Skills page | each OPEN path's name and its two skills, and Choose - nothing about what a path does, nothing about a path not yet open |

So a player who wanted to know what a specialisation was had its name and two skills to go on, and a path they could
not choose yet was not shown at all: that is the guessing the owner named.

**DFU has none of it.** Its pause window (`DaggerfallPauseOptionsWindow`, OPTN00I0.IMG - the classic skin's
`ui/pauseWindow.js`) is a column of options with no tabs; its level-up is a StatsRollout mounted on the character sheet
(DaggerfallCharacterSheetWindow.cs:369-394), not a window of its own; it has no specialisations, no passive sky and no
captain. Everything on this page is the port's own over DFU's law: the level's points are still `applyLevelUp`'s and
the bonus pool `FormulaHelper.BonusPool`'s draw (`advancement.js` bonusPoolFor), the masteries are SOFTCAP's
(`masterSkills.js`), the paths are SCHOOLS1's and MARTIAL1's laws (`arcanePaths.js`, `martialPaths.js`), the skies
FIRM1's and CAPTAIN-TREE's. **Departures named:** the tab itself; the level spent in a pane of the pause window rather
than on the sheet (the enhanced skin's Ascension was already one - LV1 - and is moved, not made); the guide's reading of
a path that is not open yet.

## 3. GROWTH1 - the tab

`ui/enhanced/enhancedMenu.js` PAUSE_TABS: **Quests, Stats, Growth, Holdings, Family, Tutorials, System** - Growth after
the Stats it grew out of. Its body (`pauseGrowth`, `ui/growth/growthTab.js` drawGrowthTab) is PX6's journal bones once
more: a rail of pages on the left, the page on the right.

| Page | Draws | Was |
|---|---|---|
| Level | the Ascension in the pane (section 4): a level owed spent here, else the view of the stars | the Stats page's Ascend |
| Specialisations | the guide to both families' thirty paths (section 5) | Master Skills' two cards |
| Firmament | the sky in the pane, online; offline, what it is and why it waits | the Stats page's Firmament |
| Captain's Stars | the captain's sky in the pane - only where the host hands one over (`growthSections`) | the Captain page's door |

- **The rail's marks** (`growthDue`): Level `!` while a level is owed; Specialisations the paths open to choose (both
  families); Captain's Stars the points not yet set. The Stats page's **Growth door** stands where Ascend and Firmament
  stood and carries their sum - `Growth (2)` - primary while anything waits (`ui/enhanced/enhancedMenu.js:"const g = el('button', n ? 'act primary' : 'act'"`).
- **Landings** (`at`, the window's one way in by name): `growth`, a page's id (`level`, `specs`, `firmament`,
  `captain`), or a family's guide (`specs:arcane`, `specs:martial`). The names live in a leaf of their own,
  `ui/growth/growthPages.js`, because the boot doors read them (`pauseDoor.js`) and the tab's guide reads the
  spellbook's chunk - the boot bundle law (ASCEND-ANYTIME's lazy chunk) holds.
- **A visit is fresh** (`resetGrowthTab`): the window's mount puts the rail on its landing's page (else Level), the guide
  on its family, no face up. Leaving the tab or the window drops the face (`releaseGrowthTab`) - its pending stars asked
  about first by its own Escape (section 6).
- **The doors in:** the Stats page's Growth door; Master Skills' one line and its Specialisations press (where the two
  cards stood: `pause.master.specMoved`); the Holdings Captain page's "Open the stars" (the Growth tab on Captain's
  Stars; a menu with no Growth tab still opens them over the world, CAPTAIN-TREE's door); the classic sheet's S and W
  rows (section 7); the one ask's words (section 7).

## 4. The Level page

The Ascension (`ui/enhanced/enhancedLevelUp.js`) drawn in the pane, through its lazy chunk as before.

- **A level owed** is spent through the door's own rollout - `charSheetDoor.js` levelUpScreenFor, the one home of the
  screen both the sheet key and the tab build (ORL1's Virtue screen for a mod-law character, DFU's own for any other,
  LV2's fanfare only while the notice still owes it). A door that hands none, or nothing owed, draws the view
  (`levelUpView.js` viewOnlyScreen - ASCEND-ANYTIME's, writing nothing).
- **Leave and come back as you like.** The bonus pool is drawn once a level and remembered on the character
  (`advancement.js` bonusPoolFor, AUDIT LV2's fix), so leaving the tab mid-spend and returning re-rolls nothing; the
  points stay owed until Ascend.
- **The other ways still stand:** F5 and the level notice's row open the rollout itself with a level owed (LV2, LV3) -
  the tab adds a way in, it replaces none.

## 5. GROWTH2 - the Specialisations guide

`ui/growth/specGuide.js`: both families, every path, read off the laws (`FAMILY_LAW` - the arcane law's schools and
spell, the martial law's weapons and technique, one shape). Pure model (`specGuideModel`), then the page.

- **A path's state, on THIS character** (`SPEC_STATES`): **Chosen**; **Open to you** (both mastered - Choose stands);
  **Master its skills** (both at 100, a Master Skills press away); **Within reach** (both still masterable); **Closed**
  (the family's other path held - one of each, for good); **Not for your class** (a skill the career cannot master, or
  whose group's masteries are spent). In that order, and within a state the nearest first - the points its pair still
  owes 100 - then the laws' order.
- **What opens it:** each skill of the pair in its own words (`skillStandText`) - mastered, ready to master in Master
  Skills, its climb ("76 of 100, then master it"), its group's masteries all chosen, or no skill of the class.
- **What it does:** the passive (its name and the law's own sentence); the signature - a spell read as the spellbook
  reads it (`spellLines`: its target and element, each effect's line from `effectWords`, the maker's empty slots
  skipped), or a technique by each of its weapons (`techniqueLines`: cooldown and fatigue, the forms' own numbers) with
  the law's rider; and how it is used (bought at the Mages Guild and cast; or the Weapon Technique key with one of its
  weapons in hand, a weapon's own technique line first).
- **Choose** asks in the law's own box (`pathChoiceRows` / `martialChoiceRows`) and commits through the law
  (`choosePath` / `chooseMartialPath`) - permanent, as before; the page writes nothing itself.
- **The page:** the two families as a switch, each with its count of open paths (it starts on a landing's family, else
  the one where a path is held or open, else the one the class can meet); the family's line (the path held, the paths
  open, how one opens, or why none can) over its six skills, each with the Stats page's skill bar (gold past 100) and
  its state in a word, and a door to Master Skills; then every path the class can reach as a bar (its name, its pair,
  its state's tag) that opens its detail beneath it - "Show all fifteen paths" adds the rest. Master Skills off: the
  page says no path can open, and where the switch is (offline, Master Skills).

## 6. GROWTH3 - the stage: the skies drawn in the tab

`ui/growth/growthStage.js`. The pause window redraws its whole tree on every press (`enhancedMenu.js` render), and a
sky is a canvas with a view and pending stars - so a face (the Firmament, the captain's stars, the Ascension) is
**mounted once a visit** into a host element of its own, and each draw of the page **moves that host** into the new
pane (`drawStage`: the key changes, the last face is dropped; the same key, the same host).

- **The window widens** while a face stands (`px-win-wide`: up to 1440 x 940, 98% of the screen) and the rail becomes a
  strip over the face, wrapped and never scrolled so the lit page stays in sight.
- **Full screen** moves the same host into a box over everything (on the body, so no ancestor's transform holds it)
  and back.
- **A phone's stage is the screen:** at 660 px and under, a face's own bar alone fills the pane, so the page is its line
  and an Open door, and the face opens over the whole screen - kept as it was between two opens, until the page, the
  tab or the window is left.
- **One Escape, one owner.** The window's back stack asks the tab first while a face stands
  (`ui/enhanced/enhancedMenu.js:"if (!growthBack()) onAction('resume');"`): the face's own back (a confirm shut; unaccepted stars
  asked about once - "Press Escape again to discard them"), then full screen left, then the window resumes.
- **The three windows' `embed` mode** (`firmamentWindow.js`, `captainTreeWindow.js`, `enhancedLevelUp.js`): absolute in
  the stage at its size (a ResizeObserver refits the view the first time it has a true size), no overlay registered (the
  pause window is the overlay), no Escape of their own, the Firmament's and the captain's Exit hidden, and **deaf while
  detached** - a stage between two draws, or a phone's face waiting for its door, hears no key
  (`firmamentWindow.js:"if (dead || (embed && !root.isConnected)) return;"`). A level left mid-spend stays owed: the
  Ascension's Escape is the window's.

## 7. GROWTH4 - the classic skin and the words

- **The classic sheet's rows:** the S row (arcane) and the W row (martial) under Master Skills on each skill page now
  stand whenever the class can meet a path (`pathPossible`, `martialPossible`) - not only once one is open - and where
  a document stands they open the Growth tab's guide on their family: the enhanced pause window, pushed as the sheet's
  own child with the host's pause bag (`charSheetDoor.js` hooks.growth), its Resume back to the sheet. `pauseDoor.js`
  opens a Growth landing on either skin. No document (node, tests), no hook: the rows keep their boxes. The classic
  skin's own level-up is DFU's sheet rollout, unchanged; its pause window (OPTN00I0) is DFU's, unchanged.
- **The one ask's words** (`scenes/shared.js`, after a second mastery): on the enhanced skin, the No and the
  several-open box name the Growth tab ("You can choose a specialisation later on the Growth tab of the pause menu" -
  `pathDeclinedGrowthText`, `martialDeclinedGrowthText`, `pathsOpenRows(.., { growth })`); on the classic skin, the
  skill screen, whose rows open the same guide.
- **Every word through the text core** - 81 new strings (`growth.*`, `pause.door.growth*`, `pause.master.spec*`,
  `schools.*Growth`, `martial.*Growth`, the sheet's guide rows, `captain.sky.unacceptedEsc`), drafted in-session into
  the thirteen whole languages (`tools/l10nInSession.mjs`).

## 8. The four hosts

The tab is the pause window's, which every host opens through the same two doors (`pauseDoor.js`: Escape and Tab's
dial; `charSheetDoor.js`: the sheet key) - so `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` and
`scenes/dungeonContext.js` all reach it with no line of their own. `scenes/world.js` alone hands a captain's sky over
(the Holdings provider's `captain.stars`, `scenes/captainPageHost.js` - Come Sail Away on), so the Captain's Stars page
stands there; the other three hand none, and the rail shows three pages. No host grew (HOST-SPLIT): world.js's line is
one entry of the provider object it already built.

## 9. Pins and proof

- `test/ui/growth/growth1_tab.test.js` (11): the tab, its rail and landings, what waits; the guide's states, order and
  words, a signature read, Choose through the law; the stage (mounted once, moved, full screen, the phone's door, the
  tab's Escape) and the windows' `embed` modes by source; the classic rows and the ask's words; the pause window driven
  over the fake document (the Growth door's count, a family's landing, a path's detail, Choose, Master Skills' and the
  Captain page's doors). Mutants: `tools/mutants/growth.json` (37, all dead).
- Pins moved to what stands: `ascendanytime` (the Level page; the door's rollout and its remembered pool), `orl1_leveling`,
  `levelNotice`, `f5quests`, `slots1`, `martial_paths`, `audit_martial`, `audit_schools`, `holdings`, `captlog`,
  `auditlegacy`, `auditlegacy3`, `legacy3_familytab`, `auditcards5_ui`, `moduleload_smoke` (the lab's own module).
- The browser half: `tools/growthProbe.mjs` over its lab (`growth.html`, `src/tools/growthLab.js`) - each page at a wide
  screen and a phone with no page error and no sideways scroll, the faces in the pane at the stage's size, the phone's
  doors, full screen and back, and the Escape held by unaccepted stars (31 of 31).
