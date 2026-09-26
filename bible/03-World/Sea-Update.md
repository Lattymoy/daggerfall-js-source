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

Every landed mod is on by default, registered (settings, Features,
credits, `01-Overview/Mod-Registry.md`) and placed in the online lane
(`systems/onlineLane.js`).

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
distance, so its sea reads a shade darker than the fully fogged edge of
the streamed world - EV8's own, over land and sea alike.

### 3. There's a Hole in the Bottom of the Ocean 1.1.0 (jet082)

Not started - and not startable here: this container holds neither its
archive nor Come Sail Away's (Mac handed them over on 2026-09-25, to the
branch's first session); hand them over again to begin. It REQUIRES Iliac Puddle No More 1.2.2+ - the carved sea is
on this branch, so it can be built on it. `OceanHoles.cs` is 2,978 lines.
What the first reading found: `StableHash(x, y, salt)` in integer maths;
`IsPitPixel` by hash % 48; `PlacementFraction` 0.28 + (h & 0xffff) /
65535 * 0.44 with salt `0x484F4C45 ^ salt`; the pit's dungeon is a
borrowed template (`TryFindTemplate` by hash over the regions), cloned,
entered through `TransitionDungeonInterior` with the cloned
`DFLocation`, and WATERIZED (block water level =
-(max(start + 2.5, maxMeshTop + 1) - dungeonY) / 0.025); renamed "The
<Adj> <Noun> <Ending>", map id `0x60000000 | (pixelId & 0xFFFFF)`; flame
enemies removed, the rest replaced by hash from the deep's roster
(DW-E4's tables) weighted max(1, level - 5), an aquatic quota of 30%;
light fixtures removed; loot upgraded (+1 material tier, a bonus magic
chance that halves); the exit teleports back to the pit's entrance.
Online: a pit is a dungeon - decide with Mac whether a pit is a room's
(like the sea) or each player's.

### 4. Come Sail Away 2.1 (RedRoryOTheGlen) - HELD (Mac, 2026-09-25)

Not started in the port. The largest of the six: 12 C# files, about
7,500 lines decompiled (`ComeSailAway.cs` 6,808 of them), and a 13.5 MB
asset bundle of 10,465 objects - the boats' meshes, prefabs, animation
clips and animator, 59 textures, 8 FSB5 audio clips. A first draft of
the Unity asset decoders (mesh, animation, animator, prefab, bundle, and
FSB5 to Ogg) was written in a scratch worktree during this branch and
NOT kept - the container was ephemeral - so it is redone from the mod's
archive. What is already waiting for it in the port: Deep Waters' swim
check knows its boat (`world/deepWaterSwim.js` `isBoatEffectBundle`,
the effect bundle "ImOnABoat" / "I'm On A Boat" suppresses the swim),
and item template indices 1320/1321 are free. Online: a boat syncs most
cheaply as sidecar keys on the foes frame (`scenes/world.js`'s foes
stream), which needs no relay change; new pose fields would need a relay
redeploy.

### 5. The ARENA2-gated failures

16 tests fail with the game data present, on the branch's base too;
they skip on CI (no ARENA2), so the suite is green there. Not yet
triaged - run the suite with `ARENA2_PATH` set and take them one by one.
