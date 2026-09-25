# Detailed Ships (DS1, 2026-09-25)

Cliffworms' **Detailed Ships 1.0.0** (Nexus 1080), ported 1:1 - Mac,
2026-09-25: "All mods attached are to be compatible and implemented 1:1."
Provenance and permission are `vendor/detailed-ships/README.md`; the
world-data mechanism is `02-Formats/World-Data-Patches.md`.

## What it does

"Revamps the interior and exterior of player ships." The two ships you
can buy - the small (`SHIPAA00.RMB`, block 390) and the large
(`SHIPAA01.RMB`, block 630) - get new building records: rigging, crates
and barrels, tenders, rudders and railings on deck; below, the captain's
quarters, the crew's berths, a galley and mess, a cargo hold, an armory
and a shrine to Kynareth, with sailors standing about to talk to (three on
the small ship, seven on the large). Furniture that is a house container
in DFU (`AddFurnitureAction`: a prop model of group 418 or of the listed
41000 indices) is one here too (`systems/containers.js`,
`scenes/interiorContext.js`) - 31 on the small ship, 90 on the large -
which is what the readme's "All interior containers can be used for safe
storage" is.

One switch, `Enabled`, on by default (`systems/modSettings.js`
`detailed-ships`; the Features row under World, "Takes effect when the
game next loads" - the world-data door caches a record once served).

## How the port carries it

- **The records** ride the world-data door as patches over the player's
  own `BLOCKS.BSA` (`WorldDataPatches/`, 450 and 1707 ops), rebuilt at
  load and checked against the author's files' canonical sha256.
- **The thirteen pictures** of the mod's archives `1210` and `1230` stand
  on the texture door as stand-ins of those archives
  (`systems/detailedShips.js`), behind the mod's switch: four are the
  author's files (three bottles, King of Worms' and Zoran's Kynareth
  statue), nine are BUILT from the player's own records
  (`formats/derivedTexture.js`, `Textures/derived.json`; WD2). The six xml
  scales register on `world/billboardXml.js` exactly as DFU reads them.
- **The models Daggerfall never had** - DET's ten - come through a model
  registry (`world/customModels.js`) that the exterior, interior and
  dungeon pipelines ask before ARCH3D, as DFU asks
  `MeshReplacement.ImportCustomGameobject` first.

### Four seams DS1 found and fixed on the way

1. **A stand-in's scale was `{ x, y }`.** `TextureFile.getScale` answers
   `{ width, height }` and `rmbFlats`' `scaledBillboardSize` reads those,
   so every stand-in flat came out NaN-sized. It answers the right shape
   now - zero, or the classic record's own scale for a picture built from
   one.
2. **A stand-in had no `archive`**, and `billboardSize` reads `t.archive`
   to lay a mod's xml scale on - every xml scale of a mod-only archive was
   lost. It carries it.
3. **`IsExteriorWindow` reads `archive % 100`**, so `1210`'s record 3 (a
   scroll) and `10027`'s (a chest) asked for a window mask from a stand-in
   that has no classic bitmap - the interior would not boot. DFU's
   `GetStaticBillboardMaterial` gives a mod picture no window emission;
   neither does the port.
4. **An archive past `TEXTURE.511` that nothing supplies** (a mod's record
   with the mod's pictures missing) threw the pixel build; **a model id
   that neither ARCH3D nor the registry answers** threw the dungeon. DFU
   logs both and draws nothing (`MaterialReader` answers no material;
   `GetModelData` answers false, `RDBLayout.cs:634-638`); so does the port,
   once, by name. A classic archive that will not load is still the
   player's missing data and still throws.

## The DET stand-ins

The mod requires Ninelan's *Daggerfall Expanded Textures* 1.2.0 as a peer.
Mac chose "Build your own" (2026-09-25). Each piece was read off its
placements in the port's own renders of the two ships, and built for that
place (`world/detStandIns.js`). Positions below are the port's metres,
`(x, up, z)` in the record's frame.

### Models (built in code, classic textures: rigging `0_77`, iron `0_79`, lamp glass `0_10`, planking `67_0`/`67_8`, sail `116_4`)

| id | placed | what it reads as | stand-in |
|---|---|---|---|
| `45081` | small ship: 2 up the mainmast at 21.5 and 23.7 m, 85 units apart, `45121` on top; 9 more laid on their side (`ZRotation -512`) or scaled 13.8 along their length from masthead to rail | line: the halyard, the stays, the stern's rails of rope | a rope cylinder, r 0.035 m, one segment (85 units) long |
| `45110` | small ship: 3 stacked on the stern castle (6.6, 8.7, 10.8 m), `45164` above | a staff | a wooden pole, r 0.05 m, one segment long |
| `45121` | small ship: the mainmast head, 25.8 m | a flag | a finial, a two-sided sail-cloth flag, its halyard |
| `45164` | small ship: the head of the stern staff, scale 1.4 | the stern lantern | an iron bracket and cage round lit glass |
| `45161` | large ship: two at the masthead (47.7 m, scale 2), one from the stern staff | pennants | a two-sided swallow-tail of sail cloth |
| `45082` | large ship: the stern, under the third pennant | the ensign staff | a 2.1 m pole with a cap |
| `45162` | large ship: four from the mess deck's beams | hanging lanterns | a chain, a frame, the lit glass |
| `45145` | large ship: over the berths | a round lamp | a hook, a caged round lamp |
| `45190` | large ship: the captain's floor, turned a quarter | a sea chest | a banded wooden chest |
| `45191` | large ship: the armory | a weapon rack | two posts, two rails, five spears |

### Flats (the player's own sprite of the same thing, sized as that sprite sizes itself)

| DET record | placed (small / large) | stand-in |
|---|---|---|
| `10009_29`, `_30`, `_31` | far out on the water: small at the waterline, large with their feet 1.4 m under it | the port's own drawing: one dolphin's leap in three poses, 40x56, the animal in the upper part so it breaks the surface wherever it was set |
| `10010_38` | the small ship's hold, among the barrels | `201_8`, a sitting cat |
| `10021_5` | 1 / 4, galley and stores shelves | `205_12`, a bottle |
| `10021_9` | 0 / 3, stores | `205_2`, a big jar |
| `10021_12` | 0 / 1, galley | `218_4`, a frying pan |
| `10021_13` | 0 / 1, galley | `218_0`, a cooking pot |
| `10021_16` | 0 / 3, stores | `205_4`, a jar |
| `10021_17` | 0 / 3, a table | `213_0`, an orange |
| `10021_22` | 0 / 1, galley | `200_1`, a goblet |
| `10021_27` | 1 / 0 | `205_30`, a bucket |
| `10025_0` | 0 / 1, the captain's cabin | `208_0`, a globe |
| `10025_3` | 1 / 3 (one on the large ship's deck) | `208_4`, a telescope on its tripod |
| `10027_0` | 1 / 1, stores | `211_3`, a heap of food stores |
| `10027_3`, `_4`, `_5` | 0 / 1 each, the hold | `205_21`, `205_22`, `205_23`, chests |
| `10027_6`, `_7` | 1 / 7, 0 / 2, the hold | `205_17`, `205_18`, sacks |
| `10027_8`, `_9` | 0 / 4, 0 / 2, the hold | `205_24`, `205_25`, crates |
| `10027_10` | 1 / 3, the hold | `205_0`, a barrel |
| `10027_11` | 1 / 0, the mess table | `200_1`, a goblet |
| `10027_12` | 0 / 1 | `205_30`, a bucket |
| `10027_13` | 1 / 0, the mess table | `218_4`, a frying pan |
| `10027_14` | 0 / 1, the hold | `204_7`, a bolt of cloth |

Verified in the port's own renders (`tools/shotPoses.mjs`, one boot and a
picture per camera pose): both ships from outside - the masthead flag and
halyard, the stern lantern on its staff, the pennants, the dolphins at the
waterline and breaking it - and both below decks: the mess lanterns lit,
the goblet and pan on the mess table, the cat among the hold's barrels.

## Online

The room's (`ONLINE_ROOM_MOD_KEYS`, the ground's note): every owner's ship
stands at the same map pixel - (2,2) small, (5,5) large (`banking.js`
`SHIP_COORDS`) - so a room's sailors share one deck, and the mod stands
collidable railings, crates, tenders and rigging on it. Two players who
disagree would walk two decks. Below decks opens no room
(`worldModes.js`): the interior is the player's own.
