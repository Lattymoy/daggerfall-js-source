# AUDIT STAKE-ROW (2026-10-18) - the Weir Key's top option, read cold

Mac, of pull request #1020 (`01-Overview/bugs/Field-Bugs-2026-10-18c.md` at 1e61b81b8): **"Audit this"**. This page is
the audit: STAKE-ROW's fix, its pins, its mutants and its record. Each finding has its verdict here. What it changed is
written into the pages it touched, marked `AUDIT STAKE-ROW` with the finding's id, and in the code beside the fix.

## How it was run

Three lanes, each a cold adversarial reader of a FROZEN head (1e61b81b8; Home.md's DO NOT FIX WHILE THE VERIFIER IS
READING - nothing was edited until all three had reported; the mutation lane had a detached worktree of its own), told
to reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| L1 | the law: the fix on every slot and every input, the re-entrant close-then-ask inside the picker's own dispatch, the enhanced tap end to end, where the window can open, every other path of the same flow | 5 findings and one unproven; the real townTalk, ListPickerWindow, YesNoBoxWindow, the boards' door, the enhanced picker over a minimal DOM and the real breach client, behind verbatim copies of world.js's doors and worldModes.js's |
| L2 | the pins and the mutants | 10 findings; the real townTalk and pickRow beside the pin's fakes, the 3 recorded mutants and about 40 of its own, every Elite Gates and list-picker suite |
| L3 | the record: every sentence of the bug page, Active-Arcs, Elite-Gates.md, Testing.md, the comments, the commits and the pull request, against the code and against DFU's own source | 13 findings; DFU's DaggerfallListPickerWindow.cs, ListBox.cs and DaggerfallPotionMakerWindow.cs read, every cite and gate run |

Every finding was checked against the code before anything was fixed. L1-1 was reproduced over the real townTalk and
YesNoBoxWindow (after No: the slot empty, the mount refused, the window cancelled, nothing said); L1-2 with the pack in
townTalk's slot (`world.js` mounts the exterior's pack there) - the preflight landed on a refused mount; L2-1 by the
point pickRow presses on a list drawn in FONT0003 (row 0's +4, the pin's hand-placed +3) and two surviving pickRow
mutants; L3-1 and L3-2 by DFU's source.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | *Go without Mara?* answered No ends the whole window silently: `YesNoBoxWindow.answer` runs its arm while the box still holds the slot, so the list's mount is refused (worldModes.js mountSpellWindow, on townTalk's pause latch) and world.js's door cancels. Older than STAKE-ROW; the EG-F and EG III pins' fake doors never refuse | FIXED: the list's doors moved out of world.js into `egStartWindow.js` egStartListDoors, which gives a finished window in the slot up before it mounts - the boards' door's own rule (`egBoardWindow.js` createEgBoardDoor). Pinned with the real box |
| L1-2 | The key used from the pack opens nothing and says nothing: its use answers '' (the opener's "the window will ask"), the pack stays up, and the preflight lands on a refused mount. Older than STAKE-ROW | FIXED: the use answers `closesWindow` on the empty line (`systems/eliteGates/weirKey.js`); both packs already close on it. Pinned through `useItem` and the enhanced pack's `useResultAction` |
| L1-3 | The comment and the page said DFU's picker closes itself and has no row that cannot be picked | FIXED with L3-1 and L3-2 |
| L1-4 | The list asked again opens on its first row, so the quest warning picked moves the selection back to the stake | RECORDED: every re-ask in the window opens its list at the top (the Wager's Done, the question's No); keeping the row would carry a selection through the doors for a row of words |
| L1-5 | A classic triple click on the stake arms the new list's double click for 300 ms | NO CHANGE: DFU's list left open does the same, and the enhanced tap never arms it |
| L1-U1 | A list put off the screen unpicked (townTalk's showOverlay disposes the outgoing occupant and tells it nothing) leaves the window and the key asking; no trigger found while the window holds the pause | FIXED as a guard: egStartListDoors' list cancels the window once when it leaves unpicked, as the question's box does (egStartAsk's `onGone`) |
| L2-1 | The pin's tap was a hand-placed click at +3, "pickRow's point" only for an undrawn list (FONT0003's rows put it at +4); pickRow itself was unpinned (a press a row low, a single press, both survived every test) | FIXED: the pin drives pickRow itself, on a list undrawn and on one drawn in FONT0003 |
| L2-2 | The tap could not tell a double click from a single press that picks | FIXED: the first press must only select |
| L2-3 | The fake doors and the source regexes missed world.js's refused-mount and no-list arms (both survived, and an uncancellable list stayed green) | FIXED: the doors are egStartListDoors, read out of world.js and run; both arms pinned |
| L2-4 | Mutant 2 died only because the fake slot refused a held mount; with the host's refusal off it survived | FIXED: the pin runs worldModes.js's mountSpellWindow and closeSpellWindow from the source over the real townTalk, so its death rests on the host's own law |
| L2-5 | Test 2's "told once" could not fail (the cancel's guard deletable) | FIXED: the old list's cancel is called late, and the door's leave is counted at the door |
| L2-6 | The source regexes broke on harmless edits (a comment in `_pick`, the doors reordered, a backdrop) and the `_pick` regex was already pinned by behaviour | FIXED: the regexes are gone; the source is read only to run it |
| L2-7 | "the slot emptied by the choice" was the fake's drain, not the choice's shut | FIXED: "the slot empty" |
| L2-8 | The recorded mutants named only the new pin; the moved EG-F pin kills all three | FIXED: both named |
| L2-9 | The test's header misquoted Mac ("Weir key" for "weird key") | FIXED |
| L2-10 | `egplay_client.test.js` "EG-PLAY THE NEXT CIRCLE, PLAYED" failed once in a full Elite Gates run (`reading 'seed'`) | RECORDED: unrelated to the start window; it passed 3 of 3 alone, and 714 of 714 here after the fixes |
| L3-1 | The record, the comment, the pins, a mutant, the commit and the pull request said DFU's picker closes itself; it is the port's (`listPicker.js` `_pick` raises `done` before `onPick`), DFU's owner closes it (DaggerfallPotionMakerWindow RecipePicker_OnItemPicked) | FIXED at every site this slice wrote. RECORDED: that self-close is an unnamed departure older than this slice, with no `Port-Ledger.md` section A row; naming it is Mac's call (Port-Doctrine, "Name the departure") |
| L3-2 | "DFU's picker has no row that cannot be picked" is false: ListBox has `ListItem.Enabled` (a click, the arrows and UseSelectedItem all pass a disabled row by) | FIXED: the record says so, and `Port-Ledger.md` section C's ListBox row names the disabled row as still unported (on its own line, so no line-number cite into the ledger moves) |
| L3-3 | THE FOUR HOSTS gave the wrong reason: worldModes.js carries the doors' slot, and indoors under ?world the key says *The key wants open sky.*, not *cold* | FIXED in the record |
| L3-4 | "The new pins are red on main" held for two of three | FIXED: each fix's mutant restores the code it replaced, and all 13 die |
| L3-5 | Mutant 2's `why` read as the law, not its breaking | FIXED |
| L3-6 | The test header said the refusal was townTalk's (it is worldModes' mountSpellWindow, on the pause latch) and the doors were world.js's (two arms were missing) | FIXED: both are run from the source |
| L3-7 | The keyless window's top row (*You hold no Weir Key.*) had the same fault and the same fix, unnamed and unpinned | FIXED: named and pinned |
| L3-8 | The test's header misquote | FIXED (L2-9) |
| L3-9 | "highlighted" for selected; `1` called DFU's | FIXED: selected; Enter is DFU's Return, `1` the port's |
| L3-10 | "every use of the key after it" - the key's other answers come first, and `/breach` said the same line | FIXED |
| L3-11 | The page pointed at Elite-Gates.md section 5; the sentences went into EG9's record of the window | FIXED |
| L3-12 | Two lines of the bug page past the page's width | FIXED |
| L3-13 | The pull request's footer is not the one sent | NO CHANGE: the posting service rewrites it |

## What it checked and found sound

- The fix itself, on the street's real slot: the shut empties the stack and drops the pause latch before the list is
  asked again, so the mount is never refused; the post-input drain leaves the new list alone; no pointer lock is asked;
  no close callback fires; Escape afterwards cancels and the key works again (L1). The enhanced tap: P1 picks on the
  second press, P2 is mounted, the trailing release reaches P2 as `release()` alone, P1's DOM goes and the next draw
  builds P2's (L1).
- The window opens on the street only: `openRefusal` asks `exterior` before the window and again when the preflight
  lands. The interior's slot shape holds; the dungeon's would leave the dead list suspended a tick, harmlessly, and is
  unreachable (L1).
- Every other path of the window: the Wager (in, toggle, Done, Escape), the boards' row and back, the outside click's
  cancel, the question's `onGone` (L1).
- Every write of `startWin`: once the window is up, only its choice, its cancel and `away` clear it (L3).
- The ledger: no section C row named the start window or the picker's close (L3).
- The counts, the cites and the gates: the Suite line, 2452 anchors resolving, the six bible gates, `tsc`, the 195
  files `test:changed` picks (L3); the Elite Gates and list-picker suites (L2).
