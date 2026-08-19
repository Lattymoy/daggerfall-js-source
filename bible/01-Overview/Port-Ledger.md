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
| FaceUVTool arithmetic | JS doubles instead of C# float mix; (Int32) casts become Math.trunc. AUDIT 18 MEASURED THE COST for the first time, by compiling DaggerfallConnect's own FaceUVTool under Mono and dumping both sides over the whole ARCH3D corpus: **52,505 of 1,917,087 UVs (2.74%) differ from stock DFU**, each by a raw unit or two (1/16 texel). The departure stands - but 'validated against corpus' had never meant bit-identical, and now says so. A further **1,803 UVs still differ from DFU compiled AT MATCHED PRECISION** (float widened to double, reciprocal normalize): that residual is NOT explained by this row and is queued in C. | Documented in faceUVTool.js, measured against the C# in AUDIT 18 |
| Data access | Bytes in, objects out; no FileProxy/disk-usage modes | Runtime difference |
| Sky fill ABOVE the strip | A panorama returns two colours. `clearColor` is verbatim DaggerfallSky's `colors.west[0]` (getColor32 element 0 = the source image's HORIZON row); it is DFU's cameraClearColor/fogColor and drives the outdoor haze in both exterior hosts. `fillColor` is the ZENITH texel, painted on the region of our cylinder above the 220-row strip - DFU's screen-space layout has no such region (its clear colour fills BELOW the strip). Presentation-only; the parity value is never taken from the zenith. | AUDIT 18 (F2/F5) |
| Engine-internal randomness (terrain noise + nature scatter) | Ken Perlin reference improved noise (perlin.js) in place of Unity's Mathf.PerlinNoise, and umRandom seeded by the verbatim terrain key in place of UnityEngine.Random for nature scatter - neither engine PRNG is in DFU source; same role and statistics, different concrete samples; all pins pin our pipeline. The beach-line jitter and NextInt/NextFloat primitives are NOT departures - Unity.Mathematics Random is open MIT source and umRandom.js is a byte-exact 1:1 translation | APPROVED by Mac (option A, post-M9 audit): the substitutes are canonical for this port; bit parity with Unity engine PRNGs is out of scope |

| WebAudio playback engine (A1) | Unity AudioSource/3D audio -> WebAudio (PannerNode linear falloff, gesture-gated context, lazy 8-bit PCM decode). The DATA path stays 1:1: SoundClips indices, GetSwingSound pitch table, PlayHitSound roll families, EnemySounds attract shape (radius 16, delay 3..9, 80/20 bark/move, humans silent, attack 50%), door clips. |

## B. Verbatim quirks preserved (real-data reality)

Chargen:
- `characterDocument.isCustom` is assigned in exactly ONE place in the whole
  DFU codebase (`= true` on the Custom row,
  DaggerfallStartNewGameWizard.cs:358) and is never cleared. So opening the
  custom builder, cancelling out of it
  and then picking a standard class still ships a document marked custom: it
  gets the custom starting kit (ItemHelper.cs:1310) and the Spellsword spell
  set (StartGameBehaviour.cs:804-809), so a Mage picked that way starts with
  the Spellsword spells. The five reputation fields ride the same rule
  (:385-389, written only in the builder's accept arm). Reproduced
  bug-for-bug in ui/chargen.js `_acceptStandardClass`.
  (Added at AUDIT 18: that function's comment already said "recorded in the
  Ledger" and no such row existed - the 17m shape exactly.)

Characters:
- ENEMY BOOTS never reduce ArmorValues[Feet]. EnemyEntity.SetEnemyEquipment's
  armour pass is `for (int i = (int)EquipSlots.Head; i < (int)EquipSlots.Feet;
  i++)` (EnemyEntity.cs:414) - a STRICT `<` against Feet, and Head = 12 /
  Feet = 26, so slot 26 is never visited. DFU still rolls and equips the
  boots (ItemHelper.cs:1452-1457) and they still drop as corpse loot; only
  the armour-value pass skips them, leaving ArmorValues[Feet] at 100 before
  the class/monster clamp. To preserve it the port must skip Boots in the
  value loop ONLY - never in the roll, which consumes a Dice100 and a
  material draw from the stream. (Added at AUDIT 18, which found
  combat/enemyEquipment.js:131-139 subtracting boots there while its header
  called the pass verbatim: at plate steel that is Feet 55 against DFU's 60,
  and at daedric -5 against 60, a 65-point swing straight into
  calculateSuccessfulHit. The code fix is routed to the Combat lane of the
  same audit.)
- RandomEncounters.cs:580-599 carries a commented-out second Cemetery table
  ("Cemetery - DF Unity version"); the generated encounterTables.js is
  comment-stripped, so the port ships the 45 LIVE tables and not that dead
  block. (Added at AUDIT 18 - encounterTables.js:5 cited "Ledger B" for it
  and there was no row.)
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
  0.75). Preserved verbatim (restSession.js).
  AUDIT 18 deleted this row's second sentence, which claimed a 0-hour
  timed/loiter request rests ONE full hour in DFU "because hoursRemaining
  < 1 is only tested after an hour completes". That is backwards:
  DaggerfallRestWindow.Update (:215-227) is an else-if ladder whose
  `(currentRestMode != RestModes.FullRest) && hoursRemaining < 1` arm sits
  AHEAD of `TickRest()`, so DFU ends a 0-hour rest on the very next Update
  with the clock unmoved. The row was recording a port divergence as a
  preserved quirk, which is what kept it from being audited; the code fix
  is routed to the Systems lane of the same audit (restSession.tick must
  test `mode !== 'full' && hoursRemaining < 1` before the sub-tick loop).
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
| STATIC-NPC ACTIVATION, exterior side (AUDIT 18). `characters/exteriorNpcs.js` collectExteriorNpcs ports RMBLayout's non-zero-factionID rule and is pinned on the corpus, but NOTHING in `src/` calls it - its only importer is test/names.test.js - so no scene ever builds the exterior NPC registry and no exterior static NPC is a talk or activation target. The interior twin IS live (interiorContext.js:131 -> collectInteriorPeople). Wiring it means the exterior hosts (world.js, exterior.js) plus townTalk's activation targets, which is the four-hosts shape | RMBLayout static NPCs + PlayerActivate StaticNPC | Characters/UI arcs |
| Interior furniture actions, house-container CONTENTS, spawn points. (AUDIT 18 split this row: MakeHouseContainer's IDENTIFICATION half SHIPPED at S2b - systems/containers.js ports the modelId/100 == 418 or (modelId - 41000) in the 13-entry list rule with TextureRecord = modelId % 100, and interiorContext.js:114 consumes it. Shop shelves, owned-house everything-is-a-container and the Library/Guild/Temple bookshelves are still out.) | DaggerfallInterior AddFurnitureAction/MakeHouseContainer/AddSpawnPoints | Systems arc |
| FaceUVTool's 1,803-UV residual at matched precision | AUDIT 18: with DFU's FaceUVTool compiled under Mono, its float arithmetic widened to double (Ledger A row 18) AND Vector3.Normalize's reciprocal restored on the port side, 1,803 of 1,917,087 corpus UVs still differ. Not precision and not the normalize - cause unknown. The differential harness that measures it is re-runnable (scratchpad/diff). Sub-texel, so no visible defect is known | Readers arc |
| ~~Transition stingers: ladder climb, enter/exit~~ CLOSED as verbatim N/A (2026-08-17, re-verified at AUDIT 18: PlayerEnterExit.cs contains no PlayOneShot and no SoundClips reference, DaggerfallLadder.cs likewise - there is no source law to port). Door open/close SHIPPED in A1 for the DUNGEON host (DungeonDoorOpen/Close) and at AUDIT 18 for the BUILDING-interior host, which takes DaggerfallActionDoor's other clip pair, NormalDoorOpen/Close, wired inside interiorContext so both interior hosts get it; action PlaySound SHIPPED in A2, dungeon host only - onActionSound is assigned in dungeonContext and nowhere else. The ACTIVATION half did NOT deflate with the stingers and moved to the lockpicking row below | DaggerfallActionDoor, DaggerfallAudioSource | Audio arc |
| SetGlobalVar (0x1f) action delegate - the ONE RDB action flag with a real DFU body that this port does not run. Its cascade fires; the variable is not set. (AUDIT 18: actionSystem.js used to file it beside Activate as "a verbatim no-op", which was false - Activate's body IS `return;`, SetGlobalVar's is not) | DaggerfallAction.SetGlobalVar -> PlayerEntity.GlobalVars.SetGlobalVar(ActionAxisRawValue, true) | Systems arc (quest machine) |
| Per-light interior light INTENSITY and COLOUR (AddLight's second per-record switch: e.g. record 0 intensity 1.1 / (0.95, 0.91, 0.63), record 5 intensity 0.33, records 24-27 intensity 1.4). Every interior light shares one uniform colour, so this needs a per-light colour channel in the light uniform. The RANGE half of that same switch SHIPPED in AUDIT 18 (interiorLights.RECORD_RANGES) and rides the per-light range array nearestLights already accepts - the two interior HOSTS (worldModes.js, interior.js) still pass the scalar INTERIOR_LIGHT_RANGE and must pass `ctx.lights.map((l) => l.range)` for it to reach the shader | DaggerfallInterior.AddLight | Rendering arc |
| ~~Enemy AI + mobile animation~~ SHIPPED (C8: enemyMotor/enemyAttack/rigs end to end; row pruned by the 2026-08-14 audit) | EnemyMotor, MobileUnit | Characters arc C5 (spawn data + classic standing billboards shipped C3) |
| ~~Dungeon treasure piles + loot~~ SHIPPED (S-series loot tables + corpse/pile takeLoot; row pruned by the 2026-08-14 audit) | RDBLayout AssignFixedTreasure/AddRandomTreasure | Systems arc |
| ~~Torch audio sources~~ SHIPPED (A2, dungeon scene; exterior/interior torches join with their scenes' audio wiring) | RDBLayout.AddTorchAudioSource | Audio arc |
| ~~Non-movement RDB action flags: CastSpell, Hurt21-25, DrainMagicka~~ SHIPPED (S4b + the trap seam; the Poison action (0x1a) is a VERBATIM NO-OP - DFU's own delegate body is empty, ported as such; entity poisons themselves shipped in S19b) | DaggerfallAction delegates | Combat arc (magic/damage) |
| ~~Non-movement RDB action flags: ShowText, ShowTextWithInput, DoorText~~ SHIPPED (U6 on the audit's relay spine: the 8600/5400/7700 records, the verbatim riddle-answer chain gate, the DoorText door hold + patch table; TEXT.RSC live) | DaggerfallAction delegates | UI arc + Systems |
| ~~Non-movement RDB action flags: Teleport, Activate, LockDoor, UnlockDoor, OpenDoor, CloseDoor~~ SHIPPED (MERGED 2026-08-16, two lanes reconciled: the audit's self-targeted verbs + special doors + door bashing + lock values; P10's Teleport jump with per-block destination resolution, the IsLocked player gate + LookAtInteriorLock tiers, and the repeated-block key namespace) | DaggerfallAction delegates + DaggerfallActionDoorSpecial + AttemptBash | Player/Combat |
| Door lockpicking (steal-mode activation, the failed-skill-level latch; the IsLocked gate + bash + the lock-level text SHIPPED in the merge; the successful pick plays SoundClips.ActivateLockUnlock = 316, which AUDIT 18 moved here from the transition-stingers row - it is in neither soundClips.js nor any consumer, and it must land from BOTH door paths, the interior/dungeon DaggerfallActionDoor seam and PlayerActivate.cs:556's exterior steal-mode unlock) | DaggerfallActionDoor.AttemptLockpicking + PlayerActivate.cs:556 | UI arc (interaction modes) |
| FLC constellation animations (ROGUE/MAGE/WARRIOR.CEL) + the Ignite one-shot riding the answer (U18: the questions screen advances immediately where DFU waits out the CEL; the palette brightening itself is live) | CreateCharClassQuestions FLCPlayer + PlayOneShot | UI arc (a FLIC decoder slice) |
| Pixel-clipped question-scroll text (U18 draws only rows that fit the text window WHOLE; a row pops instead of shearing at the boundary) | MultiFormatTextLabel RestrictedRenderArea | Rendering arc (a scissor seam for UI draws) |
| Mouse-wheel scroll on the question scroll (U18: the click margins - one pixel per event - and the arrow keys stand in) | CreateCharClassQuestions OnMouseScrollDown/Up + GetUIScrollMovement | UI arc (the hosts' overlay wheel seam) |
| The custom builder's HIDDEN ResetBonusPool control (U20a: a DFU-added convenience on a rebindable shortcut, not a classic control - it zeroes the freeEdit pool outright. The port has no keybinding registry to hang it on, so it is recorded rather than invented) | CreateCharCustomClass resetButton + DaggerfallShortcut.Buttons.ResetBonusPool | UI arc (a keybinding slice) |
| The difficulty dagger's fading TRAIL (U20a: AnimateDagger's one-second alpha fade behind the moved dagger; the dagger itself lands on the verbatim pixel) | CreateCharCustomClass.AnimateDagger | UI arc (a per-frame UI tween seam) |
| CAREER FLAGS NOTHING READS YET. Not a custom-builder-only set, despite the U20b framing this row used to carry: AUDIT 18 decoded all 18 shipping CLASS*.CFG and CLASS09 (Acrobat) ships abilityFlagsAndSpellPointsBitfield 0x1406 (athleticism bit 2 + adrenalineRush bit 4) and CLASS03 (Sorcerer) 0x8 (noRegenSpellPoints), so these flags reach players who never open the custom builder. LIVE today: Increased Magery (maxMagicka reads the multiplier), the tolerance quartet (spellcast.js resistance/immunity/low-tolerance/critical-weakness), Rapid Healing (rest.js), Inability To Regen Spell Points, Athleticism's jump multiplier (AUDIT 18 - skills.js jumpSpeedMultiplier +0.1, AcrobatMotor.cs:96-98), and Bonus to hit / Phobia - which AUDIT 17n fixed on the attacker side and AUDIT 18 completed on the target side, so it is now live on the player's swing, on an enemy attacking the player, and with DFU's TWO discriminants (affinity for the Humanoid arm, GetEnemyGroup() for Undead/Daedra/Animals). INERT, because the consuming subsystem does not exist: Spell Absorption, Regenerate Health, Acute Hearing, Adrenaline Rush, Damage From Sunlight/Holy Places, Expertise In, Forbidden Weaponry, Forbidden Armor Type, Forbidden Material, Forbidden Shield Types - plus Athleticism's OTHER arm, PlayerEntity.cs:388-405's 0.9 fatigueLossMultiplier, which needs the per-minute fatigue drain that today runs only in the dungeon host. The flags are written correctly and persist through save; they simply have no reader. Each lands with its own arc | CreateCharSpecialAdvantageWindow.ParseCareerData + AcrobatMotor.cs:96-98 | Their own arcs (items/effects/regen) |
| The secondary picker's CANCEL path (U20b: DFU pushes the half-built item onto the list BEFORE opening the secondary window and pops it again on cancel - CreateCharSpecialAdvantageWindow :417-420, :439-442. The port never pushes it, so a cancel is simply dropping the pending primary. Same end state; the port has no frame in which a redraw could catch the transient half-item, and its label block would have drawn a bare primary with no secondary) | SecondaryPicker_OnCancel + PrimaryPicker_OnItemPicked's else arm | Kept (end-state-verbatim) |
| The rep window's STALE BAR quirk (U20a: a click exactly on the middle line zeroes the value but re-enables neither bar, so classic leaves the previous bar drawn beside a 0 label. The port derives its bars FROM the value, so it cannot show one; the VALUE is verbatim) | CreateCharReputationWindow.UpdateRep | Kept (value-verbatim) |
| ~~Platform riding~~ SHIPPED 2026-08-14 (groundKey contact identity + mover frame deltas through the resolver - the DFU MoveWithMovingPlatform shape; rooted Mac's out-of-bounds ejection report) | DFU parents the player transform | Player arc |
| ~~Swimming + levitation motor~~ SHIPPED (P11: + the swim toggle, the Levitate (14,255) buff end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) | LevitateMotor, GetSwimSpeed | Player arc |
| ~~Breath/drowning + crouch motor~~ SHIPPED (P12, un-struck until AUDIT 18 found live code sitting inside this row's "not yet ported" exemption: dungeonContext.js breathTick is PlayerEntity.cs:322-343 verbatim - the +76*GlobalScale-0.95 head-under test, the `currentBreath == 0` refill from MaxBreath = (END/2), the `breathUpdateTally > 18` drain, SetHealth(0) at <= 0, the surfacing zero; hud.js draws HUDBreathBar with the (LiveEndurance >> 3) + 4 threshold; save.js persists currentBreath; motor.js ships controllerCrouchHeight 0.9 with the headroom-gated stand-up) | PlayerEnterExit, AcrobatMotor | Player arc |
| RESIDUE of the P12 row above, genuinely unported: (1) the crouch/stand TIMED transition - PlayerHeightChanger lerps the camera over timerMax 0.1s and flips IsCrouching only at the END of the timer (:246-262), where the port toggles instantly; (2) the Argonian breath refund, `if (Race == Races.Argonian && UnityEngine.Random.Range(0, 2) == 1) ++currentBreath` (PlayerEntity.cs:332), whose in-code note still blames race selection though races shipped at U9; (3) GuildManager.DeepBreath's guild bonus on the refill, which pends guilds | PlayerHeightChanger, PlayerEntity.FixedUpdate, GuildManager.DeepBreath | Player arc |
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
