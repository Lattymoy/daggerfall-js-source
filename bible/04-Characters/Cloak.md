# The Cloak - the port's own cloak, and what hangs around it

`tools/bakeCloak.mjs` (the bake, its one bone CHEST_BONE) on `tools/bakeSteelPlate.mjs`'s machinery + `tools/meshSubdivide.mjs` (Loop
subdivision, MW-CLOAK2) + `src/characters/ownModels/ownClothingModels.js` (the garments that wear it, the dye's painting) +
`src/formats/morrowind/mwItemMap.js` (composeWornArmor) + `src/formats/morrowind/mwCloakFit.js` (the three fits) + `src/combat/fpArm.js`
(fitThirdPersonCloak, where the third-person body takes them) (MW-CLOAK1, Mac, 2026-10-09; MW-CLOAK2, smoothed round
the shoulders, the same day; AUDIT MW-CLOAK, held in motion, the same day; MW-CAPE-RIGID, on the chest alone, 2026-10-14)

> "2. The new cloak and its textures. Note: The new cloak will need bones to animate with the character movement.
> Ensure theres no clipping with weapons that are stowed"

with `New_Ship-1.fbx` (committed as it came, as `src/assets/mw/source/Cloak.fbx`) and eight paintings. Asked, he took
every recommendation: **both cloaks** - Daggerfall's Casual Cloak and Formal Cloak, a man's and a woman's of each
(templates 154, 155, 191, 192) - wear it; a dye Mac did not paint wears **the nearest of the eight**; and stowed gear is
**worn over the cloak** - back-slung weapons and the bow move out to sit outside it and stay visible.

## The mesh and its bones

One object (`Cube.020 Remeshed.001`), 232 triangles as exported: a single open sheet hung from the shoulders down the
back to the calves, two straps over the shoulders, its normals facing out (the writer makes every shape two-sided,
rule 65, so its inside draws too). It ships smoothed, 3,712 triangles (MW-CLOAK2, below). It came out
of the steel plate's scene, so it stands on retail's bind as the plate does. It is **skinned at bake time to ONE bone,
the chest** (`Bip01 Spine2`, where the clavicles join - MW-CAPE-RIGID, below): every vertex wholly its own, no other
bone in the mesh, so the whole sheet moves rigidly with the chest and with nothing else. No cloth law.

Until MW-CAPE-RIGID it was skinned on the steel breastplate's rig - the pelvis, the spine to the neck, the clavicles -
and from the waist down **hung over** that (`jointWeights` mode 'over', MW-EBONY1), each thigh taking a growing share of
its own side to 0.85 at the hem, so the hem walked with the legs (half at the hem had been tried first and lost: the
trailing calf came through it). The ebony plate and the townsfolk still hang by that law; the cloak no longer does.

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
cloaks (Cloak1, Cloak2); one is drawn, the first, and the second is a note. The item's icon is the cloak itself, in its
dye's painting (AUDIT MW-CLOAK: it drew the Morrowind robe the row once dressed it as). The item census and the
inspector's report name the cloak's own meshes.

## What hangs around it - mwCloakFit.js

The cloak was fitted on the steel plate's body, and a body wears what its owner put on it. So once the third-person
body is assembled, three fits (`fitThirdPersonCloak`, after `hangHipLight`, over the slots of the skin rows and the
worn adds). Each pose below is a turn of named bones over the skeleton's REST - retail's own, which is not the bind the
cloak was authored in: skinned into the rest the cloak sits up to 7 units from its bind at the hem (the rest has the
right leg forward) and 6 above the waist, so every fit measures the cloak as the skin places it, never its bind.

1. **The cloak over what it covers** (`fitCloakOver`), held over `CLOAK_FIT_POSES`: the rest, a stride each way
   (the leading thigh 35 degrees, the trailing -30 with its knee bent 45) with both arms swung back 25, and the chest
   leant back 10 (MW-CAPE-RIGID: on the chest alone the lean swings the whole hem forward about the chest, into the
   legs and the tassets - 2.5 units through the ebony plate's, fitted without it). Every point of
   the body and its clothes (vertices, and each edge's interior every unit) that stands behind the cloak's sheet in
   any of them - its front layer where it folds - eases the sheet back past it by `CLOAK_CLEARANCE` (1): the triangle
   over it moves its whole way and the cloak round it less, (1 - (d / 8)^2)^2 of it to nothing at `CLOAK_EASE_RADIUS`
   (8, MW-CLOAK2), a welded seam as one; its normals are then its new shape's. Each pose's push is straight back in
   that pose, carried into the bind the cloak is skinned from through each vertex's own skin blend in that pose
   (measured by skinning unit steps - skinning is affine in the bind, so each pose is measured once), so it rides the
   bones. On the chest alone the ebony pauldrons stand 1.3 through the shoulders at rest, the steel plate 0.7; held over
   the poses the furthest push is 4.6 over the ebony plate and 3.8 over the steel, where the rest alone asks 2.3 and
   1.7 (hung over the spine and the thighs it was 2.6 and 1.3 through, 5.2 and 4.9 held, 3.6 and 2.3 at rest). A
   stride's legs reach at most 1.1 into the cloak as baked, and the fit clears them. A point more than `CLOAK_PUSH_LIMIT` (10) through
   it, past what the cloak has left to give, is no body's: it is left through and the card says so ("cloak: something
   under it stands more than 10 units through it"), never chased. A beast's tail and a carried shield are no part of
   what it covers - they pass through it as through a Morrowind robe.
2. **Stowed gear against the cloak** (`fitStowedGear`), at rest, a holster bone's pieces as one - the scabbard, the
   weapon in it, the quiver's arrows:
   - **Slung** on the back (a bone under `Bip01 Spine1` - the greatswords and the bow): **worn over the cloak**, moved
     back until every point of it clears the sheet's back, after turning about its bone within 15 degrees to lie along
     the cloak's fall - the turn needing the least move, found exactly (a turn's vertices need no more than its samples,
     so the turns are tried in the order their vertices ask and the search stops at the first that cannot win). Moved
     straight back, a greatsword stood off the shoulders by the hem's flare (10.6 units); turned, a greatsword rides
     the cloak 0 to 5.4 units back (5.5 the daedric over the ebony plate), a bow and quiver 6.9 to 8.2. Gear the cloak
     would send more than `SLUNG_MOVE_LIMIT` (15) off the back is left as it hangs, and the card says so.
   - **Hung** at the hip (a bone under the pelvis alone - swords, short blades, crossbows): it stays **under** the cloak,
     pitched forward about its bone the least whole degree that keeps every point in front of the sheet. The addon
     hangs a longsword about forty degrees back, its tip through the cloak's side; under a cloak most swords hang 11 to
     19 degrees nearer plumb (1 to 38 across the addon's blades; a dagger not at all, a crossbow 44 to 52). Pushed back
     over the cloak instead, it would hang some thirty units off the hip. A hip group no pitch within 60 degrees clears
     is left as it hangs, and the card says so.
3. **And it goes with the cloak, every pose** (`followCloak`, AUDIT MW-CLOAK). The cloak rides the chest and gear
   rides its own bone, so the rest fit alone lets the hem sweep through hip-hung gear as the chest leans back over the
   hips (while the hem hung over the thighs it swept through a hip-hung blade on every step its leg went forward too).
   Retail's slung holsters hang from `Bip01 Spine2`, the cloak's own bone, so slung gear and the cloak are one rigid
   body and the follow never moves it (MW-CAPE-RIGID). Each
   holster is tied to the cloak at rest - one contact a 2-unit cell of the gear, the cloak's triangle under or over it
   and where in that triangle, the gear's point in its bone's frame - and every pose after (the assembly's `afterPose`,
   run by `poseAssembly` once every piece is posed) it is turned about its bone, and slung gear also slid straight off
   the back, the least that keeps each contact as far from the cloak as it stood at rest, up to `CLOAK_CLEARANCE`: the
   hem kicks a scabbard's tip aside as cloth would, and a pose the cloak keeps clear moves nothing. A linear law solved
   by cyclic projection, re-taken where the last round left the gear six times, each round's step capped (25 degrees
   and 8 units a pose in all), on arrays made once. Leaning back 10 degrees, the iron longsword turns 12.5 degrees and
   the crossbow 20.5. The slide is kept for a skeleton that hangs a slung holster below the chest; on retail's none
   needs it (while the cloak hung over the spine, three of the addon's longbows did).

   A moved piece's source, and the cloak's batch, are replaced, never written into (a rigid piece's source can be its
   parsed batch's own array), and the live pose is re-placed at once. A weapon swap ties the new holster in its place.

**Seated** (a card table's chair, `player/seatPose.js`, or a saddle) the cloak is the standing cloak: one batch, the
sitting thighs moving none of it, its hem hanging from the chest behind the body. With the hips dropped onto the chair
(SEAT_HIP_DROP) it stands 3.5 units into the floor - see what it does not do. (AUDIT MW-CLOAK had swapped in a seated
batch whose thighs kept 0.3 of their share, `seatCloak`; MW-CAPE-RIGID removed it with the thighs.)

**Measured on the addon's own scabbards** (MW-CLOAK2's cloak, hung over the spine and the thighs - MW-CAPE-RIGID
re-measured the four the pins hold, not all 71) (all 71 under `vendor/weapon-sheathing/`, over the steel and the ebony plate):
as hung, 57 cross the cloak at rest - all but the daggers, the tantos, Keening, the goblin club, the crescent blade and
the fork. After the three fits, none crosses it in any of ten poses - the rest, each arm swung back 20, the spine leant
back 5 and 10 and forward 8, a walk and a stride with each leg back - and no piece of the body or its armour does either
(counted as edges through cloak triangles). Fitted at rest alone, 31 crossed it in a walk. Slung gear also leaves the
plate it had been crossing (the cuirass, the pauldrons). What it costs: the fits about 35 to 40 ms a build, the tie
about 8, the follow a fraction of a millisecond a frame for two holsters.

## MW-CLOAK2: smooth round the shoulders

Mac, of MW-CLOAK1's cloak: "I dont like how the cloak isnt smooth around the shoulders". It was not, and the lighting
could not make it so: the export's 140 vertices stand 6.5 units apart on average, and over the shoulders, where the
sheet turns from the back over the top, the sheet creased - 54 places across the cloak where neighbouring faces bend
past 20 degrees - a face stood up to 35 degrees off its own corners' normals, and the outline turned as sharply as 82
degrees at a vertex: the straps' ends a ragged run of small triangles. The fit then made it worse where armour came
through: it moved a triangle's three corners, so each ebony pauldron left a facet in the cloak over its edge.

**The bake smooths it**: two levels of Loop subdivision (`tools/meshSubdivide.mjs`, `CLOAK_SUBDIVISIONS`), 1,949
vertices - every triangle in four a level, every vertex moved toward the smooth surface the mesh is the net of, the open
edges relaxed along themselves (3/4 the vertex, 1/8 each rim neighbour) so a ragged edge becomes a curve and never pulls
into the sheet; the normals the result's own, facing as the export's did; the UVs linear, the painting being cloth. The
creases past 20 degrees fall from 54 to six, all at the left strap's very tip (a fold a unit across in the export), and
the outline's sharpest turn from 82 degrees to 24 - the smoothing's own work: splitting the faces without moving them
leaves 216 creases and the 82-degree turn. (The shoulders' mean bend between neighbouring faces falls from 14.8 degrees
to 3.0, but most of that is the faces being smaller - a plain split gives 3.4.) The hem stays where it was and the top
within a fifth of a unit. One level was tried and lost: it left the top corner angular. The weights are the smoothed
cloak's own, by the same law. Each mesh is 110 KB (eight, one a painting), fetched by URL when worn. A mesh with a seam,
an edge three faces share, or a vertex where two open edges' runs meet (a bow tie, AUDIT MW-CLOAK) is refused, not torn.

**The fit eases** (`CLOAK_EASE_RADIUS`): a point through the cloak still moves its own triangle the whole way, and now
the cloak round it by (1 - (d / 8)^2)^2 of that, so the sheet bows over a pauldron's edge; at rest over the ebony plate
the push's steepest slope is 0.55 a unit, where the corners alone stepped 9.6, and the 716 vertices it eases move 1.66
on average. The fitted cloak's normals are recomputed from its new shape. Measured again on all 71 of the addon's
scabbards over the steel and the ebony plate: 57 crossed the smoothed cloak as hung, none after, none unresolved.

**What it costs**: the finer hem measures the sprint's back-kick more exactly - with the back thigh 30 degrees and its
knee 45, the trailing boot reaches 2.2 units into the middle of the hem as baked (1.3 against the coarse one); fit 1
now holds the cloak over that stride.

## AUDIT MW-CLOAK: the cloak in motion

Mac: "Lets audit everything so far". Four cold reviews of MW-EBONY1, MW-CLOAK1 and MW-CLOAK2 found the fits held at
REST alone, so the clip Mac asked against came back the moment the body moved: the hem swept through a hip-hung blade
on every step its leg went forward (31 of the 71 scabbards), a greatsword's tip came through the hem in a stride and a
bow's limb as the spine leant back, a pauldron came through the shoulders as an arm swung back, and seated the hem
wrapped forward under the thighs past the knees. The pins had posed the gear only where it did not clip, and the page
said the walk was clean. The fixes are above: fit 1 over a set of poses, fit 3 tying the gear to the cloak every pose,
the seated cloak. With them:

- What stands more than the limit through the cloak is left through and named, not chased (its ring crept up to the
  limit pass after pass); a tail and a carried shield are not under it; slung gear past `SLUNG_MOVE_LIMIT` is named.
- The cloak's icon is the cloak.
- The bake's side: the left ebony boot's stray island across the middle is dropped (`04-Characters/Ebony-Plate.md`);
  hung over its joints, a leg is never the joint law's parent blend either (a calf at its own origin weighed its thigh
  twice); Loop subdivision refuses a bow tie (it dragged one wing across the other) and gives the result its own
  bounds. Every shipped mesh but the left boot is byte for byte what it was.

## What it does not do

- No cloth law: the cloak follows the bones. The hood the paintings show has no shape in the export; it needs a hooded
  mesh.
- One cloak is drawn of two worn.
- The eight meshes differ only in the painting they name (110 KB each, fetched per painting worn).
- Armour more than 10 units through the cloak (a retail robe's flare could be) stays through it, named on the card.
- The follow moves the gear, never the cloak; gear turns at most 25 degrees and slides at most 8 units a pose.
- Seated, the hem stands 3.5 units into the floor (the hips drop onto the chair and the cloak rides the chest down
  with them; nothing lifts it off the seat or the floor) - the owner's chest-alone rig, kept as asked.
- Leaning back past 10 degrees the chest swings the hem further forward than the follow's cap turns hip gear: at 15 the
  crossbow reaches its 25 degrees and 28 of its edges cross the cloak. The sweep's furthest lean is 10.
- The addon's hip positions cross the bulky plate sets themselves - the steel tassets and the left gauntlet - with or
  without a cloak: that is the sheathing's fit to the vanilla body, not the cloak's, and the pitch leaves its total
  about where it was (a crossbow's 514 crossings to 534, some moved onto the thighs).
- The hip lantern (HT-WAIST) is in neither fit. Stowed shields are not in the port yet.

## MW-CAPE-RIGID: the chest alone

The owner, 2026-10-14: "Remove all waypaiting from capes, attach cape mesh to chestbone. So it exclusively moves with
the chest bone and no other bone with effect the vertices of the cape". `tools/bakeCloak.mjs` skins every vertex to
`CHEST_BONE` (`Bip01 Spine2`) at weight one - the hang, the spine, the clavicles and the thighs gone from it - and the
eight NIFs are re-baked (their textures byte for byte what they were). It stays a skinned NIF of one bone rather than a
rigid part on the `Chest` node: retail's bind carries Spine2's frame and not that node's (`Own-Heads.md`), and the fits
edit a skinned cloak's batch. A stride, an arm swung back, a clavicle raised and a seat move none of it; the chest
leant back carries every vertex with it. `seatCloak` and `CLOAK_SEATED_SHARE` are gone (with nothing on the thighs
there is nothing to seat), and fit 1 holds one more pose, the chest leant back 10. What it costs is two residues above:
the seated hem in the floor, and hip gear past its cap leaning back further than the sweep.

## How it was proven

`test/tooling/mwcloak1.test.js` (7): the bake byte for byte, each DDS its painting, the export's hash, one object, no
Morrowind painting; the scene placement, `Tri Cloak 0`, ONE bone - the chest - in every painting, every vertex wholly
its own, and (the hang the ebony plate and the townsfolk keep) a leg never a child or a parent blend (a synthetic rig,
the thigh's weight the hang's alone); the four garments, the dye map, no slot, no shadow, never in the first person,
the weld under it, two cloaks, the census and the report; through the binder the cloak behind the spine, unmoved by
either stride, either arm or a clavicle, carried rigidly by the chest leant back, and through in no stride nor the
lean once fitted; fit 1 on the ebony plate (the live cloak re-skinned at
once, a walk and each arm swung back keeping the pauldrons clear, a second fit moving nothing, a folded cloak); fit 2 on
the vendored daedric greatsword, longbow, iron longsword and iron dagger (the pitched sword's normals turned with it);
and the build's wiring by source, the icon among it, and no seat swap left in it. `test/tooling/mwcloak2.test.js` (3): one level's arithmetic on a small
net (its counts, a flat net staying flat, an edge's 3/8-1/8 rule on an uneven quad, an old vertex's rules on the rim
and off it, Loop's beta on a bump, the normals and the UVs, its own bounds; a seam, an edge three faces share and a bow
tie refused); the cloak's shoulders measured before and after; and the fit's push - its slope eased and not, straight
back, its mean - and its normals, whatever the winding. `test/formats/morrowind/auditmwcloak.test.js` (5), on the shared fixture
`test/fixtures/mw/cloakRig.mjs` and its ten-pose sweep: fit 1 held over the poses (at rest alone an arm swung back
brought a pauldron through, and without the lean, leaning back brought the tassets through); the greatsword, the steel
longbow, the longsword and the crossbow through the cloak leaning back and only then as fitted at rest, tied to it
through none, the rest unmoved, the slung holsters on the cloak's own bone and moved in no pose, every hip turn within
the cap, a slab tied nearer than the clearance unmoved at rest, the frame's arrays reused; `fitThirdPersonCloak` whole
on the ebony plate and then a weapon swap; seated, one batch and the thighs moving none of it;
and what the fits will not chase (a rod far through it, a tail, a shield, a slab across the chest, a hip blade past
its limit, a rod across the back whose edges alone reach the cloak). Rendered posed on the retail rig before MW-CLOAK1
shipped - idle and striding, over the steel and the ebony plate, with each kind of stowed gear.
`tools/mutants/mwcloak1.json` (16), `tools/mutants/mwcloak2.json` (11), `tools/mutants/auditmwcloak.json` (33, two
recorded equivalent: the fit's second pass, which moves nothing on these bodies, and the slide's price, which slung gear
on the cloak's own bone never pays) and `tools/mutants/mwcaperigid.json` (4: the spine below the chest, half the chest's
weight, a thigh painted back into the hem, fit 1 without the lean), all dead.
