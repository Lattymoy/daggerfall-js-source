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
DO NOT FIX WHILE THE VERIFIER IS READING (17l). An adversarial
review reads the WORKING TREE. Fixing its findings while its
verify pass is still running makes every verdict come back
"refuted - the code you quote does not exist", which is
indistinguishable from "the finding was wrong". 17l's eighteen
verdicts all landed that way and had to be re-read by hand to
tell the two apart (one of them says outright that the DFU
reading was accurate). Either let the verify pass finish before
touching the tree, or hand the verifiers a snapshot.

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

A SLICE CLOSES ITS LEDGER ROW (2026-08-19). Port-Ledger section C
is not a memo, it is a CLAIM that something is unported - so a
stale row is worse than a missing one: it sends the next slice off
to build what already ships. Before closing, grep section C for
the DFU members you touched and strike, narrow, or update every
row you moved. `node tools/ledgerSweep.mjs` narrows the read: it
cross-references each unstruck row against the arc docs' own
SHIPPED/CLOSED headings and against non-comment src/. Run against
the pre-sweep ledger it caught 2 of the 4, with 2 standing false
positives - A CLEAN RUN IS NOT PROOF. It missed the two that a
matcher structurally cannot catch: one where the port RENAMED the
member (MakeHouseContainer -> isHouseContainerModel) and one where
the closing slice used its own vocabulary. Those need the eye.
The failure mode is specific and it is NOT forgetfulness: all four
rows found stale in the 2026-08-19 sweep were closed by a slice in
a DIFFERENT arc from the row's Target column. P12 (Player) shipped
breath/drowning; Audio closed the transition stingers as verbatim
N/A; S2b and E2 (Systems) shipped two thirds of the interior
container row; S23/S24 moved five career flags from INERT to LIVE.
Every author updated their OWN arc doc and none thought to touch a
ledger row filed under someone else's. So the sweep is owned by the
slice, not by the arc - if you shipped a DFU member, the row naming
that member is yours to close no matter whose column it sits in.
NARROW, do not strike, when a slice ships part of a row: say what
landed and what is still open, or the next reader reads a partial
close as a whole one.

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

THE HISTORY WAS REWRITTEN ON 2026-08-27, before the repository went
public as daggerfall-js-source (Mac's call, with the MIT licence and
DFU's notice). Four paths that had once been committed and later
deleted still sat in every old commit - the classic BODY00I0 sprite
under src/characters/paint/, the AUDIT 21 gallery frames under
public/visual-changes/, and the two traced-silhouette JSONs under
src/characters/backs/ - and a public repository publishes its
history, not its tree. `git filter-repo` removed those paths from
every commit on every ref; 1,420 commits changed sha. Every sha this
bible cited was rewritten to its new value from the commit map (36
of them; the map itself is NOT committed - it is a list of the old
shas, which is the one thing that must not be published). The
previous repository was kept private under another name. If a sha
cited anywhere fails to resolve, that is why, and Mac holds the map.

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

- `01-Overview/Audit-26.md` - CLOSED 2026-08-26: THE FULL-TREE PARITY AND BUG AUDIT. 43 surveyors over the whole of `src/` against the whole of DFU with the C# in the container; 223 claims, 218 confirmed, 5 refuted (67 bug / 89 parity / 62 nit). The bugs were fixed in clusters across 2026-08-26/27; the parity and nit findings are 117 rows in Port-Ledger section C, every id greppable. Verification was two-tier and the page says so.
- `01-Overview/Audit-UI.md` - CLOSED 2026-08-27: THE ENHANCED SURFACE AUDIT. Twelve sweeps over the PX arc's 54 slices, nine modules and 7,130 lines - and LIVE, not static, because a sheet this size answers grep questions with grep answers. Two findings, both fixed: the 44px touch rule hung off a SCREEN WIDTH and failed on the device the proxy stands in for (measured on an iPad in landscape: skin switch 28px, steppers 34px, value buttons 38px), and the reason the fix at first did not take - three controls sized INLINE in JavaScript, which no media query can reach. Eight sweeps came back clean, including the class-collision shape that has bitten this file four times.
- `01-Overview/Audit-27.md` - CLOSED 2026-08-27: THE STATE-OF-THE-TREE AUDIT. Not a parity sweep (AUDIT 26 was the day before): ten mechanical sweeps over the tree and the bible for the things a parity read does not look at - dead exports, four-hosts seams, citation integrity, allow-list drift, URL flags, Ledger and Testing.md consistency - plus a doctrine read of the day's own work. 6 findings, 3 fixed on the spot.
- `07-Rendering/Rendering-Arc.md` - ACTIVE. The R-slices, and since 2026-08-27 the ENHANCED SKY (ES1-ES1f): a procedural dome behind the skin toggle, drawn with no game data at all - sun and moons on the port's own clock and DFU's phase law, weather from the sim eased over 14 s, two sun-lit cloud decks, a star field that wheels, the cloud in front of the sun dimming the world's key light, and a RETRO pass on the painted sky's own angular pixel (256 cells a face, 512 across 180 degrees) posterised with a Bayer dither. 13 pins, probe 10/10.
- `01-Overview/Audit-25.md` - CLOSED 2026-08-23: THE COMPLETENESS AUDIT. The first audit whose denominator is the DFU tree rather than `src/`: 27 subsystem groups over a real 849-file checkout, a surveyor and an adversarial refuter each, four reconciliation passes. 767 surviving gaps, ~63,400 JS lines. Six systems at or near zero (enchanting, both automaps, the magic crafting windows, banking, the classic `.SAV` reader, the pause menu + keybinding registry) and seven P0 host seams, all of them wire for laws already ported. The gap register and the slice order live in the page; the ledger rows it found are folded into `01-Overview/Port-Ledger.md` section C.
- `01-Overview/Audit-24.md` - CLOSED 2026-08-22: THE FULL-CODEBASE PARITY SWEEP. A 145-agent workflow read the 161 port modules that cite a C# original against the DFU tree in 21 groups; every claim went to two independent refuters (one C#-side, one JS-side, both refute-by-default) and 54 of 62 survived both. ALL 54 ARE FIXED AND PINNED, in five waves, every pin verified by reintroducing its bug: the hovering flyer's fall anchor, the DFRandom byte that stopped drawing mid-swing, the bow band's missing DetectedTarget/GiveUpTimer gates, the swimmer measuring from the standing capsule at five water sites and AddMovement's three arms in the wrong order, the legal-rep clamp running before the restore, the shield that never reached the forbidden-material arm, the Place expansion stealing the pronoun context, the five missing capitalized pronoun macros, the quest popup that revealed no dialog links, the CurrentLogMessageId latch that made every %qdt print the accept date, the Transportation item that could be dropped into its own wagon, the journal filtering on formatting names nothing emits, ScreenDimColor (Color.clear, and eighteen windows assign it), the swing gate that compared the sum where DFU compares the trail, MaxGestureSeconds as a sliding window, the cancelled bow draw that was free, five format readers, seenByGuard behind a clear line of sight, DateString's invented format, and a saving throw whose element and flag were driven off one predicate. FOUR EXISTING PINS HAD RECORDED THE BUG AS THE LAW and were corrected, not extended - including AUDIT 19 F2, which had 'fixed' the letterbox in the wrong direction a fortnight earlier. A pin that restates the port instead of the source is not a pin
- `02-Formats/Morrowind-Rules.md` - REFERENCE ONLY, nothing implemented. What OpenMW actually does for the first-person body, cited file:line, after the first Morrowind import arc was reverted whole for shipping three fixes built on guesses. 129 rules across the body, skeleton, animation, attachment, skinning, text-key, node, material, keyframe, geometry, container and VFS layers, EACH CARRYING ITS OWN CONFIDENCE - verified unanimously, verified with a recorded caveat, or extracted-but-unverified (the gap pass was stopped on cost with its readers done and its verifiers part-run, and is labelled that way rather than presented as finished) - 18 read by hand, 48 by a 151-agent fan-out in which every rule faced three verifiers told to refute by default (19 unanimous, 29 carrying a recorded caveat, 0 refuted). Part III lists what a port STILL does not know, led by keyframe track evaluation - the step between 'which clip' and 'which vertex' that nothing has read yet - including the two that matter most: a first-person body part is a RECORD whose id ends in `1st` (not a mesh filename), and there are ELEVEN weapon short groups where the reverted arc had four.
- `02-Formats/Readers-Arc.md` - COMPLETE. All 8 format readers shipped with corpus gates (+ SKY under R4, + GFX under U18 - post-close additions with gates of their own).
- `03-World/World-Arc.md` - ACTIVE again: TOWNS. M1-M9 COMPLETE + T1 THE WANDERING POPULATION (2026-08-17: CityNavigation's automap-carved weighted navgrid - the per-block row flip proven against the rendered tilemap - MobilePersonMotor's road-following seek + the verbatim politeness idle, PopulationManager's 10Hz pool with anti-skate/night/view-gated pop-in, the verbatim race texture tables; townsfolk probed walking Daggerfall's streets, the closeup identical to raw 386/5) SHIPPED + T2 THE STREAMING MOUNT (2026-08-17: per-location-pixel pools in ?world with the verbatim StreamingWorld location-type gate, persons in the location frame converted through the live floating-origin translation, batches destroyed with their pixel; probed live at Daggerfall city center - the politeness idle on the fly cam, archive 456 identical to raw 456/5) SHIPPED + T3a THE TALK FOUNDATION (2026-08-17: FACTION.TXT verbatim - 366 factions, the tab-stack tree, ruler seeds in classic call order; findFactions/People-of-region/getReactionToPlayer verbatim; pickpocket with the 5..95 clamp, gold/nothing/caught outcomes and the crime state - guards FLAGGED to the crime slice) SHIPPED + T3b THE TALK WINDOW + ACTIVATION (2026-08-17: F1-F4 interaction modes, the person-cylinder activation ray at 6.4/3.2, the reaction greeting ladder 7206-7209 with %pcf/%oth macros through the real TEXT.RSC, the shared townTalk seam in BOTH exterior hosts - their first HUD-text layer; probed live: "Yes?" in the panel, "You pinched 1 gold piece." on the HUD) SHIPPED + THE T3-TOUCH ADDENDUM (2026-08-17: the phone path - a live-labeled mode-cycle button on the touch row driving the verbatim NextInteractionMode wrap, E doubling as goodbye while the window is open; hasTouch-probed: grab -> info -> dialogue taps + E open/close live) SHIPPED + G1 THE CITY WATCH (2026-08-17: the crime circuit closes - SpawnCityGuards verbatim (guard NPCs first, behind-player civilians 1/4, the 2-5 ring fallback, max 5, the witness/countdown path), Knight_CityWatch class foes as the FIRST exterior foes on the C11 stack in both hosts, the GiveUpTimer hostility law joining EnemyAI generally (detection refills 200 classic ticks; MakeEnemyHostileToAttacker pre-loads x3), combat both ways + HALT + corpses; probed live: a ring guard marched 30 units, detected, and swung - the close-up crops the classic plate knight 399) SHIPPED + G2 ARREST + COURT (2026-08-17: the crime loop completes - the EnemyAttack interception withholding the first guard hit for the surrender box, SurrenderToCityGuards' SetHealth(1)/rep gates/DFRandom coin, the DaggerfallCourtWindow math verbatim incl. THE NEVER-CHARGED VERDICT QUIRK, sentence rep raises, the crime-clear stand-down; probed end to end: box -> Y -> court -> G -> crime 0, LegalRep -2, guards gone) SHIPPED + T3c WHERE IS (2026-08-17: GenerateBuildingName verbatim over the full classic name lists, the named-building pool merge with per-instance door resolution, the 30-record answer table + the NPC-stable reaction tier + the %hnt/7333 hint chain with the verbatim 8-way compass; probed live - 62 named Daggerfall buildings, a tier-0 commoner refusing rudely; the streaming-host directory FLAGGED as the follow-up) SHIPPED + AUDIT 2026-08-17c (the guards/court/where-is parity pass - five findings fixed with pins: the subrecord-bounded pool merge, the overlay callback clear, the Dodging tally, the seen-by-guard mass conversion, the court macro expansion; see Audits) + T3d THE STREAMING WHERE-IS (2026-08-17: the T3c host-rule debt clears - a location-pixel tracker swaps townTalk's topics on pixel crossing, doors + player resolved in the pixel's LOCATION frame through the floating origin (pure translation, answer-invariance pinned), names on the pixel's OWN region; found on the way: buildingDoors leaked on destroyPixel - fixed; probed live: the same 62 Daggerfall names as the fixed host, E -> W -> Alchemists -> a classic answer) SHIPPED + G3 CORPSE LOOT (2026-08-17: killed guards are E-ray pickup targets on the dungeon's S2 shape in both hosts (walk-aways vanish with their items); THE PARITY FIND - Knight_CityWatch has no LootTableKey in DFU, the droppable loot is the EQUIPMENT via Items.AddItem, ported as equipmentItems() and ALSO fixed in the dungeon where class-foe corpses had dropped no equipment since E4b; probed live: Longsword + 5 armor pieces off a corpse, no double takes) SHIPPED + T3e THE KNOWLEDGE ROLL (2026-08-17: GetNPCKnowledgeAboutItem verbatim - seeded by NPC hash + MakeBuildingKey ((x<<16)+(y<<8)+record, 0 -> 1<<24), the 40-entry knowledgeModifiers table, rand(1,20) <= mod+10; the doesn't-know half of answersToDirections is REACHABLE now, seed-stable per (NPC, building); pinned over 200 seeds + probed) SHIPPED + T3f TONE BUTTONS (2026-08-17: GetReactionToPlayer_0_1_2 in FULL - the etiquette/streetwise mod tables with the Merchants fold, the Dice100 skill roll -10/+5, the per-session reaction cache + first-use tally + the lastToneIndex recompute gate, tone persisting across sessions; one T key cycles the three DFU buttons with a live label; probed live - a Blunt re-ask at reaction 30) SHIPPED + G4 MURDER + ASSAULT (2026-08-17: the crime table's teeth - a weapon strike one-hit kills a wandering civilian (Murder + the response), a wandering guard NPC converts on the spot (Assault) with the swing carried onto the fresh foe, killing the watch is Murder on the real death path; WeaponManager/HandleAttackFromSource verbatim in both hosts; probed live - swing four connects, crime 5, two guards march in) SHIPPED + T4 THE 35% MAP-REVEAL + %hnr/%ra (2026-08-19: GetKeySubjectBuildingHint verbatim - %hnt forks to the 7333 directions or the 7332 map reveal at ChanceToRevealLocationOnMap 0.35, reveal AT the boundary per DFU's `>`, never while inside, the roll injectable per the Ledger A engine-PRNG rule; the %loc mark = PlayerGPS.DiscoverBuilding as systems/discovery.js, one module-level store riding the save envelope, pre-T4 saves restoring empty; the fork LAZY on records carrying %hnt so refusals never roll or mark; %hnr = GetHonoric's Sir/Ma'am by gender and %ra = the BIRTH race display name, tables pinned against DFU's Internal_Strings with the two-word elves; fork/inside-gate/no-dupe mutants all caught) SHIPPED + P2 THE DROPPED-PILE MAP TAIL (2026-08-20: items-2 closed with its premise CORRECTED - the reference DESTROYS out-of-range piles mid-session (CollectLooseObjects :1040-1052) and only the save re-mints them, where the port's piles were immortal AND absent from the world save; dropPile stamps the map pixel at track time, the world host's pixel teardown sweeps its piles through collectPixel, and the F9/F11 envelope grew the piles halves in NATIVE coordinates with the SAVED record never rerolled - the reroll mutant survived a fixed roll seam and the pin was strengthened to a poisoned pick before it died) SHIPPED + TV TRAVEL-MAP DUNGEON VISIBILITY (2026-08-20: hidden means hidden - checkLocationDiscovered verbatim on the typeahead (the baked MapTable flag OR the runtime store, one uniform test, towns passing by DATA), the index rows carrying mapId + the baked flag, and the write half at the pixel-crossing tracker so foot entries and fast-travel arrivals discover through one writer; 2 pins, 3 mutations killed) SHIPPED. Next: riding, or a fresh arc (Mac's call welcome - economy and guilds shipped in the Systems lane).
- `03-World/Player-Arc.md` - ACTIVE again. P1-P9 + P10 TELEPORTERS + DOOR LOCKS (the delegates verbatim, RDB starting locks + look-at-lock tiers, flat/marker actions joining the graph, the repeated-block action-key collision fixed) + P11 SWIM/LEVITATE (2026-08-16: the LevitateMotor path with GetSwimSpeed and the surface clamp, the swim toggle + splash, Levitate (14,255) end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) + P12 BREATH/CROUCH (2026-08-16: MaxBreath = END/2 with the classic-update drain every 19th tick and SetHealth(0) drowning at the 76*GS head-under threshold, WaterBreathing (30,255) gating it, the verbatim HUDBreathBar; crouch 0.9/0.8 on the KeyX edge in both hosts with crouchSpeed, a per-call collider capsule height, and the CanStand ceiling probe) + P13 STEALTH (2026-08-16: the oldest src flag closes - the classic detection flow with hearing gated on prior detection, the once-per-minute StealthCheck with spawn-band gating/odd-minute sneak skip/fast-move auto-detect/the shared Stealth tally, and the verbatim illusion gate with the 13 sees-through monsters - retiring the S8 half-sight interim, which had been DEAD post-merge) + P14 MOVEMENT PARITY (2026-08-16: the live jump/incline report - Mac's reverted 03cfa1e re-derived on the crouch-height tree: final-vertical-state grounded truth un-killing the one-frame jump, the ascending step-lift ladder with the monotone ceiling sweep and the no-depenetrate-into-ceiling clamp, slopeLimit-70 pinned 60/78; plus the verbatim jump laws - the 0.1s GroundedTime gate with HELD jump input, jumpSpeedMultiplier via Jumping skill, crouched x0.8, the moving-jump forward boost, frozen airborne momentum, HitHead reversal - and CheckFallingDamage end to end with sounds 91/92 in all four motor hosts, slowfall to the verbatim -105*dt law) + P15 SNEAK (2026-08-16: AltLeft held per DFU's default - the grounded-only run/sneak latch, running beats sneaking, base/2 - 1/39.5, swim ignoring both verbatim; IsMovingLessThanHalfSpeed now TRUE while sneak-moving, so the P13 stealth checks apply to a MOVING player) + P16 THE FIXED PHYSICS TIMESTEP (2026-08-17 live hotfix: update() accumulates render dt and steps at 1/60 with the 0.25 jank clamp - Unity FixedUpdate IS the missing parity law; real-mesh traces proved the deployed motor failed real staircases and collapsed jumps at phone frame rates while being correct at 60; + the ceiling entry-clamp firing only on residual penetration and the ladder capping rungs at resolved height) + P17 FOE-AI FIXED STEPPING (2026-08-17: the P16 accumulator law on EnemyAI - the whole body, senses cadence + physics, steps at 1/60 with the 0.25 jank clamp; a 10fps foe pursues bit-identically to a 60fps foe; urgent once C11 put ~29 raw-dt foes in every dungeon on the deployed mobile build) SHIPPED + P18 THE P12 RESIDUE (2026-08-19: the PlayerHeightChanger timed transition - the crouch flips at the END of the shared 0.10s camTimer, the stand at the START with only the eye lagging, mid-window re-press/switch inheriting the clock verbatim; systems/breath.js - the DeepBreath refill fold with Temple Kynareth's (10+rank)/10 trunc on the Ledger A double-math precedent + the Argonian coin refund landing before the drowned check; the PlayerEntity.cs:412 Argonian swim-fatigue gate short-circuiting BEFORE the Dice100 roll; all new pins mutation-checked, the ledger row struck whole) SHIPPED + M3 CLIMBING (2026-08-20: motor-3 closes - the Climbing skill's consumer at last; player/climbing.js carries CalculateClimbingChance verbatim (5..95 clamp, Khajiit +30, both Lerp clamps) + the classic ClimbingCheck machine (the 14-unit start countdown behind the 0.12 horizontal tolerance, the base-70 start whose GROUND fail re-checks every frame without resetting the timer - the verbatim tally-spam quirk - the base-40 mid-fall grasp that DOES reset, the 15/5-unit continue/regain cadences at 50/20, standing still cannot slip, the tally once per check, the underwater fail forgiveness); the motor owns the wall probe (the hit -normal latched so the hug rides the WALL's plane - raycastHit grew the surface normal) and the classic ClimbMovement arm (wall-hug at the stale Speed + up at Speed/3, the release falling from the release height); wired at all three PlayerMotor sites, no deps = no component; AdvancedClimbing's corners/rappel/hanging stay with their setting; 5 pins incl. a LIVE wall climb, 6 mutations killed; PROBED LIVE in-browser - tools/climbProbe.mjs stands square at a building door via the new __doorSpots surface, holds W through the real key path, and the capsule ROSE 1.1 up real city geometry with the release aborting and the drop landing) SHIPPED. U31 THE FIRST DUNGEON HAS A DOOR OUT (2026-08-21, reported from play: the bare URL booted scenes/dungeon.js, a dev host with NO exit branch at all, so every new character opened their eyes in Privateer's Hold and could never reach Tamriel - while the finished, tested dungeon->exterior transition sat in the world host the classic start never booted; the classic start now takes StartGameBehaviour's own shape, reading StartCellX/StartCellY out of the store and gating start-inside on the setting AND hasDungeon, with 109/158 verified against the real MAPS.BSA to be Privateer's Hold and those three keys promoted from stored to LIVE; startInDungeon routes THROUGH tryEnterDungeon because that call is what records dungeonReturn, without which the player would start correctly and strand exactly as before; 4 pins, 4 mutations killed, and PROVED LIVE - tools/classicStartProbe.mjs stands at the real exit door, makes the same activation a player makes, and comes out in the world) SHIPPED. Next: riding (the monster pivot shipped as Combat C11).
- `04-Characters/Characters-Arc.md` - ACTIVE again at CH-C (2026-08-20, the C-slice's three characters rows: the ARCHER BAND - the strict 6..51.2m band owns a bow foe at 1/32 per classic update with the melee fallback at reach, per-SWING record/damage keying; ENEMIES OPENING DOORS - the sight ray's blocking bucket names the door via the collider's new raycastHit and a CanOpenDoors foe within 2m toggles a closed unlocked door through the ActionSystem; PACIFICATION - CalculateEnemyPacification + the language table on the first-encounter senses edge, success gates the decision tick itself and damage re-hostiles) SHIPPED + CH-X THE EXTERIOR MOBILE-FOE MOUNT (2026-08-20: scenes/exteriorFoes.js - S32's above-ground encounter arms LIVE in the streaming world; the shared foe pieces minus the watch's crime machinery, the classic per-minute catch-up with the PreventEnemySpawns travel reset, spell + melee targeting through both pools, corpses, the floating-origin follow; probed live - a rat closed on the player) SHIPPED + CH-X2 EXTERIOR ENEMY ARCHERY (2026-08-20: the loud rangedAttack residue retires - bow foes arm by the dungeon's ranged-flags law, the C-slice band fires above ground, the shoot frame looses a REAL hunting arrow through the C13 flight's new enemy meta (the dungeon missile's mid-capsule contact law) with ArrowShoot from the archer, and the impact runs the shared damage member - Dodging tally, the C2 poison seam, the recoverable arrow) SHIPPED + CH-X3 EXTERIOR ENEMY CASTING (2026-08-20: the dungeon's cast executor extracted whole into characters/enemyCasting.js behind injected deps - the silence gate, the player-priced cost, the at-caster AoC, the missile loose - the dungeon rebound onto it; exterior spawns assign the S16 lists and mint the shared decision driver, releasing through the one executor with the engine's NEW enemy-missile arm hunting the player at the caster's level; the above-ground combat arms are COMPLETE) SHIPPED + CH3 FALL DAMAGE AND THE SWAP PAUSE (2026-08-20: the foe motor tracks its grounded height and a past-threshold landing bills the player's own fall formula through both pools' damage doors with the FallDamage clip - a knocked-down flyer measures from its last ground contact; and the equip-delay table finally has its consumer - both halves of a hand swap bill the countdown and the rig blocks the attack while draining at the classic 980/s, the shield-indexes-the-weapon-table quirk preserved; the senses fine-grain trio row stays open pending its own verify pass) SHIPPED + CH4 THE SENSES VERIFY PASS (2026-08-20: characters-9/10/12 resolved by re-reading EnemySenses/EnemyMotor whole - roll order verified CLEAN (illusion die classic-gated, stealth die minute-gated, CalculateStealthChance byte-exact); the yaw gate was REAL - the stopped look-at-target branch turns at 22.5 (:514), not AttemptMove's 5.625, so melee foes stand up to 22.5 off-face now; the cadence was REAL - sight/hearing/detection resolve EVERY fixed step as DFU's FixedUpdate does, with only the spawn-band recompute + illusion re-roll classic-gated; the hearing ray now casts CENTER to center (:942); and the dungeon foe snapshot carries isHostile/hasEncounteredPlayer/magicka with presence-gated restores) SHIPPED. Before that: C8 shipped E1-E4b end to end + spectral; E4c deferred by Mac; remaining interims are Systems work (ledger below).
- `05-Combat/Combat.md` - ACTIVE again. Core via C8; Hurt traps, CastSpell (S4b), bows both directions, the collision-trigger seam (input-held gate, 08-16), the Attack trigger + door bashing (WeaponEnvDamage, 08-16), the TRUE classic FP weapon + its six-finding parity audit (08-17, the parallel lane) + C9 THE HOST ROLLOUT (2026-08-16: combat/weaponRig.js mounts the audited weapon surface in the interior mode and BOTH exterior walk hosts - RMB drag/click, Z sheathe per mode fixing the interior Z crash, envAttack bashing interior swing doors, bows consuming arrows; dungeonContext's inline copy folds onto the rig when the FP lane settles - recorded) + C10 THE RIG FOLD (2026-08-16: dungeonContext's inline weapon collapses onto weaponRig - one home for the audited surface, the env ray now the shared envAttack, the rig canvas late-resolvable; parity-positive deltas: the weapon exists in foe-less dungeons and the listener/ambient pass un-gates - it had sat inside `if (playerWeapon)` and foe-less dungeons silently lost 3D audio since A2 - and the touch tap gains the sheathed gate) SHIPPED + C11 THE MONSTER PIVOT (2026-08-17: monsters 0-42 go LIVE - classic 8-orientation sprite mobiles (characters/mobileUnit.js, DaggerfallMobileUnit/EnemyBasics verbatim: the record layout, the signed-angle orientation law, attack sequences with the -1 damage marker + chance-rolled variants, hurt one-shots, the rat/ghost/wraith/slaughterfish/scorpion quirks, the Ancient Lich frame rescale) on the SAME combat spine as the class enemies - EnemyAI/EnemyAttack/entity/loot/S16 spells/S18 riders/corpses; one live billboard batch per foe over dataPipeline.uploadRecordFrame; foes DEFAULT ON in all hosts; THE BILLBOARD-AXIS DOCTRINE ground-truthed - DFU's flip booleans are correct only under the hosts' flats axis (the negated view row), the raw view row moonwalks every side view; cast/ranged anims + Seducer pend) SHIPPED + C12 THE BEHAVIOUR MOTORS (2026-08-17: CanFly = Flying|Spectral - imps/bats/harpies/ghosts/wraiths pursue in 3D at the target face with NO gravity, hover at spawn, floor-skim guard; Aquatic = WaterMove verbatim against the P11 block water surface - the 2.5 head margin, beached fish FROZEN; paralysis through the motor: flyers fall out of the air, swimmers freeze; flyer corpses land) SHIPPED + C13 HOST ARROWS (2026-08-17: combat/arrowFlight.js - the visible loose in worldModes interiors + both exterior walk hosts, the 99800 model on the S5 constants, lost on geometry/terrain as DFU misses are; the dungeon keeps the full seeking+recovery path) SHIPPED + C14 THE MONSTER SPELL ANIM (2026-08-17: the 13 casters play SpellAnimFrames - records 20-24 for the Orc Shaman via HasSpellAnimation, the primary records for the rest, verbatim GetStateAnims incl. no ghost/wraith special; attack>cast>hurt interrupt laws pinned; RangedAttack1/2 closed as class-enemy-only) SHIPPED + C15 KNOCKBACK (2026-08-17: WeaponManager speed formula floored at 15 classic + the Weight>0 gate - spectrals immune - and KnockbackMovement on the fixed step: shove along the attack ray, 25-cap/5-decay, hurt rides the threshold NOT the hit, flyers knocked out of the air; the C11 per-hit hurt retired) SHIPPED + C16 THE -1 DAMAGE MOMENT (2026-08-17: mobile melee damage lands on the sequence markers - the Frost Daedra base swing strikes TWICE - via the extracted resolveFoeMelee; the machine stays the decision clock + the rigs' damage clock) SHIPPED + C17 THE HUMANOID PIVOT (2026-08-17: class enemies render as classic sprite mobiles - FemaleThiefIdleAnims verbatim, the RangedAttack1 archer state with the -1 shootFrame loose, the 475 female cast scale, gender-picked archives; the voxel foe rig ON ICE beside the voxel FP weapon; entity spine unchanged; doctrine-proven vs raw 484/19) SHIPPED + AUDIT 17k HOTFIX (2026-08-18, Mac's report: attacking with a FIST crashed - bare hands are a null weapon since U8h and the DEFAULT state (starting weapons land in the bag unequipped, as DFU's AddItem leaves them); the dungeon host read playerWeapon.weapon.name raw at both swing sites where the exterior hosts guarded - the fourth dungeon-host-falls-behind; fixed + the sweep rule + the WEAPON10 fist-art corpus pin + tools/fistProbe.mjs, fists eyeballed mid-swing; see Audits) + C18 CONDITION DAMAGE (2026-08-20, the C-slice: DamageEquipment + ApplyConditionDamageThroughPhysicalHit at CalculateAttackDamage's tail - attacker weapon + shield-covering-the-struck-part-else-armor at (10*damage+50)/100 with the 20% per-item floor roll; LowerCondition/ItemBreaks speaks and unequips, restoring the armor table; broken mundane items stay in the pack, the enchanted arm rides the enchantment arc; the frozen INTERIM dagger guarded - a fresh boot's first swing would have thrown) SHIPPED + C19 THE C2-SLICE (2026-08-20: the combat family's remaining rows - every enemy melee frame RINGS its failures (whiff + failed-roll miss sounds in all three pools, ArrowShoot from the archer's loose); the arrow-vs-player Dodging tally; resolveHit threads onInflictPoison so the player's poisoned blade/arrow doses ITS victim; the enemy melee DFRandom byte draws on every idle classic tick (the source's left operand - before the band and the timer) and the backstab Dice100 draws only behind the level>1 gate with the landed backstab speaking; COMBAT VOICES - the 1..5 spawn voice-race roll cached per foe, the male HighElf-to-WoodElf swap, the female shared-clip forks, the 20% enemy-class attack voice, the 40% pain voice with heavyDamage at a quarter of max health, the CityWatch forced male, and the player's own 20% bow-less grunt - behind CombatVoices, shipping enabled) SHIPPED. Next: economy/enchantments, towns, or riding.
- `08-Audio/Audio.md` - ACTIVE. A1 + A2 (2026-08-16: action PlaySound on every Play, torch Burning loops at 5m linear/0.7 via the new loop3d engine seam, animal random barks on the classic rand()<=100 cadence at 19.2m - dungeon-scoped) + A3 SCENE AMBIENCE (2026-08-16: AmbientEffectsPlayer verbatim - the 14 dungeon one-shots somewhere-around on the scene's serialized 5/28 waits + classic-cadence water/bubbles, the weather/time presets in BOTH exterior scenes on 5/25 with rain/crickets loops and horizon storms, one shared ambient channel; building interiors silent, verbatim) SHIPPED + A4 EXTERIOR ANIMALS (2026-08-17: the shared PlayRandomlyIfPlayerNear pass - systems/animalAmbience.js, one implementation for dungeon + both exteriors incl. the streaming world's floating-origin sources; exterior torches SILENT verbatim - Burning is RDBLayout-only in DFU) SHIPPED; transition stingers CLOSED verbatim-N/A (2026-08-17: DFU plays nothing on enter/exit or ladders - no source law to port). Next: music strategy (Mac's call) - the queue's last row. + A6 PLAYER FOOTSTEPS (2026-08-20, the FS-slice: PlayerFootsteps.cs whole - the sound-set decision with the snow gate finally consuming isSnowFreeClimate, wood in buildings, stone in dungeons with the water arms, and the classic 2.5-unit alternating stride with the landing step and the boot swallow - driven by all four hosts off their live motors; the path/water tile arms and the mount gate are the struck row's residue) SHIPPED. + A5c FROM PLAY 2026-08-27: THE HMI CLOCK - the reader ran every song 8x fast (0x0D2's 480 taken for the time base; the tick is 1/BPM, 60 per quarter, as WildMIDI, foo_midi and DFU's own shipped .mid conversions all have it); SUNNYDAY's 2.76-hour loop closed the same day - foo_midi's delta shunt, read against the real bytes + REVERTED 2026-08-27 (Mac: 'revert before we started messing with procedural audio and music'): the Enhanced Music arc - a seeded composer with a dungeon palette and a danger-driven layer mix, a streamed track player, the door's theme, and MusicVolume published live - was built in six slices the same day and taken out whole at his direction; the six commits are reverted, not rewritten, and remain in history for whoever reopens it. Two things inside it were fixes rather than the arc and were reverted with it: MusicVolume applying live (settings publish) and replacement packs taking the setting without the FM trim - both re-landed alone the same day (Audio.md: THE MUSIC SLIDER, LIVE)
- `06-Systems/Quest-Arc.md` - ACTIVE, started 2026-08-20: THE QUEST MACHINE (sourcing DECIDED, route (a) - the DFU quest pack vendored at vendor/dfu-quests). Q1 SHIPPED: the parse layer whole, corpus-gated over all 265 vendored quests with no ARENA2 needed. Q2 SHIPPED: the machine core - tick/tombstone/expiry, the action registry with ten world-free actions, live clocks, the 64-global store. Q2b-i SHIPPED (2026-08-20): the STATE tranche - 25 more actions riding resource state/time/hooks (clicks with the one-tick law and N0B00Y16's first-come ownership, kills/injuries, hide/mute/destroy/restrain, questors, faces, dialog links, prompt/video/sound, legal rep, start quest), the QuestResource click lifecycle + Quest questor/tombstone-talk halves, and the FULL RegisterActionTemplates registry mirror (ported actions + verbatim guards, 82 slots) - the coverage pin at 4818/7235 lines (66.6%) with a per-action OWNERSHIP tally against independently-derived DFU-order counts. AUDITED same day (QUEST AUDIT III): a six-lane adversarial parity re-read (4 findings fixed + pinned - the propagate=TRUE reputation flag, the missing addQuestTopics half, the faulting-quest tombstone order, the questor auto-track) and a 575-mutant campaign with full-suite confirmation (13 real survivors, each now pinned). Q2b-ii SHIPPED (2026-08-20): the ITEM tranche - the Item.cs mint whole (the create ladder over the port's item system, the classic gold reward formula through C#'s integer math with guild AlterReward, quest-linking, MakePermanent, the dispose sweep; MAGIC.DEF arms pend loudly headless - Ledger A row), the seven item actions (GivePc's offer/notify laws, GetItem's gold arm with the grounded HUD line, HaveItem's never-complete law, Toting, GiveItem's foe queue, TakeItem, MakePermanent) over the new player-inventory seams, and the QuestListsManager over the vendored QuestList tables (188 quests filed; pool laws whole) - coverage 5831/7235 (80.6%), the artifact mint retiring AUDIT 22 F11's producerless-flags pin as that pin itself demanded. AUDITED same day (QUEST AUDIT IV): nine parity fixes (the class-28 Currency mint, SetItem's condition + painting-message laws, the artifact's MAGIC.DEF value, the unlinked template form, the foe queue's duplicate refusal, the non-member AlterReward gate, InitAtGameStart's IMMEDIATE start via the machine's new startQuestImmediate, per-list error containment, the GGroupN enum names) + ONE QUIRK KEPT (Tick's double OnQuestStarted raise on the scheduled path) + the mutation campaign's survivor pins. Q3-i SHIPPED (2026-08-21): the PLACE tranche - Place.cs's site-resolution laws whole (local/remote/fixed selection with the wildcard sets, every exclusion and the 250/500 dart-throw law; QUEST-MARKER enumeration naming the two editor-flat records 199.11/18 the world layer read but never named, with the classic blockPosition+objectPosition marker identity; the marker selection/assignment law; the player-at-place checks) over the NEW deps.world seam - MapsFile/BlocksFile instances + player state, headless = sitePending LOUDLY, the corpus gate untouched - plus SiteLinks with cullResourceTarget's kept quirks, the eight place actions (PcAt's never-completing set/clear toggle, PlaceNpc/Item/Foe, RevealLocation with the grounded readMap note, TeleportPc, DroppedItemAtPlace, CreateNpcAt the documented no-op), and the clock's travel arm through the port's REAL TravelTimeCalculator (2.5x cautious-with-cart, the one-day floor, DFU's parse-order sensitivity kept) - coverage 6616/7235 (91.4%). AUDITED same day (QUEST AUDIT V): six parity fixes (the marker STRUCT-COPY law, the missing SiteLink tombstone scrub, DroppedItemAtPlace's always-on flag, TeleportPc's spawn[0] fallback, the AnyMarker null-crash parity, customParseInt's int.Parse strictness with the case-sensitive Replace quirk) + the mutation campaign's survivor pins - one drafted pin failed against the faithful port and caught the auditor's own misreading, exactly what pins are for. Q3-ii SHIPPED (2026-08-21): the PERSON tranche - Person.cs's Setup*NPC chain whole (named individuals off Quests-Factions p3, the group Questor off the new lastNPCClicked seam with the audit-III questor auto-track finally LIVE, the career switch, factionType with C#'s -1 raw-index quirk kept, the Assign chain in C#'s order incl. the HUD-face quirk and classic-srand display names, AssignHomeTown's faction-row building type with the 'house' fallback) over new world-seam members (getFactionData/findFactionsOfType/the regional faction triple; headless = npcPending LOUDLY), plus ChangeReputeWith (the propagating overload), ReputeExceedsDo, and CreateNpc/placeAtHome - coverage 6912/7235 (95.5%), pending 323 = CreateFoe 241 + CastSpellOnFoe 41 + ~41 misc. AUDITED same day (QUEST AUDIT VI): a four-lane adversarial parity re-read (10 confirmed = 4 distinct, all fixed + pinned - C#'s DEAD AssignHomeTown arm kept bug-for-bug so atHome individuals get NO home, the all-zeros default(FactionData) with race 0 = Nord, the race fold to regional for anything outside FactionRaces 0..7, Person.Tick's auto-home hot-place ported whole, ChangeReputeWith's allowRearm=false) + a two-round 396-mutant campaign (19 pins, 23 recorded equivalents, the four round-2 kills full-suite-confirmed; the career-pin draft that failed against the port caught DFU's own careerID-4 switch gap - Group_4 falls to the regional People). Q3-iii SHIPPED (2026-08-21): FOE SPAWNING - CreateFoe's tick-driven spawn law whole (four parse forms, the first-update random backdate, the interval consumed before the chance roll, the one-wave-in-flight lifecycle with one placement attempt per tick and the msg-once-on-first-foe law, InitialiseOnSet's rearm restart) over the new deps.world foe seam (createFoeGameObjects/tryPlaceFoe - the scene physics stays host-side; absent = the law idles), CastSpellOnFoe with both C# quirks kept (the template-complete miss, the null-Symbol throw), and Foe.SetFoeName's world half (the grounded 62-entry enemyNames list, classic-srand monster names per Ledger A, the 55%-male humanoid roll; headless = namePending LOUDLY) - coverage 7194/7235 (99.4%), pending 41 = the Q3-iv remainder incl. DFU's own 4-line 'Action not found' floor. AUDITED same day (QUEST AUDIT VII): the parity re-read ran in the MAIN LOOP against the raw C# (the subagent limit blocked the workflow; a retry is armed) - one alignment, the never-assigned-Symbol throw quirk; the mutation campaign ran 102 + 104 same-seed mutants - 8 boundary pins (the Dice100 equality law, the infinite escape, msg-once across actions, the 128-bit class routing, the 0.55 boundary, exact-name determinism through both srand chains) and 18 recorded equivalents with proofs (the InitialiseOnSet dead-store trace; the 15-bit rand() bound making the monster-seed modulus unobservable). Q3-iv SHIPPED (2026-08-21): THE REMAINDER SWEEP - the corpus CLOSES at 7231/7235 (99.94%; the 4 left are DFU's own 'Action not found' floor, permanent by parity): WhenPcEntersExits's polled exterior-type trigger (p1=2 validation, the 'anywhere' wildcard, enters-on-standing-state), WhenNpcIsAvailable's click pulse over the machine's new faction-listener/active-person surfaces, WhenReputeWith's live-rep bar with the unknown-faction-false law, MakePcDiseased/CurePcDisease over the S18 seams (the dropped 'saying' tail and the case-insensitive vampirism re-test kept verbatim), and CastSpellDo's readied-spell gate with the template-SetComplete quirk arms. AUDITED same day (QUEST AUDIT VIII): the raw-C# main-loop parity read (the subagent limit still held; the multi-agent retry is armed for both Q3-iii and Q3-iv) + a two-round 193-mutant campaign - six real holes pinned, two of them DFU laws the first pins missed (the always-on rep bar UN-triggers when the bar drops; an enters trigger never fires on an exit transition), 15 recorded equivalents incl. four comment-text masker artifacts noted for the tooling. Q4-i SHIPPED (2026-08-21): THE MACRO ENGINE - QuestMacroHelper/QuestMCP/the resource ExpandMacro overrides; Message.getTextTokens expands by default (the pending charter closes); the corpus gate expands all 3,817 messages headless with EXACTLY the three %di-NRE crashers DFU has (pinned by id) and C#'s GetValue error shapes exact ([undefined] 15 = the %G3/%G1 lines that really render raw in DFU); UID-seeded names, the pronoun family, the Province walks, TEXT.RSC seams, the FLATS.CFG caption seam, the underscore-truncation quirk kept. AUDITED same day (QUEST AUDIT IX): the raw-C# main-loop parity read + a three-round campaign (180 mutants, 88 survivors -> 21 pins incl. the wholly-unpinned Item override and the enum drift only a Person building-vs-town assert could see, 36 proven equivalents incl. the string-gate family and the clock's divisibility proof; an operational lesson recorded - one campaign per sandbox, verified stopped before relaunching). Q4-ii SHIPPED (2026-08-21): THE OFFER FLOW - the machine's questor-click halves (SetLastNPCClicked's ungated sweep, IsNPCDataEqual's four-field struct identity with null as the zero struct, the incomplete-quest questor scan stamping the guild as quest.externalMCP, CreateMessagePrompt's YesNo descriptor riding quest.rolls) + offerFlow.js, the headless law of DaggerfallQuestOfferWindow, the quest popup's offer/accept/refuse half, and the guild popup's Quests service: the social door with its castle gates and NO external MCP (C#'s own TODO), the guild door with the Temple deity fold, rank-by-level, building-faction homes and the one-offer pool clear, Yes starting the quest immediately behind AcceptQuest, No scrubbing the TalkManager three ways in C#'s order then RefuseQuest, the quest picker replaying C#'s RemoveAt-by-original-index bug exactly, and ExpandLetterSignoff closing Q4-i's deferral - the QuestListsManager draw LIVE end to end, guildServiceFlow's FLAGGED Quests arm closed. AUDITED same day (QUEST AUDIT X): the raw-C# main-loop parity read (both windows whole, the machine's click region, the lists draw half, the letter signoff) + the 82-mutant campaign with full-suite confirmation - 12 real holes pinned (the untested social gender fold and the never-revealed letter Item arm among them), 17 verified kills, 2 proven equivalents, and one masked-kill fixture sharpened (a sourceless gated row answered the same fail step both ways). Q4-iii SHIPPED (2026-08-21): THE SCENE MOUNT's engine half, headless - QuestResourceBehaviour.cs whole as a host-driven object (the Update order verbatim: recouple, hidden-person deactivation through the resource, hidden-foe self-destroy, the spell/item queue drains with exact parking gates, motorless restrain latching, injured-before-death with its held-tick return, DeathTrigger behind the isFoeDead latch; DoClick's item transfer and the individual broadcast's ASSIGN quirk; the v1 save shape), the AddQuestResourceObjects walk over scene adapters (snapshot guard, verbatim throws, dead enableItems, the flat-pick and marker-position laws, the placement injury rearm), PlaceFoeFreely's ring as pure math over probe seams, the machine's individual-NPC trio, the CreateFoe wave invalidations across live and scheduled quests, two-phase TeleportPc, the base Tick's SetActive wire, and Place's hot-place/hot-remove tail - with the LIVE BRIDGE re-carved as Q4-v (engine = pinnable law, bridge = probe-verified host geometry). AUDITED same day (QUEST AUDIT XI): the raw-C# main-loop parity read + a 185-mutant campaign - 33 real holes pinned across two rounds, full-suite confirmation landing exactly on the triage (33 kills at fails=5; the 10 baseline-survivors are precisely the 10 argued equivalents, proofs recorded incl. the cos-threshold amplification). Q4-iv SHIPPED (2026-08-21): JOURNAL + SAVE - the quest save envelope whole in its C# homes (the minify-safe type identities, C#'s kept holes: rumorsMessageID, the unsaved journal context, OneTime via the player save; the Task restore ORDER as law; the declarative action walk with transients out where C# leaves them; the removed-mod per-quest catch and the uid allocator advancing past restored uids), the journal's ACTIVE-page walk, EndQuest's notebook filing, and PlayerNotebook.cs whole (the 70-column leading-space wrap, the 50-slot unsaved ring, the overflow quirk, the D:/Q:/A: encoding) - gated by THE CORPUS ROUND-TRIP (all 265 quests save->restore->save to a fixed point; the restored twin ticks in lockstep). AUDITED same day (QUEST AUDIT XII): the raw-C# main-loop parity read + a 112-mutant campaign - 58 confirmed kills across two rounds (the compensated-count lesson recorded: a count assert can be conserved by paired defects, contents cannot; plus the sweep-find pinning isPlayerAtBuildingType's wholly-untested Q3-i arms), 6 proven equivalents. Q4-v SHIPPED (2026-08-21): THE HOST BRIDGE - the arc's last slice: the machine goes LIVE in the world host through ONE wiring module (scenes/questBridge.js: machine + lists + offer flow + notebook over host-composed seams, with the verb set tick/clickNpc/offerGuildQuest/offerBoxes/mountScene/snapshot/restore) and its vite raw-glob data half (scenes/questData.js); the StaticNPC NPCData law lands with C#'s nameSeed precedence quirk, QuestMachine.Update's 10 Hz pacing with the DROPPED excess, ClearState for the live load path, and the DaggerfallDateTime header strings with the C# format quirks; world.js composes the seams from its real objects (faction store, live inventory with the quest-item stamps, InitAtGameStart on chargen, OnInitWorld on the teleport core, the quest envelope through F9/F11) and worldModes.js owns the interior half (the click stamp, the questOffer window arm, the quest-flat mount with DoClick targets and OnDestroy teardown, the pause-law tick gate, the transition notifies); 25 node pins incl. the fs-backed end-to-end guild offer and the fixed-point envelope round-trip; the pending seams RECORDED loudly (interior/dungeon quest foes, dungeon popups, the talk seams, video/faces/disease/loot-window) - and the standing caveat that this environment has no ARENA2, so the browser half is build-verified while the live geometry probe pass waits for a machine with game data. AUDITED same day (QUEST AUDIT XIII): the raw-C# main-loop parity re-read landed three fixes shipped mid-audit (PlayerActivate's faction-listener shutdown arm, the quest-stand click's LastNPCClicked stamp with the StaticNPC peer layout law, the load gate on the machine tick) plus the base-position confirmation for the stand geometry; the 68-mutant campaign closed 66 kills with 2 PROVEN equivalents (1>>2===0>>2 hides the rawZ default from the hash; 1&32===0&32 hides the flags default from the gender arm) and 0 unexplained. Next: the live probe pass, then the arc rests - the routed seams belong to the talk/UI/enemy-host lanes.
- `06-Systems/Talk-Arc.md` - ACTIVE, started 2026-08-21 off the quest arc's merge: TALKMANAGER WHOLE (3,736 lines) - the quest machine's conversation consumers. Carved into five slices (TK-i the rumor mill over a new RUMOR.DAT reader + the quest rumor seams live; TK-ii the topic tree + quest topics/dialog links; TK-iii the answer pipeline + the full greeting ladder; TK-iv the questor door + static talk + the conversation save; TK-v the host mount). The T3a-T3f series (reaction/where-is/tones, World lane) stands under it as the shipped foundation. TK-i SHIPPED (2026-08-21): THE RUMOR MILL - RUMOR.DAT read 1:1 (the 9-byte CString cursor law), TalkManager's rumor family whole (the import gates with THE BULLETIN HOLE, the frozen-variant AddNonQuestRumor with the 43140 TTL literal, the seven sign types, THE REFRESH CULL kept verbatim - no type filter, so quest rumors' unset timeLimit dies on the regional sim's sweep, DFU's own hand - the GetValidRumors filters incl. the 75% faction-flag suppression, the region ladder, the weighted news draw at quest weight 50, the one-answer gate with the resolvingError quirk, the bulletin face, the six quest seams with their throw literals, the questor-post slot), the SaveDataConversation halves as save.js's third opaque envelope slot, and the bridge's six rumor seams LANDING (the machine's rumor hooks stop being silent); 28 pins. AUDITED same day (TALK AUDIT I): the raw-C# main-loop parity re-read (no deltas; the two kept quirks recorded by line) + a four-round 154-mutant campaign - 150 kills, 4 proven equivalents, 0 unexplained; the sweep exposed variantTokensById as wholly untested behind its mock (the mocked-seam lesson, recorded) and its first direct pin caught a REAL crash on the FTD-1 empty-stream path, fixed and pinned; a token-exact deepEqual closed the loose-slice mutant text asserts could not see. TK-ii SHIPPED (2026-08-21): THE TOPIC TREE - TalkManager's topic-list core whole (the ListItem model, the quest topic pipeline with both AddQuestTopicWithInfoAndRumors overloads, DialogLink/AddDialog/Remove/ForceUpdate, the misnamed person lookups, IsBuildingQuestResource, the four assemblers with the regional-building tables and the quest General section, the knowledge gates, the dictQuestInfo save half with its orphan sweep and three-type relink), five more bridge seams landing, and the kept quirks by C# line - THE DISCARDED FIRST ADD, THE STICKY TELL-ME-ABOUT FLAG, THE SHARED GROUP VARIABLE, THE MISNAMED THROWS; 30 pins incl. a cross-module guard on actions.js's enum copy. AUDITED same day (TALK AUDIT II): the raw-C# main-loop parity re-read (no behavioural deltas; one structural one recorded - .NET Dictionary reuses a removed slot on the next Add where a JS Map appends, so topic ORDER after a quest churn differs, unspecified in .NET and so recorded rather than emulated) + a three-round 143-mutant campaign closing at 143 KILLS, 0 survivors, 0 equivalents - the first campaign in either arc with nothing left to argue; round 1's tell was that it produced no equivalents at all, and every one of its 47 survivors proved a real gap (the constant tables were spot-checked rather than pinned; isResidence was pinned at the wrong edge). THE BASELINE TRAP sprang once and was caught: a confirm reported CAUGHT at fails=4, which IS the baseline - the pin had let the arm answer false either way, and was re-cut to leave the mutated default as the only thing holding it shut. TK-iii SHIPPED (2026-08-21): THE ANSWER PIPELINE - TalkManager's question/answer half as the LADDER over T3's shipped tables (GetQuestionText's records, GetAnswerText's dispatch, the tell-me-about and where-is arms, GetAnswerWhereAmI's four arms, the knowledge roll's whole ladder, the regional building walk, the hints, the compass and map marks), with THE REGIONAL LOCATION-KEY BIT DECODER pinned exactly (three flag bytes; C#'s truncate-before-shift reads bit 7-n, so the shift amount is not the bit number) and the kept quirks by line - THE KNOWS-BUT-SILENT ARM, the asymmetric where-is gate, free directions, THE DEAD KEY OVERRIDE, the spymaster hint inversion, the token clone, the never-downgraded compass mark; 40 pins. AUDIT III same day found THREE port bugs that were all one mistake - state whose only observer runs somewhere the port had stopped thinking about, each behind a comment claiming faithfulness: the tone gate belongs INSIDE GetAnswerText (:1994-1995), THE %n SLOT (greetingNameNPC) is filled before the greeting record expands and emptied the instant it returns (:1136-1140) because the macro layer resolves %n through it, and THE HEADLESS SESSION must be a FIELD like C#'s npcData (:189) rather than a literal rebuilt per call - the rumor mill carried that one too, and AUDIT I had recorded its symptom as a proven equivalence, now withdrawn; the campaign's round 3 swept 170 mutants on a freshly regenerated coverage map for 147 kills, 11 gaps pinned and re-confirmed dead, 12 proven equivalents. TK-iv SHIPPED (2026-08-21): THE NPC SESSION - the module that CHOOSES the NPC the other three slices answer for. The click arms, the target chain, the faction resolution, both parent walks, GetGreetingIndex whole and TalkToNpc's three doors, plus the questor pool the Work arm draws from and the conversation save halves. Kept quirks by line: THE UNGUARDED FIRST ARM (C# writes `IsAlly(a,b) || IsAlly(b,a) && greetingIndex > 2`, and since && binds tighter the guard covers only the reversed test), THE STRANGER FLOOR (at index 8 a reputation of 6 to 29 matches neither arm and falls through to the plain reaction ladder), THE REJECTION FOUND MID-GREETING (the greeting lookup itself sets alreadyRejectedOnce, and the second test answers with the raw tokens in a box while the window never opens), THE NAMES NOBODY READS (four faction-name fields written by every arm of the ladder and read by nothing in the whole DFU tree); THE ZERO-FACTION MATCH recorded rather than emulated; 69 pins. AUDIT IV same day found THREE port bugs, two of them the mistake TK-iii's re-read had already caught once - a law left with the host that C# keeps inside the method - which is why the arc now carries it as standing law: half of TalkToNpc's tone reset was the host's, and rebuildTopicLists was shadowed by a copy nothing would ever raise. The three-round campaign (180 then 190 mutants, 0 uncovered lines both times, 68% then 87% kills) recorded a second law with it: A FIXTURE THAT CANNOT REACH THE STATE A LINE GUARDS IS NOT A TEST OF THAT LINE - every `> N` guard in the greeting ladder differs only when the index is EXACTLY N, which no single membership can arrange, so nine guards that looked thoroughly pinned were untested until six two-membership fixtures walked the index onto each bar; 16 gaps closed and 8 proven equivalents, two of them DFU's own dead stores that came back at exactly the baseline - THE BASELINE TRAP sprung and caught a third time. TK-v SHIPPING (2026-08-21): THE HOST MOUNT - the four engine modules live in the running hosts, and systems/talkMacros.js is TalkManagerMCP whole plus MacroHelper.ExpandMacros and ExpandRandomTextRecord, the reader that finally makes TK-iii's two live slots observable (%n's greeting name and %loc's map-reveal flag, both now pinned from INSIDE an actual expansion). THE QUESTOR DOOR IS OPEN: a static-NPC click carrying work opens Q4-ii's offerSocialQuest, the arm that had been waiting since the offer flow shipped. The tone gate, the reaction cache and the question counter moved off townTalk onto the engine, applying the arc's own new law to the last host still breaking it. The re-read caught the expansion ALGORITHM itself - MacroHelper scans from each % to the next terminator rather than replacing substrings - which brought THE MACRO CACHE (one dictionary per call: a record naming %fn twice names the same woman twice) and THE PIPE IS EATEN (%di|ern becomes southern). A method note recorded with it: two of the first pins were MINE being wrong (shift amounts tabulated as bit numbers; a modifier's sign guessed rather than read) - a pin asserting a number you reasoned out is a pin asserting your reasoning.. TK-vi SHIPPED (2026-08-22): the two pieces TK-v left standing, both the same fault - a law belonging to the engine done by hand in the host. The talk window's Where-is page IS listTopicLocation (enum order behind the skip list, the shared group variable's General and palace arms, a Regional group appended ALWAYS, and a NavigationBack row opening every group), and its rows are ListItems the pipeline's getQuestionText/getAnswerText take - so the tone gate, %hnt's fork and %loc's map mark run where C# runs them; the flat T3c list survives only as the no-engine fallback. And %key, %loc and %fcn - MacroHelper statics that read TalkManager's own fields - were absent from the port's table and expanding to NOTHING, which had been deleting the building name from every direction and map-reveal answer and dropping the map mark with it
- `06-Systems/Systems-Arc.md` - ACTIVE. S1-S16 + S18 DISEASES (2026-08-16: the 17-row DiseaseData table byte-exact, the daily tick over the classic day with statMods through liveStat and RAW FAT/SPL drains bug-for-bug, InflictDisease's level-1 immunity + full-save resist + no-double-catch, Heal{Attribute} healing disease damage without curing, and the OnMonsterHit rider table wired per landed hit at the FormulaHelper.cs:662 seam - rat/bat/zombie/mummy/vampire rolls, nymph/lamia fatigue x2 x64, specials routed) + S19a PARALYZE (2026-08-16: (0,255) with AssignBundle's exact chance/save gate order incl. the AddState-first re-cast quirk, the spider/scorpion Spider Touch free-cast rider closed, the full IsParalyzed consumer set - player input/jump/weapons in both hosts, foe motor+attack freeze; plus the classic subType BYTE-CAST parity fix: 0xFF reads -1 and the 255-keyed doors never fired from real records) + S19b POISONS (2026-08-16: the 12-variant enum + timing tables byte-exact, minute-tick lifecycle Waiting/Active/Complete with drug positives stripped at the crash and attribute damage persisting until healed, InflictPoison's career-immunity/save/level-1 gates, the ItemHelper weapon-poison spawn roll + the inflict-once-and-clear formulas seam at both enemy-vs-player sites) + S19c CURES (2026-08-16: (3,0..2) chance-gated instants - CureAll* as IMMEDIATE bundle removal lifting disease/poison statMods now, CureParalyzation ending the incumbent instantly, the AssignBundle failure messages on player hosts) SHIPPED - the S19 group (Paralyze/poisons/cures) is CLOSED - + S20 EXHAUSTION/REST (2026-08-16: the three per-hour recovery rates verbatim incl. RapidHealing/NoRegenSpellPoints decodes, the OnExhausted collapse - a safe hour of rest vs death near enemies or in water, fed by the P13 senses fields - and the once-per-minute-change fatigue-drain parity fix) SHIPPED (the rest UI consuming the rates is U7, the UI arc) + S21 CONCEALMENT (2026-08-17: Invisibility 13,0/13,1 + Shadow 24,0/24,1 + Chameleon true 23,1 - the P13 gate's inert branches go LIVE, normal/true folding per IsInvisible/IsBlending/IsAShade, the verbatim Illusion costs, start messages once on new incumbency through the sinks.say seam; with P15 sneak the full illusion-stealth play works; foe-side visuals pend) SHIPPED + S22 FREEACTION (2026-08-17: (26,255) Restoration duration buff on the generic incumbent branch; the READ-TIME immunity fold - IsParalyzed = !immune && paralyzed, a covered paralysis ticks underneath and RESUMES - and the AssignBundle silent drop of incoming Paralyze; career/racial immunity FLAGGED to the tolerance decode) SHIPPED + E1 THE SHOP FOUNDATION (2026-08-17: the economy arc opens node-pure - DFU's ItemTemplates.txt baked whole (288 rows) + the per-group enum arrays with ItemBuilder's material value laws; StockShopShelf verbatim (the eight pair tables, the rarity/Dice100 stock law, the no-dice book ladder, horse+cart, the gender swap) + RMBLayout.IsShop + the 27-model shelf set for E2's mount; CalculateCost verbatim with the lazy 750..1250 regional band; MagicItems/potion-recipe/book-file-pricing/restocking INTERIM loud) SHIPPED + E2 THE SHELF MOUNT (2026-08-17: the E1 laws go LIVE in the interior mode of both hosts - buildingDataForDoor resolves the entered door through the pool merge to type/quality/name, interiorContext collects the shelf set in DFU's chain order (parity fix: 41035/41037 were wrongly S2b house containers), E on a shelf in an IsShop stocks lazily and opens the keyed browse window with live CalculateTradePrice prices, digit-buys deduct gold into the entity; the modal-__frame probe-starvation fix; probed live - entered "The Adventurer's Book Dealer", bought a 2950-gold book; selling/haggle-UI/open-hours/bookshelves FLAGGED) SHIPPED + E3 SELLING (2026-08-17: the trade circuit closes - storeBuysItemType verbatim gating the S sell mode per storefront, the selling-branch offer over CalculateCost*stack, proceeds via addGold with sold goods landing on the OPEN shelf (buy-backs work), Mercantile tallying once per trade both directions; probed live - the bookseller round trip, buy 3062 / sell back 2904; haggle UI/letters of credit/Repair/Identify FLAGGED) SHIPPED. + S23 THE CAREER EQUIP RESTRICTIONS (2026-08-19: AUDIT 17n listed the four Forbidden categories among U20b's inert picks; framing it as a custom-class gap understated it - SEVENTEEN OF THE EIGHTEEN CLASSIC CLASSES carry values in weaponArmorShieldsBitfield/forbiddenMaterialsFlags and the port enforced NONE of them, so a Mage could wear plate and swing an axe and a Monk could wear full plate. DaggerfallInventoryWindow.EquipItem :1343-1381 verbatim, at the same seam DFU uses - the inventory WINDOW, not ItemEquipTable, so starting gear equips straight past it and a restricted class can START in gear it could never put back on. The port's ARMOR_MATERIAL values ARE DFU's raw nativeMaterialValue, so the >>8 and &0xFF expressions carry over unchanged. Two quirks ported: the armor MATERIAL test is gated on PLATE only - which bites on Chain2, whose 0x0103 shares a low byte with Elven - and GetWeaponSkillUsed's Skills.None = -1 masks against every bit, so an unnamed weapon-group item reads as forbidden to any restricted career. The refusal message is FLAGGED (DFU pops TEXT.RSC 1068 on parchment; this surface has no text source yet) but the refusal itself is verbatim. Probed live as a Mage - plate refused with a reason, dagger drawn; the probe's own first draft offered a Longsword and was rightly refused, which is now a pin) SHIPPED. + S24 SPELL ABSORPTION (2026-08-19: spellAbsorptionFlags had zero consumers, and for the SORCERER that was worse than inert - the class ships absorb=Always ALONGSIDE NoRegenSpellPoints and only the PENALTY was live, so it paid its entire classic cost and got none of the benefit it is traded for. TryAbsorption verbatim: DESTRUCTION only (DFU's own comment explains it - absorption is tested against every incoming effect, so a self-heal would otherwise be swallowed), the cost computed as if the TARGET cast it with the target multiplier and the floor of 5, and the HEADROOM refusal that is the throttle on the trait - an absorber at full magicka absorbs nothing. The career branches read inside/day on the same law rest.js's RapidHealing uses. An absorbed effect is SKIPPED, not reduced, and the tally is credited with a self-cast-only cap. Probed live as a Sorcerer through the host's own applySpellToPlayer: 133 points absorbed, zero damage; with a full pool the same bolt lands for 20) SHIPPED. + S30 SPELLCASTING ABOVE GROUND (2026-08-20: the AUDIT 23 hosts-2 priority row - scenes/hostMagic.js extracts the dungeon's audited cast stack VERBATIM behind injected deps and every host mounts the ONE engine: exterior/world each carry one per PAGE with mode-facades (collider/foes/absorbCtx follow the door, so S24's InLight/InDarkness finally read a live sky and a readied spell survives a tavern door), worldModes' interior arm drives the same engine, dungeonContext DELETED its local stack (121 lines) keeping enemy missiles/arrows host-side landing through the engine. Backspace book + Enter ready everywhere, CasterOnly casts INSTANTLY at ready, the attack click casts through interceptAttack/firePending in every input path, guards die through cityGuards' one damage door with Murder. Spellbook management shipped minus Rename: d delete behind the YesNo with the curse-tag refusals, u/j swap with the cursor following, s sort alpha-then-point-cost per SequenceEqual - all in place on entity.spells so the save's index array carries order. S27's dungeon-only sweep fired as designed and was INVERTED into the four-hosts-one-engine sweep. 21 new pins + 5 mutations killed + tools/castProbe.mjs driving all three browser hosts frame-synced to green with zero page errors) SHIPPED. + S31 FAST TRAVEL (2026-08-20, the F-slice: TravelTimeCalculator verbatim - the classic longest-axis stepper over CLIMATE.PAK, the 102*transport>>8 fixed-point chain, ocean 51/255, camping's 300/256 with inns FASTER, reckless exactly >>1 - plus the trip cost with DFU's negative-nights guard and the arrival clamps (sun-averse to dusk, cautious nights to 7:10 via the 31-hour form). The keyed travel window on V: a classic prefix typeahead over the whole map directory, the popup's toggles and defaults, the gold gate. The world-host arrival is performFastTravel's order through the streamer's own re-init and the U24 one-clock advance so magic rounds and disease days catch up inside the jump. Probed LIVE: Daggerfall city to The Gathering of Evelyna, 208 minutes = exactly 2 moves x 104, 5 gold, landed on the pixel, zero errors. Residue - TRAV art, exterior arms, transport ownership, sun-averse producers, spawn prevention - is one ledger row) SHIPPED. + S32 RANDOM ENCOUNTERS (2026-08-20, the E-slice: the 45 tables baked from RandomEncounters.cs, ChooseRandomEnemy's pick + level band verbatim, the 144-minute cadence with the four rolls, and THE ENEMY ALERT the routed rest leg had named - sight raises, the targeting kill clears, 8-hour decay. The dungeon REST arm is live end to end: the catch-up loop across advanced minutes spawns ONE real foe through buildFoeAt (the load chain extracted) at the classic 8 units and the hourly check breaks the rest. The above-ground spawner needs the exterior mobile-foe mount - the residue row) SHIPPED. + S33 THE ABOVE-GROUND QUICKSAVE (2026-08-20, the P-slice: the world host binds F9/F11 to the dungeon envelope plus the map pixel + NATIVE coordinates - survives every floating-origin recenter, the streamer grew the exact worldCoords inverse - loading teleports through the travel core to the exact spot with the encounter anchor reset (LoadInProgress parity); one classic slot shared with the dungeon; probed live through a full teardown - position/pixel/clock/gold exact, zero errors. Still out: rest above ground, the exterior page's arm) SHIPPED. + S34 FOUR SMALL LAWS (2026-08-20, the L-slice: entity-7 REFUTED - DFU's rest catch-up raises one magic round per game MINUTE under the 2880 cap and the port already matched it exactly, the ledger row was the bug; entity-9 SHIPPED - applyLevelUp is Level++ one step per acknowledgment and checkForLevelUp sits unconditionally at raiseSkills' tail so a multi-threshold overshoot re-offers on the next 360-minute check; items-9 SHIPPED with its premise corrected - DFU REFUSES the pickup (no speed penalty exists), canHoldAmount's GP-unit integer arithmetic gates _pickRemote with the refusal box and the split-take of exactly what fits; combat-16 SHIPPED - the minMetalToHit refusal speaks for the player only. 4 littlelaws pins + 3 jump-law pins rewritten; 5 mutations, 5 killed) SHIPPED. + S35 MAGIC FIDELITY (2026-08-20, the L2-slice - the last open magic rows: the buff family's landing gates in AssignBundle's exact order (the incumbent stack inside Start surviving both gates, the OnCast chance for Silence alone, the no-magnitude full save for external casts); the aim-directed ByTouch sphere-cast (0.25 x 3.0 along the aim - a foe behind the shoulder is untouchable now); the trap CastSpell arms (CasterOnly readies FREE on the player via the engine's readiedFree, ByTouch retargets to SingleTargetAtRange, casterless AoC no-ops loudly) and the enemy at-caster AoE with the caster excluded; the manager-level paralysis immunity (career/racial arms + the Resistant-first quirk); the Magic save element for the magic-only families; Transfer-onto-Drain incumbency. 5 pins + 2 repins; 6 mutations, 6 killed) SHIPPED. + S36 THE BACKWARD REWIND (2026-08-20, the SL2-slice: save-load-2 - a load is the SAVED TRUTH, not a merge; DFU rebuilds and overlays per LoadID, so applyWorld now reverses post-save state explicitly: a foe killed after the save RESURRECTS on a backward load with its corpse flat freed by its foe key (spawnCorpse keys the batch and re-checks dead after the texture await), and pile flats FOLLOW the restored items both ways - emptied-in-save loses its flat per RemoveLootContainer-on-restore, refilled-by-rewind re-mints at the build-time size with the pile's own record; senses persistence (isHostile/hasEncounteredPlayer) noted to the senses row. 3 pins; 4 mutations, 4 killed) SHIPPED + S37 THE GUILD MAP REVEALS (2026-08-20, the G8-slice: guilds-8 closes - DiscoverRandomLocation verbatim as the discovery store's LOCATION half (the current region's table rows, baked-flag + store filtered, keyed MapId & 0xfffff, injectable pick, null when picked clean); the TG's rank-6/8 map messages gate on the reveal succeeding and fall plain otherwise, the DB reveals on EVERY promotion before its switch; the envelope grew {buildings, locations} with the flat legacy shape still restoring; found on the way - the travel map searches the whole directory where DFU hides undiscovered dungeons, now its own ledger row. 4 pins, 4 mutations killed) SHIPPED + S38 RECALL (2026-08-20, the TP-slice: the (43,255) Teleport effect whole minus the cross-host arm - the effect raises a prompt marker on self arrivals only and assigns nothing, the engine routes it through onTeleport, the 4000 anchor/teleport ChoiceWindow, the anchor in the S33 native shape on playerEntity riding the save, the recall through the quickload warp with the anchor CONSUMED on arrival (:133/:255), a cast inside a mode leaving through worldModes' forceExitToExterior first - recall OUT of a dungeon to a town anchor works; the cross-host return trip and wa-4's castle hack stay flagged on it. 3 pins, 4 mutations killed; the same night's FLAKE HUNT captured the recurring suite flake - the unseamed 20% attack grunt - and the sweep found the encounter pool feeding DFRandom's INTEGER into the player's 0..1 hit dice (the player could hit an encounter foe ~once in 32768 swings) plus the zero-damage arm playing an object as a clip id; all fixed to the pools' uniform seams, X4-pinned, 0 failures in a 30-run soak) SHIPPED. Next on the 1:1 path: the quest machine - DECIDED route (a) and STARTED (Quest-Arc.md; Q1+Q2 shipped and audited 2026-08-20) - or the long tail (creation UIs, transport, vamp/lycan).
- `07-Rendering/Rendering.md` - COMPLETE again. R12 THE EXTERIOR INDIRECT PLAYER LIGHT (2026-08-16: the SunlightRig point light from the serialized prefab - 1.0/range 150/0.706 gray - daylight-scaled at the player across all four lit programs, shot-proven near-ground brightening with a byte-identical sky). Queue EMPTY.
- `10-UI/UI-Arc.md` - ACTIVE. U1-U5 + U6 THE ACTION TEXT BOXES (2026-08-16: ShowText 8600 / ShowTextWithInput 5400 with the verbatim riddle answers gating ActivateNext / DoorText 7700 with the patch table and the first-activation door hold; TEXT.RSC live), input map, CLICK-TO-CAST SHIPPED, U7 THE REST WINDOW (2026-08-16: KeyR, timed/full/loiter on the S20 per-hour rates, 354/355 pre-gates, enemies break rest live under the overlay) + U8a THE NATIVE PANEL (2026-08-17: Mac's call - real classic art begins; ui/nativePanel.js = DFU's virtual 320x200 with integer-scale letterbox, IMG loads, the verbatim shadowed-label idiom (243,239,44 / 93,77,12 +1,+1), pointToNative for touch; the CHARACTER SHEET is the first native window - INFO00I0.IMG with DaggerfallCharacterSheetWindow's verbatim label geometry, encumbrance over floor(Str*1.5), keys 1-4 skill popups, F5 in BOTH exterior hosts (host rule; was dungeon-only), text fallback never traps; probed + eyeballed - the real stone page with every label in its engraved field) SHIPPED + U8b THE NATIVE TALK WINDOW (2026-08-17: TALK01I0.IMG replaces the ChoiceWindow talk chain in both hosts - DaggerfallTalkWindow's verbatim rects with the labels baked in the art, the topic list + bottom-anchored conversation panel, tone radios; POINTER ROUTING lands - townTalk.pointerdown maps taps/clicks through pointToNative before requestLook, phone and desktop on one seam, keyboard accelerators kept; the T3-T3f session pipeline unchanged underneath; probed by MOUSE CLICKS end to end + eyeballed) SHIPPED + U8c THE NATIVE TRADE WINDOW + ITEM ICONS (2026-08-17: the E2/E3 shop loop on the classic inventory screen - INVE00I0 + the INVE08I0 buy panel + the SHOP00I0 cost strip (the TRAD00I0 first guess does not exist - the probe caught it); ITEM ICONS come online through the regenerated templates' worldTexture fields over the existing texture pipeline, lazily warmed with sizes; remote-click buys / local-click sells through the extracted doBuy/doSell core, worldModes pointerdown routes interior clicks; probed - three real book icons, bought 3129, sold back 2968; basket/tabs/paperdoll/dyed-icons FLAGGED) SHIPPED + AUDIT 2026-08-17d (the native-window parity audit after Mac's third positioning catch - the trade scroller un-mirrored to the verbatim ItemListScroller (buttons at x=9, the LEFT 9px rail with 16px arrows), FONT0004 stack counts, talk rows 7px / lines 11px, the light-blue question in the player-says panel + the yellow answer color, the centred NPC name; the char sheet clean; THE NATIVE-WINDOW RULE entered Process - every drawn element cites its DFU source or does not draw; see Audits) + U8d THE NATIVE INVENTORY WINDOW (2026-08-17: the first window built under the rule - INVE00I0 base with INVE01I0 selected-state subrect highlights (drawImgSub), the verbatim tab/action-button rects, the AddLocalItem four-way filter (ingredients = templates 0..77 exactly per ItemTemplates.txt, Spellbook 132 to magic), the ItemListScroller EXTRACTED to a shared module riding trade + inventory alike, F6 in both exterior hosts; the view+info half - equip/use/drop + paperdoll FLAGGED to their arcs; probed + eyeballed: gold highlights exactly on the baked buttons, icons in their frames, the stack '3' in FONT0004) + U8e DROPPED LOOT (2026-08-17: the remote column lives - Remove-mode drops mint an archive-216 treasure flat at the ground below the player (CreateDroppedLootContainer verbatim: the 20-entry random icon list, FindGroundPosition), E on a pile reopens the inventory as a loot target with REMOVE defaulted (the anti-accidental-equip law), pickups empty the pile and the flat vanishes (the serializer's removal law); probe lesson recorded - drop probes wait for the MOTOR to settle, not just __shotReady; save persistence + stack-split + TrackLooseObject FLAGGED) + U8f THE EQUIP FOUNDATION (2026-08-17: ItemEquipTable verbatim - the 27-slot table, GetEquipSlot per group over the extracted enum indices, GetItemHands, EquipItem with the 2H/shield/swap/SplitStack laws, FilterLocalItems hiding worn items; THE PAPERDOLL BASE renders - town SCBG04I0 subrect in the 110x184 panel at (49,13), BODY IMGs at their baked offsets minus paperDollOrigin (200,8), the verbatim censor welds, the FACE CIF head; probed + eyeballed - the classic Breton avatar standing in the window; equip-mode clicks stay flagged until U8g's overlay layers + unequip mask; Breton-male-0 INTERIM until chargen). + U8g ITEM OVERLAYS + LIVE EQUIP (2026-08-17: the doll composes CPU-side into one texture like DFU's own renderer - layer order verbatim, the GetItemImage forPaperDoll laws with morphology archives and the SetVariant material-family clamps, the C5b ChangeDye bands live, GetEquipIndex click resolution walking the layers backwards; EQUIP clicks wear items, REMOVE doll-clicks strip them, INFO reads them; probed + eyeballed - iron plate + longsword + red pants ON the avatar, the chest click stripping exactly the cuirass; FP-rig binding + armor values FLAGGED to U8h) + U8h THE WORN-WEAPON BINDING + ARMOR VALUES (2026-08-17: the rig swings equip.slots[RightHand] every frame (bare hands -> the unarmed path), the interim dagger moved into the bag as the boot seed; UpdateEquippedArmorValues verbatim - the 100-per-part baseline, material*5 subtractions, material-blind shields with their protected-part tables, the to-hit consuming the table directly (THE PARITY CHANGE: an unarmored player is now classically easy to hit), the (100-av)/5 labels at the verbatim armourLabelPos; probed + eyeballed - the chest reads 7 in iron and the FP view draws the worn longsword; dungeon-host binding + effect label colors FLAGGED). S3c/U9 CHARGEN (identity + all eight races + the fourth host) and S3d STARTING EQUIPMENT SHIPPED, then AUDIT 17f (2026-08-18: the parity pass over the audit's own changes - SetRace reaching the item LISTS at last, a town-created Mage's spellbook, the headless ?class skip in all three hosts, one gold mint, and the three duplications the 17e waves themselves re-grew; see Audits). + U10 CHARGEN ART (2026-08-18: all seven classic screens on the native panel - CHAR00I0 name, the TMAP00I0 province map with the VERBATIM click law (TAMRIEL2's palette index IS the race id; a click on Hammerfell lands on Redguard), CHAR01I0 with THE PORTRAIT the S3c face index had been choosing blind, the PICK00I0 class scroll over a real screen dim, and the CHAR02I0/CHAR03I0 rollouts with their spinners, derived block and green raised values; found on the way - solid quads never BLENDED, so sixteen translucent UI panels had been drawing opaque and ScreenDimColor blacked the screen out; the port printed skill ENUM KEYS where classic prints "Short Blade"; and FormulaHelper's seven derived stats had no home. Probed + eyeballed screen by screen) SHIPPED. + U11 THE PARCHMENT MESSAGE BOX (2026-08-18: DaggerfallMessageBox ported whole - SPOP.RCI's nine-slice with the verbatim sizing law (margins 10, minBoxWidth 132, rounded to the 22px slice, the label block growing ONCE for buttons) and BUTTONS.RCI buttons indexed BY THE ENUM VALUE; wired to the chargen gender screen, the race Yes/No confirm box on the template's DescriptionID, and U6's action boxes. ONE flagged departure - DFU places the strip from the panel's PREVIOUS height and lands 6px INTO the last text row, so the port clamps to the reservation the label block already made. Uncovered a TEXT.RSC bug: JustifyLeft/JustifyCenter each BREAK THE LINE in DFU and the port dropped both, so every centred record had been rendering as one fused run-on line - the old pin asserted the bug) SHIPPED. + AUDIT 17g (2026-08-18: the deep pass over U10 + U11 - the message-box art warming inside toggleCharSheet so dungeon action boxes drew the flat fallback until F5 was pressed, the box centring EVERY row where DFU centres only JustifyCenter ones (80 of 676 multi-row records affected), chargenHit throwing on the one branch that needed the art, the input box growing a slice mid-word, the keyboard walking past the race description a click always showed, and the class list jumping instead of scrolling minimally; see Audits). + S3e/U12 THE BIOGRAPHY QUESTIONS (2026-08-18: twelve questions per class on the classic BIOG00I0 screen - the BIOG*.TXT walk and the WHOLE effect grammar verbatim (skills, both gold quirks, items with the weapon-to-armor material map, social rep ACCUMULATING where the six single-field mods ASSIGN, faction rep queued); the effects land at finishChargen exactly where DFU applies them, while the skills screen DISPLAYS the bonus without turning it green; not cosmetic - biographyReactionMod and sGroupReputations are already read by getReactionToPlayer, so an answer changes how townspeople greet you. Corpus-gated over all 18 files; probed live at [-5,0,5,5], poison -10, 950 gold) SHIPPED. + U13 REFLEXES + THE BACKSTORY (2026-08-18: the CHAR05I0 reflex screen with TEXT.RSC 307 and the five-band highlight strip - the screen was the ONLY missing piece, both consumers (the EnemyAttack melee timer and the monster multi-attack gate) having read a hardcoded Average for slices because nothing could set it; plus GenerateBackstory expanding %qN/%qNa from the player's own answers (the Mage's 62 rows, all six macros resolving) and the closing ClickAnywhereToClose reputation box on TEXT.RSC 35 with DigestRepChanges' totals) SHIPPED. + AUDIT 17h (2026-08-18: three findings over S3e + U13 - the port had NEVER persisted player reputation (sGroupReputations/reactionMods and the six biography mods), so a quicksave/load reset the player's standing with every social group to zero, a gap several slices old that the biography made load-bearing; the dungeon host skipped the biography entirely, the THIRD time that host gap has hit this flow; and the reflex info panel wanted U11's parchment frame. See Audits). + AUDIT 17i THE ONE CONSTRUCTION SEAM (2026-08-18: the root-cause fix for a bug shape that recurred THREE times - the dungeon host built its ChargenFlow by hand and so missed the starting spellbook, the starting kit and the biography in turn. createChargenFlow is the only place a flow is built now; createChargenWindow WRAPS one rather than constructing it; and a source sweep over src/scenes FAILS if any host contains `new ChargenFlow(` - the rule enforced, not remembered. Probed on the dungeon host itself) SHIPPED. + U14 THE MENU BACKDROP + THE POINTER PATH (2026-08-18, Mac's call: chargen draws over the verbatim BLACK parent panel instead of the live town, and the class picker dims the FACE screen it was pushed over; the DUNGEON host gains a pointer seam (it had none - every click went to the pointer lock, so chargen there was keyboard-only), the gender BUTTON sets AND closes as classic's does, and a guard-rail pin requires EVERY control on EVERY chargen screen to answer a click. Probed by a COMPLETE click-only chargen) SHIPPED. + U15 THE CLASSIC WIZARD ORDER + THE RANDOM NAME BUTTON (2026-08-18: the port had invented its own chargen order; DFU's is an enum - DaggerfallStartNewGameWizard.cs:63-79 - and STATES now follows it verbatim (race, gender, class, biography, name, face, stats, skills, reflexes). Not cosmetic: the FACE screen draws RACE-and-GENDER art, so running it before the race was chosen painted the wrong race's faces, and CreateCharNameSelect.cs:112-119 DISABLES the random-name button without a race template - which is what finally forced the reorder, since U14's flag could not be cleared any other way. The button mints a NAMEGEN name through getNameBank = MacroHelper.GetNameBank, carrying the quirk DFU's own enum comment spells out: Argonian maps to the IMPERIAL bank. Probed by a click-only walk of the new order - a Redguard female named Rlillki by the button) SHIPPED. + AUDIT 17j (2026-08-18: the parity pass over U14 + U15 - seven findings, the through-line being that U15 got the wizard's ORDER right and every one of its BACK arms wrong, because I read the order forwards and inferred the cancels by reading it backwards. The RANDOM-NAME BUTTON WAS DETERMINISTIC (DFU reseeds DFRandom on every push of the name window and says why; the port never did, so every character of a race and gender got the same name on every boot); the class screen cancelled to gender where DFU skips to race - and the U15 pin ASSERTED THAT BUG; the name screen had no cancel at all, and its cancel must DISCARD the biography answers or they double-apply; the name survived a race or gender change where DFU empties the box; the 16-character cap should be TextBox's 31; the U14 pointer seam reached one of the two hosts that mount a dungeon context; and the stats and skills screens REROLLED on re-entry, throwing away the player's whole distribution. See Audits) SHIPPED. + U16 THE SUMMARY SCREEN (2026-08-18: WizardStages.Summary, the last stage the port did not have and the one that CLOSES the wizard - the port had been ending on the reflex screen. CreateCharSummary is barely a layout of its own: CHAR04I0.IMG COMPOSITES the stats rollout, the skills rollout, the face picker, the reflex picker and a name box, all of which existed for their own screens, so the four blocks were EXTRACTED rather than copied and only the reflex picker (246,95) and the name box (100,5) move. OK is gated on FOUR pools because the screen lets you take points back down off any of them, popping TEXT.RSC 14 on U11's parchment; RESTART is a SOFT restart to the race screen with the document intact. Two things had to change underneath: the two rollouts needed INDEPENDENT selections (the summary draws both, so a skill click was moving the stat spinner), and the biography reset moved onto _enterBiography, since RESTART is a second arrival and 17j had put the reset on the name screen's cancel alone - it would have applied every biography effect twice. One verbatim quirk ported deliberately: entering the summary ZEROES all four pools on every push, so un-spending and backing out loses the point, exactly as DFU does. And the screenshot caught what no test would have - the seven DERIVED labels belong to CreateCharAddBonusStats' own panel, not to StatsRollout, and sharing them drew them across the summary's skill panels. FLAGGED: DFU's SkillsRollout has THREE spinners, one per group; the port draws one) SHIPPED. + U17 THE CLASS PICKER + THE THREE SKILL SPINNERS (2026-08-18, Mac's report: double-tapping to select a class does not work - and it was worse, there was no pointer path off the class screen at all. A ListBox has TWO gestures: MouseClick SELECTS (ListBox.cs:500-504), MouseDoubleClick USES (:507-512), and Return goes through the same door; the port folded both into one click and then wanted a confirm the picker has no button for. The 0.3s window is on TIME ALONE, so a fast pair across two rows picks the second. And picking is not choosing: OnItemPicked opens the class DESCRIPTION in a Yes/No box on TEXT.RSC 2100 + index, which the port never showed at all. Plus the flagged spinner slice: SkillsRollout has THREE LeftRightSpinners, one per group with its own selected skill and its own pool, where the port drew one on a shared row and left two pools invisible) SHIPPED. + U18 THE CLASS-QUESTIONS PATH (2026-08-18: WizardStages.SelectClassMethod + GenerateClass - the two stages between gender and the list the port had skipped. The BUTN01I0 method screen (both buttons close, the OnClose has NO cancelled arm - any non-generate close goes to the LIST, Escape included), and the CHGN00I0 questionnaire: TEXT.RSC record 9000's forty questions split on LITERAL '{' markers (the importer's own law), the FALL.EXE 0x0059820C answer table, ten unique picks by linear probe, CLASSES.DAT's 66-triple results walk with the header nibble law - all-warrior IS the Knight, all-rogue the Thief, all-mage the Mage - and the resolved class's description on 2100+index, Yes adopting/No falling to the list. The SCRL00I0/01I0 parchment scroll made GFX the NINTH format reader (formats/gfxFile.js, the only GFX consumer in the game); CHGN00I0 is palettized and loads over its OWN DFPalette (ImgFile._readPalette writes into the palette it is handed - the shared ART_PAL survives); the constellation palette-brightening is live (8 + 24 per answer on slots 192/160/128, versioned textures released). FLAGGED to the Ledger: the FLC .CEL constellation anims + the Ignite shot (no FLIC decoder), row-level text clipping vs DFU's pixel clip, the unwired mouse wheel. Probed by clicks: ten a)-row answers -> weights [7,1,2] -> the description box -> NO -> the U17 list walk continues unchanged) SHIPPED. + AUDIT 17k (2026-08-18: the parity pass over U16-U18 + THE FIST CRASH hotfix - the constellation palette now RESTORES on a pristine redraw (DFU re-reads the IMG per construction; the port's one palette re-uploaded the last run's glow), the scroll clamp pinned AT its boundary, and the fist crash's rule swept into src/scenes; see Audits). + U19 THE BIOGRAPHY-METHOD SCREEN (2026-08-18: WizardStages.SelectBiographyMethod - the LAST enum stage the port skipped. BUTN02I0 centred at (68,16) with the two baked buttons (generate 8,41,167,54 / questions 8,113,167,46), Escape to the CLASS LIST per the OnClose cancel arm; the GENERATE arm auto-answers every question at rand.Next(0,Count) on the injectable rolls (Ledger A), lands the effects through the same tagEffect, digests rep and pops the TEXT.RSC 35 box OVER the method screen, closing to the name screen; THREE cancel arms rewired onto the stage (name -> here per :483-493, biography -> here per :477-480, here -> class list) with the fresh-BiogFile reset riding both arms - _resetBiography/_finishBiography extracted so manual and auto share one tail. The STALE QUEUE ENTRY RETIRED: the dungeon-host worn-weapon binding shipped with 17e F17's rig fold and 17k's fist crash proved it live. Probed both ways - the keyboard probe generates (the box's totals land verbatim on sGroupReputations), the click probe keeps the manual questions) SHIPPED. + U20a THE CUSTOM-CLASS BUILDER (2026-08-18: WizardStages.CustomClassBuilder - the last chargen SCREEN the port lacked, so every stage in DFU's enum now exists. The class list's 19th row is Custom (no description box, no drums); CUST00I0 with the freeEdit StatsRollout (10..75, a zero-sum pool that may go negative, no green), twelve skill pickers over the unassigned skills alphabetically, the 4..30 HP spinner, the eight-topic HELP picker, the CUST03I0 reputation window (columns by x threshold, sign by the middle line, RoundNearestBarHeight's rounds-up-at-4 quirk, the negated-sum gate on 303) and EXIT behind DFU's four gates in order (301/300/302/306). The difficulty gauge verbatim - +1 per HP above the default, -2 below, 0.3 + 2.7*(pts+12)/52, the dagger's (int) truncation - and out the other side the affinity index picks the BIOGRAPHY QUIZ while the reputations SEED sGroupReputations before the biography adds to them, with the Spellsword spell set only for a magic PRIMARY or MAJOR. THREE verbatim quirks ported deliberately (isCustom is set once at the row pick and NEVER cleared, so a cancelled builder still marks the document custom; the reputations ride the same rule; a click on the rep middle line zeroes that group). The slice's own adversarial review + live probe also fixed FOUR pre-existing defects: the class list wrapped where DFU's ListBox CLAMPS, the reroll memo keyed on classIndex where DFU compares the CAREER (a custom whose affinity collided restored the wrong roll), the Custom row was unclickable, and typed names lost their CAPITALS in the exterior hosts (codeToKey lowercases; the event rides along now, swept by a pin). FLAGGED to U20b: the special advantages/disadvantages window) SHIPPED. + AUDIT 17m (2026-08-18: the U20a review's late finding - DFU carries TWO class indices (characterDocument.classIndex at the wizard's :343/:364/:382 and CreateCharClassSelect's own listBox.SelectedIndex, which the wizard never writes and which survives a revisit because SetClassSelectWindow REUSES the window) and the port had ONE field doing both, so customExit's affinity write also moved the class picker - build a custom class, Escape off the biography method, and the list came back on a STANDARD row where confirming nulled the built career and made the player a class they never picked. Split into classIndex + classListIndex with _adoptCareer as the accept arms' shared tail; the builder's live 'plus' arm against its DEAD 'minus' one retired (DFU has no keyboard stat control there at all, so the freeEdit pool could be spent and never refunded); and the arc doc's claim that the conflation was 'Recorded in the Ledger' DELETED - no such row existed, and the false claim hid the defect from anyone checking whether it was known. See Audits) SHIPPED. + U20b THE SPECIAL ADVANTAGES/DISADVANTAGES WINDOW (2026-08-18: CreateCharSpecialAdvantageWindow - the last chargen window the port lacked, and the one that makes U20a's two difficulty terms REAL. They had been pinned at 0 since U20a shipped, so every custom class advanced at its HP-only rate however many advantages it took on: a live defect in the class economy, not a missing screen. ONE window serves both lists (CUST01I0 with CUST02I0 laid over its top strip to retitle it) at Left/Top, NOT the Center/Middle the reputation window uses - and the eyeball proves that deliberate: the window covers the left half and leaves the control column AND THE DIFFICULTY DAGGER visible, so you watch the dagger move as you add. The eleven advantages and eleven disadvantages, each primary's own secondary list, the 50-entry difficulty table (counted off the C# literal - the '53' an earlier reading recorded was wrong), the eight primaries whose secondary does not change the price, the three ONLY-ONE limits refusing before the secondary window opens, the seven-item cap, and CannotAddAdvantage reading BOTH windows' lists with its EQUAL-secondary rule - which is what lets a character be immune to fire and critically weak to frost. ParseCareerData folds the picks onto the raw CLASS.CFG bitfields the port's ClassFile mints rather than DFU's decoded properties, and the pins decode them back through the port's OWN consumers (spellPointMultiplier, hasSpecialAbility, careerAttackModifier). THE STRINGS came from DFU's Internal_Strings.csv, whose own header says it holds text hard-coded in FALL.EXE - they are in neither TEXT.RSC nor the sparse Scripts checkout, so the localisation table had to be fetched from the repo tree. The bit layout was ground-truthed against the real 18-class corpus first: Archer is the one class expert in missile weapons, Sorcerer carries noRegenSpellPoints, Monk forbids all three armors, Warrior forbids nothing. Probed live by clicks - Immunity/To Fire drawn with the +6 tandem squish, the dagger moving off AVERAGE on the pick, a label click removing it, and immunityFlags 8 on the career at the far end) SHIPPED. + AUDIT 17n (2026-08-18, Mac's call after U20b: the data clean - the difficulty table and all 71 labels diffed mechanically against their sources, the secondary lists in order, the career surviving save - but THE ENEMY-TYPE ATTACK MODIFIER HAD NEVER APPLIED TO ANYBODY, broken in two independent places: the port flattened DFU's read-through-the-career onto the entity where only FOES got it, and the weapon branch of calculateAttackDamage dropped the targetGroup it had just resolved, leaving weaponAttackDamage reading a `target.group` nothing mints. Pre-dates U20b - the classic Assassin's 0x04 humanoid bonus had never landed. Plus the honest catalogue of which picks are live vs inert, and two stale 'pends a decode' interims re-pointed. See Audits) SHIPPED. + U21 THE MAIN MENU (2026-08-19, Mac's call: the port had no menu at all - the bare URL called bootDungeon and the first thing anyone saw was the chargen wizard on U14's black parent panel, which was right for chargen and was never the front door. DaggerfallStartWindow.cs ported whole: PICK03I0.IMG on the native panel with the three verbatim rects (Load 72,45,147,15 / New Game 72,99,147,15 / Exit 125,145,41,15) - the labels are PAINTED INTO the art and DFU lays invisible click rects over them, so the geometry has to land on the words. PICK03I0 is one of the six palettized IMGs and gets its OWN DFPalette, never the shared ART_PAL (the U18/17k law, pinned both ways). scenes/menu.js is a thin host - a renderer, a canvas and one window, no motor or world - so the menu costs nothing and the game data loads only once a choice is made. NEW GAME hands off to the classic start that used to run on boot; LOAD rides the dungeon host's OWN quickLoad (the F12 path) with the saved position preferred over the start marker, rather than teaching the menu a second way to load. ?shot and ?nomenu BYPASS the menu, pinned - the shot pipeline and the 25 probes in tools/ drive fixed vantages and a menu in front would block every one. The letterbox is blacked in the window: the renderer clears to the pale Iliac Bay sky, which is right behind a world and read as a blue border around the scroll. TWO departures Ledgered - Exit cannot quit a browser tab and says so, and DFU's rebindable menu hotkeys are recorded rather than invented. Probed end to end by a real click: menu -> Start New Game -> the classic province-select screen. + U21b THE CHARGEN PARENT PANEL (2026-08-19: Mac spotted a blue sliver down the side of the chargen screens. DaggerfallBaseWindow.cs:40 paints parentPanel BLACK, and the port did - at (0,0) from INSIDE the overlay draw, while the dungeon host had already set a letterbox offset (dungeonContext drawOverlay passes a VIRTUAL 320x200*s canvas), so the backdrop landed down-right by the margin and the top and left strips kept showing the host 60% dim over the pale Iliac Bay sky. Measured live at 1400x900: the left strip read (57,75,97) - the sky at 40% - and (0,0,0) after. drawMenuBackdrop extracted and subtracting renderer.screenOffset, which is correct in BOTH host shapes: townTalk passes the real canvas with no offset and subtracts zero. Behaviourally pinned through a stub renderer, mutation-proven). FLAGGED: the title screen (TITL00I0), the ANIM0001 splash and music are separate slices - see below) SHIPPED. + U21c THE TITLE SCREEN (2026-08-19, Mac's call - "This is also our logo": the port now opens on ITS OWN branding, and the Ledger C row that said a title needed an A row first is retired. Classic's title art is TITL00I0.IMG, which this port reads and pins byte-exact - but DFU does not draw it either: TITL00I0 appears nowhere in the DFU source except ImgFile's palettized file list, because DFU replaced classic's title with its OWN branding. Our analogue of that is our logo, so ui/titleScreen.js draws public/logo.png ahead of the menu - the FIRST non-ARENA2 image the port has ever loaded, and no breach of Port-Doctrine: game data still never enters the repo, but OUR artwork is ours and ships with the build. Centred, aspect-preserved against both axes, capped at 86% of the canvas over an OPAQUE black backdrop (the renderer clears to the pale Iliac Bay sky, which would otherwise frame the logo in blue), any click or key advances. NEVER TRAPS is the load-bearing law here: if the file is absent loadLogo resolves null, runTitle returns before it touches the renderer, and the boot goes straight to the menu - a missing asset costs a splash, never a game, the same rule the char sheet and chargen follow when their art fails. U21d then replaced 'nothing' with something real: the fallback is CLASSIC'S OWN TITLE. TITL00I0.IMG - the Daggerfall wordmark over the box art - comes out of the user's ARENA2 at runtime, so the port has a working title screen with nothing to ship and nothing to install, and swaps to ours the moment public/logo.png exists. The two arms draw by DIFFERENT laws on purpose: classic art takes the native panel at integer scale with the 1-bit cutout and NEAREST, ours takes logoRect with blending and LINEAR, and each law is wrong for the other's art. Probed live - classic's title at native scale on a black letterbox, with no logo file present. The artwork itself then forced two RENDERER opt-ins: our logo is not classic art, and the port's screen-quad law is a 1-BIT CUTOUT - discard a<0.5, force alpha 1 - which is exactly right for classic art, because a palettized IMG IS a 1-bit cutout with index 0 transparent and every other index opaque, and exactly wrong for anti-aliased gold serifs and the dagger's soft shadow, which it would jag and cut to a silhouette; likewise NEAREST/REPEAT keeps a 320x200 IMG pixel-exact at nativePanel's integer scales and aliases a 2000px banner drawn at a non-integer one. drawScreenQuad gained a { blend } arm and uploadTexture a { smooth } arm, BOTH caller opt-ins with titleScreen.js the only caller, so no game art path changed - pinned in both directions and mutation-proven four ways. Measured in the live shot: 65 distinct luminances across a feathered edge where the cutout would have given 2) SHIPPED. + THE MIDI.BSA SONG READER (2026-08-19: the ELEVENTH format reader, and the first written with NO DFU SOURCE AT ALL - DFU never reads this archive, it loads 133 pre-converted .mid files plus an SF2 from Unity Resources, so there is no reader to port and no reusable asset. Established from the shipped bytes of the user's own MIDI.BSA and corpus-gated over the whole retail archive. THE COMMISSION WAS WRONG AND THE BYTES SAID SO: this was briefed as an XMI reader, and there is no FORM/XDIR/CAT/ XMID chunk anywhere in the file - it is HMI Sound Operating System (signature HMI-MIDISONG061595), which shares exactly one trait with XMI, note-on carrying a duration, and differs in the delta encoding, ordinary MIDI VLQs rather than interval counts. Reading it as XMI desynchronises immediately. The file is named for the format it reads. 131 songs, 1286 tracks, all decoding; the load-bearing pin is the GLOBAL GATE - with the decoded event sizes every track consumes to its end-of-track landing BYTE-EXACTLY on the next track's offset, so a single wrong size drifts and fails. getSong returns a merged tick-ordered event stream a synth can walk. Sizes proven but meanings unknown are exposed RAW and say so, and anything unrecognised throws with song and offset rather than decoding to garbage. Verified independently before merge - the chunk-signature count, the song/track totals and the offset table at 0 mismatches, and the XMI-guess mutation killing 6 pins) SHIPPED. + U22 THE OPENING VIDEO (2026-08-19: VidFile.cs ported WHOLE - the tenth format reader and a TRUE 1:1, unlike the song reader that landed beside it, because this one has a DFU source and that one has none. ANIM0001.VID now plays ahead of the menu, where DaggerfallUI.InitGame puts it: the Start window is pushed and the VidPlayer pushed ON TOP, so the splash reveals the menu when it ends. Corpus-swept over all 17 retail VIDs with two exactness gates - decoded video blocks == header FrameCount, and final stream position == file size, from 98KB to 19.7MB, so a one-byte desync anywhere could not land on the last byte. FOUR DFU QUIRKS PRESERVED rather than smoothed (a mid-stream palette desyncs the stream, frameDelay is recomputed for every block so a video block inherits the last audio delay, a swallowed exception does not advance the stream so a bad block parks the reader forever, and Audio_StartFrame consumes its data before rejecting a bad rate) and ONE mechanism deliberately changed to keep behaviour: C#'s IndexOutOfRangeException on Color32[] is emulated with an explicit bounds throw, because a JS typed array drops an out-of-range write SILENTLY and a faithful transcription would have completed the very block C# aborts - the quirk would have been lost by porting the code correctly. Audio is ported, not deferred: the clip is built verbatim and scheduled on the WebAudio clock, though the boot splash plays SILENT until something resumes an AudioContext, since a browser will not start one before a gesture. THE INGEST BLOCKER the agent refused to fix itself was real - the diet drops all 86MB of .VID, so the deployed path would have warn-and-skipped the splash forever in exactly the AUDIT 18 F2 shape; ANIM0001 is now named in KEEP (MANIFEST_V 3 -> 4 auto-wipes stale sets) and VIDs are named ONE AT A TIME, because ingesting a video nobody plays costs every user the bytes for nothing. AND THE EYEBALL FOUND WHAT THE PINS DID NOT: the first live shot came back with a SKY-BLUE letterbox, the renderer's Iliac Bay clear showing around the native panel for the THIRD time in three slices, so drawMenuBackdrop now takes an optional canvas and all three hosts share the one helper instead of a fourth copy being written. F2's own sweep already enforced the ingest rule - it re-derives the fetch list from source, so naming getBytes('ANIM0001.VID') in main.js put the splash under the rule the moment it was written, proven by mutation) SHIPPED. + A5 MUSIC PLAYS (2026-08-19, Mac's call - "you lead this": the port makes music out of the user's own MIDI.BSA. The slice is TWO HALVES with two different standards of proof, and keeping them apart is the point. The PORTED half is SongManager.cs - the playlists verbatim (duplicates included, because a duplicate doubles that song's odds) and SelectCurrentSong arm by arm: taverns index gameDays directly so they walk in sequence day to day, dungeons seed DFRandom with unknown2 XOR (region<<8), everything else seeds on gameDays so a location's song is stable until midnight, and a list of ONE returns index 0 without consuming the generator - if it seeded, entering a temple would shift every later roll in the session. The OURS half is the synth, because DFU renders its own .mid files with a vendored synth and a SoundFont from Unity Resources: both DFU's assets, so there is nothing to port. 52 GM programs and channel-9 percussion means any sample answer ships megabytes or asks the player for an SF2, so the bank is oscillators - the only option that works the moment the page loads, and the worst sounding, so it sits behind an interface an SF2 replaces without touching the scheduler. Its specs are TASTE and are deliberately NOT pinned as truth: a pin saying 'program 48 is a sawtooth' would assert my own choices back at me, the vacuous-pin shape two audits have caught here, so the synth pins assert STRUCTURE - every GM program resolves, out-of-range clamps rather than throws, no percussion key is silent, and nothing can put a NaN in the audio graph. Music boots from the SAME seam as sound (shared.ensureAudio) for F6's reason - a second bootstrap is a second thing every host must remember - and the F6 pins were STRENGTHENED rather than relaxed to say so: one flag per subsystem, every subsystem behind the one seam. Verified by measurement, not by 'nothing threw' - tools/musicProbe.mjs taps an AnalyserNode in a real browser (peak RMS 0.056, all 40 frames audible) and tools/musicRender.mjs renders a WAV through the same production voice code so a human can listen. Mutation-proven eight ways. + A5b THE FM BANK AND ALL FOUR HOSTS, same day: the subtractive bank was replaced with TWO-OPERATOR FM, because that is the synthesis Daggerfall was scored for - AdLib/SoundBlaster OPL - and is why the archive carries an F*/FM* arrangement of nearly every song. Checked for a real OPL bank first and there is none: it lived in HMI's sound driver, ARENA2 has no .AD/.BNK/.OPL and no driver, and the song headers carry a device/channel map and zeros where patches would be. So the ratios stay ours on the same terms, but the METHOD is period-correct rather than arbitrary, and FM subsumes the old bank (index 0 is a bare carrier). AssignPlaylist's outdoor arms ported verbatim - night overrides weather entirely, Fog folds with Overcast and Thunder with Rain, an unrecognised weather falls to Sunny by DFU's OWN default - and all four hosts now play: dungeons, both outdoor hosts, and taverns on entry with the street's song handed back on the way out. THE CORPUS PIN EARNED ITS KEEP: it caught a NIGHT_SONGS_FM list I had EXTRAPOLATED from the GM shape rather than read - DFU's FM night array has SIX entries to the GM list's seven and there is no 10FM record in MIDI.BSA at all, which is exactly the asymmetry DFU's own :818 note describes. Thirteen mutations across the slice, all killed) SHIPPED. + AUDIT 19 COMPLETED THE PORT: the first pass had carried the outdoor and dungeon lists and stopped, so SIXTEEN of DFU's playlists and fourteen of its fifteen AssignPlaylist arms were simply absent - castle, court, shop, Mages Guild, plain interior, fighter trainers, palace and the FM tavern, every one resolving to a real MIDI.BSA record, which means it was music the player could never hear rather than a missing asset. Entering ANY building now takes its own list where only taverns did, and leaving any interior hands the street back its song. Two arms LOOK like the day/night gate and are not - a dungeon exterior and a graveyard take night songs at any hour - and are pinned at noon so the mistake cannot be made quietly. + THE 1:1 PASS then ported SongManager's ENGINE, which the port had never had at all: DFU is a MonoBehaviour that rebuilds a CONTEXT every frame - environment, weather, time, gameDays, locationIndex, arrested - and reacts to the difference, where the port had hosts calling playFrom at moments they chose. Three behaviours are unreachable without that loop and are now live and pinned: a new DAY or a new LOCATION re-picks even when the playlist is the SAME OBJECT, locationIndex is in the context at all, and a finished song re-evaluates the context before the next is chosen. PlayCurrentSong's guard is pinned both ways - it must not restart what is playing and must replay what ended. All four hosts now feed ONE director, and the two selection inputs two earlier passes had recorded as UNAVAILABLE turned out to be sitting in readers the port already had: the dungeon seed is the dungeon header's unknown2 XOR the region (4,232 dungeons, 3,769 distinct keys, near-uniform across the 15-song list) and the building faction id is on the building record (634 temples resolving to all three alignments, 119 of 237 guild halls the Mages Guild). Both pinned on the real archive. One input is genuinely still missing and is flagged: the port cannot tell a castle dungeon from a plain one. Caught myself committing the host-gap shape mid-fix - removing dungeonContext's playFrom without giving scenes/dungeon.js a director left ?dungeon silent - so the sweep now covers all four hosts, not three. Two more integration gaps closed after: the ARRESTED flag, whose only consumer in DFU is the music - PlayerEntity.CourtWindow sets it, OnPop clears it, AssignPlaylist checks it FIRST - existed nowhere in the port, so CourtSongs was unreachable; and CONTINUOUS CONTROLS, since pitch bend and CC7 were read once at note start and the archive puts 15,017 controller events inside notes that are already sounding. Bends now schedule on the sounding voices at their own tick and channel volume moved to a per-channel gain node, which also stops it fighting the per-note envelope. The PlaySong quest action is Ledgered rather than faked - it needs the quest system, not the music system) SHIPPED + U27 THE WIZARD'S BACK DOOR (2026-08-20: ui-chargen-4 - backing out of the race screen cancels the whole wizard per RaceSelectWindow_OnClose's Cancelled arm; the flow flags it, createChargenWindow fires onCancel once on the modal-contract latch, and every host unwinds with a reload to the boot flow's front door - the bare URL lands back on title -> main menu; the description box's No still just closes the box and deeper backs still walk; 3 pins, 3 mutations killed) SHIPPED + U29 THE LAUNCHER + REAL SETTINGS (2026-08-21, the SETT-slice: systems/settings.js IS DFU's SettingsManager - 13 sections, 171 keys and every default baked from the VENDORED defaults.ini.txt, the typed getters verbatim down to their failure modes (a bad bool reads False, a bad clamped int reads MIN); ours are the localStorage DELTA and the live/stored/unavailable TIERS. Seven settings went LIVE with real consumers - CombatVoices, PlayerTorchFromItems, LoiterLimitInHours, SoundVolume (a new master bus), MusicVolume, MouseLookSensitivity and InvertMouseVertical (ui/lookSettings.js, one home for three hosts) - all read at the point of use as DFU reads them. ui/launcher.js is one keyed native screen over all 171 that SHOWS what it will not let you change WITH the reason, and the boot gate is verbatim (SceneControl.cs:46 / wizard :154: the ARENA2 pick is our GameFolder stage, then GUI/ShowOptionsAtStart, ?launcher the held-key analogue). The EnhancedCombatAI divergence survives and is enforced: DFU ships it True, we implement the classic path, so it is tiered unavailable with its reason rather than offered as a lying toggle. 5 pins + 2 repins; the tier pin caught two lies in its own map) SHIPPED + AUDIT 24 THE SETTINGS/LAUNCHER PASS (2026-08-21: five findings on hours-old code, one severe - the launcher was KEYBOARD-ONLY while ShowOptionsAtStart ships True, so a touch device booted into a screen it could never dismiss and the game was unreachable on a phone (proven on an emulated Pixel 5 both before and after); the first fix put PLAY at a fixed offset that falls off a narrow canvas, which the same check caught. Plus: the FOURTH host (scenes/interior.js) missed by the mouse-look settings; GUI/ShowOptionsAtStart tiered `stored` while main.js read it; and the pin that let that ship - one-directional, now agreeing BOTH ways over a tree walked at test time. REFUTED by measurement: CH4's 16->60Hz senses cadence did NOT regress the C11 lag fix (0.63ms idle vs ~0.7 baseline, 57 vs ~65 NEAR). VERIFIED: SoundVolume composes as DFU's volumeScale * Settings.SoundVolume. 4 pins; 4 mutations, m4 survived unpinned and was pinned) SHIPPED + U28 THE WAGON (2026-08-20: the second inventory whole - the button ladder (noWagon / the dungeon exitTooFar / the ShowWagon toggle over the computed remote), the 750kg gates (WagonCanHoldAmount's zero-fit refusal + split-take, the drop-gold headroom clamp with its box), CheckWagonAccess's exit-door rule with the no-loot open landing ON the wagon in Remove mode, and playerEntity.wagonItems riding the save envelope; 4 pins, 4 mutations killed) SHIPPED. U30 THE SETTINGS MENU (2026-08-21: the launcher's flat tier-filtered list becomes a real menu - seven categories TOTAL and DISJOINT over all 171 keys with Audio and Mods promoted to their own homes against DFU's five pages, tier as three computed collapsible groups rather than a filter so nothing is hidden, DFU's own words from GameSettings.txt, the RANGE-EQUALS-CLAMP law that caught an invented LoiterLimitInHours 1..24 against DFU's 3..12, and a phone metric that keeps 14px text where nativeMetrics gave 7; tools/settingsProbe.mjs drives it in a real browser on desktop and phone and found a 36px control target inside a 44px row - drawn size and target size are two rects now; 10 pins, 5 mutations killed; the merge with the F2 lane carried its launcher volume fix into the code that replaced it - a row now shows the value IN EFFECT, not the stored one - and found its ARENA2-only constellation test RED and never once executed, failing first on a fake renderer with no gl and then on an assertion that expected a frame from a zero-length tick, which is the FLCPlayer pacing law inside out) SHIPPED. U32 THE SHEET'S FOUR BUTTONS LEAD SOMEWHERE (2026-08-21, reported from play: the F5 sheet's inventory/spellbook/logbook/history buttons were hit-tested, consumed and did nothing, by a comment that said so - and two of them were finished windows with no caller, the inventory since U8d/U26 and the spellbook since U4/M4, so wiring them was finding the caller rather than writing a window; playerHistory.js and questJournal.js are new on DFU's shared LGBK00I0 logbook art and needed no new state, reading the backStory chargen has composed since U13 and the quest log walk plus the PlayerNotebook that has carried THIS window's own line caps all along; the sheet OWNS its child and delegates to it rather than teaching four hosts a stack, which is DFU's push/pop exactly and zero host divergence; and the ANTI-LIE law - a host that cannot see the quest log has the logbook WITHHELD rather than shown empty; 7 pins, 5 mutations killed) SHIPPED. + U48 THE REST DISPATCH AND THE FOURTH HOST (2026-08-25: V5 landed the same lane from the other end while this was in flight - CanRest ported whole, three hosts wired, plainLines for the TEXT.RSC rows, one generic tick - so V5's is the port and U48 is what it left; canRestHere, makeRestDeps and a second tick seam were DELETED rather than merged. CanRest answers WHERE a player may sleep; DaggerfallUI.cs:651-688 answers WHETHER the window opens at all, and it still lived inline inside dungeonContext alone, so above ground the rest window opened WHILE SWIMMING, WHILE FALLING and with a foe in the street. restDecision has no scene gate: enemies, water, the ground and nothing else, with the enemies arm outranking the water because only IT raises the alert that arms the rest-encounter roll, the prevented-rest registry whose EMPTY STRING is deliberate, and a racial override that refuses SILENTLY from the bottom of the ladder. StartRestGroundedCheck moved to its DFU home in player/motor.js when the dungeon stopped being its only caller, and the raw grounded flag turned out wrong up here for a reason DFU never has: on a page whose motor is never stepped it sits at its initialiser false, so KeyR answered "You cannot sleep now." on solid ground. THE ?TOWN PAGE IS THE FOURTH HOST - V5's own pin says every host that can hold a player now has a rest arm and names three, and this page holds one. Plus the encounter catch-up riding INSIDE advanceMinutes in the world host alone. 8 pins, 28 mutations, 28 dead; three of them needed a second draft because they matched PROSE or a neighbour rather than the code) SHIPPED. Queue: the spellbook's native-art retrofit (SPBK00I0 over its text idiom, the way the level-up screen's rides its own slice), the class picker's scrollbar thumb, rest-on-native-art - the reader half is done, the synth half has no source law: ARENA2 holds no soundfont and DFU's SF2 is DFU's own, so the instrument source is a departure decision needing its own Ledger A row before the slice can start. + U60 THE DOOR IN FRONT OF THE DOOR (2026-08-26, Mac's call: a proper website - index.html at the Pages root is now a landing page for DAGGERFALL JAVASCRIPT, the public name, built on the enhanced skin's own shell with its tokens INJECTED from ENHANCED_TOKENS rather than restated, no picture on it by doctrine, THE GATE as its signature - the ARENA2 ask said first - and the game moved to /play/ with 86 probe URLs, the verifier, the stale-chunk probe and a second arena2 dev mount following it; 8 pins + tools/landingProbe.mjs 26/26 on desktop and Pixel 5) + U60b THE BRAND FACE, AND THE DETAIL (2026-08-26, Mac's call: Grenze Gotisch as the site's face - chosen off a rendered sheet of twelve, declared as the skin's --brand token, loaded through one URL builder that leaves the skin's own request byte-identical - brass corner fittings on the gate and a diamond on every section rule, and three new sections checked line by line against the arcs: WHAT'S IN IT (nine dated cards, 90 of 91 effects, the not-yet box), CONTROLS (DEFAULT_BINDINGS in three groups), GOOD TO KNOW; probe 32/32) + U60c THE LEDGER STRIP, THE PICTURES, AND THE CUT (2026-08-26, Mac's call: build - test count - lines of JS counted at build and pinned to the manifest gate; three screenshots of the ENHANCED screens taken by tools/siteShots.mjs with no game data anywhere - the wizard could not be one, it reads ARENA2, so the phone picture is the menu, and the pack is a labelled sample; the copy cut to say each thing once; probe2.mjs and repro.mjs deleted from the root; the tab icon as the fitting; probe 36/36) + U62 THE SWITCH ON THE DOOR (2026-08-27, Mac's call: the toggle out of Settings and loud - the word ENHANCED under the brand is the control, both skins shown, the one in effect brass and pressed, 'switch anytime' under it, 44px on a phone; one switchSkin for the row and the door; probe 22/22 with the press proven) + U63 THE SITE WEARS THE GAME'S FACE (2026-08-27, Mac's call: the website reorganized into the pixel UI's language - the shell's rail gone for a centred DOOR with the wordmark, a rule and gem, and Play as the one box; the night built in CSS from pixelGround's own ramp, seed and LCG and pinned to its stream; the skin's fonts request taken whole; the colour law restated as 'every colour is one the SKIN uses'; the fi ligature turned off on the site AND in the game, where it was reading 'files' as 'Ales'; the three screenshots retaken against the pixel home and the staged pack shot retired) + U64 THE DOMAIN AND THE HAT (2026-08-27, Mac's call: the live site is daggerfalljs.dev - Porkbun's parking records cleared, the Pages apex A/AAAA set and www CNAMEd, the cname on the repo BEFORE https_enforced because GitHub issues the certificate from it, and HTTPS on because .dev is HSTS-preloaded; nothing rebuilt, since base is relative and the page names no host; and a Ko-fi plaque at the door's top right with the cup DRAWN in box-shadow pixels, never an image and never the widget's script) + PX20a/b/c THE PACK'S CENTRE AND THE LOOT FRAME (2026-08-27, Mac's call: the doll takes the whole centre column six rows tall with HEAD and CHEST moved to the flanks - wear left, carry right - drawn at 4x, unframed, and its cell aspect-locked to the classic 110x184 so it is a perfect fit at any size; the character's name moved to the window title and the slots-filled count deleted, freeing the region so the tiles run 300px wide and carry a big monogram with the family word over THE PIECE'S NAME, which PX19g had to hide at 52px; and looting opens the LOOT FRAME ALONE, the pack unbuilt rather than hidden, with a Pack button back) + PX21a/b/c THE TRANSPORT STRIP, THE LOOT WINDOW'S READABILITY, AND THE HOVER PLAQUE (2026-08-27, Mac's call: a horse and a cart fall through filterByTab into the shirts, so they get their own strip with the cart plaque doubling as the wagon's door and the ownership questions given one home in inventorySession beside hasCart; the loot list becomes ROWS - icon, name, material, weight - because a chest you have never opened asks a different question from a bag you know; and looking at a pile names what is in it without opening it, on the take's own pick, one node updated only when the key changes, 10Hz, enhanced only) + PX22 THE JOURNAL'S THREE SECTIONS (2026-08-27, Mac's call: Main Quests / Side Quests / Archived, always, from one helper - PX5 had made the two active headings CONDITIONAL and named the side group 'Quests', and had put a Main Quest/Side Quest TAG in the detail, all of which the arc had recorded and the code matched; the record says so plainly rather than bending. An empty section stands and says so; the kind tag is gone because a quest is filed under its kind, not titled by it; the grouping law and the unsplit archive are unchanged, the latter because the notebook's filed header keeps only the display name) + PX21e THE LOOT WINDOW DOES NOT SCROLL (2026-08-27, Mac's call: the frame carried overflow-y itself and scrolled its own title and buttons away; it is fixed furniture now with the rows in their own box, and a long pile WIDENS to two columns rather than scrolling - as a grid, because multicol in a scroll container fragments in the block direction and scrolled anyway) + PX21f A TOOLTIP IS NOT A SCROLL BOX (2026-08-27, Mac's call: the tip inherited .packcol's overflow:auto - PX19j had turned off this element's ground and padding and missed the third - and PX21e's overflow:hidden on the loot frame was clipping the tip that lives inside it, so the frame is visible again and the flex constraint is what holds the no-scroll guarantee) + PX23 THE SPELLBOOK (2026-08-27, Mac's call off the board: four hosts built the player's book identically but for their TEXT.RSC reach, so ui/spellbookDoor.js is the fifth U52/U53 seam - and the board's 'hand-rolled duplicate' turned out to be the spell MERCHANT's shop, corrected in the record and pinned by its own deps; the enhanced book is the journal's bones a fifth time and imports every law it could read, including the lycanthropy free cast and both delete refusals in the classic's own words) + PX24 THE CHRONICLE (2026-08-27, Mac's call: the logbook and the history as ONE window, because what they hold is one subject - your notes, the messages you were sent, and where you came from; four construction sites collapse into ui/chronicleDoor.js and the CLASSIC skin keeps its two windows, since merging is an enhanced idea. Quests are deliberately absent: the pause window has carried them since PX4 and a second copy would be the two character sheets again)
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

## Open flags (regenerated 2026-08-19, AUDIT 18)

Regenerated mechanically at the AUDIT 18 close, from the FLAGGED/INTERIM
sites themselves. The audit retired 30+ flags whose text had gone false and
the eleven fix domains moved many more, so every line number and quotation
here was re-derived rather than edited. test/audit18_bible_docs.test.js now
pins this list BOTH ways: a citation that drifts, a flag retired without its
sentence, or a new flag never listed all fail the suite.

AUDIT 18: "Line numbers refreshed" used to close this paragraph as a hand
kept promise, and six of the 109 citations had already drifted (up to 41
lines) when 9036e49 moved chargenArt.js. The promise is gone; the list is
now checked mechanically both ways by test/audit18_bible_docs.test.js -
every citation's quoted text must sit on the cited line, and every
FLAGGED/INTERIM site in `src/` must appear here. A slice that moves a
flagged site turns that test red until the list is regenerated.

AUDIT 18 (combat) RETIRED the racial/proficiency half of
playerWeapon.js's INTERIM sentence and DELETED it: chargen writes the
DFU-numbered raceId, so CalculateRacialModifiers is ported and LIVE
(formulas.js). What still pends there is CalculateProficiencyModifiers
alone, flagged at its new site inside calculateAttackDamage. The
combat line numbers below are refreshed with it.

- `src/characters/enemyCasting.js:71` - * the magicka and a ranged spell at all. FLAGGED, and narrow: in DFU
- `src/characters/mobileUnit.js:21` - clock). DEFERRED (FLAGGED): the Seducer transform pair.
- `src/characters/paperdollArt.js:70` - *  needs no new field; FLAGGED: a remote list (shop stock, a corpse)
- `src/characters/playerEntity.js:5` - chargenSession - AUDIT 23). INTERIM until then, loudly: flat
- `src/characters/playerEntity.js:20` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:27` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:29` - fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stats above); applyCharacter re-derives from the rolled stats (S15)
- `src/combat/combatVoices.js:121` - * FLAGGED, both sites: DFU consults the racial override first -
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): proficiency
- `src/combat/playerWeapon.js:47` - /** INTERIM starting weapon (items arc replaces): Iron Dagger.
- `src/combat/weaponRig.js:37` - *                     (FLAGGED at the call sites - their HUD pends),
- `src/scenes/arrestFlow.js:199` - SeverePunishmentFlags |= 1 consequences pend (FLAGGED)
- `src/scenes/arrestFlow.js:267` - FLAGGED, still owed to their own slices: PreventEnemySpawns across the
- `src/scenes/cityGuards.js:27` - FLAGGED loud: enemy-vs-enemy stays out (C15 residual). (The
- `src/scenes/dungeonContext.js:253` - the chain lives, the motion is INTERIM (loud) until flats can tween.
- `src/scenes/dungeonContext.js:784` - index into the 18 careers) or the INTERIM default Warrior (16,
- `src/scenes/dungeonContext.js:1349` - FS1 - FLAGGED (THE FOUR HOSTS RULE): THE ENCHANT CTX IS NOT
- `src/scenes/dungeonContext.js:1384` - onTeleport: () => hudText.add('(Recall pends in the standalone dungeon - the anchor machinery lives in the streaming ?world host)'),   // TP-slice INTERIM
- `src/scenes/dungeonContext.js:1420` - onTeleport INTERIM shape). Absent, the engine's dispatch
- `src/scenes/dungeonContext.js:3241` - PX3 FLAGGED: questMessages - the dungeon quest mount is
- `src/scenes/dungeonContext.js:3349` - rest-for-a-while. DFU's toggle-close binding is FLAGGED in
- `src/scenes/exterior.js:586` - S3d: the INTERIM dagger seed is the FALLBACK only - a character
- `src/scenes/exterior.js:592` - pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
- `src/scenes/exterior.js:829` - onTeleport: () => townTalk.say('(Recall pends here - the anchor machinery lives in the streaming ?world host)'),   // TP-slice INTERIM
- `src/scenes/exterior.js:1067` - PX3 FLAGGED: questMessages - this test host mounts no quest
- `src/scenes/exterior.js:1410` - (FLAGGED: the climate People table pends; the test city is
- `src/scenes/shared.js:297` - *  The pre-chargen guard is load-bearing: playerEntity's INTERIM
- `src/scenes/shared.js:314` - *  mirrors motorStats (the INTERIM entity carries no stats). */
- `src/scenes/shared.js:419` - FLAGGED: the Skeleton's Key artifact (IsArtifact + world texture
- `src/scenes/townTalk.js:16` - FLAGGED loud: Info mode opens the same talk window (DFU routes
- `src/scenes/world.js:910` - S3d: the INTERIM dagger seed is the FALLBACK only - a character
- `src/scenes/world.js:916` - pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
- `src/scenes/world.js:2988` - slot. Dungeon-mode popups pend the dungeon overlay seam (FLAGGED:
- `src/scenes/world.js:3768` - castle interior (FLAGGED with the palace blocks).
- `src/scenes/world.js:4683` - building doors are the E-enter seam, not bashables - FLAGGED
- `src/scenes/worldModes.js:808` - FLAGGED: clicks on dungeon quest NPC/item flats pend the dungeon
- `src/scenes/worldModes.js:945` - FLAGGED to the crime arc, as the Ledger records.
- `src/scenes/worldModes.js:1014` - at the concluded deal (:1036-1051). FLAGGED: the equipped test
- `src/scenes/worldModes.js:1029` - G4: THE GUILD STORE ARM. This had been a FLAGGED null since
- `src/scenes/worldModes.js:1067` - credit instead. FLAGGED: there is nowhere to cash one yet, so
- `src/scenes/worldModes.js:1236` - is the quest machine's, FLAGGED with it.
- `src/scenes/worldModes.js:1241` - FLAGGED, above ground only, each with the DFU line it owes:
- `src/scenes/worldModes.js:1337` - trade window in Sell mode. The BANKING arm stays FLAGGED below;
- `src/scenes/worldModes.js:1432` - CW1 retired the FLAGGED list that lived here - every arm it
- `src/scenes/worldModes.js:1658` - fixed ship scenes and stays FLAGGED, so those buttons keep
- `src/scenes/worldModes.js:1690` - H3: the sell price, which was FLAGGED at zero because it needs
- `src/scenes/worldModes.js:1911` - FactionData; the port's pre-chargen INTERIM entity does not, and
- `src/scenes/worldModes.js:1967` - FLAGGED by name in guildServiceFlow.SERVICE_DESTINATION.
- `src/scenes/worldModes.js:2032` - skip, the refusal line. Only the destination was a FLAGGED null,
- `src/scenes/worldModes.js:2307` - been a FLAGGED null since G3.
- `src/scenes/worldModes.js:2352` - destination has been a FLAGGED null since G3.
- `src/scenes/worldModes.js:2371` - been FLAGGED nulls since G3.
- `src/scenes/worldModes.js:2476` - with the trade window's own mode flow, the same INTERIM the
- `src/scenes/worldModes.js:2701` - first (owned houses and quest buildings FLAGGED/seamed per
- `src/scenes/worldModes.js:2709` - (:515). X3 wired the Open-spell bypass (:519-520). FLAGGED: the bash arms with
- `src/scenes/worldModes.js:3073` - basket behind `loot.houseOwned` (:919) stays FLAGGED to the
- `src/scenes/worldModes.js:3708` - too. FLAGGED: interior loot containers are the loot arc's -
- `src/scenes/worldModes.js:3850` - string is the seam that was a FLAGGED null until this slice,
- `src/scenes/worldModes.js:3949` - *  FLAGGED null this slice closed. */
- `src/scenes/worldModes.js:4287` - *  FLAGGED: pause-and-resume is the DFU behaviour and a
- `src/systems/advancement.js:84` - * skill ids. The headless level-up applies immediately (INTERIM,
- `src/systems/automap.js:54` - the exterior town map (ui/exteriorAutomapWindow.js). FLAGGED
- `src/systems/banking.js:645` - FLAGGED, with the slices they wait on:
- `src/systems/biography.js:14` - FLAGGED, exactly as DFU flags them: AE, AF and AO are parsed and
- `src/systems/biography.js:81` - INTERIM, loud and the same one shopStock.js:115 carries: message
- `src/systems/buildingLocks.js:48` - *                                   (FLAGGED: banking is a ledger row -
- `src/systems/buildingLocks.js:56` - *                                   (FLAGGED with banking)
- `src/systems/chargen.js:9` - the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
- `src/systems/chargen.js:24` - INTERIM (loud): the UI distributes the bonus pools by hand; the
- `src/systems/chargen.js:132` - /** INTERIM headless pool policy (loud; the chargen UI replaces it):
- `src/systems/chargen.js:151` - spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy (the U2b flow replaces this path)
- `src/systems/chargenSession.js:7` - played the pre-chargen INTERIM entity (flat skills 30, maxHealth
- `src/systems/chargenSession.js:310` - *    - scenes/dungeonContext.js  FLAGGED: it holds the RAW flow as its
- `src/systems/controlsConfig.js:8` - FLAGGED with I1's combo flag: GetDuplicates' second and third
- `src/systems/court.js:28` - FLAGGED loud: execution (punishmentType 1) is unreachable in classic
- `src/systems/effects.js:48` - *  effect (:515). FLAGGED: DFU pulls it from the localised string
- `src/systems/effects.js:60` - *  Same FLAGGED caveat as the line above: DFU reads these from the
- `src/systems/effects.js:685` - enchantment bundles are FLAGGED to their own arc.
- `src/systems/effects.js:1461` - not the effect itself. FLAGGED (recorded divergence): DFU re-runs
- `src/systems/enchantments.js:151` - had been FLAGGED at its own site since S4c - "a magic item still
- `src/systems/enchantments.js:679` - a MagicRound-FLAGGED row's is the payload callback :1767
- `src/systems/encounters.js:79` - :687 - SpawnCityGuards, a WIDE band and 2..5 of them. FLAGGED: the
- `src/systems/encounters.js:258` - * STILL FLAGGED: the FoeSpawner sweep (:721-728) pends quest spawners
- `src/systems/equip.js:284` - /** INTERIM starting equipment (chargen's starting-gear roll
- `src/systems/factionRep.js:229` - *  pre-chargen INTERIM entity (characters/playerEntity.js) has no
- `src/systems/guildServiceActions.js:189` - *  turning into a vampire or werebeast - FLAGGED: the port has no
- `src/systems/guildServiceFlow.js:239` - *  override's law). Every other arm is FLAGGED with the window it
- `src/systems/inputActions.js:302` - FLAGGED, each with the slice it waits on:
- `src/systems/inventory.js:43` - *  FLAGGED: classic keeps gold in playerEntity.GoldPieces, a counter
- `src/systems/itemInfo.js:5` - U8e's inventory shipped an INTERIM info panel that made up its own
- `src/systems/itemInfo.js:87` - if (isPotionRecipe(item)) return INFO_TEXT.misc;   // DFU builds recipe tokens by hand - FLAGGED
- `src/systems/itemInfo.js:172` - *  screen. FLAGGED as a group - they land with their own arcs.
- `src/systems/knightlyGifts.js:3` - remaining FLAGGED service destinations, and the only two that need
- `src/systems/knightlyGifts.js:31` - FLAGGED, not ported: RestoreGuildData's legacy flag migration
- `src/systems/knightlyGifts.js:100` - * H1 - ReceiveHouse (:222-252), the LAST of the four FLAGGED service
- `src/systems/loot.js:17` - INTERIM (loud): MI (magic items) rolls need the MAGIC.DEF registry
- `src/systems/loot.js:228` - G4: THE VALUE IS OVERWRITTEN (:632). This had been FLAGGED here
- `src/systems/passiveSpecials.js:8` - arms FLAGGED since E1.
- `src/systems/playerTorch.js:12` - arm is FLAGGED here rather than guessed - see the note below.
- `src/systems/playerTorch.js:51` - FLAGGED (blocked on data this reference tree does not carry): the
- `src/systems/potions.js:245` - FLAGGED, with the slice it waits on:
- `src/systems/races.js:6` - port had only ever instantiated for Breton (the loud INTERIM the
- `src/systems/regionConditions.js:25` - consequences are FLAGGED in court.js).
- `src/systems/save.js:139` - (playerEntity's INTERIM skills: 30) - spreading it threw.
- `src/systems/sceneCache.js:154` - FLAGGED, with the slice it waits on:
- `src/systems/settings.js:39` - INTERIM doctrine - named, not silently ignored)
- `src/systems/shopStock.js:22` - INTERIM (loud): MagicItems stock is SKIPPED (the loot MI interim);
- `src/systems/shopStock.js:185` - (DaggerfallLootDataTables.cs:61). The INTERIM skip predated
- `src/systems/skills.js:113` - *  AUDIT 18: the +10% used to be INTERIM 0 behind a flag blaming a
- `src/systems/startingGear.js:3` - seedStartingEquipment's INTERIM iron dagger: a new character now
- `src/systems/talk.js:17` - crime/quest slices - FLAGGED there, not here).
- `src/systems/talk.js:293` - *  FLAGGED to the crime slice - the state lands now, verbatim).
- `src/systems/talkMacros.js:268` - *  the handler table has for them - here, the empty string. FLAGGED:
- `src/systems/tavern.js:195` - FLAGGED, with the slices they wait on:
- `src/systems/tradeModes.js:127` - *  destination has been a FLAGGED null, so the mode could not be
- `src/systems/tradeModes.js:177` - *  (DaggerfallTradeWindow.cs:960-963). FLAGGED: DFU reads the text
- `src/systems/tradeModes.js:402` - FLAGGED, with the slices they wait on:
- `src/systems/useItem.js:318` - lantern's and refuses when it would overflow. FLAGGED: DFU
- `src/ui/automapWindow.js:20` - portals stay FLAGGED (systems/automap.js keeps the list); A2
- `src/ui/bankWindow.js:28` - law's. The SHIP popup is still FLAGGED - it needs the two fixed
- `src/ui/bookReader.js:25` - INTERIM, loud: lines draw in the host font at a fixed 10px row -
- `src/ui/chargenArt.js:718` - *  AUDIT 17g FLAGGED: the scrollbar THUMB does not draw. Its geometry
- `src/ui/covenWindow.js:27` - FLAGGED: DFU binds each button to a DaggerfallShortcut hotkey
- `src/ui/enhancedMenu.js:1441` - FLAGGED: the rest of the keyboard. The wizard walks to `done` with
- `src/ui/enhancedMenu.js:1612` - if (action === 'delete') return;   // FLAGGED: no save manager yet
- `src/ui/exteriorAutomapWindow.js:22` - (:682-709) is FLAGGED - the port's directory carries named
- `src/ui/guildServiceWindow.js:33` - FLAGGED: DFU binds each button to a DaggerfallShortcut hotkey
- `src/ui/hudLarge.js:50` - FLAGGED: LargeHUDOffsetHorse and
- `src/ui/input.js:15` - and E's DFU meaning (AbortSpell) with Q's (RecastSpell) - FLAGGED
- `src/ui/itemMakerWindow.js:46` - FLAGGED: DFU opens a DaggerfallInputMessageBox from the rename
- `src/ui/listPicker.js:22` - FLAGGED: the scroll bar draws as DFU's plain thumb rect rather than
- `src/ui/messageBox.js:35` - FLAGGED: the scrolling variant (a label taller than MaxTextHeight
- `src/ui/messageBox.js:155` - so the strip never rides higher than that. FLAGGED as a
- `src/ui/nativeInventory.js:41` - still said Equip and equip-after-transfer were FLAGGED after U8g
- `src/ui/nativeInventory.js:302` - *  ClickAnywhereToClose message box. FLAGGED loud, exactly as the
- `src/ui/nativeTalk.js:273` - lands with the Tell-me-about slice (FLAGGED).
- `src/ui/nativeTalk.js:298` - B5-6: the four pages that were INTERIM no-ops. Each falls back
- `src/ui/paperDoll.js:18` - Human +2 - Breton INTERIM), record = playerTextureRecord
- `src/ui/paperDoll.js:64` - table, the loud INTERIM the U8f/U8g records flagged.
- `src/ui/pauseWindow.js:58` - FLAGGED: PauseOptionsDropdown (:83-84) - DFU's own quick-settings
- `src/ui/pixelDial.js:36` - FLAGGED (THE FOUR HOSTS RULE): no host is wired yet — world.js,
- `src/ui/potionMakerWindow.js:24` - FLAGGED: DFU's ingredient buttons carry a tooltip and a stack-count
- `src/ui/restWindow.js:2` - text-panel idiom (backgrounds FLAGGED pending art-name
- `src/ui/restWindow.js:11` - FLAGGED: DFU's Update also closes on the TOGGLE BINDING - the key
- `src/ui/restWindow.js:127` - FLAGGED, all three from OnPop/Update and all three belonging to
- `src/ui/restWindow.js:401` - where classic counts DOWN. The backgrounds are still FLAGGED
- `src/ui/spellbookWindow.js:104` - FLAGGED, idling loudly: the effect popup's body
- `src/ui/spellbookWindow.js:931` - *  drawn as a flat bar in the panel's own brass - FLAGGED. */
- `src/ui/tavernWindow.js:40` - FLAGGED, with the slices they wait on:
- `src/ui/teleportPopUp.js:8` - `Teleport: null, // FLAGGED: the travel map's teleport mode`. Two
- `src/ui/teleportPopUp.js:37` - FLAGGED: the HUD smash-to-black/fade either side of the jump
- `src/ui/travelMapWindow.js:10` - this window since the F-slice - the Ledger row called it INTERIM
- `src/ui/travelMapWindow.js:75` - FLAGGED, idling loudly: the guild TELEPORT mode
- `src/ui/travelPopUp.js:57` - FLAGGED, each idling loudly: the HUD smash-to-black/fade
- `src/world/actionSystem.js:466` - FLAGGED, a live gap, not parity.

## Audits

Newest first.

**2026-08-25 - THE ENHANCED-MENU AUDIT (U49 and everything under it).**
Mac's call the day the front door shipped. Scope: `ui/enhancedMenu.js`,
`ui/enhancedStyle.js`, `systems/uiSkin.js`, the `main.js` routing and
the two front doors, read adversarially against the port's own standing
laws rather than against DFU - none of this HAS a DFU original, which
is exactly why it needed reading. EIGHT findings, all fixed at root and
pinned, seven mutation-proven.

TWO WERE SEVERE AND BOTH ARE OLD SHAPES IN NEW CLOTHES.

(F1) AUDIT 24'S OWN LAW, BROKEN IN THE SCREEN THAT REPLACED THE SCREEN
IT WAS FOUND IN. Forty sub-44px touch targets on a Pixel 5: every row
label 19px tall, every value pill 38, every stepper 34 - and the CSS
carried a comment saying "the hit box around it is 44 because a thumb
is" over a rule that read `content: ''` and `position: absolute` and
nothing else. It drew no box, claimed no space and hit nothing. A
comment asserting a law the code does not implement is worse than no
comment: it is the thing a reader checks INSTEAD of measuring, which is
the AUDIT 17m shape. The classic screen's pin (settingsUI T14) could
not see this side, so `tools/enhancedTapProbe.mjs` now MEASURES every
button on every pane and every settings category on a phone in both
orientations - `getBoundingClientRect`, not a stylesheet - and kills
the original bug when the dead rule is put back.

(F2) CONTINUE COULD SILENTLY START A NEW GAME, which is AUDIT 19 F3
exactly, one layer down and past the guard F3 installed. `readQuicksave`
parses the blob; it does not test its VERSION, and `restorePlayer`
refuses a stale envelope AFTER the world has booted - printing "Save
version mismatch." into a HUD nobody is looking at yet and coming up on
the chargen wizard. Both front doors had it: the classic menu's
`hasSavedGame` was `!!readQuicksave()` and had been since U21. The
question is "can this build restore it", the answer belongs beside the
restorer whose law it is, and `restorableQuicksave` is now that one
home with both doors calling it.

(F8) WAS FOUND BY THE LIVE CHECK RATHER THAN BY READING, and that is
the entry's real lesson. On a phone the settings detail pane is a sheet
that only rises when a ROW is tapped, so the CATEGORY card - and the
Reset button living inside it - could never be reached at all.
Playwright spent thirty seconds trying to click a control translated
101% off the bottom of the screen. Same family as F1 and as AUDIT 24: a
control that exists, is drawn, and is unreachable on the device that
needs it most. A second tap on the active category opens it, which is
`settingsWindow`'s own second-tap-acts gesture one level up rather than
an invention, with a dot on the active tab because a gesture nobody can
see is a gesture nobody uses.

THE REST. (F3) Reset wiped every override on one press where the
classic screen has always confirmed - and the classic screen's own
confirm TEXT lies, promising to clear "this screen's own preferences,
like Text Size" when `resetToDefaults` never touches `uiPrefs`; the
enhanced copy says what it actually does. (F4) Delete was drawn
undimmed and operable-looking and did nothing, caught by `onAction` and
returned - the exact lie the anti-lie law forbids; it is wired now,
behind the same confirm. (F5) Colour and text rows drew a value with no
control and no reason, reading as broken rather than as unbuilt; colour
rows get the browser's own picker, writing through the same `setValue`
door as every other row and CARRYING DFU'S ALPHA BYTE through
(`ToolTipBackgroundColor` ships D2 and means it). (F6) The enhanced
skin pulls two font families from Google - the port's ONLY third-party
request, made by the DEFAULT skin, in a build whose doctrine is that it
ships self-contained; non-blocking and with fallbacks, but undocumented,
which is what made it a finding rather than a choice. Now a Ledger A
row with a `?nofonts` opt-out, and self-hosting is Mac's call. (F7)
`effectiveSettings()` - a full merge of all 171 keys - ran ONCE PER
ROW, so Video rebuilt the whole store sixty-six times per render.

CLEARED, recorded because each was checked: the mount/unmount cycle
leaks no listeners and resets its own state; `?skin` still persists
nothing; the classic path is byte-for-byte untouched; every control is
a real `<button>` so tab focus and Enter work with the browser's own
focus ring.

**2026-08-23 - AUDIT 25, THE COMPLETENESS AUDIT.** `01-Overview/Audit-25.md`.
Mac asked what we need to complete the 1:1 port. AUDIT 23 and 24 were
PARITY audits - they read `src/` against its C# originals and asked
whether what shipped was right. This one inverts the denominator: a
real DFU checkout (849 `.cs`, 261,659 lines) split into 27 subsystem
groups so every non-Editor C# file sat in exactly one manifest, a
surveyor per group, an adversarial refuter per survey (refute by
default - a false gap costs more than a missed one), and four
reconciliation passes over the top. 1,327 units judged; 767 surviving
gaps; ~63,400 JS lines estimated, against 88,640 in `src/` today. The
verdict: about two thirds of the way, with the remaining third
concentrated in whole systems never started - ENCHANTING at 0% (24
payload classes, no dispatcher, so every magic item is a label), BOTH
AUTOMAPS at ~2%, the six magic crafting windows, BANKING at 0%, the
classic `.SAV` reader at 0%, the pause menu and key rebinding at 0%.
Seven P0 blockers, all of them host seams over laws the port already
carries: **quest foes never spawn** (`createFoeGameObjects`/
`tryPlaceFoe`/`standFoe` have consumers and no supplier), the dungeon
half of the quest scene mount, `RespawnPlayer`, the dungeon quicksave
that drops quest + conversation state, and four of the talk window's
five pages. THE PATTERN WORTH NAMING: the port repeatedly translates a
law correctly and never wires it - `systems/mysticism.js` carries the
whole Mysticism school and only `silenceBlocksCast` has a production
consumer; `test/mysticism.test.js:224` *asserts* the host does not call
the rest. Exact counts where a surface was countable: quest actions 61
of 82 (21 are `PendingTrigger` guards), the classic effect library 60
of 82 keys landed (22 fall to `out.skipped++`), FormulaHelper ~80 of 97
statics (the 17 absent name the unbuilt services exactly). And the
finding about our own bookkeeping: of the 767 gaps, 137 map to a
Port-Ledger C row and 630 do not - **the ledger has been tracking about
a quarter of the remaining work**, because parity audits only see what
the port already touches.

**2026-08-20 - AUDIT 23, the whole-codebase bug + parity audit.** The
overnight mandate: a fresh 1:1 pass over EVERYTHING, before further
development. Seventeen read-only find lanes (formats x2, save/load,
hosts, guilds/factions/talk, cross-cutting, entity laws, audio/music,
items/economy, magic, combat, characters/AI, world-assembly,
world-terrain/streaming, player-motor, ui-native, ui-chargen) swept
src/ against the full DFU Scripts tree with dual-evidence rules;
~180 findings landed in the session scratchpad register, the
high-impact set re-verified by hand against both sources before any
fix (DO NOT FIX WHILE THE VERIFIER IS READING held throughout - fixes
waited for their files' lanes). Two majors were REFUTED in hostile
verification and are recorded as non-bugs: interior/dungeon editor
flats are correctly hidden (DaggerfallBillboard.Start disables the
renderer for FlatTypes.Editor unless the debug ShowEditorFlats option
is on - the lane read the layout functions, not the billboard), and
with them the M4 doc-truth claim stands as written.

FIVE FIX WAVES, every fix pinned (audit23{,_magic,_combat,_systems,
_hosts,_ui}.test.js - 56 new pins), the key pins mutation-proven
(twenty-plus mutations, each a red suite):

WAVE 1, save integrity - the SHIP-BLOCKER (two independent finders):
a save loaded before anything attached the faction store dropped
every earned reputation permanently; restore now stashes, a
store-less re-save carries the stash, attach replays it. Guild
memberships clear-then-apply on load; lastSkillCheckTime rides the
envelope anchored at the classic start; regionPrices persists;
dropped piles ride the dungeon world snapshot with their saved icon;
worldModes' quickload applier goes through player.spawn.

WAVE 3 laws: the classic Free Action patch (SPELLS.STD spell 10);
AreaAtRange wall explosions; cast tallies; the absorption self-cast
refund cap made live; cost-at-ready + instant CasterOnly; the enemy
silence gate; THE BOW MACHINE ENGAGED (isBow was never set - bows
swung on the melee clock); multi-target melee; foes-before-env; the
swing sounds moved to DFU's placements; Arrow=131/Helm=107; item
conditions minted everywhere; icon variant clamps; %wth/%kg; the
TEXT.RSC empty-variant step-back; the first-wins spell fold; the four
guild subclass service switches + the Mages library; TG_Spymaster
806; FrameSpeedDivisor; spawn bands; pile gender; song channel-gain
resync; advancement moved from the per-minute tick to the rest-end
close (DFU's only live site).

THE HOST BATCH: ONE CLOCK - the exterior hosts' time-of-day gates
read a frozen demo clock while gameplay time advanced elsewhere, so
night never fell for music, lights, windows or the sun; minuteNow now
reads worldMinutes (?tod sets, ?timescale scales), the sky adds the
calendar season, ambient rides the weather scale. The exhaustion
collapse, jump drain+tally, quarter-rate Running tally and the
112-day reputation normalization all moved into the shared entity
tick with per-host presenters; the guards demand the classic clock;
the exterior swing arms drain and tally fully (the double tally
died); death above ground presents again; night interiors darken;
dungeon F5/F6 swallowed; the music director feeds above the modal
return; the wandering population takes the climate race with the
region name bank; the motor forces the swim crouch and Jump no longer
breaks the stealth standing test.

WAVE 4 + docs: the level-up double pool roll; talk activation
distances (the 76.8 ray with per-mode too-far lines); the drawn-space
GlyphSpacing asymmetry; the chargen skills cursor; the voxelfolk rig
leak; Charm prices chance only; the player cast sound; duplicate
constants deleted per ONE DFU MEMBER ONE EXPORT. THIRTY-NINE
doc-truth findings resolved: stale FLAGGED/INTERIM sentences retired
or corrected across fourteen files, three new Ledger A rows
(lightSourceIndex, AmbientEffectsPlayer PRNG, the biography GP-minus
inert divergence), the castle-detection and Move-door rows corrected,
and TWENTY-EIGHT new Ledger C rows routing everything the audit
established as unported (above-ground spellcasting is the PRIORITY
row; condition damage, combat voices, archer bands, pacification,
enemy doors, encounter spawns, encumbrance, climbing, spellbook
management, and the rest are named with their DFU members).

Numbered 23 because the two paused parallel sessions landed AUDIT 21
and AUDIT 22; their fixes are merged below but their own log entries
were never written into this section - noted here so the numbering
reads straight.

**2026-08-19 - AUDIT 20, the parity pass over S25 + G1 + G2.** Numbered
20 because AUDIT 19 is in flight on main (batch 1 landed; its Home.md
entry has not). Scope: the faction reputation store and the two guild
slices built on it, read against PersistentFactionData.cs, Guild.cs,
GuildManager.cs, Temple.cs and KnightlyOrder.cs. The read was completed
BEFORE any fix (17l), and every one of the nine fixes is pinned and
proven to fail when reverted.

FIVE MAJOR. (1) THE THIRD REPUTATION CHANNEL DID NOT PERSIST: the save
envelope carried sGroupReputations and legalRep but not the faction
store, so every backstory `rf` answer and every crime's People delta
was lost on load - and guild rank, computed from it, reset with it.
(2) Guild memberships did not persist either; DFU serialises
GuildMembership_v1. (3) applyHeadlessChargen - the ?class= path all
three exterior hosts can boot - never attached the store, because it
is a SECOND copy of the construction that hand-rolls the starting kit
instead of going through applyCreationExtras. THE ONE CONSTRUCTION
SEAM, found for a fourth time, in the same shape 17f, 17h and 17i each
found. (4) The membership slot is keyed by GUILD GROUP in DFU, not by
guild: all eight temples share HolyOrder and all ten orders share
KnightlyOrder, so joining Mara's temple REPLACES Arkay's. Keyed by
name, the port let a player hold all eight temples and all ten orders
at once. (5) TokensPromotion is PER RANK in five of the six guilds -
the message announces the benefit that rank unlocked (Mages library at
2, magic items at 3, summoning at 6, teleport at 8; Thieves fence at
2, spymaster at 4; the Temple's is computed from its own service-rank
columns, which is what makes those columns load-bearing). The port
returned one flat record, so a member promoted into a benefit was told
the generic line.

FOUR MINOR. GetGuildGroup's "temples nested under deity" branch was
missing, and every divine's own ggroup is None in the shipped file, so
every temple answered "not a guild". guildOfFaction still answered
null for all eighteen variants after G2 shipped them. zeroAllReputations
REBOUND store.dict, stranding any caller that captured it - court.js
reads it on every crime. And createFactionRep's clone was one level
deep, leaving the children array shared with the reader, so the
module header promised a guarantee it did not keep.

Two DFU behaviours were left deliberately unported and flagged rather
than guessed: the Thieves Guild's rank 6/8 promotion messages are
RevealLocation()-gated (quest/map state), and the Knightly Order's
rank 9 message is OwnsHouse-gated (banking). Both take the plain
promotion record until those slices land.

1051 tests -> 1060, and the suite is green with ARENA2 set and unset.


**2026-08-19 - AUDIT 18, the whole-codebase parity audit.** Mac's call:
the ultimate bug-and-parity pass over everything ported so far. 18
domain lanes read the port against the DFU C# and produced 147
findings; a hostile verifier per lane, told to REFUTE by default, then
re-opened both sources on every one - 130 CONFIRMED, 15 PARTIAL, 2
REFUTED, and 84 MORE defects the verifiers found while re-reading.
Eleven fix domains applied them in isolated worktrees, each required to
prove every pin FAILS when reverted. 160+ fixes, 221 new pins, 688
tests -> 909.

TWO THINGS WERE BUILT THAT THIS PROJECT HAD NEVER HAD, and they carried
the audit:

THE DIFFERENTIAL HARNESS. DaggerfallConnect's own readers now COMPILE
AND RUN under Mono (35 reader files + a tiny Unity shim; there is no
UnityEngine.Vector3 dependency at all - FaceUVTool uses
DaggerfallConnect's own DOUBLE-precision Vector3). Both sides dump the
same format - floats as IEEE-754 bit patterns, bulk data as SHA-1 - so
comparison is exact. 10,865,545 values compared across every reader and
the whole ARENA2 corpus: 12,487 BSA records, 11,211 TEXTURE frames plus
the full getColor32 parameter surface, ARCH3D's 797,433 points, WOODS'
500,000-pixel sweep, MAPS' 15,251 locations, 1,295 BLOCKS, 65,000
DFRandom draws. The reader layer came back byte-identical. Three real
divergences fell out (F3, F4, and the fixed-length ReadCString), and
one honest correction: Ledger row 18's approved float->double widening
costs 52,505 of 1,917,087 UVs (2.74%) - nobody had ever measured it,
and "validated against corpus" had never meant bit-identical. A 1,803-UV
residual at MATCHED precision is unexplained and is now a Ledger C row
rather than a silence. The harness is re-runnable.

THE MUTATION AUDIT. 631 targeted one-character mutations to ported
logic; 281 SURVIVED all 688 tests - a mutation score of 55.3%,
validated by re-running a random sample of survivors against the full
suite (12/12 still survived). 29.9% of src/ lines were executed by no
test. Only 24 of 179 parity-surface tables were pinned whole. The four
parallel scene hosts - 3,906 lines of DFU-cited behaviour - had ZERO
execution coverage, known to the suite only through five regex greps.
The weakest operators were the ones this port depends on most:
trunc/floor/round swaps 44% caught, >> vs >>> 20%. And one pin was
vacuous by construction (enemyequipment.test.js's armour deepEqual had
IDENTICAL ternary branches, so it pinned nothing about which parts a
Buckler protects).

THE HEADLINE DEFECTS. Every armed player swing computed NaN: DFU never
stores a weapon's damage, it resolves the TEMPLATE on every swing
(GetBaseDamageMin/Max), and the port read baked fields that only enemy
equipment ever set - so from the moment S3d's starting gear replaced
the interim dagger, a chargen-created character did NaN damage with the
weapon the game hands them. Three shipped readers had NO DATA in
production (the ingest diet predates U18/T3a/S3e and dropped
CLASSES.DAT, FACTION.TXT and every BIOG*.TXT; dev hid it because vite
serves the network fallback that production 404s). U7 rest never
advanced an hour in either host - the clock ticked inside drawFoes,
which both hosts skip whenever an overlay is up, and the rest window IS
the overlay. ?world and ?exterior were ENTIRELY SILENT until a dungeon
was entered. No enemy could fire a bow. Looted gold was unspendable. 26
of 58 fully-implemented spells were charged the wrong cost. And the
player's whole world clock - magic rounds, disease days, poison rounds,
fatigue, skill advancement - ran ONLY inside a dungeon, so a character
who stayed above ground never advanced a skill or gained a level.

THREE TIMES THE PIN WAS THE FINDING. F1's fixtures built weapons in a
shape no production path mints, which is exactly why the NaN shipped
invisibly. F3's pin asserted the port's own invention (rulerPowerBonus
20..70) over DFU's value - FactionData is a struct, DFU copies it into
the dict BEFORE assigning the seed, so every faction it hands the game
carries 0 - and that pin would have made the fix read as the
regression. And the suite could not see the NaN, the silence, the
frozen clock or the dead bow at all, because the hosts have no
coverage.

THE MERGE FOUND FOUR MORE. Eleven independently-developed domains
disagree, and reconciling them was not bookkeeping: two fixed the audio
bootstrap separately (two bootstraps, two flags - the duplicate-port
shape this project keeps catching), two fixed the ingest diet
separately (the blanket .TXT form won over the named one: it removes
the class, not three instances), a pin asserted ENEMY_BASICS had no
parrySounds column while another domain was adding it (EnemyBasics.cs
gives Knight_CityWatch ParrySounds = true, so the merged CODE was right
and the PIN was the stale half), and one domain replaced
enemyGroupOf(affinity) with enemyEntityGroup(careerIndex) - DFU groups
by career - while another still imported the old name. That last one is
a hard ESM link error that SURVIVED ALL 904 TESTS and was caught only
by `vite build`. It is pinned now: F7 imports every module under src/,
so a dangling import fails the suite instead of the deploy.

THE DOCS WERE LOAD-BEARING AND WRONG. Port-Ledger C listed
breath/drowning and the crouch motor as unported when P12 shipped both
- LIVE CODE sitting inside the Ledger's own "not yet ported" exemption,
which is precisely how a defect there would have escaped this audit.
Systems.md and UI.md said "Not started" for arcs that shipped S1-S22
and U1-U20b. Testing.md claimed CI ran "88 pass, 49 skip" - it was 613
/ 75, describing a suite that had not existed for many milestones, and
the real point it hid is that those 75 real-data pins NEVER RUN IN THE
DEPLOY GATE. Two source comments cited Ledger rows that do not exist -
the exact AUDIT 17m shape, twice more. Home.md's open-flags list is now
regenerated MECHANICALLY from the flag sites and pinned BOTH ways: a
drifted citation, a flag retired without deleting its sentence, or a
new flag never listed all fail the suite.

WHAT THE PINS LEARNED. The audit's own rule - A PIN MUST FAIL - was
applied to every fix by reverting it, and several agents reported
honestly that a doc-only change cannot be pinned rather than padding
one. Where a host seam genuinely cannot be driven in node, the pin is a
SOURCE SWEEP and says so. Where a fix made something testable for the
first time (the player world clock, the fatigue bands), the pin is
behavioural. Three pins were rewritten from source greps into
behavioural assertions when the merge made their mechanism stale but
their intent correct.

**2026-08-19 - AUDIT 18, the DOC-TRUTH sweep.** The bible is load-bearing:
17m proved a false "recorded in the Ledger" claim actively hid a live defect
from the person checking whether it was known. This pass audited the bible
AGAINST the code and fixed what was false, with the checks that keep it that
way in test/audit18_bible_docs.test.js.

Present-tense lies, corrected: `06-Systems/Systems.md` and `10-UI/UI.md` both
said "Not started" through S1-S22/E1-E3 and U1-U20b (37 and 19 live modules);
`03-World/World.md` said COMPLETE where the arc had reopened;
`04-Characters/Characters.md` said ACTIVE and stopped at C5;
`01-Overview/Port-Doctrine.md`'s phase plan still called Readers-Arc active.
`07-Rendering/Rendering.md` listed `groundMesh.js`, deleted at R10, as a
CURRENT module and tagged it "(ledgered departure)" when Ledger A has no
ground-mesh row - the 17m shape exactly; `03-World/World-Arc.md` carried the
same module plus `terrainMesh.js`, deleted at R9. This page's ground rules
still said "Desktop-only. No touch controls, no mobile layout" six days after
the approved touch layer shipped into all four hosts. This page's open-flags
list promised "Line numbers refreshed" while six of its 109 citations pointed
at the wrong line, up to 41 off.

Ledger lies, corrected: section C still listed breath/drowning AND the crouch
motor as unported, so P12's live code was sitting inside the Ledger's "not
yet ported" exemption (the Argonian breath refund and PlayerHeightChanger's
0.1s timed transition, which genuinely are unported, now have their own row);
the house-container row claimed a feature S2b shipped; `Audio.md` closed the
activation-sounds queue on the claim that both PlayerActivate clips were
"already ours", when ActivateLockUnlock = 316 is in neither soundClips.js nor
any consumer (folded into the door-lockpicking row, where its mechanic
lives); section B recorded a 0-hour rest running a full hour as a preserved
DFU quirk when DaggerfallRestWindow.Update ends a 0-hour rest immediately -
the row was a divergence wearing a quirk's clothes; and the SetEnemyEquipment
Feet-slot quirk (EnemyEntity.cs:414's strict `<`, which leaves enemy boots
out of ArmorValues[Feet]) had no row at all while enemyEquipment.js
subtracted them - up to a 65-point swing at daedric. Two source comments cited
Ledger rows that did not exist (chargen.js's `isCustom`, encounterTables.js's
dead Cemetery block); both now have B rows.

Silent gaps promoted out of prose: `collectExteriorNpcs` has NO production
caller - the interior twin is live, the exterior side is dead - so no
exterior static NPC is a talk or activation target, recorded as a C row
rather than left inside a "C2 SHIPPED" heading. `Systems-Arc.md` said
DamageSpellPoints' MagnitudeCosts(20, 28) was "already in the S10 cost
table"; spellcost.js has no `4,2` key, so those spells fall through to the
zero-component fudge and are priced wrong.

Lesson, and the reason for the new test: EVERY check here is mechanical.
Home.md's open-flags list is grep-regenerated from `src/`, which is why it
could never catch a false claim in Home.md's own prose - a doc rule that
only a human re-reads is a doc rule that rots. The pins assert citations
resolve, that flagged sites and the list agree BOTH ways, that every
`src/...` path the bible names exists, and that a section index cannot say
"Not started" while its own arc says SHIPPED.

**2026-08-18 - AUDIT 17n, the parity pass over U20b.** The data came
back clean - the 50-entry difficulty table diffs key-for-key AND
value-for-value against the C# literal, all 71 labels match DFU's
recovered FALL.EXE text, every secondary list matches in order, and a
career's flags survive the save round trip (the shape 17h caught
dropping reputation). The WIRING did not. THE ENEMY-TYPE ATTACK
MODIFIER HAD NEVER APPLIED TO ANYBODY, broken in two independent
places: DFU reads attacker.Career.<group>AttackModifier for every
attacker (FormulaHelper.cs:993-1030) and the port flattened that byte
onto the entity, where only the FOE builder set it - so a player, who
carries `career` and no flat field, tripped the null guard and scored 0
on every swing; and underneath it, calculateAttackDamage threaded
targetGroup to the monster and hand-to-hand branches but called
weaponAttackDamage without it, leaving that function reading
`target.group`, a field NOTHING in the codebase mints. The target half
was correct all along, which is exactly why it looked wired. Not a U20b
regression - the classic ASSASSIN ships 0x04, a Humanoid bonus, and has
never received it; U20b only made the same modifier purchasable.
Catalogued alongside: which U20b picks actually do anything (six live,
twelve inert for want of a consuming subsystem - in the Ledger, so the
window does not imply they all work), and two standing interims whose
"pends a decode" notes are now stale because U20b provides the decode.
Seven pins, mutation-proven.

**2026-08-18 - AUDIT 17m, the picker's row is not the document's
class.** U20a's adversarial review finished after the slice had
already merged, and one finding survived every lens. DFU carries TWO
class indices - `characterDocument.classIndex` (written at the
wizard's :343, :364 and :382) and CreateCharClassSelect's own
`listBox.SelectedIndex`, which the wizard never writes and which
survives a revisit because SetClassSelectWindow reuses the window
(:158-167). The port had ONE field doing both jobs, so `customExit`'s
affinity write also moved the class picker. That cost a character:
build a custom class, press Escape off the biography-method screen,
and the list came back on a STANDARD row - confirming there ran
`_acceptStandardClass`, nulled `customCareer`, and made the player a
class they never picked. Split into `classIndex` (the document) and
`classListIndex` (the picker), with `_adoptCareer` as the shared tail
of the accept arms so they cannot drift apart again. Fixed with it:
the builder's keyboard had a live `plus` arm against a DEAD `minus`
one (the overlay table matches `-` as a character first), so a
keyboard could spend from the freeEdit pool and never refund - DFU has
no keyboard stat control on that screen at all, and the pool moves by
click now. And a doc find worth more than its size: UI-Arc.md claimed
the conflation was "Recorded in the Ledger" when no such row existed,
which actively hid the defect from anyone checking whether it was
known. RETIRING A FLAG DELETES THE SENTENCE - it is deleted, not
backfilled, because the departure is fixed. Six pins, mutation-proven
(restoring the original defect fails three).

**2026-08-18 - AUDIT 17l, the U20a parity review.** The custom-class
builder was reviewed adversarially against its DFU sources the moment
it was written - five dimensions (the builder's own laws, the
reputation window, the wizard wiring, the port's standing rules,
regression risk in the seams U20a changed), each finding then read
back against the C# before it was believed. Sixteen survived, all
shipped: eleven inside U20a itself and five here, in the slices it
touched.

(F1) THE EXTRACTED LIST PICKER PICKED ON A SINGLE CLICK. U20a pulled
`drawListPicker` out of the class list so the builder's skill and
help pickers could share it - and carried the geometry but not the
GESTURE. A DaggerfallListPickerWindow raises OnItemPicked from
`listBox.OnUseSelectedItem` (:84,136-148), the DOUBLE-click door U17
already pinned for the class list. One click selects, two pick, and
Return goes through the same door - one implementation for all three
pickers now.

(F2) THE DUNGEON HOST'S FONT-LESS FALLBACK HAD REGROWN ITS OWN APPLY
CODE. `chargenInputFallback` hand-built its result and called
createCharacter / startingSpells / assignStartingGear directly, so it
silently dropped every field the flow has grown since - 17f caught
that shape for the spellbook, and U20a's `isCustom` and custom
reputations had already fallen through it. The tail is factored now:
`applyCreationExtras` owns the spellbook, the kit and the reputation
seed, and both finishChargen and the fallback come through it. The
FOURTH instance of the dungeon-host-falls-behind shape this week.

(F3) THE MINUS KEY WAS UNREACHABLE, and had been since the stats
screen shipped. `overlayAction` tests the typed-character class FIRST
and the hyphen is a literal inside it (input.js:18), so `-` always
arrives as `char:-`: a stat or skill point could be spent from the
keyboard and never taken back. ('+' and '=' were never affected -
neither is a typed character.) Both screens accept the typed hyphen
as their minus now.

(F4) THE REPUTATION BALANCE IS THE WINDOW'S OWN FIELD, not a fresh
sum. `pointsToDistribute` is a short initialised to 0 and updated
only by UpdatePointsToDistribute on a BAR CLICK, and the window is
NEWed on every press of the Reputations button - so re-opening it
over an unbalanced ledger reads 0, and the exit gate reads that stale
0. Classic really does let an unbalanced ledger out that way. Ported
as a field, with the Escape-cancels-unconditionally arm beside it.

(F5) ONE DFU MEMBER, ONE EXPORT: the six magic schools were declared
twice - U20a's `MAGIC_SKILLS` and the private `MAGIC_SKILL_IDS` that
`SetEnemyCareer` has used since S16. Both import one table from
skills.js now.

Also fixed inside U20a before it shipped: the rep hit was
horizontally unbounded (an off-panel click set underworld
reputation), the picker's origin became a constant so its hit is
art-free like every other screen (it was the one path the pins could
not drive), the rep window's Escape was wrongly gated, a click on the
middle line kept the old value where DFU zeroes it, both draw arms
now guard `flow.custom` the way the hit arm does, and repClick could
emit a negative zero.

**2026-08-18 - AUDIT 17k, the parity pass over U16 + U17 + U18, and
THE FIST CRASH.** Mac's report first: attacking with a fist crashed
the game. Root-caused live (tools/fistProbe.mjs reproduced it at
`dungeonContext.js:1488` before the fix): bare hands are a NULL weapon
since U8h bound the rig to `equip.slots[RightHand]` - and the DEFAULT
state, because starting weapons land in the bag unequipped (DFU adds
them via AddItem, never equips) - and the DUNGEON host read
`WEAPON_SKILL[playerWeapon.weapon.name]` raw at BOTH its swing sites
where the exterior hosts guarded with `?.`. The strike-frame bow test
threw on EVERY bare-handed swing; the melee tally threw on every
resolved fist hit. The FOURTH instance of the
dungeon-host-falls-behind shape (17f twice, 17h, now this), so the fix
ships with the 17i-style rule: a source sweep over src/scenes FAILS on
any `playerWeapon.weapon.` deref without the guard (17k F2,
mutation-proven), a functional pin drives the whole bare-handed path
(ready with no draw sound, swing, HandToHand damage), and a corpus pin
holds WEAPON10.CIF - the fist art, now the default draw - against
every MELEE_ANIMS row. Probed: two full fist swings in the dungeon,
zero page errors, the fists eyeballed mid-swing.

(F1) THE CONSTELLATION PALETTE NEVER RESTORED. DFU constructs the
questions window over a FRESH ImgFile every time, so a re-entered
screen always shows the file's own palette; the port keeps ONE CHGN
palette and only ever WROTE the brightened blues into it - so a
second run's un-answered screen re-uploaded the LAST run's
constellation glow under the 'pristine' texture key. The palette law
extracted pure (`constellationPalette`): answered runs write
(0,0,blue), a pristine draw restores the slot colours captured at
load. Pinned both ways, mutation-proven.

(F3) THE SCROLL CLAMP'S BOUNDARY WAS UNPINNED. The U18 scroll pin
only exercised labels far from the text-window edge, so mutating the
strict `>` to `>=` survived it. The 17k pin walks a 7-row label to
the exact edge: one pixel past scrolls, exactly ON the edge blocks.

Clean elsewhere: the U16 summary re-read against CreateCharSummary.cs
whole (the pool zeroing, the four-pool OK gate, restart, the name box,
the biography bonuses on the summary's skill block - all as pinned);
Escape-cancels verified against DaggerfallPopupWindow's allowCancel
default (no CreateChar window overrides it, so the method and
questions screens cancel exactly as ported); the U18 click boundaries
(strict margins, strict row bounds, no x test) re-checked verbatim;
the answer-table/nibble/results-walk laws already deepEqual-pinned;
the remaining raw `entity.weapon` derefs all sit inside
`if (entity.weapon)` guards (dungeonContext:403/417, cityGuards:95).
Recorded, not fixed: the dungeon tests its bow branch by WEAPON_SKILL
where the other hosts use weaponTypeForItem - same verdict for every
item and for null, two spellings of one law.

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
and the obvious fix is wrong for this architecture) and Chain2
reachability (constant fixed; nothing mints it until classic-save
import). The KRAVE01.HS2 Order-of-the-Raven override SHIPPED in
AUDIT 18 - the "needs otherNames threading" blocker was stale
(otherNames has always been at dfBlock.rmbBlock.fldHeader.otherNames);
it is now in talkTopics.mergeNamedBuildings and fires on 16 Dwynnen
buildings across 16 towns, pinned over the real corpus.

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
(7670dd5..HEAD).** Re-diffed every slice shipped on this lane since
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
sweep).** Full pass over the two-lane merge (`3f3d827`), closed green
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
tools/fpProbe.mjs. The before/after gallery is generated LOCALLY into
visual-changes/ and is gitignored - AUDIT 21 (doctrine F1) found it under
public/, which Vite copies into dist/ and deploy.yml publishes, and twelve of
its fourteen frames carried classic WEAPON*.CIF sprites.
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
KEEP on both diets; SKY-on-lean is the designed gradient. (AUDIT 18
correction: NIGHTSKY.COL really is fetched - scenes/shared.js:46 loads
it through `img.paletteName` - but MAP.PAL is NOT. Its only namer is
ImgFile.paletteName for TMAP00I0.IMG, and the one loader of that file,
chargenArt.js loadOne, draws it with the shared ART_PAL and never
re-palettes. MAP.PAL belongs to the diet's KEEP list, not to its
VERIFIED-FETCHED list, until the re-palette loader lands.) The
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

- Desktop-first. A mobile touch layer (`src/ui/touch.js`: virtual stick +
  look/attack drag + button row speaking the desktop input language) ships
  for on-device testing and is wired into all four hosts - Port-Doctrine.md:19,
  approved by Mac 2026-08-13. (AUDIT 18: this bullet denied the touch
  layer outright for six days after it landed (approved 2026-08-13). The
  open-flags list below is grep-regenerated from `src/`, so it can never catch
  a false claim in this file's own prose.)
- Bible is flat under `bible/`. This file is the index. No Dashboard.md.
- Prototype HTMLs at repo root must register in `vite.config.js` rollupOptions.input.
- One feature at a time. Grep first. str_replace over rewrites.
