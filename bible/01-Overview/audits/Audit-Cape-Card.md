# AUDIT CAPE-CARD - CAPE-CARD and CAPE-FLAT read cold, 2026-10-30

The owner: *"Audit this"*, of PR #1455 at `8c61432b5` - the fixes of `../bugs/Field-Bugs-2026-10-30.md` (the Eternal
cape on a peer's front, and its curved cut), merged with main's AURA-ON-DRAGON. Four cold lanes read a frozen worktree
of that commit, each given the files and one brief (what to hunt, how to prove it), never a conclusion. Each finding
was proven on the real code - a probe, a test that fails at the commit, or quoted lines - and proven again here before
its fix. Fixes carry an `AUDIT CAPE-CARD <id>` comment; the pins are `test/render/auditcapecard.test.js`, the mutants
`tools/mutants/auditcapecard.json` (18, all dead).

Then the owner: *"Revert what I said about making it flat"*. The straight cut (CAPE-FLAT) is gone, and the findings
that were the cut's own went with it: B1, B2, the crouch, C1, C3, D2 and D3, each marked below. D1 turned on the cut's
depth and is undone (below). Reverting it showed A6.

| Lane | Read | Found |
|---|---|---|
| A | the facing law and its wiring: every layer a peer is drawn in, the eye, the order | 5, and A6 in the revert |
| B | the straight cut as geometry and GLSL, on retail's rig, the sprite figure and the rest pose | 3, gone with the cut |
| C | the pins, the mutants, the record and the pull request's words | 8 |
| D | rendered frames in Chromium: every look with a body mesh, before and after | 4 |

## The facing law (A)

**A1 (HIGH). In third person the Eye of the Beholder walkers and riders turned to the head, not the camera.** World.js
handed their layers `cam.pos` (`player.eyeAt()`), and the frame draws from `mwv.eye`, 2.7 m behind it. A peer beside me
showed the camera one view and hung a cape on another: 78 of 143 cape points lay over a party mate's front. The class
sprites turned to `player.pos` the same way. Every peer's picture now turns to the eye that draws it, WAGONS3's law
(`hcc.faceTeams`): the walkers and riders to the renderer's camera (`peerEye`), the class sprites to `view`. The classic
layer's `eye` stays the listener's, for the steps', swings' and hooves' sounds. Older than CAPE-CARD (SPRITE-FACE).

**A2 (MEDIUM). On a doll the swing was laid along the wrong frame.** auraMotionStep reads the swing along the way the
body turns; the shader lays it along the way the picture faces. A doll faces the eye whichever way its peer walks, so
the hem never trailed sideways. `auraSwingDrawn` turns the swing into the drawn frame at the upload, which also makes an
Eye of the Beholder sprite's trail exact where it was up to half a view off.

**A3 (MEDIUM). A sprite rider was no card,** so the Seraph Wings lay over the rider (678 wing points). The riders'
face says `card`, and my own sprite's does at the draw.

**A4 (LOW). A seated doll sinks by the seat's drop; what it wore did not.** The face hands the picture's feet (`at`),
and the gather stands the wearer on them.

**A5 (LOW). The gather read the classic layer's face before that layer drew,** a frame late, so a turning sprite's
Aura Armory pieces flicked a frame. The gather runs after every layer's sync now.

**A6 (MEDIUM, found in the revert, A2's own). A doll whose peer ran away swung its hem through its front** - the
owner's shot, at a run. A2 turned the trail into the doll's frame, and away from the eye a trail points at it: at
8 m/s, 41 of 625 cloth points stood up to 0.27 m before the card. A doll's face says `front`, and the part of its swing
along the eye folds behind it (`auraSwingDrawn`). Across the view it still trails behind the walk; a sprite with views,
or a body, keeps its swing as it is.

## The cut (B), gone with it

B1 (the straight fall's ledge at the shoulders), B2 (the folds' light leaning the wrong way) and the crouch's dropped
gather were the straight cut's own, and went with it. **B3 (LOW, recorded).** On a one-hander's thrust the free hand
comes through the cloth from behind - 25 cm in the wrapped shape, which is back. A cape cannot know a blow's
follow-through without the arm's bones, and the Eternal cape reads none.

## Seen (D)

**D1 (MEDIUM), undone with the cut.** The straight cut hung 0.15 to 0.34 m behind the shoulders, so on a doll the card's
push stood it half a metre off, and a doll's face said no card. The wrapped shape is back: at rest its sides lie at the
card's plane and its collar 2.4 cm before it. A doll is a card again, and the cape stands WING_SPRITE_BACK behind it,
WINGS-FIT's law.

D2 (the flat cut thin edge-on) and D3 (the tear's burst, dropped from the cut) went with the cut: the wrapped shape
calls cloakPoint, which bursts as it tears.

**D4 (LOW). CLOAK_CARD_POSE's comment said what hangs on the back stands behind the card.** The Holo Shadow Cloak wraps
the body and reads no `uWingBack`; the comment, the field-bug page and Shop.md say so now.

## The pins and the record (C)

C1 (the cut's copy of the cloak's law unpinned) and C3 (= B2) went with the cut: the wrapped shape is the cloak's own
cloth, held by the cloak's pins.

**C2 (MEDIUM). A patch note said the cloak hangs behind the card.** The Holo Shadow Cloak wraps the body - its hood and
clasp are its front - and reads no push; it is faced as the picture now, as the note's own rule needs, and the note
names only the wings.

**C4 (LOW). The face's edges were unpinned** - the turn's fallback, an eye over a doll's feet, a view that is no whole
view, the wrap. Pinned.

**C5 to C8 (LOW).** The field-bug page undercounted the moved pins and fixtures; the pull request's numbers predated
the merge of main; it said the wave vanishes at the edges (the folds do); and the new test's header ran past eight
lines. Each put right. The sigil's own mirror (a lane mutant) is no defect: the glyph is the same either way round.

## Not changed, and the owner's to decide

- **WINGS-FIT's push on a card.** The push moves what hangs on the back along the facing, so its place on screen moves
  with the eye's bearing and height: from the side the cape stands off the back, and from a raised eye before a doll
  its top shows behind the head. The owner chose it for the wings and the cape (WINGS-FIT, ETERNAL-FIT). A push along
  the eye's own ray would keep the silhouette and decide only the depth.
- **A card's swing toward the eye.** An eight-view sprite facing the eye and walking backward at 4 m/s trails its hem
  to within 2 cm of its card. Older than CAPE-CARD; a doll is held behind (A6).
- **B3**, above.
