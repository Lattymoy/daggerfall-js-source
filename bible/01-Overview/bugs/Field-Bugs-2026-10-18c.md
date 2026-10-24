# FIELD BUGS 2026-10-18c - the Weir Key's top option

> Renumbered at the merge of main: #1026's LETTERS-HOME took `Field-Bugs-2026-10-18b.md` first; the test and the
> mutant record were renamed with it (`fb1018c_`).

One report from Mac, read on the code as it stands at main's `138604baa`. The start window is the port's own (Elite
Gates, `11-Multiplayer/Elite-Gates.md` section 5, and EG9's record of the window); the list it is drawn in is the port's
ListPickerWindow (`ui/listPicker.js`, DFU's DaggerfallListPickerWindow), unchanged. AUDIT STAKE-ROW
(`01-Overview/audits/Audit-Stake-Row.md`) read it all cold; what it changed is marked here with its finding's id.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Mac: "The top option doesnt work when using the weird key", then "Weir key"; asked, "It can be tapped" | The start window's top row is the stake (*Weir Keys: 3 - one will be staked.*), words and not a choice. Picked, the port's list picker had already closed itself, and the window did nothing: no list on the screen, and the flow still asking, so a use of the key after it, or `/breach`, answered *The Spire already asks where you begin.* until the screen let go | fixed (STAKE-ROW) |

## STAKE-ROW: a word row picked asks the list again

`src/ui/eliteGates/egStartWindow.js` openEgStartWindow's pickMain.

THE REPORT. The key used, the start window opens on its list: the stake first (with no key, *You hold no Weir Key.*),
the quest warning under it when a quest falls due, then the starts, the Wager, the Rehearsal and the boards. The top
row is the one the list opens selected, so Enter (DFU's Return) or the port's `1` on the first press picks it; and it
can be tapped - the enhanced skin's row press replays the classic double click on the classic row
(`ui/enhanced/enhancedPicker.js` pickRow), which picks it the same way.

FOUND. `pickMain` returned on any row that is not a start, the Wager, the Rehearsal or the boards - the stake, the
keyless line and the quest warning are words. But the picker it answered had already raised `done` on the pick
(`listPicker.js:"_pick(index) {"`, before `onPick`), and the host drains a done window after its input (the street's
`scenes/townTalk.js`, after the occupant's input; the interior's and the dungeon's slots drain the same way). AUDIT
STAKE-ROW (L1-3, L3-1): that self-close is the port's, not DFU's - DaggerfallListPickerWindow only raises OnItemPicked
and its owner closes it (DaggerfallPotionMakerWindow's RecipePicker_OnItemPicked, `recipePicker.CloseWindow()`); under
DFU a bare return would have left the list up. The start window still held that dead picker as its handle and was not
done, so `egClient.js` kept its `startWin`: the key's next use (past its other answers - the way back, a call standing
for me, a refusal) answered `EG_START_ASKING_TEXT` with nothing on the screen, and only the screen letting go (`away`)
cleared it. The EG-F pin passed over it because its fake list stayed open when picked - DFU's shape, which the port's
picker does not have.

CHANGED: a word row picked closes what is left of the list and asks the main list again
(`egStartWindow.js:"if (r.kind !== 'start') { shut(); showMain(); return; }"`) - the same close-then-ask the Wager's
toggles already make. Nothing is chosen or cancelled; Escape is still the cancel. The rows, their order and the picker
are unchanged. AUDIT STAKE-ROW (L1-3, L3-2): DFU's ListBox can disable a row (`ListItem.Enabled` - a click will not
select it, the arrows step over it, UseSelectedItem refuses it), its own way to show a row that is not a choice; the
port's picker keeps every row Enabled, so the word rows stay pickable and are answered by asking again. Porting the
disabled row is `Port-Ledger.md` section C's.

AUDIT STAKE-ROW added three siblings in the same flow (`Audit-Stake-Row.md` L1-1, L1-2, L1-U1):
- *Go without Mara?* answered No brought no list back: its box still holds the slot while its arm runs
  (`ui/yesNoBox.js` answer), so the list's mount was refused and the window cancelled, unsaid. The list's doors are the
  window's own now (`egStartWindow.js` egStartListDoors, world.js wiring them over `egWindowSlot`): a finished window
  in the slot is given up before the list mounts, as the boards' door gives it up (`egBoardWindow.js` createEgBoardDoor).
- The key used from the pack opened nothing: its use answered an empty line, the pack stayed up and held the slot,
  and the list was refused when the preflight landed. An empty line is the opener's "the window will ask", and the use
  now closes the pack (`systems/eliteGates/weirKey.js`, `closesWindow`).
- A list put off the screen unpicked (another window shown in its slot - townTalk disposes the outgoing occupant and
  tells it nothing) left the window asking. The doors cancel it once, as the question's box does (egStartAsk's
  `onGone`). No trigger was found while the window holds the pause; it is a guard.

THE FOUR HOSTS (AUDIT STAKE-ROW L3-3): world.js - WIRED, `egStartWindow` over `egWindowSlot` and egStartListDoors (the
doors moved out of the host: it shrank). worldModes.js - the doors' slot, unchanged: `mountSpellWindow` and
`closeSpellWindow`, whose street arm is townTalk's slot (the pin runs both from the source); its interior arm and
dungeonContext.js's slot never take the window, because the key refuses off the street (*The key wants open sky.* -
`scenes/eliteGates/egArch.js` egKeyRefusal's `exterior`, asked again when the preflight lands). exterior.js - no opener
is registered there (the ?exterior bench), so the key answers *The key is cold here.*

Pinned by `test/ui/eliteGates/fb1018c_stakerow.test.js` (5), over the real townTalk, worldModes.js's doors and world.js's
slot and doors read out of the source and run, the real ListPickerWindow and YesNoBoxWindow: the stake picked by a tap
(pickRow itself, on a list undrawn and one drawn in FONT0003 - its first press selects, its second uses), by Enter on
the first selection, by `1` and by Up then Enter leaves a new list in the slot, the window asking, nothing chosen, and
Hall 1 after it is the choice; the keyless line and the quest warning the same, Escape after it the cancel, told once
however late a door calls it; No to the question brings the list back and Yes chooses; a list put off the screen
cancels once, a refused mount and no list to ask with cancel on the next tick; and the key's use closes the pack when
its window will ask, in the enhanced pack too. `tools/mutants/fb1018c_stakerow.json` (13, all dead): each fix's mutant
restores the code it replaced.

PINS MOVED: `test/net/eliteGates/egarch_client.test.js` EG-F THE START WINDOW - the stake picked closes the old list and
opens a new one, so its log reads two closes before the cancel; and EG-F THE HOSTS BY SOURCE - world.js's list door is
the egStartListDoors line. `test/ui/eliteGates/egz_ends_board.test.js` EG-ZM - the boards' slot is `egWindowSlot`.

What the reporter is owed: the top row of the Weir Key's window is the count of your keys, not a choice. Picking or
tapping it now keeps the window up with its list, instead of closing it and leaving the key saying the Spire already
asks. And from the audit: answering No to "Go without ...?" brings the list back, and using the key from your pack
closes the pack so the window can open.
