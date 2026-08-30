# Port Doctrine

What "1:1" means here, decided at project start. This is the constitution of the port. Changes to this doc need Mac's explicit approval.

## Ported 1:1 (faithful translation from Daggerfall Unity C#)

- Binary format readers: BSA containers, TEXTURE.???, IMG/CIF, ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA, sound/music formats.
- Game math: FormulaHelper in full - damage, skills, leveling, resistances, loot tables.
- World assembly: block layout, location generation, dungeon assembly, climate/season texture swapping.
- Systems: quest machine (quest script parsing + execution), items, magic and spellmaker, guilds, calendar, banking, crime/legal.
- Save-relevant state shapes stay compatible in spirit: same fields, same semantics.

Translation rule: read the DFU C# source, translate logic verbatim into JS, keep original constants and table values byte-exact. Simplification is allowed in structure (fewer layers, no Unity scaffolding), never in behavior.

## Rebuilt on our stack (deliberate departures)

1. Renderer: hand-rolled WebGL2 replaces Unity rendering. No engine, no framework.
2. Characters: our voxel system replaces billboard NPCs/enemies and the flat 2D paperdoll. Paperdoll equipment maps onto the outfit-piece workflow proven in project-final (piece-by-piece design -> solo-tune -> lock). This is a design win, not a compromise - it upgrades the weakest original layer.
   **SUPERSEDED BY MAC, 2026-08-30**: the goal is now a comprehensive MORROWIND 3D replacement - paperdoll, items, weapons, and in time NPCs and enemies - with the player's first- and third-person aspect first. The staged rebuild and its rules live in `02-Formats/Morrowind-Rules.md`. The voxel system remains shipped where it stands until each piece's 3D replacement lands.
3. Runtime: browser, Vite, Node ESM. Desktop-first; a mobile touch layer (virtual stick + look/attack drag + button row speaking the desktop input language) ships for on-device testing - approved by Mac, 2026-08-13.

## Non-negotiables

- Original game data (ARENA2) is freeware but NOT redistributable. It never enters the repo. `.gitignore` blocks it. Readers load user-supplied data at runtime or from a local uncommitted directory.
- **A RENDER OF GAME DATA IS GAME DATA.** A screenshot, a gallery frame, a derived raster, a re-shaded sprite that keeps the original silhouette - if the pixels came from ARENA2, the rule above applies to them exactly as it applies to a `.BSA`. `.gitignore` can block `ARENA2/` and `*.BSA`; it cannot recognise a PNG of the same art, so this one is enforced by a test, not by a pattern.
  AUDIT 21 found this rule unwritten and violated: fourteen before/after gallery frames sat under `public/`, twelve of them carrying classic `WEAPON*.CIF` sprites upscaled onto the probe's magenta clear. `public/` is Vite's static root, so every one of them was copied into `dist/` and uploaded to GitHub Pages by `deploy.yml` - whose own header comment says the build contains no game data. The galleries are now generated locally by `tools/fpProbe.mjs` and gitignored. Note for the record: removing them from HEAD does not remove them from git HISTORY; a full purge is a history rewrite and is Mac's call.
- Every reader validates against real ARENA2 files with test harnesses before anything builds on it.
- No mock/placeholder data shipped silently.

## Attribution

Format knowledge and game logic derive from Daggerfall Unity (MIT license, Interkarma and contributors) and the UESP/dfworkshop format documentation. LICENSE and README must credit DFU when the repo ships anything public-facing.

## Phase plan

1. **Readers-Arc** (COMPLETE - all 8 readers shipped with corpus gates; status corrected at AUDIT 18, it still read "active"): BSA -> TEXTURE/IMG/CIF -> ARCH3D -> BLOCKS -> MAPS. Each validated against real data before the next.
2. **World-Arc**: block assembly + terrain on our renderer, palette-correct.
3. **Player-Arc**: movement, collision, streaming exterior world.
4. **Character-Arc**: voxel rigs, paperdoll outfits, NPC population.
5. **Combat-Arc**: FormulaHelper, weapons, enemy AI.
6. **Systems-Arcs**: quests, magic, items, guilds - split as needed.

Scale honesty: DFU is a decade of work. This is a long campaign of arcs, and the readers gate all of it.
