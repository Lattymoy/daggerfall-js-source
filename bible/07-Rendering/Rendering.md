# Rendering

Started with World-Arc milestone 1. Presentation is ours per Port-Doctrine;
this section owns renderer specifics.

Current (`src/render/`):
- `renderer.js` - WebGL2, two programs: lit solid geometry (MVP, directional
  light 0.45 + 0.55*diffuse, alpha < 0.5 discard) and Y-locked billboards
  expanded in the vertex shader. Textures per (archive, record), REPEAT +
  NEAREST, uploaded bottom-up exactly as getColor32 emits (matches GL texel
  order; DFU's negative-V UVs rely on REPEAT).
- `groundMesh.js` - per-tile quads with UV rotate/flip; renderer-side
  equivalent of DFU's tilemap-shader atlas (ledgered departure).

Milestone log: `07-Rendering/Rendering-Arc.md` (R1 climate swaps,
R2 window emission, R3 city lanterns, R4 painted skies, R5 day/night
cycle, R6 dungeon lighting, R7 dungeon water, R8 interior lights, R9 terrain tilemap shader - all SHIPPED).

Owned queue (from Port-Ledger C): classic dungeon water texture,
weather (owns the Fog window style), spectral/firewall emission colors
when spectral enemies land. R10 retired groundMesh.js - all ground
(exterior + terrain) runs the verbatim tilemap shader.
