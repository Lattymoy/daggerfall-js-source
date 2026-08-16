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
- `03-World/World-Arc.md` - COMPLETE. Milestone 9: floating-origin streaming world (?world). Queue empty; routed rows (teleporters, platform riding, swim/levitate) wait in Ledger C.
- `03-World/Player-Arc.md` - ACTIVE again. P1-P9 + P10 TELEPORTERS + DOOR LOCKS (the delegates verbatim, RDB starting locks + look-at-lock tiers, flat/marker actions joining the graph, the repeated-block action-key collision fixed) + P11 SWIM/LEVITATE (2026-08-16: the LevitateMotor path with GetSwimSpeed and the surface clamp, the swim toggle + splash, Levitate (14,255) end to end, the per-minute/per-jump fatigue drains, the .7071 diagonal-limit parity fix) SHIPPED. Next: breath/drowning, crouch.
- `04-Characters/Characters-Arc.md` - PARKED (pivot 3: classic visuals). C8 shipped E1-E4b end to end + spectral; E4c deferred by Mac; remaining interims are Systems work (ledger below).
- `05-Combat/Combat.md` - COMPLETE. Core via C8; Hurt traps, CastSpell (S4b), bows both directions, the collision-trigger seam (input-held gate, 08-16), the Attack trigger + door bashing (WeaponEnvDamage, 08-16) all shipped. Build queue EMPTY; Systems-shared interims tracked in the ledger.
- `08-Audio/Audio.md` - ACTIVE. A1 + A2 (2026-08-16: action PlaySound on every Play, torch Burning loops at 5m linear/0.7 via the new loop3d engine seam, animal random barks on the classic rand()<=100 cadence at 19.2m - dungeon-scoped) SHIPPED. Next: exterior/interior scene audio, transition stingers, music strategy.
- `06-Systems/Systems-Arc.md` - ACTIVE. S1-S15 + S16 ENEMY SPELLCASTING (2026-08-16: F15 closed - the thirteen verbatim spell lists + EnemyClassSpells buckets, MaxMagicka 10xlevel+100, magic skills 80, the classic touch/ranged AI with the 1/40 roll and the already-on-target veto, instant casts through the shared missile seam) SHIPPED. Next: cures (with disease/poison), OnMonsterHit riders, or economy.
- `07-Rendering/Rendering.md` - COMPLETE again. R12 THE EXTERIOR INDIRECT PLAYER LIGHT (2026-08-16: the SunlightRig point light from the serialized prefab - 1.0/range 150/0.706 gray - daylight-scaled at the player across all four lit programs, shot-proven near-ground brightening with a byte-identical sky). Queue EMPTY.
- `10-UI/UI-Arc.md` - ACTIVE. U1-U5 + U6 THE ACTION TEXT BOXES (2026-08-16: ShowText 8600 / ShowTextWithInput 5400 with the verbatim riddle answers gating ActivateNext / DoorText 7700 with the patch table and the first-activation door hold; TEXT.RSC live), input map, CLICK-TO-CAST SHIPPED. Queue: window art, per-ID verification.
- `08-Audio/` - not started; routed rows collected in Ledger C.
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

## Open flags (regenerated 2026-08-16, the two-lane merge)

Regenerated from the merged code (the parallel-session reconciliation:
this lane's S15-S17/P10-P11/A2/R12/U6 + main's 08-16 dungeon/FP
audit). Every row below is a live INTERIM/FLAGGED/PENDING site in src;
the code comment at each site is the authority.
`src/render/characterSprite.js` FP framing constants stay open to
Mac's eye in live play (probe-locked on main).

- `src/characters/enemyMotor.js:24` - Speed). Still PENDING here: stealth checks in detection.
- `src/characters/playerEntity.js:12` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:15` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:17` - fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stat...
- `src/characters/playerEntity.js:5` - UI later fronts it everywhere). INTERIM until then, loudly: flat
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): adrenaline rush
- `src/combat/formulas.js:205` - OnMonsterHit(attacker, target, hitDamage): FLAGGED pending
- `src/combat/playerWeapon.js:13` - INTERIM (loud): the equipped weapon is an Iron Dagger until the
- `src/combat/playerWeapon.js:45` - INTERIM starting weapon (items arc replaces): Iron Dagger. */
- `src/combat/playerWeapon.js:46` - export const INTERIM_WEAPON = Object.freeze({
- `src/combat/playerWeapon.js:64` - constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
- `src/scenes/dungeonContext.js:1312` - actions) is FLAGGED - the player snapshot only.
- `src/scenes/dungeonContext.js:151` - the chain lives, the motion is INTERIM (loud) until flats can tween.
- `src/scenes/dungeonContext.js:409` - index into the 18 careers) or the INTERIM default Warrior (16,
- `src/scenes/dungeonContext.js:415` - effects FLAGGED to the effect-library slice.
- `src/scenes/dungeonContext.js:429` - "database FLAGGED" narrows to the skill/loot message ids).
- `src/scenes/dungeonContext.js:524` - drained strength lowers the ceiling). INTERIM (loud): the
- `src/scenes/dungeonContext.js:599` - FLAGGED: DFU recomputes per-effect via the cost tables (that
- `src/scenes/dungeonContext.js:601` - FLAGGED to the effect library (caster-only buffs, touch, areas).
- `src/scenes/dungeonContext.js:775` - 129; the inventory/equip UI pends - the INTERIM dagger note
- `src/systems/advancement.js:18` - INTERIM (loud): we apply immediately - level = calculated,
- `src/systems/advancement.js:82` - skill ids. The headless level-up applies immediately (INTERIM,
- `src/systems/chargen.js:124` - INTERIM headless pool policy (loud; the chargen UI replaces it):
- `src/systems/chargen.js:143` - spendPoolLowest(stats, STAT_KEYS, bonusPool);                       ...
- `src/systems/chargen.js:21` - INTERIM (loud): the UI distributes the bonus pools by hand; the
- `src/systems/chargen.js:6` - the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
- `src/systems/effects.js:25` - FLAGGED skipped (the library grows here; the cure family (3, 0..2)
- `src/systems/effects.js:382` - out.skipped++;   // FLAGGED: the library grows one family at a time
- `src/systems/inventory.js:12` - weight pends S2b (FLAGGED - leather/chain/plate multipliers).
- `src/systems/loot.js:169` - FLAGGED to the economy slice (shops).
- `src/systems/loot.js:17` - INTERIM (loud): MI (magic items) rolls are SKIPPED until the magic
- `src/systems/save.js:7` - (foes, loot piles, action states, doors) is FLAGGED - dungeons
- `src/systems/skills.js:57` - +0.1) and the Jump spell (+0.6) are INTERIM 0 here, loudly - the
- `src/ui/actionText.js:7` - (backgrounds FLAGGED pending art-name verification, the shared UI
- `src/ui/chargen.js:11` - background ART is FLAGGED pending art-name verification against
- `src/ui/chargen.js:148` - ---- drawing: clean classic-text panels (art FLAGGED, see head) ----
- `src/ui/charsheet.js:8` - classic INFO background ART is FLAGGED pending art-name
- `src/ui/hudText.js:5` - improved."); the TEXT.RSC database itself is FLAGGED - these
- `src/ui/inventory.js:2` - windows in classic text (backgrounds FLAGGED pending art-name
- `src/ui/inventory.js:85` - The known list: entity.spells when it exists; the INTERIM fallback
- `src/ui/inventory.js:9` - Enter readies one (retires ?spell). INTERIM loud: with no

## Audits

Newest first.

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
