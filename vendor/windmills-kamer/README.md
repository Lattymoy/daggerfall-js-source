# Windmills of Daggerfall - rotor geometry (vendored, with permission)

`Blade.dae` from **"Windmills of Daggerfall" v2.0 by Kamer** (Daggerfall
Unity mod, GUID `aaac5c33-f615-444e-98fe-818b4a484b4c`), vendored
VERBATIM as exported.

**Permission: granted by the author, confirmed by Mac 2026-08-29.** That
is what makes these two files admissible where the roads took the other
route - the Ledger's "instead of taking their mod, I want us to develop
our own and better" was about not lifting someone's work uninvited, and
an invitation settles it.

## What is here, and what deliberately is NOT

Here: the one part that moves and can be drawn.

- `Blade.dae` - node `Blades`, geometry `model41600_001-mesh`. 20
  vertices, 26 triangles in two texture groups. A sail cross 34.08 wide
  x 34.09 tall x 3.31 thick, centred on the model origin (0.008, 0.006,
  -0.093), so THE HUB IS THE ORIGIN and the turning axis is the one it
  is flat in - Z. That is the same axis Kamer's `Spin_Up.cs` turns
  (`transform.Rotate(0f, 0f, -13 * Time.deltaTime, Space.Self)`), and
  the same axis `src/world/windmills.js` assumed before these files
  arrived.
`Roller.dae` was vendored alongside it for one commit and then removed:
it is the interior machinery `SpinTime_Roller.cs` turns about local X,
its three materials carry NO texture at all, and this port does not draw
the inside of a windmill. Vendoring a third party's file we cannot draw
and do not use is not attribution, it is clutter.

NOT here, and not because of the author:

- **The `.PNG` textures.** They are Daggerfall's own art exported to
  PNG, and the doctrine's second non-negotiable - a render of game data
  IS game data - is Bethesda's to waive, not Kamer's. They are also
  unnecessary: these meshes name the classic textures they want
  (`TEXTURE.000` record 77, `TEXTURE.067` record 1) and the port already
  loads those from the player's own ARENA2 at runtime, which is how
  every other model in the game is textured.
- **The mill body, the prefabs, the WorldData block overrides.** The
  tower is already in the player's ARENA2 as model 41600 and the port
  already draws it. What the port lacked was a rotor that turns.

## Coordinates

The mesh data is used AS EXPORTED. Blender writes `up_axis Z_UP` and
bakes the object transform into the node matrix, and that matrix
(`x, y, z -> x, -z, y`) composed with the standard Z-up-to-Y-up
conversion is the IDENTITY - so these coordinates are already in the
port's Y-up world units, and `scripts/bakeWindmill.mjs` applies no
transform at all. Verified numerically by the bake, which fails if the
sail is not flat in exactly one axis.

Provenance: `WindMills.rar`, supplied by Mac 2026-08-29. Author contact
per the mod manifest: DFU Discord.
