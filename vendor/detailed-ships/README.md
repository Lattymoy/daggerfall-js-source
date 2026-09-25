# Detailed Ships 1.0.0 - Cliffworms (ported 1:1; the author's edits and drawings vendored, the ships and the classic pictures rebuilt from the player's own data)

**Detailed Ships 1.0.0** for Daggerfall Unity 1.1.1+, by **Cliffworms**
(Nexus mod 1080; GUID `9d7ff75b-ff75-4306-b6a6-607456d5d7fb`). The mod's
own description: "Revamps the interior and exterior of player ships." Its
readme says more: "Outside, tight ropes are attached to the masts, crates
and barrels are here and there, tenders sit on the top deck, rudders are
present and there are additional railings. You may even spot a dolphin
jumping out of the sea. Inside, each room has a purpose."

Mac (Lattymoy) handed the shipped archive
(`Detailed_Ships-1080-1-0-0-1752548193.zip`) over on 2026-09-25, with
five other sea mods: "All mods attached are to be compatible and
implemented 1:1."

**Permission: the author's own readme, section 6, verbatim - "The mod may
be distributed/translated without my authorization as long as I am
credited as the author. Spread the love!"** Cliffworms is credited here,
in the registry row, and on the credits screen. The readme's credits name
**King of Worms and Zoran** "for the deity statues" - the Kynareth statue
below (`1230_30-0.png`) is theirs, and they are credited beside Cliffworms
everywhere Cliffworms is.

## What the mod is

No code (the manifest lists no script). Two world-data files - the
building record of each ship you can own - and thirteen pictures under
two archive numbers of the mod's own, `1210` and `1230`, six of them
scaled by an xml file beside them.

| file | block (BLOCKS.BSA index) | classic record | the author's |
|---|---|---|---|
| `SHIPAA00.RMB-390-building0.json` (the small ship) | `SHIPAA00.RMB` (390) | 1 + 3 models, 1 + 3 flats | 92 + 190 models, 34 + 129 flats, 3 sailors, 2 doors (exterior + interior) |
| `SHIPAA01.RMB-630-building0.json` (the large ship) | `SHIPAA01.RMB` (630) | 1 + 1 models, 0 + 12 flats | 272 + 1134 models, 33 + 250 flats, 7 sailors, 10 doors |

Every one of those placements is the author's own arrangement: measured
against every building and every block of `BLOCKS.BSA` (the exterior,
interior and misc lists, allowing any translation and a rotation either
way round), no four of the author's records line up with any classic
list - the check finds a translated copy of a classic tavern interior
39-for-39, and finds nothing here.

## The dependency the port stands in: Daggerfall Expanded Textures

The manifest declares a required peer dependency, Ninelan's **Daggerfall
Expanded Textures** 1.2.0 (Nexus 307), and the two records place ten of
its models and twenty-seven of its flat records: models `45081`, `45082`,
`45110`, `45121`, `45145`, `45161`, `45162`, `45164`, `45190`, `45191`;
flats in archives `10009`, `10010`, `10021`, `10025` and `10027`. DET is
not part of this port. Asked outright (2026-09-25), Mac chose **"Build
your own"**: every one of those pieces is the PORT'S OWN stand-in, made
for the place the author put it (`src/world/detStandIns.js`; the table of
what each is, and how it was read off its placements, is
`bible/03-World/Detailed-Ships.md`). None of it is DET's, which the port
has never seen:

- the ten models are built in code, textured with the classic textures
  the classic ship already wears (its rigging, planking and sail);
- twenty-four of the flats are the player's own Daggerfall sprites of
  the same things (a cat, chests and sacks, a globe, a telescope, the
  galley's pots), sized as those sprites size themselves;
- the three dolphins (`10009` records 29-31) are the port's own drawing,
  made in code.

## What is here, and what deliberately is NOT

- `detailed-ships.dfmod.json` - the shipped manifest, verbatim (the
  bundle names it `DetailedShips.dfmod`).
- `Readme_DetailedShips.txt` - the shipped readme, verbatim.
- `WorldDataPatches/SHIPAA0x.RMB-<index>-building0.json` - **the author's
  edit of each ship's building record, and only the edit** (450 and 1707
  ops, 88,522 and 340,446 bytes against the shipped 173,970 and 662,801).
  A whole building record is Daggerfall's layout - game data, which this
  repository never carries (Port-Doctrine) - so `tools/worldDataPatch.mjs`
  took each shipped file against the classic record out of `BLOCKS.BSA`,
  serialised exactly as the World Data Editor serialises it, and kept the
  difference. Each patch records the sha256 of the author's file in
  canonical form, and the tool refuses to write one that does not rebuild
  it.
- `Textures/1210_10-0.png`, `1210_11-0.png`, `1210_12-0.png` - the
  author's own 7x15 drawings (the bottles on the small ship's shelves),
  re-encoded from the bundle's pixels.
- `Textures/1230_30-0.png` - the Kynareth statue, King of Worms' and
  Zoran's (117x176), re-encoded from the bundle's pixels.
- `Textures/*.xml` - the six scale files, the bundle's text verbatim.
- `Textures/derived.json` - **nine pictures as specs, not files.**
  Measured against every record of every TEXTURE file at every offset,
  five of the mod's pictures ARE classic records moved to the new archive
  (`1210_1`, `_3`, `_4` from `TEXTURE.209`; `1210_17`, `_18` from
  `TEXTURE.211`) and four are classic records with the author's paint on
  them (`1210_8`, `_9`: fruit in `TEXTURE.205`'s empty basket, 166 and 188
  pixels; `1210_19`, `_20`: `TEXTURE.205`'s bottles moved down a row with
  a cork painted on, 18 pixels each). A render of game data is game data,
  so none of those nine ships: each spec names the classic record, where
  it lands on the picture and the author's pixels, and the picture is
  built from the player's own `ARENA2` when the archive loads
  (`src/formats/derivedTexture.js`). The rebuild is checked exact, pixel
  for visible pixel, before the spec is written.
- **Not here:** the two shipped world-data files, the nine classic
  pictures, and anything of Daggerfall Expanded Textures.

To re-derive every file here from the shipped archive:

    node tools/detailedShipsAssets.mjs <arena2> "<extracted>/Mods/detailed ships.dfmod"

It prints what it measured for each picture and the sha256 of every file
it writes.

## Online

The room's (`ONLINE_ROOM_MOD_KEYS`): every owner's ship stands at the same
map pixel - (2,2) for the small, (5,5) for the large - so a room's sailors
share one deck, and the mod stands collidable railings, crates, tenders and
rigging on it. Below decks opens no room; the interior is the player's
own.
