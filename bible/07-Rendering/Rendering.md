# Rendering

Started with World-Arc milestone 1. Presentation is ours per Port-Doctrine;
this section owns renderer specifics.

Current (`src/render/`) - one bullet per module, pinned against the real
directory by `test/audit18_bible_docs.test.js`:
- `renderer.js` - WebGL2, two programs: lit solid geometry (MVP, directional
  light 0.45 + 0.55*diffuse, alpha < 0.5 discard) and Y-locked billboards
  expanded in the vertex shader. Textures per (archive, record), REPEAT +
  NEAREST, uploaded bottom-up exactly as getColor32 emits (matches GL texel
  order; DFU's negative-V UVs rely on REPEAT). ALL ground - exterior blocks
  and terrain alike - runs through this file's `drawTerrain` tilemap pass.
- `characterMesh.js` - the voxel character mesh path.
- `characterSprite.js` - the classic-visuals sprite pass (one fixed
  CHAR_SPRITE_RT_SIZE target).
- `skyRenderer.js` - painted skies (R4) + the night sky.
- `overworldRenderer.js` - U61 the OVERWORLD pass: the whole-bay relief,
  its location markers, the route line and the cloud deck behind the
  enhanced travel map (self-contained, save/restore, mirrorProjectionX
  on its camera like every world pass - see `src/ui/overworldMap.js`
  for the window that drives it).
- `windowEmission.js` - R2 window emission.
- `precipitation.js` - R13 rain/snow + storm lightning.
- `flatAnimation.js` - FA1 the ANIMATED FLATS: DaggerfallBillboard's
  AnimateBillboard loop verbatim (the wrap test before the draw, the increment
  after it) on a FIXED 1/fps step, the three speeds (general 5, ANIMALS 5,
  LIGHTS 12), and the one arming seam all four static-flat batch sites call so
  the four hosts cannot drift.

AUDIT 18 deleted a `groundMesh.js` bullet from this list: R10 had already
deleted that module, and the bullet tagged it "(ledgered departure)" when
Ledger A has no ground-mesh row of any kind - a citation to a Ledger row
that does not exist, which is the exact 17m shape. The page contradicted
itself further down, where "R10 retired groundMesh.js" already stood.

Milestone log: `07-Rendering/Rendering-Arc.md` (R1 climate swaps,
R2 window emission, R3 city lanterns, R4 painted skies, R5 day/night
cycle, R6 dungeon lighting, R7 dungeon water, R8 interior lights, R9 terrain tilemap shader - all SHIPPED).

AUDIT 2026-07-06: the character-sprite pass renders into ONE fixed
CHAR_SPRITE_RT_SIZE (256) target (viewport sub-rect + UV-extent
sampling) - the per-size reallocating cache is gone (it thrashed
FBO/texture/renderbuffer per character per frame under C8's foes).
Presentation-side, ours (Port-Doctrine); no ledger entry needed.

Owned queue: EMPTY. The spectral row SHIPPED 2026-07-06 under the
classic-visuals direction (Mac): spectral enemies land as billboards,
so the two owed BaseImageFile helpers ported verbatim and the
billboard pass gained emission + a blended spectral phase (180 alpha,
red eyes, V^1.9 body glow) - full record in Characters-Arc E4.
GetFireWallColors32 stays unported until a firewall consumer exists
(a two-line lerp). Live visual sign-off open (Mac). R13 shipped precipitation + verbatim storm
lightning. R10 retired groundMesh.js - all ground
(exterior + terrain) runs the verbatim tilemap shader.
