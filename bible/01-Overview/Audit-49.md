# AUDIT 49 - THE LAB'S GRASS AND WEATHER IN THE GAME (2026-09-02)

Mac: a comprehensive audit of GR1 (the lab's grass, byte for byte) -
and WX1 (the lab's weather) with it, since they share the method.

## Method

The byte-exact claim is a pin, not a sentence: both shader stages of
each pass are sliced out of grass-proto.html at test time and compared
as strings. What this audit looked for is everything AROUND the
verbatim text - the GL state the lab assumed, the coordinates the game
moves, the caches the game keeps - because that is where a verbatim
port goes wrong.

## Findings

**F1 - THE BLADES WERE CULLED.** The lab never enables CULL_FACE - a
blade is one quad seen from both sides - and the world renderer
enables it at every frame. Drawn with culling on, every blade whose
winding faced away from the eye vanished, and turning changed which
half of the sward was there. This is "grass that disappears". Off for
the grass draw, back on after, as the renderer left it. Mutant dead.

**F2 - THE SCATTER DID NOT FOLLOW THE ORIGIN.** The world uses a
floating origin (EV1) and shifts everything by 819 units when the
player crosses a pixel boundary; the blades are baked in world
coordinates and were not in the list of things shifted, so the whole
sward jumped a pixel away until the next re-place 60m later. The
shift now forces a re-place around the eye.

**F3 - AN ARCHIVE COULD HAVE NO GRASS RECORDS.** The records were
learned only inside the tile-array cache MISS, and that cache lives on
the renderer and outlives the scene. An archive the exterior host had
uploaded came back to the world host cached, skipped the block, and
grew no grass. Learned whenever missing now.

**F4 - THE GUST WAS DROPPED FROM uWind.** The lab passes WIND.speed,
which carries its three-sine gust; the game passed the bare speed.
The vertex text never reads uWind (it reads uWindV), so nothing was
visible - but byte-exact means the uniforms too. The same pair the
rain is fed.

## Verified

- Both lab programs (grass and weather) declare every uniform they use;
  the declaration sweep now composes labGrass's HEAD + FIELD + body the
  way the module does.
- The lab weather draw restores depth write, culling and blend after
  itself; the grass draw restores culling and blend.
- Both foreign draws mark the EV6 seam; every count that said four
  passes says five.
- No blade on a road record, on water, under the sea plane, or in
  winter - pinned pure, and measured live (0 in a winter town).

## Costs, stated

The placer walks 1,200,000 candidates on the main thread every time
the eye moves 60m from the last centre: 169ms, a visible hitch per
re-place. A worker would hide it; Mac's call was performance later,
and it is later. And the harness cannot screenshot a million lab
blades in its time budget, so the grass has not been SEEN by me - it
has been counted, and its shaders proven identical.

**Correction (AUDIT 56, 2026-09-03):** this audit's verification of the lab rain ran with `precip.enhanced` FALSE - the sky controller never carried `cloudShadow` (GR3), so the enhanced precipitation path had never executed in the game. The findings above stand; the rain's verification does not. See Audit-56.md.
