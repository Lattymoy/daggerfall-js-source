# The Steel Plate - the port's own steel armour set

`tools/fbxStrip.mjs` + `tools/bakeSteelPlate.mjs` (the bake, the bind, the rig) + `tools/skinWeights.mjs` (jointWeights) +
`tools/nifWrite.mjs` (skinnedMeshesToNif) + `src/characters/ownArmorModels.js` (the steel plate's rows) +
`src/formats/mwItemMap.js` (composeWornArmor) + `src/systems/features.js` (the Steel Helm row)
(MW-STEEL1, Mac, 2026-10-06; MW-STEEL2, the skirt, 2026-10-07; MW-STEEL4, rigged as retail's armour is, 2026-10-07 -
it retired the runtime rig MW-STEEL1 to MW-STEEL3 built, recorded below; MW-STEEL5, Mac's update and the helm on the
game's head, 2026-10-09; MW-FIT1, what the plate covers - the upper arms under the pauldrons, the head under the closed
helm - from a player's report, 2026-10-09)

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
DF_TO_MW_ARMOR_MATERIAL), keep retail's steel; every Roleplay & Realism Items piece keeps what it wore, and its Jerkin
keeps the brigandine (in every brigandine metal since MW-BRIG4 - `04-Characters/Steel-Brigandine.md`).

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

MW-STEEL1's import ran it on Mac's two exports and committed the set with the open helm, the head and the neck
stripped, and the closed helm alone. Since MW-STEEL5 the set comes as ONE export, the closed helm its helm:
`node tools/bakeSteelPlate.mjs --import=<steel_armor.fbx>` holds it to carrying every object the set's pieces are read
from, each where it was read (refused before anything is written), measures and strips the reference body if it
carries one (printed for SCENE_BODY), and writes `src/assets/mw/source/Steel_Plate.fbx` - Mac's
steel_armor.fbx byte for byte, which carries no head or neck. The open helm is in it no more:
`--open-helm=<export>` takes that helm alone out of an export that has it, and
`src/assets/mw/source/Steel_Plate_Open_Helm.fbx` is MW-STEEL1's open helm so, the same to the vertex.

## The bake

`node tools/bakeSteelPlate.mjs` makes twelve meshes and eight textures under `src/assets/mw/` (a Data Files tree,
served by `systems/ownMwAssets.js` after the player's loose files and before every BSA, as the Thunderlock's and the
brigandine's are), from the two sources (the set and the open helm), the eight paintings and retail's skeleton. Each piece is read out of the scene
by its own object (`PIECES`), and each object must stand where it was read - its scene box, to 0.02 - or the bake
refuses it by name, so a re-export that renamed, moved or reshaped one never ships a boot as a greave (bakeGalleon's
ROLES boxes, the same lesson). Every mesh keeps the scene placement (`placement: 'scene'`) and is skinned (the rig,
below); every painting is mip-chained to an uncompressed DDS as the brigandine's is, the left and right of a pair
sharing one. The closed helm is ONE part of TWO shapes - a shell in the helm's painting, a visor in the faceplate's -
and so is the cuirass since MW-STEEL5, the breastplate and its waist band, both in the breastplate's. The open helm is
raised `HELM_LIFT` onto the game's head (MW-STEEL5, below); the closed helm stands where Mac's export puts it, the head
hidden under it (MW-FIT1, below).
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
| breastplate (and its waist band, MW-STEEL5) | the pelvis, the spine (3), spine1 (3), spine2 (3), the neck (2); the clavicles at its shoulders (2) | `Tri Chest` |
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
every shape, so the file is its own bind pose and a tool that skins it against its own nodes draws it where Mac put it
(the open helm `HELM_LIFT` higher since MW-STEEL5).

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
| Left / Right Pauldron | left / right pauldron | its upper arm (MW-FIT1) |
| Helm | **hair** | the closed helm the head (MW-FIT1); the open one nothing |
| Boots | right foot, left foot | each its ankle and knee |

`hides` is reserveIndividualPart's occupation - the slot claimed with no mesh, at the armour's priority - so the skin
under a vambrace or a boot's shaft is not drawn. The law stands over the plate as over retail's: a worn clothing skirt
reserves the groin and both upper legs at its higher priority and covers the greaves, and takes the skirt slot from the
plate skirt; a robe the rest of what it reserves. The plate skirt shadows nothing (ARMO_PART's skirt row): the groin
skin stays under it. The helm takes the HAIR slot: the hair is hidden (the helmet-hides-hair rule, AUDIT 30 F1, by the
slot itself). The open helm leaves the head - its face shows; the closed helm hides it, as a retail closed helmet fills
the head's slot (MW-FIT1, below). A part the first person does not draw hides nothing from it (`fpShadows`): the
pauldron's upper arm is the first person's skin.

## The Steel Helm switch

Mac's answers: a Features switch beside Weapon Sheathing, **closed by default**. `steel-helm` (systems/features.js,
group Combat, the port's own): pref `mwSteelHelm`, `closed` or `open` (ownArmorModels.js STEEL_HELM_STYLES - the
switch's values ARE the helm's styles). It is the VIEWER's, as the sheathing is: read where the worn set is composed
(fpArm.js, beside Show Nudity's weld), it is how this machine draws a steel helm - the player's and every peer's - and
it never reaches the wire. Thrown, the tile rebuilds the standing body at once (ui/enhancedMenu.js TILE_AFTER, whose
after-step a choice's write takes as a switch's does); a peer's body takes it at its next build.

## Not done here

- **Seen in game once, from behind** (Mac's screenshot, MW-STEEL5) - no retail data is in the tree. Every pin stands
  on retail's own skeleton (the vendored hierarchy, its rest and its Tri Shadow), and the plate is worn on the path
  retail's own armour is worn on, which the game has drawn since MW-D20 (Mac's retest: "hands PERFECT"); what is the
  plate's own is the bind's placement under it (SCENE_FROM_BIND, read to about a unit), the weights, and the open
  helm's `HELM_LIFT` - read off one screenshot to about a unit, so the open helm's face and the head under it from the
  front are still to be looked at (the closed helm hides the head since MW-FIT1).
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

## MW-STEEL5: Mac's update, and the helm on the game's head (the closed helm's lift RETIRED by MW-FIT1)

Mac, 2026-10-09: "Heres an updated fix for the integrated steel armor for the morrowind model. Theres also an issue
where the helmet isnt positioned properly on the head but only for the new integrated model" - with `steel_armor.fbx`
and a screenshot of the set worn in game, from behind.

**The update, read.** One export, the set with the closed helm, and no Morrowind head or neck in it. Against
MW-STEEL1's: the greaves, boots, gauntlets and skirt are the same to the vertex; the breastplate
(`Imperial_Silver_Cuirass_67_Male.013` now) has its shoulders widened - 54 of the 301 vertices the band left it moved,
x out to 16.61 from 14.42 - and its waist band split off as an object of its own (`.012`, every one of its 56 vertices where the
breastplate had it, in the breastplate's painting); the pauldrons are remade larger (x in to 6.43 from 7.44, up to 118.82
from 117.66) and their names traded sides - `Breton_Male.009 Remeshed.003` stands at +X, the right; and the closed helm
stands one unit higher, its shell and visor moved and nothing else. The paintings are unchanged. The export is the
set's source as it came; the open helm, which it no longer carries, stays MW-STEEL1's (above). The cuirass is ONE part
of two shapes, as the closed helm is - the breastplate and the band, both `Tri Chest`, both in the breastplate's
painting, the band weighted on the waist's own bones (the pelvis, the spine and - one vertex - spine1).

**The helm sat low on the head.** Retail's helmets fit the head in game and the plate's did not: in Mac's screenshot
the scalp stands up through the closed helm's crown, a skin-lit dome over the steel with the plume behind it. The
helms are fitted on the scene's Breton head (SCENE_BODY) and skinned to `Bip01 Head` through SCENE_FROM_BIND, which the
body's own pieces measure - the forearm through the cuffs, the ankle over the soles - and which nothing in the head
checks but that the head bone stands inside the scene's head. The head the game draws is a rigid part at the
skeleton's "Head" node (`02-Formats/Morrowind-Rules.md` rule 5), a retail helmet beside it; its placement on its bone is retail's, not the
scene's, and no retail head is in the tree to read it from. So it is read off the screenshot, by a probe anyone can
run (`tools/helmLiftProbe.mjs`): the set worn on the vendored retail skeleton in its idle, through the binder the game
uses, the closed helm where the screenshot drew it, and a stand-in for the scene's head (SCENE_BODY's box as an
ellipsoid) carried on the head bone and raised up it, drawn from behind at three heights of eye (Mac's camera's is not
known). Down the column through the helm the screenshot shows 54 rows of scalp over 138 of helm, 0.39; the probe shows
none with the head where the scene put it, and 0.39 with it raised 3.24, 3.70 and 4.25 units at the three eyes (3.5 to
4.6 with the cranium alone, the nose left out of the stand-in's depth - the first reading, off the tree). The helm
against the shoulders stands in the screenshot about where the probe puts it, so the body's placement holds and the
head stands higher on its bone in the game than in the scene. **What the probe does not rule out:** a head bigger than
the scene's Breton (the screenshot's race is not recorded) shows the same scalp at a smaller raise, and a shot from
behind sees nothing of an offset front to back - a front view of the closed helm is the check still owed.

**The fix is the helms', at bake time.** `HELM_LIFT` (4) raises both helms up the head bone - the scene's +Z, which the
bind stands upright - before they are weighted: the open helm 4 over MW-STEEL1's fit, the closed one 3 over Mac's new
export, which already stands it a unit higher, so both shells stand at one place (112.88-131.82 then, 116.88-135.82
now) and each crown stands over the lifted head by the 2.62 Mac fitted over the scene's. The rig is untouched - the head
alone, rigid on the skull - and so is every other piece: each NIF is its objects in the scene's placement, the helms
lifted and nothing else. The aventail's rim stands `HELM_LIFT` higher over the collar than in the scene, where it
hung on it; what shows between is the game's own neck - and if the screenshot's head was bigger than a Breton's, a
Breton wearer's helm sits that much higher than it needs to, a band of neck under it. The probe holds the fix: with
the head raised across its whole span and a unit past it, no scalp shows in the shipped helm at any of the three eyes.

**How it was proven.** `test/mwsteel5.test.js`: the set's source is Mac's export byte for byte (the import with no
body to strip is the file) and the open helm's is that helm alone; the wrong file, or one short a piece, is refused by
name, a piece past its box before anything is written, and a reference object the export carries is measured and
stripped, the rest byte for byte, and what no piece reads said; the open helm's strip, aimed at the set's closed
shell, keeps that object alone byte for byte; the cuirass two shapes in the breastplate's painting, the band on the
waist's bones; the pauldrons each on its own side; the lift the helms' alone (4, and 3 for the closed), both shells at
one place, the crown at MW-STEEL1's 131.82 raised `HELM_LIFT` (Mac's 2.62 over the scene's crown, kept over the
game's), the head inside the shell across and behind; every NIF its objects in the scene's placement, the helms
lifted; and the evidence re-run - the probe reads the screenshot's scalp at each eye between 2.5 and 5.5, `HELM_LIFT`
inside their span, no scalp with the scene's head in MW-STEEL1's helm nor with the game's in the shipped one.
`test/mwsteel1.test.js` re-makes every file byte for byte from the two sources; `test/mwsteel4.test.js` draws the
cuirass's two shapes. `tools/mutants/mwsteel5.json` (19, all dead). The screenshot is not committed: it is the game's
head drawn, a render of the player's own data; what is kept of it is the ratio the probe reads against. The command
line writes nothing until the bake has run on what it takes (AUDIT MW-STEEL5: it saved the new source first, and a
refused open helm or a failed bake left it beside the old meshes).

## MW-FIT1: what the plate covers

A player's report, passed on by Mac on 2026-10-09 over two screenshots of the paperdoll: the Steel set ("the upper arm
is still visible with the steel armor") and the Ebony set ("the ebony armor gets the same issue", "and the helmet
elevation is too much", "the coif has to cover the neck"). It is the same body on the same path in both sets, so one
fix serves both (`04-Characters/Ebony-Plate.md`).

**A pauldron is a sleeve.** Both sets' pauldrons close round the upper arm all the way down: in the bind, every one of
36 rays out of the upper arm's bone line meets the pauldron from the shoulder to the elbow, and at the elbow the
gauntlet's cuff closes round the arm. Nothing hid the skin under it: the pauldron filled its own slot, which shadows
nothing (ARMO_PART's pauldron rows - a retail pauldron layers over the clavicle), and the game's upper arm, a skinned
part of its own girth and its own weights, stood up through the steel wherever the plate is snug (its tube is 1.9 to
2.4 units off the bone at its tightest). So each pauldron `hides` its upper arm, as a gauntlet hides its forearm - the
occupation with no mesh, at the armour's priority. **Only in the third person**: the first person draws the arm-bone
parts alone (`fpWornAdds`), never a pauldron, and a hidden upper arm there would be a hole between the shoulder and the
gauntlet. `composeWornArmor` answers the first person's shadows apart (`fpShadows`): a `hides` occupation remembers the
part it lies under, and one under a part the first person does not draw is not the first person's; every other
occupation - a gauntlet's, a robe's reserve - is both persons'. `fpArm.js` skins the first person with
`worn.fpShadows ?? worn.shadows`.

**A closed helm is the head.** MW-STEEL5 raised both helms `HELM_LIFT` up the head bone, because the scalp stood up
through the closed helm's crown in Mac's screenshot. Raised, a helm also rises off the body Mac hung it on: the ebony
coif and the steel visor came up off the collar, and a band of neck showed under them - in retail's idle, carried on
the neck bone, rays square to the scene's neck missed the plate 13 to 17 times in 36 at z 115 to 116 under the ebony
helm, and up to 36 under the steel one; and a wearer whose head stands lower on its bone than the screenshot's read
saw the whole helm ride high. Both readings cannot be met by one rigid lift. Retail's answer is the slot: a helmet that
fills the head's slot is the closed helm, and no head is drawn under it (`02-Formats/Morrowind-Rules.md`, "A helmet
force-deletes hair before its own parts are added"). So the closed steel helm and the ebony helm - a visor, an eye slit,
the ebony one a mail coif to the collar - hide the head (`hides: ['head']`, the mesh still the HAIR's, its shapes named
for it by rule 15), and stand where Mac fitted them: the closed steel helm where his export puts it (113.88 to 132.82),
the ebony helm where his (112.1 to 133.37). No scalp can stand through a crown with no head under it, whatever the
race, and the coif hangs to the collar - in the idle the ebony coif and breastplate meet all 36 rays from z 110 to 115,
the steel visor and breastplate at least 26 at every height to 117. The open helm shows the face, so it keeps the head
and keeps `HELM_LIFT` - the one helm the MW-STEEL5 reading still decides (`tools/helmLiftProbe.mjs` reads it unchanged,
3.24 to 4.25, with the closed helm put back by `overFit`, its export's unit over MW-STEEL1's fit).

**What it does not do.** The open helm still stands `HELM_LIFT` over the collar (MW-STEEL5's band of neck under its
aventail stands). Through a closed helm's eye slit is the helm's own inside, as in a retail closed helmet, not a face.
At Mac's fit the steel closed helm leaves a little neck at the sides (26 to 29 of 36 rays meet plate at z 115 to 116)
- his model's own, not the lift's. And it is read on the vendored retail skeleton and the scene's own measures, not
seen in game: the paperdoll is the check.

**How it was proven.** `test/mwfit1.test.js`: the sleeve on the shipped meshes, both sets, both sides; each pauldron's
shadow in the third person and none in the first, the gauntlet's in both, a robe's reserve over a pauldron in both,
and the two skins' shadows read where `fpArm.js` reads them; the closed steel helm (default and asked) and the ebony
helm over the head and the hair, the open helm the hair alone, each one add, the hair's; and in retail's idle the neck
under the shipped helms covered, and bare under both raised as they were. `test/mwsteel5.test.js`, `mwsteel1` and
`mwebony1` re-read for the closed helms unlifted and the new shadows; the bake re-made two files, the closed steel helm
and the ebony helm, and nothing else. `tools/mutants/mwfit1.json` (13: 12 dead, 1 recorded equivalent - a robe over a
pauldron's hide keeping its first-person pass, which the slotlist walk cannot reach); seven records re-aimed by content
(`MWEBONY1-the-helm-lifted-again` and `MWSTEEL5-the-closed-helm-lifted-again`, whose laws inverted, `MWSTEEL1-helm-in-the-head-slot`,
`MWSTEEL1-hides-dropped`, `MWSTEEL4-the-plate-solved-at-runtime-again`, and the probe's two), every list re-run: 70 dead.
