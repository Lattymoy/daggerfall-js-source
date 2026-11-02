# Sprite Forge

The forge makes the game's own class sprites. It renders a 3D fighter of its own in Blender into every record and
frame of a Daggerfall class sprite archive, at each record's own size. The game wears those frames through the studio
in place of Daggerfall's. TEXTURE.488 is the first: the male medium fighter that the Monk, Barbarian, Warrior and
Knight enemies wear.

## How it works

- **The body.** `tools/sprite-forge/anatomy.py` builds the naked man. The torso, arms and legs are smooth lofts of
  measured cross-sections with the muscles laid on as swells (`tools/sprite-forge/body.py` `vloft`); the head and
  feet are blended blobs. A voxel remesh fuses them into one closed mesh. The creases where they meet are smoothed,
  and the mesh is thinned where it is flat. Each vertex keeps its share of each piece (`alpha`) and takes its joint
  weights from them, so the body bends at elbow, knee, hip and waist by the forge's own linear-blend skinning
  (`Skinned`). The hands, open or closed round a grip, are rigid on the hand joints (`tools/sprite-forge/rig.py`).
- **The gear.** `tools/sprite-forge/model.py` dresses that body. The cuirass, the mail, the coif's neck and the
  bracers are layers of the body's own surface over a region, pushed out along its normals (`Skinned.shell`), so
  they bend as the body does. The mesh is cut along each layer's edge, so the edge is a clean ring, and the skin
  under the layers and the boots is dropped: no view sees it. The helm, pauldrons, boots, belt and loincloth are rigid
  on one joint each. Another outfit is another set of layers over the same body.
- **Patterns.** Every mesh keeps its rest position as a `rest` attribute, which the patterns read
  (`tools/sprite-forge/materials.py`). The mail is a diamond lattice round each limb's own axis (`chain`). A lattice
  or a fleck stays on its texel however the body bends.
- **The poses.** `tools/sprite-forge/poses.py` keys walk (4 frames), attack (6), hurt (1), idle (1) and bow (4). An arm
  reaches its grip by two-bone IK (`solve_arm`), so the axe's place drives the hands. Daggerfall turns the body
  differently in each view of the attack: from the side its back is to the viewer at the wind-up. So the attack is
  keyed per view (`ATTACK`), by where the fist and the axe head show on screen. The idle's axe is keyed per view too
  (`IDLE_AXE`): the front view hangs it to the ground. The archer stands side-on to the shot in every view
  (`BOW_TURN`).
- **Fitting the poses.** `tools/sprite-forge/fit.py` adjusts each frame's keyed pose until the body covers the
  record's outline, its colour regions (skin, boot teal, cloth green) and its weapon best. It turns joints, the
  shoulders, the body, the axe's grip, roll and slide along the haft, and each solved elbow's swivel, searching by
  CMA-ES. It lays the body's triangles on the work frame as Cycles samples it, the nearest surface over each pixel's
  centre, so its picture is the render's pixel for pixel. A standing frame keeps both feet down, and the bow stays
  near its keyed lean. `--restarts` runs several searches a frame (its last fit, its keys, then the best so far), and
  `--reg` sets how hard each adjustment is pulled back toward its key. The adjustments are kept in
  `tools/sprite-forge/specs/488-fit.json`; `poses.py` `load_fit` lays them on.
- **Fitting the body.** `fit.py --shape` fits the proportions over every frame in its fitted pose: the torso's width
  and depth, the limbs', the head's, the hands', the boots', the pauldrons' size and place, the loincloth's width, the
  axe's size, the bow's length, bend and thickness, and the whole body's size on screen. `--keys` fits only the named
  proportions, over the frames of `--records`. `tools/sprite-forge/shape.py` `transform` lays them on the meshes
  the renderer draws and on the fitter's triangles alike (`specs/488-shape.json`). A vertex of the fused body or its
  layers moves as each piece it lies on would move it, by its shares.
- **Fitting the colour.** `tools/sprite-forge/colour.py` tints each material until its pixels' mean colour is the
  record's over the same pixels (`specs/488-colour.json`, `materials.py` `tint`). Then it grades: skin, boots and
  cloth have a colour class of their own in the record, so each channel of their own pixels is mapped onto the
  class's, share for share. The other materials map their brightness onto the record's under them. The silver and
  the blade keep their render: they flash toward the light, and their few pixels sit over the record's darker parts
  wherever the outlines differ. The renderer applies the grade (`forge.py` `grade_frame`) through the fitter's exact
  material map (`specs/488-grade.json`). `--light` can fit the lights too (`stage.py` `LIGHT`); the forge keeps
  its default lights.
- **The stage.** `tools/sprite-forge/stage.py` uses an orthographic camera at 62 pixels a metre, looking 8 degrees
  down. The lights ride the camera, so every view is lit from the viewer's upper left. Cycles takes one sample point a
  pixel, so edges stay hard, and alpha is cut at one half.
- **The record table.** `tools/sprite-forge/specs/488.json` gives each record its animation and view (the five
  angles; the game mirrors the other three), its frame count, its canvas and its `place`: the canvas pixel under the
  body. The canvases are Daggerfall's record sizes, because the game sizes a mobile by its classic record
  (`src/world/rmbFlats.js` `mobileBillboardSize`) and stretches the picture to it.
- **Placing.** `tools/sprite-forge/reference.mjs` reads the outlines of the player's own archive into a file outside
  the repo. `forge.py --register` sets each record's `place` where the forge's frames overlap those outlines most,
  with the feet on the canvas's last row. It keeps only the place, and prints the overlap (intersection over union)
  as a measure.
- **Wearing.** The frames go to `public/art/studio/forge/488/` as `488_<record>-<frame>.png`. The studio registers
  them over TEXTURE.488 (`07-Rendering/Studio-Art.md`). As each is decoded it is snapped to the player's ART_PAL.COL
  with no grain (`src/systems/studioArt/studioArt.js` `isForgeRender`, `src/world/dfLook.js` `dfLook` at grain 0).

## Running it

Blender runs as a Python module: `pip install bpy==5.2.3` (Python 3.13). Then:

```
ARENA2_PATH=... node tools/sprite-forge/reference.mjs 488 /tmp/forge-ref-488.json
python -I tools/sprite-forge/fit.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json --shape
python -I tools/sprite-forge/fit.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json \
  --restarts 2 --iters 600
python -I tools/sprite-forge/colour.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --register /tmp/forge-ref-488.json --out /tmp/x
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --out public/art/studio/forge/488
```

Fitting needs `scipy` beside `bpy`. Fit and register again after the body or a key changes. `--records 0,5` limits a
run; `--work` writes uncropped renders; `--outfit naked` renders the body bare, with its weapons. `fit.py --no-head`
leaves the axe head unpinned: records 0, 3, 4, 12, 15 and 19 fit better so.

## Rules

- The forge's sprites are the game's own. They are rendered from the forge's models, never traced or repainted from
  a record. The reference outlines and colours that fit and place the body never enter the repo; only joint angles
  and places do (Port-Doctrine).
- They match Daggerfall's class sprites as closely as the forge can: the same records, frames, canvases, views,
  poses, gear and palette (Mac).
- The palette is the player's own, laid on as each picture is decoded (DF-Art).

## Daggerfall Unity

DFU draws the class enemies from TEXTURE.475-490 (`MobileEnemy` `MaleTexture`, `FemaleTexture`), and a texture pack
replaces a record by its name. The forge's frames go in by that same door. Only the art departs: DFU's records, frame
tables and sizes are read as they are.

## Code and tests

- `tools/sprite-forge/` - the forge: `forge.py`, `fit.py`, `colour.py`, `shape.py`, `model.py`, `anatomy.py`,
  `body.py`, `rig.py`, `poses.py`, `stage.py`, `shapes.py`, `materials.py`, `reference.mjs`, and the fitted tables
  beside `specs/488.json`
- `public/art/studio/forge/488/` - the frames
- `src/systems/studioArt/studioArt.js` `FORGE_FOLDER`, `isForgeRender`; `src/systems/textureReplacement.js` (an
  entry's `look`)
- `test/systems/studioArt/forge_sprites.test.js` - the spec's table, one picture a frame at its canvas, the palette
  snap on the forge's pictures only, grain 0, the reference kept out of the repo, and (ARENA2) the canvases against
  TEXTURE.488

## Open

- Only TEXTURE.488 is forged. The other class archives (475-490, and the guard's 399) need their own gear and specs.
- The overlap with Daggerfall's outlines averages 0.81 a record. Walk and idle are closest (0.81-0.86); attack
  0.77-0.82; hurt 0.76-0.82; the bow 0.76-0.78. The bow is furthest.
- In 34 of the 80 frames a few pixels of the axe, a hand or the helm fall past the canvas and are cut.
- The arms are fitted as thick as Daggerfall's outline asks, past the naked body's own girth.
- The body has no cloth folds, and no sculpted detail finer than its muscles' swells.
- Layered Gearing still draws the player from traced strips (`04-Characters/Layered-Gearing.md`). The forge could
  render its 27 outfits as layers instead.
