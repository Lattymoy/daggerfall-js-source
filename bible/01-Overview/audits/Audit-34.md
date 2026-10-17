# AUDIT 34 - PX22 AND THE ITEM-SPRITE INTEGRATION (2026-08-31)

Mac's call: a comprehensive audit on PX22 (the pack's Layer 1) and the
new Morrowind sprite integration (MW-D37 materials and dye, MW-D38 the
item icons). Method: the layout re-rendered headless at three sizes
with the regions measured, and the two slices read for every path a
retail archive or a full wardrobe would take.

## PX22, measured

- **Phone (390x844)**: window 844, character region 393, dock 328,
  tab strip wraps to two lines (76px), FOUR rows of tiles, the
  transport strip inside its column (not clipped), footer intact.
- **Short desktop (1280x600)**: the 94dvh window is 564; the dock
  holds at its 100px floor (tabs 38, one row of tiles), the map whole
  and the strip unclipped. This is the smallest honest state of the
  stacked layout and it degrades to a scroll, not to overlap.
- **The 660 window (1280x900)**: two full rows, tabs 40px, scroll
  memory 197 -> 197 across a tab round trip. As shipped.
- The loot window has its own frame (.loot-win) and shares none of the
  changed selectors; the pack's keyboard law is untouched (the memo
  restores scrollTop after the DOM is rebuilt, and focus is set after
  that by the existing code path).

No PX22 finding.

## Findings in the sprite integration

**F1 - THE GARMENT COLOUR SAMPLER PRE-MEASURED THE WHOLE MASTER, and
the icon door could not reach it.** D37's sampler decoded the worn
texture of EVERY CLOT record in the loaded masters the first time any
garment was worn - hundreds of DDS decodes and NIF parses for one
shirt - and being async and build-local, D38's icon door could only
read whatever a previous build had happened to cache, so an icon and
the worn piece could resolve to DIFFERENT shirts (the icon the
id-sorted first, the body the dye-matched one). Fixed at the root:
`clothingColourOf` measures ONE record when the resolver asks (the
resolver only asks about its own type's pool), synchronously - the
parse and decode doors are static imports now - memoised per data
generation, and the same function serves the build and the icon. The
eager sampler is gone and swept.

**F2 - THE REPORT JUDGED WEAPONS BY THE ARMOR TABLE.** mwItemReport's
weapon note checked the resolved id against the ARMOR material chain,
so an elven weapon correctly resolved to silver was reported as "the
type's first" (armor says steel). The note reads the weapon chain,
names the chain it walked on a real fallback, and is pinned on the
elven-on-silver case. 1 mutant dead.

## Verified

- **GPU ownership**: releaseGpu deletes the VAO, the buffers and every
  range's texture, so an icon render leaves nothing on the GPU (the
  pixels are what is cached).
- **Icon cache key** carries generation, record, size and dye; a
  garment's dye already selects its record, so the dye term is
  redundant and harmless.
- **itemTile** is the one tile builder for the pack's grid, the worn
  slots and the loot rows, so the model icon appears wherever a tile
  does and the classic sprite behind it everywhere else.
- **The weapon key** reads materialName(item) for claws and quest
  items too (MATERIAL_NAMES[0] = Iron), which is the classic default.
- **Ground-mesh orientation**: the icon camera looks down-front-right
  at a mesh lying in the tipped XZ plane; every corner of the bounds is
  pinned inside the frame with a little air.

## Not covered, said plainly

The icons' first pixels on retail are Mac's; the framing angle is a
choice the eye may retune. The phone's two-line tab strip costs a
row and is the strip's natural wrap, not a regression.
