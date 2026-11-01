# Port Doctrine

The constitution of the project. Changes to this doc need Mac's explicit approval. It began as the definition of what "1:1" meant for a port, decided at project start; since SCOPE1 (the next section) the project is its own game, and the sections after it are the record of the foundation we built from and the rules that still hold.

## Scope - our own game, DFU the reference (SCOPE1, 2026-10-14)

Mac, 2026-10-14: "We now longer are trying to have DFU 1:1 parity, we are our own project at this point. Documents should state this but also still utilize DFU as a reference."

DFO Online is its own game. Parity with Daggerfall Unity is no longer the goal, and a difference from DFU is no longer a defect in itself. DFU stays the reference:

- **Look there first.** Before building a system DFU has, read DFU's version and grep the tree for its name AND its constants (`Home.md`, ONE DFU MEMBER, ONE EXPORT). It is a decade of work and usually the right place to start.
- **Readers stay exact.** The player's ARENA2 is the data DFU reads. Every format reader (`02-Formats/Readers-Arc.md`: BSA, the palettes, TEXTURE, IMG/CIF, ARCH3D, BLOCKS, MAPS, sound and music, and the readers added since the arc closed - SKY, GFX, FLIC, FLATS.CFG, CFA and the rest) reads it exactly as DFU does, and their corpus gates stand.
- **Name the departure.** A change that leaves DFU's behaviour says so where it is recorded: the DFU member it departs from (`FormulaHelper.CalculateX`, `StaticNPC.cs:309`) and why. A cite to DFU stays when we move past it - it is how the next reader finds the original. A departure from a member DFU has takes its row in `Port-Ledger.md` section A (Approved departures), approved via the arc that made it, as departures always have.
- **A pin follows the rule we chose.** A test that pins a DFU law (`Home.md`, A PIN MUST FAIL) pins it because we still follow it. A deliberate change edits the pin and its doc in the same change - it is not blocked by them - and the pins that stay keep their mutation guarantee.
- **The ledger is a map, not a debt.** `Port-Ledger.md` section C records what DFU has that we do not - an option for a later slice, not an obligation. `Road-To-1-1.md` closes with this section.
- **THE NATIVE-WINDOW RULE binds the windows that keep DFU's layout.** Every drawn element of such a window still cites its DFU source before it ships. A window redesigned on purpose cites its own design record instead, and says so where it is recorded - `Home.md` carries the same sentence beside the rule. ONE DFU MEMBER, ONE EXPORT is unchanged: grep the tree for a DFU member and its constants before porting it, and keep one copy.
- **Older pages are history.** "1:1", "faithful" and "parity" across the arc pages and audits describe the goal they were written under. They are not rewritten; this section governs new work.

What does not change: the non-negotiables below (no ARENA2 in the repo, and no render of it beyond the exceptions they name), Attribution, and every other Process rule in `Home.md`.

## The whole of Tamriel (TAMRIEL-WIDE, 2026-10-28)

The owner, 2026-10-28, the day PR #1184 brought the provinces past the Bay to players: "ensure our future development isnt just Daggerfall anymore and is the entirety of tamriel".

DFO Online's world is Tamriel: the Iliac Bay and the nine provinces round it. The Bay is one theatre of ten. New work is built for all of it:

- **Every province, or say which.** A system that reads a place, a pixel, a region, a person or the ground works past the Bay as it works on it. Where it does not, its record says where and why, and the owner's call is quoted there (`03-World/World-Wide.md` keeps the exclusions).
- **The world's keys and bounds.** A pixel is keyed by `worldPixelKey` and bounded by `worldPixelOk`. A place is found in the registry (`worldPlaces`), never by a walk of MAPS.BSA alone. A region is 0..70, and a grouping is an area (`areaAt`). MapsFile's `y * 1000 + x`, its 62 regions and its rows are the Bay's own data: code reads them behind `inBay`, and a line that does so on purpose carries a `BAY-OWN:` comment that says why.
- **Tested past the Bay.** A slice's pins hold a case past the Bay beside the Bay's, and its probe stands in a province, not only in Daggerfall.
- **Player text names where the player is.** No string says "the Iliac Bay" or "Daggerfall" for a place that can be anywhere in Tamriel.
- **DFU is the Bay's reference.** DFU's world ends at the Bay's edge. Past it the reference is the lore (UESP) and Arena through OpenTESArena (TESA1), and what the port builds there is its own and says so.
- **Held by a test.** `test/tooling/tamrielwide.test.js` holds `src/`, `server/src/` and `server-account/src/` to `tools/tamrielWideBaseline.json`, which only goes down (`node tools/tamrielWide.mjs`). The audit that wrote this rule is `audits/Audit-Tamriel-Wide.md`.

Older pages that say "the Bay's" for the world describe the map they were written on, as SCOPE1's "1:1" does.

## Ported from DFU - the foundation (built 1:1 before SCOPE1)

- Binary format readers: BSA containers, TEXTURE.???, IMG/CIF, ARCH3D.BSA, BLOCKS.BSA, MAPS.BSA, sound/music formats.
- Game math: FormulaHelper in full - damage, skills, leveling, resistances, loot tables.
- World assembly: block layout, location generation, dungeon assembly, climate/season texture swapping.
- Systems: quest machine (quest script parsing + execution), items, magic and spellmaker, guilds, calendar, banking, crime/legal.
- Save-relevant state shapes stay compatible in spirit: same fields, same semantics.

Translation rule (the rule these were built under; since SCOPE1 it holds whenever a slice chooses to port a member as DFU has it): read the DFU C# source, translate logic verbatim into JS, keep original constants and table values byte-exact. Simplification is allowed in structure (fewer layers, no Unity scaffolding), never in behavior - a change in behavior is a departure, made on purpose and named.

## Rebuilt on our stack (deliberate departures)

1. Renderer: hand-rolled WebGL2 replaces Unity rendering. No engine, no framework.
2. Characters: our voxel system replaces billboard NPCs/enemies and the flat 2D paperdoll. Paperdoll equipment maps onto the outfit-piece workflow proven in project-final (piece-by-piece design -> solo-tune -> lock). This is a design win, not a compromise - it upgrades the weakest original layer.
   **SUPERSEDED BY MAC, 2026-08-30**: the goal is now a comprehensive MORROWIND 3D replacement - paperdoll, items, weapons, and in time NPCs and enemies - with the player's first- and third-person aspect first. The staged rebuild and its rules live in `02-Formats/Morrowind-Rules.md`. The voxel system remains shipped where it stands until each piece's 3D replacement lands.
3. Runtime: browser, Vite, Node ESM. Desktop-first; a mobile touch layer (virtual stick + look/attack drag + button row speaking the desktop input language) ships for on-device testing - approved by Mac, 2026-08-13. TI2 (Mac, 2026-09-11) tuned it toward a phone game: a height-normalised look, an analog stick, gyro aim, haptics, fullscreen and a home-screen manifest - every knob on the port's own prefs shelf, none in DFU's settings.

## Non-negotiables

- Original game data (ARENA2) is freeware but NOT redistributable. It never enters the repo. `.gitignore` blocks it. Readers load user-supplied data at runtime or from a local uncommitted directory.
- **A RENDER OF GAME DATA IS GAME DATA.** A screenshot, a gallery frame, a derived raster, a re-shaded sprite that keeps the original silhouette - if the pixels came from ARENA2, the rule above applies to them exactly as it applies to a `.BSA`. `.gitignore` can block `ARENA2/` and `*.BSA`; it cannot recognise a PNG of the same art, so this one is enforced by a test, not by a pattern.
  AUDIT 21 found this rule unwritten and violated: fourteen before/after gallery frames sat under `public/`, twelve of them carrying classic `WEAPON*.CIF` sprites upscaled onto the probe's magenta clear. `public/` is Vite's static root, so every one of them was copied into `dist/` and uploaded to GitHub Pages by `deploy.yml` - whose own header comment says the build contains no game data. The galleries are now generated locally by `tools/fpProbe.mjs` and gitignored. Note for the record: removing them from HEAD does not remove them from git HISTORY; a full purge is a history rewrite and is Mac's call.
  **THE FIRST AND SECOND EXCEPTIONS - RETIRED (OWN-WORK4, 2026-10-31; the owner: "no latching onto other mod authors or needing permissions").** Vanilla Enhanced (VE4), Sands of the Alik'r and Snowfall (ALIKR1, SNOWFALL1) were outside authors' repaints of Daggerfall's own textures, carried on Mac's approval. None of them is carried now. Our own rules build each look at runtime from the player's own records (`systems/ownTextures/ownTextureRules.js`), so no repaint and no render of game data ships for them. Their switches and their place on the Texture Overhaul card stay, and the third and fourth exceptions keep their numbers.
  **THE THIRD EXCEPTION - LAYERED GEARING (LAYERED-GEAR; the owner, 2026-10-19: "Approve as an exception", credited to DFO).** The Layered Gearing look draws the player's body on foot in the armor it wears. Its strips, its cloak layer and its hood fixes were made for the game, but their shapes are Daggerfall's own class sprites (TEXTURE 1540, 1541) and enemy frames (TEXTURE.475-490), so they are a render of game data under this rule's own words. The owner approved carrying them, credited as DFO's own work. They ship under `vendor/layered-armor/`, which the build reaches through `player/eyeOfTheBeholder/layeredArmor.js`'s glob, and `tools/layered-armor/listing.mjs` writes the listing every picture there answers to (each file and its sha256). The look is worn by default (the owner, the same day: "Make sure this is on by default"), and the profile's Skin card turns it off (`04-Characters/Layered-Gearing.md`). The exception covers that directory and nothing more: `test/tooling/doctrine.test.js` holds every row in it to this paragraph's own mark.
  **THE FOURTH EXCEPTION - THE ENEMIES' REPAINTED SPRITES (DEX0; Mac, 2026-10-19: "Approve 3rd exception", "Yes, cover all of them", and for the skins "Bring under 3rd exception" - asked as the third on its branch, numbered the fourth past LAYERED-GEAR's at the merge, the same approval).** Daggerfall Enemy Expansion (Kamer & Kab) paints new enemies over Daggerfall's own sprites - the Bounty Hunter and the Royal Knight (1504 and 1505, over TEXTURE.482), the Druid and the Necromancer Acolyte (1509 and 1511, over 486), the Rogue Druid (1512, over 490), the new riders (1530-1533, over 491 and 495) and King Lysandus (1609, over 473). Mac approved carrying them, on his word of the authors' permission. The class skins (SKIN2) were covered too, until OWN-WORK4 (2026-10-31) replaced them with our own looks, painted at runtime on the player's own sprites (`player/classSkinArt.js`). The mod's 774 ship under `public/art/daggerfall-enemy-expansion-repainted/`, byte for byte as the bundle carries them. `tools/dexExtract.mjs` measures every picture of the mod against every TEXTURE record first: one that IS a record exactly is not shipped even here - the five rider sets and the Will-o'-wisp, 858 pictures, are rebuilt from the player's own files (`formats/derivedTexture.js`) - and the mod's own renders ship beside them as its own art. It measures every picture's outline too (AUDIT DEX B1: the Royal Knight's sixty had shipped as the authors' own): an archive that follows Daggerfall's sprites' outlines ships only in the repainted directory, or where the owner's word allows it (the 1995 demo's Bat), and the tool refuses anything else. The exception covers that directory and nothing more: `test/tooling/doctrine.test.js` holds every row in it to this paragraph's own mark.
- **THE SECOND GAME'S DATA - ARENA (TESA1; the owner, 2026-10-12, asked where Arena's places should come from: "Player's ARENA folder").** The Elder Scrolls: Arena is Bethesda's freeware too, and no more redistributable than ARENA2: its files never enter the repo or the build, and a render of them is game data under the rule above. The player attaches their own ARENA folder (the Arena card) and the port keeps only the files it reads (`scenes/dataSource.js` ARENA_FILES - CITYDATA.65, and A.EXE or ACD.EXE for their coastal list, TESA6), in their browser. Arena's formats are translated from OpenTESArena (MIT, The OpenTESArena Developers) the way Daggerfall's are from DFU - constants byte-exact - and what is built on them is the port's own, on Daggerfall's pieces (`03-World/Arena-Provinces.md`). Online nothing of it crosses the wire: a room agrees on Arena's places by prints alone (TESA-ONLINE - CITYDATA.65's SHA-256, and TESA6's of the coastal list it reads out of the executable; nothing of a file can be made back from either).
- Every reader validates against real ARENA2 files with test harnesses before anything builds on it. (TESA1: an Arena reader against the freeware ARENA folder, `ARENA_PATH`.)
- No mock/placeholder data shipped silently.

## Attribution

Format knowledge and game logic derive from Daggerfall Unity (MIT license, Interkarma and contributors) and the UESP/dfworkshop format documentation. LICENSE and README must credit DFU when the repo ships anything public-facing. Arena's formats derive from OpenTESArena (MIT license, The OpenTESArena Developers), credited in LICENSE and README beside it (TESA1).

## Phase plan

The 1:1 port's plan, kept as its record - SCOPE1 ended the goal it served.

1. **Readers-Arc** (COMPLETE - all 8 readers shipped with corpus gates; status corrected at AUDIT 18, it still read "active"): BSA -> TEXTURE/IMG/CIF -> ARCH3D -> BLOCKS -> MAPS. Each validated against real data before the next.
2. **World-Arc**: block assembly + terrain on our renderer, palette-correct.
3. **Player-Arc**: movement, collision, streaming exterior world.
4. **Character-Arc**: voxel rigs, paperdoll outfits, NPC population.
5. **Combat-Arc**: FormulaHelper, weapons, enemy AI.
6. **Systems-Arcs**: quests, magic, items, guilds - split as needed.

Scale honesty: DFU is a decade of work. This is a long campaign of arcs, and the readers gate all of it.
