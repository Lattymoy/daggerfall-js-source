# The vendored-work registry (HARD4, 2026-09-15)

> **The counts in the next two sections are HARD4's own moment and are
> left as it wrote them.** They were true of the fifteen rows that
> existed on 2026-09-15 and they are the record of what putting those
> rows side by side found. The live numbers are derived, not written:
> `vendor/` holds 19 directories and 11 of their READMEs still carry an
> unfilled permission line, each shown as `RECORD OPEN` in the table.
> ORL1 (2026-09-17) added the nineteenth, and the first vendored MOD
> that is not a Daggerfall Unity one - an OpenMW Lua mod for Morrowind.
> It carries no `*.dfmod.json`, so the gate below reads no version or
> author cell for it and its own suite checks both instead; its row in
> *Known deviations* says so. (Eight of the nineteen directories carry no
> manifest. Six of the other seven are not mods at all - Daggerfall
> Unity's own shipped data, a font, a road table, Mac's own project - and
> the seventh, `windmills-kamer`, is a Daggerfall Unity mod shipped as
> loose meshes rather than as a bundle.)

The fourth slice of `01-Overview/Hardening.md`. One row per directory in
`vendor/`, and `test/hard4_registry.test.js` derives the row list from
the filesystem, so a fourteenth entry cannot arrive without one.

## Why a registry and not fourteen READMEs

The READMEs are good, and they stay: each is the long form, and the
registry links to it rather than replacing it. What a README cannot do
is be **read together with the other thirteen**. Two facts about this
tree were invisible until these rows were put side by side:

1. **Seven of the fifteen carry an unfilled permission line.** Each is a
   literal `[Mac: paste the text of the permission, or the link to it,
   here.]` sitting under a sentence that says permission was granted -
   so the README reads as settled, and only the placeholder says it is
   not. Six is not one oversight; it is the shape of a record nothing
   checks. They are the `RECORD OPEN` rows below, and the gate now holds
   the two in step: a README with the placeholder MUST show `RECORD OPEN`
   here, and a README without it must NOT.
2. **One port is built from a version its upstream source does not
   cover.** PCAAO's shipped bundle is 1.44; the last single-file source
   in its repository is 1.40. The port's law is the decompiled 1.44 with
   the 1.40 source naming what the decompiler numbered - which is the
   right call and is written down in the README, but it is the kind of
   fact that belongs where a maintainer looks first.

Neither is a defect in the port's behaviour. Both are exactly the
"correct system delivered incorrectly by its caller" shape this program
was written for, pointed at provenance instead of at code.

## What `RECORD OPEN` means, and what it does not

It does **not** mean the work is used without permission. In every case
the README records that permission was given - to Mac, by the author, on
a dated day - and that sentence is Mac's word, which settles the
question of whether the port may carry the files.

It means the EVIDENCE was never pasted in. The line exists to hold the
author's own words or a link to them, and it is still a prompt. Anyone
who has to answer a licence question later - or anyone who takes this
repository over - would find a promise and no receipt. Filling the seven
lines is a five-minute job for the person who holds the messages, and it
is nobody else's job, which is why the rows say who.

## The registry

`parity` is the date the port was last read against the upstream work,
not the date the slice shipped, where those differ.

| vendor | what the port takes | upstream | version | read from | licence / permission | port slice | parity | bible |
|---|---|---|---|---|---|---|---|---|
| `ambient-text` | manifest, settings, the 918-line text table | Regnier | 1.8 | shipped `.7z` `Ambient_Text-303-1-8-1774575578`; behaviour off the DLL's IL | granted (Mac handed the archive over 2026-09-15) - **RECORD OPEN** | AT0-AT3 | 2026-09-15 | `06-Systems/Ambient-Text.md` |
| `eye-of-the-beholder` | manifest, settings, presets, the per-sprite offsets folded to one table, and all 3035 sprites re-encoded as indexed PNG | RedRoryOTheGlen | 2.1 | shipped `.zip` `Eye_of_the_Beholder-762-2-1-1775438888`; the DLL and its IL dump vendored (EOTB-IL) | granted (Mac handed the archive over 2026-09-15) - **RECORD OPEN** | EOTB0-EOTB7, AUDIT-EOTB, AUDIT-EOTB2, EOTB-IL (the assembly and its IL dump vendored beside the art; 45 of 61 authored methods ported, every one read off the IL, 16 with no twin here - the count is checked against the dump in `test/eotb_scope.test.js`; see the page) | 2026-09-16 | `06-Systems/Eye-Of-The-Beholder.md` |
| `immersive-footsteps` | manifest, settings, the two C# sources (the author's MIT repository at `ac03581`), all 210 MP3 clips in both qualities | Kirk.O | 1.01 | shipped `.zip` `Immersive_Footsteps_v1.01_-_DFU_v1.0.0_-_Windows-706-1-01-1713032612`; behaviour off the author's published SOURCE (the bundle's DLL is its build; its FSB5 clips are Unity's import of the same MP3s) | MIT (the main script's header); granted (Mac handed the archive over 2026-09-16) - **RECORD OPEN** | IF1 | 2026-09-16 | `06-Systems/Immersive-Footsteps.md` |
| `better-ambience` | manifest, settings, all sixteen C# sources (carried inside the bundle as TextAssets), the author's MIT LICENSE, the 29 WAV clips the mod asks for (from the author's repository) | Joshua Steinhauer (joshcamas) | 0.1.4 | shipped `.dfmod` from the Nexus archive `BetterAmbience-139-0-1-5-1666071806` (labelled 0.1.5; the manifest inside says 0.1.4); behaviour off the SOURCES the bundle carries; the clips' FSB5 imports are undecodable here, so the repository's WAVs stand in | MIT (the repository's LICENSE); granted (Mac handed the archive over 2026-09-16) - **RECORD OPEN** | BA1 | 2026-09-16 | `06-Systems/Better-Ambience.md` |
| `dfu-books` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/Resources/books.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/UI-Arc.md` |
| `dfu-quests` | data | Daggerfall Unity (Interkarma and contributors) | - | `Assets/StreamingAssets/{Quests,Tables}` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `06-Systems/Quest-Arc.md` |
| `dfu-settings` | data | Daggerfall Unity (Interkarma and contributors) | - | `defaults.ini.txt` + `Text/GameSettings.txt` @ `81e89e90` | MIT | route (a) | 2026-08-20 | `10-UI/Settings-Screen-Spec.md` |
| `dynamic-skies` | presets, textures, shader read | BadLuckBurt and carademono | 2.3.4 | `.dfmod` bundle, cross-read against `drcarademono/dynamic-skies` @ `04506e2` | granted to Mac 2026-09-04 - **RECORD OPEN** | DS1, DS2 | 2026-09-04 | `07-Rendering/Dynamic-Skies.md` |
| `handheld-torches` | 39 textures, manifest, settings | RedRoryOTheGlen | 1.4.1 | shipped zip `Handheld_Torches-780-1-4-1`; behaviour off the DLL's IL | granted (Mac handed the zip over 2026-09-14) - **RECORD OPEN** | HT0-HT4 | 2026-09-14 (AUDIT 66) | `06-Systems/Handheld-Torches.md` |
| `meanerMonsters` | 46 sprite-scale XML, manifest | Ralzar (header: Hazelnut and Ralzar) | 1.5.2 | shipped zip; code from `Ralzar81/Meaner-Monsters` master | MIT (source header) | MM1 | 2026-09-12 | `04-Characters/Meaner-Monsters.md` |
| `oblivion-remaster-leveling` | the whole mod: its ten shipped files - the 1,314 lines of Lua, the 487-byte `.omwaddon` (one GMST, `iLevelupTotal` 100), the manifest, both l10n yaml and the author's README | **not named in any shipped file** (Nexus Morrowind 56569) | 0.5.3 | shipped `.zip` `OblivionRemasterLikeLeveling_0.5.3-56569-v0-5-3-1748644502`; behaviour off the author's OWN LUA, which is the mod - there is nothing compiled to read | **the archive states NO LICENCE**; granted (Mac handed the archive over 2026-09-17) - **RECORD OPEN** | ORL1 | 2026-09-17 | `06-Systems/Oblivion-Remaster-Leveling.md` |
| `pcaao` | manifest, settings | Kirk.O | 1.44 | shipped `.dfmod`, DLL decompiled (ILSpy 8.2.0.7535); **source repo only covers 1.40** (`6e19023`) | repository states none; granted (Mac handed the bundle over 2026-09-12) - **RECORD OPEN** | PCO1 | 2026-09-12 | `05-Combat/Physical-Combat-Overhaul.md` |
| `raum-book` | the animated book itself | Mac (Lattymoy), project-raum | - | `Lattymoy/project-raum` @ `7fa7119e` | Mac's own work, at his word 2026-09-12 | the enhanced book | 2026-09-12 | `10-UI/UI-Arc.md` |
| `roads-hazelnut` | four 500,000-byte path masks | Hazelnut | - | `ajrb/dfunity-mods`, `BasicRoads/`, sha256-verified | code MIT; **data carries no licence text** - granted to Mac 2026-09-02 - **RECORD OPEN** | ROADS 22-25 | 2026-09-02 | `03-World/Roads.md` |
| `seasons-iliac-bay` | manifest only; the bundle is the player's | RosyTheRascal | 1.1 | manifest verbatim; behaviour off the DLL's IL; textures read from the player's own `.dfmod` at runtime | granted to Mac 2026-09-05 - **RECORD OPEN** | SIB1 | 2026-09-05 | `07-Rendering/Seasons-Iliac-Bay.md` |
| `silkscreen-five` | one glyph (U+0035), 520 bytes | The Silkscreen Project Authors | - | `googlefonts/silkscreen`, subset with `pyftsubset` | SIL OFL 1.1 (`OFL.txt` beside it) | the enhanced skin's digits | 2026-09-08 | `10-UI/UI-Arc.md` |
| `unleveledLoot` | manifest, settings | Ralzar | 1.1.2 | shipped zip; code from `Ralzar81/Unleveled-Loot` | MIT (source header) | UL1 | 2026-09-12 | `06-Systems/Unleveled-Loot.md` |
| `weapon-sheathing` | the 71 `_sh` scabbard meshes, the three `xbase_anim_sh.nif` skeleton addons, the shipped readme | Greatness7 (art by akortunov, Greatness7, Heinrich, London Rook, Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat, PikachunoTM, Remiros) | 1.6 | shipped `.7z` `WeaponSheathing1.6-OpenMW-46069-1-6`; the mechanism is OpenMW's, ported | the mod's own: free to use with credit and no fee (`WeaponSheathing.txt`) | WS1 | 2026-09-17 | `06-Systems/Weapon-Sheathing.md` |
| `weapon-widget` | manifest, settings | RedRoryOTheGlen | 1.6 | shipped zip `Weapon_Widget-860-1-6`; behaviour off the DLL's IL | granted (Mac handed the zip over 2026-09-14) - **RECORD OPEN** | WW1-WW4 | 2026-09-14 | `05-Combat/Weapon-Widget.md` |
| `windmills-kamer` | five `.dae` meshes + placements | Kamer | 2.0 | `WindMills.rar`, supplied by Mac 2026-08-29 | granted by the author, confirmed by Mac 2026-08-29 | WM1 | 2026-08-29 | `03-World/Windmills.md` |

## Known deviations, per row

Only the ones a maintainer would be surprised by. Each README carries the
full account; this is the index to it.

- **`oblivion-remaster-leveling`** - the only row that is not a
  Daggerfall Unity mod: OpenMW Lua for Morrowind, so there is no
  `*.dfmod.json` and `test/hard4_registry.test.js` reads no version or
  author cell for it. Its own suite checks both instead, against the
  author's changelog heading and the Lua's own defaults. The archive
  names no author and states no licence, so the author cell is the Nexus
  id and the permission line is still a prompt.
- **`dynamic-skies`** - the repository's `Resources/*Night.json` presets
  are NOT carried, because they are not in the shipped manifest and the
  mod therefore never loads them.
- **`handheld-torches`**, **`weapon-widget`**, **`seasons-iliac-bay`**,
  **`pcaao`**, **`meanerMonsters`**, **`ambient-text`** - the mods' compiled DLLs are not
  vendored and never were. Behaviour was read method by method (IL, or
  the upstream source where one exists) and rewritten; the port's own
  files are the law, each citing the C# member it restates.
- **`pcaao`** - the version gap above: bundle 1.44, last single-file
  upstream source 1.40. Also, its "Vanilla Combat Event Handler"
  dependency is a relay for OTHER mods and nothing here consumes it.
- **`seasons-iliac-bay`** - the port reads the PLAYER's own `.dfmod`
  bundle at runtime rather than carrying 372 textures. Only the manifest
  is vendored.
- **`ambient-text`** - `ambientTexts.json` is NOT in the manifest's
  `Files` list, and it is carried anyway: the mod's runtime reads its
  table from a static `Hashtable` baked into the DLL, and the JSON
  beside it in the bundle is the same 918 pairs - checked key by key
  against the IL, no key missing on either side and no value differing.
  So the vendored file is the table, not a stale export of it, and the
  port reads it directly rather than transcribing 918 lines into JS.
- **`roads-hazelnut`** - data only. The road RENDERING is the port's own
  work, deliberately (the Ledger: "instead of taking their mod, I want us
  to develop our own and better").
- **`raum-book`** - the one intentional change from Mac's original is
  marked `PORT` in the files: Raum's hand-drawn journal face is replaced
  by `BOOK.inscribe`, a seam pointed at the port's own glyph painter, so
  the book's words are Daggerfall's in Daggerfall's FNT faces.
- **`windmills-kamer`** - the meshes are Kamer's; the seven placements
  and the turning are the port's.

## What the gate holds

`test/hard4_registry.test.js`, and like every gate in this program it is
derived rather than listed:

1. **Every `vendor/*/` has exactly one row, and every row names a
   directory that exists.** Add a mod and the gate is red until it is
   registered; delete one and the stale row is named.
2. **Every version cell matches the vendored manifest.** Where a
   `*.dfmod.json` is present, its `ModVersion` and `ModAuthor` are read
   and compared. A bundle refreshed to a new upstream version without
   the row being touched fails here.
3. **`RECORD OPEN` and the README placeholder agree, in both
   directions.** A README still carrying `[Mac: ...]` must show
   `RECORD OPEN`; one without must not. Filling a permission line and
   forgetting the row - or the reverse - is caught.
4. **Every row names a bible page that exists**, and every vendor
   directory has a README.
5. **Every mod the port exposes as a switch is registered.** The vendor
   keys in `systems/modSettings.js` are read out and each must have a
   row, so a mod cannot become player-visible without its provenance
   being written down.
