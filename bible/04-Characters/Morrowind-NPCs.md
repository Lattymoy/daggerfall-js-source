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
| MWNPC3 THE BODY SERVICE | one parse a mesh and one GL texture a picture across every body, no reach sweep for a body never looked out of, an instance's own limits (SHIPPED, section 8); third-only builds and a build gate across lanes moved to MWNPC4 | all |
| MWNPC4 THE NPC LANE | the lane (`characters/npcBodies.js`: the NPCs as synthetic peers under a tier's caps, `has()` for the host's billboard), the hit recoil and the death on the rig and off the pose, one build queue across every lane (SHIPPED, section 9); an actor's machine read into the pose is each population's adapter, MWNPC5 onward | the rig and the lanes; the four hosts flagged, wired with the first population |
| MWNPC5 FOES | class foes in their rolled equipment, a stable race and face per foe (not one Breton), the effects parity: hit flash, glint, elite glow, dissolve, concealment (5a SHIPPED, section 10: the glint, the elite's glow, outline and embers and the dissolve on the body's quad - the hit flash and the concealment it already drew); 5b SHIPPED (section 10b): the dungeon's foes, the cast-only billboard, the Features row; 5c SHIPPED (section 10c): the encounter pool - the exterior, the interiors, exterior.js; shadows kept (the billboard casts) | dungeonContext.js, world.js (exteriorFoes), worldModes.js (interior foes), exterior.js |
| MWNPC6 THE WATCH | cityGuards' two instances (SHIPPED, section 11: a lane of its own under WATCH_BODY_TIERS) | world.js, worldModes.js, exterior.js; dungeonContext.js stands none (named) |
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
  4 at All - 10 and 16 a frame on a street with all three.)

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

