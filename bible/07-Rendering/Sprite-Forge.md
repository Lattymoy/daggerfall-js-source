# Sprite Forge

The forge makes the game's own class sprites. It renders a 3D fighter of its own in Blender into every record and
frame of a Daggerfall class sprite archive, at each record's own size. The game wears those frames through the studio
in place of Daggerfall's. TEXTURE.488 is the first: the male medium fighter that the Monk, Barbarian, Warrior and
Knight enemies wear.

## How it works

- **The fighter.** `tools/sprite-forge/model.py` builds a body of rigid parts: lofted rings, shells and cut plates
  (`tools/sprite-forge/shapes.py`). Each part hangs on one joint of the tree in `tools/sprite-forge/rig.py`. He wears a
  silver helm and pauldrons over a mail coif, a dark cuirass, mail legs, a green loincloth, teal cuffed boots and
  bracers. He holds a double-bit war axe, or a long bow. The mail is a diamond lattice wrapped round each limb's own
  axis (`tools/sprite-forge/materials.py` `chain`), so it rides the part and never swims.
- **The poses.** `tools/sprite-forge/poses.py` keys walk (4 frames), attack (6), hurt (1), idle (1) and bow (4). An arm
  reaches its grip by two-bone IK (`solve_arm`), so the axe's place drives the hands. Daggerfall turns the body
  differently in each view of the attack: from the side its back is to the viewer at the wind-up. So the attack is
  keyed per view (`ATTACK`), by where the fist and the axe head show on screen. The archer stands side-on to the shot
  in every view (`BOW_TURN`).
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
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --register /tmp/forge-ref-488.json --out /tmp/x
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --out public/art/studio/forge/488
```

Registering is needed only after a pose changes. `--records 0,5` limits a run; `--work` writes uncropped renders.

## Rules

- The forge's sprites are the game's own. They are rendered from the forge's models, never traced or repainted from
  a record. The outlines that place the body never enter the repo (Port-Doctrine).
- They match Daggerfall's class sprites as closely as the forge can: the same records, frames, canvases, views,
  poses, gear and palette (Mac).
- The palette is the player's own, laid on as each picture is decoded (DF-Art).

## Daggerfall Unity

DFU draws the class enemies from TEXTURE.475-490 (`MobileEnemy` `MaleTexture`, `FemaleTexture`), and a texture pack
replaces a record by its name. The forge's frames go in by that same door. Only the art departs: DFU's records, frame
tables and sizes are read as they are.

## Code and tests

- `tools/sprite-forge/` - the forge: `forge.py`, `model.py`, `rig.py`, `poses.py`, `stage.py`, `shapes.py`,
  `materials.py`, `reference.mjs`, `specs/488.json`
- `public/art/studio/forge/488/` - the frames
- `src/systems/studioArt/studioArt.js` `FORGE_FOLDER`, `isForgeRender`; `src/systems/textureReplacement.js` (an
  entry's `look`)
- `test/systems/studioArt/forge_sprites.test.js` - the spec's table, one picture a frame at its canvas, the palette
  snap on the forge's pictures only, grain 0, the reference kept out of the repo, and (ARENA2) the canvases against
  TEXTURE.488

## Open

- Only TEXTURE.488 is forged. The other class archives (475-490, and the guard's 399) need their own gear and specs.
- The overlap with Daggerfall's outlines averages 0.55 a record. Walk and idle are best (0.56-0.71). Hurt (0.41-0.52)
  and the bow's three-quarter views (about 0.37) are furthest.
- In about half the frames a few pixels of the axe, a hand or the helm fall past the canvas and are cut.
- The body is simpler than Daggerfall's: smooth tubes, with no sculpted muscle or cloth folds.
- Layered Gearing still draws the player from traced strips (`04-Characters/Layered-Gearing.md`). The forge could
  render its 27 outfits as layers instead.
