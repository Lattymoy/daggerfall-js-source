# Windmills of Daggerfall - the mill (vendored, with permission)

`Blade.dae` and `Windmill.dae` from **"Windmills of Daggerfall" v2.0 by
Kamer** (Daggerfall Unity mod, GUID
`aaac5c33-f615-444e-98fe-818b4a484b4c`), vendored VERBATIM as exported,
plus `placements.json` - the six spots he chose to stand them.

**Permission: granted by the author, confirmed by Mac 2026-08-29.** That
is what makes these files admissible where the roads took the other
route - the Ledger's "instead of taking their mod, I want us to develop
our own and better" was about not lifting someone's work uninvited, and
an invitation settles it.

## A note on `interior.json`, which is different from the rest

Everything else in this folder is **Kamer's own work** - his geometry,
his choice of where to stand it, his climate skins. `interior.json` is
not: it is **Daggerfall block data**, 16 interior models with their
flats, markers and a person, in the game's own record shapes.

It is here on **Mac's explicit call, 2026-08-29** - asked twice and
answered "Put it in" - and it is on the Port-Ledger as an approved
departure. It is called out here so that nobody reading this folder
later mistakes it for more of the author's work.

## What is here, and what deliberately is NOT

Here: the mill, and where it stands.

- `Blade.dae` - node `Blades`, geometry `model41600_001-mesh`. 20
  vertices, 26 triangles in two texture groups. A sail cross 34.08 wide
  x 34.09 tall x 3.31 thick, centred on the model origin, so THE HUB IS
  THE ORIGIN and the turning axis is the one it is flat in - Z. That is
  the same axis Kamer's `Spin_Up.cs` turns
  (`transform.Rotate(0f, 0f, -13 * Time.deltaTime, Space.Self)`), and
  the same axis `src/world/windmills.js` assumed before these files
  arrived.
- `Windmill.dae` - node `House`, geometry `model118-mesh` (his
  `New_Windmill 2.dae`, the body the `41600.prefab` composes with the
  sail). 332 triangles in five texture groups. **WM2d added this**, and
  the reason it was not here at WM2a is worth keeping: WM2a believed
  Daggerfall's own farm blocks already stood a tower for the sail to
  hang on, so only the sail was taken. They do not - see below - so the
  port needs his tower too.
- `placements.json` - the six placements, and ONLY the added record from
  each block. See the note inside it.

Its five materials carry no texture in the DAE; they are bound in the
Unity prefab's `m_Materials`, in the DAE's own triangle order, through
`.mat` files whose names ARE the classic (archive, record) pair:
Walls 364_2, Plank 067_1, Roof 369_3, Windmill 067_1, Door 332_0. The
bake takes that mapping explicitly and REFUSES any material the map does
not name, because a silently untextured submesh draws as garbage.

**AND THE OVERRIDES SETTLED THE QUESTION THAT STALLED THE ARC.** WM2a
read model 41600 out of his `WorldData/*.RMB.json` and concluded the
port already drew a tower. Backwards: a DFU WorldData override REPLACES
a block, and his are his own. `FARMAA01.RMB.json` declares
`NumBlockDataRecords: 1` and carries TWO subrecords; `FARMAA00.RMB.json`
declares 7 and puts the mill in subrecord 7. The extra subrecord in each
is the mill he ADDS - as his mod's description says outright, "Adds
Windmills to some farms". Classic Daggerfall stands no windmill at all.

NOT here, and not because of the author:

- **The `.PNG` textures.** They are Daggerfall's own art exported to
  PNG, and the doctrine's second non-negotiable - a render of game data
  IS game data - is Bethesda's to waive, not Kamer's. They are also
  unnecessary: both meshes name the classic textures they want and the
  port already loads those from the player's own ARENA2 at runtime,
  which is how every other model in the game is textured.
- **The WorldData blocks themselves.** Each carries a WHOLE RMB block -
  Daggerfall's layout - which is game data. Only the added placement
  record travels, in `placements.json`.
- **`Roller.dae`, and the prefabs.** The roller is interior machinery
  whose three materials carry no texture at all, and this port does not
  draw the inside of a windmill; the strict reader rejected it outright
  rather than baking a mesh with nothing to sample. Vendoring a third
  party's file we cannot draw and do not use is not attribution, it is
  clutter.

## Coordinates - AND THE HANDEDNESS

**Collada is right-handed; Unity is left-handed, and every number in
this folder is written in UNITY's space** - the prefab hub offset, the
placements, all of it, because that is where the author worked. Unity's
model importer negates X on the way in, and `scripts/bakeWindmill.mjs`
does the same so those numbers are usable verbatim. Normals are mirrored
and triangle winding reversed with it: a mirror turns every face inside
out and the renderer culls back faces.

WM2a shipped without that and it cost both of the faults in Mac's first
screenshot - a sail hanging in mid-air beside the mill (its hub applied
at x +3.96 to a body whose cap sat at the mirrored x -3.95) and a tower
standing off its spot (mirroring bounds that are not symmetric about
their origin, -12.06..3.89, swings the mass eight units).

The Z-up part is separate and needs nothing: Blender writes
`up_axis Z_UP` and bakes the object transform into the node matrix, and
that matrix (`x, y, z -> x, -z, y`) composed with the standard
Z-up-to-Y-up conversion is the IDENTITY. The bake ASSERTS the node
matrix it expects, so a re-export rotated differently fails here instead
of turning the sails into a ceiling fan.

Provenance: `WindMills.rar`, supplied by Mac 2026-08-29. Author contact
per the mod manifest: DFU Discord.
