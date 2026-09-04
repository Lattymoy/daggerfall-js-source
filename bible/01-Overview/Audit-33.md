# AUDIT 33 - THE MODEL IN THE INVENTORY (2026-08-30)

Mac's call: a comprehensive audit on the D36 changes. One reader over
the slice the hour it shipped, asking of every gate: what state is the
game actually in when the inventory opens?

## Findings

**F1 - THE FIGURE GATED ON THE WHEEL BEING ON (severe; the feature did
not work).** `figure()` returned null unless `thirdActive()`, which
demands `viewMode === 'third'` and a GPU mesh that only the wheel's
update path uploads. The inventory is opened from FIRST person - the
default - so the panel would have shown the classic doll and the model
would never have appeared. The body's pieces are posed at build in
every view; only the upload was view-gated. Fixed at the root: the
upload is ONE helper (`uploadThirdMesh`) that both the wheel's update
and the figure call, and the figure stands whenever a third-person
body is built and a renderer exists. The figure also applies rule 57's
sheathed/arrow hiding exactly as the wheel does. Pinned: the figure's
body is asserted free of `thirdActive()`, the helper is asserted to
have two callers and one body. 1 mutant dead.

**F2 - A DRAG RE-RENDERED AND RE-ENCODED PER PIXEL.** Every
pointermove produced a fresh GPU render and a PNG encode. The yaw is
quantised to a tenth of a radian: about sixty frames per full turn,
and dragging back lands on cached ones. Pinned at the source.

## Verified

- **The rebuild releases the third mesh** (build(): releaseThirdMesh,
  thirdPacked = null) before the new body lands, so the figure after a
  D32 rebuild uploads the new clothes' ranges and textures rather than
  updating vertices under stale ranges.
- **The pieces are posed at build**: buildTpBody poses the assembly at
  the idle clip's start, so the figure stands in the idle rest pose in
  first person with no update tick.
- **The read-back**: viewport (0,0,pw,ph) is what readPixels reads;
  rows are flipped; the RT is borrowed and returned by the sprite
  render itself; alpha is cut, not blended, so ImageData's straight
  alpha is honest.
- **Orientation**: yaw 0 applies drawThird's own +180, which turns
  Morrowind's +Y forward (pass -Z through Rx(-90)) toward the eye on
  +Z; the mirror scale is drawThird's, which Mac saw correct on the
  wheel.
- **Enhanced only**: the door is the enhanced skin's; the classic
  inventory is swept to know nothing of the figure.
- **Ownership**: the pack unsubscribes on unmount; a dead panel's
  callback is caught at the rig.

## Not covered, said plainly

The figure's first pixels on retail are Mac's; the orientation and
framing are reasoned from the wheel's proven conventions, not seen.
