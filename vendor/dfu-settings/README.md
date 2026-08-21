# DFU settings defaults (vendored)

Two files from **Daggerfall Unity** (MIT License, Interkarma and
contributors), vendored verbatim:

- `defaults.ini.txt` - the shipped default value for all 171 settings.
- `GameSettings.txt` - DFU's own settings text table: the human LABEL
  and the tooltip (`<key>Info`) for each setting, plus the titles of
  its settings pages and section headings.

Provenance: https://github.com/Interkarma/daggerfall-unity
`Assets/Resources/defaults.ini.txt` and
`Assets/StreamingAssets/Text/GameSettings.txt` at commit
`81e89e90c27bc3c1a7a61871e545fad129174dec`.

## Why this is committed

Same route the quest pack took (Port-Ledger route (a)): this is DFU's
own DATA, not ARENA2 and not the C# we translate.

- It is not ARENA2. Classic Daggerfall has no equivalent file - its
  settings live in Z.CFG and the executable. This one is DFU's, written
  by the DFU project, MIT-licensed and redistributable.
- It is not source we are porting. `SettingsManager.cs` is the code and
  we translate that by hand like every other C# member; this file is
  the TABLE it reads, the same relationship `ItemTemplates.txt` has to
  `ItemBuilder.cs`.
- Hand-transcribing 171 defaults across 13 sections is exactly the
  lossy-second-copy shape AUDIT 17e F9 caught in the item templates.
  Vendoring it means `systems/settings.js` parses the real bytes and a
  pin can assert the parse against them.

The label table matters as much as the defaults: it means the words a
player reads are DFU's OWN words, ported like any other law, rather
than 171 labels invented here. `LypyL_GameConsole` becomes DFU's
"Game Console", not our guess at one.

## What reads them

`src/systems/settings.js` parses this file into the settings store's
sections, keys and default values. The port implements DFU's typed
getters verbatim, including their failure modes (a bad bool reads
False; a bad clamped int reads `min`, not the default).

Not every setting has a consumer in this port - see the settings row in
`bible/01-Overview/Port-Ledger.md` section A, and the tier each key
carries in `settings.js` (`live` / `stored` / `unavailable`).
