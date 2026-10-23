# Growth - one tab for how a character grows (GROWTH)

> Design page and record (2026-10-17). Shipped in one pull request beside RVN-OWN-KNEEL (#997), by the owner's choice,
> with RVN-STARS (#999) merged into it (section 1); its parts are the parts of this page. Where the page and the code disagree, the code's own headers
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

Then, the same day: *"We need to also add a section for the upcoming revenant tree"* - RVN-STARS (#999, each sworn
revenant's own sky, `06-Systems/Revenants.md` section 44), open beside this pull request. A fifth page was built on
#999's branch merged in, and then withdrawn: *"Nvm. Keep it on the companion page."* The page went; #999 stays merged
here, its sky opened from the Companions page over the pause window as #999 built it (`firmamentOver.js`
revenantStarsOver - the file keeps that door; the Firmament's own went to this tab). The two pull requests touched the
same doors and windows (`firmamentOver.js`, `captainTreeWindow.js`, the pause and sheet doors), so the overlap is
settled here once: `skyWindow.js` (#999's one sky window) carries GROWTH3's `embed` mode for the captain's stars, and
the merge found the hole GROWTH5 closes (section 6).

## 2. What stood before, and what DFU does

Measured on the merge base (ce80d92d7):

| Thing | Where it stood | What it said |
|---|---|---|
| The Ascension (LV1, ASCEND-ANYTIME) | the enhanced Stats page's Ascend button, swapped in over the pause window (`pauseDoor.js` and `charSheetDoor.js`, each its own copy) | the stars; a level owed went to the rollout instead |
| The Firmament (FIRM1) | the Stats page's Firmament button beside Ascend, swapped in over the window (`firmamentOver.js` - that door taken out by GROWTH3; the file keeps RVN-STARS' revenant door) | the sky, online alone |
| The captain's stars (CAPTAIN-TREE) | the Holdings tab's Captain page, "Open the stars" - the pause put down and the sky opened over the world | the captain's sky |
| The specialisations (SCHOOLS1, MARTIAL1) | two cards on the Stats tab's Master Skills page | each OPEN path's name and its two skills, and Choose - nothing about what a path does, nothing about a path not yet open |

So a player who wanted to know what a specialisation was had its name and two skills to go on, and a path they could
not choose yet was not shown at all: that is the guessing the owner named.

**DFU has none of it.** Its pause window (`DaggerfallPauseOptionsWindow`, OPTN00I0.IMG - the classic skin's
`ui/pauseWindow.js`) is a column of options with no tabs; its level-up is a StatsRollout mounted on the character sheet
(DaggerfallCharacterSheetWindow.cs:369-394), not a window of its own; it has no specialisations, no passive sky and no
captain, and no revenants. Everything on this page is the port's own over DFU's law: the level's points are still `applyLevelUp`'s and
the bonus pool `FormulaHelper.BonusPool`'s draw (`advancement.js` bonusPoolFor), the masteries are SOFTCAP's
(`masterSkills.js`), the paths are SCHOOLS1's and MARTIAL1's laws (`arcanePaths.js`, `martialPaths.js`), the skies
FIRM1's, CAPTAIN-TREE's and RVN-STARS'. **Departures named:** the tab itself; the level spent in a pane of the pause window rather
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

- **The rail's marks** (`growthDue`): Level `!` while a level is owed; Specialisations a choice waiting in each
  family (1 or 2 - three schools mastered open three paths, one choice: AUDIT GROWTH LANE1-10, as the Master Skills
  door counted); Captain's Stars the points not yet set. The Stats page's **Growth door** stands where Ascend and Firmament
  stood and carries their sum - `Growth (2)` - primary while anything waits (`ui/enhanced/enhancedMenu.js:"const g = el('button', n ? 'act primary' : 'act'"`).
- **Landings** (`at`, the window's one way in by name): `growth`, a page's id (`level`, `specs`, `firmament`,
  `captain`), or a family's guide (`specs:arcane`, `specs:martial`). The names live in a leaf of their own,
  `ui/growth/growthPages.js`, because the boot doors read them (`pauseDoor.js`) and the tab's guide reads the
  spellbook's chunk - the boot bundle law (ASCEND-ANYTIME's lazy chunk) holds.
- **A visit is fresh** (`resetGrowthTab`): the window's mount puts the rail on its landing's page (else Level), the guide
  on its family, no face up. Leaving the tab or the window drops the face (`releaseGrowthTab`) - its pending stars asked
  about first (section 6).
- **The doors in:** the Stats page's Growth door; Master Skills' one line and its Specialisations press (where the two
  cards stood: `pause.master.specMoved`); the Holdings Captain page's "Open the stars" (the Growth tab on Captain's
  Stars; the page's kit makes `growth` optional, so a caller without the tab would open them over the world through
  CAPTAIN-TREE's door - none draws it so today, AUDIT GROWTH LANE5-19); the classic sheet's S and W rows (section 7); the one ask's
  words (section 7).

## 4. The Level page

The Ascension (`ui/enhanced/enhancedLevelUp.js`) drawn in the pane, through its lazy chunk as before.

- **A level owed** is spent through the door's own rollout - `charSheetDoor.js` levelUpScreenFor, the one home of the
  screen both the sheet key and the tab build (ORL1's Virtue screen for a mod-law character, DFU's own for any other,
  LV2's fanfare only while the notice still owes it, and once a level from this door too - the page builds the screen
  on every visit, and a level the strip never announced, loaded from a save or the Oghma's, played it each time: AUDIT
  GROWTH LANE1-8; DFU plays it once a level as well - its sheet refuses to close with points unspent,
  DaggerfallCharacterSheetWindow.cs CheckIfDoneLeveling :437-443, so it is never mounted twice for one level). A door that hands none, or nothing owed, draws the view
  (`levelUpView.js` viewOnlyScreen - ASCEND-ANYTIME's, writing nothing).
- **Leave and come back as you like.** The bonus pool is drawn once a level and remembered on the character
  (`advancement.js` bonusPoolFor, AUDIT LV2's fix), so leaving the tab mid-spend and returning re-rolls nothing; the
  points stay owed until Ascend.
- **The other ways still stand:** F5 and the level notice's row open the rollout itself with a level owed (LV2, LV3) -
  the tab adds a way in, it replaces none.

## 5. GROWTH2 - the Specialisations guide

`ui/growth/specGuide.js`: both families, every path, read off the laws (`FAMILY_LAW` - the arcane law's schools and
spell, the martial law's weapons and technique, one shape). Pure model (`specGuideModel`), then the page.

- **A path's state, on THIS character** (`SPEC_STATES`): **Chosen**; **Available** (both mastered - Choose stands);
  **Needs mastering** (both at 100, a Master Skills press away); **Within reach** (both still masterable); **Closed**
  (the family's other path held - one of each; its line points to the held path's Reset - and only where a reset could open it: section 10); **No slots left** (the mastery slots left cannot hold the
  pair: a group the player's own masteries filled, or two skills of one group with one slot left - Master Skills'
  own count, `masterSkills.js:"export function masterableCount(entity, ids) {"`, as `pathPossible` and `martialPossible`
  count the family - AUDIT GROWTH LANE1-1, LANE1-4); **Not for your class** (a skill the career cannot master). In that
  order, and within a state the nearest first - the points its pair still owes 100 - then the laws' order.
- **The state's line** names the skill when only one still needs it ("Raise Axe to 100 and master it", "Master
  Alteration on the Master Skills page"), "both" only when both do (LANE1-12); with Master Skills off, a pair with nothing
  left to climb says to turn it on (LANE1-2). The chosen path says when its powers are off - Master Skills off,
  mentoring, a refereed duel, the beast for a martial path (`pathAwake`, `martialAwake` and the powers' gates; LANE1-3).
  A skill past 100 shows the value the game reads (`masterCappedSkill`: 100 while Master Skills is off).
- **What opens it** (the detail's Requirements): each skill of the pair in its own words (`skillStandText`) - mastered,
  ready to master in Master Skills, its climb ("76 of 100, then master it"), no mastery slots left in its group, or not
  a class skill - and, when one slot is left for two skills of one group, that ("Illusion and Mysticism are both minor
  skills, and you can master only one more minor skill", `pathSteps`).
- **What it does:** the passive (its name and the law's own sentence); the signature - a spell read as the spellbook
  reads it (`spellLines`: its target and element, each effect's line from `effectWords`, the maker's empty slots
  skipped), or a technique by each of its weapons (`techniqueLines`: cooldown and fatigue, the forms' own numbers) with
  the law's rider; and how it is used (`useLine`: bought wherever spells are sold - every Buy Spells shelf, the guilds'
  and the temples' - and cast; or the Weapon Technique key while fighting with one of its two skills, a weapon's own
  technique first only while the loot ladder is on - `combat/techniques.js` techniqueInHand; LANE1-11).
- **Choose** asks in the law's own box (`pathChoiceRows` / `martialChoiceRows`) and commits through the law
  (`choosePath` / `chooseMartialPath`) - permanent but for SPEC-RESET's paid reset (section 10); the page writes nothing
  itself.
- **The page:** the two families as a switch, each with its count of open paths (it starts on a landing's family, else
  the one with a path open, else the one held, else the one the class can meet - `firstFamily`, LANE1-9); the family's
  line (`familyLine`: the path held, the paths open, how one opens, or why none can - the class, or the slots its
  masteries spent) over its six skills, each with the Stats page's skill bar (gold past 100) and
  its state in a word, and a door to Master Skills; then every path the class can reach as a bar (its name, its pair,
  its state's tag) that opens its detail beneath it - "Show all 15 paths" adds the ones out of reach (no slots, or
  not for the class). Master Skills off: the
  page says no path can open, and where the switch is (offline, Master Skills).

## 6. GROWTH3 - the stage: the skies drawn in the tab

`ui/growth/growthStage.js`. The pause window redraws its whole tree on every press (`enhancedMenu.js` render), and a
sky is a canvas with a view and pending stars - so a face (the Firmament, the captain's stars, the Ascension) is
**mounted once a visit** into a host element of its own, and each draw of the page **moves that host** into the new
pane (`drawStage`: the key changes, the last face is dropped; the same key, the same host).

- **One window for the whole tab** (GROWTH-BOOK, 2026-10-20, Dudey: *"it looks very messy changing its sizes all the
  time ... structure it better so it doesnt change the window each time you click an option in the growth tab"*). The
  Growth tab always wears `px-win-growth` (up to 1320 x 860, 96% of the screen), face or none, so pressing the rail
  never resizes the window. The rail is always the journal's left column, each entry with a short line under its name
  (the Grimoire: the book's left page, a quarter of the book). Every page has the same bones: its title, its line (and
  Full screen), then its stage filling the rest of the page - or, on the Specializations page, its text scrolling in
  it. The Level page's door is a centred card: the level in a diamond, a heading, the line and Open.
- **Full screen** moves the same host into a box over everything (on the body, so no ancestor's transform holds it)
  and back. The face stands above a strip of its own with the leave press in it (laid over the face, it sat on the
  Ascension's Ascend and the skies' summary panel), and the focus stays in the box (a Tab walked under it to the
  window's tabs) - AUDIT GROWTH LANE2-8, LANE2 N2/N3.
- **The Level page's face** is drawn in the pane only where the pane holds it - a Plus window at least 1000 px tall
  (`growthTab.js:"const LEVEL_PANE_MIN_H = 1000;"`); elsewhere, and always in the Grimoire's dress, the page is its line
  and the phone's Open door (below), the face full screen. The Ascension is laid out for the whole screen - at 1366x768
  in the pane its figure flattened to 28 px and its stars stood on each other, Ascend fell off a 1024x600 pane, and the
  Grimoire's book is scaled to the screen, not the pane (AUDIT GROWTH LANE2-8).
- **The Grimoire's rail** is the book's left page at a quarter of the book (its usual third left the sky too little
  room - LANE2-9), never a strip over the face (GROWTH-BOOK).
- **A face is built only while its page stands** (a Level face dropped before its chunk landed drew its pool and played
  its fanfare - LANE2 N4), and a chunk that fails is tried once more; one a deploy took says a reload fixes it -
  MENU1's words (`enhancedChunk.js` RELOAD_TEXT), not "try again" (LANE2-10).
- **A phone's stage is the screen:** at 660 px and under, a face's own bar alone fills the pane, so the page is its line
  and an Open door, and the face opens over the whole screen - kept as it was between two opens, until the page, the
  tab or the window is left.
- **One Escape, one owner.** The window's back stack asks the tab first while a face stands
  (`ui/enhanced/enhancedMenu.js:"if (!growthBack()) onAction('resume');"`): the face's own back (a confirm shut; unaccepted stars
  asked about once), then full screen left, then the window resumes.
- **Leaving asks first** (GROWTH5, AUDIT RVN-STARS S8's law for every face): another rail page, another tab, the
  sheet's key and the QuickDial's (`charSheetDoor.js` - the menu's `asksFirst`), a tap outside the window and a timers
  row's door (AUDIT GROWTH LANE3-4, LANE2-3) each ask the face before they drop it (`stageAsks` - the face's own ask,
  never full screen's): unaccepted stars said once ("You have unaccepted changes. Press Accept to keep them, or leave
  again to discard them." - LANE5-10: "do that again" read as "press Accept again"), the second press goes. The ask is
  for the stars it named: a star taken or given back after it, and the next leave asks again (LANE3-8 - it re-armed on
  a key alone, never the pointer). A phone's face asking while it stands nowhere (its full screen left) is opened full
  screen first, so the ask is read (LANE3-6). Merged, this found
  the hole GROWTH3 had left: the sheet's key, the dial's key and a click elsewhere threw unaccepted stars away unasked.
  The one sky still laid over the window - a sworn revenant's, from the Companions page - asks the sheet's own keys the
  same way (`firmamentOver.js` revenantStarsOver's `asks`, through `skyWindow.js` back(); AUDIT GROWTH LANE4-1: F5 and
  the pack key's crossover dropped its pending stars unasked, #999's own hole).
- **The windows' `embed` mode** (`firmamentWindow.js`, `skyWindow.js` - the one window the captain's sky draws through
  since RVN-STARS, the revenants' too, unembedded - and `enhancedLevelUp.js`): absolute in
  the stage at its size (a ResizeObserver refits the view the first time it has a true size), no overlay registered (the
  pause window is the overlay), no Escape of their own, the Firmament's and the captain's Exit hidden, and **deaf while
  detached** - a stage between two draws, or a phone's face waiting for its door, hears no key
  (`firmamentWindow.js:"if (dead || (embed && !root.isConnected)) return;"`) - **or while a window over the pause
  window holds the stage inert** (the account window's fields lost their letters to the skies, and its Enter accepted
  the captain's stars - LANE2-1). A focused button's Enter is the button's (the Stats tab's Enter pressed Ascend -
  LANE3-3). Their line under the bar is placed in the root's own frame (it stood 200 px low in the pane, or off a short
  stage - LANE2-6). The view of the stars in the tab has no Close: the page is its place (LANE3-7). A level left
  mid-spend stays owed: the Ascension's Escape is the window's; the points placed are placed again, and the page says so.
- **The guide's Yes/No card** answers its own keys while it stands - its Escape is its No, the window's back stack
  stands down - and goes with the window (LANE3-9: Escape closed the card and the window; F5 left it over the running
  game, its Y still choosing a permanent path). Since AUDIT SPEC-RESET L3-3/L3-4 it is modal to the keys and the reader
  too (named by its rows, the window under it inert, the focus on No and back to its opener) and answered once.

## 7. GROWTH4 - the classic skin and the words

- **The classic sheet's rows:** the S row (arcane) and the W row (martial) under Master Skills on each skill page now
  stand whenever the class can meet a path (`pathPossible`, `martialPossible`) - not only once one is open - and where
  a document stands they open the Growth tab's guide on their family: the enhanced pause window, pushed as the sheet's
  own child with the host's pause bag (`charSheetDoor.js` hooks.growth), its Resume back to the sheet. `pauseDoor.js`
  opens a Growth landing on either skin. No document (node, tests), no hook: the rows keep their boxes. The classic
  skin's own level-up is DFU's sheet rollout, unchanged; its pause window (OPTN00I0) is DFU's, unchanged.
- **AUDIT GROWTH on the classic sheet** (lane 3): **no Growth window while the rollout stands** - its points live on
  the sheet until CheckIfDoneLeveling writes them home (DaggerfallCharacterSheetWindow.cs:437-443), and the window
  carries the host's whole pause bag: its Save wrote the level with the points gone, its Pack, Spellbook or Chronicle
  took the slot and dropped them (LANE3-2 - the rows keep DFU's boxes then); no relock on the window's Save or Load, the
  sheet standing under it (LANE3-14); the sheet disposes what it pushed when a host drops it (LANE3-11); a chosen
  path's row (`{name}  (S)`) only while it is in force - asleep, the row is the guide's, whose chosen line says why
  (LANE3-12). The S row reads "Arcane paths  (S)" beside "Martial paths  (W)" (LANE5-12).
- **A departure, named** (LANE3-13): on the classic skin a level owed can be spent on the Growth tab's Level page
  when another landing (the professions, the family, the mail) reaches the tab before the sheet has opened - in the
  Ascension's dress, by the same law (`charSheetDoor.js` levelUpScreenFor - DFU's pool, `advancement.js`
  applyLevelUp); DFU spends it on the sheet alone.
- **The one ask's words** (`scenes/shared.js`, after a second mastery): on the enhanced skin, the No and the
  several-open box name the Growth tab ("You can choose a specialisation later on the Growth tab of the pause menu" -
  `pathDeclinedGrowthText`, `martialDeclinedGrowthText`, `pathsOpenRows(.., { growth })`); on the classic skin, the
  skill screen, whose rows open the same guide.
- **Every word through the text core**, drafted in-session into the thirteen whole languages
  (`tools/l10nInSession.mjs`).
- **TEXT (2026-10-17, the owner: "Comprehensive pass on explanations and text to ensure no AI like text, over
  explanations, or weird descriptions exist")** - every line the tab shows, read again and said plainly: the tab's own
  (its leads cut to what a player needs - "You have a level up waiting. Spend your points, then press Ascend."), the
  thirty paths' passives, signatures and riders the guide surfaces ("strike 20% harder", "boils again for as much",
  "lands nothing", "your casting hands move faster" became "deal 20% more damage", "takes the same damage again", "misses
  you", "you cast spells faster"), and the revenant sky's few odd lines ("A hard road brings back nothing" became "Brings
  nothing back from a mission it returns hurt from" - the errand's own word for that outcome). Precision kept where the law is narrow: a martial power
  that answers only a foe's blow (`pendingPlayerBlow` - no spell, fall or poison) says "enemy blows", one that pays
  only weapon hits says "blows and arrows" (AUDIT MARTIAL L1 N3's word), and a power on any hurt says "damage". The
  same words everywhere they stand (the classic sheet's rows and boxes read the same table). 112 English rows changed
  (some later withdrawn with the revenant page); the pins that held the old words moved with them, and the records aimed
  at them were re-aimed by content.
- **AUDIT GROWTH carried it to the faces** (LANE5-1): the Level page's Ascension and the Firmament window had been
  skipped - poetic and hard-coded English in every language ("Choose what rises", "Rides every swing", "Warms merchants,
  judges and anyone else weighing what you are worth", "That star is not in the heavens", "You lack the silver to
  unlearn those stars"). Both now say each line plainly through `t()` (`levelup.*`, `firmament.*`), checked against the
  code it describes (an attribute's formula; silver for removing stars, gold for the respec; the stars act in sieges,
  never adding damage against players). The buttons are translated, and the lines that name a button take the button's
  own word (`{ascend}`, `{accept}` - LANE5-2). The audit's other words: "No slots left" and "Not yet"; the chosen
  path's asleep lines; "leave again" / "close again" for the ambiguous "do that again"; "available" for "open"; the
  technique texts' weapon words in the form lines; "Arcane paths (S)"; the riders exact (Brawler, Bloodmage, Berserker,
  Lightbringer). 230 rows drafted into the thirteen whole languages. KEPT in English, as AUDIT UICALM-FIRM1 L5 M1 left
  them: the Firmament's tree (its star names and the signs' lore) and its law's words.

## 8. The four hosts

The tab is the pause window's, which every host opens through the same two doors (`pauseDoor.js`: Escape and Tab's
dial; `charSheetDoor.js`: the sheet key) - so `scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js` and
`scenes/dungeonContext.js` all reach it with no line of their own. `scenes/world.js` alone hands a captain's sky over
(the Holdings provider's `captain.stars`, `scenes/captainPageHost.js` - Come Sail Away on), so the Captain's Stars page
stands there - and in the interiors and dungeons entered from the world, whose window reads the same module-wide
provider (AUDIT GROWTH LANE3-13); `scenes/exterior.js` and the standalone `?dungeon` page hand none, and the rail
shows three pages. No host grew (HOST-SPLIT): world.js's line is one entry of the provider object it already built.

## 9. Pins and proof

- `test/ui/growth/growth1_tab.test.js` (26): the tab, its rail and landings, what waits; the guide's states, order and
  words, a signature read, Choose through the law; the stage (mounted once, moved, full screen, the phone's door, the
  tab's Escape) and the windows' `embed` modes by source; the classic rows and the ask's words; the pause window driven
  over the fake document (the Growth door's count, a family's landing, a path's detail, Choose, Master Skills' and the
  Captain page's doors); GROWTH5, leaving asks first (the face asked once, full screen left standing, the doors by
  source). AUDIT GROWTH's (`01-Overview/audits/Audit-Growth.md`): the guide's slots, states, lines, family and count;
  the riders; the fanfare once a level; the stage's edges; the classic sheet's edges; the tab driven with its real faces
  (the Firmament and the captain's sky on the stage, a star taken, every leave asked once; the Level page's owed rollout;
  the face gone with the window); the Yes/No card and the Master Skills line driven; the button's own word in French.
  Mutants: `tools/mutants/growth.json` (42) and `tools/mutants/audit_growth.json` (67), all dead.
- Pins moved to what stands: `rvnstars` (THE DOORS: the Firmament's door gone, the captain's window embedded), `ascendanytime` (the Level page; the door's rollout and its remembered pool), `orl1_leveling`,
  `levelNotice`, `f5quests`, `slots1`, `martial_paths`, `audit_martial`, `audit_schools`, `holdings`, `captlog`,
  `auditlegacy`, `auditlegacy3`, `legacy3_familytab`, `auditcards5_ui`, `moduleload_smoke` (the lab's own module).
- The browser half: `tools/growthProbe.mjs` over its lab (`growth.html`, `src/tools/growthLab.js`) - each page at a wide
  screen and a phone with no page error and no sideways scroll, the faces in the pane at the stage's size, the phone's
  doors, full screen and back, and the Escape held by unaccepted stars; since AUDIT GROWTH the Level page's door at
  1280x720 and the Ascension whole in the pane at 1920x1080 (33 of 33).

## 10. SPEC-RESET - a specialisation given up, for gold

The owner, 2026-10-18: *"Lets allow players to reset their ingame builds for a high cost."* Two questions were put,
and the owner chose:

- **What resets:** *the specialisations* - an arcane path and a martial path, each on its own. Of the rest of a build,
  the Firmament already had its respec (10,000 gold, `06-Systems/Firmament.md`), the captain's stars and a sworn
  revenant's are free to take back, and a mastery and an Ascend's points stay permanent (a save records no level's
  share of an attribute, so an Ascend has nothing honest to give back).
- **The price:** *200k* - `SPEC_RESET_GOLD`, 200,000 gold a family whatever the level, twenty times the Firmament's.

**DFU has none of it** - no specialisation to give up (`06-Systems/Arcane-Specialisations.md` section 9). Port-only.
Audited the same day: `01-Overview/audits/Audit-Spec-Reset.md` (AUDIT SPEC-RESET); what it changed is written below.

- **The law** (`systems/specReset.js`): `specResetRefusal` - no such family, no path held, or too little gold;
  `resetSpec` pays and clears the family's field (`arcanePath`, `martialPath`). **What pays** is what pays the
  Firmament's respec (AUDIT SPEC-RESET L1-1: 200,000 coins weigh 500 kg, so no purse carries them): the coins, else the
  letters of credit and then the coins (`court.js` deductGold - PlayerEntity.DeductGoldAmount's order), and online what
  is still owed off the Empire's account (`court.js` payUndoable; `realmGoldLaw.js` accountOfSave - EMPIRE-ACCOUNT, one
  account for every region; a loan is no gold). Offline an account is its region's and the pause window stands in
  none, so coins and letters pay (GetGoldAmount, what a shop or a trainer asks) and the refusal says so ("paid in coins
  or letters of credit"). The reset also marks the family's one ask made (`pathPrompted`, `martialPrompted` - L1-2: a
  path chosen on the guide had never set it, and the next quiet pass offered back the path just paid away) and folds
  the entity's mods at once (L1-3: a passive's stats outlived it until the next magic round; every Choose folds too -
  the guide's, the one ask's Yes, the classic sheet's). Nothing else moves: the other family, the masteries, and the
  spellbook - a signature spell whose path is not held is the plain bundle the spell maker could make (`arcanePaths.js`
  pathCastSchool), and the judge reads no signature spell. The price's home is `arcanePaths.js` (`SPEC_RESET_GOLD`),
  where both laws' choice boxes name it: `specReset.js` reaches `court.js`, which the account Worker that bundles
  `arcanePaths.js` must never import.
- **Online** the path is the save's alone - no service holds it, and the judge's `pathFindings` asks only that a path
  held has both schools mastered - so the purse, the account and the path move in one save, together, as a trainer's
  fee and its skill do; a lost write, a closed tab or a seat taken back reverts both (AUDIT SPEC-RESET L2 drove each).
  A reset path saves as `null` and loads as none - and stays none across an older build's carry: the career carries an
  **arcane mirror** (`career.arcaneMirror`, the path or none, written on every save, AUDIT SPEC-RESET L2-1), read for a
  save with no `arcanePath` key before the book is - the book's witness (AUDIT SCHOOLS L3 F2) had handed a reset path
  back with its 200,000 still spent, or swapped a newer choice for it, free. A mirror another character wrote (an
  heir's inherited career), or whose path its schools no longer back, is no mirror; the martial mirror is written only
  for a path held (`save.js`).
- **The guide's Reset** (`ui/growth/specGuide.js` resetModel): under the chosen path's detail, "Reset · 200,000 gold".
  It asks first in the window's Yes/No card - the price; what goes (the passive and the signature technique; for a
  spell, that a bought one stays in the book as an ordinary spell, or that an unbought one is no longer sold - L1-5);
  that the masteries stay; the paths open after the reset (the held one among them, its pair still mastered), and
  whether more are within reach - or, with Master Skills off, that it must be on to choose again. Short of the gold the
  press stands disabled and its line says why. **A reset that would buy back the same path is refused**: where no other
  path of the family is open or within reach (no other of its skills can still be mastered - not a career skill, or no
  slot left for it), the line says so (`afterReset` - the list's own states, read on a view of the entity with nothing
  held, never a write) - first, whatever the gold (AUDIT SPEC-RESET L3-1: the gold line hid it until the player held
  200,000). Yes resets and the note says so ("Warden is reset."); with Master Skills on the family's paths
  stand open again and the rail counts the choice waiting, the guide being where it is made. A closed path's line points
  to the Reset - and only a path a reset could open is Closed: one the class can never master, or whose slots are
  spent, says so whatever is held (L3-1). The note is a status line brought into view and focused (L3-2: the pane kept
  its scroll and the answer stood above it, a Choose's too); the refused press's reason is read with it (L3-5) and the
  Grimoire fades it (L3-6); its "·" never starts a line (L3-7). The window's Yes/No card is modal to the keys and the
  reader - named by its rows, the window under it inert, the focus on No and given back to its opener - and answered
  once, a held key's repeat answering nothing (L3-3, L3-4: Space walked the window under it, and Y paid a reset over
  the Quests tab).
- **The words** that said a choice could not be undone now name the price: the choice boxes (`schools.choice.reset`,
  `martial.choice.reset`), the several-open boxes - the price a row of its own there (L4-5: in the classic parchment
  box one sentence more wrapped a lone word onto a line in six languages) - and the guide's lead. Every word through
  the text core, drafted in-session into the thirteen whole languages.
- **The four hosts:** the guide is the pause window's, which `scenes/exterior.js`, `scenes/world.js`,
  `scenes/worldModes.js` and `scenes/dungeonContext.js` all open through the same doors (section 8) - none wired, none
  grew. The classic skin reaches it through the sheet's S and W rows (section 7).
- **Pins:** `test/ui/growth/specreset.test.js` (10): the price and the boxes' words; the law paid in coins, then in a
  letter and coins, the other family, the masteries and the book untouched; the refusals with nothing moved; the save;
  the guide's model (its ask, the paths open after, the only-path guard, Master Skills off); the press driven in the
  pause window; and the audit's four (the Empire's account, the one ask, the mods, an older build's carry), with L5's gaps closed in them (the martial half whole, the 'ready' arm, the refusals' order, the lead's price, a new visit's note) and L3's fixes driven (the card modal and answered once, the note's status and focus, the reason read, the Closed states). Mutants:
  `tools/mutants/specreset.json` (72: 71 dead, judged serially, and one equivalent as recorded - AUDIT SPEC-RESET L5-8). Pins moved to the new words: `growth1_tab`, `schools_arcane`,
  `martial_paths`, `audit_schools`.

## 11. SKILL-SWAP - a class skill changed, for gold

The Discord's #suggestions, 2026-10-19 (Brother Frank: *"I'd very much like it if the team considered adding the ability
(if it is possible) to either change one of our skills out or allow some of these specializations to work with just the
one weapon skill"*), through Mac; asked, Mac: *"Paid skill swap"*. Record: `01-Overview/bugs/Field-Bugs-2026-10-19b.md`.

- **The law** (`systems/skillSwap.js`): one class skill the character has not mastered out, one miscellaneous skill in,
  in the same group (the 2/2/1 slots stand); a mastered skill never leaves; the values stay; the career becomes the
  character's own copy, saved whole and marked `swapped`, so an heir keeps it (`legacy/family.js` careerFields, AUDIT
  SUGGESTIONS-1019 L5-4) and its household still wears the class. The level and the progress to the next stand, and a
  skill's training leaves with it (SWAP-CYCLE, `01-Overview/bugs/Field-Bugs-2026-10-20g.md`): the stored current sum is
  the sum the level stands on, which no swap and no raise lowers; a swap moves both sums only by what it takes the
  class's sum above it (a trained outsider brought in pays no level), and the ground a swap gives up is the class's
  skills' to make up before the next level comes any closer - so no cycle of swaps passes the class's own ceiling.
  `SKILL_SWAP_GOLD` 100,000, paid as section 10's reset is (coins, letters, online the Empire's account).
- **The page** (`ui/growth/specGuide.js` drawSkillSwap): under the Specialisations page's paths - *Change a class skill*,
  the two picks, *Swap · 100,000 gold*, asked first, refused (the press disabled, saying why) short of the gold. A
  family whose class can never meet a path says, under its headline, that a class skill can be changed below - only
  where one swap would open a path (`swapOpens`, AUDIT SUGGESTIONS-1019 L5-1). A swap into a group whose mastery slots
  are spent, and offline with Master Skills off one that starts or ends DFU's 95 lock, is said beside the picks and in
  the ask: a warning, not a refusal - a swap can be wanted for leveling alone (AUDIT L5-1, L5-2). So is a swap that leaves the class's skills under the sum the
  level stands on, with the points they make up first (SWAP-CYCLE; none on Oblivion's bar, where the sum levels
  nothing).
- Pins: `test/systems/fb1019b_skillswap.test.js`, the page drawn in `test/ui/growth/fb1019b_swappage.test.js`, the audit's
  laws in `test/systems/fb1019b_audit.test.js`, the level's law in `test/systems/swapcycle.test.js`;
  `tools/mutants/fb1019b_skillswap.json`, `fb1019b_audit.json`, `swapcycle.json`. Audit:
  `01-Overview/audits/Audit-Suggestions-1019.md`.

