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
   classic sprite stands.
5. MEASURED. A probe drives a town's walkers, a watch and a dungeon's foes
   through the real lane and reports skins, uploads, offscreen binds and
   builds per frame (counts, as WB9h's - the fixtures understate retail
   milliseconds); the `?perf=cpu` `bodies` zone is the field's readout.
6. A SWITCH. The pause card carries the lane (Off / Near / All) on the port's
   prefs shelf, so a machine that cannot hold it gives it back.

## 4. Slices

| slice | what lands | hosts |
|---|---|---|
| MWNPC1 GPU SKIN | the third-person body's skin in the vertex shader: static stream, per-pose palette, face normals from the triangle's own derivatives, boxes off the palette (rule 42), the CPU path kept for the first-person arm and as the fallback | renderer + fpArm: every third-person body (player, peers, family, regulars) |
| MWNPC2 ONE PASS | every seen body into one bind of the sprite target, quads after | the body pass in world.js / worldModes.js; exterior.js has none |
| MWNPC3 THE BODY SERVICE | third-only builds, a shared NIF parse cache, shared GL textures, time-sliced builds, the global body pool and its budget | all |
| MWNPC4 THE ACTOR RIG | an actor's clips off its own machine: MobileUnit's idle/move/attack/ranged/spell/hurt/death, facing off `ai.yaw` / `facingYaw`, the Morrowind group ladders the player's rig already climbs | all four |
| MWNPC5 FOES | class foes in their rolled equipment, a stable race and face per foe (not one Breton), the effects parity: hit flash, glint, elite glow, dissolve, concealment; shadows kept (the billboard casts) | dungeonContext.js, world.js (exteriorFoes), worldModes.js (interior foes), exterior.js |
| MWNPC6 THE WATCH | cityGuards' two instances | world.js, worldModes.js, exterior.js; dungeonContext.js stands none (named) |
| MWNPC7 TOWNSFOLK | walkers and living residents, a wardrobe by FACTION sgroup that actually varies (distinct records and dyes per persona) | world.js, exterior.js, worldModes.js (living residents indoors) |
| MWNPC8 STANDING PEOPLE | street, interior, dungeon and quest StaticNPCs; children and vampires keep their sprite; `drawnFlat`'s nudity law honoured | all four |
| MWNPC9 CREATURES | CREA records, creature skeletons and their own .kf, the match table with its declared misses | dungeonContext.js, world.js, worldModes.js, exterior.js |
| MWNPC10 THE REST | crews, road parties, siege, gate court, the broker | their hosts |

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
every peer's (net/peerBodies.js), the family's and the card table's (the
same lane) - paid at every posed frame: poseAssembly blended every vertex
of every skinned piece and placed every rigid one in JS, packFpArm
de-indexed the whole stream with a cross product a face, and
updateCharacterMesh re-uploaded all of it (~0.3 ms a body at 3,000
vertices on the fixture, PERF-RIG1; more clothed, and an NPC lane would
multiply it by the crowd).

WHAT IT IS NOW.

- `formats/mwGpuSkin.js` lays a body out ONCE (`skinLayout`,
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
- THE FACE NORMAL. packFpArm lights each triangle by the cross product of
  its POSED corners, which a vertex cannot know. `skinFaceFs` teaches every
  lane's character fragment shader to take it off `vRel`'s derivatives -
  exact, because a varying is linear across its triangle - signed by the
  winding against the renderer's CW front face, and carried through
  sign(det M) M M^T and the mirror's flip back to the packed path's
  `mat3(uModel) x n` (a race's unequal weight and height included).
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

PROVEN. `test/mwnpc1_gpuskin.test.js` (9) holds the GPU skin to the CPU
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

PROVEN. `test/mwnpc2_onepass.test.js` on the real Renderer over a recording
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
