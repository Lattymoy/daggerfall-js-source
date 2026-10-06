# The Steel Plate - the port's own steel armour set

`tools/fbxStrip.mjs` + `tools/bakeSteelPlate.mjs` + `src/characters/ownArmorModels.js` (the steel plate's rows) +
`src/formats/mwItemMap.js` (composeWornArmor) + `src/formats/mwSkinTransfer.js` (fitShift, the sided transferSkin,
rebindSkin) + `src/formats/mwFirstPerson.js` (bindSkinnedFromBody) + `src/combat/fpArm.js` (ownBodyPaths,
ownBodyPart) + `src/systems/features.js` (the Steel Helm row)
(MW-STEEL1, Mac, 2026-10-06)

> "These 2 files are for the armor replacement of the morrowind steel armor with a varient to toggle the helmet type"

with two Blender exports (`New_Ship.fbx`, `New_Ship1.fbx`) and, one by one, the paintings: boots, gloves, shoulders,
breastplate, helmet faceplate, pants and helmet.

**The third of the port's own Morrowind models, and the first SET.** The Steel Brigandine
(`04-Characters/Steel-Brigandine.md`) put one worn piece on the Morrowind body; this is a whole suit of steel plate -
a breastplate, a pair of pauldrons, gauntlets, greaves and boots, and a helm two ways.

## Which items

Asked, Mac answered **Steel only**: Daggerfall's seven classic pieces in Steel (Cuirass 102, Gauntlets 103, Greaves 104,
Left and Right Pauldron 105 and 106, Helm 107, Boots 108) wear the plate in place of retail's `steel_*` records.
Silver and Elven, which wear Morrowind's steel because Morrowind has no silver armour (mwItemMap.js
DF_TO_MW_ARMOR_MATERIAL), keep retail's steel; every Roleplay & Realism Items piece keeps what it wore, and its Steel
Jerkin keeps the brigandine.

## The two files, read

**One scene twice.** Both exports carry the same twelve objects to the vertex - measured at import, every one bakes
byte for byte the same from either - and differ only in the helm: `New_Ship.fbx` an open nasal helm over a mail
aventail (`Sphere.002`), `New_Ship1.fbx` the same shell without the nasal (`Sphere`) and a second object, the visor and
a blue plume (`Sphere.001 Remeshed Remeshed`), painted from the faceplate texture.

**Its front is Morrowind's.** The boots' toes, the visor and the nasal all stand at +Y; Morrowind's actors face +Y, so
the bake keeps the scene's axes (`forward: '+y', up: '+z'` - the brigandine's scene faced -Y and was turned round).
+X is the actor's right; the names are no help to the side - the right gauntlet is the object called
`Imperial_Steel_Left_Gauntlet_20_Male`, standing at +X.

**It stands in a T-pose, and so does the skeleton.** The body in the scene is a Breton man out of a
"Morrowind_TPose_Models" pack, arms out level. Morrowind's base_anim.nif rests the same way - its main skeleton
"t-posing in the horizontal" while the clothing nodes stand like an idle's first frame (the OpenMW forum's reading of
the file; the port's own AUDIT-MAP2 record of the part nodes agrees) - and the transfer below is solved in that rest. So
the arm pieces need no re-posing: the T-posed gauntlet finds the T-posed forearm under it.

**One object is not the set's.** Under the breastplate the scene keeps a skirt of plates
(`Imperial_Silver_Cuirass_67_Male.011`, painted from a "steelpelvis" texture that never came). Asked, Mac: "That was
never apart of the set its just the breastplate and leg armor". It is stripped at import with the reference body
below (bakeSteelPlate.mjs `NOT_IN_SET`) and never baked; between the breastplate and the greaves the body's own groin
shows, as the set was drawn.

**The body it was fitted on is Morrowind's own.** Beside the armour the scene keeps two objects of that Breton -
his head (`Breton_Male.003`) and his neck (`Breton_Male.006`), wearing Morrowind's tx_b_n_breton_m_* pictures. They are
Bethesda's meshes, the port never ships Morrowind data, and a public repository publishes every file it commits, so
they are NOT committed: `tools/fbxStrip.mjs` takes them out at import (below). What the fit needs of them is their
bounds - twelve numbers, kept as ownArmorModels.js `STEEL_PLATE_SCENE`.

## The strip

`node tools/fbxStrip.mjs <in> <out> --drop=<Model>,...` - an FBX less some of its objects, every record that stays
copied BYTE FOR BYTE. tools/fbxRead.mjs decodes each property into a value and loses its type code (an int16, an int32
and a double all come back a Number), so a file written from that tree would be a different file wearing the same
numbers; the strip walks the records again at the byte level and copies each kept one as written - name, property
bytes (compressed arrays still compressed), children. What it rewrites: the end offsets (absolute positions, so every
record after a removal moves), the Connections that name a removed object, the Definitions counts, and the footer's
padding (Blender's encode_bin.py rule: to the next 16, a whole 16 when already there). A removed object takes what
hangs from it ALONE - geometry, material, texture, video - and a material a kept object also wears stays (the boots'
two objects share one). An object parented under a removed one is refused by name. An empty strip is the file, byte for
byte - pinned.

`node tools/bakeSteelPlate.mjs --import=<New_Ship.fbx>,<New_Ship1.fbx>` runs it on Mac's two exports: which is which is
read from the files (the open helm's object is in one), every shared object must bake the same from both, the reference
body is measured and printed for `STEEL_PLATE_SCENE`, and the two committed sources are written -
`src/assets/mw/source/Steel_Plate.fbx` (the whole set with the open helm, the head, the neck and the skirt not of the
set stripped) and
`Steel_Plate_Closed_Helm.fbx` (the closed helm and its visor alone; the shared pieces are the first's).

## The bake

`node tools/bakeSteelPlate.mjs` makes eleven meshes and seven textures under `src/assets/mw/` (a Data Files tree,
served by `systems/ownMwAssets.js` after the player's loose files and before every BSA, as the Thunderlock's and the
brigandine's are). Each piece is read out of the scene by its own object (`PIECES`), and each object must stand where
it was read - its scene box, to 0.02 - or the bake refuses it by name, so a re-export that renamed, moved or reshaped
one never ships a boot as a greave (bakeGalleon's ROLES boxes, the same lesson). Every mesh keeps the scene placement
(`placement: 'scene'`); every painting is mip-chained to an uncompressed DDS as the brigandine's is, the left and right
of a pair sharing one. The closed helm is ONE part of TWO shapes - a shell in the helm's painting, a visor in the
faceplate's - which `tools/nifWrite.mjs meshesToNif` writes (meshToNif is its one-shape case, and the Thunderlock and
the brigandine re-bake to the same bytes). `test/mwsteel1.test.js` re-makes every file from the committed sources byte
for byte and decodes each DDS back to its painting pixel for pixel.

## Where each piece goes

ownArmorModels.js gives each piece the ARMO_PART slots a retail piece of its shape fills, so the priority law and the
skin shadows are the ordinary path (composeWornArmor claims them at an armour's priority, as composeRefs claims a
record's):

| piece | slot(s) | also hides (`hides`) |
|---|---|---|
| Cuirass | cuirass (the breastplate) | - |
| Gauntlets | right hand, left hand | each its wrist and forearm |
| Greaves | right upper leg, left upper leg | - |
| Left / Right Pauldron | left / right pauldron | - |
| Helm | **hair** | - |
| Boots | right foot, left foot | each its ankle and knee |

`hides` is reserveIndividualPart's occupation - the slot claimed with no mesh, at the armour's priority - so the skin
under a vambrace or a boot's shaft is not drawn. The law stands over the plate as over retail's: a worn clothing skirt
reserves the groin and both upper legs at its higher priority and covers the greaves, and a robe the rest of what it
reserves. The helm takes the HAIR slot: the hair is hidden (the helmet-hides-hair rule, AUDIT 30 F1, by the slot itself) and the head is LEFT - the
open helm shows the face, and the closed one's eye slit looks onto it rather than through an empty helm.

## The fit: kept to the scene's own body

MW-BRIG3 learned that a modeller's scene is not the skeleton's rest, and fitted the brigandine by meeting its own top
to the chest's - its scene carried no body to measure. This one does, so a piece keeps its relation to THAT body
instead of to its own edges (a collar that rises up the neck stays risen). `fitShift` (mwSkinTransfer.js): a list of
rules, each naming a wearer's part, for each axis a feature of that part's rest-pose bounds ('min', 'max', 'centre'),
and the scene's bounds of the same part (or 'self', the piece's own, for a part the scene did not carry); the piece
moves by the wearer's feature less the scene's, a pure translation measured in the rest pose before the piece is
skinned. The rules:

- **The neck** - the breastplate, the pauldrons, the gauntlets and the greaves: across and front to back by
  its middle, up by its base. The one part of the scene's body every wearer has in the same place over the shoulders.
- **The head** - the helm: across by its middle, front to back by the back of the skull (noses differ, skulls far
  less), up by the crown. Heads differ by race and face; the neck would carry a helm to where the Breton's head was.
- **The feet** - the boots: up by the sole, the boot's lowest point to the foot's; across and front to back by the
  neck, so they stay under the greaves. Legs differ in length between the three skeletons, and a boot off the ground
  or sunk into it is the plainest error a body can show.

On a male body (base_anim.nif, the skeleton the scene's Breton stands on) the rules agree and reproduce Mac's fit
exactly, wherever his scene stood; on another skeleton each piece follows the part it hangs on. The build's notes say
what each piece was moved by ("fitted to the neck (xyz) - moved ..."), and with no such part the piece stays where the
scene put it and the note says that instead. The pins stand the plate on a T-posed body laid to the scene's proportions
and moved off them, with the neck and head built to the scene's measured bounds: every piece lands moved by exactly
that offset.

## Skinned from the body, each side its own

Each piece is skinned from the body under it (`skinFrom`, MW-BRIG2's transfer): the breastplate from the chest, groin
and upper arms; the gauntlets from the hand, wrist, forearm and upper arm; the greaves from the thighs, knees and
groin; the pauldrons from the upper arm and chest; the helm from the head; the boots from the foot, ankle and knee.

**A sided piece copies its own side** (`transferSkin`'s `side`, from the part's name). Without it the inner face of a
right greave could copy the left thigh where the two meet - measured on the fixture, where the thighs touch at x = 0
and a tie goes to the first source, the left - and stretch a triangle between the legs at every stride. A body vertex's
side is its HEAVIEST bone's ("Bip01 L Thigh", "Left Upper Leg" - boneSide), never where it stands; a vertex whose
heaviest bone is the pelvis or the spine serves both sides.

## The first person: solved on the third-person skeleton

The gauntlets are the one piece the first person keeps (fpWornAdds: the arm bones), and the hands are always on
screen. The first-person rig's rest is not the T-pose the plate was fitted in, and its hand is a different mesh
(`b_n_*_hands.1st`; the forearm and upper arm are the third person's - Morrowind-Rules.md, "retail gives a Nord male
ONE first-person arm record"). So the first person's own adds are skinned from the THIRD-person body and SOLVED ON THE
THIRD-PERSON SKELETON (`solveOn`), fitted by the same rules, and worn on the first-person rig by their bones' NAMES
(`rebindSkin`): a transferred skin is bone-relative, in graph space, and the bones are the same bones. The pin turns
the first person's arm away from the T-pose at rest and finds the gauntlet on its forearm exactly as on the third
person's; solved on that rest instead, the T-posed gauntlet binds to other parts. A bone the rig lacks is a null ref,
skipped as rule 40 skips one, and the note names it.

`combat/fpArm.js` reads the body under an own model in ONE place for both rigs - `ownBodyPaths` (the skin slots and
the fit's slots, shadowed or not) and `ownBodyPart` (their bytes, `fitTo`, `fit`, and `solveOn` when the rig differs).

## The Steel Helm switch

Mac's answers: a Features switch beside Weapon Sheathing, **closed by default**. `steel-helm` (systems/features.js,
group Combat, the port's own): pref `mwSteelHelm`, `closed` or `open` (ownArmorModels.js STEEL_HELM_STYLES - the
switch's values ARE the helm's styles). It is the VIEWER's, as the sheathing is: read where the worn set is composed
(fpArm.js, beside Show Nudity's weld), it is how this machine draws a steel helm - the player's and every peer's - and
it never reaches the wire. Thrown, the tile rebuilds the standing body at once (ui/enhancedMenu.js TILE_AFTER, whose
after-step a choice's write now takes as a switch's does); a peer's body takes it at its next build.

## Not done here

- **Not seen in game.** Every pin runs on a fixture body; the fit is measured on the player's own body at bind time and
  the notes say what it moved, so a piece that still sits wrong says how far it went.
- **The fixture's limbs are rigid**, so in the pins' poses a piece's triangles part where they change source (the
  top of a greave, on the groin, against the rest of it on the thigh); a retail body is skinned with weights blended
  across the hip, and the plate copies those blends. Whether the greaves' tops hold on a real stride is a thing to look
  at.
- **Women and beasts** wear the plate Mac fitted on a man: each piece follows the part it hangs on (the rules above),
  its shape is the one it was modelled with. Beast feet are not a Breton's.
- **The ground and icon pictures** of the Steel pieces still resolve to retail's steel meshes (MW-ASSIGN's icon path),
  as the brigandine's do. The worn body is what this changes.
- **The licence.** Three objects are named for the meshes they were modelled from (`Imperial_Silver_Cuirass_67_Male`,
  `Imperial_Steel_Left_Gauntlet_20_Male`, and `Breton_Male` for the greaves and pauldrons), and the paintings came from
  folders under Mac's Downloads; whether the geometry and the paintings are his own work or carry a licence of their own
  is **Mac's to confirm**, as the brigandine's is. The doctrine rows call them SUPPLIED and claim no more.
