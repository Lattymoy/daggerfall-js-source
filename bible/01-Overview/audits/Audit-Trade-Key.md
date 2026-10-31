# AUDIT TRADE-KEY - SKILL-TRADE and PVP-KEY read cold, 2026-10-30

The user, of SKILL-TRADE (`10-UI/Growth.md` section 12) and PVP-KEY (`11-Multiplayer/PvP-Rework.md`), the day they were
written: *"Audit this"*. Three cold lanes read commit `0f4f06e4b` in a frozen worktree. Each was given the feature, the
player's ask and the files, never a conclusion, and had to prove every finding with a script over the real modules or
Chromium. The fixes went into the branch while the lanes read the snapshot.

| Lane | Read | Found |
|---|---|---|
| A | the trade's law and page: the level sums both ways, the slots, the 95 lock, heirs, saves, the hint | A1-A3 |
| B | the PvP key in a running page: windows, combos, the mouse, the Overworld, saved files, the pad | B1-B7 |
| C | the words in thirteen languages with real fillers, every claim of the record, the pins under new mutants | C1-C14 |

**A mutation run is a writer too.** Lane C ran `tools/mutate.mjs` in the snapshot, as its brief allowed. It copies a
file aside, mutates it and puts it back, so Lane B once read a mutant of `pvpFlagHost.js`. Lane B saw it and worked
from a clean `git archive`. Home.md's DO NOT FIX WHILE THE VERIFIER IS READING covers this case: a lane that mutates
gets its own worktree.

## Fixed - the trade

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | MED | With Master Skills off, a trade out of the primaries named the wrong skill in the 95 lock's warning and its ask. | The words name the skill entering the primaries and the one leaving (`specGuide.js:"const fromPrimary = other === 'primary',"`). |
| A2 | MED | Online, a swap or trade that raised the class's sum paid levels: both sums moved by the rise, and the online level reads the start (LEVEL-45). SKILL-SWAP's since LEVEL-45; the trade made it 100,000 gold, not 300,000. | Online the start moves so the climb's share stands, the level and its bar with it (`skillSwap.js:"export function startAfterRise"`). A float could tip a level's exact edge (58 of 589,155 sums); the edge is walked back. |
| A3 | LOW | After a trade both picks stayed, the reverse trade one Yes away. | A swap done resets both picks. |
| C3 | MED | The lead's "that you have not mastered" attached to the group in English and seven languages. | "You can also take an unmastered class skill from another group." in all thirteen. |
| C4 | MED | Indonesian said *grup* (a party) for a skill group. | *kelompok*, as the swap's lead says. |
| C10 | LOW | The pick's group label borrowed the level-up screen's words: German *Haupt* and Norwegian *Hoved* read as "head". | Its own three words (`growth.swap.label.*`). |
| C12 | LOW | Four wordings: pt-BR, ro, da, nb. | Rewritten. |
| C8, C9 | LOW | The Primary label and the refusals' order were unpinned. | Pinned. |
| C14 | LOW | The thread was quoted with a corrected spelling; three mutants a pin's title named had no record; a tag chain grew. | Quoted as written; recorded; the tag dropped. |

## Fixed - the PvP key

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | HIGH | Bound to a letter, the flag toggled under any window: the game's text box (the map's Find, a note, an amount, a rename) typed a flag with every V. | The key and the mouse answer the world alone: no pausing window, no enhanced overlay, no window's control in focus (`pvpFlagHost.js:"const inGame = (el)"`). |
| B2, C1 | MED | A combo bound to the flag never answered, and its bare key answered under another action's combo. | The listener door, `eventActions` (`input.js:"export function eventActions(e) {"`). |
| B3 | MED | A bound mouse button answered on any press: a window's button, the chat, and the PvP button twice. | The game's canvas alone. |
| B5 | MED | PVP-FLAG's button kept the focus, and the next Space pressed it again (FB1020h HUD-FOCUS). | `neverTheFocus`. |
| B6, C5 | LOW | Moved off Caps Lock, an unbound Caps Lock still marked the light the game's, and chat lowered the player's capitals. | The game's only where its press did something. |
| B7 | LOW | A saved file whose Caps Lock was spent lost the flag's key without a word. | Bindings version 4: the player is told, once (`inputActions.js:"const ADDED_AT = Object.freeze({ ModeWheel: 3, PvpFlag: 4 });"`). |
| C2, C6, C7 | LOW | The shipped defaults, the up title and the zone guards were unpinned. | Pinned; the zone with a flag carried out. |

## Recorded, not changed

| ID | Sev | Finding | Why it stands |
|---|---|---|---|
| B4 | LOW | A mouse-bound flag does not answer over the Overworld. | The view owns the canvas's mouse there, as it owns the swing (`travelView.js:"function onMouse(e) {"`); the key and the button answer. |
| C11 | LOW | The title says CAPS in every language. | The Controls pane's own key names; naming keys per language is the pane's change, not this button's. |
| C13 | LOW | The Controls row's words are read at load, so a language switch reaches them at the next load. | As the Decorate and Professions rows. |
| C5 | LOW | `wild/pvpFlag.js`'s header still says the flag goes up on Caps Lock. | The relay's bundle hashes that file (`test/net/relayversion.test.js`): a comment there is a relay version. `capsFix.js` and `chatPanel.js` say it now. |
| A2 | - | Online characters a rising swap already raised keep their level. | No level comes down outside `onlineLevelConvert`'s join. |

Pins: `test/systems/skilltrade.test.js`, `test/ui/growth/skilltrade_page.test.js`, `test/net/pvpkey.test.js`; moved:
`fb1019b_skillswap`, `swapcycle`, `pvpflag`, `modewheel`. Mutants: `tools/mutants/skilltrade.json` (19 dead),
`tools/mutants/pvpkey.json` (18 dead, one equivalent as recorded).
