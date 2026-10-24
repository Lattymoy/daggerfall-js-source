# FIELD BUGS 2026-10-13b - two threads from the bug-reports channel

Two Discord threads from 2026-10-13, handed over as screenshots, read on the code as it stands at main's `00d4d202` (the
court) and `0cbe849f` (the bodies, after main's #842 was merged in); the owner's word on the second came in the session.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Pleading guilty not working" - "I'm stuck in a loop of being able to plead guilty or not guilty for a crime after I assassinated an NPC for a quest" (pepsiorcoke.) | the Crime tutorial page is pushed over the court's plea a beat after the court opens; the enhanced plea's buttons answered under it, its prison screen replaced the PAGE, and the answered plea stayed in the stack with live buttons - every press pleaded again | fixed (PLEA-LOOP) |
| 2 | "Morrowind assets Still missing" - "After update they seemed to work for a moment but now it stopped working again" (Odibatorasu "Spectre"); the owner: "Yeah people are saying with norrowind models, people are invisable. Something in a recent commit borked it" - online only | the body batch (MWNPC2) let one picture whose size was not a number blank every picture queued after it, the player's own included; the peer layer integrated its poses, so one non-finite read stayed until a restart | fixed (ONE-BAD-BODY); the first non-finite input not seen - the console names it |

## PLEA-LOOP: the plea under the Crime page answers nothing (1)

`src/ui/windowStack.js` windowCovered; `src/ui/enhanced/enhancedDialog.js` drawEnhancedChoice; `src/ui/enhanced/enhancedDialogStyle.js`
(`.dlg-covered`); `src/ui/talkWindow.js` ChoiceWindow.input; `src/scenes/arrestFlow.js` step, release.

THE CHARGE IS THE WATCH'S, as REP1 built it. The quest's killing was a crime, the region's standing fell past -10, and a
guard who saw the player stopped a known criminal: "come quietly" is a Criminal Conspiracy, charged once, and the court
(`scenes/standingHost.js`). The screenshot's numbers (160 gold and 33 days, fifteen penalty units) put the standing in
the -20s. None of that is the loop.

FOUND. startCourtFlow opens the courtroom and pushes the plea over it, and the courtroom's constructor is the Crime
page's first use (TUT1, `noteFirstUse('crime')`): a beat later (SHOW_DELAY_MS) the page is pushed OVER the plea. The
keys reach the page alone - a host hands a key to its top window, DFU's law (UserInterfaceManager's TopWindow). On the
enhanced skin the plea is the keyed menu's DOM dialog (DLG2), and its buttons called the window's own `input(code)`
directly, wherever the window stood; its scrim, over the whole screen at z-index 38, took every click the page's "click
or press any key" asked for (the notice stack is pointer-transparent: a click that dismisses a box is the canvas's), so
for a mouse the plea's buttons were the only thing on screen that answered. Guilty, pressed under the page, pleaded.
The prison screen that answer opens comes through showOverlay - DFU's CloseWindow-then-Push, a one-level replacement of
the TOP - and the top was the page: the page was replaced, not the plea. The answered plea stayed in the stack under the
prison screen, painted every frame (the stack paints what its top covers, ROAD close-P), so its dialog was built again a
frame later with live buttons; the page, replaced unread, came back over the prison screen and held its countdown - the
screenshot's "7 days until freedom." is that held count, the label the covered prison screen still paints. Every press
pleaded again: the term halved, the fine taken again, and once the term reached nothing the release ran - four hours,
the grace, the reposition - as often as it was pressed, because a box answered twice and a step of a released trial
still acted. Reproduced through the real town host's stack, the real arrest flow and court, the real tutorial line and
page and the real keyed menu's DOM (a fake document): a covered Guilty took 160 gold to 80 and opened a 12-day term,
the next press 40 and 6, five more 2 gold and three releases.

FIXED, at each layer, each pinned against the others broken:

- THE STACK SAYS WHO IS COVERED. TopWindow is the only window that receives input. Every door in and out of a stack
  (push, pop, a replacement, keepOnly, the drain) records which stack holds a window, and `windowCovered(win)` answers:
  held, under another window. A window no stack holds (the boot menu's, chargen's) is nobody's to cover.
- A COVERED KEYED MENU TAKES NO POINTER AND ANSWERS NOTHING. Painted as the stack paints it, it wears `.dlg-covered`
  (`pointer-events: none`, which every node of the dialog inherits): a press falls through to the canvas, where the
  host hands it to the window on top - the page is put away by a click, as DFU's top window takes one, and G or N
  pressed under it does the same. The button asks the stack again at the press, so a frame's lag answers nothing.
- A BOX IS ANSWERED ONCE. `ChoiceWindow.input` returns on a done box - the occupant's half of THE SLOT IS EMPTIED BEFORE
  THE OCCUPANT IS TOLD (`Home.md`): a close dispatches once, however many doors call it.
- A RELEASED TRIAL IS OVER. ReleaseFromPrison is the court's last act (its CancelWindow, DaggerfallCourtWindow.cs:490);
  the trial's token stood on past it, so a step armed for a released trial still acted. `release()` marks the trial
  released and every step of it stands down. The token stays, so a load still takes the trial's last box down (AUDIT
  DISC28 AR-1's `abandon`).

The keys were never the hole: G under the page puts the page away and G again pleads once. A buttoned box
(`ui/messageBox.js`'s, DLG1) replays its press on the canvas, so its host already handed it to the top window; only
the keyed menu reached its window directly. `10-UI/Tutorials.md` carries the note.

`test/ui/fb1013b_plealoop.test.js` (4): the report's court through the real host, flow, page and dialog - covered, the plea
is painted, wears the class the composed sheet gives no pointer (and no `.dlg-` rule gives back), answers neither
button; the canvas click puts the page away and marks it read; uncovered, Guilty pleads once, the prison screen
replaces the plea, its buttons never come back, the term is served once and released once; the stack's answer through
every door; a keyed menu answered once by a key, a click and its rebuilt button; a released trial's two plea steps,
reached past the box, act on nothing.

NOT SEEN. Whether the reporter answered with the mouse - the loop needs it, and the screenshot's buttons say the
enhanced skin. Asked to try the court again after the update.

## ONE-BAD-BODY: one body's bad measure blanks no other (2)

`src/render/renderer.js` queueCharacterSprite; `src/net/peer/peerBodies.js` _place, _notFinite; `src/net/peer/peerPace.js`
stepPeerPace.

THE REPORT. The thread follows 12g's (report 8 there, BATCH-SHUT: "models are disappearing including myself ... when i
reload it shows my MW models for a second but then disappears"). After the update that carried BATCH-SHUT the bodies
"seemed to work for a moment" and went again; the owner: online only, and "something in a recent commit borked it".
BATCH-SHUT's frame-start shut means a batch can no longer stand open across frames, so what remained had to be something
lost again EVERY frame - and, for "including myself", something in the very batch the player's own body is queued in.

FOUND - THE AMPLIFIER. Since MWNPC2 (2026-10-09) every body's picture in a pass is queued into one batch and the flush
packs the tiles one after another (`packSpriteTiles`: `x += it.pw + gutter`). A picture is measured by drawRigSpriteBox
off its box as the eye sees it, and its clamp, `Math.max(2, Math.round(screenPxH / texel))`, is NaN for a NaN - so a
body standing at a place that was not a number queued a NaN-sized picture, and every picture queued after it was
placed at NaN. GL takes a NaN viewport origin as 0: each was drawn over the FIRST tile - in the street's and the
building's body pass that is the player's own body's, queued first - and every quad after it sampled its tile from
`uOrigin` NaN, which is nothing. One bad body blanked every Morrowind body after it, and the player's own picture with
them, on every frame it stood. Before MWNPC2 each body took its own pass, and a bad one broke only itself: the batch is
the recent change. Proven three ways: the sweep's script (the real Renderer over a recording GL, the real
drawRigSpriteBox: one NaN of five, the tiles after it at x NaN and their quads' `uOrigin` NaN); the suite's pin below;
and on a real GL - Chromium's, the 3D horse (the committed Courser, the same skinned pass every body takes) drawn three
abreast through the world frame's batch, flush and composite, the screen read back: the middle horse at a place that is
not a number, the third drew 0 texels where it drew 4,064.

FOUND - WHY IT STAYED. The peer layer INTEGRATES a peer's drawn pose: the yaw eased toward the pose's
(`b.yaw += wrapAngle(...) * k`) and the pace off the feet's travel (`stepPeerPace`: `speed * 0.8 + stride * 0.2`). Once
either read a non-finite number it kept it - NaN eased is NaN, and the pace's jump test (`d > JUMP_UNITS`) is false for
NaN, so the travel was read as a stride - for as long as the body stood, which is until the peer left or the client
restarted. Online only: the peers are the one population whose bodies stand on another machine's word, eased, glued
(a wagon's seat, a boat's deck, a card table's chair) and integrated here. The NPC lanes' actors are clamped finite
where they are offered (npcShown's `finite()`), and the player's own body is read off the player's own motor.

FIXED:

- THE DOOR. `queueCharacterSprite` - the batch's one door, every body of every lane through it - refuses a picture whose
  size is not a finite count of texels: it draws nothing (its own loss) and the console says so once
  (`[mw] a body's picture could not be measured ...`). No picture can move another's tile again.
- THE PEER HOLDS ITS LAST GOOD PLACE. `_place` takes a drawn pose's place only when all three of its numbers are
  finite, and its yaw only when that is (a body born on a bad yaw takes the first good one whole). A bad read changes
  nothing; the next good one moves the body on. Said once a lane, with the pose's own numbers
  (`[online] a body's drawn pose is not finite (place: x NaN ...)`).
- THE PACE STARTS OVER. `stepPeerPace` reads a travel that is not a number as a jump (`!(d <= JUMP_UNITS)`), and a pace
  that is not one starts again from 0.

NOT SEEN. Which input first went non-finite in the field. The wire bounds every pose (`net/wire.js` validPose), and a
read of the peer path found no line that mints one from finite input: the drawn pose's lerp, the play-out cursor (both
the untimed and SCALE2b's timed paths), the wagon seats' and the driver's glue (every seat has its yaw), the boat
deck's glue (its words validated), the climb's yaw, the horse's gait (it clamps its own speed and step), and the pace.
A real-GL probe of the same pipeline with finite inputs drew every body on every frame under the classic set, the
classic shadow lane and the enhanced lane. So the fix closes the spread (the door) and the stay (the integration), and
the console lines are there to name the source: a player who still loses the bodies is asked for the line that starts
`[online] a body's drawn pose is not finite` or `[mw] a body's picture could not be measured` (the desktop app: View,
Toggle Developer Tools, Console).

`test/net/peer/fb1013b_onebadbody.test.js` (3): one body of five whose picture cannot be measured is refused at the door, the
other four each in their own tile and quad, the first tile drawn once (the real Renderer over a recording GL and the
real drawRigSpriteBox; a width or a height alone not a number refused too); a peer whose drawn pose goes non-finite
keeps its body where it last stood and its yaw a number, moves on with the next good pose, says so once, and a body
born on a bad yaw takes the first good one (the real PeerBodies over a stub rig); the pace's jump and its start over.

## THE FOUR HOSTS

- PLEA-LOOP: one module is every host's stack (`ui/windowStack.js` - townTalk's for world.js and exterior.js,
  worldModes.js's interior stack, dungeonContext.js's; interior.js, the `?interior` bench, builds its own from it), and
  the keyed menu asks whichever holds its window. The court itself is the street hosts' (world.js, exterior.js).
- ONE-BAD-BODY: the door is the renderer's (every host's body passes queue through it - world.js and worldModes.js
  open the batch for the player's body and the peers', every host's NPC lanes and dungeonContext.js's foes for theirs;
  exterior.js keeps the lone pass, where a bad picture only ever broke itself). The peer layer is net/peer/peerBodies.js,
  which the street, the building and the dungeon draw the peers through, and every NPC lane builds on.

## Pins

`test/ui/fb1013b_plealoop.test.js` (4), `test/net/peer/fb1013b_onebadbody.test.js` (3). `tools/mutants/fieldbugs1013b.json`: 20, all
dead (PLEA-LOOP 12, ONE-BAD-BODY 8). Re-aimed by content, dead: `auditdisc28_arrest.json`'s
AR1-an-abandoned-trial-still-steps (the step's new guard), `climb5.json`'s CLIMB5-body-eases-to-the-camera (the yaw read
once as `want`) and `htwaist.json`'s HT-WAIST-BACK-the-pace-jump-read-as-a-sprint (the jump test without the pace's
start over). PIN MOVED: `test/net/climb5.test.js` C4's source read of the eased yaw. The real-GL proof is
`tools/oneBadBodyProbe.mjs` (horse3dProbe's page, Chromium): ALL GREEN on this tree, and on main before it (`00d4d202`)
the third horse read 0 texels - two failures.
