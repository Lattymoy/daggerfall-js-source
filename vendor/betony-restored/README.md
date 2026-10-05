# Betony Restored 1.1.3 - Cliffworms (ported 1:1; the places carried as the author's own records, the blocks as his edits over the player's own, the script off its IL)

**Betony Restored 1.1.3** for Daggerfall Unity 1.0.0 or later, by **Cliffworms** (Nexus mod
515, `Betony_Restored-515-1-1-3-1775279968.zip`; GUID `7fa973db-3079-4648-bb62-e2196bf7095b`).
The manifest's own description: "Adds 25 locations from the Daggerfall Betony demo, including
Betony City." The owner handed the zip over on 2026-10-05: "This is the next mod I would like to
integrate".

**Permission:** the author's readme (`Readme_BetonyRestored.txt`, section 6): "The mod may be
distributed/translated without my authorization as long as I am credited as the author. Spread
the love!" - the terms Aquatic Sprites and Detailed Ships, his earlier two, carry here under the
same words. The readme credits the pictures that are not his: "Ralzar for the extinguished lights
textures. Kamer for the sitting patrons. WilhelmBlack and King of Worms for the Mara statue", and
"Hazelnut, again, for the marketplace NPCs' schedule/weather script".

## What the mod is

- **25 new places** in the region of Betony (`locationnew-<name>-19.json`): Betony City (6x6
  blocks, 311 buildings - the palace, the marketplace, every guild hall, the Knights of the Dragon's),
  three hamlets and a village (Chestercester, Westtale, Westbury, Waterborne), seven dungeons (the
  readme counts six), and thirteen homes, farms, a tavern, a temple and a shrine. Their records are
  the author's own - building lists numbered from 40,000, his name seeds, his dungeon layouts over
  Daggerfall's RDB blocks - and no classic location is one of them.
- **Fourteen new blocks**: `WALLAA00Betony` to `WALLAA11Betony` (the city's walls and gates, with
  Betony's and Daggerfall's banners), `PALAAA00Betony` (Lord Mogref's palace: a hall, a council room,
  a kitchen) and `MARKAA00Betony` (the marketplace - its stalls, three taverns, the bank, the shops),
  each Daggerfall's block of that name with the author's edits in it.
- **A script** (`Betony Restored.dll`; the manifest names `Scripts/BetonyRestoredMod.cs` and the
  bundle carries its build): registers Lord Mogref's faction, and shows and hides the street people
  a flag marks - by day, by night, in the rain - at dawn, at dusk, when the weather changes and when
  the player walks into a town.
- **Pictures** in archives 540 (Ralzar's extinguished lights), 1200 (people), 1210 (Cliffworms'
  items) and 1230 (the Mara statue), one replacement of Daggerfall's own `218_5`, their xml scales,
  and Basic Roads' path picture.
- **Basic Roads' arrays** (`roadData`, `trackData`), replacing that mod's own with the island's
  roads drawn in.
- Beside the bundle, **six rules for Flat Replacer** (`FlatReplacements/`, Numidium3rd's mod) - the
  talk portraits of the custom people.

It requires Daggerfall Expanded Textures 1.2.0 (peer), the RMB Resource Pack 0.3.0 and Flat
Replacer 0.2.18 (peer); the port carries none of the three, and stands its own pieces in.

## What is here, and what deliberately is NOT

Every file is written by `tools/betonyRestoredAssets.mjs <arena2> <unzipped archive>`, which
refuses to write a pack one of whose files does not rebuild the author's sha256, or a derived
picture that does not rebuild its every visible pixel.

- `betony-restored.dfmod.json` - the manifest, verbatim. `Readme_BetonyRestored.txt` and
  `FlatReplacements/BetonyRestoredFlatReplacements.json` - verbatim from the archive.
- `betony-restored.files.json` - the tool's listing of every file it writes under `Textures/`, with
  the bundle's sha256: what `test/doctrine.test.js` lets stand there (AUDIT BET1 D1 - the bundle's
  own manifest names pictures the port does not carry).
- `BetonyRestored.dll` - the shipped assembly, byte for byte (the bundle's TextAsset
  `Betony Restored.dll`), and `il/BetonyRestored.il.txt` - every method body as CIL, dumped by
  `tools/ilDump.py`. `src/systems/betonyRestored.js` cites the offsets it restates.
- `WorldDataPack/betony-restored.pack.json.gz` - the 39 world-data files as one WD3 pack (58,812
  bytes gzipped, from 6,290,798 bytes of JSON in the bundle): the 25 places carried WHOLE on no base (`['n']` - they are the
  author's), the fourteen blocks as edits of their classic namesakes, rebuilt at load from the
  player's own `BLOCKS.BSA`. Of the 6,692 records the pack carries, 35 coincide with a classic one;
  every interior Daggerfall already has is a reference into the player's file. The pack keeps the
  manifest's order (`order`): DFU's FindAssets walks a mod's files in it, so the new places take
  region 19's indices 25-49 in it, as in DFU.
- `roads.json` - the 7 road and 24 track map pixels where the bundle's `roadData.bytes` and
  `trackData.bytes` differ from `vendor/roads-hazelnut`'s (every one on the island, x 111-126,
  y 256-270), and both arrays' sha256 before and after. The bundle's `.txt` dumps of the same
  arrays are not carried.
- `Textures/` - the pictures, MEASURED (the tool's `classifyPicture`):
  - **the author's own**, as PNG (66): Kamer's two sitting patrons, every frame (`1200_53-0` to
    `-30`, `1200_54-0` to `-31` - a drink lifted and set down), Cliffworms' two bottle shelves
    (`1210_14`, `1210_15`) and the Mara statue (`1230_11`), with its scale (`1230_11-0.xml`);
  - **Daggerfall's own records**, as WD2 specs in `derived.json` (13): `218_5` (the cooking pot,
    its smoke taken out - the changelog's "evil smoke" - which replaces Daggerfall's own `218_5`
    wherever it stands while the mod is loaded, as in DFU), ten of Ralzar's lights (`540_2` to
    `540_20`: the classic light with its flame taken out) and two shelves stood with classic
    bottles and goblets (`1210_13`, `1210_16`: the `also` layers);
  - **re-shaded whole**, NOT carried, named in `reshaded.json` (7): `540_0`, `540_21`, `540_22`,
    `540_24` to `540_27` - the classic light's own outline with most of its pixels recoloured.
    Port-Doctrine's own case ("a re-shaded sprite that keeps the original silhouette"): neither
    the picture nor its pixels as edits ship. The player's own copy of the mod, attached, answers
    first; else the classic record each re-shades stands in;
  - **Detailed Ships' pictures**, identical pixel for pixel (9: `1210_8` to `_12`, `_17` to `_20`)
    and their two scales - that mod's art, shared (`systems/detailedShips.js`), not a second copy.
- **Not here:** StarMadeKnight's four people (`1200_14`, `_15`, `_17`, `_19`, with their scales) -
  the RMB Resource Pack's art (its catalogue names them; the bundle carries them at twice the pack's
  size), not this author's and not credited by his readme; `1200_17` is a repaint over Daggerfall's
  own `186_16`. WD3 carries nothing of the pack. The two the blocks place stand in as Daggerfall's
  own people of the same kind (`systems/betonyRestored.js` BETONY_NPC_STAND_INS), as does the pack's
  `1200_13`, which the blocks place and the mod does not ship. `1230_0-0.xml` scales a picture no
  part of this mod carries. `BasicRoads-paths.png` is Hazelnut's travel-map picture with the
  island's roads painted in; the port draws the paths off the arrays.

## The port

`src/systems/betonyRestored.js` is the mod - its faction, its street people's law and events, its
pictures, Flat Replacer's portraits, its roads. `src/scenes/world.js` runs the street people's
update on its edges; `src/scenes/modWorldData.js` loads the pack; `src/formats/worldDataPack.js`
reads it. See `bible/03-World/Betony-Restored.md`.

Thank you, Cliffworms - and Kamer, Ralzar, WilhelmBlack, King of Worms and Hazelnut.
