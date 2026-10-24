# Own Heads - the port's own heads and hairs for the Morrowind body

`tools/bakeHeads.mjs` (the bake) + `tools/fbxMesh.mjs` (one material of an object, `material`) +
`src/characters/ownModels/ownHeadModels.js` (the pools) + `src/formats/morrowind/mwFirstPerson.js` (facePools) +
`src/formats/mwFaceTable.json` (the curated portraits) + `src/tools/mwViewer.js` (the face sheet) (MW-HEADS1, the owner,
2026-10-13)

> "Everything we are doing is for the morrowwind model. This batch is for breton"

with `daggerwind.fbx` (committed as it came, as `src/assets/mw/source/Breton_Heads.fbx`) and six paintings sent as
attachments with no names. Asked who wears them, the owner took the recommendation: **every Breton man** - the three
heads and three hairs replace Morrowind's own Breton men's heads for townspeople, NPCs and a Breton player, and the
player's ten chargen portraits are mapped by likeness onto seven of the nine pairs, portrait 6 the eyepatch.

> MW-HEADS2 (2026-10-15): "some of the ingame heads are backwards on the body and omly the player Britons should
> recieve the new heads, not npcs"

So **the player's alone** - the Breton player and every other player's Breton man - and **turned round**: the bake's
frame faced +Y, and in game the face hung backwards on the body (sections below).

## The export: three heads, three hairs

Three objects - `b_n_breton_m_hair_widow`, `b_n_breton_m_head_05.002` and `.003` - each a face in a head painting and a
hair in a hair painting, two materials of one object. To the game they are what Morrowind's own are: a head part and a
hair part, each its own file, worn in two slots (PRT_Head and PRT_Hair) and chosen each on its own. So each material is
baked on its own (`fbxMesh.mjs` bakeMesh's `material`: the polygons of that material and no other - every existing
bake byte for byte as it was), into six rigid NIFs `breton_m_head_h04`, `_h0411`, `_h0423` and `breton_m_hair_widow`,
`_01`, `_0111`, each naming its own DDS.

**The head's own frame.** A retail head or hair is a rigid part hung under the skeleton's "Head" node
(`02-Formats/Morrowind-Rules.md` rules 5, 12 and 13), its geometry in that node's frame. The three faces share one such
frame - the same crown (z 7.66), sides (x +-4.78) and back (y -6.95), though h04 is a different mesh with a sculpted
beard - so the frame is the source head's (`b_n_breton_m_head_05`, the names say), and each part is baked in it: the
object's scene placement taken back off (`partFrame` - a translation: the scene turned nothing), never re-centred or
scaled. How the game's "Head" node turns that frame is the one link the tree cannot read: no retail skeleton's part
nodes are vendored (`test/fixtures/mw/retailRig.mjs` hangs them at zero). The first bake took the scene's +Y for the
face's, as the scene's body faces - **seen in game, every one hung backwards on the body** (MW-HEADS2, the owner). So
the scene is turned half round about its crown (`bakeHeads.mjs` HEAD_FORWARD `-y`: x and y negated, a rotation and no
mirror, the scene's translation turned with it): in the head's frame each face stands upright and looks **-Y** - its
crown on top on the middle line, its nose ahead under it, its chin ahead of the crown, its back at y +6.95 (AUDIT
MW-HEADS1 L1-F8, re-pinned). A retail head's frame is the same frame, so a retail face looks -Y in it too - and the face
match (MW-D35, `formats/morrowind/mwFaceMatch.js` headFeatures), which took +Y for "Morrowind's forward" (the actor's, not the
Head node's), had measured every head off the back of its skull: it reads the face on -Y now, and its version is bumped
so no verdict kept from the back is read again (FACE_MATCH_VERSION 2). The
owner's scene stood the three at z 125 over its floor, 3.46 over the T-posed scene's own head (MW-STEEL1's
SCENE_BODY) - inside the 3.24 to 4.25 that MW-STEEL5 read the game drawing a retail head over that same head
(`tools/helmLiftProbe.mjs`): the same height, read two ways.

**Every hair over every head.** All three faces share the crown, so every hair sits on every head: from the frame's
origin, a ray through each scalp vertex (above the brow and behind the face) meets each hair no nearer than the scalp,
to 0.05 - three heads times three hairs, nine faces.

## The paintings

The export names each material's picture (`tx_b_n_breton_m_h04.png` and so on); the attachments carried no name and no
metadata. Each part is read by its material AND held to that name (`objectMaterials`), and each painting was matched to
its name by what it is drawn for:

- **The hairs - certain.** The red band paints the headband's own island (0111); the widow's peak runs along its own
  hair's island (widow); the third is the 01.
- **The eyepatch - h0411, by the export's author (MW-HEADS3).** The eyepatch is the one face painting that is not
  mirror-even (its eye band differs from its mirror image by 37.6, the plain faces' by 9), so it wears a full-face
  layout: on h04's, which reads both sides of the face from one half of the painting, it is two eyepatches (the owner
  caught exactly that in an exploration render). h0411 and h0423 share their layout texel for texel, so the layouts
  cannot tell them apart. The first match guessed h0423, the export pairing it with the red headband (object `.003`);
  the export's author, through the owner (2026-10-15): "the eyepatch head was assigned the wrong hair / it gave me the
  rambo hair / ... its using the eyepatch on the wrong head / so the wrong head was given the wrong texture". So the
  eyepatch is h0411's - object `.002`'s face, whose hair in the export is the 01 - and the plain brown beard h0423's:
  the two committed paintings' names swapped (their bytes as sent), the two DDSs re-baked, the meshes unchanged.
- **h04 and the brown beard - judged.** The two plain faces - a black-and-grey beard and a brown one - fit either mesh alike: both
  paintings are near mirror-even, both paint beard over h04's sculpted chin (where its surface stands off the other two
  faces' - 64 vertices by more than 0.1, the chin's with a few at the nose and brow; AUDIT MW-HEADS1 L3-F13), and the detail of each falls in the same share of each layout. The black-and-grey painting is
  h04, its full beard over h04's own fuller sculpt, by eye on the renders; **the owner's to confirm** - a swap is two
  lines of `bakeHeads.mjs` PAINTINGS and a re-bake.

Whether the geometry is wholly the owner's own work is also the owner's to confirm: its objects are named for the
Morrowind head they were modelled from (`test/tooling/doctrine.test.js` says so on the export's row and on every mesh's -
AUDIT MW-HEADS1 L1-F3: the meshes' rows did not).

## Worn

**A PLAYER'S ALONE (MW-HEADS2).** `facePools` answers the port's own only when asked (`own`), and the build asks only
for a player's body: the local player's (`combat/weapon/weaponRig.js` armBuildOptsOf `ownHeads`) and every other player's
(`net/peer/peerBodies.js` playerBuildOpts, the peers' PeerBodies in scenes/world.js). The people's lanes
(`characters/npcBodies.js`), the quest people, the foes and the card table's regulars build on `peerBuildOpts`, which
never asks - and an NPC's walked face never reaches them, asked or not (an NPC is no player). The faces Daggerfall paints
follow their bodies (`04-Characters/Head-Portraits.md`): a player's portrait asks, an NPC's in the talk window, an
escort's (`npc`) and a member of the line not played (`facePose`'s `kin` - their body in the world is one of the
people's, scenes/world.js makeFamilyBodies) do not. The face match's memo is keyed on the pools it measured, so a player's verdict and an escort's
are two.

`ownHeadModels.js` OWN_HEADS holds the Breton men's pools, in id order, as BODY-shaped records (a skin part of a race and
a sex, playable, its slot, its model the shipped file's name - each the very record a BODY of its id, mesh, race and
part reads as). Asked for, `facePools` answers them for a Breton man **in place of the data's** - WHERE THE ARCHIVES CARRY THEM
(AUDIT MW-HEADS1 L2-F5): only while every one of the six meshes is in the archives' directory (`fpArm.js` archiveHas),
all or none, and the data's pools whole otherwise. The port's own archive is a chunk the page imports; one that did
not load left every Breton man with no head and no hair where the data's would have drawn - now he wears the data's,
and the curated ids missing there fall to the match and the walk, as before the port's own. Every door that chooses
a face chooses among the same pools, on the doors it always used:

- **an NPC's face walked off its seed** (`characters/wardrobe.js` npcFaceOf, MWNPC17): the data's pools, never the
  port's own (MW-HEADS2) - every one of their pairs reached;
- **the player's curated face** (`mwFaceTable.json`, which wins first): portrait 0 h0423 + 0111, 1 h0423 + widow,
  2 h04 + 01, 3 h04 + widow, 4 h0423 + 0111, 5 h04 + 0111, 6 h0411 + 01 (the eyepatch, in its own object's hair -
  MW-HEADS3: never the headband), 7 h0423 + 01, 8 h0423 + widow, 9 h04 + widow - each by likeness to Daggerfall's
  Breton portraits (the brown beard's five moved with its painting from h0411 to h0423);
- **the measured match** (MW-D35) and the face index's walk below it choose among the same pools - though for a Breton
  man the curated ten answer every portrait, so no match is measured for him (AUDIT MW-HEADS1 L2-F6: the matcher
  stands down wherever the curated table answers both halves among the pools - it measured all six parts on every
  build for a verdict the table overrode). A verdict kept across page loads is keyed on the pools it measured, so
  another pool - the port's own, or the data's where its archive did not load - is measured anew;
- **a Breton vampire** wears the race's vampire head (`b_v_breton_m_head_01`, the data's) over them, his hair his own.

A Breton woman, and every other race and sex, keeps the data's. The viewer's face sheet (`mwViewer.js`) - the page the
table is authored against - sheets no race and sex the port's own stand for, and names them in its status.

THE FOUR HOSTS (rule 17e). Every body - the player's, a peer's, an NPC's, a foe's - takes its head and hair from
`playerBodyRows` through `facePools`, so scenes/world.js, scenes/exterior.js, scenes/worldModes.js and
scenes/dungeonContext.js are all WIRED through the shared build, and no host's code changed.

## What it does not do

Nine faces for a Breton man who is a player, where Morrowind's data gives him forty-eight. The eyepatch is portrait 6's,
one portrait in ten, as Daggerfall gives it - the walk that put it on one Breton man in three (AUDIT MW-HEADS1 L2-F9)
walks the data's now.
The turn is read off the owner's report, not off a retail skeleton: the tree still holds none of its part nodes, so the
Head node's own rotation is not pinned - only that the port's own heads face as a retail head does.
Breton women's heads are not in this batch. The first person draws no head or hair (rule 7), so nothing changes there.

## How it was proven

`test/tooling/mwheads1.test.js` (8): every head and hair re-made from the committed export and its six paintings byte for byte,
each DDS its painting, the export and each painting by hash, each painting under the name the export gives its
material (a material read as another's picture, and a part off its box on either side, refused); the shipped paths
exactly the pools' parts; each part one rigid shape of its own
material in the head's own frame, its polygons its material's alone, the three faces' shared crown, sides and back,
each face upright and looking -Y (its crown, nose and chin; MW-HEADS2's turn, the bake's own axes and its translation turned with them), the owner's scene height against MW-STEEL5's reading; ONE EYEPATCH - the one-sided painting worn only by a layout that
reads each side of the face from its own half, h04's mirrored layout wearing a face whose eyes match; every hair over
every head's scalp; the pools - each record the BODY record it stands for, read by the reader, the data's (minted as
the data's are) ignored for a Breton man and kept for a Breton woman and a Nord, the port's own only where every one of
their meshes is in the archives (all or none), each row counting the pool it chose among, the curated ten, the match
standing down only where the table answers both halves, the walk over the data's sixteen pairs and never the port's own (MW-HEADS2), a portrait not asked as a
player's the data's, the vampire's head, and the viewer's sheet by source; and through the binder a retail head takes, six rigid pieces under the Head
node, unmirrored, their own geometry, no note; and a REAL BUILD of a Breton man on retail's skeleton - the port's own
head and hair where its archive loaded (makeVendoredArchive over the shipped files, as the page serves them), portrait
6's eyepatch and its hair (MW-HEADS3: the 01) bound under the Head node with no portrait read, and the data's head and hair bound where it
did not, the match asked - and a body not a player's in the data's, its archive loaded or not (MW-HEADS2). MW-HEADS2's
doors by source: the local player's build and the peers' ask, the people's lanes, an NPC's talk-window face and an
escort's do not, the face match's memo keyed on its pools, the third-person body asking as the build was asked.
`test/formats/morrowind/fparm.test.js` AUDIT 32 F1: the face match reads the face on -Y. `test/formats/morrowind/mwload_records.test.js`: the kept verdict's key names the pools measured - another
pool another key, the same pool the same. PIN MOVED (AUDIT MW-HEADS1): `test/formats/morrowind/fparm.test.js` MW-D27 (the picker takes
the archives' directory) and MW-D35 (the matcher is handed the build's pools), `test/formats/morrowind/mwload_records.test.js` (the
key's source), `test/combat/arrowPick.test.js` (eighteen doors pass the one directory). PIN MOVED: `test/characters/mwnpc17_wardrobe.test.js` MWNPC17d's walk and
MWNPC17e's street re-aimed from the Breton men (whose pools are the port's own now) to the Nord men, and its memo pin
read with MW-FOLK1's outfit key. `tools/mutants/mwheads2.json` (16, all dead - the eyepatch in the headband again, the eyepatch's painting on the other head; every Breton man in them again, the player not, the body or the
match or a peer or the local player not asking, the peers built as people, an escort or an NPC's portrait a player's, one
memo for two pools, the bake's +Y, the match reading the back, every member of the line a player on the Family tab).
`test/ui/portrait3d.test.js`: an NPC's portrait walked over the data's, an escort's the data's, a player's the port's own;
a member of the line not played (`facePose`'s `kin`) the data's, as their body in the world. `tools/mutants/mwheads1.json` (26, all dead - the tenth paints the eyepatch onto h04; the audit's sixteen the own pools
without their meshes, the match measured anyway, a key without its pools, the hairs named heads, the crown's refusal
unread, a coverage walk short of the hairs, and fbxMesh's material reader's refusals). The audit: `01-Overview/audits/Audit-MW-Heads-Folk.md`.
