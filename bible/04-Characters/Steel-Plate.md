# The Steel Plate - the port's own steel armour set

`tools/fbxStrip.mjs` + `tools/bakeSteelPlate.mjs` (the bake, the bind, the rig) + `tools/skinWeights.mjs` (jointWeights) +
`tools/nifWrite.mjs` (skinnedMeshesToNif) + `src/characters/ownArmorModels.js` (the steel plate's rows) +
`src/formats/mwItemMap.js` (composeWornArmor) + `src/systems/features.js` (the Steel Helm row)
(MW-STEEL1, Mac, 2026-10-06; MW-STEEL2, the skirt, 2026-10-07; MW-STEEL4, rigged as retail's armour is, 2026-10-07 -
it retired the runtime rig MW-STEEL1 to MW-STEEL3 built, recorded below)

> "These 2 files are for the armor replacement of the morrowind steel armor with a varient to toggle the helmet type"

with two Blender exports (`New_Ship.fbx`, `New_Ship1.fbx`) and, one by one, the paintings: boots, gloves, shoulders,
breastplate, helmet faceplate, pants and helmet.

**The third of the port's own Morrowind models, and the first SET.** The Steel Brigandine
(`04-Characters/Steel-Brigandine.md`) put one worn piece on the Morrowind body; this is a whole suit of steel plate -
a breastplate and the skirt under it, a pair of pauldrons, gauntlets, greaves and boots, and a helm two ways.

**It ships skinned, as Morrowind's own armour does** (MW-STEEL4): every piece's NIF carries its weights to the Bip01
bones and their inverse binds, made once at bake time, and the game wears it on the very path it wears a retail
armour mesh. Nothing about the plate is solved while the game runs.

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

**It stands in a T-pose, and the T-pose is Morrowind's bind.** The body in the scene is a Breton man out of a
"Morrowind_TPose_Models" pack, arms out level. Retail's skeleton does not REST so - the vendored retail hierarchy
(`vendor/weapon-sheathing/.../xbase_anim_sh.nif`) stores the idle's first frame in its node transforms, the arms
hanging, the right leg forward - but its skins are BOUND so: the file's own "Tri Shadow" binds all 32 Bip01 bones in
a T-pose, the hands level with the shoulders and 46.6 out. That bind is what the plate is skinned in (below).

**The skirt is the set's.** Under the breastplate the scene keeps a skirt of plates
(`Imperial_Silver_Cuirass_67_Male.011`, painted from a "steelpelvis" texture). MW-STEEL1 stripped it - its painting had
never come, and Mac had said "That was never apart of the set its just the breastplate and leg armor". On 2026-10-07 Mac
sent it (MW-STEEL2): "This is the missing texture for the morrowind steel armor's skirt", with the two exports again.
It is baked, the Steel Cuirass's second part (below).

**The body it was fitted on is Morrowind's own.** Beside the armour the scene keeps two objects of that Breton -
his head (`Breton_Male.003`) and his neck (`Breton_Male.006`), wearing Morrowind's tx_b_n_breton_m_* pictures. They are
Bethesda's meshes, the port never ships Morrowind data, and a public repository publishes every file it commits, so
they are NOT committed: `tools/fbxStrip.mjs` takes them out at import (below). Their bounds - twelve numbers - are kept
as `tools/bakeSteelPlate.mjs` SCENE_BODY, the evidence the scene's frame is read against (below).

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
body is measured and printed for SCENE_BODY, and the two committed sources are written -
`src/assets/mw/source/Steel_Plate.fbx` (the whole set with the open helm and the skirt, the head and the neck
stripped) and
`Steel_Plate_Closed_Helm.fbx` (the closed helm and its visor alone; the shared pieces are the first's).

## The bake

`node tools/bakeSteelPlate.mjs` makes twelve meshes and eight textures under `src/assets/mw/` (a Data Files tree,
served by `systems/ownMwAssets.js` after the player's loose files and before every BSA, as the Thunderlock's and the
brigandine's are), from the two sources, the eight paintings and retail's skeleton. Each piece is read out of the scene
by its own object (`PIECES`), and each object must stand where it was read - its scene box, to 0.02 - or the bake
refuses it by name, so a re-export that renamed, moved or reshaped one never ships a boot as a greave (bakeGalleon's
ROLES boxes, the same lesson). Every mesh keeps the scene placement (`placement: 'scene'`) and is skinned (the rig,
below); every painting is mip-chained to an uncompressed DDS as the brigandine's is, the left and right of a pair
sharing one. The closed helm is ONE part of TWO shapes - a shell in the helm's painting, a visor in the faceplate's.
`test/mwsteel1.test.js` re-makes every file from the committed sources and the vendored skeleton byte for byte and
decodes each DDS back to its painting pixel for pixel.

## The rig: skinned at bake time, as retail's armour is

Retail Morrowind ships its armour skinned: each piece's NIF carries its own weights to the Bip01 bones and its own
inverse binds, made once by the modeller, and the engine only reads them (Morrowind-Rules.md rules 12, 19 and 20).
The plate came as static meshes on a T-posed body, so the bake does the modeller's step.

**The bind is retail's own.** `retailBind` reads the vendored skeleton's Tri Shadow - skinned over the whole Bip01
chain with an identity skin transform on an identity shape, never drawn (rule 59) - and each bone's inverse bind,
undone, is where that bone stood when retail's skins were bound. A skeleton whose shadow is missing, or moved, turned
or scaled, is refused.

**The scene stands on it, measured.** The Tri Shadow's frame is its own (the pelvis 22 units under its origin) and the
scene's is Blender's (the soles on z = 0); their axes agree, both upright and facing +Y, and the scene is the bind
moved by `SCENE_FROM_BIND` = (0, 2.5, 98.55). The T-posed Breton's own meshes are not here to read, so the number is
read off the pieces against the bones: the forearm's bone line runs through the middle of each gauntlet's cuff (its
cross-sections centred 2.6 to 3.0 in front of the line and 98.3 to 98.8 above it, x 34 to 46, where the cuff is a clean
tube); the neck bone stands mid-neck in SCENE_BODY's neck (its centre 1.9 in front of the bind's); and the bind's
pelvis stands at the idle's height (76.37, which is the 98.55), putting the ankle bone 6.6 over the scene's floor (6.8
over the boots' lowest point) as it stands 6.8 to 7.0 over the floor in the idle. Across, nothing: the bind and the plate are both mirrored about x = 0.
The pins hold each of those, and a unit's error either way fails them.

**The weights are a rigger's** (`tools/skinWeights.mjs` jointWeights). Each piece names its own bones - a modeller's
vertex groups, `PLATE_RIG` - each a segment in the bind from its origin to where it ends (its child's origin, or for
a bone that ends in nothing a point in its own frame: the hand at its knuckles, a finger 2.5 past its last joint, the
foot at its ball, the head at its crown). Each vertex goes to the segment it is nearest, and blends across a JOINT
with the bone on the other side - a smoothstep across the joint's plane, `blend` units either side - and nowhere else,
so the steel keeps its shape between joints and folds across a joint's width:

| piece | its bones (a joint's blend, units) | shape |
|---|---|---|
| breastplate | the pelvis, the spine (3), spine1 (3), spine2 (3), the neck (2); the clavicles at its shoulders (2) | `Tri Chest` |
| skirt | HANGS: the pelvis alone at the waist (z 84), the thighs' share growing to 0.7 at the hem (z 64.5), split left and right across 4 units of the middle | `Tri Groin` |
| pauldron | the clavicle at its root, the upper arm it covers (2.5) | `Tri Right Clavicle` / `Tri Left Clavicle` |
| gauntlet | the forearm under its cuff, the hand (1.5), and the three fingers Morrowind's hand has - the thumb and two pairs, each of two joints (1, 0.75) - so its fingers close as the hand's do | `Tri Right Hand` / `Tri Left Hand` |
| greave | the thigh and, past the knee, the calf (3) | `Tri Right Upper Leg` / `Tri Left Upper Leg` |
| boot | the thigh at its top (it stands over the knee), the calf (3), the foot past the ankle (2) | `Tri Right Foot` / `Tri Left Foot` |
| helm | the head alone - rigid on the skull, as a helmet is | `Tri Hair` (the closed helm's visor `Tri Hair 1`) |

Welded vertices (one position, split by a seam in the UVs or the normals) are weighted once and share the answer, so
no seam opens under a pose. A vertex carries one bone or a joint's two (a hanging one up to three), normalised to 1.
The law is pure arithmetic, so the bake is the same bytes on every machine.

**The file is a retail piece's shape** (`tools/nifWrite.mjs` skinnedMeshesToNif). Each shape a NiSkinInstance over the
bones it weights and a NiSkinData of their inverse binds (the bind undone, mesh space to bone space, as rule 19 reads
it), an identity skin transform and its weights; the shape NAMED for the slot it fills, because rule 15's filter picks a
skinned part's geometry by that name ("Tri Right Hand 0" passes for the right hand, nothing for the left; the helm
fills the HAIR slot, whose filter is the word "hair"). The bones stand as nodes under the root at their binds, after
every shape, so the file is its own bind pose and a tool that skins it against its own nodes draws it where Mac put it.

**Worn, it is a retail part.** composeWornArmor claims each piece's slots at an armour's priority and hands the build
its mesh alone - no `skinFrom`, no fit - and bindPartsInto binds it on the skinned branch every retail body part and
armour piece takes: rebound onto the wearer's skeleton by its bones' NAMES (rule 12, never parented to a bone), drawn by
skinBatch (rule 20) in whatever pose the animation gives. The third-person body, every peer's and the first person's
gauntlets (fpWornAdds keeps the hands) are the one door; on the first-person rig the gauntlets ride its forearm, hand
and finger bones by name, whatever that rig's rest. A bone a rig lacks is rule 40's skipped influence, said on the
card. Women and beast races wear the plate as they wear retail's armour: it follows their bones.

## Where each piece goes

ownArmorModels.js gives each piece the ARMO_PART slots a retail piece of its shape fills, so the priority law and the
skin shadows are the ordinary path:

| piece | slot(s) | also hides (`hides`) |
|---|---|---|
| Cuirass | cuirass (the breastplate) and skirt (the plates under it) | - |
| Gauntlets | right hand, left hand | each its wrist and forearm |
| Greaves | right upper leg, left upper leg | - |
| Left / Right Pauldron | left / right pauldron | - |
| Helm | **hair** | - |
| Boots | right foot, left foot | each its ankle and knee |

`hides` is reserveIndividualPart's occupation - the slot claimed with no mesh, at the armour's priority - so the skin
under a vambrace or a boot's shaft is not drawn. The law stands over the plate as over retail's: a worn clothing skirt
reserves the groin and both upper legs at its higher priority and covers the greaves, and takes the skirt slot from the
plate skirt; a robe the rest of what it reserves. The plate skirt shadows nothing (ARMO_PART's skirt row): the groin
skin stays under it. The helm takes the HAIR slot: the hair is hidden (the helmet-hides-hair rule, AUDIT 30 F1, by the
slot itself) and the head is LEFT - the open helm shows the face, and the closed one's eye slit looks onto it rather
than through an empty helm.

## The Steel Helm switch

Mac's answers: a Features switch beside Weapon Sheathing, **closed by default**. `steel-helm` (systems/features.js,
group Combat, the port's own): pref `mwSteelHelm`, `closed` or `open` (ownArmorModels.js STEEL_HELM_STYLES - the
switch's values ARE the helm's styles). It is the VIEWER's, as the sheathing is: read where the worn set is composed
(fpArm.js, beside Show Nudity's weld), it is how this machine draws a steel helm - the player's and every peer's - and
it never reaches the wire. Thrown, the tile rebuilds the standing body at once (ui/enhancedMenu.js TILE_AFTER, whose
after-step a choice's write takes as a switch's does); a peer's body takes it at its next build.

## Not done here

- **Not seen in game yet** - no retail data is in the tree. Every pin stands on retail's own skeleton (the vendored
  hierarchy, its rest and its Tri Shadow), and the plate is worn on the path retail's own armour is worn on, which the
  game has drawn since MW-D20 (Mac's retest: "hands PERFECT"); what is the plate's own is the bind's
  placement under it (SCENE_FROM_BIND, read to about a unit) and the weights.
- **The weights are geometric** - a rigger's law, not an artist's painting. If a joint folds badly in play, the
  piece's bones and blends in `PLATE_RIG` are where to look, and a re-bake is the whole fix.
- **The first person's finger bones** are assumed on its rig, as retail's .1st hands use them; if a rig lacks one, the
  card names it (rule 40) and those finger vertices collapse - which is exactly what the note is for.
- **Women and beasts** wear the plate Mac fitted on a man, skinned to their own bones as retail's armour is. Beast feet
  are not a Breton's, and the port does not keep boots off them (retail's does not apply here either).
- **The ground and icon pictures** of the Steel pieces still resolve to retail's steel meshes (MW-ASSIGN's icon path),
  as the brigandine's do. The worn body is what this changes.
- **The brigandine** is still rigged at runtime (MW-BRIG2/3 - skinned from the body under it, fitted to the chest); it
  could be baked the same way.
- **The licence.** Three objects are named for the meshes they were modelled from (`Imperial_Silver_Cuirass_67_Male`,
  `Imperial_Steel_Left_Gauntlet_20_Male`, and `Breton_Male` for the greaves and pauldrons), and the paintings came from
  folders under Mac's Downloads; whether the geometry and the paintings are his own work or carry a licence of their own
  is **Mac's to confirm**, as the brigandine's is. The doctrine rows call them SUPPLIED and claim no more. The skins'
  inverse binds are the vendored skeleton's binds, Greatness7's Weapon Sheathing skeleton (credited, free to use for
  Morrowind projects).

## MW-STEEL1 to MW-STEEL3: the runtime rig (RETIRED by MW-STEEL4)

The plate shipped as static meshes for its first day, and each session rigged it AT RUNTIME against the player's own
body:

- **MW-STEEL1** (2026-10-06) fitted each piece onto the wearer by the scene's measured neck, head and feet (`fitShift`)
  and skinned it from the body part under it, each vertex copying the nearest body vertex's skin (MW-BRIG2's transfer,
  with a side); the first person's gauntlets were solved on the third-person skeleton and rebound by name. It solved in
  the skeleton file's REST, taking it for a T-pose - Mac: "The new steel armor T-poses ingame".
- **MW-STEEL2** (2026-10-07) found the rest is the idle's frame and recovered the BIND from the skins at runtime
  (`bindPoseMats`: P_c = P_b o IB_b o IB_c^-1 through a skin, anchored at its root-most bone), and baked the skirt.
- **MW-STEEL3** (2026-10-07; Mac: "Morrowind integration bugs. I am so tired of us not getting this right", over a
  player's screenshot of the gauntlets floating in a V over the helm) found the anchor took a part-local body skin's
  frame for the skeleton's, and anchored at the skeleton's own skin first.

Every pin of the three ran on fixtures (`test/fixtures/mw/plateRig.mjs` - RETIRED with them), and each fix was a
correction to a solve that read frames retail data does not share; the third still carried the plate on recovered
binds the game never showed it was right about. MW-STEEL4 retired the solve whole: `fitShift`, `shiftBatch`,
`bindPoseMats`, `rebindSkin`, `skeletonBindSkins`, the sided transfer, the plate's `fit`/`solvePose`/`skinFrom` rows and
the first person's own-model solve are gone, and `mwSkinTransfer.js` and `bindSkinnedFromBody` are MW-BRIG3's again.
Their pins went with them (`test/mwsteel2.test.js` and `test/mwsteel3.test.js` RETIRED, and MW-STEEL1's fit, transfer
and first-person pins), and their mutants (`tools/mutants/mwsteel2.json` and `tools/mutants/mwsteel3.json` RETIRED, 15
of `mwsteel1.json`'s 28 records with the code they mutated).

## MW-STEEL4: rigged as retail's armour is

Mac, 2026-10-07: "I think the prior session to rig the new steel set on the morrowind model really fucked it up. How
hard is it to switch it out?" - and offered pulling the plate, parking it behind a switch, or rigging it properly, "You
do it properly".

**What changed.** The plate's twelve NIFs are skinned at bake time (the rig, above): `tools/bakeSteelPlate.mjs` reads
the bind off the vendored skeleton (`retailBind`, `plateBind`), stands the scene on it by `SCENE_FROM_BIND`, weights each
piece by `PLATE_RIG` through `tools/skinWeights.mjs` jointWeights and writes it with `tools/nifWrite.mjs`
skinnedMeshesToNif (meshesToNif's own shape records, a skin after each, the bones last - so a rigid part is the bytes it
always was; the Thunderlock and the brigandine re-bake the same). The steel rows in ownArmorModels.js are their parts
and nothing else; composeWornArmor carries `skinFrom`/`fitTo` only for a model that has them (the brigandine), and the
build hands the binder a plate piece's mesh alone, in both persons. The paintings, the sources, the slots, the shadows
and the Steel Helm switch are untouched.

**How it was proven.** On retail's own skeleton (`test/fixtures/mw/retailRig.mjs`: the vendored hierarchy and its Tri
Shadow verbatim, with the part nodes base_anim carries; the bind pose built from the Tri Shadow's records by hand, not by
the bake) through the binder the game uses. `test/mwsteel4.test.js`: the bind undoes every inverse bind and is a
T-pose; the scene stands on it (the cuffs on the forearm line to 0.75, the neck and head bones inside the scene's neck
and head, the ankles 6.8 over the soles); every NIF a shape per painting named for its slot (and no other), over its
own side's bones, each inverse bind the bind undone, every vertex's weights summing to one, the skirt's hang law on
every vertex; every piece bound as a skinned part with no note, and in the bind pose every one of 3,000-odd vertices
Mac's scene to 0.002 under one frame; in retail's idle the gauntlets on the hanging hands (the cuff within 7 of the
forearm, the gauntlet 25 clear of the shoulder - MW-STEEL2's fault - and of the helm - MW-STEEL3's), the helm round the
head bone, each boot, greave, pauldron, the breastplate and the skirt on their bones, the right boot a step ahead;
posed (an elbow, a knee, a thigh, the head, two finger joints), every vertex one bone carries moving exactly as that
bone; in first person, on a rig whose arm rests elsewhere at other refs, each gauntlet the same in its bones' own frames;
the rig's law case by case; the skin writer read back as the reader reads retail's, its file its own bind pose; and
nothing left of the runtime solve. `tools/mutants/mwsteel4.json` (16, all dead). The poses were also drawn and looked
at (the bind, the idle, a stride, the arms at work) on the same skeleton, off the tree - the pictures are not
committed.
