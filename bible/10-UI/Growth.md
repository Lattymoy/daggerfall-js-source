# Growth

The pause window's **Growth** tab gathers how a character grows: the Level page (the Ascension), a guide to every
specialization path, the Firmament, and the captain's stars. It also holds the paid specialization reset and the paid
class-skill swap and trade. The Stats page's Growth door, Master Skills, the Captain page and the classic sheet's
specialization rows all lead into the tab.

## How it works

**The tab** (`src/ui/growth/growthTab.js` `drawGrowthTab`). Pause tabs: Quests, Stats, Growth, Holdings, Family,
Tutorials, System (`src/ui/enhanced/enhancedMenu.js` `PAUSE_TABS`). A rail of pages on the left, the page on the right,
in a window of fixed size (`px-win-growth`) so pressing the rail never resizes it. Pages
(`src/ui/growth/growthPages.js` `GROWTH_PAGE_SECTIONS`):

- **Level** - the Ascension. A level owed is spent through the sheet door's own rollout
  (`src/ui/charSheetDoor.js` `levelUpScreenFor`); otherwise a view of the stars. The bonus pool is drawn once a level
  and remembered, so leaving mid-spend re-rolls nothing. F5 and the level notice still open the rollout directly.
- **Specializations** - the guide (`src/ui/growth/specGuide.js`), below.
- **Firmament** - the sky, online; offline, what it is and why it waits.
- **Captain's Stars** - only where the host hands a captain's sky over (`growthSections`); `src/scenes/world.js` does,
  through `src/scenes/captainPageHost.js`.

The rail marks what waits (`growthDue`): a level owed, a specialization choice per family, unspent captain's points.
The Stats page's **Growth** door carries the sum. Landings: `growth`, a page id, or `specs:arcane` / `specs:martial`.

**The guide.** Both families, every path, read off the laws (`specGuideModel`). A path's state on this character
(`SPEC_STATES`): Chosen, Available, Needs mastering, Within reach, Closed (the family's other path is held), No slots
left, Not for your class, nearest first within a state. A path's detail gives what opens it (each skill's standing in
words), its passive, its signature spell or technique read from the law, and how it is used. **Choose** asks in the
law's own box and commits through `choosePath` / `chooseMartialPath`.

**The stage** (`src/ui/growth/growthStage.js`). A sky or the Ascension is mounted once a visit into its own host
element, and each redraw of the pause window moves that host into the new pane (`drawStage`). **Full screen** moves it
over everything and back. The Level face draws in the pane only on a Plus window at least `LEVEL_PANE_MIN_H` tall;
elsewhere, and on phones, the face opens full screen. The windows' `embed` mode registers no overlay, owns no Escape,
and hears no key while detached or under another window.

**Leaving asks first.** Another rail page, another tab, the sheet key, a click outside and Escape each ask the face
first (`stageAsks`): unaccepted stars are named once, and a second leave discards them.

**Classic skin.** The character sheet's S (arcane) and W (martial) rows stand whenever the class can meet a path and
open the guide on their family. No Growth window opens while the classic level rollout stands. The classic level-up and
pause window are DFU's.

**Specialization reset** (`src/systems/specReset.js`). A held path is given up for `SPEC_RESET_GOLD` (200,000 gold a
family, in `src/systems/arcanePaths.js`). It pays as the Firmament's respec does: coins, then letters of credit, and
online the Empire's account. It clears the family's path and marks its one ask made; masteries and the other family
stay, and a signature spell stays in the book as an ordinary spell. The guide's **Reset** asks first and is refused
where it would only buy back the same path (`afterReset`). Online the path is the save's alone, so purse and path move
in one save; `career.arcaneMirror` keeps a reset path from coming back through an older build's carry.

**Skill swap and trade** (`src/systems/skillSwap.js`, `SKILL_SWAP_GOLD` 100,000). A swap trades an unmastered class
skill for a miscellaneous skill in the same group; a trade (`swapTradeChoices`) exchanges two unmastered class skills
of different groups. Values stay, a mastered skill never leaves, and the career becomes the character's own copy, kept
by an heir. A swap never moves the level: the level's skill sum must be made up by class skills before the next level
comes closer. The page (`drawSkillSwap`) sits under the paths and warns, not refuses, when a swap spends a group's last
mastery slot.

## Rules

- Specializations get their own UI with proper descriptions; the Firmament, level-up page and specializations share
  one tab in the pause menu, named Growth (the owner).
- The skies are drawn in the tab, the old doors move into it, and the classic sheet's specialization rows open the
  same guide (the owner).
- The revenant sky stays on the Companions page (the owner).
- The Growth window keeps one size whatever page is open (Dudey).
- A build can be reset for a high cost: the specializations only, 200,000 gold a family (the owner). Masteries and an
  Ascend's points stay permanent.
- A paid class-skill swap at 100,000 gold (Mac); a trade between two class skills at the same price (Mac).

## Daggerfall Unity

DFU's pause window (`DaggerfallPauseOptionsWindow`) has no tabs, and its level-up is a rollout on the character sheet
(`DaggerfallCharacterSheetWindow`, which will not close with points unspent). DFU has no specializations, Firmament,
captain or swaps. The level's points are still DFU's law (`applyLevelUp`, the bonus pool's draw). Departures: the tab
itself; the level spent in a pane of the pause window; on the classic skin, a level can be spent on the Level page when
another landing reaches the tab before the sheet opens.

## Code and tests

- `src/ui/growth/growthTab.js` - the tab, rail, landings and marks
- `src/ui/growth/specGuide.js` - the guide, reset and swap pages
- `src/ui/growth/growthStage.js` - mounting, moving and full screen
- `src/systems/specReset.js`, `src/systems/skillSwap.js` - the paid laws
- `test/ui/growth/growth1_tab.test.js` - the tab, guide, stage, classic rows and leave asks
- `test/ui/growth/specreset.test.js` - the reset law, save and page
- `test/systems/fb1019b_skillswap.test.js`, `test/systems/swapcycle.test.js`, `test/systems/skilltrade.test.js` - swap
  and trade laws
- `test/ui/growth/fb1019b_swappage.test.js`, `test/ui/growth/skilltrade_page.test.js` - the swap page
- `tools/growthProbe.mjs` - each page in Chromium at desktop and phone
