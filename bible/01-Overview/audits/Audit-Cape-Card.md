# AUDIT CAPE-CARD - CAPE-CARD and CAPE-FLAT read cold, 2026-10-30

The owner: *"Audit this"*, of PR #1455 at `8c61432b5` - the fixes of `../bugs/Field-Bugs-2026-10-30.md` (the Eternal
cape on a peer's front, and its curved cut), merged with main's AURA-ON-DRAGON. Four cold lanes read a frozen worktree
of that commit, each given the files and one brief (what to hunt, how to prove it), never a conclusion. Each finding
was proven on the real code - a probe, a test that fails at the commit, or quoted lines - and proven again here before
its fix. Fixes carry an `AUDIT CAPE-CARD <id>` comment; the pins are `test/render/auditcapecard.test.js`, the mutants
`tools/mutants/auditcapecard.json` (13, all dead).

| Lane | Read | Found |
|---|---|---|
| A | the facing law and its wiring: every layer a peer is drawn in, the eye, the order | 5 |
| B | the straight cut as geometry and GLSL, on retail's rig, the sprite figure and the rest pose | 3 |
| C | the pins, the mutants, the record and the pull request's words | reading |
| D | rendered frames in Chromium: every look with a body mesh, before and after | 4 |

## The facing law (A)

**A1 (HIGH). In third person the Eye of the Beholder walkers and riders turned to the head, not the camera.** World.js
handed their layers `cam.pos` (`player.eyeAt()`), and the frame draws from `mwv.eye`, 2.7 m behind it. A peer beside
me showed the camera one view and hung a cape on another: 78 of 143 cape points lay over a party mate's front. The
class sprites turned to `player.pos` the same way. Every peer's picture now turns to the eye that draws it, WAGONS3's
law (`hcc.faceTeams`): the walkers and riders to the renderer's camera (`peerEye`), the class sprites to `view`. The
classic layer's `eye` stays the listener's, for the steps', swings' and hooves' sounds. Older than CAPE-CARD (SPRITE-FACE).

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

## The cut (B)

**B1 (MEDIUM). On a Morrowind body the straight fall had a ledge at the shoulders.** The keep off the legs was measured
from the feet's axis and full just under the top edge, so on shoulders leaning over the feet (idle, a walk, a sneak:
62 to 77 degrees) the rows under them stepped back off the rows over them. The keep grows from nothing at the shoulders
and is whole by the hips. The old wrapped shape had the same step, hidden by its sides.

**B2 (LOW). The folds' light leaned the wrong way.** One home now, `eternalFoldLean`, with the cloth's own slope's sign.

**B3 (LOW, recorded).** On a one-hander's thrust the free hand comes 10 cm through the cloth from behind. The old shape
was worse (25 cm); a cape cannot know a blow's follow-through without the arm's bones, and the Eternal cape reads none.

The crouch: cloakPoint's "gathering out as it is pressed down" was dropped from the cut; it is back.

## Seen (D)

**D1 (MEDIUM). On a doll the card's push stood the cape off it.** A doll shows every eye its front, so it has no side
for WINGS-FIT's push to clear, and half a metre further back the cape rose behind the head from a raised third-person
eye. A doll's face says no card now; faced to the eye, the cape is behind it at its own depth. A class sprite keeps the
push: it has side views, as an Eye of the Beholder sprite does (ETERNAL-FIT, the owner's law).

**D2 (MEDIUM, the owner's to decide).** Cut straight, the cape is edge-on from the side: 15 to 24 percent of the old
area at 90 degrees. See the last section.

**D3 (LOW). Turned beast, the cape no longer burst out as it tore.** cloakPoint's tear terms are back in eternalPoint.

**D4 (LOW). CLOAK_CARD_POSE's comment said what hangs on the back stands behind the card.** The Holo Shadow Cloak wraps
the body and reads no `uWingBack`; the comment, the field-bug page and Shop.md say so now.

## The pins and the record (C)

Lane C was still reading when the fixes above went up; its findings follow them here.

## Not changed, and the owner's to decide

- **The cut seen from the side (D2).** A flat cape is a line edge-on. Deeper folds or a wrap at the hem alone would give
  it a side, at some cost to "straight". Not changed without the owner's word.
- **WINGS-FIT's push on an eight-view sprite.** The push moves what hangs on the back along the facing, so its place on
  screen moves with the eye's bearing and height: from the side the cape stands off the back, from above it starts low.
  The owner chose it for the wings and the cape (WINGS-FIT, ETERNAL-FIT). A push along the eye's own ray would keep the
  silhouette and decide only the depth.
- **B3**, above.
