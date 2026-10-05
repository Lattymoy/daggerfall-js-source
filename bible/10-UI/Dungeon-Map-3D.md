# THE DUNGEON MAP IN THE ROUND (EM3-3D)

Mac, 2026-09-27: *"making the map like the og one in 3d again but only handrawn"*, then, merging it: *"The dungeon map
becomes the new default option, the current 2d enhanced becomes an option, not removed."*

The held map's dungeon sheet (EM3's `ui/automapSheet.js`) has a second mode, `solid`: the level drawn in the round, the
way DFU's 3D automap draws it, but inked by hand on the same parchment. It is the default. EM3's flat plan, one floor at a
time with its floor list, is the Off of the Features row `dungeon-map-3d` ("3D dungeon map", the interface group, under
the Enhanced map row). `?dungeonmap=flat` is the kill door. Both are read where the sheet is built (`ui/mapSkin.js`
`dungeonMap3dOn`, `ui/heldMap.js`), so a change takes the next map opened. The classic skin keeps DFU's own automap
window. Port-Ledger section A carries the departure.

## What it draws

- **The revealed rows' own triangles** (`ui/inkDungeonGL.js`, WebGL2 - ONE ink a page, `dungeonInkFor`, every sheet's rows
  keyed by the sheet; it was a context a map open, never freed: GL-LEAK, FIELD BUGS 2026-10-03), culled as the world pass culls - a face is drawn
  when its wound normal, after placement, faces the eye (proved through `world/mat4.js`'s own functions) - and cut above
  the player's feet by the classic window's slicing law (`systems/automap.js` `slicingPositionY`). Pass one lays facing,
  washes, flagstones (running bond, a level of detail by zoom) and water (`waterLevel` per row: a darkening wash, waves,
  level lines on walls, a waterline); pass two inks creases, cuts and outlines from the depth's curvature, with a wobble.
  A short upright face (`RISER_MAX`) is a riser, inked as part of its slope, so a flight is never a black band.
  A face is a FLOOR by the plan's own law - leaning up no further than the motor walks (`FLOOR_FACE_NY`, automapFloors'
  `FLOOR_NY`): a literal 0.6 (53 degrees) inked Daggerfall's 55-degree ramps as walls, a hallway's climb never the grey
  of ground walked (RAMP-INK, `01-Overview/Field-Bugs-2026-10-05c.md`).
- **Without WebGL2** (node, the pins) the cell model draws instead (`ui/inkDungeonSolid.js`): the walkable floor seeded at
  each storey and grown across a climbable rise, thin walls, ramps for flights, a cutaway by turn step.
- **All floors** (L): every explored storey, each row cut at its own storey's slice; the player's storey in full and the
  rest at `OTHER_FLOOR`. A row's storey is the height with the most level-face area.
- **The walked trail**: the feet on a 1 m grid at the scan's 5 Hz (`automapTrailTick`), saved in the dungeon's automap
  record as an optional `trail` and dropped with the reveal when the layout no longer matches. RevealAll marks the record
  `trailAll`; HideAll clears it.
- **Teleporters seen before they are walked** (TP-SEEN): every Teleport action in the level, shown once its entrance
  stands in a revealed row.
- **Notes as waypoints**: a pin with its words; one click renames it, empty removes it.

## How it is handled

Right-drag (or Shift-drag, or a two-finger twist) turns and tilts; the first 8 px of a drag choose turn, tilt or both.
Q/E turn, R/F tilt, P lays it flat as the plan (north up) and back, PgUp/PgDn page the floors, L shows all floors,
Home (Me) puts the player in the middle. On the Enhanced Plus skin the controls are the window's own button bar
(`.hmtools`). **The pivot is fixed**: the middle of everything explored, held on its paper point for the whole turn;
Me pins it to the player until the map is dragged again. Only the left button pans.

## Also in the patch

- **Pad**: any live pad button counts as using the controller; a real keypress hands the diamond hotbar back to the
  keyboard; freeing the mouse with the pad in hand is the pad's own pointer mode; the crossbar's family is sticky until
  the pad acts (`ui/gamepadInput.js`).
- **Walk mode** (PADWALK): a `WalkMode` action, appended and unbound, on the Controller bindings window and the d-pad
  choices; the hosts pass `sneak: held(keys, 'Sneak') || walkModeOn()` (`player/walkMode.js`).
- **The Enhanced Plus spell shop** (SHOP-PLUS): the guild's Buy Spells window wears the Plus port.
- **HOLD-CLOSE**: the held map's paper is fitted to the screen and the painting follows it (`heldStageRect`); the old fit
  is kept for the Morrowind arms lane (`heldStageRectArm`).

## The merge (2026-09-27)

The patch arrived as whole files cut from main at `b27721a1` (#396), not a diff. Each file was three-way merged
(`git merge-file`: main's file, the base, the patch's) onto main `43c8762d`: no conflicts, since main had not touched the
map files and only lightly the rest. Done at the merge:

- **The switch**: the Features row, `dungeonMap3dOn` reading it beside the kill door, `test/em3_mapchoice.test.js`
  driven through the real automap door, `tools/mutants/em3mapchoice.json`.
- **Types**: 22 `tsc` errors - the trail's record fields, the sheet's `domTools`/`portals`, the solid options, the orbit's
  literal types.
- **Laws the patch broke**: a hand-rolled context-menu guard in `heldMap.js` removed (MAC-L3: the hosts' one guard covers
  the right-drag); the KB1 comment put back on `bindCursorToggle`.
- **Pins the patch left short, added**: the arm lane's stage fit (the old fit's laws on `heldStageRectArm`), a tab click's
  release arm (a press begun off the strip that ends on a tab), the trail through a save and a new layout, walk mode
  under a window.
- **Mutants**: 23 records re-aimed to the lines the patch rewrote, two twins for the patch's second tab path, 14 new -
  all dead.
- **The probes**: all six judge their subject now (T3), and all six were run in Chromium on SwiftShader at the merge, on
  their synthetic levels: the turn's pivot moved 0 px; a sideways shake tilted 0; a 1.28 rad turn, floor paging, a note
  typed in, the stick's zoom and both tilt stops held; the side view is 0.357 solid ink (no black ground); the flooded
  level keeps both storeys under All; the flat plan's floor list takes every click with a drifting hand; the spell shop
  sold a spell for its price; a resting map repaints nothing. `em3SolidProbe` now opens the flat plan, whose floor list it
  was written for. The turn probe's "the paper's middle drifts 0 m" figures belonged to an earlier pivot and are
  reported, not judged: the final pivot is the explored middle.
- Pins re-aimed by content in `features`, `ft18_features`, `ft8_combatvisuals`, `weather2b_weatherfield`, `heldmap`,
  `audit39_worldstate`, `joystickwindow`, `qs3_hud`; 404 line cites moved by `tools/citeShift.mjs` and 16 held ones by
  their content.

## Open

- **Not seen in the running game with Daggerfall's own dungeons**: this container has no ARENA2 data, and every probe
  builds its own level.
- A turn repaints in 75-125 ms on software GL; on a GPU it has not been measured.
