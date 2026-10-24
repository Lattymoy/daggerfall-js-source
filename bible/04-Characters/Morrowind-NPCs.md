# Morrowind NPCs (MW-NPC arc, ACTIVE, opened 2026-10-09)

Mac, 2026-10-09: "in the wayyyyyy past we worked on implementing morrowind
NPCs/enemies and its work id like to return to and polish", then: "It was an
undertaking at the time but I think now is the perfect time to do this right.
I wanna do everything and ensure that performance isnt affected."

THE GOAL. Every living non-player actor the running game draws - foes, the
watch, townsfolk, the people in buildings, quest people, creatures - stands
in a Morrowind body under the enhanced skin with Morrowind data attached,
the way the player and the other players already do; and the frame does not
pay for it. Port-Doctrine's plank 2 (SUPERSEDED BY MAC, 2026-08-30) named
"in time NPCs and enemies" as the destination; this arc is that time.

## 1. What came before, and why it is not restored

THE NPC ARC (NPC1-NPC5, 2026-08-31 / 2026-09-01) did this once, merged to
main, and was reverted whole eight minutes after the texture-system break
(`3f77ca62`, "Mac's call"; its code survives at `51e57bd6` on
`claude/morrowind-3d-model-integration-4c18q3`). No reason was written down.
Read back on 2026-10-09, it shipped every one of these, any of which a player
would see:

- a foe swinging at you played idle or walk - no attack, hurt, cast or
  death group was ever driven, and a dead foe fell back to the classic corpse
  sprite;
- every class foe was a Breton with face 0, and every guard the same man;
- the wardrobe collapsed: every piece carried dye 0, so `mwClothingRecord`
  answered one record per CLOT type and the five social tiers dressed alike;
- the wandering crowd faced +z whatever way it walked (`person.yaw ?? 0`;
  MobilePerson's facing is `facingYaw`);
- and NOTHING WAS BUDGETED: per actor per frame a CPU skin of every vertex, a
  whole repack, a whole VBO re-upload, one offscreen sprite pass - N actors
  in one outfit re-uploading the same buffer N times - with no range, no
  cap, no pose cadence and no frame budget. No frame time was ever measured.

Main has since learned the budget half on the peers' bodies
(`07-Rendering/Performance-Rig.md`: PERF-RIG1, PEER-CADENCE, WB9h, MW-CROWD -
"unplayable with so many players around" at forty peers), and every one of
those pages ends on the same open item: the skin is still on the CPU, and
the sprite render is still one offscreen pass per body per frame. This arc
starts there. Restoring 13 commits onto a tree 700 pull requests newer would
restore the architecture that cannot hold a town.

## 2. The scale the arc must hold (measured off the hosts, 2026-10-09)

| population | owner | how many |
|---|---|---|
| dungeon foes | dungeonContext.js `buildFoeAt`, `spawnLooseFoe`, `spawnQuestFoe` | every layout marker, elite x3: dozens to 100+ |
| encounter / interior foes | exteriorFoes.js `spawnFoe` (two instances) | rolled cap 8 (32 wild) plus uncapped placed/quest/managed/puppet |
| the watch | cityGuards.js `spawnGuardAt` (two instances) | 5 spawns, 10 puppets online |
| town walkers | townPopulation.js / livingTown (`MobilePerson`, `ResidentWalker`) | 24-96 a populated pixel, recycled past 150 m |
| static people | street (world.js `standPixelNpcs`), interiors (interiorContext.js), dungeons, quest people (worldModes.js `standQuestFlatIn`) | a town's worth |
| crews, road parties, siege, gate court, broker | navalCrew, livingRoads, siegeNpcs, gateCourt, sigilBrokerPool | tens |
| arena crowd | arenaBouts.js | up to 420 flats |
| ALREADY MORROWIND | familyBodies.js, cardRegulars.js (PeerBodies) | at most 8 per PeerBodies instance |

So the arc can never mean "a body for everyone in view". It means a body for
the NEAREST ones, as many as the budget holds, and the classic sprite for
the rest - the same picture Daggerfall drew, at the distance where a 3 px
Morrowind texel and a 9 px Daggerfall one stop being told apart.

## 3. THE PERFORMANCE LAW (what "performance isn't affected" is held to)

Each line is a slice's acceptance, not an aspiration:

1. NO CPU SKIN FOR A BODY IN THE WORLD (MWNPC1). The skin runs in the vertex
   shader: the body's stream is uploaded ONCE at build, and a pose costs the
   skeleton plus one palette (an affine per bone a piece names) - kilobytes,
   where today it is every vertex blended in JS and the whole stream
   re-uploaded.
2. ONE OFFSCREEN BIND A FRAME FOR EVERY BODY (MWNPC2). The seen bodies are
   rendered into tiles of the one sprite target in a single bind, and their
   quads drawn after - not one target pass, two framebuffer switches and a
   re-sent character block per body.
3. NO LONG TASK FROM A BUILD (MWNPC3). A body for an actor is the
   third-person body alone (no first-person arm, no reach sweep it never
   draws), parsed meshes are shared by path, GL textures by file, and a
   build yields under a per-frame time budget.
4. ONE BUDGET FOR EVERY BODY IN THE GAME (MWNPC3/4). Peers, family, card
   regulars and NPCs draw from one pool: a global cap, nearest first, party
   and talking partner ahead of strangers, the pose budget and the distance
   cadence PEER-CADENCE/WB9h proved, the view cull, and a range past which the
   classic sprite stands. AMENDED BY MWNPC4 (section 9): one BUILD queue for
   every lane, and caps per lane that SUM - not one pool - so a townsperson
   never takes a player's body; the frame's bound is the sum, stated there.
   AMENDED AGAIN BY MWNPC11 (section 16): ten slices made the sum a port's
   street's eight lanes; the NPC lanes now share ONE FRAME BUDGET
   (NPC_FRAME_TIERS - 24 bodies and 8 skins at Near, 48 and 16 at All),
   the nearest across every lane, below what MWNPC7 summed for three. The
   peers keep theirs: a townsperson still never takes a player's body.
5. MEASURED. A probe drives a town's walkers, a watch and a dungeon's foes
   through the real lane and reports skins, uploads, offscreen binds and
   builds per frame (counts, as WB9h's - the fixtures understate retail
   milliseconds); the `?perf=cpu` `bodies` zone is the field's readout.
   MET BY MWNPC11 (section 16): `tools/mwNpcLaneProbe.mjs`. The field's
   `bodies` zone reads the peers' pass; each NPC lane draws at its host's
   own point, inside that host's zone (the meter's zones tile the frame,
   so a lane's time is never counted twice) - the probe is the measure.
6. A SWITCH. The pause card carries the lane (Off / Near / All) on the port's
   prefs shelf, so a machine that cannot hold it gives it back. (AMENDED BY
   AUDIT MW-NPC II P6: no pause card carries it - a Settings row does,
   Combat > With Morrowind data, ORG2's tab: `mwNpcBodies`, Near the
   default, read every frame - section 22.)

## 4. Slices

| slice | what lands | hosts |
|---|---|---|
| MWNPC1 GPU SKIN | the third-person body's skin in the vertex shader: static stream, per-pose palette, face normals from the triangle's own derivatives, boxes off the palette (rule 42), the CPU path kept for the first-person arm and as the fallback | renderer + fpArm: every third-person body (player, peers, family, regulars) |
| MWNPC2 ONE PASS | every seen body into one bind of the sprite target, quads after | the body pass in world.js / worldModes.js; exterior.js has none |
| MWNPC3 THE BODY SERVICE | one parse a mesh and one GL texture a picture across every body, no reach sweep for a body never looked out of, an instance's own limits (SHIPPED, section 8); third-only builds and a build gate across lanes moved to MWNPC4 | all |
| MWNPC4 THE NPC LANE | the lane (`characters/npcBodies.js`: the NPCs as synthetic peers under a tier's caps, `has()` for the host's billboard), the hit recoil and the death on the rig and off the pose, one build queue across every lane (SHIPPED, section 9); an actor's machine read into the pose is each population's adapter, MWNPC5 onward | the rig and the lanes; the four hosts flagged, wired with the first population |
| MWNPC5 FOES | class foes in their rolled equipment, a stable race and face per foe (not one Breton), the effects parity: hit flash, glint, elite glow, dissolve, concealment (5a SHIPPED, section 10: the glint, the elite's glow, outline and embers and the dissolve on the body's quad - the hit flash and the concealment it already drew); 5b SHIPPED (section 10b): the dungeon's foes, the cast-only billboard, the Features row; 5c SHIPPED (section 10c): the encounter pool - the exterior, the interiors, exterior.js; shadows kept (the billboard casts - AMENDED BY MWNPC16, section 24: the body casts its own shape, the billboard none) | dungeonContext.js, world.js (exteriorFoes), worldModes.js (interior foes), exterior.js |
| MWNPC6 THE WATCH | cityGuards' two instances (SHIPPED, section 11: a lane of its own under WATCH_BODY_TIERS) | world.js, worldModes.js, exterior.js; dungeonContext.js stands none (named) |
| MWNPC7 TOWNSFOLK | walkers and living residents, a wardrobe by FACTION sgroup that actually varies (distinct records and dyes per persona) (the WALKERS SHIPPED, section 12: a wardrobe per outfit variant, dyed per spawn - the living residents indoors are MWNPC8's standing people) | world.js, exterior.js, worldModes.js (living residents indoors) |
| MWNPC8 STANDING PEOPLE | street, interior, dungeon and quest StaticNPCs; children and vampires keep their sprite; `drawnFlat`'s nudity law honoured (8a SHIPPED, section 13a: the buildings' people; 8b SHIPPED, section 13b: the dungeons' and the street's; 8c SHIPPED, section 13c: exterior.js's and the quests' stands) | all four |
| MWNPC9 CREATURES | CREA records, creature skeletons and their own .kf, the match table with its declared misses (9a SHIPPED, section 14a: the body; 9b SHIPPED, section 14b: the rig, the match, the hosts) | dungeonContext.js, world.js, worldModes.js, exterior.js |
| MWNPC10 THE REST | crews, road parties, siege, gate court, the broker (10a SHIPPED, section 15a: the gate court; the broker keeps her guise. 10b SHIPPED, section 15b: the siege and the crews. 10c SHIPPED, section 15c: the roads' parties and the living residents indoors) | their hosts |
| MWNPC11 ONE FRAME | every NPC lane on one frame budget - the nearest bodies across all of them, the skins shared out - and the lanes probe (SHIPPED, section 16) | every lane (createHostNpcBodies) |
| MWNPC12 STEEL AND ORCS | the steel no look ever wore (material 1 named none) worn; the four orcs as people in Morrowind's Orc body (SHIPPED, section 17) | foeBodies.js, folkBodies.js, peopleBodies.js - every foe host and roster through them |
| MWNPC13 THE SPECTRAL DEAD | the ghost and the wraith as Morrowind's ancestor ghost under a standing veil at the spectral sprite's opacity (SHIPPED, section 18) | every foe host (each draws its veiled bodies), the roads |
| MWNPC14 THE VAMPIRES | the vampire foes as people with their race's vampire head - the BODY record's vampire flag read, getVampireHead's choice built (SHIPPED, section 19) | the format layer, the rig, the peer layer; every foe host through foeBodies.js |
| MWNPC15 THE WEREWOLF | the werewolf foe in Bloodmoon's wolf - its look marked wolf, the pose the wire's own wolf bit (SHIPPED, section 20) | the lanes (npcShown); every foe host through foeBodies.js |
| MWNPC16 THE BODY'S OWN SHADOW | an NPC's body casts its own shape - the skinned depth program off its palette, a run of ranges one draw, unseen bodies cast where they stand; the flat under it casts nothing (SHIPPED, section 24) | the shadow pass, the rig, every NPC lane |
| MWNPC17 THE WARDROBE | who wears what by role, dressed off the seed - silhouettes, garments, dyes, cloaks, armour kits, Morrowind's clothing ladder; each garment's record picked and the head and hair walked off the look's `npc` hint (SHIPPED, section 25) | wardrobe.js; the item map, the build; every look producer |
| MWNPC18 THE PLACED FIGURES | a figure a player set down in a home or a yard stands in a body - its sex and role off FLATS.CFG (SHIPPED, section 26) | worldModes.js (rooms), world.js (yards) |
| MWNPC19 THE FLATS THAT STAND | the standing horses (TEXTURE.201's, a World of Daggerfall site's, the Stables') as the 3D horse; a person's flat no StaticNPC holds (a factionless figure, a site's people, a marker's captive, a boat's crew) in a body (SHIPPED, section 28) | world.js, exterior.js, merchantYardsHost.js, comeSailAwayPool.js; worldModes.js and dungeonContext.js named |
| NPC-MARKS | a bobbing pixel-art mark over a body whose click is a quest's (a yellow "!" - the work pool's questor too), a merchant's (an amber coin) or a guild's or the arena's (a blue gem), read off the click's own route (SHIPPED, section 30; AUDIT NPC-MARKS, section 31) | worldModes.js (interiors, dungeons), dungeonContext.js (its lane handed), world.js (the street), exterior.js (the bench) |

Click and talk boxes keep the billboard's size (they are the classic
game's); the arena crowd stays flats.

## 5. The old arc's lessons, carried

- "No weapon" is `MW_WEAPON_TYPE.None` (-1), never 0 (cross-arc A1).
- Every memo stands down without a data generation, and an actor re-asks
  when the generation moves (NPC1 F1, A5).
- A pooled actor that is re-rolled in place (TownPopulation's
  `_randomiseNPC`) keys its body by identity, not by object (AUDIT-N F3).
- Every GL object a body makes has an owner and a release (A2, AUDIT-N F4).
- A slice is finished when its seam is on the path the player takes:
  `main.js` boots `bootWorld`, so world.js and worldModes.js are the host
  that matters, and a gate test enumerates every host that draws living
  actors (NPC4b).
- A probe must read the thing it measures through the one home that sizes it
  (AUDIT-N F1, `fpViewportSize`), and a two-actor shot proves order
  independence - A after B equals A after A (NPC5).
- A paralysed foe's sprite is not frozen in DFU (AUDIT 24 wave 33); main
  still freezes the exterior foes' (exteriorFoes.js), and that is to be read
  before a body copies it.

## 6. MWNPC1 - GPU SKIN (SHIPPED 2026-10-09)

THE COST IT REMOVES. Every third-person Morrowind body - the player's,
every peer's (net/peer/peerBodies.js), the family's and the card table's (the
same lane) - paid at every posed frame: poseAssembly blended every vertex
of every skinned piece and placed every rigid one in JS, packFpArm
de-indexed the whole stream with a cross product a face, and
updateCharacterMesh re-uploaded all of it (~0.3 ms a body at 3,000
vertices on the fixture, PERF-RIG1; more clothed, and an NPC lane would
multiply it by the crowd).

WHAT IT IS NOW.

- `formats/morrowind/mwGpuSkin.js` lays a body out ONCE (`skinLayout`,
  `packSkinStream`): packFpArm's corner order and ranges, each corner its
  authored vertex, its diffuse/UV/emission (fpArm.js `pieceLanes`, the
  colour laws' one home) and its influences - up to eight palette
  entries and weights, and the entry of its post. A pose writes the
  PALETTE alone (`writeSkinPalette`): entry 0 the identity, per skinned
  piece its post (mwSkin.js `skinPost`, now the one home both skins call)
  and one `affineMulInto(skelMat, invBind)` per live bone, per rigid piece
  its placement (the attachment, or `hangAffine` for a part that hangs).
  Kilobytes a pose where the stream was hundreds.
- `render/renderer.js` CHAR_SKIN_VS blends it: the influences' rows summed
  in slot order (the bone order skinBatch adds in), the post composed onto
  the sum once (MW-D31), applied to the stream position. The palette is an
  RGBA32F texture on its own unit (`render/skinPalette.js`: 341 entries a
  row, unit 21); `createSkinnedCharacterMesh`, `updateSkinPalette`,
  `releaseCharacterSkin`. The world's character program is now this VS for
  every character - `uSkin` 0 never looks at the skin channels, so the
  voxel rigs and the CPU-skinned arm draw exactly what they drew; the
  shadow pass keeps CHAR_VS and its door turns a skinned body away.
  (AMENDED BY MWNPC16, section 24: the pass takes this shader's own depth
  program for a skinned body, recorded by its draw - drawCharacter still
  records nothing under the sprite target.)
- THE FACE NORMAL. packFpArm lights each triangle by the cross product of
  its POSED corners, which a vertex cannot know. `skinFaceFs` teaches every
  lane's character fragment shader to take it off `vRel`'s derivatives -
  exact, because a varying is linear across its triangle - signed by the
  winding against the renderer's CW front face, and carried through
  sign(det M) M M^T and the mirror's flip back to the packed path's
  `mat3(uModel) x n` (a race's unequal weight and height included).
  AMENDED AT THE MERGE OF MAIN (section 22): main's MW-SMOOTH lights a
  mesh by its own normals, so the stream carries the authored normal and
  the vertex shader turns it; the face normal is the fallback where a
  corner has none.
- THE LAWS KEPT: a missing bone skipped, nothing renormalised (rules 39,
  40), a vertex touched only by missing bones or zero weights collapsing
  onto the post, an untouched one keeping its authored position, a rigid
  part's mirror and BoneOffset baked as placeAtBone applies them. A vertex
  blended by more than eight bones is REFUSED (a sentence on the rig's
  notes, the CPU skin for that body), never trimmed.
- THE BOXES (rule 42: a skinned mesh's bounds come from its bones). The
  sprite law frames a body by its posed boxes, and there are no posed
  vertices now; each piece keeps, per palette entry, the box of the
  vertices that entry moves, and a pose carries them through their entries
  - the union is never smaller than the fold it replaces. The box is the
  window, never the size (PR-BOW1), so the picture is the same with a
  margin. The inventory portrait frames itself by the box, so it poses on
  the CPU for its exact fold - once, for a cached picture.
- fpArm.js: `thirdSkinReady` decides before the pose (`poseAssembly(...,
  { skin: false })` poses the skeleton alone), `uploadThirdMesh` makes the
  skinned mesh once and writes the palette each pose, the third-person
  muzzle skins its one point by the shader's law (`skinnedVertex`). The
  first-person arm keeps the CPU skin (one body, drawn lens-local; its
  held sheet and muzzle read posed vertices every frame).
- `?gpuskin=off` is the bisect back to the CPU skin; a renderer without the
  path (every counting renderer in the suite) keeps it too.

PROVEN. `test/formats/morrowind/mwnpc1_gpuskin.test.js` (9) holds the GPU skin to the CPU
skin it replaces, on the fixture arm and on hand-built pieces carrying
every case, and the GLSL's text to its JS law;
`tools/mutants/mwnpc1.json`: 32 mutants, 32 dead. And the GLSL itself
runs: `tools/mwGpuSkinProbe.mjs` builds the fixture body twice in one
page - one rig on the GPU skin, one on the CPU skin - and renders both
through the same sprite pass: four shots under four lights, a mirrored
model with unequal scales, 0 texels differ, colour 0 apart. The probe
fails each of three faults put in the shader by hand (the normal's sign:
max 132 apart; the mirror's flip: 123; the blend off: 1,132 texels).

NOT YET MEASURED on a GPU, or on a retail body: the fixture is an arm's
worth of pieces and SwiftShader is not a GPU. The sprite pass is still one
offscreen bind a body (MWNPC2), and the build is still the whole
first-person rig and a long main-thread task (MWNPC3).

The pin MW-CROWD and PEER-CADENCE describe in
`07-Rendering/Performance-Rig.md` as "the foes' rigs pose every frame"
names no live code: the dungeon's and the exterior foes' rigs are the
shelved voxel path (`dungeonContext.js`, ON ICE), and every foe today is a
classic billboard - the population MWNPC5 stands in a body.

## 7. MWNPC2 - ONE PASS (SHIPPED 2026-10-09)

THE COST IT REMOVES. Every Morrowind body is a picture taken into the
renderer's one sprite target and composited as a camera-facing quad
(`render/characterSprite.js` drawRigSpriteBox, MW-D24) - and every body
took that pass on its own: the target bound, its corner cleared, the body
drawn, the frame's framebuffer and viewport put back. Two framebuffer
switches a body a frame, each a resolve on a tiling GPU, multiplied by
the crowd (WB9h and MW-CROWD both left it open: "batching every seen body
into one bind of the target ... is the next slice").

WHAT IT IS NOW. A host opens a batch around its body pass
(`renderer.beginCharacterSpriteBatch()` ... `flushCharacterSpriteBatch()`).
While it is open, drawRigSpriteBox measures each body exactly as before -
the window, the anchor, the resolution off the texel - and QUEUES the
picture instead of taking it. The flush packs the queued pictures into
tiles of the target (`packSpriteTiles`: shelves left to right, a texel of
gutter), binds the target ONCE, clears each tile (its colour by value,
`clearBufferfv`, so the clear colour is never borrowed) and draws it under its own
camera and its own character block (the block the lone pass sends, so
each picture is the one it was), puts the frame's framebuffer back once,
and draws every quad sampling its own tile (the quad shader's `uOrigin`;
0,0 for the lone pass's corner). A batch the target cannot hold takes as
many binds as it needs. Nothing a picture reads moves between its queueing
and the flush: each body's mesh, palette and range flags are its own rig's,
written by its update before its draw.

The street (world.js), the dungeon and the building (worldModes.js) open
the batch around the player's body and every peer's, the family's and the
card table's; exterior.js draws the player's body alone and keeps the lone
pass. A renderer without the batch (every counting renderer in the suite)
keeps the lone pass, so every earlier pin reads what it read.

BODY-LEAN (2026-10-12, the owner: "when using morrowind models, depending
on your camera position other sprites can shrink or grow, same goes for
the horse"). The picture is taken down the eye's PITCHED ray, so it is
already the body as that eye sees it - and it was pasted on an UPRIGHT
quad, which the same eye foreshortened a second time. Every body and 3D
horse stood cos(pitch) of its height: 0.97 from a level third-person eye,
0.64 from a camera 50 degrees above it, 0.34 at 70 - so a figure shrank as
the camera rose over it and grew back as it came down or walked away.
drawRigSpriteBox now leans the quad by the picture's own up
(`characterSprite.js` pictureUp - lookAt's y for the ray; world up from a
level eye), by the lone pass and the batch alike, and the anchor is landed
along it, so a figure draws its true height from wherever the camera
stands (0.99-1.00 over those eyes). A lean the host hands - the travel
view's (AUDIT OW4 J6), the flats' own - stands as handed. Classic
billboards keep DFU's upright quad: they are flats, not pictures of a 3D
figure. Pinned: `test/world/bodylean.test.js`; mutants `tools/mutants/bodylean.json`.

BODY-CARD (2026-10-14, the owner: "Reimplement the billboard morrowind look as a toggle"; asked which look, the upright card BODY-LEAN
replaced). THE BILLBOARD LOOK, a switch: Features > Combat > With Morrowind
data, "Billboard Look" (`features.js` mw-billboard-look, pref
`mwBillboardLook`, off by default, the viewer's own - it never reaches the
wire). On, drawRigSpriteBox stands the card upright again (world up), as it
stood before BODY-LEAN - every Morrowind body and 3D horse, the player's,
a peer's, the people's, by the lone pass and the batch - so a figure draws
cos(pitch) of its height, the flats' way, shorter as the camera rises over
it. Off, the card leans and the figure keeps its true height. Read where
the card is stood (`characterSprite.js:"const qUp = up ??"`), so it takes
effect at once with no rebuild; a lean the host hands (the travel view's)
stands as handed either way. Pinned: `test/systems/bodycard.test.js`; mutants
`tools/mutants/bodycard.json`. BODY-FLAT (2026-10-23, section 32) takes the
card's picture level since, so the figure stands its true height: the
cos(pitch) above is the record of what it drew.

ONE-BAD-BODY (FIELD BUGS 2026-10-13b, `01-Overview/bugs/Field-Bugs-2026-10-13b.md`;
the owner: "people are saying with norrowind models, people are invisable.
Something in a recent commit borked it", online only). The packer places each tile after the last (`x += it.pw`),
so one picture whose size was not a number - `Math.max(2, NaN)` is NaN,
so the measure's own clamp let it through - put every picture queued after
it at NaN: drawn over the first tile, which is the player's own body's
(queued first), and composited from nowhere. One body with a bad measure
blanked every Morrowind body after it, the player's own picture with them,
for every frame it stood; before this pass it would have broken only
itself. The batch's one door (`renderer.queueCharacterSprite`) refuses a
picture whose size is not a finite count of texels - its own loss, said
once on the console - and the peer layer that fed it a non-finite pose no
longer keeps one (`net/peer/peerBodies.js` _place, `net/peer/peerPace.js`). On a real
GL (Chromium's, the world frame's batch and composite): three horses, the
middle one at a place that is not a number - the third drew 0 texels; with
the door, 4,073.

PROVEN. `test/render/mwnpc2_onepass.test.js` on the real Renderer over a recording
GL: three bodies, two binds where alone they were six, each tile cleared
and drawn under its own camera, each quad sampling its own tile, the
packer's shelves inside the target and as many binds as a batch needs, the
lone path untouched, and every body pass of the booted hosts batched -
flushed in a finally, so a body that throws cannot leave a batch open;
`tools/mutants/mwnpc2.json`: 11 mutants, 11 dead (one of them held by
LA-COST1's law, which now names the tile pass among the borrows that forget
the character block). And the picture: `tools/mwSpriteBatchProbe.mjs`
draws three fixture bodies into one frame the old way and again through
the batch - one bind, the two frames identical texel for texel; a quad
that ignores its tile's origin differs by 1,149 texels.

## 8. MWNPC3 - WHAT A BODY COSTS TO BUILD AND HOLD, SHARED (SHIPPED 2026-10-09)

A body is built once and held for its life; MWNPC1 and MWNPC2 took the
per-frame cost. What remained was the build - "a multi-second mesh parse on
a retail body", the stutter WB9h found in a crowd - and what a body holds.

- ONE PARSE A MESH. Every build copied each mesh's bytes out of its archive
  (`.slice()`) and parsed the copy: a fresh copy a build, so
  `parseNifOnce`'s memo (keyed by the bytes) never met a mesh twice and
  every body re-parsed every part it wore. `nifBytes(arc, path)` copies a
  mesh ONCE per archive (keyed by the archive object and the path, the
  oldest let go past `NIF_COPY_CAP`, 384) and hands every build the same
  copy; both assemblies take `parseNifOnce` (mwFirstPerson.js
  `assembleFirstPersonArm`'s new `parseNif`), so the second body wearing a
  part binds the first body's parse. Safe because a parsed NIF is read and
  never written (flattenNif copies every array it transforms; a skin's
  bones are fresh objects over the parse's read-only lists). In play,
  `loadMorrowindArchives` answers one set of archive objects a data
  generation, so the sharing spans every rig on the page; a new generation
  is new archives, new copies, new parses.
- ONE GL TEXTURE A PICTURE. The decoded image was already shared
  (TEXTURE_CACHE, SKINNED_MIPS); the GL upload was a body's own, a range at
  a time. `acquireCharacterTexture(renderer, mips, wrap)` makes a texture
  for the first range that wears a picture under a wrap and holds it for
  every later one; `releaseGpu` lets go of a range's hold
  (`releaseCharacterTexture`) and the last hold deletes - AUDIT PERF-RIG1
  F2's handle still cleared with it.
- NO SWEEP FOR A BODY NO ONE LOOKS OUT OF. PX27's reach sweep poses the
  first-person arm at nine samples of every clip of every source - the
  build's one pure-posing span - and frames only the first-person lens. A
  peer's body, the family's, the card table's (and the NPCs' to come) are
  drawn in third person alone: `peerBuildOpts` asks `reachSweep: false`, and
  their far plane takes the idle's reach. The player's arm still sweeps.
- AN INSTANCE'S OWN LIMITS. `new PeerBodies({ limits: { max, range,
  skinBudget, spareMax } })`, each defaulting to the module's constant, so
  the peers, the family and the card table read what they read and the NPC
  lane (MWNPC4) stands its own caps beside them.

PROVEN. `test/combat/mwnpc3_bodyservice.test.js` (5): a second body from the same
archives parses nothing and a fresh set parses afresh (by `nifParseCount`);
the copies' identity, their cap and recency; a texture made once, held,
keyed by picture, wrap and renderer, deleted at the last hold and made
again after; the sweepless build's far plane its idle reach while the
player's still sweeps; an instance standing three bodies, one skin a frame
and a 20 m range where a plain one stands eight. `tools/mutants/mwnpc3.json`:
13 mutants, 13 dead. Pins moved: PX27 and MF1 (the sweep is conditional),
AUDIT PERF-RIG1 F2 (the release lets go a hold), MW-BRIG2, MW-STEEL4 and WS1
(the bytes are `nifBytes`' copy, the binder takes the shared parse);
SHADOW-FANG and AUDIT DYE-ICON 2 / r3 2 counted a GL upload a range, and
count one a picture now (the wolf's fur both views wear, the staff's file
both pieces wear: one upload each); MW-LOAD's source law sweeps a
`nifBytes(<archive>, ...)` call as the read it is (stronger: its `find(...)`
reads, whose `?.get` the old pattern never met, are swept too), with
`nifBytes` and `ownBodyPart` exempt as synchronous doors and
`ownBodyPart`'s one call site pinned inside its load; and the MWT1,
PERF-RIG1 F2 and three WB9h mutants re-aimed by content.

NOT DONE HERE, and said so. The build still assembles the first-person arm
for a body only ever drawn in third person (its meshes now one shared parse,
its GL upload never made - the arm's mesh is minted by a first-person draw),
and a build's remaining work - binding, skin transfer, the face match - is
still one task between its awaits; a build gate across every lane and a
cap across every instance are the NPC lane's to bring (MWNPC4), where the
crowd that needs them first stands. (MWNPC4 brought the gate; the cap
stays per lane, by design - section 9.)

## 9. MWNPC4 - THE NPC LANE, AND WHAT AN NPC'S BODY DOES THAT A PEER'S NEVER DID (SHIPPED 2026-10-09)

A peer's body plays what the wire says a player did: walk, run, swing,
cast, draw a bow. An NPC is also HIT, and DIES, and the body must show both
the way Morrowind shows them; and the NPCs need a lane of their own.

- THE RECOIL (combat/fpArm.js `hurt(roll)`). OpenMW's
  refreshHitRecoilAnims, the `recovery` arm: "hit" + chooseRandomGroup -
  the groups `hit1`, `hit2`, ... counted while the body's sources carry
  each, stopping at the first one missing - played start to stop, once, at
  Priority_Hit on BlendMask_All. A recoil still playing takes no other (the
  reference returns while `isPlaying(mCurrentHit)`); the body that carries
  none plays none. The roll is the caller's - the reference rolls its world
  PRNG; here the population's own count, so every machine plays the same
  recoil and Daggerfall's stream is never drawn.
- THE DEATH (`die(roll, { startPoint })`). playRandomDeath/playDeath:
  "death" + chooseRandomGroup at Priority_Death on BlendMask_All,
  autodisable false (held at its stop), loops 0; movement, weapon, hit,
  idle and jump reset, and none refreshed again ("For dead actors,
  refreshCurrentAnims is no longer called"). `startPoint` 1 stands a body
  that meets an actor already dead in its last frame - the reference's own
  startpoint for a corpse it loads. The dead take no swing, no cast, no
  recoil; `revive()` hands a body back to a living actor.
- THE LADDER. Both play on BlendMask_All, so they join the winner ladder
  exactly, with no per-bone vector: death, the weapon action, the recoil,
  the movement, the jump, the idle (character.hpp's Priority enum). The
  death also takes the torch's left arm (Priority_Death over
  Priority_Torch). An action under the death - a sheathe the rig is handed
  dead - runs and never shows, as playDeath's own note says of the reset
  animations.
- OFF THE POSE (net/peer/peerBodies.js `_react`). Two fields only an NPC's pose
  carries: `ht`, a hit count (a new count is a recoil, the count its roll)
  and `dd`, the death (0 standing, else its roll + 1). Latched the first
  time a body meets them, as the swing count is: the count a body is born
  with is no recoil; a body meeting the dead stands the corpse; a dead
  body's weapon, spell and swing doors are not opened, its counts followed
  so standing again replays nothing; out of sight (the linger, the far
  cadence) the reactions re-latch - a death there is a corpse on the way
  back. A wire peer's pose carries neither: it is never hit nor killed by
  it.
- THE LANE (`characters/npcBodies.js`). `createNpcBodies` wraps one
  PeerBodies under the tier's caps (`NPC_BODY_TIERS`: Off none; Near 12
  bodies within 30 m, 4 skins a frame, 4 spares; All 24 within 60 m, 8, 8).
  A population `stand`s each actor between `begin` and `end` - its id
  scoped `npc:<lane>:<id>`, never a peer's or a family member's - and its
  host asks `has(lane, id)` before drawing its own billboard, which is the
  fallback for every actor the lane does not stand (past the cap or range,
  still building, refused): the lane draws no doll. `npcShown` maps an
  actor's state onto the pose `_arm` plays. A tier change stands a new lane;
  an unknown tier stands under the default (Near).
- ONE BUILD QUEUE (`BODY_BUILD_GATE`). Every PeerBodies a host stands - the
  peers', the family's (and the card table's, through makeFamilyBodies),
  the NPCs' - passes the page's one gate, so the lanes' builds run one after
  another as one lane's always did. An instance given none keeps its own
  (the tests').
- THE BOUND, per lane and summed (law 4 as amended). The peers stand
  BODIES_MAX (8) within BODY_RANGE with SKIN_BUDGET (4) skins a frame; the
  NPCs their tier's. At Near, a frame skins at most 8 bodies (4 + 4), each a
  palette upload (MWNPC1), and draws every seen one in the one bind
  (MWNPC2); at All, 12. A crowd of NPCs never takes a peer's body.
  (AMENDED BY MWNPC6, section 11: the watch's lane adds 2 skins at Near and
  4 at All - 10 and 16 a frame on a street with all three. AMENDED AGAIN BY
  MWNPC7, section 12: the walkers' lane adds 4 at Near and 8 at All - 14
  and 24 a frame on a street with all four. AMENDED BY MWNPC11, section 16:
  no longer summed - every NPC lane shares one frame budget, so at Near a
  frame skins at most the peers' 4 and the NPCs' 8, at All 4 and 16,
  however many lanes stand.)

PROVEN. `test/combat/mwnpc4_npclane.test.js` (5), on a fixture rig whose clip file
is MW-CAST1's with the fists' group and the reaction groups appended (two
recoils, a gap, two deaths): the recoil's pick by roll and its count to
the first gap, a negative roll wrapped, played once over the idle and let
go, none taken while one plays, none on a body without the groups; the
death's pick, its win, its hold at the stop, the idle never back while
dead, no recoil, swing or cast, an unequip under it unseen, the corpse at
its stop at once, revival to the idle, a body with no death still dead;
PeerBodies' reactions off the pose (a new count, the death, the corpse, the
revival, the dead's doors shut and counts followed, the linger re-latched,
a wire peer untouched); the lane's tiers, ids, offer rule, cap and
teardown; and the gate - two lanes' builds in turn, two ungated side by
side, and every PeerBodies the source stands passing it.
`tools/mutants/mwnpc4.json`: 38 mutants, 38 dead. Pins moved: MWBODY1's
host pin (the peers' lane passes the gate), AUDIT WORLD C7 (the linger
re-latches the reactions with the swing), fparm's ready() (the recoil and
the death count as a clip); the MWA4 data-gate mutant re-aimed by content.

AMENDED 2026-10-09 (found planning MWNPC9): THE DYING BODY WAS LET GO.
ready() counted the recoil and the death, and the DRAW predicate
(`thirdActive`) did not - so `die()`, which resets every other state,
left a body standing for nothing: PeerBodies' `_standing` answered false,
the lane let the body go and the host's billboard - the corpse flat -
drew in its place. Every death MWNPC5 and MWNPC6 stand was the classic
corpse; the lane tests drive a stub rig and could not see it. The draw
counts the recoil and the death now, pinned on the fixture rig (MWNPC4b:
a dying body stands); `tools/mutants/mwnpc4.json` 39 mutants, 39 dead.

THE FOUR HOSTS (rule 17e). None is wired in this slice - the lane is the
door, and no population stands at it yet: scenes/exterior.js,
scenes/world.js, scenes/worldModes.js and scenes/dungeonContext.js are
FLAGGED, each wired with the first population it hosts (MWNPC5's foes:
dungeonContext.js, world.js's exteriorFoes, worldModes.js's interior foes,
exterior.js). world.js's two existing lanes (the peers', the family's) take
the gate now. The Features row (`mwNpcBodies`: Off / Near / All, law 6)
lands with that wiring, when the switch has something to switch.

## 10. MWNPC5 - FOES

### 10a. A foe's tells on its body (SHIPPED 2026-10-09)

The billboard shader draws five things on a foe: the hit flash (HITFLASH1),
the concealment (ECV1), the wind-up's glint (TELL2 - a gameplay tell: the
blow is coming), the elite's glow, outline and embers (ELITE FOES), and
the dissolve (a revenant's fate burning it away, a companion through a
portal). The body's quad (renderer.js `_ensureCharQuadProgram`) drew the
first two. A foe stood in a body must lose none, so the quad takes the
other three - `fx` ({ glint, elite, time, dissolve }), from the lane
(`PeerBodies.draw`'s `fxOf(id)`) through the rig's `drawThird` and
`drawRigSpriteBox` to `drawCharacterSpriteQuad`, a batched body's quad
carrying its own:

- THE COLOUR TERMS ARE THE BILLBOARDS' OWN: `glintLit`, `glintRimColor`
  (GLINT_GLSL), `eliteGlowLit`, `eliteRimK`, `eliteRimColor`, `eliteHash`
  and ELITE_RISE (ELITE_GLOW_GLSL), in the billboards' order - the warmth,
  the glint, the hit flash, the burning edge.
- THE TEXEL READS ARE THEIR TWINS INSIDE THE TILE. The outline (a texel
  within two of the silhouette), the embers (a column scanned down for the
  body) and the dissolve's grain read the picture's own tile of the sprite
  target (`tileAlpha`, zero past the tile's rect), never the target: a
  batched body's tiles stand a texel apart (MWNPC2), and an outline read
  off the target would ring a body with its neighbour's. The ember's
  column and the grain's cell are the tile's own, so they hold wherever
  the packer puts the tile this frame; the grain's height is the picture's
  (v 0 the feet: they go first, as the flats').
- THE ROOM THEY TAKE. A body with an outline is pictured two texels wider
  each side, an elite's twenty (ELITE_RISE's climb over the outline) -
  `bodyFxPad`, symmetric, so the quad stands where it stood and a texel
  stays the size it was; a body with none (or burning away, which draws no
  outline) is pictured exactly as it was.
- No outline and no ember on a concealed body or one burning away - the
  billboard shader's own gate.

PROVEN. `test/render/mwnpc5_bodyfx.test.js` (3): the uniforms a quad sends with
its tells and without (none carried over from the last quad), an elite's
corpse its negative pulse, a batch's quads each their own; the padding
(two, twenty, none, none while burning; a texel's size and the centre
kept, the sides grown by the same texels); and the tells down from the
lane through the fixture rig's drawThird. `tools/mutants/mwnpc5.json`: 18
mutants, 18 dead. The shader runs in `tools/mwBodyFxProbe.mjs`, on the
fixture body in Chromium: no tell draws the plain frame exactly; the glint
an outline (669 texels) and the whole body lifted; the elite an outline
and embers that come and go over its clock; the corpse the outline alone;
a half-burnt body 99 of 215 texels gone and no outline; three bodies with
the centre one glinting and elite, batched, the lone frame texel for
texel; and the clamp itself - a tile of nothing ringed by ink draws
nothing (its control, a tile holding the ring, draws it). Five shader
mutants, each failing the probe: the clamp read off the target (6160
texels ringed), no burn, no embers, no glint on the body, an outline while
burning. A plain body asks no tile texel at all (`bodyTexel` only under a
tell), so it reads exactly what it did - INVIS-LOOK's executed shader runs
it with the tells bound off. Pins moved: PR-BOW1's drawThird needle, its
anchored quad and its peer body; PR-BOW1b's peer body; INVIS-LOOK's quad
and box calls; the INVISLOOK half-cut,
three MH1, PR-BOW1's no-anchor, OW4-J6's upright, OW-PEERS' unleaned and
INVISLOOK's late-pass mutants re-aimed by content.

### 10b. The dungeon's foes in their bodies (SHIPPED 2026-10-09)

- A FOE, READ FOR ITS BODY (`characters/foeBodies.js`). Only a CLASS foe
  (Daggerfall's people, the mobiles past 127; the creatures are MWNPC9's).
  Its look: a race drawn off its SEED - its species and the layout point
  that stood it (`marker`; else its spawn point, else its sequence), facts
  every machine in the room shares, so a foe is the same person on each -
  weighted to the Bay (Breton 30, Redguard 25, Nord 10, Wood Elf 9, Dark
  and High Elf 8, Khajiit and Argonian 5); a face 0..9 off the same seed;
  its own gender; what it WEARS - its equip table, read as the player's
  look is (composeLook) - and under it a shirt, legs and shoes from its
  gender's wardrobe in common dyes, each only where no piece of its own
  stands (boots on the feet: no shoes). The look is kept on the foe while
  it wears the same, so a foe is one build for its life. (AMENDED BY FB1012d
  ALLY-RACE, `01-Overview/bugs/Field-Bugs-2026-10-12d.md`: a person of their
  own is drawn off THEIR seed, not the stand's - a companion the layer
  stood, by its stamp; a revenant, by its record's, minted off the body it
  was born in - so a companion is one person through every door and load.)
  Its actor: the
  motor's feet and yaw (the player's own convention, forward sin/cos),
  moving, and running only in pursuit (the give-up timer both motors keep);
  its weapon out; a swing per new attack count (the stream's `_atkA`, its
  low ranged bit dropped), the strike drawn from the count; a cast per
  cast count; a RECOIL per health drop the host's hit flash has marked
  (`_hfAt`); dead, a death's roll off its seed. Its tells (`foeFx`): the
  glint, the elite's pulse and clock and the dissolve the host has already
  dressed its billboard in, in one object a foe, rewritten in place.
- THE LANE CARRIES THE DRESSING (`npcBodies.js`). `stand(lane, actor,
  conceal, flash, fx)`: the concealment the billboard would draw (ECV1 -
  the body drawn veiled after the opaque world, `drawVeiled`), the hit
  flash, the tells; the living stand before the dead (PeerBodies'
  priority). `npcBodiesOn()` is every host's gate - the enhanced skin,
  Morrowind data, and the tier not Off; `createHostNpcBodies` the lane as
  every host makes it.
- THE CAST-ONLY BILLBOARD (renderer.js `drawBillboards`, airPass.js). A
  foe in its body keeps its billboard in the pass with `castOnly`: it
  records its shadow (a skinned body casts none - MWNPC1) and draws
  nothing, in neither phase, and blooms nothing. (AMENDED BY MWNPC16,
  section 24: it casts nothing either - the body casts its own shape.) The host sets it AFTER
  the lane has synced each frame, so a body arriving or leaving is never a
  frame drawn twice or not at all.
- THE DUNGEON CONTEXT (`dungeonContext.js` drawFoes - both dungeon hosts'
  one frame function): the lane a frame (none while unwanted, the old one
  let go); every live class foe offered dressed as its billboard; every
  dead class foe from the kill (`f.corpse`) until its corpse is freed, its
  corpse flat cast-only under the body; the sync; the cast-only marks; the
  bodies in one bind of the sprite target; the veiled after the last
  opaque flat; the lane gone with the context.
- THE SWITCH. The Features row `mw-npc-bodies` ("Morrowind People", the
  world group): Off, Near (the default), All - the viewer's own, as the
  Steel Helm is, read every frame, so it lands at once. On ORG2's one
  Settings screen (main's, met at the arc's merge of main, 2026-10-10) it
  stands in Combat > With Morrowind data, beside the Steel Helm and the
  Morrowind Spell Effects (`ui/settings/settingsMap.js`).

PROVEN. `test/characters/mwnpc5_foes.test.js` (3): the class foe alone; one seed,
one person on every machine, another place or species another; a
thousand foes near the Bay's weights, all ten faces; the gender's
wardrobe; the armour as worn with the clothes under it and no shoes beside
boots; the look kept, and new (the same person) when a helm goes on; the
stride, the run only in pursuit, the blows without the ranged bit, a
strike never Idle and varying, the casts, a recoil per new hit mark, the
deaths off the seed and varied across foes; the tells and their one
object. `test/render/mwnpc5_dungeon.test.js` (5): the cast-only billboard on a
recording GL (not drawn opaque or veiled, recorded for the shadow, skipped
by the bloom); the lane's dressing per body and undressed the next frame,
and a lane of one standing the farther living foe over the nearer dead;
the Features row and its tiers the lane's own; the dungeon context's
wiring in its order by source; and THE FOE HOSTS ENUMERATED - every module
that dresses a foe's billboard (`setBatchHitFlash` off `foeHitFlash`) is
named, wired or flagged. `tools/mutants/mwnpc5b.json`: 31 mutants, 31
dead (a 32nd, a frame check on the lane's dressing, was equivalent - a
lingering body is never drawn - and the check went, not the mutant's
record). Pins moved: the Features list and its notes' ceiling (+150, the
row's own size); MWNPC4's `cr` is the cast's RANGE (castRange - the rig's
castSpell takes it so), and two MWNPC4 mutants re-aimed onto the lane's
tier table; ENHNOTICE3's latch kept beside its door, and FOE-SPACING's and
WORLD2's loop (the lane begins above the frame's count, not inside the
spacing); FT18's and FT8's row counts (+1); PERF-EXT10: `castOnly` is minted
by the billboard factory as every field a host writes is (HARD3's count of
the minted fields 54 to 55, the BillboardBatch typedef naming it).

THE FOUR HOSTS (rule 17e). scenes/dungeonContext.js WIRED (the dungeon
host and the world's dungeon arm both run it). scenes/world.js,
scenes/worldModes.js and scenes/exterior.js FLAGGED: their foes are the
encounter pool's (scenes/exteriorFoes.js, `batches()` at each), wired as
one in MWNPC5c; the watch (scenes/cityGuards.js) is MWNPC6's. The
enumeration in MWNPC5b-e fails a new foe host that is neither.

NOT PROVEN HERE: a dungeon in a browser with retail data - a dungeon
needs the game's own files, which no fixture carries; the frame's order
is pinned by source and each part by its own test.

### 10c. The encounter pool's foes - every other foe host (SHIPPED 2026-10-09)

The dungeon context's law on the pool the other three hosts draw
(`scenes/exteriorFoes.js`, one factory: world.js's exterior,
worldModes.js's interiors, exterior.js): `batches()` makes the lane the
first frame it is wanted (and lets it go the frame it is not), offers
every live class foe dressed as its billboard (its `castOnly` reset at
the offer) and every dead class foe from the kill until its corpse is
collected; `drawBodies(canvas, proj, view, eye, dt)` syncs the lane,
marks each offered billboard - the corpse marker's flat for the dead -
cast-only where its body stands, and draws the bodies in one bind;
`drawVeiledBodies()` draws the concealed; a `drawBodies` with nothing
offered since the last (a frame the host drew no pool) syncs nothing; the
lane follows the floating
origin (`offsetAll`) and leaves with the pool (`destroy`). Each host calls
`drawBodies` after `batches()` and before those billboards draw (the world
host just before its person billboards, with the body pass's eye,
`mwv.eye` - DISC19-F's order of the pools, the leash and the town watch
untouched, and DW-F's column flags kept directly above the draw (MWNPC6
caught the line 5c had put between them); the interior beside its foe billboards; exterior.js its own),
and `drawVeiledBodies` after the peers' (the building's, after INVIS-LOOK's
last opaque draw).

A foe's look is asked every frame, so it is now a COMPARE: the same pieces
in the same slots, by reference, is the same look - no copy, no compose;
only a change composes it again.

PROVEN. `test/scenes/mwnpc5_pool.test.js` (2): the real pool with a recording
lane - the class foe and the dead class foe offered, never the creature;
the offer dressed with the host's own hit flash (a strike this moment) and
the hit a recoil; the sync then the draw with the host's eye; the
cast-only marks after the sync (the corpse's flat too, never the
creature's), reset the next frame the body is gone; the veiled; the
origin; the lane let go when unwanted (every billboard drawn again), made
again when wanted, gone with the pool, a second draw with nothing offered
syncing nothing - and the three hosts by source.
`tools/mutants/mwnpc5c.json`: 19 mutants, 19 dead. The foe-host
enumeration (MWNPC5b-e) names the pool WIRED now.

THE FOUR HOSTS (rule 17e): ALL WIRED. scenes/dungeonContext.js (10b);
scenes/world.js, scenes/worldModes.js (interiors) and scenes/exterior.js
through the pool. The watch (scenes/cityGuards.js) is a population of its
own, MWNPC6's.

## 11. MWNPC6 - THE WATCH IN ITS BODIES (SHIPPED 2026-10-09)

The city watch (`scenes/cityGuards.js`, Knight_CityWatch - a class foe)
is the encounter pool's law (section 10c) on a pool of its own: `update()`
builds the frame's draw list after every watchman has acted
(WATCH-SWING's order) and offers each live one there, dressed as his
billboard, and each dead one from the kill until his corpse is collected;
`drawBodies(canvas, proj, view, eye, dt)` syncs, marks the cast-only
(the corpse's flat for the dead) and draws; `drawVeiledBodies()`; the lane
follows the origin and goes with `clearLive` (an interior's watch is torn
down there).

- ITS OWN LANE AND CAPS. The watch stands on the `'watch'` lane under
  `WATCH_BODY_TIERS` - the same switch's tiers (Off / Near / All), a third
  of the foes' bodies (4 and 8) and half their skins (2 and 4), the same
  reach - so a street's handful never crowds out the foes it is fighting,
  and the bound stays stated: at Near a street skins at most 10 bodies a
  frame (the peers' 4, the foes' 4, the watch's 2), at All 16.
- HIS POOL'S ID. A watchman's wire number (`seq`) is minted the first
  time he rides the cell's stream - late, and a body that changed hands
  when it came would rebuild. He is offered by his pool `id`
  (`foeActor(g, g.id)`), and his seed - he has no layout point - is the
  first of his wire number or his id it meets, kept for his life.
- THE HOSTS. world.js draws the watch's bodies beside the foes', before
  the street's person billboards; worldModes.js's buildings before the
  watch's billboards; exterior.js before its person billboards; the veiled
  beside the foes'. The dungeon stands no watch (named in the slices
  table).

PROVEN. `test/characters/mwnpc6_watch.test.js` (3): the caps against the foes' (a
third, a half, the same reach, the one switch); two watchmen two people,
the actor by the population's id, a wire number arriving later changing
nobody; the real pool with a recording lane - a dead watchman offered
dead on the watch's lane by his pool id, the corpse flat cast-only after
the sync, nothing synced twice, the veiled, the origin, let go when
unwanted, gone with clearLive; and the live offer and the three hosts by
source. The foe-host enumeration (MWNPC5b-e) names the watch WIRED.
`tools/mutants/mwnpc6.json`: 18 mutants, 18 dead. The live drive needs a
real motor and ARENA2's CLASS18.CFG to stand a watchman, so the live offer
is pinned by source (as section 10b's dungeon is) beside the encounter
pool's behavioural proof of the same lines.

## 12. MWNPC7 - THE STREET'S WALKERS IN THEIR BODIES (SHIPPED 2026-10-09)

- A WALKER, READ (`characters/folkBodies.js`). Daggerfall rolls a walker
  at every spawn (townPopulation.js RandomiseNPC): the climate's race, a
  gender, one of four outfits (the sprite archive, PERSON_TEXTURES), a face
  record, a name - or, one in 32, the guard's arm (texture 399). The body
  is that roll: the race and gender as rolled; a face off the face record;
  a WARDROBE PER OUTFIT VARIANT (`FOLK_OUTFITS` - the men's commoner,
  tradesman, traveller and scholar, a shirt and pants, a tunic and
  breeches, a long shirt and tall boots, plain robes; the women's blouse
  and skirt, shirt and pants, robes, shirt and skirt with tall boots), each
  garment dyed off the spawn (`FOLK_DYES`) so a street is not one colour;
  the guard in the watch's whole steel plate. (AMENDED BY MWNPC17, section
  25: the variant is the walker's role and cut - FOLK_DRESS - and the
  wardrobe dresses the rest off the spawn.) (AMENDED BY MW-FOLK1, 2026-10-13,
  and its audit: a walker whose picture has an outfit of the port's own -
  eleven of the twenty-four - wears that outfit and no wardrobe, so one
  picture's walkers differ by their faces alone;
  `04-Characters/Townsfolk-Outfits.md`.) A RE-ROLL IS A NEW PERSON:
  the pool's shells come back as someone else, so another archive, face,
  name or gender is a new id (`<shell>.<spawn>`) and a new look - a body
  built for them, never the last one's re-dressed (PeerBodies holds a
  changed look to BODY_REBUILD_MS). The actor: their feet as the host
  places their billboard, their wheel's facing (`facingYaw`, the foes'
  convention) or a resident's own yaw, walking while they move - never
  running, armed, hit or dead. One actor object a walker.
- THE POPULATION LANE (`npcBodies.js` createPopulationLane). The shape
  the foe pools grew, for a host that walks its population inline:
  `frame()` (made when wanted, let go when not), `offer(actor, batch, ...)`
  (the billboard reset to drawn), `draw(canvas, proj, view, eye, dt)` (the
  sync, the cast-only marks, one bind - nothing if nothing was offered),
  `drawVeiled`, `offsetAll`, `destroy`, `has`.
- THE HOSTS. world.js's streets (every built pixel's town, on the 'folk'
  lane; the line's own members keep the family's bodies - LEGACY7) and
  exterior.js's location offer every walker and draw before the person
  billboards (held under a talk, as the street is); world.js lets the
  walkers go indoors and moves them with the origin. world.js offers a
  walker right AFTER pushing their billboard (LEGACY7's line - the family
  stand, then the push - kept whole; the cast-only is read at the draw, so
  the order is free), and lets them go just past TV7's measured modal arm.
- THE BOUND. The walkers' lane stands under the switch's tier (NPC_BODY_
  TIERS: 12 within 30 m and 4 skins at Near; 24, 60 m, 8 at All) - with the
  peers', the foes' and the watch's, 14 skins a frame at Near on a street
  with all four, 24 at All; every one a palette upload (MWNPC1), every seen
  body in its lane's one bind (MWNPC2).

PROVEN. `test/characters/mwnpc7_folk.test.js` (4): every race, gender and outfit
variant's look (its garments in its slots, the street's dyes, a face),
the dyes varying across spawns, the guard's whole steel plate; the same
roll the same id and look object, a re-roll a new id and look, another
walker another id, the actor's feet, facing (the wheel's, or a resident's
yaw), walk and idle, never armed, hit or dead; the population lane's whole
cycle on a recording lane; and THE POPULATION HOSTS ENUMERATED - every
scene that walks a town population named (world.js, exterior.js), each
offering, drawing before its billboards, drawing the veiled, its
billboard drawn whenever the lane is not. `tools/mutants/mwnpc7.json`: 22
mutants, 22 dead.

NOT HERE: the living residents indoors (worldModes.js's buildings) and
the street's standing people are MWNPC8's; a walker struck or slain in the
street keeps the classic billboard's answer (the walkers have none of
their own to give).

## 13. MWNPC8 - THE STANDING PEOPLE

### 13a. The buildings' people (SHIPPED 2026-10-09)

- A STANDING PERSON, READ (`characters/peopleBodies.js`). A building's
  person is a StaticNPC: staticNpcData gives their race (off their
  faction, else the region's) and gender (their record's flag 32); their
  faction's FACTION.TXT row says who they are, and the body WEARS it
  (`wardrobeOf`): a temple's or holy order's priest in priest's robes; a
  mage in robes; a knightly order's, a fighters' guild's or a knightly
  guard's person in steel; a noble or a court's in a formal tunic and
  breeches or a blouse and a long skirt; a merchant in a tunic and
  breeches; the underworld and the thieves in dark plain clothes; a
  scholar in plain robes; everyone else in the street's own outfits
  (MWNPC7's FOLK_OUTFITS) - each kind in its own dyes, off the person's
  name seed. (AMENDED BY MWNPC17, section 25: each kind is a wardrobe role
  dressed off the name seed; the knightly kinds split - a knight's plate, a
  fighter's armour.) A CHILD (by texture or the children's faction) and a VAMPIRE
  (a vampire clan, the vampires' guild group, the supernatural social
  group) keep their sprites, and so does a race the data cannot name
  (AUDIT MW-NPC II K6: the vampire's reason was "no Morrowind body of their
  own here", untrue since MWNPC14's head - the reason now, section 23: a
  standing person's faction row is all that says "vampire", and the
  supernatural group is wider than the vampires). The
  look is read once - a standing person is one build - and never before
  the faction table has loaded (the host asks again).
- THE TURN. Daggerfall's billboard always faced the player; the body
  turns to face them at a person's pace (PERSON_TURN_RATE, 3 rad/s, the
  short way round), facing them from the first frame. Idle, never armed.
- THE HOST (worldModes.js's buildings, the 'people' lane under the
  switch's tier): every stood person with a billboard offered before the
  room's billboards draw - their billboard cast-only where the body
  stands - the rest drawn as ever; the lane let go at both of the room's
  teardowns.
- Show Nudity (NUDE-FLATS): a Morrowind body is always clothed, so the
  law holds whatever the flat would have drawn.

PROVEN. `test/systems/mwnpc8_people.test.js` (4): every faction's wardrobe and
the vampire first; the look (race, gender, the faction's garments and
dyes, the knight's steel and no shoes beside his boots, the street's
outfits varied for the rest; a child by texture or faction, a vampire, a
nameless race keeping their sprite; read once, a sprite once a sprite for
good); the turn (facing the player at once, then at its pace without
overshooting, the short way across the seam), one actor a person; and the
building by source. `tools/mutants/mwnpc8a.json`: 24 mutants, 24 dead. Pins moved: the
sailing cabin's exit runs `exitInteriorNow` over a scope of its free names,
which now includes `peopleBodies`; the person block sits above BLOOD1's
marks, which draw directly under the room's billboards.

THE FOUR HOSTS for the standing people: worldModes.js (buildings) WIRED;
the street's standing people (world.js, exterior.js) and the dungeons'
and the quests' (dungeonContext.js) are 8b's.

### 13b. The dungeons' and the street's people (SHIPPED 2026-10-09)

- ONE BATCH A PERSON. Both hosts drew their StaticNPC flats in shared
  batches - the dungeon with the level's flats (one per archive/record,
  dungeonContext.js `flatGroups`), the street one per sprite over a
  pixel's active people (world.js standPixelNpcs) - and `castOnly` is a
  batch's, so one body could not take one person's place. Each person's
  flat is now a batch of its own (`pn.standBatch`), minted exactly as the
  group's was: the dungeon's base-centred off the BORN sprite and drawn as
  the clothed stand-in under NUDE-FLATS, animated where the record
  animates; the street's on the pixel's hold, in its cull box, in its
  list and teardown as the groups were. Every other flat groups as before.
  The cost: a batch a standing person - a dungeon holds a few dozen, a
  near street fewer - one more draw each, inside the same billboard pass.
- THE DUNGEON (dungeonContext.js `drawPeople`, called by worldModes.js
  before the level's billboards draw): every active person with a look
  offered on the context's own 'people' lane - read by worldModes.js's
  `standingLook`, the buildings' reading (their StaticNPC data and their
  faction's row; never before the faction table) - their billboard
  cast-only where the body stands, the rest drawn as ever; the lane leaves
  with the context. A host that passes no reading (dungeon.js) leaves
  every person their billboard. The feet are the person's base (`pn.y`,
  converted from the RDB centre by the activation-extent pass before any
  offer).
- THE STREET (world.js, the 'people' lane): the near rings' people (ring
  1 - the pixel the player stands in and the eight round it) offered as
  the pixels are walked, at their scene feet (the pixel's translation
  added); every other ring's person keeps their billboard. Read by their
  StaticNPC data with the region's race and the quest store's faction
  table; asked again until the table has loaded. Drawn before the flats;
  let go indoors with the walkers; moved with the origin.
- A FLAT WITH A FACTION IS NOT ALWAYS A PERSON DRAWN: an editor marker
  (archive 199) DFU hands its StaticNPC hookup but never renders stands
  no body (`personLook`), whichever host offers it. Nor does anyone not
  mortal (`wardrobeOf` 'none', beside the vampires): a Daedra or a god by
  faction type, Oblivion's or the Fey's by guild group - a prince's sprite
  is no person in clothes. A coven's witch is mortal and is dressed.
  STALL-FLATS (`01-Overview/bugs/Field-Bugs-2026-10-15c.md`; "every animal and
  food stand item turned into freaks", "clustered into groups and all have
  their heads down"): nor any flat whose picture is no person's - a body
  stands only for RDBLayout.NPCFlatArchives (`world/npcFlatArchives.js`
  isNpcFlat, FlatTypes.NPC), the editor's 199 with the rest. Beautiful
  Villages gives its market blocks' food, goods and animals a faction
  (TVRNAS02, TEMPASB0, TEMPBSB0, RESIAS02: 584), so each was a StaticNPC
  and, since MWNPC8b, a body - 101 in TVRNAS02 alone, turning to the eye
  in a heap. They keep their billboards now, as DFU draws them; the
  StaticNPC list is DFU's still (the click's own law, AUDIT WD3 G1, was
  already the archive's). A quest's person keeps a body whatever FLATS.CFG
  pictures them with (`questPerson`, worldModes.js questStandLook).
- The bound is the lane's: the 'people' lanes take NPC_BODY_TIERS, and
  only one of the three ever runs a frame (the building, the dungeon or
  the street - the scene is one of them). (AMENDED BY MWNPC11, section
  16: true of the three 'people' lanes, not of the street's lanes
  together - the street's people stand beside its foes, watch and
  walkers. Every NPC lane now shares one frame budget.)

PROVEN. `test/scenes/mwnpc8b_streetdungeon.test.js` (4): the dungeon by source
(a person out of the groups, their batch base-centred off the born sprite
and drawn as the stand-in, after the groups; drawPeople's offer, reset
and draw; the lane's teardown; the world's dungeon passing the reading and
drawing the people before the level's billboards), the street by source
(a batch a person after the away arm and the quest pass, no group left;
the reading not before the table; the near rings offered in the walk at
scene feet; drawn before the flats; indoors and the origin), and THE
STANDING-PEOPLE HOSTS ENUMERATED - every scene that stands StaticNPC
billboards named, wired or flagged; and an editor marker and the
immortals standing no body. `tools/mutants/mwnpc8b.json`: 24 mutants, 24
dead.

NOT HERE (MWNPC8c, section 13c): exterior.js's standalone location still
batched its people with its scenery (flagged in the enumeration); the
quest-placed stands (worldModes.js `standQuestFlatIn` - Azura summoned, a
questor at a marker) are a batch each already but are read off a marker
and a faction id, not an RDB record, and kept their billboards.

### 13c. The location's people and the quests' (SHIPPED 2026-10-09)

- THE LOCATION (exterior.js, the standalone route). Its one batch per
  archive/record held every street person with the scenery; a person now
  leaves the groups and stands in a batch of their own, minted in the NPC
  pass as the group's plain picture was (the record uploaded, its box, its
  animation) - none for an editor flat, which this host never drew. Read
  as the buildings' are (their StaticNPC data with the location's region
  race, their faction's row; never before the faction table), every person
  is offered on the 'people' lane before the flats are walked, and drawn
  there; their billboard cast-only where a body stands. A person was never
  cover here (AUDIT TACT B3) and their own batch makes none. The host never
  unloads its location, so the lane lasts the scene, as the walkers' does.
- THE QUESTS' STANDS (worldModes.js). A stood quest PERSON is read off
  the record their click reads (`questStandNpcData`, DQ1's one builder,
  now shared: the Person's gender, faction and name seed through the
  bridge's SetLayoutData, the marker's hash),
  with their born billboard pair for the child's law; an item's or a foe's
  stand is no one, and nobody is read before the faction table and the
  bridge. Offered where the marker they ride has carried them
  (questStandBox's base), only while stood and active: in a building on
  the room's lane beside its people, in a dungeon on the dungeon's through
  `drawPeople`'s `also` - before the billboards draw either way.
- So the standing people are WIRED in every host that stands them: the
  buildings (8a), the dungeons and the street (8b), the location and the
  quests (8c). A Daedra prince summoned keeps the sprite (section 13b).

PROVEN. `test/scenes/mwnpc8c_location.test.js` (2), by source: the location (a
person out of the groups, their own batch and none for an editor flat, the
reading, the offer and the draw before the flats) and the quests' stands
(the reading, an item or a foe no one, never before the table; the offer
at the rider's feet, only while stood; the room's lane and the dungeon's
`also`, before the billboards). `tools/mutants/mwnpc8c.json`: 18 mutants,
18 dead. Pins moved: AUDIT TACT B3's exterior.js pin (no person reaches
the groups' cover now), MWNPC8b's enumeration (exterior.js wired) and its
dungeon pins (drawPeople's `also`, read by prefix), and DQ1's (the
stand's NPCData still built in one place - `questStandNpcData`, which the
click and the body call).


## 14. MWNPC9 - THE CREATURES

Daggerfall's creature foes (the mobiles below 128: rats, bats, skeletons,
zombies, ghosts, atronachs, daedra) in Morrowind CREATURE bodies. A
creature is not dressed: OpenMW stands it from its CREA record's model,
which is its skeleton and its body at once (CreatureAnimation:
`setObjectRoot(model, ...)`), and animates it from that model's own .kf -
and xbase_anim's first when the record is Bipedal
(creatureanimation.cpp, read at openmw-0.48.0). Two slices: 9a the body,
9b the rig, the match table and the hosts.

### 14a. The body (SHIPPED 2026-10-09)

- THE RECORD (`formats/morrowind/mwFirstPerson.js` readCreature, extractArmRecords'
  `creatures`, `ARM_RECORDS_VERSION` 5 - every master re-extracted once).
  Its id, its model (lowercased, slashes forward), its name, its FLAG's
  low byte (`mFlags = flags & 0xFF`; the blood type rides above it) and
  its XSCL (1 without one) - loadcrea.cpp. `CREA_FLAG` is loadcrea.hpp's
  enum as the 0.48.0 header numbers it: Bipedal 0x01, Respawn 0x02, Weapon
  0x04, Base 0x08, Swims 0x10, Flies 0x20, Walks 0x40, Essential 0x80 -
  READ OFF THE HEADER, because two recollections of it (the planning pass's
  and this one's) disagreed with it and with each other.
- THE BODY (`assembleCreature`, `formats/morrowind/mwCharacter.js`
  bindCreatureModel). One parse: the skeleton's refs ARE the shapes'
  parent refs (`flattenNif` now records each shape's and each particle
  system's `parentRef`). The skinned shapes bind by their bones (rule 12,
  the same rebind as a worn part's); every RIGID shape - a Morrowind
  skeleton creature is nothing else - rides the node it hangs under: its
  flattened (file-root) vertices pre-multiplied by the inverse of that
  node's rest, so at rest the node times the inverse is the identity and
  the shape stands as the file draws it, and posed it moves with its node
  alone. A particle system (an atronach's flame) rides its node the same
  way, through `effectPlacement`'s `pre`. The "Tri Bip" debug shapes are
  dropped (`isTriBip`; RemoveTriBipVisitor, run by setObjectRoot for a
  creature alone - Morrowind-Rules.md's note). The pieces are the arm's own
  shape (slot `creature`, never mirrored or offset), so the pose, the GPU
  skin, the upload and the sprite tile take them unchanged.
- THE SOURCES (`creatureAnimSources`): xbase_anim's .kf first for a
  bipedal creature, then the model's own - the model being rule 18's
  corrected actor path, the "x" variant, so `xrat.nif` sources `xrat.kf`.

PROVEN. `test/formats/morrowind/mwnpc9_creatures.test.js` (5), on a creature written as
retail's are (`test/fixtures/mw/creatureRig.mjs`: a model with a skinned
body, a rigid head on a turned node, a rigid tail, a Tri Bip shape, and a
.kf with Idle, WalkForward, Attack1-2, Hit1, Death1): every shape bound,
the debug shape dropped, each piece at rest exactly where the flattener
puts it; posed, a turned Head turns its piece and nothing else and the
walked Bip01 carries every piece; a rigid shape off the skeleton on the
root; a flame on its node at rest and posed; and the sources.
`test/formats/morrowind/mwload_records.test.js`: the CREA records (the blood type not a
flag, XSCL or 1, a modelless one dropped, Bipedal bit 0) and the record
set's shape (v5). `tools/mutants/mwnpc9a.json`: 16 mutants, 16 dead.
Pins moved: mwload_records' empty set (it carries the creatures).

THE FOUR HOSTS: none wired in 9a - the body is the door; 9b offers the
creature foes at dungeonContext.js, exteriorFoes.js (the world's and the
interiors'), and exterior.js's pool.

### 14b. The rig, the match and the hosts (SHIPPED 2026-10-09)

- THE BUILD (`combat/fpArm.js` buildCreatureBody, `buildFpArm`'s
  `creature` option). The match's candidate ids in order; per id the last
  CREA record the masters carry (a later one in a master, a later master
  - the store's overwrite); the first candidate carried wins. Its model
  through rule 18's actor path, assembled (14a), textured as a body is,
  its sources (14a), refused at its stage - `record`, `model`, `clip` - as
  any body is, and the sprite stands. XSCL is a uniform scale (weight and
  height alike, Creature::adjustScale). It stands in third person from its
  first frame and refuses first person; its standing height (the idle's
  first frame over its feet, scaled, in metres - `bodyHeight()`) is what
  PeerBodies culls and heads it by, where a person is the capsule.
- THE GROUPS, a NON-BIPED's (OpenMW CharacterController, read at
  0.48.0). No weapon short group for its claws and no spellcasting stance
  (`stanceOf`): its bare `idle`, looping on with no loop dice, and its bare
  `walkforward` - for a run it has no clip for too (the movement
  fallback); no turning on the spot (character.cpp:2178 - a biped's); its
  idle let go while an upper-body action, a movement or a recoil plays,
  and taken up again from its start (refreshIdleAnims' non-biped arm).
  Its BLOW is one of its attack groups by the roll ("Randomize attacks for
  non-bipedal creatures", chooseRandomAttackAnimation), played "start" to
  "stop" in one section standing as the follow-through - so the machine's
  next blow cuts it as it cuts a person's - and paced so the playhead
  reaches the group's "hit" at the machine's hit (MW-PACE1), or, with no
  hit key, its stop at the blow's end. Its CAST is one of the same (its
  spellcast group IS a random attack - "No 'release' text key to use, so
  cast immediately"). Its recoil and its death are the body's (MWNPC4). A
  BIPEDAL creature (a skeleton warrior, a dremora lord, a draugr)
  animates as a person, off xbase_anim first.
- THE MATCH (`characters/creatureBodies.js` CREATURE_MATCH), a census:
  every creature mobile named, a Morrowind creature or a declared miss
  with its reason. The ids are the records' own, READ OFF UESP's creature
  tables (its API, 2026-10-09), never recalled. Matched: rat (rat),
  spriggan (BM_spriggan), grizzly bear (BM_bear_black), skeletal
  warrior (skeleton warrior, else skeleton), giant (bm_frost_giant),
  zombie (bonewalker), mummy (draugr), frost and ice daedra/atronach
  (atronach_frost), fire daedra and atronach (atronach_flame), iron
  atronach (atronach_storm), daedroth, daedra seducer (winged twilight - a record that flies, AUDIT MW-NPC II K5),
  daedra lord (dremora_lord), lich and ancient lich (lich). Declared
  misses: the imp and the dreugh (AUDIT MW-NPC D4/D5, section 21: the imp
  FLIES and Morrowind's scamp walks, the dreugh SWIMS - matched, they walked
  in the air and through the water; a flyer or a swimmer with no Morrowind
  one that moves as it does keeps its sprite, the table's law for every row); the ghost and the wraith (a body's textures are alpha-tested,
  never blended - a translucent dead would be cut, not seen through;
  AMENDED BY MWNPC13, section 18: they stand as the ancestor ghost, the
  whole body veiled through the lanes' veiled pass);
  the orcs and the vampires (people, not creatures - an orc's race is no
  Daggerfall race a look can name yet; AMENDED BY MWNPC12, section 17: the
  orcs stand as people in Morrowind's Orc body - still never creatures); the werewolf (the player's wolf,
  WEREWOLF1, not yet a foe's); the slaughterfish (its swimming groups are
  not driven); and every beast Morrowind has none of (giant bat,
  sabretooth, spider, centaur, nymph, harpy, wereboar, scorpion,
  gargoyle, the dragonlings, the flesh atronach, the lamia).
  A MOD'S MONSTERS (DEX7, 2026-10-20, `04-Characters/Enemy-Expansion.md`
  section 10): a mod that adds mobiles past the classic ids registers its
  own rows on the same law (`registerCreatureMatches` - a match or a
  miss, ids as the reader keeps them, a flyer or a swimmer never in a
  walker, never a class's mobile); CREATURE_MATCH stays the census of
  DFU's own. Its people register beside the orcs' law
  (`characters/foeBodies.js` registerPersonFoes): a monster that is a
  person, in its race's body; a class that keeps its sprite (a rider).
- THE HOSTS. `foeActor` wears a matched creature's look (`{ creature:
  [ids] }`, one frozen object a kind - a body key); `isBodyFoe` (a class
  foe, or a matched creature) is the offer's test at every foe host -
  dungeonContext.js and exteriorFoes.js (the world's, the interiors' and
  exterior.js's pool), the living and the dead from the kill - on the
  foes' own lane, under the foes' caps: no new lane, no new bound. The
  watch are people. PeerBodies keys a creature `crea|<ids>` (every rat one
  body, a spare handed only between rats, never a person's key), builds
  it from its record, and rolls its blow by the swing count.

NOT HERE: a Weapon-flagged creature's held weapon and shield (a skeleton
warrior strikes bare-handed from xbase_anim); knockdown (Daggerfall has
no such event); the extra idles (OpenMW's wander AI plays them); swimming;
an atronach's flame and a creature's UV, visibility and flip controllers
(a body's pieces run no NIF controllers - the flame stands at its emitter).

PROVEN. `test/characters/mwnpc9b_creaturerig.test.js` (10), a creature built on a
real rig from the fixture's master and archive: the record, the x-model
and the sources, the scale and the height, third person and no first;
the refusals at their stages; the bare stances, the idle's endless loop,
the walk for a run, no turn though its .kf has turns, the idle let go
under the walk; the blow by the roll, one section, the idle back at its
end, the next blow cutting the last, the pace to the hit; the cast; the
recoil and the death (the dying creature stands); a Bipedal one's
sources; PeerBodies' key and build; the match's census, its ids pinned,
the misses' reasons, the look; the hosts' offers; the candidates in
order. `tools/mutants/mwnpc9b.json`: 27 mutants, 26 dead, 1 equivalent as
recorded (the creature's weapon guard: its stub holds nothing either way -
kept for the stub it spares a frame). Pins moved: MWNPC5b's and 5c's
offers (`isBodyFoe`; the pool's unmatched creature is a giant bat now),
MW-D39's stance count (the idle, the jump and the movement read it through
`stanceOf`), MAC7's strike (it carries the roll); eight mutant records
re-aimed by content. Found on the way: MWNPC5b-look-not-kept had been
surviving (no pin held the look kept over an equal copy of a piece) -
pinned in mwnpc5_foes.

THE FOUR HOSTS for the creatures: dungeonContext.js, exteriorFoes.js
(world.js's and worldModes.js's interiors), and exterior.js (its pool is
exteriorFoes.js) - WIRED, through the foe lane they already run.

## 15. MWNPC10 - THE REST

The populations no foe pool drives: the gate's boss and host (a relay's),
a ship's crew, the roads' parties, the siege's people, the broker. They
keep no foe record - no attack count, no hit marks, no entity - so their
actors are `characters/rosterBodies.js` rosterActor's: the look the
caller's, and a swing or a recoil counted on the record each time a key
the host already changes moves to a new value (the relay's attack time,
the time a blow met them; a NaN or a held value counts nothing).

### 15a. The gate's boss and his host (SHIPPED 2026-10-09)

- THE COURT'S LANE (`scenes/gate/gateCourt.js` drawBodies, a 'gate'
  population lane of its own). Him: offered while his sprite stands, on
  his billboard - walking or running as his act says, his blow a swing as
  the relay's attack changes, struck a recoil (his hurt and the court's
  flash), and SCALED: three times a man, his sprite's own scale times the
  fight's size, through the lane's new per-actor `scale` (PeerBodies
  draws a body that many times its size about its feet - drawThird's
  `grow` - and heads it that much higher). Fallen, dead, on his corpse's
  flat. His host (`scenes/gate/gateHost.js` offerBodies): each shown body its
  creature off its mobile, standing or falling (dead), on its own
  billboard; one its mobile has no match for (the Flesh Atronach - and,
  since AUDIT MW-NPC D4, the Imp) keeps its sprite. The dungeon pass (worldModes.js) draws them before the
  billboards their batches ride (`extraBillboards`); the court's leave
  lets the lane go. Him: the Daedra Lord's match, dremora_lord.
- THE BROKER (`scenes/sigilBrokerPool.js`) keeps her sprite: she is the
  Seducer IN HER MORTAL GUISE, and the match would stand her as the
  winged twilight she is hiding.

PROVEN. `test/net/gate/mwnpc10_gate.test.js` (4): rosterActor's counts (a held
key one swing, NaN none, a recoil each new blow), its dead, scale and run;
a real court over a recording lane - him and the Imp offered their
creatures (PIN MOVED, AUDIT MW-NPC D4: the Imp a declared miss - the host
offered is a bearer's Daedroth, the test's `imp` its name still), him at
his sprite's scale, the Flesh Atronach not offered, his
billboard cast-only under his body, the host's swing and recoil, the
fallen offered dead and then not, the lane let go at leaving; the scale
reaching drawThird on a lane of stub rigs; and by source the dungeon
pass's order and the broker's guise. `tools/mutants/mwnpc10a.json`: 18
mutants, 18 dead. Two mutant records re-aimed by content (OW-PEERS'
grow, INVISLOOK's camera record).

### 15b. The siege's fighters and the ships' crews (SHIPPED 2026-10-09)

- THE LOOK WITH NO ENTITY (`characters/foeBodies.js` rosterLook). A
  roster's person has no equip table to read, so its class dresses it: a
  race of the Bay's and a face off a seed, the clothes a foe wears under
  its armour in their dyes (`clothesUnder`, foeLook's own, which now calls
  it), and steel - cuirass, greaves, boots, pauldrons, gauntlets - for the
  knight, the warrior, the spellsword and the watch, the watch helmed as
  the street's guard is. A creature mobile is its creature
  (creatureBodies.js; none where there is no match). Kept on the record
  while its mobile, gender and seed hold (three compares, no key built a
  frame) - one build for its life.
- THE SIEGE (`scenes/siegeNpcs.js` drawBodies, a 'siege' lane). Each
  shown fighter its look off a seed of its id (FNV-1a, taken once when it
  is first stood - two guards are two people), on its billboard's feet,
  walking as its act walks, a swing each new relay attack (`atk` 0 is
  none), a recoil each new hurt, down dead; the captain a fifth again a
  man, as his sprite is (the lane's per-actor `scale`). The world draws
  them beside the street's people, before the flats their batches ride;
  the origin's move carries them; leave lets the lane go.
- THE CREWS (`scenes/naval/navalCrew.js` drawBodies, a 'crew' lane). Each hand
  on her deck his class's look off her seed and his place in her roster,
  at his sprite's feet and his world facing (kept off the frame's
  heading), each swing at his work begun one blow, concealed with her
  owner (drawn veiled after the opaque world, beside the watch's); a hand
  turned in below her deck is kept and not drawn. The world draws them
  with the foes and the watch, before the person billboards; clear lets
  the lane go.

PROVEN. `test/systems/mwnpc10b_rosters.test.js` (4): rosterLook's steel, helm,
clothes, creature, miss and keep; the real siege driver over a recording
lane - the guard helmed, two guards two looks, walking, the captain's
scale, the feet his billboard's, a swing and a recoil, down dead, the
origin, leaving; the real crew host - a hand's look, feet, facing,
conceal and blows, the hand below not offered, clear; the world's draw
points by source. `tools/mutants/mwnpc10b.json`: 25 mutants, 25 dead. One
MWNPC5b record re-aimed by content (foeLook's worn items now pass
through `clothesUnder`), one rewritten (MWNPC5b-face-one).

### 15c. The living world's people - the roads' parties and the residents indoors (SHIPPED 2026-10-10)

Both draw through one host, `world/travellerSprites.js` (the roads'
parties, their foes and their fallen - scenes/livingWorld/livingRoads.js; the
residents the day has inside a building - scenes/livingWorld/livingIndoors.js, the
line's own members already the family's bodies, LEGACY7), so its lane
stands them all - a lane of each instance's own: 'roads', 'room'. This
also takes the living residents indoors that MWNPC7's row handed to
MWNPC8: 8a stood the building's StaticNPCs; the living world's are here.

- THE LOOK AS THE SPRITE SHOWS IT (`characters/rosterBodies.js`
  residentLook, read once a body). One in a class's sprite (`res.cls`: an
  armed traveller, a guild's member, a foe) is that class's look
  (rosterLook) in their own race and sex - a foe the Bay's, a creature foe
  its creature, none where there is no match (it keeps its sprite). A
  STILL picture (LW-LOOKS) wears its kind's garments in their dyes - a
  courtier at home a noble's, a priest at the door his robes, a
  stall-keeper a merchant's; a beggar and everyone else the street's
  outfit their own sprite wears (folkBodies.js `folkLookOf`, now
  exported), the watch's plate on duty and his own clothes off it
  (WATCH-DAY). Each off their OWN ID's seed - one person wherever they are
  drawn, never a walker's per-spawn roll.
- THE BLADE. A roster's class one (this, the siege's, a crew's) now holds
  its class's blade by DFU's own roll for a class foe
  (enemyEquipment.js rollEnemyEquipment): a broadsword, a saber or a
  longsword, or a two-hander from the claymore to the battle axe, iron or
  steel, in the right hand, off the seed - 15b's stood bare-handed.
- THE ACTOR (rosterActor, now with `drawn`): walking as the body walks,
  facing its way; each strike begun one blow (the roads hand the edge);
  the fallen (a flat no one talks to) dead on the death's roll off the
  id - but a flat that is nobody (`body: false`, a road camp's fire) stands
  no body and its flame draws (CAMP-FIRE, FIELD BUGS 2026-10-11b); a class's
  sprite its blade out, the rest nothing drawn; a new person
  at a key a new id (a new body, never the last one re-dressed).
- THE DRAW. `drawBodies` offers the last sync's bodies ON THE GROUND ONLY
  - under the Overworld the bands' grown, fading sprites are the far
  view's - before the host's billboard pass draws the sprites, cast-only
  where a body stands: the roads' in world.js after their batches join
  the person billboards (moved with the origin), the room's through the
  host's `drawLivingBodies` after the building's people and before the
  room's billboards (worldModes.js). `clear()` lets the lane go (the
  open world left, the building left).
- COST. A body's look is read once; a frame's offer is a compare and a
  write (rosterActor), the bodies under the lane's caps and its tier like
  every other lane's.

PROVEN. `test/characters/mwnpc10c_roads.test.js` (4): the blade's two ranges to
their ends, iron and steel, the right hand, and a given race kept;
`drawn`; residentLook's every branch (the class in their own race and
sex, a creature, none, the courtier's and the priest's garments and dyes,
the beggar's and a walker's outfit off their variant, one look an id, the
watch on and off duty); the real sprites over a recording lane - the
walker, the armed, the foe, the bat not offered, the fallen dead, the
courtier a noble and alive, feet, facing, the strike edge, cast-only, none
under the Overworld, a new id a new person, the origin, clear; the room's
wrapper handing them on, and the draw points by source.
`tools/mutants/mwnpc10c.json`: 37 mutants, 37 dead. Pins moved: LEGACY7's
room sprites (a 'room' lane), LW3's roads block (the draw after the push),
MWNPC10b-1's rogue (her blade beside her clothes); two MWNPC10b records
re-aimed by content (the keep's compare takes the race, the items begin
with the blade).

THE HOSTS for MWNPC10: the gate court (15a), the siege and the crews
(15b), the roads and the rooms (15c) WIRED; the broker keeps her guise
(15a).

## 16. MWNPC11 - ONE FRAME FOR EVERY NPC LANE (SHIPPED 2026-10-10)

WHY. Each slice gave its population a lane under its own caps, and law 4
as amended made the frame's bound their sum. By MWNPC10 a port's street in
a siege with a party on the road runs seven NPC lanes at once - the foes',
the watch's, the walkers', the standing people's, the siege's, the
crew's, the road's - and the sum was 76 bodies and 26 skins a frame at
Near. MEASURED (`tools/mwNpcLaneProbe.mjs`, below): 45 standing and 21
skins a frame on that street at Near, 91 and 37 at All.

- THE BUDGET (`characters/npcBodies.js` createFrameBudget, the page's one
  NPC_FRAME_BUDGET, NPC_FRAME_TIERS by the switch's tier: 24 bodies and 8
  skins at Near, 48 and 16 at All - below the 28 and 10, 56 and 20 MWNPC7
  summed for the foes, the watch and the walkers, so no lane wired since
  adds a body or a skin). Each lane, as it syncs, reports the squared
  distances of what it could stand - its nearest within its own range, to
  its own cap, a sorted insertion into its own buffer (no allocation a
  frame) - and the budget's cut is the k-th nearest across every lane's
  last report (a lane syncs at its host's own point in the frame, so a
  report is at most a frame old; one not of this ROUND of reports or the
  last (NPC_BUDGET_ROUNDS - a round ends when a lane reports again, as each
  does once a frame; AUDIT MW-NPC B4, section 21: it was 250 ms of the
  clock, and a long frame staled every report), or a lane let go, takes no
  share). The cut is ranked ON THE GROUND'S PLANE, as PeerBodies measures
  the range it becomes (AUDIT MW-NPC B2). The lane stands its bodies within the cut
  (PeerBodies `setLimits`: the range), so the frame's bodies are the
  nearest k, whoever's; those tied at the cut stand together.
- THE EDGE HELD. A body standing keeps its place to NPC_BUDGET_HYSTERESIS
  (1.15) past the range, and a far one returns only within it - the cut
  moves as the crowd does, and each fall and stand was a skin. The lane
  ranks a body it holds (PeerBodies `holds`) by that hysteresis in its
  report, so the cut counts the held among the k: the bound stays exact.
  (AMENDED BY AUDIT MW-NPC II L4: exact for a still street. Each lane cuts
  against the others' reports of the frame before, so while the crowd
  moves an actor crossing the cut between two lanes' syncs is counted in
  both or in neither: measured on a walking street, 25 standing against
  24 on up to 1 frame in 100, and 26 on 1 to 5 in 100 at 10-20 m/s - never
  more than two over, and never held.)
  The range is set a hair past the cut, so the body AT it is never lost to
  the root's rounding and back the next frame.
- THE SKINS SHARED. Each lane with a body in the cut takes one skin a frame
  and the rest go by its share of them - the frame's sum the budget's, or
  one a lane where more lanes than that stand; a lane under its own cap
  keeps the lesser.
- NO RIG PAST THE RANGE. An NPC lane's PeerBodies builds no body for one
  past its range (`buildInRange`) - their sprites stand - so the one build
  queue is never spent on bodies the frame would not stand. The peers keep
  their own instance as it was: no budget, no hysteresis, a rig for a peer
  far off, ready.
- MEASURED (law 5). `node tools/mwNpcLaneProbe.mjs` drives the REAL lanes
  (createPopulationLane over createNpcBodies over PeerBodies) on stub rigs
  that count a skin, a drawn body, a rig built and a bind of the sprite
  target, over 600 frames of that street walking round the eye 2-70 m out:

  | tier | lanes | bodies/frame | skins/frame | draws/frame | binds/frame | rigs built |
  |---|---|---|---|---|---|---|
  | near | each alone | 45.0 | 21.00 | 45.0 | 7.00 | 70 |
  | near | one budget | 24.0 | 6.50 | 24.0 | 7.00 | 24 |
  | all | each alone | 91.0 | 37.33 | 91.0 | 7.00 | 99 |
  | all | one budget | 48.0 | 12.00 | 48.0 | 7.00 | 48 |

  A skin is a palette upload (MWNPC1) and a body drawn a tile of the sprite
  target (MWNPC2); their milliseconds are PEER-CADENCE's and PERF-RIG1's
  per body, times these counts. RE-MEASURED AT THE AUDIT (section 21): the
  budget's rigs built were 35 and 67 - the first frame's lanes cut before
  the others reported and queued bodies the next frame would not stand;
  a body past the cut is let go unbuilt now, so the rigs are the frame's
  bodies, 24 and 48.

NOT HERE: ONE BIND A FRAME (law 2) holds per lane, not per frame - a bind
of the sprite target for each lane that draws a body (seven on that
street; an empty lane's flush binds nothing). A bind is a target switch
and a tile clear, not a body's cost; one bind for every lane would draw
every lane's quads at one point of the frame, past their hosts' own draw
order.

PROVEN. `test/characters/mwnpc11_budget.test.js` (5): the budget alone (the k-th
nearest across reports, Infinity while fewer, only a buffer's first n, a
stale or dropped lane none, the skins one a lane and the rest by share,
one each where more lanes than skins); PeerBodies' limits (a body past the
new range its sprite again, no rig past the range for a lane that builds
in range, the hysteresis held one way and not the other, a peers'
instance as it was); two lanes on one budget against each alone (six
standing, the nearest, two skins, the rigs - and 24 standing alone; a lane
let go hands the frame to the other, its six nearest exactly); the tiers
below MWNPC7's sum and every host's lane on the page's budget; a shuffled
crowd's six nearest, and a lane past its range taking no skin.
`tools/mutants/mwnpc11.json`: 24 mutants, 24 dead.

## 17. MWNPC12 - THE STEEL THAT NEVER SHOWED, AND THE ORCS (SHIPPED 2026-10-10)

- THE STEEL. Every look that put a body in steel without an equip table to
  read - the street's guard (MWNPC7, folkBodies.js), a knightly order's or
  a fighters' guild's standing person (MWNPC8a, peopleBodies.js), the
  rosters' steel classes and the watch (MWNPC10b, foeBodies.js rosterLook)
  - wrote its material as `1`. A look's armour is resolved by
  `formats/morrowind/mwItemMap.js` mwArmorRecords against Daggerfall's own
  ARMOR_MATERIAL (systems/armorMaterials.js - steel is 0x0201), and 1
  names no material: none of it resolved, so every one of them stood in
  their clothes, and the ones whose boots took their feet stood barefoot.
  Their pins checked the number, not the piece worn. Each now wears
  ARMOR_MATERIAL.Steel, and the pin is mwArmorRecords itself over
  Morrowind's own ids: every piece of every steel look resolves to steel.
  (Sections 11, 12, 13a and 15b's "steel" was this until now. AMENDED BY
  MWNPC17, section 25: a knightly order's person wears a knight's plate of
  one metal by rank, a fighters' guild's a fighter's armour.) A weapon's
  material is Daggerfall's weapon table, where 1 is steel - those were
  right.
- THE ORCS (foeBodies.js ORC_MOBILES, isPersonFoe: the orc, its sergeant,
  its shaman, its warlord). Daggerfall's monsters that are people stand
  as people in Morrowind's Orc body - never creatures (creatureBodies.js
  keeps them misses). A foe orc is dressed and armed from its own equip
  table as a class foe is (DFU arms an orc as it arms a class -
  enemyEquipment.js equipmentVariantFor), its clothes under; the dungeon's
  and the encounter pool's hosts stand it through isBodyFoe and foeActor,
  as every person foe. An orc with no table to read - a road's, a
  roster's (a caravan beset by orcs) - wears DFU's own kit for it
  (`orcKit`, rollEnemyEquipment's law): the orc and its shaman a
  one-hander and half the time a buckler or a round shield, each piece of
  armour at even odds; the sergeant a two-hander and each piece three
  times in four; the warlord nine in ten; each piece leather, chain or
  iron or steel plate by DFU's own odds (randomArmorMaterial, at the low
  levels' plate). A face off the seed, as every roster's.
- An orc's body is built on the player's data as any person's: the Orc
  race's body parts, its head walked (Daggerfall has no orc portrait to
  match - matchFaceFor stands the walk). A body that fails to build keeps
  the sprite, as every lane's does.

NOT HERE: none of section 14b's people misses remain - the ghost and the
wraith are section 18's, the vampires 19's, the werewolf 20's.

PROVEN. `test/characters/mwnpc12_steelorcs.test.js` (3): the guard's, the knight's,
the warrior's and the watch's every armour piece resolved to steel by
mwArmorRecords over Morrowind's ids, and 1 resolving nothing; each orc
mobile a person, not a class nor a creature, in Morrowind's Orc and what
its table holds, a class foe still the Bay's, a rat its creature; the
roster orcs' kit over 300 seeds each - the variant's blade, the shield
half the time on one-handers and never on two, each piece at its odds,
leather, chain and iron or steel at DFU's - and the road's beset by Orcs.
`tools/mutants/mwnpc12.json`: 21 mutants, 21 dead. Pins moved: MWNPC7-1,
MWNPC8a-1 and MWNPC10b-1's `material === 1` (each now ARMOR_MATERIAL.Steel);
mutant records re-aimed by content: MWNPC7-guard-iron, MWNPC9b's actor
and body-foe records (isPersonFoe), MWNPC10b's creature and all-men,
MWNPC10c's unarmed, one-hander and race records.

## 18. MWNPC13 - THE SPECTRAL DEAD (SHIPPED 2026-10-10)

- WHY THEY WERE MISSES, AND WHY NO LONGER. A body's textures are alpha-
  tested, so a ghost's body would be cut, not seen through - but every foe
  host already draws a CONCEALED body translucent after its opaque world
  (INVIS-LOOK, PeerBodies drawVeiled: ECV1's record on the body's quad).
  The whole body veiled is what Daggerfall's spectral sprite is: drawn at
  SPECTRAL_ALPHA (180 of 255, dataPipeline.js's spectral arm).
- THE MATCH. The ghost and the wraith stand as Morrowind's ancestor ghost
  (`ancestor_ghost`, UESP's undead table, read 2026-10-10 - Morrowind has
  no generic greater ghost or wraith; its others are named uniques), the
  look carrying `veil: SPECTRAL_VEIL` (`characters/creatureBodies.js`:
  mode 3, plain - no tint, no clock - at SPECTRAL_ALPHA / 255).
- THE LANE VEILS WHAT ITS LOOK VEILS (`characters/npcBodies.js` stand):
  a host's own concealment first (a ghost turned invisible is ECV1's
  shimmer), else the look's veil - so every lane standing the look veils
  it, whoever's adapter offered it. Every foe host draws its veiled
  bodies already (the dungeon's, the exterior's, exterior.js's, the
  interiors'); the roads' sprites now do too (a ghost besetting a party at
  night), beside the foes' in world.js's veiled block.
- A NAMED SPECTRAL KEEPS HIS SPRITE. Lysandus is placed by his quest in an
  archive of his own (473); the body is the stock ghost's and he is no
  stock ghost. A spectral whose sprite archive is not its mobile's own
  (`mobileArchive` in the dungeon, `archive` in the encounter pool) has no
  look.

PROVEN. `test/characters/mwnpc13_spectral.test.js` (3): the veil at 180 of 255 in
mode 3; both mobiles the ancestor ghost, veiled, in their stock archives
by either host's field and none in 473; the living unveiled; a ghost foe
a body foe in the veiled look; a lane of stub rigs drawing the ghost only
in the veiled pass, the rat only in the open one, and a host's own
concealment over the look's; the roads' sprites and the world's veiled
block by call and by source. `tools/mutants/mwnpc13.json`: 12 mutants, 12
dead. Pin moved: MWNPC9b-8's census (the translucent dead now veiled, not
missed).

## 19. MWNPC14 - THE VAMPIRES (SHIPPED 2026-10-10)

- THE FLAG. A BODY record's BYDT is [part, vampire, flags, type]; the
  reader took three of the four. `formats/morrowind/mwFirstPerson.js` readBodyPart
  now keeps the second (`vampire`), and ARM_RECORDS_VERSION moves to 6 so
  a stored record set from before it is re-extracted, never read without
  it.
- THE FACE (`vampireHeadRecord`, OpenMW 0.48.0 npcanimation.cpp
  getVampireHead): the BODY record that is a vampire's, a skin, a head, of
  the sex and the race (any case) - the LAST in load order, as the
  reference's mapping overwrites - NotPlayable no bar (Morrowind's vampire
  heads are never offered at chargen: race.cpp's getBodyParts filters
  NotPlayable alone, so the living walk never meets one). `playerBodyRows`
  with `vampire` puts it in the head row, the hair the actor's own
  (updateNpcBase); a race with none keeps the face it had. The build
  (`buildFpArm`, `buildTpBody`) carries `vampire` to it.
- THE PEER LAYER. A look's `vampire` reaches the build (`peerBuildOpts`;
  never for a werewolf) and keys a body of its own (`vamp|` - never a
  living look's spare, which wears the other face). The wire's looks
  never carry it: this is the NPCs'.
- THE FOES (`characters/foeBodies.js` VAMPIRE_MOBILES, isPersonFoe: the
  vampire and the ancient vampire). People, as Morrowind's are: a person
  of the Bay in its clothes (DFU gives a vampire no equipment), with the
  vampire's face; bare-handed - its claws are its own. A roster's or a
  road's the same (`rosterLook`). Never creatures (creatureBodies.js keeps
  the misses).

PROVEN. `test/characters/mwnpc14_vampires.test.js` (4): parsed records (the flag
read; the last head of the race and sex, any case, NotPlayable or not;
none for another race; the living walk never a vampire's even with a
living NotPlayable head after them; the rows swapping the head and
keeping the hair; a race with none unchanged; a stored set carrying the
flag and a v5 set refused); a real fixture build reaching for the
vampire's head through the record walk where the living build has none;
the peer layer's option and key; the vampire foes, rosters and road.
`tools/mutants/mwnpc14.json`: 19 mutants, 19 dead. Pin moved: MW-D27's
face thread (the picker's options take `vampire`); mutant records
re-aimed by content: the three ARM_RECORDS_VERSION records (MWNPC9a,
MW-SPELLFX1, WW-AUDIT C2) and the foe and roster records MWNPC14's lines
touched (MWNPC5b, MWNPC10b, MWNPC10c, MWNPC12).

## 20. MWNPC15 - THE WEREWOLF (SHIPPED 2026-10-10)

- A PERSON IN ITS BEAST FORM. The player's werewolf (WEREWOLF1) and a
  peer's already stand in Bloodmoon's wolf: PeerBodies builds the wolf for
  a pose whose `wb` bit is 1 (its skeleton, head, hair and robe, its own
  .kf - nothing held), and where the data has no wolf it refuses it once,
  at the skeleton, for the data (AUDIT E2), and the sprite stands. A
  werewolf foe (`characters/foeBodies.js` WOLF_MOBILE, isPersonFoe) is a
  person whose look is marked `wolf`; the lane hands PeerBodies the wire's
  own bit for it (`characters/npcBodies.js` npcShown `wb`), so it is built
  and keyed as the wolf a transformed player wears (`wolf|`). Bare-handed;
  a roster's or a road's the same. The wereboar keeps its sprite:
  Bloodmoon has no boar.

PROVEN. `test/characters/mwnpc15_werewolf.test.js` (2): the werewolf a person marked
wolf, its pose's bit 1 and every other's 0, never a creature, the boar
none, a roster's and a road's; a lane of stub rigs building it as the
werewolf and standing it, and - where the wolf is refused at its skeleton
- refused once and its sprite standing, the man beside it unaffected.
`tools/mutants/mwnpc15.json`: 7 mutants, 7 dead. Pin moved: MWNPC4d's
pose (`wb` 0 for a person); mutant records re-aimed by content: MWNPC10b's
creature, MWNPC10c's unarmed and five of MWNPC14's.

## 21. THE AUDIT (2026-10-10)

Mac: "Do a deep audit and ensure perfection."

- THE CENSUS (`test/scenes/mwnpc_census.test.js`, the old arc's lesson NPC4b,
  section 5). Every source that draws a living actor's sprite - a mobile's
  unit, a walker, a mobile billboard sized off its record - either names
  one of the arc's adapters (it stands its actors in bodies: the watch, the
  dungeon, exterior.js, the encounter pool, the gate's boss and host, the
  crews, the siege, the street's walkers, the roads and the rooms) or is
  declared with the reason it keeps its sprite (the peers' own fallback
  picture, the broker's guise, the Overworld's far bands, and three that
  draw nothing). A new population drawn without either fails the suite.
- THE FOUR COLD LANES (picked up after the merge of main, section 22; each
  reviewer read a frozen snapshot at 1fd44c83ad, read-only, and traced
  every finding from a real caller before reporting it - the lanes' own
  probes reproduced the measurable ones). Every finding is fixed here and
  pinned in `test/characters/mwnpc_audit.test.js` unless it says otherwise.

  THE GPU SKIN AND THE BODY SERVICE (A).
  - A1. The veiled pass drew outside MWNPC2's batch: each concealed or
    spectral body took its own bind of the sprite target - and since
    MWNPC13 every ghost is veiled (a crypt's six, six binds a frame).
    `PeerBodies.drawVeiled`, the one seam every lane and the peers share,
    opens the batch (never inside one a host holds - a nested open would
    drop its queue); each quad still blends under its own veil.
  - A2. MW-BOW1's part clock counted a re-pose every pose, moved or not -
    an idle or sheathed bow's clock holds still - so every bow carrier's
    GPU body re-streamed the bow each posed frame. `posePartClocks` keeps
    the time a part was posed at (`mwPartClock.js` nodeClockAt, the node's
    clock alone) and neither poses nor counts a part whose time is the same.
  - A3. A gap in section 22: the creatures' producer (assembleCreature)
    carried no normals, so every creature stayed faceted. Its skinned and
    rigid pieces carry them as a person's parts do.

  THE LANES AND THE FRAME BUDGET (B).
  - B1. Online, an encounter pool's foe and a peer's puppet of the same
    number (`seq` - a puppet carries its owner's) were ONE body: both
    billboards cast-only and one foe drawn nowhere. The pool's bodies are
    keyed by its own entry id (`idOf`); the look still seeds off the shared
    number, so each machine draws the same person.
  - B2. The cut ranked in 3D and PeerBodies measures the range on the
    ground's plane: an eye raised over a crowd (a wall top, a gallery, the
    Overworld) stood every body the flat range let in - 45 at Near where
    the budget is 24. Ranked on the plane; and a lane that reports none
    takes no skins (its last cut's share stood).
  - B3. In an NPC lane a body past the cut held its slot: a lane's nearer
    actors stood as sprites for good behind its own far bodies (the
    reviewer's street stood 12 of 24 for half a minute). A far body gives
    its slot up first and at once - its sprite already stands - before a
    visible body held past the range.
  - B4. The first frame of a scene, and any frame past 250 ms, cut each
    lane alone (every other report stale) and queued builds for bodies the
    next frame would not stand: 35 rigs for a budget of 24 (the probe's own
    table). A queued body past the cut by its turn is let go unbuilt, and a
    report is stale by ROUNDS of reports, never by the clock (section 16,
    re-measured: 24 and 48 rigs).
  - NOT HERE (B5): about five short-lived objects an actor a frame on the
    lane's hot path (the peer entry, its shown pose, the id string, the
    scene feet). PeerBodies keeps an actor's feet and pace arrays across
    frames, so reusing them risks the aliasing that reads a walker as
    standing still; the probe counts skins and binds, not allocations.

  THE POPULATIONS AND THEIR HOSTS (C). C1 is B1; C2 is D1.
  - C3. Opening the Overworld left the road parties' sprites cast-only
    where their bodies had stood on the ground - drawn nowhere, their
    shadows alone. Under the Overworld every sprite is shown
    (`world/travellerSprites.js`).
  - C4. A living resident walking the street wore the look of whichever
    pooled walker row the town dressed them onto (folkBodies.js seeded it
    off the row), another indoors and on the road, another on another
    machine. A walker carrying a resident stands as that resident
    (`characters/rosterBodies.js` residentWalkerActor: their id,
    residentLook's look); exterior.js walks no living town.
  - C5. A watchman's look was memoised off his local id before he first
    rode the wire, and every peer drew another man. His seed follows his
    number once he has one (MWNPC6a's pin moved: he changes once, the
    moment he first rides). (AMENDED BY AUDIT MW-NPC II K3/K4, section 23:
    the seed is minted ONCE at the owner's own foe and rides the wire - his
    number arriving no longer moves him at all.) NOT HERE: an encounter foe restored from a save
    is numbered anew, so it comes back another person - a stable seed would
    need a field of the save's own.
  - C6. With a window open both dungeon hosts draw the flats and return
    before drawFoes - the only place a body is drawn - so a corpse whose
    body had stood was drawn nowhere. The flats are shown first on that
    branch (`dungeonContext.js` showBodyFlats; worldModes.js and dungeon.js;
    worldModes holds it above BLOOD1a's marks, which that pin keeps within
    400 characters of the flats' draw). (AMENDED BY FB1015 LOOT-BODY, section
    29: the flats are still shown first, and the bodies the lane last synced
    are drawn over them - the loot window no longer stands a looted body's
    classic corpse in its place; `showBodyFlats` is `drawWindowBodies`.)

  THE CREATURES AND THE SPECIAL FOES (D).
  - D1. A dead foe's body stood where it died - a flyer's in the air, a
    boarder's over the sea while its corpse rode the deck - with the corpse
    flat under it cast-only. The dead stand where the corpse lies (the
    dungeon's corpsePos, the marker's pos outdoors, which a moving deck
    carries).
  - D2. A Daedra Seducer stood as the winged twilight from her first frame,
    giving away the guise Daggerfall keeps until SeducerTransformBehaviour
    completes. She keeps her sprite until then (the broker's law, 15a).
  - D3. Foe bodies ignored the sprite's size - an elite's quarter, a last
    stand's tenth, the wild zone's giant four times a man. foeActor takes
    the size its host draws the sprite at (the dead: their corpse's).
  - D4/D5. The imp (a flyer) and the dreugh (a swimmer) are declared
    misses (section 14b's list amended), and the table holds every row to
    it: no Daggerfall flyer or swimmer stands in a Morrowind creature that
    walks. MWNPC10a's pin moved: the gate's matched host creature is a
    bearer's Daedroth, its harrier Imp a sprite.
  - D6. Both record walks let the last record of an id win "as the load
    order does" over the store's alphabetical keys (Bloodmoon, Morrowind,
    Tribunal). `fpArm.js` esmLoadOrder: Morrowind, Tribunal, Bloodmoon, then
    the rest as stored.

  PROVEN. `test/characters/mwnpc_audit.test.js` (16), and pins moved where a law
  moved: MWNPC5c's pool ids (the pool's uid), MWNPC5b-d's dungeon source
  (the size), MWNPC6a (the seed), MWNPC7's world offer (the resident),
  MWNPC10a (the Daedroth), MWNPC10c (C3, added), MWNPC11-1 (rounds, its
  frames written out). `tools/mutants/auditmwnpc.json`: 31 mutants, 31
  dead; seventeen older records re-aimed by content (MWNPC11's three,
  MWNPC5b's three, MWNPC5c's five, MWNPC6's, MWNPC7's, MWNPC9b's two,
  section 22's clock record, WB9h's hand-over timing). The judge over every
  list the audit touched (698) found two lines nothing held, both MWNPC11's
  and older than the audit, now pinned: a far body holds no place in the
  cut (MWNPC11-2, `holds`), and a lane let go gives its share up at once,
  not a round of reports on (MWNPC11-3, `drop`).

## 22. THE MERGE OF MAIN (2026-10-10)

The arc's branch forked at #723; main landed 290 commits (#723-#744)
before it was picked up again. Fifteen files conflicted (the merge
commit says how each was taken). Five of main's slices met the arc on the
merged tree without a conflict to say so - three do per-pose work on the
CPU skin that MWNPC1's GPU pose never ran, so on the merged tree every
GPU-skinned body (the player's third person, every peer, the family, the
card regulars and every NPC lane) would have dropped it:

- MW-SMOOTH x MWNPC1: THE NORMALS. Main's MW-SMOOTH lights every Morrowind
  mesh by the normals its file authored, posed with it (skinBatch turns a
  normal by the composed 3x3, placeNormalsAtBone a rigid part's), and by
  its face only where a mesh has none or a corner's is zero (packFpArm).
  The GPU skin lit everything by its face, off the derivatives: every body
  in the world faceted again. Now the stream's first fourteen floats are
  packFpArm's corner, lane for lane (`formats/morrowind/mwGpuSkin.js`
  SKIN_STATIC_FLOATS = fpArm.js FP_FLOATS), the normal lanes holding the
  AUTHORED normal (a rigid part's mirrored with its vertex, as
  placeNormalsAtBone mirrors it); CHAR_SKIN_VS composes the rows once
  (`skinRows`) and turns the position and the normal by them, the normal
  renormalised as skinBatch does and zero where the 3x3 or the normal is
  (a collapsed vertex, a mesh with none); skinFaceFs lights by it, and by
  the face where it is zero. ONE stated difference: the pack lights a
  triangle with one zero corner by its face at that corner alone, and the
  shader's interpolated normal shortens towards it - the face takes over
  only where it has all but vanished. A zero corner is a collapsed vertex
  (rule 40), which no retail body is meant to show. COST: three floats a
  corner more in the static stream (23 a corner for one influence pair,
  was 20; 31 for two, was 28), uploaded once; nothing a pose.
- MW-BOW1 x MWNPC1: A PART ON ITS OWN CLOCK. Main's MW-BOW1 re-poses a
  bow's limbs and string (a morph - no affine a palette entry could carry)
  and the arrow on its ArrowBone before each pose, writing the pieces'
  sources (mwFirstPerson.js posePartClocks); the GPU stream was laid out
  once, so on a GPU-skinned body the bow never drew. Each re-pose now
  counts the piece's `sourceGen` (and so does the cloak's stowed-gear fit,
  which replaces a source); the layout keeps the count it streamed, and
  `restreamMovedRows` re-writes a moved piece's corners alone, into a
  buffer of its own, for `renderer.updateSkinStream` to put into its range
  of the mesh's buffer - a bow's few hundred corners while it draws, never
  the body (fpArm.js uploadThirdMesh). Its box moves with it (rule 42).
- AUDIT MW-CLOAK x MWNPC1: THE SEATED CLOAK AND THE GEAR THAT GOES WITH
  IT. Seated, main swapped the cloak's batch for one whose thighs weighed
  less (mwCloakFit.js seatCloak - gone since MW-CAPE-RIGID, 2026-10-14: the
  cloak rides the chest alone, `04-Characters/Cloak.md`); the stream
  carries the weights, so a layout is the same body only while each
  skinned piece skins by the batch it was laid out from (`skinSamePieces`)
  - a fit that replaces the cloak's batch lays the body out again, once.
  And main turns the stowed gear with the cloak after every pose (the
  assembly's `afterPose`, applyCloakFollow), reading the CPU-posed cloak
  and re-placing the gear on the CPU: the GPU pose returned before it. Now
  the GPU pose runs the hook too; on it the follow skins the cloak alone
  on the CPU (by the same law the shader draws it) for its contacts, and
  leaves each turned piece's placement on it (`followAt`) for
  writeSkinPalette, which places a rigid entry by it - where the CPU
  places it. A re-fit clears what the last follow left. No NPC wardrobe
  holds a cloak (folkBodies.js, peopleBodies.js, the foes' equipment), so
  this is the players' bodies' (and a cloaked peer's).
- WAGONS2 x MWNPC5c: a companion seated in a wagon's back is drawn grown
  with it under the Overworld (scenes/exteriorFoes.js `_sg`); that sprite
  is the far view's, as the roads' bands are (section 15c), so the lane
  stands a foe-pool actor only at `_sg === 1`. At its true seat it is
  offered its body - standing, as its sprite stands (NOT HERE: a seated
  body for a companion in a wagon - player/seatPose.js poses the peers').
- ORG2 x MWNPC5b: main's one Settings screen places every Features row on
  a tab; the Morrowind People row stands in Combat > With Morrowind data,
  beside the Steel Helm and the Spell Effects (section 10b).
- RW1 x MWNPC8b/8c: THE VIEW OUT. Main's real windows draw the street
  through a building's glass from inside it - the pixel's flats (world.js
  drawOutsideStreet) and the town's (exterior.js) - and the street's
  standing people's billboards are among them. No body is drawn in the view
  out, but each billboard kept the street frame's last cast-only mark, so
  the people nearest the house - the ones its windows look out on - were
  missing from the glass. Each view out shows every flat it draws; the
  street marks them anew at its next offer. The interiors' host draws its
  exterior host's view out; a dungeon has no glass.
- BOOT2 x MWNPC1: the entry's static reach, 74 - render/skinPalette.js (a
  leaf: the palette's entries a row and its unit) measured 70 on the branch
  under WINDFALL1's ceiling of 71; RW1 on main measured 73 and set the
  ceiling there. CI's tests 4/4 failed on it; the ceiling moves to 74 by
  the test's own convention, the leaf held to staying one.

READ AND FOUND SOUND: MW-FIT1's occupation (which parts a pauldron or a
closed helm hides) is decided at build, before a layout; REGIONAL-FOLK's
Redguard towns reach the walkers' bodies (the population's race is
walkerRace) and the living residents' (the census's); PERF-VAO1 caches the
renderer's VAO binder and the skinned mesh binds through it; CHAR_VS and
CHAR_FS did not move on main, so CHAR_SKIN_VS is still CHAR_VS line for
line plus the skin; the census (section 21) holds on the merged tree.

PROVEN. `test/formats/morrowind/mwnpc_mainmerge.test.js` (6): the clock counted on the
limb's morph and on the arrow's ArrowBone and never on a still bow; a
moved rigid part re-streamed alone, at its range, as a fresh stream would
hold it, once, posed where the CPU places it, its box holding the CPU's
fold; the rig sending that range into the same mesh and no whole stream;
the seated cloak's layout not the standing one's and back; the gear
placed by the palette where a CPU pose places it at two strides (the cloak
alone skinned on the CPU, no gear placed there, a placement the follow
turned), and a re-fit with no cloak letting go; the grown companion's
sprite and its body at the true seat; the view outs showing every flat they
draw (by source); the Settings row. PIN MOVED
(`test/formats/morrowind/mwnpc1_gpuskin.test.js` MWNPC1b, MWNPC1g): the hand-built pieces
author normals (one zero, and one file whose normals do not match its
vertices), every vertex's and every corner's normal by the shader's law is
the one the CPU skin and the pack light it by - or zero where the pack
lit the corner by its face, both halves seen - and the GLSL's lines.
`tools/mutants/mwnpcmerge.json`: 25 mutants, 24 dead and one recorded
equivalent (posedNormals mints a piece's normals exactly when its batch's
match, so the guard's two halves are one fact) - AMENDED BY AUDIT MW-NPC
II P5: not so for a FITTED cloak (the fit rebuilds its batch's normals
full length where its own were short), and the record is killed now
(section 23); four records re-aimed by content (MWNPC1's post and UV
lanes, AUDIT MW-CLOAK's stale follow and its hook), and MW-BOW1's,
MW-SMOOTH's, MW-CLOAK's and AUDIT MW-CLOAK's lists judged again on the
merged tree: 97 records, 96 dead and AUDIT MW-CLOAK's one equivalent as
recorded (AUDIT MW-NPC II P6: this said "59 dead", the four lists less
AUDIT MW-CLOAK's). And in a real browser:
`tools/mwGpuSkinProbe.mjs` gives both rigs the same authored normals and
renders three more shots - 32 to 77 shades, 0 texels apart; with the
fragment's skinned normal taken out by hand it fails all three (max 125
apart).

## 23. THE SECOND AUDIT (2026-10-10)

Mac, of the PR: "Please audit and ensure perfection." Five cold lenses over
the arc at 154d59fd80 - the GPU skin and the renderer, the lanes and the
budget, the hosts, the looks, and the proof (the tests, the records, this
page and the patch notes) - each finding refuted by its finder before it
was reported, and verified again here. Main moved meanwhile (#748: WAGONS3,
MERCHANT-YARDS), and the merge is part of the round.

THE MERGE (P1). MERCHANT-YARDS draws each yard's keeper - a person in the
town's race, its idle record (`scenes/merchantYardsHost.js`) - which the
census (section 21) failed on the merged tree: a new host drawing a living
actor with neither a body nor a reason. The keeper stands in a body now
(`offerBodies`): the street's outfit their picture wears (folkBodies.js
folkLookOf, its archive and the town's race), off the yard's own key so
every client stands the same keeper, turned to the eye as a standing
person is (peopleBodies.js personActor), offered on the street's people
lane (world.js `offerStreetPerson`) before it draws. WAGONS3's driver on
the bench is a player - the peers' bodies, not the arc's.

THE LOOKS (K).
- K1. A living resident walking the street read their look once, off the
  resident alone - so an on-duty watchman stood in his own clothes (census
  mints every watchman `civvies`), a guild hall's member and a priest in a
  shirt where their sprite walks in their class, and a priest at the
  temple's door in no robes. `rosterBodies.js` residentWalkerActor reads
  what the row wears NOW - `guard` (the uniform), `cls` (the class it is
  armed in), `stillLook` and its kind `stillRole` (the town hands it -
  livingTown.js `p.still(look, role)`, the walker keeps it) - and reads the
  look again when that changes. A BEGGAR's picture sits or lies at their
  pitch and no body does: none is offered, the picture stands.
- K2. Online, a peer's foe wore nothing: a puppet is built with an empty
  table (its loot is the owner's grant) and the streamed weapon went to its
  hand alone. The owner now streams the look it stands its foe in - `ls`
  the seed, `lw` a person's worn kit (net/wire.js validFoeRecord; on the
  first word and every full frame, and again when either changes) - and a
  puppet (`_mwWire = 'kit'`) stands in its sprite until it has them, then
  is the owner's man in the owner's armour and blade. A record still
  building keeps the look the first word carried. THE DUNGEON'S LAW, said:
  every machine's copy of a dungeon's foe wears its own copy's kit, and
  its race, face and death are the room's (the layout point's, or the
  owner's seed); what its BODY holds is the room's - one base list every
  copy computes, the takes against it the room's word, and each player's
  own bonus over it (PARTY-LOOT, 2026-10-14, Mac: "Shared base + personal
  bonus" - `06-Systems/Online-Arc.md` PARTY-LOOT), whatever the copy wore.
- K3. A dungeon's puppet - a room's encounter, a member's own foe - was
  stood at its first streamed feet, its `marker`, and seeded off that: its
  owner's spawn spot to the owner, another man to everyone else. The room's
  and the own lane's records carry the owner's seed (`ls` - roomRecord's
  `seeded`; never the layout's records, which every machine seeds off the
  layout point, and whose full frame is at the wire's cap), and their
  puppets (`_mwWire = 'seed'`) wait for it.
- K4. The seed was the wire number alone: two owners' number 1s of one
  species were twins (the watch, all 146), and an heir's renumbering made
  a foe another person mid-fight on every screen. `foeBodies.js` foeSeed
  is minted ONCE - its number and where it stood - and an heir keeps it
  (and the kit it wears) and streams it on.
- K5. The transformed Daedra Seducer FLIES (mobileUnit.js), and her body
  was the winged twilight whether or not Morrowind's record flies - D4's
  law asked of the data: her row says `flies`, and the build
  (fpArm.js buildCreatureBody) refuses a record without CREA's Flies flag
  at the record - her sprite stands.
- K6. Vampire people keep their sprites, the reason restated (section 13a).
  NOT HERE: a vampire clan's standing person in a body with the vampire's
  head - the look would rest on a faction row's word alone.

THE GPU SKIN (G).
- G1. A vertex whose live weights summed to none or less was collapsed by
  the CPU skin and blended by the GPU's; the layout zeroes its influences,
  so the shader lands it on the post's translation as the CPU does.
- G2. The masters' load order ranked by PREFIX - "Morrowind Patch.esm" as
  Morrowind's own, stored before it, losing every record it patched. By
  whole name now (`ESM_MASTERS`).
- A sprite batch opened inside an open one dropped the outer's queue
  (latent - drawVeiled alone guarded it). The batch is nest-safe: the inner
  joins, the outer flushes all.

THE HOSTS (H).
- H2. Under the Overworld every lane but the roads stood bodies at the foot
  of the picture, upright under the flats' lean, a few pixels tall. The
  Overworld's hold (npcBodies.js holdNpcBodies, asked by world.js every
  frame the travel view is up, lapsing NPC_HOLD_MS after the last frame
  that asked) stands nobody: C3's law for every lane.
- H3. The dungeon's hosts draw the corpse flats before drawFoes marks them,
  so the flat minted under a body standing from the kill drew a frame, and
  one whose body left the cut was a frame unseen. The flat is minted
  cast-only where the body stands, and one whose body went this frame is
  drawn on the foes' pass after the sync. (A body ENTERING the cut over its
  corpse is drawn over its flat for that frame - NOT HERE.)
- H4. Two of the gate's host first seen falling were one body
  (`host:undefined`) - the placeholder carries its number.
- H5. The gate's boss and host bodies carry WB13d's hit flash, as foes do.

THE LANES (L).
- L1. MWNPC4's one build queue put a peer's body behind the street's whole
  cut - 24 builds at Near, 48 at All, 5 to 48 seconds for a body that took
  a build's time before. The gate keeps two lines (peerBodies.js
  createBuildGate / gateBuild): one build at a time, a player's (a peer's,
  the family's, the card table's) ahead of every NPC build still waiting;
  and a build that holds it past BODY_GATE_STALL_MS lets the next go.
- L2. A frozen frame (a talk window holds the street: its hosts pass dt 0)
  forgot every body's skin, so the frame it shut posed every body at once
  - 20 skins against Near's 8, 37 against All's 16. An NPC lane keeps the
  skin through it.
- L3. A living newcomer took a standing corpse's slot before a far body's
  (the party-mate branch tested `goneAt` alone) - B3's law, kept.
- L4. Section 16's exactness, amended there. L5: the probe's churn - its
  crowd only circled the eye in one look, so "24/48 rigs built" was its
  caps by construction. Its second table walks each actor in and out across
  the cut in a look of its own: rigs built a minute, each lane alone
  against the one budget - Near 48 against 46, All 26 against 62 (a budget
  smaller than the crowd sets its cut inside it, and the crowd crosses it;
  each built rig waits its turn on the low line, L1).

THE PROOF (P). P2: the GPU skin's GL had no test on a real Renderer - the
stream's attributes, the palette's texture and unit, a pose's upload, a
moved part's re-stream and the release are recorded now. P4: section 21's
D3 pinned a living elite alone, whose sprite size and giant's are one
number - the wild giant and the dead, each pinned. P5: section 22's
"equivalent" record was not (a fitted cloak). P6: stale numbers and claims
corrected - Testing.md's MWNPC4 count (39), the merge row's duplicate,
section 22's "59 dead", section 15a's Imp, law 6's pause card, the
setting's note ("foes first", "the closest dozen"). P7: two assertions
that compared a value with itself, and a `every` over a list that could be
empty. P8: the patch notes say what is so - the third-person bodies are
GPU-skinned (the first-person arm and the inventory portrait are not, and
a body past eight influences a vertex falls back), and the steel is the
street guards' and the rosters' watch (the city watch wears what it
rolled).

THE WIRE. `ls` and `lw` change wire.js, so the relay's bundle: RELAY_VERSION
world190 (world188, then world189, on the branch, renumbered past main's
INT11-INT14 world188 and SCALE5a world189 at the merges - either may deploy
first). The relay forwards foe frames unread; no frame changes shape.

PROVEN. `test/characters/mwnpc_audit2.test.js` (17) - each finding executed where it
can be (the encounter pool's own puppet path for K2 and K4, a recording
GL on a real Renderer for P2, Chromium-free), by source where only a host
holds it. `tools/mutants/auditmwnpc2.json`: 53 mutants, 52 dead and one
equivalent as recorded (K1's uniform flag: census dresses every watchman on
duty in the guard's texture, which folkLookOf reads as the uniform). Pins
moved where a law moved: MWNPC6a and section 21's C5 (the seed minted
once), D2 (the Seducer's look flies), MWNPC7d (a beggar's flat), WORLD6b's
first record (`ls`), WORLD2's room record and PSCALE-OWN's own lane
(`seeded`), PEER-CADENCE C7 (the frozen frame), and the dungeon harnesses'
scopes; twenty-eight older records re-aimed by content.

## 24. MWNPC16 - THE BODY'S OWN SHADOW (SHIPPED 2026-10-11)

Mac, of a player's screenshot (Perryick Copperston in Morrowind's steel, in a
house, the classic sprite's silhouette thrown on the wall behind him): "With
morrowind assets attached. Old sprite shadows still show."

THE CAUSE. Two laws written to keep the frame cheap met in the shadow maps.
MWNPC1 turned a GPU-skinned body away at the shadow pass's door
(`render/shadowPass.js` recordCharacter): the pass drew a rig through
CHAR_VS, which has no skin, so a body would have cast its bind pose. And
MWNPC5b kept each NPC's classic billboard in the pass with `castOnly` to cast
for it - drawn nowhere, its shadow everywhere. So every NPC in a body cast the
Daggerfall picture's outline, turned to the lamp, in the wrong clothes and the
wrong pose. (The player's and the peers' bodies cast nothing at all, and
still do - below.)

- THE SKINNED DEPTH PROGRAM. The pass takes the world's own skinned vertex
  shader (`opts.vs.charSkin`, renderer.js CHAR_SKIN_VS) over its plain depth
  shader, and over the flats' half-alpha cut for a cut-out range; built the
  first frame a body casts, in the pass's own GL time (`_ensureBodyPrograms`,
  before any replay binds its own program - never at a record, inside the
  world pass, where a useProgram would go behind the renderer's back). A
  skinned record replays off its own palette on SKIN_PALETTE_UNIT, bound
  through the renderer's door (`holdSkin` -> renderer.js `_holdSkin`, which
  keeps `_skinUnitHolds` true and forgets the unit selector first: the pass
  selects its units raw). A body let go since its record casts nothing: its
  palette deleted (`skin.tex` null), or its mesh marked `_dead` by the rig's
  release (fpArm.js releaseGpu).
- THE POSE IS THE ONE IT WAS DRAWN IN. The replay is the next frame's first
  work (EL2), before any lane poses again, so the palette on the texture is
  the pose its record was drawn in. (Its picture this frame is the next pose:
  a limb moving away from the light by more than the bias in one frame
  darkens its trailing edge for that frame - NOT HERE, the same frame-old
  caster list EL2 states for everything.)
- A RUN OF RANGES IS ONE DEPTH DRAW. A body is a range a piece - head, hair,
  cuirass, gauntlets, boots - laid end to end, and a depth draw binds nothing
  between two of them (PERF-EXT2's law for a static batch): a hidden range (a
  sheathed blade, an unlit torch, rule 57) breaks the run; a range with a
  cut-out picture (`alphaCut`, hair) is its own draw through its picture's
  cut. A body is one depth draw a run between its hidden and cut-out ranges
  (a sheathed blade and a head of hair: four), not one a piece. (AMENDED BY
  THE AUDIT, section 27 E6: this said "one to three".)
- THE BODY ASKS IT (`combat/fpArm.js`). `drawThird`'s `cast` records the body
  for the maps alone (`renderer.recordShadowBody`: its mesh, its world model -
  `thirdModel`, the draw's own - and a sphere about its posed box, `thirdBox`,
  which the replays cull by), never a veiled body's (a concealed foe and a
  ghost cast nothing, as their flats never did). `castThird` records a body
  OUT OF THE VIEW where it stands, in the pose its skin last took, where its
  sphere reaches a map this frame draws (`renderer.shadowReachSphere`) -
  SHADOW-REACH's law, which an NPC's flat had (world.js's castBatches).
  (AMENDED BY THE AUDIT, section 27: only a body posed for who it stands for
  now - B F2; asked first about its feet - N3; a body that never walks says
  so, for the lo tier's lamps - A3; a lamp whose movers are bodies that did
  not change keeps its faces - A2.)
- THE LANE ASKS IT OF AN NPC'S BODY (`net/peer/peerBodies.js` `casts`, set by
  `characters/npcBodies.js` for every NPC lane): seen, drawn casting; unseen,
  cast where it stands; veiled, neither; grown by the travel view (OW-BIG),
  neither - but MWNPC10's larger body (the gate's boss) casts at its size.
  The peers', the family's and the card table's lanes cast none, as before:
  their dolls never cast either.
- THE FLAT UNDER A BODY CASTS NOTHING. `castOnly` is no longer "cast only":
  the replay, the movers' test (`_dynamicNear`) and both cache signatures
  pass a cast-only flat over as they pass a `noShadow` one - so a lamp is not
  redrawn for a picture nobody sees, and its static cache never counts one.
  (A flat whose body has not stood - out of the cap, past the range, still
  building, refused - is no cast-only flat: it draws and casts as ever.)

THE FOUR HOSTS (rule 17e). The seam is the lanes', so every host's NPC lanes
cast: scenes/world.js, scenes/worldModes.js, scenes/dungeonContext.js and
scenes/exterior.js WIRED, through their createPopulationLane /
createHostNpcBodies lanes (every NPC lane is a casting one).

NOT HERE. The player's own Morrowind body and the peers' cast no shadow - a
self body's lamps have DISC24-C's cadence law to meet first (a frame-late
silhouette trails the player), and this report is the NPCs'. Nor do the
household family's and the card table's bodies (their lanes are PeerBodies
without `casts`, as their dolls cast nothing). The first-person arm casts
none.

PROVEN. `test/render/mwnpc16_bodyshadow.test.js` (6): the pass on a recording GL - a
skinned body recorded, under its sphere, through the skinned depth program off
its palette, the runs one draw, a hidden range a break, the hair its own cut,
the programs built once and their samplers on their units; a body let go
casting nothing, one off the cascade culled, a packed rig through CHAR_VS; a
cast-only flat neither drawn into a map nor a mover; the rig on the fixture
body (`test/fixtures/mw/bodyRig.mjs`) recording its mesh, model and sphere only
when asked, never veiled, castThird the same place and only in reach; PeerBodies
asking the cast of a casting lane's seen, unseen, veiled and grown bodies and
never of the peers', every NPC lane casting; the renderer's door by source.
`tools/mutants/mwnpc16.json`: 18 mutants, 18 dead (51 after the audit,
section 27). Pins moved: EL2's and
LA-COST3's shadow-pass construction, MWNPC1g's and MWNPC1h's door (the sprite
target still records nothing - drawCharacter's gate, now the law MWNPC1's
record aims at), EOTB-BODY's noShadow line, OW-PEERS' cull, PR-BOW1 and
PR-BOW1b's drawThird; mutant records re-aimed by content (bugs5's four, WEEDS1,
EL3, EL7, MWNPC1, MWNPC5, MWNPC10a, OW-PEERS, OW3-J6, WB9h, PERF-EXT11).

## 25. MWNPC17 - THE WARDROBE (SHIPPED 2026-10-11)

Mac: "We also need to hone in on what NPCs get what type of clothing/armor.
General NPCs should have a procedural system where barely any 2 NPCs look
alike."

WHAT IT WAS. A walker wore one of four outfits per sprite (FOLK_OUTFITS), a
standing person one per faction (PEOPLE_WARDROBE), a knightly order's and a
fighters' guild's people the same steel - and the item map resolved a
garment by its Morrowind TYPE and its dye alone (`formats/morrowind/mwItemMap.js`
mwClothingRecord: a Short Shirt, a Long Shirt and a Tunic are one Morrowind
shirt), the head and hair by the face index's ten. A street was ten shirts in
ten colours over ten faces.

- WHO WEARS WHAT (`characters/wardrobe.js` WARDROBE_ROLES). A person is dressed from a
  ROLE - the street's commoner, a tradesman, a traveller, a scholar, a
  merchant, a noble, a priest, a mage, the underworld (`rogue`), a fighter, a
  knight - each holding weighted SILHOUETTES (a top over breeches, a top over
  a skirt, a robe or a dress or a gown), each with its own Daggerfall garments
  (itemTemplates.json, the men's and the women's), its dyes, how often the
  lower half takes the top's dye, its odds of a cloak and of the formal one
  (the port's own cloak, MW-CLOAK1), and the martial roles their ARMOUR
  (ARMOR_KITS): a knight's whole plate of ONE metal by rank (iron or steel to
  dwemer, ebony and orcish), the helm now and then so his face shows; a
  fighter's pieces from more than one smith, a cuirass nearly always and the
  rest at their odds, the pauldrons a pair; a rogue's leathers. Imperial chain
  is a cuirass and greaves alone in Morrowind (mwItemMap.js's judgement rows),
  so a chain helm is never asked for - iron stands in. The kit's boots are the
  feet (one Daggerfall slot); a robe hides the legs (nothing is put under it).
  BARE-BOOTS (`01-Overview/bugs/Field-Bugs-2026-10-15c.md`, "No boots model on
  legendary boots"): the player's own pieces and a peer's had no such rule -
  a chain piece imperial chain lacks answered "the classic sprite stands", on
  a figure with no sprite, so chain boots, gauntlets and pauldrons stood bare
  skin (one boot in five is chain off DFU's RandomArmorMaterial; the
  Legendary in the report was innocent). `mwItemMap.js` gives Chain iron as
  its chain's second token now, the wardrobe's own stand-in, and walks a
  material's chain by PIECE (Adamantium's Tribunal set, no boots, then
  ebony). Pinned in `test/systems/fb1015c_bareboots.test.js`.
- WHO IS WHICH ROLE. A standing person by their faction (`peopleBodies.js`
  wardrobeOf, KIND_ROLE): the old `steel` split - a knightly order's and a
  court's guard `knight`, a fighters' guild's `fighter`; a coven's witch and a
  necromancer `mage` (where FACTION.TXT does not count their faction
  supernatural - wardrobeOf turns those away first; section 27's NOT HERE);
  the Dark Brotherhood the underworld's. A walker by the
  outfit their sprite shows (`folkBodies.js` FOLK_DRESS: the commoner, the
  tradesman, the traveller and the robed scholar - and the CUT their picture
  shows, a robe, a skirt or breeches, so the body that replaces a picture at
  its range wears what the picture wore). (AMENDED BY MW-FOLK1, 2026-10-13: a
  walker whose picture has an outfit of the port's own - eleven of the
  twenty-four - wears that outfit and no garment of the wardrobe's, so a
  street of one such picture shows as many people as its race has faces -
  48 on a Nord's 387, 9 on a Breton's 385; "barely any two alike" holds
  on the thirteen pictures the wardrobe still dresses (MWNPC17e re-read on
  Nord women's 392, AUDIT MW-FOLK1 L3-F2);
  `04-Characters/Townsfolk-Outfits.md`.) A still picture by its kind
  (`rosterBodies.js` STILL_WARDROBE - a priest at the door in robes). The
  street's guard keeps the watch's uniform; foes and rosters keep their kit.
- HOW WELL. A wealth TIER per role, on Morrowind's own clothing ladder - the
  CLOT ids' prefixes, common_, expensive_, extravagant_, exquisite_
  (`mwItemMap.js` clothingTierOf): a noble from expensive up, a commoner
  common and one in twelve expensive - and every garment within its role's
  rungs (AMENDED BY THE AUDIT, section 27 C F1: a garment's stray could pass
  them).
- WHICH ONE. The look carries `npc` - its seed, its tier and its role's
  rungs `lo`..`hi` (`npcHint`; the rungs since the audit, section 27); a
  player's carries none, so the player and every peer resolve exactly as
  before. The build reads it (`net/peer/peerBodies.js` peerBuildOpts): each
  garment its rung (the person's, one down for a garment in four and up for
  one in eight, never past the role's rungs - `npcGarmentPick`) and its
  PICK, which mwClothingRecord takes among the CLOTH_PICK_NEAREST (3) nearest
  the dye's colour on that rung that lie within CLOTH_PICK_BAND of the
  nearest (the band since the audit, section 27 C F2) where colours are
  measured, else among the rung (a rung the data lacks: the
  nearest that has records, the lower first; a pool with no rung at all - a
  mod's ids - whole); and the HEAD and the HAIR walked each on its own off the
  seed (`npcFaceOf` -> fpArm.js buildFpArm `npcFace` -> formats/morrowind/mwFirstPerson.js
  playerBodyRows `walk`), so a race's heads times its hairs are reached where
  the face index named one pair of ten - and no portrait is measured for a
  person who has none (the build's face match is skipped). Two people in one
  outfit are two bodies (`npcKeyOf` in peerBodyKey).
- FOES AND ROSTERS keep what they wear (their equip tables, DFU's rolls) and
  gain the hint (`npcHint(seed, 0)`), so the man under the kit is his own -
  head, hair, the records of the clothes under it - off the seed every
  machine shares (K3/K4's), so a copy is the same man.

MEASURED: one race, one sex, one role, resolved as the build resolves them
over a retail-shaped clothing set (each type on every rung, measured
colours) and a race's 8 heads and 6 hairs - commoners 987 distinct of 1,000,
merchants 997, nobles 999, priests 966 (the robed cut is one garment);
without the hint, 692, 577, 818 and 294. (AMENDED BY THE AUDIT, section 27
E5: those baselines were taken with unsalted seeds and no cut, not 17e's
harness as this said; measured again on the audited tree by the method
stated there.)

THE FOUR HOSTS (rule 17e). The looks are the populations' adapters, read by
every host: scenes/world.js, scenes/worldModes.js, scenes/dungeonContext.js
and scenes/exterior.js WIRED through folkBodies, peopleBodies, rosterBodies
and foeBodies as before.

NOT HERE. A noble's sprite shows one cut and their body may wear another
where the role has both (a gown and a blouse and skirt): only the walkers'
and the priests' pictures name their cut. Faces beyond a race's own BODY
records (Morrowind's NPC heads are what the data carries) - but the port's
own (AMENDED BY MW-HEADS1, 2026-10-13: the Breton men's three heads and three
hairs stand in place of the data's, and the walk reaches their nine pairs;
AMENDED AGAIN BY MW-HEADS2, 2026-10-15 - the owner: "only the player Britons
should recieve the new heads, not npcs": an NPC's walk is the data's again, the
port's own a player's alone; `04-Characters/Own-Heads.md`).

PROVEN. `test/characters/mwnpc17_wardrobe.test.js` (5): every role and sex dressed by its
own table over hundreds of seeds - pure, its garments and dyes, one top or
robe, legs exactly when not robed, one pair on the feet, a rung its own, the
cut a sprite shows honoured or the nearest; who wears what - nobles never
common, commoners hardly past expensive, priests mostly robed, no armour off
the martial roles, a knight's whole plate of one metal of his rank's and four
or more metals across an order, a fighter's mismatched and no chain Morrowind
cannot draw, the pauldrons a pair, a rogue's leathers; the item map's rung,
fallback order, nearest-few pick, blind pick and a mod's ids, and the composer
handing both through; the build's hint - each garment's picks, the walk, a
player's and a wolf's none, the key, the hint read as data, a race's 48 pairs
reached; and the 200-person street (196 or more distinct). Pins moved: MWNPC7a,
MWNPC8a-1/-2, MWNPC8b-d (a coven's witch now a mage), MWNPC10c-2, MWNPC12-1 (a
knightly person's plate one metal of his rank), AUDIT MW-NPC II K1's priest,
MW-D27's thread (and `walk`). `tools/mutants/mwnpc17.json`: 16 mutants, 16
dead (39 after the audit, section 27); mutant records re-aimed by content: MWNPC7's three, MWNPC8a's seven,
MWNPC10c's, MWNPC12's, MWNPC14's three and MW-CROWD's.

## 26. MWNPC18 - THE FIGURES A PLAYER PLACED (SHIPPED 2026-10-11)

Mac, of the same report: "Player decorations are not affected."

DECOR-FIGURE lets a home's owner set one of Daggerfall's people down in a
room or a yard (`net/decorLaw.js` decorIsFigure - a flat in a person's
archive). Every room's own people stood in bodies; the placed ones kept their
pictures, because the census (section 21) looks for mobiles and a decor
figure is a flat - nothing named a decor room.

- A FIGURE, READ (`characters/peopleBodies.js` figureLook). It has no
  StaticNPC record - no faction, no flags - so what it is is read off its
  picture: its sex FLATS.CFG's gender column (formats/flatsFile.js
  flatGender, the censor mark read through), its role FLATS.CFG's caption
  (`figureRole` over FIGURE_ROLE_WORDS - a judgement, the first match in
  order: a "noble knight" is a knight; words it does not know the street's),
  its race the region's, its seed its piece's id - every visitor sees the
  same person, and a second copy of one picture is a second person. A child
  (StaticNPC's child pairs), the Daedra Princes' archive (TEXTURE.175 - Azura
  is no person in clothes) and a figure no row sexes keep their pictures.
  FLATS.CFG not read yet is asked again, never cached as a picture.
- OFFERED (`scenes/decor/decorRoom.js` figures, offerDecorFigures) on the host's
  people lane before its bodies draw, at its piece's base (the room's origin
  and its place in it - AMENDED BY THE AUDIT, section 27 D1: this read the
  batch's origin, which a room's batch never has), turned to the eye at a
  person's pace (personActor) - cast-only where a body stands, and since
  MWNPC16 casting nothing. The ROOMS': worldModes.js on the building's
  people lane (`figureCtx`: FLATS.CFG and the race of the building's region,
  REGION_RACES - section 27 D2: the quest context it asked names none - read
  only when a figure is first looked at). The YARDS': world.js on the
  street's people lane, through homeYards.js `figures` (`yardFigureCtx`).
  The piece being placed is the decorator's preview and stays a picture.
- THE CENSUS'S BLIND SPOT, CLOSED: every source that stands a decor room is
  enumerated (`test/scenes/mwnpc18_decorfigures.test.js` 18d) - homeYards.js and
  worldModes.js - and each must offer its figures before its people draw.
  (AMENDED BY THE AUDIT, section 27 D5: for the decor rooms; Come Sail Away's
  crews were a second blind spot, now declared, and 18e sweeps every host
  that draws one of Daggerfall's people.)

THE FOUR HOSTS (rule 17e). scenes/worldModes.js WIRED (the rooms) and
scenes/world.js WIRED (the yards); scenes/exterior.js FLAGGED by name - the
single-town bench stands no home and no yard; scenes/dungeonContext.js
FLAGGED by name - a dungeon has no decor room.

PROVEN. `test/scenes/mwnpc18_decorfigures.test.js` (4): figureLook's sex, role, race
(by name and by id), seed, its pictures kept and its file asked again; the
caption's roles in order; the offer and the drawn picture where no look
stands; the decor rooms' hosts enumerated and wired before their draws, by
source. `tools/mutants/mwnpc18.json`: 10 mutants, 10 dead (29 after the
audit, section 27). The yards'
figures are offered before the yards' keepers, so AUDIT MW-NPC II P1's pin
(the keepers' offer just before the street's draw) stands as it was.

THE RECORDS, RE-JUDGED (the three slices together). Every older mutant record
re-aimed by content (30) and every record an edited test file is a killer of
(412 in all) was judged again on the slices' tree (`tools/mutate.mjs --jobs
4`): 408 dead, 3 equivalent as recorded (AUDIT MW-NPC II K1's uniform flag,
PERF-EXT11's belt and braces, PR-BOW1b's portrait depth), and one survivor -
MWNPC10c's still picture on the roads (`{ still: false }`), which this
slice's own rewrite of its pin let through (a walker's outfit can be one a
noble's garments and dyes allow): the pin now holds the courtier at home to
the still look exactly, never the street outfit, and the record dies.

## 27. THE AUDIT OF MWNPC16-18 (2026-10-11)

Mac, of the pull request: "Audit this". Five cold lenses over the three
slices at 6e1091be - the shadow pass and the GL (A), the rig and the lanes
(B), the wardrobe (C), the placed figures (D) and the proof (E: the tests,
the records, this page and the patch notes) - each finding refuted by its
finder before it was reported, reproduced here before it was fixed, and
pinned by a record that dies.

THE FIGURES (D).
- D1, THE BLOCKER. offerDecorFigures stood a figure's body at its batch's
  origin, and a room's batch is minted with none (createBillboardBatch: its
  base in its vertices). With bodies on, every frame a placed figure stood
  threw a TypeError out of the host's frame (personActor reading null); and
  a yard's restand() writes only the recentre's step into an origin, so its
  body stood a whole recentre off. 18c's fixture had handed the batch an
  origin no room mints. The body stands at its piece's base now - the
  room's origin and its place in it (`e.o` plus `piece.pos`, put's own sum),
  made again every frame as the street's people's are. 18c runs through a
  real createDecorRoom whose batches have no origin, across a restand and a
  lane that moved the feet it holds.
- D2. A room's figure was always a Breton: `figureCtx` asked the quest
  scene's context for its region's race, and that context is { mapId,
  locationIndex }. It reads the building's region now (REGION_RACES, as the
  yards' read does).
- D3. The caption's words matched inside other words: "good-looking" and
  "walking" held a king, "country" a count, "overseer" a seer, "image" a
  mage, "relaxed" an axe, "monkey" a monk. Each word is read from its start
  and a short one whole; a guard and a smith are still read inside a word (a
  bodyguard, a blacksmith).
- D4. figures() walked every piece of every yard, every frame, into new
  arrays, to find the few that are people. A room keeps its figures as they
  are put and taken down, into one list; the yards into one.
- D5. Come Sail Away's crews (her prefabs' BillboardHelper people, drawn by
  `scenes/comeSailAway/comeSailAwayPool.js`) stood in no body and nothing said so, under
  section 26's "blind spot, closed". They keep their pictures (NOT HERE,
  below), and 18e sweeps every host that draws one of Daggerfall's people:
  each offers them to a people lane, or is named with the reason it keeps
  the picture.

THE SHADOW (A, B).
- A1 / B F3. A CPU-skinned body's hair (`?gpuskin=off`, or a layout the
  shader refused) cast as solid cards: the cut program was built only once
  a skinned body cast. A cut-out range asks for it too.
- A2. Every body record is a mover, so a lamp in reach of one redrew its six
  dynamic faces every frame - for a body out of the view, never posed, ten
  face operations a frame where its flat had cost none. Each body's record
  now carries its LOOK: its mesh, its pose's generation (`_poseGen`, bumped
  by the renderer at every pose upload - updateSkinPalette, updateSkinStream,
  updateCharacterMesh), its matrix and its hidden ranges. A lamp whose only
  movers are bodies (`DYN_BODY`) keeps its live faces while their looks are
  the ones it drew, and draws again when one is posed, turned, hides a
  range, comes or goes, or a mover stands beside them (a swaying wood
  beside a body makes it a mover's cadence, as a body always had). A body
  in the view
  idles, so it is posed and redrawn every frame, as the idling flat it
  replaces was (IDLER-STICKY). It is never baked into a static cache: a body
  comes into the view and leaves it as the camera turns, and IDLER-STICKY's
  churn is the reason. A voxel rig (EL7) is the mover it always was.
- A3 / B F1. Past the twelve full maps, a room drawn whole casts from its lo
  maps (DISC15), which take the still and a flat animating in place
  (DISC29-E). A body is a mover and its flat now casts nothing, so a
  standing person cast into none of them (DISC29-E's Mages Guild: nine
  people in a hall of lamps past the twelve). A body that NEVER WALKS is now taken by the lo replay and
  folded into the lo signature by its id and its place: a new pose is no
  rebuild (the lo map holds the pose it was drawn in, as it holds an idler's
  frame), while its coming, its going and a move are. "Never walks" is
  DISC29-E's own test - its flat has no origin and is not moved by its
  vertices - read by the population lane at its offer (createPopulationLane,
  `anchored`).
- B F2. An unseen body cast whatever its skin last held. A spare taken out
  of the view wears the last wearer's skin (a corpse's for a living skeleton
  - every creature of a kind shares a key), and a death out of the view is
  not posed. An unseen body now casts only once posed for who it stands for
  (`posedAt`: 0 for a spare until it is posed, and again when a life flips).
- N2. A body program that would not link threw out of render(), skipping the
  frame's discard and its viewport. It is null now, and the replay's null
  tests cast nothing for it.
- N3. castThird made a matrix and a middle for every body out of the view
  before asking whether it reached a map. It asks first of a sphere about
  its feet that holds the box's own wherever it turns.
- B N1. thirdModel's doc comment sat over thirdUnit.
- NOT TAKEN.
  - N1: the cut programs use the flats' half-alpha, where the lit draw cuts
    at the range's own threshold. DEPTH_BB_FS is the flats' shader, and a
    uniform there is every flat's; the difference is the shadow of hair
    whose threshold is far from a half.
  - N3's other two: a cut range's extra program binds, and the caster
    pre-passes walking cast-only flats that every replay then drops. Left.

THE WARDROBE (C).
- F1. A garment strayed a rung from its wearer's, past the role's own. A
  noble's top fell to the common rung about one time in eleven (one
  nobleman in five wore a common garment), and a commoner's rose to
  extravagant about one time in a hundred - under the header's "never". The
  hint carries the role's rungs (`lo`, `hi`: the tiers its table ever
  draws), and the stray stops at them; npcKeyOf and npcHintOf read them.
- F2. On a thin rung the dye was ignored. Retail's extravagant and exquisite
  rungs hold one to three records of a type, so "the three nearest" were the
  whole rung, and a red dye drew a blue shirt as often as a red one. The
  pick is now among the three nearest that lie within CLOTH_PICK_BAND of the
  nearest (1.5 times its distance, plus 32).
- F3. The comment's template ranges were wrong; they are now the men's
  141-181 and the women's 182-216.
- F4. The body key added the hint after the memo: a new string per body per
  wanting peer every frame. The hint is in the memo now.
- THE BEASTS (older than these slices; exposure up with the knights' and
  fighters' helms). No Khajiit or Argonian NPC wears shoes, boots or a helm
  now. wardrobe.js beastWorn drops them from an NPC's worn list in the build
  (peerBuildOpts), which covers every producer's look: the wardrobe's, the
  watch's plate and a foe's own table. A player's look is never asked.

THE PROOF (E).
- E1 was D1.
- E2: the body programs were built by hand in the tests; 16a and 16b now run
  render().
- E3: the hint on foes, rosters, the watch and residents is pinned (17f).
- E4: the patch note said everyone in a body casts; it now names who does.
- E5: section 25's baselines came from another harness than it said.
- E6: "one to three depth draws" was wrong (16a's own fixture is four).
- E7:
  - Titles brought into step (MWNPC1h, MWNPC12-1, 17e).
  - 17d pins exactly 48 pairs.
  - MWNPC17-boots-and-shoes (MWNPC8a-shoes-over-boots a second time) is
    gone.
  - The rig's `_dead` mark and the palette door's selector reset are driven,
    not read.

MEASURED AGAIN with 17e's harness at 1,000: its clothing set and colours, a
Breton man's 8 heads and 6 hairs, `seeds(1000, 77)`, and each role's own
weighted cut.

| | commoners | merchants | nobles | priests |
|---|---|---|---|---|
| distinct | 988 | 993 | 996 | 960 |
| without the hint | 679 | 583 | 796 | 298 |

Section 25's 987/997/999/966 were measured before F1 and F2.

THE FOUR HOSTS (rule 17e).
- The figures' fix and the race read are worldModes.js's and world.js's
  (WIRED; the yards' race read unchanged).
- The anchored word and the body's look ride every host's NPC lanes:
  scenes/world.js, scenes/worldModes.js, scenes/dungeonContext.js and
  scenes/exterior.js are WIRED through createPopulationLane.
- The lanes that call `stand` themselves (the dungeon's and the encounter
  pool's foes, the watch) pass no word: their people walk, and their bodies
  are the twelve's alone, as a flat an origin places is (E1's law,
  DISC29-E).

NOT HERE.
- Come Sail Away's crews keep their pictures: the vendored prefabs' people,
  drawn by the pool as the mod lays them, with no look a lane could read.
- Witches and necromancers dress as mages only where FACTION.TXT does not
  count their faction supernatural (wardrobeOf turns those away first).
  There is no FACTION.TXT here to say which.
- A body that walks casts into no lo map.

PROVEN.
- `test/render/mwnpc16_bodyshadow.test.js` (9):
  - 16a and 16b through render(), the CPU-skinned hair, a link that throws.
  - 16d the anchored word and the reach asked first.
  - 16f the door and the release driven.
  - 16g the held faces.
  - 16h the lo tier and the lane's word.
  - 16i the unseen pose.
- `test/characters/mwnpc17_wardrobe.test.js` (6): 17b every garment's rung, 17c the
  band, 17d the beasts and the memo, 17f every producer's hint.
- `test/scenes/mwnpc18_decorfigures.test.js` (5): 18c through a real room and its
  kept list, 18b the words read whole, 18d the race read, 18e the sweep.
- Pins moved: OW-PEERS' cull (the unseen branch says why it casts), PR-BOW1's
  and PR-BOW1b's drawThird (its `anchored`), MWNPC1h's and MWNPC12-1's
  titles; every record those files kill judged again (43: 42 dead, one
  equivalent as recorded).
- Mutant records: `tools/mutants/mwnpc16.json` 51 and `mwnpc17.json` 39,
  all dead; `mwnpc18.json` 29, 28 dead and one equivalent as recorded (the
  figures' set let go at a take-down: memory, which no pin sees) - the
  second look's (below) among them.

THE SECOND LOOK (R). Mac, of the same pull request: "Audit this. Ensure its
perfect". Four more cold lenses ran beside the five above, on the tree before
them (8fe9df7f): the shadow, the wardrobe, the figures and the proof. Every
finding was read against this audit's head (04cc40f7). Those already closed
here were dropped: D1-D4, A1-A3, C F1, E2 and E6, found again from cold. What
was left was reproduced, fixed and pinned.
- R1. A BODY BURNT AWAY CAST A WHOLE MAN'S SHADOW. The dissolve's law
  (systems/dissolve.js, AUDIT 2026-10-02): more gone than whole, a flat casts
  nothing (`noShadow`). A flat whose body stands is cast-only and casts
  nothing whatever its dissolve. The body is drawn dissolving off the flat's
  dissolve (foeBodies.js foeFx), and drawThird and castThird recorded its
  whole shape. So a foe burnt nine parts away (REVENANT-FATE), or a companion
  not yet through its portal (COMPANION-PORTAL), threw its whole silhouette
  where its picture cast none. The lane asks the dissolve now (net/peer/peerBodies.js
  `cast`), seen or not, under the flat's own threshold: one home,
  `DISSOLVE_SHADOWLESS` and `dissolveShadowless`, which setBatchDissolve
  reads too.
- R2. PINS THAT COULD NOT FAIL. Each mutation below survived every test
  that claims its law. Each is a record now, and dead:
  - the cut program's matrix unset (a body's hair cast under the last
    body's matrix);
  - the body programs built every frame (three programs a frame, never
    freed);
  - the cut program's palette sampler unset (the hair skinned off unit 0,
    its own picture);
  - a rogue unarmoured (the leather law held for a rogue in none);
  - the temple door's priest unrobed (a priest's table draws a robe about six
    times in seven, and the one seed asked drew one anyway);
  - any two neighbouring rows of the caption's roles turned (only a knight
    before a noble was asked);
  - a row read in one case;
  - either host's figure context reading no FLATS.CFG (every figure its
    picture for good).
- R3. THE CLAIMS READ BACK AGAINST THEMSELVES. The proof lens's own campaign
  (26 one-line mutations over the slices) found more that survived, and 15
  of them survived this audit's head too:
  - STATIC-WHO's log's cast-only door, and beside it, found in following it,
    the static signature's own. With the signature's door gone, a person's
    still flat stays in a lamp's static set when their body stands, so the
    cache keeps the sprite's shadow baked in: the very report this arc began
    from. 16c only counted the doors in the source; 16k asks the signature
    and the log.
  - A body larger by its own scale (MWNPC10's boss): the cast was keyed to
    the wrong grow, the unseen cast was at a man's size, and castThird was
    ungrown.
  - Eleven of the wardrobe's judgements, each of which the pins read back
    from the same table: the underworld a rogue, a scholar a scholar, a
    tradesman's sprite a tradesman's, the dark dyes, the knights' top rank
    in dwarven, orcish and ebony, a merchant's station, the formal cloak,
    the helm's odds, the lower half's match, a garment's stray, and the
    record's pick.
  17g pins them against literals: the role maps as judged, the four dark
  dyes, the metals by rank, and the shares within bands about the tables'
  own odds over 3,000 seeds. Each is a record now, and dead.
- NOT TAKEN. A knight's Silver and Elven plate are drawn as Morrowind's steel
  (mwItemMap.js's map, older than these slices). As drawn, the knights wear
  five metals, not seven (steel about seven in ten), which the patch note's
  "iron and steel up to dwarven, orcish and ebony" still describes. The
  weights stand: they are Daggerfall's materials, and a body draws the map's
  answer for them.
- THE MERGE OF MAIN (#796, YARD-RANGE). A yard's flats are now drawn only
  within the yard's reach, the distance the player sets (homeYards.js
  `nearEye`). Its figures are offered only there too: a body never stands
  where its picture would not be drawn. 18d pins it, by source, and a record
  dies on it.
- THE FOUR HOSTS (rule 17e). The lane's dissolve read is net/peer/peerBodies.js's,
  under every host's NPC lanes. scenes/world.js, scenes/worldModes.js,
  scenes/dungeonContext.js and scenes/exterior.js are WIRED through
  createPopulationLane and createHostNpcBodies.
- PROVEN. `test/render/mwnpc16_bodyshadow.test.js` 16j (the dissolve, seen and
  unseen, off setBatchDissolve's own field), 16a (the cut's palette, built
  once, each hair under its own matrix), 16k (the signature) and 16d/16e
  (the boss's size); `test/characters/mwnpc17_wardrobe.test.js` 17b (the rogue, and 400
  priests at the door) and 17g (the claims against literals); and
  `test/scenes/mwnpc18_decorfigures.test.js` 18b (the rows' order and case) and 18d
  (both contexts' FLATS.CFG). Records: 10 in `mwnpc16.json`, 13 in
  `mwnpc17.json`, 13 in `mwnpc18.json`. Five older records were re-aimed by
  content to the same laws (MWNPC16-grown-cast, MWNPC16-veiled-cast,
  OW-PEERS-a-body-unleaned, MWNPC5-lane-drops-fxof and
  AUDIT-E5-a-burnt-body-s-shadow). Pins moved: PR-BOW1's and PR-BOW1b's
  drawThird call (its tells read once a body, a line above). Every record a
  changed test file or a re-aimed site names was judged again: 136, 134 dead
  and two equivalent as recorded; after R3, the 90 that the shadow's and the
  wardrobe's test files name, all dead.

## 28. MWNPC19 - THE FLATS THAT STAND (STAND-FLAT, STAND-HORSE; SHIPPED 2026-10-12)

The owner, 2026-10-12: "Some models arent affected when morrowind is
attached, like static NPCs, static horses, etc".

THE CENSUS. Every file that batches a billboard is already named by
`test/scenes/nudedecor.test.js`, a person host or not. Read against the lanes,
these still drew a person or a horse as a sprite with Morrowind data
attached:

- A PERSON'S FLAT NO StaticNPC HOLDS. RMBLayout stands a StaticNPC only on
  a flat with a non-zero FactionID (`characters/exteriorNpcs.js`
  collectExteriorNpcs). Any other flat of a person's archive
  (RDBLayout.NPCFlatArchives, `world/npcFlatArchives.js`) was scenery, in
  the shared groups: a block's factionless figure, World of Daggerfall's
  people (184.22 and 184.18 on the Betony and Poor docks), and the
  captive, merchant or prisoner a WoD marker stands (357.6, 182.0, 184.31 -
  `world/worldOfDaggerfall/wodSpawner.js`). A batch shared by a group cannot give one
  person's place to a body.
- A BOAT'S CREW. Come Sail Away's prefabs carry their people as
  billboards (`BillboardHelper-182_*`), the sea's ships' and the
  player's boats' alike (`scenes/comeSailAway/comeSailAwayPool.js` syncFlats).
- THE STANDING HORSES. COATS3D gave the 3D horse to every horse that moves
  (`06-Systems/Horse-Coats.md`): the rider's, the peers', the pool's, the
  road's teams. The ones that only stand kept their sprites: Daggerfall's
  own town horses (TEXTURE.201 records 0 and 1, a block's flats and WoD's
  bandit camps and forts, 12 placements), and the Stable's three
  (`scenes/merchantYardsHost.js`).

WHAT LANDS.

- ONE RECORD (`world/standFlats.js`). `isStandFlat` - a town horse
  (`world/standingHorses.js` isStandingHorseFlat: TEXTURE.201 by the
  records AddAnimalAudioSource's table names a horse,
  `systems/soundClips.js` ANIMAL_SOUND_BY_RECORD) or any flat of a
  person's archive the StaticNPC pass has not taken. `standFlatRecord`
  makes what a host keeps: a horse's heading and idle seed off its id, its
  look the road's strangers' law (`strangerHorseLook`); a person's piece,
  their BORN flat, for figureLook. Both exterior hosts mint it here (THE
  ONE CONSTRUCTION SEAM).
- A BATCH EACH. world.js takes these flats out of the block's groups and
  out of a WoD site's (unscaled) groups, and stands each in a batch of its
  own in the pixel's list. The batch carries the pixel's cull, the far
  rings' rule, its animation and its teardown. A person's picture is the
  clothed stand-in under NUDE-FLATS. A marker's person joins the pixel's
  list when the marker stands them. exterior.js does the same for its one
  location. Neither was cover: 201 is NOT_COVER's, and a person never is
  (AUDIT TACT B3). A factionless figure that used to group was cover, and
  is not now.
- THE PEOPLE. In the near rings each person is offered on the street's
  'people' lane, read as a placed figure is (MWNPC18's figureLook:
  FLATS.CFG's sex and caption, the region's race, the seed their place).
  Their billboard is cast-only while a body stands. A boat's crew is the
  same, at the flat's base on her deck: `people(fn)` walks every flat of a
  person's archive in her walk, named by her deed's uid (or her hull) and
  their place in it, so a boat's crew is the same people on every machine.
  A concealed owner's crew keeps the veiled flats. Indoors their flats are
  drawn again, since they stand where a boat does through extraBillboards.
- THE HORSES (`world/standingHorses.js`). One manager a host: `begin`
  with the lane's rig (`mwViewHorseRig`, none under the travel view),
  `offer` each, `end` stands the nearest STANDING_HORSES_MAX (8) within
  STANDING_HORSE_RANGE (60 m), one already standing held by
  STANDING_HORSE_HOLD (1.15). It steps only the ones in view, still (speed
  0, the bake's idle), at its billboard's base, and its billboard is
  cast-only. `draw` opens a character-sprite bind of its own (none for
  none, flushed whatever throws), after the people's and before the
  flats. A horse no longer offered, out of the cut or
  under a new rig is let go through the rig that made it (AUDIT COATS3D
  A7), and its billboard is drawn again. The Stable's horses are offered
  where they stand and the way they face, in the bay their sprite is drawn
  in. Their place is worked out whether or not Horse Cart and Cargo's
  pictures are up.
- THE FRAME'S BYTECODE (PERF-V8, `test/scenes/perfv8.test.js`). The world host's
  frame stood 187 bytes under three quarters of V8's ceiling. The crews'
  offer and the horses' end are host functions the frame calls
  (`offerCrews`, `standingHorsesFrame`), and the look's step before the
  motor (`if (!gamePaused()) {` - the look filter, the keyboard look, the
  lock-on) moved into a closure of its own, `frameLook`, as PERF-V8's are:
  45,893 bytes before this slice, 44,976 after.

NOT HERE, AND WHY.

- TEXTURE.201's other animals (the cows, pigs, cats and dogs, and the rest)
  keep their sprites: Morrowind has none of them.
- A child, a vampire's people, a Daedra Prince (TEXTURE.175) and a flat
  FLATS.CFG names no sex for keep their sprites (figureLook, sections 13a
  and 26). The arena crowd stays flats (section 4).
- The town watch's carried team (`scenes/wagon/wagonWardenShow.js`) stays
  FLAGGED (COATS3D: a throw of a few seconds).
- THE RANGE IS THE LANE'S. A standing person stands in a body only inside
  the tier's range: 30 m at Near (the default) and 60 m at All, the
  nearest across every lane's frame budget (section 16). Past it, or past
  the near rings, Daggerfall's sprite stands, as for the walkers.
- THE FOUR HOSTS. scenes/world.js and scenes/exterior.js are WIRED.
  scenes/worldModes.js (a building) stands every person as a StaticNPC
  (`interiorContext.js`, section 13a) and no horse. scenes/dungeonContext.js
  stands every flat of a person's archive as a StaticNPC (RDBLayout's
  AddFlat, section 13b), and a dungeon's TEXTURE.201 animal, if a level
  places one, keeps its sprite (FLAGGED).

PROVEN. `test/world/standflats.test.js` (8): which flat is a horse, and which
stands for a body; the cut, the range, the billboard hidden, and off the
lane; the hold; the let-go (not offered, a new rig, the street left) and
the unseen horse not posed; the one record and a person read as a figure;
the Stable's horses offered without their pictures; and both hosts and the
boats by source. `tools/mutants/standflats.json`: 18 mutants, 18 dead. Pins
moved: MWNPC8c's two exterior.js records re-aimed by content (the group's
`else if`, the stale cast-only before this slice's block), both dead;
DISC20-C's distance from the entry to its ground call (10200 -> 10400, the
`standFlats` line); PERF-V8's closures (`frameLook`, first).

## 29. FB1015 - THE BODY UNDER A WINDOW, AND WHERE ITS TEXELS STAND (2026-10-15)

The owner: "When looting dead marrowind enemies, they turn to a sprite. The models also clip through geometry."
Record of the batch: `01-Overview/bugs/Field-Bugs-2026-10-15b.md`.

- LOOT-BODY. Both dungeon hosts (scenes/worldModes.js's dungeon arm, scenes/dungeon.js) draw the level's flats under a
  window and return before drawFoes - the only place a foe's body was drawn - and AUDIT MW-NPC C6 (section 21) showed
  every corpse flat there so a dead person was drawn somewhere. The loot window is such a window: opened on a body, it
  stood that body's classic corpse in its place for as long as it was open. The lane's bodies stand as its last sync
  left them - no sync runs under a window, so none lingers and none steps - so the window's frame now draws them,
  frozen, before the flats (`characters/foeBodies.js` drawBodiesUnderWindow, through the context's
  `drawWindowBodies`), and marks each corpse flat cast-only where its body stands; a corpse with no body standing (past
  the cut, still building, the lane off) keeps its flat, C6's law. The living foes' bodies are drawn with them, as the
  people's lane already is under a window (drawPeople); a living foe with no body stays undrawn under a window, as
  before (its billboard is drawFoes'). THE FOUR HOSTS: scenes/dungeonContext.js is the door; scenes/worldModes.js (its
  dungeon arm) and scenes/dungeon.js are wired; scenes/world.js and scenes/exterior.js draw their pools under a window
  already (WINFOE1), as does worldModes.js's interior arm - none changed.
- BODY-DEPTH. Every body is a picture taken into the sprite target and composited as one quad (MWNPC2), and the quad
  was depth-tested as itself: a flat card through the body's middle, square to the eye's ray (BODY-LEAN). A corpse lying
  toward the eye had its near half behind the floor's depth at that card and was cut off by the floor; a body at a wall
  was cut where the card crossed the wall, whatever the body did there. The picture is an ortho down the ray from
  `reach` behind the box's centre, so a texel's depth d stands `near + d (far - near)` along the ray; the sprite
  target's depth is a texture now (it was a renderbuffer), and the quad writes each texel's own depth - its point moved
  along the ray by `near + d (far - near) - base` off the quad (`render/characterSprite.js` pictureDepth, renderer.js
  drawCharacterSpriteQuad `depth`); an outline texel takes its nearest silhouette texel's, an ember the quad's own. The
  depth texture stands on unit 1 for the quad and is let go before the target is drawn into again (`_charSpriteRT`), so
  no program ever samples the texture its own framebuffer writes. A
  card of its own vertical - the travel view's lean (AUDIT OW4 J6), the Billboard Look (BODY-CARD) - keeps the quad's
  depth: it is not square to the ray, and the Billboard Look is the flat card on purpose. Every body through the one
  pass takes it: the foes', the people's, the watch's, the peers', the player's own third-person body, the voxel rigs.
  Ground-truthed in a real WebGL2 context (SwiftShader): the program links, the target's framebuffer is complete with
  the depth texture, and a texel passes and fails the frame's depth test within 0.0005 of the depth pictureDepth names
  - and at the card's depth with none.

PROVEN. `test/render/fb1015_lootbody.test.js` (7): the window's frame draws both a living and a dead body however long it stays
open (past BODY_LINGER_MS), steps none, marks a standing body's corpse flat and shows one with none; no lane, or a lane
offered nothing, shows every flat and draws nothing; both hosts by source; a texel written where its world point stands
for a standing and a lying body, four eyes (one inside the floored half metre), both doors; the lean and the Billboard
Look keep the quad's depth; the target, the unit and every drawn exit's depth write by source; unit 1 let go before
the target is drawn into again (a program sampling it would be a feedback loop). `tools/mutants/fb1015_lootbody.json`:
13 mutants, 13 dead. Pin moved: AUDIT MW-NPC C6's (`test/characters/mwnpc_audit.test.js`) holds
C6's own half at the new door - every flat shown before a standing body's is marked; the hosts' order is FB1015's pin.

## 30. NPC-MARKS - A MARK OVER THE PEOPLE WHO DO SOMETHING (SHIPPED 2026-10-21)

The owner, 2026-10-21: "For morrowind models, vendors and quests npcs are hard to find due to everyone looking the
same. Could we make a bobbing icon above their character for morrowind specifically?"

THE PROBLEM IS THIS ARC'S OWN. Daggerfall's standing people are pictures, and the picture says who they are - a shop's
keeper wears the shop's sprite. MWNPC17's wardrobe dresses everyone off their faction's role and their seed, so in a
Morrowind body a jeweller and the customer at the counter can look alike, and a quest's contact looks like the room.

WHAT SHIPS. Over each standing person whose BODY stands on the people lane (`createPopulationLane`'s new `heightOf` -
PeerBodies' own, so an Altmer's mark hangs over an Altmer's head) and whose click goes somewhere other than talk, a
small pixel-art icon bobs (`render/npcMarkPass.js`, `scenes/npcMarksHost.js`):

- a yellow "!" - a person a live quest holds (their QuestResourceBehaviour, the one `openStaticNpc`'s `doClick` reaches
  first - PlayerActivate.cs:1523-1528 - or a quest's stood person). A quest set aside (QUEST-SHELF), ended or broken
  marks no one. It wins over the other two: what the quest wants first. (AUDIT NPC-MARKS, section 31: and the work
  pool's questor where the click reaches talk; an arena officer's own window comes before it.)
- an amber coin - StaticNPCClick's merchant arm (a Merchants-group person in a shop, a bank or a tavern, or a custom
  merchant service's).
- a blue gem - its guild-service arm where a guild answers it, and the coven's (a guild's trainers, spell sellers and
  quest givers); since section 31, the arena's officers too.

THE ROUTE IS THE CLICK'S. `staticNpcRouteIn` builds staticNpcRoute's arguments in one place, and `openStaticNpc` now
asks it too (ONE CONSTRUCTION SEAM - the rr3 pin moved with it), so a mark never promises a door the click does not
open. A person's route is read once their faction's row is in (section 31 L1: not "the table" - it is an empty Map
while it loads), again when a mod's merchant service switches (L6); their quest and their work each frame.

THE FORM. One quad a mark, square to the eye, standing on a point MARK_OVER_HEAD_M over the body's crown (section 31
R9: its bottom there at any size - it was centred there, and a far mark drawn large reached into the head); the icon
drawn by the fragment
stage on a 16 x 16 grid, so it reads as the pixel art the sprites are and ships no picture (nothing read from ARENA2).
Blended, tested against the world's depth and writing none (a wall hides it - NAME1's complaint about names seen
through walls is not repeated), never under MARK_MIN_RAD of the view (two screen pixels a cell since section 31 R6), the
nearest twelve (the lane's Near cap) within
30 m, faded over the last fifth. The bob: 6 cm each way once a second on duelWall.js's wrapped clock, a phase each;
still under the system's reduced motion. No fog: a cue for the eye, inside a street's width.

A classic sprite is never marked - its picture is its mark - so with Morrowind People off, or no Morrowind data, nothing
draws. The switch is the Features page's "Morrowind People Marks" (`npc-marks`, the `npcMarks` pref, on by default, the
viewer's own).

THE FOUR HOSTS. `scenes/worldModes.js` - the interior (the room's people and its quest stands) and the dungeon (its
people, through `dungeonContext.js`'s new `peopleLane`, and its quest stands); `scenes/world.js` - the street's
standing people (route read with no building: a guild's servant and a custom merchant service mark, a plain merchant
in the street talks); `scenes/exterior.js` - the fixed-city bench's standing people, the same. Not marked: the walkers
(MWNPC7 - no faction route), the yards' and homes' placed figures (MWNPC18), the stand-flats and the boats' crews
(STAND-FLAT - no StaticNPC), the living world's residents (LW8).

Not a DFU member: Ledger A row (NPC-MARKS). `test/scenes/npcmarks.test.js`; `tools/mutants/npcmarks.json` (its count
since the audit is section 31's), one equivalent as recorded (the route's `insideBuilding` with no building). The icons' pixels and the quad's
size are pinned on the shader's own code, run by `test/glsl.mjs`. The shader was compiled and drawn
in headless Chromium (SwiftShader) against a dark and a lit wall before it shipped; the bodies themselves need the
player's Morrowind data, so the marks over a live body were not seen on this machine.

## 31. AUDIT NPC-MARKS (2026-10-22)

The owner, of section 30: "Audit this". Two lanes read the change cold, from its commit and not from this record - the
LAW AND THE WIRING (does the mark ever disagree with the click; does each host gather and draw in the right order and
place), and RENDERING, GL STATE, PERFORMANCE AND LIFECYCLE - and nothing was edited while they read (Home.md, DO NOT
FIX WHILE THE VERIFIER IS READING). Sixteen findings (numbered by the lanes' reports; R8 and R11 read fine): fourteen
fixed, two stated, and three of the fixes carry a stated remainder (R4, R6, L2).

THE LESSON FIRST. R1 was a red CI the slice pushed: a new foreign pass on a host moves the hosts' seam counts, and
three pins count them by call site (`test/render/glstate.test.js` EV6, `test/render/perf2.test.js`,
`test/ui/farring.test.js`) - beside the one the slice did move (`test/bible/audit18_bible_docs.test.js` AUDIT 39r).
The slice ran its own tests by grepping for the names it touched, and a count of `renderer.markForeignPass();` names
nothing it touched. A slice that adds a pass greps the tests for `markForeignPass` too.

RENDERING (R):
- R1 FIXED. The three seam pins moved: world.js 32 -> 33, exterior.js 7 -> 8, each with its reason.
- R2 FIXED. The pass bound its program and VAO before it knew whether a mark would draw - a lone mark at the reach's
  very edge fades to alpha 0, drew nothing, and the host, told so, marked no seam: the renderer's program and VAO
  shadows were left wrong for its next draw (EV6's own class). It looks first now and binds nothing for nothing
  (spoilsGlow.js's order).
- R3 FIXED. Every session built the program twice - bootWorld and createWorldModes each made a pass on the one context.
  ONE PASS A CONTEXT: the hosts share it (`npcMarksHost.js` SHARED), its owner the last to let go.
- R4 FIXED. No owner freed the program, the VAO or the buffer. `NpcMarkRenderer.dispose` and the host's `dispose`
  (the last host frees). The hosts' life is their page (the title menu reloads it, scenes/shared.js), as the loot
  lines' is - stated, as theirs is.
- R5 FIXED. The icon's right was the view's first row - lookAt's x, which the HANDEDNESS mirror (mat4.js
  mirrorProjectionX) puts on the screen's LEFT: the icons drew mirrored (only the top-left light showed it). It is the
  billboards' `camRight` now, the row negated.
- R6 FIXED. At MARK_MIN_RAD 0.011 a far icon stood about 21 pixels at 1080 lines - 1.3 a cell - so cells came out one
  and two pixels wide and shimmered as it bobbed. 0.017 is two a cell. And the "!" and the coin were the same gold, so
  where an icon is a few pixels (retro mode) the two could not be told apart: the "!" a lemon yellow, the coin an
  amber. STATED: in retro mode a far icon is still a few pixels - the shapes do not survive that; the hues do.
- R7 STATED. The lit lane's resolve multiplies the frame by its AO, its vignette, its contrast and its dither, and the
  icon is in the frame, so in front of a corner it darkens a little - as the loot lines do. No bloom: its brightest
  is under AIR_BRIGHT_THRESHOLD.
- R9 FIXED. The icon was centred on its point, so a far mark drawn at its larger floor size reached down into the head;
  it stands ON its point now (the vertex stage lifts it a half-size), MARK_OVER_HEAD_M 0.2 the gap under it.
- R10 STATED. "No allocation a frame" was not true: the lane's `heightOf` spells its peer id (npcPeerId), as its `has`
  already did for every actor. The header says so.
- FINE, as read: the GL state left (blend off, depth mask on, cull on, the VAO unbound - the blend func the next pass
  sets its own); a standing body's card discards its empty texels, so the body never hides the mark; every lane's
  bodies are composited before the marks; at most twelve draws, three uniforms each; the shader's highp, int compares
  and discard.

THE LAW AND THE WIRING (L):
- L1 FIXED. `townTalk.factionDict` is the FactionFile's own empty Map from the moment the file is fetched until it
  parses - truthy - so a person first seen in that window read talk and KEPT it. The route is kept only once the
  person's faction row is in. The test builds the producer's own empty dict (TEST THE SHAPE THE PRODUCER MINTS).
- L2 FIXED - the owner's case. The work pool's questor - the townsperson the "any work?" answer names - opens the quest
  offer as their talk's first door (npcSession.isNpcOfferingQuest, TalkManager.cs:757-772) and had no mark. Marked
  now where the click reaches talk, read each frame by the click's own seed (`offersWork`, worldModes.js and world.js;
  the bench has no session, and so no pool). STATED: a castle's 25% roll is the click's own and cannot be known ahead.
- L3 FIXED. A guild-service route with no guild here - a holy order's servant in a building no divine runs, an order
  no hall holds - is "You get no response." (openGuildService's createGuildForGroup); it marked a gem. It marks only
  where a guild answers now.
- L4 FIXED. The dungeon's click is npcTargets' - no width, or a ShowText action's person, is not the NPC's - and the
  marks gathered every person. `clickable` holds the marks to that law.
- L5 FIXED. The arena's officers open their own windows before the route (activateStaticNpc: the Herald, the
  banners' recruiters, the bookmaker, the Pit Master, the Keeper of the Hall) and were marked by their faction. They
  mark a gem now, before the quest's "!" as their window comes before the quest's click. A warden talks. The Wyrd
  Sisters and the lamp keepers stand no body (their looks are null), so no mark.
- L6 FIXED. A mod's merchant service (Roleplay & Realism's) switched mid-session left the kept route. The route is
  read again whenever the switch's answer moves.
- L7 FIXED. Under the Billboard Look the upright card draws the body cos(pitch) of its height (BODY-CARD), and the mark
  hung at the full height floated over a shortened head from above. `markCrownOf` reads the switch.
- FINE, as read: `interiorBuilding` is cleared on every way out, so the click and the mark read the same building in
  every mode; the faction listeners' quests are Individuals', whose route is talk; quest-words-first; tombstoned
  questors' behaviours destroyed; a quest's item and foe stands stand no body; outdoor quest people are the street's
  StaticNPCs (no stand is stood outdoors); the lane's feet are the holder's own array; interior holders are fresh
  each visit, so no route crosses buildings.

AT THE PULL REQUEST (#1121): CI's first run of the audited change found one more - the one-home ratchet
(`test/systems/talk/audit24_onehome.test.js`, ONE DFU MEMBER, ONE EXPORT) caught two names already declared elsewhere
for other things: `MARK_KINDS` (systems/livingWorld/relations.js, a body's marks) and the audit's own `crownOf`
(systems/naval/navalShips.js, a water's crown). Not one member twice - two homonyms - so ours were renamed
(`NPC_MARK_KINDS`, `markCrownOf`) rather than listed in HOMONYMS. The same lesson as R1's: a ratchet over the whole
tree's declarations names nothing the slice touched, so a slice adding exports runs it.

`test/scenes/npcmarks.test.js` (21 tests; L1-L7, R2, R3/R4 and R5 each their own, the vertex stage's point law beside
R9); `tools/mutants/npcmarks.json`: 46 records, 45 dead, one equivalent as recorded. The pass was compiled and drawn
again in headless Chromium through a mirrored projection, the game's.

## 32. BODY-CROP AND MW-DETAIL - THE BODY AS THE CAMERA SEES IT, AT THE VIEWER'S DETAIL (2026-10-22)

A player's report, 2026-10-22: "when the player's camera gets too close to a morrowind 3d character model, the model
starts to stretch in weird ways and it gets shorter. it seems like an attempt to avoid visual clipping with the camera,
but honestly clipping is largely preferable to the current behavior", and "morrowind 3d models are always pixelated (or
just rendering at a different resolution from the rest of the viewport?), this should probably be optional".

WHAT WAS WRONG. Nothing kept the camera out of a body; no code shrinks one near the eye. Every body's picture
(`render/characterSprite.js` drawRigSpriteBox, MW-D24) was an ORTHO down the eye's ray to its anchor, laid on one quad
square to that ray (BODY-LEAN). That stands in for a perspective only while the body is small against its distance. Up
close the ray pitches steeply, so the quad's top leans away from the eye and its foot toward it - the reverse of a
perspective, where the nearest part draws largest. Measured (a 1.8 m body, the third-person eye at FOCAL_HEIGHT a metre
behind it, a 60-degree lens): the head drew at -0.59 of the screen where it stands at -0.04, its shoulders 0.28 wide
where they are 0.45, the knees wider than they are - shorter and stretched, the report's two words. mwCamera's
MIN_DISTANCE is 0.43 m and an obstacle pulls the eye closer still. And the picture stood at MW_ARM_PIXEL (3) screen
pixels a texel, NEAREST, inside a 1024-square target: no setting reached it, and a body taller than about 3,000 pixels on
the screen took coarser texels than that.

BODY-CROP: THE PICTURE IS THE MAIN CAMERA'S OWN, CUT TO THE BODY. `drawBodyPicture` takes every Morrowind body (the
player's, a peer's, the people's, the foes', the watch's - fpArm.js drawThird) and every 3D horse (horseRig.js draw):

- THE WINDOW (`cropPicture`). The box cut at the lens's near plane - its corners in front of it and the points where
  its edges cross it - through the frame's own projection and view; their bounds, cut at the image's edge, rounded OUT
  to whole texels counted from the image's corner. A body beside the eye takes only the window its seen part covers
  (a whole screen of texels a frame for every body brushing past the camera, otherwise); an eye inside the box takes
  the whole image; a box wholly behind the near plane or off the image takes nothing. Padded by the tells' and the
  weapon outline's texels (bodyFxPad, glowPad) as the card was. A window larger than the target's room takes a coarser
  whole texel. The projection-view and the corners are scratch (CROP_PV, CROP_CORNERS): a frame's crowd measures every
  body.
- THE CAMERA. The frame's projection with the window stretched over the whole of NDC - x and y alone, so the picture's
  depth IS the frame's depth, and the eye's near plane cuts the mesh exactly where it cuts the world: the clipping the
  report prefers. The texel grid is the screen's, so a pixelated body's texels stand still on the screen instead of
  sliding with it.
- THE QUAD (`cropQuad`). The window's own rectangle on the plane square to the view at the anchor's distance, its axes
  the view's (signed for the HANDEDNESS mirror), so each texel lands on the pixels it was taken for. drawCharacterSpriteQuad
  takes the right's y now (a card's is level, as it was).
- THE DEPTH. The quad writes each texel's own depth as it stands (`depth.window`, the shader's `uDepthK.w` 2), after
  the glow's floor (a ring or an ember keeps the quad's depth, AUDIT WEAPON-GLOW MW-1). The sprite target's depth is
  24-bit now: over the frame's whole near-to-far 16 bits step a quarter of a metre at 60 m in the street.

THE CARD STAYS where a card is asked for: the Billboard Look's upright one (BODY-CARD - the flat card on purpose; its
picture level since BODY-FLAT, below), the travel view's leaned one (`up`, AUDIT OW4 J6) and a lens with no perspective
(an ortho's or a probe's identity - no near plane to crop through), through drawRigSpriteBox;
and the voxel rigs' (drawCharacterSprite, exterior.js) - not a Morrowind mesh. The hit flash, the concealment's blend,
a foe's tells and the weapon glow are the quad's and the pass's, so every one draws as it did.

BODY-FLAT (2026-10-23, the same player, of this change's build: "The billboard look still has the same issue, is this
fixable?"; asked whether the look should shrink by the camera's own tilt or be a true flat sprite: a true flat sprite).
The Billboard Look's card took its picture down the pitched ray (BODY-CARD), so the eye foreshortened a body twice -
cos(pitch) of its height at a distance, and from mwCamera's MIN_DISTANCE, the ray to a body's middle 62 degrees down,
0.16 of it. A Daggerfall flat is a picture drawn level and stood upright: the card's picture is taken along the ray's
level part now (drawRigSpriteBox `flat`), so the card holds the body at its true height and the eye's own perspective
is the only foreshortening, at any distance. The level ray is a unit one however close over its body the eye stands
(the 3D ray's half-metre floor would have left it short and stood the picture's camera inside the box), and straight
over the body it is the view's own heading (`levelHeading`). The card keeps its own depth (FB1015: the flat card on purpose); a lean the
travel view hands keeps its pitched picture. It retires AUDIT NPC-MARKS L7 (section 31): a mark hangs over the full
height under either look (`markCrownOf` is gone). The row's note says so ("flat upright pictures"), redrafted in the
thirteen whole languages. Pins moved: `test/systems/bodycard.test.js` (the true height from every eye, up close too,
the picture level, a handed lean's pitched), `test/render/prbow1_bow.test.js` (the card's picture along the level ray),
`test/scenes/npcmarks.test.js` (L7's law retired, the full height pinned), and a body nearly and straight below the eye
pinned in `bodycard.test.js`; `tools/mutants/bodycard.json` re-aimed with three records more (the picture pitched
again, the level ray short of unit, no heading straight over the body), `bodylean.json` re-aimed, and `npcmarks.json`'s two L7 records retired
with the law.

MW-DETAIL: THE VIEWER'S DETAIL. A Features row, Morrowind Model Detail (`mwModelDetail`, `systems/features.js`
mw-model-detail; Combat > With Morrowind data, beside the Billboard Look): Pixelated, the default and the owner's look,
draws a Morrowind texel MW_ARM_PIXEL screen pixels; Sharp draws it one. `mwModelPixel` is read where each Morrowind
picture is sized - the bodies and horses (drawBodyPicture), the first-person arm (fpArm.js draw) and the rider's horse
in first person (horseRig.js drawFirstPerson) - so it lands at once; under retro or a render scale a texel is a whole
number of the image's pixels, as before (AUDIT RETRO1 C6, now `imageTexel`, the one home). The game's canvas draws
without antialiasing, so a Sharp picture through the frame's own lens is the frame's own pixels of the body. Sharp wants
the target as large as the screen (a body up close, the arm always): `Renderer.charSpriteRoom` grows it on demand in
steps of 256, never past CHAR_SPRITE_RT_MAX (4096) nor the GPU's MAX_TEXTURE_SIZE, and never smaller again - 50 MB with
its depth at 2560 square (a 1440p screen), 128 MB at the most. Pixelated never grows it below a 3072-pixel screen. The
target is let go and made again at its next use; a batch queued before the growth packs and samples against the edge
it finds at its flush. A Sharp picture past the most takes two pixels a texel. The card asks for no more than the
screen's own rows: up close it runs far off the screen, and there it takes coarser texels rather than a larger target.

THE FOUR HOSTS: none changed. Every host reaches a body through fpArm.js drawThird (mwView.js for the local body,
net/peer/peerBodies.js for every lane) and a horse through horseRig.js, and the arm's pass is the arm's.

PROVEN. `test/render/bodycrop.test.js` (9): every point of a body drawn where the main camera puts it from 3 m to
MIN_DISTANCE, the mirrored lens and a plain one, the lone pass and the batch - and the card it replaced, on the same eye,
drawing the head 0.4 of the screen low and the shoulders narrow; the window on the texel grid, every corner inside, no
texel to spare, cut at the image's edge, padded; the crop's z and w rows the lens's; the whole image from inside the box,
nothing behind the eye or off the image, a coarser texel past the room; the quad's corners on the window's, mirrored or
not, at the anchor's distance; the card under the Billboard Look and the travel view's lean alone; the texel at each
detail and under retro; the target's growth, its steps, its most and its release, and a flush after it; the card's
room no larger than the screen; the depth mode and the tilted right on a recording GL; the switch, its row and its
readers. `tools/mutants/bodycrop.json`: 18 records, 18 dead. In a real WebGL2 context (Chromium, a GPU) through the
game's mirrored lens, the fixture body: at Sharp the picture is the direct draw of its mesh pixel for pixel - coverage
and colour - from 2 m to 0.15 m, where the card it replaced differed in nearly every body pixel; Pixelated, every body
pixel the colour of its 3 x 3 block on the screen's grid; a second body crossing the first, the picture drawn before it
and after it, wins and loses the same pixels the mesh does (the frame's own depth); the target's framebuffer complete
with its 24-bit depth, grown, with no GL error. NOT CHECKED HERE: the game itself with Morrowind's data.
Pins moved (each marked PIN MOVED): `test/render/prbow1_bow.test.js` (PR-BOW1's ray and anchor and AUDIT OW3
J6's grown window are the card's laws, held under the Billboard Look, and the crop's own beside them),
`test/render/mwnpc5_bodyfx.test.js` (the card's lone pass's tells, under the Billboard Look), `fb1015_lootbody`
(the 24-bit depth, the flush's edge), `fb1012g_batchshut` (the probe renderer names no world image), `invislook` (and
the cropped picture's quad beside the card's), `coats3d_horse3d`, `mwnpc16_bodyshadow` (its canvas has a size: the
picture is cut to it), `weaponglow1`, `macr_fixes`, `ww1_weaponwidget`, `features`, `ft18_features` and
`ft8_combatvisuals` (one row more), `mwnpc_mainmerge`; their records in `tools/mutants/` (macr, mwnpc5, mwnpcmerge,
ow4j, prbow1, auditretro2) re-aimed by content, and `tools/mwArmProbe.mjs`'s anchor at the target's viewport. The
row's four strings are in the English catalog (`tools/l10nExtract.mjs`) and drafted in-session for the thirteen whole
languages (`tools/l10nInSession.mjs`, recorded as the machine's).
