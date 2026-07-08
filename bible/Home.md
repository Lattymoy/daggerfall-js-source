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
- `03-World/Player-Arc.md` - COMPLETE (P1-P8) + P9 LIVE-PLAY HARDENING (spawn placement, pointer lock, grounding, the stair regression, the FP-viewmodel fix; F8 debug HUD shipped). Successor: C8, then Systems.
- `04-Characters/Characters-Arc.md` - PARKED (pivot 3: classic visuals). C8 shipped E1-E4b end to end + spectral; E4c deferred by Mac; remaining interims are Systems work (ledger below).
- `05-Combat/Combat.md` - COMPLETE. Core via C8; Hurt traps, CastSpell (S4b), bows both directions, and the collision-trigger seam all shipped. Build queue EMPTY; Systems-shared interims tracked in the ledger.
- `06-Systems/Systems-Arc.md` - ACTIVE. S1-S13 + S14 THE ATTRIBUTE STAT-MOD LAYER + FORTIFY (liveStat fronts combat/advancement; FortifyAttribute all 8, verbatim) SHIPPED. Next: Drain/Transfer/Heal attribute, cure/regenerate, or economy.
- `07-Rendering/Rendering.md` - COMPLETE. Queue EMPTY since spectral shipped (2026-07-06); the exterior indirect-light Ledger row waits for a Rendering reopen.
- `10-UI/UI-Arc.md` - ACTIVE. U1-U5, TEXT.RSC reader, input map, CLICK-TO-CAST (the classic armed-click shape + the S9 touch-spend rule corrected to the source) SHIPPED. Queue: window art, per-ID verification.
- `08-Audio/` - not started; routed rows collected in Ledger C.

## Open flags (audit-generated 2026-07-06f, from the code)

STALE as of the 07-07 live-play arc: many entries below shipped since
(chargen UI, spellbook, S10 cost tables, the Warrior-16 default is
gone, the input-map flag closed). Due a full regeneration; until then
the code comment at each site is the authority, and NEW open items are
listed here explicitly:
- `src/render/characterSprite.js:73-76` - FP viewmodel framing
  constants (back 0.45, downcast -0.12, camY via eyeHeight) are
  reasoned from the rig geometry but UNVERIFIED without ARENA2 - open
  to nudging once played (P9).

Prior ledger (regenerate on audit):

- `src/characters/enemyAttack.js:21` - PENDING E3 (entity layer): playerLevel (stub 10 - zeroes its term),
- `src/characters/enemyEntity.js:14` - FLAGGED, until GetMonsterCareerTemplate ports).
- `src/characters/enemyEntity.js:91` - GetMonsterCareerTemplate (E4) - 50s FLAGGED until then
- `src/characters/enemyMotor.js:23` - PENDING E3 (entity layer): per-enemy LiveSpeed from career stats -
- `src/characters/playerEntity.js:12` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:15` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:5` - UI later fronts it everywhere). INTERIM until then, loudly: flat
- `src/combat/enemyEquipment.js:128` - poisoned-weapon chance pends the poison system (Systems arc)
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): adrenaline rush
- `src/combat/playerWeapon.js:13` - INTERIM (loud): the equipped weapon is an Iron Dagger until the
- `src/combat/playerWeapon.js:17` - entity has no career/race yet); backstab pends facing bookkeeping
- `src/combat/playerWeapon.js:45` - INTERIM starting weapon (items arc replaces): Iron Dagger. */
- `src/combat/playerWeapon.js:46` - export const INTERIM_WEAPON = Object.freeze({
- `src/combat/playerWeapon.js:64` - constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
- `src/scenes/dungeon.js:117` - ctx.playerCastInput(cam.pos, dir);   // S5 cast (input map pends UI)
- `src/scenes/dungeonContext.js:248` - pends Player activation, flagged in the arc).
- `src/scenes/dungeonContext.js:275` - index into the 18 careers) or the INTERIM default Warrior (16,
- `src/scenes/dungeonContext.js:289` - effects FLAGGED to the effect-library slice.
- `src/scenes/dungeonContext.js:311` - FLAGGED: DFU recomputes per-effect via the cost tables (that
- `src/scenes/dungeonContext.js:313` - FLAGGED to the effect library (caster-only buffs, touch, areas).
- `src/scenes/dungeonContext.js:349` - if (sp.rangeType !== 2 && sp.rangeType !== 4) return false;   // FLAGGED: non-missile ranges ...
- `src/scenes/dungeonContext.js:420` - 129; the inventory/equip UI pends - the INTERIM dagger note
- `src/scenes/dungeonContext.js:447` - Backstabbing skill (flat interim). TallySkill pends Systems.
- `src/scenes/dungeonContext.js:659` - in DFU). HUD pends the UI arc: health surfaces on __player.
- `src/scenes/worldModes.js:159` - quests fill these later; open-feedback pends the UI arc).
- `src/systems/advancement.js:107` - HEADLESS INTERIM: apply now (char sheet pends the UI arc)
- `src/systems/advancement.js:112` - spendPoolLowest(entity.stats, Object.keys(entity.stats), pool);   // INTERIM policy
- `src/systems/advancement.js:18` - INTERIM (loud): we apply immediately - level = calculated,
- `src/systems/advancement.js:20` - (Range(4, 6+1)) spends by the same lowest-first policy the
- `src/systems/advancement.js:82` - skill ids. The headless level-up applies immediately (INTERIM,
- `src/systems/chargen.js:112` - spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy
- `src/systems/chargen.js:114` - spendPoolLowest(skills, career.primarySkills, groupPools.primary);   // INTERIM policy
- `src/systems/chargen.js:21` - INTERIM (loud): the UI distributes the bonus pools by hand; the
- `src/systems/chargen.js:22` - headless policy spends each pool one point at a time into the
- `src/systems/chargen.js:6` - the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
- `src/systems/chargen.js:93` - INTERIM headless pool policy (loud; the chargen UI replaces it):
- `src/systems/inventory.js:12` - weight pends S2b (FLAGGED - leather/chain/plate multipliers).
- `src/systems/loot.js:169` - FLAGGED to the economy slice (shops).
- `src/systems/loot.js:17` - INTERIM (loud): MI (magic items) rolls are SKIPPED until the magic
- `src/systems/spellcast.js:100` - savingThrow% / 100 (trunc), summed. Other effects skip (FLAGGED -
- `src/systems/spellcast.js:109` - if (!isDamageHealthEffect(e)) continue;   // FLAGGED: non-damage effects pend the library
- `src/systems/spellcast.js:90` - rounds system pends the effect-library slice). */
- `src/world/actionSystem.js:38` - DrainMagicka (0x1c): INTERIM no-op - the magicka stat pends the

## Audits

Newest first. Older per-fix audits are consolidated into their arc
records; Home keeps the one-line pointer and the standing lessons.

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
