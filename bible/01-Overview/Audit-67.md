# AUDIT 67 - THE DUNGEON AUTOMAP, READ WHOLE AGAINST Automap.cs AND ITS WINDOW, 2026-09-21

Mac: "I want you to audit the dungeon automap for me, ensure it's bug
free and working properly."

**CLOSED (2026-09-21), one round.** Four read-only Opus lanes over the
five modules and their hosts - the discovery law against `Automap.cs`,
the window against `DaggerfallAutomapWindow.cs`, the host and render
plumbing, and the nine pin files read as an adversary with a forty-mutant
probe and an end-to-end scenario. **Thirty-one findings, twenty-seven
paid**, each paid one pinned (`test/audit_amap.test.js`, and the pins
appended to the chrome and notes files); four recorded as residue below.
The scenario lane's verdict on the code before any fix - "nothing threw,
no NaN, nothing visibly wrong" over a synthetic dungeon, a closed door, a
note, a portal and a save round trip - stands, and is the reason the list
below is mostly LAWS rather than crashes: the automap works; it was not
yet DFU's.

## The two that a player would hit first

**F1 - the scan refused every oblique wall (`systems/automap.js`,
Automap.cs:1121-1123).** DFU casts three parallel rays and, for EACH,
compares its hit on the true level geometry with its hit on the automap
copy; the two disagree only when something the copy lacks (an action
door) stands nearer. c2/S1 read those three per-ray comparisons as one
INTER-RAY comparison and demanded the three distances agree within
0.01. The protection offsets are perpendicular to the ray, so on any
surface off-square to it the rays land `0.1 * tan(angle)` apart - past
0.01 beyond ~6 degrees. Every wall looked at obliquely, every ramp, and
- because the view scan then answered null - the whole floor march
revealed nothing; the map filled in patchily and slowly. The port has one
collider and no copy, so the door-bucket rejection IS the true-vs-copy
test; the inter-ray loop is gone, the header says why, and AUDIT 58's
"exactly 0.01 reveals nothing" pin - which enshrined the misreading - is
re-pinned to the law.

**W1 - the right drag spun the map (`ui/automapCamera.js`,
DaggerfallAutomapWindow.cs:909-913).** The three rotate verbs the drag
hands its bias to all multiply by `Time.unscaledDeltaTime`; `dragRotate`
passed a literal 1, so a ten-pixel drag at 60 fps turned the camera 200
degrees instead of 0.8. The exterior window had it right. The camera pin
that enshrined the 1 now names its dt.

## The rest, by lane

**Discovery (`systems/automap.js`, `systems/automapModel.js`, the hosts).**
F3: a SPECIAL door (`DaggerfallActionDoorSpecial`) was treated as an
action door and blocked the scan; RDBLayout filters the copy by
description (:751-765), so it reveals like any wall. F4/H1-H3: the LOAD
arm re-fetched the record but never re-bound it - the layout guard was
skipped, the console verbs wrote into a discarded object, and the reset
signal was not raised; the bind and the signal follow the fetch now
(:2490-2496, :2548). F5: the N=0 forget on save fired inside a BUILDING,
where DFU's `IsPlayerInside` is true - a save taken in a shop lost every
dungeon map. F6: `partition` tested the grayscale keyword before the
renderer flag, so a key HideAll left visited-but-hidden drew in colour.
F7: the snapshot wrote visited keys that were not revealed. F8/F9: the
entrance line of sight ended 0.5 short of the EYE; DFU's ends at the
player capsule (:1216, :1219-1268) - the capsule centre and
`CAPSULE_RADIUS` now, with a crouch's own numbers from the motor. F11:
the exit did not stamp the record with the exit time (:2155). F12: the
5 Hz clock zeroed instead of subtracting and ran slow. H7: a MOVED action
model resolved to whichever at-rest box held the hit; DFU's true-vs-copy
test fails there, and so does the scan now. T1: a block whose every
placement failed to load left a HOLE in the layout's block-name list,
the save wire wrote it as null, and the guard then refused the dungeon's
own layout on every load - wiping reveals, notes and teleporters for
ever; the list is dense now and a hole and a null compare equal.

**The window (`ui/automapWindow.js`, `ui/automapChrome.js`).** W2: the
micro-map's 28x28 rect swallowed every drag and double-click under it;
BaseScreenComponent tests rects without occlusion and the overlay panel
has no handler. W3: the panel mouse "stuck" outside the map, so hover
text and the teleporter connection stayed up on the button row; DFU
resets `ScaledMousePosition` at the top of every Update (:575). W4: the
held-hotkey and held-button polls ran under the note prompt, so typing a
bound letter panned the map; the prompt is the top window and DFU
updates only the top. W5: the drag that starts a portal jump kept its
press point through the tween and lurched when it ended (:689-690). W6:
a two-pixel double-click slop DFU does not have. W7: the tooltip clock
did not restart on movement (:602-605) or a wheel notch (:735). W8: the
panel wheel refused to zoom during a drag (only the grid button's does).
W9: the panel press ignored `alreadyIn*`. W11: the note prompt's
`WidthOverride = 306` was claimed and not carried; the layout takes it
as the whole width and rounds to 308 (DaggerfallInputMessageBox.cs
:243-252).

**Host and render (`scenes/dungeonContext.js`, `render/renderer.js`,
`scenes/interior.js`).** H4: the Ctrl+Shift debug teleport from the open
map warped the player but not the marker's inputs, which only
non-overlay frames write. H5: the panel bracket restored lighting
through `setLighting`, whose fourth argument defaults to null and
forwards to `setAmbientTrilight` - the dungeon's BA1 sky/ground pair was
dropped on every pass, latent only because both hosts re-set it each
frame. H6: a raised elevator drew at its LIVE matrix while the index and
the picker hold it at rest. H8: the `?interior` probe host never
released the pointer lock under a window. H9: the death presenter
disposed the window without its OnPop, and the stack's RemoveWindow
could not run a private one. H12: three micro-map settings had no
defaults row.

**Pins (the fourth lane).** Ten of forty mutants survived on the code as
it stood; each has a pin now: the tie-break (T4), the march boundary and
the pitched camera (T5, T6), the wheel over the panel (T2), the
inter-ray boundary (now F1's), the tween anchor and the drag's dt. A
stale `window :1297` cite in three files is `:1292`. The dead
`bucketFilter` parameter and three unreferenced exports are gone.

## Residue, recorded and not paid

- H10: `toggleAutomap` writes the overlay slot by hand instead of
  pushing through the window stack; the reconcile raises the pause
  latch a frame later. Behaviourally invisible; a stack pass, not this
  audit's.
- H11: `render/contract.js` names none of the panel-pass methods, so the
  headless tests fake an unchecked shape. A typing pass.
- T3: `_tryTeleporterPortals`' stated law (a portal with no dictionary
  entry swallows the click) is unpinned. Low value; the law is a comment.
- W10: `input()` returns after the first matching down-hotkey where DFU
  falls through a flat chain; reachable only when two sequences collapse
  onto one code.

## Verification

Lint, types and build green. The automap set (`automap`, the nine
`roadc_automap_*`, `audit58_pins2`, `roadc_panelframe`, the input-box
suites) at 220 pass, 0 fail; the full suite green. Mutation campaign:
seventeen mutants over the fixes, seventeen killed (two survived the
first pass - the drag's dt and the tween anchor - and are the last two
pins).
