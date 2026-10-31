# GLOSSARY - the short words code and the bible may use

Opened 2026-10-30 (LEGIBLE 5, `01-Overview/Readability-Arc.md`). LEGIBLE's standard says a name says what a thing is,
and an abbreviation a newcomer would have to look up is allowed only if it stands here. This page is that list.

`tools/shortNames.mjs` reads the first section: a binding of one or two characters (or a name the last section retires)
is counted unless that section allows it. `test/tooling/legible5_shortnames.test.js` holds each file to
`tools/shortNamesBaseline.json`, which only goes down.

## Short names code may use

- `i`, `j`, `k` - loop counters.
- `n` - a count.
- `x`, `y`, `z`, `w` - coordinates, and a width or a quaternion's fourth part.
- `x0`, `y0`, `z0`, `x1`, `y1`, `z1` - the two ends of a span.
- `dx`, `dy`, `dz` - a difference along one axis.
- `dt` - a frame's time step.
- `px`, `py` - a map pixel's x and y (DFU's MapPixelX and MapPixelY).
- `id` - an identifier.
- `ok` - whether a thing succeeded.
- `e` - the event or the error a handler takes.
- `a`, `b` - the two things a comparator compares.
- `fn` - a function handed in.
- `gl` - the WebGL2 context.
- `db` - the database handle (the account service's D1).
- `ws` - a WebSocket.
- `uv` - a texture coordinate pair.
- `_` - a value left unused on purpose.
- `at`, `by`, `go`, `hi`, `it`, `lo`, `me`, `no`, `of`, `on`, `to`, `up`, `us` - English words, used as words.

## Words of the field

These are read in code, comments and the bible without being spelled out.

- `DFU` - Daggerfall Unity, the reference (`01-Overview/Port-Doctrine.md`).
- `HUD` - the heads-up display.
- `UV` - a texture coordinate.
- `NPC` - a non-player character.
- `POI` - a point of interest, the editor's places (`06-Systems/POI-Editor-Arc.md`).
- `RMB`, `RDB` - Daggerfall's town and dungeon blocks (BLOCKS.BSA).
- `BSA`, `IMG`, `CIF`, `CFA` - Daggerfall's archive and picture formats (`02-Formats/`).
- `GL` - WebGL2, the renderer's API.

## Abbreviations to retire

LEGIBLE 5's renames, one a slice, each in a quiet window the owner calls. Until its slice, each is read as written
here; a new binding named one exactly is counted with the short names.

- `dw` - Deep Waters.
- `csa` - Come Sail Away.
- `wod` - World of Daggerfall.
- `lpt` - Low-Poly Trees.
- `hcc` - Horse, Cart and Cargo.
- `mwv` - the Morrowind view.
