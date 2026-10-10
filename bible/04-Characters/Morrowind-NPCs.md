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
   prefs shelf, so a machine that cannot hold it gives it back.

## 4. Slices

| slice | what lands | hosts |
|---|---|---|
| MWNPC1 GPU SKIN | the third-person body's skin in the vertex shader: static stream, per-pose palette, face normals from the triangle's own derivatives, boxes off the palette (rule 42), the CPU path kept for the first-person arm and as the fallback | renderer + fpArm: every third-person body (player, peers, family, regulars) |
| MWNPC2 ONE PASS | every seen body into one bind of the sprite target, quads after | the body pass in world.js / worldModes.js; exterior.js has none |
| MWNPC3 THE BODY SERVICE | one parse a mesh and one GL texture a picture across every body, no reach sweep for a body never looked out of, an instance's own limits (SHIPPED, section 8); third-only builds and a build gate across lanes moved to MWNPC4 | all |
| MWNPC4 THE NPC LANE | the lane (`characters/npcBodies.js`: the NPCs as synthetic peers under a tier's caps, `has()` for the host's billboard), the hit recoil and the death on the rig and off the pose, one build queue across every lane (SHIPPED, section 9); an actor's machine read into the pose is each population's adapter, MWNPC5 onward | the rig and the lanes; the four hosts flagged, wired with the first population |
| MWNPC5 FOES | class foes in their rolled equipment, a stable race and face per foe (not one Breton), the effects parity: hit flash, glint, elite glow, dissolve, concealment (5a SHIPPED, section 10: the glint, the elite's glow, outline and embers and the dissolve on the body's quad - the hit flash and the concealment it already drew); 5b SHIPPED (section 10b): the dungeon's foes, the cast-only billboard, the Features row; 5c SHIPPED (section 10c): the encounter pool - the exterior, the interiors, exterior.js; shadows kept (the billboard casts) | dungeonContext.js, world.js (exteriorFoes), worldModes.js (interior foes), exterior.js |
| MWNPC6 THE WATCH | cityGuards' two instances (SHIPPED, section 11: a lane of its own under WATCH_BODY_TIERS) | world.js, worldModes.js, exterior.js; dungeonContext.js stands none (named) |
| MWNPC7 TOWNSFOLK | walkers and living residents, a wardrobe by FACTION sgroup that actually varies (distinct records and dyes per persona) (the WALKERS SHIPPED, section 12: a wardrobe per outfit variant, dyed per spawn - the living residents indoors are MWNPC8's standing people) | world.js, exterior.js, worldModes.js (living residents indoors) |
| MWNPC8 STANDING PEOPLE | street, interior, dungeon and quest StaticNPCs; children and vampires keep their sprite; `drawnFlat`'s nudity law honoured (8a SHIPPED, section 13a: the buildings' people; 8b SHIPPED, section 13b: the dungeons' and the street's; 8c SHIPPED, section 13c: exterior.js's and the quests' stands) | all four |
| MWNPC9 CREATURES | CREA records, creature skeletons and their own .kf, the match table with its declared misses (9a SHIPPED, section 14a: the body; 9b SHIPPED, section 14b: the rig, the match, the hosts) | dungeonContext.js, world.js, worldModes.js, exterior.js |
| MWNPC12 STEEL AND ORCS | the steel no look ever wore (material 1 named none) worn; the four orcs as people in Morrowind's Orc body (SHIPPED, section 17) | foeBodies.js, folkBodies.js, peopleBodies.js - every foe host and roster through them |
| MWNPC11 ONE FRAME | every NPC lane on one frame budget - the nearest bodies across all of them, the skins shared out - and the lanes probe (SHIPPED, section 16) | every lane (createHostNpcBodies) |
| MWNPC10 THE REST | crews, road parties, siege, gate court, the broker (10a SHIPPED, section 15a: the gate court; the broker keeps her guise. 10b SHIPPED, section 15b: the siege and the crews. 10c SHIPPED, section 15c: the roads' parties and the living residents indoors) | their hosts |

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

PROVEN. `test/mwnpc3_bodyservice.test.js` (5): a second body from the same
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
- OFF THE POSE (net/peerBodies.js `_react`). Two fields only an NPC's pose
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

PROVEN. `test/mwnpc4_npclane.test.js` (5), on a fixture rig whose clip file
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

PROVEN. `test/mwnpc5_bodyfx.test.js` (3): the uniforms a quad sends with
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
  it wears the same, so a foe is one build for its life. Its actor: the
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
  nothing, in neither phase, and blooms nothing. The host sets it AFTER
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
  Steel Helm is, read every frame, so it lands at once.

PROVEN. `test/mwnpc5_foes.test.js` (3): the class foe alone; one seed,
one person on every machine, another place or species another; a
thousand foes near the Bay's weights, all ten faces; the gender's
wardrobe; the armour as worn with the clothes under it and no shoes beside
boots; the look kept, and new (the same person) when a helm goes on; the
stride, the run only in pursuit, the blows without the ranged bit, a
strike never Idle and varying, the casts, a recoil per new hit mark, the
deaths off the seed and varied across foes; the tells and their one
object. `test/mwnpc5_dungeon.test.js` (5): the cast-only billboard on a
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

PROVEN. `test/mwnpc5_pool.test.js` (2): the real pool with a recording
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

PROVEN. `test/mwnpc6_watch.test.js` (3): the caps against the foes' (a
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
  the guard in the watch's whole steel plate. A RE-ROLL IS A NEW PERSON:
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

PROVEN. `test/mwnpc7_folk.test.js` (4): every race, gender and outfit
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
  name seed. A CHILD (by texture or the children's faction) and a VAMPIRE
  (a vampire clan, the vampires' guild group, the supernatural social
  group) keep their sprites, and so does a race the data cannot name. The
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

PROVEN. `test/mwnpc8_people.test.js` (4): every faction's wardrobe and
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
- The bound is the lane's: the 'people' lanes take NPC_BODY_TIERS, and
  only one of the three ever runs a frame (the building, the dungeon or
  the street - the scene is one of them). (AMENDED BY MWNPC11, section
  16: true of the three 'people' lanes, not of the street's lanes
  together - the street's people stand beside its foes, watch and
  walkers. Every NPC lane now shares one frame budget.)

PROVEN. `test/mwnpc8b_streetdungeon.test.js` (4): the dungeon by source
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

PROVEN. `test/mwnpc8c_location.test.js` (2), by source: the location (a
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

- THE RECORD (`formats/mwFirstPerson.js` readCreature, extractArmRecords'
  `creatures`, `ARM_RECORDS_VERSION` 5 - every master re-extracted once).
  Its id, its model (lowercased, slashes forward), its name, its FLAG's
  low byte (`mFlags = flags & 0xFF`; the blood type rides above it) and
  its XSCL (1 without one) - loadcrea.cpp. `CREA_FLAG` is loadcrea.hpp's
  enum as the 0.48.0 header numbers it: Bipedal 0x01, Respawn 0x02, Weapon
  0x04, Base 0x08, Swims 0x10, Flies 0x20, Walks 0x40, Essential 0x80 -
  READ OFF THE HEADER, because two recollections of it (the planning pass's
  and this one's) disagreed with it and with each other.
- THE BODY (`assembleCreature`, `formats/mwCharacter.js`
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

PROVEN. `test/mwnpc9_creatures.test.js` (5), on a creature written as
retail's are (`test/fixtures/mw/creatureRig.mjs`: a model with a skinned
body, a rigid head on a turned node, a rigid tail, a Tri Bip shape, and a
.kf with Idle, WalkForward, Attack1-2, Hit1, Death1): every shape bound,
the debug shape dropped, each piece at rest exactly where the flattener
puts it; posed, a turned Head turns its piece and nothing else and the
walked Bip01 carries every piece; a rigid shape off the skeleton on the
root; a flame on its node at rest and posed; and the sources.
`test/mwload_records.test.js`: the CREA records (the blood type not a
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
  tables (its API, 2026-10-09), never recalled. Matched: rat (rat), imp
  (scamp), spriggan (BM_spriggan), grizzly bear (BM_bear_black), skeletal
  warrior (skeleton warrior, else skeleton), giant (bm_frost_giant),
  zombie (bonewalker), mummy (draugr), frost and ice daedra/atronach
  (atronach_frost), fire daedra and atronach (atronach_flame), iron
  atronach (atronach_storm), daedroth, daedra seducer (winged twilight),
  daedra lord (dremora_lord), lich and ancient lich (lich), dreugh. Declared
  misses: the ghost and the wraith (a body's textures are alpha-tested,
  never blended - a translucent dead would be cut, not seen through);
  the orcs and the vampires (people, not creatures - an orc's race is no
  Daggerfall race a look can name yet; AMENDED BY MWNPC12, section 17: the
  orcs stand as people in Morrowind's Orc body - still never creatures); the werewolf (the player's wolf,
  WEREWOLF1, not yet a foe's); the slaughterfish (its swimming groups are
  not driven); and every beast Morrowind has none of (giant bat,
  sabretooth, spider, centaur, nymph, harpy, wereboar, scorpion,
  gargoyle, the dragonlings, the flesh atronach, the lamia).
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

PROVEN. `test/mwnpc9b_creaturerig.test.js` (10), a creature built on a
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

- THE COURT'S LANE (`scenes/gateCourt.js` drawBodies, a 'gate'
  population lane of its own). Him: offered while his sprite stands, on
  his billboard - walking or running as his act says, his blow a swing as
  the relay's attack changes, struck a recoil (his hurt and the court's
  flash), and SCALED: three times a man, his sprite's own scale times the
  fight's size, through the lane's new per-actor `scale` (PeerBodies
  draws a body that many times its size about its feet - drawThird's
  `grow` - and heads it that much higher). Fallen, dead, on his corpse's
  flat. His host (`scenes/gateHost.js` offerBodies): each shown body its
  creature off its mobile, standing or falling (dead), on its own
  billboard; one its mobile has no match for (the Flesh Atronach) keeps
  its sprite. The dungeon pass (worldModes.js) draws them before the
  billboards their batches ride (`extraBillboards`); the court's leave
  lets the lane go. Him: the Daedra Lord's match, dremora_lord.
- THE BROKER (`scenes/sigilBrokerPool.js`) keeps her sprite: she is the
  Seducer IN HER MORTAL GUISE, and the match would stand her as the
  winged twilight she is hiding.

PROVEN. `test/mwnpc10_gate.test.js` (4): rosterActor's counts (a held
key one swing, NaN none, a recoil each new blow), its dead, scale and run;
a real court over a recording lane - him and the Imp offered their
creatures, him at his sprite's scale, the Flesh Atronach not offered, his
billboard cast-only under his body, the Imp's swing and recoil, the
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
- THE CREWS (`scenes/navalCrew.js` drawBodies, a 'crew' lane). Each hand
  on her deck his class's look off her seed and his place in her roster,
  at his sprite's feet and his world facing (kept off the frame's
  heading), each swing at his work begun one blow, concealed with her
  owner (drawn veiled after the opaque world, beside the watch's); a hand
  turned in below her deck is kept and not drawn. The world draws them
  with the foes and the watch, before the person billboards; clear lets
  the lane go.

PROVEN. `test/mwnpc10b_rosters.test.js` (4): rosterLook's steel, helm,
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
parties, their foes and their fallen - scenes/livingRoads.js; the
residents the day has inside a building - scenes/livingIndoors.js, the
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
  id; a class's sprite its blade out, the rest nothing drawn; a new person
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

PROVEN. `test/mwnpc10c_roads.test.js` (4): the blade's two ranges to
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
  report is at most a frame old; one older than NPC_BUDGET_STALE_MS, or a
  lane let go, takes no share). The lane stands its bodies within the cut
  (PeerBodies `setLimits`: the range), so the frame's bodies are the
  nearest k, whoever's; those tied at the cut stand together.
- THE EDGE HELD. A body standing keeps its place to NPC_BUDGET_HYSTERESIS
  (1.15) past the range, and a far one returns only within it - the cut
  moves as the crowd does, and each fall and stand was a skin. The lane
  ranks a body it holds (PeerBodies `holds`) by that hysteresis in its
  report, so the cut counts the held among the k: the bound stays exact.
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
  | near | one budget | 24.0 | 6.50 | 24.0 | 7.00 | 35 |
  | all | each alone | 91.0 | 37.33 | 91.0 | 7.00 | 99 |
  | all | one budget | 48.0 | 12.00 | 48.0 | 7.00 | 67 |

  A skin is a palette upload (MWNPC1) and a body drawn a tile of the sprite
  target (MWNPC2); their milliseconds are PEER-CADENCE's and PERF-RIG1's
  per body, times these counts.

NOT HERE: ONE BIND A FRAME (law 2) holds per lane, not per frame - a bind
of the sprite target for each lane that draws a body (seven on that
street; an empty lane's flush binds nothing). A bind is a target switch
and a tile clear, not a body's cost; one bind for every lane would draw
every lane's quads at one point of the frame, past their hosts' own draw
order.

PROVEN. `test/mwnpc11_budget.test.js` (5): the budget alone (the k-th
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
  `formats/mwItemMap.js` mwArmorRecords against Daggerfall's own
  ARMOR_MATERIAL (systems/armorMaterials.js - steel is 0x0201), and 1
  names no material: none of it resolved, so every one of them stood in
  their clothes, and the ones whose boots took their feet stood barefoot.
  Their pins checked the number, not the piece worn. Each now wears
  ARMOR_MATERIAL.Steel, and the pin is mwArmorRecords itself over
  Morrowind's own ids: every piece of every steel look resolves to steel.
  (Sections 11, 12, 13a and 15b's "steel" was this until now.) A weapon's
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

NOT HERE: the vampires (a vampire's face is Morrowind's vampire head, a
part the walk does not choose yet), the werewolf foe, the ghost and the
wraith keep their sprites (section 14b).

PROVEN. `test/mwnpc12_steelorcs.test.js` (3): the guard's, the knight's,
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

