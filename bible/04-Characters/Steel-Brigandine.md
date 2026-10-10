# The Steel Brigandine — the port's own worn model

`tools/bakeBrigandine.mjs` + `src/characters/ownArmorModels.js` +
`src/formats/mwItemMap.js` (composeWornArmor) +
`src/formats/mwSkinTransfer.js` (transferSkin, fitLift) + `src/formats/mwFirstPerson.js` (bindSkinnedFromBody)
(MW-BRIG1, Mac, 2026-09-29; MW-BRIG2; MW-BRIG3; MW-BRIG4, every metal in its own painting, 2026-10-09)

> "This is for the morrowind model. The steel brigantine"

with a Blender export (`morrowind_27284_autosave.fbx`) and its texture
(`Steel.png`, 128x128).

**The second of the port's own Morrowind models, and the first one that
is WORN.** The Dwarven Thunderlock (`05-Combat/Dwarven-Thunderlock.md`)
proved the lane can ship a mesh no player's archives carry; this does it
for a garment, which is a different problem in two ways: where it sits
is part of the authoring, and it has to move with a body rather than a
hand.

## Which item

Nothing in the port was called a brigantine. Roleplay & Realism Items'
light set mints any plate material as **Brigandine** (`rriItems.js`
`lightWord`), so its Jerkin (template 520) in Steel is the "Brigandine
Jerkin" - and on the Morrowind body it wore retail's `steel_cuirass`
(MW-ASSIGN: the jerkin resolves by the cuirass row). Mac's answer,
asked, was **the Steel Brigandine only** - until MW-BRIG4 (below): every
metal the jerkin is a brigandine in, Iron to Daedric, wears it now, each
in its own painting; the leather and fur jerkins keep retail's cuirass.
(The classic Steel Cuirass wears Mac's steel plate since MW-STEEL1 -
`04-Characters/Steel-Plate.md`.)

## The file, read

One static mesh (`Plane.025`, 485 positions, 764 polygons: 668
triangles, 92 quads, 4 pentagons), no bones, no skin. Mirrored exactly
in X. In the scene it sat at translation (0, 0, 64) with Blender's
export turn (-90 about X) and unit (x100): 29.4 wide, 23 deep, 61 tall,
spanning z 33.9 to 94.8 - a knee-length brigandine on a Morrowind body,
1 Blender unit to 1 Morrowind unit. Mac's answer, asked: **fitted in
place** on the Morrowind body. (MW-BRIG3: the body in that scene was set
up by a Claude session in Blender - Mac, asked how it got there: "claude
did it" - and it stood LOWER than the Morrowind body the port draws. The
scene's height is not the skeleton's rest; see MW-BRIG3 below.)

**Its front is the scene's -Y**: the buckle, the three clasps (three
small separate islands of twenty vertices) and the split in the skirt
are all on that side. Morrowind's actors face +Y, so the bake turns it
half round (`forward: '-y', up: '+z'`), which the suite checks on the
clasps.

**Six faces are concave** - three mirrored pairs round the clasps, a
quad and a pentagon each, real notches (turns of -0.018 to -0.54
against areas of 1.5 to 4.7). The FIELD-GUN-MW1 bake REFUSED a concave
face ("triangulate it in Blender"). That was the wrong fix to ask for:
Blender draws those faces ear-clipped, so an ear clip IS the
triangulation the modeller saw. `tools/fbxMesh.mjs` ear-clips them now
(`earClip`, projected on the face's Newell plane, winding kept), and a
convex face still fans corner for corner - the Thunderlock re-bakes to
the same bytes. A face that crosses itself has no triangulation and is
still refused by name.

## MW-BRIG2: skinned from the body under it

(Kept: the skinning is the body's own motion, and retail cuirasses are rigged
too. Its stated cause - the Chest node drifting off the torso in the idle - was
not what Mac saw; the defect in both builds was the HEIGHT. See MW-BRIG3.)

MW-BRIG1 moved the torso in game ("The texture was great, you just somehow
moved the geometry in the process") and was reverted (#451). What it did:
hung the brigandine RIGID on the skeleton's `Chest` and `Groin` nodes, split
at the belt, and took each node's rest transform back out
(`restPoseInverse`). That agrees with the body in one pose at most. A retail
body part is SKINNED (MW-D21: authored part-local, "a torso on the ground"),
and the reference places each of its vertices by the part's OWN NiSkinData on
the spine, pelvis and leg bones (rule 20) - never by the Chest node, which is
a clothing bone that stands its own way at rest and is keyed its own way by
the idle. So once anything animated, the torso moved by its bones and the
brigandine by a node the body does not use. `test/mwbrig2.test.js` builds
exactly that case and measures the MW-BRIG1 attach dragged over 10 units off
the body.

Now there is ONE transform. `formats/mwSkinTransfer.js`: every brigandine
vertex copies the skin of the nearest vertex of the player's own body parts
(`skinFrom: chest, groin, upperleg, knee` in `characters/ownArmorModels.js`) -
the same bones, weights, inverse binds and skin transform - and its position
is solved, through `skinBatch` itself (four probe vertices per body vertex),
so that in the skeleton's rest pose it lands exactly where Mac fitted it.
From then on it is drawn by `skinBatch`, the body's own door, so it moves by
precisely the transform the skin under it moves by: the torso cannot come
away from it, and the skirt bends with the legs. One piece, worn as a
cuirass (it still hides the chest skin), no belt split. A triangle keeps to
one body part's skin; a rigid body part (a mod's) is a skin of its one attach
bone with rule 13's mirror and rule 14's offset folded into the bind. With no
body under it, it is a note and is not drawn.

`combat/fpArm.js` loads the body parts it names from the player's own rows,
shadowed or not (the cuirass hides the very chest it copies), and hands them
to `bindPartsInto` with the part; `bindSkinnedFromBody` binds them as the body
binds them and pushes skinned pieces. The rigid path and every other part are
byte-for-byte what they were.

## MW-BRIG3: fitted onto the wearer (the fix)

Mac, on MW-BRIG2: "the session that was working on it completely broke the
morrowind torso". Asked: only with the brigandine worn, on a male body, and
"it's placed lower where the torso should be".

**The defect was where it sat, both times.** MW-BRIG1 and MW-BRIG2 each drew
the brigandine exactly where the modeller's scene put it, on the premise that
the scene's body IS the skeleton at rest (the bake's `placement: 'scene'`, then
a half-turn). Nothing ever measured that against a Morrowind body - every pin
ran on fixtures - and it is false: the scene's body stood lower. The brigandine
says so itself. It is sized across for a Morrowind man (29.4 over the
shoulders), but its closed top - a dome over the shoulders the neck passes
through, the collar band across its front - peaks at z 94.8 and its belt rings
the narrowest cross-section at z ~67, well under where a Morrowind man's neck
and waist stand. Drawn there, it sits under the torso. And it is worn as a
cuirass, which HIDES the chest skin, so the chest above it is simply gone - the
shoulders and the base of the neck bare, the head over a hole. MW-BRIG2's
skinning held it to the body in every pose, which is why it read as "placed
lower" and not as torn: it carried the same wrong height through every frame.
(Its stated cause, the Chest node drifting off the torso, was never observed;
the recorded retail structure - the `.kf` keys the Bip01 bones and the part
nodes hang off them, AUDIT-MAP2 in `02-Formats/Morrowind-Rules.md` - gives no
reason to expect it.)

**The fix measures the height on the wearer.** `ownArmorModels.js` gives the
piece `fitTo: 'chest'` - the body part it hides, and so must cover.
`bindSkinnedFromBody` binds that part as the body binds it, skins it in the rest
pose the transfer is solved in (skinned, never read raw: a retail part's
authored vertices are part-local, MW-D21), and moves the whole garment along +Z
until its highest point meets the chest's highest point - the base of the neck,
where the chest skin ends and the neck part begins (`fitLift`, `liftBatch`). A
pure translation: the modeller's shape to the last vertex, the texture and the
facing untouched. Only then is it skinned from the body, so every vertex copies
the skin of the body it now actually covers. The third-person build's notes say what was
done ("fitted to the chest - moved up N"); with no chest to fit to, the
brigandine keeps its baked height and the notes say that instead. On a
Morrowind-proportioned male (`test/mwbrig3.test.js`, the neck's base at z 106)
the lift is 11.24, the collar meets the neck's base and the skirt ends
above the knee; on the player's own body it is whatever that body measures - a
woman's, a beast race's, a mod's - read off the same part.

`composeWornArmor` carries `fitTo` with `skinFrom`, and `combat/fpArm.js` hands
it to the binder with the body under it. The shipped NIF and DDS are unchanged.

## How it reaches the body

`characters/ownArmorModels.js` is the worn counterpart of
`ownWeaponModels.js` and a leaf for the same reason. Per own piece:
template, material, `skinFrom` (the body slots it is skinned from), `fitTo` (the body slot it hides and is
fitted onto, MW-BRIG3), and the parts it fills by ARMO_PART name. `composeWornArmor` asks it before `mwArmorRecords` and claims each
part at an armour's priority exactly as `composeRefs` claims a record's
- so the priority law and the skin shadows are the ordinary path. The
first person keeps only arm bones, so the brigandine is a third-person,
peer and paperdoll garment, as a retail cuirass is.

The files ship through `systems/ownMwAssets.js` like the Thunderlock's:
`meshes/brigandine_<metal>.nif`, `textures/brigandine_<metal>.dds` - Steel's
since MW-BRIG1, every brigandine metal's since MW-BRIG4 - ranked after the
player's loose files (so a player's own file of the same name wins) and
before every BSA. `itemMapCoverage` answers each brigandine metal's jerkin
as `own`, inside the mod's armour space.

## The texture is painted, not baked

The Thunderlock's DDS was grown from its geometry because its export
had no texture. This one carries `Steel.png` and UVs laid out for it,
so the DDS is that PNG, mip-chained (`mipChain`/`writeDds`,
uncompressed), and the NIFs name it as a bare `brigandine_steel.dds`
that `correctTexturePath` re-roots under `textures/` (since MW-BRIG4 each
metal's NIF names its own, `brigandine_<metal>.dds`). The suite decodes
it back through `collectArmTextures` to the PNG pixel for pixel.

## Reproducible, and where the sources are from

`src/assets/mw/source/Brigandine_Steel.fbx` and `Brigandine_Steel.png`
are Mac's two files, renamed for the asset, committed beside what they
make; `node tools/bakeBrigandine.mjs` re-makes the shipped files - since
MW-BRIG4 a NIF and a DDS for every brigandine metal, twenty in all, from
the FBX and each metal's painting - and `test/mwbrig2.test.js` holds
Steel's to the bytes and its sources to their SHA-256, `test/mwbrig4.test.js`
every metal's. The FBX records its texture's original location as a
`Downloads\brigandine\` folder; the doctrine rows call these files
SUPPLIED (Mac's, given for the port) rather than OURS, and whether the
mesh and painting are Mac's own work or a download with a licence of
its own is **Mac's to confirm**.

## Not done here

- **MW-BRIG1's and MW-BRIG2's break was the height, not the model and not
  the attach** (MW-BRIG3, above). The previews were right about the shape;
  they showed it on no body. MW-BRIG3 has not been seen in game yet: the
  fit is measured on the player's own body, and the lift it took is a note
  in the third-person build, so a brigandine that still sits wrong says
  how far it was moved.
- **Only the height is measured.** Across and front to back it keeps the
  scene's placement, which Mac's report does not fault (it read "lower",
  not "forward" or "turned"); if a body shows it off-centre, the same
  anchor can measure those two axes.
- **The ground and icon picture** of the jerkin still resolve to the
  retail cuirass's ground mesh (MW-ASSIGN's icon path). The worn body is
  what this changes.
- **Female bodies** wear the same mesh, skinned from their own body parts
  and lifted to their own chest (MW-BRIG3); its shape is the one it was
  fitted with.

## MW-BRIG4: every metal, in its own painting

Mac, 2026-10-09: "Also for the integrated brigadine chest piece, we need
each of these textures implemented" - nine paintings of the brigandine's
own unwrap (256x256, the Steel one's layout at twice its size), in five
cloths - tan, light blue, red, green and deep blue - four of them painted
twice, the same cloth with different rivets.
Asked which brigandine wears which, he took the map offered: **one per
metal** the jerkin is a brigandine in, Steel keeping MW-BRIG1's red.

| metal | painting (in the order Mac attached them) |
|---|---|
| Iron | 1 - tan, dark rivets |
| Steel | MW-BRIG1's red (`Brigandine_Steel.png`, 128x128) |
| Silver | 7 - deep blue, silver rivets |
| Elven | 6 - green, white rivets |
| Dwarven | 9 - deep blue, gold rivets |
| Mithril | 3 - light blue, teal rivets |
| Adamantium | 2 - tan, red rivets |
| Ebony | 8 - red, light rivets |
| Orcish | 5 - green, dark rivets |
| Daedric | 4 - red, dark rivets |

(AUDIT MW-BRIG4: the question that settled the map called 5 "dark green",
9 "blue" and 4 "bright red" beside 6, 7 and 8. Measured, each pair - Iron
and Adamantium, Elven and Orcish, Silver and Dwarven, Ebony and Daedric -
is one cloth, the same to a level in every channel, and only its rivets
differ; the map was offered and taken on the rivets, which the question
named right. In game each pair reads as one colour but up close.)

**The table.** `ownArmorModels.js` `BRIGANDINE_METALS` is every plate
material (`isPlate`, Iron to Daedric - `rriItems.js` lightWord's "Iron and
up", in the ladder's order), and each is a row of its own
(`daggerfall_brigandine_<metal>`, "<Metal> Brigandine"): the one piece
worn as a cuirass, skinned from the chest, groin, thighs and knees
(MW-BRIG2) and fitted to the chest (MW-BRIG3) as the Steel row is, its
mesh `brigandine_<metal>.nif`. A jerkin wears the brigandine exactly when
the mod's own word calls it one - pinned both ways over every material and
both `message` values, so the leather and fur jerkins keep retail's
cuirass. Silver, which wore retail's steel cuirass by Morrowind's token,
wears its own painting now.

**The bake.** `tools/bakeBrigandine.mjs` bakes the mesh once and writes it
once per metal (`bakeBrigandineMetals`), each NIF naming its metal's DDS
and each DDS that metal's painting mip-chained - the ten NIFs the same
mesh to the byte but for the name of the painting. Mac's nine are
committed as he sent them under their metals' names
(`src/assets/mw/source/Brigandine_<Metal>.png`, `PAINTING`); Steel's files
bake to the bytes they were.

**How it was proven.** `test/mwbrig4.test.js`: the metals are the ten
plate materials, and a jerkin wears the brigandine exactly when its name
says Brigandine; each metal's row the Steel row's skin and fit, composed
into the cuirass slot with its own mesh and the chest's shadow; every
metal's NIF and DDS re-made byte for byte, each NIF naming its own
painting over the Steel brigandine's positions, UVs and indices, each DDS
resolved through the lane's ladder and decoded back to its painting pixel
for pixel; each painting held to its SHA-256 under the metal the map gave
it; each NIF's material named for its metal (AUDIT MW-BRIG4: all ten said
Steel); a metal with no painting refused by name. `tools/mutants/mwbrig4.json`
(8, all dead). Not yet seen in game: the paintings are on the unwrap the
Steel one has been worn on since MW-BRIG1, drawn and looked at off the
tree (front, each metal) - the pictures are not committed.
