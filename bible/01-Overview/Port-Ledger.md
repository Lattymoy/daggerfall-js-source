# Port-Ledger

Single source of truth for everything that is not a plain 1:1 line. Three
categories. If a departure or gap is not on this page, it does not exist.
Adding to category A requires Mac approval; B records data reality; C is the
work queue routed to arcs.

## A. Approved departures from DFU

| What | Ours | Approved via |
|---|---|---|
| Presentation layer | Hand-rolled WebGL2, no Unity concepts | Port-Doctrine |
| Characters/paperdoll | Mac's voxel system | Port-Doctrine |
| Music (HMI/XMI, MIDI.BSA) | Routed to Audio arc; DFU has no reader for it (Unity-side synthesis) | Mac, Readers-Arc close |
| Spectral/firewall emission colors (BaseImageFile helpers) | Routed to Rendering arc with spectral enemies | Mac ("best option") |
| Billboards | Vertex-shader expansion, Y-locked, batched per (archive, record) instead of Unity GameObjects/BillboardBatch | Renderer-side |
| FaceUVTool arithmetic | JS doubles instead of C# float mix; (Int32) casts become Math.trunc | Documented in faceUVTool.js, validated against corpus |
| Data access | Bytes in, objects out; no FileProxy/disk-usage modes | Runtime difference |
| Engine-internal randomness (terrain noise + nature scatter) | Ken Perlin reference improved noise (perlin.js) in place of Unity's Mathf.PerlinNoise, and umRandom seeded by the verbatim terrain key in place of UnityEngine.Random for nature scatter - neither engine PRNG is in DFU source; same role and statistics, different concrete samples; all pins pin our pipeline. The beach-line jitter and NextInt/NextFloat primitives are NOT departures - Unity.Mathematics Random is open MIT source and umRandom.js is a byte-exact 1:1 translation | APPROVED by Mac (option A, post-M9 audit): the substitutes are canonical for this port; bit parity with Unity engine PRNGs is out of scope |

## B. Verbatim quirks preserved (real-data reality)

Characters:
- SENT7.RMB carries one archive-210 lamp flat with factionID -4080 (Int16): DFU's faction != 0 rule makes the lamp a StaticNPC; reproduced verbatim (C2 corpus pin).
- NameGen.txt ships with two lenient-JSON constructs inside Monster3 (a missing comma, a trailing comma); FullSerializer treats commas as optional, so the committed normalized nameGen.json equals what DFU loads.

Readers:
- BSA: junk record 669 "FOO" in BLOCKS.BSA; structural closure invariant.
- Palettes: MAP.PAL filename triggers x4 six-bit expansion.
- TEXTURE: archives 215/217/436 unsupported (as DFU); wild compression values
  0x900/0x101/0x100 fall through to the uncompressed default; getColor32
  vertical flip and double alpha assignment kept.
- IMG: 6 palettized files read their embedded palette; FMAP0I00/01/16
  unsupported; ImgFile reads raw w*h regardless of the compression field.
- CIF: WEAPON09 (bow) has no wield record; FACES.CIF routes as RCI 64x64.
- ARCH3D: UV unpack only first 3 points AND recordId < 905 with the -7168 ->
  1024 exception; 905-entry patch table applied to a working copy; fixed
  buffers throw on overflow exactly like the C# arrays; min/max seeded at 0
  so Size spans the origin.
- BLOCKS: RMB subrecords step by blockDataSizes, not bytes read; RDB unknown
  list sized by the FIRST node's index; object root must start at the header
  offset; flat factionOrMobileId re-reads two bytes as LE u16; "REF_CUBE"
  and 0xff model ids parse to 0 via strict TryParse semantics; FixRdbData
  repairs blocks 994, 945/946, 958, 975, 1025, 1034, 1036; 8 RDBs carry
  0xff padding instead of the DAGR signature.
- MAPS: 17 regions ship empty records and are rejected (45 populated, as
  classic); two 32-byte names truncate exactly (Porcupine Hostel/Bhoriane,
  Feather and Barbarian/Kambria); letter2 = LETTER2[((2*char)&0xff)>>6], the
  8-bit truncation is load-bearing; LocationType decode uses uint
  wraparound; Orsinium (locationId 50015) border block moved to Z=-2.
- SND: record index 5 is zero-length; synthesized 44-byte RIFF header is
  byte-exact.
- WOODS: GetHeightMapValue clamps both axes with `>= dim - 1`;
  GetLargeHeightMapValuesRange strips the 5x5 to the interior 3x3 with
  INVERTED sample Y (src[ix][4 - iy]) and walks source pixels with a
  DESCENDING map Y (mapPixelY - y).

World layout:
- Exterior subrecord FLATS use the unrotated (subX, 0, -subZ) offset - DFU
  does not rotate flats with the building subrecord.
- Climate-swapped nature flats get `billboardPosition.z = natureFlatsOffsetY`
  (raw -2): suspected upstream y/z typo in RMBLayout.cs, kept verbatim.
  SETTLED: a corpus scan (pinned in world.test.js) shows zero exterior
  subrecord flats in archives 500-511 across all 920 RMB blocks - the branch
  is a dead code path on classic data and only fires for mod-injected
  buildings. Verbatim is provably identical to any fix.
- Ground tiles read [x][15 - y]; scenery skips records < 1; tile records
  >= 56 reset to grass 8; offsets propsOffsetY -4, blockFlatsOffsetY -6,
  natureFlatsOffsetY -2; classic data never sets model scale.
- City LIGHTS (archive 210) place at -Y + size.y where size.y is the SCALED
  billboard height added to native units pre-scale (as DFU wrote it), and
  the light Y differs from the billboard's -6 offset by design.
- ModelDoor extraction: door Index resets per submesh (DFU's doorCount
  scope); archive 156 (Scourg exterior) only exempts the base-archive
  reduction and never becomes a door; ruin-enter 331 record 0 is plain
  stone, skipped.
- On-terrain locations take NO RMB ground plane: StreamingWorld creates
  city blocks with addGroundPlane = false, so the stamped terrain tilemap
  is the ground and marker tiles (record >= 56) fall through to generated
  terrain tiles. Isolated-block scenes keep the ground plane (DFU default
  true).
- RDB flat positions are billboard CENTERS: AddFlat performs no
  AlignToBase, unlike the RMB exterior (AlignToBase) and interior
  (+size.y/2) paths which are base-anchored. Renderer-side base batches
  shift down half the scaled height.
- RDB model matrix composes T * Rz * Rx * Ry - a different rotation order
  than RMB's TRS (Ry * Rx * Rz). Red-brick doors (72100) carry the DOR tag
  but are never action doors. Flat actions pass the flat's MAGNITUDE as
  the raw axis. TRP objects with raw axis 13 rotate NegativeX at 400 (DFU
  bumps classic's 392 so the player cannot stick). LID/WHE force fixed
  rotations. RemoveOverlappingDoors seeds the exit-door centre WITHOUT the
  block origin (benign: start blocks sit at grid 0,0).
- Interiors: prop models (ObjectType 3) keep +Y UNNEGATED then anchor to
  the model's lowest vertex Y; IsBadInteriorModel repairs classic data by
  filtering misplaced model 31000 at 60 block/record combos across 27
  blocks (kept verbatim, like FixRdbData); action doors pin to the 9000
  model range via DoorModelIndex % 5 (900x..980x duplicates have differing
  origins); editor flats (199) are spawned as data but hidden from render.

## C. DFU features not yet ported (routed)

| Feature | DFU source | Target |
|---|---|---|
| Exterior indirect player light | SunlightManager.IndirectLight - a player-following point light (SunlightRig prefab's second light, white 0.6) scaled by the daylight curve alongside the key light | Rendering arc (exterior ambient currently carries the PlayerAmbientLight term only; found in the R5 audit) |
| Climate swaps onto mismatched record dimensions | 15 corpus swap combos (124_3 -> 24, 168_6 -> 68/368/468 families) land on records whose dimensions differ from the original; DFU stretches them identically because mesh UVs are normalized against the original archive at load - kept verbatim, pinned in the climate corpus test | Kept |
| Interior people visibility gates (house ownership, shop hours, building-open rules, GuildHall anytime access, TG/DB House2 membership) | DaggerfallInterior.AddPeople tail | Systems arc (people + their flags/factionID shipped C1) |
| Interior furniture actions, house containers, loot, spawn points | DaggerfallInterior AddFurnitureAction/MakeHouseContainer/AddSpawnPoints | Systems arc |
| Dungeon enemies (fixed + random) | RDBLayout.AddFixedEnemies/AddRandomEnemies | Characters arc |
| Dungeon treasure piles + loot | RDBLayout AssignFixedTreasure/AddRandomTreasure | Systems arc |
| Torch audio sources | RDBLayout.AddTorchAudioSource | Audio arc |
| Transition + activation sounds: door open/close (ActionDoor OpenSound/CloseSound), action PlaySound, ladder climb, enter/exit stingers | DaggerfallActionDoor, DaggerfallAction, DaggerfallAudioSource | Audio arc (the P2/P4-P6 systems expose the trigger points) |
| Non-movement RDB action flags: CastSpell, Hurt21-25, Poison, DrainMagicka | DaggerfallAction delegates | Combat arc (magic/damage) |
| Non-movement RDB action flags: ShowText, ShowTextWithInput, DoorText | DaggerfallAction delegates | UI arc (message boxes) + Systems (text records) |
| Non-movement RDB action flags: Teleport, Activate, LockDoor, UnlockDoor | DaggerfallAction delegates | Player arc (teleporters) + Systems (locks; P2 skips the IsLocked path) |
| Platform riding (velocity inheritance while standing on movers) | DFU parents the player transform | Player arc |
| Swimming + levitation motor | LevitateMotor, GetSwimSpeed | Player arc |
| Quest monster names (MonsterName) | NameHelper.GetRandomMonsterName - rolls the bank on UnityEngine.Random, quest-facing | Systems arc (name banks + data shipped C2) |
| Animal audio sources | GameObjectHelper | Audio arc |
| Music playback (HMI/XMI) | Unity synthesis, no reader | Audio arc |
| Smaller-dungeons generation | MapsFile + QuestMachine | Systems arc |
| PatchRegionIndex legacy-save fix | MapsFile | Systems arc (saves) |
| WorldDataReplacement / BuildingReplacement mod hooks | AssetInjection | Not planned (mod system) |
| TangentSolver / lightmap UVs | MeshReader | Not planned (Unity-specific) |
