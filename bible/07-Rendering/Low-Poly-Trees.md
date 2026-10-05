# Low Poly Trees - the mod, in 3D near and as its own picture far (LPT1, 2026-10-05)

**The owner's call (2026-10-05): "Next mod to integrate is this. Its
important we make this compatible with seasons of daggerfall, ensure
performance doesnt take a hit and draw distance can remain the same. A
true visual overhaul with no performance loss."** SquidKamer's (Kamer's)
**LowpolyTrees 5** for Daggerfall Unity: "Adds low poly trees to the
wilderness." Ledger row LPT1; the registry row and the permission line
(still to be recorded - `RECORD OPEN`) are `vendor/low-poly-trees/`'s.
Audited the same day (`01-Overview/Audit-Low-Poly-Trees.md`, AUDIT LPT).

## What the mod is

253 prefabs named `ARCHIVE_RECORD` - every nature archive, 500 to 511,
the winter sets among them - that DFU's `MeshReplacement` stands in
place of a nature flat, and nothing else: no script, no settings. 116
meshes (16 to 4,488 triangles: most a handful of crossed cards, some
true low-poly shells), 32 materials (SpeedTree's: a leaf card cut at its
`_Cutoff` and drawn on both faces, a trunk opaque and culled; two
`Standard` with `_Color` 0.8), 30 textures, every one Point-filtered. DFU
stands them in two places:

| DFU | what it does | the port |
|---|---|---|
| `TerrainNature.LayoutNature` -> `MeshReplacement.ImportNatureGameObject` | a terrain's nature flat, on the terrains within one map pixel of the player's: the prefab, turned at random and scaled 0.6-1.4 (its `TreeInstance.color` is set between white and `Color.grey`, but none of the mod's shaders reads it - AUDIT LPT C1); past that the classic flat | every terrain flat the mod has a tree for, at every distance: the 3D tree within 140 m of the eye, the same tree's FAR PICTURE beyond (below) - `world/lowPolyTrees.js lptVariety` the scale and turn |
| `RMBLayout` / World of Daggerfall's flats -> `ImportCustomFlatGameobject` | a location's nature flat: the prefab as it is, turned by `Random.InitState((int)position.x)` | the same, turned, never scaled (`lptVariety(.., location = true)`) |

## The textures are game data, so they are painted, never carried

Each of the mod's 30 textures is Daggerfall's own sprites: the five small
ones are classic records whole (501_19, 502_25, 502_30, 506_28 and
508_1), and each larger atlas is 75-91% classic records of
TEXTURE.500-511 copied texel for texel (upright or mirrored, cut down in
places, now and then turned) - beside the author's top-down crowns and
larger side views made from the same records. A render of game data IS
game data (`01-Overview/Port-Doctrine.md`), so `vendor/low-poly-trees/`
carries the geometry and a SPEC of each texture
(`tools/lowPolyTreesExtract.mjs` writes it from the shipped `.dfmod` and
an ARENA2, and checks every copied texel comes back):

- **blits** - a record, its orientation (one of eight), where it lands,
  the rectangle it may paint and where it must not (erase spans, each the
  whole gap between this copy's own claims, so none traces a record's
  silhouette - AUDIT LPT D13; LEB128-packed in `Trees/atlases.bin`); the
  first paint holds a texel.
- **fills** - the regions no record copies: the record they were made
  from and a coarse map of where they lie (8-texel cells, never their
  picture), painted as a crown folded out of the record (`synthTop`,
  snow-capped on the winter atlases), a mirrored tile of a crop of it, or
  the record stretched over the region (`fitRecord`) - whichever the tool
  found nearer the author's own. Near his, not his: the one place the
  port's tree is not the author's to the texel (measured below).

The game paints each atlas from the player's own TEXTURE files the first
time a tree needs it (`paintAtlas`, a step between the stream's breaths),
with an alpha-weighted mip chain (a clear texel never darkens a leaf's
edge at a distance), uploaded bottom-up like every picture of the port.
A record the player's data lacks leaves the classic flat (AUDIT LPT B9).

## Seasons of the Iliac Bay

While SIB re-skins a tree's OWN archive (`systems/seasonsIliacBay.js`:
504/506/508/510 in Fall and Spring, 505/507/509 in Winter), that tree's
atlases are painted under the season: each record of an archive SIB
re-skins now from **its** seasonal picture - resampled to the classic
record's size, since the spec addresses classic texels - and the rest
classic. A tree whose archive SIB leaves alone (the deserts, the swamps,
the rainforests, 511's snow) is painted from the classic records whatever
the season - so the 3D tree and its far picture turn exactly when its
flat does (AUDIT LPT C2). The source is keyed by the install
(`s<season>.<generation>`): a new install paints anew, a paint an install
overtook is never kept, and nothing seasonal is painted while an install
is refilling SIB's cache (`SeasonHelper.installing`, the port's - AUDIT
LPT B3). A pixel's trees draw from the source its far pictures were
painted from until SIB's re-skin rebuilds it. Without SIB, the climate's
winter swap (505/507/509/511) brings the mod's own winter prototypes,
snow-capped crowns and all. (In DFU the 3D trees never take SIB's season:
the mod's materials hold their own textures. Seasonal 3D trees are the
port's, following the flats they stand for - the owner's ask.)

## How it meets the port

**The door.** `systems/lowPolyTreesAssets.js` is the host's one door. A
prototype painted under a source is a HANDLE (`farPicture`): its atlases
and its far picture. A pixel HOLDS the handles its far pictures stand on
(`acquire` at its build, `release` when it goes - `destroyPixel` and
BUILD-FAIL1's ledger); a handle no pixel has held for `LPT_IDLE_S` (30 s)
gives its far picture back, an atlas no live handle reads gives its
texture back, and an atlas's 4 MB CPU picture is let go `LPT_PIC_IDLE_S`
(10 s) after a far picture was last drawn from it and painted again on
demand - EVERY ALLOCATION HAS AN OWNER (AUDIT LPT B5). The door itself is
the world's for the session, as the mills' parts are.

**Near: the mod's own 3D trees.** A pixel's tree set is made when it
comes into the eye's 3x3 (`buildTreeSet`) and let go past the 5x5. Each
frame the trees within `LPT_NEAR_M` (140 m) plus the band `LPT_BAND_M`
(20 m) of the eye - gathered again only when the eye moves
`LPT_REGATHER_M` (3 m), a pixel moves (a recentre), its set is made, or a
tree is felled (`scenes/treeHost.js FOREST_STAMP`) - are CULLED to the
view (`cullNear`: each tree's sphere against the frame's planes) and go
to the renderer as one instanced draw per handle's submesh
(`render/lowPolyTreesRender.js`: every mesh in one vertex and one index
buffer, the instances `[x, y, z, turn, scale]`). They are drawn by the
**billboard program itself** in its mesh mode (`renderer.js BB_VS
uMesh`), after the opaque flats, the last flat's own state put back first
(AUDIT LPT A1): lit, fogged, cloud-shadowed and swayed by the same code
under either lane. Each submesh brings its material: its atlas, its
`_Color`, its cut (its alpha brought to the flats' 0.5 - `uMeshAlpha`)
and its faces (a front-only material culls its backs as the world's
meshes do). A face is lit by the far picture's own law turned to the eye,
crossfaded to the sun's by its share of the day (`LPT_SUN_FULL`) - so at
night and across the band the tree and its picture are one picture
(AUDIT LPT A2).

**Far: the same tree's own picture.** Each prototype is drawn once from
the side with its own painted atlases (`renderImpostor`,
`LPT_IMPOSTOR_PER_M` texels a metre, its materials' cuts, colours and
faces, under `LPT_IMPOSTOR_LIGHT`), trimmed to what it draws, and
uploaded as a flat of its archive, `${record}#lpt${source}`. It stands
where the classic flat stood, in the pixel's billboard batch, out to the
land view's whole reach - **the draw distance is the flats', unchanged**:
the far rings' rule (MAC1) reads the flat's own height (`farH`), so they
stand exactly the trees they stood (AUDIT LPT B1) - each flat's own scale
carried on its corner (`renderer.js bbCornerX`, read back by BB_VS: a
classic flat's corner is its own, so every other flat is drawn as it
was).

**The handover.** Inside the radius the far picture gives way (its quad
leaves the clip volume); across the band the picture and the tree are
complementary screen-door shares over the port's one `bayer4`
(`render/lowPolyTreesGlsl.js`) - every pixel one of the two, never both,
never neither - and a handle not drawn this frame keeps its far picture
whole (`frame.cut` names only the handles drawn).

**What the flat still is.** The flat's cover (TACT1), its sway share
(WIND3), its Logging node, its forest (PROF4) and the far rings' rule
(MAC1) are the flat's own - read off the classic (or the season's) size,
never the tree's - so gameplay is the same with the mod off. A felled
tree's batch sinks as before and its 3D tree goes with it (`FELLED`); it
falls as its own far picture at its own size. The far pictures cast the
shadows at every distance (the shadow pass never cuts); the 3D trees cast
none of their own.

**The four hosts.** `scenes/world.js` and `scenes/exterior.js` are WIRED
(every flat of the `?exterior` host is a location's; its season is
installed once, before its flats, and it holds its handles for its life).
Which picture a nature flat stands as - the mod's far picture, the
season's, the record - is one choice every host asks
(`world/naturePicture.js`, AUDIT 05b A12: the yards had a third copy).
`scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` are
FLAGGED: they stand no terrain nature, and a dungeon block's rare nature
flat stays the flat (DFU stands the mod there too: S0000041.RDB, 15 of
its 21 nature flats - AUDIT LPT C8).

**A yard's placed trees** (DECOR-LPT, `01-Overview/Field-Bugs-2026-10-05b.md`).
An online home's yard stands its climate's trees and plants (DECOR-OUTDOOR,
`scenes/yardNature.js`); one the mod has a tree for stands as the world's
do. Its far picture is a batch of the yard's - sized for the tallest tree,
the piece's scale on its corner, `lptProto` its handle (no far height: a
yard's flats stand outside MAC1's rings, AUDIT 05b A9) - and the yard
HOLDS its handle while the piece stands; one landing after a recentre is
moved by it (AUDIT 05b A1). Its 3D tree is in the yard's own near set (`yardTreeSet`, a
pixel's shape) at the yard's place now (`scenes/homeYards.js treeSets`,
moved by a recentre with the pieces), which `lowPolyTreesFrame` gathers
with the pixels'. The piece's scale is the tree's (a location's tree is
the prefab at 1) and its turn the tree's (the record's yaw, the way a
model turns), so its picture never mirrors; its lean is its flat's,
recorded for its prototype as a pixel's is. The decorator's ghost asks the
same door (`yardNature.js picture`): the tree placed is the tree that
stands. The yards stand in `world.js` alone.

**Online.** The player's own (`systems/onlineLane.js
ONLINE_PLAYERS_OWN_MODS`): how a tree is drawn, where the same flat
stands.

**The switch.** Mods, `low-poly-trees` Enabled (on by default), read
once, when the world loads; `?trees=off` the kill door.

## Performance

What the trees add, by construction:

- **Near**: one instanced draw a handle's submesh (a climate's woods
  stand up to 38 submeshes - 504's 37 - and a 3x3 reaching two climates
  more), only the trees in view drawn. A wooded 3x3 gathers about a
  thousand trees (132-347 thousand triangles by climate); about two thirds
  are culled. A regather (0.3-0.7 ms) runs every 3 m of the eye; a frame
  between allocates nothing.
- **Far**: the flats' own cost, one quad a tree in the pixel's batch, on
  the rings MAC1 always drew. A far picture's quad is larger than the
  classic flat's - the mod's trees are larger (median 1.46 times the
  flat's height) - trimmed to what it draws (11% of its fill gone).
- **Painting** runs between the stream's breaths, each step about a
  millisecond warm: a blit or a fill, `LPT_MIP_TEXELS` of a mip level,
  `LPT_IMPOSTOR_TEXELS` or `LPT_IMPOSTOR_TRIS` of a far picture,
  `LPT_ATLAS_BAND` rows of an upload (AUDIT LPT B7). The session's first
  paints run before the engine has compiled the painters, several times
  slower, once.
- **Memory**: a 1024 atlas is ~5.6 MB of GPU memory with its chain; a
  climate's trees read 2 to 12 of them. They, and the far pictures, live
  while a standing pixel's trees use them (above).

Measured (2026-10-05, before the audit) in the headless game on
SwiftShader (software GL, so frame time is not a measurement - only the
counts and the script are), Daggerfall at land view 1, `?trees=off`
against the trees: draws 583 -> 628, script 15.2 -> 16.8 ms a frame over
eight one-second samples (noisy at one frame a second). The GPU's frame
time is the owner's machine's to measure: `HEADED=1 SCENES=city
TREES=off npm run perf` and again without `TREES=off`
(`tools/perfProbe.mjs` - the city scene is the same place every run).

## Translations recorded (not departures)

- DFU stands the classic flat past one terrain; the port stands the
  model's own far picture, so the wood is one look to the horizon and
  the view's reach is the flats'.
- The far picture is drawn once a prototype, side-on: it faces the eye
  as a flat does, so it does not turn with the tree's random yaw.
- The crossfade band is the port's; DFU's models simply appear at the
  terrain's edge.
- The atlases keep an alpha-weighted mip chain, sampled nearest (the
  mod's Point), where 23 of the mod's 30 textures have none: at a
  distance a chain-less Point texture shimmers.
- A 3D tree's faces are lit by the far picture's law at night and by the
  sun's by day (SpeedTree's own lighting is Unity's).
- A town tree is turned by where it stands; DFU seeds every tree of a
  block's column alike (`Random.InitState((int)position.x)`).
- The 3D trees take Seasons of the Iliac Bay's season, as their flats
  do; in DFU they never do.
- The fills (above) are near the author's, not his: of each larger atlas's drawn texels, 75.5-90.9% are copies (the five small pictures 100%), 8.4-22.0% fills - a fill's texel on average 155-290 of 765 off his colour - and 1.3-7.6% left clear; in the far pictures 25 of 253 trees differ from his past 50/765 or 5% of their texels (`01-Overview/Audit-Low-Poly-Trees.md`).

## Verification

`test/lpt1_lowpolytrees.test.js` (the pure module, the vendored data,
the far picture texel for texel, the shader's mesh mode, light, sway and
handover run in the GLSL evaluator, the draw on a recording GL, the door
with its ownership and its seasons, the hosts' wiring); TACT1's cover
sites; `tools/mutants/lpt1_trees.json`. The audit: `01-Overview/Audit-Low-Poly-Trees.md`.
