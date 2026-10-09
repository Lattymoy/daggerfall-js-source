# The Cloak - the port's own cloak, and what hangs around it

`tools/bakeCloak.mjs` (the bake) on `tools/bakeSteelPlate.mjs`'s machinery + `tools/meshSubdivide.mjs` (Loop
subdivision, MW-CLOAK2) + `tools/skinWeights.mjs` (the hang OVER its joints) + `src/characters/ownClothingModels.js` (the garments that wear it, the dye's painting) +
`src/formats/mwItemMap.js` (composeWornArmor) + `src/formats/mwCloakFit.js` (the two fits) + `src/combat/fpArm.js`
(fitThirdPersonCloak, where the third-person body takes them) (MW-CLOAK1, Mac, 2026-10-09; MW-CLOAK2, smoothed round
the shoulders, the same day)

> "2. The new cloak and its textures. Note: The new cloak will need bones to animate with the character movement.
> Ensure theres no clipping with weapons that are stowed"

with `New_Ship-1.fbx` and eight paintings. Asked, he took every recommendation: **both cloaks** - Daggerfall's Casual
Cloak and Formal Cloak, a man's and a woman's of each (templates 154, 155, 191, 192) - wear it; a dye Mac did not paint
wears **the nearest of the eight**; and stowed gear is **worn over the cloak** - back-slung weapons and the bow move out
to sit outside it and stay visible.

## The mesh and its bones

One object (`Cube.020 Remeshed.001`), 232 triangles as exported: a single open sheet hung from the shoulders down the
back to the calves, two straps over the shoulders, its normals facing out (the writer makes every shape two-sided,
rule 65, so its inside draws too). It ships smoothed, 3,712 triangles (MW-CLOAK2, below). It came out
of the steel plate's scene, so it stands on retail's bind as the plate does. It is **skinned at bake time** on the steel
breastplate's rig - the pelvis, the spine to the neck, the clavicles at its shoulders - and from the waist down it
**hangs over** that (`jointWeights` mode 'over', MW-EBONY1): each thigh takes a growing share of its own side, from
nothing at z 86 to 0.85 at the hem, split across 10 units of the middle, so the cloak walks with the legs - the side over
the leg stepping back goes back with it - without riding a leg outright and tearing at the middle. **Half at the hem
was tried first and lost**: posed on retail's rig in a stride (the back thigh 30 degrees, its knee 45) the trailing
greave came through the hem; at 0.85 it stays behind it in a walk, and in that full stride the trailing boot reaches no
more than 2.2 units into the middle of the hem, where the two thighs split the cloak (1.3 against the export's coarse
hem, before MW-CLOAK2 smoothed it). No cloth law: the cloak follows
the bones.

**Eight paintings, a mesh each.** `cloak_<painting>.nif` names `cloak_<painting>.dds`, for blue, grey, red, dark brown,
purple, light brown, white and green - Daggerfall's dye order less the two Mac did not paint. Aquamarine wears the blue
and Yellow the light brown (`CLOAK_DYE_PAINTING`); Dark Brown and Light Brown are told apart by lightness, the darker
painting the Dark Brown.

## Worn

`ownCloakFor` answers for a worn garment named Casual Cloak or Formal Cloak, by its dye; `composeWornArmor` takes it
ahead of the garment's clothing row and adds the cloak **claiming no slot and reserving none**. Until now a cloak wore
a whole Morrowind robe on the Morrowind body (`DF_CLOTHING_ROWS`), reserving eleven slots and hiding every piece of
armour under it; now the armour and the clothes under a cloak are composed exactly as without it, the cloak added
last. Its add has no bones, so the first person never draws it (`fpWornAdds`); a woman's bare chest under a cloak takes
the modesty weld as any bare chest does (`composeWornModest`), because a cloak covers none of it. Daggerfall wears two
cloaks (Cloak1, Cloak2); one is drawn, the first, and the second is a note. The robe row stays the item's icon's
record - the icon still draws Morrowind's robe, as an own-model armour piece's icon still draws retail's record. The
item census and the inspector's report name the cloak's own meshes.

## What hangs around it - mwCloakFit.js

The cloak was fitted on the steel plate's body, and a body wears what its owner put on it. So once the third-person
body is assembled, two fits, measured in the **rest pose** (the skeleton's own, the pose the bind was taken in) and kept
for every pose after, because each moves the geometry where it is authored:

1. **The cloak over what it covers** (`fitCloakOver`). Every point of the body and its clothes (vertices, and each
   edge's interior every unit) that stands behind the cloak's sheet - its front layer where it folds - eases the sheet
   back past it by `CLOAK_CLEARANCE` (1): the triangle over it moves its whole way and the cloak round it less, to
   nothing at `CLOAK_EASE_RADIUS` (8, MW-CLOAK2), a welded seam as one, a pass per shortfall or fold uncovered, no
   vertex further than `CLOAK_PUSH_LIMIT` (10); its normals are then its new shape's. The push is the rest pose's, carried into the
   bind the cloak is skinned from through each vertex's own skin blend (measured by skinning unit steps), so it rides
   the bones. The ebony pauldrons stand 2.5 through the shoulders as baked; the steel ones 1.2.
2. **Stowed gear against the cloak** (`fitStowedGear`), a holster bone's pieces as one - the scabbard, the weapon in it,
   the quiver's arrows:
   - **Slung** on the back (a bone under `Bip01 Spine1` - the greatswords and the bow): **worn over the cloak**, moved
     back until every point of it clears the sheet's back, after turning about its bone within 15 degrees to lie along
     the cloak's fall - the turn needing the least move. Moved straight back, a greatsword stood off the shoulders by
     the hem's flare (about 9 units); turned, a greatsword rides the cloak 0 to 5 units back, a bow and quiver 7 to 8.
   - **Hung** at the hip (a bone under the pelvis alone - swords, short blades, crossbows): it stays **under** the cloak,
     pitched forward about its bone the least whole degree that keeps every point in front of the sheet. The addon
     hangs a longsword about forty degrees back, its tip through the cloak's side; under a cloak most swords hang 11 to
     19 degrees nearer plumb (1 to 38 across the addon's blades; a dagger not at all, a crossbow 44 to 52). Pushed back over the cloak instead, it would hang
     some thirty units off the hip. A hip group no pitch within 60 degrees clears is left as it hangs, and the card says
     so.

   A moved piece's source is replaced, never written into (a rigid piece's source can be its parsed batch's own array),
   and the live pose is re-placed at once. The build fits after `hangHipLight`, over the slots of the skin rows and the
   worn adds; a weapon swap fits the new holster against the cloak already fitted.

**Measured on the addon's own scabbards** (all 71 under `vendor/weapon-sheathing/`, on the steel plate): before the
fits 57 crossed the cloak - all but the daggers, the tantos, Keening, the goblin club and the crescent blade; after,
none does - counted as gear edges through cloak triangles. Slung gear also leaves the plate it had been crossing (the cuirass, the pauldrons).

## MW-CLOAK2: smooth round the shoulders

Mac, of MW-CLOAK1's cloak: "I dont like how the cloak isnt smooth around the shoulders". It was not, and the lighting
could not make it so: the export's 140 vertices stand about five units apart, and over the shoulders, where the sheet
turns from the back over the top, neighbouring faces bent 14.8 degrees on average (54 creases past 20 over the whole
cloak), a face stood up to 35 degrees off its own corners' normals, and the outline turned as sharply as 82 degrees at a
vertex - the straps' ends a ragged run of small triangles. The fit then made it worse where armour came through: it
moved a triangle's three corners, so each ebony pauldron left a facet in the cloak over its edge.

**The bake smooths it**: two levels of Loop subdivision (`tools/meshSubdivide.mjs`, `CLOAK_SUBDIVISIONS`), 1,949
vertices - every triangle in four a level, every vertex moved toward the smooth surface the mesh is the net of, the open
edges relaxed along themselves (3/4 the vertex, 1/8 each rim neighbour) so a ragged edge becomes a curve and never pulls
into the sheet; the normals the result's own, facing as the export's did; the UVs linear, the painting being cloth. The
shoulders' mean bend falls to 3.0 degrees, the creases past 20 to six at the left strap's very tip (a fold a unit
across in the export), the outline's sharpest turn to 24 degrees; the hem stays where it was and the top within a fifth
of a unit. One level was tried and lost: it left the top corner angular. The weights are the smoothed cloak's own, by
the same law. Each mesh is 110 KB (eight, one a painting), fetched by URL when worn.

**The fit eases** (`CLOAK_EASE_RADIUS`): a point through the cloak still moves its own triangle the whole way, and now
the cloak round it by (1 - (d / 8)^2)^2 of that, so the sheet bows over a pauldron's edge; the push's steepest slope
over the ebony plate is 0.55 a unit, where the corners alone stepped 9.6. The fitted cloak's normals are recomputed from
its new shape. Measured again on all 71 of the addon's scabbards over the steel and the ebony plate: 57 crossed the
smoothed cloak as hung, none after, none unresolved.

**What it costs**: the finer hem measures the sprint's back-kick more exactly - with the back thigh 30 degrees and its
knee 45, the trailing boot reaches 2.2 units into the middle of the hem (1.3 against the coarse one); a walk's still
does not touch it.

**Proven by** `test/mwcloak2.test.js` (3): one level's arithmetic on a small net (its counts, a flat net staying flat, an
edge's and an old vertex's rules on the rim and off it, Loop's beta on a bump, the normals and the UVs, a seam and an
edge three faces share refused); the cloak's shoulders measured before and after; and the fit's push slope, eased and
not, and its normals, whatever the winding. `tools/mutants/mwcloak2.json` (11, all dead).

**What it does not do.** The cloak's hem swings with the thighs and hip gear rides the pelvis, so in a full stride a
pitched hip tip and the hem can still meet; the rest fit keeps the standing body and the walk clean, as a skinned cloak
with no cloth law can. And the addon's hip positions cross the bulky plate sets themselves - the steel tassets and the
left gauntlet - with or without a cloak: that is the sheathing's fit to the vanilla body, not the cloak's, and the
pitch leaves its total about where it was (a crossbow's 514 crossings to 534, some moved onto the thighs). Stowed
shields are not in the port yet.

## How it was proven

`test/mwcloak1.test.js` (7): the bake byte for byte, each DDS its painting, the export's hash, one object, no
Morrowind painting; the scene placement, `Tri Cloak 0`, the bones, the thighs' share exactly, and the leg never a child
blend (a synthetic rig); the four garments, the dye map, no slot, no shadow, never in the first person, the weld under
it, two cloaks, the census and the report; through the binder the cloak behind the spine, the shoulders still in a
stride, the hem back with the leg, the trailing leg; fit 1 on the ebony plate (and a folded cloak); fit 2 on the
vendored daedric greatsword, longbow, iron longsword and iron dagger, crossing counted against the cloak's triangles in
the live pose and every pose after; and the build's wiring by source. Rendered posed on the retail rig before it
shipped - idle and striding, over the steel and the ebony plate, with each kind of stowed gear.
`tools/mutants/mwcloak1.json` (17, all dead).
