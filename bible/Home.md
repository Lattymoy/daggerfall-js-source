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
- `03-World/World-Arc.md` - ACTIVE again: TOWNS. M1-M9 COMPLETE + T1 THE WANDERING POPULATION (2026-08-17: CityNavigation's automap-carved weighted navgrid - the per-block row flip proven against the rendered tilemap - MobilePersonMotor's road-following seek + the verbatim politeness idle, PopulationManager's 10Hz pool with anti-skate/night/view-gated pop-in, the verbatim race texture tables; townsfolk probed walking Daggerfall's streets, the closeup identical to raw 386/5) SHIPPED + T2 THE STREAMING MOUNT (2026-08-17: per-location-pixel pools in ?world with the verbatim StreamingWorld location-type gate, persons in the location frame converted through the live floating-origin translation, batches destroyed with their pixel; probed live at Daggerfall city center - the politeness idle on the fly cam, archive 456 identical to raw 456/5) SHIPPED + T3a THE TALK FOUNDATION (2026-08-17: FACTION.TXT verbatim - 366 factions, the tab-stack tree, ruler seeds in classic call order; findFactions/People-of-region/getReactionToPlayer verbatim; pickpocket with the 5..95 clamp, gold/nothing/caught outcomes and the crime state - guards FLAGGED to the crime slice) SHIPPED + T3b THE TALK WINDOW + ACTIVATION (2026-08-17: F1-F4 interaction modes, the person-cylinder activation ray at 6.4/3.2, the reaction greeting ladder 7206-7209 with %pcf/%oth macros through the real TEXT.RSC, the shared townTalk seam in BOTH exterior hosts - their first HUD-text layer; probed live: "Yes?" in the panel, "You pinched 1 gold piece." on the HUD) SHIPPED + THE T3-TOUCH ADDENDUM (2026-08-17: the phone path - a live-labeled mode-cycle button on the touch row driving the verbatim NextInteractionMode wrap, E doubling as goodbye while the window is open; hasTouch-probed: grab -> info -> dialogue taps + E open/close live) SHIPPED + G1 THE CITY WATCH (2026-08-17: the crime circuit closes - SpawnCityGuards verbatim (guard NPCs first, behind-player civilians 1/4, the 2-5 ring fallback, max 5, the witness/countdown path), Knight_CityWatch class foes as the FIRST exterior foes on the C11 stack in both hosts, the GiveUpTimer hostility law joining EnemyAI generally (detection refills 200 classic ticks; MakeEnemyHostileToAttacker pre-loads x3), combat both ways + HALT + corpses; probed live: a ring guard marched 30 units, detected, and swung - the close-up crops the classic plate knight 399) SHIPPED + G2 ARREST + COURT (2026-08-17: the crime loop completes - the EnemyAttack interception withholding the first guard hit for the surrender box, SurrenderToCityGuards' SetHealth(1)/rep gates/DFRandom coin, the DaggerfallCourtWindow math verbatim incl. THE NEVER-CHARGED VERDICT QUIRK, sentence rep raises, the crime-clear stand-down; probed end to end: box -> Y -> court -> G -> crime 0, LegalRep -2, guards gone) SHIPPED + T3c WHERE IS (2026-08-17: GenerateBuildingName verbatim over the full classic name lists, the named-building pool merge with per-instance door resolution, the 30-record answer table + the NPC-stable reaction tier + the %hnt/7333 hint chain with the verbatim 8-way compass; probed live - 62 named Daggerfall buildings, a tier-0 commoner refusing rudely; the streaming-host directory FLAGGED as the follow-up) SHIPPED. Next: the world-host Where-is mount, exterior loot pickup, the NPC knowledge roll.
- `03-World/Player-Arc.md` - ACTIVE again. P1-P9 + P10 TELEPORTERS + DOOR LOCKS (the delegates verbatim, RDB starting locks + look-at-lock tiers, flat/marker actions joining the graph, the repeated-block action-key collision fixed) + P11 SWIM/LEVITATE (2026-08-16: the LevitateMotor path with GetSwimSpeed and the surface clamp, the swim toggle + splash, Levitate (14,255) end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) + P12 BREATH/CROUCH (2026-08-16: MaxBreath = END/2 with the classic-update drain every 19th tick and SetHealth(0) drowning at the 76*GS head-under threshold, WaterBreathing (30,255) gating it, the verbatim HUDBreathBar; crouch 0.9/0.8 on the KeyX edge in both hosts with crouchSpeed, a per-call collider capsule height, and the CanStand ceiling probe) + P13 STEALTH (2026-08-16: the oldest src flag closes - the classic detection flow with hearing gated on prior detection, the once-per-minute StealthCheck with spawn-band gating/odd-minute sneak skip/fast-move auto-detect/the shared Stealth tally, and the verbatim illusion gate with the 13 sees-through monsters - retiring the S8 half-sight interim, which had been DEAD post-merge) + P14 MOVEMENT PARITY (2026-08-16: the live jump/incline report - Mac's reverted b9e9aa6 re-derived on the crouch-height tree: final-vertical-state grounded truth un-killing the one-frame jump, the ascending step-lift ladder with the monotone ceiling sweep and the no-depenetrate-into-ceiling clamp, slopeLimit-70 pinned 60/78; plus the verbatim jump laws - the 0.1s GroundedTime gate with HELD jump input, jumpSpeedMultiplier via Jumping skill, crouched x0.8, the moving-jump forward boost, frozen airborne momentum, HitHead reversal - and CheckFallingDamage end to end with sounds 91/92 in all four motor hosts, slowfall to the verbatim -105*dt law) + P15 SNEAK (2026-08-16: AltLeft held per DFU's default - the grounded-only run/sneak latch, running beats sneaking, base/2 - 1/39.5, swim ignoring both verbatim; IsMovingLessThanHalfSpeed now TRUE while sneak-moving, so the P13 stealth checks apply to a MOVING player) + P16 THE FIXED PHYSICS TIMESTEP (2026-08-17 live hotfix: update() accumulates render dt and steps at 1/60 with the 0.25 jank clamp - Unity FixedUpdate IS the missing parity law; real-mesh traces proved the deployed motor failed real staircases and collapsed jumps at phone frame rates while being correct at 60; + the ceiling entry-clamp firing only on residual penetration and the ladder capping rungs at resolved height) + P17 FOE-AI FIXED STEPPING (2026-08-17: the P16 accumulator law on EnemyAI - the whole body, senses cadence + physics, steps at 1/60 with the 0.25 jank clamp; a 10fps foe pursues bit-identically to a 60fps foe; urgent once C11 put ~29 raw-dt foes in every dungeon on the deployed mobile build) SHIPPED. Next: riding (the monster pivot shipped as Combat C11).
- `04-Characters/Characters-Arc.md` - PARKED (pivot 3: classic visuals). C8 shipped E1-E4b end to end + spectral; E4c deferred by Mac; remaining interims are Systems work (ledger below).
- `05-Combat/Combat.md` - ACTIVE again. Core via C8; Hurt traps, CastSpell (S4b), bows both directions, the collision-trigger seam (input-held gate, 08-16), the Attack trigger + door bashing (WeaponEnvDamage, 08-16), the TRUE classic FP weapon + its six-finding parity audit (08-17, the parallel lane) + C9 THE HOST ROLLOUT (2026-08-16: combat/weaponRig.js mounts the audited weapon surface in the interior mode and BOTH exterior walk hosts - RMB drag/click, Z sheathe per mode fixing the interior Z crash, envAttack bashing interior swing doors, bows consuming arrows; dungeonContext's inline copy folds onto the rig when the FP lane settles - recorded) + C10 THE RIG FOLD (2026-08-16: dungeonContext's inline weapon collapses onto weaponRig - one home for the audited surface, the env ray now the shared envAttack, the rig canvas late-resolvable; parity-positive deltas: the weapon exists in foe-less dungeons and the listener/ambient pass un-gates - it had sat inside `if (playerWeapon)` and foe-less dungeons silently lost 3D audio since A2 - and the touch tap gains the sheathed gate) SHIPPED + C11 THE MONSTER PIVOT (2026-08-17: monsters 0-42 go LIVE - classic 8-orientation sprite mobiles (characters/mobileUnit.js, DaggerfallMobileUnit/EnemyBasics verbatim: the record layout, the signed-angle orientation law, attack sequences with the -1 damage marker + chance-rolled variants, hurt one-shots, the rat/ghost/wraith/slaughterfish/scorpion quirks, the Ancient Lich frame rescale) on the SAME combat spine as the class enemies - EnemyAI/EnemyAttack/entity/loot/S16 spells/S18 riders/corpses; one live billboard batch per foe over dataPipeline.uploadRecordFrame; foes DEFAULT ON in all hosts; THE BILLBOARD-AXIS DOCTRINE ground-truthed - DFU's flip booleans are correct only under the hosts' flats axis (the negated view row), the raw view row moonwalks every side view; cast/ranged anims + Seducer pend) SHIPPED + C12 THE BEHAVIOUR MOTORS (2026-08-17: CanFly = Flying|Spectral - imps/bats/harpies/ghosts/wraiths pursue in 3D at the target face with NO gravity, hover at spawn, floor-skim guard; Aquatic = WaterMove verbatim against the P11 block water surface - the 2.5 head margin, beached fish FROZEN; paralysis through the motor: flyers fall out of the air, swimmers freeze; flyer corpses land) SHIPPED + C13 HOST ARROWS (2026-08-17: combat/arrowFlight.js - the visible loose in worldModes interiors + both exterior walk hosts, the 99800 model on the S5 constants, lost on geometry/terrain as DFU misses are; the dungeon keeps the full seeking+recovery path) SHIPPED + C14 THE MONSTER SPELL ANIM (2026-08-17: the 13 casters play SpellAnimFrames - records 20-24 for the Orc Shaman via HasSpellAnimation, the primary records for the rest, verbatim GetStateAnims incl. no ghost/wraith special; attack>cast>hurt interrupt laws pinned; RangedAttack1/2 closed as class-enemy-only) SHIPPED + C15 KNOCKBACK (2026-08-17: WeaponManager speed formula floored at 15 classic + the Weight>0 gate - spectrals immune - and KnockbackMovement on the fixed step: shove along the attack ray, 25-cap/5-decay, hurt rides the threshold NOT the hit, flyers knocked out of the air; the C11 per-hit hurt retired) SHIPPED + C16 THE -1 DAMAGE MOMENT (2026-08-17: mobile melee damage lands on the sequence markers - the Frost Daedra base swing strikes TWICE - via the extracted resolveFoeMelee; the machine stays the decision clock + the rigs' damage clock) SHIPPED + C17 THE HUMANOID PIVOT (2026-08-17: class enemies render as classic sprite mobiles - FemaleThiefIdleAnims verbatim, the RangedAttack1 archer state with the -1 shootFrame loose, the 475 female cast scale, gender-picked archives; the voxel foe rig ON ICE beside the voxel FP weapon; entity spine unchanged; doctrine-proven vs raw 484/19) SHIPPED. Next: economy/enchantments, towns, or riding.
- `08-Audio/Audio.md` - ACTIVE. A1 + A2 (2026-08-16: action PlaySound on every Play, torch Burning loops at 5m linear/0.7 via the new loop3d engine seam, animal random barks on the classic rand()<=100 cadence at 19.2m - dungeon-scoped) + A3 SCENE AMBIENCE (2026-08-16: AmbientEffectsPlayer verbatim - the 14 dungeon one-shots somewhere-around on the scene's serialized 5/28 waits + classic-cadence water/bubbles, the weather/time presets in BOTH exterior scenes on 5/25 with rain/crickets loops and horizon storms, one shared ambient channel; building interiors silent, verbatim) SHIPPED + A4 EXTERIOR ANIMALS (2026-08-17: the shared PlayRandomlyIfPlayerNear pass - systems/animalAmbience.js, one implementation for dungeon + both exteriors incl. the streaming world's floating-origin sources; exterior torches SILENT verbatim - Burning is RDBLayout-only in DFU) SHIPPED; transition stingers CLOSED verbatim-N/A (2026-08-17: DFU plays nothing on enter/exit or ladders - no source law to port). Next: music strategy (Mac's call) - the queue's last row.
- `06-Systems/Systems-Arc.md` - ACTIVE. S1-S16 + S18 DISEASES (2026-08-16: the 17-row DiseaseData table byte-exact, the daily tick over the classic day with statMods through liveStat and RAW FAT/SPL drains bug-for-bug, InflictDisease's level-1 immunity + full-save resist + no-double-catch, Heal{Attribute} healing disease damage without curing, and the OnMonsterHit rider table wired per landed hit at the FormulaHelper.cs:662 seam - rat/bat/zombie/mummy/vampire rolls, nymph/lamia fatigue x2 x64, specials routed) + S19a PARALYZE (2026-08-16: (0,255) with AssignBundle's exact chance/save gate order incl. the AddState-first re-cast quirk, the spider/scorpion Spider Touch free-cast rider closed, the full IsParalyzed consumer set - player input/jump/weapons in both hosts, foe motor+attack freeze; plus the classic subType BYTE-CAST parity fix: 0xFF reads -1 and the 255-keyed doors never fired from real records) + S19b POISONS (2026-08-16: the 12-variant enum + timing tables byte-exact, minute-tick lifecycle Waiting/Active/Complete with drug positives stripped at the crash and attribute damage persisting until healed, InflictPoison's career-immunity/save/level-1 gates, the ItemHelper weapon-poison spawn roll + the inflict-once-and-clear formulas seam at both enemy-vs-player sites) + S19c CURES (2026-08-16: (3,0..2) chance-gated instants - CureAll* as IMMEDIATE bundle removal lifting disease/poison statMods now, CureParalyzation ending the incumbent instantly, the AssignBundle failure messages on player hosts) SHIPPED - the S19 group (Paralyze/poisons/cures) is CLOSED - + S20 EXHAUSTION/REST (2026-08-16: the three per-hour recovery rates verbatim incl. RapidHealing/NoRegenSpellPoints decodes, the OnExhausted collapse - a safe hour of rest vs death near enemies or in water, fed by the P13 senses fields - and the once-per-minute-change fatigue-drain parity fix) SHIPPED (the rest UI consuming the rates is U7, the UI arc) + S21 CONCEALMENT (2026-08-17: Invisibility 13,0/13,1 + Shadow 24,0/24,1 + Chameleon true 23,1 - the P13 gate's inert branches go LIVE, normal/true folding per IsInvisible/IsBlending/IsAShade, the verbatim Illusion costs, start messages once on new incumbency through the sinks.say seam; with P15 sneak the full illusion-stealth play works; foe-side visuals pend) SHIPPED + S22 FREEACTION (2026-08-17: (26,255) Restoration duration buff on the generic incumbent branch; the READ-TIME immunity fold - IsParalyzed = !immune && paralyzed, a covered paralysis ticks underneath and RESUMES - and the AssignBundle silent drop of incoming Paralyze; career/racial immunity FLAGGED to the tolerance decode) SHIPPED. Next: economy/enchantments or the library's next family.
- `07-Rendering/Rendering.md` - COMPLETE again. R12 THE EXTERIOR INDIRECT PLAYER LIGHT (2026-08-16: the SunlightRig point light from the serialized prefab - 1.0/range 150/0.706 gray - daylight-scaled at the player across all four lit programs, shot-proven near-ground brightening with a byte-identical sky). Queue EMPTY.
- `10-UI/UI-Arc.md` - ACTIVE. U1-U5 + U6 THE ACTION TEXT BOXES (2026-08-16: ShowText 8600 / ShowTextWithInput 5400 with the verbatim riddle answers gating ActivateNext / DoorText 7700 with the patch table and the first-activation door hold; TEXT.RSC live), input map, CLICK-TO-CAST SHIPPED, U7 THE REST WINDOW (2026-08-16: KeyR, timed/full/loiter on the S20 per-hour rates, 354/355 pre-gates, enemies break rest live under the overlay). Queue: window art, per-ID verification.
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

## Open flags (regenerated 2026-08-17, the T3c slice)

Regenerated at the S20 close (the drainFatigue "exhaustion pends"
comment SHIPPED out; line numbers refreshed). Every row below is a
live
INTERIM/FLAGGED/PENDING site in src; the code comment at each site is
the authority. `src/render/characterSprite.js` FP framing constants
stay open to Mac's eye in live play (probe-locked).

- `src/characters/enemyMotor.js:308` - FLAGGED, until target prediction ships). At zero the foe stops.
- `src/characters/mobileUnit.js:18` - clock). DEFERRED (FLAGGED): the Seducer transform pair.
- `src/characters/playerEntity.js:5` - UI later fronts it everywhere). INTERIM until then, loudly: flat
- `src/characters/playerEntity.js:12` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:15` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:17` - fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stats above); applyChar...
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): adrenaline rush
- `src/combat/formulas.js:245` - *  MobileEnemy.Weight, class = female 240 / male 350. FLAGGED: the
- `src/combat/playerWeapon.js:13` - INTERIM (loud): the equipped weapon is an Iron Dagger until the
- `src/combat/playerWeapon.js:47` - /** INTERIM starting weapon (items arc replaces): Iron Dagger. */
- `src/combat/playerWeapon.js:48` - export const INTERIM_WEAPON = Object.freeze({
- `src/combat/playerWeapon.js:78` - constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
- `src/combat/weaponRig.js:33` - *                     (FLAGGED at the call sites - their HUD pends),
- `src/scenes/arrestFlow.js:100` - SeverePunishmentFlags |= 1 consequences pend (FLAGGED)
- `src/scenes/cityGuards.js:23` - FLAGGED loud: arrest/court pends (guards fight to the death for
- `src/scenes/cityGuards.js:92` - attack.rangedAttack = false;   // FLAGGED: guard archers pend exterior foe arrows
- `src/scenes/dungeonContext.js:159` - the chain lives, the motion is INTERIM (loud) until flats can tween.
- `src/scenes/dungeonContext.js:478` - index into the 18 careers) or the INTERIM default Warrior (16,
- `src/scenes/dungeonContext.js:484` - effects FLAGGED to the effect-library slice.
- `src/scenes/dungeonContext.js:498` - "database FLAGGED" narrows to the skill/loot message ids).
- `src/scenes/dungeonContext.js:632` - drained strength lowers the ceiling). INTERIM (loud): the
- `src/scenes/dungeonContext.js:747` - FLAGGED: DFU recomputes per-effect via the cost tables (that
- `src/scenes/dungeonContext.js:749` - FLAGGED to the effect library (caster-only buffs, touch, areas).
- `src/scenes/dungeonContext.js:960` - 129; the inventory/equip UI pends - the INTERIM dagger note
- `src/scenes/dungeonContext.js:1694` - actions) is FLAGGED - the player snapshot only.
- `src/scenes/exterior.js:281` - it). say -> console FLAGGED: this host has no HUD-text layer yet.
- `src/scenes/exterior.js:335` - day-skip is a no-op FLAGGED until the shared calendar lands).
- `src/scenes/exterior.js:456` - (FLAGGED: the climate People table pends; the test city is
- `src/scenes/exterior.js:525` - FLAGGED here exactly as in world.js - no tile lookup yet).
- `src/scenes/townTalk.js:16` - FLAGGED loud: Info mode opens the same talk window (DFU routes
- `src/scenes/townTalk.js:235` - GetAnswerWhereIs (knows-always FLAGGED) + the %hnt hint chain:
- `src/scenes/townTalk.js:243` - .replaceAll('%hnr', 'Sir').replaceAll('%ra', 'Breton');   // honorific/race macros FLAG...
- `src/scenes/world.js:407` - it). say -> console FLAGGED: this host has no HUD-text layer yet.
- `src/scenes/world.js:411` - FLAGGED loud: the People faction rides the START location's
- `src/scenes/world.js:453` - day-skip is a no-op FLAGGED until the shared calendar lands).
- `src/scenes/world.js:692` - exemption (PlayerTileMapIndex == 0) is FLAGGED: this host
- `src/scenes/world.js:867` - doors are the E-enter seam, not bashables - FLAGGED with the
- `src/scenes/worldModes.js:59` - say -> console FLAGGED: the interior HUD-text layer pends its arc.
- `src/systems/advancement.js:18` - INTERIM (loud): we apply immediately - level = calculated,
- `src/systems/advancement.js:82` - * skill ids. The headless level-up applies immediately (INTERIM,
- `src/systems/chargen.js:6` - the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
- `src/systems/chargen.js:21` - INTERIM (loud): the UI distributes the bonus pools by hand; the
- `src/systems/chargen.js:124` - /** INTERIM headless pool policy (loud; the chargen UI replaces it):
- `src/systems/chargen.js:143` - spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy ...
- `src/systems/court.js:7` - People-faction half-delta FLAGGED to the save-side clone).
- `src/systems/court.js:27` - FLAGGED loud: guild rescues (Thieves/Dark Brotherhood) pend the
- `src/systems/court.js:70` - ChangeReputation(peopleFaction, -loss/2) FLAGGED: the save-side
- `src/systems/court.js:95` - *  daysInPrison } (guild rescues FLAGGED). */
- `src/systems/effects.js:25` - FLAGGED skipped (the library grows here).
- `src/systems/effects.js:92` - FLAGGED: career hard-immunity (Career.Paralysis == Immune) and the
- `src/systems/effects.js:530` - out.skipped++;   // FLAGGED: the library grows one family at a time
- `src/systems/inventory.js:12` - weight pends S2b (FLAGGED - leather/chain/plate multipliers).
- `src/systems/loot.js:17` - INTERIM (loud): MI (magic items) rolls are SKIPPED until the magic
- `src/systems/loot.js:169` - FLAGGED to the economy slice (shops).
- `src/systems/save.js:7` - (foes, loot piles, action states, doors) is FLAGGED - dungeons
- `src/systems/skills.js:56` - *  +0.1) and the Jump spell (+0.6) are INTERIM 0 here, loudly - the
- `src/systems/talk.js:17` - crime/quest slices - FLAGGED there, not here).
- `src/systems/talk.js:78` - *  FLAGGED to the crime slice - the state lands now, verbatim).
- `src/systems/talk.js:91` - TallyCrimeGuildRequirements(true, 1) FLAGGED: thieves-guild
- `src/systems/talk.js:98` - SpawnCityGuards(true) FLAGGED: the crime/guards slice mounts the response.
- `src/systems/talkSession.js:19` - FLAGGED: the guild greeting indexes (records 8550..8571) pend the
- `src/systems/talkTopics.js:18` - doctrine-kept). FLAGGED LOUD: the NPC knowledge roll
- `src/systems/talkTopics.js:150` - *  always (the knowledge roll FLAGGED). Returns { textId, direction }
- `src/ui/actionText.js:7` - (backgrounds FLAGGED pending art-name verification, the shared UI
- `src/ui/chargen.js:11` - background ART is FLAGGED pending art-name verification against
- `src/ui/chargen.js:148` - ---- drawing: clean classic-text panels (art FLAGGED, see head) ----
- `src/ui/charsheet.js:8` - classic INFO background ART is FLAGGED pending art-name
- `src/ui/hudText.js:5` - improved."); the TEXT.RSC database itself is FLAGGED - these
- `src/ui/inventory.js:2` - windows in classic text (backgrounds FLAGGED pending art-name
- `src/ui/inventory.js:9` - Enter readies one (retires ?spell). INTERIM loud: with no
- `src/ui/inventory.js:85` - /** The known list: entity.spells when it exists; the INTERIM fallback
- `src/ui/restWindow.js:2` - text-panel idiom (backgrounds FLAGGED pending art-name

## Audits

Newest first.

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
