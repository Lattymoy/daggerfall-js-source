# AUDIT MW-HEADS1 + MW-FOLK1 (2026-10-13) - the Breton men's own heads and the townsfolk's own outfits, audited

The owner, of MW-HEADS1 and MW-FOLK1 (`04-Characters/Own-Heads.md`, `04-Characters/Townsfolk-Outfits.md`, PR #878):
**"Lets audit everything and make sure its perfect."** This page is the audit of both - the head bake, the outfit bake
and the cut that made its export committable, the rigs, the runtime that wears them, and the record - and its findings,
each with its verdict. What the audit changed is written into those pages as they now stand, each marked `AUDIT
MW-HEADS1` or `AUDIT MW-FOLK1` with the finding's id.

## How it was run

Three lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at 2eddeb8b6 - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), told to reproduce every finding (a script through the real modules, a surviving mutant,
a measurement) before reporting it:

| Lane | Over | How |
|---|---|---|
| 1 | the bakes, the cut, the committed assets (`tools/bakeHeads.mjs`, `tools/bakeTownsfolk.mjs`, `tools/skinWeights.mjs`, `tools/fbxStrip.mjs`, `tools/fbxMesh.mjs`, the NIFs and DDSs) | both bakes re-run byte for byte; every NIF read back (weights, binds, normals, influences); the cut on the committed export, on the original upload and on files written with deformers and two cuts; the outfits bound on the retail skeleton and posed - the idle, strides, the arms raised - measured against a leg proxy (385's hose, the body's own leg) |
| 2 | the runtime (`folkBodies.js`, `peerBodies.js`, `mwItemMap.js`, `fpArm.js`, `mwFirstPerson.js`, the hosts) | real builds through `buildFpArm`; the outfits bound and strode on the retail skeleton; the female skeleton's bytes compared; the chest's coverage from the front; the pools with no own archive; 11,428 walker looks counted |
| 3 | the pins and the record | every committed mutant list run (mwheads1 10, mwfolk1 26, the re-aimed 109), 49 mutants of its own judged against every test file that reaches their module; every figure in the record traced to the code or measured; the gates |

Nothing a player gets crashed. Two bugs a player sees: every leg stood out through the cloth that hung round it at
every stride (398's thigh, knee and shin through her dress), and a Breton man whose page did not load the port's own
archive had no head and no hair. The rest were rigs that sheared or pulled, a cut that could keep the last of two cuts,
records that overclaimed, and laws no pin could fail.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L2-F1 | HIGH | The legs pushed through the hanging outfits at every stride: a hanging island shared 0.7 of the thighs at its own hem and nothing at the waist, and the hides never hid a leg inside a skirt (one leg's rays cross to the other and never meet cloth). 398's knee stood outside her dress front at a 20-degree stride, her thigh, knee and shin at 35; the robes', kilt's and skirts' thighs 1.5 to 2 through at 20 | FIXED: one hang law of position - the thighs' whole share from the hip joints (read off the bind, `hangOf`), the calves taking it past the knees across `KNEE_BLEND`; a leg part inside cloth hanging round BOTH legs all along its span is hidden (398's thighs; her knees stay hers - her hem rises to 29.4 at her sides); pinned striding on retail's skeleton against the body's own leg. RECORDED: 384's and 387's inner thighs 2.3 to 2.4 through at 35 degrees (0.66 at a walk), 398's knees through her dress's long front triangles at a long stride |
| L2-F5 | HIGH | The port's own Breton heads replaced the data's pools with no fallback: where the own archive (a chunk the page imports) did not load, every Breton man was built with no head and no hair, noted "not in your archives", where the data's would have drawn | FIXED: `facePools` takes the archives' directory - the own pools only while every one of their meshes is in it, all or none, the data's otherwise; the third person's rows, the match, its skip and its key read the same; a real build pinned through the shipped files served as the page serves them |
| L1-F1 | MED | Two cuts of one object in one strip call kept only the last (each re-read the original arrays) and reported both: `--cut=Breton_Male.018:6,Breton_Male.018:7` left Morrowind's groin in the file | FIXED: an object's slots are cut in one pass; a slot named twice refused; pinned on the committed export and on a file written here |
| L1-F2 | MED | A cut accepted a skinned or shape-keyed Geometry and left its deformer's vertex indices on the old numbering | FIXED: anything hung from the Geometry refused by name |
| L1-F4 | MED | `islandClass`: 384's side flap, hanging below the hip joints, rigid on the pelvis - the thigh through it 2.2 at a 35-degree stride; the same flap in 382 a skirt by 0.27; a narrow collar would have been a hood | FIXED: a one-sided island reaching below the hip joints hangs; a hood must rise over the scene head's crown; the class law pinned within half a unit of each edge |
| L1-F5 | MED | The upper arms in the torso rig took every side vertex under the armpit: in retail's idle a tunic's side was pulled from 12.9 to 4.9 off the spine axis, the yoke's from 14.1 to 2.3 | FIXED: the arm bones REACH (`skinWeights.mjs` `reach`/`fade`; ARM_REACH 6, ARM_FADE 1.5) - a fade, since a hard edge opened the yoke's seam (6.2) and the neckline; pinned in the idle and under ten poses. RECORDED: up to 8.4 in at the armpit's fold, which must follow the arm or the sleeve's seam opens |
| L2-F2 | MED | `covers` stood the modesty shirt down at the composition, before anything was bound: an outfit that bound nothing left holes where it hid, and a woman's chest bare with Show Nudity off | FIXED: an outfit that bound nothing is composed out again and the body built again - the skin back, the weld asked, the card saying why (`body.outfit.unbound`, in every language); a real build pinned. RECORDED: 398's bodice is open down the front as her picture's is (5 wide, z 94 to 105; the cups from 3 to 10 out) - Morrowind's female chest is not in the tree, **to be seen in game** with Show Nudity off |
| L3-F2 | MED | MWNPC17e's "barely any two alike" was read on hand-built commoner men - pictures 381, 385 and 387, all in outfits now: no producer minted that street. A 385 street shows 9 people, a 387 street 48; nothing recorded that | FIXED: re-read through folkLookOf on Nord women's 392, a picture the wardrobe still dresses (198 of 200); the trade-off recorded on both pages and section 25 |
| L1-F3 | MED | "385's hose is that body's leg repainted": Morrowind's leg is in seven of the eleven outfits - 388/389's hose the same mesh, 386/390's breeches part of it, the boots of 384, 386, 387 and 390 sharing their lower legs; and "`test/tooling/doctrine.test.js` says so on every row" was false for every mesh's row | FIXED, the record: the measured scope on the page, the header and every mesh's doctrine row (to confirm), and **put to the owner** |
| L1-F6 | LOW | Each hanging island hung to its own hem: layered pieces sheared through each other (382's flap through its kilt by 1.09 at 35 degrees) | FIXED by L2-F1's one law of position |
| L1-F7 / L3-F12 / L3-F14 | LOW | Figures: the wraps "to 0.06"/"0.07" (0.066); the hose "within a unit" of the leg lines (0.7 to 1.5, 2.1 to 2.4 at the hip); "1.6 at the shoulder" for every sleeve (1.8 to 2.0; the bell sleeves 0.95; the elbow only 385's); bakeHeads' "3.45" (3.46); PACK_ARM_FALL "fits the bell sleeves" (they sit under its line); 389's hood "an island of 386's tunic" (it is not) | FIXED: each as measured |
| L1-F8 | LOW | Nothing pinned the heads' frame or orientation; on the tree's retail fixture, whose part nodes hang at zero, the head lies on its side | PINNED: each face's crown, nose and chin in its frame (upright, looking +Y), the scene placement a translation. RECORDED: the game's Head node is not in the tree - **to be seen in game** |
| L1-F9 | LOW | `liftHoods` kept the unlifted bounds; fbxMesh read a short ByPolygon material list silently; a cut deleted loose vertices and counted them its own; objectMaterials' diffuse and multi-texture branches never ran | FIXED: the bounds lifted; a short list refused; a vertex no polygon used kept; the branches pinned on files written here |
| L2-F3 / L3-F20 | LOW | 398 and the hoods were measured on the man's skeleton only - the tree's one female skeleton (the sheathing addon's) is the man's byte for byte | RECORDED: the pages say "the man's"; **to be seen in game** |
| L2-F4 / L3-F18 | LOW | THE FOUR HOSTS left out the shipyard's and lighthouse's people (`portHost.js`) and the yards' keepers (`merchantYardsHost.js`), who wear outfits through folkLookOf; worldModes "through rosterBodies" was loose | FIXED: the record; every door that mints a picture's look named by source |
| L2-F6 | LOW | The face-match verdict kept across page loads was keyed on the player's files alone: one kept over the data's heads was read back over the port's own; and every Breton man's build measured all six own parts for a verdict the curated table overrode | FIXED: the key names the pools measured; the match stands down where the curated table answers both halves; it is handed the build's pools |
| L2-F7 / L3-F10 | LOW | The head and hair rows counted the data's records while choosing among the port's; an `own` flag no one read; "for a preload" on four path helpers no preload calls; `isOutfitSlot` with no reader | FIXED: the rows count their pool; the flag dropped (each record now IS a BODY record's reading); the helpers' docs say what they are for, pinned against their tables; fpArm reads an outfit's add by its label |
| L2-F8 | LOW | The beast rule lived only in the look's producer: a Khajiit's or Argonian's look carrying an outfit would have its boots on digitigrade feet | FIXED: the body refuses one too |
| L2-F9 | LOW | One Breton man in three wears the eyepatch (the walk reaches each head alike), where Daggerfall gives it to one portrait in ten | **The owner's call**: a weight on the walk, or a fourth head |
| L3-F1 | LOW | Nothing pinned that an outfit's wearers keep their own faces: every wearer given one hint survived 90 files | FIXED: each hint the wearer's own seed's, a 385 street's nine faces |
| L3-F3 | LOW | The outfit's priority and its place in the order were unpinned: armour's priority and last place both survived | FIXED: under an own steel cuirass and before a shirt, pinned |
| L3-F4 / L3-F19 | LOW | The hairs' slot and part unpinned (a pin related two fields of one record); the pins' BODY records, the HEAD-HELD pieces and the beast residents hand-built | FIXED: each record held to bodyParts' reading of its BODY record; the data's minted by the reader; HEAD-HELD over the producer's piece and the binder's pieces. KEPT: the beast residents' literal - no producer mints a beast into folkLookOf (census walks Nord, Redguard and Breton), and both doors refuse one |
| L3-F5 / L3-F6 / L3-F7 / L3-F8 / L3-F9 | LOW | Refusals and edges no pin could fail: the townsfolk bake's renamed and moved objects, the head box's maximum, the class law's edges, the cut's order and seven refusals and its command line, fbxMesh's reader | FIXED: each pinned, its mutant dead |
| L3-F11 | LOW | "MW-FIT1's 80 rays": MW-FIT1's rings were 36 rays to 15; the 80 are the outfits' own sampler | FIXED: the record |
| L3-F13 / L3-F15 / L3-F16 / L3-F17 / L3-F21 | LOW | "all 32" of h04's chin vertices (no tolerance gives 32 at the chin); "the sixth" the eyepatch (portrait 6, the seventh); "the nine pairs" (the table uses seven); section 12 unamended; "387's skirt" (its boots too) | FIXED: the record |

## The pins and the lists

`test/tooling/mwheads1.test.js` 6 to 7, `test/tooling/mwfolk1.test.js` 9 to 12, `test/tooling/fbxmesh.test.js` 12 to 13. PIN MOVED: MWNPC17e
(`test/characters/mwnpc17_wardrobe.test.js`), MW-D27, MW-D29, MW-D33 and MW-D35 (`test/formats/morrowind/fparm.test.js`), the face verdict's key
(`test/formats/morrowind/mwload_records.test.js`), the directory's count (`test/combat/arrowPick.test.js`). `tools/mutants/mwheads1.json` 10 to
26, all dead; `tools/mutants/mwfolk1.json` 26 to 68 - 65 dead, and three judged equivalent and left alive with their
reasons (an outfit wearer's face index, unread under the hint's walk; capsHead's head arm, no outfit hiding a head; the
bake's cut-slot guard, which bakeMesh's own refusal shadows).

## Put to the owner

- Morrowind's leg is in seven of the outfits (L1-F3); the heads are named for the Morrowind head they were modelled
  from. Whether the geometry is wholly the owner's own work.
- One Breton man in three in the eyepatch (L2-F9).
- In game, with Show Nudity off: 398's open bodice on a woman's chest; 398 and the hoods on a woman's skeleton and on
  Nord and Redguard heads; the heads' turn under the game's Head node (L2-F2, L2-F3, L1-F8).
- Still standing from the slices: h04 against h0411's paintings, the eyepatch's pairing, and the two recolours.
