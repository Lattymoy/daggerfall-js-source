# UI-Arc (ACTIVE)

Opened 2026-07-06 after Combat completed. Goal: the classic
Daggerfall UI over our WebGL2 frame - HUD first (the Systems stats
exist, nothing shows them), then the paper windows (chargen, char
sheet, inventory, spellbook) that retire the headless interim
policies one by one.

## U1 (classic HUD - vitals + compass): SHIPPED

The renderer gains ONE screen-space primitive: drawScreenQuad -
positioned pixel-rect destination (top-left origin), source-UV
window, textured (0.5 alpha cut) or solid color; depth off, NEAREST.
src/ui/hud.js is the verbatim DFU-fullscreen HUD: vitals
bottom-left from the classic bar art (MAIN03I0 health / MAIN04I0
fatigue / MAIN05I0 magicka), each cropped BOTTOM-ANCHORED by
current/max (the VerticalProgress shape; fatigue draws FULL,
FLAGGED - the stat pends); the compass bottom-right - COMPBOX frame
over a 64px window into COMPASS.IMG scrolled by trunc(258 x
heading01) (nonWrappedPart; the strip's tail duplicates its head so
scroll 257 + 64 = 321 < 322, no runtime wrap - pinned). Integer
scale floor(canvasHeight/200), min 1, keeps the art crisp. Indexed
IMG pixels convert with the classic index-0 transparency and ride
renderer.uploadTexture under img/name keys. Heading derives from
the view forward the file already uses (0 = +z, wrapped). Art-gated:
absent IMGs disable the HUD loudly. Review catch IN-SLICE: the new
static ImgFile import double-sourced against foeDeps' dynamic - the
06e recidivist class, caught before commit this time.

## U2a (classic text - the FNT reader + drawing): SHIPPED

formats/fntFile.js is the verbatim FNT reader: header {fixedWidth,
fixedHeight u16}, 240 glyph entries {dataOffset, width u16}, 32-byte
glyphs of 16 rows x 2 bytes - with the source's L/R HALF SWAP (the
left 8 pixels come from the ODD byte, the right 8 from the EVEN, each
expanding MSB-first) pinned on crafted bytes. ui/text.js builds ONE
white 256x240 atlas per font through the existing uploadTexture and
draws through drawScreenQuad with per-call tint - one atlas serves
every classic text color; DaggerfallFont's rules carried (glyph =
code - 33, sub-33 codes advance a fixedWidth space, classic 1px
spacing, integer scale). Live consumer NOW (infra never ships dead):
the HUD shows the readied spell name + cost in FONT0003 above the
vitals - the U4 spellbook window replaces it. Review catch: the font
load was written as dynamic imports IN THE SLICE AFTER the 06e class
was caught in-slice - rooted static before commit; the pattern's
pull is real and the audits keep earning their keep.

## U2b (the chargen flow): SHIPPED

ui/chargen.js: name -> gender -> class (all 18 careers loaded from
their CLASS*.CFG, names from the files) -> stats -> skills -> done,
with the pool rules VERBATIM from the rollout components: stats +
blocked at MaxStatValue 100 or pool 0, - blocked at the ROLLED value
(points return); skills + blocked only at the group pool, - blocked
at the rolled value; both screens REROLL (the components' own);
confirm gates on pool == 0 (all three groups for skills). The
Warrior-16 default is GONE - no ?class and no chargenDone runs the
flow; ?class=N remains the headless skip (rolls + the loud
lowest-first policy, which now serves ONLY that path and the tests).
systems/chargen.js split at root: applyCharacter takes FINISHED
values (the flow's hand distribution or the headless roll) and owns
the health/magicka/sum derivations ONCE; gender lands on the entity
(clothing loot consumes it). Hosts pause gameplay while the overlay
is active (standalone keeps its RAF alive - a plain return would
have killed the loop, caught in review) and route a small key map;
no font art falls back to the headless roll LOUDLY so the game
stays playable without ARENA2 UI art. Screens are clean classic-text
panels; the classic background ART is FLAGGED pending art-name
verification against real ARENA2 (Mac signs off visuals).

## Queue
- U3: character sheet (retires the headless level-up).
- U4: inventory + spellbook windows (retires ?weapon/?spell).
- Death screen, pickup/message feedback, the input map.
