# project-dagger

A 1:1 JavaScript port of Daggerfall, built the way we build: hand-rolled WebGL2, Vite, Node ESM, no framework. Data layer and game logic ported faithfully from Daggerfall Unity's reverse-engineered C#; presentation rebuilt on our stack; characters rebuilt on our voxel system.

Read `01-Overview/Port-Doctrine.md` before touching anything.

## Process

Doc edits are part of the change: every scripted bible edit must ASSERT
the needle matched (a silent `.replace` no-op shipped a stale
Rendering.md queue in the M6 audit and was only caught in the M7 audit).
Verify doc diffs in `git diff` before committing, same as code.
Sprite-orientation checks must compare close-up render crops against
the raw record art - a distant screenshot passed a vertically flipped
billboard shader for six milestones (caught by Mac after M8).
Playwright probes of the live frame loop must frame-sync on the
shot-mode __frame counter, never sleep - SwiftShader renders the
streaming scene at seconds per frame, so sleeps sample stale state
(M9 audit probe initially reported zero crossings for a real flight).
Unity asset values (prefab lights, AnimationCurve keys) are groundable
without widening the sparse clone: git show HEAD:Assets/Prefabs/....prefab
reads the YAML from the object store (used to verify the R5 constants).
When a renderer change diffs against a baseline and theory stalls,
build a screen-projection ground-truth probe: rebuild the scene's data
+ exact camera in Node, project known world points to screen, and read
the framebuffer pixels - single far pixels are rounding-limited, so
verify laws on NEAR tiles (a shot-mode override hook can force test
bytes). The R9 HLSL-row-major/GLSL-column-major transpose was only
provable this way. But probes verify what they sample: R9 initially
shipped with every building missing because the probes only ever read
terrain fragments - when a diff spans a large frame fraction, check
full-frame composition (every draw pass still present?) before
explaining the diff away. Draw entry points must own their program
binding; interleaving a new pass exposed drawMesh's assumption.
THE FOUR HOSTS RULE (17e). Four files own a motor:
scenes/exterior.js, scenes/world.js, scenes/worldModes.js
(interiors), scenes/dungeonContext.js. A slice wiring a seam into
one must NAME ALL FOUR in its record - each either wired or FLAGGED
by name. U8h enumerated "both exterior hosts" and flagged the
dungeon; the interior host owns a fourth weapon rig and went
unmentioned, so buildings still swing the interim dagger. The same
omission produced the missing FOV gate and the unshifted guards in
?world.

THE MODAL CONTRACT (17e). A function whose return value gates a
host frame must return the same type from EVERY exit. One branch of
ten in worldModes.frame() returned undefined; the hosts read that
as "not handled" and ran a whole exterior frame on top of the
dungeon. Assert the contract in a test, not a comment.

ONE DFU MEMBER, ONE EXPORT (17e; restated after U8f's near-miss and
violated by the very next slice). Before porting a DFU class or
method, grep the tree for its name AND its constants. U8h rebuilt
GetMaterialArmorValue in systems/equip.js and drifted; droppedLoot.js
re-declared the treasure table the 2026-07-06b audit had already
single-sourced. If two files legitimately need it, one exports and
the other imports - never two literals.

A PIN MUST FAIL (17e). Every assertion claiming to pin a DFU law
must fail under a one-character mutation of that law. Three shipped
pins did not: `assert.ok(bows >= 8)` survives promoting any weapon
to two-handed; `Math.trunc((100-55)/5) === 9` touches no port code;
and `ANSWERS_TO_DIRECTIONS[15] === 7261` certified the WRONG table
and would have blocked its own fix. Prefer deepEqual against DFU
literals over spot checks and inequalities, and mutation-check new
pins.

TEST THE SHAPE THE PRODUCER MINTS (17e). A test that hand-builds an
item/entity literal can pass while nothing in the running game
satisfies it. Three suites asserted on `{ enchanted: true }` - a
property no producer writes - so the enchanted paths were dead in
the shipping game and green in CI. Build fixtures from the real
producer, or assert the producer's own output.

ASYNC NEVER DROPS (17e). DFU is synchronous; where the port awaits,
a request arriving mid-flight must be COALESCED, never discarded.
refreshPaperDoll's boolean re-entrancy guard silently threw away
equip updates, leaving the doll and its click mask stale.

EVERY ALLOCATION HAS AN OWNER (17e). DFU relies on Destroy/GC; the
port does not. Every createBillboardBatch / uploadTexture needs a
matching free in the owning module's teardown, and that teardown
must be reachable from the path that ends the object's life.

RETIRING A FLAG DELETES THE SENTENCE (17e). When a slice closes an
INTERIM/FLAGGED site, remove the old sentence - do not append the
retiring one beneath it. The open-flags list is grep-regenerated
and lifts stale half-sentences out of their retiring context.

THE NATIVE-WINDOW RULE (from the 17d UI audit, after three
positioning hotfixes in two days): every drawn element of a native
window - rect, font, color, scale, alignment - must cite its DFU
source (file + member) before it ships; no free-styled geometry. If
the DFU value is unknown, the element does not draw until it is
looked up. And native-window screenshots are eyeballed against the
CLASSIC layout (the art's own frames are the ruler - an icon
crossing a baked slot border is a positioning bug even when the
code "looks right").

**THE ONE CONSTRUCTION SEAM** (AUDIT 17i). When two hosts build the
same object, every dependency it grows must be remembered twice - and
one of them will forget. The chargen flow proved it three times over
three audits. A shared thing gets ONE constructor that attaches
everything; hosts call it and never `new` it themselves, and where the
rule matters a test SWEEPS THE SOURCE to enforce it rather than
trusting the next author to recall it.

## Sections

- `01-Overview/` - vision, port doctrine, phase plan, Port-Ledger (departures/quirks/unported)
- `02-Formats/` - binary format readers (BSA, TEXTURE, IMG/CIF, ARCH3D, BLOCKS, MAPS, SND, SKY)
- `03-World/` - block assembly, terrain, location layout, streaming
- `04-Characters/` - voxel rigs, paperdoll-as-outfits, NPCs
- `05-Combat/` - FormulaHelper port, weapons, hit resolution
- `06-Systems/` - quests, items, magic, guilds, calendar, save format
- `07-Rendering/` - WebGL2 renderer, palettes, lighting, sky
- `08-Audio/` - music (HMI/XMI), sound effects, audio state machine
- `09-Testing/` - test doctrine, harnesses, data validation
- `10-UI/` - HUD, menus, native Daggerfall UI reproduction

## Active arcs

- `02-Formats/Readers-Arc.md` - COMPLETE. All 8 format readers shipped with corpus gates.
- `03-World/World-Arc.md` - ACTIVE again: TOWNS. M1-M9 COMPLETE + T1 THE WANDERING POPULATION (2026-08-17: CityNavigation's automap-carved weighted navgrid - the per-block row flip proven against the rendered tilemap - MobilePersonMotor's road-following seek + the verbatim politeness idle, PopulationManager's 10Hz pool with anti-skate/night/view-gated pop-in, the verbatim race texture tables; townsfolk probed walking Daggerfall's streets, the closeup identical to raw 386/5) SHIPPED + T2 THE STREAMING MOUNT (2026-08-17: per-location-pixel pools in ?world with the verbatim StreamingWorld location-type gate, persons in the location frame converted through the live floating-origin translation, batches destroyed with their pixel; probed live at Daggerfall city center - the politeness idle on the fly cam, archive 456 identical to raw 456/5) SHIPPED + T3a THE TALK FOUNDATION (2026-08-17: FACTION.TXT verbatim - 366 factions, the tab-stack tree, ruler seeds in classic call order; findFactions/People-of-region/getReactionToPlayer verbatim; pickpocket with the 5..95 clamp, gold/nothing/caught outcomes and the crime state - guards FLAGGED to the crime slice) SHIPPED + T3b THE TALK WINDOW + ACTIVATION (2026-08-17: F1-F4 interaction modes, the person-cylinder activation ray at 6.4/3.2, the reaction greeting ladder 7206-7209 with %pcf/%oth macros through the real TEXT.RSC, the shared townTalk seam in BOTH exterior hosts - their first HUD-text layer; probed live: "Yes?" in the panel, "You pinched 1 gold piece." on the HUD) SHIPPED + THE T3-TOUCH ADDENDUM (2026-08-17: the phone path - a live-labeled mode-cycle button on the touch row driving the verbatim NextInteractionMode wrap, E doubling as goodbye while the window is open; hasTouch-probed: grab -> info -> dialogue taps + E open/close live) SHIPPED + G1 THE CITY WATCH (2026-08-17: the crime circuit closes - SpawnCityGuards verbatim (guard NPCs first, behind-player civilians 1/4, the 2-5 ring fallback, max 5, the witness/countdown path), Knight_CityWatch class foes as the FIRST exterior foes on the C11 stack in both hosts, the GiveUpTimer hostility law joining EnemyAI generally (detection refills 200 classic ticks; MakeEnemyHostileToAttacker pre-loads x3), combat both ways + HALT + corpses; probed live: a ring guard marched 30 units, detected, and swung - the close-up crops the classic plate knight 399) SHIPPED + G2 ARREST + COURT (2026-08-17: the crime loop completes - the EnemyAttack interception withholding the first guard hit for the surrender box, SurrenderToCityGuards' SetHealth(1)/rep gates/DFRandom coin, the DaggerfallCourtWindow math verbatim incl. THE NEVER-CHARGED VERDICT QUIRK, sentence rep raises, the crime-clear stand-down; probed end to end: box -> Y -> court -> G -> crime 0, LegalRep -2, guards gone) SHIPPED + T3c WHERE IS (2026-08-17: GenerateBuildingName verbatim over the full classic name lists, the named-building pool merge with per-instance door resolution, the 30-record answer table + the NPC-stable reaction tier + the %hnt/7333 hint chain with the verbatim 8-way compass; probed live - 62 named Daggerfall buildings, a tier-0 commoner refusing rudely; the streaming-host directory FLAGGED as the follow-up) SHIPPED + AUDIT 2026-08-17c (the guards/court/where-is parity pass - five findings fixed with pins: the subrecord-bounded pool merge, the overlay callback clear, the Dodging tally, the seen-by-guard mass conversion, the court macro expansion; see Audits) + T3d THE STREAMING WHERE-IS (2026-08-17: the T3c host-rule debt clears - a location-pixel tracker swaps townTalk's topics on pixel crossing, doors + player resolved in the pixel's LOCATION frame through the floating origin (pure translation, answer-invariance pinned), names on the pixel's OWN region; found on the way: buildingDoors leaked on destroyPixel - fixed; probed live: the same 62 Daggerfall names as the fixed host, E -> W -> Alchemists -> a classic answer) SHIPPED + G3 CORPSE LOOT (2026-08-17: killed guards are E-ray pickup targets on the dungeon's S2 shape in both hosts (walk-aways vanish with their items); THE PARITY FIND - Knight_CityWatch has no LootTableKey in DFU, the droppable loot is the EQUIPMENT via Items.AddItem, ported as equipmentItems() and ALSO fixed in the dungeon where class-foe corpses had dropped no equipment since E4b; probed live: Longsword + 5 armor pieces off a corpse, no double takes) SHIPPED + T3e THE KNOWLEDGE ROLL (2026-08-17: GetNPCKnowledgeAboutItem verbatim - seeded by NPC hash + MakeBuildingKey ((x<<16)+(y<<8)+record, 0 -> 1<<24), the 40-entry knowledgeModifiers table, rand(1,20) <= mod+10; the doesn't-know half of answersToDirections is REACHABLE now, seed-stable per (NPC, building); pinned over 200 seeds + probed) SHIPPED + T3f TONE BUTTONS (2026-08-17: GetReactionToPlayer_0_1_2 in FULL - the etiquette/streetwise mod tables with the Merchants fold, the Dice100 skill roll -10/+5, the per-session reaction cache + first-use tally + the lastToneIndex recompute gate, tone persisting across sessions; one T key cycles the three DFU buttons with a live label; probed live - a Blunt re-ask at reaction 30) SHIPPED + G4 MURDER + ASSAULT (2026-08-17: the crime table's teeth - a weapon strike one-hit kills a wandering civilian (Murder + the response), a wandering guard NPC converts on the spot (Assault) with the swing carried onto the fresh foe, killing the watch is Murder on the real death path; WeaponManager/HandleAttackFromSource verbatim in both hosts; probed live - swing four connects, crime 5, two guards march in) SHIPPED. Next: the 35% map-reveal, %hnr/%ra literals, or a fresh arc (economy/guilds/riding - Mac's call welcome).
- `03-World/Player-Arc.md` - ACTIVE again. P1-P9 + P10 TELEPORTERS + DOOR LOCKS (the delegates verbatim, RDB starting locks + look-at-lock tiers, flat/marker actions joining the graph, the repeated-block action-key collision fixed) + P11 SWIM/LEVITATE (2026-08-16: the LevitateMotor path with GetSwimSpeed and the surface clamp, the swim toggle + splash, Levitate (14,255) end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) + P12 BREATH/CROUCH (2026-08-16: MaxBreath = END/2 with the classic-update drain every 19th tick and SetHealth(0) drowning at the 76*GS head-under threshold, WaterBreathing (30,255) gating it, the verbatim HUDBreathBar; crouch 0.9/0.8 on the KeyX edge in both hosts with crouchSpeed, a per-call collider capsule height, and the CanStand ceiling probe) + P13 STEALTH (2026-08-16: the oldest src flag closes - the classic detection flow with hearing gated on prior detection, the once-per-minute StealthCheck with spawn-band gating/odd-minute sneak skip/fast-move auto-detect/the shared Stealth tally, and the verbatim illusion gate with the 13 sees-through monsters - retiring the S8 half-sight interim, which had been DEAD post-merge) + P14 MOVEMENT PARITY (2026-08-16: the live jump/incline report - Mac's reverted b9e9aa6 re-derived on the crouch-height tree: final-vertical-state grounded truth un-killing the one-frame jump, the ascending step-lift ladder with the monotone ceiling sweep and the no-depenetrate-into-ceiling clamp, slopeLimit-70 pinned 60/78; plus the verbatim jump laws - the 0.1s GroundedTime gate with HELD jump input, jumpSpeedMultiplier via Jumping skill, crouched x0.8, the moving-jump forward boost, frozen airborne momentum, HitHead reversal - and CheckFallingDamage end to end with sounds 91/92 in all four motor hosts, slowfall to the verbatim -105*dt law) + P15 SNEAK (2026-08-16: AltLeft held per DFU's default - the grounded-only run/sneak latch, running beats sneaking, base/2 - 1/39.5, swim ignoring both verbatim; IsMovingLessThanHalfSpeed now TRUE while sneak-moving, so the P13 stealth checks apply to a MOVING player) + P16 THE FIXED PHYSICS TIMESTEP (2026-08-17 live hotfix: update() accumulates render dt and steps at 1/60 with the 0.25 jank clamp - Unity FixedUpdate IS the missing parity law; real-mesh traces proved the deployed motor failed real staircases and collapsed jumps at phone frame rates while being correct at 60; + the ceiling entry-clamp firing only on residual penetration and the ladder capping rungs at resolved height) + P17 FOE-AI FIXED STEPPING (2026-08-17: the P16 accumulator law on EnemyAI - the whole body, senses cadence + physics, steps at 1/60 with the 0.25 jank clamp; a 10fps foe pursues bit-identically to a 60fps foe; urgent once C11 put ~29 raw-dt foes in every dungeon on the deployed mobile build) SHIPPED. Next: riding (the monster pivot shipped as Combat C11).
- `04-Characters/Characters-Arc.md` - PARKED (pivot 3: classic visuals). C8 shipped E1-E4b end to end + spectral; E4c deferred by Mac; remaining interims are Systems work (ledger below).
- `05-Combat/Combat.md` - ACTIVE again. Core via C8; Hurt traps, CastSpell (S4b), bows both directions, the collision-trigger seam (input-held gate, 08-16), the Attack trigger + door bashing (WeaponEnvDamage, 08-16), the TRUE classic FP weapon + its six-finding parity audit (08-17, the parallel lane) + C9 THE HOST ROLLOUT (2026-08-16: combat/weaponRig.js mounts the audited weapon surface in the interior mode and BOTH exterior walk hosts - RMB drag/click, Z sheathe per mode fixing the interior Z crash, envAttack bashing interior swing doors, bows consuming arrows; dungeonContext's inline copy folds onto the rig when the FP lane settles - recorded) + C10 THE RIG FOLD (2026-08-16: dungeonContext's inline weapon collapses onto weaponRig - one home for the audited surface, the env ray now the shared envAttack, the rig canvas late-resolvable; parity-positive deltas: the weapon exists in foe-less dungeons and the listener/ambient pass un-gates - it had sat inside `if (playerWeapon)` and foe-less dungeons silently lost 3D audio since A2 - and the touch tap gains the sheathed gate) SHIPPED + C11 THE MONSTER PIVOT (2026-08-17: monsters 0-42 go LIVE - classic 8-orientation sprite mobiles (characters/mobileUnit.js, DaggerfallMobileUnit/EnemyBasics verbatim: the record layout, the signed-angle orientation law, attack sequences with the -1 damage marker + chance-rolled variants, hurt one-shots, the rat/ghost/wraith/slaughterfish/scorpion quirks, the Ancient Lich frame rescale) on the SAME combat spine as the class enemies - EnemyAI/EnemyAttack/entity/loot/S16 spells/S18 riders/corpses; one live billboard batch per foe over dataPipeline.uploadRecordFrame; foes DEFAULT ON in all hosts; THE BILLBOARD-AXIS DOCTRINE ground-truthed - DFU's flip booleans are correct only under the hosts' flats axis (the negated view row), the raw view row moonwalks every side view; cast/ranged anims + Seducer pend) SHIPPED + C12 THE BEHAVIOUR MOTORS (2026-08-17: CanFly = Flying|Spectral - imps/bats/harpies/ghosts/wraiths pursue in 3D at the target face with NO gravity, hover at spawn, floor-skim guard; Aquatic = WaterMove verbatim against the P11 block water surface - the 2.5 head margin, beached fish FROZEN; paralysis through the motor: flyers fall out of the air, swimmers freeze; flyer corpses land) SHIPPED + C13 HOST ARROWS (2026-08-17: combat/arrowFlight.js - the visible loose in worldModes interiors + both exterior walk hosts, the 99800 model on the S5 constants, lost on geometry/terrain as DFU misses are; the dungeon keeps the full seeking+recovery path) SHIPPED + C14 THE MONSTER SPELL ANIM (2026-08-17: the 13 casters play SpellAnimFrames - records 20-24 for the Orc Shaman via HasSpellAnimation, the primary records for the rest, verbatim GetStateAnims incl. no ghost/wraith special; attack>cast>hurt interrupt laws pinned; RangedAttack1/2 closed as class-enemy-only) SHIPPED + C15 KNOCKBACK (2026-08-17: WeaponManager speed formula floored at 15 classic + the Weight>0 gate - spectrals immune - and KnockbackMovement on the fixed step: shove along the attack ray, 25-cap/5-decay, hurt rides the threshold NOT the hit, flyers knocked out of the air; the C11 per-hit hurt retired) SHIPPED + C16 THE -1 DAMAGE MOMENT (2026-08-17: mobile melee damage lands on the sequence markers - the Frost Daedra base swing strikes TWICE - via the extracted resolveFoeMelee; the machine stays the decision clock + the rigs' damage clock) SHIPPED + C17 THE HUMANOID PIVOT (2026-08-17: class enemies render as classic sprite mobiles - FemaleThiefIdleAnims verbatim, the RangedAttack1 archer state with the -1 shootFrame loose, the 475 female cast scale, gender-picked archives; the voxel foe rig ON ICE beside the voxel FP weapon; entity spine unchanged; doctrine-proven vs raw 484/19) SHIPPED. Next: economy/enchantments, towns, or riding.
- `08-Audio/Audio.md` - ACTIVE. A1 + A2 (2026-08-16: action PlaySound on every Play, torch Burning loops at 5m linear/0.7 via the new loop3d engine seam, animal random barks on the classic rand()<=100 cadence at 19.2m - dungeon-scoped) + A3 SCENE AMBIENCE (2026-08-16: AmbientEffectsPlayer verbatim - the 14 dungeon one-shots somewhere-around on the scene's serialized 5/28 waits + classic-cadence water/bubbles, the weather/time presets in BOTH exterior scenes on 5/25 with rain/crickets loops and horizon storms, one shared ambient channel; building interiors silent, verbatim) SHIPPED + A4 EXTERIOR ANIMALS (2026-08-17: the shared PlayRandomlyIfPlayerNear pass - systems/animalAmbience.js, one implementation for dungeon + both exteriors incl. the streaming world's floating-origin sources; exterior torches SILENT verbatim - Burning is RDBLayout-only in DFU) SHIPPED; transition stingers CLOSED verbatim-N/A (2026-08-17: DFU plays nothing on enter/exit or ladders - no source law to port). Next: music strategy (Mac's call) - the queue's last row.
- `06-Systems/Systems-Arc.md` - ACTIVE. S1-S16 + S18 DISEASES (2026-08-16: the 17-row DiseaseData table byte-exact, the daily tick over the classic day with statMods through liveStat and RAW FAT/SPL drains bug-for-bug, InflictDisease's level-1 immunity + full-save resist + no-double-catch, Heal{Attribute} healing disease damage without curing, and the OnMonsterHit rider table wired per landed hit at the FormulaHelper.cs:662 seam - rat/bat/zombie/mummy/vampire rolls, nymph/lamia fatigue x2 x64, specials routed) + S19a PARALYZE (2026-08-16: (0,255) with AssignBundle's exact chance/save gate order incl. the AddState-first re-cast quirk, the spider/scorpion Spider Touch free-cast rider closed, the full IsParalyzed consumer set - player input/jump/weapons in both hosts, foe motor+attack freeze; plus the classic subType BYTE-CAST parity fix: 0xFF reads -1 and the 255-keyed doors never fired from real records) + S19b POISONS (2026-08-16: the 12-variant enum + timing tables byte-exact, minute-tick lifecycle Waiting/Active/Complete with drug positives stripped at the crash and attribute damage persisting until healed, InflictPoison's career-immunity/save/level-1 gates, the ItemHelper weapon-poison spawn roll + the inflict-once-and-clear formulas seam at both enemy-vs-player sites) + S19c CURES (2026-08-16: (3,0..2) chance-gated instants - CureAll* as IMMEDIATE bundle removal lifting disease/poison statMods now, CureParalyzation ending the incumbent instantly, the AssignBundle failure messages on player hosts) SHIPPED - the S19 group (Paralyze/poisons/cures) is CLOSED - + S20 EXHAUSTION/REST (2026-08-16: the three per-hour recovery rates verbatim incl. RapidHealing/NoRegenSpellPoints decodes, the OnExhausted collapse - a safe hour of rest vs death near enemies or in water, fed by the P13 senses fields - and the once-per-minute-change fatigue-drain parity fix) SHIPPED (the rest UI consuming the rates is U7, the UI arc) + S21 CONCEALMENT (2026-08-17: Invisibility 13,0/13,1 + Shadow 24,0/24,1 + Chameleon true 23,1 - the P13 gate's inert branches go LIVE, normal/true folding per IsInvisible/IsBlending/IsAShade, the verbatim Illusion costs, start messages once on new incumbency through the sinks.say seam; with P15 sneak the full illusion-stealth play works; foe-side visuals pend) SHIPPED + S22 FREEACTION (2026-08-17: (26,255) Restoration duration buff on the generic incumbent branch; the READ-TIME immunity fold - IsParalyzed = !immune && paralyzed, a covered paralysis ticks underneath and RESUMES - and the AssignBundle silent drop of incoming Paralyze; career/racial immunity FLAGGED to the tolerance decode) SHIPPED + E1 THE SHOP FOUNDATION (2026-08-17: the economy arc opens node-pure - DFU's ItemTemplates.txt baked whole (288 rows) + the per-group enum arrays with ItemBuilder's material value laws; StockShopShelf verbatim (the eight pair tables, the rarity/Dice100 stock law, the no-dice book ladder, horse+cart, the gender swap) + RMBLayout.IsShop + the 27-model shelf set for E2's mount; CalculateCost verbatim with the lazy 750..1250 regional band; MagicItems/potion-recipe/book-file-pricing/restocking INTERIM loud) SHIPPED + E2 THE SHELF MOUNT (2026-08-17: the E1 laws go LIVE in the interior mode of both hosts - buildingDataForDoor resolves the entered door through the pool merge to type/quality/name, interiorContext collects the shelf set in DFU's chain order (parity fix: 41035/41037 were wrongly S2b house containers), E on a shelf in an IsShop stocks lazily and opens the keyed browse window with live CalculateTradePrice prices, digit-buys deduct gold into the entity; the modal-__frame probe-starvation fix; probed live - entered "The Adventurer's Book Dealer", bought a 2950-gold book; selling/haggle-UI/open-hours/bookshelves FLAGGED) SHIPPED + E3 SELLING (2026-08-17: the trade circuit closes - storeBuysItemType verbatim gating the S sell mode per storefront, the selling-branch offer over CalculateCost*stack, proceeds via addGold with sold goods landing on the OPEN shelf (buy-backs work), Mercantile tallying once per trade both directions; probed live - the bookseller round trip, buy 3062 / sell back 2904; haggle UI/letters of credit/Repair/Identify FLAGGED) SHIPPED. Next: shop open hours, enchantments, or banking.
- `07-Rendering/Rendering.md` - COMPLETE again. R12 THE EXTERIOR INDIRECT PLAYER LIGHT (2026-08-16: the SunlightRig point light from the serialized prefab - 1.0/range 150/0.706 gray - daylight-scaled at the player across all four lit programs, shot-proven near-ground brightening with a byte-identical sky). Queue EMPTY.
- `10-UI/UI-Arc.md` - ACTIVE. U1-U5 + U6 THE ACTION TEXT BOXES (2026-08-16: ShowText 8600 / ShowTextWithInput 5400 with the verbatim riddle answers gating ActivateNext / DoorText 7700 with the patch table and the first-activation door hold; TEXT.RSC live), input map, CLICK-TO-CAST SHIPPED, U7 THE REST WINDOW (2026-08-16: KeyR, timed/full/loiter on the S20 per-hour rates, 354/355 pre-gates, enemies break rest live under the overlay) + U8a THE NATIVE PANEL (2026-08-17: Mac's call - real classic art begins; ui/nativePanel.js = DFU's virtual 320x200 with integer-scale letterbox, IMG loads, the verbatim shadowed-label idiom (243,239,44 / 93,77,12 +1,+1), pointToNative for touch; the CHARACTER SHEET is the first native window - INFO00I0.IMG with DaggerfallCharacterSheetWindow's verbatim label geometry, encumbrance over floor(Str*1.5), keys 1-4 skill popups, F5 in BOTH exterior hosts (host rule; was dungeon-only), text fallback never traps; probed + eyeballed - the real stone page with every label in its engraved field) SHIPPED + U8b THE NATIVE TALK WINDOW (2026-08-17: TALK01I0.IMG replaces the ChoiceWindow talk chain in both hosts - DaggerfallTalkWindow's verbatim rects with the labels baked in the art, the topic list + bottom-anchored conversation panel, tone radios; POINTER ROUTING lands - townTalk.pointerdown maps taps/clicks through pointToNative before requestLook, phone and desktop on one seam, keyboard accelerators kept; the T3-T3f session pipeline unchanged underneath; probed by MOUSE CLICKS end to end + eyeballed) SHIPPED + U8c THE NATIVE TRADE WINDOW + ITEM ICONS (2026-08-17: the E2/E3 shop loop on the classic inventory screen - INVE00I0 + the INVE08I0 buy panel + the SHOP00I0 cost strip (the TRAD00I0 first guess does not exist - the probe caught it); ITEM ICONS come online through the regenerated templates' worldTexture fields over the existing texture pipeline, lazily warmed with sizes; remote-click buys / local-click sells through the extracted doBuy/doSell core, worldModes pointerdown routes interior clicks; probed - three real book icons, bought 3129, sold back 2968; basket/tabs/paperdoll/dyed-icons FLAGGED) SHIPPED + AUDIT 2026-08-17d (the native-window parity audit after Mac's third positioning catch - the trade scroller un-mirrored to the verbatim ItemListScroller (buttons at x=9, the LEFT 9px rail with 16px arrows), FONT0004 stack counts, talk rows 7px / lines 11px, the light-blue question in the player-says panel + the yellow answer color, the centred NPC name; the char sheet clean; THE NATIVE-WINDOW RULE entered Process - every drawn element cites its DFU source or does not draw; see Audits) + U8d THE NATIVE INVENTORY WINDOW (2026-08-17: the first window built under the rule - INVE00I0 base with INVE01I0 selected-state subrect highlights (drawImgSub), the verbatim tab/action-button rects, the AddLocalItem four-way filter (ingredients = templates 0..77 exactly per ItemTemplates.txt, Spellbook 132 to magic), the ItemListScroller EXTRACTED to a shared module riding trade + inventory alike, F6 in both exterior hosts; the view+info half - equip/use/drop + paperdoll FLAGGED to their arcs; probed + eyeballed: gold highlights exactly on the baked buttons, icons in their frames, the stack '3' in FONT0004) + U8e DROPPED LOOT (2026-08-17: the remote column lives - Remove-mode drops mint an archive-216 treasure flat at the ground below the player (CreateDroppedLootContainer verbatim: the 20-entry random icon list, FindGroundPosition), E on a pile reopens the inventory as a loot target with REMOVE defaulted (the anti-accidental-equip law), pickups empty the pile and the flat vanishes (the serializer's removal law); probe lesson recorded - drop probes wait for the MOTOR to settle, not just __shotReady; save persistence + stack-split + TrackLooseObject FLAGGED) + U8f THE EQUIP FOUNDATION (2026-08-17: ItemEquipTable verbatim - the 27-slot table, GetEquipSlot per group over the extracted enum indices, GetItemHands, EquipItem with the 2H/shield/swap/SplitStack laws, FilterLocalItems hiding worn items; THE PAPERDOLL BASE renders - town SCBG04I0 subrect in the 110x184 panel at (49,13), BODY IMGs at their baked offsets minus paperDollOrigin (200,8), the verbatim censor welds, the FACE CIF head; probed + eyeballed - the classic Breton avatar standing in the window; equip-mode clicks stay flagged until U8g's overlay layers + unequip mask; Breton-male-0 INTERIM until chargen). + U8g ITEM OVERLAYS + LIVE EQUIP (2026-08-17: the doll composes CPU-side into one texture like DFU's own renderer - layer order verbatim, the GetItemImage forPaperDoll laws with morphology archives and the SetVariant material-family clamps, the C5b ChangeDye bands live, GetEquipIndex click resolution walking the layers backwards; EQUIP clicks wear items, REMOVE doll-clicks strip them, INFO reads them; probed + eyeballed - iron plate + longsword + red pants ON the avatar, the chest click stripping exactly the cuirass; FP-rig binding + armor values FLAGGED to U8h) + U8h THE WORN-WEAPON BINDING + ARMOR VALUES (2026-08-17: the rig swings equip.slots[RightHand] every frame (bare hands -> the unarmed path), the interim dagger moved into the bag as the boot seed; UpdateEquippedArmorValues verbatim - the 100-per-part baseline, material*5 subtractions, material-blind shields with their protected-part tables, the to-hit consuming the table directly (THE PARITY CHANGE: an unarmored player is now classically easy to hit), the (100-av)/5 labels at the verbatim armourLabelPos; probed + eyeballed - the chest reads 7 in iron and the FP view draws the worn longsword; dungeon-host binding + effect label colors FLAGGED). S3c/U9 CHARGEN (identity + all eight races + the fourth host) and S3d STARTING EQUIPMENT SHIPPED, then AUDIT 17f (2026-08-18: the parity pass over the audit's own changes - SetRace reaching the item LISTS at last, a town-created Mage's spellbook, the headless ?class skip in all three hosts, one gold mint, and the three duplications the 17e waves themselves re-grew; see Audits). + U10 CHARGEN ART (2026-08-18: all seven classic screens on the native panel - CHAR00I0 name, the TMAP00I0 province map with the VERBATIM click law (TAMRIEL2's palette index IS the race id; a click on Hammerfell lands on Redguard), CHAR01I0 with THE PORTRAIT the S3c face index had been choosing blind, the PICK00I0 class scroll over a real screen dim, and the CHAR02I0/CHAR03I0 rollouts with their spinners, derived block and green raised values; found on the way - solid quads never BLENDED, so sixteen translucent UI panels had been drawing opaque and ScreenDimColor blacked the screen out; the port printed skill ENUM KEYS where classic prints "Short Blade"; and FormulaHelper's seven derived stats had no home. Probed + eyeballed screen by screen) SHIPPED. + U11 THE PARCHMENT MESSAGE BOX (2026-08-18: DaggerfallMessageBox ported whole - SPOP.RCI's nine-slice with the verbatim sizing law (margins 10, minBoxWidth 132, rounded to the 22px slice, the label block growing ONCE for buttons) and BUTTONS.RCI buttons indexed BY THE ENUM VALUE; wired to the chargen gender screen, the race Yes/No confirm box on the template's DescriptionID, and U6's action boxes. ONE flagged departure - DFU places the strip from the panel's PREVIOUS height and lands 6px INTO the last text row, so the port clamps to the reservation the label block already made. Uncovered a TEXT.RSC bug: JustifyLeft/JustifyCenter each BREAK THE LINE in DFU and the port dropped both, so every centred record had been rendering as one fused run-on line - the old pin asserted the bug) SHIPPED. + AUDIT 17g (2026-08-18: the deep pass over U10 + U11 - the message-box art warming inside toggleCharSheet so dungeon action boxes drew the flat fallback until F5 was pressed, the box centring EVERY row where DFU centres only JustifyCenter ones (80 of 676 multi-row records affected), chargenHit throwing on the one branch that needed the art, the input box growing a slice mid-word, the keyboard walking past the race description a click always showed, and the class list jumping instead of scrolling minimally; see Audits). + S3e/U12 THE BIOGRAPHY QUESTIONS (2026-08-18: twelve questions per class on the classic BIOG00I0 screen - the BIOG*.TXT walk and the WHOLE effect grammar verbatim (skills, both gold quirks, items with the weapon-to-armor material map, social rep ACCUMULATING where the six single-field mods ASSIGN, faction rep queued); the effects land at finishChargen exactly where DFU applies them, while the skills screen DISPLAYS the bonus without turning it green; not cosmetic - biographyReactionMod and sGroupReputations are already read by getReactionToPlayer, so an answer changes how townspeople greet you. Corpus-gated over all 18 files; probed live at [-5,0,5,5], poison -10, 950 gold) SHIPPED. + U13 REFLEXES + THE BACKSTORY (2026-08-18: the CHAR05I0 reflex screen with TEXT.RSC 307 and the five-band highlight strip - the screen was the ONLY missing piece, both consumers (the EnemyAttack melee timer and the monster multi-attack gate) having read a hardcoded Average for slices because nothing could set it; plus GenerateBackstory expanding %qN/%qNa from the player's own answers (the Mage's 62 rows, all six macros resolving) and the closing ClickAnywhereToClose reputation box on TEXT.RSC 35 with DigestRepChanges' totals) SHIPPED. + AUDIT 17h (2026-08-18: three findings over S3e + U13 - the port had NEVER persisted player reputation (sGroupReputations/reactionMods and the six biography mods), so a quicksave/load reset the player's standing with every social group to zero, a gap several slices old that the biography made load-bearing; the dungeon host skipped the biography entirely, the THIRD time that host gap has hit this flow; and the reflex info panel wanted U11's parchment frame. See Audits). + AUDIT 17i THE ONE CONSTRUCTION SEAM (2026-08-18: the root-cause fix for a bug shape that recurred THREE times - the dungeon host built its ChargenFlow by hand and so missed the starting spellbook, the starting kit and the biography in turn. createChargenFlow is the only place a flow is built now; createChargenWindow WRAPS one rather than constructing it; and a source sweep over src/scenes FAILS if any host contains `new ChargenFlow(` - the rule enforced, not remembered. Probed on the dungeon host itself) SHIPPED. + U14 THE MENU BACKDROP + THE POINTER PATH (2026-08-18, Mac's call: chargen draws over the verbatim BLACK parent panel instead of the live town, and the class picker dims the FACE screen it was pushed over; the DUNGEON host gains a pointer seam (it had none - every click went to the pointer lock, so chargen there was keyboard-only), the gender BUTTON sets AND closes as classic's does, and a guard-rail pin requires EVERY control on EVERY chargen screen to answer a click. Probed by a COMPLETE click-only chargen) SHIPPED. + U15 THE CLASSIC WIZARD ORDER + THE RANDOM NAME BUTTON (2026-08-18: the port had invented its own chargen order; DFU's is an enum - DaggerfallStartNewGameWizard.cs:63-79 - and STATES now follows it verbatim (race, gender, class, biography, name, face, stats, skills, reflexes). Not cosmetic: the FACE screen draws RACE-and-GENDER art, so running it before the race was chosen painted the wrong race's faces, and CreateCharNameSelect.cs:112-119 DISABLES the random-name button without a race template - which is what finally forced the reorder, since U14's flag could not be cleared any other way. The button mints a NAMEGEN name through getNameBank = MacroHelper.GetNameBank, carrying the quirk DFU's own enum comment spells out: Argonian maps to the IMPERIAL bank. Probed by a click-only walk of the new order - a Redguard female named Rlillki by the button) SHIPPED. + AUDIT 17j (2026-08-18: the parity pass over U14 + U15 - seven findings, the through-line being that U15 got the wizard's ORDER right and every one of its BACK arms wrong, because I read the order forwards and inferred the cancels by reading it backwards. The RANDOM-NAME BUTTON WAS DETERMINISTIC (DFU reseeds DFRandom on every push of the name window and says why; the port never did, so every character of a race and gender got the same name on every boot); the class screen cancelled to gender where DFU skips to race - and the U15 pin ASSERTED THAT BUG; the name screen had no cancel at all, and its cancel must DISCARD the biography answers or they double-apply; the name survived a race or gender change where DFU empties the box; the 16-character cap should be TextBox's 31; the U14 pointer seam reached one of the two hosts that mount a dungeon context; and the stats and skills screens REROLLED on re-entry, throwing away the player's whole distribution. See Audits) SHIPPED. Queue: the chargen SUMMARY screen, the class-by-questions path, the biography-method screen, the custom-class builder, the class picker's scrollbar thumb, rest-on-native-art, the dungeon-host worn-weapon binding.
- **Mobile test build (2026-08-13, Mac-directed)**: deployed-site play
  on phones. `src/ui/touch.js` - a virtual stick synthesizing REAL
  W/A/S/D/Shift KeyboardEvents (the scenes' keys Sets and the input
  map see ordinary keys), right-half drag-look via a per-scene hook
  (touch can never hold pointer lock), an attack button mirroring the
  RMB-drag seam 1:1, and a button row (E/jump/F5/F6/spellbook/cast +
  a toggleable overlay-nav row with prompt()-based name entry).
  Data on phones: the picker overlay accepts a ZIP
  (DaggerfallGameFiles.zip or a zipped arena2) - a dependency-free
  reader (EOCD -> central dir -> DecompressionStream deflate-raw)
  with the arena2/ prefix filter; both real archives witnessed
  byte-exact. Viewport meta + touch-action CSS landed in index.html.
  Playwright touch probe (hasTouch context): UI activation, stick
  8-way + run throw, release clearing, look-drag clean. RESIDUAL
  (honest): the look hook's yaw effect is seam-verified only (walk
  mode exposes no yaw getter); the body is the literal mouse
  expression. Desktop untouched - the layer no-ops without touch.

## Open flags (regenerated 2026-08-18, AUDIT 17j)

Regenerated at the AUDIT 17j close: no flag retired or added - the
audit shipped fixes, not slices. What it DID add is a queue, not a
flag: four wizard screens DFU has and the port does not (Summary, the
class-by-questions path, the biography-method screen, the custom-class
builder), recorded in the audit rather than as INTERIM sites, because
nothing in src is standing in for them. Previously, at the U15 close:
chargenArt's "the random-name button is drawn by the art but inert"
was RETIRED and its sentence deleted, per the rule. Line numbers
refreshed. Every row below is a live
INTERIM/FLAGGED/PENDING site in src; the code comment at each site is
the authority. `src/render/characterSprite.js` FP framing constants
stay open to Mac's eye in live play (probe-locked).

- `src/characters/enemyMotor.js:308` - FLAGGED, until target prediction ships). At zero the foe stops.
- `src/characters/mobileUnit.js:18` - clock). DEFERRED (FLAGGED): the Seducer transform pair.
- `src/characters/paperdollArt.js:67` - *  needs no new field; FLAGGED: a remote list (shop stock, a corpse)
- `src/characters/playerEntity.js:5` - UI later fronts it everywhere). INTERIM until then, loudly: flat
- `src/characters/playerEntity.js:18` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:25` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:27` - fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stats above); applyChar...
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): adrenaline rush
- `src/combat/formulas.js:262` - *  MobileEnemy.Weight, class = female 240 / male 350. FLAGGED: the
- `src/combat/playerWeapon.js:13` - INTERIM (loud): the equipped weapon is an Iron Dagger until the
- `src/combat/playerWeapon.js:47` - /** INTERIM starting weapon (items arc replaces): Iron Dagger. */
- `src/combat/playerWeapon.js:48` - export const INTERIM_WEAPON = Object.freeze({
- `src/combat/playerWeapon.js:78` - constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
- `src/combat/weaponRig.js:34` - *                     (FLAGGED at the call sites - their HUD pends),
- `src/scenes/arrestFlow.js:72` - instead of "You, , are..." (chargen wiring FLAGGED).
- `src/scenes/arrestFlow.js:122` - SeverePunishmentFlags |= 1 consequences pend (FLAGGED)
- `src/scenes/cityGuards.js:23` - FLAGGED loud: guard archers forced melee (exterior foe arrows
- `src/scenes/cityGuards.js:109` - attack.rangedAttack = false;   // FLAGGED: guard archers pend exterior foe arrows
- `src/scenes/cityGuards.js:194` - IS Murder; TallyCrimeGuildRequirements(false, 1) FLAGGED to
- `src/scenes/cityGuards.js:312` - motor disables, TallyCrimeGuildRequirements(false, 5) FLAGGED,
- `src/scenes/droppedLoot.js:16` - FLAGGED loud: pile persistence across saves (the quicksave arc
- `src/scenes/dungeonContext.js:164` - the chain lives, the motion is INTERIM (loud) until flats can tween.
- `src/scenes/dungeonContext.js:489` - index into the 18 careers) or the INTERIM default Warrior (16,
- `src/scenes/dungeonContext.js:495` - effects FLAGGED to the effect-library slice.
- `src/scenes/dungeonContext.js:509` - "database FLAGGED" narrows to the skill/loot message ids).
- `src/scenes/dungeonContext.js:650` - drained strength lowers the ceiling). INTERIM (loud): the
- `src/scenes/dungeonContext.js:783` - FLAGGED: DFU recomputes per-effect via the cost tables (that
- `src/scenes/dungeonContext.js:785` - FLAGGED to the effect library (caster-only buffs, touch, areas).
- `src/scenes/dungeonContext.js:997` - 129; the inventory/equip UI pends - the INTERIM dagger note
- `src/scenes/dungeonContext.js:1735` - actions) is FLAGGED - the player snapshot only.
- `src/scenes/exterior.js:323` - S3d: the INTERIM dagger seed is the FALLBACK only - a character
- `src/scenes/exterior.js:329` - pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
- `src/scenes/exterior.js:404` - day-skip is a no-op FLAGGED until the shared calendar lands).
- `src/scenes/exterior.js:470` - (FLAGGED); swallowing the browser reload is not optional.
- `src/scenes/exterior.js:572` - (FLAGGED: the climate People table pends; the test city is
- `src/scenes/exterior.js:641` - FLAGGED here exactly as in world.js - no tile lookup yet).
- `src/scenes/townTalk.js:16` - FLAGGED loud: Info mode opens the same talk window (DFU routes
- `src/scenes/townTalk.js:359` - .replaceAll('%hnr', 'Sir').replaceAll('%ra', 'Breton');   // honorific/race macros FLAG...
- `src/scenes/world.js:438` - FLAGGED loud: the People faction rides the START location's
- `src/scenes/world.js:452` - S3d: the INTERIM dagger seed is the FALLBACK only - a character
- `src/scenes/world.js:458` - pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
- `src/scenes/world.js:574` - day-skip is a no-op FLAGGED until the shared calendar lands).
- `src/scenes/world.js:629` - (FLAGGED); swallowing the browser reload is not optional.
- `src/scenes/world.js:867` - exemption (PlayerTileMapIndex == 0) is FLAGGED: this host
- `src/scenes/world.js:1066` - doors are the E-enter seam, not bashables - FLAGGED with the
- `src/scenes/worldModes.js:70` - say -> console FLAGGED: the interior HUD-text layer pends its arc.
- `src/scenes/worldModes.js:102` - if (!isShop(b.buildingType)) return;   // Library/Guild/Temple bookshelves + owned-hous...
- `src/systems/advancement.js:18` - INTERIM (loud): we apply immediately - level = calculated,
- `src/systems/advancement.js:82` - * skill ids. The headless level-up applies immediately (INTERIM,
- `src/systems/armorMaterials.js:70` - *  "other morphologies arrive with chargen (INTERIM)" note shipped
- `src/systems/biography.js:14` - FLAGGED, exactly as DFU flags them: AE, AF and AO are parsed and
- `src/systems/biography.js:19` - FLAGGED (ours): `rf` FACTION reputation needs the live faction data
- `src/systems/biography.js:112` - FLAGGED: the faction slice drains these into FactionData
- `src/systems/chargen.js:7` - the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
- `src/systems/chargen.js:22` - INTERIM (loud): the UI distributes the bonus pools by hand; the
- `src/systems/chargen.js:128` - /** INTERIM headless pool policy (loud; the chargen UI replaces it):
- `src/systems/chargen.js:147` - spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy ...
- `src/systems/chargenSession.js:7` - played the pre-chargen INTERIM entity (flat skills 30, maxHealth
- `src/systems/chargenSession.js:108` - S3d: the real starting kit replaces the INTERIM dagger seed -
- `src/systems/court.js:7` - People-faction half-delta FLAGGED to the save-side clone).
- `src/systems/court.js:27` - FLAGGED loud: guild rescues (Thieves/Dark Brotherhood) pend the
- `src/systems/court.js:82` - ChangeReputation(peopleFaction, -loss/2) FLAGGED: the save-side
- `src/systems/court.js:113` - *  daysInPrison } (guild rescues FLAGGED). */
- `src/systems/effects.js:25` - FLAGGED skipped (the library grows here).
- `src/systems/effects.js:92` - FLAGGED: career hard-immunity (Career.Paralysis == Immune) and the
- `src/systems/effects.js:530` - out.skipped++;   // FLAGGED: the library grows one family at a time
- `src/systems/equip.js:15` - when worn (FilterLocalItems hides them). FLAGGED: equip sounds,
- `src/systems/equip.js:104` - /** INTERIM starting equipment (chargen's starting-gear roll
- `src/systems/inventory.js:12` - weight pends S2b (FLAGGED - leather/chain/plate multipliers).
- `src/systems/inventory.js:45` - *  FLAGGED: classic keeps gold in playerEntity.GoldPieces, a counter
- `src/systems/loot.js:17` - INTERIM (loud): MI (magic items) rolls are SKIPPED until the magic
- `src/systems/loot.js:169` - FLAGGED to the economy slice (shops).
- `src/systems/races.js:6` - port had only ever instantiated for Breton (the loud INTERIM the
- `src/systems/save.js:7` - (foes, loot piles, action states, doors) is FLAGGED - dungeons
- `src/systems/save.js:58` - (playerEntity's INTERIM skills: 30) - spreading it threw.
- `src/systems/shopStock.js:18` - drift is FLAGGED to the calendar/economy sim.
- `src/systems/shopStock.js:20` - INTERIM (loud): MagicItems stock is SKIPPED (the loot MI interim);
- `src/systems/shopStock.js:109` - if (group === 'MagicItems') continue;   // INTERIM loud (the loot MI interim)
- `src/systems/skills.js:66` - *  +0.1) and the Jump spell (+0.6) are INTERIM 0 here, loudly - the
- `src/systems/startingGear.js:3` - seedStartingEquipment's INTERIM iron dagger: a new character now
- `src/systems/talk.js:17` - crime/quest slices - FLAGGED there, not here).
- `src/systems/talk.js:79` - *  FLAGGED to the crime slice - the state lands now, verbatim).
- `src/systems/talk.js:92` - TallyCrimeGuildRequirements(true, 1) FLAGGED: thieves-guild
- `src/systems/talk.js:99` - SpawnCityGuards(true) FLAGGED: the crime/guards slice mounts the response.
- `src/systems/talkSession.js:19` - FLAGGED: the guild greeting indexes (records 8550..8571) pend the
- `src/ui/chargen.js:52` - SelectBiographyMethod, BiographyQuestions, SelectName...). FLAGGED:
- `src/ui/chargenArt.js:26` - FLAGGED loud: the CUSTOM-CLASS path has no screen yet
- `src/ui/chargenArt.js:412` - AUDIT 17g FLAGGED: the scrollbar THUMB does not draw. Its geometry
- `src/ui/charsheet.js:17` - major/minor/misc); the PORTRAIT pends chargen faces (FLAGGED);
- `src/ui/hudText.js:5` - improved."); the TEXT.RSC database itself is FLAGGED - these
- `src/ui/inventory.js:2` - windows in classic text (backgrounds FLAGGED pending art-name
- `src/ui/inventory.js:9` - Enter readies one (retires ?spell). INTERIM loud: with no
- `src/ui/inventory.js:85` - /** The known list: entity.spells when it exists; the INTERIM fallback
- `src/ui/messageBox.js:35` - FLAGGED: the scrolling variant (a label taller than MaxTextHeight
- `src/ui/messageBox.js:153` - so the strip never rides higher than that. FLAGGED as a
- `src/ui/nativeInventory.js:41` - still said Equip and equip-after-transfer were FLAGGED after U8g
- `src/ui/nativeInventory.js:82` - *  is 0 until those effect channels exist (FLAGGED). Exported so the
- `src/ui/nativeInventory.js:155` - INTERIM info panel: name/weight/value (DFU's 1016 info text
- `src/ui/nativeInventory.js:184` - use: FLAGGED - the use arc pends
- `src/ui/nativeInventory.js:236` - 'use' -> UseItem FLAGGED with the light-source/use arc
- `src/ui/nativeTalk.js:22` - N/P page, Esc/E goodbye. People/Things/Work are INTERIM no-ops
- `src/ui/nativeTalk.js:140` - lands with the Tell-me-about slice (FLAGGED).
- `src/ui/nativeTalk.js:150` - Tell me about / People / Things / Work: INTERIM no-ops (pend)
- `src/ui/nativeTrade.js:16` - scroll. FLAGGED loud: the basket + mode-action flow (DFU
- `src/ui/nativeTrade.js:68` - player's own gear. The REMOTE (shelf) list borrows it, FLAGGED at
- `src/ui/paperDoll.js:18` - Human +2 - Breton INTERIM), record = playerTextureRecord
- `src/ui/paperDoll.js:33` - INTERIM loud: Breton male face 0 until chargen fronts identity.
- `src/ui/paperDoll.js:62` - table, the loud INTERIM the U8f/U8g records flagged.
- `src/ui/restWindow.js:2` - text-panel idiom (backgrounds FLAGGED pending art-name

## Audits

Newest first.

**2026-08-18 - AUDIT 17j, the parity pass over U14 + U15.** The
pointer path and the wizard reorder (PRs #65, #66), read against DFU's
`DaggerfallStartNewGameWizard` HANDLER TABLE and `CreateCharNameSelect`
rather than against the port's own `STATES` list. Seven confirmed, all
shipped here. The through-line: U15 got the ORDER of the wizard right
and every one of its BACK arms wrong, because I read the order forwards
and then inferred the cancels by reading it backwards. DFU's cancel
targets are written out one by one and three of them do not step back
one screen.

(F1) THE RANDOM-NAME BUTTON WAS DETERMINISTIC. `ShowRandomButton`
reseeds DFRandom from a fresh `System.Random` every time the name
window is pushed, and says why in as many words:
"better than starting with a seed of 0 every time"
(`CreateCharNameSelect.cs:123-126`). The port never reseeded, and
DFRandom is a GLOBAL whose last `srand` before chargen is the dungeon's
`locationId` - so every character of a given race and gender got the
SAME suggested name on every boot. Proven before the fix by two
simulated boots returning `Faarn-e` twice, and after it by the live
click probe returning `Rlillki` on every run, then `Florhttha`, then
`Kught-i`. The reseed lives in a `_enterName()` that every path into the
screen goes through, since DFU's is on OnPush and not on Setup alone.

(F2) THE CLASS SCREEN CANCELLED TO GENDER. `ClassSelectWindow_OnClose`
(:353-370) cancels to `SetRaceSelectWindow` - it skips the gender
screen. The U15 pin ASSERTED THE BUG: I wrote it from the STATES order
read backwards rather than from the handler. DFU also calls
`createCharRaceSelectWindow.Reset()` there, nulling the selected race;
the port's race screen has no unselected state, so that half is
recorded at the site rather than ported.

(F3) THE NAME SCREEN HAD NO CANCEL AT ALL - the one screen in the
wizard you could not back out of. `NameSelectWindow_OnClose` (:483-493)
cancels to `SetChooseBioWindow`, which on its way forward CONSTRUCTS a
fresh `CreateCharBiography` over a fresh `BiogFile`. That construction
is load-bearing, not incidental: `answerBiography` APPENDS to
`biographyEffects`, so re-answering without discarding would have
applied every biography effect twice.

(F4) THE NAME SURVIVED A RACE OR GENDER CHANGE. `SetRaceTemplate` and
`SetGender` (:142-161) both EMPTY the textbox when the value changed,
and `SetNameSelectWindow` re-assigns both on every push. Newly
reachable, because F2 and F3 are what give the wizard real back
navigation. The first entry never clears - that is what DFU's
`if (this.raceTemplate != null)` guard buys.

(F5) THE NAME WAS CAPPED AT 16 CHARACTERS. `CreateCharNameSelect` never
sets `MaxCharacters`, so the box keeps `TextBox`'s class default of 31
(`TextBox.cs:26`). Sixteen cut real names short, and the RANDOM button
- which assigns rather than types - could already mint a name the
player was then unable to retype.

(F6) THE POINTER SEAM REACHED ONE HOST OF TWO. U14 gave
`dungeonContext` an `overlayClick` and wired `dungeon.js` to it.
`worldModes` mounts the same context, DRAWS the same overlay in the
`uiOverlayActive` branch of its dungeon frame, and gated its
`pointerdown` on interior mode alone - so it could not click what it
drew. Latent rather than live today (chargen is the only overlay with a
`clickNative`, and it runs at boot where this host already has a
player), but it is the FOUR HOSTS shape for the fourth time in this
flow, so it is fixed and swept.

(F7) THE STATS AND SKILLS SCREENS REROLLED ON RE-ENTRY, throwing away
the roll and everything the player had spent from the pool. DFU keeps
both: `SetAddBonusStatsWindow` (:227-246) rerolls only
`if (DFClass != characterDocument.career)`, and
`SetAddBonusSkillsWindow` (:249-259) passes `!skillsNeedReroll` as
`isRestored`, whose arm RESTORES the document's skills
(`CreateCharAddBonusSkills.cs:62-68`). Both reduce to one rule - reroll
when the class changed, otherwise restore - and the screens' own Reroll
button still forces.

STILL OPEN, and each a slice rather than a fix: `WizardStages.Summary`
(the `CreateCharSummary` review screen, whose cancel arm feeds skills
and stats back to the earlier screens), `SelectClassMethod` +
`GenerateClass` (the class-by-questions path), `SelectBiographyMethod`
(the "answer at random" arm, which also picks the biography TEMPLATE
index), and `CustomClassBuilder`.

**2026-08-18 - AUDIT 17h, the parity pass over S3e + U13.** The
biography and reflex slices (PRs #61, #62), read against DFU source.
Three confirmed, all shipped here - and the first is older and larger
than the slices that exposed it.
(F1) THE PORT HAS NEVER SAVED PLAYER REPUTATION. `sGroupReputations`
and `reactionMods` are read by `getReactionToPlayer` on EVERY greeting
and written by the T3f tone tallies, the G2 court sentences and now
the biography - and NOTHING persisted them. A quicksave/load reset the
player's standing with every social group to zero. The six
`biography*Mod` fields went with them, and DFU writes all of it out
field by field (SerializablePlayer.cs:136-141, :152-162, :305-310).
This predates the biography by several slices; S3e made it
load-bearing from the first minute of a new character, which is how it
surfaced. Persisted now, with the queued faction deltas and the
composed backstory, and with the snapshot DETACHING from the live
entity - the quicksave write happens after snapshotPlayer returns,
the same law save.js already stated for the nested effect entries. A
pre-17h save leaves the entity's own state alone rather than nulling
it.
(F2) THE DUNGEON HOST SKIPPED THE BIOGRAPHY. It builds its own
ChargenFlow and never received the question sets, so a character
created in a dungeon answered no questions at all. The THIRD time this
exact host gap has appeared on this flow: 17f found it for the
starting spellbook and the starting kit, and here it is again one
slice later for the biography. The lesson is not "remember the dungeon
host" - it is that anything the flow needs must be handed to it by the
shared session, not wired per host.
(F3) THE REFLEX INFO PANEL IS A PARCHMENT POPUP.
CreateCharReflexSelect.cs:60-88 calls SetDaggerfallPopupStyle on it
and sizes it to its text plus the margins; U13 drew bare rows over the
province map. U11 already owned that frame, so this is a two-line fix
that should have been the first draft.
CHECKED AND CLEARED: the level-up sums anchor BEFORE the biography
bonuses in the port, and they do in DFU too - the effects are applied
at game start, after the entity setup that computes them. The 18
BIOG files loaded at boot mirror the 18 CLASS files already loaded
beside them, and only when chargen actually runs.
Pins: test/audit17h.test.js, four tests, each mutation-proven.
Probed + eyeballed: the reflex screen's text now sits in its parchment
panel.

**2026-08-18 - AUDIT 17g, the deep parity pass over U10 + U11.**
The chargen-art and message-box slices (PRs #58, #59), read
line-by-line against DFU source. Six confirmed, all shipped here.
(F1) THE WIRING THAT READ RIGHT AND DID NOTHING. U11's
`preloadMessageBoxArt` went into dungeonContext's `toggleCharSheet()`
- the comment beside it even said "for the action boxes" - so a
dungeon trigger that popped a ShowText box drew the FLAT fallback
unless the player happened to have pressed F5 earlier in the session.
Nothing failed loudly; the box just quietly wasn't classic. Moved to
scene boot, beside the TEXT.RSC load whose records it frames. The
same shape as 17e's silently-no-op'd `releaseEmptied` wiring.
(F2) THE BOX CENTRED EVERY ROW. MultiFormatTextLabel sets
HorizontalAlignment.Center on rows a JustifyCenter closed and leaves
the rest LEFT (:341-344). U11's own `linesById` carries that flag and
`drawMessageBox` threw it away. Counted over the real TEXT.RSC: of 676
multi-row records, 596 are all-centre (which is why the race
descriptions looked right), but 53 are entirely LEFT and 27 MIX the
two - 80 records that would have drawn wrong the moment the port
showed them. Rows now flow as { text, center } and a bare string still
centres, which is what a caller composing its own prompt wants.
(F3) THE ONE BRANCH THAT NEEDED THE ART WAS THE ONE THAT CRASHED.
`chargenHit`'s `class` case derefed `_art.imgs` directly where every
other case returns null, so calling it before the art loaded threw.
The live caller guards; nothing else had to know that.
(F4) THE PARCHMENT GREW AS YOU TYPED. `ActionInputBox` re-laid its box
out every frame from its own live entry, so the frame gained a whole
22px slice mid-word. `layoutMessageBox` takes `sizingRows` now and
measures the widest the field can get (maxCharacters 20, the same
clamp the input already enforces).
(F5) THE KEYBOARD WALKED PAST THE RACE DESCRIPTION. A click opened the
Yes/No box; a keyboard confirm went straight to gender. DFU has no
keyboard path on that screen at all - the map click IS the selection -
so routing both through the same box is the closer read. An art-less
flow still advances rather than trapping, pinned.
(F6) THE CLASS LIST JUMPED. ListBox scrolls MINIMALLY on a selection
move - SelectPrevious only pulls the window up when the selection
falls above it, SelectNext only pushes it down when it falls below
(:709-730). U10 recomputed a CENTRED window at draw time, so the whole
list lurched on every arrow and the selection never sat anywhere but
the middle. The scroll index is the list's own state now, and a click
on a row selects it as DFU's list does.
CHECKED AND CLEARED, recorded because each looked like a finding:
the FACE textures are not a leak - `uploadTexture` MEMOISES by key, so
the ten records per identity are bounded (160 worst case) and shared
exactly like archive art. The TEXT.RSC line-break fix has no live
regression: 714 of 1408 records changed shape, but every record the
port currently draws through a single-string path (the greetings,
tones, where-is answers, palace names) is single-row, and `drawText`
renders a stray control byte as a blank advance rather than a glyph.
FLAGGED, not fixed: the class picker's scrollbar THUMB. The geometry
is verbatim and simple (height = rail x displayed/total, min 10) but
the thumb art is three texture slices this port has not identified,
and inventing a colour would break the NATIVE-WINDOW RULE.
Pins: test/audit17g.test.js, six tests, each mutation-proven.
Probed: all seven exterior probes green; the keyboard confirm now
opens the Khajiit description at 9 rows, live.

**2026-08-18 - AUDIT 17f, the parity pass over the audit's own
changes.** Mac asked for a comprehensive audit of everything shipped
SINCE 17e - the four 17e waves themselves, S3c/U9 chargen, S3d
starting gear (PRs #51-#56). Read line-by-line against DFU source by
hand rather than fanned out: the surface is one arc wide, and the
findings that matter here are the ones a wave INTRODUCED while fixing
something else. Sixteen confirmed, all shipped in this one slice.
(F1) THE BIGGEST ONE - SetRace never reached the INVENTORY LIST.
17e F9 correctly moved the lists off world sprites onto the PLAYER
texture, but read the archive straight off the TEMPLATE. DFU offsets
that field by the wearer's body morphology at creation
(ItemBuilder.SetRace :850-854, ApplyArmorSettings :466-485) and
GetInventoryTextureArchive hands the OFFSET field back
(DaggerfallUnityItem.cs:1728-1735) - so every item list in the game
drew clothing from the morphology-0 ARGONIAN row and armor from the
Argonian archive, for every player of every race. The paperdoll had
the law; the list did not. `playerArchiveFor` is now the one home and
both windows call it; the wearer identity threads through
makeIconDrawer into the inventory and trade windows. Probed live: a
Khajiit's short shirt resolves to archive 238, not 235.
(F2) A MAGE CREATED IN A TOWN HAD AN EMPTY SPELLBOOK. The exterior
hosts called finishChargen with NO spell table - SPELLS.STD was
loaded only by the dungeon host - so the identical character created
in a town silently lost their starting spells. loadSpellIndex joins
loadCareers as a shared loader. Probed live: five spells.
(F3) THE ?class=N SKIP MINTED AN EMPTY BAG. S3d put AssignStartingGear
on the flow and on the font-less fallback and missed the headless
path, which sets chargenDone - so the hosts' interim seed skipped it
too and the character had no clothes, no weapon and no gold. The skip
is now one shared function (applyHeadlessChargen) and the exterior
hosts honour it too; they had PARSED ?class for the dungeon they might
build and ignored it for their own chargen.
(F4) THE PROBE ROT S3c CAUSED. Putting chargen on a fresh town boot
wedged the U8d/U8e/U8g probes - the overlay ate every key - and
nothing caught it because a probe is not a gate. Fixed by the F3 skip;
the equip probe additionally still cleared "the interim dagger" from
slot 19 by hand, so S3d's WORN starting clothes rode along and its
count assertion was reading four where it meant three.
(F5) ONE DFU MEMBER, ONE EXPORT, again. 17e F32 collapsed the armor
material tables from equip.js and paperDoll.js and stopped one file
short: characters/paperdollArt.js still held a third copy of the
SetVariant clamps and a SECOND export named `armorArchive` whose
second argument was a RACE where the other's was a MORPHOLOGY - the
same DFU member, same name, incompatible arguments. Collapsed onto the
single home with the C6a signature kept as a wrapper.
(F6) ONE GOLD MINT. Three producers (startingGear, court, talk) hand-
built the Currency stack with NO template index and two spellings of
the name, so the stack drew no icon at all - eyeballed as a bare
"100" floating in an empty button - and weighed nothing through
itemWeight, which is why charsheet carried a second copy of the
0.0025 constant. It is Currency.Gold_pieces (276) now, with the
classic pile icon (216/1) and the template weight; a pre-17f save
upgrades its stack on restore, because stacksWith compares template
index and a legacy stack would otherwise split off a second pile
goldAmount could never see.
(F7) THE CHARGEN COMPLETION GREW A SECOND COPY. dungeonContext
hand-inlined applyCharacter + startingSpells + AssignStartingGear -
the exact duplication systems/chargenSession.js had been extracted to
end one slice earlier. It calls finishChargen now.
(F8) createChargenWindow's own doc said onDone fires once; the code
fired it on EVERY key after the flow reached done, each one re-running
applyCharacter and re-rolling the starting kit.
(F9) THE PAPERDOLL LEAKED ON IDENTITY CHANGE. 17e F27 gave the
composite an owner, and S3c then added an identity-reload path that
set `_live = null` directly - orphaning the GL texture the refresh
would have freed. Chargen reaches it on every race/gender/face change.
(F10) The same reload advanced `_deps` (the identity paperdollItemImage
keys off) BEFORE the art loaded, so a failed load left a Khajiit
identity addressing Breton bitmaps.
(F11-F13) AssignStartingGear's three drifted details: the Spellbook is
added FIRST in DFU (ItemHelper.cs:1300-1306) and AddPosition.Back
makes collection order the DRAW order, so a new character's bag led
with their shirt instead; the pants variant was hardcoded to 4, which
is the MEN'S count - women's Casual pants (template 190) has FIVE, so
a woman could never roll her last variant; and the item names were
hand-written lower-cased copies of ItemTemplate.name ("Short shirt"
for "Short Shirt"). The clothes are also equipped where DFU equips
them, before the weapon is minted.
(F14) RETIRING A FLAG DELETES THE SENTENCE: armorMaterials.js still
carried "the other morphologies arrive with chargen (INTERIM, flagged
there)" after chargen shipped.
CHECKED AND CLEARED, worth recording because it looked wrong: 17e
F15's `safeScrollIndex` is CORRECT. DFU's GetSafeScrollIndex has two
branches and the port implements the delayScrollUp=TRUE one - which
is exactly the branch the Items SETTER takes
(ItemListScroller.cs:181), and the setter is what a refilter runs. The
tight clamp is the scrollbar/mouse-leave path we have no event for.
The partly-filled column really is classic.
FLAGGED, not fixed, with reasons: gold as a bag stack at all (classic
keeps playerEntity.GoldPieces as a counter that never appears in the
list - retiring the port's S2 shape touches goldAmount, trade and
loot, and is its own slice); a REMOTE list drawing its clothing on the
PLAYER's morphology (shop stock carries no owner identity yet);
quicksave living only in the dungeon host.
Pins: test/audit17f.test.js, ten tests, each mutation-proven - a
one-character change to the law it names turns it red.
Probed + eyeballed: chargen -> the Khajiit female in real clothes,
the bag reading Spellbook / Short Shirt / Casual Pants / Shortsword /
Gold Pieces, five starting spells, and the gold PILE icon drawing in
the Clothing & Misc list where a bare "100" had floated.

**2026-08-18 - AUDIT 17e, the comprehensive parity pass over the U8
native-UI arc + the economy/talk/crime slices.** Ten dimensions
audited line-by-line against DFU source in parallel, every finding
put through two independent verifiers (one adversarial, one
checking user-visible consequence + reachability), then a
completeness critic hunting what the audit itself missed. 106 raw
findings, 59 confirmed, 46 unanimous. WAVE 0 (shipped): seven
ship-blockers plus two the critic found.
(F1) THE MODAL CONTRACT BREAK - worldModes.frame() returned
`undefined` from the dungeon's UI-overlay early-out while every
other exit returned true; both hosts gate their whole exterior
frame on that value, so a dungeon overlay made them draw the town
over the dungeon and feed dungeon-local coordinates to the ?world
streaming recenter.
(F2/F3) TWO UNBOUNDED GOLD LOOPS - buyPrice fell back to value 1
where sellPrice fell back to itemBaseValue, and only sellPrice
multiplied by the stack. Nothing outside shopStock stamps `value`,
so any looted item sold for thousands, landed on the shelf, and
bought back for 1; and any stack bought for the price of one item.
Both branches now share one value resolution and the multiplier,
pinned by a round-trip invariant (buy never undercuts sell).
(F4) WORN GEAR WAS MERCHANDISE - the sell lists offered equipped
items and doSell spliced them out of the bag without releasing the
slot: a dangling equip table, a permanent armor bonus, and the FP
rig still swinging a sold weapon.
(F5) THE WRONG ANSWER TABLE - ANSWERS_TO_DIRECTIONS' knows-half was
DFU's answersToNonDirections (7261..7294 instead of 7256..7289), so
EVERY successful Where-is answer drew the wrong TEXT.RSC record -
and the test pinned 7261, certifying the bug and blocking its own
fix. Both tables now exist, pinned whole against the DFU literals.
(F6/F7) CRIME STATE HAD NO LIFECYCLE OWNER - crimeCommitted was
cleared only by the court, so walking out of town left the player
wanted for the session (the watch kept respawning; the despawn law,
gated on the same flag, could never fire); and
haveShownSurrenderDialogue never reset when the watch died, killing
the surrender box - the only call site of LowerRepForCrime.
(C1, critic) SAVE/LOAD DROPPED THE EQUIP TABLE - a load left it
empty, and since worn items are hidden from every inventory tab
they became permanently unreachable and un-removable, with armor
silently reset; a same-session load left the table pointing at
pre-load objects and kept the old armor bonus forever. Both fixed
by DFU's own derive-on-restore (SerializablePlayer.cs:301,355-368).
(C2, critic) NO ITEM WAS EVER ENCHANTED - three consumers read
`item.enchanted`, a property nothing writes (loot mints
`enchantments[]`), so looted magic weapons sat in Weapons & Armor
instead of Magic Items, swung the mundane animation set, and
stacked when DFU forbids it. IsEnchanted is now DERIVED, as in DFU,
and the three tests that fed hand-built `enchanted: true` literals
no producer could create were repointed at the real shape.
WAVE 1 (shipped): the paperdoll click was INVERTED (DFU unequips in
Equip/Select; Remove is inert - and the U8g probe asserted the
inversion, so the bug had a green test and a green probe); the item
lists drew WORLD sprites where DFU draws the player/inventory texture
for 111 of 288 templates - the port only had the world texture
because a lossy generated copy of ItemTemplates.txt shadowed the
verbatim one, now deleted; clothing footwear granted no armor;
the talk conversation had the wrong line pitch (RowSpacing is per
ITEM, not per wrapped line) and one flat colour; Okay closed the
window instead of asking; the player's question was a hardcoded
English literal instead of TEXT.RSC 7225+tone through the greeting
chain; arrows were material-priced and stocked as a stack of 1;
scroll indices never re-clamped; refreshPaperDoll dropped concurrent
requests; the worn-weapon bind moved into the weapon RIG so all four
hosts inherit it; stack labels and icon scaling were off by the 2px
button margin; and GetMaterialArmorValue's two divergent copies (both
inventing Chain2 = 0x0101 for DFU's 0x0103) collapsed into
systems/armorMaterials.js. WAVE 2 (shipped): the three GL leaks each got an owner (the
paperdoll's per-refresh composite, emptied loot piles freeing at
window close as DFU does, the dungeon's per-sprite batches); the
?world floating origin left guards, corpses and ground piles 819.2
units behind on every crossing (persistent billboard batches are
REBUILT, since their centers are baked into a static buffer, and pile
keys became stable ids); melee lost DFU's camera-FOV gate in both
exterior hosts, so a guard behind the player could be hit; the
Where-is list offered Palaces and Furniture stores that classic skips
and was out of enum order; court reputation was raised on banishment
(DFU does not) and withheld on acquittal (DFU does); the char sheet
weighed items by raw base weight, ignoring the material rule;
the exterior host's frame counter ran backwards after a modal frame;
and F5 inside a building reloaded the page. WAVE 3 (shipped): the treasure table's second declaration removed
(it had regressed a 2026-07-06b single-sourcing), two vacuous pins
repaired - a one-sided `bows >= 8` that survived promoting any weapon
to two-handed, and a "display law" pin that was pure literal
arithmetic touching no port code - and three stale flags deleted that
the grep-regenerated open-flags list had been re-publishing as live
work (two retired HUD-text flags, one Equip flag U8g had closed).
DEFERRED with reasons recorded: the paperdoll mask pass (cosmetic,
and the obvious fix is wrong for this architecture), the KRAVE01.HS2
Order-of-the-Raven override (real, 10 Dwynnen towns, needs otherNames
threading), and Chain2 reachability (constant fixed; nothing mints it
until classic-save import).

S3c/U9 CHARGEN (2026-08-18): the loudest INTERIM retires - the player
is no longer a Breton male face 0 with flat skills. Grepping first
(the audit's own rule) found most of chargen ALREADY built: the
verbatim rolling laws and the pool flow both existed, and only
identity, the other seven races and three of the four hosts were
missing. systems/races.js ports all eight RaceTemplates (art tables
GENERATED from the regular scheme because the Races enum is 1-based
while the art index is 0-based, then pinned against DFU's literals);
the paperdoll now loads the ENTITY's race/gender/face and reloads
when that identity changes, with armor/clothing archives taking the
race's body morphology instead of assuming Human; the flow gains RACE
and FACE screens; and systems/chargenSession.js gives all four hosts
one chargen - it had run only in the dungeon, so booting into a town
left the player on the pre-chargen entity for the whole session.
Probed + eyeballed: a Khajiit female Mage created in town, her
paperdoll drawn with the classic striped Khajiit face and female
body. Chargen ART, biography, reflexes and DFU's starting-equipment
roll stay FLAGGED.

S3d STARTING EQUIPMENT (2026-08-18): AssignStartingGear verbatim - the
INTERIM dagger retires. Gender-specific clothes (dyed, varied, and
WORN), a spellbook, the class weapon with its iron/steel choice, the
archer's extra axe and 24 arrows, a custom class's iron longsword, and
100 gold; DFU's PlayerTorchFromItems is ported but defaulted off as a
non-classic setting. The interim seed becomes the fallback only, and
finishChargen clears the bag first so a boot seed cannot leave a stray
dagger. Probed + eyeballed: the Khajiit Mage now begins dressed - real
classic shirt and trousers on the paperdoll, censor welds gone.

**2026-08-17d - the native-window UI parity audit (U8a/U8b/U8c).**
Triggered by Mac's third positioning catch in two days. Every drawn
element of the three native windows re-grounded line-by-line against
DaggerfallCharacterSheetWindow / DaggerfallTalkWindow /
DaggerfallInventoryWindow + ItemListScroller + ListBox. Findings
fixed + pinned: the trade scroller was MIRRORED even after hotfix 2
(itemListPanelRect (9,0,50,152) - buttons at x=9, the 9px rail is
the LEFT column with 16px arrows at y0/y136), stack counts moved to
FONT0004, talk topic rows corrected 9->7px (FONT0003 fixedHeight +
RowSpacing 0), conversation lines 8->11px (RowSpacing 4), the
question now renders DaggerfallQuestionTextColor light blue in the
player-says panel and answers DaggerfallAnswerTextColor, the NPC
name centres; the char sheet audited clean. Both probes re-run +
re-eyeballed. THE NATIVE-WINDOW RULE entered Process. See
`10-UI/UI-Arc.md`.

**2026-08-17c - the comprehensive audit of the guards/court/where-is
stretch (T3-touch, G1, G2, T3c).** Re-read the four slices line by
line against their DFU sources (SpawnCityGuards/SpawnCityGuard,
EnemyAttack's surrender interception, DaggerfallCourtWindow,
TalkManager's GetBuildingList/GenerateBuildingName pipeline), swept
the shared-seam laws, and re-ran every gate and live probe. FIVE
REAL FINDINGS, all fixed at root with pins:
(F1) THE SUBRECORD-BOUNDED POOL MERGE - DFU scans
SubRecords.Length entries of BuildingDataList, not all 32 header
slots; our merge iterated everything, so garbage named-type entries
past the subrecord count stole named-building pool draws and
misaligned every later name (live proof: three identical "Doctor
Rodynak's Herbs" alchemists became three distinct names post-fix).
(F2) THE STALE OVERLAY CALLBACK - townTalk's onClosed callback was
not cleared before firing, and chained windows assigned overlay
directly past it; a court verdict callback could re-fire on a later
unrelated window close. The callback now clears BEFORE it fires and
every chain routes through showOverlay.
(F3) THE DODGING TALLY - DFU tallies Dodging on EVERY resolved
enemy attack against the player (hit or miss); never tallied since
C8. Added at both resolution sites (dungeon foes + city guards).
(F4) THE SEEN-BY-GUARD MASS CONVERSION - DFU's non-immediate loop
puts `if (seenByGuard)` INSIDE the pool loop but OUTSIDE the
range/LOS gate: once any guard NPC sees the crime, every REMAINING
pool NPC converts to a guard (range, LOS, and guard-flag
irrelevant). We had converted only the seer. Preserved verbatim,
pinned.
(F5) THE RAW COURT MACROS - TEXT.RSC 8050 renders %pcn/%cri/%pen
literally on screen (the arrest probe caught it). Added the
CRIME_NAMES table + Penalty string (MacroHelper verbatim) and the
courtMacros expansion; %pcn's appositive collapses gracefully while
the player is nameless pre-chargen (chargen wiring FLAGGED).
Verbatim-confirmed clean: the court math line by line (the two
FailedRolls, the penalty clamp /40, the coin loop, the gold-capped
fine conversion, the plea formulas, THE NEVER-CHARGED VERDICT QUIRK,
execution unreachable), the guard-hit interception incl. the
fatal-blow forced surrender, the spawn constants/order (77.5 /
105.469-degree behind arc at 1/4 / the 2-5 ring / max 5), the
GiveUpTimer cadence (200 ticks, refill-on-detect, x3 for guards),
%ef's burned rand + %rt ruler titles, the palace dot-trim, the
compass bands, the ANSWERS_TO_DIRECTIONS table shape. Suite
437 -> 439 (the audit pins); whereIsProbe + arrestProbe re-run
green post-fix (distinct alchemist names; the full surrender ->
court -> prison -> release circuit with expanded court text).

**2026-08-17b - the comprehensive audit of the towns/talk stretch
(T1, T2, T3a, T3b).** Re-verified the three T1 town modules line by
line against their DFU sources (they were built from working digests;
the talk/faction slices were source-read at build time), swept the
host-parity seams, and re-ran every gate and live probe. SIX REAL
FINDINGS, all fixed at root with pins:
(F1) THE SELF-TARGET PLACE - InitMotor sets targetScenePosition =
transform.position; our place() left target at the origin, so a
politeness idle entered BEFORE the first seek resumed marching toward
world (0,0,0). place() now targets self with the -1 nav sentinel, and
_seek gained InitNavPosition's rederive-from-position.
(F2) THE N/S/E-ONLY BEST SCAN - DFU's downgrade-leave loop iterates
Enumerable.Range(0,3): West is NEVER evaluated as a best direction (a
DFU quirk, preserved 1:1; we had scanned all four).
(F3) THE TICK RESET - PopulationManager resets its timer to ZERO on
fire (at most one tick per frame, remainder dropped); our accumulator
burst-ticked on slow frames and could spawn a crowd.
(F4) THE SPAWN RANGE GATE - maxPlayerDistanceOutsideRect: no spawn
attempts unless the player is inside the location rect + 2500 classic
units (62.5); far streaming pixels now park at pool 0 (probed).
(F5) RANDOMISE-NPC PER SPAWN - identity re-rolls at EVERY spawn, not
per pool item: 1/32 spawns are GUARDS (texture 399, male, variant 0 -
guards never spawned before this audit), else the gender flip + one
of four outfit variants; recycled walkers come back as someone else.
The hosts re-point batch.archive per frame and resolve frameCount by
the LIVE archive (the creation-bound texture closure was stale).
(F6) THE UI PAUSE - DFU pauses the sim under UI windows; the
population now freezes (dt 0) while the talk overlay is up, so the
subject cannot walk away mid-conversation.
Verbatim-confirmed clean: tile weights/carve/row flip (TileTypes
enum exact), spawn probe semantics (uniform [-r,r], 11 attempts), the
anti-skate render gate, the promote/recycle gating incl. the 180-degree
half-plane math, MoveAnims records/flips/speeds and the 4-variant
outfit tables, idle 5 / guard 15, the politeness gate term for term
(inBeastForm N/A), the reaction ladder + -20 edge, activation
distances, the pickpocket formula + outcomes (the CAUGHT path
witnessed live this audit: crime landed on the entity), FACTION.TXT
parse laws. Departures documented LOUD: pickpocket gold/nothing as
HUD lines pending the U-arc message boxes; DFU's dawn-churn
scheduleRecycle quirk on inactive items not reproduced (unobservable);
our release() clears both tiles where DFU leaks the spawn tile's
Occupied flag on recycle-before-first-move (kept - a DFU resource
leak with no gameplay signature). Suite 420 -> 428 (the audit pins);
all three live probes re-run green.

**2026-08-16f - the comprehensive audit of the P13..C10 stretch
(the post-16e day: stealth, rest, movement, sneak, the weapon rig).**
Re-verified the least source-grounded slices against DFU code (U7
was ported mid-session from working notes - it drew the findings),
swept the host-parity matrix and the day's dead code, and ran an
independent high-effort review over the unmerged diff. THREE REAL
FINDINGS + two review nits, all fixed at root: (F1) the REST
SUB-TICK LAW - DFU fires a sub-tick every waitTimePerHour /
minutesPerTick real seconds; the divisor is the CONSTANT 10, not the
6 ticks an hour takes, so a rested hour passes in 0.45s (loiter
0.75s) - the first cut divided by ticks-per-hour and rested ~1.7x
slow; quirk preserved verbatim. (F2) the rest PRE-gate used the
STRICT AreEnemiesNearby - DFU's dfuiOpenRestWindow uses the RESTING
variant (an unaware foe blocks only within 12 units), so ours
refused rest with any unaware foe anywhere in the 1024-unit spawn
band; now shares the hourly check's dep. (F3) the airborne 355 gate
lacked StartRestGroundedCheck's raycast fallback (grounded OR floor
within 0.2 below the feet - a near-ground levitator may rest); plus
the 0-HOUR QUIRK ported (DFU tests hoursRemaining < 1 only AFTER an
hour: resting 0 rests one full hour) and the empty-entry no-op.
Review nits: the 354 refusal's SetEnemyAlert leg ROUTED (no alert
state exists yet - fast travel pends), the grounded-ray constants
derived from CAPSULE_HEIGHT instead of hardcoded. Dead code swept:
the post-P14 latch.jump slots, the post-C10 swingSoundFor import.
HOST-PARITY MATRIX (the standing rule, all seams x all four motor
hosts): crouch/sneak/held-jump/fall-damage/weapon ALL COVERED; rest
is dungeon-only BY DESIGN for now (exterior/interior rest needs the
classic clock + vitals machinery those hosts do not own - recorded
residual, not a violation); breath/swim dungeon-scoped (exterior
water pends); paralysis dungeon-scoped (no effects tick outside).
Suite 389/86 green on real ARENA2 pre-commit.

**2026-08-16e - the pre-merge audit of the S18/S19/P12/A3 stretch
(a8de400..HEAD).** Re-diffed every slice shipped on this lane since
the 16c audit against DFU source, swept the cross-cutting invariants
(host parity, roll orders, Dice100 semantics, save round-trips,
casterless levels), closed green on real ARENA2 (357/357) with BOTH
shot probes (dungeon ?foes + exterior) rendering. FOUR REAL
FINDINGS, fixed at root: (F1, the big one) the WALK-SPEED DRAG TERM
- DFU's GetWalkSpeed is (SPD + 150 - drag)/39.5 with drag = 0.5 x
(100 - max(30, SPD)); our P1-era walkSpeed dropped the term and the
player walked ~14% fast at SPD 50 ever since. The fix forced two
verbatim companions: the RUN base is UNDRAGGED (the old
walk-x-multiplier run only matched DFU because walk lacked its
drag - decoupled), and GetRunSpeed has a CROUCH branch (crouch base
x run multiplier - running while crouched is real in DFU; P12 had
crouch swallow run). Swimming inherits the fix through its walk
base, verbatim (LevitateMotor's GetSwimSpeed(GetBaseSpeed()) - no
run adjustment while swimming, confirmed). (F2) trap CastSpell
missiles ran at the PLAYER's level - DFU casterless bundles run
CalculateCasterLevel(null) = 1 for magnitude, duration AND chance;
they now carry casterLevel 1. (F3) the S19a paralysis input gate
also swallowed the crouch toggle - DFU's DecideHeightAction has no
paralysis check (FrictionMotor zeroes movement only); crouch stays
live while paralyzed in both dungeon hosts. (F4) host parity,
again: the two EXTERIOR walk motors (world.js walk mode,
exterior.js walk mode) never received P12's crouch input - the
standing per-host rule caught its third violation; both wired.
VERIFIED CLEAN (the negative results that matter): Dice100
semantics (Range(0,100) < chance) match our dice100 everywhere the
S18/S19 chance rolls ride it; the poison variant switch re-read
row by row (Range EXCLUSIVE-hi args, call order); the AssignBundle
gate order + AddState-first quirk pinned as shipped; the disease
FAT/SPL raw-units rule confirmed against DecreaseFatigue's default
multiplier; A3's clip ids/waits re-checked against the enum and the
serialized scene; exterior ambience sits BELOW worldModes' early
return (never plays indoors); the new save fields
(currentBreath, statMods maps, poison/paralyze entries) all
round-trip pinned. ACCEPTED STRUCTURAL NOTE (documented, not a
bug): our per-round pass runs diseases -> poisons -> other effects
as three walks where DFU interleaves by bundle assignment order;
per-round aggregates are identical, only intra-round side-effect
ordering differs, and no consumer observes it. The stale
"08-Audio not started" Home line and the P12 "crouch replaces
walk/run outright" prose corrected. Lesson, same as 16c but now
three-for-three: A SEAM SHIPS IN EVERY HOST THAT OWNS A MOTOR -
world.js and exterior.js walk modes are motors too, not just the
dungeon pair.

**2026-08-16c - the post-merge audit (parity pass + host-parity
sweep).** Full pass over the two-lane merge (`4f19fb5`), closed green
on real ARENA2 (327/327). The merge reconciliation itself held: both
lanes' features verified present in the unified action runtime (spot
re-check: EntityEffectManager.HealAttribute's walk re-read whole and
matches S15's port exactly). THREE REAL FINDINGS, fixed at root:
(1) HOST PARITY - the world-scene dungeon mode (worldModes) never
wired P10's teleport warp or P11's swim/levitate/fatigue feed; only
the standalone ?dungeon scene did. A world-mode teleporter logged and
no-opped, and a world-mode dungeon SANK the player under water at
walk speed. Both hosts now install the same seams (the S8 slowfall
precedent - per-host wiring is a standing audit checkpoint for every
future scene-side seam). (2) The AttemptBash sound seam (onDoorBash)
existed unwired since the bash slice routed it to Audio; A2's engine
was already in place, so it now plays PlayerDoorBash (7) from the
door. (3) A dead export (DELEGATED_RELAY_FLAGS - declared, never
consumed) and a stale sink doc (restoreMagicka listed in applySpell's
contract after the S15 key fix removed its caller) cleaned. PARITY
EVIDENCE, new corpus gate: all 84 corpus teleporters probed
end-to-end - 82 resolve their destination through the P10 position
index; N0000003/W0000003 @23676 target an ACTIONLESS model, which
DFU's actionLinkDict (acting objects + editor flats only) also never
links - its Teleport delegate logs "can't teleport" exactly as ours
does. Kept bug-for-bug and pinned in dungeon.test.js. Open-flags list
regenerated (40 rows); Ledger and arc lines verified against the
merged code.

**2026-08-16 - the dungeon-parity + FP-viewmodel audit (Mac-directed).**
Full diff of the dungeon chain (layout, actions, doors, enemies,
lights, textures, water, triggers) against the DFU C# (sparse clone)
plus a pixel audit of the FP voxel pass. Verified clean, no change:
model matrices (T*Rz*Rx*Ry), texture tables (CLIMATE_INDICES
byte-exact), overlap removal incl. DFU's missing-block-origin quirk,
water Y, spawn, Hurt math, the trigger gate table, encounter tables,
light constants. ELEVEN real findings, all rooted and shipped:
(1) the FP viewmodel rendered ZERO pixels in every state and frame -
the P9 hole-fix constants overshot the whole rig out of the frustum;
probe-locked replacement (back 0.25, cast -0.20) via the new standing
tools/fpProbe.mjs, before/after gallery in public/visual-changes/.
(2) sampleClip takes SECONDS and all three pose paths passed a PHASE -
FP strikes lost their back half, enemy swings died at 40-66%, staggers
cut at a third. (3) pressing use CRASHED on any registered trap (effect
objects carry no cpu) - activationTargets is the single builder now.
(4) CastSpell never reset its 1000 cooldown - traps machine-gunned.
(5) chains died at every non-move/non-effect link: relays, chained
doors, the four door VERBS, special doors, and flat/marker actions all
now registered verbatim (locks carry VALUES; the IsLocked gate ships
with lockpicking as one Ledger unit). (6) nothing ever sent the Attack
trigger and doors could not be BASHED - the WeaponEnvDamage pass now
runs on the swing frame. (7) random enemies read GENDER bits out of
their slot byte (useGenderFlag is fixed-only). (8) playerLevel was
never wired into the encounter banding - stuck at 1 despite live
advancement. (9) collision triggers gated on position delta and missed
pushing into blocking WalkInto objects - input-held now, verbatim.
(10) ACTION_FLAGS lacked Unknown50/DoorText (Enum.IsDefined parity).
(11) layoutRdbBlock emitted a second, unconsumed lights array without
the *3 under a wrong "prefab-side" comment - collectDungeonLights is
the single source. Standing lesson, the third time now: **a pin
certifies what it pins** - the clip tests pinned seconds while every
caller passed phase, and the sweep that proved the viewmodel invisible
took one probe that nothing had ever pointed at the shipped surface. Older per-fix audits are consolidated into their arc
records; Home keeps the one-line pointer and the standing lessons.

**2026-08-14 - the post-ship audit (mobile/deploy/UI/A1).** Full
sweep of the week's shipped surface, closed green on real ARENA2
(293/293 - the corpus gates had been skipping since the enemyBasics
regeneration; this run re-proved them). Byte discipline: the A1 regen
diff verified semantically equal minus exactly the three sound
columns (62 entries). A1 vs source: SoundClips-as-record-index
confirmed (SoundReader casts the index straight through, divisor
1/128 matches), dungeon door clips 25/24 confirmed from the
serialized prefab, swing/hit tables and volumes re-checked. One real
find, fixed: AU2 - the 3D profile was one 40-unit linear panner for
everything where DFU is per-source (DaggerfallAudioSource min 1 /
max 500 logarithmic; enemy sources clamp at AttractRadius 16) - the
engine now defaults to the inverse/500 shape with per-call overrides
and every enemy-side call passes 16. The data diet's whole fetch
surface (literal + variable-name sites: HUD art, palette indirection
incl. MAP.PAL/NIGHTSKY.COL, NITE images, TEXTURE templates) passes
KEEP on both diets; SKY-on-lean is the designed gradient. The
letterbox offset has exactly one caller pair (set + finally-reset).
Three stale Ledger C rows pruned with shipped evidence (enemy AI,
dungeon loot, Hurt/CastSpell traps - Poison stays routed). Lesson:
after any generated-file change, the ARENA2 suite must run BEFORE the
commit ships, not at the next audit - bare-suite green hid zero
defects this time by luck, not design.

**2026-08-13 - the DFU parity audit (F1-F17).** Full sweep of every
1:1-claimed surface against the DFU C# (sparse clone), baselined and
closed green on real ARENA2 (288/288). Twelve behavioral parity
breaks found and rooted, all in COMBAT/SYSTEMS - the corpus-gated
formats/world layers held clean. The big four: the to-hit chain was
missing CalculateAdjustmentsToHit entirely (the flat -50 on every
attack and the +40 vs monsters - F1), monster weaponless attacks ran
the H2H skill formula instead of the basics multi-attack loop with
the DFRandom reflex gate (F2), weapon material to-hit (x10) never
landed (F3), and continuous effects held a once-rolled save instead
of DFU's fresh roll every magic round plus the initial round firing
AT CAST (F10/F17). Also fixed: duration multiplier min-1 clamp (F11),
incumbent re-casts STACK rounds (F12), permanent-vs-live stat
sourcing both directions (F8 level-up HP / F9 saving throws), all 8
career stats on enemy entities (F14), additive bonus+phobia bits
(F16), mastered-skill re-eval per raise (F7). Latent-only: the
leather weight int-div shape (F13 - converges on every classic
template). Routed to Ledger C: enemy spellcasting (F15), OnMonsterHit
riders, the enchantment to-hit channel (F4), armor-value effect
modifiers (F5). Standing lesson, again and sharper: **a pin certifies
what it pins** - seven suite tests were green on the broken shapes
(the "ONCE-rolled save" test literally named the bug); porting a
function without diffing its CALLERS (CalculateAttackDamage's monster
branch, AssignBundle's initial round) is how whole control-flow limbs
go missing while every leaf tests green.

**2026-07-07 - the live-play hardening arc (P9).** The deployed build
was played against real ARENA2 for the first time and a run of bugs
surfaced that the unit gate is structurally blind to. All fixed and
rooted; the full blow-by-blow (boot/build crashes, spawn placement,
pointer lock, the g:0 grounding knife-edge, the SKIN-shell stair
regression, and the FP-viewmodel "hole") lives in
`03-World/Player-Arc.md` under P9, with the S2 blocks-binding
correction in `06-Systems/Systems-Arc.md` S2. Two standing rules came
out of it and hold for all future work:
  1. **Unit-green is not playable-green.** The suite passing does not
     mean the game runs; several "root fixes" this session were real
     bugs but not the reported one, and the true cause (the FP camera
     rendering inside the player's own body) was visible in the first
     screenshot yet missed for a dozen commits. A change to
     live-executed code is unverified until it is actually played.
  2. **Read what is on the screen before theorizing about what is
     behind it.** Mac diagnosed the decisive bug from one look; the F8
     debug HUD (build tag, feet, markers, lock, motor, raw input) now
     exists so evidence, not theory, drives the next fix.

**2026-07-07 - the crash-class audit (no-undef joins the gate).** Mac's second live crash (Y1@407:239805) mapped through the
deterministic bundle to characterSprite.js:56 calling trs() WITHOUT
importing it - unbound since C8 E3d; vite emits unknown identifiers
as presumed globals, so node --check, the build, and the headless
suite all pass while the first real viewmodel frame throws
ReferenceError. THE CLASS IS NOW CLOSED: eslint (flat config,
browser globals) with no-undef runs FIRST in npm run check. The
sweep found and rooted every member: trs (the crash - imported),
FLASH_TYPE_KEY in the rewrite/ bench (a real unexported constant -
exported + imported), and quadInto in pieces/draped.js (a phantom
helper UNBOUND FOR THE FILE'S WHOLE LIFE - the cloth tests exercise
drapedGrid, never the faces path; now defined in the pieceLoft face
convention). ONE MISREAD, owned: interleaved grep output made
draped.js look like a dead orphan with unresolvable imports and I
git-rm'd a LIVE tested module - the suite caught it in the same
gate run and it was restored + root-fixed instead. createImageBitmap
joined the config globals; the two 'unexpected token with' parse
errors were import attributes, fixed by ecmaVersion latest.


**2026-07-06f (Mac): deep audit + bible update, S5/bows/triggers
sweep.** Suite 249/60 green, build clean, manifest MATCH both
directions, git clean pre-audit. One GENUINE GAP in the Combat
COMPLETE claim found and closed: MOVERS carried no AABB, so classic
step-on platforms (Collision01 elevators) could not
collision-trigger - movers now carry their AT-REST bounds and the
trigger pass tests them only while parked at 'start' (the static
bounds are truthful exactly when the step matters; mid-flight rides
do not re-trigger, matching classic). A dead always-truthy guard
(SKILLS &&) cleaned. KNOWN DEBT recorded: dungeonContext has grown
to ~770 lines absorbing foes + missiles + arrows + casting +
triggers - a future combat-scene extraction is queued as debt, NOT
churned blind under audit. Ledger regenerated (06f).


**2026-07-06e (Mac): deep audit + bible update, S4 sweep.** Suite
245/59 green, build clean, manifest MATCH both directions, git clean
pre-audit. Fixed at root - one class, five sites: the S3/S4 slices
had re-introduced DYNAMIC imports of statically-imported modules in
dungeonContext (shared.fetchBytes, ClassFile, loot.js twice,
magicDef alongside its own static) plus foeDeps still bagging
ClassFile/generateItems/fetchBytes dynamically - exactly the
double-sourcing class audits 06c/06d killed; every site now rides
the statics (7 dynamics remain, all genuinely lazy foe-path deps).
A dead missile field (m.half) dropped. The loot magic-item registry
documented as single-active-context by design. Home's Systems and
Combat lines refreshed (S4 complete; CastSpell shipped). Ledger
regenerated (06e).


**2026-07-06d (Mac): deep audit + bible update, S3/S3b sweep.** Suite
236/56 green, build clean, manifest MATCH both directions, git clean.
Fixed at root: (1) COHESION - the skills MODEL (SKILLS enum,
WEAPON_SKILL, skillValue, tallySkill) lived in chargen.js while three
modules imported entity-layer concepts from creation logic; extracted
to systems/skills.js and every importer (formulas, advancement,
dungeonContext, both tests) moved to the real home - a first-cut
re-export shim was itself removed as a band-aid. (2) TRUTH -
playerEntity's header still said chargen pends the Systems arc;
rewritten (chargen exists; the initial values are the pre-boot state
only). (3) STALE - the Systems-Arc queue still listed shipped S3; the
Home Systems line said 'Next: S3'. Ledger regenerated (06d). No raw
flat-skill reads bypass skillValue (grep-verified).


**2026-07-06c (Mac): deep audit, all changes since 06b.** Suite 230/54
green, build clean, manifest math verified BOTH directions (doc rows
== real files, doc total == real tests). Fixed at root: (1) the
verbatim treasure DATA (archive 216, icon table, marker record 19,
the 19-row dungeon-key table) lived in a SCENE file - moved to
systems/loot.js, its DFU-shaped home; rdbLayout's 216 now imports the
single source (cycle-checked through the full suite). (2)
dungeonContext double-sourced floorLanding + playerEntity (static
imports AND the foeDeps dynamic pair) - dynamics dropped; an unused
LOOT_MATRICES import dropped. (3) window.__player was written from
SEVEN sites AND collided with the probe scenes' motor-snapshot
global of the same name - the entity surface is now surfacePlayer()
writing __playerEntity (one site, no collision). (4) Home.md's S1
status line had landed inside the DIRECTORY list; the Active-arcs
section lacked Combat and Systems lines and carried stale Player/
Rendering tails - section rewritten to truth. Ledger regenerated.


**2026-07-06 (Mac): comprehensive audit, engine included.** Suite
211/47 green, build clean, manifest cross-checked. Findings fixed at
root: (1) ENGINE - the character-sprite RT cache keyed on exact
(pw, ph) and reallocated FBO+texture+renderbuffer every frame per
character once foes at differing distances shared it; now ONE fixed
CHAR_SPRITE_RT_SIZE (256) target, sprites render into a viewport
sub-rect, the quad samples the scaled UV extent, full-target clear
keeps out-of-rect transparent (NEAREST boundary bleed discards).
(2) SINGLE-SOURCE - CLASSIC_UPDATE_INTERVAL was defined in both
weaponStates and enemyMotor (same GameManager.cs:42 value); enemyMotor
now imports + re-exports. Enemy capsule-height defaults were literal
1.8s; now CAPSULE_HEIGHT from the motor. exterior.js carried a dead
`ortho` import after the sprite-pass extraction. (3) The Open flags
ledger above was generated and pinned. Stale docs refreshed (this
file's arc line, the C8 records).

## Deploy

Production is GitHub Pages via `.github/workflows/deploy.yml` (push to
main or manual dispatch), gated on `npm run check` - a red suite never
ships. Builds contain NO game data (Port-Doctrine: ARENA2 is
non-redistributable). The runtime data path is
`src/scenes/dataSource.js`: getBytes resolves memory -> IndexedDB ->
network `./arena2/*` (the dev middleware unchanged); on the deployed
site a boot overlay asks for the local ARENA2 folder ONCE (directory
input or drag-drop) and persists it in IndexedDB. Every reader routes
through the fetchBytes seam, signature unchanged.

## Repo layout

`src/main.js` is a thin scene router (37 lines). Scenes live in
`src/scenes/` (exterior, interior, dungeon, terrain, world) with shared
helpers in `src/scenes/shared.js`; each file carries its milestone header.
Data readers in `src/formats/`, world assembly in `src/world/`, GL in
`src/render/`. Extraction verified pixel-identical across all five scenes.

## Ground rules carried from project-final

- Desktop-only. No touch controls, no mobile layout.
- Bible is flat under `bible/`. This file is the index. No Dashboard.md.
- Prototype HTMLs at repo root must register in `vite.config.js` rollupOptions.input.
- One feature at a time. Grep first. str_replace over rewrites.
