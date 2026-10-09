# The Ebony Plate - the port's own ebony armour set

`tools/bakeEbonyPlate.mjs` (the bake) on `tools/bakeSteelPlate.mjs`'s machinery (the bind, the rigs, `HELM_LIFT`) +
`tools/skinWeights.mjs` (jointWeights, the hang OVER its joints) + `tools/fbxMesh.mjs` (earClipRepeated) +
`src/characters/ownArmorModels.js` (the ebony plate's rows) + `src/formats/mwItemMap.js` (composeWornArmor)
(MW-EBONY1, Mac, 2026-10-09)

> "This is next 1. The ebony armor set and its textures"

with `ebony_armor.fbx` and seven paintings (his ebonybreastplate, EBONYPELVIS, ebonyshoulders, ebonygauntlets,
ebonypants, ebonyboots and ebony helmet textures). Asked which materials wear it, he took the recommendation: **Ebony
only** - Daggerfall's seven classic pieces in Ebony wear Mac's set; Mithril and Adamantium keep the Morrowind ebony
they wore (`DF_TO_MW_ARMOR_MATERIAL`).

## What the export is

One Blender export of the scene the steel plate came out of, on the same body and in the same placement - so the steel
plate's whole pipeline applies unchanged (`04-Characters/Steel-Plate.md`): `SCENE_FROM_BIND` stands it on retail's
bind, each piece is read inside a scene box (`bakeObject`), and it is skinned at bake time to Morrowind's own bones by
the steel plate's rigs. Eleven objects and nothing of Bethesda's: the breastplate (`Plane.001`), its tasset skirt
(`Imperial_Silver_Cuirass_67_Male.011`), two pauldrons (`Cube.028` at +X, the right; `Cube.022`), two gauntlets, two
greaves, two boots and the helm (`Sphere.007`). The export is committed as it came
(`src/assets/mw/source/Ebony_Plate.fbx`), the paintings beside it as `Ebony_Plate_<Piece>.png`.

**Which painting is whose.** The export names none of them, so each was matched to its piece by the UV islands it
traces - the mean image gradient along each object's island boundary edges, highest where a painting's own seams fall
- and confirmed by rendering the set. The breastplate's is 512 px, the rest 256.

**The face the baker refused.** `Plane.001` would not bake: "a 16-gon has no ear left to cut". Eight of its faces name a
corner twice in a row (a zero-length edge Blender keeps), and an ear clip cannot cut such a polygon. `earClipRepeated`
drops the repeat and clips what is left, mapping the triangles back to the face's own corners; it runs only where
`earClip` threw, so every other bake in the tree is byte for byte what it was, and a face with no repeat (or one that
is still no face, a bow tie) is refused as before. The bake records how many faces took that door (`repeated`: 8).

## The rig

Each piece takes its steel twin's rig (`EBONY_RIG`), the helm the closed helm's (rigid on the head, raised
`HELM_LIFT` as MW-STEEL5 raised the steel helms). One difference: the ebony breastplate carries its own tassets, down
to the thighs, where the steel one stops at the waist. So the breastplate's rig adds both thighs and **hangs over its
joints** - `jointWeights`' new `mode: 'over'`: above `top` (84) the joint law alone (the spine, the clavicles), below
it the joint law's answer keeps 1 - share and the thighs take the share, 0.7 at the hem (62), split across 4 units of
the middle. The legs weigh in by the hang alone: the joint law never picks a thigh, nor blends into one as a child at
its own origin (MW-CLOAK1 closed that second door), so a plate over the thigh is not the thigh's outright and the waist
stays one surface. The ebony skirt is the steel skirt's rig hung to its own hem (60).

## Worn

`ebonyPlate()` in `ownArmorModels.js` - the steel plate's rows through one factory (`plate(material)`), so each ebony
piece fills exactly the slots its steel twin fills and hides what it hides: the breastplate the cuirass and its skirt,
each gauntlet its hand over the wrist and forearm, the greaves the upper legs, each boot its foot over the ankle and
knee, the helm the HAIR (one helm - Mac sent no open one, so the Steel Helm switch has nothing to switch here).

## How it was proven

`test/mwebony1.test.js` (5): the bake byte for byte from the committed files, each DDS its painting, the export's
hash and object names; the scene placement, the helm lifted, the shapes named for rule 15, weights summing to one, the
tasset law exactly; Ebony alone, the composer's adds and shadows, Mithril and Adamantium keep retail; through the
binder on the vendored retail skeleton - idle placements, and in a stride the right tassets move with the leg, less
than its knee, while the chest stays; and earClipRepeated's door. Rendered posed on the retail rig, idle and striding,
before it shipped. `tools/mutants/mwebony1.json` (10, all dead). `test/mwsteel1.test.js` keeps its census to Steel and
no longer expects Ebony to keep retail's record.
