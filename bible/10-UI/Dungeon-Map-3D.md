# The dungeon map in 3D

The held map's dungeon sheet draws the level in 3D, the way Daggerfall Unity's 3D automap does, but inked by hand on
the same parchment as the rest of the held map. It is the default. The flat plan, one floor at a time with its floor
list, is the Off of the Features row "3D dungeon map" (`dungeon-map-3d`, the interface group). The classic skin keeps
the classic automap window.

## How it works

The switch is read where the sheet is built (`src/ui/map/mapSkin.js` `dungeonMap3dOn`), so a change takes the next map
opened. `?dungeonmap=flat` forces the flat plan.

- **The level.** With WebGL2, the revealed rows' own triangles are drawn (`src/ui/ink/inkDungeonGL.js`, one ink a page
  through `dungeonInkFor`). A face is drawn when it faces the eye, and the level is cut above the player's feet by the
  classic window's slicing law (`src/systems/automap/automap.js` `slicingPositionY`). Pass one lays washes,
  flagstones and water; pass two inks creases and outlines. A short upright face (`RISER_MAX`) is inked as part of its
  slope, so stairs never read as a black band. A face is floor when it leans no more than the player can walk
  (`FLOOR_FACE_NY`).
- **Without WebGL2** (node and the tests) a cell model draws instead (`src/ui/ink/inkDungeonSolid.js`).
- **All floors** (L) shows every explored storey, the player's in full and the rest at `OTHER_FLOOR`.
- **The walked trail.** The player's feet are recorded on a 1 m grid at the reveal scan's rate
  (`automapTrailTick`) and saved in the dungeon's automap record as `trail`. Reveal-all marks the record `trailAll`.
- **Teleporters** show once the spot they stand on is in a revealed row.
- **Notes** are pins with words; a click renames one, an empty name removes it.

Right-drag (or Shift-drag, or a two-finger twist) turns and tilts. Q/E turn, R/F tilt, P lays the map flat as the
plan, PgUp/PgDn page the floors, L shows all floors, Home centres on the player. On the Enhanced Plus skin these are
buttons on the window. The turn pivot is the middle of everything explored; after Home it is the player, until the map
is dragged again. Only the left button pans.

## Rules

- The 3D map is the default; the flat plan stays as an option and is not removed (Mac).
- No key tips on the 3D sheet's foot: its turn, tilt, plan and home are buttons on the paper (Mac)
  (`src/ui/automap/automapSheet.js` `AUTOMAP_HINT_3D`).
- The plan key is P (`PLAN_KEY`), a letter no default binding uses.

## Daggerfall Unity

DFU's `Automap.cs` and `DaggerfallAutomapWindow.cs` draw the 3D automap from the level's own geometry, cut at
`SlicingBiasY` above the eye. We keep the geometry and the slicing height and replace the rendered look with hand
inking on parchment, so the dungeon map matches the rest of the held map.

## Code and tests

- `src/ui/automap/automapSheet.js` - the dungeon sheet, flat and 3D, its keys and pivot
- `src/ui/ink/inkDungeonGL.js` - the WebGL2 inking
- `src/ui/ink/inkDungeonSolid.js` - the cell model and orbit controls
- `src/ui/map/mapSkin.js` - `dungeonMap3dOn`
- `test/ui/ink/em3_3d_dungeon.test.js` - the 3D sheet
- `test/ui/map/em3_mapchoice.test.js` - the Features switch through the automap door
- `test/ui/ink/fb1003_glleak.test.js` - one GL context a page

## Open

- Not yet seen in the running game on Daggerfall's own dungeons; the tests build their own levels.
- A turn's repaint time on a GPU is not measured.
