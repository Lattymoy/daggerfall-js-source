# Project Legacy 0.4.1 - Lattymoy, Ghð§† and Positronico (the port's owner's own mod; ported off its IL with every bug fixed)

**Project Legacy 0.4.1** for Daggerfall Unity 1.1.1 (GUID `a3cbfd81-bd91-485c-a3bc-171251ef7ac8`). The mod's own
description: "You can play with your descendants!" - a family tree, a descendant who takes the dead's place, and
siblings to switch between.

Mac (Lattymoy) handed the shipped archive over on 2026-10-05
(`Genealogy_Update-1012-0-4-1-1774616989.7z`, holding `project legacy (6).dfmod`, 144,062 bytes, sha256
`220c9cb58bf4ad7f30fa94e4d118620c97ab34a4e952979fe58cbd4b160093fd`): "So this is actually my DFU mod that I want to
integrate".

**Licence.** The bundle states none; the manifest names Lattymoy, Ghð§† and Positronico.

**Permission: the author's own - Mac is Lattymoy, the mod's first-named author (2026-10-05, "this is actually my DFU
mod that I want to integrate").**

## What is here

- `project-legacy.dfmod.json` - the shipped manifest, verbatim (the bundle names it `project_legacy.dfmod`; sha256
  `c366beb3...a327d2`).
- `modsettings.json` - the shipped settings, verbatim (the key, the second key, Descendants, Max Siblings, Siblings
  Probability).
- `Project Legacy.dll` - the shipped assembly, byte for byte (sha256 `05e356ec...978fe74`), and
  `il/Project_Legacy.il.txt` - every method body as CIL, dumped by `tools/ilDump.py`. The port
  (`src/systems/legacy/`) cites the assembly's types and members it restates.
- **Not here: the seven pictures.** `PJLFTBG`, `PJLFTFrame` and `PJLFT` (the parchment, its frame and the tree's
  branches), `PJLFTPN`, `PJLFTPNP` and `PJLFTPNSKP` (the card's panels) and `SCLTLK` (a talk window the code never
  draws). The card's grey stone and `SCLTLK`'s chrome read as cuts of the classic interface, and a render of game data
  is game data (Port-Doctrine), so none is committed until their provenance is Mac's word. The classic family window
  reads them from the player's own attached `.dfmod` (the texture door, `systems/dfmodTextures.js`); every skin has
  the Enhanced Plus window without them.
- **Not here: the C# source**, which the bundle does not carry. It was read back with ILSpy 8.2 for reading; the IL
  dump is the record.

To re-derive the dump:

    node tools/eotbIl.mjs "<...>/project legacy (6).dfmod" /tmp/pl
    pip install dnfile dncil
    python3 tools/ilDump.py "/tmp/pl/Project Legacy.dll" > vendor/project-legacy/il/Project_Legacy.il.txt

The arc: `bible/06-Systems/Legacy-Arc.md`.
