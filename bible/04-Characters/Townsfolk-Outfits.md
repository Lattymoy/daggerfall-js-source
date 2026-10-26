# Townsfolk Outfits - each walker sprite's own outfit for the Morrowind body

`tools/bakeTownsfolk.mjs` (the bake) on `tools/bakeSteelPlate.mjs`'s machinery + `tools/skinWeights.mjs` (the joint law,
and the hang over its joints) + `tools/fbxStrip.mjs` (the cut) + `tools/fbxMesh.mjs` (one material of an object) +
`src/characters/ownModels/ownClothingModels.js` (TOWNSFOLK_OUTFITS) + `src/characters/folkBodies.js` (folkLookOf) +
`src/net/peer/peerBodies.js` (the worn piece, the body key) + `src/formats/morrowind/mwItemMap.js` (composeWornArmor,
composeWornModest) + `src/combat/fpArm.js` (bareHeadRows, the card's rows) (MW-FOLK1, the owner, 2026-10-13)

> "This is for the Townspeople outfits"

with `clothes.fbx` and eighteen pictures, fourteen of them distinct, sent as attachments with no names. Asked how the
townspeople wear them, the owner took the recommendation: **each sprite's own outfit** - a walker whose picture has an
outfit wears it, in that picture's colours, so the body that replaces a picture at its range wears what the picture
wore; a picture with no outfit yet keeps the wardrobe (MWNPC17, `Morrowind-NPCs.md` section 25).

## Which picture each one is

Daggerfall's townspeople are pictures - four outfits a race and a sex (`mobilePerson.js` PERSON_TEXTURES). Rendered
beside the classic walker sprites (read from the freeware ARENA2 in a scratch directory, never committed), the export's
nine objects are eleven of them:

| Sprite | Object | Its shapes (each a painting) |
|---|---|---|
| 381 Redguard | `Redguard_Male.028` | the kit (at the hip and on the feet); the grey robe with the red hem |
| 382 Redguard | `Redguard_Male.002` | the kit - the kilt, the wrist cuffs, the sandals |
| 383 Redguard | `Redguard_Male.010` | the kit; the teal robe with the yellow hem (381's robe, another painting) |
| 384 Redguard | `Redguard_Male.007` | the striped skirt and the boots |
| 385 Breton | `Breton_Male.018` | the striped hose; the tunic; the long sleeves; the kit's pouch |
| 386 Breton | `Breton_Male.038` | the tunic and its wraps; the breeches; the kit; the boots |
| 387 Nord | `Redguard_Male.003` | the striped skirt and the boots; the kit; the shoulder pieces; the green vest and its wraps |
| 388 Nord | `Breton_Male.028` | the green hood and orange tunic; the striped hose |
| 389 Nord | `Breton_Male.028` | 388's hooded tunic in teal - **a recolour**; the hose |
| 390 Nord | `Breton_Male.038` | 386's outfit with the yellow-striped boots - **a recolour** |
| 398 Redguard woman | `Plane Remeshed` | the hooded dress |

Each shape wears the painting the export names on its material, but the two RECOLOURS: Nord 389 is 388's object in the
teal his picture wears (386's tunic painting, drawn for the same tunic), Nord 390 is 386's with the boots in 384's
skirt-and-boots painting, as his picture wears them - judged by eye on renders of each tunic in each colourway against
the sprites, and **the owner's to confirm**. The pictures with no outfit - the Bretons' 391 and 394, every woman but 398 -
keep the wardrobe.

## The export, less Morrowind's own skin

The 385 outfit carried, joined into its own object, 61 polygons of half a groin under the tunic, painted with
Morrowind's own `tx_b_n_generic_m_g00` - a piece of the body the outfits were made on: Bethesda's mesh. The port never
ships Morrowind data, and a public repository publishes what it commits, so MW-STEEL1's law holds (a source is committed
less the body it was fitted on). `tools/fbxStrip.mjs` grew a CUT for it (`--cut=Breton_Male.018:6`): the polygons that
wear one material slot taken out of an object that stays, with the 41 vertices only they used and their normals and
UVs (a vertex no polygon used is no polygon's, and is kept), every slot an object loses in one pass (AUDIT MW-FOLK1
L1-F1: two cuts of one object kept only the last, and reported both), a Geometry a skin's deformer or a blend shape
names by index refused (L1-F2); every other array of that Geometry kept in its order and encoding, the slot left in place wearing nothing (so every
polygon left keeps its material's index), every other record byte for byte. An edge a cut polygon shared with one that
stays would be written again from the polygon that stays (none did here - the galleon's hull is the committed export
that exercises it). The export as sent hashes `ac676b04...`; as committed, `91ac4544...`, and it bakes every outfit
byte for byte as the export did. Every material that carries a polygon is now one of the owner's fourteen paintings.
The outfits were made on a Morrowind body, and its leg is in seven of them (AUDIT MW-FOLK1 L1-F3, by matching vertex
positions): 385's hose is that leg repainted, 388's and 389's the same mesh (270 of 270 positions), 386's and 390's
breeches a part of it (138 of 138), and the boots of 384, 386, 387 and 390 share their lower legs with it (100 of
192). Whether every piece's geometry is wholly the owner's own work is **the owner's to confirm**
(`test/tooling/doctrine.test.js` says so on the export's row and on every outfit's).

## The pose they were made in

The outfits were made on the "Morrowind_Symmetric_TPose_Models" body (the steel plate's is the plain pack's). Its legs,
feet and trunk stand where the steel plate's do, so the scene's floor and SCENE_FROM_BIND stand them on retail's bind
(the hose's cross-sections 0.7 to 1.5 off the thigh and calf lines, 2.1 to 2.4 at the hip). Its ARMS do not: the
sleeves and cuffs stand over retail's arm line - at the shoulder 1.8 to 2.0 (381's and 383's bell sleeves 0.95), at the
elbow 2.3 to 2.9 (385's long sleeve, the one that reaches it), at the wrist 3.2 to 3.3 (AUDIT MW-FOLK1 L1-F7, L3-F12:
one figure, 1.6, stood for every piece). Fitted as two turns of retail's arm, the pack's
clavicle is LEVEL (the fit turns it up 11.46 degrees, the very fall retail's has from its root to the shoulder joint) and
its arm falls `PACK_ARM_FALL` (0.5) from the shoulder joint to the wrist's, where retail's falls 1.83 - the wraps over
the wrists on that line to 0.066, 385's long sleeve to 0.39 at its worst, where retail's line is 3.2 under the wraps. So the outfits are skinned in THEIR pose (`packBind`: retail's bind with each arm turned so, every other bone
retail's), and the inverse binds written are that pose's: the game's own skinning lays each sleeve on the arm it
animates, and no vertex is moved to fit.

## Each piece weighted by what it is

Each connected island of a painting (joined by a shared position) is one garment piece, and is weighted by what it is
(`islandClass`, by its box in the outfit's frame): over the shoulders and narrower than them a **hood** (the neck and
the head); out along one arm that **arm's** piece (its clavicle, arm, hand and fingers); round both legs and down past
the hip joints (76) cloth that **hangs** - a tunic's hem, a kilt, a skirt, a robe - the torso's law above the waist and
the thighs taking their share below it, `HANG_SHARE` (0.7) at the piece's own hem from nothing at `HANG_TOP` (84), split
across `HANG_CENTRE` (4) either side (`jointWeights` mode 'over', the ebony breastplate's tassets'); across the middle
above the hips the **torso's** (a collar, a vest, a bodice, a belt); down one leg that **leg's** (its pelvis, thigh,
calf and foot); anything else at the hip - a pouch, a buckle - the **pelvis's**, and anything one-sided that reaches
below the hip joints hangs (AUDIT MW-FOLK1 L1-F4: 384's side flap stood rigid on the pelvis, the thigh through it 2.2 at
a stride). A hood must rise over the scene head's crown: a collar no higher than the neck is the torso's.

THE HANG IS ONE LAW OF POSITION (AUDIT MW-FOLK1 L1-F6, L2-F1). Each hanging island hung to its own hem, sharing 0.7 of
the thighs at it: layered pieces sheared through each other, and every leg stood out through the cloth that hung
round it each stride - 398's whole thigh, knee and shin through her dress at a 35-degree stride. Now the thighs take a
growing share from nothing at the waist (`HANG_TOP`, 84) to the whole (`HANG_SHARE`, 1) at the hip joints, read off
the bind (`hangOf`), split across `HANG_CENTRE` (4) either side; and past the knees the calves take it from the
thighs across `KNEE_BLEND` (3) either side, so cloth hanging past a knee goes with the shin. THE ARMS REACH
(L1-F5): the upper arms claim the body's side only within `ARM_REACH` (6) of their bones, fading over `ARM_FADE`
(1.5) past it - nearest-bone, they took every side vertex under the armpit, and retail's idle pulled a tunic's side 8
into the chest; a hard edge opened the yoke's seam, a fade does not. The law is a function of position alone, so no
seam between pieces opens past 1 under any pose pinned (398's bodice and sleeve part 0.63 under an 80-degree raise of
the arm - the joint law's own stretch, the same under the law before). Every vertex's weights are whole.

**A hood is a helm.** The hoods (388's, 389's, 398's) were made over the T-posed scene's head, which the game draws
`HELM_LIFT` lower on its bone than its own (MW-STEEL5) - at the game's head the scalp stood through them. A hood's
island is raised `HELM_LIFT` onto it, as the open steel helm is, and rides the head: in retail's idle it stands in the
head bone's own frame where the bind put it, 11 up the bone over the crown.

## Worn

- **The look.** `folkLookOf` gives a walker whose picture has an outfit (`townsfolkOutfitOf`) - of the walker's own sex
  (`spriteSex`), and not a Khajiit's or an Argonian's - that outfit (`outfit: 'townsfolk_<archive>'`) and no garment of
  the wardrobe's; the person in it is their own (the hint's head and hair, their face). A beast on an outfit's picture is
  dressed by the wardrobe, and its figure wears what the Beast Footwear and Beast Helmets switches draw of it (BEAST-BOOTS,
  `mwItemMap.js` beastCut; As worn by default; until 2026-10-24 `wardrobe.js` beastWorn took the helm and boots off). Every walker of
  one picture dresses alike, as Daggerfall's pictures do; their faces differ (the hint off their own seed - AUDIT
  MW-FOLK1 L3-F1). So one picture's street shows as many people as its race has faces: 48 on a Nord's 387 (the data's
  eight heads times six hairs), 9 on a Breton's 385 (the port's own) - where the wardrobe dresses nearly every walker
  apart (MWNPC17e, re-read on Nord women's 392, a picture it still dresses: 198 of 200; L3-F2). A resident is dressed the same way off
  their own id (`rosterBodies.js` residentLook) - the watch off duty in the outfit his civvies' picture wears.
- **The body.** `peerBuildOpts` hands the outfit to the build as a worn piece of its own kind (`{ kind: 'outfit', id }`)
  - none for a wolf, nor for an id the table does not hold, nor on a beast whatever the look says (the look is read as
  data - AUDIT MW-FOLK1 L2-F8); the body key reads it
  (`outfitKeyOf`), so another outfit is another body.
- **The composition** (`composeWornArmor`), the cloak's door: one add, `outfit (<id>)`, claiming no slot; the skin it
  covers all round is HIDDEN - occupied with no mesh, at clothing's priority, under the outfit's add (MW-FIT1's
  occupation) - in the third person only, which alone draws an outfit - and composed first, as a robe is: armour over it
  takes its slots (strictly greater), a garment after it at clothing's priority none (AUDIT MW-FOLK1 L3-F3, pinned). A
  second outfit, or an id the port does not carry, is a note. The paperdoll card names it `outfit <id>`, and the rebuild key reads it by its id.
- **What it hides** is what every one of 80 rays out of a part's bone line meets, in the pose it was made in (16 round
  at five places, reaching 5 to 16 - MW-FIT1's measure on `test/tooling/mwfolk1.test.js`'s own sampler; MW-FIT1's rings were 36
  rays to 15, L3-F11) - and a leg part inside cloth hanging round BOTH legs all along its span, every ray out of the
  line between the legs meeting it (AUDIT MW-FOLK1 L2-F1: one leg's rays cross to the other inside a skirt and never met
  it, so 398's dress hid nothing of the thighs it closes round):

  | Outfit | Hides |
  |---|---|
  | 381, 382, 383 | the groin |
  | 384 | the groin, the ankles, the feet |
  | 385 | the chest, the groin, the upper arms, the forearms, the upper legs, the knees, the ankles, the feet |
  | 386, 390 | the chest, the groin, the wrists, the upper legs, the knees, the ankles, the feet |
  | 387 | the groin, the wrists, the ankles, the feet |
  | 388, 389 | the chest, the groin, the hair, the upper legs, the knees, the ankles, the feet |
  | 398 | the groin, the hair, the upper legs, the feet |

  The near misses keep their skin: a V-neck (381's and 387's chests, 77 of 80), 385's cuff short of the wrist (60), the
  hooded woman's open bodice (her chest 50, her neck 47); no outfit closes round the neck. A hem short of a part's span
  hides none of it - the leg below a tunic is the body's, the cloth following the thighs - and 398's knees are hers: her
  hem rises to 29.4 at her sides, and hiding them would open the shin's top under it. A hood hides the hair, as a helm
  does.
- **The modesty weld** (`composeWornModest`): an outfit names the skin it dresses without hiding (`covers`) - 398's
  bodice over her chest, her midriff bare under it as her picture's is - and a chest it covers takes no shirt. Her
  bodice is open down the front, as her picture's is: 5 wide from z 94 to 105, the cups standing from 3 to 10 out to
  either side. Morrowind's female chest is not in the tree, so how it sits under them is **to be seen in game** with
  Show Nudity off (AUDIT MW-FOLK1 L2-F2).
- **An outfit that bound nothing hides nothing and dresses nothing** (AUDIT MW-FOLK1 L2-F2): its `hides` and its
  `covers` were read at the composition, before its mesh was - one not in the archives (the port's own archive is a
  chunk the page imports), a parse that failed or no shape its bones take left holes where it hid, and a woman's
  chest bare with Show Nudity off. The body is composed again without it and built again (`fpArm.js` buildFpArm): the
  skin it hid stands, the weld asks its shirt, and the card says why (`outfit <id>: none of it bound - drawn without
  it`, read off the composition the body was built from).
- **HEAD-HELD** (`Field-Bugs-2026-10-12b.md`): a hood that bound nothing gives the hair back, as a helm does - an add
  that hides the head or the hair from a part of its own caps them (`capsHead`) - and the note names the outfit.

THE FOUR HOSTS (rule 17e). The looks are the populations' adapters: scenes/world.js (the street's walkers, the residents
walking it, the roads' and rooms' people through `world/travellerSprites.js`, and - hosted there - the shipyard's and
the lighthouse's people (`scenes/portHost.js`) and the stable and wagon yards' keepers (`scenes/merchantYardsHost.js`),
a Redguard port's men in 381 to 384's outfits) and scenes/exterior.js (the location's walkers) are WIRED through
folkBodies and rosterBodies; every door that stands a picture's person in a body mints the look through folkLookOf
(AUDIT MW-FOLK1 L2-F4, L3-F18: the yards and the port were in no record, and are named by source now).
scenes/worldModes.js draws the residents indoors on world.js's room lane (`host.drawLivingBodies`) - no host's code
changed. scenes/dungeonContext.js is FLAGGED by name: no walker or
resident stands in a dungeon (its people are foes and standing people, dressed by their kit and faction), so no picture
these outfits are made for stands there.

## What it does not do

Eleven pictures of twenty-four: the Bretons' 391 and 394 and every woman's picture but 398 keep the wardrobe until
their outfits come. No cloth law - the outfits follow the bones, and a stride's far end shows it: 384's and 387's inner
thighs stand 2.3 to 2.4 through their skirts at a 35-degree stride (0.66 at a walk's 20), 398's knees and shins through
her dress's front at a long stride (its triangles are long), and a tunic's side under the armpit is still drawn up to
8.4 in toward the chest in the idle - it follows the arm, or the sleeve's seam opens. Read on the vendored retail
skeleton - the MAN's (the only woman's in the tree, the sheathing mod's addon, is the man's byte for byte) - and
rendered there (the idle, a stride): 398 on a woman's skeleton, and the hoods on Nord and Redguard heads, are **to be
seen in game** (AUDIT MW-FOLK1 L2-F3, L3-F20).

## How it was proven

`test/tooling/mwfolk1.test.js` (12): every outfit and painting re-made from the committed export, its fourteen paintings and
retail's skeleton byte for byte, each DDS its painting, the export and each painting by hash, every polygon-carrying
slot an owner's painting and every painting worn, the cut slot Morrowind's own skin and wearing nothing, each shape the
painting the export names but the two recolours (each its twin's shapes in another painting), the bake's refusals; the
cut on the committed export - an empty strip the file, a slot no polygon wears and a whole object and a dropped one
refused, a cut of 385's pouch baking every other material as it did and keeping every slot, the edges exactly the
polygons' own (the galleon's hull cut, where 65 shared edges must be written again), every vertex left used; on a file
written here, a loose vertex kept, Direct normals and their W kept corner for corner, an index table kept to the
entries still used and re-pointed, two slots of one object in one pass, and every refusal - a deformer, a shared
Geometry, a record the cut does not know, another mapping, a short material list, an open last polygon, a slot named
twice - and the command line's `--cut=` run; the pose -
retail's clavicles' fall, the pack's level and its wrist PACK_ARM_FALL under the shoulder, every other bone retail's, the
two arms turned alike, the wraps and the long sleeve on its line and off retail's, every NIF's binds that pose's; each
piece's class and rig (a table of every outfit's islands), the hang's one law at every hanging vertex, the arms' reach
and its fade, the hoods raised HELM_LIFT and nothing else moved, the class law within half a unit of each edge; what
each outfit hides measured by the rays, side by side, and both legs' enclosure;
the looks (each of the eleven in its picture's sex whatever the seed, the thirteen others, a woman on a man's picture, a
beast, a resident, the watch; each wearer's hint off their own seed, a 385 street's nine faces; every door that mints a
picture's look, by source); the look to the body (the piece, a wolf's none, an unknown id none, the body key; the
composition, the shadows, none in the first person, the notes, the card's rows, the rebuild key; a beast's none; under
armour and before a shirt; the coverage walk exactly the outfits); the hooded woman's no-shirt and HEAD-HELD over the
hood the producer composes and the binder hands back; and through the binder every outfit the producer composes a skinned part on retail's
skeleton with no note, each arm piece on its arm, each leg piece on its leg, the hood riding the head, and in a stride
385's tunic hem going with the leg less than its knee while its chest stays; striding, the leg inside the cloth that
hangs round it, the body's side on the ribcage in the idle, no seam open; and a REAL BUILD - 398 bound where the port's
archive loaded, and where it did not composed out again, her hair back, the shirt asked and the card saying why. PIN
MOVED (AUDIT MW-FOLK1): `test/characters/mwnpc17_wardrobe.test.js` MWNPC17e read on Nord women's 392 through folkLookOf;
`test/formats/morrowind/fparm.test.js` MW-D29 and MW-D33 (the third person built again without a lost outfit, the card reading what it
was built from). PIN MOVED: `test/characters/mwnpc7_folk.test.js`
MWNPC7a (the eleven pictures their outfits, the wardrobe's variety read on Breton 391) and
`test/characters/mwnpc10c_roads.test.js` MWNPC10c-2 (383 its outfit, the wardrobe's resident a Breton 391's, the watch off duty in
381's). `tools/mutants/mwfolk1.json` (68: 65 dead, and 3 the audit judged equivalent and left alive, each with its reason).
The audit: `01-Overview/audits/Audit-MW-Heads-Folk.md`.
