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
- `06-Systems/Systems-Arc.md` - ACTIVE (opened 2026-07-06). S1 items/loot foundation SHIPPED: the 21-key LootChanceMatrix + GenerateRandomLoot verbatim; enemies carry loot at spawn, corpses hold it. Queue: S2 inventory/pickup/treasure, S3 chargen, S4 magic.
- `05-Combat/` - FormulaHelper port, weapons, hit resolution
- `06-Systems/` - quests, items, magic, guilds, calendar, save format
- `07-Rendering/` - WebGL2 renderer, palettes, lighting, sky
- `08-Audio/` - music (HMI/XMI), sound effects, audio state machine
- `09-Testing/` - test doctrine, harnesses, data validation
- `10-UI/` - HUD, menus, native Daggerfall UI reproduction

## Active arcs

- `02-Formats/Readers-Arc.md` - COMPLETE. All 8 format readers shipped with corpus gates.
- `03-World/World-Arc.md` - COMPLETE. Milestone 9 shipped: floating-origin streaming world (?world). Build queue empty.
- `04-Characters/Characters-Arc.md` - PARKED (direction pivot 3: classic visuals). C8 shipped E1-E4b end to end: rigged class foes with verbatim senses/pursuit/attacks, the entity layer (CLASS*.CFG + MONSTER.BSA careers), hit resolution both directions, player melee + FP viewmodel + backstab, equipment with per-part armor, spectral emission on billboards. E4c (authored morphologies) DEFERRED by Mac; remaining interims are Systems-arc work (see the ledger above).
- `03-World/Player-Arc.md` - COMPLETE. Walk, collide, activate, transition: movement/collision (P1), activation + action chains (P2), interior/dungeon transitions (P3/P5), swing doors (P4), ladders (P6), scene consolidation onto worldModes + dataPipeline (P7), and interiors parented in the building world frame with one-frame landings (P8). Next arc decision pending.
- `07-Rendering/Rendering-Arc.md` - R13 shipped: precipitation + verbatim storm lightning. Queue empty except spectral emission (blocked on Characters). Next arc decision: Player.

## Open flags (audit-generated 2026-07-06b, from the code)

Every documented interim/pending in src, greped at generation time -
the code comment at each site is the authority; regenerate on audit:

- `src/characters/enemyAttack.js:21` - PENDING E3 (entity layer): playerLevel (stub 10 - zeroes its term),
- `src/characters/enemyEntity.js:14` - FLAGGED, until GetMonsterCareerTemplate ports).
- `src/characters/enemyEntity.js:91` - GetMonsterCareerTemplate (E4) - 50s FLAGGED until then
- `src/characters/enemyMotor.js:23` - PENDING E3 (entity layer): per-enemy LiveSpeed from career stats -
- `src/characters/playerEntity.js:12` - maxHealth: 50,    // INTERIM until chargen rolls career HP
- `src/characters/playerEntity.js:15` - skills: 30,       // INTERIM flat skills until chargen
- `src/characters/playerEntity.js:3` - Average, attributes at the 50 baseline. INTERIM (loudly): flat
- `src/combat/enemyEquipment.js:128` - poisoned-weapon chance pends the poison system (Systems arc)
- `src/combat/formulas.js:10` - FLAGGED interims (all documented at their site): adrenaline rush
- `src/combat/playerWeapon.js:13` - INTERIM (loud): the equipped weapon is an Iron Dagger until the
- `src/combat/playerWeapon.js:17` - entity has no career/race yet); backstab pends facing bookkeeping
- `src/combat/playerWeapon.js:45` - INTERIM starting weapon (items arc replaces): Iron Dagger. */
- `src/combat/playerWeapon.js:46` - export const INTERIM_WEAPON = Object.freeze({
- `src/combat/playerWeapon.js:64` - constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
- `src/scenes/dungeonContext.js:268` - Backstabbing skill (flat interim). TallySkill pends Systems.
- `src/scenes/dungeonContext.js:320` - in DFU). HUD pends the UI arc: health surfaces on __player.

## Audits

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
