# Sprite Forge

The forge makes the game's own class sprites. It renders a 3D fighter of its own in Blender into every record and
frame of a Daggerfall class sprite archive, at each record's own size. The game wears those frames through the studio
in place of Daggerfall's. TEXTURE.488 is the first: the male medium fighter that the Monk, Barbarian, Warrior and
Knight enemies wear.

## How it works

- **The fighter.** `tools/sprite-forge/model.py` builds the body from smooth lofts of measured cross-sections
  (`tools/sprite-forge/body.py` `vloft`): each row a height, a half width, front and back depths, and swells for the
  pecs and abs. The torso is the armour's own surface: the cuirass above the belt, mail below it. The legs are the
  mail; the arms are skin with the bracers in them. These parts bend at elbow, knee, hip and waist by the forge's
  own linear-blend skinning (`Skinned`). The helm, pauldrons, boots, belt, loincloth, face and hands (open, or closed
  round a grip) are rigid on one joint each (`tools/sprite-forge/rig.py`).
- **Patterns.** Every mesh keeps its rest position as a `rest` attribute, which the patterns read
  (`tools/sprite-forge/materials.py`). The mail is a diamond lattice round each limb's own axis (`chain`). A lattice
  or a fleck stays on its texel however the body bends.
- **The poses.** `tools/sprite-forge/poses.py` keys walk (4 frames), attack (6), hurt (1), idle (1) and bow (4). An arm
  reaches its grip by two-bone IK (`solve_arm`), so the axe's place drives the hands. Daggerfall turns the body
  differently in each view of the attack: from the side its back is to the viewer at the wind-up. So the attack is
  keyed per view (`ATTACK`), by where the fist and the axe head show on screen. The archer stands side-on to the shot
  in every view (`BOW_TURN`).
- **Fitting.** `tools/sprite-forge/fit.py` adjusts each frame's keyed pose until the body covers the record's outline
  and its colour regions best: skin, boot teal and cloth green. It turns joints, the body and the axe's grip. It sees
  the body as points strewn over its surfaces, posed and projected as the camera does, so a frame takes seconds. The
  adjustments are kept in `tools/sprite-forge/specs/488-fit.json` as numbers; `poses.py` `load_fit` lays them on.
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
python -I tools/sprite-forge/fit.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --register /tmp/forge-ref-488.json --out /tmp/x
python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --out public/art/studio/forge/488
```

Fitting needs `scipy` beside `bpy`. Fit and register again after the body or a key changes. `--records 0,5` limits a
run; `--work` writes uncropped renders.

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

- `tools/sprite-forge/` - the forge: `forge.py`, `fit.py`, `model.py`, `body.py`, `rig.py`, `poses.py`, `stage.py`,
  `shapes.py`, `materials.py`, `reference.mjs`, `specs/488.json`, `specs/488-fit.json`
- `public/art/studio/forge/488/` - the frames
- `src/systems/studioArt/studioArt.js` `FORGE_FOLDER`, `isForgeRender`; `src/systems/textureReplacement.js` (an
  entry's `look`)
- `test/systems/studioArt/forge_sprites.test.js` - the spec's table, one picture a frame at its canvas, the palette
  snap on the forge's pictures only, grain 0, the reference kept out of the repo, and (ARENA2) the canvases against
  TEXTURE.488

## Open

- Only TEXTURE.488 is forged. The other class archives (475-490, and the guard's 399) need their own gear and specs.
- The overlap with Daggerfall's outlines averages 0.70 a record. Walk and idle are closest (0.72-0.78); the hurt
  views (0.58-0.72) and the bow's three-quarter views (0.57-0.62) are furthest.
- In 45 of the 80 frames a few pixels of the axe, a hand or the helm fall past the canvas and are cut (15 at the
  median).
- The body is smooth lofts: it has no fingers, cloth folds or sculpted detail finer than the pecs and abs.
- Layered Gearing still draws the player from traced strips (`04-Characters/Layered-Gearing.md`). The forge could
  render its 27 outfits as layers instead.
