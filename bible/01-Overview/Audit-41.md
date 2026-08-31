# AUDIT 41 - THE SURFACE STATE FIELD (2026-08-31)

Mac: a comprehensive audit on the puddle / snow / deformation system,
ensuring perfection. Method: the field's own laws traced from the
world's coordinates through to the pixel, and the numbers checked
against each other rather than admired separately.

## Findings

**F1 (severe) - THE FIELD MOVED ITS ORIGIN AND NOT ITS CONTENTS.**
The field re-centres on the player in whole texels and rebuilds its
pooling for the new patch of ground - and left the water, snow, pack
and wear sitting at their old TEXEL INDICES. Every accumulated thing
therefore slid along with the player: walk ten metres and your own
footprints follow you, which is the precise opposite of what a
footprint is, and the melt would have dried a puddle that had
travelled. `scrollField` now shifts the contents by the whole-texel
delta, copying in the safe direction so the shift cannot read what it
has already written, and clears the edge that has just come into
view, because unseen ground has no snow on it. The field is fixed to
the world and the window moves over it.

**F2 - THE MESH COULD NOT EXPRESS A FOOTPRINT.** The displacement law
was right and the geometry could not say it. The ground was 220 quads
over 300m - **1.36m a vertex** - while the field is **0.25m a texel**
and a print is **0.34m across**: half a vertex spacing. No print could
ever move a vertex, so the whole of law 3 collapsed into shading and
the trail read as a decal after all. A NEAR PATCH is drawn at 0.33m a
vertex over the field's own 64m, on top of the coarse plane, so inside
the field every texel has geometry to move and outside it the far
ground stays cheap.

**F3 - THE TWO GROUND SURFACES Z-FOUGHT.** The near patch is
coincident with the wide plane by construction - the same height field
at two resolutions - so the near ground shimmered. A polygon offset
biases the patch in depth only, which is the right tool: the surfaces
stay where they are and only their ordering is decided.

## Verified

- Water accumulation is weighted by the terrain's OWN concavity and
  snow by its flatness, both cached per texel and invalidated on
  re-centre, so the pooling always describes the ground under it.
- Melt is a conversion at a third of depth and the dried water is
  removed slower in a hollow - the chain snow -> water -> ground
  cannot lose mass to a deletion anywhere.
- A step compresses rather than deletes: the snow taken from the
  print is a fraction of what is there, the rim gains, and pack and
  wear decay on different clocks so a trail outlives its prints.
- The field's texture is CLAMP_TO_EDGE and the shader's UV is derived
  from the same origin the CPU stamps against, so a stamp lands where
  the pixel reads.

## Not covered, said plainly

The footprint trail was not confirmable in the headless harness -
accumulation takes real seconds and the software rasteriser makes a
walk expensive - so its first honest reading is Mac's eye on real
hardware. The near patch is a lab construction: the game's terrain is
chunked with its own LOD, and porting this means the field feeding
that chunker's own vertices rather than a second plane laid over it.
