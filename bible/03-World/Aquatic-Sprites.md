# Aquatic Sprites (AS1, 2026-09-25)

Cliffworms' **Aquatic Sprites 1.0** (Nexus 276), ported 1:1 - Mac,
2026-09-25: "All mods attached are to be compatible and implemented 1:1."
The long form of provenance is `vendor/aquatic-sprites/README.md`; the
mechanism is `02-Formats/World-Data-Patches.md`.

## What it does

"Adds aquatic sprites to submerged caverns." Three of Daggerfall's
flooded dungeon blocks gain the underwater flats the classic game ships
in `TEXTURE.105` and `TEXTURE.106` and never places:

| block | index | flats |
|---|---|---|
| `W0000000.RDB` | 1016 | 32 |
| `W0000008.RDB` | 1024 | 48 |
| `W0000023.RDB` | 1039 | 39 |

No code, no art, no settings - one switch, the port's `Enabled`, on by
default (`systems/modSettings.js` `aquatic-sprites`; the Features row
under World, "Takes effect when the game next loads", because the door
caches a block once served).

## How the port carries it

The shipped files are whole RDB blocks. The port vendors each block's
EDIT (`vendor/aquatic-sprites/WorldDataPatches/`) and rebuilds the block
at load from the player's `BLOCKS.BSA`; the rebuild is checked against
the author's file (canonical sha256). The dungeon layout then reads the
block through the world-data door exactly as it reads a classic one - the
flats are ordinary RDB flats (`world/rdbLayout.js`), drawn from the
player's own ARENA2 archives, action 0, no marker.

## Online

The player's own (`ONLINE_PLAYERS_OWN_MODS`): scenery with no collider,
no action and no marker. The editor's round trip also turned seven room
models of these blocks by one to three units of 2048 (under half a
degree); two players who disagree on the switch walk rooms that differ by
that much, which is below anything the room's position sync can show.
