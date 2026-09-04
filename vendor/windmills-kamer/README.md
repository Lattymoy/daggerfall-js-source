# Windmills of Daggerfall - the mill (vendored, with permission)

`Blade.dae` and `Windmill.dae` from **"Windmills of Daggerfall" v2.0 by
Kamer** (Daggerfall Unity mod, GUID
`aaac5c33-f615-444e-98fe-818b4a484b4c`), vendored VERBATIM as exported,
plus `placements.json` - the seven spots he chose to stand them.

**Permission: granted by the author, confirmed by Mac 2026-08-29.** That
is what makes these files admissible where the roads took the other
route - the Ledger's "instead of taking their mod, I want us to develop
our own and better" was about not lifting someone's work uninvited, and
an invitation settles it.

## A note on `interior.json`

An earlier version of this README called `interior.json` "Daggerfall
block data" rather than the author's work, and filed it as a doctrine
departure. **That was wrong, and Mac said so: "why not his own work?
that was the whole point."**

It is his room, and the evidence is checkable:

- **The subrecord does not exist in the block Daggerfall ships.** He
  added it - `FARMAA01`'s file declares one subrecord and carries two,
  `FARMAA00`'s declares seven and puts the mill in the eighth.
- **It matches no other subrecord's interior in the same block**, so it
  is not a copy of the farmhouse standing beside it.
- **The room is about 12.4 x 12.2 world units**, which fits inside his
  own mill body (16 x 27 x 18). It was built to the mill.
- **Its centrepiece is model 41601** - the machinery he modelled AND
  animated himself (`41601.dae`, with the roller `SpinTime_Roller.cs`
  turns). A room built around his own moving part is not a room copied
  from somewhere else.

So it is the same kind of thing as `placements.json`: a list of model
ids and coordinates the author chose. The ids are Daggerfall's, exactly
as they are in every placement list this port already ships - naming a
model is not shipping one, and no Daggerfall art or bytes are here.

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
- `placements.json` - the seven placements, and ONLY the added record from
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
- **The prefabs, the `.mat` files, and the parts outside his manifest.**
  The prefab and material files are Unity's format; what they SAY is
  written down here as data (`variants.json`, `machinery.json`). And
  `11511.prefab`, `11512.dae`, `WindNoDoor.dae`, `Door.dae`,
  `41600 1/2/4.prefab`, `LoadWindmill.cs` are not in
  `WindMills.dfmod.json`'s Files list, so DFU never loads them.

An earlier version of this list left out `Roller.dae` as "three
materials with no texture at all". That was read off the DAE; the
PREFAB binds 067_1 / 091_2 / 091_3 to it. WM4b (2026-08-30) vendors the
machinery whole:

- `41601.dae` - node `House`, geometry `model41601_003-mesh`, 722
  triangles in eight texture groups: the machinery his room is built
  around. Materials from `41601.prefab`: Wall 366_0, Wheel 091_2,
  WheelSide 091_3, Roof 166_4, Wood 067_1, Door 332_0, Floor 124_2,
  Mill 091_3.
- `Plank_Gear.dae` - node `Spin_Beam1`, 6 triangles, one drawn material
  (067_1) of nine declared. The prefab's child `Plank_Gear` at
  (11.02, 4.49, -2.28), rotation (0.5, 0.5, -0.5, 0.5), carrying
  `Spin_Up.cs` - his sail script - so it turns -13 deg/s about its own Z.
- `Roller.dae` - node `Roller`, 34 triangles, 067_1 / 091_2 / 091_3.
  The child `Roller` at (9.64, -7.14, -2.21), rotation
  (-0.7071, 0, 0, 0.7071), carrying `SpinTime_Roller.cs`: +13 deg/s
  about its own X, with a MeshCollider.
- `machinery.json` - the above, as data, with the note on why these two
  parts bake with their node matrix IGNORED: his prefab references the
  mesh asset directly, so Unity never applied it either.

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
