# The Sea Update - what landed, and what is left (2026-09-25)

Mac, opening it: *"This is one of our largest updates yet to DFE. All
mods attached are to be compatible and implemented 1:1. No bugs, no
issues, no band aids. Alongside all of these changes will be an overhaul
and improvement, fixing any and all issues (especially with ingame
puddles and tiles in towns that are one square). ... Enabled on by
default and carefully choosing whats required for our online mode."*

Six mods and the water overhaul. Mac, closing the first branch
(`claude/dfe-major-update-overhaul-6k1ajv`): *"Let's hold off on sail
away. Just finish up and log future work."* This page is that log: what
the branch carries, and what the next session picks up, in the order the
work depends on itself. Each slice's own page is the record; this is the
way in.

## Landed

| slice | what | commit | page |
|---|---|---|---|
| WD1 + AS1 | the world-data patch layer (the author's edit over the player's own blocks); Aquatic Sprites 1.0 (Cliffworms) | `992f5b2b` | `02-Formats/World-Data-Patches.md`, `03-World/Aquatic-Sprites.md` |
| DS1 | Detailed Ships 1.0.0 (Cliffworms), its DET pieces the port's own stand-ins (Mac: "Build your own") | `70396ed2` | `03-World/Detailed-Ships.md` |
| WA1 | Warm Ashes - Ships 1.1 (Kamer), and the seams it needed (`systems/modSaveData.js`, the ship transport) | `ca7abcdb` | `03-World/Warm-Ashes-Ships.md` |
| DW-A to DW-D | Iliac Puddle No More 1.2.2 (jet082): the carved sea, its look, its swimmer | `1bcbec78` | `03-World/Deep-Waters.md` |
| DW-E1, DW-E2 | the runtime's other half; the seafloor's decorations | `186196de` | `03-World/Deep-Waters.md` |
| DW-E3 | the passive fish (items 9001-9007) | `f2f733b8` | `03-World/Deep-Waters.md` |
| DW-E4 | the deep's foes and the treasure guards | `25f05238` | `03-World/Deep-Waters.md` |
| WATER-PUDDLE | the puddles and the one-square town water: the shallow-water records drawn where their own art is water | this branch's last commit | `07-Rendering/Water-Arc.md` |
| DW-E5 | the sunken loot: the pulse, the stray piles and their rubble, the wrecks and their guards | `claude/funny-tesla-bhzv35` | `03-World/Deep-Waters.md` |
| DW-F | the close: the sea at a distance (Mac: "large square panels" - the far ground's skirt out of the carved sea, the world's fog on the top, WATER1 off the clipped tiles) and the audit pass over the whole mod, four readers against the assembly (the foes' column share, the breath behind a window, the save-load reset, the dungeon splash, the load flag, the guards' terrain, the loot's camera and velocity, the texture cache, the arrow's draw) | `claude/funny-tesla-bhzv35` | `03-World/Deep-Waters.md` |
| OH-A to OH-C | There's a Hole in the Bottom of the Ocean 1.1.0 (jet082): registered, the pits placed and cut into Iliac Puddle No More's floors through its own API, drawn (the core, the underside, the black, the miasma), the entrance a swimmer touches | `claude/funny-tesla-bhzv35` | `03-World/Ocean-Holes.md` |
| OH-D / OH-E | ...and the abyss: the template borrowed, cloned, flooded and renamed, the way down and back up to the pit, the Recall binding and the save; the flame foes gone, the deep's replacements and the aquatic quota, the lights and the quest resources gone, the loot upgraded, the fog and light darkened. On the way: a dungeon save carries the registered mods' records (WA1's seam, never handed to the dungeon's build), a dungeon build takes its own location, and a pile raises LootTables.OnLootSpawned for every key | `claude/funny-tesla-bhzv35` | `03-World/Ocean-Holes.md` |
| OH-F | ...and the close: the audit's eleven fixes (the settings live in every mode, the plume's box, the indoor queue, the abyss save's destroyed foes and species, the rebuild on load, the build's loot scoped, the descent held, the online door, the quest and allied spawns marked at the build, the hierarchy's order, the Wabbajack's LoadID, CurrentVariant), eight departures declared, the patch notes | `claude/funny-tesla-bhzv35` | `03-World/Ocean-Holes.md` |
| CSA-A (registration) | Come Sail Away 2.1 (RedRoryOTheGlen): the vendored manifest, settings, item templates and assembly; the fifty keys (three the assembly never names, proved off its string heap); Features, credits, the registry, the online lane (the player's own); the bundle's pictures measured - its travel map is Daggerfall's own `TRAV0I00.IMG`, never carried, and its waves' crests are Daggerfall's snow, rebuilt from the player's files under the author's two paints - and its five played sounds remuxed from FMOD's banks, packet for packet | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-B (the boats built) | ...and the five hulls built as the C# builds them: the prefab instanced and walked by name (the variants, the modifiers, the sails, the lanterns and crew, the seven kinds of trigger box), every face in the player's own textures (DFU's RuntimeMaterials, the mod's ApplyGameTextures), the sails baked by FixDeformations and checked against the boxes Unity stored for them, the lanterns' lights under DFU's own two behaviours; drawn by the streaming world, stood by the `?shot` probe until CSA-C places them | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-C (placed, kept, saved) | ...and the boats placed by the placement ray's five arms (the sea, a deed's reposition, a dungeon's water, the terrain's water tile, the WaterLevel plane), kept by their nodes, their visibility and the floating origin, saved in ComeSailAwaySaveData; four console commands | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-D (sailing) | ...and sailed: the helm taken and left, rowed and turned, the collision and the beach, the cargo's weight, the riders, the seven activations raced, the boat walkable in the world's collider; the sailing arms of death, the load and fast travel | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-E (the sails and the wind) | ...and Unity's Animator restated and played (the sails stowed and raised, the rudder's oars and tiller, the doors); the wind rolled and turned by the hour and the weather, the sails' power, the square sails' assist, the trim, the widget | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-F (the waves and the effects) | ...and the coasts' breakers laid, their frames composed from the player's snow, their dithered shader; the current; Unity's particle system restated and played (the wake, the rudder's drops and splashes, the flag); the bob | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-G (time and sounds) | ...and the helm's time scale (its three keys and the enemies' gates, Travel Options' journey asked); Unity's AnimationEvents and a particle's start delay, the oars' events; the five sounds - the loops as Unity keeps them, the Galley's strokes, DFU's sails and door clips; the boat's bed as Roleplay Realism's; the HUD's message clocks in game time | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-H (items, shops and cargo) | ...and the two items (their rows, their UID, their UseItem on the item-use door), on the shelves through the one custom-group table (Iliac Puddle No More's fish on it too), the shelf's variants; PackBoat and the packed cargo; the cargo box as the pack's loot target; the variant picker; IsNearPort's square; `giveboat` | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-I (the map and the water walk) | ...and the position box's reading (the instruments' box, the weather's and the hour's restrictions, the map a window in the mode's slot), the markers (placed, named with the day, removed), OnGUI's map over the travel map rebuilt from the player's TRAV0I00.IMG, the debug values; the water walk on a hull (WaterWalkingSilent its own kind on the effect list, IsWaterWalking read one way) | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |
| CSA-J (the close) | ...and the mod's message receiver (its ten messages, OnUpdateWind raised on a restore), Eye of the Beholder's boat camera and sprite, the two mods the port does not carry null in code (World of Daggerfall's terrain, Animated Water) and Iliac Puddle No More's arms checked; online, a sailor's boats seen by the others in a cell (`sa` on their own foes frame, no relay change); the audit pass, five readers against the assembly (the load's doors, the Transport press, every mode's death, a new game's wind, the half-built hull, RuntimeMaterials' copy, the bed's offer rung) | `claude/funny-tesla-bhzv35` | `03-World/Come-Sail-Away.md` |

Every landed mod is on by default, registered (settings, Features,
credits, `01-Overview/Mod-Registry.md`) and placed in the online lane
(`systems/online/onlineLane.js`).

## Left

### 1 and 2. Iliac Puddle No More - DW-E5 and DW-F: LANDED (above)

The sunken loot is in and the mod is closed. What its close leaves for
Mac, on the Port-Ledger row (DECLARED, awaiting Mac's read): DW-E5, and
DW-F's departures (8) the world's fog on the top, (9) the whole stream
carved - the mod carves only what the player has come within a pixel of,
and a carved three by three in a vanilla sea is the square seam that was
reported, so the port keeps its whole-stream carve - (10) the unload
taking the mod's children, (11) surfacing giving the sky its fog colour
back (the mod leaves DFU's underwater colour as the fog above the sea
until the sky's texture next changes), (12) the swim's odometer riding the
recentre; and (3) now reaching DFU's billboards (the deep's foes, their
corpses, a pile dropped in the sea). Seen, not the mod's: past the
streamed grid the far ring (EV8) holds its haze at 85% through the middle
distance - EV8's own, not the mod's. Its sea read a shade darker than the
fully fogged edge of the streamed world until FAR-SEA1 (2026-10-10,
`07-Rendering/Water-Arc.md`): the streamed sea holds the same haze now, and
the ring's sea is the water's own, so they meet; over land the step stands.

### 3. There's a Hole in the Bottom of the Ocean 1.1.0 (jet082) - OH-A to OH-F LANDED

Mac handed the archive over again on 2026-09-26, with Come Sail Away's.
The pits are in: registered and on by default (OH-A), placed and cut into
Iliac Puddle No More's floors through that mod's own API (OH-B), and drawn
- the blue-black hole on the sea, its underside, the black at the
opening, the miasma - with the entrance a swimmer touches (OH-C).
`03-World/Ocean-Holes.md` is the record; its three departures are on the
Port-Ledger row, DECLARED and awaiting Mac's read. Online, `Enabled`,
`PitSpawnRate` and `SeafloorHoleSize` are the room's, so every player in
a room cuts the same holes.

The abyss is in (OH-D, OH-E), and seen at Sentinel's pit: the swimmer
taken down into "The Deadwater Chasm of the Last Tide" (a region-5
template, 12 blocks, flooded, its 189 lights gone, 120 enemies with the
aquatic quota met - CeilToInt(120 x 0.3f), 36), back up onto the pit's entrance in 5 s, a Recall
anchor set inside bringing the abyss back, and a save made inside it
loading back into it. Its eleven departures (with OH-C's three) are on the
Port-Ledger row; one bug is kept on purpose (every weapon is upgraded, the
arrow too - `Ocean-Holes.md`). Three seams were fixed on the way: a
dungeon save now carries every registered mod's record, a dungeon build
takes its own copy of its location, and a treasure pile raises
LootTables.OnLootSpawned whatever its key (RRI's wear with it).

OH-F closed it: three audit lanes against the assembly found eleven real
faults, all fixed (`Ocean-Holes.md`, "The audit"), and eight more
departures are declared beside the first eleven. The online question has
its answer: the abyss and its template share the dungeon's own key but
not the relay room (`dungeon:m<mapId>`, the RENAMED map id), so their
memories stay apart - the one frame a Recall joined the dry template's
room is closed (the abyss's Update runs before the online frame), the
hour's respawn refuses a destroyed flame foe, and the destroy rides the
save, not the room (a field at the relay's door would be a relay
deploy). A load the abyss stands in is a rebuild, since the shared key
would otherwise patch the drowned dungeon in place. The patch notes have
their section.

### 4. Come Sail Away 2.1 (RedRoryOTheGlen) - CSA-A to CSA-J LANDED (2026-09-27/28)

Held by Mac on 2026-09-25; the archive came again on 2026-09-26 with
Ocean Holes', the port read the hold as lifted and said so, and Mac
answered "continue". CSA-A to CSA-J have landed - registered, the boats
built and drawn, placed and saved, sailed, the sails and the wind, the
waves and the effects, the time scale and the sounds, the items, the
shops and the cargo, the position reading and the water walk, and the
close: the message receiver, Eye of the Beholder's boat, the two mods
the port does not carry, the others seeing a sailor's boats, and the
audit (`03-World/Come-Sail-Away.md`, the slices and their state). What
the mod leaves for Mac is on its Port-Ledger row: DECLARED (1) to (38),
awaiting Mac's read. The patch notes have their section. What follows
is the log as it stood when the mod was held. The largest of the six: 12 C# files, about
7,500 lines decompiled (`ComeSailAway.cs` 6,808 of them), and a 13.5 MB
asset bundle of 10,465 objects - the boats' meshes, prefabs, animation
clips and animator, 59 textures, 8 FSB5 audio clips. A first draft of
the Unity asset decoders (mesh, animation, animator, prefab, bundle, and
FSB5 to Ogg) was written in a scratch worktree during this branch and
NOT kept - the container was ephemeral - so it is redone from the mod's
archive. What is already waiting for it in the port: Deep Waters' swim
check knows its boat (`world/deepWater/deepWaterSwim.js` `isBoatEffectBundle`,
the effect bundle "ImOnABoat" / "I'm On A Boat" suppresses the swim),
and item template indices 1320/1321 are free. Online: a boat syncs most
cheaply as sidecar keys on the foes frame (`scenes/world.js`'s foes
stream), which needs no relay change; new pose fields would need a relay
redeploy.

### 5. The ARENA2-gated failures: CLEARED (2026-09-26)

The sixteen that failed with the game data present (and skipped on CI)
were all rigs; no source had regressed. Each was root-caused to the
commit that left it behind and re-pinned on the law that commit made,
and every re-pin was mutation-checked (the records committed at AUDIT PRE-MERGE 0928 N10:
`tools/mutants/arena2triage.json`, the gated ones carrying a `why` that names ARENA2):
- The UI stubs had no scissor (CG1): audit18_ui_native F8/F9 and F10b,
  classquestions F2. F8/F9 also read a shadow under its only topic
  row, which its click selects, and ROAD-D D10's selected row has none.
- The data pins behind deliberate changes: terrain's nature y at
  TERRAIN-SCALE1's 1.25, world's MAGEAA00 flat with AUDIT 64 F12's
  `editor` stamp.
- A literal 'BOOKS' on a case-sensitive disk (DFU's folder is `books`,
  BookFile.cs:27): roada2 A2. The same literal broke the dev server's
  book fallback on Linux (fixed, pinned in audit68_repo) and silently
  skipped books' corpus sweep.
- The watch (audit18_hosts_dungeon, cityguards G3): the loot
  rebalance's quarter, RF2's one loot seam, and MAC-E's loot window.
- The court and the talk (audit18_systems_social F2, F4, F6 and
  AUDIT 21 F8): D10's answer-side question counter, B5's courtroom
  backdrop, E4's gold counter, and A3's served sentence.
- Four rigs that never ran against a real API: roadc_automap_pick,
  roadc_automap_window, roadb_castle, road_a5_seducer.

With `ARENA2_PATH` set, the whole suite passes.

### 6. After the Sea Update: the sea fight - NAV-A to NAV-H (2026-09-28)

Mac, opening it: *"enhance the newly integrated ships by adding proper navel combat with a huge reference to
assiasins creed black flag. Being able to aim and fire when viewing from the side. Along with this, I want to
introduce actual sailing ships to the world yhat players can encounter and pillage, with should also directly enhance
and integrate into the pirate quest system. All UI elements should follow enhanced plus UI."* Come Sail Away's hulls
carry guns now, the Iliac Bay's pirates, merchantmen and the three crowns' navies sail on the same hulls, a struck
ship is boarded and plundered, a pirate that grapples a crewed ship brings Warm Ashes' own raid onto its deck, and the
room shares one sea. `03-World/Naval-Combat.md` is the record; its departures are on the Port-Ledger's section A row.
