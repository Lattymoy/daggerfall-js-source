# Port-Ledger

Single source of truth for everything that is not a plain 1:1 line. Three
categories. If a departure or gap is not on this page, it does not exist.
Adding to category A requires Mac approval; B records data reality; C is the
work queue routed to arcs.

## A. Approved departures from DFU
- Slot-0 random-enemy reroll: DFU seeds UnityEngine.Random with DateTime.Now.Ticks (their TODO comment); we seed a xorshift32 with the dungeon LocationId so layouts are deterministic and testable.

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

| WebAudio playback engine (A1) | Unity AudioSource/3D audio -> WebAudio (PannerNode linear falloff, gesture-gated context, lazy 8-bit PCM decode). The DATA path stays 1:1: SoundClips indices, GetSwingSound pitch table, PlayHitSound roll families, EnemySounds attract shape (radius 16, delay 3..9, 80/20 bark/move, humans silent, attack 50%), door clips. |

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
  >= 56 reset to grass (DFU's tilemap index 8 == texture record 2);
  offsets propsOffsetY -4, blockFlatsOffsetY -6,
  natureFlatsOffsetY -2; classic data never sets model scale.
- City LIGHTS (archive 210) place at (-Y + size.y) * GlobalScale where
  size.y is GetScaledBillboardSize's NATIVE height (MeshReader.cs:549-568
  applies no GlobalScale), and the light Y differs from the billboard's -6
  offset by design.
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
- Rest (16f audit): the sub-tick interval is waitTimePerHour /
  minutesPerTick - DFU divides by the CONSTANT 10, not the 6 ticks an
  hour takes, so a rested hour passes in 0.45 real seconds (loiter
  0.75); and a 0-hour timed/loiter request rests ONE full hour
  (hoursRemaining < 1 is only tested after an hour completes). Both
  preserved verbatim (restSession.js).
- Falling into deep water keeps the fall LIVE (P14): swimming never
  grounds, so wading out can bill the whole drop as fall damage -
  nothing in DFU clears it (AcrobatMotor.Falling untouched by
  LevitateMotor); preserved bug-for-bug.

## C. DFU features not yet ported (routed)

| Feature | DFU source | Target |
|---|---|---|
| ~~Exterior indirect player light~~ SHIPPED (R12: the prefab's ACTUAL values - point, intensity 1.0, range 150, 0.7058824 gray ("white 0.6" was the rig's directional fills); daylight-scaled, weather-dimmed, night-off; shot-proven) | SunlightManager.IndirectLight | Rendering arc |
| Climate swaps onto mismatched record dimensions | 15 corpus swap combos (124_3 -> 24, 168_6 -> 68/368/468 families) land on records whose dimensions differ from the original; DFU stretches them identically because mesh UVs are normalized against the original archive at load - kept verbatim, pinned in the climate corpus test | Kept |
| Interior people visibility gates (house ownership, shop hours, building-open rules, GuildHall anytime access, TG/DB House2 membership) | DaggerfallInterior.AddPeople tail | Systems arc (people + their flags/factionID shipped C1) |
| Interior furniture actions, house containers, loot, spawn points | DaggerfallInterior AddFurnitureAction/MakeHouseContainer/AddSpawnPoints | Systems arc |
| ~~Enemy AI + mobile animation~~ SHIPPED (C8: enemyMotor/enemyAttack/rigs end to end; row pruned by the 2026-08-14 audit) | EnemyMotor, MobileUnit | Characters arc C5 (spawn data + classic standing billboards shipped C3) |
| ~~Dungeon treasure piles + loot~~ SHIPPED (S-series loot tables + corpse/pile takeLoot; row pruned by the 2026-08-14 audit) | RDBLayout AssignFixedTreasure/AddRandomTreasure | Systems arc |
| ~~Torch audio sources~~ SHIPPED (A2, dungeon scene; exterior/interior torches join with their scenes' audio wiring) | RDBLayout.AddTorchAudioSource | Audio arc |
| Transition + activation sounds: ladder climb, enter/exit stingers (door open/close SHIPPED in A1; action PlaySound SHIPPED in A2) | DaggerfallActionDoor, DaggerfallAudioSource | Audio arc (the P6/P7 transition seams expose the trigger points) |
| ~~Non-movement RDB action flags: CastSpell, Hurt21-25, DrainMagicka~~ SHIPPED (S4b + the trap seam; the Poison action (0x1a) is a VERBATIM NO-OP - DFU's own delegate body is empty, ported as such; entity poisons themselves shipped in S19b) | DaggerfallAction delegates | Combat arc (magic/damage) |
| ~~Non-movement RDB action flags: ShowText, ShowTextWithInput, DoorText~~ SHIPPED (U6 on the audit's relay spine: the 8600/5400/7700 records, the verbatim riddle-answer chain gate, the DoorText door hold + patch table; TEXT.RSC live) | DaggerfallAction delegates | UI arc + Systems |
| ~~Non-movement RDB action flags: Teleport, Activate, LockDoor, UnlockDoor, OpenDoor, CloseDoor~~ SHIPPED (MERGED 2026-08-16, two lanes reconciled: the audit's self-targeted verbs + special doors + door bashing + lock values; P10's Teleport jump with per-block destination resolution, the IsLocked player gate + LookAtInteriorLock tiers, and the repeated-block key namespace) | DaggerfallAction delegates + DaggerfallActionDoorSpecial + AttemptBash | Player/Combat |
| Door lockpicking (steal-mode activation, the failed-skill-level latch; the IsLocked gate + bash + the lock-level text SHIPPED in the merge) | DaggerfallActionDoor.AttemptLockpicking | UI arc (interaction modes) |
| FLC constellation animations (ROGUE/MAGE/WARRIOR.CEL) + the Ignite one-shot riding the answer (U18: the questions screen advances immediately where DFU waits out the CEL; the palette brightening itself is live) | CreateCharClassQuestions FLCPlayer + PlayOneShot | UI arc (a FLIC decoder slice) |
| Pixel-clipped question-scroll text (U18 draws only rows that fit the text window WHOLE; a row pops instead of shearing at the boundary) | MultiFormatTextLabel RestrictedRenderArea | Rendering arc (a scissor seam for UI draws) |
| Mouse-wheel scroll on the question scroll (U18: the click margins - one pixel per event - and the arrow keys stand in) | CreateCharClassQuestions OnMouseScrollDown/Up + GetUIScrollMovement | UI arc (the hosts' overlay wheel seam) |
| The custom builder's HIDDEN ResetBonusPool control (U20a: a DFU-added convenience on a rebindable shortcut, not a classic control - it zeroes the freeEdit pool outright. The port has no keybinding registry to hang it on, so it is recorded rather than invented) | CreateCharCustomClass resetButton + DaggerfallShortcut.Buttons.ResetBonusPool | UI arc (a keybinding slice) |
| The difficulty dagger's fading TRAIL (U20a: AnimateDagger's one-second alpha fade behind the moved dagger; the dagger itself lands on the verbatim pixel) | CreateCharCustomClass.AnimateDagger | UI arc (a per-frame UI tween seam) |
| U20b picks whose CAREER FLAG NOTHING READS YET (AUDIT 17n catalogued them rather than leave the window implying they all work). LIVE today: Increased Magery (maxMagicka reads the multiplier), the tolerance quartet (spellcast.js resistance/immunity/low-tolerance/critical-weakness), Rapid Healing (rest.js), Inability To Regen Spell Points, and - after 17n's two fixes - Bonus to hit / Phobia. INERT, because the consuming subsystem does not exist: Spell Absorption, Regenerate Health, Acute Hearing, Athleticism, Adrenaline Rush, Damage From Sunlight/Holy Places, Expertise In, Forbidden Weaponry, Forbidden Armor Type, Forbidden Material, Forbidden Shield Types. The flags are written correctly and persist through save; they simply have no reader. Each lands with its own arc | CreateCharSpecialAdvantageWindow.ParseCareerData | Their own arcs (items/effects/regen) |
| The secondary picker's CANCEL path (U20b: DFU pushes the half-built item onto the list BEFORE opening the secondary window and pops it again on cancel - CreateCharSpecialAdvantageWindow :417-420, :439-442. The port never pushes it, so a cancel is simply dropping the pending primary. Same end state; the port has no frame in which a redraw could catch the transient half-item, and its label block would have drawn a bare primary with no secondary) | SecondaryPicker_OnCancel + PrimaryPicker_OnItemPicked's else arm | Kept (end-state-verbatim) |
| The rep window's STALE BAR quirk (U20a: a click exactly on the middle line zeroes the value but re-enables neither bar, so classic leaves the previous bar drawn beside a 0 label. The port derives its bars FROM the value, so it cannot show one; the VALUE is verbatim) | CreateCharReputationWindow.UpdateRep | Kept (value-verbatim) |
| ~~Platform riding~~ SHIPPED 2026-08-14 (groundKey contact identity + mover frame deltas through the resolver - the DFU MoveWithMovingPlatform shape; rooted Mac's out-of-bounds ejection report) | DFU parents the player transform | Player arc |
| ~~Swimming + levitation motor~~ SHIPPED (P11: + the swim toggle, the Levitate (14,255) buff end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) | LevitateMotor, GetSwimSpeed | Player arc |
| Breath/drowning (isPlayerSubmerged at +76*GlobalScale, holding-breath UI, drowning damage) + crouch motor | PlayerEnterExit, AcrobatMotor | Player arc |
| ~~Quest monster names (MonsterName)~~ SHIPPED (S17: monsterName in nameHelper - the bank pick uniform per Ledger A, part draws on DFRandom verbatim, Monster3 ported whole; the quest machine consumes it when it lands) | NameHelper.GetRandomMonsterName | Systems arc |
| ~~Animal audio sources~~ SHIPPED (A2, dungeon scene; RMB exterior/interior animals join with their scenes' audio wiring) | GameObjectHelper | Audio arc |
| Music playback (HMI/XMI) | Unity synthesis, no reader | Audio arc |
| Smaller-dungeons generation | MapsFile + QuestMachine | Systems arc |
| ~~Enemy spellcasting (audit F15)~~ SHIPPED (S16: lists + SetEnemySpells + the classic touch/ranged AI; monsters' lists go live with their billboard-to-foe promotion) | EnemyEntity.SetEnemySpells + EnemyMotor | Systems arc (magic) |
| ~~OnMonsterHit special attack effects (audit F2 interim)~~ SHIPPED (S18 diseases + the rider table per landed hit; S19a closed the spider/scorpion Spider Touch paralysis cast; vampirism/lycanthropy stay routed) | FormulaHelper.OnMonsterHit + DiseaseEffect + Paralyze | Systems arc (disease/poison) |
| Enchantment to-hit channel (audit F4) | DaggerfallEntity.ChanceToHitModifier inside CalculateSuccessfulHit - 0 until enchanted-item effects exist; site flagged in formulas.js | Systems arc (enchantments) |
| Armor-value effect modifiers (audit F5) | Increased/DecreasedArmorValueModifier inside CalculateArmorToHit - 0 until their effects exist; site flagged in formulas.js | Systems arc (effect library) |
| PatchRegionIndex legacy-save fix | MapsFile - a workaround for OLDER DFU SAVES missing regionIndex in quest SiteDetails (goto-from-log searching Alik'r); consumes the DFU quest-save format, which this port never loads. Dead code until the quest machine defines our quest-save shape - ships WITH the quest machine if its save shape ever needs it (2026-08-16 assessment) | Systems arc (quest machine) |
| WorldDataReplacement / BuildingReplacement mod hooks | AssetInjection | Not planned (mod system) |
| TangentSolver / lightmap UVs | MeshReader | Not planned (Unity-specific) |
